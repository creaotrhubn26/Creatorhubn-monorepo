/**
 * Brush engine — mode-agnostic. Everything here is about **where** a
 * brush touches the image and **how hard** it touches at each pixel.
 * The actual pixel operation (heal, clone, blur-low, smooth-mid,
 * dodge-burn) is plugged in by A2.3 as a per-pixel callback; keeping
 * the two separated means stroke interpolation, falloff, and pressure
 * curves are shared across every mode and testable in isolation.
 *
 * Subpixel-correct: stamp centres and radii are floats, and the
 * falloff is evaluated against actual euclidean distance from a
 * fractional centre, not a precomputed integer mask. This matters
 * for smooth strokes — rounding a 0.5-pixel jitter across 60 stamps
 * in a stroke is very visible on skin.
 */

export type BrushSample = {
  /** Image-space coordinates in pixels. Fractional values are fine. */
  x: number;
  y: number;
  /** Normalised stylus pressure in [0,1]; 1 for mouse / non-pressure input. */
  pressure: number;
  /** Stylus tilt in radians, carried through for A2.3 modes that care. */
  tiltX?: number;
  tiltY?: number;
};

export type BrushSettings = {
  /** Brush radius in pixels at full pressure. */
  radius: number;
  /** [0,1] — 0 is fully soft (smoothstep from centre), 1 is hard-edged disc. */
  hardness: number;
  /** [0,1] — strength multiplier per stamp; controls how fast a stroke builds up. */
  flow: number;
  /** Stamp spacing as a fraction of radius. 0.25 is standard for smooth strokes. */
  spacing: number;
  /** [0,1] — how much pressure modulates radius (0 = ignore pressure, 1 = full scale). */
  pressureRadius: number;
  /** [0,1] — how much pressure modulates flow. */
  pressureFlow: number;
};

export type BrushStamp = {
  /** Fractional image-space centre. */
  cx: number;
  cy: number;
  /** Effective radius after pressure scaling. Floats preserved. */
  radius: number;
  hardness: number;
  /** Effective strength (flow × pressure) in [0,1]. */
  strength: number;
  /** Carried through from the originating sample for mode callbacks. */
  tiltX?: number;
  tiltY?: number;
};

export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
  radius: 24,
  hardness: 0.5,
  flow: 0.6,
  spacing: 0.25,
  pressureRadius: 0.5,
  pressureFlow: 0.7,
};

/** Clamp a value to [lo, hi]. Small helper kept local so brush.ts has no imports. */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Collapse a raw pointer sample + settings into a concrete stamp.
 * Pressure modulates radius and flow independently because they have
 * different feel — pressure-radius gives taper, pressure-flow gives
 * buildup. Most retouch brushes want both.
 */
export function sampleToStamp(sample: BrushSample, settings: BrushSettings): BrushStamp {
  const p = clamp01(sample.pressure);
  const radiusFactor = 1 - settings.pressureRadius * (1 - p);
  const flowFactor = 1 - settings.pressureFlow * (1 - p);
  const radius = Math.max(0.5, settings.radius * radiusFactor);
  const strength = clamp01(settings.flow * flowFactor);
  return {
    cx: sample.x,
    cy: sample.y,
    radius,
    hardness: clamp01(settings.hardness),
    strength,
    tiltX: sample.tiltX,
    tiltY: sample.tiltY,
  };
}

/**
 * 2D falloff mask sampled at integer offsets. Useful for previews and
 * for tests where we want to assert the shape of the curve. The brush
 * traversal itself does NOT use this — it evaluates the falloff on
 * fractional distances from a fractional centre.
 *
 * Model: `smoothstep` from `radius × hardness` (full opacity inner disc)
 * out to `radius` (zero opacity at the rim). Hardness=0 gives a fully
 * soft brush, hardness=1 gives a hard-edged disc.
 */
export function computeFalloffMask(
  radius: number,
  hardness: number,
): { mask: Float32Array; size: number; radius: number } {
  const r = Math.max(1, Math.ceil(radius));
  const size = r * 2 + 1;
  const mask = new Float32Array(size * size);
  const rIn = radius * clamp01(hardness);
  const rOut = radius;
  const span = rOut - rIn;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      let v: number;
      if (d <= rIn) v = 1;
      else if (d >= rOut) v = 0;
      else {
        const t = span === 0 ? 1 : (d - rIn) / span;
        v = 1 - t * t * (3 - 2 * t);
      }
      mask[(y + r) * size + (x + r)] = v;
    }
  }
  return { mask, size, radius };
}

/**
 * Walk the footprint of a stamp and invoke `apply(x, y, weight)` once per
 * touched pixel. The weight is `falloff × stamp.strength` already, so
 * callbacks just scale their operation by it.
 *
 * Bounds-clipped against `bounds.width × bounds.height`; no out-of-image
 * callbacks are emitted. Zero-weight pixels are also skipped so modes
 * can assume `weight > 0`.
 */
