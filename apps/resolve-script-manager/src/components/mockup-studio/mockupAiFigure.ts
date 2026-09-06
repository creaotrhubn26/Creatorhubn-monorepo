/** High-fidelity, brandstyrt figurpipeline for Role Room → Mockup Studio. */

import { convertFileSrc } from "../../api";
import { generateImage, type AiImageResult } from "../../services/aiImageService";
import { isAiConnected } from "../../services/claudeProxyService";
import { materializeMockupAsset } from "./mockupCloudAssets";
import {
  appendUniqueFigureVariant,
  DEFAULT_FIGURE_COMPOSITING,
  evaluateFigurePixelBuffer,
  FIGURE_EXPRESSION_PRESETS,
  FIGURE_LAYER_MANIFEST,
  FIGURE_POSE_PRESETS,
} from "./mockupFigurePipeline";
import type {
  MockupCanvasSpec,
  MockupFigureAppearance,
  MockupFigureExpressionId,
  MockupFigureGenerationSpec,
  MockupFigureMasterView,
  MockupFigurePoseId,
  MockupFigureQaCheck,
  MockupFigureSemanticAudit,
  MockupFigureVariant,
  MockupFigureVisualQa,
  MockupImageSlot,
} from "./mockupStudioModel";

function stableSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2_147_483_647;
}

function defaultAppearance(image: MockupImageSlot): MockupFigureAppearance {
  const hairStyle = {
    kort: "short",
    buffert: "volume",
    krøller: "curly",
    coily: "coily",
    bald: "bald",
  }[image.personStyle?.hairStyle || "kort"] as MockupFigureAppearance["hairStyle"];
  return {
    ageRange: image.personStyle?.ageRange || "adult",
    skinTone: image.personStyle?.skin || "#D9A17D",
    hairColor: image.personStyle?.hair || "#352923",
    hairStyle,
    faceShape: image.personStyle?.faceShape || "balanced",
  };
}

function promptDirection(
  image: MockupImageSlot,
  poseId: MockupFigurePoseId,
  expressionId: MockupFigureExpressionId,
): string {
  const pose = FIGURE_POSE_PRESETS.find((item) => item.id === poseId) || FIGURE_POSE_PRESETS[0];
  const expression = FIGURE_EXPRESSION_PRESETS.find((item) => item.id === expressionId) || FIGURE_EXPRESSION_PRESETS[0];
  const action = image.personStyle?.scenario === "presenter"
    ? "presenting confidently"
    : "working naturally with a slim laptop at waist level";
  return `${action}, ${pose.prompt}, ${expression.prompt}`;
}

function buildPrompt(
  image: MockupImageSlot,
  canvas: MockupCanvasSpec,
  presentation: MockupFigureGenerationSpec["presentation"],
  appearance: MockupFigureAppearance,
  poseId: MockupFigurePoseId,
  expressionId: MockupFigureExpressionId,
): string {
  const role = image.personStyle?.outfit === "legefrakk"
    ? "clinician in a clean white medical coat and discreet stethoscope"
    : "professional in a tailored shirt and subtle ID badge";
  const presentationText = { female: "female", male: "male", neutral: "gender-neutral" }[presentation];
  const ageText = { "young-adult": "young adult", adult: "adult", mature: "mature adult" }[appearance.ageRange];
  const hairText = { short: "short professional hair", volume: "medium-volume styled hair", curly: "defined curls", coily: "defined coily hair", bald: "bald head" }[appearance.hairStyle];
  return [
    "Premium original cinematic 3D feature-animation character render",
    "not based on a real person, studio franchise, film, celebrity or existing character",
    `one Norwegian ${presentationText} ${ageText} ${role}`,
    `${appearance.faceShape} facial structure, skin tone ${appearance.skinTone}, hair colour ${appearance.hairColor}, ${hairText}`,
    promptDirection(image, poseId, expressionId),
    `wardrobe accents in exact brand colours ${canvas.accent2} and ${canvas.accent}`,
    "appealing anatomically coherent face, expressive eyes, natural five-finger hands, strong readable silhouette",
    "subtle subsurface skin depth, individual hair groups, believable woven fabric, coat seams and premium metal",
    "soft cinematic key light, warm fill, delicate brand-coloured rim light, contact shadow and ambient occlusion",
    "full body to mid-thigh, clean isolated silhouette with generous safe margin on a fully transparent background",
    appearance.customDirection?.trim() || "",
    "premium campaign art, no text, no logo, no watermark",
  ].filter(Boolean).join(", ");
}

