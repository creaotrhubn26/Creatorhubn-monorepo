/**
 * clippingMaskRenderer — kompositt-rendring for clipping-mask-grupper.
 *
 * Procreate/Photoshop-semantics:
 *   - Et lag merket `clippingMask` definerer "maske-coverage" via sine
 *     ikke-transparente piksler.
 *   - Alle påfølgende ikke-mask-lag i samme stack klippes til denne
 *     coverage til neste clippingMask=true eller stack-slutt.
 *
 * Implementasjon:
 *   1. Iterer layers bottom-up (lavest depth/index først).
 *   2. Når vi treffer et mask-lag: render maskens strokes til en
 *      offscreen-canvas, så alle clipped lag på TOP av det med
 *      `globalCompositeOperation = 'source-atop'`. Resultatet komposit-
 *      teres til target-canvas.
 *   3. Vanlige lag (uten aktiv maske) tegnes direkte til target.
 *
 * Modulen er ren — tar inn layers + en stroke-renderer og en target-
 * canvas-context. Egnet for både hovededitor og preview/eksport.
 */

import type { DrawingLayer } from './LayersPanel';
import { buildClippingGroups } from './LayersPanel';

export interface ClippingRenderOptions {
  /** Target-canvas å tegne det sammensatte resultatet til. */
  ctx: CanvasRenderingContext2D;
  /** Bredde/høyde for offscreen-canvas (samme som target). */
  width: number;
  height: number;
  /** Lag-stakk, lavest index = bunn. */
  layers: DrawingLayer[];
  /** Callback som tegner et lag's strokes til en gitt context. */
  renderLayerStrokes: (ctx: CanvasRenderingContext2D, layer: DrawingLayer) => void;
  /** Hopp over lag som er skjult/usynlige. Default true. */
  respectVisibility?: boolean;
}

interface ClipGroup {
  maskLayer: DrawingLayer;
  clippedLayers: DrawingLayer[];
}

/**
 * Bygger sammenhengende clip-grupper fra lag-rekkefølgen.
 * Bottom-up traversal — første gruppe er nederst i stack.
 */
export function planClippingPasses(layers: DrawingLayer[]): {
  preMaskLayers: DrawingLayer[];
  groups: ClipGroup[];
} {
  const preMaskLayers: DrawingLayer[] = [];
  const groups: ClipGroup[] = [];
  let currentGroup: ClipGroup | null = null;

  for (const layer of layers) {
    if (layer.clippingMask) {
      currentGroup = { maskLayer: layer, clippedLayers: [] };
      groups.push(currentGroup);
      continue;
    }
    if (currentGroup) {
      currentGroup.clippedLayers.push(layer);
    } else {
      preMaskLayers.push(layer);
    }
  }
  return { preMaskLayers, groups };
}

/**
 * Hovedfunksjonen — renderer en hel lag-stakk til target-context med
 * korrekt clipping-mask-compositing.
 */
export function renderLayersWithClipping(options: ClippingRenderOptions): void {
  const { ctx, width, height, layers, renderLayerStrokes, respectVisibility = true } = options;
  if (typeof document === 'undefined') return;

  const visibleLayers = respectVisibility
    ? layers.filter((layer) => layer.visible)
    : layers.slice();

  const { preMaskLayers, groups } = planClippingPasses(visibleLayers);

  // 1. Tegn alle lag før første mask direkte til target.
  for (const layer of preMaskLayers) {
    drawLayerToContext(ctx, layer, renderLayerStrokes);
  }

  // 2. For hver clip-gruppe: offscreen-canvas, mask først, så
  // source-atop for alle clipped lag, og komposit til target.
  for (const group of groups) {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offscreenCtx = offscreen.getContext('2d');
    if (!offscreenCtx) continue;

    // Tegn maska først — dette etablerer "klipperegionen".
    drawLayerToContext(offscreenCtx, group.maskLayer, renderLayerStrokes);

    // For hvert clipped lag: bruk source-atop så pikslene bare havner
    // der maska allerede har coverage.
    for (const clipped of group.clippedLayers) {
      offscreenCtx.save();
      offscreenCtx.globalCompositeOperation = 'source-atop';
      offscreenCtx.globalAlpha = clipped.opacity;
      renderLayerStrokes(offscreenCtx, clipped);
      offscreenCtx.restore();
    }

    // Komposit hele gruppen tilbake til target.
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(offscreen, 0, 0);
    ctx.restore();
  }
}

function drawLayerToContext(
  ctx: CanvasRenderingContext2D,
  layer: DrawingLayer,
  renderLayerStrokes: (ctx: CanvasRenderingContext2D, layer: DrawingLayer) => void,
): void {
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  // Lag med blend mode kobles til canvas-compositing. Faller tilbake
  // til 'source-over' for 'normal'/ukjente modi.
  ctx.globalCompositeOperation = mapBlendModeToComposite(layer.blendMode);
  renderLayerStrokes(ctx, layer);
  ctx.restore();
}

/**
 * Mapper DrawingLayer.blendMode til Canvas API globalCompositeOperation.
 * Canvas støtter en undermengde av Photoshop-blend-modes; ukjente faller
 * tilbake til 'source-over' (normal).
 */
function mapBlendModeToComposite(blendMode: string): GlobalCompositeOperation {
  const supported: Record<string, GlobalCompositeOperation> = {
    normal: 'source-over',
    multiply: 'multiply',
    screen: 'screen',
    overlay: 'overlay',
    darken: 'darken',
    lighten: 'lighten',
    'color-dodge': 'color-dodge',
    'color-burn': 'color-burn',
    'hard-light': 'hard-light',
    'soft-light': 'soft-light',
    difference: 'difference',
    exclusion: 'exclusion',
    hue: 'hue',
    saturation: 'saturation',
    color: 'color',
    luminosity: 'luminosity',
  };
  return supported[blendMode] ?? 'source-over';
}

// Re-export så consumers ikke trenger å importere fra to filer.
export { buildClippingGroups };
