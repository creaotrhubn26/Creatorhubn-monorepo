#!/usr/bin/env node
/**
 * backfill-crm-industry.cjs
 *
 * Backfill `crm_customers.industry_id` fra eksisterende fritekst-felt
 * (`lead_category`, `project_type`, `customer_type`). Idempotent — kan
 * kjøres flere ganger.
 *
 * Strategi:
 *   1. Eksakt match: LOWER(name_no) eller LOWER(name_en) lik fritekst.
 *   2. Fuzzy fallback via pg_trgm similarity (>= 0.55) hvis ingen
 *      eksakt match.
 *   3. Hvis ingen match — la industry_id være NULL (URL Research-
 *      pipelinen klassifiserer over tid).
 *
 * Bruk: `node backend/scripts/backfill-crm-industry.cjs [--dry-run]`
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

const DRY_RUN = process.argv.includes('--dry-run');
const FUZZY_THRESHOLD = 0.55;

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`Connected. DRY_RUN=${DRY_RUN}`);

  // Verifiser at industries-tabellen finnes
  const tableR = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'industries'
     ) AS exists`,
  );
  if (!tableR.rows[0].exists) {
    console.error('industries-tabellen finnes ikke — kjør mig 329 + seed først.');
    process.exit(1);
  }

  // Sjekk at crm_customers.industry_id finnes
  const colR = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'crm_customers' AND column_name = 'industry_id'
     ) AS exists`,
  );
  if (!colR.rows[0].exists) {
    console.error('crm_customers.industry_id mangler — kjør mig 329 først.');
    process.exit(1);
  }

  // Hent kandidat-rader
  const customers = await client.query(
    `SELECT id::text, lead_category, project_type, customer_type
       FROM crm_customers
      WHERE industry_id IS NULL
        AND archived_at IS NULL
        AND (
          COALESCE(NULLIF(TRIM(lead_category), ''), NULL) IS NOT NULL
          OR COALESCE(NULLIF(TRIM(project_type), ''), NULL) IS NOT NULL
          OR COALESCE(NULLIF(TRIM(customer_type), ''), NULL) IS NOT NULL
        )`,
  );

  console.log(`Fant ${customers.rows.length} kandidater å backfille.`);

  let matchedExact = 0;
  let matchedFuzzy = 0;
  let noMatch = 0;
  const sampleNoMatch = [];

  for (const row of customers.rows) {
    const candidates = [row.lead_category, row.project_type, row.customer_type]
      .filter((s) => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim());
    if (candidates.length === 0) continue;

    let industryId = null;
    let strategy = null;

    // 1. Eksakt match
    for (const text of candidates) {
      const r = await client.query(
        `SELECT id FROM industries
          WHERE is_active = TRUE
            AND (LOWER(name_no) = LOWER($1) OR LOWER(name_en) = LOWER($1))
          LIMIT 1`,
        [text],
      );
      if (r.rows[0]) {
        industryId = r.rows[0].id;
        strategy = `exact:${text}`;
        break;
      }
    }

    // 2. Fuzzy fallback
    if (!industryId) {
      for (const text of candidates) {
        const r = await client.query(
          `SELECT id, name_no, similarity(LOWER(name_no), LOWER($1)) AS sim
             FROM industries
            WHERE is_active = TRUE
              AND LOWER(name_no) % LOWER($1)
            ORDER BY sim DESC
            LIMIT 1`,
          [text],
        );
        if (r.rows[0] && r.rows[0].sim >= FUZZY_THRESHOLD) {
          industryId = r.rows[0].id;
          strategy = `fuzzy:${text} → ${r.rows[0].name_no} (${r.rows[0].sim.toFixed(2)})`;
          break;
        }
      }
    }

    if (industryId) {
      if (strategy.startsWith('exact')) matchedExact++;
      else matchedFuzzy++;
      if (!DRY_RUN) {
        await client.query(
          `UPDATE crm_customers SET industry_id = $2, updated_at = NOW() WHERE id = $1::uuid`,
          [row.id, industryId],
        );
      }
    } else {
      noMatch++;
      if (sampleNoMatch.length < 20) {
        sampleNoMatch.push(candidates.join(' | '));
      }
    }
  }

  console.log('\nResultat:');
  console.log(`  Total prosessert: ${customers.rows.length}`);
  console.log(`  Eksakt match:    ${matchedExact}`);
  console.log(`  Fuzzy match:     ${matchedFuzzy}`);
  console.log(`  Ingen match:     ${noMatch}`);
  if (sampleNoMatch.length > 0) {
    console.log('\nEksempler uten match:');
    for (const s of sampleNoMatch) console.log(`  - ${s}`);
  }
  if (DRY_RUN) {
    console.log('\n(DRY_RUN — ingen UPDATE-er ble utført.)');
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
