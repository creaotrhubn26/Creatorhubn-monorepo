import type { Manuscript, SceneBreakdown, ShotList } from '../../../models/casting';
import type { CallSheet, ShootingDay } from '..';
import { toDisplayString } from './productionManuscriptUi';

interface BuildProductionCallSheetInput {
  manuscript: Manuscript;
  scenes: SceneBreakdown[];
  shotLists: ShotList[];
  shootingDays: ShootingDay[];
  quickNotes: Record<string, string>;
  dayId?: string;
}

export const buildProductionCallSheet = ({
  manuscript,
  scenes,
  shotLists,
  shootingDays,
  quickNotes,
  dayId,
}: BuildProductionCallSheetInput): CallSheet => {
  const day = shootingDays.find((entry) => entry.id === dayId) ?? shootingDays[0];
  const dayScenes = day?.scenes?.length
    ? scenes.filter((scene) => day.scenes.includes(scene.id))
    : scenes;
  const daySceneIds = new Set(dayScenes.map((scene) => scene.id));
  const dayShotLists = shotLists.filter((list) => daySceneIds.has(list.sceneId));
  const sceneEquipment = dayScenes.flatMap((scene) => scene.metadata?.equipment ?? []);

  return {
    id: `call-sheet-${day?.id ?? 'draft'}-${Date.now()}`,
    shootingDayId: day?.id ?? dayId ?? 'draft',
    projectTitle: manuscript.title || 'Produksjon',
    productionCompany: '',
    director: '',
    producer: '',
    date: day?.date ?? new Date().toISOString().split('T')[0],
    dayNumber: day?.dayNumber ?? Math.max(1, shootingDays.findIndex((entry) => entry.id === day?.id) + 1),
    totalDays: Math.max(shootingDays.length, 1),
    generalCallTime: day?.callTime ?? '08:00',
    crewCallTimes: Object.entries(day?.crewCallTimes ?? {}).map(([id, callTime]) => ({
      id,
      name: id,
      role: id,
      department: 'Crew',
      callTime,
    })),
    castCallTimes: Object.entries(day?.castCallTimes ?? {}).map(([id, callTime]) => ({
      id,
      name: id,
      character: id,
      callTime,
      scenes: dayScenes
        .filter((scene) => scene.characters?.includes(id))
        .map((scene) => toDisplayString(scene.sceneNumber, scene.id)),
    })),
    scenes: dayScenes.map((scene) => {
      const shots = dayShotLists.find((list) => list.sceneId === scene.id)?.shots ?? [];
      const duration = shots.reduce((sum, shot) => sum + (shot.duration ?? 5), 0);
      return {
        sceneNumber: toDisplayString(scene.sceneNumber, scene.id),
        description: scene.sceneHeading || scene.heading || scene.description || '',
        location: scene.locationName || day?.location || '',
        intExt: scene.intExt || '',
        timeOfDay: scene.timeOfDay || '',
        pages: scene.pageLength ?? 0,
        cast: scene.characters ?? [],
        estimatedTime: `${duration} min`,
        notes: quickNotes[scene.id] || scene.description || undefined,
      };
    }),
    locations: day
      ? [{
          name: day.location || 'Location',
          address: day.locationAddress ?? '',
        }]
      : [],
    equipment: Array.from(new Set([...(day?.equipmentNeeded ?? []), ...sceneEquipment])),
    meals: day?.meals ?? [],
    contacts: [],
    notes: [day?.notes].filter((note): note is string => Boolean(note)),
    weather: day?.weather,
    createdAt: new Date().toISOString(),
    version: 1,
  };
};
