/**
 * setup-guides.ts — F4 «guide_platform_setup» (doc 14, del 2)
 *
 * Guidede sjekklister for stegene som IKKE kan automatiseres: de krever
 * klientens egen innlogging (Google/Meta/Microsoft), og passord skal aldri
 * gjennom oss. Innholdet er fasiten fra vårt eget oppsett (doc 14, del 1)
 * med lærdommene bakt inn som advarsler — én GSC-link per GA4-property,
 * purchase-låsen, SMS-verifiserings-fella, Clarity-«Oops»-workarounden.
 *
 * Ren data + accessor — deterministisk, enhetstestet, ingen LLM. Hver
 * guide avsluttes med samme verifisering: kjør site-auditen (F1) på nytt.
 */

export interface GuideStep {
  title: string;
  detail: string;
  /** Lærdom/felle fra vårt eget oppsett — vises uthevet i UI. */
  warning?: string;
}

export interface SetupGuide {
  key: string;
  label: string;
  /** Hvem må være innlogget hvor — settes øverst så forventningen er klar. */
  requiresLogin: string;
  steps: GuideStep[];
  /** Felles avslutning: verifisering via F1-auditen. */
  verification: string;
}

const VERIFICATION =
  "Kjør site-auditen på nytt etterpå (Site-audit-panelet / audit_site_setup) — samme sjekk som fant hullet, bekrefter at det er tettet.";

