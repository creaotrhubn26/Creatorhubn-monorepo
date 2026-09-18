import { describe, expect, it } from "vitest";
import { buildCaptionCues, splitSentences } from "./reiseguide-captions.js";
import type { CharacterTiming } from "./reiseguide-soniox-tts.js";

/** Lager jevne tegn-tidsstempler (0,1 s per tegn) for en uttalt tekst. */
function timings(spoken: string, stepS = 0.1): CharacterTiming[] {
  return Array.from(spoken).map((char, i) => ({ char, startS: i * stepS, endS: (i + 1) * stepS }));
}

describe("splitSentences", () => {
  it("deler på . ! ? … og linjeskift, beholder tegnsetting", () => {
    expect(splitSentences("Hei der. Går det bra?\nJa!")).toEqual(["Hei der.", "Går det bra?", "Ja!"]);
  });

  it("tar med en avsluttende setning uten punktum", () => {
    expect(splitSentences("Første. Andre uten punktum")).toEqual(["Første.", "Andre uten punktum"]);
  });
});

describe("buildCaptionCues", () => {
  it("bruker manusets setninger når setningstallet stemmer, med uttalte tider", () => {
    const script = "Velkommen til Akershus festning. Borgen ble påbegynt rundt 1300.";
    const spoken = "Velkommen til Akershus festning. Borgen ble påbegynt rundt tretten hundre.";
    const cues = buildCaptionCues(script, timings(spoken));
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ startS: 0, endS: 3.2, text: "Velkommen til Akershus festning." });
    expect(cues[1]?.text).toBe("Borgen ble påbegynt rundt 1300.");
    expect(cues[1]?.startS).toBeCloseTo(3.3, 3);
    expect(cues[1]?.endS).toBeCloseTo(spoken.length * 0.1, 3);
  });

  it("faller tilbake til uttalt tekst når setningstallet ikke stemmer", () => {
    const script = "Én setning uten stopp";
    const spoken = "Første del. Andre del.";
    const cues = buildCaptionCues(script, timings(spoken));
    expect(cues.map((c) => c.text)).toEqual(["Første del.", "Andre del."]);
  });

  it("strekker svært korte cues og lar aldri cues overlappe", () => {
    const t: CharacterTiming[] = [
      { char: "J", startS: 0, endS: 0.05 },
      { char: "a", startS: 0.05, endS: 0.1 },
      { char: ".", startS: 0.1, endS: 0.1 },
      { char: " ", startS: 0.1, endS: 0.1 },
      { char: "N", startS: 0.2, endS: 0.3 },
      { char: "å", startS: 0.3, endS: 0.4 },
      { char: ".", startS: 0.4, endS: 0.4 },
    ];
    const cues = buildCaptionCues("Ja. Nå.", t);
    expect(cues).toHaveLength(2);
    expect(cues[0]?.endS).toBe(0.2);
    expect(cues[1]).toEqual({ startS: 0.2, endS: 0.6, text: "Nå." });
  });

  it("gir tom liste uten tidsstempler", () => {
    expect(buildCaptionCues("Noe.", [])).toEqual([]);
  });
});
