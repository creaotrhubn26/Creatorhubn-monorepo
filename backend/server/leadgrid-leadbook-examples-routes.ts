/**
 * leadgrid-leadbook-examples-routes.ts
 *
 * Leadbook «Eksempler» — org-egne salgssamtale-caser (2026-07-17).
 * Erstatter mock-casene: organisasjonens egne vunnede/tapte samtaler,
 * kuratert av ledere, med tilbakemeldinger fra salgssjef/teamleder.
 *
 * Prefix: /api/leadgrid/leadbook/examples*
 *
 * Auth-modell:
 *   • Innlogging kreves overalt; org utledes av medlemskap (aldri fra body).
 *   • Lese: alle org-medlemmer ser `published`; ledere ser også `draft`.
 *   • Skrive (opprett/rediger/publiser/arkiver): admin|salgssjef|teamleder|kvalitet.
 *   • Tilbakemelding: admin|salgssjef|teamleder (Daniel 2026-07-17:
 *     «salgsleder og teamleder kan gi tilbakemelding på salgssamtalene»).
 *   • Entitlement: leadbookEksempler (feature-matrisen) på alle endepunkter.
 *
 * Forutsetter mig 0379 (leadbook_examples + leadbook_example_feedback).
 * Fylles også fra Kvalitet: verdikt-endepunktet oppretter draft ved
 * `flag_as_example` (se leadgrid-quality-routes.ts).
 */

import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";
import {
  assertAnyEntitledForOrganization,
  LEADBOOK_AI_STRUKTUR_FEATURE_KEYS,
} from "./leadgrid-entitlement-guard.js";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";
import { sendAPNs } from "./lead-map-apns-client.js";
import { withAIQuota } from "./leadgrid-ai-queue.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Fakturering av AI-kall — samme løype som leadgrid-overage-billing.ts:
// daglig cron → Stripe meter-events → billed_at-stempel. Krever at meteret
// (event_name under) + pris er satt opp i Stripe før verdien faktureres.
const AI_CRON_TOKEN = process.env.LEADGRID_CRON_TRIGGER_TOKEN ?? "";
const AI_METER_EVENT_NAME = process.env.STRIPE_LEADGRID_AI_METER_EVENT_NAME
  ?? "leadgrid_ai_structure_call";
const AI_STRIPE_KEY = process.env.CREATORHUB_STRIPE_SECRET_KEY
  ?? process.env.STRIPE_SECRET_KEY
  ?? "";

async function reportAIMeterEvent(
  identifier: string, stripeCustomerId: string, valueUnits: number,
  timestampUnix: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!AI_STRIPE_KEY) return { ok: false, error: "Stripe ikke konfigurert" };
  try {
    const body = new URLSearchParams();
    body.set("event_name", AI_METER_EVENT_NAME);
    body.set("identifier", identifier);
    body.set("timestamp", String(timestampUnix));
    body.set("payload[stripe_customer_id]", stripeCustomerId);
    body.set("payload[value]", String(valueUnits));
    const r = await fetch("https://api.stripe.com/v1/billing/meter_events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!r.ok) {
      const t = await r.text();
      return { ok: false, error: `Stripe ${r.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export interface LeadbookExamplesRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

const EXAMPLES_FEATURE_KEYS = ["leadbookEksempler"];
const WRITE_ROLES = new Set(["owner", "admin", "salgssjef", "teamleder", "kvalitet"]);
const FEEDBACK_ROLES = new Set(["owner", "admin", "salgssjef", "teamleder"]);
const VALID_STATUS = new Set(["draft", "published", "archived"]);
const VALID_OUTCOME = new Set(["won", "lost", "ongoing"]);
const VALID_CHANNEL = new Set(["field", "telephone", "email", "video"]);
const VALID_DIMENSIONS = new Set([
  "autoritet", "klarhet", "troverdighet", "trygghet", "fremdrift",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function intOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function jsonArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function bounded(v: unknown, max: number): string | null {
  const value = str(v).trim();
  return value.length <= max ? value : null;
}

function normalizedChannel(v: unknown): string | null {
  const value = str(v, "telephone").toLowerCase();
  const canonical = ["phone", "telefon", "telefonen"].includes(value)
    ? "telephone"
    : value;
  return VALID_CHANNEL.has(canonical) ? canonical : null;
}

function optionalBoundedInteger(
  value: unknown, min: number, max: number,
): { valid: boolean; value: number | null } {
  if (value === undefined || value === null || value === "") {
    return { valid: true, value: null };
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    return { valid: false, value: null };
  }
  return { valid: true, value: parsed };
}

function validClientActionId(value: unknown): string | null {
  const id = str(value).trim();
  return id && UUID_RE.test(id) ? id : null;
}

function leadbookExampleDeepLink(
  exampleId: string,
  projectId: string,
  organizationId: string,
): string {
  return `leadgrid://leadbook/examples/${encodeURIComponent(exampleId)}`
    + `?projectId=${encodeURIComponent(projectId)}`
    + `&organizationId=${encodeURIComponent(organizationId)}`;
}

type ExampleCursor = { createdAt: string; id: string };

function decodeExampleCursor(value: unknown): ExampleCursor | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as ExampleCursor;
    if (!UUID_RE.test(decoded.id) || Number.isNaN(Date.parse(decoded.createdAt))) return null;
    return decoded;
  } catch {
    return null;
  }
}

function encodeExampleCursor(row: { created_at: string | Date; id: string }): string {
  const createdAt = row.created_at instanceof Date
    ? row.created_at.toISOString()
    : String(row.created_at);
  return Buffer.from(JSON.stringify({ createdAt, id: row.id }), "utf8").toString("base64url");
}

// Regex-basert PII-maskering (§6 i docs/leadgrid-gdpr-lydopptak.md) — kjøres
// automatisk ved draft→published-overgang. Fanger STRUKTURERT PII (telefon,
// e-post, org.nr) pålitelig; navn/adresser er for fuzzy for regex alene —
// doc-en forutsetter et LLM-pass i tillegg (kjøres on-device i appen, se
// LeadbookAnonymizer.swift, FØR denne PATCH-en sendes). Denne backend-
// regex-en er sikkerhetsnettet som alltid kjører, uansett om klienten
// hadde on-device AI tilgjengelig.
const PII_PATTERNS: [RegExp, string][] = [
  // Norske telefonnumre: +47 XXX XX XXX, 8 sammenhengende siffer, med/uten mellomrom.
  [/(\+?47[\s.-]?)?\b\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}\b/g, "[telefon]"],
  [/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/g, "[e-post]"],
  // Org.nr: 9 siffer, evt. gruppert 3-3-3.
  [/\b\d{3}[\s]?\d{3}[\s]?\d{3}\b/g, "[org.nr]"],
];

export function anonymizeText(t: string): string {
  let out = t;
  for (const [re, replacement] of PII_PATTERNS) out = out.replace(re, replacement);
  return out;
}

export function anonymizeTranscript(transcript: unknown): unknown[] {
  return jsonArr(transcript).map((line) => {
    if (line && typeof line === "object" && "text" in line) {
      const l = line as Record<string, unknown>;
      return { ...l, text: typeof l.text === "string" ? anonymizeText(l.text) : l.text };
    }
    return line;
  });
}

