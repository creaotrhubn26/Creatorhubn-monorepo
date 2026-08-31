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
 *   - Vi sjekker crm_customers.google_place_id mot prosjektet og den
 *     stabile organisasjonen FØR vi oppretter drafts.
 *   - Dette unngår at samme bedrift dukker opp i 5 forskjellige
 *     discovery-batches.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";

import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { searchPlaces } from "./lead-map-service.js";
import { runBrandScan } from "./brand-kit-service.js";
import {
  processUrlResearchBatch,
  readBatchProgress,
} from "./leadgrid-url-batch-processor.js";
import { autoAssignIndustryFromDiscoveryQuery } from "./leadgrid-industry-classify.js";
import { fetchExistingDiscoveryPlaceIds } from "./leadgrid-discovery-dedup.js";
import { lookupCompanyForNewLead } from "./lead-brreg-service.js";
import { cpvForTekst } from "./leadgrid-cpv-routes.js";
import Anthropic from "@anthropic-ai/sdk";
import { withAIQuota } from "./leadgrid-ai-queue.js";

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
  /**
   * Daniel-fiks 2026-06-28: når satt, scanner vi nettsiden FØR discovery
   * (auto-brand-scan) så vi kjenner kundens ICP. Brukes når brand_kit
   * ennå ikke finnes for prosjektet.
   */
  website_url?: string;
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
  // Daniel-fiks 2026-06-28: ICP-felt fra brand-scan (target_audience-setning).
  // Brukes til å utlede søkbar Places-query når industry er en generisk
  // SaaS-kategori (b2b_saas / ecommerce / etc.) — discovery skal lete
  // etter KUNDENE deres, ikke andre i samme bransje.
  targetAudienceHint: string | null;
  brandDescriptionHint: string | null;
  // Tag/kategori-felt fra `brand_profile.industry` — vanligvis grov
  // (`b2b_saas`, `restaurant`); brukes som siste fallback.
  industryCategoryRaw: string | null;
  // 2026-08-19: selgerorgens EGEN bransje (Brreg NACE), uavhengig av
  // nettside-skann. Brukes til å grunngi Claude-ICP-utledningen når
  // brand-scan-tekst mangler/er svak — se buildDiscoveryQuery.
  sellerNaceDescription: string | null;
  sellerNaceCode: string | null;
}

