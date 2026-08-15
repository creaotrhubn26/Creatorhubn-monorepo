// @ts-nocheck
import React from "react";
// ProjectCreationWizard Constants
// Extracted from ProjectCreationWithMemoryCards.tsx

import { Favorite, PhotoCamera, Event, Business, VideoLibrary, LibraryMusic, Group, ShoppingBag, AccountBalance, Home, Star, Church, Public, Circle } from '@mui/icons-material';

export const PROJECT_TYPES = {
  wedding: { name: 'Bryllup', icon: Favorite, color: '#e91e63' },
  portrait: { name: 'Portrett', icon: PhotoCamera, color: '#2e7d32' },
  event: { name: 'Event', icon: Event, color: '#ff8c00' },
  commercial: { name: 'Kommersiell', icon: Business, color: '#ff8c00' },
  video: { name: 'Video', icon: VideoLibrary, color: '#1565c0' },
  music: { name: 'Musikk', icon: LibraryMusic, color: '#7b1fa2' },
  family: { name: 'Familie', icon: Group, color: '#00897b' },
  product: { name: 'Produkt', icon: ShoppingBag, color: '#ff8f00' },
} as const;

export const PROJECT_TYPE_CATEGORIES = {
  wedding: {
    name: 'Bryllup',
    cultures: {
      norsk: { name: 'Norsk bryllup', typical_days: 1, day_names: ['Bryllupsdag'], description: 'Tradisjonelt norsk bryllup vanligvis én dag', icon: Event, color: '#E30617' },
      sikh: { name: 'Sikh bryllup', typical_days: 3, day_names: ['Chooda & Haldi', 'Sangeet', 'Anand Karaj & Reception'], description: 'Komplett Sikh bryllup med Chooda Haldi, Sangeet, Baraat, Anand Karaj og Langar', icon: AccountBalance, color: '#FF6B35' },
      indisk: { name: 'Indisk bryllup (Hindu)', typical_days: 4, day_names: ['Ganesh Puja & Haldi', 'Mehendi', 'Sangeet', 'Vielse & Reception'], description: 'Komplett Hindu bryllup med Ganesh Puja, Haldi, Mehendi, Sangeet, Saptapadi og Mangalsutra', icon: AccountBalance, color: '#FF9500' },
      pakistansk: { name: 'Pakistansk bryllup', typical_days: 3, day_names: ['Mehndi & Sangeet', 'Baraat & Nikkah', 'Walima resepsjon'], description: 'Komplett pakistansk bryllup med Mehndi, Baraat, Nikkah og Walima', icon: Home, color: '#00A651' },
      tyrkisk: { name: 'Tyrkisk bryllup', typical_days: 2, day_names: ['Kına Gecesi (Henna)', 'Düğün (Bryllup)'], description: 'Tradisjonell tyrkisk bryllupsfeiring', icon: Star, color: '#E30A17' },
      arabisk: { name: 'Arabisk bryllup', typical_days: 2, day_names: ['Nikah vielse', 'Zaffe & Walima'], description: 'Islamsk vielse med tradisjonell oppsett', icon: Home, color: '#007A3D' },
      somalisk: { name: 'Somalisk bryllup', typical_days: 2, day_names: ['Nikah seremoni', 'Aroos feiring'], description: 'Somaliske tradisjoner med kulturell musikk', icon: Star, color: '#4189DD' },
      etiopisk: { name: 'Etiopisk bryllup', typical_days: 2, day_names: ['Telosh seremoni', 'Kulturell resepsjon'], description: 'Etiopisk ortodoks tradisjon med kaffe-seremoni', icon: Church, color: '#FCDD09' },
      nigeriansk: { name: 'Nigeriansk bryllup', typical_days: 2, day_names: ['White Wedding', 'Traditional Wedding'], description: 'Kombinerer vestlige og tradisjonelle nigerianske ritualer', icon: Public, color: '#008751' },
      muslimsk: { name: 'Muslimsk bryllup', typical_days: 2, day_names: ['Mehendi kveld', 'Nikkah & Walima'], description: 'Islamsk bryllup med Mehndi, Nikkah kontrakt og Walima feiring', icon: Home, color: '#239F40' },
      libanesisk: { name: 'Libanesisk bryllup', typical_days: 2, day_names: ['Henna Party', 'Zaffe & Reception'], description: 'Libanesisk tradisjon med spektakulær Zaffe innmarsj og dabke dans', icon: Star, color: '#FF0000' },
      filipino: { name: 'Filipino bryllup', typical_days: 2, day_names: ['Despedida de Soltera', 'Wedding & Reception'], description: 'Filipino tradisjon med Pamamanhikan, Arras mynter og Veil/Cord seremoni', icon: Public, color: '#0038A8' },
      kinesisk: { name: 'Kinesisk bryllup', typical_days: 2, day_names: ['Tea Ceremony & Hair Combing', 'Door Games & Banquet'], description: 'Tradisjonell kinesisk vielse med te-seremoni, Door Games og Lion Dance', icon: Circle, color: '#DE2910' },
      koreansk: { name: 'Koreansk bryllup', typical_days: 1, day_names: ['Pyebaek & Wedding Hall'], description: 'Moderne koreansk vielse med tradisjonelle elementer', icon: Circle, color: '#003478' },
      thai: { name: 'Thai bryllup', typical_days: 1, day_names: ['Khan Maak & Rod Nam Sang'], description: 'Thai tradisjoner med vann-velsignelse', icon: AccountBalance, color: '#A51931' },
      iransk: { name: 'Iransk/Persisk bryllup', typical_days: 1, day_names: ['Aghd & Aroosi'], description: 'Persisk vielse med Sofreh-e Aghd', icon: Star, color: '#239F40' },
      annet: { name: 'Annet/Tilpasset arrangement', typical_days: 1, day_names: ['Tilpasset dag'], description: 'Fleksibel struktur for andre kulturer eller blandede tradisjoner', icon: Public, color: '#666666' },
    },
  },
  event: { name: 'Event', defaultCategories: ['Innledning', 'Hovedprogram', 'Avslutning'], description: 'Konferanser, seminarer, festivaler og andre arrangementer' },
  portrait: { name: 'Portrett', defaultCategories: ['Studio setup', 'Hovedfotografering', 'Kreative shots'], description: 'Individuell og familiefotografering' },
  commercial: { name: 'Kommersiell', defaultCategories: ['Produktfoto', 'Miljøbilder', 'Team/Corporate'], description: 'Bedriftsfotografering og produktfoto' },
  video: { name: 'Video', defaultCategories: ['Pre-production', 'Hovedinnspilling', 'B-roll'], description: 'Videoproduksjon og filming' },
  music: { name: 'Musikk', defaultCategories: ['Opptak', 'Mixing', 'Mastering'], description: 'Musikkproduksjon og lydarbeid' },
} as const;

