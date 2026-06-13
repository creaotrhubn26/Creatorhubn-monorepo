/**
 * demoBranding — render intro/outro-kort + browser-ramme som PNG (canvas), for
 * den autonome videoen. Tekst tegnes i canvas (ikke ffmpeg drawtext, som mangler
 * i mange ffmpeg-bygg). Returnerer base64 PNG (uten dataURL-prefiks der nyttig).
 */

const W = 1280, H = 800;

function canvas(): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas-kontekst utilgjengelig');
  return { c, ctx };
}

/** Enkel relativ luminans → velg lys/mørk tekst mot en bakgrunn. */
function isDark(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

const png = (c: HTMLCanvasElement) => c.toDataURL('image/png');

/** Intro: branded bakgrunn + produktnavn + tagline. */
export function renderIntroCard(opts: { brandName: string; tagline?: string; color?: string }): string {
  const { c, ctx } = canvas();
  const bg = opts.color && /^#?[0-9a-f]{6}$/i.test(opts.color.replace('#', '')) ? (opts.color.startsWith('#') ? opts.color : '#' + opts.color) : '#1d1b19';
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const fg = isDark(bg) ? '#ffffff' : '#1d1b19';
  const sub = isDark(bg) ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.6)';
  const accent = '#ef8a5d';
  // accent-strek
  ctx.fillStyle = accent; ctx.fillRect(W / 2 - 34, H / 2 - 130, 68, 5);
  ctx.textAlign = 'center';
  ctx.fillStyle = fg; ctx.font = '700 88px Helvetica, Arial, sans-serif';
  ctx.fillText(opts.brandName.slice(0, 28), W / 2, H / 2 - 30);
  if (opts.tagline) {
    ctx.fillStyle = sub; ctx.font = '400 34px Helvetica, Arial, sans-serif';
    wrap(ctx, opts.tagline, 980).forEach((ln, i) => ctx.fillText(ln, W / 2, H / 2 + 40 + i * 46));
  }
  return png(c);
}

/** Outro: «Prøv selv» + produktnavn + domene. */
export function renderOutroCard(opts: { brandName: string; url?: string; color?: string }): string {
  const { c, ctx } = canvas();
  const bg = opts.color && /^#?[0-9a-f]{6}$/i.test(opts.color.replace('#', '')) ? (opts.color.startsWith('#') ? opts.color : '#' + opts.color) : '#1d1b19';
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const fg = isDark(bg) ? '#ffffff' : '#1d1b19';
  const sub = isDark(bg) ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.6)';
  ctx.textAlign = 'center';
  ctx.fillStyle = sub; ctx.font = '500 30px Helvetica, Arial, sans-serif';
  ctx.fillText('Klar til å prøve selv?', W / 2, H / 2 - 70);
  ctx.fillStyle = fg; ctx.font = '700 76px Helvetica, Arial, sans-serif';
  ctx.fillText(opts.brandName.slice(0, 28), W / 2, H / 2 + 10);
  let host = opts.url || '';
  try { host = new URL(opts.url || '').host; } catch { /* */ }
  if (host) { ctx.fillStyle = '#ef8a5d'; ctx.font = '600 34px Helvetica, Arial, sans-serif'; ctx.fillText(host, W / 2, H / 2 + 90); }
  return png(c);
}

/** Browser-ramme (PNG som video overlayes inni). Returnerer png + video-rekt. */
export function renderBrowserFrame(opts: { url?: string; bg?: string }): { png: string; rect: { x: number; y: number; w: number; h: number } } {
  const { c, ctx } = canvas();
  const pageBg = opts.bg || '#e9e5dd';
  ctx.fillStyle = pageBg; ctx.fillRect(0, 0, W, H);
  // vindu
  const winX = 60, winY = 22, winW = 1160, winH = 764;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, winX, winY, winW, winH, 16); ctx.fill();
  // tittellinje
  ctx.fillStyle = '#f1ece4';
  roundRect(ctx, winX, winY, winW, 48, 16); ctx.fill();
  ctx.fillRect(winX, winY + 24, winW, 24); // firkant-bunn på tittellinja
  // traffic-lights
  const dots = ['#ff5f56', '#ffbd2e', '#27c93f'];
  dots.forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(winX + 26 + i * 22, winY + 24, 6, 0, Math.PI * 2); ctx.fill(); });
  // domene-pille
  let host = '';
  try { host = new URL(opts.url || '').host; } catch { host = opts.url || ''; }
  if (host) {
    ctx.fillStyle = '#ffffff'; roundRect(ctx, winX + 120, winY + 11, 360, 26, 13); ctx.fill();
    ctx.fillStyle = '#9a9186'; ctx.font = '400 18px Helvetica, Arial, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('🔒 ' + host.slice(0, 40), winX + 134, winY + 29);
  }
  // video-rekt (under tittellinja, med litt padding)
  const rect = { x: 80, y: 92, w: 1120, h: 672 };
  return { png: png(c), rect };
}
