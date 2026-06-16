// @ts-nocheck
/**
 * AiConsentGate — wraps any Role Room Agent entry point behind an explicit
 * GDPR consent dialog ("Samtykke-port"). If consent is absent or revoked, the
 * surface shows the polished consent gate instead of invoking the agent.
 *
 * GDPR Art. 6.1a/7: consent is freely given, specific, informed and
 * unambiguous. The gate describes pseudonymisering, databehandling,
 * brukerens rettigheter og databehandler — og loggføres med tidsstempel +
 * versjon. Wiring (grant/revoke/hydrate) er uendret; kun presentasjonen er
 * oppgradert til Agent-designet.
 */

import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import LockIcon from '@mui/icons-material/Lock';
import MasksIcon from '@mui/icons-material/Masks';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import GavelIcon from '@mui/icons-material/Gavel';
import ShieldIcon from '@mui/icons-material/Shield';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import {
  AiConsentScope,
  getProjectConsent,
  grantProjectConsent,
  hydrateProjectConsent,
} from '../../services/aiConsentService';

interface AiConsentGateProps {
  projectId: string;
  currentUserId: string;
  /** Rendered when consent exists. */
  children: React.ReactNode;
  /** Rendered when consent is missing. Defaults to the consent gate. */
  fallback?: React.ReactNode;
  /** Scope som registreres ved «Godta og fortsett». */
  grantScope?: AiConsentScope;
}

const CONSENT_VERSION = '2.4';
const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

const POINTS = [
  { icon: <MasksIcon sx={{ fontSize: 18 }} />, title: 'Pseudonymisering', text: 'Navn, e-post og telefon byttes ut med anonyme nøkler før analyse.' },
  { icon: <CloudSyncIcon sx={{ fontSize: 18 }} />, title: 'Databehandling', text: 'Behandles kun for å gi deg innsikt og forslag. Lagres ikke til modelltrening.' },
  { icon: <GavelIcon sx={{ fontSize: 18 }} />, title: 'Dine rettigheter', text: 'Du kan trekke samtykket og slette dataene når som helst. GDPR-kompatibelt.' },
];

