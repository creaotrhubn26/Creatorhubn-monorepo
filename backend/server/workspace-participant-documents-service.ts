import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type {
  WorkspaceParticipantCompensationSnapshot,
  WorkspaceParticipantDocumentIssueInput,
  WorkspaceParticipantDocumentPublicResponse,
  WorkspaceParticipantDocumentSummary,
  WorkspaceParticipantDocumentType,
  WorkspaceParticipantLegalSnapshot,
} from "../../frontend/shared/workspace-participant-documents.ts";

export type WorkspaceParticipantDocumentQueryer =
  | Pick<Pool, "query">
  | Pick<PoolClient, "query">;

export interface WorkspaceParticipantDocumentScope {
  organizationId: string;
  projectId: string;
  participantId: string;
}

export interface WorkspaceParticipantDocumentRuntime {
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
  randomUUID?: () => string;
  tokenSigningSecret?: string;
}

export class WorkspaceParticipantDocumentError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const LEGAL_ACCEPTANCE_VERSION =
  "workspace-participant-legal-acceptance-v1" as const;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DOCUMENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DOCUMENT_TOKEN_NONCE_BYTES = 16;
const DOCUMENT_TOKEN_MAC_BYTES = 16;
const DOCUMENT_TOKEN_DOMAIN =
  "creatorhub:workspace-participant-document-token:v1";
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i;

function runtimeNow(runtime?: WorkspaceParticipantDocumentRuntime): Date {
  return runtime?.now?.() ?? new Date();
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1_000);
}

function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePlainText(value: unknown, field: string): string {
  const normalized = String(value ?? "")
    .normalize("NFC")
    .trim();
  if (HTML_TAG_PATTERN.test(normalized)) {
    throw new WorkspaceParticipantDocumentError(
      400,
      "legal_html_not_allowed",
      `${field} kan ikke inneholde HTML.`,
    );
  }
  return normalized;
}

function nullablePlainText(value: unknown, field: string): string | null {
  if (value === null || value === undefined || String(value).trim() === "")
    return null;
  return normalizePlainText(value, field);
}

function canonicalJson(value: unknown, seen: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError("Canonical JSON does not support non-finite numbers");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) {
    if (seen.has(value))
      throw new TypeError("Canonical JSON does not support cycles");
    seen.add(value);
    const result = `[${value.map((item) => canonicalJson(item, seen)).join(",")}]`;
    seen.delete(value);
    return result;
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (seen.has(object))
      throw new TypeError("Canonical JSON does not support cycles");
    seen.add(object);
    const keys = Object.keys(object).sort();
    const fields = keys.map((key) => {
      const child = object[key];
      if (
        child === undefined ||
        typeof child === "bigint" ||
        typeof child === "function" ||
        typeof child === "symbol"
      ) {
        throw new TypeError(`Canonical JSON does not support ${typeof child}`);
      }
      return `${JSON.stringify(key.normalize("NFC"))}:${canonicalJson(child, seen)}`;
    });
    seen.delete(object);
    return `{${fields.join(",")}}`;
  }
  throw new TypeError(`Canonical JSON does not support ${typeof value}`);
}

export function canonicalizeWorkspaceParticipantLegalSnapshot(
  value: unknown,
): string {
  return canonicalJson(value, new Set());
}

export function hashWorkspaceParticipantLegalSnapshot(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(canonicalizeWorkspaceParticipantLegalSnapshot(value), "utf8")
    .digest("hex");
}

export function hashWorkspaceParticipantCompensationPublicTerms(
  value: Omit<WorkspaceParticipantCompensationSnapshot, "publicTermsHash">,
): string {
  return crypto
    .createHash("sha256")
    .update(canonicalizeWorkspaceParticipantLegalSnapshot(value), "utf8")
    .digest("hex");
}

