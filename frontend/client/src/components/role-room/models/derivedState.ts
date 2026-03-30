/**
 * Derived state utilities for shot-list UI.
 * These functions keep displayed metrics computed from source data instead of persisted counters.
 */

import type {
  CastingShot,
  Person,
  SceneBreakdown,
  StoryboardFrame,
  ShotList,
  ShotStatus,
} from './casting';

export interface TopAssignee {
  personId: string;
  name?: string;
  shotCount: number;
}

export interface ShotStatusBreakdown {
  not_started: number;
  in_progress: number;
  completed: number;
}

export interface StoryboardCoverageFrameSummary {
  frameId: string;
  shotNumber?: string;
  title?: string;
}

export interface StoryboardCoverageSummary {
  totalFrames: number;
  coveredFrames: number;
  missingFrames: number;
  coveragePct: number;
  linkedShots: number;
  sceneLinkedShots: number;
  libraryLinkedShots: number;
  unlinkedShots: number;
  coveredFrameIds: string[];
  missingFrameIds: string[];
  coveredFrameList: StoryboardCoverageFrameSummary[];
  missingFrameList: StoryboardCoverageFrameSummary[];
}

export interface ShotListSummary {
  shotListId: string;
  sceneId: string;
  sceneName?: string;
  sceneMeta?: SceneBreakdown;
  storyboardFrameCount: number;
  storyboardLinkedShots: number;
  storyboardCoverage: StoryboardCoverageSummary;
  colorTag?: string;
  totalShots: number;
  completedShots: number;
  completionPct: number;
  unassignedShots: number;
  estimatedMinutes: number;
  estimatedHours: number;
  lastUpdated: string;
  topAssignees: TopAssignee[];
  statusBreakdown: ShotStatusBreakdown;
}

