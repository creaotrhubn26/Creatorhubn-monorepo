/**
 * Commons-heltebilder: lisensfilter, HTML-vask, utvalg og API-klient mot
 * mockede svar (ingen nettverk).
 */
import { describe, expect, it, vi } from "vitest";

import {
  COMMONS_USER_AGENT,
  commonsQueryUrl,
  isAllowedLicense,
  isUnwantedTitle,
  pickBest,
  rejectReason,
  resolveHeroImage,
  titleMatchesSource,
  stripHtml,
  toCandidate,
  type CommonsCandidate,
  type CommonsPage,
  type FetchLike,
} from "./reiseguide-commons-images.js";
import { DEMO_AREAS, DEMO_HERO_IMAGES, DEMO_POIS } from "./reiseguide-demo-data.js";

const page = (title: string, over: {
  width?: number;
  height?: number;
  mime?: string;
  artist?: string | null;
  license?: string | null;
  licenseUrl?: string | null;
} = {}): CommonsPage => {
  const slug = encodeURIComponent(title.replace(/^File:/, "").replace(/ /g, "_"));
  const extmetadata: Record<string, { value: string }> = {};
  const artist = over.artist === undefined ? '<a href="//commons.wikimedia.org/wiki/User:Ola" title="User:Ola">Ola Nordmann</a>' : over.artist;
  const license = over.license === undefined ? "CC BY-SA 4.0" : over.license;
  const licenseUrl = over.licenseUrl === undefined ? "https://creativecommons.org/licenses/by-sa/4.0" : over.licenseUrl;
  if (artist !== null) extmetadata.Artist = { value: artist };
  if (license !== null) extmetadata.LicenseShortName = { value: license };
  if (licenseUrl !== null) extmetadata.LicenseUrl = { value: licenseUrl };
  return {
    title,
    imageinfo: [
      {
        url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${slug}`,
        thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${slug}/1600px-${slug}`,
        descriptionurl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
        width: over.width ?? 4000,
        height: over.height ?? 3000,
        mime: over.mime ?? "image/jpeg",
        extmetadata,
      },
    ],
  };
};

const candidate = (title: string, over: Parameters<typeof page>[1] = {}): CommonsCandidate =>
  toCandidate(page(title, over))!;

/** Mock-fetch: svar per generator/titles, og logg over URL-ene som ble spurt. */
function mockFetch(routes: { match: (u: URL) => boolean; pages?: CommonsPage[]; status?: number }[]) {
  const calls: { url: URL; headers: Record<string, string> }[] = [];
  const impl = vi.fn<FetchLike>(async (url, init) => {
    const parsed = new URL(url);
    calls.push({ url: parsed, headers: init.headers });
    const route = routes.find((r) => r.match(parsed));
    const status = route?.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({ batchcomplete: true, query: { pages: route?.pages ?? [] } }),
    };
  });
  return { impl, calls };
}

describe("stripHtml", () => {
  it("fjerner lenker, bdi og entiteter fra Artist", () => {
    expect(stripHtml('<bdi><a href="//commons.wikimedia.org/wiki/User:Kari" title="User:Kari">Kari &amp; Per</a></bdi>')).toBe("Kari & Per");
    expect(stripHtml("Photo:<br/>  Jan&#39;s  &#x00E6;ble&nbsp;foto ")).toBe("Photo: Jan's æble foto");
    expect(stripHtml('<span class="fn">&lt;ukjent&gt;</span>')).toBe("<ukjent>");
    expect(stripHtml(undefined)).toBe("");
    expect(stripHtml("&bogus; &#0;")).toBe("&bogus; &#0;");
  });
});

