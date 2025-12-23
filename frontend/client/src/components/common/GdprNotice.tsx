import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  IconButton,
  Collapse,
  Link,
  Chip,
  Switch,
} from '@mui/material';
import {
  Close,
  ExpandMore,
  ExpandLess,
  Cookie,
  Info,
  Policy,
} from '@mui/icons-material';

interface GdprNoticeProps {
  position?: 'bottom' | 'top';
}

export function GdprNotice({ position = 'bottom' }: GdprNoticeProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [cookieSettings, setCookieSettings] = useState({
    necessary: true, // Always required
    analytics: false,
    marketing: false,
    preferences: false,
  });
  const [personvernombudEmail, setPersonvernombudEmail] = useState('daniel@creatorhubn.com');
  const [communityPrivacyText, setCommunityPrivacyText] = useState(
    'Når du bruker CreatorHub Community lagres meldinger, vedlegg og profildata. Filer lagres sikkert i Google Drive med kryptering. Du kan når som helst slette dine meldinger eller be om full sletting av dine data.'
  );

  useEffect(() => {
    // Load GDPR settings from backend
    fetch('/api/admin/gdpr-settings', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.settings) {
          setPersonvernombudEmail(j.settings.personvernombudEmail || 'daniel@creatorhubn.com');
          setCommunityPrivacyText(
            j.settings.communityPrivacyText ||
              'Når du bruker CreatorHub Community lagres meldinger, vedlegg og profildata. Filer lagres sikkert i Google Drive med kryptering. Du kan når som helst slette dine meldinger eller be om full sletting av dine data.'
          );
        }
      })
      .catch(() => {
        // Use defaults if fetch fails
      });

    // Load consent from server first
    fetch('/api/user/kv/gdpr_consent', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const consent = j?.data;
        if (!consent?.date) {
          // fallback to local
          const hasConsent = localStorage.getItem('gdpr-consent');
          const consentDate = localStorage.getItem('gdpr-consent-date');
          if (!hasConsent || !consentDate) {
            setIsVisible(true);
          } else {
            const consentTime = new Date(consentDate);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            if (consentTime < oneYearAgo) setIsVisible(true);
          }
        }
      })
      .catch(() => {
        const hasConsent = localStorage.getItem('gdpr-consent');
        const consentDate = localStorage.getItem('gdpr-consent-date');
        if (!hasConsent || !consentDate) setIsVisible(true);
      });
  }, []);

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
  };

    localStorage.setItem('gdpr-consent', JSON.stringify(allAccepted));
    localStorage.setItem('gdpr-consent-date', new Date().toISOString());
    localStorage.setItem(
      'gdpr-consent-details',
      JSON.stringify({ consentMethod: 'accept_all', userAgent: navigator.userAgent, timestamp: new Date().toISOString(), version: '1.0' }),
    );
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'gdpr_consent', value: { settings: allAccepted, date: new Date().toISOString(), method: 'accept_all' } })
    }).catch(() => {});

    setIsVisible(false);

    // Configure Google Analytics based on consent
    if (window.gtag) {
      window.gtag('consent','update', {
        analytics_storage: 'granted',
        ad_storage: 'granted',
        functionality_storage: 'granted',
        personalization_storage: 'granted',
    });
  }
};

  const handleRejectAll = () => {
    const onlyNecessary = {
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
  };

    localStorage.setItem('gdpr-consent', JSON.stringify(onlyNecessary));
    localStorage.setItem('gdpr-consent-date', new Date().toISOString());
    localStorage.setItem(
      'gdpr-consent-details',
      JSON.stringify({ consentMethod: 'reject_all', userAgent: navigator.userAgent, timestamp: new Date().toISOString(), version: '1.0' }),
    );
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'gdpr_consent', value: { settings: onlyNecessary, date: new Date().toISOString(), method: 'reject_all' } })
    }).catch(() => {});

    setIsVisible(false);

    // Deny all non-necessary cookies
    if (window.gtag) {
      window.gtag('consent','update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        functionality_storage: 'denied',
        personalization_storage: 'denied',
    });
  }
};

  const handleSaveCustom = () => {
    localStorage.setItem('gdpr-consent', JSON.stringify(cookieSettings));
    localStorage.setItem('gdpr-consent-date', new Date().toISOString());
    localStorage.setItem(
      'gdpr-consent-details',
      JSON.stringify({ consentMethod: 'custom', settings: cookieSettings, userAgent: navigator.userAgent, timestamp: new Date().toISOString(), version: '1.0' }),
    );
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'gdpr_consent', value: { settings: cookieSettings, date: new Date().toISOString(), method: 'custom' } })
    }).catch(() => {});

    setIsVisible(false);

    // Configure Google Analytics based on custom settings
    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: cookieSettings.analytics ? 'granted' : 'denied',
        ad_storage: cookieSettings.marketing ? 'granted' : 'denied',
        functionality_storage: cookieSettings.preferences ? 'granted' : 'denied',
        personalization_storage: cookieSettings.preferences ? 'granted' : 'denied',
    });
  }
};

  const handleCustomize = () => {
    setIsExpanded(!isExpanded);
};

  if (!isVisible) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        [position]: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'calc(100% - 48px)',
        maxWidth: '580px',
        borderRadius: '20px',
        background: 'rgba(26, 26, 46, 0.95)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.1)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2}}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
              }}
            >
              <Cookie />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem' }}>
                Personvern og Cookies
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                CreatorHub Norge
              </Typography>
            </Box>
          </Box>

          <IconButton onClick={() => setIsVisible(false)} size="small" sx={{ color: 'rgba(255, 255, 255, 0.5)', '&:hover': { color: '#f59e0b' } }}>
            <Close />
          </IconButton>
        </Box>

        {/* Main Content - Forbrukertilsynet compliant */}
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 2, lineHeight: 1.7 }}>
          <strong style={{ color: '#fff' }}>Vi respekterer ditt personvern.</strong> CreatorHub Norge bruker cookies og
          lignende teknologier. Du har full kontroll over hvilke cookies du vil akseptere.
          Nødvendige cookies kreves for at nettstedet skal fungere.
        </Typography>

        {/* Community Data Storage Information */}
        <Box
          sx={{
            p: 1.5,
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderRadius: '10px',
            mb: 2,
            border: '1px solid rgba(245, 158, 11, 0.2)',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: '#f59e0b',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 0.5,
            }}
          >
            <Info sx={{ fontSize: 14 }} />
            Community Datalagring
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', lineHeight: 1.5 }}
          >
            {communityPrivacyText}
          </Typography>
        </Box>

        {/* Legal basis information */}
        <Box
          sx={{
            p: 1.5,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '10px',
            mb: 2,
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: '#3b82f6',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 0.5,
            }}
          >
            <Info sx={{ fontSize: 14 }} />
            Rettslig grunnlag
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', lineHeight: 1.5 }}
          >
            Behandling av personopplysninger baseres på samtykke (GDPR art. 6.1.a) og berettiget
            interesse (GDPR art. 6.1.f). Du kan når som helst trekke tilbake samtykket ditt.
          </Typography>
        </Box>

        {/* Cookie Categories */}
        <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label="Nødvendige"
            size="small"
            variant="filled"
            sx={{
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              fontWeight: 'bold',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          />
          <Chip
            label="Analyse"
            size="small"
            variant="outlined"
            sx={{
              borderColor: 'rgba(59, 130, 246, 0.5)',
              color: '#3b82f6',
            }}
          />
          <Chip
            label="Markedsføring"
            size="small"
            variant="outlined"
            sx={{
              borderColor: 'rgba(245, 158, 11, 0.5)',
              color: '#f59e0b',
            }}
          />
          <Chip
            label="Preferanser"
            size="small"
            variant="outlined"
            sx={{
              borderColor: 'rgba(168, 85, 247, 0.5)',
              color: '#a855f7',
            }}
          />
        </Stack>

        {/* Detailed Cookie Settings */}
        <Collapse in={isExpanded}>
          <Box
            sx={{
              p: 2.5,
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '14px',
              mb: 2,
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                mb: 2.5,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Cookie sx={{ color: '#f59e0b' }} />
              Tilpass cookie-innstillinger
            </Typography>

            <Stack spacing={2.5}>
              {/* Necessary Cookies - Always on */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#10b981' }}>
                    Nødvendige cookies
                  </Typography>
                  <Switch 
                    checked={cookieSettings.necessary} 
                    disabled 
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10b981' },
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', mb: 0.5, lineHeight: 1.5 }}>
                  Tekniske cookies som er nødvendige for at nettstedet skal fungere. Inkluderer
                  autentisering, sikkerhet og grunnleggende funksjonalitet. Kan ikke deaktiveres.
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '10px' }}>
                  Lagring: Sesjon og lokal lagring • Formål: Sikkerhet og funksjonalitet
                </Typography>
              </Box>

              {/* Analytics Cookies */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#3b82f6' }}>
                    Analysecookies
                  </Typography>
                  <Switch
                    checked={cookieSettings.analytics}
                    onChange={(e) =>
                      setCookieSettings((prev) => ({
                        ...prev,
                        analytics: e.target.checked,
                      }))
                    }
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#3b82f6' },
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', mb: 0.5, lineHeight: 1.5 }}>
                  Google Analytics (GA4) for å forstå hvordan besøkende bruker nettstedet. Data
                  anonymiseres og deles ikke med tredjeparter til markedsføringsformål.
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '10px' }}>
                  Tjeneste: Google Analytics • Lagring: 2 år • Overføring: EU/EØS og USA
                </Typography>
              </Box>

              {/* Marketing Cookies */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                    Markedsføringscookies
                  </Typography>
                  <Switch
                    checked={cookieSettings.marketing}
                    onChange={(e) =>
                      setCookieSettings((prev) => ({
                        ...prev,
                        marketing: e.target.checked,
                      }))
                    }
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#f59e0b' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#f59e0b' },
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', mb: 0.5, lineHeight: 1.5 }}>
                  For å vise relevante annonser og måle effektiviteten av markedsføringskampanjer.
                  Brukes til å bygge en profil av dine interesser.
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '10px' }}>
                  Tjenester: Google Ads, Facebook • Lagring: 1-2 år • Rettslig grunnlag: Samtykke
                </Typography>
              </Box>

              {/* Preference Cookies */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: '10px',
                  backgroundColor: 'rgba(168, 85, 247, 0.08)',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#a855f7' }}>
                    Preferansecookies
                  </Typography>
                  <Switch
                    checked={cookieSettings.preferences}
                    onChange={(e) =>
                      setCookieSettings((prev) => ({
                        ...prev,
                        preferences: e.target.checked,
                      }))
                    }
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#a855f7' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#a855f7' },
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', mb: 0.5, lineHeight: 1.5 }}>
                  Husker dine innstillinger og preferanser for å tilpasse opplevelsen din, som
                  språkvalg og brukergrensesnitt-innstillinger.
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '10px' }}>
                  Lagring: 1 år • Formål: Brukeropplevelse • Rettslig grunnlag: Berettiget interesse
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Collapse>

      {/* Actions */}
        <Stack spacing={2}>
          {!isExpanded ? (
            <Stack direction="row" spacing={2}>
              <Button variant="contained"
                onClick={handleAcceptAll}
                sx={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                  color: 'white',
                  py: 1.3,
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '14px',
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #d97706 0%, #c2410c 100%)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                Godta alle cookies
              </Button>

              <Button
                variant="outlined"
                onClick={handleRejectAll}
                sx={{
                  flex: 1,
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  py: 1.3,
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontSize: '14px',
                  '&:hover': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                Kun nødvendige
              </Button>
            </Stack>
          ) : (
            <Button variant="contained"
              onClick={handleSaveCustom}
              sx={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                py: 1.3,
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '14px',
                '&:hover': {
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                },
              }}
            >
              Lagre mine valg
            </Button>
          )}

          <Button
            variant="text"
            startIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
            onClick={handleCustomize}
            sx={{
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'none',
              py: 0.5,
              fontSize: '13px',
              '&:hover': { color: '#f59e0b' },
            }}
          >
            {isExpanded ? 'Skjul innstillinger' : 'Tilpass cookie-innstillinger'}
          </Button>
        </Stack>

        {/* Footer Links - Forbrukertilsynet compliant */}
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: '1px solid rgba(245, 158, 11, 0.15)',
          }}
        >
          <Stack spacing={1}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center' }}>
              <Policy sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
              Dine rettigheter etter GDPR: Innsyn, retting, sletting, begrensning, dataportabilitet
              og innsigelse.
            </Typography>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Link
                href="/privacy-policy"
                sx={{
                  color: '#f59e0b',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 500,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Personvernregler
              </Link>
              <Link
                href="/cookie-policy"
                sx={{
                  color: '#f59e0b',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 500,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Cookie-policy
              </Link>
              <Link
                href="/gdpr-rettigheter"
                sx={{
                  color: '#f59e0b',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 500,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Dine rettigheter
              </Link>
              <Link
                href={`mailto:${personvernombudEmail}`}
                sx={{
                  color: '#f59e0b',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 500,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Kontakt personvernombud
              </Link>
            </Box>

            <Typography
              variant="caption"
              sx={{ color: 'rgba(255, 255, 255, 0.3)', textAlign: 'center', fontSize: '10px' }}
            >
              Behandlingsansvarlig: QAZI FOTOREEL • Org.nr: 833038222 • Personvernombud:{' '}
              {personvernombudEmail}
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Paper>
  );
}

export default GdprNotice;
