import React, { useCallback, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Alert, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import ProjectContext, { type ProjectContextType } from './contexts/ProjectContext';
import ProducerExportHandoffPanel from './components/role-room/components/producer/ProducerExportHandoffPanel';
import type { CastingProject } from './components/role-room/models/casting';
import { getDefaultProducerProjectPlanning } from './components/role-room/utils/producerProjectPlanning';

const theme = createTheme({
  palette: { mode: 'dark' },
});

const projectId = 'e2e-export-project';
const projectName = 'E2E Export Project';
const defaultPlanning = getDefaultProducerProjectPlanning(projectName);

const project: CastingProject = {
  id: projectId,
  name: projectName,
  clientName: 'Holy Crust',
  clientEmail: 'client@example.com',
  status: 'active',
  roles: [],
  candidates: [],
  crew: [],
  schedules: [],
  locations: [],
  props: [],
  shotLists: [],
  productionDays: [],
  producerPlanning: {
    ...defaultPlanning,
    activationPlan: {
      ...defaultPlanning.activationPlan,
      direction: 'Restaurant launch',
      idea: 'Show the craft behind the pizza.',
      activation: 'Publish reels and behind-the-scenes clips.',
      targetAudience: 'Local food lovers',
      businessGoal: 'Increase table bookings',
      coreMessage: 'Fresh dough, visible craft and fast service.',
    },
    contentLogic: {
      ...defaultPlanning.contentLogic,
      objective: 'Make the restaurant feel premium but approachable.',
      audience: 'Young professionals and families',
      hook: 'See the oven, hear the crunch.',
      coreMessage: 'Holy Crust makes pizza with visible craft.',
      proofPoints: ['Fresh dough', 'Open kitchen', 'Fast lunch service'],
      callToAction: 'Book bord',
      distributionPlan: 'Instagram Reels, TikTok and Facebook.',
    },
    brandGuide: {
      ...defaultPlanning.brandGuide,
      logoUrl: 'https://example.com/holy-crust-logo.png',
      colors: [
        { id: 'brand-red', label: 'Tomato red', hex: '#dc2626', usage: 'CTA and key frames' },
      ],
      fonts: ['Editorial Sans'],
      toneOfVoice: 'Warm, direct and food-led.',
      visualStyle: 'Cinematic kitchen, close details and human pace.',
    },
    deliveryWorkflow: {
      ...defaultPlanning.deliveryWorkflow,
      fileNamingConvention: 'holy-crust_[channel]_[format]_v##',
      versioningRule: 'v01 draft, v02 client changes, final approved.',
      folderStructure: 'client-handoff / delivery-workspace / exports',
      draftVsFinalRule: 'Drafts stay in review, final files move to export.',
      backupRoutine: 'Originals and exports are duplicated to Drive and project files.',
      deliveryCadence: 'Weekly batch with one final export package.',
    },
    contentCalendar: [
      {
        ...defaultPlanning.contentCalendar[0],
        id: 'delivery-reel-1',
        title: 'Launch reel',
        channel: 'Instagram',
        format: '9:16',
        publishAt: '2026-04-20T10:00:00.000Z',
        owner: 'Producer',
        phase: 'postproduction',
        status: 'planned',
        notes: 'Hero reel for first launch week.',
      },
    ],
  },
};

function ProducerExportTestHarness() {
  const [sent, setSent] = useState(false);
  const filesRef = useRef<Array<Record<string, unknown>>>([]);
  const uploadCountRef = useRef(0);

  const uploadProjectFile = useCallback(async (
    projectId: string,
    file: File,
    metadata: Record<string, unknown> = {},
  ) => {
    uploadCountRef.current += 1;
    const uploadedFile = {
      id: `${metadata.source === 'role_room_delivery_workspace' ? 'workspace-file' : 'client-package'}-${uploadCountRef.current}`,
      projectId,
      name: file.name,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
      metadata,
      uploadedAt: '2026-04-13T10:00:00.000Z',
      downloadUrl: `/api/projects/${projectId}/files/${uploadCountRef.current}/download`,
    };
    filesRef.current = [...filesRef.current, uploadedFile];
    return uploadedFile;
  }, []);

  const getProjectFiles = useCallback(async () => filesRef.current, []);

  const deleteProjectFile = useCallback(async (_projectId: string, fileId: string) => {
    filesRef.current = filesRef.current.filter((file) => file.id !== fileId);
  }, []);

  const shareProjectFile = useCallback(async (projectId: string, fileId: string) => ({
    success: true,
    shareUrl: `/api/projects/${projectId}/files/${fileId}/shared`,
    expiresAt: '2026-04-16T10:00:00.000Z',
  }), []);

  const projectContextValue = useMemo(() => ({
    uploadProjectFile,
    getProjectFiles,
    deleteProjectFile,
    shareProjectFile,
  }) as unknown as ProjectContextType, [
    deleteProjectFile,
    getProjectFiles,
    shareProjectFile,
    uploadProjectFile,
  ]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3}>
        <ProjectContext.Provider value={projectContextValue}>
          <div style={{ width: '100vw', minHeight: '100vh', background: '#020617', padding: 24 }}>
            {sent ? (
              <Alert severity="success" data-testid="producer-export-send-confirmed" sx={{ mb: 2 }}>
                Send callback completed
              </Alert>
            ) : null}
            <ProducerExportHandoffPanel
              project={project}
              onOpenManuscript={() => undefined}
              onOpenShotList={() => undefined}
              onOpenMedia={() => undefined}
              onOpenReviews={() => undefined}
              onOpenTimeline={() => undefined}
              onSendToClient={async () => {
                setSent(true);
              }}
            />
          </div>
        </ProjectContext.Provider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProducerExportTestHarness />
  </React.StrictMode>,
);
