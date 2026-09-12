/**
 * geo-backfill-discovered-brands.ts
 *
 * Backfill av merkevare-discovery for eksisterende probe-resultater:
 * kjører LLM-ekstraksjon over answer_excerpt (500 tegn — delvis dekning,
 * merkes i metadata via kolonnen alene) for rader med tom
 * discovered_brands.
 *
 *   DATABASE_URL=… ANTHROPIC_API_KEY=… npx tsx scripts/geo-backfill-discovered-brands.ts
 */

import pg from "pg";
import { extractDiscoveredBrands } from "../server/market-intelligence/geo-brand-extraction.js";

async function main() {
  if (!process.env.DATABASE_URL || !process.env.ANTHROPIC_API_KEY) {
    throw new Error("DATABASE_URL og ANTHROPIC_API_KEY kreves");
  }
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  try {
    const rows = await pool.query<{
      id: string;
      answer_excerpt: string | null;
      target_brand: string;
      competitor_brands: string[];
      set_name: string;
    }>(`
      SELECT pr.id::text, pr.answer_excerpt, ps.target_brand,
             ps.competitor_brands, ps.name AS set_name
        FROM geo_probe_results pr
        JOIN geo_probe_runs r ON r.id = pr.run_id
        JOIN geo_prompt_sets ps ON ps.id = r.prompt_set_id
       WHERE pr.discovered_brands = '[]'::jsonb
         AND pr.answer_excerpt IS NOT NULL
       ORDER BY ps.name`);
    console.log(`${rows.rows.length} resultater å backfille`);

    let processed = 0;
    const perSet = new Map<string, Map<string, number>>();
    for (const row of rows.rows) {
      const known = [row.target_brand, ...(row.competitor_brands ?? [])];
      const discovered = await extractDiscoveredBrands(row.answer_excerpt ?? "", known);
      await pool.query(
        `UPDATE geo_probe_results SET discovered_brands = $2::jsonb WHERE id = $1::uuid`,
        [row.id, JSON.stringify(discovered)],
      );
      processed++;
      const setMap = perSet.get(row.set_name) ?? new Map<string, number>();
      for (const b of discovered) setMap.set(b, (setMap.get(b) ?? 0) + 1);
      perSet.set(row.set_name, setMap);
      if (processed % 20 === 0) console.log(`  … ${processed}/${rows.rows.length}`);
    }

    console.log("\n═══ HVEM EIER DE ÅPNE TEMAENE ═══");
    for (const [setName, brands] of perSet) {
      const top = [...brands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      console.log(`\n${setName}:`);
      for (const [brand, n] of top) console.log(`   ${brand}: ${n}`);
      if (top.length === 0) console.log("   (ingen ukjente merker funnet)");
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Backfill feilet:", err.message ?? err);
  process.exit(1);
});
