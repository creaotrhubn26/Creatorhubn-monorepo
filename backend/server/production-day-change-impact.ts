/**
 * Hva brekker hvis en opptaksdag flyttes til en annen dato.
 *
 * Ren lesning. Ingen ny tabell og ingen migrasjon: hver kant finnes allerede
 * som fremmednøkkel eller som en dato å sammenligne mot. Se
 * docs/role-room/PRODUCTION_GRAPH_CHANGE_IMPACT_PLAN.md §4.
 *
 * Budsjettlinjer er bevisst utelatt. role_room_budget_items har
 * linked_entity_type/linked_entity_id, men målt mot produksjon 2026-09-16 var
 * alle 20 radene NULL — kolonnen finnes, koblingen brukes ikke. Den tas inn
 * den dagen noen faktisk skriver til den, ikke før.
 */

export type ImpactSeverity = 'blocking' | 'warning' | 'info';
export type ImpactArea =
  | 'call_sheet'
  | 'equipment'
  | 'location'
  | 'location_readiness'
  | 'scout_media'
  | 'continuity'
  | 'schedule'
  | 'scene_prep'
  | 'scene_cast'
  | 'scene_material'
  | 'prop_availability'
  | 'prop_load';

export interface ChangeImpact {
  area: ImpactArea;
  severity: ImpactSeverity;
  /** Én setning brukeren kan handle på. */
  summary: string;
  /** Hva som må gjøres. Tom for `info`. */
  action?: string;
  count: number;
}

interface QueryablePool {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
}

