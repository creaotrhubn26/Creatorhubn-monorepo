/**
 * lead-map-research-routes.ts
 *
 * Research → Leads-orkestrator. Brukeren starter en research-økt fra
 * iPad (industri + region + segment); backend kjører hele fasen og
 * leadene dukker opp på kartet når flowen er ferdig.
 *
 * Hele modulen er gated på den nye RBAC-permission'en `lead_research.run`
 * (default: admin + salgssjef + teamleder). Organisasjonen kan skru av
 * for hele rollen, eller per bruker via user_permission_overrides.
 *
 * Endepunkter (alle under /api/admin-room/lead-map/research/):
 *   POST   /start          { industry, region, target_audience?, goal? }
 *                          → { research_id, scan_id }
 *                          Oppretter market_scans-rad m/ auto_create_leads=true,
 *                          phase='pending', target_org_id satt av caller's
 *                          aktive org.
 *
 *   POST   /:id/run         Kjør Brand Kit → Market Scan → Google Places
 *                          → opprette crm_customers. Fire-and-forget;
 *                          klienten poller /:id for status. Skadefri ved
 *                          dobbel-kjøring (phase-sjekk).
 *
 *   GET    /:id             Status + progress. iPad poller hver 2-3s.
 *
 *   GET    /                Liste mine siste research-økter (siste 10).
 *
 * Faseflyt (intern):
 *   pending → brand_kit → claude_scan → geocode_competitors
 *           → creating_leads → done | failed
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { createMarketScan, runMarketScan, getMarketScan, getScanCompetitors } from "./market-intelligence/market-scan-service.js";
import { searchPlaces } from "./lead-map-service.js";
import { runScoutForLead } from "./lead-scout-service.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

interface ResearchStartInput {
  industry: string;
  region: string;
  target_audience?: string;
  goal?: string;
  organization_id?: string;     // hvilken org skal leadene scopes til
}

function validateStartInput(body: unknown): ResearchStartInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" };
  const b = body as Record<string, unknown>;
  if (typeof b.industry !== "string" || b.industry.trim().length < 2) {
    return { error: "industry påkrevd" };
  }
  if (typeof b.region !== "string" || b.region.trim().length < 2) {
    return { error: "region påkrevd" };
  }
  return {
    industry: b.industry.trim().slice(0, 120),
    region: b.region.trim().slice(0, 120),
    target_audience: typeof b.target_audience === "string"
      ? b.target_audience.slice(0, 240) : undefined,
    goal: typeof b.goal === "string" ? b.goal.slice(0, 240) : undefined,
    organization_id: typeof b.organization_id === "string"
      ? b.organization_id : undefined,
  };
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

async function loadScanProgress(
  pool: Pool, scanId: string,
): Promise<{
  id: string;
  name: string;
  phase: string;
  phase_message: string | null;
  status: string;
  total_competitors: number;
  leads_created_count: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
} | null> {
  const r = await pool.query<{
    id: string;
    name: string;
    phase: string;
    phase_message: string | null;
    status: string;
    total_competitors: number;
    leads_created_count: number;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
  }>(
    `SELECT id::text, name, phase, phase_message, status,
            total_competitors, leads_created_count,
            started_at::text, completed_at::text, error_message
       FROM market_scans WHERE id = $1::uuid`,
    [scanId],
  );
  return r.rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────
// Geocode + lead-opprettelse
// ─────────────────────────────────────────────────────────────────

interface CompetitorForGeocode {
  id: string;
  name: string;
  domain: string | null;
}

interface CreatedLead {
  customerId: string;
  competitorId: string;
  name: string;
  place_id: string | null;
  latitude: number | null;
  longitude: number | null;
}

async function geocodeAndCreateLeads(
  pool: Pool,
  scanId: string,
  ownerUserId: string,
  region: string,
  competitors: CompetitorForGeocode[],
): Promise<CreatedLead[]> {
  const created: CreatedLead[] = [];
  let processed = 0;

  for (const comp of competitors) {
    processed++;
    await setPhase(
      pool, scanId, "geocode_competitors",
      `Geokoder ${processed} av ${competitors.length}: ${comp.name}`,
    );

    // 1. Slå opp i Google Places — navn + region som tekst-query
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
      // Tystefall — vi oppretter leaden uten geo hvis Places mislykkes
    }

    // 2. Dedupliser: hvis google_place_id allerede finnes for denne
    //    eieren, skip — eller alternativt link.
    if (placeId) {
      const dup = await pool.query<{ id: string }>(
        `SELECT id::text FROM crm_customers
          WHERE owner_user_id = $1 AND google_place_id = $2
          LIMIT 1`,
        [ownerUserId, placeId],
      );
      if (dup.rows.length > 0) continue;
    }

    // 3. Insert som ny lead m/ lead_status='unvisited'
    try {
      const insertRes = await pool.query<{ id: string }>(
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
      const customerId = insertRes.rows[0].id;
      created.push({
        customerId, competitorId: comp.id, name: comp.name,
        place_id: placeId, latitude: lat, longitude: lng,
      });
    } catch (err) {
      console.warn("[lead-research] lead insert failed", comp.name, err);
    }
  }

  return created;
}

// ─────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────

async function runResearchOrchestrator(
  pool: Pool, scanId: string,
): Promise<void> {
  const scan = await getMarketScan(pool, scanId);
  if (!scan) return;

  try {
    // 1. Brand Kit valgfri — vi har ikke automatisk org-website her,
    //    så vi hopper over for nå og lar Market Scan jobbe basert på
    //    industry + region. (Brand Kit kan kobles på senere som
    //    ekstra steg når org-profil har website.)
    await setPhase(pool, scanId, "claude_scan",
      "Leadgrid lytter til markedet …");

    // 2. Market Scan — Claude finner konkurrenter
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

    // 3. Geocode + opprette leads (kun hvis auto_create_leads = true)
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
        [scanId, created.length],
      );
      await setPhase(pool, scanId, "creating_leads",
        `Plottet ${created.length} pins på gridden`);

      // 4. Scout-fase — KOMPLETT ISOLERT fra research-flyten:
      //    - Bare hvis caller har 'marketing.scout.run' i target-orgen
      //    - Hvis permission-sjekken kaster: skip stille
      //    - Hvis hele scout-løkken kaster: skip stille
      //    - Hvis enkelt-scout kaster: fortsett med neste lead
      // Research markeres ALDRI som 'failed' pga scout-feil. Lead-
      // opprettelse er hovedflowen og skal alltid lykkes uavhengig.
      try {
        const targetOrgId = scanRow.rows[0].target_org_id;
        let canScout = false;
        if (targetOrgId) {
          try {
            const { permissions } = await resolveEffectivePermissions(
              pool, targetOrgId, scanRow.rows[0].workspace_owner_user_id,
            );
            canScout = permissions.has("marketing.scout.run");
          } catch {
            canScout = false; // permission-feil → hopp over scout
          }
        }

        if (canScout && created.length > 0) {
          await setPhase(pool, scanId, "scout_leads",
            `Tråler ${created.length} sites etter mangler …`);

          let scoutedOk = 0;
          for (let i = 0; i < created.length; i++) {
            const lead = created[i];
            await setPhase(pool, scanId, "scout_leads",
              `Tråler pin ${i + 1} av ${created.length}: ${lead.name}`);

            // Hent website-URL — kan være null hvis Google Places ikke fant
            const leadRow = await pool.query<{ website_url: string | null }>(
              `SELECT website_url FROM crm_customers
                WHERE id::text = $1 LIMIT 1`,
              [lead.customerId],
            );
            const url = leadRow.rows[0]?.website_url;
            if (!url) continue;

            try {
              await runScoutForLead(pool, {
                customerId: lead.customerId,
                leadName: lead.name,
                websiteUrl: url,
                industry: scan.industry ?? null,
                triggeredBy: scanRow.rows[0].workspace_owner_user_id,
              });
              scoutedOk++;
            } catch {
              // Per-lead-feil avbryter ikke; finnes i
              // crm_customer_scout_runs som status='failed'.
            }
          }

          try {
            await pool.query(
              `UPDATE market_scans SET leads_scouted_count = $2
                WHERE id = $1::uuid`,
              [scanId, scoutedOk],
            );
          } catch { /* tystefall */ }
        }
      } catch (err) {
        // Hele scout-fasen feilet — research fortsetter likevel
        console.warn("[research] scout-fase feilet stille:", String(err).slice(0, 200));
      }
    }

    // 5. Ferdig
    await setPhase(pool, scanId, "done", undefined);
  } catch (err) {
    await setPhase(pool, scanId, "failed", String(err).slice(0, 500));
  }
}

