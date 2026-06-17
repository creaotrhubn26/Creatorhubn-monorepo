/**
 * pitch-deck-routes.ts
 *
 * Pitch Deck Studio — multi-tenant pitch-decks som genereres fra hva
 * organisasjonen selger, brukes i salgsmøter på iPad (sveip + Pencil),
 * og som kan eksporteres til PDF for å sendes til kunden.
 *
 * Endepunkter (alle under /api/admin-room/lead-map/pitch-deck/):
 *   GET    /decks                        Liste org's decks (RBAC: access)
 *   POST   /decks/onboard                Lag nytt deck fra wizard-svar +
 *                                        Claude-generér 10 slides (RBAC: edit)
 *   GET    /decks/:id                    Hent deck m/ slides (RBAC: access)
 *   PATCH  /decks/:id                    Endre deck-metadata (RBAC: edit)
 *   POST   /decks/:id/regenerate         Regenerér alle slides fra
 *                                        generated_from (RBAC: edit)
 *   PATCH  /slides/:id                   Endre slide-innhold (RBAC: edit)
 *   POST   /slides/:id/regenerate        Regenerér én slide (RBAC: edit)
 *   POST   /slides/:id/lock              Lås slide mot auto-regen (RBAC: edit)
 *   POST   /presentations                Start ny presentasjon-sesjon
 *                                        (RBAC: access)
 *   PATCH  /presentations/:id            Lagre slides_shown/annotations/
 *                                        outcome (RBAC: access)
 *   POST   /exports                      Eksportér deck til PDF (RBAC: export)
 *
 * RBAC:
 *   pitch_deck.access — alle endepunkter unntatt export-spesifikke
 *   pitch_deck.edit   — onboard/regenerate/slide-PATCH
 *   pitch_deck.export — POST /exports
 *
 * Eksport- og tracking-pixel-routes ligger separat i
 * pitch-deck-pdf-service.ts (registreres parallelt).
 */

import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { callClaudeForJson, ClaudeJsonParseError } from "./claude-json-helper.js";
import { fetchCoverData } from "./pitch-deck-cover-fetcher.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

// ─────────────────────────────────────────────────────────────────
// Typer
// ─────────────────────────────────────────────────────────────────

interface OnboardInput {
  industry: string;
  one_liner: string;
  target_customer: string;
  pains: [string, string, string];
  differentiators: [string, string, string];
  proof_points: [string, string, string];
  locale?: "nb" | "en";
  name?: string;
  format?: "long" | "short";
  website_url?: string;  // For cover-logo + tagline auto-fetch
}

type SlideType =
  // Pitch-spec etter mig 0295:
  | "cover"
  | "intro"
  | "problem"
  | "current_friction"
  | "solution"
  | "how_it_works"
  | "core_features"
  | "before_after"
  | "value"
  | "pilot"
  | "next_step"
  // Bakoverkompatibel:
  | "insight" | "demo" | "target" | "differentiator" | "proof"
  | "business" | "ask" | "custom";

interface SlideBullet {
  icon: string;       // SF Symbol-navn — vises i ipad-renderer
  label: string;      // kort label (1-3 ord)
  body?: string;      // valgfri brødtekst (1 setning)
}

interface BeforeAfter {
  before: string[];   // typisk 3-5 punkter
  after: string[];    // tilsvarende 3-5 punkter
}

interface GeneratedSlide {
  position: number;
  slide_type: SlideType;
  title_md: string;
  body_md: string;
  /** Den ene ideen i én setning — brukes av live AI-cue. */
  one_idea?: string;
  /** Kun for core_features. */
  bullets?: SlideBullet[];
  /** Kun for before_after. */
  before_after?: BeforeAfter;
}

