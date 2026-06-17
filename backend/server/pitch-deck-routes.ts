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
}

type SlideType =
  | "problem"
  | "insight"
  | "solution"
  | "demo"
  | "target"
  | "differentiator"
  | "proof"
  | "business"
  | "ask"
  | "custom";

interface GeneratedSlide {
  position: number;
  slide_type: SlideType;
  title_md: string;
  body_md: string;
}

interface DeckRow {
  id: string;
  org_id: string;
  name: string;
  generated_from: unknown;
  status: "draft" | "generating" | "ready" | "archived";
  version: number;
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
  return {
    industry: b.industry,
    one_liner: b.one_liner,
    target_customer: b.target_customer,
    pains: b.pains,
    differentiators: b.differentiators,
    proof_points: b.proof_points,
    locale,
    name,
  };
}

// ─────────────────────────────────────────────────────────────────
// Claude — generér 10 slides fra onboarding-svar
// ─────────────────────────────────────────────────────────────────

const SLIDE_STRUCTURE: SlideType[] = [
  "problem",
  "insight",
  "solution",
  "demo",
  "target",
  "differentiator",
  "proof",
  "business",
  "ask",
];

function buildSystemPrompt(locale: "nb" | "en"): string {
  if (locale === "en") {
    return (
      "You are a senior B2B pitch consultant. Produce slide drafts that " +
      "are concrete and customer-facing, not internal jargon. Each " +
      "title is a short, punchy claim (≤ 8 words). Each body is one " +
      "tight paragraph (50–90 words) that earns the claim with " +
      "specifics drawn from the inputs. Avoid hype, no emojis. Output " +
      "valid JSON only."
    );
  }
  return (
    "Du er en seniorrådgiver i B2B-pitch. Lever utkast som er " +
    "konkret kunde-vendt, ikke internt sjargong. Hver tittel er en " +
    "kort, skarp påstand (≤ 8 ord). Hver brødtekst er ett stramt " +
    "avsnitt (50–90 ord) som forsvarer påstanden med spesifikt " +
    "innhold hentet fra inputtene. Unngå floskler, ingen emojier. " +
    "Returnér kun gyldig JSON."
  );
}

function buildUserPrompt(input: OnboardInput): string {
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
    `Lever et JSON-objekt med feltet "slides", en liste på nøyaktig 9 `,
    `objekter i denne rekkefølgen:`,
    `  ${SLIDE_STRUCTURE.map((t, i) => `${i + 1}. "${t}"`).join("\n  ")}`,
    `Hvert slide-objekt: { "slide_type": "...", "title_md": "...", `,
    `"body_md": "..." }. Bare markdown-tekst i title_md/body_md.`,
  ].join("\n");
}

interface ClaudeSlidesPayload {
  slides: Array<{
    slide_type: string;
    title_md: string;
    body_md: string;
  }>;
}

async function generateSlidesViaClaude(
  input: OnboardInput,
): Promise<GeneratedSlide[]> {
  const result = await callClaudeForJson<ClaudeSlidesPayload>({
    cachedSystem: buildSystemPrompt(input.locale ?? "nb"),
    userMessage: buildUserPrompt(input),
    maxTokens: 3500,
  });
  if (!result.data?.slides || !Array.isArray(result.data.slides)) {
    throw new Error("Claude returnerte ikke 'slides'-array");
  }
  // Map til posisjon 10, 20, 30 … (glissent for innskudd)
  return result.data.slides.slice(0, SLIDE_STRUCTURE.length).map(
    (s, idx): GeneratedSlide => {
      const expectedType = SLIDE_STRUCTURE[idx];
      const slideType = SLIDE_STRUCTURE.includes(s.slide_type as SlideType)
        ? (s.slide_type as SlideType)
        : expectedType;
      return {
        position: (idx + 1) * 10,
        slide_type: slideType,
        title_md: String(s.title_md ?? "").slice(0, 240),
        body_md: String(s.body_md ?? "").slice(0, 2000),
      };
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

async function regenerateSingleSlide(
  input: OnboardInput,
  slide: SlideRow,
  instructions: string,
): Promise<{ title_md: string; body_md: string }> {
  const result = await callClaudeForJson<{ title_md: string; body_md: string }>({
    cachedSystem: buildSystemPrompt(input.locale ?? "nb"),
    userMessage: buildSingleSlidePrompt(
      input,
      slide.slide_type,
      slide.title_md,
      slide.body_md,
      instructions,
    ),
    maxTokens: 1000,
  });
  return {
    title_md: String(result.data.title_md ?? slide.title_md).slice(0, 240),
    body_md: String(result.data.body_md ?? slide.body_md).slice(0, 2000),
  };
}

// ─────────────────────────────────────────────────────────────────
// DB-helpers
// ─────────────────────────────────────────────────────────────────

async function loadDeck(pool: Pool, deckId: string): Promise<DeckRow | null> {
  const r = await pool.query<DeckRow>(
    `SELECT id::text, org_id::text, name, generated_from, status,
            version, last_used_at::text, created_at::text, updated_at::text
       FROM pitch_decks WHERE id = $1`,
    [deckId],
  );
  return r.rows[0] ?? null;
}

async function loadSlides(pool: Pool, deckId: string): Promise<SlideRow[]> {
  const r = await pool.query<SlideRow>(
    `SELECT id::text, deck_id::text, position, slide_type, title_md,
            body_md, visual_url, locked_by_user, locked_at::text,
            updated_at::text
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
         (deck_id, position, slide_type, title_md, body_md)
       VALUES ($1, $2, $3, $4, $5)`,
      [deckId, s.position, s.slide_type, s.title_md, s.body_md],
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
            ? `SELECT id::text, org_id::text, name, generated_from, status,
                       version, last_used_at::text,
                       created_at::text, updated_at::text
                 FROM pitch_decks
                WHERE org_id = $1 AND status <> 'archived'
                ORDER BY last_used_at DESC NULLS LAST, created_at DESC`
            : `SELECT id::text, org_id::text, name, generated_from, status,
                       version, last_used_at::text,
                       created_at::text, updated_at::text
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

        // Opprett deck med status='generating' så UI'et kan polle
        const deckRes = await client.query<{ id: string }>(
          `INSERT INTO pitch_decks
             (org_id, name, generated_from, status, created_by)
           VALUES ($1, $2, $3::jsonb, 'generating', $4)
           RETURNING id::text`,
          [orgId, validated.name, JSON.stringify(validated), session.userId],
        );
        const deckId = deckRes.rows[0].id;

        let slides: GeneratedSlide[];
        try {
          slides = await generateSlidesViaClaude(validated);
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
            RETURNING id::text, org_id::text, name, generated_from, status,
                      version, last_used_at::text,
                      created_at::text, updated_at::text`,
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
            RETURNING id::text, deck_id::text, position, slide_type,
                      title_md, body_md, visual_url,
                      locked_by_user, locked_at::text, updated_at::text`,
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
        const upd = await pool.query<SlideRow>(
          `UPDATE pitch_slides
              SET title_md = $1, body_md = $2,
                  locked_by_user = NULL, locked_at = NULL
            WHERE id = $3
            RETURNING id::text, deck_id::text, position, slide_type,
                      title_md, body_md, visual_url,
                      locked_by_user, locked_at::text, updated_at::text`,
          [regen.title_md, regen.body_md, req.params.id],
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
