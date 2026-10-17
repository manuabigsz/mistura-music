import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { clearPkce, readPkce, writeTokens } from '@/lib/session';
import { exchangeCode } from '@/lib/spotify-auth';

export async function GET(req: NextRequest) {
  let appUrl: string;
  try {
    appUrl = env().appUrl;
  } catch {
    return NextResponse.redirect(new URL('/?erro=config', req.url));
  }

  const home = (erro?: string) => {
    const res = NextResponse.redirect(erro ? `${appUrl}/?erro=${erro}` : `${appUrl}/`);
    clearPkce(res);
    return res;
  };

  const params = req.nextUrl.searchParams;
  const error = params.get('error');
  if (error) return home(error === 'access_denied' ? 'acesso_negado' : 'login');

  const code = params.get('code');
  const state = params.get('state');
  const pkce = readPkce(req);
  if (!code || !state || !pkce.verifier || state !== pkce.state) return home('estado');

  try {
    const tokens = await exchangeCode({ code, verifier: pkce.verifier });
    const res = home();
    writeTokens(res, tokens);
    return res;
  } catch {
    return home('token');
  }
}
