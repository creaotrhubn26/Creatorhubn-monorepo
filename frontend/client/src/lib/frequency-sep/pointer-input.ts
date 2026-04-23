/**
 * Pointer input normalisation for the frequency-sep brush.
 *
 * The Pointer Events API unifies mouse, pen, and touch under one event
 * shape — but the semantics of `pressure` differ by device and we want
 * consistent brush behaviour across all of them. In particular:
 *
 *   mouse:  `pressure` is 0.5 by spec while a button is down (or 0 when up).
 *           A literal read would halve every mouse stroke. We override to 1.
 *   pen:    `pressure` is the real analogue stylus force in [0,1]. We clamp
 *           a tiny floor so a resting pen still leaves a faint mark instead
 *           of a dead stamp, and ceiling at 1 for devices that report 0.99.
 *   touch:  Most devices report `pressure = 0` (no force sensor). Treat a
 *           finger press as full pressure; use the reported value on devices
 *           that do support touch-force (3D Touch, some Surfaces).
 *
 * Tilt is reported in degrees per the spec; we pass it through unchanged
 * because nothing in the brush pipeline consumes tilt yet — the field is
 * carried through for A2.6 and later modes (e.g. tilt-driven ink shape).
 *
 * This module is pure and DOM-free so the contract can be unit-tested
 * without synthesising PointerEvents in jsdom.
 */

export type PointerInput = {
  /** Browser pointer type — "mouse" | "pen" | "touch" | other vendor strings. */
  pointerType: string;
  /** Pointer force in [0,1]; semantics differ by device (see module doc). */
  pressure: number;
  /** Tilt in degrees in the [-90, 90] range, per the spec. Undefined for mouse. */
  tiltX?: number;
  tiltY?: number;
};

export type NormalisedPointerInput = {
  pressure: number;
  tiltX?: number;
  tiltY?: number;
};

/**
 * Map a raw pointer event to a consistent pressure/tilt pair the brush
 * engine can consume directly.
 */
export function normalisePointerInput(pt: PointerInput): NormalisedPointerInput {
  let pressure: number;
  switch (pt.pointerType) {
    case 'pen':
      // Clamp a tiny floor so a resting pen still paints. Without this,
      // users who hover-click with zero force see no mark and assume the
      // brush is broken.
      pressure = Math.max(0.02, Math.min(1, pt.pressure));
      break;
    case 'touch':
      // Most touchscreens don't report force and send pressure=0 on contact.
      // Treat that as a full-pressure finger press; honour real values when
      // the OS/panel does report them.
      pressure = pt.pressure > 0 ? Math.min(1, pt.pressure) : 1;
      break;
    case 'mouse':
    default:
      // Spec says 0.5 while a button is down on non-pressure devices — we
      // override to full pressure so mouse/trackpad strokes look right.
      pressure = 1;
      break;
  }

  // Pen tilt is carried through in degrees; other pointer types don't report
  // tilt meaningfully so we drop it.
  const isPen = pt.pointerType === 'pen';
  return {
    pressure,
    tiltX: isPen ? pt.tiltX : undefined,
    tiltY: isPen ? pt.tiltY : undefined,
  };
}

/**
 * Decide whether a given pointer down should begin a brush stroke.
 * Multi-touch is disabled by default (would confuse stroke state), and
 * pen input takes precedence over simultaneous touches so a hand resting
 * on the iPad doesn't hijack a stylus stroke.
 *
 * `activePointerId` is the currently tracked stroke pointer (or null when
 * idle). `hasConcurrentPen` is true when any other active pointer on the
 * surface is a stylus — caller tracks this via `pointerenter`/`leave`
 * or by inspecting the event target's active pointers.
 */
export function shouldStartStroke(
  pointerType: string,
  isPrimary: boolean,
  activePointerId: number | null,
  hasConcurrentPen: boolean,
): boolean {
  // Already tracking a stroke → ignore further pointer-downs.
  if (activePointerId !== null) return false;
  // Non-primary pointers (e.g. second finger on multi-touch) are dropped.
  if (!isPrimary) return false;
  // Palm rejection: when a pen is on the surface, ignore finger touches.
  if (pointerType === 'touch' && hasConcurrentPen) return false;
  return true;
}
