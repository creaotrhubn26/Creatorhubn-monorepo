/**
 * «Kan jeg trekke fra dette?» — KILDEKRITISK fradragshjelper.
 *
 * Prinsipp: SELVE VERDIKTET (fradragsberettiget ja/nei/avhenger) hentes fra
 * kontoplanens deterministiske `taxDeductible`-flagg + veiledningstekst — ALDRI
 * fra språkmodellen. AI-en brukes KUN til å matche brukerens fritekst til riktig
 * konto og formulere forklaringen, forankret utelukkende i de hentede kilde-
 * faktaene. Svaret viser alltid kilden (konto + regeltekst) og en tydelig
 * ansvarsfraskrivelse. Uten AI-nøkkel: ren deterministisk konto-match (fungerer).
 */
import { STANDARD_ACCOUNTS, type LedgerAccountDef } from '../coa/accounts.js';

export type Verdict = 'yes' | 'no' | 'depends' | 'unknown';

export interface DeductionSource {
  accountNumber: string;
  accountName: string;
  taxDeductible: 'yes' | 'no' | 'depends' | null;
  plainExplanation: string;
  whenToUse: string;
  whenNotToUse: string | null;
  commonMistakes: string[];
}

export interface DeductionAnswer {
  verdict: Verdict;
  /** Kort forklaring (AI-formulert fra kilden, eller kontoens egen tekst). */
  summary: string;
  source: DeductionSource | null;
  /** Andre mulige kontoer, til kontroll. */
  alternatives: { accountNumber: string; accountName: string; taxDeductible: 'yes' | 'no' | 'depends' | null }[];
  aiUsed: boolean;
  disclaimer: string;
}

const DISCLAIMER =
  'Veiledning basert på Reknarens kontoplan-regler — ikke bindende skatteråd. Ved tvil, sjekk med regnskapsfører eller Skatteetaten.';

const STOPWORDS = new Set(['kan', 'jeg', 'trekke', 'fra', 'dette', 'det', 'som', 'for', 'har', 'med', 'til', 'ein', 'en', 'et', 'og', 'på', 'av', 'om', 'når', 'hva', 'skal', 'være']);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-zæøå0-9]+/g) ?? []).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function searchable(a: LedgerAccountDef): string {
  return [a.name, a.friendlyName ?? '', a.plainExplanation, a.whenToUse, a.whenNotToUse ?? '', ...(a.examples ?? []), ...(a.commonMistakes ?? [])].join(' ').toLowerCase();
}

function toSource(a: LedgerAccountDef): DeductionSource {
  return {
    accountNumber: a.number,
    accountName: a.name,
    taxDeductible: (a.taxDeductible as DeductionSource['taxDeductible']) ?? null,
    plainExplanation: a.plainExplanation,
    whenToUse: a.whenToUse,
    whenNotToUse: a.whenNotToUse ?? null,
    commonMistakes: a.commonMistakes ?? [],
  };
}

