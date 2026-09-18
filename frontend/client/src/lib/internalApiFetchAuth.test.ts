import { describe, expect, it, vi } from "vitest";
import { withInternalApiAuthorization } from "./internalApiFetchAuth";

const location = {
  origin: "https://creatorhub.example",
  host: "creatorhub.example",
} as Pick<Location, "origin" | "host">;

describe("withInternalApiAuthorization", () => {
  it("treats credentials omit as an anonymous opt-out without reading auth", () => {
    const readToken = vi.fn(() => "account-token");
    const init = {
      credentials: "omit",
      headers: { "X-Workspace-Participant-Document-Token": "personal-token" },
    } satisfies RequestInit;

    const result = withInternalApiAuthorization(
      "/api/public/workspace-participant-documents/document-1",
      init,
      location,
      readToken,
    );

    expect(result).toBe(init);
    expect(result?.credentials).toBe("omit");
    expect(new Headers(result?.headers).get("Authorization")).toBeNull();
    expect(readToken).not.toHaveBeenCalled();
  });

  it("keeps the existing account-auth behavior for normal internal calls", () => {
    const result = withInternalApiAuthorization(
      "/api/projects",
      undefined,
      location,
      () => "account-token",
    );

    expect(result?.credentials).toBe("include");
    expect(new Headers(result?.headers).get("Authorization")).toBe(
      "Bearer account-token",
    );
  });
});
