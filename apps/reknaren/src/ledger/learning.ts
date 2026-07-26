/**
 * Lærende regnskapsmodell per virksomhet. Systemet lærer bedriftens EGEN praksis
 * (leverandør→konto, kunde→prosjekt, godkjenningskrav) fra historikken og
 * foreslår regler — men gjør dem aldri til universell sannhet: alt er scopet til
 * én virksomhet eller ett konsern. Et menneske godkjenner før en regel blir
 * aktiv, og hver regel er fullt sporbar: hva den lærte, hvilke eksempler den
 * bygger på, hvem som godkjente den, når den sist ble endret, og om den gjelder
 * én bedrift eller hele konsernet.
 *
 * Skilt fra det universelle regelregisteret (src/rules/no/ = norsk lovverk).
 * Deteksjon er ren lesing; alt som endrer noe har revisjonsspor.
 */
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import { getAccountDef } from '../coa/accounts.js';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { formatMinorAsKr } from '../invoicing/view.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';
import { newId } from '../shared/ids.js';

export type LearnedRuleType = 'account_mapping' | 'project_mapping' | 'approver_requirement' | 'threshold_approval' | 'recurring_expectation';
export type LearnedRuleScope = 'organization' | 'group';
export type LearnedRuleStatus = 'suggested' | 'active' | 'dismissed' | 'superseded';

export const KNOWN_ROLES = [
  'owner',
  'admin',
  'general_manager',
  'accounting_manager',
  'accountant',
  'attestant',
  'approver',
  'employee',
] as const;

/** Menneskelesbare rollenavn for godkjenningskrav. */
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Eier',
  admin: 'Administrator',
  general_manager: 'Daglig leder',
  accounting_manager: 'Økonomiansvarlig',
  accountant: 'Regnskapsfører',
  attestant: 'Attestant',
  approver: 'Prosjektleder/godkjenner',
  employee: 'Ansatt',
};

export interface LearnedRuleExample {
  entryNumber: number | null;
  documentId: string | null;
  description: string;
  occurredAt: string | null;
}

export interface LearnedRule {
  id: string;
  ruleType: LearnedRuleType;
  scope: LearnedRuleScope;
  scopeLabel: string; // «Denne virksomheten» | «Konsern: <navn>»
  subjectType: 'vendor' | 'customer' | 'amount';
  subjectKey: string | null;
  subjectLabel: string;
  target: Record<string, unknown>;
  targetLabel: string; // menneskelesbart utfall
  status: LearnedRuleStatus;
  supportCount: number;
  observationCount: number;
  rationale: string;
  origin: 'system' | 'manual';
  approvedBy: string | null; // navn
  approvedAt: string | null;
  updatedAt: string;
  examples: LearnedRuleExample[];
}

const MIN_SUPPORT = 3; // minst tre observasjoner før vi foreslår
const MIN_SHARE = 0.6; // minst 60 % av gangene

function targetLabel(ruleType: LearnedRuleType, target: Record<string, unknown>): string {
  if (ruleType === 'account_mapping') {
    const acc = String(target.accountNumber ?? '');
    const def = getAccountDef(acc);
    return `Konto ${acc}${def ? ` — ${def.name}` : ''}${target.vatCode ? ` (mva ${target.vatCode})` : ''}`;
  }
  if (ruleType === 'project_mapping') return `Prosjekt ${String(target.project ?? '')}`;
  if (ruleType === 'approver_requirement') return `Må godkjennes av ${ROLE_LABELS[String(target.requiredRole)] ?? target.requiredRole}`;
  if (ruleType === 'threshold_approval')
    return `Over ${formatMinorAsKr(BigInt(String(target.thresholdMinor ?? '0')))} kr → ${ROLE_LABELS[String(target.requiredRole)] ?? target.requiredRole}`;
  if (ruleType === 'recurring_expectation') {
    const cad = { monthly: 'månedlig', quarterly: 'kvartalsvis', yearly: 'årlig' }[String(target.cadence)] ?? '';
    return `Fast ${cad} ~${formatMinorAsKr(BigInt(String(target.expectedAmountMinor ?? '0')))} kr`;
  }
  return '';
}

/* ── Deteksjon: lær av historikken (ren lesing → foreslår regler) ─────────── */

export interface DetectResult {
  proposed: number;
  byType: Record<string, number>;
}

