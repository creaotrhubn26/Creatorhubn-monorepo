import { describe, expect, it } from "vitest";
import { friendlyDeliveryErrorMessage } from "./captureSessionDeliveryErrors";

/**
 * Pins the Norwegian phrasing the UI shows for each known backend
 * error code. The component stringifies ``Error.message``; the
 * backend emits ``{ error: "<code>" }`` bodies, so matching on the
 * code substring is robust across HTTP status refactors.
 */
describe("friendlyDeliveryErrorMessage", () => {
  it("returns null when there is no error", () => {
    expect(friendlyDeliveryErrorMessage(null)).toBeNull();
    expect(friendlyDeliveryErrorMessage(undefined)).toBeNull();
  });

  it("explains no_picks with an actionable next step", () => {
    expect(
      friendlyDeliveryErrorMessage(new Error('{"error":"no_picks"}')),
    ).toContain("Merk noen bilder som hero");
  });

  it("explains not_found as session-is-gone", () => {
    expect(
      friendlyDeliveryErrorMessage(new Error("404: not_found")),
    ).toContain("ikke lenger");
  });

  it("handles unauthorized via either code or 401 status", () => {
    const msg = "Du er ikke logget inn.";
    expect(
      friendlyDeliveryErrorMessage(new Error('{"error":"unauthorized"}')),
    ).toContain("ikke logget inn");
    expect(
      friendlyDeliveryErrorMessage(new Error("401 Unauthorized")),
    ).toContain("ikke logget inn");
    expect(friendlyDeliveryErrorMessage(new Error(msg))).toBeTruthy();
  });

  it("handles forbidden as ownership message", () => {
    expect(
      friendlyDeliveryErrorMessage(new Error("403 forbidden")),
    ).toContain("ikke tilgang");
  });

  it("maps 5xx to a retry suggestion", () => {
    expect(
      friendlyDeliveryErrorMessage(new Error("500 Internal Server Error")),
    ).toContain("Prøv igjen");
    expect(
      friendlyDeliveryErrorMessage(new Error("503 Service Unavailable")),
    ).toContain("Prøv igjen");
  });

  it("falls back to a generic message for unknown errors", () => {
    const out = friendlyDeliveryErrorMessage(new Error("something weird"));
    expect(out).toBe("Kunne ikke levere økten. Prøv igjen om et øyeblikk.");
  });

  it("treats an Error with an empty message as the generic fallback", () => {
    const out = friendlyDeliveryErrorMessage(new Error(""));
    expect(out).toBe("Kunne ikke levere økten. Prøv igjen om et øyeblikk.");
  });
});
