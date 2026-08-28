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

import { convertFileSrc, readImageB64 } from '../../api';
import { DEVICE_FRAMES } from '../demo-studio/deviceFrames';
import { parseMermaidMindmap } from './mockupMindmap';
import { revealFor, revealFromLocal, type Reveal } from './mockupMotion';
import { matrixFor, tiltsLeft } from './mockupPerspective';
import { render3dDevice, webglAvailable } from './mockup3d/mockup3d';
import { cacheKey, is3dVariant } from './mockup3d/deviceGeometry';
import { typedState, drawField, drawOnScreenKeyboard, drawKeyPop } from './mockup3d/keyboardAnim';
import { sceneById } from './mockupScenes';
import { drawImageQuad, type Quad } from './mockupSceneWarp';
import { isIconId, drawIcon } from './mockupIcons';
import { resolveConnectorEndpoints } from './mockupAnchors';
import {
  type MockupDoc,
  type MockupDeviceSlot,
  type MockupImageSlot,
  type MockupTextSlot,
  type MockupCanvasSpec,
  type MockupAnnotation,
  type PersonRigPose,
  type PersonStyle,
  type Keyframe,
  isDark,
  deviceHeight,
  resolveColor,
  fontFamilyFor,
  resolveBaseBg,
  mixHex,
  hexToRgb,
  deriveTimeline,
  clipLocalT,
  sampleKf,
  CHAT_TYPE_SPEEDS,
  CHAT_TURN_GAP,
  chatTurnDuration,
  PREVISIT_SCREEN_W,
} from './mockupStudioModel';

// ── Bilde-lasting (cache per src) ───────────────────────────────────────────

