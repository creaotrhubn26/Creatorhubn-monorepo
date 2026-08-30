import crypto from "node:crypto";
import type { Pool } from "pg";
import sharp from "sharp";
import { z } from "zod";
import {
  contextFromLegacyStoryboardInput,
  enrichStoryboardContextWithStrokes,
  storyboardImageAspectPolicy,
  storyboardImageProviderQuality,
  storyboardImageProviderSize,
  storyboardShotContextSchema,
  type StoryboardImageAspectRequest,
} from "./storyboard-ai-context.js";
import {
  storyboardPaintoverCompositeSchema,
} from "./storyboard-paintover-composite.js";
import { hydrateStoryboardProductionContext } from "./storyboard-production-context.js";
import { compileStoryboardPrompt } from "./storyboard-prompt-engine/index.js";
import { resolveApprovedProviderReferences } from "./storyboard-reference-library.js";
import type { Storyboard } from "./storyboard-service.js";

export const storyboardImageGenerationBodySchema = z
  .object({
    prompt: z.string().trim().max(1_200).optional(),
    userAction: z.string().trim().max(1_200).optional(),
    context: storyboardShotContextSchema.optional(),
    model: z.enum(["gpt-image-1-mini", "gpt-image-2"]).optional(),
    sceneDescription: z.string().trim().max(4_000).optional(),
    intExt: z.string().trim().max(40).optional(),
    timeOfDay: z.string().trim().max(100).optional(),
    locationName: z.string().trim().max(500).optional(),
    shotType: z.string().trim().max(120).optional(),
    cinematicFormat: z.string().trim().max(120).optional(),
    styleNote: z.string().trim().max(1_000).optional(),
    quality: z.enum(["standard", "hd"]).default("standard"),
    aspectRatio: z
      .enum(["1792x1024", "1024x1024", "1024x1792"])
      .default("1792x1024"),
    /** Canonical frame/canvas aspect; the legacy token above chooses provider orientation only. */
    targetAspectRatio: z.number().finite().min(0.1).max(10).optional(),
    /**
     * Exact source acknowledgement returned by the frame-save contract. These
     * remain optional on the shared schema because the legacy one-shot image
     * endpoint does not use the staged Pencil -> Color -> Atmosphere flow.
     * The staged route requires and verifies both values before reserving cost.
     */
    expectedSourceRevision: z.number().int().nonnegative().optional(),
    expectedCompatFrameUpdatedAt: z.string().trim().min(1).max(80).optional(),
    /** Exact approved-base + editable Color overlay used for Atmosphere. */
    paintoverComposite: storyboardPaintoverCompositeSchema.optional(),
    /** Stable per user action; retries must reuse it, new generations must not. */
    idempotencyKey: z.string().trim().min(8).max(200).optional(),
  })
  .strict();

export type StoryboardImageGenerationBody = z.infer<
  typeof storyboardImageGenerationBodySchema
>;

export class StoryboardImageGenerationError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly safeDetail?: string,
  ) {
    super(code);
  }
}

/**
 * The paid provider boundary was crossed, but no durable local result exists.
 * Callers must preserve the processing operation and its billing reservation:
 * refunding or resubmitting here can create free/double provider work.
 */
export class StoryboardImageProviderOutcomeUnknownError
  extends StoryboardImageGenerationError {
  constructor(
    code = "openai_result_unknown",
    safeDetail = "Leverandørresultatet er ukjent. Genereringen blir ikke startet på nytt automatisk.",
  ) {
    super(502, code, safeDetail);
  }
}

export interface NormalizedStoryboardProviderImage {
  imageData: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  crop: { left: number; top: number; width: number; height: number };
  canonicalLabel: string;
  canonicalAspectRatio: number;
  outputAspectRatio: number;
  normalization: "center-crop-no-upscale";
}

function providerAspectTokenForTarget(
  targetAspectRatio: number,
): StoryboardImageAspectRequest {
  if (Math.abs(targetAspectRatio - 1) < 0.000_001) return "1024x1024";
  return targetAspectRatio > 1 ? "1792x1024" : "1024x1792";
}

export interface ResolvedStoryboardImageAspectRequest {
  requestedAspectToken: StoryboardImageAspectRequest;
  effectiveAspectToken: StoryboardImageAspectRequest;
  targetAspectRatio: number;
}

