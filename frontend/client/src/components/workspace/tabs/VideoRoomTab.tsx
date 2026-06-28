// @ts-nocheck
/**
 * VideoRoomTab — produsent-side video-review (frame.io-stil) i workspacet.
 *
 * Gjenbruker CinematicVideoPlayer (scrubber + chapter-markører + timecode-
 * kommentarer) og prosjekt-scopede video-tabeller (project_video_versions /
 * project_video_comments). Versjoner V1→Final m/ status, tidsstemplet
 * kommentar-skinne (Alle/Uløste/Løste/Beslutninger), fase-stepper og
 * Request Changes / Godkjenn / Ny versjon. Dark CreatorHub-branding.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Button, Chip, TextField, CircularProgress } from '@mui/material';
import CloudUpload from '@mui/icons-material/CloudUpload';
import CheckCircle from '@mui/icons-material/CheckCircle';
import EditNote from '@mui/icons-material/EditNote';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag, WsModal } from '../ui';
import CinematicVideoPlayer from '@/components/gallery/CinematicVideoPlayer';

const PHASES = ['Brief', 'V1', 'Klient-review', 'Revisjoner', 'Levert'];

function fmtTc(s: number): string {
  const m = Math.floor((s || 0) / 60); const sec = Math.floor((s || 0) % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const VideoRoomTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = projectId && projectId !== 'sample';
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('alle');
  const [addOpen, setAddOpen] = useState(false);
  const [vFile, setVFile] = useState<any>(null); const [vLabel, setVLabel] = useState('');
  const [uploadPct, setUploadPct] = useState(0); const [busy, setBusy] = useState(false);
  // AI restyle/relight (SwitchX)
  const [aiCfg, setAiCfg] = useState<any | null>(null);
  const [reOpen, setReOpen] = useState(false); const [rePrompt, setRePrompt] = useState(''); const [reRes, setReRes] = useState(720);
  const [reJob, setReJob] = useState<any | null>(null); const [reBusy, setReBusy] = useState(false);
  const RE_PRESETS = ['Golden hour — varmt, filmatisk motlys', 'Blå time — kjølig, stemningsfull', 'Natt-neon — urbant, fargerikt', 'Overskyet studio — mykt, nøytralt lys'];
  const loadAiCfg = () => apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/config`).then((r: any) => setAiCfg(r || null)).catch(() => {});
  const setConsent = async (c: boolean) => { try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/consent`, { method: 'PUT', body: { consented: c } }); loadAiCfg(); } catch (e: any) { window.alert(e?.message || 'Feil'); } };
  const openRe = () => { setRePrompt(''); setReJob(null); setReOpen(true); };
  const startRestyle = async () => {
    if (!current?.id || !rePrompt.trim() || reBusy) return;
    setReBusy(true); setReJob({ status: 'queued' });
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/video-restyle`, { method: 'POST', body: { versionId: current.id, prompt: rePrompt.trim(), maxResolution: reRes } });
      if (!r?.jobId) throw new Error('Kunne ikke starte');
      for (let i = 0; i < 60; i++) {
        await new Promise((res) => setTimeout(res, 5000));
        const s: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/jobs/${r.jobId}`);
        setReJob(s);
        if (s.status === 'completed' || s.status === 'failed') break;
      }
    } catch (e: any) { window.alert(e?.message || 'Restyle feilet'); setReJob({ status: 'failed' }); }
    finally { setReBusy(false); }
  };

  const load = () => {
    loadAiCfg();
    if (!isReal) { setLoading(false); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-room`)
      .then((r: any) => setData(r || null)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  const versions = data?.versions || [];
  const current = versions.find((v: any) => v.id === data?.currentVersionId) || versions[versions.length - 1] || null;
  const comments = data?.comments || [];
  const chapters = (data?.chapters || []).map((c: any) => ({ startSec: c.startSec ?? c.start_sec ?? 0, title: c.title || '', intro: c.intro || null }));

  const counts = useMemo(() => ({
    all: comments.length,
    open: comments.filter((c: any) => c.status !== 'resolved' && c.status !== 'done').length,
    resolved: comments.filter((c: any) => c.status === 'resolved' || c.status === 'done').length,
    decisions: comments.filter((c: any) => c.isDecision).length,
  }), [comments]);

  const shown = comments.filter((c: any) => {
    if (filter === 'uloste') return c.status !== 'resolved' && c.status !== 'done';
    if (filter === 'loste') return c.status === 'resolved' || c.status === 'done';
    if (filter === 'beslutninger') return c.isDecision;
    return true;
  }).filter((c: any) => !c.parentId);

  const addComment = async ({ timecodeSec, comment }: any) => {
    if (!isReal || !current) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-comments`, { method: 'POST', body: { versionId: current.id, timecodeSec, comment, authorKind: 'creator' } }); load(); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke kommentere'); }
  };
  const resolveComment = async (c: any) => {
    if (!isReal) return;
    const next = (c.status === 'resolved' || c.status === 'done') ? 'open' : 'resolved';
    setData((d: any) => ({ ...d, comments: d.comments.map((x: any) => x.id === c.id ? { ...x, status: next } : x) }));
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-comments/${c.id}`, { method: 'PATCH', body: { status: next } }).catch(load);
  };
  const approve = async () => {
    if (!isReal || !current) return;
    if (!window.confirm('Godkjenn denne versjonen?')) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-versions/${current.id}/approve`, { method: 'POST', body: {} }); load(); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke godkjenne'); }
  };
  // Last opp videofil → B2 (server-side multer) m/ fremdrift via XHR.
  const uploadVersion = async () => {
    if (!vFile) return;
    setBusy(true); setUploadPct(0);
    try {
      const fd = new FormData();
      fd.append('file', vFile);
      if (vLabel.trim()) fd.append('versionLabel', vLabel.trim());
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/projects/${encodeURIComponent(projectId)}/video-versions/upload`);
        xhr.withCredentials = true;
        const tok = localStorage.getItem('creatorhub_auth_token') || localStorage.getItem('token');
        if (tok) xhr.setRequestHeader('Authorization', `Bearer ${tok}`);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve(null) : reject(new Error(`Opplasting feilet (${xhr.status})`));
        xhr.onerror = () => reject(new Error('Nettverksfeil under opplasting'));
        xhr.send(fd);
      });
      setAddOpen(false); setVFile(null); setVLabel(''); setUploadPct(0); load();
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke laste opp'); }
    finally { setBusy(false); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;

  const phaseIdx = current?.status === 'approved' ? 4 : versions.length === 0 ? 0 : counts.open > 0 ? 2 : 3;
  const statusTag = (s: string) => s === 'approved' ? <WsTag label="Godkjent" tone="green" /> : s === 'under_review' ? <WsTag label="Under review" tone="amber" /> : s === 'superseded' ? <WsTag label="Erstattet" tone="neutral" /> : <WsTag label={s || 'Pending'} tone="neutral" />;

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Video Room</Typography>
            {current && statusTag(current.status)}
          </Stack>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Frame.io-stil review — versjoner, tidsstemplede tilbakemeldinger, kapitler og godkjenning. Samme rom klienten får.</Typography>
        </Box>
        <Button variant="outlined" startIcon={<CloudUpload sx={{ fontSize: 18 }} />} onClick={() => setAddOpen(true)} disabled={!isReal} sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 700, '&:hover': { borderColor: ws.accent, bgcolor: ws.accentSoft } }}>Ny versjon</Button>
      </Stack>

      {!current && (
        <WsCard sx={{ bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>
          <Typography sx={{ fontSize: 13.5, color: ws.text, mb: 1 }}>Ingen video lastet opp ennå. Legg til første versjon (V1) — så får klient/team tidsstemplet review med versjonering, kapitler og godkjenning.</Typography>
          <Button variant="contained" onClick={() => setAddOpen(true)} disabled={!isReal} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Legg til V1</Button>
        </WsCard>
      )}

      {current && (
        <Stack direction="row" spacing={2.5} sx={{ alignItems: 'flex-start' }}>
          {/* Venstre: spiller + versjoner + stepper */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <WsCard pad={0} sx={{ overflow: 'hidden', mb: 2 }}>
              {(current.fileUrl || current.streamUid)
                ? <CinematicVideoPlayer
                    src={current.fileUrl || ''}
                    poster={current.thumbnailUrl || null}
                    title={current.versionLabel}
                    chapters={chapters}
                    comments={comments}
                    aspectRatio="16 / 9"
                    onAddComment={addComment}
                  />
                : <Box sx={{ aspectRatio: '16 / 9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ws.textFaint }}>Ingen videokilde</Box>}
            </WsCard>

            {/* Kapittel-segmentbar */}
            {chapters.length > 0 && (
              <WsCard sx={{ mb: 2 }}>
                <Stack direction="row" spacing={0.5}>
                  {chapters.map((c: any, i: number) => (
                    <Box key={i} sx={{ flex: 1, py: 0.75, px: 1, borderRadius: 1, bgcolor: ws.panelAlt, borderTop: `2px solid ${[ws.accent, ws.amber, ws.green, ws.blue, ws.red][i % 5]}` }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700 }} noWrap>{c.title}</Typography>
                      <Typography sx={{ fontSize: 10, color: ws.textFaint }}>{fmtTc(c.startSec)}</Typography>
                    </Box>
                  ))}
                </Stack>
              </WsCard>
            )}

            {/* Versjons-strip */}
            <WsCard sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.25 }}>Versjoner</Typography>
              <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 0.5 }}>
                {versions.map((v: any) => (
                  <Box key={v.id} onClick={() => setData((d: any) => ({ ...d, currentVersionId: v.id }))}
                    sx={{ minWidth: 150, p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${v.id === current.id ? ws.accentBorder : ws.borderSoft}`, cursor: 'pointer', flexShrink: 0 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>{v.versionLabel}</Typography>
                      {statusTag(v.status)}
                    </Stack>
                    <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{v.commentCount} kommentar{v.commentCount === 1 ? '' : 'er'}{v.openCount > 0 ? ` · ${v.openCount} uløst` : ''}</Typography>
                  </Box>
                ))}
              </Stack>
            </WsCard>

            {/* Fase-stepper */}
            <WsCard>
              <Stack direction="row" spacing={1} alignItems="center">
                {PHASES.map((p, i) => (
                  <React.Fragment key={p}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Box sx={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: i < phaseIdx ? ws.green : i === phaseIdx ? ws.accent : 'transparent', border: i > phaseIdx ? `1.5px solid ${ws.border}` : 'none' }}>
                        {i < phaseIdx ? <CheckCircle sx={{ fontSize: 12, color: '#fff' }} /> : <Typography sx={{ fontSize: 10, fontWeight: 700, color: i === phaseIdx ? ws.accentContrast : ws.textFaint }}>{i + 1}</Typography>}
                      </Box>
                      <Typography sx={{ fontSize: 11.5, fontWeight: i === phaseIdx ? 700 : 500, color: i <= phaseIdx ? ws.text : ws.textFaint }}>{p}</Typography>
                    </Stack>
                    {i < PHASES.length - 1 && <Box sx={{ flex: 1, height: 1.5, bgcolor: i < phaseIdx ? ws.green : ws.border }} />}
                  </React.Fragment>
                ))}
              </Stack>
            </WsCard>
          </Box>

          {/* Høyre: kommentar-skinne */}
          <Box sx={{ width: 340, flexShrink: 0 }}>
            <WsCard sx={{ p: 0, overflow: 'hidden' }}>
              <Box sx={{ p: 1.5, borderBottom: `1px solid ${ws.borderSoft}` }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, mb: 1 }}>Kommentarer</Typography>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  {[['alle', `Alle ${counts.all}`], ['uloste', `Uløste ${counts.open}`], ['loste', `Løste ${counts.resolved}`], ['beslutninger', `Beslutninger ${counts.decisions}`]].map(([k, label]: any) => (
                    <Box key={k} onClick={() => setFilter(k)} sx={{ px: 1, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 11.5, fontWeight: filter === k ? 700 : 500, color: filter === k ? ws.accent : ws.textDim, bgcolor: filter === k ? ws.accentSoft : 'rgba(255,255,255,0.04)', border: `1px solid ${filter === k ? ws.accentBorder : 'transparent'}` }}>{label}</Box>
                  ))}
                </Stack>
              </Box>
              <Stack sx={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
                {shown.length === 0 && <Typography sx={{ fontSize: 12.5, color: ws.textDim, p: 2, textAlign: 'center' }}>Ingen kommentarer. Klikk på tidslinjen i spilleren for å legge til på et tidspunkt.</Typography>}
                {shown.map((c: any) => {
                  const resolved = c.status === 'resolved' || c.status === 'done';
                  return (
                    <Box key={c.id} sx={{ p: 1.5, borderBottom: `1px solid ${ws.borderSoft}` }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Chip label={fmtTc(c.timecodeSec)} size="small" sx={{ height: 20, fontSize: 10.5, fontWeight: 700, color: ws.accent, bgcolor: ws.accentSoft }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{c.clientName || 'Team'}</Typography>
                        <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>({c.authorKind === 'client' ? 'Klient' : 'Skaper'})</Typography>
                        {c.isDecision && <WsTag label="Beslutning" tone="blue" />}
                      </Stack>
                      <Typography sx={{ fontSize: 12.5, color: ws.text, mb: 0.75 }}>{c.comment}</Typography>
                      <Box onClick={() => resolveComment(c)} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, cursor: 'pointer', px: 0.75, py: 0.25, borderRadius: 1, bgcolor: resolved ? ws.greenSoft : 'rgba(255,255,255,0.05)' }}>
                        <CheckCircle sx={{ fontSize: 13, color: resolved ? ws.green : ws.textFaint }} />
                        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: resolved ? ws.green : ws.textDim }}>{resolved ? 'Løst' : 'Marker løst'}</Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </WsCard>
          </Box>
        </Stack>
      )}

      {/* Bunn-action-bar */}
      {current && (
        <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 2.5 }}>
          <Button variant="outlined" startIcon={<EditNote />} disabled sx={{ color: ws.textDim, borderColor: ws.border, textTransform: 'none', fontWeight: 600 }}>Be om endringer</Button>
          {aiCfg?.enabled && aiCfg?.whitelisted && <Button variant="outlined" startIcon={<AutoAwesome />} onClick={openRe} sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600 }}>Restyle / Relight</Button>}
          <Button variant="outlined" startIcon={<CloudUpload />} onClick={() => setAddOpen(true)} sx={{ color: ws.text, borderColor: ws.border, textTransform: 'none', fontWeight: 600 }}>Last opp ny versjon</Button>
          <Button variant="contained" startIcon={<CheckCircle />} onClick={approve} disabled={current.status === 'approved'} sx={{ bgcolor: ws.green, color: '#06281c', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#2bbf8a' } }}>{current.status === 'approved' ? 'Godkjent' : 'Godkjenn video'}</Button>
        </Stack>
      )}

      {/* Ny versjon-dialog — last opp videofil til B2 */}
      <WsModal open={addOpen} onClose={() => { if (!busy) setAddOpen(false); }} title="Ny videoversjon" maxWidth="sm">
        <Stack spacing={2}>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Last opp en review-kopi (komprimert MP4/MOV, ≤500 MB). Lagres på B2; avspilling streames derfra.</Typography>
          <Box component="label" sx={{ display: 'block', p: 2, border: `1.5px dashed ${ws.accentBorder}`, borderRadius: `${ws.radiusSm}px`, textAlign: 'center', cursor: busy ? 'default' : 'pointer', bgcolor: ws.accentSoft }}>
            <input type="file" accept="video/*" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setVFile(f); if (!vLabel) setVLabel(''); } }} />
            <CloudUpload sx={{ color: ws.accent, fontSize: 28 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, mt: 0.5 }}>{vFile ? vFile.name : 'Velg videofil'}</Typography>
            {vFile && <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{(vFile.size / 1024 / 1024).toFixed(1)} MB</Typography>}
          </Box>
          <TextField label="Versjonsnavn (valgfritt)" value={vLabel} onChange={(e) => setVLabel(e.target.value)} fullWidth size="small" placeholder="V2 – Revidert kutt" disabled={busy} />
          {busy && <Box><Box sx={{ height: 6, borderRadius: 3, bgcolor: ws.panelAlt, overflow: 'hidden' }}><Box sx={{ width: `${uploadPct}%`, height: '100%', bgcolor: ws.accent, transition: 'width 0.2s' }} /></Box><Typography sx={{ fontSize: 11, color: ws.textDim, mt: 0.5 }}>Laster opp… {uploadPct}%</Typography></Box>}
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={() => setAddOpen(false)} disabled={busy} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
            <Button variant="contained" onClick={uploadVersion} disabled={busy || !vFile} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{busy ? 'Laster opp…' : 'Last opp versjon'}</Button>
          </Stack>
        </Stack>
      </WsModal>

      {/* Restyle / Relight (SwitchX) */}
      <WsModal open={reOpen} onClose={() => { if (!reBusy) setReOpen(false); }} title="Restyle / Relight (AI)" maxWidth="sm">
        {!aiCfg?.beebleConfigured ? (
          <Box sx={{ p: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.amberSoft, border: `1px solid ${ws.amber}55` }}>
            <Typography sx={{ fontSize: 13, color: ws.text }}>SwitchX (Beeble) er ikke konfigurert ennå. Sett <b>BEEBLE_API_KEY</b> på backend + fyll på kreditter i Beeble billing-portal, så blir Restyle aktiv.</Typography>
          </Box>
        ) : !aiCfg?.consent?.consented ? (
          <Stack spacing={2}>
            <Box sx={{ p: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.amberSoft, border: `1px solid ${ws.amber}55` }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: ws.amber, mb: 0.5 }}>⚠️ Samtykke kreves</Typography>
              <Typography sx={{ fontSize: 12.5, color: ws.text }}>Restyle sender videoen til en tredjeparts AI (SwitchX / Beeble) som kan behandle data utenfor EØS.</Typography>
            </Box>
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button onClick={() => setReOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
              <Button variant="contained" onClick={() => setConsent(true)} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Samtykk og fortsett</Button>
            </Stack>
          </Stack>
        ) : reJob && reJob.status === 'completed' && reJob.afterUrl ? (
          <Stack spacing={2}>
            <Box component="video" src={reJob.afterUrl} controls autoPlay loop sx={{ width: '100%', borderRadius: `${ws.radiusSm}px`, bgcolor: '#000', aspectRatio: '16 / 9' }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>«{reJob.prompt}» — bevegelsen er bevart, kun lys/stil endret.</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => setReJob(null)} sx={{ color: ws.textDim, textTransform: 'none' }}>Ny</Button>
                <Button size="small" variant="contained" onClick={() => window.open(reJob.afterUrl, '_blank')} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Last ned</Button>
              </Stack>
            </Stack>
          </Stack>
        ) : reBusy || (reJob && reJob.status !== 'failed') ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress sx={{ color: ws.accent }} />
            <Typography sx={{ fontSize: 13, color: ws.textDim, textAlign: 'center' }}>SwitchX restyler videoen… tar noen minutter.<br /><Typography component="span" sx={{ fontSize: 11.5, color: ws.textFaint }}>Du kan lukke — jobben fortsetter.</Typography></Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {reJob?.status === 'failed' && <Typography sx={{ fontSize: 12.5, color: ws.red }}>Restyle feilet. Sjekk at Beeble-kontoen har kreditter, og prøv igjen.</Typography>}
            <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Beskriv det nye lyset/stilen (bevegelse + performance bevares):</Typography>
            <TextField value={rePrompt} onChange={(e) => setRePrompt(e.target.value)} fullWidth multiline minRows={2} size="small" placeholder="f.eks. varmt golden hour-motlys, filmatisk og stemningsfullt" />
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {RE_PRESETS.map((p) => <Box key={p} onClick={() => setRePrompt(p)} sx={{ px: 1, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 11, color: ws.accent, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>{p}</Box>)}
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>Oppløsning:</Typography>
              {[720, 1080].map((r) => <Box key={r} onClick={() => setReRes(r)} sx={{ px: 1.25, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 12, fontWeight: reRes === r ? 700 : 500, color: reRes === r ? ws.accentContrast : ws.textDim, bgcolor: reRes === r ? ws.accent : 'rgba(255,255,255,0.05)' }}>{r}p</Box>)}
            </Stack>
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button onClick={() => setReOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
              <Button variant="contained" disabled={!rePrompt.trim() || reBusy} onClick={startRestyle} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Restyle video</Button>
            </Stack>
          </Stack>
        )}
      </WsModal>
    </Box>
  );
};

export default VideoRoomTab;
