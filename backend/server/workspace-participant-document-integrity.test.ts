import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../migrations/0468_workspace_participant_document_lifecycle.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);
const service = readFileSync(
  fileURLToPath(
    new URL("./workspace-participant-documents-service.ts", import.meta.url),
  ),
  "utf8",
);

describe("0468 Workspace participant legal integrity", () => {
  it("allows an issued/viewed document to receive signed_at exactly once", () => {
    expect(migration).toContain("OLD.status IN ('issued', 'viewed')");
    expect(migration).toContain("OLD.signed_at IS NULL");
    expect(migration).toContain("workspace_signature_timestamp_locked");
  });

  it("makes media consent the only withdrawable document type", () => {
    expect(migration).toContain(
      "CHECK (status <> 'withdrawn' OR document_type = 'media_consent')",
    );
    expect(migration).toContain("OLD.document_type = 'media_consent'");
    expect(migration).toContain("workspace_document_not_withdrawable");
  });

  it("keeps signed evidence immutable while allowing pending stale-token revocation", () => {
    expect(migration).toContain(
      "NEW.signature_evidence IS DISTINCT FROM OLD.signature_evidence",
    );
    expect(migration).toContain(
      "NEW.token_used_at IS DISTINCT FROM OLD.token_used_at",
    );
    expect(migration).toContain("Only the bearer credential");
    const staleHelper =
      service.match(
        /export async function supersedeStalePendingWorkspaceParticipantContracts[\s\S]*?\n}\n\nfunction mapDocumentSummary/,
      )?.[0] ?? "";
    expect(staleHelper).toMatch(/SET\s+signing_token_hash\s*=\s*NULL/i);
    expect(staleHelper).toMatch(/AND\s+status\s*=\s*'pending'/i);
    expect(staleHelper).not.toMatch(/signature_evidence\s*=/i);
    expect(staleHelper).not.toMatch(/token_used_at\s*=/i);
  });

  it("contains no unrelated-domain dependency in the standalone source", () => {
    const combined = `${migration}\n${service}`;
    expect(combined).not.toMatch(
      /from\s+["'][^"']*(role-room|casting|talent)/i,
    );
  });
});
