import {
  BusinessCenter,
  BarChart,
  MusicNote,
  Videocam,
} from '@mui/icons-material';
/**
 * CreatorHub Norge - Project Worklog Integration Helpers (Client-side)
 * Automatisk worklog-opprettelse ved prosjektopprettelse.
 */

export function getProjectTypeNextSteps(
  projectType: string,
  profession: string
): string {
  const baseSteps: Record<string, string[]> = {
    wedding: [
      'Gjennomgå bryllupstimeline og planlegg fotograferingssekvenser','Send velkomstmelding til brudepar med forberedelsesinfo','Pakk utstyr og sjekk batterier/minnekort','Besøk lokasjon(er) for rekognosering hvis mulig','Bekreft møtetider og kontaktinfo med brudepar',
    ],
    portrait: [
      'Planlegg øktens oppbygning og stilvalg','Diskuter forventninger og ønsker med klient','Velg og book lokasjon for fotografering','Forbered utstyr basert på ønsket stil','Send påminnelse til klient dagen før',
    ],
    commercial: [
      'Gjennomgå brief og kommersielle krav','Avklar rettigheter og bruksområde','Planlegg logistikk og tilgang til lokasjon','Koordiner med eventuell stylist/crew','Forbered shot-liste og tidsplan',
    ],
    event: [
      'Få detaljert program for arrangementet','Identifiser nøkkelpersoner å fotografere','Rekognosér lokasjon og planlegg posisjonering','Avklar behov for spesiell tilgang/akkreditering','Etabler kontakt med arrangør/kontaktperson',
    ],
    product: [
      'Analyser produkt og planlegg oppsett','Planlegg lysoppsett for produkttype','Forbered bakgrunn og props','Avklar leveringsformat og retusjeringsnivå','Lag shot-liste med ulike vinkler',
    ],
    music: [
      'Gjennomgå låtmateriale og referanser','Sjekk studio-setup og teknisk utstyr','Planlegg arbeidsmetode med artist/produsent','Lag tidsplan for innspilling/produksjon','Forbered session-notater og tracking sheets',
    ],
    video: [
      'Gjennomgå manus/storyboard','Planlegg lokasjoner og kameraposisjonering','Sjekk lyd-setup og mikrofoner','Koordiner med cast og crew','Forbered shot-liste og tidsplan',
    ],
};

  const professionSpecific: Record<string, string[]> = {
    photographer: [
      'Sjekk kamerainnstillinger og objektiver','Forbered minnekort og backup-løsninger','Lad batterier og sjekk reserveutstyr',
    ],
    videographer: [
      'Test kamera og videoinnstillinger','Kontroller lydutstyr og mikrofoner','Forbered lagringsplass og backup-rutiner',
    ],
    musicproducer: [
      'Sjekk studio-setup og kalibrering','Forbered plugins og software-oppdateringer','Test monitorer og lytteutstyr',
    ],
    vendor: [
      'Sjekk produkttilgjengelighet og lager','Beregn priser og lønnsomhet','Planlegg logistikk og levering',
    ],
};

  const projectSteps = baseSteps[projectType] ?? [
    'Gjennomgå prosjektdetaljer og krav','Lag detaljert tidsplan for prosjektet','Forbered nødvendig utstyr og ressurser','Etabler kontakt med klient','Bekreft møtetider og praktiske detaljer',
  ];

  const profSteps = professionSpecific[profession] ?? [];

  return [...projectSteps, ...profSteps]
    .slice(0, 5) // Begrens til 5 steg
    .map((step) => `• ${step}`)
    .join('\n');
}

export function getProjectTypeInitialDescription(
  projectType: string,
  clientName: string,
  eventDate: string,
  location?: string
): string {
  const templates: Record<string, string> = {
    wedding: `Bryllupsprosjekt for ${clientName} planlagt ${eventDate}. Dette blir en minneverdig dag som krever grundig planlegging og profesjonell gjennomføring.`,
    portrait: `Portrettfotografering for ${clientName} ${eventDate}. Fokus på naturlige og flatterende bilder som viser personlighet.`,
    commercial: `Kommersielt prosjekt for ${clientName} med opptak ${eventDate}. Profesjonell levering som oppfyller kommersielle standarder.`,
    event: `Event-dekning for ${clientName} ${eventDate}. Dokumentasjon av arrangementets høydepunkter og atmosfære.`,
    product: `Produktfotografering for ${clientName} ${eventDate}. Fokus på å fremheve produktets beste egenskaper for salg og markedsføring.`,
    music: `Musikkproduksjon med ${clientName} startet ${eventDate}. Kreativ prosess for å skape høykvalitets lydopptak.`,
    video: `Videoproduksjon for ${clientName} med opptak ${eventDate}. Komplett produksjon fra planlegging til ferdig resultat.`,
};

  const base =
    templates[projectType] ??
    `Nytt prosjekt for ${clientName} planlagt ${eventDate}. Profesjonell gjennomføring med fokus på kvalitet og kundetilfredshet.`;

  return location ? `${base} Lokasjon: ${location}.` : base;
}

export function getInitialWorklogCategory(
  projectType: string,
  profession: string
): string {
  const categoryMap: Record<string, Record<string, string>> = {
    photographer: {
      wedding: 'planning',
      portrait: 'planning',
      commercial: 'planning',
      event: 'planning',
      product: 'planning',
  },
    videographer: {
      wedding: 'planning',
      commercial: 'planning',
      event: 'planning',
      music: 'planning',
      video: 'planning',
  },
    musicproducer: {
      music: 'planning',
      collaboration: 'planning',
      recording: 'planning',
  },
    vendor: {
      product: 'administration',
      sales: 'sales',
      inventory: 'administration',
  },
};

  return categoryMap[profession]?.[projectType] ?? 'planning';
}
