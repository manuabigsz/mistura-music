import { CUSTOM_PREFIX, findGenre, genreById } from './genres';
import type { GenreChoice, MixRequest, Weight } from './mix';
import { LIMITS, TASTES, sizeById, type Taste } from './options';
import { clean, norm } from './text';

const ARTIST_ID = /^[0-9A-Za-z]{22}$/;

const weightOf = (w: unknown): Weight => (w === 1 || w === 3 ? w : 2);

/** Valida o corpo do POST /api/playlist. Devolve o pedido ou uma mensagem de erro. */
export function parseMixRequest(body: unknown): MixRequest | string {
  if (!body || typeof body !== 'object') return 'Pedido inválido.';
  const b = body as Record<string, unknown>;

  const genres: GenreChoice[] = [];
  const gw = b.genreWeights && typeof b.genreWeights === 'object' ? (b.genreWeights as Record<string, unknown>) : {};
  const seen = new Set<string>();
  let customCount = 0;
  for (const raw of Array.isArray(b.genres) ? b.genres.slice(0, 40) : []) {
    if (typeof raw !== 'string') continue;
    if (raw.startsWith(CUSTOM_PREFIX)) {
      const label = clean(raw.slice(CUSTOM_PREFIX.length), LIMITS.label);
      const key = `c:${norm(label)}`;
      if (!label || seen.has(key) || customCount >= LIMITS.customGenres) continue;
      seen.add(key);
      customCount++;
      genres.push({ kind: 'custom', label, weight: weightOf(gw[raw]) });
    } else {
      const g = genreById(raw);
      if (!g || seen.has(g.id)) continue;
      seen.add(g.id);
      genres.push({ kind: 'base', genre: g, weight: weightOf(gw[raw]) });
    }
  }
  if (!genres.length) return 'Escolha pelo menos um gênero.';
  if (genres.length > 12) return 'Escolha no máximo 12 gêneros.';

  const picked: MixRequest['picked'] = [];
  for (const raw of Array.isArray(b.picked) ? b.picked.slice(0, LIMITS.picked) : []) {
    if (!raw || typeof raw !== 'object') continue;
    const { id, name, weight } = raw as { id?: unknown; name?: unknown; weight?: unknown };
    if (typeof id !== 'string' || !ARTIST_ID.test(id) || typeof name !== 'string' || !name.trim()) continue;
    picked.push({ id, name: clean(name), weight: weightOf(weight) });
  }

  const must: MixRequest['must'] = [];
  for (const raw of Array.isArray(b.must) ? b.must.slice(0, LIMITS.must) : []) {
    const r = typeof raw === 'string' ? { name: raw } : (raw as { name?: unknown; weight?: unknown } | null);
    if (!r || typeof r.name !== 'string') continue;
    const name = clean(r.name, 60);
    if (name && !must.some((m) => norm(m.name) === norm(name))) must.push({ name, weight: weightOf(r.weight) });
  }

  const taste: Taste = TASTES.some((t) => t.id === b.taste) ? (b.taste as Taste) : 'equilibrado';
  const size = sizeById(b.size);
  const vibe = typeof b.vibe === 'string' ? clean(b.vibe, LIMITS.vibe) : '';

  // Evitar: cada item vira gênero (se estiver na lista) ou artista.
  const avoid: MixRequest['avoid'] = { artists: [], genres: [] };
  for (const raw of Array.isArray(b.avoid) ? b.avoid.slice(0, LIMITS.avoid) : []) {
    if (typeof raw !== 'string') continue;
    const name = clean(raw, 60);
    if (!name) continue;
    const g = findGenre(name);
    if (g) {
      if (!avoid.genres.includes(g) && !genres.some((c) => c.kind === 'base' && c.genre.id === g.id)) avoid.genres.push(g);
    } else if (!avoid.artists.some((a) => norm(a) === norm(name))) avoid.artists.push(name);
  }
  const noExplicit = b.noExplicit === true;

  return { genres, picked, must, taste, size, vibe, avoid, noExplicit };
}
