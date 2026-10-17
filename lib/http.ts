import { NextResponse } from 'next/server';
import { clearTokens } from './session';
import { MESSAGES, SpotifyError, type ErrorCode, type Spotify } from './spotify';

const STATUS: Record<ErrorCode, number> = {
  not_logged_in: 401,
  session_expired: 401,
  forbidden: 403,
  quota: 429,
  rate_limited: 429,
  bad_request: 400,
  no_tracks: 422,
  partial: 502,
  spotify_error: 502,
};

export function errorResponse(e: unknown, sp?: Spotify): NextResponse {
  const err = e instanceof SpotifyError ? e : new SpotifyError('spotify_error', MESSAGES.generic);
  if (!(e instanceof SpotifyError)) console.error('[mistura]', e);
  const res = NextResponse.json({ error: err.code, message: err.message, ...err.detail }, { status: STATUS[err.code] });
  if (err.code === 'session_expired' || err.code === 'not_logged_in') clearTokens(res);
  else sp?.persist(res);
  return res;
}
