import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import type {
  StoryboardSkillChange,
  StoryboardSkillContext,
} from '@shared/storyboard-skills';
import { StoryboardSkillsPanel } from './components/role-room/components/drawing/StoryboardSkillsPanel';

const initialContext: StoryboardSkillContext = {
  project: { id: 'project-e2e', title: 'Storyboard Skills E2E', cinemaFormat: '2.39:1' },
  scene: {
    id: 'scene-e2e',
    heading: 'INT. TOG — NATT',
    action: 'Nora løper gjennom toget og ser et troll i vinduet.',
    location: 'Tog',
    timeOfDay: 'NATT',
    characters: ['Nora'],
    dialogue: [{ lineNumber: 1, characterName: 'Nora', text: 'Det er bak oss.' }],
  },
  activeFrameId: 'frame-e2e',
  frames: [{
    id: 'frame-e2e',
    shotNumber: '1A',
    description: 'Nora ser seg tilbake.',
    shotType: 'MS',
    duration: 2,
    screenDirection: 'left-to-right',
  }],
};

function Harness() {
  const [context, setContext] = useState(initialContext);
  const [applied, setApplied] = useState<string[]>([]);
  const failedApplyOnce = useRef(false);

  const apply = async (changes: StoryboardSkillChange[]) => {
    if (new URLSearchParams(window.location.search).has('failApply') && !failedApplyOnce.current) {
      failedApplyOnce.current = true;
      throw new Error('simulert synkfeil');
    }
    setApplied((current) => [...current, ...changes.map((entry) => entry.id)]);
    setContext((current) => {
      let frames = current.frames.map((frame) => ({ ...frame }));
      for (const change of changes) {
        if (change.operation === 'update-frame' && change.frameId) {
          frames = frames.map((frame) => frame.id === change.frameId
            ? { ...frame, ...change.patch }
            : frame);
        }
        if (change.operation === 'create-frame') {
          frames.push({
            id: `created-${change.id}`,
            shotNumber: `${frames.length + 1}A`,
            description: change.patch.description ?? 'Nytt shot',
            ...change.patch,
          });
        }
      }
      return { ...current, frames };
    });
  };

  return (
    <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
      <CssBaseline />
      <main style={{ maxWidth: 980, margin: '24px auto', padding: 16 }}>
        <div data-testid="storyboard-skills-harness-ready">ready</div>
        <StoryboardSkillsPanel context={context} onApplyChanges={apply} />
        <pre data-testid="storyboard-skills-applied">{JSON.stringify(applied)}</pre>
        <pre data-testid="storyboard-skills-frames">{JSON.stringify(context.frames)}</pre>
      </main>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
