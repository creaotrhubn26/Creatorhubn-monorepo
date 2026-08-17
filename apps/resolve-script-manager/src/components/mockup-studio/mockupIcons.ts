/**
 * mockupIcons.ts — lite kuratert SVG-ikonsett (stroke-baserte, geometriske former)
 * for kort-punkter/pill-glyphs. Erstatter rå emoji-tegn (som rendret inkonsekvent —
 * enkelte unicode-tegn som «⭐» mangler pålitelig emoji-presentasjon i canvas-tekst
 * og ble usynlige). Én kilde til sannhet pr. ikon (primitive tegne-operasjoner i et
 * -10..10-koordinatsystem) → utleder BÅDE SVG-markup (bakte kort-bilder) og
 * canvas-tegning (live forhåndsvisning), så de to rendrings-veiene aldri kan avvike.
 *
 * Bakoverkompatibelt: eksisterende dokumenter med rå emoji i icon/glyph-feltene
 * (satt av MOCKUP_TEMPLATES sine standardverdier) er IKKE i denne banken → faller
 * tilbake til tekst-rendring akkurat som før. Kun NYE valg via ikon-velgeren bruker
 * denne banken.
 */

export interface IconOp {
  t: 'path' | 'line' | 'circle' | 'rect';
  d?: string;                 // path: lokale koordinater, -10..10
  x1?: number; y1?: number; x2?: number; y2?: number; // line
  cx?: number; cy?: number; r?: number;                // circle
  x?: number; y?: number; w?: number; h?: number; rx?: number; // rect
  fill?: boolean;             // fylt i stedet for strøk (f.eks. prikker)
}

export const ICON_DEFS: { id: string; label: string; ops: IconOp[] }[] = [
  // Medisinsk/helse-kontekst (PreVisit-kampanjene) — prioritert først i banken.
  { id: 'cross', label: 'Medisinsk kors', ops: [{ t: 'line', x1: 0, y1: -8, x2: 0, y2: 8 }, { t: 'line', x1: -8, y1: 0, x2: 8, y2: 0 }] },
  { id: 'pill', label: 'Medisin', ops: [{ t: 'rect', x: -8, y: -8, w: 16, h: 16, rx: 8 }, { t: 'line', x1: -6, y1: 6, x2: 6, y2: -6 }] },
  { id: 'stethoscope', label: 'Stetoskop', ops: [{ t: 'path', d: 'M -6 -8 L -6 -1 A 6 6 0 0 0 6 -1 L 6 -8' }, { t: 'circle', cx: -6, cy: -9, r: 1.2, fill: true }, { t: 'circle', cx: 6, cy: -9, r: 1.2, fill: true }, { t: 'line', x1: 0, y1: 5, x2: 0, y2: 8 }, { t: 'circle', cx: 4, cy: 8, r: 2.4 }] },
  { id: 'clipboard', label: 'Notat', ops: [{ t: 'rect', x: -6, y: -8, w: 12, h: 16, rx: 1.5 }, { t: 'line', x1: -3, y1: -3, x2: 3, y2: -3 }, { t: 'line', x1: -3, y1: 1, x2: 3, y2: 1 }, { t: 'line', x1: -3, y1: 5, x2: 1, y2: 5 }] },
  { id: 'clock', label: 'Klokke', ops: [{ t: 'circle', cx: 0, cy: 0, r: 8 }, { t: 'line', x1: 0, y1: 0, x2: 0, y2: -5 }, { t: 'line', x1: 0, y1: 0, x2: 4, y2: 2 }] },
  { id: 'heart', label: 'Hjerte', ops: [{ t: 'path', d: 'M 0 7 C -8 0 -8 -6 -3 -7 C 0 -8 0 -4 0 -4 C 0 -4 0 -8 3 -7 C 8 -6 8 0 0 7 Z' }] },
  { id: 'warning', label: 'Advarsel', ops: [{ t: 'path', d: 'M 0 -8 L 8 7 L -8 7 Z' }, { t: 'line', x1: 0, y1: -3, x2: 0, y2: 2 }, { t: 'line', x1: 0, y1: 5, x2: 0, y2: 5.2, fill: true }] },
  { id: 'chat', label: 'Samtale', ops: [{ t: 'rect', x: -8, y: -6, w: 16, h: 11, rx: 2 }, { t: 'path', d: 'M -3 5 L -5 9 L -1 5 Z' }] },
  { id: 'lock', label: 'Trygt/privat', ops: [{ t: 'rect', x: -5, y: -1, w: 10, h: 9, rx: 1.5 }, { t: 'path', d: 'M -3 -1 L -3 -4 A 3 3 0 0 1 3 -4 L 3 -1' }] },
  { id: 'people', label: 'Pasient/kliniker', ops: [{ t: 'circle', cx: -3, cy: -3, r: 3 }, { t: 'circle', cx: 3, cy: -3, r: 3 }, { t: 'path', d: 'M -8 8 Q -3 3 0 6 Q 3 3 8 8' }] },
  { id: 'trend', label: 'Utvikling', ops: [{ t: 'path', d: 'M -7 5 L -2 -1 L 1 2 L 7 -6' }, { t: 'path', d: 'M 3 -6 L 7 -6 L 7 -2' }] },
  { id: 'check', label: 'Fullført', ops: [{ t: 'path', d: 'M -6 0 L -2 4 L 6 -6' }] },
  // Generelle (mindre kampanje-spesifikke, men nyttige som badge/pill-ikon).
  { id: 'shield', label: 'Trygghet', ops: [{ t: 'path', d: 'M 0 -8 L 7 -5 L 7 2 Q 7 7 0 9 Q -7 7 -7 2 L -7 -5 Z' }] },
  { id: 'bell', label: 'Varsel', ops: [{ t: 'path', d: 'M -5 3 L -5 -2 A 5 5 0 0 1 5 -2 L 5 3 L 7 6 L -7 6 Z' }, { t: 'line', x1: -1.5, y1: 8, x2: 1.5, y2: 8 }] },
  { id: 'home', label: 'Hjem', ops: [{ t: 'path', d: 'M -8 0 L 0 -7 L 8 0' }, { t: 'rect', x: -5, y: 0, w: 10, h: 8 }] },
  { id: 'star', label: 'Stjerne', ops: [{ t: 'path', d: 'M 0 -8 L 2.2 -2.5 L 8 -2.5 L 3.2 1.2 L 5 7 L 0 3.5 L -5 7 L -3.2 1.2 L -8 -2.5 L -2.2 -2.5 Z' }] },
  { id: 'search', label: 'Søk', ops: [{ t: 'circle', cx: -1, cy: -1, r: 5 }, { t: 'line', x1: 3, y1: 3, x2: 8, y2: 8 }] },
  { id: 'target', label: 'Mål', ops: [{ t: 'circle', cx: 0, cy: 0, r: 8 }, { t: 'circle', cx: 0, cy: 0, r: 4 }, { t: 'circle', cx: 0, cy: 0, r: 0.9, fill: true }] },
  { id: 'pin', label: 'Sted', ops: [{ t: 'path', d: 'M 0 8 C -6 0 -6 -6 0 -8 C 6 -6 6 0 0 8 Z' }, { t: 'circle', cx: 0, cy: -3, r: 2 }] },
];