interface LeadgridProjectRef {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  organization_id: string | null;
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
      WHERE user_id = $1
      ORDER BY
        CASE role
          WHEN 'admin' THEN 1
          WHEN 'salgssjef' THEN 2
          ELSE 3
        END,
        joined_at ASC
      LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

// =====================================================================
// Prosjekt-kontekst — bygger query-strengen for Google Places
// =====================================================================

/**
 * Load a Leadgrid project only when the current user can access its tenant.
 *
 * `requireLeadMapPermission` protects the HTTP route, while this row-level
 * check keeps the data helper safe when it is reused outside that middleware.
 * Organization projects are shared with current members of that organization.
 * Legacy projects without an organization are scoped strictly to their creator;
 * mutable child rows must never grant project authority.
 */
async function loadAccessibleLeadgridProject(
  pool: Pool,
  projectId: string,
  userId: string,
): Promise<LeadgridProjectRef | null> {
  const result = await pool.query<LeadgridProjectRef>(
    `SELECT p.id::text, p.name, p.description, p.industry,
            p.organization_id::text
       FROM leadgrid_projects p
      WHERE p.id = $1
        AND (p.status IS NULL OR p.status NOT IN ('archived', 'deleted'))
        AND (p.project_type IS NULL OR p.project_type NOT IN (
          'feature_film', 'documentary', 'film', 'short_film',
          'tv_series', 'commercial', 'music_video', 'casting'
        ))
        AND (
          (
            p.organization_id IS NOT NULL
            AND EXISTS (
              SELECT 1
                FROM organization_members om
               WHERE om.organization_id = p.organization_id
                 AND om.user_id = $2
            )
          )
          OR (p.organization_id IS NULL AND p.created_by = $2)
        )
      LIMIT 1`,
    [projectId, userId],
  );
  return result.rows[0] ?? null;
}

interface LeadgridDiscoveryBatchRef {
  id: string;
  organization_id: string | null;
  discovery_meta: Record<string, unknown>;
}

/**
 * Bind a discovery result to its creator, organization and exact project.
 * The path project is never trusted on its own: RBAC resolves from that path,
 * so the persisted batch metadata must agree before any items are returned.
 */
async function loadAccessibleDiscoveryBatch(
  pool: Pool,
  batchId: string,
  projectId: string,
  userId: string,
  organizationId: string | null,
): Promise<LeadgridDiscoveryBatchRef | null> {
  const result = await pool.query<LeadgridDiscoveryBatchRef>(
    `SELECT b.id::text, b.organization_id::text, b.discovery_meta
       FROM leadgrid_url_research_batches b
      WHERE b.id = $1::uuid
        AND b.created_by::text = $3
        AND b.organization_id IS NOT DISTINCT FROM $4::uuid
        AND b.category = 'lead_discovery'
        AND b.discovery_meta->>'project_id' = $2
      LIMIT 1`,
    [batchId, projectId, userId, organizationId],
  );
  return result.rows[0] ?? null;
}

async function loadProjectContext(
  pool: Pool,
  projectId: string,
  userId: string,
): Promise<ProjectContext | null> {
  const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
  if (!project) return null;

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

  // Daniel-fiks 2026-06-28: les FLERE felt fra brand_profile. Tidligere
  // brukte vi bare `bp.industry` som var en grov kategori (`b2b_saas`,
  // `restaurant`) — Places-søket "b2b_saas i Norge" gir ingen
  // meningsfulle treff. Nå plukker vi opp `targetAudience` +
  // `description` så vi kan utlede en søkbar ICP-query
  // (`buildDiscoveryQueryFromICP` håndterer mappingen til Places-tekst).
  const targetAudienceHint =
    (typeof bp.targetAudience === "string"
      ? (bp.targetAudience as string)
      : null) ??
    (typeof bp.target_audience === "string"
      ? (bp.target_audience as string)
      : null);
  const brandDescriptionHint =
    (typeof bp.description === "string" ? (bp.description as string) : null) ??
    project.description;
  const industryCategoryRaw =
    typeof bp.industry === "string" ? (bp.industry as string) : null;

  // `industryHint` er rådata for fallback når ICP-mapping ikke gir noe;
  // bruk eksplisitt prosjektverdi før market_scan hvis brand_profile mangler.
  const industryHint =
    industryCategoryRaw ?? project.industry ?? ms.rows[0]?.industry ?? null;
  const cityHint =
    (typeof bp.region === "string" ? (bp.region as string) : null) ??
    ms.rows[0]?.region ??
    null;

  // 2026-08-19: selgerorgens egen NACE (Brreg). Bruk prosjektets faktiske
  // Leadgrid-organisasjon; bare legacy-prosjekter uten org faller tilbake til
  // den innloggede brukerens standardorganisasjon.
  // Lazy: skriver til DB når nace_code er NULL (aldri forsøkt) og
  // org_number finnes. `leadgrid-backfill-cron.ts` dekker eksisterende
  // orger i tillegg — begge skriver `nace_code = ''` (ikke NULL) når
  // Brreg-oppslaget ikke gir treff, så vi ikke prøver samme org på nytt
  // ved hvert discover-leads-kall.
  let sellerNaceDescription: string | null = null;
  let sellerNaceCode: string | null = null;
  try {
    const realOrgId =
      project.organization_id ?? (await resolveOrgId(pool, userId));
    if (realOrgId) {
      const orgR = await pool.query<{
        org_number: string | null;
        nace_code: string | null;
        nace_description: string | null;
      }>(
        `SELECT org_number, nace_code, nace_description
           FROM organizations WHERE id = $1 LIMIT 1`,
        [realOrgId],
      );
      const org = orgR.rows[0];
      if (org?.nace_code !== null && org?.nace_code !== undefined) {
        // Allerede forsøkt (uansett treff eller ikke) — ikke prøv på nytt.
        sellerNaceDescription = org.nace_description;
        sellerNaceCode = org.nace_code || null;
      } else if (org?.org_number) {
        const looked = await lookupCompanyForNewLead(org.org_number);
        if (looked.found && looked.company) {
          sellerNaceDescription = looked.company.naceDescription;
          sellerNaceCode = looked.company.naceCode;
          await pool.query(
            `UPDATE organizations SET nace_code = $1, nace_description = $2 WHERE id = $3`,
            [
              looked.company.naceCode,
              looked.company.naceDescription,
              realOrgId,
            ],
          );
        }
      }
    }
  } catch (err) {
    console.warn(
      "[discover-leads] seller-nace-oppslag feilet:",
      (err as Error).message,
    );
  }

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
    targetAudienceHint,
    brandDescriptionHint,
    industryCategoryRaw,
    sellerNaceDescription,
    sellerNaceCode,
  };
}

