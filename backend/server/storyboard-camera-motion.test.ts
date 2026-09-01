import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  STORYBOARD_COVERAGE_POLICY_V1,
  applyCameraMotionWriteV1,
  cameraMotionRenderFingerprintV1,
  normalizeCameraMotionTrackV1,
  revalidateCameraMotionDependencyV1,
  STORYBOARD_CAMERA_MOTION_V1,
  evaluateStoryboardCoverageV1,
} from "./storyboard-camera-motion.js";
import { evaluateStoryboardCoverageV1 as evaluateSharedCoverage } from "../../frontend/shared/storyboard-coverage-policy.js";

type Fixture = {
  fixtureVersion: number;
  policyVersion: number;
  cases: Array<{
    id: string;
    input: unknown;
    expected: {
      classification: string;
      blockingCodes: string[];
      warningCodes: string[];
      infoCodes: string[];
      minimumCoverageFraction: number;
      evaluatedSampleCount: number;
      evaluatedTimesFingerprint: string;
    };
  }>;
};

const fixture = JSON.parse(
  readFileSync(
    new URL(
      "../../frontend/shared/fixtures/storyboard-coverage-policy-v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as Fixture;

describe("Storyboard CoveragePolicy v1 shared contract", () => {
  it("locks the fixture and runtime policy versions together", () => {
    expect(fixture.fixtureVersion).toBe(1);
    expect(fixture.policyVersion).toBe(STORYBOARD_COVERAGE_POLICY_V1.version);
    expect(STORYBOARD_COVERAGE_POLICY_V1.legacyProjectFrameRate).toEqual({
      value: 25,
      timescale: 1,
    });
  });

  for (const testCase of fixture.cases) {
    it(`matches shared fixture: ${testCase.id}`, () => {
      const backendReport = evaluateStoryboardCoverageV1(testCase.input);
      const sharedReport = evaluateSharedCoverage(testCase.input);

      expect(backendReport).toEqual(sharedReport);
      expect(backendReport).toEqual(
        evaluateStoryboardCoverageV1(structuredClone(testCase.input)),
      );
      expect({
        classification: backendReport.classification,
        blockingCodes: backendReport.blockingCodes,
        warningCodes: backendReport.warningCodes,
        infoCodes: backendReport.infoCodes,
        minimumCoverageFraction: backendReport.minimumCoverageFraction,
        evaluatedSampleCount: backendReport.evaluatedSampleCount,
        evaluatedTimesFingerprint: `sha256:${createHash("sha256")
          .update(
            backendReport.evaluatedTimes
              .map((time) => `${time.value}/${time.timescale}`)
              .join(","),
          )
          .digest("hex")}`,
      }).toEqual(testCase.expected);
    });
  }

  it("evaluates t=0, every export PTS and the exact keyframe time", () => {
    const motionCase = fixture.cases.find((entry) =>
      entry.id.startsWith("simple-push-in"),
    );
    expect(motionCase).toBeDefined();
    const report = evaluateStoryboardCoverageV1(motionCase?.input);
    const timeKeys = new Set(
      report.evaluatedTimes.map((time) => `${time.value}/${time.timescale}`),
    );

    expect(timeKeys.has("0/1")).toBe(true);
    expect(timeKeys.has("1/25")).toBe(true);
    expect(timeKeys.has("2/1")).toBe(true);
    expect(report.evaluatedSampleCount).toBeGreaterThanOrEqual(51);
  });

  it("fails closed for unsupported policy, invalid dimensions and malformed motion", () => {
    expect(
      evaluateStoryboardCoverageV1({ policyVersion: 2 }).blockingCodes,
    ).toEqual(["unsupported_policy_version"]);
    expect(
      evaluateStoryboardCoverageV1({
        policyVersion: 1,
        sourceSize: { width: 0, height: 1080 },
        outputSize: { width: 1920, height: 1080 },
      }).blockingCodes,
    ).toEqual(["invalid_dimensions"]);
    expect(
      evaluateStoryboardCoverageV1({
        policyVersion: 1,
        sourceSize: { width: 1920, height: 1080 },
        outputSize: { width: 1920, height: 1080 },
        shotDuration: { value: 2, timescale: 1 },
        motionTrack: {
          version: 1,
          enabled: true,
          mode: "keyframed",
          keyframes: [
            {
              id: "bad",
              time: { value: 3, timescale: 1 },
              pose: { centerX: 0.5, centerY: 0.5, zoom: 2, rollDegrees: 0 },
              easingFromPrevious: { kind: "linear" },
            },
          ],
        },
      }).blockingCodes,
    ).toEqual(["invalid_motion_track"]);
  });

  it("rejects non-finite framing even though tolerant UI decoding has defaults", () => {
    const report = evaluateStoryboardCoverageV1({
      policyVersion: 1,
      sourceSize: { width: 1920, height: 1080 },
      outputSize: { width: 1920, height: 1080 },
      initialFraming: { centerX: Number.NaN },
    });
    expect(report.blockingCodes).toEqual(["invalid_framing"]);
  });

  it("treats a disabled, otherwise valid track as static framing", () => {
    const report = evaluateStoryboardCoverageV1({
      policyVersion: 1,
      sourceSize: { width: 1920, height: 1080 },
      outputSize: { width: 1920, height: 1080 },
      shotDuration: { value: 2, timescale: 1 },
      motionTrack: {
        version: 1,
        enabled: false,
        mode: "keyframed",
        keyframes: [
          {
            id: "ignored-until-enabled",
            time: { value: 2, timescale: 1 },
            pose: { centerX: 0.75, centerY: 0.5, zoom: 1, rollDegrees: 0 },
            easingFromPrevious: { kind: "linear" },
          },
        ],
      },
    });

    expect(report.classification).toBe("valid");
    expect(report.evaluatedTimes).toEqual([{ value: 0, timescale: 1 }]);
  });
});

const canonicalDuration = { value: 2, timescale: 1 } as const;

function motionTrack(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    version: 1,
    enabled: true,
    mode: "keyframed",
    presetId: "push-in",
    keyframes: [
      {
        id: "kf-1",
        time: { value: 1, timescale: 1 },
        pose: {
          centerX: 0.5,
          centerY: 0.5,
          zoom: 1.2,
          rollDegrees: 0,
        },
        easingFromPrevious: { kind: "easeInOut" },
      },
    ],
    ...overrides,
  };
}

describe("CameraMotionTrack v1 write boundary", () => {
  it("normalizes keyframe order, rational time and bounded pose values", () => {
    const normalized = normalizeCameraMotionTrackV1(
      motionTrack({
        keyframes: [
          {
            id: "late",
            time: { value: 4, timescale: 2 },
            pose: {
              centerX: 2,
              centerY: -1,
              zoom: 99,
              rollDegrees: 540,
              focusAnchorX: 1.5,
              focusAnchorY: -0.5,
            },
            easingFromPrevious: { kind: "hold" },
          },
          {
            id: "early",
            time: { value: 12, timescale: 24 },
            pose: {
              centerX: 0.4,
              centerY: 0.6,
              zoom: 1,
              rollDegrees: -361,
            },
            easingFromPrevious: { kind: "linear" },
          },
        ],
      }),
      canonicalDuration,
    );

    expect(normalized).toEqual({
      ok: true,
      value: {
        version: 1,
        enabled: true,
        mode: "keyframed",
        presetId: "push-in",
        keyframes: [
          expect.objectContaining({
            id: "early",
            time: { value: 1, timescale: 2 },
            pose: expect.objectContaining({ rollDegrees: -1 }),
          }),
          expect.objectContaining({
            id: "late",
            time: { value: 2, timescale: 1 },
            pose: {
              centerX: 1,
              centerY: 0,
              zoom: 16,
              rollDegrees: 180,
              focusAnchorX: 1,
              focusAnchorY: 0,
            },
          }),
        ],
      },
    });
  });

  it("rejects unknown fields at every known v1 schema boundary", () => {
    const base = motionTrack();
    const baseKeyframe = (base.keyframes as Record<string, unknown>[])[0];
    const variants = [
      { ...base, vendorExtension: true },
      {
        ...base,
        keyframes: [{ ...baseKeyframe, vendorExtension: true }],
      },
      {
        ...base,
        keyframes: [
          {
            ...baseKeyframe,
            time: {
              ...(baseKeyframe.time as Record<string, unknown>),
              vendorExtension: true,
            },
          },
        ],
      },
      {
        ...base,
        keyframes: [
          {
            ...baseKeyframe,
            pose: {
              ...(baseKeyframe.pose as Record<string, unknown>),
              vendorExtension: true,
            },
          },
        ],
      },
      {
        ...base,
        keyframes: [
          {
            ...baseKeyframe,
            easingFromPrevious: {
              ...(baseKeyframe.easingFromPrevious as Record<string, unknown>),
              vendorExtension: true,
            },
          },
        ],
      },
    ];

    for (const variant of variants) {
      expect(
        normalizeCameraMotionTrackV1(variant, canonicalDuration),
      ).toMatchObject({
        ok: false,
        error: "invalid_camera_motion_track",
      });
    }
  });

  it("rejects duplicate normalized time, t=0, overflow, deep and oversized input", () => {
    const duplicate = motionTrack({
      keyframes: [
        (motionTrack().keyframes as unknown[])[0],
        {
          ...(motionTrack().keyframes as Record<string, unknown>[])[0],
          id: "duplicate-time",
          time: { value: 2, timescale: 2 },
        },
      ],
    });
    expect(
      normalizeCameraMotionTrackV1(duplicate, canonicalDuration),
    ).toMatchObject({ ok: false, error: "invalid_camera_motion_track" });
    expect(
      normalizeCameraMotionTrackV1(
        motionTrack({
          keyframes: [
            {
              ...(motionTrack().keyframes as Record<string, unknown>[])[0],
              time: { value: 0, timescale: 1 },
            },
          ],
        }),
        canonicalDuration,
      ),
    ).toMatchObject({
      ok: false,
      error: "invalid_camera_motion_track",
    });
    expect(
      normalizeCameraMotionTrackV1(
        motionTrack({
          keyframes: Array.from(
            { length: STORYBOARD_CAMERA_MOTION_V1.maximumKeyframeCount + 1 },
            (_, index) => ({
              ...(motionTrack().keyframes as Record<string, unknown>[])[0],
              id: `overflow-${index}`,
            }),
          ),
        }),
        canonicalDuration,
      ),
    ).toMatchObject({
      ok: false,
      error: "invalid_camera_motion_track",
    });
    let deep: Record<string, unknown> = {};
    for (let index = 0; index < 20; index += 1) deep = { child: deep };
    expect(
      normalizeCameraMotionTrackV1(
        { ...motionTrack(), deep },
        canonicalDuration,
      ),
    ).toMatchObject({ ok: false, error: "camera_motion_payload_too_deep" });
    expect(
      normalizeCameraMotionTrackV1(
        {
          ...motionTrack(),
          padding: "x".repeat(STORYBOARD_CAMERA_MOTION_V1.maximumPayloadBytes),
        },
        canonicalDuration,
      ),
    ).toMatchObject({
      ok: false,
      error: "camera_motion_payload_too_large",
    });
  });

  it("fingerprints canonical render identity without editor IDs or preset labels", () => {
    const first = normalizeCameraMotionTrackV1(
      motionTrack(),
      canonicalDuration,
    );
    const second = normalizeCameraMotionTrackV1(
      motionTrack({
        presetId: "custom-label",
        keyframes: [
          {
            ...(motionTrack().keyframes as Record<string, unknown>[])[0],
            id: "different-editor-id",
          },
        ],
      }),
      canonicalDuration,
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(
      cameraMotionRenderFingerprintV1(first.value, canonicalDuration),
    ).toBe(cameraMotionRenderFingerprintV1(second.value, canonicalDuration));
    expect(
      cameraMotionRenderFingerprintV1(first.value, canonicalDuration),
    ).toBe(
      "sha256:f52928b60fda1c63d0c916728a99da8635c4e09f2d081d5b2b2ad0620f800469",
    );
  });

  it("owns OCC, canonical sidecars, no-op detection and explicit deletion", () => {
    const baseFrame = {
      updatedAt: "2026-08-29T10:00:00.000Z",
      sourceUpdatedAt: "2026-08-29T09:00:00.000Z",
      shotDuration: canonicalDuration,
      shotFraming: {
        version: 1,
        centerX: 0.5,
        centerY: 0.5,
        zoom: 1,
        rollDegrees: 0,
        aspectRatio: 16 / 9,
        mode: "manual",
        revision: 1,
      },
    };
    const written = applyCameraMotionWriteV1(
      baseFrame,
      {
        cameraMotionTrack: motionTrack(),
        expectedMotionRevision: 0,
      },
      "2026-08-29T11:00:00.000Z",
    );
    expect(written).toMatchObject({
      ok: true,
      value: {
        cameraMotionRevision: 1,
        cameraMotionStatus: "valid",
        changed: true,
        sourceUpdatedAt: baseFrame.sourceUpdatedAt,
      },
    });
    if (!written.ok) return;
    const persisted = { ...baseFrame, ...written.value };
    const replay = applyCameraMotionWriteV1(
      persisted,
      {
        cameraMotionTrack: structuredClone(written.value.cameraMotionTrack),
        expectedMotionRevision: 1,
      },
      "2026-08-29T12:00:00.000Z",
    );
    expect(replay).toMatchObject({
      ok: true,
      value: { cameraMotionRevision: 1, changed: false },
    });
    expect(
      applyCameraMotionWriteV1(
        persisted,
        {
          cameraMotionTrack: null,
          expectedMotionRevision: 0,
        },
        "2026-08-29T12:00:00.000Z",
      ),
    ).toMatchObject({
      ok: false,
      error: "camera_motion_revision_conflict",
      currentCameraMotionRevision: 1,
    });
    const deleted = applyCameraMotionWriteV1(
      persisted,
      {
        cameraMotionTrack: null,
        expectedMotionRevision: 1,
      },
      "2026-08-29T12:00:00.000Z",
    );
    expect(deleted).toMatchObject({
      ok: true,
      value: {
        cameraMotionTrack: null,
        cameraMotionRevision: 2,
        cameraMotionStatus: "valid",
        changed: true,
      },
    });
    if (!deleted.ok) return;
    expect(
      applyCameraMotionWriteV1(
        { ...persisted, ...deleted.value },
        {
          cameraMotionTrack: null,
          expectedMotionRevision: 2,
        },
        "2026-08-29T13:00:00.000Z",
      ),
    ).toMatchObject({
      ok: true,
      value: { cameraMotionRevision: 2, changed: false },
    });
  });

  it("preserves future raw drafts and revalidates framing and duration dependencies", () => {
    const future = { version: 2, spline: { kind: "future" } };
    const baseFrame = {
      updatedAt: "2026-08-29T10:00:00.000Z",
      shotDuration: canonicalDuration,
      cameraMotionTrack: future,
      cameraMotionRevision: 3,
      cameraMotionStatus: "valid",
    };
    expect(
      applyCameraMotionWriteV1(
        baseFrame,
        {
          cameraMotionTrack: null,
          expectedMotionRevision: 3,
        },
        "2026-08-29T11:00:00.000Z",
      ),
    ).toMatchObject({
      ok: false,
      error: "camera_motion_upgrade_required",
      currentCameraMotionTrack: future,
      currentCameraMotionRevision: 3,
      currentCameraMotionStatus: "invalid",
    });
    expect(
      revalidateCameraMotionDependencyV1(
        baseFrame,
        { ...baseFrame, shotDuration: { value: 1, timescale: 1 } },
        "duration",
        "2026-08-29T11:00:00.000Z",
      ),
    ).toMatchObject({
      cameraMotionTrack: future,
      cameraMotionRevision: 4,
      cameraMotionStatus: "invalid",
      cameraMotionFingerprint: null,
    });
  });

  it("allows a malformed non-future draft to be repaired or deleted", () => {
    const malformed = {
      enabled: true,
      mode: "keyframed",
      keyframes: [],
    };
    expect(
      applyCameraMotionWriteV1(
        {
          updatedAt: "2026-08-29T10:00:00.000Z",
          shotDuration: canonicalDuration,
          cameraMotionTrack: malformed,
          cameraMotionRevision: 3,
          cameraMotionStatus: "invalid",
        },
        {
          cameraMotionTrack: null,
          expectedMotionRevision: 3,
        },
        "2026-08-29T11:00:00.000Z",
      ),
    ).toMatchObject({
      ok: true,
      value: {
        cameraMotionTrack: null,
        cameraMotionRevision: 4,
        cameraMotionStatus: "valid",
      },
    });
  });
});
