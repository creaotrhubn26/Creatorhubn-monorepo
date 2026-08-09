/**
 * MockupLibraryPanel — prosjekt-bibliotek (media pool) for Mockup Studio.
 *
 * Mål: slå Resolve media pool + Premiere prosjekt-panel kombinert, tilpasset mockups.
 * - Import av filer ELLER hel mappe (webkitdirectory) → mappestruktur bevares automatisk
 * - Bins/mappe-tre-filter, søk, sortering, grid/liste-visning, hover-preview
 * - Klikk = plasser på valgt enhet (ellers bakgrunn), multi-select + bulk slett/flytt
 * - IndexedDB-backet (skalerer til mange store bilder), persisterer på tvers av økter
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useMockupStudio } from './mockupStudioStore';
import { type LibraryMeta } from './mockupLibraryDb';
import { ingestImage } from './mockupLibraryIngest';
import { PRESENTATIONS } from './mockupStudioModel';

const C = { ink: '#eef1f8', inkSoft: '#9aa0b4', border: 'rgba(255,255,255,0.1)', panel: '#171b28', accent: '#22d3ee' };
const btn: CSSProperties = { background: 'rgba(255,255,255,0.06)', color: '#c7cdd8', border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 'clamp(11px,0.8vw,13px)', cursor: 'pointer', fontWeight: 600 };
const chip: CSSProperties = { ...btn, padding: '3px 8px', fontSize: 'clamp(10px,0.72vw,12px)' };

const dirOf = (rel: string): string => { const p = (rel || '').split('/'); p.pop(); return p.join('/') || '/'; };

function readDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
}

type SortKey = 'ny' | 'navn' | 'storrelse' | 'dim';

export function MockupLibraryPanel() {
  const library = useMockupStudio((s) => s.library);
  const loadLibrary = useMockupStudio((s) => s.loadLibrary);
  const addLibraryMeta = useMockupStudio((s) => s.addLibraryMeta);
  const removeLibraryAssets = useMockupStudio((s) => s.removeLibraryAssets);
  const patchLibraryMeta = useMockupStudio((s) => s.patchLibraryMeta);
  const placeLibraryImage = useMockupStudio((s) => s.placeLibraryImage);
  const arrangeLibrary = useMockupStudio((s) => s.arrangeLibrary);
  const canvas = useMockupStudio((s) => s.doc.canvas);
  const selection = useMockupStudio((s) => s.selection);
  const [hoverPreset, setHoverPreset] = useState<string | null>(null);

  const [folder, setFolder] = useState<string | null>(null); // null = alle
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('ny');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<LibraryMeta | null>(null);
  const [busy, setBusy] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void loadLibrary(); }, [loadLibrary]);

  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of library) counts.set(m.folder, (counts.get(m.folder) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [library]);

  const shown = useMemo(() => {
    let xs = library;
    if (folder) xs = xs.filter((m) => m.folder === folder || m.folder.startsWith(folder + '/'));
    if (q.trim()) { const s = q.toLowerCase(); xs = xs.filter((m) => m.name.toLowerCase().includes(s) || m.folder.toLowerCase().includes(s)); }
    const by: Record<SortKey, (a: LibraryMeta, b: LibraryMeta) => number> = {
      ny: (a, b) => b.addedAt - a.addedAt,
      navn: (a, b) => a.name.localeCompare(b.name),
      storrelse: (a, b) => b.size - a.size,
      dim: (a, b) => b.w * b.h - a.w * a.h,
    };
    return [...xs].sort(by[sort]);
  }, [library, folder, q, sort]);

  const ingest = async (files: FileList | null, useRelPath: boolean) => {
    if (!files || !files.length) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setBusy(imgs.length);
    for (const f of imgs) {
      try {
        const full = await readDataUrl(f);
        const rel = useRelPath ? ((f as File & { webkitRelativePath?: string }).webkitRelativePath || '') : '';
        const meta = await ingestImage(f.name, full, useRelPath ? dirOf(rel) : '/', 'import');
        addLibraryMeta(meta);
      } catch (e) { console.error('[mockup-studio] import', f.name, e); }
      setBusy((n) => n - 1);
    }
    setBusy(0);
  };

  const toggleSel = (id: string, e: React.MouseEvent) => {
    setSel((prev) => { const n = new Set(prev); if (e.shiftKey || e.metaKey || e.ctrlKey) { n.has(id) ? n.delete(id) : n.add(id); } else { n.clear(); n.add(id); } return n; });
  };
  const bulkDelete = () => { if (sel.size && confirm(`Slett ${sel.size} bilde(r) fra biblioteket? Kan ikke angres.`)) { void removeLibraryAssets([...sel]); setSel(new Set()); } };
  const bulkMove = () => { if (!sel.size) return; const to = prompt('Flytt til mappe (f.eks. meny/pizza):', folder ?? ''); if (to == null) return; for (const id of sel) void patchLibraryMeta(id, { folder: to.trim() || '/' }); setSel(new Set()); };

  const place = (m: LibraryMeta) => void placeLibraryImage(m.id);

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Import + verktøy */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button style={btn} onClick={() => fileRef.current?.click()} title="Importer bildefiler">+ Filer</button>
        <button style={btn} onClick={() => dirRef.current?.click()} title="Importer hel mappe — mappestruktur bevares">+ Mappe</button>
        <button style={{ ...btn, marginLeft: 'auto' }} onClick={() => setView((v) => (v === 'grid' ? 'list' : 'grid'))} title="Bytt visning">{view === 'grid' ? '≣ Liste' : '▦ Grid'}</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { void ingest(e.target.files, false); e.target.value = ''; }} />
      {/* @ts-expect-error webkitdirectory er ikke i React-typene, men støttes i WKWebView/Chromium */}
      <input ref={dirRef} type="file" webkitdirectory="" directory="" multiple style={{ display: 'none' }} onChange={(e) => { void ingest(e.target.files, true); e.target.value = ''; }} />

      <div style={{ display: 'flex', gap: 6 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk…" style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: C.ink, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 'clamp(11px,0.8vw,13px)' }} />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ ...btn, cursor: 'pointer' }} title="Sortering">
          <option value="ny">Nyeste</option><option value="navn">Navn</option><option value="storrelse">Størrelse</option><option value="dim">Oppløsning</option>
        </select>
      </div>

      {/* Mappe-tre (bins) */}
      {folders.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button style={{ ...chip, background: folder === null ? C.accent : 'rgba(255,255,255,0.06)', color: folder === null ? '#04121a' : '#c7cdd8' }} onClick={() => setFolder(null)}>Alle ({library.length})</button>
          {folders.map(([f, n]) => (
            <button key={f} title={f} style={{ ...chip, background: folder === f ? C.accent : 'rgba(255,255,255,0.06)', color: folder === f ? '#04121a' : '#c7cdd8', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => setFolder(f)}>{f === '/' ? 'rot' : f} ({n})</button>
          ))}
        </div>
      )}

      {/* Bulk-handlinger */}
      {sel.size > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 'clamp(10px,0.72vw,12px)', color: C.inkSoft }}>
          <span>{sel.size} valgt</span>
          <button style={chip} onClick={bulkMove}>Flytt…</button>
          <button style={{ ...chip, color: '#f0a0a0' }} onClick={bulkDelete}>Slett</button>
          <button style={chip} onClick={() => setSel(new Set())}>Fjern valg</button>
        </div>
      )}

      {/* Galleri-fremvisninger: legg valgte bilder på lerretet i ulike arrangement (hover = forhåndsvis) */}
      {sel.size > 0 && (
        <div style={{ position: 'relative', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }} onMouseLeave={() => setHoverPreset(null)}>
          <span style={{ fontSize: 'clamp(10px,0.72vw,12px)', opacity: 0.6 }}>Legg som:</span>
          {PRESENTATIONS.map((pr) => (
            <button key={pr.id} style={chip} title={`Legg ${sel.size} bilde(r) på lerretet som ${pr.label.toLowerCase()}`}
              onMouseEnter={() => setHoverPreset(pr.id)}
              onClick={() => { void arrangeLibrary([...sel].map((id) => ({ assetId: id })), pr.id); }}>{pr.label}</button>
          ))}
          {hoverPreset && (() => {
            const pr = PRESENTATIONS.find((x) => x.id === hoverPreset)!;
            const metas = [...sel].map((id) => library.find((m) => m.id === id)).filter(Boolean) as LibraryMeta[];
            const BW = 210, scale = BW / canvas.w, BH = Math.round(canvas.h * scale);
            const cells = pr.layout(metas.length, canvas.w, canvas.h);
            return (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, width: BW, height: BH, zIndex: 50, background: '#0b0d13', border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 12px 40px rgba(0,0,0,0.6)', overflow: 'hidden', pointerEvents: 'none' }}>
                {cells.map((c, i) => {
                  const m = metas[i % Math.max(1, metas.length)];
                  return <img key={i} src={m?.thumb} alt="" style={{ position: 'absolute', left: c.x * scale, top: c.y * scale, width: c.w * scale, height: c.h * scale, objectFit: 'cover', borderRadius: 2, transform: c.rotation ? `rotate(${c.rotation}deg)` : undefined, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />;
                })}
                <span style={{ position: 'absolute', bottom: 2, right: 4, fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>{pr.label}</span>
              </div>
            );
          })()}
        </div>
      )}

      {busy > 0 && <div style={{ fontSize: 11, color: C.accent }}>Importerer… ({busy} igjen)</div>}
      {library.length === 0 && busy === 0 && <div style={{ fontSize: 'clamp(11px,0.8vw,13px)', color: C.inkSoft, lineHeight: 1.5 }}>Tomt bibliotek. «+ Mappe» importerer en hel mappe (f.eks. dine 44 Holy Crust-bilder) med mappestruktur intakt. Klikk et bilde for å legge det på valgt enhet (ellers bakgrunn).</div>}

      {/* Grid / liste */}
      {view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 6 }}>
          {shown.map((m) => (
            <button key={m.id} draggable onDragStart={(e) => e.dataTransfer.setData('application/x-mockup-lib', m.id)} onClick={(e) => { const multi = e.shiftKey || e.metaKey || e.ctrlKey; toggleSel(m.id, e); if (!multi) place(m); }} onMouseEnter={() => setHover(m)} onMouseLeave={() => setHover((h) => (h?.id === m.id ? null : h))}
              title={`${m.name} · ${m.w}×${m.h} · ${m.folder} — klikk = plasser · Shift/Cmd-klikk = velg (for galleri)`}
              style={{ position: 'relative', padding: 0, border: sel.has(m.id) ? `2px solid ${C.accent}` : `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', cursor: 'grab', background: C.panel, aspectRatio: '1 / 1' }}>
              <img src={m.thumb} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {shown.map((m) => (
            <button key={m.id} draggable onDragStart={(e) => e.dataTransfer.setData('application/x-mockup-lib', m.id)} onClick={(e) => { const multi = e.shiftKey || e.metaKey || e.ctrlKey; toggleSel(m.id, e); if (!multi) place(m); }} onMouseEnter={() => setHover(m)} onMouseLeave={() => setHover((h) => (h?.id === m.id ? null : h))}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 4, border: sel.has(m.id) ? `1px solid ${C.accent}` : `1px solid transparent`, borderRadius: 6, background: 'rgba(255,255,255,0.03)', cursor: 'grab', textAlign: 'left' }}>
              <img src={m.thumb} alt={m.name} style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'clamp(11px,0.8vw,13px)', color: C.ink }}>{m.name}</span>
              <span style={{ fontSize: 'clamp(9px,0.64vw,11px)', color: C.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{m.w}×{m.h}</span>
            </button>
          ))}
        </div>
      )}

      {/* Hover-preview (større) */}
      {hover && (
        <div style={{ position: 'absolute', top: 0, right: '100%', marginRight: 8, width: 220, zIndex: 40, pointerEvents: 'none', background: '#0b0d13', border: `1px solid ${C.border}`, borderRadius: 8, padding: 6, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
          <img src={hover.thumb} alt="" style={{ width: '100%', borderRadius: 4, display: 'block' }} />
          <div style={{ fontSize: 11, color: C.ink, marginTop: 4, fontWeight: 600 }}>{hover.name}</div>
          <div style={{ fontSize: 10, color: C.inkSoft }}>{hover.w}×{hover.h} · {(hover.size / 1024 / 1024).toFixed(1)}MB · {hover.folder}</div>
        </div>
      )}

      <div style={{ fontSize: 'clamp(9px,0.64vw,11px)', color: 'rgba(255,255,255,0.4)' }}>
        Klikk = plasser på {selection.kind === 'device' ? 'valgt enhet' : 'lerretet (fritt bilde)'} · Shift/Cmd-klikk = multi-select
      </div>
    </div>
  );
}
