/**
 * insight-diagnostics.ts — fase 2: «hvorfor skjer det?»
 * (docs/integration-audit/10)
 *
 * For hver ny innsikt bygges en KRYSS-KILDE-EVIDENSBUNT (GEO-signaler,
 * GA4/GSC, søkevolum, beslektede innsikter — koblet via deterministisk
 * tema-overlapp), og et LLM skriver et kort «hvorfor»-narrativ som KUN
 * får uttale seg om bunten:
 *
 *  - Hver evidens-post er nummerert; narrativet MÅ sitere [n] — påstander
 *    uten gyldig sitering forkastes I KODE, ikke på ærens ord.
 *  - Under to uavhengige kilder → ingen tolkning («insufficient_evidence»
 *    lagres så daglig kjøring ikke re-forsøker). Heller stillhet enn
 *    spekulasjon.
 *  - Narrativet merkes som AI-tolkning i UI; evidensen står ved siden av.
 *  - Token-forbruket bokføres (steg 9, operation 'insight-diagnosis').
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Pool } from "pg";
import { topicsOverlap } from "./score-model.js";
import { recordAiUsage } from "./ai-usage.js";

export interface DiagnosisEvidenceItem {
  n: number;
  source: string; // 'geo-probe' | 'ga4' | 'gsc' | 'search-volume' | 'insight'
  label: string;
  value: string | number;
  ref: string;
}

export interface InsightForDiagnosis {
  id: string;
  detector: string;
  title: string;
  explanation: string;
  topic: string | null;
  evidence: Array<{ ref: string; label: string; value: string | number }>;
}

/** Min. uavhengige kilder før vi i det hele tatt spør LLM-en. */
const MIN_DISTINCT_SOURCES = 2;
/** Maks innsikter diagnostisert per kjøring (kostnadstak). */
const MAX_PER_RUN = 10;
const DIAGNOSIS_MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// ─────────────────────────────────────────────────────────────────────
// Evidensbunt: kryss-kilde-fakta for innsiktens tema
// ─────────────────────────────────────────────────────────────────────

export async function buildEvidenceBundle(
  pool: Pool,
  organizationId: string,
  insight: InsightForDiagnosis,
): Promise<DiagnosisEvidenceItem[]> {
  const items: DiagnosisEvidenceItem[] = [];
  let n = 1;

  // 1) Innsiktens egen evidens (detektorens grunnlag)
  for (const e of insight.evidence.slice(0, 4)) {
    items.push({ n: n++, source: "insight", label: e.label, value: e.value, ref: e.ref });
  }

  if (!insight.topic) return items;

  // 2) Signaler på tvers av kilder — to siste målinger per metrikk/subjekt
  const signals = await pool.query<{
    provider: string;
    metric_type: string;
    subject_id: string;
    topic: string;
    metric_value: number;
    collected_at: string;
    id: string;
    is_estimated: boolean;
  }>(
    `SELECT provider, metric_type, subject_id, topic, metric_value,
            collected_at::text, id::text, is_estimated
       FROM (
         SELECT *, ROW_NUMBER() OVER (
                  PARTITION BY provider, metric_type, subject_id, topic
                  ORDER BY collected_at DESC) AS rn
           FROM normalized_signals
          WHERE organization_id = $1::uuid
            AND collected_at > now() - interval '45 days'
       ) s
      WHERE rn <= 2
      ORDER BY metric_type, subject_id, collected_at DESC`,
    [organizationId],
  );

  const sourceOf = (metricType: string, provider: string): string => {
    if (provider.startsWith("geo-probe")) return "geo-probe";
    if (metricType === "ai_referral_sessions") return "ga4";
    if (metricType.startsWith("owned_")) return "gsc";
    if (metricType.startsWith("search_")) return "search-volume";
    return provider;
  };

  for (const row of signals.rows) {
    if (!topicsOverlap(insight.topic, row.topic)) continue;
    if (items.length >= 14) break; // bunten skal være lesbar, ikke uttømmende
    items.push({
      n: n++,
      source: sourceOf(row.metric_type, row.provider),
      label: `${row.metric_type} ${row.subject_id} (${row.topic}, ${row.collected_at.slice(0, 10)})${row.is_estimated ? " [syntetisk]" : " [ekte]"}`,
      value: Number(row.metric_value),
      ref: row.id,
    });
  }

  // 3) Beslektede innsikter siste 30 dager (andre detektorer, samme tema)
  const related = await pool.query<{ id: string; detector: string; title: string }>(
    `SELECT id::text, detector, title FROM insights
      WHERE organization_id = $1::uuid AND id <> $2::uuid
        AND detected_at > now() - interval '30 days'
      ORDER BY detected_at DESC LIMIT 20`,
    [organizationId, insight.id],
  );
  for (const row of related.rows) {
    if (row.detector === insight.detector) continue;
    if (!topicsOverlap(insight.topic, row.title)) continue;
    if (items.length >= 18) break;
    items.push({
      n: n++,
      source: "insight",
      label: `beslektet innsikt (${row.detector})`,
      value: row.title,
      ref: row.id,
    });
  }

  return items;
}

export function distinctSources(items: DiagnosisEvidenceItem[]): number {
  return new Set(items.map((i) => i.source)).size;
}

// ─────────────────────────────────────────────────────────────────────
// Siterings-validering: narrativet får kun stå hvis det siterer bunten
// ─────────────────────────────────────────────────────────────────────

export interface ValidatedNarrative {
  narrative: string;
  citations: number[];
}

