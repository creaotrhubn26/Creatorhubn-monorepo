/**
 * pitch-deck-brief-routes.ts
 *
 * Habit-loop-utvidelser for Pitch Deck Studio:
 *
 *   POST /api/admin-room/lead-map/pitch-deck/presentations/brief
 *     Pre-møte-brief. Claude pre-velger 5–7 slides relevante for denne
 *     leaden + leverer talking points + 3 forventede objections med
 *     svar. Lagres på pitch_deck_presentations.pre_meeting_brief.
 *
 *   POST /api/admin-room/lead-map/pitch-deck/decks/:id/value-slide/for-lead
 *     Per-lead Verdien-slide-tilpasning. Claude bytter bullets ut
 *     basert på lead's industri/størrelse/smerter. Overstyrer ikke
 *     master-decket — lagres på presentations-raden som value_slide_
 *     override.
 *
 *   POST /api/admin-room/lead-map/pitch-deck/presentations/:id/finalize
 *     Post-møte-loop. Kalles etter outcome er satt. Triggrer:
 *       demo_booked → calendar-event-hint + auto-status 'meeting_booked'
 *       follow_up   → setter crm_customers.next_follow_up_at (+7d)
 *       lost        → lead_status = 'lost'
 *       interested  → ingen status-endring, men neste follow_up_at +3d
 *
 * Alle tre er gated på pitch_deck.access (brief + finalize) eller
 * pitch_deck.edit (value-slide tilpasning skriver til presentations,
 * men endrer ikke master, så vi gjenbruker .access).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { callClaudeForJson, ClaudeJsonParseError } from "./claude-json-helper.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

// ─────────────────────────────────────────────────────────────────
// Lead-context-resolver — henter alt Claude trenger for å tilpasse
// brief'en til denne leaden. Trygt: returnerer tom struktur om noe
// mangler, så Claude får generell brief i stedet for å feile.
// ─────────────────────────────────────────────────────────────────

interface LeadContext {
  name: string;
  industry: string | null;
  city: string | null;
  category: string | null;
  website_url: string | null;
  google_rating: number | null;
  size_hint: string | null;       // fra BRREG eller estimated_value
  recent_notes: string[];          // siste 3 visit-notater
}

async function loadLeadContext(
  pool: Pool, leadId: string,
): Promise<LeadContext | null> {
  const leadRes = await pool.query<{
    name: string;
    lead_category: string | null;
    city: string | null;
    website_url: string | null;
    google_rating: number | null;
    estimated_value: number | null;
    industry_text: string | null;
  }>(
    `SELECT name, lead_category, city, website_url, google_rating,
            estimated_value,
            COALESCE(category, lead_category) AS industry_text
       FROM crm_customers WHERE id = $1`,
    [leadId],
  );
  if (leadRes.rows.length === 0) return null;
  const lead = leadRes.rows[0];

  // Siste 3 visit-notater (hvis tabell finnes)
  let recentNotes: string[] = [];
  try {
    const notesRes = await pool.query<{ conversation_summary: string | null }>(
      `SELECT conversation_summary FROM crm_visits
        WHERE customer_id = $1 AND conversation_summary IS NOT NULL
        ORDER BY created_at DESC LIMIT 3`,
      [leadId],
    );
    recentNotes = notesRes.rows
      .map((r) => r.conversation_summary ?? "")
      .filter((s) => s.length > 0)
      .map((s) => s.slice(0, 280));
  } catch { /* visit-tabell mangler i noen miljøer */ }

  const sizeHint = lead.estimated_value
    ? (lead.estimated_value > 500000
        ? "enterprise"
        : lead.estimated_value > 100000 ? "mid-market" : "SMB")
    : null;

  return {
    name: lead.name,
    industry: lead.industry_text,
    city: lead.city,
    category: lead.lead_category,
    website_url: lead.website_url,
    google_rating: lead.google_rating,
    size_hint: sizeHint,
    recent_notes: recentNotes,
  };
}

// ─────────────────────────────────────────────────────────────────
// Brief-generering
// ─────────────────────────────────────────────────────────────────

interface BriefSlideRef {
  id: string;
  position: number;
  slide_type: string;
  title_md: string;
  one_idea: string | null;
}

interface ClaudeBriefPayload {
  recommended_slide_positions: number[];
  talking_points: Record<string, string>;
  objections: Array<{ q: string; a: string }>;
}

interface BriefResult {
  recommended_slide_ids: string[];
  talking_points: Record<string, string>;
  objections: Array<{ q: string; a: string }>;
  generated_at: string;
  claude_model: string;
}

