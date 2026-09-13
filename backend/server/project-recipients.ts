/**
 * project-recipients.ts — hvem er «prosjektets team» når vi skal varsle?
 *
 * Eieren i `public.projects` ELLER `legacy.projects` pluss aktive rader i
 * `project_team_members`, med visningsnavn. Samme sett som `canAccessProject`
 * slipper inn, uttrykt som en liste i stedet for et ja/nei — så et varsel
 * aldri kan nå noen som ikke ville hatt lov å åpne prosjektet.
 *
 * Lå tidligere som en lokal closure i `communication-routes.ts`. Flyttet hit
 * da varsellaget trengte den; chat-ruten bruker nå den samme.
 */

export interface ProjectRecipient {
  userId: string;
  name: string;
}

export async function projectTeamRecipients(
  pool: any,
  projectId: string,
): Promise<ProjectRecipient[]> {
  if (!projectId) return [];
  try {
    // Hvert oppslag har sin egen catch: i produksjon eies ikke `legacy` av
    // samme rolle, og et avvist skjema skal ikke skjule eieren i public.
    const [publicOwner, legacyOwner, members] = await Promise.all([
      pool.query(
        `SELECT u.id::text AS uid,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS n
           FROM projects p JOIN users u ON u.id = p.user_id
          WHERE p.id::text = $1`,
        [projectId],
      ).catch(() => ({ rows: [] as any[] })),
      pool.query(
        `SELECT u.id::text AS uid,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS n
           FROM legacy.projects p JOIN users u ON u.id::text = p.user_id
          WHERE p.id = $1`,
        [projectId],
      ).catch(() => ({ rows: [] as any[] })),
      pool.query(
        `SELECT m.user_id::text AS uid,
                COALESCE(NULLIF(TRIM(m.name), ''), m.email) AS n
           FROM project_team_members m
          WHERE m.project_id = $1 AND m.status = 'active'
            AND m.deactivated_at IS NULL AND m.user_id IS NOT NULL`,
        [projectId],
      ).catch(() => ({ rows: [] as any[] })),
    ]);

    const seen = new Map<string, string>();
    for (const row of [
      ...(publicOwner.rows ?? []),
      ...(legacyOwner.rows ?? []),
      ...(members.rows ?? []),
    ]) {
      if (row?.uid && !seen.has(String(row.uid))) {
        seen.set(String(row.uid), String(row.n ?? ""));
      }
    }
    return [...seen.entries()].map(([userId, name]) => ({ userId, name }));
  } catch {
    // Fail closed: heller ingen varsler enn varsler til feil folk.
    return [];
  }
}