export function forEachStampPixel(
  stamp: BrushStamp,
  bounds: { width: number; height: number },
  apply: (x: number, y: number, weight: number) => void,
): void {
  const r = stamp.radius;
  if (r <= 0 || stamp.strength <= 0) return;
  const x0 = Math.max(0, Math.floor(stamp.cx - r));
  const x1 = Math.min(bounds.width - 1, Math.ceil(stamp.cx + r));
  const y0 = Math.max(0, Math.floor(stamp.cy - r));
  const y1 = Math.min(bounds.height - 1, Math.ceil(stamp.cy + r));
  if (x1 < x0 || y1 < y0) return;
  const rIn = r * clamp01(stamp.hardness);
  const span = r - rIn;
  for (let y = y0; y <= y1; y++) {
    const dy = y - stamp.cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - stamp.cx;
      const d = Math.sqrt(dx * dx + dy * dy);
      let falloff: number;
      if (d <= rIn) {
        falloff = 1;
      } else if (d >= r) {
        continue;
      } else {
        const t = span === 0 ? 1 : (d - rIn) / span;
        falloff = 1 - t * t * (3 - 2 * t);
      }
      const w = falloff * stamp.strength;
      if (w <= 0) continue;
      apply(x, y, w);
    }
  }
}

/**
 * State carried between pointer events within a single stroke. The
 * engine interpolates along the segment between the last stamped point
 * and the new sample, so stamps land at a consistent pixel spacing
 * regardless of how often pointer events fire (60Hz on one device,
 * 240Hz on another — the visual result must be identical).
 */
export type StrokeState = {
  last?: { x: number; y: number; pressure: number; tiltX?: number; tiltY?: number };
  /** Distance travelled since the most recent stamp, in pixels. Carries
   *  across `extendStroke` calls so event granularity doesn't bias spacing. */
  distanceSinceStamp: number;
};

export function beginStroke(): StrokeState {
  return { distanceSinceStamp: 0 };
}

/**
 * Extend the stroke by one pointer sample. Returns the updated state
 * and any stamps that should be applied for this segment.
 *
 * Behaviour:
 *   - First sample of a stroke always emits one stamp at its position.
 *   - Subsequent samples interpolate position/pressure/tilt linearly
 *     from the last-stamped point to the new sample, dropping a stamp
 *     every `spacing × radius` pixels along the segment.
 *   - Zero-length segments (duplicate positions) emit nothing and
 *     accumulate no distance.
 *
 * `state` is not mutated — caller must assign `result.state` back.
 */
export function extendStroke(
  state: StrokeState,
  sample: BrushSample,
  settings: BrushSettings,
): { state: StrokeState; stamps: BrushStamp[] } {
  if (!state.last) {
    return {
      state: {
        last: {
          x: sample.x,
          y: sample.y,
          pressure: sample.pressure,
          tiltX: sample.tiltX,
          tiltY: sample.tiltY,
        },
        distanceSinceStamp: 0,
      },
      stamps: [sampleToStamp(sample, settings)],
    };
  }

  const dx = sample.x - state.last.x;
  const dy = sample.y - state.last.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) {
    return { state, stamps: [] };
  }

  const spacing = Math.max(0.5, Math.max(0.01, settings.spacing) * settings.radius);
  const stamps: BrushStamp[] = [];
  const hasTiltX = state.last.tiltX !== undefined && sample.tiltX !== undefined;
  const hasTiltY = state.last.tiltY !== undefined && sample.tiltY !== undefined;

  // Offset (along the segment, measured from `state.last`) at which the
  // next stamp should land. If we carried residual distance from the
  // previous segment, the first stamp lands that much sooner.
  let nextOffset = spacing - state.distanceSinceStamp;

  while (nextOffset <= dist) {
    const t = nextOffset / dist;
    stamps.push(
      sampleToStamp(
        {
          x: state.last.x + dx * t,
          y: state.last.y + dy * t,
          pressure: state.last.pressure + (sample.pressure - state.last.pressure) * t,
          tiltX: hasTiltX
            ? state.last.tiltX! + (sample.tiltX! - state.last.tiltX!) * t
            : sample.tiltX,
          tiltY: hasTiltY
            ? state.last.tiltY! + (sample.tiltY! - state.last.tiltY!) * t
            : sample.tiltY,
        },
        settings,
      ),
    );
    nextOffset += spacing;
  }

  // After the loop `nextOffset` points past the segment — the most
  // recent placed stamp was at offset `nextOffset - spacing`, so the
  // residual distance from that stamp to the new pointer position is
  // `dist - (nextOffset - spacing)`. `last` always becomes the new
  // pointer position, not the last stamp, so the trajectory from here
  // on tracks the cursor rather than lagging behind it.
  const distanceSinceStamp = stamps.length
    ? dist - (nextOffset - spacing)
    : state.distanceSinceStamp + dist;

  return {
    state: {
      last: {
        x: sample.x,
        y: sample.y,
        pressure: sample.pressure,
        tiltX: sample.tiltX,
        tiltY: sample.tiltY,
      },
      distanceSinceStamp,
    },
    stamps,
  };
}