function count(rows: Array<Record<string, unknown>>): number {
  const value = rows[0]?.count;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Samler påvirkningene for én dagflytting.
 *
 * Hver spørring er avgrenset til prosjektet. En feilende delspørring kaster
 * videre — kalleren skal ikke kunne presentere en ufullstendig liste som om
 * den var komplett.
 */
export async function collectProductionDayChangeImpact(
  pool: QueryablePool,
  input: { projectId: string; dayId: string; fromDate: string; toDate: string },
): Promise<ChangeImpact[]> {
  const { projectId, dayId, fromDate, toDate } = input;
  const impacts: ChangeImpact[] = [];

  // 1. Publisert call sheet oppgir den gamle datoen.
  const callSheets = await pool.query(
    `SELECT count(*)::int AS count
       FROM role_room_call_sheet_deliveries
      WHERE project_id = $1 AND production_day_id = $2 AND status = 'published'`,
    [projectId, dayId],
  );
  const publishedCallSheets = count(callSheets.rows);
  if (publishedCallSheets > 0) {
    impacts.push({
      area: 'call_sheet',
      severity: 'blocking',
      summary: `Call sheet er publisert med ${fromDate}.`,
      action: 'Må republiseres etter flyttingen.',
      count: publishedCallSheets,
    });
  }

  // 2. Utstyr booket rundt den gamle datoen. Bookingen er tidsstemplet;
  //    overlapp regnes mot hele kalenderdagen i prosjektets tidssone.
  const bookings = await pool.query(
    `SELECT count(*)::int AS count
       FROM equipment_bookings
      WHERE project_id = $1
        AND status <> 'cancelled'
        AND start_date < ($2::date + INTERVAL '1 day')
        AND end_date   >= $2::date`,
    [projectId, fromDate],
  );
  const bookingCount = count(bookings.rows);
  if (bookingCount > 0) {
    impacts.push({
      area: 'equipment',
      severity: 'warning',
      summary: `${bookingCount} utstyrsbooking${bookingCount === 1 ? '' : 'er'} dekker ${fromDate}.`,
      action: 'Flytt eller bekreft bookingen for den nye datoen.',
      count: bookingCount,
    });
  }

  // 3. Lokasjonen har operativ status — tilgang, tillatelser, recce — som ble
  //    bekreftet for den gamle datoen.
  const locationOps = await pool.query(
    `SELECT count(*)::int AS count
       FROM role_room_location_operations ops
       JOIN casting_production_days day
         ON day.id = $2 AND day.location_id = ops.location_id
      WHERE ops.project_id = $1`,
    [projectId, dayId],
  );
  const locationCount = count(locationOps.rows);
  if (locationCount > 0) {
    impacts.push({
      area: 'location',
      severity: 'warning',
      summary: 'Lokasjonens tilgang og tillatelser er bekreftet for den gamle datoen.',
      action: 'Bekreft at avtalen også gjelder den nye datoen.',
      count: locationCount,
    });
  }

  // 4. Annet som allerede er planlagt på den nye datoen.
  const collisions = await pool.query(
    `SELECT count(*)::int AS count
       FROM casting_schedules
      WHERE project_id = $1 AND date = $2::date`,
    [projectId, toDate],
  );
  const collisionCount = count(collisions.rows);
  if (collisionCount > 0) {
    impacts.push({
      area: 'schedule',
      severity: 'warning',
      summary: `${collisionCount} annen oppføring ligger allerede på ${toDate}.`,
      action: 'Sjekk at de kan skje samme dag.',
      count: collisionCount,
    });
  }

  // 5. Kontinuitetsbevis følger dagen automatisk. Verdt å vite, ikke å rydde.
  const continuity = await pool.query(
    `SELECT count(*)::int AS count
       FROM casting_production_continuity_media
      WHERE project_id = $1 AND production_day_id = $2`,
    [projectId, dayId],
  );
  const continuityCount = count(continuity.rows);
  if (continuityCount > 0) {
    impacts.push({
      area: 'continuity',
      severity: 'info',
      summary: `${continuityCount} kontinuitetsfil${continuityCount === 1 ? '' : 'er'} følger dagen.`,
      count: continuityCount,
    });
  }

  return impacts;
}

/**
 * Hva brekker hvis dagens scener byttes.
 *
 * Kantene er valgt etter hva som faktisk er fylt ut i produksjon, målt
 * 2026-09-18: storyboards 34 rader med scene, dialog 54, brukerfiler 121,
 * roller med scener 16, shotlister 8, kontinuitet 1. Take-godkjenninger og
 * casting_schedules.scene_id er tomme og tas derfor ikke inn — en advarsel
 * bygget på en kolonne ingen skriver til er en gjetning med selvtillit.
 *
 * Scener som fjernes veier tyngst: arbeidet er gjort, og det er dagen som
 * mister det. Scener som legges til varsler om manglende forarbeid.
 */
export async function collectProductionDaySceneImpact(
  pool: QueryablePool,
  input: {
    projectId: string;
    dayId: string;
    fromSceneIds: string[];
    toSceneIds: string[];
  },
): Promise<ChangeImpact[]> {
  const { projectId, dayId, fromSceneIds, toSceneIds } = input;
  const before = new Set(fromSceneIds.map(String));
  const after = new Set(toSceneIds.map(String));
  const removed = [...before].filter((id) => !after.has(id));
  const added = [...after].filter((id) => !before.has(id));
  const impacts: ChangeImpact[] = [];

  if (removed.length === 0 && added.length === 0) return impacts;

  // 1. Publisert call sheet lister dagens scener og hvem som er kalt inn.
  const callSheets = await pool.query(
    `SELECT count(*)::int AS count
       FROM role_room_call_sheet_deliveries
      WHERE project_id = $1 AND production_day_id = $2 AND status = 'published'`,
    [projectId, dayId],
  );
  const publishedCallSheets = count(callSheets.rows);
  if (publishedCallSheets > 0) {
    impacts.push({
      area: 'call_sheet',
      severity: 'blocking',
      summary: 'Call sheet er publisert med dagens scener.',
      action: 'Må republiseres etter endringen.',
      count: publishedCallSheets,
    });
  }

  if (removed.length > 0) {
    // 2. Kontinuitet er allerede skutt på en scene som nå forsvinner fra dagen.
    const continuity = await pool.query(
      `SELECT count(*)::int AS count
         FROM casting_production_continuity_media
        WHERE project_id = $1 AND production_day_id = $2 AND scene_id = ANY($3::text[])`,
      [projectId, dayId, removed],
    );
    const continuityCount = count(continuity.rows);
    if (continuityCount > 0) {
      impacts.push({
        area: 'continuity',
        severity: 'blocking',
        summary: `${continuityCount} kontinuitetsfil${continuityCount === 1 ? ' er' : 'er er'} skutt på scener som fjernes.`,
        action: 'Flytt bevisene til dagen scenen faktisk skytes.',
        count: continuityCount,
      });
    }

    // 3. Skuespillere er kalt inn for scenene som forsvinner.
    const cast = await pool.query(
      `SELECT count(*)::int AS count
         FROM casting_roles
        WHERE project_id = $1
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(COALESCE(scene_ids, '[]'::jsonb)) AS scene(id)
             WHERE scene.id = ANY($2::text[])
          )`,
      [projectId, removed],
    );
    const castCount = count(cast.rows);
    if (castCount > 0) {
      impacts.push({
        area: 'scene_cast',
        severity: 'warning',
        summary: `${castCount} rolle${castCount === 1 ? '' : 'r'} er knyttet til scenene som fjernes.`,
        action: 'Gi beskjed hvis noen ikke lenger skal møte.',
        count: castCount,
      });
    }
  }

  if (added.length > 0) {
    // 4. Er scenene som legges til forberedt i det hele tatt?
    const prepared = await pool.query(
      `SELECT count(DISTINCT scene_id)::int AS count
         FROM (
           SELECT scene_id FROM casting_shot_lists
            WHERE project_id = $1 AND scene_id = ANY($2::text[])
           UNION
           SELECT scene_id FROM casting_storyboards
            WHERE project_id = $1 AND scene_id = ANY($2::text[])
         ) AS forarbeid`,
      [projectId, added],
    );
    const preparedCount = count(prepared.rows);
    const unprepared = added.length - preparedCount;
    if (unprepared > 0) {
      impacts.push({
        area: 'scene_prep',
        severity: 'warning',
        summary: `${unprepared} av ${added.length} nye scene${added.length === 1 ? '' : 'r'} har verken shotliste eller storyboard.`,
        action: 'Avklar forarbeidet før dagen låses.',
        count: unprepared,
      });
    }

    // 5. Materiale som allerede ligger på de nye scenene. Verdt å vite.
    const material = await pool.query(
      `SELECT count(*)::int AS count
         FROM role_room_user_files
        WHERE project_id = $1 AND scene_id = ANY($2::text[])`,
      [projectId, added],
    );
    const materialCount = count(material.rows);
    if (materialCount > 0) {
      impacts.push({
        area: 'scene_material',
        severity: 'info',
        summary: `${materialCount} fil${materialCount === 1 ? '' : 'er'} ligger allerede på de nye scenene.`,
        count: materialCount,
      });
    }
  }

  return impacts;
}

/**
 * Hva brekker hvis dagens rekvisitter byttes.
 *
 * Målt mot produksjon 2026-09-18: casting_props har 16 rader, 8 av dem i
 * Troll, og null produksjonsdager har `prop_ids` fylt ut. Koblingen finnes i
 * skjemaet og er ubrukt — så dette er ikke en rapport over eksisterende
 * arbeid, men porten som gjør at arbeidet kan begynne uten å skape rot.
 *
 * `availability` er det eneste feltet rekvisittene faktisk fører, så det er
 * det eneste vi advarer på. En advarsel om noe annet ville vært oppdiktet.
 */
export async function collectProductionDayPropImpact(
  pool: QueryablePool,
  input: {
    projectId: string;
    dayId: string;
    fromPropIds: string[];
    toPropIds: string[];
  },
): Promise<ChangeImpact[]> {
  const { projectId, dayId, fromPropIds, toPropIds } = input;
  const before = new Set(fromPropIds.map(String));
  const after = new Set(toPropIds.map(String));
  const added = [...after].filter((id) => !before.has(id));
  const removed = [...before].filter((id) => !after.has(id));
  const impacts: ChangeImpact[] = [];

  if (added.length === 0 && removed.length === 0) return impacts;

  // 1. Publisert call sheet lister dagens rekvisitter.
  const callSheets = await pool.query(
    `SELECT count(*)::int AS count
       FROM role_room_call_sheet_deliveries
      WHERE project_id = $1 AND production_day_id = $2 AND status = 'published'`,
    [projectId, dayId],
  );
  const publishedCallSheets = count(callSheets.rows);
  if (publishedCallSheets > 0) {
    impacts.push({
      area: 'call_sheet',
      severity: 'blocking',
      summary: 'Call sheet er publisert med dagens rekvisitter.',
      action: 'Må republiseres etter endringen.',
      count: publishedCallSheets,
    });
  }

  if (added.length > 0) {
    // 2. Rekvisitter som ikke er merket tilgjengelige.
    const unavailable = await pool.query(
      `SELECT count(*)::int AS count
         FROM casting_props
        WHERE project_id = $1
          AND id = ANY($2::text[])
          AND COALESCE(availability, 'available') <> 'available'`,
      [projectId, added],
    );
    const unavailableCount = count(unavailable.rows);
    if (unavailableCount > 0) {
      impacts.push({
        area: 'prop_availability',
        severity: 'warning',
        summary: `${unavailableCount} av rekvisittene som legges til er ikke merket tilgjengelige.`,
        action: 'Bekreft at de kan skaffes til denne dagen.',
        count: unavailableCount,
      });
    }

    // 3. Samme rekvisitt er allerede satt opp på en annen dag med samme dato.
    const sameDay = await pool.query(
      `SELECT count(*)::int AS count
         FROM casting_production_days other
         JOIN casting_production_days this
           ON this.id = $2 AND this.project_id = other.project_id AND other.date = this.date
        WHERE other.project_id = $1
          AND other.id <> $2
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(COALESCE(other.prop_ids, '[]'::jsonb)) AS prop(id)
             WHERE prop.id = ANY($3::text[])
          )`,
      [projectId, dayId, added],
    );
    const clashCount = count(sameDay.rows);
    if (clashCount > 0) {
      impacts.push({
        area: 'prop_load',
        severity: 'warning',
        summary: `${clashCount} annen opptaksdag samme dato bruker de samme rekvisittene.`,
        action: 'Avklar hvem som har dem når.',
        count: clashCount,
      });
    }
  }

  return impacts;
}

/** True hvis noe må ryddes før flyttingen kan skje. */
export function hasBlockingImpact(impacts: ChangeImpact[]): boolean {
  return impacts.some((impact) => impact.severity === 'blocking');
}

/**
 * Hva brekker hvis dagen flyttes til en annen lokasjon.
 *
 * Bevisst strukturelt: vi sjekker om det finnes operativ status for gammel og
 * ny lokasjon, ikke hva som står inni `operations`-bloben. Målt mot produksjon
 * 2026-09-16 var role_room_location_operations tom, så innholdet kan ikke
 * verifiseres — og en advarsel bygget på et felt ingen har fylt ut ville vært
 * en gjetning med selvtillit.
 */
export async function collectProductionDayLocationImpact(
  pool: QueryablePool,
  input: {
    projectId: string;
    dayId: string;
    fromLocationId: string | null;
    toLocationId: string;
  },
): Promise<ChangeImpact[]> {
  const { projectId, dayId, fromLocationId, toLocationId } = input;
  const impacts: ChangeImpact[] = [];

  // 1. Publisert call sheet oppgir den gamle lokasjonen.
  const callSheets = await pool.query(
    `SELECT count(*)::int AS count
       FROM role_room_call_sheet_deliveries
      WHERE project_id = $1 AND production_day_id = $2 AND status = 'published'`,
    [projectId, dayId],
  );
  const publishedCallSheets = count(callSheets.rows);
  if (publishedCallSheets > 0) {
    impacts.push({
      area: 'call_sheet',
      severity: 'blocking',
      summary: 'Call sheet er publisert med den gamle lokasjonen.',
      action: 'Må republiseres etter byttet.',
      count: publishedCallSheets,
    });
  }

  // 2. Arbeidet som er lagt ned på den gamle lokasjonen.
  if (fromLocationId) {
    const oldOps = await pool.query(
      `SELECT count(*)::int AS count
         FROM role_room_location_operations
        WHERE project_id = $1 AND location_id = $2`,
      [projectId, fromLocationId],
    );
    const oldCount = count(oldOps.rows);
    if (oldCount > 0) {
      impacts.push({
        area: 'location',
        severity: 'warning',
        summary: 'Tilgang, tillatelser og recce er registrert på den gamle lokasjonen.',
        action: 'Avklar om avtalen skal avbestilles.',
        count: oldCount,
      });
    }

    const scout = await pool.query(
      `SELECT count(*)::int AS count
         FROM casting_location_scout_media
        WHERE project_id = $1 AND location_id = $2`,
      [projectId, fromLocationId],
    );
    const scoutCount = count(scout.rows);
    if (scoutCount > 0) {
      impacts.push({
        area: 'scout_media',
        severity: 'info',
        summary: `${scoutCount} scout-fil${scoutCount === 1 ? '' : 'er'} hører til den gamle lokasjonen.`,
        count: scoutCount,
      });
    }
  }

  // 3. Er det gjort noe arbeid på den nye i det hele tatt?
  const newOps = await pool.query(
    `SELECT count(*)::int AS count
       FROM role_room_location_operations
      WHERE project_id = $1 AND location_id = $2`,
    [projectId, toLocationId],
  );
  if (count(newOps.rows) === 0) {
    impacts.push({
      area: 'location_readiness',
      severity: 'warning',
      summary: 'Den nye lokasjonen har ingen registrert tilgang eller tillatelse.',
      action: 'Bekreft eier, adkomst og tillatelser før dagen låses.',
      count: 0,
    });
  }

  return impacts;
}