export const AiConsentGate: React.FC<AiConsentGateProps> = ({
  projectId,
  currentUserId,
  children,
  fallback,
  grantScope = 'full_context',
}) => {
  const [record, setRecord] = useState(() => getProjectConsent(projectId));
  const [pending, setPending] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hydrated = await hydrateProjectConsent(projectId, currentUserId);
      if (!cancelled) setRecord(hydrated);
    })();
    return () => { cancelled = true; };
  }, [projectId, currentUserId]);

  if (record) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  const handleGrant = async () => {
    setPending(true);
    setErrorMsg(null);
    try {
      const next = await grantProjectConsent({
        projectId,
        scope: grantScope,
        grantedByUserId: currentUserId,
        note: `Samtykke-port v${CONSENT_VERSION}`,
      });
      setRecord(next);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Kunne ikke registrere samtykke');
    } finally {
      setPending(false);
    }
  };

  return (
    <Box
      sx={{
        position: 'relative', maxWidth: 480, mx: 'auto', borderRadius: 3, p: { xs: 2.4, md: 3 }, overflow: 'hidden',
        border: '1px solid rgba(167,139,250,0.2)',
        background:
          'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.20), transparent 55%), radial-gradient(110% 80% at 100% 114%, rgba(217,70,239,0.14), transparent 50%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
        boxShadow: '0 20px 56px rgba(124,58,237,0.28)',
      }}
    >
      {/* Brand + eyebrow */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.1}>
          <Box sx={{ width: 32, height: 32, borderRadius: 1.5, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 6px 16px rgba(168,85,247,0.45)' }}>
            <AutoAwesomeIcon sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: INK, lineHeight: 1.1 }}>The Role Room Agent</Typography>
            <Typography sx={{ fontSize: 11.5, color: MUTED }}>AI-laget for innholdsprodusenter</Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1, py: 0.5, borderRadius: 999, bgcolor: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.28)' }}>
          <VerifiedUserIcon sx={{ fontSize: 14, color: ACCENT }} />
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd' }}>Samtykke-port</Typography>
        </Stack>
      </Stack>

      {/* Lock + tittel */}
      <Stack alignItems="center" sx={{ mb: 2 }}>
        <Box sx={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 10px 28px rgba(168,85,247,0.5)', mb: 1.4 }}>
          <LockIcon sx={{ fontSize: 26, color: '#fff' }} />
        </Box>
        <Typography sx={{ fontSize: 19, fontWeight: 800, color: INK, textAlign: 'center', lineHeight: 1.2 }}>
          Før Agenten analyserer dataene dine
        </Typography>
        <Typography sx={{ fontSize: 13, color: MUTED, textAlign: 'center', mt: 0.8, lineHeight: 1.5, maxWidth: 400 }}>
          Vi trenger ditt samtykke for å behandle innholds- og engasjementsdata. Personopplysninger pseudonymiseres før de sendes til AI-modellen.
        </Typography>
      </Stack>

      {/* Punkter */}
      <Stack spacing={1} sx={{ mb: 1.6 }}>
        {POINTS.map((p, i) => (
          <Box key={p.title} sx={{ p: 1.3, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.12)' }}>
            <Stack direction="row" alignItems="flex-start" spacing={1.2}>
              <Box sx={{ width: 32, height: 32, borderRadius: 1.5, display: 'grid', placeItems: 'center', flexShrink: 0, color: '#fff', background: GRAD }}>{p.icon}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{p.title}</Typography>
                <Typography sx={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>{p.text}</Typography>
                {/* Pseudonymiserings-eksempel under punkt 1 */}
                {i === 0 ? (
                  <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mt: 0.8 }}>
                    <Typography sx={{ fontSize: 11.5, fontFamily: 'monospace', color: 'rgba(226,232,240,0.85)', px: 0.8, py: 0.3, borderRadius: 1, bgcolor: 'rgba(148,163,184,0.12)' }}>kari.nordmann@epost.no</Typography>
                    <ArrowForwardIcon sx={{ fontSize: 14, color: ACCENT }} />
                    <Typography sx={{ fontSize: 11.5, fontFamily: 'monospace', color: '#e9d5ff', px: 0.8, py: 0.3, borderRadius: 1, bgcolor: 'rgba(168,85,247,0.16)' }}>lead_8f3a2c</Typography>
                  </Stack>
                ) : null}
              </Box>
              <CheckRoundedIcon sx={{ fontSize: 18, color: '#34d399', flexShrink: 0 }} />
            </Stack>
          </Box>
        ))}
      </Stack>

      {/* Databehandler */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.2, mb: 2, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.4)', border: '1px solid rgba(148,163,184,0.12)' }}>
        <ShieldIcon sx={{ fontSize: 17, color: ACCENT, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 11.5, color: MUTED, lineHeight: 1.4 }}>
          Databehandler: <Box component="span" sx={{ color: '#e9d5ff', fontWeight: 700 }}>Anthropic (Claude)</Box> · EU-region · Kryptert i transitt og hvile
        </Typography>
        <CheckRoundedIcon sx={{ fontSize: 16, color: '#34d399', ml: 'auto', flexShrink: 0 }} />
      </Stack>

      {errorMsg ? (
        <Typography sx={{ fontSize: 12.5, color: '#fca5a5', textAlign: 'center', mb: 1.5 }}>{errorMsg}</Typography>
      ) : null}

      {declined ? (
        <Box sx={{ textAlign: 'center', mb: 1.5 }}>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mb: 1 }}>Du avslo samtykket — Agenten er av for dette prosjektet.</Typography>
          <Button onClick={() => setDeclined(false)} size="small" sx={{ textTransform: 'none', fontWeight: 700, color: ACCENT }}>Vurder igjen</Button>
        </Box>
      ) : (
        <Stack spacing={1}>
          <Button
            onClick={handleGrant} disabled={pending}
            variant="contained" disableElevation fullWidth
            startIcon={pending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <CheckCircleIcon />}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2, py: 1.1, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' } }}
          >
            {pending ? 'Registrerer …' : 'Godta og fortsett'}
          </Button>
          <Button onClick={() => setDeclined(true)} disabled={pending} fullWidth sx={{ textTransform: 'none', fontWeight: 700, color: MUTED }}>
            Avslå
          </Button>
        </Stack>
      )}

      {/* Footer */}
      <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.6} sx={{ mt: 1.8, pt: 1.4, borderTop: '1px solid rgba(148,163,184,0.12)' }}>
        <LockIcon sx={{ fontSize: 12, color: MUTED }} />
        <Typography sx={{ fontSize: 11, color: MUTED }}>Samtykket logges med tidsstempel · Versjon {CONSENT_VERSION}</Typography>
      </Stack>
    </Box>
  );
};

export default AiConsentGate;
