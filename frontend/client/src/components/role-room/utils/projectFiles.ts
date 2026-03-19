export interface ProjectFileRecord {
  id: string;
  projectId?: string;
  name: string;
  originalName?: string;
  size?: number;
  mimeType?: string;
  metadata: Record<string, unknown>;
  uploadedAt?: string;
  updatedAt?: string;
  downloadUrl?: string;
}

const hasText = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

export const readProjectFileText = (...values: unknown[]): string => {
  for (const value of values) {
    if (hasText(value)) {
      return value.trim();
    }
  }
  return '';
};

export const normalizeProjectFileRecord = (value: unknown): ProjectFileRecord | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = readProjectFileText(value.id);
  const name = readProjectFileText(value.name, value.originalName);
  if (!id || !name) {
    return null;
  }

  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const sizeCandidate = value.size;
  const size = typeof sizeCandidate === 'number'
    ? sizeCandidate
    : typeof sizeCandidate === 'string'
      ? Number(sizeCandidate)
      : undefined;

  return {
    id,
    projectId: readProjectFileText(value.projectId),
    name,
    originalName: readProjectFileText(value.originalName),
    size: Number.isFinite(size) ? size : undefined,
    mimeType: readProjectFileText(value.mimeType),
    metadata,
    uploadedAt: readProjectFileText(value.uploadedAt),
    updatedAt: readProjectFileText(value.updatedAt),
    downloadUrl: readProjectFileText(value.downloadUrl),
  };
};

export const normalizeProjectFileRecords = (value: unknown): ProjectFileRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => normalizeProjectFileRecord(entry))
    .filter((entry): entry is ProjectFileRecord => entry !== null);
};

export const getProjectFileMetadataString = (
  file: ProjectFileRecord,
  ...keys: string[]
): string => {
  for (const key of keys) {
    const value = file.metadata[key];
    if (hasText(value)) {
      return value.trim();
    }
  }
  return '';
};

export const getAbsoluteProjectFileUrl = (downloadUrl?: string): string => {
  if (!hasText(downloadUrl) || typeof window === 'undefined') {
    return '';
  }

  try {
    return new URL(downloadUrl, window.location.origin).toString();
  } catch {
    return downloadUrl;
  }
};
