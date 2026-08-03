/**
 * mockupSmartCrop.ts — innholds-bevisst fokuspunkt for cover-beskjæring.
 *
 * I stedet for å beskjære skjermbilder mot midten, finner vi tyngdepunktet av
 * DETALJ (gradient-magnitude på luminans) — som regel der innholdet er (UI,
 * tekst, diagrammer), ikke tomme flater — og lar cover-croppen fokusere der.
 * 100% klient-side canvas, ingen avhengigheter. Faller tilbake til null (behold
 * senter) for flate/detalj-fattige bilder.
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('smart-crop: kunne ikke laste bilde'));
    img.src = src;
  });
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Beregn et innholds-bevisst fokuspunkt (0..1) for et bilde. Returnerer null
 * hvis bildet er for flatt (da beholdes senter 0.5/0.5).
 */
export async function computeSmartFocus(dataUrl: string): Promise<{ focusX: number; focusY: number } | null> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch {
    return null;
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;

  const S = 96;
  const scale = S / Math.max(iw, ih);
  const w = Math.max(3, Math.round(iw * scale));
  const h = Math.max(3, Math.round(ih * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }

  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    lum[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  // Vektet tyngdepunkt av gradient-magnitude (|dx| + |dy|).
  let sx = 0, sy = 0, st = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const g = Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + w] - lum[i - w]);
      sx += x * g; sy += y * g; st += g;
    }
  }
  // For lite detalj (nesten ensfarget) → behold senter.
  if (st < w * h * 2) return null;

  return {
    focusX: clamp(sx / st / w, 0.2, 0.8),
    focusY: clamp(sy / st / h, 0.2, 0.8),
  };
}
