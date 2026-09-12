/**
 * ProjectsView — prosjektoversikt (§3 skjerm 1 / IA §2).
 *
 * Rask inngang til å opprette, gjenoppta og administrere materiell: kort med
 * EKTE forhåndsvisning, status (Kladd/Klar/Eksportert), sist endret, og
 * hurtighandlinger (åpne / dupliser / gi nytt navn / arkiver / slett).
 */

import { useEffect, useRef, useState } from 'react';
import { rasterizeMockup } from './mockupRaster';
import {
  listProjects,
  replaceProjectsFromCloud,
  duplicateProject,
  renameProject,
  setProjectStatus,
  deleteProject,
  STATUS_LABELS,
  type MockupDoc,
  type MockupProjectStatus,
} from './mockupStudioModel';
import { syncCloudMockupProjects } from '../../services/cloudMockupProjectsService';

const C = {
  bg: '#0b0d13',
  panel: '#12151f',
  soft: '#171b28',
  border: 'rgba(255,255,255,0.09)',
  ink: '#eef1f8',
  inkSoft: '#9aa0b4',
  accent: '#22d3ee',
  accentInk: '#04121a',
  font: '-apple-system, system-ui, "Segoe UI", sans-serif',
};

const STATUS_COLOR: Record<MockupProjectStatus, string> = {
  draft: '#9aa0b4', ready: '#4ade80', exported: '#22d3ee', archived: '#6b7280',
};

export function ProjectsView({ onClose, onOpen, onNew, onGallery }: { onClose: () => void; onOpen: (doc: MockupDoc) => void; onNew: () => void; onGallery?: () => void }) {
  const [projects, setProjects] = useState<MockupDoc[]>(() => listProjects());
  const [query, setQuery] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [syncing, setSyncing] = useState(false);
  const refresh = () => setProjects(listProjects());

  useEffect(() => {
    let active = true;
    setSyncing(true);
    void syncCloudMockupProjects(listProjects())
      .then((merged) => {
        if (!active) return;
        replaceProjectsFromCloud(merged);
        setProjects(listProjects());
      })
      .finally(() => { if (active) setSyncing(false); });
    return () => { active = false; };
  }, []);

  const visible = projects.filter((p) => (showArchive ? p.status === 'archived' : p.status !== 'archived') && p.name.toLowerCase().includes(query.toLowerCase()));

  const doRename = (id: string) => { if (renameVal.trim()) renameProject(id, renameVal.trim()); setRenaming(null); refresh(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: C.font, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onClose} style={ghost}>← Home</button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Mockup Studio</span>
        {syncing && <span style={{ fontSize: 12, color: C.inkSoft }}>Synkroniserer prosjekter…</span>}
        <div style={{ flex: 1 }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søk i prosjekter…" style={{ ...input, width: 220 }} />
        {onGallery && <button onClick={onGallery} style={ghost}>✦ Design-galleri</button>}
        <button onClick={onNew} style={primary}>+ Nytt materiell</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Prosjekter</h1>
            <p style={{ fontSize: 14, color: C.inkSoft, margin: '4px 0 0' }}>Lag profesjonelt salgsmateriell på minutter.</p>
          </div>
          <div style={{ flex: 1 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.inkSoft, cursor: 'pointer' }}>
            <input type="checkbox" checked={showArchive} onChange={(e) => setShowArchive(e.target.checked)} /> Vis arkiv
          </label>
        </div>

        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.inkSoft }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
              {showArchive ? 'Ingen arkiverte prosjekter' : 'Lag ditt første produktmateriell'}
            </div>
            {!showArchive && (
              <>
                <div style={{ fontSize: 14, marginBottom: 18 }}>Velg en profesjonell mal, legg inn skjermbilder og bruk merkevaren din.</div>
                <button onClick={onNew} style={primary}>Opprett første materiell</button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {visible.map((p) => (
              <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <button onClick={() => onOpen(p)} style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: '#0b0d13', cursor: 'pointer' }} title="Åpne">
                  <div style={{ aspectRatio: '16 / 10' }}><Thumb doc={p} /></div>
                </button>
                <div style={{ padding: '10px 12px' }}>
                  {renaming === p.id ? (
                    <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)} onBlur={() => doRename(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') doRename(p.id); if (e.key === 'Escape') setRenaming(null); }} style={{ ...input, width: '100%', marginBottom: 6 }} />
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: STATUS_COLOR[p.status ?? 'draft'], fontWeight: 600 }}>● {STATUS_LABELS[p.status ?? 'draft']}</span>
                    <span style={{ fontSize: 11, color: C.inkSoft }}>· {p.devices.length} enhet{p.devices.length === 1 ? '' : 'er'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button onClick={() => onOpen(p)} style={mini}>Åpne</button>
                    <button onClick={() => { duplicateProject(p.id); refresh(); }} style={mini}>Dupliser</button>
                    <button onClick={() => { setRenaming(p.id); setRenameVal(p.name); }} style={mini}>Navn</button>
                    {p.status === 'archived'
                      ? <button onClick={() => { setProjectStatus(p.id, 'draft'); refresh(); }} style={mini}>Gjenopprett</button>
                      : <button onClick={() => { setProjectStatus(p.id, 'archived'); refresh(); }} style={mini}>Arkiver</button>}
                    <button onClick={() => { if (!confirm(`Slette «${p.name}»? Dette kan ikke angres.`)) return; deleteProject(p.id); refresh(); }} style={{ ...mini, color: '#f0a0a0' }}>Slett</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Thumb({ doc }: { doc: MockupDoc }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    rasterizeMockup(doc, 240 / 1600).then((off) => {
      if (!alive) return;
      const cv = ref.current;
      if (!cv) return;
      cv.width = off.width; cv.height = off.height;
      cv.getContext('2d')?.drawImage(off, 0, 0);
    }).catch(() => {});
    return () => { alive = false; };
  }, [doc]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

const primary: React.CSSProperties = { background: C.accent, color: C.accentInk, border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: C.font };
const ghost: React.CSSProperties = { background: 'transparent', color: C.inkSoft, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 13px', fontSize: 13, cursor: 'pointer', fontFamily: C.font };
const input: React.CSSProperties = { background: C.soft, color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: C.font, boxSizing: 'border-box' };
const mini: React.CSSProperties = { background: C.soft, color: C.ink, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 9px', fontSize: 12, cursor: 'pointer', fontFamily: C.font };

export default ProjectsView;
