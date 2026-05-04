/**
 * Role Room — Claude-drevet samarbeidsforslag-generator (Slice 3).
 *
 * Tar kundens profil + en motpart (klubb / event / skole / forening /
 * bedrift) + ønsket avtaletype og returnerer et strukturert avtaleutkast
 * som en innholdsprodusent kan bruke i pitch eller forhandling.
 *
 * Hardkodede regler i system-prompten (ingen LLM-slop):
 *   - Norsk bokmål, profesjonell forretningsstil
 *   - Konkrete tall, mengder og frister (ikke "vi kan tilby noe innhold")
 *   - Aldri finn på partner-spesifikk informasjon (følgertall, sponsor-
 *     historikk, omsetning) — bruk kun det som kommer i input
 *   - Avtaleparagrafer formuleres som første utkast, ikke endelig juss —
 *     må alltid bekreftes av advokat ved store kontrakter
 *
 * Auth: bruker eksisterende ROLE_ROOM_AGENT_CLAUDE_ENABLED feature-flag
 * + ANTHROPIC_API_KEY. Audit logges som action='merch_cooperation_draft'.
 */

import type { Pool } from "pg";

import {
  claudeAgentEnabled,
  runClaudeAgent,
} from "./role-room-agent-claude.js";
import { logAiCall } from "./role-room-ai-audit.js";

export type MerchPartnerType =
  | "sportsklubb"
  | "event"
  | "skole"
  | "forening"
  | "bedrift";

export type MerchDealType =
  | "sponsor"
  | "kit_supplier"
  | "cross_promo"
  | "give_away"
  | "long_term_partnership";

export interface MerchCooperationInput {
  pool: Pool;
  projectId: string;
  userId: string;
  customerName: string;
  customerIndustry?: string | null;
  customerBriefSummary?: string | null;
  partnerName: string;
  partnerType: MerchPartnerType;
  partnerNotes?: string | null;
  dealType: MerchDealType;
  /** Optional: link the proposal to a specific supplier the producer
   *  is considering. Surfaces in "vi tilbyr" so the deal references
   *  who would actually print the merch. */
  supplierContext?: {
    name: string;
    techniques: string[];
    productCategories: string[];
  } | null;
}

export interface MerchCooperationDraft {
  generatedAt: string;
  model: string;
  /** 1-linje overskrift som oppsummerer avtalen ("2-årig kit-supplier
   *  for FK Lyn med trykte hjemmedrakter + leverandørsynlighet"). */
  dealHeadline: string;
  /** 1-2 setninger pitch som producer kan starte e-posten med. */
  openingPitch: string;
  /** Konkret hva kunden tilbyr motparten — bullet-list med tall,
   *  mengder, frister der det er mulig. */
  weProposeToOffer: string[];
  /** Hva motparten gir tilbake. */
  theyOffer: string[];
  /** 2-3 setninger som rammer inn hvorfor avtalen er gjensidig
   *  fornuftig — produseres i forretningsspråk. */
  commercialFraming: string;
  /** 4-6 nummererte paragrafer som starter på en kontrakt — språk
   *  bevisst formelt nok til å brukes som første utkast. */
  draftAgreementParagraphs: string[];
  /** 3-5 risikofaktorer producer må sjekke før signering. */
  riskNotes: string[];
  /** 3-5 konkrete neste steg producer kan gjøre i dag. */
  nextSteps: string[];
}

export class MerchCooperationError extends Error {
  readonly httpStatus: number;
  constructor(httpStatus: number, message: string) {
    super(message);
    this.name = "MerchCooperationError";
    this.httpStatus = httpStatus;
  }
}

