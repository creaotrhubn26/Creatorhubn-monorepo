import { readFileSync } from "fs";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  leadgridOutcomeEventInputSchema,
  OutcomeEventWriteError,
  outcomeEventRequestHash,
  recordLeadgridOutcomeEvent,
} from "./leadgrid-outcome-events.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const apiKeyId = "22222222-2222-4222-8222-222222222222";
const leadId = "33333333-3333-4333-8333-333333333333";
const candidateId = "55555555-5555-4555-8555-555555555555";
const runId = "66666666-6666-4666-8666-666666666666";
const profileId = "77777777-7777-4777-8777-777777777777";
const attributedAt = "2026-09-01T07:00:00.000Z";
const projectId = "dentum-oslo";
const event = leadgridOutcomeEventInputSchema.parse({
  event_type: "profile_published",
  external_event_id: "dentum.profile.42.published",
  occurred_at: "2026-09-05T08:30:00.000Z",
  metadata: {
    channel: "clinic_profile",
    campaign_ref: "pilot-oslo-2026",
    quantity: 1,
  },
});

function row(requestHash: string) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    organization_id: organizationId,
    project_id: projectId,
    lead_id: leadId,
    event_type: event.event_type,
    external_event_id: event.external_event_id,
    occurred_at: event.occurred_at,
    metadata: event.metadata,
    discovery_candidate_id: candidateId,
    discovery_run_id: runId,
    discovery_profile_id: profileId,
    discovery_attributed_at: attributedAt,
    schema_version: 1 as const,
    created_at: "2026-09-05T08:31:00.000Z",
    request_hash: requestHash,
  };
}

function input() {
  return {
    organizationId,
    projectId,
    leadId,
    apiKeyId,
    idempotencyKey: "dentum.profile.42.published",
    event,
  };
}

