import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';

import { ScreenplayEditorWithNavigator } from './components/role-room/components/ScreenplayEditorWithNavigator';
import authSessionService from './components/role-room/services/authSessionService';

const theme = createTheme({ palette: { mode: 'dark' } });
const initialScript = [
  'INT. HYTTE - NATT',
  '',
  'NORA',
  'Det er bare vinden.',
  '',
  'ANDREAS',
  'Nei. Hør.',
].join('\n');

function ScreenplayCommentsHarness() {
  const [value, setValue] = useState(initialScript);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ width: '100vw', height: '100vh' }}>
        <ScreenplayEditorWithNavigator
          value={value}
          onChange={setValue}
          projectId="project-comments-e2e"
          manuscriptId="manuscript-comments-e2e"
          currentUserRole="director"
          lockState="final"
          scriptTitle="Kommentar-test"
          showLineNumbers
          enableSpellcheck={false}
        />
      </Box>
    </ThemeProvider>
  );
}

async function bootstrap() {
  await authSessionService.loadSession();
  ReactDOM.createRoot(document.getElementById('root')!).render(<ScreenplayCommentsHarness />);
}

void bootstrap();
