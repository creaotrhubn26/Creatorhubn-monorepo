/**
 * mockupGifExport.ts — Fase 4: animert GIF-eksport av avsløringen.
 *
 * Gjenbruker renderMotionFrames (samme avsløring som WebM-veien) og koder til
 * GIF89a med gifenc (MIT, dep-fri: per-frame median-cut-kvantisering + LZW).
 * 100 % frontend. Lavere fps/oppløsning enn video for håndterbar filstørrelse.
 */

import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { save as saveFileDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { renderMotionFrames } from './mockupRaster';
import { safeDocName, type MockupDoc } from './mockupStudioModel';
import { demoWriteBinary } from '../../api';
import type { MotionConfig } from './mockupMotion';

const GIF_FPS = 12;      // GIF-er ser fine ut på 12 fps og holder størrelsen nede
const GIF_SCALE = 0.5;   // halv oppløsning = mindre fil

function base64FromBytes(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/** Render avsløringen + kod til GIF. Returnerer rå base64 (klar for demoWriteBinary). */
export async function exportGif(doc: MockupDoc, cfg: MotionConfig, onProgress?: (label: string, frac: number) => void): Promise<string> {
  const gcfg: MotionConfig = { ...cfg, fps: GIF_FPS };
  onProgress?.('Rendrer frames…', 0);
  const frames = await renderMotionFrames(doc, gcfg, GIF_SCALE, (d, t) => onProgress?.('Rendrer frames…', 0.5 * (d / t)));
  if (frames.length === 0) throw new Error('Ingen frames å kode.');

  const enc = GIFEncoder();
  const delay = Math.round(1000 / GIF_FPS);
  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i];
    const fctx = fr.getContext('2d');
    if (!fctx) continue;
    const { data, width, height } = fctx.getImageData(0, 0, fr.width, fr.height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    enc.writeFrame(index, width, height, { palette, delay });
    onProgress?.('Koder GIF…', 0.5 + 0.5 * ((i + 1) / frames.length));
  }
  enc.finish();
  onProgress?.('Ferdig', 1);
  return base64FromBytes(enc.bytes());
}

/** Full flyt: spør om sti → render + kod → lagre → åpne. Null hvis avbrutt. */
export async function exportAndSaveGif(doc: MockupDoc, cfg: MotionConfig, onProgress?: (label: string, frac: number) => void): Promise<string | null> {
  const path = await saveFileDialog({ defaultPath: `${safeDocName(doc.name)}.gif`, filters: [{ name: 'GIF', extensions: ['gif'] }] });
  if (typeof path !== 'string') return null;
  const b64 = await exportGif(doc, cfg, onProgress);
  const saved = await demoWriteBinary(path, b64);
  onProgress?.('Lagret', 1);
  void openPath(saved).catch(() => {});
  return saved;
}
