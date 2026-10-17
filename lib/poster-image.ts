/**
 * Desenha o cartaz "Sua playlist apresenta" num PNG pra compartilhar.
 * Roda só no navegador; usa as mesmas fontes que a página já carregou.
 */
export type PosterData = {
  genres: string[];
  artists: string[];
  base: string;
  foot: string[];
  name: string;
  url?: string | null;
};

const W = 1080;
const MIN_H = 1350; // 4:5, o formato que o Instagram mostra inteiro no feed
const PAD = 64;

function fontOf(selector: string, fallback: string): string {
  const el = document.querySelector(selector);
  return (el && getComputedStyle(el).fontFamily) || fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export async function renderPoster(d: PosterData): Promise<Blob> {
  const display = fontOf('.bill-line', 'Impact, sans-serif');
  const text = fontOf('body', 'system-ui, sans-serif');
  await Promise.all([
    document.fonts?.load(`900 100px ${display}`),
    document.fonts?.load(`800 100px ${display}`),
    document.fonts?.load(`700 40px ${text}`),
  ]).catch(() => {});

  const inner = W - PAD * 2;
  const measure = document.createElement('canvas').getContext('2d')!;
  const big = d.genres.slice(0, 5).map((g) => g.toUpperCase());
  const rest = d.genres.slice(5);

  // Mede tudo antes, pra saber a altura final.
  const lines = big.map((line, i) => {
    measure.font = `900 100px ${display}`;
    const natural = measure.measureText(line).width || 1;
    const cap = inner * (i === 0 ? 0.42 : i === 1 ? 0.34 : 0.28);
    return { line, size: Math.max(60, Math.min((100 * inner) / natural, cap)) };
  });
  measure.font = `800 60px ${display}`;
  const restLines = rest.length ? wrap(measure, `E MAIS ${rest.join(', ').toUpperCase()}`, inner) : [];
  const artistLines = d.artists.length ? wrap(measure, d.artists.join(' · ').toUpperCase(), inner) : [];
  measure.font = `800 50px ${display}`;
  const footLines = wrap(measure, d.foot.join('   ·   ').toUpperCase(), inner);
  measure.font = `700 44px ${text}`;
  const nameLines = wrap(measure, d.name, inner).slice(0, 2);

  const top = PAD + 44 + 28;
  const billH = lines.reduce((s, l) => s + l.size * 0.88, 0);
  const restH = restLines.length * 62 + (restLines.length ? 20 : 0);
  const bodyH = 40 + 6 + 36 + 40 + artistLines.length * 62 + 40 + nameLines.length * 54;
  // O link vai desenhado no cartaz: muitos apps descartam o texto quando a mensagem tem imagem.
  const link = d.url ? d.url.replace(/^https:\/\//, '').replace(/\?.*$/, '') : '';
  const linkH = link ? 56 : 0;
  const footH = 40 + footLines.length * 56 + 40 + linkH;
  const H = Math.max(MIN_H, Math.ceil(top + billH + restH + bodyH + PAD + footH));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#ffe600');
  bg.addColorStop(0.14, '#ffe600');
  bg.addColorStop(0.5, '#ff8a00');
  bg.addColorStop(0.86, '#ff2e97');
  bg.addColorStop(1, '#ff2e97');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Granulado leve, como o do cartaz na página.
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  for (let i = 0; i < 9000; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);

  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 40px ${text}`;
  ctx.fillText('Sua playlist apresenta', PAD, PAD + 40);

  let y = top;
  for (const { line, size } of lines) {
    ctx.font = `900 ${size}px ${display}`;
    y += size * 0.8;
    ctx.fillText(line, PAD, y);
    y += size * 0.08;
  }
  ctx.font = `800 60px ${display}`;
  if (restLines.length) y += 20;
  for (const l of restLines) {
    y += 62;
    ctx.fillText(l, PAD, y - 10);
  }

  y += 40;
  ctx.fillRect(PAD, y, inner, 6);
  y += 6 + 36;
  ctx.font = `600 34px ${text}`;
  ctx.fillText(d.base, PAD, y);
  y += 10;
  ctx.font = `800 60px ${display}`;
  for (const l of artistLines) {
    y += 62;
    ctx.fillText(l, PAD, y);
  }

  y += 70;
  ctx.font = `700 44px ${text}`;
  for (const l of nameLines) {
    ctx.fillText(l, PAD, y);
    y += 54;
  }

  const footY = H - footH;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, footY, W, footH);
  ctx.fillStyle = '#ffe600';
  ctx.font = `800 50px ${display}`;
  footLines.forEach((l, i) => ctx.fillText(l, PAD, footY + 40 + 44 + i * 56));
  if (link) {
    ctx.fillStyle = '#fff';
    let size = 30;
    do ctx.font = `600 ${size--}px ${text}`;
    while (size > 16 && ctx.measureText(`Ouça: ${link}`).width > inner);
    ctx.fillText(`Ouça: ${link}`, PAD, footY + 40 + footLines.length * 56 + 34);
  }
  ctx.fillStyle = '#000';
  ctx.font = `700 28px ${text}`;
  ctx.textAlign = 'right';
  ctx.fillText('Feita no Mistura', W - PAD, footY - 24);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'),
  );
}
