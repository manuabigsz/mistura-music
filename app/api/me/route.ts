import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse } from '@/lib/http';
import { Spotify, SpotifyError } from '@/lib/spotify';

/** Nome da pessoa e os artistas mais ouvidos, pra escolher quem não pode faltar. */
export async function GET(req: NextRequest) {
  const sp = Spotify.fromRequest(req);
  try {
    const me = await sp.me();
    let artists = await sp.topArtists('medium_term', 12);
    if (artists.length < 4) {
      const recent = await sp.topArtists('short_term', 12).catch((e) => {
        if (e instanceof SpotifyError && e.fatal) throw e;
        return [];
      });
      const ids = new Set(artists.map((a) => a.id));
      artists = artists.concat(recent.filter((a) => !ids.has(a.id))).slice(0, 12);
    }
    return sp.persist(NextResponse.json({ name: me.name, artists }));
  } catch (e) {
    return errorResponse(e, sp);
  }
}