/**
 * Production context is authoritative. The legacy token remains a provider
 * orientation hint only and can never silently override the applied viewport.
 */
export function resolveStoryboardImageAspectRequest(input: {
  requestedAspectToken: StoryboardImageAspectRequest;
  requestedTargetAspectRatio?: number;
  contextualAspectRatio?: number | null;
}): ResolvedStoryboardImageAspectRequest {
  const contextualAspectRatio = input.contextualAspectRatio ?? undefined;
  if (contextualAspectRatio != null && input.requestedTargetAspectRatio != null
      && Math.abs(contextualAspectRatio - input.requestedTargetAspectRatio) > 0.000_001) {
    throw new StoryboardImageGenerationError(
      400,
      "aspect_ratio_mismatch",
      "Bildets aspekt samsvarer ikke med det anvendte shot-utsnittet.",
    );
  }
  const targetAspectRatio = contextualAspectRatio
    ?? input.requestedTargetAspectRatio
    ?? storyboardImageAspectPolicy(input.requestedAspectToken).canonicalAspectRatio;
  const hasCanonicalTarget = contextualAspectRatio != null
    || input.requestedTargetAspectRatio != null;
  return {
    requestedAspectToken: input.requestedAspectToken,
    effectiveAspectToken: hasCanonicalTarget
      ? providerAspectTokenForTarget(targetAspectRatio)
      : input.requestedAspectToken,
    targetAspectRatio,
  };
}

/**
 * Convert the provider's 3:2/2:3 raster into the canonical shot aspect by
 * extracting the largest centered integer 16:9/9:16/1:1 rectangle. Pixels
 * are never rescaled, so faces, circles and line work cannot be stretched.
 */
export async function normalizeStoryboardProviderImage(
  imageBase64: string,
  requested: StoryboardImageAspectRequest,
  targetAspectRatio?: number,
): Promise<NormalizedStoryboardProviderImage> {
  const bytes = Buffer.from(String(imageBase64 || ""), "base64");
  if (bytes.length < 16 || bytes.length > 40 * 1024 * 1024) {
    throw new StoryboardImageGenerationError(
      502,
      "provider_image_invalid",
      "Bildeleverandøren returnerte ugyldige bildedata.",
    );
  }
  const policy = storyboardImageAspectPolicy(requested);
  try {
    const metadata = await sharp(bytes, {
      failOn: "error",
      limitInputPixels: 50_000_000,
    }).metadata();
    const sourceWidth = metadata.width;
    const sourceHeight = metadata.height;
    if (!sourceWidth || !sourceHeight) {
      throw new Error("missing_dimensions");
    }
    const canonicalAspectRatio = targetAspectRatio ?? policy.canonicalAspectRatio;
    const usesDefaultRational = Math.abs(
      canonicalAspectRatio - policy.canonicalAspectRatio,
    ) < 0.000_001;
    let width: number;
    let height: number;
    if (usesDefaultRational) {
      const unitWidth = policy.canonicalUnits.width;
      const unitHeight = policy.canonicalUnits.height;
      const integerScale = Math.floor(Math.min(
        sourceWidth / unitWidth,
        sourceHeight / unitHeight,
      ));
      if (integerScale < 1) throw new Error("image_too_small");
      width = integerScale * unitWidth;
      height = integerScale * unitHeight;
    } else if (sourceWidth / sourceHeight > canonicalAspectRatio) {
      height = sourceHeight;
      width = Math.max(1, Math.min(sourceWidth, Math.floor(height * canonicalAspectRatio)));
    } else {
      width = sourceWidth;
      height = Math.max(1, Math.min(sourceHeight, Math.floor(width / canonicalAspectRatio)));
    }
    const left = Math.floor((sourceWidth - width) / 2);
    const top = Math.floor((sourceHeight - height) / 2);
    const normalized = await sharp(bytes, {
      failOn: "error",
      limitInputPixels: 50_000_000,
    })
      .extract({ left, top, width, height })
      .png()
      .toBuffer();

    return {
      imageData: `data:image/png;base64,${normalized.toString("base64")}`,
      width,
      height,
      sourceWidth,
      sourceHeight,
      crop: { left, top, width, height },
      canonicalLabel: usesDefaultRational ? policy.canonicalLabel : "custom",
      canonicalAspectRatio,
      outputAspectRatio: width / height,
      normalization: policy.normalization,
    };
  } catch (error) {
    if (error instanceof StoryboardImageGenerationError) throw error;
    throw new StoryboardImageGenerationError(
      502,
      "provider_image_invalid",
      "Bildeleverandøren returnerte et bilde som ikke kunne normaliseres.",
    );
  }
}

