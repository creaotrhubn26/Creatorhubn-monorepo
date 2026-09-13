import crypto from 'node:crypto';
import { storageSegment } from './creatorhub-storage-key.js';

function opaqueUuid(value: string): string {
  const hex = crypto.createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const compact = hex.join('');
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

function safeExtension(value: string, fallback = 'bin'): string {
  return value.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || fallback;
}

/** Deterministically maps historical B2 keys into the private S3 hierarchy. */
export function canonicalizeRoleRoomStorageKey(key: string): string {
  const normalized = key.trim().replace(/^\/+/, '');
  if (!normalized) throw new Error('Storage key cannot be empty');

  if (/^(platform|organizations|agencies|users|talents|projects|workspaces|education|temporary|quarantine|exports|_system)\//.test(normalized)) {
    const legacyUserFile = normalized.match(/^users\/([^/]+)\/([0-9a-f-]{36})-[^/]+\.([a-z0-9]{1,8})$/i);
    if (legacyUserFile) {
      return `users/${legacyUserFile[1]}/files/${legacyUserFile[2]}/original.${legacyUserFile[3].toLowerCase()}`;
    }
    if (!normalized.startsWith('workspaces/') && !normalized.startsWith('users/')) return normalized;
    if (/^users\/[^/]+\/(files|projects|profile|sound-room)\//.test(normalized)) return normalized;
    if (normalized.startsWith('workspaces/')) return normalized;
  }

  if (normalized.startsWith('models/')) {
    return `platform/models/legacy-b2/${normalized.slice('models/'.length)}`;
  }
  if (normalized.startsWith('downloads/post-agent/')) {
    return `platform/releases/post-agent/${normalized.slice('downloads/post-agent/'.length)}`;
  }
  if (normalized.startsWith('downloads/')) {
    return `platform/releases/${normalized.slice('downloads/'.length)}`;
  }
  if (normalized.startsWith('photo-enhancer-staging/')) {
    return `platform/staging/photo-enhancer/${opaqueUuid(normalized)}/source.${safeExtension(normalized)}`;
  }

  const workspace = normalized.match(/^workspace\/([^/]+)\/storyboards\/([^/]+)\/animation-sources\/([^/]+)$/);
  if (workspace) {
    const workspaceId = opaqueUuid(`workspace:${workspace[1]}`);
    const assetId = opaqueUuid(`asset:${normalized}`);
    return `workspaces/${workspaceId}/storyboards/${workspace[2]}/animation-sources/${assetId}/source.${safeExtension(workspace[3])}`;
  }

  const legacyId = opaqueUuid(`legacy:${normalized}`);
  const topLevel = normalized.split('/', 1)[0].replace(/[^a-z0-9-]/gi, '-').toLowerCase() || 'unknown';
  return `platform/archives/${topLevel}/${legacyId}/original.${safeExtension(normalized)}`;
}

/** Canonical map for the historical Cloudflare R2 buckets. */
export function canonicalizeRoleRoomR2StorageKey(bucket: string, key: string): string {
  const normalized = key.trim().replace(/^\/+/, '');
  if (!normalized) return `platform/imports/${bucket}/${opaqueUuid(`${bucket}:empty`)}/marker`;

  if (bucket === 'ml-models') {
    if (normalized.startsWith('models/')) return `platform/models/${normalized.slice(7)}`;
    if (normalized.startsWith('Sam-3D/')) return `platform/models/sam-3d/${normalized.slice(7)}`;
    if (normalized.startsWith('datasets/')) return `platform/datasets/${normalized.slice(9)}`;
    if (normalized.startsWith('assets/')) return `platform/assets/${normalized.slice(7)}`;
    if (normalized.startsWith('generated-assets/')) return `platform/assets/generated/${normalized.slice(17)}`;
    if (normalized.startsWith('logos/')) return `platform/assets/logos/${normalized.slice(6)}`;
    if (normalized.startsWith('props/')) return `platform/assets/props/${normalized.slice(6)}`;
    if (normalized.startsWith('photo-enhancer/')) {
      return `platform/staging/photo-enhancer/${opaqueUuid(normalized)}/source.${safeExtension(normalized)}`;
    }
    return `platform/models/legacy/${normalized}`;
  }

  if (bucket === 'ml-models2') return `platform/models/${normalized}`;
  if (bucket === 'casting-videos') {
    const personal = normalized.match(/^(uploads|protools-bounces)\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (personal) {
      const service = personal[1] === 'protools-bounces' ? 'protools/bounces' : 'casting/uploads';
      return `users/${personal[2]}/services/${service}/${personal[3]}/original.${safeExtension(personal[4])}`;
    }
    if (normalized.startsWith('photo-enhancer/')) {
      return `platform/staging/photo-enhancer/${opaqueUuid(normalized)}/source.${safeExtension(normalized)}`;
    }
    return `platform/services/casting/${normalized}`;
  }

  if (bucket === 'theroleroom' || bucket === 'role-room-storyboards') {
    if (normalized.endsWith('/')) {
      return `platform/assets/storyboards/_system/${opaqueUuid(`${bucket}:${normalized}`)}/marker`;
    }
    return `platform/assets/storyboards/${normalized.replace(/^storyboard_?assets\//, '')}`;
  }

  return `platform/imports/${bucket}/${opaqueUuid(`${bucket}:${normalized}`)}/original.${safeExtension(normalized)}`;
}

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