// =====================================================================
// ICP-mapping: utled søkbar Places-query fra brand-scan-data
// =====================================================================
// Brand-scan gir oss en grov industri-kategori (`b2b_saas`, `restaurant`,
// `ecommerce`) + en setning som beskriver målgruppen (`targetAudience` =
// "Norske leger og helsepersonell..."). Når discovery skal jakte på
// KUNDENE deres må vi finne et søkbart Places-begrep (`legekontor`).
//
// Heuristikk: regex-match mot kjente patterns. Brand-scan-orchestratoren
// kan i en senere PR populere `brand_profile.searchableICP` direkte fra
// Claude — denne mappingen er fallback for prosjekter scannet før det.

interface ICPRule {
  // Regex som matcher targetAudience/description (lowercase, no-NB)
  pattern: RegExp;
  // Søkbar Places-query (norsk, entall)
  placesQuery: string;
}

const ICP_RULES: ICPRule[] = [
  // Helse — leger, tannleger, helsesentre
  {
    pattern:
      /(?<![\p{L}])(leger|lege(r)?|helsepersonell|allmennlege)(?![\p{L}])/iu,
    placesQuery: "legekontor",
  },
  {
    pattern:
      /(?<![\p{L}])(tannlege(r)?|tannklinikk(er)?|tannhelse)(?![\p{L}])/iu,
    placesQuery: "tannklinikk",
  },
  {
    pattern: /(?<![\p{L}])(fysioterapeut(er)?|kiropraktor(er)?)(?![\p{L}])/iu,
    placesQuery: "fysioterapi",
  },
  {
    pattern:
      /(?<![\p{L}])(psykolog(er)?|terapeut(er)?|mental.helse)(?![\p{L}])/iu,
    placesQuery: "psykolog",
  },
  // Finans / regnskap / advokat
  {
    pattern:
      /(?<![\p{L}])(regnskapsbyr(å|aer)|regnskap|bokf(ø|oe)ring)(?![\p{L}])/iu,
    placesQuery: "regnskapsbyrå",
  },
  {
    pattern:
      /(?<![\p{L}])(advokat(er)?|jurist(er)?|advokatkontor)(?![\p{L}])/iu,
    placesQuery: "advokatkontor",
  },
  // Eiendom / bygg
  {
    pattern: /(?<![\p{L}])(eiendomsmegler(e)?|meglerhus)(?![\p{L}])/iu,
    placesQuery: "eiendomsmegler",
  },
  {
    pattern: /(?<![\p{L}])(arkitekt(er)?|byggmester)(?![\p{L}])/iu,
    placesQuery: "arkitekt",
  },
  // Kreative / kultur
  {
    pattern:
      /(?<![\p{L}])(fotograf(er)?|videoproduksjon|filmskaper)(?![\p{L}])/iu,
    placesQuery: "fotograf",
  },
  {
    pattern:
      /(?<![\p{L}])(byråer|reklamebyr(å|aer)|markedsf(ø|oer)ringsbyr)(?![\p{L}])/iu,
    placesQuery: "reklamebyrå",
  },
  // Mat / utelivet
  {
    pattern: /(?<![\p{L}])(restaurant(er)?|spisesteder|matsted)(?![\p{L}])/iu,
    placesQuery: "restaurant",
  },
  {
    pattern: /(?<![\p{L}])(kaf(e|é)(er)?|coffee.shop)(?![\p{L}])/iu,
    placesQuery: "kafé",
  },
  {
    pattern: /(?<![\p{L}])(frisør(er)?|salong(er)?)(?![\p{L}])/iu,
    placesQuery: "frisør",
  },
  {
    pattern: /(?<![\p{L}])(butikk(er)?|nettbutikk|retail)(?![\p{L}])/iu,
    placesQuery: "butikk",
  },
  // Utvidelse (uke 2, produktrevisjonen 2026-07-03): felt-salg-vertikaler —
  // inkludert Leadgrids EGEN ICP (solenergi/alarm/bemanning/telecom) som
  // manglet helt i lista over.
  {
    pattern:
      /(?<![\p{L}])(solenergi|solcell(er|epanel)?|solkraft)(?![\p{L}])/iu,
    placesQuery: "solcelleinstallatør",
  },
  {
    pattern:
      /(?<![\p{L}])(alarm(selskap|system)?|boligalarm|innbruddsalarm|vaktselskap|sikkerhetsselskap)(?![\p{L}])/iu,
    placesQuery: "alarmselskap",
  },
  {
    pattern:
      /(?<![\p{L}])(bemanning(sbyrå)?|rekruttering(sbyrå)?|vikarbyrå|headhunt)(?![\p{L}])/iu,
    placesQuery: "bemanningsbyrå",
  },
  {
    pattern:
      /(?<![\p{L}])(telekom|teleselskap|mobilabonnement|bredbånd|fiber(leverandør)?)(?![\p{L}])/iu,
    placesQuery: "teleselskap",
  },
  // Håndverk / bygg-fag
  {
    pattern:
      /(?<![\p{L}])(elektriker(e)?|elektroinstallat(ø|oe)r|elinstallasjon)(?![\p{L}])/iu,
    placesQuery: "elektriker",
  },
  {
    pattern: /(?<![\p{L}])(rørlegger(e)?|vvs)(?![\p{L}])/iu,
    placesQuery: "rørlegger",
  },
  {
    pattern:
      /(?<![\p{L}])(taktekk(er|ing)|takarbeid|blikkenslager)(?![\p{L}])/iu,
    placesQuery: "taktekker",
  },
  {
    pattern: /(?<![\p{L}])(maler(firma|mester)?|malingsarbeid)(?![\p{L}])/iu,
    placesQuery: "malerfirma",
  },
  {
    pattern: /(?<![\p{L}])(snekker(e)?|tømrer(e)?)(?![\p{L}])/iu,
    placesQuery: "snekker",
  },
  // Bil / transport / logistikk
  {
    pattern: /(?<![\p{L}])(bilverksted|bilservice|mekaniker(e)?)(?![\p{L}])/iu,
    placesQuery: "bilverksted",
  },
  {
    pattern:
      /(?<![\p{L}])(transport(selskap|firma)?|logistikk|spedisjon|budbil)(?![\p{L}])/iu,
    placesQuery: "transportselskap",
  },
  // Helse / velvære (utvidelse)
  {
    pattern:
      /(?<![\p{L}])(veterinær(er)?|dyreklinikk(er)?|dyrlege(r)?)(?![\p{L}])/iu,
    placesQuery: "veterinær",
  },
  {
    pattern: /(?<![\p{L}])(optiker(e)?|synsundersøkelse)(?![\p{L}])/iu,
    placesQuery: "optiker",
  },
  { pattern: /(?<![\p{L}])(apotek(er)?)(?![\p{L}])/iu, placesQuery: "apotek" },
  {
    pattern:
      /(?<![\p{L}])(hudpleie|kosmetolog(er)?|skjønnhetsklinikk)(?![\p{L}])/iu,
    placesQuery: "hudpleieklinikk",
  },
  {
    pattern: /(?<![\p{L}])(treningssenter|gym|treningsstudio)(?![\p{L}])/iu,
    placesQuery: "treningssenter",
  },
  // Tjenester / institusjoner
  {
    pattern: /(?<![\p{L}])(renhold(sbyrå)?|vaskehjelp|rengjøring)(?![\p{L}])/iu,
    placesQuery: "renholdsbyrå",
  },
  {
    pattern: /(?<![\p{L}])(catering|kantine(drift)?)(?![\p{L}])/iu,
    placesQuery: "catering",
  },
  {
    pattern:
      /(?<![\p{L}])(dagligvare(butikk(er)?)?|matbutikk(er)?|kolonial)(?![\p{L}])/iu,
    placesQuery: "dagligvarebutikk",
  },
  {
    pattern:
      /(?<![\p{L}])(idrettslag|fotballklubb(er)?|sportsklubb(er)?|idrettsforening)(?![\p{L}])/iu,
    placesQuery: "idrettslag",
  },
  {
    pattern: /(?<![\p{L}])(barnehage(r)?)(?![\p{L}])/iu,
    placesQuery: "barnehage",
  },
  {
    pattern: /(?<![\p{L}])(hotell(er)?|overnatting(ssted)?)(?![\p{L}])/iu,
    placesQuery: "hotell",
  },
  {
    pattern: /(?<![\p{L}])(forsikring(sselskap)?)(?![\p{L}])/iu,
    placesQuery: "forsikringsselskap",
  },
];

