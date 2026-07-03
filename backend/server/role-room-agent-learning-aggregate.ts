// =============================================================================
// Lag 1 — aggregering av produsent-feedback til lærte forslag (F9-loopen).
//
// Ren, testbar «hjerne»: tar rå felt-feedback-rader (fra
// role_room_agent_field_feedback) og produserer override-FORSLAG som den
// nattlige jobben skriver til role_room_agent_learned_overrides med
// status='proposed'. Et menneske godkjenner før runtime bruker dem
// (human-in-the-loop). Ingen I/O, ingen DB — kun tallknusing.
//
// Første skive dekker de to best-strukturerte signalene:
//   1. NACE → businessModel: hvilken forretningsmodell produsenter faktisk
//      ender på per NACE-kode (avdekker feil i den deterministiske
//      NACE-tabellen fra F1).
//   2. Confidence-kalibrering: faktisk aksept-rate per confidence-bøtte, så
//      UI-ets «hvorfor»-tall kan speile virkeligheten.
// Diagnostikk: aksept-rate per felt (hvor AI-en oftest tar feil).
// =============================================================================

export type FieldFeedbackAction = "accepted" | "edited" | "cleared";

export interface FieldFeedbackRow {
  fieldPath: string;
  action: FieldFeedbackAction;
  aiValue: string | null;
  finalValue: string | null;
  naceCode: string | null;
  businessModel: string | null;
  geoScope: string | null;
  sourceChain: string[] | null;
  confidence: number | null;
}

export type OverrideType = "nace_business_model" | "confidence_calibration";

export interface OverrideProposal {
  overrideType: OverrideType;
  overrideKey: string;
  proposedValue: string;
  sampleCount: number;
  /** 0-100: andel av samples som støtter proposedValue. */
  agreementPct: number;
  rationale: string;
}

export interface FieldAcceptanceStat {
  fieldPath: string;
  sampleCount: number;
  /** 0-100: andel 'accepted' (ikke redigert/fjernet). */
  acceptanceRate: number;
}

export interface AggregateOptions {
  /** Minste antall samples før et forslag genereres. Beskytter mot støy. */
  minSamples?: number;
  /** Minste enighet (0-100) før et forslag genereres. */
  minAgreementPct?: number;
}

const DEFAULTS = { minSamples: 8, minAgreementPct: 70 };

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Den verdien produsenten endte på for et felt: redigert/ny verdi når den
 *  finnes, ellers AI-verdien (accepted). 'cleared' gir ingen effektiv verdi. */
function effectiveValue(row: FieldFeedbackRow): string | null {
  if (row.action === "cleared") return null;
  if (row.action === "edited") return hasText(row.finalValue) ? row.finalValue.trim() : null;
  // accepted
  return hasText(row.finalValue) ? row.finalValue.trim() : hasText(row.aiValue) ? row.aiValue.trim() : null;
}

/** Normaliser en businessModel-streng til kanonisk form for gruppering. */
function canonicalModel(value: string | null): string | null {
  if (!hasText(value)) return null;
  const v = value.toUpperCase().replace(/\s+/g, "");
  if (v === "B2B/B2C" || v === "B2CB2B" || v === "B2B&B2C") return "B2B/B2C";
  if (v === "B2C") return "B2C";
  if (v === "B2B") return "B2B";
  return null;
}

/** Modal-verdi + antall som støtter den, fra en liste. */
function modal<T>(values: T[]): { value: T; count: number } | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: { value: T; count: number } | null = null;
  for (const [value, count] of counts) {
    if (!best || count > best.count) best = { value, count };
  }
  return best;
}

/**
 * NACE → businessModel-forslag. For hver NACE-kode med nok samples der
 * feltet er companyProfile.businessModel, finn den modale effektive
 * forretningsmodellen produsenter ender på. Foreslå den når enighet + antall
 * passerer terskelen. (Om forslaget matcher den nåværende deterministiske
 * verdien er det en no-op ved apply — filtreres av den som anvender.)
 */
