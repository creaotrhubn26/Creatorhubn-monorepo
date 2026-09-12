import { describe, expect, it } from 'vitest';

import { roleRoomContinuityMediaKey } from './role-room-storage-key.js';

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
});
