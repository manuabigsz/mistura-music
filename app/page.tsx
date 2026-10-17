import { cookies } from 'next/headers';
import Login from '@/components/Login';
import Mixer from '@/components/Mixer';
import { COOKIES } from '@/lib/session';

export default async function Page({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const jar = await cookies();
  const loggedIn = jar.has(COOKIES.refresh) || jar.has(COOKIES.access);
  const { erro } = await searchParams;
  return loggedIn ? <Mixer /> : <Login erro={erro} />;
}
