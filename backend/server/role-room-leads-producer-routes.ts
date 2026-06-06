/**
 * role-room-leads-producer-routes.ts — producer-facing Meta Lead Ads retrieval.
 *
 * Lets the content marketer pull the CLIENT's lead-gen leads (Meta Lead Ads)
 * for a connected Page, so they can deliver leads to the customer. This is the
 * real-product surface on top of the App Review demo
 * (role-room-leads-retrieval-routes.ts): same Graph calls, but authenticated
 * with the producer's session + the Page token derived from the stored
 * connection (instead of a pasted token).
 *
 * Endpoints (requireAdminSession, user-isolated via the connection):
 *   GET /api/role-room/leads/producer/forms?connectionId=...
 *     → /v21.0/{page-id}/leadgen_forms
 *   GET /api/role-room/leads/producer/leads?connectionId=...&formId=...&limit=...
 *     → /v21.0/{form-id}/leads
 *
 * Note: live data requires leads_retrieval App Review approval; until then the
 * Graph call returns an error which we surface (success:false) for the UI to
 * explain gracefully.
 */

import type express from "express";
import type { Pool } from "pg";
import {
  getConnection,
  ensureFreshConnection,
  META_GRAPH_API_VERSION,
  type InstagramConnectionRow,
} from "./role-room-instagram-oauth.js";
import { sendSms, smsConfigured } from "./crm-sms.js";
import { sendTransactionalEmail, isTransactionalEmailConfigured } from "./transactional-email-service.js";
import { readEnvFallbackConfig, sendWhatsAppLeadFollowup } from "./casting-whatsapp-sender.js";
import { callClaudeForJson } from "./claude-json-helper.js";

/** WhatsApp lead follow-up needs an env-configured WA account + an approved template name. */
function whatsappLeadConfig() {
  const config = readEnvFallbackConfig();
  const templateName = (process.env.META_WHATSAPP_TEMPLATE_LEAD_FOLLOWUP_NAME || "").trim();
  return config && templateName ? { config, templateName } : null;
}

const GRAPH = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
const FORM_FIELDS = "id,name,status,leads_count,created_time";
const LEAD_FIELDS = "id,created_time,ad_id,form_id,field_data";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomLeadsProducerRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
}

// Lead segments for retargeting: warm / lukewarm / cold / lost (+ unset).
export type LeadSegment = "varm" | "lunken" | "kald" | "tapt";
const VALID_SEGMENTS: LeadSegment[] = ["varm", "lunken", "kald", "tapt"];

// Conversion stage for ROI documentation: answered → booked meeting → became
// customer → lost. "ny" (new, untouched) = no stored row.
export type LeadStage = "svart" | "booket" | "kunde" | "tapt";
const VALID_STAGES: LeadStage[] = ["svart", "booket", "kunde", "tapt"];

