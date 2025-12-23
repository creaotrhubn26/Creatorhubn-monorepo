/**
 * Datatilsynet GDPR Reference Library
 * Official Norwegian Data Protection Authority compliance requirements
 * Source: https://www.datatilsynet.no/
 */

export const DATATILSYNET_REQUIREMENTS = {
  // Article 13 & 14: Informasjonsplikten
  informationObligation: {
    name: 'Informasjonsplikten (Art. 13 & 14)',
    description: 'Informasjon som skal gis til den registrerte',
    required: true,
    requirements: [
      'Identitet og kontaktinformasjon til behandlingsansvarlig',
      'Kontaktinformasjon til personvernombud (hvis aktuelt)',
      'Formålene med behandlingen og rettslig grunnlag',
      'Mottakere eller kategorier av mottakere av personopplysningene',
      'Informasjon om overføring til tredjeland',
      'Lagringsperiode eller kriterier for å fastsette dette',
      'Informasjon om den registrertes rettigheter',
      'Rett til å trekke tilbake samtykke',
      'Rett til å klage til Datatilsynet',
      'Om oppgitt personopplysninger er lovpålagt eller nødvendig for en avtale',
    ],
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/informasjonsplikt/',
  },

  // Article 15: Innsyn (Right to Access)
  rightToAccess: {
    name: 'Rett til innsyn (Art. 15)',
    description: 'Den registrerte har rett til å få bekreftelse på om personopplysninger behandles',
    required: true,
    deadline: '30 dager',
    requirements: [
      'Bekreftelse på om personopplysninger behandles',
      'Formålene med behandlingen',
      'Kategoriene av personopplysninger',
      'Mottakere eller kategorier av mottakere',
      'Lagringsperiode',
      'Informasjon om den registrertes rettigheter',
      'Rett til å klage til Datatilsynet',
      'Informasjon om hvor opplysningene er hentet fra',
      'Informasjon om eventuelt automatisert beslutningstaking',
    ],
    format: 'Elektronisk format, vanligvis PDF eller CSV',
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/den-registrertes-rettigheter/rett-til-innsyn/',
  },

  // Article 16: Retting (Right to Rectification)
  rightToRectification: {
    name: 'Rett til retting (Art. 16)',
    description: 'Den registrerte har rett til å få rettet uriktige personopplysninger',
    required: true,
    deadline: 'Uten ugrunnet opphold',
    requirements: [
      'Rette uriktige opplysninger',
      'Komplettere ufullstendige opplysninger',
      'Varsle mottakere om rettingen',
    ],
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/den-registrertes-rettigheter/rett-til-retting/',
  },

  // Article 17: Sletting (Right to Erasure / "Right to be Forgotten")
  rightToErasure: {
    name: 'Rett til sletting (Art. 17)',
    description: 'Retten til å bli glemt - den registrerte kan kreve sletting',
    required: true,
    deadline: 'Uten ugrunnet opphold',
    exceptions: [
      'Ytringsfrihet og informasjonsfrihet',
      'Rettslig forpliktelse som krever behandling',
      'Oppgave i samfunnets interesse',
      'Helsemessige formål av allmenn interesse',
      'Arkivformål i samfunnets interesse',
      'Fastleggelse, utøvelse eller forsvar av rettskrav',
    ],
    requirements: [
      'Slette alle personopplysninger',
      'Varsle mottakere om slettingen',
      'Varsle andre behandlingsansvarlige om slettingen',
      'Dokumentere slettingen i audit log',
    ],
    norwegianLaw: 'Bokføringsloven krever 5 års oppbevaring av regnskapsdata',
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/den-registrertes-rettigheter/rett-til-sletting/',
  },

  // Article 18: Begrensning av behandling (Right to Restriction)
  rightToRestriction: {
    name: 'Rett til begrensning av behandling (Art. 18)',
    description: 'Den registrerte kan kreve at behandlingen begrenses',
    required: true,
    deadline: 'Uten ugrunnet opphold',
    requirements: [
      'Begrense behandlingen til lagring',
      'Varsle den registrerte før begrensningen oppheves',
      'Varsle mottakere om begrensningen',
    ],
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/den-registrertes-rettigheter/rett-til-begrensning/',
  },

  // Article 20: Dataportabilitet (Right to Data Portability)
  rightToPortability: {
    name: 'Rett til dataportabilitet (Art. 20)',
    description:
      'Den registrerte har rett til å motta sine personopplysninger i strukturert, alminnelig brukt og maskinlesbart format',
    required: true,
    deadline: '30 dager',
    requirements: [
      'Levere data i strukturert, maskinlesbart format (JSON, CSV, XML)',
      'Overføre data direkte til annen behandlingsansvarlig hvis teknisk mulig',
      'Omfatter kun data basert på samtykke eller avtale',
    ],
    formats: ['JSON', 'CSV', 'XML'],
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/den-registrertes-rettigheter/rett-til-dataportabilitet/',
  },

  // Article 21: Protestere (Right to Object)
  rightToObject: {
    name: 'Rett til å protestere (Art. 21)',
    description: 'Den registrerte har rett til å protestere mot behandling',
    required: true,
    deadline: 'Uten ugrunnet opphold',
    requirements: [
      'Vurdere protesten og dokumentere vurderingen',
      'Slutte å behandle med mindre det er tungtveiende berettigede grunner',
      'Alltid slutte å behandle for direkte markedsføring',
    ],
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/den-registrertes-rettigheter/protestere-mot-behandling/',
  },

  // Article 32: Sikkerhet i behandlingen (Security of Processing)
  securityOfProcessing: {
    name: 'Sikkerhet i behandlingen (Art. 32)',
    description: 'Krav til sikkerhet ved behandling av personopplysninger',
    required: true,
    requirements: [
      'Pseudonymisering og kryptering av personopplysninger',
      'Evne til å sikre vedvarende konfidensialitet, integritet, tilgjengelighet og robusthet',
      'Evne til å gjenopprette tilgjengeligheten og tilgangen til personopplysninger',
      'Regelmessig testing, analyse og evaluering av sikkerhetstiltakene',
    ],
    minimumSecurity: [
      'HTTPS/TLS for all kommunikasjon',
      'Kryptering av sensitive data (bcrypt, AES-256)',
      'Tofaktorautentisering for admin-tilgang',
      'Regelmessige sikkerhetsoppdateringer',
      'Logging av tilgangsforsøk',
    ],
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/innebygd-personvern/sikkerhet-i-behandlingen/',
  },

  // Article 33: Varslingsplikt ved databrudd (Breach Notification)
  breachNotification: {
    name: 'Varslingsplikt ved databrudd (Art. 33 & 34)',
    description: 'Plikt til å varsle Datatilsynet og de registrerte ved personopplysningsbrudd',
    required: true,
    deadlineToAuthority: '72 timer',
    deadlineToDataSubjects: 'Uten ugrunnet opphold',
    requirements: [
      'Varsle Datatilsynet innen 72 timer',
      'Varsle berørte personer hvis høy risiko',
      'Dokumentere alle personopplysningsbrudd',
      'Beskrive art, omfang og sannsynlige konsekvenser',
      'Beskrive iverksatte tiltak',
    ],
    notificationEmail: 'post@datatilsynet.no',
    reportingPortal: 'https://melde.datatilsynet.no/',
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/databrudd/',
  },

  // Article 35: Personvernkonsekvensvurdering (DPIA)
  dataProtectionImpactAssessment: {
    name: 'Personvernkonsekvensvurdering (Art. 35)',
    description: 'Krav til vurdering av personvernkonsekvenser',
    required: 'Når behandling sannsynligvis vil medføre høy risiko',
    requirements: [
      'Systematisk beskrivelse av behandlingsaktivitetene',
      'Vurdering av nødvendigheten og forholdsmessigheten',
      'Vurdering av risikoene for den registrertes rettigheter',
      'Beskrivelse av tiltak for å håndtere risikoene',
    ],
    whenRequired: [
      'Systematisk og omfattende profilering med automatiserte beslutninger',
      'Storskala behandling av sensitive personopplysninger',
      'Systematisk overvåking av offentlig tilgjengelige områder',
      'Bruk av ny teknologi',
    ],
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/vurdere-personvernkonsekvenser/',
  },

  // Article 37: Personvernombud (Data Protection Officer)
  dataProtectionOfficer: {
    name: 'Personvernombud (Art. 37)',
    description: 'Krav til utnevnelse av personvernombud',
    requiredWhen: [
      'Offentlig myndighet eller offentlig organ',
      'Kjernevirksomhet omfatter regelmessig og systematisk overvåking av registrerte i stor skala',
      'Kjernevirksomhet omfatter storskala behandling av særlige kategorier av personopplysninger',
    ],
    responsibilities: [
      'Informere og gi råd om forpliktelser etter GDPR',
      'Overvåke etterlevelse av GDPR',
      'Gi råd om personvernkonsekvensvurdering',
      'Samarbeide med Datatilsynet',
      'Være kontaktpunkt for Datatilsynet',
    ],
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/personvernombud/',
  },

  // Norwegian Specific: Bokføringsloven
  norwegianAccountingLaw: {
    name: 'Bokføringsloven',
    description: 'Norsk lov som krever oppbevaring av regnskapsdata',
    retentionPeriod: '5 år',
    requirements: [
      'Fakturaer må oppbevares i 5 år',
      'Regnskapsbilag må oppbevares i 5 år',
      'Årsregnskap må oppbevares i 10 år',
      'Dette gjelder selv om bruker ber om sletting (GDPR unntak)',
    ],
    conflictResolution: 'Bokføringsloven har forrang ved konflikt med GDPR slettingsrett',
    datatilsynetUrl:
      'https://www.datatilsynet.no/regelverk-og-verktoy/lover-og-regler/bokforingsloven/',
  },

  // Cookie Consent Requirements
  cookieConsent: {
    name: 'Samtykke til informasjonskapsler',
    description: 'Krav til samtykke for bruk av cookies og sporingsteknikker',
    required: true,
    requirements: [
      'Forhåndsinformert og fritt samtykke for ikke-nødvendige cookies',
      'Mulighet til å avslå cookies',
      'Separate samtykker for ulike formål (analyse, markedsføring)',
      'Lett tilgjengelig informasjon om cookies',
      'Mulighet til å trekke tilbake samtykke',
    ],
    exemptions: [
      'Strengt nødvendige cookies (autentisering, handlekurv)',
      'Cookies for å huske brukervalg',
    ],
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/cookies/',
  },

  // Complaint Process
  complaintProcess: {
    name: 'Klageadgang til Datatilsynet',
    description: 'Den registrertes rett til å klage',
    authority: 'Datatilsynet',
    contact: {
      email: 'post@datatilsynet.no',
      phone: '+47 22 39 69 00',
      address: 'Postboks 8177 Dep, 0034 Oslo',
      website: 'https://www.datatilsynet.no/',
      complaintForm:
        'https://www.datatilsynet.no/om-datatilsynet/kontakt-oss/klage-til-datatilsynet/',
    },
    requirements: [
      'Informere brukere om rett til å klage',
      'Oppgi kontaktinformasjon til Datatilsynet',
      'Ikke kreve at brukeren må klage til virksomheten først',
    ],
  },

  // Processing Basis
  processingBasis: {
    name: 'Behandlingsgrunnlag (Art. 6)',
    description: 'Lovlig grunnlag for behandling av personopplysninger',
    required: true,
    legalBases: [
      {
        type: 'consent',
        name: 'Samtykke (Art. 6(1)(a))',
        description: 'Den registrerte har samtykket til behandling',
        requirements: [
          'Fritt, spesifikt, informert og utvetydig',
          'Aktivt samtykke (ikke forhåndsmerket)',
          'Kan trekkes tilbake når som helst',
          'Dokumenteres og kan bevises',
        ],
      },
      {
        type: 'contract',
        name: 'Avtale (Art. 6(1)(b))',
        description: 'Behandling er nødvendig for å oppfylle en avtale',
        requirements: [
          'Avtale med den registrerte',
          'Behandling er nødvendig for å oppfylle avtalen',
        ],
      },
      {
        type: 'legal_obligation',
        name: 'Rettslig forpliktelse (Art. 6(1)(c))',
        description: 'Behandling er nødvendig for å oppfylle en rettslig forpliktelse',
        examples: ['Bokføringsloven', 'Skattelovgivning', 'Arbeidsmiljøloven'],
      },
      {
        type: 'legitimate_interest',
        name: 'Legitim interesse (Art. 6(1)(f))',
        description: 'Behandling er nødvendig for formål knyttet til legitime interesser',
        requirements: [
          'Interesseavveining må gjennomføres',
          'Legitim interesse må dokumenteres',
          'Den registrertes interesser må vurderes',
          'Mulighet til å protestere må gis',
        ],
      },
    ],
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/behandlingsgrunnlag/',
  },

  // Data Retention
  dataRetention: {
    name: 'Lagringsperioder',
    description: 'Krav til hvor lenge personopplysninger kan lagres',
    principle: 'Ikke lenger enn nødvendig',
    requirements: [
      'Fastsette konkrete lagringsperioder',
      'Slette eller anonymisere når formålet er oppnådd',
      'Ta hensyn til rettslige forpliktelser (f.eks. bokføringsloven)',
      'Dokumentere grunnlaget for lagringsperioden',
    ],
    norwegianStandards: {
      accounting: '5 år (bokføringsloven)',
      taxRecords: '10 år (årsregnskap)',
      contracts: '5 år etter avtaleperiode',
      communicationLogs: '1 år (kundeservice)',
      auditLogs: '7 år (compliance)',
      marketingConsent: '2 år etter siste aktivitet',
      inactiveAccounts: '12 måneder varsel, deretter sletting',
    },
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/lagringsperioder/',
  },

  // Privacy by Design and Default
  privacyByDesign: {
    name: 'Innebygd personvern (Art. 25)',
    description: 'Privacy by Design and by Default',
    required: true,
    requirements: [
      'Innebygd personvern fra starten av utviklingsprosessen',
      'Standardinnstillinger skal være personvernvennlige',
      'Kun behandle personopplysninger som er nødvendige',
      'Minimere mengden personopplysninger',
      'Begrense tilgang til personopplysninger',
      'Automatisk sletting når formålet er oppnådd',
    ],
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/innebygd-personvern/',
  },

  // Record of Processing Activities
  processingRecord: {
    name: 'Protokoll over behandlingsaktiviteter (Art. 30)',
    description: 'Krav til dokumentasjon av behandlingsaktiviteter',
    requiredFor: 'Virksomheter med 250+ ansatte eller regelmessig behandling av personopplysninger',
    requirements: [
      'Behandlingsansvarliges navn og kontaktinformasjon',
      'Formålene med behandlingen',
      'Beskrivelse av kategorier av registrerte og av kategorier av personopplysninger',
      'Kategorier av mottakere',
      'Overføringer til tredjeland',
      'Frister for sletting',
      'Generell beskrivelse av sikkerhetstiltakene',
    ],
    datatilsynetUrl:
      'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/dokumentere-behandlingsaktiviteter/',
  },

  // Fines and Penalties
  finesAndPenalties: {
    name: 'Overtredelsesgebyr',
    description: 'Sanksjoner ved brudd på GDPR',
    maxFines: {
      tier1: 'Inntil 10 millioner euro eller 2% av total worldwide årlig omsetning',
      tier2: 'Inntil 20 millioner euro eller 4% av total worldwide årlig omsetning',
    },
    tier2Violations: [
      'Brudd på grunnleggende prinsipper for behandling (Art. 5)',
      'Brudd på vilkår for samtykke (Art. 7)',
      'Brudd på den registrertes rettigheter (Art. 12-22)',
      'Ulovlig overføring til tredjeland (Art. 44-49)',
    ],
    datatilsynetGuidance: 'Datatilsynet vurderer hvert tilfelle individuelt',
    datatilsynetUrl:
      'https://www.datatilsynet.no/regelverk-og-verktoy/sanksjoner-og-reaksjoner/overtredelsesgebyr/',
  },
};

