import type { RuleSource } from '../types.js';

/**
 * Offisielle kilder for norske regnskaps-, skatte- og MVA-regler.
 * `lastVerified` er datoen innholdet sist ble kontrollert mot kilden.
 * Blogginnlegg og konkurrenters hjelpesider brukes ALDRI som autoritativ kilde.
 */
export const NORWEGIAN_SOURCES: RuleSource[] = [
  {
    sourceId: 'lovdata-mval',
    title: 'Merverdiavgiftsloven (LOV-2009-06-19-58)',
    type: 'lov',
    url: 'https://lovdata.no/dokument/NL/lov/2009-06-19-58',
    lastVerified: '2026-01-01',
    verifiedBy: 'system-bootstrap',
  },
  {
    sourceId: 'stortinget-mva-vedtak',
    title: 'Stortingets årlige vedtak om merverdiavgift (satser)',
    type: 'lov',
    url: 'https://lovdata.no/dokument/STV/forskrift/2024-12-12-3572',
    lastVerified: '2026-01-01',
    verifiedBy: 'system-bootstrap',
  },
  {
    sourceId: 'skatteetaten-mva-satser',
    title: 'Skatteetaten: Merverdiavgiftssatser',
    type: 'skatteetaten',
    url: 'https://www.skatteetaten.no/satser/merverdiavgift/',
    lastVerified: '2026-01-01',
    verifiedBy: 'system-bootstrap',
  },
  {
    sourceId: 'lovdata-sktl',
    title: 'Skatteloven (LOV-1999-03-26-14)',
    type: 'lov',
    url: 'https://lovdata.no/dokument/NL/lov/1999-03-26-14',
    lastVerified: '2026-01-01',
    verifiedBy: 'system-bootstrap',
  },
  {
    // Offisiell, lisensiert kanal for lovtekst — brukes til automatisk innhenting
    // i stedet for skraping. Gratis, ingen nøkkel, oppdateres nattlig.
    sourceId: 'lovdata-api',
    title: 'Lovdata API — maskinlesbare lover og forskrifter (NLOD 2.0)',
    type: 'lov',
    url: 'https://api.lovdata.no/',
    apiUrl: 'https://api.lovdata.no/',
    license: 'NLOD 2.0',
    apiAccess: 'open',
    lastVerified: '2026-07-20',
    verifiedBy: 'api-kartlegging (websearch — direkte henting blokkert)',
  },
  {
    // Skatteetatens datadeling: satser og skattedata via standardiserte API-er.
    // Krever innvilget tilgang per API (Maskinporten) — derfor apiAccess 'granted'.
    sourceId: 'skatteetaten-datadeling',
    title: 'Skatteetaten datadeling — API-er for satser og skattedata',
    type: 'skatteetaten',
    url: 'https://www.skatteetaten.no/en/deling/inntekt-skatt-og-avgift/intro/fa-tilgang/',
    apiUrl: 'https://skatteetaten.github.io/api-dokumentasjon/en/',
    apiAccess: 'granted',
    lastVerified: '2026-07-20',
    verifiedBy: 'api-kartlegging (websearch — direkte henting blokkert)',
  },
  {
    sourceId: 'skatteetaten-fradrag-fagforening',
    title: 'Skatteetaten: Fradrag for fagforeningskontingent (satser)',
    type: 'skatteetaten',
    url: 'https://www.skatteetaten.no/en/rates/deduction-for-trade-union-fees/',
    lastVerified: '2026-07-20',
    verifiedBy: 'deep-research-workflow (websearch 3-0 — direkte henting blokkert)',
  },
  {
    sourceId: 'skatteetaten-selskapsskatt',
    title: 'Skatteetaten: Skattesats for selskaper (alminnelig inntekt)',
    type: 'skatteetaten',
    url: 'https://www.skatteetaten.no/satser/',
    lastVerified: '2026-01-01',
    verifiedBy: 'system-bootstrap',
  },
  {
    sourceId: 'skatteetaten-saldoavskrivning',
    title: 'Skatteetaten: Saldogrupper og avskrivningssatser (sktl. § 14-41 og § 14-43)',
    type: 'skatteetaten',
    url: 'https://www.skatteetaten.no/satser/avskrivningssatser/',
    lastVerified: '2026-01-01',
    verifiedBy: 'system-bootstrap',
  },
  {
    sourceId: 'skatteetaten-direkte-kostnadsforing',
    title: 'Skatteetaten: Grense for direkte utgiftsføring av driftsmidler (sktl. § 14-40)',
    type: 'skatteetaten',
    url: 'https://www.skatteetaten.no/bedrift-og-organisasjon/skatt/kjop-og-salg/avskrivninger/',
    lastVerified: '2026-01-01',
    verifiedBy: 'system-bootstrap',
  },
  {
    sourceId: 'skatteetaten-mva-registrering',
    title: 'Skatteetaten: Registrering i Merverdiavgiftsregisteret (mval. § 2-1)',
    type: 'skatteetaten',
    url: 'https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/registrere/',
    lastVerified: '2026-01-01',
    verifiedBy: 'system-bootstrap',
  },
  {
    sourceId: 'skatteetaten-saf-t',
    title: 'Skatteetaten: SAF-T Regnskap — teknisk dokumentasjon og standard mva-koder',
    type: 'saf-t-dokumentasjon',
    url: 'https://www.skatteetaten.no/bedrift-og-organisasjon/starte-og-drive/rutiner-regnskap-og-kassasystem/saf-t-regnskap/',
    lastVerified: '2026-01-01',
    verifiedBy: 'system-bootstrap',
  },
  {
    sourceId: 'skatteetaten-trygdeavgift',
    title: 'Skatteetaten: Trygdeavgift (satser for lønn og næringsinntekt)',
    type: 'skatteetaten',
    url: 'https://www.skatteetaten.no/satser/trygdeavgift/',
    lastVerified: '2026-01-01',
    verifiedBy: 'system-bootstrap',
  },
  {
    sourceId: 'lovdata-bokforingsloven',
    title: 'Bokføringsloven (LOV-2004-11-19-73)',
    type: 'lov',
    url: 'https://lovdata.no/dokument/NL/lov/2004-11-19-73',
    lastVerified: '2026-01-01',
    verifiedBy: 'system-bootstrap',
  },
  {
    sourceId: 'google-gmail-api',
    title: 'Google: Gmail API — offisiell dokumentasjon (scopes, OAuth 2.0)',
    type: 'google-dokumentasjon',
    url: 'https://developers.google.com/gmail/api/auth/scopes',
    lastVerified: '2026-01-01',
    verifiedBy: 'system-bootstrap',
  },
];
