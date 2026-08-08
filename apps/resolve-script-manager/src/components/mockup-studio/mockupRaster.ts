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
import { parseMermaidMindmap } from './mockupMindmap';
import { revealFor, type Reveal } from './mockupMotion';
import { matrixFor, tiltsLeft } from './mockupPerspective';
import { render3dDevice, webglAvailable } from './mockup3d/mockup3d';
import { cacheKey, is3dVariant } from './mockup3d/deviceGeometry';
import { sceneById } from './mockupScenes';
import { drawImageQuad, type Quad } from './mockupSceneWarp';
import {
  type MockupDoc,
  type MockupDeviceSlot,
  type MockupTextSlot,
  type MockupCanvasSpec,
  type MockupAnnotation,
  isDark,
  deviceHeight,
  resolveColor,
  fontFamilyFor,
  resolveBaseBg,
  mixHex,
  hexToRgb,
} from './mockupStudioModel';

// ── Bilde-lasting (cache per src) ───────────────────────────────────────────

const _imgCache = new Map<string, Promise<HTMLImageElement>>();
/** Cache av bakte 3D-enhets-canvas per (variant,rot,størrelse,shot-lengde). */
const _bakeCache = new Map<string, HTMLCanvasElement>();

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

/**
 * Tegn `img` inn i mål-rektangelet. fit='cover' fyller + beskjærer mot
 * fokuspunktet (fx,fy 0..1); fit='contain' viser HELE bildet innfelt (letterbox
 * på svart). Cover-fokus = §«Rediger utsnitt» / «Juster utsnitt».
 */
