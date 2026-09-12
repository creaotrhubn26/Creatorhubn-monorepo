/**
 * ClientDeliveryTimeline — viser klienten hvilken fase fotografen er i.
 *
 * Henter GET /api/client/gallery/:accessToken/timeline og rendrer en
 * horisontal stepper-strip med 12 standard-stages (Booking → Levert).
 * Hvert steg har én av disse tilstandene:
 *   - pending     (grå)
 *   - in_progress (oransje, pulserer hvis aktiv)
 *   - completed   (grønn checkmark)
 *   - blocked     (rødt, viser blocked_reason)
 *   - skipped     (skjult — vises ikke)
 *
 * Hovedformål: kundene skal ikke lure på "Hvor langt har Bjarne kommet?
 * Når kan vi forvente R1?" — de ser det selv.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Tooltip,
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as PendingIcon,
  PlayCircleFilled as InProgressIcon,
  Block as BlockedIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';

interface Milestone {
  id: string;
  stage: string;
  order: number;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
  estimatedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
}

interface TimelineResponse {
  success: boolean;
  milestones: Milestone[];
}

interface Props {
  accessToken: string;
  galleryPassword?: string | null;
  /** Refetch-intervall (ms). Default 30 sek. */
  pollIntervalMs?: number;
  /** Synlig variant: 'compact' (bar) eller 'detailed' (kort med detaljer). */
  variant?: 'compact' | 'detailed';
}

const STAGE_LABELS: Record<string, string> = {
  booking: 'Booking',
  pre_shoot: 'Forberedelser',
  shoot_day: 'Fotografering',
  selection: 'Utvalg',
  editing: 'Redigering',
  color_grade: 'Fargekorrigering',
  audio_mix: 'Lyd',
  r1_delivered: 'R1',
  client_review: 'Din review',
  r2_delivered: 'R2',
  final_delivered: 'Endelig versjon',
  archived: 'Arkivert',
};

const statusColor = (
  status: Milestone['status'],
): { bg: string; fg: string; icon: React.ReactNode } => {
  switch (status) {
    case 'completed':
      return { bg: '#dcfce7', fg: '#166534', icon: <CheckIcon fontSize="small" /> };
    case 'in_progress':
      return {
        bg: '#fed7aa',
        fg: '#9a3412',
        icon: <InProgressIcon fontSize="small" />,
      };
    case 'blocked':
      return { bg: '#fecaca', fg: '#991b1b', icon: <BlockedIcon fontSize="small" /> };
    case 'pending':
    default:
      return { bg: '#f1f5f9', fg: '#64748b', icon: <PendingIcon fontSize="small" /> };
  }
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
};

