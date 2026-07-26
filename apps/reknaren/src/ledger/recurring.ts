/**
 * Abonnements-/forventningsvakt. Oppdager FASTE kostnader som uteblir.
 *
 * Lærdom fra Telia-funnet: en fast månedlig forpliktelse sluttet stille å lande
 * i bøkene i 18 måneder — den må hentes manuelt fra «Min side» (ingen e-post/
 * bank-auto-fangst), og ingen la merke til fraværet. Denne vaktposten:
 *   1) LÆRER hvilke leverandører som er periodiske (kadens + typisk beløp +
 *      kildekanal), foreslått fra historikk og bekreftet av et menneske —
 *      lagret som lærd regel (recurring_expectation), så den gjenbruker
 *      provenans/scope/godkjenning fra læringssystemet.
 *   2) MONITORERER hver periode: dukket det forventede opp (bokført)? Uteblir
 *      det → påminnelse. Store beløpsavvik flagges også.
 *   3) Kildekanal: «auto» (kom med bilag) vs «manuell» (må hentes fra Min side)
 *      → manuelle får proaktiv «husk å hente»-påminnelse (+ evt. lagret lenke),
 *      og der en connector finnes kan den auto-hentes.
 *
 * 🔒 Varsler og foreslår — bokfører ALDRI selv.
 */
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import { getAccountDef } from '../coa/accounts.js';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { formatMinorAsKr } from '../invoicing/view.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';
import { newId } from '../shared/ids.js';

export type Cadence = 'monthly' | 'quarterly' | 'yearly';
export type Channel = 'auto' | 'manual';

export interface RecurringTarget {
  cadence: Cadence;
  expectedAmountMinor: string; // typisk brutto per forekomst
  dueDay: number; // dag i måneden forekomsten pleier å komme
  channel: Channel;
  accountNumber?: string;
  minSideUrl?: string; // lenke til leverandørens «Min side» (manuelle)
  connectorId?: string; // sett hvis en connector kan auto-hente
  lastSeen?: string; // siste observerte forekomst (ISO)
}

const CADENCE_DAYS: Record<Cadence, number> = { monthly: 30, quarterly: 91, yearly: 365 };
const kr = (m: bigint | string) => formatMinorAsKr(typeof m === 'bigint' ? m : BigInt(m));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (d: string) => Date.parse(d + 'T00:00:00Z');
function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
}
function medianBig(nums: bigint[]): bigint {
  const s = [...nums].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return s.length ? s[Math.floor(s.length / 2)]! : 0n;
}

/* ── 1) Deteksjon: foreslå faste forventninger fra historikk ─────────────── */

export interface DetectRecurringResult {
  proposed: number;
}

