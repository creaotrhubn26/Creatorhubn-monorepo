import { describe, expect, it } from 'vitest';
import {
  hasRolePreset,
  normalizeProductionRolePresetKey,
  presetForRole,
} from './studioAccessModel';

describe('studioAccessModel production role aliases', () => {
  it.each(['dop', 'cinematographer', 'director_of_photography', 'dp', 'filmfotograf'])(
    'maps %s to the DoP access preset',
    (role) => {
      expect(hasRolePreset(role)).toBe(true);
      expect(normalizeProductionRolePresetKey(role)).toBe('dop');
      expect(presetForRole(role)).toEqual(presetForRole('dop'));
    },
  );

  it('keeps the generic camera team preset separate from the DoP preset', () => {
    expect(normalizeProductionRolePresetKey('camera_team')).toBe('camera_team');
    expect(presetForRole('camera_team')['story-arc']).toBeUndefined();
    expect(presetForRole('dop')['story-arc']).toBe('view');
  });

  it.each([
    ['post_supervisor', 'post_supervisor'],
    ['post_coordinator', 'post_coordinator'],
    ['supervising_editor', 'editor'],
    ['video_editor', 'editor'],
  ] as const)('gives %s the canonical %s storyboard access', (role, canonical) => {
    expect(normalizeProductionRolePresetKey(role)).toBe(canonical);
    expect(presetForRole(role).storyboard).toBe('view');
  });
});
