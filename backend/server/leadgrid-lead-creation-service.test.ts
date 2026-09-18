import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  createLeadFromDraft,
  findLeadDuplicates,
  leadDraftInputSchema,
  LeadDraftNormalizationError,
  LeadDuplicateConflictError,
  LeadIdempotencyConflictError,
  normalizeLeadDraft,
  normalizeWebsite,
  type NormalizedLeadDraft,
} from "./leadgrid-lead-creation-service.js";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-lead-create";
const CREATION_ID = "22222222-2222-4222-8222-222222222222";
const LEAD_ID = "33333333-3333-4333-8333-333333333333";

function draft(overrides: Record<string, unknown> = {}): NormalizedLeadDraft {
  return normalizeLeadDraft(leadDraftInputSchema.parse({
    creation_id: CREATION_ID,
    organization_id: ORG_ID,
    name: "  Nordic   Elektro AS ",
    company: "Nordic Elektro AS",
    website_url: "WWW.NORDICELEKTRO.NO/kontakt#team",
    email: " SALG@NORDICELEKTRO.NO ",
    phone: "+47 912 34 567",
    city: "Oslo",
    latitude: 59.91,
    longitude: 10.75,
    location_confidence: "geocoded",
    lead_source: "manual_pin_drop",
    ...overrides,
  }));
}

