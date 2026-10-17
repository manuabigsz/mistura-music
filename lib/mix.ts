import { Spotify, SpotifyError, type STrack } from './spotify';
import type { Genre } from './genres';
import { AVG_TRACK_MS, FAMILIAR_SHARE, estimateCount, type Size, type Taste } from './options';
import { clean, joinPt, norm } from './text';

/** Quanto de cada gênero ou artista: 1 pouco, 2 normal, 3 muito. */
export type Weight = 1 | 2 | 3;

export type GenreChoice = ({ kind: 'base'; genre: Genre } | { kind: 'custom'; label: string }) & { weight: Weight };

export type MixRequest = {
  genres: GenreChoice[];
  /** Artistas marcados entre os mais ouvidos (com id). */
  picked: { id: string; name: string; weight: Weight }[];
  /** Artistas digitados que têm que entrar (só o nome). */
  must: { name: string; weight: Weight }[];
  taste: Taste;
  size: Size;
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

type Wanted = { id?: string; name: string; weight: Weight };

/** Peso relativo de cada nível: "muito" vale quase quatro vezes "pouco". */
const GENRE_MULT: Record<Weight, number> = { 1: 0.5, 2: 1, 3: 1.9 };
const ARTIST_MULT: Record<Weight, number> = { 1: 0.45, 2: 1, 3: 2 };
type Lane = { key: string; tracks: STrack[] };

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

/** Busca páginas de 10 (o máximo da busca desde 2026) e junta tudo, na ordem de relevância. */
async function searchPages(sp: Spotify, q: string, pages: number): Promise<STrack[]> {
  const lists = await settle(
    Array.from({ length: pages }, (_, i) => i * 10),
    2,
    (offset) => sp.searchTracks(q, offset),
  );
  return lists.flatMap((l) => l ?? []);
}

const pagesFor = (n: number) => Math.min(4, Math.max(1, Math.ceil(n / 8)));

/** Músicas de cada artista pedido, das mais relevantes pras menos. */
async function wantedPool(sp: Spotify, wanted: Wanted[], quotas: number[]) {
  const lists = await settle(wanted.map((w, i) => ({ w, quota: quotas[i] })), 3, async ({ w, quota }) => {
    const key = norm(w.name);
    const found = await searchPages(sp, `artist:"${clean(w.name)}"`, pagesFor(quota));
    return found.filter((t) => t.artists.some((a) => (w.id ? a.id === w.id : norm(a.name) === key)));
  });
  return wanted.map((w, i) => ({ artist: w, quota: quotas[i], tracks: lists[i] ?? [] }));
}

async function topPool(sp: Spotify): Promise<STrack[]> {
  const [short, medium, recent] = await settle(['short_term', 'medium_term', 'recent'] as const, 3, (k) =>
    k === 'recent' ? sp.recentlyPlayed() : sp.topTracks(k),
  );
  return [...shuffle(short ?? []), ...shuffle(medium ?? []), ...shuffle(recent ?? [])];
}

async function genrePool(sp: Spotify, choice: GenreChoice, slots: number) {
  if (choice.kind === 'base') {
    const g = choice.genre;
    // Playlist curta: poucos artistas, só os sucessos. Longa: todos os artistas e mais páginas.
    const howMany = slots <= 15 ? Math.max(3, Math.min(6, Math.ceil(slots / 2))) : g.seeds.length;
    const pages = slots > 80 ? 3 : slots > 40 ? 2 : 1;
    const seeds = shuffle(g.seeds).slice(0, howMany);
    const year = g.years ? ` year:${g.years}` : '';
    const lists = await settle(seeds, 4, async (name) => {
      const key = norm(name);
      const found = await searchPages(sp, `artist:"${clean(name)}"${year}`, pages);
      return found.filter((t) => t.artists.some((a) => norm(a.name) === key));
    });
    return {
      tracks: roundRobin(lists.map((l) => l ?? [])),
      artistKeys: new Set(g.seeds.map(norm)),
    };
  }
  // Gênero digitado: tenta o filtro de gênero e, se vier pouco, busca pelo nome.
  const label = clean(choice.label, 40);
  const pages = Math.min(5, Math.ceil(slots / 10) + 1);
  let tracks = await searchPages(sp, `genre:"${label}"`, pages);
  if (tracks.length < Math.min(10, slots)) tracks = tracks.concat(await searchPages(sp, label, pages));
  // Os artistas que apareceram viram a referência do gênero, pra cruzar com o que você ouve.
  return { tracks, artistKeys: new Set(tracks.flatMap((t) => t.artists.map((a) => norm(a.name)))) };
}

/** Escolhe a próxima faixa sem repetir o artista da anterior, se der. */
function pull(list: STrack[], prev: string | undefined): STrack | undefined {
  if (!list.length) return undefined;
  let idx = list.findIndex((t) => t.artists[0]?.id !== prev);
  if (idx < 0) idx = 0;
  return list.splice(idx, 1)[0];
}

/**
 * Monta a ordem em blocos: algumas músicas seguidas de cada gênero, mantendo a
 * proporção ao longo da playlist. Fica bem mais fluida que alternar a cada faixa.
 */
function blocks(lanes: Lane[], blockSize: number): STrack[] {
  const qs = lanes.filter((l) => l.tracks.length).map((l) => ({ items: l.tracks.slice(), total: l.tracks.length, used: 0 }));
  const out: STrack[] = [];
  let last = -1;
  for (;;) {
    const open = qs.map((q, i) => ({ q, i })).filter(({ q }) => q.items.length);
    if (!open.length) break;
    open.sort((a, b) => (a.q.used + 0.5) / a.q.total - (b.q.used + 0.5) / b.q.total);
    // Evita o mesmo gênero em dois blocos seguidos quando há outro disponível.
    const pick = open.find(({ i }) => i !== last) ?? open[0];
    for (let n = 0; n < blockSize; n++) {
      const t = pull(pick.q.items, out[out.length - 1]?.artists[0]?.id);
      if (!t) break;
      out.push(t);
      pick.q.used++;
    }
    last = pick.i;
  }
  return out;
}

/** Intercala duas listas mantendo a proporção (conhecidas no meio das novas). */
function blend(a: STrack[], b: STrack[]): STrack[] {
  const out: STrack[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const takeA = j >= b.length || (i < a.length && (i + 0.5) / a.length <= (j + 0.5) / b.length);
    out.push(takeA ? a[i++] : b[j++]);
  }
  return out;
}

function playlistName(labels: string[], vibe: string): string {
  const v = vibe.trim().replace(/^(pra|para)\s+/i, '');
  const name = v ? `Mistura pra ${v}` : `Mistura: ${joinPt(labels)}`;
  return clean(name, 100);
}

export async function buildAndCreate(sp: Spotify, req: MixRequest): Promise<MixResult> {
  const targetMs = req.size.minutes ? req.size.minutes * 60_000 : null;
  const targetCount = estimateCount(req.size) + (targetMs ? 3 : 0);

  // Artistas pedidos: cada um ganha uma cota garantida, maior ou menor conforme o peso.
  // Juntos ocupam no máximo metade da playlist.
  const pickedKeys = new Set(req.picked.map((p) => norm(p.name)));
  const wanted: Wanted[] = [...req.picked, ...req.must.filter((m) => !pickedKeys.has(norm(m.name)))];
  const baseQuota = wanted.length ? (targetCount * 0.3) / wanted.length : 0;
  let quotas = wanted.map((w) => Math.max(2, Math.round(baseQuota * ARTIST_MULT[w.weight])));
  const quotaSum = quotas.reduce((s, q) => s + q, 0);
  if (quotaSum > targetCount * 0.5) quotas = quotas.map((q) => Math.max(2, Math.floor((q * targetCount * 0.5) / quotaSum)));
  quotas = quotas.map((q) => Math.min(40, q));
  const artistTotal = quotas.reduce((s, q) => s + q, 0);

  // Gêneros: dividem o resto na proporção dos pesos.
  const familiarTarget = Math.round(targetCount * FAMILIAR_SHARE[req.taste]);
  const genreTarget = Math.max(req.genres.length, targetCount - artistTotal);
  const mults = req.genres.map((g) => GENRE_MULT[g.weight]);
  const multSum = mults.reduce((s, m) => s + m, 0);
  const genreSlots = mults.map((m) => Math.max(1, Math.ceil((genreTarget * m) / multSum)));

  const [wantedLists, top] = await Promise.all([
    wanted.length ? wantedPool(sp, wanted, quotas) : Promise.resolve([]),
    req.taste === 'novo' ? Promise.resolve([] as STrack[]) : topPool(sp),
  ]);
  const pools: Awaited<ReturnType<typeof genrePool>>[] = [];
  for (const [i, choice] of req.genres.entries()) pools.push(await genrePool(sp, choice, genreSlots[i]));

  const usedIds = new Set<string>();
  const usedKeys = new Set<string>();
  const take = (t: STrack): boolean => {
    const k = trackKey(t);
    if (usedIds.has(t.id) || usedKeys.has(k)) return false;
    usedIds.add(t.id);
    usedKeys.add(k);
    return true;
  };
  const genreOf = (t: STrack) => pools.findIndex((p) => t.artists.some((a) => p.artistKeys.has(norm(a.name))));

  // 1. Artistas pedidos primeiro: são garantidos. Vão pro bloco do gênero deles, se tiver.
  const lanes: Lane[] = req.genres.map((g) => ({ key: labelOf(g), tracks: [] }));
  const wantedLane: Lane = { key: 'pedidos', tracks: [] };
  for (const { tracks, quota } of wantedLists) {
    let n = 0;
    for (const t of tracks) {
      if (n >= quota) break;
      if (!take(t)) continue;
      const g = genreOf(t);
      (g >= 0 ? lanes[g] : wantedLane).tracks.push(t);
      n++;
    }
  }

  // 2. Do seu som, só o que é dos gêneros escolhidos: escolher só funk não traz o pop que você ouve.
  const familiar: STrack[][] = pools.map(() => []);
  const familiarCap = mults.map((m) => Math.ceil((familiarTarget * m) / multSum));
  for (const t of top) {
    const g = genreOf(t);
    if (g < 0 || familiar[g].length >= familiarCap[g]) continue;
    if (take(t)) familiar[g].push(t);
  }

  // 3. Descobertas de cada gênero. Em "Só descobertas", sai o que você já ouve.
  const known = new Set(top.map((t) => t.id));
  const leftovers: STrack[][] = [];
  pools.forEach((pool, g) => {
    const room = Math.max(0, genreSlots[g] - lanes[g].tracks.length - familiar[g].length);
    const fresh: STrack[] = [];
    const rest: STrack[] = [];
    for (const t of pool.tracks) {
      if (req.taste === 'novo' && known.has(t.id)) continue;
      if (fresh.length < room) {
        if (take(t)) fresh.push(t);
      } else rest.push(t);
    }
    lanes[g].tracks = [...lanes[g].tracks, ...blend(familiar[g], fresh)];
    leftovers.push(rest);
  });

  // 4. Se algum gênero veio curto, completa com o que sobrou dos outros.
  let total = lanes.reduce((s, l) => s + l.tracks.length, 0) + wantedLane.tracks.length;
  for (const t of roundRobin(leftovers)) {
    if (total >= targetCount) break;
    if (!take(t)) continue;
    const g = genreOf(t);
    lanes[g >= 0 ? g : 0].tracks.push(t);
    total++;
  }

  const blockSize = targetCount >= 100 ? 5 : targetCount >= 40 ? 4 : 3;
  const ordered = blocks([...lanes, wantedLane], req.genres.length + (wantedLane.tracks.length ? 1 : 0) > 1 ? blockSize : 1);

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
    final = ordered.slice(0, targetCount);
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
