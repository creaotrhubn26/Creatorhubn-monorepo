import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import { fetchExistingDiscoveryPlaceIds } from "./leadgrid-discovery-dedup.js";

describe("fetchExistingDiscoveryPlaceIds", () => {
  it("dedupliserer på stabil organisasjon og prosjekt", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({
      rows: [{ google_place_id: "place-a" }, { google_place_id: "place-b" }],
    }));

    const ids = await fetchExistingDiscoveryPlaceIds(
      { query } as unknown as Pool,
      {
        ownerUserId: "new-owner-after-migration",
        organizationId: "11111111-1111-4111-8111-111111111111",
        projectId: "project-a",
      },
    );

    expect([...ids]).toEqual(["place-a", "place-b"]);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("organization_id = $2::uuid");
    expect(sql).toContain("project_id IS NOT DISTINCT FROM $3");
    expect(params).toEqual([
      "new-owner-after-migration",
      "11111111-1111-4111-8111-111111111111",
      "project-a",
    ]);
  });

  it("faller tilbake til owner for eldre rader uten organisasjon", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({
      rows: [],
    }));

    await fetchExistingDiscoveryPlaceIds({ query } as unknown as Pool, {
      ownerUserId: "legacy-owner",
      organizationId: null,
      projectId: "project-b",
    });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("$2::uuid IS NULL AND owner_user_id = $1");
    expect(params).toEqual(["legacy-owner", null, "project-b"]);
  });
});
