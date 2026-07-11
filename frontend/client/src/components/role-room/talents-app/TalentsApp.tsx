/**
 * TalentsApp.tsx — root for "The Role Room Talents"-appen.
 *
 * URL-mapping (?demo=1 bevares uansett):
 *   /talents          → Hjem (Dashboard)
 *   /talents/partners → Partners & Collaboration
 *   /talents/profiles → Min profil + onboarding-wizard
 *   /talents/audit    → Hvem har sett meg?
 *   /talents/settings → Innstillinger
 *
 * Phase 3 (Irlin-UX): defensive design — sidebar disabler ikke-ferdige
 * sider, alle handlinger har klar feedback, demo-modus er strengt isolert.
 */

import { Box, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import TalentsAppShell, { type TalentsAppPage } from './TalentsAppShell';
import PartnersCollaborationPage from './pages/PartnersCollaborationPage';
import PartnerInviteAcceptPage from './pages/PartnerInviteAcceptPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import AuditPage from './pages/AuditPage';
import SettingsPage from './pages/SettingsPage';
import TalentRegistryPage from './pages/TalentRegistryPage';
import TalentProposalAcceptPage from './pages/TalentProposalAcceptPage';
import AgencyPartnershipsPage from './pages/AgencyPartnershipsPage';
import SelfTapeStudioPage from './pages/SelfTapeStudioPage';
import { palette } from './theme';

const ROUTE_TO_PAGE: Record<string, TalentsAppPage> = {
  '': 'dashboard',
  'dashboard': 'dashboard',
  'hjem': 'dashboard',
  'registry': 'registry',
  'profiles': 'profiles',
  'profil': 'profiles',
  'selftapes': 'selftapes',
  'self-tapes': 'selftapes',
  'auditions': 'auditions',
  'partners': 'partners',
  'partnere': 'partners',
  'collaboration': 'partners',
  'audit': 'audit',
  'aktivitet': 'audit',
  'permissions': 'audit',  // legacy alias → audit
  'settings': 'settings',
  'innstillinger': 'settings',
  'partnerships': 'partnerships',
  'samarbeid': 'partnerships',
};

const PAGE_TO_ROUTE: Record<TalentsAppPage, string> = {
  dashboard: '',
  registry: 'registry',
  profiles: 'profiles',
  selftapes: 'self-tapes',
  auditions: 'auditions',
  partners: 'partners',
  audit: 'audit',
  permissions: 'audit',
  settings: 'settings',
  partnerships: 'partnerships',
};

/** Parse /talents/<segment> til en TalentsAppPage. */
export function parseTalentsAppPage(): TalentsAppPage | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  if (!path.startsWith('/talents')) return null;
  const segment = path.substring('/talents'.length).replace(/^\//, '');
  return ROUTE_TO_PAGE[segment] ?? 'dashboard';
}

/** Egen check for invite-accept-siden — full-screen uten shell. */
export function isPartnerInviteAcceptPath(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  return path === '/talents/partner-invite';
}

/** Reverse-consent: agency foreslår talent → talent åpner lenke. */
export function isTalentProposalAcceptPath(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  return path === '/talents/registry-invite';
}

export { PartnerInviteAcceptPage, TalentProposalAcceptPage };

interface TalentsAppProps {
  initialPage?: TalentsAppPage;
  onLogout?: () => void;
}

/**
 * CreatorHub Design (Fase C): token-driv Role Room-aksenten fra design-tokens
 * (ws=theroleroom). Bruker RÅ override (?raw=1) — ingen eksplisitt aksent → ingen
 * --rr-*-vars → literalene (lilla #a855f7) i theme.ts gjelder → identisk. Endres
 * aksenten i CreatorHub Design (The Role Room-workspace), re-farges Talents ved neste last.
 */
function useTalentsBrand() {
  useEffect(() => {
    let live = true;
    fetch('/api/design/tokens?ws=theroleroom&raw=1', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const hex = d && d.tokens && d.tokens.accent;
        if (!live || typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        const root = document.documentElement;
        root.style.setProperty('--rr-accent', hex);
        root.style.setProperty('--rr-border', `rgba(${r},${g},${b},0.18)`);
        root.style.setProperty('--rr-border-strong', `rgba(${r},${g},${b},0.32)`);
        root.style.setProperty('--rr-border-subtle', `rgba(${r},${g},${b},0.08)`);
        root.style.setProperty('--rr-filmstrip', `rgba(${r},${g},${b},0.06)`);
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);
}

export default function TalentsApp({ initialPage, onLogout }: TalentsAppProps) {
  const [page, setPage] = useState<TalentsAppPage>(initialPage ?? 'dashboard');
  useTalentsBrand(); // CreatorHub Design: Role Room-aksent fra design-tokens

  // Demo-modus: leses fra URL én gang ved mount + persisteres ved navigasjon
  const demoMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1',
    [],
  );

  // Synk URL ↔ state — historikk-knapp støtter.
  useEffect(() => {
    const sync = () => {
      const parsed = parseTalentsAppPage();
      if (parsed) setPage(parsed);
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const handleNavigate = useCallback((next: TalentsAppPage) => {
    setPage(next);
    const route = PAGE_TO_ROUTE[next];
    // Bevar ?demo=1 ved navigasjon (kritisk for at demo-state holder)
    const search = demoMode ? '?demo=1' : '';
    const newPath = route ? `/talents/${route}${search}` : `/talents${search}`;
    if (window.location.pathname + window.location.search !== newPath) {
      window.history.pushState({}, '', newPath);
    }
  }, [demoMode]);

  return (
    <TalentsAppShell active={page} onNavigate={handleNavigate} onLogout={demoMode ? undefined : onLogout}>
      {page === 'dashboard' ? (
        <DashboardPage demoMode={demoMode} onNavigate={handleNavigate} />
      ) : page === 'registry' ? (
        <TalentRegistryPage demoMode={demoMode} />
      ) : page === 'partners' ? (
        <PartnersCollaborationPage />
      ) : page === 'profiles' ? (
        <ProfilePage demoMode={demoMode} />
      ) : page === 'audit' || page === 'permissions' ? (
        <AuditPage demoMode={demoMode} />
      ) : page === 'settings' ? (
        <SettingsPage />
      ) : page === 'partnerships' ? (
        <AgencyPartnershipsPage />
      ) : page === 'selftapes' ? (
        <SelfTapeStudioPage demoMode={demoMode} />
      ) : (
        <ComingSoonPage page={page} />
      )}
    </TalentsAppShell>
  );
}

function ComingSoonPage({ page }: { page: TalentsAppPage }) {
  const titles: Record<TalentsAppPage, string> = {
    dashboard: 'Hjem',
    registry: 'Talent Registry',
    profiles: 'Min profil',
    selftapes: 'Self-Tape Studio',
    auditions: 'Auditions',
    partners: 'Partnere',
    audit: 'Hvem har sett meg?',
    permissions: 'Tilganger',
    settings: 'Innstillinger',
    partnerships: 'Partnerships',
  };
  const descriptions: Partial<Record<TalentsAppPage, string>> = {
    registry: 'Bla i andre talenter og bygg ditt nettverk. Kommer i Phase 4.',
    selftapes: 'Spille inn, redigere og dele self-tapes direkte. Kommer i Phase 4.',
    auditions: 'Kanban-oversikt over alle auditions du har søkt på. Kommer i Phase 4.',
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
      <Typography sx={{ color: palette.textMuted, fontSize: '0.95rem', maxWidth: 480, textAlign: 'center' }}>
        {descriptions[page] ?? 'Denne siden bygges i neste fase. Si fra hvis du vil vi skal prioritere den.'}
      </Typography>
    </Box>
  );
}
