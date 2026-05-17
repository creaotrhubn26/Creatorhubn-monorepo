// Slice 9X.9.A — prosjekt-liste for fotograf.
// Lister alle prosjekter med klient, status, pris og live margin
// (basert på trackede timer × rate vs avtalt pris).
// Klikk åpner detalj-siden. "Nytt prosjekt"-knapp åpner dialog som
// kobler prosjektet til en eksisterende klient.

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Box, Typography, TextField, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Chip, InputAdornment,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack,
  MenuItem, Select, FormControl, InputLabel, Autocomplete,
} from '@mui/material';
import { Search, Folder, Add, Event, LocationOn } from '@mui/icons-material';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ProjectRow {
  id: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  projectType: string | null;
  status: string;
  phase: string | null;
  eventDate: string | null;
  location: string | null;
  servicePrice: number;
  hourlyRate: number;
  costOverhead: number;
  trackedHours: number;
  trackedCost: number;
  marginPct: number | null;
  profitAmount: number | null;
  createdAt: string;
}

interface ClientOption {
  id: string;
  displayName: string;
  email: string;
}

const PROJECT_TYPES = [
  { value: 'bryllup', label: 'Bryllup' },
  { value: 'portrett', label: 'Portrett' },
  { value: 'commercial', label: 'Kommersiell' },
  { value: 'produkt', label: 'Produkt' },
  { value: 'event', label: 'Event' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('nb-NO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function marginColor(pct: number | null): 'default' | 'success' | 'warning' | 'error' {
  if (pct === null) return 'default';
  if (pct >= 50) return 'success';
  if (pct >= 25) return 'warning';
  return 'error';
}

function statusColor(status: string): 'default' | 'primary' | 'success' | 'warning' {
  if (status === 'completed') return 'success';
  if (status === 'active') return 'primary';
  if (status === 'on_hold') return 'warning';
  return 'default';
}

export default function PhotographerProjectsList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: '',
    clientId: null as string | null,
    projectType: 'bryllup',
    eventDate: '',
    location: '',
    servicePrice: '',
    hourlyRate: '',
    costOverhead: '',
    estimatedHours: '',
    description: '',
  });

  const { data, isLoading, error } = useQuery<{ projects: ProjectRow[] }>({
    queryKey: ['/api/photographer/projects'],
    queryFn: () => apiRequest('/api/photographer/projects'),
  });

  const clientsQuery = useQuery<{ clients: { id: string; displayName: string; email: string }[] }>({
    queryKey: ['/api/photographer/clients'],
    queryFn: () => apiRequest('/api/photographer/clients'),
    enabled: createOpen,
  });

  const create = useMutation<{ id: string }, Error, typeof draft>({
    mutationFn: (body) => apiRequest('/api/photographer/projects', {
      method: 'POST',
      body: JSON.stringify({
        title: body.title,
        clientId: body.clientId,
        projectType: body.projectType,
        eventDate: body.eventDate || null,
        location: body.location,
        servicePrice: body.servicePrice ? Number(body.servicePrice) : null,
        hourlyRate: body.hourlyRate ? Number(body.hourlyRate) : null,
        costOverhead: body.costOverhead ? Number(body.costOverhead) : 0,
        estimatedHours: body.estimatedHours ? Number(body.estimatedHours) : null,
        description: body.description,
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/photographer/projects'] });
      setCreateOpen(false);
      setDraft({
        title: '', clientId: null, projectType: 'bryllup', eventDate: '', location: '',
        servicePrice: '', hourlyRate: '', costOverhead: '', estimatedHours: '', description: '',
      });
      navigate(`/photographer/projects/${id}`);
    },
  });

  const clientOptions: ClientOption[] = useMemo(() => {
    return clientsQuery.data?.clients ?? [];
  }, [clientsQuery.data]);

  const filtered = useMemo(() => {
    if (!data?.projects) return [];
    let rows = data.projects;
    if (statusFilter !== 'all') rows = rows.filter((p) => p.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) =>
      p.title.toLowerCase().includes(q)
      || (p.clientName ?? '').toLowerCase().includes(q)
      || (p.location ?? '').toLowerCase().includes(q),
    );
  }, [data, search, statusFilter]);

  const totals = useMemo(() => {
    if (!data?.projects) return { count: 0, revenue: 0, profit: 0 };
    return data.projects.reduce(
      (acc, p) => {
        acc.count += 1;
        acc.revenue += p.servicePrice;
        if (p.profitAmount !== null) acc.profit += p.profitAmount;
        return acc;
      },
      { count: 0, revenue: 0, profit: 0 },
    );
  }, [data]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Folder fontSize="large" /> Prosjekter
        </Typography>
        <Button startIcon={<Add />} variant="contained" onClick={() => setCreateOpen(true)}>
          Nytt prosjekt
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Alle oppdrag — bryllup, portrett, kommersielt — med klient, status og live margin.
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <Paper sx={{ p: 2, minWidth: 160 }}>
          <Typography variant="caption" color="text.secondary">Aktive prosjekter</Typography>
          <Typography variant="h5">{totals.count}</Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary">Total avtalt</Typography>
          <Typography variant="h5">{totals.revenue.toLocaleString('nb-NO')} kr</Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary">Estimert margin</Typography>
          <Typography
            variant="h5"
            color={totals.profit >= 0 ? 'success.main' : 'error.main'}
          >
            {totals.profit.toLocaleString('nb-NO')} kr
          </Typography>
        </Paper>
      </Stack>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nytt prosjekt</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Prosjekttittel" size="small" fullWidth required
              placeholder="Maria & Anders bryllup"
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            />
            <Autocomplete
              size="small"
              options={clientOptions}
              getOptionLabel={(o) => `${o.displayName} (${o.email})`}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              loading={clientsQuery.isLoading}
              onChange={(_, v) => setDraft((p) => ({ ...p, clientId: v?.id ?? null }))}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Klient (valgfritt)"
                  placeholder="Velg fra CRM eller la stå tom"
                />
              )}
            />
            <Stack direction="row" spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  label="Type"
                  value={draft.projectType}
                  onChange={(e) => setDraft((p) => ({ ...p, projectType: e.target.value }))}
                >
                  {PROJECT_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Dato" size="small" type="date" fullWidth
                InputLabelProps={{ shrink: true }}
                value={draft.eventDate}
                onChange={(e) => setDraft((p) => ({ ...p, eventDate: e.target.value }))}
              />
            </Stack>
            <TextField
              label="Lokasjon" size="small" fullWidth
              placeholder="Sankt Hanshaugen kirke + Frognerseteren"
              value={draft.location}
              onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Avtalt pris (NOK)" size="small" type="number" fullWidth
                value={draft.servicePrice}
                onChange={(e) => setDraft((p) => ({ ...p, servicePrice: e.target.value }))}
              />
              <TextField
                label="Timepris (NOK)" size="small" type="number" fullWidth
                value={draft.hourlyRate}
                onChange={(e) => setDraft((p) => ({ ...p, hourlyRate: e.target.value }))}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Estimerte timer" size="small" type="number" fullWidth
                value={draft.estimatedHours}
                onChange={(e) => setDraft((p) => ({ ...p, estimatedHours: e.target.value }))}
              />
              <TextField
                label="Faste kostnader (NOK)" size="small" type="number" fullWidth
                helperText="Utstyrsleie, reise, etc"
                value={draft.costOverhead}
                onChange={(e) => setDraft((p) => ({ ...p, costOverhead: e.target.value }))}
              />
            </Stack>
            <TextField
              label="Beskrivelse" size="small" fullWidth multiline rows={2}
              value={draft.description}
              onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={!draft.title.trim() || create.isPending}
            onClick={() => create.mutate(draft)}
          >
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          fullWidth size="small"
          placeholder="Søk tittel, klient eller lokasjon"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">Alle</MenuItem>
            <MenuItem value="active">Aktive</MenuItem>
            <MenuItem value="on_hold">På vent</MenuItem>
            <MenuItem value="completed">Fullført</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ py: 2 }}>
          Kunne ikke laste prosjekt-listen.
        </Typography>
      )}

      {!isLoading && !error && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Prosjekt</TableCell>
                <TableCell>Klient</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Dato</TableCell>
                <TableCell align="right">Pris</TableCell>
                <TableCell align="right">Timer</TableCell>
                <TableCell align="right">Margin</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {search || statusFilter !== 'all'
                      ? 'Ingen treff.'
                      : 'Ingen prosjekter ennå — opprett ditt første.'}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  hover
                  onClick={() => navigate(`/photographer/projects/${p.id}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{p.title}</Typography>
                    {p.location && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LocationOn sx={{ fontSize: 12 }} /> {p.location}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{p.clientName ?? '—'}</TableCell>
                  <TableCell>
                    {p.projectType ? <Chip size="small" label={p.projectType} variant="outlined" /> : '—'}
                  </TableCell>
                  <TableCell>{formatDate(p.eventDate)}</TableCell>
                  <TableCell align="right">
                    {p.servicePrice > 0 ? `${p.servicePrice.toLocaleString('nb-NO')} kr` : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {p.trackedHours > 0 ? `${p.trackedHours.toFixed(1)}t` : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {p.marginPct !== null
                      ? <Chip size="small" color={marginColor(p.marginPct)} label={`${p.marginPct.toFixed(0)}%`} />
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={statusColor(p.status)} label={p.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
