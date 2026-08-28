import { describe, expect, it } from 'vitest';
import type { StoryboardScenarioSelection } from './scenario-packs.js';
import {
  inheritStoryboardScenarioSelection,
  validateStoryboardScenarioContinuity,
} from './scenario-continuity.js';

const medical: StoryboardScenarioSelection = {
  packId: 'medical.healthcare', packVersion: '1.0.0',
  subdomainId: 'hospital-ward', zoneId: 'hospital-room',
  roleIds: ['patient', 'nurse'], propTypeIds: ['care-bed', 'monitor'],
  actionIds: ['examination'], stateIds: ['calm'],
  continuityLockIds: ['patient-side', 'equipment-layout'],
};

describe('storyboard scenario inheritance and continuity', () => {
  it('inherits scene defaults and preserves intentional empty shot arrays', () => {
    const resolved = inheritStoryboardScenarioSelection(medical, {
      roleIds: ['patient'], propTypeIds: [],
    });
    expect(resolved?.zoneId).toBe('hospital-room');
    expect(resolved?.roleIds).toEqual(['patient']);
    expect(resolved?.propTypeIds).toEqual([]);
  });

  it('reports deterministic adjacent-shot drift without calling a model', () => {
    const issues = validateStoryboardScenarioContinuity(medical, {
      ...medical, zoneId: 'waiting-area', roleIds: ['patient'], stateIds: ['concerned'],
    });
    expect(issues.map((issue) => issue.code)).toEqual([
      'scenario-zone-changed', 'scenario-roles-changed', 'scenario-states-changed',
    ]);
  });
});
