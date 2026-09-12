import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from '@mui/material';
import {
  Add,
  Album,
  ArrowBack,
  CheckCircleOutline,
  CommentOutlined,
  Headphones,
  Inbox,
  Search,
  TaskAlt,
  Tune,
  ArrowUpward,
  ArrowDownward,
  DeleteOutline,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { workspaceDarkTheme, ws } from '@/components/workspace/workspaceTheme';

type ProjectSummary = {
  id: string;
  title: string;
  artist_name?: string | null;
  cover_url?: string | null;
  status: string;
  deadline?: string | null;
  latest_version_label?: string | null;
  unresolved_comments: number;
  open_tasks: number;
  unread_activity: number;
  pending_signoffs: number;
  open_decisions: number;
  collaborator_count: number;
  completed_listeners: number;
};

type CollectionSummary = {
  id: string;
  title: string;
  artist_name?: string | null;
  collection_type: 'ep' | 'album';
  status: string;
  track_count: number;
  ready_count: number;
  tracks?: Array<{ project_id: string; track_number: number; title: string; artist_name?: string | null; status: string }>;
};

type CommandCenterResponse = {
  projects: ProjectSummary[];
  collections: CollectionSummary[];
};

const number = (value: unknown): number => Number(value) || 0;
const statusLabel: Record<string, string> = {
  draft: 'Utkast',
  under_review: 'Til gjennomgang',
  changes_requested: 'Endringer ønsket',
  approved: 'Godkjent',
  final_delivered: 'Levert',
};

export default function SoundRoomCommandCenter() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<CommandCenterResponse>({ projects: [], collections: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'attention' | 'approved'>('all');
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionTitle, setCollectionTitle] = useState('');
  const [collectionType, setCollectionType] = useState<'ep' | 'album'>('ep');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionSummary | null>(null);
  const [editTracks, setEditTracks] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiRequest('/api/sound-room/command-center');
      setData({
        projects: Array.isArray(response?.projects) ? response.projects : [],
        collections: Array.isArray(response?.collections) ? response.collections : [],
      });
    } catch (loadError: any) {
      setError(loadError?.message || 'Kunne ikke laste Sound Room akkurat nå.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('nb-NO');
    return data.projects.filter((project) => {
      if (term && !`${project.title} ${project.artist_name || ''}`.toLocaleLowerCase('nb-NO').includes(term)) return false;
      if (filter === 'attention') return number(project.unresolved_comments) + number(project.open_tasks) + number(project.pending_signoffs) > 0;
      if (filter === 'approved') return ['approved', 'final_delivered'].includes(project.status);
      return true;
    });
  }, [data.projects, filter, search]);

  const totals = useMemo(() => data.projects.reduce((result, project) => ({
    feedback: result.feedback + number(project.unresolved_comments),
    tasks: result.tasks + number(project.open_tasks),
    signoffs: result.signoffs + number(project.pending_signoffs),
    unread: result.unread + number(project.unread_activity),
  }), { feedback: 0, tasks: 0, signoffs: 0, unread: 0 }), [data.projects]);

  const createCollection = async () => {
    if (!collectionTitle.trim()) return;
    setSaving(true);
    setError('');
    try {
      const collection = await apiRequest('/api/sound-room/collections', {
        method: 'POST',
        body: { title: collectionTitle, collectionType },
      });
      if (selectedProjects.length) {
        await apiRequest(`/api/sound-room/collections/${collection.id}/tracks`, {
          method: 'PUT',
          body: { tracks: selectedProjects.map((projectId) => ({ projectId })) },
        });
      }
      setCollectionOpen(false);
      setCollectionTitle('');
      setSelectedProjects([]);
      await load();
    } catch (saveError: any) {
      setError(saveError?.message || 'Kunne ikke opprette utgivelsen.');
    } finally {
      setSaving(false);
    }
  };

  const openCollection = (collection: CollectionSummary) => {
    setEditingCollection(collection);
    setEditTracks((collection.tracks || []).map((track) => track.project_id));
  };

  const moveTrack = (index: number, direction: -1 | 1) => {
    setEditTracks((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const saveTrackOrder = async () => {
    if (!editingCollection) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/api/sound-room/collections/${editingCollection.id}/tracks`, {
        method: 'PUT', body: { tracks: editTracks.map((projectId) => ({ projectId })) },
      });
      setEditingCollection(null);
      await load();
    } catch (saveError: any) {
      setError(saveError?.message || 'Kunne ikke lagre sporrekkefølgen.');
    } finally { setSaving(false); }
  };

  return (
    <ThemeProvider theme={workspaceDarkTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: ws.bg, color: ws.text, py: { xs: 2, md: 4 } }} data-testid="sound-room-command-center">
        <Container maxWidth="xl">
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ mb: 3 }}>
            <IconButton onClick={() => navigate('/workspace?pick=1')} sx={{ color: ws.textDim }} aria-label="Tilbake til Workspace"><ArrowBack /></IconButton>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 850, fontFamily: '"Space Grotesk", sans-serif' }}>Sound Room</Typography>
              <Typography variant="body2" sx={{ color: ws.textDim }}>Produsentinnboks, beslutninger og leveranser på tvers av alle låter.</Typography>
            </Box>
            <Button variant="contained" startIcon={<Add />} onClick={() => setCollectionOpen(true)} sx={{ borderRadius: 999, bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 800, textTransform: 'none', alignSelf: { xs: 'stretch', sm: 'center' } }}>
              Ny EP eller album
            </Button>
          </Stack>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Grid container spacing={1.5} sx={{ mb: 3 }}>
            {[
              { label: 'Nye hendelser', value: totals.unread, icon: <Inbox />, color: ws.blue },
              { label: 'Åpne innspill', value: totals.feedback, icon: <CommentOutlined />, color: ws.amber },
              { label: 'Aktive oppgaver', value: totals.tasks, icon: <TaskAlt />, color: ws.accent },
              { label: 'Venter på sign-off', value: totals.signoffs, icon: <CheckCircleOutline />, color: ws.green },
            ].map((metric) => (
              <Grid item xs={6} md={3} key={metric.label}>
                <Card sx={{ p: 2, height: '100%', bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px`, boxShadow: 'none' }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ color: metric.color, display: 'flex' }}>{metric.icon}</Box>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 850, lineHeight: 1 }}>{metric.value}</Typography>
                      <Typography variant="caption" sx={{ color: ws.textDim }}>{metric.label}</Typography>
                    </Box>
                  </Stack>
                </Card>
              </Grid>
            ))}
          </Grid>

          {data.collections.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>Utgivelser</Typography>
              <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1, scrollbarWidth: 'thin' }}>
                {data.collections.map((collection) => (
                  <Card key={collection.id} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCollection(collection); } }} onClick={() => openCollection(collection)} sx={{ p: 2, minWidth: 260, cursor: 'pointer', bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px`, boxShadow: 'none', flex: '0 0 auto', '&:hover': { borderColor: ws.accent }, '&:focus-visible': { outline: `2px solid ${ws.accent}`, outlineOffset: 2 } }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar sx={{ bgcolor: ws.accentSoft, color: ws.accent }}><Album /></Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 800 }} noWrap>{collection.title}</Typography>
                        <Typography variant="caption" sx={{ color: ws.textDim }}>{collection.collection_type.toUpperCase()} · {number(collection.ready_count)}/{number(collection.track_count)} klare</Typography>
                      </Box>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, flex: 1 }}>Produsentinnboks</Typography>
            <TextField
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Søk etter låt eller artist"
              inputProps={{ 'aria-label': 'Søk etter låt eller artist' }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: ws.textFaint }} /></InputAdornment> }}
              sx={{ minWidth: { sm: 280 } }}
            />
            <TextField size="small" select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} sx={{ minWidth: 175 }} InputProps={{ startAdornment: <InputAdornment position="start"><Tune sx={{ color: ws.textFaint, fontSize: 18 }} /></InputAdornment> }}>
              <MenuItem value="all">Alle låter</MenuItem>
              <MenuItem value="attention">Trenger handling</MenuItem>
              <MenuItem value="approved">Godkjent eller levert</MenuItem>
            </TextField>
          </Stack>

          {loading ? (
            <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}><CircularProgress sx={{ color: ws.accent }} /></Box>
          ) : filtered.length === 0 ? (
            <Card sx={{ p: 5, textAlign: 'center', bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px`, boxShadow: 'none' }}>
              <Headphones sx={{ color: ws.textFaint, fontSize: 42, mb: 1 }} />
              <Typography sx={{ fontWeight: 800 }}>{data.projects.length ? 'Ingen låter passer filteret' : 'Ingen Sound Room-låter ennå'}</Typography>
              <Typography variant="body2" sx={{ color: ws.textDim, mt: 0.5 }}>Låter dukker opp her når de sendes til review fra Workspace eller EaseVerse.</Typography>
            </Card>
          ) : (
            <Grid container spacing={1.5}>
              {filtered.map((project) => {
                const attention = number(project.unresolved_comments) + number(project.open_tasks) + number(project.pending_signoffs);
                return (
                  <Grid item xs={12} md={6} lg={4} key={project.id}>
                    <Card
                      data-testid="sound-room-project-card"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/audio-review/${project.id}`); } }}
                      onClick={() => navigate(`/audio-review/${project.id}`)}
                      sx={{ p: 2, cursor: 'pointer', height: '100%', bgcolor: ws.panel, border: `1px solid ${attention ? ws.accentBorder : ws.border}`, borderRadius: `${ws.radius}px`, boxShadow: 'none', transition: 'transform .15s,border-color .15s', '&:hover': { transform: 'translateY(-2px)', borderColor: ws.accent }, '&:focus-visible': { outline: `2px solid ${ws.accent}`, outlineOffset: 2 } }}
                    >
                      <Stack direction="row" spacing={1.5}>
                        <Avatar variant="rounded" src={project.cover_url || undefined} sx={{ width: 54, height: 54, bgcolor: ws.panelAlt }}><Headphones /></Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography sx={{ fontWeight: 850 }} noWrap>{project.title}</Typography>
                            {number(project.unread_activity) > 0 && <Chip size="small" label={project.unread_activity} sx={{ height: 20, bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 900 }} />}
                          </Stack>
                          <Typography variant="caption" sx={{ color: ws.textDim }}>{project.artist_name || 'Artist ikke satt'} · {project.latest_version_label || 'Ingen versjon'}</Typography>
                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
                            <Chip size="small" label={statusLabel[project.status] || project.status} variant="outlined" />
                            {number(project.unresolved_comments) > 0 && <Chip size="small" icon={<CommentOutlined />} label={`${project.unresolved_comments} åpne`} />}
                            {number(project.open_decisions) > 0 && <Chip size="small" label={`${project.open_decisions} avstemning`} />}
                            {number(project.pending_signoffs) > 0 && <Chip size="small" label={`${project.pending_signoffs} sign-off`} />}
                          </Stack>
                          <Typography variant="caption" sx={{ color: ws.textFaint, display: 'block', mt: 1.25 }}>
                            {number(project.completed_listeners)}/{number(project.collaborator_count)} samarbeidspartnere har hørt ferdig
                          </Typography>
                        </Box>
                      </Stack>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Container>

        <Dialog open={collectionOpen} onClose={() => !saving && setCollectionOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 850 }}>Sett sammen en utgivelse</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField autoFocus label="Tittel" value={collectionTitle} onChange={(event) => setCollectionTitle(event.target.value)} inputProps={{ maxLength: 200 }} />
              <TextField select label="Utgivelsestype" value={collectionType} onChange={(event) => setCollectionType(event.target.value as 'ep' | 'album')}>
                <MenuItem value="ep">EP</MenuItem>
                <MenuItem value="album">Album</MenuItem>
              </TextField>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Sporrekkefølge</Typography>
                <Typography variant="caption" sx={{ color: ws.textDim }}>Velg låtene i ønsket rekkefølge. Du kan endre rekkefølgen senere.</Typography>
                <Stack sx={{ mt: 1, maxHeight: 260, overflowY: 'auto', border: `1px solid ${ws.border}`, borderRadius: 2, p: 0.5 }}>
                  {data.projects.map((project) => {
                    const checked = selectedProjects.includes(project.id);
                    return (
                      <FormControlLabel
                        key={project.id}
                        control={<Checkbox checked={checked} onChange={() => setSelectedProjects((current) => checked ? current.filter((id) => id !== project.id) : [...current, project.id])} />}
                        label={`${checked ? `${selectedProjects.indexOf(project.id) + 1}. ` : ''}${project.title}${project.artist_name ? ` – ${project.artist_name}` : ''}`}
                      />
                    );
                  })}
                </Stack>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCollectionOpen(false)} disabled={saving}>Avbryt</Button>
            <Button variant="contained" onClick={() => void createCollection()} disabled={saving || !collectionTitle.trim()} sx={{ bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 800 }}>
              {saving ? 'Lagrer…' : 'Opprett utgivelse'}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={Boolean(editingCollection)} onClose={() => !saving && setEditingCollection(null)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 850 }}>{editingCollection?.title} · sporrekkefølge</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: ws.textDim, mb: 1.5 }}>Flytt sporene i ønsket rekkefølge. Status viser hvilke låter som er klare for levering.</Typography>
            <Stack spacing={0.75}>
              {editTracks.map((projectId, index) => {
                const project = data.projects.find((item) => item.id === projectId);
                if (!project) return null;
                return (
                  <Stack key={projectId} direction="row" alignItems="center" spacing={1} sx={{ p: 1, border: `1px solid ${ws.border}`, borderRadius: 2 }}>
                    <Typography sx={{ color: ws.textFaint, width: 24, textAlign: 'center', fontWeight: 800 }}>{index + 1}</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" sx={{ fontWeight: 750 }} noWrap>{project.title}</Typography><Typography variant="caption" sx={{ color: ws.textDim }}>{statusLabel[project.status] || project.status}</Typography></Box>
                    <IconButton size="small" disabled={index === 0} onClick={() => moveTrack(index, -1)} aria-label={`Flytt ${project.title} opp`}><ArrowUpward fontSize="small" /></IconButton>
                    <IconButton size="small" disabled={index === editTracks.length - 1} onClick={() => moveTrack(index, 1)} aria-label={`Flytt ${project.title} ned`}><ArrowDownward fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => setEditTracks((current) => current.filter((id) => id !== projectId))} aria-label={`Fjern ${project.title}`} sx={{ color: ws.red }}><DeleteOutline fontSize="small" /></IconButton>
                  </Stack>
                );
              })}
            </Stack>
            {data.projects.some((project) => !editTracks.includes(project.id)) && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Legg til låt</Typography>
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                  {data.projects.filter((project) => !editTracks.includes(project.id)).map((project) => <Chip key={project.id} clickable icon={<Add />} label={project.title} onClick={() => setEditTracks((current) => [...current, project.id])} />)}
                </Stack>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingCollection(null)} disabled={saving}>Avbryt</Button>
            <Button variant="contained" onClick={() => void saveTrackOrder()} disabled={saving} sx={{ bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 800 }}>Lagre rekkefølge</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}
