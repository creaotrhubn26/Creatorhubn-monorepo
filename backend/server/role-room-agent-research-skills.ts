import crypto from "node:crypto";

export const ROLE_ROOM_RESEARCH_SKILL_DEFINITIONS = [
  {
    id: "resolve_company_identity",
    version: "1.0.0",
    dependsOn: [],
    instruction:
      "Selskapsidentitet: les kundens eget nettsted først når URL finnes. Koble merkenavn, domene, legalName og organisasjonsnummer før Brreg-oppslag. Bruk kundens førstegangskilde for tilbud og målgruppe, og Brreg for juridisk navn, org.nr., adresse og NACE. Merkenavn eller et navn-only treff er ikke juridisk fasit.",
  },
  {
    id: "discover_product_competitors",
    version: "1.0.0",
    dependsOn: ["resolve_company_identity"],
    instruction:
      "Produktkonkurrenter: avklar kundens produktkategori og markedsområde før søk. Behold bare kandidater med verifiserbar førstegangskilde eller offentlig register-/Places-bevis, ekskluder kunden selv, og dedupliser på org.nr., domene og normalisert navn. En lokal klinikk er ikke en konkurrent til klinisk programvare bare fordi navn eller helseord ligner.",
  },
  {
    id: "verify_market_and_location",
    version: "1.0.0",
    dependsOn: ["resolve_company_identity"],
    instruction:
      "Marked og geografi: anmeldelser, lokale muligheter og eventpartnere skal forkastes når adresse, land, kommune eller radius ikke samsvarer med kundens verifiserte marked. Region-bias, popularitet og et stedsnavn alene er aldri geografisk bevis. Returner tomme forslag med begrensning når riktig geografi ikke kan dokumenteres.",
  },
  {
    id: "extract_brand_system",
    version: "1.0.0",
    dependsOn: ["resolve_company_identity"],
    instruction:
      "Merkevaresystem: bruk en faktisk logoressurs fra kundens nettsted og trekk paletten fra denne ressursen. Ikke gjett logo eller farger fra bransjen. Dedupliser farger, behold gyldige hex-verdier og marker manglende logo/palett som begrenset i stedet for å finne på et visuelt uttrykk.",
  },
  {
    id: "recommend_merch_and_suppliers",
    version: "1.0.0",
    dependsOn: [
      "resolve_company_identity",
      "verify_market_and_location",
      "extract_brand_system",
    ],
    instruction:
      "Merch og leverandører: anbefal unike produkter ut fra verifisert virksomhet, målgruppe og merkevaresystem. Match bare en leverandør når kategori og produksjonsteknikk kan dokumenteres; ikke gjenbruk samme leverandør i flere anbefalinger. Produktvisualisering er et konsept, ikke produksjonsbevis, og krever manuell bekreftelse av stoff, passform, farge og trykkteknikk.",
  },
  {
    id: "audit_research_dataflow",
    version: "1.0.0",
    dependsOn: [
      "resolve_company_identity",
      "discover_product_competitors",
      "verify_market_and_location",
      "extract_brand_system",
      "recommend_merch_and_suppliers",
    ],
    instruction:
      "Dataflytkontroll: før resultatet lagres eller brukes videre, kontroller at alle research-skills ble kjørt én gang, at juridisk identitet og klassifisering er propagert uten drift, at kunden ikke finnes i konkurrentlisten, og at konkurrenter, lokale treff, farger, leverandører og produktanbefalinger er kildebelagte og uten duplikater. Ved brudd skal skillen rapportere failed eller limited; den skal aldri reparere fakta ved å gjette.",
  },
] as const;

export type RoleRoomResearchSkillId =
  (typeof ROLE_ROOM_RESEARCH_SKILL_DEFINITIONS)[number]["id"];

export type RoleRoomResearchSkillStatus = "ready" | "limited" | "failed";

