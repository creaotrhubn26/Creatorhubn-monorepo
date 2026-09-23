/**
 * Heltebilder til SenseAid Explore fra Wikimedia Commons (beslutning
 * 23.09.2026, docs/evidence/2026-09-senseaid-commons-images.yaml).
 *
 * Ren utvalgslogikk (testbar uten nett) + en tynn fetch-klient mot Commons-
 * API-et. Brukes av scripts/reiseguide-commons-images.ts, som kjøres i
 * workflowen senseaid-seed-demo.yml (GitHub-runneren har åpent nett).
 *
 * Regler:
 *   * lisens: CC0, public domain, CC BY / CC BY-SA 2.0–4.0 (også nasjonale
 *     porteringer som «CC BY-SA 3.0 de»); aldri NC eller ND, aldri ukjent
 *   * opphav (Artist) må finnes, uten HTML, fordi krediteringen vises i appen
 *   * JPEG, minst 1600 px bred, liggende og ikke panorama (maks 2:1)
 *   * titler som tyder på kart, plantegning, logo, tegning, frimerke, gamle
 *     trykk eller maleri hoppes over (bildet omtales som «Foto av …»)
 *   * utvalg: fastspikret fil vinner; ellers kategoriene, og bare hvis de ikke
 *     gir noe, søkene. Innenfor et trinn: flest piksler, deretter tittel.
 */

export const COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php";
export const COMMONS_USER_AGENT = "SenseAidExplore/0.1 (https://creatorhubn.com; daniel@creatorhubn.com)";
/** Bredden på miniatyren appen laster (iiurlwidth) og minstebredden på originalen. */
export const COMMONS_THUMB_WIDTH = 1600;
export const MIN_IMAGE_WIDTH = 1600;
/** Bredere enn 2:1 regnes som panorama og beskjæres dårlig i heltebildet. */
export const MAX_ASPECT_RATIO = 2;
/** Antall filer per kategori/søk (API-grensen for extmetadata er 50). */
export const COMMONS_BATCH_LIMIT = 50;

export interface CommonsImageSource {
  pinnedFile: string | null;
  categories: string[];
  searchTerms: string[];
}

interface ExtMetadataValue {
  value?: unknown;
}

export interface CommonsImageInfo {
  url?: string;
  descriptionurl?: string;
  thumburl?: string;
  width?: number;
  height?: number;
  mime?: string;
  extmetadata?: Record<string, ExtMetadataValue | undefined>;
}

export interface CommonsPage {
  title?: string;
  missing?: boolean;
  imageinfo?: CommonsImageInfo[];
}

export interface CommonsCandidate {
  title: string;
  width: number;
  height: number;
  mime: string;
  /** Miniatyr på COMMONS_THUMB_WIDTH px; det er denne som blir hero_image_key. */
  thumbUrl: string;
  /** Filsiden på Commons. */
  sourceUrl: string;
  /** Opphav uten HTML, eller null når det mangler. */
  author: string | null;
  /** Kort lisensnavn slik Commons skriver det, eller null. */
  license: string | null;
  licenseUrl: string | null;
}

export type RejectReason =
  | "not_jpeg"
  | "too_small"
  | "not_landscape"
  | "panorama"
  | "license_not_allowed"
  | "no_author"
  | "unwanted_title";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Fjerner HTML-tagger og entiteter fra Commons-felt som Artist, og normaliserer mellomrom. */
export function stripHtml(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity: string) => {
      const lower = entity.toLowerCase();
      if (lower.startsWith("#x")) return safeCodePoint(Number.parseInt(lower.slice(2), 16), match);
      if (lower.startsWith("#")) return safeCodePoint(Number.parseInt(lower.slice(1), 10), match);
      return NAMED_ENTITIES[lower] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function safeCodePoint(code: number, fallback: string): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return fallback;
  return String.fromCodePoint(code);
}

const CC_BY_RE = /^cc[ -]by(-sa)? (2\.0|2\.5|3\.0|4\.0)( [a-z]{2}(-[a-z]{2})?)?$/i;
const PUBLIC_DOMAIN_RE = /^(public domain|cc0( 1\.0)?|cc-zero)$/i;
const NC_ND_RE = /(^|[-_ /])(nc|nd)([-_ /]|$)/i;

/**
 * Godkjent lisens? Kort navn fra extmetadata.LicenseShortName, lenke fra
 * LicenseUrl. NC/ND avvises også når de bare står i lenken.
 */
