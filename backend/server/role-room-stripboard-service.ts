/**
 * role-room-stripboard-service.ts
 *
 * Stripboard og fremdrift (Del A punkt 72, 84, 87 og 73).
 *
 * Et stripboard er scener fordelt på opptaksdager. Det høres enkelt ut, men er
 * planleggingens tyngste verktøy: rekkefølgen innad i dagen avgjør hvor mange
 * ganger man må rigge om, og sidetallet avgjør om dagen i det hele tatt er
 * mulig.
 *
 * Fremdrift er den samme dataen sett bakover — hvor mange sider er skutt av de
 * planlagte. Uten den vet ingen om produksjonen ligger foran eller etter før
 * det er for sent å gjøre noe med det.
 */

import type { Pool } from "pg";

// ── Sider i åttedeler ───────────────────────────────────────────────────────

/**
 * Formaterer åttedeler slik bransjen skriver dem: 19 → «2 3/8».
 * Desimaltall ville antydet en presisjon målemetoden ikke har.
 */
export function formatEighths(eighths: number | null | undefined): string {
  if (eighths === null || eighths === undefined || !Number.isFinite(Number(eighths))) return "–";
  const total = Math.max(Math.round(Number(eighths)), 0);
  const whole = Math.floor(total / 8);
  const rest = total % 8;
  if (whole === 0 && rest === 0) return "0";
  if (rest === 0) return String(whole);
  if (whole === 0) return `${rest}/8`;
  return `${whole} ${rest}/8`;
}

export interface StripboardScene {
  /**
   * Null når scenen ennå ikke har en stripboard-rad.
   *
   * Et importert manus gir scener uten rader. De hører hjemme i «ikke
   * planlagt»-bunken fra første stund — ellers står stripboardet tomt etter en
   * import, uten noen vei til å få scenene inn i det. Raden opprettes når
   * scenen faktisk legges på en dag.
   */
  entryId: string | null;
  sceneId: string;
  sceneNumber: number | null;
  title: string | null;
  intExt: string | null;
  timeOfDay: string | null;
  setting: string | null;
  characters: string[];
  pageEighths: number | null;
  shootStatus: string;
  sortOrder: number;
  setupMinutes: number;
}

export interface StripboardDay {
  productionDayId: string | null;
  date: string | null;
  status: string | null;
  scenes: StripboardScene[];
  /** Sum sider for dagen, i åttedeler. */
  totalEighths: number;
  totalPagesLabel: string;
  totalSetupMinutes: number;
  /** Unike karakterer som må være på settet den dagen. */
  castCount: number;
  /** Antall ulike locations — hver ekstra betyr en flytting. */
  locationCount: number;
}

/**
 * Én medvirkende, slik stripboardet trenger dem.
 *
 * Ligger her og ikke i et eget kall fordi stripboardet allerede vet hvilke
 * karakterer som er i hvilke scener — og fordi et separat cast-kall er
 * nettopp der den gamle flaten hentet demodata fra en annen produksjon.
 */
export interface StripboardCastMember {
  /** Kandidatens id når rollen er besatt, ellers rollens. */
  id: string;
  name: string;
  character: string;
  /** Scener karakteren er i. */
  scenes: string[];
}

export interface Stripboard {
  projectId: string;
  days: StripboardDay[];
  /** Scener som ikke er lagt på en dag ennå. */
  unscheduled: StripboardScene[];
  cast: StripboardCastMember[];
  totalScenes: number;
  scheduledScenes: number;
}

function mapScene(row: Record<string, unknown>): StripboardScene {
  return {
    entryId: row.entry_id === null || row.entry_id === undefined ? null : String(row.entry_id),
    sceneId: String(row.scene_id),
    sceneNumber: row.scene_number === null ? null : Number(row.scene_number),
    title: (row.title as string) ?? null,
    intExt: (row.int_ext as string) ?? null,
    timeOfDay: (row.time_of_day as string) ?? null,
    setting: (row.setting as string) ?? null,
    characters: Array.isArray(row.characters) ? (row.characters as string[]) : [],
    pageEighths: row.page_eighths === null ? null : Number(row.page_eighths),
    shootStatus: String(row.shoot_status ?? "not_shot"),
    sortOrder: Number(row.sort_order ?? 0),
    setupMinutes: Number(row.setup_minutes ?? 0),
  };
}

function summariseDay(
  productionDayId: string | null,
  date: string | null,
  status: string | null,
  scenes: StripboardScene[],
): StripboardDay {
  const totalEighths = scenes.reduce((sum, s) => sum + (s.pageEighths ?? 0), 0);
  const cast = new Set<string>();
  const locations = new Set<string>();
  for (const s of scenes) {
    for (const c of s.characters) cast.add(c.toUpperCase());
    if (s.setting) locations.add(s.setting.toUpperCase());
  }
  return {
    productionDayId,
    date,
    status,
    scenes,
    totalEighths,
    totalPagesLabel: formatEighths(totalEighths),
    totalSetupMinutes: scenes.reduce((sum, s) => sum + s.setupMinutes, 0),
    castCount: cast.size,
    locationCount: locations.size,
  };
}

