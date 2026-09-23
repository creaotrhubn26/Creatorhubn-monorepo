/**
 * Lydguide-POC steg 1: lese-endepunktet i reiseguide-routes.ts mot en mocket
 * pool (ingen DB, ingen nettverk, samme mønster som resten av server/-suiten).
 */
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import { buildPoiView, mediaUrl, parseLang, registerReiseguideRoutes, requestApiBase, resolveLang, type PoiRow, type ScriptRow, type TranslationRow } from "./reiseguide-routes.js";

type Handler = { match: RegExp; rows: unknown[] | ((params: unknown[]) => unknown[]) };

function makePool(handlers: Handler[]) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    for (const h of handlers) {
      if (h.match.test(sql)) {
        const rows = typeof h.rows === "function" ? h.rows(params) : h.rows;
        return { rows, rowCount: rows.length };
      }
    }
    return { rows: [], rowCount: 0 };
  });
  return { query } as unknown as Pick<Pool, "query"> & { query: typeof query };
}

function makeApp(pool: Pick<Pool, "query">, presigned: string | null = "https://s3.test/signed?sig=1") {
  const app = express();
  registerReiseguideRoutes(app, {
    pool,
    mediaUrlBase: "https://media.test/",
    publicApiBase: "https://api.test",
    presignMedia: async (key) => (presigned ? `${presigned}&key=${encodeURIComponent(key)}` : null),
  });
  return app;
}

const MEDIA = "https://media.test";

const areaRow = {
  id: "area_oslo",
  slug: "kvadraturen-festningen-operaen",
  name: "Kvadraturen, Akershus festning og Operaen",
  default_lang: "nb",
  center_lat: 59.909,
  center_lng: 10.742,
  bbox_south: 59.903,
  bbox_west: 10.728,
  bbox_north: 59.915,
  bbox_east: 10.76,
  status: "published",
  price_nok: 59,
  langs: ["en", "nb"],
  poi_count: "2",
};

const poiRows: PoiRow[] = [
  {
    id: "poi_akershus",
    area_id: "area_oslo",
    slug: "akershus-festning",
    category_id: "historisk",
    lat: 59.9075,
    lng: 10.7364,
    trigger_radius_m: 120,
    priority: 10,
    sort_order: 1,
    free_preview: true,
    hero_image_key: "reiseguide/akershus/hero.jpg",
    status: "published",
  },
  {
    id: "poi_opera",
    area_id: "area_oslo",
    slug: "operaen",
    category_id: "arkitektur",
    lat: 59.9073,
    lng: 10.753,
    trigger_radius_m: 200,
    priority: 8,
    sort_order: 2,
    free_preview: false,
    hero_image_key: null,
    status: "published",
  },
];

const translationRows: TranslationRow[] = [
  {
    poi_id: "poi_akershus",
    lang: "nb",
    title: "Akershus festning",
    subtitle: "En borg i endring",
    summary: "Middelalderborg og renessanseslott.",
    location_label: "Oslo, Norge",
    hero_image_alt: "Akershus festning sett fra sør i dagslys",
    practical_info: [{ label: "Adkomst", value: "Trinnfri fra Rådhusplassen" }, { bad: true }],
    editorial_status: "approved",
  },
  {
    poi_id: "poi_akershus",
    lang: "en",
    title: "Akershus Fortress",
    subtitle: "A fortress in flux",
    summary: "Medieval castle and renaissance palace.",
    location_label: "Oslo, Norway",
    hero_image_alt: "Akershus Fortress seen from the south in daylight",
    practical_info: [],
    editorial_status: "auto",
  },
  {
    poi_id: "poi_opera",
    lang: "nb",
    title: "Operaen",
    subtitle: null,
    summary: null,
    location_label: "Oslo, Norge",
    hero_image_alt: null,
    practical_info: null,
    editorial_status: "draft",
  },
];

