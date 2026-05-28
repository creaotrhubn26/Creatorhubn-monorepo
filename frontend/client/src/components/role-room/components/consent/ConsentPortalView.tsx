import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  TextField,
  Stack,
  IconButton,
  InputAdornment,
  Fade,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  CheckCircleRounded,
  Schedule,
  LockOutlined as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  Movie as MovieIcon,
  PhotoCamera as PhotoIcon,
  MicNone as AudioIcon,
  ChildCare as ChildIcon,
  ArrowForwardRounded as ArrowIcon,
  GppGoodOutlined as ShieldIcon,
  EventOutlined as CalendarIcon,
  VerifiedUserOutlined as VerifiedIcon,
  Instagram as InstagramIcon,
  Facebook as FacebookIcon,
} from '@mui/icons-material';
import { LocationsIcon as LocationIcon } from '../icons/CastingIcons';
import ConsentSignatureDialog from './ConsentSignatureDialog';
import type { Consent, ConsentType, ConsentSignatureData } from '../../models/casting';
import { getPublicSocialProfiles } from '@/lib/publicBrandLinks';

interface ConsentPortalViewProps {
  accessCode?: string;
  onSigned?: () => void;
}

// ── Merkevare ──
const BRAND = '#9d38c6';
const BRAND_DARK = '#7a2a9c';
const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)`;

const cardSx = {
  width: '100%',
  maxWidth: 540,
  mx: 'auto',
  borderRadius: 4,
  border: '1px solid',
  borderColor: alpha(BRAND, 0.1),
  boxShadow: '0 18px 50px rgba(31, 17, 51, 0.10)',
  bgcolor: '#fff',
} as const;

const ctaSx = {
  py: 1.5,
  borderRadius: 2.5,
  fontWeight: 700,
  fontSize: '1rem',
  textTransform: 'none',
  boxShadow: `0 10px 24px ${alpha(BRAND, 0.35)}`,
  background: BRAND_GRADIENT,
  '&:hover': { background: `linear-gradient(135deg, ${BRAND_DARK} 0%, #5f2079 100%)` },
} as const;

const lightFieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: alpha(BRAND, 0.03) },
} as const;

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

function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ flex: 1, minWidth: 130 }}>
      <Typography
        variant="overline"
        sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1.6 }}
      >
        {label}
      </Typography>
      <Box sx={{ mt: 0.25 }}>{children}</Box>
    </Box>
  );
}

