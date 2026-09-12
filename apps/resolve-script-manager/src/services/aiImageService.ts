/**
 * aiImageService — Phase 2 av AI-to-editable-PSD-pipelinen.
 * Genererer et bilde fra et prompt via Role Room-backend. Returnerer absolutt
 * fil-sti til den
 * lokalt nedlastede PNG-en, klar for å embedes som smart-object i
 * en scaffolded PSD via template.scaffold.
 */

import { invoke } from "@tauri-apps/api/core";
import { loadSettings } from "../components/SettingsModal";

export type AiImageSize =
  | "square_hd" // 1024×1024
  | "square" // 512×512
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9";

export type AiImageModel = "gpt-image-2" | "fal-flux-pro-1.1";
export type AiImageQuality = "low" | "medium" | "high";
export type AiImageBackground = "transparent" | "opaque" | "auto";
export type AiImageOutputFormat = "png" | "webp" | "jpeg";

export interface AiImageResult {
  image_path: string;
  image_url?: string;
  width: number | null;
  height: number | null;
  model: string;
  seed: number | null;
  provider_supports_seed?: boolean;
  provider_mode?: "text-generation" | "reference-edit";
  asset_ref?: string | null;
  asset_hash?: string | null;
  visual_audit?: {
    score?: number;
    summary?: string;
    model?: string;
    unavailable?: boolean;
    detail?: string;
    [key: string]: unknown;
  } | null;
}

export async function generateImage(params: {
  prompt: string;
  image_size?: AiImageSize;
  seed?: number;
  model?: AiImageModel;
  quality?: AiImageQuality;
  background?: AiImageBackground;
  output_format?: AiImageOutputFormat;
  reference_image?: string;
  audit_image?: boolean;
  brand_primary?: string;
  brand_accent?: string;
  asset_context?: {
    project_id: string;
    image_id: string;
    variant_key: string;
  };
}): Promise<AiImageResult> {
  const browserRuntime =
    typeof window !== "undefined" &&
    Boolean(
      (window as unknown as { __BROWSER_TEST__?: boolean }).__BROWSER_TEST__,
    );
  if (browserRuntime) {
    const settings = loadSettings();
    const bearer = settings.RR_BEARER_TOKEN?.trim();
    if (!bearer) throw new Error("Ikke logget inn til Role Room.");
    const baseUrl = (
      settings.RR_POST_AGENT_BASE_URL ||
      "https://www.creatorhubn.com/api/post-agent"
    ).replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/ai/generate-image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: params.prompt,
        options: {
          image_size: params.image_size,
          seed: params.seed,
          model: params.model,
          quality: params.quality,
          background: params.background,
          output_format: params.output_format,
          reference_image: params.reference_image,
          audit_image: params.audit_image,
          brand_primary: params.brand_primary,
          brand_accent: params.brand_accent,
          asset_context: params.asset_context,
        },
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      image_url?: string;
      width?: number | null;
      height?: number | null;
      model?: string;
      seed?: number | null;
      provider_supports_seed?: boolean;
      provider_mode?: "text-generation" | "reference-edit";
      asset_ref?: string | null;
      asset_hash?: string | null;
      visual_audit?: AiImageResult["visual_audit"];
      error?: string;
      detail?: string;
    };
    if (!response.ok || !payload.image_url) {
      throw new Error(
        payload.detail ||
          payload.error ||
          `Bildegenerering feilet (HTTP ${response.status}).`,
      );
    }
    return {
      image_path: payload.image_url,
      image_url: payload.image_url,
      width: payload.width ?? null,
      height: payload.height ?? null,
      model: payload.model || params.model || "fal-flux-pro-1.1",
      seed: payload.seed ?? params.seed ?? null,
      provider_supports_seed: payload.provider_supports_seed,
      provider_mode: payload.provider_mode,
      asset_ref: payload.asset_ref,
      asset_hash: payload.asset_hash,
      visual_audit: payload.visual_audit,
    };
  }
  return invoke<AiImageResult>("ai_generate_image", {
    prompt: params.prompt,
    imageSize: params.image_size,
    seed: params.seed,
    model: params.model,
    quality: params.quality,
    background: params.background,
    outputFormat: params.output_format,
    referenceImage: params.reference_image,
    auditImage: params.audit_image,
    brandPrimary: params.brand_primary,
    brandAccent: params.brand_accent,
    assetContext: params.asset_context,
  });
}
