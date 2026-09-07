import crypto from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import {
  MARKETING_DISCOVERY_SKILL_KEY,
  MARKETING_DISCOVERY_SKILL_VERSION,
  type MarketingIntelligenceFeedback,
  type MarketingIntelligenceOutput,
  validateMarketingIntelligenceOutput,
} from "./leadgrid-discovery-intelligence-contract.js";
import type { LeadgridAccessibleProject } from "./leadgrid-project-access.js";

const MIN_CANDIDATES = 3;
const MIN_EVIDENCE_ITEMS = 6;
const MIN_EVIDENCE_COVERAGE = 0.25;

type ReportStatus = "generating" | "ready" | "insufficient_evidence" | "failed";

export interface MarketingEvidenceItem {
  id: string;
  kind: "aggregate" | "candidate";
  candidate_id: string | null;
  candidate_name: string | null;
  label: string;
  value: string;
  source: string;
  source_uri: string | null;
  source_ref: string | null;
}

export interface MarketingIntelligenceExperimentDto {
  hypothesis: string;
  action: string;
  metric: string;
  success_criterion: string;
  duration_days: number;
}

export interface MarketingIntelligenceInsightDto {
  id: string;
  category: string;
  claim_type: string;
  title: string;
  finding: string;
  relevance: string;
  confidence: number;
  evidence_coverage: number;
  evidence_refs: string[];
  counter_evidence: string[];
  recommended_action: string;
  experiment: MarketingIntelligenceExperimentDto | null;
  review_status: string;
  reviewed_at: string | null;
}

export interface MarketingIntelligenceReportDto {
  id: string;
  run_id: string;
  skill_key: string;
  skill_version: string;
  status: ReportStatus;
  executive_summary: string | null;
  evidence_coverage: number;
  overall_confidence: number;
  source_count: number;
  evidence_catalog: MarketingEvidenceItem[];
  conflicts: string[];
  gaps: string[];
  provider: string | null;
  model: string | null;
  error_code: string | null;
  error_message: string | null;
  insights: MarketingIntelligenceInsightDto[];
  created_at: string;
  updated_at: string;
}

const ERROR_DEFINITIONS = {
  not_found: [404, "Ingen markedsinnsikt ble funnet."],
  run_not_ready: [
    409,
    "Markedsinnsikt kan først bygges når Discovery har kandidater klare.",
  ],
  idempotency_conflict: [
    409,
    "Idempotency-Key er allerede brukt med et annet innhold.",
  ],
  generation_failed: [502, "Markedsinnsikten kunne ikke genereres."],
} as const;

export type MarketingIntelligenceErrorCode = keyof typeof ERROR_DEFINITIONS;

export class MarketingIntelligenceError extends Error {
  readonly status: number;
  readonly code: MarketingIntelligenceErrorCode;
  readonly retryable: boolean;

  constructor(
    code: MarketingIntelligenceErrorCode,
    options: { message?: string; retryable?: boolean } = {},
  ) {
    const definition = ERROR_DEFINITIONS[code];
    super(options.message ?? definition[1]);
    this.name = "MarketingIntelligenceError";
    this.code = code;
    this.status = definition[0];
    this.retryable = options.retryable ?? this.status >= 500;
  }
}

interface RunRow extends QueryResultRow {
  id: string;
  status: string;
}

export interface CandidateEvidenceRow extends QueryResultRow {
  id: string;
  name: string;
  city: string | null;
  organization_number: string | null;
  source_uri: string | null;
  nace_code: string | null;
  nace_description: string | null;
  employee_count: number | null;
  registered_in_vat_register: boolean | null;
  observation_origin:
    | "provider_observation"
    | "rolling_deploy_canonical_fallback"
    | "legacy_backfill_current_canonical"
    | null;
  observation_observed_at: string | Date | null;
  observation_captured_at: string | Date | null;
  fit_score: number | null;
  fit_coverage: number | string;
  data_quality_score: number | null;
  data_quality_coverage: number | string;
  evidence: unknown[] | null;
}

