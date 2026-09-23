/**
 * «Etter besøket»: ren logikk for quiz, vurdering, rate-limit og delingsside.
 */
import { describe, expect, it } from "vitest";

import {
  appDeepLink,
  buildQuizView,
  createRateLimiter,
  parseRatingInput,
  quizLanguages,
  ratingSummary,
  renderSharePage,
  type QuizRow,
} from "./reiseguide-after-visit.js";

const quizRows: QuizRow[] = [
  {
    id: "q_nb_2",
    poi_id: "poi_a",
    lang: "nb",
    sort_order: 2,
    question: "Andre?",
    options: ["x", "y"],
    correct_index: 1,
    explanation: null,
  },
  {
    id: "q_nb_1",
    poi_id: "poi_a",
    lang: "nb",
    sort_order: 1,
    question: "Første?",
    options: ["a", "b", "c"],
    correct_index: 0,
    explanation: "Fordi a.",
  },
  {
    id: "q_nb_broken",
    poi_id: "poi_a",
    lang: "nb",
    sort_order: 3,
    question: "Ødelagt",
    options: ["bare-ett"],
    correct_index: 0,
    explanation: null,
  },
  {
    id: "q_en_1",
    poi_id: "poi_a",
    lang: "EN",
    sort_order: 1,
    question: "First?",
    options: ["a", "b"],
    correct_index: 5,
    explanation: null,
  },
  {
    id: "q_other",
    poi_id: "poi_b",
    lang: "nb",
    sort_order: 1,
    question: "Annet sted",
    options: ["a", "b"],
    correct_index: 0,
    explanation: null,
  },
];

describe("quiz", () => {
  it("sorterer per sort_order, hopper over ugyldige rader og holder seg til ett sted og språk", () => {
    const view = buildQuizView(quizRows, "poi_a", "nb");
    expect(view.map((q) => q.no)).toEqual([1, 2]);
    expect(view[0]).toEqual({
      id: "q_nb_1",
      no: 1,
      question: "Første?",
      options: ["a", "b", "c"],
      correctIndex: 0,
      explanation: "Fordi a.",
    });
    expect(buildQuizView(quizRows, "poi_a", "en")).toEqual([]);
    expect(quizLanguages(quizRows, "poi_a")).toEqual(["en", "nb"]);
    expect(quizLanguages(quizRows, "poi_zzz")).toEqual([]);
  });
});

describe("vurdering", () => {
  it("godtar gyldig kropp og normaliserer språk og kommentar", () => {
    const parsed = parseRatingInput({ deviceId: "device-1234", stars: "4", lang: "NB", comment: "  Flott!  " });
    expect(parsed).toEqual({ ok: true, value: { deviceId: "device-1234", stars: 4, lang: "nb", comment: "Flott!" } });
    const bare = parseRatingInput({ deviceId: "device-1234", stars: 5 });
    expect(bare).toEqual({ ok: true, value: { deviceId: "device-1234", stars: 5, lang: null, comment: null } });
  });

  it("avviser manglende enhets-ID, stjerner utenfor 1–5, ugyldig språk og for lang kommentar", () => {
    expect(parseRatingInput(null)).toMatchObject({ ok: false, error: "invalid_body" });
    expect(parseRatingInput({ deviceId: "kort", stars: 3 })).toMatchObject({ ok: false, error: "invalid_device_id" });
    expect(parseRatingInput({ deviceId: "device-1234", stars: 0 })).toMatchObject({ ok: false, error: "invalid_stars" });
    expect(parseRatingInput({ deviceId: "device-1234", stars: 3.5 })).toMatchObject({ ok: false, error: "invalid_stars" });
    expect(parseRatingInput({ deviceId: "device-1234", stars: 3, lang: "no way" })).toMatchObject({ ok: false, error: "invalid_lang" });
    expect(parseRatingInput({ deviceId: "device-1234", stars: 3, comment: "x".repeat(501) })).toMatchObject({
      ok: false,
      error: "invalid_comment",
    });
  });

  it("runder snittet til én desimal og gir null uten vurderinger", () => {
    expect(ratingSummary({ poi_id: "p", average: "4.3333", count: "3" })).toEqual({ average: 4.3, count: 3 });
    expect(ratingSummary({ poi_id: "p", average: 4.25, count: 2 })).toEqual({ average: 4.3, count: 2 });
    expect(ratingSummary({ poi_id: "p", average: null, count: 0 })).toBeNull();
    expect(ratingSummary(undefined)).toBeNull();
  });

  it("rate-limiter teller per nøkkel i et glidende vindu", () => {
    let now = 0;
    const limited = createRateLimiter(2, 1_000, () => now);
    expect(limited("a")).toBe(false);
    expect(limited("a")).toBe(false);
    expect(limited("a")).toBe(true);
    expect(limited("b")).toBe(false);
    now = 1_001;
    expect(limited("a")).toBe(false);
  });
});

