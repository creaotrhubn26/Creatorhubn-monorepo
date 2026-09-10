import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';

import { ScreenplayEditor } from './components/role-room/components/ScreenplayEditor';

const theme = createTheme({ palette: { mode: 'dark' } });
const longOpening = Array.from({ length: 120 }, (_, index) => `Action line ${index + 1}`).join('\n');

function ScreenplayEditorHarness() {
  const [value, setValue] = useState(`${longOpening}\n\n`);
  const [characters, setCharacters] = useState(['NORA', 'ANDREAS']);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ width: 960, height: 720, p: 2 }}>
        <ScreenplayEditor
          value={value}
          onChange={setValue}
          manuscriptId="screenplay-e2e-manuscript"
          cloudSaveState="saved"
          cloudSaveLabel="Lagret 12:00:00"
          characters={characters}
          locations={['NATURHISTORISK MUSEUM', 'DOVREFJELL']}
          roles={[{
            id: 'role-nora',
            name: 'NORA',
            description: 'Testrolle',
            requirements: {},
            status: 'draft',
          }]}
          onCharacterAdd={(name) => {
            if (name === 'FAILME') return false;
            setCharacters((current) => Array.from(new Set([...current, name.toUpperCase()])));
            return true;
          }}
        />
      </Box>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<ScreenplayEditorHarness />);
