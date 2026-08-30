import type { WorkspaceParticipantCompensationRequest } from "@shared/workspace-participant-compensation";

export type EditableWorkspaceParticipantCompensationType =
  | "hourly"
  | "fixed"
  | "unpaid";

export interface WorkspaceParticipantCompensationDraft {
  compensationType: EditableWorkspaceParticipantCompensationType;
  hourlyRate: string;
  estimatedHours: string;
  fixedAmount: string;
  note: string;
}

export type WorkspaceParticipantCompensationValidationCode =
  | "invalid_idempotency_key"
  | "invalid_hourly_rate"
  | "invalid_estimated_hours"
  | "invalid_fixed_amount"
  | "note_contains_html"
  | "note_too_long";

export type WorkspaceParticipantCompensationBuildResult =
  | { ok: true; request: WorkspaceParticipantCompensationRequest }
  | { ok: false; code: WorkspaceParticipantCompensationValidationCode };

export const EMPTY_WORKSPACE_PARTICIPANT_COMPENSATION_DRAFT: WorkspaceParticipantCompensationDraft =
  {
    compensationType: "hourly",
    hourlyRate: "",
    estimatedHours: "",
    fixedAmount: "",
    note: "",
  };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;
const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/iu;

function parsePositiveDecimal(value: string, max: number): number | null {
  const normalized = value.trim().replace(/\s/g, "");
  if (!DECIMAL_PATTERN.test(normalized)) return null;
  const numberValue = Number(normalized.replace(",", "."));
  if (!Number.isFinite(numberValue) || numberValue <= 0 || numberValue > max) {
    return null;
  }
  return numberValue;
}

export function calculateWorkspaceParticipantHourlyEstimate(
  hourlyRate: string,
  estimatedHours: string,
): number | null {
  const rate = parsePositiveDecimal(hourlyRate, 10_000_000);
  const hours = parsePositiveDecimal(estimatedHours, 10_000);
  if (rate === null || hours === null) return null;
  return Math.round((rate * hours + Number.EPSILON) * 100) / 100;
}

export function newWorkspaceParticipantCompensationIdempotencyKey(
  randomUUID: (() => string) | undefined = globalThis.crypto?.randomUUID?.bind(
    globalThis.crypto,
  ),
): string {
  const value = randomUUID?.();
  if (!value || !UUID_PATTERN.test(value)) {
    throw new Error("secure_uuid_unavailable");
  }
  return value;
}

export function buildWorkspaceParticipantCompensationRequest(input: {
  draft: WorkspaceParticipantCompensationDraft;
  idempotencyKey: string;
  expectedCurrentVersion: number | null;
}): WorkspaceParticipantCompensationBuildResult {
  if (!UUID_PATTERN.test(input.idempotencyKey)) {
    return { ok: false, code: "invalid_idempotency_key" };
  }
  // This note is participant-visible contract text. Canonicalize before both
  // validation and transport so its signed representation is deterministic.
  const note = input.draft.note.normalize("NFC").trim();
  if (HTML_TAG_PATTERN.test(note)) {
    return { ok: false, code: "note_contains_html" };
  }
  if (note.length > 2_000) return { ok: false, code: "note_too_long" };
  const base = {
    idempotencyKey: input.idempotencyKey,
    expectedCurrentVersion: input.expectedCurrentVersion,
    note: note || null,
  };

  if (input.draft.compensationType === "unpaid") {
    return {
      ok: true,
      request: {
        idempotencyKey: base.idempotencyKey,
        expectedCurrentVersion: base.expectedCurrentVersion,
        note: base.note,
        compensationType: "unpaid",
      },
    };
  }

  if (input.draft.compensationType === "fixed") {
    const fixedAmount = parsePositiveDecimal(
      input.draft.fixedAmount,
      10_000_000_000,
    );
    if (fixedAmount === null) {
      return { ok: false, code: "invalid_fixed_amount" };
    }
    return {
      ok: true,
      request: {
        ...base,
        compensationType: "fixed",
        fixedAmount,
        currency: "NOK",
      },
    };
  }

  const hourlyRate = parsePositiveDecimal(input.draft.hourlyRate, 10_000_000);
  if (hourlyRate === null) {
    return { ok: false, code: "invalid_hourly_rate" };
  }
  const estimatedHours = parsePositiveDecimal(
    input.draft.estimatedHours,
    10_000,
  );
  if (estimatedHours === null) {
    return { ok: false, code: "invalid_estimated_hours" };
  }
  return {
    ok: true,
    request: {
      ...base,
      compensationType: "hourly",
      hourlyRate,
      estimatedHours,
      currency: "NOK",
    },
  };
}
