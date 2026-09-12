import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { canManageScheduledReports } from "./leadgrid-scheduled-reports-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("Leadgrid scheduled-report access", () => {
  it("accepts report managers and platform super-admins", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ allowed: true }] });

    await expect(canManageScheduledReports(
      { query } as unknown as Pool,
      "manager-1",
      organizationId,
    )).resolves.toBe(true);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("role = ANY"),
      [
        "manager-1",
        organizationId,
        ["owner", "admin", "markedssjef", "salgssjef"],
      ],
    );
    expect(String(query.mock.calls[0][0])).toContain("role = 'super_admin'");
  });

  it("fails closed for ordinary members", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ allowed: false }] }),
    } as unknown as Pool;

    await expect(canManageScheduledReports(
      pool,
      "seller-1",
      organizationId,
    )).resolves.toBe(false);
  });
});
