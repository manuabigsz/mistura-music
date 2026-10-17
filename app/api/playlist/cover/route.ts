import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse } from '@/lib/http';
import { Spotify, SpotifyError } from '@/lib/spotify';

const PLAYLIST_ID = /^[0-9A-Za-z]{22}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const MAX = 256 * 1024;

/** Põe o cartaz como capa de uma playlist criada pelo app. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; image?: unknown } | null;
  const id = body?.id;
  const image = body?.image;
  if (typeof id !== 'string' || !PLAYLIST_ID.test(id) || typeof image !== 'string' || !image || image.length > MAX || !BASE64.test(image)) {
    return NextResponse.json({ error: 'bad_request', message: 'Imagem de capa inválida.' }, { status: 400 });
  }

  const sp = Spotify.fromRequest(req);
  try {
    await sp.setCover(id, image);
    return sp.persist(NextResponse.json({ ok: true }));
  } catch (e) {
    // Login feito antes da permissão de capa existir no app.
    if (e instanceof SpotifyError && e.code === 'forbidden') {
      e.message = 'Pra pôr o cartaz como capa, saia e entre de novo: o Spotify precisa da permissão de imagem.';
    }
    return errorResponse(e, sp);
  }
}