/** Deterministisk konto-match på nøkkelord. Bare kostnads-/eiendelskontoer. */
export function findCandidateAccounts(query: string, limit = 5): LedgerAccountDef[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const scored = STANDARD_ACCOUNTS.filter((a) => a.type === 'expense' || a.type === 'asset')
    .map((a) => {
      const text = searchable(a);
      const name = (a.name + ' ' + (a.friendlyName ?? '') + ' ' + (a.examples ?? []).join(' ')).toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (name.includes(t)) score += 3; // treff i navn/eksempel veier tyngst
        else if (text.includes(t)) score += 1;
      }
      return { a, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);
  return scored.slice(0, limit).map((x) => x.a);
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ status: number; ok: boolean; json(): Promise<unknown> }>;

/**
 * AI velger beste konto blant kandidatene og formulerer forklaringen — forankret
 * KUN i de gitte faktaene (constrained tool_use). Returnerer valgt kontonummer +
 * tekst, eller null hvis ingen passer / AI utilgjengelig.
 */
export async function pickAndExplain(
  query: string,
  candidates: LedgerAccountDef[],
  opts: { apiKey?: string; model?: string; fetchImpl?: FetchLike; timeoutMs?: number },
): Promise<{ accountNumber: string | 'none'; summary: string } | null> {
  if (!opts.apiKey || candidates.length === 0) return null;
  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const facts = candidates
    .map((a) => `Konto ${a.number} «${a.name}»: ${a.plainExplanation} Brukes når: ${a.whenToUse}${a.whenNotToUse ? ` IKKE når: ${a.whenNotToUse}` : ''} Skattefradrag: ${a.taxDeductible ?? 'ikke angitt'}.`)
    .join('\n');
  const instruction =
    `Du hjelper en norsk næringsdrivende å forstå om en utgift er fradragsberettiget. ` +
    `Bruk UTELUKKENDE faktaene om kontoene under — ikke finn på skatteregler, ikke gi bindende svar. ` +
    `Velg kontoen som best matcher beskrivelsen (eller "none" hvis ingen passer). Skriv en kort, klar norsk forklaring basert kun på kontoens veiledning.\n\nKontoer:\n${facts}\n\nBrukerens spørsmål: «${query}»`;
  const schema = {
    type: 'object',
    properties: {
      accountNumber: { type: 'string', enum: [...candidates.map((a) => a.number), 'none'] },
      summary: { type: 'string' },
    },
    required: ['accountNumber', 'summary'],
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: opts.model ?? 'claude-sonnet-4-6',
        max_tokens: 700,
        tools: [{ name: 'svar', description: 'Velg konto og forklar', input_schema: schema }],
        tool_choice: { type: 'tool', name: 'svar' },
        messages: [{ role: 'user', content: [{ type: 'text', text: instruction }] }],
      }),
    });
    if (!res.ok) return null; // ærlig: faller tilbake til deterministisk
    const body = (await res.json()) as { content?: Array<{ type: string; input?: unknown }> };
    const tool = (body.content ?? []).find((c) => c.type === 'tool_use');
    const input = tool?.input as { accountNumber?: string; summary?: string } | undefined;
    if (!input?.accountNumber || typeof input.summary !== 'string') return null;
    return { accountNumber: input.accountNumber, summary: input.summary };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hovedinngang. Deterministisk match + (valgfri) AI-formulering. VERDIKTET er
 * alltid kontoens `taxDeductible`-flagg, aldri AI-generert.
 */
export async function assessDeduction(
  query: string,
  opts: { apiKey?: string; model?: string; fetchImpl?: FetchLike } = {},
): Promise<DeductionAnswer> {
  const candidates = findCandidateAccounts(query);
  if (candidates.length === 0) {
    return { verdict: 'unknown', summary: 'Fant ingen passende konto for beskrivelsen. Prøv å beskrive utgiften mer konkret, eller spør regnskapsfører.', source: null, alternatives: [], aiUsed: false, disclaimer: DISCLAIMER };
  }
  const ai = await pickAndExplain(query, candidates, opts);
  let chosen: LedgerAccountDef | undefined;
  let summary: string;
  let aiUsed = false;
  if (ai && ai.accountNumber !== 'none') {
    chosen = candidates.find((a) => a.number === ai.accountNumber) ?? candidates[0];
    summary = ai.summary;
    aiUsed = true;
  } else if (ai && ai.accountNumber === 'none') {
    return { verdict: 'unknown', summary: ai.summary || 'Ingen av de vanlige kontoene passer helt — vurder med regnskapsfører.', source: null, alternatives: candidates.map((a) => ({ accountNumber: a.number, accountName: a.name, taxDeductible: (a.taxDeductible as 'yes' | 'no' | 'depends' | null) ?? null })), aiUsed: true, disclaimer: DISCLAIMER };
  } else {
    chosen = candidates[0]!;
    summary = chosen.plainExplanation; // deterministisk fallback: kontoens egen tekst
  }
  const source = toSource(chosen!);
  // 🔑 Verdikt fra flagget, ALDRI fra AI.
  const verdict: Verdict = source.taxDeductible ?? 'unknown';
  return {
    verdict,
    summary,
    source,
    alternatives: candidates.filter((a) => a.number !== chosen!.number).map((a) => ({ accountNumber: a.number, accountName: a.name, taxDeductible: (a.taxDeductible as 'yes' | 'no' | 'depends' | null) ?? null })),
    aiUsed,
    disclaimer: DISCLAIMER,
  };
}