export type RoleRoomResearchSkillCheck = {
  id: string;
  passed: boolean;
  severity: "critical" | "warning";
  detail: string;
};

export type RoleRoomResearchSkillRun = {
  id: RoleRoomResearchSkillId;
  version: string;
  status: RoleRoomResearchSkillStatus;
  executionKey: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  evidenceCount: number;
  sourceKinds: string[];
  limitations: string[];
  checks?: RoleRoomResearchSkillCheck[];
};

export type RoleRoomResearchSkillSummary = Pick<
  RoleRoomResearchSkillRun,
  "status" | "evidenceCount" | "sourceKinds" | "limitations" | "checks"
>;

type SkillClock = {
  now: () => Date;
  monotonicMs: () => number;
};

const defaultClock: SkillClock = {
  now: () => new Date(),
  monotonicMs: () => performance.now(),
};

function stableInputValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableInputValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableInputValue(entry)]),
  );
}

export function buildRoleRoomResearchSkillFingerprint(input: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableInputValue(input)))
    .digest("hex")
    .slice(0, 24);
}

function uniqueStrings(values: readonly string[] | undefined): string[] {
  return Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  );
}

function definitionFor(id: RoleRoomResearchSkillId) {
  const definition = ROLE_ROOM_RESEARCH_SKILL_DEFINITIONS.find(
    (entry) => entry.id === id,
  );
  if (!definition) throw new Error(`unknown_role_room_research_skill:${id}`);
  return definition;
}

/**
 * Runtime ledger for the deterministic bootstrap skills. A Map keyed by skill
 * id makes duplicate execution observable and impossible to serialize. The
 * execution key is stable for identical normalized input + skill version.
 */
export class RoleRoomResearchSkillLedger {
  private readonly runsById = new Map<
    RoleRoomResearchSkillId,
    RoleRoomResearchSkillRun
  >();

  constructor(
    private readonly inputFingerprint: string,
    private readonly clock: SkillClock = defaultClock,
  ) {}

  async execute<T>(
    id: RoleRoomResearchSkillId,
    executor: () => Promise<T>,
    summarize: (value: T) => RoleRoomResearchSkillSummary,
  ): Promise<T> {
    if (this.runsById.has(id))
      throw new Error(`duplicate_role_room_research_skill:${id}`);
    const startedAt = this.clock.now();
    const startedMs = this.clock.monotonicMs();
    try {
      const value = await executor();
      this.record(id, summarize(value), startedAt, startedMs);
      return value;
    } catch (error) {
      this.record(
        id,
        {
          status: "failed",
          evidenceCount: 0,
          sourceKinds: [],
          limitations: [
            error instanceof Error ? error.message : "skill_execution_failed",
          ],
        },
        startedAt,
        startedMs,
      );
      throw error;
    }
  }

  record(
    id: RoleRoomResearchSkillId,
    summary: RoleRoomResearchSkillSummary,
    startedAt = this.clock.now(),
    startedMs = this.clock.monotonicMs(),
  ): void {
    if (this.runsById.has(id))
      throw new Error(`duplicate_role_room_research_skill:${id}`);
    const definition = definitionFor(id);
    const finishedAt = this.clock.now();
    this.runsById.set(id, {
      id,
      version: definition.version,
      status: summary.status,
      executionKey: `${this.inputFingerprint}:${id}:${definition.version}`,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.max(0, Math.round(this.clock.monotonicMs() - startedMs)),
      evidenceCount: Math.max(0, Math.floor(summary.evidenceCount)),
      sourceKinds: uniqueStrings(summary.sourceKinds),
      limitations: uniqueStrings(summary.limitations),
      ...(summary.checks ? { checks: summary.checks } : {}),
    });
  }

