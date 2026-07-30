/**
 * role-room-checklist-templates.ts
 *
 * Sjekkliste-maler per fase (Del A punkt 58).
 *
 * Samme problem som budsjettet: planleggeren finnes, men en tom tidslinje
 * forteller ikke en førstegangsbruker hva en produksjon består av. Malen er
 * forskjellen mellom å krysse av og å finne på.
 *
 * Malene bærer et dag-offset relativt til opptaksstart framfor faste datoer.
 * Fristene regnes derfor ut når malen tas i bruk — en mal med innbakte datoer
 * ville vært utdatert i det den ble lagret.
 */

import type { Pool, PoolClient } from "pg";

export interface ChecklistTemplateSummary {
  id: string;
  templateKey: string;
  name: string;
  description: string | null;
  itemCount: number;
  recommended: boolean;
}

export async function listChecklistTemplates(
  pool: Pool,
  projectType: string | null,
): Promise<ChecklistTemplateSummary[]> {
  const r = await pool.query(
    `SELECT t.id, t.template_key, t.name, t.description, t.project_types, t.sort_order,
            COUNT(i.id)::int AS item_count
       FROM role_room_checklist_templates t
       LEFT JOIN role_room_checklist_template_items i ON i.template_id = t.id
      GROUP BY t.id
      ORDER BY t.sort_order, t.name`,
  );

  return (r.rows as Array<Record<string, unknown>>)
    .map((row) => ({
      id: String(row.id),
      templateKey: String(row.template_key),
      name: String(row.name),
      description: (row.description as string) ?? null,
      itemCount: Number(row.item_count ?? 0),
      recommended:
        !!projectType && Array.isArray(row.project_types)
          ? (row.project_types as string[]).includes(projectType)
          : false,
    }))
    .sort((a, b) => Number(b.recommended) - Number(a.recommended));
}

/**
 * Regner ut frist fra opptaksstart og malens offset.
 *
 * Datoregning gjøres på UTC-komponentene med vilje: `setDate` på en lokal dato
 * kan hoppe over eller gjenta en time ved sommertidsskifte, og en frist som
 * flytter seg en dag fordi klokka ble stilt er en vanskelig feil å oppdage.
 */
export function computeDueDate(shootStart: string | Date | null, dayOffset: number | null): string | null {
  if (!shootStart || dayOffset === null || dayOffset === undefined) return null;
  const base =
    typeof shootStart === "string"
      ? new Date(`${shootStart.slice(0, 10)}T12:00:00Z`)
      : new Date(Date.UTC(shootStart.getFullYear(), shootStart.getMonth(), shootStart.getDate(), 12));
  base.setUTCDate(base.getUTCDate() + dayOffset);
  return base.toISOString();
}

export interface ApplyChecklistResult {
  created: number;
  skipped: number;
  templateKey: string;
  /** Datoen fristene ble regnet fra. Null når prosjektet ikke har opptaksdager. */
  anchorDate: string | null;
}

/**
 * Legger malens punkter inn i prosjektets tidslinje.
 *
 * Punkter som allerede finnes (samme fase + tittel) hoppes over, slik at
 * operasjonen er trygg å kjøre om igjen — for eksempel når postproduksjons-
 * delen legges til etter at opptaket er ferdig.
 */
export async function applyChecklistTemplate(
  pool: Pool,
  input: { projectId: string; templateKey: string; userId: string | null },
): Promise<ApplyChecklistResult> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    const template = await client.query<{ id: string }>(
      `SELECT id FROM role_room_checklist_templates WHERE template_key = $1 LIMIT 1`,
      [input.templateKey],
    );
    if (template.rowCount === 0) {
      throw new Error(`Ukjent sjekkliste-mal: ${input.templateKey}`);
    }

    // Første opptaksdag er tidsaksen. Finnes ingen, får punktene ingen frist
    // framfor en oppdiktet — en feil frist er verre enn ingen.
    const anchor = await client.query<{ first_day: string | null }>(
      `SELECT MIN(date)::text AS first_day FROM casting_production_days WHERE project_id = $1`,
      [input.projectId],
    );
    const anchorDate = anchor.rows[0]?.first_day ?? null;

    const items = await client.query(
      `SELECT phase, title, description, day_offset, sort_order
         FROM role_room_checklist_template_items
        WHERE template_id = $1
        ORDER BY sort_order`,
      [template.rows[0].id],
    );

    let created = 0;
    let skipped = 0;
    for (const item of items.rows as Array<Record<string, unknown>>) {
      const exists = await client.query(
        `SELECT 1 FROM role_room_phase_timeline_items
          WHERE project_id = $1 AND phase = $2 AND title = $3 LIMIT 1`,
        [input.projectId, item.phase, item.title],
      );
      if ((exists.rowCount ?? 0) > 0) {
        skipped += 1;
        continue;
      }

      await client.query(
        `INSERT INTO role_room_phase_timeline_items
           (id, project_id, phase, title, description, due_at, status, sort_order, created_by, metadata)
         VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,'planned',$6,$7,
                 jsonb_build_object('source','template','templateKey',$8::text))`,
        [
          input.projectId, item.phase, item.title, item.description ?? null,
          computeDueDate(anchorDate, item.day_offset as number | null),
          item.sort_order ?? 0, input.userId, input.templateKey,
        ],
      );
      created += 1;
    }

    await client.query("COMMIT");
    return { created, skipped, templateKey: input.templateKey, anchorDate };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
