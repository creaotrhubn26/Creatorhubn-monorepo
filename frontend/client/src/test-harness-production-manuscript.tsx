import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

import { ProductionManuscriptView } from './components/role-room/components/ProductionManuscriptView';
import type {
  Act,
  CastingProject,
  DialogueLine,
  Manuscript,
  SceneBreakdown,
} from './components/role-room/models/casting';

const PROJECT_ID = 'pmv-e2e-project';
const MANUSCRIPT_ID = 'pmv-e2e-manuscript';

const now = '2026-04-14T09:00:00.000Z';

const initialScenes: SceneBreakdown[] = [
  {
    id: 'pmv-scene-1',
    projectId: PROJECT_ID,
    manuscriptId: MANUSCRIPT_ID,
    actId: 'pmv-act-1',
    sceneNumber: 1,
    sceneHeading: 'INT. KITCHEN - MORNING',
    locationName: 'Kitchen',
    intExt: 'INT',
    timeOfDay: 'MORNING',
    pageLength: 1.25,
    estimatedDuration: 4,
    description: 'A chef prepares the opening dish before the restaurant wakes up.',
    characters: ['CHEF', 'PRODUCER'],
    metadata: {
      camera: 'Sony FX6',
      lens: '35mm',
      equipment: ['Softbox', 'Boom Mic'],
      shotType: 'Medium',
    },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'pmv-scene-2',
    projectId: PROJECT_ID,
    manuscriptId: MANUSCRIPT_ID,
    actId: 'pmv-act-1',
    sceneNumber: 2,
    sceneHeading: 'EXT. STREET - DAY',
    locationName: 'Main Street',
    intExt: 'EXT',
    timeOfDay: 'DAY',
    pageLength: 0.75,
    estimatedDuration: 3,
    description: 'Guests arrive and the brand presence is established from outside.',
    characters: ['GUEST'],
    metadata: {
      camera: 'Canon R5 C',
      lens: '24mm',
      equipment: ['Gimbal'],
      shotType: 'Wide',
    },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'pmv-scene-3',
    projectId: PROJECT_ID,
    manuscriptId: MANUSCRIPT_ID,
    actId: 'pmv-act-2',
    sceneNumber: 3,
    sceneHeading: 'INT. TABLE - DAY',
    locationName: 'Dining Table',
    intExt: 'INT',
    timeOfDay: 'DAY',
    pageLength: 1,
    estimatedDuration: 5,
    description: 'A final table moment ties the story and client offer together.',
    characters: ['CHEF', 'GUEST'],
    metadata: {
      camera: 'Sony FX3',
      lens: '50mm',
      equipment: ['LED Panel'],
      shotType: 'Close-up',
    },
    createdAt: now,
    updatedAt: now,
  },
];

const manuscript: Manuscript = {
  id: MANUSCRIPT_ID,
  projectId: PROJECT_ID,
  title: 'PMV E2E Restaurant Film',
  content: 'A compact manuscript used for direct ProductionManuscriptView tests.',
  status: 'draft',
  version: '1.0',
  format: 'fountain',
  pageCount: 3,
  wordCount: 420,
  language: 'nb',
  createdAt: now,
  updatedAt: now,
};

const acts: Act[] = [
  {
    id: 'pmv-act-1',
    projectId: PROJECT_ID,
    manuscriptId: MANUSCRIPT_ID,
    title: 'Act 1',
    actNumber: 1,
    summary: 'Restaurant launch setup.',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'pmv-act-2',
    projectId: PROJECT_ID,
    manuscriptId: MANUSCRIPT_ID,
    title: 'Act 2',
    actNumber: 2,
    summary: 'Restaurant payoff.',
    createdAt: now,
    updatedAt: now,
  },
];

const dialogueLines: DialogueLine[] = [
  {
    id: 'pmv-line-1',
    manuscriptId: MANUSCRIPT_ID,
    sceneId: 'pmv-scene-1',
    characterName: 'CHEF',
    dialogueText: 'Vi åpner med håndverk, ikke med støy.',
    lineNumber: 1,
  },
  {
    id: 'pmv-line-2',
    manuscriptId: MANUSCRIPT_ID,
    sceneId: 'pmv-scene-1',
    characterName: 'PRODUCER',
    dialogueText: 'Da holder vi kameraet tett på prosessen.',
    lineNumber: 2,
  },
  {
    id: 'pmv-line-3',
    manuscriptId: MANUSCRIPT_ID,
    sceneId: 'pmv-scene-2',
    characterName: 'GUEST',
    dialogueText: 'Det føles som et sted vi allerede kjenner.',
    lineNumber: 3,
  },
];

