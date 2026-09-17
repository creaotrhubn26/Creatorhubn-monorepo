/**
 * Profession mode — runtime-flagging av hvilken vertikal Role Room kjører i.
 *
 * Dette er ortogonalt til UserRoleType (modellen i `models/casting.ts`).
 * UserRoleType beskriver hva en bruker er TILLATT å gjøre i et prosjekt
 * (rolle/permission). ProfessionMode beskriver hvilket DOMENE prosjektet
 * tilhører (film/foto-produksjon vs. dans-studio vs. dans-frilans).
 *
 * Eksisterende moder ('production' = film/video, 'photographer', 'content_producer'
 * etc.) er beholdt eksakt slik de var. Dans-modene er nye og opt-in via
 * `?mode=dance_studio` / `?mode=dance_freelance` query-param eller via prosjektets
 * eget profession-felt (når DB-modellen utvides senere).
 *
 * VIKTIG: ingen eksisterende komponent leser fra denne filen ennå.
 * Den introduseres som grunnmur for PR #2 — ?mode=-flagget — og PR #3
 * (DanceDashboard). Eksisterende film/foto-flyt er upåvirket.
 */

export type ProfessionMode =
  | 'production'        // default: film/video-produksjon (dagens flyt)
  | 'photographer'      // foto-prosjekt
  | 'content_producer'  // innholdsprodusent
  | 'content_creator'   // innholdsskaper
  | 'dance_studio'      // dans — studioeier (PR #2)
  | 'dance_freelance'   // dans — frilanser (PR #2)
  | 'education'         // utdanningsinstitusjon — kull, studentproduksjoner, faglærer-oversikt
  | 'student';          // student ved utdanningsinstitusjon — «Min side» (foreløpig super-admin-preview)

export const ALL_PROFESSION_MODES: readonly ProfessionMode[] = [
  'production',
  'photographer',
  'content_producer',
  'content_creator',
  'dance_studio',
  'dance_freelance',
  'education',
  'student',
] as const;

export const DEFAULT_PROFESSION_MODE: ProfessionMode = 'production';

/**
 * Navn og beskrivelse per modus, og om brukeren selv kan bytte til den.
 *
 * Modusvelgeren bygget tidligere sin egen liste. Den hadde fire av åtte
 * modus, og én oppføring — «Casting-modus» — som ikke var en ProfessionMode i
 * det hele tatt: å velge den satte en verdi isValidProfessionMode forkaster,
 * så brukeren havnet stille tilbake i produksjonsmodus. Listen bor her nå, ved
 * siden av typen den beskriver, så de to ikke kan gli fra hverandre igjen.
 */
export const PROFESSION_MODE_META: Record<ProfessionMode, {
  label: string;
  description: string;
  /** Vises i «bytt modus». Falsk for modus som ennå ikke er en ferdig flate. */
  switchable: boolean;
}> = {
  production: {
    label: 'Produksjons-modus',
    description: 'Produksjon — prosjekter, team og leveranser.',
    switchable: true,
  },
  photographer: {
    label: 'Foto-modus',
    description: 'Fotoprosjekt — oppdrag, lokasjoner og leveranser.',
    switchable: true,
  },
  content_producer: {
    label: 'Innholdsprodusent-modus',
    description: 'Innholdsproduksjon — kunder, plan og publisering.',
    switchable: true,
  },
  content_creator: {
    label: 'Innholdsskaper-modus',
    description: 'Innholdsskaper — egne kanaler, ideer og kalender.',
    switchable: true,
  },
  dance_studio: {
    label: 'Studio-modus',
    description: 'Dansestudio — klasser, instruktører, rom og påmelding.',
    switchable: true,
  },
  dance_freelance: {
    label: 'Frilans-modus',
    description: 'Frilans-danser — koreografi, performances, faktura.',
    switchable: true,
  },
  education: {
    label: 'Utdannings-modus',
    description: 'Utdanningsinstitusjon — studenter, kurs og portfolio.',
    switchable: true,
  },
  student: {
    // «Min side» er foreløpig super-admin-preview (se isStudentMode). Å tilby
    // den i menyen ville sendt vanlige brukere inn i en flate som ikke er
    // ferdig — heller ingen oppføring enn en som skuffer.
    label: 'Student-modus',
    description: 'Student — min side, kurs og innleveringer.',
    switchable: false,
  },
};


const QUERY_PARAM_KEY = 'mode';
const STORAGE_KEY = 'role_room_profession_mode';

/**
 * Type guard — godtar kun strenger som matcher en kjent mode.
 * Brukes for å parse usikker input (URL-param, localStorage, brukerinput).
 */
export function isProfessionMode(value: unknown): value is ProfessionMode {
  return (
    typeof value === 'string' &&
    (ALL_PROFESSION_MODES as readonly string[]).includes(value)
  );
}