function buildBriefSystemPrompt(): string {
  return [
    "Du er coach for en B2B-selger som skal i møte med en lead. Du har",
    "lest hele pitch-decket og lead-konteksten. Returnér konkrete råd",
    "selgeren kan bruke umiddelbart. Ikke gjengi vanlige sales-floskler.",
    "Du må ALDRI foreslå emojier, AI-magic-uttrykk, eller 'sparkles'-tale.",
    "Hold språket nøkternt og respektfullt.",
    "Returnér gyldig JSON.",
  ].join(" ");
}

function buildBriefUserPrompt(
  leadCtx: LeadContext,
  slides: BriefSlideRef[],
): string {
  const slideList = slides
    .map((s) => `  pos ${s.position} (${s.slide_type}): ${s.title_md} — ${s.one_idea ?? ""}`)
    .join("\n");
  return [
    `LEAD:`,
    `  Navn: ${leadCtx.name}`,
    `  Industri/kategori: ${leadCtx.industry ?? "(ukjent)"}`,
    `  Sted: ${leadCtx.city ?? "(ukjent)"}`,
    `  Størrelse: ${leadCtx.size_hint ?? "(ukjent)"}`,
    `  Google-rating: ${leadCtx.google_rating ?? "(ingen)"}`,
    `  Siste samtaler:`,
    ...leadCtx.recent_notes.map((n, i) => `    ${i + 1}. ${n}`),
    ``,
    `DECK-SLIDES (i rekkefølge):`,
    slideList,
    ``,
    `Lever JSON:`,
    `  {`,
    `    "recommended_slide_positions": [number, ...],  // 5–7 posisjoner`,
    `    "talking_points": { "<position>": "1 setning til selger" },`,
    `    "objections": [{"q":"forventet innvending","a":"selgers svar"}]`,
    `  }`,
    `Anbefal slides som faktisk er relevante for DENNE leaden. Spar tid:`,
    `kan vi droppe noen? Hvis ja, ikke ta dem med i recommended.`,
  ].join("\n");
}

async function generateBrief(
  leadCtx: LeadContext,
  slides: BriefSlideRef[],
): Promise<BriefResult> {
  const result = await callClaudeForJson<ClaudeBriefPayload>({
    cachedSystem: buildBriefSystemPrompt(),
    userMessage: buildBriefUserPrompt(leadCtx, slides),
    maxTokens: 2200,
  });
  // Mapper position-numre tilbake til slide-id'er
  const idsByPos = new Map(slides.map((s) => [s.position, s.id]));
  const recommendedIds: string[] = [];
  for (const pos of result.data.recommended_slide_positions ?? []) {
    const id = idsByPos.get(Number(pos));
    if (id) recommendedIds.push(id);
  }
  // Mapper talking_points fra position til slide_id
  const tp: Record<string, string> = {};
  for (const [posStr, point] of Object.entries(result.data.talking_points ?? {})) {
    const id = idsByPos.get(Number(posStr));
    if (id && typeof point === "string") tp[id] = point.slice(0, 400);
  }
  const objections = (result.data.objections ?? [])
    .filter((o) => o && typeof o.q === "string" && typeof o.a === "string")
    .slice(0, 5)
    .map((o) => ({ q: o.q.slice(0, 240), a: o.a.slice(0, 400) }));

  return {
    recommended_slide_ids: recommendedIds.slice(0, 7),
    talking_points: tp,
    objections,
    generated_at: new Date().toISOString(),
    claude_model: result.model,
  };
}

// ─────────────────────────────────────────────────────────────────
// Per-lead Value-slide
// ─────────────────────────────────────────────────────────────────

interface ValueOverride {
  title_md: string;
  body_md: string;
  bullets: Array<{ icon: string; label: string; body?: string }>;
}

