import type { NextRequest, NextResponse } from 'next/server';
import { refreshTokens } from './spotify-auth';
import { readTokens, writeTokens, type Tokens } from './session';

const API = 'https://api.spotify.com/v1';

export type ErrorCode =
  | 'not_logged_in'
  | 'session_expired'
  | 'forbidden'
  | 'quota'
  | 'rate_limited'
  | 'bad_request'
  | 'no_tracks'
  | 'partial'
  | 'spotify_error';

/** Erros que não adianta contornar: param a montagem da playlist na hora. */
const FATAL: ReadonlySet<ErrorCode> = new Set(['not_logged_in', 'session_expired', 'forbidden', 'quota']);

export class SpotifyError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public detail: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'SpotifyError';
  }
  get fatal(): boolean {
    return FATAL.has(this.code);
  }
}

export const MESSAGES = {
  login: 'Entre com o Spotify pra continuar.',
  expired: 'Sua sessão com o Spotify expirou. Entre de novo.',
  forbidden:
    'O Spotify recusou o pedido. Confira se a sua conta está em “Users Management” no app do Spotify Developer Dashboard e se o dono do app tem Premium.',
  quota: 'O app atingiu o limite de uso da API do Spotify por enquanto. Tente de novo mais tarde.',
  rate: 'O Spotify pediu pra ir mais devagar. Espere alguns segundos e tente de novo.',
  generic: 'O Spotify não respondeu como esperado. Tente de novo.',
};

export type SArtist = { id: string; name: string };
export type STrack = { id: string; uri: string; name: string; duration_ms: number; artists: SArtist[] };
type Query = Record<string, string | number | undefined>;
type TimeRange = 'short_term' | 'medium_term' | 'long_term';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isArtist(x: unknown): x is SArtist {
  return !!x && typeof (x as SArtist).id === 'string' && typeof (x as SArtist).name === 'string';
}

function asTrack(x: unknown): STrack | null {
  if (!x || typeof x !== 'object') return null;
  const t = x as Partial<STrack> & { is_local?: boolean; artists?: unknown[] };
  if (typeof t.id !== 'string' || typeof t.uri !== 'string' || !t.uri.startsWith('spotify:track:')) return null;
  if (t.is_local || typeof t.name !== 'string' || !Array.isArray(t.artists)) return null;
  const artists = t.artists.filter(isArtist).map((a) => ({ id: a.id, name: a.name }));
  if (!artists.length) return null;
  return {
    id: t.id,
    uri: t.uri,
    name: t.name,
    duration_ms: typeof t.duration_ms === 'number' ? t.duration_ms : 0,
    artists,
  };
}

const tracksOf = (list: unknown): STrack[] =>
  Array.isArray(list) ? list.map(asTrack).filter((t): t is STrack => t !== null) : [];

/**
 * Cliente mínimo da Web API do Spotify, já no formato de fevereiro de 2026
 * (POST /me/playlists e /playlists/{id}/items). Renova o token sozinho e
 * devolve os tokens novos pra rota gravar nos cookies.
 */
export class Spotify {
  private tokens: Partial<Tokens>;
  private fresh: Tokens | null = null;
  private refreshing: Promise<string> | null = null;

  constructor(tokens: Partial<Tokens>) {
    this.tokens = tokens;
  }

  static fromRequest(req: NextRequest): Spotify {
    return new Spotify(readTokens(req));
  }

  /** Grava na resposta os tokens renovados durante esta requisição. */
  persist<T extends NextResponse>(res: T): T {
    if (this.fresh) writeTokens(res, this.fresh);
    return res;
  }

  /** `failed` = token que acabou de levar 401; força renovação se ainda for o atual. */
  private async accessToken(failed?: string): Promise<string> {
    const { accessToken, refreshToken, expiresAt } = this.tokens;
    if (failed && accessToken && accessToken !== failed) return accessToken;
    const valid = accessToken && expiresAt && expiresAt - 60_000 > Date.now();
    if (!failed && valid) return accessToken;
    if (!refreshToken) {
      throw accessToken
        ? new SpotifyError('session_expired', MESSAGES.expired)
        : new SpotifyError('not_logged_in', MESSAGES.login);
    }
    if (!this.refreshing) {
      this.refreshing = refreshTokens(refreshToken)
        .then((t) => {
          const next: Tokens = { ...t, refreshToken: t.refreshToken ?? refreshToken };
          this.tokens = next;
          this.fresh = next;
          return next.accessToken;
        })
        .catch(() => {
          throw new SpotifyError('session_expired', MESSAGES.expired);
        })
        .finally(() => {
          this.refreshing = null;
        });
    }
    return this.refreshing;
  }

