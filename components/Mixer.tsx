'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Poster from './Poster';
import { CUSTOM_PREFIX, DEFAULT_GENRES, GENRES, genreLabel } from '@/lib/genres';
import { DURATIONS, FAMILIAR_SHARE, LIMITS, TASTES, estimateCount, type Taste } from '@/lib/options';
import { joinPt } from '@/lib/text';

type Artist = { id: string; name: string };
type Created = {
  id: string;
  name: string;
  url: string | null;
  genres: string[];
  tracks: number;
  minutes: number;
  at: number;
};
type MeState =
  | { status: 'loading' }
  | { status: 'ready'; name: string | null; artists: Artist[] }
  | { status: 'error'; message: string; relogin: boolean };
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

export default function Mixer() {
  const [sel, setSel] = useState<string[]>(DEFAULT_GENRES);
  const [custom, setCustom] = useState<string[]>([]);
  const [taste, setTaste] = useState<Taste>('equilibrado');
  const [duration, setDuration] = useState(0);
  const [vibe, setVibe] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [addText, setAddText] = useState('');
  const [me, setMe] = useState<MeState>({ status: 'loading' });
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [last, setLast] = useState<Created | null>(null);
  const [stamp, setStamp] = useState<{ key: string; config: string } | null>(null);
  const [history, setHistory] = useState<Created[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

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
      if (DURATIONS.some((d) => d.min === p.duration)) setDuration(p.duration as number);
      if (typeof p.vibe === 'string') setVibe(p.vibe.slice(0, LIMITS.vibe));
    }
    const h = readJSON(KEY_HIST);
    if (Array.isArray(h)) setHistory(h.filter(isCreated).slice(0, 30));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeJSON(KEY_PREFS, { sel, custom, taste, duration, vibe });
  }, [hydrated, sel, custom, taste, duration, vibe]);

  useEffect(() => {
    if (hydrated) writeJSON(KEY_HIST, history.slice(0, 30));
  }, [hydrated, history]);

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
        });
        return;
      }
      setMe({ status: 'ready', name: data?.name ?? null, artists: Array.isArray(data?.artists) ? data.artists : [] });
    } catch {
      setMe({ status: 'error', message: 'Não deu pra falar com o servidor. Confira sua conexão.', relogin: false });
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
  const durObj = DURATIONS.find((d) => d.min === duration) ?? DURATIONS[0];
  const vibeText = vibe.trim();
  const vibeLabel = vibeText ? (/^(pra|para|pro)\s/i.test(vibeText) ? vibeText : `Pra ${vibeText}`) : '';
  const foot = [durObj.poster, tasteObj.poster, vibeLabel].filter(Boolean);
  const configKey = JSON.stringify([sel, picked, taste, duration, vibeText]);
  const stampKey = stamp && stamp.config === configKey ? stamp.key : null;

  const count = estimateCount(duration);
  const fromYou = Math.round(count * FAMILIAR_SHARE[taste]);

  /* ---------- Ações ---------- */
  function toggleGenre(id: string) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function addGenre(e: FormEvent) {
    e.preventDefault();
    const label = addText.replace(/\s+/g, ' ').trim().slice(0, LIMITS.label);
    if (!label) return;
    const base = GENRES.find((g) => g.label.toLowerCase() === label.toLowerCase());
    const existing = custom.find((c) => c.toLowerCase() === label.toLowerCase());
    const id = base ? base.id : CUSTOM_PREFIX + (existing ?? label);
    if (!base && !existing) setCustom((c) => [...c, label].slice(-20));
    setSel((s) => (s.includes(id) ? s : [...s, id]));
    setAddText('');
  }

  function toggleArtist(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-LIMITS.picked)));
  }

  async function create() {
    if (creating || !sel.length) return;
    setCreating(true);
    setNotice(null);
    const config = configKey;
    const genresAtCreation = labels;
    try {
      const res = await fetch('/api/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genres: sel, picked: pickedArtists, taste, duration, vibe: vibeText }),
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
        genres: genresAtCreation,
        tracks: Number(data.tracks) || 0,
        minutes: Number(data.minutes) || 0,
        at: Date.now(),
      };
      setLast(rec);
      setHistory((h) => [rec, ...h.filter((x) => x.id !== rec.id)].slice(0, 30));
      setStamp({ key: rec.id, config });
      if (window.matchMedia('(max-width: 860px)').matches) {
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' }));
      }
    } catch {
      setNotice({
        text: 'A conexão caiu no meio. A playlist pode ter sido criada mesmo assim: confira no Spotify antes de tentar de novo.',
      });
    } finally {
      setCreating(false);
    }
  }

  function removeFromList(id: string) {
    setHistory((h) => h.filter((x) => x.id !== id));
    if (last?.id === id) setLast(null);
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

  return (
    <>
      <header className="top">
        <div>
          <h1 className="brand">Mistura</h1>
          <p className="lede">Monte uma playlist no Spotify a partir do que você já ouve, com os gêneros que quiser.</p>
        </div>
        <form className="account" action="/api/auth/logout" method="post">
          {me.status === 'ready' && me.name && <span>Conectado como {me.name}</span>}
          <button type="submit" className="linkish">
            Sair
          </button>
        </form>
      </header>

      <main className="layout">
        <div className="controls">
          <section className="block" aria-labelledby="h-genres">
            <h2 id="h-genres">O que entra na mistura</h2>
            <p className="hint">Escolha quantos quiser. A ordem dos toques vira a ordem do cartaz.</p>
            <div className="chips" role="group" aria-labelledby="h-genres">
              {allGenres.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="chip"
                  aria-pressed={sel.includes(g.id)}
                  onClick={() => toggleGenre(g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <form className="addrow" onSubmit={addGenre} autoComplete="off">
              <label className="sr" htmlFor="add-genre">
                Outro gênero
              </label>
              <input
                id="add-genre"
                className="field"
                maxLength={LIMITS.label}
                placeholder="Outro gênero, tipo piseiro"
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
              />
              <button className="ghost" type="submit">
                Adicionar
              </button>
            </form>
          </section>

          <section className="block" aria-labelledby="h-artists">
            <h2 id="h-artists">Seu som como base</h2>
            <p className="hint">
              Toque nos artistas que não podem faltar. Mesmo sem escolher nenhum, a playlist parte do que você mais ouve e
              do que tocou por último.
            </p>
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
              {me.status === 'ready' && artists.length === 0 && (
                <p className="msg">O Spotify ainda não tem seus mais ouvidos. A playlist usa o que tocou por último.</p>
              )}
              {me.status === 'ready' && artists.length > 0 && (
                <div className="chips" role="group" aria-label="Seus artistas mais ouvidos">
                  {artists.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="chip"
                      aria-pressed={picked.includes(a.id)}
                      onClick={() => toggleArtist(a.id)}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="block" aria-labelledby="h-taste">
            <h2 id="h-taste">Conhecidas ou novidades</h2>
            <div className="seg" role="group" aria-labelledby="h-taste">
              {TASTES.map((t) => (
                <button key={t.id} type="button" aria-pressed={t.id === taste} onClick={() => setTaste(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          <section className="block" aria-labelledby="h-dur">
            <h2 id="h-dur">Duração</h2>
            <div className="seg" role="group" aria-labelledby="h-dur">
              {DURATIONS.map((d) => (
                <button key={d.min} type="button" aria-pressed={d.min === duration} onClick={() => setDuration(d.min)}>
                  {d.label}
                </button>
              ))}
            </div>
          </section>

          <section className="block" aria-labelledby="h-vibe">
            <h2 id="h-vibe">Pra quê?</h2>
            <p className="hint">Opcional. Vira o nome da playlist.</p>
            <input
              className="field wide"
              aria-labelledby="h-vibe"
              maxLength={LIMITS.vibe}
              placeholder="festa, treino, viagem de carro…"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              autoComplete="off"
            />
          </section>

          {history.length > 0 && (
            <section className="block" aria-labelledby="h-hist">
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
                      <button type="button" className="linkish" onClick={() => removeFromList(rec.id)}>
                        Tirar da lista
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="stage" aria-label="Prévia e criação">
          <Poster genres={labels} artists={pickedArtists.map((a) => a.name)} foot={foot} stampKey={stampKey} />
          <button className="go" type="button" onClick={create} disabled={creating || !sel.length}>
            {creating ? 'Criando…' : 'Criar playlist no Spotify'}
          </button>
          <p className="hint mix-hint">
            Cerca de {count} músicas: umas {fromYou} do seu som e {count - fromYou} dos gêneros.
          </p>

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
              {last.url && (
                <a className="btn solid" href={last.url} target="_blank" rel="noopener noreferrer">
                  Abrir no Spotify
                </a>
              )}
            </div>
          )}
        </aside>
      </main>
    </>
  );
}