const script = (over: Partial<ScriptRow>): ScriptRow => ({
  id: "scr",
  poi_id: "poi_akershus",
  lang: "nb",
  kind: "narration",
  chapter_no: 1,
  title: null,
  script_text: "Tekst.",
  image_key: null,
  image_alt: null,
  version: 1,
  editorial_status: "approved",
  estimated_duration_s: null,
  audio_id: null,
  audio_key: null,
  audio_format: null,
  audio_duration_s: null,
  captions_key: null,
  captions_cues: null,
  ...over,
});

const scriptRows: ScriptRow[] = [
  script({
    id: "scr_nb_1",
    chapter_no: 1,
    title: "En borg i endring",
    script_text: "Foran deg ligger Akershus festning.",
    image_key: "reiseguide/akershus/kap1.jpg",
    audio_id: "aud_1",
    audio_key: "reiseguide/akershus/nb/narration-1.m4a",
    audio_format: "m4a",
    audio_duration_s: "92.40",
    captions_key: "reiseguide/akershus/nb/narration-1.vtt",
    captions_cues: [{ startS: 0, endS: 3.2, text: "Foran deg ligger Akershus festning." }],
  }),
  script({
    id: "scr_nb_2",
    chapter_no: 2,
    title: "Christian IV bygger om",
    script_text: "På 1600-tallet …",
    estimated_duration_s: 60,
  }),
  script({
    id: "scr_nb_ad",
    kind: "audio_description",
    script_text: "Grå steinmurer på en høyde mot fjorden.",
    audio_id: "aud_2",
    audio_key: "https://cdn.example/ad.m4a",
    audio_format: "m4a",
    audio_duration_s: 140,
  }),
  script({
    id: "scr_en_1",
    lang: "en",
    script_text: "In front of you lies Akershus Fortress.",
    editorial_status: "auto",
    estimated_duration_s: 90,
  }),
];

const S3_AUDIO_KEY = "products/senseaid-explore/areas/kvadraturen/pois/akershus-festning/audio/narration-1-nb-v1.mp3";

