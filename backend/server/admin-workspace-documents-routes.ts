/**
 * Internt dokumentsystem for Admin Workspace.
 *
 * Dokumenter her er tenant-eide arbeidsdokumenter for adminarbeid. Rutene
 * tilbyr eksplisitte versjoner, myk sletting, vedlegg og verifiserte koblinger
 * til arbeidsobjekter som allerede finnes i Admin Workspace.
 */

import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import multer from "multer";
import PDFDocument from "pdfkit";
import {
  AlignmentType,
  Document as WordDocument,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table as WordTable,
  TableCell as WordTableCell,
  TableRow as WordTableRow,
  TextRun,
  WidthType,
} from "docx";
import type { AdminRoomRoutesDeps } from "./_shared";
import { asString, readStringArray } from "./_shared";
import { indexAdminDocumentFile } from "./admin-document-context-service";

const VALID_PRODUCTS = new Set(["role_room", "leadgrid"]);
const VALID_TYPES = new Set([
  "funding_application",
  "strategy_memo",
  "decision_note",
  "meeting_note",
  "market_analysis",
  "sales_proposal",
  "partnership_proposal",
  "agreement",
  "report",
  "playbook",
  "cv",
  "other",
]);
const VALID_STATUSES = new Set(["draft", "in_review", "approved", "sent", "signed", "archived"]);
const VALID_SOURCES = new Set(["workspace", "google_drive", "external"]);
const ALL_LINK_TYPES = [
  "workspace_project",
  "workspace_case",
  "funding_app",
  "industry_target",
  "leadgrid_lead",
  "investor",
  "partner",
] as const;
const VALID_LINK_TYPES = new Set<string>(ALL_LINK_TYPES);
const MAX_DOCUMENT_LENGTH = 1_000_000;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
]);

type LinkType = (typeof ALL_LINK_TYPES)[number];

interface LinkOption {
  entity_type: LinkType;
  entity_id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  due_date: string | null;
  last_activity_at: string | null;
}

function hasOwn(source: unknown, key: string): boolean {
  return Boolean(source && typeof source === "object" && Object.prototype.hasOwnProperty.call(source, key));
}

function stringValue(value: unknown, max: number, allowEmpty = false): string | null {
  if (typeof value !== "string") return null;
  const result = allowEmpty ? value : value.trim();
  if (!allowEmpty && !result) return null;
  return result.slice(0, max);
}

function validDate(value: unknown): string | null {
  if (value === null || value === "") return null;
  const date = asString(value);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

function validHttpUrl(value: unknown): string | null {
  const raw = stringValue(value, 2_000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizedTags(value: unknown): string[] {
  return [...new Set(
    readStringArray(value)
      .map((tag) => tag.trim().slice(0, 60))
      .filter(Boolean),
  )].slice(0, 30);
}

function productFromBody(value: unknown): string | null | undefined {
  if (value === null || value === "" || value === "internal") return null;
  if (typeof value === "string" && VALID_PRODUCTS.has(value)) return value;
  return undefined;
}

function linkTypesForProduct(productKey: string | null): LinkType[] {
  const shared: LinkType[] = [
    "workspace_project",
    "workspace_case",
    "funding_app",
    "investor",
    "partner",
  ];
  if (productKey === "role_room") return [...shared, "industry_target"];
  if (productKey === "leadgrid") return [...shared, "leadgrid_lead"];
  return [...ALL_LINK_TYPES];
}

async function fetchLinkOptions(
  pool: Pool,
  userId: string,
  types: readonly LinkType[] = ALL_LINK_TYPES,
): Promise<LinkOption[]> {
  const sources: Record<LinkType, string> = {
    workspace_project: `
      SELECT 'workspace_project'::text AS entity_type, id::text AS entity_id,
             title::text,
             CASE product_key
               WHEN 'role_room' THEN 'The Role Room'
               WHEN 'leadgrid' THEN 'Leadgrid'
               ELSE 'Creatorhub / internt'
             END::text AS subtitle,
             status::text, target_date::text AS due_date,
             updated_at::text AS last_activity_at
        FROM admin_workspace_projects
       WHERE user_id::text = $1`,
    workspace_case: `
      SELECT 'workspace_case'::text AS entity_type, id::text AS entity_id,
             title::text, NULL::text AS subtitle,
             status::text, due_date::text,
             updated_at::text AS last_activity_at
        FROM admin_workspace_cases
       WHERE user_id::text = $1`,
    funding_app: `
      SELECT 'funding_app'::text AS entity_type, id::text AS entity_id,
             project_name::text AS title,
             concat_ws(' · ', scheme_label, contact_person)::text AS subtitle,
             status::text, deadline::text AS due_date,
             updated_at::text AS last_activity_at
        FROM admin_funding_apps
       WHERE user_id::text = $1`,
    industry_target: `
      SELECT 'industry_target'::text AS entity_type, id::text AS entity_id,
             full_name::text AS title,
             concat_ws(' · ', role_title, company)::text AS subtitle,
             status::text, next_action_due::text AS due_date,
             last_engaged_at::text AS last_activity_at
        FROM role_room_industry_targets
       WHERE user_id::text = $1`,
    leadgrid_lead: `
      SELECT 'leadgrid_lead'::text AS entity_type, id::text AS entity_id,
             COALESCE(NULLIF(company, ''), NULLIF(name, ''), 'Navnløs lead')::text AS title,
             concat_ws(' · ', NULLIF(name, ''), NULLIF(city, ''), NULLIF(lead_category, ''))::text AS subtitle,
             lead_status::text AS status,
             next_follow_up_at::date::text AS due_date,
             COALESCE(last_visit_at, updated_at)::text AS last_activity_at
        FROM crm_customers
       WHERE owner_user_id::text = $1
         AND agent_config_id IS NULL
         AND archived_at IS NULL
         AND (draft_status IS NULL OR draft_status = 'lead')`,
    investor: `
      SELECT 'investor'::text AS entity_type, id::text AS entity_id,
             company_name::text AS title,
             contact_name::text AS subtitle,
             status::text, next_step_due::text AS due_date,
             last_contact_at::text AS last_activity_at
        FROM admin_investor_contacts
       WHERE user_id::text = $1`,
    partner: `
      SELECT 'partner'::text AS entity_type, id::text AS entity_id,
             company_name::text AS title,
             contact_name::text AS subtitle,
             status::text, next_step_due::text AS due_date,
             updated_at::text AS last_activity_at
        FROM admin_partner_contacts
       WHERE user_id::text = $1`,
  };

  const results = await Promise.all(types.map((type) => pool.query(sources[type], [userId])));
  return results
    .flatMap((result) => result.rows as LinkOption[])
    .sort((a, b) => a.title.localeCompare(b.title, "nb"));
}

async function userOwnsLinkedEntity(
  pool: Pool,
  userId: string,
  entityType: LinkType,
  entityId: string,
): Promise<boolean> {
  const queries: Record<LinkType, string> = {
    workspace_project:
      "SELECT 1 FROM admin_workspace_projects WHERE id::text = $1 AND user_id::text = $2 LIMIT 1",
    workspace_case:
      "SELECT 1 FROM admin_workspace_cases WHERE id::text = $1 AND user_id::text = $2 LIMIT 1",
    funding_app:
      "SELECT 1 FROM admin_funding_apps WHERE id::text = $1 AND user_id::text = $2 LIMIT 1",
    industry_target:
      "SELECT 1 FROM role_room_industry_targets WHERE id::text = $1 AND user_id::text = $2 LIMIT 1",
    leadgrid_lead: `
      SELECT 1 FROM crm_customers
       WHERE id::text = $1
         AND owner_user_id::text = $2
         AND agent_config_id IS NULL
         AND archived_at IS NULL
       LIMIT 1`,
    investor:
      "SELECT 1 FROM admin_investor_contacts WHERE id::text = $1 AND user_id::text = $2 LIMIT 1",
    partner:
      "SELECT 1 FROM admin_partner_contacts WHERE id::text = $1 AND user_id::text = $2 LIMIT 1",
  };
  const result = await pool.query(queries[entityType], [entityId, userId]);
  return result.rowCount === 1;
}

const DOCUMENT_SELECT = `
  SELECT d.*,
         d.due_date::text AS due_date,
         (SELECT COUNT(*)::int FROM admin_document_links l
           WHERE l.document_id = d.id AND l.user_id = d.user_id) AS link_count,
         (SELECT COUNT(*)::int FROM admin_document_files f
           WHERE f.document_id = d.id AND f.user_id = d.user_id) AS file_count
    FROM admin_documents d`;

async function fetchDocument(pool: Pool, id: string, userId: string, includeDeleted = false) {
  const result = await pool.query(
    `${DOCUMENT_SELECT}
      WHERE d.id::text = $1 AND d.user_id::text = $2
        ${includeDeleted ? "" : "AND d.deleted_at IS NULL"}`,
    [id, userId],
  );
  return result.rows[0] ?? null;
}

async function insertSnapshot(
  client: PoolClient,
  documentId: string,
  userId: string,
  versionNumber: number,
  changeNote: string | null,
  createdBy: string,
): Promise<void> {
  await client.query(
    `INSERT INTO admin_document_versions
       (document_id, user_id, version_number, title, summary, content,
        document_type, status, product_key, due_date, next_action, tags,
        source_kind, external_url, change_note, created_by)
     SELECT id, user_id, $3, title, summary, content,
            document_type, status, product_key, due_date, next_action, tags,
            source_kind, external_url, $4, $5
       FROM admin_documents
      WHERE id = $1 AND user_id = $2`,
    [documentId, userId, versionNumber, changeNote, createdBy],
  );
}

type WordChild = Paragraph | WordTable;

function plainMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gu, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/gu, "$1")
    .replace(/_([^_]+)_/gu, "$1")
    .replace(/\x60([^\x60]+)\x60/gu, "$1")
    .trim();
}

function markdownCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => plainMarkdown(cell));
}

