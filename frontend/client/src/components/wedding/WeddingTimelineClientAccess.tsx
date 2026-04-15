// @ts-nocheck
import React, { useState } from 'react';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccessTime,
  CheckCircle,
  Event,
  Info,
  Key,
  Launch,
  LockOpen,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';

interface WeddingTimelineClientAccessProps {
  onAccessGranted?: (accessData: any) => void;
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  userId?: string;
}

interface WeddingTimelineAccessData {
  timelineId?: string;
  clientUrl?: string;
  coupleName?: string;
  weddingDate?: string;
  venue?: string;
  photographerName?: string;
}

const helpItems = [
  'Tilgangskoden består av 6 siffer.',
  'Klienten kan følge tidslinjen live på arrangementsdagen.',
  'Kontakt fotografen hvis koden ikke fungerer.',
  'Bokmerk siden for rask tilgang senere.',
];
const successColor = '#2e7d32';

export default function WeddingTimelineClientAccess({
  onAccessGranted,
}: WeddingTimelineClientAccessProps) {
  const [accessCode, setAccessCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [accessData, setAccessData] = useState<WeddingTimelineAccessData | null>(null);
  const [error, setError] = useState('');
  const { profession } = useProfessionAdapter();
  const theming = useTheming(profession || 'photographer');

  const handleAccessCodeChange = (value: string) => {
    setAccessCode(value.replace(/\D/g, '').slice(0, 6));
    if (error) {
      setError('');
    }
  };

  const validateAccessCode = async () => {
    const trimmedCode = accessCode.trim();

    if (!trimmedCode) {
      setError('Vennligst skriv inn tilgangskode.');
      return;
    }

    if (trimmedCode.length !== 6) {
      setError('Tilgangskoden må bestå av 6 siffer.');
      return;
    }

    setValidating(true);
    setError('');

    try {
      const response = await apiRequest(`/api/wedding/timeline/access/${trimmedCode}`);
      setAccessData(response);
      onAccessGranted?.(response);
    } catch (err: any) {
      const message = String(err?.message || '');

      if (message.includes('404')) {
        setError('Ugyldig tilgangskode. Sjekk koden og prøv igjen.');
      } else if (message.includes('403')) {
        setError('Tilgang er ikke aktivert enda. Kontakt fotografen din.');
      } else {
        setError('Kunne ikke validere tilgangskode akkurat nå. Prøv igjen senere.');
      }

      setAccessData(null);
    } finally {
      setValidating(false);
    }
  };

  const openClientInterface = () => {
    if (!accessCode.trim()) {
      return;
    }

    const rawUrl = accessData?.clientUrl || `/wedding-timeline/client/${accessCode.trim()}`;
    const targetUrl = rawUrl.startsWith('http')
      ? rawUrl
      : `${window.location.origin}${rawUrl}`;

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1120,
        mx: 'auto',
        px: { xs: 1, sm: 2, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      <Card
        sx={{
          mb: 3,
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
          ...theming.getThemedCardSx(),
        }}
      >
        <Box
          sx={{
            px: { xs: 3, md: 4 },
            py: { xs: 3, md: 4 },
            background: 'linear-gradient(135deg, rgba(46, 125, 50, 0.10) 0%, rgba(255, 152, 0, 0.12) 100%)',
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={3}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
          >
            <Box sx={{ maxWidth: 680 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: `${theming.colors.primary}15`,
                    color: theming.colors.primary,
                    flexShrink: 0,
                  }}
                >
                  <Event sx={{ fontSize: 30 }} />
                </Box>
                <Box>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 800,
                      color: theming.colors.primary,
                      fontSize: { xs: '1.8rem', md: '2.25rem' },
                      lineHeight: 1.1,
                    }}
                  >
                    Bryllupstidslinje
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ color: 'text.secondary', fontWeight: 600, mt: 0.25 }}
                  >
                    Klienttilgang
                  </Typography>
                </Box>
              </Box>

              <Typography
                variant="body1"
                sx={{
                  color: 'text.secondary',
                  maxWidth: 620,
                  lineHeight: 1.7,
                }}
              >
                Skriv inn tilgangskoden du fikk fra fotografen for å åpne den delte
                tidslinjen og følge bryllupsdagen live.
              </Typography>
            </Box>

            <Paper
              elevation={0}
              sx={{
                px: 2.25,
                py: 1.75,
                borderRadius: 3,
                minWidth: { xs: '100%', md: 260 },
                bgcolor: 'rgba(255,255,255,0.72)',
                border: '1px solid rgba(15, 23, 42, 0.08)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
                Slik fungerer det
              </Typography>
              <Stack spacing={1.2} sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  1. Skriv inn kode
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  2. Bekreft tilgang
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  3. Åpne klientvisningen
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        </Box>
      </Card>

      <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 4,
              boxShadow: '0 18px 40px rgba(15, 23, 42, 0.06)',
              ...theming.getThemedCardSx(),
            }}
          >
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Valider tilgangskode
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Kun tall er tillatt. Koden fylles automatisk inn som 6 siffer.
              </Typography>

              <Stack spacing={2.5}>
                <TextField
                  fullWidth
                  label="Tilgangskode"
                  placeholder="123456"
                  value={accessCode}
                  onChange={(event) => handleAccessCodeChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void validateAccessCode();
                    }
                  }}
                  inputProps={{
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    maxLength: 6,
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Key sx={{ color: theming.colors.primary }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2.5,
                      '&.Mui-focused fieldset': {
                        borderColor: theming.colors.primary,
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: theming.colors.primary,
                    },
                  }}
                />

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={() => void validateAccessCode()}
                  disabled={accessCode.trim().length !== 6 || validating}
                  sx={{
                    minHeight: 54,
                    borderRadius: 2.5,
                    fontWeight: 700,
                    ...theming.getThemedButtonSx(),
                  }}
                >
                  {validating ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1, color: 'inherit' }} />
                      Validerer...
                    </>
                  ) : (
                    <>
                      <LockOpen sx={{ mr: 1 }} />
                      Valider tilgangskode
                    </>
                  )}
                </Button>

                {error && <Alert severity="error">{error}</Alert>}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Paper
            sx={{
              height: '100%',
              p: { xs: 3, md: 4 },
              borderRadius: 4,
              border: '1px solid rgba(15, 23, 42, 0.08)',
              bgcolor: 'rgba(255,255,255,0.86)',
              boxShadow: '0 18px 40px rgba(15, 23, 42, 0.04)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Info sx={{ color: theming.colors.primary }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Tips for klienten
              </Typography>
            </Box>

            <Stack spacing={1.5}>
              {helpItems.map((item) => (
                <Box key={item} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                  <CheckCircle
                    sx={{
                      mt: '2px',
                      fontSize: 18,
                      color: theming.colors.primary,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                    {item}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>

        {accessData && (
          <Grid size={{ xs: 12 }}>
            <Card
              sx={{
                borderRadius: 4,
                border: `1px solid ${successColor}33`,
                boxShadow: '0 20px 48px rgba(34, 197, 94, 0.08)',
                ...theming.getThemedCardSx(),
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    alignItems: { xs: 'flex-start', md: 'center' },
                    justifyContent: 'space-between',
                    gap: 2,
                    mb: 3,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <CheckCircle sx={{ color: successColor, fontSize: 30 }} />
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Tilgang godkjent
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Tidslinjen er klar til å åpnes.
                      </Typography>
                    </Box>
                  </Box>

                  <Button
                    variant="contained"
                    size="large"
                    onClick={openClientInterface}
                    sx={{
                      minWidth: { xs: '100%', md: 240 },
                      borderRadius: 2.5,
                      fontWeight: 700,
                      ...theming.getThemedButtonSx(),
                    }}
                  >
                    <Launch sx={{ mr: 1 }} />
                    Åpne bryllupstidslinje
                  </Button>
                </Box>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 2.25, borderRadius: 3, height: '100%' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                        <Event sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Bryllup
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {accessData.coupleName || 'Bryllup'}
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 2.25, borderRadius: 3, height: '100%' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                        <AccessTime sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Dato
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {accessData.weddingDate
                          ? new Date(accessData.weddingDate).toLocaleDateString('no-NO')
                          : 'Ikke satt'}
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 2.25, borderRadius: 3, height: '100%' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                        <Info sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Lokasjon
                        </Typography>
                      </Box>
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: 700, wordBreak: 'break-word' }}
                      >
                        {accessData.venue || 'Ikke spesifisert'}
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 2.25, borderRadius: 3, height: '100%' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                        <Key sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Fotograf
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {accessData.photographerName || 'Ikke spesifisert'}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
