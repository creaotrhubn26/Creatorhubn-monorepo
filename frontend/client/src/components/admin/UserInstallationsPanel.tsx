// @ts-nocheck
/**
 * UserInstallationsPanel — Slice 9X.70
 *
 * Admin-UI som viser hvilke marketplace-apper en valgt bruker har
 * installert, og når Stripe-abonnementene fornyes.
 *
 * Backend: GET /api/admin/users/:userId/installations
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
  CircularProgress,
  Avatar,
  IconButton,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  Apps as AppsIcon,
  CardMembership as CardIcon,
  Schedule as ScheduleIcon,
  CheckCircle as ActiveIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  profession?: string;
}

interface Subscription {
  id: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: string;
  amount?: number;
  currency?: string;
  interval?: 'month' | 'year';
  productName?: string;
  appId?: string;
  tierId?: string;
}

interface InstallationData {
  userId: string;
  email?: string;
  stripeCustomerId?: string;
  installedApps: Array<{ appId: string; installedAt: string; isActive: boolean }>;
  subscriptions: Subscription[];
  stripeError?: string;
}

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const daysUntil = (iso?: string): number | null => {
  if (!iso) return null;
  const diff = (new Date(iso).getTime() - Date.now()) / 86400000;
  return Math.round(diff);
};

const STATUS_LABEL: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  active: { label: 'Aktiv', color: 'success' },
  trialing: { label: 'Prøveperiode', color: 'success' },
  past_due: { label: 'Forfalt', color: 'warning' },
  unpaid: { label: 'Ubetalt', color: 'error' },
  canceled: { label: 'Avsluttet', color: 'default' },
  incomplete: { label: 'Påbegynt', color: 'warning' },
  incomplete_expired: { label: 'Utløpt påbegynt', color: 'default' },
  paused: { label: 'Pauset', color: 'warning' },
};

interface Props {
  users: User[];
}

const UserInstallationsPanel: React.FC<Props> = ({ users }) => {
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) =>
      u.email?.toLowerCase().includes(q) ||
      `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().includes(q),
    );
  }, [users, search]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-user-installations', selectedUserId],
    queryFn: async () => apiRequest(`/api/admin/users/${selectedUserId}/installations`) as Promise<InstallationData>,
    enabled: !!selectedUserId,
  });

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const installedApps = Array.isArray(data?.installedApps) ? data.installedApps : [];
  const subscriptions = Array.isArray(data?.subscriptions) ? data.subscriptions : [];

  return (
    <Box>
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha('#7c3aed', 0.1), color: '#c084fc' }}>
              <AppsIcon />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Installasjoner & abonnement</Typography>
              <Typography variant="caption" color="text.secondary">
                Se hva en bruker har installert og når Stripe-abonnementet fornyes
              </Typography>
            </Box>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder="Søk bruker (navn eller e-post)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 320 }}>
              <InputLabel>Velg bruker</InputLabel>
              <Select
                label="Velg bruker"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value as string)}
              >
                <MenuItem value=""><em>—</em></MenuItem>
                {filteredUsers.slice(0, 100).map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedUserId && (
              <IconButton onClick={() => refetch()} disabled={isFetching}>
                <RefreshIcon />
              </IconButton>
            )}
          </Stack>

          {!selectedUserId && (
            <Alert severity="info">Velg en bruker for å se installasjoner og abonnement.</Alert>
          )}

          {selectedUserId && isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          )}

          {selectedUserId && data && (
            <Stack spacing={2}>
              {/* Bruker-info */}
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha('#7c3aed', 0.05), border: '1px solid', borderColor: alpha('#7c3aed', 0.2) }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: '#7c3aed', width: 48, height: 48 }}>
                    {selectedUser?.firstName?.[0]?.toUpperCase() || '?'}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {selectedUser?.firstName} {selectedUser?.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedUser?.email} · {selectedUser?.profession || 'Ingen profesjon'}
                    </Typography>
                    {data.stripeCustomerId && (
                      <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', color: 'text.secondary' }}>
                        Stripe: {data.stripeCustomerId}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={`${installedApps.length} apper`}
                      icon={<AppsIcon />}
                      sx={{ bgcolor: alpha('#7c3aed', 0.15) }}
                    />
                    <Chip
                      label={`${subscriptions.length} abonnement`}
                      icon={<CardIcon />}
                      sx={{ bgcolor: alpha('#10b981', 0.15) }}
                    />
                  </Stack>
                </Stack>
              </Box>

              {data.stripeError && (
                <Alert severity="warning">Stripe API-feil: {data.stripeError}</Alert>
              )}

              {/* Installerte apper */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  <AppsIcon fontSize="small" sx={{ verticalAlign: 'text-bottom', mr: 0.5 }} />
                  Installerte apper
                </Typography>
                {installedApps.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    Ingen apper installert ennå.
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>App ID</TableCell>
                        <TableCell>Installert</TableCell>
                        <TableCell align="center">Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {installedApps.map((app) => (
                        <TableRow key={app.appId}>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{app.appId}</TableCell>
                          <TableCell>{fmtDate(app.installedAt)}</TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={app.isActive ? 'Aktiv' : 'Avinstallert'}
                              color={app.isActive ? 'success' : 'default'}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>

              {/* Stripe-abonnement */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  <CardIcon fontSize="small" sx={{ verticalAlign: 'text-bottom', mr: 0.5 }} />
                  Abonnement & fornyelse
                </Typography>
                {subscriptions.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    Ingen aktive abonnement registrert i Stripe.
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Produkt</TableCell>
                        <TableCell>Beløp</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Fornyes</TableCell>
                        <TableCell>Stripe</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {subscriptions.map((sub) => {
                        const status = STATUS_LABEL[sub.status] || { label: sub.status, color: 'default' as const };
                        const days = daysUntil(sub.currentPeriodEnd);
                        const renewalUrgent = days != null && days >= 0 && days <= 7;
                        return (
                          <TableRow key={sub.id}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {sub.productName || sub.appId || '—'}
                              </Typography>
                              {sub.tierId && (
                                <Typography variant="caption" color="text.secondary">
                                  Tier: {sub.tierId}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {sub.amount != null
                                ? `${sub.amount.toLocaleString('nb-NO')} ${(sub.currency || 'nok').toUpperCase()} / ${sub.interval === 'year' ? 'år' : 'mnd'}`
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <Chip size="small" label={status.label} color={status.color} />
                              {sub.cancelAtPeriodEnd && (
                                <Chip size="small" label="Sies opp" color="warning" sx={{ ml: 0.5 }} icon={<WarningIcon fontSize="small" />} />
                              )}
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <ScheduleIcon fontSize="small" sx={{ color: renewalUrgent ? '#dc2626' : 'text.secondary' }} />
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: renewalUrgent ? 700 : 400, color: renewalUrgent ? '#dc2626' : 'inherit' }}>
                                    {fmtDate(sub.currentPeriodEnd)}
                                  </Typography>
                                  {days != null && days >= 0 && (
                                    <Typography variant="caption" color="text.secondary">
                                      om {days} dag{days === 1 ? '' : 'er'}
                                    </Typography>
                                  )}
                                </Box>
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'text.secondary' }}>
                              {sub.id}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default UserInstallationsPanel;
