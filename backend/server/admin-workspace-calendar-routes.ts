/**
 * Kalender for Admin Workspace.
 *
 * Egne adminhendelser er skrivbare. Oppgave-, saks-, prosjekt-, støtte- og
 * markedsfrister normaliseres til samme feed, men redigeres i kildemodulen.
 * Produksjons- og castingkalendere blandes ikke inn.
 */

import type { Pool } from "pg";
import type { AdminRoomRoutesDeps } from "./_shared";
import { asString, readBoolean, readStringArray } from "./_shared";

const VALID_PRODUCTS = new Set(["role_room", "leadgrid"]);
const VALID_EVENT_TYPES = new Set(["meeting", "focus", "reminder", "deadline", "follow_up", "other"]);
const VALID_STATUSES = new Set(["confirmed", "tentative", "cancelled"]);
const VALID_SOURCES = new Set([
  "calendar_event",
  "task",
  "case",
  "project",
  "funding_app",
  "funding_opportunity",
  "industry_follow_up",
  "leadgrid_follow_up",
  "partner_follow_up",
  "investor_follow_up",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type ProductKey = "role_room" | "leadgrid";

interface ContextRow {
  id: string;
  title: string;
  product_key: ProductKey | null;
}

class CalendarInputError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function validDate(value: unknown): string | null {
  const date = asString(value);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

function validTimestamp(value: unknown, field: string): Date {
  const raw = asString(value);
  if (!raw) throw new CalendarInputError(400, `${field} er påkrevd`);
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    throw new CalendarInputError(400, `${field} må være et gyldig ISO-tidspunkt`);
  }
  return date;
}

function nullableUuid(value: unknown, field: string): string | null {
  const id = asString(value);
  if (!id) return null;
  if (!UUID_PATTERN.test(id)) {
    throw new CalendarInputError(400, `${field} må være en gyldig UUID`);
  }
  return id;
}

function limitedText(value: unknown, field: string, maxLength: number): string | null {
  const text = asString(value);
  if (text && text.length > maxLength) {
    throw new CalendarInputError(400, `${field} kan være maks ${maxLength} tegn`);
  }
  return text;
}

function normalizedTags(value: unknown): string[] {
  return readStringArray(value)
    .map((tag) => tag.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 20);
}

function validHttpUrl(value: unknown): string | null {
  const raw = limitedText(value, "meetingUrl", 2_000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new CalendarInputError(400, "meetingUrl må være en gyldig http/https-URL");
  }
}

function parseSourceFilter(value: unknown): Set<string> | null {
  const values = (Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [])
    .map((item) => String(item).trim())
    .filter((item) => VALID_SOURCES.has(item));
  return values.length ? new Set(values) : null;
}

function sourceEnabled(filter: Set<string> | null, source: string): boolean {
  return !filter || filter.has(source);
}

function productCondition(
  alias: string,
  product: string | null,
  params: unknown[],
): string {
  if (product === "internal") return `${alias}.product_key IS NULL`;
  if (product && VALID_PRODUCTS.has(product)) {
    params.push(product);
    return `(${alias}.product_key IS NULL OR ${alias}.product_key = $${params.length})`;
  }
  return "TRUE";
}

async function resolveContext(
  pool: Pool,
  userId: string,
  requestedProduct: ProductKey | null,
  projectId: string | null,
  caseId: string | null,
): Promise<ProductKey | null> {
  const [projectResult, caseResult] = await Promise.all([
    projectId
      ? pool.query<ContextRow>(
          `SELECT id::text, title, product_key
             FROM admin_workspace_projects
            WHERE id = $1 AND user_id = $2`,
          [projectId, userId],
        )
      : Promise.resolve({ rows: [] as ContextRow[] }),
    caseId
      ? pool.query<ContextRow>(
          `SELECT id::text, title, product_key
             FROM admin_workspace_cases
            WHERE id = $1 AND user_id = $2`,
          [caseId, userId],
        )
      : Promise.resolve({ rows: [] as ContextRow[] }),
  ]);
  const project = projectResult.rows[0] ?? null;
  const workspaceCase = caseResult.rows[0] ?? null;
  if (projectId && !project) {
    throw new CalendarInputError(404, "Prosjektet finnes ikke eller tilhører en annen bruker");
  }
  if (caseId && !workspaceCase) {
    throw new CalendarInputError(404, "Saken finnes ikke eller tilhører en annen bruker");
  }

  const linkedProducts = new Set(
    [project?.product_key, workspaceCase?.product_key].filter(
      (value): value is ProductKey => value === "role_room" || value === "leadgrid",
    ),
  );
  if (linkedProducts.size > 1) {
    throw new CalendarInputError(400, "Prosjektet og saken tilhører ulike produkter");
  }
  const linkedProduct = linkedProducts.values().next().value as ProductKey | undefined;
  if (requestedProduct && linkedProduct && requestedProduct !== linkedProduct) {
    throw new CalendarInputError(400, "Hendelsen og den koblede konteksten må tilhøre samme produkt");
  }
  return requestedProduct ?? linkedProduct ?? null;
}

const CUSTOM_EVENT_SELECT = `
  SELECT
    ('calendar_event:' || e.id::text) AS id,
    e.id::text AS entity_id,
    'calendar_event'::text AS source,
    e.title,
    e.description,
    e.starts_at::text,
    e.ends_at::text,
    e.all_day,
    e.product_key,
    e.event_type,
    e.status,
    NULL::text AS priority,
    e.location,
    e.meeting_url,
    e.assignee,
    e.project_id::text,
    p.title AS project_title,
    e.case_id::text,
    c.title AS case_title,
    e.tags,
    TRUE AS editable,
    NULL::text AS link_path,
    e.time_zone,
    e.created_at::text,
    e.updated_at::text
  FROM admin_workspace_calendar_events e
  LEFT JOIN admin_workspace_projects p
    ON p.id = e.project_id AND p.user_id = e.user_id
  LEFT JOIN admin_workspace_cases c
    ON c.id = e.case_id AND c.user_id = e.user_id
`;

async function fetchCustomEvent(pool: Pool, id: string, userId: string): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    `${CUSTOM_EVENT_SELECT} WHERE e.id = $1 AND e.user_id = $2`,
    [id, userId],
  );
  return result.rows[0] ?? null;
}

