import { shotFramingFingerprint } from "../../frontend/shared/storyboard-shot-framing.js";

type StoryboardFramingRecord = {
  metadata?: Record<string, unknown> | null;
};

export type StoryboardAIFramingIntegrityResult =
  | { valid: true; framingFingerprint: string }
  | { valid: false; code: string; detail: string };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function revision(value: unknown): number | null {
  const number = typeof value === "number" ? value
    : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

/**
 * Fail-closed gate used immediately before animation preflight and submit.
 * The client context, persisted frame mirror and approved image candidate must
 * all identify the same applied viewport. This makes a stale UI incapable of
 * spending video credits with output produced for a previous crop.
 */
export function validateStoryboardAIFramingIntegrity(
  storyboard: StoryboardFramingRecord,
  shotFraming: unknown,
): StoryboardAIFramingIntegrityResult {
  const requested = shotFramingFingerprint(shotFraming);
  if (!requested) {
    return {
      valid: false,
      code: "framing_context_required",
      detail: "Synk det anvendte kamerautsnittet før animasjon.",
    };
  }
  const metadata = record(storyboard.metadata);
  if (metadata.aiOutputStale === true) {
    return {
      valid: false,
      code: "ai_output_stale",
      detail: "Utsnittet eller Pencil-kilden er endret. Regenerer AI-bildestegene før animasjon.",
    };
  }
  const persisted = text(metadata.currentFramingFingerprint);
  if (!persisted || persisted !== requested) {
    return {
      valid: false,
      code: "current_framing_changed",
      detail: "Kamerautsnittet er nyere enn det godkjente AI-bildet.",
    };
  }
  const pipeline = record(metadata.aiPipeline);
  const approved = text(pipeline.framingFingerprint);
  if (!approved || approved !== requested) {
    return {
      valid: false,
      code: "approved_image_framing_stale",
      detail: "Godkjent AI-bilde tilhører et eldre utsnitt. Generer og godkjenn på nytt.",
    };
  }
  const currentSourceRevision = revision(metadata.sourceRevision);
  const approvedSourceRevision = revision(pipeline.sourceRevision);
  if (currentSourceRevision == null || approvedSourceRevision == null
      || currentSourceRevision !== approvedSourceRevision) {
    return {
      valid: false,
      code: "approved_image_source_stale",
      detail: "Pencil-kilden er nyere enn det godkjente AI-bildet.",
    };
  }
  return { valid: true, framingFingerprint: requested };
}
