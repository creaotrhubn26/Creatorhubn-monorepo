/**
 * Test-harness for CastingCallPosterPanel E2E.
 *
 * URL-flagg:
 *   ?role=<id>       Override rolle-ID (default: e2e-role-1)
 *   ?empty=true      Mount panelet med tomt source (sjekker default-state)
 *
 * Mounter panelet direkte uten å gå gjennom RoleManagementPanel-stacken.
 * Spec'en kan dermed verifisere variant-bytte, edit-flyt og PNG-eksport
 * uten å dra inn hele dashboard-flowen.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline, Button } from '@mui/material';
import { CastingCallPosterPanel } from './components/role-room/casting-call/CastingCallPosterPanel';
import type { CastingCallPosterSource } from './components/role-room/casting-call/CastingCallPosterPanel';

const theme = createTheme({ palette: { mode: 'dark' } });

function readFlag(name: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

function E2EHarness() {
  const empty = readFlag('empty') === 'true';
  const roleId = readFlag('role') ?? 'e2e-role-1';
  const [open, setOpen] = React.useState(true);

  const source: CastingCallPosterSource = empty
    ? { roleName: '' }
    : {
        roleName: 'Lead Actor (Male)',
        productionName: 'Nordlys',
        format: 'Feature film',
        genre: 'Drama',
        ageRange: '25-35',
        location: 'Tromsø, Norway',
        auditionDeadline: '24 oktober',
        status: 'Verified casting',
        quote: 'Vi søker en sterk og troverdig hovedrolle til et karakterdrevet drama satt i Nord-Norge.',
        applyUrl: `https://creatorhubn.com/r/${roleId}`,
      };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ padding: 32 }}>
        <h1 style={{ color: '#fff' }} data-testid="harness-title">
          Casting Call Poster — E2E harness
        </h1>
        <Button
          data-testid="reopen-panel"
          variant="contained"
          onClick={() => setOpen(true)}
          sx={{ bgcolor: '#7c3aed', mt: 2 }}
        >
          Open panel
        </Button>
        <CastingCallPosterPanel
          open={open}
          source={source}
          onClose={() => setOpen(false)}
        />
      </div>
    </ThemeProvider>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<E2EHarness />);
}
