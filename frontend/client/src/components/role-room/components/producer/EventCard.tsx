/**
 * EventCard — polert arrangement-kort (porter wf30 rr-agent-events): dato-chip,
 * plattform-tag, navn, tid, sted, beskrivelse, publisert-status og en footer om
 * at Agenten samler påmeldinger som leads. Presentasjon for ett IG-arrangement.
 */

import * as React from 'react';
import { Box, Stack, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EventIcon from '@mui/icons-material/Event';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PlaceIcon from '@mui/icons-material/Place';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DeleteIcon from '@mui/icons-material/Delete';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

const MND = ['JAN', 'FEB', 'MAR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DES'];

export interface EventCardEvent {
  id: string;
  title: string | null;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  venue: string | null;
  rsvpCount?: number | null;
}

export interface EventCardProps {
  event: EventCardEvent;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = /^\d+$/.test(v) ? new Date(Number(v) * 1000) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function fmtTime(d: Date | null): string {
  return d ? d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : '';
}
function fmtDateLong(d: Date | null): string {
  return d ? d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' }) : '';
}

export default function EventCard({ event, onDelete, deleting }: EventCardProps): React.ReactElement {
  const start = parseDate(event.startTime);
  const end = parseDate(event.endTime);
  const timeRange = start
    ? `${fmtDateLong(start)} · ${fmtTime(start)}${end ? `–${fmtTime(end)}` : ''}`
    : '';

  return (
    <Box sx={{
      position: 'relative', borderRadius: 3, p: { xs: 1.8, md: 2.2 }, overflow: 'hidden',
      border: '1px solid rgba(167,139,250,0.2)',
      background: 'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.16), transparent 55%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
    }}>
      <Stack direction="row" spacing={1.6} alignItems="flex-start">
        {/* Dato-chip */}
        <Box sx={{ width: 52, flexShrink: 0, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(167,139,250,0.28)', textAlign: 'center' }}>
          <Box sx={{ background: GRAD, py: 0.3 }}>
            <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.08em' }}>{start ? MND[start.getMonth()] : '—'}</Typography>
          </Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: INK, py: 0.3, lineHeight: 1 }}>{start ? start.getDate() : '—'}</Typography>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" alignItems="center" spacing={0.6}>
              <EventIcon sx={{ fontSize: 13, color: ACCENT }} />
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Instagram-arrangement</Typography>
            </Stack>
            {onDelete ? (
              <Tooltip title="Slett arrangement">
                <span><IconButton size="small" onClick={() => onDelete(event.id)} disabled={deleting} sx={{ color: 'rgba(248,113,113,0.7)', p: 0.3 }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton></span>
              </Tooltip>
            ) : null}
          </Stack>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: INK, lineHeight: 1.15, mb: 0.8 }}>{event.title || '(uten tittel)'}</Typography>

          <Stack spacing={0.6} sx={{ mb: 1 }}>
            {timeRange ? (
              <Stack direction="row" alignItems="center" spacing={0.8}>
                <ScheduleIcon sx={{ fontSize: 15, color: ACCENT }} />
                <Typography sx={{ fontSize: 12.5, color: 'rgba(226,232,240,0.86)' }}>{timeRange}</Typography>
              </Stack>
            ) : null}
            {event.venue ? (
              <Stack direction="row" alignItems="center" spacing={0.8}>
                <PlaceIcon sx={{ fontSize: 15, color: ACCENT }} />
                <Typography sx={{ fontSize: 12.5, color: 'rgba(226,232,240,0.86)' }}>{event.venue}</Typography>
              </Stack>
            ) : null}
          </Stack>

          {event.description ? (
            <Typography sx={{ fontSize: 13, color: 'rgba(226,232,240,0.82)', lineHeight: 1.5, mb: 1.2, whiteSpace: 'pre-wrap' }}>{event.description}</Typography>
          ) : null}

          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" icon={<PhotoCameraIcon sx={{ fontSize: 13, color: '#34d399 !important' }} />}
              label="Publisert på Instagram"
              sx={{ bgcolor: 'rgba(52,211,153,0.14)', color: '#86efac', fontWeight: 700, fontSize: 10.5 }} />
            {typeof event.rsvpCount === 'number' ? (
              <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: 13, color: `${ACCENT} !important` }} />}
                label={`${event.rsvpCount} påmeldte`}
                sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: '#e9d5ff', fontWeight: 700, fontSize: 10.5 }} />
            ) : null}
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mt: 1.4, pt: 1.2, borderTop: '1px solid rgba(148,163,184,0.12)' }}>
            <SmartToyIcon sx={{ fontSize: 15, color: ACCENT }} />
            <Typography sx={{ fontSize: 11.5, color: MUTED }}>Agenten publiserer arrangementet og samler påmeldinger som nye leads.</Typography>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
