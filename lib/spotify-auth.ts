import { env } from './env';
import type { Tokens } from './session';

const ACCOUNTS = 'https://accounts.spotify.com';

/** Só o necessário: mais ouvidos, tocadas recentemente e criar playlists. */
export const SCOPES = [
  'user-top-read',
  'user-read-recently-played',
  'playlist-modify-private',
  'playlist-modify-public',
];

export class AuthError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'AuthError';
  }
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Buffer.from(arr).toString('base64url');
}

export function randomString(bytes = 48): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64url(arr);
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(digest);
}

export function authorizeUrl(p: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const url = new URL(`${ACCOUNTS}/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: p.clientId,
    scope: SCOPES.join(' '),
    redirect_uri: p.redirectUri,
    state: p.state,
    code_challenge_method: 'S256',
    code_challenge: p.challenge,
  }).toString();
  return url.toString();
}

async function tokenCall(params: Record<string, string>): Promise<Tokens> {
  let res: Response;
  try {
    res = await fetch(`${ACCOUNTS}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AuthError('Sem resposta do Spotify.');
  }
  const data = (await res.json().catch(() => null)) as
    | { access_token?: string; refresh_token?: string; expires_in?: number; error?: string }
    | null;
  if (!res.ok || !data?.access_token) {
    throw new AuthError(data?.error ?? 'Falha ao obter token', res.status);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

export function exchangeCode(p: { code: string; verifier: string }): Promise<Tokens> {
  const { clientId, redirectUri } = env();
  return tokenCall({
    grant_type: 'authorization_code',
    code: p.code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: p.verifier,
  });
}

export function refreshTokens(refreshToken: string): Promise<Tokens> {
  const { clientId } = env();
  return tokenCall({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });
}