function collectReferenceIds(
  context: z.infer<typeof storyboardShotContextSchema>,
): string[] {
  return [
    ...new Set([
      ...context.production.characters.flatMap(
        (entry) => entry.referenceImageIds,
      ),
      ...context.production.wardrobe.flatMap(
        (entry) => entry.referenceImageIds,
      ),
      ...context.production.locations.flatMap(
        (entry) => entry.referenceImageIds,
      ),
      ...context.production.props.flatMap((entry) => entry.referenceImageIds),
    ]),
  ];
}

function appendReferenceFiles(
  form: FormData,
  references: Awaited<ReturnType<typeof resolveApprovedProviderReferences>>,
): void {
  for (const reference of references) {
    const bytes = new Uint8Array(reference.bytes.byteLength);
    bytes.set(reference.bytes);
    form.append(
      "image[]",
      new Blob([bytes], { type: reference.contentType }),
      reference.filename,
    );
  }
}

export interface StoryboardImageAuthoritativeSource {
  imageData: string;
  stage: "pencil" | "color";
  fingerprint?: string;
}

export interface DecodedStoryboardImage {
  bytes: Buffer;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  extension: "png" | "jpg" | "webp";
  fingerprint: string;
}

export function decodeStoryboardImageData(imageData: string): DecodedStoryboardImage {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(
    String(imageData || "").trim(),
  );
  if (!match) {
    throw new StoryboardImageGenerationError(
      409,
      "authoritative_source_missing",
      "Den autoritative storyboard-tegningen mangler eller har ugyldig bildeformat.",
    );
  }
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 16 || bytes.length > 25 * 1024 * 1024) {
    throw new StoryboardImageGenerationError(
      409,
      "authoritative_source_invalid",
      "Storyboard-kilden har ugyldig størrelse.",
    );
  }
  const contentType = match[1].toLowerCase() as DecodedStoryboardImage["contentType"];
  const extension = contentType === "image/jpeg"
    ? "jpg" : contentType === "image/webp" ? "webp" : "png";
  return {
    bytes,
    contentType,
    extension,
    fingerprint: crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 32),
  };
}

function appendAuthoritativeSource(
  form: FormData,
  source: StoryboardImageAuthoritativeSource,
): DecodedStoryboardImage {
  const decoded = decodeStoryboardImageData(source.imageData);
  const bytes = new Uint8Array(decoded.bytes.byteLength);
  bytes.set(decoded.bytes);
  form.append(
    "image[]",
    new Blob([bytes], { type: decoded.contentType }),
    `01-authoritative-${source.stage}.${decoded.extension}`,
  );
  return decoded;
}

export interface GenerateStoryboardImageInput {
  pool: Pool;
  storyboard: Storyboard;
  projectId: string;
  userId: string;
  body: StoryboardImageGenerationBody;
  apiKey: string;
  authoritativeSource?: StoryboardImageAuthoritativeSource;
  /**
   * Stable local operation ID forwarded as a best-effort correlation header.
   * The Images API does not document provider-side idempotency for this header.
   */
  providerIdempotencyKey?: string;
  fetchImpl?: typeof fetch;
}

export interface GeneratedStoryboardImage {
  imageData: string;
  width: number;
  height: number;
  metadata: Record<string, unknown>;
  compiledPrompt: string;
  revisedPrompt: string | null;
  referenceCount: number;
  referenceAssetIds: string[];
  model: "gpt-image-1-mini" | "gpt-image-2";
}

