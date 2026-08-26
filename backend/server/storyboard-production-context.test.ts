import { describe, expect, it } from 'vitest';
import {
  hydrateStoryboardProductionContext,
} from './storyboard-production-context.js';
import type { StoryboardShotContext } from './storyboard-ai-context.js';

const context: StoryboardShotContext = {
  version: 'storyboard-shot-v1',
  manuscriptTitle: 'TROLL',
  project: { styleProfileId: 'story-pencil', creativeDirection: '' },
  production: { characters: [], wardrobe: [], locations: [], props: [] },
  scene: {
    id: 'scene-3',
    number: 3,
    heading: 'Client heading',
    intExt: 'INT',
    location: 'Naturhistorisk museum',
    timeOfDay: 'DAY',
    action: 'Client action',
    characters: ['role-nora'],
  },
  shot: {
    id: 'frame-3b',
    number: '3B',
    description: 'Nora looks up.',
    notes: '',
    shotType: 'MCU',
    angle: 'Low',
    lensMm: 50,
    movement: 'Push',
    lighting: 'Cold moonlight.',
    durationSec: 4,
    transition: '',
    focusDepth: '',
    timeOfDay: 'Night',
    weather: 'Rain',
    beat: '',
    tags: [],
  },
  continuity: { previous: null, next: null },
  directorNote: '',
  visualStyle: '',
};

describe('hydrateStoryboardProductionContext', () => {
  it('hydrates authoritative cast, costume, location and prop references', async () => {
    const query = async (sql: string) => {
      if (sql.includes('FROM casting_scenes')) {
        return { rows: [{
          id: 'scene-3',
          scene_number: 3,
          title: 'Nora introduseres',
          description: 'Nora studies a fossil scan.',
          setting: 'Naturhistorisk museum',
          time_of_day: 'DAY',
          int_ext: 'INT',
          characters: ['role-nora'],
          production_breakdown: {
            costumes: [{
              characterName: 'Nora',
              description: 'Paleontologist field jacket',
              referenceImageIds: ['wardrobe-file'],
            }],
            locations: [{ id: 'loc-museum', name: 'Naturhistorisk museum' }],
            props: [{ id: 'prop-fossil', name: 'Fossil scanner' }],
          },
        }] };
      }
      if (sql.includes('FROM casting_roles')) {
        return { rows: [{
          id: 'role-nora',
          name: 'Nora Tidemann',
          description: 'Paleontologist, early thirties.',
          assigned_candidate_id: 'candidate-ine',
          reference_image_url: '/api/role-room/storage/files/role-image/download',
        }] };
      }
      if (sql.includes('FROM casting_candidates')) {
        return { rows: [{
          id: 'candidate-ine',
          name: 'Ine Marie Wilmann',
          photos: ['candidate-photo'],
          assigned_roles: ['role-nora'],
        }] };
      }
      if (sql.includes('FROM casting_locations')) {
        return { rows: [{
          id: 'loc-museum',
          name: 'Naturhistorisk museum',
          address: 'Oslo',
          photos: ['location-photo'],
        }] };
      }
      if (sql.includes('FROM casting_props')) {
        return { rows: [{
          id: 'prop-fossil',
          name: 'Fossil scanner',
          description: 'Hero prop for scene 3.',
          images: ['prop-photo'],
        }] };
      }
      return { rows: [] };
    };

    const hydrated = await hydrateStoryboardProductionContext(
      { query } as any,
      { projectId: 'project-troll', sceneId: 'scene-3', context },
    );

    expect(hydrated.scene.heading).toBe('Nora introduseres');
    expect(hydrated.scene.characters).toEqual(['Nora Tidemann']);
    expect(hydrated.production.characters[0]).toMatchObject({
      id: 'role-nora',
      name: 'Nora Tidemann',
      locked: true,
    });
    expect(hydrated.production.characters[0].referenceImageIds).toEqual([
      '/api/role-room/storage/files/role-image/download',
      'candidate-photo',
    ]);
    expect(hydrated.production.wardrobe[0].description).toContain('field jacket');
    expect(hydrated.production.locations[0].referenceImageIds).toContain('location-photo');
    expect(hydrated.production.props[0].referenceImageIds).toContain('prop-photo');
  });

  it('preserves submitted references when the production catalog is empty', async () => {
    const submitted: StoryboardShotContext = {
      ...context,
      production: {
        ...context.production,
        characters: [{
          id: 'manual-character',
          name: 'Manual Character',
          description: 'Director-approved reference',
          referenceImageIds: ['manual-image'],
          locked: true,
        }],
      },
    };
    const query = async () => ({ rows: [] });
    const hydrated = await hydrateStoryboardProductionContext(
      { query } as any,
      { projectId: 'project', sceneId: 'scene', context: submitted },
    );
    expect(hydrated.production.characters).toEqual(submitted.production.characters);
  });
});