export function isAllowedLicense(shortName: string | null, url: string | null): boolean {
  const name = (shortName ?? "").replace(/\s+/g, " ").trim();
  if (!name) return false;
  if (NC_ND_RE.test(name) || (url && NC_ND_RE.test(url))) return false;
  if (PUBLIC_DOMAIN_RE.test(name)) return true;
  if (!CC_BY_RE.test(name)) return false;
  // En CC BY-lenke må peke på samme lisensfamilie (by eller by-sa).
  if (url && !/creativecommons\.org\/licenses\/by(-sa)?\//i.test(url)) return false;
  return true;
}

const UNWANTED_TITLE_WORDS = [
  "map", "maps", "kart", "karte", "plan", "plans", "plantegning", "grunnriss", "floor plan", "site plan",
  "logo", "logos", "drawing", "tegning", "sketch", "skisse", "diagram",
  "stamp", "stamps", "frimerke", "frimerker",
  "print", "prints", "engraving", "kobberstikk", "stikk", "lithograph", "litografi", "woodcut", "tresnitt",
  "postcard", "postkort", "painting", "maleri", "coat of arms", "våpen",
];
const UNWANTED_TITLE_RE = new RegExp(
  `(^|[^\\p{L}\\p{N}])(${UNWANTED_TITLE_WORDS.map((w) => w.replace(/ /g, "[ _]")).join("|")})(?=[^\\p{L}\\p{N}]|$)`,
  "iu",
);

/** Titler som tyder på kart, plantegning, logo, tegning, frimerke, gamle trykk eller maleri. */
export function isUnwantedTitle(title: string): boolean {
  const name = title.replace(/^File:/i, "").replace(/\.[a-z0-9]+$/i, "");
  return UNWANTED_TITLE_RE.test(name);
}

function metaText(info: CommonsImageInfo, key: string): string | null {
  const text = stripHtml(info.extmetadata?.[key]?.value);
  return text || null;
}

function httpsUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const url = value.startsWith("//") ? `https:${value}` : value;
  return /^https?:\/\//i.test(url) ? url : null;
}

/** Gjør én side fra API-et om til en kandidat; null når nødvendige felt mangler. */
export function toCandidate(page: CommonsPage): CommonsCandidate | null {
  const info = page.imageinfo?.[0];
  if (!page.title || page.missing || !info) return null;
  const thumbUrl = httpsUrl(info.thumburl) ?? httpsUrl(info.url);
  const sourceUrl =
    httpsUrl(info.descriptionurl) ??
    `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
  if (!thumbUrl || typeof info.width !== "number" || typeof info.height !== "number") return null;
  const author = metaText(info, "Artist");
  return {
    title: page.title,
    width: info.width,
    height: info.height,
    mime: (info.mime ?? "").toLowerCase(),
    thumbUrl,
    sourceUrl,
    author: author ? author.slice(0, 200) : null,
    license: metaText(info, "LicenseShortName"),
    licenseUrl: httpsUrl(metaText(info, "LicenseUrl")),
  };
}

/**
 * Hvorfor en kandidat avvises, eller null når den kan brukes. Med
 * `pinned: true` gjelder bare de harde kravene (JPEG, lisens, opphav), siden
 * et menneske har valgt filen.
 */
export function rejectReason(c: CommonsCandidate, opts: { pinned?: boolean } = {}): RejectReason | null {
  if (c.mime !== "image/jpeg") return "not_jpeg";
  if (!isAllowedLicense(c.license, c.licenseUrl)) return "license_not_allowed";
  if (!c.author) return "no_author";
  if (opts.pinned) return null;
  if (c.width < MIN_IMAGE_WIDTH) return "too_small";
  if (c.width <= c.height) return "not_landscape";
  if (c.width / c.height > MAX_ASPECT_RATIO) return "panorama";
  if (isUnwantedTitle(c.title)) return "unwanted_title";
  return null;
}

/** Flest piksler vinner, deretter tittel (kodepunktrekkefølge, uavhengig av locale). */
export function compareCandidates(a: CommonsCandidate, b: CommonsCandidate): number {
  const pixels = b.width * b.height - a.width * a.height;
  if (pixels !== 0) return pixels;
  if (a.title < b.title) return -1;
  if (a.title > b.title) return 1;
  return 0;
}

/** Beste godkjente kandidat, eller null. Duplikater (samme tittel) telles én gang. */
export function pickBest(candidates: CommonsCandidate[]): CommonsCandidate | null {
  const seen = new Set<string>();
  const accepted = candidates.filter((c) => {
    if (seen.has(c.title)) return false;
    seen.add(c.title);
    return rejectReason(c) === null;
  });
  accepted.sort(compareCandidates);
  return accepted[0] ?? null;
}

type CommonsQuery =
  | { kind: "file"; title: string }
  | { kind: "category"; name: string }
  | { kind: "search"; term: string };

/** Bygger API-URL-en: imageinfo med miniatyr og lisensfelt over én fil, en kategori eller et søk. */
export function commonsQueryUrl(query: CommonsQuery): string {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: String(COMMONS_THUMB_WIDTH),
    iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl",
  });
  switch (query.kind) {
    case "file":
      params.set("titles", /^File:/i.test(query.title) ? query.title : `File:${query.title}`);
      break;
    case "category":
      params.set("generator", "categorymembers");
      params.set("gcmtitle", /^Category:/i.test(query.name) ? query.name : `Category:${query.name}`);
      params.set("gcmtype", "file");
      params.set("gcmlimit", String(COMMONS_BATCH_LIMIT));
      break;
    case "search":
      params.set("generator", "search");
      params.set("gsrsearch", query.term);
      params.set("gsrnamespace", "6");
      params.set("gsrlimit", String(COMMONS_BATCH_LIMIT));
      break;
  }
  return `${COMMONS_API_URL}?${params.toString()}`;
}

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Henter sidene for én spørring. Kaster ved HTTP-feil eller API-feil. */
export async function fetchCommonsPages(query: CommonsQuery, fetchImpl: FetchLike): Promise<CommonsPage[]> {
  const res = await fetchImpl(commonsQueryUrl(query), {
    headers: { "User-Agent": COMMONS_USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Commons svarte ${res.status}`);
  const body = (await res.json()) as { error?: { info?: string }; query?: { pages?: unknown } };
  if (body.error) throw new Error(`Commons-feil: ${body.error.info ?? "ukjent"}`);
  const pages = body.query?.pages;
  if (Array.isArray(pages)) return pages as CommonsPage[];
  // formatversion=1 gir et objekt med sideid som nøkkel.
  if (pages && typeof pages === "object") return Object.values(pages as Record<string, CommonsPage>);
  return [];
}