export async function detectLearnedRules(db: Db, params: { organizationId: string }): Promise<DetectResult> {
  const org = params.organizationId;
  const byType: Record<string, number> = {};
  let proposed = 0;

  // Leverandør → konto: dominant kostnadskonto per leverandør.
  const accountRows = (
    await db.query(
      `WITH lines AS (
         SELECT l.vendor_id, l.account_number, l.vat_code
         FROM journal_lines l JOIN journal_entries je ON je.id = l.entry_id
         WHERE je.organization_id = $1 AND je.status = 'posted'
           AND l.vendor_id IS NOT NULL AND l.debit_minor > 0 AND l.account_number ~ '^[4-7]'
       ),
       per AS (
         SELECT vendor_id, account_number, COUNT(*) AS n,
                mode() WITHIN GROUP (ORDER BY vat_code) AS vat_code
         FROM lines GROUP BY vendor_id, account_number
       ),
       tot AS (SELECT vendor_id, SUM(n) AS total FROM per GROUP BY vendor_id),
       ranked AS (
         SELECT p.*, t.total, row_number() OVER (PARTITION BY p.vendor_id ORDER BY p.n DESC) AS rnk
         FROM per p JOIN tot t ON t.vendor_id = p.vendor_id
       )
       SELECT r.vendor_id, r.account_number, r.vat_code, r.n, r.total,
              v.name AS vendor_name, v.org_number
       FROM ranked r JOIN vendors v ON v.id = r.vendor_id
       WHERE r.rnk = 1 AND r.total >= $2 AND r.n::numeric / r.total >= $3`,
      [org, MIN_SUPPORT, MIN_SHARE],
    )
  ).rows;

  for (const r of accountRows) {
    const subjectKey = (r.org_number || String(r.vendor_name).toLowerCase()).trim();
    const def = getAccountDef(r.account_number);
    const target: Record<string, unknown> = { accountNumber: r.account_number };
    if (r.vat_code) target.vatCode = r.vat_code;
    const rationale = `${r.vendor_name} ble ført mot «${def?.name ?? r.account_number}» (konto ${r.account_number}) i ${r.n} av ${r.total} bokførte bilag.`;
    const created = await insertSuggestion(db, {
      org,
      ruleType: 'account_mapping',
      subjectType: 'vendor',
      subjectKey,
      subjectLabel: r.vendor_name,
      target,
      support: Number(r.n),
      observations: Number(r.total),
      rationale,
    });
    if (created) {
      proposed++;
      byType.account_mapping = (byType.account_mapping ?? 0) + 1;
      await captureVendorAccountExamples(db, created, org, r.vendor_id, r.account_number);
    }
  }

  // Kunde → prosjekt: dominant prosjekt per kunde på bokførte linjer.
  const projectRows = (
    await db.query(
      `WITH lines AS (
         SELECT l.customer_id, l.project
         FROM journal_lines l JOIN journal_entries je ON je.id = l.entry_id
         WHERE je.organization_id = $1 AND je.status = 'posted'
           AND l.customer_id IS NOT NULL AND l.project IS NOT NULL
       ),
       per AS (SELECT customer_id, project, COUNT(*) AS n FROM lines GROUP BY customer_id, project),
       tot AS (SELECT customer_id, SUM(n) AS total FROM per GROUP BY customer_id),
       ranked AS (
         SELECT p.*, t.total, row_number() OVER (PARTITION BY p.customer_id ORDER BY p.n DESC) AS rnk
         FROM per p JOIN tot t ON t.customer_id = p.customer_id
       )
       SELECT r.customer_id, r.project, r.n, r.total, c.name AS customer_name
       FROM ranked r JOIN customers c ON c.id = r.customer_id
       WHERE r.rnk = 1 AND r.total >= $2 AND r.n::numeric / r.total >= $3`,
      [org, MIN_SUPPORT, MIN_SHARE],
    )
  ).rows;

  for (const r of projectRows) {
    const rationale = `${r.customer_name} ble knyttet til prosjekt ${r.project} i ${r.n} av ${r.total} bokførte linjer.`;
    const created = await insertSuggestion(db, {
      org,
      ruleType: 'project_mapping',
      subjectType: 'customer',
      subjectKey: String(r.customer_id),
      subjectLabel: r.customer_name,
      target: { project: r.project },
      support: Number(r.n),
      observations: Number(r.total),
      rationale,
    });
    if (created) {
      proposed++;
      byType.project_mapping = (byType.project_mapping ?? 0) + 1;
    }
  }

  return { proposed, byType };
}