interface DeckRow {
  id: string;
  org_id: string;
  name: string;
  generated_from: unknown;
  status: "draft" | "generating" | "ready" | "archived";
  version: number;
  format: "long" | "short";
  cover_logo_url: string | null;
  cover_tagline: string | null;
  cover_fetched_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SlideRow {
  id: string;
  deck_id: string;
  position: number;
  slide_type: SlideType;
  title_md: string;
  body_md: string;
  visual_url: string | null;
  one_idea: string | null;
  bullets: unknown;        // JSONB
  before_after: unknown;   // JSONB
  mockup_urls: unknown;    // JSONB
  locked_by_user: string | null;
  locked_at: string | null;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────
// Validering
// ─────────────────────────────────────────────────────────────────

function isStr(value: unknown, maxLen = 500): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLen;
}

function isTriple(value: unknown, maxLen = 300): value is [string, string, string] {
  return Array.isArray(value) && value.length === 3 && value.every((v) => isStr(v, maxLen));
}

function validateOnboardInput(body: unknown): OnboardInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" };
  const b = body as Record<string, unknown>;
  if (!isStr(b.industry, 120)) return { error: "industry påkrevd (1-120 tegn)" };
  if (!isStr(b.one_liner, 280)) return { error: "one_liner påkrevd (1-280 tegn)" };
  if (!isStr(b.target_customer, 280)) return { error: "target_customer påkrevd" };
  if (!isTriple(b.pains)) return { error: "pains må være 3 strenger" };
  if (!isTriple(b.differentiators)) return { error: "differentiators må være 3 strenger" };
  if (!isTriple(b.proof_points)) return { error: "proof_points må være 3 strenger" };
  const locale = b.locale === "en" ? "en" : "nb";
  const name = typeof b.name === "string" && b.name.trim().length > 0
    ? b.name.trim().slice(0, 120)
    : "Master pitch";
  const format = b.format === "short" ? "short" : "long";
  const website_url = typeof b.website_url === "string" && b.website_url.length > 0
    ? b.website_url.slice(0, 500)
    : undefined;
  return {
    industry: b.industry,
    one_liner: b.one_liner,
    target_customer: b.target_customer,
    pains: b.pains,
    differentiators: b.differentiators,
    proof_points: b.proof_points,
    locale,
    name,
    format,
    website_url,
  };
}

// ─────────────────────────────────────────────────────────────────
// Claude — generér 10 slides fra onboarding-svar
// ─────────────────────────────────────────────────────────────────

/** Master-strukturen (11 slides) — fast fortelling fra logo til CTA. */
const MASTER_STRUCTURE: SlideType[] = [
  "cover",            // 1. Logo + tagline
  "intro",            // 2. Hva produktet er (én setning)
  "problem",          // 3. Problemet — hvorfor det trengs
  "current_friction", // 4. Hvorfor dagens løsninger ikke er nok
  "solution",         // 5. Løsningen som helhetlig system
  "how_it_works",     // 6. Produktflyt + mockup
  "core_features",    // 7. Kjernefunksjoner — ikoner + labels
  "before_after",     // 8. Før/etter — to kolonner
  "value",            // 9. Verdien — lead-tilpasset
  "pilot",            // 10. Pilot / lav-terskel start
  "next_step",        // 11. CTA
];

/** Kortversjon (10 slides) — Drop core_features siden before_after
 *  dekker mye av samme. Brukes i møtebruk per Daniels retningslinje. */
const SHORT_STRUCTURE: SlideType[] = [
  "cover", "intro", "problem", "current_friction",
  "solution", "how_it_works", "before_after",
  "value", "pilot", "next_step",
];

function structureFor(format: "long" | "short"): SlideType[] {
  return format === "short" ? SHORT_STRUCTURE : MASTER_STRUCTURE;
}

