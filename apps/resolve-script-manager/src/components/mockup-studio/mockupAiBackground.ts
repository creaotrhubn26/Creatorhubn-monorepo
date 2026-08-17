/**
 * mockupAiBackground.ts — Fase 2: generative AI-bakgrunner.
 *
 * Gjenbruker aiImageService.generateImage (fal Flux via RR-backend). Bygger et
 * prompt (fra fritekst ELLER lerretets palett/stemning), genererer bildet,
 * leser det lokale resultatet til en data-URL (unngår canvas-taint ved eksport)
 * og setter det som canvas.bgImage. Kreditt-gated — brukerens in-app-test.
 */

import { generateImage, type AiImageSize } from '../../services/aiImageService';
import { convertFileSrc } from '../../api';
import { isAiConnected } from '../../services/claudeProxyService';
import { isDark, resolveBaseBg, type MockupCanvasSpec } from './mockupStudioModel';

export function aiBackgroundAvailable(): boolean {
  return isAiConnected();
}

/** Velg fal-bildestørrelse fra lerretets aspect. */
export function sizeForCanvas(canvas: MockupCanvasSpec): AiImageSize {
  const ar = canvas.w / canvas.h;
  if (ar > 1.2) return 'landscape_16_9';
  if (ar < 0.83) return 'portrait_16_9';
  return 'square_hd';
}

/** Rent prompt fra lerretets palett + stemning (testbart uten AI). */
export function promptFromPalette(canvas: MockupCanvasSpec): string {
  const mood = isDark(resolveBaseBg(canvas)) ? 'dark, moody' : 'light, airy';
  return `Abstract soft-focus marketing background, ${mood}, brand colors ${canvas.accent} and ${canvas.accent2}, `
    + `subtle gradient depth and gentle bokeh, premium and minimal, no text, no logos, no devices, no people`;
}

/** Les en generert fil til data-URL (canvas-eksport-trygt, ingen tainting). */
async function fileToDataUrl(absolutePath: string): Promise<string> {
  const res = await fetch(convertFileSrc(absolutePath));
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Kunne ikke lese generert bakgrunn.'));
    r.readAsDataURL(blob);
  });
}

/**
 * Generér en scene-bakgrunn og returner en data-URL (klar for canvas.bgImage).
 * `prompt` tom → utled fra palett.
 */
export async function generateSceneBackground(canvas: MockupCanvasSpec, prompt?: string, onStep?: (s: string) => void): Promise<string> {
  if (!isAiConnected()) throw new Error('AI-proxyen er ikke tilkoblet. Logg inn (RR-token) i Innstillinger.');
  const p = (prompt && prompt.trim()) ? prompt.trim() : promptFromPalette(canvas);
  onStep?.('Genererer bakgrunn…');
  const res = await generateImage({ prompt: p, image_size: sizeForCanvas(canvas) });
  onStep?.('Laster ned…');
  const dataUrl = await fileToDataUrl(res.image_path);
  onStep?.('Ferdig');
  return dataUrl;
}
