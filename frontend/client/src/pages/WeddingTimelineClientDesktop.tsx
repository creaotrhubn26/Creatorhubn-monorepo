import { useTheming } from '../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Card,
  CardContent,
  Container,
  LinearProgress,
  Grid,
  Paper,
  Stack,
  Fade,
  useTheme,
} from '@mui/material';
import { RingIcon } from '../components/shared/CreatorHubIcons';
import { AccessTime, Event, Search, Schedule, CalendarToday as CalendarTodayToday } from '@mui/icons-material';
import { useLocation, useRoute } from 'wouter';
import WeddingTimelineClient from '@/components/wedding/WeddingTimelineClient';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useClientSession } from '@/hooks/useClientSession';

// Desktop-optimized Access Code Input Component
function DesktopAccessCodeInput({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [accessCode, setAccessCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const theme = useTheme();
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) {
      setError('Tilgangskode/passord er påkrevd');
      return;
  }

    setIsValidating(true);
    setError('');

    try {
      const response = await apiRequest(
        `/api/wedding/timeline/access/${accessCode.trim().toUpperCase()}`,
      );
      onSubmit(accessCode.trim().toUpperCase());
  } catch (error: any) {
      if (error.message.includes('404')) {
        setError('Ugyldig tilgangskode/passord - prøv igjen');
  } else if (error.message.includes('403')) {
        setError(
          'Fotografen/videografen har ikke aktivert tilgang til tidslinjen ennå - prøv igjen senere',
        );
    } else {
        setError('Feil ved tilgang til tidslinje - prøv igjen senere');
    }
  } finally {
      setIsValidating(false);
  }
};

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `
        linear-gradient(135deg, #fff5f5 0%, #ffe0cc 25%, #ffcc80 50%, #ffb74d 75%, #f57c00 100%),
        radial-gradient(circle at 20% 80%, rgba(2, 4, 5,124,0,0.2) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(2, 5, 5,204,128,0.3) 0%, transparent 50%)
      `,
        position: 'relative', '&::before': {
          content: '',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(2, 4, 5,124,0,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
      },
    }}
    >
      <Container maxWidth="lg" sx={{ py: 8, position: 'relative', zIndex: 1,  }}>
        <Grid
          container
          spacing={6}
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: '80vh' }}
        >
          {/* Left Side - Hero Content */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Fade in timeout={800}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Favorite
                    sx={{
                      fontSize: '4rem',
                      color: '#f57c00',
                      mr: 2,
                      filter: 'drop-shadow(0 4px 12px rgba(25, 1240.3))',
                  }}
                  />
                  <Box>
                    <Typography variant="h2"
                      sx={{
                        color: '#e65100',
                        fontWeight: 800,
                        mb: 0.5,
                        lineHeight: 1.2,
                    }}
                    >
                      Bryllupstidslinje
                    </Typography>
                    <Typography variant="h6"
                      sx={{
                        color: '#f57c00',
                        fontWeight: 500,
                    }}
                    >
                      Din store dag - i sanntid
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="h5"
                  sx={{
                    mb: 4,
                    lineHeight: 1.4,
                    fontWeight: 400,
                    color: theming.colors.primary
                  }}>
                  Følg med på hver magiske øyeblikk av bryllupsdagen din med vår interaktive
                  tidslinje
                </Typography>

                {/* Features List */}
                <Stack spacing={2} sx={{ mb:  4 }}>
                  {[
                    {
                      icon: theming.getThemedIcon(''),
                      text: 'Sanntidsoppdateringer fra fotografen/videografen',
                  },
                    {
                      icon: theming.getThemedIcon(', '),
                      text: 'Komplett oversikt over dagen',
                  },
                    {
                      icon: <Event />,
                      text: 'Interaktive milepæler og momenter',
                  },
                  ].map((feature, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'center',}}>
                      <Box
                        sx={{
                          mr: 2,
                          color: '#f57c00',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width:  40,
                          height:  40,
                          borderRadius: '50, %',
                          bgcolor: 'rgba(25, 1240.1)',
                          border: '2px solid rgba(25, 1240.2)',
                      }}
                      >
                        {feature.icon}
                      </Box>
                      <Typography
                        variant="body1"
                        sx={{
                          color: '#424240',
                          fontSize: '1.1rem',
                      }}
                      >
                        {feature.text}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Fade>
          </Grid>

          {/* Right Side - Access Form */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Fade in timeout={1200}>
              <Paper
                elevation={0}
                sx={{
                  borderRadius: '24px',
                  background: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(25, 1240.2)',
                  boxShadow: '0 20px 60px rgba(25, 1240.15)',
                  p:  6,
                  maxWidth: 500,
                  mx: 'auto',
              }}
              >
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Typography variant="h4"
                    sx={{
                      fontWeight: 700,
                      mb: 2,
                      color: theming.colors.primary
                    }}>
                    Velkommen
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '1.1rem',
                      lineHeight: 1.5,
                  }}
                  >
                    Skriv inn tilgangskoden/passord du har fått fra fotografen/videografen for å se
                    bryllupstidslinjen
                  </Typography>
                </Box>

                <form onSubmit={handleSubmit}>
                  <Stack spacing={4}>
                    <Box>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          color: '#e65100',
                          fontWeight: 600,
                          mb:  2,
                      }}
                      >
                        Tilgangskode/Passord
                      </Typography>
                      <TextField
                        fullWidth
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        variant="outlined"
                        placeholder="F.eks: ABC123XYZ"
                        disabled={isValidating}
                        inputProps={{
                          style: {
                            textAlign: 'center',
                            fontSize: '1.3rem',
                            letterSpacing: '2px',
                            fontWeight: 600,
                        },
                      }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '16px',
                            height: '60px',
                            bgcolor: '#fafafa','&:hover': {
                              bgcolor: '#f5f5f0',
                          }, '&:hover fieldset': {
                              borderColor: '#f57c00',
                              borderWidth: '2px',
                          }, '&.Mui-focused fieldset': {
                              borderColor: '#f57c00',
                              borderWidth: '2px',
                          }, '&.Mui-focused': {
                              bgcolor: '#fff',
                          },
                        },
                      }}
                      />
                    </Box>

                    {error && (
                      <Alert
                        severity="error"
                        sx={{
                          borderRadius: '12px',
                          fontSize: '1rem',
                      }}
                      >
                        {error}
                      </Alert>
                    )}

                    <Button type="submit"
                      fullWidth
                      variant="contained"
                      size="large"
                      disabled={isValidating || !accessCode.trim()}
                      startIcon={isValidating ? theming.getThemedIcon('accessTime') : theming.getThemedIcon('search')}
                      sx={{
                        py: 2.5,
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        borderRadius: '16px',
                        bgcolor: '#f57c00',
                        boxShadow: '0 8px 24px rgba(25, 1240.3)',
                        textTransform: 'none','&:hover': {
                          bgcolor: '#ef6c00',
                          boxShadow: '0 12px 32px rgba(255, 152, 0, 0.4)',
                          transform: 'translateY(-2px)'
                        },
                        '&:disabled': {
                          bgcolor: '#ffcc80',
                          color: 'rgba(0, 0, 0, 0.6)'
                        },
                        transition: 'all 0.3s ease',
                    }}>
                      {isValidating ? 'Sjekker tilgang...' : 'Åpne bryllupstidslinje'}
                    </Button>

                    <Box sx={{ textAlign: 'center',}}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '1rem',
                          lineHeight: 1.5,
                      }}
                      >
                        Har du ikke mottatt tilgangskode?{', '}
                        <Typography
                          component="span"
                          sx={{
                            color: '#f57c00',
                            fontWeight: 600,
                        }}
                        >
                          Ta kontakt med fotografen/videografen din.
                        </Typography>
                      </Typography>
                    </Box>
                  </Stack>
                </form>
              </Paper>
            </Fade>
          </Grid>
        </Grid>

        {/* Desktop Progress Indicator */}
        {isValidating && (
          <Box
            sx={{
              position: 'fixed',
              bottom:  40,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 400,
              zIndex: 100,
          }}
          >
            <Paper
              sx={{
                p:  2,
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)',
            }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                <AccessTime sx={{ color: '#f57c00', mr:  1 }} />
                <Typography variant="body2" color="primary">
                  Validerer tilgangskode...
                </Typography>
              </Box>
              <LinearProgress
                sx={{
                  borderRadius: '4px',
                  bgcolor: 'rgba(25, 1240.1)', '& .MuiLinearProgress-bar': {
                    bgcolor: '#f57c00',
                },
              }}
              />
            </Paper>
          </Box>
        )}
      </Container>
    </Box>
  );
}

