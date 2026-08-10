/**
 * stripboardAdapter.ts
 *
 * Oversetter stripboardet fra backend til formen StripboardPanel tegner.
 *
 * Bakgrunn: panelet hentet fra `/api/production/:projectId/stripboard` — et
 * endepunkt som aldri fantes. Hver forespørsel feilet, ble fanget av en
 * `console.warn`, og panelet falt tilbake på demodata for en produksjon som
 * het «TROLL». Samtidig lå det en ferdig, testet datamodell i basen som bare
 * var eksponert via MCP. Denne filen er sømmen mellom dem.
 *
 * Egen fil, og uten React- eller MUI-import, av to grunner: StripboardPanel
 * har `@ts-nocheck` og fanger derfor ingen typefeil i en mapping, og en ren
 * funksjon kan testes uten å rendre noe.
 *
 * To forskjeller i datamodellene er verdt å kjenne til:
 *
 *   - Backend måler sider i åttedeler (bransjestandard: «2 3/8 side»),
 *     panelet i desimaltall. Konverteringen skjer her, én gang.
 *   - Backend skiller `partial` og `omitted` fra `not_shot`. Panelet kjente
 *     bare «ikke planlagt / planlagt / skutt / utsatt». En strøket scene er
 *     ikke en utsatt scene — den skal ikke telle som gjenstående arbeid — så
 *     statusene er lagt til framfor å presses inn i de gamle.
 */

// ── Backend-formen (speiler role-room-stripboard-service.ts) ───────────────

