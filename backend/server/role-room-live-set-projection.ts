/**
 * role-room-live-set-projection.ts
 *
 * Folder live-set-hendelsesloggen til nåtilstand.
 *
 * On-set-tilstanden LAGRES allerede: `useLiveSet` skriver en hendelseslogg som
 * synkroniseres offline-først via `/live-set/events/batch`, med sesjoner,
 * idempotente event-id-er og ack. Det som manglet var en leser på serversiden —
 * tilstanden ble bare utledet i klientens egen reducer, av dens egen kø. En
 * annen enhet, en ny fane, eller en annen skjerm i produktet kunne hente
 * hendelsene, men ikke vite hva de betydde.
 *
 * Denne filen er den leseren. Den speiler `liveSetReducer` i
 * `hooks/useLiveSet.ts` — det er den autoritative definisjonen av hva en
 * hendelse gjør, og de to må være enige, ellers ser to skjermer ulik virkelighet.
 *
 * To ting utledes bedre her enn i klienten:
 *
 *   - **Varigheten** regnes fra ROLL-hendelsens `capturedAt` til CUT-ens.
 *     Klienten bruker sin egen `Date.now()`, som er riktig for den enheten,
 *     men ikke sammenliknbar på tvers av dem.
 *   - **Take-id-en** utledes av CUT-hendelsens `eventId`. Klienten genererer
 *     en tilfeldig id lokalt; skal to lesere være enige om hvilken take som er
 *     hvilken, må id-en komme fra noe begge ser.
 */

export const LIVE_SET_EVENT_TYPES = [
  "roll", "cut", "capture_take", "set_take_status", "add_flag",
  "add_note", "update_note", "delete_note", "set_scene",
  "setup_complete", "advance_scene", "set_camera", "set_setup", "set_cam",
] as const;

export type LiveSetEventType = (typeof LIVE_SET_EVENT_TYPES)[number];

export interface LiveSetEvent {
  eventId: string;
  sessionId: string;
  seq: number;
  type: string;
  payload?: Record<string, unknown> | null;
  capturedAt: string;
  deviceId?: string;
  operatorId?: string;
  shootingDayId?: string;
}

/** Speiler LiveSetTake i klienten, med de feltene loggen faktisk bærer. */
export interface ProjectedTake {
  id: string;
  sceneId: string | null;
  shotId: string | null;
  setupLabel: string | null;
  takeNumber: number;
  /** Sekunder, målt mellom ROLL og CUT. Null når det ikke lot seg måle. */
  duration: number | null;
  status: string;
  camera: string | null;
  lens: string | null;
  fps: number | null;
  flags: string[];
  notes: string | null;
  loggedBy: string | null;
  loggedAt: string;
}

export type LiveState = "idle" | "rolling" | "cut" | "setup-complete";

export interface LiveSetProjection {
  liveState: LiveState;
  currentSceneId: string | null;
  currentShotId: string | null;
  activeSetup: string | null;
  activeCam: string | null;
  /** Når rullingen startet. Null når ingenting ruller. */
  rollingSince: string | null;
  /** Neste take-nummer på gjeldende oppsett. */
  nextTakeNumber: number;
  takes: ProjectedTake[];
  lastAction: string | null;
  lastActionAt: string | null;
  lastActionBy: string | null;
  /** Hendelser som ble lest. Gjør det mulig å se at loggen faktisk hadde noe. */
  eventCount: number;
}

const EMPTY: LiveSetProjection = {
  liveState: "idle",
  currentSceneId: null,
  currentShotId: null,
  activeSetup: null,
  activeCam: null,
  rollingSince: null,
  nextTakeNumber: 1,
  takes: [],
  lastAction: null,
  lastActionAt: null,
  lastActionBy: null,
  eventCount: 0,
};

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Klientens vokabular for take-kvalitet. Ukjent verdi faller til «normal». */
const TAKE_STATUSES = new Set(["normal", "good", "ok", "bad", "circle", "print", "ng"]);
const sanitizeStatus = (value: unknown): string => {
  const s = typeof value === "string" ? value.toLowerCase() : "";
  return TAKE_STATUSES.has(s) ? s : "normal";
};

/**
 * Sorterer hendelsene slik de skjedde.
 *
 * `seq` er per sesjon, så den kan ikke sammenliknes på tvers av enheter —
 * to kameraassistenter med hver sin telefon starter begge på 1. `capturedAt`
 * er felles tidslinje; `seq` brukes bare til å skille hendelser som er
 * registrert i samme millisekund på samme enhet.
 */
export function orderEvents(events: LiveSetEvent[]): LiveSetEvent[] {
  return [...events].sort((a, b) => {
    const ta = Date.parse(a.capturedAt);
    const tb = Date.parse(b.capturedAt);
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    if (a.sessionId === b.sessionId) return a.seq - b.seq;
    return String(a.eventId).localeCompare(String(b.eventId));
  });
}

/**
 * Bygger nåtilstanden av hendelsesloggen.
 *
 * Guard-reglene fra klientens reducer er med: CUT uten ROLL gjør ingenting,
 * dobbelt ROLL gjør ingenting. Uten dem ville en logg som inneholder en
 * avvist handling — og loggen gjør det, fordi hendelsen skrives før reduceren
 * har sagt ja — gitt et annet svar her enn på skjermen den kom fra.
 */
