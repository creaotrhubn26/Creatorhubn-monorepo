/**
 * role-room-live-set-service.ts
 *
 * Service-lag for Role Room "live set" data: in-progress shooting-day-
 * sessions og kontinuerlige events fra on-set-kapasitet. Brukes av
 * /api/role-room/projects/:projectId/live-set/* endpoints.
 *
 * Tilstand: 2 in-memory Maps (sessions per projectId, events per
 * projectId) speilet til legacy compat-store (`role-room:live-set-
 * sessions:...` og `role-room:live-set-events:...`-prefiks). Service-
 * laget eier Maps internt — ingen lekkasje av referansen.
 *
 * Maps er prosjekt-spesifikke og deles IKKE med /api/casting. Derfor
 * trygt å lukke dem inn i service-modulen.
 *
 * Eksporterer factory `createRoleRoomLiveSetService(deps)` som tar
 * compatStore-funksjoner og key-generatorer via deps og returnerer 4
 * metoder: read/replace for sessions og events.
 *
 * `replace*`-metodene oppdaterer både Map og DB i én operasjon slik at
 * routes-modulen ikke trenger å koordinere mellom de to laggene selv.
 */

export interface RoleRoomLiveSetServiceDeps {
  compatStoreGet: <T>(storeKey: string) => Promise<T | null>;
  compatStoreSet: (storeKey: string, storeValue: unknown) => Promise<void>;
  dbLegacyLiveSetSessionsKey: (projectId: string) => string;
  dbLegacyLiveSetEventsKey: (projectId: string) => string;
}

export interface RoleRoomLiveSetService {
  getLegacyLiveSetSessions: (projectId: string) => Promise<unknown[]>;
  replaceLegacyLiveSetSessions: (
    projectId: string,
    sessions: unknown[],
  ) => Promise<void>;
  getLegacyLiveSetEvents: (projectId: string) => Promise<unknown[]>;
  replaceLegacyLiveSetEvents: (
    projectId: string,
    events: unknown[],
  ) => Promise<void>;
}

export function createRoleRoomLiveSetService(
  deps: RoleRoomLiveSetServiceDeps,
): RoleRoomLiveSetService {
  const {
    compatStoreGet,
    compatStoreSet,
    dbLegacyLiveSetSessionsKey,
    dbLegacyLiveSetEventsKey,
  } = deps;

  const legacyLiveSetSessionsByProject = new Map<string, unknown[]>();
  const legacyLiveSetEventsByProject = new Map<string, unknown[]>();

  async function getLegacyLiveSetSessions(projectId: string): Promise<unknown[]> {
    const dbSessions = await compatStoreGet<unknown[]>(
      dbLegacyLiveSetSessionsKey(projectId),
    );
    if (Array.isArray(dbSessions)) {
      legacyLiveSetSessionsByProject.set(projectId, dbSessions);
      return dbSessions;
    }
    return legacyLiveSetSessionsByProject.get(projectId) || [];
  }

  async function replaceLegacyLiveSetSessions(
    projectId: string,
    sessions: unknown[],
  ): Promise<void> {
    legacyLiveSetSessionsByProject.set(projectId, sessions);
    await compatStoreSet(dbLegacyLiveSetSessionsKey(projectId), sessions);
  }

  async function getLegacyLiveSetEvents(projectId: string): Promise<unknown[]> {
    const dbEvents = await compatStoreGet<unknown[]>(
      dbLegacyLiveSetEventsKey(projectId),
    );
    if (Array.isArray(dbEvents)) {
      legacyLiveSetEventsByProject.set(projectId, dbEvents);
      return dbEvents;
    }
    return legacyLiveSetEventsByProject.get(projectId) || [];
  }

  async function replaceLegacyLiveSetEvents(
    projectId: string,
    events: unknown[],
  ): Promise<void> {
    legacyLiveSetEventsByProject.set(projectId, events);
    await compatStoreSet(dbLegacyLiveSetEventsKey(projectId), events);
  }

  return {
    getLegacyLiveSetSessions,
    replaceLegacyLiveSetSessions,
    getLegacyLiveSetEvents,
    replaceLegacyLiveSetEvents,
  };
}
