/**
 * Demo-områdene for SenseAid Explore (DEMO_AREAS): struktur, unike id-er på
 * tvers av områdene, geodata innenfor området og at det nye innholdet følger
 * konvensjonene i kommentaren øverst i reiseguide-demo-data.ts.
 */
import { describe, expect, it } from "vitest";

import {
  DEMO_AREA,
  DEMO_AREAS,
  DEMO_CATEGORIES,
  DEMO_CHAPTER_PROMPTS,
  DEMO_HERO_IMAGES,
  DEMO_POIS,
} from "./reiseguide-demo-data.js";

const LANGS = ["nb", "en", "da"] as const;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const OSLO_SLUG = "oslo-kvadraturen-festningen-operaen";
/** Områdene skrevet etter Oslo; Oslo-manusene har noen kjente avvik fra varighetsrammene. */
const NEW_AREAS = DEMO_AREAS.filter((a) => a.slug !== OSLO_SLUG);

function decimals(n: number): number {
  const [, frac = ""] = String(n).split(".");
  return frac.length;
}

/** Ord på minst fire bokstaver, små bokstaver, uten tegnsetting (som i spørsmål-underveis-testen). */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4);
}

describe("DEMO_AREAS", () => {
  it("har minst tre områder, med Lørenskog og Nesoddtangen", () => {
    expect(DEMO_AREAS.length).toBeGreaterThanOrEqual(3);
    expect(DEMO_AREAS.map((a) => a.slug)).toEqual(expect.arrayContaining([OSLO_SLUG, "lorenskog", "nesoddtangen"]));
  });

  it("beholder Oslo-området uendret og først", () => {
    const oslo = DEMO_AREAS[0];
    expect(oslo.id).toBe("area_oslo_kvadraturen");
    expect(oslo.slug).toBe(OSLO_SLUG);
    expect(oslo.name).toBe("Kvadraturen, Akershus festning og Operaen");
    expect(oslo.id).toBe(DEMO_AREA.id);
    expect(oslo.pois.map((p) => p.id)).toEqual([
      "poi_akershus_festning",
      "poi_christiania_torv",
      "poi_gamle_radhus",
      "poi_oslo_bors",
      "poi_bankplassen",
      "poi_operaen",
    ]);
  });

  it("har unike id-er og gyldige, unike slugger for områder og steder på tvers av områdene", () => {
    const areaIds = DEMO_AREAS.map((a) => a.id);
    const areaSlugs = DEMO_AREAS.map((a) => a.slug);
    expect(new Set(areaIds).size).toBe(areaIds.length);
    expect(new Set(areaSlugs).size).toBe(areaSlugs.length);
    for (const slug of areaSlugs) expect(slug).toMatch(SLUG_RE);

    const poiIds = DEMO_POIS.map((p) => p.id);
    const poiSlugs = DEMO_POIS.map((p) => p.slug);
    expect(new Set(poiIds).size).toBe(poiIds.length);
    // guide_pois.slug er UNIQUE i hele tabellen, ikke per område.
    expect(new Set(poiSlugs).size).toBe(poiSlugs.length);
    for (const slug of poiSlugs) expect(slug).toMatch(SLUG_RE);
  });

  it("DEMO_POIS er alle stedene i alle områdene, flatt", () => {
    expect(DEMO_POIS).toEqual(DEMO_AREAS.flatMap((a) => a.pois));
  });

  it("gir hvert område steder, samme pris og sentrum og steder innenfor avgrensningen", () => {
    const categoryIds = new Set(DEMO_CATEGORIES.map((c) => c.id));
    for (const area of DEMO_AREAS) {
      expect(area.pois.length, area.slug).toBeGreaterThan(0);
      expect(area.priceNok, area.slug).toBe(DEMO_AREA.priceNok);
      expect(area.defaultLang).toBe("nb");
      const { south, west, north, east } = area.bbox;
      expect(south).toBeLessThan(north);
      expect(west).toBeLessThan(east);
      expect(area.center.lat).toBeGreaterThan(south);
      expect(area.center.lat).toBeLessThan(north);
      expect(area.center.lng).toBeGreaterThan(west);
      expect(area.center.lng).toBeLessThan(east);
      for (const poi of area.pois) {
        expect(poi.lat, poi.id).toBeGreaterThanOrEqual(south);
        expect(poi.lat, poi.id).toBeLessThanOrEqual(north);
        expect(poi.lng, poi.id).toBeGreaterThanOrEqual(west);
        expect(poi.lng, poi.id).toBeLessThanOrEqual(east);
        expect(categoryIds.has(poi.categoryId), poi.id).toBe(true);
      }
      const sortOrders = area.pois.map((p) => p.sortOrder);
      expect(new Set(sortOrders).size, area.slug).toBe(sortOrders.length);
    }
  });
});

