/**
 * Lydguide-POC («Interaktiv reiseguide med tilgjengelighet»), steg 1:
 * lese-endepunkt over datamodellen i migrasjon 0640_reiseguide_poc.sql.
 *
 * Offentlige GET-ruter uten innlogging (turist-appen har ingen konto, kun
 * anonym enhets-ID). Monteres fra backend/server/index.ts med
 * registerReiseguideRoutes(app, { pool }).
 *
 *   GET /api/guide/areas                      publiserte områder + språk med innhold
 *   GET /api/guide/areas/:idOrSlug?lang=nb    ett område flatet ut: kategorier + POI-er
 *                                             med varianter (fortelling, synstolking),
 *                                             kapitler, lyd-URL-er og teksting
 *   GET /api/guide/pois/:idOrSlug?lang=nb     én severdighet i samme form
 *   POST /api/guide/pois/:idOrSlug/rating     stjernerangering 1–5 fra anonym enhet
 *                                             (0641_reiseguide_after_visit.sql)
 *   GET /api/guide/share/:idOrSlug?lang=nb    delingsside (HTML med Open Graph) som
 *                                             åpner appen via senseaidexplore://poi/{slug}
 *   /api/guide/device/*                       personlig besøkslogg per anonym enhet med
 *                                             innsyn og sletting (reiseguide-visits.ts,
 *                                             0642_reiseguide_visits.sql)
 *
 * «Etter besøket» (Daniel 18.09.2026): hver POI får quiz (per språk, samme
 * fallback som manusene), rating {average, count} og shareUrl. Liknende steder
 * i nærheten regner appen ut selv fra området (kategori + avstand). Den
 * personlige loggen ligger på telefonen og, når brukeren har samtykket,
 * på serveren (GDPR-premissene står i reiseguide-visits.ts).
 *
 * «Spørsmål underveis» (pakke 3, 0662_reiseguide_chapter_prompts.sql): hvert
 * fortellingskapittel har `prompts` (look/guess med atFraction) på samme språk
 * som fortellingen API-et valgte, altså samme fallback som manusene. Kapitler
 * i synstolkingen har alltid en tom liste.
 *
 * Språk (POC-skisse 17.09.2026): ønsket språk → primærtag (nb-NO → nb) → en →
 * områdets default_lang, avgjort per POI. Svaret sier hvilket språk som ble
 * brukt og om teksten er maskinoversatt (editorial_status = auto). Synstolking
 * faller aldri til et annet språk; mangler den, er variants.audioDescription
 * null og appen faller selv tilbake til fortellingen på samme språk.
 *
 * Lyd og bilder: storage_key i R2 gjøres om til absolutt URL med
 * REISEGUIDE_MEDIA_URL_BASE (standard: samme R2-bøtte som /cdn/* i
 * netlify.toml). Nøkler som allerede er http(s)-URL-er sendes uendret.
 */

import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import express from "express";
import { presignCreatorHubObjectDownload } from "./creatorhub-object-storage.js";
import {
  appDeepLink,
  buildQuizView,
  createRateLimiter,
  parseRatingInput,
  quizLanguages,
  ratingSummary,
  renderSharePage,
  type QuizQuestionView,
  type QuizRow,
  type RatingAggregateRow,
  type RatingSummary,
} from "./reiseguide-after-visit.js";
import { buildChapterPrompts, type ChapterPromptRow, type ChapterPromptView } from "./reiseguide-chapter-prompts.js";
import { registerReiseguideVisitRoutes } from "./reiseguide-visits.js";
import { isSenseAidStorageKey, senseAidMediaUrl } from "./reiseguide-storage.js";

interface Deps {
  pool: Pick<Pool, "query">;
  /** Base for eldre/offentlige nøkler (bilder i R2). */
  mediaUrlBase?: string;
  /** Absolutt base for dette API-et i lyd-URL-er; standard utledes fra forespørselen. */
  publicApiBase?: string;
  /** Presignering av en S3-nøkkel; standard er CreatorHub S3. Byttes ut i tester. */
  presignMedia?: (key: string) => Promise<string | null>;
  /** Dager besøksloggen beholdes; standard SENSEAID_VISIT_RETENTION_DAYS eller 365. */
  visitRetentionDays?: number;
}

