import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  Close,
  CompareArrows,
  DoneAll,
  Inventory2Outlined,
  RadioButtonUnchecked,
  Refresh,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

const ACCENT = '#FF6B35';
const TEXT = '#F5F2EA';
const MUTED = 'rgba(245,242,234,0.62)';
const BORDER = 'rgba(255,255,255,0.1)';
const PANEL = '#131316';

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  versions: any[];
  members: any[];
  currentVersionId?: string;
  onMembersChanged?: () => void | Promise<void>;
};

const stageLabels: Record<string, string> = { mix: 'Mix', master: 'Master', delivery: 'Levering' };
const statusLabels: Record<string, string> = {
  requested: 'Venter', approved: 'Godkjent', changes_requested: 'Endringer ønsket', revoked: 'Trukket',
};

function formatDate(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function SoundRoomOperatingPanel({
  open,
  onClose,
  projectId,
  projectTitle,
  versions,
  members,
  currentVersionId,
  onMembersChanged,
}: Props) {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [decisionTitle, setDecisionTitle] = useState('Hvilken versjon fungerer best?');
  const [decisionBlind, setDecisionBlind] = useState(true);
  const [decisionLevelMatched, setDecisionLevelMatched] = useState(true);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [signoffStage, setSignoffStage] = useState<'mix' | 'master' | 'delivery'>('mix');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      setData(await apiRequest(`/api/sound-room/projects/${projectId}`));
    } catch (loadError: any) {
      setError(loadError?.message || 'Kunne ikke laste produsentverktøyene.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  useEffect(() => {
    if (!open) return;
    setSelectedVersions([...versions].sort((a, b) => Number(b.version_number || 0) - Number(a.version_number || 0)).slice(0, 2).map((version) => String(version.id)));
  }, [open, versions]);

  const run = async (key: string, action: () => Promise<void>, message: string) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(message);
      await load();
    } catch (actionError: any) {
      setError(actionError?.message || 'Handlingen kunne ikke fullføres.');
    } finally {
      setBusy('');
    }
  };

  const latestBrief = data?.briefs?.[0];
  const eligibleMembers = useMemo(() => members.filter((member) => !member.is_owner && member.can_approve), [members]);
  const latestDecision = data?.decisions?.[0];

  const toggleApprover = async (member: any, canApprove: boolean) => {
    await run(`member:${member.id}`, async () => {
      await apiRequest(`/api/sound-room/projects/${projectId}/members/${member.id}`, {
        method: 'PATCH', body: { canApprove },
      });
      await onMembersChanged?.();
    }, canApprove ? `${member.name} kan nå godkjenne.` : `${member.name} er fjernet fra godkjenningskjeden.`);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ 'data-testid': 'sound-room-operating-panel', sx: { bgcolor: `${PANEL} !important`, background: `${PANEL} !important`, color: TEXT, minHeight: { md: 660 }, backgroundImage: 'none !important', border: `1px solid ${BORDER}`, boxShadow: '0 24px 80px rgba(0,0,0,.72)' } }}>
      <DialogTitle sx={{ pb: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" sx={{ color: ACCENT, fontWeight: 850, letterSpacing: 1.4 }}>PRODUSENTVERKTØY</Typography>
            <Typography variant="h6" sx={{ fontWeight: 850 }}>{projectTitle}</Typography>
          </Box>
          <Tooltip title="Oppdater"><IconButton onClick={() => void load()} sx={{ color: MUTED }}><Refresh /></IconButton></Tooltip>
          <IconButton onClick={onClose} sx={{ color: MUTED }} aria-label="Lukk"><Close /></IconButton>
        </Stack>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ mt: 1, '& .MuiTab-root': { textTransform: 'none', fontWeight: 750 } }}>
          <Tab label="Revisjonsbrief" />
          <Tab label="Decision Room" />
          <Tab label="Sign-off" />
          <Tab label="Levering" />
          <Tab label="Aktivitet" />
        </Tabs>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: BORDER }}>
        {loading && !data ? <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}><CircularProgress sx={{ color: ACCENT }} /></Box> : (
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {notice && <Alert severity="success">{notice}</Alert>}

            {tab === 0 && (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 850 }}>Én brief fra all feedback</Typography>
                    <Typography variant="body2" sx={{ color: MUTED }}>Tidskoder, konflikter og åpne innspill samles til en arbeidsklar revisjonsliste.</Typography>
                  </Box>
                  <Button
                    data-testid="generate-revision-brief"
                    variant="contained"
                    startIcon={busy === 'brief' ? <CircularProgress size={16} /> : <AutoAwesome />}
                    disabled={Boolean(busy) || versions.length === 0}
                    onClick={() => void run('brief', async () => {
                      await apiRequest(`/api/sound-room/projects/${projectId}/briefs`, { method: 'POST', body: { versionId: currentVersionId, useAi: true } });
                    }, 'En ny revisjonsbrief er klar.')}
                    sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 850, textTransform: 'none', borderRadius: 999 }}
                  >
                    Generer ny brief
                  </Button>
                </Stack>
                {latestBrief ? (
                  <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: 3, p: 2 }} data-testid="revision-brief">
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Typography sx={{ fontWeight: 850, flex: 1 }}>{latestBrief.title}</Typography>
                      <Chip size="small" label={latestBrief.generation_mode === 'ai' ? 'AI-assistert' : 'Smart oppsummering'} sx={{ color: ACCENT }} />
                    </Stack>
                    <Typography variant="body2" sx={{ color: MUTED, mb: 2 }}>{latestBrief.summary}</Typography>
                    <Stack spacing={1}>
                      {(latestBrief.priorities || []).map((priority: any, index: number) => (
                        <Stack key={`${priority.title}-${index}`} direction="row" spacing={1.25} alignItems="flex-start" sx={{ p: 1.25, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.035)' }}>
                          <Chip size="small" label={index + 1} sx={{ bgcolor: 'rgba(255,107,53,.16)', color: ACCENT, fontWeight: 900 }} />
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{priority.title}</Typography>
                            <Typography variant="body2" sx={{ color: MUTED }}>{priority.detail}</Typography>
                          </Box>
                        </Stack>
                      ))}
                    </Stack>
                    {(latestBrief.conflicts || []).length > 0 && <Alert severity="warning" sx={{ mt: 2 }}>{latestBrief.conflicts.join(' ')}</Alert>}
                  </Box>
                ) : (
                  <Box sx={{ p: 4, textAlign: 'center', border: `1px dashed ${BORDER}`, borderRadius: 3 }}>
                    <AutoAwesome sx={{ color: MUTED, fontSize: 36 }} />
                    <Typography sx={{ fontWeight: 800, mt: 1 }}>Ingen revisjonsbrief ennå</Typography>
                    <Typography variant="body2" sx={{ color: MUTED }}>Generer den når bandet har lagt igjen kommentarer.</Typography>
                  </Box>
                )}
              </>
            )}

            {tab === 1 && (
              <>
                <Box>
                  <Typography sx={{ fontWeight: 850 }}>Blind sammenligning av 2–4 versjoner</Typography>
                  <Typography variant="body2" sx={{ color: MUTED }}>Reviewere hører Versjon A, B, C… uten filnavn. Nivåmatching reduserer loudness-bias.</Typography>
                </Box>
                <TextField label="Spørsmål" value={decisionTitle} onChange={(event) => setDecisionTitle(event.target.value)} inputProps={{ maxLength: 180 }} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <FormControlLabel control={<Switch checked={decisionBlind} onChange={(event) => setDecisionBlind(event.target.checked)} />} label="Skjul versjonsnavn" />
                  <FormControlLabel control={<Switch checked={decisionLevelMatched} onChange={(event) => setDecisionLevelMatched(event.target.checked)} />} label="Nivåmatchet avspilling" />
                </Stack>
                <Stack spacing={0.5} sx={{ maxHeight: 220, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: 2, p: 1 }}>
                  {[...versions].sort((a, b) => Number(b.version_number) - Number(a.version_number)).map((version) => {
                    const checked = selectedVersions.includes(version.id);
                    return (
                      <FormControlLabel
                        key={version.id}
                        control={<Checkbox checked={checked} disabled={!checked && selectedVersions.length >= 4} onChange={() => setSelectedVersions((current) => checked ? current.filter((id) => id !== version.id) : [...current, version.id])} />}
                        label={`${version.version_label || `Mix V${version.version_number}`}${version.id === currentVersionId ? ' · nåværende' : ''}`}
                      />
                    );
                  })}
                </Stack>
                <Button
                  data-testid="create-decision-room"
                  variant="contained"
                  startIcon={<CompareArrows />}
                  disabled={Boolean(busy) || selectedVersions.length < 2 || selectedVersions.length > 4}
                  onClick={() => void run('decision', async () => {
                    await apiRequest(`/api/sound-room/projects/${projectId}/decisions`, { method: 'POST', body: { title: decisionTitle, versionIds: selectedVersions, blind: decisionBlind, levelMatched: decisionLevelMatched } });
                  }, 'Decision Room er åpnet for samarbeidspartnerne.')}
                  sx={{ alignSelf: 'flex-start', bgcolor: ACCENT, color: '#150d05', fontWeight: 850, textTransform: 'none', borderRadius: 999 }}
                >
                  Åpne Decision Room
                </Button>
                <Divider sx={{ borderColor: BORDER }} />
                <Typography sx={{ fontWeight: 800 }}>Tidligere beslutninger</Typography>
                {(data?.decisions || []).length ? (data.decisions || []).map((decision: any) => (
                  <Box key={decision.id} sx={{ p: 1.5, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ fontWeight: 800, flex: 1 }}>{decision.title}</Typography>
                      <Chip size="small" label={decision.status === 'open' ? 'Åpen' : 'Lukket'} color={decision.status === 'open' ? 'warning' : 'success'} />
                    </Stack>
                    <Stack direction="row" useFlexGap flexWrap="wrap" spacing={0.75} sx={{ mt: 1 }}>
                      {(decision.candidates || []).map((candidate: any) => <Chip key={candidate.version_id} size="small" label={`${decision.blind ? candidate.label : candidate.version_label} · ${candidate.votes || 0} stemmer`} />)}
                    </Stack>
                    {decision.status === 'open' && (
                      <Button size="small" disabled={Boolean(busy)} onClick={() => void run(`close:${decision.id}`, async () => {
                        await apiRequest(`/api/sound-room/decisions/${decision.id}/close`, { method: 'POST', body: {} });
                      }, 'Avstemningen er lukket og flest stemmer avgjorde vinneren.')} sx={{ mt: 1, color: ACCENT, textTransform: 'none' }}>
                        Lukk og velg vinner
                      </Button>
                    )}
                  </Box>
                )) : <Typography variant="body2" sx={{ color: MUTED }}>Ingen avstemninger ennå.</Typography>}
              </>
            )}

            {tab === 2 && (
              <>
                <Box>
                  <Typography sx={{ fontWeight: 850 }}>Godkjenningskjede</Typography>
                  <Typography variant="body2" sx={{ color: MUTED }}>Velg hvem som har sign-off-rett, og be om en tydelig beslutning per produksjonssteg.</Typography>
                </Box>
                <Stack spacing={0.75}>
                  {members.filter((member) => !member.is_owner).map((member) => (
                    <Stack key={member.id} direction="row" alignItems="center" sx={{ p: 1, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{member.name}</Typography>
                        <Typography variant="caption" sx={{ color: MUTED }}>{member.role || member.instrument || 'Samarbeidspartner'}</Typography>
                      </Box>
                      <FormControlLabel control={<Switch checked={Boolean(member.can_approve)} disabled={Boolean(busy)} onChange={(event) => void toggleApprover(member, event.target.checked)} />} label="Kan godkjenne" />
                    </Stack>
                  ))}
                </Stack>
                {members.filter((member) => !member.is_owner).length === 0 && <Alert severity="info">Inviter en samarbeidspartner før du oppretter en godkjenningskjede.</Alert>}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField select label="Steg" value={signoffStage} onChange={(event) => setSignoffStage(event.target.value as typeof signoffStage)} sx={{ minWidth: 180 }}>
                    <MenuItem value="mix">Mix</MenuItem><MenuItem value="master">Master</MenuItem><MenuItem value="delivery">Levering</MenuItem>
                  </TextField>
                  <Button
                    variant="contained"
                    startIcon={<DoneAll />}
                    disabled={Boolean(busy) || !currentVersionId || eligibleMembers.length === 0}
                    onClick={() => void run('signoff', async () => {
                      await apiRequest(`/api/sound-room/projects/${projectId}/signoffs`, { method: 'POST', body: { versionId: currentVersionId, stage: signoffStage, memberIds: eligibleMembers.map((member) => member.id) } });
                    }, `${stageLabels[signoffStage]}-godkjenning er sendt.`)}
                    sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 850, textTransform: 'none' }}
                  >
                    Be alle godkjennere om sign-off
                  </Button>
                </Stack>
                <Divider sx={{ borderColor: BORDER }} />
                {(data?.signoffs || []).map((signoff: any) => (
                  <Stack key={signoff.id} direction="row" spacing={1} alignItems="center">
                    {signoff.status === 'approved' ? <CheckCircle color="success" /> : <RadioButtonUnchecked sx={{ color: MUTED }} />}
                    <Typography variant="body2" sx={{ flex: 1 }}>{signoff.member_name || 'Samarbeidspartner'} · {stageLabels[signoff.stage]}</Typography>
                    <Chip size="small" label={statusLabels[signoff.status] || signoff.status} />
                  </Stack>
                ))}
              </>
            )}

            {tab === 3 && (
              <>
                <Box>
                  <Typography sx={{ fontWeight: 850 }}>Leveransehvelv</Typography>
                  <Typography variant="body2" sx={{ color: MUTED }}>Frys alle nedlastbare leveranser i et nummerert manifest med identitetskontroll.</Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<Inventory2Outlined />}
                  disabled={Boolean(busy)}
                  onClick={() => void run('manifest', async () => {
                    await apiRequest(`/api/sound-room/projects/${projectId}/manifests`, { method: 'POST', body: {} });
                  }, 'Et nytt leveransemanifest er opprettet.')}
                  sx={{ alignSelf: 'flex-start', bgcolor: ACCENT, color: '#150d05', fontWeight: 850, textTransform: 'none', borderRadius: 999 }}
                >
                  Opprett manifest av klare filer
                </Button>
                {(data?.manifests || []).map((manifest: any) => (
                  <Box key={manifest.id} sx={{ p: 1.5, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ fontWeight: 800, flex: 1 }}>#{manifest.manifest_number} · {manifest.title}</Typography>
                      <Chip size="small" label={manifest.status} />
                    </Stack>
                    <Typography variant="caption" sx={{ color: MUTED }}>{(manifest.items || []).length} filer · {formatDate(manifest.created_at)}</Typography>
                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                      {(manifest.items || []).map((item: any) => <Typography key={item.id} variant="body2">{item.file_name} <Box component="span" sx={{ color: MUTED }}>· {item.format || 'fil'}</Box></Typography>)}
                    </Stack>
                  </Box>
                ))}
                {!data?.manifests?.length && <Typography variant="body2" sx={{ color: MUTED }}>Ingen manifester ennå. Marker først filer som nedlastbare under Leveranser.</Typography>}
              </>
            )}

            {tab === 4 && (
              <>
                <Typography sx={{ fontWeight: 850 }}>Hva har skjedd?</Typography>
                {(data?.activity || []).map((activity: any) => (
                  <Stack key={activity.id} direction="row" spacing={1.5} alignItems="flex-start">
                    <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: activity.read_at ? MUTED : ACCENT, mt: 0.7, flex: '0 0 auto' }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: activity.read_at ? 500 : 750 }}>{activity.summary}</Typography>
                      <Typography variant="caption" sx={{ color: MUTED }}>{[activity.actor_name, formatDate(activity.created_at)].filter(Boolean).join(' · ')}</Typography>
                    </Box>
                  </Stack>
                ))}
                {!data?.activity?.length && <Typography variant="body2" sx={{ color: MUTED }}>Aktivitet blir registrert når nye versjoner, kommentarer, beslutninger og godkjenninger kommer inn.</Typography>}
                {data?.activity?.some((activity: any) => !activity.read_at) && (
                  <Button size="small" onClick={() => void run('read', async () => { await apiRequest(`/api/sound-room/projects/${projectId}/activity/read`, { method: 'POST', body: {} }); }, 'Aktiviteten er markert som lest.')} sx={{ alignSelf: 'flex-start', color: ACCENT, textTransform: 'none' }}>Marker alt som lest</Button>
                )}
              </>
            )}
            {busy && <LinearProgress sx={{ '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />}
          </Stack>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose} sx={{ color: MUTED, textTransform: 'none' }}>Lukk</Button></DialogActions>
    </Dialog>
  );
}
