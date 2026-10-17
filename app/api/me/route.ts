import { NextResponse, type NextRequest } from 'next/server';
import { GENRES } from '@/lib/genres';
import { errorResponse } from '@/lib/http';
import { Spotify, SpotifyError, type SArtist, type STrack } from '@/lib/spotify';
import { norm } from '@/lib/text';

/**
 * O Spotify não informa mais os gêneros dos artistas, então o gênero é deduzido
 * cruzando o que a pessoa ouve com os artistas de referência de cada gênero.
 */
function guessGenres(artists: SArtist[], tracks: STrack[]) {
  const score = new Map<string, number>();
  const add = (name: string, weight: number) => {
    const k = norm(name);
    for (const g of GENRES) if (g.seeds.some((s) => norm(s) === k)) score.set(g.id, (score.get(g.id) ?? 0) + weight);
  };
  artists.forEach((a, i) => add(a.name, artists.length - i + 2));
  for (const t of tracks) for (const a of t.artists) add(a.name, 1);
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => ({ id, label: GENRES.find((g) => g.id === id)!.label }));
}

/** Nome da pessoa, os artistas mais ouvidos e um resuminho do que ela anda ouvindo. */
export async function GET(req: NextRequest) {
  const sp = Spotify.fromRequest(req);
  let me: Awaited<ReturnType<Spotify['me']>> | null = null;
  try {
    me = await sp.me();
    const recentTop = sp.topTracks('short_term').catch((e) => {
      if (e instanceof SpotifyError && e.fatal) throw e;
      return [] as STrack[];
    });
    let artists = await sp.topArtists('medium_term', 12);
    if (artists.length < 4) {
      const recent = await sp.topArtists('short_term', 12).catch((e) => {
        if (e instanceof SpotifyError && e.fatal) throw e;
        return [];
      });
      const ids = new Set(artists.map((a) => a.id));
      artists = artists.concat(recent.filter((a) => !ids.has(a.id))).slice(0, 12);
    }
    const tracks = await recentTop;
    const top = tracks[0];
    const summary = {
      artists: artists.slice(0, 3).map((a) => a.name),
      genres: guessGenres(artists, tracks),
      track: top ? { name: top.name, artist: top.artists.map((a) => a.name).join(', ') } : null,
    };
    return sp.persist(NextResponse.json({ name: me.name, email: me.email, artists, summary }));
  } catch (e) {
    // Se o /me passou, devolve quem está logado junto com o erro, pra conferir no User Management.
    if (me && e instanceof SpotifyError) e.detail = { ...e.detail, name: me.name, email: me.email };
    return errorResponse(e, sp);
  }
}
