import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { setPkce } from '@/lib/session';
import { authorizeUrl, challengeFor, randomString } from '@/lib/spotify-auth';

export async function GET(req: NextRequest) {
  let cfg;
  try {
    cfg = env();
  } catch {
    return NextResponse.redirect(new URL('/?erro=config', req.url));
  }

  // Os cookies do login precisam nascer no mesmo endereço do Redirect URI
  // (ex.: abrir em "localhost" e voltar em "127.0.0.1" perderia a sessão).
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (host && host !== new URL(cfg.appUrl).host) {
    return NextResponse.redirect(`${cfg.appUrl}/api/auth/login`);
  }

  const verifier = randomString(48);
  const state = randomString(16);
  const res = NextResponse.redirect(
    authorizeUrl({ clientId: cfg.clientId, redirectUri: cfg.redirectUri, state, challenge: await challengeFor(verifier) }),
  );
  setPkce(res, verifier, state);
  return res;
}
