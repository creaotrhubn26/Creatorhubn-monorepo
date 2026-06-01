/**
 * renderMockupFrame.ts
 *
 * Tegner ÉN komposittert frame på en 2D-canvas: valgfri bakgrunn → device-
 * ramme → skjerm-klipp → video-frame (auto-fittet) → notch/island/hengsel.
 *
 * Kjøres én gang per video-frame av [[useMockupVideoExporter]]. Holdt rent
 * imperativt (ingen React) så den kan brukes både til live-preview og til
 * eksport-loopen.
 */

import { fitRect, scaleToFit, type FitMode, type Size } from './fitRect';
import { getDeviceGeometry, type DeviceGeometry, type DeviceVariant, type RoundedRect } from './deviceGeometry';

export interface MockupBackground {
  /** 'none' = transparent, 'solid' = flat, 'gradient' = lineær, 'image' = bilde. */
  kind: 'none' | 'solid' | 'gradient';
  from?: string;
  to?: string;
  /** Gradient-retning. Default 'vertical'. */
  direction?: 'vertical' | 'horizontal' | 'diagonal';
}

/**
 * Crop-inset på kilden, som andel (0..1) av kildens størrelse, per kant.
 * Brukes til å fjerne f.eks. iOS-statuslinjen (tid/5G/batteri) øverst slik
 * at app-innholdet fyller hele mockup-skjermen uten OS-chrome.
 *
 * Eksempel: `{ top: 0.04 }` skjærer vekk øverste 4 % av kilden.
 */
