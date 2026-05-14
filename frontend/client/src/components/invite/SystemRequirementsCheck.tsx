/**
 * SystemRequirementsCheck — kjører lokal sjekk mot kjente system-krav for
 * The Role Room-prototypen og rapporterer pass/warn/fail per kategori.
 *
 * Brukes i prototype-tester-onboarding så testere ser at deres miljø
 * faktisk kan kjøre prototypen før de tar tid på en feedback-runde.
 */

import { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Chip, Paper } from '@mui/material';
import {
  CheckCircle as PassIcon,
  WarningAmber as WarnIcon,
  Error as FailIcon,
  Memory as DeviceIcon,
} from '@mui/icons-material';

type Severity = 'pass' | 'warn' | 'fail';

interface RequirementResult {
  id: string;
  label: string;
  detail: string;
  severity: Severity;
}

interface SystemRequirementsCheckProps {
  /** Forelderen får hele rapport-objektet — kan sendes med søknad. */
  onReport?: (report: SystemRequirementsReport) => void;
}

export interface SystemRequirementsReport {
  userAgent: string;
  browserFamily: string;
  browserMajor: number | null;
  os: string;
  isMobile: boolean;
  isTouch: boolean;
  cookiesEnabled: boolean;
  localStorageAvailable: boolean;
  hasWebGL: boolean;
  viewportWidth: number;
  viewportHeight: number;
  results: RequirementResult[];
  overallSeverity: Severity;
  timestamp: string;
}

function detectBrowser(ua: string): { family: string; major: number | null } {
  // Edge må sjekkes før Chrome (Edge inneholder Chrome i UA).
  if (/Edg\/(\d+)/.test(ua)) return { family: 'Edge', major: Number(ua.match(/Edg\/(\d+)/)![1]) };
  if (/Chrome\/(\d+)/.test(ua) && !/Edg/.test(ua)) {
    return { family: 'Chrome', major: Number(ua.match(/Chrome\/(\d+)/)![1]) };
  }
  if (/Firefox\/(\d+)/.test(ua)) return { family: 'Firefox', major: Number(ua.match(/Firefox\/(\d+)/)![1]) };
  if (/Version\/(\d+).+Safari/.test(ua)) {
    return { family: 'Safari', major: Number(ua.match(/Version\/(\d+)/)![1]) };
  }
  return { family: 'Ukjent', major: null };
}

function detectOS(ua: string): string {
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows/.test(ua)) return 'Windows (eldre)';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS / iPadOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Ukjent';
}

function hasWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl' as never),
    );
  } catch {
    return false;
  }
}

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__rr_ls_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function buildReport(): SystemRequirementsReport {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const browser = detectBrowser(ua);
  const os = detectOS(ua);
  const isMobile = /Mobi|Android/i.test(ua);
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;
  const cookiesEnabled = typeof navigator !== 'undefined' && navigator.cookieEnabled;
  const localStorageAvailable = isLocalStorageAvailable();
  const hasWebGL = hasWebGLSupport();
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

  const results: RequirementResult[] = [];

  // Nettleser
  const browserMin: Record<string, number> = { Chrome: 110, Edge: 110, Firefox: 110, Safari: 16 };
  const minVersion = browserMin[browser.family];
  if (browser.major === null) {
    results.push({ id: 'browser', label: 'Nettleser', detail: 'Kunne ikke identifisere — anbefaler Chrome/Edge 110+, Safari 16+, Firefox 110+', severity: 'warn' });
  } else if (minVersion === undefined) {
    results.push({ id: 'browser', label: 'Nettleser', detail: `${browser.family} ${browser.major} — ikke testet. Anbefaler Chrome/Edge.`, severity: 'warn' });
  } else if (browser.major < minVersion) {
    results.push({ id: 'browser', label: 'Nettleser', detail: `${browser.family} ${browser.major} er for gammel. Krever ${browser.family} ${minVersion}+.`, severity: 'fail' });
  } else {
    results.push({ id: 'browser', label: 'Nettleser', detail: `${browser.family} ${browser.major} ✓`, severity: 'pass' });
  }

  // Skjermstørrelse — Role Room er optimalisert for desktop/iPad
  if (viewportWidth < 480) {
    results.push({ id: 'viewport', label: 'Skjermstørrelse', detail: `${viewportWidth}×${viewportHeight}px — telefon. Begrenset funksjon, anbefales tablet eller desktop for testing.`, severity: 'warn' });
  } else if (viewportWidth < 1024) {
    results.push({ id: 'viewport', label: 'Skjermstørrelse', detail: `${viewportWidth}×${viewportHeight}px — tablet. Full støtte men noen panels er trange.`, severity: 'pass' });
  } else {
    results.push({ id: 'viewport', label: 'Skjermstørrelse', detail: `${viewportWidth}×${viewportHeight}px ✓`, severity: 'pass' });
  }

  // localStorage er kritisk — appen cacher mye lokalt
  results.push(
    localStorageAvailable
      ? { id: 'storage', label: 'localStorage', detail: 'Tilgjengelig ✓', severity: 'pass' }
      : { id: 'storage', label: 'localStorage', detail: 'Ikke tilgjengelig — appen vil ikke fungere. Sjekk privat-/inkognito-modus eller cookies-policy.', severity: 'fail' },
  );

  // Cookies
  results.push(
    cookiesEnabled
      ? { id: 'cookies', label: 'Cookies', detail: 'Aktivert ✓', severity: 'pass' }
      : { id: 'cookies', label: 'Cookies', detail: 'Deaktivert — du blir logget ut hele tiden.', severity: 'fail' },
  );

  // WebGL trengs for storyboard-drawing-editor
  results.push(
    hasWebGL
      ? { id: 'webgl', label: 'WebGL', detail: 'Støttet ✓ — Storyboard-tegnemodul fungerer', severity: 'pass' }
      : { id: 'webgl', label: 'WebGL', detail: 'Ikke støttet — Storyboard-tegnemodul kan ha redusert funksjonalitet', severity: 'warn' },
  );

  const overallSeverity: Severity = results.some((r) => r.severity === 'fail')
    ? 'fail'
    : results.some((r) => r.severity === 'warn')
      ? 'warn'
      : 'pass';

  return {
    userAgent: ua,
    browserFamily: browser.family,
    browserMajor: browser.major,
    os,
    isMobile,
    isTouch,
    cookiesEnabled,
    localStorageAvailable,
    hasWebGL,
    viewportWidth,
    viewportHeight,
    results,
    overallSeverity,
    timestamp: new Date().toISOString(),
  };
}

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; icon: typeof PassIcon }> = {
  pass: { color: '#86efac', bg: 'rgba(34,197,94,0.12)', icon: PassIcon },
  warn: { color: '#fde68a', bg: 'rgba(245,158,11,0.14)', icon: WarnIcon },
  fail: { color: '#fca5a5', bg: 'rgba(239,68,68,0.16)', icon: FailIcon },
};

export const SystemRequirementsCheck = ({ onReport }: SystemRequirementsCheckProps) => {
  const [report, setReport] = useState<SystemRequirementsReport | null>(null);

  useEffect(() => {
    const next = buildReport();
    setReport(next);
    onReport?.(next);
  }, [onReport]);

  const overallConfig = useMemo(() => {
    return SEVERITY_CONFIG[report?.overallSeverity ?? 'pass'];
  }, [report?.overallSeverity]);

  if (!report) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 3 },
        border: `1px solid ${overallConfig.color}55`,
        bgcolor: 'rgba(15,23,42,0.5)',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <DeviceIcon sx={{ color: '#b86bff' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem' }}>
            System-krav
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
            {report.browserFamily} {report.browserMajor ?? ''} på {report.os} · {report.viewportWidth}×{report.viewportHeight}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={report.overallSeverity === 'pass' ? 'Alt OK' : report.overallSeverity === 'warn' ? 'Med advarsler' : 'Vil ikke fungere'}
          sx={{
            bgcolor: overallConfig.bg,
            color: overallConfig.color,
            fontWeight: 800,
          }}
        />
      </Stack>

      <Stack spacing={1}>
        {report.results.map((result) => {
          const config = SEVERITY_CONFIG[result.severity];
          const Icon = config.icon;
          return (
            <Box
              key={result.id}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.25,
                p: 1.25,
                bgcolor: config.bg,
                border: `1px solid ${config.color}44`,
                borderRadius: 1,
              }}
            >
              <Icon sx={{ color: config.color, fontSize: 20, mt: 0.2, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.86rem', color: '#fff' }}>
                  {result.label}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.78)', mt: 0.25 }}>
                  {result.detail}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
};

export default SystemRequirementsCheck;
