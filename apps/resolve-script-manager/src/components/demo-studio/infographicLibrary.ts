// infographicLibrary — «Mine infographics»: et GLOBALT bibliotek (på tvers av
// prosjekter) av ferdige infographics brukeren har laget. Lar deg starte fra en
// tidligere infographic i stedet for blank mal — åpne, dupliser og bygg videre.
//
// Lagres separat fra per-prosjekt studio-tilstanden (som auto-lagres i
// InfographicStudioView) så snapshots gjenbrukes overalt.

import { loadSettings } from '../SettingsModal';

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
function writeAll(list: SavedInfographic[]): boolean {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES))); return true; }
  catch { return false; } // full/blokkert (kvote) → signaliser fiasko oppover
}

/** Alle lagrede infographics, nyeste først. */
export function listInfographics(): SavedInfographic[] {
  return readAll().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

type SaveInput = Omit<SavedInfographic, 'id' | 'createdAt' | 'updatedAt'>;

/** Lagre gjeldende studio-tilstand som en ny gjenbrukbar infographic. Returnerer
 *  null hvis localStorage er full/blokkert (kvote) — så kalleren IKKE viser en
 *  falsk «Lagret»-melding når ingenting faktisk ble persistert. */
export function saveInfographic(input: SaveInput): SavedInfographic | null {
  const now = Date.now();
  const entry: SavedInfographic = {
    ...input,
    id: `ig_${now.toString(36)}_${Math.floor((now % 1000) + list_salt()).toString(36)}`,
    createdAt: now,
    updatedAt: now,
  };
  const list = readAll();
  list.unshift(entry);
  return writeAll(list) ? entry : null;
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

// ── Team-delt bibliotek (backend) ──────────────────────────────────────────
// «Del med team» pusher hele snapshotet til backend → synlig for alle innloggede.

/** Lett team-bibliotek-rad — kun det listen/miniatyren trenger. Hele snapshotet
 *  (scener/logo/data) hentes lazy via fetchTeamSnapshot() når brukeren åpner. */
export interface TeamInfographic {
  id: string;
  name: string;
  authorName?: string;
  previewTplId: string;
  accent?: string;
  /** Første scenes verdier — for miniatyren uten å laste hele snapshotet. */
  previewValues?: Record<string, string>;
  sceneCount?: number;
  updatedAt: number;
  /** Delt av meg (kan avdeles). */
  mine?: boolean;
}

function baseUrl(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || 'https://creatorhubn.com/api/post-agent';
  return base.replace(/\/api\/post-agent\/?$/, '');
}
function bearer(): string | null { return loadSettings().RR_BEARER_TOKEN?.trim() || null; }

/** Er team-deling tilgjengelig (innlogget med Role Room-token)? */
export function canShareToTeam(): boolean { return !!bearer(); }

/** Del en infographic med teamet (pusher snapshotet). Returnerer suksess. */
export async function shareToTeam(entry: SavedInfographic): Promise<boolean> {
  const b = bearer();
  if (!b) return false;
  try {
    const res = await fetch(`${baseUrl()}/api/role-room/infographic-library`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${b}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry.id, name: entry.name, previewTplId: entry.previewTplId, snapshot: entry }),
    });
    return res.ok;
  } catch { return false; }
}

/** Hent team-biblioteket (delt av alle) — lette rader, uten snapshot. Tom liste
 *  når offline/ikke innlogget. */
export async function fetchTeamLibrary(): Promise<TeamInfographic[]> {
  const b = bearer();
  if (!b) return [];
  try {
    const res = await fetch(`${baseUrl()}/api/role-room/infographic-library`, { headers: { Authorization: `Bearer ${b}` } });
    if (!res.ok) return [];
    const json = (await res.json()) as { items: Array<{ id: string; name: string; authorName?: string; previewTplId?: string; accent?: string | null; previewValues?: Record<string, string>; sceneCount?: number; mine?: boolean; updatedAt?: number }> };
    return (json.items || []).map((it) => ({
      id: it.id, name: it.name, authorName: it.authorName,
      previewTplId: it.previewTplId || '', accent: it.accent || undefined,
      previewValues: it.previewValues || {}, sceneCount: it.sceneCount || 0,
      mine: it.mine, updatedAt: it.updatedAt || 0,
    }));
  } catch { return []; }
}

/** Hent hele snapshotet for én delt infographic (lazy — kun ved åpning). */
export async function fetchTeamSnapshot(id: string): Promise<SavedInfographic | null> {
  const b = bearer();
  if (!b) return null;
  try {
    const res = await fetch(`${baseUrl()}/api/role-room/infographic-library/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${b}` } });
    if (!res.ok) return null;
    const json = (await res.json()) as { snapshot: SavedInfographic };
    return json.snapshot || null;
  } catch { return null; }
}

/** Avdel egen delt infographic. */
export async function unshareFromTeam(id: string): Promise<boolean> {
  const b = bearer();
  if (!b) return false;
  try {
    const res = await fetch(`${baseUrl()}/api/role-room/infographic-library/${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${b}` },
    });
    return res.ok;
  } catch { return false; }
}