const SYSTEM_PROMPT = `Du er en norsk innholdsprodusent-rådgiver som lager profesjonelle samarbeidsforslag mellom kunder og motparter (klubber, event, skoler, foreninger, bedrifter).

## Stil og språk
- Skriv på norsk bokmål.
- Profesjonell forretningsstil — ikke marketing-fluff. Tenk forhandlingsdokument, ikke landingsside.
- Vær konkret. Bruk tall (antall plagg, sesonglengde, fastfrist, prosentsats), ikke "noe innhold" eller "et passende antall".
- Hvis en konkret mengde mangler i input, bruk nøkterne, hyppige bransjenormer (f.eks. en sportsklubb-drakt har vanligvis 25-35 spillere; et lokalevent har vanligvis 200-500 deltakere). Marker antakelsen tydelig: "antar 30 stk basert på vanlig klubbstørrelse".

## Absolutte regler
1. **Ikke finn på partner-data.** Du må ALDRI oppgi følgertall, sponsor-historikk, omsetningstall, antall medlemmer eller andre faktatall for motparten med mindre brukeren har gitt det i input. Hvis du trenger slike tall, foreslå at producer henter dem som "neste steg".
2. **Ikke lov produkter / leveranser kunden ikke har sagt at de kan levere.** Hold deg til ramme rundt merch (klær, caps, drakter, promo-produkter, bilfoliering) og innhold (foto, video) som er rimelig for en innholdsprodusent.
3. **Avtaleparagrafer er utkast, ikke ferdig juss.** Bruk formuleringer som "Partene er enige om...", "Avtalen løper i ... med ... måneders gjensidig oppsigelsestid". Inkluder alltid en risk-note om at endelig avtale må gjennomgås av advokat ved verdier over ~50 000 NOK.
4. **Hvis en avtaletype ikke gir mening for partner-typen** (f.eks. "kit_supplier" for "skole" — skoler har ikke spillerdrakter), tilpass forslaget til noe nærliggende og forklar valget i commercialFraming.

## Verktøy
Du SKAL svare ved å kalle verktøyet \`emit_cooperation_draft\` ÉN gang med alle feltene utfylt. Ikke svar med klartekst.`;

const COOPERATION_TOOL = {
  name: "emit_cooperation_draft",
  description: "Returnerer et strukturert samarbeidsforslag. ALL output går gjennom dette verktøyet — ikke svar med fritekst i tillegg.",
  input_schema: {
    type: "object" as const,
    properties: {
      dealHeadline: {
        type: "string",
        description: "1 linje, maks 90 tegn. Oppsummerer avtalen.",
      },
      openingPitch: {
        type: "string",
        description: "1-2 setninger producer kan starte sitt første kontaktforslag med.",
      },
      weProposeToOffer: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 7,
        description: "Hva kunden tilbyr motparten. Konkret med tall.",
      },
      theyOffer: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 7,
        description: "Hva motparten gir tilbake. Konkret med tall.",
      },
      commercialFraming: {
        type: "string",
        description: "2-3 setninger om hvorfor avtalen er gjensidig fornuftig.",
      },
      draftAgreementParagraphs: {
        type: "array",
        items: { type: "string" },
        minItems: 4,
        maxItems: 6,
        description: "Nummererte avtaleparagrafer i formelt utkast-språk. Hver paragraf starter med 'Partene er enige om...' eller tilsvarende formell innledning.",
      },
      riskNotes: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 5,
        description: "Risikofaktorer producer må sjekke før signering.",
      },
      nextSteps: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 5,
        description: "Konkrete handlinger producer skal gjøre i dag/uka.",
      },
    },
    required: [
      "dealHeadline",
      "openingPitch",
      "weProposeToOffer",
      "theyOffer",
      "commercialFraming",
      "draftAgreementParagraphs",
      "riskNotes",
      "nextSteps",
    ],
  },
};

function buildUserMessage(input: MerchCooperationInput): string {
  const dealLabel: Record<MerchDealType, string> = {
    sponsor: "sponsoravtale",
    kit_supplier: "kit-supplier-avtale",
    cross_promo: "kryss-promotering",
    give_away: "give-away-/aktivering-avtale",
    long_term_partnership: "langsiktig samarbeidsavtale",
  };
  const partnerLabel: Record<MerchPartnerType, string> = {
    sportsklubb: "sportsklubb",
    event: "arrangement / event",
    skole: "skole / utdanningsinstitusjon",
    forening: "forening / lokallag",
    bedrift: "bedriftspartner",
  };

  const lines: string[] = [
    `Lag et profesjonelt utkast til ${dealLabel[input.dealType]} mellom kunden og motparten.`,
    ``,
    `## Kunden`,
    `- Navn: ${input.customerName}`,
  ];
  if (input.customerIndustry) lines.push(`- Bransje: ${input.customerIndustry}`);
  if (input.customerBriefSummary) lines.push(`- Brief-sammendrag: ${input.customerBriefSummary}`);
  lines.push(``, `## Motpart`, `- Navn: ${input.partnerName}`, `- Type: ${partnerLabel[input.partnerType]}`);
  if (input.partnerNotes) lines.push(`- Notater fra producer: ${input.partnerNotes}`);
  if (input.supplierContext) {
    lines.push(
      ``,
      `## Tiltenkt merch-leverandør`,
      `- ${input.supplierContext.name}`,
      `- Kapasitet: ${input.supplierContext.techniques.join(", ") || "ukjent teknikk"}`,
      `- Produkter: ${input.supplierContext.productCategories.join(", ") || "ukjent kategori"}`,
    );
  }
  lines.push(
    ``,
    `## Output-krav`,
    `Returner alt strukturert via verktøyet emit_cooperation_draft. Ikke svar i klartekst.`,
  );
  return lines.join("\n");
}

