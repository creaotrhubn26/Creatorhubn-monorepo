// =============================================================================
// Deterministisk marketing-setup-regelmotor for producer-bootstrappen (F9).
//
// Bakgrunn: kanalvalg, content-pilarer, CTA og ad-tech ble tidligere avledet
// FRITT av LLM-en fra generiske constraints. Det ga inkonsistent oppsett — en
// lokal pizzeria kunne få «LinkedIn thought leadership», en B2B-konsulent kunne
// få «bordbestilling-lead-form». Denne motoren avleder oppsettet DETERMINISTISK
// fra det verifiserte selskapet (NACE→forretningsmodell + geo-scope), slik at
// LLM-en så kan BERIKE (ikke finne opp) det. Hvert felt har en begrunnelse så
// det kan spores (fieldMetadata sourceChain=['fallback_rules']).
//
// Ren modul, ingen avhengigheter. Mirrorer nace-/grounding-/match-scoring-
// modulenes konvensjon.
// =============================================================================

export type MarketingGeoScope = "local" | "national";

export interface MarketingChannel {
  name: string;
  priority: "primary" | "secondary" | "experimental";
  reason: string;
}

export interface MarketingSetup {
  businessModel: "B2C" | "B2B" | "B2B/B2C";
  geoScope: MarketingGeoScope;
  channels: MarketingChannel[];
  contentPillars: string[];
  primaryCta: string;
  secondaryCtas: string[];
  /** Pixel/CAPI/audiences/lead-forms — konkret ad-tech-oppsett. */
  adTech: string[];
  kpis: string[];
  rationale: string;
}

/** Minimal klassifiserings-input (strukturelt kompatibel med
 *  RoleRoomAgentBusinessClassification). */