/** Provider-free prompt/reference preparation used before cost reservation. */
export async function prepareStoryboardImageGeneration(
  input: Omit<GenerateStoryboardImageInput, "apiKey" | "fetchImpl">,
) {
  const body = input.body;
  const submittedContext =
    body.context ??
    contextFromLegacyStoryboardInput({
      storyboardId: input.storyboard.frameId ?? input.storyboard.id,
      title: input.storyboard.title,
      sceneDescription: body.sceneDescription,
      intExt: body.intExt,
      timeOfDay: body.timeOfDay,
      locationName: body.locationName,
      shotType: body.shotType,
      prompt: body.userAction ?? body.prompt,
      styleNote: body.styleNote,
    });
  const sceneId = input.storyboard.sceneId || submittedContext.scene.id;
  const hydratedContext = sceneId
    ? await hydrateStoryboardProductionContext(input.pool, {
        projectId: input.projectId,
        sceneId,
        context: submittedContext,
      })
    : submittedContext;
  const context = enrichStoryboardContextWithStrokes(
    hydratedContext,
    input.storyboard.strokes ?? [],
    input.storyboard.width,
    input.storyboard.height,
  );
  const resolvedAspect = resolveStoryboardImageAspectRequest({
    requestedAspectToken: body.aspectRatio,
    requestedTargetAspectRatio: body.targetAspectRatio,
    contextualAspectRatio: context.shot.shotFraming?.aspectRatio,
  });

  // Standard is deliberately the inexpensive draft path. HD opts into the
  // higher-cost continuity model unless the client selected a model explicitly.
  const model =
    body.model ?? (body.quality === "hd" ? "gpt-image-2" : "gpt-image-1-mini");
  const intentKind = input.authoritativeSource?.stage === "pencil"
    ? "storyboard-color"
    : input.authoritativeSource?.stage === "color"
      ? "storyboard-atmosphere"
      : "storyboard-image";
  const compilation = compileStoryboardPrompt({
    kind: intentKind,
    modelId: model,
    userAction: body.userAction ?? body.prompt,
    context,
  });
  if (!compilation.validation.valid) {
    throw new StoryboardImageGenerationError(
      422,
      "prompt_preflight_failed",
      "Prompt Engine fant ugyldige produksjonsconstraints.",
    );
  }

  let references: Awaited<ReturnType<typeof resolveApprovedProviderReferences>>;
  try {
    references = await resolveApprovedProviderReferences(input.pool, {
      projectId: input.projectId,
      referenceIds: collectReferenceIds(context),
    });
  } catch {
    // Fail closed. Silently dropping a locked reference creates identity drift
    // while the UI still claims that continuity is protected.
    throw new StoryboardImageGenerationError(
      409,
      "approved_reference_unavailable",
      "En godkjent referanse kunne ikke lastes. Genereringen ble ikke startet.",
    );
  }

  return {
    body,
    context,
    resolvedAspect,
    model,
    intentKind,
    compilation,
    references,
  };
}