const GENERIC_INDUSTRY_CATEGORIES = new Set([
  "b2b_saas",
  "saas",
  "ecommerce",
  "e-commerce",
  "marketplace",
  "platform",
  "agency",
  "consulting",
  "software",
]);

/**
 * Utled søkbar Places-query fra brand-scan-data. Foretrekker
 * targetAudience-setning over generisk industri-kategori.
 *
 * Returnerer `null` hvis vi ikke kan utlede et meningsfullt søk.
 */
function deriveSearchableICP(ctx: ProjectContext): string | null {
  const sourceText = [
    ctx.targetAudienceHint,
    ctx.brandDescriptionHint,
    ctx.positioningSummary,
  ]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ");
  if (sourceText.length === 0) return null;
  for (const rule of ICP_RULES) {
    if (rule.pattern.test(sourceText)) {
      return rule.placesQuery;
    }
  }
  return null;
}

// =====================================================================
// Claude-fallback for ICP (uke 2, produktrevisjonen 2026-07-03)
// =====================================================================
// Regex-lista over dekker de vanligste vertikalene, men bransjer utenfor
// lista ga tidligere NULL treff («discovery-fragility»). Når regex bommer
// og prosjektet HAR brand-scan-tekst, ber vi Claude (haiku) utlede ÉN
// Places-søkbar term. Resultatet caches i minnet per kilde-tekst så
// gjentatte discovery-kall ikke koster nye AI-kall.

let cachedAnthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic | null {
  if (cachedAnthropicClient) return cachedAnthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedAnthropicClient = new Anthropic({ apiKey });
  return cachedAnthropicClient;
}

const icpClaudeCache = new Map<string, string | null>();
const ICP_CLAUDE_CACHE_MAX = 500;

async function deriveICPWithClaude(
  sourceText: string,
  quotaKey: string,
): Promise<string | null> {
  const client = getAnthropicClient();
  if (!client) return null;
  const cacheKey = crypto.createHash("sha256").update(sourceText).digest("hex");
  if (icpClaudeCache.has(cacheKey)) return icpClaudeCache.get(cacheKey) ?? null;

  let result: string | null = null;
  try {
    const model =
      process.env.ROLE_ROOM_AGENT_HAIKU_MODEL || "claude-haiku-4-5-20251001";
    const resp = await withAIQuota("claude", quotaKey, async () =>
      client.messages.create({
        model,
        max_tokens: 24,
        system:
          "Du får informasjon om en bedrift: enten en beskrivelse av hvem " +
          "den selger til (målgruppe/ICP), og/eller bedriftens EGEN bransje " +
          "(NACE-klassifisering fra Brreg). Hvis kun egen bransje er oppgitt, " +
          "utled hvem som mest sannsynlig er bedriftens kunder. " +
          "Svar med ÉN kort norsk søketerm (1-3 ord) som kan brukes i Google " +
          "Places for å finne slike bedrifter, f.eks. «legekontor», " +
          "«solcelleinstallatør», «bilverksted». Svar KUN med termen. " +
          "Hvis teksten ikke gir nok grunnlag for et søkbart bedriftskunde-begrep: svar «UKJENT».",
        messages: [{ role: "user", content: sourceText.slice(0, 1500) }],
      }),
    );
    const raw = resp.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim()
      .replace(/^["«]|["»]$/g, "")
      .split("\n")[0]
      .trim();
    if (
      raw &&
      raw.length >= 3 &&
      raw.length <= 40 &&
      !/ukjent/i.test(raw) &&
      /^[\p{L}\p{N} \-æøåÆØÅ]+$/u.test(raw)
    ) {
      result = raw.toLowerCase();
    }
    // 2026-08-19: cache KUN når Claude faktisk svarte (treff eller ekte
    // «UKJENT») — ikke ved exception (timeout/5xx/rate-limit/manglende
    // API-nøkkel). Ellers cacher en forbigående Claude-feil seg selv som
    // permanent "ingen ICP" for denne teksten helt til 500-entry-cachen
    // tømmes, og neste bruker med samme prosjekt-tekst får 400 selv om
    // Claude er oppe igjen sekunder senere.
    if (icpClaudeCache.size >= ICP_CLAUDE_CACHE_MAX) icpClaudeCache.clear();
    icpClaudeCache.set(cacheKey, result);
  } catch (err) {
    console.warn(
      "[discover-leads] Claude ICP-fallback feilet:",
      (err as Error).message,
    );
  }
  return result;
}

// =====================================================================
// Bygg Places-query fra prosjekt-context + override
// =====================================================================

