/**
 * Guidet kontering av banktransaksjoner UTEN bilag — renter, gebyrer, skatt,
 * privatuttak, eierinnskudd o.l. Brukeren velger en plain-språk-kategori, og motoren
 * fører den korrekte dobbeltposteringen (riktig konto for ENK vs AS). Slik kan HVER
 * banklinje håndteres, så «Ferdig ✓» faktisk kan nås.
 *
 * «Brukervennlig først, men alt skal stemme»: kontokoblingene er faste og
 * dokumenterte her — aldri gjettet, aldri AI.
 */
import type { Db } from '../db/pool.js';
import type { Actor } from '../audit/audit.js';
import { postJournalEntry } from '../ledger/engine.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';

export type CategoryDirection = 'in' | 'out';

interface CategoryDef {
  key: string;
  label: string;
  /** in = penger inn (debet bank), out = penger ut (kredit bank). */
  direction: CategoryDirection;
  /** Motkonto — fast, eller per organisasjonsform. */
  account: string | { ENK: string; AS: string; default: string };
  /** Klartekst: hva dette ER + hvordan/hvorfor det bokføres. Novise-first. */
  explanation: string;
  /** Begrens til visse organisasjonsformer (f.eks. privatuttak kun ENK). */
  orgForms?: string[];
  note?: string;
}

/** Faste, dokumenterte kontokoblinger (norsk standard kontoplan). */
const CATEGORIES: CategoryDef[] = [
  {
    key: 'bankgebyr',
    label: 'Bankgebyr',
    direction: 'out',
    account: '7770',
    explanation: 'Det banken tar betalt for konto, kort og nettbank. Føres som en driftskostnad (konto 7770) og trekkes fra i regnskapet.',
  },
  {
    key: 'rentekostnad',
    label: 'Rentekostnad',
    direction: 'out',
    account: '8150',
    explanation: 'Renter du betaler på lån eller kreditt. Føres som en finanskostnad (konto 8150).',
  },
  {
    key: 'skatt',
    label: 'Betalt skatt',
    direction: 'out',
    // ENK: eierens skatt er privatuttak (ikke firmakostnad). AS: betalbar selskapsskatt.
    account: { ENK: '2060', AS: '2500', default: '2500' },
    explanation: 'Betaling av skatt til Skatteetaten. For AS: betalbar selskapsskatt (konto 2500). For ENK er eierens skatt et privatuttak (konto 2060), ikke en firmakostnad.',
  },
  {
    key: 'privatuttak',
    label: 'Privatuttak (penger til deg selv)',
    direction: 'out',
    account: '2060',
    orgForms: ['ENK'],
    explanation: 'Penger du tar ut av firmaet til deg selv. Er ikke en kostnad — det reduserer egenkapitalen din (konto 2060).',
  },
  {
    key: 'annen_utbetaling',
    label: 'Annen utbetaling (uten kvittering)',
    direction: 'out',
    account: '7790',
    explanation: 'En utbetaling du ikke har kvittering for ennå. Føres midlertidig som annen kostnad (konto 7790) — finn bilaget når du kan.',
  },
  {
    key: 'renteinntekt',
    label: 'Renteinntekt',
    direction: 'in',
    account: '8050',
    explanation: 'Renter du har fått på innskudd. Føres som en finansinntekt (konto 8050).',
  },
  {
    key: 'eierinnskudd',
    label: 'Innskudd fra eier',
    direction: 'in',
    account: '2050',
    explanation: 'Penger eier skyter inn i firmaet. Er ikke inntekt — det øker egenkapitalen (konto 2050).',
    note: 'Bokføres som egenkapital. For AS bør større innskudd vurderes som lån/kapitalforhøyelse.',
  },
  {
    key: 'annen_innbetaling',
    label: 'Annen innbetaling (uten faktura)',
    direction: 'in',
    account: '3900',
    explanation: 'En innbetaling uten faktura. Føres midlertidig som annen inntekt (konto 3900) — koble mot faktura hvis den finnes.',
  },
];

export interface BankCategory {
  key: string;
  label: string;
  direction: CategoryDirection;
  explanation: string;
  note?: string;
}