export const WEDDING_CULTURES = PROJECT_TYPE_CATEGORIES.wedding.cultures;

export const CULTURAL_DAY_EXPLANATIONS: Record<string, Record<string, string>> = {
  sikh: {
    'Chooda & Haldi': 'Chooda er en seremoni hvor bruden får røde armbånd og Haldi innebærer å smøre gurkemeie på brudeparet for renselse og velsignelser.',
    'Sangeet': 'En musikkfylt feiring med dans og sanger der familiene forbereder seg til bryllupet med glede og tradisjonelle opptredener.',
    'Anand Karaj & Reception': 'Anand Karaj er den hellige Sikh vielsesseremonien i Gurdwara, fulgt av resepsjon med mat og feiring.',
  },
  indisk: {
    'Ganesh Puja & Haldi': 'Ganesh Puja ber om velsignelser fra Ganeshas for å fjerne hindringer og Haldi påføres brudeparet for å rense og beskytte.',
    'Mehendi': 'Kunstferdig hennamaling påføres brudens hender og føtter i komplekse mønstre som symboliserer glede, åndelig oppvåkning og tilbud.',
    'Sangeet': 'En livlig feiring med tradisjonelle sanger, dans og musikk der begge familier deltar i opptredener og konkurranser.',
    'Vielse & Reception': 'Den hellige Hindu vielsesseremonien med Saptapadi (syv skritt) og Mangalsutra, fulgt av festmiddag og tradisjonelle ritualer.',
  },
  pakistansk: {
    'Mehndi & Sangeet': 'Mehndi feiring hvor bruden får henna påført mens familie og venner synger tradisjonelle pakistanske bryllupssanger med tradisjonell musikk og dans.',
    'Baraat & Nikkah': 'Baraat er brudgommens entre til bryllupet, og Nikkah er den religiøse islamske vielsesseremonien med signering av nikah-kontrakt.',
    'Walima resepsjon': 'Walima er den tradisjonelle resepsjonen arrangert av brudgommens familie for å feire det nye ekteskapet med mat og glede.',
  },
  tyrkisk: {
    'Kına Gecesi (Henna)': 'En tradisjonsrik kveld hvor bruden får henna påført hendene mens kvinnelige gjester synger sorgtunge sanger om å forlate barndomshjemmet.',
    'Düğün (Bryllup)': 'Den offisielle bryllupsdagen med sivil eller religiøs seremoni, fulgt av stor feiring med tradisjonell tyrkisk mat, musikk og dans.',
  },
  arabisk: {
    'Nikah vielse': 'Den islamske vielsesseremonien hvor nikah-kontrakten signeres i nærvær av vitner og familie, ofte fulgt av duaa og bønner.',
    'Zaffe & Walima': 'Zaffe er en spektakulær prosesjon med musikk og dans som leder brudeparet til festen, fulgt av Walima resepsjon.',
  },
  somalisk: {
    'Nikah seremoni': 'Den religiøse islamske vielsen med recitasjon av Koranen, nikah-kontrakt og duaa i nærvær av familie og samfunn.',
    'Aroos feiring': 'Tradisjonell somalisk bryllupsfeiring med autentisk mat, kulturdans, poesi og musikk som feirer det nye ekteskapet.',
  },
  etiopisk: {
    'Telosh seremoni': 'En tradisjonell etiopisk førbryllups-seremoni med velsignelser, bønner og familiesamling før den offisielle vielsen.',
    'Kulturell resepsjon': 'Storslått feiring med tradisjonell etiopisk kaffe-seremoni, injera mat, kulturell musikk og dans som feirer den nye familien.',
  },
  nigeriansk: {
    'White Wedding': 'Vestlig-stil bryllup i kirke eller seremoni-lokale med hvit kjole og tradisjonelle europeiske bryllupstradisjoner.',
    'Traditional Wedding': 'Autentisk nigeriansk kulturell seremoni med tradisjonelle klær, ritualer, maten og musikk spesifikk for familiens stamme eller region.',
  },
  muslimsk: {
    'Mehendi kveld': 'En intim feiring hvor bruden og kvinnelige gjester får henna påført i vakre mønstre mens de synger tradisjonelle sanger.',
    'Nikkah & Walima': 'Nikkah er den offisielle islamske vielsesseremonien med kontraktsignering, fulgt av Walima resepsjon for å feire ekteskapet.',
  },
  libanesisk: {
    'Henna Party': 'En livlig feiring hvor bruden får henna påført av eldre kvinnelige slektninger mens gjester deltar i tradisjonell libanesisk musikk.',
    'Zaffe & Reception': 'Spektakulær Zaffe innmarsj med trommer og ululating, fulgt av resepsjon med autentisk libanesisk mat og tradisjonell dabke dans.',
  },
} as const;