export function aggregateNaceBusinessModel(
  rows: FieldFeedbackRow[],
  options: AggregateOptions = {},
): OverrideProposal[] {
  const minSamples = options.minSamples ?? DEFAULTS.minSamples;
  const minAgreementPct = options.minAgreementPct ?? DEFAULTS.minAgreementPct;

  const byNace = new Map<string, string[]>();
  for (const row of rows) {
    if (row.fieldPath !== "companyProfile.businessModel") continue;
    if (!hasText(row.naceCode)) continue;
    const model = canonicalModel(effectiveValue(row));
    if (!model) continue;
    const key = row.naceCode.trim();
    const bucket = byNace.get(key) ?? [];
    bucket.push(model);
    byNace.set(key, bucket);
  }

  const proposals: OverrideProposal[] = [];
  for (const [naceCode, models] of byNace) {
    if (models.length < minSamples) continue;
    const top = modal(models);
    if (!top) continue;
    const agreementPct = Math.round((top.count / models.length) * 100);
    if (agreementPct < minAgreementPct) continue;
    proposals.push({
      overrideType: "nace_business_model",
      overrideKey: naceCode,
      proposedValue: top.value,
      sampleCount: models.length,
      agreementPct,
      rationale: `${top.count}/${models.length} produsenter (${agreementPct}%) endte på ${top.value} for NACE ${naceCode}.`,
    });
  }
  // Deterministisk rekkefølge (høyest bevis først) for stabile tester/diff.
  return proposals.sort(
    (a, b) => b.sampleCount - a.sampleCount || a.overrideKey.localeCompare(b.overrideKey),
  );
}

/** Confidence-bøtte-etikett for en 0-100-score. */
export function confidenceBucket(confidence: number): string {
  const c = Math.max(0, Math.min(100, confidence));
  const lo = Math.min(80, Math.floor(c / 20) * 20);
  return `${lo}-${lo + 20}`;
}

/**
 * Confidence-kalibrering: faktisk aksept-rate per confidence-bøtte. Foreslår
 * den observerte aksept-raten som «sann» confidence for bøtta, slik at UI-et
 * kan justere «hvor sikker er dette»-tallet mot virkeligheten.
 */
export function computeConfidenceCalibration(
  rows: FieldFeedbackRow[],
  options: AggregateOptions = {},
): OverrideProposal[] {
  const minSamples = options.minSamples ?? DEFAULTS.minSamples;
  const byBucket = new Map<string, { accepted: number; total: number }>();
  for (const row of rows) {
    if (typeof row.confidence !== "number" || !Number.isFinite(row.confidence)) continue;
    const bucket = confidenceBucket(row.confidence);
    const agg = byBucket.get(bucket) ?? { accepted: 0, total: 0 };
    agg.total += 1;
    if (row.action === "accepted") agg.accepted += 1;
    byBucket.set(bucket, agg);
  }

  const proposals: OverrideProposal[] = [];
  for (const [bucket, agg] of byBucket) {
    if (agg.total < minSamples) continue;
    const rate = Math.round((agg.accepted / agg.total) * 100);
    proposals.push({
      overrideType: "confidence_calibration",
      overrideKey: bucket,
      proposedValue: String(rate),
      sampleCount: agg.total,
      agreementPct: rate,
      rationale: `Confidence-bøtte ${bucket}: ${agg.accepted}/${agg.total} felt ble akseptert uendret (${rate}%).`,
    });
  }
  return proposals.sort((a, b) => a.overrideKey.localeCompare(b.overrideKey));
}

/**
 * Diagnostikk: aksept-rate per felt-sti (hvilke felt AI-en oftest bommer på).
 * Ikke et override-forslag — styrer hvor teamet bør investere.
 */
export function computeFieldAcceptanceRates(rows: FieldFeedbackRow[]): FieldAcceptanceStat[] {
  const byField = new Map<string, { accepted: number; total: number }>();
  for (const row of rows) {
    const agg = byField.get(row.fieldPath) ?? { accepted: 0, total: 0 };
    agg.total += 1;
    if (row.action === "accepted") agg.accepted += 1;
    byField.set(row.fieldPath, agg);
  }
  return Array.from(byField.entries())
    .map(([fieldPath, agg]) => ({
      fieldPath,
      sampleCount: agg.total,
      acceptanceRate: Math.round((agg.accepted / agg.total) * 100),
    }))
    .sort((a, b) => a.acceptanceRate - b.acceptanceRate || b.sampleCount - a.sampleCount);
}
