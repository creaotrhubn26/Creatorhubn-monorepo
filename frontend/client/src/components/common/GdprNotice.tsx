import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { applyMarketingConsent } from '@/lib/marketingPixelsRuntime';

interface GdprNoticeProps {
  position?: 'bottom' | 'top';
}

interface CookieConsentSettings {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    __creatorhubApplyConsent?: (
      consentSettings?: CookieConsentSettings | null,
    ) => boolean;
    __creatorhubLoadAnalytics?: (
      consentSettings?: CookieConsentSettings | null,
    ) => boolean;
  }
}

const DEFAULT_COOKIE_SETTINGS: CookieConsentSettings = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

function normalizeCookieConsentSettings(
  value: unknown,
): CookieConsentSettings | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<CookieConsentSettings>;
  return {
    necessary: candidate.necessary !== false,
    analytics: candidate.analytics === true,
    marketing: candidate.marketing === true,
    preferences: candidate.preferences === true,
  };
}

function syncAnalyticsConsent(settings: CookieConsentSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  if (typeof window.__creatorhubApplyConsent === 'function') {
    window.__creatorhubApplyConsent(settings);
  }

  if (
    settings.analytics &&
    typeof window.__creatorhubLoadAnalytics === 'function'
  ) {
    window.__creatorhubLoadAnalytics(settings);
  }

  applyMarketingConsent(settings);
}

