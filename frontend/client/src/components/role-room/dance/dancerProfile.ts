/**
 * Dancer Profile — adapter mellom CrewMember (eksisterende casting-modell)
 * og dans-spesifikke felt.
 *
 * Designprinsipp: KOMPOSISJON, ikke arv. En `DancerProfile` er en
 * `CrewMember` + et valgfritt `dance`-objekt med dans-spesifikke felt.
 * Dette gjør at vi gjenbruker hele crew-/booking-infrastrukturen
 * (CrewManagementPanel, CrewAvailabilityDrawer, CrewCalendarPanel)
 * uten å endre noen eksisterende komponent. Dans-skjermer leser kun
 * `profile.dance` når de trenger dans-spesifikk visning.
 *
 * INGEN eksisterende fil under `production/`, `casting/` eller
 * `models/` blir endret av denne modulen.
 */

import type { CrewMember } from '../models/casting';
import type { Dancer } from './formationTypes';

// ─── Dans-spesifikke felt ────────────────────────────────────────────────

export type DanceStyle =
  | 'contemporary'
  | 'ballet'
  | 'jazz'
  | 'commercial'
  | 'hip-hop'
  | 'folk'
  | 'other';

export type InjuryStatus =
  | 'healthy'
  | 'rehab'
  | 'cleared-with-restriction';

export interface DancerAvailabilityWindow {
  /** ISO datetime — start av tilgjengelighets-vindu. */
  from: string;
  /** ISO datetime — slutt. */
  to: string;
  /** Kort forklaring (f.eks. "Etter kl. 17", "Kun ettermiddag"). */
  note?: string;
}

/**
 * De dans-spesifikke feltene som ligger ut over CrewMember-baseline.
 * Brukes også som `extras`-input til {@link toDancerProfile}.
 */
export interface DancerProfileExtras {
  /** Høyde i cm — viktig for partnering, lifts, formation-symmetri. */
  heightCm?: number;
  /** Hoved-dansestil. */
  dancePrimaryStyle?: DanceStyle;
  /** Korte styrke-tags ("turns", "leaps", "improv", "musicality"). */
  strengths?: string[];
  /** Tilgjengelighets-vinduer (ISO datetime-par). */
  availabilityWindows?: DancerAvailabilityWindow[];
  /** Skadestatus — påvirker hvilke rolle-kategorier vi tilbyr. */
  injuryStatus?: InjuryStatus;
  /** Reel-URLer (Vimeo/YouTube). */
  reelUrls?: string[];
}

/**
 * En `CrewMember` utvidet med dans-spesifikke felt under et `dance`-namespace.
 * Eksisterende crew-komponenter ignorerer `dance`-feltet siden det er
 * ikke-deklarert i CrewMember-typen — TypeScript-utvidelsen er trygg
 * fordi CrewMember har `[key: string]: unknown` i bunnen.
 */
export interface DancerProfile extends CrewMember {
  dance?: DancerProfileExtras;
}

// ─── Konstruksjon ────────────────────────────────────────────────────────

/**
 * Bygg en `DancerProfile` fra en `CrewMember` + valgfrie dans-felt.
 *
 * Ren funksjon, ingen mutasjon av input. Hvis `extras` er undefined eller
 * et tomt objekt, settes `dance`-feltet til undefined (slik at vi ikke
 * lagrer overflødig støy i objektet).
 */
export function toDancerProfile(
  crewMember: CrewMember,
  extras?: Partial<DancerProfileExtras>,
): DancerProfile {
  const hasExtras =
    !!extras &&
    Object.values(extras).some((v) => v !== undefined && v !== null);
  if (!hasExtras) {
    return { ...crewMember };
  }
  return {
    ...crewMember,
    dance: {
      heightCm: extras?.heightCm,
      dancePrimaryStyle: extras?.dancePrimaryStyle,
      strengths: extras?.strengths,
      availabilityWindows: extras?.availabilityWindows,
      injuryStatus: extras?.injuryStatus,
      reelUrls: extras?.reelUrls,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Deriver 2-tegns initialer fra et navn. Faller tilbake til '?' hvis
 * input er tom. Brukes til puck-bakgrunn i FormationView når photoUrl
 * mangler.
 *
 * Eksempler:
 *   "Ingrid Nordahl" → "IN"
 *   "Martin"         → "MA"
 *   ""               → "?"
 */
export function getInitials(name: string): string {
  if (typeof name !== 'string') return '?';
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';

  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);
  if (parts.length === 0) return '?';

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  // Første bokstav i første navn + første bokstav i siste navn.
  const first = parts[0][0] ?? '';
  const last = parts[parts.length - 1][0] ?? '';
  return (first + last).toUpperCase();
}

/**
 * Adapter til Formation View sin `Dancer`-type. Bro mellom
 * crew/booking-infrastrukturen og scenekartet.
 */
export function crewMemberToDancer(
  crewMember: CrewMember,
  extras?: Partial<DancerProfileExtras>,
): Dancer {
  const profile = toDancerProfile(crewMember, extras);
  return {
    id: profile.id,
    name: profile.name,
    initials: getInitials(profile.name),
    role: typeof profile.role === 'string' ? profile.role : undefined,
  };
}
