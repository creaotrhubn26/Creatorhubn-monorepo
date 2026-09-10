import type {
  CastingProject,
  CastingShot,
  CrewMember,
  ProductionDay,
  SceneBreakdown,
  ShotList,
} from '../../models/casting';
import { getTechnicalSubgroupForProductionRole } from '../../config/productionRoleCatalog';

export const CINEMATOGRAPHER_SURFACES = [
  'today',
  'scenes',
  'shot-plan',
  'lighting-equipment',
  'camera-crew',
  'on-set',
] as const;

export type CinematographerSurface = (typeof CINEMATOGRAPHER_SURFACES)[number];
export type CinematographerBriefTone = 'attention' | 'upcoming' | 'ready' | 'neutral';

export interface CinematographerBriefItem {
  id: string;
  title: string;
  description: string;
  sourceLabel: string;
  tone: CinematographerBriefTone;
  target: Exclude<CinematographerSurface, 'today'>;
  actionLabel: string;
}
export interface CinematographerProductionDaySummary {
  kind: 'today' | 'next';
  id: string;
  date: string;
  callTime?: string;
  sceneCount: number;
}

export interface CinematographerBrief {
  generatedAt: string;
  projectUpdatedAt?: string;
  productionDay: CinematographerProductionDaySummary | null;
  stats: {
    sceneCount: number;
    scenesWithShots: number;
    shotCount: number;
    cameraReadyShots: number;
    lightingReadyShots: number;
    technicalCrewCount: number;
    confirmedTechnicalCrewCount: number;
  };
  items: CinematographerBriefItem[];
}