export default function ConsentPortalView({
  accessCode: propAccessCode,
  onSigned,
}: ConsentPortalViewProps) {
  const [accessCode, setAccessCode] = useState(propAccessCode || '');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requiresPin, setRequiresPin] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [step, setStep] = useState<'accessCode' | 'credentials' | 'authenticated'>('accessCode');
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
    <Fade in timeout={400}>
      <Card sx={cardSx}>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Stack alignItems="center" spacing={1} sx={{ mb: 4 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '20px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha(BRAND, 0.1),
                color: BRAND,
                mb: 1,
              }}
            >
              <LockIcon sx={{ fontSize: 30 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Samtykke-portal
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 360 }}>
              Skriv inn tilgangskoden fra invitasjonen for å se og signere samtykket.
            </Typography>
          </Stack>

          {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

          <TextField
            label="Tilgangskode"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') validateAccess(); }}
            fullWidth
            placeholder="CONS-XXXX-XXXX-XXXX"
            helperText="Koden står i invitasjonen du mottok på e-post eller SMS."
            sx={{ mb: 3, ...lightFieldSx }}
            inputProps={{
              style: {
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontWeight: 700,
                textAlign: 'center',
              },
            }}
          />

          <Button
            variant="contained"
            fullWidth
            onClick={validateAccess}
            disabled={loading || !accessCode.trim()}
            endIcon={loading ? undefined : <ArrowIcon />}
            sx={ctaSx}
          >
            {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Fortsett'}
          </Button>

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mt: 3 }}>
            <LockIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Lenken er personlig — ikke del den med andre.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Fade>
  );

  const renderCredentialsStep = () => (
    <Fade in timeout={400}>
      <Card sx={cardSx}>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Stack alignItems="center" spacing={1} sx={{ mb: 4 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '20px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha(BRAND, 0.1),
                color: BRAND,
                mb: 1,
              }}
            >
              <ShieldIcon sx={{ fontSize: 30 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Ekstra sikkerhet
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 360 }}>
              {requiresPin && requiresPassword
                ? 'Skriv inn PIN og passord for å fortsette.'
                : requiresPin
                  ? 'Skriv inn PIN-koden for å fortsette.'
                  : 'Skriv inn passordet for å fortsette.'}
            </Typography>
          </Stack>

          {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

          {requiresPin && (
            <TextField
              label="PIN-kode"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              fullWidth
              type="password"
              sx={{ mb: 2, ...lightFieldSx }}
            />
          )}

          {requiresPassword && (
            <TextField
              label="Passord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              type={showPassword ? 'text' : 'password'}
              sx={{ mb: 3, ...lightFieldSx }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Skjul passord' : 'Vis passord'}
                      edge="end"
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
              sx={{ flex: 1, py: 1.5, borderRadius: 2.5, textTransform: 'none', fontWeight: 600 }}
            >
              Tilbake
            </Button>
            <Button
              variant="contained"
              onClick={validateAccess}
              disabled={loading || (requiresPin && !pin) || (requiresPassword && !password)}
              sx={{ flex: 1, ...ctaSx }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Bekreft'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Fade>
  );

  const renderSignedSuccess = (consent: Consent, candidateName: string, projectName: string) => (
    <Fade in timeout={400}>
      <Card sx={{ ...cardSx, maxWidth: 560 }}>
        <CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
          <Box
            sx={{
              width: 76,
              height: 76,
              mx: 'auto',
              mb: 2.5,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha('#16a34a', 0.12),
              color: '#16a34a',
            }}
          >
            <CheckCircleRounded sx={{ fontSize: 44 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 1 }}>
            Takk! Samtykket er signert
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            {consent.title || getConsentTypeLabel(consent.type)} · {projectName}
          </Typography>

          {consent.signatureData && (
            <Box
              sx={{
                textAlign: 'left',
                bgcolor: alpha('#16a34a', 0.06),
                border: '1px solid',
                borderColor: alpha('#16a34a', 0.2),
                borderRadius: 3,
                p: 2.5,
                mb: 3,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <VerifiedIcon sx={{ fontSize: 18, color: '#16a34a' }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Signert av {consent.signatureData.signed_by}
                </Typography>
              </Stack>
              {consent.signatureData.signed_at && (
                <Typography variant="caption" sx={{ color: 'text.secondary', pl: 3.25 }}>
                  {new Date(consent.signatureData.signed_at).toLocaleDateString('nb-NO', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </Typography>
              )}
            </Box>
          )}

          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            En bekreftelse er registrert. Du kan trygt lukke dette vinduet.
          </Typography>
        </CardContent>
      </Card>
    </Fade>
  );

  const renderAuthenticatedView = () => {
    if (!consentData) return null;
    const { consent, candidateName, projectName } = consentData;

    if (consent.signed) return renderSignedSuccess(consent, candidateName, projectName);

    return (
      <Fade in timeout={400}>
        <Card sx={{ ...cardSx, maxWidth: 640 }}>
          <CardContent sx={{ p: { xs: 3, sm: 4.5 } }}>
            <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ mb: 3 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(BRAND, 0.1),
                  color: BRAND,
                }}
              >
                {getConsentTypeIcon(consent.type)}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.25 }}>
                  {consent.title || getConsentTypeLabel(consent.type)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {projectName}
                </Typography>
              </Box>
              <Chip
                size="small"
                icon={<Schedule sx={{ fontSize: 16 }} />}
                label="Venter på signatur"
                sx={{
                  fontWeight: 600,
                  bgcolor: alpha('#d97706', 0.12),
                  color: '#b45309',
                  '& .MuiChip-icon': { color: '#b45309' },
                }}
              />
            </Stack>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 1.5, sm: 2 }}
              sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: alpha(BRAND, 0.04) }}
            >
              <InfoCell label="Kandidat">
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <PersonIcon sx={{ fontSize: 18, color: BRAND }} />
                  <Typography sx={{ fontWeight: 600 }}>{candidateName}</Typography>
                </Stack>
              </InfoCell>
              <InfoCell label="Type">
                <Typography sx={{ fontWeight: 600 }}>{getConsentTypeLabel(consent.type)}</Typography>
              </InfoCell>
              {consent.expiresAt && (
                <InfoCell label="Utløper">
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <CalendarIcon sx={{ fontSize: 18, color: BRAND }} />
                    <Typography sx={{ fontWeight: 600 }}>
                      {new Date(consent.expiresAt).toLocaleDateString('nb-NO')}
                    </Typography>
                  </Stack>
                </InfoCell>
              )}
            </Stack>

            {consent.description && (
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="overline"
                  sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em' }}
                >
                  Samtykketekst
                </Typography>
                <Box
                  sx={{
                    mt: 0.5,
                    p: 2.5,
                    borderRadius: 3,
                    bgcolor: '#fafafa',
                    borderLeft: '4px solid',
                    borderColor: BRAND,
                  }}
                >
                  <Typography variant="body1" sx={{ lineHeight: 1.7, color: 'text.primary' }}>
                    {consent.description}
                  </Typography>
                </Box>
              </Box>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="contained"
                onClick={() => setShowSignDialog(true)}
                startIcon={<VerifiedIcon />}
                sx={{ flex: 1, ...ctaSx }}
              >
                Signer samtykke
              </Button>
              {consent.document && (
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  href={consent.document}
                  target="_blank"
                  sx={{ py: 1.5, borderRadius: 2.5, textTransform: 'none', fontWeight: 600 }}
                >
                  Last ned dokument
                </Button>
              )}
            </Stack>
          </CardContent>

          <ConsentSignatureDialog
            open={showSignDialog}
            consent={consent}
            candidateName={candidateName}
            projectName={projectName}
            onSign={handleSign}
            onClose={() => setShowSignDialog(false)}
          />
        </Card>
      </Fade>
    );
  };

  const trustBadges: Array<{ icon: React.ReactNode; label: string }> = [
    { icon: <LockIcon sx={{ fontSize: 16 }} />, label: 'Kryptert forbindelse' },
    { icon: <ShieldIcon sx={{ fontSize: 16 }} />, label: 'GDPR-trygg' },
    { icon: <VerifiedIcon sx={{ fontSize: 16 }} />, label: 'Juridisk bindende' },
  ];

  const socialProfiles = getPublicSocialProfiles('roleRoom');

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #faf5ff 0%, #f3e9fb 100%)',
        py: { xs: 4, md: 7 },
        px: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Stack alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
        <Box
          component="img"
          src="/role-room-assets/TheRoleRoom_App_Logo.webp"
          alt="The Role Room"
          sx={{
            height: { xs: 68, sm: 80 },
            width: 'auto',
            filter: `drop-shadow(0 12px 28px ${alpha(BRAND, 0.3)})`,
          }}
        />
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          Sikker samtykke-portal
        </Typography>
      </Stack>

      {step === 'accessCode' && renderAccessCodeStep()}
      {step === 'credentials' && renderCredentialsStep()}
      {step === 'authenticated' && renderAuthenticatedView()}

      <Stack
        direction="row"
        spacing={3}
        justifyContent="center"
        sx={{ mt: 4, flexWrap: 'wrap', rowGap: 1 }}
      >
        {trustBadges.map((b) => (
          <Stack key={b.label} direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
            <Box sx={{ color: BRAND, display: 'flex' }}>{b.icon}</Box>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>{b.label}</Typography>
          </Stack>
        ))}
      </Stack>

      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2.5 }}>
        {socialProfiles.map((p) => (
          <IconButton
            key={p.platform}
            component="a"
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`The Role Room på ${p.label}`}
            size="small"
            sx={{
              color: BRAND,
              bgcolor: alpha(BRAND, 0.08),
              '&:hover': { bgcolor: alpha(BRAND, 0.16) },
            }}
          >
            {p.platform === 'instagram' ? <InstagramIcon fontSize="small" /> : <FacebookIcon fontSize="small" />}
          </IconButton>
        ))}
      </Stack>
    </Box>
  );
}
