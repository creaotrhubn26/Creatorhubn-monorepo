/**
 * mockupLibraryIngest.ts — delt import-logikk for prosjekt-biblioteket.
 * Tar en bilde-dataURL → genererer thumbnail + leser dimensjoner → skriver til IndexedDB
 * og returnerer meta. Brukt både av manuell import (panel) og auto-mappe fra pipeline (capture).
 */
import { uid } from './mockupStudioModel';
import { idbAddAsset, type LibraryMeta } from './mockupLibraryDb';

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img')); i.src = src; });
}
function thumbOf(img: HTMLImageElement, max = 240): string {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  cv.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return cv.toDataURL('image/jpeg', 0.72);
}

/** Estimér byte-størrelse på en dataURL (base64-payload × 3/4). */
export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  return i < 0 ? dataUrl.length : Math.round((dataUrl.length - i - 1) * 0.75);
}

/** Importer én bilde-dataURL til biblioteket (thumb + IDB). Returnerer meta for state. */
export async function ingestImage(name: string, dataUrl: string, folder: string, source: string): Promise<LibraryMeta> {
  const img = await loadImg(dataUrl);
  const meta: LibraryMeta = {
    id: uid('lib'), name: name.replace(/\.[^.]+$/, ''), folder: folder || '/',
    tags: [], w: img.naturalWidth, h: img.naturalHeight, size: dataUrlBytes(dataUrl), addedAt: Date.now(),
    thumb: thumbOf(img), source,
  };
  await idbAddAsset(meta, dataUrl);
  return meta;
}
