import { describe, expect, it } from "vitest";
import type { WorkspaceProjectParticipant } from "@shared/workspace-project-participants";
import {
  canUseWorkspaceParticipantsCapability,
  parseWorkspaceParticipantPaste,
  workspaceParticipantReadinessCells,
} from "./workspaceParticipantsModel";

const participant = (
  overrides: Partial<WorkspaceProjectParticipant> = {},
): WorkspaceProjectParticipant => ({
  id: "participant-1",
  projectId: "project-1",
  organizationId: "org-1",
  externalReference: null,
  displayName: "Kari Nordmann",
  email: "kari@example.no",
  phone: null,
  participantType: "extra",
  roleLabel: "Statist",
  engagementType: "undecided",
  workflowStatus: "draft",
  isMinor: false,
  guardianStatus: "not_required",
  workPermitStatus: "not_required",
  requiresContract: true,
  requiresMediaConsent: true,
  requiresCompensation: true,
  notes: null,
  metadata: {},
  readiness: {
    ready: false,
    blockers: [
      "contract_required",
      "media_consent_required",
      "compensation_required",
    ],
  },
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-08-30T10:00:00.000Z",
  archivedAt: null,
  version: 1,
  ...overrides,
});

describe("workspace participant capability", () => {
  it("fails closed unless visual category and project-bound access both pass", () => {
    const base = {
      workspaceCategory: "visual",
      accessLoading: false,
      canViewProjectParticipants: true,
    };
    expect(canUseWorkspaceParticipantsCapability(base)).toBe(true);
    expect(
      canUseWorkspaceParticipantsCapability({
        ...base,
        canViewProjectParticipants: false,
      }),
    ).toBe(false);
    expect(
      canUseWorkspaceParticipantsCapability({ ...base, accessLoading: true }),
    ).toBe(false);
    expect(
      canUseWorkspaceParticipantsCapability({
        ...base,
        workspaceCategory: "music",
      }),
    ).toBe(false);
  });
});

describe("workspace participant readiness cells", () => {
  it("maps legal and compensation blockers without treating an adult as needing a guardian", () => {
    expect(workspaceParticipantReadinessCells(participant())).toEqual({
      contact: "ready",
      contract: "missing",
      mediaConsent: "missing",
      guardian: "not_required",
      compensation: "missing",
    });
  });

  it("keeps a minor pending until both guardian and required permit are approved", () => {
    const minor = participant({
      isMinor: true,
      guardianStatus: "approved",
      workPermitStatus: "pending",
      readiness: {
        ready: false,
        blockers: ["work_permit_required"],
      },
    });
    expect(workspaceParticipantReadinessCells(minor).guardian).toBe("pending");
    expect(
      workspaceParticipantReadinessCells({
        ...minor,
        workPermitStatus: "rejected",
      }).guardian,
    ).toBe("rejected");
  });

  it("does not infer missing contact information when PII is hidden from a viewer", () => {
    expect(
      workspaceParticipantReadinessCells(
        participant({ email: null, phone: null }),
        { contactVisible: false },
      ).contact,
    ).toBe("hidden");
  });

  it("treats compensation as contract-bound and marks stale terms pending", () => {
    const compensationOnly = participant({
      requiresContract: false,
      requiresCompensation: true,
      readiness: { ready: true, blockers: [] },
    });
    expect(workspaceParticipantReadinessCells(compensationOnly).contract).toBe(
      "ready",
    );

    expect(
      workspaceParticipantReadinessCells({
        ...compensationOnly,
        readiness: {
          ready: false,
          blockers: ["contract_compensation_stale"],
        },
      }).contract,
    ).toBe("pending");
  });
});

describe("workspace participant paste parser", () => {
  it("accepts a Norwegian spreadsheet header and marks minors as requiring guardian steps", () => {
    const result = parseWorkspaceParticipantPaste(
      "Navn\tE-post\tTelefon\tRolle\tType\tMindreårig\n" +
        "Kari Nordmann\tkari@example.no\t+47 900 00 000\tKafégjest\tStatist\tja",
    );
    expect(result.issues).toEqual([]);
    expect(result.participants).toHaveLength(1);
    expect(result.participants[0]).toMatchObject({
      displayName: "Kari Nordmann",
      email: "kari@example.no",
      roleLabel: "Kafégjest",
      participantType: "extra",
      isMinor: true,
    });
    expect(result.participants[0]).not.toHaveProperty("guardianStatus");
    expect(result.participants[0]).not.toHaveProperty("workPermitStatus");
    expect(result.participants[0]).not.toHaveProperty("workflowStatus");
    expect(result.participants[0]).not.toHaveProperty("requiresContract");
    expect(result.participants[0]).not.toHaveProperty("requiresMediaConsent");
    expect(result.participants[0]).not.toHaveProperty("requiresCompensation");
  });

  it("supports quoted CSV and reports invalid email rows without importing them", () => {
    const result = parseWorkspaceParticipantPaste(
      "name,email,phone,role\n" +
        '"Nordmann, Ola",ola@example.no,,Statist\n' +
        "Feil Person,ikke-en-epost,,Statist",
    );
    expect(result.participants).toHaveLength(1);
    expect(result.participants[0].displayName).toBe("Nordmann, Ola");
    expect(result.issues).toEqual([
      expect.objectContaining({ line: 3, reason: "invalid_email" }),
    ]);
  });
});