function wordTable(rows: string[][]): WordTable {
  return new WordTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (row) =>
        new WordTableRow({
          children: row.map(
            (cell) =>
              new WordTableCell({
                children: [new Paragraph({ text: cell || " " })],
              }),
          ),
        }),
    ),
  });
}

function markdownToWordChildren(content: string): WordChild[] {
  const lines = content.split("\n");
  const children: WordChild[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (/^\\?\[SIDESKIFT\\?\]$/u.test(line.trim())) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      index += 1;
      continue;
    }
    const headerCells = markdownCells(line);
    const divider = index + 1 < lines.length ? markdownCells(lines[index + 1]) : [];
    const isTable =
      headerCells.length > 1 &&
      divider.length === headerCells.length &&
      divider.every((cell) => /^:?-{3,}:?$/u.test(cell));
    if (isTable) {
      const rows = [headerCells];
      index += 2;
      while (index < lines.length && lines[index].includes("|")) {
        const cells = markdownCells(lines[index]);
        if (cells.length !== headerCells.length) break;
        rows.push(cells);
        index += 1;
      }
      children.push(wordTable(rows));
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/u);
    if (heading) {
      const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
      children.push(new Paragraph({
        heading: levels[heading[1].length - 1],
        text: plainMarkdown(heading[2]),
      }));
      index += 1;
      continue;
    }
    const task = line.match(/^\s*- \[([ xX])\]\s+(.+)$/u);
    if (task) {
      children.push(new Paragraph({
        text: `${task[1].toLowerCase() === "x" ? "☑" : "☐"} ${plainMarkdown(task[2])}`,
      }));
      index += 1;
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/u);
    if (bullet) {
      children.push(new Paragraph({ text: plainMarkdown(bullet[1]), bullet: { level: 0 } }));
      index += 1;
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/u);
    children.push(new Paragraph({
      text: plainMarkdown(quote?.[1] ?? line),
      ...(quote ? { indent: { left: 480 } } : {}),
      spacing: { after: line.trim() ? 120 : 60 },
    }));
    index += 1;
  }
  return children.length ? children : [new Paragraph({ text: "Tomt dokument" })];
}