export function figureGenerationPlan(
  image: MockupImageSlot,
  canvas: MockupCanvasSpec,
): MockupFigureGenerationSpec {
  const consistencyKey = image.figureGeneration?.consistencyKey || `manual-${image.id}`;
  const presentation = image.figureGeneration?.presentation || image.personStyle?.presentation || "neutral";
  const appearance = image.figureGeneration?.appearance || defaultAppearance(image);
  const poseId = image.figureGeneration?.poseId || "neutral";
  const expressionId = image.figureGeneration?.expressionId || "calm";
  if (image.figureGeneration) {
    const renderMode = image.figureGeneration.renderMode || (image.figureGeneration.status === "generated" ? "generated-raster" : "editable-rig");
    return {
      ...image.figureGeneration,
      renderMode,
      presentation,
      appearance,
      poseId,
      expressionId,
      variants: image.figureGeneration.variants || [],
      compositing: image.figureGeneration.compositing || DEFAULT_FIGURE_COMPOSITING,
    };
  }
  return {
    qualityTarget: "cinematic-feature-animation",
    renderMode: "editable-rig",
    presentation,
    appearance,
    poseId,
    expressionId,
    status: "planned",
    provider: "gpt-image-2",
    prompt: buildPrompt(image, canvas, presentation, appearance, poseId, expressionId),
    negativePrompt: "existing movie character, franchise likeness, celebrity, photoreal identity, uncanny face, plastic skin, malformed hands, extra fingers, asymmetrical eyes, intersecting limbs, clipped silhouette, flat lighting, low detail, text, logo, watermark",
    seed: stableSeed(consistencyKey),
    consistencyKey,
    fallback: "cinematic-3d-canvas-v1",
    variants: [],
    compositing: DEFAULT_FIGURE_COMPOSITING,
  };
}

export function customizeFigureGeneration(
  image: MockupImageSlot,
  canvas: MockupCanvasSpec,
  choices: {
    presentation?: MockupFigureGenerationSpec["presentation"];
    appearance?: Partial<MockupFigureAppearance>;
    poseId?: MockupFigurePoseId;
    expressionId?: MockupFigureExpressionId;
  },
): MockupFigureGenerationSpec {
  const current = figureGenerationPlan(image, canvas);
  const presentation = choices.presentation || current.presentation;
  const appearance = { ...defaultAppearance(image), ...current.appearance, ...choices.appearance };
  const poseId = choices.poseId || current.poseId || "neutral";
  const expressionId = choices.expressionId || current.expressionId || "calm";
  const choiceSeed = stableSeed(`${current.consistencyKey}|${presentation}|${JSON.stringify(appearance)}|${poseId}|${expressionId}`);
  return {
    ...current,
    presentation,
    appearance,
    poseId,
    expressionId,
    renderMode: "editable-rig",
    status: "planned",
    prompt: buildPrompt(image, canvas, presentation, appearance, poseId, expressionId),
    seed: choiceSeed,
    customizationSkill: {
      id: "customize_subject_identity",
      version: "1.0.0",
      executionKey: `${current.consistencyKey}:customize_subject_identity:1.0.0:${choiceSeed}`,
      decisions: { presentation, appearance, poseId, expressionId, seed: choiceSeed },
    },
    generatedAt: undefined,
    model: undefined,
    providerMode: undefined,
    error: undefined,
  };
}

export function cinematicFigureGenerationAvailable(): boolean {
  return isAiConnected();
}

async function fileToDataUrl(source: string): Promise<string> {
  if (source.startsWith("data:image/")) return source;
  const resolved = /^https?:\/\//i.test(source) ? source : convertFileSrc(source);
  const response = await fetch(resolved);
  if (!response.ok) throw new Error(`Kunne ikke lese generert figur (${response.status}).`);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Kunne ikke gjøre figuren eksportklar."));
    reader.readAsDataURL(blob);
  });
}