export interface ApiStripboardScene {
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

export interface ApiStripboardDay {
  productionDayId: string | null;
  date: string | null;
  status: string | null;
  scenes: ApiStripboardScene[];
  totalEighths: number;
  totalPagesLabel: string;
  totalSetupMinutes: number;
  castCount: number;
  locationCount: number;
}

export interface ApiStripboardCastMember {
  id: string;
  name: string;
  character: string;
  scenes: string[];
}

export interface ApiStripboard {
  projectId: string;
  days: ApiStripboardDay[];
  unscheduled: ApiStripboardScene[];
  cast: ApiStripboardCastMember[];
  totalScenes: number;
  scheduledScenes: number;
}

export type StripStatus =
  | 'not-scheduled'
  | 'scheduled'
  | 'partial'
  | 'shot'
  | 'omitted'
  | 'postponed';

export interface AdaptedStrip {
  id: string;
  sceneId: string;
  sceneNumber: string;
  shootingDayId?: string;
  dayNumber?: number;
  sortOrder: number;
  color: string;
  location: string;
  pages: number;
  cast: string[];
  status: StripStatus;
  estimatedTime: number;
  notes?: string;
}

// ── Farge ───────────────────────────────────────────────────────────────────

/**
 * Stripefargen følger bransjekonvensjonen INT/EXT × tid på døgnet, og hex-ene
 * er de samme som STRIP_COLORS i stripboard.constants.ts — panelet slår opp
 * fargen baklengs derfra, så de må stemme.
 */
const STRIP_HEX = {
  INT_DAY: '#fff9c4',
  INT_NIGHT: '#9c27b0',
  EXT_DAY: '#e3f2fd',
  EXT_NIGHT: '#1a237e',
  EXT_DAWN: '#ffccbc',
  EXT_DUSK: '#bf5530',
} as const;

const NIGHT_WORDS = ['NIGHT', 'NATT', 'KVELD'];
const DAWN_WORDS = ['DAWN', 'GRYNING', 'MORGEN'];
const DUSK_WORDS = ['DUSK', 'SKUMRING', 'SOLNEDGANG'];

export function stripColor(intExt: string | null, timeOfDay: string | null): string {
  const exterior = (intExt ?? '').toUpperCase().includes('EXT');
  const time = (timeOfDay ?? '').toUpperCase();

  // Gryning og skumring finnes bare som utefarger i konvensjonen — en
  // innescene lyssettes uansett, og tidspunktet endrer ikke stripa.
  if (exterior && DAWN_WORDS.some((w) => time.includes(w))) return STRIP_HEX.EXT_DAWN;
  if (exterior && DUSK_WORDS.some((w) => time.includes(w))) return STRIP_HEX.EXT_DUSK;

  const night = NIGHT_WORDS.some((w) => time.includes(w));
  if (exterior) return night ? STRIP_HEX.EXT_NIGHT : STRIP_HEX.EXT_DAY;
  return night ? STRIP_HEX.INT_NIGHT : STRIP_HEX.INT_DAY;
}

// ── Status ──────────────────────────────────────────────────────────────────

export function stripStatus(shootStatus: string, onDay: boolean): StripStatus {
  switch (shootStatus) {
    case 'shot':
      return 'shot';
    case 'partial':
      return 'partial';
    case 'omitted':
      return 'omitted';
    default:
      // «Planlagt» betyr at scenen ligger på en dag — ikke noe annet.
      return onDay ? 'scheduled' : 'not-scheduled';
  }
}

// ── Tid ─────────────────────────────────────────────────────────────────────

/**
 * Grov tommelfingerregel for opptakstid per side.
 *
 * Bevisst én navngitt konstant og ikke en modell: den som planlegger vet
 * bedre enn oss, og et tall som later som det er regnet ut ville blitt trodd.
 * Rigge-/flyttetiden som ligger i basen er derimot ekte og legges til som den er.
 */
export const MINUTES_PER_PAGE = 60;

export function estimateMinutes(pageEighths: number | null, setupMinutes: number): number {
  const pages = (pageEighths ?? 0) / 8;
  return Math.round(pages * MINUTES_PER_PAGE) + setupMinutes;
}

// ── Mapping ─────────────────────────────────────────────────────────────────

function adaptScene(
  scene: ApiStripboardScene,
  day: { productionDayId: string | null; dayNumber?: number } | null,
): AdaptedStrip {
  return {
    // Scener uten stripboard-rad har ingen entryId ennå. En stabil syntetisk
    // id holder React-nøkler og drag-and-drop i orden inntil raden lages.
    id: scene.entryId ?? `scene:${scene.sceneId}`,
    sceneId: scene.sceneId,
    sceneNumber: scene.sceneNumber === null ? '' : String(scene.sceneNumber),
    shootingDayId: day?.productionDayId ?? undefined,
    dayNumber: day?.dayNumber,
    sortOrder: scene.sortOrder,
    color: stripColor(scene.intExt, scene.timeOfDay),
    location: scene.setting ?? scene.title ?? '',
    pages: (scene.pageEighths ?? 0) / 8,
    cast: scene.characters ?? [],
    status: stripStatus(scene.shootStatus, Boolean(day?.productionDayId)),
    estimatedTime: estimateMinutes(scene.pageEighths, scene.setupMinutes),
  };
}

/**
 * Flater stripboardet ut til stripene panelet tegner.
 *
 * Dagnummeret utledes av datorekkefølgen, ikke av en kolonne: «dag 3» er den
 * tredje opptaksdagen, og settes en ny dag inn i midten flytter de bak seg.
 * Dager uten dato havner bakerst og får ikke nummer, framfor å låne et.
 */
export function adaptStripboard(board: ApiStripboard): AdaptedStrip[] {
  const dated = board.days
    .filter((d) => d.productionDayId && d.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const dayNumbers = new Map<string, number>();
  dated.forEach((d, index) => dayNumbers.set(String(d.productionDayId), index + 1));

  const strips: AdaptedStrip[] = [];
  for (const day of board.days) {
    const id = day.productionDayId;
    for (const scene of day.scenes) {
      strips.push(
        adaptScene(scene, {
          productionDayId: id,
          dayNumber: id ? dayNumbers.get(id) : undefined,
        }),
      );
    }
  }
  for (const scene of board.unscheduled) {
    strips.push(adaptScene(scene, null));
  }
  return strips;
}
