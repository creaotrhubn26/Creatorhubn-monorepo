import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { StoryboardBoardPage } from './components/role-room/components/StoryboardBoardPage';

const theme = createTheme({ palette: { mode: 'dark' } });

const initialFrame = {
  id: 'editable-panel',
  shotNumber: '1A',
  description: 'Editable panel image',
  imageUrl: '/test-assets/storyboard-noir-reference.svg',
  thumbnailUrl: '/test-assets/storyboard-noir-reference.svg',
  duration: 2,
  drawingData: {
    strokes: '[]',
    width: 1920,
    height: 1080,
  },
};

const StoryboardBoardHarness = () => {
  const [frames, setFrames] = useState([initialFrame]);

  const patchFrame = (frameId: string, patch: Record<string, unknown>) => {
    setFrames((current) => current.map((frame) => (
      frame.id === frameId ? { ...frame, ...patch } : frame
    )));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <output data-testid="board-harness-strokes" hidden>
        {frames[0].drawingData.strokes}
      </output>
      <div data-testid="board-harness-ready">
        <StoryboardBoardPage
          projectName="E2E Project"
          sequenceLabel="Editable panels"
          sceneItems={[{ id: 'scene-1', heading: 'INT. TEST – DAY', shotCount: 1 }]}
          selectedSceneId="scene-1"
          frames={frames}
          activeFrameIndex={0}
          onSelectFrame={() => undefined}
          onPatchFrame={patchFrame}
          onDrawFrame={() => undefined}
          onAddFrame={() => undefined}
          onClose={() => undefined}
        />
      </div>
    </ThemeProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<StoryboardBoardHarness />);
