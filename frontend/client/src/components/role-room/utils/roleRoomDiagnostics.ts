type RoleRoomDiagnosticsDetail = Record<string, unknown>;

export interface RoleRoomDiagnosticsEntry {
  id: number;
  event: string;
  detail: RoleRoomDiagnosticsDetail;
  timestamp: string;
  now: number;
}

type RoleRoomDiagnosticsWindow = Window & {
  __roleRoomDiagnostics?: RoleRoomDiagnosticsEntry[];
};

const QUERY_FLAG = 'rrDiagnostics=1';
const STORAGE_KEY = 'role-room-diagnostics';

const isStorageEnabled = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export const isRoleRoomDiagnosticsEnabled = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  if (window.location.search.includes(QUERY_FLAG)) {
    return true;
  }

  if (isStorageEnabled()) {
    return true;
  }

  return Boolean(import.meta.env.DEV);
};

const getDiagnosticsWindow = (): RoleRoomDiagnosticsWindow | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window as RoleRoomDiagnosticsWindow;
};

export const clearRoleRoomDiagnostics = (): void => {
  const diagnosticsWindow = getDiagnosticsWindow();
  if (!diagnosticsWindow) {
    return;
  }
  diagnosticsWindow.__roleRoomDiagnostics = [];
};

export const logRoleRoomDiagnostic = (
  event: string,
  detail: RoleRoomDiagnosticsDetail = {},
): RoleRoomDiagnosticsEntry | null => {
  if (!isRoleRoomDiagnosticsEnabled()) {
    return null;
  }

  const diagnosticsWindow = getDiagnosticsWindow();
  if (!diagnosticsWindow) {
    return null;
  }

  const entries = diagnosticsWindow.__roleRoomDiagnostics ?? [];
  const entry: RoleRoomDiagnosticsEntry = {
    id: entries.length + 1,
    event,
    detail,
    timestamp: new Date().toISOString(),
    now: typeof performance !== 'undefined' ? performance.now() : Date.now(),
  };

  diagnosticsWindow.__roleRoomDiagnostics = [...entries.slice(-199), entry];
  console.info(`[RoleRoomDiag] ${event}`, detail);
  return entry;
};
