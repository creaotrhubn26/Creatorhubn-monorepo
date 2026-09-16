/**
 * IdentityVerificationCard.tsx — «Verifiser med BankID».
 *
 * UX-valgene:
 *
 *   Alle tilstander, ikke bare happy path. Fem er reelle her: ikke verifisert,
 *   eID ikke satt opp i miljøet, sender deg videre, verifisert, og feil fra
 *   returen. Den siste har fem ulike grunner som hver får sin egen forklaring
 *   — «noe gikk galt» hjelper ingen som nettopp brukte BankID.
 *
 *   Nedtonet, ikke forklart. Er eID ikke satt opp, er knappen grå og inert med
 *   én kort linje. Ingen varselboks om noe brukeren ikke kan gjøre noe med.
 *
 *   Progressiv avdekking. Én setning om hva merket betyr; detaljene om hva vi
 *   lagrer ligger bak «Hva lagres om meg?». De som bryr seg finner det, de
 *   andre slipper.
 *
 *   Forebygg feil. At fødselsnummeret ikke lagres står FØR knappen, ikke i en
 *   personvernerklæring. Det er det folk nøler på.
 */

import { Alert, Box, Button, Chip, Collapse, Link as MuiLink, Stack, Typography } from '@mui/material';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUserOutlined';
import VerifiedIcon from '@mui/icons-material/Verified';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useCallback, useEffect, useState } from 'react';

import roleRoomTalentsService from '../../services/roleRoomTalentsService';
import { palette, radius } from '../theme';

interface Props {
  verified: boolean;
  verifiedAt: string | null;
  demoMode: boolean;
}

/** Grunnene callback-ruten kan sende tilbake, med hver sin vei videre. */
const FAILURE_TEXT: Record<string, string> = {
  mangler_fodselsnummer:
    'Vi fikk ikke fødselsnummer fra BankID. Det er et oppsett-problem hos oss, ikke hos deg — kontakt support@theroleroom.com.',
  allerede_verifisert:
    'Denne identiteten er allerede knyttet til en annen profil. Har du to kontoer, kontakt support@theroleroom.com.',
  ugyldig_state: 'Verifiseringen tok for lang tid. Start på nytt.',
  mangler_state: 'Verifiseringen tok for lang tid. Start på nytt.',
  ikke_konfigurert: 'Verifisering er ikke tilgjengelig akkurat nå.',
  svakere_bevis: 'Vi kunne ikke oppdatere verifiseringen med et svakere bevis enn det du alt har.',
  verifisering_feilet: 'Verifiseringen ble ikke fullført. Prøv igjen.',
  start_failed: 'Vi klarte ikke å starte verifiseringen. Prøv igjen.',
  eid_not_configured: 'Verifisering er ikke tilgjengelig akkurat nå.',
};

const STORED_FACTS = [
  'Vi lagrer ikke fødselsnummeret ditt — bare et kryptografisk avtrykk som ikke kan regnes tilbake.',
  'Vi lagrer navnet BankID oppgir, og fødselsåret ditt. Fødselsår trengs for roller med aldersgrense.',
  'Byråer ser kun at profilen er verifisert. De får ikke avtrykket eller fødselsåret uten at du deler demografi.',
];

export default function IdentityVerificationCard({ verified, verifiedAt, demoMode }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justVerified, setJustVerified] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Returen fra BankID legger utfallet i URL-en. Les det, vis det, og rydd
  // vekk parameterne — ellers står meldingen igjen ved neste besøk.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('eid');
    if (!outcome) return;

    if (outcome === 'verifisert') setJustVerified(true);
    else if (outcome === 'feil') {
      const reason = params.get('grunn') ?? '';
      setError(FAILURE_TEXT[reason] ?? FAILURE_TEXT.verifisering_feilet);
    }

    params.delete('eid');
    params.delete('grunn');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);

  useEffect(() => {
    if (demoMode || verified) return;
    void roleRoomTalentsService.fetchEidConfig().then((c) => setConfigured(c.configured));
  }, [demoMode, verified]);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await roleRoomTalentsService.startIdentityVerification(
      `${window.location.pathname}`,
    );
    if ('error' in result) {
      setError(FAILURE_TEXT[result.error] ?? FAILURE_TEXT.start_failed);
      setBusy(false);
      return;
    }
    // Ingen setBusy(false): vi forlater siden.
    window.location.href = result.authorizeUrl;
  }, []);

  if (verified || justVerified) {
    return (
      <Box sx={{ bgcolor: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: radius.lg, p: 2.4, mb: 2 }}>
        <Stack direction="row" spacing={1.6} alignItems="center">
          <VerifiedIcon sx={{ color: palette.success, fontSize: 26 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography sx={{ color: palette.textPrimary, fontWeight: 700 }}>
                Identiteten din er verifisert
              </Typography>
              <Chip
                size="small"
                label="BankID"
                sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: palette.success, fontWeight: 700, height: 20 }}
              />
            </Stack>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem', mt: 0.3 }}>
              {verifiedAt
                ? `Verifisert ${new Date(verifiedAt).toLocaleDateString('nb-NO')}. Byråer ser at profilen er ekte.`
                : 'Byråer ser at profilen er ekte.'}
            </Typography>
          </Box>
        </Stack>
      </Box>
    );
  }

  const unavailable = configured === false;

  return (
    <Box sx={{ bgcolor: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: radius.lg, p: 2.4, mb: 2 }}>
      <Stack direction="row" spacing={1.6} alignItems="flex-start">
        <VerifiedUserIcon sx={{ color: unavailable ? palette.textMuted : palette.accentBright, fontSize: 24, mt: 0.2 }} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700 }}>
            Verifiser identiteten din
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.88rem', mt: 0.4, lineHeight: 1.55 }}>
            Casting-byråer ser hvem som er verifisert. Det tar under et minutt, gjøres én gang, og
            koster deg ingenting.
          </Typography>

          {error && <Alert severity="error" sx={{ mt: 1.6 }}>{error}</Alert>}

          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 1.8 }} flexWrap="wrap" useFlexGap>
            <Button
              onClick={() => void start()}
              disabled={busy || demoMode || unavailable}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                px: 2.4,
                borderRadius: radius.sm,
                background: unavailable ? 'transparent' : palette.accentGradient,
                border: unavailable ? `1px solid ${palette.borderSubtle}` : 'none',
                color: unavailable ? palette.textMuted : '#fff',
              }}
            >
              {busy ? 'Sender deg til BankID…' : 'Verifiser med BankID'}
            </Button>
            {unavailable && (
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                Ikke tilgjengelig ennå.
              </Typography>
            )}
          </Stack>

          <MuiLink
            component="button"
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.4,
              mt: 1.4,
              color: palette.accentBright,
              fontSize: '0.84rem',
              textDecoration: 'none',
            }}
          >
            Hva lagres om meg?
            <ExpandMoreIcon
              sx={{ fontSize: 18, transform: detailsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 140ms' }}
            />
          </MuiLink>
          <Collapse in={detailsOpen}>
            <Stack component="ul" spacing={0.7} sx={{ m: 0, mt: 1, pl: 2.2 }}>
              {STORED_FACTS.map((fact) => (
                <Typography
                  key={fact}
                  component="li"
                  sx={{ color: palette.textSecondary, fontSize: '0.84rem', lineHeight: 1.5 }}
                >
                  {fact}
                </Typography>
              ))}
            </Stack>
          </Collapse>
        </Box>
      </Stack>
    </Box>
  );
}
