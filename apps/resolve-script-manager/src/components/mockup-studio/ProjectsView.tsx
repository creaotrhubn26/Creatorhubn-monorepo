import { useEffect, useMemo, useRef, useState } from 'react';
import { rasterizeMockup } from './mockupRaster';
import {
  listProjects, duplicateProject, renameProject, setProjectStatus, deleteProject,
  STATUS_LABELS, type MockupDoc, type MockupProjectStatus,
} from './mockupStudioModel';
import {
  loadCachedMockupProjects, MOCKUP_PROJECTS_CHANGED_EVENT, syncMockupProjectsFromCloud,
} from './mockupProjectRepository';

const C = {
  bg: '#0b0d13', panel: '#12151f', soft: '#171b28', border: 'rgba(255,255,255,0.09)',
  ink: '#eef1f8', inkSoft: '#9aa0b4', accent: '#22d3ee', accentInk: '#04121a',
  font: '-apple-system, system-ui, "Segoe UI", sans-serif',
};
const STATUS_COLOR: Record<MockupProjectStatus, string> = {
  draft: '#9aa0b4', review: '#fbbf24', approved: '#34d399', ready: '#4ade80',
  exported: '#22d3ee', archived: '#6b7280',
};
function mergeProjects(...sets: MockupDoc[][]): MockupDoc[] {
  const values = new Map<string, MockupDoc>();
  for (const set of sets) for (const doc of set) {
    const current = values.get(doc.id);
    if (!current || doc.updatedAt >= current.updatedAt) values.set(doc.id, doc);
  }
  return [...values.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
function localAssetCount(doc: MockupDoc): number {
  const sources = [
    ...doc.devices.map((item) => item.image),
    ...(doc.images ?? []).map((item) => item.image),
    doc.canvas.logo?.image,
  ].filter((value): value is string => Boolean(value));
  return sources.filter((value) => !/^(?:data:|https?:|mockup-cloud-file:)/i.test(value) && !value.startsWith('/assets/')).length;
}

export function ProjectsView({ onClose, onOpen, onNew, onGallery }: {
  onClose: () => void; onOpen: (doc: MockupDoc) => void; onNew: () => void; onGallery?: () => void;
}) {
  const [projects, setProjects] = useState<MockupDoc[]>(() => listProjects());
  const [query, setQuery] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [syncing, setSyncing] = useState(false);

  const refresh = async () => {
    const cached = await loadCachedMockupProjects().catch(() => []);
    setProjects(mergeProjects(listProjects(), cached));
  };
  useEffect(() => {
    let alive = true;
    void refresh();
    setSyncing(true);
    void syncMockupProjectsFromCloud().then((synced) => {
      if (alive) setProjects(mergeProjects(listProjects(), synced));
    }).finally(() => { if (alive) setSyncing(false); });
    const onChanged = () => { if (alive) void refresh(); };
    window.addEventListener(MOCKUP_PROJECTS_CHANGED_EVENT, onChanged);
    return () => { alive = false; window.removeEventListener(MOCKUP_PROJECTS_CHANGED_EVENT, onChanged); };
  }, []);

  const visible = projects.filter((project) =>
    (showArchive ? project.status === 'archived' : project.status !== 'archived')
    && [project.name, project.campaignName, project.variantLabel].some((value) => value?.toLowerCase().includes(query.toLowerCase())),
  );
  const groups = useMemo(() => {
    const result = new Map<string, { label: string; campaign: boolean; docs: MockupDoc[] }>();
    for (const project of visible) {
      const key = project.campaignId || '__standalone__';
      const current = result.get(key) ?? {
        label: project.campaignName || (key === '__standalone__' ? 'Enkeltprosjekter' : key),
        campaign: Boolean(project.campaignId), docs: [],
      };
      current.docs.push(project);
      result.set(key, current);
    }
    return [...result.entries()];
  }, [visible]);
  const doRename = (id: string) => {
    if (renameVal.trim()) renameProject(id, renameVal.trim());
    setRenaming(null); void refresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: C.font, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={onClose} style={ghost}>← Home</button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Mockup Studio</span>
        <span style={{ color: C.inkSoft, fontSize: 11 }}>{syncing ? 'Synkroniserer…' : 'Lokal cache + sky'}</span>
        <div style={{ flex: 1 }} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søk i prosjekt eller kampanje…" style={{ ...input, flex: '1 1 190px', maxWidth: 300 }} />
        {onGallery && <button onClick={onGallery} style={ghost}>✦ Design-galleri</button>}
        <button onClick={onNew} style={primary}>+ Nytt materiell</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Prosjekter og kampanjer</h1>
            <p style={{ fontSize: 14, color: C.inkSoft, margin: '4px 0 0' }}>Varianter deler kampanjeidentitet, mens hvert design forblir fullt redigerbart.</p>
          </div>
          <div style={{ flex: 1 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.inkSoft, cursor: 'pointer' }}>
            <input type="checkbox" checked={showArchive} onChange={(event) => setShowArchive(event.target.checked)} /> Vis arkiv
          </label>
        </div>

        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.inkSoft }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{showArchive ? 'Ingen arkiverte prosjekter' : 'Lag ditt første produktmateriell'}</div>
            {!showArchive && <button onClick={onNew} style={primary}>Opprett første materiell</button>}
          </div>
        ) : groups.map(([key, group]) => (
          <section key={key} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>{group.label}</h2>
              <span style={{ fontSize: 11, color: C.inkSoft }}>{group.campaign ? `${group.docs.length} varianter` : `${group.docs.length} prosjekter`}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {group.docs.map((project) => {
                const localAssets = localAssetCount(project);
                return (
                  <div key={project.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                    <button onClick={() => onOpen(project)} style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: '#0b0d13', cursor: 'pointer' }} title="Åpne">
                      <div style={{ aspectRatio: '16 / 10' }}><Thumb doc={project} /></div>
                    </button>
                    <div style={{ padding: '10px 12px' }}>
                      {renaming === project.id ? (
                        <input autoFocus value={renameVal} onChange={(event) => setRenameVal(event.target.value)} onBlur={() => doRename(project.id)} onKeyDown={(event) => { if (event.key === 'Enter') doRename(project.id); if (event.key === 'Escape') setRenaming(null); }} style={{ ...input, width: '100%', marginBottom: 6 }} />
                      ) : <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>}
                      {project.variantLabel && <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 5 }}>{project.variantLabel}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: STATUS_COLOR[project.status ?? 'draft'], fontWeight: 600 }}>● {STATUS_LABELS[project.status ?? 'draft']}</span>
                        <span style={{ fontSize: 11, color: C.inkSoft }}>· {project.devices.length} enheter · {project.images?.length ?? 0} bilder</span>
                        {localAssets > 0 && <span style={{ fontSize: 10.5, color: '#e0b060' }} title="Lastes opp automatisk ved skysynk">↥ {localAssets} lokale assets</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button onClick={() => onOpen(project)} style={mini}>Åpne</button>
                        <button onClick={() => { duplicateProject(project.id); void refresh(); }} style={mini}>{group.campaign ? 'Ny variant' : 'Dupliser'}</button>
                        <button onClick={() => { setRenaming(project.id); setRenameVal(project.name); }} style={mini}>Navn</button>
                        {project.status === 'archived'
                          ? <button onClick={() => { setProjectStatus(project.id, 'draft'); void refresh(); }} style={mini}>Gjenopprett</button>
                          : <button onClick={() => { setProjectStatus(project.id, 'archived'); void refresh(); }} style={mini}>Arkiver</button>}
                        <button onClick={() => { if (!confirm(`Slette «${project.name}»? Dette kan ikke angres.`)) return; deleteProject(project.id); void refresh(); }} style={{ ...mini, color: '#f0a0a0' }}>Slett</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Thumb({ doc }: { doc: MockupDoc }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    rasterizeMockup(doc, 240 / Math.max(doc.canvas.w, 1)).then((offscreen) => {
      if (!alive) return;
      const canvas = ref.current;
      if (!canvas) return;
      canvas.width = offscreen.width; canvas.height = offscreen.height;
      canvas.getContext('2d')?.drawImage(offscreen, 0, 0);
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
