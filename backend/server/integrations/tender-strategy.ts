/**
 * tender-strategy.ts — tilbudsstrategi-brief per anbud
 * (Daniels bestilling: «forstå hva anbudet spør om, tilby riktig, løse
 * oppgaven»)
 *
 * On-demand (admin klikker, ikke cron — koster tokens): bygger en
 * nummerert faktabunt fra anbudet vi har samlet (tittel, oppdragsgiver,
 * frist, verdi, CPV, krav-tagger, beskrivelse) og lar LLM skrive en
 * strukturert brief i tre deler:
 *
 *   1. HVA SPØR DE OM  — kun fakta, hver påstand siterer [n]
 *   2. SLIK TREFFER TILBUDET — krav → svar-mapping
 *   3. VINNERSTRATEGI — posisjonering/underleverandør/prising-vinkel
 *
 * Redelighet: faktapåstander MÅ sitere bunten (fabrikkert [n] forkaster
 * hele briefen); råd er merket som råd; briefen sier eksplisitt fra når
 * kun kunngjøringstekst (ikke fullt konkurransegrunnlag) er grunnlaget.
 * Caches i trigger_events.raw.strategyBrief; forbruk bokføres (steg 9).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Pool } from "pg";
import { recordAiUsage } from "./ai-usage.js";
import { TENDER_REQUIREMENT_LEXICON } from "./sales-trigger-sync.js";
import { computeDeliveryFit, requirementLabel } from "./supplier-profile.js";
import { SEGMENT_DEFINITIONS } from "./prospect-segment-sync.js";

const BRIEF_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface TenderFact {
  n: number;
  label: string;
  value: string;
}

interface TenderRow {
  id: string;
  title: string;
  url: string | null;
  published_at: string | null;
  matched_topic: string;
  raw: {
    deadline?: string | null;
    valueNok?: number | null;
    buyerName?: string | null;
    cpvCodes?: string[];
    description?: string | null;
    requirements?: string[];
    strategyBrief?: unknown;
  } | null;
}

export interface TenderContext {
  /** Leverandørprofilens capabilities; null = profil ikke utfylt. */
  capabilities?: Record<string, boolean> | null;
  /** Antall registrerte aktører i bransjen (fra segmentene); null = ukjent. */
  industryPlayers?: { count: number; segment: string } | null;
}

/** Ren buntbygging (enhetstestet): kun felter som FINNES blir fakta. */
export function buildTenderFacts(row: TenderRow, ctx: TenderContext = {}): TenderFact[] {
  const labels = Object.fromEntries(TENDER_REQUIREMENT_LEXICON.map((x) => [x.key, x.label]));
  const facts: Array<[string, string | null | undefined]> = [
    ["Tittel", row.title],
    ["Oppdragsgiver", row.raw?.buyerName],
    ["Publisert", row.published_at],
    ["Frist", row.raw?.deadline],
    ["Estimert verdi (NOK)", row.raw?.valueNok != null ? String(row.raw.valueNok) : null],
    ["CPV-koder", row.raw?.cpvCodes?.length ? row.raw.cpvCodes.join(", ") : null],
    [
      "Krav nevnt i kunngjøringen",
      row.raw?.requirements?.length
        ? row.raw.requirements.map((k) => labels[k] ?? k).join(", ")
        : null,
    ],
    ["Beskrivelse (utdrag)", row.raw?.description],
    ["Kunngjørings-URL", row.url],
  ];
  const fit = row.raw?.requirements?.length
    ? computeDeliveryFit(row.raw.requirements, ctx.capabilities ?? null)
    : null;
  if (fit && (fit.have.length + fit.missing.length + fit.unknown.length) > 0) {
    const parts = [
      fit.have.length ? `HAR: ${fit.have.map(requirementLabel).join(", ")}` : null,
      fit.missing.length ? `MANGLER: ${fit.missing.map(requirementLabel).join(", ")}` : null,
      fit.unknown.length ? `UBESVART i profilen: ${fit.unknown.map(requirementLabel).join(", ")}` : null,
    ].filter(Boolean);
    facts.push(["Egen leveranseprofil vs krav", parts.join(" · ")]);
  }
  if (ctx.industryPlayers) {
    facts.push([
      "Registrerte aktører i bransjen (nasjonalt, Enhetsregisteret)",
      `${ctx.industryPlayers.count} (${ctx.industryPlayers.segment})`,
    ]);
  }
  return facts
    .filter((f): f is [string, string] => typeof f[1] === "string" && f[1].length > 0)
    .map(([label, value], i) => ({ n: i + 1, label, value }));
}

