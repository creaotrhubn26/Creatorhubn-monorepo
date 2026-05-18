// @ts-nocheck
/**
 * wedding-assistant-invite.tsx — Slice 9X.44 + 9X.46 + 9X.50
 *
 * Public-side hvor inviterte assistenter:
 *   1. Ser oppdragsdetaljene (bryllup, dato, rolle, honorar)
 *   2. Leser GDPR-info og samtykker
 *   3. Leser sub-kontrakt og signerer med fullt navn
 *   4. Godtar oppdraget → status='accepted', tilgang til wedding-day-side
 *
 * Avslag-flow uten kontrakt: bare tap "Avslå"-knapp.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  Container,
  Card,
  CardContent,
  Stack,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Checkbox,
  FormControlLabel,
  TextField,
  Paper,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  CalendarMonth as DateIcon,
  Person as PersonIcon,
  Work as RoleIcon,
  AttachMoney as MoneyIcon,
  Gavel as ContractIcon,
  PrivacyTip as GdprIcon,
  AutoAwesome as SparkleIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { trackEvent } from '@/utils/ga4-client-tracking';

interface Invite {
  id: string;
  weddingId: string;
  assistantName: string | null;
  assistantEmail: string | null;
  role: string;
  compensationType: 'hourly' | 'fixed' | 'percentage';
  compensationValue: number | null;
  sharePct: number | null;
  status: string;
  invitedAt: string;
  coupleName: string;
  weddingDate: string;
  primaryPhotographer: string;
  referralInviteSent?: boolean;
}

interface GdprInfo {
  whatWeStore: string[];
  whyWeStore: string[];
  retention: string[];
  yourRights: string[];
}

const ROLE_LABELS: Record<string, string> = {
  primary: 'Hovedfotograf',
  assistant: 'Assistent',
  second_shooter: 'Second shooter',
  video: 'Video',
  misc: 'Annet',
};

const compensationLabel = (i: Invite): string => {
  if (i.compensationType === 'percentage') return `${i.sharePct ?? '?'}% av netto-honorar`;
  if (i.compensationType === 'hourly') return `${i.compensationValue ?? '?'} kr/t`;
  return `${i.compensationValue ?? '?'} kr (fast)`;
};

const WeddingAssistantInvite: React.FC = () => {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [, navigate] = useLocation();

  const [invite, setInvite] = useState<Invite | null>(null);
  const [gdprInfo, setGdprInfo] = useState<GdprInfo | null>(null);
  const [contractText, setContractText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stepper-state
  const [activeStep, setActiveStep] = useState(0);
  const [gdprConsented, setGdprConsented] = useState(false);
  const [contractRead, setContractRead] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerIdLast4, setSignerIdLast4] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest(`/api/wedding/assistant-invite/${token}`),
      apiRequest(`/api/wedding/assistant-invite/${token}/gdpr-info`).catch(() => null),
      apiRequest(`/api/wedding/assistant-invite/${token}/contract`).catch(() => null),
    ])
      .then(([i, g, c]: any[]) => {
        setInvite(i.invite);
        setGdprInfo(g);
        setContractText(c?.contractText || null);
        if (i.invite?.assistantName) setSignerName(i.invite.assistantName);
      })
      .catch((e: any) => setError(e?.message || 'Invitasjon ikke funnet'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!signerName.trim()) { setError('Skriv inn ditt fulle navn'); return; }
    setSubmitting(true);
    setError(null);
    try {
      // 1. Registrer GDPR-samtykke
      await apiRequest(`/api/wedding/assistant-invite/${token}/consent`, { method: 'POST' }).catch(() => undefined);
      // 2. Signer kontrakt (setter også status='accepted')
      await apiRequest(`/api/wedding/assistant-invite/${token}/sign`, {
        method: 'POST',
        body: {
          signerName: signerName.trim(),
          signerIdLast4: signerIdLast4.trim() || undefined,
        },
      });
      trackEvent('assistant_invite_accepted', {
        role: invite?.role,
        referral_offered: !!invite?.referralInviteSent,
      });
      if (invite?.referralInviteSent) {
        trackEvent('assistant_referral_cta_shown', {
          source: 'assistant_accept_success',
        });
      }
      setResult('accepted');
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke godta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!window.confirm('Er du sikker på at du vil avslå?')) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/wedding/assistant-invite/${token}/decline`, { method: 'POST' });
      setResult('declined');
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke avslå');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Container sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Container>;
  if (error || !invite) {
    return <Container maxWidth="sm" sx={{ py: 4 }}><Alert severity="error">{error || 'Invitasjonen finnes ikke eller er allerede behandlet.'}</Alert></Container>;
  }

  if (result === 'accepted') {
    const handleReferralClick = () => {
      trackEvent('assistant_referral_clicked', {
        source: 'assistant_accept_success',
        primary_photographer: invite.primaryPhotographer,
      });
      // Server-side click-tracking (best effort)
      apiRequest(`/api/wedding/assistant-invite/${token}/referral-clicked`, { method: 'POST' }).catch(() => undefined);
      // Åpne login/signup-siden med referral-context
      const ref = encodeURIComponent(token || '');
      window.location.href = `/login?ref=assistant&source=${ref}&utm_source=assistant_invite&utm_medium=referral&utm_campaign=stine_invited_me`;
    };

    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>Takk!</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Du har akseptert oppdraget for <b>{invite.coupleName}</b> ({new Date(invite.weddingDate).toLocaleDateString('nb-NO')}).
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {invite.primaryPhotographer} er varslet. Du vil få:
            </Typography>
            <List dense>
              <ListItem><ListItemText primary="Tilgang til delt Drive-mappe (separat e-post fra Google)" /></ListItem>
              <ListItem><ListItemText primary="Kalender-invitasjon til brief-møte hvis det blir booket" /></ListItem>
              <ListItem><ListItemText primary="Lenke til wedding-day-side når du logger inn" /></ListItem>
            </List>

            {invite.referralInviteSent && (
              <Paper variant="outlined" sx={{ p: 2, mt: 3, bgcolor: 'primary.light', borderColor: 'primary.main' }}>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                  <SparkleIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2">
                    {invite.primaryPhotographer} bruker Creatorhubn
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  Verktøyet som ga deg denne sub-kontrakten, AI-brief og delt Drive-mappe — det kan du selv bruke
                  på dine bryllup. Prøv gratis i 30 dager, ingen kort.
                </Typography>
                <Button variant="contained" size="small" onClick={handleReferralClick}>
                  Prøv Creatorhubn gratis
                </Button>
              </Paper>
            )}

            <Button variant="text" fullWidth sx={{ mt: 2 }} onClick={() => navigate('/')}>
              Ferdig
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  if (result === 'declined') {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Card><CardContent>
          <Typography variant="h6">Avslått.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Fotografen er varslet. Du kan lukke denne siden.
          </Typography>
        </CardContent></Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card>
        <CardContent>
          <Typography variant="overline" color="primary">Invitasjon til foto-oppdrag</Typography>
          <Typography variant="h5" sx={{ mb: 2 }}>
            {invite.primaryPhotographer} vil ha deg med på bryllup
          </Typography>

          {/* Oversikt */}
          <Stack spacing={1.5} sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <PersonIcon fontSize="small" color="action" />
              <Typography variant="body1"><b>{invite.coupleName}</b></Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <DateIcon fontSize="small" color="action" />
              <Typography variant="body1">
                {invite.weddingDate ? new Date(invite.weddingDate).toLocaleDateString('nb-NO', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                }) : 'Dato ikke satt'}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <RoleIcon fontSize="small" color="action" />
              <Typography variant="body1">Rolle: <b>{ROLE_LABELS[invite.role] || invite.role}</b></Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <MoneyIcon fontSize="small" color="action" />
              <Typography variant="body1">Honorar: <b>{compensationLabel(invite)}</b></Typography>
            </Stack>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <Stepper activeStep={activeStep} orientation="vertical">
            {/* Steg 1: GDPR */}
            <Step>
              <StepLabel icon={<GdprIcon color={activeStep >= 0 ? 'primary' : 'disabled'} />}>
                Personvern (GDPR)
              </StepLabel>
              <StepContent>
                {gdprInfo && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mt: 1 }}>Hva vi lagrer om deg</Typography>
                    <List dense>
                      {gdprInfo.whatWeStore.map((s, i) => <ListItem key={i} sx={{ py: 0.25 }}>• {s}</ListItem>)}
                    </List>
                    <Typography variant="subtitle2">Hvorfor</Typography>
                    <List dense>
                      {gdprInfo.whyWeStore.map((s, i) => <ListItem key={i} sx={{ py: 0.25 }}>• {s}</ListItem>)}
                    </List>
                    <Typography variant="subtitle2">Oppbevaring</Typography>
                    <List dense>
                      {gdprInfo.retention.map((s, i) => <ListItem key={i} sx={{ py: 0.25 }}>• {s}</ListItem>)}
                    </List>
                    <Typography variant="subtitle2">Dine rettigheter</Typography>
                    <List dense>
                      {gdprInfo.yourRights.map((s, i) => <ListItem key={i} sx={{ py: 0.25 }}>• {s}</ListItem>)}
                    </List>
                  </Box>
                )}
                <FormControlLabel
                  control={<Checkbox checked={gdprConsented} onChange={(e) => setGdprConsented(e.target.checked)} />}
                  label="Jeg samtykker til at mine data lagres og behandles som beskrevet ovenfor."
                />
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    disabled={!gdprConsented}
                    onClick={() => setActiveStep(1)}
                  >
                    Fortsett til kontrakt
                  </Button>
                </Box>
              </StepContent>
            </Step>

            {/* Steg 2: Sub-kontrakt */}
            <Step>
              <StepLabel icon={<ContractIcon color={activeStep >= 1 ? 'primary' : 'disabled'} />}>
                Sub-kontrakt
              </StepLabel>
              <StepContent>
                <Paper variant="outlined" sx={{ p: 2, mb: 2, maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
                  {contractText || 'Henter kontraktstekst…'}
                </Paper>
                <FormControlLabel
                  control={<Checkbox checked={contractRead} onChange={(e) => setContractRead(e.target.checked)} />}
                  label="Jeg har lest og godtar vilkårene i sub-kontrakten."
                />
                <Box sx={{ mt: 2 }}>
                  <Button onClick={() => setActiveStep(0)}>Tilbake</Button>
                  <Button
                    variant="contained"
                    disabled={!contractRead}
                    onClick={() => setActiveStep(2)}
                    sx={{ ml: 1 }}
                  >
                    Fortsett til signering
                  </Button>
                </Box>
              </StepContent>
            </Step>

            {/* Steg 3: Signering */}
            <Step>
              <StepLabel icon={<ContractIcon color={activeStep >= 2 ? 'primary' : 'disabled'} />}>
                Signer elektronisk
              </StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Signaturen din lagres med tidspunkt og IP-adresse som juridisk dokumentasjon på samtykke.
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Fullt navn (slik det står på legitimasjon)"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    fullWidth
                    required
                  />
                  <TextField
                    label="Siste 4 sifre av fødselsnummer (valgfritt)"
                    value={signerIdLast4}
                    onChange={(e) => setSignerIdLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    helperText="Frivillig — hjelper identifikasjon ved tvist. Lagres ikke kryptert."
                    inputProps={{ maxLength: 4, pattern: '\\d{4}' }}
                    sx={{ maxWidth: 300 }}
                  />
                </Stack>
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                <Box sx={{ mt: 2 }}>
                  <Button onClick={() => setActiveStep(1)}>Tilbake</Button>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleAccept}
                    disabled={submitting || !signerName.trim()}
                    sx={{ ml: 1 }}
                  >
                    {submitting ? 'Signerer…' : 'Signer og godta oppdrag'}
                  </Button>
                </Box>
              </StepContent>
            </Step>
          </Stepper>

          <Divider sx={{ my: 3 }} />
          <Stack direction="row" justifyContent="center">
            <Button color="error" onClick={handleDecline} disabled={submitting}>
              Avslå hele invitasjonen
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
};

export default WeddingAssistantInvite;
