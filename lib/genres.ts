import { norm } from './text';

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
  /** Outros jeitos de escrever, pra reconhecer o gênero no texto livre. */
  aliases?: string[];
};

export const GENRES: Genre[] = [
  {
    id: 'funk',
    aliases: ['funk carioca', 'funk brasileiro', 'baile funk', 'mandelao', 'funk paulista'],
    label: 'Funk',
    seeds: ['Kevin o Chris', 'MC Ryan SP', 'Ludmilla', 'Pedro Sampaio', 'MC Livinho', 'MC Hariel', 'Dennis DJ', 'MC Poze do Rodo', 'MC Daniel', 'Anitta', 'MC Kevinho', 'DJ GBR'],
  },
  {
    id: 'pop',
    aliases: ['pop internacional', 'pop nacional', 'pop br'],
    label: 'Pop',
    seeds: ['Anitta', 'Luísa Sonza', 'Pabllo Vittar', 'IZA', 'Dua Lipa', 'Taylor Swift', 'Sabrina Carpenter', 'Olivia Rodrigo', 'Ariana Grande', 'The Weeknd', 'Lady Gaga', 'Bruno Mars'],
  },
  {
    id: 'rock',
    aliases: ['rock classico', 'rock alternativo', 'classic rock'],
    label: 'Rock',
    seeds: ['Arctic Monkeys', 'Foo Fighters', 'The Strokes', 'Red Hot Chili Peppers', 'Queen', 'Nirvana', 'Linkin Park', 'AC/DC', 'The Killers', "Guns N' Roses", 'Pearl Jam', 'Muse'],
  },
  {
    id: 'flashback',
    aliases: ['anos 80', 'anos 90', 'dance 90', 'eurodance', '80s', '90s'],
    label: 'Flashback',
    years: '1978-1999',
    seeds: ['Corona', 'Haddaway', 'Ace of Base', 'Dr. Alban', 'Double You', 'Whigfield', 'La Bouche', 'Culture Beat', 'Snap!', 'Technotronic', '2 Unlimited', 'Real McCoy', 'Rick Astley', 'a-ha', 'Pet Shop Boys'],
  },
  {
    id: 'sertanejo',
    aliases: ['sertanejo universitario', 'feminejo', 'agronejo'],
    label: 'Sertanejo',
    seeds: ['Henrique & Juliano', 'Jorge & Mateus', 'Marília Mendonça', 'Gusttavo Lima', 'Maiara & Maraisa', 'Zé Neto & Cristiano', 'Ana Castela', 'Luan Santana', 'Simone Mendes', 'Matheus & Kauan'],
  },
  {
    id: 'pagode',
    aliases: ['pagodinho'],
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
    aliases: ['musica popular brasileira', 'nova mpb'],
    label: 'MPB',
    seeds: ['Caetano Veloso', 'Gilberto Gil', 'Djavan', 'Marisa Monte', 'Chico Buarque', 'Gal Costa', 'Milton Nascimento', 'Tim Maia', 'Elis Regina', 'ANAVITÓRIA', 'Tim Bernardes', 'Seu Jorge'],
  },
  {
    id: 'rocknac',
    aliases: ['rock brasileiro', 'rock br'],
    label: 'Rock nacional',
    seeds: ['Legião Urbana', 'Titãs', 'Os Paralamas Do Sucesso', 'Barão Vermelho', 'Capital Inicial', 'Charlie Brown Jr.', 'Skank', 'Engenheiros Do Hawaii', 'Raimundos', 'Pitty', 'Los Hermanos'],
  },
  {
    id: 'rap',
    aliases: ['hip hop', 'hiphop', 'rap nacional', 'rap br'],
    label: 'Rap',
    seeds: ["Racionais MC's", 'Emicida', 'Criolo', 'Djonga', "BK'", 'Filipe Ret', 'Baco Exu do Blues', 'Sabotage', 'Kendrick Lamar', 'Drake', 'Eminem'],
  },
  {
    id: 'trap',
    aliases: ['trap nacional', 'trap br'],
    label: 'Trap',
    seeds: ['Matuê', 'Teto', 'Veigh', 'Orochi', 'L7NNON', 'WIU', 'Kayblack', 'Chefin', 'Travis Scott', 'Future'],
  },
  {
    id: 'eletronica',
    aliases: ['eletronico', 'edm', 'house', 'electronic', 'dance'],
    label: 'Eletrônica',
    seeds: ['Alok', 'Vintage Culture', 'Calvin Harris', 'David Guetta', 'Avicii', 'Fred again..', 'Kygo', 'Dubdogz', 'Bhaskar', 'Martin Garrix'],
  },
  {
    id: 'indie',
    aliases: ['indie rock', 'indie pop', 'alternativo', 'alternative'],
    label: 'Indie',
    seeds: ['Tame Impala', 'The Neighbourhood', 'Phoebe Bridgers', 'Mac DeMarco', 'Terno Rei', 'Boogarins', 'Vampire Weekend', 'Glass Animals', 'Cage The Elephant', 'Arctic Monkeys'],
  },
  {
    id: 'rnb',
    aliases: ['rnb', 'r b', 'soul'],
    label: 'R&B',
    seeds: ['SZA', 'Frank Ocean', 'Daniel Caesar', 'Brent Faiyaz', 'H.E.R.', 'Summer Walker', 'Jorja Smith', 'Giveon', 'Usher', 'Alicia Keys'],
  },
  {
    id: 'reggaeton',
    aliases: ['latino', 'urbano latino', 'latin'],
    label: 'Reggaeton',
    seeds: ['Bad Bunny', 'KAROL G', 'J Balvin', 'Daddy Yankee', 'Feid', 'Rauw Alejandro', 'Ozuna', 'Myke Towers', 'Sech', 'Anuel AA'],
  },
  {
    id: 'axe',
    aliases: ['axe music', 'carnaval'],
    label: 'Axé',
    seeds: ['Ivete Sangalo', 'Claudia Leitte', 'Bell Marques', 'Daniela Mercury', 'Léo Santana', 'Harmonia do Samba', 'Psirico', 'É o Tchan', 'Chiclete Com Banana', 'Asa de Águia'],
  },
  {
    id: 'pesado',
    label: 'Rock pesado',
    aliases: ['metal', 'heavy metal', 'hard rock', 'rock pesadao', 'nu metal', 'metalcore'],
    seeds: ['Metallica', 'System Of A Down', 'Slipknot', 'Iron Maiden', 'Avenged Sevenfold', 'Black Sabbath', 'Pantera', 'Rammstein', 'Sepultura', 'Korn', 'Bring Me The Horizon', 'Megadeth'],
  },
  {
    id: 'piseiro',
    label: 'Piseiro e forró',
    aliases: ['piseiro', 'forro', 'pisadinha', 'arrocha', 'brega funk', 'tecnobrega'],
    seeds: ['João Gomes', 'Wesley Safadão', 'Xand Avião', 'Tarcísio do Acordeon', 'Vitor Fernandes', 'Mari Fernandez', 'Nattan', 'Zé Vaqueiro', 'Barões da Pisadinha', 'Calcinha Preta', 'Os Barões da Pisadinha'],
  },
  {
    id: 'emo',
    label: 'Emo e pop punk',
    aliases: ['emo', 'pop punk', 'punk', 'emocore'],
    seeds: ['My Chemical Romance', 'Paramore', 'Fall Out Boy', 'blink-182', 'Green Day', 'Simple Plan', 'Avril Lavigne', 'Fresno', 'NX Zero', 'CPM 22', 'Pitty', 'All Time Low'],
  },
  {
    id: 'kpop',
    label: 'K-pop',
    aliases: ['kpop', 'k pop', 'coreano'],
    seeds: ['BTS', 'BLACKPINK', 'TWICE', 'Stray Kids', 'NewJeans', 'SEVENTEEN', 'aespa', 'LE SSERAFIM', 'ITZY', 'Jungkook', 'ATEEZ', 'IVE'],
  },
  {
    id: 'gospel',
    label: 'Gospel',
    aliases: ['louvor', 'worship', 'musica gospel', 'evangelica'],
    seeds: ['Aline Barros', 'Fernandinho', 'Gabriela Rocha', 'Anderson Freire', 'Isadora Pompeo', 'Thalles Roberto', 'Bruna Karla', 'Diante do Trono', 'Morada', 'Kemuel'],
  },
];

