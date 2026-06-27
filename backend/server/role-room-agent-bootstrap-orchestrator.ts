/**
 * Tool-orchestrated bootstrap — Claude as the research driver.
 *
 * In the default bootstrap path, the code runs a fixed pipeline:
 *   Brreg → website → Google Places → competitor → local presence → synthesis.
 * That's wasteful for non-Norwegian customers (Brreg always fails), for
 * customers where we already have a rich brief in extraContext (website
 * fetch is redundant), or for thin inputs where we should bail early.
 *
 * This module lets Claude pick. We expose the three most expensive
 * fetchers as tools and run a tool_use loop (max 5 rounds). Claude reads
 * the input, decides what's worth fetching, and when done, emits a final
 * JSON payload matching the existing synthesis schema.
 *
 * Opt-in via ROLE_ROOM_BOOTSTRAP_ORCHESTRATOR=claude. Falls through to
 * the deterministic pipeline if the orchestrator returns null.
 */

import {
  fetchBrregCompany,
  fetchGooglePlacesBusinessSignals,
  fetchWebsiteInsights,
  type RoleRoomAgentBrregCompany,
  type RoleRoomAgentBusinessSignals,
  type RoleRoomAgentProducerBootstrapInput,
  type RoleRoomAgentWebsiteInsights,
} from './role-room-agent.js';

const ORCHESTRATOR_SYSTEM_PROMPT = `Du er The Role Room Agents research-orchestrator. Målet ditt er å samle akkurat nok informasjon til å lage et godt første utkast for et innholdsproduksjons-prosjekt. Tenk strategisk:

- Start med lookup_website_insights hvis det er en URL og vi ikke allerede har nok tekst.
- Bruk lookup_brreg ÉN gang når selskapet virker norsk og vi har organisasjonsnummer eller selskapsnavn.
- Bruk lookup_google_places når vi har selskapsnavn eller adresse, og bedriftens fysiske tilstedeværelse er relevant (butikk, restaurant, klinikk).
- Ikke kall alle verktøy blindt. Hvis brukerens extraContext allerede har svarene, hopp over fetch og gå rett til syntese.
- Når du har nok, returner KUN et JSON-objekt med feltene: companyProfile, intakeDraft, planningDraft, storyLogicDraft, nextRecommendedSteps. Ingen forklaring, ingen markdown — bare JSON.

Språk: norsk bokmål. Tone: konkret, kommersiell, nyttig for en innholdsprodusent.`;

const ORCHESTRATOR_TOOLS = [
  {
    name: 'lookup_website_insights',
    description:
      "Scrape kundens nettside for tittel, beskrivelse, tekst-utdrag, logo, hero-bilde og sosiale profiler. Bruk dette når du trenger grunnleggende forståelse av hva kunden tilbyr.",
    input_schema: {
      type: 'object',
      properties: {
        websiteUrl: { type: 'string', description: 'Full URL til kundens nettside.' },
      },
      required: ['websiteUrl'],
    },
  },
  {
    name: 'lookup_brreg',
    description:
      'Slå opp selskap i Brønnøysundregistrene. Bruk dette KUN for norske selskaper der vi har organisasjonsnummer eller selskapsnavn.',
    input_schema: {
      type: 'object',
      properties: {
        organizationNumber: { type: 'string', description: 'Norsk org.nr (9 siffer) hvis kjent.' },
        companyName: { type: 'string', description: 'Selskapsnavn hvis org.nr mangler.' },
      },
    },
  },
  {
    name: 'lookup_google_places',
    description:
      "Hent Google Places-signaler: adresse, åpningstider, rating, anmeldelser. Bruk dette kun når kunden har fysisk tilstedeværelse (butikk, restaurant, kontor åpent for publikum).",
    input_schema: {
      type: 'object',
      properties: {
        companyName: { type: 'string' },
        hintedAddress: { type: 'string', description: 'Kjent adresse eller by hvis relevant.' },
      },
      required: ['companyName'],
    },
  },
];

let cachedAnthropicClient: unknown = null;