describe("lyd i CreatorHub S3", () => {
  it("gir appen en API-URL for S3-nøkler og lar eldre nøkler gå mot mediebasen", () => {
    expect(mediaUrl(S3_AUDIO_KEY, MEDIA, "https://api.test/")).toBe(`https://api.test/api/guide/media/${S3_AUDIO_KEY}`);
    expect(mediaUrl("reiseguide/akershus/nb/narration-1.m4a", MEDIA, "https://api.test")).toBe(
      `${MEDIA}/reiseguide/akershus/nb/narration-1.m4a`,
    );
    expect(mediaUrl("https://cdn.example/ad.m4a", MEDIA, "https://api.test")).toBe("https://cdn.example/ad.m4a");
    expect(mediaUrl(S3_AUDIO_KEY, MEDIA)).toBe(`${MEDIA}/${S3_AUDIO_KEY}`);
  });

  it("requestApiBase bruker X-Forwarded-Proto og host", () => {
    const req = { protocol: "http", get: (h: string) => ({ "x-forwarded-proto": "https", host: "creatorhub.test" })[h.toLowerCase()] };
    expect(requestApiBase(req as never)).toBe("https://creatorhub.test");
    const plain = { protocol: "http", get: (h: string) => ({ host: "localhost:3000" })[h.toLowerCase()] };
    expect(requestApiBase(plain as never)).toBe("http://localhost:3000");
  });

  it("omdirigerer /api/guide/media/{key} til en signert, kortlevd URL", async () => {
    const res = await request(makeApp(makePool([]))).get(`/api/guide/media/${S3_AUDIO_KEY}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`https://s3.test/signed?sig=1&key=${encodeURIComponent(S3_AUDIO_KEY)}`);
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("avviser nøkler utenfor SenseAid-hierarkiet uten å presignere", async () => {
    const app = makeApp(makePool([]));
    for (const key of ["organizations/x/users/y/file.mp3", "products/senseaid-explore/../secret", "platform/releases/x"]) {
      const res = await request(app).get(`/api/guide/media/${key}`);
      expect(res.status).toBe(404);
    }
  });

  it("svarer 503 når S3 ikke er konfigurert", async () => {
    const res = await request(makeApp(makePool([]), null)).get(`/api/guide/media/${S3_AUDIO_KEY}`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "media_storage_unavailable" });
  });
});

describe("språkvalg", () => {
  it("parseLang normaliserer og avviser søppel", () => {
    expect(parseLang("NB")).toBe("nb");
    expect(parseLang(" en-GB ")).toBe("en-gb");
    expect(parseLang("")).toBeNull();
    expect(parseLang("no way")).toBeNull();
    expect(parseLang(["nb"])).toBeNull();
    expect(parseLang(undefined)).toBeNull();
  });

  it("resolveLang går ønsket → primærtag → en → default", () => {
    expect(resolveLang(["nb", "en"], "nb", "nb")).toBe("nb");
    expect(resolveLang(["nb", "en"], "nb-no", "nb")).toBe("nb");
    expect(resolveLang(["nb", "en"], "de", "nb")).toBe("en");
    expect(resolveLang(["nb"], "de", "nb")).toBe("nb");
    expect(resolveLang([], "de", "nb")).toBeNull();
  });

  it("mediaUrl bygger absolutt URL og lar http(s)-nøkler være", () => {
    expect(mediaUrl("a/b.m4a", "https://x.test/")).toBe("https://x.test/a/b.m4a");
    expect(mediaUrl("/a/b.m4a", "https://x.test")).toBe("https://x.test/a/b.m4a");
    expect(mediaUrl("https://cdn.example/f.m4a", "https://x.test")).toBe("https://cdn.example/f.m4a");
    expect(mediaUrl(null, "https://x.test")).toBeNull();
  });
});

describe("buildPoiView", () => {
  it("flater ut severdighet med kapitler, lyd, teksting og varighet", () => {
    const view = buildPoiView({
      poi: poiRows[0],
      translations: translationRows,
      scripts: scriptRows,
      requestedLang: "nb",
      defaultLang: "nb",
      mediaBase: MEDIA,
    });
    expect(view.title).toBe("Akershus festning");
    expect(view.heroImageUrl).toBe(`${MEDIA}/reiseguide/akershus/hero.jpg`);
    expect(view.heroImageAlt).toBe("Akershus festning sett fra sør i dagslys");
    expect(view.practicalInfo).toEqual([{ label: "Adkomst", value: "Trinnfri fra Rådhusplassen" }]);
    expect(view.lang).toEqual({
      requested: "nb",
      resolved: "nb",
      fallbackUsed: false,
      autoTranslated: false,
      editorialStatus: "approved",
      available: ["en", "nb"],
    });

    const narration = view.variants.narration!;
    expect(narration.chapters.map((c) => c.no)).toEqual([1, 2]);
    expect(narration.chapters[0].audio).toEqual({
      url: `${MEDIA}/reiseguide/akershus/nb/narration-1.m4a`,
      format: "m4a",
      durationS: 92.4,
    });
    expect(narration.chapters[0].captions).toEqual({
      url: `${MEDIA}/reiseguide/akershus/nb/narration-1.vtt`,
      cues: [{ startS: 0, endS: 3.2, text: "Foran deg ligger Akershus festning." }],
    });
    expect(narration.chapters[0].imageUrl).toBe(`${MEDIA}/reiseguide/akershus/kap1.jpg`);
    expect(narration.chapters[1].audio).toBeNull();
    expect(narration.hasAudio).toBe(false);
    expect(narration.hasCaptions).toBe(false);
    expect(narration.durationS).toBe(152);

    const ad = view.variants.audioDescription!;
    expect(ad.kind).toBe("audio_description");
    expect(ad.hasAudio).toBe(true);
    expect(ad.chapters[0].audio?.url).toBe("https://cdn.example/ad.m4a");
    expect(ad.durationS).toBe(140);
  });

  it("faller til engelsk når ønsket språk mangler og merker maskinoversettelse", () => {
    const view = buildPoiView({
      poi: poiRows[0],
      translations: translationRows,
      scripts: scriptRows,
      requestedLang: "de",
      defaultLang: "nb",
      mediaBase: MEDIA,
    });
    expect(view.title).toBe("Akershus Fortress");
    expect(view.lang.resolved).toBe("en");
    expect(view.lang.fallbackUsed).toBe(true);
    expect(view.lang.autoTranslated).toBe(true);
    expect(view.variants.narration?.lang).toBe("en");
    expect(view.variants.narration?.autoTranslated).toBe(true);
    // Synstolking finnes ikke på engelsk og faller aldri til et annet språk.
    expect(view.variants.audioDescription).toBeNull();
  });

  it("tåler POI uten manus og med tom praktisk info", () => {
    const view = buildPoiView({
      poi: poiRows[1],
      translations: translationRows,
      scripts: scriptRows,
      requestedLang: "nb",
      defaultLang: "nb",
      mediaBase: MEDIA,
    });
    expect(view.title).toBe("Operaen");
    expect(view.heroImageUrl).toBeNull();
    expect(view.practicalInfo).toEqual([]);
    expect(view.variants).toEqual({ narration: null, audioDescription: null });
  });
});

describe("GET /api/guide/areas", () => {
  it("lister publiserte områder med språk og antall POI", async () => {
    const pool = makePool([{ match: /FROM guide_areas a WHERE a\.status = 'published'/, rows: [areaRow] }]);
    const res = await request(makeApp(pool)).get("/api/guide/areas");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
    expect(res.body.areas).toHaveLength(1);
    expect(res.body.areas[0]).toMatchObject({
      id: "area_oslo",
      slug: "kvadraturen-festningen-operaen",
      defaultLang: "nb",
      center: { lat: 59.909, lng: 10.742 },
      bbox: { south: 59.903, west: 10.728, north: 59.915, east: 10.76 },
      priceNok: 59,
      languages: ["en", "nb"],
      poiCount: 2,
    });
  });
});

describe("GET /api/guide/areas/:idOrSlug", () => {
  const handlers: Handler[] = [
    {
      match: /FROM guide_areas a WHERE \(a\.id = \$1 OR a\.slug = \$1\)/,
      rows: (p) => (p[0] === "area_oslo" || p[0] === areaRow.slug ? [areaRow] : []),
    },
    {
      match: /FROM guide_categories/,
      rows: [
        { id: "museum", labels: { nb: "Museum", en: "Museum" }, sort_order: 1 },
        { id: "historisk", labels: { nb: "Historiske", en: "Historic" }, sort_order: 2 },
        { id: "arkitektur", labels: { nb: "Arkitektur", en: "Architecture" }, sort_order: 4 },
      ],
    },
    { match: /FROM guide_pois WHERE area_id = \$1/, rows: (p) => (p[0] === "area_oslo" ? poiRows : []) },
    { match: /FROM guide_poi_translations/, rows: translationRows },
    { match: /FROM guide_poi_scripts s/, rows: scriptRows },
  ];

  it("svarer 404 for ukjent område og 400 for ugyldig lang", async () => {
    const app = makeApp(makePool(handlers));
    expect((await request(app).get("/api/guide/areas/finnes-ikke")).status).toBe(404);
    expect((await request(app).get("/api/guide/areas/area_oslo?lang=no%20way")).status).toBe(400);
    expect((await request(app).get("/api/guide/areas/finnes%20ikke")).status).toBe(400);
  });

  it("returnerer område, brukte kategorier og POI-er på ønsket språk (slug-oppslag)", async () => {
    const pool = makePool(handlers);
    const res = await request(makeApp(pool)).get(`/api/guide/areas/${areaRow.slug}?lang=EN`);
    expect(res.status).toBe(200);
    expect(res.body.requestedLang).toBe("en");
    expect(res.body.area.id).toBe("area_oslo");
    expect(res.body.categories.map((c: { id: string; label: string }) => [c.id, c.label])).toEqual([
      ["historisk", "Historic"],
      ["arkitektur", "Architecture"],
    ]);
    expect(res.body.pois.map((p: { slug: string }) => p.slug)).toEqual(["akershus-festning", "operaen"]);
    expect(res.body.pois[0].title).toBe("Akershus Fortress");
    expect(res.body.pois[0].freePreview).toBe(true);
    // Operaen finnes bare på nb: faller til områdets standardspråk.
    expect(res.body.pois[1].title).toBe("Operaen");
    expect(res.body.pois[1].lang).toMatchObject({ requested: "en", resolved: "nb", fallbackUsed: true });

    const translationCall = pool.query.mock.calls.find(([sql]) => /FROM guide_poi_translations\s+WHERE poi_id = ANY/.test(sql));
    expect(translationCall?.[1]).toEqual([["poi_akershus", "poi_opera"]]);
  });

  it("bruker områdets standardspråk når lang mangler", async () => {
    const res = await request(makeApp(makePool(handlers))).get("/api/guide/areas/area_oslo");
    expect(res.status).toBe(200);
    expect(res.body.requestedLang).toBe("nb");
    expect(res.body.pois[0].title).toBe("Akershus festning");
  });

  it("svarer 500 uten å lekke feilen når databasen feiler", async () => {
    const pool = { query: vi.fn(async () => { throw new Error("db nede"); }) } as unknown as Pick<Pool, "query">;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await request(makeApp(pool)).get("/api/guide/areas/area_oslo");
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "internal_error" });
  });
});

