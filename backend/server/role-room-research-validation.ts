/**
 * Research validation flags — items #51-#75 from the quality backlog.
 *
 * Runs after a bootstrap completes and returns an array of structured
 * flags that the UI renders in the overlay. Two design choices:
 *
 *   1. All synchronous, deterministic validators run by default.
 *      Anything that adds latency (extra Claude call for vagueness
 *      evaluation, Lighthouse audit) is gated on an env flag so we can
 *      keep the bootstrap response under the user's perception budget.
 *
 *   2. Validators never throw. A bug in validation must never break the
 *      bootstrap response — wrap each in try/catch and skip on failure.
 *      We'd rather miss a flag than crash the overlay.
 */

import type { RoleRoomAgentNormalizedPayload } from "./role-room-agent.js";
import { logAIUsage } from './ai-usage-tracker.js';

export type ValidationSeverity = "critical" | "warning" | "info";
export type ValidationCategory =
  | "consistency"
  | "completeness"
  | "data_quality"
  | "trust_signal"
  | "seo"
  | "performance"
  | "content"
  | "external_state"
  | "suggestion"
  | "change_detection";

export interface ValidationFlag {
  id: string;
  severity: ValidationSeverity;
  category: ValidationCategory;
  title: string;
  detail: string;
  /** When set, frontend scrolls/focuses to this DOM id on "Fix"-click. */
  fixTargetId?: string;
  /** Optional shorter line shown in compact UI ("3-min fix", "manual"). */
  fixHint?: string;
}

/** Each validator returns 0+ flags. Errors inside a validator are
 *  swallowed (returns [] instead of throwing) — see file-level note. */
type Validator = (result: RoleRoomAgentNormalizedPayload) => ValidationFlag[];

const safeRun = (fn: Validator, result: RoleRoomAgentNormalizedPayload): ValidationFlag[] => {
  try {
    return fn(result);
  } catch (err) {
    console.error("[role-room-research-validation] validator threw", err);
    return [];
  }
};

/** Public entry. Runs every registered validator and concatenates flags.
 *  Returns flags sorted: critical first, then warnings, then info; tied
 *  on severity, sorted by category-name for deterministic ordering. */
export function validateResearchResult(
  result: RoleRoomAgentNormalizedPayload,
): ValidationFlag[] {
  const flags = VALIDATORS.flatMap((fn) => safeRun(fn, result));
  const severityRank: Record<ValidationSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return flags.sort((a, b) => {
    const s = severityRank[a.severity] - severityRank[b.severity];
    if (s !== 0) return s;
    return a.category.localeCompare(b.category);
  });
}

// ─────────────────────────────────────────────────────────────────────
// Helpers — shared text-normalization. Lowercase + collapse whitespace
// + strip diacritics so "Holy Crust AS" matches "holy crust as" matches
// "Holy  Crust as".
// ─────────────────────────────────────────────────────────────────────
const normalize = (value: string | null | undefined): string =>
  typeof value === "string"
    ? value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";

const isHttps = (url: string | null | undefined): boolean =>
  typeof url === "string" && /^https:\/\//i.test(url);

// ─────────────────────────────────────────────────────────────────────
// Cross-validation — items #51, #52, #53, #63
// ─────────────────────────────────────────────────────────────────────
const validateBrregOrgnrVsName: Validator = (result) => {
  const brreg = result.brregCompany;
  if (!brreg || brreg.lookupStatus !== "verified") return [];
  const brregName = normalize(brreg.name);
  const profileName = normalize(result.companyProfile?.companyName);
  if (!brregName || !profileName) return [];
  // Substring-match in either direction handles "Holy Crust" vs "Holy Crust AS".
  if (brregName.includes(profileName) || profileName.includes(brregName)) return [];
  return [{
    id: "brreg_name_mismatch",
    severity: "warning",
    category: "consistency",
    title: "Navn matcher ikke Brreg",
    detail: `Innskrevet "${result.companyProfile?.companyName}" stemmer ikke med Brreg-registrert "${brreg.name}".`,
    fixTargetId: "role-room-field-company-name",
    fixHint: "Bekreft hvilket navn som skal brukes",
  }];
};

