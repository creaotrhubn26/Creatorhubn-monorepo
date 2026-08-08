/**
 * mockupPerspective.ts — 2.5D perspektiv-presets for device-lag.
 *
 * Affine (parallell/isometrisk) transform — canvas 2D er affint, så dette er
 * parallell-projeksjon uten forsvinningspunkt (nettopp den «isometriske» looken
 * som leser som proff). Ekte keystone-perspektiv (homografi) er utenfor scope.
 *
 * Matrisen (a,b,c,d) tolkes som ctx.transform(a,b,c,d,0,0) ANVENDT RUNDT
 * device-senteret: local (x,y) → (a·x + c·y, b·x + d·y).
 */

export type MockupPerspective =
  | 'none' | 'iso-left' | 'iso-right' | 'angled-left' | 'angled-right' | 'lay-flat';

export interface AffineMatrix { a: number; b: number; c: number; d: number }

export const PERSPECTIVE_PRESETS: { id: MockupPerspective; label: string }[] = [
  { id: 'none', label: 'Rett på' },
  { id: 'angled-left', label: 'Vinklet ◄' },
  { id: 'angled-right', label: 'Vinklet ►' },
  { id: 'iso-left', label: 'Isometrisk ◄' },
  { id: 'iso-right', label: 'Isometrisk ►' },
  { id: 'lay-flat', label: 'Liggende' },
];

const MATRICES: Record<Exclude<MockupPerspective, 'none'>, AffineMatrix> = {
  'angled-left':  { a: 0.97, b: -0.06, c: -0.10, d: 1.0 },
  'angled-right': { a: 0.97, b: 0.06,  c: 0.10,  d: 1.0 },
  'iso-left':     { a: 0.90, b: -0.10, c: -0.26, d: 0.96 },
  'iso-right':    { a: 0.90, b: 0.10,  c: 0.26,  d: 0.96 },
  'lay-flat':     { a: 1.0,  b: 0.0,   c: 0.35,  d: 0.60 },
};

/** Affin matrise for et preset, eller null for 'none' (ingen transform). */
export function matrixFor(p: MockupPerspective | undefined): AffineMatrix | null {
  if (!p || p === 'none') return null;
  return MATRICES[p];
}

/** Er transformen «venstre-tiltet»? Styrer skygge-/refleksjons-retning. */
export function tiltsLeft(p: MockupPerspective | undefined): boolean {
  return p === 'iso-left' || p === 'angled-left';
}