const ICON_MAP = new Map(ICON_DEFS.map((d) => [d.id, d.ops]));

/** true hvis strengen matcher en kjent ikon-id (i motsetning til rå emoji/tekst). */
export function isIconId(v: string | undefined): v is string {
  return !!v && ICON_MAP.has(v);
}

/** SVG-markup for ikonet, plassert på (cx,cy) med radius r — til bruk INNI en større
 *  SVG-streng (kort-generatorene). `stroke`/`strokeWidth` skalerer med r. */
export function iconToSvg(id: string, cx: number, cy: number, r: number, color: string): string {
  const ops = ICON_MAP.get(id);
  if (!ops) return '';
  const s = r / 10;
  const sw = Math.max(1, r * 0.16);
  const g = (inner: string, extra = '') => `<g transform="translate(${cx} ${cy}) scale(${s})" fill="none" stroke="${color}" stroke-width="${sw / s}" stroke-linecap="round" stroke-linejoin="round" ${extra}>${inner}</g>`;
  const parts = ops.map((op) => {
    if (op.t === 'path') return `<path d="${op.d}" ${op.fill ? `fill="${color}" stroke="none"` : ''}/>`;
    if (op.t === 'line') return `<line x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}"/>`;
    if (op.t === 'circle') return `<circle cx="${op.cx}" cy="${op.cy}" r="${op.r}" ${op.fill ? `fill="${color}" stroke="none"` : ''}/>`;
    return `<rect x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" rx="${op.rx ?? 0}"/>`;
  }).join('');
  return g(parts);
}

/** Tegn ikonet direkte på et 2D-canvas-context (live forhåndsvisning) — samme
 *  ops-liste som iconToSvg, så de to rendrings-veiene aldri kan avvike visuelt. */
export function drawIcon(ctx: CanvasRenderingContext2D, id: string, cx: number, cy: number, r: number, color: string): void {
  const ops = ICON_MAP.get(id);
  if (!ops) return;
  const s = r / 10;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, 10 * 0.16) / 1; // konstant i lokalt (skalert) rom
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const op of ops) {
    ctx.beginPath();
    if (op.t === 'path' && op.d) {
      const p = new Path2D(op.d);
      if (op.fill) ctx.fill(p); else ctx.stroke(p);
    } else if (op.t === 'line') {
      ctx.moveTo(op.x1!, op.y1!); ctx.lineTo(op.x2!, op.y2!); ctx.stroke();
    } else if (op.t === 'circle') {
      ctx.arc(op.cx!, op.cy!, op.r!, 0, Math.PI * 2);
      if (op.fill) ctx.fill(); else ctx.stroke();
    } else if (op.t === 'rect') {
      const rr = op.rx ?? 0;
      const { x, y, w, h } = op as { x: number; y: number; w: number; h: number };
      if (rr > 0) {
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
