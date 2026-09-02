import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function migration(name: string): string {
  return readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");
}

describe("Leadgrid data-flow migrations", () => {
  it("declares the core workspace, collaboration and replay contracts", () => {
    const sql = migration("0490_leadgrid_core_dataflow.sql");
    for (const fragment of [
      "leadgrid_lead_notes",
      "leadgrid_lead_favorites",
      "market_scan_competitors",
      "meeting_duration_minutes",
      "meeting_status",
      "crm_customers_meeting_status_check",
      "outcome_applied_at",
    ]) expect(sql).toContain(fragment);
  });

  it("declares durable, tenant-bound lead files", () => {
    const sql = migration("0491_leadgrid_lead_files.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS leadgrid_lead_files");
    expect(sql).toContain("organization_id UUID NOT NULL");
    expect(sql).toContain("lead_id UUID NOT NULL REFERENCES crm_customers(id)");
  });

  it("moves every active lazy Leadgrid table into an explicit migration", () => {
    const sql = migration("0492_leadgrid_runtime_schema_backfill.sql");
    for (const table of [
      "leadgrid_doffin_watches",
      "leadgrid_anbud_pipeline",
      "leadgrid_canvas_notater",
      "leadgrid_canvas_versjoner",
      "leadgrid_canvas_dokumenter",
      "leadgrid_canvas_bibliotek",
      "leadgrid_mote_logg",
      "leadgrid_oppgaver",
      "leadgrid_mote_maal",
      "leadgrid_oversikt_policy",
      "leadgrid_canvas_policy",
      "leadgrid_rute_planer",
    ]) expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    for (const fragment of [
      "lead_id UUID REFERENCES crm_customers(id)",
      "meeting_at TIMESTAMPTZ",
      "uq_mote_logg_request",
    ]) expect(sql).toContain(fragment);
  });
});