function buildSystemPrompt(locale: "nb" | "en"): string {
  if (locale === "en") {
    return [
      "You are a senior B2B pitch architect. You write decks for premium",
      "in-person sales meetings: dark, short, visual, with one idea per",
      "slide. Hard rules you cannot break:",
      "  - ONE idea per slide. If you must say two things, the slide is wrong.",
      "  - Title is a punchy claim, ≤ 8 words.",
      "  - Body is at most ~40 words — enough to earn the title, not more.",
      "  - No hype, no emojis, no internal jargon. Customer language.",
      "  - For 'core_features': return a bullets[] of {icon, label, body?}",
      "    where icon is an SF Symbol name (e.g. 'rectangle.stack',",
      "    'chart.bar', 'lock.shield', 'arrow.triangle.branch'),",
      "    label is 1–3 words. FORBIDDEN: 'sparkles', 'wand.and.stars',",
      "    'sparkle', 'star.circle', or any 'AI-magic' icons. Use concrete",
      "    business icons that describe the actual function. No prose.",
      "  - For 'before_after': return before[] and after[] of 3–5 short",
      "    phrases each (max ~6 words). Mirror them positionally.",
      "  - For 'cover': leave title/body empty; cover renders org logo+tagline.",
      "  - Always include 'one_idea' — one sentence that captures the slide's",
      "    single point. Used live to detect topic switches in conversation.",
      "Output valid JSON only.",
    ].join(" ");
  }
  return [
    "Du er en senior B2B-pitch-arkitekt. Du lager decks for premium",
    "in-person salgsmøter: mørkt, kort, visuelt, én idé per slide.",
    "Faste regler du IKKE kan bryte:",
    "  - ÉN idé per slide. Må du si to ting, er sliden feil.",
    "  - Tittel er en skarp påstand, ≤ 8 ord.",
    "  - Brødtekst er maks ~40 ord — nok til å forsvare tittelen, ikke mer.",
    "  - Ingen floskler, ingen emojier, ingen internt sjargong. Kunde-språk.",
    "  - For 'core_features': returnér bullets[] av {icon, label, body?}",
    "    hvor icon er et SF Symbol-navn (f.eks. 'rectangle.stack',",
    "    'chart.bar', 'lock.shield', 'arrow.triangle.branch',",
    "    'square.grid.3x3.fill', 'doc.plaintext'), label er 1–3 ord.",
    "    FORBUDT: 'sparkles', 'wand.and.stars', 'sparkle', 'star.circle',",
    "    eller andre 'AI-magic'-ikoner. Bruk konkrete forretnings-ikoner",
    "    som beskriver den faktiske funksjonen. Ikke prosatekst.",
    "  - For 'before_after': returnér before[] og after[] med 3–5 korte",
    "    fraser hver (maks ~6 ord). Speil dem posisjonelt så",
    "    before[0] kontrasterer mot after[0].",
    "  - For 'cover': la title/body være tomme; cover renderer logo+tagline.",
    "  - Inkludér ALLTID 'one_idea' — én setning som fanger den ene",
    "    ideen på sliden. Brukes live til å oppdage tema-skifter i samtalen.",
    "Returnér kun gyldig JSON.",
  ].join(" ");
}

function buildUserPrompt(input: OnboardInput, structure: SlideType[]): string {
  const slideHints: Record<string, string> = {
    cover:            "Tom title/body — rendres som logo + tagline.",
    intro:            "Hva er produktet i én setning. Klart kunde-språk.",
    problem:          "Vis problemet kunden kjenner igjen. Ingen produktomtale her.",
    current_friction: "Hvorfor dagens måte ikke holder. Konkret eksempel.",
    solution:         "Produktet som helhetlig system. Vis flyten kort.",
    how_it_works:     "Hvordan det fungerer i praksis. (Mockup vises på sliden.)",
    core_features:    "BULLETS — 4–6 ikoner + labels. Ikke prosatekst.",
    before_after:     "BEFORE_AFTER — to kolonner, 3–5 punkter hver. Speilet.",
    value:            "Verdi i forretningstall. Skal tilpasses leads senere.",
    pilot:            "Lav-terskel start. Hva piloten består av + tid.",
    next_step:        "Tydelig CTA + det selger trenger fra kunden.",
  };
  const numbered = structure.map((t, i) =>
    `  ${i + 1}. "${t}"  — ${slideHints[t] ?? ""}`,
  ).join("\n");
  return [
    `Industri: ${input.industry}`,
    `Hva de selger (én setning): ${input.one_liner}`,
    `Målgruppe: ${input.target_customer}`,
    `Kunde-smerter:`,
    `  1. ${input.pains[0]}`,
    `  2. ${input.pains[1]}`,
    `  3. ${input.pains[2]}`,
    `Differensiatorer:`,
    `  1. ${input.differentiators[0]}`,
    `  2. ${input.differentiators[1]}`,
    `  3. ${input.differentiators[2]}`,
    `Bevis (kunder/tall/sertifikater):`,
    `  1. ${input.proof_points[0]}`,
    `  2. ${input.proof_points[1]}`,
    `  3. ${input.proof_points[2]}`,
    ``,
    `Lever et JSON-objekt med feltet "slides", en liste på nøyaktig ` +
    `${structure.length} objekter i denne rekkefølgen:`,
    numbered,
    ``,
    `Hvert slide-objekt har feltene:`,
    `  { "slide_type": "...", "title_md": "...", "body_md": "...",`,
    `    "one_idea": "..." }`,
    `For 'core_features' inkludér også: "bullets": [{"icon":"...","label":"...","body":"..."}]`,
    `For 'before_after' inkludér også: "before_after": {"before":["..."], "after":["..."]}`,
    `For 'cover' la title_md og body_md være tomme strenger.`,
    `Husk: én idé per slide. Maks ~40 ord body. Ingen emojier.`,
  ].join("\n");
}

