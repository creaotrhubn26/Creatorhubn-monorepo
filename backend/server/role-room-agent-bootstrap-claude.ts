/**
 * Claude-backed synthesis layer for the producer bootstrap agent.
 *
 * Mirrors `requestOpenAiBootstrap` in role-room-agent.ts — same inputs,
 * same JSON output shape. The deterministic data-fetchers (Brreg, Google
 * Places, website scraping) stay in the OpenAI file; this module only
 * handles the final LLM reasoning + synthesis step.
 *
 * Chosen because:
 *   - Better Norwegian quality than GPT-4 class models at this price point.
 *   - Prompt caching on the large constraints block halves cost on retries.
 *   - Cleaner JSON output; fewer markdown fences to strip.
 *
 * Safety: returns `null` on any failure so the caller falls back to the
 * existing fallback payload path. Never throws.
 */

import { logAIUsage } from './ai-usage-tracker.js';
import type {
  RoleRoomAgentAgreementSuggestion,
  RoleRoomAgentBrregCompany,
  RoleRoomAgentBusinessSignals,
  RoleRoomAgentCompanyAge,
  RoleRoomAgentCompetitorAnalysis,
  RoleRoomAgentLocalPresencePlan,
  RoleRoomAgentProducerBootstrapInput,
  RoleRoomAgentRetrievalMeta,
  RoleRoomAgentWebsiteInsights,
} from './role-room-agent.js';

const BOOTSTRAP_SYSTEM_PROMPT =
  'Du er The Role Room Agent for The Role Room. Lag norske JSON-utkast for innholdsproduksjon. Returner kun gyldig JSON med feltene companyProfile, intakeDraft, planningDraft, storyLogicDraft og nextRecommendedSteps. Svar kun med JSON. Vær konkret, kommersiell og nyttig for en innholdsprodusent som bygger brief, story logikk og produksjonsgrunnlag for en kunde. Bruk Brreg-data som juridisk kilde når den finnes, og ikke finn på organisasjonsnummer eller selskapsstatus.';

const BOOTSTRAP_CONSTRAINTS: string[] = [
  'Vær konkret og bruk forretningsspråk som passer norsk produksjonsarbeid.',
  'Ikke finn på kontaktinfo som ikke finnes.',
  'Hvis informasjon mangler, marker det forsiktig i forslagene uten å være vag.',
  'Story logic skal passe innholdsproduksjon og kunde-brief, ikke filmmanus for kinofilm.',
  'Klassifiser alltid hvilken bransje innholdet lages for, underbransje, om kunden er B2B eller B2C, hvilken innholdskategori som passer, og hvilket produksjonsgrep som anbefales.',
  'Unngå generiske B2B-målgrupper dersom nettstedet tydelig viser en B2C-virksomhet som restaurant, retail eller lokal tjeneste.',
  'For restaurant og matkonsepter skal story logic handle om meny, fristelse, bestilling, lokasjon og konvertering, ikke generell bedriftsprofil.',
  'Legg inn en contentStoryLogic-del som er lett for klienten å fylle ut og godkjenne i et innholdsproduksjonsprosjekt.',
  'Hvis businessSignals finnes, bruk reviews, rating, lokasjon og tjenestesignalene aktivt i brief, bevispunkter, CTA og story logic.',
  'Hvis brregCompany.lookupStatus er verified, bruk juridisk navn, organisasjonsnummer, bransjekode, adresse, MVA-status og alder i kundeprofilen.',
  'Hvis agreementSuggestions finnes, bruk dem som avtalerisiko og praktiske anbefalinger, men formuler det som produksjonsråd, ikke juridisk rådgivning.',
  'Hvis socialProfileCandidates finnes, bruk kun kontoer med verified eller likely som kanalinnsikt, og marker kontoer som må bekreftes av produsent eller kunde før publisering.',
  'Hvis competitorAnalysis finnes, bruk kun konkurrenter med verified eller likely som markedsføringsinnsikt. Ikke påstå at en kandidat er konkurrent uten manuell bekreftelse fra kunden.',
  'KRITISK region-regel: Konkurrenter MÅ operere i samme marked som kunden. En norsk lokal restaurant har IKKE konkurrenter i Brasil, Korea, Kina eller andre fjerne land. Et norsk casting-byrå har IKKE konkurrenter på andre kontinenter med mindre de eksplisitt selger i Norge. Hvis competitorAnalysis inneholder selskaper utenfor kundens marked, IGNORER dem og ikke ta dem med i analysen.',
  'Hvis du ikke finner gode lokale konkurrenter i kundens region, si det heller enn å fylle opp listen med internasjonale referanser som ikke er relevante.',
  'Bruk konkurrentanalysen til posisjonering, content gaps, CTA og kanalprioritering, men ikke finn på annonsetall, markedsandeler eller private konkurrentdata.',
  'Hvis localPresencePlan finnes, bruk den til lokale eventforslag basert på bransje, adresse, nærliggende partnere og radius. Ikke påstå at partnere er kontaktet eller bekreftet.',
  'For restaurant/servering skal lokale forslag prioritere skole/klassekasse, idrettslag, arbeidsplasser, hotell, kulturarena og nabolag når slike finnes.',
];

