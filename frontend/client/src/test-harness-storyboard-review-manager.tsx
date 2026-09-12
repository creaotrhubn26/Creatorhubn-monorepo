import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import type { StoryboardSkillContext } from '@shared/storyboard-skills';
import { StoryboardReviewRoundsDialog } from './components/role-room/components/StoryboardReviewRoundsDialog';

function Harness() {
  const [baseline, setBaseline] = useState<StoryboardSkillContext['revisionBaseline']>();
  return (
    <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
      <CssBaseline />
      <div data-testid="storyboard-review-manager-ready">ready</div>
      <pre data-testid="storyboard-review-baseline">{JSON.stringify(baseline)}</pre>
      <StoryboardReviewRoundsDialog
        open
        projectId="project-e2e"
        manuscriptId="manuscript-e2e"
        sceneId="scene-e2e"
        onClose={() => undefined}
        onBaselineChange={setBaseline}
      />
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
