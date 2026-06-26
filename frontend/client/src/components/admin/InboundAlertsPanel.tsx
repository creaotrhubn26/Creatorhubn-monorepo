/**
 * Inbound Alerts Panel — admin "full oversikt" over innkommende hendelser.
 *
 * Viser admin-innboksen som notifyAdmins() (backend/server/admin-notify.ts)
 * skriver til admin_inbound_alerts: søknader, leads, beta-signups osv. som
 * krever oppfølging. Leser fra de admin-guardede endepunktene:
 *   GET  /api/admin/inbound-alerts (+ ?type= &source= &unread=1 &limit=)
 *   GET  /api/admin/inbound-alerts/count
 *   POST /api/admin/inbound-alerts/:id/read
 *   POST /api/admin/inbound-alerts/read-all
 */
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Badge,
  Tooltip,
  CircularProgress,
  Link as MuiLink,
} from '@mui/material';
import {
  Inbox,
  Refresh,
  DoneAll,
  Done,
  FiberManualRecord,
  OpenInNew,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface InboundAlert {
  id: string;
  type?: string | null;
  source?: string | null;
  title?: string | null;
  summary?: string | null;
  cta?: string | null;
  page?: string | null;
  utm?: unknown;
  link?: string | null;
  related_id?: string | null;
  read_at?: string | null;
  created_at?: string | null;
}

const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const orDash = (value?: string | null): string => {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : '-';
};

export default function InboundAlertsPanel() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const buildQueryString = (): string => {
    const params = new URLSearchParams();
    if (typeFilter.trim()) params.set('type', typeFilter.trim());
    if (sourceFilter.trim()) params.set('source', sourceFilter.trim());
    if (unreadOnly) params.set('unread', '1');
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['/api/admin/inbound-alerts', typeFilter, sourceFilter, unreadOnly],
    queryFn: () => apiRequest(`/api/admin/inbound-alerts${buildQueryString()}`),
  });

  const { data: countData } = useQuery({
    queryKey: ['/api/admin/inbound-alerts/count'],
    queryFn: () => apiRequest('/api/admin/inbound-alerts/count'),
  });

  const alerts: InboundAlert[] = Array.isArray(data?.alerts) ? data.alerts : [];
  const unreadCount: number = Number(countData?.unread || 0);

  const refresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['/api/admin/inbound-alerts/count'] });
  };

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/inbound-alerts/${id}/read`, { method: 'POST' }),
    onSuccess: () => refresh(),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/inbound-alerts/read-all', { method: 'POST' }),
    onSuccess: () => refresh(),
  });

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      {/* Header + unread badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Badge badgeContent={unreadCount} color="error" max={999} showZero={false}>
          <Inbox color="primary" />
        </Badge>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Innkommende varsler
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Chip
          label={`${unreadCount} uleste`}
          color={unreadCount > 0 ? 'error' : 'default'}
          size="small"
          variant={unreadCount > 0 ? 'filled' : 'outlined'}
        />
        <Button
          startIcon={<Refresh />}
          onClick={refresh}
          size="small"
          variant="outlined"
          disabled={isFetching}
        >
          Oppdater
        </Button>
        <Button
          startIcon={<DoneAll />}
          onClick={() => markAllReadMutation.mutate()}
          size="small"
          variant="contained"
          disabled={markAllReadMutation.isPending || unreadCount === 0}
        >
          Marker alle lest
        </Button>
      </Box>

      {/* Filters */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            flexWrap: 'wrap',
            py: 1.5,
            '&:last-child': { pb: 1.5 },
          }}
        >
          <TextField
            label="Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            size="small"
            placeholder="f.eks. partner-soknad"
            sx={{ minWidth: 200 }}
          />
          <TextField
            label="Kilde inneholder"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            size="small"
            placeholder="f.eks. theroleroom.com"
            sx={{ minWidth: 220 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                color="primary"
              />
            }
            label="Kun uleste"
          />
        </CardContent>
      </Card>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>Kilde</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>CTA</TableCell>
              <TableCell>Tittel</TableCell>
              <TableCell>Sammendrag</TableCell>
              <TableCell>Side</TableCell>
              <TableCell>Mottatt</TableCell>
              <TableCell align="right">Handling</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">Ingen varsler funnet</Typography>
                </TableCell>
              </TableRow>
            ) : (
              alerts.map((alert) => {
                const isUnread = !alert.read_at;
                return (
                  <TableRow
                    key={alert.id}
                    hover
                    sx={{
                      bgcolor: isUnread ? 'action.hover' : 'inherit',
                      '& td': { fontWeight: isUnread ? 600 : 400 },
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Tooltip title={isUnread ? 'Ulest' : 'Lest'}>
                        {isUnread ? (
                          <FiberManualRecord color="error" sx={{ fontSize: 12 }} />
                        ) : (
                          <FiberManualRecord
                            sx={{ fontSize: 12, color: 'text.disabled' }}
                          />
                        )}
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                        {orDash(alert.source)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {alert.type ? (
                        <Chip label={alert.type} size="small" variant="outlined" />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{orDash(alert.cta)}</TableCell>
                    <TableCell sx={{ maxWidth: 240 }}>
                      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                        {orDash(alert.title)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Tooltip title={alert.summary || ''} placement="top">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {orDash(alert.summary)}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      {alert.link || alert.page ? (
                        <MuiLink
                          href={alert.link || alert.page || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            wordBreak: 'break-word',
                          }}
                        >
                          {orDash(alert.page) === '-' ? alert.link : alert.page}
                          <OpenInNew sx={{ fontSize: 14 }} />
                        </MuiLink>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                        {formatDate(alert.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {isUnread ? (
                        <Button
                          size="small"
                          startIcon={<Done />}
                          onClick={() => markReadMutation.mutate(alert.id)}
                          disabled={markReadMutation.isPending}
                        >
                          Marker lest
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          Lest
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
