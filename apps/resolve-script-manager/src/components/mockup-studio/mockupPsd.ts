/**
 * mockupPsd.ts — lagdelt PSD-eksport av en MockupDoc, uten eksterne libs.
 *
 * Skriver en gyldig Photoshop-fil (8BPS v1, RGB/8-bit) der HVERT element er et
 * eget lag: bakgrunn, ett per enhet, ett per tekst — i tegnerekkefølge. Lagene
 * er full-lerret gjennomsiktige rastere, så one-pageren kan redigeres lag-for-lag
 * i Photoshop (flytt/skjul/omorganiser enheter og tekst). Kanaler er ukomprimert
 * (compression 0) for maksimal kompatibilitet.
 *
 * Referanse: Adobe Photoshop File Format Specification (File Header → Color Mode
 * → Image Resources → Layer & Mask Info → Image Data).
 */

import type { MockupDoc } from './mockupStudioModel';
import { rasterizeMockup, rasterizeLayers } from './mockupRaster';
import { ByteSink, bytesToBase64, planarChannels } from './binWriter';

function canvasChannels(canvas: HTMLCanvasElement): { r: Uint8Array; g: Uint8Array; b: Uint8Array; a: Uint8Array } {
  const ctx = canvas.getContext('2d')!;
  const n = canvas.width * canvas.height;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return planarChannels(data, n);
}

/** Pascal-streng (1 lengde-byte + tegn), padet til multiplum av 4. */
function pascalPadded(name: string): Uint8Array {
  const s = name.slice(0, 255);
  const bytes: number[] = [s.length];
  for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xff);
  while (bytes.length % 4 !== 0) bytes.push(0);
  return new Uint8Array(bytes);
}

// Kanalrekkefølge i både lag-record og kanal-data (må matche): R,G,B,Alpha.
const CHAN: { id: number; key: 'r' | 'g' | 'b' | 'a' }[] = [
  { id: 0, key: 'r' }, { id: 1, key: 'g' }, { id: 2, key: 'b' }, { id: -1, key: 'a' },
];

/** Bygg PSD-bytes for et MockupDoc. */
export async function buildPsdBytes(doc: MockupDoc): Promise<Uint8Array> {
  const W = doc.canvas.w, H = doc.canvas.h;
  const layers = await rasterizeLayers(doc);
  const composite = canvasChannels(await rasterizeMockup(doc, 1));

  // Per-lag kanal-datablokker (2 byte compression=0 + rå plan) i CHAN-rekkefølge.
  const layerBlocks: Uint8Array[][] = layers.map((L) => {
    const ch = canvasChannels(L.canvas);
    return CHAN.map((c) => {
      const raw = ch[c.key];
      const block = new Uint8Array(2 + raw.length); // [0,0] = ukomprimert
      block.set(raw, 2);
      return block;
    });
  });

  // ── Layer info (records + kanal-data) ──
  const info = new ByteSink();
  info.i16(layers.length); // positivt antall lag

  layers.forEach((L, li) => {
    // Grenser (topp, venstre, bunn, høyre) = hele lerretet
    info.i32(0); info.i32(0); info.i32(H); info.i32(W);
    info.u16(4); // antall kanaler
    for (let k = 0; k < 4; k++) {
      info.i16(CHAN[k].id);
      info.u32(layerBlocks[li][k].length); // 2 + W*H
    }
    info.ascii('8BIM'); info.ascii('norm');
    info.u8(255); // opacity
    info.u8(0);   // clipping
    info.u8(0);   // flags
    info.u8(0);   // filler
    const nameBytes = pascalPadded(L.name);
    info.u32(4 + 4 + nameBytes.length); // extra data lengde: mask + ranges + navn
    info.u32(0); // layer mask data (tom)
    info.u32(0); // layer blending ranges (tom)
    info.push(nameBytes);
  });

  // Kanal-data for alle lag (lag-rekkefølge, kanal-rekkefølge)
  for (let li = 0; li < layers.length; li++) {
    for (let k = 0; k < 4; k++) info.push(layerBlocks[li][k]);
  }

  let infoBytes = info.concat();
  if (infoBytes.length % 2 === 1) {
    const padded = new Uint8Array(infoBytes.length + 1);
    padded.set(infoBytes, 0);
    infoBytes = padded; // lag-info må ha jevn lengde
  }

  // Layer & mask-seksjon: u32(layerInfoLen) + layerInfo + u32(globalMask=0)
  const lam = new ByteSink();
  lam.u32(infoBytes.length);
  lam.push(infoBytes);
  lam.u32(0);
  const lamBytes = lam.concat();

  // ── Sett sammen hele filen ──
  const out = new ByteSink();
  // File header
  out.ascii('8BPS');
  out.u16(1);                       // versjon
  out.push(new Uint8Array(6));      // reservert
  out.u16(3);                       // kanaler i komposittet (RGB)
  out.u32(H);
  out.u32(W);
  out.u16(8);                       // dybde
  out.u16(3);                       // fargemodus RGB
  out.u32(0);                       // color mode data (tom)
  out.u32(0);                       // image resources (tom)
  out.u32(lamBytes.length);         // layer & mask-seksjon
  out.push(lamBytes);
  // Composite image data: compression 0 (rå) + R,G,B-plan
  out.u16(0);
  out.push(composite.r);
  out.push(composite.g);
  out.push(composite.b);

  return out.concat();
}

/** Bygg PSD + returner rå base64 (klar for demoWriteBinary). */
export async function buildPsdBase64(doc: MockupDoc): Promise<string> {
  return bytesToBase64(await buildPsdBytes(doc));
}
