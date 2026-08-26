import type { Pool } from "pg";
import { z } from "zod";
import {
  contextFromLegacyStoryboardInput,
  storyboardImageProviderQuality,
  storyboardImageProviderSize,
  storyboardShotContextSchema,
} from "./storyboard-ai-context.js";
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

export interface GenerateStoryboardImageInput {
  pool: Pool;
  storyboard: Storyboard;
  projectId: string;
  userId: string;
  body: StoryboardImageGenerationBody;
  apiKey: string;
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

export async function generateStoryboardImage(
  input: GenerateStoryboardImageInput,
): Promise<GeneratedStoryboardImage> {
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
  const context = sceneId
    ? await hydrateStoryboardProductionContext(input.pool, {
        projectId: input.projectId,
        sceneId,
        context: submittedContext,
      })
    : submittedContext;

  // Standard is deliberately the inexpensive draft path. HD opts into the
  // higher-cost continuity model unless the client selected a model explicitly.
  const model =
    body.model ?? (body.quality === "hd" ? "gpt-image-2" : "gpt-image-1-mini");
  const compilation = compileStoryboardPrompt({
    kind: "storyboard-image",
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

  const providerSize = storyboardImageProviderSize(body.aspectRatio);
  const providerQuality = storyboardImageProviderQuality(body.quality);
  const fetchImpl = input.fetchImpl ?? fetch;
  let providerResponse: Awaited<ReturnType<typeof fetch>>;
  try {
    if (references.length) {
      const form = new FormData();
      form.set("model", model);
      form.set("prompt", compilation.compiledPrompt);
      form.set("size", providerSize);
      form.set("quality", providerQuality);
      form.set("output_format", "png");
      appendReferenceFiles(form, references);
      providerResponse = await fetchImpl(
        "https://api.openai.com/v1/images/edits",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${input.apiKey}` },
          body: form,
        },
      );
    } else {
      providerResponse = await fetchImpl(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${input.apiKey}`,
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
  } catch {
    throw new StoryboardImageGenerationError(
      502,
      "openai_network",
      "Bildeleverandøren svarte ikke.",
    );
  }

  if (!providerResponse.ok) {
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

  const payload = (await providerResponse.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
  };
  const imageBase64 = payload.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new StoryboardImageGenerationError(
      502,
      "openai_no_image",
      "Leverandøren returnerte ikke et bilde.",
    );
  }
  const [width, height] = providerSize.split("x").map(Number);
  const referenceAssetIds = references.map((entry) => entry.asset.id);
  return {
    imageData: `data:image/png;base64,${imageBase64}`,
    width,
    height,
    compiledPrompt: compilation.compiledPrompt,
    revisedPrompt: payload.data?.[0]?.revised_prompt ?? null,
    referenceCount: references.length,
    referenceAssetIds,
    model,
    metadata: {
      provider: "openai",
      providerMode: references.length ? "reference-edit" : "text-generation",
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
    },
  };
}