function semanticAudit(result: AiImageResult): MockupFigureSemanticAudit | undefined {
  const raw = result.visual_audit;
  if (!raw || raw.unavailable) return undefined;
  const checks: MockupFigureQaCheck[] = [];
  const labels: Record<string, string> = {
    anatomy: "Anatomi", hands: "Hender", symmetry: "Symmetri",
    collisions: "Kollisjoner", subject_isolation: "Isolasjon",
    brand_harmony: "Brandharmoni", identity_continuity: "Identitetskontinuitet",
  };
  for (const [id, label] of Object.entries(labels)) {
    const item = raw[id];
    if (!item || typeof item !== "object") continue;
    const value = item as { passed?: unknown; score?: unknown; detail?: unknown };
    checks.push({
      id,
      passed: value.passed === true,
      score: typeof value.score === "number" ? value.score : undefined,
      detail: `${label}: ${typeof value.detail === "string" ? value.detail : "Ingen detalj"}`,
    });
  }
  return {
    score: typeof raw.score === "number" ? raw.score : 0,
    model: typeof raw.model === "string" ? raw.model : undefined,
    summary: typeof raw.summary === "string" ? raw.summary : "Visuell modellaudit fullført.",
    checks,
  };
}

async function pixelAudit(source: string, canvasSpec: MockupCanvasSpec) {
  const resolved = await materializeMockupAsset(source);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => reject(new Error("Kunne ikke pikselkontrollere figurassetet."));
    next.src = resolved;
  });
  const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas QA er utilgjengelig.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const sampled = evaluateFigurePixelBuffer({
    width: canvas.width,
    height: canvas.height,
    data: context.getImageData(0, 0, canvas.width, canvas.height).data,
    primary: canvasSpec.accent2,
    accent: canvasSpec.accent,
  });
  sampled.width = image.naturalWidth;
  sampled.height = image.naturalHeight;
  const resolution = sampled.checks.find((check) => check.id === "resolution");
  if (resolution) {
    resolution.passed = image.naturalWidth >= 1024 && image.naturalHeight >= 1024;
    resolution.detail = `${image.naturalWidth}×${image.naturalHeight}px`;
  }
  sampled.passed = sampled.checks.every((check) => check.passed);
  return sampled;
}

async function combinedQa(
  source: string,
  result: AiImageResult,
  canvas: MockupCanvasSpec,
): Promise<MockupFigureVisualQa> {
  const pixel = await pixelAudit(source, canvas);
  const semantic = semanticAudit(result);
  const checks = [...pixel.checks, ...(semantic?.checks || [])];
  const failed = checks.filter((check) => !check.passed);
  const score = Math.round((checks.reduce((sum, check) => sum + (check.score ?? (check.passed ? 100 : 0)), 0) / Math.max(1, checks.length)));
  return {
    status: failed.length === 0 && semantic ? "passed" : failed.length <= 1 ? "warning" : "failed",
    score,
    checkedAt: new Date().toISOString(),
    pixel,
    semantic,
    checks,
  };
}

function masterReference(plan: MockupFigureGenerationSpec, image: MockupImageSlot): string | undefined {
  const master = plan.characterMaster;
  const approved = master?.views[master.approvedView]?.image;
  if (approved) return approved;
  if (image.mediaProvenance?.source === "generated" && image.image) return image.image;
  return undefined;
}

function masterLockDirection(plan: MockupFigureGenerationSpec): string {
  const locks = plan.characterMaster?.locks || {
    face: true, hair: true, outfit: true, palette: true,
  };
  const labels = {
    face: "facial identity and proportions",
    hair: "hair shape, colour and hairline",
    outfit: "wardrobe construction, material and prop",
    palette: "exact wardrobe brand colours",
  } as const;
  const locked = (Object.keys(locks) as Array<keyof typeof locks>)
    .filter((key) => locks[key])
    .map((key) => labels[key]);
  return locked.length
    ? `Identity lock: preserve exactly ${locked.join(", ")}`
    : "No identity attributes are locked; follow only the requested change";
}