async function getClient(): Promise<any> {
  if (cachedAnthropicClient) return cachedAnthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  // @ts-ignore — optional SDK, resolved at runtime
  const mod: any = await import('@anthropic-ai/sdk').catch(() => null);
  if (!mod) return null;
  const AnthropicCtor = mod.default ?? mod.Anthropic;
  cachedAnthropicClient = new AnthropicCtor({ apiKey });
  return cachedAnthropicClient;
}

/**
 * Single-line structured diagnostics so ops can grep `orchestrator_*`
 * reasons on any log backend. Until now every failure path in this module
 * returned null silently, which is why "research kom gjennom, men kilden
 * svarte tomt" was impossible to diagnose from logs.
 */
function logOrchestrator(reason: string, detail?: Record<string, unknown>): void {
  try {
    console.warn(
      '[role-room-agent:orchestrator]',
      JSON.stringify({ reason, ...detail }),
    );
  } catch {
    // diagnostics never throw
  }
}

export interface OrchestratorFetchResult {
  brregCompany: RoleRoomAgentBrregCompany | null;
  websiteInsights: RoleRoomAgentWebsiteInsights | null;
  businessSignals: RoleRoomAgentBusinessSignals | null;
  synthesis: unknown | null;
  toolCallsLog: Array<{ tool: string; ok: boolean }>;
}

