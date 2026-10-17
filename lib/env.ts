export type Env = {
  clientId: string;
  appUrl: string;
  redirectUri: string;
};

/** Lê a configuração do servidor. Lança erro se o Client ID não estiver definido. */
export function env(): Env {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  if (!clientId) throw new Error('SPOTIFY_CLIENT_ID não está definido no .env.local');
  const appUrl = (process.env.APP_URL?.trim() || 'http://127.0.0.1:3000').replace(/\/+$/, '');
  return { clientId, appUrl, redirectUri: `${appUrl}/api/auth/callback` };
}

/** Cookies "secure" só quando o app roda em HTTPS. */
export const secureCookies = () => (process.env.APP_URL ?? '').trim().startsWith('https://');
