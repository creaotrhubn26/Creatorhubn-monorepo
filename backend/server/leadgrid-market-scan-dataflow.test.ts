import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const service = readFileSync(
  new URL("./market-intelligence/market-scan-service.ts", import.meta.url),
  "utf8",
);
const competitorRoutes = readFileSync(
  new URL("./lead-map-competitor-routes.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../migrations/0529_leadgrid_project_identity_indexes.sql", import.meta.url),
  "utf8",
);

describe("Leadgrid Market Intelligence durable dataflow", () => {
  it("persists every discovered competitor with scan, owner, workspace and project", () => {
    expect(service).toContain(
      "market_scan_id, workspace_owner_user_id, organization_id, project_id",
    );
    expect(service).toContain("scan.workspaceOwnerUserId");
    expect(service).toContain("scan.organizationId ?? null");
    expect(service).toContain("scan.projectId ?? null");
  });

  it("uses the real JSONB evidence column for manually created competitors", () => {
    expect(competitorRoutes).toContain("confidence, source_urls");
    expect(competitorRoutes).toContain("'high', '[]'::jsonb");
    expect(competitorRoutes).not.toContain("confidence, evidence_urls");
  });

  it("fetches competitor sites with socket-level SSRF and bounded resources", () => {
    expect(service).toContain("ssrfSafeFetchWithMetadata");
    expect(service).toContain("const maxBytes = 2_000_000");
    expect(service).toContain("controller.abort()");
    expect(service).toContain("await reader.cancel()");
    const fetcher = service.slice(
      service.indexOf("async function fetchHtml"),
      service.indexOf("// ─────────────────────────────────────────────────────────────────────\n// CRUD helpers"),
    );
    expect(fetcher).not.toMatch(/\bfetch\s*\(/);
    expect(fetcher).not.toContain('redirect: "follow"');
  });

  it("repairs historic scope and indexes exact project identity lookups", () => {
    expect(migration).toContain("UPDATE market_scans scan");
    expect(migration).toContain("UPDATE market_scan_competitors competitor");
    expect(migration).toContain("scan.project_id = project.id");
    expect(migration).toContain("idx_market_scans_org_project_created");
    expect(migration).toContain("idx_msc_org_project_created");
    expect(migration).toContain("idx_crm_org_project_orgnr");
    expect(migration).toContain("idx_crm_org_project_domain");
    expect(migration).toContain("idx_crm_org_project_place");
  });
});