export function GdprNotice({ position = 'bottom' }: GdprNoticeProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasSavedConsent, setHasSavedConsent] = useState(false);
  const [cookieSettings, setCookieSettings] =
    useState<CookieConsentSettings>(DEFAULT_COOKIE_SETTINGS);
  const [personvernombudEmail, setPersonvernombudEmail] = useState('hello@creatorhubn.com');
  const [communityPrivacyText, setCommunityPrivacyText] = useState(
    'Når du bruker CreatorHub Community lagres meldinger, vedlegg og profildata. Filer lagres sikkert i Google Drive med kryptering. Du kan når som helst slette dine meldinger eller be om full sletting av dine data.'
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Load GDPR settings from backend
    fetch('/api/admin/gdpr-settings', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.settings) {
          setPersonvernombudEmail(j.settings.personvernombudEmail || 'hello@creatorhubn.com');
          setCommunityPrivacyText(
            j.settings.communityPrivacyText ||
              'Når du bruker CreatorHub Community lagres meldinger, vedlegg og profildata. Filer lagres sikkert i Google Drive med kryptering. Du kan når som helst slette dine meldinger eller be om full sletting av dine data.'
          );
        }
      })
      .catch(() => {
        // Use defaults if fetch fails
      });

    const applyExistingConsent = (
      settingsCandidate: unknown,
      consentDateValue: unknown,
    ): boolean => {
      const normalizedSettings = normalizeCookieConsentSettings(settingsCandidate);
      const consentDate =
        typeof consentDateValue === 'string' ? consentDateValue : null;

      if (!normalizedSettings || !consentDate) {
        return false;
      }

      setCookieSettings(normalizedSettings);
      setHasSavedConsent(true);
      syncAnalyticsConsent(normalizedSettings);

      localStorage.setItem('gdpr-consent', JSON.stringify(normalizedSettings));
      localStorage.setItem('gdpr-consent-date', consentDate);

      const consentTime = new Date(consentDate);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      setIsVisible(consentTime < oneYearAgo);
      return true;
    };

    const applyLocalConsentFallback = () => {
      const storedConsentRaw = localStorage.getItem('gdpr-consent');
      const storedConsentDate = localStorage.getItem('gdpr-consent-date');

      if (!storedConsentRaw || !storedConsentDate) {
        setIsVisible(true);
        return;
      }

      try {
        const parsedConsent = JSON.parse(storedConsentRaw);
        if (!applyExistingConsent(parsedConsent, storedConsentDate)) {
          setIsVisible(true);
        }
      } catch {
        setIsVisible(true);
      }
    };

    // Load consent from server first
    fetch('/api/user/kv/gdpr_consent', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const consent = j?.data;
        if (!applyExistingConsent(consent?.settings, consent?.date)) {
          applyLocalConsentFallback();
        }
      })
      .catch(() => {
        applyLocalConsentFallback();
      });
  }, []);

  const handleAcceptAll = () => {
    const allAccepted: CookieConsentSettings = {
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

    setCookieSettings(allAccepted);
    setHasSavedConsent(true);
    setIsVisible(false);
    syncAnalyticsConsent(allAccepted);
};

  const handleRejectAll = () => {
    const onlyNecessary: CookieConsentSettings = {
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

    setCookieSettings(onlyNecessary);
    setHasSavedConsent(true);
    setIsVisible(false);
    syncAnalyticsConsent(onlyNecessary);
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

    setHasSavedConsent(true);
    setIsVisible(false);
    syncAnalyticsConsent(cookieSettings);
};

  const handleCustomize = () => {
    setIsExpanded(!isExpanded);
};

  if (!mounted) return null;

  const bannerContent = (
    <Box
      sx={{
        position: 'fixed',
        [position]: { xs: 299, sm: 374, md: 449, lg: 524 },
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'calc(100% - 48px)',
        maxWidth: { xs: '100%', sm: '600px', md: '700px', lg: '800px' },
        pointerEvents: 'none',
      }}
    >
      <Paper
        elevation={8}
        sx={{
          width: '100%',
          maxWidth: { xs: '100%', sm: '600px', md: '700px', lg: '800px' },
          borderRadius: { xs: '16px', sm: '18px', md: '20px', lg: '24px' },
          background: 'rgba(26, 26, 46, 0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.1)',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
      >
      <Box sx={{ 
        p: { xs: 2, sm: 3, md: 4, lg: 5 },
      }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5 } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: { xs: 44, sm: 48, md: 56, lg: 64 },
                height: { xs: 44, sm: 48, md: 56, lg: 64 },
                borderRadius: { xs: '12px', sm: '14px', md: '16px' },
                background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
              }}
            >
              <Cookie sx={{ fontSize: { xs: 24, sm: 26, md: 30, lg: 40 } }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ 
                fontWeight: 700, 
                color: '#fff', 
                fontSize: { xs: '1.1rem', sm: '1.2rem', md: '1.6rem', lg: '2.2rem' } 
              }}>
                Personvern og Cookies
              </Typography>
              <Typography variant="body2" sx={{ 
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: { xs: '0.75rem', sm: '0.8rem', md: '1rem', lg: '1.4rem' }
              }}>
                CreatorHub Norge
              </Typography>
            </Box>
          </Box>

          <IconButton
            onClick={() => setIsVisible(false)}
            size="small"
            sx={{ color: 'rgba(255, 255, 255, 0.5)', '&:hover': { color: '#f59e0b' } }}
          >
            <Close />
          </IconButton>
        </Box>

        {/* Main Content - Forbrukertilsynet compliant */}
        <Typography variant="body2" sx={{ 
          color: 'rgba(255, 255, 255, 0.8)', 
          mb: { xs: 2, sm: 2.5, md: 3 },
          lineHeight: 1.7,
          fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1.15rem', lg: '1.5rem' }
        }}>
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
              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.9rem', lg: '1.2rem' },
            }}
          >
            <Info sx={{ fontSize: { xs: 14, sm: 15, md: 17, lg: 22 } }} />
            Community Datalagring
          </Typography>
          <Typography
            variant="caption"
            sx={{ 
              color: 'rgba(255, 255, 255, 0.7)', 
              display: 'block', 
              lineHeight: 1.5,
              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.9rem', lg: '1.15rem' }
            }}
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
              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.9rem', lg: '1.2rem' },
            }}
          >
            <Info sx={{ fontSize: { xs: 14, sm: 15, md: 17, lg: 22 } }} />
            Rettslig grunnlag
          </Typography>
          <Typography
            variant="caption"
            sx={{ 
              color: 'rgba(255, 255, 255, 0.7)', 
              display: 'block', 
              lineHeight: 1.5,
              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.9rem', lg: '1.15rem' }
            }}
          >
            Behandling av personopplysninger baseres på samtykke (GDPR art. 6.1.a) og berettiget
            interesse (GDPR art. 6.1.f). Du kan når som helst trekke tilbake samtykket ditt.
          </Typography>
        </Box>

        {/* Cookie Categories */}
        <Stack direction="row" spacing={1} sx={{ 
          mb: { xs: 3, sm: 3.5, md: 4, lg: 4.5 }, 
          flexWrap: 'wrap', 
          gap: { xs: 1, sm: 1.5, md: 2 } 
        }}>
          <Chip
            label="Nødvendige"
            size="small"
            variant="filled"
            sx={{
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              fontWeight: 'bold',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.95rem', lg: '1.2rem' },
              height: { xs: '24px', sm: '26px', md: '32px', lg: '40px' },
            }}
          />
          <Chip
            label="Analyse"
            size="small"
            variant="outlined"
            sx={{
              borderColor: 'rgba(59, 130, 246, 0.5)',
              color: '#3b82f6',
              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.95rem', lg: '1.2rem' },
              height: { xs: '24px', sm: '26px', md: '32px', lg: '40px' },
            }}
          />
          <Chip
            label="Markedsføring"
            size="small"
            variant="outlined"
            sx={{
              borderColor: 'rgba(245, 158, 11, 0.5)',
              color: '#f59e0b',
              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.95rem', lg: '1.2rem' },
              height: { xs: '24px', sm: '26px', md: '32px', lg: '40px' },
            }}
          />
          <Chip
            label="Preferanser"
            size="small"
            variant="outlined"
            sx={{
              borderColor: 'rgba(168, 85, 247, 0.5)',
              color: '#a855f7',
              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.95rem', lg: '1.2rem' },
              height: { xs: '24px', sm: '26px', md: '32px', lg: '40px' },
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
                fontSize: { xs: '0.875rem', sm: '0.95rem', md: '1.1rem', lg: '1.5rem' },
              }}
            >
              <Cookie sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 28 }, color: '#f59e0b' }} />
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
                  <Typography variant="body2" sx={{ 
                    fontWeight: 700, 
                    color: '#10b981',
                    fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem', lg: '1.3rem' }
                  }}>
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
                <Typography variant="caption" sx={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  display: 'block', 
                  mb: 0.5, 
                  lineHeight: 1.5,
                  fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.9rem', lg: '1.15rem' }
                }}>
                  Tekniske cookies som er nødvendige for at nettstedet skal fungere. Inkluderer
                  autentisering, sikkerhet og grunnleggende funksjonalitet. Kan ikke deaktiveres.
                </Typography>
                <Typography variant="caption" sx={{ 
                  color: 'rgba(255, 255, 255, 0.4)', 
                  fontSize: { xs: '10px', sm: '11px', md: '12px', lg: '14px' }
                }}>
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
                  <Typography variant="body2" sx={{ 
                    fontWeight: 700, 
                    color: '#3b82f6',
                    fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem', lg: '1.3rem' }
                  }}>
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
                <Typography variant="caption" sx={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  display: 'block', 
                  mb: 0.5, 
                  lineHeight: 1.5,
                  fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.9rem', lg: '1.15rem' }
                }}>
                  Google Analytics (GA4) for å forstå hvordan besøkende bruker nettstedet. Data
                  anonymiseres og deles ikke med tredjeparter til markedsføringsformål.
                </Typography>
                <Typography variant="caption" sx={{ 
                  color: 'rgba(255, 255, 255, 0.4)', 
                  fontSize: { xs: '10px', sm: '11px', md: '12px', lg: '14px' }
                }}>
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
                  <Typography variant="body2" sx={{ 
                    fontWeight: 700, 
                    color: '#f59e0b',
                    fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem', lg: '1.3rem' }
                  }}>
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
                <Typography variant="caption" sx={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  display: 'block', 
                  mb: 0.5, 
                  lineHeight: 1.5,
                  fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.9rem', lg: '1.15rem' }
                }}>
                  For å vise relevante annonser og måle effektiviteten av markedsføringskampanjer.
                  Brukes til å bygge en profil av dine interesser.
                </Typography>
                <Typography variant="caption" sx={{ 
                  color: 'rgba(255, 255, 255, 0.4)', 
                  fontSize: { xs: '10px', sm: '11px', md: '12px', lg: '14px' }
                }}>
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
                  <Typography variant="body2" sx={{ 
                    fontWeight: 700, 
                    color: '#a855f7',
                    fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem', lg: '1.3rem' }
                  }}>
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
                <Typography variant="caption" sx={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  display: 'block', 
                  mb: 0.5, 
                  lineHeight: 1.5,
                  fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.9rem', lg: '1.15rem' }
                }}>
                  Husker dine innstillinger og preferanser for å tilpasse opplevelsen din, som
                  språkvalg og brukergrensesnitt-innstillinger.
                </Typography>
                <Typography variant="caption" sx={{ 
                  color: 'rgba(255, 255, 255, 0.4)', 
                  fontSize: { xs: '10px', sm: '11px', md: '12px', lg: '14px' }
                }}>
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
                  py: { xs: 1.3, sm: 1.5, md: 1.8, lg: 2 },
                  px: { xs: 2, sm: 3, md: 4 },
                  borderRadius: { xs: '12px', sm: '14px', md: '16px' },
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: { xs: '14px', sm: '15px', md: '18px', lg: '22px' },
                  minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '60px' },
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
                  py: { xs: 1.3, sm: 1.5, md: 1.8, lg: 2 },
                  px: { xs: 2, sm: 3, md: 4 },
                  borderRadius: { xs: '12px', sm: '14px', md: '16px' },
                  textTransform: 'none',
                  fontSize: { xs: '14px', sm: '15px', md: '18px', lg: '22px' },
                  minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '60px' },
                  borderWidth: { xs: '1px', sm: '1.5px', md: '2px' },
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
                py: { xs: 1.3, sm: 1.5, md: 1.8, lg: 2 },
                px: { xs: 2, sm: 3, md: 4 },
                borderRadius: { xs: '12px', sm: '14px', md: '16px' },
                textTransform: 'none',
                fontWeight: 700,
                fontSize: { xs: '14px', sm: '15px', md: '18px', lg: '22px' },
                minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '60px' },
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
            startIcon={isExpanded ? <ExpandLess sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 26 } }} /> : <ExpandMore sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 26 } }} />}
            onClick={handleCustomize}
            sx={{
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'none',
              py: { xs: 0.5, sm: 0.75, md: 1 },
              fontSize: { xs: '13px', sm: '14px', md: '15px', lg: '18px' },
              minHeight: { xs: '36px', sm: '40px', md: '44px', lg: '52px' },
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
            <Typography variant="caption" sx={{ 
              color: 'rgba(255, 255, 255, 0.4)', 
              textAlign: 'center',
              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.85rem', lg: '1.1rem' }
            }}>
              <Policy sx={{ fontSize: { xs: 12, sm: 13, md: 15, lg: 20 }, mr: 0.5, verticalAlign: 'middle' }} />
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
                  fontSize: { xs: '12px', sm: '13px', md: '14px', lg: '17px' },
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
                  fontSize: { xs: '12px', sm: '13px', md: '14px', lg: '17px' },
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
                  fontSize: { xs: '12px', sm: '13px', md: '14px', lg: '17px' },
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
                  fontSize: { xs: '12px', sm: '13px', md: '14px', lg: '17px' },
                  fontWeight: 500,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Kontakt personvernombud
              </Link>
            </Box>

            <Typography
              variant="caption"
              sx={{ 
                color: 'rgba(255, 255, 255, 0.3)', 
                textAlign: 'center', 
                fontSize: { xs: '10px', sm: '11px', md: '12px', lg: '15px' }
              }}
            >
              Behandlingsansvarlig: QAZI FOTOREEL • Org.nr: 833038222 • Personvernombud:{' '}
              {personvernombudEmail}
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Paper>
    </Box>
  );

  const manageConsentButton = !isVisible ? (
    <Button
      variant="outlined"
      onClick={() => {
        setIsExpanded(true);
        setIsVisible(true);
      }}
      sx={{
        position: 'fixed',
        left: { xs: 16, md: 24 },
        bottom: { xs: 16, md: 24 },
        zIndex: 9998,
        borderRadius: '999px',
        textTransform: 'none',
        borderColor: 'rgba(245, 158, 11, 0.35)',
        color: '#f59e0b',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 16px 38px rgba(15, 23, 42, 0.28)',
        px: 2,
        py: 1,
        fontWeight: 700,
        '&:hover': {
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(15, 23, 42, 0.96)',
        },
      }}
    >
      {hasSavedConsent ? 'Administrer cookies' : 'Velg cookies'}
    </Button>
  ) : null;

  return createPortal(
    <>
      {isVisible ? bannerContent : null}
      {manageConsentButton}
    </>,
    document.body,
  );
}

export default GdprNotice;
