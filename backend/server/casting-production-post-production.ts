export const POST_TURNOVER_STATUSES = [
  'draft',
  'ready',
  'received',
  'qc_issues',
  'accepted',
  'superseded',
] as const;

export const POST_QC_SEVERITIES = ['note', 'warning', 'blocker'] as const;

export type PostTurnoverStatus = (typeof POST_TURNOVER_STATUSES)[number];
export type PostQcSeverity = (typeof POST_QC_SEVERITIES)[number];

export interface PostTurnoverMediaSnapshot {
  mediaId: string;
  storageObjectId: string;
  displayName: string;
  checksumSha256: string;
  sizeBytes: number;
  reconciliationStatus: 'unmatched' | 'matched';
  continuityTakeId?: string;
  createdAt: string;
}

export interface PostTurnoverSourceSnapshot {
  productionDayId: string;
  soundVersion: number;
  capturedAt: string;
  /** Every active media ID visible when the deliberate selection was made. */
  availableMediaIds: string[];
  media: PostTurnoverMediaSnapshot[];
}

export interface PostQcIssue {
  id: string;
  severity: PostQcSeverity;
  message: string;
  status: 'open' | 'resolved';
  createdBy: string;
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface PostTurnoverEvent {
  id: string;
  type: 'created' | 'status_changed' | 'source_refreshed' | 'qc_issue_added' | 'qc_issue_resolved';
  message: string;
  actorUserId: string;
  createdAt: string;
}

export interface PostTurnoverManifest {
  id: string;
  label: string;
  recipient?: string;
  notes?: string;
  status: PostTurnoverStatus;
  source: PostTurnoverSourceSnapshot;
  issues: PostQcIssue[];
  events: PostTurnoverEvent[];
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface PostProductionOperations {
  turnovers: PostTurnoverManifest[];
}

export type PostTurnoverImpactCode =
  | 'production_day_missing'
  | 'sound_report_changed'
  | 'media_missing'
  | 'media_changed'
  | 'media_reconciliation_changed'
  | 'new_media_available';

export interface PostTurnoverImpactItem {
  code: PostTurnoverImpactCode;
  severity: 'warning' | 'blocking';
  message: string;
  mediaId?: string;
}

export interface PostTurnoverImpact {
  stale: boolean;
  blocking: boolean;
  items: PostTurnoverImpactItem[];
}

export type PostProductionCommand =
  | {
      type: 'create_turnover';
      label: string;
      recipient?: string;
      notes?: string;
      source: PostTurnoverSourceSnapshot;
    }
  | {
      type: 'transition_turnover';
      turnoverId: string;
      status: PostTurnoverStatus;
      impact: PostTurnoverImpact;
    }
  | {
      type: 'refresh_turnover';
      turnoverId: string;
      source: PostTurnoverSourceSnapshot;
    }
  | {
      type: 'add_qc_issue';
      turnoverId: string;
      severity: PostQcSeverity;
      message: string;
    }
  | {
      type: 'resolve_qc_issue';
      turnoverId: string;
      issueId: string;
    };

export type ParsedPostProductionCommand =
  | {
      type: 'create_turnover';
      label: string;
      recipient?: string;
      notes?: string;
      productionDayId: string;
      mediaIds: string[];
    }
  | { type: 'transition_turnover'; turnoverId: string; status: PostTurnoverStatus }
  | { type: 'refresh_turnover'; turnoverId: string }
  | { type: 'add_qc_issue'; turnoverId: string; severity: PostQcSeverity; message: string }
  | { type: 'resolve_qc_issue'; turnoverId: string; issueId: string };

export interface PostCommandContext {
  actorUserId: string;
  now: string;
  createId: (prefix: string) => string;
}

export class PostProductionValidationError extends Error {}
export class PostProductionTransitionError extends Error {}

const STATUSES = new Set<string>(POST_TURNOVER_STATUSES);
const SEVERITIES = new Set<string>(POST_QC_SEVERITIES);

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) {
    throw new PostProductionValidationError(`${field} må være mellom 1 og ${maxLength} tegn.`);
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) {
    throw new PostProductionValidationError(`${field} kan ikke være lengre enn ${maxLength} tegn.`);
  }
  return normalized;
}