/**
 * CreatorHub Norge - GDPR Compliance Checklist
 * Based on Datatilsynet requirements
 */
export const GDPR_COMPLIANCE_CHECKLIST = [
  {
    id: 'information-obligation',
    category: 'Informasjonsplikten',
    priority: 'critical',
    articleNumber: 'Art. 13 & 14',
    requirement: 'Gi fullstendig informasjon til brukere om behandling av deres personopplysninger',
    status: 'completed',
    implementation: [
      '✅ Personvernerklæring tilgjengelig på /privacy-policy',
      '✅ Cookie-banner med informasjon',
      '✅ Informasjon om behandlingsansvarlig (QAZI FOTOREEL)',
      '✅ Kontaktinformasjon til Datatilsynet inkludert',
    ],
  },
  {
    id: 'consent-management',
    category: 'Samtykke',
    priority: 'critical',
    articleNumber: 'Art. 6 & 7',
    requirement: 'Innhente og administrere samtykke korrekt',
    status: 'completed',
    implementation: [
      '✅ Cookie-samtykke banner (GdprNotice.tsx)',
      '✅ Separate samtykker for analytics og marketing',
      '✅ Mulighet til å avslå',
      '✅ Mulighet til å trekke tilbake samtykke',
    ],
  },
  {
    id: 'right-to-access',
    category: 'Rett til innsyn',
    priority: 'critical',
    articleNumber: 'Art. 15',
    requirement: 'Gi brukere tilgang til deres personopplysninger innen 30 dager',
    status: 'completed',
    implementation: [
      '✅ User settings viser personopplysninger',
      '✅ Dataeksport API (JSON, CSV, XML)',
      '✅ GDPR panel export dialog',
      '✅ Inkluderer alle personopplysninger',
    ],
  },
  {
    id: 'right-to-erasure',
    category: 'Rett til sletting',
    priority: 'critical',
    articleNumber: 'Art. 17',
    requirement: 'Slette personopplysninger på forespørsel',
    status: 'completed',
    implementation: [
      '✅ User deletion workflow (business-lifecycle-routes.ts)',
      '✅ Automatic deletion after 30 days',
      '✅ Audit logging of deletions',
      '✅ Exception for bokføringsloven (5 years)',
    ],
  },
  {
    id: 'right-to-rectification',
    category: 'Rett til retting',
    priority: 'high',
    articleNumber: 'Art. 16',
    requirement: 'Tillate brukere å rette uriktige opplysninger',
    status: 'completed',
    implementation: [
      '✅ User settings allows editing all profile fields',
      '✅ Business info can be updated (BusinessInfoSettings.tsx)',
      '✅ BRREG auto-validation ensures accuracy',
    ],
  },
  {
    id: 'data-portability',
    category: 'Dataportabilitet',
    priority: 'high',
    articleNumber: 'Art. 20',
    requirement: 'Gi brukere data i maskinlesbart format',
    status: 'completed',
    implementation: [
      '✅ JSON export implementert',
      '✅ CSV export implementert',
      '✅ XML export implementert',
      '✅ Datatilsynet-godkjente formater',
    ],
  },
  {
    id: 'security-measures',
    category: 'Sikkerhet i behandlingen',
    priority: 'critical',
    articleNumber: 'Art. 32',
    requirement: 'Implementere passende sikkerhetstiltak',
    status: 'completed',
    implementation: [
      '✅ HTTPS/TLS encryption',
      '✅ Password hashing (bcrypt)',
      '✅ Session management',
      '✅ SQL injection protection (Drizzle ORM)',
      '✅ XSS protection',
      '✅ CSRF protection',
    ],
  },
  {
    id: 'breach-notification',
    category: 'Varslingsplikt ved databrudd',
    priority: 'critical',
    articleNumber: 'Art. 33 & 34',
    requirement: 'Varsle Datatilsynet innen 72 timer ved databrudd',
    status: 'completed',
    implementation: [
      '✅ Security incident tracking in GDPR panel',
      '✅ Datatilsynet contact info readily available',
      '✅ Direct link to melde.datatilsynet.no',
      '✅ 72-hour deadline prominently displayed',
    ],
  },
  {
    id: 'processing-record',
    category: 'Protokoll over behandlingsaktiviteter',
    priority: 'high',
    articleNumber: 'Art. 30',
    requirement: 'Føre protokoll over behandlingsaktiviteter',
    status: 'completed',
    implementation: [
      '✅ Audit logging system (audit_entries table)',
      '✅ User activity logs',
      '✅ Feature management audit',
      '✅ Deletion audit log',
    ],
  },
  {
    id: 'data-retention',
    category: 'Lagringsperioder',
    priority: 'high',
    articleNumber: 'Art. 5(1)(e)',
    requirement: 'Fastsette og overholde lagringsperioder',
    status: 'completed',
    implementation: [
      '✅ User accounts: 30 days after deactivation',
      '✅ Project files: 3 years after completion',
      '✅ Communication logs: 1 year',
      '✅ Audit trails: 7 years',
      '✅ Invoices: 5 years (bokføringsloven)',
      '✅ Automated cleanup jobs (data-cleanup-job.ts)',
    ],
  },
];

