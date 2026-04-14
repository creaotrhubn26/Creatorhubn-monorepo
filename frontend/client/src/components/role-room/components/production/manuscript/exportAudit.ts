import { z } from 'zod';

import {
  buildProductionScopedPreferenceKey,
  PRODUCTION_STORAGE_KEYS,
} from '../storageKeys';

export const PRODUCTION_EXPORT_SOURCE_VERSION = 'production-manuscript-v2';
export const CALL_SHEET_EXPORT_SCHEMA_VERSION = 2;

const PRODUCTION_EXPORT_AUDIT_VERSION = 1;
const MAX_AUDIT_ENTRIES = 100;

const PRODUCTION_EXPORT_KINDS = [
  'production-data',
  'selected-scenes',
  'script-text',
  'call-sheet-json',
  'call-sheet-pdf',
  'call-sheet-preview',
  'print',
] as const;

const PRODUCTION_EXPORT_TRIGGERS = [
  'button',
  'dialog',
  'shortcut',
  'workflow',
] as const;

export type ProductionExportKind = typeof PRODUCTION_EXPORT_KINDS[number];
export type ProductionExportTrigger = typeof PRODUCTION_EXPORT_TRIGGERS[number];

const auditEntrySchema = z.object({
  exportId: z.string().min(1),
  kind: z.enum(PRODUCTION_EXPORT_KINDS),
  projectId: z.string().optional(),
  targetId: z.string().optional(),
  fileName: z.string().optional(),
  createdAt: z.string().min(1),
  sourceVersion: z.string().min(1),
  schemaVersion: z.number().int().positive().optional(),
  sceneCount: z.number().int().nonnegative().optional(),
  shotCount: z.number().int().nonnegative().optional(),
  trigger: z.enum(PRODUCTION_EXPORT_TRIGGERS),
});

const auditLogSchema = z.object({
  version: z.literal(PRODUCTION_EXPORT_AUDIT_VERSION),
  entries: z.array(auditEntrySchema),
});

export type ProductionExportAuditEntry = z.infer<typeof auditEntrySchema>;

interface BuildStableExportIdInput {
  kind: ProductionExportKind;
  projectId?: string;
  targetId?: string;
  sourceVersion?: string;
  schemaVersion?: number;
  payload?: unknown;
}

interface CreateProductionExportAuditEntryInput extends BuildStableExportIdInput {
  exportId?: string;
  fileName?: string;
  createdAt?: string;
  sceneCount?: number;
  shotCount?: number;
  trigger: ProductionExportTrigger;
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
};

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const buildStableExportId = ({
  kind,
  projectId,
  targetId,
  sourceVersion = PRODUCTION_EXPORT_SOURCE_VERSION,
  schemaVersion,
  payload,
}: BuildStableExportIdInput): string => {
  const fingerprint = stableStringify({
    kind,
    payload,
    projectId: projectId || 'global',
    schemaVersion,
    sourceVersion,
    targetId: targetId || 'all',
  });
  return `pmv_${kind.replace(/[^a-z0-9]+/g, '_')}_${stableHash(fingerprint)}`;
};

export const createProductionExportAuditEntry = ({
  kind,
  projectId,
  targetId,
  fileName,
  createdAt = new Date().toISOString(),
  sourceVersion = PRODUCTION_EXPORT_SOURCE_VERSION,
  schemaVersion,
  sceneCount,
  shotCount,
  trigger,
  payload,
  exportId,
}: CreateProductionExportAuditEntryInput): ProductionExportAuditEntry => ({
  exportId: exportId ?? buildStableExportId({
    kind,
    payload,
    projectId,
    schemaVersion,
    sourceVersion,
    targetId,
  }),
  kind,
  projectId,
  targetId,
  fileName,
  createdAt,
  sourceVersion,
  schemaVersion,
  sceneCount,
  shotCount,
  trigger,
});

export const recordProductionExportAudit = (
  entry: ProductionExportAuditEntry,
  projectId?: string,
): void => {
  try {
    const key = buildProductionScopedPreferenceKey(
      PRODUCTION_STORAGE_KEYS.manuscriptExportAudit,
      projectId,
    );
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? auditLogSchema.safeParse(JSON.parse(raw)) : null;
    const entries = parsed?.success ? parsed.data.entries : [];
    const nextLog = {
      version: PRODUCTION_EXPORT_AUDIT_VERSION,
      entries: [entry, ...entries].slice(0, MAX_AUDIT_ENTRIES),
    };
    window.localStorage.setItem(key, JSON.stringify(nextLog));
  } catch {
    // Audit must never block the actual export/download path.
  }
};

export const sanitizeDownloadFileName = (
  fileName: string,
  fallbackFileName = 'production-export.json',
): string => {
  const trimmed = fileName.trim();
  const source = trimmed || fallbackFileName;
  const sanitized = source
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim();

  return sanitized || fallbackFileName;
};

export const downloadExportBlob = (
  blob: Blob,
  fileName: string,
  revokeDelayMs = 1000,
): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = sanitizeDownloadFileName(fileName);
    link.rel = 'noopener';
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), revokeDelayMs);
  }
};