export interface ProjectShotStats {
  totalShotLists: number;
  totalShots: number;
  completedShots: number;
  unassignedShots: number;
  completionPct: number;
  estimatedMinutes: number;
  estimatedHours: number;
  storyboardFrameCount: number;
  storyboardCoveredFrames: number;
  storyboardMissingFrames: number;
  storyboardCoveragePct: number;
  storyboardLinkedShots: number;
  storyboardUnlinkedShots: number;
  topAssignees: TopAssignee[];
  statusBreakdown: ShotStatusBreakdown;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toStatus(shot: CastingShot): ShotStatus {
  switch (shot.status) {
    case 'completed':
    case 'in_progress':
      return shot.status;
    default:
      return 'not_started';
  }
}

function toEstimatedMinutes(shot: CastingShot): number {
  if (typeof shot.estimatedTime === 'number' && shot.estimatedTime > 0) {
    return shot.estimatedTime;
  }
  if (typeof shot.duration === 'number' && shot.duration > 0) {
    return shot.duration;
  }
  return 0;
}

function toTimestamp(value: string | undefined): number {
  if (!isNonEmpty(value)) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatHours(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.round((minutes / 60) * 10) / 10;
}

function sortTopAssignees(entries: Map<string, TopAssignee>): TopAssignee[] {
  return Array.from(entries.values()).sort((a, b) => {
    if (b.shotCount !== a.shotCount) return b.shotCount - a.shotCount;
    return (a.name ?? a.personId).localeCompare(b.name ?? b.personId);
  });
}

function getAssigneeIds(shot: CastingShot): string[] {
  const fromAssignments = (shot.assignments ?? [])
    .filter((assignment) => {
      if (!isNonEmpty(assignment.personId)) return false;
      return assignment.status === 'pending' || assignment.status === 'confirmed';
    })
    .map((assignment) => assignment.personId);

  if (fromAssignments.length > 0) {
    return Array.from(new Set(fromAssignments));
  }

  if (isNonEmpty(shot.assigneeId)) {
    return [shot.assigneeId];
  }

  return [];
}

function getAssigneeName(
  personId: string,
  peopleMap?: Map<string, Person>,
  shot?: CastingShot,
): string | undefined {
  const person = peopleMap?.get(personId);
  if (person?.name) return person.name;

  const fromAssignments = shot?.assignments?.find((a) => a.personId === personId);
  if (fromAssignments?.name && isNonEmpty(fromAssignments.name)) {
    return fromAssignments.name;
  }

  if (shot?.assigneeId === personId && isNonEmpty(shot.assigneeName)) {
    return shot.assigneeName;
  }

  return undefined;
}

function getCompletionPct(completedShots: number, totalShots: number): number {
  if (totalShots <= 0) return 0;
  return Math.round((completedShots / totalShots) * 100);
}

function toStoryboardFrameSummary(frame: StoryboardFrame): StoryboardCoverageFrameSummary {
  return {
    frameId: frame.id,
    shotNumber: typeof frame.shotNumber === 'string' ? frame.shotNumber : undefined,
    title:
      (typeof frame.title === 'string' && frame.title.trim().length > 0
        ? frame.title
        : typeof frame.description === 'string' && frame.description.trim().length > 0
          ? frame.description
          : undefined),
  };
}

export function computeStoryboardCoverageSummary(
  shots: CastingShot[],
  sceneMeta?: SceneBreakdown,
): StoryboardCoverageSummary {
  const sceneFrames = Array.isArray(sceneMeta?.storyboardFrames) ? sceneMeta.storyboardFrames : [];
  const sceneFrameIds = new Set(sceneFrames.map((frame) => frame.id));

  const coveredFrameIds = new Set<string>();
  let linkedShots = 0;
  let sceneLinkedShots = 0;
  let libraryLinkedShots = 0;

  for (const shot of shots) {
    const hasStoryboardLink = Boolean(shot.storyboardFrameId || shot.storyboardLibraryItemId);
    if (!hasStoryboardLink) continue;

    linkedShots += 1;

    if (typeof shot.storyboardFrameId === 'string' && sceneFrameIds.has(shot.storyboardFrameId)) {
      coveredFrameIds.add(shot.storyboardFrameId);
      sceneLinkedShots += 1;
    } else if (shot.storyboardSourceType === 'library-item' || shot.storyboardLibraryItemId) {
      libraryLinkedShots += 1;
    }
  }

  const coveredFrameList = sceneFrames
    .filter((frame) => coveredFrameIds.has(frame.id))
    .map(toStoryboardFrameSummary);
  const missingFrameList = sceneFrames
    .filter((frame) => !coveredFrameIds.has(frame.id))
    .map(toStoryboardFrameSummary);

  return {
    totalFrames: sceneFrames.length,
    coveredFrames: coveredFrameIds.size,
    missingFrames: Math.max(0, sceneFrames.length - coveredFrameIds.size),
    coveragePct: getCompletionPct(coveredFrameIds.size, sceneFrames.length),
    linkedShots,
    sceneLinkedShots,
    libraryLinkedShots,
    unlinkedShots: Math.max(0, shots.length - linkedShots),
    coveredFrameIds: Array.from(coveredFrameIds),
    missingFrameIds: missingFrameList.map((frame) => frame.frameId),
    coveredFrameList,
    missingFrameList,
  };
}

export function isShotAssigned(shot: CastingShot): boolean {
  if (isNonEmpty(shot.assigneeId)) return true;
  return (shot.assignments ?? []).some((assignment) => {
    if (!isNonEmpty(assignment.personId)) return false;
    return assignment.status === 'pending' || assignment.status === 'confirmed';
  });
}

export function computeShotListSummary(
  shotList: ShotList,
  sceneMeta?: SceneBreakdown,
  peopleMap?: Map<string, Person>,
): ShotListSummary {
  const shots = shotList.shots ?? [];

  const statusBreakdown: ShotStatusBreakdown = {
    not_started: 0,
    in_progress: 0,
    completed: 0,
  };

  let unassignedShots = 0;
  let estimatedMinutes = 0;
  let latestTimestamp = Math.max(
    toTimestamp(shotList.updatedAt),
    toTimestamp(shotList.updated_at),
    toTimestamp(shotList.createdAt),
    toTimestamp(shotList.created_at),
  );

  const assigneeMap = new Map<string, TopAssignee>();

  for (const shot of shots) {
    const status = toStatus(shot);
    statusBreakdown[status] += 1;

    if (!isShotAssigned(shot)) {
      unassignedShots += 1;
    }

    estimatedMinutes += toEstimatedMinutes(shot);

    latestTimestamp = Math.max(
      latestTimestamp,
      toTimestamp(shot.updatedAt),
      toTimestamp(shot.completedAt),
      toTimestamp(shot.createdAt),
    );

    for (const personId of getAssigneeIds(shot)) {
      const existing = assigneeMap.get(personId);
      if (existing) {
        existing.shotCount += 1;
      } else {
        assigneeMap.set(personId, {
          personId,
          name: getAssigneeName(personId, peopleMap, shot),
          shotCount: 1,
        });
      }
    }
  }

  const completedShots = statusBreakdown.completed;
  const totalShots = shots.length;
  const storyboardCoverage = computeStoryboardCoverageSummary(shots, sceneMeta);
  const storyboardLinkedShots = storyboardCoverage.linkedShots;
  const storyboardFrameCount = storyboardCoverage.totalFrames;

  return {
    shotListId: shotList.id,
    sceneId: shotList.sceneId,
    sceneName: shotList.sceneName ?? sceneMeta?.sceneName ?? sceneMeta?.heading,
    sceneMeta,
    storyboardFrameCount,
    storyboardLinkedShots,
    storyboardCoverage,
    colorTag: shotList.colorTag ?? sceneMeta?.colorTag,
    totalShots,
    completedShots,
    completionPct: getCompletionPct(completedShots, totalShots),
    unassignedShots,
    estimatedMinutes,
    estimatedHours: formatHours(estimatedMinutes),
    lastUpdated: new Date(latestTimestamp || Date.now()).toISOString(),
    topAssignees: sortTopAssignees(assigneeMap),
    statusBreakdown,
  };
}

export function computeSummaries(
  shotLists: ShotList[],
  sceneMap: Map<string, SceneBreakdown>,
  peopleMap?: Map<string, Person>,
): ShotListSummary[] {
  return shotLists
    .map((shotList) =>
      computeShotListSummary(shotList, sceneMap.get(shotList.sceneId), peopleMap),
    )
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
}

export function computeProjectStats(summaries: ShotListSummary[]): ProjectShotStats {
  const totals: ProjectShotStats = {
    totalShotLists: summaries.length,
    totalShots: 0,
    completedShots: 0,
    unassignedShots: 0,
    completionPct: 0,
    estimatedMinutes: 0,
    estimatedHours: 0,
    storyboardFrameCount: 0,
    storyboardCoveredFrames: 0,
    storyboardMissingFrames: 0,
    storyboardCoveragePct: 0,
    storyboardLinkedShots: 0,
    storyboardUnlinkedShots: 0,
    topAssignees: [],
    statusBreakdown: {
      not_started: 0,
      in_progress: 0,
      completed: 0,
    },
  };

  const assigneeMap = new Map<string, TopAssignee>();

  for (const summary of summaries) {
    totals.totalShots += summary.totalShots;
    totals.completedShots += summary.completedShots;
    totals.unassignedShots += summary.unassignedShots;
    totals.estimatedMinutes += summary.estimatedMinutes;
    totals.storyboardFrameCount += summary.storyboardCoverage.totalFrames;
    totals.storyboardCoveredFrames += summary.storyboardCoverage.coveredFrames;
    totals.storyboardMissingFrames += summary.storyboardCoverage.missingFrames;
    totals.storyboardLinkedShots += summary.storyboardCoverage.linkedShots;
    totals.storyboardUnlinkedShots += summary.storyboardCoverage.unlinkedShots;
    totals.statusBreakdown.not_started += summary.statusBreakdown.not_started;
    totals.statusBreakdown.in_progress += summary.statusBreakdown.in_progress;
    totals.statusBreakdown.completed += summary.statusBreakdown.completed;

    for (const assignee of summary.topAssignees) {
      const existing = assigneeMap.get(assignee.personId);
      if (existing) {
        existing.shotCount += assignee.shotCount;
      } else {
        assigneeMap.set(assignee.personId, { ...assignee });
      }
    }
  }

  totals.completionPct = getCompletionPct(totals.completedShots, totals.totalShots);
  totals.estimatedHours = formatHours(totals.estimatedMinutes);
  totals.storyboardCoveragePct = getCompletionPct(
    totals.storyboardCoveredFrames,
    totals.storyboardFrameCount,
  );
  totals.topAssignees = sortTopAssignees(assigneeMap);
  return totals;
}

export function patchSummaryOnStatusChange(
  summary: ShotListSummary,
  previousStatus: ShotStatus,
  nextStatus: ShotStatus,
  updatedAt?: string,
): ShotListSummary {
  if (previousStatus === nextStatus) {
    return {
      ...summary,
      lastUpdated: updatedAt ?? new Date().toISOString(),
    };
  }

  const statusBreakdown: ShotStatusBreakdown = {
    ...summary.statusBreakdown,
  };

  statusBreakdown[previousStatus] = Math.max(0, statusBreakdown[previousStatus] - 1);
  statusBreakdown[nextStatus] += 1;

  const completedShots = statusBreakdown.completed;

  return {
    ...summary,
    statusBreakdown,
    completedShots,
    completionPct: getCompletionPct(completedShots, summary.totalShots),
    lastUpdated: updatedAt ?? new Date().toISOString(),
  };
}

export function patchSummaryOnAssign(
  summary: ShotListSummary,
  wasPreviouslyUnassigned: boolean,
  personId?: string,
  updatedAt?: string,
): ShotListSummary {
  if (!wasPreviouslyUnassigned) {
    return {
      ...summary,
      lastUpdated: updatedAt ?? new Date().toISOString(),
    };
  }

  const topAssigneeMap = new Map(
    summary.topAssignees.map((entry) => [entry.personId, { ...entry }]),
  );

  if (isNonEmpty(personId)) {
    const existing = topAssigneeMap.get(personId);
    if (existing) {
      existing.shotCount += 1;
    } else {
      topAssigneeMap.set(personId, {
        personId,
        shotCount: 1,
      });
    }
  }

  return {
    ...summary,
    unassignedShots: Math.max(0, summary.unassignedShots - 1),
    topAssignees: sortTopAssignees(topAssigneeMap),
    lastUpdated: updatedAt ?? new Date().toISOString(),
  };
}