/**
 * Aliaser så vi kan oversette mer naturlige URL-verdier (?mode=dance) til
 * en konkret arketype. ?mode=dance gir studio-mode som default fordi det
 * er den arketypen som har mest UI-overflate ferdigbygget.
 */
const URL_ALIASES: Record<string, ProfessionMode> = {
  dance: 'dance_studio',
  studio: 'dance_studio',
  freelance: 'dance_freelance',
  film: 'production',
  video: 'production',
  foto: 'photographer',
  utdanning: 'education',
  utdanningsinstitusjon: 'education',
  education: 'education',
  skole: 'education',
  student: 'student',
  elev: 'student',
};

/**
 * Hovedoppslag: les profession-mode fra URL (hvis ?mode=… er satt) eller
 * localStorage (hvis tidligere persistert), ellers default. Tom streng/
 * ukjent verdi behandles som default.
 *
 * Trygt å kalle på SSR — feiler stille når window er undefined.
 */
export function getActiveProfessionMode(): ProfessionMode {
  if (typeof window === 'undefined') return DEFAULT_PROFESSION_MODE;

  // 1. URL query-param har høyest prioritet — gjør det enkelt å demo
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(QUERY_PARAM_KEY);
    if (raw) {
      const aliased = URL_ALIASES[raw.toLowerCase()];
      if (aliased) return aliased;
      if (isProfessionMode(raw)) return raw;
    }
  } catch {
    /* ignore — bare fall through til localStorage / default */
  }

  // 2. localStorage — settes første gang en bruker velger mode i UI
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isProfessionMode(stored)) return stored;
  } catch {
    /* ignore */
  }

  return DEFAULT_PROFESSION_MODE;
}

/**
 * Skriv mode til localStorage. Brukes av onboarding eller mode-switcher
 * når bruker eksplisitt velger sin profession.
 */
export function setActiveProfessionMode(mode: ProfessionMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Convenience-helpers — gjør komponent-kode mer lesbar.
 * `isDanceMode(mode)` returnerer true både for studio og frilans.
 */
export const isDanceMode = (mode: ProfessionMode): boolean =>
  mode === 'dance_studio' || mode === 'dance_freelance';

export const isProductionMode = (mode: ProfessionMode): boolean =>
  mode === 'production' || mode === 'photographer' ||
  mode === 'content_producer' || mode === 'content_creator';

/** Utdanningsinstitusjon-modus — egen parallell workspace (EducationWorkspace). */
export const isEducationMode = (mode: ProfessionMode): boolean =>
  mode === 'education';

/** Student-modus — «Min side» (StudentWorkspace), foreløpig super-admin-preview. */
export const isStudentMode = (mode: ProfessionMode): boolean =>
  mode === 'student';

/**
 * Bro fra bruker-profesjon/rolle (server-side `users.profession` / onboarding-
 * `selectedProfession`) → ProfessionMode. Dette er «profession-feltet» som
 * kommentaren over `getActiveProfessionMode` forutsa: en provisjonert
 * utdanningsinstitusjon (profession='education') skal lande i utdannings-
 * workspacet uten å måtte velge modus manuelt.
 *
 * FORELØPIG KUN education-signaler → 'education'. Andre profesjoner returnerer
 * null (uendret oppførsel) — bevisst, så broen ikke endrer modus for
 * eksisterende produksjons-/foto-brukere. Kan utvides senere.
 */
const PROFESSION_ROLE_TO_MODE: Record<string, ProfessionMode> = {
  education: 'education',
  education_institution: 'education',
  educational_institution: 'education',
  utdanning: 'education',
  utdanningsinstitusjon: 'education',
  skole: 'education',
};

export function professionRoleToMode(role: string | null | undefined): ProfessionMode | null {
  if (typeof role !== 'string' || !role.trim()) return null;
  return PROFESSION_ROLE_TO_MODE[role.trim().toLowerCase()] ?? null;
}

/** Har brukeren allerede et lagret (eksplisitt/broet) modus-valg? Brukes til å
 *  hoppe over profesjons-oppslaget på boot når modus alt er avgjort. */
export function hasStoredProfessionMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return isProfessionMode(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

/**
 * Aktiver modus fra bruker-profesjon — men KUN hvis brukeren ikke allerede har
 * et eksplisitt modus-valg (localStorage). Et eksplisitt valg (mode-switcher)
 * vinner alltid. Returnerer true hvis modus ble satt.
 */
export function applyProfessionModeFromRole(role: string | null | undefined): boolean {
  if (typeof window === 'undefined') return false;
  const mode = professionRoleToMode(role);
  if (!mode) return false;
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return false; // eksplisitt valg vinner
  } catch {
    return false;
  }
  setActiveProfessionMode(mode);
  return true;
}