function timestamp(value: unknown, field: string): string {
  const normalized = requiredString(value, field, 40);
  if (!Number.isFinite(Date.parse(normalized))) {
    throw new PostProductionValidationError(`${field} må være et gyldig tidspunkt.`);
  }
  return normalized;
}

function integer(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new PostProductionValidationError(`${field} må være et ikke-negativt heltall.`);
  }
  return number;
}

function positiveInteger(value: unknown, field: string): number {
  const number = integer(value, field);
  if (number === 0) {
    throw new PostProductionValidationError(`${field} må være større enn null.`);
  }
  return number;
}

function sha256(value: unknown, field: string): string {
  const normalized = requiredString(value, field, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new PostProductionValidationError(`${field} må være en gyldig SHA-256-kontrollsum.`);
  }
  return normalized;
}

function enumValue<T extends string>(value: unknown, allowed: Set<string>, field: string): T {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new PostProductionValidationError(`${field} har en ugyldig verdi.`);
  }
  return value as T;
}

function limitedArray(value: unknown, field: string, maxLength: number): unknown[] {
  if (!Array.isArray(value)) throw new PostProductionValidationError(`${field} må være en liste.`);
  if (value.length > maxLength) {
    throw new PostProductionValidationError(`${field} kan maksimalt inneholde ${maxLength} elementer.`);
  }
  return value;
}

function normalizeSource(value: unknown, field: string): PostTurnoverSourceSnapshot {
  const input = asObject(value);
  if (!input) throw new PostProductionValidationError(`${field} må være et objekt.`);
  const media = limitedArray(input.media, `${field}.media`, 2_000).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new PostProductionValidationError(`${field}.media[${index}] er ugyldig.`);
    const reconciliationStatus = enumValue<'unmatched' | 'matched'>(
      item.reconciliationStatus,
      new Set(['unmatched', 'matched']),
      `${field}.media[${index}].reconciliationStatus`,
    );
    return {
      mediaId: requiredString(item.mediaId, `${field}.media[${index}].mediaId`, 120),
      storageObjectId: requiredString(item.storageObjectId, `${field}.media[${index}].storageObjectId`, 120),
      displayName: requiredString(item.displayName, `${field}.media[${index}].displayName`, 255),
      checksumSha256: sha256(item.checksumSha256, `${field}.media[${index}].checksumSha256`),
      sizeBytes: positiveInteger(item.sizeBytes, `${field}.media[${index}].sizeBytes`),
      reconciliationStatus,
      continuityTakeId: optionalString(item.continuityTakeId, `${field}.media[${index}].continuityTakeId`, 120),
      createdAt: timestamp(item.createdAt, `${field}.media[${index}].createdAt`),
    };
  });
  if (new Set(media.map((item) => item.mediaId)).size !== media.length) {
    throw new PostProductionValidationError(`${field}.media inneholder duplikater.`);
  }
  const availableMediaIds = [...new Set(
    limitedArray(input.availableMediaIds ?? media.map((item) => item.mediaId), `${field}.availableMediaIds`, 2_000)
      .map((id, index) => requiredString(id, `${field}.availableMediaIds[${index}]`, 120)),
  )];
  if (media.some((item) => !availableMediaIds.includes(item.mediaId))) {
    throw new PostProductionValidationError(`${field}.media inneholder en fil som ikke var tilgjengelig ved snapshot.`);
  }
  return {
    productionDayId: requiredString(input.productionDayId, `${field}.productionDayId`, 255),
    soundVersion: integer(input.soundVersion, `${field}.soundVersion`),
    capturedAt: timestamp(input.capturedAt, `${field}.capturedAt`),
    availableMediaIds,
    media,
  };
}

function normalizeIssue(value: unknown, field: string): PostQcIssue {
  const item = asObject(value);
  if (!item) throw new PostProductionValidationError(`${field} er ugyldig.`);
  const status = enumValue<'open' | 'resolved'>(item.status, new Set(['open', 'resolved']), `${field}.status`);
  return {
    id: requiredString(item.id, `${field}.id`, 120),
    severity: enumValue<PostQcSeverity>(item.severity, SEVERITIES, `${field}.severity`),
    message: requiredString(item.message, `${field}.message`, 2_000),
    status,
    createdBy: requiredString(item.createdBy, `${field}.createdBy`, 255),
    createdAt: timestamp(item.createdAt, `${field}.createdAt`),
    resolvedBy: status === 'resolved' ? requiredString(item.resolvedBy, `${field}.resolvedBy`, 255) : undefined,
    resolvedAt: status === 'resolved' ? timestamp(item.resolvedAt, `${field}.resolvedAt`) : undefined,
  };
}

