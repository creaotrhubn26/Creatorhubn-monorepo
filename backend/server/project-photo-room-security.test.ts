import { describe, expect, it, vi } from "vitest";

import { findProjectPhotoAsset } from "./project-workspace-routes.js";

describe("Photo Room asset tenancy", () => {
  it("rejects malformed ids before touching the database", async () => {
    const pool = { query: vi.fn() };
    await expect(findProjectPhotoAsset(pool, "project-a", "not-a-uuid")).resolves.toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("binds every asset lookup to its Capture session project", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const assetId = "00000000-0000-4000-8000-000000000001";
    await findProjectPhotoAsset({ query }, "project-a", assetId);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("JOIN capture_sessions");
    expect(query.mock.calls[0][0]).toContain("session.project_id = $2");
    expect(query.mock.calls[0][1]).toEqual([assetId, "project-a"]);
  });
});
