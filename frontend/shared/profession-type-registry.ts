/**
 * Profession Type Registry
 * Central registry for all profession types in CreatorHub Norge
 * Admins can add new professions here and they become available platform-wide
 */

import {
  PhotoCamera,
  Videocam,
  MusicNote,
  Business,
  Pets,
  Hotel,
  FitnessCenter,
  Spa,
  Restaurant,
  LocalFlorist,
  Brush,
  ChildCare,
  School,
  HealthAndSafety,
  Psychology,
} from '@mui/icons-material';

export interface ProfessionTypeConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category:
    | 'creative'
    | 'service'
    | 'education'
    | 'health'
    | 'lifestyle'
    | 'business'
    | 'entertainment';
  color: string;
  iconColor: string;
  icon: any;
  isActive: boolean;
  sortOrder: number;

  // Market data
  businessModel: string;
  marketSize: 'small' | 'medium' | 'large';
  averageProjectValue: string;

  // Norwegian market
  ssbIndustryCode: string;
  proffIndustry: string;
  demand: 'high' | 'medium' | 'low';
  competition: 'high' | 'medium' | 'low';
  pricingRange: string;
  seasonality: string[];
  keyEvents: string[];

  // Features & capabilities
  equipmentFocus: string[];
  workEnvironment: string[];
  typicalProjects: string[];
  targetClients: string[];
  skills: string[];
  challenges: string[];
  opportunities: string[];
}

/**
 * ⭐ PROFESSION TYPE REGISTRY
 * Add new professions here - they automatically appear in:
 * - UniversalOnboarding profession selection
 * - Enhanced Personas system
 * - SSB/Proff.no data fetching
 * - Dashboard components
 */
