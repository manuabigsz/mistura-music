import Poster from './Poster';

const ERRORS: Record<string, string> = {
  acesso_negado: 'Você não autorizou o acesso. Pra criar playlists, o Mistura precisa entrar na sua conta do Spotify.',
  estado: 'O login expirou no meio do caminho. Tente de novo.',
  token: 'O Spotify não aceitou o login. Confira o SPOTIFY_CLIENT_ID e o Redirect URI cadastrado no app do Spotify.',
  config: 'Falta configurar o SPOTIFY_CLIENT_ID no arquivo .env.local.',
  login: 'O Spotify não completou o login. Tente de novo.',
};

export default function Login({ erro }: { erro?: string }) {
  const message = erro ? (ERRORS[erro] ?? ERRORS.login) : null;
  return (
    <>
      <header className="top">
        <h1 className="brand">Mistura</h1>
        <p className="lede">Monte uma playlist no Spotify a partir do que você já ouve, com os gêneros que quiser.</p>
      </header>
      <main className="layout">
        <section className="intro">
          <p>
            Escolha os gêneros, marque os artistas que não podem faltar e o Mistura monta a playlist direto na sua conta,
            juntando o que você já curte com o que você pediu.
          </p>
          {message && (
            <p className="msg" role="alert">
              {message}
            </p>
          )}
          <a className="go" href="/api/auth/login">
            Entrar com o Spotify
          </a>
          <p className="hint">
            O app pede acesso só ao que usa: seus mais ouvidos, o que tocou por último e permissão pra criar playlists.
          </p>
        </section>
        <aside className="stage">
          <Poster genres={['Funk', 'Pop', 'Rock', 'Flashback']} artists={[]} foot={['Cerca de 40 músicas', 'Pra festa']} base="Com base no que você ouve" />
        </aside>
      </main>
    </>
  );
}
