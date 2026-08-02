/**
 * grant-workspace.ts — søknads-arbeidsboken
 *
 * Strukturen Daniel ba om: søknaden som ETT objekt med seksjons-
 * livssyklus (empty → drafted → review → done), automatisk
 * [FYLL INN]-sjekkliste, fremdrift som data og samlet eksport.
 *
 * Prinsipper:
 *  - Re-generering av én seksjon rører aldri de andre.
 *  - Sjekklisten ER ferdig-definisjonen: søknaden er klar når hullene
 *    er lukket, ikke når teksten ser ferdig ut.
 *  - Eksporten tar med bevisreferansene som vedleggsliste — IN ser
 *    hvor tallene kommer fra.
 */

import type { Pool } from "pg";
import {
  buildSolutionEvidence,
  draftGrantSection,
  IN_SECTIONS,
  type SolutionKey,
} from "./grant-application.js";

export const SECTION_STATUSES = ["empty", "drafted", "review", "done"] as const;
export type SectionStatus = (typeof SECTION_STATUSES)[number];

/** Ekstraher [FYLL INN: ...]-hull fra et utkast (ren, enhetstestet). */
export function extractFillIns(text: string | null): string[] {
  if (!text) return [];
  return [...text.matchAll(/\[FYLL INN:?\s*([^\]]+)\]/gi)]
    .map((m) => m[1].trim())
    .filter((x, i, arr) => x.length > 0 && arr.indexOf(x) === i)
    .slice(0, 20);
}

export interface WorkspaceSection {
  sectionKey: string;
  title: string;
  guidance: string;
  status: SectionStatus;
  draftText: string | null;
  userNotes: string | null;
  fillIns: string[];
}

export interface WorkspaceProgress {
  total: number;
  done: number;
  drafted: number;
  openFillIns: number;
}

export function computeProgress(sections: Array<{ status: string; fillIns: string[] }>): WorkspaceProgress {
  return {
    total: sections.length,
    done: sections.filter((s) => s.status === "done").length,
    drafted: sections.filter((s) => s.status !== "empty").length,
    openFillIns: sections.reduce((sum, s) => sum + (s.status === "done" ? 0 : s.fillIns.length), 0),
  };
}

export async function createApplication(
  pool: Pool,
  organizationId: string,
  args: { solution: SolutionKey; program: string; title: string },
): Promise<{ id: string }> {
  const app = await pool.query<{ id: string }>(
    `INSERT INTO grant_applications (organization_id, solution, program, title)
     VALUES ($1::uuid, $2, $3, $4) RETURNING id::text`,
    [organizationId, args.solution, args.program.slice(0, 60), args.title.slice(0, 200)],
  );
  const id = app.rows[0].id;
  for (const section of IN_SECTIONS) {
    await pool.query(
      `INSERT INTO grant_application_sections (application_id, section_key)
       VALUES ($1::uuid, $2) ON CONFLICT DO NOTHING`,
      [id, section.key],
    );
  }
  return { id };
}

export async function getApplication(
  pool: Pool,
  organizationId: string,
  applicationId: string,
): Promise<{
  id: string; solution: SolutionKey; program: string; title: string; status: string;
  sections: WorkspaceSection[]; progress: WorkspaceProgress;
} | null> {
  const app = await pool.query<{
    id: string; solution: SolutionKey; program: string; title: string; status: string;
  }>(
    `SELECT id::text, solution, program, title, status FROM grant_applications
      WHERE id = $1::uuid AND organization_id = $2::uuid`,
    [applicationId, organizationId],
  );
  if (app.rows.length === 0) return null;

  const rows = await pool.query<{
    section_key: string; draft_text: string | null; user_notes: string | null;
    status: SectionStatus; fill_ins: string[];
  }>(
    `SELECT section_key, draft_text, user_notes, status, fill_ins
       FROM grant_application_sections WHERE application_id = $1::uuid`,
    [applicationId],
  );
  const byKey = new Map(rows.rows.map((r) => [r.section_key, r]));
  const sections: WorkspaceSection[] = IN_SECTIONS.map((def) => {
    const row = byKey.get(def.key);
    return {
      sectionKey: def.key,
      title: def.title,
      guidance: def.guidance,
      status: row?.status ?? "empty",
      draftText: row?.draft_text ?? null,
      userNotes: row?.user_notes ?? null,
      fillIns: row?.fill_ins ?? [],
    };
  });
  return {
    ...app.rows[0],
    sections,
    progress: computeProgress(sections),
  };
}