function normalizeEvent(value: unknown, field: string): PostTurnoverEvent {
  const item = asObject(value);
  if (!item) throw new PostProductionValidationError(`${field} er ugyldig.`);
  return {
    id: requiredString(item.id, `${field}.id`, 120),
    type: enumValue<PostTurnoverEvent['type']>(
      item.type,
      new Set(['created', 'status_changed', 'source_refreshed', 'qc_issue_added', 'qc_issue_resolved']),
      `${field}.type`,
    ),
    message: requiredString(item.message, `${field}.message`, 500),
    actorUserId: requiredString(item.actorUserId, `${field}.actorUserId`, 255),
    createdAt: timestamp(item.createdAt, `${field}.createdAt`),
  };
}

export function emptyPostProductionOperations(): PostProductionOperations {
  return { turnovers: [] };
}

/** Persisted state is defensive-normalized on every read. */
export function normalizePostProductionOperations(value: unknown): PostProductionOperations {
  const input = asObject(value);
  if (!input) throw new PostProductionValidationError('operations må være et objekt.');
  const turnovers = limitedArray(input.turnovers ?? [], 'turnovers', 500).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new PostProductionValidationError(`turnovers[${index}] er ugyldig.`);
    const issues = limitedArray(item.issues ?? [], `turnovers[${index}].issues`, 500)
      .map((issue, issueIndex) => normalizeIssue(issue, `turnovers[${index}].issues[${issueIndex}]`));
    const events = limitedArray(item.events ?? [], `turnovers[${index}].events`, 500)
      .map((event, eventIndex) => normalizeEvent(event, `turnovers[${index}].events[${eventIndex}]`));
    return {
      id: requiredString(item.id, `turnovers[${index}].id`, 120),
      label: requiredString(item.label, `turnovers[${index}].label`, 240),
      recipient: optionalString(item.recipient, `turnovers[${index}].recipient`, 240),
      notes: optionalString(item.notes, `turnovers[${index}].notes`, 5_000),
      status: enumValue<PostTurnoverStatus>(item.status, STATUSES, `turnovers[${index}].status`),
      source: normalizeSource(item.source, `turnovers[${index}].source`),
      issues,
      events,
      createdBy: requiredString(item.createdBy, `turnovers[${index}].createdBy`, 255),
      createdAt: timestamp(item.createdAt, `turnovers[${index}].createdAt`),
      updatedBy: requiredString(item.updatedBy, `turnovers[${index}].updatedBy`, 255),
      updatedAt: timestamp(item.updatedAt, `turnovers[${index}].updatedAt`),
    };
  });
  if (new Set(turnovers.map((item) => item.id)).size !== turnovers.length) {
    throw new PostProductionValidationError('turnovers inneholder duplikater.');
  }
  return { turnovers };
}

export function parsePostProductionCommand(value: unknown): ParsedPostProductionCommand {
  const input = asObject(value);
  if (!input) throw new PostProductionValidationError('command må være et objekt.');
  const type = requiredString(input.type, 'command.type', 60);
  if (type === 'create_turnover') {
    const mediaIds = limitedArray(input.mediaIds ?? [], 'command.mediaIds', 2_000)
      .map((id, index) => requiredString(id, `command.mediaIds[${index}]`, 120));
    return {
      type,
      label: requiredString(input.label, 'command.label', 240),
      recipient: optionalString(input.recipient, 'command.recipient', 240),
      notes: optionalString(input.notes, 'command.notes', 5_000),
      productionDayId: requiredString(input.productionDayId, 'command.productionDayId', 255),
      mediaIds: [...new Set(mediaIds)],
    };
  }
  const turnoverId = requiredString(input.turnoverId, 'command.turnoverId', 120);
  if (type === 'transition_turnover') {
    return {
      type,
      turnoverId,
      status: enumValue<PostTurnoverStatus>(input.status, STATUSES, 'command.status'),
    };
  }
  if (type === 'refresh_turnover') return { type, turnoverId };
  if (type === 'add_qc_issue') {
    return {
      type,
      turnoverId,
      severity: enumValue<PostQcSeverity>(input.severity, SEVERITIES, 'command.severity'),
      message: requiredString(input.message, 'command.message', 2_000),
    };
  }
  if (type === 'resolve_qc_issue') {
    return {
      type,
      turnoverId,
      issueId: requiredString(input.issueId, 'command.issueId', 120),
    };
  }
  throw new PostProductionValidationError('command.type har en ugyldig verdi.');
}

