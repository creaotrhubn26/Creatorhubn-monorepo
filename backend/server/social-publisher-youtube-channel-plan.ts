/**
 * AI-veiledet kanal-plan for produsenter som skal opprette en ny
 * YouTube-kanal — eller forbedre en eksisterende én.
 *
 * Bakgrunn:
 *   YouTube-policy tillater ikke automatisk kanal-opprettelse via API,
 *   så vi kan ikke lage kanalen for brukeren. Det vi KAN gjøre er å
 *   redusere "blank slate"-problemet ved å gi brukeren et gjennomtenkt
 *   utgangspunkt: navn, beskrivelse, content pillars, første 5 video-
 *   ideer, kadens og channel-trailer-konsept — alt formet av kundens
 *   bransje, tone, målgruppe og eksisterende brand-signaler.
 *
 * Datakilde:
 *   Vi henter brand_snapshot fra role_room_feed_plans (samme JSON som
 *   Feed Planner allerede bruker). Hvis YouTube-feed-planen ikke finnes,
 *   faller vi tilbake til Instagram → Facebook → LinkedIn for samme
 *   prosjekt. Dette gjør at planen "kjenner" produsentens kunde uansett
 *   hvilken plattform Feed Planner først ble brukt for.
 *
 * Sikkerhet/UX:
 *   - Returnerer alltid strukturert JSON som frontend kan rendre uten
 *     parsing av fri tekst.
 *   - Faller tilbake til en deterministisk "starter-plan" hvis Claude
 *     er utilgjengelig — slik at UX aldri bryter sømmen.
 *   - All tekst er på norsk for konsistens med resten av agent-UI.
 */

import type { Pool } from 'pg';

export interface YouTubeChannelPlanVideoIdea {
  title: string;
  hook: string;
  description: string;
  durationSeconds: number;
  contentPillar: string;
  callToAction: string;
}

export interface YouTubeChannelPlanContentPillar {
  name: string;
  description: string;
  exampleTopics: string[];
}

export interface YouTubeChannelPlan {
  channelName: string;
  alternativeNames: string[];
  handleSuggestion: string;
  tagline: string;
  description: string;
  keywords: string[];
  contentPillars: YouTubeChannelPlanContentPillar[];
  firstVideoIdeas: YouTubeChannelPlanVideoIdea[];
  channelTrailerConcept: {
    hook: string;
    storyBeats: string[];
    durationSeconds: number;
    callToAction: string;
  };
  postingCadence: {
    frequency: string;
    bestDays: string[];
    bestTimeWindows: string[];
    rationale: string;
  };
  visualIdentity: {
    bannerConcept: string;
    avatarConcept: string;
    thumbnailStyle: string;
    colorPaletteHint: string;
  };
  growthAdvice: string[];
  generatedAt: string;
  source: 'claude' | 'fallback';
}

export interface ExistingSocialPresence {
  platform: string;
  url: string;
  handle: string | null;
  status: 'verified' | 'likely' | 'needs_review' | 'rejected';
  confidence?: number;
}

interface BrandContext {
  companyName: string | null;
  websiteUrl: string | null;
  industry: string | null;
  subIndustry: string | null;
  businessModel: string | null;
  summary: string | null;
  offerings: string[];
  targetAudience: string[];
  toneAndBrandSignals: string[];
  contentCategory: string | null;
  productionApproach: string | null;
  /** Sosiale kontoer oppdaget fra kundens nettside under bootstrap.
   *  Lar plan-generator forstå nåværende tilstedeværelse og bygge en
   *  plan som er konsistent med eksisterende handles/tone, og som
   *  utfyller framfor å duplisere etablert content. */
  existingSocialProfiles: ExistingSocialPresence[];
  raw: Record<string, unknown> | null;
}

const PLATFORM_FALLBACK_ORDER: Array<'youtube' | 'instagram' | 'facebook_page' | 'linkedin'> = [
  'youtube',
  'instagram',
  'facebook_page',
  'linkedin',
];

