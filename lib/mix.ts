import { Spotify, SpotifyError, type STrack } from './spotify';
import type { Genre } from './genres';
import { AVG_TRACK_MS, DEFAULT_TRACKS, FAMILIAR_SHARE, estimateCount, type Taste } from './options';
import { clean, joinPt, norm } from './text';

export type GenreChoice = { kind: 'base'; genre: Genre } | { kind: 'custom'; label: string };

export type MixRequest = {
  genres: GenreChoice[];
  picked: { id: string; name: string }[];
  taste: Taste;
  duration: number;
  vibe: string;
};

export type MixResult = {
  id: string;
  uri: string;
  name: string;
  url: string | null;
  tracks: number;
  minutes: number;
};

const labelOf = (c: GenreChoice) => (c.kind === 'base' ? c.genre.label : c.label);

function shuffle<T>(list: T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Intercala listas: 1º de cada, depois 2º de cada… */
function roundRobin<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

/** Roda `fn` com no máximo `limit` chamadas ao mesmo tempo. Falhas não fatais viram null. */
async function settle<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  let fatal: unknown = null;
  const worker = async () => {
    while (next < items.length && !fatal) {
      const i = next++;
      try {
        out[i] = await fn(items[i]);
      } catch (e) {
        if (e instanceof SpotifyError && e.fatal) fatal = e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (fatal) throw fatal;
  return out;
}

/** Chave pra evitar a mesma música em versões diferentes (ao vivo, remaster…). */
function trackKey(t: STrack): string {
  const title = norm(t.name.replace(/\s[-–]\s.*$/, '').replace(/\(.*?\)|\[.*?\]/g, ''));
  return `${title}|${norm(t.artists[0]?.name ?? '')}`;
}

async function familiarPool(sp: Spotify, picked: MixRequest['picked']) {
  const [short, medium, recent] = await settle(['short_term', 'medium_term', 'recent'] as const, 3, (k) =>
    k === 'recent' ? sp.recentlyPlayed() : sp.topTracks(k),
  );
  const pickedLists = await settle(picked.slice(0, 6), 3, async (a) => {
    const found = await sp.searchTracks(`artist:"${clean(a.name)}"`);
    return found.filter((t) => t.artists.some((x) => x.id === a.id));
  });
  return {
    picked: roundRobin(pickedLists.map((l) => shuffle(l ?? []))),
    top: [...shuffle(short ?? []), ...shuffle(medium ?? []), ...shuffle(recent ?? [])],
  };
}

async function genrePool(sp: Spotify, choice: GenreChoice, slots: number) {
  if (choice.kind === 'base') {
    const g = choice.genre;
    const howMany = Math.max(3, Math.min(6, Math.ceil(slots / 2)));
    const seeds = shuffle(g.seeds).slice(0, howMany);
    const year = g.years ? ` year:${g.years}` : '';
    const lists = await settle(seeds, 3, async (name) => {
      const key = norm(name);
      const found = await sp.searchTracks(`artist:"${clean(name)}"${year}`);
      return found.filter((t) => t.artists.some((a) => norm(a.name) === key));
    });
    return {
      tracks: roundRobin(lists.map((l) => shuffle(l ?? []))),
      artistKeys: new Set(g.seeds.map(norm)),
    };
  }
  // Gênero digitado pela pessoa: tenta o filtro de gênero e, se vier pouco, busca pelo nome.
  const label = clean(choice.label, 40);
  const [byGenre] = await settle([label], 1, (l) => sp.searchTracks(`genre:"${l}"`));
  let tracks = byGenre ?? [];
  if (tracks.length < 5) {
    const [byText] = await settle([label], 1, (l) => sp.searchTracks(l));
    tracks = tracks.concat(byText ?? []);
  }
  return { tracks: shuffle(tracks), artistKeys: new Set<string>() };
}

/**
 * Intercala as faixas mantendo a proporção de cada fonte ao longo da playlist
 * e evitando o mesmo artista duas vezes seguidas.
 */
function weave(lanes: STrack[][]): STrack[] {
  const qs = lanes.filter((l) => l.length).map((l) => ({ items: l.slice(), total: l.length, used: 0 }));
  const out: STrack[] = [];
  for (;;) {
    const open = qs.filter((q) => q.items.length);
    if (!open.length) break;
    open.sort((a, b) => (a.used + 0.5) / a.total - (b.used + 0.5) / b.total);
    const prev = out[out.length - 1]?.artists[0]?.id;
    const lane = open.find((q) => q.items.some((t) => t.artists[0]?.id !== prev)) ?? open[0];
    let idx = lane.items.findIndex((t) => t.artists[0]?.id !== prev);
    if (idx < 0) idx = 0;
    out.push(lane.items.splice(idx, 1)[0]);
    lane.used++;
  }
  return out;
}

function playlistName(labels: string[], vibe: string): string {
  const v = vibe.trim().replace(/^(pra|para)\s+/i, '');
  const name = v ? `Mistura pra ${v}` : `Mistura: ${joinPt(labels)}`;
  return clean(name, 100);
}

export async function buildAndCreate(sp: Spotify, req: MixRequest): Promise<MixResult> {
  const targetMs = req.duration > 0 ? req.duration * 60_000 : null;
  const targetCount = estimateCount(req.duration) + (targetMs ? 3 : 0);
  const familiarTarget = Math.round(targetCount * FAMILIAR_SHARE[req.taste]);
  const perGenre = Math.max(1, Math.ceil((targetCount - familiarTarget) / req.genres.length));

  const fam = await familiarPool(sp, req.picked);
  const pools: Awaited<ReturnType<typeof genrePool>>[] = [];
  for (const choice of req.genres) pools.push(await genrePool(sp, choice, perGenre));

  const usedIds = new Set<string>();
  const usedKeys = new Set<string>();
  const take = (t: STrack): boolean => {
    const k = trackKey(t);
    if (usedIds.has(t.id) || usedKeys.has(k)) return false;
    usedIds.add(t.id);
    usedKeys.add(k);
    return true;
  };

  // Do seu som só entra o que combina com os gêneros escolhidos (ou artistas que você marcou):
  // escolher só funk não pode trazer o pop que você ouve.
  const genreArtists = new Set(pools.flatMap((p) => [...p.artistKeys]));
  const fitsGenres = (t: STrack) => t.artists.some((a) => genreArtists.has(norm(a.name)));
  const familiarAll = [...fam.picked, ...fam.top.filter(fitsGenres)];

  // Em "Só descobertas", tira dos gêneros o que você já ouve.
  const known = new Set(fam.top.map((t) => t.id));
  const genreCandidates = pools.map((pool) =>
    req.taste === 'novo' ? pool.tracks.filter((t) => !known.has(t.id)) : pool.tracks,
  );

  const familiarLane: STrack[] = [];
  for (const t of familiarAll) {
    if (familiarLane.length >= Math.max(familiarTarget, Math.min(fam.picked.length, 12))) break;
    if (take(t)) familiarLane.push(t);
  }
  const genreLanes = genreCandidates.map((list) => {
    const lane: STrack[] = [];
    for (const t of list) {
      if (lane.length >= perGenre) break;
      if (take(t)) lane.push(t);
    }
    return lane;
  });

  // Se algum gênero veio curto, completa com o que sobrou.
  let total = familiarLane.length + genreLanes.reduce((s, l) => s + l.length, 0);
  const extra: STrack[] = [];
  for (const t of [...roundRobin(genreCandidates), ...(req.taste === 'novo' ? [] : familiarAll)]) {
    if (total >= targetCount) break;
    if (take(t)) {
      extra.push(t);
      total++;
    }
  }

  const ordered = weave([...genreLanes, familiarLane, extra]);

  let final: STrack[];
  if (targetMs) {
    final = [];
    let ms = 0;
    for (const t of ordered) {
      if (ms >= targetMs - 60_000) break;
      final.push(t);
      ms += t.duration_ms || AVG_TRACK_MS;
    }
  } else {
    final = ordered.slice(0, DEFAULT_TRACKS);
  }

  if (final.length < 5) {
    throw new SpotifyError('no_tracks', 'Não achei músicas suficientes pra essa mistura. Tente outros gêneros.');
  }

  const labels = req.genres.map(labelOf);
  const base = req.taste === 'novo' ? 'pra descobrir' : 'com base no que você ouve';
  const description = clean(`${joinPt(labels)}, ${base}. Feita no Mistura.`, 300);
  const playlist = await sp.createPlaylist(playlistName(labels, req.vibe), description);

  try {
    await sp.addItems(
      playlist.id,
      final.map((t) => t.uri),
    );
  } catch (e) {
    if (e instanceof SpotifyError && e.fatal) throw e;
    throw new SpotifyError('partial', 'A playlist foi criada, mas as músicas não entraram todas. Abra no Spotify pra conferir.', {
      url: playlist.url,
    });
  }

  return {
    id: playlist.id,
    uri: playlist.uri,
    name: playlist.name,
    url: playlist.url,
    tracks: final.length,
    minutes: Math.round(final.reduce((s, t) => s + (t.duration_ms || AVG_TRACK_MS), 0) / 60_000),
  };
}
