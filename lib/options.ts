export type Taste = 'familiar' | 'equilibrado' | 'novo';

export const TASTES: { id: Taste; label: string; poster: string }[] = [
  { id: 'familiar', label: 'Mais do que eu curto', poster: 'Mais do que você curte' },
  { id: 'equilibrado', label: 'Equilibrado', poster: '' },
  { id: 'novo', label: 'Mais descobertas', poster: 'Mais descobertas' },
];

/** Parte da playlist que vem do que a pessoa já ouve. O resto vem dos gêneros. */
export const FAMILIAR_SHARE: Record<Taste, number> = {
  familiar: 0.6,
  equilibrado: 0.35,
  novo: 0.15,
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
