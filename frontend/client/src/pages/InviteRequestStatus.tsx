// @ts-nocheck
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  Alert,
  CircularProgress,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Assignment,
  Visibility,
  Email,
  PersonAdd,
  HowToReg,
  CheckCircle,
  Verified,
  Search,
  ArrowBack,
} from '@mui/icons-material';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

// Custom styled connector for journey stepper
const JourneyConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 22,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: 'linear-gradient(95deg, #ff6b35 0%, #ff8c00 100%)',
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: 'linear-gradient(95deg, #4caf50 0%, #66bb6a 100%)',
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#eaeaf0',
    borderRadius: 1,
  },
}));

type UserJourneyStatus = 'request_submitted' | 'under_review' | 'invite_sent' | 'account_created' | 'onboarding_started' | 'onboarding_completed' | 'active';

interface InviteStatusResponse {
  found: boolean;
  businessName: string;
  status: string;
  userJourneyStatus: UserJourneyStatus;
  createdAt: string;
  inviteSentAt?: string;
  planName?: string;
}

const journeySteps = [
  { key: 'request_submitted', label: 'Søknad sendt', icon: <Assignment /> },
  { key: 'under_review', label: 'Under vurdering', icon: <Visibility /> },
  { key: 'invite_sent', label: 'Invitasjon sendt', icon: <Email /> },
  { key: 'account_created', label: 'Konto opprettet', icon: <PersonAdd /> },
  { key: 'onboarding_started', label: 'Onboarding startet', icon: <HowToReg /> },
  { key: 'onboarding_completed', label: 'Onboarding fullført', icon: <CheckCircle /> },
  { key: 'active', label: 'Aktiv bruker', icon: <Verified /> },
];

const getJourneyStepIndex = (status?: UserJourneyStatus): number => {
  if (!status) return 0;
  const index = journeySteps.findIndex(s => s.key === status);
  return index >= 0 ? index : 0;
};

export default function InviteRequestStatus() {
  const [email, setEmail] = useState('');
  const [searchEmail, setSearchEmail] = useState('');

  const { data, isLoading, error, refetch } = useQuery<InviteStatusResponse>({
    queryKey: ['invite-status', searchEmail],
    queryFn: async () => {
      if (!searchEmail) return null;
      const response = await apiRequest('GET', `/api/invites/status?email=${encodeURIComponent(searchEmail)}`);
      return response.json();
    },
    enabled: !!searchEmail,
    retry: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSearchEmail(email.trim());
    }
  };

  const getStatusMessage = (status: UserJourneyStatus): string => {
    switch (status) {
      case 'request_submitted':
        return 'Din søknad er mottatt og venter på behandling. Vi vil gjennomgå den så snart som mulig.';
      case 'under_review':
        return 'Din søknad er under vurdering. Vi tar kontakt med deg snart.';
      case 'invite_sent':
        return 'Vi har sendt deg en invitasjon på e-post! Sjekk innboksen din (og spam-mappen).';
      case 'account_created':
        return 'Kontoen din er opprettet! Du kan nå logge inn og starte onboarding.';
      case 'onboarding_started':
        return 'Du har startet onboarding-prosessen. Fullfør den for å få tilgang til alle funksjoner.';
      case 'onboarding_completed':
        return 'Gratulerer! Du har fullført onboarding. Velkommen til CreatorHub!';
      case 'active':
        return 'Du er en aktiv bruker av CreatorHub. Logg inn for å fortsette.';
      default:
        return 'Status ukjent. Ta kontakt med support hvis du har spørsmål.';
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)', py: 4 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Link href="/">
            <Button startIcon={<ArrowBack />} sx={{ color: 'white', mb: 2 }}>
              Tilbake til forsiden
            </Button>
          </Link>
          <Typography variant="h3" sx={{ 
            background: 'linear-gradient(135deg, #FF8A00 0%, #E52E71 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 'bold',
            mb: 1,
          }}>
            Sjekk søknadsstatus
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Skriv inn e-postadressen du brukte i søknaden for å se statusen
          </Typography>
        </Box>

        {/* Search Form */}
        <Paper sx={{ p: 3, mb: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <form onSubmit={handleSearch}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                label="E-postadresse"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@epost.no"
                required
                sx={{ '& .MuiOutlinedInput-root': { backgroundColor: 'rgba(255,255,255,0.05)' } }}
              />
              <Button type="submit" variant="contained" size="large" startIcon={<Search />}
                sx={{ minWidth: 120, height: 56, background: 'linear-gradient(135deg, #FF8A00 0%, #E52E71 100%)' }}
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Søk'}
              </Button>
            </Box>
          </form>
        </Paper>

        {/* Error State */}
        {error && searchEmail && (
          <Alert severity="warning" sx={{ mb: 4 }}>
            Vi fant ingen søknad med denne e-postadressen. Sjekk at du har skrevet riktig, eller{', '}
            <Link href="/request-access">send inn en ny søknad</Link>.
          </Alert>
        )}

        {/* Results */}
        {data && data.found && (
          <Paper sx={{ p: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}>
            {/* Business Info */}
            <Box sx={{ mb: 4, textAlign: 'center' }}>
              <Typography variant="h5" sx={{ color: 'white', mb: 1 }}>
                {data.businessName}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                Søknad sendt: {new Date(data.createdAt).toLocaleDateString('nb-NO', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}
              </Typography>
              {data.planName && (
                <Chip label={data.planName} color="primary" size="small" sx={{ mt: 1 }} />
              )}
            </Box>

            {/* Journey Stepper */}
            <Box sx={{ mb: 4 }}>
              <Stepper
                activeStep={getJourneyStepIndex(data.userJourneyStatus)}
                alternativeLabel
                connector={<JourneyConnector />}
              >
                {journeySteps.map((step, index) => (
                  <Step key={step.key} completed={index < getJourneyStepIndex(data.userJourneyStatus)}>
                    <StepLabel
                      StepIconComponent={() => (
                        <Box sx={{
                          width: 40, height: 40, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: index <= getJourneyStepIndex(data.userJourneyStatus)
                            ? (index < getJourneyStepIndex(data.userJourneyStatus) ? '#4caf50' : '#ff6b35')
                            : 'rgba(255,255,255,0.1)',
                          color: index <= getJourneyStepIndex(data.userJourneyStatus) ? 'white' : 'rgba(255,255,255,0.3)'
                        }}>
                          {step.icon}
                        </Box>
                      )}
                    >
                      <Typography variant="caption" sx={{
                        color: index <= getJourneyStepIndex(data.userJourneyStatus) ? 'white': 'rgba(255,255,255,0.3)'
                      }}>
                        {step.label}
                      </Typography>
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>

            {/* Status Message */}
            <Card sx={{ backgroundColor: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)' }}>
              <CardContent>
                <Typography variant="body1" sx={{ color: 'white', textAlign: 'center' }}>
                  {getStatusMessage(data.userJourneyStatus)}
                </Typography>
              </CardContent>
            </Card>

            {/* Invite Sent Info */}
            {data.inviteSentAt && (
              <Alert severity="success" sx={{ mt: 3 }}>
                Invitasjon sendt: {new Date(data.inviteSentAt).toLocaleDateString('nb-NO', {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </Alert>
            )}
          </Paper>
        )}

        {/* Help Section */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            Har du spørsmål? Kontakt oss på{''}
            <a href="mailto:support@creatorhub.no" style={{ color: '#ff6b35' }}>
              support@creatorhub.no
            </a>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