/** Kategoriene som gjelder for en organisasjonsform (til UI-et). */
export function bankCategoriesFor(orgForm: string): BankCategory[] {
  return CATEGORIES.filter((c) => !c.orgForms || c.orgForms.includes(orgForm)).map((c) => ({
    key: c.key,
    label: c.label,
    direction: c.direction,
    explanation: c.explanation,
    ...(c.note ? { note: c.note } : {}),
  }));
}

function resolveAccount(cat: CategoryDef, orgForm: string): string {
  if (typeof cat.account === 'string') return cat.account;
  return cat.account[orgForm as 'ENK' | 'AS'] ?? cat.account.default;
}

export interface CategorySuggestion {
  key: string;
  label: string;
  account: string;
  /** Plain-språk begrunnelse — «hvorfor tror vi dette». */
  reason: string;
  /** Klartekst: hva kategorien ER + hvordan den bokføres. */
  explanation: string;
}

/** Nøkkelord → kategori. Deterministisk, aldri AI. Rekkefølge = spesifisitet. */
// Delstreng-matching (ikke \b) — norske banktekster er ofte sammensatte ord
// («månedsgebyr», «forskuddsskatt»). Rekkefølge = spesifisitet (skatt før gebyr).
// Nøkkelordene er tunet mot EKTE norske banktekster (bl.a. SpareBank 1). Begrunnelsen
// forklarer i klartekst HVA linja er — så en novise faktisk lærer, ikke bare får en kode.
const SUGGESTION_RULES: Array<{ key: string; direction: CategoryDirection; test: RegExp; reason: string }> = [
  { key: 'skatt', direction: 'out', test: /skatt|skatteetaten|forskuddsskatt|restskatt|kemner|arbeidsgiveravgift|skattetrekk|forskuddstrekk|\baga\b/i, reason: 'Betaling til Skatteetaten (skatt eller avgift).' },
  { key: 'bankgebyr', direction: 'out', test: /gebyr|transpris|nettbank|prisbelast|m[åa]nedspris|kortavgift|serviceavgift|omkostning|bankavtale|betalingsformidling|betalingspakke|kontohold/i, reason: 'Pris banken tar for konto/nettbank — et bankgebyr.' },
  { key: 'rentekostnad', direction: 'out', test: /rente|renter|renteberegning/i, reason: 'Renter banken har belastet.' },
  { key: 'renteinntekt', direction: 'in', test: /rente|renter|renteberegning/i, reason: 'Renter du har fått godskrevet.' },
  { key: 'eierinnskudd', direction: 'in', test: /innskudd|egenkapital|kapitalinnskudd|aksjekapital|kapitalforh/i, reason: 'Penger eier har skutt inn i firmaet.' },
  { key: 'privatuttak', direction: 'out', test: /privat|privatuttak/i, reason: 'Penger tatt ut til privat bruk.' },
];

/**
 * Foreslår en sannsynlig kategori for en banklinje fra teksten — til «hva dette kan
 * være»-hintet i UI-et. Respekterer retning + organisasjonsform, og returnerer null
 * når ingen regel treffer trygt (ærlig: ingen gjetning uten grunnlag). Kontoen er den
 * samme faste koblingen som `categorizeBankTransaction` bruker, så «Bokfør» blir korrekt.
 */
export function suggestBankCategory(params: {
  description?: string | null;
  counterparty?: string | null;
  amountMinor: bigint;
  orgForm: string;
}): CategorySuggestion | null {
  const direction: CategoryDirection = params.amountMinor >= 0n ? 'in' : 'out';
  const haystack = `${params.description ?? ''} ${params.counterparty ?? ''}`;
  for (const rule of SUGGESTION_RULES) {
    if (rule.direction !== direction) continue;
    if (!rule.test.test(haystack)) continue;
    const cat = CATEGORIES.find((c) => c.key === rule.key);
    if (!cat) continue;
    if (cat.orgForms && !cat.orgForms.includes(params.orgForm)) continue;
    return { key: cat.key, label: cat.label, account: resolveAccount(cat, params.orgForm), reason: rule.reason, explanation: cat.explanation };
  }
  return null;
}

