/**
 * Production Workflow Service
 * Handles Stripboard, Call Sheets, Shooting Schedule, and Live Set tracking
 *
 * Stripboard-delen går mot ekte data (Del A punkt 72/87) — se
 * stripboardAdapter.ts. Resten av filen er fortsatt TROLL-demodata; det er
 * merket per metode.
 */

import { apiRequest } from '../../../lib/queryClient';
import {
  adaptStripboard,
  stripStatus,
  type ApiStripboard,
} from './stripboardAdapter';

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
  // «partial» og «omitted» kommer fra basen (casting_scenes.shoot_status). En
  // strøket scene er ikke en utsatt scene — den skal ikke telle som
  // gjenstående arbeid — så de holdes adskilt framfor å presses inn i
  // «postponed».
  status: 'not-scheduled' | 'scheduled' | 'partial' | 'shot' | 'omitted' | 'postponed';
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

// Camera identifiers for multi-camera setups (Pro tier)
export type CameraId = 'A' | 'B' | 'C' | 'D';

export interface CameraMetadata {
  /** Camera unit identifier, e.g. 'A' or 'B' */
  cameraId:  CameraId;
  /** Camera body label, e.g. 'A-cam (ARRI ALEXA)' */
  camera?:   string;
  /** Lens info, e.g. '35mm T1.9' */
  lens?:     string;
  /** Frame rate, e.g. 24 */
  fps?:      number;
  /** ISO / EI, e.g. 800 */
  iso?:      number;
  /** ND filter, e.g. 'ND 1.2' */
  ndFilter?: string;
}

export interface Take {
  id:          string;
  sceneId:     string;
  shotId:      string;
  takeNumber:  number;
  status:      'good' | 'ok' | 'bad' | 'circle' | 'print';
  duration:    number; // seconds
  timecode?:   string;
  notes?:      string;
  techNotes?:  string; // Focus, exposure issues etc.
  soundNotes?: string;
  circledBy?:  string;
  recordedAt:  string;
  /** ISO timestamp when the take was logged (= recordedAt for new takes) */
  loggedAt?:   string;
  /** userId who logged the take */
  loggedBy?:   string;
  slate?:      string;
  // ── Multi-camera fields (Pro tier) ──
  cameraId?:   CameraId;  // primary camera unit
  camera?:     string;    // camera body label
  lens?:       string;
  fps?:        number;
  iso?:        number;
  ndFilter?:   string;
  /** Additional camera units rolling simultaneously */
  additionalCameras?: CameraMetadata[];
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


/** Speiler role-room-live-set-projection.ts på serversiden. */
interface LiveSetProjectedTake {
  id: string;
  sceneId: string | null;
  shotId: string | null;
  setupLabel: string | null;
  takeNumber: number;
  duration: number | null;
  status: string;
  camera: string | null;
  lens: string | null;
  fps: number | null;
  flags: string[];
  notes: string | null;
  loggedBy: string | null;
  loggedAt: string;
}

interface LiveSetProjection {
  liveState: 'idle' | 'rolling' | 'cut' | 'setup-complete';
  currentSceneId: string | null;
  currentShotId: string | null;
  activeSetup: string | null;
  activeCam: string | null;
  rollingSince: string | null;
  nextTakeNumber: number;
  takes: LiveSetProjectedTake[];
  lastAction: string | null;
  lastActionAt: string | null;
  lastActionBy: string | null;
  eventCount: number;
}

/**
 * Projeksjonens take → tjenestens Take.
 *
 * Projeksjonen bruker klientens kvalitetsvokabular («normal», «ng»), mens
 * Take-typen her er den eldre firedelingen. `normal` blir `good`; ukjent
 * verdi blir `ok` framfor å gjettes til noe bedre enn den er.
 */
function toTake(t: LiveSetProjectedTake): Take {
  const status: Take['status'] =
    t.status === 'circle' || t.status === 'print' ? t.status
    : t.status === 'bad' || t.status === 'ng' ? 'bad'
    : t.status === 'good' || t.status === 'normal' ? 'good'
    : 'ok';
  return {
    id: t.id,
    sceneId: t.sceneId ?? '',
    shotId: t.shotId ?? '',
    takeNumber: t.takeNumber,
    status,
    // Målt mellom ROLL og CUT på serversiden. 0 betyr «ikke målt», ikke
    // «varte null sekunder» — tjenesten fant tidligere på et tall her.
    duration: t.duration ?? 0,
    notes: t.notes ?? undefined,
    recordedAt: t.loggedAt,
    loggedAt: t.loggedAt,
    loggedBy: t.loggedBy ?? undefined,
    camera: t.camera ?? undefined,
    lens: t.lens ?? undefined,
    fps: t.fps ?? undefined,
  };
}

class ProductionWorkflowService {
  // In-memory cache for fallback
  // Stripboardet og opptaksdagene starter tomme, ikke med TROLL-demoen. Et
  // kall som kommer før første last skal se en tom cache — ikke en annen
  // produksjons plan som den så tar for gitt.
  private shootingDaysCache: ShootingDay[] = [];
  private stripboardCache: StripboardStrip[] = [];
  private castCache: CastMember[] = [];
  private crewCache: CrewMember[] = [];
  // Øyeblikkstilstand på settet. Ingen tabell bak den ennå, så den lever i
  // økten — men den starter tom, ikke med TROLL sine takes.
  private liveSetStatus: LiveSetStatus = {
    currentScene: null,
    currentShot: null,
    currentTake: 0,
    isRolling: false,
    lastAction: '',
    lastActionTime: '',
    todayTakes: [],
    todayProgress: {
      plannedScenes: 0, completedScenes: 0, partialScenes: 0,
      totalSetups: 0, completedSetups: 0, pagesPlanned: 0, pagesShot: 0,
    },
  };
  private takes: Take[] = [];
  private useApi: boolean = true;
  // Settes når stripboardet eller opptaksdagene hentes. Skrivekallene under
  // trenger prosjektet, og signaturene deres er panelets — ikke våre å endre.
  private currentProjectId: string | null = null;
  // Cast følger med stripboard-svaret. Se getStripboardCast().
  private stripboardCastCache: CastMember[] = [];

