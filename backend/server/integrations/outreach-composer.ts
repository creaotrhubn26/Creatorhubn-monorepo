/**
 * outreach-composer.ts — outreach med butler
 * (Daniels bestilling: «en butler som sier 'bedriften har jo dette som
 * hovedfokus, ville heller lagt dem frem sånn'»)
 *
 * Tre lag, hvert med sin ærlighetsregel:
 *
 *  1. DOSSIER — alt plattformen vet om selskapet som nummerert
 *     faktaliste (berikelse, regnskap, IP, triggere, pipeline-kontekst).
 *     Kun det som FINNES; kilden står på hver post.
 *  2. RYDDIGHETS-ANALYSE — deterministisk tekstsjekk (lengde,
 *     setningslengde, hilsen, CTA, JEG-tunghet). Målbart måles, ikke
 *     synses.
 *  3. BUTLEREN (LLM) — utkast + dossier → vinklings-råd der hvert råd
 *     som påstår noe om selskapet MÅ sitere [n]; stil-råd merkes som
 *     stil. Fabrikkert referanse forkaster svaret. Kan også foreslå
 *     omskrevet utkast — alltid merket som forslag.
 *
 * On-demand (koster tokens — bokføres som 'outreach-composer').
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Pool } from "pg";
import { recordAiUsage } from "./ai-usage.js";

const COMPOSER_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// ─────────────────────────────────────────────────────────────────────
// 1) Dossier
// ─────────────────────────────────────────────────────────────────────

export interface DossierFact {
  n: number;
  source: string; // 'brreg' | 'regnskap' | 'patentstyret' | 'trigger' | 'crm'
  label: string;
  value: string;
}

interface LeadRow {
  id: string;
  name: string;
  pipeline_stage: string | null;
  deal_amount: string | null;
  enrichment_data: Record<string, unknown> | null;
}

function fmtNok(n: number): string {
  return new Intl.NumberFormat("nb-NO", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Ren dossier-bygging fra lead-rad + triggere (enhetstestet). */
export function buildDossierFacts(
  lead: LeadRow,
  triggers: Array<{ kind: string; title: string; published_at: string | null }>,
): DossierFact[] {
  const facts: Array<[string, string, string | null | undefined]> = [];
  const e = (lead.enrichment_data ?? {}) as {
    company?: {
      naceDescription?: string | null; employees?: number | null; city?: string | null;
      registeredAt?: string | null; orgForm?: string | null; website?: string | null;
    };
    financials?: {
      year?: number; revenue?: number | null; netResult?: number | null;
      equityRatio?: number | null; operatingMargin?: number | null;
    } | null;
    ip?: { trademarks?: number; patents?: number; designs?: number } | null;
    contacts?: Array<{ role: string; name: string }>;
  };

  facts.push(["crm", "Selskap", lead.name]);
  if (lead.pipeline_stage) facts.push(["crm", "Deres relasjon (pipeline)", lead.pipeline_stage]);
  const c = e.company;
  if (c?.naceDescription) facts.push(["brreg", "Bransje (registrert)", c.naceDescription]);
  if (c?.employees != null) facts.push(["brreg", "Ansatte", String(c.employees)]);
  if (c?.city) facts.push(["brreg", "Sted", c.city]);
  if (c?.registeredAt) facts.push(["brreg", "Etablert", c.registeredAt.slice(0, 4)]);
  const f = e.financials;
  if (f?.revenue != null) facts.push(["regnskap", `Omsetning ${f.year ?? ""}`, `${fmtNok(f.revenue)} NOK`]);
  if (f?.operatingMargin != null) facts.push(["regnskap", "Driftsmargin", `${Math.round(f.operatingMargin * 100)} %`]);
  if (f?.equityRatio != null) facts.push(["regnskap", "Soliditet", `${Math.round(f.equityRatio * 100)} %`]);
  const ip = e.ip;
  if (ip && (ip.trademarks ?? 0) + (ip.patents ?? 0) > 0) {
    facts.push(["patentstyret", "IP-aktivitet", `${ip.trademarks ?? 0} varemerker, ${ip.patents ?? 0} patenter`]);
  }
  for (const contact of (e.contacts ?? []).slice(0, 2)) {
    facts.push(["brreg", `Kontakt (${contact.role})`, contact.name]);
  }
  for (const t of triggers.slice(0, 3)) {
    facts.push(["trigger", `Nylig hendelse (${t.kind}, ${t.published_at ?? "nylig"})`, t.title.slice(0, 140)]);
  }

  return facts
    .filter((x): x is [string, string, string] => typeof x[2] === "string" && x[2].length > 0)
    .map(([source, label, value], i) => ({ n: i + 1, source, label, value }));
}

