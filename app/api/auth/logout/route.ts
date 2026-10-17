import { NextResponse, type NextRequest } from 'next/server';
import { clearTokens } from '@/lib/session';

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/', req.url), 303);
  clearTokens(res);
  return res;
}