export const CULTURAL_DAY_WORKLOG_TIPS: Record<string, Record<string, {
  tasks: string[];
  considerations: string[];
  timeManagement: string;
  keyContacts: string[];
  equipment: string[];
}>> = {
  sikh: {
    'Chooda & Haldi': {
      tasks: [
        "Møte med familiene for å diskutere tidsplan",
        "Undersøke ceremonilokalet og lysforhold",
        "Planlegge foto-øyeblikk for Chooda-seremonien",
        "Koordinere med andre fotografer/videografer",
        "Sjekke tradisjonelle klær og farger for bedre bildekvalitet"
      ],
      considerations: [
        "Haldi kan gjøre klær gule - planlegg utstyr deretter",
        "Respekter hellige øyeblikk - ikke all fotografering er tillatt",
        "Kvinner og menn kan ha separate seremonier",
        "Røde Chooda-armbånd er meget viktige - få nærbilder",
        "Familietradisjoner kan variere - spør alltid først"
      ],
      timeManagement: "Start tidlig på dagen, ceremonien kan ta 3-4 timer",
      keyContacts: ["Brudgens familie", "Religiøs leder", "Event coordinator"],
      equipment: ["85mm linse for portretter", "Rask autofokus for bevegelse", "Backup minnekort"]
    },
    'Sangeet': {
      tasks: [
        "Planlegge bevegelige kameraposisjoner for dans",
        "Teste lydnivå for video-opptak",
        "Koordinere med DJ/musikere",
        "Identifisere VIP-gjester som må fotograferes",
        "Planlegge gruppefoto-øyeblikk"
      ],
      considerations: [
        "Sangeet er en gledesfull begivenhet - fang energien",
        "Dans og musikk - høy ISO og fast lukkertid nødvendig",
        "Fargerike outfits - juster hvitbalanse",
        "Begge familier deltar - få balansert dekning",
        "Kan være sent på kvelden - planlegg belysning"
      ],
      timeManagement: "Lang kveld, 6-8 timer med pauser",
      keyContacts: ["Event planner", "DJ/musikere", "Begge familier"],
      equipment: ["70-200mm for scenefoto", "Flash for indoors", "Ekstra batterier"]
    },
    'Anand Karaj & Reception': {
      tasks: [
        "Lære Sikh vielsesritualer på forhånd",
        "Planlegge diskret fotografering i Gurdwara",
        "Koordinere med Granthi (religiøs leder)",
        "Identifisere Saptapadi (syv skritt) øyeblikk",
        "Planlegge resepsjons-fotografering"
      ],
      considerations: [
        "Sko må av i Gurdwara - planlegg utstyr transport",
        "Hellig sted - vær meget respektfull",
        "Fire runder rundt Guru Granth Sahib er viktige",
        "Langar (gratis måltid) er tradisjon",
        "Kirpan (seremonieschwert) er hellig gjenstand"
      ],
      timeManagement: "Vielse 2-3 timer, resepsjon 4-5 timer",
      keyContacts: ["Granthi", "Gurdwara komité", "Begge familier"],
      equipment: ["24-70mm zoom", "Silent shooting mode", "Respektfulle klær"]
    }
  },
  indisk: {
    'Ganesh Puja & Haldi': {
      tasks: [
        "Lære om Ganesh Puja ritualer på forhånd",
        "Planlegge ceremonifotografering uten å forstyrre",
        "Undersøke tradisjonelle elementer å fokusere på",
        "Koordinere med prest/religiøs leder",
        "Planlegge familiegruppefoto etter seremoni"
      ],
      considerations: [
        "Ganesh Puja er hellig - vær respektfull og diskret",
        "Haldi-pasta gjør alt gult - beskytt utstyr",
        "Mange ritualer krever stillhet",
        "Blomster og offerings er viktige detaljer",
        "Eldre familiemedlemmer kan ha spesielle roller"
      ],
      timeManagement: "Hellig seremoni 2-3 timer, deretter Haldi 1-2 timer",
      keyContacts: ["Hindu prest", "Brudens familie", "Brudgommens familie"],
      equipment: ["50mm for intimitet", "Makro linse for detaljer", "Stille kamera-modus"]
    }
  },
  pakistansk: {
    'Mehndi & Sangeet': {
      tasks: [
        "Planlegge hennamaling close-up fotografering",
        "Koordinere med henna-artisten",
        "Identifisere familiesanger som skal fanges",
        "Planlegge gruppefoto av kvinnelige gjester",
        "Teste fargebalanse for gul/orange belysning"
      ],
      considerations: [
        "Mehndi er ofte kun for kvinner - mann-fotograf kan ha begrenset tilgang",
        "Intrikate henna-mønstre krever makro-fotografering",
        "Tradisjonelle pakistanske sanger - ta lydopptak",
        "Sari og lehenga har vakre detaljer",
        "Kan være formiddags eller kveld - sjekk tidsplan"
      ],
      timeManagement: "Mehndi 3-4 timer, musikk og dans 2-3 timer",
      keyContacts: ["Henna artist", "Brudens søstre/kusiner", "Musikere"],
      equipment: ["Macro linse 100mm", "Ring light for henna", "Audio recorder"]
    }
  }
} as const;

