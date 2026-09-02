import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, suffix: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path, suffix) : path.endsWith(suffix) ? [path] : [];
  });
}

const repositoryRoot = new URL("../..", import.meta.url).pathname;
const swiftRoot = join(repositoryRoot, "ipad/LeadMapApp/LeadMapApp");
const serverRoot = join(repositoryRoot, "backend/server");

function clientEndpoints(): string[] {
  const swift = walk(swiftRoot, ".swift").map((file) => readFileSync(file, "utf8")).join("\n");
  return [...new Set(
    [...swift.matchAll(/"(\/api\/(?:admin-room\/lead-map|leadgrid)[^"\n]*)"/g)]
      .map((match) => match[1])
      .map((endpoint) => endpoint
        .replace(/\\\([^)]*\)/g, ":param")
        .split("?")[0]
        .replace(/\/$/, "")),
  )].sort();
}

describe("Leadgrid iOS to backend route contract", () => {
  it("has a registered backend route family for every Leadgrid API literal used by iOS", () => {
    const backend = walk(serverRoot, ".ts")
      .filter((file) => !file.endsWith(".test.ts"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const endpoints = clientEndpoints();
    const dynamicRouteProof: Record<string, [string, string]> = {
      "/api/admin-room/lead-map/deliverables/:param": [
        'const ROOT = "/api/admin-room/lead-map"',
        '${ROOT}/deliverables/:id',
      ],
      "/api/admin-room/lead-map/deliverables/:param/step": [
        'const ROOT = "/api/admin-room/lead-map"',
        '${ROOT}/deliverables/:id/step',
      ],
      "/api/admin-room/lead-map/focus-requests": [
        'const ROOT = "/api/admin-room/lead-map"',
        '${ROOT}/focus-requests',
      ],
      "/api/admin-room/lead-map/focus-requests/:param/start-delivery": [
        'const ROOT = "/api/admin-room/lead-map"',
        '${ROOT}/focus-requests/:id/start-delivery',
      ],
      "/api/admin-room/lead-map/pitch-deck/availability": [
        'const ROOT = "/api/admin-room/lead-map/pitch-deck"',
        '${ROOT}/availability',
      ],
    };
    const missing = endpoints.filter((endpoint) => {
      const stablePrefix = endpoint.split(":param")[0].replace(/\/$/, "");
      const meaningfulTail = endpoint.split("/")
        .filter(Boolean)
        .filter((part) => part !== ":param")
        .slice(-2)
        .join("/");
      if (backend.includes(stablePrefix) || backend.includes(meaningfulTail)) return false;
      const proof = dynamicRouteProof[endpoint];
      return !proof || !proof.every((fragment) => backend.includes(fragment));
    });

    // Dynamic `${ROOT}` registrations are still proved by their root and
    // suffix in the source; the heuristic above deliberately supports both.
    expect(endpoints.length).toBeGreaterThanOrEqual(350);
    expect(missing).toEqual([]);
  });

  it("keeps meeting time, duration and completion on one read/write contract", () => {
    const client = [
      readFileSync(join(swiftRoot, "Core/APIClient+MoteBrief.swift"), "utf8"),
      readFileSync(join(swiftRoot, "Core/MetricsModel.swift"), "utf8"),
      readFileSync(join(swiftRoot, "Views/Tabs/Moeter/MeetingsView.swift"), "utf8"),
    ].join("\n");
    const routes = [
      readFileSync(join(serverRoot, "lead-map-competitor-routes.ts"), "utf8"),
      readFileSync(join(serverRoot, "leadgrid-motebrief-routes.ts"), "utf8"),
    ].join("\n");

    for (const field of ["durationMinutes", "meetingStatus", "meetingLogged", "meetingAt", "requestId"]) {
      expect(client).toContain(field);
      expect(routes).toContain(field);
    }
    expect(routes).toContain("meeting_duration_minutes");
    expect(routes).toContain("ON CONFLICT (organization_id, request_id)");
    expect(routes).toContain("BEGIN");
    expect(routes).toContain("COMMIT");
  });

  it("has a migration for every Leadgrid table that a route can self-heal", () => {
    const routeSources = walk(serverRoot, ".ts")
      .filter((file) => /\/(leadgrid-|lead-map-)/.test(file) && !file.endsWith(".test.ts"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const runtimeTables = [...new Set(
      [...routeSources.matchAll(/CREATE TABLE IF NOT EXISTS (leadgrid_[a-z0-9_]+)/g)]
        .map((match) => match[1]),
    )].sort();
    const migrationSources = walk(join(repositoryRoot, "backend/migrations"), ".sql")
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const missing = runtimeTables.filter((table) => !migrationSources.includes(table));

    expect(runtimeTables.length).toBeGreaterThanOrEqual(20);
    expect(missing).toEqual([]);
  });
});
