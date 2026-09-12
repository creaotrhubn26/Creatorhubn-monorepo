import { describe, expect, it, vi } from "vitest";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";

describe("resolveEffectivePermissions", () => {
  it("reads Leadgrid overrides from the dedicated tenant table", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ role: "selger" }] })
      .mockResolvedValueOnce({ rows: [{ permission_key: "leads.view" }] })
      .mockResolvedValueOnce({ rows: [
        { permission_key: "leads.create", effect: "grant" },
        { permission_key: "leads.view", effect: "revoke" },
      ] });

    const result = await resolveEffectivePermissions(
      { query } as never,
      "11111111-1111-4111-8111-111111111111",
      "user-1",
    );

    expect(result.role).toBe("selger");
    expect(result.permissions).toEqual(new Set(["leads.create"]));
    expect(query.mock.calls[2][0]).toContain("leadgrid_user_permission_overrides");
  });
});
