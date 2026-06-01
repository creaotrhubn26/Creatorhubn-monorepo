/**
 * aiImageService — Phase 2 av AI-to-editable-PSD-pipelinen.
 * Genererer et bilde fra et prompt via Role Room-backend som proxer
 * mot fal.ai (Flux 1.1 Pro). Returnerer absolutt fil-sti til den
 * lokalt nedlastede PNG-en, klar for å embedes som smart-object i
 * en scaffolded PSD via template.scaffold.
 */

import { invoke } from "@tauri-apps/api/core";

export type AiImageSize =
  | "square_hd"          // 1024×1024
  | "square"             // 512×512
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9";

export interface AiImageResult {
  image_path: string;
  width: number | null;
  height: number | null;
  model: string;
  seed: number | null;
}

export async function generateImage(params: {
  prompt: string;
  image_size?: AiImageSize;
  seed?: number;
}): Promise<AiImageResult> {
  return invoke<AiImageResult>("ai_generate_image", {
    prompt: params.prompt,
    imageSize: params.image_size,
    seed: params.seed,
  });
}
