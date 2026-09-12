import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  WorkspaceParticipantAccess,
  WorkspaceProjectParticipant,
} from "@shared/workspace-project-participants";
import { WsLocaleProvider } from "../wsLocale";

const apiMocks = vi.hoisted(() => ({
  getAccess: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  bulkCreate: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
}));

vi.mock("./workspaceParticipantsApi", () => ({
  workspaceParticipantsApi: apiMocks,
  workspaceParticipantsError: (error: unknown) => error,
}));

import WorkspaceParticipantsTab from "../tabs/WorkspaceParticipantsTab";

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

const participant: WorkspaceProjectParticipant = {
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
  readiness: { ready: false, blockers: ["contract_required"] },
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-08-30T10:00:00.000Z",
  archivedAt: null,
  version: 1,
};

const rosterResponse = (
  responseAccess: WorkspaceParticipantAccess,
  roster: WorkspaceProjectParticipant[] = [participant],
) => ({
  participants: roster,
  summary: {
    total: roster.length,
    ready: roster.filter((entry) => entry.readiness.ready).length,
    blocked: roster.filter((entry) => !entry.readiness.ready).length,
    archived: 0,
  },
  access: responseAccess,
});

const renderTab = (accessState: {
  loading: boolean;
  access: WorkspaceParticipantAccess | null;
  error: any;
}) =>
  render(
    <WsLocaleProvider value="no">
      <WorkspaceParticipantsTab
        projectId="project-1"
        accessState={accessState}
      />
    </WsLocaleProvider>,
  );

