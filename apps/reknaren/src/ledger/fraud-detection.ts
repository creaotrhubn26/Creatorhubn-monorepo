/**
 * Avviks- og svindeldeteksjon — deterministisk, REN LESING over hovedboken og
 * linkede dokumenter. Motoren retter aldri noe; den flagger forhold som fortjener
 * et menneskeblikk, hvert med tydelig kategori, bevis (klikkbare bilag), forklaring
 * på vanlig norsk og en anbefalt handling. Menneskets dom lagres i fraud_reviews
 * (demper falske alarmer, mater mønster-minnet fraud_patterns for gjenkjenning av
 * fakturaer som ligner tidligere BEKREFTEDE svindelforsøk).
 *
 * Ingen ugjennomsiktig «svindel-score»: hvert varsel oppgir nøyaktig hvilke data
 * det bygger på, slik at brukeren selv kan vurdere det.
 */
import type { Db } from '../db/pool.js';
import { formatMinorAsKr } from '../invoicing/view.js';
import type { RuleRegister } from '../rules/register.js';

export type FraudSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface FraudEvidence {
  type: 'document' | 'journal_entry' | 'vendor' | 'bank_transaction' | 'user';
  label: string;
  documentId?: string;
  entryId?: string;
  entryNumber?: number;
}

export interface FraudReviewMark {
  verdict: 'confirmed_fraud' | 'false_alarm' | 'resolved';
  note?: string;
  at: string;
}

export interface FraudSignal {
  /** Stabil sjekk-kode. */
  code: string;
  /** Menneskelesbar kategori (norsk). */
  category: string;
  severity: FraudSeverity;
  title: string;
  detail: string;
  recommendation: string;
  evidence: FraudEvidence[];
  legalReference?: string;
  ruleReferences?: string[];
  /** Stabil identitet for dom/dedup i fraud_reviews. */
  fingerprint: string;
  /** Kjennetegn UI kan tilby å lære ved «bekreftet svindel» (mater signal 11). */
  patternHints?: { type: 'bank_account' | 'vendor_org' | 'vendor_name'; value: string; sourceDocumentId?: string }[];
  /** Menneskets dom, om den finnes. */
  reviewed?: FraudReviewMark | null;
}

export interface FraudControlSettings {
  significantThresholdMinor: bigint;
  requiredApprovers: number;
  businessHoursStart: number;
  businessHoursEnd: number;
}

export const DEFAULT_FRAUD_SETTINGS: FraudControlSettings = {
  significantThresholdMinor: 5_000_000n, // 50 000 kr
  requiredApprovers: 2,
  businessHoursStart: 6,
  businessHoursEnd: 21,
};

const SEVERITY_ORDER: Record<FraudSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const MAX_PER_CHECK = 40;

export interface DetectFraudParams {
  organizationId: string;
  fromDate: string;
  toDate: string;
}

export interface FraudReport {
  checkedFrom: string;
  checkedTo: string;
  signals: FraudSignal[];
  /** Varsler som ikke er avfeid som falsk alarm. */
  activeCount: number;
  dismissedCount: number;
  bySeverity: Record<FraudSeverity, number>;
  cappedChecks: string[];
  settings: {
    significantThresholdMinor: string;
    requiredApprovers: number;
    businessHoursStart: number;
    businessHoursEnd: number;
  };
}

export async function loadFraudSettings(db: Db, organizationId: string): Promise<FraudControlSettings> {
  const row = (
    await db.query(
      `SELECT significant_threshold_minor, required_approvers, business_hours_start, business_hours_end
       FROM fraud_control_settings WHERE organization_id = $1`,
      [organizationId],
    )
  ).rows[0];
  if (!row) return { ...DEFAULT_FRAUD_SETTINGS };
  return {
    significantThresholdMinor: BigInt(row.significant_threshold_minor),
    requiredApprovers: Number(row.required_approvers),
    businessHoursStart: Number(row.business_hours_start),
    businessHoursEnd: Number(row.business_hours_end),
  };
}

const kr = (minor: bigint | string | number) => formatMinorAsKr(typeof minor === 'bigint' ? minor : BigInt(minor));