export const PROJECT_PHASES = {
  pre_production: { name: 'Pre-production', description: 'Planlegging, research, møter, forberedelser', color: '#2196f3', categories: ['planning', 'client_meeting', 'cultural_research', 'equipment_prep', 'location_scouting'] },
  production: { name: 'Production', description: 'Selve fotografering, filming, opptak', color: '#4caf50', categories: ['shooting', 'filming', 'recording', 'directing', 'on_set_coordination'] },
  post_production: { name: 'Post-production', description: 'Redigering, fargekorrigering, levering', color: '#ff9800', categories: ['editing', 'color_grading', 'sound_design', 'delivery', 'client_review'] },
  business: { name: 'Business', description: 'Fakturering, markedsføring, oppfølging', color: '#9c27b0', categories: ['invoicing', 'marketing', 'client_follow_up', 'portfolio_update', 'social_media'] },
} as const;

export const LABELING_SCHEMES = {
  ABCD: ['A', 'B', 'C', 'D'],
  EFGH: ['E', 'F', 'G', 'H'],
  NUMERIC: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
} as const;

export type LabelingKey = keyof typeof LABELING_SCHEMES;

export const FOLDERS = [
  ['01_Brief', 12], ['02_Shotlists', 8], ['03_Photo_RAW', 1732], ['04_Video_A_Cam', 214],
  ['05_Video_B_Cam', 186], ['06_Drone', 67], ['07_Audio', 98], ['08_Selects', 156],
  ['09_Client_Review', 23], ['10_Final_Delivery', 0],
] as const;

