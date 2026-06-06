/**
 * fireflyPromptHelper enhets-tester. Kjøres som Playwright spec for
 * konsistens med resten av suiten — ren TS-logikk, ingen browser-mount.
 */

import { test, expect } from "@playwright/test";
import {
  suggestPromptsLocal,
  extractContextFromAppInfo,
  extractContextFromPhotoshopState,
  type FireflyIntent,
} from "../src/lib/fireflyPromptHelper";
import type {
  LayerListResult,
  SelectionInfoResult,
} from "../src/services/photoshopBridgeService";

const mockAppInfo = (doc: { name: string; width: number; height: number }) => ({
  photoshop_version: "25.0",
  locale: "en_US",
  active_document: {
    id: 1,
    name: doc.name,
    width: doc.width,
    height: doc.height,
    resolution: 72,
    path: null,
  },
  documents: [],
});

test.describe("fireflyPromptHelper.suggestPromptsLocal", () => {
  test("remove_object returnerer alltid 1 forslag med tom prompt", () => {
    const out = suggestPromptsLocal("remove_object");
    expect(out).toHaveLength(1);
    expect(out[0].prompt).toBe("");
    expect(out[0].rationale).toContain("auto-fill");
  });

  test("expand_background med scene + style genererer canonical + variants", () => {
    const out = suggestPromptsLocal("expand_background", {
      scene_type: "wedding",
      style_tags: ["cinematic", "warm"],
      time_of_day: "golden_hour",
      subject_description: "outdoor ceremony",
    });
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out[0].prompt).toContain("continuation of outdoor ceremony");
    expect(out[0].prompt).toContain("golden hour");
    expect(out[0].prompt).toContain("cinematic, warm");
  });

  test("expand_background uten kontekst gir likevel et brukbart forslag", () => {
    const out = suggestPromptsLocal("expand_background");
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].prompt).toContain("continuation of existing scene");
  });

  test("replace_background bygger 'subject against backdrop'-mønster", () => {
    const out = suggestPromptsLocal("replace_background", {
      subject_description: "couple holding hands",
      user_intent: "mountain meadow at sunset",
      style_tags: ["cinematic"],
    });
    expect(out[0].prompt).toContain("couple holding hands");
    expect(out[0].prompt).toContain("mountain meadow");
  });

  test("stylize beholder subjekt og legger på stil + lighting", () => {
    const out = suggestPromptsLocal("stylize", {
      subject_description: "portrait of bride",
      style_tags: ["moody"],
      time_of_day: "blue_hour",
    });
    expect(out[0].prompt).toContain("portrait of bride");
    expect(out[0].prompt).toContain("moody");
    expect(out[0].prompt).toContain("blue hour");
  });

  test("fix_edges og remove_object bruker tom prompt", () => {
    const fix = suggestPromptsLocal("fix_edges");
    const remove = suggestPromptsLocal("remove_object");
    expect(fix[0].prompt).toBe("");
    expect(remove[0].prompt).toBe("");
  });

  test("extractContextFromAppInfo: gjenkjenner standard-aspects", () => {
    expect(extractContextFromAppInfo(mockAppInfo({ name: "test.psd", width: 1080, height: 1080 })).target_aspect).toBe("1:1");
    expect(extractContextFromAppInfo(mockAppInfo({ name: "test.psd", width: 1920, height: 1080 })).target_aspect).toBe("16:9");
    expect(extractContextFromAppInfo(mockAppInfo({ name: "test.psd", width: 1080, height: 1920 })).target_aspect).toBe("9:16");
    expect(extractContextFromAppInfo(mockAppInfo({ name: "test.psd", width: 1080, height: 1350 })).target_aspect).toBe("4:5");
  });

  test("extractContextFromAppInfo: ikke-standard-ratio returnerer undefined", () => {
    const ctx = extractContextFromAppInfo(mockAppInfo({ name: "test.psd", width: 1000, height: 700 }));
    expect(ctx.target_aspect).toBeUndefined();
  });

  test("extractContextFromAppInfo: infer scene_type fra doc-navn", () => {
    expect(extractContextFromAppInfo(mockAppInfo({ name: "Emma-bryllup-2026.psd", width: 1080, height: 1920 })).scene_type).toBe("wedding");
    expect(extractContextFromAppInfo(mockAppInfo({ name: "outdoor-landscape.psd", width: 1080, height: 1920 })).scene_type).toBe("landscape");
    expect(extractContextFromAppInfo(mockAppInfo({ name: "produkt-shot.psd", width: 1080, height: 1920 })).scene_type).toBe("product");
    expect(extractContextFromAppInfo(mockAppInfo({ name: "unknown.psd", width: 1080, height: 1920 })).scene_type).toBeUndefined();
  });

  test("extractContextFromPhotoshopState: bruker layer-navn for subject-hint", () => {
    const info = mockAppInfo({ name: "Emma-bryllup.psd", width: 1080, height: 1920 });
    const layers: LayerListResult = {
      count: 3,
      layers: [
        { name: "Background", kind: "pixel", visible: true, has_text: false, is_smart_object: false },
        { name: "Logo", kind: "smartObject", visible: true, has_text: false, is_smart_object: true },
        { name: "Bride and groom", kind: "smartObject", visible: true, has_text: false, is_smart_object: true },
      ],
    };
    const ctx = extractContextFromPhotoshopState(info, layers);
    expect(ctx.subject_description).toBe("bride and groom");
    expect(ctx.scene_type).toBe("wedding");
  });

  test("extractContextFromPhotoshopState: positivt prefix ('Hero', 'Subject') vinner", () => {
    const info = mockAppInfo({ name: "test.psd", width: 1080, height: 1080 });
    const layers: LayerListResult = {
      count: 4,
      layers: [
        { name: "Background", kind: "pixel", visible: true, has_text: false, is_smart_object: false },
        { name: "Watermark", kind: "text", visible: true, has_text: true, is_smart_object: false },
        { name: "Hero - product shot", kind: "smartObject", visible: true, has_text: false, is_smart_object: true },
        { name: "Logo", kind: "smartObject", visible: true, has_text: false, is_smart_object: true },
      ],
    };
    const ctx = extractContextFromPhotoshopState(info, layers);
    expect(ctx.subject_description).toContain("hero");
    expect(ctx.subject_description).toContain("product shot");
  });

  test("extractContextFromPhotoshopState: hopper over default-navn ('Layer 1', 'Background')", () => {
    const info = mockAppInfo({ name: "test.psd", width: 1080, height: 1080 });
    const layers: LayerListResult = {
      count: 3,
      layers: [
        { name: "Background", kind: "pixel", visible: true, has_text: false, is_smart_object: false },
        { name: "Layer 1", kind: "pixel", visible: true, has_text: false, is_smart_object: false },
        { name: "Vintage car", kind: "smartObject", visible: true, has_text: false, is_smart_object: true },
      ],
    };
    const ctx = extractContextFromPhotoshopState(info, layers);
    expect(ctx.subject_description).toBe("vintage car");
  });

  test("extractContextFromPhotoshopState: selection coverage gir intent-hint", () => {
    const info = mockAppInfo({ name: "test.psd", width: 1080, height: 1080 });
    const bigSelection: SelectionInfoResult = {
      exists: true,
      bounds: { top: 100, left: 100, bottom: 1000, right: 1000 },
      width: 900,
      height: 900,
      doc_width: 1080,
      doc_height: 1080,
      coverage_pct: 75,
    };
    const smallSelection: SelectionInfoResult = {
      exists: true,
      bounds: { top: 100, left: 100, bottom: 200, right: 200 },
      width: 100,
      height: 100,
      doc_width: 1080,
      doc_height: 1080,
      coverage_pct: 10,
    };
    const ctxBig = extractContextFromPhotoshopState(info, undefined, bigSelection);
    expect(ctxBig.user_intent).toContain("stor selection");
    const ctxSmall = extractContextFromPhotoshopState(info, undefined, smallSelection);
    expect(ctxSmall.user_intent).toContain("enkelt-element");
  });

  test("extractContextFromAppInfo: ingen active doc → tom kontekst", () => {
    const ctx = extractContextFromAppInfo({
      photoshop_version: "25.0",
      locale: "en_US",
      active_document: null,
      documents: [],
    });
    expect(ctx).toEqual({});
  });

  test("ALDRI returnerer negativ-formulering ('no X', 'without X')", () => {
    const intents: FireflyIntent[] = [
      "expand_background",
      "replace_background",
      "add_element",
      "stylize",
      "generate_subject",
    ];
    for (const intent of intents) {
      const out = suggestPromptsLocal(intent, {
        scene_type: "wedding",
        style_tags: ["cinematic"],
      });
      for (const s of out) {
        expect(s.prompt.toLowerCase()).not.toMatch(/\b(no|without|never)\b/);
      }
    }
  });
});