export interface ResolveResult {
  chosen: CommonsCandidate | null;
  /** Hvor valget kom fra: pinned, category eller search. */
  via: "pinned" | "category" | "search" | null;
  considered: number;
  warnings: string[];
}

async function candidatesFor(
  queries: CommonsQuery[],
  fetchImpl: FetchLike,
  warnings: string[],
): Promise<CommonsCandidate[]> {
  const all: CommonsCandidate[] = [];
  for (const query of queries) {
    try {
      for (const page of await fetchCommonsPages(query, fetchImpl)) {
        const candidate = toCandidate(page);
        if (candidate) all.push(candidate);
      }
    } catch (err) {
      const label = query.kind === "file" ? query.title : query.kind === "category" ? query.name : query.term;
      warnings.push(`${query.kind} «${label}»: ${(err as Error).message}`);
    }
  }
  return all;
}

/**
 * Finner heltebilde for ett sted. Kaster aldri for nett- eller API-feil; de
 * havner i warnings, og chosen blir null når ingen kandidat består.
 */
export async function resolveHeroImage(source: CommonsImageSource, fetchImpl: FetchLike): Promise<ResolveResult> {
  const warnings: string[] = [];
  let considered = 0;

  if (source.pinnedFile) {
    const pinned = await candidatesFor([{ kind: "file", title: source.pinnedFile }], fetchImpl, warnings);
    considered += pinned.length;
    const candidate = pinned[0];
    const reason = candidate ? rejectReason(candidate, { pinned: true }) : "missing";
    if (candidate && reason === null) return { chosen: candidate, via: "pinned", considered, warnings };
    warnings.push(`fastspikret fil «${source.pinnedFile}» brukes ikke (${reason}); velger automatisk`);
  }

  const tiers: { via: "category" | "search"; queries: CommonsQuery[] }[] = [
    { via: "category", queries: source.categories.map((name) => ({ kind: "category" as const, name })) },
    { via: "search", queries: source.searchTerms.map((term) => ({ kind: "search" as const, term })) },
  ];
  for (const tier of tiers) {
    if (tier.queries.length === 0) continue;
    const candidates = await candidatesFor(tier.queries, fetchImpl, warnings);
    considered += candidates.length;
    const chosen = pickBest(candidates);
    if (chosen) return { chosen, via: tier.via, considered, warnings };
  }
  return { chosen: null, via: null, considered, warnings };
}
