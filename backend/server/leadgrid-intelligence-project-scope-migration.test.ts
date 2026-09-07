import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "migrations/0547_leadgrid_intelligence_notification_project_scope.sql",
  ),
  "utf8",
);

describe("migration 0547 Leadgrid intelligence/notification project scope", () => {
  it("adds project scope to every relevant persistent dataflow", () => {
    expect(sql).toMatch(
      /ALTER TABLE lead_scores_history[\s\S]*ADD COLUMN IF NOT EXISTS project_id TEXT/,
    );
    expect(sql).toMatch(
      /ALTER TABLE lead_recommendations[\s\S]*ADD COLUMN IF NOT EXISTS project_id TEXT/,
    );
    expect(sql).toMatch(
      /ALTER TABLE notification_events[\s\S]*ADD COLUMN IF NOT EXISTS project_id TEXT/,
    );
    expect(sql).toMatch(
      /ALTER TABLE webhook_delivery_queue[\s\S]*ADD COLUMN IF NOT EXISTS organization_id UUID,[\s\S]*ADD COLUMN IF NOT EXISTS project_id TEXT/,
    );
  });

  it("backfills tenant scope from the mandatory webhook subscription", () => {
    expect(sql).toMatch(
      /UPDATE webhook_delivery_queue queue[\s\S]*FROM leadgrid_webhook_subscriptions subscription[\s\S]*subscription\.id = queue\.subscription_id/,
    );
    expect(sql).toMatch(
      /ALTER TABLE webhook_delivery_queue[\s\S]*ALTER COLUMN organization_id SET NOT NULL/,
    );
    expect(sql).toContain("webhook_delivery_queue_subscription_scope_fkey");
    expect(sql).toContain("FOREIGN KEY (organization_id, subscription_id)");
  });

  it("never guesses historical project scope in multi-project organizations", () => {
    const singletonGuards = sql.match(/HAVING COUNT\(\*\) = 1/g) ?? [];
    expect(singletonGuards.length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain("singleton.project_id = customer.project_id");
    expect(sql).toContain("NULLIF(BTRIM(event.meta ->> 'project_id'), '')");
    expect(sql).toContain("NULLIF(BTRIM(queue.payload ->> 'project_id'), '')");
    expect(sql).toMatch(
      /UPDATE lead_recommendations[\s\S]*SET status = 'expired'[\s\S]*WHERE project_id IS NULL[\s\S]*status IN \('pending', 'accepted'\)/,
    );
  });

  it("enforces exact organization/project/lead tuples for new writes", () => {
    for (const table of ["lead_scores_history", "lead_recommendations"]) {
      expect(sql).toContain(`${table}_project_required_check`);
      expect(sql).toMatch(
        new RegExp(`${table}[\\s\\S]*CHECK \\(project_id IS NOT NULL\\) NOT VALID`),
      );
      expect(sql).toContain(`${table}_project_scope_fkey`);
      expect(sql).toContain(`${table}_lead_scope_fkey`);
    }
    expect(sql).toContain("notification_events_project_scope_fkey");
    expect(sql).toContain("notification_events_lead_scope_fkey");
    expect(sql).toContain("webhook_delivery_queue_project_scope_fkey");
    expect(sql.match(/FOREIGN KEY \(organization_id, project_id, lead_id\)/g)).toHaveLength(3);
    expect(sql).toContain(
      "REFERENCES crm_customers (organization_id, project_id, id)",
    );
    expect(sql).toContain(
      "REFERENCES leadgrid_projects (organization_id, id)",
    );
  });

  it("creates indexes for scoped history, recommendations, throttle and retry", () => {
    expect(sql).toContain("idx_lead_scores_history_project_lead_time");
    expect(sql).toContain("idx_lead_recommendations_project_active");
    expect(sql).toContain("idx_lead_recommendations_project_dedupe");
    expect(sql).toContain("idx_notification_events_project_throttle");
    expect(sql).toContain("idx_webhook_delivery_queue_project_retry");
  });
});
