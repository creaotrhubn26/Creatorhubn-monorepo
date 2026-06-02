/**
 * fireflyPromptHelper enhets-tester. Kjøres som Playwright spec for
 * konsistens med resten av suiten — ren TS-logikk, ingen browser-mount.
 */

import { test, expect } from "@playwright/test";
import {
  suggestPromptsLocal,
  type FireflyIntent,
} from "../src/lib/fireflyPromptHelper";

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
