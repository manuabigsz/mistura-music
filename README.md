# Mistura

App em Next.js que cria playlists no Spotify a partir do que você já ouve, misturando os gêneros que você escolher (funk, pop, rock, flashback e o que mais quiser).

## O que você precisa

- Node.js 20.9 ou mais novo
- Uma conta Spotify **Premium** (desde fevereiro de 2026 o Spotify exige Premium do dono do app em modo de desenvolvimento)

## 1. Criar o app no Spotify

1. Entre em <https://developer.spotify.com/dashboard> e clique em **Create app**.
2. Em **Redirect URIs**, coloque exatamente:
   `http://127.0.0.1:3000/api/auth/callback`
   O Spotify não aceita `localhost` como endereço de retorno, por isso o app usa `127.0.0.1`.
3. Em **Which API/SDKs are you planning to use?**, marque **Web API** e salve.
4. Copie o **Client ID**. O Client Secret não é usado: o login é feito com PKCE.
5. Em **User Management**, adicione o e-mail da conta Spotify de cada pessoa que vai usar o app. No modo de desenvolvimento cabem até 5.

## 2. Rodar

```bash
cp .env.example .env.local   # e preencha o SPOTIFY_CLIENT_ID
npm install
npm run dev
```

Abra **<http://127.0.0.1:3000>** (não `localhost:3000`, senão os cookies do login se perdem no caminho).

## Como a playlist é montada

Em fevereiro de 2026 o Spotify fechou boa parte da Web API para apps em modo de desenvolvimento: não existem mais recomendações, “top músicas do artista” nem a lista de gêneros dos artistas, e a busca devolve no máximo 10 resultados. Então o Mistura monta a playlist assim:

1. **Seu som**: pega suas músicas mais ouvidas (últimas semanas e últimos meses), o que tocou por último e, se você marcou artistas, busca músicas deles.
2. **Gêneros**: cada gênero tem uma lista de artistas de referência em `lib/genres.ts`. O app sorteia alguns, busca as músicas deles (o flashback ainda filtra por ano, 1978 a 1999) e dá preferência a artistas de cada gênero que já aparecem no que você ouve.
3. **Proporção**: “Mais do que eu curto” usa cerca de 60% do seu som, “Equilibrado” 30% e “Só descobertas” nada (ajuste em `lib/options.ts`). Do seu som só entram músicas de artistas dos gêneros escolhidos, mais os artistas que você marcar.
4. **Ordem**: as faixas são intercaladas mantendo a proporção ao longo da playlist e evitando o mesmo artista duas vezes seguidas. Versões repetidas da mesma música (ao vivo, remaster) ficam de fora.
5. **Criação**: a playlist é criada como privada na sua conta, com `POST /me/playlists` e `POST /playlists/{id}/items`, os endpoints atuais.

Gêneros digitados na hora (tipo “piseiro”) não têm artistas de referência, então usam uma busca por texto e podem vir menos precisos. Pra deixar um gênero bom de verdade, adicione ele em `lib/genres.ts` com uns 10 artistas.

Uma playlist típica faz uns 20 pedidos à API do Spotify.

## Estrutura

```
app/
  page.tsx                  login ou montador, conforme a sessão
  layout.tsx, globals.css   fontes e estilo (cartaz lambe-lambe)
  api/auth/login            inicia o login (PKCE)
  api/auth/callback         recebe o código e grava os tokens em cookies httpOnly
  api/auth/logout           sai
  api/me                    seu nome e artistas mais ouvidos
  api/playlist              monta e cria a playlist
components/
  Mixer.tsx                 tela principal
  Poster.tsx                cartaz que atualiza ao vivo
  Login.tsx                 tela de entrada
lib/
  spotify.ts                cliente da API (renova token, trata 401/403/429)
  spotify-auth.ts           PKCE e troca de tokens
  session.ts                cookies da sessão
  mix.ts                    algoritmo da mistura
  genres.ts                 gêneros e artistas de referência
  options.ts                proporções, durações e limites
  validate.ts               validação do pedido
```

## Publicar

1. Defina `SPOTIFY_CLIENT_ID` e `APP_URL` (ex.: `https://mistura.seudominio.com`) nas variáveis de ambiente da hospedagem.
2. Adicione `https://mistura.seudominio.com/api/auth/callback` nos Redirect URIs do app no Spotify.
3. Com `APP_URL` em HTTPS os cookies passam a ser `Secure` automaticamente.

O modo de desenvolvimento continua limitado a 5 usuários. Pra abrir pra mais gente o Spotify exige o modo estendido, que hoje só é concedido a empresas.

## Problemas comuns

- **“O Spotify recusou o pedido” (403)**: a conta não está em User Management no dashboard, ou o dono do app não tem Premium.
- **Volta pra tela inicial depois do login**: o app foi aberto em `localhost`. Use `http://127.0.0.1:3000`.
- **“Limite de uso da API”**: a cota do modo de desenvolvimento acabou por enquanto; ela é compartilhada entre todos os seus apps.
- **“Sua sessão expirou”**: o Spotify agora expira refresh tokens; é só entrar de novo.