interface ReportRow extends QueryResultRow {
  id: string;
  run_id: string;
  skill_key: string;
  skill_version: string;
  status: ReportStatus;
  executive_summary: string | null;
  evidence_coverage: number | string;
  overall_confidence: number | string;
  source_count: number;
  evidence_catalog: unknown;
  conflicts: unknown;
  gaps: unknown;
  provider: string | null;
  model: string | null;
  error_code: string | null;
  error_message: string | null;
  request_hash: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface InsightRow extends QueryResultRow {
  id: string;
  category: string;
  claim_type: string;
  title: string;
  finding: string;
  relevance: string;
  confidence: number | string;
  evidence_coverage: number | string;
  evidence_refs: string[];
  counter_evidence: unknown;
  recommended_action: string;
  experiment: unknown;
  review_status: string;
  reviewed_at: Date | string | null;
}

export interface MarketingEvidenceBundle {
  catalog: MarketingEvidenceItem[];
  coverage: number;
  sourceCount: number;
  gaps: string[];
}

const REPORT_COLUMNS = `
  id::text, run_id::text, skill_key, skill_version, status,
  executive_summary, evidence_coverage, overall_confidence, source_count,
  evidence_catalog, conflicts, gaps, provider, model, error_code,
  error_message, request_hash, created_at, updated_at`;

const INSIGHT_COLUMNS = `
  id::text, category, claim_type, title, finding, relevance, confidence,
  evidence_coverage, evidence_refs, counter_evidence, recommended_action,
  experiment, review_status, reviewed_at`;

function numberValue(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hashValue(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function reportRequestHash(runId: string): string {
  return hashValue({
    run_id: runId,
    skill_key: MARKETING_DISCOVERY_SKILL_KEY,
    skill_version: MARKETING_DISCOVERY_SKILL_VERSION,
  });
}

function forbiddenEvidenceKey(value: string): boolean {
  return /(e-?mail|epost|phone|telefon|contact|kontakt|person)/i.test(value);
}

function containsContactPII(
  label: string,
  reference: string | null,
  value: string,
): boolean {
  const searchable = `${label} ${reference ?? ""} ${value}`;
  if (forbiddenEvidenceKey(searchable)) return true;
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)) return true;
  return /(?:^|\D)\+?\d(?:[\d\s().-]{6,})\d(?:\D|$)/.test(value);
}

function countBy(
  rows: CandidateEvidenceRow[],
  value: (row: CandidateEvidenceRow) => string | null,
): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = value(row)?.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nb"))
    .slice(0, 5);
}

