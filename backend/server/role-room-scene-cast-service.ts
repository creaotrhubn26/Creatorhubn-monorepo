/**
 * role-room-scene-cast-service.ts
 *
 * Kobler scene → karakter → rolle → kandidat (Del A punkt 83).
 *
 * Scene-uttrekket (punkt 82) gir hvilke KARAKTERER som har replikk i hver
 * scene, som versaler fra manus. Castingen holder hvilken KANDIDAT som er
 * tildelt hver ROLLE. Leddet mellom dem manglet, og uten det kan man ikke
 * svare på de to spørsmålene en innspillingsleder faktisk stiller:
 *
 *   «Hvem skal være på settet i scene 14?»
 *   «Hvis vi bytter skuespiller på denne rollen, hvilke dager berøres?»
 *
 * Koblingen går på navn, fordi manus ikke kjenner til rolle-id-er. Det er en
 * heuristikk, og den er eksplisitt om hva den ikke traff — en uklar kobling
 * skal vises som uklar, ikke skjules bak et tall som ser presist ut.
 */

import type { Pool } from "pg";

/**
 * Normaliserer et navn for sammenligning. Manus skriver «KARI (V.O.)» og
 * «KARI (CONT'D)» for samme karakter, og casting skriver gjerne «Kari».
 * Parentesuttrykk er regi-anvisninger, ikke del av navnet.
 */