export function workspaceParticipantDocumentHashMatches(
  value: unknown,
  expectedHash: string,
): boolean {
  if (!HASH_PATTERN.test(expectedHash)) return false;
  const actual = Buffer.from(
    hashWorkspaceParticipantLegalSnapshot(value),
    "hex",
  );
  const expected = Buffer.from(expectedHash, "hex");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

function canonicalWorkspaceParticipantDocumentId(documentId: string): string {
  const canonical = String(documentId || "").trim().toLowerCase();
  if (!DOCUMENT_ID_PATTERN.test(canonical)) {
    throw new Error("workspace_document_token_document_id_invalid");
  }
  return canonical;
}

function workspaceParticipantDocumentTokenSigningKey(
  runtime?: WorkspaceParticipantDocumentRuntime,
): Buffer {
  const secret = String(
    runtime?.tokenSigningSecret ||
      process.env.WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_SECRET ||
      process.env.SESSION_SECRET ||
      "",
  ).trim();
  if (!secret) {
    throw new Error("workspace_document_token_secret_missing");
  }
  return crypto
    .createHash("sha256")
    .update(`${DOCUMENT_TOKEN_DOMAIN}:key\0`, "utf8")
    .update(secret, "utf8")
    .digest();
}

function workspaceParticipantDocumentTokenMac(
  documentId: string,
  nonce: Buffer,
  runtime?: WorkspaceParticipantDocumentRuntime,
): Buffer {
  return crypto
    .createHmac("sha256", workspaceParticipantDocumentTokenSigningKey(runtime))
    .update(`${DOCUMENT_TOKEN_DOMAIN}\0${canonicalWorkspaceParticipantDocumentId(documentId)}\0`, "utf8")
    .update(nonce)
    .digest()
    .subarray(0, DOCUMENT_TOKEN_MAC_BYTES);
}

export function generateWorkspaceParticipantDocumentToken(
  documentId: string,
  runtime?: WorkspaceParticipantDocumentRuntime,
): string {
  const nonce = (runtime?.randomBytes ?? crypto.randomBytes)(
    DOCUMENT_TOKEN_NONCE_BYTES,
  );
  if (!Buffer.isBuffer(nonce) || nonce.length !== DOCUMENT_TOKEN_NONCE_BYTES) {
    throw new Error("workspace_document_token_generation_failed");
  }
  const raw = Buffer.concat([
    nonce,
    workspaceParticipantDocumentTokenMac(documentId, nonce, runtime),
  ]).toString("base64url");
  if (!TOKEN_PATTERN.test(raw))
    throw new Error("workspace_document_token_generation_failed");
  return raw;
}

export function isWorkspaceParticipantDocumentToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export function verifyWorkspaceParticipantDocumentToken(
  documentId: string,
  value: string,
  runtime?: WorkspaceParticipantDocumentRuntime,
): boolean {
  if (!isWorkspaceParticipantDocumentToken(value)) return false;
  const canonicalDocumentId = String(documentId || "").trim().toLowerCase();
  if (!DOCUMENT_ID_PATTERN.test(canonicalDocumentId)) return false;
  const decoded = Buffer.from(value, "base64url");
  if (
    decoded.length !==
      DOCUMENT_TOKEN_NONCE_BYTES + DOCUMENT_TOKEN_MAC_BYTES ||
    decoded.toString("base64url") !== value
  ) {
    return false;
  }
  const nonce = decoded.subarray(0, DOCUMENT_TOKEN_NONCE_BYTES);
  const suppliedMac = decoded.subarray(DOCUMENT_TOKEN_NONCE_BYTES);
  const expectedMac = workspaceParticipantDocumentTokenMac(
    canonicalDocumentId,
    nonce,
    runtime,
  );
  return crypto.timingSafeEqual(suppliedMac, expectedMac);
}

export function hashWorkspaceParticipantDocumentToken(
  rawToken: string,
): string {
  if (!isWorkspaceParticipantDocumentToken(rawToken)) {
    throw new WorkspaceParticipantDocumentError(
      401,
      "document_token_invalid",
      "Dokumentlenken er ugyldig.",
    );
  }
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function buildWorkspaceParticipantDocumentPortalUrl(
  publicAppUrl: string,
  documentId: string,
  rawToken: string,
): string {
  const base = publicAppUrl.trim().replace(/\/+$/, "");
  return `${base}/participant-document/${encodeURIComponent(documentId)}#token=${encodeURIComponent(rawToken)}`;
}

export function escapeWorkspaceParticipantDocumentEmailHtml(
  value: unknown,
): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeName(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("nb-NO");
}

function acceptanceText(
  documentType: WorkspaceParticipantDocumentType,
): string {
  return documentType === "contract"
    ? "Jeg bekrefter at jeg har lest og godtar denne kontrakten og vilkårene som er vist over."
    : "Jeg bekrefter at mediesamtykket er frivillig, at jeg har forstått bruken som er beskrevet, og at samtykket kan trekkes tilbake.";
}

function normalizeTerms(
  input: WorkspaceParticipantDocumentIssueInput,
): WorkspaceParticipantLegalSnapshot["terms"] {
  if (input.documentType === "contract") {
    return {
      kind: "contract",
      workDescription: normalizePlainText(
        input.terms.workDescription,
        "workDescription",
      ),
      role: normalizePlainText(input.terms.role, "role"),
      startsOn: nullablePlainText(input.terms.startsOn, "startsOn"),
      endsOn: nullablePlainText(input.terms.endsOn, "endsOn"),
      cancellationTerms: nullablePlainText(
        input.terms.cancellationTerms,
        "cancellationTerms",
      ),
      safetyTerms: nullablePlainText(input.terms.safetyTerms, "safetyTerms"),
      confidentialityTerms: nullablePlainText(
        input.terms.confidentialityTerms,
        "confidentialityTerms",
      ),
      additionalTerms: nullablePlainText(
        input.terms.additionalTerms,
        "additionalTerms",
      ),
    };
  }
  return {
    kind: "media_consent",
    mediaTypes: [...input.terms.mediaTypes],
    purposes: input.terms.purposes.map((value) =>
      normalizePlainText(value, "purposes"),
    ),
    channels: input.terms.channels.map((value) =>
      normalizePlainText(value, "channels"),
    ),
    territory: normalizePlainText(input.terms.territory, "territory"),
    duration: normalizePlainText(input.terms.duration, "duration"),
    retention: normalizePlainText(input.terms.retention, "retention"),
    editingAllowed: input.terms.editingAllowed,
    paidMediaAllowed: input.terms.paidMediaAllowed,
    withdrawalContact: normalizePlainText(
      input.terms.withdrawalContact,
      "withdrawalContact",
    ),
    additionalTerms: nullablePlainText(
      input.terms.additionalTerms,
      "additionalTerms",
    ),
  };
}

export function buildWorkspaceParticipantLegalSnapshot(input: {
  documentId: string;
  documentType: WorkspaceParticipantDocumentType;
  version: number;
  title: string;
  issuedAt: string;
  organizationId: string;
  projectId: string;
  projectTitle: string;
  producerUserId: string;
  producerName: string;
  producerEmail: string | null;
  producerCompanyName: string | null;
  participantId: string;
  participantName: string;
  participantEmail: string | null;
  participantRole: string | null;
  participantIsMinor: boolean;
  signerRole: "participant" | "guardian";
  signerName: string;
  signerEmail: string;
  guardianRelationship: string | null;
  compensation: WorkspaceParticipantCompensationSnapshot | null;
  issueInput: WorkspaceParticipantDocumentIssueInput;
}): WorkspaceParticipantLegalSnapshot {
  return {
    schemaVersion: 1,
    document: {
      id: input.documentId,
      type: input.documentType,
      version: input.version,
      title: normalizePlainText(input.title, "title"),
      issuedAt: input.issuedAt,
    },
    project: {
      id: input.projectId,
      title: normalizePlainText(input.projectTitle, "projectTitle"),
      organizationId: input.organizationId,
    },
    producer: {
      userId: input.producerUserId,
      name: normalizePlainText(input.producerName, "producerName"),
      email: input.producerEmail,
      companyName: nullablePlainText(
        input.producerCompanyName,
        "producerCompanyName",
      ),
    },
    participant: {
      id: input.participantId,
      name: normalizePlainText(input.participantName, "participantName"),
      email: input.participantEmail,
      role: nullablePlainText(input.participantRole, "participantRole"),
      isMinor: input.participantIsMinor,
    },
    signer: {
      role: input.signerRole,
      name: normalizePlainText(input.signerName, "signerName"),
      email: input.signerEmail.trim().toLowerCase(),
      guardianRelationship: nullablePlainText(
        input.guardianRelationship,
        "guardianRelationship",
      ),
    },
    acceptance: {
      version: LEGAL_ACCEPTANCE_VERSION,
      text: acceptanceText(input.documentType),
    },
    compensation: input.compensation,
    terms: normalizeTerms(input.issueInput),
  };
}
type LockedWorkspaceParticipant = {
  id: string;
  organization_id: string;
  project_id: string;
  project_owner_user_id: string;
  is_minor: boolean;
  guardian_status: string;
  version: number;
  archived_at: string | null;
  workflow_status: string;
  requires_compensation: boolean;
};

type LockedCompensation = {
  snapshot: WorkspaceParticipantCompensationSnapshot | null;
};

function compensationIntegrityFailure(message: string): never {
  throw new WorkspaceParticipantDocumentError(
    409,
    "compensation_integrity_conflict",
    message,
  );
}

function numericOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundedCurrencyAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function jsonNumberMatches(
  value: Record<string, unknown>,
  field: string,
  expected: number | null,
): boolean {
  const actual = value[field];
  if (expected === null) return actual === null || actual === undefined;
  return numericOrNull(actual) === expected;
}

function publicCompensationTerms(
  snapshot: WorkspaceParticipantCompensationSnapshot,
): Omit<WorkspaceParticipantCompensationSnapshot, "publicTermsHash"> {
  return {
    id: snapshot.id,
    version: snapshot.version,
    type: snapshot.type,
    hourlyRate: snapshot.hourlyRate,
    estimatedHours: snapshot.estimatedHours,
    fixedAmount: snapshot.fixedAmount,
    estimatedAmount: snapshot.estimatedAmount,
    currency: snapshot.currency,
    note: snapshot.note,
  };
}

function compensationEventPayload(
  snapshot: WorkspaceParticipantCompensationSnapshot | null | undefined,
): {
  compensationId: string | null;
  compensationVersion: number | null;
  compensationPublicTermsHash: string | null;
} {
  return {
    compensationId: snapshot?.id ?? null,
    compensationVersion: snapshot?.version ?? null,
    compensationPublicTermsHash: snapshot?.publicTermsHash ?? null,
  };
}

function compensationSnapshotsMatch(
  embedded: WorkspaceParticipantCompensationSnapshot | null | undefined,
  current: WorkspaceParticipantCompensationSnapshot | null,
): boolean {
  if (!embedded || !current) return !embedded && !current;
  if (!HASH_PATTERN.test(String(embedded.publicTermsHash || ""))) return false;
  if (
    hashWorkspaceParticipantCompensationPublicTerms(
      publicCompensationTerms(embedded),
    ) !== embedded.publicTermsHash
  ) {
    return false;
  }
  return (
    canonicalizeWorkspaceParticipantLegalSnapshot(embedded) ===
    canonicalizeWorkspaceParticipantLegalSnapshot(current)
  );
}

async function lockCurrentWorkspaceParticipantCompensation(
  db: WorkspaceParticipantDocumentQueryer,
  participant: LockedWorkspaceParticipant,
  requireCurrent: boolean,
): Promise<LockedCompensation> {
  const compensationResult = await db.query(
    `SELECT link.*
       FROM workspace_participant_compensation_links link
      WHERE link.organization_id = $1
        AND link.project_id = $2
        AND link.participant_id = $3::uuid
        AND link.status = 'active'
      ORDER BY link.version DESC, link.id
      FOR UPDATE OF link`,
    [participant.organization_id, participant.project_id, participant.id],
  );
  if (compensationResult.rows.length === 0) {
    if (requireCurrent && participant.requires_compensation) {
      throw new WorkspaceParticipantDocumentError(
        409,
        "participant_compensation_required",
        "Aktive honorarvilkår må registreres før kontrakten kan utstedes.",
      );
    }
    return { snapshot: null };
  }
  if (compensationResult.rows.length !== 1) {
    return compensationIntegrityFailure(
      "Flere aktive honorarversjoner ble funnet.",
    );
  }

  const link = compensationResult.rows[0] as Record<string, unknown>;
  const type = String(link.compensation_type || "");
  if (!["hourly", "fixed", "unpaid"].includes(type)) {
    return compensationIntegrityFailure(
      "Honorarformen kan ikke bindes til denne kontrakten.",
    );
  }
  const id = String(link.id || "");
  const version = Number(link.version);
  const currency = String(link.currency || "");
  const terms = objectOf(link.terms_snapshot);
  if (
    String(link.organization_id) !== participant.organization_id ||
    String(link.project_id) !== participant.project_id ||
    String(link.project_owner_user_id) !== participant.project_owner_user_id ||
    String(link.participant_id) !== participant.id ||
    !id ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    !/^[A-Z]{3}$/.test(currency) ||
    terms.source !== "workspace-participant-compensation" ||
    terms.workspaceProjectId !== participant.project_id ||
    terms.workspaceParticipantId !== participant.id ||
    terms.workspaceCompensationId !== id ||
    Number(terms.compensationVersion) !== version ||
    terms.compensationType !== type ||
    terms.currency !== currency
  ) {
    return compensationIntegrityFailure(
      "Honorarbindingens prosjekt- eller versjonsdata er ugyldige.",
    );
  }

  const hourlyRate = numericOrNull(link.hourly_rate);
  const estimatedHours = numericOrNull(link.estimated_hours);
  const fixedAmount = numericOrNull(link.fixed_amount);
  const dayRate = numericOrNull(link.day_rate);
  const sharePercentage = numericOrNull(link.share_percentage);
  if (dayRate !== null || sharePercentage !== null) {
    return compensationIntegrityFailure(
      "Kontrakten kan ikke bindes til dagsats eller prosentvilkår.",
    );
  }
  let estimatedAmount: number | null = null;
  if (type === "hourly") {
    if (
      hourlyRate === null ||
      hourlyRate <= 0 ||
      estimatedHours === null ||
      estimatedHours <= 0 ||
      fixedAmount !== null
    ) {
      return compensationIntegrityFailure(
        "Timehonoraret mangler gyldige, entydige vilkår.",
      );
    }
    estimatedAmount = roundedCurrencyAmount(hourlyRate * estimatedHours);
  } else if (type === "fixed") {
    if (
      fixedAmount === null ||
      fixedAmount <= 0 ||
      hourlyRate !== null ||
      estimatedHours !== null
    ) {
      return compensationIntegrityFailure(
        "Fast honorar mangler gyldige, entydige vilkår.",
      );
    }
    estimatedAmount = fixedAmount;
  } else if (
    hourlyRate !== null ||
    estimatedHours !== null ||
    fixedAmount !== null
  ) {
    return compensationIntegrityFailure(
      "Ubetalt deltakelse kan ikke ha beløpsvilkår.",
    );
  }

  const rawNote = terms.note;
  const note =
    rawNote === null || rawNote === undefined || rawNote === ""
      ? null
      : typeof rawNote === "string"
        ? rawNote.normalize("NFC").trim()
        : null;
  if (
    (rawNote !== null &&
      rawNote !== undefined &&
      rawNote !== "" &&
      (note === null || note !== rawNote || HTML_TAG_PATTERN.test(note))) ||
    !jsonNumberMatches(terms, "hourlyRate", hourlyRate) ||
    !jsonNumberMatches(terms, "estimatedHours", estimatedHours) ||
    !jsonNumberMatches(terms, "fixedAmount", fixedAmount) ||
    !jsonNumberMatches(terms, "estimatedAmount", estimatedAmount)
  ) {
    return compensationIntegrityFailure(
      "Det lagrede honorarsammendraget samsvarer ikke med de aktive vilkårene.",
    );
  }

  if (type === "unpaid") {
    if (link.split_sheet_id !== null || link.contributor_id !== null) {
      return compensationIntegrityFailure(
        "Ubetalt deltakelse skal ikke ha split sheet.",
      );
    }
  } else {
    const splitSheetId = String(link.split_sheet_id || "");
    const contributorId = String(link.contributor_id || "");
    if (!splitSheetId || !contributorId) {
      return compensationIntegrityFailure(
        "Betalt deltakelse mangler privat split sheet.",
      );
    }
    const sheetResult = await db.query(
      `SELECT sheet.*
         FROM split_sheets sheet
        WHERE sheet.id = $1::uuid
        FOR UPDATE`,
      [splitSheetId],
    );
    const sheet = sheetResult.rows[0] as Record<string, unknown> | undefined;
    const sheetMetadata = objectOf(sheet?.metadata);
    if (
      sheetResult.rows.length !== 1 ||
      !sheet ||
      String(sheet.project_id) !== participant.project_id ||
      String(sheet.user_id) !== participant.project_owner_user_id ||
      String(sheet.status) !== "draft" ||
      sheet.access_code !== null ||
      sheet.pin !== null ||
      sheet.password !== null ||
      sheet.security_enabled === true ||
      sheet.require_pin_for_signature === true ||
      sheet.require_password_for_signature === true ||
      sheet.track_id !== null ||
      numericOrNull(sheet.total_percentage) !== 0 ||
      Number(sheetMetadata.agreementVersion) < 1 ||
      sheetMetadata.visibility !== "private" ||
      sheetMetadata.source !== "workspace-participant-compensation" ||
      sheetMetadata.workspaceOrganizationId !== participant.organization_id ||
      sheetMetadata.workspaceProjectId !== participant.project_id ||
      sheetMetadata.workspaceParticipantId !== participant.id ||
      sheetMetadata.workspaceCompensationId !== id ||
      Number(sheetMetadata.compensationVersion) !== version ||
      sheetMetadata.currency !== currency ||
      !jsonNumberMatches(sheetMetadata, "projectAmount", estimatedAmount)
    ) {
      return compensationIntegrityFailure(
        "Split sheet for honoraret er ikke et gyldig privat utkast.",
      );
    }

    const contributorResult = await db.query(
      `SELECT contributor.*
         FROM split_sheet_contributors contributor
        WHERE contributor.split_sheet_id = $1::uuid
        ORDER BY contributor.id
        FOR UPDATE`,
      [splitSheetId],
    );
    const contributor = contributorResult.rows[0] as
      | Record<string, unknown>
      | undefined;
    const contributorFields = objectOf(contributor?.custom_fields);
    if (
      contributorResult.rows.length !== 1 ||
      !contributor ||
      String(contributor.id) !== contributorId ||
      contributor.user_id !== null ||
      contributor.signed_at !== null ||
      contributor.signature_data !== null ||
      contributor.invitation_sent_at !== null ||
      String(contributor.invitation_status || "not_sent") !== "not_sent" ||
      contributor.contributor_pin !== null ||
      contributor.contributor_password !== null ||
      numericOrNull(contributor.percentage) !== 0 ||
      contributorFields.externalParticipant !== true ||
      contributorFields.workspaceProjectId !== participant.project_id ||
      contributorFields.workspaceParticipantId !== participant.id ||
      contributorFields.workspaceCompensationId !== id ||
      Number(contributorFields.compensationVersion) !== version ||
      contributorFields.compensationType !== type ||
      contributorFields.currency !== currency ||
      !jsonNumberMatches(contributorFields, "hourlyRate", hourlyRate) ||
      !jsonNumberMatches(contributorFields, "estimatedHours", estimatedHours) ||
      !jsonNumberMatches(contributorFields, "estimatedAmount", estimatedAmount)
    ) {
      return compensationIntegrityFailure(
        "Split sheet må ha nøyaktig én usignert ekstern medvirkende.",
      );
    }

    const accessResult = await db.query(
      `SELECT access_entry.contributor_id
         FROM split_sheet_contributor_access access_entry
        WHERE access_entry.contributor_id = $1::uuid
        LIMIT 1`,
      [contributorId],
    );
    if (accessResult.rows.length !== 0) {
      return compensationIntegrityFailure(
        "Privat honorar-sheet kan ikke ha en offentlig tilgangsrad.",
      );
    }
  }

  const publicTerms: Omit<
    WorkspaceParticipantCompensationSnapshot,
    "publicTermsHash"
  > = {
    id,
    version,
    type: type as WorkspaceParticipantCompensationSnapshot["type"],
    hourlyRate,
    estimatedHours,
    fixedAmount,
    estimatedAmount,
    currency,
    note,
  };
  return {
    snapshot: {
      ...publicTerms,
      publicTermsHash:
        hashWorkspaceParticipantCompensationPublicTerms(publicTerms),
    },
  };
}

function assertContractCompensationIsCurrent(
  document: Record<string, unknown>,
  signer: Record<string, unknown>,
  snapshot: WorkspaceParticipantLegalSnapshot,
  participant: LockedWorkspaceParticipant,
  current: LockedCompensation,
): void {
  if (String(document.document_type) !== "contract") return;
  const embedded = snapshot.compensation;
  const isPending =
    String(signer.status) === "pending" &&
    ["issued", "viewed"].includes(String(document.status));
  if (
    (participant.requires_compensation && current.snapshot === null) ||
    !compensationSnapshotsMatch(embedded, current.snapshot)
  ) {
    if (isPending) {
      throw new WorkspaceParticipantDocumentError(
        410,
        "document_compensation_stale",
        "Honorarvilkårene er endret. Be produsenten utstede en ny kontrakt.",
      );
    }
  }
}

function participantIsInactive(
  participant: LockedWorkspaceParticipant,
): boolean {
  return (
    participant.archived_at !== null ||
    ["archived", "cancelled"].includes(String(participant.workflow_status))
  );
}

export interface SupersedeStalePendingWorkspaceParticipantContractsInput extends WorkspaceParticipantDocumentScope {
  activeCompensationId: string;
  activeCompensationVersion: number;
  actorUserId: string;
  auditPayload?: Record<string, unknown>;
  runtime?: WorkspaceParticipantDocumentRuntime;
}

export interface SupersedeStalePendingWorkspaceParticipantContractsResult {
  activeCompensation: WorkspaceParticipantCompensationSnapshot;
  supersededDocumentIds: string[];
}

/**
 * Same-transaction hook for compensation activation. The caller must invoke it
 * after activating the new compensation version and before commit. It follows
 * the canonical participant -> active compensation -> document -> signer lock
 * order, revokes only pending contract credentials, and preserves signed legal
 * evidence and every media-consent record.
 */
export async function supersedeStalePendingWorkspaceParticipantContracts(
  db: WorkspaceParticipantDocumentQueryer,
  input: SupersedeStalePendingWorkspaceParticipantContractsInput,
): Promise<SupersedeStalePendingWorkspaceParticipantContractsResult> {
  const participant = await lockWorkspaceParticipantForDocumentScope(db, {
    organization_id: input.organizationId,
    project_id: input.projectId,
    participant_id: input.participantId,
  });
  const current = await lockCurrentWorkspaceParticipantCompensation(
    db,
    participant,
    true,
  );
  if (
    !current.snapshot ||
    current.snapshot.id !== input.activeCompensationId ||
    current.snapshot.version !== input.activeCompensationVersion
  ) {
    return compensationIntegrityFailure(
      "Aktiv honorarversjon samsvarer ikke med kontraktinvalideringen.",
    );
  }

  const documentsResult = await db.query(
    `SELECT id::text, status, terms_snapshot, content_hash
       FROM workspace_participant_documents
      WHERE organization_id = $1
        AND project_id = $2
        AND participant_id = $3::uuid
        AND document_type = 'contract'
        AND status IN ('issued', 'viewed')
      ORDER BY id
      FOR UPDATE`,
    [input.organizationId, input.projectId, input.participantId],
  );
  const now = runtimeNow(input.runtime).toISOString();
  const supersededDocumentIds: string[] = [];

  for (const document of documentsResult.rows as Array<
    Record<string, unknown>
  >) {
    const documentId = String(document.id || "");
    const snapshot = objectOf(
      document.terms_snapshot,
    ) as unknown as WorkspaceParticipantLegalSnapshot;
    if (
      !documentId ||
      !workspaceParticipantDocumentHashMatches(
        snapshot,
        String(document.content_hash || "").trim(),
      )
    ) {
      throw new WorkspaceParticipantDocumentError(
        409,
        "document_integrity_violation",
        "Dokumentets integritet kunne ikke bekreftes.",
      );
    }
    if (compensationSnapshotsMatch(snapshot.compensation, current.snapshot)) {
      continue;
    }

    const signerResult = await db.query(
      `SELECT *
         FROM workspace_participant_document_signers
        WHERE organization_id = $1
          AND project_id = $2
          AND participant_id = $3::uuid
          AND document_id = $4::uuid
          AND signer_role IN ('participant', 'guardian')
        FOR UPDATE`,
      [input.organizationId, input.projectId, input.participantId, documentId],
    );
    if (signerResult.rows.length !== 1) {
      return compensationIntegrityFailure(
        "Ventende kontrakt mangler en entydig juridisk mottaker.",
      );
    }
    const signer = signerResult.rows[0] as Record<string, unknown>;
    if (String(signer.status) !== "pending") {
      continue;
    }

    if (signer.signing_token_hash !== null) {
      const signerUpdate = await db.query(
        `UPDATE workspace_participant_document_signers
            SET signing_token_hash = NULL,
                token_revoked_at = GREATEST($6::timestamptz, token_issued_at)
          WHERE organization_id = $1
            AND project_id = $2
            AND participant_id = $3::uuid
            AND document_id = $4::uuid
            AND id = $5::uuid
            AND status = 'pending'
            AND signing_token_hash IS NOT NULL
            AND token_revoked_at IS NULL`,
        [
          input.organizationId,
          input.projectId,
          input.participantId,
          documentId,
          String(signer.id),
          now,
        ],
      );
      if (signerUpdate.rowCount !== 1) {
        throw new WorkspaceParticipantDocumentError(
          409,
          "document_compensation_invalidation_conflict",
          "Kontraktlenken ble endret samtidig.",
        );
      }
    }

    const documentUpdate = await db.query(
      `UPDATE workspace_participant_documents
          SET status = 'superseded'
        WHERE organization_id = $1
          AND project_id = $2
          AND participant_id = $3::uuid
          AND id = $4::uuid
          AND document_type = 'contract'
          AND status IN ('issued', 'viewed')`,
      [input.organizationId, input.projectId, input.participantId, documentId],
    );
    if (documentUpdate.rowCount !== 1) {
      throw new WorkspaceParticipantDocumentError(
        409,
        "document_compensation_invalidation_conflict",
        "Kontrakten ble endret samtidig.",
      );
    }

    await db.query(
      `INSERT INTO workspace_participant_events
         (organization_id, project_id, participant_id, document_id, signer_id,
          event_type, actor_type, actor_user_id, payload, occurred_at)
       VALUES ($1,$2,$3::uuid,$4::uuid,$5::uuid,
               'document_compensation_superseded','user',$6,$7::jsonb,$8)`,
      [
        input.organizationId,
        input.projectId,
        input.participantId,
        documentId,
        String(signer.id),
        input.actorUserId,
        JSON.stringify({
          reason: "active_compensation_changed",
          previousCompensationId: snapshot.compensation?.id ?? null,
          previousCompensationVersion: snapshot.compensation?.version ?? null,
          previousCompensationPublicTermsHash:
            snapshot.compensation?.publicTermsHash ?? null,
          ...compensationEventPayload(current.snapshot),
          ...(input.auditPayload ?? {}),
        }),
        now,
      ],
    );
    supersededDocumentIds.push(documentId);
  }

  return {
    activeCompensation: current.snapshot,
    supersededDocumentIds,
  };
}

function mapDocumentSummary(
  row: any,
  includeSignerEmail: boolean,
): WorkspaceParticipantDocumentSummary {
  const deliveryPayload = objectOf(row.delivery_payload);
  return {
    id: String(row.id),
    participantId: String(row.participant_id),
    documentType: row.document_type,
    status: row.status,
    version: Number(row.version),
    title: String(row.title),
    contentHash: String(row.content_hash || "").trim(),
    supersedesDocumentId: row.supersedes_document_id
      ? String(row.supersedes_document_id)
      : null,
    issuedAt: iso(row.issued_at) || "",
    expiresAt: iso(row.expires_at),
    signedAt: iso(row.signed_at),
    withdrawnAt: iso(row.withdrawn_at),
    createdAt: iso(row.created_at) || "",
    updatedAt: iso(row.updated_at) || "",
    signer: {
      id: String(row.signer_id),
      role: row.signer_role,
      name: String(row.signer_name),
      email: includeSignerEmail ? (row.signer_email ?? null) : null,
      status: row.signer_status,
      tokenExpiresAt: iso(row.token_expires_at),
      tokenRevokedAt: iso(row.token_revoked_at),
      signedAt: iso(row.signer_signed_at),
    },
    delivery: {
      status:
        row.delivery_event_type === "document_delivery_sent"
          ? "sent"
          : row.delivery_event_type === "document_delivery_failed"
            ? "failed"
            : null,
      provider:
        typeof deliveryPayload.provider === "string"
          ? deliveryPayload.provider
          : null,
      reason:
        typeof deliveryPayload.reason === "string"
          ? deliveryPayload.reason
          : null,
      at: iso(row.delivery_occurred_at),
    },
  };
}

const DOCUMENT_SUMMARY_SELECT = `
  SELECT document.*,
         signer.id::text AS signer_id,
         signer.signer_role,
         signer.signer_name,
         signer.signer_email,
         signer.status AS signer_status,
         signer.token_expires_at,
         signer.token_revoked_at,
         signer.signed_at AS signer_signed_at,
         delivery.event_type AS delivery_event_type,
         delivery.payload AS delivery_payload,
         delivery.occurred_at AS delivery_occurred_at
    FROM workspace_participant_documents document
    JOIN workspace_participant_document_signers signer
      ON signer.organization_id = document.organization_id
     AND signer.project_id = document.project_id
     AND signer.participant_id = document.participant_id
     AND signer.document_id = document.id
     AND signer.signer_role IN ('participant', 'guardian')
    LEFT JOIN LATERAL (
      SELECT event.event_type, event.payload, event.occurred_at
        FROM workspace_participant_events event
       WHERE event.organization_id = document.organization_id
         AND event.project_id = document.project_id
         AND event.participant_id = document.participant_id
         AND event.document_id = document.id
         AND event.event_type IN ('document_delivery_sent', 'document_delivery_failed')
       ORDER BY event.occurred_at DESC, event.id DESC
       LIMIT 1
    ) delivery ON TRUE`;

async function loadDocumentSummary(
  db: WorkspaceParticipantDocumentQueryer,
  scope: WorkspaceParticipantDocumentScope,
  documentId: string,
  includeSignerEmail: boolean,
): Promise<WorkspaceParticipantDocumentSummary> {
  const result = await db.query(
    `${DOCUMENT_SUMMARY_SELECT}
      WHERE document.organization_id = $1
        AND document.project_id = $2
        AND document.participant_id = $3::uuid
        AND document.id = $4::uuid
      LIMIT 1`,
    [scope.organizationId, scope.projectId, scope.participantId, documentId],
  );
  if (!result.rows[0]) {
    throw new WorkspaceParticipantDocumentError(
      404,
      "document_not_found",
      "Dokumentet finnes ikke.",
    );
  }
  return mapDocumentSummary(result.rows[0], includeSignerEmail);
}

export async function listWorkspaceParticipantDocuments(
  db: WorkspaceParticipantDocumentQueryer,
  input: WorkspaceParticipantDocumentScope & { includeSignerEmail: boolean },
): Promise<{
  documents: WorkspaceParticipantDocumentSummary[];
  latest: Record<string, WorkspaceParticipantDocumentSummary>;
}> {
  const result = await db.query(
    `${DOCUMENT_SUMMARY_SELECT}
      WHERE document.organization_id = $1
        AND document.project_id = $2
        AND document.participant_id = $3::uuid
      ORDER BY document.document_type, document.version DESC`,
    [input.organizationId, input.projectId, input.participantId],
  );
  const documents = result.rows.map((row) =>
    mapDocumentSummary(row, input.includeSignerEmail),
  );
  const latest: Record<string, WorkspaceParticipantDocumentSummary> = {};
  for (const document of documents) {
    if (document.status !== "draft" && !latest[document.documentType]) {
      latest[document.documentType] = document;
    }
  }
  return { documents, latest };
}

export interface IssuedWorkspaceParticipantDocument {
  scope: WorkspaceParticipantDocumentScope;
  document: WorkspaceParticipantDocumentSummary;
  rawToken: string;
  signerName: string;
  signerEmail: string;
  producerName: string;
  producerEmail: string | null;
  projectTitle: string;
}

export async function issueWorkspaceParticipantDocument(
  db: WorkspaceParticipantDocumentQueryer,
  input: {
    scope: WorkspaceParticipantDocumentScope;
    projectOwnerUserId: string;
    actorUserId: string;
    auditPayload?: Record<string, unknown>;
    issue: WorkspaceParticipantDocumentIssueInput;
    runtime?: WorkspaceParticipantDocumentRuntime;
  },
): Promise<IssuedWorkspaceParticipantDocument> {
  const participantResult = await db.query(
    `SELECT participant.id::text,
            participant.organization_id,
            participant.project_id,
            participant.workflow_status,
            participant.requires_compensation,
            participant.display_name,
            participant.email,
            participant.role_label,
            participant.is_minor,
            participant.archived_at,
            COALESCE(NULLIF(project.title, ''), NULLIF(project.name, ''), 'Prosjekt') AS project_title,
            project.user_id::text AS project_owner_user_id,
            project.user_id::text AS producer_user_id,
            owner.email AS producer_email,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', owner.first_name, owner.last_name)), ''),
                     NULLIF(owner.company_name, ''), owner.email, 'CreatorHub-produsent') AS producer_name,
            owner.company_name AS producer_company_name
       FROM workspace_project_participants participant
       JOIN projects project ON project.id = participant.project_id
       LEFT JOIN users owner ON owner.id::text = project.user_id::text
      WHERE participant.organization_id = $1
        AND participant.project_id = $2
        AND participant.id = $3::uuid
      FOR UPDATE OF participant`,
    [
      input.scope.organizationId,
      input.scope.projectId,
      input.scope.participantId,
    ],
  );
  const participant = participantResult.rows[0];
  if (!participant || participant.archived_at) {
    throw new WorkspaceParticipantDocumentError(
      404,
      "participant_not_found",
      "Medvirkende finnes ikke.",
    );
  }
  if (String(participant.producer_user_id) !== input.projectOwnerUserId) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "project_scope_conflict",
      "Prosjektets eier samsvarer ikke med Enterprise-bindingen.",
    );
  }
  if (participantIsInactive(participant as LockedWorkspaceParticipant)) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "participant_inactive",
      "Dokumenter kan ikke utstedes for en arkivert eller avbrutt medvirkende.",
    );
  }

  const isMinor = participant.is_minor === true;
  if (isMinor && !input.issue.guardian) {
    throw new WorkspaceParticipantDocumentError(
      400,
      "guardian_required",
      "Foresatt må oppgis for en mindreårig.",
    );
  }
  if (!isMinor && !participant.email) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "participant_email_required",
      "Medvirkende må ha e-post før dokumentet kan sendes.",
    );
  }
  const signerRole = isMinor ? ("guardian" as const) : ("participant" as const);
  const signerName = isMinor
    ? normalizePlainText(input.issue.guardian?.name, "guardian.name")
    : normalizePlainText(participant.display_name, "participant.displayName");
  const signerEmail = isMinor
    ? String(input.issue.guardian?.email || "")
        .trim()
        .toLowerCase()
    : String(participant.email).trim().toLowerCase();
  const guardianRelationship = isMinor
    ? normalizePlainText(
        input.issue.guardian?.relationship,
        "guardian.relationship",
      )
    : null;

  const compensation =
    input.issue.documentType === "contract"
      ? await lockCurrentWorkspaceParticipantCompensation(
          db,
          participant as LockedWorkspaceParticipant,
          true,
        )
      : { snapshot: null };

  const existingDocuments = await db.query(
    `SELECT id::text, version, status
       FROM workspace_participant_documents
      WHERE organization_id = $1
        AND project_id = $2
        AND participant_id = $3::uuid
        AND document_type = $4
      ORDER BY version DESC
      FOR UPDATE`,
    [
      input.scope.organizationId,
      input.scope.projectId,
      input.scope.participantId,
      input.issue.documentType,
    ],
  );
  const version =
    existingDocuments.rows.reduce(
      (maximum, row) => Math.max(maximum, Number(row.version) || 0),
      0,
    ) + 1;
  const previous =
    existingDocuments.rows.find((row) => row.status !== "draft") ?? null;
  const now = runtimeNow(input.runtime);
  const issuedAt = now.toISOString();
  const documentId = (input.runtime?.randomUUID ?? crypto.randomUUID)();
  const title = normalizePlainText(
    input.issue.title ||
      (input.issue.documentType === "contract" ? "Kontrakt" : "Mediesamtykke"),
    "title",
  );
  const snapshot = buildWorkspaceParticipantLegalSnapshot({
    documentId,
    documentType: input.issue.documentType,
    version,
    title,
    issuedAt,
    organizationId: input.scope.organizationId,
    projectId: input.scope.projectId,
    projectTitle: String(participant.project_title || "Prosjekt"),
    producerUserId: String(participant.producer_user_id),
    producerName: String(participant.producer_name || "CreatorHub-produsent"),
    producerEmail: participant.producer_email ?? null,
    producerCompanyName: participant.producer_company_name ?? null,
    participantId: input.scope.participantId,
    participantName: String(participant.display_name),
    participantEmail: participant.email ?? null,
    participantRole: participant.role_label ?? null,
    participantIsMinor: isMinor,
    signerRole,
    signerName,
    signerEmail,
    guardianRelationship,
    compensation: compensation.snapshot,
    issueInput: input.issue,
  });
  const contentHash = hashWorkspaceParticipantLegalSnapshot(snapshot);
  const rawToken = generateWorkspaceParticipantDocumentToken(
    documentId,
    input.runtime,
  );
  const tokenHash = hashWorkspaceParticipantDocumentToken(rawToken);
  const invitationExpiresAt = addDays(
    now,
    input.issue.invitationExpiresInDays ?? 30,
  ).toISOString();

  await db.query(
    `INSERT INTO workspace_participant_documents
       (id, organization_id, project_id, participant_id, document_type, status,
        version, title, terms_snapshot, content_hash, supersedes_document_id,
        created_by)
     VALUES ($1::uuid,$2,$3,$4::uuid,$5,'draft',$6,$7,$8::jsonb,$9,$10::uuid,$11)`,
    [
      documentId,
      input.scope.organizationId,
      input.scope.projectId,
      input.scope.participantId,
      input.issue.documentType,
      version,
      title,
      JSON.stringify(snapshot),
      contentHash,
      previous?.id ?? null,
      input.actorUserId,
    ],
  );
  const signerResult = await db.query(
    `INSERT INTO workspace_participant_document_signers
       (organization_id, project_id, participant_id, document_id, signer_role,
        signer_name, signer_email, status, signing_token_hash, token_issued_at,
        token_expires_at)
     VALUES ($1,$2,$3::uuid,$4::uuid,$5,$6,$7,'pending',$8,$9,$10)
     RETURNING id::text`,
    [
      input.scope.organizationId,
      input.scope.projectId,
      input.scope.participantId,
      documentId,
      signerRole,
      signerName,
      signerEmail,
      tokenHash,
      issuedAt,
      invitationExpiresAt,
    ],
  );
  const signerId = String(signerResult.rows[0]?.id || "");
  if (!signerId)
    throw new Error("workspace_document_signer_persistence_failed");

  const issuedResult = await db.query(
    `UPDATE workspace_participant_documents
        SET status = 'issued', issued_at = $5
      WHERE organization_id = $1 AND project_id = $2
        AND participant_id = $3::uuid AND id = $4::uuid AND status = 'draft'`,
    [
      input.scope.organizationId,
      input.scope.projectId,
      input.scope.participantId,
      documentId,
      issuedAt,
    ],
  );
  if (issuedResult.rowCount !== 1) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "document_issue_conflict",
      "Dokumentet kunne ikke utstedes atomisk.",
    );
  }
  if (
    previous &&
    ["issued", "viewed", "signed"].includes(String(previous.status))
  ) {
    await db.query(
      `UPDATE workspace_participant_documents
          SET status = 'superseded'
        WHERE organization_id = $1 AND project_id = $2
          AND participant_id = $3::uuid AND id = $4::uuid
          AND status IN ('issued', 'viewed', 'signed')`,
      [
        input.scope.organizationId,
        input.scope.projectId,
        input.scope.participantId,
        previous.id,
      ],
    );
  }
  await db.query(
    `INSERT INTO workspace_participant_events
       (organization_id, project_id, participant_id, document_id, signer_id,
        event_type, actor_type, actor_user_id, payload, occurred_at)
     VALUES ($1,$2,$3::uuid,$4::uuid,$5::uuid,'document_issued','user',$6,$7::jsonb,$8)`,
    [
      input.scope.organizationId,
      input.scope.projectId,
      input.scope.participantId,
      documentId,
      signerId,
      input.actorUserId,
      JSON.stringify({
        documentType: input.issue.documentType,
        version,
        contentHash,
        ...compensationEventPayload(compensation.snapshot),
        ...(input.auditPayload ?? {}),
      }),
      issuedAt,
    ],
  );
  const document = await loadDocumentSummary(db, input.scope, documentId, true);
  return {
    scope: input.scope,
    document,
    rawToken,
    signerName,
    signerEmail,
    producerName: String(participant.producer_name || "CreatorHub-produsent"),
    producerEmail: participant.producer_email ?? null,
    projectTitle: String(participant.project_title || "Prosjekt"),
  };
}