export const PROFESSION_TYPE_REGISTRY: Record<string, ProfessionTypeConfig> = {
  // Core Creative Professions (Already Active)
  photographer: {
    id: 'photographer',
    name: 'photographer',
    displayName: 'Fotograf',
    description: 'Profesjonell fotograf',
    category: 'creative',
    color: '#ff8c00',
    iconColor: '#ff8c00',
    icon: PhotoCamera,
    isActive: true,
    sortOrder: 0,
    businessModel: 'Project-based pricing',
    marketSize: 'large',
    averageProjectValue: '15,000 - 50,000 NOK',
    ssbIndustryCode: '74.20',
    proffIndustry: 'Fotografi',
    demand: 'high',
    competition: 'high',
    pricingRange: '10,000 - 80,000 NOK',
    seasonality: ['Høyt i sommer', 'Bryllup mai-september'],
    keyEvents: ['Bryllup', 'Julefester', 'Bedriftsarrangement'],
    equipmentFocus: ['cameras', 'lenses', 'flash_systems'],
    workEnvironment: ['Studio', 'Outdoor locations', 'Event venues'],
    typicalProjects: ['Bryllup', 'Portrett', 'Produkt', 'Bedrift'],
    targetClients: ['Brudgom og brud', 'Bedrifter', 'Familier'],
    skills: ['Composition', 'Lighting', 'Post-processing'],
    challenges: ['Konkurranse', 'Sesongbasert', 'Teknologi'],
    opportunities: ['E-handel', 'Social media', 'Online kurs'],
  },

  videographer: {
    id: 'videographer',
    name: 'videographer',
    displayName: 'Videograf',
    description: 'Profesjonell videoprodusent',
    category: 'creative',
    color: '#e74c3c',
    iconColor: '#e74c3c',
    icon: Videocam,
    isActive: true,
    sortOrder: 1,
    businessModel: 'Project-based and retainer',
    marketSize: 'medium',
    averageProjectValue: '25,000 - 150,000 NOK',
    ssbIndustryCode: '59.11',
    proffIndustry: 'Film- og videoproduksjon',
    demand: 'medium',
    competition: 'medium',
    pricingRange: '20,000 - 200,000 NOK',
    seasonality: ['Høyt i sommer', 'Bryllup mai-september'],
    keyEvents: ['Bryllup', 'Bedriftsarrangement', 'Produktlansering'],
    equipmentFocus: ['cameras', 'video_equipment', 'audio_interfaces'],
    workEnvironment: ['Studio', 'Outdoor locations', 'Event venues'],
    typicalProjects: ['Bryllupsvideoer', 'Bedriftsvideoer', 'Reklamefilm'],
    targetClients: ['Bryllupspar', 'Bedrifter', 'Marketingbyråer'],
    skills: ['Cinematography', 'Editing', 'Storytelling'],
    challenges: ['Konkurranse', 'Teknologi', 'Lange produksjoner'],
    opportunities: ['Video-marked', 'E-learning', 'Livestreaming'],
  },

  music_producer: {
    id: 'music_producer',
    name: 'music_producer',
    displayName: 'Musikkprodusent',
    description: 'Profesjonell musikkprodusent og lydtekniker',
    category: 'creative',
    color: '#9b59b6',
    iconColor: '#9b59b6',
    icon: MusicNote,
    isActive: true,
    sortOrder: 2,
    businessModel: 'Project-based and hourly',
    marketSize: 'small',
    averageProjectValue: '10,000 - 100,000 NOK',
    ssbIndustryCode: '90.01',
    proffIndustry: 'Lydopptakstjenester',
    demand: 'medium',
    competition: 'medium',
    pricingRange: '8,000 - 120,000 NOK',
    seasonality: ['Høy i høst/vinter', 'Festivals i sommer'],
    keyEvents: ['Albumlansering', 'Festivaler', 'Julemusikk'],
    equipmentFocus: ['audio_interfaces', 'microphones', 'studio_monitors'],
    workEnvironment: ['Recording studio', 'Home studio', 'Live venues'],
    typicalProjects: ['Albumproduksjon', 'Singelproduksjon', 'Podcast'],
    targetClients: ['Artister', 'Plateselskaper', 'Reklamebyråer'],
    skills: ['Music production', 'Audio engineering', 'Mixing'],
    challenges: ['Begrenset marked', 'Konkurranse', 'Teknologi'],
    opportunities: ['Podcast-marked', 'Online utdanning', 'Streaming'],
  },

  pet_groomer: {
    id: 'pet_groomer',
    name: 'pet_groomer',
    displayName: 'Dyrepleier',
    description: 'Profesjonell dyrepleier og grooming specialist',
    category: 'service',
    color: '#27ae60',
    iconColor: '#27ae60',
    icon: Pets,
    isActive: true,
    sortOrder: 3,
    businessModel: 'Service-based pricing',
    marketSize: 'medium',
    averageProjectValue: '800 - 2,500 NOK',
    ssbIndustryCode: '96.09',
    proffIndustry: 'Hundeklippesalonger',
    demand: 'high',
    competition: 'low',
    pricingRange: '600 - 3,000 NOK',
    seasonality: ['Høy i vår/sommer', 'Hundegrooming hele året'],
    keyEvents: ['Sommerklip', 'Julefrisering', 'Show-sesong'],
    equipmentFocus: ['grooming_tools', 'cleaning_equipment', 'safety_equipment'],
    workEnvironment: ['Grooming salon', 'Mobile van', 'Client homes'],
    typicalProjects: ['Hundegrooming', 'Kattestell', 'Spesialpleie'],
    targetClients: ['Hundeeiere', 'Katteeiere', 'Dyreklinikker'],
    skills: ['Animal handling', 'Grooming techniques', 'Pet health'],
    challenges: ['Fysisk krevende', 'Sesongbasert', 'Forsikring'],
    opportunities: ['Voksende pet-industri', 'Premium tjenester', 'Mobile grooming'],
  },

  vendor: {
    id: 'vendor',
    name: 'vendor',
    displayName: 'Leverandør',
    description: 'Produktleverandør og forhandler',
    category: 'business',
    color: '#3498db',
    iconColor: '#3498db',
    icon: Business,
    isActive: true,
    sortOrder: 4,
    businessModel: 'B2B sales and distribution',
    marketSize: 'large',
    averageProjectValue: '5,000 - 500,000 NOK',
    ssbIndustryCode: '46.90',
    proffIndustry: 'Engroshandel',
    demand: 'high',
    competition: 'high',
    pricingRange: '2,000 - 1,000,000 NOK',
    seasonality: ['Høy før høysesong', 'Stable resten av året'],
    keyEvents: ['Trade shows', 'Product launches', 'Seasonal sales'],
    equipmentFocus: ['inventory_management', 'shipping_equipment'],
    workEnvironment: ['Warehouse', 'Office', 'Trade shows'],
    typicalProjects: ['Produktsalg', 'Bulk-leveranser', 'Kundeservice'],
    targetClients: ['Fotografer', 'Videografer', 'Musikkprodusenter'],
    skills: ['Sales', 'Inventory management', 'Logistics'],
    challenges: ['Konkurranse', 'Lav margin', 'Lagerkostnader'],
    opportunities: ['Online handel', 'Spesialisert utstyr', 'Leasing'],
  },

  // ⭐ NEW PROFESSION TEMPLATES (Expandable)

  pet_hotel: {
    id: 'pet_hotel',
    name: 'pet_hotel',
    displayName: 'Dyrehotell',
    description: 'Profesjonell dyrehotell og pensjonat',
    category: 'service',
    color: '#ff6b6b',
    iconColor: '#ff6b6b',
    icon: Hotel,
    isActive: false, // Template - not active by default
    sortOrder: 100,
    businessModel: 'Service-based with daily/weekly rates',
    marketSize: 'medium',
    averageProjectValue: '300 - 1,500 NOK per day',
    ssbIndustryCode: '96.09',
    proffIndustry: 'Dyrehoteller og -pensjonater',
    demand: 'high',
    competition: 'medium',
    pricingRange: '300 - 1,500 NOK per natt',
    seasonality: [
      'Ekstremt høy i sommerferie',
      'Høy i vinterferie og påske',
      'Høy i jul',
      'Moderat resten av året',
    ],
    keyEvents: ['Sommerferie', 'Påske', 'Jul', 'Vinterferie'],
    equipmentFocus: ['booking_system', 'facility_management', 'security_cameras'],
    workEnvironment: ['Indoor facilities', 'Outdoor play areas', 'Reception'],
    typicalProjects: ['Hundehotell', 'Kattepensjonat', 'Dagpass', 'Feriepass'],
    targetClients: ['Hundeeiere', 'Katteeiere', 'Reisende', 'Bedriftskunder'],
    skills: ['Animal care', 'Facility management', 'Emergency response'],
    challenges: ['Sesongsvingninger', 'Bemanning helger', 'Forsikring'],
    opportunities: ['Voksende pet-industri', 'Premium tjenester', 'Online booking'],
  },

  yoga_studio: {
    id: 'yoga_studio',
    name: 'yoga_studio',
    displayName: 'Yogastudio',
    description: 'Profesjonell yoga- og treningsstudio',
    category: 'health',
    color: '#00bcd4',
    iconColor: '#00bcd4',
    icon: FitnessCenter,
    isActive: false,
    sortOrder: 101,
    businessModel: 'Membership and class-based',
    marketSize: 'medium',
    averageProjectValue: '150 - 350 NOK per class',
    ssbIndustryCode: '93.13',
    proffIndustry: 'Treningssentre',
    demand: 'high',
    competition: 'medium',
    pricingRange: '150 - 500 NOK per time',
    seasonality: ['Høy i januar (nyttårsforsett)', 'Moderat resten av året'],
    keyEvents: ['Nyttår', 'Vårstart', 'Sommer yoga outdoor'],
    equipmentFocus: ['booking_system', 'mat_storage', 'sound_system'],
    workEnvironment: ['Studio space', 'Outdoor parks', 'Corporate locations'],
    typicalProjects: ['Gruppetimer', 'Privattime', 'Workshops', 'Retreats'],
    targetClients: ['Privatpersoner', 'Bedrifter', 'Seniorer', 'Gravide'],
    skills: ['Yoga instruction', 'Anatomy', 'Client coaching'],
    challenges: ['Konkurranse', 'Sesongvariasjon', 'Lokalkostnader'],
    opportunities: ['Online klasser', 'Bedrifts-yoga', 'Workshops'],
  },

  tattoo_artist: {
    id: 'tattoo_artist',
    name: 'tattoo_artist',
    displayName: 'Tatovør',
    description: 'Profesjonell tatoveringskunstner',
    category: 'creative',
    color: '#e74c3c',
    iconColor: '#e74c3c',
    icon: Brush,
    isActive: false,
    sortOrder: 102,
    businessModel: 'Hourly and project-based',
    marketSize: 'medium',
    averageProjectValue: '1,500 - 15,000 NOK',
    ssbIndustryCode: '96.09',
    proffIndustry: 'Tatoveringsstudioer',
    demand: 'high',
    competition: 'medium',
    pricingRange: '1,000 - 20,000 NOK',
    seasonality: ['Høy hele året', 'Ekstra høy i sommer'],
    keyEvents: ['Tattoo conventions', 'Sommer', 'Guest spots'],
    equipmentFocus: ['tattoo_machines', 'inks', 'sterilization_equipment'],
    workEnvironment: ['Tattoo studio', 'Guest spots', 'Conventions'],
    typicalProjects: ['Custom tattoos', 'Cover-ups', 'Touch-ups', 'Flash'],
    targetClients: ['Privatpersoner', 'Collectors', 'First-timers'],
    skills: ['Art & design', 'Hygiene', 'Client consultation', 'Technique'],
    challenges: ['Regulering', 'Hygiene-krav', 'Konkurranse'],
    opportunities: ['Custom art', 'Guest spots', 'Tattoo tourism'],
  },

  hairdresser: {
    id: 'hairdresser',
    name: 'hairdresser',
    displayName: 'Frisør',
    description: 'Profesjonell frisør og stylist',
    category: 'service',
    color: '#ff1744',
    iconColor: '#ff1744',
    icon: Spa,
    isActive: false,
    sortOrder: 103,
    businessModel: 'Service-based per appointment',
    marketSize: 'large',
    averageProjectValue: '500 - 2,000 NOK',
    ssbIndustryCode: '96.02',
    proffIndustry: 'Frisørsalonger',
    demand: 'high',
    competition: 'high',
    pricingRange: '400 - 3,000 NOK',
    seasonality: ['Høy før jul', 'Høy før sommerferie', 'Høy før bryllup'],
    keyEvents: ['Bryllup', 'Jul', 'Sommerferie', '17. mai'],
    equipmentFocus: ['styling_tools', 'coloring_equipment', 'booking_system'],
    workEnvironment: ['Salon', 'Mobile service', 'Home visits'],
    typicalProjects: ['Klipp', 'Farge', 'Styling', 'Bryllup', 'Events'],
    targetClients: ['Privatpersoner', 'Brudgom/brud', 'Modeller'],
    skills: ['Cutting', 'Coloring', 'Styling', 'Customer service'],
    challenges: ['Konkurranse', 'Kjemikalier', 'Lange dager'],
    opportunities: ['Premium tjenester', 'Bryllupsmarked', 'Online booking'],
  },

  personal_trainer: {
    id: 'personal_trainer',
    name: 'personal_trainer',
    displayName: 'Personlig Trener',
    description: 'Profesjonell personlig trener og coach',
    category: 'health',
    color: '#ff9800',
    iconColor: '#ff9800',
    icon: FitnessCenter,
    isActive: false,
    sortOrder: 104,
    businessModel: 'Per session and packages',
    marketSize: 'large',
    averageProjectValue: '500 - 1,200 NOK per session',
    ssbIndustryCode: '93.13',
    proffIndustry: 'Treningssentre',
    demand: 'high',
    competition: 'high',
    pricingRange: '400 - 1,500 NOK per time',
    seasonality: ['Høy i januar', 'Høy før sommeren', 'Moderat ellers'],
    keyEvents: ['Nyttår', 'Vårstart', 'Før bikini-sesong'],
    equipmentFocus: ['training_equipment', 'booking_system', 'measurement_tools'],
    workEnvironment: ['Gym', 'Outdoor', 'Client homes', 'Online'],
    typicalProjects: ['Vektnedgang', 'Muskelbygging', 'Idrettsspesifikk', 'Rehabilitering'],
    targetClients: ['Privatpersoner', 'Bedrifter', 'Idrettsutøvere'],
    skills: ['Training methodology', 'Nutrition', 'Motivation', 'Anatomy'],
    challenges: ['Konkurranse', 'Klientmotivasjon', 'Sesongvariasjon'],
    opportunities: ['Online coaching', 'Bedrifts-PT', 'Spesialisering'],
  },

  restaurant: {
    id: 'restaurant',
    name: 'restaurant',
    displayName: 'Restaurant',
    description: 'Profesjonell restaurant og serveringssted',
    category: 'service',
    color: '#d32f2f',
    iconColor: '#d32f2f',
    icon: Restaurant,
    isActive: false,
    sortOrder: 105,
    businessModel: 'Transaction-based',
    marketSize: 'large',
    averageProjectValue: '200 - 800 NOK per person',
    ssbIndustryCode: '56.10',
    proffIndustry: 'Restauranter',
    demand: 'high',
    competition: 'high',
    pricingRange: '150 - 1,500 NOK per person',
    seasonality: ['Høy i sommer', 'Høy i jul', 'Høy i påsken'],
    keyEvents: ['Sommersesong', 'Jul', 'Påske', 'Valentines', '17. mai'],
    equipmentFocus: ['pos_system', 'kitchen_equipment', 'booking_system'],
    workEnvironment: ['Restaurant premises', 'Kitchen', 'Bar area'],
    typicalProjects: ['Daily service', 'Events', 'Catering', 'Private dining'],
    targetClients: ['Walk-in customers', 'Reservations', 'Events', 'Corporate'],
    skills: ['Cooking', 'Service', 'Management', 'Food safety'],
    challenges: ['Høye kostnader', 'Bemanning', 'Matsvinn', 'Konkurranse'],
    opportunities: ['Catering', 'Delivery', 'Events', 'Tourism'],
  },

  florist: {
    id: 'florist',
    name: 'florist',
    displayName: 'Blomsterhandler',
    description: 'Profesjonell blomsterhandler og dekoratør',
    category: 'creative',
    color: '#e91e63',
    iconColor: '#e91e63',
    icon: LocalFlorist,
    isActive: false,
    sortOrder: 106,
    businessModel: 'Product and service-based',
    marketSize: 'medium',
    averageProjectValue: '500 - 15,000 NOK',
    ssbIndustryCode: '47.76',
    proffIndustry: 'Blomsterforretninger',
    demand: 'medium',
    competition: 'medium',
    pricingRange: '300 - 30,000 NOK',
    seasonality: ['Ekstremt høy i bryllupssesong', 'Høy valentines', 'Høy jul'],
    keyEvents: ['Bryllup', 'Valentines', 'Morsdag', '17. mai', 'Begravelser'],
    equipmentFocus: ['refrigeration', 'arrangement_tools', 'delivery_vehicle'],
    workEnvironment: ['Flower shop', 'Event venues', 'Client locations'],
    typicalProjects: ['Bryllupsdekor', 'Begravelser', 'Events', 'Daily bouquets'],
    targetClients: ['Bryllupspar', 'Bedrifter', 'Privatpersoner', 'Begravelsesbyråer'],
    skills: ['Flower arrangement', 'Design', 'Customer service', 'Logistics'],
    challenges: ['Kortvarige produkter', 'Sesongvariasjon', 'Leverandøravhengighet'],
    opportunities: ['Premium bryllupsmarked', 'Subscription bouquets', 'Corporate events'],
  },

  childcare: {
    id: 'childcare',
    name: 'childcare',
    displayName: 'Barnehage',
    description: 'Profesjonell barneomsorg og pedagogikk',
    category: 'education',
    color: '#ffc107',
    iconColor: '#ffc107',
    icon: ChildCare,
    isActive: false,
    sortOrder: 107,
    businessModel: 'Monthly subscription',
    marketSize: 'large',
    averageProjectValue: '3,000 - 6,000 NOK per month',
    ssbIndustryCode: '88.91',
    proffIndustry: 'Barnehager',
    demand: 'high',
    competition: 'medium',
    pricingRange: '2,500 - 7,000 NOK per måned',
    seasonality: ['Stabil hele året', 'Opptak i august'],
    keyEvents: ['Skolestart', 'Jul', 'Påske', 'Sommerferie'],
    equipmentFocus: ['safety_equipment', 'educational_toys', 'outdoor_equipment'],
    workEnvironment: ['Daycare center', 'Outdoor playground', 'Classroom'],
    typicalProjects: ['Daglig omsorg', 'Pedagogisk aktivitet', 'Måltider', 'Turer'],
    targetClients: ['foreldre', 'NAV', 'Kommuner'],
    skills: ['Child development', 'Pedagogy', 'Safety', 'Communication'],
    challenges: ['Strengt regulert', 'Bemanning', 'Sikkerhet', 'Foreldreforventninger'],
    opportunities: ['Private barnehager', 'Spesialiserte konsepter', 'Ekstra aktiviteter'],
  },

  psychologist: {
    id: 'psychologist',
    name: 'psychologist',
    displayName: 'Psykolog',
    description: 'Profesjonell psykolog og terapeut',
    category: 'health',
    color: '#7c4dff',
    iconColor: '#7c4dff',
    icon: Psychology,
    isActive: false,
    sortOrder: 108,
    businessModel: 'Per session',
    marketSize: 'large',
    averageProjectValue: '1,200 - 1,800 NOK per session',
    ssbIndustryCode: '86.90',
    proffIndustry: 'Psykologer i privat praksis',
    demand: 'high',
    competition: 'medium',
    pricingRange: '1,000 - 2,000 NOK per time',
    seasonality: ['Høy i høst/vinter', 'Moderat i sommer'],
    keyEvents: ['Høstdepresjon', 'Nyttår', 'Eksamenstid'],
    equipmentFocus: ['booking_system', 'video_therapy', 'secure_storage'],
    workEnvironment: ['Private practice', 'Online', 'Corporate wellness'],
    typicalProjects: ['Terapi', 'Veiledning', 'Utredning', 'Kriseintervensjon'],
    targetClients: ['Privatpersoner', 'Bedrifter', 'NAV', 'Fastleger'],
    skills: ['Therapy techniques', 'Diagnosis', 'Communication', 'Ethics'],
    challenges: ['Taushetsplikt', 'Dokumentasjon', 'Emosjonelt krevende'],
    opportunities: ['Online terapi', 'Bedriftspsykologi', 'Spesialisering'],
  },

  driving_school: {
    id: 'driving_school',
    name: 'driving_school',
    displayName: 'Kjøreskole',
    description: 'Profesjonell trafikkskole og kjøreopplæring',
    category: 'education',
    color: '#ff5722',
    iconColor: '#ff5722',
    icon: School,
    isActive: false,
    sortOrder: 109,
    businessModel: 'Package and per-lesson',
    marketSize: 'large',
    averageProjectValue: '600 - 900 NOK per lesson',
    ssbIndustryCode: '85.53',
    proffIndustry: 'Kjøreskoler',
    demand: 'high',
    competition: 'medium',
    pricingRange: '500 - 1,000 NOK per time',
    seasonality: ['Høy før sommerferie', 'Høy for 18-åringer', 'Stabil ellers'],
    keyEvents: ['18-årsfødselsdager', 'Sommerferie', 'Ferieavvikling'],
    equipmentFocus: ['training_vehicles', 'booking_system', 'theory_materials'],
    workEnvironment: ['Office', 'Driving routes', 'Theory classroom'],
    typicalProjects: ['Førerkort klasse B', 'Oppfriskingskurs', 'Teori', 'MC-opplæring'],
    targetClients: ['Ungdom', 'Voksne', 'Seniorer', 'Bedrifter'],
    skills: ['Teaching', 'Patience', 'Traffic knowledge', 'Safety'],
    challenges: ['Bensinkostnader', 'Kjøretøyvedlikehold', 'Regulering'],
    opportunities: ['El-bil kjøring', 'Spesial kjøring', 'Bedriftskurs'],
  },

  spa_wellness: {
    id: 'spa_wellness',
    name: 'spa_wellness',
    displayName: 'Spa og Velvære',
    description: 'Profesjonell spa og velværesenter',
    category: 'health',
    color: '#00897b',
    iconColor: '#00897b',
    icon: Spa,
    isActive: false,
    sortOrder: 110,
    businessModel: 'Service packages and memberships',
    marketSize: 'medium',
    averageProjectValue: '800 - 3,500 NOK',
    ssbIndustryCode: '96.04',
    proffIndustry: 'Spa og velværesentre',
    demand: 'medium',
    competition: 'medium',
    pricingRange: '500 - 5,000 NOK',
    seasonality: ['Høy før jul', 'Høy før sommeren', 'Moderat ellers'],
    keyEvents: ['Juleforberedelser', 'Valentines', 'Morsdag', 'Bryllupsforberedelser'],
    equipmentFocus: ['treatment_beds', 'spa_equipment', 'booking_system'],
    workEnvironment: ['Spa facility', 'Treatment rooms', 'Relaxation areas'],
    typicalProjects: ['Massasje', 'Ansiktsbehandling', 'Kroppsbehandling', 'Pakker'],
    targetClients: ['Privatpersoner', 'Par', 'Grupper', 'Bedrifter'],
    skills: ['Massage techniques', 'Skincare', 'Customer service', 'Hygiene'],
    challenges: ['Høye lokalkostnader', 'Konkurrange', 'Produktkostnader'],
    opportunities: ['Premium pakker', 'Membership', 'Corporate wellness'],
  },
};

