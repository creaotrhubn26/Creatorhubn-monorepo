/**
 * Lydguide-POC («Interaktiv reiseguide med tilgjengelighet»), steg 1:
 * lese-endepunkt over datamodellen i migrasjon 0629_reiseguide_poc.sql.
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

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { presignCreatorHubObjectDownload } from "./creatorhub-object-storage.js";
import { isSenseAidStorageKey, senseAidMediaUrl } from "./reiseguide-storage.js";

interface Deps {
  pool: Pick<Pool, "query">;
  /** Base for eldre/offentlige nøkler (bilder i R2). */
  mediaUrlBase?: string;
  /** Absolutt base for dette API-et i lyd-URL-er; standard utledes fra forespørselen. */
  publicApiBase?: string;
  /** Presignering av en S3-nøkkel; standard er CreatorHub S3. Byttes ut i tester. */
  presignMedia?: (key: string) => Promise<string | null>;
}

/** Signerte lyd-URL-er lever kort; appen henter en ny via omdirigeringen ved hver avspilling. */
const MEDIA_SIGNED_URL_TTL_S = 15 * 60;

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

/**
 * Flater ut én severdighet for valgt språk. Ren funksjon, brukes av begge
 * detalj-rutene og av testene.
 */
export function buildPoiView(args: {
  poi: PoiRow;
  translations: TranslationRow[];
  scripts: ScriptRow[];
  requestedLang: string;
  defaultLang: string;
  mediaBase: string;
  publicApiBase?: string;
}): PoiView {
  const { poi, requestedLang, defaultLang, mediaBase, publicApiBase } = args;
  const translations = args.translations.filter((t) => t.poi_id === poi.id);
  const scripts = args.scripts.filter((s) => s.poi_id === poi.id);
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
    heroImageUrl: mediaUrl(poi.hero_image_key, mediaBase, publicApiBase),
    heroImageAlt: translation?.hero_image_alt ?? null,
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
      narration: scriptLang ? buildVariant("narration", scriptLang, scripts, mediaBase, publicApiBase) : null,
      audioDescription: scriptLang
        ? buildVariant("audio_description", scriptLang, scripts, mediaBase, publicApiBase)
        : null,
    },
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

const POI_SELECT = `
  SELECT id, area_id, slug, category_id, lat, lng, trigger_radius_m, priority,
         sort_order, free_preview, hero_image_key, status
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

export function registerReiseguideRoutes(app: Express, deps: Deps): void {
  const { pool } = deps;
  const mediaBase = (deps.mediaUrlBase ?? process.env.REISEGUIDE_MEDIA_URL_BASE ?? DEFAULT_MEDIA_URL_BASE).trim();
  const presignMedia =
    deps.presignMedia ?? ((key: string) => presignCreatorHubObjectDownload(key, undefined, MEDIA_SIGNED_URL_TTL_S));
  const apiBase = (req: Request): string =>
    (deps.publicApiBase ?? (process.env.REISEGUIDE_PUBLIC_API_BASE?.trim() || requestApiBase(req))).replace(/\/+$/, "");

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

  async function loadPoiViews(
    poiRows: PoiRow[],
    requestedLang: string,
    defaultLang: string,
    publicApiBase: string,
  ): Promise<PoiView[]> {
    if (poiRows.length === 0) return [];
    const ids = poiRows.map((p) => p.id);
    const [translations, scripts] = await Promise.all([
      pool.query<TranslationRow>(TRANSLATION_SELECT, [ids]),
      pool.query<ScriptRow>(SCRIPT_SELECT, [ids]),
    ]);
    return poiRows.map((poi) =>
      buildPoiView({
        poi,
        translations: translations.rows,
        scripts: scripts.rows,
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
      const { rows: poiRows } = await pool.query<PoiRow & { default_lang: string }>(
        `SELECT p.id, p.area_id, p.slug, p.category_id, p.lat, p.lng, p.trigger_radius_m,
                p.priority, p.sort_order, p.free_preview, p.hero_image_key, p.status,
                a.default_lang
           FROM guide_pois p
           JOIN guide_areas a ON a.id = p.area_id
          WHERE (p.id = $1 OR p.slug = $1)
            AND p.status = 'published' AND a.status = 'published'
          LIMIT 1`,
        [idOrSlug],
      );
      const poi = poiRows[0];
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
}