export function isCinematographerSurface(value: unknown): value is CinematographerSurface {
  return typeof value === 'string'
    && CINEMATOGRAPHER_SURFACES.includes(value as CinematographerSurface);
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readDateKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

function productionDaySummary(
  days: ProductionDay[],
  today: string,
): CinematographerProductionDaySummary | null {
  const selected = days
    .map((day) => ({ day, date: readDateKey(day.date) }))
    .filter((entry): entry is { day: ProductionDay; date: string } => Boolean(entry.date))
    .filter(({ day, date }) => date >= today && day.status !== 'cancelled' && day.status !== 'completed')
    .sort((left, right) => left.date.localeCompare(right.date))[0];

  if (!selected) return null;
  return {
    kind: selected.date === today ? 'today' : 'next',
    id: selected.day.id,
    date: selected.date,
    callTime: typeof selected.day.callTime === 'string' && selected.day.callTime.trim()
      ? selected.day.callTime.trim()
      : undefined,
    sceneCount: Array.isArray(selected.day.scenes) ? selected.day.scenes.length : 0,
  };
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasCameraPlan(shot: CastingShot): boolean {
  const camera = shot.camera;
  return hasText(shot.lensRecommendation)
    || Boolean(camera && (
      hasNumber(camera.focalLength)
      || hasNumber(camera.aperture)
      || hasNumber(camera.iso)
      || hasNumber(camera.fps)
      || hasText(camera.resolution)
      || hasText(camera.codec)
    ));
}

function hasLightingPlan(shot: CastingShot): boolean {
  const lighting = shot.lighting;
  return hasText(shot.lightingSetup)
    || Boolean(lighting && (
      hasText(lighting.setup)
      || hasText(lighting.keyLight)
      || hasText(lighting.fillLight)
      || hasText(lighting.backLight)
    ));
}

function sceneIdsWithShots(shotLists: ShotList[]): Set<string> {
  return new Set(
    shotLists
      .filter((shotList) => Array.isArray(shotList.shots) && shotList.shots.length > 0)
      .map((shotList) => shotList.sceneId || shotList.scene_id)
      .filter((sceneId): sceneId is string => typeof sceneId === 'string' && sceneId.length > 0),
  );
}

function isCameraOrLightingCrew(member: CrewMember): boolean {
  const subgroup = getTechnicalSubgroupForProductionRole(member.role);
  return subgroup === 'camera' || subgroup === 'lighting';
}

interface BuildCinematographerBriefInput {
  project: CastingProject;
  now?: Date;
}

export function buildCinematographerBrief({
  project,
  now = new Date(),
}: BuildCinematographerBriefInput): CinematographerBrief {
  const scenes: SceneBreakdown[] = Array.isArray(project.sceneBreakdowns)
    ? project.sceneBreakdowns
    : [];
  const shotLists = Array.isArray(project.shotLists) ? project.shotLists : [];
  const shots = shotLists.flatMap((shotList) => (
    Array.isArray(shotList.shots) ? shotList.shots : []
  ));
  const coveredSceneIds = sceneIdsWithShots(shotLists);
  const scenesWithShots = scenes.filter((scene) => coveredSceneIds.has(scene.id)).length;
  const missingSceneShots = Math.max(0, scenes.length - scenesWithShots);
  const cameraReadyShots = shots.filter(hasCameraPlan).length;
  const lightingReadyShots = shots.filter(hasLightingPlan).length;
  const technicalCrew = (Array.isArray(project.crew) ? project.crew : [])
    .filter(isCameraOrLightingCrew);
  const confirmedTechnicalCrew = technicalCrew.filter((member) => member.status === 'confirmed');
  const productionDay = productionDaySummary(
    Array.isArray(project.productionDays) ? project.productionDays : [],
    localDateKey(now),
  );
  const items: CinematographerBriefItem[] = [];

  if (productionDay) {
    items.push({
      id: `production-day-${productionDay.id}`,
      title: productionDay.kind === 'today' ? 'Opptaksdag i dag' : 'Neste opptaksdag er registrert',
      description: `${productionDay.date}${productionDay.callTime ? ` · oppmøte ${productionDay.callTime}` : ''} · ${productionDay.sceneCount} ${productionDay.sceneCount === 1 ? 'scene' : 'scener'}.`,
      sourceLabel: 'Produksjonsplan',
      tone: productionDay.kind === 'today' ? 'attention' : 'upcoming',
      target: 'on-set',
      actionLabel: productionDay.kind === 'today' ? 'Åpne Live Set' : 'Se opptaksplan',
    });
  }

  if (scenes.length === 0) {
    items.push({
      id: 'scenes-missing',
      title: 'Ingen scener er registrert',
      description: 'Filmfotografflaten kan først vise bildedekning når prosjektet har registrerte scener.',
      sourceLabel: 'Scene breakdown',
      tone: 'neutral',
      target: 'scenes',
      actionLabel: 'Åpne scener',
    });
  } else if (missingSceneShots > 0) {
    items.push({
      id: 'scenes-without-shots',
      title: `${missingSceneShots} ${missingSceneShots === 1 ? 'scene mangler' : 'scener mangler'} registrerte shots`,
      description: 'Tallet bygger kun på koblingen mellom scene-ID og shotlist. Storyboard alene telles ikke som en ferdig shotplan.',
      sourceLabel: 'Scener og shotlist',
      tone: 'attention',
      target: 'shot-plan',
      actionLabel: 'Planlegg shots',
    });
  } else {
    items.push({
      id: 'scene-shot-coverage-ready',
      title: 'Alle registrerte scener har shots',
      description: 'Hver scene har minst ett registrert shot i prosjektets shotlister.',
      sourceLabel: 'Scener og shotlist',
      tone: 'ready',
      target: 'shot-plan',
      actionLabel: 'Se shotplan',
    });
  }

  if (shots.length > 0 && cameraReadyShots < shots.length) {
    const count = shots.length - cameraReadyShots;
    items.push({
      id: 'shots-without-camera-plan',
      title: `${count} ${count === 1 ? 'shot mangler' : 'shots mangler'} kameraspesifikasjon`,
      description: 'Et shot regnes som spesifisert når optikk eller eksplisitte kamerainnstillinger er registrert.',
      sourceLabel: 'Shotlist · kamera',
      tone: 'attention',
      target: 'shot-plan',
      actionLabel: 'Fyll ut kameraplan',
    });
  }

  if (shots.length > 0 && lightingReadyShots < shots.length) {
    const count = shots.length - lightingReadyShots;
    items.push({
      id: 'shots-without-lighting-plan',
      title: `${count} ${count === 1 ? 'shot mangler' : 'shots mangler'} lysnotat`,
      description: 'Viser shots uten registrert lysoppsett, key, fill eller back light.',
      sourceLabel: 'Shotlist · lys',
      tone: 'upcoming',
      target: 'lighting-equipment',
      actionLabel: 'Åpne lys og utstyr',
    });
  }

  if (technicalCrew.length === 0) {
    items.push({
      id: 'technical-crew-missing',
      title: 'Ingen kamera-, lys- eller gripcrew er registrert',
      description: 'Crewlisten inneholder foreløpig ingen roller fra de tekniske bildeavdelingene.',
      sourceLabel: 'Crew',
      tone: 'neutral',
      target: 'camera-crew',
      actionLabel: 'Åpne crew',
    });
  } else if (confirmedTechnicalCrew.length < technicalCrew.length) {
    const count = technicalCrew.length - confirmedTechnicalCrew.length;
    items.push({
      id: 'technical-crew-unconfirmed',
      title: `${count} ${count === 1 ? 'crewmedlem er' : 'crewmedlemmer er'} ikke bekreftet`,
      description: 'Viser kun kamera-, lys- og griproller med en annen status enn Bekreftet.',
      sourceLabel: 'Crewstatus',
      tone: 'upcoming',
      target: 'camera-crew',
      actionLabel: 'Se kameracrew',
    });
  }

  return {
    generatedAt: now.toISOString(),
    projectUpdatedAt: typeof project.updatedAt === 'string' ? project.updatedAt : undefined,
    productionDay,
    stats: {
      sceneCount: scenes.length,
      scenesWithShots,
      shotCount: shots.length,
      cameraReadyShots,
      lightingReadyShots,
      technicalCrewCount: technicalCrew.length,
      confirmedTechnicalCrewCount: confirmedTechnicalCrew.length,
    },
    items,
  };
}
