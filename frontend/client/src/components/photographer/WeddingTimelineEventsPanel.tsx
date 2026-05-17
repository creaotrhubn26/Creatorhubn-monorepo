// Slice 9X.23 — fotograf-panel for å kurere wedding-timeline-events.
// Vises på /photographer/projects/:projectId når projectType=bryllup.
// Per event: tittel, planlagt tid, varighet, foto-noter (private),
// estimert antall bilder. Når bilder lastes opp, vises de auto-matchet
// per event via EXIF capture_time.

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Stack, Button, TextField, IconButton, Chip,
  CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch,
  Avatar, ImageList, ImageListItem, Collapse, Divider, Badge, Tooltip,
  Autocomplete, OutlinedInput,
} from '@mui/material';
import {
  FavoriteBorder, Add, Edit, Delete, Comment, Schedule, PhotoLibrary,
  ExpandMore, ExpandLess, Note, Visibility, VisibilityOff,
  CheckCircle, Person, AccessTime, ChatBubbleOutline,
  AutoAwesome, BatteryChargingFull, CameraAlt, FlashOn, SdStorage,
  ShoppingCart, NotificationsActive, Warning,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface WeddingEvent {
  id: string;
  title: string;
  description: string | null;
  photoNotes: string | null;
  lensNotes: string | null;
  memoryCards: string[];
  equipmentIds: number[];
  category: string;
  scheduledTime: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  estimatedShots: number | null;
  status: string;
  clientVisible: boolean;
  clientCanComment: boolean;
  commentCount: number;
  clientCommentCount: number;
  unresolvedClientCount: number;
}

interface EquipmentOption { id: number; label: string; }
interface MemoryCardOption { id: string; label: string; }

interface PurchaseLink { retailer: string; url: string; }

interface BatteryEstimate {
  totals: { totalEstimatedShots: number; totalFlashFires: number };
  cameras: Array<{
    equipmentId: number; label: string; batteryModel: string | null;
    batteryCount: number; hasBatteryGrip: boolean;
    totalCapacity: number; estimatedShotsAssigned: number;
    utilizationPct: number; status: 'ok' | 'tight' | 'shortage';
    extraBatteriesNeeded: number; recommendation: string;
    chargingReminder: string | null;
    purchaseLinks: PurchaseLink[];
  }>;
  flashes: Array<{
    equipmentId: number; label: string; batteryCount: number;
    batteryType: string | null; isRechargeable: boolean;
    chargingTimeMinutes: number | null; canRechargeDuringEvent: boolean;
    totalCapacity: number; estimatedFiresAssigned: number;
    utilizationPct: number; status: 'ok' | 'tight' | 'shortage';
    extraBatteriesNeeded: number; recommendation: string;
    chargingReminder: string | null;
    purchaseLinks: PurchaseLink[];
  }>;
  warnings?: string[];
}

interface TemplateSuggestion {
  cultureTemplate: { id: string; displayName: string };
  ceremonyStart: string;
  eventCount: number;
  events: Array<{
    title: string; description: string | null; category: string;
    scheduledTime: string; durationMinutes: number; estimatedShots: number;
    equipmentIds: number[]; clientVisible: boolean; clientCanComment: boolean;
    bufferBeforeMinutes: number; bufferAfterMinutes: number;
  }>;
  message: string;
}

interface EventComment {
  id: string;
  eventId: string;
  authorType: 'photographer' | 'client';
  authorName: string;
  content: string;
  isResolved: boolean;
  createdAt: string;
}

interface EventPhoto {
  id: string;
  filename: string;
  captureTime: string | null;
  previewUrl: string | null;
  exif: Record<string, unknown> | null;
}

const CATEGORIES = [
  { value: 'preparation', label: 'Forberedelse' },
  { value: 'ceremony', label: 'Seremoni' },
  { value: 'religious', label: 'Religiøs seremoni' },
  { value: 'photo_session', label: 'Foto-økt' },
  { value: 'reception', label: 'Reception' },
  { value: 'transport', label: 'Transport' },
];

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  weddingId: string;
}

