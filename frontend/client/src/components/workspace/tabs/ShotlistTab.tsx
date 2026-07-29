// @ts-nocheck
/**
 * ShotlistTab — design #4, dark CreatorHub.
 * Stats + kategori-pills + shot-tabell + Shot detaljer (høyre, opplastbart bilde
 * + samtale) + Referanser & inspirasjon (opplastbart) + Må huskes.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Stack, Typography, Button, Avatar, TextField } from '@mui/material';
import { useLocation } from 'wouter';
import { apiRequest, buildApiUrl } from '@/lib/queryClient';
import PhotoCameraBack from '@mui/icons-material/PhotoCameraBack';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Star from '@mui/icons-material/Star';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import { ws } from '../workspaceTheme';
import { wsIcon } from '../crewIcons';
import { WsCard, WsSectionTitle, WsStat, WsPills, WsTag, WsTable, WsImageGrid } from '../ui';
import { useProjectImages } from '../useProjectImages';
import { useCaptureRealtime } from '../useCaptureRealtime';

const CATS = [{ key: 'alle', label: 'Alle (68)' }, { key: 'forb', label: 'Forberedelser (10)' }, { key: 'vielse', label: 'Vielse (14)' }, { key: 'portrett', label: 'Portretter (10)' }, { key: 'fam', label: 'Familiebilder (8)' }, { key: 'golden', label: 'Golden hour (6)' }, { key: 'taler', label: 'Taler (7)' }, { key: 'fest', label: 'Fest (13)' }];
const SHOTS = [
  ['Kritisk', 'red', 'Ringer og detaljer', 'Detaljer', 'Brudens suite', 'Ferdig', 'green'],
  ['Høy', 'amber', 'Brudekjole hanging shot', 'Detaljer', 'Brudens suite', 'Planlagt', 'blue'],
  ['Normal', 'neutral', 'Makeup & hår detaljer', 'Forberedelse', 'Brudens suite', 'Planlagt', 'blue'],
  ['Kritisk', 'red', 'First look reaksjon', 'Vielse', 'Hage', 'Ferdig', 'green'],
  ['Kritisk', 'red', 'Brud inngang', 'Vielse', 'Kirken', 'Pågår', 'amber'],
  ['Kritisk', 'red', 'Ring exchange', 'Vielse', 'Kirken', 'Klar', 'accent'],
  ['Høy', 'amber', 'Portrett av paret', 'Portretter', 'Parkområdet', 'Klar', 'accent'],
];
const SAMTALE = [
  { who: 'Daniel (Foto)', t: '10:12', msg: 'Jeg tar 85mm fra fronten, Emma kan ta siden for reaksjoner? 👍' },
  { who: 'Emma (Video)', t: '10:15', msg: 'Yes! Jeg tar slow motion på siste steg i kirken. ✨' },
  { who: 'Lukas (Editor)', t: '10:18', msg: 'Perfekt! Husk å få med gjestene som reiser seg også.' },
];

const PRIO_TONE: Record<string, string> = { kritisk: 'red', critical: 'red', høy: 'amber', high: 'amber', normal: 'neutral', lav: 'neutral', low: 'neutral' };
const STATUS_TONE: Record<string, string> = { ferdig: 'green', done: 'green', completed: 'green', pågår: 'amber', in_progress: 'amber', klar: 'accent', ready: 'accent', planlagt: 'blue', planned: 'blue' };

const ShotlistTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [cat, setCat] = useState('alle');
  const [real, setReal] = useState<{ shots: any[]; meta: any } | null>(null);
  const [selShot, setSelShot] = useState<any | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [, navigate] = useLocation();
  const [comment, setComment] = useState('');
  const sendComment = async () => {
    const body = comment.trim(); if (!body || !projectId || projectId === 'sample') return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/notes`, { method: 'POST', body: { body, context: 'shotlist' } }); setComment(''); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke sende'); }
  };
  const refs = useProjectImages(projectId, 'references');

  // Hent shot-lista på nytt (mount + live-event + polling-fallback).
  const loadShotList = useCallback(() => {
    if (!projectId || projectId === 'sample') return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/shot-list`)
      .then((r: any) => { const shots = Array.isArray(r?.shots) ? r.shots : []; if (shots.length) setReal({ shots, meta: r.shotList || {} }); })
      .catch(() => {});
  }, [projectId]);

  // Live-oppdatering: iPad tar bilde → auto-huk → sync → capture-WebSocket fyrer
  // → refetch INSTANT, så fotografen ser shots hukes av mens hen skyter. Polling
  // hvert 10s som fallback når WS er nede.
  const { live } = useCaptureRealtime(projectId, loadShotList);
  useEffect(() => {
    loadShotList();
    const id = setInterval(loadShotList, 10000);
    return () => clearInterval(id);
  }, [loadShotList]);

  // Ekte shots → tabell-rader (fleksibel felt-mapping mot wizard-shapen).
  const realRows = real ? real.shots.slice(0, showAll ? 999 : 12).map((s: any) => {
    const title = s.name || s.title || s.shot || s.description || 'Shot';
    const prio = (s.priority || s.prio || 'normal').toString();
    // Auto-huk fra iPad setter isCompleted + completedBy → vis «Ferdig · Ole».
    const done = s.isCompleted === true || String(s.status || '').toLowerCase() === 'ferdig';
    const statusBase = done ? 'ferdig' : (s.status || 'planlagt').toString();
    const status = done && s.completedBy ? `Ferdig · ${s.completedBy}` : (done ? 'Ferdig' : statusBase);
    const kat = s.category || s.kategori || s.phase || '—';
    const loc = s.location || s.lokasjon || '—';
    // Ekte foto-thumbnail: iPad setter capturedAssetBackendId post-levering →
    // stabil preview-redirect (offentlig, laster i <img>).
    const thumb = s.capturedAssetBackendId
      ? buildApiUrl(`/api/capture/assets/${encodeURIComponent(s.capturedAssetBackendId)}/preview`)
      : null;
    return [prio, PRIO_TONE[prio.toLowerCase()] || 'neutral', title, kat, loc, status, STATUS_TONE[statusBase.toLowerCase()] || 'blue', thumb];
  }) : null;

  // «Neste opp» — øverste ufullførte shots (prioritert) så teamet ser hva som gjenstår.
  const PR = { must: 0, kritisk: 0, critical: 0, høy: 1, high: 1, normal: 2, medium: 2, lav: 3, low: 3 } as Record<string, number>;
  const nextUp = real ? real.shots
    .filter((s: any) => s.isCompleted !== true && String(s.status || '').toLowerCase() !== 'ferdig')
    .sort((a: any, b: any) => (PR[String(a.priority || 'normal').toLowerCase()] ?? 2) - (PR[String(b.priority || 'normal').toLowerCase()] ?? 2))
    .slice(0, 5)
    .map((s: any) => ({ title: s.name || s.title || s.shot || s.description || 'Shot', prio: (s.priority || 'normal').toString() }))
    : [];
  // Ekte prosjekt → ekte shots (tomt = tom-tilstand). Mock kun på /workspace/sample.
  const isRealP = projectId && projectId !== 'sample';
  const rows = isRealP ? (realRows || []) : SHOTS;

  // Ekte prosjekt uten shots → 0 (ikke sample-tallene 68/21/12/5).
  const total = real ? (real.meta.totalShots ?? real.shots.length) : (isRealP ? 0 : 68);
  const done = real ? (real.meta.completedShots ?? 0) : (isRealP ? 0 : 21);
  const critical = real ? (real.meta.criticalShots ?? 0) : (isRealP ? 0 : 12);
  const mangler = real ? Math.max(0, critical - (real.meta.completedCriticalShots ?? 0)) : (isRealP ? 0 : 5);
  const donePct = total > 0 ? Math.round((done / total) * 100) : 0;
  // Kategori-piller: sample-settet kun i demo; ekte prosjekt utleder fra egne shots.
  const pills = !isRealP ? CATS
    : real ? [{ key: 'alle', label: `Alle (${real.shots.length})` }, ...Object.entries(
        real.shots.reduce((acc: any, s: any) => { const k = s.category || s.kategori || s.phase || 'Annet'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
      ).map(([k, n]: any) => ({ key: k, label: `${k} (${n})` }))]
    : [{ key: 'alle', label: 'Alle (0)' }];

  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Shotlist</Typography>
          {live && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, borderRadius: 999, bgcolor: ws.greenSoft }}>
              <Box sx={{ width: 7, height: 7, borderRadius: 999, bgcolor: '#22c55e' }} />
              <Typography sx={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>Live</Typography>
            </Box>
          )}
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
          <WsStat icon={<PhotoCameraBack sx={{ fontSize: 20 }} />} label="Totalt antall shots" value={total} sub="100% planlagt" />
          <WsStat icon={<CheckCircle sx={{ fontSize: 20 }} />} label="Fullført" value={done} sub={`${donePct}% av totalen`} tone={ws.greenSoft} />
          <WsStat icon={<Star sx={{ fontSize: 20 }} />} label="Kritiske øyeblikk" value={critical} sub={`Av totalt ${total}`} tone={ws.amberSoft} />
          <WsStat icon={<ErrorOutline sx={{ fontSize: 20 }} />} label="Mangler" value={mangler} sub="Må dekkes" tone={ws.redSoft} />
        </Box>

        {isRealP && nextUp.length > 0 && (
          <WsCard sx={{ mb: 2 }}>
            <WsSectionTitle>Neste opp</WsSectionTitle>
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {nextUp.map((n: any, i: number) => (
                <Stack key={i} direction="row" alignItems="center" spacing={1}>
                  <WsTag tone={PRIO_TONE[n.prio.toLowerCase()] || 'neutral'}>{n.prio}</WsTag>
                  <Typography sx={{ fontSize: 13, color: ws.textDim }}>{n.title}</Typography>
                </Stack>
              ))}
            </Stack>
          </WsCard>
        )}

        <WsCard>
          <Box sx={{ mb: 1.5 }}><WsPills items={pills} value={cat} onChange={setCat} /></Box>
          {rows.length === 0 && <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 3, textAlign: 'center' }}>Ingen shots ennå. Shotlister opprettes fra prosjekt-oppsettet eller iPad-appen.</Typography>}
          {rows.length > 0 && <WsTable
            columns={['Prioritet', 'Shot', 'Kategori', 'Foto', 'Video', 'Lokasjon', 'Ansvarlig', 'Status']}
            onRowClick={(i) => setSelShot(rows[i])}
            rows={rows.map((s) => [
              <WsTag label={s[0]} tone={s[1]} />,
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {s[7] && <Box component="img" src={s[7]} alt="" loading="lazy" sx={{ width: 34, height: 28, objectFit: 'cover', borderRadius: 1, flex: 'none', border: `1px solid ${ws.border}` }} />}
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{s[2]}</Typography>
              </Box>,
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>{s[3]}</Typography>,
              <WsTag label="Foto" tone="accent" />,
              <WsTag label="Video" tone="blue" />,
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>{s[4]}</Typography>,
              <Avatar sx={{ width: 22, height: 22, fontSize: 10 }}>D</Avatar>,
              <WsTag label={s[5]} tone={s[6]} />,
            ])}
          />}
          {((isRealP && real && real.shots.length > 12) || (!isRealP)) && (
            <Stack alignItems="center" sx={{ mt: 1 }}><Button size="small" onClick={() => setShowAll((v) => !v)} sx={{ color: ws.textDim, textTransform: 'none' }}>{showAll ? 'Vis færre ▴' : `Vis ${real ? real.shots.length - 12 : 44} flere shots ▾`}</Button></Stack>
          )}
        </WsCard>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, mt: 2 }}>
          <WsCard>
            <WsSectionTitle title="Referanser & inspirasjon" action={<Button size="small" onClick={() => navigate(`/workspace/${projectId}/moodboard`)} sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
            <WsImageGrid columns={5} addLabel="Legg til referanse" images={refs.images} onUpload={refs.onUpload} />
          </WsCard>
          <WsCard>
            <WsSectionTitle title="Må huskes" action={<Button size="small" onClick={() => navigate(`/workspace/${projectId}/oppgaver`)} sx={{ color: ws.accent, textTransform: 'none' }}>Rediger</Button>} />
            <Stack spacing={0.75}>
              {isRealP ? (
                <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 1 }}>Legg til huskepunkter i Oppgaver.</Typography>
              ) : [['Batterier ladet', true], ['Backup kort formatert', true], ['Lydopptaker testet', false], ['Reflektor / diffuser', false], ['Ekstra linser med', false]].map(([t, ok]) => <Stack key={t} direction="row" spacing={0.75} alignItems="center"><CheckCircle sx={{ fontSize: 16, color: ok ? ws.green : ws.textFaint }} /><Typography sx={{ fontSize: 12.5 }}>{t}</Typography></Stack>)}
            </Stack>
          </WsCard>
        </Box>
      </Box>

      {/* Shot detaljer (høyre) */}
      <Box sx={{ width: { xs: '100%', lg: 320 }, flexShrink: 0 }}>
        <WsCard>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Shot detaljer</Typography>
            {isRealP ? (real?.shots?.length ? <WsTag label={`${real.shots.length} shots`} tone="neutral" /> : null) : <WsTag label="2 av 68" tone="neutral" />}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><WsTag label={selShot ? selShot[0] : (isRealP ? 'Shot' : 'Kritisk')} tone={selShot ? selShot[1] : (isRealP ? 'neutral' : 'red')} /><Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{selShot ? selShot[2] : (isRealP ? 'Velg et shot' : 'Brud inngang')}</Typography>{(selShot || !isRealP) && <WsTag label={selShot ? (selShot[3] || 'Shot') : 'Vielse'} tone="accent" />}</Stack>
          {selShot && <Typography sx={{ fontSize: 11.5, color: ws.textFaint, mb: 1, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>{wsIcon('Place', { fontSize: 13 })}{selShot[4] || '—'} · {selShot[5] || '—'}</Typography>}
          <WsImageGrid columns={1} ratio="4 / 3" addLabel="Last opp referanse" />
          {/* Beskrivelse/utstyr/samtale er demo-innhold uten ekte datakilde — vises kun i sample. */}
          {!isRealP && (<>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim, my: 1.25 }}>Bruden går ned midtgangen. Fokus på reaksjonene til brudgommen og gjestene.</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>UTSTYR & INNSTILLINGER</Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
              {['Foto: 85mm f/1.4', '4K 25fps', '50mm', 'Gimbal'].map((x) => <WsTag key={x} label={x} tone="neutral" />)}
            </Stack>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>SAMTALE</Typography>
            <Stack spacing={1.25} sx={{ mb: 1 }}>
              {SAMTALE.map((m, i) => (
                <Stack key={i} direction="row" spacing={1}>
                  <Avatar sx={{ width: 24, height: 24, fontSize: 10 }}>{m.who[0]}</Avatar>
                  <Box sx={{ flex: 1 }}><Stack direction="row" spacing={1} alignItems="baseline"><Typography sx={{ fontSize: 12, fontWeight: 700 }}>{m.who}</Typography><Typography sx={{ fontSize: 10, color: ws.textFaint }}>{m.t}</Typography></Stack><Typography sx={{ fontSize: 12, color: ws.textDim }}>{m.msg}</Typography></Box>
                </Stack>
              ))}
            </Stack>
          </>)}
          {isRealP && <Box sx={{ my: 1.25 }} />}
          <TextField fullWidth size="small" placeholder="Skriv en kommentar…" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendComment(); }} disabled={!projectId || projectId === 'sample'} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
        </WsCard>
      </Box>
    </Stack>
  );
};

export default ShotlistTab;