/** Insert kun hvis subjektet ikke allerede har en regel (respekter menneskets valg). */
async function insertSuggestion(
  db: Db,
  p: {
    org: string;
    ruleType: LearnedRuleType;
    subjectType: 'vendor' | 'customer' | 'amount';
    subjectKey: string;
    subjectLabel: string;
    target: Record<string, unknown>;
    support: number;
    observations: number;
    rationale: string;
  },
): Promise<string | null> {
  const id = newId();
  const res = await db.query(
    `INSERT INTO learned_rules
       (id, organization_id, scope, rule_type, subject_type, subject_key, subject_label, target,
        status, support_count, observation_count, rationale, created_by)
     VALUES ($1,$2,'organization',$3,$4,$5,$6,$7,'suggested',$8,$9,$10, NULL)
     ON CONFLICT ((COALESCE(group_id, organization_id)), rule_type, subject_type, COALESCE(subject_key, ''))
     DO NOTHING`,
    [id, p.org, p.ruleType, p.subjectType, p.subjectKey, p.subjectLabel, JSON.stringify(p.target), p.support, p.observations, p.rationale],
  );
  return res.rowCount ? id : null;
}

async function captureVendorAccountExamples(db: Db, ruleId: string, org: string, vendorId: string, account: string): Promise<void> {
  const rows = (
    await db.query(
      `SELECT DISTINCT je.id, je.entry_number, je.entry_date::text AS entry_date, je.source_document_id
       FROM journal_lines l JOIN journal_entries je ON je.id = l.entry_id
       WHERE je.organization_id = $1 AND l.vendor_id = $2 AND l.account_number = $3 AND je.status = 'posted'
       ORDER BY je.entry_number DESC LIMIT 5`,
      [org, vendorId, account],
    )
  ).rows;
  for (const r of rows) {
    await db.query(
      `INSERT INTO learned_rule_examples (id, rule_id, organization_id, journal_entry_id, document_id, entry_number, description, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [newId(), ruleId, org, r.id, r.source_document_id ?? null, r.entry_number, `Bilag ${r.entry_number} (${r.entry_date})`, r.entry_date],
    );
  }
}

/* ── Listing med full sporbarhet ─────────────────────────────────────────── */

export async function listLearnedRules(db: Db, params: { organizationId: string }): Promise<{
  groupId: string | null;
  groupName: string | null;
  rules: LearnedRule[];
}> {
  const org = params.organizationId;
  const orgRow = (
    await db.query(
      `SELECT o.group_id, g.name AS group_name FROM organizations o
       LEFT JOIN organization_groups g ON g.id = o.group_id WHERE o.id = $1`,
      [org],
    )
  ).rows[0];
  const groupId = orgRow?.group_id ?? null;

  const rows = (
    await db.query(
      `SELECT lr.*, u.display_name AS approved_by_name, g.name AS group_name
       FROM learned_rules lr
       LEFT JOIN users u ON u.id = lr.approved_by
       LEFT JOIN organization_groups g ON g.id = lr.group_id
       WHERE (lr.scope = 'organization' AND lr.organization_id = $1)
          OR (lr.scope = 'group' AND lr.group_id = $2)
       ORDER BY (lr.status = 'suggested') DESC, lr.rule_type, lr.subject_label`,
      [org, groupId],
    )
  ).rows;

  const rules: LearnedRule[] = [];
  for (const r of rows) {
    const examples = (
      await db.query(
        `SELECT entry_number, document_id, description, occurred_at::text AS occurred_at
         FROM learned_rule_examples WHERE rule_id = $1 ORDER BY occurred_at DESC NULLS LAST LIMIT 5`,
        [r.id],
      )
    ).rows;
    const target = typeof r.target === 'string' ? JSON.parse(r.target) : r.target;
    rules.push({
      id: r.id,
      ruleType: r.rule_type,
      scope: r.scope,
      scopeLabel: r.scope === 'group' ? `Konsern: ${r.group_name ?? ''}`.trim() : 'Denne virksomheten',
      subjectType: r.subject_type,
      subjectKey: r.subject_key,
      subjectLabel: r.subject_label,
      target,
      targetLabel: targetLabel(r.rule_type, target),
      status: r.status,
      supportCount: Number(r.support_count),
      observationCount: Number(r.observation_count),
      rationale: r.rationale,
      origin: r.created_by ? 'manual' : 'system',
      approvedBy: r.approved_by_name ?? null,
      approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : null,
      updatedAt: new Date(r.updated_at).toISOString(),
      examples: examples.map((e) => ({
        entryNumber: e.entry_number != null ? Number(e.entry_number) : null,
        documentId: e.document_id ?? null,
        description: e.description,
        occurredAt: e.occurred_at ?? null,
      })),
    });
  }
  return { groupId, groupName: orgRow?.group_name ?? null, rules };
}

/* ── Oppslag: aktive regler som gjelder (virksomhet + konsern) ────────────── */

export interface ResolvedLearned {
  accountNumber?: string;
  vatCode?: string;
  project?: string;
  /** Godkjenningskrav som gjelder betalingen. */
  approverRequirements: { ruleId: string; requiredRole: string; reason: string }[];
}

export async function resolveLearnedDefaults(
  db: Db,
  params: { organizationId: string; vendorKey?: string | null; customerKey?: string | null; amountMinor?: bigint },
): Promise<ResolvedLearned> {
  const org = params.organizationId;
  const groupId = (await db.query(`SELECT group_id FROM organizations WHERE id = $1`, [org])).rows[0]?.group_id ?? null;
  const rows = (
    await db.query(
      `SELECT id, scope, rule_type, subject_type, subject_key, subject_label, target
       FROM learned_rules
       WHERE status = 'active'
         AND ( (scope = 'organization' AND organization_id = $1)
            OR (scope = 'group' AND group_id = $2) )`,
      [org, groupId],
    )
  ).rows.map((r) => ({ ...r, target: typeof r.target === 'string' ? JSON.parse(r.target) : r.target }));

  // Virksomhets-regel vinner over konsern-regel for samme subjekt.
  const best = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const k = `${r.rule_type}:${r.subject_type}:${r.subject_key ?? ''}`;
    const prev = best.get(k);
    if (!prev || (prev.scope === 'group' && r.scope === 'organization')) best.set(k, r);
  }

  const out: ResolvedLearned = { approverRequirements: [] };
  const vkey = params.vendorKey?.trim().toLowerCase();
  for (const r of best.values()) {
    if (r.rule_type === 'account_mapping' && r.subject_type === 'vendor' && matchKey(r.subject_key, params.vendorKey)) {
      out.accountNumber = String(r.target.accountNumber);
      if (r.target.vatCode) out.vatCode = String(r.target.vatCode);
    }
    if (r.rule_type === 'project_mapping' && matchKey(r.subject_key, r.subject_type === 'customer' ? params.customerKey : params.vendorKey)) {
      out.project = String(r.target.project);
    }
    if (r.rule_type === 'approver_requirement' && r.subject_type === 'vendor' && matchKey(r.subject_key, params.vendorKey)) {
      out.approverRequirements.push({ ruleId: r.id, requiredRole: String(r.target.requiredRole), reason: `Leverandøren «${r.subject_label}» krever godkjenning av ${ROLE_LABELS[String(r.target.requiredRole)] ?? r.target.requiredRole}.` });
    }
    if (r.rule_type === 'threshold_approval' && params.amountMinor != null && params.amountMinor >= BigInt(String(r.target.thresholdMinor ?? '0'))) {
      out.approverRequirements.push({ ruleId: r.id, requiredRole: String(r.target.requiredRole), reason: `Beløp over ${formatMinorAsKr(BigInt(String(r.target.thresholdMinor)))} kr krever godkjenning av ${ROLE_LABELS[String(r.target.requiredRole)] ?? r.target.requiredRole}.` });
    }
    void vkey;
  }
  return out;
}

export interface ActiveApprovalRules {
  approverByVendorKey: Map<string, { ruleId: string; requiredRole: string; subjectLabel: string }>;
  thresholds: { ruleId: string; thresholdMinor: bigint; requiredRole: string }[];
}

/** Aktive godkjenningsregler (leverandør + beløp) som gjelder virksomheten,
 *  hentet én gang for effektiv evaluering i betalingskontrollen. */
export async function getActiveApprovalRules(db: Db, organizationId: string): Promise<ActiveApprovalRules> {
  const groupId = (await db.query(`SELECT group_id FROM organizations WHERE id = $1`, [organizationId])).rows[0]?.group_id ?? null;
  const rows = (
    await db.query(
      `SELECT id, scope, rule_type, subject_key, subject_label, target FROM learned_rules
       WHERE status = 'active' AND rule_type IN ('approver_requirement','threshold_approval')
         AND ( (scope = 'organization' AND organization_id = $1) OR (scope = 'group' AND group_id = $2) )`,
      [organizationId, groupId],
    )
  ).rows.map((r) => ({ ...r, target: typeof r.target === 'string' ? JSON.parse(r.target) : r.target }));
  const approverByVendorKey = new Map<string, { ruleId: string; requiredRole: string; subjectLabel: string }>();
  const thresholds: ActiveApprovalRules['thresholds'] = [];
  for (const r of rows) {
    if (r.rule_type === 'approver_requirement' && r.subject_key) {
      approverByVendorKey.set(String(r.subject_key).toLowerCase(), { ruleId: r.id, requiredRole: String(r.target.requiredRole), subjectLabel: r.subject_label });
    } else if (r.rule_type === 'threshold_approval') {
      thresholds.push({ ruleId: r.id, thresholdMinor: BigInt(String(r.target.thresholdMinor ?? '0')), requiredRole: String(r.target.requiredRole) });
    }
  }
  return { approverByVendorKey, thresholds };
}

function matchKey(subjectKey: string | null, candidate?: string | null): boolean {
  if (!subjectKey || !candidate) return false;
  return subjectKey.trim().toLowerCase() === candidate.trim().toLowerCase();
}

/* ── Menneskets vedtak: godkjenn / avvis / opprett / endre ────────────────── */

async function loadRule(db: Db, org: string, ruleId: string) {
  const r = (
    await db.query(
      `SELECT * FROM learned_rules WHERE id = $1 AND (organization_id = $2 OR group_id = (SELECT group_id FROM organizations WHERE id = $2))`,
      [ruleId, org],
    )
  ).rows[0];
  if (!r) throw new NotFoundError('Regelen finnes ikke.');
  return r;
}

export async function approveLearnedRule(db: Db, params: { organizationId: string; actor: Actor; ruleId: string }): Promise<void> {
  await withTransaction(db, async (client) => {
    const rule = await loadRule(client as unknown as Db, params.organizationId, params.ruleId);
    if (rule.status === 'active') return;
    await client.query(
      `UPDATE learned_rules SET status = 'active', approved_by = $2, approved_at = now(), updated_at = now() WHERE id = $1`,
      [params.ruleId, params.actor.userId],
    );
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'learned_rule.approved',
      entityType: 'learned_rule',
      entityId: params.ruleId,
      newValue: { ruleType: rule.rule_type, subject: rule.subject_label },
    });
  });
}

export async function dismissLearnedRule(db: Db, params: { organizationId: string; actor: Actor; ruleId: string }): Promise<void> {
  await withTransaction(db, async (client) => {
    const rule = await loadRule(client as unknown as Db, params.organizationId, params.ruleId);
    await client.query(`UPDATE learned_rules SET status = 'dismissed', updated_at = now() WHERE id = $1`, [params.ruleId]);
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'learned_rule.dismissed',
      entityType: 'learned_rule',
      entityId: params.ruleId,
      newValue: { ruleType: rule.rule_type, subject: rule.subject_label },
    });
  });
}

export interface CreateLearnedRuleInput {
  organizationId: string;
  actor: Actor;
  ruleType: LearnedRuleType;
  subjectType: 'vendor' | 'customer' | 'amount';
  subjectKey?: string | null;
  subjectLabel: string;
  target: Record<string, unknown>;
  scope?: LearnedRuleScope;
}

export async function createLearnedRule(db: Db, input: CreateLearnedRuleInput): Promise<{ id: string }> {
  validateTarget(input.ruleType, input.target);
  const id = newId();
  const groupId = input.scope === 'group' ? await requireGroup(db, input.organizationId) : null;
  const rationale =
    input.ruleType === 'threshold_approval'
      ? `Manuell regel: ${targetLabel(input.ruleType, input.target)}.`
      : `Manuell regel opprettet for ${input.subjectLabel}: ${targetLabel(input.ruleType, input.target)}.`;
  try {
    await withTransaction(db, async (client) => {
      await client.query(
        `INSERT INTO learned_rules
           (id, organization_id, group_id, scope, rule_type, subject_type, subject_key, subject_label, target,
            status, support_count, observation_count, rationale, created_by, approved_by, approved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',0,0,$10,$11,$11, now())`,
        [id, input.organizationId, groupId, input.scope ?? 'organization', input.ruleType, input.subjectType, input.subjectKey ?? null, input.subjectLabel, JSON.stringify(input.target), rationale, input.actor.userId],
      );
      await recordAuditEvent(client, {
        organizationId: input.organizationId,
        actor: input.actor,
        action: 'learned_rule.created',
        entityType: 'learned_rule',
        entityId: id,
        newValue: { ruleType: input.ruleType, subject: input.subjectLabel, scope: input.scope ?? 'organization' },
      });
    });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') throw new ConflictError('Det finnes allerede en regel for dette subjektet.');
    throw err;
  }
  return { id };
}