let leadSegmentSchemaReady = false;
async function ensureLeadSegmentSchema(pool: Pool): Promise<void> {
  if (leadSegmentSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_lead_segments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      connection_id UUID NOT NULL,
      lead_external_id TEXT NOT NULL,
      segment TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, lead_external_id)
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_rr_lead_segments_user ON role_room_lead_segments(user_id, connection_id);`,
  );
  // AI-suggestion metadata (added after the table shipped) — additive.
  await pool.query(`ALTER TABLE role_room_lead_segments ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE role_room_lead_segments ADD COLUMN IF NOT EXISTS ai_suggested BOOLEAN NOT NULL DEFAULT false;`);
  leadSegmentSchemaReady = true;
}

/** Map of lead_external_id → {segment, reason} for the given user. */
async function fetchSegments(pool: Pool, userId: string, leadIds: string[]): Promise<Record<string, { segment: string; reason: string }>> {
  if (leadIds.length === 0) return {};
  const result = await pool.query(
    `SELECT lead_external_id, segment, reason FROM role_room_lead_segments
       WHERE user_id = $1 AND lead_external_id = ANY($2::text[])`,
    [userId, leadIds],
  );
  const map: Record<string, { segment: string; reason: string }> = {};
  for (const row of result.rows) {
    map[String(row.lead_external_id)] = { segment: String(row.segment), reason: String(row.reason || "") };
  }
  return map;
}

// ── Outcomes + spend (ROI documentation) ──────────────────────────────────
let leadRoiSchemaReady = false;
async function ensureLeadRoiSchema(pool: Pool): Promise<void> {
  if (leadRoiSchemaReady) return;
  // Per-lead conversion stage + value (kr) — for the funnel the producer shows
  // the client (spend → leads → answered → booked → customer → revenue).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_lead_outcomes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      connection_id UUID NOT NULL,
      form_id TEXT NOT NULL,
      lead_external_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      value_kr NUMERIC NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, lead_external_id)
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_rr_lead_outcomes_form ON role_room_lead_outcomes(user_id, connection_id, form_id);`,
  );
  // Ad spend per form (manually entered by the producer, or from attribution).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_lead_spend (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      connection_id UUID NOT NULL,
      form_id TEXT NOT NULL,
      spend_kr NUMERIC NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, connection_id, form_id)
    );
  `);
  leadRoiSchemaReady = true;
}

/** Map of lead_external_id → {stage, valueKr} for the given user. */
async function fetchOutcomes(
  pool: Pool,
  userId: string,
  leadIds: string[],
): Promise<Record<string, { stage: string; valueKr: number }>> {
  if (leadIds.length === 0) return {};
  const result = await pool.query(
    `SELECT lead_external_id, stage, value_kr FROM role_room_lead_outcomes
       WHERE user_id = $1 AND lead_external_id = ANY($2::text[])`,
    [userId, leadIds],
  );
  const map: Record<string, { stage: string; valueKr: number }> = {};
  for (const row of result.rows) {
    map[String(row.lead_external_id)] = { stage: String(row.stage), valueKr: Number(row.value_kr) || 0 };
  }
  return map;
}

// ── Fast follow-up ─────────────────────────────────────────────────────────
// Auto-SMS + auto-email to the new lead, plus a notification to the
// seller/client, so a lead is contacted within minutes instead of days.
interface FollowupConfig {
  smsBody: string;
  emailSubject: string;
  emailBody: string;
  replyTo: string;
  notifyPhone: string;
  notifyEmail: string;
  aiPersonalize: boolean;
}
const DEFAULT_FOLLOWUP: FollowupConfig = {
  smsBody: "Hei {navn}! Takk for at du tok kontakt med {bedrift}. Vi ringer deg snart. Mvh {bedrift}",
  emailSubject: "Takk for henvendelsen, {navn}",
  emailBody:
    "Hei {navn},\n\nTakk for at du tok kontakt via annonsen vår. Vi tar kontakt med deg så raskt vi kan.\n\nVennlig hilsen\n{bedrift}",
  replyTo: "",
  notifyPhone: "",
  notifyEmail: "",
  aiPersonalize: false,
};

let leadFollowupSchemaReady = false;
async function ensureLeadFollowupSchema(pool: Pool): Promise<void> {
  if (leadFollowupSchemaReady) return;
  // Per-connection follow-up message templates + seller notification targets.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_lead_followup_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      connection_id UUID NOT NULL,
      sms_body TEXT NOT NULL DEFAULT '',
      email_subject TEXT NOT NULL DEFAULT '',
      email_body TEXT NOT NULL DEFAULT '',
      notify_phone TEXT NOT NULL DEFAULT '',
      notify_email TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, connection_id)
    );
  `);
  // reply_to + ai_personalize added after the table shipped — additive, idempotent.
  await pool.query(
    `ALTER TABLE role_room_lead_followup_config ADD COLUMN IF NOT EXISTS reply_to TEXT NOT NULL DEFAULT '';`,
  );
  await pool.query(
    `ALTER TABLE role_room_lead_followup_config ADD COLUMN IF NOT EXISTS ai_personalize BOOLEAN NOT NULL DEFAULT false;`,
  );
  // Log of follow-ups sent (so we never double-send and can show "fulgt opp").
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_lead_followups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      connection_id UUID NOT NULL,
      form_id TEXT NOT NULL,
      lead_external_id TEXT NOT NULL,
      sms_sent BOOLEAN NOT NULL DEFAULT false,
      email_sent BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, lead_external_id)
    );
  `);
  await pool.query(
    `ALTER TABLE role_room_lead_followups ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN NOT NULL DEFAULT false;`,
  );
  leadFollowupSchemaReady = true;
}

async function getFollowupConfig(pool: Pool, userId: string, connectionId: string): Promise<FollowupConfig> {
  const r = await pool.query(
    `SELECT sms_body, email_subject, email_body, reply_to, notify_phone, notify_email, ai_personalize
       FROM role_room_lead_followup_config WHERE user_id = $1 AND connection_id = $2`,
    [userId, connectionId],
  );
  if (!r.rows[0]) return { ...DEFAULT_FOLLOWUP };
  const row = r.rows[0];
  return {
    smsBody: String(row.sms_body) || DEFAULT_FOLLOWUP.smsBody,
    emailSubject: String(row.email_subject) || DEFAULT_FOLLOWUP.emailSubject,
    emailBody: String(row.email_body) || DEFAULT_FOLLOWUP.emailBody,
    replyTo: String(row.reply_to || ""),
    notifyPhone: String(row.notify_phone || ""),
    notifyEmail: String(row.notify_email || ""),
    aiPersonalize: row.ai_personalize === true,
  };
}

/** Map of lead_external_id → ISO timestamp of when follow-up was sent. */
async function fetchFollowups(pool: Pool, userId: string, leadIds: string[]): Promise<Record<string, string>> {
  if (leadIds.length === 0) return {};
  const r = await pool.query(
    `SELECT lead_external_id, created_at FROM role_room_lead_followups
       WHERE user_id = $1 AND lead_external_id = ANY($2::text[])`,
    [userId, leadIds],
  );
  const map: Record<string, string> = {};
  for (const row of r.rows) map[String(row.lead_external_id)] = new Date(row.created_at).toISOString();
  return map;
}

/** Fill {navn} / {bedrift} placeholders. */
function renderTemplate(tpl: string, vars: { navn: string; bedrift: string }): string {
  return tpl
    .replace(/\{navn\}/g, vars.navn || "der")
    .replace(/\{bedrift\}/g, vars.bedrift || "oss");
}

// ── White-label sender domain (per connection, via Resend) ──────────────────
// Verify the CLIENT's own domain in Resend so follow-up can be sent from e.g.
// kontakt@tannlegen.no (true white-label) instead of no-reply@theroleroom.com.
const RESEND_API = "https://api.resend.com";
const RESEND_REGION = "eu-west-1";
function resendKey(): string {
  return process.env.ROLE_ROOM_RESEND_API_KEY || process.env.RESEND_API_KEY || "";
}

interface EmailDomainRow {
  domain: string;
  resendDomainId: string;
  fromAddress: string;
  status: string;
}

let emailDomainSchemaReady = false;
async function ensureEmailDomainSchema(pool: Pool): Promise<void> {
  if (emailDomainSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_lead_email_domain (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      connection_id UUID NOT NULL,
      domain TEXT NOT NULL,
      resend_domain_id TEXT NOT NULL,
      from_address TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, connection_id)
    );
  `);
  emailDomainSchemaReady = true;
}

async function getEmailDomain(pool: Pool, userId: string, connectionId: string): Promise<EmailDomainRow | null> {
  const r = await pool.query(
    `SELECT domain, resend_domain_id, from_address, status
       FROM role_room_lead_email_domain WHERE user_id = $1 AND connection_id = $2`,
    [userId, connectionId],
  );
  if (!r.rows[0]) return null;
  const row = r.rows[0];
  return {
    domain: String(row.domain),
    resendDomainId: String(row.resend_domain_id),
    fromAddress: String(row.from_address || ""),
    status: String(row.status || "pending"),
  };
}

