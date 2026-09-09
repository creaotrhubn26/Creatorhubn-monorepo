import { readFileSync } from "node:fs";

import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  cleanupExpiredDiscoveryPlaceConfirmations,
  registerLeadgridRetentionCron,
  suppressDueTalentProspects,
} from "./leadgrid-retention-cron.js";

interface ConfirmationFixture {
  id: string;
  expiresAt: string;
  consumedAt: string | null;
}

const migration = readFileSync(
  new URL(
    "../migrations/0556_leadgrid_discovery_place_confirmation_retention.sql",
    import.meta.url,
  ),
  "utf8",
);
const talentPrivacyMigration = readFileSync(
  new URL(
    "../migrations/0566_leadgrid_discovery_profile_templates_and_talent_privacy.sql",
    import.meta.url,
  ),
  "utf8",
);

const backendReadme = readFileSync(
  new URL("../README.md", import.meta.url),
  "utf8",
);
const privacyPage = readFileSync(
  new URL(
    "../../frontend/client/src/pages/leadgrid-personvern.tsx",
    import.meta.url,
  ),
  "utf8",
);
const retentionWorkflow = readFileSync(
  new URL(
    "../../.github/workflows/leadgrid-retention-cleanup.yml",
    import.meta.url,
  ),
  "utf8",
);

describe("Leadgrid Discovery Place confirmation retention", () => {
  it("deletes consumed and unconsumed expired rows while preserving live rows", async () => {
    const cutoff = new Date("2026-09-06T10:00:00.000Z");
    const fixtures: ConfirmationFixture[] = [
      {
        id: "expired-unconsumed",
        expiresAt: "2026-09-06T09:00:00.000Z",
        consumedAt: null,
      },
      {
        id: "expired-consumed",
        expiresAt: "2026-09-06T09:30:00.000Z",
        consumedAt: "2026-09-06T09:20:00.000Z",
      },
      {
        id: "live-unconsumed",
        expiresAt: "2026-09-06T10:00:00.001Z",
        consumedAt: null,
      },
      {
        id: "live-consumed",
        expiresAt: "2026-09-07T10:00:00.000Z",
        consumedAt: "2026-09-06T09:40:00.000Z",
      },
    ];

    const query = vi.fn(async (sql: string, values?: unknown[]) => {
      const [batchSize, cutoffIso] = values as [number, string];
      expect(sql).toContain("WHERE expires_at <= $2::timestamptz");
      expect(sql).toContain("LIMIT $1");
      expect(sql).toContain("FOR UPDATE SKIP LOCKED");
      expect(sql).not.toContain("consumed_at IS NULL");
      for (const key of [
        "organization_id",
        "project_id",
        "run_id",
        "candidate_id",
        "place_id",
        "requested_by",
      ]) {
        expect(sql).toContain(`target.${key} = expired.${key}`);
      }

      const expired = fixtures
        .filter((row) => row.expiresAt <= cutoffIso)
        .slice(0, batchSize);
      const expiredIds = new Set(expired.map((row) => row.id));
      for (let index = fixtures.length - 1; index >= 0; index -= 1) {
        if (expiredIds.has(fixtures[index].id)) fixtures.splice(index, 1);
      }

      return { rowCount: expired.length };
    });

    const result = await cleanupExpiredDiscoveryPlaceConfirmations(
      { query } as unknown as Pick<Pool, "query">,
      { batchSize: 10, maxBatches: 2, now: cutoff },
    );

    expect(result).toEqual({ deleted: 2, batches: 1, limitReached: false });
    expect(fixtures.map((row) => row.id)).toEqual([
      "live-unconsumed",
      "live-consumed",
    ]);
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      10,
      cutoff.toISOString(),
    ]);
  });

  it("stops at the configured sweep boundary instead of creating an unbounded chain", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rows: [{ has_remaining: true }] });

    const result = await cleanupExpiredDiscoveryPlaceConfirmations(
      { query } as unknown as Pick<Pool, "query">,
      {
        batchSize: 2,
        maxBatches: 3,
        now: new Date("2026-09-06T10:00:00.000Z"),
      },
    );

    expect(query).toHaveBeenCalledTimes(4);
    expect(result).toEqual({ deleted: 6, batches: 3, limitReached: true });
  });

  it("returns a visible 503 when the bounded daily sweep leaves a backlog", async () => {
    const routes = new Map<string, RequestHandler[]>();
    const app = {
      post: (path: string, ...handlers: RequestHandler[]) => {
        routes.set(path, handlers);
      },
    } as unknown as Express;
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT EXISTS")) {
        return { rows: [{ has_remaining: true }] };
      }
      if (sql.includes("WITH expired AS MATERIALIZED")) {
        return { rowCount: 500 };
      }
      return { rowCount: 0 };
    });
    registerLeadgridRetentionCron({
      app,
      pool: { query } as unknown as Pool,
    });

    const handler = routes.get("/api/leadgrid/cron/retention-cleanup")?.at(-1);
    if (!handler) throw new Error("retention route missing");

    const previousToken = process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN;
    process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN = "retention-test-token";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let status = 200;
    let responseBody: unknown;
    const response = {
      status(value: number) {
        status = value;
        return this;
      },
      json(value: unknown) {
        responseBody = value;
        return this;
      },
    } as unknown as Response;

    try {
      await handler(
        {
          headers: {
            "x-cron-trigger-token": "retention-test-token",
          },
        } as unknown as Request,
        response,
        vi.fn(),
      );
    } finally {
      warn.mockRestore();
      if (previousToken === undefined) {
        delete process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN;
      } else {
        process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN = previousToken;
      }
    }

    const deleteBatches = query.mock.calls.filter(([sql]) =>
      sql.includes("WITH expired AS MATERIALIZED"),
    );
    expect(deleteBatches).toHaveLength(20);
    expect(status).toBe(503);
    expect(responseBody).toMatchObject({
      ok: false,
      error: "place_confirmation_retention_backlog",
      stats: {
        place_confirmations_deleted: 10_000,
        place_confirmation_batches: 20,
        place_confirmation_limit_reached: true,
      },
    });
  });

  it("ships a full expiry index for both consumed and unconsumed rows", () => {
    expect(migration).toContain("BEGIN;");
    expect(migration).toContain("SET LOCAL lock_timeout = '5s'");
    expect(migration).toContain(
      "idx_leadgrid_discovery_place_confirmations_retention",
    );
    expect(migration).toMatch(
      /ON leadgrid_discovery_place_confirmations \(\s*expires_at,\s*organization_id,\s*project_id,\s*run_id,\s*candidate_id,\s*place_id,\s*requested_by\s*\)/,
    );
    expect(migration).not.toMatch(/WHERE\s+consumed_at\s+IS\s+NULL/i);
    expect(migration).toContain("COMMIT;");
  });

  it("keeps operational and privacy wording aligned with physical retention", () => {
    for (const document of [backendReadme, privacyPage]) {
      expect(document).toMatch(
        /at\s+most\s+the\s+three\s+returned|opptil tre returnerte/i,
      );
      expect(document).toMatch(/15 minut/i);
      expect(document).toMatch(
        /later successful runs|senere vellykket kjøring/i,
      );
      expect(document).toMatch(/bounded|avgrensede puljer/i);
    }
    expect(backendReadme).toContain("both consumed and unconsumed expired");
    expect(backendReadme).toContain("10,000 total");
    expect(backendReadme).toContain("place_confirmation_retention_backlog");
    expect(backendReadme).toContain("HTTP 503");
    expect(retentionWorkflow).toContain("curl -sf");
    expect(retentionWorkflow).toContain("if: failure()");
    expect(retentionWorkflow).toContain("SLACK_WEBHOOK_URL");
    expect(privacyPage).not.toContain(
      "Vi lagrer ikke Places-innholdet; bare valgt Place ID lagres",
    );
  });
});

