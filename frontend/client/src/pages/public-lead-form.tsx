// Public lead-intake form (#1/#16). Reachable unauthenticated at /lead/:token.
// Posts to /api/public/lead/:token which maps the inquiry to the photographer
// who owns the token, creates a 'website' lead + a 24h follow-up task.
import React, { useState } from 'react';
import { useParams } from 'wouter';
import {
  Box, Paper, Stack, Typography, TextField, Button, Alert, MenuItem,
} from '@mui/material';

export default function PublicLeadForm() {
  const params = useParams<{ token: string }>();
  const token = params?.token || '';
  const [form, setForm] = useState({ name: '', email: '', phone: '', projectType: '', budget: '', notes: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setErrorMsg('');
    try {
      const r = await fetch(`/api/public/lead/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          projectType: form.projectType || undefined,
          budget: form.budget ? Number(form.budget) : undefined,
          notes: form.notes || undefined,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || 'Kunne ikke sende skjemaet.');
      }
      setState('done');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Noe gikk galt. Prøv igjen.');
      setState('error');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: '#f8fafc' }}>
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, maxWidth: 520, width: '100%', border: '1px solid #e2e8f0' }}>
        {state === 'done' ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Takk for henvendelsen!</Typography>
            <Typography color="text.secondary" align="center">
              Vi har mottatt forespørselen din og tar kontakt så snart som mulig.
            </Typography>
          </Stack>
        ) : (
          <form onSubmit={submit}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>Send en henvendelse</Typography>
                <Typography variant="body2" color="text.secondary">
                  Fortell litt om hva du ser etter, så tar vi kontakt.
                </Typography>
              </Box>
              {state === 'error' && <Alert severity="error">{errorMsg}</Alert>}
              <TextField label="Navn" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} fullWidth />
              <TextField label="E-post" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} fullWidth />
              <TextField label="Telefon" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} fullWidth />
              <TextField select label="Type oppdrag" value={form.projectType} onChange={(e) => setForm((f) => ({ ...f, projectType: e.target.value }))} fullWidth>
                <MenuItem value="">Velg…</MenuItem>
                <MenuItem value="bryllup">Bryllup</MenuItem>
                <MenuItem value="portrett">Portrett</MenuItem>
                <MenuItem value="konsert">Konsert/event</MenuItem>
                <MenuItem value="bedrift">Bedrift</MenuItem>
                <MenuItem value="annet">Annet</MenuItem>
              </TextField>
              <TextField label="Omtrentlig budsjett (NOK)" type="number" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} fullWidth />
              <TextField label="Melding" multiline rows={4} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} fullWidth />
              <Button type="submit" variant="contained" size="large" disabled={state === 'sending' || !form.name.trim() || !form.email.trim()}>
                {state === 'sending' ? 'Sender…' : 'Send henvendelse'}
              </Button>
            </Stack>
          </form>
        )}
      </Paper>
    </Box>
  );
}