// 2026-08-19: NACE-divisjoner der selgerens EGEN bransje ikke gir noe
// meningsfullt signal om HVEM som kjøper (kunden er "enhver bedrift" —
// kontorrekvisita, generell engroshandel, renhold, transport...). Grovt,
// ikke uttømmende — treffer kun når vi IKKE har annen kontekst (brand-scan/
// target-audience) å basere ICP på. Unngår å kaste bort et AI-kall på en
// gjetning som uansett blir for vag/feil.
const BROAD_NACE_DIVISIONS = new Set([
  "46", // Engroshandel, unntatt med motorvogner
  "47", // Detaljhandel — kunde er sluttbruker, ikke en søkbar B2B-vertikal
  "49", // Landtransport
  "81", // Tjenester tilknyttet eiendomsdrift (renhold, vaktmester)
  "82", // Kontorstøttetjenester og annen forretningsmessig tjenesteyting
]);

function isNaceTooBroadForICP(naceCode: string | null): boolean {
  if (!naceCode) return false;
  const division = naceCode.split(".")[0]?.trim();
  return division ? BROAD_NACE_DIVISIONS.has(division) : false;
}

interface ResolvedDiscoveryQuery {
  query: string;
  industry: string;
  city: string;
}

function hasValidDiscoveryGeo(
  geo: DiscoverBody["geo"],
): geo is { lat: number; lng: number; radius_km?: number } {
  return (
    typeof geo?.lat === "number" &&
    Number.isFinite(geo.lat) &&
    geo.lat >= -90 &&
    geo.lat <= 90 &&
    typeof geo.lng === "number" &&
    Number.isFinite(geo.lng) &&
    geo.lng >= -180 &&
    geo.lng <= 180
  );
}

