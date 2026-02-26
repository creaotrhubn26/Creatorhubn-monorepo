import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme, Box, Typography, Chip, Stack } from '@mui/material';
import { FrameDrawingEditor } from './components/role-room/components/FrameDrawingEditor';
import type { FrameDrawingData } from './components/role-room/state/storyboardStore';

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function DrawingHarness() {
  const [saveCount, setSaveCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastImageLength, setLastImageLength] = useState<number>(0);

  const handleSave = (drawingData: FrameDrawingData, imageDataUrl: string) => {
    setSaveCount((prev) => prev + 1);
    setLastSavedAt(drawingData.updatedAt);
    setLastImageLength(imageDataUrl.length);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ width: '100vw', height: '100vh', bgcolor: '#0a1020', p: 2, boxSizing: 'border-box' }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
          <Typography variant="body2">Drawing Harness</Typography>
          <Chip label={`Save Count: ${saveCount}`} size="small" color="primary" />
          <Chip label={`Image Bytes: ${lastImageLength}`} size="small" variant="outlined" />
          <Chip label={`Last Saved: ${lastSavedAt ?? 'never'}`} size="small" variant="outlined" />
        </Stack>
        <FrameDrawingEditor
          frameId="frame-e2e-1"
          storyboardId="storyboard-e2e-1"
          mode="inline"
          proMode={true}
          aspectRatio="16:9"
          onSave={handleSave}
        />
      </Box>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DrawingHarness />
  </React.StrictMode>
);

