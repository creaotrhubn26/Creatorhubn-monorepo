/**
 * Faktura/kreditnota som EKTE PDF — bygget for hånd med de fjorten standardfontene
 * (Helvetica + Courier, WinAnsi-koding). Ingen headless-nettleser, ingen native
 * moduler, ingen ekstra avhengigheter: kjører uendret på Render (der Chromium
 * uansett ikke er installert) og er fullt deterministisk/testbar.
 *
 * Bygger på den delte `InvoiceView`-modellen, så PDF-en og HTML-visningen viser
 * NØYAKTIG det samme (samme § 5-1-1-innhold, samme tall). Tall settes med Courier
 * (fast bredde) slik at høyrejustering blir eksakt uten AFM-breddetabeller.
 */
import type { InvoiceView } from './view.js';

const PAGE_W = 595.28; // A4 i punkt
const PAGE_H = 841.89;
const MARGIN = 56;
const RIGHT = PAGE_W - MARGIN;

/** WinAnsi/Latin-1-koding. æøå ligger i Latin-1; «−» (U+2212) → «-». Ukjent → «?». */
function winAnsiBytes(text: string): number[] {
  const out: number[] = [];
  for (const ch of text.replace(/−/g, '-')) {
    const cp = ch.codePointAt(0) ?? 63;
    out.push(cp <= 0xff ? cp : 63);
  }
  return out;
}

/** PDF-strengliteral: escape \ ( ) og kod tegn som WinAnsi-bytes. */
function pdfString(text: string): string {
  const bytes = winAnsiBytes(text);
  let s = '';
  for (const b of bytes) {
    if (b === 0x5c) s += '\\\\';
    else if (b === 0x28) s += '\\(';
    else if (b === 0x29) s += '\\)';
    else if (b >= 0x20 && b <= 0x7e) s += String.fromCharCode(b);
    else s += '\\' + b.toString(8).padStart(3, '0'); // oktal-escape for 8-bits
  }
  return s;
}

/** Courier er monospace (600/1000 em) — eksakt tekstbredde uten breddetabell. */
function courierWidth(text: string, size: number): number {
  return winAnsiBytes(text).length * 0.6 * size;
}

type Font = 'F1' | 'F2' | 'F3' | 'F4'; // Helvetica, Helvetica-Bold, Courier, Courier-Bold

class Content {
  private ops: string[] = [];

  text(x: number, y: number, str: string, font: Font, size: number, gray?: number): void {
    const color = gray !== undefined ? `${gray} ${gray} ${gray} rg\n` : '';
    const reset = gray !== undefined ? '\n0 0 0 rg' : '';
    this.ops.push(`${color}BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfString(str)}) Tj ET${reset}`);
  }

  /** Courier-tekst med høyre kant på xRight. */
  rightNum(xRight: number, y: number, str: string, size: number, bold = false): void {
    const x = xRight - courierWidth(str, size);
    this.text(x, y, str, bold ? 'F4' : 'F3', size);
  }

  line(x1: number, y1: number, x2: number, y2: number, width = 0.5, gray = 0): void {
    this.ops.push(
      `${gray} ${gray} ${gray} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S 0 0 0 RG`,
    );
  }

  toString(): string {
    return this.ops.join('\n');
  }
}

