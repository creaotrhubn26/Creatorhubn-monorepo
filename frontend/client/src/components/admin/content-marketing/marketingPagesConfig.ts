/**
 * Konfigurasjon for content-marketing-sider på theroleroom.com.
 *
 * Hver side er knyttet til én content-pillar (Trust/Compliance/Data) fra
 * TheRoleRoom-Content-Marketing-Plan.md og styres fra Admin Room. Statusen
 * `published` bestemmer om path-parseren i casting-main rendrer sida —
 * uppublisertes sider returnerer 404-fallback (eller standard landing).
 */

export type MarketingPageKey =
  | 'casting-svindel-tegn'
  | 'barn-samtykke-film'
  | 'casting-rapport-2026'
  | 'bak-castingen'
  | 'vart-syn'
  | 'selvtape-tips';

export type MarketingPillar = 'trust' | 'compliance' | 'data' | 'behind-the-cast' | 'founder' | 'education';

export interface MarketingPageConfig {
  key: MarketingPageKey;
  path: string;
  title: string;
  description: string;
  pillar: MarketingPillar;
  /** Publisert = synlig på public theroleroom.com. Styres fra Admin Room. */
  published: boolean;
  /** Når sida sist ble redigert/godkjent fra Admin Room. */
  lastReviewedAt?: string;
  /** LinkedIn-post-utkast koblet til sida (1 piece → 10 outputs-prinsipp). */
  linkedinDraft: string;
}

export const PILLAR_LABELS: Record<MarketingPillar, string> = {
  trust: 'Trust & Safety',
  compliance: 'Compliance & Legal',
  data: 'Industry Data & Insights',
  'behind-the-cast': 'Behind the Cast',
  founder: 'Founder POV',
  education: 'How-To / Education',
};

export const PILLAR_COLORS: Record<MarketingPillar, string> = {
  trust: '#fbbf24',
  compliance: '#a78bfa',
  data: '#22d3ee',
  'behind-the-cast': '#f472b6',
  founder: '#fb923c',
  education: '#34d399',
};