// ─────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────

export function registerLeadMapResearchRoutes({
  app, pool, activeSessions,
}: Deps): void {
  const ROOT = "/api/admin-room/lead-map/research";

  // ─── POST /start ───────────────────────────────────────────────
  app.post(
    `${ROOT}/start`,
    requireLeadMapPermission("lead_research.run", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = activeSessions.get(
        (req.headers.authorization ?? "").replace("Bearer ", ""),
      );
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

      const validated = validateStartInput(req.body);
      if ("error" in validated) return res.status(400).json({ error: validated.error });

      try {
        const scan = await createMarketScan(pool, {
          workspaceOwnerUserId: session.userId,
          projectId: null,
          brandKitId: null,
          name: `${validated.industry} i ${validated.region}`,
          marketQuery: `Bedrifter i bransjen "${validated.industry}" lokalisert i ${validated.region}` +
            (validated.target_audience ? ` som retter seg mot ${validated.target_audience}` : ""),
          region: validated.region,
          industry: validated.industry,
          targetAudience: validated.target_audience ?? null,
          goal: validated.goal ??
            "Identifisér konkurrenter / aktører i markedet for å opprette leads i Lead Map",
        });

        // Sett research-orkestrator-flagg + target org
        await pool.query(
          `UPDATE market_scans
              SET auto_create_leads = true,
                  target_org_id = $2,
                  phase = 'pending'
            WHERE id = $1::uuid`,
          [scan.id, validated.organization_id ?? null],
        );

        return res.status(201).json({
          research_id: scan.id,
          scan_id: scan.id,
          name: scan.name,
        });
      } catch (err) {
        return res.status(500).json({ error: "start_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /:id/run ─────────────────────────────────────────────
  // Fire-and-forget; ResearchProgressView poller /:id.
  app.post(
    `${ROOT}/:id/run`,
    requireLeadMapPermission("lead_research.run", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const scanId = req.params.id;
      try {
        const progress = await loadScanProgress(pool, scanId);
        if (!progress) return res.status(404).json({ error: "not_found" });
        if (progress.phase === "claude_scan"
            || progress.phase === "geocode_competitors"
            || progress.phase === "creating_leads") {
          return res.json({ ok: true, already_running: true, phase: progress.phase });
        }
        if (progress.phase === "done") {
          return res.json({ ok: true, already_done: true });
        }
        // Fire-and-forget
        void runResearchOrchestrator(pool, scanId).catch((err) => {
          console.error("[research] orchestrator failed", err);
        });
        return res.json({ ok: true, started: true });
      } catch (err) {
        return res.status(500).json({ error: "run_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /:id ──────────────────────────────────────────────────
  app.get(
    `${ROOT}/:id`,
    requireLeadMapPermission("lead_research.run", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      try {
        const progress = await loadScanProgress(pool, req.params.id);
        if (!progress) return res.status(404).json({ error: "not_found" });
        return res.json({ research: progress });
      } catch (err) {
        return res.status(500).json({ error: "status_failed", detail: String(err) });
      }
    },
  );

  // ─── GET / (liste mine siste) ──────────────────────────────────
  app.get(
    ROOT,
    requireLeadMapPermission("lead_research.run", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = activeSessions.get(
        (req.headers.authorization ?? "").replace("Bearer ", ""),
      );
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query(
          `SELECT id::text, name, phase, phase_message, status,
                  total_competitors, leads_created_count,
                  started_at::text, completed_at::text,
                  created_at::text, region, industry
             FROM market_scans
            WHERE workspace_owner_user_id = $1
              AND auto_create_leads = true
            ORDER BY created_at DESC LIMIT 20`,
          [session.userId],
        );
        return res.json({ runs: r.rows });
      } catch (err) {
        return res.status(500).json({ error: "list_failed", detail: String(err) });
      }
    },
  );
}