// ─────────────────────────────────────────────────────────────────────
// 2) Deterministisk ryddighets-analyse
// ─────────────────────────────────────────────────────────────────────

export interface TextAnalysis {
  words: number;
  sentences: number;
  avgSentenceLength: number;
  hasGreeting: boolean;
  hasCallToAction: boolean;
  iHeavyPct: number; // andel setninger som starter med jeg/vi
  warnings: string[];
}

export function analyzeOutreachText(text: string): TextAnalysis {
  const trimmed = text.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  const sentenceList = trimmed.split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
  const sentences = sentenceList.length;
  const avgSentenceLength = sentences > 0 ? Math.round(words / sentences) : 0;
  const lower = trimmed.toLowerCase();
  const hasGreeting = /^(hei|hallo|god\s|kjære)/.test(lower);
  const hasCallToAction = /\?|(ta en prat|høres det|passer det|kan vi|book|avtale|ring|møte)/.test(lower);
  const iHeavy = sentenceList.filter((s) => /^(jeg|vi)\b/i.test(s.trim())).length;
  const iHeavyPct = sentences > 0 ? Math.round((iHeavy / sentences) * 100) : 0;

  const warnings: string[] = [];
  if (words > 180) warnings.push(`Lang (${words} ord) — outreach under ~150 ord leses; kutt.`);
  if (avgSentenceLength > 25) warnings.push(`Lange setninger (snitt ${avgSentenceLength} ord) — del opp.`);
  if (!hasGreeting && words > 0) warnings.push("Mangler hilsen.");
  if (!hasCallToAction && words > 0) warnings.push("Mangler tydelig neste steg (spørsmål/forslag om møte).");
  if (iHeavyPct > 50) warnings.push(`${iHeavyPct} % av setningene starter med jeg/vi — snu mot mottakeren.`);
  return { words, sentences, avgSentenceLength, hasGreeting, hasCallToAction, iHeavyPct, warnings };
}

// ─────────────────────────────────────────────────────────────────────
// 3) Butleren
// ─────────────────────────────────────────────────────────────────────

