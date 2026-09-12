import { describe, expect, it, vi } from "vitest";

import { loadLatestResearchVersion } from "./role-room-research-versions.js";

describe("loadLatestResearchVersion", () => {
  it("returns the newest stored result without creating a version", async () => {
    const generatedAt = new Date("2026-09-03T17:27:09.702Z");
    const serializedResult = { researchId: "research-17", companyProfile: { companyName: "MEDINNOVA AS" } };
    const query = vi.fn().mockResolvedValue({
      rows: [{
        research_id: "research-17",
        version_number: 17,
        generated_at: generatedAt,
        serialized_result: serializedResult,
      }],
    });

    await expect(loadLatestResearchVersion({ query } as never, "project-1")).resolves.toEqual({
      researchId: "research-17",
      versionNumber: 17,
      generatedAt: generatedAt.toISOString(),
      serializedResult,
    });
    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain("ORDER BY version_number DESC");
    expect(String(query.mock.calls[0]?.[0])).not.toContain("INSERT");
    expect(query.mock.calls[0]?.[1]).toEqual(["project-1"]);
  });

  it("returns null when no durable version exists", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await expect(loadLatestResearchVersion({ query } as never, "project-1")).resolves.toBeNull();
  });
});