export async function reissueWorkspaceParticipantDocumentToken(
  db: WorkspaceParticipantDocumentQueryer,
  input: WorkspaceParticipantDocumentScope & {
    documentId: string;
    actorUserId: string;
    auditPayload?: Record<string, unknown>;
    runtime?: WorkspaceParticipantDocumentRuntime;
  },
): Promise<IssuedWorkspaceParticipantDocument> {
  const documentTypeHintResult = await db.query(
    `SELECT document_type
       FROM workspace_participant_documents
      WHERE organization_id = $1 AND project_id = $2
        AND participant_id = $3::uuid AND id = $4::uuid
      LIMIT 1`,
    [
      input.organizationId,
      input.projectId,
      input.participantId,
      input.documentId,
    ],
  );
  const documentTypeHint = documentTypeHintResult.rows[0]?.document_type;
  if (!documentTypeHint) {
    throw new WorkspaceParticipantDocumentError(
      404,
      "document_not_found",
      "Dokumentet finnes ikke.",
    );
  }
  const participant = await lockWorkspaceParticipantForDocumentScope(db, {
    organization_id: input.organizationId,
    project_id: input.projectId,
    participant_id: input.participantId,
  });
  if (participantIsInactive(participant)) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "participant_inactive",
      "Dokumentlenker kan ikke fornyes for en arkivert eller avbrutt medvirkende.",
    );
  }
  const compensation =
    documentTypeHint === "contract"
      ? await lockCurrentWorkspaceParticipantCompensation(
          db,
          participant,
          false,
        )
      : { snapshot: null };
  const documentResult = await db.query(
    `SELECT * FROM workspace_participant_documents
      WHERE organization_id = $1 AND project_id = $2
        AND participant_id = $3::uuid AND id = $4::uuid
      FOR UPDATE`,
    [
      input.organizationId,
      input.projectId,
      input.participantId,
      input.documentId,
    ],
  );
  const documentRow = documentResult.rows[0];
  if (
    !documentRow ||
    ["draft", "declined", "expired", "superseded"].includes(
      String(documentRow.status),
    )
  ) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "document_link_not_reissuable",
      "Dokumentlenken kan ikke fornyes.",
    );
  }
  const signerResult = await db.query(
    `SELECT * FROM workspace_participant_document_signers
      WHERE organization_id = $1 AND project_id = $2
        AND participant_id = $3::uuid AND document_id = $4::uuid
        AND signer_role IN ('participant', 'guardian')
      FOR UPDATE`,
    [
      input.organizationId,
      input.projectId,
      input.participantId,
      input.documentId,
    ],
  );
  const signer = signerResult.rows[0];
  if (!signer || signer.status === "declined") {
    throw new WorkspaceParticipantDocumentError(
      409,
      "document_link_not_reissuable",
      "Dokumentlenken kan ikke fornyes.",
    );
  }
  const snapshot = objectOf(
    documentRow.terms_snapshot,
  ) as unknown as WorkspaceParticipantLegalSnapshot;
  if (
    String(documentRow.document_type) !== String(documentTypeHint) ||
    !workspaceParticipantDocumentHashMatches(
      snapshot,
      String(documentRow.content_hash || "").trim(),
    )
  ) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "document_integrity_violation",
      "Dokumentets integritet kunne ikke bekreftes.",
    );
  }
  assertContractCompensationIsCurrent(
    documentRow,
    signer,
    snapshot,
    participant,
    compensation,
  );
  const now = runtimeNow(input.runtime);
  const rawToken = generateWorkspaceParticipantDocumentToken(
    input.documentId,
    input.runtime,
  );
  const tokenHash = hashWorkspaceParticipantDocumentToken(rawToken);
  const tokenExpiresAt =
    signer.status === "pending"
      ? addDays(now, 30).toISOString()
      : documentRow.document_type === "media_consent"
        ? null
        : addDays(now, 365).toISOString();
  const signerUpdate = await db.query(
    `UPDATE workspace_participant_document_signers
        SET signing_token_hash = $5, token_issued_at = $6,
            token_expires_at = $7, token_revoked_at = NULL
      WHERE organization_id = $1 AND project_id = $2
        AND participant_id = $3::uuid AND document_id = $4::uuid
        AND id = $8::uuid`,
    [
      input.organizationId,
      input.projectId,
      input.participantId,
      input.documentId,
      tokenHash,
      now.toISOString(),
      tokenExpiresAt,
      signer.id,
    ],
  );
  if (signerUpdate.rowCount !== 1) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "document_reissue_conflict",
      "Dokumentlenken kunne ikke fornyes atomisk.",
    );
  }
  await db.query(
    `INSERT INTO workspace_participant_events
       (organization_id, project_id, participant_id, document_id, signer_id,
        event_type, actor_type, actor_user_id, payload, occurred_at)
     VALUES ($1,$2,$3::uuid,$4::uuid,$5::uuid,'document_link_reissued','user',$6,$7::jsonb,$8)`,
    [
      input.organizationId,
      input.projectId,
      input.participantId,
      input.documentId,
      signer.id,
      input.actorUserId,
      JSON.stringify({
        ...compensationEventPayload(snapshot.compensation),
        ...(input.auditPayload ?? {}),
      }),
      now.toISOString(),
    ],
  );
  const scope = {
    organizationId: input.organizationId,
    projectId: input.projectId,
    participantId: input.participantId,
  };
  return {
    scope,
    document: await loadDocumentSummary(db, scope, input.documentId, true),
    rawToken,
    signerName: String(signer.signer_name),
    signerEmail: String(signer.signer_email),
    producerName: String(snapshot.producer?.name || "CreatorHub-produsent"),
    producerEmail: snapshot.producer?.email ?? null,
    projectTitle: String(snapshot.project?.title || "Prosjekt"),
  };
}

