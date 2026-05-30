/**
 * Test-harness for MarketingPlanWorkspace — brukes av Playwright-spec
 * marketing-plan-workspace.spec.ts. Mounter Power BI-aktig dashboard
 * med en placeholder-projectId; alle backend-kall mockes via Playwright
 * route()-interception.
 *
 * Konvensjon: bruk `[data-testid="*"]`-attributter for stabile selectors.
 */

import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline, Box, Typography } from '@mui/material';
import MarketingPlanWorkspace from './components/role-room/components/producer/MarketingPlanWorkspace';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0b1226', paper: '#0f172a' },
  },
});

function TestHarness(): React.ReactElement {
  const [advancedEditorOpens, setAdvancedEditorOpens] = useState(0);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        data-testid="marketing-plan-workspace-root"
        sx={{ p: 2, minHeight: '100vh', bgcolor: '#0b1226' }}
      >
        {/* Synlig counter for å verifisere at "Endre plan"-knappen
            faktisk kaller onOpenAdvancedEditor. */}
        <Typography data-testid="advanced-editor-opens" sx={{ color: '#fff', mb: 1, fontSize: 12 }}>
          advanced-editor-opens: {advancedEditorOpens}
        </Typography>
        <MarketingPlanWorkspace
          projectId="test-project-001"
          onOpenAdvancedEditor={() => setAdvancedEditorOpens(n => n + 1)}
        />
      </Box>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TestHarness />
  </React.StrictMode>,
);
