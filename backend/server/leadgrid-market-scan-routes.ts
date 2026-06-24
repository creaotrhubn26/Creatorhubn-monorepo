/**
 * leadgrid-market-scan-routes.ts
 *
 * Native Leadgrid Market Scan for markedssjef — Claude discovery +
 * Brønnøysund + Google Places auto-oppretter leads som pins på
 * Leadgrid-kartet.
 *
 * Dette er den markedsfokuserte inngangen til samme orkestratoren som
 * lead-map-research-routes.ts (research → leads-flyt). Vi gjenbruker
 * `runResearchOrchestrator()` implisitt via `runMarketScan()` + samme
 * auto-create-leads-flag og target_org_id-scope.
 *
 * Mount: /api/leadgrid/market-scan/*
 *
 * RBAC: leadgrid.market_scan.run — default tildelt markedssjef +
 * markedskoordinator + salgssjef + teamleder (se migrate 312).
 *
 * Endepunkter:
 *   POST   /api/leadgrid/market-scan/run
 *          body: { name?, industry, region, target_audience?, goal?,
 *                  auto_create_leads?, organization_id? }
 *          → { scan_id, name }
 *          Oppretter market_scans-rad m/ auto_create_leads=true (default),
 *          target_org_id, og kicker orkestratoren fire-and-forget.
 *
 *   GET    /api/leadgrid/market-scan/:id
 *          → { scan } — status + progress for polling.
 *
 *   GET    /api/leadgrid/market-scan/:id/competitors
 *          → { competitors } — bedriftene funnet i scanen
 *            (m/ lat/lng/google_rating fra Places-berikkelse).
 *
 *   GET    /api/leadgrid/market-scan/:id/opportunities
 *          → { opportunities } — Claude-generete kampanje-muligheter.
 *
 *   GET    /api/leadgrid/market-scan/:id/leads
 *          → { leads } — crm_customers opprettet AV denne scanen
 *            (lead_source='lead_research' + linket til scan via geo-flow).
 *
 *   GET    /api/leadgrid/market-scan
 *          → { scans } — alle Market Scan-økter for innlogget bruker
 *            (auto_create_leads=true), sortert nyest først.
 *
 *   POST   /api/leadgrid/market-scan/:id/create-leads
 *          → { created_count } — manuell trigger hvis scan ble kjørt
 *            uten auto_create_leads. Idempotent — hopper over duplicates
 *            via google_place_id-sjekk.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  createMarketScan,
  getMarketScan,
  runMarketScan,
  getScanCompetitors,
  getScanOpportunities,
} from "./market-intelligence/market-scan-service.js";
import { searchPlaces } from "./lead-map-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

// ─────────────────────────────────────────────────────────────────
// Input-validering
// ─────────────────────────────────────────────────────────────────

interface RunScanInput {
  name?: string;
  industry: string;
  region: string;
  target_audience?: string;
  goal?: string;
  auto_create_leads: boolean;
  organization_id?: string;
}

function validateRunInput(body: unknown): RunScanInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" };
  const b = body as Record<string, unknown>;
  if (typeof b.industry !== "string" || b.industry.trim().length < 2) {
    return { error: "industry må være satt (min 2 tegn)" };
  }
  if (typeof b.region !== "string" || b.region.trim().length < 2) {
    return { error: "region må være satt (min 2 tegn)" };
  }
  return {
    name: typeof b.name === "string" && b.name.trim().length > 0
      ? b.name.trim().slice(0, 200) : undefined,
    industry: b.industry.trim().slice(0, 120),
    region: b.region.trim().slice(0, 120),
    target_audience: typeof b.target_audience === "string"
      ? b.target_audience.slice(0, 240) : undefined,
    goal: typeof b.goal === "string" ? b.goal.slice(0, 240) : undefined,
    // Default ON — markedssjef vil typisk ha pins på kartet
    auto_create_leads: b.auto_create_leads === false ? false : true,
    organization_id: typeof b.organization_id === "string"
      ? b.organization_id : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

async function setPhase(
  pool: Pool, scanId: string, phase: string, message?: string,
): Promise<void> {
  await pool.query(
    `UPDATE market_scans
        SET phase = $2, phase_message = $3
      WHERE id = $1::uuid`,
    [scanId, phase, message ?? null],
  );
}

interface ScanProgressRow {
  id: string;
  name: string;
  phase: string;
  phase_message: string | null;
  status: string;
  total_competitors: number;
  total_opportunities: number;
  leads_created_count: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  region: string | null;
  industry: string | null;
  target_audience: string | null;
  goal: string | null;
  auto_create_leads: boolean;
  target_org_id: string | null;
  created_at: string;
}

async function loadScanProgress(
  pool: Pool, scanId: string,
): Promise<ScanProgressRow | null> {
  const r = await pool.query<ScanProgressRow>(
    `SELECT id::text, name, phase, phase_message, status,
            total_competitors, total_opportunities, leads_created_count,
            started_at::text, completed_at::text, error_message,
            region, industry, target_audience, goal,
            auto_create_leads, target_org_id::text, created_at::text
       FROM market_scans WHERE id = $1::uuid`,
    [scanId],
  );
  return r.rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────
// Geocode + lead-opprettelse (gjenbruker mønsteret fra
// lead-map-research-routes.ts geocodeAndCreateLeads — vi vil ikke
// dupliserer logikken i en delt service for nå da det er en intern
// implementasjons-detalj som kan flyttes senere).
// ─────────────────────────────────────────────────────────────────

interface CompetitorForGeocode {
  id: string;
  name: string;
  domain: string | null;
}

async function geocodeAndCreateLeads(
  pool: Pool,
  scanId: string,
  ownerUserId: string,
  region: string,
  competitors: CompetitorForGeocode[],
): Promise<number> {
  let created = 0;
  let processed = 0;

  for (const comp of competitors) {
    processed++;
    await setPhase(
      pool, scanId, "geocode_competitors",
      `Geokoder ${processed} av ${competitors.length}: ${comp.name}`,
    );

    const query = `${comp.name} ${region}`;
    let placeId: string | null = null;
    let lat: number | null = null;
    let lng: number | null = null;
    let address: string | null = null;
    let phone: string | null = null;
    let website: string | null = comp.domain;

    try {
      const placesRes = await searchPlaces(pool, {
        ownerUserId, query,
      });
      if (placesRes.ok && placesRes.results.length > 0) {
        const first = placesRes.results[0];
        placeId = first.placeId;
        lat = first.latitude ?? null;
        lng = first.longitude ?? null;
        address = first.address ?? null;
        phone = first.phone ?? null;
        if (!website && first.websiteUrl) website = first.websiteUrl;
      }
    } catch {
      // Tystefall — fortsetter uten geo
    }

    // Idempotent dedup på google_place_id
    if (placeId) {
      const dup = await pool.query<{ id: string }>(
        `SELECT id::text FROM crm_customers
          WHERE owner_user_id = $1 AND google_place_id = $2
          LIMIT 1`,
        [ownerUserId, placeId],
      );
      if (dup.rows.length > 0) continue;
    }

    try {
      await pool.query(
        `INSERT INTO crm_customers (
           owner_user_id, name, address, website_url, phone,
           latitude, longitude, google_place_id,
           lead_status, lead_source
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unvisited', 'lead_research')
         RETURNING id::text`,
        [
          ownerUserId, comp.name, address, website, phone,
          lat, lng, placeId,
        ],
      );
      created++;
    } catch (err) {
      console.warn("[leadgrid-market-scan] lead insert failed", comp.name, err);
    }
  }

  return created;
}

async function runOrchestrator(
  pool: Pool, scanId: string,
): Promise<void> {
  const scan = await getMarketScan(pool, scanId);
  if (!scan) return;

  try {
    await setPhase(pool, scanId, "claude_scan",
      "Leadgrid lytter til markedet …");

    // 1. Market Scan — Claude finner konkurrenter (+ deres bedrifts-info,
    //    teknikker, opportunities). competitor-place-enrichment.ts
    //    berikker dem m/ lat/lng best-effort etter completion.
    try {
      await runMarketScan(pool, scanId);
    } catch (err) {
      await setPhase(pool, scanId, "failed", `Market Scan feilet: ${String(err)}`);
      await pool.query(
        `UPDATE market_scans SET status='failed', error_message=$2
          WHERE id=$1::uuid`,
        [scanId, String(err).slice(0, 500)],
      );
      return;
    }

    // 2. Auto-opprette leads hvis flagget er satt
    const scanRow = await pool.query<{
      auto_create_leads: boolean;
      target_org_id: string | null;
      region: string | null;
      workspace_owner_user_id: string;
    }>(
      `SELECT auto_create_leads, target_org_id::text, region,
              workspace_owner_user_id
         FROM market_scans WHERE id = $1::uuid`,
      [scanId],
    );

    if (scanRow.rows[0]?.auto_create_leads) {
      const competitors = await getScanCompetitors(pool, scanId);
      const eligible: CompetitorForGeocode[] = competitors.map((c) => ({
        id: c.id,
        name: c.name,
        domain: c.domain,
      }));

      await setPhase(pool, scanId, "geocode_competitors",
        `Setter koordinater for ${eligible.length} pins …`);

      const created = await geocodeAndCreateLeads(
        pool, scanId,
        scanRow.rows[0].workspace_owner_user_id,
        scanRow.rows[0].region ?? "",
        eligible,
      );

      await pool.query(
        `UPDATE market_scans SET leads_created_count = $2
          WHERE id = $1::uuid`,
        [scanId, created],
      );
      await setPhase(pool, scanId, "creating_leads",
        `Plottet ${created} pins på kartet`);
    }

    await setPhase(pool, scanId, "done", undefined);
  } catch (err) {
    await setPhase(pool, scanId, "failed", String(err).slice(0, 500));
  }
}

// ─────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────

export function registerLeadgridMarketScanRoutes({
  app, pool, activeSessions,
}: Deps): void {
  const ROOT = "/api/leadgrid/market-scan";

  // ─── POST /run ─────────────────────────────────────────────────
  // Oppretter scan + kicker orkestratoren (fire-and-forget).
  app.post(
    `${ROOT}/run`,
    requireLeadMapPermission("leadgrid.market_scan.run", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

      const validated = validateRunInput(req.body);
      if ("error" in validated) return res.status(400).json({ error: validated.error });

      try {
        const scanName = validated.name
          ?? `${validated.industry} i ${validated.region}`;
        const marketQuery = `Bedrifter i bransjen "${validated.industry}" lokalisert i ${validated.region}` +
          (validated.target_audience ? ` som retter seg mot ${validated.target_audience}` : "");

        const scan = await createMarketScan(pool, {
          workspaceOwnerUserId: session.userId,
          projectId: null,
          brandKitId: null,
          name: scanName,
          marketQuery,
          region: validated.region,
          industry: validated.industry,
          targetAudience: validated.target_audience ?? null,
          goal: validated.goal ??
            "Identifisér konkurrenter / aktører i markedet for Leadgrid-kartet",
        });

        // Sett auto-create-leads + target-org
        await pool.query(
          `UPDATE market_scans
              SET auto_create_leads = $2,
                  target_org_id = $3,
                  phase = 'pending'
            WHERE id = $1::uuid`,
          [scan.id, validated.auto_create_leads, validated.organization_id ?? null],
        );

        // Fire-and-forget — iPad poller GET /:id
        void runOrchestrator(pool, scan.id).catch((err) => {
          console.error("[leadgrid-market-scan] orchestrator failed", err);
        });

        return res.status(201).json({
          scan_id: scan.id,
          name: scan.name,
        });
      } catch (err) {
        console.error("[leadgrid-market-scan] start failed", err);
        return res.status(500).json({
          error: "start_failed",
          detail: String(err).slice(0, 300),
        });
      }
    },
  );

  // ─── GET /:id ──────────────────────────────────────────────────
  app.get(
    `${ROOT}/:id`,
    requireLeadMapPermission("leadgrid.market_scan.run", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      try {
        const progress = await loadScanProgress(pool, req.params.id);
        if (!progress) return res.status(404).json({ error: "not_found" });
        return res.json({ scan: progress });
      } catch (err) {
        return res.status(500).json({
          error: "status_failed",
          detail: String(err).slice(0, 300),
        });
      }
    },
  );

  // ─── GET /:id/competitors ──────────────────────────────────────
  app.get(
    `${ROOT}/:id/competitors`,
    requireLeadMapPermission("leadgrid.market_scan.run", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      try {
        const competitors = await getScanCompetitors(pool, req.params.id);
        // Berike med Places-data fra market_scan_competitors (lat/lng/rating)
        const r = await pool.query<{
          id: string;
          latitude: number | null;
          longitude: number | null;
          google_place_id: string | null;
          google_address: string | null;
          google_phone: string | null;
          google_rating: number | null;
        }>(
          `SELECT id::text, latitude, longitude, google_place_id,
                  google_address, google_phone, google_rating
             FROM market_scan_competitors
            WHERE market_scan_id = $1::uuid`,
          [req.params.id],
        );
        const placeById = new Map(r.rows.map((row) => [row.id, row]));
        const enriched = competitors.map((c) => {
          const p = placeById.get(c.id);
          return {
            ...c,
            latitude: p?.latitude != null ? Number(p.latitude) : null,
            longitude: p?.longitude != null ? Number(p.longitude) : null,
            googlePlaceId: p?.google_place_id ?? null,
            googleAddress: p?.google_address ?? null,
            googlePhone: p?.google_phone ?? null,
            googleRating: p?.google_rating != null ? Number(p.google_rating) : null,
          };
        });
        return res.json({ competitors: enriched });
      } catch (err) {
        return res.status(500).json({
          error: "fetch_failed",
          detail: String(err).slice(0, 300),
        });
      }
    },
  );

  // ─── GET /:id/opportunities ────────────────────────────────────
  app.get(
    `${ROOT}/:id/opportunities`,
    requireLeadMapPermission("leadgrid.market_scan.run", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      try {
        const opportunities = await getScanOpportunities(pool, req.params.id);
        return res.json({ opportunities });
      } catch (err) {
        return res.status(500).json({
          error: "fetch_failed",
          detail: String(err).slice(0, 300),
        });
      }
    },
  );

  // ─── GET /:id/leads ────────────────────────────────────────────
  // Returnerer crm_customers som ble opprettet av denne scanen.
  // Korrelasjon: matcher på google_place_id mot
  // market_scan_competitors.google_place_id (+ owner_user_id-scope).
  app.get(
    `${ROOT}/:id/leads`,
    requireLeadMapPermission("leadgrid.market_scan.run", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query<{
          id: string;
          name: string;
          phone: string | null;
          website_url: string | null;
          address: string | null;
          city: string | null;
          latitude: number | null;
          longitude: number | null;
          lead_status: string;
          ai_opportunity_score: number | null;
          google_place_id: string | null;
        }>(
          `SELECT c.id::text, c.name, c.phone, c.website_url, c.address, c.city,
                  c.latitude, c.longitude, c.lead_status,
                  c.ai_opportunity_score, c.google_place_id
             FROM crm_customers c
             JOIN market_scan_competitors mc
               ON mc.google_place_id = c.google_place_id
            WHERE mc.market_scan_id = $1::uuid
              AND c.owner_user_id = $2
              AND c.google_place_id IS NOT NULL
            ORDER BY c.ai_opportunity_score DESC NULLS LAST, c.name`,
          [req.params.id, session.userId],
        );
        const leads = r.rows.map((row) => ({
          id: row.id,
          name: row.name,
          phone: row.phone,
          website_url: row.website_url,
          address: row.address,
          city: row.city,
          latitude: row.latitude != null ? Number(row.latitude) : null,
          longitude: row.longitude != null ? Number(row.longitude) : null,
          lead_status: row.lead_status,
          ai_opportunity_score: row.ai_opportunity_score,
        }));
        return res.json({ leads });
      } catch (err) {
        return res.status(500).json({
          error: "fetch_failed",
          detail: String(err).slice(0, 300),
        });
      }
    },
  );

  // ─── GET / (liste mine siste scans) ────────────────────────────
  app.get(
    ROOT,
    requireLeadMapPermission("leadgrid.market_scan.run", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query(
          `SELECT id::text, name, phase, phase_message, status,
                  total_competitors, total_opportunities, leads_created_count,
                  started_at::text, completed_at::text, created_at::text,
                  region, industry, error_message
             FROM market_scans
            WHERE workspace_owner_user_id = $1
            ORDER BY created_at DESC LIMIT 30`,
          [session.userId],
        );
        return res.json({ scans: r.rows });
      } catch (err) {
        return res.status(500).json({
          error: "list_failed",
          detail: String(err).slice(0, 300),
        });
      }
    },
  );

  // ─── POST /:id/create-leads (manuell trigger) ──────────────────
  // Kjøres hvis scanen ble opprettet med auto_create_leads=false og
  // markedssjefen ombestemte seg.
  app.post(
    `${ROOT}/:id/create-leads`,
    requireLeadMapPermission("leadgrid.market_scan.run", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const scan = await loadScanProgress(pool, req.params.id);
        if (!scan) return res.status(404).json({ error: "not_found" });
        if (scan.status !== "completed") {
          return res.status(409).json({ error: "scan_not_completed" });
        }
        const competitors = await getScanCompetitors(pool, req.params.id);
        const created = await geocodeAndCreateLeads(
          pool, req.params.id,
          session.userId,
          scan.region ?? "",
          competitors.map((c) => ({
            id: c.id,
            name: c.name,
            domain: c.domain,
          })),
        );
        await pool.query(
          `UPDATE market_scans SET leads_created_count = leads_created_count + $2
            WHERE id = $1::uuid`,
          [req.params.id, created],
        );
        return res.json({ created_count: created });
      } catch (err) {
        return res.status(500).json({
          error: "create_leads_failed",
          detail: String(err).slice(0, 300),
        });
      }
    },
  );
}
