// @ts-nocheck
/**
 * WeddingNotificationLog — Slice 9X.38
 *
 * Viser de siste 100 varslene sendt for et bryllup. Filtrerbart på type.
 * Brukes i walkthrough-siden så Stine ser hvem som ble varslet om plan-B etc.
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Stack,
  Typography,
  Chip,
  Box,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Email as EmailIcon,
  Sms as SmsIcon,
  CheckCircle as SentIcon,
  Error as FailedIcon,
  HelpOutline as SkippedIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface Notification {
  id: string;
  notificationType: string;
  recipientType: string;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  channel: 'email' | 'sms';
  subject: string | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  provider: string | null;
  errorMessage: string | null;
  triggeredBy: string | null;
  sentAt: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  plan_b_activated: 'Plan B aktivert',
  plan_b_deactivated: 'Plan B deaktivert',
  timeline_changed: 'Timeline endret',
  overtime_activated: 'Overtid aktivert',
  gallery_delivered: 'Galleri levert',
};

const RECIPIENT_LABELS: Record<string, string> = {
  photographer: 'Fotograf',
  couple: 'Brudepar',
  vip_contact: 'VIP-kontakt',
  assistant: 'Assistent',
};

const statusChip = (status: string, errorMessage: string | null) => {
  if (status === 'sent') return <Chip size="small" icon={<SentIcon fontSize="small" />} label="Levert" color="success" />;
  if (status === 'failed') return (
    <Tooltip title={errorMessage || 'Ukjent feil'}>
      <Chip size="small" icon={<FailedIcon fontSize="small" />} label="Feil" color="error" />
    </Tooltip>
  );
  if (status === 'skipped') return <Chip size="small" icon={<SkippedIcon fontSize="small" />} label="Hoppet over" />;
  return <Chip size="small" label="Pending" />;
};

interface Props {
  weddingId: string;
}

const WeddingNotificationLog: React.FC<Props> = ({ weddingId }) => {
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r: any = await apiRequest(`/api/wedding/${weddingId}/notifications`);
      setList(r.notifications || []);
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke laste varslingslogg');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [weddingId]);

  const grouped = list.reduce((acc, n) => {
    const key = `${n.notificationType}_${n.createdAt.slice(0, 16)}_${n.triggeredBy || ''}`;
    if (!acc[key]) acc[key] = { type: n.notificationType, createdAt: n.createdAt, triggeredBy: n.triggeredBy, items: [] };
    acc[key].items.push(n);
    return acc;
  }, {} as Record<string, { type: string; createdAt: string; triggeredBy: string | null; items: Notification[] }>);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Varslingslogg</Typography>
          <Stack direction="row" spacing={0.5}>
            <IconButton size="small" onClick={load}><RefreshIcon /></IconButton>
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <CollapseIcon /> : <ExpandIcon />}
            </IconButton>
          </Stack>
        </Stack>

        {loading && <CircularProgress size={20} sx={{ mt: 1 }} />}
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}

        {!loading && list.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            Ingen varsler sendt ennå.
          </Typography>
        )}

        {!loading && list.length > 0 && !expanded && (
          <Typography variant="caption" color="text.secondary">
            {list.length} varsel{list.length === 1 ? '' : 'er'} · siste: {TYPE_LABELS[list[0].notificationType] || list[0].notificationType}
            {' '}({new Date(list[0].createdAt).toLocaleString('nb-NO')})
          </Typography>
        )}

        <Collapse in={expanded}>
          <Stack spacing={2} sx={{ mt: 1.5 }}>
            {Object.entries(grouped).map(([key, group]) => (
              <Box key={key}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="subtitle2">
                    {TYPE_LABELS[group.type] || group.type}
                  </Typography>
                  <Chip size="small" label={`av ${group.triggeredBy || 'system'}`} variant="outlined" />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(group.createdAt).toLocaleString('nb-NO')}
                  </Typography>
                </Stack>
                <Stack spacing={0.5} sx={{ pl: 1 }}>
                  {group.items.map((n) => (
                    <Stack key={n.id} direction="row" spacing={1} alignItems="center">
                      {n.channel === 'email' ? <EmailIcon fontSize="small" /> : <SmsIcon fontSize="small" />}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2">
                          {RECIPIENT_LABELS[n.recipientType] || n.recipientType}
                          {n.recipientName ? ` — ${n.recipientName}` : ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {n.channel === 'email' ? n.recipientEmail : n.recipientPhone}
                        </Typography>
                      </Box>
                      {statusChip(n.status, n.errorMessage)}
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default WeddingNotificationLog;
