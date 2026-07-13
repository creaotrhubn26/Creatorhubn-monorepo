/**
 * HTTP-API for den vertikale flyten. Autorisasjon håndheves på hvert endepunkt:
 * autentisert bruker → aktivt medlemskap i organisasjonen → rettighet for handlingen.
 * Feil oversettes til HTTP-statuser ved systemgrensen; interne detaljer lekkes ikke.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { hasPermission, type Permission } from '../access/permissions.js';
import { getAccountDef, STANDARD_ACCOUNTS } from '../coa/accounts.js';
import { getVatCode, VAT_CODES } from '../coa/vat-codes.js';
import type { Db } from '../db/pool.js';
import { SandboxGmailAdapter } from '../ingestion/gmail/sandbox.js';
import { lockPeriod, reverseJournalEntry } from '../ledger/engine.js';
import {
  balanceSheet,
  generalLedger,
  incomeStatement,
  subledger,
  trialBalance,
} from '../ledger/reports.js';
import { createOrganization, ensureUser, getMembershipRole } from '../orgs/service.js';
import { DeterministicTextExtractor, type DocumentExtractor } from '../pipeline/extract.js';
import {
  approveAndPost,
  ingestFromGmail,
  processIncomingDocument,
  type PipelineDeps,
} from '../pipeline/pipeline.js';
import { DeterministicSuggestionEngine } from '../pipeline/suggest.js';
import { createBankAccount, importBankTransactions, parseBankCsv } from '../bank/import.js';
import { approveMatch, rejectMatch, suggestMatches } from '../bank/matching.js';
import { createCreditNote, createInvoiceDraft, issueInvoice } from '../invoicing/service.js';
import { buildSafTXml } from '../saft/export.js';
import { newId } from '../shared/ids.js';
import type { RuleRegister } from '../rules/register.js';
import type { ObjectStorage } from '../storage/port.js';
import { recordAuditEvent } from '../audit/audit.js';
import { withTransaction } from '../db/pool.js';
import { sha256Hex } from '../documents/service.js';
import { DomainError } from '../shared/errors.js';
import { buildTaxEstimate } from '../tax/estimate.js';
import { buildVatReport, listVatCodes } from '../vat/engine.js';
import { issueToken, resolveAuthSecret, verifyToken, type AuthTokenPayload } from './auth.js';

/** JSON-serialisering: bigint (øre) blir strenger — aldri flyttall over grensen. */
function toJson(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
}

