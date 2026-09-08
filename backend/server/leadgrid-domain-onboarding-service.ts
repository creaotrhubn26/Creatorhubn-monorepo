import { randomBytes, randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import {
  discoveryBriefSchema,
  type DiscoveryBrief,
} from "./leadgrid-discovery-contract.js";
import type { BrandProfile } from "./role-room-website-analyzer.js";
import { assertPublicUrl } from "./ssrf-guard.js";

export const PROJECT_ONBOARDING_TTL_MINUTES = 30;

export const LEADGRID_ONBOARDING_SKILLS = [
  {
    key: "leadgrid_find_duplicates",
    title: "Finn duplikater",
    state: "ready_after_first_approved_lead",
    requires_confirmation: false,
  },
  {
    key: "leadgrid_enrich_company",
    title: "Berik fra BRREG",
    state: "ready_after_first_approved_lead",
    requires_confirmation: true,
  },
  {
    key: "leadgrid_log_visit",
    title: "Logg kontakt",
    state: "ready_after_first_approved_lead",
    requires_confirmation: true,
  },
  {
    key: "leadgrid_sync_offline_actions",
    title: "Synkroniser offline",
    state: "ready",
    requires_confirmation: true,
  },
  {
    key: "leadgrid_plan_follow_up",
    title: "Planlegg oppfølging",
    state: "ready_after_first_approved_lead",
    requires_confirmation: true,
  },
  {
    key: "leadgrid_data_quality",
    title: "Sjekk datakvalitet",
    state: "ready",
    requires_confirmation: false,
  },
] as const;

export interface ProjectOnboardingProfilePlan {
  name: string;
  is_default: boolean;
  status: "active";
  brief: DiscoveryBrief;
  approval_mode: "manual";
  places_details_enabled: boolean;
  auto_discover_enabled: boolean;
  schedule_cron: string;
  schedule_timezone: string;
}

export interface ProjectOnboardingPlan {
  version: 1;
  website_url: string;
  website_domain: string;
  project_name: string;
  project_description: string;
  category: string;
  category_confidence: "high" | "medium" | "low";
  classification_reasons: string[];
  brand_profile: BrandProfile;
  recommended_profiles: ProjectOnboardingProfilePlan[];
  skills: typeof LEADGRID_ONBOARDING_SKILLS;
}

export type ProjectOnboardingProjectRole = "owner" | "member" | "viewer";
export type ProjectOnboardingTeamRole = "leader" | "member" | "none";

export interface ProjectOnboardingAccessSetup {
  organization:
    | { mode: "current" }
    | { mode: "existing"; organization_id: string }
    | { mode: "create"; name: string };
  administrator_email: string;
  team:
    | { mode: "none" }
    | { mode: "existing"; id: string }
    | { mode: "create"; name: string; color_hex: string };
  invitations: Array<{
    email: string;
    project_role: ProjectOnboardingProjectRole;
    team_role: ProjectOnboardingTeamRole;
  }>;
}

export interface ProjectOnboardingAccessResult {
  organization: { id: string; name: string; reused: boolean };
  team: { id: string; name: string; reused: boolean } | null;
  administrator: {
    email: string;
    status: "active" | "invited";
    organization_role: "admin";
    project_role: "owner";
    email_status: string;
  };
  invitations: Array<{
    id: string | null;
    email: string;
    status: "active" | "invited";
    project_role: ProjectOnboardingProjectRole;
    team_role: ProjectOnboardingTeamRole;
    email_status: string;
  }>;
  discovery_access_verified: boolean;
}

export interface StoredProjectOnboardingPreview {
  id: string;
  organization_id: string;
  created_by: string;
  plan: ProjectOnboardingPlan;
  expires_at: string;
}

export interface ProjectOnboardingResult {
  project: {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    status: string;
    hasBrandKit: boolean;
    leadCount: number;
    competitorCount: number;
  };
  profiles: Array<{
    id: string;
    name: string;
    is_default: boolean;
    version: number;
    brief: DiscoveryBrief;
    places_details_enabled: boolean;
    status: "active" | "paused";
  }>;
  skills: typeof LEADGRID_ONBOARDING_SKILLS;
  reused_project: boolean;
  replayed: boolean;
  access?: ProjectOnboardingAccessResult;
}

export interface ProjectOnboardingInvitationDispatch {
  id: string;
  token: string;
  email: string;
  projectName: string;
  projectRole: ProjectOnboardingProjectRole;
  organizationId: string;
  projectId: string;
}

export interface ProjectOnboardingServiceResult extends ProjectOnboardingResult {
  invitation_dispatches: ProjectOnboardingInvitationDispatch[];
}

type Queryable = Pick<PoolClient, "query">;

interface CategoryRule {
  category: string;
  tokens: string[];
  customerTypes: string[];
  idealCustomer: string;
  goal: string;
  exclusions: string[];
  minimumFitScore: number;
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "Tannhelse",
    tokens: [
      "dentum.no",
      "tannlege",
      "tannklinikk",
      "tannhelse",
      "dental",
      "odontolog",
    ],
    customerTypes: ["tannklinikk", "tannlege"],
    idealCustomer:
      "Aktiv tannklinikk eller tannlegesenter med lokal pasientbase og beslutningstaker som kan vurdere synlighet, pasienthenvendelser og vekst.",
    goal:
      "Finne og kvalifisere tannklinikker som kan få flere relevante pasienthenvendelser.",
    exclusions: ["tannteknisk laboratorium", "tannlegeutdanning"],
    minimumFitScore: 65,
  },
  {
    category: "Film, TV og casting",
    tokens: [
      "theroleroom.com",
      "the role room",
      "casting",
      "skuespiller",
      "selvtape",
      "filmproduksjon",
      "line producer",
    ],
    customerTypes: ["produksjonsselskap", "castingbyrå", "reklamebyrå"],
    idealCustomer:
      "Norsk produksjonsselskap, castingmiljø eller reklamebyrå som håndterer brief, casting, kontrakter og talentflyt i kommersielle eller redaksjonelle produksjoner.",
    goal:
      "Finne produksjonsmiljøer som kan effektivisere casting, dokumentasjon og samarbeid.",
    exclusions: ["kino", "filmklubb", "privat skuespiller"],
    minimumFitScore: 60,
  },
  {
    category: "Kreative tjenester",
    tokens: [
      "creatorhubn.com",
      "creatorhub norge",
      "fotograf",
      "videograf",
      "innholdsprodusent",
      "kreativt team",
      "creator platform",
    ],
    customerTypes: ["fotograf", "videoproduksjon", "produksjonsselskap"],
    idealCustomer:
      "Profesjonell fotograf, videoprodusent eller kreativt produksjonsteam som leverer kundeprosjekter og trenger en samlet arbeidsflyt for salg, produksjon og levering.",
    goal:
      "Finne kreative virksomheter som kan samle kunde-, prosjekt- og leveranseflyten i én plattform.",
    exclusions: ["hobbyklubb", "fotobutikk"],
    minimumFitScore: 60,
  },
  {
    category: "Servering",
    tokens: ["restaurant", "servering", "catering", "pizzeria", "bakeri", "kafe"],
    customerTypes: ["restaurant", "serveringssted", "catering"],
    idealCustomer: "Aktiv serveringsbedrift med lokal kundebase og kommersiell beslutningstaker.",
    goal: "Finne relevante serveringsbedrifter for kvalifisert B2B-oppfølging.",
    exclusions: ["matbutikk", "privat kjøkken"],
    minimumFitScore: 55,
  },
  {
    category: "Bygg og håndverk",
    tokens: ["bygg", "håndverk", "handverk", "elektriker", "rørlegger", "rorlegger", "entreprenør"],
    customerTypes: ["byggentreprenør", "håndverksbedrift"],
    idealCustomer: "Aktiv bygg- eller håndverksbedrift med dokumentert drift og tydelig lokalt marked.",
    goal: "Finne relevante bygg- og håndverksbedrifter for kvalifisert oppfølging.",
    exclusions: ["byggevarebutikk", "privatperson"],
    minimumFitScore: 55,
  },
  {
    category: "Eiendom",
    tokens: ["eiendom", "megler", "bolig", "property", "real estate"],
    customerTypes: ["eiendomsmegler", "eiendomsselskap"],
    idealCustomer: "Aktiv eiendomsvirksomhet med eget marked, portefølje eller oppdragsinngang.",
    goal: "Finne relevante eiendomsvirksomheter for kvalifisert B2B-oppfølging.",
    exclusions: ["borettslag", "privat utleier"],
    minimumFitScore: 60,
  },
  {
    category: "Økonomitjenester",
    tokens: ["regnskap", "revisjon", "økonomi", "accounting", "bookkeeping"],
    customerTypes: ["regnskapsbyrå", "revisjonsselskap"],
    idealCustomer: "Etablert regnskaps- eller revisjonsmiljø med bedriftskunder og tydelig beslutningstaker.",
    goal: "Finne økonomimiljøer som passer den analyserte løsningen.",
    exclusions: ["utdanning", "privatøkonomi"],
    minimumFitScore: 60,
  },
  {
    category: "Helse",
    tokens: ["helse", "klinikk", "lege", "fysioterapi", "kiropraktor", "medical"],
    customerTypes: ["helseklinikk", "legesenter"],
    idealCustomer: "Aktiv privat helsevirksomhet med lokal pasientbase og kommersiell beslutningstaker.",
    goal: "Finne relevante helsevirksomheter for kvalifisert oppfølging.",
    exclusions: ["sykehus", "offentlig etat"],
    minimumFitScore: 60,
  },
  {
    category: "Teknologi og SaaS",
    tokens: ["saas", "software", "programvare", "teknologi", "plattform", "platform"],
    customerTypes: ["programvareselskap", "teknologibedrift"],
    idealCustomer: "B2B-teknologibedrift med aktiv drift, tydelig marked og kommersiell beslutningstaker.",
    goal: "Finne relevante teknologi- og programvareselskaper for kvalifisert oppfølging.",
    exclusions: ["studentprosjekt", "hobbyprosjekt"],
    minimumFitScore: 60,
  },
];

