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
  | 'selvtape-tips'
  | 'operativsystem'
  | 'norsk-casting-ordliste'
  | 'arbeidstilsynet-guide-produksjon'
  | 'sentimental-value-effekten'
  | 'crew-i-norge-2026'
  | 'innspillingsdag-koordinering'
  | 'intimacy-coordinator-norge'
  | 'kamera-folk-verktoy-2026'
  | 'etterproduksjon-norge-2026';

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
  {
    key: 'operativsystem',
    path: '/operativsystem',
    title: 'Operativsystemet bak The Role Room — slik bygger vi i et 500-personers marked | The Role Room',
    description:
      'Syv prinsipper for hvordan The Role Room driver forretningsutvikling i norsk filmbransje: tid-multiplikator, quality at scale, memory-extension-CRM, GEO/AI-citation som moat, compliance som differensiering, referral-graf og mental availability.',
    pillar: 'founder',
    published: true,
    linkedinDraft: `Vi har publisert operativsystemet bak The Role Room.

Klassisk startup-instinkt er å holde driftsprinsipper hemmelige. Vi gjør motsatt. Tre grunner:

1. Bransjen ser tankegangen vår før de møter produktet — det bygger tillit raskere enn en demo.
2. Andre norske grunnleggere kan kopiere prinsippene og styrke hele økosystemet.
3. Vi setter en standard for hvordan vi forventer å bli kommunisert tilbake til — uten å måtte si det høyt.

Syv prinsipper, fra "20 personaliserte slår 200 generiske" til "AI-citation som langsiktig moat".

Les hele: https://theroleroom.com/operativsystem`,
  },
  {
    key: 'norsk-casting-ordliste',
    path: '/norsk-casting-ordliste',
    title: 'Norsk casting-ordliste — definisjoner av sentrale termer | The Role Room',
    description:
      'Autoritativ ordliste over 30+ norske casting-, produksjons- og compliance-termer: selvtape, slate, callback, forhåndssamtykke, A-melding, BankID-verifisering, GDPR-klausuler, NSF og mer.',
    pillar: 'education',
    published: true,
    linkedinDraft: `Vi har publisert den første autoritative ordlisten over norske casting-termer.

30+ definisjoner: selvtape, slate, callback, forhåndssamtykke, A-melding, BankID-verifisering, AI-klausuler, tariffavtaler.

Hver term har norsk navn, engelsk ekvivalent og bransjeintern definisjon. Strukturert som DefinedTermSet så AI-modeller kan sitere enkeltdefinisjoner.

Bruk fritt i artikler, opplæring og presentasjoner.

https://theroleroom.com/norsk-casting-ordliste`,
  },
  {
    key: 'arbeidstilsynet-guide-produksjon',
    path: '/arbeidstilsynet-guide-produksjon',
    title: 'Arbeidstilsynet-guide: barn i norsk film- og TV-produksjon | The Role Room',
    description:
      'Komplett seks-trinns-guide for norske produsenter som caster barn under 15 år. Forhåndssamtykke, dokumentasjon, arbeidstid, ansvarlig voksen, risikovurdering og 5-års-arkivering.',
    pillar: 'compliance',
    published: true,
    linkedinDraft: `Arbeidstilsynet har varslet økt tilsyn med audiovisuell produksjon høsten 2026.

Datatilsynet-bøtene i 2024 var opp til NOK 2 millioner — flere norske produsenter ble pålagt det.

Vi har publisert en seks-trinns-guide for produsenter som caster barn under 15:

1. Sjekk om forhåndssamtykke kreves (det gjør det — også reklame, også statister)
2. Send søknad senest 3 uker før innspilling
3. Strukturer arbeidstid (maks 4 t for barn under 13)
4. Navngitt voksen ansvarlig per barn
5. Dokumentér risikovurdering — inkl. indirekte risiko
6. Arkivér i 5 år

Full guide: https://theroleroom.com/arbeidstilsynet-guide-produksjon`,
  },
  {
    key: 'sentimental-value-effekten',
    path: '/sentimental-value-effekten',
    title: 'Sentimental Value-effekten — hva Norges Oscar betyr for casting-infrastruktur | The Role Room',
    description:
      'Norges Oscar for Beste internasjonale spillefilm åpner systemiske muligheter — men eksponerer også infrastruktur-svakhetene i norsk casting. Hva neste 18 måneder krever.',
    pillar: 'founder',
    published: true,
    linkedinDraft: `Norge vant Oscar.

Det er ikke en isolert hendelse — det er kulminasjonen av et tiår med målrettet investering og bevisst talentutvikling.

Men det er også en infrastruktur-test. En internasjonal Oscar-vinst skaper umiddelbar oppmerksomhet fra finansierings-partnere, strømmetjenester og co-produsenter som vil ha "den norske vinkelen". Det krever profesjonelle, raske svar.

Verktøykjeden vi har i dag — fragmentert e-post, Facebook-grupper, manuell verifisering — kan ikke håndtere det.

Om 30 år vil norske foreldre se Sentimental Value med barna sine. Spørsmålet er hvilken infrastruktur den industrien vi nå bygger fortjener.

Hele essayet: https://theroleroom.com/sentimental-value-effekten`,
  },
  {
    key: 'crew-i-norge-2026',
    path: '/crew-i-norge-2026',
    title: 'Crew i norsk filmbransje 2026 — størrelse, struktur og smerter | The Role Room',
    description:
      'Anslag av norsk crew-marked: ~120-150 DP-er, ~200-250 klippere, ~80-100 lyd-folk, ~1.800 Filmforbund-medlemmer. Fem strukturelle smerter i dagens booking-flyt og hva The Role Room gjør med dem.',
    pillar: 'data',
    published: true,
    linkedinDraft: `Norsk filmbransje crew i tall:

~120-150 aktive frilans-DP-er
~80-100 lyd-folk (production sound)
~200-250 klippere/editors
~50-70 scenedesignere
~40-60 kostymedesignere
~1.800 Filmforbund-medlemmer totalt

Og likevel er booking fortsatt sentrert rundt Facebook-grupper og tekstmeldinger. Line producer bruker 3-5 timer per crew-rolle på å finne tilgjengelig person.

Fem strukturelle smerter:
1. Fragmentert booking
2. Ingen sentral kreditt-verifisering
3. Tariff-undergraving
4. Manuell A-melding / A1-erklæring
5. HMS-compliance som ingen tracker

Vi bygger The Role Room sammen med Norsk Filmforbund — ikke i konkurranse. Plattformen er mer verdifull jo sterkere forbundet er.

Hele datasettet: https://theroleroom.com/crew-i-norge-2026`,
  },
  {
    key: 'innspillingsdag-koordinering',
    path: '/innspillingsdag-koordinering',
    title: 'Innspillingsdag-koordinering — hvem er på sett og hva som koster når noe glipper | The Role Room',
    description:
      'En typisk norsk produksjons-dag har 20-40 mennesker på sett fordelt over 12+ roller (1st AD, intimacy coord, stunt, set medic, HMUA, DIT). Fem koordinerings-smerter med konkrete kostnads-anslag.',
    pillar: 'data',
    published: true,
    linkedinDraft: `En typisk norsk produksjons-dag har 20-40 mennesker på sett.

1st AD kjører dagen. 2nd AD koordinerer skuespillere. Background coordinator leder statister. Intimacy coordinator sikrer samtykke. Set medic har autoritet til å stoppe opptak.

Når koordineringen glipper koster det 25-40.000 NOK per 90-minutters forsinkelse — pluss skjult regulatorisk eksponering.

Fem konkrete smerter vi sporer:
1. Call sheet-versjons-kaos via walkie
2. Statist-tilstedeværelse sjekkes manuelt mot Excel
3. Skuespiller-samtykke per scene-endring loggføres ikke
4. Arbeidstid-rapportering rekonstrueres etter wrap
5. Intimacy-koordinering avhenger av at noen "husket" å booke en

The Role Room utvider seg fra casting til innspillingsdag-koordinering.

Hele datasettet: https://theroleroom.com/innspillingsdag-koordinering`,
  },
  {
    key: 'intimacy-coordinator-norge',
    path: '/intimacy-coordinator-norge',
    title: 'Intimacy coordinator i norsk film og TV — hva, hvorfor og når | The Role Room',
    description:
      'Intimacy coordinator-rollen er ikke lovpålagt i Norge, men kreves av Netflix, BBC, Apple TV+ og EU-samproduksjoner. ~5-10 aktive i Norge per 2026. Hva rollen gjør, når den må være på sett, og hvorfor produsenter må ta dette på alvor nå.',
    pillar: 'trust',
    published: true,
    linkedinDraft: `Intimacy coordinator er ikke lovpålagt i Norge.

Men Netflix, BBC, Apple TV+ og EU-samproduksjoner krever det dokumentert.

Norske skuespillere under 30 har begynt å spørre om det før de aksepterer audition — trent på SAG-AFTRA-standard via filmskole-utveksling.

~5-10 sertifiserte ICs er aktive i Norge per 2026. Mangel på norsktalende, sertifiserte koordinatorer er en flaskehals — produksjoner importerer ofte fra Sverige eller Danmark.

En produksjon i 2026 som ikke har IC på en intimscene risikerer:
- Publisitets-kostnad
- At skuespilleren trekker seg dagen før opptak
- Brudd på internasjonal samproduksjons-avtale

Det er ikke en luksus-funksjon. Det er infrastruktur.

Hele guiden: https://theroleroom.com/intimacy-coordinator-norge`,
  },
  {
    key: 'kamera-folk-verktoy-2026',
    path: '/kamera-folk-verktoy-2026',
    title: 'Kamera-folk og verktøy i norsk produksjon 2026 — camera body, lens-pakker, cloud workflow | The Role Room',
    description:
      'Anslag av Arri Alexa 35 vs Sony Venice-fordeling i norsk drama. Cooke vs Zeiss vs Atlas Orion. Frame.io-adopsjon ~60%. Silverstack ~50% av DIT-arbeidsflyt. Fire koordinerings-smerter for kamera-avdelingen og vår tilnærming.',
    pillar: 'data',
    published: true,
    linkedinDraft: `En DP velger ikke "Sony Venice" tilfeldig — det er en signatur.

Norsk drama 2024-2026, kamera-body-fordeling:
- Arri Alexa 35 / Mini LF: ~55%
- Sony Venice / Venice 2: ~25%
- RED V-Raptor / Komodo: ~12%
- Annet: ~8%

Lens-pakker som dominerer drama:
- Cooke S4 / S7: ~35% (varm, "norsk" look)
- Zeiss Supreme: ~25% (voksende — sci-fi/thriller)
- Atlas Orion Anamorphic: ~15%
- Leica Summilux: ~10% (prestige)

Frame.io brukes på ~60% av norske produksjoner i 2026.

Men line producer bestiller DP basert på reel + magefølelse — ikke verktøy-match. Resultat: første dag på sett brukes til å lære lens-egenskaper i stedet for å filme.

Vi bygger søkbar verktøy-erfaring inn i Tier-1 CRM. Sony Venice + Cooke + Frame.io? Filtrér og se hvilke DPs har erfaring i alle tre.

Hele datasettet + workflow-smerter: https://theroleroom.com/kamera-folk-verktoy-2026`,
  },
  {
    key: 'etterproduksjon-norge-2026',
    path: '/etterproduksjon-norge-2026',
    title: 'Etterproduksjon i norsk filmbransje 2026 — størrelse, software, workflow-smerter | The Role Room',
    description:
      'Anslag av norsk post-prod-marked: ~200-250 klippere, ~25-40 colorister, ~30-50 sound designers, ~15-25 post supervisors. Frame.io ~65%, DaVinci Resolve ~75% av grading, Pro Tools ~80% av lyd-mix. Fem koordinerings-smerter med konkrete kostnads-anslag.',
    pillar: 'data',
    published: true,
    linkedinDraft: `Klippere er bredeste crew-rolle i norsk filmbransje — ~200-250 aktive.

Etterproduksjon i tall, anslag 2026:
- Klippere: ~200-250
- Colorister: ~25-40
- Sound designers + mixers: ~30-50
- Post supervisors: ~15-25
- Post VFX-artister: ~40-60
- Music supervisors: ~10-15

Software-fordeling:
- Klipp: Avid ~45% (drama), Premiere ~35%, Resolve ~15%
- Color: DaVinci Resolve ~75% (industri-standard)
- Lyd: Pro Tools ~80%, Logic ~12%
- Cloud: Frame.io ~65%, ingen workflow ~22%

Og likevel: 22% av norske produksjoner deler fortsatt master-versjoner via Dropbox med filnavn som "v3_final_FINAL_v4_for_real.mov". Colorist får LUT fra DIT i feil versjon. Sound mix sendes 1-2 dager før leveranse — ingen tid til revision-runde.

Vi bygger koordineringslag for hele post-pipeline. Hele datasettet + 5 workflow-smerter med konkret kostnad: https://theroleroom.com/etterproduksjon-norge-2026`,
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
