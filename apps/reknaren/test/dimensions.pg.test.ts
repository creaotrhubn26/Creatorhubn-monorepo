/**
 * Kostnadsbærere mot ekte Postgres: register, validering ved bokføring,
 * prosjekt på faktura, og lønnsomhetsrapport per dimensjon.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool.js';
import {
  assertDimensionExists,
  createDimension,
  dimensionResultReport,
  listDimensions,
} from '../src/dimensions/service.js';
import { createCreditNote, createInvoiceDraft, issueInvoice } from '../src/invoicing/service.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { ConflictError, NotFoundError, ValidationError } from '../src/shared/errors.js';
import { newId } from '../src/shared/ids.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let orgId: string;
let userId: string;
let customerId: string;
const rules = buildNorwegianRuleRegister();
const actor = () => ({ userId, role: 'owner' });

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'dim@example.com', 'Dimensjonstester');
  const org = await createOrganization(db, {
    name: 'Prosjekt AS',
    orgForm: 'AS',
    vatStatus: 'registered',
    orgNumber: '910007920',
    streetAddress: 'Prosjektgata 1',
    postalCode: '5003',
    city: 'Bergen',
    createdByUserId: userId,
  });
  orgId = org.id;
  customerId = newId();
  await db.query(
    `INSERT INTO customers (id, organization_id, name, created_by) VALUES ($1,$2,'Brudeparet',$3)`,
    [customerId, orgId, userId],
  );
});

afterAll(async () => {
  await db.end();
});

describe('Dimensjonsregisteret', () => {
  it('oppretter prosjekt og avdeling; koder normaliseres til store bokstaver', async () => {
    const p = await createDimension(db, {
      organizationId: orgId,
      actor: actor(),
      kind: 'project',
      code: 'bryllup24',
      name: 'Bryllup Hansen 2024',
    });
    expect(p.code).toBe('BRYLLUP24');
    await createDimension(db, {
      organizationId: orgId,
      actor: actor(),
      kind: 'department',
      code: 'FOTO',
      name: 'Fotoavdelingen',
    });
    const projects = await listDimensions(db, orgId, 'project');
    expect(projects.map((x) => x.code)).toEqual(['BRYLLUP24']);
  });

  it('avviser duplikatkode og ugyldig kode', async () => {
    await expect(
      createDimension(db, {
        organizationId: orgId,
        actor: actor(),
        kind: 'project',
        code: 'BRYLLUP24',
        name: 'Duplikat',
      }),
    ).rejects.toThrow(ConflictError);
    await expect(
      createDimension(db, {
        organizationId: orgId,
        actor: actor(),
        kind: 'project',
        code: 'har mellomrom',
        name: 'Ugyldig',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('ukjent dimensjonskode avvises ved kontroll', async () => {
    await expect(assertDimensionExists(db, orgId, 'project', 'FINNES-IKKE')).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('Lønnsomhet per prosjekt', () => {
  it('faktura med prosjekt gir inntekt på prosjektet', async () => {
    const draft = await createInvoiceDraft(db, rules, {
      organizationId: orgId,
      actor: actor(),
      customerId,
      invoiceDate: '2025-11-10',
      lines: [
        {
          description: 'Bryllupsfotografering',
          quantityThousandths: 1000n,
          unitPriceMinor: 3000000n, // 30 000 eks. mva
          vatCode: '3',
          project: 'bryllup24',
        },
      ],
    });
    await issueInvoice(db, rules, { organizationId: orgId, actor: actor(), invoiceId: draft.id });

    const report = await dimensionResultReport(db, { organizationId: orgId, kind: 'project' });
    expect(report).toHaveLength(1);
    expect(report[0]!.code).toBe('BRYLLUP24');
    expect(report[0]!.revenueMinor).toBe(3000000n);
  });

  it('faktura med ukjent prosjektkode avvises', async () => {
    await expect(
      createInvoiceDraft(db, rules, {
        organizationId: orgId,
        actor: actor(),
        customerId,
        lines: [
          {
            description: 'x',
            quantityThousandths: 1000n,
            unitPriceMinor: 1000n,
            vatCode: '3',
            project: 'UKJENT',
          },
        ],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('kostnader med prosjekt trekker fra prosjektresultatet', async () => {
    await postJournalEntry(db, {
      organizationId: orgId,
      actor: actor(),
      entryDate: '2025-11-12',
      description: 'Leie av ekstra objektiv til bryllupet',
      idempotencyKey: 'dim-cost-1',
      lines: [
        { accountNumber: '6551', debitMinor: 500000n, vatCode: '1', project: 'BRYLLUP24' },
        { accountNumber: '2710', debitMinor: 125000n, vatCode: '1' },
        { accountNumber: '2400', creditMinor: 625000n },
      ],
    });
    const report = await dimensionResultReport(db, { organizationId: orgId, kind: 'project' });
    expect(report[0]!.revenueMinor).toBe(3000000n);
    expect(report[0]!.expenseMinor).toBe(500000n);
    expect(report[0]!.resultMinor).toBe(2500000n); // 30 000 − 5 000
  });

  it('kreditnota reverserer prosjektinntekten', async () => {
    // Ny faktura på samme prosjekt som så krediteres → nettoeffekt null.
    const draft = await createInvoiceDraft(db, rules, {
      organizationId: orgId,
      actor: actor(),
      customerId,
      invoiceDate: '2025-11-15',
      lines: [
        {
          description: 'Ekstra album',
          quantityThousandths: 1000n,
          unitPriceMinor: 200000n,
          vatCode: '3',
          project: 'BRYLLUP24',
        },
      ],
    });
    await issueInvoice(db, rules, { organizationId: orgId, actor: actor(), invoiceId: draft.id });
    await createCreditNote(db, rules, {
      organizationId: orgId,
      actor: actor(),
      invoiceId: draft.id,
      reason: 'Album ble ikke levert',
    });
    const report = await dimensionResultReport(db, { organizationId: orgId, kind: 'project' });
    expect(report[0]!.revenueMinor).toBe(3000000n); // 30 000 + 2 000 − 2 000
    expect(report[0]!.resultMinor).toBe(2500000n);
  });

  it('rapport per avdeling er adskilt fra prosjekt', async () => {
    await postJournalEntry(db, {
      organizationId: orgId,
      actor: actor(),
      entryDate: '2025-11-13',
      description: 'Avdelingskostnad',
      idempotencyKey: 'dim-dept-1',
      lines: [
        { accountNumber: '6800', debitMinor: 10000n, department: 'FOTO' },
        { accountNumber: '1920', creditMinor: 10000n },
      ],
    });
    const deptReport = await dimensionResultReport(db, { organizationId: orgId, kind: 'department' });
    expect(deptReport).toHaveLength(1);
    expect(deptReport[0]!.code).toBe('FOTO');
    expect(deptReport[0]!.expenseMinor).toBe(10000n);
  });
});
