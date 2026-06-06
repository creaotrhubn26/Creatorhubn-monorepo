/**
 * assetLibrary — et felles BIBLIOTEK for alt Marketing mode genererer
 * (infographics, one-pagers, Product Brain-eksport, varianter …), så du slipper
 * å regenerere. Lagres i localStorage; små tekst/SVG-artefakter holdes inline,
 * store filer (video) refereres via sti. Nøklet pr. vert så det er prosjekt-nært.
 */

export type AssetKind = 'infographic' | 'onepager' | 'brain' | 'variant' | 'thumbnail' | 'other';

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  infographic: 'Infographic',
  onepager: 'One-pager',
  brain: 'Product Brain',
  variant: 'Variant',
  thumbnail: 'Thumbnail',
  other: 'Annet',
};

export interface AssetItem {
  id: string;
  kind: AssetKind;
  title: string;
  createdAt: string;
  host?: string;
  /** Inline SVG-markup (infographic). */
  svg?: string;
  /** Inline data-URL (PNG/JPEG-thumbnail). */
  dataUrl?: string;
  /** Inline tekst/HTML (one-pager/brain). */
  text?: string;
  /** Sti til en stor fil (video) i stedet for inline. */
  path?: string;
  /** Fritekst-metadata (f.eks. kanal, metode). */
  note?: string;
}

const KEY = 'trrpa.demoStudio.assets';
const CAP = 80;

function hostOf(url?: string): string | undefined {
  if (!url) return undefined;
  try { return new URL(url).host; } catch { return url.slice(0, 60); }
}

function load(): AssetItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as AssetItem[]; } catch { return []; }
}
function save(items: AssetItem[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, CAP))); }
  catch { /* localStorage full — behold det vi kan */ }
}

let _seq = 0;
function newId(): string {
  // Unik nok for klient-lokalt bibliotek (app-kode; ingen krav om kryptografi).
  _seq += 1;
  return `a_${Date.now().toString(36)}_${_seq}`;
}

/** Legg en artefakt i biblioteket (nyeste først). */
export function addAsset(a: Omit<AssetItem, 'id' | 'createdAt'> & { url?: string }): AssetItem {
  const item: AssetItem = {
    id: newId(),
    kind: a.kind,
    title: a.title,
    createdAt: new Date().toISOString(),
    host: a.host ?? hostOf(a.url),
    svg: a.svg,
    dataUrl: a.dataUrl,
    text: a.text,
    path: a.path,
    note: a.note,
  };
  const items = load();
  save([item, ...items]);
  return item;
}

/** List artefakter, evt. filtrert på vert og/eller type. */
export function listAssets(opts?: { url?: string; kind?: AssetKind }): AssetItem[] {
  const h = hostOf(opts?.url);
  return load().filter((a) => (!h || a.host === h) && (!opts?.kind || a.kind === opts.kind));
}

export function removeAsset(id: string): void {
  save(load().filter((a) => a.id !== id));
}
export function clearAssets(url?: string): void {
  if (!url) { save([]); return; }
  const h = hostOf(url);
  save(load().filter((a) => a.host !== h));
}
export function assetCount(url?: string): number {
  return listAssets(url ? { url } : undefined).length;
}
