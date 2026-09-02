// =============================================================================
// NACE → forretningsprofil-motor for The Role Room Agent bootstrap.
//
// Bakgrunn: `detectBusinessClassification` i role-room-agent.ts avledet
// tidligere bransje/forretningsmodell KUN fra et lowercase søke-korpus med 5
// hardkodede regexer, og defaultet til B2B. Den STRUKTURERTE NACE-koden fra
// Brreg (`naeringskode1.kode`) ble aldri brukt som driver — bare dumpet inn
// som fritekst. Konsekvens: ekte B2C-virksomheter (frisør, tannlege, kafé,
// butikk) uten tydelige nøkkelord på nettsiden ble klassifisert som generisk
// B2B.
//
// Dette modulen er en REN, testbar oppslagstabell fra NACE-prefiks (SN2007)
// til en forretningsprofil. Den er bevisst KONSERVATIV: kun koder der
// forretningsmodellen (B2B/B2C) er trygg er med. Tvetydige koder
// (holdingselskap, hovedkontortjenester, eiendom, kunstnerisk virksomhet)
// er UTELATT og returnerer null, slik at den eksisterende nettside-baserte
// regex-klassifiseringen får bestemme i stedet.
//
// Ingen I/O, ingen avhengigheter. Idempotent. Profil-formen matcher
// `RoleRoomAgentBusinessClassification` strukturelt.
// =============================================================================

export type NaceBusinessModel = "B2B" | "B2C" | "B2B/B2C";

/** Strukturelt identisk med RoleRoomAgentBusinessClassification i
 *  role-room-agent.ts. Holdt lokalt for å unngå importsyklus. */
export interface NaceProfile {
  industry: string;
  subIndustry: string;
  businessModel: NaceBusinessModel;
  contentCategory: string;
  productionApproach: string;
  customerJourneyFocus: string;
}

interface NaceProfileEntry {
  /** NACE-prefiks (SN2007). 2-siffret divisjon eller mer spesifikk klasse,
   *  f.eks. "56" eller "96.02". Matches mot begynnelsen av Brregs kode. */
  prefix: string;
  profile: NaceProfile;
}

