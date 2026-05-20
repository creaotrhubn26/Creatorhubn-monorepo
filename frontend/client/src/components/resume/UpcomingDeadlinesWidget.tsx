/**
 * UpcomingDeadlinesWidget — kronologisk feed av kommende deadlines
 * på tvers av alle brukerens jobbsøknader.
 *
 * Plasseres øverst i ResumeBuilder eller Dashboard. Skjules pent hvis
 * brukeren ikke har noen kommende milepæler.
 *
 * Inkluderer kalender-eksport-knapp (.ics + webcal://) slik at brukeren
 * kan abonnere fra Google/Apple Calendar.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Paper, Stack, Typography, Chip, IconButton, Button,
  Tooltip, Skeleton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  EventNote as EventIcon,
  CalendarMonth as CalendarIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

function trackGA4(eventName: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') w.gtag('event', eventName, params);
  } catch {
    /* noop */
  }
}

interface Milestone {
  id: string;
  applicationId: string;
  kind: 'application_deadline' | 'case_deadline' | 'interview' | 'expected_response' | 'custom';
  title: string;
  dueAt: string;
  jobTitle?: string;
  company?: string;
}

const KIND_LABEL: Record<Milestone['kind'], string> = {
  application_deadline: 'Søknadsfrist',
  case_deadline: 'Case-frist',
  interview: 'Intervju',
  expected_response: 'Forventet svar',
  custom: 'Egen frist',
};

const KIND_COLOR: Record<Milestone['kind'], string> = {
  application_deadline: '#3B82F6',
  case_deadline: '#DC2626',
  interview: '#F5B82E',
  expected_response: '#9CA3AF',
  custom: '#6B7280',
};

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function urgencyColor(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return '#DC2626';
  if (d <= 1) return '#DC2626';
  if (d <= 3) return '#F5B82E';
  return '#6B7280';
}

function formatRelative(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return `forfalt for ${Math.abs(d)} d`;
  if (d === 0) return 'i dag';
  if (d === 1) return 'i morgen';
  if (d <= 14) return `om ${d} dager`;
  return new Date(iso).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
}

interface Props {
  onMilestoneClick?: (m: Milestone) => void;
  /** Skjul widget hvis ingen deadlines (default true) */
  hideIfEmpty?: boolean;
}