function fakePool(
  handler: (sql: string, params: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>,
) {
  const query = vi.fn(async (sqlValue: unknown, paramsValue?: unknown[]) => {
    const sql = String(sqlValue);
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
    if (sql.includes("INSERT INTO background_jobs")) {
      return { rows: [{ id: "job-id" }], rowCount: 1 };
    }
    return handler(sql, paramsValue ?? []);
  });
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
  return { pool, query, release };
}

describe("Leadgrid canonical lead creation", () => {
  it("normaliserer domene, e-post, telefon, navn og gyldig org.nr", () => {
    const normalized = draft({ organization_number: "937 518 684" });

    expect(normalized.name).toBe("Nordic Elektro AS");
    expect(normalized.email).toBe("salg@nordicelektro.no");
    expect(normalized.phoneDigits).toBe("4791234567");
    expect(normalized.websiteUrl).toBe("https://nordicelektro.no/kontakt");
    expect(normalized.websiteDomain).toBe("nordicelektro.no");
    expect(normalized.organizationNumber).toBe("937518684");
    expect(draft({ project_id: "leadgrid-project-2026" }).projectId)
      .toBe("leadgrid-project-2026");
  });

  it("avviser ugyldig URL-protokoll og ugyldig norsk org.nr", () => {
    expect(() => normalizeWebsite("javascript:alert(1)"))
      .toThrow(LeadDraftNormalizationError);
    expect(() => draft({ organization_number: "123 456 789" }))
      .toThrow(LeadDraftNormalizationError);
    expect(() => draft({ name: "N".repeat(201) }))
      .toThrow();
    expect(() => draft({ email: `${"a".repeat(190)}@example.no` }))
      .toThrow();
    expect(() => draft({ phone: "1".repeat(51) }))
      .toThrow();
  });

  it("søker etter dubletter kun innenfor autoritativ organization_id", async () => {
    let captured: { sql: string; params: unknown[] } | null = null;
    const db = {
      query: vi.fn(async (sqlValue: unknown, paramsValue?: unknown[]) => {
        captured = { sql: String(sqlValue), params: paramsValue ?? [] };
        return {
          rows: [{
            id: LEAD_ID,
            name: "Nordic Elektro AS",
            company: "Nordic Elektro AS",
            email: "salg@nordicelektro.no",
            email_normalized: "salg@nordicelektro.no",
            phone: "91234567",
            phone_normalized: "91234567",
            website_url: "https://nordicelektro.no",
            website_domain_normalized: "nordicelektro.no",
            address: "Storgata 1",
            city: "Oslo",
            enrichment_org_nr: null,
            google_place_id: null,
            latitude: 59.91005,
            longitude: 10.75005,
          }],
          rowCount: 1,
        };
      }),
    } as unknown as Pick<PoolClient, "query">;

    const duplicates = await findLeadDuplicates(db, ORG_ID, draft());

    expect(captured).not.toBeNull();
    expect(captured!.sql).toContain("organization_id = $1::uuid");
    expect(captured!.sql).toContain("email_normalized");
    expect(captured!.sql).toContain("phone_normalized");
    expect(captured!.params[0]).toBe(ORG_ID);
    expect(captured!.params).not.toContain(USER_ID);
    expect(duplicates[0].matchReasons).toEqual([
      "website_domain", "email", "phone", "name_city", "coordinates",
    ]);
  });

  it("filters coordinate candidates that are outside 30 meters", async () => {
    const db = {
      query: vi.fn(async () => ({
        rows: [{
          id: LEAD_ID,
          name: "En annen bedrift",
          company: "En annen bedrift",
          email: "annen@example.no",
          email_normalized: "annen@example.no",
          phone: null,
          phone_normalized: null,
          website_url: "https://example.no",
          website_domain_normalized: "example.no",
          address: "Annen gate 2",
          city: "Bergen",
          enrichment_org_nr: null,
          google_place_id: null,
          // Inside the SQL bounding box, but approximately 32 meters away.
          latitude: 59.91029,
          longitude: 10.75,
        }],
        rowCount: 1,
      })),
    } as unknown as Pick<PoolClient, "query">;

    const duplicates = await findLeadDuplicates(db, ORG_ID, draft());

    expect(duplicates).toEqual([]);
  });

  it("persisterer hele draft-kontrakten og bruker innlogget bruker som eier", async () => {
    let insertParams: unknown[] | null = null;
    const { pool, query, release } = fakePool(async (sql, params) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("creation_idempotency_key") && sql.includes("SELECT")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM crm_customers") && sql.includes("website_domain_normalized")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO crm_customers")) {
        insertParams = params;
        return { rows: [{ id: LEAD_ID }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const richDraft = draft({
      contact_name: "Kari Nordmann",
      contact_role: "Daglig leder",
      organization_number: "937518684",
      industry: "Elektro",
      employee_count_estimate: 24,
      annual_revenue_nok_estimate: 12_500_000,
      estimated_value: 250_000,
      notes: "Ring fredag",
      next_action: "Telefon",
      next_follow_up_at: "2026-09-04T08:00:00+02:00",
    });

    const result = await createLeadFromDraft(pool, {
      organizationId: ORG_ID,
      userId: USER_ID,
      draft: richDraft,
    });

    expect(result).toEqual({
      id: LEAD_ID,
      created: true,
      replayed: false,
      duplicatesChecked: 0,
    });
    expect(insertParams).not.toBeNull();
    expect(insertParams![2]).toBe("Kari Nordmann");
    expect(insertParams![3]).toBe("Daglig leder");
    expect(insertParams![15]).toBe("937518684");
    expect(insertParams![19]).toBe(24);
    expect(insertParams![20]).toBe(12_500_000);
    expect(insertParams![29]).toBe(USER_ID);
    expect(insertParams![30]).toBe(ORG_ID);
    expect(insertParams![32]).toBe(CREATION_ID);
    expect(insertParams![33]).toMatch(/^[0-9a-f]{64}$/);
    const jobCalls = query.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO background_jobs")
    );
    expect(jobCalls).toHaveLength(2);
    expect(jobCalls.map(([, params]) => params?.[0])).toEqual([
      "lead_brreg_enrich",
      "leadgrid_workflow_event",
    ]);
    const sqlCalls = query.mock.calls.map(([sql]) => String(sql));
    const commitIndex = sqlCalls.findIndex((sql) => sql === "COMMIT");
    const lastJobIndex = Math.max(
      ...sqlCalls.map((sql, index) => sql.includes("INSERT INTO background_jobs") ? index : -1),
    );
    expect(commitIndex).toBeGreaterThan(lastJobIndex);
    expect(query.mock.calls.some(([sql]) => String(sql) === "COMMIT")).toBe(true);
    expect(release).toHaveBeenCalledOnce();
  });

  it("blokkerer mulig dublett, men tillater eksplisitt overstyring", async () => {
    let inserted = 0;
    const { pool } = fakePool(async (sql) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("creation_idempotency_key") && sql.includes("SELECT")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM crm_customers") && sql.includes("website_domain_normalized")) {
        return {
          rows: [{
            id: LEAD_ID,
            name: "Nordic Elektro AS",
            company: "Nordic Elektro AS",
            email: "salg@nordicelektro.no",
            email_normalized: "salg@nordicelektro.no",
            phone: "91234567",
            phone_normalized: "91234567",
            website_url: "https://nordicelektro.no",
            website_domain_normalized: "nordicelektro.no",
            address: null,
            city: "Oslo",
            enrichment_org_nr: null,
            google_place_id: null,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("INSERT INTO crm_customers")) {
        inserted += 1;
        return { rows: [{ id: "44444444-4444-4444-8444-444444444444" }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await expect(createLeadFromDraft(pool, {
      organizationId: ORG_ID,
      userId: USER_ID,
      draft: draft(),
    })).rejects.toBeInstanceOf(LeadDuplicateConflictError);
    expect(inserted).toBe(0);

    const result = await createLeadFromDraft(pool, {
      organizationId: ORG_ID,
      userId: USER_ID,
      draft: draft({ allow_duplicate: true }),
    });
    expect(result.created).toBe(true);
    expect(result.duplicatesChecked).toBe(1);
    expect(inserted).toBe(1);
  });

  it("replayer samme creation_id uten ny INSERT og avviser endret payload", async () => {
    let storedHash: string | null = null;
    let inserted = 0;
    const { pool } = fakePool(async (sql, params) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("creation_idempotency_key") && sql.includes("SELECT")) {
        return storedHash
          ? { rows: [{ id: LEAD_ID, creation_request_hash: storedHash }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM crm_customers") && sql.includes("website_domain_normalized")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO crm_customers")) {
        inserted += 1;
        storedHash = String(params[33]);
        return { rows: [{ id: LEAD_ID }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const first = await createLeadFromDraft(pool, {
      organizationId: ORG_ID,
      userId: USER_ID,
      draft: draft(),
    });
    const replay = await createLeadFromDraft(pool, {
      organizationId: ORG_ID,
      userId: USER_ID,
      draft: draft(),
    });
    expect(first.created).toBe(true);
    expect(replay).toMatchObject({ id: LEAD_ID, created: false, replayed: true });
    expect(inserted).toBe(1);

    await expect(createLeadFromDraft(pool, {
      organizationId: ORG_ID,
      userId: USER_ID,
      draft: draft({ name: "En annen bedrift" }),
    })).rejects.toBeInstanceOf(LeadIdempotencyConflictError);
    expect(inserted).toBe(1);
  });

  it("bruker original klientpayload for replay selv om BRREG-berikelse varierer", async () => {
    let storedHash: string | null = null;
    let inserted = 0;
    const { pool } = fakePool(async (sql, params) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("creation_idempotency_key") && sql.includes("SELECT")) {
        return storedHash
          ? { rows: [{ id: LEAD_ID, creation_request_hash: storedHash }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM crm_customers") && sql.includes("website_domain_normalized")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO crm_customers")) {
        inserted += 1;
        storedHash = String(params[33]);
        return { rows: [{ id: LEAD_ID }], rowCount: 1 };
      }
      throw new Error("Unexpected SQL: " + sql);
    });
    const original = draft({ website_url: null, email: null, phone: null, city: null });
    const enriched = { ...original, organizationNumber: "937518684" };

    const first = await createLeadFromDraft(pool, {
      organizationId: ORG_ID,
      userId: USER_ID,
      draft: enriched,
      idempotencyDraft: original,
    });
    const replay = await createLeadFromDraft(pool, {
      organizationId: ORG_ID,
      userId: USER_ID,
      draft: original,
      idempotencyDraft: original,
    });

    expect(first.created).toBe(true);
    expect(replay).toMatchObject({ id: LEAD_ID, created: false, replayed: true });
    expect(inserted).toBe(1);
  });

  it("ruller tilbake leaden når durable etterbehandling ikke kan køes", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
      if (sql.includes("creation_idempotency_key") && sql.includes("SELECT")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM crm_customers") && sql.includes("website_domain_normalized")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO crm_customers")) {
        return { rows: [{ id: LEAD_ID }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO background_jobs")) {
        throw new Error("background_jobs unavailable");
      }
      throw new Error("Unexpected SQL: " + sql);
    });
    const client = { query, release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;

    await expect(createLeadFromDraft(pool, {
      organizationId: ORG_ID,
      userId: USER_ID,
      draft: draft(),
    })).rejects.toThrow("background_jobs unavailable");

    expect(query.mock.calls.some(([sql]) => String(sql) === "ROLLBACK")).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql) === "COMMIT")).toBe(false);
  });

});
