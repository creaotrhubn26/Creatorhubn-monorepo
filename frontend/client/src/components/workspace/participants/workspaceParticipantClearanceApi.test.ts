import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: mocks.apiRequest }));

import { workspaceParticipantClearanceApi } from "./workspaceParticipantClearanceApi";

describe("workspace participant work-permit clearance API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses an encoded project-bound path and preserves the OCC body", async () => {
    mocks.apiRequest.mockResolvedValue({});
    const request = {
      version: 3,
      status: "approved" as const,
      evidenceReference: "workspace-file:00000000-0000-4000-8000-000000000111",
      note: "Verifisert",
    };

    await workspaceParticipantClearanceApi.get("project / 1", "person/1");
    await workspaceParticipantClearanceApi.update(
      "project / 1",
      "person/1",
      request,
    );

    const path =
      "/api/projects/project%20%2F%201/participants/person%2F1/work-permit-clearance";
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, path, undefined);
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, path, {
      method: "POST",
      body: request,
    });
  });
});