export const DEFAULT_GENRES = ['funk', 'pop', 'rock', 'flashback'];

export function genreById(id: string): Genre | undefined {
  return GENRES.find((g) => g.id === id);
}

/** Acha um gênero da lista pelo nome ou apelido ("metal" vira Rock pesado). */
export function findGenre(text: string): Genre | undefined {
  const k = norm(text);
  return GENRES.find((g) => norm(g.label) === k || g.aliases?.some((a) => norm(a) === k));
}

/**
 * Quebra um texto livre em gêneros: "pop com rock pesado, indie e um pouco de trap".
 * Devolve os ids dos gêneros conhecidos e os nomes que não estão na lista.
 */
export function parseGenreText(text: string): { known: string[]; custom: string[] } {
  const whole = findGenre(text);
  if (whole) return { known: [whole.id], custom: [] };
  const parts = text
    .split(/[,;+/]|\s+(?:com|e|and|mais|tipo|ou)\s+/i)
    .map((p) =>
      p
        .replace(/^(?:um pouco de|uns|umas|algo de|músicas? de|musicas? de|só|so)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((p) => p.length > 1);
  const known: string[] = [];
  const custom: string[] = [];
  for (const p of parts) {
    const g = findGenre(p);
    if (g) {
      if (!known.includes(g.id)) known.push(g.id);
    } else if (!custom.some((c) => norm(c) === norm(p))) custom.push(p);
  }
  return { known, custom };
}

/** Na seleção, gêneros próprios vêm como "custom:Nome". */
export const CUSTOM_PREFIX = 'custom:';
export function genreLabel(selectionId: string): string {
  if (selectionId.startsWith(CUSTOM_PREFIX)) return selectionId.slice(CUSTOM_PREFIX.length);
  return genreById(selectionId)?.label ?? selectionId;
}
