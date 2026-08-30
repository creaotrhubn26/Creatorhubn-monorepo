import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync(
  fileURLToPath(new URL("./index.ts", import.meta.url)),
  "utf8",
);

describe("workspace participant route registration", () => {
  it.each([
    "setupWorkspaceProjectParticipantsRoutes",
    "setupWorkspaceParticipantDocumentRoutes",
    "setupWorkspaceParticipantCompensationRoutes",
    "setupWorkspaceParticipantClearanceRoutes",
  ])("mounts %s in the backend composition root", (setupName) => {
    expect(
      indexSource.match(new RegExp(`\\b${setupName}\\b`, "g"))?.length,
    ).toBeGreaterThanOrEqual(2);
    expect(indexSource).toContain(`${setupName}({`);
  });
});
