/**
 * mockupRaster.ts — ren canvas-kompositor for MockupDoc.
 *
 * Én kodesti tegner BÅDE live-preview og PNG-eksport (WYSIWYG-garanti): gitt
 * et MockupDoc og en skala, komponerer den bakgrunn → enheter (ekte ramme-PNG
 * + skjermbilde cover-klippet til det avrundede skjerm-hullet + kontaktskygge)
 * → redigerbar tekst. Ingen avhengigheter utover DEVICE_FRAMES (gjenbrukt fra
 * demo-studio) og nettleserens Canvas 2D.
 *
 * Auto-crop er gratis: cover-fit gjøres ved tegning (drawImage med kilde-crop),
 * så vilkårlige skjermbilder fyller skjermen uten forhåndsprosessering.
 */

import { DEVICE_FRAMES } from '../demo-studio/deviceFrames';
import {
  type MockupDoc,
  type MockupDeviceSlot,
  type MockupTextSlot,
  type MockupCanvasSpec,
  deviceHeight,
  resolveColor,
  resolveBaseBg,
  mixHex,
  hexToRgb,
} from './mockupStudioModel';

// ── Bilde-lasting (cache per src) ───────────────────────────────────────────

const _imgCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = _imgCache.get(src);
  if (cached) return cached;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    // Bundlede ramme-assets + data-URL-skjermbilder er begge samme-opphav-trygge.
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Kunne ikke laste bilde: ${src.slice(0, 48)}`));
    img.src = src;
  });
  _imgCache.set(src, p);
  return p;
}

// ── Hjelpere ────────────────────────────────────────────────────────────────

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  // roundRect finnes i moderne WebView (Safari 16+/Chromium). Fallback for eldre.
  if (typeof (ctx as unknown as { roundRect?: unknown }).roundRect === 'function') {
    ctx.beginPath();
    (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
      .roundRect(x, y, w, h, rr);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Tegn `img` cover-fit (fyll + midtstill-crop) inn i mål-rektangelet. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number): void {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const targetAspect = dw / dh;
  const imgAspect = iw / ih;
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (imgAspect > targetAspect) {
    // Bildet er bredere → beskjær sidene.
    sw = Math.round(ih * targetAspect);
    sx = Math.round((iw - sw) / 2);
  } else {
    // Bildet er høyere → beskjær topp/bunn.
    sh = Math.round(iw / targetAspect);
    sy = Math.round((ih - sh) / 2);
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function fillBackground(ctx: CanvasRenderingContext2D, doc: MockupDoc): void {
  const c = doc.canvas;
  const w = c.w, h = c.h;
  const base = resolveBaseBg(c);
  const light = c.background === 'light';

  if (c.bgStyle === 'clean') {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (c.bgStyle === 'gradient') {
    const second = mixHex(base, c.accent, light ? 0.1 : 0.16);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, base);
    grad.addColorStop(1, second);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  // atmospheric: basisflate + to radielle accent-glød (accent1 + accent2).
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const glow = (cx: number, cy: number, r: number, hex: string, alpha: number) => {
    const { r: rr, g: gg, b: bb } = hexToRgb(hex);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${rr},${gg},${bb},${alpha})`);
    g.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  glow(w * 0.75, h * 0.14, w * 0.5, c.accent, light ? 0.18 : 0.28);
  glow(w * 0.18, h * 0.9, w * 0.45, c.accent2, light ? 0.13 : 0.22);
}

/** Tegn logo-slot (bevarer bilde-forhold ut fra bredden). */
async function drawLogo(ctx: CanvasRenderingContext2D, canvas: MockupCanvasSpec): Promise<void> {
  const L = canvas.logo;
  if (!L?.image) return;
  try {
    const img = await loadImage(L.image);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    ctx.drawImage(img, L.x, L.y, L.w, L.w * (ih / iw));
  } catch {
    /* logo-lasting feilet — hopp over */
  }
}