/** Builds a bounded, PII-filtered and deterministically referenced catalog. */
export function buildMarketingEvidenceCatalog(
  rows: CandidateEvidenceRow[],
): MarketingEvidenceBundle {
  const catalog: MarketingEvidenceItem[] = [];
  const dedupe = new Set<string>();
  const sources = new Set<string>();

  const add = (item: Omit<MarketingEvidenceItem, "id">): void => {
    if (!item.value.trim() || catalog.length >= 160) return;
    const signature = [
      item.kind,
      item.candidate_id,
      item.label,
      item.value,
      item.source,
      item.source_ref,
    ].join("|");
    if (dedupe.has(signature)) return;
    dedupe.add(signature);
    sources.add(item.source);
    catalog.push({
      id: `E${String(catalog.length + 1).padStart(3, "0")}`,
      ...item,
    });
  };

  const fitRows = rows.filter((row) => row.fit_score !== null);
  const avgFit =
    fitRows.reduce((sum, row) => sum + numberValue(row.fit_score), 0) /
    Math.max(1, fitRows.length);
  const averageCoverage =
    rows.reduce(
      (sum, row) =>
        sum +
        (numberValue(row.fit_coverage) +
          numberValue(row.data_quality_coverage)) /
          2,
      0,
    ) / Math.max(1, rows.length);
  const approximateRows = rows.filter(
    (row) => row.observation_origin !== "provider_observation",
  ).length;
  const provenanceReliability =
    rows.length === 0 ? 1 : 1 - (approximateRows / rows.length) * 0.25;
  const evidenceCoverage = averageCoverage * provenanceReliability;

  add({
    kind: "aggregate",
    candidate_id: null,
    candidate_name: null,
    label: "Antall analyserte kandidater",
    value: String(rows.length),
    source: "leadgrid.discovery.aggregate",
    source_uri: null,
    source_ref: "discovery.candidate_count",
  });
  if (fitRows.length > 0) {
    add({
      kind: "aggregate",
      candidate_id: null,
      candidate_name: null,
      label: "Gjennomsnittlig ICP-match",
      value: `${Math.round(avgFit)} av 100`,
      source: "leadgrid.discovery.aggregate",
      source_uri: null,
      source_ref: "discovery.average_fit_score",
    });
  }
  add({
    kind: "aggregate",
    candidate_id: null,
    candidate_name: null,
    label: "Gjennomsnittlig evidensdekning",
    value: `${Math.round(averageCoverage * 100)} %`,
    source: "leadgrid.discovery.aggregate",
    source_uri: null,
    source_ref: "discovery.average_evidence_coverage",
  });
  add({
    kind: "aggregate",
    candidate_id: null,
    candidate_name: null,
    label: "Observasjonsgrunnlag",
    value:
      approximateRows === 0
        ? `${rows.length} av ${rows.length} kandidater har direkte run-lokal observasjon.`
        : `${rows.length - approximateRows} direkte og ${approximateRows} approksimerte observasjoner.`,
    source: "leadgrid.discovery.provenance",
    source_uri: null,
    source_ref: "discovery.observation_origin",
  });
  for (const [industry, count] of countBy(
    rows,
    (row) => row.nace_description ?? row.nace_code,
  )) {
    add({
      kind: "aggregate",
      candidate_id: null,
      candidate_name: null,
      label: "Bransjefordeling",
      value: `${industry}: ${count} av ${rows.length}`,
      source: "leadgrid.discovery.aggregate",
      source_uri: null,
      source_ref: "discovery.industry_distribution",
    });
  }
  for (const [city, count] of countBy(rows, (row) => row.city)) {
    add({
      kind: "aggregate",
      candidate_id: null,
      candidate_name: null,
      label: "Geografisk fordeling",
      value: `${city}: ${count} av ${rows.length}`,
      source: "leadgrid.discovery.aggregate",
      source_uri: null,
      source_ref: "discovery.city_distribution",
    });
  }

  for (const row of rows) {
    const approximate = row.observation_origin !== "provider_observation";
    const base = {
      kind: "candidate" as const,
      candidate_id: row.id,
      candidate_name: row.name,
      source: approximate
        ? "Brønnøysundregistrene (approksimert historikk)"
        : "Brønnøysundregistrene",
      source_uri: row.source_uri,
    };
    const facts: Array<[string, unknown, string]> = [
      [
        "Organisasjonsnummer",
        row.organization_number,
        "brreg.organization_number",
      ],
      ["Bransje", row.nace_description ?? row.nace_code, "brreg.nace_code"],
      ["Sted", row.city, "brreg.business_address"],
      ["Ansatte", row.employee_count, "brreg.employee_count"],
      [
        "MVA-registrert",
        row.registered_in_vat_register === null
          ? null
          : row.registered_in_vat_register
            ? "Ja"
            : "Nei",
        "brreg.vat_status",
      ],
      [
        "ICP-match",
        row.fit_score === null ? null : `${row.fit_score} av 100`,
        "discovery.fit_score",
      ],
    ];
    for (const [label, raw, ref] of facts) {
      if (raw === null || raw === undefined) continue;
      add({
        ...base,
        label: `${row.name} – ${label}`,
        value: String(raw),
        source_ref: ref,
      });
    }
    for (const raw of Array.isArray(row.evidence) ? row.evidence : []) {
      const evidence = objectValue(raw);
      const label = String(
        evidence.label ?? evidence.factor ?? "Dokumentert signal",
      ).trim();
      const value = String(evidence.value ?? "").trim();
      const source = String(evidence.source ?? "Leadgrid Discovery").trim();
      const reference =
        String(evidence.ref ?? evidence.factor ?? "").trim() || null;
      if (!value || containsContactPII(label, reference, value)) continue;
      add({
        ...base,
        label: `${row.name} – ${label}`,
        value,
        source,
        source_ref: reference,
      });
    }
  }

  const gaps: string[] = [];
  const missingNace = rows.filter(
    (row) => !row.nace_code && !row.nace_description,
  ).length;
  const missingEmployees = rows.filter(
    (row) => row.employee_count === null,
  ).length;
  const missingCity = rows.filter((row) => !row.city).length;
  if (missingNace > 0)
    gaps.push(`${missingNace} kandidater mangler bransjekode.`);
  if (missingEmployees > 0) {
    gaps.push(`${missingEmployees} kandidater mangler ansattdata.`);
  }
  if (missingCity > 0) gaps.push(`${missingCity} kandidater mangler sted.`);
  if (averageCoverage < 0.5) {
    gaps.push("Datagrunnlaget har under 50 % gjennomsnittlig evidensdekning.");
  }
  if (approximateRows > 0) {
    gaps.push(
      `${approximateRows} kandidater bruker eksplisitt merket tilbakefylt eller kompatibilitetsbasert observasjon; tidsfølsomme konklusjoner må verifiseres på nytt.`,
    );
  }
  return {
    catalog,
    coverage: Math.max(0, Math.min(1, evidenceCoverage)),
    sourceCount: sources.size,
    gaps,
  };
}

function refs(
  bundle: MarketingEvidenceBundle,
  sourceRef: string,
  fallback = true,
): string[] {
  const matches = bundle.catalog
    .filter((item) => item.source_ref === sourceRef)
    .slice(0, 8)
    .map((item) => item.id);
  if (matches.length > 0 || !fallback) return matches;
  return bundle.catalog.slice(0, 1).map((item) => item.id);
}

function topDistribution(
  bundle: MarketingEvidenceBundle,
  sourceRef: string,
): { label: string; count: number; total: number } | null {
  const item = bundle.catalog.find((entry) => entry.source_ref === sourceRef);
  if (!item) return null;
  const match = item.value.match(/^(.*): (\d+) av (\d+)$/);
  if (!match) return null;
  return { label: match[1], count: Number(match[2]), total: Number(match[3]) };
}