export async function detectFraudSignals(db: Db, rules: RuleRegister, params: DetectFraudParams): Promise<FraudReport> {
  const { organizationId: org, fromDate: from, toDate: to } = params;
  void rules; // reservert for framtidige regelbaserte terskler
  const settings = await loadFraudSettings(db, org);
  const threshold = settings.significantThresholdMinor;
  const signals: FraudSignal[] = [];
  const capped: string[] = [];
  const cap = (code: string, n: number) => {
    if (n > MAX_PER_CHECK) capped.push(code);
  };

  // ── 1) Duplikate fakturaer ──────────────────────────────────────────────
  // Samme leverandør + samme fakturanummer på to eller flere ulike dokumenter.
  {
    const rows = (
      await db.query(
        `WITH latest AS (
           SELECT DISTINCT ON (e.document_id) e.document_id,
                  COALESCE(NULLIF(e.vendor_org_number,''), lower(NULLIF(e.vendor_name,''))) AS vkey,
                  e.vendor_name, e.invoice_number, e.gross_minor
           FROM extracted_document_data e
           JOIN source_documents d ON d.id = e.document_id
           WHERE e.organization_id = $1 AND d.status <> 'rejected'
             AND e.invoice_number IS NOT NULL AND e.invoice_number <> ''
           ORDER BY e.document_id, e.extraction_version DESC
         )
         SELECT vkey, vendor_name, invoice_number,
                array_agg(document_id::text ORDER BY document_id) AS doc_ids,
                MAX(gross_minor) AS gross_minor, COUNT(*) AS n
         FROM latest
         WHERE vkey IS NOT NULL
         GROUP BY vkey, vendor_name, invoice_number
         HAVING COUNT(*) > 1
         ORDER BY n DESC
         LIMIT ${MAX_PER_CHECK + 1}`,
        [org],
      )
    ).rows;
    cap('duplikat_faktura', rows.length);
    for (const r of rows.slice(0, MAX_PER_CHECK)) {
      const docs: string[] = r.doc_ids;
      signals.push({
        code: 'duplikat_faktura',
        category: 'Duplikate fakturaer',
        severity: 'high',
        title: `Fakturanr. ${r.invoice_number} fra ${r.vendor_name ?? 'leverandør'} finnes ${docs.length} ganger`,
        detail: `Fakturanummer ${r.invoice_number} fra ${r.vendor_name ?? 'samme leverandør'}${r.gross_minor ? ` på ${kr(r.gross_minor)} kr` : ''} er registrert på ${docs.length} ulike bilag. Samme faktura kan da bli betalt og bokført flere ganger.`,
        recommendation: 'Kontroller om det er samme faktura. Behold ett bilag, krediter/reverser de andre.',
        evidence: docs.map((id) => ({ type: 'document' as const, label: `Bilag ${r.invoice_number}`, documentId: id })),
        legalReference: 'Bokføringsloven §4 (fullstendighet, realitet)',
        fingerprint: `duplikat_faktura:${r.vkey}:${r.invoice_number}`,
      });
    }
  }

  // ── 2) Endrede leverandørkontonumre ─────────────────────────────────────
  // En leverandør vi kjenner har plutselig et NYTT bankkontonummer — det
  // klassiske kjennetegnet på fakturasvindel (BEC / omdirigert betaling).
  {
    const rows = (
      await db.query(
        `WITH latest AS (
           SELECT DISTINCT ON (e.document_id) e.document_id,
                  COALESCE(NULLIF(e.vendor_org_number,''), lower(NULLIF(e.vendor_name,''))) AS vkey,
                  e.vendor_name, e.bank_account, e.invoice_date, e.gross_minor
           FROM extracted_document_data e
           JOIN source_documents d ON d.id = e.document_id
           WHERE e.organization_id = $1 AND d.status <> 'rejected'
             AND e.bank_account IS NOT NULL AND e.bank_account <> ''
           ORDER BY e.document_id, e.extraction_version DESC
         ),
         perv AS (
           SELECT vkey, MAX(vendor_name) AS vendor_name,
                  COUNT(DISTINCT bank_account) AS accounts,
                  array_agg(DISTINCT bank_account) AS account_list
           FROM latest WHERE vkey IS NOT NULL
           GROUP BY vkey
           HAVING COUNT(DISTINCT bank_account) > 1
         )
         SELECT p.vkey, p.vendor_name, p.accounts, p.account_list,
                n.document_id AS newest_doc, n.bank_account AS newest_account, n.invoice_date
         FROM perv p
         JOIN LATERAL (
           SELECT document_id, bank_account, invoice_date FROM latest l
           WHERE l.vkey = p.vkey ORDER BY l.invoice_date DESC NULLS LAST, l.document_id DESC LIMIT 1
         ) n ON true
         ORDER BY p.accounts DESC
         LIMIT ${MAX_PER_CHECK + 1}`,
        [org],
      )
    ).rows;
    cap('endret_kontonummer', rows.length);
    for (const r of rows.slice(0, MAX_PER_CHECK)) {
      const others = (r.account_list as string[]).filter((a) => a !== r.newest_account);
      signals.push({
        code: 'endret_kontonummer',
        category: 'Endret leverandørkontonummer',
        severity: 'critical',
        title: `${r.vendor_name ?? 'Leverandør'} har oppgitt et nytt kontonummer`,
        detail: `Fakturaer fra ${r.vendor_name ?? 'denne leverandøren'} har brukt ${r.accounts} ulike bankkontonumre. Nyeste faktura ber om betaling til ${r.newest_account}, mens tidligere gikk til ${others.join(', ') || 'et annet nummer'}. Endret kontonummer er det vanligste tegnet på omdirigert betaling.`,
        recommendation: 'Ring leverandøren på et kjent nummer (ikke fra fakturaen) og bekreft kontonummeret før du betaler.',
        evidence: [{ type: 'document', label: 'Nyeste faktura', documentId: r.newest_doc }],
        legalReference: 'Kontrollhandling — bekreft betalingsinformasjon',
        patternHints: [{ type: 'bank_account', value: r.newest_account, sourceDocumentId: r.newest_doc }],
        fingerprint: `endret_kontonummer:${r.vkey}:${r.newest_account}`,
      });
    }
  }

  // ── 3) Fakturaer med avvikende beløp ────────────────────────────────────
  // Et beløp som stikker seg kraftig ut fra det leverandøren pleier å fakturere.
  {
    const rows = (
      await db.query(
        `WITH latest AS (
           SELECT DISTINCT ON (e.document_id) e.document_id,
                  COALESCE(NULLIF(e.vendor_org_number,''), lower(NULLIF(e.vendor_name,''))) AS vkey,
                  e.vendor_name, e.gross_minor, e.invoice_date, e.invoice_number
           FROM extracted_document_data e
           JOIN source_documents d ON d.id = e.document_id
           WHERE e.organization_id = $1 AND d.status <> 'rejected'
             AND e.gross_minor IS NOT NULL AND e.gross_minor > 0
           ORDER BY e.document_id, e.extraction_version DESC
         ),
         stats AS (
           SELECT vkey, COUNT(*) AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY gross_minor) AS median
           FROM latest WHERE vkey IS NOT NULL GROUP BY vkey HAVING COUNT(*) >= 3
         )
         SELECT l.document_id, l.vendor_name, l.gross_minor, l.invoice_number, l.invoice_date,
                s.median::bigint AS median
         FROM latest l JOIN stats s ON s.vkey = l.vkey
         WHERE l.invoice_date BETWEEN $2 AND $3
           AND l.gross_minor::numeric > s.median * 3
           AND l.gross_minor - s.median::bigint > 500000
         ORDER BY l.gross_minor DESC
         LIMIT ${MAX_PER_CHECK + 1}`,
        [org, from, to],
      )
    ).rows;
    cap('avvikende_belop', rows.length);
    for (const r of rows.slice(0, MAX_PER_CHECK)) {
      signals.push({
        code: 'avvikende_belop',
        category: 'Avvikende beløp',
        severity: 'medium',
        title: `Uvanlig stor faktura fra ${r.vendor_name ?? 'leverandør'}: ${kr(r.gross_minor)} kr`,
        detail: `Denne fakturaen på ${kr(r.gross_minor)} kr er mer enn tre ganger så stor som det ${r.vendor_name ?? 'leverandøren'} vanligvis fakturerer (median ${kr(r.median)} kr). Kontroller at beløpet stemmer.`,
        recommendation: 'Sammenlign med avtale/bestilling. Sjekk at ikke et komma er på feil plass eller at fakturaen er forfalsket.',
        evidence: [{ type: 'document', label: `Faktura ${r.invoice_number ?? ''}`.trim(), documentId: r.document_id }],
        fingerprint: `avvikende_belop:${r.document_id}`,
      });
    }
  }

  // ── 4) Betalinger på uvanlige tidspunkt ─────────────────────────────────
  // Bilag bokført midt på natten eller i helg — kan være helt legitimt, men er
  // et vanlig kjennetegn ved omgåelse av kontroller. Kun for kjøp/betalinger
  // over et vesentlig beløp, for å unngå støy.
  {
    const rows = (
      await db.query(
        `SELECT je.id, je.entry_number, je.source_document_id AS document_id, je.posted_at,
                to_char(je.posted_at AT TIME ZONE 'Europe/Oslo', 'DD.MM HH24:MI') AS local_ts,
                extract(isodow FROM je.posted_at AT TIME ZONE 'Europe/Oslo') AS dow,
                extract(hour FROM je.posted_at AT TIME ZONE 'Europe/Oslo') AS hour,
                SUM(l.debit_minor) AS total
         FROM journal_entries je
         JOIN journal_lines l ON l.entry_id = je.id
         WHERE je.organization_id = $1 AND je.status = 'posted'
           AND je.entry_date BETWEEN $2 AND $3
           AND (l.account_number ~ '^[4-7]' OR l.vendor_id IS NOT NULL)
         GROUP BY je.id, je.entry_number, je.source_document_id, je.posted_at
         HAVING SUM(l.debit_minor) >= $4
            AND ( extract(isodow FROM je.posted_at AT TIME ZONE 'Europe/Oslo') >= 6
               OR extract(hour FROM je.posted_at AT TIME ZONE 'Europe/Oslo') < $5
               OR extract(hour FROM je.posted_at AT TIME ZONE 'Europe/Oslo') >= $6 )
         ORDER BY je.posted_at DESC
         LIMIT ${MAX_PER_CHECK + 1}`,
        [org, from, to, threshold.toString(), settings.businessHoursStart, settings.businessHoursEnd],
      )
    ).rows;
    cap('uvanlig_tidspunkt', rows.length);
    for (const r of rows.slice(0, MAX_PER_CHECK)) {
      const weekend = Number(r.dow) >= 6;
      signals.push({
        code: 'uvanlig_tidspunkt',
        category: 'Betaling på uvanlig tidspunkt',
        severity: 'low',
        title: `Bilag ${r.entry_number}: bokført ${weekend ? 'i helgen' : 'utenfor arbeidstid'} (${r.local_ts})`,
        detail: `En betaling/kjøp på ${kr(r.total)} kr ble bokført ${r.local_ts}${weekend ? ' (helg)' : ''}. Vesentlige betalinger utenfor normal arbeidstid bør kontrolleres.`,
        recommendation: 'Bekreft at posteringen er reell og utført av rett person.',
        evidence: [{ type: 'journal_entry', label: `Bilag ${r.entry_number}`, entryId: r.id, entryNumber: Number(r.entry_number), ...(r.document_id ? { documentId: r.document_id } : {}) }],
        fingerprint: `uvanlig_tidspunkt:${r.id}`,
      });
    }
  }

  // ── 5) Nye mottakere ────────────────────────────────────────────────────
  // En leverandør opprettet i perioden som umiddelbart mottar en vesentlig
  // betaling. Nye mottakere av store beløp er verdt en ekstra kontroll.
  {
    const rows = (
      await db.query(
        `SELECT v.id AS vendor_id, v.name, v.created_at, je.id AS entry_id, je.entry_number,
                je.source_document_id AS document_id, SUM(l.debit_minor) AS total
         FROM vendors v
         JOIN journal_lines l ON l.vendor_id = v.id
         JOIN journal_entries je ON je.id = l.entry_id AND je.status = 'posted'
         WHERE v.organization_id = $1
           AND v.created_at::date BETWEEN $2 AND $3
           AND je.entry_date BETWEEN $2 AND $3
         GROUP BY v.id, v.name, v.created_at, je.id, je.entry_number, je.source_document_id
         HAVING SUM(l.debit_minor) >= $4
         ORDER BY total DESC
         LIMIT ${MAX_PER_CHECK + 1}`,
        [org, from, to, (threshold / 2n).toString()],
      )
    ).rows;
    cap('ny_mottaker', rows.length);
    for (const r of rows.slice(0, MAX_PER_CHECK)) {
      signals.push({
        code: 'ny_mottaker',
        category: 'Ny mottaker',
        severity: 'medium',
        title: `Ny leverandør ${r.name} mottok ${kr(r.total)} kr`,
        detail: `${r.name} ble opprettet som leverandør nylig og har allerede mottatt ${kr(r.total)} kr (bilag ${r.entry_number}). Kontroller at leverandøren er reell før større utbetalinger.`,
        recommendation: 'Slå opp leverandøren i Brønnøysund og bekreft org.nr og kontonummer.',
        evidence: [
          { type: 'vendor', label: r.name },
          { type: 'journal_entry', label: `Bilag ${r.entry_number}`, entryId: r.entry_id, entryNumber: Number(r.entry_number), ...(r.document_id ? { documentId: r.document_id } : {}) },
        ],
        fingerprint: `ny_mottaker:${r.vendor_id}:${r.entry_id}`,
      });
    }
  }

  // ── 6) Mistenkelige refusjoner ──────────────────────────────────────────
  // Kreditnotaer/refusjoner er en kjent kanal for å lede penger ut. Flagg
  // bokførte kreditnota-bilag over et beløp for kontroll.
  {
    const rows = (
      await db.query(
        `WITH latest AS (
           SELECT DISTINCT ON (e.document_id) e.document_id, e.vendor_name, e.gross_minor, e.document_type
           FROM extracted_document_data e
           JOIN source_documents d ON d.id = e.document_id
           WHERE e.organization_id = $1 AND d.status IN ('approved','posted')
           ORDER BY e.document_id, e.extraction_version DESC
         )
         SELECT document_id, vendor_name, gross_minor
         FROM latest
         WHERE document_type = 'credit_note' AND COALESCE(gross_minor,0) > 0
         ORDER BY gross_minor DESC
         LIMIT ${MAX_PER_CHECK + 1}`,
        [org],
      )
    ).rows;
    cap('mistenkelig_refusjon', rows.length);
    for (const r of rows.slice(0, MAX_PER_CHECK)) {
      signals.push({
        code: 'mistenkelig_refusjon',
        category: 'Mistenkelig refusjon',
        severity: 'medium',
        title: `Kreditnota fra ${r.vendor_name ?? 'leverandør'}: ${kr(r.gross_minor)} kr`,
        detail: `En kreditnota/refusjon på ${kr(r.gross_minor)} kr er registrert. Kontroller at refusjonen er reell og at pengene går tilbake til rett konto — refusjoner brukes ofte til å lede penger ut.`,
        recommendation: 'Sjekk mot opprinnelig faktura og at tilbakebetalingen går til vår egen konto.',
        evidence: [{ type: 'document', label: 'Kreditnota', documentId: r.document_id }],
        fingerprint: `mistenkelig_refusjon:${r.document_id}`,
      });
    }
  }

  // ── 7) Manipulerte kvitteringer ─────────────────────────────────────────
  // Tallgrunnlaget henger ikke sammen (netto + mva ≠ brutto, eller uttrekket er
  // merket avvik), eller nøyaktig samme fil er lastet opp som to ulike bilag.
  {
    const rows = (
      await db.query(
        `WITH latest AS (
           SELECT DISTINCT ON (e.document_id) e.document_id, e.vendor_name, e.net_minor, e.vat_minor,
                  e.gross_minor, e.validation_status
           FROM extracted_document_data e
           JOIN source_documents d ON d.id = e.document_id
           WHERE e.organization_id = $1 AND d.status <> 'rejected'
           ORDER BY e.document_id, e.extraction_version DESC
         )
         SELECT document_id, vendor_name, net_minor, vat_minor, gross_minor, validation_status
         FROM latest
         WHERE validation_status = 'discrepancy'
            OR (net_minor IS NOT NULL AND vat_minor IS NOT NULL AND gross_minor IS NOT NULL
                AND net_minor + vat_minor <> gross_minor)
         ORDER BY gross_minor DESC NULLS LAST
         LIMIT ${MAX_PER_CHECK + 1}`,
        [org],
      )
    ).rows;
    // Samme fil (sha256) brukt på to ulike, ikke-duplikatmerkede dokumenter.
    const sameFile = (
      await db.query(
        `SELECT sha256, array_agg(id::text ORDER BY created_at) AS ids, COUNT(*) AS n
         FROM source_documents
         WHERE organization_id = $1 AND status NOT IN ('rejected','duplicate') AND duplicate_of IS NULL
         GROUP BY sha256 HAVING COUNT(*) > 1
         LIMIT ${MAX_PER_CHECK + 1}`,
        [org],
      )
    ).rows;
    cap('manipulert_kvittering', rows.length + sameFile.length);
    for (const r of rows.slice(0, MAX_PER_CHECK)) {
      const mismatch =
        r.net_minor != null && r.vat_minor != null && r.gross_minor != null
          ? `Netto ${kr(r.net_minor)} + MVA ${kr(r.vat_minor)} = ${kr(BigInt(r.net_minor) + BigInt(r.vat_minor))} kr, men totalen står som ${kr(r.gross_minor)} kr.`
          : 'Uttrekket er merket som avvik.';
      signals.push({
        code: 'manipulert_kvittering',
        category: 'Manipulert kvittering',
        severity: 'high',
        title: `Bilag fra ${r.vendor_name ?? 'leverandør'}: tallene stemmer ikke`,
        detail: `${mismatch} Når summene ikke går opp kan kvitteringen være endret eller feillest.`,
        recommendation: 'Åpne originalbilaget og kontroller tallene mot kvitteringen.',
        evidence: [{ type: 'document', label: 'Bilag med avvik', documentId: r.document_id }],
        fingerprint: `manipulert_kvittering:${r.document_id}`,
      });
    }
    for (const r of sameFile.slice(0, MAX_PER_CHECK)) {
      const ids: string[] = r.ids;
      signals.push({
        code: 'manipulert_kvittering',
        category: 'Manipulert kvittering',
        severity: 'high',
        title: `Nøyaktig samme fil er lastet opp ${r.n} ganger`,
        detail: `${r.n} bilag deler nøyaktig samme innhold (identisk kontrollsum). Kan være samme kvittering gjenbrukt for å dokumentere flere kjøp.`,
        recommendation: 'Kontroller om det er samme kjøp, og fjern doblede bilag.',
        evidence: ids.map((id) => ({ type: 'document' as const, label: 'Identisk fil', documentId: id })),
        legalReference: 'Bokføringsloven §10 (dokumentasjon)',
        fingerprint: `manipulert_kvittering:sha:${r.sha256}`,
      });
    }
  }

  // ── 8) Uvanlige reiseregninger ──────────────────────────────────────────
  // Reise-/bilkostnader (71xx) uten bilag eller over et vesentlig beløp.
  {
    const rows = (
      await db.query(
        `SELECT je.id, je.entry_number, je.source_document_id AS document_id,
                l.account_number, l.debit_minor, l.description
         FROM journal_lines l
         JOIN journal_entries je ON je.id = l.entry_id AND je.status = 'posted'
         WHERE je.organization_id = $1 AND je.entry_date BETWEEN $2 AND $3
           AND l.account_number ~ '^71'
           AND l.debit_minor > 0
           AND (je.source_document_id IS NULL OR l.debit_minor >= 1000000)
         ORDER BY l.debit_minor DESC
         LIMIT ${MAX_PER_CHECK + 1}`,
        [org, from, to],
      )
    ).rows;
    cap('uvanlig_reiseregning', rows.length);
    for (const r of rows.slice(0, MAX_PER_CHECK)) {
      const noDoc = !r.document_id;
      signals.push({
        code: 'uvanlig_reiseregning',
        category: 'Uvanlig reiseregning',
        severity: noDoc ? 'medium' : 'low',
        title: `Bilag ${r.entry_number}: reisekostnad ${kr(r.debit_minor)} kr${noDoc ? ' uten bilag' : ''}`,
        detail: `${kr(r.debit_minor)} kr er ført som reise-/bilkostnad${noDoc ? ' uten et vedlagt bilag' : ''}. Reiseregninger uten dokumentasjon eller med store beløp bør kontrolleres, og kan gi skatteplikt hvis de ikke er legitimert.`,
        recommendation: noDoc ? 'Legg ved kvittering/reiseregning som dokumenterer utlegget.' : 'Kontroller at beløpet og formålet er reelt og korrekt legitimert.',
        evidence: [{ type: 'journal_entry', label: `Bilag ${r.entry_number}`, entryId: r.id, entryNumber: Number(r.entry_number), ...(r.document_id ? { documentId: r.document_id } : {}) }],
        legalReference: 'Skatteforvaltnings-/bokføringskrav til legitimasjon av utlegg',
        fingerprint: `uvanlig_reiseregning:${r.id}:${r.account_number}`,
      });
    }
  }

  // ── 9) Oppdelte kjøp under godkjenningsgrensen ──────────────────────────
  // Flere kjøp fra samme leverandør innen 7 dager, HVER under grensen, men som
  // til sammen overstiger den — klassisk oppdeling for å unngå godkjenning.
  {
    const rows = (
      await db.query(
        `WITH entry_totals AS (
           SELECT je.id, je.entry_number, je.entry_date, je.source_document_id AS document_id,
                  MAX(l.vendor_id::text) AS vendor_id, SUM(l.debit_minor) AS total
           FROM journal_entries je
           JOIN journal_lines l ON l.entry_id = je.id
           WHERE je.organization_id = $1 AND je.status = 'posted' AND je.entry_date BETWEEN $2 AND $3
           GROUP BY je.id, je.entry_number, je.entry_date, je.source_document_id
           HAVING MAX(l.vendor_id::text) IS NOT NULL AND SUM(l.debit_minor) > 0 AND SUM(l.debit_minor) < $4
         )
         -- Klynge av sub-grense-kjøp fra samme leverandør som spenner ≤ 7 dager
         -- og til sammen passerer godkjenningsgrensen.
         SELECT a.vendor_id, v.name AS vendor_name,
                array_agg(a.entry_number ORDER BY a.entry_date) AS entry_numbers,
                (array_agg(a.id ORDER BY a.entry_date))[1] AS first_entry,
                (array_agg(a.document_id ORDER BY a.entry_date))[1] AS first_doc,
                COUNT(*) AS n, SUM(a.total) AS combined
         FROM entry_totals a
         LEFT JOIN vendors v ON v.id = a.vendor_id::uuid
         GROUP BY a.vendor_id, v.name
         HAVING COUNT(*) >= 2 AND SUM(a.total) >= $4 AND MAX(a.entry_date) - MIN(a.entry_date) <= 7
         ORDER BY combined DESC
         LIMIT ${MAX_PER_CHECK + 1}`,
        [org, from, to, threshold.toString()],
      )
    ).rows;
    cap('oppdelt_kjop', rows.length);
    for (const r of rows.slice(0, MAX_PER_CHECK)) {
      const nums: number[] = (r.entry_numbers as (number | string)[]).map(Number);
      signals.push({
        code: 'oppdelt_kjop',
        category: 'Oppdelt kjøp',
        severity: 'high',
        title: `${r.vendor_name ?? 'Leverandør'}: ${r.n} kjøp som til sammen er ${kr(r.combined)} kr`,
        detail: `Bilag ${nums.join(', ')} er separate kjøp fra ${r.vendor_name ?? 'samme leverandør'} innen én uke, hvert under godkjenningsgrensen på ${kr(threshold)} kr, men til sammen ${kr(r.combined)} kr. Kan være ett kjøp delt opp for å unngå godkjenning.`,
        recommendation: 'Vurder om dette egentlig er ett kjøp som skulle vært godkjent samlet.',
        evidence: [{ type: 'journal_entry', label: `Bilag ${nums.join(', ')}`, entryId: r.first_entry, entryNumber: nums[0] ?? 0, ...(r.first_doc ? { documentId: r.first_doc } : {}) }],
        fingerprint: `oppdelt_kjop:${r.vendor_id}:${nums.join('-')}`,
      });
    }
  }

  // ── 10) Ansatte som godkjenner egne kostnader ───────────────────────────
  // Samme person både brakte inn bilaget OG bokførte det — brudd på
  // arbeidsdeling. Uttrykker ikke skyld, men mangel på uavhengig kontroll.
  {
    const rows = (
      await db.query(
        `SELECT je.id, je.entry_number, je.source_document_id AS document_id,
                u.display_name AS person, m.role AS person_role, SUM(l.debit_minor) AS total
         FROM journal_entries je
         JOIN source_documents d ON d.id = je.source_document_id
         JOIN journal_lines l ON l.entry_id = je.id
         LEFT JOIN users u ON u.id = je.posted_by
         LEFT JOIN memberships m ON m.user_id = je.posted_by AND m.organization_id = je.organization_id
         WHERE je.organization_id = $1 AND je.status = 'posted'
           AND je.entry_date BETWEEN $2 AND $3
           AND d.created_by = je.posted_by
         GROUP BY je.id, je.entry_number, je.source_document_id, u.display_name, m.role
         HAVING bool_or(l.account_number ~ '^[4-7]') AND SUM(l.debit_minor) > 0
         ORDER BY total DESC
         LIMIT ${MAX_PER_CHECK + 1}`,
        [org, from, to],
      )
    ).rows;
    cap('egengodkjenning', rows.length);
    for (const r of rows.slice(0, MAX_PER_CHECK)) {
      signals.push({
        code: 'egengodkjenning',
        category: 'Godkjenning av egne kostnader',
        severity: 'high',
        title: `Bilag ${r.entry_number}: ${r.person ?? 'samme person'} både leverte og bokførte`,
        detail: `${r.person ?? 'Én person'} lastet opp bilaget og bokførte det selv (${kr(r.total)} kr). God arbeidsdeling tilsier at en annen enn den som pådrar kostnaden godkjenner den.`,
        recommendation: 'La en annen med attestasjonsrett gjennomgå og godkjenne kostnaden.',
        evidence: [{ type: 'journal_entry', label: `Bilag ${r.entry_number}`, entryId: r.id, entryNumber: Number(r.entry_number), ...(r.document_id ? { documentId: r.document_id } : {}) }],
        legalReference: 'Arbeidsdeling / intern kontroll',
        fingerprint: `egengodkjenning:${r.id}`,
      });
    }
  }

  // ── 11) Fakturaer som ligner tidligere svindelforsøk ────────────────────
  // Nye bilag hvis kontonummer/org.nr matcher et BEKREFTET svindelforsøk
  // (fraud_patterns, bygget av «bekreftet svindel»-dommer). Ingen mønstre → ingen
  // varsler (ærlig: vi har ikke sett noe før).
  {
    const patterns = (
      await db.query(`SELECT pattern_type, value, note FROM fraud_patterns WHERE organization_id = $1`, [org])
    ).rows;
    if (patterns.length > 0) {
      const bankAccounts = patterns.filter((p) => p.pattern_type === 'bank_account').map((p) => p.value);
      const vendorOrgs = patterns.filter((p) => p.pattern_type === 'vendor_org').map((p) => p.value);
      const rows = (
        await db.query(
          `WITH latest AS (
             SELECT DISTINCT ON (e.document_id) e.document_id, e.vendor_name, e.bank_account,
                    e.vendor_org_number, e.invoice_date
             FROM extracted_document_data e
             JOIN source_documents d ON d.id = e.document_id
             WHERE e.organization_id = $1 AND d.status <> 'rejected'
             ORDER BY e.document_id, e.extraction_version DESC
           )
           SELECT document_id, vendor_name, bank_account, vendor_org_number
           FROM latest
           WHERE invoice_date BETWEEN $2 AND $3
             AND ( (bank_account = ANY($4::text[]) AND bank_account IS NOT NULL)
                OR (vendor_org_number = ANY($5::text[]) AND vendor_org_number IS NOT NULL) )
           ORDER BY invoice_date DESC
           LIMIT ${MAX_PER_CHECK + 1}`,
          [org, from, to, bankAccounts, vendorOrgs],
        )
      ).rows;
      cap('ligner_svindelforsok', rows.length);
      for (const r of rows.slice(0, MAX_PER_CHECK)) {
        const hit = bankAccounts.includes(r.bank_account)
          ? `kontonummer ${r.bank_account}`
          : `org.nr ${r.vendor_org_number}`;
        signals.push({
          code: 'ligner_svindelforsok',
          category: 'Ligner tidligere svindelforsøk',
          severity: 'critical',
          title: `Bilag fra ${r.vendor_name ?? 'leverandør'} matcher et tidligere svindelforsøk`,
          detail: `Dette bilagets ${hit} er tidligere markert som del av et bekreftet svindelforsøk. Behandle med stor forsiktighet.`,
          recommendation: 'Ikke betal før forholdet er bekreftet trygt. Meld videre internt.',
          evidence: [{ type: 'document', label: 'Bilag', documentId: r.document_id }],
          fingerprint: `ligner_svindelforsok:${r.document_id}`,
        });
      }
    }
  }

  // ── Kontroll: vesentlige betalinger uten nok godkjennere ────────────────
  {
    const rows = (
      await db.query(
        `SELECT je.id, je.entry_number, je.source_document_id AS document_id, SUM(l.debit_minor) AS total,
                COALESCE(ap.n, 0) AS approvals
         FROM journal_entries je
         JOIN journal_lines l ON l.entry_id = je.id
         LEFT JOIN (
           SELECT journal_entry_id, COUNT(*) AS n FROM payment_approvals
           WHERE organization_id = $1 GROUP BY journal_entry_id
         ) ap ON ap.journal_entry_id = je.id
         WHERE je.organization_id = $1 AND je.status = 'posted' AND je.entry_date BETWEEN $2 AND $3
           AND (l.account_number ~ '^[4-7]' OR l.vendor_id IS NOT NULL)
         GROUP BY je.id, je.entry_number, je.source_document_id, ap.n
         HAVING SUM(l.debit_minor) >= $4 AND COALESCE(ap.n, 0) < $5
         ORDER BY total DESC
         LIMIT ${MAX_PER_CHECK + 1}`,
        [org, from, to, threshold.toString(), settings.requiredApprovers],
      )
    ).rows;
    cap('krever_flergodkjenning', rows.length);
    for (const r of rows.slice(0, MAX_PER_CHECK)) {
      signals.push({
        code: 'krever_flergodkjenning',
        category: 'Krever flergodkjenning',
        severity: 'medium',
        title: `Bilag ${r.entry_number}: vesentlig betaling på ${kr(r.total)} kr mangler godkjenning`,
        detail: `Betalinger over ${kr(threshold)} kr krever ${settings.requiredApprovers} godkjennere. Denne har ${r.approvals}. Legg til godkjenning fra en annen person for et forsvarlig kontrollspor.`,
        recommendation: 'Få en ekstra godkjenning på betalingen.',
        evidence: [{ type: 'journal_entry', label: `Bilag ${r.entry_number}`, entryId: r.id, entryNumber: Number(r.entry_number), ...(r.document_id ? { documentId: r.document_id } : {}) }],
        fingerprint: `krever_flergodkjenning:${r.id}`,
      });
    }
  }

  // Merk varslene med menneskets dom (demper falske alarmer).
  const reviews = (
    await db.query(
      `SELECT fingerprint, verdict, note, reviewed_at FROM fraud_reviews WHERE organization_id = $1`,
      [org],
    )
  ).rows;
  const reviewMap = new Map<string, FraudReviewMark>(
    reviews.map((r) => [r.fingerprint, { verdict: r.verdict, note: r.note ?? undefined, at: new Date(r.reviewed_at).toISOString() }]),
  );
  for (const s of signals) {
    s.reviewed = reviewMap.get(s.fingerprint) ?? null;
  }

  // Sorter: bekreftet svindel først, så alvorsgrad; falske alarmer nederst.
  signals.sort((a, b) => {
    const af = a.reviewed?.verdict === 'false_alarm' ? 1 : 0;
    const bf = b.reviewed?.verdict === 'false_alarm' ? 1 : 0;
    if (af !== bf) return af - bf;
    const ac = a.reviewed?.verdict === 'confirmed_fraud' ? 0 : 1;
    const bc = b.reviewed?.verdict === 'confirmed_fraud' ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });

  const bySeverity: Record<FraudSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  let dismissed = 0;
  for (const s of signals) {
    if (s.reviewed?.verdict === 'false_alarm') dismissed++;
    else bySeverity[s.severity]++;
  }

  return {
    checkedFrom: from,
    checkedTo: to,
    signals,
    activeCount: signals.length - dismissed,
    dismissedCount: dismissed,
    bySeverity,
    cappedChecks: capped,
    settings: {
      significantThresholdMinor: threshold.toString(),
      requiredApprovers: settings.requiredApprovers,
      businessHoursStart: settings.businessHoursStart,
      businessHoursEnd: settings.businessHoursEnd,
    },
  };
}
