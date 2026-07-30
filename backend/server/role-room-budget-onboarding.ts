/**
 * role-room-budget-onboarding.ts
 *
 * Budsjett-onboarding (Del A punkt 105) og maler (106).
 *
 * QA-observasjonen bak punktet var «0/0/0 på et aktivt prosjekt». Det er et
 * adopsjonsproblem, ikke en manglende funksjon: budsjettmodulen finnes, men et
 * tomt regneark er en høy terskel. Den som ikke vet hvilke linjer et
 * reklamebudsjett SKAL ha, begynner ikke.
 *
 * To deler:
 *   1. Oppdage at budsjettet er tomt på et prosjekt som ellers er i gang.
 *   2. Tilby en mal som passer prosjekttypen, slik at man fyller ut framfor å
 *      finne på.
 */

import type { Pool, PoolClient } from "pg";

export interface BudgetTemplateSummary {
  id: string;
  templateKey: string;
  name: string;
  description: string | null;
  lineCount: number;
  /** True når malen er foreslått for dette prosjektets type. */
  recommended: boolean;
}

export interface BudgetOnboardingState {
  projectId: string;
  projectType: string | null;
  itemCount: number;
  totalEstimate: number;
  /** Prosjektet har aktivitet, men ingen budsjettlinjer — da er nudgen relevant. */
  needsOnboarding: boolean;
  reason: string;
  templates: BudgetTemplateSummary[];
}

/**
 * Vurderer om prosjektet bør få en budsjett-nudge.
 *
 * Et helt nytt prosjekt uten noe innhold skal IKKE maste — der er tomt
 * budsjett forventet. Nudgen er relevant først når det finnes tegn på reell
 * aktivitet: roller, kandidater eller opptaksdager. Det var nettopp den
 * kombinasjonen QA fant — et aktivt prosjekt med 0/0/0.
 */
export async function getBudgetOnboardingState(
  pool: Pool,
  projectId: string,
): Promise<BudgetOnboardingState> {
  const [project, budget, activity] = await Promise.all([
    pool.query<{ project_type: string | null }>(
      `SELECT project_type FROM casting_projects WHERE id = $1 LIMIT 1`,
      [projectId],
    ),
    pool.query<{ n: string; total: string }>(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(estimate), 0) AS total
         FROM role_room_budget_items WHERE project_id = $1`,
      [projectId],
    ),
    pool.query<{ roles: string; candidates: string; days: string }>(
      `SELECT
         (SELECT COUNT(*)::int FROM casting_roles WHERE project_id = $1) AS roles,
         (SELECT COUNT(*)::int FROM casting_candidates WHERE project_id = $1) AS candidates,
         (SELECT COUNT(*)::int FROM casting_production_days WHERE project_id = $1) AS days`,
      [projectId],
    ),
  ]);

  const projectType = project.rows[0]?.project_type ?? null;
  const itemCount = Number(budget.rows[0]?.n ?? 0);
  const totalEstimate = Number(budget.rows[0]?.total ?? 0);
  const a = activity.rows[0];
  const hasActivity =
    Number(a?.roles ?? 0) > 0 || Number(a?.candidates ?? 0) > 0 || Number(a?.days ?? 0) > 0;

  let needsOnboarding = false;
  let reason: string;
  if (itemCount === 0 && hasActivity) {
    needsOnboarding = true;
    reason = "Prosjektet er i gang, men budsjettet er tomt.";
  } else if (itemCount === 0) {
    reason = "Nytt prosjekt uten aktivitet ennå — ingen grunn til å mase om budsjett.";
  } else if (totalEstimate === 0) {
    needsOnboarding = true;
    reason = "Budsjettlinjer finnes, men ingen beløp er fylt inn.";
  } else {
    reason = "Budsjettet er i bruk.";
  }

  return {
    projectId,
    projectType,
    itemCount,
    totalEstimate,
    needsOnboarding,
    reason,
    templates: await listBudgetTemplates(pool, projectType),
  };
}

/**
 * Maler, med de som passer prosjekttypen først. Alle returneres uansett —
 * en dokumentarmal kan godt brukes på noe annet, og å skjule den ville bare
 * gjøre produktet mer gjettende enn hjelpsomt.
 */
export async function listBudgetTemplates(
  pool: Pool,
  projectType: string | null,
): Promise<BudgetTemplateSummary[]> {
  const r = await pool.query(
    `SELECT t.id, t.template_key, t.name, t.description, t.project_types, t.sort_order,
            COUNT(l.id)::int AS line_count
       FROM role_room_budget_templates t
       LEFT JOIN role_room_budget_template_lines l ON l.template_id = t.id
      GROUP BY t.id
      ORDER BY t.sort_order, t.name`,
  );

  return (r.rows as Array<Record<string, unknown>>)
    .map((row) => ({
      id: String(row.id),
      templateKey: String(row.template_key),
      name: String(row.name),
      description: (row.description as string) ?? null,
      lineCount: Number(row.line_count ?? 0),
      recommended:
        !!projectType && Array.isArray(row.project_types)
          ? (row.project_types as string[]).includes(projectType)
          : false,
    }))
    .sort((a, b) => Number(b.recommended) - Number(a.recommended));
}

export interface ApplyTemplateResult {
  created: number;
  skipped: number;
  templateKey: string;
}

/**
 * Setter inn malens linjer på prosjektet.
 *
 * Linjer som allerede finnes (samme fase + kategori + navn) hoppes over
 * framfor å dupliseres — det gjør operasjonen trygg å kjøre igjen, for
 * eksempel når man vil legge til postproduksjons-delen senere.
 *
 * Beløpene settes til 0 med vilje: malen sier HVA som skal budsjetteres, ikke
 * hvor mye. Et gjettet kronebeløp ville sett ut som et estimat noen hadde
 * regnet på, og det er verre enn en tom celle.
 */
export async function applyBudgetTemplate(
  pool: Pool,
  input: { projectId: string; templateKey: string; userId: string | null },
): Promise<ApplyTemplateResult> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    const template = await client.query<{ id: string }>(
      `SELECT id FROM role_room_budget_templates WHERE template_key = $1 LIMIT 1`,
      [input.templateKey],
    );
    if (template.rowCount === 0) {
      throw new Error(`Ukjent budsjettmal: ${input.templateKey}`);
    }

    const lines = await client.query(
      `SELECT phase, category, item_name, description, default_estimate, sort_order
         FROM role_room_budget_template_lines
        WHERE template_id = $1
        ORDER BY sort_order`,
      [template.rows[0].id],
    );

    let created = 0;
    let skipped = 0;
    for (const line of lines.rows as Array<Record<string, unknown>>) {
      const exists = await client.query(
        `SELECT 1 FROM role_room_budget_items
          WHERE project_id = $1 AND phase = $2 AND category = $3 AND item_name = $4
          LIMIT 1`,
        [input.projectId, line.phase, line.category, line.item_name],
      );
      if ((exists.rowCount ?? 0) > 0) {
        skipped += 1;
        continue;
      }

      await client.query(
        `INSERT INTO role_room_budget_items
           (id, project_id, phase, category, item_name, description, estimate,
            status, sort_order, created_by, metadata)
         VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,'draft',$7,$8,
                 jsonb_build_object('source','template','templateKey',$9::text))`,
        [
          input.projectId, line.phase, line.category, line.item_name,
          line.description ?? null, line.default_estimate ?? 0,
          line.sort_order ?? 0, input.userId, input.templateKey,
        ],
      );
      created += 1;
    }

    await client.query("COMMIT");
    return { created, skipped, templateKey: input.templateKey };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
