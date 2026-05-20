// @ts-nocheck
/**
 * AcceptPrototypeTesterInvite — Slice 9X.53
 *
 * Public-side hvor en godkjent prototype-tester:
 *   1. Ser hva som forventes i 12-ukers-perioden (program-vilkår)
 *   2. Leser NDA-en
 *   3. Krysser av begge (program-terms + NDA)
 *   4. Signerer med fullt navn
 *   5. Blir aktivert og redirectes til dashboard med velkomst-modal
 *
 * Adskilt fra /role-room/accept-invite — det er kun for Role Room.
 */

import React, { useEffect, useState } from 'react';
import {
  Container,
  Card,
  CardContent,
  Stack,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Box,
  Divider,
  Checkbox,
  FormControlLabel,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stepper,
  Step,
  StepLabel,
  Paper,
} from '@mui/material';
import {
  Science as TesterIcon,
  Gavel as NdaIcon,
  CheckCircle as CheckIcon,
  Cancel as XIcon,
  Drafts as MailIcon,
  Schedule as ClockIcon,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { TESTER_PROGRAM_TERMS, PROGRAM_TERMS_VERSION, programTermsAsText } from '@/lib/tester-program-terms';
import { trackEvent } from '@/utils/ga4-client-tracking';
import { testerEvents } from '@/utils/creatorhub-events';

interface Invite {
  id: string;
  email: string;
  name: string;
  testingAreas: string[];
  personalMessage: string | null;
  ndaVersion: string;
  programTermsVersion: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  programDurationWeeks: number;
}

const readToken = (): string => {
  try { return new URLSearchParams(window.location.search).get('token') ?? ''; } catch { return ''; }
};

const AcceptPrototypeTesterInvite: React.FC = () => {
  const [, navigate] = useLocation();
  const token = readToken();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Steg
  const [activeStep, setActiveStep] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedNda, setAcceptedNda] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) { setError('Token mangler i URL'); setLoading(false); return; }
    apiRequest(`/api/prototype-tester-invites/${encodeURIComponent(token)}`)
      .then((r: any) => {
        setInvite(r);
        setSignerName(r.name || '');
      })
      .catch((e: any) => setError(e?.message || 'Invitasjon ikke funnet'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!acceptedTerms || !acceptedNda) { setError('Du må krysse av begge boksene'); return; }
    if (!signerName.trim() || signerName.trim().length < 2) { setError('Skriv fullt navn'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/prototype-tester-invites/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        body: {
          ndaName: signerName.trim(),
          acceptedProgramTerms: true,
          programTermsVersion: PROGRAM_TERMS_VERSION,
        },
      });
      trackEvent('prototype_tester_nda_signed', {
        program_terms_version: PROGRAM_TERMS_VERSION,
      });
      testerEvents.sessionStarted(token);
      setSuccess(true);
      // Sett flag som velkomst-modalen leser
      try { sessionStorage.setItem('prototype-tester-just-signed', '1'); } catch { /* ignore */ }
      setTimeout(() => navigate('/photographer-dashboard-material'), 2500);
    } catch (e: any) {
      setError(e?.message || 'Signering feilet — prøv igjen');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Container sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Container>;
  if (error && !invite) {
    return <Container maxWidth="sm" sx={{ py: 4 }}><Alert severity="error">{error}</Alert></Container>;
  }
  if (!invite) return null;
  if (invite.status !== 'pending') {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity={invite.status === 'accepted' ? 'success' : 'warning'}>
          Denne invitasjonen er {invite.status === 'accepted' ? 'allerede signert' : invite.status}.
        </Alert>
      </Container>
    );
  }
  if (success) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CheckIcon sx={{ fontSize: 72, color: 'success.main' }} />
            <Typography variant="h5" sx={{ mt: 2 }}>Velkommen som tester!</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Du redirectes til dashbordet om noen sekunder…
            </Typography>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
            <TesterIcon color="primary" sx={{ fontSize: 32 }} />
            <Stack>
              <Typography variant="overline" color="primary">Du er invitert!</Typography>
              <Typography variant="h5">Velkommen som prototype-tester</Typography>
            </Stack>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Hei {invite.name}! CreatorHub har godkjent søknaden din. Før du får tilgang må du
            gå gjennom forpliktelses-vilkårene og signere NDA-en.
          </Typography>

          {invite.personalMessage && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.secondary">Personlig melding fra CreatorHub:</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>"{invite.personalMessage}"</Typography>
            </Paper>
          )}

          <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb: 3 }}>
            {/* Steg 1: Program-vilkår */}
            <Step expanded>
              <StepLabel icon={<ClockIcon color={activeStep >= 0 ? 'primary' : 'disabled'} />}>
                <b>Hva du forplikter deg til</b>
              </StepLabel>
              <Box sx={{ ml: 4, mb: 2 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`${TESTER_PROGRAM_TERMS.durationWeeks} uker`} color="primary" />
                  <Chip size="small" label={`~${TESTER_PROGRAM_TERMS.expectedHoursPerWeek} t/uke`} variant="outlined" />
                  <Chip size="small" label={`Min ${TESTER_PROGRAM_TERMS.feedbackMinimumPerMonth} feedback/mnd`} variant="outlined" />
                </Stack>

                <Typography variant="subtitle2" sx={{ mt: 1 }}>Forpliktelser</Typography>
                <List dense disablePadding>
                  {TESTER_PROGRAM_TERMS.obligations.map((o, i) => (
                    <ListItem key={i} sx={{ py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 30 }}><CheckIcon fontSize="small" color="action" /></ListItemIcon>
                      <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={o} />
                    </ListItem>
                  ))}
                </List>

                <Typography variant="subtitle2" sx={{ mt: 2 }}>Du får</Typography>
                <List dense disablePadding>
                  {TESTER_PROGRAM_TERMS.benefits.map((b, i) => (
                    <ListItem key={i} sx={{ py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 30 }}><CheckIcon fontSize="small" color="success" /></ListItemIcon>
                      <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={b} />
                    </ListItem>
                  ))}
                </List>

                <Typography variant="subtitle2" sx={{ mt: 2 }}>Hva du IKKE får</Typography>
                <List dense disablePadding>
                  {TESTER_PROGRAM_TERMS.whatYouDoNotGet.map((b, i) => (
                    <ListItem key={i} sx={{ py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 30 }}><XIcon fontSize="small" color="action" /></ListItemIcon>
                      <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={b} />
                    </ListItem>
                  ))}
                </List>

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                  Exit-klausul: {TESTER_PROGRAM_TERMS.exitClause}
                </Typography>

                <FormControlLabel
                  sx={{ mt: 2, alignItems: 'flex-start' }}
                  control={
                    <Checkbox
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      sx={{ pt: 0.5 }}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Jeg har lest og forstår forpliktelses-vilkårene (versjon {PROGRAM_TERMS_VERSION}).
                      Jeg vil teste minst 1 funksjon per uke og logge minst {TESTER_PROGRAM_TERMS.feedbackMinimumPerMonth} feedback-items per måned.
                    </Typography>
                  }
                />

                <Box sx={{ mt: 1.5 }}>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={!acceptedTerms}
                    onClick={() => setActiveStep(1)}
                  >
                    Fortsett til NDA
                  </Button>
                </Box>
              </Box>
            </Step>

            {/* Steg 2: NDA + signering */}
            <Step expanded={activeStep >= 1}>
              <StepLabel icon={<NdaIcon color={activeStep >= 1 ? 'primary' : 'disabled'} />}>
                <b>NDA + signering</b>
              </StepLabel>
              {activeStep >= 1 && (
                <Box sx={{ ml: 4, mb: 2 }}>
                  <Paper variant="outlined" sx={{ p: 2, maxHeight: 280, overflow: 'auto', mb: 2 }}>
                    <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
{`NON-DISCLOSURE AGREEMENT (NDA) — Prototype Tester Program (v${invite.ndaVersion})

Mellom:
  Creatorhubn AS ("Creatorhubn")
og
  ${invite.name} ("Tester")

1. KONFIDENSIELL INFORMASJON
Tester får tilgang til Creatorhubns ikke-frigjorte funksjoner, interne
roadmap, design-iterasjoner og feilrapport-detaljer. Alt dette behandles
som konfidensielt.

2. FORPLIKTELSER
Tester forplikter seg til:
  a) Ikke dele skjermbilder, video eller funksjons-beskrivelser fra
     plattformen offentlig (sosiale medier, blogger, presentasjoner).
  b) Ikke vise plattformen til personer utenfor programmet uten
     skriftlig samtykke fra Creatorhubn.
  c) Ikke benytte informasjon om kommende funksjoner kommersielt
     før de er offentlig frigjort.

3. VARIGHET
Konfidensialiteten gjelder under hele test-perioden og 12 måneder etter
at programmet er avsluttet, uansett årsak.

4. UNNTAK
NDA-en gjelder ikke informasjon som:
  - Er eller blir offentlig kjent uten Testers feil.
  - Tester allerede besatt før programmet startet.
  - Lovkrav (offentlig myndighet) krever offentliggjøring av.

5. KONSEKVENSER VED BRUDD
Brudd kan medføre umiddelbar utestengelse fra programmet, tap av
post-program-belønning, og krav om kompensasjon for dokumentert skade.

6. SIGNATUR
Ved å skrive ditt fulle navn og klikke "Signer og aktiver"-knappen,
bekrefter du elektronisk denne avtalen. Signatur, IP-adresse og
tidspunkt lagres som juridisk dokumentasjon.`}
                    </Typography>
                  </Paper>

                  <FormControlLabel
                    control={<Checkbox checked={acceptedNda} onChange={(e) => setAcceptedNda(e.target.checked)} />}
                    label="Jeg har lest og godtar NDA-en"
                  />

                  <TextField
                    fullWidth
                    label="Fullt navn (slik det står på legitimasjon)"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    sx={{ mt: 2 }}
                    required
                    helperText="Din elektroniske signatur"
                  />

                  {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button onClick={() => setActiveStep(0)} disabled={submitting}>Tilbake</Button>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleAccept}
                      disabled={submitting || !acceptedNda || !signerName.trim()}
                    >
                      {submitting ? 'Signerer…' : 'Signer og aktiver tester-tilgang'}
                    </Button>
                  </Stack>
                </Box>
              )}
            </Step>
          </Stepper>

          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ color: 'text.secondary' }}>
            <MailIcon fontSize="small" />
            <Typography variant="caption">
              Du har {new Date(invite.expiresAt).getTime() > Date.now() ? Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / (24 * 3600 * 1000)) : 0} dager igjen før invitasjonen utløper.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
};

export default AcceptPrototypeTesterInvite;
