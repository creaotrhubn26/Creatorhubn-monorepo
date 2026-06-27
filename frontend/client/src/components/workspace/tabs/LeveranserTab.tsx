// @ts-nocheck
/**
 * LeveranserTab — design #7 (Deliveries), dark CreatorHub.
 * Leveranse-liste + leveranse-detalj (video/preview opplastbar + progress-stepper
 * + sjekkliste) + Delivery progress / Client feedback / Activity.
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Button, Avatar } from '@mui/material';
import Add from '@mui/icons-material/Add';
import CheckCircle from '@mui/icons-material/CheckCircle';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsRing, WsPills, WsTag, WsImageGrid, WsModal } from '../ui';

const STATUS_LABEL: Record<string, [string, string]> = {
  not_started: ['Not started', 'neutral'], in_progress: ['In progress', 'amber'],
  completed: ['Completed', 'green'], delivered: ['Delivered', 'green'], archived: ['Archived', 'neutral'],
};

const DELIVERABLES = [
  ['Teaser Trailer (60s)', 'Video', 'In progress', 'amber', '18. sep'],
  ['Highlight Film (6-8 min)', 'Video', 'In progress', 'amber', '28. sep', true],
  ['Full Wedding Film (45-60 min)', 'Video', 'Not started', 'neutral', '02. nov'],
  ['Photo Gallery', 'Online gallery', 'Completed', 'green', '20. sep'],
  ['Edited Photos (400)', 'Digital download', 'Not started', 'neutral', '25. sep'],
  ['Social Media Reels (3x)', 'Video', 'Not started', 'neutral', '18. sep'],
  ['USB Drive', 'Physical', 'Not started', 'neutral', '05. nov'],
];
const STEPS = ['Editing', 'Internal Review', 'Client Review', 'Revisions', 'Approved'];
const CHECKLIST = [['Rough cut completed', true], ['Audio mix complete', true], ['Color grading', false], ['Titles & graphics', false], ['Final export', false], ['QC & delivery', false]];

const LeveranserTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [filter, setFilter] = useState('planned');
  const [real, setReal] = useState<any[] | null>(null);
  const isReal = projectId && projectId !== 'sample';

  const [galleries, setGalleries] = useState<any[]>([]);
  const [delivery, setDelivery] = useState<{ phase: number; signals: any } | null>(null);
  const [editingJobs, setEditingJobs] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [fbModal, setFbModal] = useState(false);
  const load = () => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/deliverables`)
      .then((r: any) => setReal(Array.isArray(r?.deliverables) ? r.deliverables : []))
      .catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/galleries`)
      .then((r: any) => setGalleries(Array.isArray(r?.galleries) ? r.galleries : []))
      .catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/delivery-status`)
      .then((r: any) => { if (r && typeof r.phase === 'number') setDelivery({ phase: r.phase, signals: r.signals || {} }); })
      .catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/editing-jobs`)
      .then((r: any) => setEditingJobs(Array.isArray(r?.jobs) ? r.jobs : []))
      .catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/revision-requests`)
      .then((r: any) => setRevisions(Array.isArray(r?.requests) ? r.requests : []))
      .catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/client-feedback`)
      .then((r: any) => { setFeedback(Array.isArray(r?.feedback) ? r.feedback : []); setActivity(Array.isArray(r?.activity) ? r.activity : []); })
      .catch(() => {});
  };
  const EJ_TONE: Record<string, string> = { requested: 'amber', pending: 'amber', accepted: 'blue', in_progress: 'blue', delivered: 'green', completed: 'green', paid: 'green' };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  // Aktiv fase: ekte (utledet fra showcase) eller demo = 1.
  const activePhase = delivery ? delivery.phase : 1;
  const sig = delivery?.signals || {};

  const markApproved = async () => {
    const g = galleries[0];
    if (!g?.id) { window.alert('Ingen klient-galleri å markere som godkjent ennå.'); return; }
    if (!window.confirm('Marker leveransen som godkjent (fullfør galleriet)?')) return;
    try { await apiRequest(`/api/photographer/galleries/${g.id}/mark-complete`, { method: 'POST' }); load(); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke markere'); }
  };

  const shareGallery = (sharePath: string) => {
    if (!sharePath) return;
    const url = `${window.location.origin}${sharePath}`;
    try { navigator.clipboard?.writeText(url); } catch { /* ignore */ }
    window.open(url, '_blank');
  };

  const addDeliverable = async () => {
    if (!isReal) return;
    const title = window.prompt('Ny leveranse (tittel):'); if (!title) return;
    const type = window.prompt('Type (f.eks. Video / Online gallery):') || null;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/deliverables`, { method: 'POST', body: { title: title.trim(), type } }); load(); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke legge til'); }
  };

  const list = (real && real.length > 0)
    ? real.map((d: any) => [d.title, d.type || '', ...(STATUS_LABEL[d.status] || ['—', 'neutral']), d.dueDate ? new Date(d.dueDate).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : '—', false])
    : DELIVERABLES;

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
      {/* Liste */}
      <Box sx={{ width: 300, flexShrink: 0 }}>
        <WsCard>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Deliverables</Typography>
            <Button size="small" variant="contained" onClick={addDeliverable} disabled={!isReal} startIcon={<Add sx={{ fontSize: 15 }} />} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Ny</Button>
          </Stack>
          <Box sx={{ mb: 1.5 }}><WsPills items={[{ key: 'planned', label: 'Planned' }, { key: 'progress', label: 'In progress' }, { key: 'delivered', label: 'Delivered' }]} value={filter} onChange={setFilter} /></Box>
          <Stack spacing={0.75}>
            {list.map(([n, type, st, tone, due, active], i) => (
              <Box key={i} sx={{ p: 1.25, borderRadius: 2, cursor: 'pointer', border: `1px solid ${active ? ws.accentBorder : ws.borderSoft}`, bgcolor: active ? ws.accentSoft : 'transparent' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{n}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{type}</Typography></Box>
                  <WsTag label={st} tone={tone} />
                </Stack>
                <Typography sx={{ fontSize: 11, color: ws.textDim, mt: 0.5 }}>Frist {due}</Typography>
              </Box>
            ))}
          </Stack>
        </WsCard>
      </Box>

      {/* Detalj */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center"><Typography sx={{ fontSize: 18, fontWeight: 800 }}>Highlight Film (6-8 min)</Typography><WsTag label="In progress" tone="amber" /></Stack>
          <Button size="small" startIcon={<CheckCircle sx={{ fontSize: 16 }} />} sx={{ color: ws.green, textTransform: 'none', border: `1px solid ${ws.greenSoft}` }}>Marker som ferdig</Button>
        </Stack>

        <WsCard sx={{ mb: 2 }}>
          <WsImageGrid columns={1} ratio="16 / 9" addLabel="Last opp versjon (video/preview)" />
        </WsCard>

        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Progress</Typography>
            {isReal && (
              <Stack direction="row" spacing={1} alignItems="center">
                {sig.hasGallery && <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{sig.selections || 0} valg · {sig.comments || 0} kommentarer</Typography>}
                {activePhase < 5 && <Button size="small" onClick={markApproved} sx={{ color: ws.green, textTransform: 'none', border: `1px solid ${ws.greenSoft}` }}>Marker godkjent</Button>}
              </Stack>
            )}
          </Stack>
          <Stack direction="row" justifyContent="space-between" sx={{ position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 14, left: 16, right: 16, height: 2, bgcolor: ws.border }} />
            <Box sx={{ position: 'absolute', top: 14, left: 16, height: 2, bgcolor: ws.accent, width: `${Math.max(0, (activePhase - 1) / (STEPS.length - 1)) * 100}%`, maxWidth: 'calc(100% - 32px)' }} />
            {STEPS.map((s, i) => {
              const step = i + 1;
              const done = step < activePhase;
              const active = step === activePhase;
              return (
                <Stack key={s} alignItems="center" spacing={0.75} sx={{ zIndex: 1, flex: 1 }}>
                  <Box sx={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800,
                    bgcolor: active ? ws.accent : done ? ws.greenSoft : ws.panelSolid, color: active ? ws.accentContrast : done ? ws.green : ws.textDim,
                    border: `2px solid ${active ? ws.accent : done ? ws.green : ws.border}` }}>{done ? '✓' : step}</Box>
                  <Typography sx={{ fontSize: 11, color: active ? ws.accent : ws.textDim, fontWeight: active ? 700 : 500, textAlign: 'center' }}>{s}</Typography>
                  <Typography sx={{ fontSize: 9.5, color: ws.textFaint }}>{active ? 'In progress' : done ? 'Ferdig' : 'Pending'}</Typography>
                </Stack>
              );
            })}
          </Stack>
        </WsCard>

        <WsCard>
          <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Delivery checklist</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {CHECKLIST.map(([t, ok]) => <Stack key={t} direction="row" spacing={0.75} alignItems="center"><CheckCircle sx={{ fontSize: 16, color: ok ? ws.green : ws.textFaint }} /><Typography sx={{ fontSize: 12.5 }}>{t}</Typography></Stack>)}
          </Box>
        </WsCard>
      </Box>

      {/* Høyre */}
      <Box sx={{ width: 280, flexShrink: 0 }}>
        {isReal && (
          <WsCard sx={{ mb: 2 }}>
            <WsSectionTitle title="Klient-galleri (Showcase)" />
            {galleries.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>Ingen galleri publisert ennå. Opprett et klient-galleri for å dele leveransen som showcase.</Typography>
            ) : (
              <Stack spacing={1}>
                {galleries.map((g) => (
                  <Box key={g.id} sx={{ p: 1, borderRadius: 1.5, border: `1px solid ${ws.borderSoft}` }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700 }}>{g.title}</Typography>
                        <Typography noWrap sx={{ fontSize: 11, color: ws.textFaint }}>{g.clientName || g.clientEmail || ''}</Typography>
                      </Box>
                      <WsTag label={g.status || 'klar'} tone={g.status === 'completed' ? 'green' : 'blue'} />
                    </Stack>
                    {g.sharePath && (
                      <Button fullWidth size="small" onClick={() => shareGallery(g.sharePath)} sx={{ mt: 0.75, color: ws.accent, textTransform: 'none', border: `1px solid ${ws.accentBorder}` }}>
                        Del med klient ↗
                      </Button>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </WsCard>
        )}
        {isReal && editingJobs.length > 0 && (
          <WsCard sx={{ mb: 2 }}>
            <WsSectionTitle title="Editor-handoff" />
            <Stack spacing={1}>
              {editingJobs.map((j) => (
                <Box key={j.id} sx={{ p: 1, borderRadius: 1.5, border: `1px solid ${ws.borderSoft}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700 }}>{j.vendorName || 'Redigerings-vendor'}</Typography>
                      <Typography noWrap sx={{ fontSize: 11, color: ws.textFaint }}>{(j.services || []).join(', ') || 'Redigering'}{j.amount != null ? ` · ${Math.round(j.amount).toLocaleString('nb-NO')} ${j.currency || 'kr'}` : ''}</Typography>
                    </Box>
                    <WsTag label={j.status || 'sendt'} tone={EJ_TONE[j.status] || 'neutral'} />
                  </Stack>
                </Box>
              ))}
            </Stack>
          </WsCard>
        )}
        {isReal && revisions.length > 0 && (
          <WsCard sx={{ mb: 2 }}>
            <WsSectionTitle title={`Revisjoner (${revisions.filter((r) => r.status !== 'resolved' && r.status !== 'done').length} åpne)`} />
            <Stack spacing={1}>
              {revisions.slice(0, 6).map((r) => (
                <Box key={r.id} sx={{ p: 1, borderRadius: 1.5, border: `1px solid ${ws.borderSoft}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 600 }}>{r.filename || 'Bilde'}</Typography>
                      <Typography sx={{ fontSize: 11, color: ws.textDim }}>{r.note}</Typography>
                      <Typography noWrap sx={{ fontSize: 10.5, color: ws.textFaint }}>{r.clientEmail || ''}</Typography>
                    </Box>
                    <WsTag label={r.status === 'resolved' || r.status === 'done' ? 'Løst' : 'Åpen'} tone={r.status === 'resolved' || r.status === 'done' ? 'green' : 'amber'} />
                  </Stack>
                </Box>
              ))}
            </Stack>
          </WsCard>
        )}
        <WsCard sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Delivery progress</Typography>
          {(() => {
            const completed = isReal ? (activePhase >= 5 ? 5 : activePhase - 1) : 2;
            const pct = isReal ? Math.round((completed / 5) * 100) : 40;
            return (
          <Stack direction="row" spacing={2} alignItems="center">
            <WsRing value={pct} size={84} color={ws.accent} label={`${pct}%`} />
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>{completed} av 5 fullført</Typography>
              {[['In progress', 1, ws.amber], ['Not started', 2, ws.textFaint], ['Overdue', 0, ws.red]].map(([l, n, c]) => <Stack key={l} direction="row" spacing={1} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} /><Typography sx={{ fontSize: 11.5, flex: 1 }}>{l}</Typography><Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>{n}</Typography></Stack>)}
            </Stack>
          </Stack>
            ); })()}
        </WsCard>
        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle title="Client feedback" action={<Button size="small" onClick={() => setFbModal(true)} sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
          {(isReal ? feedback : [{ clientName: 'Sara', comment: 'Amazing work! We love the vibe 😍', at: '2024-09-16' }]).length === 0 ? (
            <Typography sx={{ fontSize: 12, color: ws.textDim }}>Ingen klient-tilbakemeldinger ennå.</Typography>
          ) : (isReal ? feedback : [{ clientName: 'Sara', comment: 'Amazing work! We love the vibe 😍', at: '2024-09-16' }]).slice(0, 4).map((f, i) => (
            <Box key={i} sx={{ mt: i ? 1 : 0, p: 1.25, borderRadius: 2, bgcolor: ws.panelInput }}>
              <Typography sx={{ fontSize: 12.5, color: ws.text }}>{f.comment}</Typography>
              <Typography sx={{ fontSize: 11, color: ws.textFaint, mt: 0.5 }}>– {f.clientName || 'Klient'}{f.at ? ` · ${new Date(f.at).toLocaleDateString('nb-NO')}` : ''}</Typography>
            </Box>
          ))}
        </WsCard>
        <WsCard>
          <WsSectionTitle title="Activity" />
          <Stack spacing={1.25}>
            {(isReal && activity.length ? activity.map((a) => [a.who, a.what, a.at ? new Date(a.at).toLocaleDateString('nb-NO') : '']) : [['Julie', 'lastet opp versjon 1', '16. sep'], ['Thomas', 'la til et notat', '15. sep'], ['Marcus', 'markerte task som ferdig', '14. sep']]).map(([who, what, t], i) => (
              <Stack key={i} direction="row" spacing={1}><Avatar sx={{ width: 24, height: 24, fontSize: 10 }}>{(who || '?')[0]}</Avatar><Box sx={{ flex: 1 }}><Typography sx={{ fontSize: 12 }}><b>{who}</b> {what}</Typography><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{t}</Typography></Box></Stack>
            ))}
          </Stack>
        </WsCard>
      </Box>

      <WsModal open={fbModal} onClose={() => setFbModal(false)} title="All klient-feedback" maxWidth="sm">
        {feedback.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: ws.textDim }}>Ingen klient-tilbakemeldinger ennå.</Typography>
        ) : (
          <Stack spacing={1.25}>
            {feedback.map((f, i) => (
              <Box key={i} sx={{ p: 1.5, borderRadius: 2, bgcolor: ws.panelInput }}>
                <Typography sx={{ fontSize: 13, color: ws.text }}>{f.comment}</Typography>
                <Typography sx={{ fontSize: 11, color: ws.textFaint, mt: 0.5 }}>– {f.clientName || 'Klient'}{f.at ? ` · ${new Date(f.at).toLocaleString('nb-NO')}` : ''}</Typography>
              </Box>
            ))}
          </Stack>
        )}
      </WsModal>
    </Stack>
  );
};

export default LeveranserTab;
