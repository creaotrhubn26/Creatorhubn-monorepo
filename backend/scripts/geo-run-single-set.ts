/**
 * geo-run-single-set.ts — kjør probe for navngitte prompt-sett lokalt
 * (ops-verktøy; brukt når server-restart dreper fire-and-forget-kjøringer).
 *   DATABASE_URL=… ANTHROPIC_API_KEY=… npx tsx scripts/geo-run-single-set.ts "Navn 1" "Navn 2"
 */
import pg from "pg";
import { runProbe } from "../server/market-intelligence/geo-probe-runner-service.js";

async function main() {
  const names = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (names.length === 0) throw new Error("oppgi sett-navn som argumenter");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
  try {
    const sets = await pool.query<{ id: string; name: string; workspace_owner_user_id: string }>(
      "SELECT id::text, name, workspace_owner_user_id FROM geo_prompt_sets WHERE name = ANY($1)",
      [names],
    );
    for (const s of sets.rows) {
      console.log("▶", s.name);
      const r = await runProbe(pool, s.id, s.workspace_owner_user_id);
      console.log("  ", r.status, "|", r.answers, "svar |", r.signalsInserted, "signaler",
        r.enginesSkipped.length ? "| hoppet over: " + r.enginesSkipped.join(",") : "");
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error("FEIL:", e.message ?? e); process.exit(1); });
