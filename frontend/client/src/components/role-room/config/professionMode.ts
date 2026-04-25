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
  | 'dance_freelance';  // dans — frilanser (PR #2)

export const ALL_PROFESSION_MODES: readonly ProfessionMode[] = [
  'production',
  'photographer',
  'content_producer',
  'content_creator',
  'dance_studio',
  'dance_freelance',
] as const;

export const DEFAULT_PROFESSION_MODE: ProfessionMode = 'production';

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