/** Fabrikkerte [n]-referanser forkaster hele briefen; krever ≥2 gyldige. */
export function validateBriefCitations(text: string, facts: TenderFact[]): boolean {
  const valid = new Set(facts.map((f) => f.n));
  const cited = [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  if (cited.length < 2) return false;
  return cited.every((c) => valid.has(c));
}

const BRIEF_SYSTEM = `Du er tilbudsstrategen i en norsk markedsintelligens-plattform.
Du får en nummerert faktaliste om ÉN offentlig kunngjøring. Skriv en kort brief på norsk i tre deler:

## Hva spør de om
Kun fakta fra listen — HVER påstand siterer [n]. Er grunnlaget bare kunngjøringstekst, si det eksplisitt («fullt konkurransegrunnlag må leses på kunngjørings-siden»).

## Slik treffer tilbudet
Koble hvert nevnte krav [n] til hva et tilbud må dokumentere. Ikke dikt opp krav som ikke står i listen.

## Vinnerstrategi (råd)
2–4 konkrete råd (posisjonering, underleverandør-mulighet, hva som bør avklares med oppdragsgiver før frist). Råd er råd — de trenger ikke sitering, men skal følge logisk av fakta over.

ALDRI fabrikker referanser. Maks ~250 ord totalt.`;

export interface StrategyBrief {
  text: string;
  facts: TenderFact[];
  model: string;
  generatedAt: string;
}

export async function generateTenderStrategyBrief(
  pool: Pool,
  organizationId: string,
  source: string,
  eventId: string,
  opts: { force?: boolean } = {},
): Promise<{ brief: StrategyBrief } | { error: string; status: number }> {
  const r = await pool.query<TenderRow>(
    `SELECT id::text, title, url, published_at::text, matched_topic, raw
       FROM trigger_events
      WHERE organization_id = $1::uuid AND source = $2 AND event_id = $3 AND kind = 'tender'`,
    [organizationId, source, eventId],
  );
  if (r.rows.length === 0) return { error: "anbud_ikke_funnet", status: 404 };
  const row = r.rows[0];

  const cached = row.raw?.strategyBrief as StrategyBrief | undefined;
  if (cached?.text && !opts.force) return { brief: cached };

  const [profileRes, segRes] = await Promise.all([
    pool.query<{ capabilities: Record<string, boolean> }>(
      `SELECT capabilities FROM supplier_profile WHERE organization_id = $1::uuid`,
      [organizationId],
    ),
    (async () => {
      const def = SEGMENT_DEFINITIONS.find((d) => d.setName === row.matched_topic);
      if (!def) return null;
      const r = await pool.query<{ total_found: number }>(
        `SELECT total_found FROM prospect_segments WHERE segment_key = $1 AND total_found > 0`,
        [def.segmentKey],
      );
      return r.rows[0] ? { count: r.rows[0].total_found, segment: def.displayName } : null;
    })(),
  ]);
  const facts = buildTenderFacts(row, {
    capabilities: profileRes.rows[0]?.capabilities ?? null,
    industryPlayers: segRes,
  });
  if (facts.length < 3) {
    return { error: "for_tynt_grunnlag_for_brief", status: 422 };
  }

  const anthropic = getAnthropic();
  if (!anthropic) return { error: "anthropic_ikke_konfigurert", status: 503 };

  const response = await anthropic.messages.create({
    model: BRIEF_MODEL,
    max_tokens: 700,
    system: BRIEF_SYSTEM,
    messages: [
      {
        role: "user",
        content: facts.map((f) => `[${f.n}] ${f.label}: ${f.value}`).join("\n"),
      },
    ],
  });
  if (response.usage) {
    await recordAiUsage(pool, {
      organizationId,
      provider: "anthropic",
      operation: "tender-strategy",
      calls: 1,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
  }
  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();

  if (!validateBriefCitations(text, facts)) {
    return { error: "brief_besto_ikke_siterings_validering", status: 502 };
  }

  const brief: StrategyBrief = { text, facts, model: BRIEF_MODEL, generatedAt: new Date().toISOString() };
  await pool.query(
    `UPDATE trigger_events
        SET raw = COALESCE(raw, '{}'::jsonb) || jsonb_build_object('strategyBrief', $4::jsonb)
      WHERE organization_id = $1::uuid AND source = $2 AND event_id = $3`,
    [organizationId, source, eventId, JSON.stringify(brief)],
  );
  return { brief };
}