export function WeddingTimelineEventsPanel({ weddingId }: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<WeddingEvent | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  const [draft, setDraft] = useState({
    title: '', description: '', photoNotes: '', lensNotes: '', category: 'photo_session',
    scheduledTime: '', durationMinutes: 30, bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0, estimatedShots: '', clientVisible: true, clientCanComment: true,
    equipmentIds: [] as number[], memoryCards: [] as string[],
  });
  const [showBatteryEstimate, setShowBatteryEstimate] = useState(false);

  // Hent fotografens utstyr + prosjektets minnekort for picker-options
  const { data: equipmentData } = useQuery<{ equipment: Array<{ id: number; brand: string; model: string; category: string }> }>({
    queryKey: ['/api/photographer/equipment'],
    queryFn: () => apiRequest('/api/photographer/equipment'),
  });

  const { data: memoryCardsData } = useQuery<{ cards: MemoryCardOption[] }>({
    queryKey: [`/api/wedding/${weddingId}/memory-cards`],
    queryFn: () => apiRequest(`/api/wedding/${weddingId}/memory-cards`),
    enabled: !!weddingId,
  });

  const { data: eventsData, isLoading } = useQuery<{ events: WeddingEvent[] }>({
    queryKey: [`/api/wedding/${weddingId}/timeline-events`],
    queryFn: () => apiRequest(`/api/wedding/${weddingId}/timeline-events`),
    enabled: !!weddingId,
  });

  const createEvent = useMutation<WeddingEvent, Error, typeof draft>({
    mutationFn: (body) => apiRequest(
      editingEvent
        ? `/api/wedding/${weddingId}/timeline-events/${editingEvent.id}`
        : `/api/wedding/${weddingId}/timeline-events`,
      {
        method: editingEvent ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...body,
          scheduledTime: body.scheduledTime ? new Date(body.scheduledTime).toISOString() : null,
          estimatedShots: body.estimatedShots ? Number(body.estimatedShots) : null,
        }),
        headers: { 'Content-Type': 'application/json' },
      },
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/timeline-events`] });
      qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/battery-estimate`] });
      setDialogOpen(false);
      setEditingEvent(null);
      resetDraft();
    },
  });

  const deleteEvent = useMutation<unknown, Error, string>({
    mutationFn: (id) => apiRequest(`/api/wedding/${weddingId}/timeline-events/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/timeline-events`] });
    },
  });

  const postComment = useMutation<EventComment, Error, { eventId: string; content: string }>({
    mutationFn: ({ eventId, content }) =>
      apiRequest(`/api/wedding/${weddingId}/timeline-events/${eventId}/comments`, {
        method: 'POST', body: JSON.stringify({ content }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/timeline-events`] });
      qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/timeline-events/${vars.eventId}/comments`] });
      setNewComment((s) => ({ ...s, [vars.eventId]: '' }));
    },
  });

  function resetDraft() {
    setDraft({
      title: '', description: '', photoNotes: '', lensNotes: '', category: 'photo_session',
      scheduledTime: '', durationMinutes: 30, bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0, estimatedShots: '', clientVisible: true, clientCanComment: true,
      equipmentIds: [], memoryCards: [],
    });
  }

  function openEdit(ev: WeddingEvent) {
    setEditingEvent(ev);
    setDraft({
      title: ev.title,
      description: ev.description ?? '',
      photoNotes: ev.photoNotes ?? '',
      lensNotes: ev.lensNotes ?? '',
      category: ev.category,
      scheduledTime: ev.scheduledTime ? new Date(ev.scheduledTime).toISOString().slice(0, 16) : '',
      durationMinutes: ev.durationMinutes,
      bufferBeforeMinutes: ev.bufferBeforeMinutes,
      bufferAfterMinutes: ev.bufferAfterMinutes,
      estimatedShots: ev.estimatedShots?.toString() ?? '',
      clientVisible: ev.clientVisible,
      clientCanComment: ev.clientCanComment,
      equipmentIds: ev.equipmentIds ?? [],
      memoryCards: ev.memoryCards ?? [],
    });
    setDialogOpen(true);
  }

  // Equipment-lookups
  const allEquipment = equipmentData?.equipment ?? [];
  const equipmentMap = useMemo(() =>
    new Map(allEquipment.map((e) => [e.id, `${e.brand} ${e.model}`])),
    [allEquipment]);
  const equipmentByCategory = useMemo(() => ({
    cameras: allEquipment.filter((e) => e.category === 'camera_body'),
    lenses: allEquipment.filter((e) => e.category === 'lens'),
    flashes: allEquipment.filter((e) => e.category === 'flash'),
    other: allEquipment.filter((e) => !['camera_body', 'lens', 'flash'].includes(e.category)),
  }), [allEquipment]);

  // Template suggestion
  const suggestTemplate = useMutation<TemplateSuggestion, Error, void>({
    mutationFn: () => apiRequest(`/api/wedding/${weddingId}/template-suggestion`),
  });

  const applyTemplate = useMutation<{ created: number }, Error, TemplateSuggestion['events']>({
    mutationFn: (events) => apiRequest(`/api/wedding/${weddingId}/apply-template`, {
      method: 'POST', body: JSON.stringify({ events }),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: ({ created }) => {
      qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/timeline-events`] });
      suggestTemplate.reset();
      window.alert(`${created} events lagt til fra template.`);
    },
  });

  // Battery estimate
  const { data: batteryData, refetch: refetchBattery } = useQuery<BatteryEstimate>({
    queryKey: [`/api/wedding/${weddingId}/battery-estimate`],
    queryFn: () => apiRequest(`/api/wedding/${weddingId}/battery-estimate`),
    enabled: showBatteryEstimate,
  });

  // Slice 9X.26 — sett ladings-påminnelse i Google Calendar
  const setChargingReminder = useMutation<
    { success: boolean; reminderDate: string; message: string },
    Error,
    void
  >({
    mutationFn: () => apiRequest(`/api/wedding/${weddingId}/charging-reminder`, { method: 'POST' }),
    onSuccess: (r) => window.alert(r.message),
    onError: (err: any) => {
      let msg = String(err?.message || 'Ukjent feil');
      try { const p = JSON.parse(msg); msg = p.message || p.error || msg; } catch { /* */ }
      window.alert(`Kunne ikke sette påminnelse: ${msg}`);
    },
  });

  // Aggreger shortage-warnings på tvers av kameraer + blits
  const batteryShortages = useMemo(() => {
    if (!batteryData) return [];
    return [
      ...batteryData.cameras.filter((c) => c.status === 'shortage' || c.status === 'tight'),
      ...batteryData.flashes.filter((f) => f.status === 'shortage' || f.status === 'tight'),
    ];
  }, [batteryData]);

  const events = eventsData?.events ?? [];
  const totalEstimatedShots = events.reduce((sum, e) => sum + (e.estimatedShots ?? 0), 0);

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FavoriteBorder color="primary" /> Bryllups-timeline med foto-noter
        </Typography>
        <Stack direction="row" spacing={1}>
          {events.length === 0 && (
            <Tooltip title="Foreslå komplett timeline basert på kultur + ditt utstyr">
              <Button size="small" startIcon={<AutoAwesome />} variant="outlined" color="secondary"
                onClick={() => suggestTemplate.mutate()}
                disabled={suggestTemplate.isPending}>
                {suggestTemplate.isPending ? 'Tenker...' : 'Foreslå events'}
              </Button>
            </Tooltip>
          )}
          {events.length > 0 && (
            <Button size="small" startIcon={<BatteryChargingFull />}
              variant={showBatteryEstimate ? 'contained' : 'outlined'}
              onClick={() => { setShowBatteryEstimate((s) => !s); if (!showBatteryEstimate) refetchBattery(); }}>
              Batteri-estimat
            </Button>
          )}
          <Button
            size="small"
            startIcon={<PhotoLibrary />}
            variant={showAllPhotos ? 'contained' : 'outlined'}
            onClick={() => setShowAllPhotos((s) => !s)}
          >
            {showAllPhotos ? 'Skjul samlet bilder' : 'Vis alle bilder samlet'}
          </Button>
          <Button size="small" startIcon={<Add />} variant="contained"
            onClick={() => { resetDraft(); setEditingEvent(null); setDialogOpen(true); }}>
            Nytt event
          </Button>
        </Stack>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Planlegg foto-events: tid, varighet, foto-noter (private). Brudeparet kan se og kommentere.
        Bilder du laster opp matches automatisk per event via EXIF.
      </Typography>

      {events.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
          <Chip size="small" label={`${events.length} events`} variant="outlined" />
          {totalEstimatedShots > 0 && (
            <Chip size="small" label={`~${totalEstimatedShots} estimerte bilder`} variant="outlined" color="primary" />
          )}
          {events.some((e) => e.unresolvedClientCount > 0) && (
            <Chip size="small" color="warning"
              label={`${events.reduce((sum, e) => sum + e.unresolvedClientCount, 0)} uleste klient-kommentarer`}
              icon={<Comment />} />
          )}
        </Stack>
      )}

      {showAllPhotos && <AllPhotosCollage weddingId={weddingId} />}

      {/* Template-suggestion preview */}
      {suggestTemplate.data && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: 'secondary.main', borderWidth: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesome color="secondary" /> Foreslått: {suggestTemplate.data.eventCount} events fra {suggestTemplate.data.cultureTemplate.displayName}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => suggestTemplate.reset()}>Avvis</Button>
              <Button size="small" variant="contained" color="secondary"
                disabled={applyTemplate.isPending}
                onClick={() => applyTemplate.mutate(suggestTemplate.data!.events)}>
                Legg til alle
              </Button>
            </Stack>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {suggestTemplate.data.message}
          </Typography>
          <Stack spacing={0.5} sx={{ maxHeight: 240, overflowY: 'auto' }}>
            {suggestTemplate.data.events.map((ev, idx) => (
              <Box key={idx} sx={{ fontSize: 13, py: 0.25 }}>
                <strong>{new Date(ev.scheduledTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</strong>
                {' · '}{ev.title}
                {' '}<Chip size="small" label={`${ev.durationMinutes} min`} variant="outlined"
                  sx={{ height: 16, fontSize: 10, mr: 0.5 }} />
                <Chip size="small" label={`~${ev.estimatedShots} bilder`} variant="outlined"
                  sx={{ height: 16, fontSize: 10 }} />
                {ev.equipmentIds.length > 0 && (
                  <span style={{ color: '#666', marginLeft: 6 }}>
                    {ev.equipmentIds.map((id) => equipmentMap.get(id) ?? '').filter(Boolean).join(' + ')}
                  </span>
                )}
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Battery estimate card */}
      {showBatteryEstimate && batteryData && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: 'warning.main' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BatteryChargingFull color="warning" /> Batteri-estimat for hele bryllupet
            </Typography>
            <Button size="small" startIcon={<NotificationsActive />} variant="outlined"
              onClick={() => setChargingReminder.mutate()}
              disabled={setChargingReminder.isPending}>
              Sett ladings-påminnelse
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Total ~{batteryData.totals.totalEstimatedShots} bilder · ~{batteryData.totals.totalFlashFires} blits-skudd. Estimater fra CIPA + 35% blits-rate.
          </Typography>

          {/* Slice 9X.26 — kraftig shortage-varsel + kjøps-knapper */}
          {batteryShortages.length > 0 && (
            <Alert
              severity={batteryShortages.some((s) => s.status === 'shortage') ? 'error' : 'warning'}
              icon={<Warning />}
              sx={{ mb: 2 }}
            >
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                {batteryShortages.filter((s) => s.status === 'shortage').length > 0
                  ? `${batteryShortages.filter((s) => s.status === 'shortage').length} enheter har IKKE nok batteri-kapasitet for hele dagen.`
                  : `${batteryShortages.length} enheter er nær batteri-grensen — vurder ekstra batterier.`}
              </Typography>
              <Stack spacing={0.5}>
                {batteryShortages.map((s) => (
                  <Stack key={s.equipmentId} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="caption" sx={{ minWidth: 140 }}>
                      <strong>{s.label}</strong>
                      {'batteryModel' in s && s.batteryModel && ` (${s.batteryModel})`}
                    </Typography>
                    {(s.purchaseLinks ?? []).slice(0, 2).map((link) => (
                      <Button key={link.url} size="small" startIcon={<ShoppingCart />}
                        variant="outlined" color="inherit"
                        sx={{ py: 0.25, fontSize: 11, minWidth: 0 }}
                        onClick={() => window.open(link.url, '_blank')}>
                        {link.retailer}
                      </Button>
                    ))}
                  </Stack>
                ))}
              </Stack>
            </Alert>
          )}
          {batteryData.cameras.length > 0 && (
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <Typography variant="caption" fontWeight={500}>Kameraer</Typography>
              {batteryData.cameras.map((c) => (
                <Box key={c.equipmentId}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CameraAlt color={c.status === 'ok' ? 'success' : c.status === 'tight' ? 'warning' : 'error'} fontSize="small" />
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      <strong>{c.label}</strong>
                      {c.batteryModel && <span style={{ color: '#666', fontSize: 12 }}> ({c.batteryModel})</span>}
                      {c.hasBatteryGrip && (
                        <Chip size="small" label="grip" sx={{ height: 16, fontSize: 10, ml: 0.5 }} variant="outlined" />
                      )}
                    </Typography>
                    <Typography variant="body2" color={c.status === 'shortage' ? 'error.main' : c.status === 'tight' ? 'warning.main' : 'success.main'}>
                      {c.estimatedShotsAssigned} / {c.totalCapacity} ({c.utilizationPct}%)
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 4, display: 'block' }}>
                    {c.recommendation}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
          {batteryData.flashes.length > 0 && (
            <Stack spacing={1.5}>
              <Typography variant="caption" fontWeight={500}>Blits</Typography>
              {batteryData.flashes.map((f) => (
                <Box key={f.equipmentId}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <FlashOn color={f.status === 'ok' ? 'success' : f.status === 'tight' ? 'warning' : 'error'} fontSize="small" />
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      <strong>{f.label}</strong>
                      <Chip size="small"
                        label={f.isRechargeable ? 'oppladbar' : 'AA-batterier'}
                        sx={{ height: 16, fontSize: 10, ml: 0.5 }}
                        color={f.isRechargeable ? 'success' : 'default'}
                        variant="outlined" />
                      {f.isRechargeable && f.chargingTimeMinutes && (
                        <Chip size="small" label={`${f.chargingTimeMinutes} min lading`}
                          sx={{ height: 16, fontSize: 10, ml: 0.5 }} variant="outlined" />
                      )}
                    </Typography>
                    <Typography variant="body2" color={f.status === 'shortage' ? 'error.main' : f.status === 'tight' ? 'warning.main' : 'success.main'}>
                      {f.estimatedFiresAssigned} / {f.totalCapacity} ({f.utilizationPct}%)
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 4, display: 'block' }}>
                    {f.recommendation}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
          {(batteryData.warnings ?? []).map((w, i) => (
            <Alert key={i} severity="info" sx={{ mt: 1 }}>{w}</Alert>
          ))}
        </Paper>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : events.length === 0 ? (
        <Alert severity="info">
          Ingen events ennå. Klikk "Nytt event" for å planlegge første foto-økt.
        </Alert>
      ) : (
        <Stack spacing={1.5}>
          {events.map((ev) => (
            <Paper
              key={ev.id} variant="outlined"
              sx={{ p: 2, borderColor: ev.unresolvedClientCount > 0 ? 'warning.main' : 'divider' }}
            >
              <Stack direction="row" alignItems="flex-start" spacing={2}>
                <Box sx={{ minWidth: 80, textAlign: 'center' }}>
                  <Schedule sx={{ color: 'primary.main' }} />
                  <Typography variant="caption" display="block" sx={{ fontWeight: 500, mt: 0.5 }}>
                    {ev.scheduledTime
                      ? new Date(ev.scheduledTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ev.durationMinutes} min
                  </Typography>
                </Box>

                <Box sx={{ flexGrow: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography variant="body1" fontWeight={500}>{ev.title}</Typography>
                    <Chip size="small" label={CATEGORIES.find((c) => c.value === ev.category)?.label ?? ev.category}
                      variant="outlined" sx={{ height: 18, fontSize: 11 }} />
                    {!ev.clientVisible && (
                      <Tooltip title="Ikke synlig for brudeparet">
                        <VisibilityOff sx={{ fontSize: 16, color: 'text.secondary' }} />
                      </Tooltip>
                    )}
                    {ev.estimatedShots !== null && (
                      <Chip size="small" label={`~${ev.estimatedShots} bilder`}
                        sx={{ height: 18, fontSize: 11 }} />
                    )}
                  </Stack>
                  {ev.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {ev.description}
                    </Typography>
                  )}
                  {ev.photoNotes && (
                    <Paper variant="outlined" sx={{ p: 1, mt: 1, bgcolor: 'warning.50', borderColor: 'warning.200' }}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Note sx={{ fontSize: 16, color: 'warning.main', mt: 0.25 }} />
                        <Typography variant="caption">
                          <strong>Foto-noter (privat):</strong> {ev.photoNotes}
                        </Typography>
                      </Stack>
                    </Paper>
                  )}
                  {/* Utstyr + minnekort + lens-noter — alt privat */}
                  {(ev.equipmentIds.length > 0 || ev.memoryCards.length > 0 || ev.lensNotes) && (
                    <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap">
                      {ev.equipmentIds.map((id) => (
                        <Chip key={`eq-${id}`} size="small" icon={<CameraAlt sx={{ fontSize: 12 }} />}
                          label={equipmentMap.get(id) ?? `Utstyr #${id}`}
                          variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                      ))}
                      {ev.memoryCards.map((c) => (
                        <Chip key={`mc-${c}`} size="small" icon={<SdStorage sx={{ fontSize: 12 }} />}
                          label={c} variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                      ))}
                      {ev.lensNotes && (
                        <Tooltip title={`Linse-noter: ${ev.lensNotes}`}>
                          <Chip size="small" label="Linse-noter" variant="outlined"
                            sx={{ height: 20, fontSize: 11, color: 'info.main', borderColor: 'info.main' }} />
                        </Tooltip>
                      )}
                    </Stack>
                  )}
                </Box>

                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Kommentarer">
                    <IconButton size="small" onClick={() => setExpandedEvent(expandedEvent === ev.id ? null : ev.id)}>
                      <Badge badgeContent={ev.unresolvedClientCount > 0 ? ev.unresolvedClientCount : ev.commentCount} color={ev.unresolvedClientCount > 0 ? 'warning' : 'primary'}>
                        <ChatBubbleOutline fontSize="small" />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Se matchede bilder">
                    <IconButton size="small" onClick={() => setExpandedEvent(expandedEvent === ev.id ? null : ev.id)}>
                      <PhotoLibrary fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <IconButton size="small" onClick={() => openEdit(ev)}>
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => {
                    if (confirm(`Slett "${ev.title}"?`)) deleteEvent.mutate(ev.id);
                  }}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>

              <Collapse in={expandedEvent === ev.id}>
                <Divider sx={{ my: 2 }} />
                <EventPhotos weddingId={weddingId} eventId={ev.id} />
                <Divider sx={{ my: 2 }} />
                <EventComments
                  weddingId={weddingId} eventId={ev.id}
                  draft={newComment[ev.id] ?? ''}
                  onDraftChange={(v) => setNewComment((s) => ({ ...s, [ev.id]: v }))}
                  onPost={() => {
                    if (newComment[ev.id]?.trim()) {
                      postComment.mutate({ eventId: ev.id, content: newComment[ev.id] });
                    }
                  }}
                  posting={postComment.isPending}
                />
              </Collapse>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingEvent(null); }} fullWidth maxWidth="sm">
        <DialogTitle>{editingEvent ? 'Rediger event' : 'Nytt timeline-event'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Tittel" size="small" fullWidth required
              placeholder="f.eks. Vielse-shots"
              value={draft.title}
              onChange={(e) => setDraft((s) => ({ ...s, title: e.target.value }))} />
            <FormControl size="small" fullWidth>
              <InputLabel>Kategori</InputLabel>
              <Select label="Kategori" value={draft.category}
                onChange={(e) => setDraft((s) => ({ ...s, category: e.target.value }))}>
                {CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Planlagt tid" size="small" type="datetime-local" fullWidth
              InputLabelProps={{ shrink: true }}
              value={draft.scheduledTime}
              onChange={(e) => setDraft((s) => ({ ...s, scheduledTime: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <TextField label="Varighet (min)" type="number" size="small" fullWidth
                value={draft.durationMinutes}
                onChange={(e) => setDraft((s) => ({ ...s, durationMinutes: Number(e.target.value) || 30 }))} />
              <TextField label="Buffer før" type="number" size="small" fullWidth
                value={draft.bufferBeforeMinutes}
                onChange={(e) => setDraft((s) => ({ ...s, bufferBeforeMinutes: Number(e.target.value) || 0 }))} />
              <TextField label="Buffer etter" type="number" size="small" fullWidth
                value={draft.bufferAfterMinutes}
                onChange={(e) => setDraft((s) => ({ ...s, bufferAfterMinutes: Number(e.target.value) || 0 }))} />
            </Stack>
            <TextField label="Estimert antall bilder" type="number" size="small" fullWidth
              value={draft.estimatedShots}
              onChange={(e) => setDraft((s) => ({ ...s, estimatedShots: e.target.value }))} />
            <TextField label="Beskrivelse (klient-synlig)" size="small" fullWidth multiline rows={2}
              placeholder="f.eks. Vi tar ca 80 bilder under vielsen, inkludert prosesjon og ringutveksling."
              value={draft.description}
              onChange={(e) => setDraft((s) => ({ ...s, description: e.target.value }))} />
            <TextField label="Foto-noter (PRIVAT, kun for deg)" size="small" fullWidth multiline rows={3}
              placeholder="Komposisjon, lyssetting, posisjon..."
              value={draft.photoNotes}
              onChange={(e) => setDraft((s) => ({ ...s, photoNotes: e.target.value }))} />
            <Divider sx={{ my: 1 }}>
              <Chip label="Utstyr (PRIVAT)" size="small" />
            </Divider>
            <Autocomplete
              multiple size="small"
              options={allEquipment.map((e) => e.id)}
              value={draft.equipmentIds}
              onChange={(_, v) => setDraft((s) => ({ ...s, equipmentIds: v as number[] }))}
              getOptionLabel={(id) => equipmentMap.get(id as number) ?? `#${id}`}
              groupBy={(id) => {
                const eq = allEquipment.find((e) => e.id === id);
                if (!eq) return 'Annet';
                if (eq.category === 'camera_body') return 'Kameraer';
                if (eq.category === 'lens') return 'Linser';
                if (eq.category === 'flash') return 'Blits';
                return 'Annet';
              }}
              renderInput={(params) => (
                <TextField {...params} label="Velg utstyr fra utstyrs-katalog"
                  placeholder="Søk kamera/linse/blitz" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((id, index) => (
                  <Chip {...getTagProps({ index })} key={id} size="small"
                    label={equipmentMap.get(id as number) ?? `#${id}`} />
                ))
              }
            />
            {allEquipment.length === 0 && (
              <Alert severity="info">
                Du har ikke registrert utstyr ennå. Legg til kameraer, linser og blits
                på <strong>/photographer/equipment</strong> så kan du tilordne dem her.
              </Alert>
            )}
            <Autocomplete
              multiple freeSolo size="small"
              options={(memoryCardsData?.cards ?? []).map((c) => c.label)}
              value={draft.memoryCards}
              onChange={(_, v) => setDraft((s) => ({ ...s, memoryCards: v as string[] }))}
              renderInput={(params) => (
                <TextField {...params} label="Minnekort brukt"
                  placeholder="Velg fra prosjekt eller skriv eget" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((card, index) => (
                  <Chip {...getTagProps({ index })} key={card} size="small"
                    icon={<SdStorage sx={{ fontSize: 12 }} />} label={card} />
                ))
              }
            />
            <TextField label="Linse-noter (PRIVAT)" size="small" fullWidth multiline rows={2}
              placeholder="Spesielle linse-valg, f-stop, leie-linser..."
              value={draft.lensNotes}
              onChange={(e) => setDraft((s) => ({ ...s, lensNotes: e.target.value }))} />
            <Divider sx={{ my: 1 }}>
              <Chip label="Synlighet" size="small" />
            </Divider>
            <FormControlLabel
              control={<Switch checked={draft.clientVisible}
                onChange={(e) => setDraft((s) => ({ ...s, clientVisible: e.target.checked }))} />}
              label="Synlig for brudeparet" />
            <FormControlLabel
              control={<Switch checked={draft.clientCanComment}
                onChange={(e) => setDraft((s) => ({ ...s, clientCanComment: e.target.checked }))} />}
              label="Tillat kommentarer fra brudeparet" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogOpen(false); setEditingEvent(null); }}>Avbryt</Button>
          <Button variant="contained" disabled={!draft.title.trim() || createEvent.isPending}
            onClick={() => createEvent.mutate(draft)}>
            {editingEvent ? 'Lagre' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

function EventPhotos({ weddingId, eventId }: { weddingId: string; eventId: string }) {
  const { data, isLoading } = useQuery<{ photos: EventPhoto[]; matchCount: number; windowStart: string; windowEnd: string }>({
    queryKey: [`/api/wedding/${weddingId}/timeline-events/${eventId}/photos`],
    queryFn: () => apiRequest(`/api/wedding/${weddingId}/timeline-events/${eventId}/photos`),
  });

  if (isLoading) return <CircularProgress size={20} />;
  if (!data || data.photos.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        Ingen bilder matchet ennå (EXIF capture-tid mellom {data?.windowStart
          ? new Date(data.windowStart).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
          : '—'} og {data?.windowEnd
          ? new Date(data.windowEnd).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
          : '—'}).
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {data.matchCount} bilder matchet via EXIF capture-tid
      </Typography>
      <ImageList cols={6} gap={4} sx={{ overflow: 'visible', maxHeight: 240 }}>
        {data.photos.slice(0, 24).map((p) => (
          <ImageListItem key={p.id} sx={{ borderRadius: 1, overflow: 'hidden' }}>
            {p.previewUrl ? (
              <img src={p.previewUrl} alt={p.filename} loading="lazy"
                style={{ aspectRatio: '4/3', objectFit: 'cover' }} />
            ) : (
              <Box sx={{ aspectRatio: '4/3', bgcolor: 'grey.200',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PhotoLibrary sx={{ color: 'action.disabled' }} />
              </Box>
            )}
          </ImageListItem>
        ))}
      </ImageList>
      {data.photos.length > 24 && (
        <Typography variant="caption" color="text.secondary">
          Viser 24 av {data.photos.length}
        </Typography>
      )}
    </Box>
  );
}

function EventComments({ weddingId, eventId, draft, onDraftChange, onPost, posting }: {
  weddingId: string; eventId: string; draft: string;
  onDraftChange: (v: string) => void; onPost: () => void; posting: boolean;
}) {
  const { data } = useQuery<{ comments: EventComment[] }>({
    queryKey: [`/api/wedding/${weddingId}/timeline-events/${eventId}/comments`],
    queryFn: () => apiRequest(`/api/wedding/${weddingId}/timeline-events/${eventId}/comments`),
  });
  const comments = data?.comments ?? [];

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Kommentar-tråd ({comments.length})
      </Typography>
      <Stack spacing={1} sx={{ mb: 2 }}>
        {comments.map((c) => (
          <Stack key={c.id} direction="row" spacing={1} alignItems="flex-start">
            <Avatar sx={{
              width: 24, height: 24, fontSize: 11,
              bgcolor: c.authorType === 'photographer' ? 'primary.main' : 'secondary.main',
            }}>
              {c.authorName.slice(0, 1).toUpperCase()}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="caption" fontWeight={500}>
                {c.authorName}
                <Chip size="small" sx={{ height: 14, fontSize: 9, ml: 0.5 }}
                  label={c.authorType === 'photographer' ? 'Du' : 'Klient'}
                  color={c.authorType === 'photographer' ? 'primary' : 'secondary'} />
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{c.content}</Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(c.createdAt).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" spacing={1}>
        <TextField fullWidth size="small" placeholder="Svar..." value={draft}
          onChange={(e) => onDraftChange(e.target.value)} multiline maxRows={3} />
        <Button variant="contained" size="small" disabled={!draft.trim() || posting} onClick={onPost}>
          Send
        </Button>
      </Stack>
    </Box>
  );
}

function AllPhotosCollage({ weddingId }: { weddingId: string }) {
  const { data, isLoading } = useQuery<{
    groups: Array<{ eventId: string; eventTitle: string; scheduledTime: string; photos: EventPhoto[] }>;
    ungrouped: EventPhoto[];
    total: number;
  }>({
    queryKey: [`/api/wedding/${weddingId}/all-photos`],
    queryFn: () => apiRequest(`/api/wedding/${weddingId}/all-photos`),
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>;
  if (!data) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        Alle bilder ({data.total}) — gruppert per event
      </Typography>
      <Stack spacing={2}>
        {data.groups.filter((g) => g.photos.length > 0).map((g) => (
          <Box key={g.eventId}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, display: 'block', mb: 0.5 }}>
              <AccessTime sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
              {new Date(g.scheduledTime).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
              {' · '}{g.eventTitle} ({g.photos.length})
            </Typography>
            <ImageList cols={8} gap={3} sx={{ overflow: 'visible' }}>
              {g.photos.slice(0, 16).map((p) => (
                <ImageListItem key={p.id}>
                  {p.previewUrl ? (
                    <img src={p.previewUrl} alt="" loading="lazy"
                      style={{ aspectRatio: '4/3', objectFit: 'cover', borderRadius: 2 }} />
                  ) : null}
                </ImageListItem>
              ))}
            </ImageList>
          </Box>
        ))}
        {data.ungrouped.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, display: 'block', mb: 0.5 }}>
              Uten event-match ({data.ungrouped.length})
            </Typography>
            <ImageList cols={8} gap={3} sx={{ overflow: 'visible' }}>
              {data.ungrouped.slice(0, 16).map((p) => (
                <ImageListItem key={p.id}>
                  {p.previewUrl ? (
                    <img src={p.previewUrl} alt="" loading="lazy"
                      style={{ aspectRatio: '4/3', objectFit: 'cover', borderRadius: 2 }} />
                  ) : null}
                </ImageListItem>
              ))}
            </ImageList>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
