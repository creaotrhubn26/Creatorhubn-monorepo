/**
 * ClientReviewForm.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Verifisert omtale-skjema for klient-galleri-landingen (#4). Åpnes via lenken
 * i «be om omtale»-e-posten (/client/gallery/:accessToken?review=1). Sender
 * `accessToken` → backend utleder fotograf + setter verified=true.
 */

import React from 'react';
import { Box, Typography, Stack, TextField, Rating, Button } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';

const TEXT = '#F5F2EA';
const MUTED = 'rgba(245,242,234,0.6)';
const AMBER = '#ffba6c';

const fieldSx = {
  '& .MuiInputBase-input, & .MuiInputBase-inputMultiline': { color: TEXT },
  '& .MuiInputLabel-root': { color: MUTED },
  '& .MuiInputLabel-root.Mui-focused': { color: AMBER },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: AMBER },
};

export default function ClientReviewForm({ accessToken }: { accessToken: string }) {
  const [form, setForm] = React.useState({ author: '', role: '', text: '', rating: 5, website: '' });
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const submit = React.useCallback(async () => {
    if (!form.author.trim() || !form.text.trim()) return;
    if (form.website) { setDone(true); return; } // honeypot
    setSubmitting(true);
    try {
      const res = await fetch('/api/showcase/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          author: form.author,
          role: form.role,
          text: form.text,
          rating: form.rating,
          website: form.website,
        }),
      });
      if (res.ok) setDone(true);
    } catch { /* ignore */ } finally { setSubmitting(false); }
  }, [accessToken, form]);

  return (
    <Box sx={{ bgcolor: '#0B0B0C', borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)', p: { xs: 3, md: 4 }, maxWidth: 560, mx: 'auto', my: 4 }}>
      {done ? (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ color: '#5fb88a' }}>
          <CheckCircle /><Typography>Tusen takk! Omtalen din er sendt.</Typography>
        </Stack>
      ) : (
        <>
          <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: TEXT, mb: 0.5 }}>Hvordan var opplevelsen?</Typography>
          <Typography sx={{ color: MUTED, fontSize: '0.9rem', mb: 2.5 }}>Del en kort omtale — det tar ett minutt.</Typography>
          <Stack spacing={1.75}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField fullWidth size="small" label="Navn" value={form.author} sx={fieldSx}
                onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))} />
              <TextField fullWidth size="small" label="Rolle / prosjekt (valgfritt)" value={form.role} sx={fieldSx}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} />
            </Stack>
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website}
              onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
            <TextField fullWidth size="small" multiline minRows={3} label="Din omtale" value={form.text} sx={fieldSx}
              onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))} />
            <Box>
              <Rating value={form.rating} onChange={(_, v) => setForm((p) => ({ ...p, rating: v || 5 }))}
                sx={{ '& .MuiRating-iconFilled': { color: AMBER }, '& .MuiRating-iconEmpty': { color: 'rgba(255,255,255,0.3)' } }} />
            </Box>
            <Button onClick={submit} disabled={submitting || !form.author.trim() || !form.text.trim()}
              variant="contained" sx={{ alignSelf: 'flex-start', bgcolor: AMBER, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px', px: 3, '&:hover': { bgcolor: '#ffc788' } }}>
              {submitting ? 'Sender…' : 'Send omtale'}
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}