/**
 * Datatilsynet Contact Information
 */
export const DATATILSYNET_CONTACT = {
  name: 'Datatilsynet',
  fullName: 'Datatilsynet - Den norske personvernmyndigheten',
  email: 'post@datatilsynet.no',
  phone: '+47 22 39 69 00',
  address: {
    street: 'Postboks 8177 Dep',
    postalCode: '0034',
    city: 'Oslo',
    country: 'Norge',
  },
  website: 'https://www.datatilsynet.no/',
  complaintForm: 'https://www.datatilsynet.no/om-datatilsynet/kontakt-oss/klage-til-datatilsynet/',
  breachReportingPortal: 'https://melde.datatilsynet.no/',
  openingHours: {
    phone: 'Man-Fre 09:00-15:00',
    email: 'Svarer innen 5 virkedager',
  },
};

/**
 * CreatorHub Norge Data Processing Information
 * For inclusion in privacy policy
 */
export const CREATORHUB_PROCESSING_INFO = {
  dataController: {
    name: 'QAZI FOTOREEL',
    organizationNumber: '833038222',
    address: 'Norge',
    email: 'daniel@creatorhubn.com',
    website: 'https://creatorhubn.com',
  },
  dataProtectionOfficer: {
    required: false,
    reason: 'Ikke kjernevirksomhet med storskala overvåking',
    contact: 'daniel@creatorhubn.com', // Kontaktperson for personvernhenvendelser
  },
  processingPurposes: [
    {
      purpose: 'Levere og administrere CreatorHub Norge-plattformen',
      legalBasis: 'Avtale (Art. 6(1)(b))',
      dataCategories: ['Navn', 'E-post', 'Telefon', 'Bedriftsinformasjon', 'Prosjektdata'],
      retentionPeriod: 'Så lenge avtaleforholdet består + 3 år',
    },
    {
      purpose: 'Behandle betalinger og abonnementer',
      legalBasis: 'Avtale (Art. 6(1)(b))',
      dataCategories: ['Betalingsinformasjon (via Stripe)', 'Fakturahistorikk'],
      retentionPeriod: '5 år (bokføringsloven)',
    },
    {
      purpose: 'Forbedre plattformen og brukeropplevelsen',
      legalBasis: 'Samtykke (Art. 6(1)(a))',
      dataCategories: ['Bruksstatistikk', 'Anonym analytics data'],
      retentionPeriod: '2 år etter siste aktivitet',
    },
    {
      purpose: 'Sende nyhetsbrev og markedsføring',
      legalBasis: 'Samtykke (Art. 6(1)(a))',
      dataCategories: ['E-post', 'Navn', 'Preferanser'],
      retentionPeriod: '2 år etter siste aktivitet eller inntil samtykke trekkes tilbake',
    },
    {
      purpose: 'Overholde rettslige forpliktelser',
      legalBasis: 'Rettslig forpliktelse (Art. 6(1)(c))',
      dataCategories: ['Regnskapsdata', 'Fakturaer', 'MVA-rapporter'],
      retentionPeriod: '5-10 år (bokføringsloven)',
    },
  ],
  dataRecipients: [
    {
      name: 'Stripe',
      purpose: 'Betalingsbehandling',
      location: 'EU/EØS',
      safeguards: 'Standard Contractual Clauses (SCC)',
    },
    {
      name: 'Google Cloud Platform',
      purpose: 'Hosting og lagring',
      location: 'EU (europa-north1)',
      safeguards: 'GDPR-compliant data processing agreement',
    },
    {
      name: 'Proff.no (Bisnode)',
      purpose: 'Kredittsjekk og bedriftsinformasjon',
      location: 'Norge',
      safeguards: 'Norsk selskap, underlagt norsk personvernlovgivning',
    },
  ],
  userRights: [
    'Rett til innsyn i dine personopplysninger (Art. 15)',
    'Rett til retting av uriktige opplysninger (Art. 16)',
    'Rett til sletting ("retten til å bli glemt") (Art. 17)',
    'Rett til begrensning av behandling (Art. 18)',
    'Rett til dataportabilitet (Art. 20)',
    'Rett til å protestere mot behandling (Art. 21)',
    'Rett til å klage til Datatilsynet',
  ],
};

/**
 * Generate compliance score based on checklist
 */
export function calculateComplianceScore(): number {
  const completed = GDPR_COMPLIANCE_CHECKLIST.filter((item) => item.status === 'completed').length;
  const total = GDPR_COMPLIANCE_CHECKLIST.length;
  return Math.round((completed / total) * 100);
}

/**
 * Get pending compliance items
 */
export function getPendingComplianceItems() {
  return GDPR_COMPLIANCE_CHECKLIST.filter(
    (item) => item.status === 'partial' || item.status === 'pending',
  );
}

/**
 * Get critical compliance items
 */
export function getCriticalComplianceItems() {
  return GDPR_COMPLIANCE_CHECKLIST.filter((item) => item.priority === 'critical');
}