/** Signerte lyd-URL-er lever kort; appen henter en ny via omdirigeringen ved hver avspilling. */
const MEDIA_SIGNED_URL_TTL_S = 15 * 60;
/** Vurderinger: 30 per IP per minutt holder for en enhet som retter seg, og stopper løkker. */
const RATING_LIMIT_PER_MINUTE = 30;

const DEFAULT_MEDIA_URL_BASE = "https://pub-6556104b51da4540aebfd28b23c0ebea.r2.dev";
const LANG_RE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/;
const ID_OR_SLUG_RE = /^[A-Za-z0-9_-]{1,120}$/;
const FALLBACK_LANG = "en";

export type ScriptKind = "narration" | "audio_description";
export type EditorialStatus = "draft" | "approved" | "auto";

export interface AreaRow {
  id: string;
  slug: string;
  name: string;
  default_lang: string;
  center_lat: number;
  center_lng: number;
  bbox_south: number;
  bbox_west: number;
  bbox_north: number;
  bbox_east: number;
  status: string;
  price_nok: number | null;
  langs?: string[] | null;
  poi_count?: number | string | null;
}

export interface CategoryRow {
  id: string;
  labels: Record<string, string> | null;
  sort_order: number;
}

export interface PoiRow {
  id: string;
  area_id: string;
  slug: string;
  category_id: string | null;
  lat: number;
  lng: number;
  trigger_radius_m: number;
  priority: number;
  sort_order: number;
  free_preview: boolean;
  hero_image_key: string | null;
  status: string;
  /** Kreditering av heltebildet (0663); mangler i rader fra før migrasjonen. */
  hero_image_credit?: string | null;
  hero_image_license?: string | null;
  hero_image_license_url?: string | null;
  hero_image_source_url?: string | null;
}

/** Kreditering av heltebildet (Commons-lisensen krever at den vises). */
export interface HeroImageCredit {
  author: string;
  license: string | null;
  licenseUrl: string | null;
  sourceUrl: string | null;
}

export interface TranslationRow {
  poi_id: string;
  lang: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  location_label: string | null;
  hero_image_alt: string | null;
  practical_info: unknown;
  editorial_status: EditorialStatus;
}

export interface ScriptRow {
  id: string;
  poi_id: string;
  lang: string;
  kind: ScriptKind;
  chapter_no: number;
  title: string | null;
  script_text: string;
  image_key: string | null;
  image_alt: string | null;
  version: number;
  editorial_status: EditorialStatus;
  estimated_duration_s: number | null;
  audio_id: string | null;
  audio_key: string | null;
  audio_format: string | null;
  audio_duration_s: number | string | null;
  captions_key: string | null;
  captions_cues: unknown;
}

export interface PracticalInfoItem {
  label: string;
  value: string;
}

export interface ChapterView {
  no: number;
  title: string | null;
  scriptText: string;
  imageUrl: string | null;
  imageAlt: string | null;
  version: number;
  editorialStatus: EditorialStatus;
  estimatedDurationS: number | null;
  audio: { url: string; format: string; durationS: number } | null;
  captions: { url: string | null; cues: unknown[] } | null;
  /** Spørsmål underveis (0662); tom for synstolking og når kapittelet ikke har noen. */
  prompts: ChapterPromptView[];
}

export interface VariantView {
  kind: ScriptKind;
  lang: string;
  autoTranslated: boolean;
  durationS: number | null;
  hasAudio: boolean;
  hasCaptions: boolean;
  chapters: ChapterView[];
}

