/**
 * leadgrid-project-lead-discovery-routes.ts
 *
 * AI lead-discovery for et valgt prosjekt — Daniels Pakke 9 (Research-fanen).
 *
 *   "Finn leads for MedSide" → Claude leser prosjekt-kontekst (bransje,
 *   region, brand-kit-positionering) → Google Places Text Search →
 *   filtrer ut duplikater → batch-research via samme runUrlResearch som
 *   bulk-URL → "Vi fant 12 leads for MedSide!" + auto-zoom på kartet.
 *
 * Endpoints
 *   POST /api/leadgrid/projects/:projectId/discover-leads
 *     body: {
 *       count?: number (1-50, default 20),
 *       industry_filter?: string[] (industry_ids, optional),
 *       city?: string (optional override; ellers prosjekt-context),
 *       industry_query?: string (optional override; ellers prosjekt-context),
 *       radius_km?: number (1-100, default 25 — kun brukt v/ geo-center),
 *       geo?: { lat: number, lng: number, radius_km: number }
 *     }
 *     respons: {
 *       batch_id, project_id, project_name, found_count,
 *       discovery_query, estimated_completion_seconds
 *     }
 *
 *   GET /api/leadgrid/projects/:projectId/discover-leads/:batchId/result
 *     respons: {
 *       batch, items, summary, project: { id, name },
 *       breakdown: { exact, geocoded, approximate, unknown, failed,
 *                    by_industry: [...], by_city: [...] }
 *     }
 *
 * Hvorfor egen fil
 *   - Holder lead-discovery-flow’en synlig (Daniel finner den ved navn).
 *   - Bruker SAMME `leadgrid_url_research_batches` + `_items`-tabeller
 *     som bulk-URL — bare med kategori 'lead_discovery' i metadata-feltet
 *     (research_result.discovery_meta).
 *   - Bruker SAMME processUrlResearchBatch-pipeline (Brreg → website →
 *     Places → Claude → resolveLocation). Ingen ny research-pipeline.
 *
 * Auth + RBAC
 *   - requireLeadMapPermission('lead_research.run') — samme key som
 *     "Finn nye leads"-menyen + LeadResearchStartView i iPad-appen.
 *
 * Hva som er gjenbrukt
 *   - searchPlaces() fra lead-map-service.ts (Places v1 Text Search)
 *   - processUrlResearchBatch() fra leadgrid-url-batch-processor.ts
 *   - readBatchProgress() fra samme processor (poll-endepunkt deler logikk)
 *   - Eksisterende leadgrid_url_research_batches / _items DB-skjema
 *     (mig 0351) — vi setter bare batch.category = 'lead_discovery'.
 *
 * Dedupe-strategi
 *   - Vi sjekker crm_customers.google_place_id mot brukerens
 *     eksisterende leads FØR vi oppretter drafts.
 *   - Dette unngår at samme bedrift dukker opp i 5 forskjellige
 *     discovery-batches.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";

import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { searchPlaces } from "./lead-map-service.js";
import {
  processUrlResearchBatch,
  readBatchProgress,
} from "./leadgrid-url-batch-processor.js";
import { autoAssignIndustryFromDiscoveryQuery } from "./leadgrid-industry-classify.js";

// =====================================================================
// Types
// =====================================================================

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

interface DiscoverBody {
  count?: number;
  industry_filter?: string[];
  city?: string;
  industry_query?: string;
  radius_km?: number;
  geo?: { lat?: number; lng?: number; radius_km?: number };
}

interface ProjectContext {
  id: string;
  name: string;
  ownerUserId: string;
  organizationId: string | null;
  // Beriket fra brand_kits + siste market_scan
  industryHint: string | null;
  cityHint: string | null;
  positioningSummary: string | null;
  websiteUrl: string | null;
}

// =====================================================================
// Session-helpers (matches leadgrid-url-research-routes.ts)
// =====================================================================

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  const cookieSid = (
    req as Request & {
      session?: { userId?: string; email?: string; role?: string };
    }
  ).session;
  if (cookieSid?.userId) {
    return {
      userId: cookieSid.userId,
      email: cookieSid.email,
      role: cookieSid.role,
    };
  }
  return null;
}

async function resolveOrgId(
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text FROM organization_members
      WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

// =====================================================================
// Prosjekt-kontekst — bygger query-strengen for Google Places
// =====================================================================

async function loadProjectContext(
  pool: Pool,
  projectId: string,
  userId: string,
): Promise<ProjectContext | null> {
  const pr = await pool.query<{
    id: string;
    name: string;
    organization_id: string | null;
  }>(
    `SELECT id::text, name, NULL::text AS organization_id
       FROM casting_projects WHERE id = $1 LIMIT 1`,
    [projectId],
  );
  if (pr.rows.length === 0) return null;
  const project = pr.rows[0];

  // Brand-kit gir oss positioning + valgfri industry-hint
  const bk = await pool.query<{
    source_url: string | null;
    brand_profile: Record<string, unknown> | null;
  }>(
    `SELECT source_url, brand_profile
       FROM brand_kits
      WHERE project_id = $1
      LIMIT 1`,
    [projectId],
  );
  const bp = (bk.rows[0]?.brand_profile ?? {}) as Record<string, unknown>;

  // Siste market_scan gir oss bransje + region som brukeren har snakket om
  const ms = await pool.query<{
    market_query: string | null;
    region: string | null;
    industry: string | null;
  }>(
    `SELECT market_query,
            COALESCE(region, NULL) AS region,
            COALESCE(industry, NULL) AS industry
       FROM market_scans
      WHERE project_id = $1
        AND workspace_owner_user_id = $2
      ORDER BY created_at DESC LIMIT 1`,
    [projectId, userId],
  );

  const industryHint =
    (typeof bp.industry === "string" ? (bp.industry as string) : null) ??
    ms.rows[0]?.industry ??
    null;
  const cityHint =
    (typeof bp.region === "string" ? (bp.region as string) : null) ??
    ms.rows[0]?.region ??
    null;

  return {
    id: project.id,
    name: project.name,
    ownerUserId: userId,
    organizationId: project.organization_id,
    industryHint,
    cityHint,
    positioningSummary:
      typeof bp.positioning_summary === "string"
        ? (bp.positioning_summary as string)
        : null,
    websiteUrl: bk.rows[0]?.source_url ?? null,
  };
}

// =====================================================================
// Bygg Places-query fra prosjekt-context + override
// =====================================================================

interface ResolvedDiscoveryQuery {
  query: string;
  industry: string;
  city: string;
}

function buildDiscoveryQuery(
  ctx: ProjectContext,
  body: DiscoverBody,
): ResolvedDiscoveryQuery | null {
  const industry =
    (body.industry_query && body.industry_query.trim()) ||
    ctx.industryHint ||
    "";
  const city = (body.city && body.city.trim()) || ctx.cityHint || "";
  if (!industry) {
    return null;
  }
  // Lag en naturlig Google-Places-tekst.
  // Eksempel: "tannlege i Bergen" eller "regnskapsbyrå i Norge"
  const query = city ? `${industry} i ${city}` : `${industry} i Norge`;
  return { query, industry, city };
}

// =====================================================================
// Dedup — finn place-IDer brukeren allerede har som lead
// =====================================================================

async function fetchExistingPlaceIds(
  pool: Pool,
  userId: string,
): Promise<Set<string>> {
  const r = await pool.query<{ google_place_id: string }>(
    `SELECT google_place_id FROM crm_customers
      WHERE owner_user_id = $1
        AND google_place_id IS NOT NULL`,
    [userId],
  );
  return new Set(r.rows.map((row) => row.google_place_id));
}

// =====================================================================
// Hovedflyt
// =====================================================================

export function registerLeadgridProjectLeadDiscoveryRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  const permRun = requireLeadMapPermission("lead_research.run", {
    pool,
    activeSessions,
  });

  // -------------------------------------------------------------------
  // POST /api/leadgrid/projects/:projectId/discover-leads
  // -------------------------------------------------------------------
  app.post(
    "/api/leadgrid/projects/:projectId/discover-leads",
    permRun,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const projectId = req.params.projectId;
      const body = (req.body ?? {}) as DiscoverBody;

      // Validér count i [1, 50]
      const requestedCount = Math.max(
        1,
        Math.min(typeof body.count === "number" ? body.count : 20, 50),
      );

      try {
        // 1. Hent prosjekt-kontekst (bransje/by + brand-kit).
        const ctx = await loadProjectContext(pool, projectId, session.userId);
        if (!ctx) {
          return res.status(404).json({ error: "project_not_found" });
        }

        // 2. Bygg discovery-query. Krever bransje (enten override eller hint).
        const resolved = buildDiscoveryQuery(ctx, body);
        if (!resolved) {
          return res.status(400).json({
            error: "industry_required",
            detail:
              "Mangler bransje. Sett `industry_query` i body eller knytt et " +
              "brand-kit / market-scan til prosjektet med bransje-info.",
          });
        }

        // 3. Spør Google Places. Geo-bias hvis brukeren sendte koordinater.
        const radiusM = (() => {
          const km = body.geo?.radius_km ?? body.radius_km ?? 25;
          return Math.max(1000, Math.min(km * 1000, 100_000));
        })();
        const places = await searchPlaces(pool, {
          ownerUserId: session.userId,
          query: resolved.query,
          latitude: body.geo?.lat,
          longitude: body.geo?.lng,
          radiusMeters: body.geo?.lat && body.geo?.lng ? radiusM : undefined,
        });
        if (!places.ok) {
          return res.status(502).json({
            error: "places_search_failed",
            detail: places.reason,
          });
        }

        // 4. Filtrer bort allerede-importerte (sikkerhetsnett — searchPlaces
        //    flagger dette, men ekstra dedupe mot owner_user_id på vår side).
        const existingPlaceIds = await fetchExistingPlaceIds(pool, session.userId);
        const candidates = places.results
          .filter((p) => !p.alreadyImported && !existingPlaceIds.has(p.placeId))
          // Topp N (count). Places returnerer max 20; trim ved behov.
          .slice(0, requestedCount);

        if (candidates.length === 0) {
          return res.status(200).json({
            batch_id: null,
            project_id: ctx.id,
            project_name: ctx.name,
            found_count: 0,
            discovery_query: resolved.query,
            estimated_completion_seconds: 0,
            message:
              "Ingen nye leads funnet — du har allerede importert alle " +
              `kandidater for "${resolved.query}".`,
          });
        }

        // 5. Opprett batch + drafts. Vi bruker samme tabeller som bulk-URL
        //    slik at processor + poll-endpoints kan gjenbrukes uendret.
        const orgId = await resolveOrgId(pool, session.userId);
        const batchId = crypto.randomUUID();

        // Fix 4 (live-test 2026-06-27): auto-assign industry_id basert på
        // discovery-query FØR research-pipelinen kjører. Daniel testet
        // "fotograf i Oslo" — leadene fikk industry_id=null fordi Brreg
        // ikke alltid kjenner bransjen + classify-er kjørte først etter
        // research. Nå har leads riktig bransje umiddelbart.
        const autoIndustry = await autoAssignIndustryFromDiscoveryQuery(pool, {
          discoveryQuery: resolved.query,
        }).catch(() => null);

        await pool.query(
          `INSERT INTO leadgrid_url_research_batches (
              id, organization_id, created_by, total_urls, status
            ) VALUES ($1::uuid, $2::uuid, $3, $4, 'pending')`,
          [batchId, orgId, session.userId, candidates.length],
        );

        // For hvert kandidat-sted: lag en draft-rad + item-rad.
        // - URL = websiteUrl hvis tilgjengelig, ellers en best-effort
        //   placeholder som processor-en kan tolke (vi prefiller draft
        //   med Google Places data så research starter "warm").
        for (let i = 0; i < candidates.length; i++) {
          const p = candidates[i];
          const placeholderUrl =
            p.websiteUrl ?? `https://maps.google.com/?cid=${p.placeId}`;

          // Pre-fyller draft med Places-data (lat/lng + place_id) slik at
          // selv om Brreg/website-skraping feiler, har vi et solid pin.
          // industry_id settes fra autoIndustry (Fix 4).
          const draftRes = await pool.query<{ id: string }>(
            `INSERT INTO crm_customers (
                id, name, status, source,
                owner_user_id, organization_id, project_id,
                website_url,
                latitude, longitude, location_confidence,
                google_place_id, google_rating,
                address, phone,
                lead_status, lead_source,
                draft_status,
                industry_id,
                import_source, import_batch_id,
                created_at, updated_at
              ) VALUES (
                gen_random_uuid(), $1, 'lead', 'lead_discovery',
                $2, $3::uuid, $4,
                $5,
                $6, $7, 'exact',
                $8, $9,
                $10, $11,
                'unvisited', 'lead_discovery',
                'draft',
                $12::uuid,
                'lead_discovery', $13::uuid,
                NOW(), NOW()
              ) RETURNING id::text`,
            [
              p.name,
              session.userId,
              orgId,
              projectId,
              placeholderUrl,
              p.latitude || null,
              p.longitude || null,
              p.placeId,
              p.rating,
              p.address,
              p.phone,
              autoIndustry?.industryId ?? null,
              batchId,
            ],
          );
          const draftId = draftRes.rows[0].id;

          await pool.query(
            `INSERT INTO leadgrid_url_research_items (
                batch_id, url, order_index, draft_lead_id, status
              ) VALUES ($1::uuid, $2, $3, $4::uuid, 'pending')`,
            [batchId, placeholderUrl, i, draftId],
          );
        }

        // 6. Lagre discovery-meta så GET /result kan vise hvilken query
        //    som ble brukt, og hvilken kategori batchen er.
        //    Vi bruker samme batches-tabell — lagrer som JSON i ny kolonne
        //    hvis den finnes, ellers stille no-op (tabellen ble seedet
        //    uten metadata-kolonne i mig 0351).
        try {
          await pool.query(
            `UPDATE leadgrid_url_research_batches
                SET category = 'lead_discovery',
                    discovery_meta = $2::jsonb
              WHERE id = $1::uuid`,
            [
              batchId,
              JSON.stringify({
                project_id: ctx.id,
                project_name: ctx.name,
                discovery_query: resolved.query,
                industry: resolved.industry,
                city: resolved.city,
                requested_count: requestedCount,
                geo: body.geo ?? null,
                auto_assigned_industry: autoIndustry
                  ? {
                      industry_id: autoIndustry.industryId,
                      source: autoIndustry.source,
                      matched_code: autoIndustry.matchedCode,
                      matched_name: autoIndustry.matchedName,
                    }
                  : null,
              }),
            ],
          );
        } catch {
          // Kolonnene `category` + `discovery_meta` kan mangle i eldre
          // miljøer som ikke har kjørt mig 0352. Det er greit — batchen
          // fungerer uten dem; UI får tilbake det vi sender i /start-responsen.
        }

        // 7. Trigger processor i bakgrunnen — ikke await.
        //    Processor kjører samme runUrlResearch som bulk-URL, som
        //    beriker drafts med Brreg + website + Claude synthesis.
        setImmediate(() => {
          processUrlResearchBatch(pool, batchId).catch((err) => {
            console.error(
              "[leadgrid-project-lead-discovery] batch processor failed",
              batchId,
              err,
            );
          });
        });

        // 8. ETA — gjennomsnitt ~20s per kandidat ved 3 parallelle.
        const concurrency = 3;
        const etaSeconds = Math.max(
          15,
          Math.ceil((candidates.length / concurrency) * 22),
        );

        return res.json({
          batch_id: batchId,
          project_id: ctx.id,
          project_name: ctx.name,
          found_count: candidates.length,
          discovery_query: resolved.query,
          estimated_completion_seconds: etaSeconds,
        });
      } catch (err) {
        console.error(
          "[leadgrid-project-lead-discovery] discover failed",
          err,
        );
        return res.status(500).json({
          error: "discover_failed",
          detail: (err as Error).message,
        });
      }
    },
  );

  // -------------------------------------------------------------------
  // GET /api/leadgrid/projects/:projectId/discover-leads/:batchId/result
  // -------------------------------------------------------------------
  app.get(
    "/api/leadgrid/projects/:projectId/discover-leads/:batchId/result",
    permRun,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const projectId = req.params.projectId;
      const batchId = req.params.batchId;
      try {
        const own = await pool.query<{ created_by: string }>(
          `SELECT created_by::text FROM leadgrid_url_research_batches
            WHERE id = $1::uuid`,
          [batchId],
        );
        if (!own.rows[0]) {
          return res.status(404).json({ error: "batch_not_found" });
        }
        if (own.rows[0].created_by !== session.userId) {
          return res.status(403).json({ error: "forbidden" });
        }
        const progress = await readBatchProgress(pool, batchId);
        if (!progress) {
          return res.status(404).json({ error: "batch_not_found" });
        }

        // Hent items + light research_result for breakdown
        const itemsRes = await pool.query<{
          id: string;
          url: string;
          order_index: number;
          status: string;
          draft_lead_id: string | null;
          has_pin: boolean;
          location_confidence: string | null;
          error_message: string | null;
        }>(
          `SELECT id::text, url, order_index, status,
                  draft_lead_id::text, has_pin, location_confidence, error_message
             FROM leadgrid_url_research_items
            WHERE batch_id = $1::uuid
            ORDER BY order_index ASC`,
          [batchId],
        );

        // Lead-info for committed/researched drafts — name + city
        const leadIds = itemsRes.rows
          .map((i) => i.draft_lead_id)
          .filter((x): x is string => !!x);
        let leadInfoById = new Map<
          string,
          { name: string | null; city: string | null; industry_id: string | null }
        >();
        if (leadIds.length > 0) {
          const li = await pool.query<{
            id: string;
            name: string | null;
            city: string | null;
            industry_id: string | null;
          }>(
            `SELECT id::text, name, city, industry_id::text
               FROM crm_customers
              WHERE id = ANY($1::uuid[])`,
            [leadIds],
          );
          leadInfoById = new Map(li.rows.map((r) => [r.id, r]));
        }

        // Breakdown
        let exact = 0,
          geocoded = 0,
          approximate = 0,
          unknown = 0,
          failed = 0;
        const byCityMap = new Map<string, number>();
        const byIndustryMap = new Map<string, number>();
        for (const item of itemsRes.rows) {
          if (item.status === "failed" || item.status === "skipped") {
            failed++;
            continue;
          }
          if (item.has_pin) {
            switch (item.location_confidence) {
              case "exact":
                exact++;
                break;
              case "geocoded":
                geocoded++;
                break;
              case "approximate":
                approximate++;
                break;
              default:
                unknown++;
            }
          } else {
            unknown++;
          }
          if (item.draft_lead_id) {
            const li = leadInfoById.get(item.draft_lead_id);
            if (li?.city) byCityMap.set(li.city, (byCityMap.get(li.city) ?? 0) + 1);
            if (li?.industry_id) {
              byIndustryMap.set(
                li.industry_id,
                (byIndustryMap.get(li.industry_id) ?? 0) + 1,
              );
            }
          }
        }

        // Discovery-meta (hvis kolonnen finnes)
        let discoveryMeta: Record<string, unknown> | null = null;
        let projectName: string | null = null;
        try {
          const mr = await pool.query<{
            discovery_meta: Record<string, unknown> | null;
          }>(
            `SELECT discovery_meta
               FROM leadgrid_url_research_batches
              WHERE id = $1::uuid`,
            [batchId],
          );
          discoveryMeta = mr.rows[0]?.discovery_meta ?? null;
          if (discoveryMeta && typeof discoveryMeta.project_name === "string") {
            projectName = discoveryMeta.project_name;
          }
        } catch {
          // discovery_meta-kolonne mangler — hopp.
        }
        if (!projectName) {
          const pn = await pool.query<{ name: string }>(
            `SELECT name FROM casting_projects WHERE id = $1 LIMIT 1`,
            [projectId],
          );
          projectName = pn.rows[0]?.name ?? null;
        }

        return res.json({
          batch: {
            id: progress.batchId,
            status: progress.status,
            total_urls: progress.total,
            completed_urls: progress.completed,
            failed_urls: progress.failed,
            pinned_leads: progress.pinned,
            started_at: progress.startedAt,
            finished_at: progress.finishedAt,
          },
          project: { id: projectId, name: projectName },
          discovery_meta: discoveryMeta,
          items: itemsRes.rows,
          summary: {
            total: progress.total,
            completed: progress.completed,
            failed: progress.failed,
            pinned: progress.pinned,
            pending: progress.total - progress.completed - progress.failed,
          },
          breakdown: {
            exact,
            geocoded,
            approximate,
            unknown,
            failed,
            by_industry: Array.from(byIndustryMap.entries()).map(
              ([industry_id, count]) => ({ industry_id, count }),
            ),
            by_city: Array.from(byCityMap.entries()).map(([city, count]) => ({
              city,
              count,
            })),
          },
        });
      } catch (err) {
        return res.status(500).json({
          error: "result_failed",
          detail: (err as Error).message,
        });
      }
    },
  );
}

// =====================================================================
// Tester
// =====================================================================

export const __test = {
  buildDiscoveryQuery,
  fetchExistingPlaceIds,
  loadProjectContext,
};
