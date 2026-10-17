'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Poster from './Poster';
import { CUSTOM_PREFIX, DEFAULT_GENRES, GENRES, findGenre, genreLabel, parseGenreText } from '@/lib/genres';
import { DEFAULT_SIZE, LIMITS, SIZES, TASTES, estimateCount, sizeById, type Taste } from '@/lib/options';
import { renderCover, renderPoster } from '@/lib/poster-image';
import { DEFAULT_THEME, POSTER_THEMES, cssGradient, themeById } from '@/lib/poster-themes';
import { joinPt } from '@/lib/text';

type Artist = { id: string; name: string };
type Weight = 1 | 2 | 3;
const WEIGHTS: { w: Weight; label: string }[] = [
  { w: 1, label: 'Pouco' },
  { w: 2, label: 'Normal' },
  { w: 3, label: 'Muito' },
];
const gKey = (id: string) => `g:${id}`;
const aKey = (name: string) => `a:${name.toLowerCase()}`;
type Summary = {
  artists: string[];
  genres: { id: string; label: string; share: number }[];
  tracks: { name: string; artist: string }[];
};
/** Quantos gêneros aparecem antes do "+ N gêneros". */
const GENRES_SHOWN = 10;
type Created = {
  id: string;
  name: string;
  url: string | null;
  genres: string[];
  tracks: number;
  minutes: number;
  at: number;
  /** Pra redesenhar o cartaz na hora de compartilhar. */
  artists?: string[];
  foot?: string[];
  base?: string;
  theme?: string;
};
type MeState =
  | { status: 'loading' }
  | { status: 'ready'; name: string | null; email: string | null; artists: Artist[]; summary: Summary | null }
  | { status: 'error'; message: string; relogin: boolean; name: string | null; email: string | null };
type Notice = { text: string; relogin?: boolean; url?: string | null } | null;

const KEY_PREFS = 'mistura:prefs:v1';
const KEY_HIST = 'mistura:criadas:v1';

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const safeUrl = (u: unknown) => (typeof u === 'string' && u.startsWith('https://open.spotify.com/') ? u : null);

function readJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sem armazenamento: segue sem lembrar */
  }
}
function isCreated(x: unknown): x is Created {
  const c = x as Created;
  return !!c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.at === 'number';
}
const fileName = (name: string) =>
  `${name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'mistura'}.png`;

