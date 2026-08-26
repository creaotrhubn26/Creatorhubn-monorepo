import type { Pool } from "pg";
import { ensureProjectTeamSchema } from "./project-team-routes";

type QueryablePool = Pick<Pool, "query">;

export interface ProjectListFilters {
  userId: string | null;
  profession?: string | null;
  status?: string | null;
  customerId?: string | null;
}

const publicProjectSelect = `
  SELECT 'public'::text AS _project_source,
         p.id::text AS id,
         p.user_id::text AS user_id,
         p.name,
         p.title,
         p.description,
         p.client_name,
         NULL::text AS client_email,
         NULL::text AS client_phone,
         p.event_date,
         p.event_date AS date,
         p.location,
         p.project_type AS category,
         p.project_type,
         p.profession,
         p.status,
         p.priority,
         p.budget,
         p.created_at,
         p.updated_at,
         p.settings,
         p.project_data AS metadata,
         p.estimated_hours,
         p.actual_hours,
         NULL::text AS customer_id,
         NULL::text AS cover_image,
         NULL::text AS slug
    FROM projects p`;

function rowTimestamp(row: any): number {
  const value = row?.updated_at ?? row?.created_at;
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Returns normalized SQL rows from both project stores. Public projects win
 * when an id exists in both stores because they carry the richer operational
 * data used by photographer workflows.
 */
export async function listAccessibleProjectRows(
  pool: QueryablePool,
  filters: ProjectListFilters,
): Promise<any[]> {
  const { userId, profession, status, customerId } = filters;
  await ensureProjectTeamSchema(pool);

  const legacyParams: any[] = [];
  const legacyFilters: string[] = [];
  const publicParams: any[] = [];
  const publicFilters: string[] = [];

  if (customerId) {
    legacyParams.push(customerId);
    legacyFilters.push(`customer_id = $${legacyParams.length}`);
    // public.projects does not expose a stable customer id across all schemas.
    publicFilters.push("FALSE");
  }
  if (status) {
    legacyParams.push(status);
    legacyFilters.push(`status = $${legacyParams.length}`);
    publicParams.push(status);
    publicFilters.push(`p.status = $${publicParams.length}`);
  }

  if (userId) {
    legacyParams.push(userId);
    const legacyUser = `$${legacyParams.length}`;
    publicParams.push(userId);
    const publicUser = `$${publicParams.length}`;
    const legacyMember = `EXISTS (
      SELECT 1 FROM project_team_members ptm
       WHERE ptm.project_id = legacy.projects.id::text
         AND ptm.user_id = ${legacyUser}
         AND ptm.status = 'active'
         AND ptm.deactivated_at IS NULL
         AND COALESCE(ptm.permissions->>'canRead', 'true') <> 'false'
    )`;
    const publicMember = `EXISTS (
      SELECT 1 FROM project_team_members ptm
       WHERE ptm.project_id = p.id::text
         AND ptm.user_id = ${publicUser}
         AND ptm.status = 'active'
         AND ptm.deactivated_at IS NULL
         AND COALESCE(ptm.permissions->>'canRead', 'true') <> 'false'
    )`;
    if (profession) {
      legacyParams.push(profession);
      const legacyProfession = `$${legacyParams.length}`;
      publicParams.push(profession);
      const publicProfession = `$${publicParams.length}`;
      legacyFilters.push(`((user_id = ${legacyUser} AND profession = ${legacyProfession}) OR ${legacyMember})`);
      publicFilters.push(`((p.user_id::text = ${publicUser} AND p.profession = ${publicProfession}) OR ${publicMember})`);
    } else {
      legacyFilters.push(`(user_id = ${legacyUser} OR ${legacyMember})`);
      publicFilters.push(`(p.user_id::text = ${publicUser} OR ${publicMember})`);
    }
  } else if (profession) {
    legacyParams.push(profession);
    legacyFilters.push(`profession = $${legacyParams.length}`);
    publicParams.push(profession);
    publicFilters.push(`p.profession = $${publicParams.length}`);
  }

  if (legacyFilters.length === 0 && publicFilters.length === 0) return [];

  const [legacyResult, publicResult] = await Promise.all([
    legacyFilters.length
      ? pool.query(
          `SELECT * FROM legacy.projects WHERE ${legacyFilters.join(" AND ")} ORDER BY created_at DESC`,
          legacyParams,
        ).catch(() => ({ rows: [] as any[] }))
      : Promise.resolve({ rows: [] as any[] }),
    publicFilters.length
      ? pool.query(
          `${publicProjectSelect} WHERE ${publicFilters.join(" AND ")} ORDER BY p.created_at DESC`,
          publicParams,
        ).catch(() => ({ rows: [] as any[] }))
      : Promise.resolve({ rows: [] as any[] }),
  ]);

  const deduped = new Map<string, any>();
  for (const row of legacyResult.rows) deduped.set(String(row.id), row);
  for (const row of publicResult.rows) deduped.set(String(row.id), row);
  return [...deduped.values()].sort((a, b) => rowTimestamp(b) - rowTimestamp(a));
}

export async function findProjectRowById(
  pool: QueryablePool,
  projectId: string,
): Promise<any | null> {
  const publicResult = await pool.query(
    `${publicProjectSelect} WHERE p.id::text = $1 LIMIT 1`,
    [projectId],
  ).catch(() => ({ rows: [] as any[] }));
  if (publicResult.rows[0]) return publicResult.rows[0];

  const legacyResult = await pool.query(
    "SELECT legacy.projects.*, 'legacy'::text AS _project_source FROM legacy.projects WHERE id = $1 LIMIT 1",
    [projectId],
  ).catch(() => ({ rows: [] as any[] }));
  return legacyResult.rows[0] ?? null;
}
