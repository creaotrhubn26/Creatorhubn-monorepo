/**
 * lead-map-discovery-populate.ts
 *
 * Wave LM-Agent Fase 3 — Site Discovery → Lead Map auto-populate.
 *
 * Flyt:
 *   1. Klient gjennomfører Site Discovery (eksisterende N2-B1)
 *   2. Producer klikker "Auto-populate Lead Map" i Agent UI
 *   3. Claude analyserer klientens business_type + business_summary
 *   4. Foreslår 10-20 Google Places-søke-queries for lookalike-bedrifter
 *   5. For hver query: searchPlaces (eksisterende Phase 2)
 *   6. Importer top 5-10 Places-resultater per query
 *   7. Auto-rangerer importerte leads med ai_opportunity_score
 *   8. Forbruker leads-quota fra entitlement
 *
 * Honor quota: importerer aldri flere enn entitlement.remaining.leads
 * tillater. Returnerer hvor mange som faktisk ble importert.
 */

import type { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { discoverClientSite, type DiscoveryResult } from "./client-ads-discovery-service.js";
import { importPlaceAsLead, searchPlaces } from "./lead-map-service.js";
import { consumeQuota, getEntitlement } from "./lead-map-entitlements-service.js";

const CLAUDE_MODEL = "claude-opus-4-7";
let cachedAnthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (cachedAnthropic) return cachedAnthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedAnthropic = new Anthropic({ apiKey });
  return cachedAnthropic;
}

interface LookalikeQuery {
  query: string;                  // Google Places søke-query
  category: string;               // Lead-kategori (restaurant, agency, etc.)
  reasoning: string;              // Hvorfor klienten ville hatt nytte
  priorityScore: number;          // 0-100, hvor relevant
}

interface ClaudeLookalikeOutput {
  business_context_summary: string;
  search_queries: LookalikeQuery[];
}

/**
 * Spør Claude om lookalike-søke-queries basert på Site Discovery.
 */
async function generateLookalikeQueries(
  discovery: DiscoveryResult,
  city?: string,
  maxQueries = 15,
): Promise<ClaudeLookalikeOutput | null> {
  const client = getAnthropic();
  if (!client) return null;

  const cityHint = city ?? 'Oslo';
  const prompt = `Du er Customer Acquisition-strateg for The Role Room (norsk plattform for casting/produksjon/innholdsmarkedsføring fra Creatorhub AS).

KLIENTENS NETTSIDE: ${discovery.url}
BRANSJE: ${discovery.business_type}${discovery.business_subcategory ? ` — ${discovery.business_subcategory}` : ''}
OPPSUMMERING: ${discovery.business_summary}
DETEKTERTE CTA-er: ${(discovery.page_snapshot?.cta_phrases ?? []).slice(0, 5).join(', ') || 'ingen'}
FORM-COUNT: ${discovery.page_snapshot?.formCount ?? 0}

OPPDRAG:
Du skal foreslå ${maxQueries} GOOGLE PLACES-SØKE-QUERIES som lar klienten
finne lokale bedrifter (i ${cityHint} eller omegn) som er IDEELLE LEADS
for klientens tjenester.

Tenk: hvis klienten leverer X til bransje Y, hvilke konkrete søk i Google
Places vil gi dem 5-20 lookalike-prospects per søk?

Spesifikt:
- Søk på BUSINESS-TYPE + LOKASJON (f.eks. "restaurant Grünerløkka", "frisør Majorstuen")
- Variér mellom forskjellige bydeler/områder for å spre dekning
- Inkluder noen NICHE-søk (f.eks. "veganrestaurant Oslo", "premium hudpleie")
- Unngå overlapp — hver query skal gi unike resultater

Returner KUN JSON (ingen markdown, ingen kommentarer):
{
  "business_context_summary": "<1-2 setninger om hvem klienten serverer>",
  "search_queries": [
    {
      "query": "<søke-tekst for Google Places>",
      "category": "<lead-kategori, kort>",
      "reasoning": "<hvorfor dette er en god match>",
      "priority_score": <0-100>
    },
    ... (totalt ${maxQueries})
  ]
}`;

  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL, max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content[0];
    const text = block?.type === 'text' ? block.text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as {
      business_context_summary?: string;
      search_queries?: Array<{
        query?: string; category?: string;
        reasoning?: string; priority_score?: number;
      }>;
    };
    if (!parsed.search_queries || parsed.search_queries.length === 0) return null;

    return {
      business_context_summary: parsed.business_context_summary ?? '',
      search_queries: parsed.search_queries
        .filter((q): q is Required<NonNullable<typeof q>> => !!q.query)
        .map((q) => ({
          query: q.query!.slice(0, 200),
          category: (q.category ?? 'business').slice(0, 80),
          reasoning: (q.reasoning ?? '').slice(0, 400),
          priorityScore: Math.min(100, Math.max(0, Math.round(q.priority_score ?? 50))),
        }))
        .sort((a, b) => b.priorityScore - a.priorityScore),
    };
  } catch (err) {
    console.warn('[lead-map-populate] Claude lookalike feilet', { err: (err as Error).message });
    return null;
  }
}

