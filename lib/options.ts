export type Taste = 'familiar' | 'equilibrado' | 'novo';

export const TASTES: { id: Taste; label: string; poster: string; hint: string }[] = [
  {
    id: 'familiar',
    label: 'Mais do que eu curto',
    poster: 'Mais do que você curte',
    hint: 'Puxa bastante das músicas que você já ouve, desde que sejam dos gêneros escolhidos.',
  },
  {
    id: 'equilibrado',
    label: 'Equilibrado',
    poster: '',
    hint: 'Um pouco do que você já ouve nesses gêneros e o resto de novidades.',
  },
  {
    id: 'novo',
    label: 'Só descobertas',
    poster: 'Só descobertas',
    hint: 'Nada do que você costuma ouvir. Só entram os artistas que você marcar acima.',
  },
];

/**
 * Parte da playlist que vem do que a pessoa já ouve, sempre filtrado pelos gêneros escolhidos.
 * O resto vem dos gêneros.
 */
export const FAMILIAR_SHARE: Record<Taste, number> = {
  familiar: 0.6,
  equilibrado: 0.3,
  novo: 0,
};

/** Tamanho da playlist: por número de músicas ou por tempo. */
export type Size = { id: string; label: string; poster: string; tracks?: number; minutes?: number };

export const SIZES: Size[] = [
  { id: '40', label: '40 músicas', poster: '40 músicas', tracks: 40 },
  { id: '30m', label: '30 min', poster: '30 minutos', minutes: 30 },
  { id: '1h', label: '1 h', poster: '1 hora', minutes: 60 },
  { id: '2h', label: '2 h', poster: '2 horas', minutes: 120 },
  { id: '3h', label: '3 h', poster: '3 horas', minutes: 180 },
  { id: '100', label: '100 músicas', poster: '100 músicas', tracks: 100 },
  { id: '200', label: '200 músicas', poster: '200 músicas', tracks: 200 },
];
export const DEFAULT_SIZE = SIZES[0];
export const sizeById = (id: unknown) => SIZES.find((s) => s.id === id) ?? DEFAULT_SIZE;

export const AVG_TRACK_MS = 210_000;

export const LIMITS = {
  customGenres: 8,
  label: 40,
  picked: 8,
  /** Artistas digitados que têm que entrar. */
  must: 10,
  vibe: 60,
};

/** Quantas músicas a playlist deve ter, aproximadamente. */
export function estimateCount(size: Size): number {
  return size.tracks ?? Math.min(200, Math.ceil(((size.minutes ?? 0) * 60_000) / AVG_TRACK_MS));
}