export default function Mixer() {
  const [sel, setSel] = useState<string[]>(DEFAULT_GENRES);
  const [custom, setCustom] = useState<string[]>([]);
  const [taste, setTaste] = useState<Taste>('equilibrado');
  const [sizeId, setSizeId] = useState(DEFAULT_SIZE.id);
  const [vibe, setVibe] = useState('');
  const [themeId, setThemeId] = useState(DEFAULT_THEME.id);
  const [picked, setPicked] = useState<string[]>([]);
  const [addText, setAddText] = useState('');
  const [must, setMust] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, Weight>>({});
  const [avoid, setAvoid] = useState<string[]>([]);
  const [avoidText, setAvoidText] = useState('');
  const [noExplicit, setNoExplicit] = useState(false);
  const [sumOpen, setSumOpen] = useState(false);
  const [showAllGenres, setAllGenres] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mustText, setMustText] = useState('');
  const [me, setMe] = useState<MeState>({ status: 'loading' });
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [last, setLast] = useState<Created | null>(null);
  const [stamp, setStamp] = useState<{ key: string; config: string } | null>(null);
  const [history, setHistory] = useState<Created[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [share, setShare] = useState<{ id: string; file: File } | null>(null);
  const [shareMsg, setShareMsg] = useState('');
  const [cover, setCover] = useState<{
    id: string;
    theme: string;
    status: 'sending' | 'ok' | 'error';
    message?: string;
    relogin?: boolean;
  } | null>(null);
  const [goVisible, setGoVisible] = useState(true);
  const resultRef = useRef<HTMLDivElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);

  // Lembra as últimas escolhas e as playlists criadas neste navegador.
  useEffect(() => {
    const p = readJSON(KEY_PREFS) as Record<string, unknown> | null;
    if (p && typeof p === 'object') {
      const cust = Array.isArray(p.custom)
        ? p.custom.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.slice(0, LIMITS.label)).slice(0, 20)
        : [];
      const valid = new Set([...GENRES.map((g) => g.id), ...cust.map((c) => CUSTOM_PREFIX + c)]);
      setCustom(cust);
      if (Array.isArray(p.sel)) setSel(p.sel.filter((x): x is string => typeof x === 'string' && valid.has(x)));
      if (TASTES.some((t) => t.id === p.taste)) setTaste(p.taste as Taste);
      setSizeId(sizeById(p.size).id);
      if (Array.isArray(p.must)) setMust(p.must.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, LIMITS.must));
      if (typeof p.vibe === 'string') setVibe(p.vibe.slice(0, LIMITS.vibe));
      setThemeId(themeById(p.theme).id);
      if (Array.isArray(p.avoid)) setAvoid(p.avoid.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, LIMITS.avoid));
      setNoExplicit(p.noExplicit === true);
      if (p.weights && typeof p.weights === 'object') {
        const w: Record<string, Weight> = {};
        for (const [k, v] of Object.entries(p.weights as Record<string, unknown>)) if (v === 1 || v === 3) w[k] = v;
        setWeights(w);
      }
    }
    const h = readJSON(KEY_HIST);
    if (Array.isArray(h)) setHistory(h.filter(isCreated).slice(0, 30));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeJSON(KEY_PREFS, { sel, custom, taste, size: sizeId, must, vibe, theme: themeId, weights, avoid, noExplicit });
  }, [hydrated, sel, custom, taste, sizeId, must, vibe, themeId, weights, avoid, noExplicit]);

  useEffect(() => {
    if (hydrated) writeJSON(KEY_HIST, history.slice(0, 30));
  }, [hydrated, history]);

  // No celular, a barra de baixo com o botão de criar some quando o botão de verdade aparece.
  useEffect(() => {
    const el = goRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setGoVisible(entry.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const loadMe = useCallback(async () => {
    setMe({ status: 'loading' });
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMe({
          status: 'error',
          message: data?.message ?? 'Não deu pra carregar seus artistas.',
          relogin: res.status === 401,
          name: data?.name ?? null,
          email: data?.email ?? null,
        });
        return;
      }
      setMe({
        status: 'ready',
        name: data?.name ?? null,
        email: data?.email ?? null,
        artists: Array.isArray(data?.artists) ? data.artists : [],
        summary:
          data?.summary && Array.isArray(data.summary.artists) && Array.isArray(data.summary.genres)
            ? { ...data.summary, tracks: Array.isArray(data.summary.tracks) ? data.summary.tracks : [] }
            : null,
      });
    } catch {
      setMe({ status: 'error', message: 'Não deu pra falar com o servidor. Confira sua conexão.', relogin: false, name: null, email: null });
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  /* ---------- Derivados ---------- */
  const artists = me.status === 'ready' ? me.artists : [];
  const pickedArtists = picked.map((id) => artists.find((a) => a.id === id)).filter((a): a is Artist => !!a);
  const labels = sel.map(genreLabel);
  const tasteObj = TASTES.find((t) => t.id === taste) ?? TASTES[1];
  const sizeObj = sizeById(sizeId);
  const posterArtists = [
    ...pickedArtists.map((a) => a.name),
    ...must.filter((m) => !pickedArtists.some((a) => a.name.toLowerCase() === m.toLowerCase())),
  ];
  const vibeText = vibe.trim();
  const vibeLabel = vibeText ? (/^(pra|para|pro)\s/i.test(vibeText) ? vibeText : `Pra ${vibeText}`) : '';
  const foot = [sizeObj.poster, tasteObj.poster, vibeLabel].filter(Boolean);
  const base =
    posterArtists.length > 0
      ? taste === 'novo'
        ? 'Pra descobrir, sem faltar'
        : 'Com base no que você ouve, sem faltar'
      : taste === 'novo'
        ? 'Pra descobrir coisa nova'
        : 'Com base no que você ouve';
  const configKey = JSON.stringify([sel, picked, must, taste, sizeId, vibeText, weights, avoid, noExplicit]);
  const stampKey = stamp && stamp.config === configKey ? stamp.key : null;
  const count = estimateCount(sizeObj);
  const theme = themeById(themeId);

  // Prepara a imagem do cartaz assim que a playlist fica pronta: no iPhone o
  // compartilhamento precisa sair direto do toque, sem esperar nada.
  useEffect(() => {
    if (!last) return;
    let alive = true;
    setShareMsg('');
    renderPoster({
      genres: last.genres,
      artists: last.artists ?? [],
      base: last.base ?? 'Com base no que você ouve',
      foot: last.foot ?? [],
      name: last.name,
      url: last.url,
      theme: themeById(last.theme),
    })
      .then((blob) => alive && setShare({ id: last.id, file: new File([blob], fileName(last.name), { type: 'image/png' }) }))
      .catch(() => alive && setShare(null));
    return () => {
      alive = false;
    };
  }, [last]);

  const shareFile = share && last && share.id === last.id ? share.file : null;
  const canShareFile =
    !!shareFile && typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [shareFile] });

  const weightOf = (key: string): Weight => weights[key] ?? 2;
  function setWeight(key: string, w: Weight) {
    setWeights((all) => {
      const next = { ...all };
      if (w === 2) delete next[key];
      else next[key] = w;
      return next;
    });
  }
  // Linhas do "quanto de cada": gêneros escolhidos e artistas que têm que entrar.
  const dosage = [
    ...sel.map((id, i) => ({ key: gKey(id), label: labels[i], kind: 'Gênero' })),
    ...posterArtists.map((name) => ({ key: aKey(name), label: name, kind: 'Artista' })),
  ];

  /* ---------- Ações ---------- */
  function toggleGenre(id: string) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  /** Aceita uma frase inteira: "pop com rock pesado, indie" vira três gêneros. */
  function addGenre(e: FormEvent) {
    e.preventDefault();
    const { known, custom: typed } = parseGenreText(addText.slice(0, 200));
    if (!known.length && !typed.length) return;
    const names = typed.map((t) => t.slice(0, LIMITS.label));
    const ids = [
      ...known,
      ...names.map((n) => CUSTOM_PREFIX + (custom.find((c) => c.toLowerCase() === n.toLowerCase()) ?? n)),
    ];
    setCustom((c) => [...c, ...names.filter((n) => !c.some((x) => x.toLowerCase() === n.toLowerCase()))].slice(-20));
    setSel((s) => [...s, ...ids.filter((id) => !s.includes(id))]);
    setAddText('');
  }

  /** Gêneros ou artistas que não podem entrar. "sertanejo, Anitta" vira um de cada. */
  function addAvoid(e: FormEvent) {
    e.preventDefault();
    const items = avoidText
      .split(/[,;]/)
      .map((n) => n.replace(/\s+/g, ' ').trim().slice(0, 60))
      .filter(Boolean);
    if (!items.length) return;
    setAvoid((list) =>
      [...list, ...items.filter((n) => !list.some((x) => x.toLowerCase() === n.toLowerCase()))].slice(0, LIMITS.avoid),
    );
    setAvoidText('');
  }

  /** Artistas digitados que têm que entrar. Aceita vários separados por vírgula. */
  function addMust(e: FormEvent) {
    e.preventDefault();
    const names = mustText
      .split(/[,;]/)
      .map((n) => n.replace(/\s+/g, ' ').trim().slice(0, 60))
      .filter(Boolean);
    if (!names.length) return;
    setMust((m) => [...m, ...names.filter((n) => !m.some((x) => x.toLowerCase() === n.toLowerCase()))].slice(0, LIMITS.must));
    setMustText('');
  }

  function toggleArtist(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-LIMITS.picked)));
  }

  async function create() {
    if (creating || !sel.length) return;
    setCreating(true);
    setNotice(null);
    const config = configKey;
    const snapshot = { genres: labels, artists: posterArtists, foot, base, theme: themeId };
    try {
      const res = await fetch('/api/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genres: sel,
          genreWeights: Object.fromEntries(sel.map((id) => [id, weightOf(gKey(id))])),
          picked: pickedArtists.map((a) => ({ ...a, weight: weightOf(aKey(a.name)) })),
          must: must.map((name) => ({ name, weight: weightOf(aKey(name)) })),
          taste,
          size: sizeId,
          vibe: vibeText,
          avoid,
          noExplicit,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.id !== 'string') {
        setNotice({
          text:
            data?.message ??
            'O servidor não respondeu como esperado. Confira no Spotify se a playlist foi criada antes de tentar de novo.',
          relogin: res.status === 401,
          url: safeUrl(data?.url),
        });
        return;
      }
      const rec: Created = {
        id: data.id,
        name: typeof data.name === 'string' ? data.name : 'Sua playlist',
        url: safeUrl(data.url),
        tracks: Number(data.tracks) || 0,
        minutes: Number(data.minutes) || 0,
        at: Date.now(),
        ...snapshot,
      };
      setLast(rec);
      setHistory((h) => [rec, ...h.filter((x) => x.id !== rec.id)].slice(0, 30));
      setStamp({ key: rec.id, config });
      uploadCover(rec);
      if (window.matchMedia('(max-width: 860px)').matches) {
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' }));
      }
    } catch {
      setNotice({
        text: 'A conexão caiu no meio. A playlist pode ter sido criada mesmo assim: confira no Spotify antes de tentar de novo.',
      });
    } finally {
      setCreating(false);
    }
  }

  /** Põe o cartaz quadrado como capa da playlist no Spotify. */
  async function uploadCover(rec: Created) {
    const themeOf = rec.theme ?? DEFAULT_THEME.id;
    setCover({ id: rec.id, theme: themeOf, status: 'sending' });
    try {
      const image = await renderCover({
        genres: rec.genres,
        artists: rec.artists ?? [],
        base: rec.base ?? '',
        foot: rec.foot ?? [],
        name: rec.name,
        theme: themeById(themeOf),
      });
      const res = await fetch('/api/playlist/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rec.id, image }),
      });
      const data = await res.json().catch(() => null);
      setCover(
        res.ok
          ? { id: rec.id, theme: themeOf, status: 'ok' }
          : {
              id: rec.id,
              theme: themeOf,
              status: 'error',
              message: data?.message ?? 'Não deu pra pôr a capa.',
              relogin: res.status === 401 || data?.error === 'forbidden',
            },
      );
    } catch {
      setCover({ id: rec.id, theme: themeOf, status: 'error', message: 'Não deu pra pôr a capa.' });
    }
  }

  const shareText = (rec: Created) =>
    rec.url ? `Ouve a minha playlist "${rec.name}", feita no Mistura: ${rec.url}` : `${rec.name}, feita no Mistura`;

  /** Copia o link sem esperar: o toque continua valendo pro compartilhamento que vem logo depois. */
  function copyQuietly(url: string | null): boolean {
    if (!url || !navigator.clipboard) return false;
    navigator.clipboard.writeText(url).catch(() => {});
    return true;
  }

  async function sharePoster() {
    if (!last || !shareFile) return;
    if (canShareFile) {
      const copied = copyQuietly(last.url);
      try {
        await navigator.share({ files: [shareFile], title: last.name, text: shareText(last) });
        if (copied) setShareMsg('O link também foi copiado: se o app não mostrar, é só colar na mensagem.');
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') setShareMsg('Não deu pra abrir o compartilhamento. Tente baixar a imagem.');
      }
      return;
    }
    // Computador sem compartilhamento de arquivos: baixa a imagem.
    const href = URL.createObjectURL(shareFile);
    const a = document.createElement('a');
    a.href = href;
    a.download = shareFile.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    setShareMsg(
      copyQuietly(last.url) ? 'Imagem baixada e link copiado. É só postar os dois juntos.' : 'Imagem baixada.',
    );
  }


  function removeFromList(id: string) {
    setHistory((h) => h.filter((x) => x.id !== id));
    if (last?.id === id) setLast(null);
  }

  function scrollToCreate() {
    goRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ---------- Status ---------- */
  let status: Notice = null;
  if (creating) status = { text: 'Montando sua playlist: buscando as músicas e criando no Spotify. Leva alguns segundos.' };
  else if (notice) status = notice;
  else if (!sel.length) status = { text: 'Escolha pelo menos um gênero pra criar.' };

  const allGenres = [
    ...GENRES.map((g) => ({ id: g.id, label: g.label })),
    ...custom.map((c) => ({ id: CUSTOM_PREFIX + c, label: c })),
  ];
  // Mostra os mais comuns, os já escolhidos e os digitados; o resto fica atrás do "+ N gêneros".
  const shownGenres = showAllGenres
    ? allGenres
    : allGenres.filter((g, i) => i < GENRES_SHOWN || sel.includes(g.id) || g.id.startsWith(CUSTOM_PREFIX));
  const hiddenGenres = allGenres.length - shownGenres.length;
  const activeExtras =
    Object.keys(weights).length + avoid.length + (noExplicit ? 1 : 0) + (vibeText ? 1 : 0);

  return (
    <>
      <header className="top">
        <div>
          <h1 className="brand">Mistura</h1>
          <p className="lede">Escolha os gêneros, ajuste o resto e o Mistura cria a playlist direto no seu Spotify.</p>
        </div>
        <form className="account" action="/api/auth/logout" method="post">
          {me.status !== 'loading' && (me.name || me.email) && (
            <span className="who">
              <span>Conectado como {me.name ?? me.email}</span>
              {me.name && me.email && <span className="email">{me.email}</span>}
            </span>
          )}
          <button type="submit" className="linkish">
            Sair
          </button>
        </form>
      </header>

      {me.status === 'ready' && me.summary && me.summary.artists.length > 0 && (
        <section className="summary" aria-labelledby="h-sum">
          <div className="sum-head">
            <h2 id="h-sum" className="sum-kicker">
              Seu som ultimamente
            </h2>
            <button type="button" className="linkish" aria-expanded={sumOpen} onClick={() => setSumOpen((o) => !o)}>
              {sumOpen ? 'Ver menos' : 'Ver mais'}
            </button>
          </div>
          <p className="sum-line">
            Você escuta muito <strong>{joinPt(me.summary.artists.slice(0, 3))}</strong>
            {me.summary.genres.length > 0 && (
              <>
                {' '}
                e puxa pra <strong>{joinPt(me.summary.genres.slice(0, 3).map((g) => g.label))}</strong>
              </>
            )}
            .
          </p>
          {sumOpen && (
            <div className="sum-more">
              <div>
                <h3>Seus artistas</h3>
                <ol className="rank">
                  {me.summary.artists.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ol>
              </div>
              {me.summary.tracks.length > 0 && (
                <div>
                  <h3>Mais tocadas nas últimas semanas</h3>
                  <ol className="rank">
                    {me.summary.tracks.map((t) => (
                      <li key={`${t.name}-${t.artist}`}>
                        <strong>{t.name}</strong>
                        <span className="rank-sub">{t.artist}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {me.summary.genres.length > 0 && (
                <div>
                  <h3>Seus gêneros</h3>
                  <ul className="bars">
                    {me.summary.genres.map((g) => (
                      <li key={g.id}>
                        <span className="bar-label">{g.label}</span>
                        <span className="bar-track" aria-hidden="true">
                          <span className="bar-fill" style={{ width: `${Math.max(4, g.share)}%` }} />
                        </span>
                        <span className="bar-value">{g.share}%</span>
                      </li>
                    ))}
                  </ul>
                  <p className="hint sub">Estimado pelos artistas que você mais ouve.</p>
                </div>
              )}
            </div>
          )}
          {me.summary.genres.length > 0 && (
            <button
              type="button"
              className="btn"
              onClick={() => setSel(me.summary!.genres.slice(0, 3).map((g) => g.id))}
              disabled={sel.join() === me.summary.genres.slice(0, 3).map((g) => g.id).join()}
            >
              Montar com esses gêneros
            </button>
          )}
        </section>
      )}

      <main className="layout">
        <div className="controls">
          <section className="block" aria-labelledby="h-genres">
            <h2 id="h-genres">
              <span className="step">1</span>Gêneros
              {sel.length > 0 && <span className="count">{sel.length === 1 ? '1 escolhido' : `${sel.length} escolhidos`}</span>}
            </h2>
            <p className="hint">Toque em quantos quiser. A ordem dos toques vira a ordem do cartaz.</p>
            <div className="chips" role="group" aria-labelledby="h-genres">
              {shownGenres.map((g) => {
                const order = sel.indexOf(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="chip"
                    aria-pressed={order >= 0}
                    onClick={() => toggleGenre(g.id)}
                  >
                    {order >= 0 && (
                      <span className="ord" aria-hidden="true">
                        {order + 1}
                      </span>
                    )}
                    {g.label}
                  </button>
                );
              })}
              {hiddenGenres > 0 && (
                <button type="button" className="chip more-chip" onClick={() => setAllGenres(true)}>
                  + {hiddenGenres} gêneros
                </button>
              )}
            </div>
            <form className="addrow" onSubmit={addGenre} autoComplete="off">
              <label className="sr" htmlFor="add-genre">
                Escrever os gêneros do seu jeito
              </label>
              <input
                id="add-genre"
                className="field"
                maxLength={200}
                placeholder="Ou escreva: pop com rock pesado, indie…"
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
                enterKeyHint="done"
              />
              <button className="ghost" type="submit" disabled={!addText.trim()}>
                Adicionar
              </button>
            </form>
          </section>

          <section className="block" aria-labelledby="h-artists">
            <h2 id="h-artists">
              <span className="step">2</span>Artistas que não podem faltar{' '}
              {posterArtists.length > 0 ? (
                <span className="count">
                  {posterArtists.length === 1 ? '1 escolhido' : `${posterArtists.length} escolhidos`}
                </span>
              ) : (
                <span className="opt">opcional</span>
              )}
            </h2>
            <p className="hint">Toque nos seus mais ouvidos ou escreva qualquer artista. Eles entram com várias músicas.</p>
            <div aria-live="polite">
              {me.status === 'loading' && <p className="hint">Buscando seus artistas mais ouvidos…</p>}
              {me.status === 'error' && (
                <>
                  <p className="msg">{me.message}</p>
                  {me.relogin ? (
                    <a className="ghost" href="/api/auth/login">
                      Entrar de novo
                    </a>
                  ) : (
                    <button type="button" className="ghost" onClick={loadMe}>
                      Tentar de novo
                    </button>
                  )}
                </>
              )}
              {me.status === 'ready' && (artists.length > 0 || must.length > 0) && (
                <div className="chips" role="group" aria-label="Artistas">
                  {artists.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="chip"
                      aria-pressed={picked.includes(a.id)}
                      onClick={() => toggleArtist(a.id)}
                    >
                      {picked.includes(a.id) && (
                        <span className="tick" aria-hidden="true">
                          ✓
                        </span>
                      )}
                      {a.name}
                    </button>
                  ))}
                  {must.map((m) => (
                    <button
                      key={`must-${m}`}
                      type="button"
                      className="chip"
                      aria-pressed="true"
                      aria-label={`Tirar ${m}`}
                      onClick={() => setMust((list) => list.filter((x) => x !== m))}
                    >
                      {m}
                      <span className="tick" aria-hidden="true">
                        ×
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <form className="addrow" onSubmit={addMust} autoComplete="off">
              <label className="sr" htmlFor="add-must">
                Outro artista que tem que ter
              </label>
              <input
                id="add-must"
                className="field"
                maxLength={300}
                placeholder="Outro artista: Linkin Park, Pitty…"
                value={mustText}
                onChange={(e) => setMustText(e.target.value)}
                enterKeyHint="done"
                disabled={must.length >= LIMITS.must}
              />
              <button className="ghost" type="submit" disabled={!mustText.trim() || must.length >= LIMITS.must}>
                Adicionar
              </button>
            </form>
          </section>

          <section className="block" aria-labelledby="h-taste">
            <h2 id="h-taste">
              <span className="step">3</span>Conhecidas ou novidades
            </h2>
            <div className="seg" role="group" aria-labelledby="h-taste">
              {TASTES.map((t) => (
                <button key={t.id} type="button" aria-pressed={t.id === taste} onClick={() => setTaste(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            <p className="hint after">{tasteObj.hint}</p>
          </section>

          <section className="block" aria-labelledby="h-dur">
            <h2 id="h-dur">
              <span className="step">4</span>Tamanho
            </h2>
            <div className="chips" role="group" aria-labelledby="h-dur">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="chip"
                  aria-pressed={s.id === sizeId}
                  onClick={() => setSizeId(s.id)}
                >
                  {s.id === sizeId && (
                    <span className="tick" aria-hidden="true">
                      ✓
                    </span>
                  )}
                  {s.label}
                </button>
              ))}
            </div>
            {count >= 100 && <p className="hint after">Playlists grandes levam uns 20 a 40 segundos pra montar.</p>}
          </section>

          <details className="block more" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
            <summary>
              <span className="more-title">
                Mais opções
                {activeExtras > 0 && <span className="count">{activeExtras === 1 ? '1 ativa' : `${activeExtras} ativas`}</span>}
              </span>
              <span className="hint more-sub">Quanto de cada, o que evitar e o nome da playlist</span>
            </summary>

            <div className="sub-block">
              <h3>Quanto de cada</h3>
              {dosage.length > 1 ? (
                <>
                  <p className="hint">“Muito” aparece umas quatro vezes mais que “Pouco”.</p>
                  <ul className="dose">
                    {dosage.map((d) => (
                      <li key={d.key}>
                        <span className="dose-name">
                          {d.label}
                          <span className="dose-kind">{d.kind}</span>
                        </span>
                        <span className="seg dose-seg" role="group" aria-label={`Quanto de ${d.label}`}>
                          {WEIGHTS.map(({ w, label }) => (
                            <button
                              key={w}
                              type="button"
                              aria-pressed={weightOf(d.key) === w}
                              onClick={() => setWeight(d.key, w)}
                            >
                              {label}
                            </button>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="hint">Escolha mais de um gênero ou artista pra ajustar quanto entra de cada.</p>
              )}
            </div>

            <div className="sub-block">
              <h3>Evitar</h3>
              <p className="hint">Gêneros ou artistas que não podem entrar de jeito nenhum.</p>
              {avoid.length > 0 && (
                <div className="chips must-chips" role="group" aria-label="Evitando">
                  {avoid.map((a) => {
                    const g = findGenre(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        className="chip avoid-chip"
                        aria-label={`Parar de evitar ${a}`}
                        onClick={() => setAvoid((list) => list.filter((x) => x !== a))}
                      >
                        <span className="tick" aria-hidden="true">
                          ✕
                        </span>
                        <span className="avoid-name">{g ? g.label : a}</span>
                        <span className="dose-kind">{g ? 'gênero' : 'artista'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <form className="addrow must-row" onSubmit={addAvoid} autoComplete="off">
                <label className="sr" htmlFor="add-avoid">
                  Gênero ou artista pra evitar
                </label>
                <input
                  id="add-avoid"
                  className="field"
                  maxLength={300}
                  placeholder="sertanejo, Anitta…"
                  value={avoidText}
                  onChange={(e) => setAvoidText(e.target.value)}
                  enterKeyHint="done"
                  disabled={avoid.length >= LIMITS.avoid}
                />
                <button className="ghost" type="submit" disabled={!avoidText.trim() || avoid.length >= LIMITS.avoid}>
                  Evitar
                </button>
              </form>
              <label className="check">
                <input type="checkbox" checked={noExplicit} onChange={(e) => setNoExplicit(e.target.checked)} />
                Evitar músicas explícitas (com palavrão)
              </label>
            </div>

            <div className="sub-block">
              <h3>
                <label htmlFor="vibe">Pra quê?</label>
              </h3>
              <p className="hint">Vira o nome da playlist.</p>
              <input
                id="vibe"
                className="field wide"
                maxLength={LIMITS.vibe}
                placeholder="festa, treino, viagem de carro…"
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                autoComplete="off"
                enterKeyHint="done"
              />
            </div>
          </details>
        </div>

        <aside className="stage" aria-label="Prévia e criação">
          <Poster
            genres={labels}
            artists={posterArtists}
            foot={foot}
            base={base}
            theme={theme}
            stampKey={stampKey}
          />
          <div className="themes" role="group" aria-label="Estilo do cartaz">
            {POSTER_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="swatch"
                aria-pressed={t.id === themeId}
                aria-label={t.label}
                title={t.label}
                onClick={() => {
                  setThemeId(t.id);
                  // A playlist que acabou de sair acompanha o estilo, pra compartilhar já com ele.
                  if (last) setLast({ ...last, theme: t.id });
                }}
                style={{ background: cssGradient(t), ['--sw-ink' as string]: t.ink }}
              />
            ))}
          </div>
          <p className="theme-name">Estilo do cartaz: {theme.label}</p>
          <button ref={goRef} className="go" type="button" onClick={create} disabled={creating || !sel.length}>
            {creating ? 'Criando…' : 'Criar playlist no Spotify'}
          </button>
          <p className="hint mix-hint">Cerca de {count} músicas. Fica privada no seu Spotify.</p>

          <div className="status" role="status" aria-live="polite">
            {status && (
              <>
                <p className="msg">{status.text}</p>
                {status.relogin && (
                  <a className="ghost" href="/api/auth/login">
                    Entrar de novo
                  </a>
                )}
                {status.url && (
                  <a className="ghost" href={status.url} target="_blank" rel="noopener noreferrer">
                    Abrir no Spotify
                  </a>
                )}
              </>
            )}
          </div>

          {last && (
            <div className="result" ref={resultRef} aria-live="polite">
              <h3>{last.name}</h3>
              <p className="meta">
                {last.tracks} músicas, cerca de {last.minutes} minutos
              </p>
              <div className="actions">
                {last.url && (
                  <a className="btn solid" href={last.url} target="_blank" rel="noopener noreferrer">
                    Abrir no Spotify
                  </a>
                )}
                <button type="button" className="btn" onClick={sharePoster} disabled={!shareFile}>
                  {shareFile ? 'Compartilhar' : 'Preparando…'}
                </button>
              </div>
              {cover?.id === last.id && (
                <div className="cover-row">
                  {cover.status === 'sending' && <p className="meta">Colocando o cartaz como capa…</p>}
                  {cover.status === 'ok' && (
                    <p className="meta">
                      ✓ Cartaz na capa da playlist. O Spotify pode levar alguns minutos pra mostrar.
                    </p>
                  )}
                  {cover.status === 'error' && (
                    <>
                      <p className="meta">{cover.message}</p>
                      {cover.relogin && (
                        <a className="linkish" href="/api/auth/login">
                          Entrar de novo
                        </a>
                      )}
                    </>
                  )}
                  {cover.status !== 'sending' && (last.theme ?? DEFAULT_THEME.id) !== cover.theme && (
                    <button type="button" className="btn" onClick={() => uploadCover(last)}>
                      Usar este estilo na capa
                    </button>
                  )}
                  {cover.status === 'error' && !cover.relogin && (last.theme ?? DEFAULT_THEME.id) === cover.theme && (
                    <button type="button" className="linkish" onClick={() => uploadCover(last)}>
                      Tentar de novo
                    </button>
                  )}
                </div>
              )}
              {cover?.id !== last.id && (
                <button type="button" className="linkish" onClick={() => uploadCover(last)}>
                  Pôr o cartaz como capa
                </button>
              )}
              {shareMsg && <p className="meta share-msg">{shareMsg}</p>}
            </div>
          )}
        </aside>

        {history.length > 0 && (
          <section className="block history" aria-labelledby="h-hist">
            <h2 id="h-hist">Criadas aqui</h2>
            <ul className="list">
              {history.map((rec) => (
                <li key={rec.id}>
                  <p className="name">{rec.name}</p>
                  <p className="meta">
                    {[joinPt(rec.genres), `${rec.tracks} músicas`, dateFmt.format(new Date(rec.at))].join(', ')}
                  </p>
                  <div className="actions">
                    {rec.url && (
                      <a className="btn" href={rec.url} target="_blank" rel="noopener noreferrer">
                        Abrir no Spotify
                      </a>
                    )}
                    {rec.id !== last?.id && (
                      <button type="button" className="btn" onClick={() => setLast(rec)}>
                        Ver cartaz
                      </button>
                    )}
                    <button type="button" className="linkish" onClick={() => removeFromList(rec.id)}>
                      Tirar da lista
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {!goVisible && (
        <div className="dock">
          <span className="dock-sum">
            {sel.length ? `${joinPt(labels.slice(0, 3))}${labels.length > 3 ? '…' : ''} · ~${count} músicas` : 'Escolha um gênero'}
          </span>
          <button type="button" className="dock-go" onClick={scrollToCreate} disabled={!sel.length}>
            Ver e criar
          </button>
        </div>
      )}
    </>
  );
}
