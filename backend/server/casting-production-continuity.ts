export class ProductionContinuityValidationError extends Error {}

const SCENE_STATUSES = new Set(['not_started', 'in_progress', 'complete']);
const TAKE_STATUSES = new Set(['good', 'hold', 'ng', 'false_start']);
const ENTRY_CATEGORIES = new Set(['costume', 'hair', 'makeup', 'props', 'blocking', 'action', 'eyeline', 'set']);
const SEVERITIES = new Set(['info', 'warning', 'critical']);
const DEVIATION_TYPES = new Set(['improvised_dialogue', 'missing_line', 'dialogue_change', 'action_change', 'continuity_risk', 'other']);
const REFERENCE_KINDS = new Set(['photo', 'video', 'other']);

export function continuityObject(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function requiredString(value: unknown, field: string, maxLength = 200): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) {
    throw new ProductionContinuityValidationError(`${field} må være mellom 1 og ${maxLength} tegn.`);
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength = 2_000): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length > maxLength) {
    throw new ProductionContinuityValidationError(`${field} kan ikke være lengre enn ${maxLength} tegn.`);
  }
  return normalized || undefined;
}

function enumValue(value: unknown, allowed: Set<string>, field: string): string {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new ProductionContinuityValidationError(`${field} har en ugyldig verdi.`);
  }
  return value;
}

function limitedArray(value: unknown, field: string, maxLength: number): unknown[] {
  if (!Array.isArray(value)) throw new ProductionContinuityValidationError(`${field} må være en liste.`);
  if (value.length > maxLength) {
    throw new ProductionContinuityValidationError(`${field} kan maksimalt inneholde ${maxLength} elementer.`);
  }
  return value;
}

function uniqueBy<T>(items: T[], key: (item: T) => string, field: string): T[] {
  const ids = new Set<string>();
  for (const item of items) {
    const id = key(item);
    if (ids.has(id)) throw new ProductionContinuityValidationError(`${field} inneholder duplikater.`);
    ids.add(id);
  }
  return items;
}

function optionalNumber(value: unknown, field: string, max: number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
    throw new ProductionContinuityValidationError(`${field} må være et gyldig positivt tall.`);
  }
  return parsed;
}

function normalizeReference(value: unknown, field: string) {
  const item = continuityObject(value);
  if (!item) throw new ProductionContinuityValidationError(`${field} er ugyldig.`);
  const storageFileId = optionalString(item.storageFileId, `${field}.storageFileId`, 36);
  if (storageFileId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storageFileId)) {
    throw new ProductionContinuityValidationError(`${field}.storageFileId er ugyldig.`);
  }
  let url: string | undefined;
  if (!storageFileId) {
    const rawUrl = requiredString(item.url, `${field}.url`, 1_000);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new ProductionContinuityValidationError(`${field}.url må være en gyldig lenke.`);
    }
    if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
      throw new ProductionContinuityValidationError(`${field}.url må bruke http eller https.`);
    }
    url = parsedUrl.toString();
  }
  return {
    id: requiredString(item.id, `${field}.id`, 120),
    kind: enumValue(item.kind, REFERENCE_KINDS, `${field}.kind`),
    url,
    storageFileId,
    storageProvider: storageFileId ? 'aws_s3' as const : undefined,
    contentType: storageFileId ? optionalString(item.contentType, `${field}.contentType`, 120) : undefined,
    sizeBytes: storageFileId ? optionalNumber(item.sizeBytes, `${field}.sizeBytes`, 250 * 1024 * 1024) : undefined,
    label: optionalString(item.label, `${field}.label`, 160),
  };
}

