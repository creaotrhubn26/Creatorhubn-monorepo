/**
 * «Har du gjort en feil?» — deterministisk feil-deteksjon på BOKFØRTE bilag.
 *
 * Skiller seg fra runHealthCheck (som ser på prosess-hygiene: forfalte fakturaer,
 * ubehandlede bilag, MVA-terskel). Denne motoren leser hovedboken og linkede
 * dokumenter og flagger reelle bokføringsfeil en bruker uten regnskapsbakgrunn
 * oftest gjør — hver med forklaring på vanlig norsk, regel-/tallgrunnlag og en
 * lenke rett til bilaget. REN LESING: motoren retter aldri noe selv (hovedboken
 * er uforanderlig — retting skjer via kontrollert korrigering).
 */
import { getAccountDef } from '../coa/accounts.js';
import type { Db } from '../db/pool.js';
import { formatMinorAsKr } from '../invoicing/view.js';
import type { RuleRegister } from '../rules/register.js';

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface BookkeepingError {
  code: string;
  severity: ErrorSeverity;
  title: string;
  detail: string;
  /** Regelreferanser (ruleId-er) forklaringen bygger på. */
  ruleReferences: string[];
  /** Bilaget feilen gjelder — for deep-link i appen. */
  entryId?: string;
  entryNumber?: number;
  /** Kildebilaget (om det finnes) slik at appen kan åpne bilagsdetaljen. */
  documentId?: string;
  actionLabel: string;
}

const SEVERITY_ORDER: Record<ErrorSeverity, number> = { error: 0, warning: 1, info: 2 };
const MAX_PER_CHECK = 50;

export interface DetectParams {
  organizationId: string;
  fromDate: string;
  toDate: string;
}

