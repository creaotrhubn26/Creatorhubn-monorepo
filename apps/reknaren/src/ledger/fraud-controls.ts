/**
 * Kontroller oppå avviks- og svindeldeteksjonen: menneskets dom over et varsel
 * (demper falske alarmer, mater mønster-minnet), kontrollpolicy (hva som er en
 * vesentlig betaling + antall godkjennere), og flergodkjenning av vesentlige
 * betalinger. Deteksjonen selv (fraud-detection.ts) er ren lesing; alt som
 * ENDRER noe bor her, med revisjonsspor.
 */
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';
import { newId } from '../shared/ids.js';
import { formatMinorAsKr } from '../invoicing/view.js';
import { DEFAULT_FRAUD_SETTINGS, loadFraudSettings } from './fraud-detection.js';
import { getActiveApprovalRules, ROLE_LABELS } from './learning.js';

export interface FraudSettingsDto {
  significantThresholdMinor: string;
  requiredApprovers: number;
  businessHoursStart: number;
  businessHoursEnd: number;
  isDefault: boolean;
}

export async function getFraudSettings(db: Db, organizationId: string): Promise<FraudSettingsDto> {
  const row = (
    await db.query(`SELECT 1 FROM fraud_control_settings WHERE organization_id = $1`, [organizationId])
  ).rowCount;
  const s = await loadFraudSettings(db, organizationId);
  return {
    significantThresholdMinor: s.significantThresholdMinor.toString(),
    requiredApprovers: s.requiredApprovers,
    businessHoursStart: s.businessHoursStart,
    businessHoursEnd: s.businessHoursEnd,
    isDefault: !row,
  };
}

export interface UpdateFraudSettingsInput {
  organizationId: string;
  actor: Actor;
  significantThresholdMinor?: bigint;
  requiredApprovers?: number;
  businessHoursStart?: number;
  businessHoursEnd?: number;
}

export async function updateFraudSettings(db: Db, input: UpdateFraudSettingsInput): Promise<FraudSettingsDto> {
  const current = await loadFraudSettings(db, input.organizationId);
  const next = {
    significantThresholdMinor: input.significantThresholdMinor ?? current.significantThresholdMinor,
    requiredApprovers: input.requiredApprovers ?? current.requiredApprovers,
    businessHoursStart: input.businessHoursStart ?? current.businessHoursStart,
    businessHoursEnd: input.businessHoursEnd ?? current.businessHoursEnd,
  };
  if (next.significantThresholdMinor < 0n) throw new ValidationError('Grensen kan ikke være negativ.');
  if (next.requiredApprovers < 1) throw new ValidationError('Minst én godkjenner kreves.');
  if (next.businessHoursStart < 0 || next.businessHoursStart > 23) throw new ValidationError('Ugyldig starttid.');
  if (next.businessHoursEnd < 1 || next.businessHoursEnd > 24) throw new ValidationError('Ugyldig slutttid.');
  if (next.businessHoursEnd <= next.businessHoursStart) throw new ValidationError('Slutttid må være etter starttid.');

  await withTransaction(db, async (client) => {
    await client.query(
      `INSERT INTO fraud_control_settings
         (organization_id, significant_threshold_minor, required_approvers, business_hours_start, business_hours_end, updated_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6, now())
       ON CONFLICT (organization_id) DO UPDATE SET
         significant_threshold_minor = EXCLUDED.significant_threshold_minor,
         required_approvers = EXCLUDED.required_approvers,
         business_hours_start = EXCLUDED.business_hours_start,
         business_hours_end = EXCLUDED.business_hours_end,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()`,
      [
        input.organizationId,
        next.significantThresholdMinor.toString(),
        next.requiredApprovers,
        next.businessHoursStart,
        next.businessHoursEnd,
        input.actor.userId,
      ],
    );
    await recordAuditEvent(client, {
      organizationId: input.organizationId,
      actor: input.actor,
      action: 'fraud.settings.updated',
      entityType: 'fraud_control_settings',
      entityId: input.organizationId,
      newValue: {
        significantThresholdMinor: next.significantThresholdMinor.toString(),
        requiredApprovers: next.requiredApprovers,
      },
    });
  });

  return {
    significantThresholdMinor: next.significantThresholdMinor.toString(),
    requiredApprovers: next.requiredApprovers,
    businessHoursStart: next.businessHoursStart,
    businessHoursEnd: next.businessHoursEnd,
    isDefault: false,
  };
}