/**
 * Godkjenn narrativet bare når: minst to GYLDIGE siteringer, ingen
 * ugyldige [n], og hver setning (utenom ev. siste konklusjon) siterer.
 */
export function validateNarrative(
  raw: string,
  bundle: DiagnosisEvidenceItem[],
): ValidatedNarrative | null {
  const text = raw.trim();
  if (!text || text.includes("TYNT_GRUNNLAG")) return null;
  const valid = new Set(bundle.map((b) => b.n));
  const cited = [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  if (cited.length < 2) return null;
  if (cited.some((c) => !valid.has(c))) return null; // fabrikkert referanse → forkast alt
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const uncited = sentences.filter((s) => !/\[\d+\]/.test(s));
  if (uncited.length > 1) return null; // maks én usitert (konklusjons-)setning
  return { narrative: text, citations: [...new Set(cited)].sort((a, b) => a - b) };
}

const DIAGNOSIS_SYSTEM = `Du er diagnostikk-laget i en markedsintelligens-plattform.
Du får en innsikt (en observert endring) og en nummerert evidensliste.
Skriv 2–4 setninger på norsk som forklarer HVORFOR endringen trolig skjer.

ABSOLUTTE REGLER:
- Du får KUN bruke fakta fra evidenslisten. Ingen bransjekunnskap, ingen antakelser.
- Hver påstand MÅ sitere kilden sin som [n]. Setninger uten sitering forkastes.
- Skill klart mellom syntetiske målinger (AI-probing) og ekte trafikkdata der evidensen er merket.
- Er grunnlaget for tynt til en ærlig forklaring: svar kun TYNT_GRUNNLAG.
- Aldri anbefalinger — kun forklaring. Anbefalinger er score-modellens jobb.`;

export interface DiagnosisResult {
  insightId: string;
  status: "generated" | "insufficient_evidence" | "error";
}

async function diagnoseOne(
  pool: Pool,
  organizationId: string,
  insight: InsightForDiagnosis,
): Promise<DiagnosisResult> {
  const bundle = await buildEvidenceBundle(pool, organizationId, insight);

  const insufficient = async (reason: string): Promise<DiagnosisResult> => {
    await pool.query(`UPDATE insights SET diagnosis = $2::jsonb WHERE id = $1::uuid`, [
      insight.id,
      JSON.stringify({ status: "insufficient_evidence", reason, checkedAt: new Date().toISOString() }),
    ]);
    return { insightId: insight.id, status: "insufficient_evidence" };
  };

  if (distinctSources(bundle) < MIN_DISTINCT_SOURCES) {
    return insufficient(
      `kun ${distinctSources(bundle)} kilde(r) i evidensbunten — kryss-kilde-forklaring krever minst ${MIN_DISTINCT_SOURCES}`,
    );
  }

  const anthropic = getAnthropic();
  if (!anthropic) return { insightId: insight.id, status: "error" };

  const evidenceText = bundle
    .map((b) => `[${b.n}] (${b.source}) ${b.label}: ${b.value}`)
    .join("\n");
  const response = await anthropic.messages.create({
    model: DIAGNOSIS_MODEL,
    max_tokens: 400,
    system: DIAGNOSIS_SYSTEM,
    messages: [
      {
        role: "user",
        content: `INNSIKT: ${insight.title}\n${insight.explanation}\n\nEVIDENS:\n${evidenceText}`,
      },
    ],
  });
  if (response.usage) {
    await recordAiUsage(pool, {
      organizationId,
      provider: "anthropic",
      operation: "insight-diagnosis",
      calls: 1,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
  }
  const raw = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  const validated = validateNarrative(raw, bundle);
  if (!validated) {
    return insufficient("narrativet besto ikke siterings-validering, eller modellen meldte tynt grunnlag");
  }

  await pool.query(`UPDATE insights SET diagnosis = $2::jsonb WHERE id = $1::uuid`, [
    insight.id,
    JSON.stringify({
      status: "generated",
      narrative: validated.narrative,
      citations: validated.citations,
      evidence: bundle,
      model: DIAGNOSIS_MODEL,
      generatedAt: new Date().toISOString(),
    }),
  ]);
  return { insightId: insight.id, status: "generated" };
}

/**
 * Diagnostiser nye innsikter uten diagnose (viktigst først, kostnadstak
 * per kjøring). Én feil velter ikke resten.
 */
export async function runInsightDiagnostics(
  pool: Pool,
  organizationId: string,
): Promise<{ generated: number; insufficient: number; errors: string[] }> {
  const candidates = await pool.query<InsightForDiagnosis & { evidence: never }>(
    `SELECT id::text, detector, title, explanation, topic, evidence
       FROM insights
      WHERE organization_id = $1::uuid AND status = 'new' AND diagnosis IS NULL
        AND severity IN ('notable','important','critical')
      ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
               detected_at DESC
      LIMIT ${MAX_PER_RUN}`,
    [organizationId],
  );

  let generated = 0;
  let insufficient = 0;
  const errors: string[] = [];
  for (const row of candidates.rows) {
    try {
      const result = await diagnoseOne(pool, organizationId, {
        ...row,
        evidence: Array.isArray(row.evidence) ? row.evidence : [],
      });
      if (result.status === "generated") generated += 1;
      else if (result.status === "insufficient_evidence") insufficient += 1;
      else errors.push(`${row.id}: ingen ANTHROPIC_API_KEY`);
    } catch (err) {
      errors.push(`${row.id}: ${String(err).slice(0, 120)}`);
    }
  }
  return { generated, insufficient, errors };
}
