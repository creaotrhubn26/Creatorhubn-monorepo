/**
 * crewAvailabilitySync — bro mellom medlemmets egen tilgjengelighets-kalender
 * (`role_room_member_availability`, redigert i profilen) og Crew Management i
 * produksjonsteam-modus.
 *
 * To ansvar:
 *  1) `availabilityEntriesToCrewCells` — konverter medlemmets dato-intervaller
 *     til per-dag `AvailabilityCell[]` som crew-visningen (uke-prikker + kolonne)
 *     allerede forstår, pluss et samlet `available`-vindu for `isAvailableNow`.
 *  2) `professionToCrewRole` / `memberToVirtualCrew` — la brukere som er lagt til
 *     i prosjektet (medlemskatalogen) dukke opp automatisk som crew-rader.
 *
 * Alt er display-avledet: virtuelle rader persisteres ikke før leder eksplisitt
 * redigerer/lagrer dem.
 */

import type { AvailabilityCell, CrewMember, CrewRole } from '../models/casting';
import type {
  AvailabilityEntry,
  CalendarDayStatus,
  MemberListItem,
} from '../services/roleRoomMemberProfileService';

/** Legg til n dager på en YYYY-MM-DD-streng uten TZ-drift (lokal midnatt). */
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Medlems-status → crew-cellestatus (crew bruker 'hold' der medlem sier 'tentative',
// 'unavailable' der medlem sier 'busy'). Farge-semantikken samsvarer:
// available=grønn, hold/tentative=gul, unavailable/busy=rød.
const MEMBER_TO_CREW_STATUS: Record<CalendarDayStatus, AvailabilityCell['availability']> = {
  available: 'available',
  busy: 'unavailable',
  tentative: 'hold',
};

export interface CrewAvailabilityOverlay {
  cells: AvailabilityCell[];
  /** Samlet «ledig fra–til»-vindu (kun available-dager) for isAvailableNow/kolonne. */
  range?: { startDate: string; endDate: string };
}

/**
 * Ekspander medlemmets intervaller til per-dag-celler. Cap-et for å ikke
 * eksplodere på patologisk store datointervaller.
 */
export function availabilityEntriesToCrewCells(
  entries: AvailabilityEntry[],
): CrewAvailabilityOverlay {
  const cells: AvailabilityCell[] = [];
  let minAvail: string | null = null;
  let maxAvail: string | null = null;

  for (const entry of entries) {
    if (!entry?.startDate || !entry?.endDate) continue;
    const crewStatus = MEMBER_TO_CREW_STATUS[entry.status] ?? 'available';
    let cursor = entry.startDate;
    let guard = 0;
    while (cursor <= entry.endDate && guard < 800 && cells.length < 1500) {
      cells.push({ date: cursor, availability: crewStatus, status: crewStatus });
      if (entry.status === 'available') {
        if (!minAvail || cursor < minAvail) minAvail = cursor;
        if (!maxAvail || cursor > maxAvail) maxAvail = cursor;
      }
      cursor = addDays(cursor, 1);
      guard += 1;
    }
  }

  return {
    cells,
    range: minAvail && maxAvail ? { startDate: minAvail, endDate: maxAvail } : undefined,
  };
}

// Fritekst-profesjon (norsk) → nærmeste CrewRole. Første treff vinner.
const ROLE_KEYWORDS: Array<[RegExp, CrewRole]> = [
  [/regi|regiss/i, 'director'],
  [/produsent|produser/i, 'producer'],
  [/casting/i, 'casting_director'],
  [/produksjonsleder|line.?produ/i, 'production_manager'],
  [/produksjonsassist|runner/i, 'production_assistant'],
  [/script|skript/i, 'script_supervisor'],
  [/location|lokasjon/i, 'location_manager'],
  [/kameraassist/i, 'camera_assistant'],
  [/foto(graf)?|kamera|dop|cinemato|filmfoto/i, 'camera_operator'],
  [/drone|luftfoto/i, 'drone_pilot'],
  [/gaffer|lyssett|lysmester/i, 'gaffer'],
  [/\bgrip\b/i, 'grip'],
  [/lyd|sound|audio|mikser/i, 'sound_engineer'],
  [/klipp|edit|redig|post.?prod/i, 'video_editor'],
  [/colorist|fargekorr|grade/i, 'colorist'],
  [/vfx|visuelle effekt/i, 'vfx_artist'],
  [/motion|grafikk|animasjon/i, 'motion_graphics'],
  [/scenograf|production.?design/i, 'production_designer'],
  [/sminke|maske|makeup/i, 'makeup_artist'],
  [/kostyme|garderobe|wardrobe/i, 'wardrobe'],
  [/stylist|styling/i, 'stylist'],
];

export function professionToCrewRole(professions: string[] | undefined | null): CrewRole {
  for (const profession of professions ?? []) {
    for (const [re, role] of ROLE_KEYWORDS) {
      if (re.test(profession)) return role;
    }
  }
  return 'other';
}

/** Stabil, gjenkjennelig id for en auto-avledet (virtuell) crew-rad. */
export function virtualCrewId(userId: string): string {
  return `member:${userId}`;
}

export function isVirtualCrewId(id: string | undefined): boolean {
  return typeof id === 'string' && id.startsWith('member:');
}

/**
 * Bygg en crew-rad fra et katalog-medlem som er lagt til i prosjektet.
 * `email` brukes til dedup mot manuelt opprettede crew-rader.
 */
export function memberToVirtualCrew(
  member: MemberListItem & { email?: string | null },
  overlay?: CrewAvailabilityOverlay,
): CrewMember {
  return {
    id: virtualCrewId(member.userId),
    name: member.displayName || member.email || 'Medlem',
    role: professionToCrewRole(member.professions),
    status: 'confirmed',
    contactInfo: { email: member.email ?? undefined },
    avatarUrl: member.profileImageUrl ?? undefined,
    availability: overlay?.range ? { ...overlay.range } : {},
    availabilityCells: overlay?.cells ?? [],
    assignedScenes: [],
    // Markør: leder ser at raden kom fra «lagt til i prosjekt», og downstream
    // kan velge å ikke tilby destruktive handlinger på ikke-materialiserte rader.
    isAutoFromMember: true,
    memberUserId: member.userId,
  } as CrewMember;
}