async function buildDiscoveryQuery(
  ctx: ProjectContext,
  body: DiscoverBody,
  quotaKey = "leadgrid-icp",
): Promise<ResolvedDiscoveryQuery | null> {
  // Prioritet (Daniel-fiks 2026-06-28 + Claude-fallback uke 2):
  // 1. Eksplisitt override fra request body
  // 2. Utledet søkbar ICP fra brand-scan-data (targetAudience etc.)
  // 3. industryHint hvis det ikke er en generisk kategori
  //    (`b2b_saas`/`saas`/`ecommerce` etc. — disse er ikke søkbare i Places)
  // 4. Claude (haiku) utleder term fra brand-scan-teksten når regex bommer
  const bodyIndustry = body.industry_query?.trim();
  const derivedICP = deriveSearchableICP(ctx);
  const fallbackIndustry =
    ctx.industryHint &&
    !GENERIC_INDUSTRY_CATEGORIES.has(ctx.industryHint.toLowerCase())
      ? ctx.industryHint
      : null;

  let industry = bodyIndustry || derivedICP || fallbackIndustry || "";
  if (!industry) {
    // 2026-08-19: grunngi Claude-utledningen med selgerorgens EGEN Brreg-
    // NACE i tillegg til nettside-skann-teksten — prosjekter uten
    // brand-kit/website-scan kan nå likevel få en reell ICP-forslag basert
    // kun på org.nace_description. Unntak: hvis NACE er ALT vi har OG
    // bransjen er for bred (se BROAD_NACE_DIVISIONS) — da gjetter vi ikke,
    // vi faller gjennom til industry_required slik at brukeren skriver inn
    // query selv (f.eks. "IT-bedrifter i Oslo" for en kontorrekvisita-selger).
    const otherHints = [
      ctx.targetAudienceHint,
      ctx.brandDescriptionHint,
      ctx.positioningSummary,
    ].filter((v): v is string => typeof v === "string" && v.length > 0);
    const naceOnly = otherHints.length === 0 && !!ctx.sellerNaceDescription;
    const skipNaceGuess = naceOnly && isNaceTooBroadForICP(ctx.sellerNaceCode);
    if (!skipNaceGuess) {
      const sourceText = [
        ...otherHints,
        ctx.sellerNaceDescription
          ? `Bedriftens egen bransje (NACE): ${ctx.sellerNaceDescription}`
          : null,
      ]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .join(" ");
      if (sourceText.length > 0) {
        industry = (await deriveICPWithClaude(sourceText, quotaKey)) ?? "";
      }
    }
  }

  const hasGeo = hasValidDiscoveryGeo(body.geo);
  const explicitCity = body.city?.trim() ?? "";
  const city = explicitCity || (hasGeo ? "" : ctx.cityHint || "");
  if (!industry) {
    return null;
  }
  // Lag en naturlig Google-Places-tekst.
  // Med geo-bias lar vi koordinatene styre området og unngår en motstridende
  // prosjekt-by / nasjonal tekstfilter i Places-queryen.
  const query = city
    ? `${industry} i ${city}`
    : hasGeo
      ? industry
      : `${industry} i Norge`;
  return { query, industry, city };
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
        let ctx = await loadProjectContext(pool, projectId, session.userId);
        if (!ctx) {
          return res.status(404).json({ error: "project_not_found" });
        }

        // 1b. AUTO-BRAND-SCAN (Daniel-fiks 2026-06-28): hvis brand_kit
        // mangler ICP-data + bruker har sendt en URL i body → scann
        // nettsiden FØRST så vi vet hvem prosjektet selger til. Discovery
        // skal aldri gjette industri blindt — feil ICP gir feil leads
        // (f.eks. tannklinikker når MedSide faktisk selger til leger).
        const needsAutoScan =
          !ctx.targetAudienceHint && !ctx.industryHint && !body.industry_query;
        const scanUrl = body.website_url?.trim() || ctx.websiteUrl;
        if (needsAutoScan && scanUrl) {
          try {
            await runBrandScan(pool, {
              projectId: ctx.id,
              workspaceOwnerUserId: session.userId,
              url: scanUrl,
            });
            // Last context på nytt — brand_profile er nå populert.
            ctx =
              (await loadProjectContext(pool, projectId, session.userId)) ??
              ctx;
          } catch (scanErr) {
            console.warn(
              "[discover-leads] auto-brand-scan failed",
              scanUrl,
              scanErr,
            );
            // Fortsett — buildDiscoveryQuery vil returnere 400 hvis
            // vi fortsatt ikke har en industry-hint.
          }
        }

        // 2. Bygg discovery-query. Krever bransje (enten override eller hint);
        //    Claude-fallback utleder term fra brand-scan-tekst når regex bommer.
        const resolved = await buildDiscoveryQuery(ctx, body, session.userId);
        if (!resolved) {
          // 2026-08-19: for brede B2B-selgere (engros/detalj/renhold/
          // transport — se BROAD_NACE_DIVISIONS) finnes ingen søkbar
          // Places-kundetype. Foreslå anbud/CPV-veien i stedet når
          // selgerens NACE-tekst gir treff i CPV_KART.
          const suggestAnbudCpv = ctx.sellerNaceDescription
            ? cpvForTekst(ctx.sellerNaceDescription)
            : [];
          return res.status(400).json({
            error: "industry_required",
            detail:
              "Mangler bransje. Sett `industry_query` i body eller knytt et " +
              "brand-kit / market-scan til prosjektet med bransje-info. " +
              "Du kan også sende `website_url` så scanner vi nettsiden først.",
            ...(suggestAnbudCpv.length > 0
              ? {
                  suggest_anbud_cpv: suggestAnbudCpv,
                  suggest_anbud_reason:
                    "Din bransje har ingen søkbar kundetype for kart-søk — " +
                    "prøv i stedet Anbud-fanen med disse CPV-kodene.",
                }
              : {}),
          });
        }

        // 3. Spør Google Places. Geo-bias hvis brukeren sendte koordinater.
        const discoveryGeo = hasValidDiscoveryGeo(body.geo)
          ? body.geo
          : null;
        const radiusM = (() => {
          const requestedKm = body.geo?.radius_km ?? body.radius_km ?? 25;
          const km =
            typeof requestedKm === "number" && Number.isFinite(requestedKm)
              ? requestedKm
              : 25;
          return Math.max(1000, Math.min(km * 1000, 100_000));
        })();
        const places = await searchPlaces(pool, {
          ownerUserId: session.userId,
          query: resolved.query,
          latitude: discoveryGeo?.lat,
          longitude: discoveryGeo?.lng,
          radiusMeters: discoveryGeo ? radiusM : undefined,
        });
        if (!places.ok) {
          return res.status(502).json({
            error: "places_search_failed",
            detail: places.reason,
          });
        }

        // 4. Filtrer bort allerede-importerte i samme organisasjon+prosjekt.
        //    Organisasjonen er stabil selv om owner_user_id ble remappet ved
        //    migrering. SearchPlaces sitt owner-flagg kan være feil på tvers
        //    av prosjekter, så denne scope-kontrollen er autoritativ.
        const orgId =
          ctx.organizationId ?? (await resolveOrgId(pool, session.userId));
        const existingPlaceIds = await fetchExistingDiscoveryPlaceIds(pool, {
          ownerUserId: session.userId,
          organizationId: orgId,
          projectId,
        });
        const candidates = places.results
          .filter((p) => !existingPlaceIds.has(p.placeId))
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
        const batchId = crypto.randomUUID();

        // Fix 4 (live-test 2026-06-27): auto-assign industry_id basert på
        // discovery-query FØR research-pipelinen kjører. Daniel testet
        // "fotograf i Oslo" — leadene fikk industry_id=null fordi Brreg
        // ikke alltid kjenner bransjen + classify-er kjørte først etter
        // research. Nå har leads riktig bransje umiddelbart.
        const autoIndustry = await autoAssignIndustryFromDiscoveryQuery(pool, {
          discoveryQuery: resolved.query,
        }).catch(() => null);

        const discoveryMeta = {
          project_id: ctx.id,
          project_name: ctx.name,
          discovery_query: resolved.query,
          industry: resolved.industry,
          city: resolved.city,
          requested_count: requestedCount,
          geo: discoveryGeo,
          auto_assigned_industry: autoIndustry
            ? {
                industry_id: autoIndustry.industryId,
                source: autoIndustry.source,
                matched_code: autoIndustry.matchedCode,
                matched_name: autoIndustry.matchedName,
              }
            : null,
        };

        // Batch, drafts og items er én atomisk enhet. Da kan verken en
        // constraint-feil eller en kandidatfeil etterlate en foreldreløs
        // pending-batch som aldri kan fullføres.
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `INSERT INTO leadgrid_url_research_batches (
                id, organization_id, created_by, total_urls, status,
                category, discovery_meta
              ) VALUES (
                $1::uuid, $2::uuid, $3, $4, 'pending',
                'lead_discovery', $5::jsonb
              )`,
            [
              batchId,
              orgId,
              session.userId,
              candidates.length,
              JSON.stringify(discoveryMeta),
            ],
          );

          // For hvert kandidat-sted: lag en draft-rad + item-rad.
          for (let i = 0; i < candidates.length; i++) {
            const p = candidates[i];
            const placeholderUrl =
              p.websiteUrl ?? `https://maps.google.com/?cid=${p.placeId}`;

            const draftRes = await client.query<{ id: string }>(
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
                p.latitude ?? null,
                p.longitude ?? null,
                p.placeId,
                p.rating,
                p.address,
                p.phone,
                autoIndustry?.industryId ?? null,
                batchId,
              ],
            );
            const draftId = draftRes.rows[0].id;

            await client.query(
              `INSERT INTO leadgrid_url_research_items (
                  batch_id, url, order_index, draft_lead_id, status
                ) VALUES ($1::uuid, $2, $3, $4::uuid, 'pending')`,
              [batchId, placeholderUrl, i, draftId],
            );
          }
          await client.query("COMMIT");
        } catch (transactionError) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw transactionError;
        } finally {
          client.release();
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
        console.error("[leadgrid-project-lead-discovery] discover failed", err);
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
        const project = await loadAccessibleLeadgridProject(
          pool,
          projectId,
          session.userId,
        );
        if (!project) {
          return res.status(404).json({ error: "project_not_found" });
        }

        const organizationId =
          project.organization_id ?? (await resolveOrgId(pool, session.userId));
        const batch = await loadAccessibleDiscoveryBatch(
          pool,
          batchId,
          projectId,
          session.userId,
          organizationId,
        );
        if (!batch) {
          return res.status(404).json({ error: "batch_not_found" });
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
          {
            name: string | null;
            city: string | null;
            industry_id: string | null;
          }
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
            if (li?.city)
              byCityMap.set(li.city, (byCityMap.get(li.city) ?? 0) + 1);
            if (li?.industry_id) {
              byIndustryMap.set(
                li.industry_id,
                (byIndustryMap.get(li.industry_id) ?? 0) + 1,
              );
            }
          }
        }

        const discoveryMeta = batch.discovery_meta;
        const projectName = project.name;

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
  fetchExistingPlaceIds: fetchExistingDiscoveryPlaceIds,
  hasValidDiscoveryGeo,
  loadAccessibleDiscoveryBatch,
  loadAccessibleLeadgridProject,
  loadProjectContext,
};
