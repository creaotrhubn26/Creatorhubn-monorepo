import type { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { resolveCreatorHubGoogleLoginUser } from "./creatorhub-google-routes.js";

function fakePool(userRole: string, marketplace: { couple?: boolean; vendor?: boolean } = {}): Pool {
  return {
    query: async (sql: string) => {
      if (sql.includes("FROM users")) {
        return {
          rows: [
            {
              id: "32a70fa9-fd46-49db-9460-a87b23639a3c",
              email: "daniel@creatorhubn.com",
              username: "daniel",
              first_name: "Daniel",
              last_name: "Qazi",
              role: userRole,
              profession: "ceo",
              company_name: null,
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM vendors")) {
        return marketplace.vendor
          ? { rows: [{ id: "vendor-1", business_name: "Studio AS" }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM couple_profiles")) {
        return marketplace.couple
          ? { rows: [{ id: "couple-1", display_name: "Par" }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;
}

describe("Google login role resolution", () => {
  it("keeps super_admin instead of flattening it to admin", async () => {
    const user = await resolveCreatorHubGoogleLoginUser(
      fakePool("super_admin"),
      "Daniel@creatorhubn.com",
    );

    expect(user?.role).toBe("super_admin");
    expect(user?.isAdmin).toBe(true);
  });

  it("keeps super_admin even when the account also owns a couple profile", async () => {
    const user = await resolveCreatorHubGoogleLoginUser(
      fakePool("super_admin", { couple: true }),
      "daniel@creatorhubn.com",
    );

    expect(user?.role).toBe("super_admin");
  });

  it("still applies the marketplace role to non-admin accounts", async () => {
    const user = await resolveCreatorHubGoogleLoginUser(
      fakePool("user", { vendor: true }),
      "vendor@example.test",
    );

    expect(user?.role).toBe("vendor");
    expect(user?.isAdmin).toBe(false);
  });
});
