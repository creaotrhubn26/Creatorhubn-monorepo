// Slice 9X.8.B — klient-liste for fotograf.
// Lister alle klienter med count-aggregeringer per relasjon
// (galleri, bestillinger, kontrakter) sortert etter sist aktivitet.

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Box, Typography, TextField, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Chip, InputAdornment,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack,
} from '@mui/material';
import { Search, Person, Add } from '@mui/icons-material';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ClientRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string | null;
  city: string | null;
  galleryCount: number;
  orderCount: number;
  totalSpent: number;
  contractCount: number;
  lastActivityAt: string | null;
  createdAt: string;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '—';
  const diffMs = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) return 'i dag';
  if (diffMs < 2 * day) return 'i går';
  if (diffMs < 30 * day) return `${Math.floor(diffMs / day)} dager siden`;
  if (diffMs < 365 * day) return `${Math.floor(diffMs / (30 * day))} mnd siden`;
  return `${Math.floor(diffMs / (365 * day))} år siden`;
}

export default function PhotographerClientsList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  const { data, isLoading, error } = useQuery<{ clients: ClientRow[] }>({
    queryKey: ['/api/photographer/clients'],
    queryFn: () => apiRequest('/api/photographer/clients'),
  });

  const create = useMutation<{ id: string }, Error, typeof draft>({
    mutationFn: (body) => apiRequest('/api/photographer/clients', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/photographer/clients'] });
      setCreateOpen(false);
      setDraft({ firstName: '', lastName: '', email: '', phone: '' });
      navigate(`/photographer/clients/${id}`);
    },
  });

  const filtered = useMemo(() => {
    if (!data?.clients) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.clients;
    return data.clients.filter((c) =>
      c.displayName.toLowerCase().includes(q)
      || c.email.toLowerCase().includes(q)
      || (c.city ?? '').toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Person fontSize="large" /> Klienter
        </Typography>
        <Button startIcon={<Add />} variant="contained" onClick={() => setCreateOpen(true)}>
          Ny klient
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Alle klienter med samlet aktivitet — galleri, bestillinger og kontrakter.
      </Typography>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Ny klient</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Fornavn" size="small" fullWidth
                value={draft.firstName}
                onChange={(e) => setDraft((p) => ({ ...p, firstName: e.target.value }))}
              />
              <TextField
                label="Etternavn" size="small" fullWidth
                value={draft.lastName}
                onChange={(e) => setDraft((p) => ({ ...p, lastName: e.target.value }))}
              />
            </Stack>
            <TextField
              label="E-post" size="small" fullWidth required type="email"
              value={draft.email}
              onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
            />
            <TextField
              label="Telefon" size="small" fullWidth
              value={draft.phone}
              onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={!draft.email.trim() || create.isPending}
            onClick={() => create.mutate(draft)}
          >
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      <TextField
        fullWidth
        size="small"
        placeholder="Søk navn, email eller by"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ py: 2 }}>
          Kunne ikke laste klient-liste.
        </Typography>
      )}

      {!isLoading && !error && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Klient</TableCell>
                <TableCell>By</TableCell>
                <TableCell align="right">Galleri</TableCell>
                <TableCell align="right">Bestillinger</TableCell>
                <TableCell align="right">Kontrakter</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Sist aktivitet</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {search ? 'Ingen treff på søket.' : 'Ingen klienter ennå.'}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  hover
                  onClick={() => navigate(`/photographer/clients/${c.id}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {c.displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {c.email}
                    </Typography>
                  </TableCell>
                  <TableCell>{c.city ?? '—'}</TableCell>
                  <TableCell align="right">
                    {c.galleryCount > 0 ? <Chip size="small" label={c.galleryCount} /> : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {c.orderCount > 0 ? <Chip size="small" label={c.orderCount} color="primary" /> : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {c.contractCount > 0 ? <Chip size="small" label={c.contractCount} /> : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {c.totalSpent > 0
                      ? `${c.totalSpent.toLocaleString('nb-NO')} kr`
                      : '—'}
                  </TableCell>
                  <TableCell>{formatRelative(c.lastActivityAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