export async function detectBookkeepingErrors(
  db: Db,
  rules: RuleRegister,
  params: DetectParams,
): Promise<{ checkedFrom: string; checkedTo: string; errors: BookkeepingError[]; cappedChecks: string[] }> {
  const { organizationId: org, fromDate: from, toDate: to } = params;
  const errors: BookkeepingError[] = [];
  const cappedChecks: string[] = [];

  const orgRow = (await db.query(`SELECT vat_status FROM organizations WHERE id = $1`, [org])).rows[0];
  const isVatRegistered = orgRow?.vat_status === 'registered';

  // ── A) Glemt å trekke fra inngående MVA ────────────────────────────────
  // Bilaget er linket til et dokument som viser norsk MVA, men posteringen har
  // ingen inngående-mva-linje (2710). Kun for mva-registrerte virksomheter.
  if (isVatRegistered) {
    const rows = await db.query(
      `SELECT je.id, je.entry_number, je.source_document_id AS document_id,
              e.vat_minor, e.vendor_name
       FROM journal_entries je
       JOIN LATERAL (
         SELECT vat_minor, vendor_name, currency
         FROM extracted_document_data
         WHERE document_id = je.source_document_id
         ORDER BY extraction_version DESC LIMIT 1
       ) e ON true
       WHERE je.organization_id = $1 AND je.status = 'posted'
         AND je.entry_date BETWEEN $2 AND $3
         AND je.source_document_id IS NOT NULL
         AND COALESCE(e.vat_minor, 0) > 0
         AND (e.currency = 'NOK' OR e.currency IS NULL)
         AND NOT EXISTS (
           SELECT 1 FROM journal_lines l WHERE l.entry_id = je.id AND l.account_number = '2710'
         )
       ORDER BY je.entry_number DESC
       LIMIT ${MAX_PER_CHECK + 1}`,
      [org, from, to],
    );
    if (rows.rowCount && rows.rowCount > MAX_PER_CHECK) cappedChecks.push('glemt_mva_fradrag');
    for (const r of rows.rows.slice(0, MAX_PER_CHECK)) {
      errors.push({
        code: 'glemt_mva_fradrag',
        severity: 'warning',
        title: `Bilag ${r.entry_number}: mulig glemt MVA-fradrag`,
        detail: `Kvitteringen fra ${r.vendor_name ?? 'leverandøren'} viser ${formatMinorAsKr(BigInt(r.vat_minor))} kr i MVA, men bilaget er bokført uten fradrag for inngående MVA. Er dette et vanlig kjøp til virksomheten, får du trolig MVA-en tilbake i MVA-oppgjøret. Sjekk om koden skulle vært «Fradragsberettiget inngående MVA».`,
        ruleReferences: ['no.vat.rate.standard'],
        entryId: r.id,
        entryNumber: Number(r.entry_number),
        documentId: r.document_id,
        actionLabel: 'Åpne bilaget',
      });
    }
  }

  // ── B) Mulig dobbeltføring ─────────────────────────────────────────────
  // To bokførte bilag mot samme leverandør, samme totalbeløp, innen 10 dager.
  const dupes = await db.query(
    `WITH entry_totals AS (
       SELECT je.id, je.entry_number, je.entry_date, je.source_document_id AS document_id,
              SUM(l.debit_minor) AS total_debit,
              MAX(l.vendor_id::text) AS vendor_id
       FROM journal_entries je
       JOIN journal_lines l ON l.entry_id = je.id
       WHERE je.organization_id = $1 AND je.status = 'posted'
         AND je.entry_date BETWEEN $2 AND $3
       GROUP BY je.id, je.entry_number, je.entry_date, je.source_document_id
       HAVING MAX(l.vendor_id::text) IS NOT NULL AND SUM(l.debit_minor) > 0
     )
     SELECT a.id AS a_id, a.entry_number AS a_no, a.document_id AS a_doc,
            b.entry_number AS b_no, a.total_debit, v.name AS vendor_name
     FROM entry_totals a
     JOIN entry_totals b
       ON a.vendor_id = b.vendor_id AND a.total_debit = b.total_debit
      AND a.id <> b.id AND a.entry_number > b.entry_number
      AND ABS(a.entry_date - b.entry_date) <= 10
     LEFT JOIN vendors v ON v.id = a.vendor_id::uuid
     ORDER BY a.entry_number DESC
     LIMIT ${MAX_PER_CHECK + 1}`,
    [org, from, to],
  );
  if (dupes.rowCount && dupes.rowCount > MAX_PER_CHECK) cappedChecks.push('mulig_dobbeltforing');
  for (const r of dupes.rows.slice(0, MAX_PER_CHECK)) {
    errors.push({
      code: 'mulig_dobbeltforing',
      severity: 'warning',
      title: `Bilag ${r.a_no}: mulig dobbeltføring`,
      detail: `Bilag ${r.a_no} og bilag ${r.b_no} er begge bokført mot ${r.vendor_name ?? 'samme leverandør'} med nøyaktig samme beløp (${formatMinorAsKr(BigInt(r.total_debit))} kr) innen ti dager. Sjekk at ikke det samme kjøpet er ført to ganger — det ville blåst opp både kostnad og MVA-fradrag.`,
      ruleReferences: [],
      entryId: r.a_id,
      entryNumber: Number(r.a_no),
      ...(r.a_doc ? { documentId: r.a_doc } : {}),
      actionLabel: 'Åpne bilaget',
    });
  }

  // ── C) Stort kjøp kostnadsført — burde kanskje aktiveres ───────────────
  const thresholdVer = rules.getVersionAt('no.asset.expense-threshold', to);
  const thresholdMinor = BigInt(String(thresholdVer.parameters['thresholdNokMinor'] ?? '3000000'));
  const big = await db.query(
    `SELECT je.id, je.entry_number, je.source_document_id AS document_id,
            l.account_number, l.debit_minor
     FROM journal_lines l
     JOIN journal_entries je ON je.id = l.entry_id
     WHERE je.organization_id = $1 AND je.status = 'posted'
       AND je.entry_date BETWEEN $2 AND $3
       AND l.debit_minor >= $4
       AND l.account_number ~ '^[4-7]'
     ORDER BY l.debit_minor DESC
     LIMIT ${MAX_PER_CHECK + 1}`,
    [org, from, to, thresholdMinor.toString()],
  );
  const bigCandidates = big.rows.filter((r) => getAccountDef(r.account_number)?.capitalizationCandidate);
  if (bigCandidates.length > MAX_PER_CHECK) cappedChecks.push('burde_aktiveres');
  for (const r of bigCandidates.slice(0, MAX_PER_CHECK)) {
    const def = getAccountDef(r.account_number);
    errors.push({
      code: 'burde_aktiveres',
      severity: 'info',
      title: `Bilag ${r.entry_number}: stort kjøp kostnadsført direkte`,
      detail: `${formatMinorAsKr(BigInt(r.debit_minor))} kr er kostnadsført på «${def?.name ?? r.account_number}». Kjøp over ${formatMinorAsKr(thresholdMinor)} kr som skal vare i minst tre år skal normalt aktiveres som eiendel og avskrives over flere år, ikke trekkes fra alt i år. Vurder om dette er en eiendel.`,
      ruleReferences: ['no.asset.expense-threshold', 'no.asset.depreciation-groups'],
      entryId: r.id,
      entryNumber: Number(r.entry_number),
      ...(r.document_id ? { documentId: r.document_id } : {}),
      actionLabel: 'Åpne bilaget',
    });
  }

  errors.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (b.entryNumber ?? 0) - (a.entryNumber ?? 0),
  );
  return { checkedFrom: from, checkedTo: to, errors, cappedChecks };
}
