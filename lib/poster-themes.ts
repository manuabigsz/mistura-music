/** Estilos do cartaz. Valem pra prévia na página e pra imagem compartilhada. */
export type PosterTheme = {
  id: string;
  label: string;
  /** Paradas do degradê de cima pra baixo: [posição de 0 a 1, cor]. */
  stops: [number, string][];
  ink: string;
  footBg: string;
  footInk: string;
  /** Granulado: escuro em fundo claro, claro em fundo escuro. */
  grain: 'dark' | 'light';
};

export const POSTER_THEMES: PosterTheme[] = [
  {
    id: 'sol',
    label: 'Pôr do sol',
    stops: [[0, '#ffe600'], [0.14, '#ffe600'], [0.5, '#ff8a00'], [0.86, '#ff2e97'], [1, '#ff2e97']],
    ink: '#000000',
    footBg: '#000000',
    footInk: '#ffe600',
    grain: 'dark',
  },
  {
    id: 'neon',
    label: 'Neon',
    stops: [[0, '#14002e'], [0.55, '#3a0066'], [1, '#000000']],
    ink: '#39ff14',
    footBg: '#39ff14',
    footInk: '#000000',
    grain: 'light',
  },
  {
    id: 'oceano',
    label: 'Oceano',
    stops: [[0, '#00e5ff'], [0.5, '#2962ff'], [1, '#1a237e']],
    ink: '#ffffff',
    footBg: '#ffffff',
    footInk: '#1a237e',
    grain: 'dark',
  },
  {
    id: 'baile',
    label: 'Baile',
    stops: [[0, '#00c853'], [0.6, '#aeea00'], [1, '#ffea00']],
    ink: '#002776',
    footBg: '#002776',
    footInk: '#ffea00',
    grain: 'dark',
  },
  {
    id: 'chiclete',
    label: 'Chiclete',
    stops: [[0, '#ffe3f1'], [0.5, '#ffa6d5'], [1, '#c77dff']],
    ink: '#3a0030',
    footBg: '#3a0030',
    footInk: '#ffe3f1',
    grain: 'dark',
  },
  {
    id: 'jornal',
    label: 'Preto e branco',
    stops: [[0, '#f4f1ea'], [1, '#e6e1d6']],
    ink: '#000000',
    footBg: '#000000',
    footInk: '#f4f1ea',
    grain: 'dark',
  },
];

export const DEFAULT_THEME = POSTER_THEMES[0];
export const themeById = (id: unknown) => POSTER_THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;

export const cssGradient = (t: PosterTheme) =>
  `linear-gradient(180deg, ${t.stops.map(([p, c]) => `${c} ${Math.round(p * 100)}%`).join(', ')})`;
