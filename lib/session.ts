import type { NextRequest, NextResponse } from 'next/server';
import { secureCookies } from './env';

export type Tokens = {
  accessToken: string;
  refreshToken?: string;
  /** Momento (ms) em que o access token expira. */
  expiresAt: number;
};

export const COOKIES = {
  access: 'mx_at',
  refresh: 'mx_rt',
  expires: 'mx_exp',
  verifier: 'mx_pkce',
  state: 'mx_state',
} as const;

const REFRESH_MAX_AGE = 60 * 60 * 24 * 60; // 60 dias; o Spotify pode expirar antes
const PKCE_MAX_AGE = 60 * 10;

const base = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: secureCookies(),
  path: '/',
});

export function readTokens(req: NextRequest): Partial<Tokens> {
  const c = req.cookies;
  const exp = Number(c.get(COOKIES.expires)?.value);
  return {
    accessToken: c.get(COOKIES.access)?.value || undefined,
    refreshToken: c.get(COOKIES.refresh)?.value || undefined,
    expiresAt: Number.isFinite(exp) ? exp : 0,
  };
}

export function writeTokens(res: NextResponse, t: Tokens): void {
  const ttl = Math.max(60, Math.floor((t.expiresAt - Date.now()) / 1000));
  res.cookies.set(COOKIES.access, t.accessToken, { ...base(), maxAge: ttl });
  res.cookies.set(COOKIES.expires, String(t.expiresAt), { ...base(), maxAge: ttl });
  if (t.refreshToken) res.cookies.set(COOKIES.refresh, t.refreshToken, { ...base(), maxAge: REFRESH_MAX_AGE });
}

export function clearTokens(res: NextResponse): void {
  for (const name of [COOKIES.access, COOKIES.refresh, COOKIES.expires]) {
    res.cookies.set(name, '', { ...base(), maxAge: 0 });
  }
}

export function setPkce(res: NextResponse, verifier: string, state: string): void {
  res.cookies.set(COOKIES.verifier, verifier, { ...base(), maxAge: PKCE_MAX_AGE });
  res.cookies.set(COOKIES.state, state, { ...base(), maxAge: PKCE_MAX_AGE });
}

export function readPkce(req: NextRequest): { verifier?: string; state?: string } {
  return {
    verifier: req.cookies.get(COOKIES.verifier)?.value || undefined,
    state: req.cookies.get(COOKIES.state)?.value || undefined,
  };
}

export function clearPkce(res: NextResponse): void {
  res.cookies.set(COOKIES.verifier, '', { ...base(), maxAge: 0 });
  res.cookies.set(COOKIES.state, '', { ...base(), maxAge: 0 });
}