describe("WorkspaceParticipantsTab access and primary states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call the participant list while project access is loading", () => {
    const { container } = renderTab({
      loading: true,
      access: null,
      error: null,
    });

    expect(container.querySelector(".MuiSkeleton-root")).toBeTruthy();
    expect(apiMocks.list).not.toHaveBeenCalled();
  });

  it("fails closed on a denied enterprise feature permission", async () => {
    renderTab({
      loading: false,
      access: null,
      error: {
        code: "participant_manage_denied",
        message: "Kun tilgjengelig for administratorer",
        status: 403,
      },
    });

    expect(
      await screen.findByText("Du har ikke tilgang til denne funksjonen"),
    ).toBeTruthy();
    expect(
      screen.getByText("Kun tilgjengelig for administratorer"),
    ).toBeTruthy();
    expect(apiMocks.getAccess).not.toHaveBeenCalled();
    expect(apiMocks.list).not.toHaveBeenCalled();
  });

  it("shows an Enterprise upgrade state when the backend rejects a non-member", async () => {
    renderTab({
      loading: false,
      access: null,
      error: {
        code: "enterprise_required",
        message: "Enterprise-medlemskap er påkrevd",
        status: 403,
      },
    });

    expect(
      await screen.findByText("Enterprise-funksjon for foto og video"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Se Enterprise" })).toBeTruthy();
    expect(apiMocks.list).not.toHaveBeenCalled();
  });

  it("renders a real empty roster with management actions", async () => {
    apiMocks.getAccess.mockResolvedValue(access);
    apiMocks.list.mockResolvedValue({
      participants: [],
      summary: { total: 0, ready: 0, blocked: 0, archived: 0 },
      access,
    });
    renderTab({
      loading: false,
      access,
      error: null,
    });

    expect(
      await screen.findByText("Ingen medvirkende er lagt til"),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Legg til person" }).length,
    ).toBeGreaterThan(0);
    expect(apiMocks.list).toHaveBeenCalledWith("project-1");
  });

  it("keeps the roster read-only when project access cannot manage participants", async () => {
    const readOnlyAccess = {
      ...access,
      canManage: false,
      canConfigureRequirements: false,
      role: "participant_viewer" as const,
    };
    apiMocks.getAccess.mockResolvedValue(readOnlyAccess);
    apiMocks.list.mockResolvedValue({
      participants: [],
      summary: { total: 0, ready: 0, blocked: 0, archived: 0 },
      access: readOnlyAccess,
    });
    renderTab({
      loading: false,
      access: readOnlyAccess,
      error: null,
    });

    expect(await screen.findByText(/Du har lesetilgang/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Legg til person" }),
    ).toBeNull();
  });

  it("shows redacted contact as hidden instead of inferring missing PII for viewers", async () => {
    const readOnlyAccess = {
      ...access,
      canManage: false,
      canConfigureRequirements: false,
      role: "participant_viewer" as const,
    };
    apiMocks.list.mockResolvedValue({
      participants: [
        {
          id: "participant-1",
          projectId: "project-1",
          organizationId: "org-1",
          externalReference: null,
          displayName: "Kari Nordmann",
          email: null,
          phone: null,
          participantType: "extra",
          roleLabel: "Statist",
          engagementType: "undecided",
          workflowStatus: "confirmed",
          isMinor: false,
          guardianStatus: "not_required",
          workPermitStatus: "not_required",
          requiresContract: false,
          requiresMediaConsent: false,
          requiresCompensation: false,
          notes: null,
          metadata: {},
          readiness: { ready: true, blockers: [] },
          createdAt: "2026-08-30T10:00:00.000Z",
          updatedAt: "2026-08-30T10:00:00.000Z",
          archivedAt: null,
          version: 1,
        },
      ],
      summary: { total: 1, ready: 1, blocked: 0, archived: 0 },
      access: readOnlyAccess,
    });

    renderTab({ loading: false, access: readOnlyAccess, error: null });

    expect((await screen.findAllByText("Skjult")).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Søk navn eller rolle")).toBeTruthy();
    expect(screen.queryByLabelText("Søk navn, e-post eller rolle")).toBeNull();
  });

  it("persists minor and requirement controls for an authorized requirement administrator", async () => {
    apiMocks.list.mockResolvedValue(rosterResponse(access));
    apiMocks.update.mockResolvedValue(participant);
    renderTab({ loading: false, access, error: null });

    const actionButtons = await screen.findAllByRole("button", {
      name: "Handlinger: Kari Nordmann",
    });
    fireEvent.click(actionButtons[0]);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rediger" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Personen er mindreårig" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Honoraravtale" }));
    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));

    await waitFor(() => expect(apiMocks.update).toHaveBeenCalledTimes(1));
    const patch = apiMocks.update.mock.calls[0][2];
    expect(patch).toMatchObject({
      isMinor: true,
      requiresContract: true,
      requiresMediaConsent: true,
      requiresCompensation: false,
      workflowStatus: "draft",
      version: 1,
    });
    expect(patch).not.toHaveProperty("guardianStatus");
    expect(patch).not.toHaveProperty("workPermitStatus");
  });

  it("locks and omits requirement controls without granular configuration access", async () => {
    const managerAccess = {
      ...access,
      canConfigureRequirements: false,
      role: "participant_manager" as const,
    };
    apiMocks.list.mockResolvedValue(rosterResponse(managerAccess));
    apiMocks.update.mockResolvedValue(participant);
    renderTab({ loading: false, access: managerAccess, error: null });

    const actionButtons = await screen.findAllByRole("button", {
      name: "Handlinger: Kari Nordmann",
    });
    fireEvent.click(actionButtons[0]);
    expect(screen.queryByRole("menuitem", { name: "Arkiver" })).toBeNull();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rediger" }));

    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "Arbeidsflytstatus" }),
    );
    expect(screen.queryByRole("option", { name: "Avlyst" })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    expect(
      (screen.getByRole("checkbox", { name: "Kontrakt" }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Mediesamtykke",
        }) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Honoraravtale",
        }) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Personen er mindreårig" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));

    await waitFor(() => expect(apiMocks.update).toHaveBeenCalledTimes(1));
    const patch = apiMocks.update.mock.calls[0][2];
    expect(patch.isMinor).toBe(true);
    expect(patch).not.toHaveProperty("requiresContract");
    expect(patch).not.toHaveProperty("requiresMediaConsent");
    expect(patch).not.toHaveProperty("requiresCompensation");
  });

  it("shows work-permit clearance only to requirement admins for minors", async () => {
    apiMocks.list.mockResolvedValue(
      rosterResponse(access, [
        {
          ...participant,
          isMinor: true,
          guardianStatus: "approved",
          workPermitStatus: "pending",
        },
      ]),
    );
    renderTab({ loading: false, access, error: null });

    fireEvent.click(
      (
        await screen.findAllByRole("button", {
          name: "Handlinger: Kari Nordmann",
        })
      )[0],
    );
    expect(
      await screen.findByRole("menuitem", { name: "Arbeidstillatelse" }),
    ).toBeTruthy();
  });

  it("describes guardian acceptance as email-link acceptance without eID assurance", async () => {
    apiMocks.list.mockResolvedValue(
      rosterResponse(access, [
        {
          ...participant,
          isMinor: true,
          guardianStatus: "approved",
          workPermitStatus: "pending",
        },
      ]),
    );
    renderTab({ loading: false, access, error: null });

    fireEvent.click(
      (
        await screen.findAllByRole("button", {
          name: "Handlinger: Kari Nordmann",
        })
      )[0],
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rediger" }));

    expect(
      await screen.findByText(
        "Akseptert via e-postlenke – identitet ikke eID-verifisert",
      ),
    ).toBeTruthy();
  });
});
