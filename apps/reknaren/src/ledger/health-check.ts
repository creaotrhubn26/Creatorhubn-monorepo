/**
 * Regnskapshelse — «har du gjort en feil?». Leser regnskapet og flagger ting en
 * bruker uten regnskapsbakgrunn bør ta tak i, forklart på vanlig norsk, med et
 * konkret neste steg (hurtigknapp til rett skjerm). REN LESING — motoren bokfører
 * aldri noe selv, så den kan ikke gjøre regnskapet feil. «Brukervennlig først, men
 * alt skal stemme.»
 */
import type { Db } from '../db/pool.js';
import { formatMinorAsKr } from '../invoicing/view.js';
import { vatRegistrationThreshold } from './reports.js';

export type HealthSeverity = 'error' | 'warning' | 'info';

export interface HealthIssue {
  id: string;
  severity: HealthSeverity;
  title: string;
  detail: string;
  /** Tekst på hurtigknappen, f.eks. «Send purring». */
  actionLabel?: string;
  /** Nav-nøkkel i appen knappen skal føre til (documents/invoicing/bank/vat). */
  actionScreen?: string;
}

export interface HealthReport {
  checkedAt: string;
  /** Sortert: error → warning → info. */
  issues: HealthIssue[];
  okCount: number;
}

const SEVERITY_ORDER: Record<HealthSeverity, number> = { error: 0, warning: 1, info: 2 };

export async function runHealthCheck(
  db: Db,
  params: { organizationId: string; asOf: string },
): Promise<HealthReport> {
  const org = params.organizationId;
  const issues: HealthIssue[] = [];
  let okCount = 0;
  const push = (i: HealthIssue) => issues.push(i);
  const first = async (sql: string, p: unknown[]) => (await db.query(sql, p)).rows[0];

  // 1) Forfalte, ubetalte fakturaer.
  const overdue = await first(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(gross_minor - paid_minor), 0)::TEXT AS sum
     FROM invoices
     WHERE organization_id = $1 AND status = 'issued' AND due_date IS NOT NULL
       AND due_date < $2::date AND paid_minor < gross_minor`,
    [org, params.asOf],
  );
  if (overdue.n > 0) {
    push({
      id: 'overdue_invoices',
      severity: 'warning',
      title: `${overdue.n} forfalt${overdue.n > 1 ? 'e' : ''} faktura${overdue.n > 1 ? 'er' : ''} er ikke betalt`,
      detail: `Kunder skylder deg til sammen ${formatMinorAsKr(BigInt(overdue.sum))} kr. Send en vennlig påminnelse så du får pengene inn.`,
      actionLabel: 'Se fakturaer',
      actionScreen: 'invoicing',
    });
  } else okCount++;

  // 2) Bilag som venter på kontroll/godkjenning.
  const waiting = await first(
    `SELECT COUNT(*)::int AS n FROM source_documents
     WHERE organization_id = $1 AND status IN ('needs_review', 'extracted')`,
    [org],
  );
  if (waiting.n > 0) {
    push({
      id: 'documents_waiting',
      severity: 'warning',
      title: `${waiting.n} bilag venter på deg`,
      detail: `Du har ${waiting.n} kvittering${waiting.n > 1 ? 'er/fakturaer' : '/faktura'} som er lest, men ikke godkjent og bokført ennå. Gå gjennom dem så regnskapet blir komplett.`,
      actionLabel: 'Åpne bilagsinnboks',
      actionScreen: 'documents',
    });
  } else okCount++;

  // 3) Bilag i karantene (sikkerhet).
  const quarantined = await first(
    `SELECT COUNT(*)::int AS n FROM source_documents WHERE organization_id = $1 AND status = 'quarantined'`,
    [org],
  );
  if (quarantined.n > 0) {
    push({
      id: 'documents_quarantined',
      severity: 'warning',
      title: `${quarantined.n} bilag ligger i karantene`,
      detail: 'Vi stoppet disse fordi noe så mistenkelig ut (mulig manipulert innhold). Se over dem før de eventuelt bokføres.',
      actionLabel: 'Åpne bilagsinnboks',
      actionScreen: 'documents',
    });
  }

  // 4) Uavstemte banktransaksjoner.
  const unmatched = await first(
    `SELECT COUNT(*)::int AS n FROM bank_transactions WHERE organization_id = $1 AND status = 'unmatched'`,
    [org],
  );
  if (unmatched.n > 0) {
    push({
      id: 'bank_unmatched',
      severity: 'info',
      title: `${unmatched.n} banktransaksjon${unmatched.n > 1 ? 'er' : ''} er ikke avstemt`,
      detail: 'Disse er hentet fra banken, men ikke koblet til et bilag ennå. Avstemming sikrer at alt du har betalt og fått inn faktisk er bokført.',
      actionLabel: 'Gå til bank',
      actionScreen: 'bank',
    });
  } else okCount++;

  // 5) Gamle fakturautkast som aldri ble utstedt.
  const oldDrafts = await first(
    `SELECT COUNT(*)::int AS n FROM invoices
     WHERE organization_id = $1 AND status = 'draft' AND created_at < ($2::date - INTERVAL '30 days')`,
    [org, params.asOf],
  );
  if (oldDrafts.n > 0) {
    push({
      id: 'old_drafts',
      severity: 'info',
      title: `${oldDrafts.n} gammelt fakturautkast`,
      detail: `Du har ${oldDrafts.n} fakturautkast som er over 30 dager gammelt og aldri ble sendt. Utsted det, eller slett det hvis det ikke skal brukes.`,
      actionLabel: 'Se salg og faktura',
      actionScreen: 'invoicing',
    });
  }

  // 6) MVA-registreringsplikt (kun for uregistrerte).
  const orgRow = await first(`SELECT vat_status FROM organizations WHERE id = $1`, [org]);
  if (orgRow && orgRow.vat_status !== 'registered') {
    const t = await vatRegistrationThreshold(db, { organizationId: org, asOf: params.asOf });
    if (t.crossed) {
      push({
        id: 'vat_threshold_crossed',
        severity: 'error',
        title: 'Du har passert grensen for MVA-registrering',
        detail: `Du har hatt ${formatMinorAsKr(t.taxableTurnoverMinor)} kr avgiftspliktig omsetning siste 12 måneder. Over 50 000 kr er du pliktig å registrere virksomheten i MVA-registeret.`,
        actionLabel: 'Se MVA-terskel',
        actionScreen: 'vat',
      });
    } else if (t.pct >= 75) {
      push({
        id: 'vat_threshold_near',
        severity: 'warning',
        title: 'Du nærmer deg MVA-grensen',
        detail: `Du er på ${formatMinorAsKr(t.taxableTurnoverMinor)} kr av 50 000 kr siste 12 måneder. Følg med — passerer du grensen, må du registrere deg.`,
        actionLabel: 'Se MVA-terskel',
        actionScreen: 'vat',
      });
    } else okCount++;
  } else okCount++;

  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { checkedAt: params.asOf, issues, okCount };
}
