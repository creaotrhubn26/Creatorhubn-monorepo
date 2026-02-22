/**
 * stripboard.mockData.ts
 * Fallback / demo data used when the API returns nothing.
 * Keeping this separate means the main bundle can tree-shake it in production
 * and the component file itself stays readable.
 *
 * Exports:
 *   DEMO_SHOOTING_DAYS  – legacy ShootingDay[] fed to useStripboardData
 *   DEMO_STRIPS         – legacy StripboardStrip[] fed to useStripboardData
 *   DEMO_POOL_ITEMS     – ScenePoolItem[] for the new Scene Pool
 *   DEMO_SHOOT_DAYS     – ShootDay[] for the new ShootDay Engine
 */

import type { StripboardStrip, ShootingDay } from '../../services/productionWorkflowService';
import type { ScenePoolItem, ShootDay } from './stripboard.types';
import { deriveStripColor } from './useScenePool';

export const DEMO_SHOOTING_DAYS: ShootingDay[] = [
  {
    id: 'day-1', projectId: 'demo', dayNumber: 1,
    date: '2026-02-01', location: 'DOVRE - TUNNEL', callTime: '06:00',
    status: 'wrapped', notes: '', scenes: ['scene-1', 'scene-2'],
    crewCallTimes: {}, castCallTimes: {}, equipmentNeeded: [], meals: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'day-2', projectId: 'demo', dayNumber: 2,
    date: '2026-02-02', location: 'DOVRE - FJELLET', callTime: '05:00',
    status: 'wrapped', notes: '', scenes: ['scene-3'],
    crewCallTimes: {}, castCallTimes: {}, equipmentNeeded: [], meals: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'day-3', projectId: 'demo', dayNumber: 3,
    date: '2026-02-03', location: 'OSLO - STUDIO', callTime: '08:00',
    status: 'planned', notes: '', scenes: ['scene-4'],
    crewCallTimes: {}, castCallTimes: {}, equipmentNeeded: [], meals: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'day-4', projectId: 'demo', dayNumber: 4,
    date: '2026-02-04', location: 'UiO - KONTOR', callTime: '09:00',
    status: 'planned', notes: '', scenes: ['scene-5'],
    crewCallTimes: {}, castCallTimes: {}, equipmentNeeded: [], meals: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'day-5', projectId: 'demo', dayNumber: 5,
    date: '2026-02-05', location: 'DOVRE - RUINER', callTime: '06:00',
    status: 'planned', notes: '', scenes: ['scene-6'],
    crewCallTimes: {}, castCallTimes: {}, equipmentNeeded: [], meals: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

export const DEMO_STRIPS: StripboardStrip[] = [
  { id: 'strip-1', sceneId: 'scene-1', sceneNumber: '1', shootingDayId: 'day-1', dayNumber: 1, sortOrder: 1, color: '#1a237e', location: 'DOVRE - TUNNEL',          pages: 3,   cast: ['ARBEIDER 1', 'ARBEIDER 2', 'FORMANN'],               status: 'shot',          estimatedTime: 180 },
  { id: 'strip-2', sceneId: 'scene-2', sceneNumber: '2', shootingDayId: 'day-1', dayNumber: 1, sortOrder: 2, color: '#9c27b0', location: 'HULEN - INNE I FJELLET', pages: 2.5, cast: ['ARBEIDER 1', 'ARBEIDER 2'],                          status: 'shot',          estimatedTime: 120 },
  { id: 'strip-3', sceneId: 'scene-3', sceneNumber: '3', shootingDayId: 'day-2', dayNumber: 2, sortOrder: 1, color: '#1a237e', location: 'DOVRE - FJELLET',          pages: 4,   cast: ['NORA TIDEMANN', 'ANDREAS'],                         status: 'shot',          estimatedTime: 240 },
  { id: 'strip-4', sceneId: 'scene-4', sceneNumber: '4', shootingDayId: 'day-3', dayNumber: 3, sortOrder: 1, color: '#fff9c4', location: 'NORAS LEILIGHET',          pages: 2,   cast: ['NORA TIDEMANN'],                                    status: 'scheduled',     estimatedTime: 120 },
  { id: 'strip-5', sceneId: 'scene-5', sceneNumber: '5', shootingDayId: 'day-4', dayNumber: 4, sortOrder: 1, color: '#fff9c4', location: 'UiO - KONTOR',             pages: 4,   cast: ['NORA TIDEMANN', 'ANDREAS', 'GENERAL LUND'],         status: 'scheduled',     estimatedTime: 240 },
  { id: 'strip-6', sceneId: 'scene-6', sceneNumber: '6', shootingDayId: 'day-5', dayNumber: 5, sortOrder: 1, color: '#e3f2fd', location: 'DOVRE - RUINER',           pages: 3,   cast: ['NORA TIDEMANN', 'ANDREAS', 'SOLDATER'],             status: 'scheduled',     estimatedTime: 180, notes: 'Helikopter-koordinering' },
  { id: 'strip-7', sceneId: 'scene-7', sceneNumber: '7', shootingDayId: undefined, dayNumber: undefined, sortOrder: 7, color: '#ffccbc', location: 'DOVRE - SOLOPPGANG', pages: 2, cast: ['NORA TIDEMANN'],                                 status: 'not-scheduled', estimatedTime: 90  },
  { id: 'strip-8', sceneId: 'scene-8', sceneNumber: '8', shootingDayId: undefined, dayNumber: undefined, sortOrder: 8, color: '#bf5530', location: 'OSLO - PARK',    pages: 1.5, cast: ['ANDREAS', 'NORA TIDEMANN'],                        status: 'not-scheduled', estimatedTime: 60  },
];

// ─── Scene Pool demo data (new engine) ───────────────────────────────────────

const _ts = new Date().toISOString();

/**
 * DEMO_POOL_ITEMS – unscheduled scene pool for the ShootDay Engine.
 * Mix of INT/EXT × DAY/NIGHT to exercise all colour slots.
 * Scenes 7 and 8 are already "unscheduled" in the legacy DEMO_STRIPS too,
 * so their IDs are reused for cross-reference.
 */
export const DEMO_POOL_ITEMS: ScenePoolItem[] = [
  {
    id: 'scene-7', sceneNumber: '7',
    title: 'EXT. DOVRE - SOLOPPGANG',
    synopsis: 'Nora ser opp mot fjellet mens solen stiger.',
    pageCount: 2, location: 'DOVRE - SOLOPPGANG',
    intExtType: 'EXT', timeOfDay: 'DAWN',
    cast: ['NORA TIDEMANN'],
    specialRequirements: ['GOLDEN_HOUR'],
    estimatedMinutes: 90,
    color: deriveStripColor('EXT', 'DAWN'),
    notes: 'Kun tilgjengelig 05:45–06:30.',
    addedAt: _ts,
  },
  {
    id: 'scene-8', sceneNumber: '8',
    title: 'EXT. OSLO - PARK',
    synopsis: 'Andreas og Nora krangler ved fontenen.',
    pageCount: 1.5, location: 'OSLO - PARK',
    intExtType: 'EXT', timeOfDay: 'DAY',
    cast: ['ANDREAS', 'NORA TIDEMANN'],
    specialRequirements: [],
    estimatedMinutes: 60,
    color: deriveStripColor('EXT', 'DAY'),
    addedAt: _ts,
  },
  {
    id: 'scene-9', sceneNumber: '9',
    title: 'INT. REGJERINGENS BUNKER',
    synopsis: 'Lund tar avgjørelsen som koster ham karrieren.',
    pageCount: 3, location: 'OSLO - BUNKER',
    intExtType: 'INT', timeOfDay: 'NIGHT',
    cast: ['GENERAL LUND', 'STATSMINISTEREN', 'RÅDGIVER'],
    specialRequirements: ['CLASSIFIED_LOCATION', 'VFX_SCREENS'],
    estimatedMinutes: 180,
    color: deriveStripColor('INT', 'NIGHT'),
    notes: 'Behøver 3 VFX-skjermer i bakgrunn.',
    addedAt: _ts,
  },
  {
    id: 'scene-10', sceneNumber: '10',
    title: 'INT/EXT. HELIKOPTER - OVER DOVRE',
    synopsis: 'Luftbilde av trollet som krysser elven.',
    pageCount: 4, location: 'DOVRE - LUFTROM',
    intExtType: 'INT/EXT', timeOfDay: 'DAY',
    cast: ['PILOT', 'NORA TIDEMANN'],
    specialRequirements: ['HELIKOPTER', 'VFX_TROLL', 'STUNT'],
    estimatedMinutes: 300,
    color: deriveStripColor('INT/EXT', 'DAY'),
    notes: 'Koordiner med Forsvaret. 2-dagers vindu.',
    addedAt: _ts,
  },
  {
    id: 'scene-11', sceneNumber: '11',
    title: 'INT. NORAS LEILIGHET - NATT',
    synopsis: 'Nora finner notisene til faren. Vendepunkt.',
    pageCount: 2.5, location: 'NORAS LEILIGHET',
    intExtType: 'INT', timeOfDay: 'NIGHT',
    cast: ['NORA TIDEMANN'],
    specialRequirements: ['CANDLE_RIG'],
    estimatedMinutes: 150,
    color: deriveStripColor('INT', 'NIGHT'),
    addedAt: _ts,
  },
  {
    id: 'scene-12', sceneNumber: '12',
    title: 'EXT. DOVRE - SKUMRING',
    synopsis: 'Siste solnedgang før trollangrep.',
    pageCount: 1, location: 'DOVRE - FJELLET',
    intExtType: 'EXT', timeOfDay: 'DUSK',
    cast: ['NORA TIDEMANN', 'ANDREAS'],
    specialRequirements: ['PYRO'],
    estimatedMinutes: 75,
    color: deriveStripColor('EXT', 'DUSK'),
    notes: 'Pyroteknikk – samordne med sikkerhetsansvarlig.',
    addedAt: _ts,
  },
  {
    id: 'scene-13', sceneNumber: '13',
    title: 'INT. UiO - LABORATORIUM',
    synopsis: 'Andreas analyserer beinprøven.',
    pageCount: 2, location: 'UiO - LAB',
    intExtType: 'INT', timeOfDay: 'DAY',
    cast: ['ANDREAS', 'LAB-ASSISTENT'],
    specialRequirements: ['ANIMAL_BONE_PROP'],
    estimatedMinutes: 120,
    color: deriveStripColor('INT', 'DAY'),
    addedAt: _ts,
  },
  {
    id: 'scene-14', sceneNumber: '14',
    title: 'EXT. OSLO - SOLNEDGANG',
    synopsis: 'Nora forlater Oslo for siste gang.',
    pageCount: 0.5, location: 'OSLO - AKER BRYGGE',
    intExtType: 'EXT', timeOfDay: 'DUSK',
    cast: ['NORA TIDEMANN'],
    specialRequirements: [],
    estimatedMinutes: 45,
    color: deriveStripColor('EXT', 'DUSK'),
    addedAt: _ts,
  },
];

// ─── ShootDay Engine demo data ────────────────────────────────────────────────

/**
 * DEMO_SHOOT_DAYS – two A-unit days and one B-unit day.
 * Strips reference DEMO_POOL_ITEMS by id.
 * Scenes 1–6 (already in legacy DEMO_STRIPS as "scheduled" / "shot") are
 * intentionally absent from the pool so the pool shows only truly
 * unscheduled scenes.
 */
export const DEMO_SHOOT_DAYS: ShootDay[] = [
  {
    id: 'sde-day-1', projectId: 'demo', dayNumber: 1,
    date: '2026-03-10', unit: 'A',
    callTime: '06:00', location: 'DOVRE - FJELLET',
    strips: [
      { stripId: 'sde-strip-1', scenePoolItemId: 'scene-10', sortOrder: 0 },
      { stripId: 'sde-strip-2', scenePoolItemId: 'scene-12', sortOrder: 1 },
    ],
    notes: 'Helikopter + pyro. Tidlig call for solnedgang.',
    createdAt: _ts, updatedAt: _ts,
  },
  {
    id: 'sde-day-2', projectId: 'demo', dayNumber: 2,
    date: '2026-03-11', unit: 'A',
    callTime: '08:00', location: 'OSLO - BUNKER',
    strips: [
      { stripId: 'sde-strip-3', scenePoolItemId: 'scene-9',  sortOrder: 0 },
      { stripId: 'sde-strip-4', scenePoolItemId: 'scene-11', sortOrder: 1 },
    ],
    notes: 'Studio-dag. Ingen utendørs.',
    createdAt: _ts, updatedAt: _ts,
  },
  {
    id: 'sde-day-3', projectId: 'demo', dayNumber: 1,
    date: '2026-03-12', unit: 'B',
    callTime: '09:00', location: 'UiO - LAB',
    strips: [
      { stripId: 'sde-strip-5', scenePoolItemId: 'scene-13', sortOrder: 0 },
    ],
    notes: 'B-unit: lab-scener. A-unit på fjellet.',
    createdAt: _ts, updatedAt: _ts,
  },
  {
    id: 'sde-day-4', projectId: 'demo', dayNumber: 3,
    date: undefined, unit: 'A',   // TBD – no date yet
    callTime: undefined, location: undefined,
    strips: [],
    notes: 'Dato ikke satt ennå – avhenger av helikopter-tillatelse.',
    createdAt: _ts, updatedAt: _ts,
  },
];