function profileSourceConfig(placesDetailsEnabled: boolean) {
  return {
    brreg_open_data: { enabled: true },
    google_places: {
      enabled: placesDetailsEnabled,
      mode: "transient_details_only",
    },
  };
}

function normalizedSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nb-NO");
}

function safeText(value: string | null | undefined, maximum: number): string {
  return String(value ?? "").trim().slice(0, maximum);
}

function titleFromDomain(domain: string): string {
  const first = domain.split(".")[0] || "Nytt prosjekt";
  return first.charAt(0).toLocaleUpperCase("nb-NO") + first.slice(1);
}

function projectName(profile: BrandProfile, domain: string): string {
  const candidate = safeText(profile.businessName, 200)
    .split(/\s+(?:\||–|—)\s+/)[0]
    .trim();
  return candidate.length >= 2 ? candidate : titleFromDomain(domain);
}

function detectedCity(corpus: string): string {
  const cities = [
    "Oslo",
    "Bergen",
    "Trondheim",
    "Stavanger",
    "Tromsø",
    "Kristiansand",
    "Drammen",
    "Fredrikstad",
  ];
  return cities.find((city) => corpus.includes(normalizedSearchText(city))) ?? "Oslo";
}

function fallbackCategory(profile: BrandProfile): CategoryRule {
  const industry = safeText(profile.industry, 64);
  const audience = safeText(profile.targetAudience, 120);
  const query =
    industry && industry !== "other"
      ? industry.replaceAll("_", " ")
      : audience || "bedrift";
  return {
    category: industry && industry !== "other" ? industry.replaceAll("_", " ") : "Generell B2B",
    tokens: [],
    customerTypes: [query.slice(0, 120)],
    idealCustomer:
      audience || "Aktiv norsk virksomhet med tydelig behov og identifiserbar beslutningstaker.",
    goal: "Finne og kvalifisere relevante virksomheter basert på nettsidens tilbud og målgruppe.",
    exclusions: [],
    minimumFitScore: 50,
  };
}

export function normalizeProjectOnboardingWebsite(rawValue: string): {
  websiteUrl: string;
  websiteDomain: string;
} {
  const raw = String(rawValue ?? "").trim();
  if (!raw || raw.length > 2_048) throw new Error("invalid_website_url");
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const parsed = assertPublicUrl(candidate);
  if (parsed.username || parsed.password) throw new Error("invalid_website_url");
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    throw new Error("invalid_website_url");
  }
  const domain = parsed.hostname.replace(/^www\./i, "").toLocaleLowerCase("en-US");
  if (!domain.includes(".") || domain.length > 253) throw new Error("invalid_website_url");
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLocaleLowerCase("en-US").startsWith("utm_")) {
      parsed.searchParams.delete(key);
    }
  }
  if (parsed.pathname === "/" && !parsed.search) parsed.pathname = "";
  return { websiteUrl: parsed.toString().replace(/\/$/, ""), websiteDomain: domain };
}

