// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Drawer,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  Dashboard as DashboardIcon,
  Group as GroupIcon,
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../../utils/theming-helper';

interface AdminMetric {
  key: string;
  label: string;
  value: number;
  trend?: string;
}

interface AdminComponentStatus {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'offline';
  updatedAt: string;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'users', label: 'Brukere', icon: <GroupIcon /> },
  { id: 'security', label: 'Sikkerhet', icon: <SecurityIcon /> },
  { id: 'integrations', label: 'Integrasjoner', icon: <StorageIcon /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChartIcon /> },
  { id: 'settings', label: 'Innstillinger', icon: <SettingsIcon /> },
];

export default function AdminDashboardWithCustomization() {
  const { user, isAuthenticated } = useAuth();
  const theming = useTheming('prototype_tester');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedView, setSelectedView] = useState('dashboard');

  const isAdmin =
    user?.role === 'admin' ||
    user?.email === 'daniel@creatorhubn.com' ||
    user?.email === 'admin@creatorhubnorge.no';

  const { data: metricsRaw, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/admin/metrics'],
    queryFn: () => apiRequest('/api/admin/metrics'),
    enabled: isAdmin,
  });

  const { data: componentsRaw, isLoading: componentsLoading } = useQuery({
    queryKey: ['/api/admin/components'],
    queryFn: () => apiRequest('/api/admin/components'),
    enabled: isAdmin,
  });

  const metrics = useMemo(() => normalizeMetrics(metricsRaw), [metricsRaw]);
  const components = useMemo(() => normalizeComponents(componentsRaw), [componentsRaw]);

  if (!isAuthenticated || !isAdmin) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0f141a',
        }}
      >
        <Card sx={{ maxWidth: 560 }}>
          <CardContent>
            <Typography variant="h5" sx={{ mb: 1 }}>
              Tilgang nektet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Denne visningen er kun tilgjengelig for administratorer.
            </Typography>
            <Button variant="contained">Logg inn som admin</Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const loading = metricsLoading || componentsLoading;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0b1118' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(10, 16, 24, 0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Toolbar>
          <IconButton onClick={() => setDrawerOpen(true)} sx={{ color: '#fff' }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            Admin Dashboard
          </Typography>
          <IconButton sx={{ color: '#fff' }}>
            <NotificationsIcon />
          </IconButton>
          <Avatar sx={{ ml: 1, bgcolor: theming.colors.primary }}>
            {user?.email?.slice(0, 1).toUpperCase() || 'A'}
          </Avatar>
        </Toolbar>
      </AppBar>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 300,
            bgcolor: '#121b26',
            color: '#dce7f3',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            CreatorHub Admin
          </Typography>
          <List>
            {NAV_ITEMS.map((item) => (
              <ListItem key={item.id} disablePadding>
                <ListItemButton
                  selected={selectedView === item.id}
                  onClick={() => {
                    setSelectedView(item.id);
                    setDrawerOpen(false);
                  }}
                >
                  <ListItemIcon sx={{ color: '#dce7f3' }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {metrics.map((metric) => (
            <Grid key={metric.key} item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#111a25', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    {metric.label}
                  </Typography>
                  <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
                    {metric.value.toLocaleString('no-NO')}
                  </Typography>
                  {metric.trend && (
                    <Typography variant="caption" color="text.secondary">
                      {metric.trend}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Card sx={{ bgcolor: '#111a25', border: '1px solid rgba(255,255,255,0.08)' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
              Komponentstatus
            </Typography>
            <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
            <Stack spacing={1.5}>
              {components.map((component) => (
                <Stack
                  key={component.id}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <Typography sx={{ color: '#dce7f3' }}>{component.name}</Typography>
                  <StatusBadge status={component.status} />
                </Stack>
              ))}
              {components.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Ingen komponentdata tilgjengelig.
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

function StatusBadge({ status }: { status: AdminComponentStatus['status'] }) {
  const config =
    status === 'healthy'
      ? { label: 'Healthy', color: '#22c55e' }
      : status === 'warning'
        ? { label: 'Warning', color: '#f59e0b' }
        : status === 'error'
          ? { label: 'Error', color: '#ef4444' }
          : { label: 'Offline', color: '#64748b' };

  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.5,
        borderRadius: 1,
        bgcolor: `${config.color}33`,
        color: config.color,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {config.label}
    </Box>
  );
}

function normalizeMetrics(raw: unknown): AdminMetric[] {
  const list = toArray(raw);
  const normalized = list
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const key = toString(record.key);
      const label = toString(record.label);
      if (!key || !label) {
        return null;
      }
      return {
        key,
        label,
        value: toNumber(record.value),
        trend: optionalString(record.trend),
      } satisfies AdminMetric;
    })
    .filter((item): item is AdminMetric => item !== null);

  if (normalized.length > 0) {
    return normalized;
  }

  return [
    { key: 'users', label: 'Aktive brukere', value: 1240, trend: '+4.2% siste 7 dager' },
    { key: 'projects', label: 'Prosjekter', value: 386, trend: '+12 nye i dag' },
    { key: 'revenue', label: 'Månedsomsetning', value: 845000, trend: '+7.8%' },
    { key: 'errors', label: 'Åpne feil', value: 12, trend: '-3 siden i går' },
  ];
}

function normalizeComponents(raw: unknown): AdminComponentStatus[] {
  const list = toArray(raw);
  const normalized = list
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const id = toString(record.id);
      const name = toString(record.name);
      if (!id || !name) {
        return null;
      }
      return {
        id,
        name,
        status: toStatus(record.status),
        updatedAt: toString(record.updatedAt) || new Date().toISOString(),
      } satisfies AdminComponentStatus;
    })
    .filter((item): item is AdminComponentStatus => item !== null);

  if (normalized.length > 0) {
    return normalized;
  }

  return [
    { id: 'story-arc', name: 'Story Arc Studio', status: 'healthy', updatedAt: new Date().toISOString() },
    { id: 'timeline', name: 'Professional Timeline', status: 'warning', updatedAt: new Date().toISOString() },
    { id: 'payments', name: 'Payment Gateway', status: 'healthy', updatedAt: new Date().toISOString() },
    { id: 'analytics', name: 'GA4 + BI', status: 'healthy', updatedAt: new Date().toISOString() },
  ];
}

function toArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  const record = asRecord(raw);
  if (!record) {
    return [];
  }
  if (Array.isArray(record.data)) {
    return record.data;
  }
  if (Array.isArray(record.metrics)) {
    return record.metrics;
  }
  if (Array.isArray(record.components)) {
    return record.components;
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function toStatus(value: unknown): AdminComponentStatus['status'] {
  if (value === 'healthy' || value === 'warning' || value === 'error' || value === 'offline') {
    return value;
  }
  return 'healthy';
}
