import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { AssignLeadDialog } from "./AssignLeadDialog";

const crmLeadId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AssignLeadDialog persisted scope", () => {
  it("does not request candidates when a newly promoted lead lacks project scope", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AssignLeadDialog
        open
        onClose={() => undefined}
        customerId={crmLeadId}
        mode="assign"
        level="both"
      />,
    );

    expect(await screen.findByText(/mangler valgt Leadgrid-prosjekt/)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests both candidate groups with CRM lead and project selectors", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(
      JSON.stringify({ users: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AssignLeadDialog
        open
        onClose={() => undefined}
        customerId={crmLeadId}
        projectId={projectId}
        mode="assign"
        level="both"
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    for (const [input] of fetchMock.mock.calls) {
      const url = new URL(String(input), "https://leadgrid.no");
      expect(url.pathname).toBe("/api/leadgrid/assignable-users");
      expect(url.searchParams.get("leadId")).toBe(crmLeadId);
      expect(url.searchParams.get("projectId")).toBe(projectId);
    }
  });
});
