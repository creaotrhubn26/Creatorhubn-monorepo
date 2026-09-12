// @ts-nocheck
/**
 * EngagementFeedPanel
 *
 * Morning-checkin for fotografen: hva har klientene gjort på tvers av
 * alle delte galleries siste tid? Union-feed over views, comments,
 * selections og downloads — sortert nyeste først.
 *
 * Backend: GET /api/showcase/engagement/feed?limit=50
 * (backend/server/showcase-misc-routes.ts)
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Stack,
  Chip,
  Avatar,
  LinearProgress,
  Alert,
  Divider,
  Tooltip,
  Grid,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  CloudDownload as DownloadIcon,
  Comment as CommentIcon,
  StarBorder as StarIcon,
  Visibility as VisibilityIcon,
  TrendingUp as TrendingUpIcon,
  GroupOutlined as ClientsIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';

type EngagementKind = 'view' | 'comment' | 'selection' | 'download';

interface EngagementEvent {
  kind: EngagementKind;
  galleryId: string;
  projectTitle: string;
  clientName: string;
  clientEmail: string;
  happenedAt: string;
  detail: Record<string, unknown>;
}

interface EngagementSummary {
  downloads7d: number;
  comments7d: number;
  selections7d: number;
  activeClients7d: number;
}

interface EngagementResponse {
  events: EngagementEvent[];
  summary: EngagementSummary;
}

interface EngagementFeedPanelProps {
  open: boolean;
  onClose: () => void;
}

function describeEvent(ev: EngagementEvent): string {
  switch (ev.kind) {
    case 'view':
      return `åpnet galleriet`;
    case 'comment': {
      const snippet = typeof ev.detail?.comment === 'string'
        ? ev.detail.comment.slice(0, 80)
        : 'kommenterte';
      return `kommenterte: "${snippet}${snippet.length >= 80 ? '…' : ''}"`;
    }
    case 'selection': {
      const type = ev.detail?.selectionType;
      if (type === 'favorite') return 'merket et bilde som favoritt';
      if (type === 'rejected') return 'avviste et bilde';
      if (type === 'selected') return 'valgte et bilde';
      return 'oppdaterte sitt utvalg';
    }
    case 'download':
      return 'lastet ned et bilde';
    default:
      return ev.kind;
  }
}

function kindIcon(kind: EngagementKind) {
  switch (kind) {
    case 'view':
      return { icon: <VisibilityIcon fontSize="small" />, color: '#5279cc' };
    case 'comment':
      return { icon: <CommentIcon fontSize="small" />, color: '#f5a623' };
    case 'selection':
      return { icon: <StarIcon fontSize="small" />, color: '#9b59b6' };
    case 'download':
      return { icon: <DownloadIcon fontSize="small" />, color: '#27ae60' };
  }
}

function formatTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: nb });
  } catch {
    return '—';
  }
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box sx={{ mt: 0.5 }}>{icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
            {hint}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function EngagementFeedPanel({ open, onClose }: EngagementFeedPanelProps) {
  const { data, isLoading, error, refetch } = useQuery<EngagementResponse>({
    queryKey: ['/api/showcase/engagement/feed'],
    queryFn: () => apiRequest('/api/showcase/engagement/feed?limit=100'),
    enabled: open,
    refetchOnWindowFocus: false,
  });
  const events = data?.events ?? [];
  const summary = data?.summary ?? {
    downloads7d: 0,
    comments7d: 0,
    selections7d: 0,
    activeClients7d: 0,
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6">Klient-aktivitet</Typography>
          <Typography variant="caption" color="text.secondary">
            Hva som har skjedd på tvers av dine delte galleries
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading && <LinearProgress sx={{ mb: 2 }} />}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Kunne ikke laste aktivitet: {(error as Error)?.message ?? 'ukjent feil'}
          </Alert>
        )}

        {/* 7-dagers summary */}
        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <SummaryCard
              icon={<ClientsIcon color="primary" />}
              label="Aktive klienter"
              value={summary.activeClients7d}
              hint="siste 7 dager"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <SummaryCard
              icon={<StarIcon sx={{ color: '#9b59b6' }} />}
              label="Selections"
              value={summary.selections7d}
              hint="siste 7 dager"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <SummaryCard
              icon={<CommentIcon sx={{ color: '#f5a623' }} />}
              label="Kommentarer"
              value={summary.comments7d}
              hint="siste 7 dager"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <SummaryCard
              icon={<DownloadIcon sx={{ color: '#27ae60' }} />}
              label="Nedlastinger"
              value={summary.downloads7d}
              hint="siste 7 dager"
            />
          </Grid>
        </Grid>

        <Divider sx={{ mb: 2 }} />

        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Tidslinje
        </Typography>

        {!isLoading && events.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <TrendingUpIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Ingen klient-aktivitet ennå. Når klientene dine åpner galleriet,
              kommenterer eller laster ned vises det her.
            </Typography>
          </Box>
        )}

        <Stack spacing={0.5}>
          {events.map((ev, idx) => {
            const { icon, color } = kindIcon(ev.kind);
            return (
              <Box
                key={`${ev.kind}-${ev.galleryId}-${ev.happenedAt}-${idx}`}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  py: 1,
                  px: 1.5,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Avatar sx={{ bgcolor: `${color}20`, color, width: 32, height: 32, mt: 0.25 }}>
                  {icon}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      {ev.clientName || ev.clientEmail}
                    </Box>{' '}
                    {describeEvent(ev)}
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      {' '}i{' '}
                    </Box>
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      {ev.projectTitle}
                    </Box>
                  </Typography>
                  <Tooltip title={new Date(ev.happenedAt).toLocaleString('nb-NO')}>
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(ev.happenedAt)}
                    </Typography>
                  </Tooltip>
                </Box>
                <Chip
                  size="small"
                  label={ev.kind}
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    bgcolor: `${color}15`,
                    color,
                    textTransform: 'uppercase',
                  }}
                />
              </Box>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => refetch()} disabled={isLoading}>
          Oppdater
        </Button>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
}
