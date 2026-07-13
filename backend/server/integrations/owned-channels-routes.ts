/**
 * owned-channels-routes.ts
 *
 *   POST /api/integrations/sync/owned-channels
 *        Header: x-cron-token (CRON_TRIGGER_TOKEN — samme som øvrige
 *        cron-ruter). Body: { producerUserId? } — uten: alle synkbare.
 *        Fire-and-forget, sekvensielt.
 *
 *   GET  /api/integrations/signals/ai-traffic
 *        Admin-session. Org-scopet lesning av ai_referral_sessions fra
 *        normalized_signals → { sources: [{source, sessions}], total,
 *        periodStart, periodEnd, lastCollectedAt } for AI-trafikk-panelet.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  listSyncableProducers,
  syncOwnedChannelSignals,
} from "./owned-channels-signal-sync.js";
import { syncLeadgridSalesSignals } from "./leadgrid-sales-signal-sync.js";
import { syncBrregMarketSignals } from "./brreg-market-signal-sync.js";
import { syncSalesTriggers } from "./sales-trigger-sync.js";
import { syncSsbTerritorySignals } from "./ssb-territory-signal-sync.js";
import { runKonkursWatch } from "./konkurs-watch.js";
import { TENDER_REQUIREMENT_LEXICON } from "./sales-trigger-sync.js";
import { runMediaWatch } from "./media-watch.js";
import { syncProspectSegments } from "./prospect-segment-sync.js";
import { runAutoEnrichment } from "./auto-enrichment.js";
import { generateTenderStrategyBrief } from "./tender-strategy.js";
import { supplierProfileSchema } from "./supplier-profile.js";
import { composeOutreach } from "./outreach-composer.js";
import { butlerChat, type ChatMessage } from "./butler-chat.js";
import { getIndustryBenchmark, syncCompanyFinancials } from "./industry-benchmark.js";
import { syncSsbMomentumSignals } from "./ssb-momentum-signal-sync.js";
import { getTerritoryAnalysis } from "./territory-analysis.js";
import { buildSolutionEvidence, draftGrantSection, IN_SECTIONS, type SolutionKey } from "./grant-application.js";
import { assembleDocument, createApplication, draftAndSaveSection, getApplication, updateSection, type SectionStatus } from "./grant-workspace.js";
import { getDetectorPrecision } from "./system-precision.js";
import { addExperiment, listExperimentsWithEffect } from "./geo-experiments.js";
import { queryNormalizedSignals } from "./normalized-signal-store.js";
import { resolveOrgIdForUser } from "../leadgrid-org-resolver.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return activeSessions.get(auth.slice(7).trim()) ?? null;
  }
  return null;
}

export function registerOwnedChannelsRoutes({
  app, pool, activeSessions, isAdminEmail,
}: Deps): void {
  // «Hva krever markedet?» — aggregat over innsamlede anbud per vertikal:
  // andel utlysninger som nevner hvert krav (deterministisk leksikon).
  app.get("/api/integrations/tender-requirements", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!UUID_PATTERN.test(orgId)) return res.status(409).json({ error: "ingen_organisasjon" });
    try {
      const r = await pool.query<{ matched_topic: string; requirement: string; hits: number; total: number }>(
        `WITH tenders AS (
           SELECT matched_topic, raw
             FROM trigger_events
            WHERE organization_id = $1::uuid AND kind = 'tender'
              AND created_at > now() - interval '180 days'
         ),
         totals AS (SELECT matched_topic, COUNT(*)::int AS total FROM tenders GROUP BY 1)
         SELECT t.matched_topic, req.requirement, COUNT(*)::int AS hits, tot.total
           FROM tenders t
           JOIN totals tot USING (matched_topic),
                jsonb_array_elements_text(COALESCE(t.raw->'requirements','[]'::jsonb)) req(requirement)
          GROUP BY t.matched_topic, req.requirement, tot.total
          ORDER BY t.matched_topic, hits DESC`,
        [orgId],
      );
      const totalsRes = await pool.query<{ matched_topic: string; total: number }>(
        `SELECT matched_topic, COUNT(*)::int AS total FROM trigger_events
          WHERE organization_id = $1::uuid AND kind = 'tender'
            AND created_at > now() - interval '180 days'
          GROUP BY 1 ORDER BY 2 DESC`,
        [orgId],
      );
      const labels = Object.fromEntries(TENDER_REQUIREMENT_LEXICON.map((x) => [x.key, x.label]));
      return res.json({
        windowDays: 180,
        verticals: totalsRes.rows.map((t) => ({
          topic: t.matched_topic,
          tenders: t.total,
          requirements: r.rows
            .filter((row) => row.matched_topic === t.matched_topic)
            .map((row) => ({
              key: row.requirement,
              label: labels[row.requirement] ?? row.requirement,
              hits: row.hits,
              share: Math.round((row.hits / t.total) * 100) / 100,
            })),
        })),
        note: "Deterministisk tekst-leksikon over anbudsoverskrift+beskrivelse — nedre grense, ikke full kravanalyse av konkurransegrunnlag.",
      });
    } catch (err) {
      console.error("[tender-requirements] failed", err);
      return res.status(500).json({ error: "aggregate_failed" });
    }
  });

  // RSS-bransjevakt: norske medie-feeds → strategy_media-triggere.
  app.post("/api/integrations/sync/media-watch", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const result = await runMediaWatch(pool);
      if (result.errors.length > 0) console.warn("[media-watch]", result.errors.join(" | "));
      return res.json(result);
    } catch (err) {
      console.error("[media-watch] failed", err);
      return res.status(500).json({ error: "watch_failed" });
    }
  });

  // Vertikal-segmenter: bygg/refresh prospekteringslister (ukentlig guard).
  app.post("/api/integrations/sync/prospect-segments", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const result = await syncProspectSegments(pool);
      if (result.errors.length > 0) console.warn("[prospect-segments]", result.errors.join(" | "));
      return res.json(result);
    } catch (err) {
      console.error("[prospect-segments] failed", err);
      return res.status(500).json({ error: "sync_failed" });
    }
  });

  // Prospekteringslister for Leadgrid (admin): segment + valgfri kommune.
  app.get("/api/integrations/prospects", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    try {
      const segments = await pool.query(
        `SELECT segment_key, display_name, total_found, truncated, refreshed_at::text
           FROM prospect_segments ORDER BY segment_key`,
      );
      const segment = typeof req.query.segment === "string" ? req.query.segment : null;
      if (!segment) return res.json({ segments: segments.rows, companies: [] });

      const municipality = typeof req.query.municipality === "string" ? req.query.municipality : null;
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 100;
      const params: unknown[] = [segment];
      let where = "segment_key = $1";
      if (municipality) {
        params.push(municipality);
        where += ` AND municipality ILIKE $${params.length}`;
      }
      params.push(limit);
      const companies = await pool.query(
        `SELECT org_nr, name, municipality, employees, registered_at::text, website
           FROM prospect_companies WHERE ${where}
          ORDER BY employees DESC NULLS LAST, name LIMIT $${params.length}`,
        params,
      );
      return res.json({ segments: segments.rows, companies: companies.rows });
    } catch (err) {
      console.error("[prospects] list failed", err);
      return res.status(500).json({ error: "list_failed" });
    }
  });

  // Auto-berikelse: koble orgnr på uberikede CRM-selskaper (match-vakt).
  app.post("/api/integrations/sync/auto-enrichment", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const result = await runAutoEnrichment(pool);
      if (result.errors.length > 0) console.warn("[auto-enrichment]", result.errors.join(" | "));
      return res.json(result);
    } catch (err) {
      console.error("[auto-enrichment] failed", err);
      return res.status(500).json({ error: "enrichment_failed" });
    }
  });

  // Tilbudsstrategi-brief per anbud (on-demand — koster tokens).
  app.post("/api/integrations/tenders/strategy-brief", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!UUID_PATTERN.test(orgId)) return res.status(409).json({ error: "ingen_organisasjon" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.source !== "string" || typeof body.eventId !== "string") {
      return res.status(400).json({ error: "source_og_eventId_kreves" });
    }
    try {
      const result = await generateTenderStrategyBrief(pool, orgId, body.source, body.eventId, {
        force: body.force === true,
      });
      if ("error" in result) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch (err) {
      console.error("[tender-strategy] failed", err);
      return res.status(500).json({ error: "brief_failed" });
    }
  });

  // Leverandørprofil: hvilke anbudskrav kan org-en dokumentere?
  app.get("/api/integrations/supplier-profile", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!UUID_PATTERN.test(orgId)) return res.status(409).json({ error: "ingen_organisasjon" });
    const r = await pool.query(
      `SELECT capabilities, notes, updated_at::text FROM supplier_profile WHERE organization_id = $1::uuid`,
      [orgId],
    );
    return res.json({ profile: r.rows[0] ?? null });
  });

  app.put("/api/integrations/supplier-profile", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!UUID_PATTERN.test(orgId)) return res.status(409).json({ error: "ingen_organisasjon" });
    const parsed = supplierProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "ugyldig_profil",
        details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
    await pool.query(
      `INSERT INTO supplier_profile (organization_id, capabilities, notes, updated_at)
       VALUES ($1::uuid, $2::jsonb, $3, now())
       ON CONFLICT (organization_id) DO UPDATE SET
         capabilities = EXCLUDED.capabilities, notes = EXCLUDED.notes, updated_at = now()`,
      [orgId, JSON.stringify(parsed.data.capabilities), parsed.data.notes ?? null],
    );
    return res.json({ saved: true });
  });

  // Bud-sporing per anbud (fase 4-fasit): interested|bid|won|lost.
  app.patch("/api/integrations/tenders/bid-status", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!UUID_PATTERN.test(orgId)) return res.status(409).json({ error: "ingen_organisasjon" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const valid = new Set(["interested", "bid", "won", "lost"]);
    if (
      typeof body.source !== "string" || typeof body.eventId !== "string" ||
      typeof body.bidStatus !== "string" || !valid.has(body.bidStatus)
    ) {
      return res.status(400).json({ error: "source_eventId_og_gyldig_bidStatus_kreves" });
    }
    const r = await pool.query(
      `UPDATE trigger_events
          SET raw = COALESCE(raw, '{}'::jsonb) || jsonb_build_object(
                'bidStatus', $4::text, 'bidStatusAt', now()::text,
                'bidReason', $5::text)
        WHERE organization_id = $1::uuid AND source = $2 AND event_id = $3 AND kind = 'tender'`,
      [orgId, body.source, body.eventId, body.bidStatus,
       typeof body.reason === "string" ? body.reason.slice(0, 500) : null],
    );
    if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "anbud_ikke_funnet" });
    return res.json({ updated: true });
  });

  // Outreach-composer m/ butler (on-demand — koster tokens).
  app.post("/api/integrations/outreach/compose", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!UUID_PATTERN.test(orgId)) return res.status(409).json({ error: "ingen_organisasjon" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.intent !== "string" || body.intent.trim().length < 3) {
      return res.status(400).json({ error: "intent_kreves" });
    }
    const institution = body.institution as { recipientName?: unknown; facts?: unknown } | undefined;
    try {
      const result = await composeOutreach(pool, orgId, {
        leadId: typeof body.leadId === "string" ? body.leadId : undefined,
        intent: body.intent.trim().slice(0, 300),
        draft: typeof body.draft === "string" ? body.draft : undefined,
        institution:
          institution && typeof institution.recipientName === "string" && Array.isArray(institution.facts)
            ? {
                recipientName: institution.recipientName.slice(0, 120),
                facts: institution.facts as Array<{ label: string; value: string }>,
              }
            : undefined,
      });
      if ("error" in result) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch (err) {
      console.error("[outreach-composer] failed", err);
      return res.status(500).json({ error: "compose_failed" });
    }
  });

  // Butler-chat (JARVIS J2, BETA) — les-verktøy mot egne data.
  app.post("/api/integrations/butler/chat", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!UUID_PATTERN.test(orgId)) return res.status(409).json({ error: "ingen_organisasjon" });
    const body = (req.body ?? {}) as { messages?: unknown };
    if (!Array.isArray(body.messages)) return res.status(400).json({ error: "messages_kreves" });
    const history = body.messages
      .filter((m): m is ChatMessage =>
        typeof m === "object" && m !== null &&
        ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
        typeof (m as ChatMessage).content === "string")
      .slice(-20);
    try {
      const result = await butlerChat(pool, orgId, history);
      if ("error" in result) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch (err) {
      console.error("[butler-chat] failed", err);
      return res.status(500).json({ error: "chat_failed" });
    }
  });

  // Bransje-benchmark: nattlig regnskaps-innhenting over segmentene.
  app.post("/api/integrations/sync/company-financials", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const result = await syncCompanyFinancials(pool);
      if (result.errors.length > 0) console.warn("[benchmark-sync]", result.errors.join(" | "));
      return res.json(result);
    } catch (err) {
      console.error("[benchmark-sync] failed", err);
      return res.status(500).json({ error: "sync_failed" });
    }
  });

  app.get("/api/integrations/industry-benchmark", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    const segment = typeof req.query.segment === "string" ? req.query.segment : null;
    if (!segment) return res.status(400).json({ error: "segment_kreves" });
    try {
      const benchmark = await getIndustryBenchmark(pool, segment);
      if (!benchmark) return res.status(404).json({ error: "ukjent_segment" });
      return res.json({ benchmark });
    } catch (err) {
      console.error("[benchmark] failed", err);
      return res.status(500).json({ error: "benchmark_failed" });
    }
  });

  // SSB markeds-momentum: månedlig omsetningsindeks per vertikal-næring.
  app.post("/api/integrations/sync/ssb-momentum", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const result = await syncSsbMomentumSignals(pool);
      if (result.errors.length > 0) console.warn("[ssb-momentum]", result.errors.join(" | "));
      return res.json(result);
    } catch (err) {
      console.error("[ssb-momentum] failed", err);
      return res.status(500).json({ error: "sync_failed" });
    }
  });

  // Territorie-analyse: demografi × prospektsegment (on-demand).
  app.get("/api/integrations/territory-analysis", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    const segment = typeof req.query.segment === "string" ? req.query.segment : "danseundervisning";
    try {
      const analysis = await getTerritoryAnalysis(pool, segment);
      if ("error" in analysis) return res.status(502).json(analysis);
      return res.json({ analysis });
    } catch (err) {
      console.error("[territory-analysis] failed", err);
      return res.status(500).json({ error: "analysis_failed" });
    }
  });

  // JARVIS søknads-modus: løsningsbevis + IN-seksjonsutkast.
  app.get("/api/integrations/grant-application/evidence", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!UUID_PATTERN.test(orgId)) return res.status(409).json({ error: "ingen_organisasjon" });
    const solution = String(req.query.solution ?? "");
    if (!["leadgrid", "theroleroom", "creatorhub"].includes(solution)) {
      return res.status(400).json({ error: "solution_kreves (leadgrid|theroleroom|creatorhub)" });
    }
    try {
      const facts = await buildSolutionEvidence(pool, orgId, solution as SolutionKey);
      return res.json({ solution, sections: IN_SECTIONS, facts });
    } catch (err) {
      console.error("[grant-evidence] failed", err);
      return res.status(500).json({ error: "evidence_failed" });
    }
  });

  app.post("/api/integrations/grant-application/draft", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!UUID_PATTERN.test(orgId)) return res.status(409).json({ error: "ingen_organisasjon" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.solution !== "string" || typeof body.sectionKey !== "string") {
      return res.status(400).json({ error: "solution_og_sectionKey_kreves" });
    }
    try {
      const result = await draftGrantSection(pool, orgId, {
        solution: body.solution as SolutionKey,
        sectionKey: body.sectionKey,
        userNotes: typeof body.userNotes === "string" ? body.userNotes : undefined,
      });
      if ("error" in result) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch (err) {
      console.error("[grant-draft] failed", err);
      return res.status(500).json({ error: "draft_failed" });
    }
  });

  // Søknads-arbeidsboken (JARVIS søknads-modus, strukturert).
  const requireGrantAdmin = async (req: Request, res: Response): Promise<string | null> => {
    const session = getSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: "ikke_innlogget" }); return null; }
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      res.status(403).json({ error: "krever_admin" });
      return null;
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!UUID_PATTERN.test(orgId)) { res.status(409).json({ error: "ingen_organisasjon" }); return null; }
    return orgId;
  };

  app.post("/api/integrations/grant-workspace", async (req: Request, res: Response) => {
    const orgId = await requireGrantAdmin(req, res);
    if (!orgId) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (
      typeof body.solution !== "string" ||
      !["leadgrid", "theroleroom", "creatorhub"].includes(body.solution) ||
      typeof body.program !== "string" || typeof body.title !== "string"
    ) {
      return res.status(400).json({ error: "solution_program_og_title_kreves" });
    }
    const created = await createApplication(pool, orgId, {
      solution: body.solution as SolutionKey,
      program: body.program,
      title: body.title,
    });
    return res.json(created);
  });

  app.get("/api/integrations/grant-workspace", async (req: Request, res: Response) => {
    const orgId = await requireGrantAdmin(req, res);
    if (!orgId) return;
    const r = await pool.query(
      `SELECT id::text, solution, program, title, status, updated_at::text
         FROM grant_applications WHERE organization_id = $1::uuid
        ORDER BY updated_at DESC LIMIT 20`,
      [orgId],
    );
    return res.json({ applications: r.rows });
  });

  app.get("/api/integrations/grant-workspace/:id", async (req: Request, res: Response) => {
    const orgId = await requireGrantAdmin(req, res);
    if (!orgId) return;
    const app_ = await getApplication(pool, orgId, req.params.id);
    if (!app_) return res.status(404).json({ error: "soknad_ikke_funnet" });
    return res.json({ application: app_ });
  });

  app.patch("/api/integrations/grant-workspace/:id/sections/:key", async (req: Request, res: Response) => {
    const orgId = await requireGrantAdmin(req, res);
    if (!orgId) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const ok = await updateSection(pool, orgId, req.params.id, req.params.key, {
      draftText: typeof body.draftText === "string" ? body.draftText : undefined,
      userNotes: typeof body.userNotes === "string" ? body.userNotes : undefined,
      status: typeof body.status === "string" ? (body.status as SectionStatus) : undefined,
    });
    if (!ok) return res.status(404).json({ error: "soknad_eller_seksjon_ikke_funnet" });
    return res.json({ updated: true });
  });

  app.post("/api/integrations/grant-workspace/:id/sections/:key/draft", async (req: Request, res: Response) => {
    const orgId = await requireGrantAdmin(req, res);
    if (!orgId) return;
    try {
      const result = await draftAndSaveSection(pool, orgId, req.params.id, req.params.key);
      if ("error" in result) return res.status(result.status).json({ error: result.error });
      return res.json(result);
    } catch (err) {
      console.error("[grant-workspace] draft failed", err);
      return res.status(500).json({ error: "draft_failed" });
    }
  });

  app.get("/api/integrations/grant-workspace/:id/export", async (req: Request, res: Response) => {
    const orgId = await requireGrantAdmin(req, res);
    if (!orgId) return;
    const doc = await assembleDocument(pool, orgId, req.params.id);
    if (doc === null) return res.status(404).json({ error: "soknad_ikke_funnet" });
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="soknad.md"');
    return res.send(doc);
  });

  // Selv-måling: presisjon per detektor (idé 1+6).
  app.get("/api/integrations/system-precision", async (req: Request, res: Response) => {
    const orgId = await requireGrantAdmin(req, res);
    if (!orgId) return;
    return res.json({ precision: await getDetectorPrecision(pool, orgId) });
  });

  // GEO-eksperimentloggen (idé 3).
  app.post("/api/integrations/geo-experiments", async (req: Request, res: Response) => {
    const orgId = await requireGrantAdmin(req, res);
    if (!orgId) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.experimentDate !== "string" || typeof body.description !== "string") {
      return res.status(400).json({ error: "experimentDate_og_description_kreves" });
    }
    const created = await addExperiment(pool, orgId, {
      experimentDate: body.experimentDate,
      description: body.description,
      topic: typeof body.topic === "string" ? body.topic : undefined,
      url: typeof body.url === "string" ? body.url : undefined,
    });
    return res.json(created);
  });

  app.get("/api/integrations/geo-experiments", async (req: Request, res: Response) => {
    const orgId = await requireGrantAdmin(req, res);
    if (!orgId) return;
    return res.json({ experiments: await listExperimentsWithEffect(pool, orgId) });
  });

  // Konkursvakten: registerstatus for alle CRM-selskaper m/ orgnr.
  app.post("/api/integrations/sync/konkurs-watch", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const result = await runKonkursWatch(pool);
      if (result.errors.length > 0) console.warn("[konkurs-watch]", result.errors.join(" | "));
      return res.json(result);
    } catch (err) {
      console.error("[konkurs-watch] failed", err);
      return res.status(500).json({ error: "watch_failed" });
    }
  });

  // SSB territorietall: bedrifter per fylke x næring → normalized_signals.
  app.post("/api/integrations/sync/ssb-territory", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const result = await syncSsbTerritorySignals(pool);
      if (result.errors.length > 0) console.warn("[ssb-territory]", result.errors.join(" | "));
      return res.json(result);
    } catch (err) {
      console.error("[ssb-territory] failed", err);
      return res.status(500).json({ error: "sync_failed" });
    }
  });

  // Salgstriggere: anbud (TED) + strategisignaler (GDELT) → trigger_events.
  app.post("/api/integrations/sync/sales-triggers", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const result = await syncSalesTriggers(pool);
      if (result.errors.length > 0) console.warn("[sales-triggers]", result.errors.join(" | "));
      return res.json(result);
    } catch (err) {
      console.error("[sales-triggers] failed", err);
      return res.status(500).json({ error: "sync_failed" });
    }
  });

  // Offentlige registerdata (BRREG): markedsstørrelse + nyregistreringer
  // per vertikal → normalized_signals. Åpne data, NLOD.
  app.post("/api/integrations/sync/brreg-market", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const result = await syncBrregMarketSignals(pool);
      if (result.errors.length > 0) console.warn("[brreg-market-sync]", result.errors.join(" | "));
      return res.json(result);
    } catch (err) {
      console.error("[brreg-market-sync] failed", err);
      return res.status(500).json({ error: "sync_failed" });
    }
  });

  // Kundens egne salgsdata (won/lost per ISO-uke) → normalized_signals.
  // first_party-kilde; idempotent; fase 4-fasiten bygges her.
  app.post("/api/integrations/sync/leadgrid-sales", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const result = await syncLeadgridSalesSignals(pool);
      if (result.errors.length > 0) console.warn("[leadgrid-sales-sync]", result.errors.join(" | "));
      return res.json(result);
    } catch (err) {
      console.error("[leadgrid-sales-sync] failed", err);
      return res.status(500).json({ error: "sync_failed" });
    }
  });

  app.post("/api/integrations/sync/owned-channels", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const producers = typeof body.producerUserId === "string"
        ? [body.producerUserId]
        : await listSyncableProducers(pool);

      // Fire-and-forget, sekvensielt — eksterne kvoter er delte
      void (async () => {
        for (const producerUserId of producers) {
          try {
            const result = await syncOwnedChannelSignals(pool, { producerUserId });
            console.log(
              `[owned-sync] ${producerUserId}: ${result.inserted} nye signaler` +
                (result.skippedReason ? ` (${result.skippedReason})` : ""),
            );
          } catch (err) {
            console.error(`[owned-sync] feilet for ${producerUserId}:`, err);
          }
        }
      })();

      return res.json({ started: producers.length });
    } catch (err) {
      console.error("[owned-sync] cron failed", err);
      return res.status(500).json({ error: "sync_failed" });
    }
  });

  app.get("/api/integrations/signals/ai-traffic", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      if (!UUID_PATTERN.test(orgId)) {
        return res.json({ sources: [], total: 0, note: "ingen organisasjon tilknyttet" });
      }
      const signals = await queryNormalizedSignals(pool, {
        organizationId: orgId,
        metricType: "ai_referral_sessions",
        limit: 500,
      });
      // Nyeste signal per (kilde/topic) — re-synk overlapper i perioder
      const bySource = new Map<string, { sessions: number; collectedAt: string; periodStart: string; periodEnd: string }>();
      for (const s of signals) {
        const existing = bySource.get(s.topic);
        if (!existing || s.collectedAt > existing.collectedAt) {
          bySource.set(s.topic, {
            sessions: s.metricValue,
            collectedAt: s.collectedAt,
            periodStart: s.periodStart,
            periodEnd: s.periodEnd,
          });
        }
      }
      const sources = [...bySource.entries()]
        .map(([source, v]) => ({ source, sessions: v.sessions }))
        .sort((a, b) => b.sessions - a.sessions);
      const newest = [...bySource.values()].sort((a, b) => (a.collectedAt < b.collectedAt ? 1 : -1))[0];
      return res.json({
        sources,
        total: sources.reduce((sum, s) => sum + s.sessions, 0),
        periodStart: newest?.periodStart ?? null,
        periodEnd: newest?.periodEnd ?? null,
        lastCollectedAt: newest?.collectedAt ?? null,
      });
    } catch (err) {
      console.error("[ai-traffic] read failed", err);
      return res.status(500).json({ error: "read_failed" });
    }
  });
}
