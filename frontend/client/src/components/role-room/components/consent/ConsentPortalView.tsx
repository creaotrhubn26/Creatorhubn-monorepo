import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Divider,
  Paper,
  Alert,
  CircularProgress,
  TextField,
  Stack,
  useTheme,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  CheckCircle,
  Schedule,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  Movie as MovieIcon,
  PhotoCamera as PhotoIcon,
  MicNone as AudioIcon,
  ChildCare as ChildIcon,
} from '@mui/icons-material';
import { LocationsIcon as LocationIcon } from '../icons/CastingIcons';
import ConsentSignatureDialog from './ConsentSignatureDialog';
import type { Consent, ConsentType, ConsentSignatureData } from '../../models/casting';

interface ConsentPortalViewProps {
  accessCode?: string;
  onSigned?: () => void;
}

const getConsentTypeIcon = (type: ConsentType) => {
  const icons: Record<ConsentType, React.ReactNode> = {
    photo_release: <PhotoIcon />,
    video_release: <MovieIcon />,
    audio_release: <AudioIcon />,
    location_release: <LocationIcon />,
    minor_consent: <ChildIcon />,
    other: <DescriptionIcon />,
  };
  return icons[type] || <DescriptionIcon />;
};

const getConsentTypeLabel = (type: ConsentType): string => {
  const labels: Record<ConsentType, string> = {
    photo_release: 'Foto-samtykke',
    video_release: 'Video-samtykke',
    audio_release: 'Lyd-samtykke',
    location_release: 'Lokasjon-samtykke',
    minor_consent: 'Mindreårig-samtykke',
    other: 'Annet samtykke',
  };
  return labels[type] || type;
};