const _imgCache = new Map<string, Promise<HTMLImageElement>>();
const isPortableImageSrc = (src: string): boolean => /^(?:data:|https?:|blob:)/i.test(src);
const isLocalFileSrc = (src: string): boolean => !isPortableImageSrc(src) && !src.startsWith("/assets/");
/** Cache av bakte 3D-enhets-canvas per (variant,rot,størrelse,shot-lengde). */
const _bakeCache = new Map<string, HTMLCanvasElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = _imgCache.get(src);
  if (cached) return cached;
  const p = (async () => {
    // Tauri sitt asset-protokoll kan vises direkte, men gjør WebKit-canvaset
    // urent ved eksport. Native byte-lesing gir en origin-ren data-URL og lar
    // oss beholde store prosjektbilder som filstier i localStorage.
    const resolvedSrc = isLocalFileSrc(src) ? await readImageB64(src) : src;
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (/^https?:/i.test(resolvedSrc)) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Kunne ikke laste bilde: ${src.slice(0, 48)}`));
      img.src = resolvedSrc;
    });
  })();
  _imgCache.set(src, p);
  return p;
}

// ── Seedance-video-frames (compositing i eksport) ────────────────────────────
const _videoCache = new Map<string, Promise<HTMLVideoElement>>();
const _videoSafeSrc = (p: string): string => { try { return p.startsWith('data:') || p.startsWith('http') || p.startsWith('blob:') ? p : convertFileSrc(p); } catch { return p; } };
function loadVideo(src: string): Promise<HTMLVideoElement> {
  const cached = _videoCache.get(src);
  if (cached) return cached;
  const p = new Promise<HTMLVideoElement>((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.playsInline = true; v.crossOrigin = 'anonymous';
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('Kunne ikke laste video'));
    v.src = _videoSafeSrc(src);
  });
  _videoCache.set(src, p);
  return p;
}
/** Søk et video-element til gitt tid (loopet over klipp-lengden) og vent til framen er klar. */
function seekVideo(v: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve) => {
    const dur = v.duration || 0;
    const target = dur > 0 ? timeSec % dur : 0;
    if (Math.abs(v.currentTime - target) < 0.02) { resolve(); return; }
    const on = () => { v.removeEventListener('seeked', on); resolve(); };
    v.addEventListener('seeked', on);
    v.currentTime = target;
  });
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

/** Enkel «dybde»-følelse i en flat 2D-scene: bitte lett blur+avmetting på ting som sitter på
 *  BAKVEGGEN (dør/diplom/vindu/klokke/skilt) — møbler i forgrunnen (pult/hylle/plante) forblir
 *  skarpe. Kamera-dybdeskarphet er billig å simulere sånn, uten perspektiv-matte. */
function withWallDepth(ctx: CanvasRenderingContext2D, fn: () => void): void {
  ctx.save();
  ctx.filter = 'blur(1px) saturate(0.82) brightness(1.02)';
  fn();
  ctx.restore();
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

/**
 * Komponer skrive-animasjon (on-screen-tastatur + tekstfelt + pop) på scene-
 * skjermbildet før warp. Returnerer et canvas, eller original-bildet uendret.
 */
function composeSceneShot(img: HTMLImageElement, typeAnim: import('./mockupStudioModel').TypeAnimCfg | undefined, t?: number): HTMLImageElement | HTMLCanvasElement {
  if (!typeAnim?.text) return img;
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  if (!x) return img;
  x.drawImage(img, 0, 0);
  const st = typedState(typeAnim.text, t ?? 1, { payoff: typeAnim.payoff, correct: typeAnim.correct });
  const kbTop = drawOnScreenKeyboard(x, W, H, st.pressed);
  drawField(x, W, H, st, kbTop - 0.13, { style: typeAnim.field, placeholder: typeAnim.placeholder });
  if (typeAnim.keyPop && st.next && st.next !== ' ' && !st.done) drawKeyPop(x, W, H, st.next, st.sub, 0.58);
  return cv;
}

/** Lifestyle-scene: fotografisk bakgrunn cover-fylt + skjermbilde warpet i quad. */
async function drawScene(ctx: CanvasRenderingContext2D, doc: MockupDoc, t?: number): Promise<void> {
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
  try {
    const shotImg = await loadImage(shot);
    drawImageQuad(ctx, composeSceneShot(shotImg, doc.canvas.scene?.typeAnim, t), quad);
  } catch { /* behold svart skjerm */ }
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
  // Global styrke-skalering (0..2, default 1) — gjelder for ALLE dekor-typer likt,
  // heller enn å parametrisere alfa-verdiene i hver av de 13 grenene under separat.
  ctx.save();
  ctx.globalAlpha *= doc.canvas.decorIntensity ?? 1;
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
  } else if (decor === 'arc') {
    // Asymmetrisk, dramatisk buesving (bezier) — sitter i sonen over der foto/kort-
    // elementer typisk starter (~0.39H), IKKE bak dem (fotoer kant-til-kant dekker
    // resten av lerretet og ville skjult en lavere/svakere kurve helt).
    ctx.save();
    ctx.fillStyle = `rgba(${rgb2},${light ? 0.16 : 0.24})`;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.3);
    ctx.bezierCurveTo(W * 0.38, H * 0.1, W * 0.62, H * 0.34, W, H * 0.22);
    ctx.lineTo(W, H * 0.39); ctx.lineTo(0, H * 0.39); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
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

async function drawDevice(ctx: CanvasRenderingContext2D, doc: MockupDoc, dev: MockupDeviceSlot, t?: number, gt?: number): Promise<void> {
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
      // Skrive-animasjon: teksten skrives ved anim.t (fallback 1 = ferdig skrevet i statisk visning).
      const ta = dev.typeAnim;
      const typeArg = ta?.text ? { text: ta.text, progress: t ?? 1, keyPop: ta.keyPop, field: ta.field, placeholder: ta.placeholder, payoff: ta.payoff, correct: ta.correct } : undefined;
      const typeKey = typeArg ? `${typeArg.text.length}:${typeArg.progress.toFixed(3)}:${typeArg.keyPop ? 1 : 0}:${ta!.field ?? ''}:${ta!.payoff ? 1 : 0}:${ta!.correct ? 1 : 0}` : '';
      const zoom = dev.threeD.zoom ?? 1;
      // Keyframe-nøkkel: når kurver er aktive, gjør baken avhengig av playhead (gt).
      const kfKey = dev.threeD.kf && gt != null ? `kf${gt.toFixed(3)}` : '';
      const key = cacheKey([dev.variant, dev.threeD.rotX, dev.threeD.rotY, dev.threeD.rotZ, dev.threeD.light ?? '', zoom, dev.threeD.kbLayout ?? 'mac', Math.round(w), (dev.image ?? '').length, typeKey, kfKey]);
      let baked = _bakeCache.get(key);
      if (!baked) {
        // Bake-oppløsning skalerer med zoom → skarpere skjerm + tastatur ved innzooming.
        const px = Math.max(256, Math.round(w * 2 * Math.max(1, Math.min(2, zoom))));
        // Keyframe-graf: overstyr rot/zoom fra kurvene ved global playhead (gt).
        const kf = dev.threeD.kf;
        const kfv = (prop: string, def: number) => (kf && gt != null ? (sampleKf(kf[prop], gt) ?? def) : def);
        baked = await render3dDevice({ variant: dev.variant, shot: dev.image, rotX: kfv('rotX', dev.threeD.rotX), rotY: kfv('rotY', dev.threeD.rotY), rotZ: kfv('rotZ', dev.threeD.rotZ), light: dev.threeD.light, zoom: kfv('zoom', zoom), kbLayout: dev.threeD.kbLayout, w: px, h: Math.round(px * (h / w)), type: typeArg });
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

  if (dev.checklistContent?.animate || dev.dashboardContent?.animate) {
    const screen = { x: dev.x + spec.screen.x * w, y: dev.y + spec.screen.y * h, w: spec.screen.w * w, h: spec.screen.h * h };
    if (dev.checklistContent?.animate) drawDeviceChecklist(ctx, doc, dev, screen, t);
    if (dev.dashboardContent?.animate) drawDeviceDashboard(ctx, doc, dev, screen, t);
  }

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

/** Frittstående bilde-element (mat-foto/collage/VIDEO-frame): avrundet, fit cover/contain, skygge, rotasjon.
 *  Kilde kan være bilde ELLER video-element (Seedance-klipp) — eksplisitte kilde-dims. */
function drawImageSlot(ctx: CanvasRenderingContext2D, im: import('./mockupStudioModel').MockupImageSlot, source: CanvasImageSource, sw: number, sh: number): void {
  ctx.save();
  if (im.rotation) { const cx = im.x + im.w / 2, cy = im.y + im.h / 2; ctx.translate(cx, cy); ctx.rotate((im.rotation * Math.PI) / 180); ctx.translate(-cx, -cy); }
  if (im.shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = Math.max(12, im.w * 0.05); ctx.shadowOffsetY = im.h * 0.03;
    ctx.fillStyle = '#000'; roundRectPath(ctx, im.x, im.y, im.w, im.h, im.radius); ctx.fill();
    ctx.restore();
  }
  roundRectPath(ctx, im.x, im.y, im.w, im.h, im.radius);
  ctx.save(); ctx.clip();
  if (sw && sh) {
    const tA = im.w / im.h, sA = sw / sh;
    let rw = im.w, rh = im.h;
    if (im.fit === 'contain') {
      ctx.fillStyle = '#0c0e16'; ctx.fillRect(im.x, im.y, im.w, im.h);
      if (sA > tA) rh = im.w / sA; else rw = im.h * sA;
      ctx.drawImage(source, im.x + (im.w - rw) / 2, im.y + (im.h - rh) / 2, rw, rh);
    } else {
      // cover: kilden skaleres opp til den dekker slotten, deretter forskyves den etter
      // fokuspunktet (0.5,0.5 = sentrert, «reframe» i inspektøren styrer resten).
      if (sA > tA) rw = im.h * sA; else rh = im.w / sA;
      const fx = im.focusX ?? 0.5, fy = im.focusY ?? 0.5;
      ctx.drawImage(source, im.x + (im.w - rw) * fx, im.y + (im.h - rh) * fy, rw, rh);
    }
  }
  ctx.restore();
  ctx.restore();
}

const PERSON_SKIN = '#e0a878';
const PERSON_HAIR = '#2a2f3d';
const PERSON_SHIRT = '#1b294b';
const PERSON_GOLD = '#c9963b';
const PERSON_DESK = '#f8f6f2';
const PERSON_SCREEN = '#1b294b';

/** Prosedural flat-illustrasjon (Storyset-aktig): person ved laptop, tegnet med
 *  rene Canvas-primitiver — ingen ekstern asset, ingen generativ AI (bekreftet
 *  utilgjengelig i dette Adobe-miljøet). `pose` er keyframebar per egenskap
 *  (se PersonRigPose/PERSON_RIG_PROPS i mockupStudioModel.ts). */

/** 2-ledds IK (albue-vinkel via cosinussetningen) — gir en FYSISK KORREKT albuebøy for en gitt
 *  skulder→hånd-avstand, i stedet for en fast quadraticCurveTo-kurve tunet for én bestemt pose.
 *  Generaliserer: uansett hvor hånd-målet flytter seg (skriving, vinke, peke på skjermen), bøyer
 *  albuen riktig så armlengden stemmer. `bendSign` velger hvilken side albuen buer ut mot. */
function solveIK2(shoulder: { x: number; y: number }, target: { x: number; y: number }, upperLen: number, lowerLen: number, bendSign: 1 | -1): { x: number; y: number } {
  const dx = target.x - shoulder.x, dy = target.y - shoulder.y;
  const maxReach = upperLen + lowerLen, minReach = Math.abs(upperLen - lowerLen);
  const dist = Math.max(minReach + 0.01, Math.min(maxReach - 0.01, Math.hypot(dx, dy)));
  const baseAngle = Math.atan2(dy, dx);
  const cosA = (upperLen * upperLen + dist * dist - lowerLen * lowerLen) / (2 * upperLen * dist);
  const elbowAngle = baseAngle + bendSign * Math.acos(Math.max(-1, Math.min(1, cosA)));
  return { x: shoulder.x + Math.cos(elbowAngle) * upperLen, y: shoulder.y + Math.sin(elbowAngle) * upperLen };
}

/** Løser BEGGE albue-retninger og velger den som bøyer UTOVER (bort fra midtlinjen) — riktig
 *  retning avhenger av hvor målet er relativt skulderen, så en fast bendSign brekker sammen når
 *  hånda flyttes langt fra sin opprinnelige pose (skriving → telefon/gestikulering). */
function solveArmIK(shoulder: { x: number; y: number }, target: { x: number; y: number }, upperLen: number, lowerLen: number, side: 'left' | 'right'): { x: number; y: number } {
  const e1 = solveIK2(shoulder, target, upperLen, lowerLen, 1);
  const e2 = solveIK2(shoulder, target, upperLen, lowerLen, -1);
  return side === 'left' ? (e1.x <= e2.x ? e1 : e2) : (e1.x >= e2.x ? e1 : e2);
}

/** Eksportert for PersonThumbnail (live rigg-forhåndsvisning i inspektøren) — samme tegnefunksjon som render-løypa bruker. */
/** Flat-illustrert legekontor-bakgrunn (vegg, vindu, konsultasjonspult, plante, klokke, kors-skilt) —
 *  fyller HELE (x,y,w,h)-boksen, ment som et eget bakgrunns-bilde-element (bak person-figurene i
 *  doc.images-rekkefølgen). Samme flate stil/palett som drawPersonLaptop, ingen ekstern asset. */
export function drawOfficeBackdrop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.translate(x, y);

  const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
  wallGrad.addColorStop(0, '#eef1f6');
  wallGrad.addColorStop(1, '#dfe4ec');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, w, h * 0.74);
  ctx.fillStyle = '#cfd6e0';
  ctx.fillRect(0, h * 0.72, w, h * 0.02); // gulvlist

  const floorGrad = ctx.createLinearGradient(0, h * 0.74, 0, h);
  floorGrad.addColorStop(0, '#e4ded2');
  floorGrad.addColorStop(1, '#d3cabb');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, h * 0.74, w, h * 0.26);

  // Dør (venstre vegg) — antyder inngang, nyttig for «pasienten kommer inn»-staging.
  withWallDepth(ctx, () => {
    const doorX = w * 0.03, doorY = h * 0.2, doorW = w * 0.14, doorH = h * 0.52;
    ctx.fillStyle = '#e4e8ee'; ctx.strokeStyle = '#c9cfd9'; ctx.lineWidth = 3;
    roundRectPath(ctx, doorX, doorY, doorW, doorH, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9963b';
    ctx.beginPath(); ctx.arc(doorX + doorW - 10, doorY + doorH * 0.52, 3, 0, Math.PI * 2); ctx.fill();
  });

  // Diplom/sertifikat på veggen.
  withWallDepth(ctx, () => {
    const dipX = w * 0.32, dipY = h * 0.15, dipW = w * 0.1, dipH = h * 0.13;
    ctx.fillStyle = '#c9963b';
    roundRectPath(ctx, dipX - 3, dipY - 3, dipW + 6, dipH + 6, 3); ctx.fill();
    ctx.fillStyle = '#fdfbf6';
    roundRectPath(ctx, dipX, dipY, dipW, dipH, 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1.5;
    [0.3, 0.48, 0.66].forEach((f) => { ctx.beginPath(); ctx.moveTo(dipX + dipW * 0.15, dipY + dipH * f); ctx.lineTo(dipX + dipW * 0.85, dipY + dipH * f); ctx.stroke(); });
  });

  // Bokhylle/skap (motsatt side av vinduet) — noen fargede rygger antyder permer/bøker.
  const shelfX = w * 0.03, shelfY = h * 0.42, shelfW = w * 0.13, shelfH = h * 0.3;
  ctx.fillStyle = '#e4e8ee'; ctx.strokeStyle = '#c9cfd9'; ctx.lineWidth = 2;
  roundRectPath(ctx, shelfX, shelfY, shelfW, shelfH, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(shelfX, shelfY + shelfH * 0.5); ctx.lineTo(shelfX + shelfW, shelfY + shelfH * 0.5); ctx.stroke();
  const bookColors = ['#7c5ea8', '#c9963b', '#3f8f5f', '#e0546a', '#2563eb'];
  [0, 1].forEach((row) => {
    let bx = shelfX + 6;
    bookColors.forEach((c, i) => {
      const bw = 6 + (i % 3) * 2;
      ctx.fillStyle = c;
      ctx.fillRect(bx, shelfY + row * shelfH * 0.5 + 6, bw, shelfH * 0.5 - 12);
      bx += bw + 2;
    });
  });

  // Teppe under møbleringa (myk oval, subtil kant).
  const rugX = w * 0.5, rugY = h * 0.86;
  ctx.fillStyle = 'rgba(197,150,90,0.16)';
  ctx.beginPath(); ctx.ellipse(rugX, rugY, w * 0.28, h * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(197,150,90,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(rugX, rugY, w * 0.28, h * 0.07, 0, 0, Math.PI * 2); ctx.stroke();

  // Takbelysning.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.03, w * 0.05, h * 0.012, 0, 0, Math.PI * 2); ctx.fill();

  // Vindu m/ sprosser, myk himmel-gradient. Pluss veggklokke og kors-skilt — alle på samme
  // bakvegg-plan, så samme dybde-blur.
  withWallDepth(ctx, () => {
    const winX = w * 0.66, winY = h * 0.08, winW = w * 0.26, winH = h * 0.4;
    ctx.fillStyle = '#c9cfd9';
    roundRectPath(ctx, winX - 8, winY - 8, winW + 16, winH + 16, 6); ctx.fill();
    const skyGrad = ctx.createLinearGradient(0, winY, 0, winY + winH);
    skyGrad.addColorStop(0, '#cfe4f0');
    skyGrad.addColorStop(1, '#eaf3f7');
    ctx.fillStyle = skyGrad;
    roundRectPath(ctx, winX, winY, winW, winH, 3); ctx.fill();
    ctx.strokeStyle = '#c9cfd9'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(winX + winW / 2, winY); ctx.lineTo(winX + winW / 2, winY + winH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(winX, winY + winH / 2); ctx.lineTo(winX + winW, winY + winH / 2); ctx.stroke();

    const clockX = w * 0.5, clockY = h * 0.14, clockR = Math.min(w, h) * 0.035;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#c9cfd9'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(clockX, clockY, clockR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3a4256'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(clockX, clockY); ctx.lineTo(clockX, clockY - clockR * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(clockX, clockY); ctx.lineTo(clockX + clockR * 0.4, clockY + clockR * 0.15); ctx.stroke();

    const crossX = w * 0.15, crossY = h * 0.16, crossS = Math.min(w, h) * 0.045;
    ctx.fillStyle = '#e0546a';
    roundRectPath(ctx, crossX - crossS * 0.18, crossY - crossS, crossS * 0.36, crossS * 2, crossS * 0.15); ctx.fill();
    roundRectPath(ctx, crossX - crossS, crossY - crossS * 0.18, crossS * 2, crossS * 0.36, crossS * 0.15); ctx.fill();
  });

  // Konsultasjonspult — STÅENDE pult-høyde (ikke en lav benk), så pult-flaten treffer omtrent
  // hånd-/livhøyde på en stående figur («ved pulten»-ankeret) i stedet for lår-høyde.
  const deskX = w * 0.06, deskBottom = h * 0.73, deskH = h * 0.17, deskY = deskBottom - deskH, deskW = w * 0.22;
  ctx.fillStyle = 'rgba(27,41,75,0.1)';
  ctx.beginPath(); ctx.ellipse(deskX + deskW / 2, deskBottom + h * 0.03, deskW * 0.55, h * 0.02, 0, 0, Math.PI * 2); ctx.fill();
  const deskGrad = ctx.createLinearGradient(deskX, deskY, deskX, deskBottom);
  deskGrad.addColorStop(0, '#f5f6f8');
  deskGrad.addColorStop(1, '#dfe4ec');
  ctx.fillStyle = deskGrad;
  roundRectPath(ctx, deskX, deskY, deskW, deskH, 8); ctx.fill();
  ctx.fillStyle = '#c9963b';
  ctx.fillRect(deskX, deskY, deskW, 4); // pult-topp aksent-kant
  // Skjerm + tastatur, begge PÅ pult-toppen (deskY) — skjermen viser PreVisit-rapporten åpen
  // (navy hode + linjer), ikke bare en blank «på»-skjerm, så det leser som legen har notatet oppe.
  // monX sentrert under 'desk'-ankeret (BACKDROP_ANCHORS office-backdrop.desk, fx 0..0.22) —
  // rett FORAN der figuren står, ikke ved skulderkanten, så headTilt faktisk leser som at
  // legen ser på skjermen istedenfor bare ned i luften.
  const monW = deskW * 0.3, monH = h * 0.1, monX = deskX + deskW * 0.08, monY = deskY - monH;
  ctx.fillStyle = '#8a8f9a'; ctx.fillRect(monX + monW * 0.4, deskY - 4, 3, 4); // fot
  ctx.fillStyle = '#2b3348';
  roundRectPath(ctx, monX, monY, monW, monH, 4); ctx.fill();
  ctx.fillStyle = '#fdfbf6';
  roundRectPath(ctx, monX + 3, monY + 3, monW - 6, monH - 10, 2); ctx.fill();
  ctx.fillStyle = '#1b294b';
  ctx.fillRect(monX + 3, monY + 3, monW - 6, (monH - 10) * 0.3); // rapport-hode
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  [0.55, 0.72, 0.89].forEach((f) => ctx.fillRect(monX + 6, monY + 3 + (monH - 10) * f, monW - 12, 2)); // rapport-tekstlinjer
  ctx.fillStyle = '#dfe4ec';
  roundRectPath(ctx, deskX + deskW * 0.12, deskY - 8, deskW * 0.34, 8, 3); ctx.fill(); // tastatur, flatt på pulten

  // Øyetavle på veggen (ved siden av diplomet) — klassisk legekontor-detalj.
  withWallDepth(ctx, () => {
    const eyeX = w * 0.57, eyeY = h * 0.14, eyeW = w * 0.07, eyeH = h * 0.11;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#c9cfd9'; ctx.lineWidth = 2;
    roundRectPath(ctx, eyeX, eyeY, eyeW, eyeH, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#20242c';
    ['E', 'FP', 'TOZ', 'LPED'].forEach((row, i) => {
      ctx.font = `${9 - i * 1.2}px system-ui, sans-serif`;
      ctx.fillText(row, eyeX + eyeW * 0.18, eyeY + eyeH * (0.25 + i * 0.2));
    });
  });

  // Arkivskap ved døra (motstykke til bokhylla, lagringsdetalj).
  const cabX = w * 0.03, cabY = h * 0.6, cabW = w * 0.1, cabH = h * 0.12;
  ctx.fillStyle = '#dfe4ec'; ctx.strokeStyle = '#c9cfd9'; ctx.lineWidth = 2;
  roundRectPath(ctx, cabX, cabY, cabW, cabH, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#c9cfd9';
  ctx.beginPath(); ctx.moveTo(cabX, cabY + cabH * 0.5); ctx.lineTo(cabX + cabW, cabY + cabH * 0.5); ctx.stroke();
  ctx.fillStyle = '#8a8f9a';
  ctx.fillRect(cabX + cabW * 0.5 - 6, cabY + cabH * 0.22, 12, 3);
  ctx.fillRect(cabX + cabW * 0.5 - 6, cabY + cabH * 0.72, 12, 3);

  // Plante i potte.
  const potX = w * 0.88, potY = h * 0.68;
  ctx.fillStyle = '#c9963b';
  roundRectPath(ctx, potX - 16, potY, 32, 26, 4); ctx.fill();
  ctx.fillStyle = '#3f8f5f';
  [[-10, -6], [10, -6], [0, -18], [-6, -26], [6, -26]].forEach(([dx, dy]) => {
    ctx.beginPath(); ctx.ellipse(potX + dx, potY + dy, 12, 20, dx * 0.03, 0, Math.PI * 2); ctx.fill();
  });

  ctx.restore();
}

/** Flat-illustrert venteværelse (stolrad, sofabord m/ blader, resepsjonsdisk, veggklokke, plante) —
 *  motstykket til drawOfficeBackdrop for «legen henter pasienten fra venterommet»-scener. Samme
 *  fyll-hele-boksen-mønster, samme palett — leser som samme bygning, annet rom. */
export function drawWaitingRoomBackdrop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.translate(x, y);

  const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
  wallGrad.addColorStop(0, '#f2eee5');
  wallGrad.addColorStop(1, '#e6e0d2');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, w, h * 0.74);
  ctx.fillStyle = '#d8d0bd';
  ctx.fillRect(0, h * 0.72, w, h * 0.02);
  const floorGrad = ctx.createLinearGradient(0, h * 0.74, 0, h);
  floorGrad.addColorStop(0, '#e4ded2');
  floorGrad.addColorStop(1, '#d3cabb');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, h * 0.74, w, h * 0.26);

  // Resepsjonsdisk — LAV skranke m/ overheng, varm treaktig tone (IKKE en tavle/skjerm-lignende
  // boks, som lett leser som klasserom-katedert). Bjelle på disken antyder «resepsjon».
  const deskX = w * 0.4, deskY = h * 0.52, deskW = w * 0.24, deskH = h * 0.1;
  const recGrad = ctx.createLinearGradient(deskX, deskY, deskX, deskY + deskH);
  recGrad.addColorStop(0, '#e0b878');
  recGrad.addColorStop(1, '#c9963b');
  ctx.fillStyle = recGrad;
  roundRectPath(ctx, deskX, deskY + deskH * 0.25, deskW, deskH * 0.75, 6); ctx.fill(); // front-panel
  ctx.fillStyle = '#f5f6f8';
  roundRectPath(ctx, deskX - 6, deskY, deskW + 12, deskH * 0.3, 5); ctx.fill(); // disk-overheng
  ctx.fillStyle = '#3a4256';
  ctx.beginPath(); ctx.arc(deskX + deskW * 0.82, deskY + deskH * 0.14, 5, 0, Math.PI * 2); ctx.fill(); // bjelle
  ctx.fillRect(deskX + deskW * 0.82 - 1.5, deskY + deskH * 0.14 - 8, 3, 5);

  // Veggklokke over resepsjonen.
  withWallDepth(ctx, () => {
    const clockX = deskX + deskW / 2, clockY = h * 0.16, clockR = Math.min(w, h) * 0.035;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#c9cfd9'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(clockX, clockY, clockR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3a4256'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(clockX, clockY); ctx.lineTo(clockX, clockY - clockR * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(clockX, clockY); ctx.lineTo(clockX + clockR * 0.4, clockY + clockR * 0.15); ctx.stroke();
  });

  // Ventebenk — ÉN sammenhengende lav klinikkbenk (ikke enkeltstolar med høy rygg, som lett leser
  // som skolepulter): lang lav rygg + lang sete, tynne metallbein, subtile arm-skiller mellom plassene.
  const benchX = w * 0.04, benchY = h * 0.58, benchW = w * 0.32, backH = h * 0.09, seatH = h * 0.045;
  ctx.fillStyle = '#dfe4ec';
  roundRectPath(ctx, benchX, benchY - backH, benchW, backH, 8); ctx.fill(); // rygg (lav, hele benken)
  const seatGrad = ctx.createLinearGradient(benchX, benchY, benchX, benchY + seatH);
  seatGrad.addColorStop(0, '#c9963b');
  seatGrad.addColorStop(1, '#b5793a');
  ctx.fillStyle = seatGrad;
  roundRectPath(ctx, benchX, benchY, benchW, seatH, 6); ctx.fill(); // sete (hele benken, ett stykke)
  ctx.strokeStyle = '#8a8f9a'; ctx.lineWidth = 3;
  for (let i = 1; i < 3; i++) { // arm-skiller mellom de 3 sitteplassene
    const ax = benchX + (benchW / 3) * i;
    ctx.beginPath(); ctx.moveTo(ax, benchY - backH * 0.5); ctx.lineTo(ax, benchY + seatH); ctx.stroke();
  }
  ctx.fillStyle = '#8a8f9a'; // bein
  [0.06, 0.94].forEach((f) => { ctx.fillRect(benchX + benchW * f - 2, benchY + seatH, 4, h * 0.05); });

  // Sofabord m/ magasin-stabel.
  const tblX = w * 0.42, tblY = h * 0.68;
  ctx.fillStyle = '#c9963b';
  roundRectPath(ctx, tblX - 34, tblY, 68, 8, 3); ctx.fill();
  ctx.fillStyle = '#8a8f9a';
  ctx.fillRect(tblX - 30, tblY + 8, 4, 22); ctx.fillRect(tblX + 26, tblY + 8, 4, 22);
  ['#e0546a', '#2563eb', '#3f8f5f'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(tblX - 16 + i * 2, tblY - 4 - i * 4, 26, 4);
  });

  // Plante.
  const potX = w * 0.9, potY = h * 0.66;
  ctx.fillStyle = '#c9963b';
  roundRectPath(ctx, potX - 16, potY, 32, 26, 4); ctx.fill();
  ctx.fillStyle = '#3f8f5f';
  [[-10, -6], [10, -6], [0, -18], [-6, -26], [6, -26]].forEach(([dx, dy]) => {
    ctx.beginPath(); ctx.ellipse(potX + dx, potY + dy, 12, 20, dx * 0.03, 0, Math.PI * 2); ctx.fill();
  });

  // Vannkjøler ved resepsjonen.
  const coolX = w * 0.35, coolY = h * 0.5;
  ctx.fillStyle = '#c9cfd9';
  roundRectPath(ctx, coolX, coolY, 22, 38, 5); ctx.fill();
  ctx.fillStyle = 'rgba(150,190,220,0.6)';
  ctx.beginPath(); ctx.arc(coolX + 11, coolY + 10, 8, 0, Math.PI * 2); ctx.fill(); // vannflaske
  ctx.fillStyle = '#8a8f9a';
  ctx.fillRect(coolX + 8, coolY + 24, 6, 4); // tapp

  // Knaggrekke m/ frakker ved inngangen.
  const rackX = w * 0.74, rackY = h * 0.22;
  ctx.strokeStyle = '#8a8f9a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(rackX, rackY); ctx.lineTo(rackX, rackY + h * 0.16); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rackX - 14, rackY); ctx.lineTo(rackX + 14, rackY); ctx.stroke();
  [['#e0546a', -14], ['#3a4256', 6]].forEach(([c, dx]) => {
    ctx.fillStyle = c as string;
    roundRectPath(ctx, rackX + (dx as number), rackY + 4, 16, 26, 6); ctx.fill();
  });

  // Oppslagstavle m/ noen lapper — over sofabordet.
  withWallDepth(ctx, () => {
    const noteX = w * 0.28, noteY = h * 0.14, noteW = w * 0.1, noteH = h * 0.12;
    ctx.fillStyle = '#c9963b';
    roundRectPath(ctx, noteX - 3, noteY - 3, noteW + 6, noteH + 6, 3); ctx.fill();
    ctx.fillStyle = '#e8ddc4';
    roundRectPath(ctx, noteX, noteY, noteW, noteH, 2); ctx.fill();
    [['#e0546a', 0.2, 0.22], ['#2563eb', 0.55, 0.35], ['#3f8f5f', 0.3, 0.6]].forEach(([c, fx, fy]) => {
      ctx.fillStyle = c as string;
      ctx.save(); ctx.translate(noteX + noteW * (fx as number), noteY + noteH * (fy as number)); ctx.rotate(-0.08);
      ctx.fillRect(-noteW * 0.16, -noteH * 0.09, noteW * 0.32, noteH * 0.18);
      ctx.restore();
    });
  });

  ctx.restore();
}

export function drawPersonLaptop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pose: PersonRigPose, style?: PersonStyle): void {
  const skin = style?.skin || PERSON_SKIN;
  const hair = style?.hair || PERSON_HAIR;
  const shirt = style?.shirt || PERSON_SHIRT;
  const accent = style?.accent || PERSON_GOLD;
  const outfit = style?.outfit || 'genser';
  const hairStyle = style?.hairStyle || 'kort';
  const accessory = style?.accessory || 'ingen';
  const scenario = style?.scenario || 'laptop';
  const NW = 600, NH = 760; // normalisert tegne-boks, skalert til (w,h) m/ bevart aspekt, sentrert
  const scale = Math.min(w / NW, h / NH);
  const ox = x + (w - NW * scale) / 2;
  const oy = y + (h - NH * scale) / 2;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  // shade: mørkere (negativ) / lysere (positiv) versjon av en hex-farge — for myk skygge/glans
  // uten å endre selve fargevalget brukeren satte i personStyle.
  const shade = (base: string, amt: number): string => mixHex(base, amt < 0 ? '#000000' : '#ffffff', Math.abs(amt));

  const groundGrad = ctx.createRadialGradient(300, 700, 8, 300, 700, 210);
  groundGrad.addColorStop(0, 'rgba(27,41,75,0.22)');
  groundGrad.addColorStop(1, 'rgba(27,41,75,0)');
  ctx.fillStyle = groundGrad;
  ctx.beginPath(); ctx.ellipse(300, 700, 210, 28, 0, 0, Math.PI * 2); ctx.fill();

  if (scenario === 'laptop') {
    const chairGrad = ctx.createLinearGradient(180, 300, 180, 560);
    chairGrad.addColorStop(0, '#eef1f5');
    chairGrad.addColorStop(1, '#c9cfd9');
    ctx.fillStyle = chairGrad;
    roundRectPath(ctx, 180, 300, 240, 260, 40); ctx.fill();
  }

  // Torso+hode-gruppe: bob (idle sway) + lene rundt hofte-pivot. Armer/hender/desk holdes utafor
  // så hendene blir liggende på tastaturet uansett hvor mye overkroppen bobber/lener.
  ctx.save();
  ctx.translate(0, pose.bodyBob);
  ctx.translate(300, 560); ctx.rotate((pose.leanX * Math.PI) / 180); ctx.translate(-300, -560);

  const shirtGrad = ctx.createLinearGradient(195, 350, 195, 570);
  shirtGrad.addColorStop(0, shade(shirt, 0.1));
  shirtGrad.addColorStop(1, shade(shirt, -0.2));
  ctx.fillStyle = shirtGrad;
  roundRectPath(ctx, 195, 350, 210, 220, 60); ctx.fill();

  // Stetoskop: slange rundt nakken + bryst-stykke — delt av legefrakk-antrekket OG accessory==='stetoskop'.
  const drawStethoscope = (): void => {
    ctx.strokeStyle = '#3a4256'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(278, 358); ctx.quadraticCurveTo(300, 400, 300, 430); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(322, 358); ctx.quadraticCurveTo(300, 400, 300, 430); ctx.stroke();
    ctx.fillStyle = '#3a4256';
    ctx.beginPath(); ctx.arc(300, 434, 9, 0, Math.PI * 2); ctx.fill();
  };

  // Antrekk-detaljer som skiller silhuetten fra plain genser.
  if (outfit === 'hettegenser') {
    // Hette bak nakken, tegnes FØR hodet så den ligger bak/rundt.
    ctx.fillStyle = shirtGrad;
    roundRectPath(ctx, 240, 328, 120, 55, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(280, 356); ctx.lineTo(276, 392); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(320, 356); ctx.lineTo(324, 392); ctx.stroke();
  } else if (outfit === 'skjorte') {
    ctx.fillStyle = '#dfe3ea';
    ctx.beginPath(); ctx.moveTo(281, 351); ctx.lineTo(300, 378); ctx.lineTo(289, 353); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(319, 351); ctx.lineTo(300, 378); ctx.lineTo(311, 353); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#dfe3ea';
    [0, 1, 2].forEach((i) => { ctx.beginPath(); ctx.arc(300, 400 + i * 28, 3, 0, Math.PI * 2); ctx.fill(); });
  } else if (outfit === 'legefrakk') {
    // Åpen hvit legefrakk over genseren (to fronter + krage) + stetoskop rundt halsen.
    ctx.fillStyle = '#f5f6f8';
    ctx.beginPath(); ctx.moveTo(195, 360); ctx.lineTo(270, 360); ctx.lineTo(255, 570); ctx.lineTo(195, 570); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(405, 360); ctx.lineTo(330, 360); ctx.lineTo(345, 570); ctx.lineTo(405, 570); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e4e7ec';
    ctx.beginPath(); ctx.moveTo(270, 355); ctx.lineTo(300, 385); ctx.lineTo(285, 358); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(330, 355); ctx.lineTo(300, 385); ctx.lineTo(315, 358); ctx.closePath(); ctx.fill();
    drawStethoscope();
  } else if (outfit === 'sykepleier') {
    // Scrubs: rund krage + bryst-lomme m/ rødt kors — silhuett+detalj skiller fra plain genser.
    ctx.fillStyle = shade(shirt, 0.22);
    ctx.beginPath(); ctx.ellipse(300, 358, 26, 12, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#ffffff';
    roundRectPath(ctx, 320, 420, 26, 20, 4); ctx.fill();
    ctx.strokeStyle = '#e0546a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(333, 425); ctx.lineTo(333, 435); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(328, 430); ctx.lineTo(338, 430); ctx.stroke();
  }
  // Stetoskop som frittstående tilbehør (uavhengig av antrekk) — legefrakk tegner sitt eget over.
  if (accessory === 'stetoskop' && outfit !== 'legefrakk') drawStethoscope();
  // ID-kort: hvitt kort + stropp ned mot brystet.
  if (accessory === 'id-kort') {
    ctx.strokeStyle = '#c9963b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(288, 358); ctx.lineTo(298, 440); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(312, 358); ctx.lineTo(302, 440); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    roundRectPath(ctx, 288, 440, 24, 32, 3); ctx.fill();
    ctx.fillStyle = '#dfe3ea';
    roundRectPath(ctx, 293, 446, 14, 12, 2); ctx.fill();
  }

  // Skuldre: subtil avrunding oppå torso-rektangelets topp-hjørner — blander seg inn i den
  // eksisterende hjørne-rundingen istedenfor å stikke ut som egne klumper.
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.ellipse(213, 356, 15, 11, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(387, 356, 15, 11, 0.3, 0, Math.PI * 2); ctx.fill();

  // Hode+hår+ansikt: egen gruppe, roterer rundt nakke-pivot (headTilt).
  ctx.save();
  ctx.translate(300, 350); ctx.rotate((pose.headTilt * Math.PI) / 180); ctx.translate(-300, -350);

  // Nakke: bygger bro mellom hode og torso — uten denne møtes de i en brå kant.
  ctx.fillStyle = shade(skin, -0.05);
  roundRectPath(ctx, 282, 335, 36, 34, 10); ctx.fill();

  const skinGrad = ctx.createRadialGradient(282, 284, 8, 300, 302, 74);
  skinGrad.addColorStop(0, shade(skin, 0.14));
  skinGrad.addColorStop(1, shade(skin, -0.08));
  ctx.fillStyle = skinGrad;
  ctx.beginPath(); ctx.arc(300, 300, 68, 0, Math.PI * 2); ctx.fill();

  const hairGrad = ctx.createLinearGradient(300, 206, 300, 300);
  hairGrad.addColorStop(0, shade(hair, 0.18));
  hairGrad.addColorStop(1, shade(hair, -0.06));
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  ctx.arc(300, 280, 74, Math.PI, Math.PI * 2);
  ctx.lineTo(374, 300); ctx.arc(300, 300, 74, 0, Math.PI, true);
  ctx.closePath(); ctx.fill();
  if (hairStyle === 'buffert') {
    ctx.beginPath(); ctx.arc(300, 224, 22, 0, Math.PI * 2); ctx.fill();
  } else if (hairStyle === 'krøller') {
    [[242, 252], [270, 220], [300, 210], [330, 220], [358, 252]].forEach(([cx, cy]) => {
      ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.fill();
    });
  }
  // Sykepleier-lue: hvit halvbue m/ rødt kors, oppå håret.
  if (outfit === 'sykepleier') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(300, 224, 34, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e0546a';
    ctx.fillRect(296, 206, 8, 16);
    ctx.fillRect(288, 212, 24, 8);
  }

  // Øyenbryn: løftes/senkes med browRaise.
  const bry = 288 - pose.browRaise * 5;
  ctx.strokeStyle = hair; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(270, bry + 2); ctx.lineTo(286, bry); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(314, bry); ctx.lineTo(330, bry + 2); ctx.stroke();

  // Øyne: skalert av eyeSize, flates ut mot blink=1 (lukket) — enkel, lesbar blunk på flate ikon-prikker.
  const eyeRx = 5 * pose.eyeSize;
  const eyeRy = eyeRx * (1 - pose.blink);
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.ellipse(278, 302, eyeRx, Math.max(0.6, eyeRy), 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(322, 302, eyeRx, Math.max(0.6, eyeRy), 0, 0, Math.PI * 2); ctx.fill();
  // Pupill-refleks: liten hvit prikk — gir liv, kun synlig når øyet er åpent nok.
  if (eyeRy > 1.5) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(276, 300, Math.min(1.6, eyeRx * 0.28), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(320, 300, Math.min(1.6, eyeRx * 0.28), 0, Math.PI * 2); ctx.fill();
  }
  // Tåre: dråpe under venstre øye, vokser med 'tears'.
  if (pose.tears > 0.05) {
    ctx.fillStyle = 'rgba(120,180,235,0.85)';
    ctx.beginPath();
    ctx.ellipse(278, 312 + pose.tears * 8, 2.5, 4 + pose.tears * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (accessory === 'briller') {
    ctx.strokeStyle = hair; ctx.lineWidth = 3;
    ctx.strokeRect(264, 291, 26, 20);
    ctx.strokeRect(310, 291, 26, 20);
    ctx.beginPath(); ctx.moveTo(290, 300); ctx.lineTo(310, 300); ctx.stroke();
  }
  // Tenner: hvit flate bak munnlinja, vises kun ved bredt nok smil (mouthCurve > 0.2).
  if (pose.mouthCurve > 0.2) {
    ctx.fillStyle = '#ffffff';
    roundRectPath(ctx, 288, 313, 24, 3 + pose.mouthCurve * 5, 2);
    ctx.fill();
  }
  // Munn: kvadratisk kurve mellom munnvikene — kontrollpunkt under/over gir smil/bekymret (mouthCurve).
  ctx.strokeStyle = hair; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(284, 315);
  ctx.quadraticCurveTo(300, 315 + pose.mouthCurve * 10, 316, 315);
  ctx.stroke();
  // Munnbind: dekker nese/munn/hake, tegnes OVER munnen + strikk mot ørene.
  if (accessory === 'munnbind') {
    ctx.fillStyle = '#eaf1f5';
    roundRectPath(ctx, 268, 300, 64, 42, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(268, 316); ctx.lineTo(332, 316); ctx.stroke();
    ctx.strokeStyle = '#c7d0d8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(268, 306); ctx.lineTo(238, 296); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(332, 306); ctx.lineTo(362, 296); ctx.stroke();
  }
  if (accessory === 'hodetelefoner') {
    ctx.strokeStyle = '#2a2f3d'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(300, 262, 78, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    ctx.fillStyle = '#2a2f3d';
    ctx.beginPath(); ctx.ellipse(230, 302, 10, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(370, 302, 10, 17, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore(); // hode

  // Bein: alle scenarioer UNNTATT 'laptop' (der pulten skjuler underkroppen — ekte, ikke en mangel).
  // 'walk' svinger beina (legSwing); øvrige (stand/phone/presenter) står i ro, rett stilling.
  if (scenario !== 'laptop') {
    const pantsColor = shade(shirt, -0.35);
    const drawLeg = (hipX: number, phaseOffset: number): void => {
      const angle = scenario === 'walk' ? Math.sin(pose.legSwing * Math.PI * 2 + phaseOffset) * (18 * Math.PI / 180) : 0;
      ctx.save();
      ctx.translate(hipX, 572); ctx.rotate(angle); ctx.translate(-hipX, -572);
      ctx.fillStyle = pantsColor;
      roundRectPath(ctx, hipX - 13, 572, 26, 128, 13); ctx.fill();
      ctx.fillStyle = '#20242c';
      roundRectPath(ctx, hipX - 15, 686, 30, 18, 8); ctx.fill(); // sko
      ctx.restore();
    };
    drawLeg(270, 0);
    drawLeg(330, Math.PI); // motsatt fase av venstre bein (kun synlig ved 'walk')
  }

  ctx.restore(); // torso+hode (bodyBob/leanX)

  if (scenario === 'laptop') {
    const deskGrad = ctx.createLinearGradient(60, 560, 60, 590);
    deskGrad.addColorStop(0, PERSON_DESK);
    deskGrad.addColorStop(1, shade(PERSON_DESK, -0.1));
    ctx.fillStyle = deskGrad;
    roundRectPath(ctx, 60, 560, 480, 30, 10); ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(60, 560, 480, 6);

    const lidGrad = ctx.createLinearGradient(220, 470, 220, 570);
    lidGrad.addColorStop(0, '#343d54');
    lidGrad.addColorStop(1, '#22283a');
    ctx.fillStyle = lidGrad;
    roundRectPath(ctx, 220, 470, 160, 100, 10); ctx.fill();
    ctx.fillStyle = PERSON_SCREEN;
    ctx.fillRect(232, 482, 136, 76);
    // Skjerm-«tekst»: linje-bredder puster med screenActivity, pluss blinkende markør på aktiv linje.
    const lineBase = [80, 66, 52];
    ctx.fillStyle = 'rgba(248,246,242,0.65)';
    const lineW = lineBase.map((base, i) => Math.max(20, Math.min(96, base + Math.sin(pose.screenActivity * Math.PI * 2 + i * 1.1) * 10)));
    lineW.forEach((lw, i) => ctx.fillRect(244, 498 + i * 18, lw, 6));
    const activeLine = Math.floor(pose.screenActivity * 3) % 3;
    if (Math.sin(pose.screenActivity * Math.PI * 8) > 0) {
      ctx.fillStyle = accent;
      ctx.fillRect(244 + lineW[activeLine] + 3, 498 + activeLine * 18, 4, 6);
    }
    const deckGrad = ctx.createLinearGradient(205, 568, 205, 582);
    deckGrad.addColorStop(0, '#eef1f5');
    deckGrad.addColorStop(1, '#c9cfd9');
    ctx.fillStyle = deckGrad;
    roundRectPath(ctx, 205, 568, 190, 14, 6); ctx.fill();
  }

  // Hånd-mål per scenario — IK-en løser albuebøyen uansett (se solveIK2), ingen ny kurve-tuning
  // trengs når scenario endres. armSwing gir en liten kontinuerlig bevegelse i alle scenarioer.
  const shoulderL = { x: 240, y: 430 }, shoulderR = { x: 360, y: 430 };
  const sw = pose.armSwing * 4;
  let handL: { x: number; y: number }, handR: { x: number; y: number };
  if (scenario === 'laptop') {
    const handY = 560 - (pose.armSwing + 1) * 4;
    handL = { x: 260, y: handY }; handR = { x: 340, y: handY };
  } else if (scenario === 'phone') {
    handR = { x: 300, y: 290 + sw }; // telefon opp mot ansiktet
    handL = { x: 195, y: 500 - sw };
  } else if (scenario === 'presenter') {
    handR = { x: 435, y: 330 - sw * 2 }; // gestikulerer utover/opp — komfortabel rekkevidde, ikke for nært skulderen
    handL = { x: 195, y: 500 + sw };
  } else if (scenario === 'walk') {
    // Armene som pendler: FAST avstand fra skulderen (kun vinkelen svinger), ellers kan reach
    // bli for kort ved enkelte faser og tvinge IK-en til en ekstrem albuekrok. Høyre arm svinger
    // i takt med venstre bein (klassisk motfase-gange), og omvendt.
    const ARM_REACH = 118;
    const angleR = Math.sin(pose.legSwing * Math.PI * 2) * (20 * Math.PI / 180);
    const angleL = Math.sin(pose.legSwing * Math.PI * 2 + Math.PI) * (20 * Math.PI / 180);
    handL = { x: shoulderL.x + Math.sin(angleL) * ARM_REACH, y: shoulderL.y + Math.cos(angleL) * ARM_REACH };
    handR = { x: shoulderR.x + Math.sin(angleR) * ARM_REACH, y: shoulderR.y + Math.cos(angleR) * ARM_REACH };
  } else {
    handL = { x: 190, y: 500 + sw }; handR = { x: 410, y: 500 - sw }; // 'stand' — hender ved siden, tydelig bredere enn skuldrene
  }
  const UPPER_ARM = 78, LOWER_ARM = 82; // ~samme total rekkevidde som tidligere kurve
  const elbowL = solveArmIK(shoulderL, handL, UPPER_ARM, LOWER_ARM, 'left');
  const elbowR = solveArmIK(shoulderR, handR, UPPER_ARM, LOWER_ARM, 'right');
  ctx.strokeStyle = shirt; ctx.lineWidth = 21; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(shoulderL.x, shoulderL.y); ctx.lineTo(elbowL.x, elbowL.y); ctx.lineTo(handL.x, handL.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(shoulderR.x, shoulderR.y); ctx.lineTo(elbowR.x, elbowR.y); ctx.lineTo(handR.x, handR.y); ctx.stroke();

  const drawHand = (h: { x: number; y: number }, elbow: { x: number; y: number }): void => {
    if (scenario === 'laptop') {
      // Fingre: 3 korte strøk ned mot tastaturet, faseforskjøvet så de tapper enkeltvis, ikke i takt.
      ctx.strokeStyle = skin; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let f = 0; f < 3; f++) {
        const phase = pose.fingerTap * Math.PI * 2 + f * 1.4;
        const flex = Math.max(0, Math.sin(phase)) * 6; // 0..6, ned = tapp-trykk
        const fx = h.x + (f - 1) * 8;
        ctx.beginPath(); ctx.moveTo(fx, h.y + 5); ctx.lineTo(fx, h.y + 14 + flex); ctx.stroke();
      }
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(h.x, h.y, 15, 0, Math.PI * 2); ctx.fill();
      return;
    }
    // Andre scenarioer: håndflate + 3 fingre VIFTET UT langs faktisk arm-retning (albue→hånd),
    // ikke alltid rett ned — leser som en ekte hånd i enden av armen uansett gest/vinkel.
    const dx = h.x - elbow.x, dy = h.y - elbow.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len; // enhetsvektor utover fra albuen
    ctx.fillStyle = skin;
    ctx.save();
    ctx.translate(h.x, h.y); ctx.rotate(Math.atan2(uy, ux));
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = skin; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
    [-0.32, 0, 0.32].forEach((spread) => {
      ctx.beginPath();
      ctx.moveTo(Math.cos(spread) * 9, Math.sin(spread) * 9);
      ctx.lineTo(Math.cos(spread) * 22, Math.sin(spread) * 22);
      ctx.stroke();
    });
    ctx.restore();
  };
  drawHand(handL, elbowL);
  drawHand(handR, elbowR);
  if (scenario === 'phone') {
    // Telefon i hevet høyre hånd.
    ctx.fillStyle = '#1a1d26';
    roundRectPath(ctx, handR.x - 13, handR.y - 30, 26, 46, 6); ctx.fill();
    ctx.fillStyle = '#3a4256';
    roundRectPath(ctx, handR.x - 10, handR.y - 26, 20, 34, 3); ctx.fill();
  }

  ctx.restore();
}

/** Finner hvilken samtale-runde en person-laptop-figur er i, ut fra en chatType sin lokale
 *  klipp-progresjon (0..1, samme `localT` som drawChatType bruker) — og gir et blunk-puls rett
 *  etter runden lander + økt "oppmerksom" bryn-løft mens motparten "skriver" (dots-fasen). Ikke
 *  pixel-nøyaktig synk med boble-fasene i drawChatType — god nok tilnærming til at figuren virker
 *  til stede i samtalen istedenfor å idle uavhengig av den. */
function chatReactionAt(chat: import('./mockupStudioModel').ChatTypeConfig, localT: number): { blinkPulse: number; attentive: number } {
  const cps = CHAT_TYPE_SPEEDS[chat.speed] ?? CHAT_TYPE_SPEEDS.normal;
  const durs = chat.turns.map((turn) => chatTurnDuration(turn, cps));
  const total = durs.reduce((s, d, i) => s + d + (i > 0 ? CHAT_TURN_GAP : 0), 0) || 1;
  const sec = Math.max(0, Math.min(total, localT * total));
  let acc = 0;
  for (let i = 0; i < chat.turns.length; i++) {
    if (i > 0) acc += CHAT_TURN_GAP;
    const dur = durs[i], start = acc, end = acc + dur;
    if (sec <= end || i === chat.turns.length - 1) {
      const into = sec - start;
      const attentive = into < 0.6 ? 1 : 0; // "dots"-lengde (se chatTurnDuration) — motparten skriver
      const blinkPulse = into > dur - 0.35 && into < dur - 0.05 ? 1 : 0; // blunk rett før runden lander
      return { blinkPulse, attentive };
    }
    acc = end;
  }
  return { blinkPulse: 0, attentive: 0 };
}

/** Enkel «follow-through» uten simulerings-state: veid gjennomsnitt av gjeldende + noen tidligere
 *  prøver av samme keyframe-kurve, så store bevegelser (lene/vipp/bob) etterslenger og demper seg
 *  istedenfor å hoppe rett til keyframe-verdien. `dur` = scenens lengde i sek (for å konvertere
 *  `lagSec` til normalisert t). Brukes KUN på grov-bevegelse — ikke på blunk/munn/fingre (ville sett
 *  ut som treg respons der, ikke fysikk). */
function laggedKfv(kfs: Keyframe[] | undefined, t: number, def: number, dur: number, lagSec = 0.12): number {
  if (!kfs || kfs.length < 2) return sampleKf(kfs, t) ?? def; // ingen kurve/kun ett punkt → ingenting å etterslenge
  const dtNorm = lagSec / Math.max(0.1, dur);
  const offsets = [0, 0.35, 0.7, 1];
  const weights = [0.46, 0.28, 0.16, 0.1];
  return offsets.reduce((s, f, i) => s + (sampleKf(kfs, Math.max(0, t - f * dtNorm)) ?? def) * weights[i], 0);
}

/**
 * Chat-typing-overlay oppå et bilde-element — rendres som et EKTE
 * chat-grensesnitt (meldingsapp-bakgrunn + hode-rad m/ avatar + innkommende
 * meldingsboble), ikke rå tekst på et kort. `localT` er 0..1 progresjon
 * innafor chat-klippet (fra typeTFor / clipLocalT): prikke-boble → boble som
 * vokser mens teksten skrives tegn-for-tegn, med blinkende cursor.
 */
// Design-tokens hentet fra medside.no sitt ekte PreVisit-chat-widget (målt via
// getComputedStyle): mørk marineblå hode + utgående boble, hvitt innhold.
const CHAT_NAVY = '#1b294b';
const CHAT_NAVY_TEXT = '#f8f6f2';
const CHAT_INK = '#20242c';
const CHAT_LABEL = '#9aa0ac';

/** Mål (uten å tegne) hvor høy en boble blir for gitt tekst — for auto-scroll-layout-passet. */
function measureBubbleH(ctx: CanvasRenderingContext2D, text: string, maxW: number, fs: number, fontFamily: string, hasLabel: boolean, hasMeta = false): number {
  ctx.font = `500 ${fs}px ${fontFamily}`;
  const lh = fs * 1.4, padY = fs * 0.7, padX = fs * 0.9;
  const lines = wrapLines(ctx, text || ' ', maxW - padX * 2);
  return (hasLabel ? fs * 0.85 : 0) + lines.length * lh + padY * 2 + (hasMeta ? fs * 0.9 : 0);
}

function drawChatBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, top: number, maxW: number,
  fs: number, fontFamily: string,
  opts: { align: 'left' | 'right'; fill: string; ink: string; boxW: number; showCursor?: boolean; cursorColor?: string; label?: string; meta?: string; delivered?: boolean },
): number {
  ctx.font = `500 ${fs}px ${fontFamily}`;
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  const lh = fs * 1.4;
  const padX = fs * 0.9, padY = fs * 0.7;
  const lines = wrapLines(ctx, text || ' ', maxW - padX * 2);
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
  const bubbleW = Math.min(maxW, textW + padX * 2);
  const labelH = opts.label ? fs * 0.85 : 0;
  const bubbleH = lines.length * lh + padY * 2;
  const bx = opts.align === 'left' ? x : x + opts.boxW - bubbleW;
  if (opts.label) {
    ctx.fillStyle = CHAT_LABEL;
    ctx.font = `700 ${Math.round(fs * 0.62)}px ${fontFamily}`;
    ctx.fillText(opts.label.toUpperCase(), bx, top);
    ctx.font = `500 ${fs}px ${fontFamily}`;
  }
  roundRectPath(ctx, bx, top + labelH, bubbleW, bubbleH, Math.min(20, bubbleH * 0.32));
  ctx.fillStyle = opts.fill;
  if (opts.fill === '#ffffff') { ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; }
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = opts.ink;
  lines.forEach((l, i) => ctx.fillText(l, bx + padX, top + labelH + padY + i * lh));
  if (opts.showCursor && lines.length) {
    const last = lines[lines.length - 1];
    const lw = ctx.measureText(last).width;
    const cy = top + labelH + padY + (lines.length - 1) * lh;
    ctx.fillStyle = opts.cursorColor ?? opts.ink;
    ctx.fillRect(bx + padX + lw + 3, cy + 2, Math.max(2, fs * 0.09), fs * 1.05);
  }
  let bottom = top + labelH + bubbleH;
  // Tidsstempel (+ leveringskvittering for utgående svar) — under boblen, samme kant-justering.
  if (opts.meta) {
    const metaFs = Math.round(fs * 0.62);
    ctx.font = `500 ${metaFs}px ${fontFamily}`;
    ctx.fillStyle = CHAT_LABEL;
    ctx.textAlign = opts.align;
    const metaX = opts.align === 'left' ? bx : bx + bubbleW;
    ctx.fillText(opts.delivered ? `${opts.meta}  ·  Levert ✓✓` : opts.meta, metaX, bottom + metaFs * 0.35);
    ctx.textAlign = 'left';
    bottom += metaFs * 1.5;
  }
  return bottom;
}

type ChatPhase =
  | { mode: 'dots'; qVisible: ''; qDone: false; composeVisible: ''; sent: false }
  | { mode: 'question'; qVisible: string; qDone: boolean; composeVisible: ''; sent: false }
  | { mode: 'composing'; qVisible: string; qDone: true; composeVisible: string; sent: false }
  | { mode: 'done'; qVisible: string; qDone: true; composeVisible: ''; sent: true };

/**
 * Fase innafor ÉN runde ved lokal sekund-tid: assistent-prikker → spørsmål
 * skrives inn → (pause) → SVARET skrives inn i meldingsfeltet (ikke direkte
 * i en boble — «man skriver i et skrivefelt», som ekte chat-apper) → sendt
 * (boble med tidsstempel + leveringskvittering dukker opp).
 */
function turnPhase(turn: import('./mockupStudioModel').ChatTurn, cps: number, sec: number): ChatPhase {
  const dotsLen = 0.6;
  const qLen = Math.max(0.5, turn.question.length / cps);
  if (sec < dotsLen) return { mode: 'dots', qVisible: '', qDone: false, composeVisible: '', sent: false };
  if (sec < dotsLen + qLen) {
    const p = Math.min(1, (sec - dotsLen) / qLen);
    return { mode: 'question', qVisible: turn.question.slice(0, Math.round(turn.question.length * p)), qDone: p >= 1, composeVisible: '', sent: false };
  }
  if (!turn.reply) return { mode: 'question', qVisible: turn.question, qDone: true, composeVisible: '', sent: false };
  const pauseLen = 0.3, composeStart = dotsLen + qLen + pauseLen;
  if (sec < composeStart) return { mode: 'question', qVisible: turn.question, qDone: true, composeVisible: '', sent: false };
  const replyLen = Math.max(0.4, turn.reply.length / cps);
  if (sec < composeStart + replyLen) {
    const p = (sec - composeStart) / replyLen;
    return { mode: 'composing', qVisible: turn.question, qDone: true, composeVisible: turn.reply.slice(0, Math.round(turn.reply.length * p)), sent: false };
  }
  return { mode: 'done', qVisible: turn.question, qDone: true, composeVisible: '', sent: true };
}

/**
 * Chat-typing-overlay oppå et bilde-/enhets-element — rendres som EKTE
 * chat-UI matchet mot medside.no sitt PreVisit-widget: nettleser-vindu-chrome
 * (trafikklys + adressefelt — «det kjører i en fane»), mørk marineblå
 * app-hode, hvitt innhold, innkommende spørsmål venstre/hvit-boks m/
 * tidsstempel, utgående svar høyre/marineblå m/ leveringskvittering, OG et
 * fast meldingsfelt nederst der svaret faktisk skrives inn før det sendes
 * (boblen dukker først opp når runden er «sendt»). Spiller av `chat.turns`
 * etter hverandre — kortet auto-scroller (skyver eldre runder oppover/av) så
 * den aktive runden alltid er synlig nederst. `localT` er 0..1 progresjon
 * over HELE samtalen (fra typeTFor / clipLocalT).
 */
function drawChatType(
  ctx: CanvasRenderingContext2D,
  doc: MockupDoc,
  chat: import('./mockupStudioModel').ChatTypeConfig | undefined,
  rect: { x: number; y: number; w: number; h: number; radius: number },
  localT: number,
): void {
  if (!chat?.turns?.length) return;
  const { x, y, w, h, radius } = rect;
  const cps = CHAT_TYPE_SPEEDS[chat.speed] ?? CHAT_TYPE_SPEEDS.normal;
  const fontFamily = fontFamilyFor('body', doc.canvas);
  const accent = resolveColor('accent', doc.canvas);
  const isChat = chat.turns.some((t) => t.reply); // enveis notat-skriving trenger ikke meldingsfelt

  // Finn aktiv runde + lokal sekund-tid innafor den, fra global 0..1-progresjon.
  const durations = chat.turns.map((t) => chatTurnDuration(t, cps));
  const total = durations.reduce((a, b) => a + b, 0) + CHAT_TURN_GAP * Math.max(0, chat.turns.length - 1);
  const globalSec = localT * total;
  let acc = 0, activeIdx = chat.turns.length - 1, localSec = durations[durations.length - 1];
  for (let i = 0; i < chat.turns.length; i++) {
    if (globalSec < acc + durations[i] || i === chat.turns.length - 1) { activeIdx = i; localSec = Math.max(0, globalSec - acc); break; }
    acc += durations[i] + CHAT_TURN_GAP;
  }
  const phase = turnPhase(chat.turns[activeIdx], cps, localSec);

  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.clip();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);

  // Nettleser-vindu-chrome — trafikklys + adressefelt (viser at PreVisit kjøres i en fane, ikke en native app).
  const browserH = h * 0.075;
  ctx.fillStyle = '#eceef1';
  ctx.fillRect(x, y, w, browserH);
  const dotR = browserH * 0.11;
  ['#ff5f56', '#ffbd2e', '#27c93f'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x + w * 0.025 + i * dotR * 3, y + browserH / 2, dotR, 0, Math.PI * 2); ctx.fill();
  });
  const pillW = w * 0.42, pillH = browserH * 0.56;
  roundRectPath(ctx, x + w / 2 - pillW / 2, y + (browserH - pillH) / 2, pillW, pillH, pillH / 2);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.fillStyle = '#7a808c';
  ctx.font = `500 ${Math.round(browserH * 0.34)}px ${fontFamily}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('app.medside.no/previsit', x + w / 2, y + browserH / 2);
  ctx.textAlign = 'left';

  // App-hode-rad: mørk marineblå (medside.no sin faktiske widget-hode-farge).
  const appHeaderH = h * 0.125, headerY = y + browserH;
  ctx.fillStyle = CHAT_NAVY;
  ctx.fillRect(x, headerY, w, appHeaderH);
  const iconR = appHeaderH * 0.3;
  const iconCx = x + w * 0.07, iconCy = headerY + appHeaderH / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = CHAT_NAVY_TEXT;
  ctx.font = `700 ${Math.round(appHeaderH * 0.34)}px ${fontFamily}`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(chat.label ?? 'PreVisit-assistent', iconCx + iconR + w * 0.03, iconCy);

  // Fast meldingsfelt nederst — «man skriver i et skrivefelt» (kun for ekte fram-og-tilbake-samtaler).
  const inputH = isChat ? h * 0.115 : 0, inputY = y + h - inputH;
  if (isChat) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, inputY, w, inputH);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, inputY); ctx.lineTo(x + w, inputY); ctx.stroke();
    const inputPillH = inputH * 0.6, inputPillY = inputY + (inputH - inputPillH) / 2;
    const sendR = inputPillH * 0.62;
    const inputPillW = w - w * 0.06 * 2 - sendR * 2 - w * 0.02;
    roundRectPath(ctx, x + w * 0.06, inputPillY, inputPillW, inputPillH, inputPillH / 2);
    ctx.fillStyle = '#f0f1f4'; ctx.fill();
    const composing = phase.mode === 'composing';
    const ifs = Math.round(w * 0.03);
    ctx.font = `500 ${ifs}px ${fontFamily}`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const inputText = composing ? phase.composeVisible : 'Skriv en melding…';
    ctx.save();
    roundRectPath(ctx, x + w * 0.06, inputPillY, inputPillW, inputPillH, inputPillH / 2); ctx.clip();
    ctx.fillStyle = composing ? CHAT_INK : '#a2a8b3';
    const iPadX = ifs * 0.7;
    const itw = ctx.measureText(inputText).width;
    // Lang tekst i feltet scroller til venstre (viser slutten), som ekte input-felt.
    const drawX = itw > inputPillW - iPadX * 2 ? x + w * 0.06 + iPadX - (itw - (inputPillW - iPadX * 2)) : x + w * 0.06 + iPadX;
    ctx.fillText(inputText, drawX, inputPillY + inputPillH / 2);
    if (composing) {
      ctx.fillStyle = accent;
      ctx.fillRect(drawX + itw + 2, inputPillY + inputPillH * 0.22, Math.max(2, ifs * 0.09), inputPillH * 0.56);
    }
    ctx.restore();
    const sendCx = x + w * 0.06 + inputPillW + w * 0.02 + sendR, sendCy = inputY + inputH / 2;
    ctx.fillStyle = composing ? accent : '#d7d9de';
    ctx.beginPath(); ctx.arc(sendCx, sendCy, sendR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(sendCx - sendR * 0.28, sendCy - sendR * 0.32);
    ctx.lineTo(sendCx + sendR * 0.4, sendCy);
    ctx.lineTo(sendCx - sendR * 0.28, sendCy + sendR * 0.32);
    ctx.closePath(); ctx.fill();
  }

  const contentX = x + w * 0.06, contentW = w * 0.88;
  const contentTop = headerY + appHeaderH + h * 0.035, contentBottom = inputY - h * 0.02;
  const fs = Math.round(w * 0.032);
  const rowGap = h * 0.045, dotsH = h * 0.12;
  const baseMin = 30; // avledet tidsstempel-basis (bare visuell — ikke ekte klokke)
  const stampFor = (i: number, isReply: boolean) => `14:${String(baseMin + i * 3 + (isReply ? 1 : 0)).padStart(2, '0')}`;

  // Layout-pass (ingen tegning): høyden til alle runder t.o.m. aktiv, for auto-scroll-forskyvning.
  let stackH = 0;
  for (let i = 0; i < activeIdx; i++) {
    const t = chat.turns[i];
    stackH += measureBubbleH(ctx, t.question, contentW, fs, fontFamily, false, true) + rowGap;
    if (t.reply) stackH += measureBubbleH(ctx, t.reply, contentW, fs, fontFamily, false, true) + rowGap;
  }
  const activeQText = phase.qVisible || chat.turns[activeIdx].question;
  stackH += phase.mode === 'dots' ? dotsH : measureBubbleH(ctx, activeQText, contentW, fs, fontFamily, false, phase.qDone);
  if (phase.mode === 'done' && chat.turns[activeIdx].reply) stackH += rowGap + measureBubbleH(ctx, chat.turns[activeIdx].reply as string, contentW, fs, fontFamily, false, true);
  const visibleH = contentBottom - contentTop;
  const scrollShift = Math.max(0, stackH - visibleH);

  // Egen klipp-region for det scrollbare innholdet — uten denne kan overflow
  // (ved auto-scroll-forskyvning) males OPPÅ hode-raden i stedet for under den.
  ctx.save();
  ctx.beginPath(); ctx.rect(x, contentTop, w, contentBottom - contentTop); ctx.clip();

  // Tegne-pass: samme rekkefølge, forskjøvet opp ved overflow (auto-scroll).
  let cy = contentTop - scrollShift;
  for (let i = 0; i < activeIdx; i++) {
    const t = chat.turns[i];
    cy = drawChatBubble(ctx, t.question, contentX, cy, contentW, fs, fontFamily, { align: 'left', fill: '#ffffff', ink: CHAT_INK, boxW: contentW, meta: stampFor(i, false) }) + rowGap;
    if (t.reply) cy = drawChatBubble(ctx, t.reply, contentX, cy, contentW, fs, fontFamily, { align: 'right', fill: CHAT_NAVY, ink: CHAT_NAVY_TEXT, boxW: contentW, meta: stampFor(i, true), delivered: true }) + rowGap;
  }
  if (phase.mode === 'dots') {
    const p = localSec / 0.6;
    const bw = w * 0.22;
    roundRectPath(ctx, contentX, cy, bw, dotsH, dotsH / 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    const dR = dotsH * 0.13, dcy = cy + dotsH / 2;
    for (let i = 0; i < 3; i++) {
      const bounce = Math.abs(Math.sin(p * Math.PI * 3 + i * 0.6));
      ctx.fillStyle = `rgba(42,47,58,${0.35 + bounce * 0.5})`;
      ctx.beginPath(); ctx.arc(contentX + bw * 0.28 + i * dR * 3.4, dcy - bounce * dR, dR, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    cy = drawChatBubble(ctx, activeQText, contentX, cy, contentW, fs, fontFamily, {
      align: 'left', fill: '#ffffff', ink: CHAT_INK, boxW: contentW, showCursor: !phase.qDone, cursorColor: accent,
      meta: phase.qDone ? stampFor(activeIdx, false) : undefined,
    });
    if (phase.mode === 'done' && chat.turns[activeIdx].reply) {
      cy += rowGap;
      drawChatBubble(ctx, chat.turns[activeIdx].reply as string, contentX, cy, contentW, fs, fontFamily, {
        align: 'right', fill: CHAT_NAVY, ink: CHAT_NAVY_TEXT, boxW: contentW, meta: stampFor(activeIdx, true), delivered: true,
      });
    }
  }
  ctx.restore(); // scrollbar-klipp
  ctx.restore(); // kort-klipp
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
export function annRect(doc: MockupDoc, a: MockupAnnotation): { x: number; y: number; w: number; h: number } {
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

/** Enkel hjørne-badge: mørk avrundet firkant m/ hvitt tall — IKKE en pekende
 *  chip (se drawCallout) — for kampanje-sekvensnummerering (1/2/3…) i et fast hjørne. */
function drawStepBadge(ctx: CanvasRenderingContext2D, doc: MockupDoc, a: MockupAnnotation): void {
  const W = doc.canvas.w;
  const size = Math.max(40, W * 0.052) * (a.scale ?? 1);
  const x = a.fx * W, y = a.fy * doc.canvas.h;
  const r = size * 0.22;
  ctx.save();
  ctx.shadowColor = 'rgba(15,20,30,0.28)'; ctx.shadowBlur = W * 0.014; ctx.shadowOffsetY = W * 0.004;
  ctx.fillStyle = a.color ?? doc.canvas.accent;
  roundRectPath(ctx, x, y, size, size, r);
  ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(size * 0.5)}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(String(a.n ?? 1), x + size / 2, y + size / 2 + 1);
  ctx.restore();
}

/** Prikket forbindelseslinje m/ glødende punkt — kobler visuelt to elementer
 *  (t.d. foto → UI-kort) mellom (fx,fy) og (fx2,fy2). `curve` (annotasjonens
 *  eget felt, redigerbart i UI) bøyer linjen sidelengs i stedet for en rett strek. */
function drawConnectorLine(ctx: CanvasRenderingContext2D, doc: MockupDoc, a: MockupAnnotation): void {
  const W = doc.canvas.w;
  const { x1, y1, x2, y2 } = resolveConnectorEndpoints(doc, a);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  // Kontrollpunkt forskjøvet VINKELRETT på linjen (ikke bare sidelengs i X) —
  // gir en naturlig bue uansett linjens helning.
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const bend = (a.curve ?? 0) * W;
  const cx = mx + nx * bend, cy = my + ny * bend;
  const sc = a.scale ?? 1;
  const col = a.color ?? doc.canvas.accent2;
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1.5, W * 0.0018) * sc;
  ctx.setLineDash([W * 0.007 * sc, W * 0.009 * sc]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
  ctx.setLineDash([]);
  const dotR = Math.max(3, W * 0.006) * sc;
  // Glød-punktet sitter PÅ kurven (bezier-midtpunkt ved t=0.5), ikke på den rette linja.
  const qx = 0.25 * x1 + 0.5 * cx + 0.25 * x2, qy = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
  const glow = ctx.createRadialGradient(qx, qy, 0, qx, qy, dotR * 3.2);
  glow.addColorStop(0, col); glow.addColorStop(1, hexToRgba(col, 0));
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(qx, qy, dotR * 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(qx, qy, dotR, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Hvit pill m/ ikon-sirkel (unicode-glyph) + fet tittel + grå undertekst —
 *  «Pasienten fyller ut — hjemme i ro og fred»-stil bunn-callout. Sentrert på (fx,fy). */
function drawIconPill(ctx: CanvasRenderingContext2D, doc: MockupDoc, a: MockupAnnotation, t?: number): void {
  const W = doc.canvas.w;
  const cx = a.fx * W, cy = a.fy * doc.canvas.h;
  const iconR = Math.max(16, W * 0.021);
  const pad = W * 0.016;
  const titleFont = `700 ${Math.round(W * 0.0165)}px -apple-system, system-ui, sans-serif`;
  const subFont = `500 ${Math.round(W * 0.0135)}px -apple-system, system-ui, sans-serif`;
  ctx.save();
  ctx.font = titleFont;
  const titleW = ctx.measureText(a.label ?? '').width;
  ctx.font = subFont;
  const subW = ctx.measureText(a.label2 ?? '').width;
  const textW = Math.max(titleW, subW);
  const h = iconR * 2 + pad * 1.1;
  const w = iconR * 2 + pad * 2.6 + textW;
  const x = cx - w / 2, y = cy - h / 2;
  // pille-bunn m/ myk skygge
  ctx.shadowColor = 'rgba(20,30,45,0.16)'; ctx.shadowBlur = W * 0.012; ctx.shadowOffsetY = W * 0.003;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // ikon-sirkel
  const icx = x + pad * 0.9 + iconR;
  ctx.fillStyle = doc.canvas.accent;
  ctx.beginPath(); ctx.arc(icx, cy, iconR, 0, Math.PI * 2); ctx.fill();
  if (isIconId(a.glyph)) {
    const pulse = a.glyphPulse ? 1 + 0.14 * Math.sin((t ?? 0) * Math.PI * 6) : 1;
    drawIcon(ctx, a.glyph, icx, cy, iconR * 0.62 * pulse, a.glyphColor ?? '#ffffff');
  } else {
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(iconR * 1.15)}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(a.glyph ?? '✓', icx, cy + iconR * 0.05);
  }
  // tekst
  const tx = icx + iconR + pad * 0.9;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1e2733';
  ctx.font = titleFont;
  ctx.fillText(a.label ?? '', tx, cy - (a.label2 ? h * 0.16 : 0));
  if (a.label2) {
    ctx.fillStyle = '#6b7280';
    ctx.font = subFont;
    ctx.fillText(a.label2, tx, cy + h * 0.2);
  }
  ctx.restore();
}

/** Live-tegnet steg-rad for et PreVisit-kort med `cardContent.animateSteps` — steg-raden er da
 *  IKKE bakt inn i SVG-en (previsitUiCardImage hopper over den), og tegnes her i stedet, slik at
 *  hvert steg kan poppe inn étt-og-étt langs animasjons-tidslinjen («flow») via samme reveal-motor
 *  som callouts (revealFor('callout', ...) — sekvensiell stagger, gjenbrukt fremfor ny RevealKind).
 *  Geometrien speiler previsitUiCardImage sin 600px-brede steg-rad, skalert til kortets faktiske
 *  bredde på lerretet. Kalles uansett om t er satt (statisk visning = full avsløring, som annotations). */
function drawCardSteps(ctx: CanvasRenderingContext2D, doc: MockupDoc, im: MockupImageSlot, t?: number): void {
  const content = im.cardContent;
  if (!content?.animateSteps || content.steps.length === 0) return;
  const sf = im.w / 600;
  const n = content.steps.length;
  const margin = 76, usable = 600 - margin * 2;
  const cy = im.y + 150 * sf;
  const points = content.steps.map((s, i) => ({ ...s, cx: im.x + (n === 1 ? 300 : margin + (usable * i) / (n - 1)) * sf }));
  const navy = doc.canvas.accent, gold = doc.canvas.accent2;
  ctx.save();
  points.slice(0, -1).forEach((s, i) => {
    const next = points[i + 1];
    ctx.strokeStyle = s.state === 'done' ? navy : '#d1d5db';
    ctx.lineWidth = Math.max(1, 2 * sf);
    ctx.beginPath(); ctx.moveTo(s.cx + 15 * sf, cy); ctx.lineTo(next.cx - 15 * sf, cy); ctx.stroke();
  });
  points.forEach((s, i) => {
    const rev = t != null ? revealFor('callout', i, n, t) : null;
    withReveal(ctx, rev, s.cx, cy, () => {
      if (isIconId(s.icon)) {
        ctx.fillStyle = hexToRgba(s.iconColor ?? navy, 0.1);
        ctx.beginPath(); ctx.arc(s.cx, cy, 15 * sf, 0, Math.PI * 2); ctx.fill();
        const pulse = s.iconPulse ? 1 + 0.14 * Math.sin((t ?? 0) * Math.PI * 6) : 1;
        drawIcon(ctx, s.icon!, s.cx, cy, 10 * sf * pulse, s.iconColor ?? navy);
      } else {
        const fill = s.state === 'todo' ? '#ffffff' : s.state === 'active' ? gold : navy;
        ctx.fillStyle = fill; ctx.strokeStyle = s.state === 'todo' ? '#d1d5db' : fill; ctx.lineWidth = Math.max(1, 2 * sf);
        ctx.beginPath(); ctx.arc(s.cx, cy, 15 * sf, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (s.state === 'done') {
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, 3 * sf); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(s.cx - 6 * sf, cy + 5 * sf); ctx.lineTo(s.cx - 1 * sf, cy + 10 * sf); ctx.lineTo(s.cx + 8 * sf, cy - 5 * sf); ctx.stroke();
        }
      }
      ctx.fillStyle = '#6b7280'; ctx.font = `${13 * sf}px -apple-system, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(s.label, s.cx, cy + 32 * sf);
    });
  });
  ctx.restore();
}

/** Live-tegnet rad-liste for et «info-rader»-kort (im.infoCardContent.animateRows) — samme
 *  flyt-mønster som drawCardSteps: bakes ikke inn i SVG-en, poppes inn étt-og-étt via reveal.
 *  highlightRow (om satt) er siste element i sekvensen. Geometri speiler previsitInfoCardImage. */
function drawInfoCardRows(ctx: CanvasRenderingContext2D, doc: MockupDoc, im: MockupImageSlot, t?: number): void {
  const content = im.infoCardContent;
  if (!content?.animateRows || content.rows.length === 0) return;
  const sf = im.w / 600;
  const headerH = 84, rowH = 78, highlightH = content.highlightRow ? 64 : 0;
  const total = content.rows.length + (content.highlightRow ? 1 : 0);
  const navy = doc.canvas.accent, gold = doc.canvas.accent2;
  ctx.save();
  let y = im.y + headerH * sf;
  content.rows.forEach((r, i) => {
    const cy = y + (rowH * sf) / 2 - 6 * sf;
    const rev = t != null ? revealFor('callout', i, total, t) : null;
    withReveal(ctx, rev, im.x + im.w / 2, cy, () => {
      ctx.fillStyle = hexToRgba(navy, 0.1);
      ctx.beginPath(); ctx.arc(im.x + 46 * sf, cy, 19 * sf, 0, Math.PI * 2); ctx.fill();
      if (isIconId(r.icon)) {
        const pulse = r.iconPulse ? 1 + 0.14 * Math.sin((t ?? 0) * Math.PI * 6) : 1;
        drawIcon(ctx, r.icon, im.x + 46 * sf, cy, 11 * sf * pulse, r.iconColor ?? navy);
      } else {
        ctx.fillStyle = '#171a1f'; // fillStyle over var fortsatt satt til den svake sirkel-bakgrunnen — usynlig emoji ellers
        ctx.font = `${18 * sf}px -apple-system, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(r.icon, im.x + 46 * sf, cy + 1 * sf);
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#8a8f98'; ctx.font = `${13 * sf}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(r.label, im.x + 80 * sf, cy - 6 * sf);
      ctx.fillStyle = '#171a1f';
      ctx.font = `${r.quote ? 'italic ' : ''}${r.quote ? 400 : 600} ${(r.quote ? 15 : 17) * sf}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(r.quote ? `„${r.value}"` : r.value, im.x + 80 * sf, cy + 16 * sf);
    });
    ctx.strokeStyle = '#eef0f3'; ctx.lineWidth = Math.max(1, sf);
    ctx.beginPath(); ctx.moveTo(im.x, y + rowH * sf - sf); ctx.lineTo(im.x + im.w, y + rowH * sf - sf); ctx.stroke();
    y += rowH * sf;
  });
  if (content.highlightRow) {
    const hr = content.highlightRow;
    const cy = y + (highlightH * sf) / 2;
    const rev = t != null ? revealFor('callout', content.rows.length, total, t) : null;
    withReveal(ctx, rev, im.x + im.w / 2, cy, () => {
      ctx.fillStyle = hexToRgba(gold, 0.14);
      roundRectPath(ctx, im.x + 24 * sf, y + 8 * sf, im.w - 48 * sf, highlightH * sf - 16 * sf, 14 * sf); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      if (isIconId(hr.icon)) {
        const pulse = hr.iconPulse ? 1 + 0.14 * Math.sin((t ?? 0) * Math.PI * 6) : 1;
        drawIcon(ctx, hr.icon, im.x + 52 * sf, cy + 1 * sf, 9 * sf * pulse, hr.iconColor ?? navy);
      } else {
        ctx.font = `${17 * sf}px -apple-system, system-ui, sans-serif`; ctx.fillStyle = '#000';
        ctx.fillText(hr.icon, im.x + 52 * sf, cy + 6 * sf);
      }
      ctx.fillStyle = navy; ctx.font = `700 ${16 * sf}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(hr.label, im.x + 80 * sf, cy + 6 * sf);
    });
  }
  ctx.restore();
}

/** Live-tegnet rad-liste for et «skjema-liste»-kort (im.formListContent.animateRows) —
 *  samme flyt-mønster som drawInfoCardRows/drawCardSteps. Geometri speiler previsitFormListCardImage. */
function drawFormListRows(ctx: CanvasRenderingContext2D, doc: MockupDoc, im: MockupImageSlot, t?: number): void {
  const content = im.formListContent;
  if (!content?.animateRows || content.fields.length === 0) return;
  const sf = im.w / 600;
  const headerH = 84, rowH = 76;
  const n = content.fields.length;
  ctx.save();
  let y = im.y + headerH * sf;
  content.fields.forEach((f, i) => {
    const cy = y + (rowH * sf) / 2 - 4 * sf;
    const rev = t != null ? revealFor('callout', i, n, t) : null;
    withReveal(ctx, rev, im.x + im.w / 2, cy, () => {
      const hasIcon = isIconId(f.icon);
      const tx = hasIcon ? 76 * sf : 40 * sf;
      if (hasIcon) {
        ctx.fillStyle = hexToRgba(doc.canvas.accent, 0.1);
        ctx.beginPath(); ctx.arc(im.x + 40 * sf, cy + 5 * sf, 18 * sf, 0, Math.PI * 2); ctx.fill();
        const pulse = f.iconPulse ? 1 + 0.14 * Math.sin((t ?? 0) * Math.PI * 6) : 1;
        drawIcon(ctx, f.icon!, im.x + 40 * sf, cy + 5 * sf, 10 * sf * pulse, f.iconColor ?? doc.canvas.accent);
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#171a1f'; ctx.font = `600 ${17 * sf}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(f.q, im.x + tx, cy - 6 * sf);
      ctx.fillStyle = '#8a8f98'; ctx.font = `${13 * sf}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(f.sub, im.x + tx, cy + 16 * sf);
      ctx.fillStyle = doc.canvas.accent2; ctx.font = `${20 * sf}px -apple-system, system-ui, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('›', im.x + im.w - 36 * sf, cy + 6 * sf);
    });
    ctx.strokeStyle = '#eef0f3'; ctx.lineWidth = Math.max(1, sf);
    ctx.beginPath(); ctx.moveTo(im.x, y + rowH * sf - sf); ctx.lineTo(im.x + im.w, y + rowH * sf - sf); ctx.stroke();
    y += rowH * sf;
  });
  ctx.restore();
}

/** Samme crop+skalering som drawFitted() sin 'cover'-gren (senter-fokus), men returnerer
 *  transform-parametre i stedet for å tegne — slik at enhets-skjerm-overlays (checklist/
 *  dashboard) kan plassere elementer PRESIS der den bakte SVG-en faktisk endte opp etter
 *  cover-beskjæringen inn i skjerm-hullet. srcW/srcH = kilde-SVG-ens egen piksel-str. */
function coverFit(srcW: number, srcH: number, dw: number, dh: number): { sx: number; sy: number; scale: number } {
  const targetAspect = dw / dh, imgAspect = srcW / srcH;
  let cropW = srcW, cropH = srcH, sx = 0, sy = 0;
  if (imgAspect > targetAspect) { cropW = Math.round(srcH * targetAspect); sx = Math.round((srcW - cropW) * 0.5); }
  else { cropH = Math.round(srcW / targetAspect); sy = Math.round((srcH - cropH) * 0.5); }
  return { sx, sy, scale: dw / cropW };
}

/** Live-tegnet sjekkliste for telefon-skjermen (dev.checklistContent.animate) — samme
 *  flyt-mønster som drawCardSteps. Geometri speiler previsitPhoneScreenImage nøyaktig,
 *  mappet gjennom coverFit() siden skjermbildet cover-beskjæres inn i telefon-rammens hull. */
function drawDeviceChecklist(ctx: CanvasRenderingContext2D, doc: MockupDoc, dev: MockupDeviceSlot, screen: { x: number; y: number; w: number; h: number }, t?: number): void {
  const content = dev.checklistContent;
  if (!content?.animate || content.items.length === 0) return;
  const srcW = PREVISIT_SCREEN_W.phone, srcH = 1160;
  const { sx, sy, scale } = coverFit(srcW, srcH, screen.w, screen.h);
  const lx = (localX: number) => screen.x + (localX - sx) * scale;
  const ly = (localY: number) => screen.y + (localY - sy) * scale;
  const primary = doc.canvas.accent;
  const n = content.items.length;
  ctx.save();
  roundRectPath(ctx, screen.x, screen.y, screen.w, screen.h, 0); ctx.clip();
  content.items.forEach((it, i) => {
    const y = 210 + i * 84;
    const cx = lx(34), cy = ly(y);
    const rev = t != null ? revealFor('callout', i, n, t) : null;
    withReveal(ctx, rev, cx, cy, () => {
      if (isIconId(it.icon)) {
        ctx.fillStyle = hexToRgba(primary, 0.1);
        ctx.beginPath(); ctx.arc(cx, cy, 15 * scale, 0, Math.PI * 2); ctx.fill();
        const pulse = it.iconPulse ? 1 + 0.14 * Math.sin((t ?? 0) * Math.PI * 6) : 1;
        drawIcon(ctx, it.icon!, cx, cy, 10 * scale * pulse, it.iconColor ?? primary);
      } else {
        const fill = it.done ? primary : '#ffffff';
        ctx.fillStyle = fill; ctx.strokeStyle = it.done ? primary : '#d1d5db'; ctx.lineWidth = Math.max(1, 2 * scale);
        ctx.beginPath(); ctx.arc(cx, cy, 15 * scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (it.done) {
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, 3 * scale); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(lx(28), ly(y + 5)); ctx.lineTo(lx(33), ly(y + 10)); ctx.lineTo(lx(42), ly(y - 5)); ctx.stroke();
        }
      }
      ctx.fillStyle = it.done ? '#171a1f' : '#9aa0a8'; ctx.font = `${it.done ? 600 : 500} ${17 * scale}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(it.label, lx(64), ly(y + 6));
    });
  });
  ctx.restore();
}

/** Live-tegnet felt-grid for laptop-dashboardet (dev.dashboardContent.animate) — samme
 *  flyt-mønster. Geometri speiler previsitDashboardScreenImage, mappet via coverFit(). */
function drawDeviceDashboard(ctx: CanvasRenderingContext2D, _doc: MockupDoc, dev: MockupDeviceSlot, screen: { x: number; y: number; w: number; h: number }, t?: number): void {
  const content = dev.dashboardContent;
  if (!content?.animate || content.fields.length === 0) return;
  const srcW = PREVISIT_SCREEN_W.dashboard, srcH = 620;
  const { sx, sy, scale } = coverFit(srcW, srcH, screen.w, screen.h);
  const lx = (localX: number) => screen.x + (localX - sx) * scale;
  const ly = (localY: number) => screen.y + (localY - sy) * scale;
  const n = content.fields.length;
  const col = (i: number) => (i % 2 === 0 ? 40 : 460);
  const row = (i: number) => 210 + Math.floor(i / 2) * 130;
  ctx.save();
  roundRectPath(ctx, screen.x, screen.y, screen.w, screen.h, 0); ctx.clip();
  content.fields.forEach((f, i) => {
    const cx = lx(col(i)), cy = ly(row(i));
    const rev = t != null ? revealFor('callout', i, n, t) : null;
    withReveal(ctx, rev, cx, cy, () => {
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#8a8f98'; ctx.font = `${14 * scale}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(f.label, cx, cy);
      ctx.fillStyle = '#171a1f'; ctx.font = `600 ${17 * scale}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(f.value, cx, ly(row(i) + 26));
    });
  });
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
  const connectors = anns.filter((a) => a.kind === 'connector');
  const steps = anns.filter((a) => a.kind === 'step');
  const pills = anns.filter((a) => a.kind === 'pill');
  // Rekkefølge: connector først (linje under kortene den kobler), så badge/pills øverst.
  connectors.forEach((a) => drawConnectorLine(ctx, doc, a));
  markers.forEach((a, i) => { const c = annCenter(doc, a); withReveal(ctx, a.noReveal || t == null ? null : revealFor('marker', i, markers.length, t), c.x, c.y, () => drawMarker(ctx, doc, a)); });
  callouts.forEach((a, i) => { const c = annCenter(doc, a); withReveal(ctx, a.noReveal || t == null ? null : revealFor('callout', i, callouts.length, t), c.x, c.y, () => drawCallout(ctx, doc, a)); });
  loupes.forEach((a, i) => { const lx = (a.lensX ?? 0.86) * doc.canvas.w, ly = (a.lensY ?? 0.82) * doc.canvas.h; withReveal(ctx, a.noReveal || t == null ? null : revealFor('loupe', i, loupes.length, t), lx, ly, () => drawLoupe(ctx, doc, a, scale, sampleSource)); });
  steps.forEach((a) => drawStepBadge(ctx, doc, a));
  pills.forEach((a) => drawIconPill(ctx, doc, a, t));
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
/** Warmth-grade post-pass (device-piksler, upåvirket av push-in/scale): varm glød + løft. */
function applyWarmth(ctx: CanvasRenderingContext2D, canvasEl: HTMLCanvasElement, warmth?: number): void {
  if (!warmth) return;
  const W = canvasEl.width, H = canvasEl.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'soft-light';       // varm glød (ost glinser, skorpe gløder)
  ctx.globalAlpha = Math.min(0.6, warmth * 0.55);
  ctx.fillStyle = '#ff8a2b'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'multiply';          // svært lett varme i skyggene
  ctx.globalAlpha = Math.min(0.18, warmth * 0.16);
  ctx.fillStyle = '#fff0dd'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export async function rasterizeMockup(doc: MockupDoc, scale = 1, opts?: { skipAnnotations?: boolean; anim?: { t: number }; transparent?: boolean; videoTime?: number }): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(doc.canvas.w * scale);
  canvas.height = Math.round(doc.canvas.h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  const t = opts?.anim?.t;
  // Global kamera-transform under avspilling: push-in (jevn zoom) + zoom-punch (beat-puls).
  if (t != null && (doc.canvas.pushIn || (doc.canvas.beatPunch && doc.canvas.bpm))) {
    let z = 1;
    if (doc.canvas.pushIn) z *= 1 + doc.canvas.pushIn * 0.12 * Math.min(1, t);
    if (doc.canvas.beatPunch && doc.canvas.bpm) {
      const dur = deriveTimeline(doc).duration || 4;
      const bp = 60 / doc.canvas.bpm;                 // sekunder per beat
      const ph = ((t * dur) % bp) / bp;               // fase 0..1 innad i beat
      const pulse = ph < 0.18 ? 1 - ph / 0.18 : 0;    // skarp puls rett etter beat, avtar
      z *= 1 + doc.canvas.beatPunch * 0.08 * pulse;
    }
    ctx.translate(doc.canvas.w / 2, doc.canvas.h / 2); ctx.scale(z, z); ctx.translate(-doc.canvas.w / 2, -doc.canvas.h / 2);
  }
  // Multi-spor timeline: hvert elements skrive-klipp gir sin egen lokale t
  // (klippene styrer timing uavhengig). Null når statisk (ingen animasjon).
  const tl = t != null ? deriveTimeline(doc) : null;
  const typeTFor = (ref: string): number | undefined =>
    tl ? (clipLocalT(tl, ref, 'type', t as number) ?? undefined) : (t ?? undefined);
  // Reveal per-klipp om timelinen har et reveal-klipp for elementet; ellers global stagger.
  const revealOf = (ref: string, kind: 'device' | 'text' | 'image', i: number, total: number, noReveal?: boolean): Reveal | null => {
    if (noReveal) return null; // «Ikke animer» — alltid fullt synlig, uansett avspillings-t
    if (t == null) return null;
    if (tl) { const lt = clipLocalT(tl, ref, 'reveal', t); if (lt != null) return revealFromLocal(kind, lt); }
    return revealFor(kind, i, total, t);
  };

  if (!opts?.transparent) {
    fillBackground(ctx, doc);
    await drawBgImage(ctx, doc);
    drawDecor(ctx, doc);
  }

  // Lifestyle-scene-modus: fotografisk scene + warpet skjermbilde (tekst/logo over).
  if (doc.canvas.scene?.id) {
    await drawScene(ctx, doc, doc.canvas.scene?.typeAnim?.text ? typeTFor('scene') : (t ?? undefined));
    doc.texts.forEach((tx) => drawText(ctx, doc, tx));
    await drawLogo(ctx, doc.canvas);
    if (!opts?.skipAnnotations) drawAnnotations(ctx, doc, scale, canvas, t);
    applyWarmth(ctx, canvas, doc.canvas.warmth);
    return canvas;
  }

  // Mind map-modus: lerretet ER en produkt-mind map (ingen enheter/tekst).
  if (doc.mindmap && doc.mindmap.trim()) {
    const rev = t != null ? revealFor('mindmap', 0, 1, t) : null;
    withReveal(ctx, rev, doc.canvas.w / 2, doc.canvas.h * 0.52, () => drawMindmap(ctx, doc));
    await drawLogo(ctx, doc.canvas);
    applyWarmth(ctx, canvas, doc.canvas.warmth);
    return canvas;
  }

  // Frittstående bilde-elementer (bak enheter/tekst) — med stagger-reveal når animert.
  if (doc.images?.length) {
    // Auto-reaksjon: finn EN chatType i scenen (enhet foretrekkes) som person-laptop-figurer kan
    // «reagere på» (blunk rett etter runden lander, mer oppmerksom mens motparten skriver) —
    // helt automatisk, ingen kobling å sette opp manuelt.
    const chatSourceDev = doc.devices.find((d) => d.chatType?.turns?.length);
    const chatSourceImg = !chatSourceDev ? doc.images.find((im) => im.chatType?.turns?.length) : undefined;
    const chatSource = chatSourceDev ?? chatSourceImg;
    // Bakgrunner tegnes ALLTID først uansett plassering i doc.images — en bakgrunn som havner sist
    // i lista (f.eks. lagt til etter personene) skal likevel ligge bak dem visuelt.
    const isBackdropIllustration = (v: MockupImageSlot['illustration']): boolean => v === 'office-backdrop' || v === 'waiting-room-backdrop';
    const drawOrder = doc.images
      .map((im, i) => ({ im, i }))
      .sort((a, b) => (isBackdropIllustration(a.im.illustration) ? 0 : 1) - (isBackdropIllustration(b.im.illustration) ? 0 : 1));
    for (const { im: im0, i } of drawOrder) {
      const rev = revealOf(im0.id, 'image', i, doc.images.length, im0.noReveal);
      if (rev && rev.alpha <= 0.001) continue;
      // Keyframe-kurver (samme motor som enhetenes 3D-rotasjon, se sampleKf) — x/y/rotation/scale
      // faller tilbake på 0/0/0/1 (ingen endring) når elementet ikke har en kurve for egenskapen.
      const kfv = (prop: string, def: number): number => (im0.kf && t != null ? (sampleKf(im0.kf[prop], t) ?? def) : def);
      const kScale = kfv('scale', 1);
      const im: MockupImageSlot = {
        ...im0,
        x: im0.x + kfv('x', 0) - (im0.w * kScale - im0.w) / 2,
        y: im0.y + kfv('y', 0) - (im0.h * kScale - im0.h) / 2,
        w: im0.w * kScale,
        h: im0.h * kScale,
        rotation: im0.rotation + kfv('rotation', 0),
      };
      const kOpacity = kfv('opacity', 1);
      ctx.save();
      ctx.globalAlpha *= kOpacity;
      if (isBackdropIllustration(im.illustration)) {
        const drawFn = im.illustration === 'waiting-room-backdrop' ? drawWaitingRoomBackdrop : drawOfficeBackdrop;
        if (rev) withReveal(ctx, rev, im.x + im.w / 2, im.y + im.h / 2, () => drawFn(ctx, im.x, im.y, im.w, im.h));
        else drawFn(ctx, im.x, im.y, im.w, im.h);
        ctx.restore();
        continue;
      }
      if (im.illustration === 'person-laptop') {
        // Idle-fallback (ingen manuell keyframe-kurve): kontinuerlig skrive-loop drevet av videoTime,
        // så eksport ser levende ut «gratis» — kurvene i inspektøren overstyrer per egenskap.
        const vt = opts?.videoTime ?? 0;
        const reaction = chatSource?.chatType && t != null ? chatReactionAt(chatSource.chatType, typeTFor(chatSource.id) ?? 0) : null;
        // laggedKfv gir grov-bevegelse (lene/vipp/bob) et lite etterslep/demping (follow-through) —
        // KUN når egenskapen faktisk har en flerpunkts-kurve; ellers uendret idle-oppførsel.
        const dur = tl?.duration ?? 4;
        const kfvLag = (prop: keyof PersonRigPose, def: number): number =>
          im0.kf && t != null ? laggedKfv(im0.kf[prop], t, def, dur) : def;
        const pose: PersonRigPose = {
          armSwing: kfv('armSwing', Math.sin(vt * Math.PI * 2 * 1.6)),
          fingerTap: kfv('fingerTap', (vt * 2.2) % 1),
          screenActivity: kfv('screenActivity', (vt * 0.5) % 1),
          blink: kfv('blink', reaction?.blinkPulse ? 1 : ((vt * 0.33) % 3) < 0.12 ? 1 : 0),
          headTilt: kfvLag('headTilt', 0),
          mouthCurve: kfv('mouthCurve', 1),
          eyeSize: kfv('eyeSize', 1),
          bodyBob: kfvLag('bodyBob', Math.sin(vt * Math.PI * 2 * 0.35) * 2),
          leanX: kfvLag('leanX', 0),
          browRaise: kfv('browRaise', reaction?.attentive ? 0.4 : 0),
          tears: kfv('tears', 0),
          legSwing: kfv('legSwing', (vt * 0.9) % 1), // kontinuerlig gange-syklus i eksport, uten manuell keyframe
        };
        if (rev) withReveal(ctx, rev, im.x + im.w / 2, im.y + im.h / 2, () => drawPersonLaptop(ctx, im.x, im.y, im.w, im.h, pose, im.personStyle));
        else drawPersonLaptop(ctx, im.x, im.y, im.w, im.h, pose, im.personStyle);
        ctx.restore();
        continue;
      }
      let source: CanvasImageSource | null = null, sw = 0, sh = 0;
      // Sprite-sekvens (ekte 3D-render eksportert som frame-PNG-er): bytter ramme kun under
      // videoeksport (opts.videoTime), samme mønster som Seedance-video rett under.
      if (im.sprite?.frames?.length) {
        const idx = opts?.videoTime != null ? Math.floor(opts.videoTime * im.sprite.fps) % im.sprite.frames.length : 0;
        try { const img = await loadImage(im.sprite.frames[idx]); source = img; sw = img.naturalWidth; sh = img.naturalHeight; } catch { source = null; }
      }
      // Compositing: Seedance-klipp-frame ved eksport (opts.videoTime); ellers poster-bilde.
      if (!source && opts?.videoTime != null && im.video) {
        try { const v = await loadVideo(im.video); await seekVideo(v, opts.videoTime); source = v; sw = v.videoWidth; sh = v.videoHeight; } catch { source = null; }
      }
      if (!source) {
        const img = await loadImage(im.image).catch(() => null);
        if (!img) { ctx.restore(); continue; }
        source = img; sw = img.naturalWidth; sh = img.naturalHeight;
      }
      const src = source, cw = sw, ch = sh;
      if (rev) withReveal(ctx, rev, im.x + im.w / 2, im.y + im.h / 2, () => drawImageSlot(ctx, im, src, cw, ch));
      else drawImageSlot(ctx, im, src, cw, ch);
      if (im.chatType?.turns?.length && (!rev || rev.alpha > 0.7)) {
        drawChatType(ctx, doc, im.chatType, { x: im.x, y: im.y, w: im.w, h: im.h, radius: im.radius }, typeTFor(im.id) ?? 1);
      }
      if (im.cardContent?.animateSteps) drawCardSteps(ctx, doc, im, t);
      if (im.infoCardContent?.animateRows) drawInfoCardRows(ctx, doc, im, t);
      if (im.formListContent?.animateRows) drawFormListRows(ctx, doc, im, t);
      ctx.restore();
    }
  }

  // Enheter i dokument-rekkefølge (senere = øverst), animert avsløring om t satt.
  for (let i = 0; i < doc.devices.length; i++) {
    const dev = doc.devices[i];
    const rev = revealOf(dev.id, 'device', i, doc.devices.length, dev.noReveal);
    if (rev && rev.alpha <= 0.001) continue;
    ctx.save();
    if (rev) {
      const cx = dev.x + dev.w / 2, cy = dev.y + deviceHeight(dev) / 2;
      ctx.globalAlpha *= rev.alpha;
      ctx.translate(cx, cy + rev.ty); ctx.scale(rev.scale, rev.scale); ctx.translate(-cx, -cy);
    }
    await drawDevice(ctx, doc, dev, dev.typeAnim?.text ? typeTFor(dev.id) : (t ?? undefined), t ?? undefined);
    if (dev.chatType?.turns?.length && (!rev || rev.alpha > 0.7)) {
      const sr = deviceScreenRect(dev);
      const radius = ((DEVICE_FRAMES as Record<string, { radius: number }>)[dev.variant]?.radius ?? 0.04) * dev.w;
      drawChatType(ctx, doc, dev.chatType, { ...sr, radius }, typeTFor(dev.id) ?? 1);
    }
    ctx.restore();
  }
  doc.texts.forEach((tx, i) => {
    const rev = revealOf(tx.id, 'text', i, doc.texts.length, tx.noReveal);
    // Pris-count-up: tall teller 0→pris under reveal (kun genArrange-labels m/ synlig numerisk pris).
    let drawTx = tx;
    if (t != null && tx.genArrange && tx.baseText != null && tx.priceText && /^\d+$/.test(tx.priceText) && tx.text.endsWith(tx.priceText)) {
      const prog = rev ? rev.p : 1;
      drawTx = { ...tx, text: `${tx.baseText} · ${Math.round(Number(tx.priceText) * prog)}` };
    }
    withReveal(ctx, rev, tx.x + tx.w / 2, tx.y + measureTextHeight(tx) / 2, () => drawText(ctx, doc, drawTx));
  });
  await drawLogo(ctx, doc.canvas);
  if (!opts?.skipAnnotations) drawAnnotations(ctx, doc, scale, canvas, t);
  applyWarmth(ctx, canvas, doc.canvas.warmth);
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
  // Eksporten ærer inn/ut-regionen: 0..1-progresjonen mappes til [in, out].
  const _tl = deriveTimeline(doc);
  const iv = _tl.in ?? 0, ov = _tl.out ?? 1;
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < total; f++) {
    const prog = f / (total - 1);
    const raw = prog <= 1 - hold ? prog / (1 - hold) : 1;
    const t = iv + raw * (ov - iv);
    // Seedance-klipp komposittes: hver frame ved reel-tid f/fps sek (loopes over klipp-lengden).
    frames.push(await rasterizeMockup(doc, scale, { anim: { t }, videoTime: f / cfg.fps }));
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