function extractJsonFromText(text: string): unknown | null {
  if (!text) return null;
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const raw = fenceMatch ? fenceMatch[1] : trimmed;
  try {
    return JSON.parse(raw);
  } catch {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function orchestratorEnabled(): boolean {
  return (
    process.env.ROLE_ROOM_BOOTSTRAP_ORCHESTRATOR === 'claude' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}

/**
 * Runs the tool-use loop. Returns the raw synthesis payload plus the
 * fetch artifacts so the caller can reuse them when normalizing (e.g.
 * to populate brregCompany and socialProfileCandidates on the normalized
 * output without re-fetching).
 */
export async function runOrchestratedBootstrap(
  input: RoleRoomAgentProducerBootstrapInput,
): Promise<OrchestratorFetchResult | null> {
  const client = await getClient();
  if (!client) {
    logOrchestrator('anthropic_client_unavailable', {
      hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    });
    return null;
  }

  const model = process.env.ROLE_ROOM_BOOTSTRAP_CLAUDE_MODEL || 'claude-sonnet-4-5';
  const maxRounds = 5;

  let brregCompany: RoleRoomAgentBrregCompany | null = null;
  let websiteInsights: RoleRoomAgentWebsiteInsights | null = null;
  let businessSignals: RoleRoomAgentBusinessSignals | null = null;
  const toolCallsLog: OrchestratorFetchResult['toolCallsLog'] = [];

  const executeTool = async (
    name: string,
    toolInput: Record<string, any>,
  ): Promise<any> => {
    try {
      if (name === 'lookup_website_insights') {
        const url = String(toolInput.websiteUrl ?? input.websiteUrl ?? '');
        if (!url) return { error: 'no_website_url' };
        websiteInsights = await fetchWebsiteInsights(url, input, brregCompany);
        toolCallsLog.push({ tool: name, ok: true });
        return websiteInsights;
      }
      if (name === 'lookup_brreg') {
        const orgNumber = toolInput.organizationNumber ?? input.organizationNumber;
        const company = toolInput.companyName ?? input.companyName;
        brregCompany = await fetchBrregCompany({
          ...input,
          organizationNumber: orgNumber ?? null,
          companyName: company ?? null,
        });
        toolCallsLog.push({ tool: name, ok: true });
        return brregCompany;
      }
      if (name === 'lookup_google_places') {
        // Google Places fetcher wants websiteInsights; if we don't have it
        // yet, call it with minimal hints.
        const hinted = websiteInsights ?? { finalUrl: input.websiteUrl ?? '' };
        businessSignals = await fetchGooglePlacesBusinessSignals(
          { ...input, companyName: toolInput.companyName ?? input.companyName },
          hinted as RoleRoomAgentWebsiteInsights,
        );
        toolCallsLog.push({ tool: name, ok: true });
        return businessSignals;
      }
      toolCallsLog.push({ tool: name, ok: false });
      return { error: 'unknown_tool' };
    } catch (err) {
      toolCallsLog.push({ tool: name, ok: false });
      return { error: err instanceof Error ? err.message : 'tool_failed' };
    }
  };

  const conversation: any[] = [
    {
      role: 'user',
      content: JSON.stringify({
        task: 'bootstrap_research',
        input,
        notes: 'Tenk før du kaller verktøy. Returner JSON når du har nok.',
      }),
    },
  ];

  let finalText = '';
  let exhaustedRounds = false;

  for (let round = 0; round < maxRounds; round++) {
    let response: any;
    try {
      response = await Promise.race([
        client.messages.create({
          model,
          // 4096 tokens routinely truncated the large synthesis JSON
          // (companyProfile + intakeDraft + planningDraft + storyLogicDraft
          // + nextRecommendedSteps), and the truncated body failed JSON.parse
          // → null synthesis → silent deterministic fallback. 8192 gives the
          // payload room to complete.
          max_tokens: 8192,
          system: [
            {
              type: 'text',
              text: ORCHESTRATOR_SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: conversation,
          tools: ORCHESTRATOR_TOOLS,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('orchestrator_timeout')), 60_000),
        ),
      ]);
    } catch (err) {
      logOrchestrator('api_call_failed', {
        round,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }

    const content = response?.content ?? [];
    const toolUses = content.filter((block: any) => block.type === 'tool_use');
    const texts = content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    if (response?.stop_reason === 'max_tokens') {
      logOrchestrator('response_truncated_max_tokens', { round });
    }

    // Record the assistant turn verbatim so the model keeps context.
    conversation.push({ role: 'assistant', content });

    if (toolUses.length === 0) {
      // Model is done calling tools; whatever text it emitted is the answer.
      finalText = texts;
      break;
    }

    // Execute each tool and feed results back.
    const toolResults: any[] = [];
    for (const use of toolUses) {
      const result = await executeTool(use.name, use.input ?? {});
      toolResults.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: JSON.stringify(result ?? null),
      });
    }
    conversation.push({ role: 'user', content: toolResults });

    // Last allowed round but the model still wants to call a tool: it will
    // never get a turn to emit the final JSON. This was the main cause of
    // `orchestrator_returned_no_synthesis` — the loop ended with an empty
    // finalText. Mark it so we force one synthesis-only round below.
    if (round === maxRounds - 1) {
      exhaustedRounds = true;
    }
  }

  // Forced synthesis: the tool loop ran out of rounds without a terminal
  // text turn. Ask once more with tools disabled so the model has no choice
  // but to return the JSON payload from the context it already gathered.
  if (!finalText && exhaustedRounds) {
    conversation.push({
      role: 'user',
      content:
        'Du har nok informasjon nå. Returner KUN JSON-objektet med feltene companyProfile, intakeDraft, planningDraft, storyLogicDraft og nextRecommendedSteps. Ingen forklaring, ingen markdown — bare JSON.',
    });
    try {
      const finalResponse: any = await Promise.race([
        client.messages.create({
          model,
          max_tokens: 8192,
          system: [
            {
              type: 'text',
              text: ORCHESTRATOR_SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: conversation,
          // No tools — force a text/JSON answer.
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('orchestrator_timeout')), 60_000),
        ),
      ]);
      if (finalResponse?.stop_reason === 'max_tokens') {
        logOrchestrator('forced_synthesis_truncated_max_tokens');
      }
      finalText = (finalResponse?.content ?? [])
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');
    } catch (err) {
      logOrchestrator('forced_synthesis_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const synthesis = extractJsonFromText(finalText);
  if (!synthesis) {
    logOrchestrator('no_synthesis_after_loop', {
      exhaustedRounds,
      finalTextLength: finalText.length,
      toolCalls: toolCallsLog.map((t) => `${t.tool}:${t.ok ? 'ok' : 'fail'}`),
    });
  }
  return {
    brregCompany,
    websiteInsights,
    businessSignals,
    synthesis,
    toolCallsLog,
  };
}
