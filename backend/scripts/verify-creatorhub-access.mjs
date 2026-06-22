#!/usr/bin/env node
/**
 * verify-creatorhub-access.mjs
 *
 * READ-ONLY trippel-verifisering av at en bruker (default daniel@creatorhubn.com)
 * faktisk har tilgang til sine kunder i en org (default "Creatorhub AS"), og at
 * de navngitte kundene finnes i systemet + stemmer mot BRREG (Enhetsregisteret).
 *
 * Gjør KUN SELECT-spørringer. Ingen skriving. Krever DATABASE_URL i env og
 * utgående nett til data.brreg.no for BRREG-delen.
 *
 * Kjør (et sted med DB-tilgang — lokalt / Render shell / CI):
 *   DATABASE_URL=... node backend/scripts/verify-creatorhub-access.mjs
 *   DATABASE_URL=... node backend/scripts/verify-creatorhub-access.mjs \
 *     --email daniel@creatorhubn.com --org "Creatorhub AS" \
 *     --domains talkit.no,medside.no,holycrust.no,thepetkey.com
 *
 * Exit-kode 0 = alt OK, 1 = minst én sjekk feilet (eller manglende DATABASE_URL).
 *
 * Skjema brukt (verifisert mot migrasjoner):
 *   users(id, email)
 *   organizations(id, name, org_type, owner_user_id)
 *   organization_members(organization_id, user_id, role, sales_team_id, joined_at)
 *   crm_customers(id, organization_id, owner_user_id, name, website_url,
 *                 organization_number, lead_status)
 */

import pg from "pg";