async function generateAsset(input: {
  image: MockupImageSlot;
  canvas: MockupCanvasSpec;
  projectId: string;
  variantKey: string;
  prompt: string;
  reference?: string;
  label: string;
  kind: MockupFigureVariant["kind"];
  poseId?: MockupFigurePoseId;
  expressionId?: MockupFigureExpressionId;
  view?: MockupFigureMasterView;
}): Promise<{ source: string; variant: MockupFigureVariant; result: AiImageResult }> {
  const plan = figureGenerationPlan(input.image, input.canvas);
  const result = await generateImage({
    prompt: `${input.prompt}. Avoid: ${plan.negativePrompt}`,
    image_size: "portrait_4_3",
    seed: plan.seed,
    model: "gpt-image-2",
    quality: "high",
    background: "transparent",
    output_format: "png",
    reference_image: input.reference,
    audit_image: true,
    brand_primary: input.canvas.accent2,
    brand_accent: input.canvas.accent,
    asset_context: {
      project_id: input.projectId,
      image_id: input.image.id,
      variant_key: input.variantKey,
    },
  });
  const localDataUrl = await fileToDataUrl(result.image_path);
  const source = result.asset_ref || localDataUrl;
  const qa = await combinedQa(localDataUrl, result, input.canvas);
  return {
    source,
    result,
    variant: {
      id: result.asset_hash ? `figure-${result.asset_hash.slice(0, 16)}` : `figure-${Date.now()}-${input.variantKey}`,
      label: input.label,
      kind: input.kind,
      image: source,
      assetHash: result.asset_hash || undefined,
      poseId: input.poseId,
      expressionId: input.expressionId,
      view: input.view,
      generatedAt: new Date().toISOString(),
      providerMode: result.provider_mode,
      qa,
    },
  };
}

export async function generateCinematicFigure(
  image: MockupImageSlot,
  canvas: MockupCanvasSpec,
  projectId: string,
): Promise<Partial<MockupImageSlot>> {
  if (!isAiConnected()) throw new Error("AI-proxyen er ikke tilkoblet. Logg inn med Role Room-token i Innstillinger.");
  const plan = figureGenerationPlan(image, canvas);
  const poseId = plan.poseId || "neutral";
  const expressionId = plan.expressionId || "calm";
  const generated = await generateAsset({
    image, canvas, projectId,
    variantKey: `${poseId}-${expressionId}`,
    prompt: `${plan.prompt}. ${masterLockDirection(plan)}`,
    reference: masterReference(plan, image),
    label: `${FIGURE_POSE_PRESETS.find((item) => item.id === poseId)?.label || poseId} · ${FIGURE_EXPRESSION_PRESETS.find((item) => item.id === expressionId)?.label || expressionId}`,
    kind: "pose", poseId, expressionId,
  });
  return {
    image: generated.source,
    fit: "contain", radius: 0, shadow: false,
    sprite: undefined,
    figureGeneration: {
      ...plan,
      renderMode: "generated-raster",
      status: "generated",
      model: generated.result.model,
      providerMode: generated.result.provider_mode,
      seed: generated.result.seed ?? plan.seed,
      assetHash: generated.result.asset_hash || undefined,
      visualQa: generated.variant.qa,
      variants: appendUniqueFigureVariant(plan.variants, generated.variant),
      generatedAt: generated.variant.generatedAt,
      error: undefined,
    },
    mediaProvenance: {
      source: "generated",
      disclosure: "representative-concept-illustration",
      consistencyKey: plan.consistencyKey,
      model: generated.result.model,
      seed: generated.result.seed ?? plan.seed,
      assetHash: generated.result.asset_hash || undefined,
    },
  };
}