// Konservativ tabell: kun koder med trygg B2B/B2C-modell. Mest spesifikke
// prefiks vinner (velges av classifyByNace), så rekkefølge her er irrelevant.
const NACE_PROFILES: readonly NaceProfileEntry[] = [
  // --- Servering (B2C) ------------------------------------------------------
  {
    prefix: "56",
    profile: {
      industry: "Restaurant og servering",
      subIndustry: "Servering, bespisning og bestilling",
      businessModel: "B2C",
      contentCategory: "Meny, kampanje og konverteringsinnhold",
      productionApproach: "Produktdrevet serveringsinnhold",
      customerJourneyFocus: "Craving, vurdering og bestilling",
    },
  },
  // --- Overnatting (B2C) ----------------------------------------------------
  {
    prefix: "55",
    profile: {
      industry: "Overnatting og opplevelse",
      subIndustry: "Hotell, camping og opphold",
      businessModel: "B2C",
      contentCategory: "Opplevelse, booking og sesonginnhold",
      productionApproach: "Opplevelsesdrevet reiselivsinnhold",
      customerJourneyFocus: "Inspirasjon, sammenlikning og booking",
    },
  },
  // --- Detaljhandel / retail (B2C) ------------------------------------------
  {
    prefix: "47",
    profile: {
      industry: "Handel og retail",
      subIndustry: "Produkt- og kampanjesalg",
      businessModel: "B2C",
      contentCategory: "Produkt, kampanje og konverteringsinnhold",
      productionApproach: "Produktfokusert salgsinnhold",
      customerJourneyFocus: "Oppmerksomhet, vurdering og kjøp",
    },
  },
  // --- Bilforhandler/verksted (B2C) -----------------------------------------
  {
    prefix: "45",
    profile: {
      industry: "Bil og motor",
      subIndustry: "Salg og reparasjon av motorvogner",
      businessModel: "B2C",
      contentCategory: "Produkt, tillit og servicetilbud",
      productionApproach: "Produkt- og tillitsdrevet salgsinnhold",
      customerJourneyFocus: "Behov, tillit og kjøp/booking",
    },
  },
  // --- Frisør og skjønnhet (B2C) --------------------------------------------
  {
    prefix: "96.02",
    profile: {
      industry: "Frisør og skjønnhetspleie",
      subIndustry: "Hår, hud og velvære",
      businessModel: "B2C",
      contentCategory: "Før/etter, tilbud og timebestilling",
      productionApproach: "Visuelt resultatdrevet tjenesteinnhold",
      customerJourneyFocus: "Inspirasjon, tillit og timebestilling",
    },
  },
  // --- Trening og velvære (B2C) ---------------------------------------------
  {
    prefix: "96.04",
    profile: {
      industry: "Trening og velvære",
      subIndustry: "Kropp, helse og livsstil",
      businessModel: "B2C",
      contentCategory: "Motivasjon, resultat og medlemskap",
      productionApproach: "Motivasjons- og resultatdrevet innhold",
      customerJourneyFocus: "Motivasjon, tillit og innmelding",
    },
  },
  {
    prefix: "93.1",
    profile: {
      industry: "Sport og trening",
      subIndustry: "Treningssenter og idrettsanlegg",
      businessModel: "B2C",
      contentCategory: "Motivasjon, resultat og medlemskap",
      productionApproach: "Motivasjons- og resultatdrevet innhold",
      customerJourneyFocus: "Motivasjon, tillit og innmelding",
    },
  },
  // --- Helse og klinikk (B2C) -----------------------------------------------
  {
    prefix: "86",
    profile: {
      industry: "Helse og klinikk",
      subIndustry: "Behandling, booking og fagformidling",
      businessModel: "B2C",
      contentCategory: "Booking, tillit og fagformidling",
      productionApproach: "Tillits- og fagdrevet helseinnhold",
      customerJourneyFocus: "Bekymring, tillit og timebestilling",
    },
  },
  {
    prefix: "75",
    profile: {
      industry: "Veterinær og dyrehelse",
      subIndustry: "Behandling og rådgivning for dyreeiere",
      businessModel: "B2C",
      contentCategory: "Omsorg, tillit og timebestilling",
      productionApproach: "Tillits- og omsorgsdrevet innhold",
      customerJourneyFocus: "Bekymring, tillit og timebestilling",
    },
  },
  // --- Barnehage (B2C) ------------------------------------------------------
  {
    prefix: "88.91",
    profile: {
      industry: "Barnehage og barneomsorg",
      subIndustry: "Omsorg, trygghet og pedagogikk",
      businessModel: "B2C",
      contentCategory: "Trygghet, hverdag og opptak",
      productionApproach: "Trygghets- og hverdagsdrevet innhold",
      customerJourneyFocus: "Trygghet, tillit og søknad",
    },
  },
  // --- Håndverk / spesialisert bygg (B2B/B2C) -------------------------------
  {
    prefix: "43",
    profile: {
      industry: "Håndverk og bygg",
      subIndustry: "Spesialisert bygge- og anleggsarbeid",
      businessModel: "B2B/B2C",
      contentCategory: "Prosjekt, kvalitet og tilbud",
      productionApproach: "Prosjekt- og resultatdrevet dokumentarinnhold",
      customerJourneyFocus: "Behov, tillit og tilbud/befaring",
    },
  },
  {
    prefix: "41.2",
    profile: {
      industry: "Bygg og entreprenør",
      subIndustry: "Oppføring av bygninger",
      businessModel: "B2B/B2C",
      contentCategory: "Prosjekt, kvalitet og tilbud",
      productionApproach: "Prosjekt- og resultatdrevet dokumentarinnhold",
      customerJourneyFocus: "Behov, tillit og tilbud/befaring",
    },
  },
  // --- Engroshandel (B2B) ---------------------------------------------------
  {
    prefix: "46",
    profile: {
      industry: "Engros og distribusjon",
      subIndustry: "B2B-vareforsyning og leveranse",
      businessModel: "B2B",
      contentCategory: "Sortiment, leveranse og partnerverdi",
      productionApproach: "Troverdig leveranse- og partnerinnhold",
      customerJourneyFocus: "Behov, leveringstrygghet og avtale",
    },
  },
  // --- IT og programvare (B2B) ----------------------------------------------
  {
    prefix: "62",
    profile: {
      industry: "IT og programvare",
      subIndustry: "Utvikling, drift og digitale tjenester",
      businessModel: "B2B",
      contentCategory: "Case, fagformidling og salgsstøtte",
      productionApproach: "Troverdig fagdrevet bedriftsinnhold",
      customerJourneyFocus: "Problem, proof point og møtebooking",
    },
  },
  // --- Regnskap / juridisk (B2B) --------------------------------------------
  {
    prefix: "69",
    profile: {
      industry: "Regnskap og juridiske tjenester",
      subIndustry: "Rådgivning, tillit og etterlevelse",
      businessModel: "B2B",
      contentCategory: "Fagformidling, tillit og salgsstøtte",
      productionApproach: "Tillits- og fagdrevet rådgivningsinnhold",
      customerJourneyFocus: "Problem, tillit og møtebooking",
    },
  },
  // --- Bedriftsrådgivning (B2B) ---------------------------------------------
  {
    prefix: "70.2",
    profile: {
      industry: "Rådgivning og konsulent",
      subIndustry: "Bedriftsrådgivning og ledelse",
      businessModel: "B2B",
      contentCategory: "Innsikt, case og salgsstøtte",
      productionApproach: "Innsikts- og tillitsdrevet fagformidling",
      customerJourneyFocus: "Problem, proof point og møtebooking",
    },
  },
  // --- Reklame og markedsføring (B2B) ---------------------------------------
  {
    prefix: "73",
    profile: {
      industry: "Reklame og markedsføring",
      subIndustry: "Byrå- og kampanjetjenester",
      businessModel: "B2B",
      contentCategory: "Portefølje, resultat og salgsstøtte",
      productionApproach: "Resultatdrevet byråinnhold",
      customerJourneyFocus: "Behov, proof point og møtebooking",
    },
  },
  // --- Rekruttering og bemanning (B2B) --------------------------------------
  {
    prefix: "78",
    profile: {
      industry: "Rekruttering og bemanning",
      subIndustry: "Talentattraksjon og employer branding",
      businessModel: "B2B",
      contentCategory: "Employer branding og rekrutteringsinnhold",
      productionApproach: "Kultur- og tillitsdrevet merkevareinnhold",
      customerJourneyFocus: "Oppmerksomhet, tillit og søknad/avtale",
    },
  },
  // --- Arkitekt / teknisk / design / foto (B2B/B2C) -------------------------
  {
    prefix: "71.1",
    profile: {
      industry: "Arkitektur og teknisk rådgivning",
      subIndustry: "Prosjektering og fagrådgivning",
      businessModel: "B2B/B2C",
      contentCategory: "Prosjekt, kvalitet og fagformidling",
      productionApproach: "Prosjekt- og kvalitetsdrevet innhold",
      customerJourneyFocus: "Behov, tillit og oppdrag",
    },
  },
  {
    prefix: "74.20",
    profile: {
      industry: "Foto og visuell produksjon",
      subIndustry: "Foto-, film- og innholdstjenester",
      businessModel: "B2B/B2C",
      contentCategory: "Portefølje, stil og bestilling",
      productionApproach: "Visuelt porteføljedrevet innhold",
      customerJourneyFocus: "Inspirasjon, tillit og bestilling",
    },
  },
];

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Refine broad registry categories with first-party website evidence. This is
 * intentionally conservative: both the vertical and the digital-product
 * signal must be present, so an ordinary clinic or generic software company
 * is not reclassified by a single ambiguous word.
 */
