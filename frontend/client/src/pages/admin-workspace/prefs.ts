/**
 * Workspace-preferanser.
 *
 * Skilt ut fra InnstillingerTab.tsx fordi AdminWorkspace trenger å LESE
 * preferansene ved oppstart (default-produkt, om teamchat-kolonnen er
 * åpen, poll-intervall), men ikke skal dra inn hele innstillings-UI-et
 * for å gjøre det. Uten dette skillet ville lazy-lastingen av
 * Innstillinger vært verdiløs — modulen ble lastet uansett.
 *
 * Verdiene speiles i localStorage, slik at første render bruker riktig
 * layout uten å vente på et nettverkskall.
 */

export interface WorkspacePrefs {
  defaultProduct: 'roleroom' | 'leadgrid';
  teamchatOpenByDefault: boolean;
  notificationPollSeconds: number;
}

/** Nøkkelen raden lagres under i admin_workspace_settings. */
export const WORKSPACE_PREFS_KEY = 'workspace_prefs';

/** Nøkkelen det lokale speilet lagres under. */
export const WORKSPACE_PREFS_STORAGE_KEY = 'admin_workspace_prefs';

export const DEFAULT_WORKSPACE_PREFS: WorkspacePrefs = {
  defaultProduct: 'roleroom',
  teamchatOpenByDefault: false,
  notificationPollSeconds: 60,
};

export function normalizeWorkspacePrefs(raw: unknown): WorkspacePrefs {
  const v = (raw ?? {}) as Partial<WorkspacePrefs>;
  const poll = Number(v.notificationPollSeconds);
  return {
    defaultProduct: v.defaultProduct === 'leadgrid' ? 'leadgrid' : 'roleroom',
    teamchatOpenByDefault: v.teamchatOpenByDefault === true,
    notificationPollSeconds:
      Number.isFinite(poll) && poll >= 15 && poll <= 600 ? Math.round(poll) : 60,
  };
}

/** Leser det lokale speilet. Brukes ved oppstart, før API-svaret. */
export function readStoredWorkspacePrefs(): WorkspacePrefs {
  try {
    const raw = localStorage.getItem(WORKSPACE_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_WORKSPACE_PREFS;
    return normalizeWorkspacePrefs(JSON.parse(raw));
  } catch {
    return DEFAULT_WORKSPACE_PREFS;
  }
}

export function writeStoredWorkspacePrefs(prefs: WorkspacePrefs): void {
  try {
    localStorage.setItem(WORKSPACE_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore — kvoten er full eller lagring er blokkert */
  }
}
