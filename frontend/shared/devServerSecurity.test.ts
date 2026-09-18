import { describe, expect, it } from "vitest";

import { resolveDevServerSecurity } from "./devServerSecurity";

describe("Vite local-admin server boundary", () => {
  it.each([
    { frontendFeatureFlag: "true", backendFeatureFlag: undefined },
    { frontendFeatureFlag: undefined, backendFeatureFlag: "true" },
    { frontendFeatureFlag: " TRUE ", backendFeatureFlag: undefined },
    { frontendFeatureFlag: undefined, backendFeatureFlag: "True" },
  ])("binds either local-admin opt-in to loopback and preserves proxy Host", (flags) => {
    expect(resolveDevServerSecurity(flags)).toEqual({
      localAdminEnabled: true,
      host: "127.0.0.1",
      allowedHosts: [],
      proxyChangeOrigin: false,
    });
  });

  it.each([undefined, "", "false", "1", "yes"])(
    "keeps ordinary IP-based device development without trusting arbitrary hosts (%s)",
    (featureFlag) => {
      expect(
        resolveDevServerSecurity({
          frontendFeatureFlag: featureFlag,
          backendFeatureFlag: featureFlag,
        }),
      ).toEqual({
        localAdminEnabled: false,
        host: "0.0.0.0",
        allowedHosts: [],
        proxyChangeOrigin: true,
      });
    },
  );
});
