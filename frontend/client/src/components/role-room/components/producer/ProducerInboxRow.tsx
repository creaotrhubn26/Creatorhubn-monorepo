/**
 * ProducerInboxRow — polert innboks-rad (porter wf29 rr-agent-inbox) for
 * produsent-innboksen i CastingPlannerPanel-headeren. Avatar (initialer),
 * type-ikon, tittel, melding, tid og ulest-markering + handlinger.
 */

import * as React from 'react';
import { Box, Stack, Typography, Button, Chip } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import type { ProducerProjectNotification } from '../../services/producerWorkflowService';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

export interface ProducerInboxRowProps {
  item: ProducerProjectNotification;
  onRead: (id: string) => void;
  onResolve: (id: string) => void;
  onArchive: (id: string) => void;
}

function initials(s: string): string {
  const p = s.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '•';
  return ((p[0][0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

function typeIcon(t: string): React.ReactElement {
  const k = t.toLowerCase();
  if (/brief|intake/.test(k)) return <AssignmentIcon sx={{ fontSize: 14 }} />;
  if (/godkjenn|approv|accept/.test(k)) return <CheckCircleIcon sx={{ fontSize: 14 }} />;
  if (/endring|change|revisjon|revision/.test(k)) return <EditIcon sx={{ fontSize: 14 }} />;
  if (/lever|deliver/.test(k)) return <LocalShippingIcon sx={{ fontSize: 14 }} />;
  if (/kommentar|comment/.test(k)) return <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />;
  if (/dm|melding|message/.test(k)) return <MailOutlineIcon sx={{ fontSize: 14 }} />;
  if (/omtale|mention|review/.test(k)) return <StarOutlineIcon sx={{ fontSize: 14 }} />;
  return <NotificationsNoneIcon sx={{ fontSize: 14 }} />;
}

function relTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'nå';
  if (mins < 60) return `${mins} min siden`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}t siden`;
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

export default function ProducerInboxRow({ item, onRead, onResolve, onArchive }: ProducerInboxRowProps): React.ReactElement {
  const label = item.inbox_type || item.event_type || 'Varsel';
  const who = item.client_name || item.title || 'Varsel';
  const isResolved = Boolean(item.resolved_at);
  const unread = !item.read;

  return (
    <Box sx={{
      p: 1.3, borderRadius: 2.4,
      border: unread ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.08)',
      bgcolor: unread ? 'rgba(168,85,247,0.08)' : 'rgba(15,23,42,0.52)',
    }}>
      <Stack direction="row" spacing={1.3} alignItems="flex-start">
        {/* Avatar */}
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', background: GRAD, color: '#fff', fontWeight: 800, fontSize: 14 }}>
            {initials(who)}
          </Box>
          <Box sx={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: '#100923', border: '1px solid rgba(167,139,250,0.4)', color: ACCENT }}>
            {typeIcon(label)}
          </Box>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mb: 0.2 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.title}</Typography>
            {unread ? <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ACCENT, flexShrink: 0 }} /> : null}
          </Stack>
          {item.message ? (
            <Typography sx={{ fontSize: 12.5, color: 'rgba(226,232,240,0.78)', lineHeight: 1.4, mb: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.message}</Typography>
          ) : null}
          <Stack direction="row" alignItems="center" spacing={0.7} flexWrap="wrap" useFlexGap>
            <Chip size="small" icon={React.cloneElement(typeIcon(label), { sx: { fontSize: 12, color: `${ACCENT} !important` } })} label={label}
              sx={{ height: 19, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(168,85,247,0.14)', color: '#e9d5ff' }} />
            {isResolved ? <Chip size="small" label="Løst" sx={{ height: 19, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0' }} /> : null}
            <Typography sx={{ fontSize: 11, color: MUTED }}>{[item.client_name, relTime(item.created_at)].filter(Boolean).join(' · ')}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.4} sx={{ mt: 0.6 }}>
            {unread ? <Button size="small" onClick={() => onRead(item.id)} sx={{ textTransform: 'none', color: ACCENT, fontWeight: 700, fontSize: '0.72rem', minWidth: 0, px: 0.8 }}>Lest</Button> : null}
            {!isResolved ? <Button size="small" onClick={() => onResolve(item.id)} sx={{ textTransform: 'none', color: '#86efac', fontWeight: 700, fontSize: '0.72rem', minWidth: 0, px: 0.8 }}>Løs</Button> : null}
            <Button size="small" onClick={() => onArchive(item.id)} sx={{ textTransform: 'none', color: 'rgba(226,232,240,0.6)', fontWeight: 700, fontSize: '0.72rem', minWidth: 0, px: 0.8 }}>Arkiver</Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
