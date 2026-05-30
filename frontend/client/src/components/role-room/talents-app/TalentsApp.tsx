/**
 * TalentsApp.tsx — root for "The Role Room Talents"-appen.
 *
 * Binder TalentsAppShell + active page sammen. URL-mapping:
 *   /talents          → dashboard (placeholder)
 *   /talents/partners → PartnersCollaborationPage (Phase 2 første ferdig-side)
 *   /talents/registry → placeholder (kommer i neste PR)
 *   ...
 *
 * Phase 2 plan: én side om gangen, etter mockup-spec og Daniels prioriteringsvalg.
 */

import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import TalentsAppShell, { type TalentsAppPage } from './TalentsAppShell';
import PartnersCollaborationPage from './pages/PartnersCollaborationPage';
import { palette } from './theme';

const ROUTE_TO_PAGE: Record<string, TalentsAppPage> = {
  '': 'dashboard',
  'dashboard': 'dashboard',
  'registry': 'registry',
  'profiles': 'profiles',
  'selftapes': 'selftapes',
  'self-tapes': 'selftapes',
  'auditions': 'auditions',
  'partners': 'partners',
  'collaboration': 'partners',
  'permissions': 'permissions',
  'settings': 'settings',
};

const PAGE_TO_ROUTE: Record<TalentsAppPage, string> = {
  dashboard: '',
  registry: 'registry',
  profiles: 'profiles',
  selftapes: 'self-tapes',
  auditions: 'auditions',
  partners: 'partners',
  permissions: 'permissions',
  settings: 'settings',
};

/** Parse /talents/<segment> til en TalentsAppPage. */
export function parseTalentsAppPage(): TalentsAppPage | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  if (!path.startsWith('/talents')) return null;
  const segment = path.substring('/talents'.length).replace(/^\//, '');
  return ROUTE_TO_PAGE[segment] ?? 'dashboard';
}

export default function TalentsApp({ initialPage }: { initialPage?: TalentsAppPage }) {
  const [page, setPage] = useState<TalentsAppPage>(initialPage ?? 'partners');

  // Synk URL ↔ state — historikk-knapp støtter.
  useEffect(() => {
    const sync = () => {
      const parsed = parseTalentsAppPage();
      if (parsed) setPage(parsed);
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const handleNavigate = (next: TalentsAppPage) => {
    setPage(next);
    const route = PAGE_TO_ROUTE[next];
    const newPath = route ? `/talents/${route}` : '/talents';
    if (window.location.pathname !== newPath) {
      window.history.pushState({}, '', newPath);
    }
  };

  return (
    <TalentsAppShell active={page} onNavigate={handleNavigate}>
      {page === 'partners' ? (
        <PartnersCollaborationPage />
      ) : (
        <ComingSoonPage page={page} />
      )}
    </TalentsAppShell>
  );
}

function ComingSoonPage({ page }: { page: TalentsAppPage }) {
  const titles: Record<TalentsAppPage, string> = {
    dashboard: 'Dashboard',
    registry: 'Talent Registry',
    profiles: 'Profiles',
    selftapes: 'Self-Tape Studio',
    auditions: 'Auditions',
    partners: 'Partners & Collaboration',
    permissions: 'Permissions',
    settings: 'Settings',
  };
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        flexDirection: 'column',
        gap: 1.4,
        color: palette.textSecondary,
        p: 4,
      }}
    >
      <Typography sx={{ color: palette.textPrimary, fontSize: '1.6rem', fontWeight: 800 }}>
        {titles[page]}
      </Typography>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.95rem' }}>
        Denne siden bygges i neste Phase 2-iterasjon. Følg mockup-rekkefølgen.
      </Typography>
    </Box>
  );
}