async function drawDevice(ctx: CanvasRenderingContext2D, doc: MockupDoc, dev: MockupDeviceSlot): Promise<void> {
  const w = dev.w;
  const h = deviceHeight(dev);
  const cx = dev.x + w / 2;
  const cy = dev.y + h / 2;

  ctx.save();
  // Roter rundt enhetens senter.
  ctx.translate(cx, cy);
  ctx.rotate((dev.rotation * Math.PI) / 180);
  ctx.translate(-cx, -cy);

  // Apple Watch tegnes syntetisk (ingen PNG-ramme, lisensfri).
  if (dev.variant === 'watch') {
    await drawWatch(ctx, doc, dev, w, h);
    ctx.restore();
    return;
  }

  const spec = DEVICE_FRAMES[dev.variant];
  // Kontaktskygge følger rammens alfa (device-formet, ikke en boks).
  const frame = await loadImage(spec.src);
  if (dev.shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.34)';
    ctx.shadowBlur = w * 0.05;
    ctx.shadowOffsetY = w * 0.03;
    ctx.drawImage(frame, dev.x, dev.y, w, h);
    ctx.restore();
  }

  // Skjermbilde inn i skjerm-hullet FØR rammen? Nei — rammens skjermflate er
  // opak (svart), så vi tegner rammen først, deretter skjermbildet klippet til
  // det avrundede skjerm-rektangelet OVER (samme lagdeling som FramedDevice).
  ctx.drawImage(frame, dev.x, dev.y, w, h);

  const sx = dev.x + spec.screen.x * w;
  const sy = dev.y + spec.screen.y * h;
  const sw = spec.screen.w * w;
  const sh = spec.screen.h * h;
  const r = spec.radius * w;

  ctx.save();
  roundRectPath(ctx, sx, sy, sw, sh, r);
  ctx.clip();
  if (dev.image) {
    try {
      const shot = await loadImage(dev.image);
      drawCover(ctx, shot, sx, sy, sw, sh);
    } catch {
      drawScreenPlaceholder(ctx, doc, sx, sy, sw, sh);
    }
  } else {
    drawScreenPlaceholder(ctx, doc, sx, sy, sw, sh);
  }
  ctx.restore();

  ctx.restore();
}

/**
 * Syntetisk Apple Watch: titan-kasse (avrundet firkant) + Digital Crown +
 * bånd-stubber + skjerm med stort hjørne-radius. Kode-tegnet → ingen ekstern
 * ramme-PNG og ingen lisens-spørsmål. Kalles fra drawDevice (allerede rotert).
 */
async function drawWatch(ctx: CanvasRenderingContext2D, doc: MockupDoc, dev: MockupDeviceSlot, w: number, h: number): Promise<void> {
  const x = dev.x, y = dev.y;
  const bodyR = Math.min(w, h) * 0.30;

  // Bånd-stubber bak kassen (over + under).
  const bandW = w * 0.6;
  const bandX = x + (w - bandW) / 2;
  ctx.save();
  ctx.fillStyle = '#3b3e46';
  roundRectPath(ctx, bandX, y - h * 0.05, bandW, h * 0.22, bandW * 0.16); ctx.fill();
  roundRectPath(ctx, bandX, y + h * 0.83, bandW, h * 0.22, bandW * 0.16); ctx.fill();
  ctx.restore();

  // Digital Crown (høyre side, bak kassen).
  ctx.save();
  ctx.fillStyle = '#50535b';
  roundRectPath(ctx, x + w - w * 0.015, y + h * 0.36, w * 0.06, h * 0.15, w * 0.025); ctx.fill();
  ctx.restore();

  // Titan-kasse med kontaktskygge.
  ctx.save();
  if (dev.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.34)';
    ctx.shadowBlur = w * 0.07;
    ctx.shadowOffsetY = w * 0.03;
  }
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#2c2f35');
  grad.addColorStop(1, '#141519');
  ctx.fillStyle = grad;
  roundRectPath(ctx, x, y, w, h, bodyR); ctx.fill();
  ctx.restore();

  // Skjerm (stort radius), skjermbilde cover-klippet inn.
  const inset = w * 0.12;
  const sx = x + inset, sy = y + inset, sw = w - inset * 2, sh = h - inset * 2;
  const sr = Math.min(sw, sh) * 0.28;
  ctx.save();
  roundRectPath(ctx, sx, sy, sw, sh, sr);
  ctx.clip();
  if (dev.image) {
    try {
      const shot = await loadImage(dev.image);
      drawCover(ctx, shot, sx, sy, sw, sh);
    } catch {
      drawScreenPlaceholder(ctx, doc, sx, sy, sw, sh);
    }
  } else {
    drawScreenPlaceholder(ctx, doc, sx, sy, sw, sh);
  }
  ctx.restore();
}

