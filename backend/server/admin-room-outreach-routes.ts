/**
 * admin-room-outreach-routes.ts
 *
 * Outreach-system fra TheRoleRoom-Outreach-Plan.md:
 *   - Template-bibliotek (6 default-templates seedet i migrasjon 172,
 *     pluss bruker-spesifikke)
 *   - AI-personalisert DM-generator: target + template → Claude tar
 *     target-data (navn, recent_productions, mutual_connection) +
 *     template-skjelett og lager en ferdig, personlig melding
 *
 * Endpoints:
 *   GET    /api/admin-room/outreach-templates                  — list (default + bruker)
 *   POST   /api/admin-room/outreach-templates                  — create bruker-template
 *   PATCH  /api/admin-room/outreach-templates/:id              — update (kun bruker-eide)
 *   DELETE /api/admin-room/outreach-templates/:id              — delete (kun bruker-eide)
 *   POST   /api/admin-room/outreach-templates/personalize      — AI-personaliser for target
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AdminRoomRoutesDeps } from "./_shared";
import { asString } from "./_shared";

const VALID_SEGMENTS = new Set([
  "casting_director",
  "producer",
  "union",
  "institution",
  "press",
  "agency",
  // Outreach Plan v2-segments
  "dance",
  "affiliate",
  "content",
  "education",
  "other",
]);
const VALID_CHANNELS = new Set(["dm", "email", "phone", "in_person", "loom"]);
const VALID_LANGUAGES = new Set(["no", "en"]);

let cachedClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY er ikke satt");
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

const PERSONALIZE_SYSTEM = `Du er Daniel Qazi sin outreach-skribent for The Role Room. Du skriver personaliserte meldinger til norske casting directors, produsenter, NSF/NFI, presse og byråer basert på en mal og fakta om mottakeren.

REGLER:
- Behold malens struktur, tone og innramming
- Erstatt {{plassholdere}} med ekte fakta fra target-data — ikke oppfunnet
- Hvis en plassholder ikke har data, lag noe rimelig basert på rolle/bransje, men ALDRI oppfinn produksjonstitler, sitater eller spesifikke hendelser
- Behold språket (norsk eller engelsk) fra malen
- Aldri legg til "Jeg håper denne mailen finner deg godt"-fyllord
- Aldri si "I am reaching out to ..." eller "Just wanted to touch base"
- Hold meldingen samme lengde som malen — ikke utvid med konsulent-jargong

OUTPUT: kun den endelige personlige meldingen. Ingen overskrift, ingen forklaring, ingen markdown-kodeblokker.`;

export function setupAdminOutreachRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  // ── List templates (default + bruker-eide) ─────────────────────
  app.get("/api/admin-room/outreach-templates", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const segmentFilter = asString(req.query.segment);
    const languageFilter = asString(req.query.language);

    const where: string[] = ["(user_id IS NULL OR user_id = $1)"];
    const params: unknown[] = [session.userId];
    if (segmentFilter && VALID_SEGMENTS.has(segmentFilter)) {
      params.push(segmentFilter);
      where.push(`segment = $${params.length}`);
    }
    if (languageFilter && VALID_LANGUAGES.has(languageFilter)) {
      params.push(languageFilter);
      where.push(`language = $${params.length}`);
    }

    try {
      const result = await pool.query(
        `SELECT * FROM role_room_outreach_templates
          WHERE ${where.join(" AND ")}
          ORDER BY is_default DESC, segment ASC, title ASC`,
        params,
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error("[admin-room outreach-templates] list error", err);
      res.status(500).json({ error: "Kunne ikke hente templates" });
    }
  });

  // ── Create bruker-template ─────────────────────────────────────
  app.post("/api/admin-room/outreach-templates", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const slug = asString(body.slug);
    const title = asString(body.title);
    const segment = asString(body.segment);
    const channel = asString(body.channel) ?? "dm";
    const language = asString(body.language) ?? "no";
    const description = asString(body.description) ?? null;
    const tplBody = asString(body.body);
    const variables = Array.isArray(body.variables) ? body.variables : [];

    if (!slug || !title || !segment || !tplBody) {
      res.status(400).json({ error: "slug, title, segment og body er påkrevd" });
      return;
    }
    if (!VALID_SEGMENTS.has(segment)) {
      res.status(400).json({ error: `Ugyldig segment. Tillatte: ${[...VALID_SEGMENTS].join(", ")}` });
      return;
    }
    if (!VALID_CHANNELS.has(channel)) {
      res.status(400).json({ error: `Ugyldig channel. Tillatte: ${[...VALID_CHANNELS].join(", ")}` });
      return;
    }
    if (!VALID_LANGUAGES.has(language)) {
      res.status(400).json({ error: `Ugyldig language. Tillatte: ${[...VALID_LANGUAGES].join(", ")}` });
      return;
    }

    try {
      const result = await pool.query(
        `INSERT INTO role_room_outreach_templates
          (user_id, slug, title, segment, channel, language, description, body, variables, is_default)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, FALSE)
          RETURNING *`,
        [session.userId, slug, title, segment, channel, language, description, tplBody, JSON.stringify(variables)],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "outreach_template",
        entityId: result.rows[0].id,
        action: "created",
        summary: `Outreach-template opprettet: ${title}`,
      });
      res.status(201).json({ item: result.rows[0] });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("duplicate key")) {
        res.status(409).json({ error: "Slug er allerede i bruk for denne brukeren" });
        return;
      }
      console.error("[admin-room outreach-templates] create error", err);
      res.status(500).json({ error: "Kunne ikke opprette template" });
    }
  });

  // ── Update bruker-template ─────────────────────────────────────
  app.patch("/api/admin-room/outreach-templates/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const { id } = req.params;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const updates: string[] = [];
    const params: unknown[] = [];

    const fields: Array<{ key: keyof typeof body; col: string; validator?: (v: string) => boolean }> = [
      { key: "title", col: "title" },
      { key: "segment", col: "segment", validator: (v) => VALID_SEGMENTS.has(v) },
      { key: "channel", col: "channel", validator: (v) => VALID_CHANNELS.has(v) },
      { key: "language", col: "language", validator: (v) => VALID_LANGUAGES.has(v) },
      { key: "description", col: "description" },
      { key: "body", col: "body" },
    ];
    for (const field of fields) {
      if (body[field.key] === undefined) continue;
      const value = asString(body[field.key]);
      if (value === null) continue;
      if (field.validator && !field.validator(value)) {
        res.status(400).json({ error: `Ugyldig verdi for ${String(field.key)}` });
        return;
      }
      params.push(value);
      updates.push(`${field.col} = $${params.length}`);
    }
    if (Array.isArray(body.variables)) {
      params.push(JSON.stringify(body.variables));
      updates.push(`variables = $${params.length}::jsonb`);
    }
    if (updates.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }
    updates.push(`updated_at = NOW()`);
    params.push(id, session.userId);

    try {
      // Begrens til bruker-eide templates — defaults (user_id IS NULL) skal ikke endres
      const result = await pool.query(
        `UPDATE role_room_outreach_templates
            SET ${updates.join(", ")}
          WHERE id = $${params.length - 1} AND user_id = $${params.length}
          RETURNING *`,
        params,
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Template ikke funnet eller ikke redigerbar (default-templates kan ikke endres — kopiér i stedet)" });
        return;
      }
      res.json({ item: result.rows[0] });
    } catch (err) {
      console.error("[admin-room outreach-templates] update error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere template" });
    }
  });

  // ── Delete bruker-template ─────────────────────────────────────
  app.delete("/api/admin-room/outreach-templates/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const { id } = req.params;
    try {
      const result = await pool.query(
        `DELETE FROM role_room_outreach_templates
          WHERE id = $1 AND user_id = $2`,
        [id, session.userId],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Template ikke funnet eller ikke slettbar" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("[admin-room outreach-templates] delete error", err);
      res.status(500).json({ error: "Kunne ikke slette template" });
    }
  });

  // ── AI-personaliser: target + template → Claude → ferdig melding ──
  app.post("/api/admin-room/outreach-templates/personalize", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const targetId = asString(body.targetId);
    const templateId = asString(body.templateId);
    const extraContext = asString(body.extraContext) ?? "";

    if (!targetId || !templateId) {
      res.status(400).json({ error: "targetId og templateId er påkrevd" });
      return;
    }

    try {
      // Hent target — må tilhøre brukeren
      const targetResult = await pool.query(
        `SELECT id, full_name, role_title, company, segment, city, notes,
                recent_productions, mutual_connection, tags
           FROM role_room_industry_targets
          WHERE id = $1 AND user_id = $2`,
        [targetId, session.userId],
      );
      if (targetResult.rowCount === 0) {
        res.status(404).json({ error: "Target ikke funnet" });
        return;
      }
      const target = targetResult.rows[0];

      // Hent template — kan være default (user_id NULL) eller bruker-eid
      const tplResult = await pool.query(
        `SELECT id, slug, title, segment, channel, language, body, variables
           FROM role_room_outreach_templates
          WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
        [templateId, session.userId],
      );
      if (tplResult.rowCount === 0) {
        res.status(404).json({ error: "Template ikke funnet" });
        return;
      }
      const template = tplResult.rows[0];

      const targetFacts = JSON.stringify(
        {
          fullName: target.full_name,
          roleTitle: target.role_title,
          company: target.company,
          segment: target.segment,
          city: target.city,
          notes: target.notes,
          recentProductions: target.recent_productions ?? [],
          mutualConnection: target.mutual_connection,
          tags: target.tags ?? [],
        },
        null,
        2,
      );

      const client = getAnthropic();
      const response = await client.messages.create({
        model: process.env.NEWSLETTER_AI_MODEL || "claude-opus-4-7",
        max_tokens: 1200,
        system: PERSONALIZE_SYSTEM,
        messages: [
          {
            role: "user",
            content: `MAL:
"""
${template.body}
"""

MOTTAKER-FAKTA (JSON):
"""
${targetFacts}
"""

${extraContext ? `EKSTRA KONTEKST (fra Daniel):\n"""\n${extraContext}\n"""\n` : ""}Erstatt {{plassholdere}} med fakta fra mottakeren. Hvis en plassholder ikke har data, lag noe rimelig basert på rolle/segment — men ALDRI oppfinn produksjonstitler, sitater eller spesifikke hendelser.

Returnér KUN den endelige meldingen, klar til å limes inn i LinkedIn-DM/mail.`,
          },
        ],
      });

      const block = response.content[0];
      const personalized = block?.type === "text" ? block.text.trim() : "";
      if (!personalized) {
        res.status(502).json({ error: "Claude returnerte tom respons" });
        return;
      }

      // Detektér plassholdere som ikke ble erstattet — kan være et signal
      // på manglende target-data (f.eks. mangler recent_productions).
      const unresolvedPlaceholders = personalized.match(/\{\{[\w_-]+\}\}/g) ?? [];

      res.json({
        personalized,
        templateTitle: template.title,
        templateChannel: template.channel,
        templateLanguage: template.language,
        unresolvedPlaceholders,
        target: { id: target.id, fullName: target.full_name },
      });
    } catch (err) {
      console.error("[admin-room outreach personalize] error", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
