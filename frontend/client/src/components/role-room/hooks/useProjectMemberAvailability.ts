/**
 * useProjectMemberAvailability — én delt kilde for medlems-tilgjengelighet på
 * tvers av The Role Room (produksjonsteam-modus).
 *
 * Henter medlemmene som deler et prosjekt (medlemskatalogen) + hver deres
 * tilgjengelighet fra deres EGEN kalender (role_room_member_availability), og
 * eksponerer oppslag som enhver crew-flate kan berike med — Crew Management,
 * mobil Team-visning, crew-kalender osv. Slik forblir medlemmets kalender den
 * eneste sannheten, og alle flater synker mot samme data.
 */

import { useEffect, useState } from 'react';

import {
  roleRoomMemberProfileService,
  type MemberListItem,
} from '../services/roleRoomMemberProfileService';
import {
  availabilityEntriesToCrewCells,
  type CrewAvailabilityOverlay,
} from '../utils/crewAvailabilitySync';

export interface ProjectMemberAvailability {
  /** Medlemmer lagt til i prosjektet (deler det via eier/rolle). */
  members: Array<MemberListItem & { email?: string | null }>;
  /** userId → per-dag-celler + ledig-vindu (kun de som har delt kalender). */
  availabilityByUser: Map<string, CrewAvailabilityOverlay>;
  /** email (lowercased) → userId, for å matche manuelle crew-rader. */
  emailToUser: Map<string, string>;
  ready: boolean;
}

const EMPTY: ProjectMemberAvailability = {
  members: [],
  availabilityByUser: new Map(),
  emailToUser: new Map(),
  ready: false,
};

export function useProjectMemberAvailability(projectId?: string | null): ProjectMemberAvailability {
  const [state, setState] = useState<ProjectMemberAvailability>(EMPTY);

  useEffect(() => {
    if (!projectId) { setState(EMPTY); return; }
    let cancelled = false;
    void (async () => {
      try {
        const { members } = await roleRoomMemberProfileService.listMembers({ projectId, limit: 100 });
        if (cancelled) return;
        const emailToUser = new Map<string, string>();
        for (const m of members) {
          const em = (m.email || '').toLowerCase().trim();
          if (em) emailToUser.set(em, m.userId);
        }
        const availabilityByUser = new Map<string, CrewAvailabilityOverlay>();
        await Promise.all(members.map(async (m) => {
          try {
            const entries = await roleRoomMemberProfileService.getMemberAvailability(m.userId);
            if (entries.length) availabilityByUser.set(m.userId, availabilityEntriesToCrewCells(entries));
          } catch { /* privat kalender el. nettfeil — hopp over dette medlemmet */ }
        }));
        if (!cancelled) setState({ members, availabilityByUser, emailToUser, ready: true });
      } catch {
        // Katalogen kan degradere (schema-drift) — la flatene falle tilbake til
        // sine egne data uten å krasje.
        if (!cancelled) setState({ ...EMPTY, ready: true });
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  return state;
}
