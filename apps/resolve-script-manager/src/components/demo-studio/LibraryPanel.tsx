/**
 * LibraryPanel — Bibliotek over alt Marketing mode har generert (infographics,
 * one-pagers, Product Brain-eksport, varianter …). Bla, forhåndsvis, last ned og
 * slett. Lagret lokalt pr. vert, så du slipper å regenerere.
 */
import { useState } from 'react';
import { useDemoStudio } from './demoStudioStore';
import { listAssets, removeAsset, clearAssets, ASSET_KIND_LABELS, type AssetItem, type AssetKind } from './assetLibrary';
import { svgToPngDataUrl } from './demoStudioExports';

const C = {
  bg: '#f3efe9', panel: '#ffffff', cream: '#faf7f2', creamActive: '#f3ece2',
  line: '#ece7df', lineStrong: '#ddd6cc', ink: '#1d1b19', inkSoft: '#6b6358',
  inkFaint: '#9a9186', accent: '#ef8a5d', green: '#4a9d6b',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, sans-serif',
};
const btn: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, background: '#fff', borderRadius: 9, padding: '6px 11px', fontSize: 12, fontWeight: 600, color: C.ink, cursor: 'pointer' };

const FILTERS: Array<{ id: AssetKind | 'all'; label: string }> = [
  { id: 'all', label: 'Alle' },
  { id: 'infographic', label: 'Infographics' },
  { id: 'onepager', label: 'One-pagers' },
  { id: 'brain', label: 'Product Brain' },
  { id: 'guide', label: 'Guider' },
  { id: 'variant', label: 'Varianter' },
];

function download(dataUrl: string, filename: string) {
  const a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.click();
}

export function LibraryPanel() {
  const project = useDemoStudio((s) => s.project);
  const [filter, setFilter] = useState<AssetKind | 'all'>('all');
  const [tick, setTick] = useState(0); // tving re-render etter slett

  const url = project?.url;
  const all = listAssets(url ? { url } : undefined);
  const items = filter === 'all' ? all : all.filter((a) => a.kind === filter);
  void tick;

  const downloadAsset = async (a: AssetItem) => {
    if (a.svg) {
      try { download(await svgToPngDataUrl(a.svg, 1080, 1350, 2), `${a.title}.png`); }
      catch { download(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(a.svg)}`, `${a.title}.svg`); }
    } else if (a.dataUrl) download(a.dataUrl, `${a.title}.png`);
    else if (a.text) {
      const isHtml = a.kind === 'guide' || /^\s*<!doctype|^\s*<html/i.test(a.text);
      const mime = isHtml ? 'text/html' : 'text/plain';
      download(`data:${mime};charset=utf-8,${encodeURIComponent(a.text)}`, `${a.title}.${isHtml ? 'html' : 'txt'}`);
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px', fontFamily: C.font, color: C.ink }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Bibliotek</h2>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 7, background: '#fdeee6', color: C.accent, fontWeight: 600 }}>{all.length} artefakter</span>
        <div style={{ flex: 1 }} />
        {all.length > 0 && url && (
          <button style={{ ...btn, color: '#9a2b2b', borderColor: '#f0b8b8' }}
            onClick={() => { if (window.confirm('Tøm biblioteket for denne siden?')) { clearAssets(url); setTick((t) => t + 1); } }}>Tøm</button>
        )}
      </div>
      <p style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 6, marginBottom: 14 }}>Alt du genererer i Marketing mode samles her — bla, last ned på nytt, slett.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{ ...btn, background: filter === f.id ? C.accent : '#fff', color: filter === f.id ? '#fff' : C.ink, borderColor: filter === f.id ? C.accent : C.lineStrong }}>
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: C.inkSoft, padding: '24px 0' }}>Ingenting her ennå. Generér en infographic, one-pager eller Product Brain i Marketing-fanen — det havner automatisk her.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {items.map((a) => (
            <div key={a.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 150, background: C.cream, display: 'grid', placeItems: 'center', overflow: 'hidden', borderBottom: `1px solid ${C.line}` }}>
                {a.svg ? (
                  <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }} dangerouslySetInnerHTML={{ __html: a.svg }} />
                ) : a.dataUrl ? (
                  <img src={a.dataUrl} alt={a.title} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                ) : (
                  <div style={{ padding: 12, fontSize: 11, color: C.inkSoft, overflow: 'hidden', maxHeight: '100%' }}>{(a.text || '').slice(0, 240)}…</div>
                )}
              </div>
              <div style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', background: C.accent, padding: '1px 6px', borderRadius: 5 }}>{ASSET_KIND_LABELS[a.kind]}</span>
                  <span style={{ fontSize: 10, color: C.inkFaint }}>{a.createdAt.slice(0, 10)}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{a.title}</div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ ...btn, flex: 1, padding: '5px 0', textAlign: 'center' }} onClick={() => void downloadAsset(a)}>Last ned</button>
                  <button style={{ ...btn, padding: '5px 9px', color: '#9a2b2b' }} onClick={() => { removeAsset(a.id); setTick((t) => t + 1); }}>Slett</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LibraryPanel;