describe("isAllowedLicense", () => {
  it.each([
    ["CC0", null],
    ["CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/deed.en"],
    ["Public domain", null],
    ["CC BY 2.0", "https://creativecommons.org/licenses/by/2.0"],
    ["CC BY 2.5", null],
    ["CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0"],
    ["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0"],
    ["CC BY-SA 3.0 de", "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en"],
  ])("godtar %s", (name, url) => {
    expect(isAllowedLicense(name, url)).toBe(true);
  });

  it.each([
    ["CC BY-NC 2.0", "https://creativecommons.org/licenses/by-nc/2.0"],
    ["CC BY-NC-SA 4.0", null],
    ["CC BY-ND 4.0", null],
    ["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-nc-sa/4.0"],
    ["CC BY 1.0", null],
    ["CC BY-SA 1.0", null],
    ["GFDL", "https://www.gnu.org/copyleft/fdl.html"],
    ["FAL", null],
    ["Attribution", null],
    ["", null],
    [null, null],
    ["CC BY 4.0", "https://example.com/some-other-licence"],
  ])("avviser %s (%s)", (name, url) => {
    expect(isAllowedLicense(name, url)).toBe(false);
  });
});

describe("isUnwantedTitle", () => {
  it("hopper over kart, planer, logoer, tegninger, frimerker og trykk", () => {
    for (const title of [
      "File:Kart over Christiania 1648.jpg",
      "File:Akershus festning plan.jpg",
      "File:Oslo Børs logo.jpg",
      "File:Drawing of the Old Town Hall.jpg",
      "File:Norway stamp 1950 Oslo.jpg",
      "File:Akershus slott, kobberstikk.jpg",
      "File:Christiania lithograph 1840.jpg",
      "File:Oslo_Opera_House_floor_plan.jpg",
      "File:Map of Kvadraturen.jpg",
    ]) {
      expect(isUnwantedTitle(title), title).toBe(true);
    }
  });

  it("lar vanlige foto passere, også når ordene står inni andre ord", () => {
    for (const title of [
      "File:Akershus festning 2019.jpg",
      "File:Oslo Opera House seen from Bjørvika.jpg",
      "File:Planetarium-like dome.jpg",
      "File:Karl Johans gate.jpg",
      "File:Printemps.jpg",
    ]) {
      expect(isUnwantedTitle(title), title).toBe(false);
    }
  });
});

describe("toCandidate og rejectReason", () => {
  it("leser miniatyr, filside, opphav uten HTML og lisens", () => {
    const c = candidate("File:Akershus festning 2019.jpg");
    expect(c).toEqual({
      title: "File:Akershus festning 2019.jpg",
      width: 4000,
      height: 3000,
      mime: "image/jpeg",
      thumbUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Akershus_festning_2019.jpg/1600px-Akershus_festning_2019.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AAkershus_festning_2019.jpg",
      author: "Ola Nordmann",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    });
    expect(rejectReason(c)).toBeNull();
  });

  it("gjør protokollrelative URL-er om til https og tåler sider uten imageinfo", () => {
    const p = page("File:A.jpg");
    p.imageinfo![0].thumburl = "//upload.wikimedia.org/thumb/A.jpg";
    expect(toCandidate(p)?.thumbUrl).toBe("https://upload.wikimedia.org/thumb/A.jpg");
    expect(toCandidate({ title: "File:B.jpg" })).toBeNull();
    expect(toCandidate({ title: "File:C.jpg", missing: true, imageinfo: [] })).toBeNull();
  });

  it("gir grunn for hver avvisning", () => {
    expect(rejectReason(candidate("File:A.png", { mime: "image/png" }))).toBe("not_jpeg");
    expect(rejectReason(candidate("File:A.jpg", { width: 1599, height: 1000 }))).toBe("too_small");
    expect(rejectReason(candidate("File:A.jpg", { width: 3000, height: 4000 }))).toBe("not_landscape");
    expect(rejectReason(candidate("File:A.jpg", { width: 3000, height: 3000 }))).toBe("not_landscape");
    expect(rejectReason(candidate("File:A.jpg", { width: 9000, height: 2000 }))).toBe("panorama");
    expect(rejectReason(candidate("File:A.jpg", { license: "CC BY-NC-SA 2.0", licenseUrl: null }))).toBe("license_not_allowed");
    expect(rejectReason(candidate("File:A.jpg", { license: null }))).toBe("license_not_allowed");
    expect(rejectReason(candidate("File:A.jpg", { artist: null }))).toBe("no_author");
    expect(rejectReason(candidate("File:A.jpg", { artist: "<span> </span>" }))).toBe("no_author");
    expect(rejectReason(candidate("File:Oslo map.jpg"))).toBe("unwanted_title");
  });

  it("fastspikret fil slipper myke krav, men aldri lisens, JPEG eller opphav", () => {
    const portrait = candidate("File:Operaen plan.jpg", { width: 1200, height: 1800 });
    expect(rejectReason(portrait)).not.toBeNull();
    expect(rejectReason(portrait, { pinned: true })).toBeNull();
    expect(rejectReason(candidate("File:A.jpg", { license: "CC BY-ND 4.0", licenseUrl: null }), { pinned: true })).toBe(
      "license_not_allowed",
    );
    expect(rejectReason(candidate("File:A.jpg", { artist: null }), { pinned: true })).toBe("no_author");
  });
});

