import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  WorkspaceParticipantAccess,
  WorkspaceProjectParticipant,
} from "@shared/workspace-project-participants";
import { WsLocaleProvider } from "../wsLocale";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
}));
vi.mock("./workspaceParticipantClearanceApi", () => ({
  workspaceParticipantClearanceApi: api,
  workspaceParticipantClearanceError: (error: unknown) => error,
}));

import WorkspaceParticipantWorkPermitDialog from "./WorkspaceParticipantWorkPermitDialog";

const participant: WorkspaceProjectParticipant = {
  id: "00000000-0000-4000-8000-000000000010",
  projectId: "project-1",
  organizationId: "org-1",
  externalReference: null,
  displayName: "Kari Nordmann",
  email: "foresatt@example.no",
  phone: null,
  participantType: "extra",
  roleLabel: "Statist",
  engagementType: "contractor",
  workflowStatus: "confirmed",
  isMinor: true,
  guardianStatus: "approved",
  workPermitStatus: "pending",
  requiresContract: true,
  requiresMediaConsent: true,
  requiresCompensation: false,
  notes: null,
  metadata: {},
  readiness: { ready: false, blockers: ["work_permit_required"] },
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-08-30T10:00:00.000Z",
  archivedAt: null,
  version: 4,
};

const access: WorkspaceParticipantAccess = {
  projectId: "project-1",
  projectOwnerUserId: "owner-1",
  organizationId: "org-1",
  enterprise: true,
  featureId: "workspace-project-participants",
  canView: true,
  canManage: true,
  canConfigureRequirements: true,
  scopeBound: true,
  role: "enterprise_admin",
};

const clearance = {
  participantId: participant.id,
  status: "pending",
  participantVersion: 4,
  isMinor: true,
  updatedAt: "2026-08-30T10:00:00.000Z",
  latestChange: null,
};

function renderDialog(
  canConfigureRequirements: boolean,
  overrides: {
    participant?: WorkspaceProjectParticipant;
    onSaved?: () => void | Promise<void>;
  } = {},
) {
  return render(
    <WsLocaleProvider value="no">
      <WorkspaceParticipantWorkPermitDialog
        open
        onClose={vi.fn()}
        projectId="project-1"
        participant={overrides.participant ?? participant}
        access={{ canConfigureRequirements }}
        onSaved={overrides.onSaved ?? vi.fn()}
      />
    </WsLocaleProvider>,
  );
}

describe("WorkspaceParticipantWorkPermitDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ clearance, history: [], access });
  });

  it("never requests clearance evidence without requirement-admin access", () => {
    renderDialog(false);

    expect(
      screen.getByText(/Kun prosjekteier eller Enterprise-admin/),
    ).toBeTruthy();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("does not request legal clearance for a non-minor", () => {
    renderDialog(true, { participant: { ...participant, isMinor: false } });

    expect(
      screen.getByText(
        "Arbeidstillatelse kan bare behandles for en mindreårig.",
      ),
    ).toBeTruthy();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("approves with evidence using the server participant version and refreshes readiness", async () => {
    const onSaved = vi.fn();
    const evidence = "https://secure.example.test/evidence/permit-1";
    api.update.mockResolvedValue({
      clearance: {
        ...clearance,
        status: "approved",
        participantVersion: 5,
      },
      change: {
        id: "00000000-0000-4000-8000-000000000099",
        previousStatus: "pending",
        status: "approved",
        evidenceReference: evidence,
        note: "Verifisert dokument",
        actorUserId: "owner-1",
        participantVersion: 5,
        occurredAt: "2026-08-30T11:00:00.000Z",
      },
      access,
    });
    renderDialog(true, { onSaved });

    expect(await screen.findByText("Ingen statusendringer ennå.")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Ny status" }));
    fireEvent.click(await screen.findByRole("option", { name: "Godkjent" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: /Sikker bevisreferanse/ }),
      {
        target: { value: evidence },
      },
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Internt notat" }), {
      target: { value: "Verifisert dokument" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lagre avklaring" }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith("project-1", participant.id, {
        version: 4,
        status: "approved",
        evidenceReference: evidence,
        note: "Verifisert dokument",
      }),
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Arbeidstillatelsen er oppdatert."),
    ).toBeTruthy();
  });
});
