import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  TIDUM_ANBUD_PROFILE,
  recommendedAnbudProfileForDomain,
} from "./leadgrid-anbud-profile.js";

const migration = readFileSync(
  new URL("../migrations/0602_leadgrid_anbud_project_profiles.sql", import.meta.url),
  "utf8",
);

describe("Leadgrid Tidum anbud profile", () => {
  it("uses product-side software CPV and never the buyer-industry care code", () => {
    expect(TIDUM_ANBUD_PROFILE).toMatchObject({
      template_key: "tidum.procurement",
      template_version: 1,
      requires_admin_confirmation: true,
    });
    expect(TIDUM_ANBUD_PROFILE.cpv_codes).toEqual([
      "48450000",
      "72212450",
      "48332000",
      "48311000",
      "48311100",
    ]);
    expect(TIDUM_ANBUD_PROFILE.cpv_codes).not.toContain("85000000");
    expect(TIDUM_ANBUD_PROFILE.suggested_watches).toHaveLength(3);
    expect(new Set(TIDUM_ANBUD_PROFILE.suggested_watches.map((item) => item.key)).size)
      .toBe(3);
  });

  it("matches only the canonical Tidum domain", () => {
    expect(recommendedAnbudProfileForDomain("WWW.TIDUM.NO"))
      .toBe(TIDUM_ANBUD_PROFILE);
    expect(recommendedAnbudProfileForDomain("not-tidum.no")).toBeNull();
    expect(recommendedAnbudProfileForDomain(null)).toBeNull();
  });

  it("keeps profiles and managed watches project scoped and idempotent", () => {
    expect(migration).toMatch(
      /FOREIGN KEY \(organization_id, project_id\)[\s\S]+REFERENCES leadgrid_projects\(organization_id, id\)/,
    );
    expect(migration).toContain("UNIQUE (organization_id, project_id)");
    expect(migration).toContain("uq_doffin_watches_project_template");
    expect(migration).toContain("WHERE template_key IS NOT NULL");
    expect(migration).toContain("requires_admin_confirmation BOOLEAN NOT NULL DEFAULT TRUE");
  });
});