type LockedPublicDocument = {
  document: any;
  signer: any;
  snapshot: WorkspaceParticipantLegalSnapshot;
};

type WorkspaceParticipantDocumentTokenScope = {
  organization_id: string;
  project_id: string;
  participant_id: string;
  document_type: WorkspaceParticipantDocumentType;
};

async function resolveWorkspaceParticipantDocumentTokenScope(
  db: WorkspaceParticipantDocumentQueryer,
  documentId: string,
  tokenHash: string,
): Promise<WorkspaceParticipantDocumentTokenScope> {
  const scopeResult = await db.query(
    `SELECT document.organization_id, document.project_id,
            document.participant_id, document.document_type
       FROM workspace_participant_documents document
       JOIN workspace_participant_document_signers signer
         ON signer.organization_id = document.organization_id
        AND signer.project_id = document.project_id
        AND signer.participant_id = document.participant_id
        AND signer.document_id = document.id
      WHERE document.id = $1::uuid
        AND document.status <> 'draft'
        AND signer.signing_token_hash = $2
        AND signer.token_revoked_at IS NULL
      LIMIT 1`,
    [documentId, tokenHash],
  );
  const scope = scopeResult.rows[0];
  if (!scope) {
    throw new WorkspaceParticipantDocumentError(
      404,
      "document_not_found",
      "Dokumentlenken er ugyldig.",
    );
  }
  return scope as WorkspaceParticipantDocumentTokenScope;
}

