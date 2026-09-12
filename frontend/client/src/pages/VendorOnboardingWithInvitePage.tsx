// @ts-nocheck
import { useTheming } from '../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
} from '@mui/material';
import GpsFixed from '@mui/icons-material/GpsFixed';
import { VerifiedPerson, CorporateIcon, Warning } from '../shared/CreatorHubIcons';
import UniversalVendorOnboarding from '@/components/vendor/UniversalVendorOnboarding';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const VendorOnboardingWithInvitePage: React.FC = () => {
  const [inviteRequestd, setInviteRequestId] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [inviteCode] = useState('invite-123456789');
  const [startOnboarding, setStartOnboarding] = useState(false);

  // Fetch invite request details
  const { data: inviteRequest, isLoading } = useQuery({
    queryKey: ['/api/landing-mobile/invite-request', inviteRequestId],
    queryFn: () => apiRequest(`/api/landing-mobile/invite-request/${inviteRequestd}`),
    enabled: !!inviteRequestId && !startOnboarding,
});

  const handleOnboardingComplete = (data: any) => {
    console.log('✅ Onboarding with invite completed, :', data);
    setStartOnboarding(false);
};

  if (startOnboarding && inviteRequest) {
    return (
      <UniversalVendorOnboarding
        vendorType={inviteRequest.inviteRequest.vendorType}
        vendorName={inviteRequest.inviteRequest.companyName}
        userId="test-user-with-invite"
        inviteRequestId={inviteRequestId}
        onComplete={handleOnboardingComplete}
      />
    );
}

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Paper
        sx={{
          p:  3,
          mb:  3,
          background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
          color: 'white',
      }}
       sx={theming.getThemedCardSx()}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
          <GpsFixed sx={{ fontSize: 36 }} />
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            Vendor Onboarding med Landing-Mobile Integrasjon
          </Typography>
        </Stack>
        <Typography variant="h6" sx={{ opacity: 0.7, mb: 2, color: theming.colors.primary }}>
          Test vendor onboarding med organisasjonsnummer validering og logo upload
        </Typography>

        <Alert
          severity="info"
          sx={{
            mt: 2,
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            '& .MuiAlert-icon': { color: 'white' },
        }}
        >
          <Typography variant="body2">
            Inkluderer BRREG validering, invite request matching og bedriftslogo upload
          </Typography>
        </Alert>
      </Paper>

      {/* Invite Request Configuration */}
      <Paper sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h5" sx={{  mb:  3, fontWeight: 600}}>
          Landing-Mobile Invite Request Setup
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Invite Request ID"
              value={inviteRequestId}
              onChange={(e) => setInviteRequestId(e.target.value)}
              helperText="ID fra landing-mobile invite request"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Button
              variant="outlined"
              onClick={() =>
                setInviteRequestId('invite-' + Math.random().toString(36).substr(2, 9))
            }
              sx={{ mt:  1 }}
            >
              Generer Test ID
            </Button>
          </Grid>
        </Grid>

        {/* Invite Request Details */}
        {isLoading && (
          <Alert severity="info" sx={{ mt:  3 }}>
            Henter invite request detaljer...
          </Alert>
        )}

        {inviteRequest && (
          <Card sx={{ mt:  3, border: '2px solid #4caf50',  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6"
                sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                <VerifiedUser color="success" />
                Invite Request Detaljer
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" sx={{ color: 'text.secondary',}}>
                    Organisasjonsnummer
                  </Typography>
                  <Typography variant="h6" sx={{  fontWeight: 600}}>
                    {inviteRequest.inviteRequest.organizationNumber}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="body2" sx={{ color: 'text.secondary',}}>
                    Firmanavn
                  </Typography>
                  <Typography variant="h6" sx={{  fontWeight: 600}}>
                    {inviteRequest.inviteRequest.companyName}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="body2" sx={{ color: 'text.secondary',}}>
                    Vendor Type
                  </Typography>
                  <Chip
                    label={inviteRequest.inviteRequest.vendorType}
                    color="primary"
                    sx={{ fontWeight: 600 }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="body2" sx={{ color: 'text.secondary',}}>
                    Status
                  </Typography>
                  <Chip
                    label={inviteRequest.inviteRequest.status}
                    color={
                      inviteRequest.inviteRequest.status === 'approved' ? 'success' : 'warning'
                    }
                    sx={{ fontWeight: 600 }}
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Button variant="contained"
                  size="large"
                  onClick={() => setStartOnboarding(true)}
                  sx={{
                    bgcolor: '#4caf50', '&:hover': { bgcolor: '#2e7d32' },
                    px: 4,
                    py: 1.5,
                    ...theming.getThemedButtonSx()
                }}
                >
                  Start Onboarding med Invite Request
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {!inviteRequest && !isLoading && inviteRequestId && (
          <Alert severity="error" sx={{ mt:  3 }}>
            <Typography variant="body2">
              Kunne ikke finne invite request med ID: {inviteRequestd}
            </Typography>
          </Alert>
        )}
      </Paper>

      {/* Features Overview */}
      <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" sx={{  mb:  3, fontWeight: 600}}>
          Landing-Mobile Integrasjon Features
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  🔍 Organisasjonsnummer Validering
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb:  2 }}>
                  Automatisk validering mot Brønnøysundregistrene: </Typography>
                <Box component="ul" sx={{ pl: 2, m:  0 }}>
                  <li>Sjekk mot BRREG API for gyldighet</li>
                  <li>Hent bedriftsnavn automatisk</li>
                  <li>Verifiser at bedrift er aktiv</li>
                  <li>Sammenlign med invite request data</li>
                  <li>Validér at org.nr. stemmer overens</li>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  📸 Logo Upload & Validering
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb:  2 }}>
                  Bedriftslogo håndtering med validering: </Typography>
                <Box component="ul" sx={{ pl: 2, m:  0 }}>
                  <li>Støtte for JPEG, PNG, GIF, WebP</li>
                  <li>Maksimal filstørrelse: 5MB</li>
                  <li>Live preview av logo</li>
                  <li>Automatisk Base64 encoding</li>
                  <li>Sikker upload til cloud storage</li>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
};

export default VendorOnboardingWithInvitePage;