/** Pure, versioned skill executor. It never invents data beyond catalog IDs. */
export function executeMarketingDiscoverySkill(
  rows: CandidateEvidenceRow[],
  bundle: MarketingEvidenceBundle,
): MarketingIntelligenceOutput {
  const averageFit =
    rows
      .filter((row) => row.fit_score !== null)
      .reduce((sum, row) => {
        return sum + numberValue(row.fit_score);
      }, 0) / Math.max(1, rows.filter((row) => row.fit_score !== null).length);
  const highFit = rows.filter((row) => numberValue(row.fit_score) >= 70).length;
  const industry = topDistribution(bundle, "discovery.industry_distribution");
  const city = topDistribution(bundle, "discovery.city_distribution");
  const confidence = Math.max(
    0.2,
    Math.min(0.95, (bundle.coverage + Math.min(1, rows.length / 10)) / 2),
  );
  const counterEvidence = bundle.gaps.slice(0, 3);
  const insights: MarketingIntelligenceOutput["insights"] = [];

  insights.push({
    category: "audience",
    claim_type: "fact",
    title: "Analysert målgruppegrunnlag",
    finding: `Rapporten bygger på ${rows.length} dokumenterte kandidater fra denne Discovery-kjøringen.`,
    relevance:
      "Dette avgrenser hvilke virksomheter konklusjonene faktisk gjelder for.",
    confidence: Math.min(0.99, Math.max(0.7, confidence)),
    evidence_coverage: bundle.coverage,
    evidence_refs: refs(bundle, "discovery.candidate_count"),
    counter_evidence: counterEvidence,
    recommended_action:
      "Bruk funnene på dette segmentet, og unngå å generalisere til hele markedet.",
    experiment: null,
  });

  insights.push({
    category: "risk",
    claim_type: "fact",
    title: "Kvaliteten på beslutningsgrunnlaget",
    finding: `Gjennomsnittlig evidensdekning er ${Math.round(bundle.coverage * 100)} prosent.`,
    relevance:
      "Dekningen bestemmer hvor hardt markedsføreren kan prioritere budskap, målgruppe og budsjett.",
    confidence: 0.98,
    evidence_coverage: bundle.coverage,
    evidence_refs: refs(bundle, "discovery.average_evidence_coverage"),
    counter_evidence: counterEvidence,
    recommended_action:
      bundle.coverage >= 0.6
        ? "Bruk rapporten som prioriteringsgrunnlag, men valider hypotesene i kampanjer."
        : "Berik kandidatene før større budsjettbeslutninger eller brede kampanjer.",
    experiment: null,
  });

  if (rows.some((row) => row.fit_score !== null)) {
    insights.push({
      category: "opportunity",
      claim_type: "inference",
      title: "Prioriterbar ICP-kjerne",
      finding: `${highFit} av ${rows.length} kandidater har minst 70 i dokumentert ICP-match; gjennomsnittet er ${Math.round(averageFit)}.`,
      relevance:
        "Den best dokumenterte kjernen er et bedre startpunkt for budskapstesting enn hele kandidatlisten.",
      confidence,
      evidence_coverage: bundle.coverage,
      evidence_refs: [
        ...refs(bundle, "discovery.average_fit_score", false),
        ...refs(bundle, "discovery.fit_score", false),
      ].slice(0, 8),
      counter_evidence: counterEvidence,
      recommended_action:
        "Bygg første målgruppe av kandidatene med minst 70 i match og sammenlign mot resten.",
      experiment: {
        hypothesis:
          "Høy-match-segmentet responderer bedre enn den øvrige kandidatgruppen.",
        action:
          "Kjør samme tilbud og budskap mot høy-match og kontrollsegment.",
        metric: "Positiv responsrate",
        success_criterion:
          "Minst 25 prosent høyere respons i høy-match-segmentet.",
        duration_days: 21,
      },
    });
  }

  if (industry) {
    const share = Math.round(
      (industry.count / Math.max(1, industry.total)) * 100,
    );
    insights.push({
      category: "positioning",
      claim_type: "inference",
      title: `Tydeligste bransjeklynge: ${industry.label}`,
      finding: `${industry.count} av ${industry.total} kandidater (${share} prosent) ligger i den største dokumenterte bransjeklyngen.`,
      relevance:
        "En konkret bransjeklynge gjør det mulig å teste et mer presist problem- og verdibudskap.",
      confidence,
      evidence_coverage: bundle.coverage,
      evidence_refs: refs(bundle, "discovery.industry_distribution"),
      counter_evidence: counterEvidence,
      recommended_action: `Lag én budskapsvariant eksplisitt for ${industry.label} og behold en generell kontrollvariant.`,
      experiment: {
        hypothesis:
          "Bransjespesifikt budskap gir høyere relevant respons enn et generelt budskap.",
        action:
          "Test bransjespesifikk landingsside eller e-post mot en generell variant.",
        metric: "Kvalifisert responsrate",
        success_criterion:
          "Minst 20 prosent relativ forbedring mot kontrollvarianten.",
        duration_days: 21,
      },
    });
  }

  if (city) {
    const share = Math.round((city.count / Math.max(1, city.total)) * 100);
    insights.push({
      category: "channels",
      claim_type: "hypothesis",
      title: `Geografisk test i ${city.label}`,
      finding: `${city.count} av ${city.total} kandidater (${share} prosent) er dokumentert i den største stedsklyngen.`,
      relevance:
        "Geografisk konsentrasjon kan gjøre en avgrenset lokal kampanjetest billigere og lettere å måle.",
      confidence: Math.min(confidence, 0.72),
      evidence_coverage: bundle.coverage,
      evidence_refs: refs(bundle, "discovery.city_distribution"),
      counter_evidence: [
        "Sted viser hvor virksomheten er registrert, ikke hvilken kanal som vil prestere best.",
        ...counterEvidence,
      ].slice(0, 8),
      recommended_action: `Test en avgrenset lokal aktivering i ${city.label} før nasjonal utrulling.`,
      experiment: {
        hypothesis:
          "En lokal variant gir flere kvalifiserte responser per krone enn en bred variant.",
        action:
          "Kjør lokal og bred målgruppe med likt budskap og separat sporing.",
        metric: "Kostnad per kvalifisert respons",
        success_criterion:
          "Lokal variant er minst 15 prosent mer kostnadseffektiv.",
        duration_days: 14,
      },
    });
  }

  if (insights.length < 3) {
    insights.push({
      category: "experiment",
      claim_type: "hypothesis",
      title: "Valider segmentet før skalering",
      finding:
        "Datagrunnlaget beskriver kandidatene, men dokumenterer ikke respons på budskap eller kanal.",
      relevance:
        "En kontrollert test skiller markedsfakta fra antakelser før budsjettet skaleres.",
      confidence: 0.55,
      evidence_coverage: bundle.coverage,
      evidence_refs: refs(bundle, "discovery.candidate_count"),
      counter_evidence: counterEvidence,
      recommended_action:
        "Kjør en liten pilot med tydelig kontrollgruppe og registrer respons som nytt evidensgrunnlag.",
      experiment: {
        hypothesis:
          "Det valgte segmentet responderer på det foreslåtte verdibudskapet.",
        action:
          "Kontakt et avgrenset kandidatsett og sammenlign med en kontrollgruppe.",
        metric: "Kvalifisert responsrate",
        success_criterion:
          "Minst 10 prosent kvalifisert respons og bedre enn kontrollgruppen.",
        duration_days: 14,
      },
    });
  }

  const output: MarketingIntelligenceOutput = {
    executive_summary: `Denne versjonerte analysen gjelder ${rows.length} kandidater i den valgte Discovery-kjøringen. Den skiller observerte fakta fra analyser og testbare hypoteser; samlet evidensdekning er ${Math.round(bundle.coverage * 100)} prosent.`,
    overall_confidence: confidence,
    conflicts: [],
    gaps: bundle.gaps,
    insights: insights.slice(0, 12),
  };
  return validateMarketingIntelligenceOutput(
    output,
    new Set(bundle.catalog.map((item) => item.id)),
  );
}

