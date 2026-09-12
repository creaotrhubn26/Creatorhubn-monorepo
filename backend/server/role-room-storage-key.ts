import { storageSegment } from './creatorhub-storage-key.js';

/** Canonical private key for continuity media in The Role Room's own S3 bucket. */
export function roleRoomContinuityMediaKey(input: {
  organizationId?: string | null;
  userId: string;
  projectId: string;
  productionDayId: string;
  sceneId: string;
  objectId: string;
  fileName: string;
}): string {
  const user = storageSegment(input.userId, 'unknown-user');
  const organization = storageSegment(input.organizationId, `personal-${user}`);
  return [
    'organizations',
    organization,
    'projects',
    storageSegment(input.projectId, 'unassigned'),
    'production',
    'continuity',
    'production-days',
    storageSegment(input.productionDayId, 'unknown-day'),
    'scenes',
    storageSegment(input.sceneId, 'unknown-scene'),
    'uploads',
    user,
    `${storageSegment(input.objectId, 'object')}-${storageSegment(input.fileName, 'reference')}`,
  ].join('/');
}