  snapshot(): RoleRoomResearchSkillRun[] {
    return ROLE_ROOM_RESEARCH_SKILL_DEFINITIONS.map((definition) => {
      const run = this.runsById.get(definition.id);
      if (run)
        return {
          ...run,
          sourceKinds: [...run.sourceKinds],
          limitations: [...run.limitations],
        };
      const timestamp = this.clock.now().toISOString();
      return {
        id: definition.id,
        version: definition.version,
        status: "limited",
        executionKey: `${this.inputFingerprint}:${definition.id}:${definition.version}`,
        startedAt: timestamp,
        finishedAt: timestamp,
        durationMs: 0,
        evidenceCount: 0,
        sourceKinds: [],
        limitations: ["skill_not_executed_in_selected_bootstrap_path"],
      };
    });
  }

  completedRuns(): RoleRoomResearchSkillRun[] {
    return ROLE_ROOM_RESEARCH_SKILL_DEFINITIONS.flatMap((definition) => {
      const run = this.runsById.get(definition.id);
      return run
        ? [
            {
              ...run,
              sourceKinds: [...run.sourceKinds],
              limitations: [...run.limitations],
            },
          ]
        : [];
    });
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeName(value: unknown): string {
  return readString(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9æøå]+/g, " ")
    .trim();
}

function normalizeHost(value: unknown): string {
  const raw = readString(value);
  if (!raw) return "";
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function addCheck(
  checks: RoleRoomResearchSkillCheck[],
  id: string,
  passed: boolean,
  detail: string,
  severity: RoleRoomResearchSkillCheck["severity"] = "critical",
): void {
  checks.push({ id, passed, severity, detail });
}

function candidateIdentityTokens(candidate: Record<string, unknown>): string[] {
  const tokens: string[] = [];
  const organizationNumber = readString(candidate.organizationNumber).replace(
    /\D/g,
    "",
  );
  if (organizationNumber) tokens.push(`org:${organizationNumber}`);
  const host = normalizeHost(candidate.websiteUrl);
  if (host) tokens.push(`host:${host}`);
  const placeId = readString(candidate.placeId);
  if (placeId) tokens.push(`place:${placeId}`);
  const name = normalizeName(candidate.name);
  if (name) tokens.push(`name:${name}`);
  return tokens;
}

function hasOverlappingIdentity(
  candidates: readonly Record<string, unknown>[],
): boolean {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    for (const token of candidateIdentityTokens(candidate)) {
      if (seen.has(token)) return true;
      seen.add(token);
    }
  }
  return false;
}

function allUnique(values: readonly string[]): boolean {
  const usable = values.filter(Boolean);
  return usable.length === new Set(usable).size;
}

export type RoleRoomResearchDataflowAudit = {
  status: RoleRoomResearchSkillStatus;
  checks: RoleRoomResearchSkillCheck[];
  limitations: string[];
};

/** Pure, fail-closed audit of the normalized payload before persistence. */
export function auditRoleRoomResearchDataflow(
  payloadValue: unknown,
  upstreamRuns: readonly RoleRoomResearchSkillRun[],
): RoleRoomResearchDataflowAudit {
  const payload = asRecord(payloadValue);
  const checks: RoleRoomResearchSkillCheck[] = [];
  const expectedUpstream = ROLE_ROOM_RESEARCH_SKILL_DEFINITIONS.map(
    (definition) => definition.id,
  ).filter((id) => id !== "audit_research_dataflow");
  const runIds = upstreamRuns.map((run) => run.id);
  addCheck(
    checks,
    "skills_executed_once",
    runIds.length === expectedUpstream.length
      && allUnique(runIds)
      && expectedUpstream.every((id) => runIds.includes(id)),
    "Alle fem oppstrøms research-skills skal finnes nøyaktig én gang.",
  );

  const brreg = asRecord(payload.brregCompany);
  const company = asRecord(payload.companyProfile);
  const project = asRecord(payload.projectCreationDraft);
  const verifiedOrg =
    readString(brreg.lookupStatus) === "verified"
      ? readString(brreg.organizationNumber).replace(/\D/g, "")
      : "";
  const companyOrg = readString(company.organizationNumber).replace(/\D/g, "");
  const projectOrg = readString(project.clientOrganizationNumber).replace(
    /\D/g,
    "",
  );
  addCheck(
    checks,
    "legal_identity_propagated",
    !verifiedOrg || (companyOrg === verifiedOrg && projectOrg === verifiedOrg),
    "Verifisert organisasjonsnummer skal være identisk i companyProfile og projectCreationDraft.",
  );

  const competitors = asRecords(
    asRecord(payload.competitorAnalysis).competitors,
  );
  addCheck(
    checks,
    "competitors_unique",
    !hasOverlappingIdentity(competitors),
    "Konkurrenter skal være deduplisert på org.nr., domene, place-id eller normalisert navn.",
  );
  const customerHosts = new Set(
    [normalizeHost(company.websiteUrl), normalizeHost(brreg.website)].filter(
      Boolean,
    ),
  );
  const customerNames = new Set(
    [normalizeName(company.companyName), normalizeName(brreg.name)].filter(
      Boolean,
    ),
  );
  const hasSelfCompetitor = competitors.some(
    (candidate) =>
      customerHosts.has(normalizeHost(candidate.websiteUrl)) ||
      customerNames.has(normalizeName(candidate.name)),
  );
  addCheck(
    checks,
    "customer_excluded_from_competitors",
    !hasSelfCompetitor,
    "Kundens eget domene eller navn skal aldri finnes i konkurrentlisten.",
  );
  const unsourcedCompetitor = competitors.some((candidate) => {
    const status = readString(candidate.status);
    if (status !== "verified" && status !== "likely") return false;
    const evidence = Array.isArray(candidate.evidence)
      ? candidate.evidence
      : [];
    return (
      evidence.length === 0 ||
      (!normalizeHost(candidate.websiteUrl) &&
        !readString(candidate.placeId) &&
        !readString(candidate.organizationNumber))
    );
  });
  addCheck(
    checks,
    "competitors_source_backed",
    !unsourcedCompetitor,
    "Alle verified/likely konkurrenter skal ha evidens og en kontrollerbar URL, place-id eller org.nr.",
  );

  const opportunities = asRecords(
    asRecord(payload.localPresencePlan).nearbyOpportunities,
  );
  addCheck(
    checks,
    "local_opportunities_unique",
    !hasOverlappingIdentity(opportunities),
    "Lokale muligheter skal være deduplisert på place-id, domene eller normalisert navn.",
  );
  const invalidLocalEvidence = opportunities.some((opportunity) => {
    const evidenceTypes = asRecords(opportunity.evidence).map((entry) =>
      readString(entry.type),
    );
    const radiusKm = asFiniteNumber(opportunity.radiusKm);
    return (
      !evidenceTypes.includes("same_area") || radiusKm === null || radiusKm <= 0
    );
  });
  addCheck(
    checks,
    "local_opportunities_geographically_grounded",
    !invalidLocalEvidence,
    "Alle lokale muligheter skal ha same_area-evidens og en positiv, eksplisitt radius.",
  );

  const brandGuide = asRecord(asRecord(payload.planningDraft).brandGuide);
  const colors = asRecords(brandGuide.colors);
  const colorValues = colors.map((color) =>
    readString(color.hex).toUpperCase(),
  );
  const validColors = colorValues.every((hex) =>
    /^#(?:[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{6}|[0-9A-F]{8})$/.test(hex),
  );
  const logoUrl = readString(company.logoUrl) || readString(brandGuide.logoUrl);
  addCheck(
    checks,
    "brand_assets_consistent",
    validColors &&
      allUnique(colorValues) &&
      (colors.length === 0 || Boolean(logoUrl)),
    "Palettfarger skal være gyldige og unike, og farger kan ikke påstås uten en logoressurs.",
  );

  const merch = asRecord(payload.merchSuppliers);
  const suppliers = asRecords(merch.suppliers);
  const recommendations = asRecords(merch.recommendations);
  const productIds = recommendations.map((entry) =>
    readString(entry.productId),
  );
  const matchedSupplierNames = recommendations
    .map((entry) => normalizeName(asRecord(entry.supplierMatch).name))
    .filter(Boolean);
  addCheck(
    checks,
    "merch_and_suppliers_unique",
    !hasOverlappingIdentity(suppliers) &&
      productIds.every(Boolean) &&
      allUnique(productIds) &&
      allUnique(matchedSupplierNames),
    "Merch-leverandører, produkt-ID-er og leverandørmatcher skal være unike.",
  );
  const unsourcedMerchSupplier = suppliers.some((supplier) => {
    const status = readString(supplier.status);
    if (status !== "verified" && status !== "likely") return false;
    const evidence = Array.isArray(supplier.evidence) ? supplier.evidence : [];
    return evidence.length === 0 || candidateIdentityTokens(supplier).length === 0;
  });
  addCheck(
    checks,
    "merch_suppliers_source_backed",
    !unsourcedMerchSupplier,
    "Alle verified/likely merch-leverandører skal ha evidens og kontrollerbar identitet.",
  );
  const suppliersByName = new Map(
    suppliers.map((supplier) => [normalizeName(supplier.name), supplier]),
  );
  const undocumentedSupplierMatch = recommendations.some((recommendation) => {
    const supplierMatch = asRecord(recommendation.supplierMatch);
    const matchedName = normalizeName(supplierMatch.name);
    if (!matchedName) return false;
    const supplier = suppliersByName.get(matchedName);
    if (!supplier) return true;
    const technique = readString(recommendation.recommendedTechnique);
    const category = readString(recommendation.productCategory);
    const confirmedTechniques = Array.isArray(supplier.websiteConfirmedTechniques)
      ? supplier.websiteConfirmedTechniques.map(readString)
      : [];
    const confirmedCategories = Array.isArray(supplier.websiteConfirmedProductCategories)
      ? supplier.websiteConfirmedProductCategories.map(readString)
      : [];
    return !technique
      || !category
      || !confirmedTechniques.includes(technique)
      || !confirmedCategories.includes(category);
  });
  addCheck(
    checks,
    "merch_matches_documented",
    !undocumentedSupplierMatch,
    "En produktkobling skal bare finnes når leverandørens nettsted bekrefter både kategori og produksjonsteknikk.",
  );

  const planningLogic = asRecord(asRecord(payload.planningDraft).contentLogic);
  const storyLogic = asRecord(
    asRecord(payload.storyLogicDraft).contentStoryLogic,
  );
  const propagationFields = [
    "industry",
    "subIndustry",
    "businessModel",
    "contentCategory",
    "productionApproach",
  ];
  const propagationMatches = propagationFields.every((field) => {
    const canonical = readString(company[field]);
    const downstream = [
      readString(planningLogic[field]),
      readString(storyLogic[field]),
    ];
    return !canonical || downstream.every((value) => value === canonical);
  });
  addCheck(
    checks,
    "verified_profile_propagated",
    propagationMatches,
    "Klassifisering skal være identisk i companyProfile, planningDraft og storyLogicDraft.",
  );

  const failedCritical = checks.some(
    (check) => !check.passed && check.severity === "critical",
  );
  const failedWarning = checks.some(
    (check) => !check.passed && check.severity === "warning",
  );
  const upstreamFailed = upstreamRuns.some((run) => run.status === "failed");
  const upstreamLimited = upstreamRuns.some((run) => run.status !== "ready");
  return {
    status: failedCritical || upstreamFailed
      ? "failed"
      : failedWarning || upstreamLimited
        ? "limited"
        : "ready",
    checks,
    limitations: uniqueStrings([
      ...checks.filter((check) => !check.passed).map((check) => check.detail),
      ...upstreamRuns.flatMap((run) => run.limitations),
    ]),
  };
}
