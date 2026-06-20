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

// Segmenter er produkt-spesifikke. Front-end-velgeren styrer hvilket
// produkt vi henter — backenden tillater begge sett samtidig, og lar
// VALID_PRODUCTS gate hvilken kolonne-verdi vi godtar.
const ROLE_ROOM_SEGMENTS = new Set([
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
const LEADGRID_SEGMENTS = new Set([
  // Fra LEADGRID-OUTREACH-PLAN.md
  "b2b_agency",
  "marketing_director",
  "franchise_hq",
  "industry_assoc",
  "ad_partner",
  "integration_partner",
  "other",
]);
function segmentsForProduct(productKey: string): Set<string> {
  return productKey === "leadgrid" ? LEADGRID_SEGMENTS : ROLE_ROOM_SEGMENTS;
}
const VALID_CHANNELS = new Set(["dm", "email", "phone", "in_person", "loom"]);
const VALID_LANGUAGES = new Set(["no", "en"]);

function resolveProductKey(raw: unknown): "role_room" | "leadgrid" {
  const v = typeof raw === "string" ? raw : "";
  return v === "leadgrid" ? "leadgrid" : "role_room";
}

let cachedClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY er ikke satt");
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

const PERSONALIZE_SYSTEM_ROLE_ROOM = `Du er Daniel Qazi sin outreach-skribent for The Role Room. Du skriver personaliserte meldinger til norske casting directors, produsenter, NSF/NFI, presse og byråer basert på en mal og fakta om mottakeren.

REGLER:
- Behold malens struktur, tone og innramming
- Erstatt {{plassholdere}} med ekte fakta fra target-data — ikke oppfunnet
- Hvis en plassholder ikke har data, lag noe rimelig basert på rolle/bransje, men ALDRI oppfinn produksjonstitler, sitater eller spesifikke hendelser
- Behold språket (norsk eller engelsk) fra malen
- Aldri legg til "Jeg håper denne mailen finner deg godt"-fyllord
- Aldri si "I am reaching out to ..." eller "Just wanted to touch base"
- Hold meldingen samme lengde som malen — ikke utvid med konsulent-jargong

OUTPUT: kun den endelige personlige meldingen. Ingen overskrift, ingen forklaring, ingen markdown-kodeblokker.`;

const PERSONALIZE_SYSTEM_LEADGRID = `Du er Daniel Qazi sin outreach-skribent for Leadgrid. Du skriver personaliserte meldinger til norske B2B-byrå-eiere, markedssjefer, franchise-hovedkontor, bransjeforeninger og ad-/integrasjons-partnere basert på en mal og fakta om mottakeren.

KONTEKST: Leadgrid er et kart-først CRM for B2B-feltsalg. iPad-først (TestFlight live), salgshierarki-modell (markedssjef → teamleder → salgskonsulent → promotør → research), BRREG-auto-onboarding på 30 sek, ad-tech-stack-integrasjon (Google/Meta/LinkedIn/TikTok), white-label klient-portal på Agency-tier (990 kr/mnd). Vi er pre-revenue og leter etter de første 3-5 betalende B2B-byråene.

REGLER:
- Behold malens struktur, tone og innramming
- Erstatt {{plassholdere}} med ekte fakta fra target-data — ikke oppfunnet
- Hvis en plassholder ikke har data, lag noe rimelig basert på bransje/rolle, men ALDRI oppfinn casestudier, omsetningstall eller spesifikke kundenavn
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
    const productKey = resolveProductKey(req.query.product);

    const where: string[] = [
      "(user_id IS NULL OR user_id = $1)",
      "product_key = $2",
    ];
    const params: unknown[] = [session.userId, productKey];
    const allowedSegmentsForProduct = segmentsForProduct(productKey);
    if (segmentFilter && allowedSegmentsForProduct.has(segmentFilter)) {
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
      res.json({ items: result.rows, productKey });
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
    const productKey = resolveProductKey(body.productKey);
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
    const allowedForProduct = segmentsForProduct(productKey);
    if (!allowedForProduct.has(segment)) {
      res.status(400).json({
        error: `Ugyldig segment for produkt ${productKey}. Tillatte: ${[...allowedForProduct].join(", ")}`,
      });
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
          (user_id, slug, title, segment, channel, language, description, body, variables, is_default, product_key, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, FALSE, $10, $1)
          RETURNING *`,
        [session.userId, slug, title, segment, channel, language, description, tplBody, JSON.stringify(variables), productKey],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "outreach_template",
        entityId: result.rows[0].id,
        action: "created",
        summary: `[${productKey}] Outreach-template opprettet: ${title}`,
      });
      res.status(201).json({ item: result.rows[0] });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("duplicate key")) {
        res.status(409).json({ error: "Slug er allerede i bruk for denne brukeren + produktet" });
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
    const changedFields: string[] = [];

    // Slå opp eksisterende rad for å vite hvilken product_key vi opererer
    // mot — segment-validering må mappe mot riktig sett.
    const existingResult = await pool.query(
      `SELECT product_key, title FROM role_room_outreach_templates WHERE id = $1 AND user_id = $2`,
      [id, session.userId],
    );
    if (existingResult.rowCount === 0) {
      res.status(404).json({ error: "Template ikke funnet eller ikke redigerbar (default-templates kan ikke endres — kopiér i stedet)" });
      return;
    }
    const existingProductKey = existingResult.rows[0].product_key as string;
    const allowedSegmentsForProduct = segmentsForProduct(existingProductKey);

    const fields: Array<{ key: keyof typeof body; col: string; validator?: (v: string) => boolean }> = [
      { key: "title", col: "title" },
      { key: "segment", col: "segment", validator: (v) => allowedSegmentsForProduct.has(v) },
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
        res.status(400).json({ error: `Ugyldig verdi for ${String(field.key)} (produkt: ${existingProductKey})` });
        return;
      }
      params.push(value);
      updates.push(`${field.col} = $${params.length}`);
      changedFields.push(String(field.key));
    }
    if (Array.isArray(body.variables)) {
      params.push(JSON.stringify(body.variables));
      updates.push(`variables = $${params.length}::jsonb`);
      changedFields.push("variables");
    }
    if (updates.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }
    updates.push(`updated_at = NOW()`);
    params.push(session.userId);
    updates.push(`updated_by = $${params.length}`);
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
      await logAdminActivity({
        userId: session.userId,
        entityType: "outreach_template",
        entityId: result.rows[0].id,
        action: "updated",
        summary: `[${existingProductKey}] Outreach-template oppdatert: ${existingResult.rows[0].title} (felt: ${changedFields.join(", ")})`,
      });
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
          WHERE id = $1 AND user_id = $2
          RETURNING title, product_key`,
        [id, session.userId],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Template ikke funnet eller ikke slettbar" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "outreach_template",
        entityId: id,
        action: "deleted",
        summary: `[${result.rows[0].product_key}] Outreach-template slettet: ${result.rows[0].title}`,
      });
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
                recent_productions, mutual_connection, tags, product_key
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
        `SELECT id, slug, title, segment, channel, language, body, variables, product_key
           FROM role_room_outreach_templates
          WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
        [templateId, session.userId],
      );
      if (tplResult.rowCount === 0) {
        res.status(404).json({ error: "Template ikke funnet" });
        return;
      }
      const template = tplResult.rows[0];

      // Kryss-produkt-bruk er sannsynligvis utilsiktet — vi varsler, men
      // tillater (Daniel kan bruke en Role Room-mal mot et Leadgrid-target
      // hvis han eksplisitt vil).
      const productMismatch = template.product_key !== target.product_key;

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

      // Velg system-prompt basert på malens produkt — Leadgrid-malene får
      // ad-tech/B2B-feltsalg-konteksten, Role Room-malene får casting/
      // produksjon-konteksten.
      const systemPrompt = template.product_key === "leadgrid"
        ? PERSONALIZE_SYSTEM_LEADGRID
        : PERSONALIZE_SYSTEM_ROLE_ROOM;

      const client = getAnthropic();
      const response = await client.messages.create({
        model: process.env.NEWSLETTER_AI_MODEL || "claude-opus-4-7",
        max_tokens: 1200,
        system: systemPrompt,
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
        productKey: template.product_key,
        productMismatch,
        unresolvedPlaceholders,
        target: { id: target.id, fullName: target.full_name },
      });
    } catch (err) {
      console.error("[admin-room outreach personalize] error", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