export function classifyWebsiteSpecialization(signals: ReadonlyArray<string | null | undefined>): NaceProfile | null {
  const corpus = signals.filter(hasText).join(" ").toLowerCase();
  const hasHealthVertical = /\b(?:lege|leger|helsepersonell|klinisk|medisinsk|pasient|journalnotat|journaldokumentasjon)\b/.test(corpus);
  const hasDigitalProduct = /\b(?:ai|programvare|plattform|skyløsning|transkripsjon|journalsystem|videokonsultasjon|saas)\b/.test(corpus);

  if (hasHealthVertical && hasDigitalProduct) {
    return {
      industry: "Helseteknologi og programvare",
      subIndustry: "Klinisk dokumentasjon og digitale verktøy for helsepersonell",
      businessModel: "B2B",
      contentCategory: "Fagformidling, produktdemo, tillit og salgsstøtte",
      productionApproach: "Trygghets- og produktdrevet helseteknologiinnhold",
      customerJourneyFocus: "Dokumentasjonsbehov, tillit, utprøving og avtale",
    };
  }
  return null;
}

/**
 * Klassifiser en Brreg NACE-kode (SN2007, f.eks. "56.101") til en trygg
 * forretningsprofil. Velger det MEST SPESIFIKKE prefikset som matcher.
 * Returnerer null når koden mangler eller ikke er i den konservative tabellen
 * (holding, hovedkontor, eiendom osv.) — da skal nettside-heuristikken avgjøre.
 */
export function classifyByNace(code: string | null | undefined): NaceProfile | null {
  if (!hasText(code)) return null;
  // Behold kun siffer og punktum ("56.101"); Brreg-koder kan ha whitespace.
  const normalized = code.replace(/[^\d.]/g, "");
  if (normalized.length < 2) return null;

  let best: NaceProfileEntry | null = null;
  for (const entry of NACE_PROFILES) {
    if (
      normalized.startsWith(entry.prefix) &&
      (best === null || entry.prefix.length > best.prefix.length)
    ) {
      best = entry;
    }
  }
  return best?.profile ?? null;
}

/** Bekvemmelighet: kun forretningsmodellen (B2B/B2C) fra NACE, eller null. */
export function businessModelForNace(
  code: string | null | undefined,
): NaceBusinessModel | null {
  return classifyByNace(code)?.businessModel ?? null;
}