async function loadBrandContextForProject(
  pool: Pool,
  projectId: string,
): Promise<BrandContext | null> {
  for (const platform of PLATFORM_FALLBACK_ORDER) {
    try {
      const result = await pool.query<{ brand_snapshot: unknown }>(
        `SELECT brand_snapshot FROM role_room_feed_plans
          WHERE project_id = $1 AND platform = $2
          LIMIT 1`,
        [projectId, platform],
      );
      const snapshot = result.rows[0]?.brand_snapshot;
      if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
        const raw = snapshot as Record<string, unknown>;
        return mapBrandContext(raw);
      }
    } catch {
      // Try next platform
    }
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.length > 0);
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function mapBrandContext(raw: Record<string, unknown>): BrandContext {
  // brand_snapshot kan ha forskjellige shapes avhengig av hvilken
  // versjon av Feed Planner som lagret den. Vi prøver flere kjente
  // path-er for å hente companyProfile og fallback-felter.
  const cp =
    (raw.companyProfile && typeof raw.companyProfile === 'object'
      ? (raw.companyProfile as Record<string, unknown>)
      : null) ?? null;

  // existingSocialProfiles kan være på rotnivå (Feed Planner-versjonen
  // som ble lagret med utvidet snapshot) eller manglende (eldre
  // snapshots). Fallback til socialProfileCandidates hvis tilgjengelig.
  const existingSocialProfiles: ExistingSocialPresence[] = [];
  const fromRoot = Array.isArray(raw.existingSocialProfiles)
    ? raw.existingSocialProfiles
    : Array.isArray(raw.socialProfileCandidates)
      ? raw.socialProfileCandidates
      : [];
  for (const entry of fromRoot) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const platform = asNullableString(e.platform);
    const url = asNullableString(e.url) ?? asNullableString(e.canonicalUrl);
    if (!platform || !url) continue;
    const status =
      e.status === 'verified' || e.status === 'likely' || e.status === 'needs_review' || e.status === 'rejected'
        ? (e.status as 'verified' | 'likely' | 'needs_review' | 'rejected')
        : 'needs_review';
    if (status !== 'verified' && status !== 'likely') continue;
    existingSocialProfiles.push({
      platform,
      url,
      handle: asNullableString(e.handle),
      status,
      confidence: typeof e.confidence === 'number' ? e.confidence : undefined,
    });
  }

  return {
    companyName:
      asNullableString(cp?.companyName) ??
      asNullableString(raw.companyName) ??
      asNullableString(raw.brandName),
    websiteUrl: asNullableString(cp?.websiteUrl) ?? asNullableString(raw.websiteUrl),
    industry: asNullableString(cp?.industry) ?? asNullableString(raw.industry),
    subIndustry: asNullableString(cp?.subIndustry) ?? asNullableString(raw.subIndustry),
    businessModel: asNullableString(cp?.businessModel) ?? asNullableString(raw.businessModel),
    summary: asNullableString(cp?.summary) ?? asNullableString(raw.summary),
    offerings: cp ? asStringArray(cp.offerings) : asStringArray(raw.offerings),
    targetAudience: cp ? asStringArray(cp.targetAudience) : asStringArray(raw.targetAudience),
    toneAndBrandSignals: cp
      ? asStringArray(cp.toneAndBrandSignals)
      : asStringArray(raw.toneAndBrandSignals),
    contentCategory: asNullableString(cp?.contentCategory) ?? asNullableString(raw.contentCategory),
    productionApproach:
      asNullableString(cp?.productionApproach) ?? asNullableString(raw.productionApproach),
    existingSocialProfiles,
    raw,
  };
}

let cachedAnthropicClient: unknown = null;