describe("Leadgrid public-data talent prospect retention", () => {
  it("suppresses due talent prospects in tenant-scoped bounded batches", async () => {
    const cutoff = new Date("2026-12-08T10:00:00.000Z");
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 0 });

    const result = await suppressDueTalentProspects(
      { query } as unknown as Pick<Pool, "query">,
      { batchSize: 2, maxBatches: 5, now: cutoff },
    );

    expect(result).toEqual({ suppressed: 2, batches: 2, limitReached: false });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("contact.subject_kind = 'talent'");
    expect(sql).toContain("contact.privacy_review_due_at <= $2::timestamptz");
    expect(sql).toContain("contact.consent_status <> 'received'");
    expect(sql).toContain("FOR UPDATE OF contact SKIP LOCKED");
    expect(sql).toContain("customer.organization_id = due.organization_id");
    expect(sql).toContain("customer.project_id = due.project_id");
    expect(sql).toContain("'status', 'expired'");
    expect(query.mock.calls[0][1]).toEqual([2, cutoff.toISOString()]);
  });

  it("ships template identity, query mirrors and privacy lifecycle constraints", () => {
    expect(talentPrivacyMigration).toContain("template_key VARCHAR(120)");
    expect(talentPrivacyMigration).toContain(
      "ux_leadgrid_discovery_profiles_template",
    );
    expect(talentPrivacyMigration).toContain(
      "organization_name_queries TEXT[] NOT NULL",
    );
    expect(talentPrivacyMigration).toContain("subject_kind VARCHAR(16)");
    expect(talentPrivacyMigration).toContain("qualification_terms TEXT[]");
    expect(talentPrivacyMigration).toContain("privacy_review_due_at TIMESTAMPTZ");
    expect(talentPrivacyMigration).toContain(
      "leadgrid_sync_talent_contact_opt_out",
    );
    expect(talentPrivacyMigration).toContain("THEN 'expired'");
    expect(talentPrivacyMigration).toContain("COMMIT;");
    expect(backendReadme).toContain("never creates or activates a");
    expect(backendReadme).toContain("within 90 days");
    expect(privacyPage).toContain("Godkjenningen oppretter ikke en talentkonto");
    expect(privacyPage).toContain("innen 90 dager");
  });
});
