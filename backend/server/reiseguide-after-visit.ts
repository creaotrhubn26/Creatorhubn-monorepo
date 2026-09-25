/**
 * SenseAid Explore, «etter besøket» (Daniel 18.09.2026): ren logikk for quiz,
 * stjernerangering og delingssiden, uten Express og uten database, så den kan
 * enhetstestes rett. Rutene i reiseguide-routes.ts bruker dette.
 *
 * Datamodell: migrations/0641_reiseguide_after_visit.sql.
 */

export interface QuizRow {
  id: string;
  poi_id: string;
  lang: string;
  sort_order: number;
  question: string;
  options: unknown;
  correct_index: number;
  explanation: string | null;
}

export interface QuizQuestionView {
  id: string;
  no: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
}

export interface RatingAggregateRow {
  poi_id: string;
  average: number | string | null;
  count: number | string | null;
}

export interface RatingSummary {
  /** Snitt med én desimal. */
  average: number;
  count: number;
}

export interface RatingInput {
  deviceId: string;
  stars: number;
  lang: string | null;
  comment: string | null;
}

/** Samme regel som CHECK-en i guide_poi_ratings.device_id. */
export const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const LANG_RE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/;
export const RATING_COMMENT_MAX = 500;

/** Bygger quiz-visningen for ett språk; rader med ugyldige alternativer hoppes over. */
export function buildQuizView(rows: QuizRow[], poiId: string, lang: string): QuizQuestionView[] {
  return rows
    .filter((r) => r.poi_id === poiId && r.lang.toLowerCase() === lang)
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((r) => {
      const options = Array.isArray(r.options)
        ? r.options.filter((o): o is string => typeof o === "string" && o.trim() !== "")
        : [];
      if (options.length < 2 || r.correct_index < 0 || r.correct_index >= options.length) return [];
      return [
        {
          id: r.id,
          no: r.sort_order,
          question: r.question,
          options,
          correctIndex: r.correct_index,
          explanation: r.explanation,
        },
      ];
    });
}

/** Språkene det finnes quiz på for en severdighet (små bokstaver, sortert). */
export function quizLanguages(rows: QuizRow[], poiId: string): string[] {
  return Array.from(new Set(rows.filter((r) => r.poi_id === poiId).map((r) => r.lang.toLowerCase()))).sort();
}

export function ratingSummary(row: RatingAggregateRow | undefined | null): RatingSummary | null {
  if (!row) return null;
  const count = Number(row.count ?? 0);
  const average = Number(row.average ?? 0);
  if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(average)) return null;
  return { average: Math.round(average * 10) / 10, count: Math.trunc(count) };
}

export type RatingParseResult = { ok: true; value: RatingInput } | { ok: false; error: string; message: string };

/** Validerer POST-kroppen for en vurdering. Ingen innlogging, kun anonym enhets-ID. */
export function parseRatingInput(body: unknown): RatingParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Kroppen må være et JSON-objekt." };
  }
  const { deviceId, stars, lang, comment } = body as Record<string, unknown>;
  if (typeof deviceId !== "string" || !DEVICE_ID_RE.test(deviceId)) {
    return { ok: false, error: "invalid_device_id", message: "deviceId må være 8–64 tegn [A-Za-z0-9_-]." };
  }
  const starsNumber = typeof stars === "number" ? stars : typeof stars === "string" ? Number(stars) : NaN;
  if (!Number.isInteger(starsNumber) || starsNumber < 1 || starsNumber > 5) {
    return { ok: false, error: "invalid_stars", message: "stars må være et heltall fra 1 til 5." };
  }
  let parsedLang: string | null = null;
  if (lang != null && lang !== "") {
    if (typeof lang !== "string" || !LANG_RE.test(lang.trim().toLowerCase())) {
      return { ok: false, error: "invalid_lang", message: "lang må være et BCP 47-tag, f.eks. nb eller en." };
    }
    parsedLang = lang.trim().toLowerCase();
  }
  let parsedComment: string | null = null;
  if (comment != null && comment !== "") {
    if (typeof comment !== "string") {
      return { ok: false, error: "invalid_comment", message: "comment må være tekst." };
    }
    const trimmed = comment.trim();
    if (trimmed.length > RATING_COMMENT_MAX) {
      return { ok: false, error: "invalid_comment", message: `comment kan være maks ${RATING_COMMENT_MAX} tegn.` };
    }
    parsedComment = trimmed === "" ? null : trimmed;
  }
  return { ok: true, value: { deviceId, stars: starsNumber, lang: parsedLang, comment: parsedComment } };
}

/**
 * Enkel in-memory rate-limit (glidende vindu per nøkkel), samme mønster som
 * audio-showcase-routes.ts. Én Render-instans i POC; byttes til delt lager
 * hvis appen får mange brukere.
 */
export function createRateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((ts) => t - ts < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return true;
    }
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > 10_000) {
      for (const [k, v] of hits) {
        if (v.every((ts) => t - ts >= windowMs)) hits.delete(k);
      }
    }
    return false;
  };
}

/** Deep link som iPhone-appen registrerer (CFBundleURLTypes i project.yml). */
export const APP_URL_SCHEME = "senseaidexplore";

