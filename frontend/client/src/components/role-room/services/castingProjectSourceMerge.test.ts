import { describe, expect, it } from "vitest";

import type { CastingProject } from "../models/casting";
import {
  CANONICAL_CASTING_PROJECT_SOURCE,
  mergeCanonicalProjectShellWithLocal,
} from "./castingProjectSourceMerge";

const project = (value: Partial<CastingProject>): CastingProject => ({
  id: "project-1",
  name: "Project",
  roles: [],
  candidates: [],
  crew: [],
  schedules: [],
  locations: [],
  props: [],
  ...value,
});

describe("mergeCanonicalProjectShellWithLocal", () => {
  it("preserves rich local work when the server only has a canonical shell", () => {
    const server = project({
      name: "MedSide — Helsetech kundeprosjekt",
      status: "active",
      createdBy: "current-user",
      projectStorageSource: CANONICAL_CASTING_PROJECT_SOURCE,
      metadata: { serverKey: true },
    });
    const local = project({
      name: "Old local name",
      roles: [{ id: "role-1", name: "Lege" } as any],
      previsitCampaigns: [{ id: "campaign-1", title: "PreVisit" }],
      createdBy: "stale-user",
      metadata: { localKey: true },
    });

    const merged = mergeCanonicalProjectShellWithLocal(server, local);

    expect(merged.name).toBe("MedSide — Helsetech kundeprosjekt");
    expect(merged.createdBy).toBe("current-user");
    expect(merged.roles).toEqual(local.roles);
    expect(merged.previsitCampaigns).toEqual(local.previsitCampaigns);
    expect(merged.metadata).toEqual({ localKey: true, serverKey: true });
  });

  it("leaves non-canonical server projects unchanged", () => {
    const server = project({ name: "Legacy", roles: [] });
    const local = project({ roles: [{ id: "local-role" } as any] });
    expect(mergeCanonicalProjectShellWithLocal(server, local)).toBe(server);
  });
});
