/**
 * RoleRoomGdprNotice.tsx — dedikert consent-banner for theroleroom.com
 *
 * BAKGRUNN: GA4 (G-9T7K5TJVFX) lastes KUN etter at analytics-consent er gitt
 * (consent-mode v2, default denied — se inline-bootstrap i theroleroom-root.html
 * / index.html). Det eneste som gir samtykke er et consent-banner som kaller
 * `window.__creatorhubApplyConsent` + `window.__creatorhubLoadAnalytics`.
 *
 * Den eksisterende `common/GdprNotice` (amber, "CreatorHub Norge") rendres KUN
 * på creatorhub-flatene — ALDRI på casting-main-hosten som serverer
 * theroleroom.com → derfor fikk GA null trafikk. Denne komponenten er Role
 * Room-versjonen (lilla branding, egne /privacy + /terms), men bruker NØYAKTIG
 * samme consent-kontrakt som common/GdprNotice slik at GA lastes.
 *
 * Mountes i casting-main (CastingStandaloneApp).
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Link,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CookieOutlinedIcon from '@mui/icons-material/CookieOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined';
import { applyMarketingConsent } from '@/lib/marketingPixelsRuntime';

interface CookieConsentSettings {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

// window.__creatorhubApplyConsent / __creatorhubLoadAnalytics er allerede globalt
// deklarert i lib/googleAnalyticsRuntime.ts (med AnalyticsConsentSettings, samme
// strukturelle form) — derfor ingen ny `declare global` her.

const palette = {
  bgCard: 'rgba(21, 11, 46, 0.96)',
  border: 'rgba(168, 85, 247, 0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: 'rgba(196, 181, 253, 0.85)',
  textMuted: 'rgba(139, 126, 196, 0.85)',
  accentBright: '#c084fc',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

const DEFAULT_SETTINGS: CookieConsentSettings = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

const CONTACT_EMAIL = 'hello@creatorhubn.com';

function normalize(value: unknown): CookieConsentSettings | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as Partial<CookieConsentSettings>;
  return {
    necessary: c.necessary !== false,
    analytics: c.analytics === true,
    marketing: c.marketing === true,
    preferences: c.preferences === true,
  };
}

/** Speiler common/GdprNotice.syncAnalyticsConsent — dette er det som laster GA. */
function syncConsent(settings: CookieConsentSettings) {
  if (typeof window === 'undefined') return;
  if (typeof window.__creatorhubApplyConsent === 'function') {
    window.__creatorhubApplyConsent(settings);
  }
  if (settings.analytics && typeof window.__creatorhubLoadAnalytics === 'function') {
    window.__creatorhubLoadAnalytics(settings);
  }
  try {
    applyMarketingConsent(settings);
  } catch {
    /* best-effort */
  }
}

function persist(settings: CookieConsentSettings, method: string) {
  const date = new Date().toISOString();
  try {
    localStorage.setItem('gdpr-consent', JSON.stringify(settings));
    localStorage.setItem('gdpr-consent-date', date);
    localStorage.setItem(
      'gdpr-consent-details',
      JSON.stringify({ consentMethod: method, settings, userAgent: navigator.userAgent, timestamp: date, version: '1.0', surface: 'role_room' }),
    );
  } catch {
    /* ignore storage failures */
  }
  // Best-effort server-lagring (no-op for uautentiserte landing-besøkende).
  fetch('/api/user/kv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ key: 'gdpr_consent', value: { settings, date, method } }),
  }).catch(() => {});
}

const CATEGORY = {
  analytics: {
    label: 'Analyse',
    color: '#60a5fa',
    title: 'Analysecookies',
    desc: 'Google Analytics (GA4) for å forstå hvordan besøkende bruker The Role Room. Hjelper oss å forbedre produktet. Ingen salg av data til tredjepart.',
    meta: 'Tjeneste: Google Analytics • Lagring: 2 år • Overføring: EU/EØS og USA',
  },
  marketing: {
    label: 'Markedsføring',
    color: '#d946ef',
    title: 'Markedsføringscookies',
    desc: 'For å måle effekten av kampanjer og vise relevant innhold (Google Ads, Meta, TikTok). Brukes til å forstå hvilke kanaler som fungerer.',
    meta: 'Tjenester: Google Ads, Meta, TikTok • Lagring: 1–2 år • Grunnlag: Samtykke',
  },
  preferences: {
    label: 'Preferanser',
    color: '#a855f7',
    title: 'Preferansecookies',
    desc: 'Husker valgene dine (språk, visning) for å tilpasse opplevelsen.',
    meta: 'Lagring: 1 år • Grunnlag: Berettiget interesse',
  },
} as const;