async function insertAutomaticSnapshot(
  pool: Pool,
  documentId: string,
  userId: string,
): Promise<number | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT id, version_no
         FROM admin_documents
        WHERE id::text = $1 AND user_id::text = $2 AND deleted_at IS NULL
        FOR UPDATE`,
      [documentId, userId],
    );
    if (!locked.rows.length) {
      await client.query("ROLLBACK");
      return null;
    }
    const latest = await client.query(
      `SELECT created_at
         FROM admin_document_versions
        WHERE document_id::text = $1 AND user_id::text = $2
          AND change_note LIKE 'Automatisk lagring%'
        ORDER BY created_at DESC
        LIMIT 1`,
      [documentId, userId],
    );
    const lastAutomaticAt = latest.rows[0]?.created_at
      ? new Date(latest.rows[0].created_at).getTime()
      : 0;
    if (lastAutomaticAt && Date.now() - lastAutomaticAt < 5 * 60_000) {
      await client.query("ROLLBACK");
      return null;
    }
    const versionNumber = Number(locked.rows[0].version_no) + 1;
    await client.query(
      `UPDATE admin_documents
          SET version_no = $3
        WHERE id::text = $1 AND user_id::text = $2`,
      [documentId, userId, versionNumber],
    );
    await insertSnapshot(
      client,
      documentId,
      userId,
      versionNumber,
      `Automatisk lagring ${new Date().toLocaleString("nb-NO")}`,
      userId,
    );
    await client.query("COMMIT");
    return versionNumber;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
function contentDisposition(filename: string): string {
  const safe = filename.replace(/[\r\n"\\/]/gu, "_").slice(0, 180) || "dokument";
  return `attachment; filename="${safe.replace(/[^\x20-\x7E]/gu, "_")}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

function sendValidation(res: import("express").Response, error: string): void {
  res.status(400).json({ error });
}

export function setupAdminWorkspaceDocumentsRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
  });

  app.get("/api/admin-room/workspace/documents/templates", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const product = asString(req.query.product);
    const params: unknown[] = [];
    const where = ["is_active = TRUE"];
    if (product && VALID_PRODUCTS.has(product)) {
      params.push(product);
      where.push(`(product_key IS NULL OR product_key = $${params.length})`);
    } else if (product === "internal") {
      where.push("product_key IS NULL");
    }

    try {
      const result = await pool.query(
        `SELECT id, product_key, document_type, name, description,
                title_template, content_template, tags, sort_order
           FROM admin_document_templates
          WHERE ${where.join(" AND ")}
          ORDER BY sort_order, name`,
        params,
      );
      res.json({ items: result.rows });
    } catch (error) {
      console.error("[admin-workspace documents] template list error", error);
      res.status(500).json({ error: "Kunne ikke hente dokumentmaler" });
    }
  });

  app.get("/api/admin-room/workspace/documents", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const params: unknown[] = [session.userId];
    const where = ["d.user_id::text = $1"];
    const trash = req.query.trash === "true";
    const product = asString(req.query.product);
    const status = asString(req.query.status);
    const documentType = asString(req.query.documentType);
    const search = stringValue(req.query.q, 200);

    where.push(trash ? "d.deleted_at IS NOT NULL" : "d.deleted_at IS NULL");
    if (product === "internal") {
      where.push("d.product_key IS NULL");
    } else if (product && VALID_PRODUCTS.has(product)) {
      params.push(product);
      where.push(`d.product_key = $${params.length}`);
    }
    if (status && VALID_STATUSES.has(status)) {
      params.push(status);
      where.push(`d.status = $${params.length}`);
    }
    if (documentType && VALID_TYPES.has(documentType)) {
      params.push(documentType);
      where.push(`d.document_type = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        d.title ILIKE $${params.length}
        OR COALESCE(d.summary, '') ILIKE $${params.length}
        OR COALESCE(d.content, '') ILIKE $${params.length}
        OR array_to_string(d.tags, ' ') ILIKE $${params.length}
      )`);
    }

    try {
      const result = await pool.query(
        `${DOCUMENT_SELECT}
          WHERE ${where.join(" AND ")}
          ORDER BY
            CASE d.status
              WHEN 'in_review' THEN 0 WHEN 'draft' THEN 1 WHEN 'approved' THEN 2
              WHEN 'sent' THEN 3 WHEN 'signed' THEN 4 ELSE 5
            END,
            d.due_date ASC NULLS LAST,
            d.updated_at DESC
          LIMIT 250`,
        params,
      );
      res.json({ items: result.rows });
    } catch (error) {
      console.error("[admin-workspace documents] list error", error);
      res.status(500).json({ error: "Kunne ikke hente dokumenter" });
    }
  });

  app.post("/api/admin-room/workspace/documents", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const requestedProduct = productFromBody(req.body?.productKey);
    if (hasOwn(req.body, "productKey") && requestedProduct === undefined) {
      sendValidation(res, "Ugyldig produkt");
      return;
    }
    const templateId = stringValue(req.body?.templateId, 80);
    const sourceKind = stringValue(req.body?.sourceKind, 20) ?? "workspace";
    if (!VALID_SOURCES.has(sourceKind)) {
      sendValidation(res, "Ugyldig dokumentkilde");
      return;
    }
    const externalUrl = sourceKind === "workspace" ? null : validHttpUrl(req.body?.externalUrl);
    if (sourceKind !== "workspace" && !externalUrl) {
      sendValidation(res, "En gyldig http(s)-lenke er påkrevd");
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let template: Record<string, unknown> | null = null;
      if (templateId) {
        const templateResult = await client.query(
          `SELECT * FROM admin_document_templates
            WHERE id = $1 AND is_active = TRUE
              AND (product_key IS NULL OR product_key = $2)
            LIMIT 1`,
          [templateId, requestedProduct ?? null],
        );
        template = templateResult.rows[0] ?? null;
        if (!template) {
          await client.query("ROLLBACK");
          sendValidation(res, "Malen finnes ikke for valgt produkt");
          return;
        }
      }

      const productKey = requestedProduct ?? (template?.product_key as string | null | undefined) ?? null;
      const documentType =
        stringValue(req.body?.documentType, 40)
        ?? (template?.document_type as string | undefined)
        ?? "other";
      if (!VALID_TYPES.has(documentType)) {
        await client.query("ROLLBACK");
        sendValidation(res, "Ugyldig dokumenttype");
        return;
      }
      const title =
        stringValue(req.body?.title, 240)
        ?? (template?.title_template as string | undefined)
        ?? "Nytt dokument";
      const content = hasOwn(req.body, "content")
        ? stringValue(req.body.content, MAX_DOCUMENT_LENGTH, true)
        : (template?.content_template as string | undefined) ?? "";
      const dueDate = validDate(req.body?.dueDate);
      if (hasOwn(req.body, "dueDate") && req.body.dueDate && !dueDate) {
        await client.query("ROLLBACK");
        sendValidation(res, "Ugyldig frist");
        return;
      }
      const tags = hasOwn(req.body, "tags")
        ? normalizedTags(req.body.tags)
        : ((template?.tags as string[] | undefined) ?? []);

      const result = await client.query(
        `INSERT INTO admin_documents
           (user_id, product_key, title, summary, content, document_type,
            status, due_date, next_action, tags, source_kind, external_url, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, $11, $1)
         RETURNING *, due_date::text AS due_date`,
        [
          session.userId,
          productKey,
          title,
          stringValue(req.body?.summary, 4_000),
          content ?? "",
          documentType,
          dueDate,
          stringValue(req.body?.nextAction, 2_000),
          tags,
          sourceKind,
          externalUrl,
        ],
      );
      const item = result.rows[0];
      await insertSnapshot(client, item.id, session.userId, 1, "Opprettet", session.userId);
      await client.query("COMMIT");

      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_document",
        entityId: item.id,
        action: "created",
        summary: `Opprettet dokumentet «${item.title}»`,
        details: { productKey: item.product_key, documentType: item.document_type, templateId },
      });
      res.status(201).json({ item: { ...item, link_count: 0, file_count: 0 } });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[admin-workspace documents] create error", error);
      res.status(500).json({ error: "Kunne ikke opprette dokumentet" });
    } finally {
      client.release();
    }
  });

  app.get("/api/admin-room/workspace/documents/:id/export.pdf", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const item = await fetchDocument(pool, req.params.id, session.userId);
      if (!item) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      const pdf = new PDFDocument({
        size: "A4",
        margin: 56,
        info: { Title: item.title, Author: "Creatorhub Admin Workspace" },
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", contentDisposition(`${item.title}.pdf`));
      res.setHeader("Cache-Control", "private, no-store");
      pdf.pipe(res);
      pdf.fontSize(20).fillColor("#24113a").text(item.title);
      pdf.moveDown(0.4);
      pdf.fontSize(9).fillColor("#6b5a78").text(
        [
          item.product_key === "role_room"
            ? "The Role Room"
            : item.product_key === "leadgrid"
              ? "Leadgrid"
              : "Creatorhub / internt",
          `Versjon ${item.version_no}`,
          `Eksportert ${new Date().toLocaleDateString("nb-NO")}`,
        ].join("  ·  "),
      );
      if (item.summary) {
        pdf.moveDown(1.2);
        pdf.fontSize(11).fillColor("#44354f").text(item.summary, { lineGap: 3 });
      }
      pdf.moveDown(1.4);
      pdf.fontSize(10.5).fillColor("#15111a").text(item.content || "(Tomt dokument)", {
        lineGap: 3,
        paragraphGap: 7,
      });
      pdf.end();
    } catch (error) {
      console.error("[admin-workspace documents] export error", error);
      if (!res.headersSent) res.status(500).json({ error: "Kunne ikke eksportere PDF" });
    }
  });

  app.get("/api/admin-room/workspace/documents/:id/export.docx", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const item = await fetchDocument(pool, req.params.id, session.userId);
      if (!item) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      const product = item.product_key === "role_room"
        ? "The Role Room"
        : item.product_key === "leadgrid" ? "Leadgrid" : "Creatorhub / internt";
      const word = new WordDocument({
        creator: "Creatorhub Admin Workspace",
        title: item.title,
        description: item.summary || undefined,
        sections: [{
          properties: {
            page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } },
          },
          headers: {
            default: new Header({
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `${product} · ${item.title}`, color: "746B78", size: 18 })],
              })],
            }),
          },
          footers: {
            default: new Footer({
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Side ", color: "746B78", size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], color: "746B78", size: 18 }),
                  new TextRun({ text: " av ", color: "746B78", size: 18 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], color: "746B78", size: 18 }),
                ],
              })],
            }),
          },
          children: [
            new Paragraph({ text: item.title, heading: HeadingLevel.TITLE }),
            new Paragraph({
              children: [new TextRun({
                text: `${product} · versjon ${item.version_no} · eksportert ${new Date().toLocaleDateString("nb-NO")}`,
                color: "746B78",
                size: 18,
              })],
              spacing: { after: 240 },
            }),
            ...(item.summary
              ? [new Paragraph({ children: [new TextRun({ text: item.summary, italics: true })], spacing: { after: 260 } })]
              : []),
            ...markdownToWordChildren(item.content || ""),
          ],
        }],
      });
      const buffer = await Packer.toBuffer(word);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", contentDisposition(`${item.title}.docx`));
      res.setHeader("Cache-Control", "private, no-store");
      res.end(buffer);
    } catch (error) {
      console.error("[admin-workspace documents] docx export error", error);
      if (!res.headersSent) res.status(500).json({ error: "Kunne ikke eksportere DOCX" });
    }
  });

  app.get("/api/admin-room/workspace/documents/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const item = await fetchDocument(pool, req.params.id, session.userId, req.query.includeDeleted === "true");
      if (!item) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      const [linkResult, fileResult, versionResult, commentResult, options] = await Promise.all([
        pool.query(
          `SELECT id AS link_id, entity_type, entity_id, created_at
             FROM admin_document_links
            WHERE document_id::text = $1 AND user_id::text = $2
            ORDER BY created_at`,
          [req.params.id, session.userId],
        ),
        pool.query(
          `SELECT id, file_name, mime_type, file_size, source_kind, external_url,
                  sha256, context_enabled, extraction_status, extraction_method,
                  extraction_error, extraction_metadata, extracted_at, created_at
             FROM admin_document_files
            WHERE document_id::text = $1 AND user_id::text = $2
            ORDER BY created_at DESC`,
          [req.params.id, session.userId],
        ),
        pool.query(
          `SELECT id, version_number, change_note, created_by, created_at,
                  title, status
             FROM admin_document_versions
            WHERE document_id::text = $1 AND user_id::text = $2
            ORDER BY version_number DESC`,
          [req.params.id, session.userId],
        ),
        pool.query(
          `SELECT id, kind, body, selected_text, anchor_from, anchor_to,
                  suggested_text, assignee, status, created_by, resolved_by,
                  resolved_at, created_at, updated_at
             FROM admin_document_comments
            WHERE document_id::text = $1 AND user_id::text = $2
            ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, created_at DESC`,
          [req.params.id, session.userId],
        ),
        fetchLinkOptions(pool, session.userId),
      ]);
      const optionMap = new Map(
        options.map((option) => [`${option.entity_type}:${option.entity_id}`, option]),
      );
      const links = linkResult.rows.map((link) => ({
        ...link,
        ...(optionMap.get(`${link.entity_type}:${link.entity_id}`) ?? {
          title: "Slettet eller utilgjengelig element",
          subtitle: null,
          status: null,
          due_date: null,
          last_activity_at: null,
          missing: true,
        }),
      }));
      res.json({
        item,
        links,
        files: fileResult.rows,
        versions: versionResult.rows,
        comments: commentResult.rows,
      });
    } catch (error) {
      console.error("[admin-workspace documents] detail error", error);
      res.status(500).json({ error: "Kunne ikke hente dokumentet" });
    }
  });

  app.patch("/api/admin-room/workspace/documents/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const existing = await fetchDocument(pool, req.params.id, session.userId);
      if (!existing) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      const expectedUpdatedAt = stringValue(req.body?.expectedUpdatedAt, 64);
      const contentChanged =
        typeof req.body?.content === "string" &&
        req.body.content.slice(0, MAX_DOCUMENT_LENGTH) !== existing.content;

      const sets: string[] = [];
      const params: unknown[] = [];
      const add = (column: string, value: unknown) => {
        params.push(value);
        sets.push(`${column} = $${params.length}`);
      };

      if (hasOwn(req.body, "title")) {
        const title = stringValue(req.body.title, 240);
        if (!title) return sendValidation(res, "Tittel kan ikke være tom");
        add("title", title);
      }
      if (hasOwn(req.body, "summary")) add("summary", stringValue(req.body.summary, 4_000));
      if (hasOwn(req.body, "content")) {
        if (typeof req.body.content !== "string") return sendValidation(res, "Ugyldig dokumentinnhold");
        add("content", req.body.content.slice(0, MAX_DOCUMENT_LENGTH));
      }
      if (hasOwn(req.body, "documentType")) {
        const value = stringValue(req.body.documentType, 40);
        if (!value || !VALID_TYPES.has(value)) return sendValidation(res, "Ugyldig dokumenttype");
        add("document_type", value);
      }
      if (hasOwn(req.body, "status")) {
        const value = stringValue(req.body.status, 20);
        if (!value || !VALID_STATUSES.has(value)) return sendValidation(res, "Ugyldig status");
        add("status", value);
      }
      if (hasOwn(req.body, "productKey")) {
        const value = productFromBody(req.body.productKey);
        if (value === undefined) return sendValidation(res, "Ugyldig produkt");
        add("product_key", value);
      }
      if (hasOwn(req.body, "dueDate")) {
        const value = validDate(req.body.dueDate);
        if (req.body.dueDate && !value) return sendValidation(res, "Ugyldig frist");
        add("due_date", value);
      }
      if (hasOwn(req.body, "nextAction")) add("next_action", stringValue(req.body.nextAction, 2_000));
      if (hasOwn(req.body, "tags")) add("tags", normalizedTags(req.body.tags));

      if (hasOwn(req.body, "sourceKind") || hasOwn(req.body, "externalUrl")) {
        const sourceKind = hasOwn(req.body, "sourceKind")
          ? stringValue(req.body.sourceKind, 20)
          : existing.source_kind;
        if (!sourceKind || !VALID_SOURCES.has(sourceKind)) {
          return sendValidation(res, "Ugyldig dokumentkilde");
        }
        const externalUrl = sourceKind === "workspace"
          ? null
          : validHttpUrl(hasOwn(req.body, "externalUrl") ? req.body.externalUrl : existing.external_url);
        if (sourceKind !== "workspace" && !externalUrl) {
          return sendValidation(res, "En gyldig http(s)-lenke er påkrevd");
        }
        add("source_kind", sourceKind);
        add("external_url", externalUrl);
      }

      if (!sets.length) {
        sendValidation(res, "Ingen gyldige felter å lagre");
        return;
      }
      params.push(session.userId, req.params.id);
      const userParam = params.length - 1;
      const idParam = params.length;
      let conflictClause = "";
      if (expectedUpdatedAt) {
        params.push(expectedUpdatedAt);
        conflictClause = `AND date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', $${params.length}::timestamptz)`;
      }
      const result = await pool.query(
        `UPDATE admin_documents
            SET ${sets.join(", ")}, updated_at = NOW(), updated_by = $${userParam}
          WHERE user_id::text = $${userParam}
            AND id::text = $${idParam}
            AND deleted_at IS NULL
            ${conflictClause}
          RETURNING *, due_date::text AS due_date`,
        params,
      );
      if (!result.rows.length) {
        if (expectedUpdatedAt) {
          const latest = await fetchDocument(pool, req.params.id, session.userId);
          if (latest) {
            res.status(409).json({
              error: "Dokumentet ble endret i en annen økt",
              code: "DOCUMENT_CONFLICT",
              item: latest,
            });
            return;
          }
        }
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      const automaticVersion = contentChanged
        ? await insertAutomaticSnapshot(pool, req.params.id, session.userId)
        : null;
      if (automaticVersion) {
        await logAdminActivity({
          userId: session.userId,
          entityType: "workspace_document",
          entityId: req.params.id,
          action: "version_created_automatically",
          summary: `Lagret automatisk versjon ${automaticVersion} av «${result.rows[0].title}»`,
          details: { versionNumber: automaticVersion },
        });
      }
      const updated = automaticVersion
        ? await fetchDocument(pool, req.params.id, session.userId)
        : {
            ...result.rows[0],
            link_count: existing.link_count,
            file_count: existing.file_count,
          };
      res.json({ item: updated });
    } catch (error) {
      console.error("[admin-workspace documents] update error", error);
      res.status(500).json({ error: "Kunne ikke lagre dokumentet" });
    }
  });


  app.post("/api/admin-room/workspace/documents/:id/comments", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const kind = req.body?.kind === "suggestion" ? "suggestion" : "comment";
    const body = stringValue(req.body?.body, 4_000);
    const selectedText = stringValue(req.body?.selectedText, 20_000);
    const suggestedText = stringValue(req.body?.suggestedText, 20_000, true);
    const assignee = stringValue(req.body?.assignee, 240);
    const anchorFrom = Number.isInteger(req.body?.anchorFrom) && req.body.anchorFrom >= 0
      ? Number(req.body.anchorFrom)
      : null;
    const anchorTo = Number.isInteger(req.body?.anchorTo) &&
      (anchorFrom === null || req.body.anchorTo >= anchorFrom)
      ? Number(req.body.anchorTo)
      : null;
    if (!body) return sendValidation(res, "Kommentaren kan ikke være tom");
    if (kind === "suggestion" && !suggestedText?.trim()) {
      return sendValidation(res, "Et tekstforslag må ha foreslått tekst");
    }
    if ((anchorFrom === null) !== (anchorTo === null)) {
      return sendValidation(res, "Ugyldig tekstforankring");
    }
    try {
      const item = await fetchDocument(pool, req.params.id, session.userId);
      if (!item) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      const result = await pool.query(
        `INSERT INTO admin_document_comments
           (document_id, user_id, kind, body, selected_text, anchor_from,
            anchor_to, suggested_text, assignee, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $2)
         RETURNING *`,
        [req.params.id, session.userId, kind, body, selectedText,
          anchorFrom, anchorTo, suggestedText, assignee],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_document",
        entityId: req.params.id,
        action: kind === "suggestion" ? "suggestion_added" : "comment_added",
        summary: `${kind === "suggestion" ? "La til forslag" : "La til kommentar"} i «${item.title}»`,
      });
      res.status(201).json({ item: result.rows[0] });
    } catch (error) {
      console.error("[admin-workspace documents] create comment error", error);
      res.status(500).json({ error: "Kunne ikke lagre merknaden" });
    }
  });

  app.patch("/api/admin-room/workspace/documents/:id/comments/:commentId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (hasOwn(req.body, "body")) {
      const body = stringValue(req.body.body, 4_000);
      if (!body) return sendValidation(res, "Kommentaren kan ikke være tom");
      add("body", body);
    }
    if (hasOwn(req.body, "assignee")) add("assignee", stringValue(req.body.assignee, 240));
    if (hasOwn(req.body, "suggestedText")) {
      add("suggested_text", stringValue(req.body.suggestedText, 20_000, true));
    }
    if (hasOwn(req.body, "status")) {
      const status = req.body.status;
      if (status !== "open" && status !== "resolved") {
        return sendValidation(res, "Ugyldig merknadsstatus");
      }
      add("status", status);
      if (status === "resolved") {
        sets.push("resolved_at = NOW()");
        add("resolved_by", session.userId);
      } else {
        sets.push("resolved_at = NULL", "resolved_by = NULL");
      }
    }
    if (!sets.length) return sendValidation(res, "Ingen endringer å lagre");
    params.push(req.params.commentId, req.params.id, session.userId);
    try {
      const result = await pool.query(
        `UPDATE admin_document_comments
            SET ${sets.join(", ")}, updated_at = NOW()
          WHERE id::text = $${params.length - 2}
            AND document_id::text = $${params.length - 1}
            AND user_id::text = $${params.length}
          RETURNING *`,
        params,
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Merknaden finnes ikke" });
        return;
      }
      res.json({ item: result.rows[0] });
    } catch (error) {
      console.error("[admin-workspace documents] update comment error", error);
      res.status(500).json({ error: "Kunne ikke oppdatere merknaden" });
    }
  });

  app.delete("/api/admin-room/workspace/documents/:id/comments/:commentId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM admin_document_comments
          WHERE id::text = $1 AND document_id::text = $2 AND user_id::text = $3
          RETURNING id`,
        [req.params.commentId, req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Merknaden finnes ikke" });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      console.error("[admin-workspace documents] delete comment error", error);
      res.status(500).json({ error: "Kunne ikke slette merknaden" });
    }
  });
  app.delete("/api/admin-room/workspace/documents/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `UPDATE admin_documents
            SET deleted_at = NOW(), status = 'archived', updated_at = NOW(), updated_by = $2
          WHERE id::text = $1 AND user_id::text = $2 AND deleted_at IS NULL
          RETURNING id, title`,
        [req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_document",
        entityId: req.params.id,
        action: "deleted",
        summary: `Flyttet «${result.rows[0].title}» til papirkurven`,
      });
      res.json({ deleted: true });
    } catch (error) {
      console.error("[admin-workspace documents] delete error", error);
      res.status(500).json({ error: "Kunne ikke flytte dokumentet til papirkurven" });
    }
  });

  app.post("/api/admin-room/workspace/documents/:id/restore", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `UPDATE admin_documents
            SET deleted_at = NULL,
                status = CASE WHEN status = 'archived' THEN 'draft' ELSE status END,
                updated_at = NOW(),
                updated_by = $2
          WHERE id::text = $1 AND user_id::text = $2 AND deleted_at IS NOT NULL
          RETURNING *`,
        [req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Dokumentet finnes ikke i papirkurven" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_document",
        entityId: req.params.id,
        action: "restored",
        summary: `Gjenopprettet «${result.rows[0].title}» fra papirkurven`,
      });
      const item = await fetchDocument(pool, req.params.id, session.userId);
      res.json({ item });
    } catch (error) {
      console.error("[admin-workspace documents] trash restore error", error);
      res.status(500).json({ error: "Kunne ikke gjenopprette dokumentet" });
    }
  });

  app.post("/api/admin-room/workspace/documents/:id/versions", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        `SELECT id, title, version_no FROM admin_documents
          WHERE id::text = $1 AND user_id::text = $2 AND deleted_at IS NULL
          FOR UPDATE`,
        [req.params.id, session.userId],
      );
      if (!locked.rows.length) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      const versionNumber = Number(locked.rows[0].version_no) + 1;
      await client.query(
        "UPDATE admin_documents SET version_no = $3, updated_at = NOW(), updated_by = $2 WHERE id = $1 AND user_id = $2",
        [req.params.id, session.userId, versionNumber],
      );
      const changeNote = stringValue(req.body?.changeNote, 500) ?? `Versjon ${versionNumber}`;
      await insertSnapshot(client, req.params.id, session.userId, versionNumber, changeNote, session.userId);
      await client.query("COMMIT");
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_document",
        entityId: req.params.id,
        action: "version_created",
        summary: `Lagret versjon ${versionNumber} av «${locked.rows[0].title}»`,
        details: { versionNumber, changeNote },
      });
      res.status(201).json({ versionNumber });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[admin-workspace documents] create version error", error);
      res.status(500).json({ error: "Kunne ikke lagre ny versjon" });
    } finally {
      client.release();
    }
  });

  app.get("/api/admin-room/workspace/documents/:id/versions/:versionId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT id, version_number, change_note, created_by, created_at,
                title, summary, content, document_type, status, product_key,
                due_date::text AS due_date, next_action, tags
           FROM admin_document_versions
          WHERE id::text = $1 AND document_id::text = $2 AND user_id::text = $3
          LIMIT 1`,
        [req.params.versionId, req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Versjonen finnes ikke" });
        return;
      }
      res.json({ item: result.rows[0] });
    } catch (error) {
      console.error("[admin-workspace documents] version detail error", error);
      res.status(500).json({ error: "Kunne ikke hente versjonen" });
    }
  });

  app.post("/api/admin-room/workspace/documents/:id/versions/:versionId/restore", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        `SELECT id, title, version_no FROM admin_documents
          WHERE id::text = $1 AND user_id::text = $2 AND deleted_at IS NULL
          FOR UPDATE`,
        [req.params.id, session.userId],
      );
      if (!locked.rows.length) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      const versionResult = await client.query(
        `SELECT * FROM admin_document_versions
          WHERE id::text = $1 AND document_id::text = $2 AND user_id::text = $3
          LIMIT 1`,
        [req.params.versionId, req.params.id, session.userId],
      );
      if (!versionResult.rows.length) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Versjonen finnes ikke" });
        return;
      }
      const version = versionResult.rows[0];
      const newVersionNumber = Number(locked.rows[0].version_no) + 1;
      await client.query(
        `UPDATE admin_documents
            SET title = $3, summary = $4, content = $5, document_type = $6,
                status = $7, product_key = $8, due_date = $9, next_action = $10,
                tags = $11, source_kind = $12, external_url = $13,
                version_no = $14, updated_at = NOW(), updated_by = $2
          WHERE id::text = $1 AND user_id::text = $2`,
        [
          req.params.id,
          session.userId,
          version.title,
          version.summary,
          version.content,
          version.document_type,
          version.status,
          version.product_key,
          version.due_date,
          version.next_action,
          version.tags,
          version.source_kind,
          version.external_url,
          newVersionNumber,
        ],
      );
      await insertSnapshot(
        client,
        req.params.id,
        session.userId,
        newVersionNumber,
        `Gjenopprettet fra versjon ${version.version_number}`,
        session.userId,
      );
      await client.query("COMMIT");
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_document",
        entityId: req.params.id,
        action: "version_restored",
        summary: `Gjenopprettet «${locked.rows[0].title}» fra versjon ${version.version_number}`,
        details: { fromVersion: version.version_number, newVersion: newVersionNumber },
      });
      res.json({ restored: true, versionNumber: newVersionNumber });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[admin-workspace documents] restore version error", error);
      res.status(500).json({ error: "Kunne ikke gjenopprette versjonen" });
    } finally {
      client.release();
    }
  });

  app.get("/api/admin-room/workspace/documents/:id/link-options", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const item = await fetchDocument(pool, req.params.id, session.userId);
      if (!item) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      const [options, linkedResult] = await Promise.all([
        fetchLinkOptions(pool, session.userId, linkTypesForProduct(item.product_key)),
        pool.query(
          "SELECT entity_type, entity_id FROM admin_document_links WHERE document_id::text = $1 AND user_id::text = $2",
          [req.params.id, session.userId],
        ),
      ]);
      const linked = new Set(
        linkedResult.rows.map((row) => `${row.entity_type}:${row.entity_id}`),
      );
      res.json({
        items: options.map((option) => ({
          ...option,
          linked: linked.has(`${option.entity_type}:${option.entity_id}`),
        })),
      });
    } catch (error) {
      console.error("[admin-workspace documents] link options error", error);
      res.status(500).json({ error: "Kunne ikke hente koblingsvalg" });
    }
  });

  app.post("/api/admin-room/workspace/documents/:id/links", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const entityType = stringValue(req.body?.entityType, 40);
    const entityId = stringValue(req.body?.entityId, 255);
    if (!entityType || !VALID_LINK_TYPES.has(entityType) || !entityId) {
      sendValidation(res, "Ugyldig kobling");
      return;
    }
    try {
      const item = await fetchDocument(pool, req.params.id, session.userId);
      if (!item) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      if (!linkTypesForProduct(item.product_key).includes(entityType as LinkType)) {
        sendValidation(res, "Koblingstypen passer ikke dokumentets produkt");
        return;
      }
      if (!await userOwnsLinkedEntity(pool, session.userId, entityType as LinkType, entityId)) {
        res.status(404).json({ error: "Arbeidselementet finnes ikke" });
        return;
      }
      const result = await pool.query(
        `INSERT INTO admin_document_links
           (document_id, user_id, entity_type, entity_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (document_id, entity_type, entity_id) DO NOTHING
         RETURNING id`,
        [req.params.id, session.userId, entityType, entityId],
      );
      if (result.rows.length) {
        await logAdminActivity({
          userId: session.userId,
          entityType: "workspace_document",
          entityId: req.params.id,
          action: "linked",
          summary: `Koblet et ${entityType}-element til «${item.title}»`,
          details: { linkType: entityType, linkedEntityId: entityId },
        });
      }
      res.status(result.rows.length ? 201 : 200).json({ linked: true });
    } catch (error) {
      console.error("[admin-workspace documents] add link error", error);
      res.status(500).json({ error: "Kunne ikke koble arbeidselementet" });
    }
  });

  app.delete("/api/admin-room/workspace/documents/:id/links/:linkId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM admin_document_links
          WHERE id::text = $1 AND document_id::text = $2 AND user_id::text = $3
          RETURNING entity_type, entity_id`,
        [req.params.linkId, req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Koblingen finnes ikke" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_document",
        entityId: req.params.id,
        action: "unlinked",
        summary: "Fjernet en kobling fra dokumentet",
        details: result.rows[0],
      });
      res.json({ deleted: true });
    } catch (error) {
      console.error("[admin-workspace documents] remove link error", error);
      res.status(500).json({ error: "Kunne ikke fjerne koblingen" });
    }
  });

  app.post("/api/admin-room/workspace/documents/:id/files", (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    upload.single("file")(req, res, async (uploadError: unknown) => {
      if (uploadError) {
        const tooLarge = uploadError instanceof multer.MulterError && uploadError.code === "LIMIT_FILE_SIZE";
        res.status(400).json({
          error: tooLarge ? "Vedlegget kan være maksimalt 15 MB" : "Kunne ikke lese vedlegget",
        });
        return;
      }
      if (!req.file) {
        sendValidation(res, "Velg en fil");
        return;
      }
      if (!ALLOWED_ATTACHMENT_MIME.has(req.file.mimetype)) {
        sendValidation(res, "Filtypen støttes ikke");
        return;
      }
      try {
        const item = await fetchDocument(pool, req.params.id, session.userId);
        if (!item) {
          res.status(404).json({ error: "Dokumentet finnes ikke" });
          return;
        }
        const fileName = req.file.originalname.replace(/[\r\n]/gu, " ").slice(0, 255) || "vedlegg";
        const sha256 = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
        const result = await pool.query(
          `INSERT INTO admin_document_files
             (document_id, user_id, file_name, mime_type, file_size,
              file_data, source_kind, sha256)
           VALUES ($1, $2, $3, $4, $5, $6, 'upload', $7)
           RETURNING id, document_id::text, file_name, mime_type, file_size, source_kind,
                     external_url, sha256, context_enabled, extraction_status,
                     extraction_method, extraction_error, extraction_metadata,
                     extracted_at, created_at`,
          [
            req.params.id,
            session.userId,
            fileName,
            req.file.mimetype,
            req.file.size,
            req.file.buffer,
            sha256,
          ],
        );
        const fileItem = result.rows[0];
        const indexed = await indexAdminDocumentFile({
          pool,
          fileId: fileItem.id,
          documentId: fileItem.document_id,
          userId: session.userId,
          fileName,
          mimeType: req.file.mimetype,
          buffer: req.file.buffer,
        });
        await logAdminActivity({
          userId: session.userId,
          entityType: "workspace_document",
          entityId: req.params.id,
          action: "file_added",
          summary: `La ved «${fileName}» til dokumentet «${item.title}»`,
          details: {
            fileId: fileItem.id,
            size: req.file.size,
            mimeType: req.file.mimetype,
            extractionStatus: indexed.status,
            extractionMethod: indexed.method,
          },
        });
        res.status(201).json({
          item: {
            ...fileItem,
            extraction_status: indexed.status,
            extraction_method: indexed.method,
            extraction_error: indexed.error,
            extraction_metadata: indexed.metadata,
            extracted_at: indexed.status === "ready" ? new Date().toISOString() : fileItem.extracted_at,
          },
        });
      } catch (error) {
        console.error("[admin-workspace documents] upload file error", error);
        res.status(500).json({ error: "Kunne ikke lagre vedlegget" });
      }
    });
  });

  app.post("/api/admin-room/workspace/documents/:id/files/external", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const fileName = stringValue(req.body?.fileName, 255);
    const externalUrl = validHttpUrl(req.body?.externalUrl);
    const sourceKind = req.body?.sourceKind === "google_drive" ? "google_drive" : "external";
    if (!fileName || !externalUrl) {
      sendValidation(res, "Navn og gyldig http(s)-lenke er påkrevd");
      return;
    }
    try {
      const item = await fetchDocument(pool, req.params.id, session.userId);
      if (!item) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      const result = await pool.query(
        `INSERT INTO admin_document_files
           (document_id, user_id, file_name, source_kind, external_url,
            context_enabled, extraction_status)
         VALUES ($1, $2, $3, $4, $5, FALSE, 'external')
         RETURNING id, file_name, mime_type, file_size, source_kind,
                   external_url, sha256, context_enabled, extraction_status,
                   extraction_method, extraction_error, extraction_metadata,
                   extracted_at, created_at`,
        [req.params.id, session.userId, fileName, sourceKind, externalUrl],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_document",
        entityId: req.params.id,
        action: "file_link_added",
        summary: `Koblet «${fileName}» til dokumentet «${item.title}»`,
        details: { fileId: result.rows[0].id, sourceKind },
      });
      res.status(201).json({ item: result.rows[0] });
    } catch (error) {
      console.error("[admin-workspace documents] external file error", error);
      res.status(500).json({ error: "Kunne ikke koble dokumentlenken" });
    }
  });

  app.get("/api/admin-room/workspace/documents/:id/files/:fileId/download", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT file_name, mime_type, file_data
           FROM admin_document_files
          WHERE id::text = $1 AND document_id::text = $2 AND user_id::text = $3
            AND source_kind = 'upload'
          LIMIT 1`,
        [req.params.fileId, req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Vedlegget finnes ikke" });
        return;
      }
      const file = result.rows[0];
      res.setHeader("Content-Type", file.mime_type || "application/octet-stream");
      res.setHeader("Content-Disposition", contentDisposition(file.file_name));
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(file.file_data);
    } catch (error) {
      console.error("[admin-workspace documents] download file error", error);
      res.status(500).json({ error: "Kunne ikke laste ned vedlegget" });
    }
  });

  app.delete("/api/admin-room/workspace/documents/:id/files/:fileId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM admin_document_files
          WHERE id::text = $1 AND document_id::text = $2 AND user_id::text = $3
          RETURNING file_name`,
        [req.params.fileId, req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Vedlegget finnes ikke" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_document",
        entityId: req.params.id,
        action: "file_deleted",
        summary: `Fjernet vedlegget «${result.rows[0].file_name}»`,
        details: { fileId: req.params.fileId },
      });
      res.json({ deleted: true });
    } catch (error) {
      console.error("[admin-workspace documents] delete file error", error);
      res.status(500).json({ error: "Kunne ikke fjerne vedlegget" });
    }
  });
}