export interface SourceInset {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface MockupRenderOptions {
  variant: DeviceVariant;
  /** Hvordan videoen fyller skjermen. Default 'cover'. */
  fit?: FitMode;
  /** Bakgrunn bak enheten (for "social post"-format). */
  background?: MockupBackground;
  /**
   * Marg (andel av korteste lerret-side) mellom enhet og lerretskant når
   * det er bakgrunn. 0 = enheten fyller; 0.08 = 8 % luft. Default 0.08.
   */
  padding?: number;
  /** Crop vekk kanter av kilden (f.eks. iOS-statuslinje). */
  sourceInset?: SourceInset;
  /**
   * Droppskygge under enheten — gir et polert, "svevende" inntrykk.
   * Default på når det er bakgrunn, av ellers. Sett `false` for å skru av.
   */
  shadow?: boolean;
}

/** Tegn et avrundet rektangel som path (uten å fylle). */
function roundedRectPath(ctx: CanvasRenderingContext2D, r: RoundedRect): void {
  const radius = Math.max(0, Math.min(r.radius, r.width / 2, r.height / 2));
  ctx.beginPath();
  ctx.moveTo(r.x + radius, r.y);
  ctx.arcTo(r.x + r.width, r.y, r.x + r.width, r.y + r.height, radius);
  ctx.arcTo(r.x + r.width, r.y + r.height, r.x, r.y + r.height, radius);
  ctx.arcTo(r.x, r.y + r.height, r.x, r.y, radius);
  ctx.arcTo(r.x, r.y, r.x + r.width, r.y, radius);
  ctx.closePath();
}

/**
 * Kilde som kan tegnes på canvas — video-element under eksport, eller et
 * bilde/canvas til preview. Vi leser naturlig størrelse defensivt.
 */
export type DrawableSource =
  | HTMLVideoElement
  | HTMLImageElement
  | HTMLCanvasElement;

function sourceSize(src: DrawableSource): Size {
  if (src instanceof HTMLVideoElement) {
    return { width: src.videoWidth, height: src.videoHeight };
  }
  if (src instanceof HTMLImageElement) {
    return { width: src.naturalWidth, height: src.naturalHeight };
  }
  return { width: src.width, height: src.height };
}

/**
 * Plassér device-geometrien i lerretet: sentrert, skalert ned til å passe
 * innenfor `padding`. Returnerer geometri i lerret-koordinater.
 */
function placeDevice(
  canvasWidth: number,
  canvasHeight: number,
  base: DeviceGeometry,
  padding: number,
): DeviceGeometry {
  const margin = Math.min(canvasWidth, canvasHeight) * padding;
  const bounds: Size = {
    width: canvasWidth - margin * 2,
    height: canvasHeight - margin * 2,
  };
  const k = scaleToFit({ width: base.width, height: base.height }, bounds);
  const placedWidth = base.width * k;
  const placedHeight = base.height * k;
  const offsetX = (canvasWidth - placedWidth) / 2;
  const offsetY = (canvasHeight - placedHeight) / 2;

  const move = <T extends RoundedRect>(r: T): T => ({
    ...r,
    x: offsetX + r.x * k,
    y: offsetY + r.y * k,
    width: r.width * k,
    height: r.height * k,
    radius: r.radius * k,
  });

  return {
    ...base,
    width: placedWidth,
    height: placedHeight,
    body: move(base.body),
    screen: move(base.screen),
    overlays: base.overlays.map(move),
    accents: base.accents.map(move),
  };
}

/**
 * Tegn én komposittert frame. `ctx` forventes å være et lerret med
 * dimensjoner `canvasWidth × canvasHeight`.
 */
export function renderMockupFrame(
  ctx: CanvasRenderingContext2D,
  source: DrawableSource,
  canvasWidth: number,
  canvasHeight: number,
  options: MockupRenderOptions,
): void {
  const { variant, fit = 'cover', background = { kind: 'none' }, padding = 0.08, sourceInset } = options;
  const hasBackground = background.kind !== 'none';
  const shadow = options.shadow ?? hasBackground;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // 1) Bakgrunn.
  if (background.kind === 'solid') {
    ctx.fillStyle = background.from ?? '#0b1120';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else if (background.kind === 'gradient') {
    const dir = background.direction ?? 'vertical';
    const grad =
      dir === 'horizontal'
        ? ctx.createLinearGradient(0, 0, canvasWidth, 0)
        : dir === 'diagonal'
          ? ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight)
          : ctx.createLinearGradient(0, 0, 0, canvasHeight);
    grad.addColorStop(0, background.from ?? '#1e293b');
    grad.addColorStop(1, background.to ?? '#0b1120');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Hvis det er bakgrunn → padding rundt enheten; ellers fyll lerretet.
  const effectivePadding = background.kind === 'none' ? 0 : padding;
  const baseGeom = getDeviceGeometry(variant, 1);
  const g = placeDevice(canvasWidth, canvasHeight, baseGeom, effectivePadding);

  // 2) Ramme-kropp (gradient-fyll). Valgfri droppskygge under for et polert,
  //    svevende inntrykk (canvas-ekvivalent av DeviceMockup.tsx sin drop-shadow).
  const bezel = ctx.createLinearGradient(0, g.body.y, 0, g.body.y + g.body.height);
  bezel.addColorStop(0, g.bezelFrom);
  bezel.addColorStop(1, g.bezelTo);
  roundedRectPath(ctx, g.body);
  if (shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = Math.min(canvasWidth, canvasHeight) * 0.06;
    ctx.shadowOffsetY = Math.min(canvasWidth, canvasHeight) * 0.025;
    ctx.fillStyle = bezel;
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = bezel;
  ctx.fill();

  // 3) Skjerm-bakgrunn (i tilfelle videoen ikke dekker helt) + klipp.
  roundedRectPath(ctx, g.screen);
  ctx.fillStyle = '#0b1120';
  ctx.fill();

  ctx.save();
  roundedRectPath(ctx, g.screen);
  ctx.clip();

  // 4) Video-frame, auto-fittet inn i skjerm-rektangelet.
  const full = sourceSize(source);
  if (full.width > 0 && full.height > 0) {
    // Crop vekk kanter av kilden (f.eks. iOS-statuslinjen øverst). Vi tegner
    // kun det gjenværende rektangelet, og fitRect regner på den kroppede
    // størrelsen slik at app-innholdet fyller skjermen uten OS-chrome.
    const top = (sourceInset?.top ?? 0) * full.height;
    const bottom = (sourceInset?.bottom ?? 0) * full.height;
    const left = (sourceInset?.left ?? 0) * full.width;
    const right = (sourceInset?.right ?? 0) * full.width;
    const srcX = left;
    const srcY = top;
    const srcW = Math.max(1, full.width - left - right);
    const srcH = Math.max(1, full.height - top - bottom);

    const draw = fitRect({ width: srcW, height: srcH }, g.screen, fit);
    try {
      // 9-arg drawImage: tegn kun det kroppede sub-rektangelet av kilden.
      ctx.drawImage(source, srcX, srcY, srcW, srcH, draw.x, draw.y, draw.width, draw.height);
    } catch {
      // drawImage kaster hvis videoen ikke har data ennå — hopp over framen.
    }
  }
  ctx.restore();

  // 5) Overlays (notch / island / kamera) oppå skjermen.
  for (const o of g.overlays) {
    roundedRectPath(ctx, o);
    ctx.fillStyle = o.kind === 'camera' ? '#0a0a0a' : '#000000';
    ctx.fill();
  }

  // 6) Aksenter utenpå rammen (MacBook-hengsel osv.).
  for (const a of g.accents) {
    roundedRectPath(ctx, a);
    if (a.gradientTo) {
      const ag = ctx.createLinearGradient(0, a.y, 0, a.y + a.height);
      ag.addColorStop(0, a.fill);
      ag.addColorStop(1, a.gradientTo);
      ctx.fillStyle = ag;
    } else {
      ctx.fillStyle = a.fill;
    }
    ctx.fill();
  }
}
