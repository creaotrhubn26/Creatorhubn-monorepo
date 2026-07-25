/**
 * MCP-server: verktøy scopes til API-nøkkelens rettigheter, kobles via en
 * in-memory-klient, og leverer ekte data fra hovedboken. 🔒 Ingen skrive-/
 * bokføringsverktøy eksponeres.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Db } from '../src/db/pool.js';
import { createReknarenMcpServer } from '../src/mcp/server.js';
import { postJournalEntry } from '../src/ledger/engine.js';
import { createOrganization, ensureUser } from '../src/orgs/service.js';
import { buildNorwegianRuleRegister } from '../src/rules/no/rules.js';
import { setupTestDb, truncateAll } from './helpers.js';

let db: Db;
let userId: string;
let orgId: string;
const rules = buildNorwegianRuleRegister();

async function connect(scopes: string[]): Promise<Client> {
  const server = createReknarenMcpServer({ db, rules }, { organizationId: orgId, scopes });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(clientT);
  return client;
}
const textOf = (r: unknown) => (((r as { content?: { type: string; text: string }[] }).content ?? [])[0]?.text ?? '');

beforeAll(async () => {
  db = await setupTestDb();
  await truncateAll();
  userId = await ensureUser(db, 'mcp@example.com', 'MCP');
  const org = await createOrganization(db, { name: 'MCP AS', orgForm: 'AS', vatStatus: 'registered', orgNumber: '910015842', createdByUserId: userId });
  orgId = org.id;
  await postJournalEntry(db, {
    organizationId: orgId,
    actor: { userId, role: 'owner' },
    entryDate: '2026-03-01',
    description: 'Kjøp av utstyr',
    idempotencyKey: 'mcp1',
    lines: [
      { accountNumber: '6551', debitMinor: 80000n, vatCode: '1' },
      { accountNumber: '2710', debitMinor: 20000n, vatCode: '1' },
      { accountNumber: '2400', creditMinor: 100000n },
    ],
  });
});
afterAll(async () => {
  await db.end();
});

describe('MCP-server', () => {
  it('eksponerer verktøy scopet til rettighetene', async () => {
    const readOnly = await connect(['reports.view']);
    const tools = (await readOnly.listTools()).tools.map((t) => t.name);
    expect(tools).toContain('list_accounts');
    expect(tools).toContain('get_journal_entries');
    expect(tools).toContain('export_saft');
    expect(tools).toContain('ask_business');
    // Uten invoices.view/vat.view er de verktøyene skjult.
    expect(tools).not.toContain('list_invoices');
    expect(tools).not.toContain('get_vat_report');
    // 🔒 Ingen skrive-/bokføringsverktøy finnes overhodet.
    expect(tools.some((t) => /post|create|approve|delete|write|update/i.test(t))).toBe(false);
    await readOnly.close();
  });

  it('flere scopes gir flere verktøy', async () => {
    const full = await connect(['reports.view', 'invoices.view', 'vat.view']);
    const tools = (await full.listTools()).tools.map((t) => t.name);
    expect(tools).toContain('list_invoices');
    expect(tools).toContain('get_vat_report');
    await full.close();
  });

  it('list_accounts returnerer ekte kontoplan', async () => {
    const c = await connect(['reports.view']);
    const res = await c.callTool({ name: 'list_accounts', arguments: {} });
    const parsed = JSON.parse(textOf(res));
    expect(parsed.accounts.some((a: { accountNumber: string }) => a.accountNumber === '6551')).toBe(true);
    await c.close();
  });

  it('get_journal_entries returnerer bokført bilag med linjer', async () => {
    const c = await connect(['reports.view']);
    const res = await c.callTool({ name: 'get_journal_entries', arguments: { from: '2026-01-01', to: '2026-12-31' } });
    const parsed = JSON.parse(textOf(res));
    expect(parsed.entries.length).toBe(1);
    expect(parsed.entries[0].lines.length).toBe(3);
    await c.close();
  });

  it('export_saft leverer SAF-T 1.40 XML', async () => {
    const c = await connect(['reports.view']);
    const res = await c.callTool({ name: 'export_saft', arguments: { from: '2026-01-01', to: '2026-12-31' } });
    expect(textOf(res)).toContain('<n1:AuditFileVersion>1.40</n1:AuditFileVersion>');
    await c.close();
  });

  it('get_vat_report krever vat.view-scopet — ikke tilgjengelig uten', async () => {
    const c = await connect(['reports.view']);
    let blocked = false;
    try {
      const r = await c.callTool({ name: 'get_vat_report', arguments: { from: '2026-01-01', to: '2026-12-31' } });
      blocked = Boolean((r as { isError?: boolean }).isError);
    } catch {
      blocked = true;
    }
    expect(blocked).toBe(true);
    await c.close();
  });
});