export async function getStripboard(pool: Pool, projectId: string): Promise<Stripboard> {
  // Utgangspunktet er scenene, ikke radene. En scene uten rad er ikke fraværende
  // — den er uplanlagt, og det er nettopp bunken produsenten skal tømme.
  const rows = await pool.query(
    `SELECT e.id AS entry_id, s.id AS scene_id, e.production_day_id,
            COALESCE(e.sort_order, 0) AS sort_order,
            COALESCE(e.setup_minutes, 0) AS setup_minutes,
            s.scene_number, s.title, s.int_ext, s.time_of_day, s.setting, s.characters,
            s.page_eighths, s.shoot_status,
            d.date::text AS day_date, d.status AS day_status
       FROM casting_scenes s
       LEFT JOIN role_room_stripboard_entries e
              ON e.scene_id = s.id AND e.project_id = s.project_id
       LEFT JOIN casting_production_days d ON d.id = e.production_day_id
      WHERE s.project_id = $1
      ORDER BY d.date NULLS LAST, e.sort_order NULLS FIRST, s.scene_number NULLS LAST`,
    [projectId],
  );

  const byDay = new Map<string, { date: string | null; status: string | null; scenes: StripboardScene[] }>();
  const unscheduled: StripboardScene[] = [];

  for (const raw of rows.rows as Array<Record<string, unknown>>) {
    const scene = mapScene(raw);
    const dayId = raw.production_day_id as string | null;
    if (!dayId) {
      unscheduled.push(scene);
      continue;
    }
    if (!byDay.has(dayId)) {
      byDay.set(dayId, {
        date: (raw.day_date as string) ?? null,
        status: (raw.day_status as string) ?? null,
        scenes: [],
      });
    }
    byDay.get(dayId)!.scenes.push(scene);
  }

  const days = [...byDay.entries()].map(([id, d]) => summariseDay(id, d.date, d.status, d.scenes));

  return {
    projectId,
    days,
    unscheduled,
    cast: await resolveCast(pool, projectId, [...days.flatMap((d) => d.scenes), ...unscheduled]),
    totalScenes: rows.rowCount ?? 0,
    scheduledScenes: (rows.rowCount ?? 0) - unscheduled.length,
  };
}

/**
 * Karakterene i stripboardet, koblet til kandidaten som spiller dem.
 *
 * Karakterer uten rolle tas med, med rollenavnet som navn. De er som regel en
 * skrivefeil i manus eller en rolle som mangler — og å utelate dem ville
 * skjult begge deler. Se også role-room-scene-cast-service.ts, som bruker
 * samme navnenormalisering.
 */
async function resolveCast(
  pool: Pool,
  projectId: string,
  scenes: StripboardScene[],
): Promise<StripboardCastMember[]> {
  const sceneIdsByCharacter = new Map<string, { display: string; scenes: string[] }>();
  for (const scene of scenes) {
    for (const character of scene.characters) {
      const key = normaliseName(character);
      if (!key) continue;
      const entry = sceneIdsByCharacter.get(key) ?? { display: character.trim(), scenes: [] };
      entry.scenes.push(scene.sceneId);
      sceneIdsByCharacter.set(key, entry);
    }
  }
  if (sceneIdsByCharacter.size === 0) return [];

  const roles = await pool.query(
    `SELECT r.id AS role_id, r.name AS role_name, r.assigned_candidate_id, c.name AS candidate_name
       FROM casting_roles r
       LEFT JOIN casting_candidates c ON c.id = r.assigned_candidate_id
      WHERE r.project_id = $1`,
    [projectId],
  );

  const byName = new Map<string, Record<string, unknown>>();
  for (const row of roles.rows as Array<Record<string, unknown>>) {
    byName.set(normaliseName(String(row.role_name ?? "")), row);
  }

  return [...sceneIdsByCharacter.entries()].map(([key, entry]) => {
    const role = byName.get(key);
    return {
      id: String(role?.assigned_candidate_id ?? role?.role_id ?? key),
      name: String(role?.candidate_name ?? entry.display),
      character: entry.display,
      scenes: entry.scenes,
    };
  });
}

/** «KARI (V.O.)» og «kari» er samme karakter. */
function normaliseName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// ── Fremdrift (punkt 73) ────────────────────────────────────────────────────

export interface ShootProgress {
  projectId: string;
  scenesTotal: number;
  scenesShot: number;
  scenesPartial: number;
  scenesOmitted: number;
  /** Strøkne scener trekkes fra — de er ikke gjenstående arbeid. */
  scenesRemaining: number;
  eighthsTotal: number;
  eighthsShot: number;
  eighthsRemaining: number;
  pagesShotLabel: string;
  pagesRemainingLabel: string;
  /** Andel av sidene som er i boks, 0–1. Null når ingenting er målt opp. */
  completionRatio: number | null;
  /** Dager der noe fortsatt står ugjort, eldste først. */
  daysWithOutstandingWork: Array<{ date: string | null; remainingScenes: number }>;
}