function toInsightDto(row: InsightRow): MarketingIntelligenceInsightDto {
  return {
    id: row.id,
    category: row.category,
    claim_type: row.claim_type,
    title: row.title,
    finding: row.finding,
    relevance: row.relevance,
    confidence: numberValue(row.confidence),
    evidence_coverage: numberValue(row.evidence_coverage),
    evidence_refs: row.evidence_refs ?? [],
    counter_evidence: stringArray(row.counter_evidence),
    recommended_action: row.recommended_action,
    experiment:
      row.experiment && typeof row.experiment === "object"
        ? (row.experiment as MarketingIntelligenceExperimentDto)
        : null,
    review_status: row.review_status,
    reviewed_at: iso(row.reviewed_at),
  };
}

function reportDto(
  row: ReportRow,
  insights: InsightRow[],
): MarketingIntelligenceReportDto {
  return {
    id: row.id,
    run_id: row.run_id,
    skill_key: row.skill_key,
    skill_version: row.skill_version,
    status: row.status,
    executive_summary: row.executive_summary,
    evidence_coverage: numberValue(row.evidence_coverage),
    overall_confidence: numberValue(row.overall_confidence),
    source_count: row.source_count,
    evidence_catalog: Array.isArray(row.evidence_catalog)
      ? (row.evidence_catalog as MarketingEvidenceItem[])
      : [],
    conflicts: stringArray(row.conflicts),
    gaps: stringArray(row.gaps),
    provider: row.provider,
    model: row.model,
    error_code: row.error_code,
    error_message: row.error_message,
    insights: insights.map(toInsightDto),
    created_at: iso(row.created_at) as string,
    updated_at: iso(row.updated_at) as string,
  };
}