describe("GET /api/guide/pois/:idOrSlug", () => {
  const handlers: Handler[] = [
    {
      match: /FROM guide_pois p\s+JOIN guide_areas a/,
      rows: (p) => (p[0] === "akershus-festning" ? [{ ...poiRows[0], default_lang: "nb" }] : []),
    },
    { match: /FROM guide_poi_translations/, rows: translationRows },
    { match: /FROM guide_poi_scripts s/, rows: scriptRows },
  ];

  it("returnerer én severdighet på ønsket språk", async () => {
    const res = await request(makeApp(makePool(handlers))).get("/api/guide/pois/akershus-festning?lang=nb");
    expect(res.status).toBe(200);
    expect(res.body.poi.slug).toBe("akershus-festning");
    expect(res.body.poi.variants.narration.chapters).toHaveLength(2);
    expect(res.body.poi.variants.audioDescription.hasAudio).toBe(true);
  });

  it("svarer 404 for ukjent severdighet", async () => {
    const res = await request(makeApp(makePool(handlers))).get("/api/guide/pois/ukjent");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "poi_not_found" });
  });
});

describe("etter besøket: quiz, vurdering og deling", () => {
  const quizRows = [
    { id: "q_ak_nb_1", poi_id: "poi_akershus", lang: "nb", sort_order: 1, question: "Hvor mange beleiringer?", options: ["Tre", "Ni"], correct_index: 1, explanation: "Ni." },
    { id: "q_ak_nb_2", poi_id: "poi_akershus", lang: "nb", sort_order: 2, question: "Hvem bygde om?", options: ["Håkon", "Christian"], correct_index: 1, explanation: null },
    { id: "q_ak_en_1", poi_id: "poi_akershus", lang: "en", sort_order: 1, question: "How many sieges?", options: ["Three", "Nine"], correct_index: 1, explanation: "Nine." },
  ];
  const ratingRows = [{ poi_id: "poi_akershus", average: 4.6667, count: 3 }];
  const inserted: unknown[][] = [];
  const handlers: Handler[] = [
    {
      match: /FROM guide_areas a WHERE \(a\.id = \$1 OR a\.slug = \$1\)/,
      rows: (p) => (p[0] === "area_oslo" ? [areaRow] : []),
    },
    { match: /FROM guide_categories/, rows: [] },
    { match: /FROM guide_pois WHERE area_id = \$1/, rows: poiRows },
    {
      match: /FROM guide_pois p\s+JOIN guide_areas a/,
      rows: (p) => {
        const hit = poiRows.find((r) => r.id === p[0] || r.slug === p[0]);
        return hit ? [{ ...hit, default_lang: "nb" }] : [];
      },
    },
    { match: /FROM guide_poi_translations/, rows: translationRows },
    { match: /FROM guide_poi_scripts s/, rows: scriptRows },
    { match: /FROM guide_poi_quiz_questions/, rows: quizRows },
    { match: /FROM guide_poi_ratings/, rows: ratingRows },
    {
      match: /INSERT INTO guide_poi_ratings/,
      rows: (p) => {
        inserted.push(p);
        return [];
      },
    },
  ];

  it("legger quiz, vurdering og delingslenke på hver severdighet i området", async () => {
    const res = await request(makeApp(makePool(handlers))).get("/api/guide/areas/area_oslo?lang=en");
    expect(res.status).toBe(200);
    const [akershus, opera] = res.body.pois;
    // Engelsk manus finnes: quizen følger manusspråket.
    expect(akershus.quiz).toEqual([
      { id: "q_ak_en_1", no: 1, question: "How many sieges?", options: ["Three", "Nine"], correctIndex: 1, explanation: "Nine." },
    ]);
    expect(akershus.rating).toEqual({ average: 4.7, count: 3 });
    expect(akershus.shareUrl).toBe("https://api.test/api/guide/share/akershus-festning?lang=en");
    expect(opera.quiz).toEqual([]);
    expect(opera.rating).toBeNull();
    expect(opera.shareUrl).toBe("https://api.test/api/guide/share/operaen?lang=nb");

    const nb = await request(makeApp(makePool(handlers))).get("/api/guide/pois/akershus-festning?lang=nb");
    expect(nb.body.poi.quiz.map((q: { no: number }) => q.no)).toEqual([1, 2]);
  });

  it("POST rating validerer, lagrer med upsert og svarer med nytt snitt", async () => {
    inserted.length = 0;
    const app = makeApp(makePool(handlers));
    const bad = await request(app).post("/api/guide/pois/akershus-festning/rating").send({ deviceId: "x", stars: 5 });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("invalid_device_id");

    const missing = await request(app).post("/api/guide/pois/ukjent/rating").send({ deviceId: "device-1234", stars: 5 });
    expect(missing.status).toBe(404);

    const ok = await request(app)
      .post("/api/guide/pois/akershus-festning/rating")
      .send({ deviceId: "device-1234", stars: 5, lang: "nb", comment: " Flott " });
    expect(ok.status).toBe(200);
    expect(ok.headers["cache-control"]).toBe("private, no-store");
    expect(ok.body).toEqual({ poiId: "poi_akershus", yourStars: 5, rating: { average: 4.7, count: 3 } });
    expect(inserted).toHaveLength(1);
    expect(inserted[0].slice(1)).toEqual(["poi_akershus", "device-1234", 5, "nb", "Flott"]);
    expect(String(inserted[0][0])).toMatch(/^rat_/);
  });

  it("POST rating stopper løkker med 429 etter 30 forsøk per IP i minuttet", async () => {
    const app = makeApp(makePool(handlers));
    let last = 0;
    for (let i = 0; i < 31; i += 1) {
      last = (await request(app).post("/api/guide/pois/akershus-festning/rating").send({ deviceId: "device-1234", stars: 3 })).status;
    }
    expect(last).toBe(429);
  });

  it("GET share gir HTML med Open Graph og app-lenke, 404 for ukjent sted", async () => {
    const app = makeApp(makePool(handlers));
    const res = await request(app).get("/api/guide/share/akershus-festning?lang=en");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain('<meta property="og:title" content="Akershus Fortress">');
    expect(res.text).toContain('<meta property="og:image" content="https://media.test/reiseguide/akershus/hero.jpg">');
    expect(res.text).toContain('href="senseaidexplore://poi/akershus-festning?lang=en"');
    expect(res.text).toContain('content="https://api.test/api/guide/share/akershus-festning?lang=en"');
    expect((await request(app).get("/api/guide/share/ukjent")).status).toBe(404);
  });
});