const BOOTSTRAP_OUTPUT_SCHEMA_HINTS = {
  companyProfile: [
    'companyName',
    'websiteUrl',
    'organizationNumber',
    'summary',
    'offerings',
    'targetAudience',
    'toneAndBrandSignals',
    'industry',
    'subIndustry',
    'businessModel',
    'contentCategory',
    'productionApproach',
    'probableLocationAddress',
    'logoUrl',
  ],
  planningDraft: {
    contentLogic: [
      'objective',
      'audience',
      'hook',
      'coreMessage',
      'industry',
      'subIndustry',
      'businessModel',
      'contentCategory',
      'productionApproach',
      'proofPoints',
      'callToAction',
      'distributionPlan',
      'successSignals',
    ],
  },
  storyLogicDraft: [
    'classification',
    'contentStoryLogic',
    'storyLogicType',
    'coreNarrative',
    'logicFlow',
    'messageHierarchy',
  ],
};

let cachedAnthropicClient: unknown = null;

async function getAnthropicClient(): Promise<any> {
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

function extractJsonFromText(text: string): unknown | null {
  if (!text) return null;
  // Claude sometimes wraps JSON in markdown despite instructions; strip common fences.
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const raw = fenceMatch ? fenceMatch[1] : trimmed;
  try {
    return JSON.parse(raw);
  } catch {
    // As a last resort, try to locate the first { ... } block and parse it.
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const slice = raw.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// When a website provides a hero image via og:image / twitter:image we can
// feed it to Claude vision alongside the structured text signals. This
// gives noticeably better brand/tone classification because the model
// literally sees the visual identity instead of inferring from prose.
async function fetchImageAsBase64(
  url: string,
): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'RoleRoomAgent/1.0 (visual-analysis)' },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    // Claude vision accepts jpeg, png, gif, webp. Anything else → skip.
    const mediaType = contentType.split(';')[0].trim().toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    // Cap at ~5 MB so we don't blow the API request budget.
    if (buffer.byteLength > 5 * 1024 * 1024) return null;
    return { base64: buffer.toString('base64'), mediaType };
  } catch {
    return null;
  }
}

export async function requestClaudeBootstrap(
  input: RoleRoomAgentProducerBootstrapInput,
  websiteInsights: RoleRoomAgentWebsiteInsights,
  businessSignals: RoleRoomAgentBusinessSignals | null,
  brregCompany: RoleRoomAgentBrregCompany | null,
  companyAge: RoleRoomAgentCompanyAge | null,
  agreementSuggestions: RoleRoomAgentAgreementSuggestion[],
  competitorAnalysis: RoleRoomAgentCompetitorAnalysis,
  localPresencePlan: RoleRoomAgentLocalPresencePlan,
  retrievalMeta: RoleRoomAgentRetrievalMeta | null,
): Promise<unknown | null> {
  const client = await getAnthropicClient();
  if (!client) return null;

  const model = process.env.ROLE_ROOM_BOOTSTRAP_CLAUDE_MODEL || 'claude-sonnet-4-5';
  const visionEnabled = process.env.ROLE_ROOM_BOOTSTRAP_VISION !== 'false';
  const heroImageUrl = websiteInsights.probableHeroImageUrl;
  const heroImage = visionEnabled && heroImageUrl ? await fetchImageAsBase64(heroImageUrl) : null;
  const userPayload = {
    task: 'Lag første utkast for kundeprofil, story logikk og brief for et innholdsproduksjonsprosjekt.',
    requirements: {
      language: 'nb-NO',
      audience: 'content_producer',
      constraints: BOOTSTRAP_CONSTRAINTS,
    },
    outputSchemaHints: BOOTSTRAP_OUTPUT_SCHEMA_HINTS,
    input,
    websiteInsights,
    businessSignals,
    brregCompany,
    companyAge,
    agreementSuggestions,
    socialProfileCandidates: websiteInsights.socialProfileCandidates ?? [],
    competitorAnalysis,
    localPresencePlan,
    retrievalMeta,
  };

  try {
    // Build the user message. When we have a hero image, mix it into the
    // content array before the JSON payload so Claude sees the visual first.
    // Claude vision requires image blocks to come before related text in
    // multi-part messages for best attention weight.
    const userContent: any[] = [];
    if (heroImage) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: heroImage.mediaType,
          data: heroImage.base64,
        },
      });
      userContent.push({
        type: 'text',
        text:
          'Bildet over er kundens hovedvisuelle uttrykk (hentet fra og:image/twitter:image). Bruk det som utgangspunkt når du bedømmer tone, estetikk og brand-signaler i companyProfile.toneAndBrandSignals og storyLogicDraft.',
      });
    }
    userContent.push({
      type: 'text',
      text: JSON.stringify(userPayload),
    });

    const bootstrapStartedAt = Date.now();
    const response = await Promise.race([
      client.messages.create({
        model,
        max_tokens: 4096,
        // Keep the large constraints block in the cached system prefix; the
        // per-call user message is just the project data.
        system: [
          {
            type: 'text',
            text: BOOTSTRAP_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('claude_bootstrap_timeout')), 60_000),
      ),
    ]);

    // Slice 9X.71 — cost-tracking (fire-and-forget)
    logAIUsage(response as any, {
      feature: 'role-room-bootstrap',
      durationMs: Date.now() - bootstrapStartedAt,
    }).catch(() => undefined);

    const blocks = (response as any)?.content ?? [];
    let text = '';
    for (const block of blocks) {
      if (block.type === 'text' && typeof block.text === 'string') {
        text += block.text;
      }
    }
    return extractJsonFromText(text);
  } catch {
    return null;
  }
}

export function claudeBootstrapEnabled(): boolean {
  return (
    process.env.ROLE_ROOM_BOOTSTRAP_MODEL === 'claude' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}
