/**
 * Production Workflow Service
 * Handles Stripboard, Call Sheets, Shooting Schedule, and Live Set tracking
 * Mock data based on TROLL (2022) Norwegian film
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export interface ShootingDay {
  id: string;
  projectId: string;
  dayNumber: number;
  date: string; // ISO date
  callTime: string; // HH:mm
  wrapTime?: string; // HH:mm
  location: string;
  locationAddress?: string;
  notes?: string;
  scenes: string[]; // Scene IDs
  status: 'planned' | 'in-progress' | 'wrapped' | 'postponed' | 'cancelled';
  weather?: WeatherInfo;
  crewCallTimes: Record<string, string>; // roleId -> call time
  castCallTimes: Record<string, string>; // characterId -> call time
  equipmentNeeded: string[];
  meals: MealBreak[];
  actualStartTime?: string;
  actualWrapTime?: string;
  dailyReport?: DailyReport;
  createdAt: string;
  updatedAt: string;
}

export interface WeatherInfo {
  condition: 'sunny' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'wind';
  temperature: number; // Celsius
  sunrise: string;
  sunset: string;
  forecast?: string;
}

export interface MealBreak {
  id: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  time: string;
  location?: string;
  caterer?: string;
}

export interface DailyReport {
  id: string;
  shootingDayId: string;
  completedScenes: string[];
  partialScenes: string[];
  notStarted: string[];
  totalSetups: number;
  pagesShot: number;
  actualRuntime: number; // minutes
  delays: Delay[];
  accidents: string[];
  notes: string;
  submittedBy: string;
  submittedAt: string;
}

export interface Delay {
  reason: string;
  duration: number; // minutes
  category: 'weather' | 'technical' | 'cast' | 'crew' | 'location' | 'other';
}

export interface StripboardStrip {
  id: string;
  sceneId: string;
  sceneNumber: string;
  shootingDayId?: string;
  dayNumber?: number;
  sortOrder: number;
  color: string; // hex color based on INT/EXT/Day/Night
  location: string;
  pages: number;
  cast: string[]; // Character IDs
  status: 'not-scheduled' | 'scheduled' | 'shot' | 'postponed';
  estimatedTime: number; // minutes
  notes?: string;
}

export interface CallSheet {
  id: string;
  shootingDayId: string;
  projectTitle: string;
  productionCompany: string;
  director: string;
  producer: string;
  date: string;
  dayNumber: number;
  totalDays: number;
  generalCallTime: string;
  crewCallTimes: CrewCallItem[];
  castCallTimes: CastCallItem[];
  scenes: CallSheetScene[];
  locations: CallSheetLocation[];
  equipment: string[];
  meals: MealBreak[];
  contacts: ContactInfo[];
  notes: string[];
  weather?: WeatherInfo;
  nearestHospital?: string;
  parking?: string;
  createdAt: string;
  version: number;
}

export interface CrewCallItem {
  id: string;
  name: string;
  role: string;
  department: string;
  callTime: string;
  phone?: string;
  email?: string;
}

export interface CastCallItem {
  id: string;
  name: string;
  character: string;
  callTime: string;
  makeupTime?: string;
  onSetTime?: string;
  scenes: string[];
  phone?: string;
  notes?: string;
}

export interface CallSheetScene {
  sceneNumber: string;
  description: string;
  location: string;
  intExt: string;
  timeOfDay: string;
  pages: number;
  cast: string[];
  estimatedTime: string;
  notes?: string;
}

export interface CallSheetLocation {
  name: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  parking?: string;
  contactPerson?: string;
  contactPhone?: string;
  accessNotes?: string;
}

export interface ContactInfo {
  name: string;
  role: string;
  phone: string;
  email?: string;
  department: string;
}

export interface Take {
  id: string;
  sceneId: string;
  shotId: string;
  takeNumber: number;
  status: 'good' | 'ok' | 'bad' | 'circle' | 'print';
  duration: number; // seconds
  timecode?: string;
  notes?: string;
  techNotes?: string; // Focus, exposure issues etc.
  soundNotes?: string;
  circledBy?: string;
  recordedAt: string;
  camera: string;
  lens?: string;
  slate?: string;
}

export interface LiveSetStatus {
  currentScene: string | null;
  currentShot: string | null;
  currentTake: number;
  isRolling: boolean;
  lastAction: string;
  lastActionTime: string;
  todayTakes: Take[];
  todayProgress: {
    plannedScenes: number;
    completedScenes: number;
    partialScenes: number;
    totalSetups: number;
    completedSetups: number;
    pagesPlanned: number;
    pagesShot: number;
  };
}

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  availability: Record<string, boolean>; // date -> available
  rate?: number;
  rateType?: 'daily' | 'weekly' | 'project';
  union?: string;
  notes?: string;
}

export interface CastMember {
  id: string;
  name: string;
  character: string;
  scenes: string[];
  phone: string;
  email: string;
  agent?: string;
  agentPhone?: string;
  availability: Record<string, boolean>;
  contract?: {
    startDate: string;
    endDate: string;
    rate: number;
    rateType: 'daily' | 'weekly' | 'buyout';
  };
  notes?: string;
}

// ============================================
// TROLL MOCK DATA
// ============================================

const TROLL_PROJECT_ID = 'troll-2022';

// TROLL Cast - Based on the actual 2022 film
export const TROLL_CAST: CastMember[] = [
  {
    id: 'cast-nora',
    name: 'Ine Marie Wilmann',
    character: 'NORA TIDEMANN',
    scenes: ['scene-3', 'scene-4', 'scene-5', 'scene-7', 'scene-9', 'scene-10'],
    phone: '+47 900 00 001',
    email: 'ine.wilmann@trollprod.no',
    agent: 'Nordic Talent',
    agentPhone: '+47 22 00 00 01',
    availability: {
      '2026-02-01': true,
      '2026-02-02': true,
      '2026-02-03': true,
      '2026-02-04': false,
      '2026-02-05': true,
      '2026-02-06': true,
      '2026-02-07': true,
      '2026-02-08': true,
    },
    contract: {
      startDate: '2026-02-01',
      endDate: '2026-03-15',
      rate: 45000,
      rateType: 'daily',
    },
    notes: 'Hovedrolle. NSF-medlem. Trenger 2t makeup for sårscener.',
  },
  {
    id: 'cast-andreas',
    name: 'Kim Falck',
    character: 'ANDREAS ISAKSEN',
    scenes: ['scene-4', 'scene-5', 'scene-7', 'scene-9', 'scene-10'],
    phone: '+47 900 00 002',
    email: 'kim.falck@trollprod.no',
    availability: {
      '2026-02-01': true,
      '2026-02-02': true,
      '2026-02-03': true,
      '2026-02-04': true,
      '2026-02-05': true,
      '2026-02-06': false,
      '2026-02-07': true,
      '2026-02-08': true,
    },
    contract: {
      startDate: '2026-02-01',
      endDate: '2026-03-01',
      rate: 35000,
      rateType: 'daily',
    },
    notes: 'Støtterolle. NFF-medlem.',
  },
  {
    id: 'cast-general',
    name: 'Fridtjov Såheim',
    character: 'GENERAL LUND',
    scenes: ['scene-4', 'scene-7', 'scene-9'],
    phone: '+47 900 00 003',
    email: 'fridtjov.saheim@trollprod.no',
    availability: {
      '2026-02-01': true,
      '2026-02-02': false,
      '2026-02-03': true,
      '2026-02-04': true,
      '2026-02-05': true,
      '2026-02-06': true,
      '2026-02-07': true,
      '2026-02-08': false,
    },
    contract: {
      startDate: '2026-02-03',
      endDate: '2026-02-20',
      rate: 40000,
      rateType: 'daily',
    },
    notes: 'Kjent fra Lilyhammer. Uniform fitting nødvendig.',
  },
  {
    id: 'cast-tobias',
    name: 'Gard B. Eidsvold',
    character: 'TOBIAS',
    scenes: ['scene-10'],
    phone: '+47 900 00 004',
    email: 'gard.eidsvold@trollprod.no',
    availability: {
      '2026-02-01': true,
      '2026-02-02': true,
      '2026-02-03': true,
      '2026-02-04': true,
      '2026-02-05': true,
      '2026-02-06': true,
      '2026-02-07': true,
      '2026-02-08': true,
    },
    contract: {
      startDate: '2026-02-15',
      endDate: '2026-02-20',
      rate: 50000,
      rateType: 'daily',
    },
    notes: 'Noras far. Kun i klimaks-scenene.',
  },
  {
    id: 'cast-statsminister',
    name: 'Anneke von der Lippe',
    character: 'STATSMINISTER',
    scenes: ['scene-7'],
    phone: '+47 900 00 005',
    email: 'anneke.lippe@trollprod.no',
    availability: {
      '2026-02-01': false,
      '2026-02-02': false,
      '2026-02-03': true,
      '2026-02-04': true,
      '2026-02-05': false,
      '2026-02-06': true,
      '2026-02-07': true,
      '2026-02-08': false,
    },
    contract: {
      startDate: '2026-02-03',
      endDate: '2026-02-10',
      rate: 55000,
      rateType: 'daily',
    },
    notes: 'Erfaren skuespiller. Stramt tidsvindu.',
  },
  {
    id: 'cast-arbeider1',
    name: 'Mads Sjøgård Pettersen',
    character: 'ARBEIDER 1',
    scenes: ['scene-1', 'scene-2'],
    phone: '+47 900 00 006',
    email: 'mads.pettersen@trollprod.no',
    availability: {
      '2026-02-01': true,
      '2026-02-02': true,
      '2026-02-03': true,
      '2026-02-04': true,
      '2026-02-05': true,
      '2026-02-06': true,
      '2026-02-07': true,
      '2026-02-08': true,
    },
    contract: {
      startDate: '2026-02-01',
      endDate: '2026-02-05',
      rate: 18000,
      rateType: 'daily',
    },
  },
  {
    id: 'cast-arbeider2',
    name: 'Eric Vorenholt',
    character: 'ARBEIDER 2',
    scenes: ['scene-1', 'scene-2'],
    phone: '+47 900 00 007',
    email: 'eric.vorenholt@trollprod.no',
    availability: {
      '2026-02-01': true,
      '2026-02-02': true,
      '2026-02-03': true,
      '2026-02-04': true,
      '2026-02-05': true,
      '2026-02-06': true,
      '2026-02-07': true,
      '2026-02-08': true,
    },
    contract: {
      startDate: '2026-02-01',
      endDate: '2026-02-05',
      rate: 18000,
      rateType: 'daily',
    },
  },
  {
    id: 'cast-bonde',
    name: 'Bjarne Hjelde',
    character: 'BONDE',
    scenes: ['scene-6'],
    phone: '+47 900 00 008',
    email: 'bjarne.hjelde@trollprod.no',
    availability: {
      '2026-02-01': true,
      '2026-02-02': true,
      '2026-02-03': true,
      '2026-02-04': true,
      '2026-02-05': true,
      '2026-02-06': true,
      '2026-02-07': true,
      '2026-02-08': true,
    },
    contract: {
      startDate: '2026-02-08',
      endDate: '2026-02-10',
      rate: 15000,
      rateType: 'daily',
    },
  },
];

// TROLL Crew
export const TROLL_CREW: CrewMember[] = [
  // Production
  {
    id: 'crew-director',
    name: 'Roar Uthaug',
    role: 'Regissør',
    department: 'Regi',
    phone: '+47 900 10 001',
    email: 'roar.uthaug@motionblur.no',
    availability: {},
    rate: 75000,
    rateType: 'daily',
    notes: 'Regissert Bølgen, Tomb Raider.',
  },
  {
    id: 'crew-producer',
    name: 'Espen Horn',
    role: 'Produsent',
    department: 'Produksjon',
    phone: '+47 900 10 002',
    email: 'espen.horn@motionblur.no',
    availability: {},
    rate: 60000,
    rateType: 'weekly',
    notes: 'Motion Blur Pictures',
  },
  {
    id: 'crew-lineprod',
    name: 'Kristin Horntvedt',
    role: 'Innspillingsleder',
    department: 'Produksjon',
    phone: '+47 900 10 003',
    email: 'kristin.horntvedt@motionblur.no',
    availability: {},
    rate: 4500,
    rateType: 'daily',
    union: 'NFF',
  },
  {
    id: 'crew-pm',
    name: 'Helene Strømgren',
    role: 'Produksjonskordinator',
    department: 'Produksjon',
    phone: '+47 900 10 004',
    email: 'helene.stromgren@motionblur.no',
    availability: {},
    rate: 3500,
    rateType: 'daily',
    union: 'NFF',
  },
  // Camera
  {
    id: 'crew-dop',
    name: 'Jallo Faber',
    role: 'Fotograf (DoP)',
    department: 'Kamera',
    phone: '+47 900 20 001',
    email: 'jallo.faber@trollprod.no',
    availability: {},
    rate: 8500,
    rateType: 'daily',
    union: 'NFF',
    notes: 'Erfaring med VFX-tunge produksjoner',
  },
  {
    id: 'crew-focus',
    name: 'Trond Tønder',
    role: '1st AC / Fokuspuller',
    department: 'Kamera',
    phone: '+47 900 20 002',
    email: 'trond.tonder@trollprod.no',
    availability: {},
    rate: 4500,
    rateType: 'daily',
    union: 'NFF',
  },
  {
    id: 'crew-2ndac',
    name: 'Maria Skoglund',
    role: '2nd AC / Clapper',
    department: 'Kamera',
    phone: '+47 900 20 003',
    email: 'maria.skoglund@trollprod.no',
    availability: {},
    rate: 3200,
    rateType: 'daily',
    union: 'NFF',
  },
  {
    id: 'crew-dit',
    name: 'Henrik Njålsson',
    role: 'DIT',
    department: 'Kamera',
    phone: '+47 900 20 004',
    email: 'henrik.njalsson@trollprod.no',
    availability: {},
    rate: 4200,
    rateType: 'daily',
    union: 'NFF',
  },
  // Gaffer / Grip
  {
    id: 'crew-gaffer',
    name: 'Ole Kristian Fjelldal',
    role: 'Gaffer / Lysmester',
    department: 'Lys',
    phone: '+47 900 30 001',
    email: 'ole.fjelldal@trollprod.no',
    availability: {},
    rate: 5200,
    rateType: 'daily',
    union: 'NFF',
  },
  {
    id: 'crew-bbelectric',
    name: 'Sindre Breivik',
    role: 'Best Boy Electric',
    department: 'Lys',
    phone: '+47 900 30 002',
    email: 'sindre.breivik@trollprod.no',
    availability: {},
    rate: 3800,
    rateType: 'daily',
    union: 'NFF',
  },
  {
    id: 'crew-keygrip',
    name: 'Anders Nordby',
    role: 'Key Grip',
    department: 'Grip',
    phone: '+47 900 40 001',
    email: 'anders.nordby@trollprod.no',
    availability: {},
    rate: 4500,
    rateType: 'daily',
    union: 'NFF',
  },
  // Sound
  {
    id: 'crew-sound',
    name: 'Baard H. Ingebretsen',
    role: 'Lydtekniker',
    department: 'Lyd',
    phone: '+47 900 50 001',
    email: 'baard.ingebretsen@trollprod.no',
    availability: {},
    rate: 5500,
    rateType: 'daily',
    union: 'NFF',
    notes: 'Erfaren med location sound',
  },
  {
    id: 'crew-boom',
    name: 'Karoline Brekke',
    role: 'Bom-operatør',
    department: 'Lyd',
    phone: '+47 900 50 002',
    email: 'karoline.brekke@trollprod.no',
    availability: {},
    rate: 3500,
    rateType: 'daily',
    union: 'NFF',
  },
  // Art Department
  {
    id: 'crew-artdir',
    name: 'Astrid Svarstad',
    role: 'Scenograf',
    department: 'Art',
    phone: '+47 900 60 001',
    email: 'astrid.svarstad@trollprod.no',
    availability: {},
    rate: 5000,
    rateType: 'daily',
    union: 'NFF',
  },
  {
    id: 'crew-props',
    name: 'Martin Andresen',
    role: 'Rekvisittør',
    department: 'Art',
    phone: '+47 900 60 002',
    email: 'martin.andresen@trollprod.no',
    availability: {},
    rate: 3800,
    rateType: 'daily',
    union: 'NFF',
  },
  // HMU
  {
    id: 'crew-makeup',
    name: 'Siri Seljeseth',
    role: 'Sminkesjef',
    department: 'HMU',
    phone: '+47 900 70 001',
    email: 'siri.seljeseth@trollprod.no',
    availability: {},
    rate: 4500,
    rateType: 'daily',
  },
  {
    id: 'crew-hair',
    name: 'Line Hoftun',
    role: 'Hårdesigner',
    department: 'HMU',
    phone: '+47 900 70 002',
    email: 'line.hoftun@trollprod.no',
    availability: {},
    rate: 4200,
    rateType: 'daily',
  },
  // Costume
  {
    id: 'crew-costume',
    name: 'Karen Fabritius Gram',
    role: 'Kostymedesigner',
    department: 'Kostyme',
    phone: '+47 900 80 001',
    email: 'karen.gram@trollprod.no',
    availability: {},
    rate: 4800,
    rateType: 'daily',
  },
  // Script
  {
    id: 'crew-scriptsup',
    name: 'Tone Gry Larsen',
    role: 'Script Supervisor',
    department: 'Regi',
    phone: '+47 900 10 010',
    email: 'tone.larsen@trollprod.no',
    availability: {},
    rate: 4200,
    rateType: 'daily',
    union: 'NFF',
  },
  // AD Department
  {
    id: 'crew-1st-ad',
    name: 'Thomas Nilsen',
    role: '1st AD',
    department: 'Regi',
    phone: '+47 900 10 020',
    email: 'thomas.nilsen@trollprod.no',
    availability: {},
    rate: 5000,
    rateType: 'daily',
    union: 'NFF',
  },
  {
    id: 'crew-2nd-ad',
    name: 'Emilie Andersen',
    role: '2nd AD',
    department: 'Regi',
    phone: '+47 900 10 021',
    email: 'emilie.andersen@trollprod.no',
    availability: {},
    rate: 3500,
    rateType: 'daily',
    union: 'NFF',
  },
  // VFX
  {
    id: 'crew-vfx-super',
    name: 'Fredrik Øistad',
    role: 'VFX Supervisor',
    department: 'VFX',
    phone: '+47 900 90 001',
    email: 'fredrik.oistad@trollprod.no',
    availability: {},
    rate: 7500,
    rateType: 'daily',
    notes: 'On-set VFX supervisor. Koordinerer med post.',
  },
  // Stunt
  {
    id: 'crew-stunt',
    name: 'Pål Sverre Hagen',
    role: 'Stuntkoordinator',
    department: 'Stunts',
    phone: '+47 900 95 001',
    email: 'pal.hagen@trollprod.no',
    availability: {},
    rate: 6000,
    rateType: 'daily',
  },
];

// TROLL Shooting Days
export const TROLL_SHOOTING_DAYS: ShootingDay[] = [
  {
    id: 'day-1',
    projectId: TROLL_PROJECT_ID,
    dayNumber: 1,
    date: '2026-02-01',
    callTime: '06:00',
    location: 'Dovre - Tunnelåpning',
    locationAddress: 'Hjerkinnvegen 200, 2661 Hjerkinn',
    notes: 'Nattscener. VFX markers for troll-øyne.',
    scenes: ['scene-1', 'scene-2'],
    status: 'wrapped',
    weather: {
      condition: 'cloudy',
      temperature: -5,
      sunrise: '08:45',
      sunset: '16:30',
      forecast: 'Skyet, risiko for snø',
    },
    crewCallTimes: {
      'crew-dop': '05:30',
      'crew-gaffer': '05:00',
      'crew-sound': '06:00',
    },
    castCallTimes: {
      'cast-arbeider1': '07:00',
      'cast-arbeider2': '07:00',
    },
    equipmentNeeded: ['ARRI Alexa 35', 'Cooke S7', 'HMI 18K', 'Generator'],
    meals: [
      { id: 'meal-1-breakfast', type: 'breakfast', time: '06:00', location: 'Basecamp' },
      { id: 'meal-1-lunch', type: 'lunch', time: '12:00', caterer: 'Film Catering AS' },
      { id: 'meal-1-dinner', type: 'dinner', time: '18:00', caterer: 'Film Catering AS' },
    ],
    actualStartTime: '06:15',
    actualWrapTime: '19:30',
    dailyReport: {
      id: 'report-1',
      shootingDayId: 'day-1',
      completedScenes: ['scene-1'],
      partialScenes: ['scene-2'],
      notStarted: [],
      totalSetups: 18,
      pagesShot: 5.5,
      actualRuntime: 300,
      delays: [
        { reason: 'Snøvær', duration: 45, category: 'weather' },
        { reason: 'Generator-problemer', duration: 30, category: 'technical' },
      ],
      accidents: [],
      notes: 'God fremgang tross værforhold. Scene 2 fullføres dag 2.',
      submittedBy: 'crew-lineprod',
      submittedAt: '2026-02-01T20:00:00Z',
    },
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-01T20:00:00Z',
  },
  {
    id: 'day-2',
    projectId: TROLL_PROJECT_ID,
    dayNumber: 2,
    date: '2026-02-02',
    callTime: '07:00',
    location: 'Dovre - Tunnelåpning',
    locationAddress: 'Hjerkinnvegen 200, 2661 Hjerkinn',
    notes: 'Fortsetter scene 2. Fullmåne-scener.',
    scenes: ['scene-2'],
    status: 'wrapped',
    weather: {
      condition: 'snow',
      temperature: -8,
      sunrise: '08:43',
      sunset: '16:33',
      forecast: 'Lett snø, klart mot kveld',
    },
    crewCallTimes: {},
    castCallTimes: {
      'cast-arbeider1': '08:00',
      'cast-arbeider2': '08:00',
    },
    equipmentNeeded: ['ARRI Alexa 35', 'Cooke S7', 'Moonbox', 'Crane'],
    meals: [
      { id: 'meal-2-breakfast', type: 'breakfast', time: '07:00' },
      { id: 'meal-2-lunch', type: 'lunch', time: '12:30' },
    ],
    actualStartTime: '07:15',
    actualWrapTime: '16:00',
    dailyReport: {
      id: 'report-2',
      shootingDayId: 'day-2',
      completedScenes: ['scene-2'],
      partialScenes: [],
      notStarted: [],
      totalSetups: 12,
      pagesShot: 2.5,
      actualRuntime: 120,
      delays: [],
      accidents: [],
      notes: 'Effektiv dag. Tunnel-scenene er i boks!',
      submittedBy: 'crew-lineprod',
      submittedAt: '2026-02-02T17:00:00Z',
    },
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-02T17:00:00Z',
  },
  {
    id: 'day-3',
    projectId: TROLL_PROJECT_ID,
    dayNumber: 3,
    date: '2026-02-03',
    callTime: '08:00',
    location: 'Oslo - Noras leilighet (Studio)',
    locationAddress: 'Filmparken, Jar, 1358 Jar',
    notes: 'Studio-dag. INT scener med Nora.',
    scenes: ['scene-3'],
    status: 'in-progress',
    weather: {
      condition: 'cloudy',
      temperature: 2,
      sunrise: '08:40',
      sunset: '16:37',
    },
    crewCallTimes: {},
    castCallTimes: {
      'cast-nora': '07:00', // Sminke før call
    },
    equipmentNeeded: ['ARRI Alexa 35', 'Zeiss Supreme', 'Kinoflo', 'Dolly'],
    meals: [
      { id: 'meal-3-breakfast', type: 'breakfast', time: '07:30' },
      { id: 'meal-3-lunch', type: 'lunch', time: '13:00' },
    ],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-03T10:00:00Z',
  },
  {
    id: 'day-4',
    projectId: TROLL_PROJECT_ID,
    dayNumber: 4,
    date: '2026-02-04',
    callTime: '08:00',
    location: 'UiO - Blindern',
    locationAddress: 'Problemveien 7, 0313 Oslo',
    notes: 'Universitetet. Møterom-scenen.',
    scenes: ['scene-4'],
    status: 'planned',
    weather: {
      condition: 'rain',
      temperature: 4,
      sunrise: '08:38',
      sunset: '16:40',
    },
    crewCallTimes: {},
    castCallTimes: {
      'cast-nora': '07:30',
      'cast-andreas': '08:00',
      'cast-general': '08:00',
    },
    equipmentNeeded: ['ARRI Alexa 35', 'Zeiss Supreme', 'LED panels', 'Slider'],
    meals: [
      { id: 'meal-4-breakfast', type: 'breakfast', time: '07:30' },
      { id: 'meal-4-lunch', type: 'lunch', time: '12:30' },
    ],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'day-5',
    projectId: TROLL_PROJECT_ID,
    dayNumber: 5,
    date: '2026-02-05',
    callTime: '06:00',
    location: 'Dovre - Ruinområdet',
    locationAddress: 'Dombås 2660',
    notes: 'EXT dag. Helikopterscene. Koordinering med Forsvaret.',
    scenes: ['scene-5'],
    status: 'planned',
    weather: {
      condition: 'sunny',
      temperature: -3,
      sunrise: '08:35',
      sunset: '16:44',
    },
    crewCallTimes: {},
    castCallTimes: {
      'cast-nora': '05:00',
      'cast-andreas': '05:30',
    },
    equipmentNeeded: ['ARRI Alexa 35', 'Angénieux Optimo', 'Helikopter-rigg', 'Gimbal'],
    meals: [
      { id: 'meal-5-breakfast', type: 'breakfast', time: '05:30' },
      { id: 'meal-5-lunch', type: 'lunch', time: '11:30' },
      { id: 'meal-5-dinner', type: 'dinner', time: '17:00' },
    ],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'day-6',
    projectId: TROLL_PROJECT_ID,
    dayNumber: 6,
    date: '2026-02-06',
    callTime: '09:00',
    location: 'Forsvarets Kommandosentral (Studio)',
    locationAddress: 'Filmparken, Jar',
    notes: 'INT Kommandosentralen. Mange statister.',
    scenes: ['scene-7'],
    status: 'planned',
    crewCallTimes: {},
    castCallTimes: {
      'cast-nora': '08:00',
      'cast-general': '08:30',
      'cast-statsminister': '09:00',
    },
    equipmentNeeded: ['ARRI Alexa 35', 'Zeiss Supreme', 'LED Wall', 'Practicals'],
    meals: [
      { id: 'meal-6-breakfast', type: 'breakfast', time: '08:30' },
      { id: 'meal-6-lunch', type: 'lunch', time: '13:00' },
    ],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'day-7',
    projectId: TROLL_PROJECT_ID,
    dayNumber: 7,
    date: '2026-02-08',
    callTime: '17:00',
    location: 'Østerdalen - Bondens gård',
    locationAddress: 'Åmot kommune, 2450 Rena',
    notes: 'Nattscene. Trollet passerer gården. VFX tung.',
    scenes: ['scene-6'],
    status: 'planned',
    weather: {
      condition: 'cloudy',
      temperature: -6,
      sunrise: '08:28',
      sunset: '16:54',
    },
    crewCallTimes: {},
    castCallTimes: {
      'cast-bonde': '16:00',
    },
    equipmentNeeded: ['ARRI Alexa 35', 'Cooke S7', 'Moonbox 30K', 'Crane', 'VFX tracking markers'],
    meals: [
      { id: 'meal-7-dinner', type: 'dinner', time: '17:00' },
      { id: 'meal-7-snack', type: 'snack', time: '23:00' },
    ],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'day-8',
    projectId: TROLL_PROJECT_ID,
    dayNumber: 8,
    date: '2026-02-15',
    callTime: '04:00',
    location: 'Karl Johans gate / Slottsplassen',
    locationAddress: 'Karl Johans gate, 0154 Oslo',
    notes: 'KLIMAKS. Sunrise shoot. Gateavsperring 03:00-09:00.',
    scenes: ['scene-9', 'scene-10'],
    status: 'planned',
    weather: {
      condition: 'cloudy',
      temperature: 1,
      sunrise: '08:05',
      sunset: '17:15',
    },
    crewCallTimes: {
      'crew-gaffer': '03:00',
      'crew-dop': '03:30',
    },
    castCallTimes: {
      'cast-nora': '03:00', // Full sminke
      'cast-andreas': '04:00',
      'cast-tobias': '05:00',
      'cast-general': '04:30',
    },
    equipmentNeeded: ['ARRI Alexa 35', 'All lenses', 'Technocrane', 'LED Wall mobile', 'VFX green screen segments'],
    meals: [
      { id: 'meal-8-breakfast', type: 'breakfast', time: '04:00' },
      { id: 'meal-8-lunch', type: 'lunch', time: '10:00' },
    ],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
];

// Stripboard data
export const TROLL_STRIPBOARD: StripboardStrip[] = [
  // Day 1 - Tunnel EXT NIGHT
  {
    id: 'strip-1',
    sceneId: 'scene-1',
    sceneNumber: '1',
    shootingDayId: 'day-1',
    dayNumber: 1,
    sortOrder: 1,
    color: '#1a237e', // EXT NIGHT - Dark blue
    location: 'DOVRE FJELL - TUNNEL',
    pages: 3,
    cast: ['ARBEIDER 1', 'ARBEIDER 2', 'FORMANN'],
    status: 'shot',
    estimatedTime: 180,
  },
  {
    id: 'strip-2',
    sceneId: 'scene-2',
    sceneNumber: '2',
    shootingDayId: 'day-1',
    dayNumber: 1,
    sortOrder: 2,
    color: '#4a148c', // INT NIGHT - Purple
    location: 'HULEN - INNE I FJELLET',
    pages: 2.5,
    cast: ['ARBEIDER 1', 'ARBEIDER 2'],
    status: 'shot',
    estimatedTime: 120,
  },
  // Day 3 - Studio INT DAY
  {
    id: 'strip-3',
    sceneId: 'scene-3',
    sceneNumber: '3',
    shootingDayId: 'day-3',
    dayNumber: 3,
    sortOrder: 1,
    color: '#fff9c4', // INT DAY - Light yellow
    location: 'NORAS LEILIGHET - OSLO',
    pages: 2,
    cast: ['NORA TIDEMANN'],
    status: 'scheduled',
    estimatedTime: 120,
  },
  // Day 4 - UiO INT DAY
  {
    id: 'strip-4',
    sceneId: 'scene-4',
    sceneNumber: '4',
    shootingDayId: 'day-4',
    dayNumber: 4,
    sortOrder: 1,
    color: '#fff9c4', // INT DAY
    location: 'UNIVERSITETET - KONTOR',
    pages: 4,
    cast: ['NORA TIDEMANN', 'ANDREAS ISAKSEN', 'GENERAL LUND'],
    status: 'scheduled',
    estimatedTime: 240,
  },
  // Day 5 - Dovre EXT DAY
  {
    id: 'strip-5',
    sceneId: 'scene-5',
    sceneNumber: '5',
    shootingDayId: 'day-5',
    dayNumber: 5,
    sortOrder: 1,
    color: '#e3f2fd', // EXT DAY - Light blue
    location: 'DOVRE - RUINENE',
    pages: 3,
    cast: ['NORA TIDEMANN', 'ANDREAS ISAKSEN', 'SOLDATER'],
    status: 'scheduled',
    estimatedTime: 180,
    notes: 'Helikopter-koordinering nødvendig',
  },
  // Day 6 - Kommandosentral INT DAY
  {
    id: 'strip-6',
    sceneId: 'scene-7',
    sceneNumber: '7',
    shootingDayId: 'day-6',
    dayNumber: 6,
    sortOrder: 1,
    color: '#fff9c4', // INT DAY
    location: 'KOMMANDOSENTRALEN - OSLO',
    pages: 5,
    cast: ['NORA TIDEMANN', 'GENERAL LUND', 'STATSMINISTER', 'RÅDGIVERE'],
    status: 'scheduled',
    estimatedTime: 300,
  },
  // Day 7 - Østerdalen EXT NIGHT
  {
    id: 'strip-7',
    sceneId: 'scene-6',
    sceneNumber: '6',
    shootingDayId: 'day-7',
    dayNumber: 7,
    sortOrder: 1,
    color: '#1a237e', // EXT NIGHT
    location: 'SKOG - ØSTERDALEN',
    pages: 3,
    cast: ['TROLLET', 'BONDE', 'BONDENS KONE'],
    status: 'scheduled',
    estimatedTime: 180,
    notes: 'Full VFX - Troll CG',
  },
  // Day 8 - Karl Johan EXT DAWN
  {
    id: 'strip-8',
    sceneId: 'scene-9',
    sceneNumber: '9',
    shootingDayId: 'day-8',
    dayNumber: 8,
    sortOrder: 1,
    color: '#ffccbc', // EXT DAWN - Orange tint
    location: 'SLOTTSPLASSEN - OSLO',
    pages: 6,
    cast: ['TROLLET', 'NORA TIDEMANN', 'ANDREAS ISAKSEN', 'SOLDATER'],
    status: 'scheduled',
    estimatedTime: 360,
    notes: 'Sunrise kritisk - backup dag planlagt',
  },
  {
    id: 'strip-9',
    sceneId: 'scene-10',
    sceneNumber: '10',
    shootingDayId: 'day-8',
    dayNumber: 8,
    sortOrder: 2,
    color: '#ffccbc', // EXT DAWN
    location: 'KARL JOHANS GATE - OSLO',
    pages: 9,
    cast: ['TROLLET', 'NORA TIDEMANN', 'ANDREAS ISAKSEN', 'TOBIAS (FAR)'],
    status: 'scheduled',
    estimatedTime: 540,
    notes: 'KLIMAKS - VFX tung scene',
  },
];

// Live Set Status Mock
export const TROLL_LIVE_SET_STATUS: LiveSetStatus = {
  currentScene: 'scene-3',
  currentShot: 'shot-3-1',
  currentTake: 3,
  isRolling: false,
  lastAction: 'CUT - Print take 3',
  lastActionTime: new Date().toISOString(),
  todayTakes: [
    {
      id: 'take-3-1-1',
      sceneId: 'scene-3',
      shotId: 'shot-3-1',
      takeNumber: 1,
      status: 'bad',
      duration: 45,
      notes: 'Boom i bilde',
      recordedAt: new Date(Date.now() - 3600000).toISOString(),
      camera: 'A-cam',
      lens: '50mm',
      slate: '3A-1',
    },
    {
      id: 'take-3-1-2',
      sceneId: 'scene-3',
      shotId: 'shot-3-1',
      takeNumber: 2,
      status: 'ok',
      duration: 48,
      notes: 'God, men litt stiv',
      recordedAt: new Date(Date.now() - 3000000).toISOString(),
      camera: 'A-cam',
      lens: '50mm',
      slate: '3A-2',
    },
    {
      id: 'take-3-1-3',
      sceneId: 'scene-3',
      shotId: 'shot-3-1',
      takeNumber: 3,
      status: 'circle',
      duration: 52,
      notes: 'Perfekt! Nora nailet det.',
      circledBy: 'crew-director',
      recordedAt: new Date(Date.now() - 2400000).toISOString(),
      camera: 'A-cam',
      lens: '50mm',
      slate: '3A-3',
    },
  ],
  todayProgress: {
    plannedScenes: 1,
    completedScenes: 0,
    partialScenes: 1,
    totalSetups: 8,
    completedSetups: 3,
    pagesPlanned: 2,
    pagesShot: 0.75,
  },
};

// ============================================
// SERVICE CLASS
// ============================================

const API_BASE = '/api/production';

class ProductionWorkflowService {
  // In-memory cache for fallback
  private shootingDaysCache: ShootingDay[] = [...TROLL_SHOOTING_DAYS];
  private stripboardCache: StripboardStrip[] = [...TROLL_STRIPBOARD];
  private castCache: CastMember[] = [...TROLL_CAST];
  private crewCache: CrewMember[] = [...TROLL_CREW];
  private liveSetStatus: LiveSetStatus = { ...TROLL_LIVE_SET_STATUS };
  private takes: Take[] = [...TROLL_LIVE_SET_STATUS.todayTakes];
  private useApi: boolean = true;

  // Helper to convert API response to frontend format
  private convertShootingDay(row: any): ShootingDay {
    return {
      id: row.id,
      projectId: row.project_id,
      dayNumber: row.day_number,
      date: row.date,
      callTime: row.call_time,
      wrapTime: row.wrap_time,
      location: row.location,
      locationAddress: row.location_address,
      notes: row.notes,
      scenes: row.scenes || [],
      status: row.status || 'planned',
      weather: row.weather,
      crewCallTimes: row.crew_call_times || {},
      castCallTimes: row.cast_call_times || {},
      equipmentNeeded: row.equipment_needed || [],
      meals: row.meals || [],
      actualStartTime: row.actual_start_time,
      actualWrapTime: row.actual_wrap_time,
      dailyReport: row.daily_report,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private convertStripboardStrip(row: any): StripboardStrip {
    return {
      id: row.id,
      sceneId: row.scene_id,
      sceneNumber: row.scene_number,
      shootingDayId: row.shooting_day_id,
      dayNumber: row.day_number,
      sortOrder: row.sort_order,
      color: row.color || '#4A5568',
      location: row.location || '',
      pages: parseFloat(row.pages) || 0,
      cast: row.cast_ids || [],
      status: row.status || 'not-scheduled',
      estimatedTime: row.estimated_time || 60,
      notes: row.notes,
    };
  }

  private convertCastMember(row: any): CastMember {
    return {
      id: row.id,
      name: row.name,
      character: row.character_name,
      scenes: row.scenes || [],
      phone: row.phone || '',
      email: row.email || '',
      availability: row.availability || {},
      contract: row.contract,
      notes: row.notes,
    };
  }

  private convertCrewMember(row: any): CrewMember {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      department: row.department || '',
      phone: row.phone || '',
      email: row.email || '',
      availability: row.availability || {},
      rate: row.rate,
      rateType: row.rate_type,
      union: row.union_affiliation,
      notes: row.notes,
    };
  }

  // ============================================
  // SHOOTING DAYS
  // ============================================

  async getShootingDays(projectId: string): Promise<ShootingDay[]> {
    if (this.useApi) {
      try {
        const response = await fetch(`${API_BASE}/${projectId}/shooting-days`);
        const result = await response.json();
        if (result.success && result.data) {
          const days = result.data.map((row: any) => this.convertShootingDay(row));
          this.shootingDaysCache = days;
          return days;
        }
      } catch (error) {
        console.warn('API unavailable, using cache:', error);
      }
    }
    // Fallback to cache
    await new Promise(resolve => setTimeout(resolve, 200));
    return this.shootingDaysCache.filter(d => d.projectId === projectId || projectId === 'troll-2022');
  }

  async getShootingDay(dayId: string): Promise<ShootingDay | null> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.shootingDaysCache.find(d => d.id === dayId) || null;
  }

  async createShootingDay(day: Omit<ShootingDay, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShootingDay> {
    if (this.useApi) {
      try {
        const response = await fetch(`${API_BASE}/${day.projectId}/shooting-days`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(day),
        });
        const result = await response.json();
        if (result.success && result.data) {
          const newDay = this.convertShootingDay(result.data);
          this.shootingDaysCache.push(newDay);
          return newDay;
        }
      } catch (error) {
        console.warn('API unavailable, using local storage:', error);
      }
    }
    // Fallback to local
    const now = new Date().toISOString();
    const newDay: ShootingDay = {
      ...day,
      id: `day-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    this.shootingDaysCache.push(newDay);
    return newDay;
  }

  async updateShootingDay(dayId: string, updates: Partial<ShootingDay>): Promise<ShootingDay | null> {
    if (this.useApi) {
      try {
        const response = await fetch(`${API_BASE}/shooting-days/${dayId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        const result = await response.json();
        if (result.success && result.data) {
          const updated = this.convertShootingDay(result.data);
          const index = this.shootingDaysCache.findIndex(d => d.id === dayId);
          if (index !== -1) this.shootingDaysCache[index] = updated;
          return updated;
        }
      } catch (error) {
        console.warn('API unavailable, using local storage:', error);
      }
    }
    // Fallback to local
    const index = this.shootingDaysCache.findIndex(d => d.id === dayId);
    if (index === -1) return null;
    
    this.shootingDaysCache[index] = {
      ...this.shootingDaysCache[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return this.shootingDaysCache[index];
  }

  async deleteShootingDay(dayId: string): Promise<boolean> {
    if (this.useApi) {
      try {
        const response = await fetch(`${API_BASE}/shooting-days/${dayId}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
          const index = this.shootingDaysCache.findIndex(d => d.id === dayId);
          if (index !== -1) this.shootingDaysCache.splice(index, 1);
          return true;
        }
      } catch (error) {
        console.warn('API unavailable, using local storage:', error);
      }
    }
    // Fallback to local
    const index = this.shootingDaysCache.findIndex(d => d.id === dayId);
    if (index === -1) return false;
    this.shootingDaysCache.splice(index, 1);
    return true;
  }

  // ============================================
  // STRIPBOARD
  // ============================================

  async getStripboard(projectId: string): Promise<StripboardStrip[]> {
    if (this.useApi) {
      try {
        const response = await fetch(`${API_BASE}/${projectId}/stripboard`);
        const result = await response.json();
        if (result.success && result.data) {
          const strips = result.data.map((row: any) => this.convertStripboardStrip(row));
          this.stripboardCache = strips;
          return strips;
        }
      } catch (error) {
        console.warn('API unavailable, using cache:', error);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 150));
    return this.stripboardCache;
  }

  async updateStripOrder(strips: StripboardStrip[]): Promise<StripboardStrip[]> {
    this.stripboardCache = strips.map((s, idx) => ({ ...s, sortOrder: idx }));
    return this.stripboardCache;
  }

  async assignSceneToDay(sceneId: string, dayId: string | null): Promise<StripboardStrip | null> {
    const strip = this.stripboardCache.find(s => s.sceneId === sceneId);
    if (!strip) return null;

    const day = dayId ? this.shootingDaysCache.find(d => d.id === dayId) : null;
    strip.shootingDayId = dayId || undefined;
    strip.dayNumber = day?.dayNumber;
    strip.status = dayId ? 'scheduled' : 'not-scheduled';
    
    // Update via API if available
    if (this.useApi && strip.id) {
      try {
        await fetch(`${API_BASE}/stripboard/${strip.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shootingDayId: dayId,
            dayNumber: day?.dayNumber,
            status: dayId ? 'scheduled' : 'not-scheduled',
          }),
        });
      } catch (error) {
        console.warn('API unavailable for stripboard update:', error);
      }
    }
    
    return strip;
  }

  // ============================================
  // CAST & CREW
  // ============================================

  async getCast(projectId: string): Promise<CastMember[]> {
    if (this.useApi) {
      try {
        const response = await fetch(`${API_BASE}/${projectId}/cast`);
        const result = await response.json();
        if (result.success && result.data) {
          const cast = result.data.map((row: any) => this.convertCastMember(row));
          this.castCache = cast;
          return cast;
        }
      } catch (error) {
        console.warn('API unavailable, using cache:', error);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.castCache;
  }

  async getCrew(projectId: string): Promise<CrewMember[]> {
    if (this.useApi) {
      try {
        const response = await fetch(`${API_BASE}/${projectId}/crew`);
        const result = await response.json();
        if (result.success && result.data) {
          const crew = result.data.map((row: any) => this.convertCrewMember(row));
          this.crewCache = crew;
          return crew;
        }
      } catch (error) {
        console.warn('API unavailable, using cache:', error);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.crewCache;
  }

  async checkAvailability(date: string, castIds: string[], crewIds: string[]): Promise<{
    availableCast: string[];
    unavailableCast: string[];
    availableCrew: string[];
    unavailableCrew: string[];
  }> {
    const availableCast: string[] = [];
    const unavailableCast: string[] = [];
    const availableCrew: string[] = [];
    const unavailableCrew: string[] = [];

    for (const id of castIds) {
      const member = this.castCache.find(c => c.id === id);
      if (member?.availability[date] !== false) {
        availableCast.push(id);
      } else {
        unavailableCast.push(id);
      }
    }

    for (const id of crewIds) {
      const member = this.crewCache.find(c => c.id === id);
      if (member?.availability[date] !== false) {
        availableCrew.push(id);
      } else {
        unavailableCrew.push(id);
      }
    }

    return { availableCast, unavailableCast, availableCrew, unavailableCrew };
  }

  // ============================================
  // CALL SHEETS
  // ============================================

  async generateCallSheet(dayId: string): Promise<CallSheet> {
    const day = await this.getShootingDay(dayId);
    if (!day) throw new Error('Shooting day not found');

    const scenes = this.stripboardCache.filter(s => s.shootingDayId === dayId);
    
    const callSheet: CallSheet = {
      id: `callsheet-${dayId}`,
      shootingDayId: dayId,
      projectTitle: 'TROLL',
      productionCompany: 'Motion Blur Pictures',
      director: 'Roar Uthaug',
      producer: 'Espen Horn',
      date: day.date,
      dayNumber: day.dayNumber,
      totalDays: this.shootingDaysCache.length,
      generalCallTime: day.callTime,
      crewCallTimes: this.crewCache.map(c => ({
        id: c.id,
        name: c.name,
        role: c.role,
        department: c.department,
        callTime: day.crewCallTimes[c.id] || day.callTime,
        phone: c.phone,
        email: c.email,
      })),
      castCallTimes: this.castCache
        .filter(c => scenes.some(s => s.cast.includes(c.character)))
        .map(c => ({
          id: c.id,
          name: c.name,
          character: c.character,
          callTime: day.castCallTimes[c.id] || day.callTime,
          scenes: scenes.filter(s => s.cast.includes(c.character)).map(s => s.sceneNumber),
          phone: c.phone,
        })),
      scenes: scenes.map(s => ({
        sceneNumber: s.sceneNumber,
        description: `Scene ${s.sceneNumber}`,
        location: s.location,
        intExt: s.color === '#fff9c4' || s.color === '#4a148c' ? 'INT' : 'EXT',
        timeOfDay: s.color.includes('1a237e') ? 'NIGHT' : s.color.includes('ffccbc') ? 'DAWN' : 'DAY',
        pages: s.pages,
        cast: s.cast,
        estimatedTime: `${Math.floor(s.estimatedTime / 60)}t ${s.estimatedTime % 60}m`,
      })),
      locations: [{
        name: day.location,
        address: day.locationAddress || '',
        parking: 'Se kart i vedlegg',
      }],
      equipment: day.equipmentNeeded,
      meals: day.meals,
      contacts: [
        { name: 'Roar Uthaug', role: 'Regissør', phone: '+47 900 10 001', department: 'Regi' },
        { name: 'Kristin Horntvedt', role: 'Innspillingsleder', phone: '+47 900 10 003', department: 'Produksjon' },
        { name: 'Thomas Nilsen', role: '1st AD', phone: '+47 900 10 020', department: 'Regi' },
      ],
      notes: day.notes ? [day.notes] : [],
      weather: day.weather,
      nearestHospital: 'Oslo Universitetssykehus - Ullevål, tlf: 22 11 80 80',
      parking: 'Avsatt område ved lokasjon. Se vedlagt kart.',
      createdAt: new Date().toISOString(),
      version: 1,
    };

    // Store call sheet via API if available
    if (this.useApi) {
      try {
        await fetch(`${API_BASE}/${day.projectId}/call-sheets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(callSheet),
        });
      } catch (error) {
        console.warn('API unavailable for call sheet save:', error);
      }
    }

    return callSheet;
  }

  // ============================================
  // LIVE SET TRACKING
  // ============================================

  async getLiveSetStatus(projectId: string): Promise<LiveSetStatus> {
    if (this.useApi) {
      try {
        const response = await fetch(`${API_BASE}/${projectId}/live-set-status`);
        const result = await response.json();
        if (result.success && result.data) {
          // Convert from API format
          this.liveSetStatus = {
            currentScene: result.data.current_scene_id,
            currentShot: result.data.current_shot_id,
            currentTake: result.data.current_setup || 0,
            isRolling: result.data.status === 'rolling',
            lastAction: result.data.notes || '',
            lastActionTime: result.data.updated_at || new Date().toISOString(),
            todayTakes: result.data.today_takes || [],
            todayProgress: {
              plannedScenes: result.data.total_setups || 0,
              completedScenes: (result.data.scenes_completed || []).length,
              partialScenes: (result.data.scenes_partial || []).length,
              totalSetups: result.data.total_setups || 0,
              completedSetups: result.data.current_setup || 0,
              pagesPlanned: 0,
              pagesShot: parseFloat(result.data.pages_shot) || 0,
            },
          };
          return this.liveSetStatus;
        }
      } catch (error) {
        console.warn('API unavailable, using cache:', error);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    return this.liveSetStatus;
  }

  async startRolling(sceneId: string, shotId: string): Promise<LiveSetStatus> {
    this.liveSetStatus = {
      ...this.liveSetStatus,
      currentScene: sceneId,
      currentShot: shotId,
      isRolling: true,
      lastAction: 'ROLLING',
      lastActionTime: new Date().toISOString(),
    };
    return this.liveSetStatus;
  }

  async cut(status: 'good' | 'ok' | 'bad' | 'circle' | 'print', notes?: string): Promise<Take> {
    const take: Take = {
      id: `take-${Date.now()}`,
      sceneId: this.liveSetStatus.currentScene!,
      shotId: this.liveSetStatus.currentShot!,
      takeNumber: this.liveSetStatus.currentTake,
      status,
      duration: Math.floor(Math.random() * 30) + 20, // Random 20-50s
      notes,
      recordedAt: new Date().toISOString(),
      camera: 'A-cam',
      slate: `${this.liveSetStatus.currentScene?.replace('scene-', '')}-${this.liveSetStatus.currentTake}`,
    };

    this.takes.push(take);
    this.liveSetStatus = {
      ...this.liveSetStatus,
      currentTake: this.liveSetStatus.currentTake + 1,
      isRolling: false,
      lastAction: `CUT - ${status.toUpperCase()}${notes ? `: ${notes}` : ''}`,
      lastActionTime: new Date().toISOString(),
      todayTakes: [...this.liveSetStatus.todayTakes, take],
      todayProgress: {
        ...this.liveSetStatus.todayProgress,
        completedSetups: this.liveSetStatus.todayProgress.completedSetups + (status === 'circle' || status === 'print' ? 1 : 0),
      },
    };

    return take;
  }

  async getTodayTakes(shootingDayId: string): Promise<Take[]> {
    const day = this.shootingDaysCache.find(d => d.id === shootingDayId);
    if (!day) return [];
    return this.takes.filter(take => day.scenes.includes(take.sceneId));
  }

  async circleTake(takeId: string, circledBy: string): Promise<Take | null> {
    const take = this.takes.find(t => t.id === takeId);
    if (!take) return null;
    take.status = 'circle';
    take.circledBy = circledBy;
    return take;
  }

  // ============================================
  // DAILY REPORTS
  // ============================================

  async submitDailyReport(report: Omit<DailyReport, 'id' | 'submittedAt'>): Promise<DailyReport> {
    const fullReport: DailyReport = {
      ...report,
      id: `report-${Date.now()}`,
      submittedAt: new Date().toISOString(),
    };

    // Update shooting day with report
    const dayIndex = this.shootingDaysCache.findIndex(d => d.id === report.shootingDayId);
    if (dayIndex !== -1) {
      this.shootingDaysCache[dayIndex].dailyReport = fullReport;
      this.shootingDaysCache[dayIndex].status = 'wrapped';
    }

    return fullReport;
  }

  // ============================================
  // CONFLICTS & SCHEDULING
  // ============================================

  async getScheduleConflicts(date: string): Promise<{
    castConflicts: Array<{ castId: string; reason: string }>;
    crewConflicts: Array<{ crewId: string; reason: string }>;
    locationConflicts: Array<{ location: string; reason: string }>;
  }> {
    const conflicts = {
      castConflicts: [] as Array<{ castId: string; reason: string }>,
      crewConflicts: [] as Array<{ crewId: string; reason: string }>,
      locationConflicts: [] as Array<{ location: string; reason: string }>,
    };

    // Check cast availability
    for (const cast of this.castCache) {
      if (cast.availability[date] === false) {
        conflicts.castConflicts.push({
          castId: cast.id,
          reason: `${cast.name} (${cast.character}) er ikke tilgjengelig`,
        });
      }
    }

    // Check crew availability
    for (const crew of this.crewCache) {
      if (crew.availability[date] === false) {
        conflicts.crewConflicts.push({
          crewId: crew.id,
          reason: `${crew.name} (${crew.role}) er ikke tilgjengelig`,
        });
      }
    }

    return conflicts;
  }

  // ============================================
  // DATA SEEDING
  // ============================================

  async seedTrollData(projectId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE}/${projectId}/seed-troll`, {
        method: 'POST',
      });
      const result = await response.json();
      if (result.success) {
        // Refresh caches
        await this.getShootingDays(projectId);
        await this.getStripboard(projectId);
        await this.getCast(projectId);
        await this.getCrew(projectId);
        return { success: true, message: result.message || 'Troll data seeded successfully' };
      }
      return { success: false, message: result.error || 'Failed to seed data' };
    } catch (error) {
      console.warn('API unavailable for seeding:', error);
      return { success: false, message: 'API unavailable' };
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  getStripColor(intExt: string, timeOfDay: string): string {
    if (intExt === 'INT' && timeOfDay === 'DAY') return '#fff9c4'; // Light yellow
    if (intExt === 'INT' && timeOfDay === 'NIGHT') return '#4a148c'; // Purple
    if (intExt === 'EXT' && timeOfDay === 'DAY') return '#e3f2fd'; // Light blue
    if (intExt === 'EXT' && timeOfDay === 'NIGHT') return '#1a237e'; // Dark blue
    if (timeOfDay === 'DAWN' || timeOfDay === 'DUSK') return '#ffccbc'; // Orange tint
    return '#e0e0e0'; // Grey default
  }

  calculateDayOutOfDays(cast: CastMember[], stripboard: StripboardStrip[]): Record<string, {
    workDays: number[];
    holdDays: number[];
    travelDays: number[];
    totalDays: number;
  }> {
    const dood: Record<string, { workDays: number[]; holdDays: number[]; travelDays: number[]; totalDays: number }> = {};

    for (const member of cast) {
      const workDays: number[] = [];
      
      for (const strip of stripboard) {
        if (strip.cast.includes(member.character) && strip.dayNumber) {
          workDays.push(strip.dayNumber);
        }
      }

      dood[member.id] = {
        workDays: [...new Set(workDays)].sort((a, b) => a - b),
        holdDays: [],
        travelDays: [],
        totalDays: workDays.length,
      };
    }

    return dood;
  }
}

// Export singleton instance
export const productionWorkflowService = new ProductionWorkflowService();