describe("spørsmål underveis (0662)", () => {
  const promptRows = [
    {
      id: "pr_nb_1_2", poi_id: "poi_akershus", lang: "nb", chapter_no: 1, kind: "look", at_fraction: "0.8100",
      prompt_text: "Se opp: tårnene.", options: null, answer_index: null, reveal_text: null, sort_order: 2,
    },
    {
      id: "pr_nb_1_1", poi_id: "poi_akershus", lang: "nb", chapter_no: 1, kind: "guess", at_fraction: "0.2600",
      prompt_text: "Hva gjorde Christen Munk?", options: ["Stengte portene", "Brant byen"], answer_index: 1,
      reveal_text: "Han brant byen.", sort_order: 1,
    },
    {
      id: "pr_en_1_1", poi_id: "poi_akershus", lang: "en", chapter_no: 1, kind: "look", at_fraction: "0.5",
      prompt_text: "Look up: the towers.", options: null, answer_index: null, reveal_text: null, sort_order: 1,
    },
    {
      id: "pr_de_1_1", poi_id: "poi_akershus", lang: "de", chapter_no: 1, kind: "look", at_fraction: "0.5",
      prompt_text: "Schau nach oben.", options: null, answer_index: null, reveal_text: null, sort_order: 1,
    },
    {
      id: "pr_bad", poi_id: "poi_akershus", lang: "nb", chapter_no: 2, kind: "guess", at_fraction: "0.5",
      prompt_text: "Ugyldig", options: ["Bare ett"], answer_index: 0, reveal_text: null, sort_order: 1,
    },
  ];

  it("buildPoiView legger innslagene på fortellingskapitlene i samme språk som fortellingen", () => {
    const view = buildPoiView({
      poi: poiRows[0],
      translations: translationRows,
      scripts: scriptRows,
      prompts: promptRows,
      requestedLang: "nb",
      defaultLang: "nb",
      mediaBase: MEDIA,
    });
    const [kap1, kap2] = view.variants.narration!.chapters;
    expect(kap1.prompts).toEqual([
      {
        id: "pr_nb_1_1", kind: "guess", atFraction: 0.26, text: "Hva gjorde Christen Munk?",
        options: ["Stengte portene", "Brant byen"], answerIndex: 1, revealText: "Han brant byen.",
      },
      { id: "pr_nb_1_2", kind: "look", atFraction: 0.81, text: "Se opp: tårnene.", options: null, answerIndex: null, revealText: null },
    ]);
    // Ugyldig guess (ett alternativ) hoppes over; kapittelet får tom liste.
    expect(kap2.prompts).toEqual([]);
    // Synstolking får aldri innslag.
    expect(view.variants.audioDescription!.chapters[0].prompts).toEqual([]);
  });

  it("følger fortellingens språkfallback og blander aldri språk", () => {
    const view = buildPoiView({
      poi: poiRows[0],
      translations: translationRows,
      scripts: scriptRows,
      prompts: promptRows,
      requestedLang: "de",
      defaultLang: "nb",
      mediaBase: MEDIA,
    });
    // Ingen tysk fortelling: fortellingen faller til engelsk, og innslagene følger
    // den. Den tyske raden brukes ikke, fordi den ikke hører til noen fortelling.
    expect(view.variants.narration?.lang).toBe("en");
    expect(view.variants.narration!.chapters[0].prompts.map((p) => p.id)).toEqual(["pr_en_1_1"]);
  });

  it("uten innslag i databasen får hvert kapittel en tom liste", () => {
    const view = buildPoiView({
      poi: poiRows[0],
      translations: translationRows,
      scripts: scriptRows,
      requestedLang: "nb",
      defaultLang: "nb",
      mediaBase: MEDIA,
    });
    for (const chapter of view.variants.narration!.chapters) expect(chapter.prompts).toEqual([]);
  });

  const handlers: Handler[] = [
    {
      match: /FROM guide_areas a WHERE \(a\.id = \$1 OR a\.slug = \$1\)/,
      rows: (p) => (p[0] === "area_oslo" ? [areaRow] : []),
    },
    { match: /FROM guide_categories/, rows: [] },
    { match: /FROM guide_pois WHERE area_id = \$1/, rows: poiRows },
    {
      match: /FROM guide_pois p\s+JOIN guide_areas a/,
      rows: (p) => (p[0] === "akershus-festning" ? [{ ...poiRows[0], default_lang: "nb" }] : []),
    },
    { match: /FROM guide_poi_translations/, rows: translationRows },
    { match: /FROM guide_poi_scripts s/, rows: scriptRows },
    { match: /FROM guide_poi_chapter_prompts/, rows: promptRows },
  ];

  it("GET område gir prompts på hvert fortellingskapittel og henter dem for alle POI-ene", async () => {
    const pool = makePool(handlers);
    const res = await request(makeApp(pool)).get("/api/guide/areas/area_oslo?lang=nb");
    expect(res.status).toBe(200);
    const [akershus, opera] = res.body.pois;
    expect(akershus.variants.narration.chapters[0].prompts.map((p: { id: string }) => p.id)).toEqual([
      "pr_nb_1_1",
      "pr_nb_1_2",
    ]);
    expect(akershus.variants.narration.chapters[0].prompts[0]).toMatchObject({ kind: "guess", atFraction: 0.26, answerIndex: 1 });
    expect(akershus.variants.audioDescription.chapters[0].prompts).toEqual([]);
    expect(opera.variants.narration).toBeNull();

    const promptCall = pool.query.mock.calls.find(([sql]) => /FROM guide_poi_chapter_prompts/.test(sql));
    expect(promptCall?.[1]).toEqual([["poi_akershus", "poi_opera"]]);
  });

  it("svarer med tomme prompts når tabellen mangler (0662 ikke kjørt), men 500 på andre feil", async () => {
    const failWith = (code: string) => {
      const pool = makePool(handlers);
      const inner = pool.query.getMockImplementation()!;
      pool.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
        if (/FROM guide_poi_chapter_prompts/.test(sql)) throw Object.assign(new Error("feil"), { code });
        return inner(sql, params);
      });
      return pool;
    };
    const missing = await request(makeApp(failWith("42P01"))).get("/api/guide/pois/akershus-festning?lang=nb");
    expect(missing.status).toBe(200);
    expect(missing.body.poi.variants.narration.chapters[0].prompts).toEqual([]);

    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = await request(makeApp(failWith("57P01"))).get("/api/guide/pois/akershus-festning?lang=nb");
    spy.mockRestore();
    expect(broken.status).toBe(500);
  });

  it("GET severdighet gir samme prompts på engelsk", async () => {
    const res = await request(makeApp(makePool(handlers))).get("/api/guide/pois/akershus-festning?lang=en");
    expect(res.status).toBe(200);
    expect(res.body.poi.variants.narration.lang).toBe("en");
    expect(res.body.poi.variants.narration.chapters[0].prompts).toEqual([
      { id: "pr_en_1_1", kind: "look", atFraction: 0.5, text: "Look up: the towers.", options: null, answerIndex: null, revealText: null },
    ]);
  });
});
