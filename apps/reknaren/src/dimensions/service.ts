/**
 * Kostnadsbærere (prosjekt/avdeling): register, validering og
 * lønnsomhetsrapport. Dimensjonskoder på posteringslinjer valideres alltid
 * mot registeret — frie tekstverdier ville gjort rapportene upålitelige.
 */
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';
import { newId } from '../shared/ids.js';

export type DimensionKind = 'project' | 'department';

const TABLE: Record<DimensionKind, string> = { project: 'projects', department: 'departments' };

const CODE_RE = /^[A-ZÆØÅ0-9][A-ZÆØÅ0-9._-]{0,29}$/i;

export async function createDimension(
  db: Db,
  params: {
    organizationId: string;
    actor: Actor;
    kind: DimensionKind;
    code: string;
    name: string;
    description?: string;
    customerId?: string;
  },
): Promise<{ id: string; code: string }> {
  const code = params.code.trim().toUpperCase();
  if (!CODE_RE.test(code)) {
    throw new ValidationError(
      'Koden må være 1–30 tegn: bokstaver, tall, punktum, bindestrek eller understrek.',
    );
  }
  if (!params.name.trim()) throw new ValidationError('Navn er påkrevd.');
  return withTransaction(db, async (client) => {
    const table = TABLE[params.kind];
    const dupe = await client.query(
      `SELECT id FROM ${table} WHERE organization_id = $1 AND code = $2`,
      [params.organizationId, code],
    );
    if (dupe.rowCount) {
      throw new ConflictError(`Koden ${code} er allerede i bruk.`);
    }
    const id = newId();
    if (params.kind === 'project') {
      await client.query(
        `INSERT INTO projects (id, organization_id, code, name, description, customer_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          params.organizationId,
          code,
          params.name.trim(),
          params.description ?? null,
          params.customerId ?? null,
          params.actor.userId,
        ],
      );
    } else {
      await client.query(
        `INSERT INTO departments (id, organization_id, code, name, created_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [id, params.organizationId, code, params.name.trim(), params.actor.userId],
      );
    }
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: `${params.kind}.created`,
      entityType: params.kind,
      entityId: id,
      newValue: { code, name: params.name },
    });
    return { id, code };
  });
}

export async function listDimensions(
  db: Db,
  organizationId: string,
  kind: DimensionKind,
): Promise<{ id: string; code: string; name: string; status: string }[]> {
  const res = await db.query(
    `SELECT id, code, name, status FROM ${TABLE[kind]}
     WHERE organization_id = $1 ORDER BY code`,
    [organizationId],
  );
  return res.rows;
}

/** Kaster hvis en dimensjonskode ikke finnes aktiv i registeret. */
export async function assertDimensionExists(
  db: Db,
  organizationId: string,
  kind: DimensionKind,
  code: string,
): Promise<void> {
  const res = await db.query(
    `SELECT id FROM ${TABLE[kind]}
     WHERE organization_id = $1 AND code = $2 AND status = 'active'`,
    [organizationId, code],
  );
  if (!res.rowCount) {
    throw new NotFoundError(
      `${kind === 'project' ? 'Prosjektet' : 'Avdelingen'} ${code} finnes ikke. Opprett den først.`,
    );
  }
}

export interface DimensionResultRow {
  code: string;
  name: string;
  revenueMinor: bigint;
  expenseMinor: bigint;
  resultMinor: bigint;
}

/**
 * Resultat per dimensjon, deterministisk fra hovedboken:
 * inntekter (kreditsaldo på 3xxx/8xxx-inntekt) og kostnader per kode.
 */
export async function dimensionResultReport(
  db: Db,
  params: { organizationId: string; kind: DimensionKind; fromDate?: string; toDate?: string },
): Promise<DimensionResultRow[]> {
  const column = params.kind === 'project' ? 'project' : 'department';
  const args: unknown[] = [params.organizationId];
  let dateSql = '';
  if (params.fromDate) {
    args.push(params.fromDate);
    dateSql += ` AND e.entry_date >= $${args.length}`;
  }
  if (params.toDate) {
    args.push(params.toDate);
    dateSql += ` AND e.entry_date <= $${args.length}`;
  }
  const res = await db.query(
    `SELECT l.${column} AS code,
            COALESCE(d.name, l.${column}) AS name,
            COALESCE(SUM(CASE WHEN a.account_type = 'revenue' THEN l.credit_minor - l.debit_minor ELSE 0 END), 0)::TEXT AS revenue,
            COALESCE(SUM(CASE WHEN a.account_type = 'expense' THEN l.debit_minor - l.credit_minor ELSE 0 END), 0)::TEXT AS expense
     FROM journal_lines l
     JOIN journal_entries e ON e.id = l.entry_id
     LEFT JOIN ledger_accounts a
       ON a.organization_id = l.organization_id AND a.account_number = l.account_number
     LEFT JOIN ${TABLE[params.kind]} d
       ON d.organization_id = l.organization_id AND d.code = l.${column}
     WHERE l.organization_id = $1 AND l.${column} IS NOT NULL${dateSql}
     GROUP BY l.${column}, d.name
     ORDER BY l.${column}`,
    args,
  );
  return res.rows.map((r) => {
    const revenue = BigInt(r.revenue);
    const expense = BigInt(r.expense);
    return {
      code: r.code,
      name: r.name,
      revenueMinor: revenue,
      expenseMinor: expense,
      resultMinor: revenue - expense,
    };
  });
}
