/**
 * VaultTrustCeremony — første-gangs «tillits-seremoni» for klient-vaulten
 * (vinner-konseptet fra infographic-studio). En rolig, bevisst onboarding som
 * bygger tillit FØR klienten overleverer sitt første passord: du eier nøklene,
 * produsenten må be om innsyn, du ser alltid hvem som så hva. Ærlig om
 * kryptering — INGEN falske «E2E i nettleseren»-løfter.
 *
 * Vises kun første gang (localStorage rr_vault_ceremony_seen).
 */
import { useState } from 'react';
import {
  Dialog, Box, Stack, Typography, Button, MobileStepper,
} from '@mui/material';
import {
  ShieldOutlined as ShieldIcon,
  VpnKeyOutlined as KeyIcon,
  VerifiedUserOutlined as MfaIcon,
  HistoryOutlined as AuditIcon,
  LockOutlined as LockIcon,
  KeyboardArrowRight as NextIcon,
  KeyboardArrowLeft as PrevIcon,
} from '@mui/icons-material';

const STEPS = [
  {
    icon: <ShieldIcon sx={{ fontSize: 40, color: '#6ee7b7' }} />,
    title: 'Du eier nøklene',
    body: 'Her deler du tilganger (som Google Ads) trygt med produksjonsteamet — uten å sende passord på e-post eller Slack. Du legger dem inn, du bestemmer hvem som får se dem.',
  },
  {
    icon: <LockIcon sx={{ fontSize: 40, color: '#7dd3fc' }} />,
    title: 'Slik er det faktisk trygt',
    body: 'Alt krypteres i hvile (AES-256-GCM) og sendes over TLS. Vi dekrypterer kun i minnet i det øyeblikket et godkjent innsyn vises — aldri logget, aldri bufret i nettleseren. Vi lover ikke mer enn det vi faktisk gjør.',
  },
  {
    icon: <MfaIcon sx={{ fontSize: 40, color: '#c4b5fd' }} />,
    title: 'Ingen stille uttak',
    body: 'Produsenten kan ikke bare «hente» et passord. De må be om innsyn med en begrunnelse og bekrefte med 2FA — og du kan kreve at du godkjenner hver gang. Innsyn er tidsbegrenset og låses automatisk.',
  },
  {
    icon: <AuditIcon sx={{ fontSize: 40, color: '#fcd34d' }} />,
    title: 'Du ser alltid hvem som så hva',
    body: 'Hver eneste handling logges i en uforanderlig logg du har innsyn i: hvem ba om tilgang, når, og når den ble vist. Full åpenhet, begge veier.',
  },
];

export default function VaultTrustCeremony({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  const finish = () => {
    try { window.localStorage.setItem('rr_vault_ceremony_seen', '1'); } catch { /* ignore */ }
    onClose();
  };

  return (
    <Dialog
      open={open} onClose={finish} maxWidth="xs" fullWidth
      slotProps={{ paper: { sx: { background: 'linear-gradient(180deg,#0c0a18,#0a0a14)', border: '1px solid rgba(168,85,247,0.35)', color: '#e2e8f0', borderRadius: 3 } } }}
    >
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Stack spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
          <KeyIcon sx={{ fontSize: 18, color: '#a855f7' }} />
          <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1 }}>ACCESS VAULT</Typography>
        </Stack>
        <Box sx={{ my: 2.5, display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: 80, height: 80, borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)' }}>
            {s.icon}
          </Box>
        </Box>
        <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.25rem', mb: 1 }}>{s.title}</Typography>
        <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.9rem', lineHeight: 1.6, minHeight: 96 }}>{s.body}</Typography>

        <MobileStepper
          variant="dots" steps={STEPS.length} position="static" activeStep={step}
          sx={{ background: 'transparent', justifyContent: 'center', mt: 1.5, '& .MuiMobileStepper-dot': { background: 'rgba(148,163,184,0.3)' }, '& .MuiMobileStepper-dotActive': { background: '#a855f7' } }}
          nextButton={<span />} backButton={<span />}
        />

        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          {step > 0 ? (
            <Button onClick={() => setStep((v) => v - 1)} startIcon={<PrevIcon />} sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44, color: 'rgba(226,232,240,0.8)' }}>Tilbake</Button>
          ) : (
            <Button onClick={finish} sx={{ textTransform: 'none', fontWeight: 600, minHeight: 44, color: 'rgba(226,232,240,0.8)' }}>Hopp over</Button>
          )}
          <Box sx={{ flex: 1 }} />
          {last ? (
            <Button onClick={finish} variant="contained" startIcon={<ShieldIcon />} sx={{ textTransform: 'none', fontWeight: 800, minHeight: 44, px: 3, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)', '&:hover': { background: 'linear-gradient(135deg,#9333ea,#c026d3)' } }}>
              Legg inn første tilgang
            </Button>
          ) : (
            <Button onClick={() => setStep((v) => v + 1)} variant="contained" endIcon={<NextIcon />} sx={{ textTransform: 'none', fontWeight: 800, minHeight: 44, px: 3, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)', '&:hover': { background: 'linear-gradient(135deg,#9333ea,#c026d3)' } }}>
              Videre
            </Button>
          )}
        </Stack>
      </Box>
    </Dialog>
  );
}
