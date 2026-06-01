/**
 * dance-annotate-harness — standalone-mount av DanceAnnotateLayout med
 * hardkodet open-source dansevideo. Brukes til å visuelt verifisere
 * Annotate-flate uten å gå gjennom DanceWorkspace top-tabs / tour-wizard.
 *
 * Video: Mixkit "Young woman dancing ballet in a studio" — free-for-
 * commercial-use, no attribution required (https://mixkit.co/license/).
 *
 * Mocks installeres FØR React mount via window.fetch-patch. Service-stub
 * dispatcher 'dance:select-clip'-event for å trigge clip-mounting.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/role-room/components/ToastStack';
import { AuthProvider } from './contexts/AuthContext';
import { EnhancedMasterIntegrationProvider } from './integration/EnhancedMasterIntegrationProvider';
import DanceAnnotateLayout, { type DanceAnnotateActiveView } from './components/role-room/dance/DanceAnnotateLayout';
import DanceAnnotateView from './components/role-room/dance/DanceAnnotateView';
import FormationVideoPanel from './components/role-room/dance/FormationVideoPanel';

// CC-BY Blender Foundation (Big Buck Bunny, 360p WebM VP9). Vi bruker
// WebM/VP9 fordi Playwright Chromium mangler H.264-codec som standard;
// ekte Chrome på Daniel's Mac spiller mp4 fint. test-videos.co.uk er
// stabil CDN for åpne CC test-videoer. Ikke dans-spesifikk, men
// demonstrerer videoplayer + tids-overlay + timeline-sync.
const DANCE_VIDEO_URL =
  'https://test-videos.co.uk/vids/bigbuckbunny/webm/vp9/360/Big_Buck_Bunny_360_10s_1MB.webm';

const DEMO_CLIP_ID = 'demo-clip-1';
const DEMO_DURATION = 10; // BBB 10s WebM sample

const MOCK_CLIP = {
  id: DEMO_CLIP_ID, ownerUserId: 'demo-user', projectId: 'demo-project',
  choreographyId: null, segmentId: null, kind: 'rehearsal',
  title: 'Ballet — Studio Demo (Mixkit CC)', storageKey: 'demo/dance.mp4',
  signedUrl: DANCE_VIDEO_URL, durationSec: DEMO_DURATION, mime: 'video/mp4',
  sourceUserId: 'demo-user',
  capturedAt: '2026-06-01T19:15:00Z', createdAt: '2026-06-01T19:30:00Z', updatedAt: '2026-06-01T19:30:00Z',
};

const MOCK_ANNOTATIONS = [
  { id: 'demo-ann-1', clipId: DEMO_CLIP_ID, ownerUserId: 'demo-user', authorUserId: 'demo-user',
    timestampSec: 1, endSec: 3, body: 'Tendu rett ut', category: 'steps',
    targetDancerIds: [], status: 'open', confidence: 0.92, parentId: null,
    createdAt: '2026-06-01T19:30:00Z', updatedAt: '2026-06-01T19:30:00Z' },
  { id: 'demo-ann-2', clipId: DEMO_CLIP_ID, ownerUserId: 'demo-user', authorUserId: 'demo-user',
    timestampSec: 3.5, endSec: 6, body: 'Arms épaulement', category: 'arms',
    targetDancerIds: [], status: 'open', confidence: 0.87, parentId: null,
    createdAt: '2026-06-01T19:31:00Z', updatedAt: '2026-06-01T19:31:00Z' },
  { id: 'demo-ann-3', clipId: DEMO_CLIP_ID, ownerUserId: 'demo-user', authorUserId: 'demo-user',
    timestampSec: 6.5, endSec: 9, body: 'Pirouette', category: 'turns',
    targetDancerIds: [], status: 'open', confidence: 0.95, parentId: null,
    createdAt: '2026-06-01T19:32:00Z', updatedAt: '2026-06-01T19:32:00Z' },
];

const DEFAULT_CATEGORIES = [
  { id: 'steps', ownerUserId: 'demo-user', projectId: null, name: 'Steps', color: '#a78bfa', shortcut: '1', sortOrder: 1, isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'arms',  ownerUserId: 'demo-user', projectId: null, name: 'Arms',  color: '#34d399', shortcut: '2', sortOrder: 2, isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'body',  ownerUserId: 'demo-user', projectId: null, name: 'Body',  color: '#fbbf24', shortcut: '3', sortOrder: 3, isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'jumps', ownerUserId: 'demo-user', projectId: null, name: 'Jumps', color: '#60a5fa', shortcut: '4', sortOrder: 4, isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'turns', ownerUserId: 'demo-user', projectId: null, name: 'Turns', color: '#f472b6', shortcut: '5', sortOrder: 5, isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
];

const DEFAULT_LABELS = [
  { id: 'l-walk',   ownerUserId: 'demo-user', categoryId: 'steps', projectId: null, name: 'Walk',   sortOrder: 1, isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'l-chasse', ownerUserId: 'demo-user', categoryId: 'steps', projectId: null, name: 'Chassé', sortOrder: 2, isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'l-step',   ownerUserId: 'demo-user', categoryId: 'steps', projectId: null, name: 'Step',   sortOrder: 3, isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'l-slide',  ownerUserId: 'demo-user', categoryId: 'steps', projectId: null, name: 'Slide',  sortOrder: 4, isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'l-run',    ownerUserId: 'demo-user', categoryId: 'steps', projectId: null, name: 'Run',    sortOrder: 5, isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'l-kick',   ownerUserId: 'demo-user', categoryId: 'steps', projectId: null, name: 'Kick',   sortOrder: 6, isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
];

// ─── Install global fetch-mocks BEFORE React mount ──────────────────────
(() => {
  const orig = window.fetch.bind(window);
  const ok = (data: unknown): Response => new Response(
    JSON.stringify({ success: true, data }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || 'GET').toUpperCase();

    if (url.includes('/api/dance/video-clips') && method === 'GET' && !url.includes('/annotations')) {
      return ok([MOCK_CLIP]);
    }
    if (new RegExp(`/api/dance/video-clips/${DEMO_CLIP_ID}/annotations`).test(url) && method === 'GET') {
      return ok(MOCK_ANNOTATIONS);
    }
    if (url.includes('/api/dance/annotation-categories') && method === 'GET') {
      return ok(DEFAULT_CATEGORIES);
    }
    if (url.includes('/api/dance/annotation-labels') && method === 'GET') {
      return ok(DEFAULT_LABELS);
    }
    if (url.includes('/api/casting/projects') && method === 'GET') {
      return ok([{ id: 'demo-project', userId: 'demo-user', name: 'Contemporary Routine', status: 'active', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z' }]);
    }
    if (url.includes('/api/dance/billing/subscription')) {
      return ok({ tier: 'pro_studio', status: 'active', seatsTotal: 5, seatsUsed: 1, currentPeriodEnd: '2026-12-31T00:00:00Z' });
    }
    if (url.includes('/api/dance/') || url.includes('/api/auth/') || url.includes('/api/branding/') || url.includes('/api/whats-new')) {
      return ok([]);
    }
    return orig(input, init);
  };
})();

const theme = createTheme({ palette: { mode: 'dark' } });
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

function DanceAnnotateHarness(): React.ReactElement {
  const [activeView, setActiveView] = React.useState<DanceAnnotateActiveView>('annotate');

  // Etter første mount: dispatch dance:select-clip slik at video-panel
  // får signedUrl. FormationVideoPanel lytter på samme event som ClipsSidebar.
  React.useEffect(() => {
    const t = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('dance:select-clip', {
        detail: {
          clipId: DEMO_CLIP_ID,
          signedUrl: DANCE_VIDEO_URL,
          durationSec: DEMO_DURATION,
          title: MOCK_CLIP.title,
        },
      }));
    }, 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <DanceAnnotateLayout
      projectName="Contemporary Routine"
      onSave={() => console.log('save clicked')}
      saveStatus="idle"
      lastSavedAt={Date.now() - 60_000}
      onExport={() => {
        window.dispatchEvent(new CustomEvent('dance:export-annotation'));
      }}
      onOpenProjectSwitcher={() => alert('project switcher')}
      user={{ name: 'Demo User' }}
      projectId="demo-project"
      activeView={activeView}
      onViewChange={setActiveView}
    >
      {activeView === 'annotate' ? (
        <DanceAnnotateView
          clipId={DEMO_CLIP_ID}
          clipTitle={MOCK_CLIP.title}
          durationSec={DEMO_DURATION}
          projectId="demo-project"
          dancerOptions={[
            { id: 'd1', label: 'Dancer 1' },
            { id: 'd2', label: 'Dancer 2' },
          ]}
        />
      ) : (
        <Box sx={{ p: 4, color: '#888' }}>
          View: {activeView} (ikke implementert i harness — bytt tilbake til Annotate via en clip-klikk)
        </Box>
      )}
    </DanceAnnotateLayout>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <ToastProvider>
            <EnhancedMasterIntegrationProvider>
              <DanceAnnotateHarness />
            </EnhancedMasterIntegrationProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
