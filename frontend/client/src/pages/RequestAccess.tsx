import { useTheming } from '../utils/theming-helper';
import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
} from '@mui/material';
import { PhotographyIconAlt } from '../components/shared/CreatorHubIcons';
import {
  VideoCall as VideocamCall,
  LibraryMusic as LibraryMusicNote,
  Store,
  Security,
  Business as DirectionsBusiness,
  CheckCircle,
  PhotoCamera,
  VideoCall,
} from '@mui/icons-material';
const InviteRequestForm = React.lazy(() => import('@/components/InviteRequestForm'));

export default function RequestAccess() {
  const features = [
    {
      icon: <PhotoCamera sx={{ fontSize: 40, color: '#FF8A00',}} />,
      title: 'Profesjonell fotografering',
      description: 'Avanserte verktøy for fotoredigering, prosjektstyring og klientgallerier',
  },
    {
      icon: <VideoCall sx={{ fontSize: 40, color: '#E52E71',}} />,
      title: 'Video-produksjon',
      description: 'Intelligent video-editor med automatisk highlight-generering og samarbeid',
  },
    {
      icon: <LibraryMusic sx={{ fontSize: 40, color: '#FF8A00',}} />,
      title: 'Musikkproduksjon',
      description: 'Plugin-administrasjon, lisensstyring og integrasjon med DAW-systemer',
  },
    {
      icon: <Store sx={{ fontSize: 40, color: '#E52E71',}} />,
      title: 'Partner-nettverk',
      description: 'Tilgang til profesjonelt nettverk av leverandører og samarbeidspartnere',
  },
  ];

  const securityFeatures = [
    'GDPR-kompatibel databehandling', 'Automatisk backup til Google Drive','Sikker filhåndtering og lagring','Norske servere og personvern'
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
        py:  4,
    }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Box textAlign="center" sx={{ mb:  6 }}>
          <Typography variant="h2"
            gutterBottom
            sx={{ 
              background: 'linear-gradient(135deg, #FF8A00 0%, #E52E71 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 'bold',
              mb: 2,
              color: theming.colors.primary,
            }}>
            CreatorHub Norge
          </Typography>
          <Typography variant="h5"
            sx={{
              color: theming.colors.primary,
              mb: 2,
              fontWeight: 300,
            }}>
            Norges mest avanserte plattform for kreative fagpersoner
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'grey.400',
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            Tilgang krever godkjenning og registrert norsk bedrift. Fyll ut forespørselen under for
            å få tilgang til plattformen.
          </Typography>
        </Box>

        {/* Features Grid */}
        <Grid container spacing={3} sx={{ mb: 6 }}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card
                sx={{
                  ...theming.getThemedCardSx(),
                  height: '100%',
                  background: 'rgba(25, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(25, 255, 255, 0.1)',
                  transition: 'transform 0.2s ease-in-out', '&:hover': {
                    transform: 'translateY(-5px)',
                    background: 'rgba(25, 255, 255, 0.08)',
                  },
                }}
              >
                <CardContent sx={{ ...theming.getThemedCardSx(), textAlign: 'center', p: 3 }}>
                  <IconButton
                    sx={{
                      mb: 2,
                      background: 'rgba(25, 255, 255, 0.1)','&:hover': { background: 'rgba(25, 255, 255, 0.2)' },
                    }}
                  >
                    {feature.icon}
                  </IconButton>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, fontWeight: 600}}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'grey.300' }}>
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Security & Business Features */}
        <Box sx={{ mb: 6 }}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Card
                sx={{
                  ...theming.getThemedCardSx(),
                  background: 'rgba(25, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(25, 255, 255, 0.1)',
                  p: 3,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Security sx={{ fontSize: 30, color: '#FF8A00', mr: 2 }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                    Sikkerhet & Personvern
                  </Typography>
                </Box>
                {securityFeatures.map((feature, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CheckCircle sx={{ fontSize: 20, color: '#4CAF50', mr: 2 }} />
                    <Typography variant="body2" sx={{ color: 'grey.300' }}>
                      {feature}
                    </Typography>
                  </Box>
                ))}
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card
                sx={{
                  ...theming.getThemedCardSx(),
                  background: 'rgba(25, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(25, 255, 255, 0.1)',
                  p: 3,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Business sx={{ fontSize: 30, color: '#E52E70', mr: 2 }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                    Norsk Bedriftsfokus
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'grey.300', mb: 2 }}>
                  Plattformen er skreddersydd for norske kreative bedrifter med:
                </Typography>
                {[
                    'Integrering med Brønnøysundregistrene', 'NOK-valuta og norsk MVA-håndtering', 'TONO/GRAMO-integrasjon for musikk', 'Norske kontraktstemplater',
                ].map((feature, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CheckCircle sx={{ fontSize: 20, color: '#4CAF50', mr: 2 }} />
                    <Typography variant="body2" sx={{ color: 'grey.300' }}>
                      {feature}
                    </Typography>
                  </Box>
                ))}
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Request Form */}
        <InviteRequestForm />

        {/* Footer Note */}
        <Box sx={{ textAlign: 'center', mt: 6 }}>
          <Typography variant="body2" sx={{ color: 'grey.500' }}>
            CreatorHub Norge • Profesjonell plattform for kreative • Bedriftstilgang påkreves •
            Godkjenning innen 24-48 timer
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
