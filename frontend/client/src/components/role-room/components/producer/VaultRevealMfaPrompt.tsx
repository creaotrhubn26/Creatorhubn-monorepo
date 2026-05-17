/**
 * VaultRevealMfaPrompt — 2FA step-up modal når backend returnerer
 * mfa_required ved vault-reveal-request.
 *
 * Backend-response som triggrer denne modalen:
 *   {
 *     error: 'mfa_required',
 *     availableMethods: { totp: boolean, emailCode: boolean },
 *     policy: 'mfa_required' | 'approval_required' | ...,
 *     message: string
 *   }
 *
 * Brukeren får to muligheter:
 *   1. TOTP-kode fra Authenticator (hvis aktivert)
 *   2. E-post-kode (alltid tilgjengelig hvis bruker har e-post i session)
 *
 * Når brukeren submitter, kaller vi onSubmit({ totpCode | emailCode }) og
 * parent-component retry'er request-reveal-kallet med den nye koden.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Shield as ShieldIcon, MailOutline as MailIcon } from '@mui/icons-material';

export interface VaultRevealMfaPromptProps {
  open: boolean;
  onClose: () => void;
  availableMethods: { totp: boolean; emailCode: boolean };
  policy: string;
  message: string;
  /** Bruker-e-post — vises i e-post-kode-fanen for kontekst og brukes
   *  når vi sender request til /api/auth/email-code/send. */
  userEmail: string;
  /** Kalles når brukeren submitter en kode. Parent skal kalle backend
   *  med den nye koden og kalle onClose() ved suksess. Hvis backend
   *  returnerer ny mfa_required (feil kode), kall setError() istedenfor. */
  onSubmit: (input: { totpCode?: string; emailCode?: string }) => Promise<{ ok: boolean; errorMessage?: string }>;
}

