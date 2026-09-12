/**
 * role-room-assistant-access.ts — delt håndhevelse for assistent-scoping.
 *
 * getAssistantAreas() returnerer area-flaggene HVIS den innloggede brukeren er
 * en scopet assistent på prosjektet (status invited/active, matchet på user_id
 * eller e-post). Returnerer null for ALLE andre (produsent/klient/eier) — så
 * enforcement gjelder KUN assistenter og gir null regresjon for andre.
 *
 * Bruk i lese-endepunkter:
 *   const asst = await getAssistantAreas(pool, projectId, { userId, email });
 *   if (asst && !asst.areas.economy) → nekt/skjul økonomi for denne assistenten.
 */
import type { Pool } from 'pg';

export type AssistantAreaFlags = Record<string, boolean>;

export interface AssistantScope {
  areas: AssistantAreaFlags;
}

const cache = new Map<string, { value: AssistantScope | null; expires: number }>();
const TTL_MS = 15_000;

export async function getAssistantAreas(
  pool: Pool,
  projectId: string,
  ids: { userId?: string | null; email?: string | null },
): Promise<AssistantScope | null> {
  const userId = (ids.userId ?? '').trim();
  const email = (ids.email ?? '').trim().toLowerCase();
  if (!projectId || (!userId && !email)) return null;
  const key = `${projectId}|${userId}|${email}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value;

  let value: AssistantScope | null = null;
  try {
    const { rows } = await pool.query<{ areas: unknown }>(
      `SELECT areas FROM role_room_assistant_access
        WHERE project_id = $1
          AND status IN ('invited', 'active')
          AND ( (assistant_user_id IS NOT NULL AND assistant_user_id = $2)
                OR ($3 <> '' AND lower(assistant_email) = $3) )
        LIMIT 1`,
      [projectId, userId, email],
    );
    if (rows[0]) {
      const areas = (rows[0].areas && typeof rows[0].areas === 'object' ? rows[0].areas : {}) as AssistantAreaFlags;
      value = { areas };
    }
  } catch {
    // Tabellen finnes kanskje ikke ennå (fersk DB) → behandle som «ikke assistent».
    value = null;
  }
  cache.set(key, { value, expires: now + TTL_MS });
  return value;
}

/** True hvis brukeren er en scopet assistent UTEN tilgang til området. */
export function assistantBlocks(scope: AssistantScope | null, area: string): boolean {
  return scope != null && scope.areas[area] !== true;
}