async function getAnthropicClient(): Promise<any> {
  if (cachedAnthropicClient) return cachedAnthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  // @ts-ignore — optional SDK
  const mod: any = await import('@anthropic-ai/sdk').catch(() => null);
  if (!mod) return null;
  const AnthropicCtor = mod.default ?? mod.Anthropic;
  cachedAnthropicClient = new AnthropicCtor({ apiKey });
  return cachedAnthropicClient;
}

const SYSTEM_PROMPT =
  'Du er The Role Room Agent, en kreativ produsent-rådgiver med dyp YouTube-erfaring. Du hjelper innholdsprodusenter i Norge med å bygge gjennomtenkte YouTube-kanaler for sine kunder. Lag konkrete, handlingsbare kanal-planer på norsk. Returner kun gyldig JSON som matcher schemaet brukeren sender. Ingen markdown, ingen forklarende tekst. Vær spesifikk for kundens bransje, tone og målgruppe — ikke generisk.';

const PLAN_CONSTRAINTS: string[] = [
  'channelName skal være konkret og kort (2–4 ord), passe i header og være søkbart.',
  'alternativeNames: 3 varianter med ulik vinkel (descriptiv, kreativ, navn-først).',
  'handleSuggestion må være alfanumerisk uten mellomrom, lowercase, max 30 tegn, prefix @.',
  'Hvis existingSocialProfiles finnes, gjenbruk samme handle som Instagram/TikTok hvor det er mulig. Konsistens på tvers av plattformer er viktigere enn kreativ variasjon.',
  'description skal være 200–400 tegn, åpne med kjernebudskapet, slutt med CTA om å abonnere.',
  'keywords: 8–12 norske søkeord som matcher bransje + målgruppe.',
  'contentPillars: nøyaktig 3 søyler. Hver søyle: navn (1–3 ord), beskrivelse (1 setning), 3 eksempel-temaer.',
  'Hvis kunden allerede har Instagram eller TikTok, skal pillars utfylle (long-form, dypere) framfor å duplisere kort innhold som funker bedre der.',
  'Hvis kunden allerede har LinkedIn, kan YouTube-pillars være mer uformelle og bak-kulissene-orienterte mens LinkedIn holdes faglig.',
  'firstVideoIdeas: nøyaktig 5 ideer. Variert: 1 introduksjon, 2 howto/utdannende, 1 case/storytelling, 1 inspirasjon. durationSeconds 60–600.',
  'channelTrailerConcept: 30–90 sekunder, hook-først, 3–5 story beats, tydelig CTA.',
  'postingCadence: realistisk for én produsent (1–3 uke). Begrunn frekvens.',
  'visualIdentity: konkrete forslag basert på brandets eksisterende tone og estetikk. Hvis kunden har eksisterende sosiale profiler, skal banner/avatar matche tonen.',
  'growthAdvice: 4–6 norske, handlingsbare råd som passer akkurat denne nisjen. Hvis existingSocialProfiles finnes, inkluder minst ett råd om cross-promotion fra de aktive kanalene til den nye YouTube-kanalen.',
  'Skriv aldri "din kanal" eller "din nisje" — bruk faktiske brand-navn og industri-termer.',
];

export async function generateYouTubeChannelPlan(
  pool: Pool,
  projectId: string,
  _userId: string,
): Promise<YouTubeChannelPlan | null> {
  const brand = await loadBrandContextForProject(pool, projectId);
  if (!brand || !brand.companyName) {
    // Without any brand context we can't produce a meaningful plan.
    // Surface a clear fallback so frontend can show "complete your
    // bootstrap first" rather than a generic plan.
    return null;
  }

  const aiPlan = await requestClaudeChannelPlan(brand);
  if (aiPlan) return aiPlan;

  // Claude unavailable — return a deterministic starter-plan so UX
  // never breaks. Brand-info still personalizes it.
  return buildFallbackPlan(brand);
}