describe("de nye områdene (Lørenskog, Nesoddtangen)", () => {
  it("har fire steder hver, der bare det første er gratis forhåndsvisning", () => {
    for (const area of NEW_AREAS) {
      expect(area.pois, area.slug).toHaveLength(4);
      const first = [...area.pois].sort((a, b) => a.sortOrder - b.sortOrder)[0];
      expect(area.pois.filter((p) => p.freePreview).map((p) => p.id), area.slug).toEqual([first.id]);
    }
  });

  it("følger konvensjonene for koordinater, radius, kilder og tekster", () => {
    for (const poi of NEW_AREAS.flatMap((a) => a.pois)) {
      expect(decimals(poi.lat), poi.id).toBeLessThanOrEqual(4);
      expect(decimals(poi.lng), poi.id).toBeLessThanOrEqual(4);
      expect(poi.triggerRadiusM, poi.id).toBeGreaterThanOrEqual(30);
      expect(poi.triggerRadiusM, poi.id).toBeLessThanOrEqual(300);
      expect(poi.sourceNote, poi.id).toMatch(/^Utkast /);
      expect(poi.sourceNote, poi.id).toMatch(/https?:\/\//);
      expect(poi.sourceNote, poi.id).toMatch(/Må verifiseres/);
      for (const lang of LANGS) {
        const t = poi.translations[lang];
        for (const field of [t.title, t.subtitle, t.summary, t.locationLabel]) {
          expect(field.trim(), `${poi.id} ${lang}`).not.toBe("");
        }
        expect(t.practicalInfo.length, `${poi.id} ${lang}`).toBeGreaterThan(0);
      }
    }
  });

  it("har fortelling (60–120 s) og synstolking (35–45 s) på alle språk, med varighet fra ordtall", () => {
    const wpm = { nb: 145, en: 150, da: 145 };
    for (const poi of NEW_AREAS.flatMap((a) => a.pois)) {
      for (const lang of LANGS) {
        const scripts = poi.scripts[lang];
        const narration = scripts.filter((s) => s.kind === "narration");
        const description = scripts.filter((s) => s.kind === "audio_description");
        expect(narration.length, `${poi.id} ${lang}`).toBeGreaterThanOrEqual(1);
        expect(narration.length, `${poi.id} ${lang}`).toBeLessThanOrEqual(2);
        expect(description, `${poi.id} ${lang}`).toHaveLength(1);
        for (const s of scripts) {
          const [min, max] = s.kind === "narration" ? [60, 120] : [35, 45];
          const fromWords = Math.round((s.text.trim().split(/\s+/).length / wpm[lang]) * 60);
          expect(s.estimatedDurationS, `${poi.id} ${lang} ${s.kind} ${s.chapterNo}`).toBe(fromWords);
          expect(fromWords, `${poi.id} ${lang} ${s.kind} ${s.chapterNo}`).toBeGreaterThanOrEqual(min);
          expect(fromWords, `${poi.id} ${lang} ${s.kind} ${s.chapterNo}`).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it("har tre quiz-spørsmål per språk med fasit som står i fortellingen", () => {
    for (const poi of NEW_AREAS.flatMap((a) => a.pois)) {
      for (const lang of LANGS) {
        const quiz = poi.quiz[lang];
        expect(quiz, `${poi.id} ${lang}`).toHaveLength(3);
        const manus = new Set(words(poi.scripts[lang].filter((s) => s.kind === "narration").map((s) => s.text).join(" ")));
        for (const q of quiz) {
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          expect(q.correctIndex).toBeGreaterThanOrEqual(0);
          expect(q.correctIndex).toBeLessThan(q.options.length);
          expect(new Set(q.options).size).toBe(q.options.length);
          const missing = words(q.options[q.correctIndex]).filter((w) => !manus.has(w));
          expect(missing, `${poi.id} ${lang}: ${q.question}`).toEqual([]);
        }
      }
    }
  });

  it("har spørsmål underveis og Commons-oppsett for hvert nytt sted", () => {
    for (const poi of NEW_AREAS.flatMap((a) => a.pois)) {
      expect(DEMO_CHAPTER_PROMPTS[poi.id], poi.id).toBeDefined();
      expect(DEMO_HERO_IMAGES[poi.id], poi.id).toBeDefined();
      // Filnavn-krav, så Commons-scriptet ikke velger et bygg med samme navn et annet sted.
      expect(DEMO_HERO_IMAGES[poi.id].titleMustIncludeAny?.length ?? 0, poi.id).toBeGreaterThan(0);
      expect(DEMO_HERO_IMAGES[poi.id].titleMustExclude?.length ?? 0, poi.id).toBeGreaterThan(0);
    }
  });
});

describe("dansk (da) som tredje språk", () => {
  it("har dansk oversettelse, manus og quiz for hvert sted i alle områdene", () => {
    for (const poi of DEMO_POIS) {
      const t = poi.translations.da;
      expect(t, poi.id).toBeDefined();
      for (const field of [t.title, t.subtitle, t.summary, t.locationLabel]) {
        expect(field.trim(), poi.id).not.toBe("");
      }
      expect(t.heroImageAlt, poi.id).toMatch(/^Foto af /);
      expect(t.practicalInfo.length, poi.id).toBe(poi.translations.nb.practicalInfo.length);
      expect(poi.quiz.da, poi.id).toHaveLength(poi.quiz.nb.length);
      for (const [i, q] of poi.quiz.da.entries()) {
        expect(q.options, `${poi.id} quiz ${i + 1}`).toHaveLength(poi.quiz.nb[i].options.length);
        expect(q.correctIndex, `${poi.id} quiz ${i + 1}`).toBe(poi.quiz.nb[i].correctIndex);
      }
    }
  });

  it("har samme kapitler og varianter som nb, med omtrent like mange setninger (tekstingen)", () => {
    const sentences = (text: string) => text.split(/(?<=[.!?»])\s+/).filter((s) => s.trim() !== "").length;
    for (const poi of DEMO_POIS) {
      const shape = (lang: "nb" | "da") => poi.scripts[lang].map((s) => `${s.kind}:${s.chapterNo}`);
      expect(shape("da"), poi.id).toEqual(shape("nb"));
      for (const [i, da] of poi.scripts.da.entries()) {
        const nb = poi.scripts.nb[i];
        expect(da.text.trim(), `${poi.id} ${da.kind} ${da.chapterNo}`).not.toBe("");
        expect(da.title?.trim(), `${poi.id} ${da.kind} ${da.chapterNo}`).toBeTruthy();
        expect(Math.abs(sentences(da.text) - sentences(nb.text)), `${poi.id} ${da.kind} ${da.chapterNo}`).toBeLessThanOrEqual(1);
        expect(da.text.split("\n\n").length, `${poi.id} ${da.kind} ${da.chapterNo}`).toBe(nb.text.split("\n\n").length);
        // Varighet fra ordtall (145 ord/min), innenfor ±20 % av nb.
        const fromWords = Math.round((da.text.trim().split(/\s+/).length / 145) * 60);
        expect(da.estimatedDurationS, `${poi.id} ${da.kind} ${da.chapterNo}`).toBe(fromWords);
        expect(Math.abs(fromWords - (nb.estimatedDurationS ?? 0)), `${poi.id} ${da.kind} ${da.chapterNo}`).toBeLessThanOrEqual(
          Math.ceil((nb.estimatedDurationS ?? 0) * 0.2),
        );
      }
    }
  });

  it("har danske kategorinavn", () => {
    for (const c of DEMO_CATEGORIES) expect(c.labels.da.trim(), c.id).not.toBe("");
  });
});

describe("oppslagene dekker bare kjente steder", () => {
  it("har ingen spørsmål underveis eller Commons-oppsett for steder som ikke finnes", () => {
    const ids = new Set(DEMO_POIS.map((p) => p.id));
    for (const id of Object.keys(DEMO_CHAPTER_PROMPTS)) expect(ids.has(id), id).toBe(true);
    for (const id of Object.keys(DEMO_HERO_IMAGES)) expect(ids.has(id), id).toBe(true);
  });
});
