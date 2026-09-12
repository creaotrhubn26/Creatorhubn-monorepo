import { describe, expect, it } from "vitest";
import { CREATORHUB_FEATURES } from "@shared/creatorhub-features";
import { getAllProfessionFeatures } from "@shared/profession-feature-matrix";
import { WORKSPACE_PROJECT_PARTICIPANTS_FEATURE_ID } from "@shared/workspace-project-participants";
import {
  getConfigurableEnterpriseFeatures,
  transitionEnterpriseFeaturePermission,
  type EnterpriseFeaturePermissionState,
} from "./enterpriseFeaturePermissionsModel";

const state = (): EnterpriseFeaturePermissionState => ({
  adminOnlyFeatures: ["target", "admin-feature"],
  disabledFeatures: ["target", "disabled-feature"],
  customPermissions: {
    target: {
      featureId: "target",
      permissionLevel: "admin_member",
      allowedRoles: ["admin", "member"],
    },
    untouched: {
      featureId: "untouched",
      permissionLevel: "all",
      allowedRoles: ["admin", "member", "viewer"],
    },
  },
});

describe("transitionEnterpriseFeaturePermission", () => {
  it("removes stale list/custom policies and persists an explicit all override", () => {
    const initial = state();
    const result = transitionEnterpriseFeaturePermission(
      initial,
      "target",
      "all",
    );

    expect(result.adminOnlyFeatures).toEqual(["admin-feature"]);
    expect(result.disabledFeatures).toEqual(["disabled-feature"]);
    expect(result.customPermissions.target).toEqual({
      featureId: "target",
      permissionLevel: "all",
      allowedRoles: ["admin", "member", "viewer"],
    });
    expect(result.customPermissions.untouched).toEqual(
      initial.customPermissions.untouched,
    );
    expect(initial.customPermissions.target.permissionLevel).toBe(
      "admin_member",
    );
  });

  it.each([
    ["admin_only", ["target"], [], undefined],
    ["disabled", [], ["target"], undefined],
    [
      "admin_member",
      [],
      [],
      {
        featureId: "target",
        permissionLevel: "admin_member",
        allowedRoles: ["admin", "member"],
      },
    ],
  ] as const)(
    "makes a %s transition exclusive across every policy source",
    (level, expectedAdminOnly, expectedDisabled, expectedCustom) => {
      const result = transitionEnterpriseFeaturePermission(
        {
          adminOnlyFeatures: ["target"],
          disabledFeatures: ["target"],
          customPermissions: state().customPermissions,
        },
        "target",
        level,
      );

      expect(result.adminOnlyFeatures).toEqual(expectedAdminOnly);
      expect(result.disabledFeatures).toEqual(expectedDisabled);
      expect(result.customPermissions.target).toEqual(expectedCustom);
    },
  );
});

describe("Workspace participants Enterprise catalog visibility", () => {
  it("is registered and configurable for both photographer and videographer", () => {
    expect(
      CREATORHUB_FEATURES.find(
        (feature) => feature.id === WORKSPACE_PROJECT_PARTICIPANTS_FEATURE_ID,
      ),
    ).toMatchObject({
      professions: ["photographer", "videographer"],
      requiredPlan: "enterprise",
      isCore: false,
    });

    for (const profession of ["photographer", "videographer"] as const) {
      const configurable = getConfigurableEnterpriseFeatures(
        getAllProfessionFeatures(profession),
      );
      expect(
        configurable.find(
          (feature) =>
            feature.featureId === WORKSPACE_PROJECT_PARTICIPANTS_FEATURE_ID,
        ),
      ).toMatchObject({ plan: "enterprise", optional: true });
    }
  });
});