describe("delingsside", () => {
  it("bygger deep link og HTML med Open Graph, escapet tekst og app-knapp", () => {
    expect(appDeepLink("akershus-festning", "nb")).toBe("senseaidexplore://poi/akershus-festning?lang=nb");
    expect(appDeepLink("a b")).toBe("senseaidexplore://poi/a%20b");
    const html = renderSharePage({
      title: "Akershus <festning>",
      subtitle: "Borgen \"som\" aldri falt",
      summary: null,
      locationLabel: "Oslo, Norge",
      imageUrl: "https://media.test/hero.jpg",
      imageAlt: "Slottet sett fra sør",
      lang: "nb",
      shareUrl: "https://api.test/api/guide/share/akershus-festning?lang=nb",
      appUrl: "senseaidexplore://poi/akershus-festning?lang=nb",
    });
    expect(html).toContain('<html lang="nb">');
    expect(html).toContain("<title>Akershus &lt;festning&gt; · SenseAid Explore</title>");
    expect(html).toContain('<meta property="og:description" content="Borgen &quot;som&quot; aldri falt">');
    expect(html).toContain('<meta property="og:image" content="https://media.test/hero.jpg">');
    expect(html).toContain('<meta property="og:image:alt" content="Slottet sett fra sør">');
    expect(html).toContain('href="senseaidexplore://poi/akershus-festning?lang=nb">Åpne i SenseAid Explore</a>');
    expect(html).not.toContain("<festning>");
    const english = renderSharePage({
      title: "Opera",
      subtitle: null,
      summary: null,
      locationLabel: null,
      imageUrl: null,
      imageAlt: null,
      lang: "en",
      shareUrl: "https://api.test/api/guide/share/operaen?lang=en",
      appUrl: "senseaidexplore://poi/operaen?lang=en",
    });
    expect(english).toContain("Open in SenseAid Explore");
    expect(english).toContain('<meta name="twitter:card" content="summary">');
    expect(english).not.toContain("og:image");
  });

  it("krediterer bildet (escapet), og viser ingen kreditering uten bilde", () => {
    const base = {
      title: "Operaen",
      subtitle: null,
      summary: null,
      locationLabel: null,
      imageAlt: null,
      shareUrl: "https://api.test/api/guide/share/operaen?lang=en",
      appUrl: "senseaidexplore://poi/operaen?lang=en",
    };
    const html = renderSharePage({
      ...base,
      lang: "en",
      imageUrl: "https://upload.wikimedia.org/a.jpg",
      imageCredit: { author: "Kari <b>&</b>", license: "CC BY 2.0", sourceUrl: null },
    });
    expect(html).toContain('<p class="credit">Photo: Kari &lt;b&gt;&amp;&lt;/b&gt; · CC BY 2.0</p>');
    const noImage = renderSharePage({
      ...base,
      lang: "nb",
      imageUrl: null,
      imageCredit: { author: "Kari", license: null, sourceUrl: "https://commons.wikimedia.org/wiki/File:A.jpg" },
    });
    expect(noImage).not.toContain('class="credit"');
  });
});