/** Fetch a domain's status + DNS records from Resend. */
async function fetchResendDomain(domainId: string): Promise<{ status: string; records: any[] } | null> {
  const key = resendKey();
  if (!key) return null;
  const res = await fetch(`${RESEND_API}/domains/${encodeURIComponent(domainId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { status: String(json.status || "pending"), records: Array.isArray(json.records) ? json.records : [] };
}

function mapRecords(records: any[]): any[] {
  return records.map((r) => ({
    type: r.type,
    name: r.name,
    value: r.value,
    priority: r.priority ?? null,
    status: r.status ?? null,
    ttl: r.ttl ?? null,
  }));
}

/** Derive a Page access token from the stored long-lived user token. */
async function getPageToken(connection: InstagramConnectionRow): Promise<string> {
  try {
    const url =
      `${GRAPH}/${encodeURIComponent(connection.facebookPageId)}` +
      `?fields=access_token&access_token=${encodeURIComponent(connection.accessToken)}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as { access_token?: string };
    if (res.ok && json.access_token) return json.access_token;
  } catch {
    /* fall through to user token */
  }
  return connection.accessToken;
}

export function setupRoleRoomLeadsProducerRoutes(deps: RoleRoomLeadsProducerRoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  // ── GET /api/role-room/leads/producer/forms ─────────────────────────────
  app.get("/api/role-room/leads/producer/forms", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const connectionId = typeof req.query.connectionId === "string" ? req.query.connectionId : "";
    if (!connectionId) {
      res.status(400).json({ success: false, error: "connectionId is required" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      const fresh = await ensureFreshConnection(pool, connection);
      const pageToken = await getPageToken(fresh);
      const params = new URLSearchParams({ fields: FORM_FIELDS, access_token: pageToken });
      const upstream = await fetch(
        `${GRAPH}/${encodeURIComponent(fresh.facebookPageId)}/leadgen_forms?${params.toString()}`,
      );
      const body = (await upstream.json().catch(() => ({}))) as Record<string, any>;
      if (!upstream.ok) {
        res.status(200).json({
          success: false,
          error: body?.error?.message || `Graph ${upstream.status}`,
          forms: [],
        });
        return;
      }
      const data = Array.isArray(body.data) ? body.data : [];
      res.json({
        success: true,
        pageName: fresh.facebookPageName,
        forms: data.map((f: Record<string, any>) => ({
          id: f.id,
          name: f.name ?? "(uten navn)",
          status: f.status ?? null,
          leadsCount: typeof f.leads_count === "number" ? f.leads_count : null,
          createdTime: f.created_time ?? null,
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── GET /api/role-room/leads/producer/leads ─────────────────────────────
  app.get("/api/role-room/leads/producer/leads", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const connectionId = typeof req.query.connectionId === "string" ? req.query.connectionId : "";
    const formId = typeof req.query.formId === "string" ? req.query.formId : "";
    if (!connectionId || !formId) {
      res.status(400).json({ success: false, error: "connectionId and formId are required" });
      return;
    }
    const limit = typeof req.query.limit === "string" ? req.query.limit : "50";
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      const fresh = await ensureFreshConnection(pool, connection);
      const pageToken = await getPageToken(fresh);
      const params = new URLSearchParams({ fields: LEAD_FIELDS, limit, access_token: pageToken });
      const upstream = await fetch(
        `${GRAPH}/${encodeURIComponent(formId)}/leads?${params.toString()}`,
      );
      const body = (await upstream.json().catch(() => ({}))) as Record<string, any>;
      if (!upstream.ok) {
        res.status(200).json({
          success: false,
          error: body?.error?.message || `Graph ${upstream.status}`,
          leads: [],
        });
        return;
      }
      const data = Array.isArray(body.data) ? body.data : [];
      await ensureLeadSegmentSchema(pool);
      await ensureLeadRoiSchema(pool);
      await ensureLeadFollowupSchema(pool);
      const leadIds = data.map((l: Record<string, any>) => String(l.id));
      const segments = await fetchSegments(pool, session.userId, leadIds);
      const outcomes = await fetchOutcomes(pool, session.userId, leadIds);
      const followups = await fetchFollowups(pool, session.userId, leadIds);
      res.json({
        success: true,
        leads: data.map((lead: Record<string, any>) => {
          // field_data is [{name, values:[...]}, …] — flatten to a label→value map.
          const fields: Record<string, string> = {};
          for (const fd of Array.isArray(lead.field_data) ? lead.field_data : []) {
            if (fd?.name) fields[fd.name] = Array.isArray(fd.values) ? fd.values.join(", ") : "";
          }
          const outcome = outcomes[String(lead.id)];
          return {
            id: lead.id,
            createdTime: lead.created_time ?? null,
            name: fields.full_name || fields.name || null,
            email: fields.email || null,
            phone: fields.phone_number || fields.phone || null,
            segment: segments[String(lead.id)]?.segment ?? null,
            segmentReason: segments[String(lead.id)]?.reason ?? null,
            stage: outcome?.stage ?? null,
            valueKr: outcome?.valueKr ?? 0,
            followedUpAt: followups[String(lead.id)] ?? null,
            fields,
          };
        }),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── POST /api/role-room/leads/producer/segment ──────────────────────────
  // Tag a lead into a retargeting segment (varm/lunken/kald/tapt) or clear it.
  app.post("/api/role-room/leads/producer/segment", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as { connectionId?: string; leadId?: string; segment?: string | null };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const leadId = typeof body.leadId === "string" ? body.leadId : "";
    const segment = body.segment;
    if (!connectionId || !leadId) {
      res.status(400).json({ success: false, error: "connectionId and leadId are required" });
      return;
    }
    if (segment !== null && !VALID_SEGMENTS.includes(segment as LeadSegment)) {
      res.status(400).json({ success: false, error: "invalid segment" });
      return;
    }
    try {
      // Verify the connection belongs to this user (isolation).
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      await ensureLeadSegmentSchema(pool);
      if (segment === null) {
        await pool.query(
          `DELETE FROM role_room_lead_segments WHERE user_id = $1 AND lead_external_id = $2`,
          [session.userId, leadId],
        );
      } else {
        await pool.query(
          `INSERT INTO role_room_lead_segments (user_id, connection_id, lead_external_id, segment, reason, ai_suggested)
           VALUES ($1, $2, $3, $4, '', false)
           ON CONFLICT (user_id, lead_external_id)
           DO UPDATE SET segment = EXCLUDED.segment, connection_id = EXCLUDED.connection_id,
                         reason = '', ai_suggested = false, updated_at = now()`,
          [session.userId, connectionId, leadId, segment],
        );
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── POST /api/role-room/leads/producer/auto-segment ─────────────────────
  // AI suggests a retargeting segment (varm/lunken/kald) + reason for each
  // not-yet-segmented lead, based on its form answers. Only fills blanks — a
  // producer's manual choice is never overwritten.
  app.post("/api/role-room/leads/producer/auto-segment", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as {
      connectionId?: string;
      leads?: Array<{ id?: string; name?: string; email?: string; phone?: string; fields?: Record<string, string> }>;
    };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const leads = Array.isArray(body.leads) ? body.leads : [];
    if (!connectionId) {
      res.status(400).json({ success: false, error: "connectionId is required" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      await ensureLeadSegmentSchema(pool);
      // Only classify leads that don't already have a (manual or prior) segment.
      const ids = leads.map((l) => String(l.id || "")).filter(Boolean);
      const existing = await fetchSegments(pool, session.userId, ids);
      const todo = leads.filter((l) => l.id && !existing[String(l.id)]);
      if (todo.length === 0) {
        res.json({ success: true, applied: [], skipped: leads.length, message: "Alle leads er allerede segmentert." });
        return;
      }
      const bedrift = connection.facebookPageName || connection.igUsername || "bedriften";
      const compact = todo.slice(0, 40).map((l, i) => ({
        i,
        navn: l.name || null,
        felt: l.fields || {},
      }));
      const cachedSystem =
        "Du er en norsk salgsassistent for en lokal bedrift. Du klassifiserer innkommende leads (skjemasvar fra Facebook/Instagram-annonser) " +
        "i ett av tre segmenter for oppfølging:\n" +
        "- \"varm\": tydelig kjøpsintensjon / vil kontaktes nå / spør om pris, time eller booking.\n" +
        "- \"lunken\": interessert men trenger mer info, sammenligner, uforpliktende spørsmål.\n" +
        "- \"kald\": vag interesse, lastet ned guide, generell nysgjerrighet, lite signal.\n" +
        "Svar KUN med JSON: {\"results\":[{\"i\":<tall>,\"segment\":\"varm|lunken|kald\",\"reason\":\"kort norsk begrunnelse (maks 12 ord)\"}]}.";
      const userMessage =
        `Bedrift: ${bedrift}\nLeads (JSON):\n${JSON.stringify(compact)}\n\nKlassifiser hver lead. Bruk feltverdiene som signal.`;

      let results: Array<{ i: number; segment: string; reason: string }> = [];
      try {
        const out = await callClaudeForJson<{ results: Array<{ i: number; segment: string; reason: string }> }>({
          cachedSystem,
          userMessage,
          maxTokens: 1500,
        });
        results = Array.isArray(out.data?.results) ? out.data.results : [];
      } catch (e) {
        res.status(200).json({ success: false, error: `AI-segmentering feilet: ${e instanceof Error ? e.message : String(e)}` });
        return;
      }

      const applied: Array<{ id: string; segment: string; reason: string }> = [];
      for (const r of results) {
        const lead = compact[r.i] ? todo[r.i] : null;
        const segment = String(r.segment || "").toLowerCase();
        if (!lead?.id || !VALID_SEGMENTS.includes(segment as LeadSegment)) continue;
        const reason = String(r.reason || "").slice(0, 200);
        await pool.query(
          `INSERT INTO role_room_lead_segments (user_id, connection_id, lead_external_id, segment, reason, ai_suggested)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT (user_id, lead_external_id)
           DO UPDATE SET segment = EXCLUDED.segment, reason = EXCLUDED.reason, ai_suggested = true,
                         connection_id = EXCLUDED.connection_id, updated_at = now()`,
          [session.userId, connectionId, lead.id, segment, reason],
        );
        applied.push({ id: lead.id, segment, reason });
      }
      res.json({ success: true, applied, skipped: leads.length - applied.length });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── POST /api/role-room/leads/producer/retargeting-copy ─────────────────
  // AI writes ready-to-use retargeting ad copy for a segment (varm/lunken/kald),
  // tailored to what those leads asked about. Stateless.
  app.post("/api/role-room/leads/producer/retargeting-copy", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as {
      connectionId?: string; segment?: string;
      leads?: Array<{ fields?: Record<string, string> }>;
    };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const segment = String(body.segment || "").toLowerCase();
    if (!connectionId || !VALID_SEGMENTS.includes(segment as LeadSegment)) {
      res.status(400).json({ success: false, error: "connectionId and a valid segment are required" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      const bedrift = connection.facebookPageName || connection.igUsername || "bedriften";
      const segmentNote: Record<string, string> = {
        varm: "varme leads (høy kjøpsintensjon, vil kontaktes nå)",
        lunken: "lunkne leads (interessert, trenger mer info / vurderer)",
        kald: "kalde leads (vag interesse, trenger å bygge tillit)",
        tapt: "tapte leads (svarte ikke / kjøpte ikke – vinn dem tilbake)",
      };
      const sample = Array.isArray(body.leads) ? body.leads.slice(0, 30).map((l) => l.fields || {}) : [];
      const cachedSystem =
        "Du er en norsk annonsetekstforfatter for Meta (Facebook/Instagram) retargeting-annonser for en lokal bedrift. " +
        "Skriv konkret, troverdig og handlingsorientert – tilpasset hvor varmt segmentet er. Ingen klisjeer, ingen emoji-spam. " +
        "Svar KUN med JSON: {\"variants\":[{\"primaryText\":\"<hovedtekst, 2-4 setninger>\",\"headline\":\"<kort overskrift>\",\"description\":\"<én linje>\",\"cta\":\"<BOOK_NOW|LEARN_MORE|SIGN_UP|GET_QUOTE|CONTACT_US>\"}],\"audienceNote\":\"<kort tips om hvem/hvordan å målrette>\"}. Lag 2 varianter.";
      const userMessage =
        `Bedrift: ${bedrift}\nSegment: ${segmentNote[segment]}\n` +
        `Eksempel på hva disse leadsene spurte om (JSON): ${JSON.stringify(sample)}\n\n` +
        `Skriv 2 retargeting-annonsevarianter mot dette segmentet.`;
      const out = await callClaudeForJson<{
        variants: Array<{ primaryText: string; headline: string; description: string; cta: string }>;
        audienceNote: string;
      }>({ cachedSystem, userMessage, maxTokens: 1200 });
      res.json({
        success: true,
        segment,
        variants: Array.isArray(out.data?.variants) ? out.data.variants.slice(0, 3) : [],
        audienceNote: String(out.data?.audienceNote || ""),
      });
    } catch (error) {
      res.status(200).json({ success: false, error: `AI-annonsetekst feilet: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  // ── POST /api/role-room/leads/producer/insights ─────────────────────────
  // AI reads all the leads and returns what people ask about + content ideas
  // the producer can feed into the marketing plan / feed planner. Stateless.
  app.post("/api/role-room/leads/producer/insights", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as {
      connectionId?: string;
      leads?: Array<{ name?: string; segment?: string | null; fields?: Record<string, string> }>;
    };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const leads = Array.isArray(body.leads) ? body.leads : [];
    if (!connectionId) {
      res.status(400).json({ success: false, error: "connectionId is required" });
      return;
    }
    if (leads.length === 0) {
      res.status(200).json({ success: false, error: "Ingen leads å analysere ennå." });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      const bedrift = connection.facebookPageName || connection.igUsername || "bedriften";
      const compact = leads.slice(0, 120).map((l) => ({ segment: l.segment || null, felt: l.fields || {} }));
      const cachedSystem =
        "Du er en norsk markedsrådgiver for en lokal bedrift. Du analyserer innkommende leads (skjemasvar fra annonser) " +
        "og finner mønstre som hjelper bedriften å selge mer. Vær konkret og handlingsorientert. " +
        "Svar KUN med JSON: {" +
        "\"summary\":\"<2-3 setningers oppsummering>\"," +
        "\"themes\":[{\"label\":\"<hva folk spør om>\",\"count\":<antall>}]," +
        "\"contentIdeas\":[\"<konkret innleggs-/innholdsidé som svarer på et vanlig spørsmål>\"]," +
        "\"recommendedActions\":[\"<konkret neste steg for bedriften>\"]}.";
      const userMessage =
        `Bedrift: ${bedrift}\nAntall leads: ${leads.length}\nLeads (JSON): ${JSON.stringify(compact)}\n\n` +
        `Hva spør folk oftest om? Hvilke 3-5 innholdsidéer bør bedriften lage for å svare på det og få flere kunder?`;

      const out = await callClaudeForJson<{
        summary: string;
        themes: Array<{ label: string; count: number }>;
        contentIdeas: string[];
        recommendedActions: string[];
      }>({ cachedSystem, userMessage, maxTokens: 1500 });
      res.json({
        success: true,
        summary: String(out.data?.summary || ""),
        themes: Array.isArray(out.data?.themes) ? out.data.themes.slice(0, 8) : [],
        contentIdeas: Array.isArray(out.data?.contentIdeas) ? out.data.contentIdeas.slice(0, 8) : [],
        recommendedActions: Array.isArray(out.data?.recommendedActions) ? out.data.recommendedActions.slice(0, 6) : [],
      });
    } catch (error) {
      res.status(200).json({ success: false, error: `AI-innsikt feilet: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  // ── POST /api/role-room/leads/producer/outcome ──────────────────────────
  // Set a lead's conversion stage (svart/booket/kunde/tapt) + value (kr), or
  // clear it. Drives the ROI funnel the producer shows the client.
  app.post("/api/role-room/leads/producer/outcome", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as {
      connectionId?: string; formId?: string; leadId?: string;
      stage?: string | null; valueKr?: number;
    };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const formId = typeof body.formId === "string" ? body.formId : "";
    const leadId = typeof body.leadId === "string" ? body.leadId : "";
    const stage = body.stage;
    const valueKr = typeof body.valueKr === "number" && isFinite(body.valueKr) ? Math.max(0, body.valueKr) : 0;
    if (!connectionId || !formId || !leadId) {
      res.status(400).json({ success: false, error: "connectionId, formId and leadId are required" });
      return;
    }
    if (stage !== null && !VALID_STAGES.includes(stage as LeadStage)) {
      res.status(400).json({ success: false, error: "invalid stage" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      await ensureLeadRoiSchema(pool);
      if (stage === null) {
        await pool.query(
          `DELETE FROM role_room_lead_outcomes WHERE user_id = $1 AND lead_external_id = $2`,
          [session.userId, leadId],
        );
      } else {
        await pool.query(
          `INSERT INTO role_room_lead_outcomes (user_id, connection_id, form_id, lead_external_id, stage, value_kr)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, lead_external_id)
           DO UPDATE SET stage = EXCLUDED.stage, value_kr = EXCLUDED.value_kr,
                         connection_id = EXCLUDED.connection_id, form_id = EXCLUDED.form_id, updated_at = now()`,
          [session.userId, connectionId, formId, leadId, stage, valueKr],
        );
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── POST /api/role-room/leads/producer/spend ────────────────────────────
  // Store the ad spend (kr) for a form so cost-per-lead / ROI can be computed.
  app.post("/api/role-room/leads/producer/spend", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as { connectionId?: string; formId?: string; spendKr?: number };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const formId = typeof body.formId === "string" ? body.formId : "";
    const spendKr = typeof body.spendKr === "number" && isFinite(body.spendKr) ? Math.max(0, body.spendKr) : 0;
    if (!connectionId || !formId) {
      res.status(400).json({ success: false, error: "connectionId and formId are required" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      await ensureLeadRoiSchema(pool);
      await pool.query(
        `INSERT INTO role_room_lead_spend (user_id, connection_id, form_id, spend_kr)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, connection_id, form_id)
         DO UPDATE SET spend_kr = EXCLUDED.spend_kr, updated_at = now()`,
        [session.userId, connectionId, formId, spendKr],
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── GET /api/role-room/leads/producer/summary ───────────────────────────
  // ROI funnel for a form: spend → leads → cost/lead → answered → booked →
  // customers → revenue → ROI. Counts come from stored outcomes (independent of
  // pagination); totalLeads from the form's leads_count.
  app.get("/api/role-room/leads/producer/summary", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const connectionId = typeof req.query.connectionId === "string" ? req.query.connectionId : "";
    const formId = typeof req.query.formId === "string" ? req.query.formId : "";
    if (!connectionId || !formId) {
      res.status(400).json({ success: false, error: "connectionId and formId are required" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      await ensureLeadRoiSchema(pool);

      // Stored spend.
      const spendRow = await pool.query(
        `SELECT spend_kr FROM role_room_lead_spend WHERE user_id = $1 AND connection_id = $2 AND form_id = $3`,
        [session.userId, connectionId, formId],
      );
      const spendKr = spendRow.rows[0] ? Number(spendRow.rows[0].spend_kr) || 0 : 0;

      // Stage counts + revenue from stored outcomes.
      const stageRows = await pool.query(
        `SELECT stage, COUNT(*)::int AS n, COALESCE(SUM(value_kr), 0)::float AS sum_value
           FROM role_room_lead_outcomes
          WHERE user_id = $1 AND connection_id = $2 AND form_id = $3
          GROUP BY stage`,
        [session.userId, connectionId, formId],
      );
      const byStage: Record<string, { n: number; value: number }> = {};
      for (const r of stageRows.rows) byStage[String(r.stage)] = { n: Number(r.n) || 0, value: Number(r.sum_value) || 0 };

      // total leads from the form's leads_count (best-effort Graph call).
      let totalLeads = 0;
      try {
        const fresh = await ensureFreshConnection(pool, connection);
        const pageToken = await getPageToken(fresh);
        const upstream = await fetch(
          `${GRAPH}/${encodeURIComponent(formId)}?fields=leads_count&access_token=${encodeURIComponent(pageToken)}`,
        );
        const fb = (await upstream.json().catch(() => ({}))) as Record<string, any>;
        if (upstream.ok && typeof fb.leads_count === "number") totalLeads = fb.leads_count;
      } catch {
        /* leave totalLeads at 0 if Graph is unavailable */
      }

      // Funnel: a "kunde" is also booked+answered; "booket" is also answered.
      const customers = byStage.kunde?.n ?? 0;
      const booked = (byStage.booket?.n ?? 0) + customers;
      const answered = (byStage.svart?.n ?? 0) + booked;
      const lost = byStage.tapt?.n ?? 0;
      const revenueKr = byStage.kunde?.value ?? 0;
      const trackedLeads = Math.max(totalLeads, answered + lost);

      res.json({
        success: true,
        spendKr,
        totalLeads: trackedLeads,
        answered,
        booked,
        customers,
        lost,
        revenueKr,
        costPerLeadKr: trackedLeads > 0 ? spendKr / trackedLeads : 0,
        costPerCustomerKr: customers > 0 ? spendKr / customers : 0,
        roi: spendKr > 0 ? revenueKr / spendKr : 0,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── GET /api/role-room/leads/producer/followup-config ───────────────────
  app.get("/api/role-room/leads/producer/followup-config", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const connectionId = typeof req.query.connectionId === "string" ? req.query.connectionId : "";
    if (!connectionId) {
      res.status(400).json({ success: false, error: "connectionId is required" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      await ensureLeadFollowupSchema(pool);
      const config = await getFollowupConfig(pool, session.userId, connectionId);
      res.json({
        success: true,
        config,
        smsConfigured: smsConfigured(),
        emailConfigured: isTransactionalEmailConfigured(),
        whatsappConfigured: !!whatsappLeadConfig(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── POST /api/role-room/leads/producer/followup-config ──────────────────
  app.post("/api/role-room/leads/producer/followup-config", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as { connectionId?: string } & Partial<FollowupConfig>;
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    if (!connectionId) {
      res.status(400).json({ success: false, error: "connectionId is required" });
      return;
    }
    const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      await ensureLeadFollowupSchema(pool);
      await pool.query(
        `INSERT INTO role_room_lead_followup_config
           (user_id, connection_id, sms_body, email_subject, email_body, reply_to, notify_phone, notify_email, ai_personalize)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, connection_id)
         DO UPDATE SET sms_body = EXCLUDED.sms_body, email_subject = EXCLUDED.email_subject,
                       email_body = EXCLUDED.email_body, reply_to = EXCLUDED.reply_to,
                       notify_phone = EXCLUDED.notify_phone,
                       notify_email = EXCLUDED.notify_email, ai_personalize = EXCLUDED.ai_personalize,
                       updated_at = now()`,
        [
          session.userId, connectionId,
          str(body.smsBody, DEFAULT_FOLLOWUP.smsBody),
          str(body.emailSubject, DEFAULT_FOLLOWUP.emailSubject),
          str(body.emailBody, DEFAULT_FOLLOWUP.emailBody),
          str(body.replyTo),
          str(body.notifyPhone),
          str(body.notifyEmail),
          body.aiPersonalize === true,
        ],
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── POST /api/role-room/leads/producer/followup ─────────────────────────
  // Send the follow-up to ONE lead: auto-SMS + auto-email to the lead, plus a
  // notification to the seller/client. Idempotent — logged so we never re-send.
  app.post("/api/role-room/leads/producer/followup", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as {
      connectionId?: string; formId?: string; leadId?: string;
      name?: string; email?: string; phone?: string; fields?: Record<string, string>;
    };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const formId = typeof body.formId === "string" ? body.formId : "";
    const leadId = typeof body.leadId === "string" ? body.leadId : "";
    if (!connectionId || !formId || !leadId) {
      res.status(400).json({ success: false, error: "connectionId, formId and leadId are required" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      await ensureLeadFollowupSchema(pool);
      const config = await getFollowupConfig(pool, session.userId, connectionId);
      const bedrift = connection.facebookPageName || connection.igUsername || "oss";
      const navn = (body.name || "").split(" ")[0] || "";
      const leadPhone = (body.phone || "").trim();
      const leadEmail = (body.email || "").trim();

      let smsSent = false;
      let emailSent = false;
      const errors: string[] = [];

      // Default to the configured templates; optionally let Claude write a
      // personal message based on what the lead actually asked about.
      let smsText = renderTemplate(config.smsBody, { navn, bedrift });
      let subjectText = renderTemplate(config.emailSubject, { navn, bedrift });
      let emailBodyText = renderTemplate(config.emailBody, { navn, bedrift });
      if (config.aiPersonalize) {
        try {
          const out = await callClaudeForJson<{ smsBody: string; emailSubject: string; emailBody: string }>({
            cachedSystem:
              "Du skriver varm, kort og profesjonell norsk oppfølging fra en lokal bedrift til en person som nettopp meldte interesse via en annonse. " +
              "Referer naturlig til det personen spurte om. Ikke vær overivrig eller selgende. Ingen emoji. " +
              "Svar KUN med JSON: {\"smsBody\":\"<1-2 setninger, maks 320 tegn>\",\"emailSubject\":\"<kort>\",\"emailBody\":\"<2-4 setninger, signer med bedriftsnavn>\"}.",
            userMessage:
              `Bedrift: ${bedrift}\nPersonens fornavn: ${navn || "(ukjent)"}\n` +
              `Skjemasvar (JSON): ${JSON.stringify(body.fields || {})}\n\n` +
              `Mal (tone å matche) – SMS: "${config.smsBody}" | E-post: "${config.emailBody}"\n` +
              `Skriv en personlig oppfølging.`,
            maxTokens: 700,
          });
          if (out.data?.smsBody) smsText = String(out.data.smsBody).slice(0, 480);
          if (out.data?.emailSubject) subjectText = String(out.data.emailSubject).slice(0, 200);
          if (out.data?.emailBody) emailBodyText = String(out.data.emailBody).slice(0, 4000);
        } catch (e) {
          errors.push(`AI-personalisering feilet, brukte mal: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // 1) SMS to the lead.
      if (leadPhone && smsConfigured()) {
        try {
          await sendSms(leadPhone, smsText);
          smsSent = true;
        } catch (e) { errors.push(`SMS: ${e instanceof Error ? e.message : String(e)}`); }
      }
      // White-label: if the client's own domain is verified, send from their
      // address (e.g. kontakt@tannlegen.no) instead of no-reply@theroleroom.com.
      await ensureEmailDomainSchema(pool);
      const domainCfg = await getEmailDomain(pool, session.userId, connectionId);
      const whiteLabelFrom =
        domainCfg && domainCfg.status === "verified" && domainCfg.fromAddress
          ? domainCfg.fromAddress
          : null;

      // 2) Email to the lead.
      if (leadEmail && isTransactionalEmailConfigured()) {
        try {
          const text = emailBodyText;
          const result = await sendTransactionalEmail({
            to: leadEmail,
            subject: subjectText,
            text,
            html: text.replace(/\n/g, "<br>"),
            fromLabel: bedrift,
            fromAddress: whiteLabelFrom,
            // Replies from the lead go to the client's own inbox, not no-reply.
            replyTo: config.replyTo || config.notifyEmail || null,
            kind: "lead_followup",
            pool,
            sentByUserId: session.userId,
          });
          emailSent = result.sent;
          if (!result.sent && result.errorMessage) errors.push(`E-post: ${result.errorMessage}`);
        } catch (e) { errors.push(`E-post: ${e instanceof Error ? e.message : String(e)}`); }
      }
      // 2b) WhatsApp to the lead (via an approved template), when configured.
      let whatsappSent = false;
      const waCfg = whatsappLeadConfig();
      if (leadPhone && waCfg) {
        try {
          const r = await sendWhatsAppLeadFollowup({
            config: waCfg.config,
            to: leadPhone,
            templateName: waCfg.templateName,
            bodyParams: [navn || "der", bedrift],
          });
          whatsappSent = r.success;
          if (!r.success && r.error) errors.push(`WhatsApp: ${r.error}`);
        } catch (e) { errors.push(`WhatsApp: ${e instanceof Error ? e.message : String(e)}`); }
      }
      // 3) Notify the seller/client about the new lead.
      const sellerMsg = `Ny lead fra annonsen: ${body.name || "(uten navn)"}${leadPhone ? `, ${leadPhone}` : ""}${leadEmail ? `, ${leadEmail}` : ""}`;
      if (config.notifyPhone && smsConfigured()) {
        try { await sendSms(config.notifyPhone, sellerMsg); } catch { /* best-effort */ }
      }
      if (config.notifyEmail && isTransactionalEmailConfigured()) {
        try {
          await sendTransactionalEmail({
            to: config.notifyEmail,
            subject: `Ny lead: ${body.name || "ny henvendelse"}`,
            text: sellerMsg,
            html: sellerMsg,
            fromLabel: "The Role Room",
            kind: "lead_seller_notice",
            pool,
            sentByUserId: session.userId,
          });
        } catch { /* best-effort */ }
      }

      // Log (idempotent) so the lead shows "fulgt opp" and we don't re-send.
      await pool.query(
        `INSERT INTO role_room_lead_followups (user_id, connection_id, form_id, lead_external_id, sms_sent, email_sent, whatsapp_sent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, lead_external_id)
         DO UPDATE SET sms_sent = role_room_lead_followups.sms_sent OR EXCLUDED.sms_sent,
                       email_sent = role_room_lead_followups.email_sent OR EXCLUDED.email_sent,
                       whatsapp_sent = role_room_lead_followups.whatsapp_sent OR EXCLUDED.whatsapp_sent`,
        [session.userId, connectionId, formId, leadId, smsSent, emailSent, whatsappSent],
      );

      res.json({ success: true, smsSent, emailSent, whatsappSent, errors });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── GET /api/role-room/leads/producer/email-domain ──────────────────────
  // Current white-label domain for a connection + live status/DNS from Resend.
  app.get("/api/role-room/leads/producer/email-domain", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const connectionId = typeof req.query.connectionId === "string" ? req.query.connectionId : "";
    if (!connectionId) {
      res.status(400).json({ success: false, error: "connectionId is required" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      await ensureEmailDomainSchema(pool);
      const row = await getEmailDomain(pool, session.userId, connectionId);
      if (!row) {
        res.json({ success: true, configured: false });
        return;
      }
      // Refresh live status + records from Resend.
      let status = row.status;
      let records: any[] = [];
      const live = await fetchResendDomain(row.resendDomainId);
      if (live) {
        status = live.status;
        records = mapRecords(live.records);
        if (status !== row.status) {
          await pool.query(
            `UPDATE role_room_lead_email_domain SET status = $1, updated_at = now() WHERE user_id = $2 AND connection_id = $3`,
            [status, session.userId, connectionId],
          );
        }
      }
      res.json({
        success: true,
        configured: true,
        domain: row.domain,
        fromAddress: row.fromAddress,
        status,
        records,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── POST /api/role-room/leads/producer/email-domain ─────────────────────
  // Register the client's own domain in Resend → returns the DNS records the
  // client must add. body { connectionId, domain, fromAddress }
  app.post("/api/role-room/leads/producer/email-domain", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as { connectionId?: string; domain?: string; fromAddress?: string };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const domain = (typeof body.domain === "string" ? body.domain : "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const fromAddress = (typeof body.fromAddress === "string" ? body.fromAddress : "").trim().toLowerCase();
    if (!connectionId || !domain) {
      res.status(400).json({ success: false, error: "connectionId and domain are required" });
      return;
    }
    if (fromAddress && !fromAddress.endsWith(`@${domain}`)) {
      res.status(400).json({ success: false, error: `from-adressen må slutte på @${domain}` });
      return;
    }
    const key = resendKey();
    if (!key) {
      res.status(200).json({ success: false, error: "resend_not_configured" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      await ensureEmailDomainSchema(pool);
      // Create (or reuse) the domain in Resend.
      const createRes = await fetch(`${RESEND_API}/domains`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: domain, region: RESEND_REGION }),
      });
      const created = (await createRes.json().catch(() => ({}))) as Record<string, any>;
      if (!createRes.ok || !created.id) {
        res.status(200).json({
          success: false,
          error: created?.message || created?.error?.message || `Resend ${createRes.status}`,
        });
        return;
      }
      await pool.query(
        `INSERT INTO role_room_lead_email_domain (user_id, connection_id, domain, resend_domain_id, from_address, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, connection_id)
         DO UPDATE SET domain = EXCLUDED.domain, resend_domain_id = EXCLUDED.resend_domain_id,
                       from_address = EXCLUDED.from_address, status = EXCLUDED.status, updated_at = now()`,
        [session.userId, connectionId, domain, String(created.id), fromAddress, String(created.status || "pending")],
      );
      res.json({
        success: true,
        domain,
        fromAddress,
        status: String(created.status || "pending"),
        records: mapRecords(Array.isArray(created.records) ? created.records : []),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ── POST /api/role-room/leads/producer/email-domain/verify ──────────────
  app.post("/api/role-room/leads/producer/email-domain/verify", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as { connectionId?: string };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    if (!connectionId) {
      res.status(400).json({ success: false, error: "connectionId is required" });
      return;
    }
    const key = resendKey();
    if (!key) {
      res.status(200).json({ success: false, error: "resend_not_configured" });
      return;
    }
    try {
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      await ensureEmailDomainSchema(pool);
      const row = await getEmailDomain(pool, session.userId, connectionId);
      if (!row) {
        res.status(404).json({ success: false, error: "no_domain" });
        return;
      }
      // Trigger Resend verification, then read back status + records.
      await fetch(`${RESEND_API}/domains/${encodeURIComponent(row.resendDomainId)}/verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
      }).catch(() => null);
      const live = await fetchResendDomain(row.resendDomainId);
      const status = live ? live.status : row.status;
      await pool.query(
        `UPDATE role_room_lead_email_domain SET status = $1, updated_at = now() WHERE user_id = $2 AND connection_id = $3`,
        [status, session.userId, connectionId],
      );
      res.json({ success: true, status, records: live ? mapRecords(live.records) : [] });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });
}
