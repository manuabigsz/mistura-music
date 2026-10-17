/**
 * Desde fevereiro de 2026 a API do Spotify (modo de desenvolvimento) não informa mais
 * os gêneros dos artistas e não tem mais recomendações nem "top músicas do artista".
 * Por isso cada gênero tem uma lista de artistas de referência: o app busca as músicas
 * desses artistas e cruza com o que você ouve. Edite à vontade.
 */
export type Genre = {
  id: string;
  label: string;
  seeds: string[];
  /** Filtro de ano opcional pra busca, no formato "1980-1999". */
  years?: string;
};

export const GENRES: Genre[] = [
  {
    id: 'funk',
    label: 'Funk',
    seeds: ['Kevin o Chris', 'MC Ryan SP', 'Ludmilla', 'Pedro Sampaio', 'MC Livinho', 'MC Hariel', 'Dennis DJ', 'MC Poze do Rodo', 'MC Daniel', 'Anitta', 'MC Kevinho', 'DJ GBR'],
  },
  {
    id: 'pop',
    label: 'Pop',
    seeds: ['Anitta', 'Luísa Sonza', 'Pabllo Vittar', 'IZA', 'Dua Lipa', 'Taylor Swift', 'Sabrina Carpenter', 'Olivia Rodrigo', 'Ariana Grande', 'The Weeknd', 'Lady Gaga', 'Bruno Mars'],
  },
  {
    id: 'rock',
    label: 'Rock',
    seeds: ['Arctic Monkeys', 'Foo Fighters', 'The Strokes', 'Red Hot Chili Peppers', 'Queen', 'Nirvana', 'Linkin Park', 'AC/DC', 'The Killers', "Guns N' Roses", 'Pearl Jam', 'Muse'],
  },
  {
    id: 'flashback',
    label: 'Flashback',
    years: '1978-1999',
    seeds: ['Corona', 'Haddaway', 'Ace of Base', 'Dr. Alban', 'Double You', 'Whigfield', 'La Bouche', 'Culture Beat', 'Snap!', 'Technotronic', '2 Unlimited', 'Real McCoy', 'Rick Astley', 'a-ha', 'Pet Shop Boys'],
  },
  {
    id: 'sertanejo',
    label: 'Sertanejo',
    seeds: ['Henrique & Juliano', 'Jorge & Mateus', 'Marília Mendonça', 'Gusttavo Lima', 'Maiara & Maraisa', 'Zé Neto & Cristiano', 'Ana Castela', 'Luan Santana', 'Simone Mendes', 'Matheus & Kauan'],
  },
  {
    id: 'pagode',
    label: 'Pagode',
    seeds: ['Thiaguinho', 'Péricles', 'Ferrugem', 'Sorriso Maroto', 'Menos é Mais', 'Turma do Pagode', 'Dilsinho', 'Grupo Revelação', 'Belo', 'Mumuzinho'],
  },
  {
    id: 'samba',
    label: 'Samba',
    seeds: ['Zeca Pagodinho', 'Beth Carvalho', 'Martinho da Vila', 'Alcione', 'Diogo Nogueira', 'Arlindo Cruz', 'Fundo de Quintal', 'Cartola', 'Jorge Aragão', 'Paulinho da Viola'],
  },
  {
    id: 'mpb',
    label: 'MPB',
    seeds: ['Caetano Veloso', 'Gilberto Gil', 'Djavan', 'Marisa Monte', 'Chico Buarque', 'Gal Costa', 'Milton Nascimento', 'Tim Maia', 'Elis Regina', 'ANAVITÓRIA', 'Tim Bernardes', 'Seu Jorge'],
  },
  {
    id: 'rocknac',
    label: 'Rock nacional',
    seeds: ['Legião Urbana', 'Titãs', 'Os Paralamas Do Sucesso', 'Barão Vermelho', 'Capital Inicial', 'Charlie Brown Jr.', 'Skank', 'Engenheiros Do Hawaii', 'Raimundos', 'Pitty', 'Los Hermanos'],
  },
  {
    id: 'rap',
    label: 'Rap',
    seeds: ["Racionais MC's", 'Emicida', 'Criolo', 'Djonga', "BK'", 'Filipe Ret', 'Baco Exu do Blues', 'Sabotage', 'Kendrick Lamar', 'Drake', 'Eminem'],
  },
  {
    id: 'trap',
    label: 'Trap',
    seeds: ['Matuê', 'Teto', 'Veigh', 'Orochi', 'L7NNON', 'WIU', 'Kayblack', 'Chefin', 'Travis Scott', 'Future'],
  },
  {
    id: 'eletronica',
    label: 'Eletrônica',
    seeds: ['Alok', 'Vintage Culture', 'Calvin Harris', 'David Guetta', 'Avicii', 'Fred again..', 'Kygo', 'Dubdogz', 'Bhaskar', 'Martin Garrix'],
  },
  {
    id: 'indie',
    label: 'Indie',
    seeds: ['Tame Impala', 'The Neighbourhood', 'Phoebe Bridgers', 'Mac DeMarco', 'Terno Rei', 'Boogarins', 'Vampire Weekend', 'Glass Animals', 'Cage The Elephant', 'Arctic Monkeys'],
  },
  {
    id: 'rnb',
    label: 'R&B',
    seeds: ['SZA', 'Frank Ocean', 'Daniel Caesar', 'Brent Faiyaz', 'H.E.R.', 'Summer Walker', 'Jorja Smith', 'Giveon', 'Usher', 'Alicia Keys'],
  },
  {
    id: 'reggaeton',
    label: 'Reggaeton',
    seeds: ['Bad Bunny', 'KAROL G', 'J Balvin', 'Daddy Yankee', 'Feid', 'Rauw Alejandro', 'Ozuna', 'Myke Towers', 'Sech', 'Anuel AA'],
  },
  {
    id: 'axe',
    label: 'Axé',
    seeds: ['Ivete Sangalo', 'Claudia Leitte', 'Bell Marques', 'Daniela Mercury', 'Léo Santana', 'Harmonia do Samba', 'Psirico', 'É o Tchan', 'Chiclete Com Banana', 'Asa de Águia'],
  },
];

export const DEFAULT_GENRES = ['funk', 'pop', 'rock', 'flashback'];

export function genreById(id: string): Genre | undefined {
  return GENRES.find((g) => g.id === id);
}

/** Na seleção, gêneros próprios vêm como "custom:Nome". */
export const CUSTOM_PREFIX = 'custom:';
export function genreLabel(selectionId: string): string {
  if (selectionId.startsWith(CUSTOM_PREFIX)) return selectionId.slice(CUSTOM_PREFIX.length);
  return genreById(selectionId)?.label ?? selectionId;
}