export function normalizeProductionContinuityOperations(value: unknown) {
  const input = continuityObject(value);
  if (!input) throw new ProductionContinuityValidationError('operations må være et objekt.');

  const sceneRecords = uniqueBy(limitedArray(input.sceneRecords, 'sceneRecords', 250).map((entry, index) => {
    const item = continuityObject(entry);
    if (!item) throw new ProductionContinuityValidationError(`sceneRecords[${index}] er ugyldig.`);
    return {
      sceneId: requiredString(item.sceneId, `sceneRecords[${index}].sceneId`, 255),
      status: enumValue(item.status, SCENE_STATUSES, `sceneRecords[${index}].status`),
      pagesPlanned: optionalNumber(item.pagesPlanned, `sceneRecords[${index}].pagesPlanned`, 10_000),
      pagesShot: optionalNumber(item.pagesShot, `sceneRecords[${index}].pagesShot`, 10_000),
      setup: optionalString(item.setup, `sceneRecords[${index}].setup`, 300),
      notes: optionalString(item.notes, `sceneRecords[${index}].notes`, 5_000),
      updatedAt: optionalString(item.updatedAt, `sceneRecords[${index}].updatedAt`, 40),
    };
  }), (item) => item.sceneId, 'sceneRecords');

  const takes = uniqueBy(limitedArray(input.takes, 'takes', 1_500).map((entry, index) => {
    const item = continuityObject(entry);
    if (!item) throw new ProductionContinuityValidationError(`takes[${index}] er ugyldig.`);
    const takeNumber = Number(item.takeNumber);
    if (!Number.isInteger(takeNumber) || takeNumber < 1 || takeNumber > 9_999) {
      throw new ProductionContinuityValidationError(`takes[${index}].takeNumber er ugyldig.`);
    }
    return {
      id: requiredString(item.id, `takes[${index}].id`, 120),
      sceneId: requiredString(item.sceneId, `takes[${index}].sceneId`, 255),
      takeNumber,
      slate: optionalString(item.slate, `takes[${index}].slate`, 80),
      cameraRoll: optionalString(item.cameraRoll, `takes[${index}].cameraRoll`, 80),
      soundRoll: optionalString(item.soundRoll, `takes[${index}].soundRoll`, 80),
      timecodeStart: optionalString(item.timecodeStart, `takes[${index}].timecodeStart`, 32),
      timecodeEnd: optionalString(item.timecodeEnd, `takes[${index}].timecodeEnd`, 32),
      durationSeconds: optionalNumber(item.durationSeconds, `takes[${index}].durationSeconds`, 86_400),
      status: enumValue(item.status, TAKE_STATUSES, `takes[${index}].status`),
      circled: item.circled === true,
      continuityNotes: optionalString(item.continuityNotes, `takes[${index}].continuityNotes`, 5_000),
      performanceNotes: optionalString(item.performanceNotes, `takes[${index}].performanceNotes`, 5_000),
      technicalNotes: optionalString(item.technicalNotes, `takes[${index}].technicalNotes`, 5_000),
      soundNotes: optionalString(item.soundNotes, `takes[${index}].soundNotes`, 5_000),
      recordedAt: optionalString(item.recordedAt, `takes[${index}].recordedAt`, 40),
      updatedAt: optionalString(item.updatedAt, `takes[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'takes');

  const entries = uniqueBy(limitedArray(input.entries, 'entries', 1_500).map((entry, index) => {
    const item = continuityObject(entry);
    if (!item) throw new ProductionContinuityValidationError(`entries[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `entries[${index}].id`, 120),
      sceneId: requiredString(item.sceneId, `entries[${index}].sceneId`, 255),
      takeId: optionalString(item.takeId, `entries[${index}].takeId`, 120),
      category: enumValue(item.category, ENTRY_CATEGORIES, `entries[${index}].category`),
      subject: optionalString(item.subject, `entries[${index}].subject`, 200),
      description: requiredString(item.description, `entries[${index}].description`, 5_000),
      severity: enumValue(item.severity, SEVERITIES, `entries[${index}].severity`),
      references: uniqueBy(limitedArray(item.references, `entries[${index}].references`, 20)
        .map((reference, referenceIndex) => normalizeReference(reference, `entries[${index}].references[${referenceIndex}]`)),
      (reference) => reference.id, `entries[${index}].references`),
      updatedAt: optionalString(item.updatedAt, `entries[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'entries');

  const deviations = uniqueBy(limitedArray(input.deviations, 'deviations', 1_500).map((entry, index) => {
    const item = continuityObject(entry);
    if (!item) throw new ProductionContinuityValidationError(`deviations[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `deviations[${index}].id`, 120),
      sceneId: requiredString(item.sceneId, `deviations[${index}].sceneId`, 255),
      takeId: optionalString(item.takeId, `deviations[${index}].takeId`, 120),
      type: enumValue(item.type, DEVIATION_TYPES, `deviations[${index}].type`),
      character: optionalString(item.character, `deviations[${index}].character`, 160),
      originalText: optionalString(item.originalText, `deviations[${index}].originalText`, 5_000),
      performedText: optionalString(item.performedText, `deviations[${index}].performedText`, 5_000),
      note: optionalString(item.note, `deviations[${index}].note`, 5_000),
      timecode: optionalString(item.timecode, `deviations[${index}].timecode`, 32),
      accepted: item.accepted === true,
      updatedAt: optionalString(item.updatedAt, `deviations[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'deviations');

  const takeIds = new Set(takes.map((take) => take.id));
  const sceneIds = new Set(sceneRecords.map((scene) => scene.sceneId));
  const takeById = new Map(takes.map((take) => [take.id, take]));
  const takeNumbers = new Set<string>();
  for (const take of takes) {
    if (!sceneIds.has(take.sceneId)) throw new ProductionContinuityValidationError(`Scene ${take.sceneId} finnes ikke i sceneRecords.`);
    const key = `${take.sceneId}:${take.takeNumber}`;
    if (takeNumbers.has(key)) throw new ProductionContinuityValidationError(`Scene ${take.sceneId} har flere takes med nummer ${take.takeNumber}.`);
    takeNumbers.add(key);
  }
  for (const item of [...entries, ...deviations]) {
    if (!sceneIds.has(item.sceneId)) throw new ProductionContinuityValidationError(`Scene ${item.sceneId} finnes ikke i sceneRecords.`);
    if (item.takeId && !takeIds.has(item.takeId)) throw new ProductionContinuityValidationError(`Take ${item.takeId} finnes ikke i take-loggen.`);
    if (item.takeId && takeById.get(item.takeId)?.sceneId !== item.sceneId) {
      throw new ProductionContinuityValidationError(`Take ${item.takeId} tilhører en annen scene.`);
    }
  }

  return {
    sceneRecords,
    takes,
    entries,
    deviations,
    dailyNotes: optionalString(input.dailyNotes, 'dailyNotes', 10_000),
    editorNotes: optionalString(input.editorNotes, 'editorNotes', 10_000),
  };
}

export function normalizeContinuityComment(value: unknown) {
  const input = continuityObject(value);
  if (!input) throw new ProductionContinuityValidationError('Kommentaren er ugyldig.');
  return {
    sceneId: optionalString(input.sceneId, 'sceneId', 255),
    takeId: optionalString(input.takeId, 'takeId', 120),
    message: requiredString(input.message, 'message', 2_000),
  };
}

function safeDate(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().slice(0, 40) : '';
  return normalized || new Date(0).toISOString();
}

export function readContinuityActivity(value: unknown) {
  return (Array.isArray(value) ? value : []).map((entry) => {
    const item = continuityObject(entry);
    if (!item) return null;
    const type = item.type === 'comment_added' ? 'comment_added' : item.type === 'workspace_saved' ? 'workspace_saved' : null;
    const id = typeof item.id === 'string' ? item.id.trim().slice(0, 120) : '';
    const message = typeof item.message === 'string' ? item.message.trim().slice(0, 300) : '';
    if (!type || !id || !message) return null;
    return { id, type, message, actorUserId: optionalString(item.actorUserId, 'actorUserId', 255), createdAt: safeDate(item.createdAt) };
  }).filter((entry) => entry !== null).slice(-99);
}

export function readContinuityComments(value: unknown) {
  return (Array.isArray(value) ? value : []).map((entry) => {
    const item = continuityObject(entry);
    if (!item) return null;
    const id = typeof item.id === 'string' ? item.id.trim().slice(0, 120) : '';
    const message = typeof item.message === 'string' ? item.message.trim().slice(0, 2_000) : '';
    if (!id || !message) return null;
    return {
      id,
      sceneId: optionalString(item.sceneId, 'sceneId', 255),
      takeId: optionalString(item.takeId, 'takeId', 120),
      message,
      actorUserId: optionalString(item.actorUserId, 'actorUserId', 255),
      createdAt: safeDate(item.createdAt),
    };
  }).filter((entry) => entry !== null).slice(-500);
}

export function readContinuityRevisions(value: unknown) {
  return (Array.isArray(value) ? value : []).map((entry) => {
    const item = continuityObject(entry);
    if (!item || !Number.isInteger(Number(item.version))) return null;
    try {
      return {
        id: requiredString(item.id, 'revision.id', 120),
        version: Number(item.version),
        message: requiredString(item.message, 'revision.message', 300),
        actorUserId: optionalString(item.actorUserId, 'revision.actorUserId', 255),
        createdAt: safeDate(item.createdAt),
        snapshot: normalizeProductionContinuityOperations(item.snapshot),
      };
    } catch {
      return null;
    }
  }).filter((entry) => entry !== null).slice(-8);
}

export function summarizeContinuityChanges(previous: Record<string, any> | null, next: Record<string, any>): string {
  const changed: string[] = [];
  if (JSON.stringify(previous?.sceneRecords ?? []) !== JSON.stringify(next.sceneRecords)) changed.push('scenestatus');
  if (JSON.stringify(previous?.takes ?? []) !== JSON.stringify(next.takes)) changed.push('takes');
  if (JSON.stringify(previous?.entries ?? []) !== JSON.stringify(next.entries)) changed.push('kontinuitet');
  if (JSON.stringify(previous?.deviations ?? []) !== JSON.stringify(next.deviations)) changed.push('manusavvik');
  if ((previous?.dailyNotes ?? '') !== (next.dailyNotes ?? '')) changed.push('dagsnotat');
  if ((previous?.editorNotes ?? '') !== (next.editorNotes ?? '')) changed.push('klippernotat');
  return changed.length > 0
    ? `Oppdaterte ${changed.join(', ')}.`
    : 'Lagret kontinuitetsflaten uten innholdsendringer.';
}
