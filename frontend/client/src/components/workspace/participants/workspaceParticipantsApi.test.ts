import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequestMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queryClient", () => ({
  apiRequest: apiRequestMock,
}));

import {
  workspaceParticipantsApi,
  workspaceParticipantsError,
} from "./workspaceParticipantsApi";

describe("workspaceParticipantsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives with the expected version and encoded project identifiers", async () => {
    apiRequestMock.mockResolvedValue({});

    await workspaceParticipantsApi.archive("project / 1", "participant/1", 7);

    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/projects/project%20%2F%201/participants/participant%2F1/archive",
      { method: "POST", body: { version: 7 } },
    );
  });

  it("preserves backend access error codes for fail-closed UI states", () => {
    const source = Object.assign(new Error("403: enterprise_required"), {
      status: 403,
      details: {
        error: "enterprise_required",
        message: "Enterprise membership is required",
      },
    });

    expect(workspaceParticipantsError(source)).toMatchObject({
      status: 403,
      code: "enterprise_required",
      message: "Enterprise membership is required",
    });
  });
});
