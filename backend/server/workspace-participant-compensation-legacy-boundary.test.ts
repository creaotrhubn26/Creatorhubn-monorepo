import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isWorkspaceParticipantCompensationMetadata,
  WORKSPACE_PARTICIPANT_COMPENSATION_SOURCE,
} from "../../frontend/shared/workspace-participant-compensation";

const signingRoutesSource = readFileSync(
  new URL("./split-sheet-signing-routes.ts", import.meta.url),
  "utf8",
);
const splitSheetsRoutesSource = readFileSync(
  new URL("./split-sheets-routes.ts", import.meta.url),
  "utf8",
);
const indexSource = readFileSync(
  new URL("./index.ts", import.meta.url),
  "utf8",
);
const editingJobsSource = readFileSync(
  new URL("./editing-jobs-routes.ts", import.meta.url),
  "utf8",
);

function routeBody(source: string, registration: string): string {
  const start = source.indexOf(registration);
  if (start < 0) {
    throw new Error(`Missing route registration: ${registration}`);
  }
  const next = source.indexOf("\n  app.", start + registration.length);
  return source.slice(start, next < 0 ? source.length : next);
}

describe("managed participant compensation legacy boundary", () => {
  it("recognizes only the exact reserved metadata source", () => {
    expect(
      isWorkspaceParticipantCompensationMetadata({
        source: WORKSPACE_PARTICIPANT_COMPENSATION_SOURCE,
      }),
    ).toBe(true);
    expect(
      isWorkspaceParticipantCompensationMetadata({
        source: "workspace-participant-compensation-copy",
      }),
    ).toBe(false);
    expect(isWorkspaceParticipantCompensationMetadata(null)).toBe(false);
    expect(isWorkspaceParticipantCompensationMetadata([])).toBe(false);
  });

  it.each([
    'app.post("/api/split-sheets/:id/enable-signing"',
    'app.post("/api/split-sheets/:id/send-invites"',
    'app.get("/api/split-sheets/:id/signing-status"',
  ])("rejects managed sheets from owner signing route %s", (registration) => {
    const body = routeBody(signingRoutesSource, registration);
    expect(body).toContain("isWorkspaceParticipantCompensationMetadata");
    expect(body).toContain("managed_compensation_uses_participant_contract");
    expect(body).toContain("status(409)");
  });

  it.each([
    'app.get("/api/public/split-sheet/:code"',
    'app.post("/api/public/split-sheet/:code/sign"',
  ])("hides managed sheets from public signing route %s", (registration) => {
    const body = routeBody(signingRoutesSource, registration);
    expect(body).toContain("isWorkspaceParticipantCompensationMetadata");
    expect(body).toContain("status(404)");
  });

  it("excludes managed compensation from My agreements", () => {
    const body = routeBody(
      signingRoutesSource,
      'app.get("/api/my-split-sheets"',
    );
    expect(body).toContain("WORKSPACE_PARTICIPANT_COMPENSATION_SOURCE");
    expect(body).toContain("COALESCE(ss.metadata->>'source', '') <> $2");
  });

  it.each([
    'app.get("/api/split-sheets"',
    'app.get("/api/split-sheets/stats"',
    'app.get("/api/split-sheets/revenue-analytics"',
    'app.get("/api/split-sheets/payment-analytics"',
    'app.get("/api/split-sheets/market-insights"',
  ])("excludes managed sheets from legacy list or analytics route %s", (registration) => {
    const body = routeBody(splitSheetsRoutesSource, registration);
    expect(body).toContain("WORKSPACE_PARTICIPANT_COMPENSATION_SOURCE");
    expect(body).toContain("metadata->>'source'");
  });

  it.each([
    'app.get("/api/split-sheets/:id"',
    'app.post("/api/split-sheets"',
    'app.put("/api/split-sheets/:id"',
    'app.delete("/api/split-sheets/:id"',
    'app.post("/api/split-sheets/:id/sign"',
    'app.post("/api/split-sheets/:id/share"',
    'app.get("/api/split-sheets/:id/pdf"',
    'app.get("/api/split-sheets/:id/versions"',
    'app.post("/api/split-sheets/:id/duplicate"',
    'app.post("/api/split-sheets/:id/revenue"',
    'app.get("/api/split-sheets/:id/revenue"',
    'app.get("/api/split-sheets/:id/payments"',
    'app.put("/api/split-sheets/payments/:paymentId"',
  ])("rejects managed sheets from legacy mutation/detail route %s", (registration) => {
    const body = routeBody(splitSheetsRoutesSource, registration);
    expect(body).toContain("isWorkspaceParticipantCompensationMetadata");
    expect(body).toContain("managed_compensation_");
  });

  it("reserves the managed metadata namespace on generic create and update", () => {
    const createBody = routeBody(
      splitSheetsRoutesSource,
      'app.post("/api/split-sheets"',
    );
    const updateBody = routeBody(
      splitSheetsRoutesSource,
      'app.put("/api/split-sheets/:id"',
    );

    expect(createBody).toContain("managed_compensation_source_reserved");
    expect(updateBody).toContain("managed_compensation_source_reserved");
  });

  it("blocks EaseVerse and SongFlow link aliases from managed sheets", () => {
    const easeVerseSection = indexSource.slice(
      indexSource.indexOf("const listSplitSheetEaseVerseLinksHandler"),
      indexSource.indexOf("// EaseVerse platform endpoints (primary)"),
    );
    expect(easeVerseSection).toContain(
      "COALESCE(s.metadata->>'source', '') <> 'workspace-participant-compensation'",
    );
    expect(
      easeVerseSection.match(/isWorkspaceParticipantCompensationMetadata/g)
        ?.length,
    ).toBeGreaterThanOrEqual(2);
    expect(indexSource).toContain("setupSongflowDeprecatedAliasesRoutes({");
  });

  it("blocks editing jobs from attaching managed compensation sheets", () => {
    const createJob = routeBody(editingJobsSource, 'app.post("/api/editing/jobs"');
    expect(createJob).toContain("SELECT metadata");
    expect(createJob).toContain("isWorkspaceParticipantCompensationMetadata");
  });
});
