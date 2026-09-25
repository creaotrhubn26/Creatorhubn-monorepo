/**
 * Spørsmål underveis (0662_reiseguide_chapter_prompts.sql): ren visningslogikk
 * og en sjekk av demo-innholdet mot manusene (ingen nye fakta).
 */
import { describe, expect, it } from "vitest";

import { buildChapterPrompts, chapterPromptView, type ChapterPromptRow } from "./reiseguide-chapter-prompts.js";
import { DEMO_CHAPTER_PROMPTS, DEMO_POIS } from "./reiseguide-demo-data.js";

const row = (over: Partial<ChapterPromptRow>): ChapterPromptRow => ({
  id: "pr",
  poi_id: "poi_a",
  lang: "nb",
  chapter_no: 1,
  kind: "look",
  at_fraction: "0.5000",
  prompt_text: "Se opp: tårnet.",
  options: null,
  answer_index: null,
  reveal_text: null,
  sort_order: 1,
  ...over,
});

describe("chapterPromptView", () => {
  it("gjør NUMERIC-tekst om til tall og trimmer tekst", () => {
    expect(chapterPromptView(row({ at_fraction: "0.2500", prompt_text: "  Se opp: tårnet.  ", reveal_text: " " }))).toEqual({
      id: "pr",
      kind: "look",
      atFraction: 0.25,
      text: "Se opp: tårnet.",
      options: null,
      answerIndex: null,
      revealText: null,
    });
  });

  it("gir guess med alternativer, fasit og forklaring", () => {
    const view = chapterPromptView(
      row({ kind: "guess", options: ["Tre", "Ni", ""], answer_index: 1, reveal_text: "Ni.", at_fraction: 0 }),
    );
    expect(view).toEqual({
      id: "pr",
      kind: "guess",
      atFraction: 0,
      text: "Se opp: tårnet.",
      options: ["Tre", "Ni"],
      answerIndex: 1,
      revealText: "Ni.",
    });
  });

  it("avviser ugyldige rader", () => {
    expect(chapterPromptView(row({ at_fraction: 1 }))).toBeNull();
    expect(chapterPromptView(row({ at_fraction: "-0.1" }))).toBeNull();
    expect(chapterPromptView(row({ at_fraction: "abc" }))).toBeNull();
    expect(chapterPromptView(row({ prompt_text: "   " }))).toBeNull();
    expect(chapterPromptView(row({ kind: "quiz" }))).toBeNull();
    expect(chapterPromptView(row({ kind: "guess", options: ["Bare ett"], answer_index: 0 }))).toBeNull();
    expect(chapterPromptView(row({ kind: "guess", options: ["A", "B", "C", "D", "E"], answer_index: 0 }))).toBeNull();
    expect(chapterPromptView(row({ kind: "guess", options: ["A", "B"], answer_index: 2 }))).toBeNull();
    expect(chapterPromptView(row({ kind: "guess", options: ["A", "B"], answer_index: null }))).toBeNull();
    expect(chapterPromptView(row({ kind: "guess", options: "A,B", answer_index: 0 }))).toBeNull();
  });
});

describe("buildChapterPrompts", () => {
  it("velger sted, språk og kapittel og sorterer på rekkefølge", () => {
    const rows = [
      row({ id: "b", sort_order: 2, at_fraction: "0.1" }),
      row({ id: "a", sort_order: 1, at_fraction: "0.8" }),
      row({ id: "annet-kapittel", chapter_no: 2 }),
      row({ id: "annet-sprak", lang: "en" }),
      row({ id: "annet-sted", poi_id: "poi_b" }),
      row({ id: "ugyldig", sort_order: 3, at_fraction: "1" }),
    ];
    expect(buildChapterPrompts(rows, "poi_a", "nb", 1).map((p) => p.id)).toEqual(["a", "b"]);
    expect(buildChapterPrompts(rows, "poi_a", "en", 1).map((p) => p.id)).toEqual(["annet-sprak"]);
    expect(buildChapterPrompts(rows, "poi_a", "nb", 3)).toEqual([]);
  });

  it("matcher språk uavhengig av store bokstaver i raden", () => {
    expect(buildChapterPrompts([row({ lang: "NB" })], "poi_a", "nb", 1)).toHaveLength(1);
  });
});

/** «Se opp»-kortet begynner med dette på hvert språk. */
const LOOK_PREFIX = { nb: /^Se opp: /, en: /^Look up: /, da: /^Se op: / } as const;

/** Ord på minst fire bokstaver, små bokstaver, uten tegnsetting. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4);
}

describe("demo-innholdet for spørsmål underveis", () => {
  it("har ett look og ett guess per sted og språk, på kapitler som finnes", () => {
    for (const poi of DEMO_POIS) {
      const byLang = DEMO_CHAPTER_PROMPTS[poi.id];
      expect(byLang, poi.id).toBeDefined();
      for (const lang of ["nb", "en", "da"] as const) {
        const prompts = byLang[lang];
        expect(prompts.map((p) => p.kind).sort(), `${poi.id} ${lang}`).toEqual(["guess", "look"]);
        for (const prompt of prompts) {
          const chapter = poi.scripts[lang].find((s) => s.kind === "narration" && s.chapterNo === prompt.chapterNo);
          expect(chapter, `${poi.id} ${lang} kapittel ${prompt.chapterNo}`).toBeDefined();
          expect(prompt.atFraction).toBeGreaterThanOrEqual(0);
          expect(prompt.atFraction).toBeLessThan(1);
          expect(prompt.text.trim()).not.toBe("");
          if (prompt.kind === "look") {
            expect(prompt.text).toMatch(LOOK_PREFIX[lang]);
            expect(prompt.options).toBeUndefined();
            expect(prompt.answerIndex).toBeUndefined();
          } else {
            const options = prompt.options ?? [];
            expect(options.length).toBeGreaterThanOrEqual(2);
            expect(options.length).toBeLessThanOrEqual(4);
            expect(options).toContain(options[prompt.answerIndex ?? -1]);
            expect(prompt.revealText?.trim()).toBeTruthy();
          }
        }
      }
    }
  });

  it("bygger fasit og «se opp»-tekst bare på ord som står i kapittelets manus", () => {
    for (const poi of DEMO_POIS) {
      for (const lang of ["nb", "en", "da"] as const) {
        for (const prompt of DEMO_CHAPTER_PROMPTS[poi.id][lang]) {
          const chapter = poi.scripts[lang].find((s) => s.kind === "narration" && s.chapterNo === prompt.chapterNo);
          const manus = new Set(words(chapter?.text ?? ""));
          const grounded =
            prompt.kind === "guess"
              ? words((prompt.options ?? [])[prompt.answerIndex ?? -1] ?? "")
              : words(prompt.text.replace(LOOK_PREFIX[lang], ""));
          const missing = grounded.filter((w) => !manus.has(w));
          // «Se opp»-tekstene omformulerer litt; minst tre av fire ord må stå i manuset.
          const allowed = prompt.kind === "guess" ? 0 : Math.floor(grounded.length / 4);
          expect(missing.length, `${poi.id} ${lang}: ${missing.join(", ")}`).toBeLessThanOrEqual(allowed);
        }
      }
    }
  });
});