async function lockWorkspaceParticipantForDocumentScope(
  db: WorkspaceParticipantDocumentQueryer,
  scope: {
    organization_id: string;
    project_id: string;
    participant_id: string;
  },
): Promise<LockedWorkspaceParticipant> {
  const participantResult = await db.query(
    `SELECT participant.id::text, participant.organization_id,
            participant.project_id, participant.is_minor,
            participant.guardian_status, participant.version,
            participant.archived_at, participant.workflow_status,
            participant.requires_compensation,
            project.user_id::text AS project_owner_user_id
       FROM workspace_project_participants participant
       JOIN projects project ON project.id = participant.project_id
      WHERE participant.organization_id = $1
        AND participant.project_id = $2
        AND participant.id = $3::uuid
      FOR UPDATE OF participant`,
    [scope.organization_id, scope.project_id, scope.participant_id],
  );
  const participant = participantResult.rows[0];
  if (!participant) {
    throw new WorkspaceParticipantDocumentError(
      404,
      "document_not_found",
      "Dokumentlenken er ugyldig.",
    );
  }
  return participant as LockedWorkspaceParticipant;
}

async function lockPublicDocument(
  db: WorkspaceParticipantDocumentQueryer,
  documentId: string,
  tokenHash: string,
  now: Date,
): Promise<LockedPublicDocument> {
  const documentResult = await db.query(
    `SELECT * FROM workspace_participant_documents
      WHERE id = $1::uuid
      FOR UPDATE`,
    [documentId],
  );
  const document = documentResult.rows[0];
  if (!document || document.status === "draft") {
    throw new WorkspaceParticipantDocumentError(
      404,
      "document_not_found",
      "Dokumentlenken er ugyldig.",
    );
  }
  const signerResult = await db.query(
    `SELECT * FROM workspace_participant_document_signers
      WHERE organization_id = $1 AND project_id = $2
        AND participant_id = $3::uuid AND document_id = $4::uuid
        AND signing_token_hash = $5
      FOR UPDATE`,
    [
      document.organization_id,
      document.project_id,
      document.participant_id,
      document.id,
      tokenHash,
    ],
  );
  const signer = signerResult.rows[0];
  if (!signer) {
    throw new WorkspaceParticipantDocumentError(
      404,
      "document_not_found",
      "Dokumentlenken er ugyldig.",
    );
  }
  if (signer.token_revoked_at) {
    throw new WorkspaceParticipantDocumentError(
      410,
      "document_token_revoked",
      "Dokumentlenken er tilbakekalt.",
    );
  }
  const tokenExpiry = signer.token_expires_at
    ? new Date(signer.token_expires_at)
    : null;
  if (tokenExpiry && tokenExpiry.getTime() <= now.getTime()) {
    throw new WorkspaceParticipantDocumentError(
      410,
      "document_token_expired",
      "Dokumentlenken er utløpt.",
    );
  }
  const snapshot = objectOf(
    document.terms_snapshot,
  ) as unknown as WorkspaceParticipantLegalSnapshot;
  if (
    !workspaceParticipantDocumentHashMatches(
      snapshot,
      String(document.content_hash || "").trim(),
    )
  ) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "document_integrity_violation",
      "Dokumentets integritet kunne ikke bekreftes.",
    );
  }
  return { document, signer, snapshot };
}

