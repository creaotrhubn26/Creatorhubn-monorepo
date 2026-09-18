/**
 * create_task skrev en rad ingen leste.
 *
 * Handlingen la en rad i crm_lead_activities med activity_type='task' og
 * fristen begravet i metadata-JSONB. Ingen kode i repoet leste den raden.
 * En bruker kunne slå på en mal som «lager oppgaver» og aldri se én.
 *
 * Testene her holder på at oppgaven havner i lista brukeren faktisk ser,
 * og at mig 0651 gir tabellen det den manglet for å være en oppgaveliste:
 * en ekte frist, en ansvarlig, og en kobling til salget.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(__dirname, "../migrations/0651_leadgrid_oppgaver_paa_lead.sql"),
  "utf8",
);
const engine = readFileSync(
  join(__dirname, "leadgrid-workflow-engine.ts"),
  "utf8",
);
const routes = readFileSync(
  join(__dirname, "leadgrid-motebrief-routes.ts"),
  "utf8",
);

describe("migrasjon 0651", () => {
  it("utvider tabellen som finnes i stedet for å lage en ny", () => {
    expect(migration).toContain("ALTER TABLE leadgrid_oppgaver");
    expect(migration).not.toContain("CREATE TABLE");
  });

  it("gir oppgaven en ekte frist ved siden av fritekst-fristen", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ");
    // frist beholdes — det er det brukeren faktisk skrev.
    expect(migration).not.toMatch(/DROP COLUMN[^\n]*frist/);
  });

  it("skiller den som opprettet fra den som skal gjøre oppgaven", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS assigned_user_id");
    expect(migration).toContain("SET assigned_user_id = o.user_id");
  });

  it("knytter oppgaven til salget, ikke bare til bedriften", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS deal_id UUID");
    expect(migration).toContain("REFERENCES leadgrid_deals(id)");
  });

  it("gjetter ikke på frister den ikke kan lese", () => {
    // Bare rene ISO-datoer reddes; «innen fredag» forblir NULL.
    expect(migration).toContain("frist ~ '^\\d{4}-\\d{2}-\\d{2}$'");
  });
});

describe("create_task", () => {
  it("skriver til oppgavelista, ikke til aktivitetsloggen", () => {
    expect(engine).toContain("INSERT INTO leadgrid_oppgaver");
    expect(engine).not.toContain("'task', $3, $4::jsonb");
  });

  it("sier fra når «manager» ikke finnes i stedet for å tie", () => {
    expect(engine).toContain("no_manager_fell_back_to_owner");
  });

  it("melder feil som feil, ikke som «skipped»", () => {
    expect(engine).toContain("task_failed:");
  });
});

describe("oppgave-endepunktene", () => {
  it("sorterer på frist, ikke på når oppgaven ble skrevet", () => {
    expect(routes).toContain("ORDER BY due_at ASC NULLS LAST");
  });

  it("kan hente oppgavene til én kunde og til ett salg", () => {
    expect(routes).toContain("filters.push(`lead_id = $${params.length}`)");
    expect(routes).toContain("filters.push(`deal_id = $${params.length}::uuid`)");
  });

  it("lar den oppgaven er tildelt huke den av", () => {
    expect(routes).toContain("(assigned_user_id = $3 OR user_id = $3)");
  });
});

describe("backfill av ansvarlig", () => {
  it("kopierer bare brukere som finnes", () => {
    // leadgrid_oppgaver.user_id er TEXT uten fremmednøkkel; assigned_user_id
    // har en. Samme feil som veltet 0650 i produksjon.
    expect(migration).toContain("EXISTS (SELECT 1 FROM users u WHERE u.id = o.user_id)");
  });
});