export async function generateCharacterMaster(
  image: MockupImageSlot,
  canvas: MockupCanvasSpec,
  projectId: string,
  onProgress?: (label: string) => void,
): Promise<Partial<MockupImageSlot>> {
  if (!isAiConnected()) throw new Error("AI-proxyen er ikke tilkoblet.");
  const plan = figureGenerationPlan(image, canvas);
  const views: MockupFigureMasterView[] = ["front", "three-quarter", "profile"];
  const labels: Record<MockupFigureMasterView, string> = { front: "Front", "three-quarter": "Tre kvart", profile: "Profil" };
  const prompts: Record<MockupFigureMasterView, string> = {
    front: "strict front-facing neutral character master view, balanced stance, both hands clearly visible",
    "three-quarter": "exact same character in a three-quarter master view, preserve facial identity, hair, wardrobe construction and proportions",
    profile: "exact same character in a clean side profile master view, preserve facial identity, hair, wardrobe construction and proportions",
  };
  const generatedViews: Partial<Record<MockupFigureMasterView, MockupFigureVariant>> = {};
  const initialReference = masterReference(plan, image);
  let reference = initialReference;
  let latest: Awaited<ReturnType<typeof generateAsset>> | null = null;
  let variants = plan.variants;
  for (const view of views) {
    onProgress?.(`Karakter-master · ${labels[view]}`);
    latest = await generateAsset({
      image, canvas, projectId,
      variantKey: `master-${view}`,
      prompt: `${plan.prompt}, ${prompts[view]}. ${masterLockDirection(plan)}`,
      reference,
      label: `Master · ${labels[view]}`,
      kind: "master-view",
      view,
    });
    generatedViews[view] = latest.variant;
    variants = appendUniqueFigureVariant(variants, latest.variant);
    reference = generatedViews.front?.image || initialReference;
  }
  if (!latest) throw new Error("Karakter-masteren ble ikke generert.");
  const approvedView: MockupFigureMasterView = "three-quarter";
  const active = generatedViews[approvedView] || latest.variant;
  return {
    image: active.image,
    fit: "contain", radius: 0, shadow: false, sprite: undefined,
    figureGeneration: {
      ...plan,
      renderMode: "generated-raster",
      status: "generated",
      model: latest.result.model,
      providerMode: latest.result.provider_mode,
      characterMaster: {
        id: `master-${plan.consistencyKey}`,
        consistencyKey: plan.consistencyKey,
        approvedView,
        views: generatedViews,
        locks: plan.characterMaster?.locks || { face: true, hair: true, outfit: true, palette: true },
        createdAt: new Date().toISOString(),
      },
      variants,
      visualQa: active.qa,
      assetHash: active.assetHash,
      generatedAt: active.generatedAt,
      error: undefined,
    },
    mediaProvenance: {
      source: "generated", disclosure: "representative-concept-illustration",
      consistencyKey: plan.consistencyKey, model: latest.result.model,
      seed: latest.result.seed ?? plan.seed, assetHash: active.assetHash,
    },
  };
}

export async function generateFigureSpritePackage(
  image: MockupImageSlot,
  canvas: MockupCanvasSpec,
  projectId: string,
  onProgress?: (label: string) => void,
): Promise<Partial<MockupImageSlot>> {
  if (!isAiConnected()) throw new Error("AI-proxyen er ikke tilkoblet.");
  const plan = figureGenerationPlan(image, canvas);
  const reference = masterReference(plan, image);
  if (!reference) throw new Error("Lag en karakter-master før spritepakken genereres.");
  const poses = FIGURE_POSE_PRESETS.filter((item) => ["neutral", "presenting", "listening", "pointing"].includes(item.id));
  const expressionId = plan.expressionId || "calm";
  const frames: MockupFigureVariant[] = [];
  let variants = plan.variants;
  let latest: Awaited<ReturnType<typeof generateAsset>> | null = null;
  for (const pose of poses) {
    onProgress?.(`Sprite · ${pose.label}`);
    latest = await generateAsset({
      image, canvas, projectId,
      variantKey: `sprite-${pose.id}-${expressionId}`,
      prompt: `${plan.prompt}, ${pose.prompt}. Preserve the approved master camera scale. ${masterLockDirection(plan)}`,
      reference,
      label: `Sprite · ${pose.label}`,
      kind: "sprite-frame", poseId: pose.id, expressionId,
    });
    frames.push(latest.variant);
    variants = appendUniqueFigureVariant(variants, latest.variant);
  }
  if (!latest || frames.length === 0) throw new Error("Spritepakken ble ikke generert.");
  return {
    image: frames[0].image,
    fit: "contain", radius: 0, shadow: false,
    sprite: {
      frames: frames.map((frame) => frame.image),
      labels: frames.map((frame) => frame.label),
      fps: 1,
      interpolation: "crossfade",
      packageId: `sprite-${plan.consistencyKey}-${Date.now()}`,
      layerManifest: FIGURE_LAYER_MANIFEST.map((layer) => ({ ...layer })),
    },
    figureGeneration: {
      ...plan,
      renderMode: "sprite-sequence",
      status: "generated",
      model: latest.result.model,
      providerMode: "reference-edit",
      variants,
      visualQa: frames.find((frame) => frame.qa?.status === "failed")?.qa
        || frames.find((frame) => frame.qa?.status === "warning")?.qa
        || frames[0].qa,
      generatedAt: new Date().toISOString(),
      error: undefined,
    },
    mediaProvenance: {
      source: "generated", disclosure: "representative-concept-illustration",
      consistencyKey: plan.consistencyKey, model: latest.result.model,
      seed: latest.result.seed ?? plan.seed,
    },
  };
}