  async call<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}, attempt = 0): Promise<T> {
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
    const token = await this.accessToken();

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new SpotifyError('spotify_error', MESSAGES.generic);
    }

    if (res.status === 401) {
      if (attempt > 0) throw new SpotifyError('session_expired', MESSAGES.expired);
      await this.accessToken(token);
      return this.call<T>(method, path, opts, attempt + 1);
    }
    if (res.status === 429) {
      const body = (await res.json().catch(() => null)) as { reason?: string; error?: { reason?: string } } | null;
      if (body?.reason === 'QUOTA_EXCEEDED' || body?.error?.reason === 'QUOTA_EXCEEDED') {
        throw new SpotifyError('quota', MESSAGES.quota);
      }
      const wait = Number(res.headers.get('Retry-After')) || 1;
      if (attempt < 2 && wait <= 5) {
        await sleep(wait * 1000 + Math.random() * 400);
        return this.call<T>(method, path, opts, attempt + 1);
      }
      throw new SpotifyError('rate_limited', MESSAGES.rate, { retryAfter: wait });
    }
    if (res.status === 403) throw new SpotifyError('forbidden', MESSAGES.forbidden);
    if (res.status === 400) throw new SpotifyError('bad_request', MESSAGES.generic);
    if (res.status >= 500 && method === 'GET' && attempt === 0) {
      await sleep(400 + Math.random() * 400);
      return this.call<T>(method, path, opts, attempt + 1);
    }
    if (!res.ok) throw new SpotifyError('spotify_error', MESSAGES.generic, { status: res.status });

    const text = await res.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return undefined as T;
    }
  }

  /** Alguns limites mudaram em 2026; se 50 for recusado, tenta 20. */
  private async withLimit<T>(fn: (limit: number) => Promise<T>, limit = 50): Promise<T> {
    try {
      return await fn(limit);
    } catch (e) {
      if (e instanceof SpotifyError && e.code === 'bad_request' && limit > 20) return fn(20);
      throw e;
    }
  }

  async me(): Promise<{ id: string; name: string | null }> {
    const r = await this.call<{ id?: string; display_name?: string | null }>('GET', '/me');
    return { id: r?.id ?? '', name: r?.display_name ?? null };
  }

  async topArtists(range: TimeRange = 'medium_term', limit = 12): Promise<SArtist[]> {
    const r = await this.call<{ items?: unknown[] }>('GET', '/me/top/artists', { query: { time_range: range, limit } });
    return (r?.items ?? []).filter(isArtist).map((a) => ({ id: a.id, name: a.name }));
  }

  topTracks(range: TimeRange): Promise<STrack[]> {
    return this.withLimit(async (limit) => {
      const r = await this.call<{ items?: unknown[] }>('GET', '/me/top/tracks', { query: { time_range: range, limit } });
      return tracksOf(r?.items);
    });
  }

  recentlyPlayed(): Promise<STrack[]> {
    return this.withLimit(async (limit) => {
      const r = await this.call<{ items?: { track?: unknown; item?: unknown }[] }>('GET', '/me/player/recently-played', {
        query: { limit },
      });
      return tracksOf((r?.items ?? []).map((x) => (x && typeof x.item === 'object' ? x.item : x?.track)));
    });
  }

  /** A busca devolve no máximo 10 resultados por página desde 2026. */
  async searchTracks(q: string): Promise<STrack[]> {
    const run = (market?: string) =>
      this.call<{ tracks?: { items?: unknown[] } }>('GET', '/search', {
        query: { q, type: 'track', limit: 10, market },
      });
    let r;
    try {
      r = await run('from_token');
    } catch (e) {
      if (!(e instanceof SpotifyError && e.code === 'bad_request')) throw e;
      r = await run();
    }
    return tracksOf(r?.tracks?.items);
  }

  async createPlaylist(name: string, description: string): Promise<{ id: string; uri: string; name: string; url: string | null }> {
    const r = await this.call<{ id?: string; uri?: string; name?: string; external_urls?: { spotify?: string } }>(
      'POST',
      '/me/playlists',
      { body: { name, description, public: false } },
    );
    if (!r?.id) {
      throw new SpotifyError(
        'spotify_error',
        'O Spotify não confirmou a criação da playlist. Confira no app antes de tentar de novo.',
      );
    }
    return { id: r.id, uri: r.uri ?? `spotify:playlist:${r.id}`, name: r.name ?? name, url: r.external_urls?.spotify ?? null };
  }

  async addItems(playlistId: string, uris: string[]): Promise<void> {
    for (let i = 0; i < uris.length; i += 100) {
      await this.call('POST', `/playlists/${encodeURIComponent(playlistId)}/items`, {
        body: { uris: uris.slice(i, i + 100) },
      });
    }
  }
}