function mapPublicDocument(
  locked: LockedPublicDocument,
): WorkspaceParticipantDocumentPublicResponse {
  const { document, signer, snapshot } = locked;
  return {
    documentId: String(document.id),
    documentType: document.document_type,
    status: document.status,
    version: Number(document.version),
    title: String(document.title),
    contentHash: String(document.content_hash || "").trim(),
    issuedAt: iso(document.issued_at) || "",
    signedAt: iso(document.signed_at),
    withdrawnAt: iso(document.withdrawn_at),
    signerName: String(signer.signer_name),
    signerRole: signer.signer_role,
    terms: snapshot,
    canSign:
      signer.status === "pending" &&
      ["issued", "viewed"].includes(String(document.status)),
    canWithdraw:
      signer.status === "signed" &&
      document.document_type === "media_consent" &&
      document.status === "signed",
  };
}

function eventScope(locked: LockedPublicDocument) {
  return [
    locked.document.organization_id,
    locked.document.project_id,
    locked.document.participant_id,
    locked.document.id,
    locked.signer.id,
  ];
}

const EMAIL_LINK_HOLDER_ACTOR_TYPE = "email_link_holder" as const;
const EMAIL_LINK_ASSURANCE_LEVEL = "email_link_possession" as const;

function emailLinkAssurance(locked: LockedPublicDocument) {
  return {
    actorContext: EMAIL_LINK_HOLDER_ACTOR_TYPE,
    assuranceLevel: EMAIL_LINK_ASSURANCE_LEVEL,
    signerRole: locked.signer.signer_role,
  };
}

