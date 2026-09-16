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
  | 'schedule';

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