export type FraudVerdict = 'confirmed_fraud' | 'false_alarm' | 'resolved';

export interface ReviewFraudSignalInput {
  organizationId: string;
  actor: Actor;
  signalCode: string;
  fingerprint: string;
  verdict: FraudVerdict;
  note?: string;
  /** Kjennetegn å legge i mønster-minnet ved «bekreftet svindel». */
  patterns?: { type: 'bank_account' | 'vendor_org' | 'vendor_name'; value: string; sourceDocumentId?: string | undefined }[];
}

export async function reviewFraudSignal(
  db: Db,
  input: ReviewFraudSignalInput,
): Promise<{ verdict: FraudVerdict; patternsAdded: number }> {
  if (!input.fingerprint) throw new ValidationError('Mangler varsel-referanse.');
  let patternsAdded = 0;
  const reviewId = newId();
  await withTransaction(db, async (client) => {
    await client.query(
      `INSERT INTO fraud_reviews (id, organization_id, signal_code, fingerprint, verdict, note, reviewed_by, reviewed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now())
       ON CONFLICT (organization_id, fingerprint) DO UPDATE SET
         verdict = EXCLUDED.verdict, note = EXCLUDED.note, reviewed_by = EXCLUDED.reviewed_by, reviewed_at = now()`,
      [reviewId, input.organizationId, input.signalCode, input.fingerprint, input.verdict, input.note ?? null, input.actor.userId],
    );

    // Bekreftet svindel → lær kjennetegnene så lignende bilag fanges neste gang.
    if (input.verdict === 'confirmed_fraud' && input.patterns?.length) {
      for (const p of input.patterns) {
        const value = p.value?.trim();
        if (!value) continue;
        const res = await client.query(
          `INSERT INTO fraud_patterns (id, organization_id, pattern_type, value, note, source_document_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (organization_id, pattern_type, value) DO NOTHING`,
          [newId(), input.organizationId, p.type, value, input.note ?? null, p.sourceDocumentId ?? null, input.actor.userId],
        );
        patternsAdded += res.rowCount ?? 0;
      }
    }

    await recordAuditEvent(client, {
      organizationId: input.organizationId,
      actor: input.actor,
      action: 'fraud.signal.reviewed',
      entityType: 'fraud_review',
      entityId: reviewId,
      newValue: { signalCode: input.signalCode, fingerprint: input.fingerprint, verdict: input.verdict, patternsAdded },
    });
  });
  return { verdict: input.verdict, patternsAdded };
}

export interface ApprovePaymentInput {
  organizationId: string;
  actor: Actor;
  journalEntryId: string;
  note?: string;
}

export interface PaymentApprovalStatus {
  journalEntryId: string;
  entryNumber: number;
  totalMinor: string;
  requiredApprovers: number;
  approvals: { approver: string; role: string | null; at: string; note: string | null }[];
  satisfied: boolean;
}