const TRANSITIONS: Record<PostTurnoverStatus, readonly PostTurnoverStatus[]> = {
  draft: ['ready', 'superseded'],
  ready: ['received', 'superseded'],
  received: ['accepted', 'superseded'],
  qc_issues: ['ready', 'superseded'],
  accepted: ['superseded'],
  superseded: [],
};

function event(
  context: PostCommandContext,
  type: PostTurnoverEvent['type'],
  message: string,
): PostTurnoverEvent {
  return {
    id: context.createId('post-event'),
    type,
    message,
    actorUserId: context.actorUserId,
    createdAt: context.now,
  };
}

function updateTurnover(
  operations: PostProductionOperations,
  turnoverId: string,
  update: (turnover: PostTurnoverManifest) => PostTurnoverManifest,
): PostProductionOperations {
  const index = operations.turnovers.findIndex((turnover) => turnover.id === turnoverId);
  if (index < 0) throw new PostProductionValidationError('Turnover-manifestet finnes ikke.');
  const turnovers = [...operations.turnovers];
  turnovers[index] = update(turnovers[index]);
  return { turnovers };
}

export function applyPostProductionCommand(
  operations: PostProductionOperations,
  command: PostProductionCommand,
  context: PostCommandContext,
): PostProductionOperations {
  if (command.type === 'create_turnover') {
    if (command.source.media.length === 0) {
      throw new PostProductionValidationError('Velg minst én aktiv recorderfil til turnoveren.');
    }
    const manifest: PostTurnoverManifest = {
      id: context.createId('post-turnover'),
      label: command.label,
      recipient: command.recipient,
      notes: command.notes,
      status: 'draft',
      source: command.source,
      issues: [],
      events: [event(context, 'created', `Opprettet turnover «${command.label}».`)],
      createdBy: context.actorUserId,
      createdAt: context.now,
      updatedBy: context.actorUserId,
      updatedAt: context.now,
    };
    return { turnovers: [manifest, ...operations.turnovers].slice(0, 500) };
  }

  return updateTurnover(operations, command.turnoverId, (turnover) => {
    if (turnover.status === 'superseded') {
      throw new PostProductionTransitionError('Et erstattet manifest kan ikke endres.');
    }
    if (command.type === 'transition_turnover') {
      if (!TRANSITIONS[turnover.status].includes(command.status)) {
        throw new PostProductionTransitionError(`Overgangen ${turnover.status} → ${command.status} er ikke tillatt.`);
      }
      const openIssues = turnover.issues.filter((issue) => issue.status === 'open');
      if (['ready', 'received', 'accepted'].includes(command.status) && command.impact.stale) {
        throw new PostProductionTransitionError('Kildegrunnlaget er endret. Oppdater manifestet før neste steg.');
      }
      if (command.status === 'ready' && openIssues.length > 0) {
        throw new PostProductionTransitionError('Alle QC-avvik må løses før manifestet kan gjøres klart igjen.');
      }
      if (command.status === 'accepted' && openIssues.length > 0) {
        throw new PostProductionTransitionError('Et manifest med åpne QC-avvik kan ikke godkjennes.');
      }
      return {
        ...turnover,
        status: command.status,
        updatedBy: context.actorUserId,
        updatedAt: context.now,
        events: [...turnover.events, event(context, 'status_changed', `Status: ${turnover.status} → ${command.status}.`)].slice(-500),
      };
    }
    if (command.type === 'refresh_turnover') {
      const hasOpenIssues = turnover.issues.some((issue) => issue.status === 'open');
      return {
        ...turnover,
        source: command.source,
        status: hasOpenIssues ? 'qc_issues' : 'draft',
        updatedBy: context.actorUserId,
        updatedAt: context.now,
        events: [...turnover.events, event(context, 'source_refreshed', 'Oppdaterte manifestet mot gjeldende lydgrunnlag.')].slice(-500),
      };
    }
    if (command.type === 'add_qc_issue') {
      if (!['received', 'qc_issues'].includes(turnover.status)) {
        throw new PostProductionTransitionError('QC-avvik kan registreres etter at turnoveren er mottatt.');
      }
      const issue: PostQcIssue = {
        id: context.createId('post-qc'),
        severity: command.severity,
        message: command.message,
        status: 'open',
        createdBy: context.actorUserId,
        createdAt: context.now,
      };
      return {
        ...turnover,
        status: 'qc_issues',
        issues: [...turnover.issues, issue].slice(-500),
        updatedBy: context.actorUserId,
        updatedAt: context.now,
        events: [...turnover.events, event(context, 'qc_issue_added', `QC-avvik: ${command.message}`)].slice(-500),
      };
    }
    const issue = turnover.issues.find((candidate) => candidate.id === command.issueId);
    if (!issue) throw new PostProductionValidationError('QC-avviket finnes ikke.');
    if (issue.status === 'resolved') return turnover;
    return {
      ...turnover,
      issues: turnover.issues.map((candidate) => candidate.id === command.issueId
        ? { ...candidate, status: 'resolved', resolvedBy: context.actorUserId, resolvedAt: context.now }
        : candidate),
      updatedBy: context.actorUserId,
      updatedAt: context.now,
      events: [...turnover.events, event(context, 'qc_issue_resolved', `Løste QC-avvik: ${issue.message}`)].slice(-500),
    };
  });
}