async function requestClaudeChannelPlan(
  brand: BrandContext,
): Promise<YouTubeChannelPlan | null> {
  const client = await getAnthropicClient();
  if (!client) return null;
  const model = process.env.ROLE_ROOM_YOUTUBE_PLAN_MODEL || 'claude-sonnet-4-5';

  const userPayload = {
    task: 'Lag en gjennomtenkt YouTube-kanal-plan for kundens nye kanal.',
    constraints: PLAN_CONSTRAINTS,
    schema: {
      channelName: 'string',
      alternativeNames: ['string'],
      handleSuggestion: 'string',
      tagline: 'string',
      description: 'string',
      keywords: ['string'],
      contentPillars: [
        {
          name: 'string',
          description: 'string',
          exampleTopics: ['string'],
        },
      ],
      firstVideoIdeas: [
        {
          title: 'string',
          hook: 'string',
          description: 'string',
          durationSeconds: 'number',
          contentPillar: 'string',
          callToAction: 'string',
        },
      ],
      channelTrailerConcept: {
        hook: 'string',
        storyBeats: ['string'],
        durationSeconds: 'number',
        callToAction: 'string',
      },
      postingCadence: {
        frequency: 'string',
        bestDays: ['string'],
        bestTimeWindows: ['string'],
        rationale: 'string',
      },
      visualIdentity: {
        bannerConcept: 'string',
        avatarConcept: 'string',
        thumbnailStyle: 'string',
        colorPaletteHint: 'string',
      },
      growthAdvice: ['string'],
    },
    brand: {
      companyName: brand.companyName,
      websiteUrl: brand.websiteUrl,
      industry: brand.industry,
      subIndustry: brand.subIndustry,
      businessModel: brand.businessModel,
      summary: brand.summary,
      offerings: brand.offerings,
      targetAudience: brand.targetAudience,
      toneAndBrandSignals: brand.toneAndBrandSignals,
      contentCategory: brand.contentCategory,
      productionApproach: brand.productionApproach,
      existingSocialProfiles: brand.existingSocialProfiles,
      hasYouTubePresenceAlready: brand.existingSocialProfiles.some(
        (p) => p.platform === 'youtube',
      ),
    },
  };

  try {
    const response = await Promise.race([
      client.messages.create({
        model,
        max_tokens: 3000,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: JSON.stringify(userPayload),
              },
            ],
          },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('claude_channel_plan_timeout')), 45_000),
      ),
    ]);

    const blocks = (response as any).content ?? [];
    const text = blocks
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();
    const parsed = extractJson(text);
    if (!parsed) return null;
    return normalizePlan(parsed, 'claude');
  } catch (error) {
    console.warn('[youtube-channel-plan] Claude failed', error);
    return null;
  }
}

