import { CastingProject, Candidate, Role, Prop, Location, CrewMember, Schedule, ProductionDay, ShotList, CastingShot } from '../models/casting';
import settingsService, { getCurrentUserId } from '../services/settingsService';

const PHOTO_BASE_PATH = '/attached_assets';

export const mockCandidates: Candidate[] = [
  {
    id: 'candidate-1',
    name: 'Emma Nordmann',
    contactInfo: {
      email: 'emma@example.com',
      phone: '+47 123 45 678',
    },
    photos: [`${PHOTO_BASE_PATH}/generated_images/professional_female_headshot_portrait.png`],
    videos: [],
    auditionNotes: 'Erfaren modell, god med lys',
    status: 'confirmed',
    assignedRoles: ['role-1'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'candidate-2', 
    name: 'Lars Hansen',
    contactInfo: {
      email: 'lars@example.com',
      phone: '+47 987 65 432',
    },
    photos: [`${PHOTO_BASE_PATH}/generated_images/professional_male_headshot_portrait.png`],
    videos: [],
    auditionNotes: 'Profesjonell skuespiller',
    status: 'confirmed',
    assignedRoles: ['role-2'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'candidate-3',
    name: 'Sofia Berg',
    contactInfo: {
      email: 'sofia@example.com',
    },
    photos: [`${PHOTO_BASE_PATH}/generated_images/young_female_casting_headshot.png`],
    videos: [],
    auditionNotes: 'Dyktig foran kamera',
    status: 'shortlist',
    assignedRoles: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Campfire Card Game - 4 unique male players with 3D avatars and personalities
export const campfireCandidates: Candidate[] = [
  {
    id: 'campfire-player-1',
    name: 'Erik Solberg',
    contactInfo: {
      email: 'erik.solberg@example.com',
      phone: '+47 411 22 333',
    },
    photos: [],
    videos: [],
    modelUrl: '/models/avatars/campfire/erik_calm.glb',
    personality: 'calm',
    auditionNotes: 'Avslappet uttrykk, god på naturlige scener. Rolig personlighet.',
    status: 'confirmed',
    assignedRoles: ['campfire-role-1'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'campfire-player-2',
    name: 'Jonas Bakken',
    contactInfo: {
      email: 'jonas.bakken@example.com',
      phone: '+47 422 33 444',
    },
    photos: [],
    videos: [],
    modelUrl: '/models/avatars/campfire/jonas_energetic.glb',
    personality: 'energetic',
    auditionNotes: 'Uttrykksfull, god på samspill. Energisk og utadvendt.',
    status: 'confirmed',
    assignedRoles: ['campfire-role-2'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'campfire-player-3',
    name: 'Magnus Vik',
    contactInfo: {
      email: 'magnus.vik@example.com',
      phone: '+47 433 44 555',
    },
    photos: [],
    videos: [],
    modelUrl: '/models/avatars/campfire/magnus_mysterious.glb',
    personality: 'mysterious',
    auditionNotes: 'Naturlig foran kamera, spontan. Mystisk og observant.',
    status: 'confirmed',
    assignedRoles: ['campfire-role-3'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'campfire-player-4',
    name: 'Kristoffer Haugen',
    contactInfo: {
      email: 'kristoffer.haugen@example.com',
      phone: '+47 444 55 666',
    },
    photos: [],
    videos: [],
    modelUrl: '/models/avatars/campfire/kristoffer_wise.glb',
    personality: 'wise',
    auditionNotes: 'Erfaren, rolig tilstedeværelse. Vis og reflektert.',
    status: 'confirmed',
    assignedRoles: ['campfire-role-4'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const campfireRoles: Role[] = [
  {
    id: 'campfire-role-1',
    name: 'Spiller 1 - Dealer',
    description: 'Hovedperson som deler ut kort',
    requirements: {
      skills: ['Kortspill-erfaring', 'Naturlig bevegelse'],
    },
    status: 'filled',
  },
  {
    id: 'campfire-role-2',
    name: 'Spiller 2 - Vinner',
    description: 'Den som vinner runden',
    requirements: {
      skills: ['Uttrykksfull', 'Reagerer naturlig'],
    },
    status: 'filled',
  },
  {
    id: 'campfire-role-3',
    name: 'Spiller 3 - Skeptiker',
    description: 'Mistenksom spiller som studerer de andre',
    requirements: {
      skills: ['Intens blikk', 'Subtil acting'],
    },
    status: 'filled',
  },
  {
    id: 'campfire-role-4',
    name: 'Spiller 4 - Nybegynner',
    description: 'Usikker spiller som lærer spillet',
    requirements: {
      skills: ['Sårbar uttrykk', 'Nysgjerrig'],
    },
    status: 'filled',
  },
];

export const campfireProps: Prop[] = [
  {
    id: 'hexagon-table',
    name: 'Heksagonbord',
    category: 'furniture',
    description: 'Rustikt sekskantet trebord for kortspill',
    modelUrl: '/models/props/hexagon_table.glb',
    availability: {},
    assignedScenes: ['campfire-scene-1'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'campfire',
    name: 'Bålpanne',
    category: 'lighting',
    description: 'Metallbålpanne med ild for atmosfærisk belysning',
    modelUrl: '/models/props/campfire.glb',
    availability: {},
    assignedScenes: ['campfire-scene-1'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'playing-cards',
    name: 'Kortstokk',
    category: 'props',
    description: 'Klassisk kortstokk med poker-kort',
    modelUrl: '/models/props/playing_cards.glb',
    availability: {},
    assignedScenes: ['campfire-scene-1'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'poker-chips',
    name: 'Pokersjetonger',
    category: 'props',
    description: 'Sett med fargerike pokersjetonger',
    modelUrl: '/models/props/poker_chips.glb',
    availability: {},
    assignedScenes: ['campfire-scene-1'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'wooden-stools',
    name: 'Trekrakker (4 stk)',
    category: 'furniture',
    description: 'Rustikke trekrakker rundt bordet',
    modelUrl: '/models/props/wooden_stool.glb',
    availability: {},
    assignedScenes: ['campfire-scene-1'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lanterns',
    name: 'Oljelykter',
    category: 'lighting',
    description: 'Gamle oljelykter for tilleggsbelysning',
    modelUrl: '/models/props/oil_lantern.glb',
    availability: {},
    assignedScenes: ['campfire-scene-1'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const campfireLocation: Location = {
  id: 'loc-campfire',
  name: 'Utendørs Bålplass',
  address: 'Skogshytta, Nordmarka',
  type: 'outdoor',
  availability: {},
  assignedScenes: ['campfire-scene-1'],
  notes: 'Kveldsfotografering ved bål, varm atmosfære',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Production Team / Crew for Campfire Project
export const campfireCrew: CrewMember[] = [
  {
    id: 'crew-daniel',
    name: 'Daniel Qazi',
    role: 'director',
    contactInfo: {
      email: 'daniel.qazi@creatorhub.no',
    },
    availability: {},
    assignedScenes: [],
    notes: 'Regissør og kreativ leder',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'crew-michael',
    name: 'Michael Peters Nielsen',
    role: 'camera_operator',
    contactInfo: {
      email: 'michael.nielsen@creatorhub.no',
    },
    availability: {},
    assignedScenes: [],
    notes: 'Cinematograf og kameraoperatør',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'crew-emil',
    name: 'Emil Nicolai Nielsen',
    role: 'gaffer',
    contactInfo: {
      email: 'emil.nielsen@creatorhub.no',
    },
    availability: {},
    assignedScenes: [],
    notes: 'Lysdesign og gaffer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'crew-martin',
    name: 'Martin Schaal Mortensen',
    role: 'producer',
    contactInfo: {
      email: 'martin.mortensen@creatorhub.no',
    },
    availability: {},
    assignedScenes: [],
    notes: 'Produsent og prosjektleder',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const campfireBannerConfig = {
  text: 'BÅLKVELD KORTSPILL',
  options: {
    position: { x: 0, y: 4.5, z: -3 },
    width: 7,
    height: 1.8,
    color: '#1a1a2e',
    glowColor: '#ff6b35',
    animationSpeed: 1.2,
    waveAmplitude: 0.06,
  }
};

export const mockRoles: Role[] = [
  {
    id: 'role-1',
    name: 'Hovedkarakter',
    description: 'Protagonisten i fotoserien',
    requirements: {
      skills: ['Erfaring med portrettfotografering', 'God tilstedeværelse'],
    },
    status: 'filled',
  },
  {
    id: 'role-2',
    name: 'Støttekarakter',
    description: 'Sekundær rolle i produksjonen',
    requirements: {
      skills: ['Fleksibel', 'Teamspiller'],
    },
    status: 'filled',
  },
  {
    id: 'role-3',
    name: 'Ekstra',
    description: 'Bakgrunnsrolle',
    requirements: {
      skills: ['Punktlig'],
    },
    status: 'open',
  },
];

export const mockProps: Prop[] = [
  {
    id: 'chair-vintage',
    name: 'Vintage Stol',
    category: 'furniture',
    description: 'Klassisk trekkstol for portrettfotografering',
    availability: {},
    assignedScenes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'avatar-athlete',
    name: 'Atletisk Avatar',
    category: 'decoration',
    description: '3D modell av atlet for sportsfotografering',
    modelUrl: '/models/avatars/avatar_athlete.glb',
    availability: {},
    assignedScenes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'avatar-dancer',
    name: 'Danser Avatar',
    category: 'decoration',
    description: '3D modell av danser for bevegelsesbilder',
    modelUrl: '/models/avatars/avatar_dancer.glb',
    availability: {},
    assignedScenes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'avatar-elderly',
    name: 'Eldre Avatar',
    category: 'decoration',
    description: '3D modell av eldre person for portrettfotografering',
    modelUrl: '/models/avatars/avatar_elderly.glb',
    availability: {},
    assignedScenes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const mockLocations: Location[] = [
  {
    id: 'loc-1',
    name: 'Hovedstudio',
    address: 'Storgata 1, Oslo',
    type: 'studio',
    coordinates: { lat: 59.9139, lng: 10.7522 },
    propertyId: '301/1/1',
    availability: {},
    assignedScenes: [],
    notes: 'Stort studio med høyt tak, profesjonell belysning og greenscreen',
    facilities: ['parking', 'wifi', 'power', 'dressing_rooms', 'makeup_area', 'catering', 'loading_dock'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'loc-2',
    name: 'Fjordutsikt - Aker Brygge',
    address: 'Stranden 3, Oslo',
    type: 'outdoor',
    coordinates: { lat: 59.9087, lng: 10.7269 },
    propertyId: '301/15/42',
    availability: {},
    assignedScenes: [],
    notes: 'Spektakulær utsikt over Oslofjorden. Ideell for portrettfoto ved solnedgang.',
    facilities: ['parking', 'restrooms', 'cafe_nearby'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'loc-3',
    name: 'Historisk Villa - Frogner',
    address: 'Frognerveien 45, Oslo',
    type: 'indoor',
    coordinates: { lat: 59.9223, lng: 10.7034 },
    propertyId: '301/28/16',
    availability: {},
    assignedScenes: [],
    notes: 'Vakker villa fra 1890-tallet med originale interiører. Perfekt for periode-produksjoner.',
    facilities: ['parking', 'power', 'dressing_rooms', 'garden'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'loc-4',
    name: 'Industrihall - Nydalen',
    address: 'Gullhaug Torg 5, Oslo',
    type: 'indoor',
    coordinates: { lat: 59.9502, lng: 10.7658 },
    propertyId: '301/112/8',
    availability: {},
    assignedScenes: [],
    notes: 'Rå industriell estetikk. 800 kvm med 6m takhøyde. Mulighet for bilinnkjøring.',
    facilities: ['parking', 'power', 'loading_dock', 'wifi', 'high_ceiling'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Mock Schedules (Auditions/Calendar)
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const nextWeek = new Date();
nextWeek.setDate(nextWeek.getDate() + 7);
const in2Weeks = new Date();
in2Weeks.setDate(in2Weeks.getDate() + 14);

export const mockSchedules: Schedule[] = [
  {
    id: 'schedule-1',
    candidateId: 'candidate-1',
    roleId: 'role-1',
    date: tomorrow.toISOString().split('T')[0],
    time: '10:00',
    location: 'Hovedstudio',
    notes: 'Første audition - portrettfoto',
    status: 'scheduled',
  },
  {
    id: 'schedule-2',
    candidateId: 'candidate-2',
    roleId: 'role-2',
    date: tomorrow.toISOString().split('T')[0],
    time: '14:00',
    location: 'Hovedstudio',
    notes: 'Callback - dramatisk lyssetting',
    status: 'scheduled',
  },
  {
    id: 'schedule-3',
    candidateId: 'candidate-3',
    roleId: 'role-1',
    date: nextWeek.toISOString().split('T')[0],
    time: '11:00',
    location: 'Hovedstudio',
    notes: 'Screen test',
    status: 'scheduled',
  },
];

export const campfireSchedules: Schedule[] = [
  {
    id: 'campfire-schedule-1',
    candidateId: 'campfire-player-1',
    roleId: 'campfire-role-1',
    date: tomorrow.toISOString().split('T')[0],
    time: '18:00',
    location: 'Utendørs lokasjon',
    notes: 'Bålscene - kveldslys',
    status: 'scheduled',
  },
  {
    id: 'campfire-schedule-2',
    candidateId: 'campfire-player-2',
    roleId: 'campfire-role-2',
    date: tomorrow.toISOString().split('T')[0],
    time: '18:00',
    location: 'Utendørs lokasjon',
    notes: 'Bålscene - kveldslys',
    status: 'scheduled',
  },
  {
    id: 'campfire-schedule-3',
    candidateId: 'campfire-player-3',
    roleId: 'campfire-role-3',
    date: nextWeek.toISOString().split('T')[0],
    time: '19:00',
    location: 'Utendørs lokasjon',
    notes: 'Oppfølging - kortspillscene',
    status: 'scheduled',
  },
];

// Mock Production Days (Produksjonskalender)
export const mockProductionDays: ProductionDay[] = [
  {
    id: 'prod-day-1',
    projectId: 'project-demo-1',
    date: nextWeek.toISOString().split('T')[0],
    callTime: '08:00',
    wrapTime: '18:00',
    locationId: 'loc-1',
    scenes: ['scene-1', 'scene-2'],
    crew: ['studio-crew-daniel', 'studio-crew-michael', 'studio-crew-emil', 'studio-crew-martin'],
    props: ['chair-vintage'],
    notes: 'Første opptaksdag - portrettserie. Rembrandt og Butterfly lyssetting.',
    status: 'planned',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod-day-2',
    projectId: 'project-demo-1',
    date: in2Weeks.toISOString().split('T')[0],
    callTime: '09:00',
    wrapTime: '17:00',
    locationId: 'loc-1',
    scenes: ['scene-3'],
    crew: ['studio-crew-daniel', 'studio-crew-michael', 'studio-crew-emil'],
    props: [],
    notes: 'Andre opptaksdag - Hollywood Noir lyssetting.',
    status: 'planned',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const campfireProductionDays: ProductionDay[] = [
  {
    id: 'campfire-prod-day-1',
    projectId: 'project-campfire-cards',
    date: nextWeek.toISOString().split('T')[0],
    callTime: '16:00',
    wrapTime: '23:00',
    locationId: 'campfire-location',
    scenes: ['campfire-scene-1'],
    crew: ['crew-daniel', 'crew-michael', 'crew-emil', 'crew-martin'],
    props: ['campfire-table', 'campfire-cards', 'campfire-fire', 'campfire-lanterns'],
    notes: 'Bålkveld opptak - venter på solnedgang kl 19:00. Alle 4 spillere til stede.',
    status: 'planned',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Mock Shot Lists
export const mockShots: CastingShot[] = [
  {
    id: 'shot-1',
    shotType: 'Close-up',
    cameraAngle: 'Eye Level',
    cameraMovement: 'Static',
    focalLength: 85,
    description: 'Portrett - nært ansikt med Rembrandt lys',
    roleId: 'role-1',
    sceneId: 'scene-1',
    duration: 10,
    notes: 'Fokus på øyne, myk bakgrunn',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'shot-2',
    shotType: 'Medium',
    cameraAngle: 'Eye Level',
    cameraMovement: 'Static',
    focalLength: 50,
    description: 'Halvfigur - klassisk portrett',
    roleId: 'role-1',
    sceneId: 'scene-1',
    duration: 15,
    notes: 'Inkluder skuldre og hender',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'shot-3',
    shotType: 'Wide',
    cameraAngle: 'Low Angle',
    cameraMovement: 'Dolly',
    focalLength: 35,
    description: 'Establishing shot - dramatisk lyssetting',
    roleId: 'role-2',
    sceneId: 'scene-2',
    duration: 20,
    notes: 'Hollywood Noir stil',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const mockShotLists: ShotList[] = [
  {
    id: 'shotlist-1',
    projectId: 'project-demo-1',
    sceneId: 'scene-1',
    shots: mockShots.slice(0, 2),
    cameraSettings: {
      focalLength: 85,
      aperture: 2.8,
      iso: 100,
      shutter: 125,
    },
    equipment: ['Aputure 300D', 'Softbox 120cm', 'Reflektor'],
    notes: 'Portrettserie - naturlig lys med fill',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'shotlist-2',
    projectId: 'project-demo-1',
    sceneId: 'scene-2',
    shots: [mockShots[2]],
    cameraSettings: {
      focalLength: 35,
      aperture: 4.0,
      iso: 400,
      shutter: 60,
    },
    equipment: ['Aputure 300D x2', 'Barndoors', 'Hazer'],
    notes: 'Dramatisk Hollywood Noir',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const campfireShots: CastingShot[] = [
  {
    id: 'campfire-shot-1',
    shotType: 'Wide',
    cameraAngle: 'Eye Level',
    cameraMovement: 'Static',
    focalLength: 24,
    description: 'Establishing - alle 4 spillere rundt bordet',
    roleId: 'campfire-role-1',
    sceneId: 'campfire-scene-1',
    duration: 30,
    notes: 'Bål i forgrunnen, spillere i bakgrunnen',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'campfire-shot-2',
    shotType: 'Medium',
    cameraAngle: 'Dutch Angle',
    cameraMovement: 'Pan',
    focalLength: 50,
    description: 'Over skulder - dealer gir ut kort',
    roleId: 'campfire-role-1',
    sceneId: 'campfire-scene-1',
    duration: 15,
    notes: 'Fokus på hender og kort',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'campfire-shot-3',
    shotType: 'Close-up',
    cameraAngle: 'High Angle',
    cameraMovement: 'Static',
    focalLength: 85,
    description: 'Insert - kortene på bordet',
    roleId: 'campfire-role-1',
    sceneId: 'campfire-scene-1',
    duration: 5,
    notes: 'Detaljbilde av spillkort',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'campfire-shot-4',
    shotType: 'Medium',
    cameraAngle: 'Eye Level',
    cameraMovement: 'Static',
    focalLength: 50,
    description: 'Reaksjoner - spillere ser på kort',
    roleId: 'campfire-role-2',
    sceneId: 'campfire-scene-1',
    duration: 20,
    notes: 'Naturlige ansiktsuttrykk',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const campfireShotLists: ShotList[] = [
  {
    id: 'campfire-shotlist-1',
    projectId: 'project-campfire-cards',
    sceneId: 'campfire-scene-1',
    shots: campfireShots,
    cameraSettings: {
      focalLength: 50,
      aperture: 1.8,
      iso: 800,
      shutter: 50,
    },
    equipment: ['Aputure 300D (varm gel)', 'Praktisk bål', 'LED lykter', 'Reflektor gull'],
    notes: 'Kveldslys - varm fargetemperatur 2700K. Bål som hovedlys.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const campfireProject: CastingProject = {
  id: 'project-campfire-cards',
  name: 'Bålkveld Kortspill',
  description: '4 personer rundt et heksagonbord ved bålet, spiller kort i kveldslys',
  roles: campfireRoles,
  candidates: campfireCandidates,
  schedules: campfireSchedules,
  crew: campfireCrew,
  locations: [campfireLocation],
  props: campfireProps,
  productionDays: campfireProductionDays,
  shotLists: campfireShotLists,
  userRoles: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Crew for Studio Portrett project
export const studioCrew: CrewMember[] = [
  {
    id: 'studio-crew-daniel',
    name: 'Daniel Qazi',
    role: 'director',
    contactInfo: { email: 'daniel.qazi@creatorhub.no' },
    availability: {},
    assignedScenes: [],
    notes: 'Regissør og kreativ leder',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'studio-crew-michael',
    name: 'Michael Peters Nielsen',
    role: 'camera_operator',
    contactInfo: { email: 'michael.nielsen@creatorhub.no' },
    availability: {},
    assignedScenes: [],
    notes: 'Cinematograf og kameraoperatør',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'studio-crew-emil',
    name: 'Emil Nicolai Nielsen',
    role: 'gaffer',
    contactInfo: { email: 'emil.nielsen@creatorhub.no' },
    availability: {},
    assignedScenes: [],
    notes: 'Lysdesign og gaffer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'studio-crew-martin',
    name: 'Martin Schaal Mortensen',
    role: 'producer',
    contactInfo: { email: 'martin.mortensen@creatorhub.no' },
    availability: {},
    assignedScenes: [],
    notes: 'Produsent og prosjektleder',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const mockProject: CastingProject = {
  id: 'project-demo-1',
  name: 'Studio Portrett Serie',
  description: 'Profesjonell portrettserie med Hollywood-lyssetting',
  roles: mockRoles,
  candidates: mockCandidates,
  schedules: mockSchedules,
  crew: studioCrew,
  locations: mockLocations,
  props: mockProps,
  productionDays: mockProductionDays,
  shotLists: mockShotLists,
  userRoles: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const CASTING_STORAGE_KEY = 'virtualStudio_castingProjects';

export function loadMockCastingData(): void {
  void settingsService.getSetting<CastingProject[]>(CASTING_STORAGE_KEY, { userId: getCurrentUserId() })
    .then((existingProjects) => {
      if (!existingProjects || existingProjects.length === 0) {
        void settingsService.setSetting(CASTING_STORAGE_KEY, [mockProject, campfireProject], { userId: getCurrentUserId() });
        console.log('Mock casting data loaded successfully (2 projects)');
      }
    });
}

export function resetMockCastingData(): void {
  void settingsService.setSetting(CASTING_STORAGE_KEY, [mockProject, campfireProject], { userId: getCurrentUserId() });
  console.log('Mock casting data reset (2 projects)');
}
