/**
 * binWriter.ts — bittesmå byte-hjelpere for selvstendig PDF-/PSD-skriving
 * (ingen eksterne libs). Big-endian, akkumulerer chunks og setter dem sammen
 * til slutt, så store rå-kanaler kan pushes uten kopier underveis.
 */

export class ByteSink {
  private chunks: Uint8Array[] = [];
  len = 0;

  push(u8: Uint8Array): void {
    this.chunks.push(u8);
    this.len += u8.length;
  }
  u8(v: number): void { this.push(new Uint8Array([v & 0xff])); }
  u16(v: number): void { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v & 0xffff, false); this.push(b); }
  i16(v: number): void { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, v, false); this.push(b); }
  u32(v: number): void { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, false); this.push(b); }
  i32(v: number): void { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v | 0, false); this.push(b); }
  ascii(s: string): void {
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
    this.push(b);
  }
  concat(): Uint8Array {
    const out = new Uint8Array(this.len);
    let o = 0;
    for (const c of this.chunks) { out.set(c, o); o += c.length; }
    return out;
  }
}

/** Base64 av en byte-array (chunket, tåler store buffere). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)) as number[]);
  }
  return btoa(bin);
}

/** Dekod base64 (uten data-URL-prefiks) til bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Interleaved RGBA (fra getImageData) → fire planare 8-bit kanaler. */
export function planarChannels(data: Uint8ClampedArray, n: number): { r: Uint8Array; g: Uint8Array; b: Uint8Array; a: Uint8Array } {
  const r = new Uint8Array(n), g = new Uint8Array(n), b = new Uint8Array(n), a = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    r[i] = data[j]; g[i] = data[j + 1]; b[i] = data[j + 2]; a[i] = data[j + 3];
  }
  return { r, g, b, a };
}