export const productionManuscriptE2EProject: CastingProject = {
  id: PROJECT_ID,
  name: 'PMV E2E Project',
  clientName: 'Holy Crust',
  clientEmail: 'client@example.com',
  status: 'active',
  roles: [
    { id: 'role-chef', name: 'CHEF', description: 'Lead chef' },
    { id: 'role-guest', name: 'GUEST', description: 'Guest' },
  ],
  candidates: [
    {
      id: 'candidate-chef',
      name: 'E2E Chef',
      status: 'confirmed',
      assignedRoles: ['role-chef'],
      contactInfo: { email: 'chef@example.com', phone: '+47 400 00 001' },
      photos: [],
    },
  ],
  crew: [],
  schedules: [],
  locations: [],
  props: [],
  productionDays: [],
  shotLists: [
    {
      id: 'pmv-shot-list-1',
      projectId: PROJECT_ID,
      sceneId: 'pmv-scene-1',
      sceneName: 'Kitchen',
      shots: [
        {
          id: 'pmv-shot-1',
          sceneId: 'pmv-scene-1',
          shotType: 'Medium',
          cameraAngle: 'Eye Level',
          cameraMovement: 'Static',
          description: 'Chef hands prepare the opening dish',
          duration: 5,
          imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22225%22%3E%3Crect width=%22400%22 height=%22225%22 fill=%22%233b82f6%22/%3E%3C/svg%3E',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'pmv-shot-2',
          sceneId: 'pmv-scene-1',
          shotType: 'Close-up',
          cameraAngle: 'Eye Level',
          cameraMovement: 'Static',
          description: 'Knife detail lands on the final garnish',
          duration: 4,
          imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22225%22%3E%3Crect width=%22400%22 height=%22225%22 fill=%22%23f97316%22/%3E%3C/svg%3E',
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ],
  sceneBreakdowns: initialScenes,
  createdAt: now,
  updatedAt: now,
};

declare global {
  interface Window {
    __productionManuscriptE2EProject?: CastingProject;
    __productionManuscriptE2EScenes?: SceneBreakdown[];
  }
}

const theme = createTheme({
  palette: { mode: 'dark' },
});

const seedAuth = () => {
  const user = {
    id: 'pmv-e2e-admin',
    email: 'pmv-e2e@example.com',
    name: 'PMV E2E Admin',
    role: 'admin',
    isAdmin: true,
  };
  window.localStorage.setItem('creatorhub_auth_token', 'pmv-e2e-token');
  window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
  window.localStorage.setItem('role_room_auth_token', 'pmv-e2e-role-room-token');
  window.localStorage.setItem('role_room_auth_session', JSON.stringify({
    token: 'pmv-e2e-role-room-token',
    currentUserId: 'pmv-e2e-admin',
    adminUser: {
      id: 'pmv-e2e-admin',
      email: 'pmv-e2e@example.com',
      role: 'admin',
      requestedRole: 'content_producer',
    },
  }));
};

function ProductionManuscriptTestHarness() {
  const [scenes, setScenes] = useState<SceneBreakdown[]>(initialScenes);
  const [currentManuscript, setCurrentManuscript] = useState<Manuscript>(manuscript);

  useEffect(() => {
    seedAuth();
    window.__productionManuscriptE2EProject = productionManuscriptE2EProject;
  }, []);

  useEffect(() => {
    window.__productionManuscriptE2EScenes = scenes;
  }, [scenes]);

  const handleSceneUpdate = useCallback((scene: SceneBreakdown) => {
    setScenes((previous) => previous.map((entry) => (entry.id === scene.id ? scene : entry)));
  }, []);

  const handleSceneCreate = useCallback((scene: SceneBreakdown) => {
    setScenes((previous) => [...previous, scene]);
  }, []);

  const handleSceneDelete = useCallback((sceneId: string) => {
    setScenes((previous) => previous.filter((scene) => scene.id !== sceneId));
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ width: '100vw', height: '100vh', background: '#0f172a' }}>
        <ProductionManuscriptView
          manuscript={currentManuscript}
          scenes={scenes}
          dialogueLines={dialogueLines}
          acts={acts}
          projectId={PROJECT_ID}
          storyLogicData={null}
          onSceneUpdate={handleSceneUpdate}
          onSceneCreate={handleSceneCreate}
          onSceneDelete={handleSceneDelete}
          onScenesReorder={setScenes}
          onManuscriptUpdate={setCurrentManuscript}
        />
      </div>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProductionManuscriptTestHarness />
  </React.StrictMode>,
);