async function generateValueOverride(
  leadCtx: LeadContext,
  masterValueSlide: { title_md: string; body_md: string },
  generatedFrom: unknown,
): Promise<ValueOverride> {
  const gen = (generatedFrom && typeof generatedFrom === "object")
    ? generatedFrom as Record<string, unknown>
    : {};
  const systemPrompt = [
    "Du tilpasser Verdien-sliden i en pitch til en spesifikk lead.",
    "Behold strukturen (én skarp tittel + max 40 ord brødtekst + 3–4",
    "bullets). FORBUDT: emojier, AI-magic-ikoner ('sparkles',",
    "'wand.and.stars'). Bruk konkrete forretnings-SF-Symbols (",
    "'chart.bar', 'clock', 'lock.shield', 'arrow.up.right',",
    "'person.2.fill', 'building.2', 'banknote'). Returnér gyldig JSON.",
  ].join(" ");
  const userPrompt = [
    `Selgers produkt: ${String(gen.one_liner ?? "")}`,
    `Selgers målgruppe: ${String(gen.target_customer ?? "")}`,
    ``,
    `MASTER Verdien-slide:`,
    `  Tittel: ${masterValueSlide.title_md}`,
    `  Brødtekst: ${masterValueSlide.body_md}`,
    ``,
    `LEAD:`,
    `  Navn: ${leadCtx.name}`,
    `  Industri: ${leadCtx.industry ?? "(ukjent)"}`,
    `  Størrelse: ${leadCtx.size_hint ?? "(ukjent)"}`,
    `  Sted: ${leadCtx.city ?? "(ukjent)"}`,
    `  Siste samtaler: ${leadCtx.recent_notes.join(" | ")}`,
    ``,
    `Tilpass Verdien til DENNE leaden. Skift hvilke tall som vektlegges`,
    `(tid spart, kr-besparelse, conversion-uplift osv.) basert på hva som`,
    `er sannsynlig viktigst for deres størrelse + industri.`,
    ``,
    `Returnér JSON:`,
    `  { "title_md": "...", "body_md": "...",`,
    `    "bullets": [{"icon":"chart.bar","label":"...","body":"..."}, ...] }`,
  ].join("\n");
  const result = await callClaudeForJson<{
    title_md?: string;
    body_md?: string;
    bullets?: unknown;
  }>({
    cachedSystem: systemPrompt,
    userMessage: userPrompt,
    maxTokens: 1200,
  });
  return {
    title_md: String(result.data.title_md ?? masterValueSlide.title_md).slice(0, 240),
    body_md: String(result.data.body_md ?? masterValueSlide.body_md).slice(0, 2000),
    bullets: Array.isArray(result.data.bullets)
      ? result.data.bullets.slice(0, 6).map((b) => {
          const obj = (b && typeof b === "object") ? b as Record<string, unknown> : {};
          return {
            icon: String(obj.icon ?? "circle.fill").slice(0, 60),
            label: String(obj.label ?? "").slice(0, 60),
            body: typeof obj.body === "string" ? obj.body.slice(0, 200) : undefined,
          };
        }).filter((b) => b.label.length > 0)
      : [],
  };
}

// ─────────────────────────────────────────────────────────────────
// Post-møte-loop
// ─────────────────────────────────────────────────────────────────

interface FinalizeActions {
  lead_status_set: string | null;
  next_follow_up_at: string | null;
  calendar_event_hint: { title: string; suggested_at: string } | null;
}

async function applyOutcomeActions(
  pool: Pool, leadId: string, outcome: string, userId: string,
): Promise<FinalizeActions> {
  const result: FinalizeActions = {
    lead_status_set: null,
    next_follow_up_at: null,
    calendar_event_hint: null,
  };
  const now = new Date();

  if (outcome === "demo_booked") {
    // Set lead_status til 'meeting_booked'. Selgeren bekrefter dato selv.
    try {
      await pool.query(
        `UPDATE crm_customers SET lead_status = 'meeting_booked',
                                  next_follow_up_at = $2
          WHERE id = $1`,
        [leadId, new Date(now.getTime() + 24 * 3600_000)],
      );
      result.lead_status_set = "meeting_booked";
      result.next_follow_up_at = new Date(now.getTime() + 24 * 3600_000).toISOString();
      result.calendar_event_hint = {
        title: "Demo m/ kunden (avtalt i Pitch Deck)",
        suggested_at: new Date(now.getTime() + 7 * 24 * 3600_000).toISOString(),
      };
    } catch { /* swallow */ }
  } else if (outcome === "follow_up" || outcome === "interested") {
    // +7 dager for follow_up, +3 dager for interested
    const days = outcome === "follow_up" ? 7 : 3;
    const nextDate = new Date(now.getTime() + days * 24 * 3600_000);
    try {
      await pool.query(
        `UPDATE crm_customers SET next_follow_up_at = $2 WHERE id = $1`,
        [leadId, nextDate],
      );
      result.next_follow_up_at = nextDate.toISOString();
    } catch { /* swallow */ }
  } else if (outcome === "lost") {
    try {
      await pool.query(
        `UPDATE crm_customers SET lead_status = 'lost' WHERE id = $1`,
        [leadId],
      );
      result.lead_status_set = "lost";
    } catch { /* swallow */ }
  }
  // 'more_info' har ingen auto-aksjon — selger noterer selv hva de skal
  // sende.

  // Audit i lead_activities hvis tabellen finnes
  try {
    await pool.query(
      `INSERT INTO crm_lead_activities
         (customer_id, actor_user_id, activity_type, details)
       VALUES ($1, $2, 'pitch_outcome', $3::jsonb)`,
      [leadId, userId, JSON.stringify({ outcome, applied: result })],
    );
  } catch { /* tabell mangler i noen miljøer */ }

  return result;
}

// ─────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────