export const SETUP_GUIDES: SetupGuide[] = [
  {
    key: "gsc",
    label: "Google Search Console",
    requiresLogin: "Klientens Google-konto på search.google.com/search-console",
    steps: [
      {
        title: "Opprett property",
        detail:
          "Velg «Domene» hvis klienten kontrollerer DNS (dekker alle subdomener og http/https), ellers «URL-prefiks» for enkelthost.",
      },
      {
        title: "Verifiser eierskap",
        detail:
          "Domene-property: TXT-record i DNS. URL-prefiks: last opp google<token>.html til nettstedets rot ELLER bruk metatag.",
        warning:
          "Verifiseringsfilen må inn i kodebasen (public/-katalogen), ikke lastes opp ad hoc — ellers forsvinner den ved neste deploy og verifiseringen ryker.",
      },
      {
        title: "Meld inn sitemap",
        detail: "Sitemaps → skriv inn sitemap-URL-en (f.eks. /sitemap.xml). Status skal bli «Vellykket» innen et døgn.",
      },
      {
        title: "Koble til GA4 (valgfritt, men les advarselen)",
        detail: "GA4 Admin → Product links → Search Console-kobling.",
        warning:
          "GA4 tillater bare ÉN Search Console-kobling per property. Deler klienten GA4-property på flere domener, må de velge hvilket domene som får koblingen — vurder heller én GA4-property per domene.",
      },
    ],
    verification: VERIFICATION,
  },
  {
    key: "ga4",
    label: "Google Analytics 4",
    requiresLogin: "Klientens Google-konto på analytics.google.com",
    steps: [
      {
        title: "Opprett property (én per domene)",
        detail:
          "Admin → Create property. Tidssone Norge, valuta NOK. Én property per domene — delte properties gir GSC-koblings-begrensningen og rotete rapporter.",
      },
      {
        title: "Opprett web-datastrøm",
        detail: "Data streams → Web → legg inn domenet. Noter måle-ID-en (G-…) — det er den snippet-generatoren trenger.",
      },
      {
        title: "Sett datalagring til 14 måneder",
        detail: "Admin → Data settings → Data retention → 14 months (maks på gratis GA4; default er bare 2).",
      },
      {
        title: "Marker key events",
        detail:
          "Når event-planens events begynner å komme inn (Admin → Events): slå på «Mark as key event» for konverterings-eventene fra event-planen.",
        warning:
          "«purchase» er system-låst som key event i GA4 og kan ikke av-markeres — ikke bruk eventnavnet til annet enn faktiske kjøp.",
      },
      {
        title: "Verifiser i DebugView",
        detail: "Admin → DebugView med ?debug_mode=1 på nettstedet — se at events fra trackEvent kommer inn før dere stoler på rapportene.",
      },
    ],
    verification: VERIFICATION,
  },
  {
    key: "gtm",
    label: "Google Tag Manager",
    requiresLogin: "Klientens Google-konto på tagmanager.google.com",
    steps: [
      {
        title: "Opprett container (Web)",
        detail: "Én container per domene. Noter GTM-ID-en (GTM-…).",
      },
      {
        title: "PUBLISER containeren",
        detail: "Submit → Publish — også når den er tom.",
        warning:
          "En container uten publisert versjon serverer ingenting — taggen ser installert ut i HTML-en, men gjør null. Dette er den vanligste GTM-fella.",
      },
      {
        title: "Verifiser eierskap av eksisterende ID-er",
        detail:
          "Hvis nettstedet allerede har en GTM-ID: sjekk at klienten faktisk eier containeren i sin Tag Manager-konto før den beholdes.",
        warning:
          "Vi fant selv en FREMMED (men tom) container i egen kodebase — en fremmed container med publisert versjon kan kjøre vilkårlig script på siden.",
      },
    ],
    verification: VERIFICATION,
  },
  {
    key: "meta_pixel",
    label: "Meta Pixel",
    requiresLogin: "Klientens Meta Business-konto på business.facebook.com → Events Manager",
    steps: [
      {
        title: "Opprett pixel (datasett)",
        detail: "Events Manager → Connect data → Web. Noter pixel-ID-en (tallet) — det er alt snippet-generatoren trenger.",
        warning:
          "Ny business-konto kan kreve SMS-verifisering i mobilappen før oppretting går gjennom («suspicious activity») — gjør det i Meta-appen, prøv igjen.",
      },
      {
        title: "IKKE aktiver kampanjer ennå",
        detail:
          "Koble pixelen (snippet + events) først, og la den samle data. Oppsett og annonse-aktivering er separate beslutninger.",
      },
      {
        title: "Verifiser events i Events Manager",
        detail:
          "Test events-fanen viser innkommende PageView + standardevents fra event-broen (Lead/Purchase/…) når marketing-samtykke er gitt.",
        warning:
          "Pixelen skal KUN fyre ved marketing-samtykke (strengere enn analytics-samtykke). Fyrer den på førstebesøk uten banner-valg, er det et GDPR-avvik — auditen flagger dette.",
      },
    ],
    verification: VERIFICATION,
  },
  {
    key: "clarity",
    label: "Microsoft Clarity",
    requiresLogin: "Klientens Microsoft-konto på clarity.microsoft.com",
    steps: [
      {
        title: "Opprett prosjekt",
        detail: "Ett prosjekt per domene. Noter prosjekt-ID-en (den korte bokstav/tall-strengen i script-URL-en).",
      },
      {
        title: "Koble til GA4 (valgfritt)",
        detail: "Clarity Settings → Integrations → Google Analytics.",
        warning:
          "Integrasjonen kan feile med «Oops, there was a problem» — løsningen er å logge inn med kontoen som eier GA4-property-en og godkjenne derfra (riktig konto-kontekst), ikke å prøve igjen i samme vindu.",
      },
    ],
    verification: VERIFICATION,
  },
  {
    key: "bing",
    label: "Bing Webmaster Tools (ChatGPT-søkeindeksen)",
    requiresLogin: "Klientens Microsoft-konto på bing.com/webmasters",
    steps: [
      {
        title: "Importer fra Search Console",
        detail:
          "Velg «Import from GSC» — verifisering og sitemaps følger med fra Google-oppsettet i ett klikk. Gjør GSC-oppsettet først.",
      },
      {
        title: "Sjekk at sitemaps kom med",
        detail: "Sitemaps-fanen skal liste alle innmeldte sitemaps med status «Success».",
      },
      {
        title: "Følg AI Performance-rapporten",
        detail:
          "Bing Webmaster har en «AI Performance (BETA)»-rapport — dette er den eksterne fasiten for synlighet i ChatGPT-søk. Null her + full GEO-serving = gi indeksen tid, sjekk igjen ukentlig.",
      },
    ],
    verification: VERIFICATION,
  },
];

