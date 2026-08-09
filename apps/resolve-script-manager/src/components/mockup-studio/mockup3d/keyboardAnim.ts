/**
 * keyboardAnim.ts — skrive-animasjon: teksten skrives tegn-for-tegn mens riktig
 * tast trykkes. To flater: laptop (fysisk dekk, 14×5-grid) + telefon/tablet
 * (on-screen QWERTY tegnet nederst på skjermen). Ren, testbar (ingen Three-avh.).
 */

/**
 * Per-tegn «kostnad» (relativ varighet) → humanisert rytme. Deterministisk (ingen
 * random, så Three.js + Blender/PIL matcher): pauser på mellomrom/tegnsetting,
 * ease-in på de første tegnene, og en liten indeks-basert jitter.
 */
function charWeight(ch: string, i: number): number {
  let w = 1;
  if (ch === ' ') w = 2.4;
  else if ('.!?'.includes(ch)) w = 3.2;
  else if (',;:'.includes(ch)) w = 1.9;
  if (i < 3) w *= 1.35;                 // ease-in (nøler i starten)
  w *= 0.82 + 0.36 * (((i * 2654435761) % 97) / 97); // deterministisk jitter
  return w;
}

/** Kumulativ normalisert tidslinje for skriving (0..1 per tegn-grense). */
function schedule(text: string): number[] {
  const cum: number[] = [0];
  let s = 0;
  for (let i = 0; i < text.length; i++) { s += charWeight(text[i], i); cum.push(s); }
  const total = s || 1;
  return cum.map((c) => c / total);
}

/**
 * Skrive-tilstand ved progresjon t∈[0,1]. `payoff` reserverer siste ~28% til et
 * resultat-øyeblikk (typing fullføres tidligere). `correct` fletter inn en
 * typo→slett→korriger på ett ord (menneskelig). Returnerer alt renderen trenger.
 */