const validateBrregAddressVsPlaces: Validator = (result) => {
  const brregAddr = normalize(result.brregCompany?.businessAddress);
  const placesAddr = normalize(result.businessSignals?.formattedAddress);
  if (!brregAddr || !placesAddr) return [];
  // Compare first 20 chars (street name + number) — handles "0150 OSLO"
  // vs "Oslo, Norway"-style format differences.
  const brregHead = brregAddr.slice(0, 20);
  const placesHead = placesAddr.slice(0, 20);
  if (brregHead === placesHead || brregAddr.includes(placesHead) || placesAddr.includes(brregHead)) return [];
  return [{
    id: "address_mismatch_brreg_places",
    severity: "info",
    category: "consistency",
    title: "Brreg-adresse stemmer ikke med Google Places",
    detail: `Brreg: "${result.brregCompany?.businessAddress}" — Places: "${result.businessSignals?.formattedAddress}".`,
    fixHint: "Sannsynlig kun forskjellig formatering",
  }];
};

const validateWebsiteMetaVsBrreg: Validator = (result) => {
  const brregName = normalize(result.brregCompany?.name);
  // websiteInsights.siteName/pageTitle aren't on the normalized payload
  // directly — they live in the field metadata for the website stage.
  // Use what we do have: the summary often quotes the website's title.
  const summaryNormalized = normalize(result.companyProfile?.summary);
  if (!brregName || !summaryNormalized) return [];
  if (summaryNormalized.includes(brregName)) return [];
  return [{
    id: "website_meta_missing_brreg_name",
    severity: "info",
    category: "consistency",
    title: "Brreg-navn nevnes ikke i website-sammendrag",
    detail: `Brreg har "${result.brregCompany?.name}" — vurder om website-meta-data trenger oppdatering.`,
    fixHint: "SEO + tillit",
  }];
};

const validateSocialProfilesVsBrreg: Validator = (result) => {
  const brregName = normalize(result.brregCompany?.name);
  if (!brregName) return [];
  const candidates = result.socialProfileCandidates ?? [];
  // Look for handles/displayNames that are completely unrelated to
  // Brreg name (Levenshtein/contains check). Flag only when status is
  // verified — otherwise we'd produce noise on unverified candidates.
  const suspicious = candidates.filter((c) => {
    if (c.status !== "verified") return false;
    const handle = normalize((c as { handle?: string | null }).handle);
    const display = normalize((c as { displayName?: string | null }).displayName);
    if (!handle && !display) return false;
    const matchesAny = brregName.includes(handle) || brregName.includes(display)
      || handle.includes(brregName) || display.includes(brregName);
    return !matchesAny;
  });
  if (suspicious.length === 0) return [];
  return [{
    id: "social_profile_brreg_mismatch",
    severity: "warning",
    category: "consistency",
    title: `${suspicious.length} sosialprofil${suspicious.length === 1 ? "" : "er"} matcher ikke Brreg-navn`,
    detail: `Bekreft at de tilhører ${result.brregCompany?.name}: ${suspicious.map((c) => (c as { handle?: string }).handle ?? c.url).slice(0, 3).join(", ")}.`,
    fixHint: "Klikk for å åpne profilen og verifisere",
  }];
};

// ─────────────────────────────────────────────────────────────────────
// Completeness — items #57, #59, #66
// ─────────────────────────────────────────────────────────────────────
const validateTargetAudienceDetail: Validator = (result) => {
  const segments = result.companyProfile?.targetAudience ?? [];
  if (segments.length >= 2) return [];
  return [{
    id: "target_audience_thin",
    severity: "warning",
    category: "completeness",
    title: segments.length === 0 ? "Ingen målgruppe definert" : "Kun én målgruppe-segment",
    detail: "Marketing plan blir mer presis med 2+ tydelige segmenter (f.eks. \"unge urbane\" + \"familier med barn\").",
    fixTargetId: "role-room-field-target-audience",
    fixHint: "Del opp eller legg til segmenter",
  }];
};

