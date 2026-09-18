/**
 * Interne prosjekter for Admin Workspace.
 *
 * Et prosjekt her er et adminstyrt initiativ (støttesøknad, markedsinngang,
 * partnerløp eller intern leveranse), ikke et casting- eller kundeprosjekt.
 * Eksisterende arbeidsobjekter kobles inn via tenant-sikrede prosjektlenker.
 */

import crypto from "node:crypto";
import type { Pool } from "pg";
import multer from "multer";
import type { AdminRoomRoutesDeps } from "./_shared";
import { asNumberOrNull, asString, readStringArray } from "./_shared";
import { indexAdminWorkspaceProjectFile } from "./admin-document-context-service";

const VALID_PRODUCTS = new Set(["role_room", "leadgrid"]);
const VALID_CATEGORIES = new Set([
  "funding",
  "market_outreach",
  "partnership",
  "investor",
  "go_to_market",
  "internal",
  "other",
]);
const VALID_STATUSES = new Set([
  "planned",
  "active",
  "blocked",
  "on_hold",
  "completed",
  "archived",
]);
const VALID_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const ALL_LINK_TYPES = [
  "funding_app",
  "industry_target",
  "leadgrid_lead",
  "investor",
  "partner",
  "workspace_case",
] as const;
const VALID_LINK_TYPES = new Set<string>(ALL_LINK_TYPES);
const MAX_PROJECT_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_PROJECT_FILE_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/png",
  "image/jpeg",
]);

type LinkType =
  | "funding_app"
  | "industry_target"
  | "leadgrid_lead"
  | "investor"
  | "partner"
  | "workspace_case";

interface LinkOption {
  entity_type: LinkType;
  entity_id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  due_date: string | null;
  last_activity_at: string | null;
}

