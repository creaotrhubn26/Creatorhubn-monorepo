// Slice 9X.15 — public landingsside hvor klient skriver inn en kort
// 6-tegns kode og blir sendt videre til sitt galleri. Erstatter behovet
// for å dele lange UUID-tokens på e-post — Stine kan dele en kort kode
// muntlig eller på SMS uten å lekke link i hele organisasjonen.

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Box, Typography, Paper, TextField, Button, Alert, CircularProgress,
  Stack, InputAdornment,
} from '@mui/material';
import { Lock, Login } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

const VALID_CHARS_RE = /^[A-Z0-9]*$/;

export default function PortalPage() {
  const [, navigate] = useLocation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  // Auto-fill + auto-submit hvis ?code= i URL-en (fra e-post-link)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const queryCode = (params.get('code') || '').trim().toUpperCase();
    if (queryCode && !autoSubmitted) {
      setCode(queryCode);
      setAutoSubmitted(true);
      void attemptLookup(queryCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function attemptLookup(rawCode: string) {
    const clean = rawCode.trim().toUpperCase();
    if (clean.length < 4) {
      setError('Koden er for kort.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await apiRequest(`/api/portal/lookup?code=${encodeURIComponent(clean)}`) as {
        accessToken: string;
        galleryUrl: string;
        projectTitle: string;
      };
      // Redirect til galleri
      navigate(result.galleryUrl);
    } catch (err: any) {
      let msg = String(err?.message || 'Ukjent feil');
      let userMsg = 'Noe gikk galt. Prøv igjen.';
      try {
        const parsed = JSON.parse(msg);
        switch (parsed.error) {
          case 'code_not_found':
            userMsg = 'Koden er ikke gyldig. Sjekk at du har skrevet den riktig.';
            break;
          case 'code_expired':
            userMsg = 'Koden har utløpt. Kontakt fotografen for ny kode.';
            break;
          case 'code_max_uses_reached':
            userMsg = 'Koden har nådd grensen for antall bruk. Kontakt fotografen.';
            break;
          case 'gallery_unavailable':
            userMsg = 'Galleriet er ikke lenger tilgjengelig.';
            break;
          case 'invalid_code_format':
            userMsg = 'Koden har feil format. Den skal være 6 tegn.';
            break;
        }
      } catch { /* not JSON */ }
      setError(userMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: '#fafafa',
      p: 2,
    }}>
      <Paper sx={{ p: { xs: 3, md: 5 }, maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <Box sx={{ mb: 3 }}>
          <Lock sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Åpne galleriet ditt
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Skriv inn 6-tegns koden du fikk fra fotografen.
          </Typography>
        </Box>

        <Stack spacing={2} component="form" onSubmit={(e) => {
          e.preventDefault();
          void attemptLookup(code);
        }}>
          <TextField
            autoFocus
            fullWidth
            value={code}
            onChange={(e) => {
              const next = e.target.value.toUpperCase();
              if (VALID_CHARS_RE.test(next)) setCode(next);
            }}
            placeholder="ABC123"
            inputProps={{
              maxLength: 8,
              style: {
                fontFamily: 'monospace',
                fontSize: '1.8rem',
                letterSpacing: '0.4em',
                textAlign: 'center',
                textTransform: 'uppercase',
              },
            }}
            disabled={loading}
            error={!!error}
            InputProps={{
              startAdornment: loading ? (
                <InputAdornment position="start">
                  <CircularProgress size={20} />
                </InputAdornment>
              ) : undefined,
            }}
          />

          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={loading || code.length < 4}
            startIcon={!loading && <Login />}
            sx={{ py: 1.5 }}
          >
            {loading ? 'Sjekker…' : 'Åpne galleri'}
          </Button>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Har du ikke kode? Spør fotografen din eller sjekk e-posten du fikk.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
