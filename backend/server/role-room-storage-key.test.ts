import { describe, expect, it } from 'vitest';

import {
  canonicalizeRoleRoomR2StorageKey,
  canonicalizeRoleRoomStorageKey,
  roleRoomContinuityMediaKey,
} from './role-room-storage-key.js';

describe('The Role Room S3 storage keys', () => {
  it('scopes continuity media to tenant, project, day, scene and uploader', () => {
    const key = roleRoomContinuityMediaKey({
      organizationId: 'org-1',
      userId: 'script-supervisor-1',
      projectId: 'Troll / demo',
      productionDayId: 'day-1',
      sceneId: '../scene/12',
      objectId: 'd3efb938-96b7-468e-85b2-c36ce0903d26',
      fileName: 'Lykt før take.jpg',
    });

    expect(key).toBe(
      'organizations/org-1/projects/Troll-demo/production/continuity/production-days/day-1/scenes/scene-12/uploads/script-supervisor-1/d3efb938-96b7-468e-85b2-c36ce0903d26-Lykt-f-r-take.jpg',
    );
    expect(key).not.toContain('../');
  });

  it('maps legacy private files without retaining original names', () => {
    const key = canonicalizeRoleRoomStorageKey(
      'users/user-1/11111111-1111-4111-8111-111111111111-private-name.jpg',
    );
    expect(key).toBe(
      'users/user-1/files/11111111-1111-4111-8111-111111111111/original.jpg',
    );
    expect(key).not.toContain('private-name');
  });

  it('maps historical Pro Tools R2 bounces into the private user hierarchy', () => {
    expect(canonicalizeRoleRoomR2StorageKey(
      'casting-videos',
      'protools-bounces/user-id/bounce-id/private-name.wav',
    )).toBe('users/user-id/services/protools/bounces/bounce-id/original.wav');
  });
});
