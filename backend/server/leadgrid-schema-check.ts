/**
 * leadgrid-schema-check.ts
 *
 * Verifiserer ved boot at de kritiske kolonnene fra mig 313–318 finnes
 * i prod-databasen. Hvis noe mangler, logger vi ADVARSEL og lar backend
 * starte (graceful degradation). Sett `LEADGRID_STRICT_SCHEMA=1` for å
 * gjøre dette til en FATAL boot-feil isteden — nyttig når vi vil rulle
 * tilbake automatisk hvis en migrasjon ikke er kjørt.
 *
 * Designet til å være billig: én SELECT mot information_schema med
 * (table, column)-tuples i én WHERE-klausul.
 */

import type { Pool } from "pg";

interface ExpectedColumn {
  table: string;
  column: string;
  required: boolean;
}

// Kritiske kolonner som må finnes for at Leadgrid skal fungere.
// Sjekkes ved boot — backend logger ADVARSEL hvis mangler, men starter
// likevel. Senere kan vi gjøre dette til FATAL ved å sette
// LEADGRID_STRICT_SCHEMA=1.
const EXPECTED: ExpectedColumn[] = [
  // mig 313 — Intelligence Engine
  { table: "crm_customers", column: "pipeline_stage", required: true },
  { table: "crm_customers", column: "lead_score", required: true },
  { table: "crm_customers", column: "lead_temperature", required: true },
  { table: "crm_customers", column: "next_best_action", required: true },
  { table: "crm_customers", column: "expected_value", required: true },
  { table: "crm_customers", column: "follow_up_priority", required: true },
  { table: "crm_customers", column: "conversion_probability", required: true },
  { table: "crm_customers", column: "scored_at", required: true },
  { table: "lead_scores_history", column: "id", required: true },
  { table: "lead_recommendations", column: "id", required: true },
  { table: "webhook_event_types", column: "event_key", required: true },
  { table: "leadgrid_webhook_subscriptions", column: "id", required: true },
  // mig 314 — Territory
  { table: "lead_territories", column: "id", required: true },
  { table: "lead_territory_events", column: "id", required: true },
  // mig 318 — Meeting Notes
  { table: "lead_meeting_notes", column: "id", required: true },
];

export interface SchemaCheckResult {
  ok: boolean;
  missing: string[];
  checked: number;
  durationMs: number;
}

export async function runSchemaCheck(pool: Pool): Promise<SchemaCheckResult> {
  const start = Date.now();
  const missing: string[] = [];

  // Hent alle kolonner i én query for effektivitet
  try {
    const params: string[] = EXPECTED.flatMap((e) => [e.table, e.column]);
    const tuples = EXPECTED.map(
      (_, i) => `($${2 * i + 1}, $${2 * i + 2})`,
    ).join(",");
    const r = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (table_name, column_name) IN (${tuples})`,
      params,
    );
    const found = new Set(
      r.rows.map((row) => `${row.table_name}.${row.column_name}`),
    );
    for (const e of EXPECTED) {
      const key = `${e.table}.${e.column}`;
      if (!found.has(key)) missing.push(key);
    }
  } catch (err) {
    console.error("[schema-check] query feilet:", err);
    return {
      ok: false,
      missing: ["query_failed"],
      checked: 0,
      durationMs: Date.now() - start,
    };
  }

  const result: SchemaCheckResult = {
    ok: missing.length === 0,
    missing,
    checked: EXPECTED.length,
    durationMs: Date.now() - start,
  };

  if (!result.ok) {
    const strict = process.env.LEADGRID_STRICT_SCHEMA === "1";
    const msg = `[schema-check] MISSING ${missing.length}/${EXPECTED.length} expected schema items: ${missing.join(", ")}`;
    if (strict) {
      console.error(msg);
      throw new Error(
        "LEADGRID_STRICT_SCHEMA=1 — boot avbrutt pga manglende schema-items",
      );
    } else {
      console.warn(msg);
    }
  } else {
    console.log(
      `[schema-check] OK — ${result.checked} items verifisert på ${result.durationMs}ms`,
    );
  }
  return result;
}
