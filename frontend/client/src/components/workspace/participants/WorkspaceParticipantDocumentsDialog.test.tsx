import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WorkspaceParticipantDocumentSummary } from "@shared/workspace-participant-documents";
import type {
  WorkspaceParticipantAccess,
  WorkspaceProjectParticipant,
} from "@shared/workspace-project-participants";
import { WsLocaleProvider } from "../wsLocale";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  issue: vi.fn(),
  reissueLink: vi.fn(),
}));
const compensationApi = vi.hoisted(() => ({
  current: vi.fn(),
}));
vi.mock("./workspaceParticipantDocumentsApi", () => ({
  workspaceParticipantDocumentsApi: api,
  workspaceParticipantDocumentsError: (error: unknown) => error,
}));
vi.mock("./workspaceParticipantCompensationApi", () => ({
  workspaceParticipantCompensationApi: compensationApi,
  workspaceParticipantCompensationError: (error: unknown) => error,
}));

import WorkspaceParticipantDocumentsDialog from "./WorkspaceParticipantDocumentsDialog";

const participant: WorkspaceProjectParticipant = {
  id: "00000000-0000-4000-8000-000000000010",
  projectId: "project-1",
  organizationId: "org-1",
  externalReference: null,
  displayName: "Kari Nordmann",
  email: "kari@example.no",
  phone: null,
  participantType: "extra",
  roleLabel: "Statist",
  engagementType: "contractor",
  workflowStatus: "confirmed",
  isMinor: false,
  guardianStatus: "not_required",
  workPermitStatus: "not_required",
  requiresContract: true,
  requiresMediaConsent: true,
  requiresCompensation: true,
  notes: null,
  metadata: {},
  readiness: { ready: false, blockers: ["contract_required"] },
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-08-30T10:00:00.000Z",
  archivedAt: null,
  version: 1,
};

const documentSummary: WorkspaceParticipantDocumentSummary = {
  id: "00000000-0000-4000-8000-000000000020",
  participantId: participant.id,
  documentType: "contract",
  status: "issued",
  version: 1,
  title: "Kontrakt",
  contentHash: "d".repeat(64),
  supersedesDocumentId: null,
  issuedAt: "2026-08-30T10:00:00.000Z",
  expiresAt: "2026-09-30T10:00:00.000Z",
  signedAt: null,
  withdrawnAt: null,
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-08-30T10:00:00.000Z",
  signer: {
    id: "00000000-0000-4000-8000-000000000030",
    role: "participant",
    name: "Kari Nordmann",
    email: "kari@example.no",
    status: "pending",
    tokenExpiresAt: "2026-09-30T10:00:00.000Z",
    tokenRevokedAt: null,
    signedAt: null,
  },
  delivery: {
    status: "failed",
    provider: null,
    reason: "delivery_not_configured",
    at: "2026-08-30T10:00:00.000Z",
  },
};

const activeCompensation = {
  id: "00000000-0000-4000-8000-000000000040",
  participantId: participant.id,
  projectId: participant.projectId,
  version: 2,
  compensationType: "hourly" as const,
  status: "active" as const,
  hourlyRate: 850,
  estimatedHours: 4,
  dayRate: null,
  fixedAmount: null,
  sharePercentage: null,
  estimatedAmount: 3400,
  currency: "NOK",
  note: "Inkluderer kostymeprøve",
  splitSheetId: "00000000-0000-4000-8000-000000000041",
  splitSheetStatus: "draft" as const,
  supersedesCompensationId: null,
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-08-30T10:00:00.000Z",
  supersededAt: null,
  archivedAt: null,
};

const managerAccess: Pick<WorkspaceParticipantAccess, "canView" | "canManage"> =
  { canView: true, canManage: true };

function dialog(open: boolean, access = managerAccess) {
  return (
    <WsLocaleProvider value="no">
      <WorkspaceParticipantDocumentsDialog
        open={open}
        onClose={vi.fn()}
        projectId="project-1"
        participant={participant}
        access={access}
      />
    </WsLocaleProvider>
  );
}

describe("WorkspaceParticipantDocumentsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockResolvedValue({
      documents: [documentSummary],
      latest: { contract: documentSummary },
    });
    compensationApi.current.mockResolvedValue({
      compensation: activeCompensation,
    });
  });

  it("loads status but keeps issue and renewal actions hidden for viewers", async () => {
    render(dialog(true, { canView: true, canManage: false }));

    expect(await screen.findByText("Kontrakt")).toBeTruthy();
    expect(api.list).toHaveBeenCalledWith("project-1", participant.id);
    expect(compensationApi.current).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Utsted kontrakt" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Forny personlig lenke" }),
    ).toBeNull();
  });

  it("blocks contract issue when required canonical compensation is missing", async () => {
    compensationApi.current.mockResolvedValue({ compensation: null });
    render(dialog(true));

    fireEvent.click(
      await screen.findByRole("button", { name: "Utsted kontrakt" }),
    );

    expect(await screen.findByText(/Konfigurer honorar først/)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Utsted dokument",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(api.issue).not.toHaveBeenCalled();
  });

  it("shows canonical terms and never sends a free compensation summary", async () => {
    api.issue.mockResolvedValue({
      document: documentSummary,
      portalUrl:
        "https://app.example.test/participant-document/document-1#token=" +
        "G".repeat(43),
      delivery: {
        sent: false,
        provider: null,
        reason: "delivery_not_configured",
      },
    });
    render(dialog(true));

    fireEvent.click(
      await screen.findByRole("button", { name: "Utsted kontrakt" }),
    );
    expect(await screen.findByText("Inkluderer kostymeprøve")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Beskrivelse av oppdraget/), {
      target: { value: "Statist på sett" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Utsted dokument" }));

    await waitFor(() => expect(api.issue).toHaveBeenCalledTimes(1));
    const input = api.issue.mock.calls[0][2];
    expect(input.documentType).toBe("contract");
    expect(input.terms).not.toHaveProperty("compensationSummary");
  });

  it("shows a delivery fallback and clears the raw portal URL on close", async () => {
    const portalUrl =
      "https://app.example.test/participant-document/document-1#token=" +
      "E".repeat(43);
    api.reissueLink.mockResolvedValue({
      document: documentSummary,
      portalUrl,
      delivery: {
        sent: false,
        provider: null,
        reason: "delivery_not_configured",
      },
    });

    const view = render(dialog(true));
    fireEvent.click(
      await screen.findByRole("button", { name: "Forny personlig lenke" }),
    );
    expect(await screen.findByDisplayValue(portalUrl)).toBeTruthy();
    expect(screen.getByText(/E-postutsending er ikke koblet til/)).toBeTruthy();

    view.rerender(dialog(false));
    await waitFor(() =>
      expect(screen.queryByDisplayValue(portalUrl)).toBeNull(),
    );
    view.rerender(dialog(true));
    await screen.findByText("Kontrakt");
    expect(screen.queryByDisplayValue(portalUrl)).toBeNull();
  });
});
