/**
 * Marketer-helper for datakilde-onboarding av klient.
 *
 * Når markedsføreren skal koble en kundes Google Analytics, Meta Business
 * Manager eller GBP, må kunden ofte (a) gi tilgang som Admin/Viewer, og
 * (b) gi markedsføreren ID-er som GA4 property-id eller GBP location-id.
 *
 * Denne modulen genererer:
 *   1. Ferdig norsk e-post (subject + body) med mailto:-URL
 *   2. Stegvis guide markedsføreren kan vise klienten direkte i app-en
 *   3. Felles "trenger jeg hjelp?"-CTA som lenker til marketer's
 *      Calendly/Cal.com-side
 *
 * Templates er bevisst lavt-friksjon — én forventet handling per epost,
 * ikke en lang sjekkliste som klienten ignorerer.
 */

export type DataSourcePlatformKey =
  | 'google_analytics'
  | 'google_business'
  | 'google_search_console'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'tiktok';

export interface ClientOnboardingTemplate {
  /** Plattformnavn til UI */
  platformLabel: string;
  /** E-post subject (uten "Re:" / "Fwd:") */
  emailSubject: string;
  /** E-post body på norsk, klar til mailto: */
  emailBody: string;
  /** Stegvis guide for klienten (numerert markdown) */
  clientGuideSteps: Array<{
    step: number;
    title: string;
    detail: string;
    /** Hvis trinnet inneholder en lenke klienten må åpne. */
    actionUrl?: string;
    actionLabel?: string;
  }>;
  /** Hva markedsføreren trenger tilbake fra klienten (input til DataSourcesPanel-config-modal) */
  expectedReturnData: Array<{
    field: string;
    example: string;
  }>;
  /** Lese-tid for hele guiden i minutter. */
  estimatedMinutes: number;
}

