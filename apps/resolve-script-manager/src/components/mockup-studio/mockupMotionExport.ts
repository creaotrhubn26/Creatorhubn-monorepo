/**
 * mockupMotionExport.ts — animasjons-eksport til WebM-video.
 *
 * Pre-rendrer avslørings-framene (renderMotionFrames) og tar dem opp med
 * MediaRecorder over et canvas-stream → WebM. 100% frontend — funker i Tauri-
 * webviewen (Chromium), ingen ffmpeg/ny Rust. Lagres deretter via demoWriteBinary.
 *
 * MediaRecorder kjører kun i en ekte nettleser/webview (ikke headless-verifiserbart);
 * frame-rendringen er verifisert separat.
 */

import { save as saveFileDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { renderMotionFrames } from './mockupRaster';
import { safeDocName, type MockupDoc } from './mockupStudioModel';
import { demoWriteBinary } from '../../api';
import type { MotionConfig } from './mockupMotion';

function base64FromArrayBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Er video-opptak tilgjengelig i denne webviewen? */
export function motionExportAvailable(): boolean {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

/**
 * Render + ta opp animasjonen til en WebM-video. Returnerer rå base64 (uten
 * data:-prefiks) klar for demoWriteBinary. `scale` styrer oppløsning (0.5–1).
 */
export async function exportMotionWebm(
  doc: MockupDoc,
  cfg: MotionConfig,
  scale: number,
  onProgress?: (label: string, frac: number) => void,
): Promise<string> {
  if (!motionExportAvailable()) {
    throw new Error('Video-opptak støttes ikke i denne webviewen.');
  }
  onProgress?.('Rendrer frames…', 0);
  const frames = await renderMotionFrames(doc, cfg, scale, (d, t) => onProgress?.('Rendrer frames…', 0.6 * (d / t)));
  if (frames.length === 0) throw new Error('Ingen frames å ta opp.');

  const w = frames[0].width, h = frames[0].height;
  const rec = document.createElement('canvas');
  rec.width = w; rec.height = h;
  const rctx = rec.getContext('2d');
  if (!rctx) throw new Error('Kunne ikke lage opptaks-canvas.');
  rctx.drawImage(frames[0], 0, 0); // unngå blank første frame

  const stream = rec.captureStream(cfg.fps);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
  const chunks: BlobPart[] = [];
  const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  const stopped = new Promise<Blob>((resolve) => { mr.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })); });

  mr.start();
  const frameMs = 1000 / cfg.fps;
  await new Promise<void>((resolve) => {
    let i = 0;
    const tick = () => {
      if (i >= frames.length) { resolve(); return; }
      rctx.clearRect(0, 0, w, h);
      rctx.drawImage(frames[i], 0, 0);
      onProgress?.('Tar opp video…', 0.6 + 0.4 * (i / frames.length));
      i++;
      setTimeout(tick, frameMs);
    };
    tick();
  });
  // La siste frame ligge et øyeblikk før stopp (unngå avkuttet slutt).
  await new Promise<void>((r) => setTimeout(r, Math.max(120, frameMs * 3)));
  mr.stop();

  const blob = await stopped;
  const buf = await blob.arrayBuffer();
  onProgress?.('Ferdig', 1);
  return base64FromArrayBuffer(buf);
}

/**
 * Full flyt: spør om lagringssti → render + ta opp → lagre WebM → åpne. Returnerer
 * lagret sti, eller null hvis brukeren avbrøt fil-dialogen.
 */
export async function exportAndSaveMotion(
  doc: MockupDoc,
  cfg: MotionConfig,
  scale: number,
  onProgress?: (label: string, frac: number) => void,
): Promise<string | null> {
  const path = await saveFileDialog({ defaultPath: `${safeDocName(doc.name)}.webm`, filters: [{ name: 'WebM-video', extensions: ['webm'] }] });
  if (!path) return null;
  const b64 = await exportMotionWebm(doc, cfg, scale, onProgress);
  const saved = await demoWriteBinary(path, b64);
  onProgress?.('Lagret', 1);
  void openPath(saved).catch(() => {});
  return saved;
}