function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const raw = fenceMatch ? fenceMatch[1] : trimmed;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        const slice = raw.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(slice);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizePlan(
  raw: Record<string, unknown>,
  source: 'claude' | 'fallback',
): YouTubeChannelPlan {
  const cp = (raw.contentPillars as unknown[]) ?? [];
  const fv = (raw.firstVideoIdeas as unknown[]) ?? [];
  const trailer =
    (raw.channelTrailerConcept && typeof raw.channelTrailerConcept === 'object'
      ? (raw.channelTrailerConcept as Record<string, unknown>)
      : {}) ?? {};
  const cadence =
    (raw.postingCadence && typeof raw.postingCadence === 'object'
      ? (raw.postingCadence as Record<string, unknown>)
      : {}) ?? {};
  const visual =
    (raw.visualIdentity && typeof raw.visualIdentity === 'object'
      ? (raw.visualIdentity as Record<string, unknown>)
      : {}) ?? {};

  return {
    channelName: asNullableString(raw.channelName) ?? 'Ny kanal',
    alternativeNames: asStringArray(raw.alternativeNames).slice(0, 5),
    handleSuggestion: asNullableString(raw.handleSuggestion) ?? '@kanal',
    tagline: asNullableString(raw.tagline) ?? '',
    description: asNullableString(raw.description) ?? '',
    keywords: asStringArray(raw.keywords).slice(0, 15),
    contentPillars: cp
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .slice(0, 3)
      .map((p) => ({
        name: asNullableString(p.name) ?? 'Søyle',
        description: asNullableString(p.description) ?? '',
        exampleTopics: asStringArray(p.exampleTopics).slice(0, 5),
      })),
    firstVideoIdeas: fv
      .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
      .slice(0, 5)
      .map((v) => ({
        title: asNullableString(v.title) ?? 'Video',
        hook: asNullableString(v.hook) ?? '',
        description: asNullableString(v.description) ?? '',
        durationSeconds: typeof v.durationSeconds === 'number' ? v.durationSeconds : 120,
        contentPillar: asNullableString(v.contentPillar) ?? '',
        callToAction: asNullableString(v.callToAction) ?? 'Abonner for mer',
      })),
    channelTrailerConcept: {
      hook: asNullableString(trailer.hook) ?? '',
      storyBeats: asStringArray(trailer.storyBeats).slice(0, 6),
      durationSeconds:
        typeof trailer.durationSeconds === 'number' ? trailer.durationSeconds : 60,
      callToAction: asNullableString(trailer.callToAction) ?? 'Abonner',
    },
    postingCadence: {
      frequency: asNullableString(cadence.frequency) ?? '1 video per uke',
      bestDays: asStringArray(cadence.bestDays).slice(0, 7),
      bestTimeWindows: asStringArray(cadence.bestTimeWindows).slice(0, 5),
      rationale: asNullableString(cadence.rationale) ?? '',
    },
    visualIdentity: {
      bannerConcept: asNullableString(visual.bannerConcept) ?? '',
      avatarConcept: asNullableString(visual.avatarConcept) ?? '',
      thumbnailStyle: asNullableString(visual.thumbnailStyle) ?? '',
      colorPaletteHint: asNullableString(visual.colorPaletteHint) ?? '',
    },
    growthAdvice: asStringArray(raw.growthAdvice).slice(0, 8),
    generatedAt: new Date().toISOString(),
    source,
  };
}