const VaultRevealMfaPrompt: React.FC<VaultRevealMfaPromptProps> = ({
  open, onClose, availableMethods, policy, message, userEmail, onSubmit,
}) => {
  // Default-fane: TOTP hvis tilgjengelig, ellers e-post
  const [activeTab, setActiveTab] = useState<'totp' | 'email'>(
    availableMethods.totp ? 'totp' : 'email',
  );
  const [totpCode, setTotpCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setTotpCode('');
      setEmailCode('');
      setEmailCodeSent(false);
      setError(null);
      setActiveTab(availableMethods.totp ? 'totp' : 'email');
    }
  }, [open, availableMethods.totp]);

  const handleSendEmailCode = useCallback(async (): Promise<void> => {
    setSendingEmail(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/email-code/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, purpose: 'vault_reveal' }),
      });
      if (response.ok) {
        const payload = await response.json().catch(() => null) as { devCode?: string } | null;
        if (payload?.devCode) {
          setError(`Dev-mode: koden er ${payload.devCode}`);
        }
        setEmailCodeSent(true);
      } else {
        setError('Kunne ikke sende kode. Prøv igjen.');
      }
    } catch {
      setError('Nettverksfeil — prøv igjen.');
    } finally {
      setSendingEmail(false);
    }
  }, [userEmail]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    setError(null);
    if (activeTab === 'totp' && totpCode.length < 6) {
      setError('Koden må være 6 sifre.');
      return;
    }
    if (activeTab === 'email' && emailCode.length < 6) {
      setError('Koden må være 6 sifre.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await onSubmit(
        activeTab === 'totp' ? { totpCode } : { emailCode },
      );
      if (!result.ok) {
        setError(result.errorMessage ?? 'Feil kode. Prøv igjen.');
      }
      // Parent ansvarlig for å lukke modalen ved suksess
    } finally {
      setSubmitting(false);
    }
  }, [activeTab, totpCode, emailCode, onSubmit]);

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#0b1226', color: '#f8fafc' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
        <ShieldIcon sx={{ color: '#22d3ee' }} />
        <Stack spacing={0.2}>
          <Typography sx={{ fontWeight: 800 }}>
            Bekreft for å se passord
          </Typography>
          <Typography sx={{ fontSize: '0.74rem', color: 'rgba(226,232,240,0.6)', fontWeight: 400 }}>
            {policy === 'mfa_required'
              ? 'Denne secret-en krever ekstra bekreftelse for hver reveal.'
              : 'Du har 2FA aktivert — bekreft for å se passordet.'}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ fontSize: '0.84rem', color: 'rgba(226,232,240,0.72)', mb: 1.6 }}>
          {message}
        </Typography>

        {availableMethods.totp && availableMethods.emailCode ? (
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{
              mb: 1.8,
              borderBottom: '1px solid rgba(148,163,184,0.2)',
              '& .MuiTab-root': { color: 'rgba(226,232,240,0.6)', textTransform: 'none', minHeight: 36 },
              '& .MuiTab-root.Mui-selected': { color: '#22d3ee' },
              '& .MuiTabs-indicator': { bgcolor: '#22d3ee' },
            }}
          >
            <Tab value="totp" label="Authenticator-app" icon={<ShieldIcon fontSize="small" />} iconPosition="start" />
            <Tab value="email" label="E-post-kode" icon={<MailIcon fontSize="small" />} iconPosition="start" />
          </Tabs>
        ) : null}

        {activeTab === 'totp' ? (
          <Stack spacing={1.2}>
            <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.7)' }}>
              Åpne Authenticator-appen og skriv inn 6-sifret kode for Creatorhub.
            </Typography>
            <TextField
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              fullWidth
              placeholder="123456"
              inputProps={{
                inputMode: 'numeric',
                maxLength: 6,
                style: { letterSpacing: '8px', fontSize: '1.4rem', textAlign: 'center', fontFamily: 'monospace' },
              }}
              sx={textFieldSx}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
            />
          </Stack>
        ) : (
          <Stack spacing={1.2}>
            <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.7)' }}>
              Vi sender en 6-sifret kode til <strong>{userEmail}</strong>.
            </Typography>
            {!emailCodeSent ? (
              <Button
                onClick={() => void handleSendEmailCode()}
                disabled={sendingEmail}
                variant="outlined"
                sx={{
                  textTransform: 'none',
                  color: '#22d3ee',
                  borderColor: 'rgba(34,211,238,0.4)',
                  alignSelf: 'flex-start',
                  '&:hover': { borderColor: '#22d3ee', bgcolor: 'rgba(34,211,238,0.08)' },
                }}
              >
                {sendingEmail ? 'Sender…' : 'Send kode på e-post'}
              </Button>
            ) : (
              <>
                <Typography sx={{ fontSize: '0.78rem', color: '#34d399' }}>
                  ✓ Kode sendt til {userEmail}. Sjekk innboksen (og spam).
                </Typography>
                <TextField
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                  fullWidth
                  placeholder="123456"
                  inputProps={{
                    inputMode: 'numeric',
                    maxLength: 6,
                    style: { letterSpacing: '8px', fontSize: '1.4rem', textAlign: 'center', fontFamily: 'monospace' },
                  }}
                  sx={textFieldSx}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
                />
                <Button
                  size="small"
                  onClick={() => void handleSendEmailCode()}
                  disabled={sendingEmail}
                  sx={{ textTransform: 'none', color: '#94a3b8', alignSelf: 'flex-start' }}
                >
                  Send ny kode
                </Button>
              </>
            )}
          </Stack>
        )}

        {error ? (
          <Alert severity={error.startsWith('Dev-mode') ? 'info' : 'error'} sx={{ mt: 1.6, bgcolor: error.startsWith('Dev-mode') ? 'rgba(96,165,250,0.1)' : 'rgba(239,68,68,0.1)' }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting} sx={{ textTransform: 'none', color: '#94a3b8' }}>
          Avbryt
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          disabled={
            submitting
            || (activeTab === 'totp' && totpCode.length < 6)
            || (activeTab === 'email' && (!emailCodeSent || emailCode.length < 6))
          }
          variant="contained"
          startIcon={submitting ? <CircularProgress size={14} sx={{ color: '#0b1226' }} /> : null}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: '#22d3ee',
            color: '#0b1226',
            '&:hover': { bgcolor: '#06b6d4' },
          }}
        >
          {submitting ? 'Bekrefter…' : 'Bekreft'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const textFieldSx = {
  '& .MuiInputBase-input': { color: '#f8fafc' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
} as const;

export default VaultRevealMfaPrompt;
