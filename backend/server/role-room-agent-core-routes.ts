/**
 * role-room-agent-core-routes.ts
 *
 * Setup-funksjon for kjerne-/access-endpoints under /api/role-room/agent/* —
 * Innholdsprodusent-mode-feature for AI-drevet content-strategi.
 *
 * 3 endpoints (kjerne):
 *   - GET  /agent/access                              (feature-flag + provider-config status)
 *   - POST /agent/producer-bootstrap                  (Claude → markedsplan-bootstrap)
 *   - GET  /agent/feed-plan/approvals/pending         (pending posts på tvers av prosjekter)
 *
 * NB: Resten av agent-clusteret er splittet i sub-moduler:
 *   - role-room-agent-feed-plan-routes.ts (10 endpoints — templates,
 *     strategy/recommend, drive, CRUD, approve)
 *   - role-room-agent-inspect-routes.ts (6 endpoints — meta-page-inspect,
 *     page-search, page-content-inspect, hashtag-suggest,
 *     ig-hashtag-inspect, ads-attribution-inspect)
 *
 * Auth: requireAdminSession + feature-flag `role-room-agent-producer`.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleRoomAgentCoreRoutes } from "./role-room-agent-core-routes";
 *
 *   setupRoleRoomAgentCoreRoutes({
 *     app, pool, getActiveSessionFromRequest, requireAdminSession,
 *     isCompatAdminFeatureEnabled, getCompatAdminFeature,
 *   });
 *
 * Mode-noter: Innholdsprodusent-mode-feature, gated på feature-flag.
 * Backend mode-agnostic.
 */

import crypto from "node:crypto";
import zlib from "node:zlib";
import type express from "express";
import type { Pool } from "pg";

import {
  generateRoleRoomAgentProducerBootstrap,
  getRoleRoomAgentRuntimeConfig,
  fetchBrregCompany,
  fetchWebsiteInsights,
  fetchGooglePlacesBusinessSignals,
  fetchGooglePlacesCompetitorAnalysis,
  fetchGooglePlacesLocalPresencePlan,
  fetchMerchSuppliersAnalysis,
  extractBrandColorsFromLogo,
} from "./role-room-agent.js";
import {
  persistResearchVersion,
  lookupResearchVersion,
  listResearchVersions,
  loadPreviousResearchResult,
} from "./role-room-research-versions.js";
import { generateExecutiveSummary } from "./role-room-research-summary.js";
import { checkAgentEntitlement } from "./role-room-agent-entitlements.js";
import {
  validateResearchResult,
  detectMaterialChanges,
  evaluateContentStoryLogicVagueness,
} from "./role-room-research-validation.js";
import { readString } from "./_shared";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomAgentCoreRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId: string; email: string; role?: string } | null;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
  isCompatAdminFeatureEnabled: (featureId: string) => boolean;
  getCompatAdminFeature: (featureId: string) => Record<string, unknown> | null;
}