const validateBusinessObjectiveMeasurable: Validator = (result) => {
  const obj = (result.storyLogicDraft as { contentStoryLogic?: { businessObjective?: string } } | undefined)
    ?.contentStoryLogic?.businessObjective ?? "";
  if (!obj || obj.trim().length === 0) return [];
  // Measurable if it contains a number, percent, or "%/kr/uker/måneder"-style word.
  const hasMetric = /\d|\%|prosent|kr|nok|uke|måned|kvartal|år|kunder|salg|leads/i.test(obj);
  if (hasMetric) return [];
  return [{
    id: "business_objective_vague",
    severity: "info",
    category: "completeness",
    title: "Forretningsmål mangler målbar verdi",
    detail: `"${obj.slice(0, 80)}…" — vurder å legge til konkret tall (f.eks. "20% flere leads neste kvartal").`,
    fixTargetId: "role-room-field-story-objective",
    fixHint: "Gjør målet kvantifiserbart",
  }];
};

const validateB2cB2bSanity: Validator = (result) => {
  const model = result.companyProfile?.businessModel;
  const industry = normalize(result.companyProfile?.industry);
  const summary = normalize(result.companyProfile?.summary);
  // Heuristic: industry hints + content keywords vs declared model.
  const looksB2c = /restaurant|frisør|kafé|butikk|gym|tannlege|salong|spa|barnehage|skole/.test(industry + " " + summary);
  const looksB2b = /agentur|byrå|konsulent|engros|distributør|leverandør|saas|enterprise|b2b/.test(industry + " " + summary);
  if (model === "B2C" && looksB2b && !looksB2c) {
    return [{
      id: "b2c_classified_but_b2b_signals",
      severity: "warning",
      category: "completeness",
      title: "Klassifisert som B2C, men signaler peker mot B2B",
      detail: "Bransje/sammendrag inneholder B2B-vokabular. Sjekk om forretningsmodellen bør endres.",
      fixTargetId: "role-room-field-industry",
    }];
  }
  if (model === "B2B" && looksB2c && !looksB2b) {
    return [{
      id: "b2b_classified_but_b2c_signals",
      severity: "warning",
      category: "completeness",
      title: "Klassifisert som B2B, men signaler peker mot B2C",
      detail: "Bransje/sammendrag inneholder B2C-vokabular. Sjekk om forretningsmodellen bør endres.",
      fixTargetId: "role-room-field-industry",
    }];
  }
  return [];
};