/** Enkel ordbryting på tegnbudsjett (robust, deterministisk — ingen breddetabell). */
function wrap(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
    while (cur.length > maxChars) {
      lines.push(cur.slice(0, maxChars));
      cur = cur.slice(maxChars);
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Bygger PDF-bytene fra ferdig innholdsstrøm + de fire standardfontene. */
function assemblePdf(content: string): Buffer {
  const fonts: [string, string][] = [
    ['F1', 'Helvetica'],
    ['F2', 'Helvetica-Bold'],
    ['F3', 'Courier'],
    ['F4', 'Courier-Bold'],
  ];
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>'); // 1
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'); // 2
  const fontRefs = fonts.map((_, i) => `/${fonts[i]![0]} ${5 + i} 0 R`).join(' ');
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << ${fontRefs} >> >> /Contents 4 0 R >>`,
  ); // 3
  const stream = Buffer.from(content, 'latin1');
  objects.push(`<< /Length ${stream.length} >>\nstream\n${content}\nendstream`); // 4 (placeholder, rebuilt below)
  for (const [, base] of fonts) {
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`);
  }

  // Bygg fila med korrekte byte-offset (latin1 = 1 byte/tegn, trygt for offset-telling).
  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  let body = '';
  const offsets: number[] = [];
  let pos = Buffer.byteLength(header, 'latin1');
  objects.forEach((obj, idx) => {
    offsets[idx] = pos;
    const chunk = `${idx + 1} 0 obj\n${obj}\nendobj\n`;
    body += chunk;
    pos += Buffer.byteLength(chunk, 'latin1');
  });
  const xrefPos = pos;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${off.toString().padStart(10, '0')} 00000 n \n`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(header + body + xref + trailer, 'latin1');
}

/** Rendrer fakturaen/kreditnotaen til en PDF-buffer. Én side, A4. */
export function renderInvoicePdf(view: InvoiceView): Buffer {
  const c = new Content();
  let y = PAGE_H - MARGIN;

  // ── Tittel + selger (topp) ────────────────────────────────────────────────
  c.text(MARGIN, y, view.title, 'F2', 22);
  let sy = y;
  for (const [i, l] of view.sellerLines.entries()) {
    const size = i === 0 ? 11 : 9;
    // Selgerblokk høyrejusteres. Helvetica har ingen fast bredde her, så bredden
    // anslås grovt (0.5 em/tegn) — godt nok for en høyrejustert adresseblokk.
    const approxW = l.length * (size * 0.5);
    c.text(RIGHT - approxW, sy, l, i === 0 ? 'F2' : 'F1', size, i === 0 ? undefined : 0.25);
    sy -= size + 3;
  }
  y -= 30;

  // ── Meta (nummer, datoer, KID …) ──────────────────────────────────────────
  for (const [k, v] of view.meta) {
    c.text(MARGIN, y, k, 'F1', 9, 0.4);
    c.text(MARGIN + 110, y, v, 'F1', 9);
    y -= 14;
  }
  y -= 10;

  // ── Kjøper ────────────────────────────────────────────────────────────────
  c.text(MARGIN, y, view.buyerHeading.toUpperCase(), 'F2', 9, 0.4);
  y -= 15;
  for (const [i, l] of view.buyerLines.entries()) {
    c.text(MARGIN, y, l, i === 0 ? 'F2' : 'F1', i === 0 ? 11 : 10);
    y -= (i === 0 ? 11 : 10) + 4;
  }
  y -= 14;

  // ── Linjer ────────────────────────────────────────────────────────────────
  const COL = { qty: 360, price: 430, vat: 480, net: RIGHT };
  const header = () => {
    c.text(MARGIN, y, 'Beskrivelse', 'F2', 8, 0.4);
    c.rightNum(COL.qty, y, 'Antall', 8, true);
    c.rightNum(COL.price, y, 'Pris', 8, true);
    c.rightNum(COL.vat, y, 'Mva', 8, true);
    c.rightNum(COL.net, y, 'Beløp', 8, true);
    y -= 6;
    c.line(MARGIN, y, RIGHT, y, 1, 0.1);
    y -= 14;
  };
  header();
  for (const l of view.lines) {
    const descLines = wrap(l.description, 46);
    descLines.forEach((dl, i) => {
      c.text(MARGIN, y, dl, 'F1', 10);
      if (i === 0) {
        c.rightNum(COL.qty, y, l.qty, 10);
        c.rightNum(COL.price, y, l.unitPrice, 10);
        c.rightNum(COL.vat, y, l.vat, 10);
        c.rightNum(COL.net, y, l.net, 10);
      }
      y -= 15;
    });
    c.line(MARGIN, y + 4, RIGHT, y + 4, 0.3, 0.7);
  }
  y -= 12;

  // ── Merverdiavgift per sats ───────────────────────────────────────────────
  c.text(MARGIN, y, 'Merverdiavgift per sats', 'F2', 10);
  y -= 16;
  c.text(MARGIN, y, 'Behandling', 'F2', 8, 0.4);
  c.rightNum(COL.price, y, 'Sats', 8, true);
  c.rightNum(COL.vat + 10, y, 'Grunnlag', 8, true);
  c.rightNum(COL.net, y, 'Mva', 8, true);
  y -= 6;
  c.line(MARGIN, y, RIGHT, y, 0.5, 0.3);
  y -= 14;
  for (const v of view.vat) {
    c.text(MARGIN, y, v.treatment, 'F1', 10);
    c.rightNum(COL.price, y, `${v.rate} %`, 10);
    c.rightNum(COL.vat + 10, y, v.base, 10);
    c.rightNum(COL.net, y, v.vat, 10);
    y -= 15;
  }
  y -= 14;

  // ── Totaler ───────────────────────────────────────────────────────────────
  const labelX = 360;
  c.text(labelX, y, 'Sum eks. mva', 'F1', 10, 0.3);
  c.rightNum(RIGHT, y, view.netTotal, 10);
  y -= 16;
  c.text(labelX, y, 'Merverdiavgift', 'F1', 10, 0.3);
  c.rightNum(RIGHT, y, view.vatTotal, 10);
  y -= 8;
  c.line(labelX, y, RIGHT, y, 1, 0);
  y -= 16;
  c.text(labelX, y, view.grandLabel, 'F2', 13);
  c.rightNum(RIGHT, y, `${view.grossTotal} kr`, 13, true);
  y -= 26;

  if (view.hasExemptFootnote) {
    c.text(MARGIN, y, '* Omsetning fritatt for eller unntatt fra merverdiavgift.', 'F1', 8, 0.4);
  }

  return assemblePdf(c.toString());
}