export async function viewWorkspaceParticipantDocument(
  db: WorkspaceParticipantDocumentQueryer,
  input: {
    documentId: string;
    tokenHash: string;
    ip: string | null;
    runtime?: WorkspaceParticipantDocumentRuntime;
  },
): Promise<WorkspaceParticipantDocumentPublicResponse> {
  const now = runtimeNow(input.runtime);
  const tokenScope = await resolveWorkspaceParticipantDocumentTokenScope(
    db,
    input.documentId,
    input.tokenHash,
  );
  const participant = await lockWorkspaceParticipantForDocumentScope(
    db,
    tokenScope,
  );
  const compensation =
    tokenScope.document_type === "contract"
      ? await lockCurrentWorkspaceParticipantCompensation(
          db,
          participant,
          false,
        )
      : { snapshot: null };
  const locked = await lockPublicDocument(
    db,
    input.documentId,
    input.tokenHash,
    now,
  );
  if (
    participantIsInactive(participant) &&
    locked.signer.status === "pending" &&
    ["issued", "viewed"].includes(String(locked.document.status))
  ) {
    throw new WorkspaceParticipantDocumentError(
      410,
      "document_participant_inactive",
      "Dokumentet er ikke lenger aktivt.",
    );
  }
  assertContractCompensationIsCurrent(
    locked.document,
    locked.signer,
    locked.snapshot,
    participant,
    compensation,
  );
  if (locked.document.status === "issued") {
    await db.query(
      `UPDATE workspace_participant_documents SET status = 'viewed'
        WHERE id = $1::uuid AND status = 'issued'`,
      [locked.document.id],
    );
    await db.query(
      `INSERT INTO workspace_participant_events
         (organization_id, project_id, participant_id, document_id, signer_id,
          event_type, actor_type, payload, occurred_at)
       VALUES ($1,$2,$3::uuid,$4::uuid,$5::uuid,'document_viewed','email_link_holder',$6::jsonb,$7)`,
      [
        ...eventScope(locked),
        JSON.stringify({
          ...emailLinkAssurance(locked),
          ip: input.ip,
          ...compensationEventPayload(locked.snapshot.compensation),
        }),
        now.toISOString(),
      ],
    );
    locked.document.status = "viewed";
  }
  return mapPublicDocument(locked);
}

export interface PublicDocumentMutationResult {
  document: WorkspaceParticipantDocumentPublicResponse;
  already: boolean;
  notification: {
    projectId: string;
    projectTitle: string;
    producerEmail: string | null;
    producerName: string;
    signerName: string;
  };
  scope: WorkspaceParticipantDocumentScope & {
    documentId: string;
    signerId: string;
  };
}
async function recordGuardianApprovalFromSignature(
  db: WorkspaceParticipantDocumentQueryer,
  locked: LockedPublicDocument,
  participant: LockedWorkspaceParticipant,
  signedAt: string,
): Promise<void> {
  if (
    locked.signer.signer_role !== "guardian" ||
    !["contract", "media_consent"].includes(
      String(locked.document.document_type),
    ) ||
    locked.snapshot.participant?.isMinor !== true ||
    participant.is_minor !== true ||
    !["required", "pending"].includes(participant.guardian_status)
  ) {
    return;
  }

  const participantUpdate = await db.query(
    `UPDATE workspace_project_participants
        SET guardian_status = 'approved',
            updated_by = $5,
            version = version + 1
      WHERE organization_id = $1 AND project_id = $2
        AND id = $3::uuid AND version = $4
        AND is_minor = TRUE AND archived_at IS NULL
        AND guardian_status IN ('required', 'pending')
      RETURNING version`,
    [
      locked.document.organization_id,
      locked.document.project_id,
      locked.document.participant_id,
      participant.version,
      "workspace-email-link-holder",
    ],
  );
  if (participantUpdate.rowCount !== 1) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "document_sign_conflict",
      "Dokumentet ble endret samtidig.",
    );
  }

  const participantVersion = Number(participantUpdate.rows[0]?.version);
  await db.query(
    `INSERT INTO workspace_participant_events
       (organization_id, project_id, participant_id, document_id, signer_id,
        event_type, actor_type, payload, occurred_at)
     VALUES ($1,$2,$3::uuid,$4::uuid,$5::uuid,'guardian_approval_recorded','email_link_holder',$6::jsonb,$7)`,
    [
      ...eventScope(locked),
      JSON.stringify({
        ...emailLinkAssurance(locked),
        previousStatus: participant.guardian_status,
        guardianStatus: "approved",
        participantVersion,
        documentType: locked.document.document_type,
        source: "guardian_document_signature",
      }),
      signedAt,
    ],
  );
}

function publicMutationResult(
  locked: LockedPublicDocument,
  already: boolean,
): PublicDocumentMutationResult {
  return {
    document: mapPublicDocument(locked),
    already,
    notification: {
      projectId: String(locked.document.project_id),
      projectTitle: String(locked.snapshot.project?.title || "Prosjekt"),
      producerEmail: locked.snapshot.producer?.email ?? null,
      producerName: String(
        locked.snapshot.producer?.name || "CreatorHub-produsent",
      ),
      signerName: String(locked.signer.signer_name),
    },
    scope: {
      organizationId: String(locked.document.organization_id),
      projectId: String(locked.document.project_id),
      participantId: String(locked.document.participant_id),
      documentId: String(locked.document.id),
      signerId: String(locked.signer.id),
    },
  };
}