export function registerLeadgridLeadbookExamplesRoutes(
  deps: LeadbookExamplesRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  // Felles inngangsvakt: sesjon + eksplisitt prosjekt-ACL + prosjektets org
  // + entitlement. Organisasjon utledes aldri fra første medlemskap.
  async function guard(
    req: Request, res: Response,
  ): Promise<{
    session: SessionUser; orgId: string; projectId: string; role: string | null;
  } | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const projectId = str(
      req.body?.projectId ?? req.body?.project_id
        ?? req.query.projectId ?? req.query.project_id,
    ).trim();
    if (!projectId || projectId.length > 255 || /[\u0000-\u001f\u007f]/.test(projectId)) {
      res.status(400).json({ error: "project_id_required" });
      return null;
    }
    let project;
    try {
      project = await loadAccessibleLeadgridProject(pool, projectId, session.userId);
    } catch (error) {
      console.warn("[leadbook-examples] project scope failed:", (error as Error).message);
      res.status(500).json({ error: "project_scope_failed" });
      return null;
    }
    if (!project) {
      res.status(404).json({ error: "project_not_found" });
      return null;
    }
    const claimedOrgId = str(
      req.body?.organizationId ?? req.body?.organization_id
        ?? req.query.organizationId ?? req.query.organization_id,
    ).trim();
    if (claimedOrgId
        && claimedOrgId.toLowerCase() !== project.organizationId.toLowerCase()) {
      res.status(409).json({ error: "organization_project_mismatch" });
      return null;
    }
    const ok = await assertAnyEntitledForOrganization(
      pool, project.organizationId, EXAMPLES_FEATURE_KEYS, res,
    );
    if (!ok) return null;
    return {
      session,
      orgId: project.organizationId,
      projectId: project.id,
      role: project.memberRole || null,
    };
  }

  // ── GET /api/leadgrid/leadbook/examples ───────────────────────────
  // Paginert SUMMARY-liste. Tunge transcript/key_moments/reply-felter
  // hentes kun fra detail-endepunktet under.
  app.get("/api/leadgrid/leadbook/examples", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    const isLeder = g.role != null && WRITE_ROLES.has(g.role);
    const requestedLimit = Number(req.query.limit ?? 30);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.trunc(requestedLimit), 50))
      : 30;
    const cursorRaw = req.query.cursor;
    const cursor = decodeExampleCursor(cursorRaw);
    if (cursorRaw != null && !cursor) {
      return res.status(400).json({ error: "ugyldig_cursor" });
    }
    try {
      const r = await pool.query(
        `SELECT id, status, title, customer_label, industry, outcome, channel,
                duration_sec, seller_user_id, seller_name, happened_on,
                pondus_score, featured_dimension, dimension_scores,
                key_learnings, deal_value_nok, summary, created_by,
                created_by_name, created_at, updated_at, source_consent_id,
                delete_requested_at, anonymized_at
           FROM leadbook_examples
          WHERE organization_id = $1 AND project_id = $2 AND status <> 'archived'
            AND (
              status = 'published'
              OR $3
              OR (status = 'draft' AND seller_user_id = $4)
            )
            AND (
              $5::timestamptz IS NULL
              OR (created_at, id) < ($5::timestamptz, $6::uuid)
            )
          ORDER BY created_at DESC, id DESC
          LIMIT $7`,
        [g.orgId, g.projectId, isLeder, g.session.userId,
         cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
      );
      const hasMore = r.rows.length > limit;
      const page = r.rows.slice(0, limit);
      const ids = page.map((row) => row.id);
      // Visningstall (2026-07-17, distribusjon): kun for ledere — «så
      // ledere ser hva som faktisk brukes».
      let views: Record<string, { views_total: number; viewers: number }> = {};
      if (isLeder && ids.length > 0) {
        const vr = await pool.query<{
          example_id: string; views_total: number; viewers: number;
        }>(
          `SELECT example_id, SUM(view_count)::int AS views_total,
                  COUNT(*)::int AS viewers
             FROM leadbook_example_views
            WHERE organization_id = $1 AND project_id = $2
              AND example_id = ANY($3::uuid[])
            GROUP BY example_id`,
          [g.orgId, g.projectId, ids],
        );
        views = Object.fromEntries(vr.rows.map((row) => [
          row.example_id,
          { views_total: row.views_total, viewers: row.viewers },
        ]));
      }
      return res.json({
        projectId: g.projectId,
        examples: page.map((row) => ({
          ...row,
          views_total: views[row.id]?.views_total ?? null,
          viewers_count: views[row.id]?.viewers ?? null,
          can_request_deletion:
            isLeder || row.seller_user_id === g.session.userId,
        })),
        nextCursor: hasMore && page.length > 0
          ? encodeExampleCursor(page[page.length - 1])
          : null,
        canEdit: isLeder,
        canCreateDraft: true,
        canGiveFeedback: g.role != null && FEEDBACK_ROLES.has(g.role),
      });
    } catch (err) {
      console.warn("[leadbook-examples] list failed:", (err as Error).message);
      return res.status(500).json({ error: "list_failed" });
    }
  });

  // ── GET /api/leadgrid/leadbook/examples/:id ──────────────────────
  // Full detail for one visible example. Keeps transcript and coaching
  // dialogue out of the collection response.
  app.get("/api/leadgrid/leadbook/examples/:id", async (req, res, next) => {
    const exampleId = str(req.params.id).trim();
    // Keep this route compatible with Express 4 and 5. Static GET routes
    // such as /examples/ai-usage are registered later and must fall through.
    if (!UUID_RE.test(exampleId)) {
      next();
      return;
    }
    const g = await guard(req, res);
    if (!g) return;
    const isLeder = g.role != null && WRITE_ROLES.has(g.role);
    try {
      const result = await pool.query(
        `SELECT * FROM leadbook_examples
          WHERE id = $1::uuid AND organization_id = $2 AND project_id = $3
            AND status <> 'archived'
            AND (
              status = 'published'
              OR $4
              OR (status = 'draft' AND seller_user_id = $5)
            )
          LIMIT 1`,
        [exampleId, g.orgId, g.projectId, isLeder, g.session.userId],
      );
      const example = result.rows[0];
      if (!example) return res.status(404).json({ error: "ikke_funnet" });

      const feedbackResult = await pool.query(
        `SELECT * FROM leadbook_example_feedback
          WHERE example_id = $1::uuid AND organization_id = $2 AND project_id = $3
          ORDER BY created_at ASC`,
        [exampleId, g.orgId, g.projectId],
      );
      const feedbackIds = feedbackResult.rows.map((row) => row.id);
      let replies: Record<string, unknown[]> = {};
      if (feedbackIds.length > 0) {
        const replyResult = await pool.query(
          `SELECT * FROM leadbook_feedback_replies
            WHERE feedback_id = ANY($1::uuid[]) AND organization_id = $2
              AND project_id = $3
            ORDER BY created_at ASC`,
          [feedbackIds, g.orgId, g.projectId],
        );
        replies = replyResult.rows.reduce((acc: Record<string, unknown[]>, row) => {
          (acc[row.feedback_id] ??= []).push(row);
          return acc;
        }, {});
      }
      return res.json({
        projectId: g.projectId,
        example: {
          ...example,
          feedback: feedbackResult.rows.map((row) => ({
            ...row,
            replies: replies[row.id] ?? [],
          })),
          can_request_deletion:
            isLeder || example.seller_user_id === g.session.userId,
        },
        canEdit: isLeder,
        canCreateDraft: true,
        canGiveFeedback: g.role != null && FEEDBACK_ROLES.has(g.role),
      });
    } catch (err) {
      console.warn("[leadbook-examples] detail failed:", (err as Error).message);
      return res.status(500).json({ error: "detail_failed" });
    }
  });

  // ── GET /api/leadgrid/leadbook/innsikt ────────────────────────────
  // Ekte innsikt-aggregering (2026-08-02 — fanen viste kun demo-data,
  // prod sto på «Ingen innsikt enda»). Aggregerer org-ens PUBLISERTE
  // eksempler + tilbakemeldinger for valgt periode (7d|30d|90d|ytd),
  // med forrige like lang periode som sammenligningsgrunnlag.
  // Lese-endepunkt for alle org-medlemmer (samme entitlement som resten).
  app.get("/api/leadgrid/leadbook/innsikt", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    const period = str(req.query.period as unknown, "30d");
    // days er server-utledet heltall → trygt å interpolere i INTERVAL.
    const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "ytd" ? null : 30;
    const fromExpr = days == null
      ? `date_trunc('year', NOW())`
      : `NOW() - INTERVAL '${days} days'`;
    // Forrige periode: like langt vindu rett før `from` (ytd: like mange
    // dager før nyttår som det har gått av året).
    const prevFromExpr = days == null
      ? `date_trunc('year', NOW()) - (NOW() - date_trunc('year', NOW()))`
      : `NOW() - INTERVAL '${days * 2} days'`;
    const base = `FROM leadbook_examples
    WHERE organization_id = $1 AND project_id = $2 AND status = 'published'`;
    const totalsSelect = `SELECT COUNT(*)::int AS examples,
          COUNT(*) FILTER (WHERE outcome = 'won')::int AS won,
          COUNT(*) FILTER (WHERE outcome = 'lost')::int AS lost,
          COUNT(*) FILTER (WHERE outcome = 'ongoing')::int AS ongoing,
          ROUND(AVG(pondus_score) FILTER (WHERE pondus_score > 0))::int AS avg_pondus`;
    try {
      const [totals, previous, trend, sellers, dims, channels, top, bottom, fb] =
        await Promise.all([
          pool.query(
            `${totalsSelect} ${base} AND created_at >= ${fromExpr}`,
            [g.orgId, g.projectId],
          ),
          pool.query(
            `${totalsSelect} ${base}
              AND created_at >= ${prevFromExpr} AND created_at < ${fromExpr}`,
            [g.orgId, g.projectId],
          ),
          pool.query(
            `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                    COUNT(*)::int AS count,
                    ROUND(AVG(pondus_score) FILTER (WHERE pondus_score > 0))::int AS avg_pondus
               ${base} AND created_at >= ${fromExpr}
              GROUP BY 1 ORDER BY 1`,
            [g.orgId, g.projectId],
          ),
          pool.query(
            `SELECT COALESCE(NULLIF(TRIM(seller_name), ''),
                             NULLIF(TRIM(created_by_name), ''), 'Ukjent') AS name,
                    COUNT(*)::int AS count,
                    ROUND(AVG(pondus_score) FILTER (WHERE pondus_score > 0))::int AS avg_pondus,
                    COUNT(*) FILTER (WHERE outcome = 'won')::int AS won,
                    COUNT(*) FILTER (WHERE outcome = 'lost')::int AS lost
               ${base} AND created_at >= ${fromExpr}
              GROUP BY 1 ORDER BY count DESC, avg_pondus DESC NULLS LAST LIMIT 10`,
            [g.orgId, g.projectId],
          ),
          pool.query(
            `SELECT featured_dimension AS dimension,
                    COUNT(*)::int AS count,
                    ROUND(AVG(pondus_score) FILTER (WHERE pondus_score > 0))::int AS avg_pondus
               ${base} AND created_at >= ${fromExpr}
                AND featured_dimension IS NOT NULL AND featured_dimension <> ''
              GROUP BY 1 ORDER BY count DESC`,
            [g.orgId, g.projectId],
          ),
          pool.query(
            `SELECT channel, COUNT(*)::int AS count,
                    COUNT(*) FILTER (WHERE outcome = 'won')::int AS won,
                    COUNT(*) FILTER (WHERE outcome = 'lost')::int AS lost
               ${base} AND created_at >= ${fromExpr}
              GROUP BY 1 ORDER BY count DESC`,
            [g.orgId, g.projectId],
          ),
          pool.query(
            `SELECT id, title, summary, outcome, pondus_score
               ${base} AND created_at >= ${fromExpr} AND pondus_score > 0
              ORDER BY pondus_score DESC LIMIT 1`,
            [g.orgId, g.projectId],
          ),
          pool.query(
            `SELECT id, title, summary, outcome, pondus_score
               ${base} AND created_at >= ${fromExpr} AND pondus_score > 0
              ORDER BY pondus_score ASC LIMIT 1`,
            [g.orgId, g.projectId],
          ),
          pool.query(
            `SELECT COUNT(*)::int AS count
               FROM leadbook_example_feedback f
               JOIN leadbook_examples e
                 ON e.id = f.example_id
                AND e.organization_id = f.organization_id
                AND e.project_id = f.project_id
              WHERE e.organization_id = $1 AND e.project_id = $2
                AND f.organization_id = $1 AND f.project_id = $2
                AND f.created_at >= ${fromExpr}`,
            [g.orgId, g.projectId],
          ),
        ]);
      const topRow = top.rows[0] ?? null;
      const bottomRow = bottom.rows[0] ?? null;
      return res.json({
        projectId: g.projectId,
        period,
        totals: {
          ...(totals.rows[0] ?? {}),
          feedback: fb.rows[0]?.count ?? 0,
        },
        previous: previous.rows[0] ?? {},
        trend: trend.rows,
        by_seller: sellers.rows,
        by_dimension: dims.rows,
        by_channel: channels.rows,
        top_example: topRow,
        // Ikke gjenta samme eksempel som både topp og bunn (1 eksempel).
        bottom_example: bottomRow && topRow && bottomRow.id === topRow.id
          ? null
          : bottomRow,
      });
    } catch (err) {
      console.warn("[leadbook-examples] innsikt failed:", (err as Error).message);
      return res.status(500).json({ error: "innsikt_failed" });
    }
  });

  // ── POST /api/leadgrid/leadbook/examples/structure ────────────────
  // LLM-strukturering (2026-07-17, Daniel: forbedring #1 — senk terskelen
  // for innhold): leder limer inn rå notater/referat → Claude strukturerer
  // til eksempel-feltene (transkript, Pondus-scores, lærdommer). Kun
  // forslag — lederen redigerer og lagrer selv via POST /examples.
  app.post("/api/leadgrid/leadbook/examples/structure", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !WRITE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    // Egen feature-matrise-nøkkel (2026-07-17), DEFAULT AV: standard-
    // semantikken er fail-open (ingen rad = åpen), men AI-kall koster
    // penger — her kreves EKSPLISITT åpning i SuperAdmin-matrisen.
    // Appen skjuler all AI-UI når nøkkelen mangler/er låst.
    try {
      const aiRow = await pool.query<{ state: string }>(
        `SELECT state FROM leadgrid_org_entitlements
          WHERE organization_id = $1 AND feature_key = $2 LIMIT 1`,
        [g.orgId, LEADBOOK_AI_STRUKTUR_FEATURE_KEYS[0]],
      );
      const aiState = aiRow.rows[0]?.state ?? null;
      if (aiState == null || aiState === "locked") {
        return res.status(403).json({
          error: "entitlement_locked",
          features: LEADBOOK_AI_STRUKTUR_FEATURE_KEYS,
        });
      }
    } catch (e) {
      // Fail-CLOSED for kostnadsbærende AI (motsatt av guard-ens fail-open).
      console.warn("[leadbook-examples] ai-entitlement-sjekk feilet:", (e as Error).message);
      return res.status(503).json({ error: "entitlement_utilgjengelig" });
    }
    const raw = str((req.body ?? {}).raw_text).trim();
    if (raw.length < 40) {
      return res.status(400).json({ error: "for_kort_tekst" });
    }
    if (!ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: "ai_ikke_konfigurert" });
    }
    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const prompt = `Du er en norsk salgscoach-ekspert. En salgsleder har limt inn rå notater/referat fra en salgssamtale. Strukturer det til et lærings-eksempel. Returner KUN gyldig JSON i nøyaktig dette skjemaet (norsk innhold):

{
  "title": "<kort beskrivende tittel, f.eks. 'Prisinnvending snudd med referansekunde'>",
  "summary": "<2-3 setninger>",
  "outcome": "won|lost|ongoing",
  "transcript": [{"speaker": "Selger|Kunde|Notat", "text": "..."}],
  "key_learnings": ["<3-5 konkrete lærdommer>"],
  "alternative_phrasings": ["<0-3 forslag til bedre formuleringer>"],
  "dimension_scores": {"autoritet": 0-100, "klarhet": 0-100, "troverdighet": 0-100, "trygghet": 0-100, "fremdrift": 0-100},
  "featured_dimension": "autoritet|klarhet|troverdighet|trygghet|fremdrift",
  "pondus_score": 0-100
}

Regler: transcript skal gjengi samtalen som replikker — bruk teksten ordrett der den er sitert, parafraser forsiktig der den er referert (marker parafraser som speaker "Notat"). dimension_scores skal reflektere selgerens prestasjon i samtalen. featured_dimension = dimensjonen med mest læringsverdi. Ikke finn på fakta som ikke står i notatene.

Rå notater:
${raw.slice(0, 12_000)}`;
      const msg = await withAIQuota("claude", g.orgId, () =>
        client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 3000,
          messages: [{ role: "user", content: prompt }],
        }),
      );
      const text = msg.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("");

      // Kostnadssporing (2026-07-17, Daniel: «oversikt over kostnader hvis
      // den er aktivert»): token-forbruk fra API-responsen + estimat fra
      // offisiell prisliste (claude-sonnet-4-6: $3/M input, $15/M output).
      // Best effort — logging velter aldri svaret.
      try {
        const inTok = msg.usage?.input_tokens ?? null;
        const outTok = msg.usage?.output_tokens ?? null;
        const cost = inTok != null && outTok != null
          ? (inTok * 3 + outTok * 15) / 1_000_000
          : null;
        await pool.query(
          `INSERT INTO leadbook_ai_usage
             (id, organization_id, project_id, user_id, user_name, feature, model,
              input_chars, input_tokens, output_tokens, cost_usd)
           VALUES ($1,$2,$3,$4,$5,'structure',$6,$7,$8,$9,$10)`,
          [randomUUID(), g.orgId, g.projectId, g.session.userId, g.session.name ?? "",
           "claude-sonnet-4-6", raw.length, inTok, outTok, cost],
        );
      } catch (e) {
        console.warn("[leadbook-examples] ai-usage-logg feilet:", (e as Error).message);
      }

      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return res.status(502).json({ error: "ai_svar_uparsbart" });
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      return res.json({ structured: parsed });
    } catch (err) {
      console.warn("[leadbook-examples] structure failed:", (err as Error).message);
      return res.status(500).json({ error: "structure_failed" });
    }
  });

  // ── POST /api/leadgrid/leadbook/templates/strengthen ──────────────
  // Ekte AI bak «AI-foreslå sterkere» i mal-editoren (2026-08-02 — appen
  // hadde hardkodede regex-erstatningspar merket som AI). Samme gating
  // som /examples/structure: leder-rolle + eksplisitt åpnet AI-entitlement
  // (fail-closed), samme kostnadslogg (feature 'strengthen').
  app.post("/api/leadgrid/leadbook/templates/strengthen", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !WRITE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    try {
      const aiRow = await pool.query<{ state: string }>(
        `SELECT state FROM leadgrid_org_entitlements
          WHERE organization_id = $1 AND feature_key = $2 LIMIT 1`,
        [g.orgId, LEADBOOK_AI_STRUKTUR_FEATURE_KEYS[0]],
      );
      const aiState = aiRow.rows[0]?.state ?? null;
      if (aiState == null || aiState === "locked") {
        return res.status(403).json({
          error: "entitlement_locked",
          features: LEADBOOK_AI_STRUKTUR_FEATURE_KEYS,
        });
      }
    } catch (e) {
      console.warn("[leadbook-examples] ai-entitlement-sjekk feilet:", (e as Error).message);
      return res.status(503).json({ error: "entitlement_utilgjengelig" });
    }
    const text = str((req.body ?? {}).text).trim();
    if (text.length < 10) {
      return res.status(400).json({ error: "for_kort_tekst" });
    }
    const maxCharsRaw = Number((req.body ?? {}).max_chars);
    const maxChars =
      Number.isFinite(maxCharsRaw) && maxCharsRaw > 0 ? Math.min(maxCharsRaw, 2000) : null;
    if (!ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: "ai_ikke_konfigurert" });
    }
    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const prompt = `Du er en norsk salgscoach. Styrk formuleringen under: mer konkret, trygg og handlingsdrivende, uten å bli pushy. Behold {variabler} nøyaktig som de står, behold meningen, og hold omtrent samme lengde${maxChars ? ` (maks ${maxChars} tegn)` : ""}. Svar KUN med den forbedrede formuleringen — ingen forklaring, ingen anførselstegn.

Formulering:
${text.slice(0, 2000)}`;
      const msg = await withAIQuota("claude", g.orgId, () =>
        client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
      );
      const out = msg.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("")
        .trim();

      // Kostnadssporing — best effort, velter aldri svaret.
      try {
        const inTok = msg.usage?.input_tokens ?? null;
        const outTok = msg.usage?.output_tokens ?? null;
        const cost = inTok != null && outTok != null
          ? (inTok * 3 + outTok * 15) / 1_000_000
          : null;
        await pool.query(
          `INSERT INTO leadbook_ai_usage
             (id, organization_id, project_id, user_id, user_name, feature, model,
              input_chars, input_tokens, output_tokens, cost_usd)
           VALUES ($1,$2,$3,$4,$5,'strengthen',$6,$7,$8,$9,$10)`,
          [randomUUID(), g.orgId, g.projectId, g.session.userId, g.session.name ?? "",
           "claude-sonnet-4-6", text.length, inTok, outTok, cost],
        );
      } catch (e) {
        console.warn("[leadbook-examples] ai-usage-logg feilet:", (e as Error).message);
      }

      const suggestion = out.replace(/^["«]+|["»]+$/g, "").trim();
      if (!suggestion) return res.status(502).json({ error: "ai_svar_tomt" });
      return res.json({ suggestion });
    } catch (err) {
      console.warn("[leadbook-examples] strengthen failed:", (err as Error).message);
      return res.status(500).json({ error: "strengthen_failed" });
    }
  });

  // ── POST /api/leadgrid/leadbook/objections/ai-suggest ─────────────
  // Ekte AI bak Leadbook «AI-foreslå»-knappen i innvending-editoren
  // (2026-08-17 — knappen togglet et @State ingen leste; ren dekorasjon,
  // ingen respons ble foreslått i det hele tatt). Samme mønster/gating
  // som /templates/strengthen: leder-rolle + eksplisitt åpnet AI-
  // entitlement (fail-closed), samme kostnadslogg (feature 'objection').
  app.post("/api/leadgrid/leadbook/objections/ai-suggest", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !WRITE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    try {
      const aiRow = await pool.query<{ state: string }>(
        `SELECT state FROM leadgrid_org_entitlements
          WHERE organization_id = $1 AND feature_key = $2 LIMIT 1`,
        [g.orgId, LEADBOOK_AI_STRUKTUR_FEATURE_KEYS[0]],
      );
      const aiState = aiRow.rows[0]?.state ?? null;
      if (aiState == null || aiState === "locked") {
        return res.status(403).json({
          error: "entitlement_locked",
          features: LEADBOOK_AI_STRUKTUR_FEATURE_KEYS,
        });
      }
    } catch (e) {
      console.warn("[leadbook-examples] ai-entitlement-sjekk feilet:", (e as Error).message);
      return res.status(503).json({ error: "entitlement_utilgjengelig" });
    }
    const objection = str((req.body ?? {}).objection).trim();
    if (objection.length < 3) {
      return res.status(400).json({ error: "for_kort_tekst" });
    }
    const category = str((req.body ?? {}).category).trim();
    if (!ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: "ai_ikke_konfigurert" });
    }
    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const prompt = `Du er en norsk salgscoach. En selger skal lære å håndtere en kunde-innvending. Foreslå en konkret, trygg og kort respons selgeren kan bruke — anerkjenn innvendingen først, snu den så mot verdi/neste steg. Ikke pushy, ikke generisk. 2-4 setninger. Svar KUN med selve responsen — ingen forklaring, ingen anførselstegn.

Innvending${category ? ` (kategori: ${category})` : ""}:
${objection.slice(0, 500)}`;
      const msg = await withAIQuota("claude", g.orgId, () =>
        client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 400,
          messages: [{ role: "user", content: prompt }],
        }),
      );
      const out = msg.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("")
        .trim();

      // Kostnadssporing — best effort, velter aldri svaret.
      try {
        const inTok = msg.usage?.input_tokens ?? null;
        const outTok = msg.usage?.output_tokens ?? null;
        const cost = inTok != null && outTok != null
          ? (inTok * 3 + outTok * 15) / 1_000_000
          : null;
        await pool.query(
          `INSERT INTO leadbook_ai_usage
             (id, organization_id, project_id, user_id, user_name, feature, model,
              input_chars, input_tokens, output_tokens, cost_usd)
           VALUES ($1,$2,$3,$4,$5,'objection',$6,$7,$8,$9,$10)`,
          [randomUUID(), g.orgId, g.projectId, g.session.userId, g.session.name ?? "",
           "claude-sonnet-4-6", objection.length, inTok, outTok, cost],
        );
      } catch (e) {
        console.warn("[leadbook-examples] ai-usage-logg feilet:", (e as Error).message);
      }

      const suggestion = out.replace(/^["«]+|["»]+$/g, "").trim();
      if (!suggestion) return res.status(502).json({ error: "ai_svar_tomt" });
      return res.json({ suggestion });
    } catch (err) {
      console.warn("[leadbook-examples] objection ai-suggest failed:", (err as Error).message);
      return res.status(500).json({ error: "ai_suggest_failed" });
    }
  });

  // ── GET /api/leadgrid/leadbook/examples/ai-usage ──────────────────
  // Kostnadsoversikt for AI-struktureringen (kun ledere): totalt + denne
  // måneden + per bruker. cost_usd er estimat fra offisiell prisliste.
  app.get("/api/leadgrid/leadbook/examples/ai-usage", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !WRITE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    try {
      const totals = await pool.query<{
        calls: number; input_tokens: number; output_tokens: number; cost_usd: string;
      }>(
        `SELECT COUNT(*)::int AS calls,
                COALESCE(SUM(input_tokens),0)::int AS input_tokens,
                COALESCE(SUM(output_tokens),0)::int AS output_tokens,
                COALESCE(SUM(cost_usd),0) AS cost_usd
           FROM leadbook_ai_usage
          WHERE organization_id = $1 AND project_id = $2`,
        [g.orgId, g.projectId],
      );
      const month = await pool.query<{
        calls: number; cost_usd: string;
      }>(
        `SELECT COUNT(*)::int AS calls, COALESCE(SUM(cost_usd),0) AS cost_usd
           FROM leadbook_ai_usage
          WHERE organization_id = $1 AND project_id = $2
            AND created_at >= date_trunc('month', now())`,
        [g.orgId, g.projectId],
      );
      const byUser = await pool.query<{
        user_name: string; calls: number; cost_usd: string;
      }>(
        `SELECT user_name, COUNT(*)::int AS calls,
                COALESCE(SUM(cost_usd),0) AS cost_usd
           FROM leadbook_ai_usage
          WHERE organization_id = $1 AND project_id = $2
          GROUP BY user_name
          ORDER BY SUM(cost_usd) DESC NULLS LAST
          LIMIT 25`,
        [g.orgId, g.projectId],
      );
      // Per FUNKSJON: kunden ser nøyaktig hva AI-forbruket går til
      // (møtebrief, etterarbeid, Canvas-analyse, anbud-score, …).
      const byFeature = await pool.query<{
        feature: string; calls: number; cost_usd: string;
      }>(
        `SELECT feature, COUNT(*)::int AS calls,
                COALESCE(SUM(cost_usd),0) AS cost_usd
           FROM leadbook_ai_usage
          WHERE organization_id = $1 AND project_id = $2
          GROUP BY feature
          ORDER BY SUM(cost_usd) DESC NULLS LAST
          LIMIT 25`,
        [g.orgId, g.projectId],
      );
      return res.json({
        projectId: g.projectId,
        total: totals.rows[0],
        this_month: month.rows[0],
        by_user: byUser.rows,
        by_feature: byFeature.rows,
      });
    } catch (err) {
      console.warn("[leadbook-examples] ai-usage failed:", (err as Error).message);
      return res.status(500).json({ error: "ai_usage_failed" });
    }
  });

  // ── POST /api/leadgrid/leadbook/ai-usage/bill ─────────────────────
  // Cron (x-cron-trigger-token, samme som overage-billing): aggregér
  // ufakturerte AI-kall ELDRE ENN i dag per (org, dag) → Stripe meter-
  // event → stemple radene billed_at. Idempotent via Stripe-identifier
  // `lg_ai_<org>_<dag>`.
  app.post("/api/leadgrid/leadbook/ai-usage/bill", async (req, res) => {
    const t = req.headers["x-cron-trigger-token"] as string | undefined;
    if (!t || !AI_CRON_TOKEN || t !== AI_CRON_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const results = { groups: 0, reported: 0, errors: 0 };
    try {
      const unbilled = await pool.query<{
        organization_id: string; day: string; calls: number;
        stripe_customer_id: string | null;
      }>(
        `SELECT u.organization_id, u.created_at::date::text AS day,
                COUNT(*)::int AS calls, org.stripe_customer_id
           FROM leadbook_ai_usage u
           JOIN organizations org ON org.id::text = u.organization_id
          WHERE u.billed_at IS NULL
            AND u.created_at < date_trunc('day', now())
            AND org.stripe_customer_id IS NOT NULL
          GROUP BY u.organization_id, u.created_at::date, org.stripe_customer_id
          ORDER BY day ASC
          LIMIT 100`,
      );
      results.groups = unbilled.rows.length;
      for (const row of unbilled.rows) {
        const identifier = `lg_ai_${row.organization_id}_${row.day}`;
        const timestamp = Math.floor(new Date(row.day).getTime() / 1000);
        const r = await reportAIMeterEvent(
          identifier, row.stripe_customer_id!, row.calls, timestamp,
        );
        if (r.ok) {
          await pool.query(
            `UPDATE leadbook_ai_usage SET billed_at = now()
              WHERE organization_id = $1 AND billed_at IS NULL
                AND created_at::date = $2::date`,
            [row.organization_id, row.day],
          );
          results.reported++;
        } else {
          results.errors++;
          console.error(`[leadbook-ai-bill] meter feilet for ${identifier}: ${r.error}`);
        }
      }
      return res.json({ ok: true, ...results });
    } catch (err) {
      console.error("[leadbook-ai-bill]", (err as Error).message);
      return res.status(500).json({ error: "bill_failed" });
    }
  });

  // ── POST /api/leadgrid/leadbook/examples — eget utkast / leder ───
  app.post("/api/leadgrid/leadbook/examples", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const isLeder = g.role != null && WRITE_ROLES.has(g.role);
    const title = bounded(b.title, 200);
    if (title == null) return res.status(400).json({ error: "tittel_for_lang", max: 200 });
    if (!title) return res.status(400).json({ error: "mangler_tittel" });
    const customerLabel = bounded(b.customer_label, 200);
    const industry = bounded(b.industry, 120);
    const sellerName = bounded(b.seller_name, 160);
    const summary = bounded(b.summary, 4000);
    if (customerLabel == null || industry == null || sellerName == null || summary == null) {
      return res.status(400).json({ error: "felt_for_langt" });
    }
    // Creation is always private. Publishing is a separate, audited transition
    // that atomically anonymizes before any project member can read the row.
    const status = "draft";
    const outcome = VALID_OUTCOME.has(str(b.outcome)) ? str(b.outcome) : "won";
    const channel = normalizedChannel(b.channel);
    if (!channel) return res.status(400).json({ error: "ugyldig_kanal" });
    const featured = VALID_DIMENSIONS.has(str(b.featured_dimension))
      ? str(b.featured_dimension) : null;
    const duration = optionalBoundedInteger(b.duration_sec, 0, 86400);
    const score = optionalBoundedInteger(b.pondus_score, 0, 100);
    const dealValue = optionalBoundedInteger(b.deal_value_nok, 0, Number.MAX_SAFE_INTEGER);
    if (!duration.valid || !score.valid || !dealValue.valid) {
      return res.status(400).json({ error: "ugyldig_tallverdi" });
    }
    const creationRaw = b.creation_id ?? b.creationId;
    const creationId = validClientActionId(creationRaw);
    if (creationRaw != null && !creationId) {
      return res.status(400).json({ error: "ugyldig_creation_id" });
    }
    const consentRaw = b.source_consent_id ?? b.sourceConsentId;
    const consentId = validClientActionId(consentRaw);
    if (consentRaw != null && !consentId) {
      return res.status(400).json({ error: "ugyldig_source_consent" });
    }
    const transcript = jsonArr(b.transcript);
    const transcriptJSON = JSON.stringify(transcript);
    if (transcript.length > 5000 || Buffer.byteLength(transcriptJSON, "utf8") > 1_000_000) {
      return res.status(413).json({ error: "transkript_for_stort" });
    }
    try {
      let consentCustomer = "";
      if (consentId) {
        const consent = await pool.query<{ customer_label: string }>(
          `SELECT customer_label FROM leadbook_recording_consents
            WHERE id = $1::uuid AND organization_id = $2
              AND project_id = $3 AND user_id = $4
            LIMIT 1`,
          [consentId, g.orgId, g.projectId, g.session.userId],
        );
        if (!consent.rows[0]) {
          return res.status(400).json({ error: "ugyldig_source_consent" });
        }
        consentCustomer = consent.rows[0].customer_label ?? "";
      }
      const id = randomUUID();
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO leadbook_examples
           (id, organization_id, project_id, status, title, customer_label, industry,
            outcome, channel, duration_sec, seller_user_id, seller_name,
            happened_on, pondus_score, featured_dimension, dimension_scores,
            key_learnings, alternative_phrasings, transcript, key_moments,
            deal_value_nok, summary, created_by, created_by_name,
            source_consent_id, creation_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
                 $16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20::jsonb,$21,$22,$23,$24,$25,$26)
         ON CONFLICT (organization_id, project_id, creation_id)
           WHERE project_id IS NOT NULL AND creation_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [
          id, g.orgId, g.projectId, status, title,
          customerLabel || consentCustomer, industry, outcome, channel,
          duration.value,
          (consentId || !isLeder) ? g.session.userId : (str(b.seller_user_id) || g.session.userId),
          (consentId || !isLeder) ? (g.session.name ?? "") : sellerName,
          str(b.happened_on) || null,
          score.value, featured,
          JSON.stringify(b.dimension_scores ?? {}),
          JSON.stringify(jsonArr(b.key_learnings)),
          JSON.stringify(jsonArr(b.alternative_phrasings)),
          transcriptJSON,
          JSON.stringify(jsonArr(b.key_moments)),
          dealValue.value,
          summary,
          g.session.userId, g.session.name ?? "",
          consentId, creationId,
        ],
      );
      if (inserted.rows[0]) {
        return res.status(201).json({
          id: inserted.rows[0].id, status: "draft", projectId: g.projectId,
        });
      }
      const existing = await pool.query<{ id: string }>(
        `SELECT id FROM leadbook_examples
          WHERE organization_id = $1 AND project_id = $2
            AND creation_id = $3::uuid LIMIT 1`,
        [g.orgId, g.projectId, creationId],
      );
      if (existing.rows[0]) {
        return res.status(200).json({
          id: existing.rows[0].id, status: "draft", projectId: g.projectId,
        });
      }
      throw new Error("idempotent create returned no row");
    } catch (err) {
      console.warn("[leadbook-examples] create failed:", (err as Error).message);
      return res.status(500).json({ error: "create_failed" });
    }
  });

  // ── PATCH /api/leadgrid/leadbook/examples/:id — rediger/publiser ──
  app.patch("/api/leadgrid/leadbook/examples/:id", async (req, res) => {
    if (!UUID_RE.test(str(req.params.id).trim())) {
      return res.status(400).json({ error: "ugyldig_example_id" });
    }
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !WRITE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    const push = (col: string, val: unknown) => {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    };
    if (typeof b.title === "string") {
      const title = bounded(b.title, 200);
      if (!title) return res.status(400).json({ error: title == null ? "tittel_for_lang" : "mangler_tittel" });
      push("title", title);
    }
    if (typeof b.status === "string" && VALID_STATUS.has(b.status)) push("status", b.status);
    if (typeof b.customer_label === "string") {
      const value = bounded(b.customer_label, 200);
      if (value == null) return res.status(400).json({ error: "customer_label_for_lang" });
      push("customer_label", value);
    }
    if (typeof b.industry === "string") {
      const value = bounded(b.industry, 120);
      if (value == null) return res.status(400).json({ error: "industry_for_lang" });
      push("industry", value);
    }
    if (typeof b.outcome === "string" && VALID_OUTCOME.has(b.outcome)) push("outcome", b.outcome);
    if (typeof b.channel === "string") {
      const channel = normalizedChannel(b.channel);
      if (!channel) return res.status(400).json({ error: "ugyldig_kanal" });
      push("channel", channel);
    }
    if (b.duration_sec !== undefined) {
      const value = optionalBoundedInteger(b.duration_sec, 0, 86400);
      if (!value.valid) return res.status(400).json({ error: "ugyldig_varighet" });
      push("duration_sec", value.value);
    }
    if (typeof b.seller_name === "string") {
      const value = bounded(b.seller_name, 160);
      if (value == null) return res.status(400).json({ error: "seller_name_for_lang" });
      push("seller_name", value);
    }
    if (b.pondus_score !== undefined) {
      const value = optionalBoundedInteger(b.pondus_score, 0, 100);
      if (!value.valid) return res.status(400).json({ error: "ugyldig_pondus_score" });
      push("pondus_score", value.value);
    }
    if (typeof b.featured_dimension === "string" && VALID_DIMENSIONS.has(b.featured_dimension)) {
      push("featured_dimension", b.featured_dimension);
    }
    if (b.dimension_scores !== undefined) push("dimension_scores", JSON.stringify(b.dimension_scores ?? {}));
    if (b.key_learnings !== undefined) push("key_learnings", JSON.stringify(jsonArr(b.key_learnings)));
    if (b.alternative_phrasings !== undefined) push("alternative_phrasings", JSON.stringify(jsonArr(b.alternative_phrasings)));
    if (b.transcript !== undefined) {
      const transcript = jsonArr(b.transcript);
      const transcriptJSON = JSON.stringify(transcript);
      if (transcript.length > 5000 || Buffer.byteLength(transcriptJSON, "utf8") > 1_000_000) {
        return res.status(413).json({ error: "transkript_for_stort" });
      }
      push("transcript", transcriptJSON);
    }
    if (b.key_moments !== undefined) push("key_moments", JSON.stringify(jsonArr(b.key_moments)));
    if (b.deal_value_nok !== undefined) {
      const value = optionalBoundedInteger(b.deal_value_nok, 0, Number.MAX_SAFE_INTEGER);
      if (!value.valid) return res.status(400).json({ error: "ugyldig_deal_value" });
      push("deal_value_nok", value.value);
    }
    if (typeof b.summary === "string") {
      const value = bounded(b.summary, 4000);
      if (value == null) return res.status(400).json({ error: "summary_for_lang" });
      push("summary", value);
    }
    if (sets.length === 0) return res.status(400).json({ error: "ingenting_aa_oppdatere" });
    push("updated_at", new Date());
    vals.push(req.params.id, g.orgId, g.projectId);
    try {
      const client = await pool.connect();
      let didPublish = false;
      try {
        await client.query("BEGIN");
        const previous = await client.query<{ status: string }>(
          `SELECT status FROM leadbook_examples
            WHERE id = $1::uuid AND organization_id = $2 AND project_id = $3
            LIMIT 1 FOR UPDATE`,
          [req.params.id, g.orgId, g.projectId],
        );
        const oldStatus = previous.rows[0]?.status ?? null;
        if (oldStatus == null) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "ikke_funnet" });
        }

        const updated = await client.query<{
          id: string;
          status: string;
          transcript: unknown;
          customer_label: string;
        }>(
          `UPDATE leadbook_examples SET ${sets.join(", ")}
            WHERE id = $${vals.length - 2}::uuid
              AND organization_id = $${vals.length - 1}
              AND project_id = $${vals.length}
            RETURNING id, status, transcript, customer_label`,
          vals,
        );
        const row = updated.rows[0];
        if (!row) throw new Error("patch lost locked Leadbook row");

        // Sanitize inside the same transaction that makes the row visible.
        // This also protects edits to an already-published transcript.
        if (row.status === "published") {
          const anonymized = await client.query(
            `UPDATE leadbook_examples
                SET transcript = $1::jsonb,
                    customer_label = $2,
                    anonymized_at = COALESCE(anonymized_at, NOW()),
                    updated_at = NOW()
              WHERE id = $3::uuid AND organization_id = $4 AND project_id = $5
              RETURNING id`,
            [JSON.stringify(anonymizeTranscript(row.transcript)),
             anonymizeText(row.customer_label ?? ""), row.id,
             g.orgId, g.projectId],
          );
          if ((anonymized.rowCount ?? 0) !== 1) {
            throw new Error("anonymization lost locked Leadbook row");
          }
        }

        didPublish = oldStatus !== "published" && row.status === "published";
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }

      // The row is already anonymized at commit. A retry observes published
      // and therefore cannot duplicate the transition notification.
      if (didPublish) {
        notifyOrgOfPublish(g.orgId, g.projectId, req.params.id, g.session.userId)
          .catch((error) => console.warn(
            "[leadbook-examples] publish-notify feilet:",
            (error as Error).message,
          ));
      }
      return res.json({ ok: true, projectId: g.projectId });
    } catch (err) {
      console.warn("[leadbook-examples] patch failed:", (err as Error).message);
      return res.status(500).json({ error: "patch_failed" });
    }
  });

  /// Publiserings-varsel til alle org-medlemmer: «Ny vinnersamtale fra
  /// Marte — 340K, sterk på Trygghet». Kjøres asynkront etter patch-svaret.
  async function notifyOrgOfPublish(
    orgId: string, projectId: string, exampleId: string, publisherUserId: string,
  ): Promise<void> {
    const ex = await pool.query<{
      title: string; outcome: string; seller_name: string;
      deal_value_nok: string | number | null; featured_dimension: string | null;
    }>(
      `SELECT title, outcome, seller_name, deal_value_nok, featured_dimension
         FROM leadbook_examples
        WHERE id = $1::uuid AND organization_id = $2 AND project_id = $3
        LIMIT 1`,
      [exampleId, orgId, projectId],
    );
    const row = ex.rows[0];
    if (!row) return;

    const kind = row.outcome === "won" ? "vinnersamtale"
      : row.outcome === "lost" ? "læringssamtale" : "salgssamtale";
    const parts: string[] = [];
    const value = row.deal_value_nok != null ? Number(row.deal_value_nok) : null;
    if (value != null && Number.isFinite(value) && value > 0) {
      parts.push(value >= 1_000_000
        ? `${(value / 1_000_000).toFixed(1).replace(".", ",")} mill`
        : `${Math.round(value / 1000)}K`);
    }
    if (row.featured_dimension) {
      const label = row.featured_dimension.charAt(0).toUpperCase()
        + row.featured_dimension.slice(1);
      parts.push(`sterk på ${label}`);
    }
    const title = `Ny ${kind}${row.seller_name ? ` fra ${row.seller_name}` : ""}`;
    const body = parts.length > 0
      ? `«${row.title}» — ${parts.join(", ")}`
      : `«${row.title}»`;
    const deepLink = leadbookExampleDeepLink(exampleId, projectId, orgId);

    const members = await pool.query<{ user_id: string }>(
      `WITH project_row AS (
         SELECT id, organization_id, created_by
           FROM leadgrid_projects
          WHERE id = $2 AND organization_id = $1::uuid
       ), eligible AS (
         SELECT created_by AS user_id FROM project_row
         UNION
         SELECT member.user_id
           FROM project_row project
           JOIN leadgrid_project_members member
             ON member.organization_id = project.organization_id
            AND member.project_id = project.id
         UNION
         SELECT org_member.user_id
           FROM project_row project
           JOIN organization_members org_member
             ON org_member.organization_id = project.organization_id
          WHERE NOT EXISTS (
                  SELECT 1 FROM leadgrid_user_permission_overrides denied
                   WHERE denied.organization_id = project.organization_id
                     AND denied.user_id = org_member.user_id
                     AND denied.permission_key = 'projects.view_all'
                     AND denied.effect = 'revoke'
                )
            AND (
              org_member.role = 'admin'
              OR EXISTS (
                SELECT 1 FROM role_permissions defaults
                 WHERE defaults.role = org_member.role
                   AND defaults.permission_key = 'projects.view_all'
              )
              OR EXISTS (
                SELECT 1 FROM leadgrid_user_permission_overrides granted
                 WHERE granted.organization_id = project.organization_id
                   AND granted.user_id = org_member.user_id
                   AND granted.permission_key = 'projects.view_all'
                   AND granted.effect = 'grant'
              )
            )
       )
       SELECT DISTINCT user_id FROM eligible
        WHERE user_id IS NOT NULL AND user_id <> $3`,
      [orgId, projectId, publisherUserId],
    );
    for (const member of members.rows) {
      await notifyUser(
        member.user_id, orgId, projectId, publisherUserId,
        "leadbook_example_published", title, body, deepLink,
        { example_id: exampleId },
      );
    }
  }

  // ── POST /api/leadgrid/leadbook/examples/:id/view ─────────────────
  // Visnings-registrering (alle medlemmer): upsert m/ teller. Appen
  // kaller når detail-sheeten åpnes i ekte modus.
  app.post("/api/leadgrid/leadbook/examples/:id/view", async (req, res) => {
    const exampleId = str(req.params.id).trim();
    if (!UUID_RE.test(exampleId)) {
      return res.status(400).json({ error: "ugyldig_example_id" });
    }
    const g = await guard(req, res);
    if (!g) return;
    const isLeder = g.role != null && WRITE_ROLES.has(g.role);
    try {
      const ex = await pool.query(
        `SELECT id FROM leadbook_examples
          WHERE id = $1::uuid AND organization_id = $2 AND project_id = $3
            AND status <> 'archived'
            AND (
              status = 'published'
              OR $4
              OR (status = 'draft' AND seller_user_id = $5)
            )
          LIMIT 1`,
        [exampleId, g.orgId, g.projectId, isLeder, g.session.userId],
      );
      if (ex.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      await pool.query(
        `INSERT INTO leadbook_example_views
           (example_id, organization_id, project_id, user_id)
         VALUES ($1::uuid, $2, $3, $4)
         ON CONFLICT (example_id, user_id)
         DO UPDATE SET view_count = leadbook_example_views.view_count + 1,
                       last_viewed_at = now()`,
        [exampleId, g.orgId, g.projectId, g.session.userId],
      );
      return res.json({ ok: true, projectId: g.projectId });
    } catch (err) {
      console.warn("[leadbook-examples] view failed:", (err as Error).message);
      return res.status(500).json({ error: "view_failed" });
    }
  });

  // ── DELETE — arkiver (soft) ───────────────────────────────────────
  app.delete("/api/leadgrid/leadbook/examples/:id", async (req, res) => {
    const exampleId = str(req.params.id).trim();
    if (!UUID_RE.test(exampleId)) {
      return res.status(400).json({ error: "ugyldig_example_id" });
    }
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !WRITE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    try {
      const r = await pool.query(
        `UPDATE leadbook_examples SET status = 'archived', updated_at = now()
          WHERE id = $1::uuid AND organization_id = $2 AND project_id = $3
          RETURNING id`,
        [exampleId, g.orgId, g.projectId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      return res.json({ ok: true, projectId: g.projectId });
    } catch (err) {
      console.warn("[leadbook-examples] delete failed:", (err as Error).message);
      return res.status(500).json({ error: "delete_failed" });
    }
  });

  // ── POST /:id/feedback — leder-tilbakemelding på samtalen ─────────
  app.post("/api/leadgrid/leadbook/examples/:id/feedback", async (req, res) => {
    const exampleId = str(req.params.id).trim();
    if (!UUID_RE.test(exampleId)) {
      return res.status(400).json({ error: "ugyldig_example_id" });
    }
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !FEEDBACK_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_salgssjef_eller_teamleder" });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const body = bounded(b.body, 4000);
    if (body == null) return res.status(400).json({ error: "tekst_for_lang", max: 4000 });
    if (!body) return res.status(400).json({ error: "mangler_tekst" });
    const dimension = VALID_DIMENSIONS.has(str(b.dimension)) ? str(b.dimension) : null;
    const actionRaw = b.client_action_id ?? b.clientActionId;
    const clientActionId = validClientActionId(actionRaw);
    if (actionRaw != null && !clientActionId) {
      return res.status(400).json({ error: "ugyldig_client_action_id" });
    }
    // Valgfritt anker (2026-07-17): konkret replikk (indeks i transcript-
    // arrayen) og/eller tidspunkt i sekunder (fase 2-lyd).
    const transcriptIndex = intOrNull(b.transcript_index ?? b.transcriptIndex);
    const atSec = intOrNull(b.at_sec ?? b.atSec);
    try {
      // Eksempelet må finnes i samme org (IDOR-vakt) — og vi trenger
      // selger + tittel til varslingen.
      const ex = await pool.query<{
        id: string; title: string; seller_user_id: string | null;
      }>(
        `SELECT id, title, seller_user_id FROM leadbook_examples
          WHERE id = $1::uuid AND organization_id = $2 AND project_id = $3
          LIMIT 1`,
        [exampleId, g.orgId, g.projectId],
      );
      const example = ex.rows[0];
      if (!example) return res.status(404).json({ error: "ikke_funnet" });
      const id = randomUUID();
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO leadbook_example_feedback
           (id, example_id, organization_id, project_id, author_user_id, author_name,
            author_role, dimension, body, transcript_index, at_sec,
            client_action_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (organization_id, project_id, client_action_id)
           WHERE project_id IS NOT NULL AND client_action_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [
          id, exampleId, g.orgId, g.projectId,
          g.session.userId, g.session.name ?? "",
          g.role, dimension, body, transcriptIndex, atSec, clientActionId,
        ],
      );
      if (!inserted.rows[0]) {
        const existing = await pool.query<{ id: string }>(
          `SELECT id FROM leadbook_example_feedback
            WHERE organization_id = $1 AND project_id = $2
              AND client_action_id = $3::uuid LIMIT 1`,
          [g.orgId, g.projectId, clientActionId],
        );
        if (existing.rows[0]) {
          return res.status(200).json({ id: existing.rows[0].id, projectId: g.projectId });
        }
        throw new Error("idempotent feedback returned no row");
      }

      // Varsle selgeren (2026-07-17, Daniel: «hvordan får brukerne
      // notifikasjon på at de har fått tilbakemelding?») — samme pipeline
      // som lead-tildeling: in-app-innboks (notification_events, driver
      // bjelle-badgen) + APNs-push. Best effort — varslingsfeil skal aldri
      // velte selve tilbakemeldingen. Hopp over selv-feedback.
      const sellerId = example.seller_user_id;
      if (sellerId && sellerId !== g.session.userId) {
        const title = `Tilbakemelding fra ${g.session.name || "leder"}`;
        const excerpt = body.length > 120 ? `${body.slice(0, 117)}…` : body;
        const notifBody = `«${example.title}»: ${excerpt}`;
        await notifyUser(
          sellerId, g.orgId, g.projectId, g.session.userId,
          "leadbook_example_feedback", title, notifBody,
          leadbookExampleDeepLink(example.id, g.projectId, g.orgId),
          { example_id: example.id, dimension, at_sec: atSec },
        );
      }

      return res.status(201).json({ id, projectId: g.projectId });
    } catch (err) {
      console.warn("[leadbook-examples] feedback failed:", (err as Error).message);
      return res.status(500).json({ error: "feedback_failed" });
    }
  });

  // ═══ Dialog-utvidelsen (2026-07-17): lest-kvittering + svar-tråd +
  // «Mine tilbakemeldinger». Daniel: «Gjør tilbakemeldingen til en
  // dialog, ikke en megafon.» ═══

  /// Delt varslings-helper (in-app + APNs, best effort) — samme pipeline
  /// som lead-tildeling; feil velter aldri hovedoperasjonen.
  async function notifyUser(
    recipientUserId: string, orgId: string, projectId: string, triggeredBy: string,
    eventType: string, title: string, notifBody: string, deepLink: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    let recipientProject;
    try {
      recipientProject = await loadAccessibleLeadgridProject(
        pool, projectId, recipientUserId,
      );
    } catch (error) {
      console.warn(
        "[leadbook-examples] recipient project ACL failed:",
        (error as Error).message,
      );
      return;
    }
    if (!recipientProject
        || recipientProject.organizationId.toLowerCase() !== orgId.toLowerCase()) {
      return;
    }
    try {
      await pool.query(
        `INSERT INTO notification_events
           (recipient_user_id, organization_id, project_id, event_type, title, body,
            triggered_by_user_id, deep_link, meta, email_sent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, FALSE)`,
        [recipientUserId, orgId, projectId, eventType, title, notifBody,
         triggeredBy, deepLink, JSON.stringify({ ...meta, project_id: projectId })],
      );
    } catch (e) {
      console.warn("[leadbook-examples] notif in_app feilet:", (e as Error).message);
    }
    try {
      const tokRes = await pool.query<{ token: string }>(
        `SELECT token FROM notification_device_tokens
          WHERE user_id = $1 AND platform = 'apns' AND enabled = TRUE`,
        [recipientUserId],
      );
      for (const t of tokRes.rows) {
        const r = await sendAPNs(t.token, title, notifBody, {
          customData: {
            event_type: eventType,
            organization_id: orgId,
            project_id: projectId,
            deep_link: deepLink,
          },
        });
        if (r.sent) break;
        if (r.shouldDisableToken) {
          await pool.query(
            `UPDATE notification_device_tokens SET enabled = FALSE
              WHERE token = $1 AND user_id = $2`,
            [t.token, recipientUserId],
          ).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("[leadbook-examples] notif apns feilet:", (e as Error).message);
    }
  }

  // ── GET /api/leadgrid/leadbook/feedback/mine ──────────────────────
  // Selgerens samleflate: all tilbakemelding på eksempler der DE er
  // selger, med eksempel-kontekst + svar-tråd + lest-status.
  app.get("/api/leadgrid/leadbook/feedback/mine", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    try {
      const r = await pool.query(
        `SELECT f.*, e.title AS example_title, e.outcome AS example_outcome,
                e.status AS example_status
           FROM leadbook_example_feedback f
           JOIN leadbook_examples e
             ON e.id = f.example_id
            AND e.organization_id = f.organization_id
            AND e.project_id = f.project_id
          WHERE f.organization_id = $1
            AND f.project_id = $2
            AND e.organization_id = $1
            AND e.project_id = $2
            AND e.seller_user_id = $3
            AND e.status <> 'archived'
          ORDER BY f.created_at DESC
          LIMIT 200`,
        [g.orgId, g.projectId, g.session.userId],
      );
      const fbIds = r.rows.map((row) => row.id);
      let replies: Record<string, unknown[]> = {};
      if (fbIds.length > 0) {
        const rr = await pool.query(
          `SELECT * FROM leadbook_feedback_replies
            WHERE feedback_id = ANY($1::uuid[])
              AND organization_id = $2
              AND project_id = $3
            ORDER BY created_at ASC`,
          [fbIds, g.orgId, g.projectId],
        );
        replies = rr.rows.reduce((acc: Record<string, unknown[]>, row) => {
          (acc[row.feedback_id] ??= []).push(row);
          return acc;
        }, {});
      }
      const unread = r.rows.filter((row) => row.read_at == null).length;
      return res.json({
        projectId: g.projectId,
        feedback: r.rows.map((row) => ({ ...row, replies: replies[row.id] ?? [] })),
        unread,
      });
    } catch (err) {
      console.warn("[leadbook-examples] mine failed:", (err as Error).message);
      return res.status(500).json({ error: "mine_failed" });
    }
  });

  // ── POST /api/leadgrid/leadbook/feedback/:id/read ─────────────────
  // Lest-kvittering — KUN eksempelets selger kan markere som lest
  // (kvitteringen betyr «selgeren har sett den», ikke «noen åpnet den»).
  app.post("/api/leadgrid/leadbook/feedback/:id/read", async (req, res) => {
    const feedbackId = str(req.params.id).trim();
    if (!UUID_RE.test(feedbackId)) {
      return res.status(400).json({ error: "ugyldig_feedback_id" });
    }
    const g = await guard(req, res);
    if (!g) return;
    try {
      const r = await pool.query(
        `UPDATE leadbook_example_feedback f
            SET read_at = COALESCE(f.read_at, now())
           FROM leadbook_examples e
          WHERE f.id = $1::uuid
            AND f.organization_id = $2
            AND f.project_id = $3
            AND e.id = f.example_id
            AND e.organization_id = $2
            AND e.project_id = $3
            AND e.seller_user_id = $4
          RETURNING f.id`,
        [feedbackId, g.orgId, g.projectId, g.session.userId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      return res.json({ ok: true, projectId: g.projectId });
    } catch (err) {
      console.warn("[leadbook-examples] read failed:", (err as Error).message);
      return res.status(500).json({ error: "read_failed" });
    }
  });

  // ── POST /api/leadgrid/leadbook/feedback/:id/replies ──────────────
  // Svar i tråden: eksempelets selger ELLER leder-roller. Motparten
  // varsles (selger svarer → forfatteren av tilbakemeldingen; leder
  // svarer → selgeren).
  app.post("/api/leadgrid/leadbook/feedback/:id/replies", async (req, res) => {
    const feedbackId = str(req.params.id).trim();
    if (!UUID_RE.test(feedbackId)) {
      return res.status(400).json({ error: "ugyldig_feedback_id" });
    }
    const g = await guard(req, res);
    if (!g) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const body = bounded(b.body, 4000);
    if (body == null) return res.status(400).json({ error: "tekst_for_lang", max: 4000 });
    if (!body) return res.status(400).json({ error: "mangler_tekst" });
    const actionRaw = b.client_action_id ?? b.clientActionId;
    const clientActionId = validClientActionId(actionRaw);
    if (actionRaw != null && !clientActionId) {
      return res.status(400).json({ error: "ugyldig_client_action_id" });
    }
    try {
      const fb = await pool.query<{
        id: string; author_user_id: string; example_id: string;
        seller_user_id: string | null; example_title: string;
      }>(
        `SELECT f.id, f.author_user_id, f.example_id,
                e.seller_user_id, e.title AS example_title
           FROM leadbook_example_feedback f
           JOIN leadbook_examples e
             ON e.id = f.example_id
            AND e.organization_id = f.organization_id
            AND e.project_id = f.project_id
          WHERE f.id = $1::uuid
            AND f.organization_id = $2
            AND f.project_id = $3
            AND e.organization_id = $2
            AND e.project_id = $3
          LIMIT 1`,
        [feedbackId, g.orgId, g.projectId],
      );
      const row = fb.rows[0];
      if (!row) return res.status(404).json({ error: "ikke_funnet" });

      const isSeller = row.seller_user_id === g.session.userId;
      const isLeder = g.role != null && FEEDBACK_ROLES.has(g.role);
      if (!isSeller && !isLeder) {
        return res.status(403).json({ error: "kun_selger_eller_leder" });
      }

      const id = randomUUID();
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO leadbook_feedback_replies
           (id, feedback_id, organization_id, project_id, author_user_id,
            author_name, author_role, body, client_action_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (organization_id, project_id, client_action_id)
           WHERE project_id IS NOT NULL AND client_action_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [id, req.params.id, g.orgId, g.projectId, g.session.userId,
         g.session.name ?? "", isSeller ? "selger" : (g.role ?? ""), body,
         clientActionId],
      );
      if (!inserted.rows[0]) {
        const existing = await pool.query<{ id: string }>(
          `SELECT id FROM leadbook_feedback_replies
            WHERE organization_id = $1 AND project_id = $2
              AND client_action_id = $3::uuid LIMIT 1`,
          [g.orgId, g.projectId, clientActionId],
        );
        if (existing.rows[0]) {
          return res.status(200).json({ id: existing.rows[0].id, projectId: g.projectId });
        }
        throw new Error("idempotent reply returned no row");
      }

      // Selgerens svar teller som lest (de har åpenbart sett den).
      if (isSeller) {
        await pool.query(
          `UPDATE leadbook_example_feedback
              SET read_at = COALESCE(read_at, now())
            WHERE id = $1::uuid
              AND organization_id = $2
              AND project_id = $3`,
          [req.params.id, g.orgId, g.projectId],
        ).catch(() => {});
      }

      const recipient = isSeller ? row.author_user_id : row.seller_user_id;
      if (recipient && recipient !== g.session.userId) {
        const excerpt = body.length > 120 ? `${body.slice(0, 117)}…` : body;
        await notifyUser(
          recipient, g.orgId, g.projectId, g.session.userId,
          "leadbook_feedback_reply",
          `Svar fra ${g.session.name || (isSeller ? "selger" : "leder")}`,
          `«${row.example_title}»: ${excerpt}`,
          leadbookExampleDeepLink(row.example_id, g.projectId, g.orgId),
          { example_id: row.example_id, feedback_id: row.id },
        );
      }
      return res.status(201).json({ id, projectId: g.projectId });
    } catch (err) {
      console.warn("[leadbook-examples] reply failed:", (err as Error).message);
      return res.status(500).json({ error: "reply_failed" });
    }
  });
}