export function collectPostTurnoverImpact(
  snapshot: PostTurnoverSourceSnapshot,
  current: PostTurnoverSourceSnapshot | null,
): PostTurnoverImpact {
  const items: PostTurnoverImpactItem[] = [];
  if (!current) {
    items.push({
      code: 'production_day_missing',
      severity: 'blocking',
      message: 'Produksjonsdagen finnes ikke lenger.',
    });
  } else {
    if (snapshot.soundVersion !== current.soundVersion) {
      items.push({
        code: 'sound_report_changed',
        severity: 'warning',
        message: `Lydrapporten er endret fra versjon ${snapshot.soundVersion} til ${current.soundVersion}.`,
      });
    }
    const currentById = new Map(current.media.map((media) => [media.mediaId, media]));
    for (const media of snapshot.media) {
      const live = currentById.get(media.mediaId);
      if (!live) {
        items.push({
          code: 'media_missing',
          severity: 'blocking',
          mediaId: media.mediaId,
          message: `${media.displayName} finnes ikke lenger i aktiv lagring.`,
        });
      } else if (live.checksumSha256 !== media.checksumSha256 || live.sizeBytes !== media.sizeBytes) {
        items.push({
          code: 'media_changed',
          severity: 'blocking',
          mediaId: media.mediaId,
          message: `${media.displayName} samsvarer ikke med kontrollsummen i manifestet.`,
        });
      } else if (
        live.reconciliationStatus !== media.reconciliationStatus
        || live.continuityTakeId !== media.continuityTakeId
      ) {
        items.push({
          code: 'media_reconciliation_changed',
          severity: 'warning',
          mediaId: media.mediaId,
          message: `Take-koblingen for ${media.displayName} er endret.`,
        });
      }
    }
    const availableAtCapture = new Set(snapshot.availableMediaIds);
    const newMediaCount = current.media.filter((media) => !availableAtCapture.has(media.mediaId)).length;
    if (newMediaCount > 0) {
      items.push({
        code: 'new_media_available',
        severity: 'warning',
        message: `${newMediaCount} ny${newMediaCount === 1 ? '' : 'e'} recorderfil${newMediaCount === 1 ? '' : 'er'} er tilgjengelig for dagen.`,
      });
    }
  }
  return {
    stale: items.length > 0,
    blocking: items.some((item) => item.severity === 'blocking'),
    items,
  };
}