export function setupRoleRoomAgentCoreRoutes(
  deps: RoleRoomAgentCoreRoutesDeps,
): void {
  const {
    app,
    pool,
    getActiveSessionFromRequest,
    requireAdminSession,
    isCompatAdminFeatureEnabled,
    getCompatAdminFeature,
  } = deps;

  // Admin feature flags compatibility endpoints
  app.get("/api/role-room/agent/access", (req, res) => {
    const featureId = "role-room-agent-producer";
    const feature = getCompatAdminFeature(featureId);
    const session = getActiveSessionFromRequest(req);
    const runtimeConfig = getRoleRoomAgentRuntimeConfig();
    const normalizedRole = String(session?.role || "").trim().toLowerCase();
    const isAdmin =
      normalizedRole === "admin" ||
      normalizedRole === "owner" ||
      normalizedRole === "super_admin";
    const enabled = isCompatAdminFeatureEnabled(featureId);

    res.json({
      success: true,
      featureId,
      enabled,
      isAdmin,
      allowed: enabled && isAdmin,
      stage: "admin_test",
      audience: "content_producer",
      feature: feature ?? null,
      provider: runtimeConfig.provider,
      providerConfigured: runtimeConfig.providerConfigured,
      defaultModel: runtimeConfig.defaultModel,
      googlePlacesConfigured: runtimeConfig.googlePlacesConfigured,
      cohereConfigured: runtimeConfig.cohereConfigured,
      cohereRerankModel: runtimeConfig.cohereRerankModel,
      brregConfigured: runtimeConfig.brregConfigured,
    });
  });

  app.post("/api/role-room/agent/producer-bootstrap", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({
        success: false,
        error: "The Role Room Agent er ikke aktivert.",
      });
    }

    const session = requireAdminSession(req, res);
    if (!session) {
      return;
    }

    const body =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)
        : {};
    const projectId = readString(body.projectId);
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: "projectId er påkrevd.",
      });
    }

    try {
      const result = await generateRoleRoomAgentProducerBootstrap({
        projectId,
        projectName: readString(body.projectName) ?? undefined,
        websiteUrl: readString(body.websiteUrl) ?? undefined,
        organizationNumber: readString(body.organizationNumber) ?? undefined,
        companyName: readString(body.companyName) ?? undefined,
        extraContext: readString(body.extraContext) ?? undefined,
      });

      // Item #42 — generate executive summary in parallel with version
      // persist. Both are best-effort — failure of either doesn't block
      // the bootstrap response.
      const [versionInfo, executiveSummary] = await Promise.all([
        result.researchId
          ? persistResearchVersion(pool, {
              projectId,
              researchId: result.researchId,
              generatedBy: session.email ?? session.userId,
              serializedResult: result,
              serviceLatencies: result.serviceLatencies ?? null,
              fallbacksUsed: result.fallbacksUsed ?? [],
              totalMs: result.serviceLatencies?.totalMs ?? null,
              provider: result.provider ?? null,
              model: result.model ?? null,
            })
          : Promise.resolve(null),
        generateExecutiveSummary(result),
      ]);
      // Attach the summary + validation flags onto the result so the
      // frontend overlay can render everything without extra round-trips.
      // Validation is synchronous and best-effort; never throws.
      const syncFlags = validateResearchResult(result);
      // Item #61 + #58: async validators kjører parallelt for å unngå
      // å stable opp latency. Begge er best-effort og returnerer [] ved
      // feil eller manglende env-config.
      const [previousResult, vaguenessFlags] = await Promise.all([
        result.researchId
          ? loadPreviousResearchResult(pool, projectId, result.researchId)
          : Promise.resolve(null),
        evaluateContentStoryLogicVagueness(result),
      ]);
      const changeFlags = previousResult ? detectMaterialChanges(result, previousResult) : [];
      const validationFlags = [...syncFlags, ...changeFlags, ...vaguenessFlags];
      const resultWithSummary = { ...result, executiveSummary, validationFlags };

      // Item #39 — team-notifikasjon. Best-effort, etter at version er
      // persistert (vi vil ha versjons-nummeret i meldingen).
      void notifyResearchCompleted({
        projectId,
        userId: session.userId,
        researchId: result.researchId,
        versionNumber: versionInfo?.versionNumber ?? null,
        totalMs: result.serviceLatencies?.totalMs,
        datapoints:
          (result.competitorAnalysis?.competitors?.length ?? 0)
          + (result.localPresencePlan?.nearbyOpportunities?.length ?? 0)
          + (result.socialProfileCandidates?.length ?? 0)
          + (result.merchSuppliers?.suppliers?.length ?? 0),
      });

      return res.json({
        success: true,
        stage: "admin_test",
        featureId,
        generatedBy: {
          userId: session.userId,
          email: session.email,
          role: session.role,
        },
        result: resultWithSummary,
        version: versionInfo,
      });
    } catch (error) {
      console.error("[role-room-agent] Failed to generate producer bootstrap", error);
      return res.status(500).json({
        success: false,
        error: "Kunne ikke generere utkast fra The Role Room Agent.",
      });
    }
  });

  // Live-progress SSE variant of the bootstrap endpoint — item #2.
  // Same input/output as POST /producer-bootstrap, but the connection
  // stays open and emits one `event: stage` event per pipeline stage
  // (Brreg, website, Google Places, etc.) followed by `event: done`
  // with the final result. Falls back gracefully if the pipeline throws
  // — emits `event: error` then closes. Frontend opens it with
  // EventSource for a real-time progress bar.
  app.post("/api/role-room/agent/producer-bootstrap-stream", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({
        success: false,
        error: "The Role Room Agent er ikke aktivert.",
      });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const projectId = readString(body.projectId);
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const writeEvent = (event: string, data: unknown): void => {
      try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        // socket may be torn down; ignore
      }
    };
    writeEvent("start", { projectId, startedAt: new Date().toISOString() });

    try {
      const result = await generateRoleRoomAgentProducerBootstrap(
        {
          projectId,
          projectName: readString(body.projectName) ?? undefined,
          websiteUrl: readString(body.websiteUrl) ?? undefined,
          organizationNumber: readString(body.organizationNumber) ?? undefined,
          companyName: readString(body.companyName) ?? undefined,
          extraContext: readString(body.extraContext) ?? undefined,
        },
        {
          onProgress: (evt) => writeEvent("stage", evt),
        },
      );
      // Persist version + summary in parallel. Same best-effort pattern
      // as the non-SSE path. Run before "done" event so the frontend
      // gets everything in one payload.
      const [versionInfo, executiveSummary] = await Promise.all([
        result.researchId
          ? persistResearchVersion(pool, {
              projectId,
              researchId: result.researchId,
              generatedBy: session.email ?? session.userId,
              serializedResult: result,
              serviceLatencies: result.serviceLatencies ?? null,
              fallbacksUsed: result.fallbacksUsed ?? [],
              totalMs: result.serviceLatencies?.totalMs ?? null,
              provider: result.provider ?? null,
              model: result.model ?? null,
            })
          : Promise.resolve(null),
        generateExecutiveSummary(result),
      ]);
      const syncFlags = validateResearchResult(result);
      const [previousResult, vaguenessFlags] = await Promise.all([
        result.researchId
          ? loadPreviousResearchResult(pool, projectId, result.researchId)
          : Promise.resolve(null),
        evaluateContentStoryLogicVagueness(result),
      ]);
      const changeFlags = previousResult ? detectMaterialChanges(result, previousResult) : [];
      const validationFlags = [...syncFlags, ...changeFlags, ...vaguenessFlags];
      const resultWithSummary = { ...result, executiveSummary, validationFlags };
      // Item #39 — team-notifikasjon (samme som non-SSE path)
      void notifyResearchCompleted({
        projectId,
        userId: session.userId,
        researchId: result.researchId,
        versionNumber: versionInfo?.versionNumber ?? null,
        totalMs: result.serviceLatencies?.totalMs,
        datapoints:
          (result.competitorAnalysis?.competitors?.length ?? 0)
          + (result.localPresencePlan?.nearbyOpportunities?.length ?? 0)
          + (result.socialProfileCandidates?.length ?? 0)
          + (result.merchSuppliers?.suppliers?.length ?? 0),
      });
      writeEvent("done", { success: true, result: resultWithSummary, version: versionInfo });
    } catch (error) {
      writeEvent("error", {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      res.end();
    }
  });

  // Share-link for research-resultat — item #13. Tar et research-payload
  // pluss "expiresInDays" (default 7), signerer en kompakt token med
  // HMAC-SHA-256, og returnerer en URL som kan åpnes uten innlogging.
  // Ingen DB — token-en bærer hele payloadet (base64url-pakket) og en
  // signatur. Server-secret er ROLE_ROOM_SHARE_SECRET; uten env-var
  // refuser endpoint-en å utstede tokens (no silent fallback to a
  // hardcoded secret — that would let anyone with the codebase forge
  // valid share-links). Render setter denne via generateValue: true.
  const SHARE_SECRET = process.env.ROLE_ROOM_SHARE_SECRET ?? null;
  const requireShareSecret = (): string => {
    if (!SHARE_SECRET || SHARE_SECRET.length < 32) {
      throw new Error(
        "ROLE_ROOM_SHARE_SECRET er ikke satt (eller er for kort, krever ≥32 tegn). Sett miljøvariabelen før share-link-endpoints kan brukes.",
      );
    }
    return SHARE_SECRET;
  };

  const b64urlEncode = (input: Buffer | string): string => {
    const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const b64urlDecode = (input: string): Buffer => {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
    return Buffer.from(padded, "base64");
  };

  app.post("/api/role-room/agent/research/share", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const result = body.result;
    if (!result || typeof result !== "object") {
      return res.status(400).json({ success: false, error: "result-payloadet er påkrevd." });
    }
    const expiresInDaysRaw = Number(body.expiresInDays);
    const expiresInDays = Number.isFinite(expiresInDaysRaw) && expiresInDaysRaw > 0 && expiresInDaysRaw <= 30
      ? Math.round(expiresInDaysRaw)
      : 7;
    const issuedAt = Date.now();
    const expiresAt = issuedAt + expiresInDays * 24 * 60 * 60 * 1000;
    const envelope = {
      v: 1,
      iat: issuedAt,
      exp: expiresAt,
      iss: session.userId,
      result,
    };
    const json = JSON.stringify(envelope);
    let secret: string;
    try {
      secret = requireShareSecret();
    } catch (err) {
      return res.status(503).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
    // Gzip the JSON before base64url-encoding. Research-payloads are
    // mostly repeated structure (consistent JSON keys, repeating brand
    // names, address formats) so gzip typically yields ~70% reduction.
    // Two token formats:
    //   z<base64url-gzipped-json>.<sig>  — inline payload (default)
    //   d<dbToken>.<sig>                  — DB-pointer (when payload > 500kB)
    //   <base64url-json>.<sig>            — legacy plain JSON (back-compat)
    // Both are HMAC-signed so the prefix can't be stripped/forged. The DB
    // table is only read if the d-prefix is present.
    const compressed = zlib.gzipSync(Buffer.from(json, "utf8"));
    const DB_FALLBACK_THRESHOLD = 500_000;
    let payloadB64: string;
    let dbToken: string | null = null;
    if (compressed.length > DB_FALLBACK_THRESHOLD) {
      // Persist payload in role_room_shared_research and use a short
      // pointer-token. Falls back to 413 if the table doesn't exist or
      // writes fail — better to surface an explicit error than to silently
      // discard the share.
      dbToken = crypto.randomUUID().replace(/-/g, "");
      try {
        await pool.query(
          `INSERT INTO role_room_shared_research (token, payload, created_by, expires_at)
           VALUES ($1, $2::jsonb, $3, $4)`,
          [dbToken, json, session.email ?? session.userId, new Date(expiresAt)],
        );
      } catch (dbError) {
        console.error("[role-room-agent] share-link DB fallback failed", dbError);
        return res.status(413).json({
          success: false,
          error: "Research-resultatet er for stort for inline share-link, og DB-fallback kunne ikke lagre. Kjør 0089-migrasjonen.",
        });
      }
      payloadB64 = `d${dbToken}`;
    } else {
      payloadB64 = `z${b64urlEncode(compressed)}`;
    }
    const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest();
    const sigB64 = b64urlEncode(signature);
    const token = `${payloadB64}.${sigB64}`;
    const origin = (req.headers["x-forwarded-host"] || req.headers.host) as string | undefined;
    const proto = (req.headers["x-forwarded-proto"] as string | undefined) || (req.secure ? "https" : "http");
    const baseUrl = origin ? `${proto}://${origin}` : "";
    const shareUrl = `${baseUrl}/role-room/research/shared/${token}`;
    return res.json({
      success: true,
      token,
      shareUrl,
      issuedAt: new Date(issuedAt).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      expiresInDays,
    });
  });

  app.get("/api/role-room/agent/research/shared/:token", async (req, res) => {
    const token = readString(req.params.token) || "";
    const dot = token.indexOf(".");
    if (dot < 1) {
      return res.status(400).json({ success: false, error: "Ugyldig token-format." });
    }
    const payloadB64 = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);
    let secret: string;
    try {
      secret = requireShareSecret();
    } catch (err) {
      return res.status(503).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
    const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest();
    let providedSig: Buffer;
    try {
      providedSig = b64urlDecode(sigB64);
    } catch {
      return res.status(400).json({ success: false, error: "Token-signaturen er korrupt." });
    }
    if (providedSig.length !== expectedSig.length || !crypto.timingSafeEqual(providedSig, expectedSig)) {
      return res.status(403).json({ success: false, error: "Token-signaturen er ugyldig." });
    }

    // Three token formats — see comment in /share route above.
    // d-prefix = DB-pointer; z-prefix = gzipped inline; no prefix = legacy.
    let envelope: { v?: number; exp?: number; iat?: number; iss?: string; result?: unknown };
    if (payloadB64.startsWith("d")) {
      const dbToken = payloadB64.slice(1);
      try {
        const row = await pool.query<{ payload: unknown; expires_at: Date; created_by: string | null; created_at: Date }>(
          `UPDATE role_room_shared_research
              SET view_count = view_count + 1,
                  last_viewed_at = now()
            WHERE token = $1
              AND expires_at > now()
            RETURNING payload, expires_at, created_by, created_at`,
          [dbToken],
        );
        if (!row.rows[0]) {
          return res.status(410).json({ success: false, error: "Share-link er utløpt eller ikke funnet." });
        }
        // payload is stored as the envelope JSON, but jsonb already parses it.
        envelope = row.rows[0].payload as typeof envelope;
      } catch (dbError) {
        console.error("[role-room-agent] share-link DB fetch failed", dbError);
        return res.status(500).json({ success: false, error: "Kunne ikke hente DB-lagret share-link." });
      }
    } else {
      try {
        const isGzipped = payloadB64.startsWith("z");
        const rawB64 = isGzipped ? payloadB64.slice(1) : payloadB64;
        const decoded = b64urlDecode(rawB64);
        const json = isGzipped ? zlib.gunzipSync(decoded).toString("utf8") : decoded.toString("utf8");
        envelope = JSON.parse(json);
      } catch {
        return res.status(400).json({ success: false, error: "Token-payloadet kunne ikke parses." });
      }
    }
    if (typeof envelope.exp !== "number" || envelope.exp < Date.now()) {
      return res.status(410).json({ success: false, error: "Share-link er utløpt." });
    }
    return res.json({
      success: true,
      result: envelope.result,
      issuedAt: envelope.iat ? new Date(envelope.iat).toISOString() : null,
      expiresAt: new Date(envelope.exp).toISOString(),
      issuedBy: envelope.iss ?? null,
    });
  });

  // Cache-lag for forutsetnings-fetchere. role_room_research_cache lagrer
  // brreg / website / business_signals / brand_palette per prosjekt med
  // 24t TTL. refresh-section sjekker denne først og hopper over fetch-
  // kallet hvis cache er fersk. Tabellen ligger i 0087-migrasjonen — try/
  // catch swallow'er query-feil så app starter selv om migrasjonen ikke
  // har kjørt enda (cachen blir bare alltid en miss da).
  // Item #39 — team-notifikasjon når research er ferdig. Skriver én row
  // i producer_project_notifications som dukker opp i prosjektets inbox
  // (allerede koblet til frontend via useProducerNotifications). Best-
  // effort: tabellen kan mangle i noen miljøer; vi swallow'er feil.
  const notifyResearchCompleted = async (params: {
    projectId: string;
    userId: string;
    researchId: string | undefined;
    versionNumber: number | null;
    totalMs: number | null | undefined;
    datapoints: number;
  }): Promise<void> => {
    try {
      const versionLabel = params.versionNumber !== null ? ` (v${params.versionNumber})` : '';
      const timeLabel = typeof params.totalMs === 'number' ? ` på ${(params.totalMs / 1000).toFixed(1)}s` : '';
      await pool.query(
        `INSERT INTO producer_project_notifications (
           project_id, assigned_to_user_id, inbox_type, event_type,
           title, message, read, created_at, updated_at
         ) VALUES ($1, $2, 'ai_research', 'research_completed', $3, $4, FALSE, now(), now())`,
        [
          params.projectId,
          params.userId,
          `Research ferdig${versionLabel}`,
          `Bootstrap fant ${params.datapoints} datapunkter${timeLabel}. Klar for marketing plan.`,
        ],
      );
    } catch {
      // notifications er advisory
    }
  };

  const RESEARCH_CACHE_TTL_HOURS = 24;
  type ResearchCacheKey = "brreg" | "website" | "business_signals" | "brand_palette";
  const readResearchCache = async <T>(projectId: string, cacheKey: ResearchCacheKey): Promise<T | null> => {
    try {
      const result = await pool.query<{ payload: T }>(
        `SELECT payload FROM role_room_research_cache
          WHERE project_id = $1 AND cache_key = $2 AND expires_at > now()
          LIMIT 1`,
        [projectId, cacheKey],
      );
      return result.rows[0]?.payload ?? null;
    } catch {
      return null;
    }
  };
  const writeResearchCache = async (projectId: string, cacheKey: ResearchCacheKey, payload: unknown): Promise<void> => {
    if (payload === null || payload === undefined) return;
    try {
      await pool.query(
        `INSERT INTO role_room_research_cache (project_id, cache_key, payload, fetched_at, expires_at)
         VALUES ($1, $2, $3::jsonb, now(), now() + ($4 || ' hours')::interval)
         ON CONFLICT (project_id, cache_key) DO UPDATE SET
           payload = EXCLUDED.payload,
           fetched_at = EXCLUDED.fetched_at,
           expires_at = EXCLUDED.expires_at`,
        [projectId, cacheKey, JSON.stringify(payload), String(RESEARCH_CACHE_TTL_HOURS)],
      );
    } catch {
      // Cache writes are advisory.
    }
  };

  // Cost + quota estimate for marketing-plan-generering — items #48 + #49.
  // Tar researchId (eller råresultat-størrelse) og estimerer:
  //   - tokens: heuristisk basert på companyProfile-felt-størrelse
  //   - costNok: token-count × Anthropic-pricing for Sonnet 4.5 (~kr 0.04 / 1k tok ut)
  //   - remainingCalls: fra eksisterende entitlement-system
  // Frontend rendrer som badge ved Marketing Plan-CTA.
  app.get("/api/role-room/agent/research/cost-estimate", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    // Plan-generering tar typisk 2500-4000 input-tokens (system prompt +
    // companyProfile + competitorAnalysis-summary) og 800-1500 output.
    // Bruker en bevisst romslig estimering — bedre å under-love og
    // over-deliver enn å vise en kostnad lavere enn faktisk forbruk.
    const profileFieldsRaw = Number(req.query.profileFields);
    const competitorsRaw = Number(req.query.competitors);
    const profileFields = Number.isFinite(profileFieldsRaw) ? Math.max(0, profileFieldsRaw) : 12;
    const competitors = Number.isFinite(competitorsRaw) ? Math.max(0, competitorsRaw) : 8;

    const estimatedInputTokens = 1800 + profileFields * 60 + competitors * 70;
    const estimatedOutputTokens = 1200 + Math.min(800, competitors * 30);
    // Anthropic Sonnet 4.5 pricing: $3 / 1M in, $15 / 1M out. NOK rate ~10.5.
    const costUsd = (estimatedInputTokens * 3 / 1_000_000) + (estimatedOutputTokens * 15 / 1_000_000);
    const costNok = Math.round(costUsd * 10.5 * 100) / 100;

    let remainingCalls: number | null = null;
    let entitlementStatus: string | null = null;
    try {
      const ent = await checkAgentEntitlement(pool, session.userId, session.role);
      entitlementStatus = ent.status;
      // Trial entitlements typically have a daily/total cap exposed
      // through the entitlement reason text — surface as soft hint.
      if (ent.status === 'trial' && typeof (ent as { remainingCalls?: number }).remainingCalls === 'number') {
        remainingCalls = (ent as { remainingCalls?: number }).remainingCalls!;
      }
    } catch {
      // Entitlement service down — UI shows estimate without quota line.
    }

    return res.json({
      success: true,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostNok: costNok,
      remainingCalls,
      entitlementStatus,
    });
  });

  // Versjons-metadata for én research-kjøring. UI bruker dette for
  // "Versjon X av Y"-badgen i overlay når researchVersion ikke kom med
  // i bootstrap-responsen (f.eks. eldre cached snapshot).
  app.get("/api/role-room/agent/research/version-info", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const researchId = readString(req.query.researchId);
    if (!researchId) {
      return res.status(400).json({ success: false, error: "researchId er påkrevd." });
    }
    const info = await lookupResearchVersion(pool, researchId);
    if (!info) {
      return res.status(404).json({ success: false, error: "Fant ingen versjon for researchId." });
    }
    return res.json({ success: true, ...info });
  });

  // Liste over alle versjoner for et prosjekt — driver versjons-velgeren
  // og cross-version-diff-UI.
  app.get("/api/role-room/agent/research/versions", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = readString(req.query.projectId);
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? Math.round(limitRaw) : 50;
    const versions = await listResearchVersions(pool, projectId, limit);
    return res.json({ success: true, versions });
  });

  // Per-seksjon re-research — item #10. Lar UI bare oppdatere én bit av
  // research-resultatet (konkurrenter, lokal, social, merch) uten å
  // kjøre hele bootstrap-pipelinen på nytt. Frontend mergerer responsen
  // inn i eksisterende bootstrap-result og persister snapshot.
  // Forutsetnings-fetchere (brreg + website + businessSignals) hentes
  // fra role_room_research_cache når mulig — sparer 3-5 sekunder per
  // refresh. forceRefresh=true bypasser cache.
  app.post("/api/role-room/agent/producer-bootstrap/refresh-section", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const projectId = readString(body.projectId);
    const section = readString(body.section);
    if (!projectId) return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    if (!section) return res.status(400).json({ success: false, error: "section er påkrevd." });
    const allowedSections = new Set(["competitors", "local", "merch", "social", "business", "brand_palette"]);
    if (!allowedSections.has(section)) {
      return res.status(400).json({
        success: false,
        error: `section må være en av: ${Array.from(allowedSections).join(", ")}`,
      });
    }

    try {
      const input = {
        projectId,
        projectName: readString(body.projectName) ?? undefined,
        websiteUrl: readString(body.websiteUrl) ?? undefined,
        organizationNumber: readString(body.organizationNumber) ?? undefined,
        companyName: readString(body.companyName) ?? undefined,
        extraContext: readString(body.extraContext) ?? undefined,
      };
      const forceRefresh = body.forceRefresh === true;
      // Cached forutsetninger — hopper over fetch når en fersk cached
      // versjon finnes. Når brukeren faktisk vil ha ferskt (forceRefresh),
      // bypass cachen og overskriv etter ny fetch.
      const startedAt = Date.now();
      const cacheHits: ResearchCacheKey[] = [];

      let brreg = forceRefresh ? null : await readResearchCache<Awaited<ReturnType<typeof fetchBrregCompany>>>(projectId, "brreg");
      if (brreg) {
        cacheHits.push("brreg");
      } else {
        brreg = await fetchBrregCompany(input);
        await writeResearchCache(projectId, "brreg", brreg);
      }

      let websiteInsights = forceRefresh ? null : await readResearchCache<Awaited<ReturnType<typeof fetchWebsiteInsights>>>(projectId, "website");
      if (websiteInsights) {
        cacheHits.push("website");
      } else {
        websiteInsights = await fetchWebsiteInsights(input.websiteUrl ?? null, input, brreg);
        await writeResearchCache(projectId, "website", websiteInsights);
      }

      let businessSignals = forceRefresh ? null : await readResearchCache<Awaited<ReturnType<typeof fetchGooglePlacesBusinessSignals>>>(projectId, "business_signals");
      if (businessSignals) {
        cacheHits.push("business_signals");
      } else {
        businessSignals = await fetchGooglePlacesBusinessSignals(input, websiteInsights);
        await writeResearchCache(projectId, "business_signals", businessSignals);
      }

      let payload: Record<string, unknown> = {};
      if (section === "competitors") {
        payload = {
          competitorAnalysis: await fetchGooglePlacesCompetitorAnalysis(input, websiteInsights, businessSignals, brreg),
        };
      } else if (section === "local") {
        payload = {
          localPresencePlan: await fetchGooglePlacesLocalPresencePlan(input, websiteInsights, businessSignals, brreg),
        };
      } else if (section === "merch") {
        payload = {
          merchSuppliers: await fetchMerchSuppliersAnalysis(input, websiteInsights, businessSignals, brreg),
        };
      } else if (section === "social") {
        // socialProfileCandidates are produced inside fetchWebsiteInsights —
        // a refresh is just re-running that. We return only the candidates.
        payload = { socialProfileCandidates: websiteInsights.socialProfileCandidates };
      } else if (section === "business") {
        payload = { businessSignals };
      } else if (section === "brand_palette") {
        // colors are extracted from logo URL outside the fetcher pipeline.
        // Frontend handles the merging into planningDraft.brandGuide.colors.
        payload = { brandColors: await extractBrandColorsFromLogo(websiteInsights.probableLogoUrl ?? null) };
      }

      return res.json({
        success: true,
        section,
        refreshedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        cacheHits,
        data: payload,
      });
    } catch (error) {
      console.error("[role-room-agent] section refresh failed", { section, error });
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Aggregert pending-approvals-API: lister alle posts som venter på review
  // på tvers av brukerens prosjekter. Brukes av en fremtidig "Approvals"-
  // dashboard-widget.
  app.get("/api/role-room/agent/feed-plan/approvals/pending", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    try {
      const result = await pool.query<{
        project_id: string;
        platform: string;
        posts: Array<Record<string, unknown>>;
        updated_at: Date;
      }>(
        `SELECT project_id, platform, posts, updated_at
           FROM role_room_feed_plans
          WHERE updated_by = $1 OR updated_by IS NULL
          ORDER BY updated_at DESC
          LIMIT 50`,
        [session.email ?? session.userId],
      );

      const pending: Array<{
        projectId: string;
        platform: string;
        postId: string;
        title: string;
        caption: string;
        scheduledFor: string | null;
        approvalState: string;
        approvalChangedAt: string | null;
      }> = [];

      for (const plan of result.rows) {
        for (const post of plan.posts ?? []) {
          const state = String(post.approvalState ?? 'draft');
          if (state === 'draft' || state === 'needs_changes') {
            pending.push({
              projectId: plan.project_id,
              platform: plan.platform,
              postId: String(post.id ?? ''),
              title: String(post.title ?? ''),
              caption: String(post.caption ?? '').slice(0, 200),
              scheduledFor: typeof post.scheduledFor === 'string' ? post.scheduledFor : null,
              approvalState: state,
              approvalChangedAt:
                typeof post.approvalChangedAt === 'string' ? post.approvalChangedAt : null,
            });
          }
        }
      }

      return res.json({ success: true, pending, totalPending: pending.length });
    } catch (error) {
      console.error('[approval-pending] query failed', error);
      return res.status(500).json({ success: false, error: "Kunne ikke hente pending-approvals." });
    }
  });
}