export function appDeepLink(slug: string, lang?: string | null): string {
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  return `${APP_URL_SCHEME}://poi/${encodeURIComponent(slug)}${query}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SharePageInput {
  title: string;
  subtitle: string | null;
  summary: string | null;
  locationLabel: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  /** Kreditering av bildet (Commons-lisensen krever den der bildet vises). */
  imageCredit?: { author: string; license: string | null; sourceUrl: string | null } | null;
  lang: string;
  shareUrl: string;
  appUrl: string;
}

/**
 * Delingssiden: liten, selvstendig HTML med Open Graph-metadata så lenken
 * får tittel, ingress og bilde i meldinger, pluss knapp som åpner appen.
 * Ingen eksterne ressurser; farger fra Konsept 2.
 */
/** Faste tekster på delingssiden per språk; engelsk for alt annet. */
const SHARE_PAGE_COPY = {
  nb: {
    openApp: "Åpne i SenseAid Explore",
    tagline: "Lydguide med fortelling, synstolking og teksting.",
    noApp: "Har du ikke appen ennå? SenseAid Explore er under utprøving; lenken virker når appen er installert.",
    photo: "Foto",
  },
  da: {
    openApp: "Åbn i SenseAid Explore",
    tagline: "Lydguide med fortælling, synstolkning og tekstning.",
    noApp: "Har du ikke appen endnu? SenseAid Explore er under afprøvning; linket virker, når appen er installeret.",
    photo: "Foto",
  },
  en: {
    openApp: "Open in SenseAid Explore",
    tagline: "Audio guide with narration, audio description and captions.",
    noApp: "Don't have the app yet? SenseAid Explore is in testing; the link works once the app is installed.",
    photo: "Photo",
  },
} as const;

type SharePageCopy = (typeof SHARE_PAGE_COPY)[keyof typeof SHARE_PAGE_COPY];

function sharePageCopy(lang: string): SharePageCopy {
  const primary = lang.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  if (primary === "nb" || primary === "no" || primary === "nn") return SHARE_PAGE_COPY.nb;
  if (primary === "da") return SHARE_PAGE_COPY.da;
  return SHARE_PAGE_COPY.en;
}

export function renderSharePage(input: SharePageInput): string {
  const copy = sharePageCopy(input.lang);
  const { openApp, tagline, noApp } = copy;
  const title = escapeHtml(input.title);
  const description = escapeHtml(input.summary ?? input.subtitle ?? tagline);
  const image = input.imageUrl
    ? `<meta property="og:image" content="${escapeHtml(input.imageUrl)}">\n    ` +
      `<meta property="og:image:alt" content="${escapeHtml(input.imageAlt ?? input.title)}">\n    `
    : "";
  const heroImage = input.imageUrl
    ? `<img class="hero" src="${escapeHtml(input.imageUrl)}" alt="${escapeHtml(input.imageAlt ?? input.title)}">`
    : "";
  const credit = input.imageUrl && input.imageCredit ? renderImageCredit(input.imageCredit, copy.photo) : "";
  const location = input.locationLabel ? `<p class="meta">${escapeHtml(input.locationLabel)}</p>` : "";
  const subtitle = input.subtitle ? `<p class="subtitle">${escapeHtml(input.subtitle)}</p>` : "";
  return `<!doctype html>
<html lang="${escapeHtml(input.lang)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} · SenseAid Explore</title>
    <meta name="description" content="${description}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="SenseAid Explore">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${escapeHtml(input.shareUrl)}">
    ${image}<meta name="twitter:card" content="${input.imageUrl ? "summary_large_image" : "summary"}">
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; background: #0B1016; color: #F5F3EE; font-family: -apple-system, system-ui, "Segoe UI", sans-serif; }
      main { max-width: 640px; margin: 0 auto; padding: 24px 20px 48px; }
      .hero { width: 100%; border-radius: 20px; display: block; margin-bottom: 20px; }
      .credit { color: #A9B0BA; font-size: 0.85rem; margin: -12px 0 20px; }
      .credit a { color: inherit; }
      h1 { font-size: 2rem; margin: 0 0 4px; }
      .subtitle { color: #A9B0BA; margin: 0 0 12px; font-size: 1.1rem; }
      .meta { color: #7C8591; margin: 0 0 16px; }
      p { line-height: 1.5; }
      .button { display: block; text-align: center; background: #E6D3AE; color: #0B1016; text-decoration: none;
                font-weight: 600; padding: 16px 20px; border-radius: 999px; margin: 24px 0 12px; }
      .note { color: #7C8591; font-size: 0.9rem; }
      footer { margin-top: 32px; color: #7C8591; font-size: 0.85rem; }
    </style>
  </head>
  <body>
    <main>
      ${heroImage}
      ${credit}
      <h1>${title}</h1>
      ${subtitle}
      ${location}
      <p>${description}</p>
      <a class="button" href="${escapeHtml(input.appUrl)}">${openApp}</a>
      <p class="note">${noApp}</p>
      <footer>SenseAid Explore · ${escapeHtml(tagline)}</footer>
    </main>
  </body>
</html>
`;
}

/** «Foto: Navn · CC BY-SA 4.0», lenket til filsiden på Commons når den finnes. */
function renderImageCredit(
  credit: NonNullable<SharePageInput["imageCredit"]>,
  photoLabel: string,
): string {
  const text = escapeHtml(`${photoLabel}: ${credit.author}${credit.license ? ` · ${credit.license}` : ""}`);
  const body = credit.sourceUrl ? `<a href="${escapeHtml(credit.sourceUrl)}">${text}</a>` : text;
  return `<p class="credit">${body}</p>`;
}