export const QUICK = [
  ['Unrated', 1205], ['Favoritter', 156], ['For Edit', 312], ['Client Review', 23],
  ['Highlights', 48], ['Forkastet', 12],
] as const;

export const QUICK_REAL = [
  { key: 'alle', label: 'Alle' },
  { key: 'unrated', label: 'Uten rating' },
  { key: 'favoritter', label: 'Favoritter' },
  { key: 'highlights', label: 'Highlights (klient)' },
  { key: 'forkastet', label: 'Forkastet' },
  { key: 'color:', label: 'Fargekode' },
] as const;

export const COLOR_HEX = {
  green: '#34d399',
  amber: '#fbbf24',
  red: '#f87171',
  blue: '#60a5fa',
  purple: '#a78bfa',
  pink: '#f472b6',
  gray: '#94a3b8',
} as const;

export const CREW_ROLE_COLOR: Record<string, string> = {
  photographer: '#1565c0',
  videographer: '#6a1b9a',
  assistant: '#00897b',
  stylist: '#e91e63',
  'makeup_artist': '#e91e63',
  'hair_stylist': '#ff8c00',
  planner: '#7b1fa2',
  coordinator: '#00897b',
  lighting: '#ff8f00',
  sound: '#607d8b',
  drone: '#263238',
  driver: '#795548',
  security: '#37474f',
  other: '#757575',
} as const;

export const CREW_ROLE_LABEL: Record<string, string> = {
  photographer: 'Fotograf',
  videographer: 'Videograf',
  assistant: 'Assistent',
  stylist: 'Stylist',
  'makeup_artist': 'SMU Artist',
  'hair_stylist': 'Hårstylist',
  planner: 'Planlegger',
  coordinator: 'Koordinator',
  lighting: 'Lys',
  sound: 'Lyd',
  drone: 'Drone',
  driver: 'Sjåfør',
  security: 'Sikkerhet',
  other: 'Annet',
} as const;

export const EXT_OF: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov',
  'audio/m4a': 'm4a', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3',
  'audio/wav': 'wav', 'application/pdf': 'pdf',
} as const;

