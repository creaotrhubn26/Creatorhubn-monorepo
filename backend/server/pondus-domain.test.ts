import { describe, expect, it } from "vitest";
import {
  PONDUS_ANALYSIS_RUBRIC_VERSION,
  PONDUS_QUIZ_SCORING_VERSION,
  analyzePondusTemplate,
  parsePondusTemplateInput,
  scorePondusQuizAnswers,
} from "./pondus-domain.js";

const validTemplate = {
  name: "Telefonåpning",
  description: "En konkret og ærlig åpning.",
  category: "prospecting",
  kind: "telephone",
  steps: [
    { id: "intro", title: "Formål", prompt: "Kort formål på ett minutt", order: 0 },
    { id: "need", title: "Spør", prompt: "Hva er viktig for kunden?", order: 1 },
    { id: "next", title: "Neste steg", prompt: "Avtal møte neste uke", order: 2 },
  ],
  objections: [{ id: "timing", prompt: "Ikke nå", response: "Forstår. Hva passer bedre?" }],
};

describe("Pondus template validation", () => {
  it("normalizes a valid template", () => {
    const parsed = parsePondusTemplateInput(validTemplate);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.steps?.map((step) => step.id)).toEqual(["intro", "need", "next"]);
  });

  it("returns field-specific issues for unsafe input", () => {
    const parsed = parsePondusTemplateInput({
      ...validTemplate,
      name: "x".repeat(161),
      steps: [validTemplate.steps[0], validTemplate.steps[0]],
      kind: "carrier-pigeon",
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining(["name", "kind", "steps.1.id"]));
    }
  });
});

describe("Pondus explainable analysis", () => {
  it("is deterministic, bounded and versioned", () => {
    const first = analyzePondusTemplate(validTemplate);
    const second = analyzePondusTemplate(validTemplate);
    expect(first).toEqual(second);
    expect(first.score).toBeGreaterThanOrEqual(0);
    expect(first.score).toBeLessThanOrEqual(100);
    expect(first.analysis_meta.rubric_version).toBe(PONDUS_ANALYSIS_RUBRIC_VERSION);
    expect(first.analysis_meta.recommendations).toHaveLength(2);
    expect(Object.keys(first.analysis_meta.evidence)).toHaveLength(5);
  });
});

describe("Pondus quiz scoring", () => {
  it("scores raw answers on the server and identifies the scoring version", () => {
    const answers = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`q${index + 1}`, 0]));
    const scored = scorePondusQuizAnswers(answers);
    expect(scored.ok).toBe(true);
    if (scored.ok) {
      expect(scored.value.scoringVersion).toBe(PONDUS_QUIZ_SCORING_VERSION);
      expect(scored.value.total).toBeGreaterThanOrEqual(0);
      expect(scored.value.total).toBeLessThanOrEqual(100);
    }
  });

  it("rejects missing, unknown and out-of-range answers", () => {
    const scored = scorePondusQuizAnswers({ q1: 99, injected: 0 });
    expect(scored.ok).toBe(false);
    if (!scored.ok) {
      expect(scored.issues.some((issue) => issue.path === "answers.injected")).toBe(true);
      expect(scored.issues.some((issue) => issue.path === "answers.q12")).toBe(true);
    }
  });
});
