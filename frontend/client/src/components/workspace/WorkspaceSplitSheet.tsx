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

  const onWizardSave = async (data: any) => {
    const entry = { id: `local-${Date.now()}`, projectName: data.projectName, projectAmount: data.projectAmount, createdAt: new Date().toISOString(), model: data.model, participants: data.participants };
    persist([entry, ...entries]);
    setWizard(false);
    setTab('stats');
    // Varig lagring på prosjektet (best-effort) — samme backend som dashboardet.
    try {
      await apiRequest('/api/split-sheets', {
        method: 'POST',
        body: {
          project_id: projectId,
          title: data.projectName || 'Split sheet',
          description: data.projectAmount ? `Beløp: ${data.projectAmount} kr` : null,
          contributors: (data.participants || []).map((p: any) => ({ name: p.name, email: p.email, role: p.roleLabel || p.role, percentage: p.sharePct })),
        },
      });
    } catch { /* */ }
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
