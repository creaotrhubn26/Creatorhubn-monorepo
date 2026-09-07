import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("./AssignLeadDialog", () => ({
  AssignLeadDialog: (props: {
    customerId: string;
    projectId?: string;
    mode: string;
  }) => (
    <div
      data-testid="assignment-dialog"
      data-customer-id={props.customerId}
      data-project-id={props.projectId}
      data-mode={props.mode}
    />
  ),
}));

import { LeadInboxCard } from "./LeadInboxCard";

const agencyLeadId = "11111111-1111-4111-8111-111111111111";
const crmLeadId = "22222222-2222-4222-8222-222222222222";
const organizationId = "33333333-3333-4333-8333-333333333333";
const projectId = "dentum-oslo";

const sourceLead = {
  id: agencyLeadId,
  agency_name: "Dentum AS",
  contact_name: "Ada Admin",
  email: "ada@dentum.no",
  phone: null,
  website: "https://dentum.no",
  org_number: "123456789",
  source: "book_demo",
  created_at: "2026-09-06T08:00:00.000Z",
  consent_research_given: true,
  research_status: "completed",
  research_completed_at: "2026-09-06T08:05:00.000Z",
  claude_summary: "God match",
  claude_temperature: "hot",
  claude_talking_points: [],
  claude_next_action: "Ring",
  brreg_data: null,
  website_scrape_data: null,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LeadInboxCard promotion before assignment", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens assignment only with the CRM id returned after project promotion", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/admin-room/lead-map/projects")) {
        return jsonResponse({
          projects: [{ id: projectId, organizationId, name: "Dentum Oslo" }],
        });
      }
      if (url === "/api/superadmin/leads/inbox") {
        return jsonResponse({ items: [sourceLead] });
      }
      if (url === `/api/superadmin/leads/${agencyLeadId}/accept-as-project`) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({ projectId });
        return jsonResponse({
          ok: true,
          promotion: {
            agencyLeadId,
            crmLeadId,
            organizationId,
            projectId,
            created: true,
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LeadInboxCard />);
    const button = await screen.findByRole("button", { name: "Legg til + tildel" });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByTestId("assignment-dialog")).not.toBeInTheDocument();

    fireEvent.click(button);

    const dialog = await screen.findByTestId("assignment-dialog");
    expect(dialog).toHaveAttribute("data-customer-id", crmLeadId);
    expect(dialog).not.toHaveAttribute("data-customer-id", agencyLeadId);
    expect(dialog).toHaveAttribute("data-project-id", projectId);
    expect(dialog).toHaveAttribute("data-mode", "assign");
  });

  it("fails closed when no accessible Leadgrid project exists", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin-room/lead-map/projects")) {
        return jsonResponse({ projects: [] });
      }
      if (url === "/api/superadmin/leads/inbox") {
        return jsonResponse({ items: [sourceLead] });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LeadInboxCard />);

    expect(await screen.findByText(/Ingen tilgjengelige Leadgrid-prosjekter/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Legg til + tildel" })).toBeDisabled();
    expect(fetchMock.mock.calls.some(([input]) =>
      String(input).includes("accept-as-project"),
    )).toBe(false);
  });
});
