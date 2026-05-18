// Slice 9X.27 — Wedding-day live-mode for fotograf.
// Mobil-first timeline som følger Stine gjennom dagen. Current-event
// highlighted, countdown til neste, swipe-to-complete, live shot-progress
// via EXIF capture_time.

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import {
  Box, Typography, Paper, Stack, Button, IconButton, Chip, CircularProgress,
  Alert, LinearProgress, Divider, Avatar, Snackbar, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  ArrowBack, Schedule, CheckCircle, PlayArrow, AccessTime,
  Warning, PhotoCamera, FavoriteBorder, BatteryChargingFull, NavigateNext,
  Person, Phone, Sms, RadioButtonUnchecked, CheckCircleOutline,
  CloudOff, CloudDone, Sync, Checklist,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { enqueueOrFetch, onQueueChange, replayQueue } from '@/lib/offlineQueue';
import MileagePanel from '@/components/photographer/MileagePanel';
import ExpenseQuickCapture from '@/components/wedding/ExpenseQuickCapture';
import GalleryDeliveryPanel from '@/components/wedding/GalleryDeliveryPanel';
import AssistantsPanel from '@/components/wedding/AssistantsPanel';
import AssistantNeedsNudge from '@/components/wedding/AssistantNeedsNudge';
import { useWeddingWebSocket } from '@/hooks/useWeddingWebSocket';

interface LiveEvent {
  id: string;
  title: string;
  description: string | null;
  photoNotes: string | null;
  scheduledTime: string | null;
  durationMinutes: number;
  estimatedShots: number | null;
  status: string;
  equipmentIds: number[];
  memoryCards: string[];
  isLive: boolean;
  isUpcoming: boolean;
  isOverdue: boolean;
  isCompleted: boolean;
  minutesUntil: number | null;
  capturedShots: number;
  shotProgress: number | null;
  startEpoch: number | null;
  endEpoch: number | null;
}

interface VIP {
  id: string;
  fullName: string;
  relation: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  capturedAt: string | null;
  isCaptured: boolean;
}

interface OvertimeInfo {
  contractedHours: number | null;
  firstEventStart: string | null;
  contractedEndAt: string | null;
  isOverContractedTime: boolean;
  minutesPastContract: number;
  active: boolean;
  activatedAt: string | null;
  hourlyRate: number | null;
  currentMinutes: number;
  estimatedFee: number | null;
}

interface LiveStatus {
  wedding: { id: string; coupleName: string; weddingDate: string };
  now: string;
  overtime: OvertimeInfo;
  current: LiveEvent | null;
  next: LiveEvent | null;
  overdue: LiveEvent[];
  completed: LiveEvent[];
  upcoming: LiveEvent[];
  allEvents: LiveEvent[];
  vips: VIP[];
  totals: {
    eventCount: number;
    completedCount: number;
    overdueCount: number;
    totalCaptured: number;
    totalEstimated: number;
    vipTotal: number;
    vipCaptured: number;
  };
}

function formatClock(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

function formatCountdown(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 0) return `${Math.abs(minutes)} min siden`;
  if (minutes < 60) return `om ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `om ${hours}t ${rest}min`;
}

export default function PhotographerWeddingDay() {
  const params = useParams<{ weddingId: string }>();
  const weddingId = params.weddingId;
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // Slice 9X.39 — Real-time push fra plan-B-aktivering osv.
  // userId hentes fra localStorage (apiRequest auto-injicerer normalt,
  // men WS-tilkobling trenger eksplisitt verdi for room-membership).
  const wsUserId = typeof window !== 'undefined' ? (localStorage.getItem('userId') || '') : '';
  useWeddingWebSocket({
    weddingId: weddingId || '',
    userId: wsUserId,
    enabled: !!weddingId && !!wsUserId,
    onEvent: (evt) => {
      if (evt.type === 'plan_b_activated') {
        const triggeredBy = evt.payload?.triggeredBy === 'couple' ? 'brudeparet' : 'fotografen';
        setSnackbar({
          severity: 'warning',
          msg: `Plan B aktivert av ${triggeredBy}: ${evt.payload?.altLabel || 'ny lokasjon'}. ${evt.payload?.eventsShifted || 0} events flyttet.`,
        });
        qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/live-status`] });
      } else if (evt.type === 'plan_b_deactivated') {
        setSnackbar({ severity: 'info', msg: 'Plan B avbrutt — tilbake til opprinnelig lokasjon.' });
        qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/live-status`] });
      } else if (evt.type === 'overtime_activated') {
        setSnackbar({ severity: 'warning', msg: 'Overtid aktivert.' });
        qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/live-status`] });
      } else if (evt.type === 'timeline_shifted') {
        setSnackbar({ severity: 'info', msg: 'Timeline-events flyttet.' });
        qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/live-status`] });
      }
    },
  });
  const [tick, setTick] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Live re-render hvert minutt for countdown
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Slice 9X.29 — offline-state + queue tracking
  useEffect(() => {
    const onOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      try {
        await replayQueue();
        qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/live-status`] });
      } finally {
        setIsSyncing(false);
      }
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const unsubscribe = onQueueChange(setQueuedCount);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsubscribe();
    };
  }, [qc, weddingId]);

  const { data, isLoading, error } = useQuery<LiveStatus>({
    queryKey: [`/api/wedding/${weddingId}/live-status`, tick],
    queryFn: () => apiRequest(`/api/wedding/${weddingId}/live-status`),
    enabled: !!weddingId,
    refetchInterval: 30000, // refetch hvert 30s for shot-count
  });

  // Slice 9X.30 — shift-prompt state
  const [shiftPrompt, setShiftPrompt] = useState<{ eventId: string; overrunMinutes: number } | null>(null);

  // Slice 9X.31 — overtime
  const activateOvertime = useMutation<unknown, Error, { hourlyRate?: number }>({
    mutationFn: (body) => apiRequest(`/api/wedding/${weddingId}/activate-overtime`, {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/live-status`] });
      setSnackbar({ msg: '⏰ Overtid aktivert. Note lagt til CRM.', severity: 'success' });
    },
  });

  const shiftFollowing = useMutation<{ shifted: number }, Error, { eventId: string; offsetMinutes: number }>({
    mutationFn: ({ eventId, offsetMinutes }) =>
      apiRequest(`/api/wedding/${weddingId}/timeline-events/${eventId}/shift-following`, {
        method: 'POST', body: JSON.stringify({ offsetMinutes }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: ({ shifted }) => {
      qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/live-status`] });
      setShiftPrompt(null);
      setSnackbar({ msg: `${shifted} senere events shiftet`, severity: 'success' });
    },
  });

  const completeEvent = useMutation<{ queued: boolean }, Error, string>({
    mutationFn: async (eventId) => {
      const result = await enqueueOrFetch(
        `/api/wedding/${weddingId}/timeline-events/${eventId}`,
        {
          method: 'PATCH', body: JSON.stringify({ status: 'completed' }),
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        },
      );
      if (result.queued) return { queued: true };
      if (!result.response.ok) throw new Error(`HTTP ${result.response.status}`);
      return { queued: false };
    },
    onSuccess: (result, eventId) => {
      qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/live-status`] });
      setSnackbar({
        msg: result.queued ? '⏳ Lagret offline — synker når signal kommer' : 'Event markert som ferdig',
        severity: result.queued ? 'info' : 'success',
      });
      // Slice 9X.30 — sjekk om eventet ble markert ferdig SENT (etter end-tid)
      // og foreslå auto-shift av resten av dagen
      if (!result.queued && data) {
        const ev = data.allEvents.find((e) => e.id === eventId);
        if (ev?.endEpoch) {
          const overrunMs = Date.now() - ev.endEpoch;
          const overrunMinutes = Math.round(overrunMs / 60000);
          if (overrunMinutes >= 5) {
            setShiftPrompt({ eventId, overrunMinutes });
          }
        }
      }
    },
  });

  const startEvent = useMutation<unknown, Error, string>({
    mutationFn: (eventId) => apiRequest(
      `/api/wedding/${weddingId}/timeline-events/${eventId}`,
      {
        method: 'PATCH', body: JSON.stringify({ status: 'in_progress' }),
        headers: { 'Content-Type': 'application/json' },
      },
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/live-status`] });
    },
  });

  // Slice 9X.28 + 9X.29 — VIP capture-toggle med offline-queue
  const toggleVipCapture = useMutation<{ queued: boolean }, Error, { contactId: string; captured: boolean }>({
    mutationFn: async ({ contactId, captured }) => {
      const result = await enqueueOrFetch(
        `/api/wedding/${weddingId}/vip-contacts/${contactId}/capture`,
        {
          method: 'PATCH', body: JSON.stringify({ captured }),
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        },
      );
      if (result.queued) return { queued: true };
      if (!result.response.ok) throw new Error(`HTTP ${result.response.status}`);
      return { queued: false };
    },
    onSuccess: (result, vars) => {
      qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/live-status`] });
      if (vars.captured) {
        setSnackbar({
          msg: result.queued ? '⏳ Lagret offline' : '✓ VIP markert som fanget',
          severity: result.queued ? 'info' : 'success',
        });
      }
    },
  });

  const now = useMemo(() => new Date(), [tick]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Kunne ikke laste live-status.</Alert>
      </Box>
    );
  }

  const overallProgress = data.totals.totalEstimated > 0
    ? Math.min(100, Math.round((data.totals.totalCaptured / data.totals.totalEstimated) * 100))
    : 0;

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: '#fafafa',
      pb: 8,
    }}>
      {/* Slice 9X.29 — Offline-banner øverst, alltid synlig når offline eller queue har items */}
      {(!isOnline || queuedCount > 0 || isSyncing) && (
        <Box sx={{
          position: 'sticky', top: 0, zIndex: 20,
          bgcolor: !isOnline ? 'error.main' : isSyncing ? 'info.main' : 'warning.main',
          color: 'white', px: 2, py: 0.75,
          display: 'flex', alignItems: 'center', gap: 1,
          fontSize: 13,
        }}>
          {!isOnline ? <CloudOff sx={{ fontSize: 16 }} />
            : isSyncing ? <Sync sx={{ fontSize: 16, animation: 'spin 1s linear infinite' }} />
            : <CloudDone sx={{ fontSize: 16 }} />}
          <Box sx={{ flexGrow: 1 }}>
            {!isOnline && `Offline — alt du gjør lagres og synker når signal kommer tilbake`}
            {isOnline && isSyncing && 'Synker...'}
            {isOnline && !isSyncing && queuedCount > 0 && `${queuedCount} endring${queuedCount > 1 ? 'er' : ''} venter på sync`}
          </Box>
          {isOnline && queuedCount > 0 && !isSyncing && (
            <Button size="small" variant="text" sx={{ color: 'white', minWidth: 0, p: 0.5 }}
              onClick={async () => {
                setIsSyncing(true);
                await replayQueue();
                setIsSyncing(false);
                qc.invalidateQueries({ queryKey: [`/api/wedding/${weddingId}/live-status`] });
              }}>
              Sync nå
            </Button>
          )}
        </Box>
      )}

      {/* Fixed top header */}
      <Paper
        elevation={3}
        sx={{
          position: 'sticky', top: 0, zIndex: 10,
          borderRadius: 0,
          background: 'linear-gradient(135deg, #fff5e6 0%, #ffe0c4 100%)',
        }}
      >
        <Stack direction="row" alignItems="center" sx={{ p: 1.5 }}>
          <IconButton size="small" onClick={() => navigate('/photographer/projects')}>
            <ArrowBack />
          </IconButton>
          <FavoriteBorder sx={{ color: 'primary.main', mr: 1 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>
              {data.wedding.coupleName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {now.toLocaleString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
              {' · '}
              <strong>{now.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</strong>
            </Typography>
          </Box>
          <Tooltip title="Pre-bryllup walkthrough">
            <IconButton
              size="small"
              onClick={() => navigate(`/photographer/wedding/${weddingId}/pre`)}
              sx={{ mr: 0.5 }}
            >
              <Checklist />
            </IconButton>
          </Tooltip>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Progresjon
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {data.totals.completedCount} / {data.totals.eventCount}
            </Typography>
          </Box>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={data.totals.eventCount > 0
            ? (data.totals.completedCount / data.totals.eventCount) * 100 : 0}
          sx={{ height: 4 }}
        />
      </Paper>

      <Box sx={{ p: 2, maxWidth: 600, mx: 'auto' }}>
        {/* SLICE 9X.31 — Overtid-banner */}
        {data.overtime.isOverContractedTime && !data.overtime.active && (
          <Alert
            severity="warning" sx={{ mb: 2 }}
            icon={<AccessTime />}
            action={
              <Button color="warning" variant="contained" size="small"
                onClick={() => activateOvertime.mutate({})}
                disabled={activateOvertime.isPending}>
                Aktiver overtid
              </Button>
            }
          >
            <Typography variant="body2" fontWeight={500}>
              Du har gått {data.overtime.minutesPastContract} min over avtalt tid
              ({data.overtime.contractedHours}t).
            </Typography>
            <Typography variant="caption">
              Aktiver overtid for å logge tid + få påminnelse om å fakturere ekstra.
            </Typography>
          </Alert>
        )}
        {data.overtime.active && (
          <Alert severity="info" sx={{ mb: 2 }} icon={<AccessTime />}>
            <Typography variant="body2" fontWeight={500}>
              ⏰ Overtid pågår: {Math.floor(data.overtime.currentMinutes / 60)}t {data.overtime.currentMinutes % 60}min
              {data.overtime.estimatedFee !== null && ` · ~${data.overtime.estimatedFee.toLocaleString('nb-NO')} kr`}
            </Typography>
            <Typography variant="caption">
              Note er lagt til prosjektet — husk å fakturere etterpå.
            </Typography>
          </Alert>
        )}

        {/* OVERDUE — kritisk varsel */}
        {data.overdue.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }} icon={<Warning />}>
            <Typography variant="body2" fontWeight={500}>
              {data.overdue.length} event{data.overdue.length > 1 ? 's' : ''} ikke markert ferdig
            </Typography>
            <Typography variant="caption">
              Trykk "Ferdig" på events du har avsluttet.
            </Typography>
          </Alert>
        )}

        {/* CURRENT — stort highlight-kort */}
        {data.current ? (
          <Paper sx={{
            p: 2.5, mb: 3,
            border: 3, borderColor: 'success.main',
            background: (theme) => `${theme.palette.success.main}08`,
          }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <PlayArrow color="success" />
              <Typography variant="caption" color="success.main" fontWeight={700}>
                NÅ — LIVE
              </Typography>
            </Stack>
            <Typography variant="h5" sx={{ mb: 0.5 }}>{data.current.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {formatClock(data.current.scheduledTime)} — {formatClock(
                data.current.scheduledTime
                  ? new Date(new Date(data.current.scheduledTime).getTime() + data.current.durationMinutes * 60000).toISOString()
                  : null,
              )}
              {' · '}{data.current.durationMinutes} min
            </Typography>

            {data.current.description && (
              <Typography variant="body2" sx={{ mb: 1.5 }}>{data.current.description}</Typography>
            )}

            {data.current.photoNotes && (
              <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: 'warning.50' }}>
                <Typography variant="caption" fontWeight={600} color="warning.main" sx={{ display: 'block', mb: 0.5 }}>
                  📝 Foto-noter
                </Typography>
                <Typography variant="body2">{data.current.photoNotes}</Typography>
              </Paper>
            )}

            {data.current.estimatedShots !== null && (
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="caption">
                    <PhotoCamera sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    {data.current.capturedShots} / {data.current.estimatedShots} bilder
                  </Typography>
                  <Typography variant="caption" color={
                    (data.current.shotProgress ?? 0) >= 100 ? 'success.main'
                    : (data.current.shotProgress ?? 0) >= 60 ? 'warning.main' : 'text.secondary'
                  }>
                    {data.current.shotProgress ?? 0}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, data.current.shotProgress ?? 0)}
                  color={(data.current.shotProgress ?? 0) >= 100 ? 'success'
                    : (data.current.shotProgress ?? 0) >= 60 ? 'warning' : 'primary'}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>
            )}

            {data.current.memoryCards.length > 0 && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 2 }}>
                {data.current.memoryCards.map((c) => (
                  <Chip key={c} size="small" label={c} variant="outlined" sx={{ height: 22 }} />
                ))}
              </Stack>
            )}

            <Button
              fullWidth size="large" variant="contained" color="success"
              startIcon={<CheckCircle />}
              onClick={() => completeEvent.mutate(data.current!.id)}
              disabled={completeEvent.isPending}
              sx={{ py: 1.5 }}
            >
              Marker som ferdig
            </Button>
          </Paper>
        ) : data.next ? (
          <Paper sx={{ p: 2.5, mb: 3, textAlign: 'center', bgcolor: 'background.paper' }}>
            <AccessTime sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Neste event
            </Typography>
            <Typography variant="h6" sx={{ mb: 0.5 }}>{data.next.title}</Typography>
            <Typography variant="body2" color="primary.main" fontWeight={600}>
              {formatClock(data.next.scheduledTime)} — {formatCountdown(data.next.minutesUntil)}
            </Typography>
            {data.next.minutesUntil !== null && data.next.minutesUntil <= 15 && (
              <Button
                fullWidth size="medium" variant="contained" sx={{ mt: 2 }}
                startIcon={<PlayArrow />}
                onClick={() => startEvent.mutate(data.next!.id)}
              >
                Start nå
              </Button>
            )}
          </Paper>
        ) : (
          <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
            <CheckCircle color="success" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h6">Dagen er ferdig!</Typography>
            <Typography variant="body2" color="text.secondary">
              {data.totals.totalCaptured} bilder fanget · Last opp og publiser galleri.
            </Typography>
          </Paper>
        )}

        {/* SLICE 9X.28 — VIP-CHECKLIST */}
        {data.vips.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                MÅ-FOTOGRAFERES ({data.totals.vipCaptured}/{data.totals.vipTotal})
              </Typography>
              <Typography variant="caption" color={
                data.totals.vipCaptured === data.totals.vipTotal ? 'success.main'
                : data.totals.vipCaptured > 0 ? 'primary.main' : 'text.secondary'
              } fontWeight={500}>
                {Math.round((data.totals.vipCaptured / data.totals.vipTotal) * 100)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(data.totals.vipCaptured / data.totals.vipTotal) * 100}
              color={data.totals.vipCaptured === data.totals.vipTotal ? 'success' : 'primary'}
              sx={{ height: 6, borderRadius: 1, mb: 1.5 }}
            />
            <Stack spacing={1}>
              {data.vips.map((vip) => (
                <Paper
                  key={vip.id}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    bgcolor: vip.isCaptured ? 'success.50' : 'background.paper',
                    borderColor: vip.isCaptured ? 'success.light' : 'divider',
                    opacity: vip.isCaptured ? 0.7 : 1,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton
                      size="small"
                      onClick={() => toggleVipCapture.mutate({
                        contactId: vip.id, captured: !vip.isCaptured,
                      })}
                      disabled={toggleVipCapture.isPending}
                      sx={{ p: 0.5 }}
                    >
                      {vip.isCaptured
                        ? <CheckCircle color="success" sx={{ fontSize: 28 }} />
                        : <RadioButtonUnchecked color="action" sx={{ fontSize: 28 }} />}
                    </IconButton>
                    <Avatar sx={{
                      width: 32, height: 32, fontSize: 13,
                      bgcolor: vip.isCaptured ? 'success.main' : 'primary.main',
                    }}>
                      {vip.fullName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={500}
                        sx={{
                          textDecoration: vip.isCaptured ? 'line-through' : 'none',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                        {vip.fullName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary"
                        sx={{ display: 'block' }}>
                        {vip.relation}
                        {vip.notes && ` · ${vip.notes.slice(0, 40)}${vip.notes.length > 40 ? '…' : ''}`}
                      </Typography>
                    </Box>
                    {vip.phone && (
                      <>
                        <IconButton size="small" color="primary"
                          onClick={() => window.location.href = `tel:${vip.phone}`}
                          aria-label={`Ring ${vip.fullName}`}>
                          <Phone fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="primary"
                          onClick={() => window.location.href = `sms:${vip.phone}`}
                          aria-label={`SMS ${vip.fullName}`}>
                          <Sms fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
            {data.totals.vipCaptured === data.totals.vipTotal && data.totals.vipTotal > 0 && (
              <Alert severity="success" sx={{ mt: 1.5 }} icon={<CheckCircle />}>
                Alle VIPs fanget! 🎉
              </Alert>
            )}
          </Box>
        )}

        {/* OVERDUE list */}
        {data.overdue.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" color="warning.main" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
              IKKE MARKERT FERDIG
            </Typography>
            <Stack spacing={1}>
              {data.overdue.map((e) => (
                <Paper key={e.id} variant="outlined" sx={{ p: 1.5, borderColor: 'warning.main' }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" fontWeight={500}>{e.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatClock(e.scheduledTime)} · {e.capturedShots} bilder fanget
                      </Typography>
                    </Box>
                    <Button size="small" startIcon={<CheckCircle />}
                      onClick={() => completeEvent.mutate(e.id)}>
                      Ferdig
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}

        {/* UPCOMING */}
        {data.upcoming.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
              KOMMER OPP
            </Typography>
            <Stack spacing={1}>
              {data.upcoming.slice(0, 5).map((e) => (
                <Paper key={e.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" fontWeight={500}>{e.title}</Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          {formatClock(e.scheduledTime)} · {e.durationMinutes} min
                        </Typography>
                        {e.estimatedShots !== null && (
                          <Chip size="small" label={`~${e.estimatedShots} bilder`}
                            variant="outlined" sx={{ height: 16, fontSize: 10 }} />
                        )}
                      </Stack>
                    </Box>
                    <Typography variant="caption" color="primary.main" fontWeight={500}>
                      {formatCountdown(e.minutesUntil)}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}

        {/* COMPLETED — collapsed liste */}
        {data.completed.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
              FERDIG ({data.completed.length})
            </Typography>
            <Stack spacing={0.5}>
              {data.completed.map((e) => (
                <Stack key={e.id} direction="row" spacing={1} alignItems="center"
                  sx={{ opacity: 0.6, fontSize: 13 }}>
                  <CheckCircle color="success" sx={{ fontSize: 16 }} />
                  <Typography variant="caption" sx={{ flexGrow: 1, textDecoration: 'line-through' }}>
                    {formatClock(e.scheduledTime)} · {e.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {e.capturedShots} bilder
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}

        {/* Slice 9X.33 — Kjøregodtgjørelse fra timeline + Vegvesen-bil */}
        <Box sx={{ mt: 3 }}>
          <MileagePanel weddingId={weddingId} />
        </Box>

        {/* Slice 9X.40 — Hurtigregistrering av utlegg + FAB */}
        <Box sx={{ mt: 3 }}>
          <ExpenseQuickCapture weddingId={weddingId} />
        </Box>

        {/* Slice 9X.42 — Galleri-leveranse-status */}
        <Box sx={{ mt: 3 }}>
          <GalleryDeliveryPanel weddingId={weddingId} />
        </Box>

        {/* Slice 9X.44 + 9X.52 — Assistent-fotografer + nudge */}
        <Box sx={{ mt: 3 }}>
          <AssistantNeedsNudge weddingId={weddingId} />
          <AssistantsPanel weddingId={weddingId} />
        </Box>
      </Box>

      {/* Slice 9X.30 — Shift-following-dialog */}
      <Dialog open={!!shiftPrompt} onClose={() => setShiftPrompt(null)} fullWidth maxWidth="xs">
        <DialogTitle>Tok lengre tid enn planlagt</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Eventet tok <strong>{shiftPrompt?.overrunMinutes} min</strong> ekstra.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vil du shifte alle senere events tilsvarende, så timelinen forblir realistisk?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShiftPrompt(null)}>Behold</Button>
          <Button
            variant="contained"
            disabled={shiftFollowing.isPending}
            onClick={() => shiftPrompt && shiftFollowing.mutate({
              eventId: shiftPrompt.eventId,
              offsetMinutes: shiftPrompt.overrunMinutes,
            })}
          >
            Shift +{shiftPrompt?.overrunMinutes} min
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar?.severity ?? 'info'}
          onClose={() => setSnackbar(null)} sx={{ width: '100%' }}>
          {snackbar?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
