/**
 * Datatilsynet GDPR Reference - Norwegian Data Protection Authority
 * Official GDPR compliance requirements and contact information
 */

export const DATATILSYNET_CONTACT = {
  email: 'postkasse@datatilsynet.no',
  phone: '+47 22 39 69 00',
  address: {
    street: 'Tollbugata 3',
    postalCode: '0152',
    city: 'Oslo',
    country: 'Norge'
  },
  openingHours: {
    phone: 'Man-Fre 10:00-14:00'
  },
  website: 'https://www.datatilsynet.no'
};

export const DATATILSYNET_REQUIREMENTS = {
  rightToAccess: {
    name: 'Rett til innsyn',
    description: 'Den registrerte har rett til å få bekreftet om personopplysninger behandles, og i så fall få innsyn i opplysningene.',
    datatilsynetUrl: 'https://www.datatilsynet.no/rettigheter-og-plikter/den-registrertes-rettigheter/rett-til-innsyn/',
    requirements: [
      'Bekreftelse på om personopplysninger behandles','Kopi av personopplysningene','Informasjon om formål med behandlingen','Kategorier av personopplysninger','Mottakere eller kategorier av mottakere'
    ]
  },
  rightToErasure: {
    name: 'Rett til sletting',
    description: 'Den registrerte har rett til å få slettet personopplysninger uten ugrunnet opphold.',
    datatilsynetUrl: 'https://www.datatilsynet.no/rettigheter-og-plikter/den-registrertes-rettigheter/rett-til-sletting/',
    norwegianLaw: 'Personopplysningsloven § 17',
    exceptions: [
      'Ytringsfrihet og informasjonsfrihet','Rettslige forpliktelser','Arkivformål i allmennhetens interesse'
    ]
  },
  breachNotification: {
    name: 'Avviksmelding',
    description: 'Ved brudd på personopplysningssikkerheten skal Datatilsynet varsles innen 72 timer.',
    datatilsynetUrl: 'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/avvikshandtering/',
    notificationEmail: 'avvik@datatilsynet.no',
    reportingPortal: 'https://www.datatilsynet.no/om-datatilsynet/kontakt-oss/meld-avvik/'
  },
  rightToPortability: {
    name: 'Rett til dataportabilitet',
    description: 'Den registrerte har rett til å motta personopplysninger i et strukturert, alminnelig anvendt og maskinlesbart format.',
    datatilsynetUrl: 'https://www.datatilsynet.no/rettigheter-og-plikter/den-registrertes-rettigheter/rett-til-dataportabilitet/',
    formats: ['JSON','CSV','XML']
  },
  securityOfProcessing: {
    name: 'Sikkerhet ved behandling',
    description: 'Den behandlingsansvarlige skal gjennomføre egnede tekniske og organisatoriske tiltak for å oppnå et sikkerhetsnivå som er egnet.',
    datatilsynetUrl: 'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/informasjonssikkerhet/',
    minimumSecurity: [
      'Pseudonymisering og kryptering','Evne til å sikre konfidensialitet','Evne til å gjenopprette tilgjengelighet','Regelmessig testing av sikkerhetstiltak'
    ],
    requirements: [
      'Tilgangskontroll','Logging og overvåking','Kryptering av data','Sikkerhetskopier'
    ]
  },
  cookieConsent: {
    name: 'Samtykke til informasjonskapsler',
    description: 'Bruk av informasjonskapsler krever aktivt samtykke fra brukeren, med unntak av nødvendige funksjonelle cookies.',
    datatilsynetUrl: 'https://www.datatilsynet.no/regelverk-og-verktoy/veiledere/cookies-og-sporing/',
    requirements: [
      'Aktivt samtykke før plassering','Informasjon om formål','Mulighet til å trekke samtykke','Dokumentasjon av samtykke'
    ],
    exemptions: [
      'Teknisk nødvendige cookies','Cookies for brukerpreferanser','Autentiserings-cookies'
    ]
  },
  dataRetention: {
    principle: 'Personopplysninger skal ikke lagres lenger enn nødvendig for formålet.',
    datatilsynetUrl: 'https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/lagringstid/',
    norwegianStandards: {
      accounting: '5 år (Bokføringsloven)',
      employment: '3 år etter arbeidsforhold',
      marketing: '3 år etter siste kontakt',
      contracts: '10 år etter avslutning'
    }
  },
  norwegianAccountingLaw: {
    description: 'Bokføringsloven krever oppbevaring av regnskapsmateriale.',
    retentionPeriod: '5 år'
  }
};

export interface GDPRComplianceItem {
  id: string;
  category: string;
  requirement: string;
  status: 'completed' | 'in_progress' | 'pending';
  priority: 'high' | 'medium' | 'low';
  description: string;
}

export const GDPR_COMPLIANCE_CHECKLIST: GDPRComplianceItem[] = [
  { id: '1', category: 'Samtykke', requirement: 'Samtykkeløsning implementert', status: 'completed', priority: 'high', description: 'Aktivt samtykke for databehandling' },
  { id: '2', category: 'Innsyn', requirement: 'Innsynsforespørsel-system', status: 'completed', priority: 'high', description: 'System for håndtering av innsynsforespørsler' },
  { id: '3', category: 'Sletting', requirement: 'Sletterutiner etablert', status: 'completed', priority: 'high', description: 'Automatisk og manuell sletting av data' },
  { id: '4', category: 'Sikkerhet', requirement: 'Kryptering implementert', status: 'completed', priority: 'high', description: 'Data kryptert i transit og hvile' },
  { id: '5', category: 'Avvik', requirement: 'Avvikshåndtering', status: 'in_progress', priority: 'high', description: 'Prosedyrer for avviksmelding' },
  { id: '6', category: 'DPO', requirement: 'Personvernombud utnevnt', status: 'completed', priority: 'medium', description: 'Dedikert personvernombud' },
  { id: '7', category: 'Dokumentasjon', requirement: 'Behandlingsprotokoll', status: 'completed', priority: 'medium', description: 'Oversikt over all databehandling' },
  { id: '8', category: 'Tredjeparter', requirement: 'Databehandleravtaler', status: 'in_progress', priority: 'medium', description: 'Avtaler med alle underleverandører' }
];

export function calculateComplianceScore(items: GDPRComplianceItem[]): number {
  const completed = items.filter(i => i.status === 'completed').length;
  return Math.round((completed / items.length) * 100);
}

export function getPendingComplianceItems(items: GDPRComplianceItem[]): GDPRComplianceItem[] {
  return items.filter(i => i.status !=='completed');
}

