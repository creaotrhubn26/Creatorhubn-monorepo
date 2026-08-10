/**
 * Migrer et helt regnskap fra SAF-T inn i Reknaren — full transaksjonshistorikk,
 * ikke bare åpningssaldo. Gjenbrukbart verktøy: gi det én eller flere SAF-T-filer
 * (typisk én per år fra Fiken), så spiller det av HVER bokføring, avstemmer mot
 * kildens sluttsaldoer, og oppdager faste utgifter.
 *
 * Bruk:
 *   DATABASE_URL='postgres://…' npx tsx scripts/migrate-from-saft.mts \
 *     --name "Virksomhet AS" --owner epost@example.com [--orgform ENK] \
 *     [--vat registered] [--no-detect] [--dry-run] <fil.xml | mappe> …
 *
 * Detaljer:
 *   • Filene sorteres på regnskapsperiode; det TIDLIGSTE året får inngående balanse.
 *   • Org opprettes (eller gjenbrukes) på navn. Replay er idempotent på kildens
 *     transaksjons-ID → trygt å kjøre om igjen / kjøre flere år etter hverandre.
 *   • Avstemming: balansekontoer (klasse 1–2) mot nyeste års livstidssaldo,
 *     resultatkontoer (3–8) mot SUM av årssluttsaldoene (kilden nullstiller
 *     resultat per år; hovedboken er kontinuerlig). Komposittkonto (1920:sub)
 *     aggregeres til basiskonto.
 *   • --dry-run leser og oppsummerer filene uten å skrive noe (krever ikke DB).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createPool } from '../src/db/pool.ts';
import { createOrganization, ensureUser } from '../src/orgs/service.ts';
import { replaySaftTransactions, parseSaft } from '../src/saft/import.ts';
import { detectRecurringExpectations } from '../src/ledger/recurring.ts';
import type { OrganizationForm, VatRegistrationStatus } from '../src/rules/types.ts';

const kr = (m: bigint) => (Number(m) / 100).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const base = (n: string) => (n.split(':')[0] ?? n).trim();
const isBalanceSheet = (n: string) => n[0] === '1' || n[0] === '2';

function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  const paths: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (key === 'no-detect' || key === 'dry-run') flags[key] = true;
      else { flags[key] = next ?? ''; i++; }
    } else paths.push(a);
  }
  return { flags, paths };
}

function expandXmlPaths(paths: string[]): string[] {
  const out: string[] = [];
  for (const p of paths) {
    if (statSync(p).isDirectory()) for (const f of readdirSync(p)) { if (f.toLowerCase().endsWith('.xml')) out.push(join(p, f)); }
    else out.push(p);
  }
  return out;
}

async function main() {
  const { flags, paths } = parseArgs(process.argv.slice(2));
  const dryRun = !!flags['dry-run'];
  const name = flags['name'] as string | undefined;
  const owner = flags['owner'] as string | undefined;
  const orgForm = (flags['orgform'] as OrganizationForm) ?? 'ENK';
  const vatStatus = (flags['vat'] as VatRegistrationStatus) ?? 'registered';

  if (paths.length === 0) { console.error('❌ Oppgi minst én SAF-T-fil eller mappe. Se toppen av skriptet for bruk.'); process.exit(1); }
  if (!dryRun && (!name || !owner)) { console.error('❌ --name og --owner er påkrevd (med mindre --dry-run).'); process.exit(1); }

  // Les + sorter filer på regnskapsperiode (tidligste først).
  const files = expandXmlPaths(paths)
    .map((path) => ({ path, xml: readFileSync(path, 'utf-8') }))
    .map((f) => ({ ...f, periodStart: parseSaft(f.xml).periodStart ?? '' }))
    .sort((a, b) => (a.periodStart < b.periodStart ? -1 : a.periodStart > b.periodStart ? 1 : 0));
  console.log(`Filer (kronologisk):\n${files.map((f, i) => `  ${i === 0 ? '↳ inngående balanse' : '  '}  ${f.periodStart}  ${f.path.split('/').pop()}`).join('\n')}`);

  if (dryRun) {
    console.log('\n(dry-run — skriver ingenting)');
    return;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.error('❌ Sett DATABASE_URL.'); process.exit(1); }
  if (dbUrl.includes('localhost') || dbUrl.includes('_test')) { console.error('❌ Peker på lokal/test-DB — dette skriver ekte regnskap.'); process.exit(1); }

  const db = createPool(dbUrl);
  const userId = await ensureUser(db, owner!, owner!.split('@')[0] ?? 'Eier');
  const actor = { userId, role: 'owner' as const };
  const existing = (await db.query(`SELECT id::text AS id FROM organizations WHERE lower(name)=lower($1) LIMIT 1`, [name])).rows[0]?.id;
  const orgId = existing ?? (await createOrganization(db, { name: name!, orgForm, vatStatus, createdByUserId: userId })).id;
  console.log(`\norg ${orgId} (${existing ? 'gjenbruk' : 'ny'}) · ${orgForm} · ${vatStatus}`);

  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const r = await replaySaftTransactions(db, { organizationId: orgId, actor, xml: f.xml, includeOpening: i === 0 });
    console.log(`  ${f.periodStart?.slice(0, 4)}: ${r.transactionsPosted} ført, ${r.transactionsSkipped} hoppet, ${r.linesPosted} linjer, lev ${r.suppliersCreated}, kunder ${r.customersCreated}${r.openingEntryNumber ? `, inngående #${r.openingEntryNumber}` : ''}${r.unbalanced.length ? `, ⚠ ubalanserte: ${r.unbalanced.join(',')}` : ''}`);
  }

  // Avstemming mot kilden.
  const expected = new Map<string, bigint>(); const nm = new Map<string, string>();
  const latest = files[files.length - 1]!.periodStart?.slice(0, 4);
  for (const f of files) {
    const p = parseSaft(f.xml);
    const yb = new Map<string, bigint>();
    for (const a of p.accounts) { const b = base(a.number); yb.set(b, (yb.get(b) ?? 0n) + a.closingMinor); if (!nm.has(b)) nm.set(b, a.name); }
    for (const [b, c] of yb) { if (isBalanceSheet(b)) { if (f.periodStart?.slice(0, 4) === latest) expected.set(b, c); } else expected.set(b, (expected.get(b) ?? 0n) + c); }
  }
  const rows = (await db.query(`SELECT l.account_number acc, COALESCE(SUM(l.debit_minor),0)-COALESCE(SUM(l.credit_minor),0) net FROM journal_lines l JOIN journal_entries je ON je.id=l.entry_id WHERE je.organization_id=$1 GROUP BY l.account_number`, [orgId])).rows;
  const ledger = new Map<string, bigint>();
  for (const r of rows) ledger.set(base(r.acc), (ledger.get(base(r.acc)) ?? 0n) + BigInt(r.net));
  const accts = new Set([...expected.keys(), ...ledger.keys()]);
  let mism = 0;
  for (const acc of [...accts].sort()) if ((ledger.get(acc) ?? 0n) !== (expected.get(acc) ?? 0n)) { mism++; console.log(`  ✗ ${acc} ${nm.get(acc) ?? ''}: Reknaren ${kr(ledger.get(acc) ?? 0n)} vs kilde ${kr(expected.get(acc) ?? 0n)}`); }
  console.log(mism === 0 ? `✅ avstemming EKSAKT (${accts.size} kontoer)` : `⚠ ${mism} avvik — se over`);

  if (!flags['no-detect']) {
    const det = await detectRecurringExpectations(db, { organizationId: orgId });
    const rules = (await db.query(`SELECT subject_label, target, observation_count FROM learned_rules WHERE organization_id=$1 AND rule_type='recurring_expectation' ORDER BY observation_count DESC`, [orgId])).rows;
    console.log(`\nfaste utgifter oppdaget: ${det.proposed} nye · ${rules.length} totalt`);
    for (const x of rules) { const t = typeof x.target === 'string' ? JSON.parse(x.target) : x.target; console.log(`  • ${x.subject_label}: ${t.cadence} ~${kr(BigInt(t.expectedAmountMinor))} · konto ${t.accountNumber ?? '?'} (${x.observation_count}×)`); }
  }

  await db.end();
  console.log('\nFerdig.');
}
main().catch((e) => { console.error(e); process.exit(1); });