export const UpcomingDeadlinesWidget: React.FC<Props> = ({
  onMilestoneClick,
  hideIfEmpty = true,
}) => {
  const { user } = useAuth();
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [copiedKind, setCopiedKind] = useState<'ics' | 'webcal' | null>(null);

  const { data: milestones = [], isLoading } = useQuery<Milestone[]>({
    queryKey: ['job-milestones-upcoming', user?.id],
    queryFn: async () => {
      const data = (await apiRequest(
        '/api/job-application-milestones/upcoming?days=14',
        { headers: { 'x-user-id': user?.id || '' } },
      )) as { milestones: Milestone[] };
      return data.milestones ?? [];
    },
    enabled: !!user?.id,
  });

  const { data: calendarInfo } = useQuery<{ icsUrl: string; webcalUrl: string }>({
    queryKey: ['job-milestones-calendar-info', user?.id],
    queryFn: async () => {
      return (await apiRequest('/api/job-application-milestones/calendar-info', {
        headers: { 'x-user-id': user?.id || '' },
      })) as { icsUrl: string; webcalUrl: string };
    },
    enabled: calendarDialogOpen && !!user?.id,
  });

  if (isLoading) {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Skeleton variant="text" width="40%" height={24} />
        <Skeleton variant="text" width="80%" />
      </Paper>
    );
  }

  if (milestones.length === 0 && hideIfEmpty) return null;

  const handleCopy = async (kind: 'ics' | 'webcal') => {
    if (!calendarInfo) return;
    const url = kind === 'ics' ? calendarInfo.icsUrl : calendarInfo.webcalUrl;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKind(kind);
      setTimeout(() => setCopiedKind(null), 2000);
      trackGA4('nextrole_calendar_url_copied', { kind });
    } catch {
      /* noop */
    }
  };

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          p: 2, mb: 2,
          background: 'linear-gradient(90deg, #F9FAFB 0%, #FAFAFA 100%)',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <EventIcon sx={{ color: '#F5B82E', fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Kommende deadlines
            </Typography>
            <Chip
              label={`${milestones.length} de neste 14 dagene`}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: 11 }}
            />
          </Stack>
          <Tooltip title="Eksporter til kalender">
            <IconButton
              size="small"
              onClick={() => {
                setCalendarDialogOpen(true);
                trackGA4('nextrole_calendar_export_opened');
              }}
            >
              <CalendarIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {milestones.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Ingen deadlines de neste 14 dagene.
          </Typography>
        )}

        <Stack spacing={0.5}>
          {milestones.slice(0, 6).map((m) => {
            const days = daysUntil(m.dueAt);
            return (
              <Stack
                key={m.id}
                direction="row"
                spacing={1}
                alignItems="center"
                onClick={() => onMilestoneClick?.(m)}
                sx={{
                  py: 0.6, px: 1,
                  borderRadius: 1,
                  cursor: onMilestoneClick ? 'pointer' : 'default',
                  '&:hover': onMilestoneClick ? { bgcolor: 'rgba(245, 184, 46, 0.08)' } : {},
                }}
              >
                <Box
                  sx={{
                    width: 8, height: 8, borderRadius: '50%',
                    bgcolor: KIND_COLOR[m.kind],
                    flexShrink: 0,
                  }}
                />
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', minWidth: 80 }}>
                  {KIND_LABEL[m.kind]}
                </Typography>
                <Typography variant="caption" color="text.primary" sx={{ flex: 1 }} noWrap>
                  {m.title}
                  {m.company && (
                    <Box component="span" sx={{ color: 'text.secondary', ml: 0.5 }}>
                      · {m.company}
                    </Box>
                  )}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <ScheduleIcon sx={{ fontSize: 12, color: urgencyColor(m.dueAt) }} />
                  <Typography
                    variant="caption"
                    sx={{ color: urgencyColor(m.dueAt), fontWeight: days <= 3 ? 700 : 500 }}
                  >
                    {formatRelative(m.dueAt)}
                  </Typography>
                </Stack>
              </Stack>
            );
          })}
        </Stack>

        {milestones.length > 6 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            +{milestones.length - 6} flere — se i Mine søknader
          </Typography>
        )}
      </Paper>

      {/* Kalender-eksport-dialog */}
      <Dialog
        open={calendarDialogOpen}
        onClose={() => setCalendarDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CalendarIcon sx={{ color: '#F5B82E' }} />
            <Typography variant="h6" component="span">Eksporter til kalender</Typography>
          </Stack>
          <IconButton onClick={() => setCalendarDialogOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">
              Abonner på en kontinuerlig kalender-feed med alle deadlines.
              Oppdateringer i NextRole synker automatisk til kalenderen din.
            </Alert>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                FOR APPLE / GOOGLE / OUTLOOK
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  value={calendarInfo?.webcalUrl ?? 'Laster …'}
                  fullWidth
                  size="small"
                  InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 12 } }}
                />
                <Button
                  variant="outlined"
                  onClick={() => handleCopy('webcal')}
                  disabled={!calendarInfo}
                  sx={{ minWidth: 56 }}
                >
                  {copiedKind === 'webcal' ? <CheckIcon /> : <CopyIcon />}
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Klikk eller lim inn lenken — kalender-appen kjenner igjen webcal:// og spør om abonnement.
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                ELLER LAST NED .ICS-FIL
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  size="small"
                  href={calendarInfo?.icsUrl ?? '#'}
                  download="nextrole-deadlines.ics"
                  disabled={!calendarInfo}
                  sx={{
                    bgcolor: '#F5B82E',
                    '&:hover': { bgcolor: '#D49B1A' },
                    color: '#1F2937',
                  }}
                  onClick={() => trackGA4('nextrole_calendar_ics_downloaded')}
                >
                  Last ned .ics
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleCopy('ics')}
                  disabled={!calendarInfo}
                >
                  {copiedKind === 'ics' ? <CheckIcon sx={{ mr: 0.5 }} /> : <CopyIcon sx={{ mr: 0.5 }} />}
                  Kopier .ics-lenke
                </Button>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalendarDialogOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UpcomingDeadlinesWidget;