export interface PoiView {
  id: string;
  slug: string;
  areaId: string;
  categoryId: string | null;
  lat: number;
  lng: number;
  triggerRadiusM: number;
  priority: number;
  sortOrder: number;
  freePreview: boolean;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  /** Fotograf og lisens for heltebildet; null uten bilde eller uten opphav. */
  heroImageCredit: HeroImageCredit | null;
  title: string;
  subtitle: string | null;
  summary: string | null;
  locationLabel: string | null;
  practicalInfo: PracticalInfoItem[];
  lang: {
    requested: string;
    resolved: string | null;
    fallbackUsed: boolean;
    autoTranslated: boolean;
    editorialStatus: EditorialStatus | null;
    available: string[];
  };
  variants: {
    narration: VariantView | null;
    audioDescription: VariantView | null;
  };
  /** Quiz på samme språk som manuset; tom liste når stedet ikke har quiz ennå. */
  quiz: QuizQuestionView[];
  /** Snitt og antall stjernerangeringer; null uten vurderinger. */
  rating: RatingSummary | null;
  /** Delingsside for stedet; null når API-basen er ukjent (kun i rene tester). */
  shareUrl: string | null;
}

export function shareUrlFor(slug: string, lang: string, publicApiBase: string): string {
  return `${publicApiBase.replace(/\/+$/, "")}/api/guide/share/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`;
}

/** Normaliserer et BCP 47-tag til små bokstaver; null hvis ugyldig. */
export function parseLang(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const lang = raw.trim().toLowerCase();
  return LANG_RE.test(lang) ? lang : null;
}

/**
 * Velger språk fra det som finnes: ønsket → primærtag → en → default_lang.
 * Rekkefølgen dedupliseres så «nb» ikke prøves to ganger.
 */
