import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';

import { ScreenplayEditor } from './components/role-room/components/ScreenplayEditor';

const theme = createTheme({ palette: { mode: 'dark' } });
const longOpening = Array.from({ length: 120 }, (_, index) => `Action line ${index + 1}`).join('\n');

function ScreenplayEditorHarness() {
  const [value, setValue] = useState(`${longOpening}\n\n`);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ width: 960, height: 720, p: 2 }}>
        <ScreenplayEditor
          value={value}
          onChange={setValue}
          characters={['NORA', 'ANDREAS']}
          locations={['NATURHISTORISK MUSEUM', 'DOVREFJELL']}
        />
      </Box>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<ScreenplayEditorHarness />);
