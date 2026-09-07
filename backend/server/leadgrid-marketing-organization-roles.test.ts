import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  VALID_ORGANIZATION_MEMBER_ROLES,
  isValidOrganizationMemberRole,
} from "./lead-map-org-routes.js";
import {
  VALID_PROMOTION_TARGET_ROLES,
  isValidPromotionTargetRole,
} from "./lead-map-promotion-routes.js";

const migration = readFileSync(
  new URL(
    "../migrations/0531_leadgrid_marketing_organization_roles.sql",
    import.meta.url,
  ),
  "utf8",
);

const MARKETING_ROLES = [
  "markedssjef",
  "markedskoordinator",
  "seo_spesialist",
  "content_ansvarlig",
  "performance_marketer",
  "markedsanalytiker",
] as const;

describe("Leadgrid marketing organization-role contract", () => {
  it("allows every marketing role in member and invitation persistence", () => {
    for (const role of MARKETING_ROLES) {
      expect(migration).toContain(`'${role}'`);
    }
    expect(migration).toContain(
      "VALIDATE CONSTRAINT organization_members_role_check",
    );
    expect(migration).toContain(
      "VALIDATE CONSTRAINT project_invitations_role_check",
    );
  });

  it("accepts every marketing role through invitation and member-update validation", () => {
    for (const role of MARKETING_ROLES) {
      expect(VALID_ORGANIZATION_MEMBER_ROLES).toContain(role);
      expect(isValidOrganizationMemberRole(role)).toBe(true);
    }
  });

  it("accepts every marketing role through promotion validation", () => {
    for (const role of MARKETING_ROLES) {
      expect(VALID_PROMOTION_TARGET_ROLES).toContain(role);
      expect(isValidPromotionTargetRole(role)).toBe(true);
    }
  });

  it("rejects unknown and non-string roles at both API boundaries", () => {
    for (const role of ["marketing_admin", "super_admin", "", null, 42]) {
      expect(isValidOrganizationMemberRole(role)).toBe(false);
      expect(isValidPromotionTargetRole(role)).toBe(false);
    }
  });
});