export const MARKETING_PAGES: MarketingPageConfig[] = [
  {
    key: 'casting-svindel-tegn',
    path: '/casting-svindel-tegn',
    title: 'Slik kjenner du igjen en falsk casting director — The Role Room',
    description:
      'Fem røde flagg for casting-svindel mot norske skuespillere: pre-payment, off-platform-kommunikasjon, ikke-eksisterende produksjoner. Hvor du melder fra hvis du allerede er rammet.',
    pillar: 'trust',
    published: true,
    linkedinDraft: `Vi fikk tre meldinger denne uken fra norske skuespillere som mistet penger til en falsk casting director.

Alle tre var unge. Alle tre fikk en DM som virket profesjonell. Alle tre ble bedt om å betale for et "audition workshop".

Dette er ikke uhell. Det er en kategoriskrise.

Hver gang en plattform tillater uverifiserte "casting directors" å kontakte skuespillere, gjør de et valg: beskytte brukerne sine, eller optimalisere for vekst.

Vi har valgt å gjennomgå hver eneste casting call manuelt før den går live. Det betyr at vi vokser saktere enn konkurrentene.

Det er greit. Norske skuespillere fortjener bedre.

Full guide: https://theroleroom.com/casting-svindel-tegn`,
  },
  {
    key: 'barn-samtykke-film',
    path: '/barn-samtykke-film',
    title: 'Forhåndssamtykke for barn under 15 år i norsk film og TV — 6-punkts huskeliste',
    description:
      'Norsk arbeidsmiljølov, Arbeidstilsynet og GDPR for barneskuespillere. Søknadsfrist 3 uker, maks 4 timer/dag, bøter opp til NOK 2 millioner. Hva produsenter må vite før de caster.',
    pillar: 'compliance',
    published: true,
    linkedinDraft: `Forhåndssamtykke for barn under 15 år i film: en 6-punkts huskeliste.

1. Du må søke Arbeidstilsynet MINST 3 uker før innspilling.
2. Hvert barn må ha en navngitt voksen ansvarlig på sett.
3. Barn under 13 år kan ikke jobbe etter kl. 20:00.
4. Risikovurderingen MÅ inkludere indirekte risiko — som negativ publisitet.
5. Foresatt-samtykket må være spesifikt for prosjektet — generelle holder ikke.
6. Dokumentasjon må arkiveres i 5 år etter siste opptaksdag.

Bygger du et team som glemmer dette? Bøtene fra Datatilsynet i 2024 var opp til NOK 2 millioner.

Vi genererer søknaden automatisk på TheRoleRoom. Det er en av grunnene til at vi finnes.

Full huskeliste: https://theroleroom.com/barn-samtykke-film`,
  },
  {
    key: 'casting-rapport-2026',
    path: '/casting-rapport-2026',
    title: 'Norwegian Casting Report 2026 — The Role Room',
    description:
      'Den første åpne data-rapporten om norsk casting. 50 casting calls, 60 dager, 17 intervjuer. Median pipeline-tid, fragmentert verktøykjede, selvtape-adopsjon, mangfold og compliance — sammenlignet med Sverige og Danmark.',
    pillar: 'data',
    published: false,
    linkedinDraft: `Vi har samlet inn data fra 50 norske casting calls de siste 60 dagene. Tre overraskende funn:

1. Median tid fra brief til confirmed cast: 11 dager. Bransjen tror det er 3–4 — det stemmer ikke.
2. 68% av castinger har minst én rolle som forblir uoppfylt etter 14 dager.
3. Den vanligste grunnen til at en rolle ikke fylles? Ikke mangel på talent — manglende verifisering av tilgjengelighet.

Det betyr at hovedproblemet i norsk casting ikke er "flere skuespillere". Det er "bedre koordinering av eksisterende talent".

Full rapport publiseres i oktober. Tegn deg på her: https://theroleroom.com/casting-rapport-2026`,
  },
  {
    key: 'bak-castingen',
    path: '/bak-castingen',
    title: 'Bak castingen — ekte historier fra norsk film og TV | The Role Room',
    description:
      'Tre historier fra norsk casting i 2026: nyutdannet hovedrolle, casting director om "det riktige valget", produsent som castet 12 BankID-verifiserte statister på 38 timer.',
    pillar: 'behind-the-cast',
    published: true,
    linkedinDraft: `Tre måneder siden var Maren student ved Den Norske Filmskolen. I dag er hun cast som hovedrollen i en NRK-dramaserie.

Det som skilte henne fra de andre søkerne var ikke teknikk. Det var én ting: en 90-sekunders selvtape som ikke prøvde å være imponerende. Bare ærlig.

Castingdirektøren brukte 14 sekunder før hun la den i shortlist-mappen.

"Jeg trodde jeg måtte sprenge skjermen. Det jeg trengte var å være helt rolig — og så kjøre én linje med mening." — Maren

Hele historien + to til (CD-spotlight + produsent-historie): https://theroleroom.com/bak-castingen`,
  },
  {
    key: 'vart-syn',
    path: '/vart-syn',
    title: 'Vårt syn — tre meninger som vil gjøre oss upopulære i norsk filmbransje | The Role Room',
    description:
      'Daniel Qazi, grunnlegger av The Role Room, om sikkerhet for mindreårige, AI uten rettighets-klausuler og kreditt-verifisering som produkt-fundament.',
    pillar: 'founder',
    published: true,
    linkedinDraft: `Tre meninger som vil gjøre meg upopulær i norsk filmbransje:

1. Åpne casting-plattformer er ikke trygge for skuespillere under 18. Punktum.
2. AI-castingverktøy uten eksplisitte rettighets-klausuler er ulovlig — ikke "etisk gråsone".
3. En skuespillerprofil uten verifisert produksjonskreditt er verdiløs som produkt.

Hvis du er uenig — kom gjerne i kommentarene. Jeg har endret mening før.

Hele begrunnelsen: https://theroleroom.com/vart-syn`,
  },
  {
    key: 'selvtape-tips',
    path: '/selvtape-tips',
    title: 'Fem ting castere ser etter i selvtaper (selv om de ikke sier det høyt) | The Role Room',
    description:
      'Konkret huskeliste for skuespillere: slate, stillhet før første replikk, øye-kontakt mot linsen, klesvalg, riktig avslutning. Optimalisert for norsk casting i 2026.',
    pillar: 'education',
    published: true,
    linkedinDraft: `Fem ting castere ser etter i selvtaper — som de ikke alltid sier høyt:

1. Slate ærlig — navn, alder, agentur. 7 sekunder.
2. Stillhet før første replikk. 2 sekunder. Castere puster også.
3. Øynene treffer kameraets linse, ikke partnerens. Linsen er publikum.
4. Outfits som ikke distraherer. Solid farge. Aldri hvit, aldri mønster.
5. Slutt med stillhet. 3 sekunder. Ikke "tusen takk!" — det dreper magien.

Full guide for norske skuespillere: https://theroleroom.com/selvtape-tips`,
  },
];

const PUBLISH_OVERRIDE_STORAGE_KEY = 'roleroom-marketing-publish-overrides-v1';

/**
 * Admin Room kan overstyre `published`-feltet uten redeploy ved å
 * persiste override-flagg i localStorage. Backend-CMS kan erstatte
 * dette senere uten å endre kall-stedene.
 */
function readPublishOverrides(): Partial<Record<MarketingPageKey, boolean>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PUBLISH_OVERRIDE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function isMarketingPagePublished(key: MarketingPageKey): boolean {
  const config = MARKETING_PAGES.find((page) => page.key === key);
  if (!config) return false;
  const overrides = readPublishOverrides();
  if (Object.prototype.hasOwnProperty.call(overrides, key)) {
    return !!overrides[key];
  }
  return config.published;
}

export function setMarketingPagePublished(key: MarketingPageKey, published: boolean): void {
  if (typeof window === 'undefined') return;
  const overrides = readPublishOverrides();
  overrides[key] = published;
  try {
    window.localStorage.setItem(PUBLISH_OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // localStorage kan være blokkert i privatmodus — gi opp stille.
  }
}

/**
 * Path-parser — mapper `/casting-svindel-tegn` → 'casting-svindel-tegn'.
 * Returnerer null hvis ingen path matcher eller siden ikke er publisert.
 *
 * Brukes av casting-main rett etter andre path-parsers (CompetitorComparison,
 * StudentSEO, PressKit) slik at offentlig SEO-rendering skjer før auth-gate.
 */
export function parseMarketingPagePath(pathname: string): MarketingPageKey | null {
  const normalized = pathname.replace(/\/+$/, '').toLowerCase();
  const match = MARKETING_PAGES.find((page) => page.path.toLowerCase() === normalized);
  if (!match) return null;
  if (!isMarketingPagePublished(match.key)) return null;
  return match.key;
}

export function getMarketingPageConfig(key: MarketingPageKey): MarketingPageConfig | undefined {
  return MARKETING_PAGES.find((page) => page.key === key);
}