const TEMPLATES: Record<DataSourcePlatformKey, (input: { marketerName: string; companyName: string; marketerEmail: string }) => ClientOnboardingTemplate> = {
  google_analytics: ({ marketerName, companyName, marketerEmail }) => ({
    platformLabel: 'Google Analytics 4',
    emailSubject: `Tilgang til Google Analytics for ${companyName}`,
    emailBody: `Hei!

Jeg trenger tilgang til Google Analytics for ${companyName} for å kunne måle hvordan nettsiden presterer og knytte resultater til arbeidet vi gjør sammen.

Det jeg trenger fra deg:

1. **Legg meg til som Viewer i Google Analytics**
   - Gå til https://analytics.google.com → Admin (tannhjul-ikonet)
   - Under "Property" → klikk "Property access management"
   - Klikk "Add users" → skriv inn: ${marketerEmail}
   - Velg rolle: "Viewer"
   - Klikk "Add" — du trenger ikke å sende meg invitasjonen, jeg får e-post automatisk

2. **Send meg GA4 Property ID-en**
   - I samme Admin-side → "Property settings"
   - Property ID er det 9-sifrede tallet under property-navnet
   - Eksempel: 378451237

Når dette er på plass logger jeg meg inn og kobler dataen til rapporten din. Det tar typisk 24 timer før første tall dukker opp.

Trenger du hjelp? Svar på denne e-posten — det er ofte raskest med en 10-min skjermdeling.

Mvh,
${marketerName}`,
    clientGuideSteps: [
      {
        step: 1,
        title: 'Åpne Google Analytics',
        detail: 'Logg inn med Google-kontoen som administrerer Analytics for bedriften.',
        actionUrl: 'https://analytics.google.com',
        actionLabel: 'Åpne analytics.google.com',
      },
      {
        step: 2,
        title: 'Gå til Admin',
        detail: 'Klikk tannhjul-ikonet nederst til venstre. Du må være eier (Editor eller høyere) for å kunne gi andre tilgang.',
      },
      {
        step: 3,
        title: 'Velg "Property access management"',
        detail: 'Under "Property"-kolonnen. Hvis du ikke ser dette, er du ikke eier — be eier om hjelp.',
      },
      {
        step: 4,
        title: `Legg til ${marketerEmail} som "Viewer"`,
        detail: 'Klikk "Add users" → skriv inn e-posten → velg rolle "Viewer" → klikk "Add". Viewer kan lese data, ikke endre noe.',
      },
      {
        step: 5,
        title: 'Send Property ID',
        detail: 'Property ID finnes i "Property settings" under Admin. Det er et 9-sifret tall. Send det til markedsføreren i en epost.',
      },
    ],
    expectedReturnData: [
      { field: 'GA4 Property ID', example: '378451237' },
    ],
    estimatedMinutes: 5,
  }),

  google_business: ({ marketerName, companyName, marketerEmail }) => ({
    platformLabel: 'Google Bedriftsprofil',
    emailSubject: `Tilgang til Google Bedriftsprofil for ${companyName}`,
    emailBody: `Hei!

For å hjelpe dere med lokalsøk-ytelse (visninger, telefonklikk, rute-klikk fra Google Maps) trenger jeg manager-tilgang til Google Bedriftsprofil for ${companyName}.

Det jeg trenger:

1. **Gi meg Manager-tilgang til bedriftsprofilen**
   - Gå til https://business.google.com
   - Velg riktig bedriftslokasjon (hvis dere har flere)
   - Klikk "Innstillinger" → "Brukere"
   - Klikk "Legg til" → e-post: ${marketerEmail}
   - Velg rolle: "Manager" (Owner gir for mye tilgang)

Du trenger ikke å sende meg location-ID — jeg kan hente det automatisk når jeg har tilgang.

Hvis du ikke er eier av profilen, eller bedriften ikke er verifisert i Google Maps ennå, gi meg beskjed så hjelper jeg deg gjennom oppsett.

Mvh,
${marketerName}`,
    clientGuideSteps: [
      {
        step: 1,
        title: 'Åpne Google Bedriftsprofil',
        detail: 'Logg inn med Google-kontoen som eier bedriftsprofilen.',
        actionUrl: 'https://business.google.com',
        actionLabel: 'Åpne business.google.com',
      },
      {
        step: 2,
        title: 'Velg riktig lokasjon',
        detail: 'Hvis dere har flere lokasjoner, sørg for å velge den vi snakker om. Hver lokasjon administreres separat.',
      },
      {
        step: 3,
        title: 'Gå til Innstillinger → Brukere',
        detail: 'Tannhjul-ikonet eller "Innstillinger" i venstre meny → "Brukere"-fanen.',
      },
      {
        step: 4,
        title: `Legg til ${marketerEmail} som Manager`,
        detail: 'Klikk "Legg til" → skriv inn e-posten → velg rolle "Manager". Manager kan lese insights og oppdatere innhold, men ikke slette profilen.',
      },
    ],
    expectedReturnData: [
      { field: 'Bekreftelse på at tilgang er gitt (manager-rolle)', example: '"Du er nå manager"-e-post fra Google' },
    ],
    estimatedMinutes: 3,
  }),

  google_search_console: ({ marketerName, companyName, marketerEmail }) => ({
    platformLabel: 'Google Search Console',
    emailSubject: `Tilgang til Search Console for ${companyName}`,
    emailBody: `Hei!

For å spore organisk søketrafikk (hvilke søkeord dere rangerer på, klikk-rate, posisjon) trenger jeg tilgang til Google Search Console.

Det jeg trenger:

1. **Sjekk om nettsiden er verifisert i Search Console**
   - Gå til https://search.google.com/search-console
   - Velg domenet for ${companyName}
   - Hvis det IKKE er verifisert, gi meg beskjed — det krever én DNS-record eller HTML-fil-opplastning (vi kan hjelpe med dette)

2. **Gi meg "Full"-tilgang**
   - I Search Console: klikk Innstillinger (tannhjul) → "Brukere og tillatelser"
   - Klikk "Legg til bruker" → e-post: ${marketerEmail}
   - Velg "Full"-tilgang (ikke "Restricted")

Når dette er gjort kobler jeg automatisk + henter ukentlige rapporter.

Mvh,
${marketerName}`,
    clientGuideSteps: [
      {
        step: 1,
        title: 'Åpne Search Console',
        detail: 'Logg inn med Google-kontoen som verifiserte domenet.',
        actionUrl: 'https://search.google.com/search-console',
        actionLabel: 'Åpne Search Console',
      },
      {
        step: 2,
        title: 'Velg domenet',
        detail: 'Hvis du ikke ser domenet, har det ikke vært verifisert ennå. Si fra til markedsføreren.',
      },
      {
        step: 3,
        title: 'Gå til Innstillinger → Brukere og tillatelser',
        detail: 'Tannhjul-ikonet eller "Innstillinger" → "Users and permissions".',
      },
      {
        step: 4,
        title: `Legg til ${marketerEmail} med "Full"-tilgang`,
        detail: 'Klikk "Add user" → skriv inn e-posten → velg "Full" (Restricted gir for lite). Full kan lese alt, men ikke endre verifisering.',
      },
    ],
    expectedReturnData: [
      { field: 'Bekreftelse på at brukeren er lagt til', example: 'Brukerlisten viser markedsføreren med Full-tilgang' },
    ],
    estimatedMinutes: 4,
  }),

  youtube: ({ marketerName, companyName, marketerEmail }) => ({
    platformLabel: 'YouTube Analytics',
    emailSubject: `Manager-tilgang til YouTube-kanal for ${companyName}`,
    emailBody: `Hei!

For å spore YouTube-ytelse (visninger, watch time, abonnenter, beste videoer) trenger jeg Manager-tilgang til kanalen til ${companyName}.

Det jeg trenger:

1. **Legg meg til som Manager på YouTube-kanalen**
   - Gå til https://studio.youtube.com
   - Klikk Innstillinger (tannhjul) → "Tillatelser"
   - Klikk "Inviter" → e-post: ${marketerEmail}
   - Velg rolle: "Manager" (ikke "Editor" — Manager kan se Analytics)

Manager-rollen lar meg lese analytics og laste opp videoer, men ikke slette kanalen eller endre eierskap.

Mvh,
${marketerName}`,
    clientGuideSteps: [
      {
        step: 1,
        title: 'Åpne YouTube Studio',
        detail: 'Logg inn med Google-kontoen koblet til YouTube-kanalen.',
        actionUrl: 'https://studio.youtube.com',
        actionLabel: 'Åpne studio.youtube.com',
      },
      {
        step: 2,
        title: 'Innstillinger → Tillatelser',
        detail: 'Tannhjul-ikonet nederst i venstremenyen → "Permissions"-fanen.',
      },
      {
        step: 3,
        title: `Inviter ${marketerEmail} som Manager`,
        detail: 'Klikk "Invite" → skriv inn e-posten → velg rolle "Manager".',
      },
    ],
    expectedReturnData: [
      { field: 'Bekreftelse på invitasjon', example: 'Invitasjon sendt til markedsføreren' },
    ],
    estimatedMinutes: 2,
  }),

  instagram: ({ marketerName, companyName, marketerEmail }) => ({
    platformLabel: 'Instagram (Meta Business)',
    emailSubject: `Tilgang til Instagram for ${companyName}`,
    emailBody: `Hei!

For å publisere innhold og måle reach/engagement for Instagram trenger jeg tilgang via Meta Business Manager.

To krav før dette fungerer:

1. **Instagram-kontoen må være Business eller Creator-konto**
   - Sjekk i Instagram-appen: Innstillinger → Konto → "Bytt til Business/Creator"
   - Hvis dere har personlig konto, må vi bytte først (gratis, ingen data går tapt)

2. **Kontoen må være koblet til en Facebook-side i Meta Business Manager**
   - Gå til https://business.facebook.com
   - Velg riktig business
   - Brukere → Personer → "Legg til" → e-post: ${marketerEmail}
   - Velg rolle "Editor" på Facebook-siden + Instagram-kontoen

Når dette er på plass kan jeg koble vi rktøyet via OAuth — du får én popup som ber deg samtykke.

Mvh,
${marketerName}`,
    clientGuideSteps: [
      {
        step: 1,
        title: 'Sjekk at IG er Business-konto',
        detail: 'I Instagram-appen: Innstillinger → Konto → ser du "Bytt til personlig konto"? Da er den Business. Hvis du ser "Bytt til Business", trykk og fullfør.',
      },
      {
        step: 2,
        title: 'Åpne Meta Business Manager',
        detail: 'Logg inn med Facebook-kontoen som er admin for Facebook-siden.',
        actionUrl: 'https://business.facebook.com',
        actionLabel: 'Åpne business.facebook.com',
      },
      {
        step: 3,
        title: 'Brukere → Personer → Legg til',
        detail: 'Venstremenyen: "Users" → "People" → klikk blå "Add"-knapp.',
      },
      {
        step: 4,
        title: `Inviter ${marketerEmail} som Editor`,
        detail: 'Skriv inn e-posten → velg Editor (ikke Admin — Admin gir for mye). Velg både Facebook-siden OG Instagram-kontoen i ressurs-lista.',
      },
    ],
    expectedReturnData: [
      { field: 'Bekreftelse på Business Manager-invitasjon', example: 'Status: "Pending" eller "Accepted" i Users-listen' },
    ],
    estimatedMinutes: 6,
  }),

  facebook: ({ marketerName, companyName, marketerEmail }) => ({
    platformLabel: 'Facebook (Meta Business)',
    emailSubject: `Editor-tilgang til Facebook-side for ${companyName}`,
    emailBody: `Hei!

For å publisere innhold og spore Facebook-side-ytelse trenger jeg Editor-tilgang via Meta Business Manager.

Det jeg trenger:

1. **Legg meg til som Editor på Facebook-siden**
   - Gå til https://business.facebook.com
   - Velg business
   - Brukere → Personer → "Legg til"
   - E-post: ${marketerEmail}
   - Velg rolle "Editor" på riktig Facebook-side

Editor-rollen lar meg publisere og lese insights, men ikke endre side-eierskap eller administrere ads.

Mvh,
${marketerName}`,
    clientGuideSteps: [
      {
        step: 1,
        title: 'Åpne Meta Business Manager',
        detail: 'Du må være admin på Business Manager-en for å gi andre tilgang.',
        actionUrl: 'https://business.facebook.com',
        actionLabel: 'Åpne business.facebook.com',
      },
      {
        step: 2,
        title: 'Brukere → Personer',
        detail: 'I venstremenyen.',
      },
      {
        step: 3,
        title: `Legg til ${marketerEmail} som Editor`,
        detail: 'Klikk Add → e-post → velg Editor-rolle → koble til riktig Facebook-side.',
      },
    ],
    expectedReturnData: [
      { field: 'Facebook Page ID (15-sifret)', example: '123456789012345 — finnes på siden under "About" → "Page ID"' },
    ],
    estimatedMinutes: 4,
  }),

  linkedin: ({ marketerName, companyName, marketerEmail }) => ({
    platformLabel: 'LinkedIn Company Page',
    emailSubject: `Admin-tilgang til LinkedIn for ${companyName}`,
    emailBody: `Hei!

For å publisere på LinkedIn og spore engagement trenger jeg Super Admin- eller Content Admin-tilgang til Company Page-en.

Det jeg trenger (krever to steg):

1. **Følg ${companyName} med min LinkedIn-konto**
   - Send meg LinkedIn-URL-en til Company Page-en så følger jeg den
   - LinkedIn krever at man følger en side før man kan inviteres som admin

2. **Gi meg Content Admin-tilgang**
   - Som Super Admin på siden: gå til Page → "Manage Admins"
   - Skriv inn navnet mitt (jeg vil følge siden først så jeg dukker opp)
   - Velg rolle "Content Admin" (kan publisere og se analytics)

Mvh,
${marketerName}`,
    clientGuideSteps: [
      {
        step: 1,
        title: 'Be markedsføreren følge siden',
        detail: 'LinkedIn krever at brukeren følger Company Page-en før du kan invitere dem som admin. Be markedsføreren følge først.',
      },
      {
        step: 2,
        title: 'Åpne LinkedIn Company Page',
        detail: 'Logg inn med konto som er Super Admin på siden.',
      },
      {
        step: 3,
        title: 'Manage Admins',
        detail: 'På Page → klikk "Admin tools" → "Manage admins".',
      },
      {
        step: 4,
        title: 'Inviter som Content Admin',
        detail: `Skriv inn navnet til markedsføreren → velg "Content Admin"-rolle.`,
      },
    ],
    expectedReturnData: [
      { field: 'Bekreftelse på admin-rolle', example: 'Du står i admin-listen for siden' },
    ],
    estimatedMinutes: 5,
  }),

  tiktok: ({ marketerName, companyName, marketerEmail }) => ({
    platformLabel: 'TikTok Business',
    emailSubject: `Tilgang til TikTok Business for ${companyName}`,
    emailBody: `Hei!

For å spore TikTok-ytelse trenger jeg tilgang via TikTok Business Center.

NB: TikTok krever at vi har en godkjent business-app for å hente analytics. Vi er i ferd med å få denne godkjenningen. Inntil videre kan vi:
- Få deg til å eksportere CSV manuelt månedlig
- Eller vente til godkjenningen er klar (typisk 4-8 uker)

Det jeg trenger på sikt:

1. **TikTok-kontoen må være Business** (ikke Personal eller Creator)
   - I TikTok-appen: Innstillinger → "Bytt til Business-konto" (gratis)
2. **Legg til ${marketerEmail} i TikTok Business Center**
   - Gå til https://business.tiktok.com
   - Brukere → Inviter → Velg rolle

Mvh,
${marketerName}`,
    clientGuideSteps: [
      {
        step: 1,
        title: 'Bytt til Business-konto',
        detail: 'I TikTok-appen: Profil → meny-ikon → Innstillinger → Konto → "Bytt til Business-konto". Gratis, kan reverseres.',
      },
      {
        step: 2,
        title: 'Åpne TikTok Business Center',
        detail: 'Logg inn med TikTok-kontoen.',
        actionUrl: 'https://business.tiktok.com',
        actionLabel: 'Åpne business.tiktok.com',
      },
      {
        step: 3,
        title: 'Inviter markedsføreren',
        detail: `Brukere → Inviter → e-post: ${marketerEmail} → rolle "Operator" eller "Analyst".`,
      },
    ],
    expectedReturnData: [
      { field: 'TikTok-handle på Business-kontoen', example: '@dittfirma' },
    ],
    estimatedMinutes: 4,
  }),
};

