/**
 * mockupArrange.ts — ren geometri for direktemanipulasjon (snap/justering).
 *
 * Holdt separat fra React-komponenten så den kan enhets-testes headless.
 */

export interface Box { x: number; y: number; w: number; h: number }

export interface SnapResult { x: number; y: number; vx: number[]; hy: number[] }

/**
 * Snap topp-venstre (nx,ny) for `box` mot andre bokser + lerret-kanter/senter.
 * Matcher venstre/senter/høyre (X) og topp/senter/bunn (Y) innen `threshold`
 * base-px; returnerer justert posisjon + hvilke hjelpelinjer som traff.
 */
export function snapPosition(
  box: Box, nx: number, ny: number, others: Box[], canvasW: number, canvasH: number, threshold: number,
): SnapResult {
  const candX = [0, canvasW / 2, canvasW, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
  const candY = [0, canvasH / 2, canvasH, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
  const snap1 = (movePts: number[], cands: number[]): { delta: number; line: number | null } => {
    let best: { delta: number; line: number } | null = null;
    for (const mp of movePts) for (const c of cands) {
      const d = c - mp;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, line: c };
    }
    return best ?? { delta: 0, line: null };
  };
  const sx = snap1([nx, nx + box.w / 2, nx + box.w], candX);
  const sy = snap1([ny, ny + box.h / 2, ny + box.h], candY);
  return { x: nx + sx.delta, y: ny + sy.delta, vx: sx.line != null ? [sx.line] : [], hy: sy.line != null ? [sy.line] : [] };
}

/** Bytt element `id` én plass fram (`up` = senere i array = tegnes over) / bak. */
export function reorder<T extends { id: string }>(arr: T[], id: string, dir: 'up' | 'down'): T[] {
  const out = [...arr];
  const i = out.findIndex((el) => el.id === id);
  const j = dir === 'up' ? i + 1 : i - 1;
  if (i < 0 || j < 0 || j >= out.length) return arr;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