export function getSetupGuide(key: string): SetupGuide | null {
  return SETUP_GUIDES.find((g) => g.key === key) ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// Skreddersøm mot site-auditen (F1) — deterministisk, per bedrift
// ─────────────────────────────────────────────────────────────────────

/** Strukturelt subset av auditens capabilities (samme mønster som
 *  marketing-setup-modulen — ingen import, ingen avhengighet). */
export interface GuideAuditCapability {
  key: string;
  status: string; // implemented | partial | missing | unknown
  details?: string;
}

export type GuideRelevance =
  /** Auditen fant ingenting → disse stegene trengs. */
  | "needed"
  /** Funnet, men med avvik (f.eks. pixel som fyrer før samtykke). */
  | "fix"
  /** Ser ut til å være på plass — verifiser i kontoen, ikke re-installer. */
  | "verify"
  /** Ikke observerbart utenfra — sjekk i klientens konto. */
  | "check_account";

export interface TailoredGuide extends SetupGuide {
  relevance: GuideRelevance;
  /** Hva auditen faktisk så på DETTE domenet — grunnlaget for relevansen. */
  observed: string;
}

/** Audit-kapabilitet → guide-nøkkel (bing har ingen egen audit-observasjon:
 *  den arver GSC/sitemap-tilstanden siden importen bygger på GSC). */
const GUIDE_AUDIT_KEY: Record<string, string> = {
  ga4: "ga4",
  gtm: "gtm",
  meta_pixel: "meta_pixel",
  clarity: "clarity",
  gsc: "gsc",
};

function relevanceFor(guideKey: string, caps: readonly GuideAuditCapability[]): { relevance: GuideRelevance; observed: string } {
  const cap = caps.find((c) => c.key === GUIDE_AUDIT_KEY[guideKey]);
  if (guideKey === "bing") {
    const sitemap = caps.find((c) => c.key === "sitemap");
    return sitemap?.status === "missing"
      ? { relevance: "needed", observed: "Sitemap mangler — fiks den (og GSC) før Bing-importen, ellers er det ingenting å importere." }
      : { relevance: "needed", observed: "Bing-status kan ikke observeres utenfra — importen fra GSC er uansett stegene under." };
  }
  if (!cap) return { relevance: "check_account", observed: "Ingen audit-observasjon for denne plattformen." };
  const observed = cap.details ?? "";
  switch (cap.status) {
    case "implemented":
      return { relevance: "verify", observed };
    case "partial":
      return { relevance: "fix", observed };
    case "missing":
      return { relevance: "needed", observed };
    default:
      return { relevance: "check_account", observed };
  }
}

/** Flett domenet inn i detaljene der det gjør steget konkret. */
function interpolateDomain(guide: SetupGuide, domain: string): SetupGuide {
  const d = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const swap = (text: string): string =>
    text
      .replace(/nettstedets rot/g, `roten av ${d}`)
      .replace(/\(f\.eks\. \/sitemap\.xml\)/g, `(https://${d}/sitemap.xml)`)
      .replace(/legg inn domenet/g, `legg inn ${d}`)
      .replace(/på nettstedet/g, `på ${d}`);
  return {
    ...guide,
    steps: guide.steps.map((s) => ({ ...s, detail: swap(s.detail) })),
  };
}

/**
 * Skreddersy guidene for ÉN bedrift: kryss med F1-auditens observasjoner
 * av domenet og sorter etter hva som faktisk trengs (needed → fix →
 * check_account → verify). Deterministisk — samme audit gir samme plan.
 */
export function tailorSetupGuides(
  domain: string,
  capabilities: readonly GuideAuditCapability[],
): TailoredGuide[] {
  const order: Record<GuideRelevance, number> = { needed: 0, fix: 1, check_account: 2, verify: 3 };
  return SETUP_GUIDES
    .map((guide) => {
      const { relevance, observed } = relevanceFor(guide.key, capabilities);
      return { ...interpolateDomain(guide, domain), relevance, observed };
    })
    .sort((a, b) => order[a.relevance] - order[b.relevance]);
}