/**
 * Get all profession types
 */
export function getAllProfessionTypes(): ProfessionTypeConfig[] {
  return Object.values(PROFESSION_TYPE_REGISTRY);
}

/**
 * Get active profession types only
 */
export function getActiveProfessionTypes(): ProfessionTypeConfig[] {
  return Object.values(PROFESSION_TYPE_REGISTRY).filter((p) => p.isActive);
}

/**
 * Get available templates (inactive professions)
 */
export function getAvailableProfessionTemplates(): ProfessionTypeConfig[] {
  return Object.values(PROFESSION_TYPE_REGISTRY).filter((p) => !p.isActive);
}

/**
 * Get profession by ID
 */
export function getProfessionTypeById(id: string): ProfessionTypeConfig | null {
  return PROFESSION_TYPE_REGISTRY[id] || null;
}

/**
 * Activate a profession template
 */
export function activateProfessionType(id: string): boolean {
  if (PROFESSION_TYPE_REGISTRY[id]) {
    PROFESSION_TYPE_REGISTRY[id].isActive = true;
    return true;
  }
  return false;
}

/**
 * Deactivate a profession type
 */
export function deactivateProfessionType(id: string): boolean {
  if (PROFESSION_TYPE_REGISTRY[id]) {
    PROFESSION_TYPE_REGISTRY[id].isActive = false;
    return true;
  }
  return false;
}
