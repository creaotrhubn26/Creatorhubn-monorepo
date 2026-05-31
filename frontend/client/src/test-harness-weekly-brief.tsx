/**
 * Test-harness for WeeklyBriefEditor E2E.
 *
 * URL-flagg:
 *   ?empty=true      Mount editor med tomt felt-sett (sjekker fallbacks)
 *   ?noqr=true       Setter qrUrl til tom streng (verifiserer QR-placeholder)
 *
 * Mounter editoren direkte uten å gå gjennom AdminRoom-stacken.
 * Spec'en kan dermed verifisere variant-bytte, card-edit, QR-generering
 * og PNG-eksport uten å dra inn hele admin-flowen.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline, Button } from '@mui/material';
import { WeeklyBriefEditor } from './components/role-room/marketing-templates/WeeklyBriefEditor';
import type { WeeklyBriefFields } from './components/role-room/marketing-templates/MarketingFeedPoster';

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
  const noQr = readFlag('noqr') === 'true';
  const [open, setOpen] = React.useState(true);

  const initialFields: Partial<WeeklyBriefFields> = empty
    ? { headline: '', cards: [], subheading: '', qrUrl: '' }
    : noQr
      ? { qrUrl: '' }
      : {};

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ padding: 32 }}>
        <h1 style={{ color: '#fff' }} data-testid="harness-title">
          Weekly Brief — E2E harness
        </h1>
        <Button
          data-testid="reopen-editor"
          variant="contained"
          onClick={() => setOpen(true)}
          sx={{ bgcolor: '#7c3aed', mt: 2 }}
        >
          Open editor
        </Button>
        <WeeklyBriefEditor
          open={open}
          initialFields={initialFields}
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
