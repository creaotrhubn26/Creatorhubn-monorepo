import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthHeadersSync } = vi.hoisted(() => ({
  getAuthHeadersSync: vi.fn(() => ({ Authorization: "Bearer session-1" })),
}));

vi.mock("../services/authSessionService", () => ({
  default: { getAuthHeadersSync },
}));

import {
  isProtectedRoleRoomMediaUrl,
  roleRoomMediaToDataUrl,
  useRoleRoomMediaUrl,
} from "./protectedMedia";

describe("protected Role Room media", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(["ABC"], { type: "image/png" }),
      }),
    );
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:mockup-preview"),
        revokeObjectURL: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("recognizes only the access-controlled mockup output route", () => {
    expect(
      isProtectedRoleRoomMediaUrl(
        "/api/role-room/feed-mockup-outputs/output-1/content",
      ),
    ).toBe(true);
    expect(isProtectedRoleRoomMediaUrl("data:image/png;base64,QUJD")).toBe(
      false,
    );
    expect(isProtectedRoleRoomMediaUrl("https://example.com/image.png")).toBe(
      false,
    );
  });

  it("fetches protected media with Role Room auth and exposes a disposable preview URL", async () => {
    const source = "/api/role-room/feed-mockup-outputs/output-1/content";
    const { result, unmount } = renderHook(() => useRoleRoomMediaUrl(source));
    await waitFor(() => expect(result.current.url).toBe("blob:mockup-preview"));
    expect(fetch).toHaveBeenCalledWith(source, {
      headers: { Authorization: "Bearer session-1" },
      credentials: "include",
    });
    act(() => unmount());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mockup-preview");
  });

  it("materializes protected output before it enters the publishing contract", async () => {
    const result = await roleRoomMediaToDataUrl(
      "/api/role-room/feed-mockup-outputs/output-1/content",
    );
    expect(result).toMatch(/^data:image\/png;base64,/);
  });
});