interface ClaudeSlidesPayload {
  slides: Array<{
    slide_type: string;
    title_md?: string;
    body_md?: string;
    one_idea?: string;
    bullets?: Array<{ icon?: string; label?: string; body?: string }>;
    before_after?: { before?: unknown; after?: unknown };
  }>;
}

function sanitizeBullets(raw: unknown): SlideBullet[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).map((b) => {
    const obj = (b && typeof b === "object") ? b as Record<string, unknown> : {};
    return {
      icon: String(obj.icon ?? "circle.fill").slice(0, 60),
      label: String(obj.label ?? "").slice(0, 60),
      body: typeof obj.body === "string" ? obj.body.slice(0, 200) : undefined,
    };
  }).filter((b) => b.label.length > 0);
}

function sanitizeBeforeAfter(raw: unknown): BeforeAfter {
  const obj = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};
  const toArr = (v: unknown): string[] => Array.isArray(v)
    ? v.slice(0, 6).map((s) => String(s).slice(0, 80)).filter((s) => s.length > 0)
    : [];
  return { before: toArr(obj.before), after: toArr(obj.after) };
}

async function generateSlidesViaClaude(
  input: OnboardInput,
  format: "long" | "short",
): Promise<GeneratedSlide[]> {
  const structure = structureFor(format);
  const result = await callClaudeForJson<ClaudeSlidesPayload>({
    cachedSystem: buildSystemPrompt(input.locale ?? "nb"),
    userMessage: buildUserPrompt(input, structure),
    maxTokens: 4500,
  });
  if (!result.data?.slides || !Array.isArray(result.data.slides)) {
    throw new Error("Claude returnerte ikke 'slides'-array");
  }
  // Map til posisjon 10, 20, 30 … (glissent for innskudd)
  return result.data.slides.slice(0, structure.length).map(
    (s, idx): GeneratedSlide => {
      const expectedType = structure[idx];
      const slideType = structure.includes(s.slide_type as SlideType)
        ? (s.slide_type as SlideType)
        : expectedType;
      const generated: GeneratedSlide = {
        position: (idx + 1) * 10,
        slide_type: slideType,
        title_md: String(s.title_md ?? "").slice(0, 240),
        body_md: String(s.body_md ?? "").slice(0, 2000),
      };
      if (typeof s.one_idea === "string" && s.one_idea.trim().length > 0) {
        generated.one_idea = s.one_idea.slice(0, 240);
      }
      if (slideType === "core_features" && s.bullets) {
        generated.bullets = sanitizeBullets(s.bullets);
      }
      if (slideType === "before_after" && s.before_after) {
        generated.before_after = sanitizeBeforeAfter(s.before_after);
      }
      return generated;
    },
  );
}

// Single-slide regen (når brukeren misliker én av de 9)
function buildSingleSlidePrompt(
  input: OnboardInput,
  slideType: SlideType,
  prevTitle: string,
  prevBody: string,
  instructions: string,
): string {
  return [
    `Industri: ${input.industry}`,
    `Hva de selger: ${input.one_liner}`,
    `Målgruppe: ${input.target_customer}`,
    `Smerter: ${input.pains.join(" · ")}`,
    `Differensiatorer: ${input.differentiators.join(" · ")}`,
    `Bevis: ${input.proof_points.join(" · ")}`,
    ``,
    `Slide-type: "${slideType}"`,
    `Forrige versjon (ikke beholdes hvis den ikke er bra nok):`,
    `  Tittel: ${prevTitle || "(tom)"}`,
    `  Brødtekst: ${prevBody || "(tom)"}`,
    ``,
    `Justerings-instruks fra bruker: ${instructions || "Skarpere, mer konkret."}`,
    ``,
    `Returnér ett JSON-objekt: { "title_md": "...", "body_md": "..." }.`,
  ].join("\n");
}

interface SingleSlideRegenResult {
  title_md: string;
  body_md: string;
  one_idea?: string;
  bullets?: SlideBullet[];
  before_after?: BeforeAfter;
}

