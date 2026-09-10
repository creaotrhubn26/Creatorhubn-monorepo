import React from 'react';
import ReactDOM from 'react-dom/client';
import { Box, CssBaseline, ThemeProvider, Typography, createTheme } from '@mui/material';

import { ManuscriptPanel } from './components/role-room/components/ManuscriptPanel';
import { ToastProvider } from './components/role-room/components/ToastStack';
import type { Manuscript } from './components/role-room/models/casting';
import { castingService } from './components/role-room/services/castingService';
import { manuscriptService } from './components/role-room/services/manuscriptService';
import { roleRoomProjectMembersService } from './components/role-room/services/roleRoomProjectMembersService';

const theme = createTheme({ palette: { mode: 'dark' } });
const now = new Date('2026-09-10T10:00:00.000Z').toISOString();
window.localStorage.setItem('role_room_screenplay_guide_seen', '1');
const manuscript: Manuscript = {
  id: 'toolbar-manuscript',
  projectId: 'toolbar-project',
  title: 'Troll – opptaksmanus med et langt arbeidsnavn',
  subtitle: '',
  author: 'Daniel',
  version: 38,
  format: 'fountain',
  content: 'INT. HYTTE - NATT\n\nNORA\nDet er bare vinden.',
  pageCount: 96,
  wordCount: 8,
  status: 'draft',
  createdAt: now,
  updatedAt: now,
};

Object.assign(manuscriptService, {
  getManuscripts: async () => [manuscript],
  getScenes: async () => [],
  getActs: async () => [],
  getDialogue: async () => [],
  getRevisions: async () => [],
  acquireManuscriptLock: async () => ({
    lockedBy: null,
    lockedAt: null,
    expiresAt: null,
    held: true,
    isExpired: false,
  }),
  heartbeatManuscriptLock: async () => ({
    lockedBy: null,
    lockedAt: null,
    expiresAt: null,
    held: true,
    isExpired: false,
  }),
  releaseManuscriptLock: async () => ({ released: true }),
  pingManuscriptPresence: async () => [],
  updateManuscript: async (nextManuscript: Manuscript) => ({
    manuscript: { ...nextManuscript, version: 39, updatedAt: new Date().toISOString() },
    local: true,
    cloud: true,
    cloudVersion: 39,
    retryPending: false,
    savedAt: new Date().toISOString(),
  }),
});

Object.assign(castingService, {
  getRoles: async () => [],
  getLocations: async () => [],
  getCandidates: async () => [],
});

Object.assign(roleRoomProjectMembersService, {
  list: async () => ({ projectId: 'toolbar-project', members: [] }),
});

function ManuscriptToolbarHarness() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastProvider>
        <Box sx={{ width: '100vw', height: '100vh', bgcolor: '#080b12' }}>
          <ManuscriptPanel
            projectId="toolbar-project"
            targetDurationMinutes={90}
            onTargetDurationChange={() => undefined}
            onSendToApproval={() => undefined}
            headerLeftContent={(
              <Box sx={{ minWidth: 0, px: 1 }}>
                <Typography variant="caption" color="text.secondary">Role Room Studio</Typography>
                <Typography variant="subtitle2" noWrap>Story Writer</Typography>
              </Box>
            )}
          />
        </Box>
      </ToastProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<ManuscriptToolbarHarness />);