// ── Args ────────────────────────────────────────────────────────────
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const EMAIL = arg("email", "daniel@creatorhubn.com");
const ORG_NAME = arg("org", "Creatorhub AS");
const DOMAINS = arg("domains", "talkit.no,medside.no,holycrust.no,thepetkey.com")
  .split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`;
const bad = (s) => `\x1b[31m✗\x1b[0m ${s}`;
const info = (s) => `  ${s}`;
let failed = false;
const fail = (s) => { failed = true; console.log(bad(s)); };

if (!process.env.DATABASE_URL) {
  console.error(bad("DATABASE_URL er ikke satt — kan ikke spørre databasen."));
  process.exit(1);
}

// ── BRREG (Enhetsregisteret, offentlig) ─────────────────────────────
async function brregByOrgNr(orgnr) {
  const clean = String(orgnr || "").replace(/\D/g, "");
  if (clean.length !== 9) return null;
  try {
    const r = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${clean}`,
      { headers: { accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
async function brregByName(name) {
  try {
    const r = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(name)}&size=5`,
      { headers: { accept: "application/json" } });
    if (!r.ok) return [];
    const j = await r.json();
    return j?._embedded?.enheter ?? [];
  } catch { return []; }
}

// ── Main ────────────────────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log(`\n=== Trippel-verifisering: ${EMAIL} → "${ORG_NAME}" ===\n`);

  // 1) Bruker
  const u = await pool.query(
    `SELECT id, email, username FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [EMAIL]);
  if (u.rowCount === 0) { fail(`Fant ingen bruker med e-post ${EMAIL}`); return; }
  const user = u.rows[0];
  console.log(ok(`Bruker funnet: ${user.email} (id=${user.id})`));

  // 2) Org
  const o = await pool.query(
    `SELECT id, name, org_type, owner_user_id FROM organizations
      WHERE name ILIKE $1 ORDER BY (name = $2) DESC LIMIT 5`,
    [`%${ORG_NAME}%`, ORG_NAME]);
  if (o.rowCount === 0) { fail(`Fant ingen organisasjon som matcher "${ORG_NAME}"`); return; }
  if (o.rowCount > 1) console.log(info(`(${o.rowCount} org-treff — bruker første)`));
  const org = o.rows[0];
  console.log(ok(`Org funnet: ${org.name} (id=${org.id}, type=${org.org_type})`));
  console.log(info(`Eier (owner_user_id): ${org.owner_user_id}${org.owner_user_id === user.id ? " — er denne brukeren ✓" : ""}`));

  // 3) Medlemskap / tilgang
  const m = await pool.query(
    `SELECT role, sales_team_id, joined_at FROM organization_members
      WHERE organization_id = $1 AND user_id = $2 LIMIT 1`, [org.id, user.id]);
  const isOwner = org.owner_user_id === user.id;
  if (m.rowCount > 0) {
    console.log(ok(`Medlemskap: rolle=${m.rows[0].role}, siden ${m.rows[0].joined_at?.toISOString?.() ?? m.rows[0].joined_at}`));
  } else if (isOwner) {
    console.log(ok(`Ingen organization_members-rad, men brukeren er org-eier (owner_user_id) → har tilgang`));
  } else {
    fail(`Brukeren er verken medlem av eller eier av "${org.name}" → MANGLER tilgang`);
  }

  // 4) Kunder i org-en (begge tilgangsmodeller: organization_id ELLER owner_user_id)
  const totals = await pool.query(
    `SELECT
        COUNT(*) FILTER (WHERE organization_id = $1)::int AS by_org,
        COUNT(*) FILTER (WHERE owner_user_id = $2)::int AS by_owner
       FROM crm_customers`, [org.id, user.id]);
  console.log(ok(`Kunder synlig for brukeren: ${totals.rows[0].by_org} via org + ${totals.rows[0].by_owner} via owner_user_id`));

  // 5) De navngitte kundene + BRREG-kryss
  console.log(`\n--- Navngitte kunder ---`);
  for (const domain of DOMAINS) {
    const base = domain.replace(/^www\./, "");
    const nameGuess = base.split(".")[0];
    const c = await pool.query(
      `SELECT id, name, website_url, organization_number, lead_status,
              organization_id, owner_user_id
         FROM crm_customers
        WHERE website_url ILIKE $1 OR name ILIKE $2
        ORDER BY (organization_id = $3 OR owner_user_id = $4) DESC
        LIMIT 3`,
      [`%${base}%`, `%${nameGuess}%`, org.id, user.id]);

    if (c.rowCount === 0) { fail(`${domain}: finnes IKKE som kunde i systemet`); continue; }

    const cust = c.rows[0];
    const hasAccess = cust.organization_id === org.id || cust.owner_user_id === user.id;
    const line = `${domain}: "${cust.name}" (id=${cust.id}, status=${cust.lead_status ?? "—"}, orgnr=${cust.organization_number ?? "—"})`;
    if (hasAccess) console.log(ok(line));
    else fail(`${line} — finnes, men er IKKE knyttet til ${org.name}/brukeren (tilgang mangler)`);

    // BRREG-kryss
    let enhet = await brregByOrgNr(cust.organization_number);
    if (!enhet) {
      const hits = await brregByName(cust.name);
      enhet = hits[0] ?? null;
      if (enhet) console.log(info(`BRREG (navnesøk): ${enhet.navn} (orgnr ${enhet.organisasjonsnummer})`));
    }
    if (enhet) {
      const konkurs = enhet.konkurs ? " ⚠️ KONKURS" : "";
      const avvikling = enhet.underAvvikling ? " ⚠️ UNDER AVVIKLING" : "";
      console.log(info(`BRREG: ${enhet.navn} · orgnr ${enhet.organisasjonsnummer} · ${enhet.organisasjonsform?.kode ?? "?"}${konkurs}${avvikling}`));
      if (cust.organization_number &&
          cust.organization_number.replace(/\D/g, "") !== String(enhet.organisasjonsnummer)) {
        fail(info(`  orgnr i CRM (${cust.organization_number}) ≠ BRREG (${enhet.organisasjonsnummer})`));
      }
    } else {
      console.log(info(`BRREG: ingen treff (mangler orgnr i CRM, eller blokkert nett)`));
    }
  }

  console.log(`\n=== Resultat: ${failed ? "\x1b[31mNOEN SJEKKER FEILET\x1b[0m" : "\x1b[32mALT OK\x1b[0m"} ===\n`);
}

main()
  .catch((e) => { console.error(bad(`Uventet feil: ${e.message}`)); failed = true; })
  .finally(async () => { await pool.end(); process.exit(failed ? 1 : 0); });
