import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse } from '@/lib/http';
import { Spotify, SpotifyError } from '@/lib/spotify';

/** Nome da pessoa e os artistas mais ouvidos, pra escolher quem não pode faltar. */
export async function GET(req: NextRequest) {
  const sp = Spotify.fromRequest(req);
  let me: Awaited<ReturnType<Spotify['me']>> | null = null;
  try {
    me = await sp.me();
    let artists = await sp.topArtists('medium_term', 12);
    if (artists.length < 4) {
      const recent = await sp.topArtists('short_term', 12).catch((e) => {
        if (e instanceof SpotifyError && e.fatal) throw e;
        return [];
      });
      const ids = new Set(artists.map((a) => a.id));
      artists = artists.concat(recent.filter((a) => !ids.has(a.id))).slice(0, 12);
    }
    return sp.persist(NextResponse.json({ name: me.name, email: me.email, artists }));
  } catch (e) {
    // Se o /me passou, devolve quem está logado junto com o erro, pra conferir no User Management.
    if (me && e instanceof SpotifyError) e.detail = { ...e.detail, name: me.name, email: me.email };
    return errorResponse(e, sp);
  }
}