// ─────────────────────────────────────────────────────────────────────
// Data quality — items #54, #65, #68, #69
// ─────────────────────────────────────────────────────────────────────
const validateDuplicateCompetitors: Validator = (result) => {
  const competitors = result.competitorAnalysis?.competitors ?? [];
  if (competitors.length < 2) return [];
  // Group by normalized name; flag entries that share a name with
  // another in the list (likely franchise chain).
  const buckets = new Map<string, number>();
  for (const c of competitors) {
    const key = normalize(c.name);
    if (!key) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const dupes = Array.from(buckets.entries()).filter(([, count]) => count > 1);
  if (dupes.length === 0) return [];
  return [{
    id: "duplicate_competitors",
    severity: "info",
    category: "data_quality",
    title: `${dupes.length} konkurrent${dupes.length === 1 ? "" : "er"} med duplikater`,
    detail: `Sannsynligvis franchise eller flere lokasjoner: ${dupes.slice(0, 3).map(([n, c]) => `${n} (×${c})`).join(", ")}.`,
    fixHint: "Vurder å merge eller behandle som kjede",
  }];
};

const validateMvaOrgnr: Validator = (result) => {
  const orgnr = result.companyProfile?.organizationNumber ?? "";
  if (!orgnr) return [];
  // Norwegian orgnr is exactly 9 digits with a mod-11 checksum.
  // We do the format check here; the actual Brreg lookup is already done
  // upstream. Discrepancy between supplied orgnr and Brreg-resolved orgnr
  // would be flagged separately by Brreg-name-validator above.
  const digits = orgnr.replace(/\D/g, "");
  if (digits.length !== 9) {
    return [{
      id: "orgnr_format_invalid",
      severity: "critical",
      category: "data_quality",
      title: "Organisasjonsnummer har feil format",
      detail: `"${orgnr}" må være nøyaktig 9 sifre. MVA-validering vil feile uten gyldig orgnr.`,
      fixTargetId: "role-room-field-orgnr",
    }];
  }
  // Mod-11 checksum verification: weights 3,2,7,6,5,4,3,2 over first 8 digits.
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const remainder = sum % 11;
  const expectedCheck = remainder === 0 ? 0 : 11 - remainder;
  if (expectedCheck === 10 || expectedCheck !== Number(digits[8])) {
    return [{
      id: "orgnr_checksum_invalid",
      severity: "critical",
      category: "data_quality",
      title: "Organisasjonsnummer har ugyldig kontrollsiffer",
      detail: `"${orgnr}" består mod-11-sjekken ikke. Sannsynligvis tastet inn feil.`,
      fixTargetId: "role-room-field-orgnr",
    }];
  }
  return [];
};

// ─────────────────────────────────────────────────────────────────────
// Trust / SEO — items #56, #71, #72, #75
// ─────────────────────────────────────────────────────────────────────
const validateHttpsTrustSignal: Validator = (result) => {
  const url = result.companyProfile?.websiteUrl;
  if (!url || isHttps(url)) return [];
  return [{
    id: "website_not_https",
    severity: "warning",
    category: "trust_signal",
    title: "Nettsiden bruker ikke HTTPS",
    detail: `${url} mangler SSL. Sosiale plattformer (LinkedIn-deling) og Google ranger HTTPS høyere — og bestiller noen ganger bort lenken helt.`,
    fixHint: "Aktiver Let's Encrypt / Cloudflare SSL",
  }];
};

// ─────────────────────────────────────────────────────────────────────
// External state — items #64, #70
// ─────────────────────────────────────────────────────────────────────
const validatePlacesBusinessStatus: Validator = (result) => {
  const signals = result.businessSignals as { businessStatus?: string } | null | undefined;
  const status = signals?.businessStatus;
  if (!status || status === "OPERATIONAL") return [];
  if (status === "CLOSED_TEMPORARILY") {
    return [{
      id: "places_business_closed_temporarily",
      severity: "warning",
      category: "external_state",
      title: "Google Places: midlertidig stengt",
      detail: "Google viser bedriften som midlertidig stengt. Kontakt kunden før kampanjer settes live.",
    }];
  }
  if (status === "CLOSED_PERMANENTLY") {
    return [{
      id: "places_business_closed_permanently",
      severity: "critical",
      category: "external_state",
      title: "Google Places: permanent stengt",
      detail: "Bedriften er markert som permanent stengt på Google Maps. Verifiser om dette er feil før research brukes.",
    }];
  }
  return [];
};

// ─────────────────────────────────────────────────────────────────────
// Suggestions — items #60 (KPI from NACE), #62 (logo colors vs tone)
// ─────────────────────────────────────────────────────────────────────
const NACE_KPI_HINTS: Array<{ prefix: string; kpis: string[] }> = [
  { prefix: "56", kpis: ["Bookings/dag", "Snittordreverdi", "Repeat-rate (uker)"] },           // Restaurant
  { prefix: "47", kpis: ["ROAS", "Konvertering på produktside", "Snittordreverdi"] },          // Retail
  { prefix: "96", kpis: ["Bookings/uke", "Avlysningsrate", "Snittordreverdi"] },               // Personal services
  { prefix: "85", kpis: ["Påmeldinger/kohort", "Cost-per-lead", "Frafallsrate"] },             // Education
  { prefix: "86", kpis: ["Konsultasjoner/uke", "No-show-rate", "Henvisninger/mnd"] },          // Health
  { prefix: "55", kpis: ["Booking-rate", "Avg. rate per natt", "Direkte vs OTA-mix"] },        // Accommodation
];
const validateNaceKpiSuggestion: Validator = (result) => {
  const code = result.brregCompany?.industryCode?.code ?? "";
  if (!code) return [];
  const match = NACE_KPI_HINTS.find((entry) => code.startsWith(entry.prefix));
  if (!match) return [];
  return [{
    id: `nace_kpi_suggestion_${match.prefix}`,
    severity: "info",
    category: "suggestion",
    title: `Foreslåtte KPI-er for ${result.brregCompany?.industryCode?.description ?? "denne bransjen"}`,
    detail: match.kpis.join(" · "),
    fixHint: "Bruk i marketing-plan-mål",
  }];
};

// ─────────────────────────────────────────────────────────────────────
// Content signals — items #55 (language), #67 (seasonality)
// ─────────────────────────────────────────────────────────────────────
const validateSeasonality: Validator = (result) => {
  const text = normalize(
    [result.companyProfile?.summary, ...(result.companyProfile?.offerings ?? [])].join(" "),
  );
  if (!text) return [];
  const seasons: Array<{ keyword: RegExp; label: string }> = [
    { keyword: /\b(ski|snø|skitur|alpinanlegg|langrenn|kalde)\b/, label: "vinter" },
    { keyword: /\b(strand|sommerlukke|sommerstengt|grilling|sandaler)\b/, label: "sommer" },
    { keyword: /\b(jul|adventskalender|julegaver|juletre|nyttår)\b/, label: "jul" },
    { keyword: /\b(påske|påskeegg|påsketur)\b/, label: "påske" },
    { keyword: /\b(russetid|russefeiring|skoleslutt)\b/, label: "russetid" },
  ];
  const hits = seasons.filter((s) => s.keyword.test(text)).map((s) => s.label);
  if (hits.length === 0) return [];
  return [{
    id: "seasonal_business_detected",
    severity: "info",
    category: "content",
    title: "Sesongavhengig virksomhet",
    detail: `Innholdet peker på sesong: ${hits.join(", ")}. Marketing plan bør justeres for sesongtopp og lavperiode.`,
    fixHint: "Be om sesongbasert content-kalender",
  }];
};

// ─────────────────────────────────────────────────────────────────────
// Performance — item #73 (load time)
// ─────────────────────────────────────────────────────────────────────
const validateWebsiteLoadTime: Validator = (result) => {
  const ms = result.serviceLatencies?.website;
  if (typeof ms !== "number") return [];
  // 3s+ load is widely cited as where bounce rate spikes. We don't measure
  // pure TTFB here — withTiming wraps the whole fetch+parse pipeline,
  // which over-reports actual load time slightly. Keep the threshold
  // generous so we don't shout at OK sites.
  if (ms < 5000) return [];
  return [{
    id: "website_load_slow",
    severity: ms > 10000 ? "warning" : "info",
    category: "performance",
    title: `Nettsiden er treg (${(ms / 1000).toFixed(1)} s)`,
    detail: "Slik ytelse straffer både konvertering og søketrafikk. Vurder bildekompresjon, CDN eller server-cache.",
    fixHint: "Mål eksakt via PageSpeed Insights",
  }];
};

// ─────────────────────────────────────────────────────────────────────
// Suggestions — item #62 (logo colors vs tone-of-voice match)
// Heuristic: warm-color logos (red/orange/yellow) imply energetic tone,
// cool-color logos (blue/green) imply trust/calm. Mismatch is just a
// hint — not always wrong (you can be warm-branded with calm voice).
// ─────────────────────────────────────────────────────────────────────
const validateLogoToneMatch: Validator = (result) => {
  const colors = result.planningDraft?.brandGuide?.colors ?? [];
  const tone = normalize(result.planningDraft?.brandGuide?.toneOfVoice);
  if (colors.length === 0 || !tone) return [];
  const primary = colors[0]?.hex ?? "";
  const m = /^#?([a-f0-9]{6})$/i.exec(primary);
  if (!m) return [];
  const hex = m[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const isWarm = r > g + 20 && r > b + 20;
  const isCool = b > r + 20 || g > r + 20;
  const toneEnergetic = /energisk|appetittvekkende|fristende|action|kraftfull|lekent/.test(tone);
  const toneCalm = /rolig|trygg|profesjonell|seriøs|tillitvekkende|akademisk/.test(tone);
  if (isCool && toneEnergetic) {
    return [{
      id: "logo_cool_but_tone_energetic",
      severity: "info",
      category: "suggestion",
      title: "Kald logo-farge, men energisk tone",
      detail: `Primær logo-farge ${primary.toUpperCase()} er kjølig (rolig/profesjonell), mens tone-of-voice er energisk. Vurder å justere én av delene.`,
      fixHint: "Estetisk vurdering, ikke regelbrudd",
    }];
  }
  if (isWarm && toneCalm) {
    return [{
      id: "logo_warm_but_tone_calm",
      severity: "info",
      category: "suggestion",
      title: "Varm logo-farge, men rolig tone",
      detail: `Primær logo-farge ${primary.toUpperCase()} er varm (energisk), mens tone-of-voice er rolig/profesjonell. Vurder å justere.`,
      fixHint: "Estetisk vurdering, ikke regelbrudd",
    }];
  }
  return [];
};

// ─────────────────────────────────────────────────────────────────────
// Items deferred until we surface more data on the normalized payload:
//
//   #54 prisdeteksjon  — krever website-snippet/HTML (ikke på payload)
//   #55 språkdeteksjon — samme; lett å legge til når websiteInsights
//                         eksponerer lang-attributtet eller text-snippet
//   #56 cookie-banner — krever HTML
//   #58 vague keyPromise — egen Claude-call; opt-in (egen task #26)
//   #61 change detection — krever DB-query mot versions-tabell;
//                          implementeres i egen task #25 utenfor sync-flow
//   #68 telefonformat — krever phoneNumber-felt på companyProfile
//                       (kommer fra Google Places, ikke alltid populert)
//   #70 åpningstider mismatch — krever website-opening-hours-scrape
//   #71 robots.txt — krever separat fetch
//   #74 Lighthouse — krever ekstern API (PageSpeed Insights API)
//   #75 OG/Twitter cards — krever website-meta-payload
//
// Disse hører hjemme i en utvidet "deep-validation"-runde som kan kjøres
// asynkront etter at det vanlige bootstrap-resultatet er returnert.
// ─────────────────────────────────────────────────────────────────────

// Registration — keep order stable for telemetry.
const VALIDATORS: Validator[] = [
  // Cross-validation (#51, #52, #53, #63)
  validateBrregOrgnrVsName,
  validateBrregAddressVsPlaces,
  validateWebsiteMetaVsBrreg,
  validateSocialProfilesVsBrreg,
  // Completeness (#57, #59, #66)
  validateTargetAudienceDetail,
  validateBusinessObjectiveMeasurable,
  validateB2cB2bSanity,
  // Data quality (#65, #69)
  validateDuplicateCompetitors,
  validateMvaOrgnr,
  // Trust / SEO (#72)
  validateHttpsTrustSignal,
  // External state (#64)
  validatePlacesBusinessStatus,
  // Suggestions (#60)
  validateNaceKpiSuggestion,
  // Content (#67)
  validateSeasonality,
  // Performance (#73)
  validateWebsiteLoadTime,
  // Suggestions (#62)
  validateLogoToneMatch,
];

/** Test-only export so individual validators can be exercised in unit
 *  tests without going through the public entry point. */
export function _registerValidator(fn: Validator): void {
  VALIDATORS.push(fn);
}

/** Async Claude-powered vagueness evaluator (item #58). Opt-in via
 *  ROLE_ROOM_VALIDATION_CLAUDE=1 because it adds ~1s latency and a
 *  small Anthropic cost per bootstrap. Falls back to no flags when the
 *  env-var isn't set or the API call fails.
 *
 *  Asks Claude Haiku to score the keyPromise 1-10 for specificity and
 *  return improvement suggestions. Score ≤4 generates a warning flag. */
export async function evaluateContentStoryLogicVagueness(
  result: RoleRoomAgentNormalizedPayload,
): Promise<ValidationFlag[]> {
  if (process.env.ROLE_ROOM_VALIDATION_CLAUDE !== "1") return [];
  const keyPromise = (result.storyLogicDraft as { contentStoryLogic?: { keyPromise?: string } } | undefined)
    ?.contentStoryLogic?.keyPromise;
  if (!keyPromise || keyPromise.trim().length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: process.env.ROLE_ROOM_VALIDATION_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 150,
      temperature: 0.1,
      messages: [{
        role: "user",
        content: `Vurder følgende keyPromise for konkretitet på en skala 1-10 (1=helt vag, 10=skarp og målbar). Returner kun JSON: {"score": N, "improvement": "kort forbedringsforslag på norsk"}.

keyPromise: "${keyPromise.slice(0, 500)}"`,
      }],
    });
    logAIUsage(response as any, { feature: 'role-room/research-validation' }).catch(() => undefined);
    const block = response.content[0];
    if (!block || block.type !== "text") return [];
    const parsed = JSON.parse(block.text.trim().replace(/^```json\n?|\n?```$/g, "")) as { score?: number; improvement?: string };
    if (typeof parsed.score !== "number" || parsed.score > 4) return [];
    return [{
      id: "key_promise_vague_claude",
      severity: "warning",
      category: "completeness",
      title: `KeyPromise vurdert som vag (${parsed.score}/10)`,
      detail: parsed.improvement ?? "Claude anbefaler å gjøre nøkkelløftet mer konkret.",
      fixTargetId: "role-room-field-story-promise",
      fixHint: "AI-vurdering — bruk som hint",
    }];
  } catch (error) {
    console.error("[role-room-research-validation] vagueness eval failed", {
      researchId: result.researchId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/** Async change-detection (item #61). Compares the fresh result against
 *  the most recent previous version of the same project. Returns flags
 *  for material changes — industry shift, competitor list churn >30%,
 *  address change. Kept async + separate from validateResearchResult
 *  because it needs DB access (previous version lookup), which would
 *  pull pg into the otherwise-pure sync validation module. */
export function detectMaterialChanges(
  current: RoleRoomAgentNormalizedPayload,
  previous: unknown,
): ValidationFlag[] {
  if (!previous || typeof previous !== "object") return [];
  const prev = previous as {
    companyProfile?: { industry?: string; probableLocationAddress?: string | null };
    competitorAnalysis?: { competitors?: Array<{ name?: string }> };
  };

  const flags: ValidationFlag[] = [];

  // Industry change — almost always meaningful.
  const prevIndustry = normalize(prev.companyProfile?.industry);
  const currIndustry = normalize(current.companyProfile?.industry);
  if (prevIndustry && currIndustry && prevIndustry !== currIndustry) {
    flags.push({
      id: "material_change_industry",
      severity: "warning",
      category: "change_detection",
      title: "Bransje endret seg siden forrige research",
      detail: `"${prev.companyProfile?.industry}" → "${current.companyProfile?.industry}". Marketing plan bør re-genereres.`,
      fixHint: "Trigger re-plan",
    });
  }

  // Address change — relevant for local kampanjer.
  const prevAddr = normalize(prev.companyProfile?.probableLocationAddress);
  const currAddr = normalize(current.companyProfile?.probableLocationAddress);
  if (prevAddr && currAddr && prevAddr.slice(0, 30) !== currAddr.slice(0, 30)) {
    flags.push({
      id: "material_change_address",
      severity: "info",
      category: "change_detection",
      title: "Adressen er oppdatert siden forrige research",
      detail: `Var: "${prev.companyProfile?.probableLocationAddress}" — nå: "${current.companyProfile?.probableLocationAddress}".`,
      fixHint: "Verifiser at flytting er korrekt",
    });
  }

  // Competitor churn — >30% replacement of named competitors.
  const prevNames = new Set((prev.competitorAnalysis?.competitors ?? []).map((c) => normalize(c.name)).filter(Boolean));
  const currNames = new Set((current.competitorAnalysis?.competitors ?? []).map((c) => normalize(c.name)).filter(Boolean));
  if (prevNames.size >= 3 && currNames.size >= 3) {
    const overlap = Array.from(currNames).filter((n) => prevNames.has(n)).length;
    const churnPct = 1 - (overlap / Math.max(prevNames.size, currNames.size));
    if (churnPct > 0.3) {
      flags.push({
        id: "material_change_competitor_churn",
        severity: "info",
        category: "change_detection",
        title: `${Math.round(churnPct * 100)}% konkurrent-utskifting siden forrige research`,
        detail: `Konkurrentkartet har endret seg betydelig. Vurder om posisjonering bør justeres.`,
        fixHint: "Sammenlign versjoner i diff-fanen",
      });
    }
  }

  return flags;
}