function sendCalendarError(
  res: Parameters<AdminRoomRoutesDeps["requireAdminRoomAccess"]>[1],
  error: unknown,
): boolean {
  if (!(error instanceof CalendarInputError)) return false;
  res.status(error.statusCode).json({ error: error.message });
  return true;
}

export function setupAdminWorkspaceCalendarRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  app.get("/api/admin-room/workspace/calendar", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const now = new Date();
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 7);
    const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 7));
    const from = validDate(req.query.from) ?? defaultFrom.toISOString().slice(0, 10);
    const to = validDate(req.query.to) ?? defaultTo.toISOString().slice(0, 10);
    const fromTime = new Date(`${from}T00:00:00.000Z`).getTime();
    const toTime = new Date(`${to}T00:00:00.000Z`).getTime();
    if (toTime < fromTime || toTime - fromTime > 370 * 86_400_000) {
      res.status(400).json({ error: "Datointervallet må være mellom 0 og 370 dager" });
      return;
    }
    const product = asString(req.query.product);
    if (product && product !== "internal" && product !== "all" && !VALID_PRODUCTS.has(product)) {
      res.status(400).json({ error: "Ugyldig product-filter" });
      return;
    }
    const sources = parseSourceFilter(req.query.sources);
    const items: Record<string, unknown>[] = [];

    try {
      if (sourceEnabled(sources, "calendar_event")) {
        const params: unknown[] = [session.userId, from, to];
        const productSql = productCondition("e", product, params);
        const result = await pool.query(
          `${CUSTOM_EVENT_SELECT}
            WHERE e.user_id = $1
              AND e.ends_at > $2::date
              AND e.starts_at < ($3::date + INTERVAL '1 day')
              AND ${productSql}`,
          params,
        );
        items.push(...result.rows);
      }

      if (sourceEnabled(sources, "task")) {
        const params: unknown[] = [session.userId, from, to];
        const productSql = productCondition("t", product, params);
        const result = await pool.query(
          `SELECT
              ('task:' || t.id::text) AS id, t.id::text AS entity_id,
              'task'::text AS source, t.title, t.description,
              t.due_date::text AS starts_at, t.due_date::text AS ends_at,
              TRUE AS all_day, t.product_key, 'deadline'::text AS event_type,
              t.status, t.priority, NULL::text AS location, NULL::text AS meeting_url,
              t.assignee, t.project_id::text, p.title AS project_title,
              t.case_id::text, c.title AS case_title, t.tags, FALSE AS editable,
              ('/admin-workspace?view=tasks&taskId=' || t.id::text) AS link_path,
              'Europe/Oslo'::text AS time_zone, t.created_at::text, t.updated_at::text
             FROM admin_workspace_tasks t
             LEFT JOIN admin_workspace_projects p ON p.id = t.project_id AND p.user_id = t.user_id
             LEFT JOIN admin_workspace_cases c ON c.id = t.case_id AND c.user_id = t.user_id
            WHERE t.user_id = $1
              AND t.due_date BETWEEN $2::date AND $3::date
              AND t.status <> 'cancelled'
              AND ${productSql}`,
          params,
        );
        items.push(...result.rows);
      }

      if (sourceEnabled(sources, "case")) {
        const params: unknown[] = [session.userId, from, to];
        const productSql = productCondition("c", product, params);
        const result = await pool.query(
          `SELECT
              ('case:' || c.id::text) AS id, c.id::text AS entity_id,
              'case'::text AS source, c.title, c.body AS description,
              c.due_date::text AS starts_at, c.due_date::text AS ends_at,
              TRUE AS all_day, c.product_key, 'deadline'::text AS event_type,
              c.status, c.priority, NULL::text AS location, NULL::text AS meeting_url,
              NULL::text AS assignee, NULL::text AS project_id, NULL::text AS project_title,
              c.id::text AS case_id, c.title AS case_title, c.tags, FALSE AS editable,
              ('/admin-workspace?view=cases&caseId=' || c.id::text) AS link_path,
              'Europe/Oslo'::text AS time_zone, c.created_at::text, c.updated_at::text
             FROM admin_workspace_cases c
            WHERE c.user_id = $1
              AND c.due_date BETWEEN $2::date AND $3::date
              AND c.status <> 'archived'
              AND ${productSql}`,
          params,
        );
        items.push(...result.rows);
      }

      if (sourceEnabled(sources, "project")) {
        const params: unknown[] = [session.userId, from, to];
        const productSql = productCondition("p", product, params);
        const result = await pool.query(
          `SELECT
              ('project:' || p.id::text) AS id, p.id::text AS entity_id,
              'project'::text AS source, p.title, COALESCE(p.objective, p.summary) AS description,
              p.target_date::text AS starts_at, p.target_date::text AS ends_at,
              TRUE AS all_day, p.product_key, 'deadline'::text AS event_type,
              p.status, p.priority, NULL::text AS location, NULL::text AS meeting_url,
              NULL::text AS assignee, p.id::text AS project_id, p.title AS project_title,
              NULL::text AS case_id, NULL::text AS case_title, p.tags, FALSE AS editable,
              ('/admin-workspace?view=projects&projectId=' || p.id::text) AS link_path,
              'Europe/Oslo'::text AS time_zone, p.created_at::text, p.updated_at::text
             FROM admin_workspace_projects p
            WHERE p.user_id = $1
              AND p.target_date BETWEEN $2::date AND $3::date
              AND p.status <> 'archived'
              AND ${productSql}`,
          params,
        );
        items.push(...result.rows);
      }

      if (sourceEnabled(sources, "funding_opportunity")) {
        const params: unknown[] = [session.userId, from, to];
        const productSql = productCondition("o", product, params);
        const result = await pool.query(
          `SELECT
              ('funding_opportunity:' || o.id::text) AS id, o.id::text AS entity_id,
              'funding_opportunity'::text AS source,
              (o.provider || ' · ' || o.scheme_name) AS title, o.description,
              o.deadline::text AS starts_at, o.deadline::text AS ends_at,
              TRUE AS all_day, o.product_key, 'deadline'::text AS event_type,
              o.status, 'high'::text AS priority, NULL::text AS location,
              NULL::text AS meeting_url, o.assignee,
              NULL::text AS project_id, NULL::text AS project_title,
              NULL::text AS case_id, NULL::text AS case_title, o.tags,
              FALSE AS editable, NULL::text AS link_path,
              o.source_url AS external_url,
              'Europe/Oslo'::text AS time_zone, o.created_at::text, o.updated_at::text
             FROM admin_workspace_funding_opportunities o
            WHERE o.user_id = $1
              AND o.deadline BETWEEN $2::date AND $3::date
              AND o.status NOT IN ('closed', 'not_relevant')
              AND ${productSql}`,
          params,
        );
        items.push(...result.rows);
      }

      if (sourceEnabled(sources, "funding_app")) {
        const result = await pool.query(
          `SELECT
              ('funding_app:' || f.id::text) AS id, f.id::text AS entity_id,
              'funding_app'::text AS source, f.project_name AS title, f.description,
              f.deadline::text AS starts_at, f.deadline::text AS ends_at,
              TRUE AS all_day, NULL::text AS product_key, 'deadline'::text AS event_type,
              f.status, NULL::text AS priority, NULL::text AS location, NULL::text AS meeting_url,
              f.contact_person AS assignee, NULL::text AS project_id, NULL::text AS project_title,
              NULL::text AS case_id, NULL::text AS case_title, ARRAY['støtte']::text[] AS tags,
              FALSE AS editable,
              ('/admin-workspace?view=funding&fundingId=' || f.id::text) AS link_path,
              'Europe/Oslo'::text AS time_zone, f.created_at::text, f.updated_at::text
             FROM admin_funding_apps f
            WHERE f.user_id = $1
              AND f.deadline BETWEEN $2::date AND $3::date
              AND f.status <> 'withdrawn'`,
          [session.userId, from, to],
        );
        items.push(...result.rows);
      }

      if (sourceEnabled(sources, "industry_follow_up") && (!product || product === "all" || product === "role_room")) {
        const result = await pool.query(
          `SELECT
              ('industry_follow_up:' || i.id::text) AS id, i.id::text AS entity_id,
              'industry_follow_up'::text AS source,
              ('Følg opp ' || i.full_name || COALESCE(' · ' || NULLIF(i.company, ''), '')) AS title,
              i.notes AS description, i.next_action_due::text AS starts_at,
              i.next_action_due::text AS ends_at, TRUE AS all_day,
              'role_room'::text AS product_key, 'follow_up'::text AS event_type,
              i.status, NULL::text AS priority, NULL::text AS location, NULL::text AS meeting_url,
              i.full_name AS assignee, NULL::text AS project_id, NULL::text AS project_title,
              NULL::text AS case_id, NULL::text AS case_title, ARRAY['markedskontakt']::text[] AS tags,
              FALSE AS editable,
              ('/admin-workspace?view=industry-crm&targetId=' || i.id::text) AS link_path,
              'Europe/Oslo'::text AS time_zone, i.created_at::text, i.updated_at::text
             FROM role_room_industry_targets i
            WHERE i.user_id::text = $1
              AND i.next_action_due BETWEEN $2::date AND $3::date`,
          [session.userId, from, to],
        );
        items.push(...result.rows);
      }

      if (sourceEnabled(sources, "leadgrid_follow_up") && (!product || product === "all" || product === "leadgrid")) {
        const result = await pool.query(
          `SELECT
              ('leadgrid_follow_up:' || l.id::text) AS id, l.id::text AS entity_id,
              'leadgrid_follow_up'::text AS source,
              ('Følg opp ' || COALESCE(NULLIF(l.company, ''), NULLIF(l.name, ''), 'navnløs lead')) AS title,
              l.notes AS description, l.next_follow_up_at::text AS starts_at,
              (l.next_follow_up_at + INTERVAL '30 minutes')::text AS ends_at, FALSE AS all_day,
              'leadgrid'::text AS product_key, 'follow_up'::text AS event_type,
              COALESCE(l.lead_status, l.status) AS status, NULL::text AS priority,
              NULL::text AS location, NULL::text AS meeting_url, l.name AS assignee,
              NULL::text AS project_id, NULL::text AS project_title,
              NULL::text AS case_id, NULL::text AS case_title, ARRAY['leadgrid']::text[] AS tags,
              FALSE AS editable,
              ('/admin-workspace?view=marketing-cockpit&leadId=' || l.id::text) AS link_path,
              'Europe/Oslo'::text AS time_zone, l.created_at::text, l.updated_at::text
             FROM crm_customers l
            WHERE l.owner_user_id::text = $1
              AND l.next_follow_up_at >= $2::date
              AND l.next_follow_up_at < ($3::date + INTERVAL '1 day')
              AND l.agent_config_id IS NULL
              AND l.archived_at IS NULL`,
          [session.userId, from, to],
        );
        items.push(...result.rows);
      }

      for (const source of ["partner_follow_up", "investor_follow_up"] as const) {
        if (!sourceEnabled(sources, source)) continue;
        const table = source === "partner_follow_up" ? "admin_partner_contacts" : "admin_investor_contacts";
        const view = source === "partner_follow_up" ? "partners" : "investors";
        const result = await pool.query(
          `SELECT
              ($3::text || ':' || x.id::text) AS id, x.id::text AS entity_id,
              $3::text AS source, ('Følg opp ' || x.company_name) AS title,
              x.notes AS description, x.next_step_due::text AS starts_at,
              x.next_step_due::text AS ends_at, TRUE AS all_day,
              NULL::text AS product_key, 'follow_up'::text AS event_type,
              x.status, NULL::text AS priority, NULL::text AS location, NULL::text AS meeting_url,
              x.contact_name AS assignee, NULL::text AS project_id, NULL::text AS project_title,
              NULL::text AS case_id, NULL::text AS case_title, ARRAY['oppfølging']::text[] AS tags,
              FALSE AS editable,
              ('/admin-workspace?view=${view}&contactId=' || x.id::text) AS link_path,
              'Europe/Oslo'::text AS time_zone, x.created_at::text, x.updated_at::text
             FROM ${table} x
            WHERE x.user_id = $1
              AND x.next_step_due BETWEEN $2::date AND $4::date`,
          [session.userId, from, source, to],
        );
        items.push(...result.rows);
      }

      items.sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
      res.json({ items, range: { from, to } });
    } catch (error) {
      console.error("[admin-workspace calendar] list error", error);
      res.status(500).json({ error: "Kunne ikke hente kalenderen" });
    }
  });

  app.get("/api/admin-room/workspace/calendar/options", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const [projects, cases] = await Promise.all([
        pool.query(
          `SELECT id::text, title, product_key, status
             FROM admin_workspace_projects
            WHERE user_id = $1 AND status <> 'archived'
            ORDER BY updated_at DESC LIMIT 200`,
          [session.userId],
        ),
        pool.query(
          `SELECT id::text, title, product_key, status
             FROM admin_workspace_cases
            WHERE user_id = $1 AND status <> 'archived'
            ORDER BY updated_at DESC LIMIT 200`,
          [session.userId],
        ),
      ]);
      res.json({ projects: projects.rows, cases: cases.rows });
    } catch (error) {
      console.error("[admin-workspace calendar] options error", error);
      res.status(500).json({ error: "Kunne ikke hente kalenderkoblinger" });
    }
  });

  app.get("/api/admin-room/workspace/calendar/events/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    if (!UUID_PATTERN.test(req.params.id)) {
      res.status(400).json({ error: "Ugyldig hendelses-ID" });
      return;
    }
    try {
      const item = await fetchCustomEvent(pool, req.params.id, session.userId);
      if (!item) {
        res.status(404).json({ error: "Hendelsen finnes ikke" });
        return;
      }
      res.json({ item });
    } catch (error) {
      console.error("[admin-workspace calendar] read error", error);
      res.status(500).json({ error: "Kunne ikke hente hendelsen" });
    }
  });

  app.post("/api/admin-room/workspace/calendar/events", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;

    try {
      const title = limitedText(body.title, "title", 240);
      if (!title) throw new CalendarInputError(400, "title er påkrevd");
      const eventType = asString(body.eventType, "meeting") ?? "meeting";
      const status = asString(body.status, "confirmed") ?? "confirmed";
      if (!VALID_EVENT_TYPES.has(eventType) || !VALID_STATUSES.has(status)) {
        throw new CalendarInputError(400, "Ugyldig eventType eller status");
      }
      const rawProduct = asString(body.productKey);
      if (rawProduct && !VALID_PRODUCTS.has(rawProduct)) {
        throw new CalendarInputError(400, "Ugyldig productKey");
      }
      const startsAt = validTimestamp(body.startsAt, "startsAt");
      const endsAt = validTimestamp(body.endsAt, "endsAt");
      if (endsAt <= startsAt) {
        throw new CalendarInputError(400, "endsAt må være etter startsAt");
      }
      if (endsAt.getTime() - startsAt.getTime() > 370 * 86_400_000) {
        throw new CalendarInputError(400, "Hendelsen kan ikke vare mer enn 370 dager");
      }
      const projectId = nullableUuid(body.projectId, "projectId");
      const caseId = nullableUuid(body.caseId, "caseId");
      const productKey = await resolveContext(
        pool,
        session.userId,
        rawProduct as ProductKey | null,
        projectId,
        caseId,
      );
      const allDay = readBoolean(body.allDay) ?? false;

      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO admin_workspace_calendar_events
          (user_id, product_key, title, description, event_type, status,
           starts_at, ends_at, all_day, time_zone, location, meeting_url,
           assignee, project_id, case_id, tags, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Europe/Oslo',
                 $10, $11, $12, $13, $14, $15, $1)
         RETURNING id::text`,
        [
          session.userId,
          productKey,
          title,
          limitedText(body.description, "description", 20_000),
          eventType,
          status,
          startsAt,
          endsAt,
          allDay,
          limitedText(body.location, "location", 300),
          validHttpUrl(body.meetingUrl),
          limitedText(body.assignee, "assignee", 160),
          projectId,
          caseId,
          normalizedTags(body.tags),
        ],
      );
      const item = await fetchCustomEvent(pool, inserted.rows[0].id, session.userId);
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_calendar_event",
        entityId: inserted.rows[0].id,
        action: "created",
        summary: `Kalenderhendelse opprettet: ${title}`,
      });
      res.status(201).json({ item });
    } catch (error) {
      if (sendCalendarError(res, error)) return;
      console.error("[admin-workspace calendar] create error", error);
      res.status(500).json({ error: "Kunne ikke opprette kalenderhendelse" });
    }
  });

  app.patch("/api/admin-room/workspace/calendar/events/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    if (!UUID_PATTERN.test(req.params.id)) {
      res.status(400).json({ error: "Ugyldig hendelses-ID" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;

    try {
      const currentResult = await pool.query<{
        product_key: ProductKey | null;
        project_id: string | null;
        case_id: string | null;
        starts_at: Date;
        ends_at: Date;
      }>(
        `SELECT product_key, project_id::text, case_id::text, starts_at, ends_at
           FROM admin_workspace_calendar_events
          WHERE id = $1 AND user_id = $2`,
        [req.params.id, session.userId],
      );
      const current = currentResult.rows[0];
      if (!current) {
        res.status(404).json({ error: "Hendelsen finnes ikke" });
        return;
      }

      let requestedProduct = current.product_key;
      if ("productKey" in body) {
        const value = asString(body.productKey);
        if (value && !VALID_PRODUCTS.has(value)) {
          throw new CalendarInputError(400, "Ugyldig productKey");
        }
        requestedProduct = value as ProductKey | null;
      }
      const projectId = "projectId" in body
        ? nullableUuid(body.projectId, "projectId")
        : current.project_id;
      const caseId = "caseId" in body
        ? nullableUuid(body.caseId, "caseId")
        : current.case_id;
      const productKey = await resolveContext(
        pool,
        session.userId,
        requestedProduct,
        projectId,
        caseId,
      );
      const startsAt = "startsAt" in body
        ? validTimestamp(body.startsAt, "startsAt")
        : new Date(current.starts_at);
      const endsAt = "endsAt" in body
        ? validTimestamp(body.endsAt, "endsAt")
        : new Date(current.ends_at);
      if (endsAt <= startsAt) {
        throw new CalendarInputError(400, "endsAt må være etter startsAt");
      }
      if (endsAt.getTime() - startsAt.getTime() > 370 * 86_400_000) {
        throw new CalendarInputError(400, "Hendelsen kan ikke vare mer enn 370 dager");
      }

      const sets: string[] = [];
      const params: unknown[] = [];
      const changed: string[] = [];
      const push = (column: string, value: unknown, field: string) => {
        params.push(value);
        sets.push(`${column} = $${params.length}`);
        changed.push(field);
      };

      if ("title" in body) {
        const title = limitedText(body.title, "title", 240);
        if (!title) throw new CalendarInputError(400, "title kan ikke være tom");
        push("title", title, "title");
      }
      if ("description" in body) push("description", limitedText(body.description, "description", 20_000), "description");
      if ("eventType" in body) {
        const value = asString(body.eventType);
        if (!value || !VALID_EVENT_TYPES.has(value)) throw new CalendarInputError(400, "Ugyldig eventType");
        push("event_type", value, "eventType");
      }
      if ("status" in body) {
        const value = asString(body.status);
        if (!value || !VALID_STATUSES.has(value)) throw new CalendarInputError(400, "Ugyldig status");
        push("status", value, "status");
      }
      if ("startsAt" in body) push("starts_at", startsAt, "startsAt");
      if ("endsAt" in body) push("ends_at", endsAt, "endsAt");
      if ("allDay" in body) push("all_day", readBoolean(body.allDay) ?? false, "allDay");
      if ("location" in body) push("location", limitedText(body.location, "location", 300), "location");
      if ("meetingUrl" in body) push("meeting_url", validHttpUrl(body.meetingUrl), "meetingUrl");
      if ("assignee" in body) push("assignee", limitedText(body.assignee, "assignee", 160), "assignee");
      if ("tags" in body) push("tags", normalizedTags(body.tags), "tags");
      if ("productKey" in body || "projectId" in body || "caseId" in body) {
        push("product_key", productKey, "productKey");
        push("project_id", projectId, "projectId");
        push("case_id", caseId, "caseId");
      }
      if (!sets.length) throw new CalendarInputError(400, "Ingen felter å oppdatere");

      sets.push("updated_at = NOW()");
      params.push(session.userId);
      sets.push(`updated_by = $${params.length}`);
      params.push(req.params.id, session.userId);
      await pool.query(
        `UPDATE admin_workspace_calendar_events
            SET ${sets.join(", ")}
          WHERE id = $${params.length - 1} AND user_id = $${params.length}`,
        params,
      );
      const item = await fetchCustomEvent(pool, req.params.id, session.userId);
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_calendar_event",
        entityId: req.params.id,
        action: "updated",
        summary: `Kalenderhendelse oppdatert: ${String(item?.title ?? req.params.id)} (${changed.join(", ")})`,
      });
      res.json({ item });
    } catch (error) {
      if (sendCalendarError(res, error)) return;
      console.error("[admin-workspace calendar] update error", error);
      res.status(500).json({ error: "Kunne ikke oppdatere kalenderhendelse" });
    }
  });

  app.delete("/api/admin-room/workspace/calendar/events/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    if (!UUID_PATTERN.test(req.params.id)) {
      res.status(400).json({ error: "Ugyldig hendelses-ID" });
      return;
    }
    try {
      const result = await pool.query<{ id: string; title: string }>(
        `DELETE FROM admin_workspace_calendar_events
          WHERE id = $1 AND user_id = $2
          RETURNING id::text, title`,
        [req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Hendelsen finnes ikke" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_calendar_event",
        entityId: result.rows[0].id,
        action: "deleted",
        summary: `Kalenderhendelse slettet: ${result.rows[0].title}`,
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("[admin-workspace calendar] delete error", error);
      res.status(500).json({ error: "Kunne ikke slette kalenderhendelse" });
    }
  });
}