export function resolveLang(
  available: Iterable<string>,
  requested: string,
  defaultLang: string,
): string | null {
  const have = new Set(Array.from(available, (l) => l.toLowerCase()));
  const primary = requested.split("-")[0];
  const chain = [requested, primary, FALLBACK_LANG, defaultLang.toLowerCase()];
  for (const candidate of chain) {
    if (have.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Bygger absolutt URL for en lagringsnøkkel: http(s)-nøkler sendes uendret,
 * nøkler i CreatorHub S3 (products/senseaid-explore/…) går via
 * /api/guide/media, alt annet mot den offentlige mediebasen.
 */
export function mediaUrl(key: string | null | undefined, base: string, publicApiBase?: string): string | null {
  if (!key) return null;
  if (/^https?:\/\//i.test(key)) return key;
  if (publicApiBase && isSenseAidStorageKey(key)) return senseAidMediaUrl(key, publicApiBase);
  return `${base.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

/** Utleder https://host fra forespørselen (Render setter X-Forwarded-Proto). */
export function requestApiBase(req: Pick<Request, "get" | "protocol">): string {
  const forwarded = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwarded || req.protocol || "https";
  return `${proto}://${req.get("host") ?? "localhost"}`;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePracticalInfo(raw: unknown): PracticalInfoItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PracticalInfoItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { label, value } = item as Record<string, unknown>;
    if (typeof label === "string" && typeof value === "string" && label && value) {
      out.push({ label, value });
    }
  }
  return out;
}

function buildVariant(
  kind: ScriptKind,
  lang: string,
  rows: ScriptRow[],
  mediaBase: string,
  publicApiBase?: string,
  promptRows: ChapterPromptRow[] = [],
): VariantView | null {
  const chapters = rows
    .filter((r) => r.kind === kind && r.lang === lang)
    .sort((a, b) => a.chapter_no - b.chapter_no);
  if (chapters.length === 0) return null;

  let durationS = 0;
  let durationKnown = true;
  let hasAudio = true;
  let hasCaptions = true;

  const views: ChapterView[] = chapters.map((r) => {
    const audioDuration = toNumber(r.audio_duration_s);
    const audioUrl = mediaUrl(r.audio_key, mediaBase, publicApiBase);
    const audio =
      audioUrl && audioDuration != null
        ? { url: audioUrl, format: r.audio_format ?? "m4a", durationS: audioDuration }
        : null;
    const cues = Array.isArray(r.captions_cues) ? r.captions_cues : [];
    const captionsUrl = mediaUrl(r.captions_key, mediaBase, publicApiBase);
    const captions = audio && (captionsUrl || cues.length > 0) ? { url: captionsUrl, cues } : null;

    const chapterDuration = audio?.durationS ?? r.estimated_duration_s ?? null;
    if (chapterDuration == null) durationKnown = false;
    else durationS += chapterDuration;
    if (!audio) hasAudio = false;
    if (!captions) hasCaptions = false;

    return {
      no: r.chapter_no,
      title: r.title,
      scriptText: r.script_text,
      imageUrl: mediaUrl(r.image_key, mediaBase, publicApiBase),
      imageAlt: r.image_alt,
      version: r.version,
      editorialStatus: r.editorial_status,
      estimatedDurationS: r.estimated_duration_s,
      audio,
      captions,
      prompts: kind === "narration" ? buildChapterPrompts(promptRows, r.poi_id, lang, r.chapter_no) : [],
    };
  });

  return {
    kind,
    lang,
    autoTranslated: chapters.every((r) => r.editorial_status === "auto"),
    durationS: durationKnown ? Math.round(durationS) : null,
    hasAudio,
    hasCaptions,
    chapters: views,
  };
}

/** Bare http(s)-lenker slipper gjennom til appen (Link i SwiftUI). */
function httpUrlOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/**
 * Kreditering for heltebildet. Null når stedet ikke har bilde eller opphavet
 * mangler, så appen aldri viser «Foto: » uten navn.
 */
export function heroImageCredit(poi: PoiRow, heroImageUrl: string | null): HeroImageCredit | null {
  const author = poi.hero_image_credit?.trim();
  if (!heroImageUrl || !author) return null;
  return {
    author,
    license: poi.hero_image_license?.trim() || null,
    licenseUrl: httpUrlOrNull(poi.hero_image_license_url),
    sourceUrl: httpUrlOrNull(poi.hero_image_source_url),
  };
}

/**
 * Flater ut én severdighet for valgt språk. Ren funksjon, brukes av begge
 * detalj-rutene og av testene.
 */
export function buildPoiView(args: {
  poi: PoiRow;
  translations: TranslationRow[];
  scripts: ScriptRow[];
  quiz?: QuizRow[];
  ratings?: RatingAggregateRow[];
  prompts?: ChapterPromptRow[];
  requestedLang: string;
  defaultLang: string;
  mediaBase: string;
  publicApiBase?: string;
}): PoiView {
  const { poi, requestedLang, defaultLang, mediaBase, publicApiBase } = args;
  const translations = args.translations.filter((t) => t.poi_id === poi.id);
  const scripts = args.scripts.filter((s) => s.poi_id === poi.id);
  const quizRows = args.quiz ?? [];
  const promptRows = (args.prompts ?? []).filter((p) => p.poi_id === poi.id);
  const ratingRow = (args.ratings ?? []).find((r) => r.poi_id === poi.id);
  const available = Array.from(new Set(translations.map((t) => t.lang.toLowerCase()))).sort();
  const resolved = resolveLang(available, requestedLang, defaultLang);
  const translation = resolved
    ? translations.find((t) => t.lang.toLowerCase() === resolved) ?? null
    : null;

  // Manus følger presentasjonsspråket. Finnes ikke fortelling på det språket,
  // brukes samme fallback-kjede på manusene alene, så appen alltid får noe å
  // spille når det finnes innhold i det hele tatt.
  const scriptLangs = new Set(scripts.map((s) => s.lang.toLowerCase()));
  const scriptLang =
    resolved && scriptLangs.has(resolved)
      ? resolved
      : resolveLang(scriptLangs, requestedLang, defaultLang);

  // Quizen følger manusspråket når den finnes der, ellers samme fallback-kjede.
  const quizLangs = quizLanguages(quizRows, poi.id);
  const quizLang =
    scriptLang && quizLangs.includes(scriptLang) ? scriptLang : resolveLang(quizLangs, requestedLang, defaultLang);

  const heroImageUrl = mediaUrl(poi.hero_image_key, mediaBase, publicApiBase);

  return {
    id: poi.id,
    slug: poi.slug,
    areaId: poi.area_id,
    categoryId: poi.category_id,
    lat: poi.lat,
    lng: poi.lng,
    triggerRadiusM: poi.trigger_radius_m,
    priority: poi.priority,
    sortOrder: poi.sort_order,
    freePreview: poi.free_preview,
    heroImageUrl,
    // Alt-teksten beskriver bildet; uten bilde har den ingenting å beskrive.
    heroImageAlt: heroImageUrl ? translation?.hero_image_alt ?? null : null,
    heroImageCredit: heroImageCredit(poi, heroImageUrl),
    title: translation?.title ?? poi.slug,
    subtitle: translation?.subtitle ?? null,
    summary: translation?.summary ?? null,
    locationLabel: translation?.location_label ?? null,
    practicalInfo: normalizePracticalInfo(translation?.practical_info),
    lang: {
      requested: requestedLang,
      resolved,
      fallbackUsed: resolved != null && resolved !== requestedLang,
      autoTranslated: translation?.editorial_status === "auto",
      editorialStatus: translation?.editorial_status ?? null,
      available,
    },
    variants: {
      narration: scriptLang
        ? buildVariant("narration", scriptLang, scripts, mediaBase, publicApiBase, promptRows)
        : null,
      audioDescription: scriptLang
        ? buildVariant("audio_description", scriptLang, scripts, mediaBase, publicApiBase)
        : null,
    },
    quiz: quizLang ? buildQuizView(quizRows, poi.id, quizLang) : [],
    rating: ratingSummary(ratingRow),
    shareUrl: publicApiBase ? shareUrlFor(poi.slug, resolved ?? requestedLang, publicApiBase) : null,
  };
}

function areaView(row: AreaRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    defaultLang: row.default_lang,
    center: { lat: row.center_lat, lng: row.center_lng },
    bbox: {
      south: row.bbox_south,
      west: row.bbox_west,
      north: row.bbox_north,
      east: row.bbox_east,
    },
    priceNok: row.price_nok,
    languages: Array.isArray(row.langs) ? row.langs : [],
    poiCount: toNumber(row.poi_count) ?? 0,
  };
}

function categoryView(row: CategoryRow, lang: string, defaultLang: string) {
  const labels = row.labels && typeof row.labels === "object" ? row.labels : {};
  const labelLang = resolveLang(Object.keys(labels), lang, defaultLang);
  return {
    id: row.id,
    label: labelLang ? labels[labelLang] : row.id,
    labels,
    sortOrder: row.sort_order,
  };
}

const AREA_SELECT = `
  SELECT a.id, a.slug, a.name, a.default_lang, a.center_lat, a.center_lng,
         a.bbox_south, a.bbox_west, a.bbox_north, a.bbox_east, a.status, a.price_nok,
         (SELECT array_agg(DISTINCT lower(t.lang) ORDER BY lower(t.lang))
            FROM guide_poi_translations t
            JOIN guide_pois p ON p.id = t.poi_id
           WHERE p.area_id = a.id AND p.status = 'published') AS langs,
         (SELECT count(*) FROM guide_pois p
           WHERE p.area_id = a.id AND p.status = 'published') AS poi_count
    FROM guide_areas a`;

// Krediteringskolonnene (0663) leses via to_jsonb(rad) ->> 'kolonne', som gir
// null i stedet for feil hvis API-et kommer ut før migrasjonen er kjørt.
const HERO_CREDIT_COLUMNS = (row: string) => `
         to_jsonb(${row}) ->> 'hero_image_credit' AS hero_image_credit,
         to_jsonb(${row}) ->> 'hero_image_license' AS hero_image_license,
         to_jsonb(${row}) ->> 'hero_image_license_url' AS hero_image_license_url,
         to_jsonb(${row}) ->> 'hero_image_source_url' AS hero_image_source_url`;

const POI_SELECT = `
  SELECT id, area_id, slug, category_id, lat, lng, trigger_radius_m, priority,
         sort_order, free_preview, hero_image_key, status,${HERO_CREDIT_COLUMNS("guide_pois")}
    FROM guide_pois`;

const TRANSLATION_SELECT = `
  SELECT poi_id, lang, title, subtitle, summary, location_label, hero_image_alt,
         practical_info, editorial_status
    FROM guide_poi_translations
   WHERE poi_id = ANY($1::text[])`;

const SCRIPT_SELECT = `
  SELECT s.id, s.poi_id, s.lang, s.kind, s.chapter_no, s.title, s.script_text,
         s.image_key, s.image_alt, s.version, s.editorial_status, s.estimated_duration_s,
         a.id AS audio_id, a.storage_key AS audio_key, a.format AS audio_format,
         a.duration_s AS audio_duration_s,
         c.storage_key AS captions_key, c.cues AS captions_cues
    FROM guide_poi_scripts s
    LEFT JOIN guide_poi_audio a ON a.script_id = s.id AND a.is_active
    LEFT JOIN guide_poi_captions c ON c.audio_id = a.id
   WHERE s.poi_id = ANY($1::text[])
   ORDER BY s.poi_id, s.lang, s.kind, s.chapter_no`;

const QUIZ_SELECT = `
  SELECT id, poi_id, lang, sort_order, question, options, correct_index, explanation
    FROM guide_poi_quiz_questions
   WHERE poi_id = ANY($1::text[])
   ORDER BY poi_id, lang, sort_order`;

const PROMPT_SELECT = `
  SELECT id, poi_id, lang, chapter_no, kind, at_fraction, prompt_text, options,
         answer_index, reveal_text, sort_order
    FROM guide_poi_chapter_prompts
   WHERE poi_id = ANY($1::text[])
   ORDER BY poi_id, lang, chapter_no, sort_order`;

const RATING_AGGREGATE_SELECT = `
  SELECT poi_id, avg(stars)::float8 AS average, count(*)::int AS count
    FROM guide_poi_ratings
   WHERE poi_id = ANY($1::text[])
   GROUP BY poi_id`;

const POI_LOOKUP_SELECT = `
  SELECT p.id, p.area_id, p.slug, p.category_id, p.lat, p.lng, p.trigger_radius_m,
         p.priority, p.sort_order, p.free_preview, p.hero_image_key, p.status,${HERO_CREDIT_COLUMNS("p")},
         a.default_lang
    FROM guide_pois p
    JOIN guide_areas a ON a.id = p.area_id
   WHERE (p.id = $1 OR p.slug = $1)
     AND p.status = 'published' AND a.status = 'published'
   LIMIT 1`;

export function registerReiseguideRoutes(app: Express, deps: Deps): void {
  const { pool } = deps;
  const mediaBase = (deps.mediaUrlBase ?? process.env.REISEGUIDE_MEDIA_URL_BASE ?? DEFAULT_MEDIA_URL_BASE).trim();
  const presignMedia =
    deps.presignMedia ?? ((key: string) => presignCreatorHubObjectDownload(key, undefined, MEDIA_SIGNED_URL_TTL_S));
  const apiBase = (req: Request): string =>
    (deps.publicApiBase ?? (process.env.REISEGUIDE_PUBLIC_API_BASE?.trim() || requestApiBase(req))).replace(/\/+$/, "");
  const ratingLimited = createRateLimiter(RATING_LIMIT_PER_MINUTE, 60_000);
  const clientIp = (req: Request): string =>
    req.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "unknown";

  const publicCache = (res: Response) => {
    res.setHeader("Cache-Control", "public, max-age=60");
    res.setHeader("X-Content-Type-Options", "nosniff");
  };

  const readLang = (req: Request, res: Response, defaultLang: string): string | null => {
    const raw = req.query.lang;
    if (raw == null || raw === "") return defaultLang.toLowerCase();
    const lang = parseLang(raw);
    if (!lang) {
      res.status(400).json({ error: "invalid_lang", message: "lang må være et BCP 47-tag, f.eks. nb eller en" });
      return null;
    }
    return lang;
  };

  const readIdOrSlug = (req: Request, res: Response): string | null => {
    const value = String(req.params.idOrSlug ?? "");
    if (!ID_OR_SLUG_RE.test(value)) {
      res.status(400).json({ error: "invalid_id" });
      return null;
    }
    return value;
  };

  const wrap =
    (fn: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response) => {
      try {
        await fn(req, res);
      } catch (err) {
        console.error("[reiseguide] route error", err);
        if (!res.headersSent) res.status(500).json({ error: "internal_error" });
      }
    };

  /**
   * Spørsmål underveis er et tillegg: mangler tabellen (0662 ikke kjørt ennå),
   * får kapitlene tomme lister i stedet for at hele området svarer 500.
   */
  async function loadPromptRows(ids: string[]): Promise<ChapterPromptRow[]> {
    try {
      return (await pool.query<ChapterPromptRow>(PROMPT_SELECT, [ids])).rows;
    } catch (err) {
      if ((err as { code?: unknown } | null)?.code === "42P01") return [];
      throw err;
    }
  }

  async function loadPoiViews(
    poiRows: PoiRow[],
    requestedLang: string,
    defaultLang: string,
    publicApiBase: string,
  ): Promise<PoiView[]> {
    if (poiRows.length === 0) return [];
    const ids = poiRows.map((p) => p.id);
    const [translations, scripts, quiz, ratings, prompts] = await Promise.all([
      pool.query<TranslationRow>(TRANSLATION_SELECT, [ids]),
      pool.query<ScriptRow>(SCRIPT_SELECT, [ids]),
      pool.query<QuizRow>(QUIZ_SELECT, [ids]),
      pool.query<RatingAggregateRow>(RATING_AGGREGATE_SELECT, [ids]),
      loadPromptRows(ids),
    ]);
    return poiRows.map((poi) =>
      buildPoiView({
        poi,
        translations: translations.rows,
        scripts: scripts.rows,
        quiz: quiz.rows,
        ratings: ratings.rows,
        prompts,
        requestedLang,
        defaultLang,
        mediaBase,
        publicApiBase,
      }),
    );
  }

  app.get(
    "/api/guide/media/*",
    wrap(async (req, res) => {
      const key = String((req.params as Record<string, string>)[0] ?? "");
      if (!isSenseAidStorageKey(key)) {
        res.status(404).json({ error: "media_not_found" });
        return;
      }
      const signed = await presignMedia(key);
      if (!signed) {
        res.status(503).json({ error: "media_storage_unavailable" });
        return;
      }
      res.setHeader("Cache-Control", "private, no-store");
      res.redirect(302, signed);
    }),
  );

  app.get(
    "/api/guide/areas",
    wrap(async (_req, res) => {
      const { rows } = await pool.query<AreaRow>(
        `${AREA_SELECT} WHERE a.status = 'published' ORDER BY a.name`,
      );
      publicCache(res);
      res.json({ areas: rows.map(areaView) });
    }),
  );

  app.get(
    "/api/guide/areas/:idOrSlug",
    wrap(async (req, res) => {
      const idOrSlug = readIdOrSlug(req, res);
      if (!idOrSlug) return;
      const { rows: areaRows } = await pool.query<AreaRow>(
        `${AREA_SELECT} WHERE (a.id = $1 OR a.slug = $1) AND a.status = 'published' LIMIT 1`,
        [idOrSlug],
      );
      const area = areaRows[0];
      if (!area) {
        res.status(404).json({ error: "area_not_found" });
        return;
      }
      const lang = readLang(req, res, area.default_lang);
      if (!lang) return;

      const [categories, pois] = await Promise.all([
        pool.query<CategoryRow>(
          `SELECT id, labels, sort_order FROM guide_categories ORDER BY sort_order, id`,
        ),
        pool.query<PoiRow>(
          `${POI_SELECT} WHERE area_id = $1 AND status = 'published'
            ORDER BY sort_order, priority DESC, id`,
          [area.id],
        ),
      ]);
      const poiViews = await loadPoiViews(pois.rows, lang, area.default_lang, apiBase(req));
      const usedCategories = new Set(poiViews.map((p) => p.categoryId).filter(Boolean));

      publicCache(res);
      res.json({
        area: areaView(area),
        requestedLang: lang,
        categories: categories.rows
          .filter((c) => usedCategories.has(c.id))
          .map((c) => categoryView(c, lang, area.default_lang)),
        pois: poiViews,
      });
    }),
  );

  app.get(
    "/api/guide/pois/:idOrSlug",
    wrap(async (req, res) => {
      const idOrSlug = readIdOrSlug(req, res);
      if (!idOrSlug) return;
      const poi = await lookupPoi(idOrSlug);
      if (!poi) {
        res.status(404).json({ error: "poi_not_found" });
        return;
      }
      const lang = readLang(req, res, poi.default_lang);
      if (!lang) return;
      const [view] = await loadPoiViews([poi], lang, poi.default_lang, apiBase(req));
      publicCache(res);
      res.json({ requestedLang: lang, poi: view });
    }),
  );

  app.post(
    "/api/guide/pois/:idOrSlug/rating",
    express.json({ limit: "8kb" }),
    wrap(async (req, res) => {
      const idOrSlug = readIdOrSlug(req, res);
      if (!idOrSlug) return;
      const parsed = parseRatingInput(req.body);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error, message: parsed.message });
        return;
      }
      if (ratingLimited(`guide-rating:${clientIp(req)}`)) {
        res.status(429).json({ error: "rate_limited" });
        return;
      }
      const poi = await lookupPoi(idOrSlug);
      if (!poi) {
        res.status(404).json({ error: "poi_not_found" });
        return;
      }
      const { deviceId, stars, lang, comment } = parsed.value;
      await pool.query(
        `INSERT INTO guide_poi_ratings (id, poi_id, device_id, stars, lang, comment)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (poi_id, device_id) DO UPDATE SET
           stars = EXCLUDED.stars, lang = EXCLUDED.lang, comment = EXCLUDED.comment, updated_at = now()`,
        [`rat_${randomUUID()}`, poi.id, deviceId, stars, lang, comment],
      );
      const { rows } = await pool.query<RatingAggregateRow>(RATING_AGGREGATE_SELECT, [[poi.id]]);
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ poiId: poi.id, yourStars: stars, rating: ratingSummary(rows[0]) });
    }),
  );

  app.get(
    "/api/guide/share/:idOrSlug",
    wrap(async (req, res) => {
      const idOrSlug = readIdOrSlug(req, res);
      if (!idOrSlug) return;
      const poi = await lookupPoi(idOrSlug);
      if (!poi) {
        res.status(404).json({ error: "poi_not_found" });
        return;
      }
      const lang = readLang(req, res, poi.default_lang);
      if (!lang) return;
      const base = apiBase(req);
      const [view] = await loadPoiViews([poi], lang, poi.default_lang, base);
      const pageLang = view.lang.resolved ?? lang;
      publicCache(res);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(
        renderSharePage({
          title: view.title,
          subtitle: view.subtitle,
          summary: view.summary,
          locationLabel: view.locationLabel,
          imageUrl: view.heroImageUrl,
          imageAlt: view.heroImageAlt,
          imageCredit: view.heroImageCredit,
          lang: pageLang,
          shareUrl: shareUrlFor(view.slug, pageLang, base),
          appUrl: appDeepLink(view.slug, pageLang),
        }),
      );
    }),
  );

  async function lookupPoi(idOrSlug: string): Promise<(PoiRow & { default_lang: string }) | undefined> {
    const { rows } = await pool.query<PoiRow & { default_lang: string }>(POI_LOOKUP_SELECT, [idOrSlug]);
    return rows[0];
  }

  registerReiseguideVisitRoutes(app, { pool, retentionDays: deps.visitRetentionDays });
}
