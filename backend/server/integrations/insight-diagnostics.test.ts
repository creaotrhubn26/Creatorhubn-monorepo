import { describe, expect, it } from "vitest";

import {
  distinctSources,
  validateNarrative,
  type DiagnosisEvidenceItem,
} from "./insight-diagnostics.js";

const bundle: DiagnosisEvidenceItem[] = [
  { n: 1, source: "geo-probe", label: "ai_mention Spotlight", value: 7, ref: "sig-1" },
  { n: 2, source: "geo-probe", label: "ai_mention Spotlight (forrige)", value: 3, ref: "sig-2" },
  { n: 3, source: "search-volume", label: "search_volume_avg casting", value: 1200, ref: "sig-3" },
];

describe("validateNarrative (siterings-plikt håndhevet i kode)", () => {
  it("godtar narrativ der påstandene siterer gyldig evidens", () => {
    const out = validateNarrative(
      "Spotlight doblet omtalene sine fra 3 til 7 [1][2]. Samtidig er søkevolumet for casting høyt [3]. Endringen er derfor trolig reell interesse, ikke målestøy.",
      bundle,
    );
    expect(out).not.toBeNull();
    expect(out!.citations).toEqual([1, 2, 3]);
  });

  it("forkaster fabrikkerte referanser — hele narrativet, ikke bare setningen", () => {
    expect(
      validateNarrative("Spotlight vokser [1]. Dette skyldes en ny kampanje [9].", bundle),
    ).toBeNull();
  });

  it("forkaster narrativ med usiterte påstander (maks én konklusjons-setning)", () => {
    expect(
      validateNarrative(
        "Spotlight vokser [1]. Casting-markedet er i endring. Alle satser på AI nå.",
        bundle,
      ),
    ).toBeNull();
  });

  it("forkaster under to siteringer og TYNT_GRUNNLAG", () => {
    expect(validateNarrative("Spotlight vokser [1].", bundle)).toBeNull();
    expect(validateNarrative("TYNT_GRUNNLAG", bundle)).toBeNull();
    expect(validateNarrative("", bundle)).toBeNull();
  });
});

describe("distinctSources (min-kilde-vakten)", () => {
  it("teller uavhengige kilder, ikke poster", () => {
    expect(distinctSources(bundle)).toBe(2); // geo-probe + search-volume
    expect(distinctSources(bundle.slice(0, 2))).toBe(1);
    expect(distinctSources([])).toBe(0);
  });
});