export async function approvePayment(db: Db, input: ApprovePaymentInput): Promise<PaymentApprovalStatus> {
  return withTransaction(db, async (client) => {
    const entry = (
      await client.query(
        `SELECT je.id, je.entry_number, je.posted_by,
                COALESCE(SUM(l.debit_minor) FILTER (WHERE l.account_number ~ '^[4-7]' OR l.vendor_id IS NOT NULL), 0) AS total
         FROM journal_entries je
         JOIN journal_lines l ON l.entry_id = je.id
         WHERE je.id = $1 AND je.organization_id = $2 AND je.status = 'posted'
         GROUP BY je.id, je.entry_number, je.posted_by`,
        [input.journalEntryId, input.organizationId],
      )
    ).rows[0];
    if (!entry) throw new NotFoundError('Bilaget finnes ikke.');
    // En person kan ikke godkjenne sitt eget bilag — det er hele poenget med
    // flergodkjenning (arbeidsdeling).
    if (entry.posted_by === input.actor.userId) {
      throw new ConflictError('Du kan ikke godkjenne en betaling du selv har bokført. En annen må godkjenne.');
    }

    const ins = await client.query(
      `INSERT INTO payment_approvals (id, organization_id, journal_entry_id, approver_user_id, approver_role, note)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (organization_id, journal_entry_id, approver_user_id) DO NOTHING`,
      [newId(), input.organizationId, input.journalEntryId, input.actor.userId, input.actor.role, input.note ?? null],
    );
    if ((ins.rowCount ?? 0) === 0) throw new ConflictError('Du har allerede godkjent denne betalingen.');

    await recordAuditEvent(client, {
      organizationId: input.organizationId,
      actor: input.actor,
      action: 'payment.approved',
      entityType: 'journal_entry',
      entityId: input.journalEntryId,
      newValue: { entryNumber: Number(entry.entry_number), totalMinor: String(entry.total) },
    });

    return statusFor(client, input.organizationId, entry);
  });
}

async function statusFor(
  client: Parameters<Parameters<typeof withTransaction>[1]>[0],
  org: string,
  entry: { id: string; entry_number: number | string; total: number | string },
): Promise<PaymentApprovalStatus> {
  const settings = await loadFraudSettings(client as unknown as Db, org).catch(() => ({ ...DEFAULT_FRAUD_SETTINGS }));
  const approvals = (
    await client.query(
      `SELECT u.display_name AS approver, ap.approver_role AS role, ap.approved_at, ap.note
       FROM payment_approvals ap LEFT JOIN users u ON u.id = ap.approver_user_id
       WHERE ap.organization_id = $1 AND ap.journal_entry_id = $2
       ORDER BY ap.approved_at`,
      [org, entry.id],
    )
  ).rows;
  return {
    journalEntryId: entry.id,
    entryNumber: Number(entry.entry_number),
    totalMinor: String(entry.total),
    requiredApprovers: settings.requiredApprovers,
    approvals: approvals.map((a) => ({
      approver: a.approver ?? 'Ukjent',
      role: a.role ?? null,
      at: new Date(a.approved_at).toISOString(),
      note: a.note ?? null,
    })),
    satisfied: approvals.length >= settings.requiredApprovers,
  };
}

export interface ApprovalRequirement {
  source: 'significant' | 'vendor' | 'threshold';
  requiredRole: string | null; // null = hvilken som helst godkjenner (vesentlig-grense)
  reason: string;
  satisfied: boolean;
}

export interface AwaitingApprovalItem {
  journalEntryId: string;
  entryNumber: number;
  entryDate: string;
  description: string;
  documentId: string | null;
  totalMinor: string;
  approvals: number;
  requiredApprovers: number;
  /** Alle godkjenningskrav som gjelder betalingen (vesentlig-grense + lærte regler). */
  requirements: ApprovalRequirement[];
}