describe("pickBest", () => {
  it("velger høyest oppløsning, deretter tittel, og hopper over avviste", () => {
    const chosen = pickBest([
      candidate("File:B.jpg", { width: 4000, height: 3000 }),
      candidate("File:A.jpg", { width: 4000, height: 3000 }),
      candidate("File:Huge but NC.jpg", { width: 8000, height: 6000, license: "CC BY-NC 4.0", licenseUrl: null }),
      candidate("File:Small.jpg", { width: 2000, height: 1500 }),
    ]);
    expect(chosen?.title).toBe("File:A.jpg");
  });

  it("er uavhengig av rekkefølgen og gir null når ingen består", () => {
    const list = [
      candidate("File:C.jpg", { width: 3000, height: 2000 }),
      candidate("File:D.jpg", { width: 5000, height: 3000 }),
      candidate("File:E.jpg", { width: 5000, height: 3000 }),
    ];
    expect(pickBest(list)?.title).toBe("File:D.jpg");
    expect(pickBest([...list].reverse())?.title).toBe("File:D.jpg");
    expect(pickBest([candidate("File:X.png", { mime: "image/png" })])).toBeNull();
    expect(pickBest([])).toBeNull();
  });
});

describe("commonsQueryUrl", () => {
  it("ber om imageinfo med 1600 px-miniatyr og lisensfelt", () => {
    const url = new URL(commonsQueryUrl({ kind: "category", name: "Akershus Fortress" }));
    expect(url.origin + url.pathname).toBe("https://commons.wikimedia.org/w/api.php");
    expect(url.searchParams.get("prop")).toBe("imageinfo");
    expect(url.searchParams.get("iiprop")).toBe("url|size|mime|extmetadata");
    expect(url.searchParams.get("iiurlwidth")).toBe("1600");
    expect(url.searchParams.get("generator")).toBe("categorymembers");
    expect(url.searchParams.get("gcmtitle")).toBe("Category:Akershus Fortress");
    expect(url.searchParams.get("gcmtype")).toBe("file");

    const search = new URL(commonsQueryUrl({ kind: "search", term: 'intitle:"Oslo Børs"' }));
    expect(search.searchParams.get("generator")).toBe("search");
    expect(search.searchParams.get("gsrsearch")).toBe('intitle:"Oslo Børs"');
    expect(search.searchParams.get("gsrnamespace")).toBe("6");

    const file = new URL(commonsQueryUrl({ kind: "file", title: "Operaen.jpg" }));
    expect(file.searchParams.get("titles")).toBe("File:Operaen.jpg");
    expect(file.searchParams.get("generator")).toBeNull();
  });
});