export interface MarketingClassificationInput {
  businessModel?: string | null;
  industry?: string | null;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Normaliser en fri businessModel-streng til en av de tre kanoniske. */
function canonicalBusinessModel(value: string | null | undefined): MarketingSetup["businessModel"] {
  const v = hasText(value) ? value.toUpperCase().replace(/\s+/g, "") : "";
  if (v === "B2B/B2C" || v === "B2CB2B" || v === "B2B&B2C") return "B2B/B2C";
  if (v === "B2C") return "B2C";
  if (v === "B2B") return "B2B";
  // Ukjent → anta B2B/B2C (tryggest: dekker begge intent-typer).
  return "B2B/B2C";
}

/**
 * Avled geo-scope: lokal vs nasjonal. Lokal tilstedeværelse (verifisert
 * adresse/Places-lokasjon) + B2C/blandet ⇒ lokal. Rene B2B-tjenester uten
 * lokalt fotavtrykk (IT, engros, rådgivning) ⇒ nasjonal.
 */
export function deriveGeoScope(
  classification: MarketingClassificationInput,
  hasVerifiedLocalPresence: boolean,
): MarketingGeoScope {
  const model = canonicalBusinessModel(classification.businessModel);
  if (model === "B2C") return "local";
  if (model === "B2B/B2C") return hasVerifiedLocalPresence ? "local" : "national";
  // Rene B2B: lokal kun hvis vi faktisk har et bekreftet lokalt fotavtrykk.
  return hasVerifiedLocalPresence ? "local" : "national";
}

/**
 * Reorder channels so that measured-performance winners (a learned
 * `nace_channel_priority` override, #2) come first. Each override token is
 * matched fuzzily against channel names (token ⊂ name, or name's first word ⊂
 * token — so "google" matches "Google Business Profile / Maps"). Unmatched
 * channels keep their original relative order at the end. Priority LABELS are
 * left untouched; only the ordering the plan grounds on changes.
 */
function reorderChannelsByPriority(
  channels: MarketingChannel[],
  priority: readonly string[],
): MarketingChannel[] {
  const norm = (s: string): string => s.toLowerCase().trim();
  const used = new Set<number>();
  const ordered: MarketingChannel[] = [];
  for (const rawToken of priority) {
    const token = norm(rawToken);
    if (!token) continue;
    for (let i = 0; i < channels.length; i++) {
      if (used.has(i)) continue;
      const name = norm(channels[i].name);
      const firstWord = name.split(/[\s/]+/)[0] ?? "";
      if (name.includes(token) || (firstWord.length >= 3 && token.includes(firstWord))) {
        ordered.push(channels[i]);
        used.add(i);
      }
    }
  }
  for (let i = 0; i < channels.length; i++) {
    if (!used.has(i)) ordered.push(channels[i]);
  }
  return ordered;
}

/**
 * Bygg et deterministisk marketing-oppsett forankret i forretningsmodell +
 * geo-scope. Returnerer kanaler (prioritert), content-pilarer, CTA og ad-tech.
 * LLM-en skal bruke dette som grunnlag og berike — ikke erstatte.
 *
 * `channelPriorityOverride` (valgfri) er en godkjent, lært kanal-rangering fra
 * målt KPI-ytelse (#2) som reordner kanalene — slik lukkes resultat-loopen.
 */
export function buildMarketingSetup(
  classification: MarketingClassificationInput,
  geoScope: MarketingGeoScope,
  channelPriorityOverride?: readonly string[] | null,
): MarketingSetup {
  const setup = buildBaseMarketingSetup(classification, geoScope);
  if (channelPriorityOverride && channelPriorityOverride.length > 0) {
    setup.channels = reorderChannelsByPriority(setup.channels, channelPriorityOverride);
  }
  return setup;
}

function buildBaseMarketingSetup(
  classification: MarketingClassificationInput,
  geoScope: MarketingGeoScope,
): MarketingSetup {
  const businessModel = canonicalBusinessModel(classification.businessModel);
  const local = geoScope === "local";

  if (businessModel === "B2C") {
    return {
      businessModel,
      geoScope,
      channels: [
        { name: "Instagram", priority: "primary", reason: "Visuell B2C-rekkevidde og lokal oppdagelse via Reels/Stories." },
        { name: "TikTok", priority: "primary", reason: "Rimelig organisk rekkevidde for produkt/opplevelse mot forbruker." },
        { name: "Google Business Profile / Maps", priority: "primary", reason: "Fanger lokal søke-intent («i nærheten») og driver besøk/bestilling." },
        { name: "Meta-annonser (lokal radius)", priority: "secondary", reason: "Geo-målrettet rekkevidde + retargeting i nærområdet." },
        { name: "Facebook", priority: "secondary", reason: "Lokale grupper, arrangementer og eldre målgruppe." },
      ],
      contentPillars: [
        "Produkt/meny og fristelse",
        "Tilbud og kampanjer",
        "Bak kulissene og folkene",
        "Kundehistorier og anmeldelser",
        "Lokal tilhørighet og nabolag",
      ],
      primaryCta: local ? "Bestill / book nå" : "Kjøp nå",
      secondaryCtas: ["Se meny/utvalg", "Finn oss / veibeskrivelse", "Følg for tilbud"],
      adTech: [
        "Meta Pixel + Conversions API (CAPI) for konverteringssporing",
        "Meta Lead Ads for bestilling/booking/påmelding",
        local ? "Lokal radius-audience rundt adressen" : "Interesse-/lookalike-audience nasjonalt",
        "Retargeting av nettstedsbesøk og videovisninger",
        "Google Business Profile-innlegg + lokale Google-kampanjer",
      ],
      kpis: ["Bestillinger/bookinger", "Kostnad per lead", "Besøk til Google-profil", "Lagringer/delinger", "Retargeting-konvertering"],
      rationale: "Lokal B2C: visuell oppdagelse (IG/TikTok) + lokal søke-intent (Google Business Profile) + geo-annonser med lead-form for bestilling. IKKE LinkedIn thought leadership.",
    };
  }

  if (businessModel === "B2B") {
    return {
      businessModel,
      geoScope,
      channels: [
        { name: "LinkedIn", priority: "primary", reason: "Beslutningstakere og firmografisk målretting for B2B." },
        { name: "Google Search", priority: "primary", reason: "Fanger kjøps-intent når problemet søkes aktivt." },
        { name: "E-post / nyhetsbrev", priority: "secondary", reason: "Nurture av leads gjennom lengre B2B-salgssyklus." },
        { name: "YouTube (fagformidling)", priority: "secondary", reason: "Case og fagcontent som bygger tillit før møte." },
        { name: local ? "Google Business Profile" : "Bransjearrangement/webinar", priority: "experimental", reason: local ? "Lokal troverdighet for regionale B2B-kunder." : "Direkte tilgang til kvalifiserte beslutningstakere." },
      ],
      contentPillars: [
        "Case og proof points (ROI)",
        "Fagformidling og innsikt",
        "Kundehistorier og referanser",
        "Team, kultur og kompetanse",
        "Tilbud, prosess og garantier",
      ],
      primaryCta: "Book et møte / få en demo",
      secondaryCtas: ["Last ned case/guide", "Ta kontakt", "Se referanser"],
      adTech: [
        "LinkedIn Insight Tag + firmografisk (matched) audiences",
        "LinkedIn/Meta Lead Gen Forms for demo/møte",
        "Server-side konvertering (CAPI) for lead-kvalitet",
        "Google Search + remarketing på høy-intent-sider",
        "CRM-integrasjon for lead-scoring og oppfølging",
      ],
      kpis: ["Kvalifiserte møter (SQL)", "Kostnad per lead", "Pipeline-verdi", "Demo-/nedlastingsrate", "Lead-til-kunde-rate"],
      rationale: "B2B: LinkedIn (firmografisk) + Google Search (intent) + e-post-nurture, med lead-forms mot møte/demo. IKKE lokale bordbestilling-kampanjer.",
    };
  }

  // B2B/B2C — typisk håndverk, arkitekt, foto: visuell portefølje + lokal
  // søke-intent + tilbud/befaring-flyt.
  return {
    businessModel,
    geoScope,
    channels: [
      { name: "Instagram", priority: "primary", reason: "Visuell portefølje (før/etter, prosjekt) mot både privat og bedrift." },
      { name: "Google Search", priority: "primary", reason: "Fanger lokal tjeneste-intent («elektriker Oslo», «fotograf bryllup»)." },
      { name: "Google Business Profile / Maps", priority: "primary", reason: "Lokal oppdagelse, anmeldelser og kontakt." },
      { name: "Meta-annonser (lokal)", priority: "secondary", reason: "Retargeting + geo-rekkevidde for tilbud/befaring." },
      { name: "Facebook", priority: "secondary", reason: "Lokale grupper og eldre privatmarked." },
    ],
    contentPillars: [
      "Prosjekt og før/etter",
      "Kvalitet og håndverk/fagkunnskap",
      "Kundehistorier og anmeldelser",
      "Prosess, tilbud og befaring",
      "Team og lokal tilhørighet",
    ],
    primaryCta: "Be om tilbud / book befaring",
    secondaryCtas: ["Se prosjekter/portefølje", "Ta kontakt", "Få prisestimat"],
    adTech: [
      "Meta Pixel + Conversions API (CAPI)",
      "Meta Lead Ads for tilbuds-/befaringsforespørsel",
      "Google Search (lokal intent) + Google Business Profile",
      local ? "Lokal radius-audience rundt adressen" : "Regional interesse-audience",
      "Retargeting av portefølje-/prissider",
    ],
    kpis: ["Tilbuds-/befaringsforespørsler", "Kostnad per lead", "Besøk til Google-profil", "Portefølje-engasjement", "Lead-til-oppdrag-rate"],
    rationale: "B2B/B2C tjeneste: visuell portefølje (IG) + lokal søke-intent (Google) + lead-form mot tilbud/befaring.",
  };
}
