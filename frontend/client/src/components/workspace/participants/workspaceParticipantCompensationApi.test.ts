import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: mocks.apiRequest }));

import { workspaceParticipantCompensationApi } from "./workspaceParticipantCompensationApi";

describe("workspace participant compensation API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses encoded paths and sends the OCC/idempotency request unchanged", async () => {
    mocks.apiRequest.mockResolvedValue({});
    const request = {
      compensationType: "hourly" as const,
      hourlyRate: 625,
      estimatedHours: 8,
      currency: "NOK",
      note: null,
      idempotencyKey: "00000000-0000-4000-8000-000000000111",
      expectedCurrentVersion: 2,
    };

    await workspaceParticipantCompensationApi.current(
      "project / 1",
      "person/1",
    );
    await workspaceParticipantCompensationApi.history(
      "project / 1",
      "person/1",
    );
    await workspaceParticipantCompensationApi.createVersion(
      "project / 1",
      "person/1",
      request,
    );

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      1,
      "/api/projects/project%20%2F%201/participants/person%2F1/compensation/current",
      undefined,
    );
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      2,
      "/api/projects/project%20%2F%201/participants/person%2F1/compensation/history",
      undefined,
    );
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      3,
      "/api/projects/project%20%2F%201/participants/person%2F1/compensation",
      { method: "POST", body: request },
    );
  });
});