/** Butler-råd som påstår selskapsfakta uten gyldig [n] forkastes. */
export function validateButlerNotes(
  notes: Array<{ note: string; kind: string }>,
  facts: DossierFact[],
): boolean {
  const valid = new Set(facts.map((f) => f.n));
  for (const item of notes) {
    const cited = [...item.note.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
    if (cited.some((c) => !valid.has(c))) return false; // fabrikkert → forkast alt
    if (item.kind === "selskap" && cited.length === 0) return false; // selskaps-råd må sitere
  }
  return true;
}

const BUTLER_SYSTEM = `Du er en diskret butler for en norsk selger. Du får:
- Et DOSSIER (nummererte fakta om mottaker-selskapet)
- Selgerens MÅL og eventuelt UTKAST

Svar KUN med gyldig JSON:
{
  "butlerNotes": [{ "kind": "selskap" | "stil", "note": "..." }],
  "suggestedDraft": "..."
}

Regler:
- "selskap"-råd vinkler mot det selskapet faktisk er opptatt av — og MÅ sitere [n] fra dossieret. Eksempel: «De doblet omsetningen [4] — anerkjenn veksten i åpningen i stedet for generisk smiger.»
- "stil"-råd handler om språk/struktur og trenger ikke sitering.
- ALDRI fabrikker referanser eller fakta. Er dossieret tynt, si det i et stil-råd og hold deg generell.
- suggestedDraft: kort norsk e-post (maks ~140 ord) som bruker dossier-fakta naturlig (uten [n]-markører i selve teksten), med hilsen og ett tydelig neste steg. Aldri påstå noe om selskapet som ikke står i dossieret.
- Tonen er hjelpsom og konkret — aldri smisk, aldri utropstegn-salg.`;

export interface ComposerResult {
  facts: DossierFact[];
  analysis: TextAnalysis | null;
  butlerNotes: Array<{ kind: string; note: string }>;
  suggestedDraft: string;
}

export interface InstitutionContext {
  /** Mottaker-institusjonen (NFI, Innovasjon Norge, Kulturdirektoratet, ...) */
  recipientName: string;
  /** Fakta avsenderen selv står inne for — nummereres som dossier. */
  facts: Array<{ label: string; value: string }>;
}

/** Institusjons-dossier: caller-fakta + kilde-merking (enhetstestet). */
export function buildInstitutionFacts(ctx: InstitutionContext): DossierFact[] {
  const base: Array<[string, string, string]> = [
    ["crm", "Mottaker", ctx.recipientName],
    ...ctx.facts
      .filter((f) => typeof f.label === "string" && typeof f.value === "string" && f.value.trim())
      .slice(0, 15)
      .map((f): [string, string, string] => ["avsender", f.label.slice(0, 80), f.value.slice(0, 200)]),
  ];
  return base.map(([source, label, value], i) => ({ n: i + 1, source, label, value }));
}

export async function composeOutreach(
  pool: Pool,
  organizationId: string,
  args: {
    leadId?: string;
    intent: string;
    draft?: string;
    /** Institusjons-modus: henvendelse til NFI/IN/etater — fakta fra avsender i stedet for CRM-dossier. */
    institution?: InstitutionContext;
  },
): Promise<{ result: ComposerResult } | { error: string; status: number }> {
  let facts: DossierFact[];

  if (args.institution) {
    facts = buildInstitutionFacts(args.institution);
    if (facts.length < 3) return { error: "institusjons_fakta_kreves", status: 400 };
  } else if (args.leadId) {
    const leadRes = await pool.query<LeadRow>(
      `SELECT id::text, name, pipeline_stage, deal_amount::text, enrichment_data
         FROM crm_customers
        WHERE id = $1 AND organization_id = $2::uuid AND archived_at IS NULL`,
      [args.leadId, organizationId],
    );
    if (leadRes.rows.length === 0) return { error: "lead_ikke_funnet", status: 404 };
    const lead = leadRes.rows[0];

    const triggers = await pool.query<{ kind: string; title: string; published_at: string | null }>(
      `SELECT kind, title, published_at::text FROM trigger_events
        WHERE organization_id = $1::uuid AND matched_topic = $2
        ORDER BY created_at DESC LIMIT 3`,
      [organizationId, lead.name],
    );
    facts = buildDossierFacts(lead, triggers.rows);
  } else {
    return { error: "leadId_eller_institution_kreves", status: 400 };
  }
  const analysis = args.draft?.trim() ? analyzeOutreachText(args.draft) : null;
  const isInstitution = Boolean(args.institution);

  const anthropic = getAnthropic();
  if (!anthropic) return { error: "anthropic_ikke_konfigurert", status: 503 };

  const userContent = [
    `MÅL: ${args.intent}`,
    ...(isInstitution
      ? ["MODUS: Formell henvendelse til offentlig institusjon — saklig, konkret, ingen salgsspråk. Be om én tydelig ting."]
      : []),
    "",
    "DOSSIER:",
    ...facts.map((f) => `[${f.n}] (${f.source}) ${f.label}: ${f.value}`),
    ...(args.draft?.trim() ? ["", "UTKAST FRA SELGEREN:", args.draft.trim().slice(0, 2000)] : []),
    ...(analysis?.warnings.length
      ? ["", `RYDDIGHETS-FUNN (deterministisk): ${analysis.warnings.join(" | ")}`]
      : []),
  ].join("\n");

  const response = await anthropic.messages.create({
    model: COMPOSER_MODEL,
    max_tokens: 900,
    system: BUTLER_SYSTEM,
    messages: [{ role: "user", content: userContent }],
  });
  if (response.usage) {
    await recordAiUsage(pool, {
      organizationId,
      provider: "anthropic",
      operation: "outreach-composer",
      calls: 1,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
  }
  const raw = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  let parsed: { butlerNotes?: Array<{ kind: string; note: string }>; suggestedDraft?: string };
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match?.[0] ?? "{}");
  } catch {
    return { error: "butler_svarte_ugyldig_format", status: 502 };
  }
  const notes = (parsed.butlerNotes ?? []).filter(
    (x): x is { kind: string; note: string } =>
      typeof x?.note === "string" && (x.kind === "selskap" || x.kind === "stil"),
  );
  if (!validateButlerNotes(notes, facts)) {
    return { error: "butler_besto_ikke_siterings_validering", status: 502 };
  }

  return {
    result: {
      facts,
      analysis,
      butlerNotes: notes,
      suggestedDraft: typeof parsed.suggestedDraft === "string" ? parsed.suggestedDraft.slice(0, 3000) : "",
    },
  };
}
