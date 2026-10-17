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

export const DURATIONS: { min: number; label: string; poster: string }[] = [
  { min: 0, label: 'Livre', poster: 'Cerca de 40 músicas' },
  { min: 30, label: '30 min', poster: '30 minutos' },
  { min: 60, label: '1 h', poster: '1 hora' },
  { min: 120, label: '2 h', poster: '2 horas' },
  { min: 180, label: '3 h', poster: '3 horas' },
];

export const DEFAULT_TRACKS = 40;
export const AVG_TRACK_MS = 210_000;

export const LIMITS = {
  customGenres: 5,
  label: 40,
  picked: 8,
  vibe: 60,
};

/** Quantas músicas a playlist deve ter, aproximadamente. */
export function estimateCount(durationMin: number): number {
  return durationMin > 0 ? Math.min(150, Math.ceil((durationMin * 60_000) / AVG_TRACK_MS)) : DEFAULT_TRACKS;
}