async function regenerateSingleSlide(
  input: OnboardInput,
  slide: SlideRow,
  instructions: string,
): Promise<SingleSlideRegenResult> {
  const result = await callClaudeForJson<{
    title_md?: string;
    body_md?: string;
    one_idea?: string;
    bullets?: unknown;
    before_after?: unknown;
  }>({
    cachedSystem: buildSystemPrompt(input.locale ?? "nb"),
    userMessage: buildSingleSlidePrompt(
      input,
      slide.slide_type,
      slide.title_md,
      slide.body_md,
      instructions,
    ),
    maxTokens: 1200,
  });
  const out: SingleSlideRegenResult = {
    title_md: String(result.data.title_md ?? slide.title_md).slice(0, 240),
    body_md: String(result.data.body_md ?? slide.body_md).slice(0, 2000),
  };
  if (typeof result.data.one_idea === "string" && result.data.one_idea.trim().length > 0) {
    out.one_idea = result.data.one_idea.slice(0, 240);
  }
  if (slide.slide_type === "core_features" && result.data.bullets) {
    out.bullets = sanitizeBullets(result.data.bullets);
  }
  if (slide.slide_type === "before_after" && result.data.before_after) {
    out.before_after = sanitizeBeforeAfter(result.data.before_after);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// DB-helpers
// ─────────────────────────────────────────────────────────────────

const DECK_SELECT = `
  id::text, org_id::text, name, generated_from, status, version,
  format, cover_logo_url, cover_tagline, cover_fetched_at::text,
  last_used_at::text, created_at::text, updated_at::text
`;

const SLIDE_SELECT = `
  id::text, deck_id::text, position, slide_type, title_md, body_md,
  visual_url, one_idea, bullets, before_after, mockup_urls,
  locked_by_user, locked_at::text, updated_at::text
`;

async function loadDeck(pool: Pool, deckId: string): Promise<DeckRow | null> {
  const r = await pool.query<DeckRow>(
    `SELECT ${DECK_SELECT} FROM pitch_decks WHERE id = $1`,
    [deckId],
  );
  return r.rows[0] ?? null;
}

async function loadSlides(pool: Pool, deckId: string): Promise<SlideRow[]> {
  const r = await pool.query<SlideRow>(
    `SELECT ${SLIDE_SELECT}
       FROM pitch_slides WHERE deck_id = $1 ORDER BY position ASC`,
    [deckId],
  );
  return r.rows;
}

async function insertSlides(
  client: PoolClient,
  deckId: string,
  slides: GeneratedSlide[],
): Promise<void> {
  for (const s of slides) {
    await client.query(
      `INSERT INTO pitch_slides
         (deck_id, position, slide_type, title_md, body_md,
          one_idea, bullets, before_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
      [
        deckId, s.position, s.slide_type, s.title_md, s.body_md,
        s.one_idea ?? null,
        JSON.stringify(s.bullets ?? []),
        JSON.stringify(s.before_after ?? {}),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Registrering
// ─────────────────────────────────────────────────────────────────

export function registerPitchDeckRoutes({ app, pool, activeSessions }: Deps): void {
  const ROOT = "/api/admin-room/lead-map/pitch-deck";

  // ─── GET /availability ─────────────────────────────────────────
  // Lett-vekts sjekk som iPad-lead-detail kaller for å avgjøre om
  // "Presenter pitch"-knappen skal vises i prosjekt-kortet. Krever
  // pitch_deck.access. Returnerer { available, deck_id, deck_name,
  // status, slide_count } slik at iPad-en kan navigere direkte til
  // POST /presentations uten en ekstra rundtur.
  app.get(
    `${ROOT}/availability`,
    requireLeadMapPermission("pitch_deck.access", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const orgId = typeof req.query.organization_id === "string"
        ? req.query.organization_id
        : null;
      if (!orgId) return res.status(400).json({ error: "organization_id påkrevd" });
      try {
        const r = await pool.query<{
          id: string; name: string; status: string; slide_count: string;
        }>(
          `SELECT d.id::text, d.name, d.status,
                  COUNT(s.id)::text AS slide_count
             FROM pitch_decks d
             LEFT JOIN pitch_slides s ON s.deck_id = d.id
            WHERE d.org_id = $1 AND d.status = 'ready'
            GROUP BY d.id
            ORDER BY d.last_used_at DESC NULLS LAST, d.created_at DESC
            LIMIT 1`,
          [orgId],
        );
        if (r.rows.length === 0) {
          return res.json({ available: false });
        }
        const row = r.rows[0];
        return res.json({
          available: true,
          deck_id: row.id,
          deck_name: row.name,
          status: row.status,
          slide_count: Number(row.slide_count),
        });
      } catch (err) {
        return res.status(500).json({ error: "availability_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /decks ────────────────────────────────────────────────
  app.get(
    `${ROOT}/decks`,
    requireLeadMapPermission("pitch_deck.access", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const orgId = typeof req.query.organization_id === "string"
        ? req.query.organization_id
        : null;
      try {
        const r = await pool.query<DeckRow>(
          orgId
            ? `SELECT ${DECK_SELECT}
                 FROM pitch_decks
                WHERE org_id = $1 AND status <> 'archived'
                ORDER BY last_used_at DESC NULLS LAST, created_at DESC`
            : `SELECT ${DECK_SELECT}
                 FROM pitch_decks WHERE status <> 'archived'
                ORDER BY last_used_at DESC NULLS LAST, created_at DESC
                LIMIT 50`,
          orgId ? [orgId] : [],
        );
        return res.json({ decks: r.rows });
      } catch (err) {
        return res.status(500).json({ error: "list_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /decks/onboard ───────────────────────────────────────
  app.post(
    `${ROOT}/decks/onboard`,
    requireLeadMapPermission("pitch_deck.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = activeSessions.get(
        (req.headers.authorization ?? "").replace("Bearer ", ""),
      );
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

      const orgId =
        typeof req.body?.organization_id === "string" ? req.body.organization_id : null;
      if (!orgId) return res.status(400).json({ error: "organization_id påkrevd" });

      const validated = validateOnboardInput(req.body);
      if ("error" in validated) return res.status(400).json({ error: validated.error });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Opprett deck med status='generating' så UI'et kan polle.
        // format + ev. website_url settes fra wizard-svaret. cover_logo +
        // cover_tagline fylles asynkront etter at klienten har fått svar.
        const deckRes = await client.query<{ id: string }>(
          `INSERT INTO pitch_decks
             (org_id, name, generated_from, status, created_by, format)
           VALUES ($1, $2, $3::jsonb, 'generating', $4, $5)
           RETURNING id::text`,
          [orgId, validated.name, JSON.stringify(validated), session.userId,
            validated.format ?? "long"],
        );
        const deckId = deckRes.rows[0].id;

        let slides: GeneratedSlide[];
        try {
          slides = await generateSlidesViaClaude(
            validated, validated.format ?? "long",
          );
        } catch (err) {
          await client.query(
            `UPDATE pitch_decks SET status = 'draft' WHERE id = $1`,
            [deckId],
          );
          await client.query("COMMIT");
          if (err instanceof ClaudeJsonParseError) {
            return res.status(502).json({
              error: "claude_invalid_json",
              deck_id: deckId,
              raw_preview: err.raw.slice(0, 400),
            });
          }
          return res.status(502).json({
            error: "claude_failed",
            deck_id: deckId,
            detail: String(err),
          });
        }

        await insertSlides(client, deckId, slides);
        await client.query(
          `UPDATE pitch_decks SET status = 'ready' WHERE id = $1`,
          [deckId],
        );
        await client.query("COMMIT");

        // Fire-and-forget cover-fetch så onboard-svaret ikke blokkes på
        // en treig kunde-website. Frontend poller deck.cover_logo_url
        // hvis hen vil vente.
        if (validated.website_url) {
          void (async () => {
            try {
              const cover = await fetchCoverData(validated.website_url!);
              if (cover.logo_url || cover.tagline) {
                await pool.query(
                  `UPDATE pitch_decks
                      SET cover_logo_url = COALESCE($2, cover_logo_url),
                          cover_tagline  = COALESCE($3, cover_tagline),
                          cover_fetched_at = now()
                    WHERE id = $1`,
                  [deckId, cover.logo_url, cover.tagline],
                );
              }
            } catch { /* tystefall — UI lar bruker skrive manuelt */ }
          })();
        }

        const deck = await loadDeck(pool, deckId);
        const slideRows = await loadSlides(pool, deckId);
        return res.status(201).json({ deck, slides: slideRows });
      } catch (err) {
        try { await client.query("ROLLBACK"); } catch { /* noop */ }
        return res.status(500).json({ error: "onboard_failed", detail: String(err) });
      } finally {
        client.release();
      }
    },
  );

  // ─── GET /decks/:id ────────────────────────────────────────────
  app.get(
    `${ROOT}/decks/:id`,
    requireLeadMapPermission("pitch_deck.access", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      try {
        const deck = await loadDeck(pool, req.params.id);
        if (!deck) return res.status(404).json({ error: "deck_not_found" });
        const slides = await loadSlides(pool, req.params.id);
        return res.json({ deck, slides });
      } catch (err) {
        return res.status(500).json({ error: "load_failed", detail: String(err) });
      }
    },
  );

  // ─── PATCH /decks/:id ──────────────────────────────────────────
  // Endre name og/eller status (archive). generated_from kan ikke
  // endres direkte — bruk /regenerate.
  app.patch(
    `${ROOT}/decks/:id`,
    requireLeadMapPermission("pitch_deck.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const updates: string[] = [];
      const params: unknown[] = [];
      if (typeof req.body?.name === "string" && req.body.name.trim().length > 0) {
        params.push(req.body.name.trim().slice(0, 120));
        updates.push(`name = $${params.length}`);
      }
      if (req.body?.status === "archived" || req.body?.status === "ready") {
        params.push(req.body.status);
        updates.push(`status = $${params.length}`);
      }
      if (updates.length === 0) return res.status(400).json({ error: "no_changes" });
      params.push(req.params.id);
      try {
        const r = await pool.query<DeckRow>(
          `UPDATE pitch_decks SET ${updates.join(", ")}
            WHERE id = $${params.length}
            RETURNING ${DECK_SELECT}`,
          params,
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "deck_not_found" });
        return res.json({ deck: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "update_failed", detail: String(err) });
      }
    },
  );

  // ─── PATCH /slides/:id ─────────────────────────────────────────
  app.patch(
    `${ROOT}/slides/:id`,
    requireLeadMapPermission("pitch_deck.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = activeSessions.get(
        (req.headers.authorization ?? "").replace("Bearer ", ""),
      );
      const updates: string[] = [];
      const params: unknown[] = [];
      if (typeof req.body?.title_md === "string") {
        params.push(req.body.title_md.slice(0, 240));
        updates.push(`title_md = $${params.length}`);
      }
      if (typeof req.body?.body_md === "string") {
        params.push(req.body.body_md.slice(0, 2000));
        updates.push(`body_md = $${params.length}`);
      }
      if (typeof req.body?.visual_url === "string" || req.body?.visual_url === null) {
        params.push(req.body.visual_url);
        updates.push(`visual_url = $${params.length}`);
      }
      if (updates.length === 0) return res.status(400).json({ error: "no_changes" });

      // Manuell redigering låser sliden mot fremtidig auto-regen
      if (session?.userId) {
        params.push(session.userId);
        updates.push(`locked_by_user = $${params.length}`);
        updates.push(`locked_at = now()`);
      }
      params.push(req.params.id);
      try {
        const r = await pool.query<SlideRow>(
          `UPDATE pitch_slides SET ${updates.join(", ")}
            WHERE id = $${params.length}
            RETURNING ${SLIDE_SELECT}`,
          params,
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "slide_not_found" });
        return res.json({ slide: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "update_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /slides/:id/regenerate ───────────────────────────────
  app.post(
    `${ROOT}/slides/:id/regenerate`,
    requireLeadMapPermission("pitch_deck.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      try {
        // Hent slide + deck for å gjenbruke generated_from-konteksten
        const slideRes = await pool.query<SlideRow & { generated_from: unknown }>(
          `SELECT s.id::text, s.deck_id::text, s.position, s.slide_type,
                  s.title_md, s.body_md, s.visual_url,
                  s.one_idea, s.bullets, s.before_after, s.mockup_urls,
                  s.locked_by_user, s.locked_at::text, s.updated_at::text,
                  d.generated_from
             FROM pitch_slides s
             JOIN pitch_decks d ON d.id = s.deck_id
            WHERE s.id = $1`,
          [req.params.id],
        );
        if (slideRes.rows.length === 0) {
          return res.status(404).json({ error: "slide_not_found" });
        }
        const row = slideRes.rows[0];
        const generated = row.generated_from as Partial<OnboardInput>;
        // Hvis decket aldri ble onboardet (custom deck) — krever manuell input
        if (!generated?.industry) {
          return res.status(400).json({
            error: "deck_har_ikke_onboarding_data",
            hint: "Bruk PATCH /slides/:id for manuell redigering",
          });
        }
        const instructions =
          typeof req.body?.instructions === "string" ? req.body.instructions : "";
        const regen = await regenerateSingleSlide(
          generated as OnboardInput, row, instructions,
        );
        // Skriv tilbake; lås av siden Claude eier den nå
        // Bevar nye JSONB-felter når de finnes i regen-resultatet
        const upd = await pool.query<SlideRow>(
          `UPDATE pitch_slides
              SET title_md = $1, body_md = $2,
                  one_idea = COALESCE($3, one_idea),
                  bullets = CASE WHEN $4::jsonb IS NULL THEN bullets ELSE $4::jsonb END,
                  before_after = CASE WHEN $5::jsonb IS NULL THEN before_after ELSE $5::jsonb END,
                  locked_by_user = NULL, locked_at = NULL
            WHERE id = $6
            RETURNING ${SLIDE_SELECT}`,
          [
            regen.title_md,
            regen.body_md,
            regen.one_idea ?? null,
            regen.bullets ? JSON.stringify(regen.bullets) : null,
            regen.before_after ? JSON.stringify(regen.before_after) : null,
            req.params.id,
          ],
        );
        return res.json({ slide: upd.rows[0] });
      } catch (err) {
        if (err instanceof ClaudeJsonParseError) {
          return res.status(502).json({
            error: "claude_invalid_json",
            raw_preview: err.raw.slice(0, 400),
          });
        }
        return res.status(500).json({ error: "regenerate_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /slides/:id/lock ─────────────────────────────────────
  app.post(
    `${ROOT}/slides/:id/lock`,
    requireLeadMapPermission("pitch_deck.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = activeSessions.get(
        (req.headers.authorization ?? "").replace("Bearer ", ""),
      );
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const lock = req.body?.locked !== false;
      try {
        const r = await pool.query(
          lock
            ? `UPDATE pitch_slides
                  SET locked_by_user = $1, locked_at = now()
                WHERE id = $2 RETURNING id`
            : `UPDATE pitch_slides
                  SET locked_by_user = NULL, locked_at = NULL
                WHERE id = $2 RETURNING id`,
          [session.userId, req.params.id],
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "slide_not_found" });
        return res.json({ ok: true, locked: lock });
      } catch (err) {
        return res.status(500).json({ error: "lock_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /presentations ───────────────────────────────────────
  app.post(
    `${ROOT}/presentations`,
    requireLeadMapPermission("pitch_deck.access", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = activeSessions.get(
        (req.headers.authorization ?? "").replace("Bearer ", ""),
      );
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const deckId = typeof req.body?.deck_id === "string" ? req.body.deck_id : null;
      if (!deckId) return res.status(400).json({ error: "deck_id påkrevd" });
      const leadId = typeof req.body?.lead_id === "string" ? req.body.lead_id : null;
      try {
        const r = await pool.query<{ id: string; started_at: string }>(
          `INSERT INTO pitch_deck_presentations
             (deck_id, user_id, lead_id)
           VALUES ($1, $2, $3)
           RETURNING id::text, started_at::text`,
          [deckId, session.userId, leadId],
        );
        // Touch deck.last_used_at
        await pool.query(
          `UPDATE pitch_decks SET last_used_at = now() WHERE id = $1`,
          [deckId],
        );
        return res.status(201).json({ presentation: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "presentation_start_failed", detail: String(err) });
      }
    },
  );

  // ─── PATCH /presentations/:id ──────────────────────────────────
  // Mater inn slides_shown, annotations, outcome — og avslutt sesjonen.
  app.patch(
    `${ROOT}/presentations/:id`,
    requireLeadMapPermission("pitch_deck.access", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const updates: string[] = [];
      const params: unknown[] = [];
      if (Array.isArray(req.body?.slides_shown)) {
        params.push(req.body.slides_shown.filter((s: unknown) => typeof s === "string"));
        updates.push(`slides_shown = $${params.length}::uuid[]`);
      }
      if (req.body?.annotations && typeof req.body.annotations === "object") {
        params.push(JSON.stringify(req.body.annotations));
        updates.push(`annotations = $${params.length}::jsonb`);
      }
      const ALLOWED_OUTCOMES = new Set([
        "demo_booked", "interested", "more_info", "lost", "follow_up",
      ]);
      if (typeof req.body?.outcome === "string" && ALLOWED_OUTCOMES.has(req.body.outcome)) {
        params.push(req.body.outcome);
        updates.push(`outcome = $${params.length}`);
      }
      if (typeof req.body?.outcome_note === "string") {
        params.push(req.body.outcome_note.slice(0, 1000));
        updates.push(`outcome_note = $${params.length}`);
      }
      if (req.body?.end === true) {
        updates.push(`ended_at = now()`);
      }
      if (updates.length === 0) return res.status(400).json({ error: "no_changes" });
      params.push(req.params.id);
      try {
        const r = await pool.query(
          `UPDATE pitch_deck_presentations SET ${updates.join(", ")}
            WHERE id = $${params.length}
            RETURNING id::text, deck_id::text, lead_id, slides_shown,
                      outcome, outcome_note,
                      started_at::text, ended_at::text`,
          params,
        );
        if (r.rows.length === 0) {
          return res.status(404).json({ error: "presentation_not_found" });
        }
        return res.json({ presentation: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "presentation_update_failed", detail: String(err) });
      }
    },
  );
}