// Main Desktop Wedding Timeline Client Component
export default function WeddingTimelineClientDesktop() {
  const [location] = useLocation();
  const [, params] = useRoute('/wedding-timeline/:timelineId/:accessCode');
  const [, simpleParams] = useRoute('/wedding-timeline/:accessCode');
  const { clientSession, isLoading: sessionLoading } = useClientSession();

  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [timelineId, setTimelineId] = useState<string | null>(null);

  useEffect(() => {
    if (params?.accessCode) {
      setAccessCode(params.accessCode.toUpperCase());
      setTimelineId(params.timelineId);
  } else if (simpleParams?.accessCode) {
      setAccessCode(simpleParams.accessCode.toUpperCase());
  }
}, [params, simpleParams]);

  const {
    data: timeline,
    isLoading,
    error,
} = useQuery({
    queryKey: ['/api/wedding/timeline', accessCode],
    enabled: !!accessCode,
    retry: false,
});

  const handleAccessSubmit = (code: string) => {
    setAccessCode(code);
 };

  if (sessionLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #fff5f5 0%, #ffe0cc 50%, #ffcc80 100%)',
      }}
      >
        <Stack spacing={3} alignItems="center">
          <Event sx={{ fontSize: '4rem', color: '#f57c00',}} />
          <Typography variant="h5" color="primary" sx={{ color: theming.colors.primary }}>
            Forbereder bryllupstidslinje...
          </Typography>
          <LinearProgress sx={{ width: '300px', borderRadius: '4px',}} />
        </Stack>
      </Box>
    );
}

  if (!accessCode) {
    return <DesktopAccessCodeInput onSubmit={handleAccessSubmit} />;
}

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #fff5f5 0%, #ffe0cc 50%, #ffcc80 100%)',
      }}
      >
        <Container maxWidth="md">
          <Paper
            sx={{
              p:  6,
              textAlign: 'center',
              borderRadius: '24px',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 20px 60px rgba(25, 1240.15)',
          }}
          >
            <Event sx={{ fontSize: '4rem', color: '#f57c00', mb:  2 }} />
            <Typography variant="h4" color="primary" sx={{  mb:  3  }}>
              Laster bryllupstidslinje...
            </Typography>
            <LinearProgress
              sx={{
                width: '100%',
                borderRadius: '4px',
                height: '8px',
            }}
            />
          </Paper>
        </Container>
      </Box>
    );
}

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt:  8 }}>
        <Paper
          sx={{
            p:  4,
            textAlign: 'center',
            borderRadius: '16px',
        }}
        >
          <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '1.1rem',}}>
            {error.message.includes('404')
              ? 'Tidslinjen ble ikke funnet' : 'Feil ved lasting av tidslinje'}
          </Alert>
        </Paper>
      </Container>
    );
}

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fff5f5 0%, #ffe0cc 50%, #ffcc80 100%)',
    }}
    >
      <WeddingTimelineClient timelineId={timelineId} accessCode={accessCode} isMobile={false} />
    </Box>
  );
}