  // Helper to convert API response to frontend format


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

  /**
   * Opptaksdagene fra basen.
   *
   * Gikk tidligere mot `/api/production/:projectId/shooting-days`, som ikke
   * finnes, og falt tilbake på TROLL-dagene. Stripboardet leser ekte scener,
   * så dagene må komme fra samme prosjekt — ellers hadde scenene vært
   * brukerens og dagene en annen produksjons.
   *
   * Dagnummeret utledes av datorekkefølgen: «dag 3» er den tredje
   * opptaksdagen, og settes en dag inn i midten flytter de bak seg.
   */
  async getShootingDays(projectId: string): Promise<ShootingDay[]> {
    this.currentProjectId = projectId;
    const response = await apiRequest(
      `/api/role-room/projects/${projectId}/production-days`,
    );
    if (!response.ok) {
      throw new Error(`Kunne ikke hente opptaksdager (HTTP ${response.status})`);
    }
    const { productionDays } = (await response.json()) as { productionDays: any[] };

    const days: ShootingDay[] = (productionDays ?? [])
      .slice()
      .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))
      .map((row, index) => ({
        id: String(row.id),
        projectId,
        dayNumber: index + 1,
        date: String(row.date ?? ''),
        callTime: typeof row.callTime === 'string' ? row.callTime : '',
        wrapTime: typeof row.wrapTime === 'string' ? row.wrapTime : undefined,
        location: typeof row.location === 'string' ? row.location : (row.locationId ?? ''),
        locationAddress: row.locationAddress,
        notes: row.notes,
        scenes: Array.isArray(row.scenes) ? row.scenes.map(String) : [],
        status: (row.status ?? 'planned') as ShootingDay['status'],
        crewCallTimes: row.crewCallTimes ?? {},
        castCallTimes: row.castCallTimes ?? {},
        equipmentNeeded: Array.isArray(row.equipmentNeeded) ? row.equipmentNeeded : [],
        meals: Array.isArray(row.meals) ? row.meals : [],
        createdAt: String(row.createdAt ?? ''),
        updatedAt: String(row.updatedAt ?? ''),
      }));

