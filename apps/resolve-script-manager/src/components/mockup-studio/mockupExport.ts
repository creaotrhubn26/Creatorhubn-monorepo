/**
 * mockupExport.ts — PDF-eksport av en MockupDoc, uten eksterne libs.
 *
 * Rasteriserer one-pageren til en JPEG og legger den inn som et bilde-XObject
 * i en minimal, gyldig énsides-PDF (DCTDecode). Byte-nøyaktig xref, så filen
 * åpnes i enhver PDF-leser. Til deling/utskrift av mockupen som ett dokument.
 */

import type { MockupDoc } from './mockupStudioModel';
import { rasterizeMockup } from './mockupRaster';
import { ByteSink, bytesToBase64, base64ToBytes } from './binWriter';

function pad10(n: number): string {
  return String(n).padStart(10, '0');
}

/**
 * Bygg en PDF (én side = one-pageren) og returner rå base64 (klar for
 * demoWriteBinary). `quality` = JPEG-kvalitet (0..1).
 */
export async function buildPdfBase64(doc: MockupDoc, quality = 0.92): Promise<string> {
  const canvas = await rasterizeMockup(doc, 1);
  const iw = canvas.width, ih = canvas.height;
  const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
  const jpeg = base64ToBytes(jpegDataUrl.split(',')[1] ?? '');

  // Sideformat i punkter: skalér så lengste side ≈ 1000 pt (cosmetisk).
  const k = 1000 / Math.max(iw, ih);
  const pw = Math.round(iw * k);
  const ph = Math.round(ih * k);

  const sink = new ByteSink();
  const offsets: number[] = [];

  sink.ascii('%PDF-1.4\n');
  sink.push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // binær-markør

  const obj = (n: number, body: string, stream?: Uint8Array) => {
    offsets[n] = sink.len;
    sink.ascii(`${n} 0 obj\n`);
    sink.ascii(body);
    if (stream) {
      sink.ascii('\nstream\n');
      sink.push(stream);
      sink.ascii('\nendstream');
    }
    sink.ascii('\nendobj\n');
  };

  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  const contentBytes = new Uint8Array(content.length);
  for (let i = 0; i < content.length; i++) contentBytes[i] = content.charCodeAt(i) & 0xff;

  obj(1, '<</Type/Catalog/Pages 2 0 R>>');
  obj(2, '<</Type/Pages/Kids[3 0 R]/Count 1>>');
  obj(3, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pw} ${ph}]/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>`);
  obj(4, `<</Type/XObject/Subtype/Image/Width ${iw}/Height ${ih}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpeg.length}>>`, jpeg);
  obj(5, `<</Length ${contentBytes.length}>>`, contentBytes);

  const xref = sink.len;
  sink.ascii('xref\n0 6\n');
  sink.ascii('0000000000 65535 f \n');
  for (let n = 1; n <= 5; n++) sink.ascii(`${pad10(offsets[n])} 00000 n \n`);
  sink.ascii(`trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`);

  return bytesToBase64(sink.concat());
}