export function generateClientOnboardingTemplate(
  platform: DataSourcePlatformKey,
  input: { marketerName: string; companyName: string; marketerEmail: string },
): ClientOnboardingTemplate {
  const builder = TEMPLATES[platform];
  if (!builder) {
    return {
      platformLabel: platform,
      emailSubject: `Tilgang til ${platform} for ${input.companyName}`,
      emailBody: `Hei! Jeg trenger tilgang til ${platform} for ${input.companyName}. Send meg en melding så avtaler vi.\n\nMvh,\n${input.marketerName}`,
      clientGuideSteps: [],
      expectedReturnData: [],
      estimatedMinutes: 5,
    };
  }
  return builder(input);
}

/** Bygg en mailto: URL med subject + body. Browseren åpner default
 *  e-postklient med ferdig-utfylt utkast. Encoder spesialtegn riktig. */
export function buildMailtoUrl(input: {
  to?: string;
  subject: string;
  body: string;
  cc?: string;
}): string {
  const params = new URLSearchParams();
  params.set('subject', input.subject);
  params.set('body', input.body);
  if (input.cc) params.set('cc', input.cc);
  const toClause = input.to ? encodeURIComponent(input.to) : '';
  // Important: mailto-URL bruker `?` ikke `?` etter ?subject — vi bygger manuelt
  // for å unngå at URLSearchParams encoder mellomrom som "+" i body (mailto vil
  // ha "%20"). Bytter ut + med %20 etterpå.
  const qs = params.toString().replace(/\+/g, '%20');
  return `mailto:${toClause}?${qs}`;
}
