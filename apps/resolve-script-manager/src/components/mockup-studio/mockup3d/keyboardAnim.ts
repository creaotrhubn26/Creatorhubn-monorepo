/**
 * keyboardAnim.ts — skrive-animasjon: teksten skrives tegn-for-tegn mens riktig
 * tast trykkes. To flater: laptop (fysisk dekk, 14×5-grid) + telefon/tablet
 * (on-screen QWERTY tegnet nederst på skjermen). Ren, testbar (ingen Three-avh.).
 */

/** Tilstand ved progresjon t∈[0,1]: hvor mye er skrevet + hvilken tast trykkes nå. */
export function typedState(text: string, t: number): { typed: string; pressed: string | null } {
  const n = text.length;
  if (n === 0) return { typed: '', pressed: null };
  const pos = Math.max(0, Math.min(1, t)) * n;
  const count = Math.max(0, Math.min(n, Math.floor(pos + 0.5)));
  const pressed = t < 1 && count > 0 ? text[count - 1] : null;
  return { typed: text.slice(0, count), pressed };
}


/** Fysisk laptop-tastatur. Én tast: label + relativ bredde + valgfritt tegn (for trykk-match). */
export type DeckKey = { label: string; w: number; char?: string; sub?: string };
export type KbLayout = 'mac' | 'windows';

/** Bokstav-/tall-taster fra en streng (char = små bokstaver, label = store). */
function keys(str: string, w = 1): DeckKey[] {
  return [...str].map((c) => ({ label: c.toUpperCase(), w, char: c }));
}

/** Komplett tastatur-layout (6 rader), Mac eller Windows. Rekker normaliseres til full bredde. */
export function deckRows(layout: KbLayout): DeckKey[][] {
  const fn: DeckKey[] = [
    { label: 'esc', w: 1.3 },
    ...Array.from({ length: 12 }, (_, i) => ({ label: `F${i + 1}`, w: 1 })),
    { label: layout === 'mac' ? '⌫' : 'del', w: 1.1 },
  ];
  const numRow: DeckKey[] = [
    { label: '`', w: 1, char: '`' }, ...keys('1234567890'), { label: '-', w: 1, char: '-' }, { label: '=', w: 1, char: '=' },
    { label: layout === 'mac' ? '⌫' : 'Backspace', w: 1.9 },
  ];
  const topRow: DeckKey[] = [
    { label: 'tab', w: 1.5 }, ...keys('qwertyuiop'),
    { label: '[', w: 1, char: '[' }, { label: ']', w: 1, char: ']' }, { label: '\\', w: 1.5, char: '\\' },
  ];
  const homeRow: DeckKey[] = [
    { label: layout === 'mac' ? 'caps' : 'Caps', w: 1.8 }, ...keys('asdfghjkl'),
    { label: ';', w: 1, char: ';' }, { label: "'", w: 1, char: "'" },
    { label: layout === 'mac' ? 'return' : 'Enter', w: 2.2 },
  ];
  const shiftRow: DeckKey[] = [
    { label: 'shift', w: 2.4 }, ...keys('zxcvbnm'),
    { label: ',', w: 1, char: ',' }, { label: '.', w: 1, char: '.' }, { label: '/', w: 1, char: '/' },
    { label: 'shift', w: 2.6 },
  ];
  const modRow: DeckKey[] = layout === 'mac'
    ? [
        { label: 'fn', w: 1 }, { label: '⌃', w: 1.1, sub: 'control' }, { label: '⌥', w: 1.1, sub: 'option' }, { label: '⌘', w: 1.3, sub: 'command' },
        { label: '', w: 6, char: ' ' },
        { label: '⌘', w: 1.3, sub: 'command' }, { label: '⌥', w: 1.1, sub: 'option' },
        { label: '◀', w: 0.9 }, { label: '▲▼', w: 0.9 }, { label: '▶', w: 0.9 },
      ]
    : [
        { label: 'Ctrl', w: 1.3 }, { label: '⊞', w: 1.1, sub: 'Win' }, { label: 'Alt', w: 1.1 },
        { label: '', w: 6, char: ' ' },
        { label: 'Alt', w: 1.1 }, { label: '⊞', w: 1.1, sub: 'Win' }, { label: '▤', w: 1 }, { label: 'Ctrl', w: 1.3 },
        { label: '◀', w: 0.9 }, { label: '▶', w: 0.9 },
      ];
  return [fn, numRow, topRow, homeRow, shiftRow, modRow];
}

/**
 * Taste-pop: en keycap m/ tegnet som svever OPP og fader mens man taster.
 * `rise` 0..1 = hvor langt inn i tastetrykket (0 = nettopp trykt, 1 = svevet bort).
 * baseY = fraksjon der capen starter.
 */
