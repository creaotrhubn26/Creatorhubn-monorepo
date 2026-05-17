/**
 * /innstillinger/sikkerhet — sikkerhetsinnstillinger for innlogget bruker.
 *
 * Foreløpig kun TOTP-2FA-oppsett. Plass for å legge til flere
 * sikkerhets-features senere (passord-endring, slett konto, sessions-
 * oversikt, login-historikk).
 */

import { Link as WouterLink } from 'wouter';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { ArrowBack as BackIcon, Shield as ShieldIcon } from '@mui/icons-material';
import TwoFactorSetup from '@/components/TwoFactorSetup';
import authSessionService from '@/components/role-room/services/authSessionService';

export default function SecuritySettingsPage() {
  const session = authSessionService.getSessionSync();

  if (!session?.adminUser) {
    return (
      <Box sx={pageSx}>
        <Container maxWidth="md">
          <Alert severity="warning" sx={{ mt: 4 }}>
            Du må være logget inn for å endre sikkerhetsinnstillinger.{' '}
            <Button component={WouterLink} href="/login" sx={{ textTransform: 'none', color: '#22d3ee' }}>
              Logg inn
            </Button>
          </Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={pageSx}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button
          component={WouterLink}
          href="/"
          startIcon={<BackIcon />}
          sx={{ textTransform: 'none', color: '#94a3b8', mb: 2 }}
        >
          Tilbake
        </Button>

        <Stack direction="row" alignItems="center" spacing={1.6} sx={{ mb: 3 }}>
          <ShieldIcon sx={{ color: '#22d3ee', fontSize: 32 }} />
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', color: '#f8fafc', lineHeight: 1.1 }}>
              Sikkerhet
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.65)', fontSize: '0.92rem', mt: 0.4 }}>
              Logget inn som {session.adminUser.email}
            </Typography>
          </Box>
        </Stack>

        <Paper
          sx={{
            p: 3,
            bgcolor: 'rgba(15,23,42,0.8)',
            color: '#f8fafc',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: 2.5,
          }}
        >
          <TwoFactorSetup userEmail={session.adminUser.email} />
        </Paper>

        <Box
          sx={{
            mt: 3,
            p: 2,
            borderRadius: 2,
            bgcolor: 'rgba(96,165,250,0.06)',
            border: '1px solid rgba(96,165,250,0.2)',
          }}
        >
          <Typography sx={{ fontSize: '0.84rem', color: '#bfdbfe', fontWeight: 700, mb: 0.4 }}>
            Hvorfor aktivere 2FA?
          </Typography>
          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.7)', lineHeight: 1.6 }}>
            Med 2FA aktivert må du gi en 6-sifret kode fra Authenticator-appen
            hver gang du logger inn. Det stopper angrep selv hvis noen får tak
            i passordet ditt. I tillegg får du <strong>step-up auth</strong>:
            du må bekrefte med kode hver gang du vil se et passord fra Client Access Vault.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

const pageSx = {
  minHeight: '100vh',
  bgcolor: '#0b1220',
  color: '#e2e8f0',
} as const;
