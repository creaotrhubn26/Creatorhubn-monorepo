import { describe, expect, it } from "vitest";
import { shotFramingFingerprint } from "../../frontend/shared/storyboard-shot-framing.js";
import { validateStoryboardAIFramingIntegrity } from "./storyboard-ai-framing-integrity.js";

const framing = {
  version: 1, shotSize: "CU", angle: "Eye level", lensMm: 50,
  centerX: 0.48, centerY: 0.36, zoom: 3, rollDegrees: 0,
  aspectRatio: 16 / 9, mode: "automatic", revision: 7,
};
const fingerprint = shotFramingFingerprint(framing)!;

describe("storyboard AI framing integrity", () => {
  it("accepts only when request, persisted viewport and approval agree", () => {
    expect(validateStoryboardAIFramingIntegrity({ metadata: {
      currentFramingFingerprint: fingerprint,
      aiOutputStale: false,
      sourceRevision: 4,
      aiPipeline: { framingFingerprint: fingerprint, sourceRevision: 4 },
    } }, framing)).toEqual({ valid: true, framingFingerprint: fingerprint });
  });

  it("rejects stale source and fingerprint laundering", () => {
    expect(validateStoryboardAIFramingIntegrity({ metadata: {
      currentFramingFingerprint: fingerprint,
      aiOutputStale: true,
      sourceRevision: 4,
      aiPipeline: { framingFingerprint: fingerprint, sourceRevision: 4 },
    } }, framing)).toMatchObject({ valid: false, code: "ai_output_stale" });

    const changed = { ...framing, zoom: 4, revision: 8 };
    expect(validateStoryboardAIFramingIntegrity({ metadata: {
      currentFramingFingerprint: shotFramingFingerprint(changed),
      aiOutputStale: false,
      sourceRevision: 4,
      aiPipeline: { framingFingerprint: fingerprint, sourceRevision: 4 },
    } }, changed)).toMatchObject({
      valid: false, code: "approved_image_framing_stale",
    });

    expect(validateStoryboardAIFramingIntegrity({ metadata: {
      currentFramingFingerprint: fingerprint,
      aiOutputStale: false,
      sourceRevision: 5,
      aiPipeline: { framingFingerprint: fingerprint, sourceRevision: 4 },
    } }, framing)).toMatchObject({
      valid: false, code: "approved_image_source_stale",
    });
  });
});
