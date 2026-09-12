/**
 * geo-setup-prompt-sets.ts
 *
 * Engangs-oppsett (idempotent) av de seks GEO-prompt-settene fra
 * tiltaksplanen (docs/integration-audit/09) — kjøres mot prod-DB med
 * samme servicekode som panelet bruker (generatePromptSet).
 *
 *   DATABASE_URL=… ANTHROPIC_API_KEY=… GEO_OWNER_EMAIL=daniel@creatorhubn.com \
 *     npx tsx scripts/geo-setup-prompt-sets.ts [--approve] [--count 30]
 *
 * Idempotens: hopper over sett hvis et sett med samme navn allerede
 * finnes for eieren. --approve setter status='approved' (ellers draft,
 * for gjennomgang i panelet).
 */

import pg from "pg";
import {
  approvePromptSet,
  generatePromptSet,
} from "../server/market-intelligence/geo-prompt-set-service.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const APPROVE = process.argv.includes("--approve");
const COUNT = Number(arg("count", "30"));
const OWNER_EMAIL = process.env.GEO_OWNER_EMAIL || "daniel@creatorhubn.com";

const SETS = [
  {
    name: "Leadgrid — små bedrifter (feltsalg/leads)",
    industry: "leadgenerering, feltsalg og kundeoppfølging for småbedrifter og håndverkere",
    targetBrand: "Leadgrid",
    targetDomain: "leadgrid.no",
    competitorBrands: ["HubSpot", "Pipedrive", "SuperOffice", "Salesforce"],
  },
  {
    name: "Leadgrid — salgsteam og større organisasjoner",
    industry: "feltsalg for salgsorganisasjoner: territorie-styring, ruteplanlegging, salgsledelse, prognoser og CRM for utegående salgsteam",
    targetBrand: "Leadgrid",
    targetDomain: "leadgrid.no",
    competitorBrands: ["SuperOffice", "HubSpot", "Pipedrive", "Salesforce"],
  },
  {
    name: "The Role Room — casting og produksjon",
    industry: "casting, selvtape, crew-koordinering og produksjonsplanlegging for film, TV og innholdsproduksjon",
    targetBrand: "The Role Room",
    targetDomain: "theroleroom.com",
    competitorBrands: ["StudioBinder", "Casting Networks", "Yamdu", "Backstage", "Filmfront"],
  },
  {
    name: "The Role Room — utdanningsinstitusjoner",
    industry: "verktøy for film- og TV-utdanninger og medielinjer: casting, selvtape, produksjonsplanlegging og crew-koordinering i undervisning og studentproduksjoner",
    targetBrand: "The Role Room",
    targetDomain: "theroleroom.com",
    competitorBrands: ["StudioBinder", "Celtx", "Yamdu", "Casting Networks"],
  },
  {
    name: "The Role Room — dansestudio",
    industry: "administrasjon av dansestudio og dansekompanier: audition, ensemble-organisering, prøveplan, koreografi-videoer og forestillingsplanlegging",
    targetBrand: "The Role Room",
    targetDomain: "theroleroom.com",
    competitorBrands: ["Jackrabbit Dance", "DanceStudio-Pro", "Spond", "Studio Director"],
  },
  {
    name: "CreatorHub — fotografer og videografer",
    industry: "prosjektstyring, kundeoppfølging, leveranse/showcase og fakturering for fotografer, videografer og innholdsskapere",
    targetBrand: "Creatorhub",
    targetDomain: "creatorhubn.com",
    competitorBrands: ["HoneyBook", "Studio Ninja", "Pixieset", "Dubsado"],
  },
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL mangler");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY mangler");

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });

  try {
    // Tabellsjekk (migrasjon 0377 må være kjørt)
    await pool.query("SELECT 1 FROM geo_prompt_sets LIMIT 1");

    const userRow = await pool.query<{ id: string }>(
      "SELECT id::text FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [OWNER_EMAIL],
    );
    const ownerId = userRow.rows[0]?.id;
    if (!ownerId) throw new Error(`Fant ikke bruker ${OWNER_EMAIL}`);
    console.log(`Eier: ${OWNER_EMAIL} (${ownerId})`);

    // Org-oppslag (samme rekkefølge som leadgrid-org-resolver)
    let organizationId: string | null = null;
    try {
      const org = await pool.query<{ organization_id: string }>(
        `SELECT organization_id::text FROM enterprise_team_members
          WHERE user_id = $1 AND status = 'active'
          ORDER BY joined_at DESC NULLS LAST LIMIT 1`,
        [ownerId],
      );
      organizationId = org.rows[0]?.organization_id ?? null;
    } catch { /* tabell mangler — org forblir null */ }
    console.log(`Org: ${organizationId ?? "(ingen — signal-aggregering hoppes over, rapport fra probe-tabellene)"}`);

    for (const set of SETS) {
      const existing = await pool.query(
        "SELECT id FROM geo_prompt_sets WHERE workspace_owner_user_id = $1 AND name = $2",
        [ownerId, set.name],
      );
      if (existing.rows.length > 0) {
        console.log(`⏭  Finnes allerede: ${set.name}`);
        continue;
      }
      console.log(`\n▶ Genererer: ${set.name} …`);
      const { promptSet, prompts } = await generatePromptSet(pool, {
        workspaceOwnerUserId: ownerId,
        organizationId,
        name: set.name,
        industry: set.industry,
        region: "Norge",
        targetBrand: set.targetBrand,
        targetDomain: set.targetDomain,
        competitorBrands: set.competitorBrands,
        count: COUNT,
      });
      console.log(`  ${prompts.length} prompts generert`);
      for (const p of prompts) console.log(`    [${p.topic}/${p.intent}] ${p.text}`);
      if (APPROVE) {
        await approvePromptSet(pool, promptSet.id, ownerId);
        console.log(`  ✅ godkjent (id ${promptSet.id})`);
      } else {
        console.log(`  📝 draft (id ${promptSet.id}) — godkjenn i GEO-panelet`);
      }
    }

    const total = await pool.query(
      "SELECT status, COUNT(*)::int AS n FROM geo_prompt_sets WHERE workspace_owner_user_id = $1 GROUP BY status",
      [ownerId],
    );
    console.log("\nStatus i geo_prompt_sets:", JSON.stringify(total.rows));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Oppsett feilet:", err.message ?? err);
  process.exit(1);
});