export interface TypeState { typed: string; pressed: string | null; next: string | null; sub: number; caret: boolean; done: boolean; payoff: number; }
export function typedState(text: string, t: number, opts?: { payoff?: boolean; correct?: boolean }): TypeState {
  const n = text.length;
  if (n === 0) return { typed: '', pressed: null, next: null, sub: 1, caret: false, done: true, payoff: 0 };
  const typeEnd = opts?.payoff ? 0.72 : 0.96;
  const tt = Math.max(0, Math.min(1, t));
  const payoff = opts?.payoff && tt > typeEnd ? (tt - typeEnd) / (1 - typeEnd) : 0;
  const localT = Math.min(1, tt / typeEnd); // 0..1 over skrive-fasen
  const cum = schedule(text);
  let count = 0;
  while (count < n && cum[count + 1] <= localT) count++;
  const next = count < n ? text[count] : null; // tegnet som skrives NÅ
  const sub = count < n ? Math.max(0, Math.min(1, (localT - cum[count]) / Math.max(1e-6, cum[count + 1] - cum[count]))) : 1;
  // Korreksjon: nær ~55% vis ett feil tegn kort før det «slettes» og korrigeres.
  let typed = text.slice(0, count);
  if (opts?.correct && n > 4) {
    const g = Math.floor(n * 0.55);
    if (count === g && sub < 0.5) typed = text.slice(0, g) + 'x';
  }
  const caret = (Math.floor(localT * n * 2) % 2 === 0) && payoff === 0;
  return { typed, pressed: next, next, sub, caret, done: count >= n, payoff };
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

export type FieldStyle = 'plain' | 'search' | 'chat' | 'url' | 'document' | 'code' | 'terminal';

function rr(x: CanvasRenderingContext2D, a: number, b: number, w: number, h: number, r: number): void {
  x.beginPath();
  if (typeof x.roundRect === 'function') x.roundRect(a, b, w, h, r);
  else { x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
}

/** Tekst m/ horisontal overflow-scroll (halen + caret holdes i syne). */
function fieldText(x: CanvasRenderingContext2D, text: string, tx: number, ty: number, innerW: number, color: string, caret: boolean, caretColor: string, fh: number): void {
  const full = x.measureText(text).width;
  const off = full > innerW ? innerW - full : 0; // scroll når teksten er lengre enn feltet
  x.save();
  x.beginPath(); x.rect(tx, ty - fh, innerW + fh, fh * 2); x.clip();
  x.fillStyle = color; x.fillText(text, tx + off, ty);
  if (caret) { x.fillStyle = caretColor; x.fillRect(tx + off + full + 2, ty - fh * 0.46, Math.max(2, fh * 0.06), fh * 0.92); }
  x.restore();
}

const CODE_KW = new Set(['const', 'let', 'var', 'function', 'func', 'fn', 'return', 'if', 'else', 'for', 'while', 'import', 'export', 'from', 'new', 'await', 'async', 'class', 'struct', 'enum', 'extends', 'true', 'false', 'null', 'nil', 'undefined', 'type', 'interface', 'def', 'print', 'guard']);

/** Enkel tokenizer for syntaks-farging (Catppuccin-aktige farger på mørkt felt). */
function tokenizeCode(s: string): { t: string; c: string }[] {
  const out: { t: string; c: string }[] = [];
  const re = /("[^"]*"?|'[^']*'?|`[^`]*`?|\d[\d.]*|[A-Za-z_$][\w$]*|\s+|[^\s\w])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const t = m[0];
    let c = '#e6e6f0';
    if (/^["'`]/.test(t)) c = '#a6e3a1';            // streng
    else if (/^\d/.test(t)) c = '#fab387';          // tall
    else if (CODE_KW.has(t)) c = '#cba6f7';         // nøkkelord
    else if (/^[A-Za-z_$]/.test(t)) c = '#89b4fa';  // identifikator
    else if (!/^\s/.test(t)) c = '#94a3b8';         // tegnsetting
    out.push({ t, c });
  }
  return out;
}

/** Tegn farget kode med horisontal overflow-scroll + caret. Font settes av kaller. */
function drawCodeText(x: CanvasRenderingContext2D, s: string, tx: number, ty: number, innerW: number, caret: boolean, fh: number): void {
  const spans = tokenizeCode(s);
  const total = spans.reduce((w, sp) => w + x.measureText(sp.t).width, 0);
  const off = total > innerW ? innerW - total : 0;
  x.save();
  x.beginPath(); x.rect(tx, ty - fh, innerW + fh, fh * 2); x.clip();
  let cx = tx + off;
  for (const sp of spans) { x.fillStyle = sp.c; x.fillText(sp.t, cx, ty); cx += x.measureText(sp.t).width; }
  if (caret) { x.fillStyle = '#e6e6f0'; x.fillRect(cx + 2, ty - fh * 0.46, Math.max(2, fh * 0.06), fh * 0.92); }
  x.restore();
}

/**
 * Tegn skrive-feltet i valgt kontekst-stil (search/chat/url/document/code/terminal)
 * med overflow-scroll, placeholder og payoff-øyeblikk. y0 = topp-fraksjon (0..1).
 */
export function drawField(x: CanvasRenderingContext2D, W: number, H: number, st: TypeState, y0: number, opts?: { style?: FieldStyle; placeholder?: string }): void {
  const style = opts?.style ?? 'plain';
  const pad = W * 0.05, fh = Math.max(28, H * 0.045);
  const fy = y0 * H, fw = W - pad * 2, fx = pad, fieldH = fh * 1.6;
  const empty = st.typed.length === 0;
  const shown = empty && opts?.placeholder ? opts.placeholder : st.typed;
  const mono = `500 ${Math.round(fh)}px ui-monospace, "SF Mono", Menlo, monospace`;
  const sans = `500 ${Math.round(fh)}px -apple-system, "SF Pro Text", system-ui, sans-serif`;
  x.save();
  x.textBaseline = 'middle'; x.textAlign = 'left';
  const ty = fy + fieldH / 2;

  if (style === 'document') {
    x.font = sans;
    fieldText(x, shown, fx, ty, fw, empty ? 'rgba(15,23,42,0.35)' : '#0b1220', st.caret, '#2563eb', fh);
    if (st.payoff > 0) { x.globalAlpha = st.payoff; x.fillStyle = '#16a34a'; x.font = `700 ${Math.round(fh)}px ${sans}`; x.fillText('✓', fx + fw - fh, ty + fieldH); }
    x.restore(); return;
  }
  if (style === 'code' || style === 'terminal') {
    const dark = style === 'terminal' ? '#0b0f0b' : '#1e1e2e';
    x.fillStyle = dark; rr(x, fx, fy, fw, fieldH, fh * 0.18); x.fill();
    x.font = mono;
    const prompt = style === 'terminal' ? '$ ' : '1  ';
    x.fillStyle = style === 'terminal' ? '#6ee7a8' : '#7f849c';
    x.fillText(prompt, fx + pad * 0.4, ty);
    const px0 = fx + pad * 0.4 + x.measureText(prompt).width;
    const innerW = fw - (px0 - fx) - pad * 0.4;
    if (style === 'code' && !empty) drawCodeText(x, shown, px0, ty, innerW, st.caret, fh); // syntaks-farging
    else fieldText(x, shown, px0, ty, innerW, empty ? 'rgba(255,255,255,0.3)' : (style === 'terminal' ? '#c7f9cc' : '#e6e6f0'), st.caret, style === 'terminal' ? '#6ee7a8' : '#e6e6f0', fh);
    if (st.payoff > 0) { x.globalAlpha = st.payoff; x.fillStyle = '#6ee7a8'; x.fillText(style === 'terminal' ? '✓ ok' : '✓ done', fx + pad * 0.4, ty + fieldH); }
    x.restore(); return;
  }
  // Pille-baserte stiler (plain/search/chat/url).
  const bg = style === 'url' ? '#e9edf3' : 'rgba(255,255,255,0.95)';
  x.fillStyle = bg; rr(x, fx, fy, fw, fieldH, fieldH * 0.5); x.fill();
  let tx = fx + pad * 0.55;
  if (style === 'search') { // forstørrelsesglass
    const cxi = fx + fh * 0.75, cyi = ty, rad = fh * 0.32;
    x.strokeStyle = '#64748b'; x.lineWidth = Math.max(2, fh * 0.09);
    x.beginPath(); x.arc(cxi, cyi, rad, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(cxi + rad * 0.7, cyi + rad * 0.7); x.lineTo(cxi + rad * 1.4, cyi + rad * 1.4); x.stroke();
    tx = cxi + rad * 1.6;
  } else if (style === 'url') { // hengelås
    x.fillStyle = '#64748b'; const lx = fx + fh * 0.7, ly = ty;
    rr(x, lx - fh * 0.18, ly - fh * 0.04, fh * 0.36, fh * 0.3, fh * 0.06); x.fill();
    x.strokeStyle = '#64748b'; x.lineWidth = Math.max(2, fh * 0.07); x.beginPath(); x.arc(lx, ly - fh * 0.1, fh * 0.13, Math.PI, 0); x.stroke();
    tx = lx + fh * 0.5;
  }
  x.font = sans;
  const innerW = fw - (tx - fx) - (style === 'chat' ? fieldH : pad * 0.5);
  fieldText(x, shown, tx, ty, innerW, empty ? 'rgba(15,23,42,0.38)' : '#0b1220', st.caret, '#2563eb', fh);
  if (style === 'chat') { // send-knapp
    const sc = fx + fw - fieldH * 0.62, sr = fieldH * 0.4;
    x.fillStyle = st.typed ? '#2563eb' : '#c7d0dc'; x.beginPath(); x.arc(sc, ty, sr, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = Math.max(2, fh * 0.09); x.beginPath();
    x.moveTo(sc - sr * 0.35, ty); x.lineTo(sc + sr * 0.35, ty); x.moveTo(sc + sr * 0.05, ty - sr * 0.3); x.lineTo(sc + sr * 0.35, ty); x.lineTo(sc + sr * 0.05, ty + sr * 0.3); x.stroke();
  }
  // Payoff: chat → sendt boble + svar-prikker; search/url → resultat-/loading-hint.
  if (st.payoff > 0) {
    x.globalAlpha = Math.min(1, st.payoff * 1.4);
    if (style === 'chat') {
      const bw = Math.min(fw * 0.7, x.measureText(st.typed).width + pad), bx = fx + fw - bw, byy = fy - fieldH * 1.2;
      x.fillStyle = '#2563eb'; rr(x, bx, byy, bw, fieldH, fieldH * 0.4); x.fill();
      x.fillStyle = '#fff'; x.font = sans; x.fillText(st.typed, bx + pad * 0.5, byy + fieldH / 2);
      if (st.payoff > 0.5) { const dy = byy + fieldH * 1.4; x.fillStyle = '#cbd5e1'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(fx + fh * 0.6 + i * fh * 0.5, dy + fieldH / 2, fh * 0.14, 0, Math.PI * 2); x.fill(); } }
    } else if (style === 'search') {
      for (let i = 0; i < 3; i++) { const ry = fy + fieldH * (1.25 + i * 0.85); x.fillStyle = 'rgba(255,255,255,0.9)'; rr(x, fx, ry, fw * (0.9 - i * 0.12), fieldH * 0.7, fh * 0.2); x.fill(); }
    } else if (style === 'url') {
      x.fillStyle = '#2563eb'; x.fillRect(fx, fy + fieldH + 4, fw * Math.min(1, st.payoff * 1.6), Math.max(3, fh * 0.12));
    }
  }
  x.restore();
}

/** Bakover-kompat: enkel hvit felt-stil (brukes av eldre kall). */
export function drawTextField(x: CanvasRenderingContext2D, W: number, H: number, typed: string, y0: number, blinkOn: boolean): void {
  drawField(x, W, H, { typed, pressed: null, next: null, sub: 1, caret: blinkOn, done: false, payoff: 0 }, y0);
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