export function drawKeyPop(x: CanvasRenderingContext2D, W: number, H: number, ch: string, rise: number, baseY: number): void {
  if (!ch || ch === ' ') return;
  const s = Math.min(W, H) * 0.11;
  const cx = W * 0.5;
  const cy = baseY * H - rise * H * 0.16;
  const alpha = Math.max(0, 1 - rise);
  x.save();
  x.globalAlpha = alpha;
  x.translate(cx, cy);
  const sc = 0.9 + rise * 0.3; x.scale(sc, sc);
  x.fillStyle = '#ffffff'; x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = s * 0.25; x.shadowOffsetY = s * 0.08;
  if (typeof x.roundRect === 'function') { x.beginPath(); x.roundRect(-s / 2, -s / 2, s, s, s * 0.18); x.fill(); }
  else x.fillRect(-s / 2, -s / 2, s, s);
  x.shadowColor = 'transparent';
  x.fillStyle = '#0b1220'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `700 ${Math.round(s * 0.56)}px -apple-system, "SF Pro Text", system-ui, sans-serif`;
  x.fillText(ch.toUpperCase(), 0, 0);
  x.restore();
}

/** On-screen-tastatur-rader (iOS-stil). */
const OSK_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/**
 * Tegn et tekstfelt (skrevet tekst + caret) på skjerm-canvaset.
 * y0 = topp-fraksjon der feltet begynner (0..1). Skala relativt til W.
 */
export function drawTextField(x: CanvasRenderingContext2D, W: number, H: number, typed: string, y0: number, blinkOn: boolean): void {
  const pad = W * 0.05, fh = Math.max(28, H * 0.045);
  const fy = y0 * H, fw = W - pad * 2, fx = pad;
  x.save();
  x.fillStyle = 'rgba(255,255,255,0.92)';
  if (typeof x.roundRect === 'function') { x.beginPath(); x.roundRect(fx, fy, fw, fh * 1.5, fh * 0.3); x.fill(); }
  else x.fillRect(fx, fy, fw, fh * 1.5);
  x.fillStyle = '#0b1220';
  x.font = `500 ${Math.round(fh)}px -apple-system, "SF Pro Text", system-ui, sans-serif`;
  x.textBaseline = 'middle'; x.textAlign = 'left';
  const tx = fx + pad * 0.5, ty = fy + fh * 0.75;
  x.fillText(typed, tx, ty);
  if (blinkOn) {
    const cw = x.measureText(typed).width;
    x.fillStyle = '#2563eb';
    x.fillRect(tx + cw + 2, fy + fh * 0.28, Math.max(2, W * 0.004), fh * 0.94);
  }
  x.restore();
}

/**
 * Tegn on-screen QWERTY nederst på skjermen (telefon/tablet) og highlight tasten
 * som trykkes. Returnerer y-toppen (fraksjon) tastaturet begynner på (så feltet
 * kan plasseres rett over).
 */
export function drawOnScreenKeyboard(x: CanvasRenderingContext2D, W: number, H: number, pressed: string | null): number {
  const kbTop = 0.62, kbH = H * (1 - kbTop), kbY = kbTop * H;
  x.save();
  x.fillStyle = '#1c1c1e'; x.fillRect(0, kbY, W, kbH); // tastatur-bakgrunn (mørk iOS)
  const rows = OSK_ROWS;
  const rowH = kbH / 4.6, keyPad = W * 0.008;
  const p = pressed ? pressed.toLowerCase() : null;
  const drawKey = (kx: number, ky: number, kw: number, kh: number, label: string, hot: boolean) => {
    x.fillStyle = hot ? '#3b82f6' : '#4a4a4d';
    if (typeof x.roundRect === 'function') { x.beginPath(); x.roundRect(kx, ky, kw, kh, kh * 0.16); x.fill(); }
    else x.fillRect(kx, ky, kw, kh);
    if (label) {
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `500 ${Math.round(kh * 0.5)}px -apple-system, system-ui, sans-serif`;
      x.fillText(label.toUpperCase(), kx + kw / 2, ky + kh / 2);
    }
  };
  for (let r = 0; r < rows.length; r++) {
    const chars = rows[r];
    const n = chars.length;
    const inset = r === 1 ? W * 0.05 : r === 2 ? W * 0.10 : 0;
    const avail = W - inset * 2 - keyPad * (n + 1);
    const kw = avail / n, kh = rowH * 0.82;
    const ky = kbY + keyPad + r * rowH;
    for (let c = 0; c < n; c++) {
      const kx = inset + keyPad + c * (kw + keyPad);
      drawKey(kx, ky, kw, kh, chars[c], p === chars[c]);
    }
  }
  // Mellomrom-rad.
  const ky = kbY + keyPad + 3 * rowH, kh = rowH * 0.82;
  const spX = W * 0.22, spW = W * 0.56;
  drawKey(spX, ky, spW, kh, '', p === ' ');
  x.restore();
  return kbTop;
}
