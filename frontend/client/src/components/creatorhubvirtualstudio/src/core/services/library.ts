export type AssetType = 'light' | 'model' | 'prop';
export type LightPreset = {
  brand?: string;
  model?: string;
  modifier?: string; // 'spot','softbox','beauty','bare'
  power?: number; // default power (0..1)
  powerRange?: [number, number];
  cct?: number; // default CCT (K)
  beam?: number; // degrees
  iesId?: string; // optional IES profile id
};

export type LibraryAsset = {
  id: string;
  type: AssetType;
  title: string;
  tags?: string[];
  thumbUrl: string;
  data?: any; // extra metadata (e.g., gltf url)
  preset?: LightPreset | undefined;
};

const BUILTIN: LibraryAsset[] = [
  {
    id: 'light-panel-a',
    type: 'light',
    title: 'LED Panel A',
    tags: ['led','panel'],
    thumbUrl: '/library/light-panel-a.png',
    data: { light: { kind: 'panel' } },
    preset: {
      brand: 'Nanlite',
      model: 'Compac 68',
      modifier: 'panel',
      power: 0.4,
      powerRange: [0.0, 1],
      cct: 5600,
      beam: 110,
    },
  },
  {
    id: 'prop-vflat-a',
    type: 'prop',
    title: 'V-Flat',
    tags: ['reflector','flag'],
    thumbUrl: '/library/prop-vflat-a.png',
  },
  {
    id: 'prop-table-a',
    type: 'prop',
    title: 'Table A',
    tags: ['table','prop'],
    thumbUrl: '/library/prop-table-a.png',
  },
  {
    id: 'light-strobe-a',
    type: 'light',
    title: 'Strobe A',
    tags: ['flash','strobe'],
    thumbUrl: '/library/light-strobe-a.png',
    data: { light: { kind: 'strobe' } },
    preset: {
      brand: 'Godox',
      model: 'AD600Pro',
      modifier: 'softbox',
      power: 0.6,
      powerRange: [0.05, 1],
      cct: 5600,
      beam: 80,
    },
  },
  {
    id: 'light-spot-b',
    type: 'light',
    title: 'Spot B',
    tags: ['spot'],
    thumbUrl: '/library/light-spot-b.png',
    data: { light: { kind: 'spot' } },
    preset: {
      brand: 'Aputure',
      model: '600D + Spotlight',
      modifier: 'spot',
      power: 0.5,
      powerRange: [0.1, 1],
      cct: 3200,
      beam: 20,
      iesId: 'spot-narrow',
    },
  },
  {
    id: 'model-human-a',
    type: 'model',
    title: 'Human Model A',
    tags: ['model','human'],
    thumbUrl: '/library/model-human-a.png',
    data: { height: 1.75 },
  },
  {
    id: 'prop-chair-a',
    type: 'prop',
    title: 'Chair A',
    tags: ['chair','prop'],
    thumbUrl: '/library/prop-chair-a.png',
  },
  {
    id: 'prop-stand-a',
    type: 'prop',
    title: 'Light Stand',
    tags: ['stand','prop'],
    thumbUrl: '/library/prop-stand-a.png',
  },
];

export function listLibraryAssets(type?: AssetType): LibraryAsset[] {
  return type ? BUILTIN.filter((a) => a.type === type) : BUILTIN.slice();
}

export function searchLibraryAssets(type: AssetType, q: string): LibraryAsset[] {
  const s = q.trim().toLowerCase();
  return listLibraryAssets(type).filter(
    (a) =>
      !s ||
      a.id.toLowerCase().includes(s) ||
      a.title.toLowerCase().includes(s) ||
      (a.tags || []).some((t) => t.includes(s)),
  );
}

import { listUserAssets, type UserLibraryAsset } from '@/core/services/userLibrary';

function userToLibrary(u: UserLibraryAsset): LibraryAsset {
  return {
    id: u.id,
    type: u.type,
    title: u.title,
    tags: u.tags,
    thumbUrl: u.thumbDataUrl || '',
    data: u.data || (u.type === 'model' ? { modelUrl: u.modelUrl } : {}),
  };
}

export async function listMergedLibrary(type?: AssetType): Promise<LibraryAsset[]> {
  const users = await listUserAssets();
  const u = users.map(userToLibrary);
  const base = type ? BUILTIN.filter((a) => a.type === type) : BUILTIN;
  return [...base, ...u.filter((a) => !type || a.type === type)];
}

export async function searchMergedLibrary(type: AssetType, q: string): Promise<LibraryAsset[]> {
  const s = q.trim().toLowerCase();
  const all = await listMergedLibrary(type);
  return all.filter(
    (a) =>
      !s ||
      a.id.toLowerCase().includes(s) ||
      a.title.toLowerCase().includes(s) ||
      (a.tags || []).some((t) => t.includes(s)),
  );
}