export function buildProjectOnboardingPlan(
  websiteUrl: string,
  websiteDomain: string,
  profile: BrandProfile,
): ProjectOnboardingPlan {
  const corpus = normalizedSearchText(
    [
      websiteDomain,
      profile.businessName,
      profile.tagline,
      profile.description,
      profile.industry,
      profile.targetAudience,
      ...profile.usps,
      ...profile.productCategories,
    ].join(" "),
  );
  const matched = CATEGORY_RULES.map((rule) => ({
    rule,
    matches: rule.tokens.filter((token) => corpus.includes(normalizedSearchText(token))),
  }))
    .filter((entry) => entry.matches.length > 0)
    .sort((left, right) => right.matches.length - left.matches.length)[0];
  const rule = matched?.rule ?? fallbackCategory(profile);
  const city = detectedCity(corpus);
  const name = projectName(profile, websiteDomain);
  const brief = discoveryBriefSchema.parse({
    industry_queries: rule.customerTypes,
    exclusion_terms: rule.exclusions,
    city,
    geo: null,
    territory_code: null,
    municipality_numbers: [],
    municipality_names: [],
    target_count: 30,
    enrichment_count: 15,
    minimum_fit_score: rule.minimumFitScore,
    ideal_customer: rule.idealCustomer,
    goal: rule.goal,
    organization_forms: [],
    employee_count: null,
    organization_structure: "any",
    website_requirement: "any",
    website_quality: { minimum_score: null },
    commercial_signals: {
      registered_in_vat_register: null,
      registered_in_business_register: true,
    },
  });
  const reasons = matched
    ? matched.matches.slice(0, 4).map((token) => `Nettsiden omtaler «${token}».`)
    : ["Profilen er foreslått fra nettsidens bransje- og målgruppesignaler."];
  const confidence = matched
    ? matched.matches.length >= 2 || matched.matches.some((token) => token.endsWith(".com") || token.endsWith(".no"))
      ? "high"
      : "medium"
    : "low";

  return {
    version: 1,
    website_url: websiteUrl,
    website_domain: websiteDomain,
    project_name: name,
    project_description: safeText(profile.description || profile.tagline, 1_000),
    category: rule.category,
    category_confidence: confidence,
    classification_reasons: reasons,
    brand_profile: profile,
    recommended_profiles: [
      {
        name: `${rule.category} – ${city}`.slice(0, 120),
        is_default: true,
        status: "active",
        brief,
        approval_mode: "manual",
        places_details_enabled: false,
        auto_discover_enabled: false,
        schedule_cron: "0 6 * * *",
        schedule_timezone: "Europe/Oslo",
      },
    ],
    skills: LEADGRID_ONBOARDING_SKILLS,
  };
}