export default function ConsentPortalView({
  accessCode: propAccessCode,
  onSigned,
}: ConsentPortalViewProps) {
  const theme = useTheme();
  const [accessCode, setAccessCode] = useState(propAccessCode || '');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requiresPin, setRequiresPin] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [step, setStep] = useState<'accessCode' | 'credentials' | 'authenticated'>(
    propAccessCode ? 'accessCode' : 'accessCode'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentData, setConsentData] = useState<{
    consent: Consent;
    candidateName: string;
    projectName: string;
  } | null>(null);
  const [showSignDialog, setShowSignDialog] = useState(false);

  const validateAccess = async () => {
    if (!accessCode.trim()) {
      setError('Vennligst skriv inn tilgangskode');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('access_code', accessCode.trim().toUpperCase());
      if (pin) params.append('pin', pin);
      if (password) params.append('password', password);
      
      const response = await fetch(`/api/consent/portal/access?${params.toString()}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setConsentData({
          consent: data.consent,
          candidateName: data.candidateName,
          projectName: data.projectName,
        });
        setStep('authenticated');
      } else if (response.status === 401) {
        if (data.requiresPin || data.requiresPassword) {
          setRequiresPin(data.requiresPin || false);
          setRequiresPassword(data.requiresPassword || false);
          setStep('credentials');
        } else {
          setError(data.error || 'Ugyldig tilgangskode');
        }
      } else {
        setError(data.error || 'Kunne ikke validere tilgang');
      }
    } catch (err) {
      console.error('Access validation error:', err);
      setError('Nettverksfeil. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlAccessCode = urlParams.get('consent_code');
    if (urlAccessCode) {
      setAccessCode(urlAccessCode);
    }
  }, []);

  const handleSign = async (signatureData: ConsentSignatureData) => {
    if (!consentData) return;

    setLoading(true);
    try {
      const response = await fetch('/api/consent/portal/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessCode: accessCode.trim().toUpperCase(),
          pin,
          password,
          signatureData,
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setConsentData({
          ...consentData,
          consent: { ...consentData.consent, signed: true, signatureData },
        });
        setShowSignDialog(false);
        onSigned?.();
      } else {
        setError(data.error || 'Kunne ikke signere samtykke');
      }
    } catch (err) {
      console.error('Sign error:', err);
      setError('Nettverksfeil. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  const renderAccessCodeStep = () => (
    <Card sx={{ maxWidth: 500, mx: 'auto', bgcolor: '#1c2128', color: '#fff' }}>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <LockIcon sx={{ fontSize: 48, color: '#9c27b0', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            Samtykke Portal
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Skriv inn tilgangskoden du mottok for å se og signere samtykket
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Tilgangskode"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
          fullWidth
          placeholder="F.eks. ABC123"
          sx={{ 
            mb: 3,
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: '#ce93d8' },
              '&.Mui-focused fieldset': { borderColor: '#9c27b0' },
            },
            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
          }}
          InputProps={{
            style: { letterSpacing: '0.2em', textTransform: 'uppercase' },
          }}
        />

        <Button
          variant="contained"
          fullWidth
          onClick={validateAccess}
          disabled={loading || !accessCode.trim()}
          sx={{ 
            py: 1.5, 
            bgcolor: '#9c27b0',
            '&:hover': { bgcolor: '#7b1fa2' },
          }}
        >
          {loading ? <CircularProgress size={24} /> : 'Fortsett'}
        </Button>
      </CardContent>
    </Card>
  );

  const renderCredentialsStep = () => (
    <Card sx={{ maxWidth: 500, mx: 'auto', bgcolor: '#1c2128', color: '#fff' }}>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <LockIcon sx={{ fontSize: 48, color: '#9c27b0', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            Ekstra sikkerhet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {requiresPin && requiresPassword 
              ? 'Skriv inn PIN og passord for å fortsette'
              : requiresPin 
                ? 'Skriv inn PIN-koden for å fortsette'
                : 'Skriv inn passordet for å fortsette'}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {requiresPin && (
          <TextField
            label="PIN-kode"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            fullWidth
            type="password"
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
            }}
          />
        )}

        {requiresPassword && (
          <TextField
            label="Passord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            type={showPassword ? 'text' : 'password'}
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    sx={{ color: 'rgba(255,255,255,0.87)' }}
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        )}

        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            onClick={() => setStep('accessCode')}
            sx={{ 
              flex: 1, 
              color: '#fff', 
              borderColor: 'rgba(255,255,255,0.3)',
            }}
          >
            Tilbake
          </Button>
          <Button
            variant="contained"
            onClick={validateAccess}
            disabled={loading || (requiresPin && !pin) || (requiresPassword && !password)}
            sx={{ 
              flex: 1, 
              bgcolor: '#9c27b0',
              '&:hover': { bgcolor: '#7b1fa2' },
            }}
          >
            {loading ? <CircularProgress size={24} /> : 'Bekreft'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );

  const renderAuthenticatedView = () => {
    if (!consentData) return null;

    const { consent, candidateName, projectName } = consentData;

    return (
      <Box sx={{ maxWidth: 700, mx: 'auto' }}>
        <Card sx={{ bgcolor: '#1c2128', color: '#fff', mb: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: 'rgba(156, 39, 176, 0.2)',
                color: '#ce93d8',
              }}>
                {getConsentTypeIcon(consent.type)}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {consent.title || getConsentTypeLabel(consent.type)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {projectName}
                </Typography>
              </Box>
              <Chip
                icon={consent.signed ? <CheckCircle /> : <Schedule />}
                label={consent.signed ? 'Signert' : 'Venter på signatur'}
                color={consent.signed ? 'success' : 'warning'}
                sx={{ fontWeight: 500 }}
              />
            </Stack>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 3 }} />

            <Stack direction="row" spacing={4} sx={{ mb: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Kandidat
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <PersonIcon sx={{ fontSize: 18, color: '#ce93d8' }} />
                  <Typography>{candidateName}</Typography>
                </Stack>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Type
                </Typography>
                <Typography>{getConsentTypeLabel(consent.type)}</Typography>
              </Box>
              {consent.expiresAt && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Utløper
                  </Typography>
                  <Typography>
                    {new Date(consent.expiresAt).toLocaleDateString('nb-NO')}
                  </Typography>
                </Box>
              )}
            </Stack>

            {consent.description && (
              <Paper 
                sx={{ 
                  p: 3, 
                  bgcolor: 'rgba(156, 39, 176, 0.1)', 
                  border: '1px solid rgba(156, 39, 176, 0.2)',
                  mb: 3,
                }}
              >
                <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
                  {consent.description}
                </Typography>
              </Paper>
            )}

            {consent.signed && consent.signatureData && (
              <Alert 
                severity="success" 
                icon={<CheckCircle />}
                sx={{ mb: 3 }}
              >
                Signert av {consent.signatureData.signed_by} den{' '}
                {new Date(consent.signatureData.signed_at).toLocaleDateString('nb-NO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Alert>
            )}

            <Stack direction="row" spacing={2}>
              {!consent.signed && (
                <Button
                  variant="contained"
                  onClick={() => setShowSignDialog(true)}
                  sx={{ 
                    flex: 1, 
                    py: 1.5,
                    bgcolor: '#9c27b0',
                    '&:hover': { bgcolor: '#7b1fa2' },
                  }}
                >
                  Signer samtykke
                </Button>
              )}
              {consent.document && (
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  href={consent.document}
                  target="_blank"
                  sx={{ 
                    color: '#ce93d8', 
                    borderColor: '#ce93d8',
                    '&:hover': { borderColor: '#9c27b0', bgcolor: 'rgba(156, 39, 176, 0.1)' },
                  }}
                >
                  Last ned dokument
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>

        <ConsentSignatureDialog
          open={showSignDialog}
          consent={consent}
          candidateName={candidateName}
          projectName={projectName}
          onSign={handleSign}
          onClose={() => setShowSignDialog(false)}
        />
      </Box>
    );
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: '#0d1117', 
      py: 4, 
      px: 2,
    }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ color: '#ce93d8', fontWeight: 700 }}>
          Casting Planner
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
          Samtykke-portal
        </Typography>
      </Box>

      {step === 'accessCode' && renderAccessCodeStep()}
      {step === 'credentials' && renderCredentialsStep()}
      {step === 'authenticated' && renderAuthenticatedView()}
    </Box>
  );
}