export async function signWorkspaceParticipantDocument(
  db: WorkspaceParticipantDocumentQueryer,
  input: {
    documentId: string;
    tokenHash: string;
    signerName: string;
    accepted: true;
    signatureMethod: "typed";
    ip: string | null;
    userAgent: string | null;
    runtime?: WorkspaceParticipantDocumentRuntime;
  },
): Promise<PublicDocumentMutationResult> {
  const now = runtimeNow(input.runtime);
  const tokenScope = await resolveWorkspaceParticipantDocumentTokenScope(
    db,
    input.documentId,
    input.tokenHash,
  );
  const signingParticipant = await lockWorkspaceParticipantForDocumentScope(
    db,
    tokenScope,
  );
  const compensation =
    tokenScope.document_type === "contract"
      ? await lockCurrentWorkspaceParticipantCompensation(
          db,
          signingParticipant,
          false,
        )
      : { snapshot: null };
  const locked = await lockPublicDocument(
    db,
    input.documentId,
    input.tokenHash,
    now,
  );
  if (
    participantIsInactive(signingParticipant) &&
    locked.signer.status === "pending" &&
    ["issued", "viewed"].includes(String(locked.document.status))
  ) {
    throw new WorkspaceParticipantDocumentError(
      410,
      "document_participant_inactive",
      "Dokumentet er ikke lenger aktivt.",
    );
  }
  assertContractCompensationIsCurrent(
    locked.document,
    locked.signer,
    locked.snapshot,
    signingParticipant,
    compensation,
  );
  if (locked.signer.status === "signed") {
    return publicMutationResult(locked, true);
  }
  if (
    locked.signer.status !== "pending" ||
    !["issued", "viewed"].includes(String(locked.document.status))
  ) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "document_not_signable",
      "Dokumentet kan ikke signeres.",
    );
  }
  if (
    normalizeName(input.signerName) !==
    normalizeName(String(locked.signer.signer_name))
  ) {
    throw new WorkspaceParticipantDocumentError(
      400,
      "signer_name_mismatch",
      "Navnet samsvarer ikke med mottakeren.",
    );
  }
  const signedAt = now.toISOString();
  const evidence = {
    schemaVersion: 1,
    signedVia: "workspace-participant-document-token",
    ...emailLinkAssurance(locked),
    signerName: String(locked.signer.signer_name),
    signerRole: locked.signer.signer_role,
    signatureMethod: input.signatureMethod,
    accepted: input.accepted,
    acceptanceText: locked.snapshot.acceptance.text,
    acceptanceVersion: locked.snapshot.acceptance.version,
    documentContentHash: String(locked.document.content_hash || "").trim(),
    ...compensationEventPayload(locked.snapshot.compensation),
    signedAt,
    ip: input.ip,
    userAgent: input.userAgent,
  };
  const contractPortalExpiry = addDays(now, 365).toISOString();
  const signerUpdate = await db.query(
    `UPDATE workspace_participant_document_signers
        SET status = 'signed', token_used_at = $6, signature_evidence = $7::jsonb,
            signed_at = $6,
            token_expires_at = CASE WHEN $8 = 'media_consent' THEN NULL ELSE $9 END
      WHERE organization_id = $1 AND project_id = $2
        AND participant_id = $3::uuid AND document_id = $4::uuid
        AND id = $5::uuid AND status = 'pending'
        AND signing_token_hash = $10 AND token_revoked_at IS NULL`,
    [
      locked.document.organization_id,
      locked.document.project_id,
      locked.document.participant_id,
      locked.document.id,
      locked.signer.id,
      signedAt,
      JSON.stringify(evidence),
      locked.document.document_type,
      contractPortalExpiry,
      input.tokenHash,
    ],
  );
  if (signerUpdate.rowCount !== 1) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "document_sign_conflict",
      "Dokumentet ble endret samtidig.",
    );
  }
  const documentUpdate = await db.query(
    `UPDATE workspace_participant_documents
        SET status = 'signed', signed_at = $5
      WHERE organization_id = $1 AND project_id = $2
        AND participant_id = $3::uuid AND id = $4::uuid
        AND status IN ('issued', 'viewed')`,
    [
      locked.document.organization_id,
      locked.document.project_id,
      locked.document.participant_id,
      locked.document.id,
      signedAt,
    ],
  );
  if (documentUpdate.rowCount !== 1) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "document_sign_conflict",
      "Dokumentet ble endret samtidig.",
    );
  }
  await recordGuardianApprovalFromSignature(
    db,
    locked,
    signingParticipant,
    signedAt,
  );
  await db.query(
    `INSERT INTO workspace_participant_events
       (organization_id, project_id, participant_id, document_id, signer_id,
        event_type, actor_type, payload, occurred_at)
     VALUES ($1,$2,$3::uuid,$4::uuid,$5::uuid,'document_signed','email_link_holder',$6::jsonb,$7)`,
    [
      ...eventScope(locked),
      JSON.stringify({
        ...emailLinkAssurance(locked),
        signatureMethod: input.signatureMethod,
        contentHash: evidence.documentContentHash,
        ...compensationEventPayload(locked.snapshot.compensation),
      }),
      signedAt,
    ],
  );
  locked.signer.status = "signed";
  locked.signer.signed_at = signedAt;
  locked.signer.token_expires_at =
    locked.document.document_type === "media_consent"
      ? null
      : contractPortalExpiry;
  locked.document.status = "signed";
  locked.document.signed_at = signedAt;
  return publicMutationResult(locked, false);
}

export async function withdrawWorkspaceParticipantMediaConsent(
  db: WorkspaceParticipantDocumentQueryer,
  input: {
    documentId: string;
    tokenHash: string;
    confirmed: true;
    reason: string | null;
    ip: string | null;
    userAgent: string | null;
    runtime?: WorkspaceParticipantDocumentRuntime;
  },
): Promise<PublicDocumentMutationResult> {
  const now = runtimeNow(input.runtime);
  const locked = await lockPublicDocument(
    db,
    input.documentId,
    input.tokenHash,
    now,
  );
  if (locked.document.document_type !== "media_consent") {
    throw new WorkspaceParticipantDocumentError(
      409,
      "document_not_withdrawable",
      "Kontrakter kan ikke trekkes tilbake.",
    );
  }
  if (locked.document.status === "withdrawn") {
    return publicMutationResult(locked, true);
  }
  if (
    locked.document.status !== "signed" ||
    locked.signer.status !== "signed"
  ) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "document_not_withdrawable",
      "Bare et aktivt, signert mediesamtykke kan trekkes tilbake.",
    );
  }
  const withdrawnAt = now.toISOString();
  const update = await db.query(
    `UPDATE workspace_participant_documents
        SET status = 'withdrawn', withdrawn_at = $5
      WHERE organization_id = $1 AND project_id = $2
        AND participant_id = $3::uuid AND id = $4::uuid
        AND document_type = 'media_consent' AND status = 'signed'`,
    [
      locked.document.organization_id,
      locked.document.project_id,
      locked.document.participant_id,
      locked.document.id,
      withdrawnAt,
    ],
  );
  if (update.rowCount !== 1) {
    throw new WorkspaceParticipantDocumentError(
      409,
      "document_withdraw_conflict",
      "Samtykket ble endret samtidig.",
    );
  }
  await db.query(
    `INSERT INTO workspace_participant_events
       (organization_id, project_id, participant_id, document_id, signer_id,
        event_type, actor_type, payload, occurred_at)
     VALUES ($1,$2,$3::uuid,$4::uuid,$5::uuid,'media_consent_withdrawn','email_link_holder',$6::jsonb,$7)`,
    [
      ...eventScope(locked),
      JSON.stringify({
        ...emailLinkAssurance(locked),
        confirmed: input.confirmed,
        reason: input.reason,
        ip: input.ip,
        userAgent: input.userAgent,
      }),
      withdrawnAt,
    ],
  );
  locked.document.status = "withdrawn";
  locked.document.withdrawn_at = withdrawnAt;
  return publicMutationResult(locked, false);
}

export async function appendWorkspaceParticipantDocumentDeliveryEvent(
  db: WorkspaceParticipantDocumentQueryer,
  input: WorkspaceParticipantDocumentScope & {
    documentId: string;
    signerId: string;
    sent: boolean;
    provider: string | null;
    reason: string | null;
    kind: string;
    actorUserId?: string | null;
    auditPayload?: Record<string, unknown>;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO workspace_participant_events
       (organization_id, project_id, participant_id, document_id, signer_id,
        event_type, actor_type, actor_user_id, payload)
     VALUES ($1,$2,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9::jsonb)`,
    [
      input.organizationId,
      input.projectId,
      input.participantId,
      input.documentId,
      input.signerId,
      input.sent ? "document_delivery_sent" : "document_delivery_failed",
      input.actorUserId ? "user" : "system",
      input.actorUserId ?? null,
      JSON.stringify({
        provider: input.provider,
        reason: input.reason,
        kind: input.kind,
        ...(input.auditPayload ?? {}),
      }),
    ],
  );
}