export interface AutoPopulateResult {
  ok: boolean;
  queriesGenerated: number;
  queriesSearched: number;
  placesFound: number;
  placesImported: number;
  quotaRemaining: number | null;
  businessContextSummary: string | null;
  details: Array<{
    query: string;
    placesFound: number;
    placesImported: number;
    error?: string;
  }>;
}

/**
 * Hovedfunksjonen: auto-populate Lead Map for én klient-config.
 */
export async function autoPopulateLeadMap(
  pool: Pool, opts: {
    configId: string;
    producerUserId: string;
    clientWebsiteUrl: string;
    city?: string;
    maxQueries?: number;
    maxImportsPerQuery?: number;
  },
): Promise<AutoPopulateResult> {
  // 1. Sjekk entitlement
  const entitlement = await getEntitlement(pool, opts.configId);
  if (!entitlement) {
    return {
      ok: false, queriesGenerated: 0, queriesSearched: 0,
      placesFound: 0, placesImported: 0, quotaRemaining: null,
      businessContextSummary: null,
      details: [{ query: '', placesFound: 0, placesImported: 0, error: 'no_entitlement' }],
    };
  }

  const remaining = entitlement.remaining.leads ?? Infinity;
  if (remaining <= 0) {
    return {
      ok: false, queriesGenerated: 0, queriesSearched: 0,
      placesFound: 0, placesImported: 0, quotaRemaining: 0,
      businessContextSummary: null,
      details: [{ query: '', placesFound: 0, placesImported: 0, error: 'quota_exhausted' }],
    };
  }

  // 2. Site Discovery
  let discovery: DiscoveryResult;
  try {
    discovery = await discoverClientSite({ url: opts.clientWebsiteUrl });
  } catch (err) {
    return {
      ok: false, queriesGenerated: 0, queriesSearched: 0,
      placesFound: 0, placesImported: 0, quotaRemaining: remaining,
      businessContextSummary: null,
      details: [{ query: '', placesFound: 0, placesImported: 0, error: `discovery_failed: ${(err as Error).message}` }],
    };
  }

  // 3. Claude lookalike-queries
  const lookalike = await generateLookalikeQueries(discovery, opts.city, opts.maxQueries ?? 15);
  if (!lookalike) {
    return {
      ok: false, queriesGenerated: 0, queriesSearched: 0,
      placesFound: 0, placesImported: 0, quotaRemaining: remaining,
      businessContextSummary: null,
      details: [{ query: '', placesFound: 0, placesImported: 0, error: 'claude_failed' }],
    };
  }

  const maxImportsPerQuery = opts.maxImportsPerQuery ?? 5;
  const details: AutoPopulateResult['details'] = [];
  let totalImported = 0;
  let totalFound = 0;
  let quotaLeft = Number.isFinite(remaining) ? remaining : Infinity;

  // 4. Loop queries — søk + importer top N hver
  for (const lq of lookalike.search_queries) {
    if (quotaLeft <= 0) break;

    const searchResult = await searchPlaces(pool, {
      ownerUserId: opts.producerUserId,
      agentConfigId: opts.configId,
      query: lq.query,
      radiusMeters: 15000,
    });

    if (!searchResult.ok) {
      details.push({ query: lq.query, placesFound: 0, placesImported: 0, error: searchResult.reason });
      continue;
    }

    const newPlaces = searchResult.results.filter((p) => !p.alreadyImported);
    totalFound += newPlaces.length;

    let importedThisQuery = 0;
    for (const place of newPlaces.slice(0, maxImportsPerQuery)) {
      if (quotaLeft <= 0) break;

      // Konsumer quota før import
      const q = await consumeQuota(pool, { configId: opts.configId, kind: 'leads', amount: 1 });
      if (!q.ok) break;

      const imp = await importPlaceAsLead(pool, {
        ownerUserId: opts.producerUserId,
        agentConfigId: opts.configId,
        place,
        leadCategory: lq.category,
      });
      if (imp.ok) {
        importedThisQuery += 1;
        totalImported += 1;
        if (Number.isFinite(quotaLeft)) quotaLeft -= 1;
      }
    }

    details.push({
      query: lq.query,
      placesFound: newPlaces.length,
      placesImported: importedThisQuery,
    });
  }

  return {
    ok: true,
    queriesGenerated: lookalike.search_queries.length,
    queriesSearched: details.length,
    placesFound: totalFound,
    placesImported: totalImported,
    quotaRemaining: Number.isFinite(quotaLeft) ? quotaLeft : null,
    businessContextSummary: lookalike.business_context_summary,
    details,
  };
}
