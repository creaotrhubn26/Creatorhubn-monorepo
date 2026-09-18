import type {
  WorkspaceParticipantCreateInput,
  WorkspaceParticipantType,
  WorkspaceProjectParticipant,
} from "@shared/workspace-project-participants";

export type WorkspaceParticipantCellState =
  | "ready"
  | "missing"
  | "pending"
  | "rejected"
  | "hidden"
  | "not_required";

export interface WorkspaceParticipantReadinessCells {
  contact: WorkspaceParticipantCellState;
  contract: WorkspaceParticipantCellState;
  mediaConsent: WorkspaceParticipantCellState;
  guardian: WorkspaceParticipantCellState;
  compensation: WorkspaceParticipantCellState;
}

export function workspaceParticipantReadinessCells(
  participant: WorkspaceProjectParticipant,
  options?: { contactVisible?: boolean },
): WorkspaceParticipantReadinessCells {
  const blockers = new Set(participant.readiness?.blockers ?? []);
  const contractRequired =
    participant.requiresContract || participant.requiresCompensation;
  const contractCompensationStale = blockers.has("contract_compensation_stale");
  const guardianRejected =
    participant.guardianStatus === "rejected" ||
    participant.workPermitStatus === "rejected";
  const guardianReady =
    participant.guardianStatus === "approved" &&
    (participant.workPermitStatus === "approved" ||
      participant.workPermitStatus === "not_required");

  return {
    contact:
      options?.contactVisible === false
        ? "hidden"
        : participant.email?.trim() || participant.phone?.trim()
          ? "ready"
          : "missing",
    contract: contractCompensationStale
      ? "pending"
      : !contractRequired
        ? "not_required"
        : blockers.has("contract_required")
          ? "missing"
          : "ready",
    mediaConsent: !participant.requiresMediaConsent
      ? "not_required"
      : blockers.has("media_consent_required")
        ? "missing"
        : "ready",
    guardian: !participant.isMinor
      ? "not_required"
      : guardianRejected
        ? "rejected"
        : guardianReady
          ? "ready"
          : blockers.has("guardian_approval_required") ||
              blockers.has("work_permit_required")
            ? "pending"
            : "pending",
    compensation: !participant.requiresCompensation
      ? "not_required"
      : blockers.has("compensation_required")
        ? "missing"
        : "ready",
  };
}

export function canUseWorkspaceParticipantsCapability(input: {
  workspaceCategory: string;
  accessLoading: boolean;
  canViewProjectParticipants: boolean;
}): boolean {
  return (
    input.workspaceCategory === "visual" &&
    !input.accessLoading &&
    input.canViewProjectParticipants
  );
}

type PasteField =
  | "displayName"
  | "email"
  | "phone"
  | "roleLabel"
  | "participantType"
  | "isMinor";

const HEADER_ALIASES: Record<string, PasteField> = {
  navn: "displayName",
  name: "displayName",
  displayname: "displayName",
  fullt_navn: "displayName",
  full_name: "displayName",
  epost: "email",
  e_post: "email",
  email: "email",
  mail: "email",
  telefon: "phone",
  phone: "phone",
  mobil: "phone",
  rolle: "roleLabel",
  role: "roleLabel",
  rolelabel: "roleLabel",
  type: "participantType",
  deltakertype: "participantType",
  participanttype: "participantType",
  mindrearig: "isMinor",
  minor: "isMinor",
  isminor: "isMinor",
};

const normaliseHeader = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("nb-NO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function participantTypeFromPaste(value?: string): WorkspaceParticipantType {
  const key = normaliseHeader(value || "");
  if (key === "model" || key === "modell") return "model";
  if (key === "featured" || key === "fremhevet" || key === "hovedrolle")
    return "featured";
  if (key === "interviewee" || key === "intervju" || key === "intervjuobjekt") {
    return "interviewee";
  }
  if (key === "other" || key === "annet") return "other";
  return "extra";
}

function booleanFromPaste(value?: string): boolean {
  return ["1", "true", "yes", "ja", "j", "x"].includes(
    normaliseHeader(value || ""),
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface WorkspaceParticipantPasteIssue {
  line: number;
  reason: "missing_name" | "invalid_email";
  source: string;
}

export interface WorkspaceParticipantPasteResult {
  participants: WorkspaceParticipantCreateInput[];
  issues: WorkspaceParticipantPasteIssue[];
}

/**
 * Parse spreadsheet/CSV paste without retaining it locally. Supported default
 * column order is name, email, phone, role. A no/en header can reorder columns.
 */
export function parseWorkspaceParticipantPaste(
  source: string,
): WorkspaceParticipantPasteResult {
  const lines = source
    .split(/\r?\n/)
    .map((line, index) => ({ source: line.trim(), line: index + 1 }))
    .filter((entry) => entry.source.length > 0);

  if (!lines.length) return { participants: [], issues: [] };

  const first = lines[0].source;
  const delimiter = first.includes("\t")
    ? "\t"
    : first.includes(";")
      ? ";"
      : ",";
  const firstValues = splitDelimitedLine(first, delimiter);
  const headerFields = firstValues.map(
    (value) => HEADER_ALIASES[normaliseHeader(value)] ?? null,
  );
  const hasHeader =
    headerFields.includes("displayName") &&
    headerFields.some((field) => field !== null && field !== "displayName");
  const defaultFields: PasteField[] = [
    "displayName",
    "email",
    "phone",
    "roleLabel",
  ];
  const fields = hasHeader ? headerFields : defaultFields;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const participants: WorkspaceParticipantCreateInput[] = [];
  const issues: WorkspaceParticipantPasteIssue[] = [];

  dataLines.forEach((entry) => {
    const values = splitDelimitedLine(entry.source, delimiter);
    const row: Partial<Record<PasteField, string>> = {};
    values.forEach((value, index) => {
      const field = fields[index];
      if (field) row[field] = value;
    });

    const displayName = row.displayName?.trim() ?? "";
    const email = row.email?.trim().toLocaleLowerCase("nb-NO") ?? "";
    if (!displayName) {
      issues.push({
        line: entry.line,
        reason: "missing_name",
        source: entry.source,
      });
      return;
    }
    if (email && !EMAIL_PATTERN.test(email)) {
      issues.push({
        line: entry.line,
        reason: "invalid_email",
        source: entry.source,
      });
      return;
    }

    const isMinor = booleanFromPaste(row.isMinor);
    participants.push({
      displayName,
      email: email || null,
      phone: row.phone?.trim() || null,
      roleLabel: row.roleLabel?.trim() || null,
      participantType: participantTypeFromPaste(row.participantType),
      engagementType: "undecided",
      isMinor,
    });
  });

  return { participants, issues };
}