async function loadReport(
  queryable: Pool | PoolClient,
  input: {
    project: LeadgridAccessibleProject;
    runId: string;
    reportId?: string;
    idempotencyKey?: string;
  },
): Promise<MarketingIntelligenceReportDto | null> {
  const params: unknown[] = [
    input.project.organizationId,
    input.project.id,
    input.runId,
  ];
  const conditions = [
    "organization_id = $1::uuid",
    "project_id = $2",
    "run_id = $3::uuid",
  ];
  if (input.reportId) {
    params.push(input.reportId);
    conditions.push(`id = $${params.length}::uuid`);
  }
  if (input.idempotencyKey) {
    params.push(input.idempotencyKey);
    conditions.push(`idempotency_key = $${params.length}`);
  }
  const reportResult = await queryable.query<ReportRow>(
    `SELECT ${REPORT_COLUMNS}
       FROM leadgrid_discovery_intelligence_reports
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    params,
  );
  const report = reportResult.rows[0];
  if (!report) return null;
  const insightResult = await queryable.query<InsightRow>(
    `SELECT ${INSIGHT_COLUMNS}
       FROM leadgrid_discovery_intelligence_insights
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND report_id = $3::uuid
      ORDER BY sort_order, id`,
    [input.project.organizationId, input.project.id, report.id],
  );
  return reportDto(report, insightResult.rows);
}

async function loadRunAndCandidates(
  pool: Pool,
  project: LeadgridAccessibleProject,
  runId: string,
): Promise<{ run: RunRow; candidates: CandidateEvidenceRow[] }> {
  const runResult = await pool.query<RunRow>(
    `SELECT id::text, status
       FROM leadgrid_discovery_runs
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND id = $3::uuid
      LIMIT 1`,
    [project.organizationId, project.id, runId],
  );
  const run = runResult.rows[0];
  if (!run) throw new MarketingIntelligenceError("not_found");
  if (!["review_ready", "completed", "partial"].includes(run.status)) {
    throw new MarketingIntelligenceError("run_not_ready");
  }
  const candidateResult = await pool.query<CandidateEvidenceRow>(
    `SELECT c.id::text,
            COALESCE(
              NULLIF(rc.observation_snapshot->>'name', ''),
              'Ukjent virksomhet'
            ) AS name,
            NULLIF(rc.observation_snapshot->>'city', '') AS city,
            NULLIF(
              rc.observation_snapshot->>'organization_number',
              ''
            ) AS organization_number,
            rc.observation_snapshot->>'snapshot_origin'
              AS observation_origin,
            rc.observation_snapshot->>'observed_at'
              AS observation_observed_at,
            rc.observation_snapshot->>'captured_at'
              AS observation_captured_at,
            observation.raw_data->>'source_uri' AS source_uri,
            observation.raw_data->>'nace_code' AS nace_code,
            observation.raw_data->>'nace_description' AS nace_description,
            CASE WHEN jsonb_typeof(observation.raw_data->'employee_count') = 'number'
              THEN (observation.raw_data->>'employee_count')::int ELSE NULL END
              AS employee_count,
            CASE WHEN jsonb_typeof(observation.raw_data->'registered_in_vat_register') = 'boolean'
              THEN (observation.raw_data->>'registered_in_vat_register')::boolean
              ELSE NULL END AS registered_in_vat_register,
            rc.fit_score, rc.fit_coverage, rc.data_quality_score,
            rc.data_quality_coverage, rc.evidence
       FROM leadgrid_discovery_run_candidates rc
       JOIN leadgrid_discovery_candidates c
        ON c.id = rc.candidate_id
        AND c.organization_id = rc.organization_id
        AND c.project_id = rc.project_id
       LEFT JOIN LATERAL (
         SELECT CASE
           WHEN jsonb_typeof(rc.observation_snapshot->'raw_data') = 'object'
             THEN rc.observation_snapshot->'raw_data'
           ELSE '{}'::jsonb
         END AS raw_data
       ) observation ON TRUE
      WHERE rc.organization_id = $1::uuid
        AND rc.project_id = $2
        AND rc.run_id = $3::uuid
        AND rc.excluded = FALSE
        AND rc.disposition NOT IN ('excluded', 'duplicate', 'failed', 'rejected')
      ORDER BY rc.fit_score DESC NULLS LAST,
               rc.data_quality_score DESC NULLS LAST,
               rc.candidate_id
      LIMIT 60`,
    [project.organizationId, project.id, runId],
  );
  return { run, candidates: candidateResult.rows };
}

async function withTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function generateMarketingIntelligence(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    runId: string;
    userId: string;
    idempotencyKey: string;
  },
): Promise<{ report: MarketingIntelligenceReportDto; replayed: boolean }> {
  const hash = reportRequestHash(input.runId);
  const replay = await loadReport(pool, {
    project: input.project,
    runId: input.runId,
    idempotencyKey: input.idempotencyKey,
  });
  if (replay) {
    const hashResult = await pool.query<{ request_hash: string }>(
      `SELECT request_hash
         FROM leadgrid_discovery_intelligence_reports
        WHERE organization_id = $1::uuid AND project_id = $2
          AND run_id = $3::uuid AND idempotency_key = $4`,
      [
        input.project.organizationId,
        input.project.id,
        input.runId,
        input.idempotencyKey,
      ],
    );
    if (hashResult.rows[0]?.request_hash !== hash) {
      throw new MarketingIntelligenceError("idempotency_conflict");
    }
    if (["ready", "insufficient_evidence"].includes(replay.status)) {
      return { report: replay, replayed: true };
    }
  }

  const { candidates } = await loadRunAndCandidates(
    pool,
    input.project,
    input.runId,
  );
  const evidence = buildMarketingEvidenceCatalog(candidates);
  const gaps = [...evidence.gaps];
  if (candidates.length < MIN_CANDIDATES) {
    gaps.push(`Minst ${MIN_CANDIDATES} kandidater kreves for mønsteranalyse.`);
  }
  if (evidence.catalog.length < MIN_EVIDENCE_ITEMS) {
    gaps.push(`Minst ${MIN_EVIDENCE_ITEMS} evidansepunkter kreves.`);
  }
  if (evidence.coverage < MIN_EVIDENCE_COVERAGE) {
    gaps.push("Evidensdekningen er for lav til forsvarlige anbefalinger.");
  }
  const insufficient =
    candidates.length < MIN_CANDIDATES ||
    evidence.catalog.length < MIN_EVIDENCE_ITEMS ||
    evidence.coverage < MIN_EVIDENCE_COVERAGE;
  const output = insufficient
    ? null
    : executeMarketingDiscoverySkill(candidates, { ...evidence, gaps });

  try {
    return await withTransaction(pool, async (client) => {
      // Older deployments could leave an autocommitted shell before its
      // insight transaction started. New reports are atomic; recover only
      // those terminal legacy shells that match this exact request.
      await client.query(
        `DELETE FROM leadgrid_discovery_intelligence_reports
          WHERE organization_id = $1::uuid AND project_id = $2
            AND run_id = $3::uuid AND idempotency_key = $4
            AND request_hash = $5
            AND status IN ('generating', 'failed')`,
        [
          input.project.organizationId,
          input.project.id,
          input.runId,
          input.idempotencyKey,
          hash,
        ],
      );

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO leadgrid_discovery_intelligence_reports
           (organization_id, project_id, run_id, skill_key, skill_version,
            status, executive_summary, evidence_coverage, overall_confidence,
            source_count, evidence_catalog, conflicts, gaps, provider, model,
            requested_by, generated_by, idempotency_key, request_hash)
         VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10,
                 $11::jsonb, $12::jsonb, $13::jsonb, 'leadgrid',
                 'deterministic-evidence-v1', $14, $14, $15, $16)
         ON CONFLICT (organization_id, project_id, run_id, idempotency_key)
         DO NOTHING
         RETURNING id::text`,
        [
          input.project.organizationId,
          input.project.id,
          input.runId,
          MARKETING_DISCOVERY_SKILL_KEY,
          MARKETING_DISCOVERY_SKILL_VERSION,
          insufficient ? "insufficient_evidence" : "ready",
          output?.executive_summary ?? null,
          evidence.coverage,
          output?.overall_confidence ?? 0,
          evidence.sourceCount,
          JSON.stringify(evidence.catalog),
          JSON.stringify(output?.conflicts ?? []),
          JSON.stringify(output?.gaps ?? gaps),
          input.userId,
          input.idempotencyKey,
          hash,
        ],
      );

      if (!inserted.rows[0]) {
        const concurrentHash = await client.query<{
          request_hash: string;
          status: ReportStatus;
        }>(
          `SELECT request_hash, status
             FROM leadgrid_discovery_intelligence_reports
            WHERE organization_id = $1::uuid AND project_id = $2
              AND run_id = $3::uuid AND idempotency_key = $4`,
          [
            input.project.organizationId,
            input.project.id,
            input.runId,
            input.idempotencyKey,
          ],
        );
        const existing = concurrentHash.rows[0];
        if (existing?.request_hash !== hash) {
          throw new MarketingIntelligenceError("idempotency_conflict");
        }
        if (
          !existing ||
          !["ready", "insufficient_evidence"].includes(existing.status)
        ) {
          throw new MarketingIntelligenceError("generation_failed", {
            retryable: true,
          });
        }
        const concurrentReplay = await loadReport(client, {
          project: input.project,
          runId: input.runId,
          idempotencyKey: input.idempotencyKey,
        });
        if (!concurrentReplay) {
          throw new MarketingIntelligenceError("generation_failed");
        }
        return { report: concurrentReplay, replayed: true };
      }

      const reportId = inserted.rows[0].id;
      if (output) {
        for (const [index, insight] of output.insights.entries()) {
          await client.query(
            `INSERT INTO leadgrid_discovery_intelligence_insights
             (organization_id, project_id, report_id, category, claim_type,
              title, finding, relevance, confidence, evidence_coverage,
              evidence_refs, counter_evidence, recommended_action,
              experiment, sort_order)
           VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10,
                   $11::text[], $12::jsonb, $13, $14::jsonb, $15)`,
            [
              input.project.organizationId,
              input.project.id,
              reportId,
              insight.category,
              insight.claim_type,
              insight.title,
              insight.finding,
              insight.relevance,
              insight.confidence,
              insight.evidence_coverage,
              insight.evidence_refs,
              JSON.stringify(insight.counter_evidence),
              insight.recommended_action,
              insight.experiment ? JSON.stringify(insight.experiment) : null,
              index,
            ],
          );
        }
      }

      const report = await loadReport(client, {
        project: input.project,
        runId: input.runId,
        reportId,
      });
      if (!report) throw new MarketingIntelligenceError("generation_failed");
      return { report, replayed: false };
    });
  } catch (error) {
    if (error instanceof MarketingIntelligenceError) throw error;
    throw new MarketingIntelligenceError("generation_failed", {
      retryable: true,
    });
  }
}

