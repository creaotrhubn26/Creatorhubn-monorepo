import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../migrations/0469_workspace_participant_compensation_versions.sql",
    import.meta.url,
  ),
);
const servicePath = fileURLToPath(
  new URL("./workspace-participant-compensation-service.ts", import.meta.url),
);
const routePath = fileURLToPath(
  new URL("./workspace-participant-compensation-routes.ts", import.meta.url),
);

describe("workspace participant compensation database boundary", () => {
  const migration = readFileSync(migrationPath, "utf8");
  const service = readFileSync(servicePath, "utf8");
  const routes = readFileSync(routePath, "utf8");

  it("backfills only bounded explicit hourly estimates and otherwise fails closed", () => {
    expect(migration).toContain("terms_snapshot->>'estimatedHours'");
    expect(migration).toContain("^[0-9]{1,5}([.][0-9]{1,2})?$");
    expect(migration).toContain(
      "workspace_hourly_compensation_estimate_missing",
    );
    expect(migration).toContain(
      "compensation_type = 'hourly' AND hourly_rate > 0 AND estimated_hours > 0",
    );
  });

  it("enforces immutable compensation versions and explicit lifecycle transitions", () => {
    expect(migration).toContain("workspace_compensation_terms_locked");
    expect(migration).toContain("workspace_compensation_history_locked");
    expect(migration).toContain(
      "OLD.status = 'draft' AND NEW.status IN ('draft', 'active', 'archived')",
    );
    expect(migration).toContain(
      "OLD.status = 'active' AND NEW.status IN ('active', 'superseded', 'archived')",
    );
    expect(migration).toContain(
      "OLD.status IN ('superseded', 'archived') AND NEW.status = OLD.status",
    );
    expect(migration).toContain(
      "ux_workspace_participant_compensation_idempotency",
    );
    expect(migration).toContain(
      "ux_workspace_participant_compensation_version",
    );
  });

  it("validates every paid link as private, versioned, external, and server-scoped", () => {
    expect(migration).toContain("NEW.compensation_type <> 'unpaid'");
    expect(migration).toContain("contributor_user_id IS NOT NULL");
    expect(migration).toContain(
      "creatorhub_split_sheet_is_versioned(sheet_metadata)",
    );
    expect(migration).toContain("sheet_metadata->>'visibility'");
    expect(migration).toContain("sheet_metadata->>'workspaceProjectId'");
    expect(migration).toContain("sheet_metadata->>'workspaceParticipantId'");
    expect(migration).toContain("sheet_metadata->>'workspaceCompensationId'");
  });

  it("prevents the general engine from rewriting linked header or contributor terms", () => {
    expect(migration).toContain(
      "workspace_compensation_contributor_terms_locked",
    );
    expect(migration).toContain(
      "BEFORE INSERT OR UPDATE OR DELETE ON split_sheet_contributors",
    );
    expect(migration).toContain(
      "workspace_compensation_contributor_set_locked",
    );
    expect(migration).toContain("workspace_compensation_sheet_terms_locked");
    expect(migration).toContain("workspace_compensation_sheet_private");
    expect(migration).toContain(
      "workspace_compensation_sheet_transition_invalid",
    );
    expect(service).toContain(
      "signed_at IS NOT NULL OR signature_data IS NOT NULL",
    );
  });

  it("blocks legacy bearer access and validates the managed namespace at commit", () => {
    expect(migration).toContain(
      "workspace_compensation_legacy_signing_state_invalid",
    );
    expect(migration).toContain("workspace_compensation_access_forbidden");
    expect(migration).toContain(
      "BEFORE INSERT OR UPDATE OR DELETE ON split_sheet_contributor_access",
    );
    expect(migration).toContain("ux_workspace_participant_compensation_sheet");
    expect(migration).toContain("workspace_compensation_namespace_unlinked");
    expect(migration).toContain("DEFERRABLE INITIALLY DEFERRED");
  });

  it("fails closed when a terminal participant retains active legal workflow", () => {
    expect(migration).toContain(
      "workspace_participant_terminal_legal_state_invalid",
    );
    expect(migration).toContain(
      "workspace_participant_terminal_compensation_active",
    );
    expect(migration).toContain(
      "workspace_participant_terminal_document_token_active",
    );
    expect(migration).toContain(
      "creatorhub_validate_workspace_participant_terminal_state",
    );
  });

  it("contains no Role Room boundary crossings or credential/email egress", () => {
    const implementation = `${migration}\n${service}\n${routes}`;
    expect(implementation).not.toMatch(
      /role[_ -]?room|casting_candidates|talent_profiles/i,
    );
    expect(service).not.toContain("split_sheet_contributor_access");
    expect(service).not.toContain("sendTransactionalEmail");
    expect(service).not.toMatch(/access[_A-Z]?token/i);
    expect(routes).not.toContain("sendTransactionalEmail");
  });
});
