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
  deviceHeight,
  resolveColor,
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
  const { w, h, bg, bg2, bgAngle } = doc.canvas;
  if (bg2) {
    const rad = ((bgAngle - 90) * Math.PI) / 180;
    const cx = w / 2, cy = h / 2;
    const len = Math.max(w, h);
    const dx = (Math.cos(rad) * len) / 2, dy = (Math.sin(rad) * len) / 2;
    const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    grad.addColorStop(0, bg);
    grad.addColorStop(1, bg2);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = bg;
  }
  ctx.fillRect(0, 0, w, h);
}

async function drawDevice(ctx: CanvasRenderingContext2D, doc: MockupDoc, dev: MockupDeviceSlot): Promise<void> {
  const spec = DEVICE_FRAMES[dev.variant];
  const w = dev.w;
  const h = deviceHeight(dev);
  const cx = dev.x + w / 2;
  const cy = dev.y + h / 2;

  ctx.save();
  // Roter rundt enhetens senter.
  ctx.translate(cx, cy);
  ctx.rotate((dev.rotation * Math.PI) / 180);
  ctx.translate(-cx, -cy);

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
  return canvas;
}

/** Rasteriser + returner PNG-data-URL (full oppløsning som standard). */
export async function rasterizeToPngDataUrl(doc: MockupDoc, scale = 1): Promise<string> {
  const canvas = await rasterizeMockup(doc, scale);
  return canvas.toDataURL('image/png');
}