export async function getMarketingIntelligence(
  pool: Pool,
  input: { project: LeadgridAccessibleProject; runId: string },
): Promise<MarketingIntelligenceReportDto> {
  const report = await loadReport(pool, input);
  if (!report) throw new MarketingIntelligenceError("not_found");
  return report;
}

export async function reviewMarketingIntelligenceInsight(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    runId: string;
    reportId: string;
    insightId: string;
    userId: string;
    idempotencyKey: string;
    feedback: MarketingIntelligenceFeedback;
  },
): Promise<{ insight: MarketingIntelligenceInsightDto; replayed: boolean }> {
  const hash = hashValue({
    run_id: input.runId,
    report_id: input.reportId,
    insight_id: input.insightId,
    feedback: input.feedback,
  });
  return withTransaction(pool, async (client) => {
    const insightResult = await client.query<InsightRow>(
      `SELECT ${INSIGHT_COLUMNS}
         FROM leadgrid_discovery_intelligence_insights i
         JOIN leadgrid_discovery_intelligence_reports r
           ON r.id = i.report_id
          AND r.organization_id = i.organization_id
          AND r.project_id = i.project_id
        WHERE i.organization_id = $1::uuid AND i.project_id = $2
          AND r.run_id = $3::uuid AND i.report_id = $4::uuid
          AND i.id = $5::uuid
        FOR UPDATE OF i`,
      [
        input.project.organizationId,
        input.project.id,
        input.runId,
        input.reportId,
        input.insightId,
      ],
    );
    const current = insightResult.rows[0];
    if (!current) throw new MarketingIntelligenceError("not_found");

    const replayResult = await client.query<{ request_hash: string }>(
      `SELECT request_hash
         FROM leadgrid_discovery_intelligence_feedback
        WHERE organization_id = $1::uuid AND project_id = $2
          AND report_id = $3::uuid AND idempotency_key = $4
        LIMIT 1`,
      [
        input.project.organizationId,
        input.project.id,
        input.reportId,
        input.idempotencyKey,
      ],
    );
    if (replayResult.rows[0]) {
      if (replayResult.rows[0].request_hash !== hash) {
        throw new MarketingIntelligenceError("idempotency_conflict");
      }
      return { insight: toInsightDto(current), replayed: true };
    }

    const correction = input.feedback.correction ?? {};
    const reviewStatus =
      input.feedback.decision === "accept"
        ? "accepted"
        : input.feedback.decision === "reject"
          ? "rejected"
          : "corrected";
    await client.query(
      `INSERT INTO leadgrid_discovery_intelligence_feedback
         (organization_id, project_id, report_id, insight_id, decision,
          reason_code, note, correction, actor_user_id,
          idempotency_key, request_hash)
       VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5, $6, $7,
               $8::jsonb, $9, $10, $11)`,
      [
        input.project.organizationId,
        input.project.id,
        input.reportId,
        input.insightId,
        input.feedback.decision,
        input.feedback.reason_code ?? null,
        input.feedback.note ?? null,
        JSON.stringify(
          input.feedback.decision === "correct"
            ? {
                before: {
                  title: current.title,
                  finding: current.finding,
                  relevance: current.relevance,
                  recommended_action: current.recommended_action,
                },
                after: correction,
              }
            : {},
        ),
        input.userId,
        input.idempotencyKey,
        hash,
      ],
    );
    const updated = await client.query<InsightRow>(
      `UPDATE leadgrid_discovery_intelligence_insights
          SET title = COALESCE($5, title),
              finding = COALESCE($6, finding),
              relevance = COALESCE($7, relevance),
              recommended_action = COALESCE($8, recommended_action),
              review_status = $9, reviewed_by = $10,
              reviewed_at = NOW(), updated_at = NOW()
        WHERE organization_id = $1::uuid AND project_id = $2
          AND report_id = $3::uuid AND id = $4::uuid
        RETURNING ${INSIGHT_COLUMNS}`,
      [
        input.project.organizationId,
        input.project.id,
        input.reportId,
        input.insightId,
        correction.title ?? null,
        correction.finding ?? null,
        correction.relevance ?? null,
        correction.recommended_action ?? null,
        reviewStatus,
        input.userId,
      ],
    );
    const insight = updated.rows[0];
    if (!insight) throw new MarketingIntelligenceError("not_found");
    return { insight: toInsightDto(insight), replayed: false };
  });
}