describe("Leadgrid project outcome events", () => {
  it("rejects arbitrary/free-text and patient-shaped metadata", () => {
    expect(
      leadgridOutcomeEventInputSchema.safeParse({
        ...event,
        metadata: { patient_email: "person@example.no" },
      }).success,
    ).toBe(false);
    expect(
      leadgridOutcomeEventInputSchema.safeParse({
        ...event,
        metadata: { notes: "Sensitive treatment details" },
      }).success,
    ).toBe(false);
  });

  it("requires value and ISO currency together", () => {
    expect(
      leadgridOutcomeEventInputSchema.safeParse({
        ...event,
        metadata: { value_minor: 125_000 },
      }).success,
    ).toBe(false);
    expect(
      leadgridOutcomeEventInputSchema.safeParse({
        ...event,
        metadata: { currency: "NOK" },
      }).success,
    ).toBe(false);
    expect(
      leadgridOutcomeEventInputSchema.safeParse({
        ...event,
        metadata: { value_minor: 125_000, currency: "NOK" },
      }).success,
    ).toBe(true);
  });

  it("inserts only after joining the active org, project and lead scope", async () => {
    const hash = outcomeEventRequestHash(input());
    const query = vi.fn().mockResolvedValueOnce({ rows: [row(hash)] });

    const result = await recordLeadgridOutcomeEvent(
      { query } as unknown as Pick<Pool, "query">,
      input(),
    );

    expect(result).toMatchObject({
      replayed: false,
      event: { lead_id: leadId },
    });
    expect(query).toHaveBeenCalledOnce();
    const [insertSql, insertParams] = query.mock.calls[0];
    expect(insertSql).toContain("INSERT INTO leadgrid_project_outcome_events");
    expect(insertSql).toContain("SELECT p.organization_id, p.id, c.id");
    expect(insertSql).toContain("c.organization_id = p.organization_id");
    expect(insertSql).toContain("p.organization_id = $1::uuid");
    expect(insertSql).toContain("p.id = $2");
    expect(insertSql).toContain("c.id = $3::uuid");
    expect(insertSql).toContain("c.archived_at IS NULL");
    expect(insertSql).toContain(
      "p.project_type IS NULL OR p.project_type NOT IN",
    );
    expect(insertSql).toContain("LEFT JOIN LATERAL");
    expect(insertSql).toContain("attribution.candidate_id");
    expect(insertSql).toContain("feedback.organization_id = p.organization_id");
    expect(insertSql).toContain("feedback.project_id = p.id");
    expect(insertSql).toContain("candidate.imported_lead_id = c.id");
    expect(insertSql).toContain("occurrence.disposition = 'imported'");
    expect(insertSql).toContain("feedback.event_type = 'decision'");
    expect(insertSql).toContain("feedback.value = 'approve'");
    expect(insertSql).toContain("feedback.occurred_at <= $9::timestamptz");
    expect(insertSql).toContain("feedback.occurred_at ASC");
    expect(insertSql).toContain("feedback.created_at ASC");
    expect(insertSql).toContain("feedback.id ASC");
    expect(insertParams.slice(0, 3)).toEqual([
      organizationId,
      projectId,
      leadId,
    ]);
    expect(insertParams).toHaveLength(10);
    expect(insertParams[8]).toBe(event.occurred_at);
    expect(result.event).toMatchObject({
      discovery_candidate_id: candidateId,
      discovery_run_id: runId,
      discovery_profile_id: profileId,
      discovery_attributed_at: attributedAt,
    });
  });

  it("keeps non-Discovery outcomes valid with nullable server attribution", async () => {
    const hash = outcomeEventRequestHash(input());
    const unattributedRow = {
      ...row(hash),
      discovery_candidate_id: null,
      discovery_run_id: null,
      discovery_profile_id: null,
      discovery_attributed_at: null,
    };
    const query = vi.fn().mockResolvedValueOnce({ rows: [unattributedRow] });

    const result = await recordLeadgridOutcomeEvent(
      { query } as unknown as Pick<Pool, "query">,
      input(),
    );

    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0]).toContain("attribution.profile_id");
    expect(result.event.discovery_profile_id).toBeNull();
  });

  it("replays an identical retry without adding a second row", async () => {
    const hash = outcomeEventRequestHash(input());
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [row(hash)] });

    const result = await recordLeadgridOutcomeEvent(
      { query } as unknown as Pick<Pool, "query">,
      input(),
    );

    expect(result.replayed).toBe(true);
    expect(query.mock.calls[0][0]).toContain("ON CONFLICT DO NOTHING");
    expect(query.mock.calls[1][0]).toContain("idempotency_key = $3");
    expect(query.mock.calls[1][0]).toContain("external_event_id = $4");
  });

  it("returns a conflict when a retry identifier is reused for another payload", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [row("a".repeat(64))] });

    await expect(
      recordLeadgridOutcomeEvent(
        { query } as unknown as Pick<Pool, "query">,
        input(),
      ),
    ).rejects.toEqual(new OutcomeEventWriteError("idempotency_conflict", 409));
  });

  it("fails closed before insertion when project A and lead B do not share scope", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      recordLeadgridOutcomeEvent(
        { query } as unknown as Pick<Pool, "query">,
        input(),
      ),
    ).rejects.toMatchObject({
      code: "project_or_lead_not_found",
      status: 404,
    });
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0][0]).toContain(
      "INSERT INTO leadgrid_project_outcome_events",
    );
    expect(query.mock.calls[0][0]).toContain("p.organization_id = $1::uuid");
    expect(query.mock.calls[2][0]).toContain(
      "c.organization_id = p.organization_id",
    );
  });

  it("does not let client metadata control Discovery attribution", () => {
    const parsed = leadgridOutcomeEventInputSchema.safeParse({
      ...event,
      discovery_profile_id: profileId,
    });
    expect(parsed.success).toBe(false);
  });

  it("migration enforces event enums, project ownership and retry uniqueness", () => {
    const migration = readFileSync(
      new URL(
        "../migrations/0523_leadgrid_project_outcome_events.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(migration).toContain("FOREIGN KEY (organization_id, project_id)");
    expect(migration).toContain("UNIQUE (organization_id, project_id, id)");
    expect(migration).toContain(
      "FOREIGN KEY (organization_id, project_id, lead_id)",
    );
    expect(migration).toContain(
      "REFERENCES crm_customers(organization_id, project_id, id)",
    );
    expect(migration).toContain(
      "UNIQUE (organization_id, project_id, external_event_id)",
    );
    expect(migration).toContain(
      "UNIQUE (organization_id, project_id, idempotency_key)",
    );
    expect(migration).toContain("'attendance_confirmed'");
    expect(migration).toContain("metadata - ARRAY[");
    expect(migration).toContain(
      "(metadata ? 'value_minor') = (metadata ? 'currency')",
    );
  });
});
