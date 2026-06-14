// SuperAdminAdminRoomShell.tsx
// ─────────────────────────────────────────────────────────────────────────
// Wrapper rundt <AdminRoom /> som rendres på den dedikerte /admin-room-
// ruten (Super Admin entry point). Hovedformål:
//
//   1) Email-gate her i tillegg (defense in depth) — vi vil aldri at
//      noen kan POST'e til /admin-room med en gjettet URL og lande på
//      Daniels dashboard.
//
//   2) Les `superAdmin:targetAdminRoomTab` fra sessionStorage og dispatch
//      den til AdminRoom via URL-param `?adminTab=…`. AdminRoom-shellen
//      lytter ikke til sessionStorage selv (vi vil ikke endre den der),
//      så hooken ligger her: vi normaliserer URL'en før mount, slik at
//      eventuell custom shell vi måtte legge på senere kan lese den.
//
//   3) Vis Super Admin-overlay'en ETTER mount slik at Daniel kan hoppe
//      mellom AdminRoom-tabs eller tilbake til Role Room-prosjektrom.
//
// Komponenten leier inn `AdminRoom` ved lazy import — det er en tung side
// (CMS-editor, alle tabber), så vi vil ikke betale kostnaden på vanlige
// Role Room-loads.
// ─────────────────────────────────────────────────────────────────────────

import React, { lazy, Suspense, useEffect } from 'react';
import { Box, CircularProgress, Container, Typography } from '@mui/material';

import { useSuperAdminGate, SUPER_ADMIN_OWNER_EMAIL } from './useSuperAdminGate';
import { SUPER_ADMIN_TARGET_TAB_KEY } from './SuperAdminOverlay';

const AdminRoom = lazy(() => import('../../../../pages/AdminRoom'));

const GOLD = '#fbbf24';

// Sjekk om current path er /admin-room (med valgfri trailing slash).
export function isSuperAdminAdminRoomPath(): boolean {
  if (typeof window === 'undefined') return false;
  const path = (window.location.pathname || '').toLowerCase();
  return path === '/admin-room' || path === '/admin-room/';
}

const SuperAdminAdminRoomShell: React.FC = () => {
  const { isSuperAdmin, email, ready } = useSuperAdminGate();

  // Hvis URL har ?adminTab=… så lagre i sessionStorage så AdminRoom (eller
  // en framtidig versjon av den) kan finne ønsket tab. Hvis sessionStorage
  // ALLEREDE har en target (satt av SuperAdminOverlay-klikk), hopper vi
  // over og ber AdminRoom selv håndtere det.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const adminTab = params.get('adminTab');
      if (adminTab && adminTab.trim().length > 0) {
        sessionStorage.setItem(SUPER_ADMIN_TARGET_TAB_KEY, adminTab.trim());
      }
    } catch {
      // Ignore — uten target faller AdminRoom tilbake til 'dashboard'.
    }
  }, []);

  if (!ready) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#050816' }}>
        <CircularProgress size={28} sx={{ color: GOLD }} />
      </Box>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, color: 'rgba(255,255,255,0.92)' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Super Admin
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.62)' }}>
          Denne flaten er kun for produkteier ({SUPER_ADMIN_OWNER_EMAIL}). Du er innlogget som <code>{email || '(ingen)'}</code>.
        </Typography>
      </Container>
    );
  }

  return (
    <Suspense
      fallback={
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#050816' }}>
          <CircularProgress size={28} sx={{ color: GOLD }} />
        </Box>
      }
    >
      <AdminRoom />
    </Suspense>
  );
};

export default SuperAdminAdminRoomShell;