export async function updateSection(
  pool: Pool,
  organizationId: string,
  applicationId: string,
  sectionKey: string,
  patch: { draftText?: string; userNotes?: string; status?: SectionStatus },
): Promise<boolean> {
  const owner = await pool.query(
    `SELECT 1 FROM grant_applications WHERE id = $1::uuid AND organization_id = $2::uuid`,
    [applicationId, organizationId],
  );
  if ((owner.rowCount ?? 0) === 0) return false;

  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [applicationId, sectionKey];
  if (patch.draftText !== undefined) {
    params.push(patch.draftText.slice(0, 20_000));
    sets.push(`draft_text = $${params.length}`);
    params.push(JSON.stringify(extractFillIns(patch.draftText)));
    sets.push(`fill_ins = $${params.length}::jsonb`);
  }
  if (patch.userNotes !== undefined) {
    params.push(patch.userNotes.slice(0, 10_000));
    sets.push(`user_notes = $${params.length}`);
  }
  if (patch.status && SECTION_STATUSES.includes(patch.status)) {
    params.push(patch.status);
    sets.push(`status = $${params.length}`);
  }
  const r = await pool.query(
    `UPDATE grant_application_sections SET ${sets.join(", ")}
      WHERE application_id = $1::uuid AND section_key = $2`,
    params,
  );
  await pool.query(`UPDATE grant_applications SET updated_at = now() WHERE id = $1::uuid`, [applicationId]);
  return (r.rowCount ?? 0) > 0;
}

/** Generer utkast for én seksjon og PERSISTER det (status → drafted). */
export async function draftAndSaveSection(
  pool: Pool,
  organizationId: string,
  applicationId: string,
  sectionKey: string,
): Promise<{ ok: true; fillIns: string[] } | { error: string; status: number }> {
  const app = await getApplication(pool, organizationId, applicationId);
  if (!app) return { error: "soknad_ikke_funnet", status: 404 };
  const section = app.sections.find((s) => s.sectionKey === sectionKey);
  if (!section) return { error: "ukjent_seksjon", status: 400 };

  const result = await draftGrantSection(pool, organizationId, {
    solution: app.solution,
    sectionKey,
    userNotes: section.userNotes ?? undefined,
  });
  if ("error" in result) return result;

  const fillIns = extractFillIns(result.draft.text);
  await pool.query(
    `UPDATE grant_application_sections
        SET draft_text = $3, fill_ins = $4::jsonb,
            status = CASE WHEN status = 'empty' THEN 'drafted' ELSE status END,
            updated_at = now()
      WHERE application_id = $1::uuid AND section_key = $2`,
    [applicationId, sectionKey, result.draft.text, JSON.stringify(fillIns)],
  );
  return { ok: true, fillIns };
}

/** Samlet eksport: hele søknaden som markdown m/ bevis-vedlegg. */
export async function assembleDocument(
  pool: Pool,
  organizationId: string,
  applicationId: string,
): Promise<string | null> {
  const app = await getApplication(pool, organizationId, applicationId);
  if (!app) return null;
  const evidence = await buildSolutionEvidence(pool, organizationId, app.solution);

  const lines: string[] = [
    `# ${app.title}`,
    ``,
    `Program: ${app.program} · Løsning: ${app.solution} · Status: ${app.progress.done}/${app.progress.total} seksjoner ferdige`,
    app.progress.openFillIns > 0
      ? `\n> ⚠ ${app.progress.openFillIns} åpne [FYLL INN]-punkter gjenstår — søknaden er IKKE innsendingsklar.`
      : `\n> Alle utfyllingspunkter lukket.`,
    ``,
  ];
  for (const section of app.sections) {
    lines.push(`## ${section.title}`, ``);
    lines.push(section.draftText?.trim() || `*(seksjonen er ikke skrevet ennå)*`, ``);
  }
  lines.push(`---`, ``, `## Vedlegg: datagrunnlag (plattformens kilder)`, ``);
  for (const f of evidence) {
    lines.push(`- [${f.n}] (${f.source}) ${f.label}: ${f.value}`);
  }
  return lines.join("\n");
}
