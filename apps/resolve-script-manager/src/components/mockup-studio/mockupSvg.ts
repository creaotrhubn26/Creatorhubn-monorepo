/**
 * mockupSvg.ts — semi-vektor SVG-eksport av en MockupDoc.
 *
 * Alt UNNTATT tekst rasteriseres til ett <image> (bakgrunn + enheter + dekor +
 * annotasjoner — enhets-rammene er PNG-assets, ikke vektor), og hver tekst
 * legges oppå som et EKTE <text>-element: skalerbart, valgbart og redigerbart i
 * vektor-verktøy. Linjebryting gjøres med samme canvas-måling som rasterisatoren,
 * så bruddene matcher forhåndsvisningen.
 */

import { rasterizeToPngDataUrl } from './mockupRaster';
import { resolveColor, fontFamilyFor, type MockupDoc, type MockupTextSlot } from './mockupStudioModel';

/** Del en tekst i linjer med samme greedy-bryting som rasterisatoren (canvas measureText). */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const hard of text.split('\n')) {
    const words = hard.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = w; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}

const XML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => XML_ESC[c]);

/** Bygg SVG-strengen: raster-komposit (uten tekst) + ett <text> per tekst-slot. */
export function buildSvgString(doc: MockupDoc, baseImageDataUrl: string): string {
  const { w: W, h: H } = doc.canvas;
  const meas = document.createElement('canvas').getContext('2d');

  const texts = doc.texts.map((t) => textToSvg(t, doc, meas)).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<image href="${baseImageDataUrl}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>
${texts}
</svg>`;
}

function textToSvg(t: MockupTextSlot, doc: MockupDoc, meas: CanvasRenderingContext2D | null): string {
  const raw = t.uppercase ? t.text.toUpperCase() : t.text;
  const family = fontFamilyFor(t.role, doc.canvas);
  const fill = resolveColor(t.color, doc.canvas);
  const anchorX = t.align === 'center' ? t.x + t.w / 2 : t.align === 'right' ? t.x + t.w : t.x;
  const anchor = t.align === 'center' ? 'middle' : t.align === 'right' ? 'end' : 'start';
  const lh = t.size * t.lineHeight;

  let lines: string[];
  if (meas) { meas.font = `${t.weight} ${t.size}px ${family}`; lines = wrapLines(meas, raw, t.w); }
  else lines = raw.split('\n');

  const tspans = lines.map((line, i) => `<tspan x="${anchorX}" dy="${i === 0 ? 0 : lh}">${esc(line)}</tspan>`).join('');
  return `<text x="${anchorX}" y="${t.y}" text-anchor="${anchor}" dominant-baseline="text-before-edge" `
    + `style="font-family:${esc(family)};font-size:${t.size}px;font-weight:${t.weight};letter-spacing:${t.tracking}px;fill:${fill}">${tspans}</text>`;
}

/** UTF-8-trygg base64 (SVG er tekst, men demoWriteBinary tar base64). */
function utf8Base64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

/** Render komposit uten tekst → bygg SVG → returner base64 klar for demoWriteBinary. */
export async function buildSvgBase64(doc: MockupDoc, rasterScale = 2): Promise<string> {
  const base = await rasterizeToPngDataUrl({ ...doc, texts: [] }, rasterScale);
  return utf8Base64(buildSvgString(doc, base));
}
