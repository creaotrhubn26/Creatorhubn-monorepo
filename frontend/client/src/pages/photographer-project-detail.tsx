// Slice 9X.9.A — prosjekt-detaljside for fotograf.
// Viser klient-info, finansiell oversikt med live margin, time-logg
// med rask oppretting, og koblede klient-gallerier. Knapper for å
// opprette nytt galleri og navigere til klient-detalj.

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import {
  Box, Typography, Paper, Stack, Button, TextField, Chip, CircularProgress,
  Divider, IconButton, Grid2, Table, TableBody, TableCell, TableHead, TableRow,
  TableContainer, Dialog, DialogTitle, DialogContent, DialogActions,
  LinearProgress, Alert, Switch, FormControlLabel, Tooltip, Snackbar,
} from '@mui/material';
import {
  ArrowBack, Person, Email, Phone, LocationOn, Event, Edit, AccessTime,
  AttachMoney, TrendingUp, Collections, Add, Folder, Receipt, OpenInNew,
  Send, ContentCopy, Visibility, Timeline, CheckCircle, RadioButtonUnchecked,
  VideoCall, NavigateNext, PlayArrow, ArrowForward, Celebration, CloudUpload,
  Chat,
} from '@mui/icons-material';
import { ProjectChatPanel } from '@/components/photographer/ProjectChatPanel';
import { WeddingTimelineEventsPanel } from '@/components/photographer/WeddingTimelineEventsPanel';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ProjectDetail {
  id: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  description: string | null;
  projectType: string | null;
  status: string;
  phase: string | null;
  eventDate: string | null;
  location: string | null;
  servicePrice: number;
  servicePriceGross: number;
  servicePriceNet: number;
  vatRate: number;
  vatAmount: number;
  hourlyRate: number;
  costOverhead: number;
  estimatedHours: number | null;
  trackedHours: number;
  trackedCost: number;
  totalCost: number;
  marginPct: number | null;
  profitAmount: number | null;
  invoiceProvider: string | null;
  externalInvoiceId: string | null;
  externalInvoiceNumber: string | null;
  invoicedAt: string | null;
  googleCalendarEventId: string | null;
  weddingId: string | null;
  createdAt: string;
}

interface TimeEntry {
  id: string;
  taskDescription: string;
  hoursSpent: number;
  billableHours: number;
  rate: number;
  dateWorked: string;
  createdAt: string;
}