/**
 * Konterer én banktransaksjon etter valgt kategori og markerer den som avstemt.
 * Idempotent på transaksjonen (kan ikke føres to ganger).
 */
export async function categorizeBankTransaction(
  db: Db,
  params: { organizationId: string; actor: Actor; transactionId: string; category: string },
): Promise<{ entryNumber: number }> {
  const cat = CATEGORIES.find((c) => c.key === params.category);
  if (!cat) throw new ValidationError(`Ukjent kategori: ${params.category}`);

  const txRes = await db.query(
    `SELECT t.id, t.amount_minor, t.booked_date::TEXT AS booked_date, t.description, t.status,
            ba.ledger_account_number, o.org_form
     FROM bank_transactions t
     JOIN bank_accounts ba ON ba.id = t.bank_account_id
     JOIN organizations o ON o.id = t.organization_id
     WHERE t.id = $1 AND t.organization_id = $2`,
    [params.transactionId, params.organizationId],
  );
  if (!txRes.rowCount) throw new NotFoundError('Banktransaksjonen finnes ikke.');
  const tx = txRes.rows[0];
  if (tx.status !== 'unmatched') {
    throw new ConflictError('Transaksjonen er allerede avstemt.');
  }

  const amount = BigInt(tx.amount_minor);
  const direction: CategoryDirection = amount >= 0n ? 'in' : 'out';
  if (cat.direction !== direction) {
    throw new ValidationError(
      `Kategorien «${cat.label}» passer ${cat.direction === 'in' ? 'innbetalinger' : 'utbetalinger'}, men denne transaksjonen er en ${direction === 'in' ? 'innbetaling' : 'utbetaling'}.`,
    );
  }

  const orgForm = String(tx.org_form);
  if (cat.orgForms && !cat.orgForms.includes(orgForm)) {
    throw new ValidationError(`Kategorien «${cat.label}» gjelder ikke for organisasjonsformen ${orgForm}.`);
  }
  const bankAccount = String(tx.ledger_account_number);
  const counterAccount = resolveAccount(cat, orgForm);
  const magnitude = amount < 0n ? -amount : amount;

  // Penger inn: debet bank / kredit motkonto. Penger ut: debet motkonto / kredit bank.
  const lines =
    direction === 'in'
      ? [
          { accountNumber: bankAccount, debitMinor: magnitude },
          { accountNumber: counterAccount, creditMinor: magnitude },
        ]
      : [
          { accountNumber: counterAccount, debitMinor: magnitude },
          { accountNumber: bankAccount, creditMinor: magnitude },
        ];

  // Claim transaksjonen FØR postering: én betinget UPDATE avgjør vinneren, slik at
  // en ny kategorisering (annen kategori) ikke kan bokføres oppå. Postering og claim
  // er ikke i samme DB-transaksjon (postJournalEntry eier sin egen), så vi ruller
  // tilbake claimet hvis posteringen feiler — da kan brukeren prøve på nytt.
  // ponytail: et tynt tidsvindu mellom claim og postering kan i teorien la en
  // 'matched' transaksjon stå uten bilag ved krasj; å lagre journal_entry_id på
  // bank_transactions og utlede status derfra ville lukke det helt (schema-endring).
  const claim = await db.query(
    `UPDATE bank_transactions SET status = 'matched'
     WHERE id = $1 AND organization_id = $2 AND status = 'unmatched'
     RETURNING id`,
    [params.transactionId, params.organizationId],
  );
  if (!claim.rowCount) throw new ConflictError('Transaksjonen er allerede avstemt.');

  try {
    const entry = await postJournalEntry(db, {
      organizationId: params.organizationId,
      actor: params.actor,
      entryDate: String(tx.booked_date),
      description: `${cat.label}${tx.description ? ` — ${tx.description}` : ''}`,
      idempotencyKey: `bank-cat:${params.transactionId}`,
      lines,
    });
    return { entryNumber: entry.entryNumber };
  } catch (err) {
    await db.query(
      `UPDATE bank_transactions SET status = 'unmatched'
       WHERE id = $1 AND organization_id = $2 AND status = 'matched'`,
      [params.transactionId, params.organizationId],
    );
    throw err;
  }
}
