/**
 * Konfigurasjon for content-marketing-sider på theroleroom.com.
 *
 * Hver side er knyttet til én content-pillar (Trust/Compliance/Data) fra
 * TheRoleRoom-Content-Marketing-Plan.md og styres fra Admin Room. Statusen
 * `published` bestemmer om path-parseren i casting-main rendrer sida —
 * uppublisertes sider returnerer 404-fallback (eller standard landing).
 */

export type MarketingPageKey = 'casting-svindel-tegn' | 'barn-samtykke-film' | 'casting-rapport-2026';

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