interface GalleryRow {
  id: string;
  title: string;
  accessToken: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

interface DetailResponse {
  project: ProjectDetail;
  timeEntries: TimeEntry[];
  galleries: GalleryRow[];
}

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: string;
  dueDate: string | null;
  scheduledDate: string | null;
  status: string;
  progress: number;
  priority: string;
  clientVisible: boolean;
  requiresClientApproval: boolean;
  clientApprovalStatus: string | null;
  googleCalendarEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MilestonesResponse {
  milestones: Milestone[];
  nextStep: Milestone | null;
  totalProgress: number;
  completedCount: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('nb-NO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function marginColor(pct: number | null): 'success.main' | 'warning.main' | 'error.main' | 'text.primary' {
  if (pct === null) return 'text.primary';
  if (pct >= 50) return 'success.main';
  if (pct >= 25) return 'warning.main';
  return 'error.main';
}

export default function PhotographerProjectDetail() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [edits, setEdits] = useState<Partial<ProjectDetail>>({});
  const [timeDraft, setTimeDraft] = useState({
    taskDescription: '', hoursSpent: '', dateWorked: new Date().toISOString().slice(0, 10),
  });
  const [galleryDraft, setGalleryDraft] = useState({
    projectTitle: '',
    description: '',
    allowDownload: true,
    requireApproval: false,
    isPublic: false,
  });
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const [notifyOpen, setNotifyOpen] = useState<string | null>(null); // galleryId
  const [notifyMessage, setNotifyMessage] = useState('');
  const [meetOpen, setMeetOpen] = useState<string | null>(null); // milestoneId
  const [meetDraft, setMeetDraft] = useState({
    title: '',
    date: '',
    time: '14:00',
    duration: 60,
    description: '',
  });
  const [justCreated, setJustCreated] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Slice 9X.14 — Stine just landet hit fra dashboard "Nytt prosjekt"-flyt.
  // Vis konfetti-banner med next-steps de første 8 sek.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('created') === '1') {
      setJustCreated(true);
      const t = setTimeout(() => setJustCreated(false), 12000);
      return () => clearTimeout(t);
    }
  }, []);

  const { data, isLoading, error } = useQuery<DetailResponse>({
    queryKey: [`/api/photographer/projects/${projectId}`],
    queryFn: () => apiRequest(`/api/photographer/projects/${projectId}`),
    enabled: !!projectId,
  });

  const update = useMutation<{ success: boolean }, Error, Partial<ProjectDetail>>({
    mutationFn: (body) => apiRequest(`/api/photographer/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/photographer/projects/${projectId}`] });
      qc.invalidateQueries({ queryKey: ['/api/photographer/projects'] });
      setEditOpen(false);
      setEdits({});
    },
  });

  const logTime = useMutation<{ id: string }, Error, typeof timeDraft>({
    mutationFn: (body) => apiRequest(`/api/photographer/projects/${projectId}/time`, {
      method: 'POST',
      body: JSON.stringify({
        taskDescription: body.taskDescription,
        hoursSpent: Number(body.hoursSpent),
        billableHours: Number(body.hoursSpent),
        dateWorked: body.dateWorked,
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/photographer/projects/${projectId}`] });
      qc.invalidateQueries({ queryKey: ['/api/photographer/projects'] });
      setTimeOpen(false);
      setTimeDraft({ taskDescription: '', hoursSpent: '', dateWorked: new Date().toISOString().slice(0, 10) });
    },
  });

  const createInvoice = useMutation<
    {
      salesOrderId: string;
      salesOrderNumber: number | string | null;
      sendStatus?: string | null;
      sendError?: { status: number; detail?: unknown } | null;
      async?: boolean;
      alreadyInvoiced?: boolean;
    },
    Error,
    void
  >({
    mutationFn: () => apiRequest(`/api/photographer/projects/${projectId}/invoice`, {
      method: 'POST',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/photographer/projects/${projectId}`] });
    },
  });

  const createGallery = useMutation<{ id: string; shareUrl: string }, Error, typeof galleryDraft>({
    mutationFn: (body) => apiRequest('/api/photographer/galleries', {
      method: 'POST',
      body: JSON.stringify({
        clientName: data?.project.clientName ?? '',
        clientEmail: data?.project.clientEmail ?? '',
        projectTitle: body.projectTitle || data?.project.title,
        projectId,
        gallerySettings: {
          theme: 'minimal',
          description: body.description || null,
          allowDownload: body.allowDownload,
          requireApproval: body.requireApproval,
          isPublic: body.isPublic,
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: [`/api/photographer/projects/${projectId}`] });
      setGalleryOpen(false);
      setGalleryDraft({
        projectTitle: '', description: '',
        allowDownload: true, requireApproval: false, isPublic: false,
      });
      navigator.clipboard?.writeText(result.shareUrl).catch(() => {});
      setSnackbar({ msg: 'Galleri opprettet — share-link kopiert til utklippstavlen', severity: 'success' });
    },
  });

  const notifyClient = useMutation<
    { sent: boolean; recipient: string; shareUrl: string },
    Error,
    { galleryId: string; customMessage: string }
  >({
    mutationFn: ({ galleryId, customMessage }) =>
      apiRequest(`/api/photographer/galleries/${galleryId}/notify-client`, {
        method: 'POST',
        body: JSON.stringify({ customMessage }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: ({ recipient }) => {
      setSnackbar({ msg: `Galleriet ble sendt til ${recipient}`, severity: 'success' });
      setNotifyOpen(null);
      setNotifyMessage('');
    },
    onError: (err: any) => {
      let msg = String(err?.message || 'Ukjent feil');
      try {
        const parsed = JSON.parse(msg);
        msg = parsed.message || parsed.error || msg;
      } catch { /* not JSON */ }
      setSnackbar({ msg: `Kunne ikke sende: ${msg}`, severity: 'error' });
    },
  });

  const markComplete = useMutation<unknown, Error, string>({
    mutationFn: (galleryId) =>
      apiRequest(`/api/photographer/galleries/${galleryId}/mark-complete`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/photographer/projects/${projectId}`] });
      setSnackbar({ msg: 'Galleri markert som ferdig — klient ble varslet', severity: 'success' });
    },
  });

  const { data: milestonesData } = useQuery<MilestonesResponse>({
    queryKey: [`/api/photographer/projects/${projectId}/milestones`],
    queryFn: () => apiRequest(`/api/photographer/projects/${projectId}/milestones`),
    enabled: !!projectId,
  });

  const updateMilestone = useMutation<unknown, Error, { milestoneId: string; status?: string; progress?: number }>({
    mutationFn: ({ milestoneId, ...body }) =>
      apiRequest(`/api/photographer/projects/${projectId}/milestones/${milestoneId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/photographer/projects/${projectId}/milestones`] });
    },
  });

  const scheduleMeet = useMutation<
    { meetLink: string; title: string; scheduledAt: string; calendarEventId: string },
    Error,
    typeof meetDraft & { milestoneId: string }
  >({
    mutationFn: ({ milestoneId, ...body }) =>
      apiRequest(`/api/photographer/projects/${projectId}/meet`, {
        method: 'POST',
        body: JSON.stringify({ milestoneId, ...body }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: ({ meetLink, scheduledAt }) => {
      qc.invalidateQueries({ queryKey: [`/api/photographer/projects/${projectId}/milestones`] });
      setMeetOpen(null);
      setSnackbar({
        msg: `Google Meet planlagt ${new Date(scheduledAt).toLocaleString('nb-NO')}. Klipp inn link: ${meetLink}`,
        severity: 'success',
      });
      try { navigator.clipboard.writeText(meetLink); } catch { /* ignore */ }
    },
    onError: (err: any) => {
      let msg = String(err?.message || 'Ukjent feil');
      try { const p = JSON.parse(msg); msg = p.message || p.error || msg; } catch { /* */ }
      setSnackbar({ msg: `Kunne ikke planlegge møte: ${msg}`, severity: 'error' });
    },
  });

  const copyShareUrl = async (accessToken: string) => {
    const shareUrl = `${window.location.origin}/client-gallery/${accessToken}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSnackbar({ msg: 'Share-link kopiert', severity: 'info' });
    } catch {
      setSnackbar({ msg: shareUrl, severity: 'info' });
    }
  };

  const progressPct = useMemo(() => {
    const p = data?.project;
    if (!p?.estimatedHours || p.estimatedHours === 0) return null;
    return Math.min(100, (p.trackedHours / p.estimatedHours) * 100);
  }, [data]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/photographer/projects')}>
          Tilbake
        </Button>
        <Alert severity="error" sx={{ mt: 2 }}>Kunne ikke laste prosjekt.</Alert>
      </Box>
    );
  }

  const p = data.project;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Slice 9X.14 — post-creation success banner. Vises ~12 sek
          etter Stine klikker "Opprett prosjekt" fra dashboard. */}
      {justCreated && (
        <Alert
          severity="success"
          icon={<Celebration />}
          sx={{ mb: 3 }}
          onClose={() => setJustCreated(false)}
          action={
            milestonesData?.nextStep && (
              <Button
                color="inherit"
                size="small"
                endIcon={<ArrowForward />}
                onClick={() => {
                  document.getElementById('project-timeline-section')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Se neste steg
              </Button>
            )
          }
        >
          <Typography variant="body2" fontWeight={500}>
            Prosjektet "{p.title}" er opprettet!
          </Typography>
          <Typography variant="caption">
            Tidslinje er auto-generert med {milestonesData?.milestones.length ?? '…'} milepæler.
            Klient er lagret i CRM. Du finner alt under.
          </Typography>
        </Alert>
      )}

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/photographer/projects')}>
          <ArrowBack />
        </IconButton>
        <Folder color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5">{p.title}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            {p.projectType && <Chip size="small" label={p.projectType} variant="outlined" />}
            <Chip size="small" color={p.status === 'completed' ? 'success' : 'primary'} label={p.status} />
            {p.phase && <Chip size="small" label={p.phase} variant="outlined" />}
          </Stack>
        </Box>
        <Button
          startIcon={<Chat />}
          variant="outlined"
          onClick={() => setChatOpen(true)}
          disabled={!p.clientEmail}
        >
          Chat med klient
        </Button>
        <Button
          startIcon={<CloudUpload />}
          variant="outlined"
          onClick={() => navigate(`/photographer/projects/${projectId}/upload`)}
        >
          Last opp bilder
        </Button>
        <Button startIcon={<Edit />} onClick={() => { setEdits(p); setEditOpen(true); }}>
          Rediger
        </Button>
      </Stack>

      <Grid2 container spacing={3} sx={{ mb: 3 }}>
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Klient & detaljer</Typography>
            {p.clientName ? (
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person fontSize="small" color="action" />
                  {p.clientId ? (
                    <Typography
                      sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                      onClick={() => navigate(`/photographer/clients/${p.clientId}`)}
                    >
                      {p.clientName}
                    </Typography>
                  ) : (
                    <Typography>{p.clientName}</Typography>
                  )}
                </Box>
                {p.clientEmail && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Email fontSize="small" color="action" />
                    <Typography variant="body2">{p.clientEmail}</Typography>
                  </Box>
                )}
                {p.clientPhone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Phone fontSize="small" color="action" />
                    <Typography variant="body2">{p.clientPhone}</Typography>
                  </Box>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">Ingen klient knyttet til dette prosjektet.</Typography>
            )}
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1.5}>
              {p.eventDate && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Event fontSize="small" color="action" />
                  <Typography variant="body2">{formatDate(p.eventDate)}</Typography>
                  {p.googleCalendarEventId && (
                    <Chip
                      size="small"
                      label="I Google Calendar"
                      color="success"
                      variant="outlined"
                      sx={{ height: 20, fontSize: 11 }}
                      onClick={() => window.open(
                        `https://calendar.google.com/calendar/r/eventedit/${encodeURIComponent(
                          btoa(`${p.googleCalendarEventId} primary`)
                            .replace(/=+$/, '')
                        )}`,
                        '_blank',
                      )}
                    />
                  )}
                </Box>
              )}
              {p.location && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationOn fontSize="small" color="action" />
                  <Typography variant="body2">{p.location}</Typography>
                </Box>
              )}
              {p.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {p.description}
                </Typography>
              )}
            </Stack>
          </Paper>
        </Grid2>

        <Grid2 size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp /> Økonomi (live)
            </Typography>
            <Grid2 container spacing={2}>
              <Grid2 size={6}>
                <Typography variant="caption" color="text.secondary">Avtalt pris</Typography>
                <Typography variant="h5">{p.servicePrice.toLocaleString('nb-NO')} kr</Typography>
              </Grid2>
              <Grid2 size={6}>
                <Typography variant="caption" color="text.secondary">Total kostnad</Typography>
                <Typography variant="h5">{p.totalCost.toLocaleString('nb-NO')} kr</Typography>
                <Typography variant="caption" color="text.secondary">
                  {p.trackedCost.toLocaleString('nb-NO')} timer + {p.costOverhead.toLocaleString('nb-NO')} faste
                </Typography>
              </Grid2>
              <Grid2 size={6}>
                <Typography variant="caption" color="text.secondary">Margin</Typography>
                <Typography variant="h4" color={marginColor(p.marginPct)}>
                  {p.marginPct !== null ? `${p.marginPct.toFixed(0)}%` : '—'}
                </Typography>
              </Grid2>
              <Grid2 size={6}>
                <Typography variant="caption" color="text.secondary">Fortjeneste</Typography>
                <Typography variant="h4" color={marginColor(p.marginPct)}>
                  {p.profitAmount !== null ? `${p.profitAmount.toLocaleString('nb-NO')} kr` : '—'}
                </Typography>
              </Grid2>
              {progressPct !== null && (
                <Grid2 size={12}>
                  <Typography variant="caption" color="text.secondary">
                    Timer brukt: {p.trackedHours.toFixed(1)}t / {p.estimatedHours}t estimat
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={progressPct}
                    color={progressPct > 100 ? 'error' : progressPct > 80 ? 'warning' : 'primary'}
                    sx={{ mt: 0.5, height: 8, borderRadius: 1 }}
                  />
                </Grid2>
              )}
            </Grid2>
          </Paper>
        </Grid2>
      </Grid2>

      {/* Slice 9X.27 — Live-mode-knapp for bryllup. Ekstra prominent
          hvis bryllupet er innen 24t eller pågår nå. */}
      {p.weddingId && (() => {
        const eventDate = p.eventDate ? new Date(p.eventDate) : null;
        const hoursToWedding = eventDate
          ? (eventDate.getTime() - Date.now()) / 3600000 : null;
        const isImminent = hoursToWedding !== null && hoursToWedding >= -24 && hoursToWedding <= 24;
        return (
          <Paper sx={{
            p: 2, mb: 3,
            background: isImminent
              ? 'linear-gradient(135deg, #fff5e6 0%, #ffe0c4 100%)'
              : undefined,
            border: isImminent ? 2 : 0,
            borderColor: 'primary.main',
          }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <PlayArrow color={isImminent ? 'primary' : 'action'} sx={{ fontSize: 32 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" fontWeight={isImminent ? 700 : 500}>
                  Wedding-day live-mode
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isImminent
                    ? '⏰ Bryllupet er nært — bruk live-mode på mobilen under dagen'
                    : 'Mobil-vennlig timeline med current event, countdown og live photo-progress'}
                </Typography>
              </Box>
              <Button
                size="large"
                variant={isImminent ? 'contained' : 'outlined'}
                color="primary"
                startIcon={<PlayArrow />}
                onClick={() => navigate(`/photographer/wedding-day/${p.weddingId}`)}
              >
                Åpne live-mode
              </Button>
            </Stack>
          </Paper>
        );
      })()}

      {/* Slice 9X.23 — Bryllups-timeline med foto-events (kun bryllup-prosjekter) */}
      {p.weddingId && (
        <WeddingTimelineEventsPanel weddingId={p.weddingId} />
      )}

      {/* Slice 9X.14 — Timeline med next-step CTA, milestones, og
          "Planlegg Google Meet"-trigger per møte-milestone. */}
      <Paper sx={{ p: 3, mb: 3 }} id="project-timeline-section">
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Timeline /> Tidslinje frem til leveranse
          </Typography>
          <Chip
            size="small"
            label={`${milestonesData?.completedCount ?? 0} / ${milestonesData?.milestones.length ?? 0} fullført`}
            color={milestonesData?.totalProgress === 100 ? 'success' : 'primary'}
          />
        </Stack>

        {milestonesData && milestonesData.milestones.length > 0 && (
          <LinearProgress
            variant="determinate"
            value={milestonesData.totalProgress}
            sx={{ height: 6, borderRadius: 1, mb: 3 }}
            color={milestonesData.totalProgress === 100 ? 'success' : 'primary'}
          />
        )}

        {/* Next step CTA — Stine ser umiddelbart hva som skal gjøres */}
        {milestonesData?.nextStep && (
          <Paper
            variant="outlined"
            sx={{
              p: 2.5, mb: 3,
              borderColor: 'primary.main', borderWidth: 2,
              background: (theme) => `${theme.palette.primary.main}08`,
            }}
          >
            <Stack direction="row" alignItems="flex-start" spacing={2}>
              <PlayArrow color="primary" sx={{ mt: 0.5 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="caption" color="primary" fontWeight={600}>
                  NESTE STEG
                </Typography>
                <Typography variant="h6" sx={{ mt: 0.5 }}>
                  {milestonesData.nextStep.title}
                </Typography>
                {milestonesData.nextStep.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {milestonesData.nextStep.description}
                  </Typography>
                )}
                {milestonesData.nextStep.dueDate && (
                  <Typography variant="caption" color="text.secondary">
                    Frist: {formatDate(milestonesData.nextStep.dueDate)}
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={1}>
                {milestonesData.nextStep.type === 'meeting' && (
                  <Tooltip title="Planlegg Google Meet med klient">
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<VideoCall />}
                      onClick={() => {
                        setMeetDraft({
                          title: milestonesData.nextStep!.title,
                          date: milestonesData.nextStep!.dueDate
                            ? new Date(milestonesData.nextStep!.dueDate).toISOString().slice(0, 10)
                            : new Date().toISOString().slice(0, 10),
                          time: '14:00',
                          duration: 60,
                          description: milestonesData.nextStep!.description ?? '',
                        });
                        setMeetOpen(milestonesData.nextStep!.id);
                      }}
                    >
                      Planlegg Meet
                    </Button>
                  </Tooltip>
                )}
                <Tooltip title="Marker som ferdig">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CheckCircle />}
                    onClick={() => updateMilestone.mutate({
                      milestoneId: milestonesData.nextStep!.id,
                      status: 'completed',
                      progress: 100,
                    })}
                  >
                    Ferdig
                  </Button>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>
        )}

        {!milestonesData?.milestones.length ? (
          <Typography variant="body2" color="text.secondary">
            Ingen tidslinje ennå. (Auto-generering kjøres ved opprettelse.)
          </Typography>
        ) : (
          <Stack spacing={0}>
            {milestonesData.milestones.map((m, idx) => {
              const isLast = idx === milestonesData.milestones.length - 1;
              const isCompleted = m.status === 'completed';
              const isCancelled = m.status === 'cancelled';
              const isInProgress = m.status === 'in_progress';
              return (
                <Box key={m.id} sx={{ display: 'flex', gap: 2 }}>
                  {/* Timeline rail */}
                  <Box sx={{ position: 'relative', flexShrink: 0, width: 28 }}>
                    <Box sx={{ pt: 1.5 }}>
                      {isCompleted ? (
                        <CheckCircle color="success" />
                      ) : isInProgress ? (
                        <RadioButtonUnchecked color="primary" sx={{ animation: 'pulse 2s infinite' }} />
                      ) : isCancelled ? (
                        <RadioButtonUnchecked color="disabled" />
                      ) : (
                        <RadioButtonUnchecked color="action" />
                      )}
                    </Box>
                    {!isLast && (
                      <Box sx={{
                        position: 'absolute', left: '50%', top: 32, bottom: 0,
                        width: 2, bgcolor: isCompleted ? 'success.main' : 'divider',
                        transform: 'translateX(-50%)',
                      }} />
                    )}
                  </Box>

                  {/* Content */}
                  <Box sx={{ flexGrow: 1, pb: 2.5 }}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                      <Box sx={{ flexGrow: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography
                            variant="body1"
                            fontWeight={500}
                            sx={{
                              textDecoration: isCancelled ? 'line-through' : 'none',
                              color: isCompleted ? 'text.secondary' : 'text.primary',
                            }}
                          >
                            {m.title}
                          </Typography>
                          {m.priority === 'critical' && !isCompleted && (
                            <Chip size="small" color="error" label="Kritisk" sx={{ height: 18, fontSize: 11 }} />
                          )}
                          {m.clientVisible && (
                            <Tooltip title="Synlig for klient">
                              <Chip
                                size="small" variant="outlined" label="Klient"
                                sx={{ height: 18, fontSize: 11 }}
                              />
                            </Tooltip>
                          )}
                          {m.googleCalendarEventId && (
                            <Chip size="small" color="success" variant="outlined" icon={<VideoCall sx={{ fontSize: 12 }} />}
                              label="Møte" sx={{ height: 18, fontSize: 11 }} />
                          )}
                        </Stack>
                        {m.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {m.description}
                          </Typography>
                        )}
                        {m.dueDate && (
                          <Typography variant="caption" color="text.secondary">
                            Frist: {formatDate(m.dueDate)}
                          </Typography>
                        )}
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        {m.type === 'meeting' && !isCompleted && !m.googleCalendarEventId && (
                          <Tooltip title="Planlegg Google Meet">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setMeetDraft({
                                  title: m.title,
                                  date: m.dueDate
                                    ? new Date(m.dueDate).toISOString().slice(0, 10)
                                    : new Date().toISOString().slice(0, 10),
                                  time: '14:00',
                                  duration: 60,
                                  description: m.description ?? '',
                                });
                                setMeetOpen(m.id);
                              }}
                            >
                              <VideoCall fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {!isCompleted && !isCancelled && (
                          <Tooltip title="Marker som ferdig">
                            <IconButton
                              size="small"
                              onClick={() => updateMilestone.mutate({
                                milestoneId: m.id, status: 'completed', progress: 100,
                              })}
                            >
                              <CheckCircle fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </Stack>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTime /> Timer ({p.trackedHours.toFixed(1)}t)
          </Typography>
          <Button size="small" startIcon={<Add />} onClick={() => setTimeOpen(true)}>
            Logg timer
          </Button>
        </Stack>
        {data.timeEntries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Ingen timer logget. Logg timer mens du jobber for å se sann margin.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Dato</TableCell>
                  <TableCell>Oppgave</TableCell>
                  <TableCell align="right">Timer</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell align="right">Kost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.timeEntries.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDate(t.dateWorked)}</TableCell>
                    <TableCell>{t.taskDescription}</TableCell>
                    <TableCell align="right">{t.billableHours.toFixed(1)}t</TableCell>
                    <TableCell align="right">{t.rate.toLocaleString('nb-NO')} kr</TableCell>
                    <TableCell align="right">{(t.billableHours * t.rate).toLocaleString('nb-NO')} kr</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Receipt /> Faktura
          </Typography>
          {p.invoiceProvider ? (
            <Chip
              size="small"
              color="success"
              icon={<Receipt />}
              label={`${p.invoiceProvider.toUpperCase()} #${p.externalInvoiceNumber ?? p.externalInvoiceId}`}
            />
          ) : (
            <Button
              size="small"
              startIcon={<Receipt />}
              variant="contained"
              disabled={!p.clientEmail || p.servicePrice <= 0 || createInvoice.isPending}
              onClick={() => createInvoice.mutate()}
            >
              Lag faktura i PowerOffice
            </Button>
          )}
        </Stack>
        {p.invoiceProvider ? (
          <Stack spacing={1}>
            <Typography variant="body2">
              Fakturert {formatDate(p.invoicedAt)} via {p.invoiceProvider}.
              Brutto {p.servicePriceGross.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr
              (netto {p.servicePriceNet.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr
              + {p.vatRate}% MVA {p.vatAmount.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr).
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Ekstern faktura-id: {p.externalInvoiceId}
            </Typography>
            {p.invoiceProvider === 'poweroffice' && p.externalInvoiceId && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNew />}
                href={`https://godemo.poweroffice.net/#salesorders/edit/${p.externalInvoiceId}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ alignSelf: 'flex-start', mt: 0.5 }}
              >
                Åpne i PowerOffice GO
              </Button>
            )}
          </Stack>
        ) : (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Lager en faktura i PowerOffice GO basert på avtalt pris
              ({p.servicePriceGross.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr brutto,
              netto {p.servicePriceNet.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr + {p.vatRate}% MVA).
            </Typography>
            {!p.clientEmail && (
              <Alert severity="warning">Klienten må ha en e-postadresse for å sende faktura.</Alert>
            )}
            {p.servicePrice <= 0 && (
              <Alert severity="warning">Sett avtalt pris på prosjektet før fakturering.</Alert>
            )}
            {createInvoice.isError && (() => {
              let msg = String(createInvoice.error?.message || 'Ukjent feil');
              let needsConnect = false;
              try {
                const parsed = JSON.parse(msg);
                msg = parsed.message || parsed.error || msg;
                needsConnect = parsed.error === 'poweroffice_not_connected'
                  || parsed.error === 'poweroffice_auth_failed';
              } catch { /* not JSON */ }
              return (
                <Alert
                  severity="error"
                  action={needsConnect ? (
                    <Button
                      size="small"
                      color="inherit"
                      startIcon={<OpenInNew />}
                      onClick={() => navigate('/photographer/settings/integrations')}
                    >
                      Koble til
                    </Button>
                  ) : undefined}
                >
                  {msg}
                </Alert>
              );
            })()}
            {createInvoice.isSuccess && createInvoice.data && (
              createInvoice.data.sendError ? (
                <Alert severity="warning">
                  Salgsordre #{createInvoice.data.salesOrderNumber ?? createInvoice.data.salesOrderId.slice(0, 8)} er
                  opprettet i PowerOffice, men automatisk faktura-sending ble blokkert
                  ({createInvoice.data.sendError.status}). Du må sende fakturaen manuelt fra
                  PowerOffice GO → Salg → Salgsordre. Kontakt PO support hvis det skyldes
                  manglende privilegium på tenant-nivå.
                </Alert>
              ) : (
                <Alert severity="success">
                  {createInvoice.data.alreadyInvoiced
                    ? `Allerede fakturert (salgsordre ${createInvoice.data.salesOrderNumber ?? createInvoice.data.salesOrderId.slice(0, 8)})`
                    : createInvoice.data.salesOrderNumber
                      ? `Faktura sendt til kunde via PowerOffice (salgsordre #${createInvoice.data.salesOrderNumber}). Fakturanummer tildeles av PO ved postering.`
                      : 'Faktura er sendt til kunde via PowerOffice. Du finner den i PowerOffice GO under Salg → Salgsordre.'}
                </Alert>
              )
            )}
          </Stack>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Collections /> Leveranse til klient (UniversalShowcase)
          </Typography>
          <Button
            size="small"
            startIcon={<Add />}
            variant="contained"
            onClick={() => { setGalleryDraft({ ...galleryDraft, projectTitle: p.title }); setGalleryOpen(true); }}
            disabled={!p.clientEmail}
          >
            Publiser leveranse
          </Button>
        </Stack>
        {!p.clientEmail && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Knytt en klient til prosjektet for å opprette et galleri.
          </Alert>
        )}
        {data.galleries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Ingen leveranser ennå. Klikk "Publiser leveranse" for å lage et delbart galleri.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {data.galleries.map((g) => (
              <Paper key={g.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" fontWeight={500}>{g.title}</Typography>
                      <Chip
                        size="small"
                        color={g.status === 'completed' ? 'success' : 'primary'}
                        label={g.status === 'completed' ? 'Ferdig' : 'Aktiv'}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Opprettet {formatDate(g.createdAt)}
                      {g.completedAt ? ` · Ferdig ${formatDate(g.completedAt)}` : ''}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Tooltip title="Detalj — bilder, aktivitet, godkjenning">
                    <Button
                      size="small"
                      startIcon={<Visibility />}
                      onClick={() => navigate(`/photographer/galleries/${g.id}`)}
                    >
                      Åpne detalj
                    </Button>
                  </Tooltip>
                  <Tooltip title="Forhåndsvis som kunde">
                    <Button
                      size="small"
                      startIcon={<OpenInNew />}
                      variant="outlined"
                      onClick={() => window.open(`/client-gallery/${g.accessToken}`, '_blank')}
                    >
                      Klient-visning
                    </Button>
                  </Tooltip>
                  <Tooltip title="Kopier delbar URL">
                    <Button
                      size="small"
                      startIcon={<ContentCopy />}
                      variant="outlined"
                      onClick={() => copyShareUrl(g.accessToken)}
                    >
                      Kopier link
                    </Button>
                  </Tooltip>
                  <Tooltip title="Send link til klient på epost">
                    <Button
                      size="small"
                      startIcon={<Send />}
                      variant="outlined"
                      color="primary"
                      onClick={() => { setNotifyOpen(g.id); setNotifyMessage(''); }}
                    >
                      Send på epost
                    </Button>
                  </Tooltip>
                  {g.status !== 'completed' && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      onClick={() => markComplete.mutate(g.id)}
                      disabled={markComplete.isPending}
                      sx={{ ml: 'auto' }}
                    >
                      Marker som ferdig
                    </Button>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4500}
        onClose={() => setSnackbar(null)}
      >
        <Alert
          severity={snackbar?.severity ?? 'info'}
          onClose={() => setSnackbar(null)}
          sx={{ width: '100%' }}
        >
          {snackbar?.msg}
        </Alert>
      </Snackbar>

      <Dialog open={!!meetOpen} onClose={() => setMeetOpen(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <VideoCall color="primary" /> Planlegg Google Meet
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Møtet legges i din Google Calendar med klienten ({p.clientEmail ?? 'ingen epost'})
              som deltaker. Link kopieres til utklippstavlen + lagres på milepælen.
            </Alert>
            <TextField
              label="Tittel" size="small" fullWidth
              value={meetDraft.title}
              onChange={(e) => setMeetDraft((s) => ({ ...s, title: e.target.value }))}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Dato" size="small" type="date" fullWidth required
                InputLabelProps={{ shrink: true }}
                value={meetDraft.date}
                onChange={(e) => setMeetDraft((s) => ({ ...s, date: e.target.value }))}
              />
              <TextField
                label="Tid" size="small" type="time" fullWidth required
                InputLabelProps={{ shrink: true }}
                value={meetDraft.time}
                onChange={(e) => setMeetDraft((s) => ({ ...s, time: e.target.value }))}
              />
              <TextField
                label="Min" size="small" type="number" sx={{ width: 100 }}
                inputProps={{ min: 15, step: 15 }}
                value={meetDraft.duration}
                onChange={(e) => setMeetDraft((s) => ({ ...s, duration: Number(e.target.value) || 60 }))}
              />
            </Stack>
            <TextField
              label="Beskrivelse (vises i calendar-event)" size="small" fullWidth multiline rows={2}
              value={meetDraft.description}
              onChange={(e) => setMeetDraft((s) => ({ ...s, description: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMeetOpen(null)}>Avbryt</Button>
          <Button
            variant="contained"
            startIcon={<VideoCall />}
            disabled={!meetDraft.date || !meetDraft.time || scheduleMeet.isPending}
            onClick={() => meetOpen && scheduleMeet.mutate({ ...meetDraft, milestoneId: meetOpen })}
          >
            Opprett møte
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!notifyOpen} onClose={() => setNotifyOpen(null)} fullWidth maxWidth="sm">
        <DialogTitle>Send galleri til {p.clientName ?? 'klient'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Sendes til <strong>{p.clientEmail}</strong>. Lar du meldingen være tom,
              brukes en standard-tekst.
            </Typography>
            <TextField
              label="Personlig melding (valgfritt)"
              fullWidth
              multiline
              rows={4}
              placeholder={`Hei ${p.clientName ?? ''}, bildene fra ${p.title} er klare. Si fra hvis dere har kommentarer!`}
              value={notifyMessage}
              onChange={(e) => setNotifyMessage(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotifyOpen(null)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={notifyClient.isPending}
            onClick={() => notifyClient.mutate({
              galleryId: notifyOpen!,
              customMessage: notifyMessage.trim(),
            })}
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Rediger prosjekt</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Tittel" size="small" fullWidth
              value={edits.title ?? p.title}
              onChange={(e) => setEdits((s) => ({ ...s, title: e.target.value }))}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Dato" size="small" type="date" fullWidth
                InputLabelProps={{ shrink: true }}
                value={edits.eventDate ?? (p.eventDate ?? '')}
                onChange={(e) => setEdits((s) => ({ ...s, eventDate: e.target.value }))}
              />
              <TextField
                label="Status" size="small" fullWidth
                value={edits.status ?? p.status}
                onChange={(e) => setEdits((s) => ({ ...s, status: e.target.value }))}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Avtalt pris" size="small" type="number" fullWidth
                value={edits.servicePrice ?? p.servicePrice}
                onChange={(e) => setEdits((s) => ({ ...s, servicePrice: Number(e.target.value) }))}
              />
              <TextField
                label="Timepris" size="small" type="number" fullWidth
                value={edits.hourlyRate ?? p.hourlyRate}
                onChange={(e) => setEdits((s) => ({ ...s, hourlyRate: Number(e.target.value) }))}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Estimerte timer" size="small" type="number" fullWidth
                value={edits.estimatedHours ?? (p.estimatedHours ?? '')}
                onChange={(e) => setEdits((s) => ({ ...s, estimatedHours: Number(e.target.value) }))}
              />
              <TextField
                label="Faste kostnader" size="small" type="number" fullWidth
                value={edits.costOverhead ?? p.costOverhead}
                onChange={(e) => setEdits((s) => ({ ...s, costOverhead: Number(e.target.value) }))}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Avbryt</Button>
          <Button variant="contained" disabled={update.isPending} onClick={() => update.mutate(edits)}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={timeOpen} onClose={() => setTimeOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Logg timer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Hva jobbet du med?" size="small" fullWidth required
              placeholder="Redigering, kunde-møte, skytedag..."
              value={timeDraft.taskDescription}
              onChange={(e) => setTimeDraft((s) => ({ ...s, taskDescription: e.target.value }))}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Timer" size="small" type="number" fullWidth required
                inputProps={{ step: 0.25, min: 0 }}
                value={timeDraft.hoursSpent}
                onChange={(e) => setTimeDraft((s) => ({ ...s, hoursSpent: e.target.value }))}
              />
              <TextField
                label="Dato" size="small" type="date" fullWidth
                InputLabelProps={{ shrink: true }}
                value={timeDraft.dateWorked}
                onChange={(e) => setTimeDraft((s) => ({ ...s, dateWorked: e.target.value }))}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Bruker timepris {p.hourlyRate.toLocaleString('nb-NO')} kr fra prosjektet.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTimeOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={!timeDraft.taskDescription.trim() || !timeDraft.hoursSpent || logTime.isPending}
            onClick={() => logTime.mutate(timeDraft)}
          >
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={galleryOpen} onClose={() => setGalleryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Publiser leveranse</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Klienten <strong>{p.clientName}</strong> ({p.clientEmail}) får en delbar URL.
              Bilder legges til etter publisering — du kan også laste opp via iPad-appen.
            </Alert>
            <TextField
              label="Galleri-tittel" size="small" fullWidth
              value={galleryDraft.projectTitle}
              onChange={(e) => setGalleryDraft({ ...galleryDraft, projectTitle: e.target.value })}
            />
            <TextField
              label="Beskrivelse til klient (valgfritt)"
              size="small" fullWidth multiline rows={2}
              placeholder="F.eks. 'Her er bildene fra deres bryllup — gi oss beskjed innen 14 dager om favoritter for utskrift.'"
              value={galleryDraft.description}
              onChange={(e) => setGalleryDraft({ ...galleryDraft, description: e.target.value })}
            />
            <Divider />
            <FormControlLabel
              control={
                <Switch
                  checked={galleryDraft.allowDownload}
                  onChange={(e) => setGalleryDraft({ ...galleryDraft, allowDownload: e.target.checked })}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Tillat nedlasting</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Klienten kan laste ned full-størrelse versjoner
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={galleryDraft.requireApproval}
                  onChange={(e) => setGalleryDraft({ ...galleryDraft, requireApproval: e.target.checked })}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Krev formell godkjenning</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Klient må klikke "Godkjent" før de får tilgang til full oppløsning
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={galleryDraft.isPublic}
                  onChange={(e) => setGalleryDraft({ ...galleryDraft, isPublic: e.target.checked })}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Vis offentlig i portfolio</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Inkluder utvalgte bilder i din UniversalShowcase (krever klient-samtykke)
                  </Typography>
                </Box>
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGalleryOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={createGallery.isPending}
            onClick={() => createGallery.mutate(galleryDraft)}
          >
            Publiser
          </Button>
        </DialogActions>
      </Dialog>

      <ProjectChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        projectId={projectId!}
        clientName={p.clientName}
        clientEmail={p.clientEmail}
      />
    </Box>
  );
}
