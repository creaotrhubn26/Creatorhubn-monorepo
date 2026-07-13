import { describe, expect, it } from "vitest";

import { isQuietNight, validateBriefText, type BriefFact } from "./butler-morning-brief.js";

const facts: BriefFact[] = [
  { n: 1, category: "innsikt/important", text: "Anbud: Rammeavtale video" },
  { n: 2, category: "frist", text: "2026-07-15: Fototjenester" },
  { n: 3, category: "risiko", text: "Konkursvakten: ingen nye risikofunn" },
];

describe("isQuietNight", () => {
  it("kun risiko-alt-friskt = stille natt (ingen LLM-kall)", () => {
    expect(isQuietNight([facts[2]])).toBe(true);
    expect(isQuietNight(facts)).toBe(false);
    expect(isQuietNight([])).toBe(true);
  });
});

describe("validateBriefText (butleren får ikke dikte i morgenkaffen)", () => {
  it("godtar brief der påstandene siterer nattens fakta", () => {
    expect(validateBriefText("Nytt anbud [1] med frist onsdag [2]. Anbefaler: se anbudet først.", facts)).toBe(true);
  });

  it("forkaster fabrikkerte referanser og usiterte briefer", () => {
    expect(validateBriefText("Alt går bra [9] og [1].", facts)).toBe(false);
    expect(validateBriefText("God morgen. Fin dag i dag.", facts)).toBe(false);
  });
});