export const SUPPORTED_FEED_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'twitter'] as const;

export const PRESERVED_APPROVAL_KEYS = ['approvedByClient', 'approvedAt', 'approvalNotes'] as const;

export const SUPPORTED_WEDDING_CULTURES = [
  'norsk', 'sikh', 'indisk', 'pakistansk', 'tyrkisk', 'arabisk', 'somalisk',
  'etiopisk', 'nigeriansk', 'muslimsk', 'libanesisk', 'filipino',
  'kinesisk', 'koreansk', 'thai', 'iransk', 'annet',
] as const;

export const DEFAULT_PAGINATION = { page: 1, limit: 20 } as const;
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
export const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
export const DEBOUNCE_DELAY = 300; // ms

// Helper function to generate PIN code from project name
export const generatePinFromProjectName = (projectName: string): string => {
  if (!projectName) return '';

  const cleanName = projectName.toLowerCase().replace(/[^a-z0-9]/g, ',');
  if (!cleanName || cleanName.length === 0) return '0000';

  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    const char = cleanName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const pin = Math.abs(hash).toString().slice(-4).padStart(4, '0');
  return pin;
};

// Helper function for dynamic project type defaults
export const getDefaultProjectType = (profession: string): string => {
  const typeMap: Record<string, string> = {
    photographer: 'wedding',
    videographer: 'wedding',
    music_producer: 'song',
    vendor: 'commercial'
  };
  return typeMap[profession] || 'commercial';
};

// Helper function to get project time estimates based on type and profession
export const getProjectTimeEstimate = (projectType: string, profession: string): number => {
  const estimates: Record<string, Record<string, number>> = {
    'wedding': {
      'photographer': 8, 'videographer': 12, 'music_producer': 4, 'vendor': 6, 'enterprise': 14
    }, 'portrait': {
      'photographer': 3, 'videographer': 4, 'music_producer': 2, 'vendor': 2, 'enterprise': 5
    }, 'event': {
      'photographer': 6, 'videographer': 8, 'music_producer': 3, 'vendor': 4, 'enterprise': 10
    }, 'song': {
      'photographer': 2, 'videographer': 3, 'music_producer': 20, 'vendor': 1, 'enterprise': 3
    }, 'commercial': {
      'photographer': 4, 'videographer': 6, 'music_producer': 3, 'vendor': 5, 'enterprise': 8
    }
  };

  return estimates[projectType as keyof typeof estimates]?.[profession as keyof typeof estimates.wedding] || 4;
};

// Helper function for dynamic pricing defaults
export const getDefaultPricing = (profession: string, packagesData?: { packages?: PricingPackage[] }, pricingData?: { pricingStructures?: PricingStructure[] }): number => {
  if (packagesData?.packages && Array.isArray(packagesData.packages)) {
    const professionPackages = packagesData.packages.filter((pkg: PricingPackage) =>
      pkg.profession === profession && pkg.status === 'active'
    );

    if (professionPackages.length > 0) {
      const basePrice = professionPackages[0].basePrice;
      if (basePrice && !isNaN(parseFloat(basePrice))) {
        return parseFloat(basePrice);
      }
    }
  }

  if (pricingData?.pricingStructures && Array.isArray(pricingData.pricingStructures)) {
    const professionPricing = pricingData.pricingStructures.find((pricing: PricingStructure) =>
      pricing.profession === profession && pricing.status === 'active'
    );

    if (professionPricing) {
      const basePrice = professionPricing.basePrice ||
        professionPricing.hourlyRate ||
        professionPricing.fullDayRate;
      if (basePrice && !isNaN(parseFloat(basePrice))) {
        return parseFloat(basePrice);
      }
    }
  }

  const fallbackPriceMap: Record<string, number> = {
    photographer: 150,
    videographer: 100,
    music_producer: 800,
    vendor: 200
  };
  return fallbackPriceMap[profession] || 150;
};

type PricingPackage = { profession?: string; status?: string; basePrice?: string };
type PricingStructure = { profession?: string; status?: string; basePrice?: string; hourlyRate?: string; fullDayRate?: string; phaseTimeEstimates?: Record<string, Record<string, number>> };