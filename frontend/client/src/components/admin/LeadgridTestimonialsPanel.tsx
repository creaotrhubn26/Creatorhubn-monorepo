/**
 * LeadgridTestimonialsPanel.tsx
 *
 * Super-admin godkjenner/administrerer kundeomtaler. Innsendte omtaler (fra
 * appen, «Hva synes du om Leadgrid?») ligger ugodkjent til de aktiveres her;
 * godkjente vises på leadgrid.no. Skru av «Godkjent» for å skjule igjen.
 *
 *   GET    /api/leadgrid/testimonials/admin
 *   PUT    /api/leadgrid/testimonials/:id   (godkjenn/rediger/sorter)
 *   DELETE /api/leadgrid/testimonials/:id
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Card, CardContent, Chip, Divider, FormControlLabel, Rating,
  Snackbar, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { FormatQuote as QuoteIcon, Refresh as RefreshIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import { AdminButton, AdminLoading, AdminError } from './design-system';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
  source: string;
  approved: boolean;
  sort_order: number;
  submitter_org: string;
  created_at: string;
}

function bearer(): string {
  return typeof window !== 'undefined' && localStorage.getItem('rr_bearer')
    ? `Bearer ${localStorage.getItem('rr_bearer')}` : '';
}

export default function LeadgridTestimonialsPanel() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/leadgrid/testimonials/admin', {
        credentials: 'include', headers: { Authorization: bearer() },
      });
      if (!r.ok) { setError(`HTTP ${r.status}`); return; }
      const d = await r.json();
      setItems(Array.isArray(d?.testimonials) ? d.testimonials : []);
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const patchLocal = (id: string, p: Partial<Testimonial>) =>
    setItems((xs) => xs.map((t) => (t.id === id ? { ...t, ...p } : t)));

  async function save(id: string, body: Record<string, unknown>, note?: string) {
    try {
      const r = await fetch(`/api/leadgrid/testimonials/${id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: bearer() },
        body: JSON.stringify(body),
      });
      if (!r.ok) { setSnackbar(`Feil: HTTP ${r.status}`); return; }
      if (note) setSnackbar(note);
    } catch (e) { setSnackbar(`Feil: ${String(e)}`); }
  }

  async function remove(id: string) {
    try {
      const r = await fetch(`/api/leadgrid/testimonials/${id}`, {
        method: 'DELETE', credentials: 'include', headers: { Authorization: bearer() },
      });
      if (!r.ok) { setSnackbar(`Feil: HTTP ${r.status}`); return; }
      setItems((xs) => xs.filter((t) => t.id !== id));
      setSnackbar('Slettet');
    } catch (e) { setSnackbar(`Feil: ${String(e)}`); }
  }

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={fetchAll} />;

  const pending = items.filter((t) => !t.approved).length;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }} flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <QuoteIcon aria-hidden sx={{ color: '#a78bfa' }} />
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>Leadgrid — Kundeomtaler</Typography>
          {pending > 0 && <Chip size="small" color="warning" label={`${pending} venter`} />}
        </Stack>
        <AdminButton tone="ghost" startIcon={<RefreshIcon />} onClick={fetchAll} size="small">Oppdater</AdminButton>
      </Stack>

      <Alert severity="info" sx={{ mb: 2.5 }}>
        Omtaler sendt inn fra appen ligger her til <strong>godkjenning</strong>. Skru på «Godkjent» for å vise
        på leadgrid.no (seksjonen dukker opp når minst én er godkjent). Skru av igjen for å skjule.
      </Alert>

      {items.length === 0 ? (
        <Typography sx={{ color: 'text.secondary' }}>Ingen omtaler enda. De kommer inn når kunder svarer i appen.</Typography>
      ) : (
        <Stack spacing={2}>
          {items.map((t) => (
            <Card key={t.id} sx={{ border: `1px solid ${t.approved ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.12)'}` }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }} flexWrap="wrap" gap={1}>
                  <Rating value={t.rating} readOnly size="small"
                    onChange={(_, v) => { const rating = v ?? 5; patchLocal(t.id, { rating }); void save(t.id, { rating }); }} />
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Chip size="small" variant="outlined" label={t.source} />
                    <FormControlLabel
                      control={<Switch checked={t.approved} onChange={(e) => {
                        patchLocal(t.id, { approved: e.target.checked });
                        void save(t.id, { approved: e.target.checked }, e.target.checked ? 'Godkjent → vises på leadgrid.no' : 'Skjult');
                      }} />}
                      label="Godkjent"
                    />
                    <AdminButton tone="danger" size="small" startIcon={<DeleteIcon />} onClick={() => remove(t.id)}>Slett</AdminButton>
                  </Stack>
                </Stack>
                <TextField
                  fullWidth multiline minRows={2} size="small" label="Sitat" value={t.quote}
                  onChange={(e) => patchLocal(t.id, { quote: e.target.value })}
                  onBlur={() => save(t.id, { quote: t.quote })}
                  sx={{ mb: 1.5 }}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField size="small" label="Navn" value={t.name} sx={{ flex: 1 }}
                    onChange={(e) => patchLocal(t.id, { name: e.target.value })} onBlur={() => save(t.id, { name: t.name })} />
                  <TextField size="small" label="Rolle / firma" value={t.role} sx={{ flex: 1 }}
                    onChange={(e) => patchLocal(t.id, { role: e.target.value })} onBlur={() => save(t.id, { role: t.role })} />
                  <TextField size="small" type="number" label="Sortering" value={t.sort_order} sx={{ width: 110 }}
                    onChange={(e) => patchLocal(t.id, { sort_order: Number(e.target.value) })}
                    onBlur={() => save(t.id, { sortOrder: t.sort_order })} />
                </Stack>
                {t.submitter_org && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                    Innsendt av: {t.submitter_org}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Endringer lagres automatisk (godkjent/rating med en gang, tekst når du forlater feltet).
      </Typography>

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
