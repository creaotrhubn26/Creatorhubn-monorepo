// Slice 9X.22 — public landingsside for brudepar.
// De skriver inn 6-tegns wedding-access-koden de fikk i invitasjons-mailen
// og blir redirected til /wedding/timeline/:token (selve formularet).

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Box, Typography, Paper, TextField, Button, Alert, CircularProgress,
  Stack, InputAdornment,
} from '@mui/material';
import { FavoriteBorder, Login } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

const VALID_RE = /^[A-Z0-9]*$/;

export default function WeddingAccessPage() {
  const [, navigate] = useLocation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const q = (params.get('code') || '').trim().toUpperCase();
    if (q && !autoSubmitted) {
      setCode(q);
      setAutoSubmitted(true);
      void attempt(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function attempt(raw: string) {
    const clean = raw.trim().toUpperCase();
    if (clean.length < 4) { setError('Koden er for kort.'); return; }
    setError(null); setLoading(true);
    try {
      const r = await apiRequest(`/api/wedding/access?code=${encodeURIComponent(clean)}`) as {
        accessToken: string; weddingUrl: string; coupleName: string;
      };
      navigate(r.weddingUrl);
    } catch (err: any) {
      let msg = String(err?.message || 'Ukjent feil');
      try {
        const p = JSON.parse(msg);
        switch (p.error) {
          case 'code_not_found': msg = 'Koden er ikke gyldig. Sjekk at du har skrevet den riktig.'; break;
          case 'access_disabled': msg = 'Tilgangen er deaktivert. Kontakt fotografen din.'; break;
          case 'data_deleted': msg = 'Wedding-timeline-dataen er slettet (GDPR).'; break;
          case 'invalid_code_format': msg = 'Koden har feil format.'; break;
          default: msg = p.message || p.error || msg;
        }
      } catch { /* not JSON */ }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #fff5e6 0%, #ffe0c4 100%)', p: 2,
    }}>
      <Paper sx={{ p: { xs: 3, md: 5 }, maxWidth: 460, width: '100%', textAlign: 'center' }}>
        <Box sx={{ mb: 3 }}>
          <FavoriteBorder sx={{ fontSize: 52, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Velkommen til bryllups-timeline
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Skriv inn 6-tegns koden du fikk fra fotografen.
          </Typography>
        </Box>

        <Stack spacing={2} component="form" onSubmit={(e) => {
          e.preventDefault();
          void attempt(code);
        }}>
          <TextField
            autoFocus fullWidth
            value={code}
            onChange={(e) => {
              const next = e.target.value.toUpperCase();
              if (VALID_RE.test(next)) setCode(next);
            }}
            placeholder="ABC123"
            inputProps={{
              maxLength: 8,
              style: {
                fontFamily: 'monospace', fontSize: '1.8rem',
                letterSpacing: '0.4em', textAlign: 'center', textTransform: 'uppercase',
              },
            }}
            disabled={loading}
            error={!!error}
            InputProps={{
              startAdornment: loading ? (
                <InputAdornment position="start"><CircularProgress size={20} /></InputAdornment>
              ) : undefined,
            }}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button
            type="submit" variant="contained" size="large" fullWidth
            disabled={loading || code.length < 4}
            startIcon={!loading && <Login />} sx={{ py: 1.5 }}
          >
            {loading ? 'Sjekker…' : 'Åpne timeline'}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Mangler du kode? Spør fotografen din.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