export const ClientDeliveryTimeline: React.FC<Props> = ({
  accessToken,
  galleryPassword,
  pollIntervalMs = 30_000,
  variant = 'compact',
}) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchTimeline = async () => {
      try {
        const res = await fetch(
          `/api/client/gallery/${encodeURIComponent(accessToken)}/timeline`,
          {
            credentials: 'include',
            headers: galleryPassword
              ? { 'x-gallery-password': galleryPassword }
              : undefined,
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as TimelineResponse;
        if (!cancelled) {
          setMilestones((data.milestones || []).filter((m) => m.status !== 'skipped'));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchTimeline();
    const interval = setInterval(fetchTimeline, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken, galleryPassword, pollIntervalMs]);

  if (loading && milestones.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  if (error && milestones.length === 0) {
    // Stille — vil ikke spamme klient med teknisk feilmelding
    return null;
  }
  if (milestones.length === 0) return null;

  const activeStage = milestones.find(
    (m) => m.status === 'in_progress' || m.status === 'blocked',
  );
  const nextPending = milestones.find((m) => m.status === 'pending');
  const summary = (() => {
    if (activeStage?.status === 'blocked') {
      return {
        title: 'Venter på din tilbakemelding',
        detail: activeStage.blockedReason || activeStage.label,
        color: '#fca5a5',
      };
    }
    if (activeStage) {
      const eta = activeStage.estimatedAt
        ? ` · forventet ferdig ${formatDate(activeStage.estimatedAt)}`
        : '';
      return {
        title: `Pågår: ${activeStage.label}`,
        detail: nextPending
          ? `Neste: ${nextPending.label}${eta}`
          : `${activeStage.label}${eta}`,
        color: '#fdba74',
      };
    }
    if (nextPending) {
      const eta = nextPending.estimatedAt
        ? ` (forventet ${formatDate(nextPending.estimatedAt)})`
        : '';
      return {
        title: `Neste: ${nextPending.label}${eta}`,
        detail: 'Vi gir beskjed når denne starter.',
        color: '#fff',
      };
    }
    return {
      title: 'Alt er ferdig',
      detail: 'Hele leveransen er fullført.',
      color: '#86efac',
    };
  })();

  if (variant === 'compact') {
    return (
      <Card
        sx={{
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.08)',
          bgcolor: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(8px)',
          color: '#fff',
        }}
      >
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
          >
            <Box>
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: summary.color }}
              >
                {summary.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                {summary.detail}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
              {milestones.map((m, i) => {
                const c = statusColor(m.status);
                return (
                  <Tooltip
                    key={m.id}
                    title={
                      <Box>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                          {m.label}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          {m.status === 'completed' && m.completedAt
                            ? `Ferdig ${formatDate(m.completedAt)}`
                            : m.status === 'in_progress'
                              ? m.estimatedAt
                                ? `Pågår nå, forventet ${formatDate(m.estimatedAt)}`
                                : 'Pågår nå'
                              : m.status === 'blocked'
                                ? m.blockedReason || 'Venter'
                                : m.estimatedAt
                                  ? `Forventet ${formatDate(m.estimatedAt)}`
                                  : 'Ikke startet'}
                        </Typography>
                      </Box>
                    }
                    placement="top"
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: c.bg,
                        color: c.fg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        '& > svg': { fontSize: 14 },
                        ...(m.status === 'in_progress' && {
                          animation: 'pulseRing 2s infinite',
                          '@keyframes pulseRing': {
                            '0%': { boxShadow: '0 0 0 0 rgba(154, 52, 18, 0.4)' },
                            '70%': { boxShadow: '0 0 0 6px rgba(154, 52, 18, 0)' },
                            '100%': { boxShadow: '0 0 0 0 rgba(154, 52, 18, 0)' },
                          },
                        }),
                      }}
                    >
                      {c.icon}
                    </Box>
                  </Tooltip>
                );
              })}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // detailed-variant
  return (
    <Card
      sx={{
        borderRadius: 2,
        bgcolor: 'rgba(15,23,42,0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#fff',
        backdropFilter: 'blur(8px)',
      }}
    >
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#fff' }}>
          Leveranseprosessen
        </Typography>
        <Stack spacing={1}>
          {milestones.map((m) => {
            const c = statusColor(m.status);
            return (
              <Stack
                key={m.id}
                direction="row"
                spacing={1.5}
                alignItems="center"
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: c.bg,
                    color: c.fg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {c.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>
                    {m.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    {m.status === 'completed' && m.completedAt
                      ? `Ferdig ${formatDate(m.completedAt)}`
                      : m.status === 'in_progress'
                        ? m.estimatedAt
                          ? `Pågår nå, forventet ${formatDate(m.estimatedAt)}`
                          : 'Pågår nå'
                        : m.status === 'blocked'
                          ? m.blockedReason || 'Venter'
                          : m.estimatedAt
                            ? `Forventet ${formatDate(m.estimatedAt)}`
                            : 'Ikke startet'}
                  </Typography>
                </Box>
                {m.status === 'in_progress' && (
                  <Chip
                    icon={<ScheduleIcon sx={{ fontSize: 14 }} />}
                    label="Nå"
                    size="small"
                    sx={{ height: 22, fontSize: '0.65rem', bgcolor: c.bg, color: c.fg }}
                  />
                )}
              </Stack>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ClientDeliveryTimeline;