export async function generateMerchCooperationDraft(
  input: MerchCooperationInput,
): Promise<MerchCooperationDraft> {
  if (!claudeAgentEnabled()) {
    throw new MerchCooperationError(503, "Claude-agenten er slått av (ROLE_ROOM_AGENT_CLAUDE_ENABLED).");
  }
  if (!input.customerName?.trim() || !input.partnerName?.trim()) {
    throw new MerchCooperationError(400, "customerName og partnerName er påkrevd.");
  }

  const userMessage = buildUserMessage(input);
  const startedAt = Date.now();

  let raw;
  try {
    raw = await runClaudeAgent({
      cachedSystem: SYSTEM_PROMPT,
      userMessage,
      tools: [COOPERATION_TOOL],
      // Empirically: Claude Sonnet 4-6 needs ~3000 tokens to fully fill
      // the cooperation tool with Norwegian (long words) including 6
      // §-paragrafer + 5 risk + 5 next-steps. 1800 truncated mid-output
      // and triggered the "manglende fyldighet" 502.
      maxTokens: 3500,
    });
  } catch (err) {
    await logAiCall(input.pool, {
      projectId: input.projectId,
      userId: input.userId,
      processor: "anthropic",
      model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || "claude-sonnet-4-6",
      action: "merch_cooperation_draft",
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - startedAt,
    });
    throw new MerchCooperationError(502, err instanceof Error ? err.message : String(err));
  }

  const toolCall = raw.toolUses.find((t) => t.name === "emit_cooperation_draft");
  if (!toolCall) {
    await logAiCall(input.pool, {
      projectId: input.projectId,
      userId: input.userId,
      processor: "anthropic",
      model: raw.model,
      action: "merch_cooperation_draft",
      status: "error",
      errorMessage: "Claude returned no tool_use; refusing to ship freeform output",
      latencyMs: raw.latencyMs,
    });
    throw new MerchCooperationError(
      502,
      "Modellen returnerte ikke et strukturert forslag — be brukeren prøve igjen eller endre input.",
    );
  }

  const t = toolCall.input as Partial<MerchCooperationDraft>;

  // Defensive check: every required array must be non-empty. Bail out
  // hard rather than ship a half-empty form that looks unprofessional.
  if (
    !t.dealHeadline
    || !t.openingPitch
    || !t.commercialFraming
    || !Array.isArray(t.weProposeToOffer)
    || !Array.isArray(t.theyOffer)
    || !Array.isArray(t.draftAgreementParagraphs)
    || !Array.isArray(t.riskNotes)
    || !Array.isArray(t.nextSteps)
    || t.weProposeToOffer.length < 3
    || t.theyOffer.length < 3
    || t.draftAgreementParagraphs.length < 4
    || t.riskNotes.length < 3
    || t.nextSteps.length < 3
  ) {
    await logAiCall(input.pool, {
      projectId: input.projectId,
      userId: input.userId,
      processor: "anthropic",
      model: raw.model,
      action: "merch_cooperation_draft",
      status: "error",
      errorMessage: "Tool output failed minimum-shape validation",
      latencyMs: raw.latencyMs,
    });
    throw new MerchCooperationError(
      502,
      "Modellen returnerte et utkast som mangler fyldighet — prøv igjen.",
    );
  }

  await logAiCall(input.pool, {
    projectId: input.projectId,
    userId: input.userId,
    processor: "anthropic",
    model: raw.model,
    action: "merch_cooperation_draft",
    status: "ok",
    promptTokens: raw.usage.inputTokens,
    completionTokens: raw.usage.outputTokens,
    totalTokens: (raw.usage.inputTokens ?? 0) + (raw.usage.outputTokens ?? 0),
    latencyMs: raw.latencyMs,
    fieldCategories: [
      "merch_cooperation",
      `partner_type:${input.partnerType}`,
      `deal_type:${input.dealType}`,
    ],
  });

  return {
    generatedAt: new Date().toISOString(),
    model: raw.model,
    dealHeadline: String(t.dealHeadline).trim(),
    openingPitch: String(t.openingPitch).trim(),
    weProposeToOffer: (t.weProposeToOffer ?? []).map(String),
    theyOffer: (t.theyOffer ?? []).map(String),
    commercialFraming: String(t.commercialFraming).trim(),
    draftAgreementParagraphs: (t.draftAgreementParagraphs ?? []).map(String),
    riskNotes: (t.riskNotes ?? []).map(String),
    nextSteps: (t.nextSteps ?? []).map(String),
  };
}
