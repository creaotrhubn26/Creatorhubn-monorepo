import type { Pool } from "pg";

export interface LeadNoteRow {
  id: string;
  leadId: string;
  authorUserId: string | null;
  authorName: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapNote(row: any): LeadNoteRow {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    authorUserId: row.author_user_id ? String(row.author_user_id) : null,
    authorName: String(row.author_name || row.author_email || "Ukjent bruker"),
    body: String(row.body),
    pinned: Boolean(row.pinned),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function leadExistsInOrganization(
  pool: Pool,
  leadId: string,
  organizationId: string,
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM crm_customers
      WHERE id = $1::uuid AND organization_id = $2::uuid
        AND archived_at IS NULL
      LIMIT 1`,
    [leadId, organizationId],
  );
  return result.rows.length > 0;
}

export async function listLeadNotes(
  pool: Pool,
  opts: { leadId: string; organizationId: string },
): Promise<LeadNoteRow[]> {
  const result = await pool.query(
    `SELECT n.id::text, n.lead_id::text, n.author_user_id,
            NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS author_name,
            u.email AS author_email, n.body, n.pinned, n.created_at, n.updated_at
       FROM leadgrid_lead_notes n
       JOIN crm_customers c ON c.id = n.lead_id AND c.organization_id = n.organization_id
       LEFT JOIN users u ON u.id = n.author_user_id
      WHERE n.organization_id = $1::uuid
        AND n.lead_id = $2::uuid
        AND n.deleted_at IS NULL
      ORDER BY n.pinned DESC, n.created_at DESC`,
    [opts.organizationId, opts.leadId],
  );
  return result.rows.map(mapNote);
}

export async function createLeadNote(
  pool: Pool,
  opts: {
    leadId: string;
    organizationId: string;
    authorUserId: string;
    body: string;
    pinned: boolean;
  },
): Promise<LeadNoteRow | null> {
  const body = opts.body.trim();
  if (!body || body.length > 20_000) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO leadgrid_lead_notes
         (organization_id, lead_id, author_user_id, body, pinned)
       SELECT $1::uuid, c.id, $3, $4, $5
         FROM crm_customers c
        WHERE c.id = $2::uuid
          AND c.organization_id = $1::uuid
          AND c.archived_at IS NULL
       RETURNING id::text, lead_id::text, author_user_id, body, pinned,
                 created_at, updated_at`,
      [opts.organizationId, opts.leadId, opts.authorUserId, body, opts.pinned],
    );
    if (!inserted.rows.length) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(
      `INSERT INTO crm_lead_activities
         (customer_id, user_id, activity_type, description, metadata)
       VALUES ($1::uuid, $2, 'note_added', $3, $4::jsonb)`,
      [
        opts.leadId,
        opts.authorUserId,
        body.slice(0, 500),
        JSON.stringify({ noteId: inserted.rows[0].id, pinned: opts.pinned }),
      ],
    );
    const author = await client.query(
      `SELECT NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), '') AS author_name,
              email AS author_email
         FROM users WHERE id = $1 LIMIT 1`,
      [opts.authorUserId],
    );
    await client.query("COMMIT");
    return mapNote({ ...inserted.rows[0], ...author.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setLeadFavorite(
  pool: Pool,
  opts: { leadId: string; organizationId: string; userId: string; favorite: boolean },
): Promise<boolean | null> {
  if (!(await leadExistsInOrganization(pool, opts.leadId, opts.organizationId))) return null;
  if (opts.favorite) {
    await pool.query(
      `INSERT INTO leadgrid_lead_favorites (organization_id, lead_id, user_id)
       VALUES ($1::uuid, $2::uuid, $3)
       ON CONFLICT (organization_id, lead_id, user_id) DO NOTHING`,
      [opts.organizationId, opts.leadId, opts.userId],
    );
  } else {
    await pool.query(
      `DELETE FROM leadgrid_lead_favorites
        WHERE organization_id = $1::uuid AND lead_id = $2::uuid AND user_id = $3`,
      [opts.organizationId, opts.leadId, opts.userId],
    );
  }
  return opts.favorite;
}