/**
 * Fremdrift målt i sider, ikke i antall scener.
 *
 * Antall scener er et misvisende mål: femten korte dialogscener kan være en
 * halv dag, mens én actionscene kan være tre. Sider er grovt, men det er målet
 * bransjen faktisk planlegger etter.
 */
export async function getShootProgress(pool: Pool, projectId: string): Promise<ShootProgress> {
  const totals = await pool.query<{
    n: string; shot: string; partial: string; omitted: string;
    eighths: string; eighths_shot: string;
  }>(
    `SELECT COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE shoot_status = 'shot')::int     AS shot,
            COUNT(*) FILTER (WHERE shoot_status = 'partial')::int  AS partial,
            COUNT(*) FILTER (WHERE shoot_status = 'omitted')::int  AS omitted,
            COALESCE(SUM(page_eighths) FILTER (WHERE shoot_status <> 'omitted'), 0)::int AS eighths,
            COALESCE(SUM(page_eighths) FILTER (WHERE shoot_status = 'shot'), 0)::int     AS eighths_shot
       FROM casting_scenes
      WHERE project_id = $1`,
    [projectId],
  );

  const outstanding = await pool.query<{ day_date: string | null; n: string }>(
    `SELECT d.date::text AS day_date, COUNT(*)::int AS n
       FROM role_room_stripboard_entries e
       JOIN casting_scenes s ON s.id = e.scene_id
       LEFT JOIN casting_production_days d ON d.id = e.production_day_id
      WHERE e.project_id = $1
        AND s.shoot_status IN ('not_shot','partial')
      GROUP BY d.date
      ORDER BY d.date NULLS LAST`,
    [projectId],
  );

  const row = totals.rows[0];
  const scenesTotal = Number(row?.n ?? 0);
  const scenesShot = Number(row?.shot ?? 0);
  const scenesPartial = Number(row?.partial ?? 0);
  const scenesOmitted = Number(row?.omitted ?? 0);
  const eighthsTotal = Number(row?.eighths ?? 0);
  const eighthsShot = Number(row?.eighths_shot ?? 0);

  return {
    projectId,
    scenesTotal,
    scenesShot,
    scenesPartial,
    scenesOmitted,
    scenesRemaining: Math.max(scenesTotal - scenesShot - scenesOmitted, 0),
    eighthsTotal,
    eighthsShot,
    eighthsRemaining: Math.max(eighthsTotal - eighthsShot, 0),
    pagesShotLabel: formatEighths(eighthsShot),
    pagesRemainingLabel: formatEighths(Math.max(eighthsTotal - eighthsShot, 0)),
    // Null framfor 0 når ingenting er målt opp — «0 % ferdig» og «vi har ikke
    // målt sidene» er to helt ulike beskjeder.
    completionRatio: eighthsTotal > 0 ? Math.round((eighthsShot / eighthsTotal) * 1000) / 1000 : null,
    daysWithOutstandingWork: outstanding.rows.map((r) => ({
      date: r.day_date,
      remainingScenes: Number(r.n),
    })),
  };
}

/**
 * Legger en scene på en dag, eller tilbake i «ikke planlagt»-bunken når
 * productionDayId er null. Upsert, slik at å dra en scene til en ny dag ikke
 * etterlater den gamle raden.
 */
export async function assignSceneToDay(
  pool: Pool,
  input: {
    projectId: string;
    sceneId: string;
    productionDayId: string | null;
    sortOrder?: number;
    setupMinutes?: number;
  },
): Promise<{ entryId: string }> {
  // Fjern eventuell tidligere plassering av samme scene i dette prosjektet —
  // en scene hører til ett sted om gangen med mindre den bevisst deles.
  await pool.query(
    `DELETE FROM role_room_stripboard_entries
      WHERE project_id = $1 AND scene_id = $2
        AND production_day_id IS DISTINCT FROM $3`,
    [input.projectId, input.sceneId, input.productionDayId],
  );

  const r = await pool.query<{ id: string }>(
    `INSERT INTO role_room_stripboard_entries
       (project_id, scene_id, production_day_id, sort_order, setup_minutes)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (scene_id, production_day_id) DO UPDATE SET
       sort_order = EXCLUDED.sort_order,
       setup_minutes = EXCLUDED.setup_minutes,
       updated_at = NOW()
     RETURNING id`,
    [
      input.projectId, input.sceneId, input.productionDayId,
      input.sortOrder ?? 0, input.setupMinutes ?? 0,
    ],
  );
  return { entryId: r.rows[0].id };
}