export function projectLiveSet(
  events: LiveSetEvent[],
  options: { shootingDayId?: string } = {},
): LiveSetProjection {
  const relevant = options.shootingDayId
    ? events.filter((e) => e.shootingDayId === options.shootingDayId)
    : events;
  if (relevant.length === 0) return { ...EMPTY, takes: [] };

  let state: LiveSetProjection = { ...EMPTY, takes: [] };
  let rollStartedAt: string | null = null;
  let rollTokenCut: string | null = null;
  let activeRollToken: string | null = null;
  let lastDuration: number | null = null;
  const takes: ProjectedTake[] = [];
  const cameraMeta: { camera: string | null; lens: string | null; fps: number | null } = {
    camera: null, lens: null, fps: null,
  };

  const takeNumberFor = (setupLabel: string | null) =>
    takes.filter((t) => t.setupLabel === setupLabel).length + 1;

  for (const event of orderEvents(relevant)) {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    state.eventCount += 1;
    state.lastActionAt = event.capturedAt;
    state.lastActionBy = event.operatorId ?? null;

    switch (event.type) {
      case "set_scene": {
        state.currentSceneId = str(payload.sceneId);
        // Klienten utleder shot-id-en av scenen når den ikke er oppgitt.
        state.currentShotId = state.currentSceneId ? `shot-${state.currentSceneId}` : null;
        state.lastAction = "SET SCENE";
        break;
      }

      case "set_setup": {
        state.activeSetup = str(payload.label);
        state.lastAction = "SET SETUP";
        break;
      }

      case "set_cam": {
        state.activeCam = str(payload.cam);
        state.lastAction = "SET CAM";
        break;
      }

      case "set_camera": {
        cameraMeta.camera = str(payload.camera) ?? cameraMeta.camera;
        cameraMeta.lens = str(payload.lens) ?? cameraMeta.lens;
        cameraMeta.fps = num(payload.fps) ?? cameraMeta.fps;
        state.lastAction = "SET CAMERA";
        break;
      }

      case "roll": {
        // Reducerens guards: ingen scene, eller allerede rullende → avvist.
        if (!state.currentSceneId || state.liveState === "rolling") break;
        state.liveState = "rolling";
        rollStartedAt = event.capturedAt;
        activeRollToken = event.eventId;
        lastDuration = null;
        state.lastAction = "ROLLING";
        break;
      }

      case "cut": {
        if (state.liveState !== "rolling" || !rollStartedAt) break;
        if (activeRollToken && rollTokenCut === activeRollToken) break;

        const elapsed = Math.round(
          (Date.parse(event.capturedAt) - Date.parse(rollStartedAt)) / 1000,
        );
        lastDuration = Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;

        takes.push({
          // Utledet av hendelsen, ikke tilfeldig — to lesere må bli enige.
          id: `take:${event.eventId}`,
          sceneId: state.currentSceneId,
          shotId: state.currentShotId,
          setupLabel: state.activeSetup,
          takeNumber: takeNumberFor(state.activeSetup),
          duration: lastDuration,
          status: "normal",
          camera: state.activeCam ?? cameraMeta.camera,
          lens: cameraMeta.lens,
          fps: cameraMeta.fps,
          flags: [],
          notes: null,
          loggedBy: event.operatorId ?? null,
          loggedAt: event.capturedAt,
        });

        state.liveState = "cut";
        rollTokenCut = activeRollToken;
        activeRollToken = null;
        rollStartedAt = null;
        state.lastAction = "CUT";
        break;
      }

      case "capture_take": {
        const shotId = str(payload.shotId);
        if (!shotId) break;
        takes.push({
          id: `take:${event.eventId}`,
          sceneId: state.currentSceneId,
          shotId,
          setupLabel: state.activeSetup,
          takeNumber: takeNumberFor(state.activeSetup),
          // Fanget take arver varigheten fra siste CUT, som i klienten.
          duration: lastDuration,
          status: sanitizeStatus(payload.quality),
          camera: str(payload.camera) ?? state.activeCam ?? cameraMeta.camera,
          lens: str(payload.lens) ?? cameraMeta.lens,
          fps: num(payload.fps) ?? cameraMeta.fps,
          flags: Array.isArray(payload.continuityFlags)
            ? (payload.continuityFlags as unknown[]).map(String)
            : [],
          notes: str(payload.notes),
          loggedBy: event.operatorId ?? null,
          loggedAt: event.capturedAt,
        });
        state.liveState = "cut";
        rollStartedAt = null;
        state.lastAction = "CAPTURE TAKE";
        break;
      }

      case "set_take_status": {
        const id = str(payload.id);
        const status = sanitizeStatus(payload.status);
        // Klient-id-en og vår utledede id er ikke den samme. Vi matcher på
        // begge former, slik at en status satt fra den ene skjermen også
        // vises på den andre.
        const target =
          takes.find((t) => t.id === id) ?? takes.find((t) => t.id === `take:${id}`);
        if (target) target.status = status;
        state.lastAction = "SET TAKE STATUS";
        break;
      }

      case "add_flag": {
        const flag = str(payload.flag);
        const last = takes[takes.length - 1];
        if (flag && last && !last.flags.includes(flag)) last.flags.push(flag);
        state.lastAction = "ADD FLAG";
        break;
      }

      case "setup_complete": {
        // Kan ikke trigges under opptak — samme guard som i reduceren.
        if (state.liveState === "rolling") break;
        state.liveState = "setup-complete";
        state.lastAction = "SETUP COMPLETE";
        break;
      }

      case "advance_scene": {
        state.liveState = "idle";
        rollStartedAt = null;
        activeRollToken = null;
        lastDuration = null;
        state.lastAction = "ADVANCE SCENE";
        break;
      }

      default:
        // Notat-hendelser og ukjente typer endrer ikke opptakstilstanden.
        break;
    }
  }

  state = {
    ...state,
    rollingSince: rollStartedAt,
    // Nyeste først, som i klienten.
    takes: [...takes].reverse(),
    nextTakeNumber: takeNumberFor(state.activeSetup),
  };
  return state;
}