/** Tom skjerm: subtil accent-tonet flate + hint-tekst. */
function drawScreenPlaceholder(ctx: CanvasRenderingContext2D, doc: MockupDoc, x: number, y: number, w: number, h: number): void {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(255,255,255,0.02)');
  ctx.fillStyle = '#0c0e16';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = doc.canvas.accent + 'cc';
  ctx.font = `600 ${Math.max(14, Math.round(w * 0.05))}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Last opp skjermbilde', x + w / 2, y + h / 2, w * 0.86);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  // Respekter eksplisitte linjeskift, ombrekk hver på ord.
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) { out.push(''); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = line + ' ' + words[i];
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}

function drawText(ctx: CanvasRenderingContext2D, doc: MockupDoc, t: MockupTextSlot): void {
  const raw = t.uppercase ? t.text.toUpperCase() : t.text;
  ctx.save();
  ctx.fillStyle = resolveColor(t.color, doc.canvas);
  ctx.font = `${t.weight} ${t.size}px -apple-system, system-ui, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign = t.align;
  // letterSpacing støttes i moderne WebView; harmløst hvis ukjent.
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${t.tracking}px`;
  } catch { /* noop */ }
  const anchorX = t.align === 'center' ? t.x + t.w / 2 : t.align === 'right' ? t.x + t.w : t.x;
  const lines = wrapLines(ctx, raw, t.w);
  const lh = t.size * t.lineHeight;
  lines.forEach((line, i) => {
    ctx.fillText(line, anchorX, t.y + i * lh);
  });
  ctx.restore();
}

/** Målt høyde til en tekstblokk (for utvalgs-overlay / hit-testing). */
export function measureTextHeight(t: MockupTextSlot): number {
  // Grovt anslag uten canvas: antall harde linjer × linjehøyde er nedre grense;
  // preview-overlayet bruker dette bare til klikkflate, så et rundt tall holder.
  const hardLines = Math.max(1, t.text.split('\n').length);
  return hardLines * t.size * t.lineHeight;
}

/**
 * Rasteriser et MockupDoc til et canvas. `scale` multipliserer base-oppløsningen
 * (1 = full eksport-oppløsning; < 1 for rask preview). Async fordi ramme-PNG-er
 * og skjermbilder lastes on-demand.
 */
export async function rasterizeMockup(doc: MockupDoc, scale = 1): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(doc.canvas.w * scale);
  canvas.height = Math.round(doc.canvas.h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);

  fillBackground(ctx, doc);
  // Enheter i dokument-rekkefølge (senere = øverst).
  for (const dev of doc.devices) {
    await drawDevice(ctx, doc, dev);
  }
  for (const t of doc.texts) {
    drawText(ctx, doc, t);
  }
  await drawLogo(ctx, doc.canvas);
  return canvas;
}

/** Rasteriser + returner PNG-data-URL (full oppløsning som standard). */
export async function rasterizeToPngDataUrl(doc: MockupDoc, scale = 1): Promise<string> {
  const canvas = await rasterizeMockup(doc, scale);
  return canvas.toDataURL('image/png');
}

function newLayerCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

const VARIANT_LABEL: Record<string, string> = {
  macbook: 'MacBook', ipad: 'iPad', ipad_landscape: 'iPad (liggende)', iphone: 'iPhone', watch: 'Apple Watch',
};

/**
 * Rasteriser dokumentet til SEPARATE, gjennomsiktige lag i full oppløsning —
 * ett for bakgrunnen, ett per enhet, ett per tekst — i tegnerekkefølge (nederst
 * først). Brukes av PSD-eksporten så resultatet er redigerbart lag-for-lag i
 * Photoshop (flytt/skjul/omorganiser enheter og tekst).
 */
export async function rasterizeLayers(doc: MockupDoc): Promise<{ name: string; canvas: HTMLCanvasElement }[]> {
  const w = doc.canvas.w, h = doc.canvas.h;
  const out: { name: string; canvas: HTMLCanvasElement }[] = [];

  const bg = newLayerCanvas(w, h);
  if (bg.ctx) fillBackground(bg.ctx, doc);
  out.push({ name: 'Bakgrunn', canvas: bg.canvas });

  for (const dev of doc.devices) {
    const c = newLayerCanvas(w, h);
    if (c.ctx) await drawDevice(c.ctx, doc, dev);
    out.push({ name: VARIANT_LABEL[dev.variant] ?? dev.variant, canvas: c.canvas });
  }
  for (const t of doc.texts) {
    const c = newLayerCanvas(w, h);
    if (c.ctx) drawText(c.ctx, doc, t);
    const label = (t.text || 'Tekst').replace(/\s+/g, ' ').trim().slice(0, 24) || 'Tekst';
    out.push({ name: label, canvas: c.canvas });
  }

  if (doc.canvas.logo?.image) {
    const c = newLayerCanvas(w, h);
    if (c.ctx) await drawLogo(c.ctx, doc.canvas);
    out.push({ name: 'Logo', canvas: c.canvas });
  }
  return out;
}