describe("resolveHeroImage", () => {
  const isCategory = (name: string) => (u: URL) => u.searchParams.get("gcmtitle") === `Category:${name}`;
  const isSearch = (u: URL) => u.searchParams.get("generator") === "search";
  const isFile = (title: string) => (u: URL) => u.searchParams.get("titles") === title;

  it("bruker kategoriene før søket og sender User-Agent", async () => {
    const { impl, calls } = mockFetch([
      { match: isCategory("Akershus Fortress"), pages: [page("File:Akershus 1.jpg", { width: 3000, height: 2000 })] },
      { match: isCategory("Akershus Castle"), pages: [page("File:Akershus 2.jpg", { width: 5000, height: 3000 })] },
      { match: isSearch, pages: [page("File:Search hit.jpg", { width: 9000, height: 6000 })] },
    ]);
    const result = await resolveHeroImage(
      { pinnedFile: null, categories: ["Akershus Fortress", "Akershus Castle"], searchTerms: ["Akershus"] },
      impl,
    );
    expect(result.chosen?.title).toBe("File:Akershus 2.jpg");
    expect(result.via).toBe("category");
    expect(result.considered).toBe(2);
    expect(calls).toHaveLength(2);
    expect(calls[0].headers["User-Agent"]).toBe(COMMONS_USER_AGENT);
  });

  it("faller til søk når kategoriene ikke gir noe godkjent", async () => {
    const { impl } = mockFetch([
      { match: isCategory("Bankplassen"), pages: [page("File:Bankplassen.jpg", { license: "CC BY-NC 2.0", licenseUrl: null })] },
      { match: isSearch, pages: [page("File:Bankplassen 2020.jpg")] },
    ]);
    const result = await resolveHeroImage({ pinnedFile: null, categories: ["Bankplassen"], searchTerms: ["intitle:Bankplassen"] }, impl);
    expect(result.chosen?.title).toBe("File:Bankplassen 2020.jpg");
    expect(result.via).toBe("search");
  });

  it("fastspikret fil vinner når den er godkjent", async () => {
    const { impl, calls } = mockFetch([
      { match: isFile("File:Operaen valgt.jpg"), pages: [page("File:Operaen valgt.jpg", { width: 2000, height: 2500 })] },
      { match: isCategory("Oslo Opera House"), pages: [page("File:Større.jpg", { width: 8000, height: 5000 })] },
    ]);
    const result = await resolveHeroImage(
      { pinnedFile: "File:Operaen valgt.jpg", categories: ["Oslo Opera House"], searchTerms: [] },
      impl,
    );
    expect(result.chosen?.title).toBe("File:Operaen valgt.jpg");
    expect(result.via).toBe("pinned");
    expect(calls).toHaveLength(1);
  });

  it("forkaster fastspikret fil med feil lisens og velger automatisk", async () => {
    const { impl } = mockFetch([
      { match: isFile("File:Feil.jpg"), pages: [page("File:Feil.jpg", { license: "CC BY-ND 2.0", licenseUrl: null })] },
      { match: isCategory("Oslo Opera House"), pages: [page("File:Operaen.jpg")] },
    ]);
    const result = await resolveHeroImage({ pinnedFile: "File:Feil.jpg", categories: ["Oslo Opera House"], searchTerms: [] }, impl);
    expect(result.chosen?.title).toBe("File:Operaen.jpg");
    expect(result.warnings.join(" ")).toContain("license_not_allowed");
  });

  it("forkaster nabobygg i kategorien når filnavnet ikke passer stedet", async () => {
    const { impl } = mockFetch([
      {
        match: isCategory("Oslo Opera House"),
        pages: [
          page("File:Deichmanske bibliotek Bjørvika 002.jpg", { width: 8000, height: 5000 }),
          page("File:Oslo Opera House 2019.jpg", { width: 4000, height: 3000 }),
        ],
      },
    ]);
    const result = await resolveHeroImage(
      {
        pinnedFile: null,
        categories: ["Oslo Opera House"],
        searchTerms: [],
        titleMustIncludeAny: ["Opera"],
        titleMustExclude: ["Deichman"],
      },
      impl,
    );
    expect(result.chosen?.title).toBe("File:Oslo Opera House 2019.jpg");
  });

  it("forkaster samme navn i en annen by fra søket", async () => {
    const { impl } = mockFetch([
      {
        match: isSearch,
        pages: [
          page("File:Bergen, gamle rådhus - no-nb digifoto.jpg", { width: 8000, height: 5000 }),
          page("File:Gamle rådhus i Oslo 2015.jpg", { width: 3000, height: 2000 }),
        ],
      },
    ]);
    const result = await resolveHeroImage(
      {
        pinnedFile: null,
        categories: [],
        searchTerms: ['intitle:"Gamle rådhus"'],
        titleMustIncludeAny: ["Oslo"],
        titleMustExclude: ["Bergen"],
      },
      impl,
    );
    expect(result.chosen?.title).toBe("File:Gamle rådhus i Oslo 2015.jpg");
    expect(result.via).toBe("search");
  });

  it("gir null og advarsler, men kaster ikke, når alt feiler", async () => {
    const { impl } = mockFetch([
      { match: isCategory("Christiania torv"), status: 503 },
      { match: isSearch, pages: [page("File:Christiania torv kart.jpg"), page("File:Tiny.jpg", { width: 800, height: 600 })] },
    ]);
    const result = await resolveHeroImage(
      { pinnedFile: null, categories: ["Christiania torv"], searchTerms: ['intitle:"Christiania torv"'] },
      impl,
    );
    expect(result.chosen).toBeNull();
    expect(result.via).toBeNull();
    expect(result.considered).toBe(2);
    expect(result.warnings).toEqual(["category «Christiania torv»: Commons svarte 503"]);
  });
});