export async function listPaymentsAwaitingApproval(
  db: Db,
  params: { organizationId: string; fromDate: string; toDate: string },
): Promise<{ requiredApprovers: number; significantThresholdMinor: string; items: AwaitingApprovalItem[] }> {
  const settings = await loadFraudSettings(db, params.organizationId);
  const learned = await getActiveApprovalRules(db, params.organizationId);
  const smallestThreshold = learned.thresholds.reduce(
    (min, t) => (t.thresholdMinor < min ? t.thresholdMinor : min),
    settings.significantThresholdMinor,
  );

  // Kandidater: kjøp/betalinger over laveste relevante grense, ELLER fra en
  // leverandør med et lært godkjenningskrav (uansett beløp). Tar med godkjenner-
  // roller for å avgjøre om et rollekrav er oppfylt.
  const rows = (
    await db.query(
      `SELECT je.id, je.entry_number, je.entry_date, je.description, je.source_document_id AS document_id,
              SUM(l.debit_minor) AS total,
              MAX(COALESCE(v.org_number, lower(v.name))) AS vendor_key,
              COALESCE(ap.n, 0) AS approvals, COALESCE(ap.roles, ARRAY[]::text[]) AS approver_roles
       FROM journal_entries je
       JOIN journal_lines l ON l.entry_id = je.id
       LEFT JOIN vendors v ON v.id = l.vendor_id
       LEFT JOIN (
         SELECT journal_entry_id, COUNT(*) AS n, array_agg(approver_role) AS roles
         FROM payment_approvals WHERE organization_id = $1 GROUP BY journal_entry_id
       ) ap ON ap.journal_entry_id = je.id
       WHERE je.organization_id = $1 AND je.status = 'posted' AND je.entry_date BETWEEN $2 AND $3
         AND (l.account_number ~ '^[4-7]' OR l.vendor_id IS NOT NULL)
       GROUP BY je.id, je.entry_number, je.entry_date, je.description, je.source_document_id, ap.n, ap.roles
       HAVING SUM(l.debit_minor) >= $4 OR MAX(COALESCE(v.org_number, lower(v.name))) = ANY($5::text[])
       ORDER BY total DESC
       LIMIT 200`,
      [
        params.organizationId,
        params.fromDate,
        params.toDate,
        smallestThreshold.toString(),
        Array.from(learned.approverByVendorKey.keys()),
      ],
    )
  ).rows;

  const items: AwaitingApprovalItem[] = [];
  for (const r of rows) {
    const total = BigInt(r.total);
    const approvals = Number(r.approvals);
    const roles: string[] = (r.approver_roles ?? []).filter(Boolean);
    const vendorKey = r.vendor_key ? String(r.vendor_key).toLowerCase() : null;
    const requirements: ApprovalRequirement[] = [];

    if (total >= settings.significantThresholdMinor) {
      requirements.push({
        source: 'significant',
        requiredRole: null,
        reason: `Vesentlig betaling (over ${krLabel(settings.significantThresholdMinor)}) — krever ${settings.requiredApprovers} godkjennere.`,
        satisfied: approvals >= settings.requiredApprovers,
      });
    }
    const vendorRule = vendorKey ? learned.approverByVendorKey.get(vendorKey) : undefined;
    if (vendorRule) {
      requirements.push({
        source: 'vendor',
        requiredRole: vendorRule.requiredRole,
        reason: `Leverandøren «${vendorRule.subjectLabel}» krever godkjenning av ${ROLE_LABELS[vendorRule.requiredRole] ?? vendorRule.requiredRole}.`,
        satisfied: roles.includes(vendorRule.requiredRole),
      });
    }
    for (const t of learned.thresholds) {
      if (total >= t.thresholdMinor) {
        requirements.push({
          source: 'threshold',
          requiredRole: t.requiredRole,
          reason: `Beløp over ${krLabel(t.thresholdMinor)} krever godkjenning av ${ROLE_LABELS[t.requiredRole] ?? t.requiredRole}.`,
          satisfied: roles.includes(t.requiredRole),
        });
      }
    }

    // Ta bare med de som faktisk har et uoppfylt krav.
    if (requirements.length === 0 || requirements.every((req) => req.satisfied)) continue;
    items.push({
      journalEntryId: r.id,
      entryNumber: Number(r.entry_number),
      entryDate: typeof r.entry_date === 'string' ? r.entry_date : new Date(r.entry_date).toISOString().slice(0, 10),
      description: r.description,
      documentId: r.document_id ?? null,
      totalMinor: String(total),
      approvals,
      requiredApprovers: settings.requiredApprovers,
      requirements,
    });
  }

  return {
    requiredApprovers: settings.requiredApprovers,
    significantThresholdMinor: settings.significantThresholdMinor.toString(),
    items,
  };
}

/** Kort menneskelesbar oppsummering (gjenbrukt i varsel-tekst). */
export const krLabel = (minor: bigint | string) =>
  `${formatMinorAsKr(typeof minor === 'bigint' ? minor : BigInt(minor))} kr`;