interface AuthedRequest extends Request {
  auth?: AuthTokenPayload;
  orgRole?: string;
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export interface ApiDeps {
  db: Db;
  rules: RuleRegister;
  /** Sandbox til ekte OAuth-nøkler er på plass; status rapporteres ærlig. */
  gmailAdapterFactory?: () => SandboxGmailAdapter;
  /** Objektlager for dokumentinnhold. */
  storage?: ObjectStorage | undefined;
  /** Katalog med bygget web-UI (vite dist). Serveres statisk når satt. */
  webDistDir?: string | undefined;
  /** Uttrekksmotor (OCR eller deterministisk). Default: deterministisk tekstparser. */
  extractor?: DocumentExtractor | undefined;
  /** Faktisk OCR-tilgjengelighet, til ærlig integrasjonsstatus. */
  ocrStatus?: { tesseract: boolean; pdftotext: boolean } | undefined;
}

export function createApiServer(deps: ApiDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20mb' }));
  const secret = resolveAuthSecret();

  const pipelineDeps: PipelineDeps = {
    db: deps.db,
    rules: deps.rules,
    extractor: deps.extractor ?? new DeterministicTextExtractor(),
    suggestionEngine: new DeterministicSuggestionEngine(),
    storage: deps.storage,
  };

  // ── Autentisering ─────────────────────────────────────────────────────────
  const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const payload = token ? verifyToken(token, secret) : null;
    if (!payload) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Gyldig token kreves.' } });
      return;
    }
    req.auth = payload;
    next();
  };

  /** Autorisasjon per organisasjon: medlemskap + rettighet. Hindrer IDOR på tvers av tenants. */
  const requireOrgPermission =
    (permission: Permission) =>
    async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const orgId = req.params.orgId;
        if (!orgId || !/^[0-9a-f-]{36}$/i.test(orgId)) {
          res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Ugyldig organisasjons-ID.' } });
          return;
        }
        const role = await getMembershipRole(deps.db, orgId, req.auth!.userId);
        if (!role || !hasPermission(role, permission)) {
          // 404 ved manglende medlemskap: avslører ikke om organisasjonen finnes.
          res.status(role ? 403 : 404).json({
            error: {
              code: role ? 'FORBIDDEN' : 'NOT_FOUND',
              message: role ? 'Du mangler rettighet til denne handlingen.' : 'Ikke funnet.',
            },
          });
          return;
        }
        req.orgRole = role;
        next();
      } catch (err) {
        next(err);
      }
    };

  // ── Auth (dev) ────────────────────────────────────────────────────────────
  app.post('/api/auth/dev-login', async (req, res, next) => {
    try {
      if ((process.env.NODE_ENV ?? 'development') === 'production') {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ikke funnet.' } });
        return;
      }
      const body = z
        .object({ email: z.string().email(), displayName: z.string().min(1).max(200) })
        .parse(req.body);
      const userId = await ensureUser(deps.db, body.email, body.displayName);
      const token = issueToken({ userId, email: body.email, issuedAt: Date.now() }, secret);
      res.json({ token, userId });
    } catch (err) {
      next(err);
    }
  });

  // ── Organisasjoner ───────────────────────────────────────────────────────
  app.post('/api/organizations', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const body = z
        .object({
          name: z.string().min(1).max(200),
          orgNumber: z.string().regex(/^\d{9}$/).optional(),
          orgForm: z.enum(['ENK', 'AS', 'ANS', 'DA', 'SA', 'NUF']),
          vatStatus: z.enum(['registered', 'not_registered', 'pending']),
        })
        .parse(req.body);
      const org = await createOrganization(deps.db, {
        name: body.name,
        orgForm: body.orgForm,
        vatStatus: body.vatStatus,
        createdByUserId: req.auth!.userId,
        ...(body.orgNumber ? { orgNumber: body.orgNumber } : {}),
      });
      res.status(201).json(toJson(org));
    } catch (err) {
      next(err);
    }
  });

  // ── Kodebibliotek ────────────────────────────────────────────────────────
  app.get(
    '/api/organizations/:orgId/code-library/accounts',
    requireAuth,
    requireOrgPermission('reports.view'),
    (_req, res) => {
      res.json(toJson(STANDARD_ACCOUNTS));
    },
  );
  app.get(
    '/api/organizations/:orgId/code-library/vat-codes',
    requireAuth,
    requireOrgPermission('reports.view'),
    (_req, res) => {
      res.json(toJson(listVatCodes()));
    },
  );
  app.get(
    '/api/organizations/:orgId/code-library/accounts/:number',
    requireAuth,
    requireOrgPermission('reports.view'),
    (req, res) => {
      const def = getAccountDef(req.params.number!);
      if (!def) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ukjent konto.' } });
        return;
      }
      // Informasjonsside for koden (kodemotoren, pkt. 7 i spesifikasjonen).
      res.json(
        toJson({
          ...def,
          infoPage: {
            whatItMeans: def.plainExplanation,
            whenToUse: def.whenToUse,
            whenNotToUse: def.whenNotToUse ?? null,
            examples: def.examples,
            commonVatTreatment: def.commonVatCodes.map((c) => getVatCode(c)?.name ?? c),
            taxDeductible: def.taxDeductible ?? 'n/a',
            mayRequireCapitalization: def.capitalizationCandidate ?? false,
            commonMistakes: def.commonMistakes ?? [],
          },
        }),
      );
    },
  );

  // ── Dokumenter (opplasting/mobil) ────────────────────────────────────────
  app.post(
    '/api/organizations/:orgId/documents',
    requireAuth,
    requireOrgPermission('documents.upload'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            filename: z.string().min(1).max(300),
            mimeType: z.string().min(3).max(100),
            contentBase64: z.string().min(1),
            source: z.enum(['upload', 'mobile']).default('upload'),
          })
          .parse(req.body);
        const content = Buffer.from(body.contentBase64, 'base64');
        if (content.length === 0 || content.length > MAX_UPLOAD_BYTES) {
          res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: 'Filen er tom eller for stor (maks 15 MB).' },
          });
          return;
        }
        const vatStatus = await orgVatStatus(deps.db, req.params.orgId!);
        const result = await processIncomingDocument(pipelineDeps, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          source: body.source,
          filename: body.filename,
          mimeType: body.mimeType,
          content,
          vatStatus,
        });
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/documents',
    requireAuth,
    requireOrgPermission('documents.view'),
    async (req, res, next) => {
      try {
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const params: unknown[] = [req.params.orgId];
        let where = 'organization_id = $1';
        if (status) {
          params.push(status);
          where += ` AND status = $2`;
        }
        const result = await deps.db.query(
          `SELECT id, source, filename, mime_type, sha256, status, duplicate_of, created_at
           FROM source_documents WHERE ${where} ORDER BY created_at DESC LIMIT 200`,
          params,
        );
        res.json(toJson(result.rows));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/documents/:documentId',
    requireAuth,
    requireOrgPermission('documents.view'),
    async (req, res, next) => {
      try {
        const doc = await deps.db.query(
          `SELECT * FROM source_documents WHERE id = $1 AND organization_id = $2`,
          [req.params.documentId, req.params.orgId],
        );
        if (!doc.rowCount) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ikke funnet.' } });
          return;
        }
        const extraction = await deps.db.query(
          `SELECT * FROM extracted_document_data WHERE document_id = $1 ORDER BY extraction_version DESC LIMIT 1`,
          [req.params.documentId],
        );
        const suggestions = await deps.db.query(
          `SELECT id, suggestion, engine, status, created_at FROM posting_suggestions
           WHERE document_id = $1 ORDER BY created_at DESC`,
          [req.params.documentId],
        );
        // «Hvorfor foreslår dere dette?» — forklaring med kilder fra regelregisteret.
        const latest = suggestions.rows[0];
        const explanation = latest
          ? {
              evidence: latest.suggestion.evidence,
              assumptions: latest.suggestion.assumptions,
              missingInformation: latest.suggestion.missingInformation,
              alternatives: latest.suggestion.alternatives,
              confidence: latest.suggestion.confidence,
              rules: (latest.suggestion.ruleReferences as string[]).map((ruleId) => {
                const rule = deps.rules.getRule(ruleId);
                return {
                  ruleId,
                  shortName: rule.shortName,
                  plainExplanation: rule.plainExplanation,
                  sources: rule.sourceIds.map((sid) => {
                    const s = deps.rules.getSource(sid);
                    return { title: s.title, url: s.url, lastVerified: s.lastVerified };
                  }),
                };
              }),
            }
          : null;
        res.json(
          toJson({
            document: doc.rows[0],
            extraction: extraction.rows[0] ?? null,
            suggestions: suggestions.rows,
            explanation,
          }),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // Dokumentinnhold: kun for medlemmer med dokumenttilgang, med integritets-
  // kontroll (sha256) og audit-hendelse for hvert uthenting (bilag = sensitivt).
  app.get(
    '/api/organizations/:orgId/documents/:documentId/content',
    requireAuth,
    requireOrgPermission('documents.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        if (!deps.storage) {
          res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Objektlager er ikke konfigurert.' },
          });
          return;
        }
        const doc = await deps.db.query(
          `SELECT storage_key, sha256, filename, mime_type FROM source_documents
           WHERE id = $1 AND organization_id = $2`,
          [req.params.documentId, req.params.orgId],
        );
        if (!doc.rowCount) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ikke funnet.' } });
          return;
        }
        const stored = await deps.storage.get(doc.rows[0].storage_key);
        if (!stored) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Innholdet finnes ikke i lageret.' } });
          return;
        }
        if (sha256Hex(stored.content) !== doc.rows[0].sha256) {
          // Integritetsbrudd skal aldri serveres stille.
          res.status(409).json({
            error: { code: 'INTEGRITY_VIOLATION', message: 'Innholdet stemmer ikke med registrert hash. Kontakt administrator.' },
          });
          return;
        }
        await withTransaction(deps.db, (client) =>
          recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'document.content_accessed',
            entityType: 'source_document',
            entityId: req.params.documentId!,
          }),
        );
        res
          .set('Content-Type', doc.rows[0].mime_type)
          .set('Content-Disposition', `inline; filename="${encodeURIComponent(doc.rows[0].filename)}"`)
          .send(stored.content);
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/documents/:documentId/approve',
    requireAuth,
    requireOrgPermission('journal.post'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            suggestionId: z.string().uuid(),
            overrides: z
              .object({
                accountNumber: z.string().regex(/^\d{4}$/).optional(),
                vatCode: z.string().optional(),
                businessUsePercentage: z.number().int().min(0).max(100).optional(),
              })
              .optional(),
            exchangeRate: z
              .object({ rateDecimal: z.string().regex(/^\d+([.,]\d+)?$/), source: z.string().min(1) })
              .optional(),
            postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          })
          .parse(req.body);
        const entry = await approveAndPost(pipelineDeps, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          actorRoleVerified: true,
          documentId: req.params.documentId!,
          suggestionId: body.suggestionId,
          ...(body.overrides ? { overrides: body.overrides } : {}),
          ...(body.exchangeRate ? { exchangeRate: body.exchangeRate } : {}),
          ...(body.postingDate ? { postingDate: body.postingDate } : {}),
        });
        res.status(201).json(toJson(entry));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Gmail-import (sandbox) ───────────────────────────────────────────────
  app.post(
    '/api/organizations/:orgId/gmail/import',
    requireAuth,
    requireOrgPermission('integrations.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            labels: z.array(z.string().min(1)).max(20),
            senders: z.array(z.string()).optional(),
            afterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            beforeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          })
          .parse(req.body);
        const gmail = (deps.gmailAdapterFactory ?? (() => new SandboxGmailAdapter()))();
        const vatStatus = await orgVatStatus(deps.db, req.params.orgId!);
        const summary = await ingestFromGmail(pipelineDeps, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          gmail,
          filter: {
            labels: body.labels,
            keywords: ['invoice', 'receipt', 'kvittering', 'faktura', 'kreditnota', 'credit note'],
            ...(body.senders ? { senders: body.senders } : {}),
            ...(body.afterDate ? { afterDate: body.afterDate } : {}),
            ...(body.beforeDate ? { beforeDate: body.beforeDate } : {}),
          },
          vatStatus,
        });
        res.json(toJson({ ...summary, integrationMode: 'sandbox' }));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get('/api/integrations/status', requireAuth, (_req, res) => {
    res.json({
      gmail: {
        mode: 'sandbox',
        active: false,
        note: 'Gmail kjører mot sandbox-adapter. Ekte OAuth-tilkobling krever Google Cloud-prosjekt og klienthemmeligheter (se docs/integration-status.md).',
      },
      bank: { mode: 'manual_csv', active: true, note: 'Manuell CSV-import med deterministisk matching. Ingen PSD2-/open banking-tilkobling.' },
      ocr: deps.ocrStatus?.tesseract
        ? { mode: 'tesseract', active: true, note: `Tesseract (nor+eng) for bilder${deps.ocrStatus.pdftotext ? ', pdftotext for PDF' : ''}. Kvalitet avhenger av bildekvalitet — avvik går til kontrollkø.` }
        : { mode: 'deterministic_text', active: false, note: 'tesseract-ocr er ikke installert på verten — skannede bilder tolkes ikke. Installer tesseract-ocr + tesseract-ocr-nor.' },
      ehf: { mode: 'not_implemented', active: false },
      altinn: { mode: 'not_implemented', active: false },
    });
  });

  // ── Rapporter ────────────────────────────────────────────────────────────
  const reportQuery = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  });

  app.get(
    '/api/organizations/:orgId/reports/trial-balance',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = reportQuery.parse(req.query);
        const rows = await trialBalance(deps.db, {
          organizationId: req.params.orgId!,
          ...(q.from ? { fromDate: q.from } : {}),
          ...(q.to ? { toDate: q.to } : {}),
        });
        res.json(toJson(rows));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/reports/income-statement',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = reportQuery.parse(req.query);
        res.json(
          toJson(
            await incomeStatement(deps.db, {
              organizationId: req.params.orgId!,
              ...(q.from ? { fromDate: q.from } : {}),
              ...(q.to ? { toDate: q.to } : {}),
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/reports/balance-sheet',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = reportQuery.parse(req.query);
        res.json(
          toJson(
            await balanceSheet(deps.db, {
              organizationId: req.params.orgId!,
              ...(q.to ? { toDate: q.to } : {}),
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/reports/general-ledger',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = reportQuery
          .extend({ account: z.string().regex(/^\d{4}$/).optional() })
          .parse(req.query);
        res.json(
          toJson(
            await generalLedger(deps.db, {
              organizationId: req.params.orgId!,
              ...(q.account ? { accountNumber: q.account } : {}),
              ...(q.from ? { fromDate: q.from } : {}),
              ...(q.to ? { toDate: q.to } : {}),
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/reports/subledger/:kind',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const kind = z.enum(['vendors', 'customers']).parse(req.params.kind);
        res.json(toJson(await subledger(deps.db, req.params.orgId!, kind)));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── MVA og skatt ─────────────────────────────────────────────────────────
  app.get(
    '/api/organizations/:orgId/vat/report',
    requireAuth,
    requireOrgPermission('vat.view'),
    async (req, res, next) => {
      try {
        const q = z
          .object({
            from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          })
          .parse(req.query);
        res.json(toJson(await buildVatReport(deps.db, req.params.orgId!, q.from, q.to)));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/tax/estimate',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = z
          .object({
            from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          })
          .parse(req.query);
        const org = await deps.db.query(
          `SELECT org_form FROM organizations WHERE id = $1`,
          [req.params.orgId],
        );
        if (!org.rowCount) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ikke funnet.' } });
          return;
        }
        res.json(
          toJson(
            await buildTaxEstimate(deps.db, deps.rules, {
              organizationId: req.params.orgId!,
              orgForm: org.rows[0].org_form,
              fromDate: q.from,
              toDate: q.to,
            }),
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  // ── SAF-T-eksport ────────────────────────────────────────────────────────
  app.get(
    '/api/organizations/:orgId/saf-t',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req: AuthedRequest, res, next) => {
      try {
        const q = z
          .object({
            from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          })
          .parse(req.query);
        const xml = await buildSafTXml(deps.db, {
          organizationId: req.params.orgId!,
          fromDate: q.from,
          toDate: q.to,
        });
        // Eksport av regnskapsdata er en sensitiv hendelse — logges alltid.
        await withTransaction(deps.db, (client) =>
          recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'saf-t.exported',
            entityType: 'organization',
            entityId: req.params.orgId!,
            newValue: { from: q.from, to: q.to, bytes: Buffer.byteLength(xml) },
          }),
        );
        res
          .set('Content-Type', 'application/xml; charset=utf-8')
          .set(
            'Content-Disposition',
            `attachment; filename="saf-t_${q.from}_${q.to}.xml"`,
          )
          .send(xml);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Periodelås og korrigering ────────────────────────────────────────────
  app.post(
    '/api/organizations/:orgId/periods/:year/:month/lock',
    requireAuth,
    requireOrgPermission('period.lock'),
    async (req: AuthedRequest, res, next) => {
      try {
        const year = z.coerce.number().int().min(2000).max(2100).parse(req.params.year);
        const month = z.coerce.number().int().min(1).max(12).parse(req.params.month);
        const body = z.object({ reason: z.string().min(3).max(500) }).parse(req.body);
        await lockPeriod(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          year,
          month,
          reason: body.reason,
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/journal-entries/:entryId/reverse',
    requireAuth,
    requireOrgPermission('journal.reverse'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            reversalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            reason: z.string().min(3).max(500),
          })
          .parse(req.body);
        const entry = await reverseJournalEntry(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          entryId: req.params.entryId!,
          reversalDate: body.reversalDate,
          reason: body.reason,
        });
        res.status(201).json(toJson(entry));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Salg og faktura ──────────────────────────────────────────────────────
  app.post(
    '/api/organizations/:orgId/customers',
    requireAuth,
    requireOrgPermission('invoices.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            name: z.string().min(1).max(200),
            email: z.string().email().optional(),
            orgNumber: z.string().regex(/^\d{9}$/).optional(),
          })
          .parse(req.body);
        const id = newId();
        await withTransaction(deps.db, async (client) => {
          await client.query(
            `INSERT INTO customers (id, organization_id, name, email, org_number, created_by)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [id, req.params.orgId, body.name, body.email ?? null, body.orgNumber ?? null, req.auth!.userId],
          );
          await recordAuditEvent(client, {
            organizationId: req.params.orgId!,
            actor: { userId: req.auth!.userId, role: req.orgRole! },
            action: 'customer.created',
            entityType: 'customer',
            entityId: id,
            newValue: { name: body.name },
          });
        });
        res.status(201).json({ id });
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/customers',
    requireAuth,
    requireOrgPermission('invoices.view'),
    async (req, res, next) => {
      try {
        const rows = await deps.db.query(
          `SELECT id, name, email, org_number FROM customers
           WHERE organization_id = $1 AND status = 'active' ORDER BY name LIMIT 500`,
          [req.params.orgId],
        );
        res.json(toJson(rows.rows));
      } catch (err) {
        next(err);
      }
    },
  );

  const invoiceLineSchema = z.object({
    description: z.string().min(1).max(500),
    /** Antall i tusendeler: 1 stk = 1000. */
    quantityThousandths: z.coerce.bigint().positive(),
    /** Enhetspris i øre, eks. mva. */
    unitPriceMinor: z.coerce.bigint().nonnegative(),
    vatCode: z.string().min(1),
    revenueAccount: z.string().regex(/^\d{4}$/).optional(),
  });

  app.post(
    '/api/organizations/:orgId/invoices',
    requireAuth,
    requireOrgPermission('invoices.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            customerId: z.string().uuid(),
            lines: z.array(invoiceLineSchema).min(1).max(100),
            invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          })
          .parse(req.body);
        const draft = await createInvoiceDraft(deps.db, deps.rules, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          customerId: body.customerId,
          lines: body.lines.map((l) => ({
            description: l.description,
            quantityThousandths: l.quantityThousandths,
            unitPriceMinor: l.unitPriceMinor,
            vatCode: l.vatCode,
            ...(l.revenueAccount ? { revenueAccount: l.revenueAccount } : {}),
          })),
          ...(body.invoiceDate ? { invoiceDate: body.invoiceDate } : {}),
          ...(body.dueDate ? { dueDate: body.dueDate } : {}),
        });
        res.status(201).json(toJson(draft));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/invoices',
    requireAuth,
    requireOrgPermission('invoices.view'),
    async (req, res, next) => {
      try {
        const rows = await deps.db.query(
          `SELECT i.id, i.invoice_number, i.kind, i.status, i.invoice_date::TEXT AS invoice_date,
                  i.due_date::TEXT AS due_date, i.kid, i.net_minor, i.vat_minor, i.gross_minor,
                  i.paid_minor, c.name AS customer_name
           FROM invoices i JOIN customers c ON c.id = i.customer_id
           WHERE i.organization_id = $1
           ORDER BY i.created_at DESC LIMIT 300`,
          [req.params.orgId],
        );
        res.json(toJson(rows.rows));
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/invoices/:invoiceId/issue',
    requireAuth,
    requireOrgPermission('invoices.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({ invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
          .parse(req.body ?? {});
        const result = await issueInvoice(deps.db, deps.rules, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          invoiceId: req.params.invoiceId!,
          ...(body.invoiceDate ? { invoiceDate: body.invoiceDate } : {}),
        });
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/invoices/:invoiceId/credit',
    requireAuth,
    requireOrgPermission('invoices.manage'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z.object({ reason: z.string().min(3).max(500) }).parse(req.body);
        const result = await createCreditNote(deps.db, deps.rules, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          invoiceId: req.params.invoiceId!,
          reason: body.reason,
        });
        res.status(201).json(toJson(result));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Bilagsjournal og posteringslinjer (avansert/regnskapsførervisning) ──
  app.get(
    '/api/organizations/:orgId/journal-entries',
    requireAuth,
    requireOrgPermission('reports.view'),
    async (req, res, next) => {
      try {
        const q = reportQuery.parse(req.query);
        const params: unknown[] = [req.params.orgId];
        let dateSql = '';
        if (q.from) {
          params.push(q.from);
          dateSql += ` AND e.entry_date >= $${params.length}`;
        }
        if (q.to) {
          params.push(q.to);
          dateSql += ` AND e.entry_date <= $${params.length}`;
        }
        const entries = await deps.db.query(
          `SELECT e.id, e.entry_number, e.entry_date::TEXT AS entry_date, e.description,
                  e.status, e.source_document_id, e.reversal_of, e.posted_by, e.posted_by_role,
                  e.posted_at
           FROM journal_entries e
           WHERE e.organization_id = $1${dateSql}
           ORDER BY e.entry_number DESC
           LIMIT 300`,
          params,
        );
        const ids = entries.rows.map((r) => r.id);
        const lines = ids.length
          ? await deps.db.query(
              `SELECT entry_id, line_number, account_number, vat_code,
                      debit_minor, credit_minor, description, original_currency,
                      original_amount_minor, exchange_rate
               FROM journal_lines WHERE entry_id = ANY($1)
               ORDER BY entry_id, line_number`,
              [ids],
            )
          : { rows: [] };
        const byEntry = new Map<string, unknown[]>();
        for (const line of lines.rows) {
          const list = byEntry.get(line.entry_id) ?? [];
          list.push(line);
          byEntry.set(line.entry_id, list);
        }
        res.json(
          toJson(entries.rows.map((e) => ({ ...e, lines: byEntry.get(e.id) ?? [] }))),
        );
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/documents/:documentId/journal-entry',
    requireAuth,
    requireOrgPermission('documents.view'),
    async (req, res, next) => {
      try {
        const entry = await deps.db.query(
          `SELECT id, entry_number, entry_date::TEXT AS entry_date, description, status
           FROM journal_entries
           WHERE organization_id = $1 AND source_document_id = $2
           ORDER BY entry_number ASC LIMIT 1`,
          [req.params.orgId, req.params.documentId],
        );
        if (!entry.rowCount) {
          res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dokumentet er ikke bokført.' } });
          return;
        }
        const lines = await deps.db.query(
          `SELECT line_number, account_number, vat_code, debit_minor, credit_minor,
                  description, original_currency, original_amount_minor, exchange_rate, exchange_rate_source
           FROM journal_lines WHERE entry_id = $1 ORDER BY line_number`,
          [entry.rows[0].id],
        );
        res.json(toJson({ ...entry.rows[0], lines: lines.rows }));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Bank og avstemming ───────────────────────────────────────────────────
  app.post(
    '/api/organizations/:orgId/bank-accounts',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({
            name: z.string().min(1).max(200),
            ibanOrAccount: z.string().min(8).max(40),
            ledgerAccountNumber: z.string().regex(/^\d{4}$/).optional(),
          })
          .parse(req.body);
        const id = await createBankAccount(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          name: body.name,
          ibanOrAccount: body.ibanOrAccount,
          ...(body.ledgerAccountNumber ? { ledgerAccountNumber: body.ledgerAccountNumber } : {}),
        });
        res.status(201).json({ id });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/bank-accounts/:bankAccountId/import',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z
          .object({ csv: z.string().min(1).max(2_000_000) })
          .parse(req.body);
        const transactions = parseBankCsv(body.csv);
        const result = await importBankTransactions(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          bankAccountId: req.params.bankAccountId!,
          transactions,
        });
        // Kjør deterministisk matching rett etter import.
        const suggestions = await suggestMatches(deps.db, {
          organizationId: req.params.orgId!,
          bankAccountId: req.params.bankAccountId!,
        });
        res.status(201).json(toJson({ ...result, suggestions }));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/bank/transactions',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req, res, next) => {
      try {
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const args: unknown[] = [req.params.orgId];
        let where = 'organization_id = $1';
        if (status) {
          args.push(status);
          where += ` AND status = $2`;
        }
        const rows = await deps.db.query(
          `SELECT id, bank_account_id, external_id, booked_date::TEXT AS booked_date,
                  amount_minor, currency, description, counterparty, kid, status
           FROM bank_transactions WHERE ${where}
           ORDER BY booked_date DESC LIMIT 500`,
          args,
        );
        res.json(toJson(rows.rows));
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/organizations/:orgId/bank/matches',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req, res, next) => {
      try {
        const rows = await deps.db.query(
          `SELECT m.id, m.bank_transaction_id, m.journal_entry_id, m.source_document_id,
                  m.match_type, m.matched_amount_minor, m.explanation, m.status, m.created_at
           FROM reconciliation_matches m
           WHERE m.organization_id = $1
           ORDER BY m.created_at DESC LIMIT 200`,
          [req.params.orgId],
        );
        res.json(toJson(rows.rows));
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/bank/matches/:matchId/approve',
    requireAuth,
    requireOrgPermission('journal.post'),
    async (req: AuthedRequest, res, next) => {
      try {
        const entry = await approveMatch(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          matchId: req.params.matchId!,
        });
        res.status(201).json(toJson(entry));
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/organizations/:orgId/bank/matches/:matchId/reject',
    requireAuth,
    requireOrgPermission('bank.reconcile'),
    async (req: AuthedRequest, res, next) => {
      try {
        const body = z.object({ reason: z.string().min(3).max(500) }).parse(req.body);
        await rejectMatch(deps.db, {
          organizationId: req.params.orgId!,
          actor: { userId: req.auth!.userId, role: req.orgRole! },
          matchId: req.params.matchId!,
          reason: body.reason,
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Revisjonslogg ────────────────────────────────────────────────────────
  app.get(
    '/api/organizations/:orgId/audit-events',
    requireAuth,
    requireOrgPermission('audit.view'),
    async (req, res, next) => {
      try {
        const params: unknown[] = [req.params.orgId];
        let entitySql = '';
        if (typeof req.query.entityId === 'string' && /^[0-9a-f-]{36}$/i.test(req.query.entityId)) {
          params.push(req.query.entityId);
          entitySql = ` AND entity_id = $${params.length}`;
        }
        const rows = await deps.db.query(
          `SELECT id, actor_user_id, actor_role, action, entity_type, entity_id, reason,
                  previous_value, new_value, occurred_at
           FROM audit_events WHERE organization_id = $1${entitySql}
           ORDER BY occurred_at DESC LIMIT 500`,
          params,
        );
        res.json(toJson(rows.rows));
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Web-UI (bygget SPA) ──────────────────────────────────────────────────
  if (deps.webDistDir) {
    app.use(express.static(deps.webDistDir, { index: 'index.html' }));
    // SPA-fallback for alle ikke-API-GET-er.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile('index.html', { root: deps.webDistDir! });
    });
  }

  // ── Feilhåndtering ved systemgrensen ─────────────────────────────────────
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Ugyldig forespørsel.', details: err.issues },
      });
      return;
    }
    if (err instanceof DomainError) {
      const statusByCode: Record<string, number> = {
        VALIDATION_ERROR: 400,
        NOT_FOUND: 404,
        FORBIDDEN: 403,
        CONFLICT: 409,
        PERIOD_LOCKED: 409,
        UNBALANCED_ENTRY: 422,
        DUPLICATE: 409,
      };
      res.status(statusByCode[err.code] ?? 400).json({
        error: { code: err.code, message: err.message },
      });
      return;
    }
    // Ukjent feil: logg internt (uten sensitivt innhold), generisk svar ut.
    console.error('Uventet feil:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Intern feil.' } });
  });

  return app;
}

async function orgVatStatus(
  db: Db,
  orgId: string,
): Promise<'registered' | 'not_registered' | 'pending'> {
  const res = await db.query(`SELECT vat_status FROM organizations WHERE id = $1`, [orgId]);
  return res.rowCount ? res.rows[0].vat_status : 'not_registered';
}
