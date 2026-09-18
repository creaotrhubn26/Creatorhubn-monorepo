import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WorkspaceParticipantCompensation } from "@shared/workspace-participant-compensation";
import type {
  WorkspaceParticipantAccess,
  WorkspaceProjectParticipant,
} from "@shared/workspace-project-participants";
import { WsLocaleProvider } from "../wsLocale";

const api = vi.hoisted(() => ({
  current: vi.fn(),
  history: vi.fn(),
  createVersion: vi.fn(),
}));
vi.mock("./workspaceParticipantCompensationApi", () => ({
  workspaceParticipantCompensationApi: api,
  workspaceParticipantCompensationError: (error: unknown) => error,
}));

import WorkspaceParticipantCompensationDialog from "./WorkspaceParticipantCompensationDialog";

const KEY = "00000000-0000-4000-8000-000000000111";
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
  readiness: { ready: false, blockers: ["compensation_required"] },
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-08-30T10:00:00.000Z",
  archivedAt: null,
  version: 1,
};

const compensation: WorkspaceParticipantCompensation = {
  id: "00000000-0000-4000-8000-000000000020",
  participantId: participant.id,
  projectId: "project-1",
  version: 2,
  compensationType: "hourly",
  status: "active",
  hourlyRate: 500,
  estimatedHours: 8,
  dayRate: null,
  fixedAmount: null,
  sharePercentage: null,
  estimatedAmount: 4000,
  currency: "NOK",
  note: "Opptaksdag",
  splitSheetId: "00000000-0000-4000-8000-000000000030",
  splitSheetStatus: "draft",
  supersedesCompensationId: null,
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-08-30T10:00:00.000Z",
  supersededAt: null,
  archivedAt: null,
};

const access: Pick<
  WorkspaceParticipantAccess,
  "canView" | "canManage" | "canConfigureRequirements"
> = {
  canView: true,
  canManage: true,
  canConfigureRequirements: true,
};

function renderDialog(
  dialogAccess = access,
  overrides: {
    onSaved?: () => void | Promise<void>;
    onClose?: () => void;
  } = {},
) {
  return render(
    <WsLocaleProvider value="no">
      <WorkspaceParticipantCompensationDialog
        open
        onClose={overrides.onClose ?? vi.fn()}
        projectId="project-1"
        participant={participant}
        access={dialogAccess}
        onSaved={overrides.onSaved ?? vi.fn()}
      />
    </WsLocaleProvider>,
  );
}

describe("WorkspaceParticipantCompensationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => KEY) });
    api.current.mockResolvedValue({ compensation, access });
    api.history.mockResolvedValue({ compensations: [compensation], access });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("never requests sensitive compensation for a participant viewer", () => {
    renderDialog({
      canView: true,
      canManage: false,
      canConfigureRequirements: false,
    });

    expect(screen.getByText(/Honorar er sensitivt/)).toBeTruthy();
    expect(api.current).not.toHaveBeenCalled();
    expect(api.history).not.toHaveBeenCalled();
  });

  it("lets a manager read history without exposing mutation controls", async () => {
    renderDialog({
      canView: true,
      canManage: true,
      canConfigureRequirements: false,
    });

    expect(
      await screen.findByText(/Bare prosjekteier eller Enterprise-admin/),
    ).toBeTruthy();
    expect(api.current).toHaveBeenCalledWith("project-1", participant.id);
    expect(api.history).toHaveBeenCalledWith("project-1", participant.id);
    expect(screen.queryByRole("button", { name: "Ny versjon" })).toBeNull();
  });

  it("creates an hourly version with the loaded OCC version and one stable UUID", async () => {
    const saved = vi.fn();
    api.createVersion.mockResolvedValue({
      compensation: { ...compensation, id: "new-id", version: 3 },
      replayed: false,
      access,
    });
    renderDialog(access, { onSaved: saved });

    fireEvent.click(await screen.findByRole("button", { name: "Ny versjon" }));
    expect(
      screen.getByRole("textbox", {
        name: "Merknad i avtalen (vises til medvirkende)",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Denne teksten blir en del av kontraktens honorarvilkår/,
      ),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Timesats (NOK)"), {
      target: { value: "625" },
    });
    fireEvent.change(screen.getByLabelText("Estimerte timer"), {
      target: { value: "10" },
    });
    expect(screen.getByText(/6\s?250/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lagre ny versjon" }));

    await waitFor(() =>
      expect(api.createVersion).toHaveBeenCalledWith(
        "project-1",
        participant.id,
        {
          compensationType: "hourly",
          hourlyRate: 625,
          estimatedHours: 10,
          currency: "NOK",
          note: "Opptaksdag",
          idempotencyKey: KEY,
          expectedCurrentVersion: 2,
        },
      ),
    );
    expect(saved).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Ny honorarversjon er lagret."),
    ).toBeTruthy();
  });

  it("shows a linked managed sheet as read-only private status", async () => {
    renderDialog(access);

    expect(await screen.findAllByText("Privat honorarark")).toHaveLength(2);
    expect(screen.getAllByText(compensation.splitSheetId!)).toHaveLength(2);
    expect(
      screen.getAllByText("Vilkårene aksepteres i den sikre kontraktportalen."),
    ).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Åpne honoraroversikt" }),
    ).toBeNull();
  });
});