export function registerPitchDeckBriefRoutes({ app, pool, activeSessions }: Deps): void {
  const ROOT = "/api/admin-room/lead-map/pitch-deck";

  // ─── POST /presentations/brief ─────────────────────────────────
  app.post(
    `${ROOT}/presentations/brief`,
    requireLeadMapPermission("pitch_deck.access", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const deckId = typeof req.body?.deck_id === "string" ? req.body.deck_id : null;
      const leadId = typeof req.body?.lead_id === "string" ? req.body.lead_id : null;
      if (!deckId || !leadId) {
        return res.status(400).json({ error: "deck_id_og_lead_id_påkrevd" });
      }
      try {
        const leadCtx = await loadLeadContext(pool, leadId);
        if (!leadCtx) return res.status(404).json({ error: "lead_not_found" });
        // Bare aktive (ikke-slettet) + inkluderte slides — org har
        // eksplisitt valgt vekk det som er is_included=false, og
        // slettede slides skal aldri foreslås.
        const slidesRes = await pool.query<BriefSlideRef>(
          `SELECT id::text, position, slide_type, title_md, one_idea
             FROM pitch_slides
            WHERE deck_id = $1
              AND deleted_at IS NULL
              AND is_included = true
            ORDER BY position`,
          [deckId],
        );
        if (slidesRes.rows.length === 0) {
          return res.status(400).json({ error: "deck_har_ingen_slides" });
        }
        const brief = await generateBrief(leadCtx, slidesRes.rows);
        return res.json({ brief, lead_context: leadCtx });
      } catch (err) {
        if (err instanceof ClaudeJsonParseError) {
          return res.status(502).json({
            error: "claude_invalid_json",
            raw_preview: err.raw.slice(0, 400),
          });
        }
        return res.status(500).json({ error: "brief_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /decks/:id/value-slide/for-lead ──────────────────────
  app.post(
    `${ROOT}/decks/:id/value-slide/for-lead`,
    requireLeadMapPermission("pitch_deck.access", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const leadId = typeof req.body?.lead_id === "string" ? req.body.lead_id : null;
      const presentationId = typeof req.body?.presentation_id === "string"
        ? req.body.presentation_id : null;
      if (!leadId) return res.status(400).json({ error: "lead_id_påkrevd" });
      try {
        const leadCtx = await loadLeadContext(pool, leadId);
        if (!leadCtx) return res.status(404).json({ error: "lead_not_found" });

        const deckRes = await pool.query<{ generated_from: unknown }>(
          `SELECT generated_from FROM pitch_decks WHERE id = $1`,
          [req.params.id],
        );
        if (deckRes.rows.length === 0) {
          return res.status(404).json({ error: "deck_not_found" });
        }

        const valueRes = await pool.query<{ title_md: string; body_md: string }>(
          `SELECT title_md, body_md FROM pitch_slides
            WHERE deck_id = $1 AND slide_type = 'value'
              AND deleted_at IS NULL
            LIMIT 1`,
          [req.params.id],
        );
        if (valueRes.rows.length === 0) {
          return res.status(400).json({ error: "deck_har_ingen_value_slide" });
        }

        const override = await generateValueOverride(
          leadCtx, valueRes.rows[0], deckRes.rows[0].generated_from,
        );

        // Lagre på presentations-raden hvis vi har en
        if (presentationId) {
          await pool.query(
            `UPDATE pitch_deck_presentations
                SET value_slide_override = $2::jsonb
              WHERE id = $1`,
            [presentationId, JSON.stringify(override)],
          );
        }
        return res.json({ override, applied_to_presentation: presentationId });
      } catch (err) {
        if (err instanceof ClaudeJsonParseError) {
          return res.status(502).json({
            error: "claude_invalid_json",
            raw_preview: err.raw.slice(0, 400),
          });
        }
        return res.status(500).json({ error: "value_override_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /presentations/:id/finalize ──────────────────────────
  // Post-møte-loop: triggrer outcome-aksjoner. Kalles av PresentView
  // etter at outcome-arket er sendt og selgeren går tilbake til
  // lead-flyten. Idempotent — kan kalles flere ganger trygt.
  app.post(
    `${ROOT}/presentations/:id/finalize`,
    requireLeadMapPermission("pitch_deck.access", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = activeSessions.get(
        (req.headers.authorization ?? "").replace("Bearer ", ""),
      );
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const presRes = await pool.query<{
          lead_id: string | null; outcome: string | null;
        }>(
          `SELECT lead_id, outcome FROM pitch_deck_presentations WHERE id = $1`,
          [req.params.id],
        );
        if (presRes.rows.length === 0) {
          return res.status(404).json({ error: "presentation_not_found" });
        }
        const { lead_id, outcome } = presRes.rows[0];
        if (!lead_id || !outcome) {
          return res.json({ ok: true, applied: null, reason: "no_lead_or_outcome" });
        }
        const applied = await applyOutcomeActions(pool, lead_id, outcome, session.userId);
        return res.json({ ok: true, applied });
      } catch (err) {
        return res.status(500).json({ error: "finalize_failed", detail: String(err) });
      }
    },
  );
}