describe("titleMatchesSource", () => {
  const base = { pinnedFile: null, categories: [], searchTerms: [] };
  it("godtar alt uten krav", () => {
    expect(titleMatchesSource("File:Hva som helst.jpg", base)).toBe(true);
  });
  it("krever ett av ordene, uten hensyn til store og små bokstaver", () => {
    const source = { ...base, titleMustIncludeAny: ["Oslo", "Christiania"] };
    expect(titleMatchesSource("File:Gamle rådhus, OSLO.jpg", source)).toBe(true);
    expect(titleMatchesSource("File:Christiania rådhus 1890.jpg", source)).toBe(true);
    expect(titleMatchesSource("File:Gamle rådhus.jpg", source)).toBe(false);
  });
  it("forkaster ekskluderte ord også når et krav er oppfylt", () => {
    const source = { ...base, titleMustIncludeAny: ["Opera"], titleMustExclude: ["bibliotek"] };
    expect(titleMatchesSource("File:Opera og Bibliotek i Bjørvika.jpg", source)).toBe(false);
  });
});

describe("demo-oppsettet", () => {
  it("har 1–3 kategorier eller søk per sted og en nøktern alt-tekst på begge språk", () => {
    for (const poi of DEMO_POIS) {
      const source = DEMO_HERO_IMAGES[poi.id];
      expect(source, poi.id).toBeDefined();
      expect(source.categories.length).toBeLessThanOrEqual(3);
      expect(source.searchTerms.length).toBeLessThanOrEqual(3);
      expect(source.categories.length + source.searchTerms.length).toBeGreaterThan(0);
      expect(poi.translations.nb.heroImageAlt).toBe(`Foto av ${poi.translations.nb.title}`);
      expect(poi.translations.en.heroImageAlt).toMatch(/^Photo of /);
    }
  });

  it("dekker alle stedene i alle områdene", () => {
    expect(DEMO_AREAS.length).toBeGreaterThanOrEqual(3);
    for (const area of DEMO_AREAS) {
      expect(area.pois.length, area.slug).toBeGreaterThan(0);
      for (const poi of area.pois) expect(DEMO_HERO_IMAGES[poi.id], `${area.slug}/${poi.id}`).toBeDefined();
    }
  });

  it("lar et vanlig filnavn for stedet («<navn> <by>.jpg») passere sine egne filnavn-krav", () => {
    for (const poi of DEMO_POIS) {
      const city = poi.translations.nb.locationLabel.split(",")[0];
      const title = `File:${poi.translations.nb.title} ${city}.jpg`;
      expect(titleMatchesSource(title, DEMO_HERO_IMAGES[poi.id]), `${poi.id}: ${title}`).toBe(true);
    }
  });
});