export async function detectRecurringExpectations(db: Db, params: { organizationId: string }): Promise<DetectRecurringResult> {
  const org = params.organizationId;
  const rows = (
    await db.query(
      `SELECT je.entry_date::text AS d, MAX(l.vendor_id::text) AS vendor_id,
              bool_or(je.source_document_id IS NOT NULL) AS has_doc,
              SUM(l.debit_minor) AS amt,
              (array_agg(l.account_number ORDER BY l.debit_minor DESC))[1] AS acc
       FROM journal_entries je JOIN journal_lines l ON l.entry_id = je.id
       WHERE je.organization_id = $1 AND je.status = 'posted' AND je.is_closing = FALSE
         AND l.vendor_id IS NOT NULL AND l.debit_minor > 0 AND l.account_number ~ '^[4-7]'
       GROUP BY je.id, je.entry_date
       ORDER BY 2, 1`,
      [org],
    )
  ).rows;
  const byVendor = new Map<string, { d: string; amt: bigint; hasDoc: boolean; acc: string }[]>();
  for (const r of rows) {
    const arr = byVendor.get(r.vendor_id) ?? [];
    arr.push({ d: r.d, amt: BigInt(r.amt), hasDoc: r.has_doc, acc: r.acc });
    byVendor.set(r.vendor_id, arr);
  }
  const vids = [...byVendor.keys()];
  const meta = new Map<string, { name: string; org_number: string | null }>();
  if (vids.length) {
    const nr = await db.query(`SELECT id::text AS id, name, org_number FROM vendors WHERE id = ANY($1::uuid[])`, [vids]);
    for (const n of nr.rows) meta.set(n.id, { name: n.name, org_number: n.org_number });
  }
  let proposed = 0;
  for (const [vid, occ] of byVendor) {
    if (occ.length < 3) continue;
    const days = occ.map((o) => dayMs(o.d));
    const intervals: number[] = [];
    for (let i = 1; i < days.length; i++) intervals.push(Math.round((days[i]! - days[i - 1]!) / 86400000));
    const medInt = median(intervals);
    const cadence: Cadence | null =
      medInt >= 25 && medInt <= 35 ? 'monthly' : medInt >= 80 && medInt <= 100 ? 'quarterly' : medInt >= 350 && medInt <= 380 ? 'yearly' : null;
    if (!cadence) continue;
    const medAmt = medianBig(occ.map((o) => o.amt));
    if (medAmt <= 0n) continue;
    const lo = (medAmt * 70n) / 100n;
    const hi = (medAmt * 130n) / 100n;
    if (occ.filter((o) => o.amt >= lo && o.amt <= hi).length < Math.ceil(occ.length * 0.6)) continue;
    const v = meta.get(vid);
    if (!v) continue;
    const subjectKey = (v.org_number || v.name.toLowerCase()).trim();
    const docRatio = occ.filter((o) => o.hasDoc).length / occ.length;
    const dueDay = median(occ.map((o) => Number(o.d.slice(8, 10))));
    // Dominant konto blant forekomstene.
    const accCount = new Map<string, number>();
    for (const o of occ) accCount.set(o.acc, (accCount.get(o.acc) ?? 0) + 1);
    const accountNumber = [...accCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const target: RecurringTarget = {
      cadence,
      expectedAmountMinor: medAmt.toString(),
      dueDay: Math.max(1, Math.min(28, dueDay)),
      // Uten bilag på flertallet → må trolig hentes manuelt (Min side).
      channel: docRatio >= 0.6 ? 'auto' : 'manual',
      ...(accountNumber ? { accountNumber } : {}),
      lastSeen: occ[occ.length - 1]!.d,
    };
    const rationale = `${v.name} har kommet ${cadence === 'monthly' ? 'månedlig' : cadence === 'quarterly' ? 'kvartalsvis' : 'årlig'} (${occ.length} ganger, typisk ${kr(medAmt)} kr). Sist sett ${occ[occ.length - 1]!.d}.`;
    const id = newId();
    const res = await db.query(
      `INSERT INTO learned_rules
         (id, organization_id, scope, rule_type, subject_type, subject_key, subject_label, target,
          status, support_count, observation_count, rationale, created_by)
       VALUES ($1,$2,'organization','recurring_expectation','vendor',$3,$4,$5,'suggested',$6,$6,$7,NULL)
       ON CONFLICT ((COALESCE(group_id, organization_id)), rule_type, subject_type, COALESCE(subject_key, ''))
       DO NOTHING`,
      [id, org, subjectKey, v.name, JSON.stringify(target), occ.length, rationale],
    );
    if (res.rowCount) proposed++;
  }
  return { proposed };
}

/* ── 2) Monitor: hva forfaller / mangler / avviker? ──────────────────────── */

export interface RecurringDueItem {
  ruleId: string;
  vendor: string;
  cadence: Cadence;
  channel: Channel;
  accountNumber: string | null;
  minSideUrl: string | null;
  connectorId: string | null;
  expectedAmountMinor: string;
  /** Perioder som er forfalt uten bokføring (ikke håndtert). */
  overdue: { period: string; dueDate: string; inInbox: boolean }[];
  /** Neste forventede forfall (fram i tid, innen varslingsvindu). */
  dueSoon: { period: string; dueDate: string }[];
  /** Bokførte forekomster med stort beløpsavvik. */
  anomalies: { period: string; bookedMinor: string; expectedMinor: string }[];
}

interface ActiveExpectation {
  id: string;
  subjectKey: string | null;
  vendor: string;
  target: RecurringTarget;
}

async function loadActiveExpectations(db: Db, org: string): Promise<ActiveExpectation[]> {
  const groupId = (await db.query(`SELECT group_id FROM organizations WHERE id = $1`, [org])).rows[0]?.group_id ?? null;
  const rows = (
    await db.query(
      `SELECT id, subject_key, subject_label, target FROM learned_rules
       WHERE status='active' AND rule_type='recurring_expectation'
         AND ((scope='organization' AND organization_id=$1) OR (scope='group' AND group_id=$2))`,
      [org, groupId],
    )
  ).rows;
  return rows.map((r) => ({ id: r.id, subjectKey: r.subject_key, vendor: r.subject_label, target: typeof r.target === 'string' ? JSON.parse(r.target) : r.target }));
}

/** Forventede perioder fra siste observasjon fram til asOf + varslingsvindu. */
function expectedPeriods(t: RecurringTarget, asOf: string, lookaheadDays: number): { period: string; dueDate: string }[] {
  const start = t.lastSeen ? dayMs(t.lastSeen) : dayMs(asOf) - 365 * 86400000;
  const step = CADENCE_DAYS[t.cadence] * 86400000;
  const end = dayMs(asOf) + lookaheadDays * 86400000;
  const out: { period: string; dueDate: string }[] = [];
  for (let ms = start + step; ms <= end && out.length < 40; ms += step) {
    const d = new Date(ms);
    const period = t.cadence === 'yearly' ? String(d.getUTCFullYear()) : d.toISOString().slice(0, 7);
    out.push({ period, dueDate: iso(ms) });
  }
  return out;
}

export async function assessRecurringDue(db: Db, params: { organizationId: string; asOf: string; lookaheadDays?: number }): Promise<{
  asOf: string;
  items: RecurringDueItem[];
  overdueCount: number;
  overdueAmountMinor: string;
}> {
  const org = params.organizationId;
  const asOf = params.asOf;
  const lookahead = params.lookaheadDays ?? 10;
  const expectations = await loadActiveExpectations(db, org);
  // Per-periode-resolusjoner.
  const res = (await db.query(`SELECT rule_id, period, status, snooze_until FROM recurring_status WHERE organization_id=$1`, [org])).rows;
  const resolved = new Map<string, { status: string; snooze: string | null }>();
  for (const r of res) resolved.set(`${r.rule_id}:${r.period}`, { status: r.status, snooze: r.snooze_until ? new Date(r.snooze_until).toISOString().slice(0, 10) : null });

  const items: RecurringDueItem[] = [];
  let overdueCount = 0;
  let overdueAmt = 0n;
  for (const e of expectations) {
    // Faktiske forekomster for leverandøren (bokført) + i innboks, per periode.
    const bookedRows = e.subjectKey
      ? (await db.query(
          `SELECT je.entry_date::text AS d, SUM(l.debit_minor) AS amt
           FROM journal_entries je JOIN journal_lines l ON l.entry_id = je.id
           JOIN vendors v ON v.id = l.vendor_id
           WHERE je.organization_id=$1 AND je.status='posted'
             AND (v.org_number=$2 OR lower(v.name)=$2)
           GROUP BY je.id, je.entry_date`,
          [org, e.subjectKey],
        )).rows
      : [];
    const inboxRows = e.subjectKey
      ? (await db.query(
          `SELECT DISTINCT e.invoice_date::text AS d
           FROM extracted_document_data e JOIN source_documents d ON d.id=e.document_id
           WHERE e.organization_id=$1 AND d.status IN ('extracted','needs_review','approved')
             AND (e.vendor_org_number=$2 OR lower(e.vendor_name)=$2) AND e.invoice_date IS NOT NULL`,
          [org, e.subjectKey],
        )).rows
      : [];
    const bookedByPeriod = new Map<string, bigint>();
    for (const b of bookedRows) {
      const p = e.target.cadence === 'yearly' ? b.d.slice(0, 4) : b.d.slice(0, 7);
      bookedByPeriod.set(p, (bookedByPeriod.get(p) ?? 0n) + BigInt(b.amt));
    }
    const inboxPeriods = new Set(inboxRows.map((r) => (e.target.cadence === 'yearly' ? r.d.slice(0, 4) : r.d.slice(0, 7))));

    const item: RecurringDueItem = {
      ruleId: e.id,
      vendor: e.vendor,
      cadence: e.target.cadence,
      channel: e.target.channel,
      accountNumber: e.target.accountNumber ?? null,
      minSideUrl: e.target.minSideUrl ?? null,
      connectorId: e.target.connectorId ?? null,
      expectedAmountMinor: e.target.expectedAmountMinor,
      overdue: [],
      dueSoon: [],
      anomalies: [],
    };
    const expAmt = BigInt(e.target.expectedAmountMinor || '0');
    for (const { period, dueDate } of expectedPeriods(e.target, asOf, lookahead)) {
      const r = resolved.get(`${e.id}:${period}`);
      if (r && (r.status === 'handled' || r.status === 'dismissed')) continue;
      if (r && r.status === 'snoozed' && r.snooze && r.snooze > asOf) continue;
      const booked = bookedByPeriod.get(period);
      if (booked != null) {
        // Bokført — sjekk beløpsavvik (>30 %).
        if (expAmt > 0n) {
          const lo = (expAmt * 70n) / 100n;
          const hi = (expAmt * 130n) / 100n;
          if (booked < lo || booked > hi) item.anomalies.push({ period, bookedMinor: booked.toString(), expectedMinor: expAmt.toString() });
        }
        continue;
      }
      if (dueDate <= asOf) {
        item.overdue.push({ period, dueDate, inInbox: inboxPeriods.has(period) });
        overdueCount++;
        overdueAmt += expAmt;
      } else {
        item.dueSoon.push({ period, dueDate });
      }
    }
    if (item.overdue.length || item.dueSoon.length || item.anomalies.length) items.push(item);
  }
  items.sort((a, b) => b.overdue.length - a.overdue.length);
  return { asOf, items, overdueCount, overdueAmountMinor: overdueAmt.toString() };
}

/* ── 3) Menneskets handling: marker håndtert / utsett / avvis ────────────── */

export async function resolveRecurring(
  db: Db,
  params: { organizationId: string; actor: Actor; ruleId: string; period: string; status: 'handled' | 'snoozed' | 'dismissed'; snoozeUntil?: string; note?: string },
): Promise<void> {
  if (!/^\d{4}(-\d{2})?$/.test(params.period)) throw new ValidationError('Ugyldig periode.');
  await withTransaction(db, async (client) => {
    const owns = await client.query(
      `SELECT 1 FROM learned_rules WHERE id=$1 AND rule_type='recurring_expectation'
         AND (organization_id=$2 OR group_id=(SELECT group_id FROM organizations WHERE id=$2))`,
      [params.ruleId, params.organizationId],
    );
    if (!owns.rowCount) throw new NotFoundError('Forventningen finnes ikke.');
    await client.query(
      `INSERT INTO recurring_status (id, organization_id, rule_id, period, status, snooze_until, note, resolved_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (organization_id, rule_id, period)
       DO UPDATE SET status=EXCLUDED.status, snooze_until=EXCLUDED.snooze_until, note=EXCLUDED.note, resolved_by=EXCLUDED.resolved_by, resolved_at=now()`,
      [newId(), params.organizationId, params.ruleId, params.period, params.status, params.snoozeUntil ?? null, params.note ?? null, params.actor.userId],
    );
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'recurring.resolved',
      entityType: 'learned_rule',
      entityId: params.ruleId,
      newValue: { period: params.period, status: params.status },
    });
  });
}