export default function RoleRoomGdprNotice() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [settings, setSettings] = useState<CookieConsentSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem('gdpr-consent');
      const dateRaw = localStorage.getItem('gdpr-consent-date');
      const parsed = raw ? normalize(JSON.parse(raw)) : null;
      if (parsed && dateRaw) {
        setSettings(parsed);
        setHasSaved(true);
        syncConsent(parsed); // re-apply ved retur så GA lastes uten ny klikk
        // Vis på nytt hvis samtykket er eldre enn ett år.
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        setVisible(new Date(dateRaw) < oneYearAgo);
      } else {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const commit = (next: CookieConsentSettings, method: string) => {
    setSettings(next);
    persist(next, method);
    syncConsent(next);
    setHasSaved(true);
    setVisible(false);
  };

  const acceptAll = () => commit({ necessary: true, analytics: true, marketing: true, preferences: true }, 'accept_all');
  const rejectAll = () => commit({ necessary: true, analytics: false, marketing: false, preferences: false }, 'reject_all');
  const saveCustom = () => commit(settings, 'custom');

  if (!mounted) return null;

  const fieldRow = (key: keyof typeof CATEGORY) => {
    const c = CATEGORY[key];
    return (
      <Box sx={{ p: 1.6, borderRadius: '10px', bgcolor: `${c.color}14`, border: `1px solid ${c.color}33` }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
          <Typography sx={{ fontWeight: 700, color: c.color, fontSize: '0.9rem' }}>{c.title}</Typography>
          <Switch
            checked={settings[key]}
            onChange={(e) => setSettings((p) => ({ ...p, [key]: e.target.checked }))}
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: c.color },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: c.color },
            }}
          />
        </Stack>
        <Typography sx={{ color: palette.textSecondary, fontSize: '0.78rem', lineHeight: 1.5, mb: 0.4 }}>{c.desc}</Typography>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.68rem' }}>{c.meta}</Typography>
      </Box>
    );
  };

  const banner = (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 16, md: 24 },
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'calc(100% - 32px)',
        maxWidth: { xs: '100%', sm: 600, md: 680 },
        pointerEvents: 'none',
      }}
    >
      <Paper
        elevation={8}
        sx={{
          width: '100%',
          borderRadius: 3,
          background: palette.bgCard,
          backgroundImage: 'none',
          backdropFilter: 'blur(24px)',
          border: `1px solid ${palette.border}`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(168,85,247,0.12)',
          pointerEvents: 'auto',
          p: { xs: 2.2, sm: 3 },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 44, height: 44, borderRadius: '12px', background: palette.accentGradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                boxShadow: '0 4px 15px rgba(168,85,247,0.3)',
              }}
            >
              <CookieOutlinedIcon />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, color: palette.textPrimary, fontSize: '1.1rem' }}>
                Personvern og cookies
              </Typography>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>The Role Room</Typography>
            </Box>
          </Stack>
          <IconButton onClick={() => setVisible(false)} size="small" aria-label="Lukk" sx={{ color: palette.textMuted, '&:hover': { color: palette.accentBright } }}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Typography sx={{ color: palette.textSecondary, fontSize: '0.88rem', lineHeight: 1.65, mb: 1.6 }}>
          <strong style={{ color: palette.textPrimary }}>Vi respekterer personvernet ditt.</strong> The Role Room bruker
          cookies. Nødvendige cookies kreves for at tjenesten skal fungere — øvrige er valgfrie og krever ditt samtykke.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {(['Nødvendige', 'Analyse', 'Markedsføring', 'Preferanser'] as const).map((label, i) => (
            <Chip
              key={label}
              label={label}
              size="small"
              sx={{
                bgcolor: i === 0 ? 'rgba(52,211,153,0.18)' : 'rgba(168,85,247,0.12)',
                color: i === 0 ? '#34d399' : palette.accentBright,
                fontWeight: 600, fontSize: '0.7rem',
                border: `1px solid ${i === 0 ? 'rgba(52,211,153,0.3)' : palette.border}`,
              }}
            />
          ))}
        </Stack>

        <Collapse in={expanded}>
          <Stack spacing={1.4} sx={{ mb: 2 }}>
            <Box sx={{ p: 1.6, borderRadius: '10px', bgcolor: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Typography sx={{ fontWeight: 700, color: '#34d399', fontSize: '0.9rem' }}>Nødvendige cookies</Typography>
                <Switch checked disabled sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#34d399' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#34d399' } }} />
              </Stack>
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.78rem', lineHeight: 1.5 }}>
                Kreves for innlogging, sikkerhet og grunnleggende funksjonalitet. Kan ikke deaktiveres.
              </Typography>
            </Box>
            {fieldRow('analytics')}
            {fieldRow('marketing')}
            {fieldRow('preferences')}
          </Stack>
        </Collapse>

        <Stack spacing={1.4}>
          {!expanded ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
              <Button
                onClick={acceptAll}
                sx={{
                  flex: 1, background: palette.accentGradient, color: '#fff', textTransform: 'none',
                  fontWeight: 700, py: 1.3, borderRadius: 2, fontSize: '0.95rem',
                  '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                }}
              >
                Godta alle
              </Button>
              <Button
                onClick={rejectAll}
                variant="outlined"
                sx={{
                  flex: 1, color: palette.textSecondary, borderColor: palette.border, textTransform: 'none',
                  fontWeight: 700, py: 1.3, borderRadius: 2, fontSize: '0.95rem',
                  '&:hover': { borderColor: palette.accentBright, bgcolor: 'rgba(168,85,247,0.08)' },
                }}
              >
                Kun nødvendige
              </Button>
            </Stack>
          ) : (
            <Button
              onClick={saveCustom}
              sx={{
                background: palette.accentGradient, color: '#fff', textTransform: 'none',
                fontWeight: 700, py: 1.3, borderRadius: 2, fontSize: '0.95rem',
                '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
              }}
            >
              Lagre mine valg
            </Button>
          )}
          <Button
            variant="text"
            startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setExpanded((v) => !v)}
            sx={{ color: palette.textMuted, textTransform: 'none', fontSize: '0.82rem', '&:hover': { color: palette.accentBright } }}
          >
            {expanded ? 'Skjul innstillinger' : 'Tilpass cookie-innstillinger'}
          </Button>
        </Stack>

        <Box sx={{ mt: 1.6, pt: 1.6, borderTop: `1px solid ${palette.border}` }}>
          <Stack direction="row" justifyContent="center" spacing={2} sx={{ flexWrap: 'wrap', gap: 1, mb: 0.8 }}>
            {[
              { label: 'Personvern', href: '/privacy' },
              { label: 'Vilkår', href: '/terms' },
              { label: 'Kontakt personvernombud', href: `mailto:${CONTACT_EMAIL}` },
            ].map((l) => (
              <Link key={l.href} href={l.href} sx={{ color: palette.accentBright, textDecoration: 'none', fontSize: '0.76rem', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>
                {l.label}
              </Link>
            ))}
          </Stack>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.66rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            <PolicyOutlinedIcon sx={{ fontSize: 13 }} />
            Behandlingsansvarlig: Creatorhub AS — du kan når som helst trekke tilbake samtykket.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );

  const manageButton = !visible ? (
    <Button
      onClick={() => { setExpanded(true); setVisible(true); }}
      variant="outlined"
      sx={{
        position: 'fixed', left: { xs: 12, md: 20 }, bottom: { xs: 12, md: 20 }, zIndex: 9998,
        borderRadius: '999px', textTransform: 'none', fontWeight: 700, px: 2, py: 0.8,
        color: palette.accentBright, borderColor: palette.border,
        bgcolor: 'rgba(10,1,24,0.9)', backdropFilter: 'blur(12px)',
        '&:hover': { borderColor: palette.accentBright, bgcolor: 'rgba(10,1,24,0.96)' },
      }}
    >
      {hasSaved ? 'Administrer cookies' : 'Velg cookies'}
    </Button>
  ) : null;

  return createPortal(
    <>
      {visible ? banner : null}
      {manageButton}
    </>,
    document.body,
  );
}
