/**
 * ScheduleDetailsDrawer – Right-side context drawer for a single audition schedule.
 *
 * Opens when the user clicks a row; preserves context (no modal interruption).
 * Follows Roll Room design tokens: cinematic dark, gold accent, 8 px radius.
 */

import { memo, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  Button,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Movie as MovieIcon,
  AssignmentTurnedIn as CallbackIcon,
  CheckCircle as CompleteIcon,
} from '@mui/icons-material';
import type { Schedule } from '../models/casting';

// ── Design tokens (matching Roll Room) ──

const DRAWER_WIDTH = 420;
const TOUCH = 44;

const focusStyle = {
  '&:focus-visible': { outline: '3px solid #ffb800', outlineOffset: 2 },
};

// ── Status helpers ──

export type ScheduleStatus = NonNullable<Schedule['status']>;

const STATUS_META: Record<
  ScheduleStatus,
  { label: string; color: string; bg: string }
> = {
  scheduled:         { label: 'Planlagt',           color: '#ffb800', bg: 'rgba(255,184,0,0.15)' },
  confirmed:         { label: 'Bekreftet',          color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  awaiting_callback: { label: 'Venter tilbakemelding', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  completed:         { label: 'Fullført',           color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  cancelled:         { label: 'Kansellert',         color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  pool:              { label: 'Pool',               color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
};

// Build timeline: all statuses in lifecycle order
const STATUS_TIMELINE: ScheduleStatus[] = [
  'scheduled',
  'confirmed',
  'awaiting_callback',
  'completed',
  'cancelled',
  'pool',
];

// ── Component ──

export interface ScheduleDetailsDrawerProps {
  open: boolean;
  schedule: (Schedule & {
    candidateId: string;
    roleId: string;
    date: string;
    time: string;
    location: string;
    status: ScheduleStatus;
    candidateName?: string;
    roleName?: string;
    isFavorite?: boolean;
  }) | null;
  isFavorite: boolean;
  onClose: () => void;
  onEdit: (schedule: Schedule) => void;
  onDuplicate: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
  onToggleFavorite: (id: string) => void;
  onStatusChange: (id: string, status: ScheduleStatus) => void;
  getCandidateName: (id: string) => string;
  getRoleName: (id: string) => string;
}

function ScheduleDetailsDrawerInner({
  open,
  schedule,
  isFavorite,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
  onStatusChange,
  getCandidateName,
  getRoleName,
}: ScheduleDetailsDrawerProps) {
  const handleStatusChange = useCallback(
    (status: ScheduleStatus) => {
      if (schedule) onStatusChange(schedule.id, status);
    },
    [schedule, onStatusChange],
  );

  const candidateName = schedule
    ? schedule.candidateName ?? getCandidateName(schedule.candidateId)
    : '';
  const roleName = schedule
    ? schedule.roleName ?? getRoleName(schedule.roleId)
    : '';

  const meta = schedule ? STATUS_META[schedule.status] ?? STATUS_META.scheduled : STATUS_META.scheduled;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('nb-NO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const timeSlot = schedule
    ? schedule.endTime
      ? `${schedule.time} – ${schedule.endTime}`
      : schedule.time
    : '';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: DRAWER_WIDTH },
          bgcolor: '#0f0f1a',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      ModalProps={{ keepMounted: false }}
    >
      {/* ── Drawer Header ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          pt: 2.5,
          pb: 2,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            label={meta.label}
            size="small"
            sx={{
              bgcolor: meta.bg,
              color: meta.color,
              fontWeight: 700,
              fontSize: '0.75rem',
              height: 26,
            }}
          />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            Audition-detaljer
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={isFavorite ? 'Fjern favoritt' : 'Legg til favoritt'}>
            <IconButton
              size="small"
              onClick={() => schedule && onToggleFavorite(schedule.id)}
              sx={{
                color: isFavorite ? '#ffc107' : 'rgba(255,255,255,0.4)',
                minWidth: TOUCH,
                minHeight: TOUCH,
                ...focusStyle,
              }}
            >
              {isFavorite ? <StarIcon /> : <StarBorderIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Lukk (Esc)">
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ color: 'rgba(255,255,255,0.6)', minWidth: TOUCH, minHeight: TOUCH, ...focusStyle }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Main Content ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
        {!schedule ? (
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', pt: 4, textAlign: 'center' }}>
            Ingen audition valgt
          </Typography>
        ) : (
          <>
            {/* Candidate */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  bgcolor: 'rgba(16,185,129,0.2)',
                  border: '2px solid rgba(16,185,129,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <PersonIcon sx={{ color: '#10b981', fontSize: 26 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>
                  {candidateName}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Kandidat
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', mb: 2.5 }} />

            {/* Role */}
            <InfoRow icon={<MovieIcon sx={{ color: '#f48fb1', fontSize: 18 }} />} label="Rolle" value={roleName} />

            {/* Date */}
            <InfoRow
              icon={<CalendarIcon sx={{ color: '#ffb800', fontSize: 18 }} />}
              label="Dato"
              value={formatDate(schedule.date)}
            />

            {/* Timeslot */}
            <InfoRow
              icon={<TimeIcon sx={{ color: '#00d4ff', fontSize: 18 }} />}
              label="Tid"
              value={timeSlot}
            />

            {/* Location */}
            {schedule.location && (
              <InfoRow
                icon={<LocationIcon sx={{ color: '#10b981', fontSize: 18 }} />}
                label="Lokasjon"
                value={schedule.location}
              />
            )}

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', my: 2.5 }} />

            {/* Status Timeline */}
            <Typography
              variant="caption"
              sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.7px', display: 'block', mb: 1.5 }}
            >
              Status-pipeline
            </Typography>
            <Stack spacing={0.75} sx={{ mb: 3 }}>
              {STATUS_TIMELINE.map((st) => {
                const m = STATUS_META[st];
                const isActive = schedule.status === st;
                return (
                  <Button
                    key={st}
                    size="small"
                    variant={isActive ? 'contained' : 'text'}
                    onClick={() => handleStatusChange(st)}
                    startIcon={
                      st === 'completed' ? <CompleteIcon sx={{ fontSize: 16 }} /> :
                      st === 'awaiting_callback' ? <CallbackIcon sx={{ fontSize: 16 }} /> :
                      undefined
                    }
                    sx={{
                      justifyContent: 'flex-start',
                      bgcolor: isActive ? m.bg : 'transparent',
                      color: isActive ? m.color : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${isActive ? m.color + '60' : 'transparent'}`,
                      borderRadius: 1.5,
                      px: 1.5,
                      py: 0.75,
                      fontWeight: isActive ? 700 : 400,
                      fontSize: '0.8rem',
                      textAlign: 'left',
                      minHeight: 36,
                      '&:hover': {
                        bgcolor: m.bg,
                        color: m.color,
                      },
                      ...focusStyle,
                    }}
                  >
                    {m.label}
                    {isActive && (
                      <Chip
                        label="Nåværende"
                        size="small"
                        sx={{ ml: 'auto', bgcolor: m.color + '25', color: m.color, fontSize: '0.65rem', height: 18 }}
                      />
                    )}
                  </Button>
                );
              })}
            </Stack>

            {/* Notes */}
            {schedule.notes && (
              <>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', mb: 2.5 }} />
                <Typography
                  variant="caption"
                  sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.7px', display: 'block', mb: 1 }}
                >
                  Notater
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'rgba(255,184,0,0.06)',
                    border: '1px solid rgba(255,184,0,0.2)',
                    borderLeft: '3px solid #ffb800',
                    borderRadius: 1.5,
                    color: 'rgba(255,255,255,0.87)',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {schedule.notes}
                </Box>
              </>
            )}
          </>
        )}
      </Box>

      {/* ── Footer Actions ── */}
      {schedule && (
        <Box
          sx={{
            px: 2.5,
            py: 2,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            gap: 1,
            flexShrink: 0,
          }}
        >
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => onEdit(schedule)}
            sx={{
              flex: 1,
              bgcolor: '#ffb800',
              color: '#000',
              fontWeight: 700,
              minHeight: TOUCH,
              '&:hover': { bgcolor: '#e6a600' },
              ...focusStyle,
            }}
          >
            Rediger
          </Button>
          <Tooltip title="Dupliser (⌘D)">
            <IconButton
              onClick={() => onDuplicate(schedule)}
              sx={{
                minWidth: TOUCH,
                minHeight: TOUCH,
                color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 1.5,
                '&:hover': { color: '#00d4ff', borderColor: '#00d4ff' },
                ...focusStyle,
              }}
            >
              <DuplicateIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Slett">
            <IconButton
              onClick={() => onDelete(schedule)}
              sx={{
                minWidth: TOUCH,
                minHeight: TOUCH,
                color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 1.5,
                '&:hover': { color: '#ef4444', borderColor: '#ef4444' },
                ...focusStyle,
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Drawer>
  );
}

// ── Info row helper ──

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1.5,
          bgcolor: 'rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography
          variant="caption"
          sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', lineHeight: 1, mb: 0.25 }}
        >
          {label}
        </Typography>
        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>
          {value || '—'}
        </Typography>
      </Box>
    </Box>
  );
}

export const ScheduleDetailsDrawer = memo(ScheduleDetailsDrawerInner);