export function normalizeCharacterName(name: string): string {
  return String(name ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export interface SceneCastEntry {
  character: string;
  roleId: string | null;
  roleName: string | null;
  candidateId: string | null;
  candidateName: string | null;
  /** True når karakteren ikke lot seg koble til en rolle. */
  unmatched: boolean;
}

export interface SceneCast {
  sceneId: string;
  sceneNumber: number | null;
  title: string | null;
  cast: SceneCastEntry[];
  /** Karakterer uten rolle — typisk skrivefeil i manus eller rolle som mangler. */
  unmatchedCount: number;
}

/**
 * Bygger scene→cast-oversikten for et prosjekt.
 *
 * Rollene hentes én gang og slås opp i minnet: antall roller per prosjekt er
 * lite, mens antall scener kan være hundrevis, og en spørring per scene ville
 * gjort dette til N+1.
 */
export async function resolveSceneCast(
  pool: Pool,
  projectId: string,
  options: { manuscriptId?: string } = {},
): Promise<{ scenes: SceneCast[]; totalUnmatched: number }> {
  const params: unknown[] = [projectId];
  let manuscriptClause = "";
  if (options.manuscriptId) {
    params.push(options.manuscriptId);
    manuscriptClause = `AND manuscript_id = $${params.length}`;
  }

  const [scenesRes, rolesRes] = await Promise.all([
    pool.query(
      `SELECT id, scene_number, title, characters
         FROM casting_scenes
        WHERE project_id = $1 ${manuscriptClause}
        ORDER BY scene_number NULLS LAST`,
      params,
    ),
    pool.query(
      `SELECT r.id, r.name, r.assigned_candidate_id, c.name AS candidate_name
         FROM casting_roles r
         LEFT JOIN casting_candidates c ON c.id = r.assigned_candidate_id
        WHERE r.project_id = $1`,
      [projectId],
    ),
  ]);

  const roleByName = new Map<string, { id: string; name: string; candidateId: string | null; candidateName: string | null }>();
  for (const row of rolesRes.rows as Array<Record<string, unknown>>) {
    roleByName.set(normalizeCharacterName(String(row.name)), {
      id: String(row.id),
      name: String(row.name),
      candidateId: (row.assigned_candidate_id as string) ?? null,
      candidateName: (row.candidate_name as string) ?? null,
    });
  }

  let totalUnmatched = 0;
  const scenes: SceneCast[] = (scenesRes.rows as Array<Record<string, unknown>>).map((scene) => {
    const characters = Array.isArray(scene.characters) ? (scene.characters as string[]) : [];
    const cast: SceneCastEntry[] = characters.map((raw) => {
      const role = roleByName.get(normalizeCharacterName(raw));
      if (!role) {
        totalUnmatched += 1;
        return {
          character: raw,
          roleId: null, roleName: null, candidateId: null, candidateName: null,
          unmatched: true,
        };
      }
      return {
        character: raw,
        roleId: role.id,
        roleName: role.name,
        candidateId: role.candidateId,
        candidateName: role.candidateName,
        unmatched: false,
      };
    });

    return {
      sceneId: String(scene.id),
      sceneNumber: scene.scene_number === null ? null : Number(scene.scene_number),
      title: (scene.title as string) ?? null,
      cast,
      unmatchedCount: cast.filter((c) => c.unmatched).length,
    };
  });

  return { scenes, totalUnmatched };
}

export interface CastChangeImpact {
  roleId: string;
  roleName: string | null;
  currentCandidateId: string | null;
  currentCandidateName: string | null;
  /** Scenene rollen har replikk i. */
  scenes: Array<{ sceneId: string; sceneNumber: number | null; title: string | null }>;
  /** Opptaksdagene de scenene er planlagt på. */
  productionDays: Array<{ id: string; date: string; status: string | null }>;
  sceneCount: number;
  dayCount: number;
}

/**
 * Hva berøres hvis castingen på denne rollen endres.
 *
 * Dette er spørsmålet punktet handler om — «cast-endring propagerer». Uten
 * det må noen bla gjennom manus for å finne ut hvilke dager som må planlegges
 * om, og den jobben blir gjort feil eller ikke i det hele tatt.
 */
export async function getCastChangeImpact(
  pool: Pool,
  roleId: string,
): Promise<CastChangeImpact> {
  const roleRes = await pool.query(
    `SELECT r.id, r.name, r.project_id, r.assigned_candidate_id, c.name AS candidate_name
       FROM casting_roles r
       LEFT JOIN casting_candidates c ON c.id = r.assigned_candidate_id
      WHERE r.id = $1 LIMIT 1`,
    [roleId],
  );
  if (roleRes.rowCount === 0) throw new Error(`Fant ikke rollen: ${roleId}`);
  const role = roleRes.rows[0] as Record<string, unknown>;
  const normalized = normalizeCharacterName(String(role.name));

  // Karakternavnet ligger i en JSONB-array. Sammenligningen må normaliseres
  // på samme måte som i minnet, ellers går «KARI (V.O.)» tapt.
  const scenesRes = await pool.query(
    `SELECT id, scene_number, title
       FROM casting_scenes
      WHERE project_id = $1
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(characters) = 'array' THEN characters ELSE '[]'::jsonb END
          ) AS ch
           WHERE upper(btrim(regexp_replace(ch, '\\([^)]*\\)', ' ', 'g'))) = $2
        )
      ORDER BY scene_number NULLS LAST`,
    [role.project_id, normalized],
  );

  const sceneIds = scenesRes.rows.map((r: Record<string, unknown>) => String(r.id));
  let productionDays: CastChangeImpact["productionDays"] = [];
  if (sceneIds.length > 0) {
    const daysRes = await pool.query(
      `SELECT id, date::text AS date, status
         FROM casting_production_days
        WHERE project_id = $1
          AND scene_ids ?| $2::text[]
        ORDER BY date`,
      [role.project_id, sceneIds],
    );
    productionDays = daysRes.rows as CastChangeImpact["productionDays"];
  }

  const scenes = scenesRes.rows.map((r: Record<string, unknown>) => ({
    sceneId: String(r.id),
    sceneNumber: r.scene_number === null ? null : Number(r.scene_number),
    title: (r.title as string) ?? null,
  }));

  return {
    roleId,
    roleName: (role.name as string) ?? null,
    currentCandidateId: (role.assigned_candidate_id as string) ?? null,
    currentCandidateName: (role.candidate_name as string) ?? null,
    scenes,
    productionDays,
    sceneCount: scenes.length,
    dayCount: productionDays.length,
  };
}
