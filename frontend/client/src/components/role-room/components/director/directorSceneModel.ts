import type {
  CastingProject,
  CastingShot,
  Manuscript,
  ProductionDay,
  Role,
  SceneBreakdown,
  ShotList,
} from '../../models/casting';

export interface DirectorSceneScriptExcerpt {
  manuscriptId: string;
  manuscriptTitle: string;
  heading: string;
  content: string;
  startLine: number;
  matchReason: 'exact-heading' | 'scene-number-and-heading';
}

export interface DirectorSceneCoverage {
  shotLists: ShotList[];
  shots: CastingShot[];
  completedShotCount: number;
  storyboardFrameCount: number;
}

export interface DirectorSceneContext {
  scene: SceneBreakdown;
  label: string;
  heading: string;
  castNames: string[];
  coverage: DirectorSceneCoverage;
  productionDays: ProductionDay[];
}

interface ParsedScriptScene {
  heading: string;
  normalizedHeading: string;
  content: string;
  startLine: number;
  ordinal: number;
}

const SCREENPLAY_HEADING_RE = /^(?:\.)?(?:(?:INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]+).+$/i;

function normalizeHeading(value: unknown): string {
  return typeof value === 'string'
    ? value
      .trim()
      .replace(/^\./, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+-\s+/g, ' - ')
      .toUpperCase()
    : '';
}

function readSceneHeading(scene: SceneBreakdown): string {
  return [scene.heading, scene.sceneHeading, scene.sceneName]
    .find((value) => typeof value === 'string' && value.trim().length > 0)
    ?.trim() ?? '';
}

function readSceneNumber(scene: SceneBreakdown): number | null {
  const raw = typeof scene.sceneNumber === 'number'
    ? scene.sceneNumber
    : Number.parseInt(String(scene.sceneNumber ?? ''), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function parseScriptScenes(content: string): ParsedScriptScene[] {
  const lines = content.split('\n');
  const headings: Array<{ heading: string; normalizedHeading: string; startIndex: number }> = [];

  lines.forEach((rawLine, startIndex) => {
    const line = rawLine.trim();
    if (!SCREENPLAY_HEADING_RE.test(line)) return;
    const heading = line.replace(/^\./, '').trim();
    headings.push({ heading, normalizedHeading: normalizeHeading(heading), startIndex });
  });

  return headings.map((entry, index) => {
    const endIndex = headings[index + 1]?.startIndex ?? lines.length;
    return {
      heading: entry.heading,
      normalizedHeading: entry.normalizedHeading,
      content: lines.slice(entry.startIndex, endIndex).join('\n').trim(),
      startLine: entry.startIndex + 1,
      ordinal: index + 1,
    };
  });
}

export function sortDirectorScenes(scenes: SceneBreakdown[]): SceneBreakdown[] {
  return [...scenes].sort((left, right) => {
    const leftNumber = readSceneNumber(left);
    const rightNumber = readSceneNumber(right);
    if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    if (leftNumber !== null && rightNumber === null) return -1;
    if (leftNumber === null && rightNumber !== null) return 1;
    return readSceneHeading(left).localeCompare(readSceneHeading(right), 'nb');
  });
}

export function getDirectorSceneLabel(scene: SceneBreakdown, fallbackIndex?: number): string {
  const sceneNumber = scene.sceneNumber ?? (typeof fallbackIndex === 'number' ? fallbackIndex + 1 : null);
  return sceneNumber !== null && sceneNumber !== undefined && String(sceneNumber).trim()
    ? `Scene ${sceneNumber}`
    : 'Scene';
}

export function resolveDirectorSceneScriptExcerpt(
  scene: SceneBreakdown,
  manuscripts: Manuscript[],
): DirectorSceneScriptExcerpt | null {
  const heading = normalizeHeading(readSceneHeading(scene));
  if (!heading) return null;

  const eligibleManuscripts = scene.manuscriptId
    ? manuscripts.filter((manuscript) => manuscript.id === scene.manuscriptId)
    : manuscripts;
  if (eligibleManuscripts.length === 0) return null;

  const exactMatches = eligibleManuscripts.flatMap((manuscript) => (
    parseScriptScenes(manuscript.content ?? '')
      .filter((parsedScene) => parsedScene.normalizedHeading === heading)
      .map((parsedScene) => ({ manuscript, parsedScene }))
  ));

  if (exactMatches.length === 1) {
    const { manuscript, parsedScene } = exactMatches[0];
    return {
      manuscriptId: manuscript.id,
      manuscriptTitle: manuscript.title,
      heading: parsedScene.heading,
      content: parsedScene.content,
      startLine: parsedScene.startLine,
      matchReason: 'exact-heading',
    };
  }

  const sceneNumber = readSceneNumber(scene);
  if (sceneNumber === null) return null;
  const numberedMatch = exactMatches.find(({ parsedScene }) => parsedScene.ordinal === sceneNumber);
  if (!numberedMatch) return null;

  return {
    manuscriptId: numberedMatch.manuscript.id,
    manuscriptTitle: numberedMatch.manuscript.title,
    heading: numberedMatch.parsedScene.heading,
    content: numberedMatch.parsedScene.content,
    startLine: numberedMatch.parsedScene.startLine,
    matchReason: 'scene-number-and-heading',
  };
}

export function getDirectorSceneCommentManuscriptId(
  scene: SceneBreakdown,
  manuscripts: Manuscript[],
  excerpt?: DirectorSceneScriptExcerpt | null,
): string | null {
  if (excerpt?.manuscriptId) return excerpt.manuscriptId;
  if (scene.manuscriptId && manuscripts.some((manuscript) => manuscript.id === scene.manuscriptId)) {
    return scene.manuscriptId;
  }
  return null;
}

export function buildDirectorSceneContext(
  scene: SceneBreakdown,
  project: CastingProject,
  roles: Role[],
  fallbackIndex?: number,
): DirectorSceneContext {
  const sceneRoleNames = roles
    .filter((role) => {
      const sceneIds = role.sceneIds ?? role.scene_ids ?? [];
      return sceneIds.includes(scene.id);
    })
    .map((role) => role.name.trim())
    .filter(Boolean);
  const castNames = Array.from(new Set([
    ...(Array.isArray(scene.characters) ? scene.characters : []),
    ...sceneRoleNames,
  ].map((name) => name.trim()).filter(Boolean)));

  const shotLists = (project.shotLists ?? []).filter((shotList) => (
    (shotList.sceneId || shotList.scene_id) === scene.id
  ));
  const shots = shotLists.flatMap((shotList) => shotList.shots ?? []);
  const productionDays = (project.productionDays ?? []).filter((day) => (
    Array.isArray(day.scenes) && day.scenes.includes(scene.id)
  ));

  return {
    scene,
    label: getDirectorSceneLabel(scene, fallbackIndex),
    heading: readSceneHeading(scene) || getDirectorSceneLabel(scene, fallbackIndex),
    castNames,
    coverage: {
      shotLists,
      shots,
      completedShotCount: shots.filter((shot) => shot.status === 'completed').length,
      storyboardFrameCount: Array.isArray(scene.storyboardFrames) ? scene.storyboardFrames.length : 0,
    },
    productionDays,
  };
}
