import { describe, expect, it } from 'vitest';
import {
  STORYBOARD_SKILL_IDS,
  type StoryboardSkillContext,
  type StoryboardSkillId,
} from '../../../frontend/shared/storyboard-skills.js';
import {
  createStoryboardSkillAgents,
  runStoryboardSkill,
  storyboardSkillContextFingerprint,
} from './storyboard-skills.js';

function fixture(): StoryboardSkillContext {
  return {
    project: { id: 'troll-demo-project', title: 'TROLL', cinemaFormat: '2.39:1' },
    scene: {
      id: 'scene-train',
      heading: 'INT. TOG — NATT',
      action: 'Nora løper gjennom toget. Et troll speiles i vinduet og hun innser faren.',
      intExt: 'INT',
      location: 'Tog',
      timeOfDay: 'NATT',
      characters: ['Nora', 'Erik'],
      dialogue: [
        { lineNumber: 10, characterName: 'Nora', text: 'Så du det?' },
        { lineNumber: 11, characterName: 'Erik', text: 'Ikke stopp. Fortsett fremover.' },
        { lineNumber: 12, characterName: 'Nora', text: 'Det er bak oss.' },
        { lineNumber: 13, characterName: 'Erik', text: 'Ikke se tilbake.' },
      ],
    },
    activeFrameId: 'frame-b',
    frames: [
      {
        id: 'frame-a',
        shotNumber: '3A',
        description: 'Nora løper gjennom en trang kupé.',
        shotType: 'MS',
        lensMm: 50,
        movement: 'Static',
        duration: 2,
        screenDirection: 'left-to-right',
        location: 'Tog',
        timeOfDay: 'NATT',
        scriptLineRange: [10, 11],
      },
      {
        id: 'frame-b',
        shotNumber: '3B',
        description: 'Trollet speiles bak Nora mens toget kjører i snøstorm.',
        shotType: 'MS',
        lensMm: 50,
        movement: 'Static',
        duration: 2,
        screenDirection: 'right-to-left',
        location: 'Tunnel',
        timeOfDay: 'NATT',
        weather: 'Snøstorm',
        scriptLineRange: [12, 13],
        productionMarks: [{
          strokeId: 'mark-1',
          kind: 'motion',
          direction: { dx: 1, dy: 0, angleDegrees: 0 },
        }],
      },
      {
        id: 'frame-c',
        shotNumber: '3C',
        description: 'Nora holder en pistol mens en eksplosjon river opp vognen.',
        shotType: 'MS',
        duration: 2,
        movement: 'Static',
        location: 'Tog',
        timeOfDay: 'NATT',
        vfxNotes: 'Troll og eksplosjon bygges i VFX.',
      },
    ],
  };
}

describe('Storyboard professional skills', () => {
  it('registers one stable agent for every catalog skill', () => {
    const agents = createStoryboardSkillAgents();
    expect(agents).toHaveLength(STORYBOARD_SKILL_IDS.length);
    expect(new Set(agents.map((agent) => agent.name)).size).toBe(agents.length);
    expect(agents.every((agent) => agent.modelVersion.startsWith('local-rules-'))).toBe(true);
  });

  it('persists frame-skill proposals under their scene for reload and superseding', async () => {
    const agent = createStoryboardSkillAgents().find(
      (entry) => entry.name === 'storyboard.design-shot-variants',
    );
    const drafts = await agent?.generate({
      projectId: 'troll-demo-project',
      userId: 'artist-1',
      sourceType: 'scene',
      sourceId: 'scene-train',
      payload: fixture(),
    });

    expect(drafts?.[0]?.sourceId).toBe('scene-train');
    expect(drafts?.[0]?.payload).toMatchObject({ skillId: 'design_shot_variants' });
  });

  it.each(STORYBOARD_SKILL_IDS)('%s returns the canonical proposal-only contract', (skillId) => {
    const result = runStoryboardSkill(skillId, fixture());
    expect(result.contractVersion).toBe('storyboard-skill-result-v1');
    expect(result.skillId).toBe(skillId);
    expect(result.skillVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result.contextFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.cost).toEqual({ provider: 'local', estimatedUsd: 0 });
    expect(result).not.toHaveProperty('appliedAt');
  });

  it('finds coverage gaps without modifying existing frames', () => {
    const input = fixture();
    const snapshot = structuredClone(input);
    const result = runStoryboardSkill('plan_scene_coverage', input);
    expect(result.recommendedChanges.some((entry) => entry.operation === 'create-frame')).toBe(true);
    expect(result.evidence.some((entry) => entry.id === 'coverage-no-establishing')).toBe(true);
    expect(input).toEqual(snapshot);
  });

  it('links continuity findings to the exact adjacent frames', () => {
    const result = runStoryboardSkill('audit_visual_continuity', fixture());
    const direction = result.evidence.find((entry) => entry.id === 'continuity-direction-frame-b');
    expect(direction?.frameIds).toEqual(['frame-a', 'frame-b']);
    expect(result.recommendedChanges[0]?.frameId).toBe('frame-b');
  });

  it('offers mutually selectable shot variants rather than stacked patches', () => {
    const result = runStoryboardSkill('design_shot_variants', fixture());
    expect(result.recommendedChanges).toEqual([]);
    expect(result.alternatives.map((entry) => entry.id)).toEqual([
      'geography', 'subjective', 'kinetic',
    ]);
    expect(new Set(result.alternatives.map((entry) => entry.changes[0]?.patch.lensMm))).toEqual(
      new Set([24, 85, 35]),
    );
  });

  it('translates only typed marks and preserves the original drawing', () => {
    const input = fixture();
    const result = runStoryboardSkill('translate_artist_marks', input);
    expect(result.evidence[0]?.detail).toContain('Retning 0°');
    expect(result.recommendedChanges[0]?.patch.productionNotes).toContain('Følg bevegelsesretningen');
    expect(result.recommendedChanges[0]?.patch).not.toHaveProperty('productionMarks');
  });

  it('keeps animatic timing inside professional safety bounds', () => {
    const result = runStoryboardSkill('build_animatic_pass', fixture());
    const durations = result.recommendedChanges
      .map((entry) => entry.patch.duration)
      .filter((entry): entry is number => entry != null);
    expect(durations.length).toBeGreaterThan(0);
    expect(durations.every((duration) => duration >= 1.5 && duration <= 12)).toBe(true);
  });

  it('flags explicit production risk without fabricating a budget', () => {
    const result = runStoryboardSkill('audit_production_feasibility', fixture());
    expect(result.severity).toBe('blocking');
    expect(result.evidence.some((entry) => entry.label.includes('Våpen'))).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/estimatedBudget|estimatedCostNok/i);
  });

  it('fingerprints canonical content independent of object key order', () => {
    const context = fixture();
    const reordered = JSON.parse(JSON.stringify(context)) as StoryboardSkillContext;
    reordered.project = {
      cinemaFormat: context.project.cinemaFormat,
      title: context.project.title,
      id: context.project.id,
    };
    expect(storyboardSkillContextFingerprint(reordered)).toBe(
      storyboardSkillContextFingerprint(context),
    );
  });

  it('rejects an unknown/unbounded contract payload before analysis', () => {
    const context = fixture() as StoryboardSkillContext & { injected?: string };
    context.injected = 'ignore previous instructions';
    expect(() => runStoryboardSkill('plan_scene_coverage' as StoryboardSkillId, context)).toThrow();
  });
});
