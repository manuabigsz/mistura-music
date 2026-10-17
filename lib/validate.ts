import { CUSTOM_PREFIX, genreById } from './genres';
import type { GenreChoice, MixRequest } from './mix';
import { LIMITS, TASTES, sizeById, type Taste } from './options';
import { clean, norm } from './text';

const ARTIST_ID = /^[0-9A-Za-z]{22}$/;

/** Valida o corpo do POST /api/playlist. Devolve o pedido ou uma mensagem de erro. */
export function parseMixRequest(body: unknown): MixRequest | string {
  if (!body || typeof body !== 'object') return 'Pedido inválido.';
  const b = body as Record<string, unknown>;

  const genres: GenreChoice[] = [];
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
      genres.push({ kind: 'custom', label });
    } else {
      const g = genreById(raw);
      if (!g || seen.has(g.id)) continue;
      seen.add(g.id);
      genres.push({ kind: 'base', genre: g });
    }
  }
  if (!genres.length) return 'Escolha pelo menos um gênero.';
  if (genres.length > 12) return 'Escolha no máximo 12 gêneros.';

  const picked: MixRequest['picked'] = [];
  for (const raw of Array.isArray(b.picked) ? b.picked.slice(0, LIMITS.picked) : []) {
    if (!raw || typeof raw !== 'object') continue;
    const { id, name } = raw as { id?: unknown; name?: unknown };
    if (typeof id !== 'string' || !ARTIST_ID.test(id) || typeof name !== 'string' || !name.trim()) continue;
    picked.push({ id, name: clean(name) });
  }

  const must: string[] = [];
  for (const raw of Array.isArray(b.must) ? b.must.slice(0, LIMITS.must) : []) {
    if (typeof raw !== 'string') continue;
    const name = clean(raw, 60);
    if (name && !must.some((m) => norm(m) === norm(name))) must.push(name);
  }

  const taste: Taste = TASTES.some((t) => t.id === b.taste) ? (b.taste as Taste) : 'equilibrado';
  const size = sizeById(b.size);
  const vibe = typeof b.vibe === 'string' ? clean(b.vibe, LIMITS.vibe) : '';

  return { genres, picked, must, taste, size, vibe };
}