function drawFitted(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  dx: number, dy: number, dw: number, dh: number,
  fit: 'cover' | 'contain' = 'cover', fx = 0.5, fy = 0.5,
): void {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const targetAspect = dw / dh;
  const imgAspect = iw / ih;

  if (fit === 'contain') {
    ctx.fillStyle = '#0c0e16';
    ctx.fillRect(dx, dy, dw, dh);
    let rw = dw, rh = dh;
    if (imgAspect > targetAspect) rh = dw / imgAspect;
    else rw = dh * imgAspect;
    ctx.drawImage(img, dx + (dw - rw) / 2, dy + (dh - rh) / 2, rw, rh);
    return;
  }

  const cfx = Math.max(0, Math.min(1, fx)), cfy = Math.max(0, Math.min(1, fy));
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (imgAspect > targetAspect) {
    sw = Math.round(ih * targetAspect);
    sx = Math.round((iw - sw) * cfx);
  } else {
    sh = Math.round(iw / targetAspect);
    sy = Math.round((ih - sh) * cfy);
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

/** Lifestyle-scene: fotografisk bakgrunn cover-fylt + skjermbilde warpet i quad. */
async function drawScene(ctx: CanvasRenderingContext2D, doc: MockupDoc): Promise<void> {
  const sc = sceneById(doc.canvas.scene?.id);
  if (!sc) return;
  const W = doc.canvas.w, H = doc.canvas.h;
  try { drawFitted(ctx, await loadImage(sc.src), 0, 0, W, H, 'cover'); } catch { /* behold */ }
  const shot = doc.canvas.scene?.shot;
  if (!shot) return;
  // Scenen er cover-fittet (kan beskjæres) → mål samme crop-transform for quad'en.
  const img = await loadImage(sc.src).catch(() => null);
  if (!img) return;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const scale = Math.max(W / iw, H / ih);
  const dw = iw * scale, dh = ih * scale, ox = (W - dw) / 2, oy = (H - dh) / 2;
  const px = (p: [number, number]): [number, number] => [ox + p[0] * dw, oy + p[1] * dh];
  const quad = sc.screen.map(px) as Quad;
  try { drawImageQuad(ctx, await loadImage(shot), quad); } catch { /* behold svart skjerm */ }
}

/** AI-generert bakgrunnsbilde: cover-fyll hele lerretet (bak dekor). Best-effort. */
async function drawBgImage(ctx: CanvasRenderingContext2D, doc: MockupDoc): Promise<void> {
  const src = doc.canvas.bgImage;
  if (!src) return;
  try {
    const img = await loadImage(src);
    drawFitted(ctx, img, 0, 0, doc.canvas.w, doc.canvas.h, 'cover');
  } catch { /* behold farge-bakgrunnen */ }
}

/** Dekor-lag: designer-elementer bak innholdet (glød-orber, mesh, rutenett, former). */
function drawDecor(ctx: CanvasRenderingContext2D, doc: MockupDoc): void {
  const c = doc.canvas;
  const decor = c.decor ?? 'none';
  if (decor === 'none') return;
  const W = c.w, H = c.h;
  const light = c.background === 'light';
  const a1 = hexToRgb(c.accent), a2 = hexToRgb(c.accent2);
  const rgb1 = `${a1.r},${a1.g},${a1.b}`, rgb2 = `${a2.r},${a2.g},${a2.b}`;
  const radial = (cx: number, cy: number, rad: number, rgb: string, alpha: number) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  if (decor === 'orbs') {
    radial(W * 0.82, H * 0.18, W * 0.38, rgb1, light ? 0.14 : 0.28);
    radial(W * 0.14, H * 0.86, W * 0.32, rgb2, light ? 0.11 : 0.22);
  } else if (decor === 'mesh') {
    radial(W * 0.18, H * 0.2, W * 0.42, rgb1, light ? 0.12 : 0.24);
    radial(W * 0.86, H * 0.32, W * 0.46, rgb2, light ? 0.11 : 0.22);
    radial(W * 0.55, H * 0.92, W * 0.4, rgb1, light ? 0.09 : 0.18);
  } else if (decor === 'grid') {
    ctx.save();
    ctx.fillStyle = light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
    const step = 46;
    for (let y = step; y < H; y += step) for (let x = step; x < W; x += step) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  } else if (decor === 'shapes') {
    ctx.save();
    ctx.fillStyle = `rgba(${rgb1},${light ? 0.1 : 0.14})`;
    ctx.beginPath(); ctx.arc(W * 1.0, H * 0.1, W * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(${rgb2},${light ? 0.09 : 0.12})`;
    ctx.beginPath(); ctx.arc(W * 0.0, H * 0.96, W * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${rgb1},${light ? 0.22 : 0.3})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(W * 0.055, H * 0.42); ctx.lineTo(W * 0.055, H * 0.42 + 110); ctx.stroke();
    ctx.restore();
  } else if (decor === 'rings') {
    // Konsentriske radar-ringer fra øvre høyre + myk glød i sentrum.
    ctx.save();
    const cx = W * 0.86, cy = H * 0.16;
    ctx.strokeStyle = `rgba(${rgb1},${light ? 0.13 : 0.2})`;
    ctx.lineWidth = 2;
    for (let r = W * 0.07; r < W * 0.95; r += W * 0.085) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    radial(cx, cy, W * 0.3, rgb1, light ? 0.1 : 0.18);
  } else if (decor === 'stripes') {
    // Energiske diagonale striper (45°) over hele lerretet.
    ctx.save();
    ctx.strokeStyle = `rgba(${rgb1},${light ? 0.08 : 0.12})`;
    ctx.lineWidth = 12;
    const gap = 58;
    for (let x = -H; x < W; x += gap) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke(); }
    ctx.restore();
  } else if (decor === 'waves') {
    // Flytende konturkurver (sinus), vekslende accent-farger — rolig rytme.
    ctx.save();
    ctx.lineWidth = 2.5;
    const rows = 7;
    for (let i = 0; i < rows; i++) {
      const yBase = H * 0.14 + i * (H * 0.115);
      ctx.strokeStyle = `rgba(${i % 2 ? rgb2 : rgb1},${light ? 0.13 : 0.18})`;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 12) { const y = yBase + Math.sin((x / W) * Math.PI * 3 + i * 0.6) * (H * 0.03); if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
  } else if (decor === 'spotlight') {
    // Dramatisk sentrert lyskjegle + vignett som mørkner hjørnene.
    radial(W * 0.5, H * 0.3, W * 0.55, rgb1, light ? 0.16 : 0.3);
    ctx.save();
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.42, W * 0.2, W * 0.5, H * 0.42, W * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, light ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  } else if (decor === 'confetti') {
    // Spredte roterte firkanter — deterministisk (trig-hash, ingen tilfeldighet).
    ctx.save();
    const n = 46;
    for (let i = 0; i < n; i++) {
      const hx = Math.sin(i * 12.9898) * 43758.5453; const fx = hx - Math.floor(hx);
      const hy = Math.sin(i * 78.233) * 43758.5453; const fy = hy - Math.floor(hy);
      const s = 6 + (i % 4) * 4;
      ctx.fillStyle = `rgba(${i % 2 ? rgb1 : rgb2},${light ? 0.16 : 0.24})`;
      ctx.save(); ctx.translate(fx * W, fy * H); ctx.rotate(i * 0.7); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
    }
    ctx.restore();
  } else if (decor === 'halftone') {
    // Retro-trykk: prikkegrid med voksende radius venstre→høyre.
    ctx.save();
    ctx.fillStyle = `rgba(${rgb1},${light ? 0.16 : 0.22})`;
    const step = 30;
    for (let y = step; y < H; y += step) for (let x = step; x < W; x += step) {
      const t = x / W; const r = t * t * 6.5;
      if (r > 0.3) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  } else if (decor === 'band') {
    // Fet diagonal fargeblokk (duotone) bak komposisjonen — grafisk plakat-look.
    ctx.save();
    const lg = ctx.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, `rgba(${rgb1},${light ? 0.18 : 0.3})`);
    lg.addColorStop(1, `rgba(${rgb2},${light ? 0.13 : 0.22})`);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.34); ctx.lineTo(W, H * 0.05); ctx.lineTo(W, H * 0.52); ctx.lineTo(0, H * 0.82); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
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

/**
 * Rendrer en innrammet enhet (ramme + skjermbilde klippet til skjerm-hullet)
 * til et gjennomsiktig offscreen-canvas i rammens NATIVE oppløsning. Brukes så
 * som ett lag av drawDevice for perspektiv + skygge + refleksjon.
 * ponytail: én offscreen-render per enhet per frame (motion). Cache per (fil,geom)
 * hvis video-eksport blir treg.
 */
async function renderDeviceFrameLayer(doc: MockupDoc, dev: MockupDeviceSlot, spec: (typeof DEVICE_FRAMES)[keyof typeof DEVICE_FRAMES], frame: HTMLImageElement): Promise<HTMLCanvasElement> {
  const natW = frame.naturalWidth || frame.width || 1000;
  const natH = frame.naturalHeight || frame.height || 1000;
  const off = document.createElement('canvas');
  off.width = natW; off.height = natH;
  const octx = off.getContext('2d');
  if (!octx) return off;
  octx.drawImage(frame, 0, 0, natW, natH);
  const sx = spec.screen.x * natW, sy = spec.screen.y * natH, sw = spec.screen.w * natW, sh = spec.screen.h * natH, r = spec.radius * natW;
  octx.save();
  roundRectPath(octx, sx, sy, sw, sh, r);
  octx.clip();
  if (dev.image) {
    try { drawFitted(octx, await loadImage(dev.image), sx, sy, sw, sh, dev.fit, dev.focusX, dev.focusY); }
    catch { drawScreenPlaceholder(octx, doc, sx, sy, sw, sh); }
  } else {
    drawScreenPlaceholder(octx, doc, sx, sy, sw, sh);
  }
  // Ren status-bar over skjermbildet (kun telefoner) — 09:41 + signal/wifi/batteri.
  if (dev.cleanStatusBar && (dev.variant === 'iphone' || dev.variant === 'android')) {
    drawStatusBar(octx, sx, sy, sw, sh);
  }
  octx.restore();
  return off;
}

/** Tegn en ren iOS/Android-status-bar øverst i skjermflaten. Ink-farge auto fra topp-luma. */
function drawStatusBar(ctx: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number): void {
  const barH = Math.max(18, sh * 0.045);
  // Sample topp-stripa for lys/mørk ink.
  let ink = '#ffffff';
  try {
    const strip = ctx.getImageData(Math.round(sx + sw * 0.3), Math.round(sy + barH * 0.3), Math.max(1, Math.round(sw * 0.4)), 1).data;
    let lum = 0; const n = strip.length / 4;
    for (let i = 0; i < strip.length; i += 4) lum += 0.2126 * strip[i] + 0.7152 * strip[i + 1] + 0.0722 * strip[i + 2];
    ink = (lum / n) > 140 ? '#0b0b0d' : '#ffffff';
  } catch { /* cross-origin/tom: behold hvit */ }
  ctx.save();
  ctx.fillStyle = ink;
  // Klokke (09:41) venstre.
  const fs = barH * 0.5;
  ctx.font = `600 ${fs}px -apple-system, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('09:41', sx + sw * 0.06, sy + barH * 0.55);
  // Høyre: signal-streker + wifi-bue + batteri.
  const cy = sy + barH * 0.55;
  let rx = sx + sw - sw * 0.06;
  // batteri
  const bw = barH * 0.9, bh = barH * 0.42;
  rx -= bw;
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, barH * 0.05);
  ctx.strokeRect(rx, cy - bh / 2, bw, bh);
  ctx.fillRect(rx + bw + 1, cy - bh * 0.18, barH * 0.06, bh * 0.36); // tut
  ctx.fillRect(rx + 1.5, cy - bh / 2 + 1.5, (bw - 3) * 0.7, bh - 3); // ladning
  // wifi (tre buer)
  rx -= barH * 0.9;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(rx + barH * 0.35, cy + barH * 0.2, barH * (0.12 + i * 0.09), Math.PI * 1.25, Math.PI * 1.75); ctx.stroke(); }
  // signal (4 stolper)
  rx -= barH * 0.9;
  for (let i = 0; i < 4; i++) { const bhh = barH * (0.18 + i * 0.11); ctx.fillRect(rx + i * barH * 0.16, cy + barH * 0.25 - bhh, barH * 0.1, bhh); }
  ctx.restore();
}

/** Speilrefleksjon under enheten: mirror + vertikal alpha-fade (via temp-canvas). */
function drawReflection(ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement, x: number, y: number, w: number, h: number): void {
  const tmp = document.createElement('canvas');
  tmp.width = layer.width; tmp.height = layer.height;
  const tctx = tmp.getContext('2d');
  if (!tctx) return;
  tctx.translate(0, tmp.height); tctx.scale(1, -1); // vertikal speiling
  tctx.drawImage(layer, 0, 0);
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.globalCompositeOperation = 'destination-in'; // fade nær-kant→borte
  const g = tctx.createLinearGradient(0, 0, 0, tmp.height);
  g.addColorStop(0, 'rgba(0,0,0,0.32)');
  g.addColorStop(0.45, 'rgba(0,0,0,0)');
  tctx.fillStyle = g;
  tctx.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(tmp, x, y + h, w, h);
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

  // Apple Watch tegnes syntetisk (ingen PNG-ramme, lisensfri; ignorerer perspektiv).
  if (dev.variant === 'watch') {
    await drawWatch(ctx, doc, dev, w, h);
    ctx.restore();
    return;
  }

  // Ekte 3D (WebGL) bakt til 2D-lag — erstatter 2D-ramme + 2.5D-perspektiv.
  if (dev.threeD && is3dVariant(dev.variant) && webglAvailable()) {
    try {
      const key = cacheKey([dev.variant, dev.threeD.rotX, dev.threeD.rotY, dev.threeD.rotZ, dev.threeD.light ?? '', Math.round(w), (dev.image ?? '').length]);
      let baked = _bakeCache.get(key);
      if (!baked) {
        const px = Math.max(256, Math.round(w * 2));
        baked = await render3dDevice({ variant: dev.variant, shot: dev.image, rotX: dev.threeD.rotX, rotY: dev.threeD.rotY, rotZ: dev.threeD.rotZ, light: dev.threeD.light, w: px, h: Math.round(px * (h / w)) });
        if (_bakeCache.size > 40) _bakeCache.clear();
        _bakeCache.set(key, baked);
      }
      if (dev.shadow) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = w * 0.06; ctx.shadowOffsetY = w * 0.045; ctx.drawImage(baked, dev.x, dev.y, w, h); ctx.restore(); }
      if (dev.reflection) drawReflection(ctx, baked, dev.x, dev.y, w, h);
      ctx.drawImage(baked, dev.x, dev.y, w, h);
      ctx.restore();
      return;
    } catch { /* fall gjennom til 2D-vei */ }
  }

  // 2.5D perspektiv-transform rundt senter (affint) — 'none' = ingen.
  const m = matrixFor(dev.perspective);
  if (m) {
    ctx.translate(cx, cy);
    ctx.transform(m.a, m.b, m.c, m.d, 0, 0);
    ctx.translate(-cx, -cy);
  }

  const spec = DEVICE_FRAMES[dev.variant];
  const frame = await loadImage(spec.src);
  const layer = await renderDeviceFrameLayer(doc, dev, spec, frame);

  // Kontakt-/kast-skygge: tegn laget med Multiply-lignende mørk skygge; selve
  // laget dekkes av den ekte enheten over, så bare skyggen (utenfor) vises.
  if (dev.shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = w * 0.06;
    ctx.shadowOffsetX = tiltsLeft(dev.perspective) ? -w * 0.02 : w * 0.02;
    ctx.shadowOffsetY = w * 0.045;
    ctx.drawImage(layer, dev.x, dev.y, w, h);
    ctx.restore();
  }

  // Refleksjon under (følger perspektiv/rotasjon siden vi er inne i transformen).
  if (dev.reflection) drawReflection(ctx, layer, dev.x, dev.y, w, h);

  // Selve enheten.
  ctx.drawImage(layer, dev.x, dev.y, w, h);

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
      drawFitted(ctx, shot, sx, sy, sw, sh, dev.fit, dev.focusX, dev.focusY);
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
  ctx.font = `${t.weight} ${t.size}px ${fontFamilyFor(t.role, doc.canvas)}`;
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

// ── Illustrasjons-lag (callout / lupe / markør) ─────────────────────────────

/** Skjerm-hullets rektangel for en enhet i lerret-px (der callouts festes). */
export function deviceScreenRect(dev: MockupDeviceSlot): { x: number; y: number; w: number; h: number } {
  const w = dev.w, h = deviceHeight(dev);
  if (dev.variant === 'watch') {
    const inset = w * 0.12;
    return { x: dev.x + inset, y: dev.y + inset, w: w - inset * 2, h: h - inset * 2 };
  }
  const spec = DEVICE_FRAMES[dev.variant];
  if (!spec) return { x: dev.x, y: dev.y, w, h }; // ukjent variant: fall tilbake til hele enhets-boksen (crash ikke rasteren)
  return { x: dev.x + spec.screen.x * w, y: dev.y + spec.screen.y * h, w: spec.screen.w * w, h: spec.screen.h * h };
}

/** Referanse-rektangel for en annotasjon (enhetens skjerm, ellers hele lerretet). */
function annRect(doc: MockupDoc, a: MockupAnnotation): { x: number; y: number; w: number; h: number } {
  const dev = a.deviceId ? doc.devices.find((d) => d.id === a.deviceId) : undefined;
  return dev ? deviceScreenRect(dev) : { x: 0, y: 0, w: doc.canvas.w, h: doc.canvas.h };
}

function drawMarker(ctx: CanvasRenderingContext2D, doc: MockupDoc, a: MockupAnnotation): void {
  const s = annRect(doc, a);
  const x = s.x + a.fx * s.w, y = s.y + a.fy * s.h, w = (a.fw ?? 0.2) * s.w, h = (a.fh ?? 0.12) * s.h;
  const rgb = hexToRgb(doc.canvas.accent);
  const r = Math.min(w, h) * 0.16;
  ctx.save();
  ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`;
  roundRectPath(ctx, x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = doc.canvas.accent; ctx.lineWidth = Math.max(3, s.w * 0.006);
  roundRectPath(ctx, x, y, w, h, r); ctx.stroke();
  ctx.restore();
}

function drawCallout(ctx: CanvasRenderingContext2D, doc: MockupDoc, a: MockupAnnotation): void {
  const s = annRect(doc, a);
  const ax = s.x + a.fx * s.w, ay = s.y + a.fy * s.h;
  const label = a.label ?? '';
  const num = String(a.n ?? 1);
  const W = doc.canvas.w;
  const pinR = Math.max(14, W * 0.011);
  const side = a.side ?? 'right';
  const onDevice = !!a.deviceId;
  ctx.save();
  ctx.font = `600 ${Math.round(pinR * 1.4)}px -apple-system, system-ui, sans-serif`;
  const tw = ctx.measureText(label).width;
  const chipH = pinR * 2.2;
  const dotR = pinR * 0.62;
  const chipW = pinR * 1.1 + dotR * 2 + pinR * 0.5 + tw + pinR * 0.9;
  const gap = pinR * 2.4;
  let lx: number, ly: number;
  if (onDevice) {
    if (side === 'left') { lx = s.x - gap - chipW; ly = ay - chipH / 2; }
    else if (side === 'right') { lx = s.x + s.w + gap; ly = ay - chipH / 2; }
    else if (side === 'top') { lx = ax - chipW / 2; ly = s.y - gap - chipH; }
    else { lx = ax - chipW / 2; ly = s.y + s.h + gap; }
  } else {
    const dx = side === 'left' ? -1 : side === 'right' ? 1 : 0;
    const dy = side === 'top' ? -1 : side === 'bottom' ? 1 : 0;
    lx = ax + dx * gap - (dx < 0 ? chipW : dx > 0 ? 0 : chipW / 2);
    ly = ay + dy * gap - (dy < 0 ? chipH : dy > 0 ? 0 : chipH / 2);
  }
  lx = Math.max(8, Math.min(lx, doc.canvas.w - chipW - 8));
  ly = Math.max(8, Math.min(ly, doc.canvas.h - chipH - 8));
  const cxp = side === 'left' ? lx + chipW : side === 'right' ? lx : lx + chipW / 2;
  const cyp = side === 'top' ? ly + chipH : side === 'bottom' ? ly : ly + chipH / 2;
  // leder-linje anker → chip
  ctx.strokeStyle = doc.canvas.accent; ctx.lineWidth = Math.max(2, pinR * 0.16);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cxp, cyp); ctx.stroke();
  // anker-pin
  ctx.fillStyle = doc.canvas.accent; ctx.beginPath(); ctx.arc(ax, ay, pinR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, pinR * 0.16); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(pinR * 1.15)}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(num, ax, ay + 1);
  // chip
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(20,30,40,0.14)'; ctx.lineWidth = 1.5;
  roundRectPath(ctx, lx, ly, chipW, chipH, chipH / 2); ctx.fill(); ctx.stroke();
  const dotX = lx + pinR * 1.1 + dotR;
  ctx.fillStyle = doc.canvas.accent; ctx.beginPath(); ctx.arc(dotX, ly + chipH / 2, dotR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(dotR * 1.3)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(num, dotX, ly + chipH / 2 + 0.5);
  ctx.fillStyle = '#1e293b'; ctx.textAlign = 'left';
  ctx.font = `600 ${Math.round(pinR * 1.4)}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(label, dotX + dotR + pinR * 0.5, ly + chipH / 2 + 1);
  ctx.restore();
}

function drawLoupe(ctx: CanvasRenderingContext2D, doc: MockupDoc, a: MockupAnnotation, scale: number, sampleSource: CanvasImageSource): void {
  const s = annRect(doc, a);
  const fx = s.x + a.fx * s.w, fy = s.y + a.fy * s.h;
  const W = doc.canvas.w, H = doc.canvas.h;
  const R = a.radius ?? 150;
  const lx = (a.lensX ?? 0.86) * W, ly = (a.lensY ?? 0.82) * H;
  const zoom = a.zoom ?? 2.4;
  const rgb = hexToRgb(doc.canvas.accent);
  ctx.save();
  // connector + fokus-ring
  ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`; ctx.lineWidth = Math.max(2, R * 0.02);
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(lx, ly); ctx.stroke();
  ctx.strokeStyle = doc.canvas.accent; ctx.lineWidth = Math.max(2, R * 0.03);
  ctx.beginPath(); ctx.arc(fx, fy, R * 0.28, 0, Math.PI * 2); ctx.stroke();
  // forstørret utsnitt (src i kilde-bitmap-piksler = base × scale)
  ctx.save();
  ctx.beginPath(); ctx.arc(lx, ly, R, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  const srcR = R / zoom;
  ctx.drawImage(sampleSource, (fx - srcR) * scale, (fy - srcR) * scale, srcR * 2 * scale, srcR * 2 * scale, lx - R, ly - R, R * 2, R * 2);
  ctx.restore();
  // ringer
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(4, R * 0.05); ctx.beginPath(); ctx.arc(lx, ly, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = doc.canvas.accent; ctx.lineWidth = Math.max(2, R * 0.028); ctx.beginPath(); ctx.arc(lx, ly, R + R * 0.028, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/** Tegn hele illustrasjons-laget (markør → callout → lupe). Lupe samples `sampleSource`. */
/** Ankerpunkt for en annotasjon (i lerret-px) — brukt som animasjons-senter. */
function annCenter(doc: MockupDoc, a: MockupAnnotation): { x: number; y: number } {
  const s = annRect(doc, a);
  return { x: s.x + a.fx * s.w, y: s.y + a.fy * s.h };
}

/** Kjør `fn` innpakket i en avsløring (transform + alpha rundt et senter). */
function withReveal(ctx: CanvasRenderingContext2D, rev: Reveal | null, cx: number, cy: number, fn: () => void): void {
  if (rev && rev.alpha <= 0.001) return;
  ctx.save();
  if (rev) {
    ctx.globalAlpha *= rev.alpha;
    ctx.translate(cx, cy + rev.ty);
    ctx.scale(rev.scale, rev.scale);
    ctx.translate(-cx, -cy);
  }
  fn();
  ctx.restore();
}

function drawAnnotations(ctx: CanvasRenderingContext2D, doc: MockupDoc, scale: number, sampleSource: CanvasImageSource, t?: number): void {
  const anns = doc.annotations;
  if (!anns || anns.length === 0) return;
  const markers = anns.filter((a) => a.kind === 'marker');
  const callouts = anns.filter((a) => a.kind === 'callout');
  const loupes = anns.filter((a) => a.kind === 'loupe');
  markers.forEach((a, i) => { const c = annCenter(doc, a); withReveal(ctx, t != null ? revealFor('marker', i, markers.length, t) : null, c.x, c.y, () => drawMarker(ctx, doc, a)); });
  callouts.forEach((a, i) => { const c = annCenter(doc, a); withReveal(ctx, t != null ? revealFor('callout', i, callouts.length, t) : null, c.x, c.y, () => drawCallout(ctx, doc, a)); });
  loupes.forEach((a, i) => { const lx = (a.lensX ?? 0.86) * doc.canvas.w, ly = (a.lensY ?? 0.82) * doc.canvas.h; withReveal(ctx, t != null ? revealFor('loupe', i, loupes.length, t) : null, lx, ly, () => drawLoupe(ctx, doc, a, scale, sampleSource)); });
}

// ── Produkt-mind map (native render av Mermaid-syntaks, merkevare-stylet) ────

function roundedPill(ctx: CanvasRenderingContext2D, cx: number, cy: number, text: string, font: string, padX: number, padY: number): { w: number; h: number } {
  ctx.font = font;
  const tw = ctx.measureText(text).width;
  const sizeM = /(\d+(?:\.\d+)?)px/.exec(font);
  const fs = sizeM ? parseFloat(sizeM[1]) : 16;
  const w = tw + padX * 2, h = fs + padY * 2;
  roundRectPath(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  return { w, h };
}

/** Native radial-render av en produkt-mind map i merkevarens farger. */
function drawMindmap(ctx: CanvasRenderingContext2D, doc: MockupDoc): void {
  const tree = parseMermaidMindmap(doc.mindmap || '');
  if (!tree) return;
  const c = doc.canvas;
  const W = c.w, H = c.h;
  const light = c.background === 'light';
  const ink = light ? '#1e293b' : '#eef2f8';
  const leafFill = light ? '#ffffff' : 'rgba(255,255,255,0.08)';
  const display = fontFamilyFor('title', c);
  const body = fontFamilyFor('body', c);
  const cx = W / 2, cy = H * 0.52;

  const level1 = tree.children;
  const N = Math.max(1, level1.length);
  const R1 = Math.min(W, H) * 0.30;
  const R2 = R1 + Math.min(W, H) * 0.185;

  ctx.save();

  // Tittel øverst til venstre (unngår kollisjon med topp-grenen).
  ctx.fillStyle = c.accent;
  ctx.font = `700 ${Math.round(W * 0.013)}px ${body}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  try { (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.round(W * 0.0015)}px`; } catch { /* noop */ }
  ctx.fillText('PRODUKT-PERSPEKTIV', W * 0.055, H * 0.085);
  try { (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px'; } catch { /* noop */ }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 1) Forbind + posisjoner (mål posisjoner først, tegn linjer under nodene).
  const ang0 = -Math.PI / 2;
  const l1pos = level1.map((_, i) => {
    const a = ang0 + (i * 2 * Math.PI) / N;
    return { a, x: cx + Math.cos(a) * R1, y: cy + Math.sin(a) * R1 };
  });

  // Linjer root → nivå1
  ctx.strokeStyle = hexToRgba(c.accent, 0.5);
  ctx.lineWidth = Math.max(2, W * 0.0016);
  l1pos.forEach((p) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); ctx.stroke(); });

  // Linjer nivå1 → nivå2 + tegn nivå2-løv
  const l2font = `600 ${Math.round(W * 0.0115)}px ${body}`;
  level1.forEach((node, i) => {
    const p = l1pos[i];
    const kids = node.children;
    const m = kids.length;
    if (m > 0) {
      const spread = Math.min(Math.PI * 0.5, m * 0.28);
      kids.forEach((k, j) => {
        const aa = p.a + (j - (m - 1) / 2) * (m > 1 ? spread / (m - 1) : 0);
        const kx = cx + Math.cos(aa) * R2, ky = cy + Math.sin(aa) * R2;
        ctx.strokeStyle = hexToRgba(c.accent2, 0.45);
        ctx.lineWidth = Math.max(1.5, W * 0.0012);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(kx, ky); ctx.stroke();
        // løv-pill
        ctx.fillStyle = leafFill;
        roundedPill(ctx, kx, ky, k.label, l2font, W * 0.011, H * 0.012); ctx.fill();
        ctx.strokeStyle = hexToRgba(c.accent2, 0.7); ctx.lineWidth = Math.max(1.5, W * 0.0011);
        roundedPill(ctx, kx, ky, k.label, l2font, W * 0.011, H * 0.012); ctx.stroke();
        ctx.fillStyle = ink; ctx.font = l2font; ctx.fillText(k.label, kx, ky + 1);
      });
    }
  });

  // 2) Nivå1-noder (fylt accent2)
  const l1font = `700 ${Math.round(W * 0.016)}px ${body}`;
  level1.forEach((node, i) => {
    const p = l1pos[i];
    ctx.fillStyle = c.accent2;
    roundedPill(ctx, p.x, p.y, node.label, l1font, W * 0.014, H * 0.016); ctx.fill();
    ctx.fillStyle = isDark(c.accent2) ? '#ffffff' : '#0b0d13';
    ctx.font = l1font; ctx.fillText(node.label, p.x, p.y + 1);
  });

  // 3) Rot-node (stor, fylt accent)
  const rootFont = `800 ${Math.round(W * 0.024)}px ${display}`;
  ctx.fillStyle = c.accent;
  const rp = roundedPill(ctx, cx, cy, tree.label, rootFont, W * 0.022, H * 0.024); ctx.fill();
  ctx.fillStyle = isDark(c.accent) ? '#ffffff' : '#0b0d13';
  ctx.font = rootFont; ctx.fillText(tree.label, cx, cy + 1);
  void rp;
  ctx.restore();
}

function hexToRgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Rasteriser et MockupDoc til et canvas. `scale` multipliserer base-oppløsningen
 * (1 = full eksport-oppløsning; < 1 for rask preview). Async fordi ramme-PNG-er
 * og skjermbilder lastes on-demand.
 */
export async function rasterizeMockup(doc: MockupDoc, scale = 1, opts?: { skipAnnotations?: boolean; anim?: { t: number }; transparent?: boolean }): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(doc.canvas.w * scale);
  canvas.height = Math.round(doc.canvas.h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  const t = opts?.anim?.t;

  if (!opts?.transparent) {
    fillBackground(ctx, doc);
    await drawBgImage(ctx, doc);
    drawDecor(ctx, doc);
  }

  // Lifestyle-scene-modus: fotografisk scene + warpet skjermbilde (tekst/logo over).
  if (doc.canvas.scene?.id) {
    await drawScene(ctx, doc);
    doc.texts.forEach((tx) => drawText(ctx, doc, tx));
    await drawLogo(ctx, doc.canvas);
    if (!opts?.skipAnnotations) drawAnnotations(ctx, doc, scale, canvas, t);
    return canvas;
  }

  // Mind map-modus: lerretet ER en produkt-mind map (ingen enheter/tekst).
  if (doc.mindmap && doc.mindmap.trim()) {
    const rev = t != null ? revealFor('mindmap', 0, 1, t) : null;
    withReveal(ctx, rev, doc.canvas.w / 2, doc.canvas.h * 0.52, () => drawMindmap(ctx, doc));
    await drawLogo(ctx, doc.canvas);
    return canvas;
  }

  // Enheter i dokument-rekkefølge (senere = øverst), animert avsløring om t satt.
  for (let i = 0; i < doc.devices.length; i++) {
    const dev = doc.devices[i];
    const rev = t != null ? revealFor('device', i, doc.devices.length, t) : null;
    if (rev && rev.alpha <= 0.001) continue;
    ctx.save();
    if (rev) {
      const cx = dev.x + dev.w / 2, cy = dev.y + deviceHeight(dev) / 2;
      ctx.globalAlpha *= rev.alpha;
      ctx.translate(cx, cy + rev.ty); ctx.scale(rev.scale, rev.scale); ctx.translate(-cx, -cy);
    }
    await drawDevice(ctx, doc, dev);
    ctx.restore();
  }
  doc.texts.forEach((tx, i) => {
    const rev = t != null ? revealFor('text', i, doc.texts.length, t) : null;
    withReveal(ctx, rev, tx.x + tx.w / 2, tx.y + measureTextHeight(tx) / 2, () => drawText(ctx, doc, tx));
  });
  await drawLogo(ctx, doc.canvas);
  if (!opts?.skipAnnotations) drawAnnotations(ctx, doc, scale, canvas, t);
  return canvas;
}

/**
 * Render en animasjons-sekvens (frames) for videoeksport. Returnerer ett canvas
 * per frame ved jevn t 0..1 over `seconds`. Siste ~12% er hvile (t=1) så videoen
 * ikke kutter rett etter siste avsløring.
 */
export async function renderMotionFrames(doc: MockupDoc, cfg: { seconds: number; fps: number }, scale = 1, onProgress?: (done: number, total: number) => void): Promise<HTMLCanvasElement[]> {
  const total = Math.max(2, Math.round(cfg.seconds * cfg.fps));
  const hold = 0.12; // andel av tiden som holder ferdig bilde
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < total; f++) {
    const prog = f / (total - 1);
    const t = prog <= 1 - hold ? prog / (1 - hold) : 1;
    frames.push(await rasterizeMockup(doc, scale, { anim: { t } }));
    onProgress?.(f + 1, total);
  }
  return frames;
}

/** Rasteriser + returner data-URL. `transparent` hopper bakgrunn/dekor; `format` PNG/WebP. */
export async function rasterizeToPngDataUrl(doc: MockupDoc, scale = 1, opts?: { transparent?: boolean; format?: 'png' | 'webp' }): Promise<string> {
  const canvas = await rasterizeMockup(doc, scale, { transparent: opts?.transparent });
  const mime = opts?.format === 'webp' ? 'image/webp' : 'image/png';
  return canvas.toDataURL(mime, opts?.format === 'webp' ? 0.92 : undefined);
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
  if (bg.ctx) { fillBackground(bg.ctx, doc); await drawBgImage(bg.ctx, doc); drawDecor(bg.ctx, doc); }
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

  // Illustrasjons-lag som ETT eget lag øverst. Lupen forstørrer pikslene under,
  // så vi sampler et flatt komposit (uten annotasjoner) i full oppløsning.
  if (doc.annotations && doc.annotations.length > 0) {
    const c = newLayerCanvas(w, h);
    if (c.ctx) {
      const flat = await rasterizeMockup(doc, 1, { skipAnnotations: true });
      drawAnnotations(c.ctx, doc, 1, flat);
    }
    out.push({ name: 'Illustrasjon', canvas: c.canvas });
  }
  return out;
}
