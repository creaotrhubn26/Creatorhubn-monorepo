/**
 * Henter heltebilder til demo-stedene i SenseAid Explore fra Wikimedia Commons
 * og skriver bilde-URL, kreditering og lisens til guide_pois
 * (0663_reiseguide_hero_image_credit.sql) og alt-tekst per språk til
 * guide_poi_translations.
 *
 *   DATABASE_URL=… npm run reiseguide:images
 *   npm run reiseguide:images -- --dry-run      # vis valget, skriv ingenting (trenger ikke DB)
 *
 * I produksjon kjøres den av workflowen «SenseAid Explore seed demo-innhold»
 * (.github/workflows/senseaid-seed-demo.yml) rett etter seeden, med samme
 * migrasjonsbruker og MIGRATION_OWNER_ROLE som seed-reiseguide-demo.ts.
 * Commons nås bare fra runneren (utviklings-skymiljøet blokkerer det).
 *
 * Hvor det letes står i DEMO_HERO_IMAGES i server/reiseguide-demo-data.ts,
 * reglene (lisens, størrelse, titler) i server/reiseguide-commons-images.ts.
 * Finnes ingen godkjent kandidat for et sted, varsles det og stedet røres
 * ikke (eksisterende bilde beholdes); scriptet feiler aldri på det.
 * Idempotent: samme treff gir samme rader.
 */
import { parseArgs } from "node:util";
import pg from "pg";
import {
  resolveHeroImage,
  type CommonsCandidate,
  type FetchLike,
  type ResolveResult,
} from "../server/reiseguide-commons-images.ts";
import { DEMO_HERO_IMAGES, DEMO_POIS, type DemoLang } from "../server/reiseguide-demo-data.ts";

const LANGS: DemoLang[] = ["nb", "en"];
const IN_ACTIONS = process.env.GITHUB_ACTIONS === "true";

function warn(message: string): void {
  console.warn(IN_ACTIONS ? `::warning::${message}` : `ADVARSEL: ${message}`);
}

function printTable(rows: string[][]): void {
  const widths = rows[0].map((_, col) => Math.max(...rows.map((r) => r[col].length)));
  for (const [index, row] of rows.entries()) {
    console.log(row.map((cell, col) => cell.padEnd(widths[col])).join(" | "));
    if (index === 0) console.log(widths.map((w) => "-".repeat(w)).join("-|-"));
  }
}

async function writeImage(client: pg.PoolClient, poiId: string, image: CommonsCandidate): Promise<void> {
  await client.query(
    `UPDATE guide_pois
        SET hero_image_key = $2, hero_image_credit = $3, hero_image_license = $4,
            hero_image_license_url = $5, hero_image_source_url = $6, updated_at = now()
      WHERE id = $1`,
    [poiId, image.thumbUrl, image.author, image.license, image.licenseUrl, image.sourceUrl],
  );
  const poi = DEMO_POIS.find((p) => p.id === poiId);
  for (const lang of LANGS) {
    const alt = poi?.translations[lang].heroImageAlt ?? null;
    await client.query(
      `UPDATE guide_poi_translations SET hero_image_alt = $3, updated_at = now()
        WHERE poi_id = $1 AND lang = $2`,
      [poiId, lang, alt],
    );
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });
  const dryRun = values["dry-run"] ?? false;

  if (!dryRun && !process.env.DATABASE_URL) {
    console.error("DATABASE_URL mangler (bruk --dry-run for å bare se valget).");
    process.exit(2);
  }

  const fetchImpl: FetchLike = (url, init) => fetch(url, init);
  const results: { poiId: string; title: string; result: ResolveResult }[] = [];
  for (const poi of DEMO_POIS) {
    const source = DEMO_HERO_IMAGES[poi.id];
    if (!source) {
      warn(`${poi.slug}: ingen Commons-oppsett i DEMO_HERO_IMAGES`);
      continue;
    }
    const result = await resolveHeroImage(source, fetchImpl);
    for (const w of result.warnings) warn(`${poi.slug}: ${w}`);
    if (!result.chosen) {
      warn(`${poi.slug}: ingen godkjent kandidat blant ${result.considered} filer; stedet røres ikke`);
    }
    results.push({ poiId: poi.id, title: poi.translations.nb.title, result });
  }

  printTable([
    ["Sted", "Fil", "Opphav", "Lisens", "Via"],
    ...results.map(({ title, result }) => [
      title,
      result.chosen?.title ?? "(ingen)",
      result.chosen?.author ?? "",
      result.chosen?.license ?? "",
      result.via ?? "",
    ]),
  ]);

  const chosen = results.filter((r) => r.result.chosen);
  if (dryRun) {
    console.log(`Tørrkjøring: ${chosen.length} av ${results.length} steder har bilde. Ingenting skrevet.`);
    return;
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ownerRole = (process.env.MIGRATION_OWNER_ROLE ?? "").trim();
    if (ownerRole) {
      if (!/^[a-z_][a-z0-9_]*$/.test(ownerRole)) {
        throw new Error("MIGRATION_OWNER_ROLE har et ugyldig rollenavn");
      }
      await client.query(`SET ROLE "${ownerRole}"`);
      await client.query("SET search_path TO public, pg_temp");
    }
    for (const { poiId, result } of chosen) {
      await writeImage(client, poiId, result.chosen!);
    }
    await client.query("COMMIT");
    console.log(`Commons-bilder: ${chosen.length} av ${results.length} steder oppdatert.`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