function buildFallbackPlan(brand: BrandContext): YouTubeChannelPlan {
  const name = brand.companyName ?? 'Kanal';
  const industry = brand.industry ?? 'bransje';
  const audience =
    brand.targetAudience[0] ?? (brand.businessModel === 'B2B' ? 'fagfolk' : 'kunder');
  const handle = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 28);
  const offering = brand.offerings[0] ?? 'tjenestene våre';
  const tone = brand.toneAndBrandSignals[0] ?? 'profesjonell';

  return normalizePlan(
    {
      channelName: name,
      alternativeNames: [`${name} TV`, `${name} Studio`, `${name} Insider`],
      handleSuggestion: `@${handle || 'kanal'}`,
      tagline: `Innhold om ${industry} fra ${name}`,
      description: `Velkommen til ${name}. Her deler vi det vi lærer i ${industry} og viser hvordan ${offering} faktisk fungerer for ${audience}. Ny video hver uke — abonner for å henge med.`,
      keywords: [industry, name, audience, offering, brand.subIndustry, brand.contentCategory]
        .filter((s): s is string => !!s)
        .slice(0, 12),
      contentPillars: [
        {
          name: 'Bak kulissene',
          description: `Hvordan ${name} jobber i hverdagen — virkelig, ikke glanset.`,
          exampleTopics: [
            `En dag på jobb hos ${name}`,
            'Hvordan vi løste en vanskelig kundecase',
            'Verktøyene vi faktisk bruker',
          ],
        },
        {
          name: 'Kunde-historier',
          description: `Konkrete eksempler som viser verdien av ${offering}.`,
          exampleTopics: [
            'Før og etter — en kundecase',
            'Vanlige feil vi ser i bransjen',
            'Spørsmål kunder alltid stiller',
          ],
        },
        {
          name: 'Bransje-innsikt',
          description: `${industry} forklart for ${audience}.`,
          exampleTopics: [
            'Trender vi følger med på',
            'Hva endrer seg i bransjen',
            'Begreper du bør kjenne',
          ],
        },
      ],
      firstVideoIdeas: [
        {
          title: `Hei, vi er ${name}`,
          hook: `Hvis du driver med ${industry}, kommer du til å like denne kanalen.`,
          description: `Kort intro til hvem ${name} er, hvem vi hjelper, og hva du kan forvente i kanalen.`,
          durationSeconds: 90,
          contentPillar: 'Bak kulissene',
          callToAction: 'Abonner og slå på varsler',
        },
        {
          title: `Slik kommer du i gang med ${offering}`,
          hook: 'Det første du må gjøre er ikke det du tror.',
          description: `Praktisk guide steg for steg, basert på det vi ser fungerer for ${audience}.`,
          durationSeconds: 360,
          contentPillar: 'Bransje-innsikt',
          callToAction: 'Last ned sjekklisten i beskrivelsen',
        },
        {
          title: `3 vanlige feil i ${industry}`,
          hook: 'Den siste er den dyreste.',
          description: `Konkrete feil vi ser hos kunder, hva som forårsaker dem, og hvordan ${name} løser dem.`,
          durationSeconds: 300,
          contentPillar: 'Bransje-innsikt',
          callToAction: 'Kommenter hvilken du har gjort',
        },
        {
          title: 'Kunde-case: hvordan vi løste det',
          hook: 'Kunden hadde gitt opp før de ringte oss.',
          description: `Storytelling-format som viser verdien av ${offering} gjennom en konkret jobb.`,
          durationSeconds: 480,
          contentPillar: 'Kunde-historier',
          callToAction: 'Bestill en samtale i lenken',
        },
        {
          title: `Slik ser en uke hos ${name} ut`,
          hook: 'Spoiler: det er ikke det du tror.',
          description:
            'Vlog-stil med klipp fra møter, kundebesøk og produksjon. Bygger tillit gjennom transparens.',
          durationSeconds: 240,
          contentPillar: 'Bak kulissene',
          callToAction: 'Følg for flere bak-kulissene videoer',
        },
      ],
      channelTrailerConcept: {
        hook: `Hvis du jobber med ${industry}, kan denne kanalen spare deg for mye tid.`,
        storyBeats: [
          `Hvem ${name} er og hvem vi hjelper`,
          'Hva du kommer til å lære her',
          'Eksempel på en typisk video',
          'Publiseringskadens og hva som er neste',
          'Tydelig CTA: abonner',
        ],
        durationSeconds: 60,
        callToAction: 'Abonner og se neste video',
      },
      postingCadence: {
        frequency: '1 video per uke',
        bestDays: ['tirsdag', 'torsdag'],
        bestTimeWindows: ['07–09', '19–21'],
        rationale: `Ukentlig kadens er bærekraftig for én produsent og bygger algorisme-momentum. ${audience} er mest aktive morgen og kveld på hverdager.`,
      },
      visualIdentity: {
        bannerConcept: `Ren ${tone} layout med ${name}-logo, kort tagline og publiseringsdag.`,
        avatarConcept: `${name}-logo på solid bakgrunnsfarge fra brandets palett.`,
        thumbnailStyle: 'Stort tekst-overlegg (3–5 ord), ansikts-shot, høy kontrast.',
        colorPaletteHint: `Bygg på ${tone} palett fra eksisterende brand — to primære, én aksent.`,
      },
      growthAdvice: [
        'Lag en thumbnail-mal og hold deg til den de første 20 videoene.',
        'Pin en kommentar med CTA og lenke i hver video.',
        'Klipp Shorts (under 60 sek) fra hver lange video som teaser.',
        'Svar på alle kommentarer de første 24 timene — algoritmen belønner det.',
        'Lag en spilleliste per content pillar for bedre watch-time per session.',
      ],
    },
    'fallback',
  );
}
