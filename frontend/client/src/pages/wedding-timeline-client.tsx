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
} from '@mui/material';
import { AccessTime, Event, Search, Key, Lock, Schedule } from '@mui/icons-material';
import { useLocation, useRoute } from 'wouter';
import WeddingTimelineClient from '@/components/wedding/WeddingTimelineClient';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useClientSession } from '@/hooks/useClientSession';

// Access Code Input Component with Unified Access Flow
function AccessCodeInput({ onSubmit }: { onSubmit: (code: string, pin?: string, password?: string) => void }) {
  const { profession } = useProfessionAdapter();
  const theming = useTheming(profession || 'photographer');
  const [accessCode, setAccessCode] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [requiresPin, setRequiresPin] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [step, setStep] = useState<'accessCode' | 'credentials'>('accessCode');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 'accessCode') {
      if (!accessCode.trim()) {
        setError('Tilgangskode er påkrevd');
        return;
      }

      setIsValidating(true);
      setError('');

      try {
        const response = await apiRequest(
          `/api/wedding/timeline/access/${accessCode.trim().toUpperCase()}`,
        );
        // Success - no PIN/password required
        onSubmit(accessCode.trim().toUpperCase());
      } catch (error: any) {
        setIsValidating(false);
        if (error.message.includes('404')) {
          setError('Ugyldig tilgangskode - prøv igjen');
        } else if (error.message.includes('403')) {
          setError('Fotografen/videografen har ikke aktivert tilgang til tidslinjen ennå');
        } else if (error.message.includes('401')) {
          // Check if PIN/password is required
          try {
            const errorData = JSON.parse(error.message.split('Response: ')[1] || '{}');
            if (errorData.requiresPin || errorData.requiresPassword) {
              setRequiresPin(errorData.requiresPin || false);
              setRequiresPassword(errorData.requiresPassword || false);
              setStep('credentials');
              setError('');
              return;
            }
          } catch {
            // Fall through to generic error
          }
          setError('PIN eller passord er påkrevd');
        } else {
          setError('Feil ved tilgang til tidslinje');
        }
      }
    } else {
      // Step 2: Submit with credentials
      if (requiresPin && !pin.trim()) {
        setError('PIN er påkrevd');
        return;
      }
      if (requiresPassword && !password.trim()) {
        setError('Passord er påkrevd');
        return;
      }

      setIsValidating(true);
      setError('');

      try {
        const params = new URLSearchParams();
        if (requiresPin && pin) params.append('pin', pin);
        if (requiresPassword && password) params.append('password', password);
        
        const response = await apiRequest(
          `/api/wedding/timeline/access/${accessCode.trim().toUpperCase()}?${params.toString()}`,
        );
        onSubmit(accessCode.trim().toUpperCase(), pin || undefined, password || undefined);
      } catch (error: any) {
        setIsValidating(false);
        if (error.message.includes('401')) {
          setError('Ugyldig PIN eller passord - prøv igjen');
        } else if (error.message.includes('404')) {
          setError('Ugyldig tilgangskode - prøv igjen');
        } else {
          setError('Feil ved tilgang til tidslinje');
        }
      }
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Event sx={{ fontSize: '3rem', color: theming.colors.primary, mb: 2 }} />
            <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 600, mb: 1 }}>
              Bryllupstidslinje
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              {step === 'accessCode' 
                ? 'Skriv inn tilgangskoden du har fått fra fotografen/videografen for å åpne bryllupstidslinjen.'
                : 'Skriv inn PIN og/eller passord for å fortsette.'}
            </Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Tilgangskode"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              variant="outlined"
              sx={{ mb: 3 }}
              placeholder="F.eks: ABC123XYZ"
              disabled={isValidating || step === 'credentials'}
              inputProps={{ style: { textTransform: 'uppercase' } }}
              InputProps={{
                startAdornment: (
                  <Box sx={{ mr: 1, display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
                    <Key />
                  </Box>
                ),
              }}
            />

            {step === 'credentials' && (
              <>
                {requiresPin && (
                  <TextField
                    fullWidth
                    label="PIN"
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').substring(0, 4))}
                    variant="outlined"
                    sx={{ mb: 3 }}
                    placeholder="4 siffer"
                    disabled={isValidating}
                    inputProps={{ maxLength: 4, inputMode: 'numeric' }}
                    InputProps={{
                      startAdornment: (
                        <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                          {theming.getThemedIcon('lock')}
                        </Box>
                      ),
                    }}
                  />
                )}

                {requiresPassword && (
                  <TextField
                    fullWidth
                    label="Passord"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 3 }}
                    placeholder="Skriv inn passord"
                    disabled={isValidating}
                    InputProps={{
                      startAdornment: (
                        <Box sx={{ mr: 1, display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
                          <Lock />
                        </Box>
                      ),
                    }}
                  />
                )}
              </>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isValidating || (step === 'accessCode' ? !accessCode.trim() : (requiresPin && !pin.trim()) || (requiresPassword && !password.trim()))}
              startIcon={isValidating ? <Schedule /> : <Search />}
              sx={theming.getThemedButtonSx()}
            >
              {isValidating ? 'Sjekker tilgang...' : step === 'accessCode' ? 'Fortsett' : 'Åpne tidslinje'}
            </Button>

            {step === 'credentials' && (
              <Button
                fullWidth
                variant="outlined"
                size="medium"
                onClick={() => {
                  setStep('accessCode');
                  setPin(', ');
                  setPassword(', ');
                  setError(', ');
                }}
                sx={{ mt: 2 }}
              >
                Tilbake
              </Button>
            )}
          </form>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Har du ikke mottatt tilgangskode? Ta kontakt med fotografen/videografen din.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

// Main Client Page Component
export default function WeddingTimelineClientPage() {
  const [location] = useLocation();
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');
  const [match, params] = useRoute('/wedding-timeline/:timelineId/:accessCode');
  const { updateActivity } = useClientSession();
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [timelineId, setTimelineId] = useState<string | null>(null);

  // Activity tracking for session management
  useEffect(() => {
    const handleActivity = () => updateActivity();
    const events = ['click','scroll','keydown','mousemove'];
    events.forEach((event) => document.addEventListener(event, handleActivity));
    return () => events.forEach((event) => document.removeEventListener(event, handleActivity));
  }, [updateActivity]);

  // Check if we have URL parameters for direct access
  useEffect(() => {
    if (match && params?.timelineId && params?.accessCode) {
      setTimelineId(params.timelineId);
      setAccessCode(params.accessCode);
  }
}, [match, params]);

  // Handle access code submission
  const handleAccessCodeSubmit = async (code: string, pin?: string, password?: string) => {
    try {
      const params = new URLSearchParams();
      if (pin) params.append('pin', pin);
      if (password) params.append('password', password);
      
      const response = await apiRequest(`/api/wedding/timeline/access/${code}${params.toString() ? `?${params.toString()}` : ''}`);
      setTimelineId(response.timelineId);
      setAccessCode(code);

      // Update URL to include timeline ID and access code
      window.history.pushState(null, '', `/wedding-timeline/${response.timelineId}/${code}`);
    } catch (error) {
      console.error('Access validation failed:', error);
    }
  };

  // Show access code input if we don't have valid access
  if (!timelineId || !accessCode) {
    return <AccessCodeInput onSubmit={handleAccessCodeSubmit} />;
}

  // Show timeline once we have valid access
  return (
    <Box sx={{ minHeight: '100vh', bgcolor:'#fafafa',}}>
      <WeddingTimelineClient timelineId={timelineId} clientAccessCode={accessCode} />
    </Box>
  );
}
