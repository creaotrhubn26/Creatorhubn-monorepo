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
  Stack,
  Paper,
} from '@mui/material';
import { RingIcon } from '../components/shared/CreatorHubIcons';
import { AccessTime, Event, Search } from '@mui/icons-material';
import { useLocation, useRoute } from 'wouter';
import WeddingTimelineClient from '@/components/wedding/WeddingTimelineClient';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useClientSession } from '@/hooks/useClientSession';

// Mobile-optimized Access Code Input Component
function MobileAccessCodeInput({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [accessCode, setAccessCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) {
      setError('Tilgangskode/passord er påkrevd');
      return;
  }

    setIsValidating(true);
    setError(', ');

    try {
      const response = await apiRequest(
        `/api/wedding/timeline/access/${accessCode.trim().toUpperCase()}`,
      );
      onSubmit(accessCode.trim().toUpperCase());
  } catch (error: any) {
      if (error.message.includes('404')) {
        setError('Ugyldig tilgangskode');
  } else if (error.message.includes('403')) {
        setError('Fotografen/videografen har ikke aktivert tilgang til tidslinjen ennå');
    } else {
        setError('Feil ved tilgang til tidslinje');
    }
  } finally {
      setIsValidating(false);
  }
};

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fff5f5 0%, #ffe0cc 50%, #ffcc80 100%)',
        px: 2,
        py: 3,
    }}
    >
      <Container maxWidth="xs">
        {/* Mobile Hero Section */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Favorite
            sx={{
              fontSize: '4rem',
              color: '#f57c00',
              mb: 1,
              filter: 'drop-shadow(0 4px 8px rgba(25, 1240.3))',
          }}
          />
          <Typography variant="h4"
            sx={{
              color: '#e65100',
              fontWeight: 70,
              mb: 1,
              fontSize: '1.75rem',
          }}
          >
            Bryllupstidslinje
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              fontSize: '0.9rem',
              lineHeight: 1.4,
          }}
          >
            Følg med på dagen din i sanntid
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{
            borderRadius: '20px',
            background: 'rgba(25,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(25, 1240.2)',
            boxShadow: '0 8px 32px rgba(25, 1240.15)',
            p:  3,
        }}
        >
          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <Box sx={{ textAlign: 'center',}}>
                <Typography variant="h6"
                  sx={{
                    color: '#e65100',
                    fontWeight: 600,
                    mb: 1,
                    fontSize: '1.1rem',
                }}
                >
                  Tilgangskode
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.85rem',
                }}
                >
                  Skriv inn koden fra fotografen/videografen din
                </Typography>
              </Box>

              <TextField
                fullWidth
                label="Tilgangskode/passord"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                variant="outlined"
                placeholder="F.eks: ABC123XYZ"
                disabled={isValidating}
                inputProps={{
                  style: {
                    textAlign: 'center',
                    fontSize: '1.1rem',
                    letterSpacing: '1px',
                },
              }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px', '&:hover fieldset': {
                      borderColor: '#f57c00',
                  }, '&.Mui-focused fieldset': {
                      borderColor: '#f57c00',
                  },
                },
              }}
              />

              {error && (
                <Alert
                  severity="error"
                  sx={{
                    borderRadius: '12px',
                    fontSize: '0.9rem',
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
                  py: 2,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    borderRadius: '16px',
                  bgcolor: '#f57c00',
                  boxShadow: '0 4px 16px rgba(25, 124, 0, 0.3)',
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: '#ef6c00',
                    boxShadow: '0 6px 20px rgba(25, 124, 0, 0.4)',
                    transform: 'translateY(-2px)',
                  }, '&:disabled': {
                    bgcolor: '#ffcc80',
                    color: 'rgba(0, 0, 0, 0.6)',
                  },
                  transition: 'all 0.3s ease',
                  ...theming.getThemedButtonSx()
                }}>
                {isValidating ? 'Sjekker tilgang...' : 'Åpne tidslinje'}
              </Button>

              <Box sx={{ textAlign: 'center',}}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.8rem',
                    lineHeight: 1.4,
                }}
                >
                  Har du ikke mottatt tilgangskode/passord?{'\n'}
                  Ta kontakt med fotografen/videografen din.
                </Typography>
              </Box>
            </Stack>
          </form>
        </Paper>

        {/* Mobile Progress Indicator */}
        {isValidating && (
          <Box sx={{ mt:  2 }}>
            <LinearProgress
              sx={{
                borderRadius: '4px',
                bgcolor: 'rgba(25, 1240.1)', '& .MuiLinearProgress-bar': {
                  bgcolor: '#f57c00',
              },
            }}
            />
          </Box>
        )}
      </Container>
    </Box>
  );
}

// Main Mobile Wedding Timeline Client Component
export default function WeddingTimelineClientMobile() {
  const [location] = useLocation();
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');
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
        <LinearProgress sx={{ width: '80, %', borderRadius: '4px',}} />
      </Box>
    );
}

  if (!accessCode) {
    return <MobileAccessCodeInput onSubmit={handleAccessSubmit} />;
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
        <Stack spacing={2} alignItems="center">
          <Event sx={{ fontSize: '3rem', color: '#f57c00',}} />
          <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
            Laster bryllupstidslinje...
          </Typography>
          <LinearProgress sx={{ width: '200px', borderRadius: '4px',}} />
        </Stack>
      </Box>
    );
}

  if (error) {
    return (
      <Container maxWidth="xs" sx={{ mt:  4 }}>
        <Alert severity="error" sx={{ borderRadius: '12px',}}>
          {error.message.includes('404')
            ? 'Tidslinjen ble ikke funnet' : 'Feil ved lasting av tidslinje'}
        </Alert>
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
      <WeddingTimelineClient timelineId={timelineId} accessCode={accessCode} isMobile={true} />
    </Box>
  );
}