export async function updateLearnedRule(db: Db, params: { organizationId: string; actor: Actor; ruleId: string; target?: Record<string, unknown>; scope?: LearnedRuleScope }): Promise<void> {
  await withTransaction(db, async (client) => {
    const rule = await loadRule(client as unknown as Db, params.organizationId, params.ruleId);
    const target = params.target ?? (typeof rule.target === 'string' ? JSON.parse(rule.target) : rule.target);
    if (params.target) validateTarget(rule.rule_type, target);
    let groupId = rule.group_id;
    let scope = rule.scope;
    if (params.scope && params.scope !== rule.scope) {
      scope = params.scope;
      groupId = params.scope === 'group' ? await requireGroup(client as unknown as Db, params.organizationId) : null;
    }
    await client.query(
      `UPDATE learned_rules SET target = $2, scope = $3, group_id = $4, updated_at = now() WHERE id = $1`,
      [params.ruleId, JSON.stringify(target), scope, groupId],
    );
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'learned_rule.updated',
      entityType: 'learned_rule',
      entityId: params.ruleId,
      newValue: { target, scope },
    });
  });
}

function validateTarget(ruleType: LearnedRuleType, target: Record<string, unknown>): void {
  if (ruleType === 'account_mapping') {
    const acc = String(target.accountNumber ?? '');
    if (!/^\d{4}$/.test(acc) || !getAccountDef(acc)) throw new ValidationError('Ugyldig konto.');
  } else if (ruleType === 'project_mapping') {
    if (!String(target.project ?? '').trim()) throw new ValidationError('Prosjekt mangler.');
  } else if (ruleType === 'approver_requirement') {
    if (!KNOWN_ROLES.includes(String(target.requiredRole) as (typeof KNOWN_ROLES)[number])) throw new ValidationError('Ukjent rolle.');
  } else if (ruleType === 'threshold_approval') {
    if (!KNOWN_ROLES.includes(String(target.requiredRole) as (typeof KNOWN_ROLES)[number])) throw new ValidationError('Ukjent rolle.');
    if (BigInt(String(target.thresholdMinor ?? '0')) <= 0n) throw new ValidationError('Beløpsgrense må være positiv.');
  } else if (ruleType === 'recurring_expectation') {
    if (!['monthly', 'quarterly', 'yearly'].includes(String(target.cadence))) throw new ValidationError('Ugyldig kadens.');
    if (BigInt(String(target.expectedAmountMinor ?? '0')) <= 0n) throw new ValidationError('Forventet beløp må være positivt.');
  }
}

/* ── Konsern ──────────────────────────────────────────────────────────────── */

async function requireGroup(db: Db, org: string): Promise<string> {
  const g = (await db.query(`SELECT group_id FROM organizations WHERE id = $1`, [org])).rows[0]?.group_id;
  if (!g) throw new ValidationError('Virksomheten er ikke del av et konsern. Opprett/tilknytt et konsern først.');
  return g;
}

export async function createOrganizationGroup(db: Db, params: { organizationId: string; actor: Actor; name: string }): Promise<{ id: string }> {
  if (!params.name.trim()) throw new ValidationError('Konsernnavn mangler.');
  const id = newId();
  await withTransaction(db, async (client) => {
    await client.query(`INSERT INTO organization_groups (id, name, created_by) VALUES ($1,$2,$3)`, [id, params.name.trim(), params.actor.userId]);
    await client.query(`UPDATE organizations SET group_id = $1 WHERE id = $2`, [id, params.organizationId]);
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'organization_group.created',
      entityType: 'organization_group',
      entityId: id,
      newValue: { name: params.name.trim() },
    });
  });
  return { id };
}
