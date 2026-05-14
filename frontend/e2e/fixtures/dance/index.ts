/**
 * Typed re-export av dance-fixtures.
 *
 * Importer derfra (ikke direkte JSON), så TS-typer følger med og en
 * spec som klipper et felt får compile-feil i stedet for runtime-mismatch.
 *
 * Vi leser JSON via fs i stedet for ESM-import for å unngå
 * `import ... with { type: 'json' }`-krav i Node 22+ ESM-loader.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

function loadJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(DIR, filename), 'utf8')) as T;
}

export interface DancerFixture {
  id: string;
  name: string;
  email: string;
  role: string;
  portrait: string;
  heightCm: number;
  dancePrimaryStyle: string;
  strengths: string[];
  injuryStatus: string;
}

export interface TeamFixture {
  teamOrganizationId: string;
  ownerUserId: string;
  memberCount: number;
  activeMemberCount: number;
  seatLimit: number | null;
  seatRemaining: number | null;
  defaultInviteRoleId: string | null;
  label: string;
}

export interface RoleFixture {
  id: string;
  teamOrganizationId: string;
  label: string;
  capabilities: Record<string, boolean>;
  isOwnerRole: boolean;
  isDefaultForInvite: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const fx = {
  dancers: loadJson<DancerFixture[]>('dancers.json'),
  teams: loadJson<TeamFixture[]>('teams.json'),
  roles: loadJson<RoleFixture[]>('roles.json'),
  members: loadJson<Array<Record<string, unknown>>>('members.json'),
  invites: loadJson<Array<Record<string, unknown> & { token: string; teamOrganizationId: string; invitedEmail: string; invitedEmailMasked: string; invitedRoleId: string; invitedRoleLabel: string | null; expiresAt: string; status: string; pinSentAt: string | null; pinLockedAt: string | null }>>('invites.json'),
  classes: loadJson<Array<{ id: string } & Record<string, unknown>>>('classes.json'),
  instructors: loadJson<Array<{ id: string } & Record<string, unknown>>>('instructors.json'),
  rooms: loadJson<Array<{ id: string } & Record<string, unknown>>>('rooms.json'),
  movementVocab: loadJson<Array<{ id: string } & Record<string, unknown>>>('movement-vocab.json'),
  choreographies: loadJson<Array<{ id: string } & Record<string, unknown>>>('choreographies.json'),
  rehearsals: loadJson<Array<{ id: string } & Record<string, unknown>>>('rehearsals.json'),
  videoClips: loadJson<Array<{ id: string; choreographyId: string | null; projectId: string | null; kind: string } & Record<string, unknown>>>('video-clips.json'),
  annotations: loadJson<Array<{ id: string; clipId: string } & Record<string, unknown>>>('annotations.json'),
  plans: loadJson<Array<{ id: string } & Record<string, unknown>>>('plans.json'),
  addons: loadJson<Array<{ slug: string } & Record<string, unknown>>>('addons.json'),
  injuries: loadJson<Array<{ id: string } & Record<string, unknown>>>('injuries.json'),
  subscription: loadJson<Record<string, unknown>>('subscription.json'),
} as const;

export type DanceFixtures = typeof fx;

/** Helper: bygg portrett-URL relativ til e2e-server. */
export function portraitUrl(filename: string): string {
  return `/__fixtures/dance/portraits/${filename}`;
}

/** Default-team som specs bør bruke om de ikke trenger noe spesielt. */
export const DEFAULT_TEAM_ID = 'team-oslo-elite';
