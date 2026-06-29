// @ts-nocheck
/**
 * SoundRoomTab — workspace-rommet for lyd (audio review).
 *
 * Gjenbruker HELE den eksisterende Audio Showcase-en («Universal Showcase»-
 * review: versjoner, tidsstemplede kommentarer, A/B-compare, AI-feedback,
 * deliverables, split-sheet). Audio Showcase har sitt eget prosjekt-begrep
 * (audio_review_projects); vi finn-eller-oppretter ett koblet til workspace-
 * prosjektet via /api/projects/:id/audio-room, og åpner så full-skjerm-
 * opplevelsen på /audio-review/:audioRoomId?ws=:projectId (med tilbake-lenke).
 */
import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, CircularProgress, TextField, Avatar, IconButton, Dialog, DialogContent, Divider } from '@mui/material';
import { useLocation } from 'wouter';
import GraphicEq from '@mui/icons-material/GraphicEq';
import OpenInFull from '@mui/icons-material/OpenInFull';
import GroupAdd from '@mui/icons-material/GroupAdd';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Check from '@mui/icons-material/Check';
import Download from '@mui/icons-material/Download';
import Close from '@mui/icons-material/Close';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag } from '../ui';

const fmtTime = (s: number) => { const n = Math.max(0, Math.floor(Number(s) || 0)); const m = Math.floor(n / 60); const sec = n % 60; return `${m}:${String(sec).padStart(2, '0')}`; };
const detectOS = (): 'Windows' | 'macOS' => { const p = ((navigator as any).userAgent + ' ' + (navigator as any).platform).toLowerCase(); if (p.includes('win')) return 'Windows'; return 'macOS'; };
const fmtMB = (b: number) => b ? `${(b / 1048576).toFixed(1)} MB` : '';

const ti = { '& .MuiOutlinedInput-root': { fontSize: 13, color: ws.text, bgcolor: ws.panel, '& fieldset': { borderColor: ws.borderSoft }, '&:hover fieldset': { borderColor: ws.accentBorder }, '&.Mui-focused fieldset': { borderColor: ws.accent } }, '& input::placeholder': { color: ws.textFaint, opacity: 1 } } as const;

const SoundRoomTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = projectId && projectId !== 'sample';
  const [, navigate] = useLocation();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ev, setEv] = useState<any | null>(null); // EaseVerse-tracks
  const [linking, setLinking] = useState<string | null>(null);
  const [bandMembers, setBandMembers] = useState<any[] | null>(null);
  const [invite, setInvite] = useState<{ name: string; role: string; instrument: string; email: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pt, setPt] = useState<any | null>(null); // Pro Tools companion-status
  const [ptCode, setPtCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [ptBusy, setPtBusy] = useState(false);
  const [ptDialog, setPtDialog] = useState(false);
  const [ptRelease, setPtRelease] = useState<any | null>(null);

  const loadRelease = () => { apiRequest(`/api/protools/companion/release`).then((r: any) => setPtRelease(r || null)).catch(() => {}); };
  const openPtDialog = () => { setPtDialog(true); if (!ptRelease) loadRelease(); if (!ptCode) makePtCode(); };

  const loadPt = () => {
    if (!isReal) return;
    const q = roomId ? `?audioRoomId=${encodeURIComponent(roomId)}` : '';
    apiRequest(`/api/protools/web/status${q}`).then((r: any) => setPt(r || null)).catch(() => {});
  };
  const makePtCode = async () => {
    if (ptBusy) return; setPtBusy(true);
    try { const r: any = await apiRequest(`/api/protools/pair/start`, { method: 'POST' }); if (r?.code) setPtCode({ code: r.code, expiresAt: Date.now() + (r.expiresInSeconds || 600) * 1000 }); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke lage paringskode'); }
    finally { setPtBusy(false); }
  };
  const unlinkPt = async () => {
    if (ptBusy || !window.confirm('Koble fra Pro Tools-companionen på denne maskinen?')) return; setPtBusy(true);
    try { await apiRequest(`/api/protools/web/unlink-device`, { method: 'POST' }); setPtCode(null); loadPt(); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke koble fra'); }
    finally { setPtBusy(false); }
  };

  const loadEv = () => { if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/easeverse-tracks`).then((r: any) => setEv(r || null)).catch(() => {}); };
  const loadMembers = () => { if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/audio-room/members`).then((r: any) => setBandMembers(r?.members || [])).catch(() => {}); };
  const copyInvite = (url: string) => { const full = url.startsWith('http') ? url : window.location.origin + url; navigator.clipboard?.writeText(full).then(() => { setCopied(url); setTimeout(() => setCopied(null), 1800); }).catch(() => {}); };
  const submitInvite = async () => {
    if (!invite?.name?.trim() || saving) return; setSaving(true);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/audio-room/members`, { method: 'POST', body: { name: invite.name.trim(), role: invite.role.trim() || 'Bidragsyter', instrument: invite.instrument.trim() || undefined, email: invite.email.trim() || undefined } });
      setInvite(null); loadMembers(); if (!roomId) { try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/audio-room`); setRoomId(r?.audioRoomId || null); } catch { /* */ } }
    } catch (e: any) { window.alert(e?.message === 'member_exists' ? 'Medlemmet finnes allerede' : (e?.message || 'Kunne ikke legge til')); }
    finally { setSaving(false); }
  };
  useEffect(() => {
    if (!isReal) { setLoading(false); return; }
    let stop = false;
    (async () => {
      try {
        const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/audio-room`);
        if (stop) return;
        const id = r?.audioRoomId; setRoomId(id);
        if (id) {
          try { const s: any = await apiRequest(`/api/audio-showcases/${id}`); if (!stop) setSummary(s); } catch { /* eier-gated/ny */ }
        }
      } catch (e: any) { if (!stop) setErr(e?.message || 'Kunne ikke åpne lydrommet'); }
      finally { if (!stop) setLoading(false); }
    })();
    loadEv();
    loadMembers();
    loadPt();
    const ptPoll = setInterval(loadPt, 7000);
    return () => { stop = true; clearInterval(ptPoll); };
  }, [projectId, isReal]);

  // Re-last companion-status når lydrommet er løst (for audioRoomId-scoping).
  useEffect(() => { if (roomId) loadPt(); }, [roomId]);

  const openRoom = () => { if (roomId) navigate(`/audio-review/${roomId}?ws=${encodeURIComponent(projectId)}`); };
  const linkTrack = async (trackId: string) => {
    if (linking) return; setLinking(trackId);
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/audio-room/link-easeverse`, { method: 'POST', body: { trackId } });
      if (r?.audioRoomId) {
        setRoomId(r.audioRoomId);
        try { const s: any = await apiRequest(`/api/audio-showcases/${r.audioRoomId}`); setSummary(s); } catch { /* */ }
        loadEv(); loadMembers();
        if (r.bandSynced > 0) window.alert(`${r.bandSynced} bandmedlem${r.bandSynced === 1 ? '' : 'mer'} fra EaseVerse lagt til i lydrommet med invitasjons-lenker.`);
      }
    }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke koble track'); }
    finally { setLinking(null); }
  };
  const evStatus: any = { recording: ['Opptak', ws.textDim], mixing: ['Miksing', ws.amber], mastering: ['Mastering', ws.blue], completed: ['Ferdig', ws.green] };

  const proj = summary?.project || {};
  const versions = summary?.versions || [];
  const members = summary?.members || [];
  const current = versions.find((v: any) => v.status === 'under_review') || versions[versions.length - 1] || null;
  const openComments = current?.comment_count ?? null;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;

  return (
    <Box sx={{ maxWidth: 920, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Sound Room</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Lyd-review for prosjektet — versjoner, tidsstemplede tilbakemeldinger, A/B-compare og leveranse. Samme «Universal Showcase»-rom klienten/bandet får.</Typography>
        </Box>
        {roomId && <Button variant="contained" startIcon={<OpenInFull sx={{ fontSize: 17 }} />} onClick={openRoom} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Åpne lydrommet</Button>}
      </Stack>

      {err && <WsCard sx={{ mb: 2, borderColor: ws.redSoft }}><Typography sx={{ fontSize: 13, color: ws.red }}>{err}</Typography></WsCard>}

      {/* Branded landings-kort */}
      <WsCard sx={{ mb: 2, cursor: roomId ? 'pointer' : 'default', '&:hover': roomId ? { borderColor: ws.accentBorder } : undefined }} onClick={openRoom}>
        <Stack direction="row" spacing={2.5} alignItems="center">
          <Box sx={{ width: 64, height: 64, borderRadius: 2, bgcolor: ws.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundImage: proj.cover_url ? `url(${proj.cover_url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            {!proj.cover_url && <GraphicEq sx={{ color: ws.accent, fontSize: 30 }} />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontSize: 16, fontWeight: 800 }} noWrap>{proj.title || 'Lydrom'}</Typography>
              {proj.status && <WsTag label={proj.status === 'under_review' ? 'Under review' : proj.status === 'approved' ? 'Godkjent' : proj.status} tone={proj.status === 'approved' ? 'green' : proj.status === 'under_review' ? 'amber' : 'neutral'} />}
            </Stack>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim, mt: 0.25 }}>
              {proj.band_name ? `${proj.band_name} · ` : ''}{versions.length} versjon{versions.length === 1 ? '' : 'er'}{current ? ` · siste: ${current.version_label || `Mix V${current.version_number}`}` : ''}{members.length ? ` · ${members.length} medlem${members.length === 1 ? '' : 'mer'}` : ''}
            </Typography>
          </Box>
          <Button variant="text" onClick={(e) => { e.stopPropagation(); openRoom(); }} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, flexShrink: 0 }}>Åpne →</Button>
        </Stack>
      </WsCard>

      {/* Versjons-strip (preview, full visning inne i rommet) */}
      {versions.length > 0 && (
        <WsCard sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.25 }}>Versjoner</Typography>
          <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 0.5 }}>
            {versions.map((v: any) => (
              <Box key={v.id} onClick={openRoom} sx={{ minWidth: 150, p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${v.status === 'under_review' ? ws.accentBorder : ws.borderSoft}`, cursor: 'pointer', flexShrink: 0 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{v.version_label || `Mix V${v.version_number}`}</Typography>
                  {v.status === 'under_review' && <WsTag label="Nå" tone="amber" />}
                  {v.status === 'approved' && <WsTag label="✓" tone="green" />}
                </Stack>
                <Typography sx={{ fontSize: 10.5, color: ws.textFaint, mt: 0.5 }} noWrap>{v.file_name || ''}</Typography>
              </Box>
            ))}
          </Stack>
        </WsCard>
      )}

      {versions.length === 0 && !err && (
        <WsCard sx={{ bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>
          <Typography sx={{ fontSize: 13, color: ws.text }}>Lydrommet er klart. Åpne det og last opp første mix/master-versjon — så får band/klient tidsstemplet review med versjonering og godkjenning.</Typography>
          <Button variant="contained" onClick={openRoom} sx={{ mt: 1.5, bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Åpne lydrommet</Button>
        </WsCard>
      )}

      {/* Band-roster — medlemmer (auto-synket fra EaseVerse-collaborators) + invitér */}
      <WsCard sx={{ mt: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
          <GroupAdd sx={{ fontSize: 18, color: ws.accent }} />
          <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Band & bidragsytere</Typography>
          <Box sx={{ flex: 1 }} />
          {(bandMembers?.length || 0) > 0 && <WsTag label={`${bandMembers!.length}`} tone="neutral" />}
          <Button size="small" variant="outlined" onClick={() => setInvite(invite ? null : { name: '', role: '', instrument: '', email: '' })} sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600 }}>{invite ? 'Avbryt' : '+ Inviter'}</Button>
        </Stack>

        {invite && (
          <Box sx={{ p: 1.5, mb: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.accentBorder}` }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField size="small" placeholder="Navn *" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} fullWidth sx={ti} />
              <TextField size="small" placeholder="Instrument/rolle" value={invite.instrument} onChange={(e) => setInvite({ ...invite, instrument: e.target.value })} fullWidth sx={ti} />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField size="small" placeholder="E-post (valgfritt)" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} fullWidth sx={ti} />
              <Button variant="contained" disabled={!invite.name.trim() || saving} onClick={submitInvite} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, flexShrink: 0, '&:hover': { bgcolor: ws.accentHover } }}>{saving ? 'Legger til…' : 'Legg til'}</Button>
            </Stack>
          </Box>
        )}

        {(bandMembers?.length || 0) === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Ingen bandmedlemmer ennå. Koble en EaseVerse-låt under, så hentes bidragsyterne inn automatisk med invitasjons-lenker — eller legg til manuelt med «+ Inviter».</Typography>
        ) : (
          <Stack spacing={0.75}>
            {bandMembers!.map((m: any) => (
              <Stack key={m.id} direction="row" alignItems="center" spacing={1.25} sx={{ p: 1, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                <Avatar sx={{ width: 30, height: 30, fontSize: 12, fontWeight: 700, bgcolor: m.avatarColor || ws.accent, color: '#fff' }}>{String(m.name || '?').charAt(0).toUpperCase()}</Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }} noWrap>{m.name}</Typography>
                    {m.isOwner ? <WsTag label="Eier" tone="green" /> : m.status === 'accepted' ? <WsTag label="Aktiv" tone="green" /> : <WsTag label="Invitert" tone="amber" />}
                  </Stack>
                  <Typography sx={{ fontSize: 10.5, color: ws.textFaint }} noWrap>{m.instrument || m.role || 'Bidragsyter'}{m.email ? ` · ${m.email}` : ''}</Typography>
                </Box>
                {m.inviteUrl && (
                  <IconButton size="small" onClick={() => copyInvite(m.inviteUrl)} title="Kopier invitasjons-lenke" sx={{ color: copied === m.inviteUrl ? ws.green : ws.textDim }}>
                    {copied === m.inviteUrl ? <Check sx={{ fontSize: 16 }} /> : <ContentCopy sx={{ fontSize: 15 }} />}
                  </IconButton>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </WsCard>

      {/* Pro Tools Companion — native desktop-agent som synker markører + bounces hit */}
      <WsCard sx={{ mt: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
          <Typography sx={{ fontSize: 15 }}>🎛️</Typography>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Pro Tools Companion</Typography>
          <Box sx={{ flex: 1 }} />
          {pt?.paired ? <WsTag label="Tilkoblet" tone="green" /> : <WsTag label="Ikke koblet" tone="neutral" />}
          <Button size="small" startIcon={<Download sx={{ fontSize: 15 }} />} onClick={openPtDialog} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, minWidth: 0 }}>Last ned appen</Button>
          {pt?.paired && <Button size="small" onClick={unlinkPt} disabled={ptBusy} sx={{ color: ws.textDim, textTransform: 'none', fontWeight: 600, minWidth: 0 }}>Koble fra</Button>}
        </Stack>

        {!pt?.paired ? (
          <Box>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim, mb: 1.25 }}>
              Last ned companion-appen og kjør den ved siden av Pro Tools, så havner markører («Export Session Info as Text») som review-seksjoner og bounces som nye versjoner — automatisk i dette lydrommet.
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="contained" startIcon={<Download sx={{ fontSize: 17 }} />} onClick={openPtDialog} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Last ned & koble til</Button>
              <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>macOS · Windows</Typography>
            </Stack>
            {ptCode && (
              <Box sx={{ mt: 1.5, p: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}`, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 11, color: ws.textDim, mb: 0.5 }}>Paringskode for companion-appen:</Typography>
                <Typography sx={{ fontSize: 26, fontWeight: 800, letterSpacing: 7, color: ws.accent, fontVariantNumeric: 'tabular-nums' }}>{ptCode.code}</Typography>
                <Typography sx={{ fontSize: 11, color: ws.textFaint, mt: 0.5 }}>Utløper om {Math.max(0, Math.round((ptCode.expiresAt - Date.now()) / 1000))} s · virker én gang</Typography>
              </Box>
            )}
          </Box>
        ) : (
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {pt?.session?.name && <WsTag label={pt.session.name} tone="neutral" />}
              {pt?.playhead?.timecode && <WsTag label={`▶ ${pt.playhead.timecode}`} tone="amber" />}
              {(pt?.markers?.length || 0) > 0 && <WsTag label={`${pt.markers.length} markører`} tone="green" />}
            </Stack>

            {(pt?.markers?.length || 0) > 0 && (
              <Box>
                <Typography sx={{ fontSize: 11, color: ws.textFaint, mb: 0.5 }}>Markører fra Pro Tools</Typography>
                <Stack direction="row" spacing={0.75} sx={{ overflowX: 'auto', pb: 0.5 }}>
                  {pt.markers.slice(0, 8).map((m: any, i: number) => (
                    <Box key={i} sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}`, flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700 }} noWrap>{m.name}</Typography>
                      <Typography sx={{ fontSize: 9.5, color: ws.textFaint }}>{fmtTime(m.start_seconds)}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {(pt?.bounces?.length || 0) > 0 && (
              <Box>
                <Typography sx={{ fontSize: 11, color: ws.textFaint, mb: 0.5 }}>Siste bounces</Typography>
                <Stack spacing={0.5}>
                  {pt.bounces.slice(0, 4).map((b: any) => (
                    <Stack key={b.id} direction="row" alignItems="center" spacing={1} sx={{ p: 0.75, borderRadius: 1, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                      <Typography sx={{ fontSize: 13 }}>🎚️</Typography>
                      <Typography sx={{ fontSize: 12, flex: 1, minWidth: 0 }} noWrap>{b.file_name || 'Bounce'}</Typography>
                      {b.review_version_id && <WsTag label="→ versjon" tone="green" />}
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {!pt?.session && <Typography sx={{ fontSize: 12, color: ws.textDim }}>Companionen er koblet til. Sett opp en sesjon i appen og start overvåking, så dukker markører og bounces opp her.</Typography>}
          </Stack>
        )}
      </WsCard>

      {/* EaseVerse-tracks — koble en låt fra EaseVerse inn i Sound Room (toveis-synk) */}
      <WsCard sx={{ mt: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
          <Typography sx={{ fontSize: 14 }}>🎵</Typography>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>EaseVerse-tracks</Typography>
          <Box sx={{ flex: 1 }} />
          {ev?.linkedTrackId && <WsTag label="Koblet" tone="green" />}
        </Stack>
        {(ev?.tracks || []).length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Ingen EaseVerse-låter funnet. Spill inn i EaseVerse-appen, så kan du koble en track hit for tekst-synk, takes (vokalopptak), DAW-markører og status-synk begge veier.</Typography>
        ) : (
          <Stack spacing={1}>
            {ev.tracks.map((t: any) => {
              const st = evStatus[t.status] || [t.status || '—', ws.textFaint];
              return (
                <Stack key={t.id} direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${t.linked ? ws.accentBorder : ws.borderSoft}` }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }} noWrap>{t.title || 'Uten tittel'}</Typography>
                      <Box sx={{ px: 0.75, py: 0.15, borderRadius: 1, fontSize: 9.5, fontWeight: 700, color: st[1], bgcolor: 'rgba(255,255,255,0.06)' }}>{st[0]}</Box>
                      {t.linked && <WsTag label="I dette rommet" tone="green" />}
                    </Stack>
                    <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{t.artist ? `${t.artist} · ` : ''}{t.bpm ? `${t.bpm} BPM · ` : ''}{t.key || ''}{t.hasReview && !t.linked ? ' · har review' : ''}</Typography>
                  </Box>
                  {t.linked
                    ? <Button size="small" variant="contained" onClick={openRoom} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Åpne</Button>
                    : <Button size="small" variant="outlined" disabled={linking === t.id} onClick={() => linkTrack(t.id)} sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600 }}>{linking === t.id ? 'Kobler…' : 'Koble til Sound Room'}</Button>}
                </Stack>
              );
            })}
          </Stack>
        )}
      </WsCard>

      {/* Nedlastings-/guide-dialog for Pro Tools Companion */}
      <Dialog open={ptDialog} onClose={() => setPtDialog(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, borderRadius: 3, border: `1px solid ${ws.borderSoft}` } }}>
        <DialogContent sx={{ p: 0 }}>
          {/* Hero med ikon — gjør det tydelig at dette er en app du laster ned */}
          <Box sx={{ p: 3, pb: 2.5, background: `linear-gradient(160deg, ${ws.accentSoft} 0%, transparent 70%)`, position: 'relative' }}>
            <IconButton onClick={() => setPtDialog(false)} sx={{ position: 'absolute', top: 10, right: 10, color: ws.textDim }}><Close sx={{ fontSize: 18 }} /></IconButton>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box component="img" src={ptRelease?.icon || '/protools-companion-icon.png'} alt="Pro Tools Companion"
                sx={{ width: 72, height: 72, borderRadius: 2.5, boxShadow: '0 6px 20px rgba(0,0,0,0.4)', flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 800 }}>Pro Tools Companion</Typography>
                <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Native app · macOS &amp; Windows{ptRelease?.version ? ` · v${ptRelease.version}` : ''}</Typography>
              </Box>
            </Stack>
          </Box>

          <Box sx={{ px: 3, pb: 3 }}>
            <Typography sx={{ fontSize: 13, color: ws.text, mb: 2, lineHeight: 1.55 }}>
              En liten app som kjører ved siden av Pro Tools på maskinen din. Den sender <b>markører</b> og <b>ferdige mikser (bounces)</b> rett inn i dette lydrommet — så bandet/klienten ser seksjoner og nye versjoner automatisk, uten manuell opplasting.
            </Typography>

            {/* Last ned pr plattform */}
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textDim, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>Last ned</Typography>
            <Stack spacing={1} sx={{ mb: 2 }}>
              {['macOS', 'Windows'].map((osName) => {
                const dls = (ptRelease?.downloads || []).filter((d: any) => d.os === osName);
                const isMine = detectOS() === osName;
                if (!dls.length) {
                  return (
                    <Box key={osName} sx={{ p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px dashed ${ws.borderSoft}`, opacity: 0.75 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{osName} {osName === 'Windows' ? '🪟' : ''}<Box component="span" sx={{ color: ws.textFaint, fontWeight: 400 }}> — bygges, kommer snart</Box></Typography>
                    </Box>
                  );
                }
                return dls.map((d: any, i: number) => (
                  <Button key={osName + i} variant={isMine ? 'contained' : 'outlined'} startIcon={<Download sx={{ fontSize: 17 }} />}
                    href={d.url} target="_blank" rel="noopener" fullWidth
                    sx={isMine
                      ? { bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, justifyContent: 'flex-start', '&:hover': { bgcolor: ws.accentHover } }
                      : { color: ws.text, borderColor: ws.borderSoft, textTransform: 'none', fontWeight: 600, justifyContent: 'flex-start' }}>
                    {osName} · {d.arch} {d.sizeBytes ? `(${fmtMB(d.sizeBytes)})` : ''}{isMine ? '  — anbefalt for deg' : ''}
                  </Button>
                ));
              })}
            </Stack>
            {(ptRelease?.downloads || []).some((d: any) => d.signed === false) && (
              <Typography sx={{ fontSize: 11, color: ws.textFaint, mb: 2 }}>
                Første gang: høyreklikk appen → <b>Åpne</b> (macOS) / «Kjør likevel» (Windows) — bygget er ennå ikke signert.
              </Typography>
            )}

            <Divider sx={{ borderColor: ws.borderSoft, my: 2 }} />

            {/* Slik fungerer det */}
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textDim, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.25 }}>Slik fungerer det</Typography>
            <Stack spacing={1.25} sx={{ mb: 2 }}>
              {[
                ['Installer & åpne appen', 'Last ned over, installer, og start companion-appen på samme maskin som Pro Tools.'],
                ['Skriv inn paringskoden', `Bruk koden under (eller lag en ny). Den kobler appen til kontoen din.`],
                ['Velg låt + mapper', 'I appen: velg EaseVerse-låten (dette rommet), «Session Info»-fila og «Bounced Files»-mappa.'],
                ['Jobb som vanlig i Pro Tools', 'File → Export → Session Info as Text for markører, og bounce som vanlig. Appen sender alt hit automatisk.'],
              ].map(([t, d], i) => (
                <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                  <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: ws.accentSoft, color: ws.accent, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.2 }}>{i + 1}</Box>
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t}</Typography>
                    <Typography sx={{ fontSize: 12, color: ws.textDim, lineHeight: 1.5 }}>{d}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>

            {/* Paringskode */}
            <Box sx={{ p: 1.75, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}`, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 11, color: ws.textDim, mb: 0.5 }}>Paringskode</Typography>
              {ptCode ? (
                <>
                  <Typography sx={{ fontSize: 30, fontWeight: 800, letterSpacing: 8, color: ws.accent, fontVariantNumeric: 'tabular-nums' }}>{ptCode.code}</Typography>
                  <Typography sx={{ fontSize: 11, color: ws.textFaint, mt: 0.5 }}>Utløper om {Math.max(0, Math.round((ptCode.expiresAt - Date.now()) / 1000))} s · virker én gang</Typography>
                </>
              ) : (
                <Button variant="text" onClick={makePtCode} disabled={ptBusy} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700 }}>{ptBusy ? 'Lager kode…' : 'Lag paringskode'}</Button>
              )}
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default SoundRoomTab;
