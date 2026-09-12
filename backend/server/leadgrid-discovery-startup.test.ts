import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerCoreJobHandlers } from "./job-handlers.js";
import { clearJobHandlers, processNextJob } from "./job-queue.js";
import { LEADGRID_DISCOVERY_JOB_TYPE } from "./leadgrid-discovery-service.js";

beforeEach(() => clearJobHandlers());
afterEach(() => clearJobHandlers());

describe("Leadgrid Discovery startup wiring", () => {
  it("uses cron-parser through its Node ESM-compatible CommonJS default", () => {
    const source = readFileSync(
      new URL("./leadgrid-continuous-discovery.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain('import cronParser from "cron-parser";');
    expect(source).not.toContain(
      'import { parseExpression } from "cron-parser";',
    );

    const probe = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        'import cronParser from "cron-parser"; const { parseExpression } = cronParser; if (typeof parseExpression !== "function") process.exit(2);',
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(probe.status, probe.stderr).toBe(0);
  });

  it("registers the canonical HTTP routes from backend startup", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const service = readFileSync(
      new URL("./leadgrid-discovery-service.ts", import.meta.url),
      "utf8",
    );
    const entitlements = readFileSync(
      new URL("./superadmin-routes.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain(
      'import { registerLeadgridDiscoveryRoutes } from "./leadgrid-discovery-routes.js";',
    );
    expect(source).toContain(
      "registerLeadgridDiscoveryRoutes({ app, pool, activeSessions });",
    );
    expect(source).not.toContain("registerLeadgridProjectLeadDiscoveryRoutes");
    expect(source).toContain('error: "legacy_discovery_retired"');
    expect(service).toContain('from "./leadgrid-discovery-brreg-provider.js"');
    expect(service).not.toContain("leadgrid-discovery-places-provider");
    expect(entitlements).toContain("isLeadgridDiscoveryEnabled()");
    expect(entitlements).toContain("leadgrid_discovery_enabled: false");
    expect(entitlements).toContain(
      "leadgrid_discovery_enabled: isLeadgridDiscoveryEnabled()",
    );
  });

  it("can restore the Discovery handler after the registry is cleared", async () => {
    registerCoreJobHandlers();
    clearJobHandlers();
    registerCoreJobHandlers();

    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            job_type: LEADGRID_DISCOVERY_JOB_TYPE,
            payload: {},
            attempts: 1,
            max_attempts: 3,
            lease_token: "22222222-2222-4222-8222-222222222222",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValue({ rows: [], rowCount: 1 });

    await expect(processNextJob({ query } as unknown as Pool)).resolves.toBe(
      "requeued",
    );
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain("SET status = $2");
    expect(query.mock.calls[1]?.[1]?.[1]).toBe("queued");
  });
});
