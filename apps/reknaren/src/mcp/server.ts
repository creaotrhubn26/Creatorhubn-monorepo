/**
 * Reknaren som MCP-server (Model Context Protocol). Lar en AI-klient (Claude
 * Desktop/Code, agenter) koble seg på med en API-nøkkel og få SCOPEDE verktøy
 * over regnskapet. Bygger på det samme /api/v1-datalaget og det samme
 * rettighetsvokabularet — verktøy filtreres på nøkkelens scopes.
 *
 * 🔒 Vaktregel: KUN les + forslag. Ingen verktøy bokfører eller endrer noe;
 * posteringer krever fortsatt menneskelig godkjenning i app-en. AI-en leser og
 * foreslår, mennesket bestemmer (samme prinsipp som KI-transparens-laget).
 */
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Db } from '../db/pool.js';
import type { RuleRegister } from '../rules/register.js';
import { answerQuestion } from '../ledger/ask.js';
import { buildVatReport } from '../vat/engine.js';
import { buildSafTXml } from '../saft/export.js';

export interface McpPrincipal {
  organizationId: string;
  scopes: string[];
}

export interface McpDeps {
  db: Db;
  rules: RuleRegister;
}

/** JSON-tekst som tåler bigint (pg gir BIGINT som string, men rapporter kan ha bigint). */
function jsonText(value: unknown): { content: { type: 'text'; text: string }[] } {
  const text = JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
  return { content: [{ type: 'text', text }] };
}

const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bruk ISO-dato YYYY-MM-DD');

/**
 * Bygger en MCP-server med verktøy scopet til prinsipalens rettigheter.
 * Verktøy registreres kun når nøkkelen har det nødvendige scopet.
 */
export function createReknarenMcpServer(deps: McpDeps, principal: McpPrincipal): McpServer {
  const org = principal.organizationId;
  const has = (scope: string) => principal.scopes.includes(scope);
  const server = new McpServer({ name: 'reknaren', version: '1.0.0' });

  if (has('reports.view')) {
    server.registerTool(
      'list_accounts',
      { description: 'List virksomhetens kontoplan (kontonummer, navn, aktiv).', inputSchema: {} },
      async () => {
        const rows = (await deps.db.query(`SELECT account_number, name, active FROM ledger_accounts WHERE organization_id = $1 ORDER BY account_number`, [org])).rows;
        return jsonText({ accounts: rows.map((r) => ({ accountNumber: r.account_number, name: r.name, active: r.active })) });
      },
    );

    server.registerTool(
      'list_customers',
      { description: 'List kunder (navn, org.nr, e-post, status).', inputSchema: {} },
      async () => {
        const rows = (await deps.db.query(`SELECT id, name, org_number, email, status FROM customers WHERE organization_id = $1 ORDER BY name`, [org])).rows;
        return jsonText({ customers: rows.map((r) => ({ id: r.id, name: r.name, orgNumber: r.org_number, email: r.email, status: r.status })) });
      },
    );

    server.registerTool(
      'list_suppliers',
      { description: 'List leverandører (navn, org.nr, status).', inputSchema: {} },
      async () => {
        const rows = (await deps.db.query(`SELECT id, name, org_number, status FROM vendors WHERE organization_id = $1 ORDER BY name`, [org])).rows;
        return jsonText({ suppliers: rows.map((r) => ({ id: r.id, name: r.name, orgNumber: r.org_number, status: r.status })) });
      },
    );

    server.registerTool(
      'get_journal_entries',
      {
        description: 'Hent bokførte bilag i en periode, med linjer. Datoer valgfrie.',
        inputSchema: { from: ISO_DATE.optional(), to: ISO_DATE.optional(), limit: z.number().int().min(1).max(200).optional() },
      },
      async ({ from, to, limit }) => {
        const entries = (await deps.db.query(
          `SELECT id, entry_number, entry_date::text AS entry_date, description, status
           FROM journal_entries WHERE organization_id = $1 AND entry_date BETWEEN $2 AND $3
           ORDER BY entry_number DESC LIMIT $4`,
          [org, from ?? '0001-01-01', to ?? '9999-12-31', limit ?? 50],
        )).rows;
        const ids = entries.map((e) => e.id);
        const lines = ids.length
          ? (await deps.db.query(
              `SELECT entry_id, line_number, account_number, vat_code, debit_minor, credit_minor, description, project, department
               FROM journal_lines WHERE entry_id = ANY($1) ORDER BY entry_id, line_number`, [ids])).rows
          : [];
        const byEntry = new Map<string, unknown[]>();
        for (const l of lines) {
          const arr = byEntry.get(l.entry_id as string) ?? [];
          arr.push({ lineNumber: l.line_number, accountNumber: l.account_number, vatCode: l.vat_code, debitMinor: l.debit_minor, creditMinor: l.credit_minor, description: l.description, project: l.project, department: l.department });
          byEntry.set(l.entry_id as string, arr);
        }
        return jsonText({ entries: entries.map((e) => ({ id: e.id, entryNumber: Number(e.entry_number), entryDate: e.entry_date, description: e.description, status: e.status, lines: byEntry.get(e.id) ?? [] })) });
      },
    );

    server.registerTool(
      'export_saft',
      { description: 'Eksporter SAF-T Financial 1.40 (XML) for en periode. Krever fra- og til-dato.', inputSchema: { from: ISO_DATE, to: ISO_DATE } },
      async ({ from, to }) => {
        const xml = await buildSafTXml(deps.db, { organizationId: org, fromDate: from, toDate: to });
        return { content: [{ type: 'text' as const, text: xml }] };
      },
    );

    server.registerTool(
      'ask_business',
      { description: 'Still et naturlig-språk-spørsmål om virksomheten; svaret er forankret i hovedboken med bevis.', inputSchema: { question: z.string().min(1), asOf: ISO_DATE.optional() } },
      async ({ question, asOf }) => {
        const answer = await answerQuestion(deps.db, deps.rules, { organizationId: org, question, asOf: asOf ?? new Date().toISOString().slice(0, 10) });
        return jsonText(answer);
      },
    );
  }

  if (has('invoices.view')) {
    server.registerTool(
      'list_invoices',
      { description: 'List fakturaer (nummer, status, datoer, beløp).', inputSchema: {} },
      async () => {
        const rows = (await deps.db.query(
          `SELECT id, invoice_number, status, invoice_date::text AS invoice_date, due_date::text AS due_date, currency, gross_minor, customer_id
           FROM invoices WHERE organization_id = $1 ORDER BY invoice_date DESC NULLS LAST LIMIT 200`, [org])).rows;
        return jsonText({ invoices: rows.map((r) => ({ id: r.id, invoiceNumber: r.invoice_number, status: r.status, invoiceDate: r.invoice_date, dueDate: r.due_date, currency: r.currency, grossMinor: r.gross_minor, customerId: r.customer_id })) });
      },
    );
  }

  if (has('vat.view')) {
    server.registerTool(
      'get_vat_report',
      { description: 'Hent MVA-rapport (grunnlag og avgift per kode) for en termin. Krever fra- og til-dato.', inputSchema: { from: ISO_DATE, to: ISO_DATE } },
      async ({ from, to }) => jsonText(await buildVatReport(deps.db, org, from, to)),
    );
  }

  return server;
}

/** Antall verktøy en gitt scope-mengde ville eksponert (for status/diagnose). */
export function toolCountForScopes(scopes: string[]): number {
  let n = 0;
  if (scopes.includes('reports.view')) n += 6;
  if (scopes.includes('invoices.view')) n += 1;
  if (scopes.includes('vat.view')) n += 1;
  return n;
}