export async function generateStoryboardImage(
  input: GenerateStoryboardImageInput,
): Promise<GeneratedStoryboardImage> {
  const prepared = await prepareStoryboardImageGeneration(input);
  const {
    body,
    resolvedAspect: { effectiveAspectToken, targetAspectRatio },
    model,
    intentKind,
    compilation,
    references,
  } = prepared;

  const providerSize = storyboardImageProviderSize(effectiveAspectToken);
  const providerQuality = storyboardImageProviderQuality(body.quality);
  const fetchImpl = input.fetchImpl ?? fetch;
  let providerResponse: Awaited<ReturnType<typeof fetch>>;
  let sourceFingerprint: string | null = null;
  let providerRequestStarted = false;
  try {
    if (input.authoritativeSource || references.length) {
      const form = new FormData();
      form.set("model", model);
      form.set("prompt", compilation.compiledPrompt);
      form.set("size", providerSize);
      form.set("quality", providerQuality);
      form.set("output_format", "png");
      if (input.authoritativeSource) {
        const decodedSource = appendAuthoritativeSource(form, input.authoritativeSource);
        sourceFingerprint = input.authoritativeSource.fingerprint
          ?? decodedSource.fingerprint;
      }
      appendReferenceFiles(form, references);
      providerRequestStarted = true;
      providerResponse = await fetchImpl(
        "https://api.openai.com/v1/images/edits",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${input.apiKey}`,
            ...(input.providerIdempotencyKey
              ? { "Idempotency-Key": input.providerIdempotencyKey } : {}),
          },
          body: form,
        },
      );
    } else {
      providerRequestStarted = true;
      providerResponse = await fetchImpl(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${input.apiKey}`,
            ...(input.providerIdempotencyKey
              ? { "Idempotency-Key": input.providerIdempotencyKey } : {}),
          },
          body: JSON.stringify({
            model,
            prompt: compilation.compiledPrompt,
            n: 1,
            size: providerSize,
            quality: providerQuality,
            output_format: "png",
          }),
        },
      );
    }
  } catch (error) {
    if (providerRequestStarted) {
      throw new StoryboardImageProviderOutcomeUnknownError(
        "openai_submission_unknown",
        "Bildeleverandøren svarte ikke. Forespørselen sendes ikke automatisk på nytt.",
      );
    }
    if (error instanceof StoryboardImageGenerationError) throw error;
    throw new StoryboardImageGenerationError(
      400, "image_request_prepare_failed",
      "Bildeforespørselen kunne ikke klargjøres.",
    );
  }

  if (!providerResponse.ok) {
    if (providerResponse.status >= 500) {
      throw new StoryboardImageProviderOutcomeUnknownError(
        "openai_server_result_unknown",
        "Bildeleverandøren feilet etter innsending. Forespørselen sendes ikke automatisk på nytt.",
      );
    }
    throw new StoryboardImageGenerationError(
      providerResponse.status === 402 || providerResponse.status === 429
        ? providerResponse.status
        : 502,
      providerResponse.status === 402
        ? "provider_budget_exceeded"
        : providerResponse.status === 429
          ? "provider_rate_limited"
          : "openai_failed",
      "Bildeleverandøren avviste forespørselen.",
    );
  }

  let payload: {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
  };
  let normalizedImage: NormalizedStoryboardProviderImage;
  try {
    payload = (await providerResponse.json()) as typeof payload;
    const imageBase64 = payload.data?.[0]?.b64_json;
    if (!imageBase64) {
      throw new StoryboardImageProviderOutcomeUnknownError(
        "openai_output_missing",
        "Leverandøren godtok forespørselen uten et brukbart bilde. Den sendes ikke automatisk på nytt.",
      );
    }
    normalizedImage = await normalizeStoryboardProviderImage(
      imageBase64,
      effectiveAspectToken,
      targetAspectRatio,
    );
  } catch (error) {
    if (error instanceof StoryboardImageProviderOutcomeUnknownError) throw error;
    throw new StoryboardImageProviderOutcomeUnknownError(
      "openai_output_invalid",
      "Leverandørsvaret kunne ikke valideres. Forespørselen sendes ikke automatisk på nytt.",
    );
  }
  const referenceAssetIds = references.map((entry) => entry.asset.id);
  return {
    imageData: normalizedImage.imageData,
    width: normalizedImage.width,
    height: normalizedImage.height,
    compiledPrompt: compilation.compiledPrompt,
    revisedPrompt: payload.data?.[0]?.revised_prompt ?? null,
    referenceCount: references.length,
    referenceAssetIds,
    model,
    metadata: {
      provider: "openai",
      providerMode: input.authoritativeSource
        ? "source-first-edit"
        : references.length ? "reference-edit" : "text-generation",
      stage: intentKind,
      sourceFingerprint,
      model,
      promptEngineVersion: compilation.version,
      contextFingerprint: compilation.contextFingerprint,
      compilationFingerprint: compilation.compilationFingerprint,
      compiledPrompt: compilation.compiledPrompt,
      revisedPrompt: payload.data?.[0]?.revised_prompt ?? null,
      referenceAssetIds,
      referenceCount: references.length,
      generatedAt: new Date().toISOString(),
      generatedBy: input.userId,
      quality: body.quality,
      providerQuality,
      size: providerSize,
      requestedAspectToken: body.aspectRatio,
      effectiveAspectToken,
      targetAspectRatio,
      aspectPolicy: {
        normalization: normalizedImage.normalization,
        canonicalLabel: normalizedImage.canonicalLabel,
        canonicalAspectRatio: normalizedImage.canonicalAspectRatio,
        providerWidth: normalizedImage.sourceWidth,
        providerHeight: normalizedImage.sourceHeight,
        outputWidth: normalizedImage.width,
        outputHeight: normalizedImage.height,
        outputAspectRatio: normalizedImage.outputAspectRatio,
        crop: normalizedImage.crop,
      },
    },
  };
}