    this.shootingDaysCache = days;
    return days;
  }

  /**
   * Én opptaksdag fra cachen, med henting hvis den er kald.
   *
   * LiveSetMode kaller denne parallelt med getLiveSetStatus, altså uten at
   * noen har hentet dagene først. Før var det greit fordi cachen kom
   * forhåndsfylt med TROLL-dager — nå starter den tom, og en kald cache ville
   * gitt null og en tom skjerm.
   */
  async getShootingDay(dayId: string, projectId?: string): Promise<ShootingDay | null> {
    const cached = this.shootingDaysCache.find(d => d.id === dayId);
    if (cached) return cached;
    // Prosjektet oppgis eksplisitt der kalleren kjenner det, slik at dette
    // ikke avhenger av at et annet kall tilfeldigvis kjørte først.
    const project = projectId ?? this.currentProjectId;
    if (!project) return null;
    await this.getShootingDays(project);
    return this.shootingDaysCache.find(d => d.id === dayId) || null;
  }

  /**
   * Oppretter en opptaksdag i basen.
   *
   * Gikk tidligere mot `/api/production/...` og falt tilbake på en rad i
   * minnet med `id: day-<timestamp>`. Dagen så opprettet ut, forsvant ved
   * neste last, og stripboardet kunne aldri legge scener på den — id-en
   * fantes ikke i basen.
   */
  async createShootingDay(day: Omit<ShootingDay, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShootingDay> {
    const response = await apiRequest('/api/role-room/production-days', {
      method: 'POST',
      body: JSON.stringify({ ...day, projectId: day.projectId }),
    });
    if (!response.ok) {
      throw new Error(`Kunne ikke opprette opptaksdag (HTTP ${response.status})`);
    }
    const { productionDay } = (await response.json()) as { productionDay: any };
    const created: ShootingDay = {
      ...(day as ShootingDay),
      id: String(productionDay.id),
      createdAt: String(productionDay.createdAt ?? ''),
      updatedAt: String(productionDay.updatedAt ?? ''),
    };
    this.shootingDaysCache.push(created);
    return created;
  }

  /**
   * Oppdaterer en opptaksdag.
   *
   * POST-ruta er en upsert på id, så den dekker begge deler. Feltene slås
   * sammen med den kjente dagen først — en delvis oppdatering skal ikke tømme
   * scenelista fordi kalleren bare ville endre klokkeslettet.
   */
  async updateShootingDay(dayId: string, updates: Partial<ShootingDay>): Promise<ShootingDay | null> {
    const known = this.shootingDaysCache.find(d => d.id === dayId);
    if (!known) return null;

    const merged = { ...known, ...updates, id: dayId };
    const response = await apiRequest('/api/role-room/production-days', {
      method: 'POST',
      body: JSON.stringify(merged),
    });
    if (!response.ok) {
      throw new Error(`Kunne ikke lagre opptaksdagen (HTTP ${response.status})`);
    }
    const index = this.shootingDaysCache.findIndex(d => d.id === dayId);
    const saved = { ...merged, updatedAt: new Date().toISOString() };
    if (index !== -1) this.shootingDaysCache[index] = saved;
    return saved;
  }

  async deleteShootingDay(dayId: string): Promise<boolean> {
    const response = await apiRequest(
      `/api/role-room/production-days/${dayId}`,
      { method: 'DELETE' },
    );
    if (!response.ok) return false;
    const index = this.shootingDaysCache.findIndex(d => d.id === dayId);
    if (index !== -1) this.shootingDaysCache.splice(index, 1);
    return true;
  }

  // ============================================
  // STRIPBOARD
  // ============================================

  /**
   * Stripboardet fra basen (Del A punkt 72).
   *
   * Tidligere gikk dette mot `/api/production/:projectId/stripboard` — et
   * endepunkt som ikke fantes i backend. Kallet feilet hver gang, ble fanget
   * av en `console.warn`, og panelet viste demodata for produksjonen «TROLL»
   * som om det var brukerens eget stripboard.
   *
   * Feil kastes nå videre framfor å svelges. Et stripboard som ikke lot seg
   * hente skal se ut som en feil, ikke som en tom produksjon.
   */
  async getStripboard(projectId: string): Promise<StripboardStrip[]> {
    this.currentProjectId = projectId;
    const response = await apiRequest(`/api/role-room/projects/${projectId}/stripboard`);
    if (!response.ok) {
      throw new Error(`Kunne ikke hente stripboardet (HTTP ${response.status})`);
    }
    const board = (await response.json()) as ApiStripboard;
    const strips = adaptStripboard(board) as StripboardStrip[];
    this.stripboardCache = strips;
    // Karakterene følger med stripboardet, så DOOD-matrisen settes opp mot de
    // samme scenene som stripene. Et eget cast-kall var nettopp der den gamle
    // flaten hentet TROLL-skuespillere fra.
    this.stripboardCastCache = (board.cast ?? []).map((member) => ({
      id: member.id,
      name: member.name,
      character: member.character,
      scenes: member.scenes,
      phone: '',
      email: '',
      availability: {},
    })) as CastMember[];
    return strips;
  }

  /** Medvirkende fra siste stripboard-henting. Tom før første last. */
  getStripboardCast(): CastMember[] {
    return this.stripboardCastCache;
  }

  /**
   * Ny rekkefølge innad i en dag.
   *
   * Hele dagens rekkefølge sendes samlet — den er en egenskap ved dagen, og
   * en scene om gangen ville etterlatt to scener med samme sortOrder hvis en
   * drag-operasjon ble avbrutt.
   */
  async updateStripOrder(strips: StripboardStrip[]): Promise<StripboardStrip[]> {
    const ordered = strips.map((s, idx) => ({ ...s, sortOrder: idx }));
    this.stripboardCache = ordered;

    const projectId = this.currentProjectId;
    if (!projectId) return ordered;

    // Grupper per dag: rekkefølgen lagres per dag, og «ikke planlagt»-bunken
    // har ingen rekkefølge å lagre.
    const byDay = new Map<string, string[]>();
    for (const strip of ordered) {
      if (!strip.shootingDayId) continue;
      const list = byDay.get(strip.shootingDayId) ?? [];
      list.push(strip.sceneId);
      byDay.set(strip.shootingDayId, list);
    }

    await Promise.all(
      [...byDay.entries()].map(([productionDayId, sceneIds]) =>
        apiRequest(`/api/role-room/projects/${projectId}/stripboard/reorder`, {
          method: 'POST',
          body: JSON.stringify({ productionDayId, sceneIds }),
        }),
      ),
    );
    return ordered;
  }

  /**
   * Flytter en scene til en dag, eller tilbake i «ikke planlagt» når dayId er
   * null. Backend gjør en upsert, så en scene som dras til en ny dag ikke
   * etterlater seg raden på den gamle.
   */
  async assignSceneToDay(sceneId: string, dayId: string | null): Promise<StripboardStrip | null> {
    const projectId = this.currentProjectId;
    if (!projectId) return null;

    const response = await apiRequest(
      `/api/role-room/projects/${projectId}/stripboard/assign`,
      { method: 'POST', body: JSON.stringify({ sceneId, productionDayId: dayId }) },
    );
    if (!response.ok) {
      throw new Error(
        (await response.json().catch(() => ({}))).error ?? 'Kunne ikke flytte scenen',
      );
    }

    const { entryId } = (await response.json()) as { entryId: string };
    const strip = this.stripboardCache.find(s => s.sceneId === sceneId);
    if (!strip) return null;

    const day = dayId ? this.shootingDaysCache.find(d => d.id === dayId) : null;
    strip.id = entryId;
    strip.shootingDayId = dayId || undefined;
    strip.dayNumber = day?.dayNumber;
    // Skutt og strøket overlever en flytting — de sier noe om scenen, ikke om
    // hvor den ligger i planen.
    if (strip.status !== 'shot' && strip.status !== 'omitted' && strip.status !== 'partial') {
      strip.status = dayId ? 'scheduled' : 'not-scheduled';
    }
    return strip;
  }

  /** Skutt-status på en scene (Del A punkt 87). */
  async setSceneShootStatus(
    sceneId: string,
    shootStatus: 'not_shot' | 'partial' | 'shot' | 'omitted',
    takeCount?: number,
  ): Promise<boolean> {
    const projectId = this.currentProjectId;
    if (!projectId) return false;

    const response = await apiRequest(
      `/api/role-room/projects/${projectId}/scenes/${sceneId}/shoot-status`,
      { method: 'PATCH', body: JSON.stringify({ shootStatus, takeCount }) },
    );
    if (!response.ok) return false;

    const strip = this.stripboardCache.find(s => s.sceneId === sceneId);
    if (strip) {
      strip.status = stripStatus(shootStatus, Boolean(strip.shootingDayId)) as StripboardStrip['status'];
    }
    return true;
  }

  // ============================================
  // CAST & CREW
  // ============================================

  /**
   * Medvirkende, utledet av scenene i basen.
   *
   * Gikk tidligere mot `/api/production/:projectId/cast`, som ikke finnes, og
   * falt tilbake på TROLL-skuespillere. I DOOD-matrisen ble de satt opp mot
   * brukerens egne scener — en matrise av ekte dager og oppdiktede folk.
   */
  async getCast(projectId: string): Promise<CastMember[]> {
    this.currentProjectId = projectId;
    const response = await apiRequest(`/api/role-room/projects/${projectId}/cast`);
    if (!response.ok) {
      throw new Error(`Kunne ikke hente medvirkende (HTTP ${response.status})`);
    }
    const { cast } = (await response.json()) as {
      cast: Array<{ id: string; name: string; character: string; scenes: string[] }>;
    };
    this.castCache = (cast ?? []).map((member) => ({
      id: member.id,
      name: member.name,
      character: member.character,
      scenes: member.scenes,
      phone: '',
      email: '',
      availability: {},
    })) as CastMember[];
    return this.castCache;
  }

  /**
   * Crew fra `casting_crew`.
   *
   * Ruta finnes fra før i role-room-routes.ts og svarer med radene direkte —
   * derfor snake_case-feltene her. Det gamle kallet gikk mot `/api/production`
   * og falt tilbake på TROLL-crewet.
   */
  async getCrew(projectId: string): Promise<CrewMember[]> {
    this.currentProjectId = projectId;
    const response = await apiRequest(`/api/role-room/projects/${projectId}/crew`);
    if (!response.ok) {
      throw new Error(`Kunne ikke hente crew (HTTP ${response.status})`);
    }
    const rows = (await response.json()) as any[];
    this.crewCache = (Array.isArray(rows) ? rows : []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      role: String(row.role ?? ''),
      department: String(row.department ?? ''),
      phone: String(row.phone ?? ''),
      email: String(row.email ?? ''),
      availability: row.availability ?? {},
      rate: row.rate === null || row.rate === undefined ? undefined : Number(row.rate),
      notes: row.notes ?? undefined,
    }));
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
  // LIVE SET
  // ============================================
  //
  // On-set-tilstanden lagres allerede: `useLiveSet` skriver en hendelseslogg
  // som synkroniseres offline-først via /live-set/events/batch. Denne
  // tjenesten skrev derimot bare til minnet, så alt forsvant ved en
  // oppfriskning. Mutatorene under sender nå til samme logg, med samme
  // vokabular, slik at de to live-set-skjermene ser samme virkelighet.

  private liveSetSessionId: string | null = null;
  private liveSetSeq = 1;
  private currentShootingDayId: string | null = null;

  /** Sesjonen opprettes ved første hendelse, ikke ved oppstart. */
  private async ensureLiveSetSession(projectId: string): Promise<string | null> {
    if (this.liveSetSessionId) return this.liveSetSessionId;
    const response = await apiRequest(`/api/role-room/projects/${projectId}/live-set/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        operatorId: 'production-workflow',
        deviceId: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : 'ukjent',
        shootingDayId: this.currentShootingDayId ?? undefined,
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { session?: { sessionId?: string } };
    this.liveSetSessionId = data.session?.sessionId ?? null;
    return this.liveSetSessionId;
  }

  /**
   * Sender én eller flere hendelser til loggen.
   *
   * `eventId` er idempotensnøkkelen på serversiden og må derfor være unik per
   * hendelse, ikke per batch.
   *
   * Feil logges og svelges. Det er en svakere garanti enn `useLiveSet`, som
   * køer i IndexedDB og prøver igjen — den skjermen er den som brukes på
   * settet, og den eneste med kallere til mutatorene under i dag.
   */
  private async emitLiveSetEvents(
    projectId: string,
    events: Array<{ type: string; payload?: Record<string, unknown> }>,
  ): Promise<void> {
    if (!projectId || events.length === 0) return;
    try {
      const sessionId = await this.ensureLiveSetSession(projectId);
      if (!sessionId) return;
      const capturedAt = new Date().toISOString();
      await apiRequest(`/api/role-room/projects/${projectId}/live-set/events/batch`, {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          events: events.map((event, index) => ({
            eventId: `pw-${sessionId}-${this.liveSetSeq + index}`,
            sessionId,
            seq: this.liveSetSeq + index,
            type: event.type,
            payload: event.payload ?? {},
            capturedAt,
            deviceId: 'production-workflow',
            operatorId: 'production-workflow',
            projectId,
            shootingDayId: this.currentShootingDayId ?? undefined,
          })),
        }),
      });
      this.liveSetSeq += events.length;
    } catch (error) {
      console.warn('Live-set-hendelse ikke synkronisert:', error);
    }
  }

  /**
   * Live-set-status: fremdrift fra stripboardet, øyeblikkstilstand fra loggen.
   *
   * Begge deler er nå ekte. Fremdriften regnes ut av scenene og skutt-status
   * (Del A punkt 73/84/87); øyeblikkstilstanden utledes av hendelsesloggen på
   * serversiden, av samme regler som klientens reducer. Tidligere sto den
   * halvdelen tom fordi ingen leste loggen — og før det falt hele objektet
   * tilbake på TROLL-demodata.
   */
  async getLiveSetStatus(projectId: string, shootingDayId?: string): Promise<LiveSetStatus> {
    this.currentProjectId = projectId;
    if (shootingDayId) this.currentShootingDayId = shootingDayId;

    const dayQuery = this.currentShootingDayId
      ? `?shootingDayId=${encodeURIComponent(this.currentShootingDayId)}`
      : '';
    const [progressRes, stateRes] = await Promise.all([
      apiRequest(`/api/role-room/projects/${projectId}/stripboard/progress`),
      apiRequest(`/api/role-room/projects/${projectId}/live-set/state${dayQuery}`),
    ]);
    if (!progressRes.ok) {
      throw new Error(`Kunne ikke hente fremdrift (HTTP ${progressRes.status})`);
    }
    const progress = (await progressRes.json()) as {
      scenesTotal: number; scenesShot: number; scenesPartial: number;
      scenesOmitted: number; eighthsTotal: number; eighthsShot: number;
    };

    // Loggen kan være tom på en dag som ikke har begynt. Det er ikke en feil.
    const projected = stateRes.ok
      ? ((await stateRes.json()) as { state?: LiveSetProjection }).state
      : undefined;

    const plannedScenes = Math.max(progress.scenesTotal - progress.scenesOmitted, 0);
    this.takes = (projected?.takes ?? []).map(toTake);

    this.liveSetStatus = {
      currentScene: projected?.currentSceneId ?? null,
      currentShot: projected?.currentShotId ?? null,
      currentTake: projected?.nextTakeNumber ?? 1,
      isRolling: projected?.liveState === 'rolling',
      lastAction: projected?.lastAction ?? '',
      lastActionTime: projected?.lastActionAt ?? '',
      todayTakes: this.takes,
      todayProgress: {
        // Strøkne scener er ikke planlagt arbeid.
        plannedScenes,
        completedScenes: progress.scenesShot,
        partialScenes: progress.scenesPartial,
        // Oppsett per scene registreres ikke som eget begrep ennå — scener er
        // nærmeste sannhet, og et oppdiktet oppsett-tall ville blitt lest som
        // målt.
        totalSetups: plannedScenes,
        completedSetups: progress.scenesShot,
        pagesPlanned: progress.eighthsTotal / 8,
        pagesShot: progress.eighthsShot / 8,
      },
    };
    return this.liveSetStatus;
  }

  /**
   * Kameraet ruller.
   *
   * Scenen sendes med som egen hendelse først: serverens utledning avviser
   * ROLL uten aktiv scene, akkurat som klientens reducer gjør. Uten
   * set_scene ville rullingen blitt stille forkastet.
   */
  async startRolling(sceneId: string, shotId: string): Promise<LiveSetStatus> {
    const now = new Date().toISOString();
    this.liveSetStatus = {
      ...this.liveSetStatus,
      currentScene: sceneId,
      currentShot: shotId,
      isRolling: true,
      lastAction: 'ROLLING',
      lastActionTime: now,
    };
    if (this.currentProjectId) {
      await this.emitLiveSetEvents(this.currentProjectId, [
        { type: 'set_scene', payload: { sceneId } },
        { type: 'roll' },
      ]);
    }
    return this.liveSetStatus;
  }

  /**
   * Log a cut. Accepts optional camera metadata (Pro tier) so that
   * multi-camera shots can record all camera units in one call.
   * `nextTake` overrides the auto-increment; pass the UI-controlled value
   * when `autoIncrement` is disabled.
   */
  async cut(
    status:           Take['status'],
    notes?:           string,
    cameraMetadata?:  CameraMetadata,
    additionalCameras?: CameraMetadata[],
    nextTake?:        number,
    loggedBy?:        string,
  ): Promise<Take> {
    const now = new Date().toISOString();
    const take: Take = {
      id:         `take-${Date.now()}`,
      sceneId:    this.liveSetStatus.currentScene!,
      shotId:     this.liveSetStatus.currentShot!,
      takeNumber: this.liveSetStatus.currentTake,
      status,
      // Varigheten måles på serversiden, mellom ROLL- og CUT-hendelsen. Her
      // står 0 til neste henting — tidligere sto det et tilfeldig tall, som
      // så ut som en måling i nettopp den loggen man leter etter målinger i.
      duration:   0,
      notes,
      recordedAt: now,
      loggedAt:   now,
      loggedBy,
      slate: `${this.liveSetStatus.currentScene?.replace('scene-', '')}-${this.liveSetStatus.currentTake}`,
      cameraId:           cameraMetadata?.cameraId  ?? 'A',
      camera:             cameraMetadata?.camera    ?? 'A-cam',
      lens:               cameraMetadata?.lens,
      fps:                cameraMetadata?.fps,
      iso:                cameraMetadata?.iso,
      ndFilter:           cameraMetadata?.ndFilter,
      additionalCameras,
    };

    this.takes.push(take);
    const resolvedNext = nextTake ?? (this.liveSetStatus.currentTake + 1);
    this.liveSetStatus = {
      ...this.liveSetStatus,
      currentTake: resolvedNext,
      isRolling:   false,
      lastAction:  `CUT - ${status.toUpperCase()}${notes ? `: ${notes}` : ''}`,
      lastActionTime: now,
      todayTakes: [...this.liveSetStatus.todayTakes, take],
    };

    if (this.currentProjectId) {
      const events: Array<{ type: string; payload?: Record<string, unknown> }> = [];
      // Kameradata er egen hendelse i vokabularet — den gjelder oppsettet,
      // ikke taken, og skal derfor gjelde videre til den endres.
      if (cameraMetadata) events.push({ type: 'set_camera', payload: { ...cameraMetadata } });
      events.push({ type: 'cut' });
      await this.emitLiveSetEvents(this.currentProjectId, events);
    }

    return take;
  }

  /**
   * Mark the current setup complete and advance to the next setup/scene.
   * Returns the new liveStatus (with updated currentScene/currentShot/currentTake=1).
   * TODO [Studio]: broadcast via WebSocket so all clients update.
   */
  async setupComplete(
    sceneId:  string,
    shotId:   string,
    userId:   string,
  ): Promise<LiveSetStatus> {
    const now = new Date().toISOString();
    // Mark current scene as partially/fully complete in progress
    this.liveSetStatus = {
      ...this.liveSetStatus,
      currentTake:    1,
      isRolling:      false,
      lastAction:     `SETUP COMPLETE — ${sceneId} / ${shotId} — av ${userId}`,
      lastActionTime: now,
      todayProgress:  {
        ...this.liveSetStatus.todayProgress,
        completedSetups: this.liveSetStatus.todayProgress.completedSetups + 1,
      },
    };
    if (this.currentProjectId) {
      await this.emitLiveSetEvents(this.currentProjectId, [{ type: 'setup_complete' }]);
    }
    return this.liveSetStatus;
  }

  /**
   * Advance to the next setup in the stripboard.
   * Finds the next un-shot scene/setup after `currentScene`.
   * TODO [Studio]: Wire to real stripboard order endpoint.
   */
  async nextSetup(shootingDayId: string): Promise<{ sceneId: string; shotId: string } | null> {
    this.currentShootingDayId = shootingDayId;
    const day = this.shootingDaysCache.find(d => d.id === shootingDayId);
    if (!day) return null;
    const idx = day.scenes.indexOf(this.liveSetStatus.currentScene ?? '');
    const nextScene = day.scenes[idx + 1] ?? null;
    if (!nextScene) return null;
    const nextShotId = `${nextScene}-shot-1`;
    this.liveSetStatus = {
      ...this.liveSetStatus,
      currentScene:   nextScene,
      currentShot:    nextShotId,
      currentTake:    1,
      lastAction:     'NEXT SETUP',
      lastActionTime: new Date().toISOString(),
    };
    if (this.currentProjectId) {
      // advance_scene nullstiller opptakstilstanden, set_scene peker på den
      // nye. Rekkefølgen er viktig: motsatt vei ville nullstillingen slettet
      // scenen som nettopp ble satt.
      await this.emitLiveSetEvents(this.currentProjectId, [
        { type: 'advance_scene' },
        { type: 'set_scene', payload: { sceneId: nextScene } },
      ]);
    }
    return { sceneId: nextScene, shotId: nextShotId };
  }

  /** Dagens takes fra loggen. Henter på nytt så en annen enhets takes er med. */
  async getTodayTakes(shootingDayId: string): Promise<Take[]> {
    this.currentShootingDayId = shootingDayId;
    if (!this.currentProjectId) return [];
    await this.getLiveSetStatus(this.currentProjectId, shootingDayId);
    return this.takes;
  }

  async circleTake(takeId: string, circledBy: string): Promise<Take | null> {
    const take = this.takes.find(t => t.id === takeId);
    if (!take) return null;
    take.status = 'circle';
    take.circledBy = circledBy;
    if (this.currentProjectId) {
      // Id-en er projeksjonens («take:<eventId>»), som utledningen kjenner
      // igjen — sirklingen blir derfor synlig også på den andre skjermen.
      await this.emitLiveSetEvents(this.currentProjectId, [
        { type: 'set_take_status', payload: { id: takeId, status: 'circle' } },
      ]);
    }
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
