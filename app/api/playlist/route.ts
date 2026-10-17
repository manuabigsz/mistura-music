import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse } from '@/lib/http';
import { buildAndCreate } from '@/lib/mix';
import { Spotify } from '@/lib/spotify';
import { parseMixRequest } from '@/lib/validate';

// Montar a playlist faz algumas dezenas de buscas; dá folga em hospedagens serverless.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'bad_request', message: 'Pedido inválido.' }, { status: 415 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseMixRequest(body);
  if (typeof parsed === 'string') {
    return NextResponse.json({ error: 'bad_request', message: parsed }, { status: 400 });
  }

  const sp = Spotify.fromRequest(req);
  try {
    const result = await buildAndCreate(sp, parsed);
    return sp.persist(NextResponse.json(result, { status: 201 }));
  } catch (e) {
    return errorResponse(e, sp);
  }
}
