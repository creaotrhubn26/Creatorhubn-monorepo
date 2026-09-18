import type {
  WorkspaceParticipantWorkPermitClearanceRequest,
  WorkspaceParticipantWorkPermitClearanceStatus,
} from "@shared/workspace-participant-clearance";

export type WorkspaceParticipantClearanceValidationCode =
  | "invalid_version"
  | "evidence_required"
  | "invalid_evidence"
  | "note_too_long"
  | "control_characters";

const INTERNAL_EVIDENCE =
  /^(creatorhub-document|workspace-file):[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// eslint-disable-next-line no-control-regex -- these are the exact characters rejected by the API contract
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

export function isWorkspaceParticipantEvidenceReference(
  value: string,
): boolean {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > 1_024 ||
    CONTROL_CHARACTERS.test(normalized)
  ) {
    return false;
  }
  if (INTERNAL_EVIDENCE.test(normalized)) return true;
  try {
    const parsed = new URL(normalized);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === ""
    );
  } catch {
    return false;
  }
}

export function buildWorkspaceParticipantClearanceRequest(input: {
  version: number;
  status: WorkspaceParticipantWorkPermitClearanceStatus;
  evidenceReference: string;
  note: string;
}):
  | { ok: true; request: WorkspaceParticipantWorkPermitClearanceRequest }
  | { ok: false; code: WorkspaceParticipantClearanceValidationCode } {
  if (!Number.isInteger(input.version) || input.version < 1) {
    return { ok: false, code: "invalid_version" };
  }
  const evidenceReference = input.evidenceReference.trim();
  const note = input.note.trim();
  if (CONTROL_CHARACTERS.test(note)) {
    return { ok: false, code: "control_characters" };
  }
  if (note.length > 2_000) {
    return { ok: false, code: "note_too_long" };
  }
  if (input.status === "approved" && !evidenceReference) {
    return { ok: false, code: "evidence_required" };
  }
  if (
    evidenceReference &&
    !isWorkspaceParticipantEvidenceReference(evidenceReference)
  ) {
    return { ok: false, code: "invalid_evidence" };
  }
  return {
    ok: true,
    request: {
      version: input.version,
      status: input.status,
      evidenceReference: evidenceReference || null,
      note: note || null,
    },
  };
}
