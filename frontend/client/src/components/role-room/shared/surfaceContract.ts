/**
 * Flatekontrakten for The Role Room.
 *
 * `casting-main.tsx` velger én av flere gjensidig utelukkende flater ved
 * innlasting: Talents-appen, produksjonsarbeidsflaten, portalene og et knippe
 * engangsflyter. Flatene er søskengrener, ikke lag over hverandre, og det er
 * nettopp derfor de driver fra hverandre: noe monteres i én gren og antas å
 * gjelde overalt.
 *
 * Det har skjedd i praksis. Flatevelgeren ble montert i `RoleRoomUXLayer` og
 * nådde aldri Talents-appen, som har sitt eget skall — så en talent satt fast
 * i den ene flaten som ikke hadde vei ut. Ingen av de 898 testene så det,
 * fordi hver av dem så én komponent om gangen.
 *
 * Denne kontrakten er listen over flater og hvor veien ut kommer fra.
 * `surfaceContract.test.ts` leser grenene ut av `casting-main.tsx` og feiler
 * hvis en ny dukker opp som ikke står her. Da må den som la den til ta
 * stilling til spørsmålet — ikke oppdage svaret i produksjon.
 */

/**
 * - `workspace`: et sted brukeren blir værende og arbeider.
 * - `shell`: rammen rundt flere workspaces; eier den delte toppraden.
 * - `flow`: en engangsflyt med ett mål (godta invitasjon, registrere seg).
 * - `public`: flaten for den som ikke er logget inn.
 */
export type RoleRoomSurfaceKind = 'workspace' | 'shell' | 'flow' | 'public';

/**
 * Hvor veien ut av flaten kommer fra.
 *
 * - `own`: flaten monterer flatevelgeren selv.
 * - `{ from }`: flaten ligger inne i et skall som gjør det.
 * - `none`: flaten har ingen andre flater å gå til ennå, og det er et svar,
 *   ikke en forglemmelse.
 */
export type SurfaceEscapeHatch = 'own' | 'none' | { readonly from: string };

export interface RoleRoomSurfaceEntry {
  /** Komponentnavnet slik `casting-main.tsx` skriver det. */
  readonly component: string;
  readonly kind: RoleRoomSurfaceKind;
  readonly escapeHatch: SurfaceEscapeHatch;
  readonly note: string;
}

export const ROLE_ROOM_SURFACE_CONTRACT = [
  {
    component: 'TalentSignupPage',
    kind: 'flow',
    escapeHatch: 'none',
    note: 'Registrering. Har ett mål og ender i Talents-appen, som har veien videre.',
  },
  {
    component: 'PartnerInviteAcceptPage',
    kind: 'flow',
    escapeHatch: 'none',
    note: 'Åpnes fra en invitasjonslenke og avsluttes med å godta eller avslå.',
  },
  {
    component: 'TalentProposalAcceptPage',
    kind: 'flow',
    escapeHatch: 'none',
    note: 'Samme form som partnerinvitasjonen, for et foreslått talent.',
  },
  {
    component: 'TheRoleRoomLanding',
    kind: 'public',
    escapeHatch: 'none',
    note: 'Uinnlogget landingsside. Uten sesjon finnes det ingen andre flater å bytte til.',
  },
  {
    component: 'TalentsApp',
    kind: 'workspace',
    escapeHatch: 'own',
    note: 'Eget skall, søskengren til RoleRoomUXLayer. Her manglet veien ut fram til PR #2375.',
  },
  {
    component: 'RoleRoomUXLayer',
    kind: 'shell',
    escapeHatch: 'own',
    note: 'Delt topprad for produksjon og begge portalene. Eier flatevelgeren for dem.',
  },
  {
    component: 'CastingPlannerPanel',
    kind: 'workspace',
    escapeHatch: { from: 'RoleRoomUXLayer' },
    note: 'Produksjonsarbeidsflaten, inkludert admin-linsen for produkteier.',
  },
  {
    component: 'AgencyPortalView',
    kind: 'workspace',
    escapeHatch: { from: 'RoleRoomUXLayer' },
    note: 'Agenturets flate over egne talenter.',
  },
  {
    component: 'TalentPortalView',
    kind: 'workspace',
    escapeHatch: { from: 'RoleRoomUXLayer' },
    note: 'Prosjektspesifikk talentflate, åpnet fra invitasjonslenker.',
  },
] as const satisfies readonly RoleRoomSurfaceEntry[];

/** Flater som monterer flatevelgeren selv. */
export const SURFACE_SHELLS: readonly string[] = ROLE_ROOM_SURFACE_CONTRACT
  .filter((surface) => surface.escapeHatch === 'own')
  .map((surface) => surface.component);

/**
 * Komponenter som bare pakker inn en flate uten å være en flate selv. De
 * hoppes over når grenene i `casting-main.tsx` leses, slik at kontrakten
 * beskriver flater og ikke tilfeldig kontekst-plassering.
 */
export const TRANSPARENT_SURFACE_WRAPPERS: readonly string[] = ['ToastProvider'];
