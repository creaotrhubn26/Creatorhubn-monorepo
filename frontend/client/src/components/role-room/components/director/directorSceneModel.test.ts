import { describe, expect, it } from 'vitest';
import type { CastingProject, Manuscript, SceneBreakdown } from '../../models/casting';
import {
  buildDirectorSceneContext,
  getDirectorSceneCommentManuscriptId,
  resolveDirectorSceneScriptExcerpt,
  sortDirectorScenes,
} from './directorSceneModel';

const screenplay: Manuscript = {
  id: 'manus-1',
  projectId: 'project-1',
  title: 'Troll',
  format: 'fountain',
  content: [
    'INT. KJØKKEN - DAG',
    '',
    'NORA dekker bordet.',
    '',
    'NORA',
    'Vi er klare.',
    '',
    'EXT. SKOG - NATT',
    '',
    'Tåken ligger lavt.',
  ].join('\n'),
};

function project(overrides: Partial<CastingProject> = {}): CastingProject {
  return {
    id: 'project-1',
    name: 'Troll',
    roles: [],
    candidates: [],
    crew: [],
    schedules: [],
    locations: [],
    props: [],
    ...overrides,
  };
}

describe('directorSceneModel', () => {
  it('sorts numbered scenes before unnumbered scenes', () => {
    const scenes: SceneBreakdown[] = [
      { id: 'third', sceneNumber: 3, sceneHeading: 'EXT. SKOG - NATT' },
      { id: 'unknown', sceneHeading: 'INT. GARASJE - DAG' },
      { id: 'first', sceneNumber: 1, sceneHeading: 'INT. KJØKKEN - DAG' },
    ];

    expect(sortDirectorScenes(scenes).map((scene) => scene.id)).toEqual(['first', 'third', 'unknown']);
  });

  it('returns manuscript content only for an exact normalized heading match', () => {
    const exact = resolveDirectorSceneScriptExcerpt({
      id: 'scene-1',
      manuscriptId: 'manus-1',
      sceneNumber: 1,
      sceneHeading: 'int.  kjøkken - dag',
    }, [screenplay]);
    const uncertain = resolveDirectorSceneScriptExcerpt({
      id: 'scene-2',
      manuscriptId: 'manus-1',
      sceneNumber: 2,
      sceneHeading: 'EXT. SKOGEN - NATT',
    }, [screenplay]);

    expect(exact).toMatchObject({
      manuscriptId: 'manus-1',
      heading: 'INT. KJØKKEN - DAG',
      startLine: 1,
      matchReason: 'exact-heading',
    });
    expect(exact?.content).toContain('Vi er klare.');
    expect(exact?.content).not.toContain('Tåken ligger lavt.');
    expect(uncertain).toBeNull();
  });

  it('does not guess between duplicate headings without matching scene order', () => {
    const duplicate: Manuscript = {
      ...screenplay,
      content: 'INT. ROM - DAG\nFørste.\n\nINT. ROM - DAG\nAndre.',
    };

    expect(resolveDirectorSceneScriptExcerpt({
      id: 'scene-x',
      manuscriptId: duplicate.id,
      sceneHeading: 'INT. ROM - DAG',
    }, [duplicate])).toBeNull();

    expect(resolveDirectorSceneScriptExcerpt({
      id: 'scene-2',
      manuscriptId: duplicate.id,
      sceneNumber: 2,
      sceneHeading: 'INT. ROM - DAG',
    }, [duplicate])?.content).toContain('Andre.');
  });

  it('builds cast, schedule and visual coverage from exact scene ids', () => {
    const scene: SceneBreakdown = {
      id: 'scene-1',
      sceneNumber: 1,
      sceneHeading: 'INT. KJØKKEN - DAG',
      characters: ['NORA'],
      storyboardFrames: [{ id: 'frame-1' }],
    };
    const context = buildDirectorSceneContext(scene, project({
      sceneBreakdowns: [scene],
      productionDays: [{ id: 'day-1', date: '2026-09-11', scenes: ['scene-1'], crew: [], props: [] }],
      shotLists: [{
        id: 'list-1',
        sceneId: 'scene-1',
        shots: [
          { id: 'shot-1', shotType: 'Wide', cameraAngle: 'Eye Level', cameraMovement: 'Static', status: 'completed' },
          { id: 'shot-2', shotType: 'Close-up', cameraAngle: 'Eye Level', cameraMovement: 'Static' },
        ],
      }],
    }), [
      { id: 'role-nora', name: 'NORA', sceneIds: ['scene-1'] },
      { id: 'role-ola', name: 'OLA', sceneIds: ['scene-1'] },
      { id: 'role-other', name: 'ELIAS', sceneIds: ['scene-2'] },
    ]);

    expect(context.castNames).toEqual(['NORA', 'OLA']);
    expect(context.coverage).toMatchObject({ storyboardFrameCount: 1, completedShotCount: 1 });
    expect(context.coverage.shots).toHaveLength(2);
    expect(context.productionDays.map((day) => day.id)).toEqual(['day-1']);
  });

  it('enables comments only for a manuscript that is actually loaded', () => {
    const scene = { id: 'scene-1', manuscriptId: 'manus-1' };
    expect(getDirectorSceneCommentManuscriptId(scene, [screenplay])).toBe('manus-1');
    expect(getDirectorSceneCommentManuscriptId(scene, [])).toBeNull();
  });
});