function validDate(value: unknown): string | null {
  const date = asString(value);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

function normalizedTags(value: unknown): string[] {
  return readStringArray(value)
    .map((tag) => tag.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 20);
}

function projectFileName(value: string): string {
  return value.replace(/[\r\n]/gu, " ").replace(/[\\/]/gu, "_").trim().slice(0, 255) || "prosjektfil";
}

function contentDisposition(filename: string): string {
  const safe = filename.replace(/[\r\n"\\/]/gu, "_").slice(0, 180) || "prosjektfil";
  return `attachment; filename="${safe.replace(/[^\x20-\x7E]/gu, "_")}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

async function fetchLinkOptions(
  pool: Pool,
  userId: string,
  types: readonly LinkType[] = ALL_LINK_TYPES,
): Promise<LinkOption[]> {
  const sources: Record<LinkType, string> = {
    funding_app: `
      SELECT 'funding_app'::text AS entity_type, id::text AS entity_id,
             project_name::text AS title,
             concat_ws(' · ', scheme_label, contact_person)::text AS subtitle,
             status::text, deadline::text AS due_date,
             updated_at::text AS last_activity_at
        FROM admin_funding_apps
       WHERE user_id = $1`,
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
       WHERE user_id = $1`,
    partner: `
      SELECT 'partner'::text AS entity_type, id::text AS entity_id,
             company_name::text AS title,
             contact_name::text AS subtitle,
             status::text, next_step_due::text AS due_date,
             updated_at::text AS last_activity_at
        FROM admin_partner_contacts
       WHERE user_id = $1`,
    workspace_case: `
      SELECT 'workspace_case'::text AS entity_type, id::text AS entity_id,
             title::text, NULL::text AS subtitle,
             status::text, due_date::text,
             updated_at::text AS last_activity_at
        FROM admin_workspace_cases
       WHERE user_id = $1`,
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
  const ownershipQueries: Record<LinkType, string> = {
    funding_app: "SELECT 1 FROM admin_funding_apps WHERE id::text = $1 AND user_id::text = $2 LIMIT 1",
    industry_target: "SELECT 1 FROM role_room_industry_targets WHERE id::text = $1 AND user_id::text = $2 LIMIT 1",
    leadgrid_lead: `
      SELECT 1 FROM crm_customers
       WHERE id::text = $1
         AND owner_user_id::text = $2
         AND agent_config_id IS NULL
         AND archived_at IS NULL
       LIMIT 1`,
    investor: "SELECT 1 FROM admin_investor_contacts WHERE id::text = $1 AND user_id::text = $2 LIMIT 1",
    partner: "SELECT 1 FROM admin_partner_contacts WHERE id::text = $1 AND user_id::text = $2 LIMIT 1",
    workspace_case: "SELECT 1 FROM admin_workspace_cases WHERE id::text = $1 AND user_id::text = $2 LIMIT 1",
  };
  const result = await pool.query(ownershipQueries[entityType], [entityId, userId]);
  return result.rowCount === 1;
}

function linkTypesForProduct(productKey: string | null): LinkType[] {
  const shared: LinkType[] = ["funding_app", "investor", "partner", "workspace_case"];
  if (productKey === "role_room") return [...shared, "industry_target"];
  if (productKey === "leadgrid") return [...shared, "leadgrid_lead"];
  return [...ALL_LINK_TYPES];
}

function linkTypeAllowedForProduct(entityType: LinkType, productKey: string | null): boolean {
  return linkTypesForProduct(productKey).includes(entityType);
}

export function setupAdminWorkspaceProjectsRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PROJECT_FILE_BYTES, files: 1 },
  });

  app.get("/api/admin-room/workspace/projects", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const where = ["p.user_id = $1"];
    const params: unknown[] = [session.userId];
    const product = asString(req.query.product);
    const status = asString(req.query.status);
    const category = asString(req.query.category);
    const search = asString(req.query.q);

    if (product === "internal") {
      where.push("p.product_key IS NULL");
    } else if (product && VALID_PRODUCTS.has(product)) {
      params.push(product);
      where.push(`p.product_key = $${params.length}`);
    }
    if (status && VALID_STATUSES.has(status)) {
      params.push(status);
      where.push(`p.status = $${params.length}`);
    }
    if (category && VALID_CATEGORIES.has(category)) {
      params.push(category);
      where.push(`p.category = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(p.title ILIKE $${params.length} OR COALESCE(p.summary, '') ILIKE $${params.length})`);
    }

    try {
      const result = await pool.query(
        `SELECT p.*,
                p.start_date::text AS start_date,
                p.target_date::text AS target_date,
                COUNT(l.id)::int AS linked_count,
                COUNT(l.id) FILTER (WHERE l.entity_type = 'industry_target')::int AS contact_count,
                COUNT(l.id) FILTER (WHERE l.entity_type = 'leadgrid_lead')::int AS lead_count,
                COUNT(l.id) FILTER (WHERE l.entity_type = 'workspace_case')::int AS case_count
                ,(SELECT COUNT(*)::int
                    FROM admin_workspace_project_files f
                   WHERE f.project_id = p.id AND f.user_id = p.user_id) AS file_count
           FROM admin_workspace_projects p
           LEFT JOIN admin_workspace_project_links l
             ON l.project_id = p.id AND l.user_id = p.user_id
          WHERE ${where.join(" AND ")}
          GROUP BY p.id
          ORDER BY
            CASE p.status
              WHEN 'active' THEN 0 WHEN 'blocked' THEN 1 WHEN 'planned' THEN 2
              WHEN 'on_hold' THEN 3 WHEN 'completed' THEN 4 ELSE 5
            END,
            CASE p.priority
              WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3
            END,
            p.target_date ASC NULLS LAST,
            p.updated_at DESC`,
        params,
      );
      res.json({ items: result.rows });
    } catch (error) {
      console.error("[admin-workspace projects] list error", error);
      res.status(500).json({ error: "Kunne ikke hente prosjekter" });
    }
  });

  app.get("/api/admin-room/workspace/projects/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const projectResult = await pool.query(
        `SELECT p.*,
                p.start_date::text AS start_date,
                p.target_date::text AS target_date,
                COUNT(l.id)::int AS linked_count,
                COUNT(l.id) FILTER (WHERE l.entity_type = 'industry_target')::int AS contact_count,
                COUNT(l.id) FILTER (WHERE l.entity_type = 'leadgrid_lead')::int AS lead_count,
                COUNT(l.id) FILTER (WHERE l.entity_type = 'workspace_case')::int AS case_count
                ,(SELECT COUNT(*)::int
                    FROM admin_workspace_project_files f
                   WHERE f.project_id = p.id AND f.user_id = p.user_id) AS file_count
           FROM admin_workspace_projects p
           LEFT JOIN admin_workspace_project_links l
             ON l.project_id = p.id AND l.user_id = p.user_id
          WHERE p.id = $1 AND p.user_id = $2
          GROUP BY p.id`,
        [req.params.id, session.userId],
      );
      if (!projectResult.rows.length) {
        res.status(404).json({ error: "Prosjektet finnes ikke" });
        return;
      }

      const [linkResult, options] = await Promise.all([
        pool.query(
          `SELECT id AS link_id, entity_type, entity_id, created_at
             FROM admin_workspace_project_links
            WHERE project_id = $1 AND user_id = $2
            ORDER BY created_at ASC`,
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
          title: "Slettet element",
          subtitle: null,
          status: null,
          due_date: null,
          last_activity_at: null,
          missing: true,
        }),
      }));
      res.json({ item: projectResult.rows[0], links });
    } catch (error) {
      console.error("[admin-workspace projects] read error", error);
      res.status(500).json({ error: "Kunne ikke hente prosjektet" });
    }
  });

  app.post("/api/admin-room/workspace/projects", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = asString(body.title);
    if (!title || title.length > 200) {
      res.status(400).json({ error: "title er påkrevd og kan være maks 200 tegn" });
      return;
    }
    const category = asString(body.category, "internal") ?? "internal";
    const status = asString(body.status, "planned") ?? "planned";
    const priority = asString(body.priority, "normal") ?? "normal";
    const productKey = asString(body.productKey);
    const progress = asNumberOrNull(body.progressPercent) ?? 0;
    const startDate = asString(body.startDate) ? validDate(body.startDate) : null;
    const targetDate = asString(body.targetDate) ? validDate(body.targetDate) : null;

    if (!VALID_CATEGORIES.has(category) || !VALID_STATUSES.has(status) || !VALID_PRIORITIES.has(priority)) {
      res.status(400).json({ error: "Ugyldig kategori, status eller prioritet" });
      return;
    }
    if (productKey && !VALID_PRODUCTS.has(productKey)) {
      res.status(400).json({ error: "Ugyldig productKey" });
      return;
    }
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
      res.status(400).json({ error: "progressPercent må være et heltall mellom 0 og 100" });
      return;
    }
    if ((asString(body.startDate) && !startDate) || (asString(body.targetDate) && !targetDate)) {
      res.status(400).json({ error: "Datoer må være på formatet YYYY-MM-DD" });
      return;
    }

    try {
      const result = await pool.query(
        `INSERT INTO admin_workspace_projects
          (user_id, product_key, title, summary, objective, category, status,
           priority, progress_percent, start_date, target_date, tags, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $1)
         RETURNING *, start_date::text AS start_date, target_date::text AS target_date,
                   0::int AS linked_count, 0::int AS contact_count, 0::int AS case_count,
                   0::int AS file_count`,
        [
          session.userId,
          productKey,
          title,
          asString(body.summary),
          asString(body.objective),
          category,
          status,
          priority,
          progress,
          startDate,
          targetDate,
          normalizedTags(body.tags),
        ],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_project",
        entityId: result.rows[0].id,
        action: "created",
        summary: `Prosjekt opprettet: ${title}`,
      });
      res.status(201).json({ item: result.rows[0] });
    } catch (error) {
      console.error("[admin-workspace projects] create error", error);
      res.status(500).json({ error: "Kunne ikke opprette prosjekt" });
    }
  });

  app.patch("/api/admin-room/workspace/projects/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [];
    const changed: string[] = [];
    const push = (column: string, value: unknown, field: string) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
      changed.push(field);
    };

    if ("title" in body) {
      const title = asString(body.title);
      if (!title || title.length > 200) {
        res.status(400).json({ error: "title kan ikke være tom og kan være maks 200 tegn" });
        return;
      }
      push("title", title, "title");
    }
    for (const [bodyKey, column, allowed] of [
      ["category", "category", VALID_CATEGORIES],
      ["status", "status", VALID_STATUSES],
      ["priority", "priority", VALID_PRIORITIES],
    ] as const) {
      if (bodyKey in body) {
        const value = asString(body[bodyKey]);
        if (!value || !allowed.has(value)) {
          res.status(400).json({ error: `Ugyldig ${bodyKey}` });
          return;
        }
        push(column, value, bodyKey);
      }
    }
    if ("productKey" in body) {
      const productKey = asString(body.productKey);
      if (productKey && !VALID_PRODUCTS.has(productKey)) {
        res.status(400).json({ error: "Ugyldig productKey" });
        return;
      }
      push("product_key", productKey, "productKey");
    }
    if ("summary" in body) push("summary", asString(body.summary), "summary");
    if ("objective" in body) push("objective", asString(body.objective), "objective");
    if ("progressPercent" in body) {
      const progress = asNumberOrNull(body.progressPercent);
      if (progress === null || !Number.isInteger(progress) || progress < 0 || progress > 100) {
        res.status(400).json({ error: "progressPercent må være et heltall mellom 0 og 100" });
        return;
      }
      push("progress_percent", progress, "progressPercent");
    }
    for (const [bodyKey, column] of [["startDate", "start_date"], ["targetDate", "target_date"]] as const) {
      if (bodyKey in body) {
        const raw = asString(body[bodyKey]);
        const date = raw ? validDate(raw) : null;
        if (raw && !date) {
          res.status(400).json({ error: `${bodyKey} må være på formatet YYYY-MM-DD` });
          return;
        }
        push(column, date, bodyKey);
      }
    }
    if ("tags" in body) push("tags", normalizedTags(body.tags), "tags");
    if (!sets.length) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }

    sets.push("updated_at = NOW()");
    params.push(session.userId);
    sets.push(`updated_by = $${params.length}`);
    params.push(req.params.id, session.userId);
    try {
      const result = await pool.query(
        `WITH updated AS (
          UPDATE admin_workspace_projects
            SET ${sets.join(", ")}
          WHERE id = $${params.length - 1} AND user_id = $${params.length}
          RETURNING *
        )
        SELECT u.*,
               u.start_date::text AS start_date,
               u.target_date::text AS target_date,
               (SELECT COUNT(*)::int FROM admin_workspace_project_links l WHERE l.project_id = u.id AND l.user_id = u.user_id) AS linked_count,
               (SELECT COUNT(*)::int FROM admin_workspace_project_links l WHERE l.project_id = u.id AND l.user_id = u.user_id AND l.entity_type = 'industry_target') AS contact_count,
               (SELECT COUNT(*)::int FROM admin_workspace_project_links l WHERE l.project_id = u.id AND l.user_id = u.user_id AND l.entity_type = 'leadgrid_lead') AS lead_count,
               (SELECT COUNT(*)::int FROM admin_workspace_project_links l WHERE l.project_id = u.id AND l.user_id = u.user_id AND l.entity_type = 'workspace_case') AS case_count
               ,(SELECT COUNT(*)::int FROM admin_workspace_project_files f WHERE f.project_id = u.id AND f.user_id = u.user_id) AS file_count
          FROM updated u`,
        params,
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Prosjektet finnes ikke" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_project",
        entityId: result.rows[0].id,
        action: "updated",
        summary: `Prosjekt oppdatert: ${result.rows[0].title} (${changed.join(", ")})`,
      });
      res.json({ item: result.rows[0] });
    } catch (error) {
      console.error("[admin-workspace projects] update error", error);
      res.status(500).json({ error: "Kunne ikke oppdatere prosjekt" });
    }
  });

  app.delete("/api/admin-room/workspace/projects/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM admin_workspace_projects
          WHERE id = $1 AND user_id = $2
          RETURNING id, title`,
        [req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Prosjektet finnes ikke" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_project",
        entityId: result.rows[0].id,
        action: "deleted",
        summary: `Prosjekt slettet: ${result.rows[0].title}`,
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("[admin-workspace projects] delete error", error);
      res.status(500).json({ error: "Kunne ikke slette prosjekt" });
    }
  });

  app.get("/api/admin-room/workspace/projects/:id/link-options", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const type = asString(req.query.entityType);
    if (type && !VALID_LINK_TYPES.has(type)) {
      res.status(400).json({ error: "Ugyldig entityType" });
      return;
    }
    try {
      const projectResult = await pool.query<{ product_key: string | null }>(
        "SELECT product_key FROM admin_workspace_projects WHERE id = $1 AND user_id = $2",
        [req.params.id, session.userId],
      );
      if (!projectResult.rows.length) {
        res.status(404).json({ error: "Prosjektet finnes ikke" });
        return;
      }
      const allowedTypes = linkTypesForProduct(projectResult.rows[0].product_key);
      if (type && !allowedTypes.includes(type as LinkType)) {
        res.status(400).json({ error: "Koblingstypen passer ikke prosjektets produkttilhørighet" });
        return;
      }
      const [options, linkedResult] = await Promise.all([
        fetchLinkOptions(pool, session.userId, type ? [type as LinkType] : allowedTypes),
        pool.query(
          `SELECT entity_type, entity_id FROM admin_workspace_project_links
            WHERE project_id = $1 AND user_id = $2`,
          [req.params.id, session.userId],
        ),
      ]);
      const linked = new Set(
        linkedResult.rows.map((item) => `${item.entity_type}:${item.entity_id}`),
      );
      res.json({
        items: options.map((option) => ({
          ...option,
          linked: linked.has(`${option.entity_type}:${option.entity_id}`),
        })),
      });
    } catch (error) {
      console.error("[admin-workspace projects] link-options error", error);
      res.status(500).json({ error: "Kunne ikke hente koblingsvalg" });
    }
  });

  app.post("/api/admin-room/workspace/projects/:id/links", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const entityType = asString(body.entityType);
    const entityId = asString(body.entityId);
    if (!entityType || !VALID_LINK_TYPES.has(entityType) || !entityId) {
      res.status(400).json({ error: "Gyldig entityType og entityId er påkrevd" });
      return;
    }
    try {
      const projectResult = await pool.query<{ title: string; product_key: string | null }>(
        "SELECT title, product_key FROM admin_workspace_projects WHERE id = $1 AND user_id = $2",
        [req.params.id, session.userId],
      );
      if (!projectResult.rows.length) {
        res.status(404).json({ error: "Prosjektet finnes ikke" });
        return;
      }
      if (!linkTypeAllowedForProduct(entityType as LinkType, projectResult.rows[0].product_key)) {
        res.status(400).json({ error: "Koblingstypen passer ikke prosjektets produkttilhørighet" });
        return;
      }
      const ownsTarget = await userOwnsLinkedEntity(
        pool,
        session.userId,
        entityType as LinkType,
        entityId,
      );
      if (!ownsTarget) {
        res.status(404).json({ error: "Elementet finnes ikke eller tilhører en annen bruker" });
        return;
      }
      const result = await pool.query(
        `INSERT INTO admin_workspace_project_links
          (project_id, user_id, entity_type, entity_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id, entity_type, entity_id) DO NOTHING
         RETURNING *`,
        [req.params.id, session.userId, entityType, entityId],
      );
      if (!result.rows.length) {
        res.status(409).json({ error: "Elementet er allerede koblet til prosjektet" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_project",
        entityId: req.params.id,
        action: "linked",
        summary: `${entityType} koblet til prosjekt: ${projectResult.rows[0].title}`,
        details: { linkedEntityType: entityType, linkedEntityId: entityId },
      });
      res.status(201).json({ item: result.rows[0] });
    } catch (error) {
      console.error("[admin-workspace projects] link error", error);
      res.status(500).json({ error: "Kunne ikke koble elementet" });
    }
  });

  app.delete("/api/admin-room/workspace/projects/:id/links/:linkId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM admin_workspace_project_links
          WHERE id = $1 AND project_id = $2 AND user_id = $3
          RETURNING entity_type, entity_id`,
        [req.params.linkId, req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Koblingen finnes ikke" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_project",
        entityId: req.params.id,
        action: "unlinked",
        summary: `${result.rows[0].entity_type} fjernet fra prosjekt`,
        details: { linkedEntityId: result.rows[0].entity_id },
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("[admin-workspace projects] unlink error", error);
      res.status(500).json({ error: "Kunne ikke fjerne koblingen" });
    }
  });

  app.get("/api/admin-room/workspace/projects/:id/files", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const project = await pool.query(
        "SELECT id FROM admin_workspace_projects WHERE id::text = $1 AND user_id::text = $2",
        [req.params.id, session.userId],
      );
      if (!project.rows.length) {
        res.status(404).json({ error: "Prosjektet finnes ikke" });
        return;
      }
      const result = await pool.query(
        `SELECT f.id::text, f.project_id::text, f.file_name, f.mime_type,
                f.file_size, f.sha256, f.version_no, f.context_enabled,
                f.extraction_status, f.extraction_method, f.extraction_error,
                f.extraction_metadata, f.extracted_at, f.created_at, f.updated_at,
                COALESCE((f.extraction_metadata->>'characterCount')::int, 0) AS character_count,
                (SELECT COUNT(*)::int
                   FROM admin_document_links dl
                  WHERE dl.user_id = f.user_id
                    AND dl.entity_type = 'workspace_project'
                    AND dl.entity_id = f.project_id::text) AS linked_document_count
           FROM admin_workspace_project_files f
          WHERE f.project_id::text = $1 AND f.user_id::text = $2
          ORDER BY f.updated_at DESC, f.file_name`,
        [req.params.id, session.userId],
      );
      res.json({ items: result.rows });
    } catch (error) {
      console.error("[admin-workspace projects] list files error", error);
      res.status(500).json({ error: "Kunne ikke hente prosjektfilene" });
    }
  });

  app.post("/api/admin-room/workspace/projects/:id/files", (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    upload.single("file")(req, res, async (uploadError: unknown) => {
      if (uploadError) {
        const tooLarge = uploadError instanceof multer.MulterError && uploadError.code === "LIMIT_FILE_SIZE";
        res.status(400).json({
          error: tooLarge ? "Prosjektfilen kan være maksimalt 15 MB" : "Kunne ikke lese prosjektfilen",
        });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "Velg en fil" });
        return;
      }
      if (!ALLOWED_PROJECT_FILE_MIME.has(req.file.mimetype)) {
        res.status(400).json({ error: "Filtypen støttes ikke" });
        return;
      }
      try {
        const project = await pool.query<{ title: string }>(
          "SELECT title FROM admin_workspace_projects WHERE id::text = $1 AND user_id::text = $2",
          [req.params.id, session.userId],
        );
        if (!project.rows.length) {
          res.status(404).json({ error: "Prosjektet finnes ikke" });
          return;
        }
        const fileName = projectFileName(req.file.originalname);
        const sha256 = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
        const duplicate = await pool.query(
          `SELECT id FROM admin_workspace_project_files
            WHERE project_id::text = $1 AND user_id::text = $2 AND sha256 = $3`,
          [req.params.id, session.userId, sha256],
        );
        if (duplicate.rows.length) {
          res.status(409).json({ error: "Den samme filversjonen finnes allerede i prosjektet" });
          return;
        }
        const result = await pool.query(
          `INSERT INTO admin_workspace_project_files
             (project_id, user_id, file_name, mime_type, file_size, file_data, sha256)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id::text, project_id::text, file_name, mime_type, file_size,
                     sha256, version_no, context_enabled, extraction_status,
                     extraction_method, extraction_error, extraction_metadata,
                     extracted_at, created_at, updated_at`,
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
        const file = result.rows[0];
        const indexed = await indexAdminWorkspaceProjectFile({
          pool,
          fileId: file.id,
          projectId: file.project_id,
          userId: session.userId,
          fileName,
          mimeType: req.file.mimetype,
          buffer: req.file.buffer,
        });
        await logAdminActivity({
          userId: session.userId,
          entityType: "workspace_project",
          entityId: req.params.id,
          action: "file_added",
          summary: `La «${fileName}» til prosjektet «${project.rows[0].title}»`,
          details: {
            fileId: file.id,
            size: req.file.size,
            mimeType: req.file.mimetype,
            extractionStatus: indexed.status,
          },
        });
        res.status(201).json({
          item: {
            ...file,
            extraction_status: indexed.status,
            extraction_method: indexed.method,
            extraction_error: indexed.error,
            extraction_metadata: indexed.metadata,
            character_count: indexed.characterCount,
          },
        });
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          res.status(409).json({ error: "Den samme filversjonen finnes allerede i prosjektet" });
          return;
        }
        console.error("[admin-workspace projects] upload file error", error);
        res.status(500).json({ error: "Kunne ikke lagre prosjektfilen" });
      }
    });
  });

  app.post("/api/admin-room/workspace/projects/:id/files/:fileId/replace", (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    upload.single("file")(req, res, async (uploadError: unknown) => {
      if (uploadError) {
        const tooLarge = uploadError instanceof multer.MulterError && uploadError.code === "LIMIT_FILE_SIZE";
        res.status(400).json({
          error: tooLarge ? "Prosjektfilen kan være maksimalt 15 MB" : "Kunne ikke lese prosjektfilen",
        });
        return;
      }
      if (!req.file || !ALLOWED_PROJECT_FILE_MIME.has(req.file.mimetype)) {
        res.status(400).json({ error: req.file ? "Filtypen støttes ikke" : "Velg en fil" });
        return;
      }
      try {
        const fileName = projectFileName(req.file.originalname);
        const sha256 = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
        const result = await pool.query(
          `UPDATE admin_workspace_project_files
              SET file_name = $4, mime_type = $5, file_size = $6,
                  file_data = $7, sha256 = $8, version_no = version_no + 1,
                  extraction_status = 'pending', extraction_method = NULL,
                  extraction_error = NULL, extraction_metadata = '{}'::jsonb,
                  extracted_at = NULL, updated_at = NOW()
            WHERE id::text = $1 AND project_id::text = $2 AND user_id::text = $3
            RETURNING id::text, project_id::text, file_name, version_no`,
          [
            req.params.fileId,
            req.params.id,
            session.userId,
            fileName,
            req.file.mimetype,
            req.file.size,
            req.file.buffer,
            sha256,
          ],
        );
        if (!result.rows.length) {
          res.status(404).json({ error: "Prosjektfilen finnes ikke" });
          return;
        }
        const indexed = await indexAdminWorkspaceProjectFile({
          pool,
          fileId: result.rows[0].id,
          projectId: result.rows[0].project_id,
          userId: session.userId,
          fileName,
          mimeType: req.file.mimetype,
          buffer: req.file.buffer,
        });
        await logAdminActivity({
          userId: session.userId,
          entityType: "workspace_project",
          entityId: req.params.id,
          action: "file_replaced",
          summary: `Lastet opp versjon ${result.rows[0].version_no} av «${fileName}»`,
          details: { fileId: result.rows[0].id, versionNo: result.rows[0].version_no },
        });
        res.json({ item: { ...result.rows[0], ...indexed } });
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          res.status(409).json({ error: "Denne filversjonen finnes allerede i prosjektet" });
          return;
        }
        console.error("[admin-workspace projects] replace file error", error);
        res.status(500).json({ error: "Kunne ikke erstatte prosjektfilen" });
      }
    });
  });

  app.patch("/api/admin-room/workspace/projects/:id/files/:fileId/context", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    if (typeof req.body?.enabled !== "boolean") {
      res.status(400).json({ error: "enabled må være true eller false" });
      return;
    }
    try {
      const result = await pool.query(
        `UPDATE admin_workspace_project_files
            SET context_enabled = $4, updated_at = NOW()
          WHERE id::text = $1 AND project_id::text = $2 AND user_id::text = $3
          RETURNING id::text, context_enabled`,
        [req.params.fileId, req.params.id, session.userId, req.body.enabled],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Prosjektfilen finnes ikke" });
        return;
      }
      res.json({ item: result.rows[0] });
    } catch (error) {
      console.error("[admin-workspace projects] toggle file context error", error);
      res.status(500).json({ error: "Kunne ikke endre prosjektkilden" });
    }
  });

  app.post("/api/admin-room/workspace/projects/:id/files/:fileId/reindex", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT id::text, project_id::text, file_name, mime_type, file_data
           FROM admin_workspace_project_files
          WHERE id::text = $1 AND project_id::text = $2 AND user_id::text = $3`,
        [req.params.fileId, req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Prosjektfilen finnes ikke" });
        return;
      }
      const file = result.rows[0];
      const indexed = await indexAdminWorkspaceProjectFile({
        pool,
        fileId: file.id,
        projectId: file.project_id,
        userId: session.userId,
        fileName: file.file_name,
        mimeType: file.mime_type,
        buffer: file.file_data,
      });
      res.json({ item: indexed });
    } catch (error) {
      console.error("[admin-workspace projects] reindex file error", error);
      res.status(500).json({ error: "Kunne ikke indeksere prosjektfilen" });
    }
  });

  app.get("/api/admin-room/workspace/projects/:id/files/:fileId/download", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT file_name, mime_type, file_data
           FROM admin_workspace_project_files
          WHERE id::text = $1 AND project_id::text = $2 AND user_id::text = $3`,
        [req.params.fileId, req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Prosjektfilen finnes ikke" });
        return;
      }
      const file = result.rows[0];
      res.setHeader("Content-Type", file.mime_type || "application/octet-stream");
      res.setHeader("Content-Disposition", contentDisposition(file.file_name));
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(file.file_data);
    } catch (error) {
      console.error("[admin-workspace projects] download file error", error);
      res.status(500).json({ error: "Kunne ikke laste ned prosjektfilen" });
    }
  });

  app.delete("/api/admin-room/workspace/projects/:id/files/:fileId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM admin_workspace_project_files
          WHERE id::text = $1 AND project_id::text = $2 AND user_id::text = $3
          RETURNING file_name`,
        [req.params.fileId, req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Prosjektfilen finnes ikke" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_project",
        entityId: req.params.id,
        action: "file_deleted",
        summary: `Fjernet prosjektfilen «${result.rows[0].file_name}»`,
        details: { fileId: req.params.fileId },
      });
      res.json({ deleted: true });
    } catch (error) {
      console.error("[admin-workspace projects] delete file error", error);
      res.status(500).json({ error: "Kunne ikke fjerne prosjektfilen" });
    }
  });
}
