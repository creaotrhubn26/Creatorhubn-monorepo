/**
 * roleRoomMaterialsApi — typet klient for merkevare-/material-deling mellom
 * klient og produsent (role_room_client_materials). Brukes av merkevare-fanen
 * i klient-workspace + «Mottatt fra klient»-panelet i produsentens prosjektrom.
 *
 * Opplasting bruker XMLHttpRequest for ekte fremdrift (fetch gir ikke
 * upload-progress). Nedlasting går via fetch+blob siden fil-ruten er
 * header-autentisert (kan ikke bare lenkes til).
 */
import authSessionService from './authSessionService';

export type MaterialCategory =
  | 'brand_logo'
  | 'brand_colors'
  | 'brand_fonts'
  | 'reference'
  | 'other';

export interface MaterialCategoryDef {
  key: MaterialCategory;
  label: string;
  /** Kort hjelpetekst i opplastingssonen. */
  hint: string;
  /** Filtyper som vises som chips. */
  accepts: string[];
}

export const MATERIAL_CATEGORIES: MaterialCategoryDef[] = [
  { key: 'brand_logo', label: 'Logo', hint: 'Helst SVG eller PNG med transparent bakgrunn.', accepts: ['SVG', 'PNG', 'AI/EPS', 'PDF'] },
  { key: 'brand_colors', label: 'Farger / profil', hint: 'Fargepalett, profilmanual eller merkevareprofil.', accepts: ['PDF', 'ASE', 'PNG'] },
  { key: 'brand_fonts', label: 'Fonter', hint: 'Skrifttyper som ZIP, OTF eller TTF.', accepts: ['ZIP', 'OTF', 'TTF'] },
  { key: 'reference', label: 'Referanser', hint: 'Inspirasjon, stemningsbilder og eksempler.', accepts: ['JPG', 'PNG', 'PDF', 'MP4'] },
  { key: 'other', label: 'Annet', hint: 'Alt annet materiell produksjonsteamet trenger.', accepts: ['Alle filtyper'] },
];

export type MaterialStatus = 'provided' | 'in_review' | 'approved' | 'outdated';

export interface RoleRoomMaterial {
  id: string;
  projectId: string;
  entryType: string;
  title: string;
  description: string | null;
  status: MaterialStatus | string;
  createdByRole: string | null;
  uploadedByClient: boolean;
  originalName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): RoleRoomMaterial {
  const meta = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>;
  const file = (meta.file && typeof meta.file === 'object' ? meta.file : {}) as Record<string, unknown>;
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? ''),
    entryType: String(row.entry_type ?? 'other'),
    title: String(row.title ?? ''),
    description: str(row.description),
    status: (str(row.status) as MaterialStatus | null) ?? 'provided',
    createdByRole: str(row.created_by_role),
    uploadedByClient: meta.uploadedByClient === true,
    originalName: str(file.originalName),
    mimeType: str(file.mimeType),
    fileSize: num(file.fileSize),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

const base = (projectId: string) =>
  `/api/role-room/projects/${encodeURIComponent(projectId)}/producer/client-materials`;

export async function listMaterials(projectId: string): Promise<RoleRoomMaterial[]> {
  const res = await fetch(base(projectId), { headers: authSessionService.getAuthHeadersSync() });
  if (!res.ok) throw new Error(`Kunne ikke hente materiale (HTTP ${res.status})`);
  const payload = (await res.json().catch(() => null)) as { items?: Record<string, unknown>[] } | null;
  return Array.isArray(payload?.items) ? payload!.items.map(mapRow) : [];
}

/** Opplasting med fremdrift. onProgress(0–100). */
export function uploadMaterialFile(
  projectId: string,
  file: File,
  entryType: MaterialCategory,
  opts: { title?: string; onProgress?: (pct: number) => void } = {},
): Promise<RoleRoomMaterial> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('entryType', entryType);
    if (opts.title) form.append('title', opts.title);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base(projectId)}/upload`);
    const headers = authSessionService.getAuthHeadersSync();
    Object.entries(headers).forEach(([k, v]) => {
      // La nettleseren sette Content-Type (med multipart-boundary) selv.
      if (k.toLowerCase() !== 'content-type') xhr.setRequestHeader(k, v);
    });
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) opts.onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText) as { item?: Record<string, unknown> };
          if (json.item) { resolve(mapRow(json.item)); return; }
        } catch { /* faller gjennom */ }
        reject(new Error('Uventet svar fra serveren'));
      } else {
        let msg = `Opplasting feilet (HTTP ${xhr.status})`;
        try { const j = JSON.parse(xhr.responseText); if (j?.error) msg = j.error; } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Nettverksfeil under opplasting'));
    xhr.send(form);
  });
}

/** «Bruk i prosjekt» / godkjenn — setter status. */
export async function setMaterialStatus(
  projectId: string,
  id: string,
  status: MaterialStatus,
): Promise<void> {
  const res = await fetch(`${base(projectId)}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...authSessionService.getAuthHeadersSync(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Kunne ikke oppdatere materiale (HTTP ${res.status})`);
}

/** Last ned fil (header-autentisert → blob → trigger nedlasting). */
export async function downloadMaterialFile(material: RoleRoomMaterial): Promise<void> {
  const url = `${base(material.projectId)}/${encodeURIComponent(material.id)}/file`;
  const res = await fetch(url, { headers: authSessionService.getAuthHeadersSync() });
  if (!res.ok) throw new Error(`Kunne ikke laste ned (HTTP ${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = material.originalName ?? material.title;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
