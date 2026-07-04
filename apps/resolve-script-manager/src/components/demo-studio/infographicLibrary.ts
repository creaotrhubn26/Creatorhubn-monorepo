// infographicLibrary — «Mine infographics»: et GLOBALT bibliotek (på tvers av
// prosjekter) av ferdige infographics brukeren har laget. Lar deg starte fra en
// tidligere infographic i stedet for blank mal — åpne, dupliser og bygg videre.
//
// Lagres separat fra per-prosjekt studio-tilstanden (som auto-lagres i
// InfographicStudioView) så snapshots gjenbrukes overalt.

// Løst typet scene (unngår sirkulær import mot InfographicStudioView.Scene).
export interface SnapshotScene {
  id: string; tplId: string; values: Record<string, string>; atSec: number;
  bindings?: Record<string, string>; posX?: number; posY?: number;
  durSec?: number; accent?: string; logo?: string; exitSec?: number;
}

export interface SavedInfographic {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Kilde-prosjekt (kun for etikett — snapshotet er uavhengig av det). */
  fromProject?: string;
  scenes: SnapshotScene[];
  accent: string;
  logo: string;
  dataText: string;
  palette: string[];
  /** Mal-id for miniatyren (typisk første scene). */
  previewTplId: string;
}

const LIB_KEY = 'trrpa.infographicStudio.library';
const MAX_ENTRIES = 60; // hold localStorage i sjakk (snapshots kan være store)

function readAll(): SavedInfographic[] {
  try {
    const raw = localStorage.getItem(LIB_KEY);
    const arr = raw ? (JSON.parse(raw) as SavedInfographic[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function writeAll(list: SavedInfographic[]): void {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES))); }
  catch { /* full/blokkert — ikke-kritisk */ }
}

/** Alle lagrede infographics, nyeste først. */
export function listInfographics(): SavedInfographic[] {
  return readAll().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

type SaveInput = Omit<SavedInfographic, 'id' | 'createdAt' | 'updatedAt'>;

/** Lagre gjeldende studio-tilstand som en ny gjenbrukbar infographic. */
export function saveInfographic(input: SaveInput): SavedInfographic {
  const now = Date.now();
  const entry: SavedInfographic = {
    ...input,
    id: `ig_${now.toString(36)}_${Math.floor((now % 1000) + list_salt()).toString(36)}`,
    createdAt: now,
    updatedAt: now,
  };
  const list = readAll();
  list.unshift(entry);
  writeAll(list);
  return entry;
}

// Liten salt så to lagringer i samme ms ikke kolliderer (Math.random unngås for
// determinismens skyld i test — bruker lengden på eksisterende liste).
function list_salt(): number { return readAll().length; }

/** Oppdater navn på et snapshot. */
export function renameInfographic(id: string, name: string): void {
  const list = readAll();
  const e = list.find((x) => x.id === id);
  if (e) { e.name = name.trim() || e.name; e.updatedAt = Date.now(); writeAll(list); }
}

/** Slett et snapshot fra biblioteket. */
export function deleteInfographic(id: string): void {
  writeAll(readAll().filter((x) => x.id !== id));
}

/** Overskriv et eksisterende snapshot med ny tilstand (behold id + createdAt). */
export function updateInfographic(id: string, patch: Partial<SaveInput>): void {
  const list = readAll();
  const e = list.find((x) => x.id === id);
  if (e) { Object.assign(e, patch); e.updatedAt = Date.now(); writeAll(list); }
}
