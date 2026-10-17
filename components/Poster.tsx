'use client';

import { useLayoutEffect, useRef } from 'react';
import { joinPt } from '@/lib/text';

type Props = {
  genres: string[];
  artists: string[];
  foot: string[];
  /** Muda a cada playlist criada; enquanto existir, o carimbo aparece. */
  stampKey?: string | null;
};

/** Cartaz estilo lambe-lambe: cada gênero ocupa a largura toda da linha. */
export default function Poster({ genres, artists, foot, stampKey }: Props) {
  const billRef = useRef<HTMLDivElement>(null);
  const big = genres.slice(0, 5);
  const rest = genres.slice(5);
  const ghost = big.length === 0;
  const lines = ghost ? ['Escolha', 'os gêneros'] : big;
  const signature = lines.join('|');

  useLayoutEffect(() => {
    const bill = billRef.current;
    if (!bill) return;
    const fit = () => {
      const width = bill.clientWidth;
      if (!width) return;
      bill.querySelectorAll<HTMLElement>('.bill-line').forEach((line, i) => {
        line.style.fontSize = '100px';
        const natural = line.getBoundingClientRect().width || 1;
        const cap = width * (i === 0 ? 0.42 : i === 1 ? 0.34 : 0.28);
        line.style.fontSize = `${Math.max(24, Math.min((100 * width) / natural, cap)).toFixed(1)}px`;
      });
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(bill);
    let alive = true;
    document.fonts?.ready.then(() => alive && fit()).catch(() => {});
    return () => {
      alive = false;
      observer?.disconnect();
    };
  }, [signature]);

  return (
    <div className="poster" aria-hidden="true">
      <p className="p-kicker">Sua playlist apresenta</p>
      <div className="bill" ref={billRef}>
        {lines.map((line, i) => (
          <span key={`${i}-${line}`} className={ghost ? 'bill-line ghosted' : 'bill-line'}>
            {line}
          </span>
        ))}
      </div>
      {rest.length > 0 && <p className="p-more">E mais {joinPt(rest)}</p>}
      <hr className="p-rule" />
      {artists.length > 0 ? (
        <>
          <p className="p-base has-names">Com base no que você ouve, sem faltar</p>
          <p className="p-artists">
            {artists.map((a) => (
              <span key={a}>{a}</span>
            ))}
          </p>
        </>
      ) : (
        <p className="p-base">Com base no que você ouve</p>
      )}
      <div className="p-foot">
        {foot.map((f) => (
          <span key={f}>{f}</span>
        ))}
      </div>
      {stampKey && (
        <div className="stamp" key={stampKey}>
          Pronta
        </div>
      )}
    </div>
  );
}
