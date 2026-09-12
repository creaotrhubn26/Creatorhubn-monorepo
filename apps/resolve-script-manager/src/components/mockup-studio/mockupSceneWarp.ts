/**
 * mockupSceneWarp.ts — warp et skjermbilde inn i et vilkårlig 4-hjørne-quad.
 *
 * Lifestyle-scener har skjermen i PERSPEKTIV (skrå/rotert), ikke et akse-justert
 * rektangel. Canvas 2D har ingen homografi, så vi tilnærmer: del skjermbildet i
 * et grid, map hver celle til quad'en (bilineær), og tegn hver celle som to
 * tekstur-mappede trekanter (affin per trekant). Fin nok for near-frontal skjermer.
 */

export type Quad = [[number, number], [number, number], [number, number], [number, number]]; // TL, TR, BR, BL

/** Bilineær interpolasjon i quad'en ved (u,v) 0..1. */
export function bilerp(quad: Quad, u: number, v: number): [number, number] {
  const [TL, TR, BR, BL] = quad;
  const tx = TL[0] + (TR[0] - TL[0]) * u, ty = TL[1] + (TR[1] - TL[1]) * u;
  const bx = BL[0] + (BR[0] - BL[0]) * u, by = BL[1] + (BR[1] - BL[1]) * u;
  return [tx + (bx - tx) * v, ty + (by - ty) * v];
}

/** Akse-justert bounding-box for en quad (px). */
export function quadBounds(quad: Quad): { x: number; y: number; w: number; h: number } {
  const xs = quad.map((p) => p[0]), ys = quad.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

type Pt = [number, number];

/** Tegn `img`-trekanten (src) tekstur-mappet inn i dst-trekanten (affin + clip). */
function drawTri(ctx: CanvasRenderingContext2D, img: CanvasImageSource, s0: Pt, s1: Pt, s2: Pt, d0: Pt, d1: Pt, d2: Pt): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0[0], d0[1]); ctx.lineTo(d1[0], d1[1]); ctx.lineTo(d2[0], d2[1]); ctx.closePath();
  ctx.clip();
  const [x0, y0] = s0, [x1, y1] = s1, [x2, y2] = s2;
  const [u0, v0] = d0, [u1, v1] = d1, [u2, v2] = d2;
  const den = x0 * (y2 - y1) - x1 * y2 + x2 * y1 + (x1 - x2) * y0;
  if (Math.abs(den) < 1e-6) { ctx.restore(); return; }
  const a = (u0 * (y2 - y1) - u1 * y2 + u2 * y1 + (u1 - u2) * y0) / den;
  const b = (v0 * (y2 - y1) - v1 * y2 + v2 * y1 + (v1 - v2) * y0) / den;
  const c = (x0 * (u2 - u1) - x1 * u2 + x2 * u1 + (x1 - x2) * u0) / den;
  const d = (x0 * (v2 - v1) - x1 * v2 + x2 * v1 + (x1 - x2) * v0) / den;
  const e = (x0 * (y2 * u1 - y1 * u2) + y0 * (x1 * u2 - x2 * u1) + (x2 * y1 - x1 * y2) * u0) / den;
  const f = (x0 * (y2 * v1 - y1 * v2) + y0 * (x1 * v2 - x2 * v1) + (x2 * y1 - x1 * y2) * v0) / den;
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** Warp hele `img` inn i `quad` (px) via et grid av tekstur-trekanter. */
export function drawImageQuad(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLCanvasElement, quad: Quad, gridN = 14): void {
  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;
  const src = (u: number, v: number): Pt => [u * iw, v * ih];
  for (let i = 0; i < gridN; i++) {
    for (let j = 0; j < gridN; j++) {
      const u0 = i / gridN, u1 = (i + 1) / gridN, v0 = j / gridN, v1 = (j + 1) / gridN;
      const s00 = src(u0, v0), s10 = src(u1, v0), s11 = src(u1, v1), s01 = src(u0, v1);
      const d00 = bilerp(quad, u0, v0), d10 = bilerp(quad, u1, v0), d11 = bilerp(quad, u1, v1), d01 = bilerp(quad, u0, v1);
      drawTri(ctx, img, s00, s10, s11, d00, d10, d11);
      drawTri(ctx, img, s00, s11, s01, d00, d11, d01);
    }
  }
}