export async function storeProjectOnboardingPreview(
  pool: Pick<Pool, "query">,
  args: {
    organizationId: string;
    userId: string;
    plan: ProjectOnboardingPlan;
  },
): Promise<StoredProjectOnboardingPreview> {
  const result = await pool.query<{
    id: string;
    organization_id: string;
    created_by: string;
    plan: ProjectOnboardingPlan;
    expires_at: Date | string;
  }>(
    `INSERT INTO leadgrid_project_onboarding_previews (
       organization_id, created_by, website_url, website_domain, plan,
       expires_at
     ) VALUES (
       $1::uuid, $2, $3, $4, $5::jsonb,
       NOW() + ($6::text || ' minutes')::interval
     )
     RETURNING id::text, organization_id::text, created_by, plan, expires_at`,
    [
      args.organizationId,
      args.userId,
      args.plan.website_url,
      args.plan.website_domain,
      JSON.stringify(args.plan),
      PROJECT_ONBOARDING_TTL_MINUTES,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("project_onboarding_preview_store_failed");
  return {
    ...row,
    expires_at: new Date(row.expires_at).toISOString(),
  };
}

function profilePersistenceValues(brief: DiscoveryBrief) {
  const desiredSignals: Array<Record<string, unknown>> = [];
  if (brief.organization_structure !== "any") {
    desiredSignals.push({
      key: "organization_structure",
      value: brief.organization_structure,
      unknown_values_are_retained: true,
    });
  }
  if (brief.website_requirement !== "any") {
    desiredSignals.push({
      key: "website_presence",
      value: brief.website_requirement,
      source: "brreg_registered_homepage",
    });
  }
  return {
    targetCustomerTypes: brief.industry_queries,
    cityFilters: brief.city ? [brief.city] : brief.municipality_names,
    latitude: brief.geo?.latitude ?? null,
    longitude: brief.geo?.longitude ?? null,
    radiusKm: brief.geo?.radius_km ?? 25,
    companySizeMin: brief.employee_count?.minimum ?? null,
    companySizeMax: brief.employee_count?.maximum ?? null,
    desiredSignals,
  };
}

function brandFieldConfidence(profile: BrandProfile, overrides: Record<string, unknown>) {
  const fields = [
    "businessName",
    "tagline",
    "description",
    "toneOfVoice",
    "usps",
    "primaryCTA",
    "colors",
    "fonts",
    "logoUrl",
    "industry",
    "targetAudience",
  ];
  return Object.fromEntries(
    fields.map((field) => [
      field,
      overrides[field] !== undefined
        ? "user"
        : profile[field as keyof BrandProfile] !== undefined && profile[field as keyof BrandProfile] !== ""
          ? "auto"
          : "missing",
    ]),
  );
}

async function persistBrandProfile(
  client: Queryable,
  args: {
    projectId: string;
    userId: string;
    plan: ProjectOnboardingPlan;
  },
): Promise<void> {
  const existing = await client.query<{ overrides: Record<string, unknown> }>(
    `SELECT overrides FROM brand_kits WHERE project_id = $1 LIMIT 1`,
    [args.projectId],
  );
  const overrides = existing.rows[0]?.overrides ?? {};
  await client.query(
    `INSERT INTO brand_kits (
       project_id, workspace_owner_user_id, source_url, brand_profile,
       overrides, field_confidence, last_scanned_at
     ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, NOW())
     ON CONFLICT (project_id) DO UPDATE SET
       source_url = EXCLUDED.source_url,
       brand_profile = EXCLUDED.brand_profile,
       field_confidence = EXCLUDED.field_confidence,
       last_scanned_at = NOW(),
       updated_at = NOW()`,
    [
      args.projectId,
      args.userId,
      args.plan.website_url,
      JSON.stringify(args.plan.brand_profile),
      JSON.stringify(overrides),
      JSON.stringify(brandFieldConfidence(args.plan.brand_profile, overrides)),
    ],
  );
}

async function loadResultProject(
  client: Queryable,
  organizationId: string,
  projectId: string,
) {
  const result = await client.query<{
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    status: string;
    lead_count: number;
    competitor_count: number;
  }>(
    `SELECT p.id::text, p.organization_id::text, p.name, p.description,
            COALESCE(p.status, 'active') AS status,
            COALESCE((
              SELECT COUNT(*)::int FROM crm_customers c
               WHERE c.organization_id = p.organization_id
                 AND c.project_id = p.id
            ), 0) AS lead_count,
            COALESCE((
              SELECT COUNT(DISTINCT mc.id)::int
                FROM market_scan_competitors mc
                LEFT JOIN market_scans ms ON ms.id = mc.market_scan_id
               WHERE mc.project_id = p.id OR ms.project_id = p.id
            ), 0) AS competitor_count
       FROM leadgrid_projects p
      WHERE p.organization_id = $1::uuid AND p.id = $2
      LIMIT 1`,
    [organizationId, projectId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("project_onboarding_result_missing");
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    status: row.status,
    hasBrandKit: true,
    leadCount: Number(row.lead_count),
    competitorCount: Number(row.competitor_count),
  };
}

async function loadActiveProfiles(
  client: Queryable,
  organizationId: string,
  projectId: string,
): Promise<ProjectOnboardingResult["profiles"]> {
  const result = await client.query<{
    id: string;
    name: string;
    is_default: boolean;
    version: number;
    brief: DiscoveryBrief;
    status: "active" | "paused";
    source_config: Record<string, unknown>;
  }>(
    `SELECT id::text, name, is_default, version, brief, status, source_config
       FROM leadgrid_discovery_profiles
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND status <> 'archived'
      ORDER BY is_default DESC, updated_at DESC, id DESC`,
    [organizationId, projectId],
  );
  return result.rows.map((row) => {
    const googlePlaces =
      row.source_config?.google_places &&
      typeof row.source_config.google_places === "object"
        ? (row.source_config.google_places as Record<string, unknown>)
        : {};
    return {
      id: row.id,
      name: row.name,
      is_default: row.is_default,
      version: row.version,
      brief: discoveryBriefSchema.parse(row.brief),
      places_details_enabled:
        googlePlaces.enabled === true && googlePlaces.mode === "transient_details_only",
      status: row.status,
    };
  });
}

async function ensureRecommendedProfiles(
  client: Queryable,
  args: {
    organizationId: string;
    projectId: string;
    userId: string;
    plans: ProjectOnboardingProfilePlan[];
  },
): Promise<void> {
  const current = await loadActiveProfiles(client, args.organizationId, args.projectId);
  if (current.length > 0) return;
  for (const [index, plan] of args.plans.entries()) {
    const brief = discoveryBriefSchema.parse(plan.brief);
    const values = profilePersistenceValues(brief);
    await client.query(
      `INSERT INTO leadgrid_discovery_profiles (
         organization_id, project_id, name, is_default, status,
         target_customer_types, city_filters, geography_lat,
         geography_lng, geography_radius_km, company_size_min,
         company_size_max, brief, desired_signals, exclusion_rules,
         source_config, approval_mode, approval_rules,
         max_candidates_per_run, enrichment_count, auto_discover_enabled,
         schedule_cron, schedule_timezone, created_by, updated_by
       ) VALUES (
         $1::uuid, $2, $3, $4, 'active', $5::text[], $6::text[],
         $7::numeric, $8::numeric, $9, $10, $11, $12::jsonb,
         $13::jsonb, $14::jsonb, $15::jsonb, 'manual', '{}'::jsonb,
         $16, $17, FALSE, $18, $19, $20, $20
       )`,
      [
        args.organizationId,
        args.projectId,
        plan.name,
        index === 0,
        values.targetCustomerTypes,
        values.cityFilters,
        values.latitude,
        values.longitude,
        values.radiusKm,
        values.companySizeMin,
        values.companySizeMax,
        JSON.stringify(brief),
        JSON.stringify(values.desiredSignals),
        JSON.stringify({ terms: brief.exclusion_terms }),
        JSON.stringify(profileSourceConfig(plan.places_details_enabled)),
        brief.target_count,
        brief.enrichment_count,
        plan.schedule_cron,
        plan.schedule_timezone,
        args.userId,
      ],
    );
  }
}

function slug(value: string): string {
  const normalized = normalizedSearchText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return normalized || "kunde";
}

function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

async function ensureTargetOrganization(
  client: Queryable,
  args: {
    sourceOrganizationId: string;
    userId: string;
    plan: ProjectOnboardingPlan;
    accessSetup?: ProjectOnboardingAccessSetup;
  },
): Promise<{ id: string; name: string; reused: boolean }> {
  const selection = args.accessSetup?.organization ?? { mode: "current" as const };
  if (selection.mode === "create") {
    const existing = await client.query<{ id: string; name: string }>(
      `SELECT id::text, name
         FROM organizations
        WHERE LOWER(COALESCE(meta->>'customer_domain', '')) = $1
           OR LOWER(REGEXP_REPLACE(
                SPLIT_PART(SPLIT_PART(COALESCE(website, ''), '//', 2), '/', 1),
                '^www\\.', ''
              )) = $1
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE`,
      [args.plan.website_domain],
    );
    if (existing.rows[0]) return { ...existing.rows[0], reused: true };
    const baseSlug = slug(selection.name || args.plan.project_name).slice(0, 60);
    const created = await client.query<{ id: string; name: string }>(
      `INSERT INTO organizations (
         name, slug, org_type, plan, owner_user_id, website, industry,
         contact_email, meta
       ) VALUES (
         $1, $2, 'customer', 'free', $3, $4, $5, $6,
         jsonb_build_object(
           'leadgrid_source', 'domain_onboarding',
           'customer_domain', $7::text
         )
       )
       RETURNING id::text, name`,
      [
        safeText(selection.name || args.plan.project_name, 200),
        `${baseSlug}-${randomUUID().slice(0, 6)}`,
        args.userId,
        args.plan.website_url,
        args.plan.category,
        normalizeEmail(args.accessSetup?.administrator_email ?? "") || null,
        args.plan.website_domain,
      ],
    );
    if (!created.rows[0]) throw new Error("project_onboarding_organization_failed");
    return { ...created.rows[0], reused: false };
  }

  const organizationId = selection.mode === "existing"
    ? selection.organization_id
    : args.sourceOrganizationId;
  const result = await client.query<{ id: string; name: string }>(
    `SELECT id::text, name FROM organizations WHERE id = $1::uuid LIMIT 1 FOR UPDATE`,
    [organizationId],
  );
  if (!result.rows[0]) throw new Error("project_onboarding_organization_not_found");
  return { ...result.rows[0], reused: true };
}

async function ensureOrganizationMembership(
  client: Queryable,
  organizationId: string,
  userId: string,
  role: "admin" | "member" | "viewer",
  invitedBy: string,
): Promise<void> {
  await client.query(
    `INSERT INTO organization_members (
       organization_id, user_id, role, invited_by, invited_at, joined_at
     ) VALUES ($1::uuid, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (organization_id, user_id) DO UPDATE SET
       role = CASE
         WHEN organization_members.role = 'admin' OR EXCLUDED.role = 'admin' THEN 'admin'
         WHEN organization_members.role = 'viewer' AND EXCLUDED.role = 'member' THEN 'member'
         ELSE organization_members.role
       END`,
    [organizationId, userId, role, invitedBy],
  );
}

async function ensureProjectMembership(
  client: Queryable,
  args: {
    organizationId: string;
    projectId: string;
    userId: string;
    role: ProjectOnboardingProjectRole;
    invitedBy: string;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO leadgrid_project_members (
       organization_id, project_id, user_id, role, invited_by, invited_at
     ) VALUES ($1::uuid, $2, $3, $4, $5, NOW())
     ON CONFLICT (organization_id, project_id, user_id) DO UPDATE SET
       role = CASE
         WHEN leadgrid_project_members.role = 'owner' OR EXCLUDED.role = 'owner' THEN 'owner'
         WHEN leadgrid_project_members.role = 'viewer' AND EXCLUDED.role = 'member' THEN 'member'
         ELSE leadgrid_project_members.role
       END`,
    [args.organizationId, args.projectId, args.userId, args.role, args.invitedBy],
  );
}

async function ensureSalesTeam(
  client: Queryable,
  args: {
    organizationId: string;
    projectId: string;
    userId: string;
    team: ProjectOnboardingAccessSetup["team"];
  },
): Promise<{ id: string; name: string; reused: boolean } | null> {
  if (args.team.mode === "none") return null;
  let team: { id: string; name: string; reused: boolean } | null = null;
  if (args.team.mode === "existing") {
    const existing = await client.query<{ id: string; name: string }>(
      `SELECT id, name
         FROM leadgrid_sales_teams
        WHERE organization_id = $1 AND id = $2
        LIMIT 1
        FOR UPDATE`,
      [args.organizationId, args.team.id],
    );
    if (!existing.rows[0]) throw new Error("project_onboarding_team_not_found");
    team = { ...existing.rows[0], reused: true };
  } else {
    const existing = await client.query<{ id: string; name: string }>(
      `SELECT id, name
         FROM leadgrid_sales_teams
        WHERE organization_id = $1 AND LOWER(name) = LOWER($2)
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE`,
      [args.organizationId, args.team.name],
    );
    if (existing.rows[0]) {
      team = { ...existing.rows[0], reused: true };
    } else {
      const id = `${slug(args.team.name)}-${randomUUID().slice(0, 8)}`;
      const created = await client.query<{ id: string; name: string }>(
        `INSERT INTO leadgrid_sales_teams (
           organization_id, id, name, color_hex, member_user_ids, created_by
         ) VALUES ($1, $2, $3, $4, '[]'::jsonb, $5)
         RETURNING id, name`,
        [args.organizationId, id, args.team.name, args.team.color_hex, args.userId],
      );
      if (!created.rows[0]) throw new Error("project_onboarding_team_failed");
      team = { ...created.rows[0], reused: false };
    }
  }
  await client.query(
    `INSERT INTO leadgrid_project_sales_teams (
       organization_id, project_id, sales_team_id, created_by
     ) VALUES ($1::uuid, $2, $3, $4)
     ON CONFLICT (organization_id, project_id, sales_team_id) DO NOTHING`,
    [args.organizationId, args.projectId, team.id, args.userId],
  );
  return team;
}

async function attachUserToSalesTeam(
  client: Queryable,
  args: {
    organizationId: string;
    teamId: string;
    userId: string;
    role: Exclude<ProjectOnboardingTeamRole, "none">;
  },
): Promise<void> {
  if (args.role === "leader") {
    await client.query(
      `UPDATE leadgrid_sales_teams
          SET leader_user_id = $3::text,
              member_user_ids = COALESCE(member_user_ids, '[]'::jsonb) - $3::text,
              updated_at = NOW()
        WHERE organization_id = $1 AND id = $2`,
      [args.organizationId, args.teamId, args.userId],
    );
    return;
  }
  await client.query(
    `UPDATE leadgrid_sales_teams
        SET member_user_ids = CASE
              WHEN COALESCE(member_user_ids, '[]'::jsonb) @> to_jsonb(ARRAY[$3]::text[])
                THEN COALESCE(member_user_ids, '[]'::jsonb)
              ELSE COALESCE(member_user_ids, '[]'::jsonb) || to_jsonb(ARRAY[$3]::text[])
            END,
            updated_at = NOW()
      WHERE organization_id = $1 AND id = $2`,
    [args.organizationId, args.teamId, args.userId],
  );
}

async function provisionAccessEntry(
  client: Queryable,
  args: {
    organizationId: string;
    projectId: string;
    projectName: string;
    invitedBy: string;
    email: string;
    organizationRole: "admin" | "member" | "viewer";
    projectRole: ProjectOnboardingProjectRole;
    teamId: string | null;
    teamRole: ProjectOnboardingTeamRole;
  },
): Promise<{
  summary: ProjectOnboardingAccessResult["invitations"][number];
  dispatch?: ProjectOnboardingInvitationDispatch;
  userId?: string;
}> {
  const email = normalizeEmail(args.email);
  const user = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE LOWER(NULLIF(TRIM(email), '')) = $1 LIMIT 1`,
    [email],
  );
  if (user.rows[0]) {
    const userId = user.rows[0].id;
    await ensureOrganizationMembership(
      client,
      args.organizationId,
      userId,
      args.organizationRole,
      args.invitedBy,
    );
    await ensureProjectMembership(client, {
      organizationId: args.organizationId,
      projectId: args.projectId,
      userId,
      role: args.projectRole,
      invitedBy: args.invitedBy,
    });
    if (args.teamId && args.teamRole !== "none") {
      await attachUserToSalesTeam(client, {
        organizationId: args.organizationId,
        teamId: args.teamId,
        userId,
        role: args.teamRole,
      });
    }
    return {
      userId,
      summary: {
        id: null,
        email,
        status: "active",
        project_role: args.projectRole,
        team_role: args.teamRole,
        email_status: "not_required",
      },
    };
  }

  const existing = await client.query<{
    id: string;
    token: string;
    email_status: string | null;
  }>(
    `SELECT id::text, token, email_status
       FROM leadgrid_project_invitations
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND LOWER(email) = $3
        AND accepted_at IS NULL
        AND expires_at > NOW()
      ORDER BY invited_at DESC
      LIMIT 1
      FOR UPDATE`,
    [args.organizationId, args.projectId, email],
  );
  if (existing.rows[0]) {
    await client.query(
      `UPDATE leadgrid_project_invitations
          SET role = $4,
              organization_role = $5,
              sales_team_id = $6,
              sales_team_role = NULLIF($7, 'none')
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND project_id = $3`,
      [
        existing.rows[0].id,
        args.organizationId,
        args.projectId,
        args.projectRole,
        args.organizationRole,
        args.teamId,
        args.teamRole,
      ],
    );
    return {
      summary: {
        id: existing.rows[0].id,
        email,
        status: "invited",
        project_role: args.projectRole,
        team_role: args.teamRole,
        email_status: existing.rows[0].email_status ?? "pending",
      },
    };
  }

  const token = randomBytes(32).toString("base64url");
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO leadgrid_project_invitations (
       organization_id, project_id, email, role, organization_role,
       sales_team_id, sales_team_role, token, invited_by, expires_at,
       email_status
     ) VALUES (
       $1::uuid, $2, $3, $4, $5, $6, NULLIF($7, 'none'), $8, $9,
       NOW() + INTERVAL '7 days', 'pending'
     )
     RETURNING id::text`,
    [
      args.organizationId,
      args.projectId,
      email,
      args.projectRole,
      args.organizationRole,
      args.teamId,
      args.teamRole,
      token,
      args.invitedBy,
    ],
  );
  const id = inserted.rows[0]?.id;
  if (!id) throw new Error("project_onboarding_invitation_failed");
  return {
    summary: {
      id,
      email,
      status: "invited",
      project_role: args.projectRole,
      team_role: args.teamRole,
      email_status: "pending",
    },
    dispatch: {
      id,
      token,
      email,
      projectName: args.projectName,
      projectRole: args.projectRole,
      organizationId: args.organizationId,
      projectId: args.projectId,
    },
  };
}

async function loadAccessEntrySummary(
  client: Queryable,
  args: {
    organizationId: string;
    projectId: string;
    email: string;
    projectRole: ProjectOnboardingProjectRole;
    teamRole: ProjectOnboardingTeamRole;
  },
): Promise<ProjectOnboardingAccessResult["invitations"][number]> {
  const email = normalizeEmail(args.email);
  const result = await client.query<{
    invitation_id: string | null;
    email_status: string | null;
    accepted_at: Date | string | null;
    member_user_id: string | null;
  }>(
    `SELECT invitation.id::text AS invitation_id,
            invitation.email_status,
            invitation.accepted_at,
            member.user_id AS member_user_id
       FROM (SELECT $3::text AS email) requested
       LEFT JOIN users account
         ON LOWER(NULLIF(TRIM(account.email), '')) = requested.email
       LEFT JOIN leadgrid_project_members member
         ON member.organization_id = $1::uuid
        AND member.project_id = $2
        AND member.user_id = account.id
       LEFT JOIN LATERAL (
         SELECT id, email_status, accepted_at
           FROM leadgrid_project_invitations
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND LOWER(email) = requested.email
          ORDER BY invited_at DESC
          LIMIT 1
       ) invitation ON TRUE
      LIMIT 1`,
    [args.organizationId, args.projectId, email],
  );
  const row = result.rows[0];
  return {
    id: row?.invitation_id ?? null,
    email,
    status: row?.member_user_id || row?.accepted_at ? "active" : "invited",
    project_role: args.projectRole,
    team_role: args.teamRole,
    email_status: row?.member_user_id
      ? "not_required"
      : (row?.email_status ?? "pending"),
  };
}

async function loadProvisionedAccess(
  client: Queryable,
  args: {
    organizationId: string;
    projectId: string;
    userId: string;
  },
): Promise<ProjectOnboardingAccessResult | undefined> {
  const base = await client.query<{
    organization_name: string;
    metadata: Record<string, unknown>;
  }>(
    `SELECT organization.name AS organization_name,
            COALESCE(project.metadata, '{}'::jsonb) AS metadata
       FROM leadgrid_projects project
       JOIN organizations organization ON organization.id = project.organization_id
      WHERE project.organization_id = $1::uuid AND project.id = $2
      LIMIT 1`,
    [args.organizationId, args.projectId],
  );
  const row = base.rows[0];
  const administratorEmail = typeof row?.metadata?.customer_admin_email === "string"
    ? normalizeEmail(row.metadata.customer_admin_email)
    : "";
  if (!row || !administratorEmail) return undefined;
  const teamId = typeof row.metadata.sales_team_id === "string"
    ? row.metadata.sales_team_id
    : null;
  let team: ProjectOnboardingAccessResult["team"] = null;
  if (teamId) {
    const teamResult = await client.query<{ id: string; name: string }>(
      `SELECT team.id, team.name
         FROM leadgrid_project_sales_teams project_team
         JOIN leadgrid_sales_teams team
           ON team.organization_id = project_team.organization_id::text
          AND team.id = project_team.sales_team_id
        WHERE project_team.organization_id = $1::uuid
          AND project_team.project_id = $2
          AND project_team.sales_team_id = $3
        LIMIT 1`,
      [args.organizationId, args.projectId, teamId],
    );
    if (teamResult.rows[0]) team = { ...teamResult.rows[0], reused: true };
  }
  const admin = await loadAccessEntrySummary(client, {
    organizationId: args.organizationId,
    projectId: args.projectId,
    email: administratorEmail,
    projectRole: "owner",
    teamRole: team ? "leader" : "none",
  });
  const rawEntries = Array.isArray(row.metadata.onboarding_access_entries)
    ? row.metadata.onboarding_access_entries
    : [];
  const invitations: ProjectOnboardingAccessResult["invitations"] = [];
  for (const rawEntry of rawEntries) {
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const entry = rawEntry as Record<string, unknown>;
    if (
      typeof entry.email !== "string"
      || !["owner", "member", "viewer"].includes(String(entry.project_role))
      || !["leader", "member", "none"].includes(String(entry.team_role))
    ) continue;
    invitations.push(await loadAccessEntrySummary(client, {
      organizationId: args.organizationId,
      projectId: args.projectId,
      email: entry.email,
      projectRole: entry.project_role as ProjectOnboardingProjectRole,
      teamRole: entry.team_role as ProjectOnboardingTeamRole,
    }));
  }
  const authorized = await client.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM leadgrid_project_members member
         JOIN organization_members organization_member
           ON organization_member.organization_id = member.organization_id
          AND organization_member.user_id = member.user_id
        WHERE member.organization_id = $1::uuid
          AND member.project_id = $2
          AND member.user_id = $3
     ) AS allowed`,
    [args.organizationId, args.projectId, args.userId],
  );
  return {
    organization: {
      id: args.organizationId,
      name: row.organization_name,
      reused: true,
    },
    team,
    administrator: {
      email: admin.email,
      status: admin.status,
      organization_role: "admin",
      project_role: "owner",
      email_status: admin.email_status,
    },
    invitations,
    discovery_access_verified: authorized.rows[0]?.allowed === true,
  };
}

export async function commitProjectOnboarding(
  pool: Pool,
  args: {
    previewId: string;
    organizationId: string;
    userId: string;
    editedProfiles?: ProjectOnboardingProfilePlan[];
    accessSetup?: ProjectOnboardingAccessSetup;
  },
): Promise<ProjectOnboardingServiceResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const previewResult = await client.query<{
      id: string;
      plan: ProjectOnboardingPlan;
      expires_at: Date | string;
      committed_at: Date | string | null;
      committed_organization_id: string | null;
      committed_project_id: string | null;
    }>(
      `SELECT id::text, plan, expires_at, committed_at,
              committed_organization_id::text, committed_project_id
         FROM leadgrid_project_onboarding_previews
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND created_by = $3
        FOR UPDATE`,
      [args.previewId, args.organizationId, args.userId],
    );
    const preview = previewResult.rows[0];
    if (!preview) throw new Error("project_onboarding_preview_not_found");
    if (!preview.committed_at && new Date(preview.expires_at).getTime() <= Date.now()) {
      throw new Error("project_onboarding_preview_expired");
    }
    if (preview.committed_project_id) {
      const committedOrganizationId = preview.committed_organization_id
        ?? args.organizationId;
      const project = await loadResultProject(
        client,
        committedOrganizationId,
        preview.committed_project_id,
      );
      const profiles = await loadActiveProfiles(
        client,
        committedOrganizationId,
        preview.committed_project_id,
      );
      const access = await loadProvisionedAccess(client, {
        organizationId: committedOrganizationId,
        projectId: preview.committed_project_id,
        userId: args.userId,
      });
      await client.query("COMMIT");
      return {
        project,
        profiles,
        skills: LEADGRID_ONBOARDING_SKILLS,
        reused_project: true,
        replayed: true,
        access,
        invitation_dispatches: [],
      };
    }
    const storedPlan = preview.plan;
    const plans = (args.editedProfiles ?? storedPlan.recommended_profiles).map((item) => ({
      ...item,
      status: "active" as const,
      approval_mode: "manual" as const,
      auto_discover_enabled: false,
      brief: discoveryBriefSchema.parse(item.brief),
    }));
    if (plans.length < 1 || plans.length > 10) {
      throw new Error("project_onboarding_profiles_invalid");
    }
    if (new Set(plans.map((item) => item.name.trim().toLocaleLowerCase("nb-NO"))).size !== plans.length) {
      throw new Error("project_onboarding_profiles_invalid");
    }
    if (plans.filter((item) => item.is_default).length > 1) {
      throw new Error("project_onboarding_profiles_invalid");
    }
    plans.forEach((item, index) => {
      item.name = safeText(item.name, 120);
      item.is_default = index === 0;
    });

    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
      `project-domain-onboarding|${storedPlan.website_domain}`,
    ]);

    const organization = await ensureTargetOrganization(client, {
      sourceOrganizationId: args.organizationId,
      userId: args.userId,
      plan: storedPlan,
      accessSetup: args.accessSetup,
    });
    const targetOrganizationId = organization.id;
    await ensureOrganizationMembership(
      client,
      targetOrganizationId,
      args.userId,
      "member",
      args.userId,
    );

    let replayed = false;
    let reusedProject = false;
    let projectId = preview.committed_project_id;
    if (projectId) {
      replayed = true;
      reusedProject = true;
    } else {
      const existing = await client.query<{ id: string }>(
        `SELECT p.id::text
           FROM leadgrid_projects p
           LEFT JOIN brand_kits bk ON bk.project_id = p.id
          WHERE p.organization_id = $1::uuid
            AND (p.status IS NULL OR p.status NOT IN ('archived', 'deleted'))
            AND (
              LOWER(COALESCE(
                p.metadata->>'customer_domain',
                p.metadata->>'website_domain',
                p.metadata->>'domain',
                ''
              )) = $2
              OR LOWER(REGEXP_REPLACE(
                SPLIT_PART(SPLIT_PART(COALESCE(bk.source_url, ''), '//', 2), '/', 1),
                '^www\\.', ''
              )) = $2
            )
          ORDER BY p.created_at ASC
          LIMIT 1`,
        [targetOrganizationId, storedPlan.website_domain],
      );
      projectId = existing.rows[0]?.id ?? null;
      reusedProject = Boolean(projectId);
    }

    if (!projectId) {
      projectId = `${slug(storedPlan.project_name)}-${randomUUID().slice(0, 8)}`;
      await client.query(
        `INSERT INTO leadgrid_projects (
           id, organization_id, name, description, status, project_type,
           industry, created_by, metadata
         ) VALUES (
           $1, $2::uuid, $3, $4, 'active', 'b2b_sales', $5, $6, $7::jsonb
         )`,
        [
          projectId,
          targetOrganizationId,
          storedPlan.project_name,
          storedPlan.project_description || null,
          storedPlan.category,
          args.userId,
          JSON.stringify({
            leadgrid_source: "domain_onboarding",
            domain: storedPlan.website_domain,
            website_domain: storedPlan.website_domain,
            website_url: storedPlan.website_url,
            category: storedPlan.category,
          }),
        ],
      );
      await client.query(
        `INSERT INTO leadgrid_project_members (
           organization_id, project_id, user_id, role, invited_by, invited_at
         ) VALUES ($1::uuid, $2, $3, 'owner', $3, NOW())
         ON CONFLICT (organization_id, project_id, user_id) DO NOTHING`,
        [targetOrganizationId, projectId, args.userId],
      );
    } else {
      await client.query(
        `UPDATE leadgrid_projects
            SET industry = COALESCE(NULLIF(industry, ''), $3),
                metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                updated_at = NOW()
          WHERE organization_id = $1::uuid AND id = $2`,
        [
          targetOrganizationId,
          projectId,
          storedPlan.category,
          JSON.stringify({
            domain: storedPlan.website_domain,
            website_domain: storedPlan.website_domain,
            website_url: storedPlan.website_url,
            category: storedPlan.category,
          }),
        ],
      );
    }

    await ensureProjectMembership(client, {
      organizationId: targetOrganizationId,
      projectId,
      userId: args.userId,
      role: "owner",
      invitedBy: args.userId,
    });

    await persistBrandProfile(client, {
      projectId,
      userId: args.userId,
      plan: storedPlan,
    });
    await ensureRecommendedProfiles(client, {
      organizationId: targetOrganizationId,
      projectId,
      userId: args.userId,
      plans,
    });

    let access: ProjectOnboardingAccessResult | undefined;
    const invitationDispatches: ProjectOnboardingInvitationDispatch[] = [];
    if (args.accessSetup) {
      const team = await ensureSalesTeam(client, {
        organizationId: targetOrganizationId,
        projectId,
        userId: args.userId,
        team: args.accessSetup.team,
      });
      const administrator = await provisionAccessEntry(client, {
        organizationId: targetOrganizationId,
        projectId,
        projectName: storedPlan.project_name,
        invitedBy: args.userId,
        email: args.accessSetup.administrator_email,
        organizationRole: "admin",
        projectRole: "owner",
        teamId: team?.id ?? null,
        teamRole: team ? "leader" : "none",
      });
      if (administrator.dispatch) invitationDispatches.push(administrator.dispatch);
      if (administrator.userId) {
        await client.query(
          `UPDATE organizations
              SET owner_user_id = $2,
                  contact_email = COALESCE(NULLIF(contact_email, ''), $3),
                  updated_at = NOW()
            WHERE id = $1::uuid`,
          [targetOrganizationId, administrator.userId, administrator.summary.email],
        );
      }

      const invitationSummaries: ProjectOnboardingAccessResult["invitations"] = [];
      for (const invitation of args.accessSetup.invitations) {
        if (normalizeEmail(invitation.email) === administrator.summary.email) continue;
        const provisioned = await provisionAccessEntry(client, {
          organizationId: targetOrganizationId,
          projectId,
          projectName: storedPlan.project_name,
          invitedBy: args.userId,
          email: invitation.email,
          organizationRole: invitation.project_role === "viewer" ? "viewer" : "member",
          projectRole: invitation.project_role,
          teamId: team?.id ?? null,
          teamRole: team ? invitation.team_role : "none",
        });
        invitationSummaries.push(provisioned.summary);
        if (provisioned.dispatch) invitationDispatches.push(provisioned.dispatch);
      }

      await client.query(
        `UPDATE leadgrid_projects
            SET metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
                updated_at = NOW()
          WHERE organization_id = $1::uuid AND id = $2`,
        [
          targetOrganizationId,
          projectId,
          JSON.stringify({
            customer_admin_email: administrator.summary.email,
            sales_team_id: team?.id ?? null,
            onboarding_access_entries: args.accessSetup.invitations
              .filter((invitation) => normalizeEmail(invitation.email) !== administrator.summary.email)
              .map((invitation) => ({
                email: normalizeEmail(invitation.email),
                project_role: invitation.project_role,
                team_role: team ? invitation.team_role : "none",
              })),
          }),
        ],
      );
      const authorized = await client.query<{ allowed: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM leadgrid_project_members member
             JOIN organization_members organization_member
               ON organization_member.organization_id = member.organization_id
              AND organization_member.user_id = member.user_id
            WHERE member.organization_id = $1::uuid
              AND member.project_id = $2
              AND member.user_id = $3
         ) AS allowed`,
        [targetOrganizationId, projectId, args.userId],
      );
      if (authorized.rows[0]?.allowed !== true) {
        throw new Error("project_onboarding_discovery_access_failed");
      }
      access = {
        organization,
        team,
        administrator: {
          email: administrator.summary.email,
          status: administrator.summary.status,
          organization_role: "admin",
          project_role: "owner",
          email_status: administrator.summary.email_status,
        },
        invitations: invitationSummaries,
        discovery_access_verified: true,
      };
    }
    await client.query(
      `UPDATE leadgrid_project_onboarding_previews
          SET committed_at = COALESCE(committed_at, NOW()),
              committed_organization_id = COALESCE(committed_organization_id, $4::uuid),
              committed_project_id = COALESCE(committed_project_id, $5)
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND created_by = $3`,
      [
        args.previewId,
        args.organizationId,
        args.userId,
        targetOrganizationId,
        projectId,
      ],
    );
    const project = await loadResultProject(client, targetOrganizationId, projectId);
    const profiles = await loadActiveProfiles(client, targetOrganizationId, projectId);
    await client.query("COMMIT");
    return {
      project,
      profiles,
      skills: LEADGRID_ONBOARDING_SKILLS,
      reused_project: reusedProject,
      replayed,
      access,
      invitation_dispatches: invitationDispatches,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
