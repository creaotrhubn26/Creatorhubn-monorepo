// @ts-nocheck
/**
 * WorkspaceSplitSheet — dashboardets split-sheet-modal, brakt inn i workspacet i
 * ws-design og scopet til prosjektet. Gjenbruker de SAMME komponentene som
 * UniversalDashboard: SplitSheetEarningsOverview (Statistikk), TeamMembersDirectory
 * (Team) og SplitSheetRoleWizard (rolle-basert opprettelse). Profesjons-bevisst —
 * musikkprodusent får royalty/master/komposisjon-roller, foto/video sine.
 *
 * Data: prosjekt-scopet localStorage (`split-sheet-entries-<projectId>`, som
 * dashboardets flyt) + POST til /api/split-sheets (project_id) for varig lagring.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Button, Dialog, DialogContent, IconButton, Tabs as MuiTabs, Tab, Avatar } from '@mui/material';
import AccountBalance from '@mui/icons-material/AccountBalance';
import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import { apiRequest } from '@/lib/queryClient';
import SplitSheetEarningsOverview from '../universal/split-sheets/SplitSheetEarningsOverview';
import TeamMembersDirectory from '../universal/split-sheets/TeamMembersDirectory';
import SplitSheetRoleWizard from '../universal/split-sheets/SplitSheetRoleWizard';
import { ws } from './workspaceTheme';
import { WsCard, WsTag } from './ui';

const isMusic = (p?: string) => ['music_producer', 'music-producer', 'musician', 'music'].includes(String(p || '').toLowerCase());
// split_sheet_contributors.role har CHECK-constraint (kun disse slug-ene). Wizardens
// roleId (f.eks. 'photo', 'second-shooter') og norske labels bryter den → map til
// gyldig slug (ellers 'collaborator'); den lesbare rollen lagres i custom_fields.
const ROLE_SLUGS = new Set(['producer', 'artist', 'songwriter', 'composer', 'lyricist', 'vocalist', 'instrumentalist', 'mix_engineer', 'mastering_engineer', 'arranger', 'featured_artist', 'backing_vocalist', 'session_musician', 'collaborator', 'publisher', 'label', 'other']);
const toRoleSlug = (roleId?: string) => (roleId && ROLE_SLUGS.has(roleId) ? roleId : 'collaborator');

const WorkspaceSplitSheet: React.FC<{ projectId: string; profession?: string; userId?: string; projectName?: string }> = ({ projectId, profession, userId, projectName }) => {
  const music = isMusic(profession);
  const storeKey = `split-sheet-entries-${projectId}`;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'stats' | 'team'>('stats');
  const [wizard, setWizard] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    try { const raw = localStorage.getItem(storeKey); setEntries(raw ? JSON.parse(raw) : []); } catch { setEntries([]); }
  }, [storeKey]);

  const persist = (next: any[]) => { setEntries(next); try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* */ } };

  const [share, setShare] = useState<any | null>(null); // { shareUrl, accessCode, sheetId }
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<any | null>(null); // signeringsstatus + audit-logg

  const loadStatus = async (sheetId: string) => {
    if (!sheetId) return;
    try { const r: any = await apiRequest(`/api/split-sheets/${sheetId}/signing-status`); setStatus(r); } catch { setStatus(null); }
  };
  const evLabel = (t: string) => ({ signing_enabled: 'Signering aktivert', viewed: 'Åpnet avtalen', signed: 'Signerte', completed: 'Alle signert ✓' } as any)[t] || t;
  const evTime = (iso: string) => { try { return new Date(iso).toLocaleString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

  const onWizardSave = async (data: any) => {
    const entry: any = { id: `local-${Date.now()}`, projectName: data.projectName, projectAmount: data.projectAmount, createdAt: new Date().toISOString(), model: data.model, participants: data.participants };
    // Varig lagring på prosjektet + slå på signering → delingslenke til bandet.
    try {
      const resp: any = await apiRequest('/api/split-sheets', {
        method: 'POST',
        body: {
          project_id: projectId,
          title: data.projectName || 'Split sheet',
          description: data.projectAmount ? `Beløp: ${data.projectAmount} kr` : null,
          contributors: (data.participants || []).map((p: any) => ({ name: p.name, email: p.email, role: toRoleSlug(p.roleId), percentage: p.sharePct, custom_fields: { roleLabel: p.roleLabel || p.role || '' } })),
        },
      });
      const sheetId = resp?.data?.id;
      if (sheetId) {
        entry.sheetId = sheetId;
        try {
          const en: any = await apiRequest(`/api/split-sheets/${sheetId}/enable-signing`, { method: 'POST', body: {} });
          entry.accessCode = en?.accessCode; entry.shareUrl = en?.shareUrl;
          setShare({ shareUrl: en?.shareUrl, accessCode: en?.accessCode, sheetId });
        } catch { /* */ }
      }
    } catch { /* */ }
    persist([entry, ...entries]);
    setWizard(false);
    setTab('stats');
  };

  const copyLink = (url: string) => { try { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* */ } };
  const [sending, setSending] = useState(false);
  const sendInvites = async (sheetId: string) => {
    if (!sheetId || sending) return; setSending(true);
    try { const r: any = await apiRequest(`/api/split-sheets/${encodeURIComponent(sheetId)}/send-invites`, { method: 'POST', body: {} }); window.alert(`Signeringslenken er sendt til ${r?.sent || 0} av ${r?.total || 0} bidragsytere med e-post.`); loadStatus(sheetId); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke sende. Sjekk at bidragsyterne har e-post.'); }
    finally { setSending(false); }
  };

  const totalKr = useMemo(() => entries.reduce((s, e) => s + (Number(e.projectAmount) || 0), 0), [entries]);

  return (
    <WsCard>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: ws.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AccountBalance sx={{ color: ws.accent, fontSize: 21 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Split sheet — {music ? 'royalty-fordeling' : 'honorar-fordeling'}</Typography>
          <Typography sx={{ fontSize: 12, color: ws.textDim }}>
            {entries.length ? `${entries.length} fordeling${entries.length === 1 ? '' : 'er'}${totalKr ? ` · ${Math.round(totalKr).toLocaleString('nb-NO')} kr` : ''}` : (music ? 'Royalty/master/komposisjon per bidragsyter.' : 'Hvem får hvor stor andel av honoraret.')}
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setOpen(true)}
          sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, flexShrink: 0, '&:hover': { bgcolor: ws.accentHover } }}>
          Åpne split sheet
        </Button>
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth
        PaperProps={{ sx: { borderRadius: `${ws.radius}px`, bgcolor: ws.bg, backgroundImage: 'none', color: ws.text, border: `1px solid ${ws.border}`, maxHeight: '92vh' } }}>
        {/* Header — ws-tema */}
        <Box sx={{ px: 3, pt: 3, pb: 2, background: `linear-gradient(135deg, ${ws.accentSoft}, transparent)`, borderBottom: `1px solid ${ws.borderSoft}`, display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: ws.accentSoft, color: ws.accent }}><AccountBalance /></Avatar>
            <Box>
              <Typography variant="overline" sx={{ color: ws.accent, letterSpacing: '0.18em' }}>Split Sheets</Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{music ? 'Royalty-fordeling i team' : 'Honorar-fordeling i team'}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button startIcon={<Add />} onClick={() => setWizard(true)}
              sx={{ borderRadius: '999px', px: 2.5, py: 1, bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: ws.accentHover } }}>
              Nytt split sheet
            </Button>
            <IconButton onClick={() => setOpen(false)} sx={{ color: ws.textDim }}><Close /></IconButton>
          </Stack>
        </Box>

        <Box sx={{ px: 3, pt: 2, borderBottom: `1px solid ${ws.borderSoft}` }}>
          <MuiTabs value={tab} onChange={(_, v) => setTab(v)}
            sx={{ minHeight: 40, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, color: ws.textDim, minHeight: 40, py: 0.5, '&.Mui-selected': { color: ws.accent } }, '& .MuiTabs-indicator': { backgroundColor: ws.accent, height: 3, borderRadius: 2 } }}>
            <Tab value="stats" label="Statistikk & honorar" />
            <Tab value="team" label="Team-direktorat" />
          </MuiTabs>
        </Box>

        <DialogContent dividers sx={{ p: { xs: 2, md: 3 }, borderColor: ws.borderSoft }}>
          {/* Delingslenke til bandet — de åpner den, ser fordelingen og signerer godkjennelse */}
          {tab === 'stats' && (share?.shareUrl || entries.find((e: any) => e.shareUrl)) && (() => {
            const link = share?.shareUrl || entries.find((e: any) => e.shareUrl)?.shareUrl;
            return (
              <Box sx={{ mb: 2, p: 1.75, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.5 }}>🔗 Del til signering</Typography>
                <Typography sx={{ fontSize: 12, color: ws.textDim, mb: 1 }}>Send lenken til bandet/bidragsyterne. De ser hele fordelingen og signerer godkjennelse — uten konto. Har de CreatorHub-konto med samme e-post, finner de avtalen igjen under «Mine avtaler».</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1, px: 1.25, py: 0.9, borderRadius: 1, bgcolor: ws.panel, border: `1px solid ${ws.borderSoft}`, fontSize: 12, color: ws.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</Box>
                  <Button size="small" variant="contained" disabled={sending} onClick={() => sendInvites(share?.sheetId || entries.find((e: any) => e.shareUrl)?.sheetId)}
                    sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap', '&:hover': { bgcolor: ws.accentHover } }}>{sending ? 'Sender…' : 'Send til bandet'}</Button>
                  <Button size="small" onClick={() => copyLink(link)} sx={{ color: copied ? ws.green : ws.accent, textTransform: 'none', fontWeight: 700, flexShrink: 0 }}>{copied ? 'Kopiert ✓' : 'Kopier'}</Button>
                  <Button size="small" onClick={() => loadStatus(share?.sheetId || entries.find((e: any) => e.shareUrl)?.sheetId)} sx={{ color: ws.textDim, textTransform: 'none', fontWeight: 600, flexShrink: 0 }}>Status & logg</Button>
                </Stack>

                {status && (
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${ws.borderSoft}` }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.75 }}>Signeringsstatus — {status.signedCount}/{status.total} signert</Typography>
                    <Stack spacing={0.4} sx={{ mb: 1 }}>
                      {(status.contributors || []).map((c: any) => (
                        <Stack key={c.id} direction="row" alignItems="center" spacing={1}>
                          <Typography sx={{ fontSize: 12, flex: 1 }} noWrap>{c.name}{c.role ? ` · ${c.role}` : ''} · {c.percentage}%</Typography>
                          {c.signed ? <WsTag label="Signert" tone="green" /> : <WsTag label="Venter" tone="amber" />}
                        </Stack>
                      ))}
                    </Stack>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>Audit-logg</Typography>
                    <Stack spacing={0.25}>
                      {(status.events || []).length === 0 ? <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>Ingen hendelser ennå.</Typography> :
                        (status.events || []).slice(0, 20).map((e: any, i: number) => (
                          <Typography key={i} sx={{ fontSize: 11, color: ws.textDim }}>
                            <b style={{ color: ws.textFaint }}>{evTime(e.at)}</b> · {evLabel(e.type)}{e.actor ? ` — ${e.actor}` : ''}{e.method ? ` (${e.method === 'drawn' ? 'tegnet' : 'skrevet'})` : ''}{e.ip ? ` · ${e.ip}` : ''}
                          </Typography>
                        ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            );
          })()}
          {tab === 'stats' && (
            entries.length === 0 ? (
              <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
                <AccountBalance sx={{ fontSize: 40, color: ws.textFaint }} />
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Ingen fordeling ennå</Typography>
                <Typography sx={{ fontSize: 12.5, color: ws.textDim, textAlign: 'center', maxWidth: 420 }}>Lag den første {music ? 'royalty-fordelingen' : 'honorar-fordelingen'} for prosjektet med rolle-veiviseren.</Typography>
                <Button variant="contained" startIcon={<Add />} onClick={() => setWizard(true)} sx={{ mt: 1, bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Nytt split sheet</Button>
              </Stack>
            ) : (
              <SplitSheetEarningsOverview sheets={entries} />
            )
          )}
          {tab === 'team' && <TeamMembersDirectory profession={profession} />}
        </DialogContent>
      </Dialog>

      {/* Rolle-veiviser — samme som dashboardet, profesjons-bevisst */}
      <SplitSheetRoleWizard
        open={wizard}
        onClose={() => setWizard(false)}
        profession={profession}
        projectName={projectName || ''}
        onSave={onWizardSave}
      />
    </WsCard>
  );
};

export default WorkspaceSplitSheet;
