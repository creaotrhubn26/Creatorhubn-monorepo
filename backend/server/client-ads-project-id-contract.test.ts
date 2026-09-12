import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routes = readFileSync(
  fileURLToPath(new URL("./client-ads-routes.ts", import.meta.url)),
  "utf8",
);
const scopePermissions = readFileSync(
  fileURLToPath(new URL("./client-scope-permissions-service.ts", import.meta.url)),
  "utf8",
);
const agentAdsPanel = readFileSync(
  fileURLToPath(
    new URL(
      "../../frontend/client/src/components/role-room/components/producer/AgentAdsPanel.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);

const migration = readFileSync(
  fileURLToPath(
    new URL("../migrations/0502_client_ads_role_room_project_ids.sql", import.meta.url),
  ),
  "utf8",
);

describe("client Ads Role Room project-id contract", () => {
  it("migrates Ads and authorization tenant keys to Role Room text IDs", () => {
    expect(migration).toContain("ALTER COLUMN client_project_id TYPE VARCHAR(255)");
    expect(migration).toContain("USING client_project_id::text");
  });

  it("does not cast Role Room project IDs to UUID in Ads queries", () => {
    expect(routes).not.toMatch(/client_project_id\s*=\s*\$\d+::uuid/);
    expect(routes).not.toContain("client_project_id må være en gyldig UUID");
    expect(scopePermissions).not.toContain("$2::uuid, $3::uuid");
  });

  it("checks project membership before saving an Ads config", () => {
    const saveRoute = routes.slice(routes.indexOf('app.post("/api/admin-room/agent/ads/configs"'));
    expect(saveRoute.slice(0, 5000)).toContain("canAccessProjectAds");
    expect(saveRoute.slice(0, 5000)).toContain('error: "forbidden_project"');
  });

  it("uses the canonical bearer-aware fetch wrapper for Ads API calls", () => {
    expect(agentAdsPanel).toContain("apiFetch('/api/admin-room/agent/ads/configs'");
    expect(agentAdsPanel).not.toMatch(/\bfetch\((?:`|')\/api\/admin-room\/agent\/ads/);
  });
});
