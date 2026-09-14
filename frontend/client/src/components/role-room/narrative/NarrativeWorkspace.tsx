/**
 * NarrativeWorkspace — Story Graph for profession-mode = game_studio.
 *
 * Parallelt workspace (samme mønster som DanceWorkspace): erstatter
 * CastingPlannerPanel når modus er game_studio. Faner fra professionTabs.ts;
 * ubygde faner rendrer et ærlig «kommer»-kort.
 *
 * Prosjekt-ID: prop → ?projectId= → localStorage → prosjektvelger.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CallSplit as BranchIcon,
  MoveDown as JumperIcon,
  StickyNote2 as NoteIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  SwapHoriz as SwitchProjectIcon,
  ReportProblemOutlined as WarningIcon,
} from '@mui/icons-material';
import { SnackbarProvider } from 'notistack';
import type { Viewport } from 'reactflow';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import useBrandingSettings from '../hooks/useBrandingSettings';
import { ProfessionModeChip } from '../shared/ProfessionModeChip';
import { getCastingProjectsFromDb } from '../services/castingDbService';
import { getActiveProfessionMode, isGameMode, type ProfessionMode } from '../config/professionMode';
import { getTabsForProfession, type TabConfig } from '../config/professionTabs';
import { useNarrativeGraph } from './state/useNarrativeGraph';
import { boardSlice, validateGraph } from './state/graphOps';
import { NarrativeCanvas } from './board/NarrativeCanvas';
import { BoardSidebar } from './board/BoardSidebar';
import { ElementEditorDrawer } from './board/ElementEditorDrawer';
import { ComponentsPanel } from './panels/ComponentsPanel';
import { VariablesPanel } from './panels/VariablesPanel';
import { AssetsPanel } from './panels/AssetsPanel';
import { HistoryPanel } from './panels/HistoryPanel';
import { ComingSoonCard } from './panels/ComingSoonCard';
import { narrativeColors } from './narrativeTheme';
import { htmlToText, type NarrativeElementKind } from './narrativeTypes';

export interface NarrativeWorkspaceProps {
  /** Overstyr modus (e2e-harness). */
  modeOverride?: ProfessionMode;
  /** Aktivt prosjekt. Uten: ?projectId= → localStorage → velger. */
  projectId?: string;
}

const PROJECT_STORAGE_KEY = 'role_room_narrative_project';

const PLACEHOLDER_BODIES: Record<string, { body: string; phase: string }> = {
  play: {
    body: 'Spill gjennom historien som en spiller, med debugger som viser brett, element og variabler live. Krever skriptmotoren (arcscript-kompatibel).',
    phase: 'Fase 2',
  },
  exports: {
    body: 'JSON-eksport i Arcweave-kompatibelt format (virker med deres Unity/Unreal/Godot-plugins), import fra Arcweave, Markdown-eksport og delbare spill-lenker.',
    phase: 'Fase 3',
  },
};

function readUrlParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

function writeUrlParam(name: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value); else url.searchParams.delete(name);
  window.history.replaceState({}, '', url.toString());
}

function ProjectPicker({ onPick }: { onPick: (projectId: string, name: string) => void }) {
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getCastingProjectsFromDb();
        if (!cancelled) setProjects(list.map((p) => ({ id: p.id, name: p.name })));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Kunne ikke hente prosjekter.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }} data-testid="narrative-project-picker">
      <Card sx={{ bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}`, color: narrativeColors.text, width: '100%', maxWidth: 560 }}>
        <CardContent>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Velg prosjekt</Typography>
          <Typography sx={{ fontSize: 13, color: narrativeColors.textDim, mb: 2 }}>
            Story Graph lever inne i et Role Room-prosjekt. Velg spillprosjektet du vil designe historien for.
          </Typography>
          {loading ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Laster prosjekter…</Typography> : null}
          {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}
          {!loading && !error && projects.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>
              Du har ingen prosjekter ennå. Opprett et prosjekt i produksjonsmodus først, og bytt så tilbake til spillstudio.
            </Typography>
          ) : null}
          <List dense>
            {projects.map((p) => (
              <ListItemButton key={p.id} onClick={() => onPick(p.id, p.name)} data-testid={`narrative-pick-project-${p.id}`}>
                <ListItemText primary={p.name} secondary={p.id} primaryTypographyProps={{ color: narrativeColors.text }} secondaryTypographyProps={{ fontSize: 10, color: narrativeColors.textDim }} />
              </ListItemButton>
            ))}
          </List>
        </CardContent>
      </Card>
    </Box>
  );
}

const NarrativeWorkspaceInner: React.FC<NarrativeWorkspaceProps> = ({ modeOverride, projectId: projectIdProp }) => {
  const branding = useBrandingSettings();
  const labels = branding.tokens.labels;
  const mode = modeOverride ?? getActiveProfessionMode();
  const tabs = useMemo(() => getTabsForProfession(mode), [mode]);

  const [projectId, setProjectId] = useState<string | null>(() => {
    if (projectIdProp) return projectIdProp;
    const fromUrl = readUrlParam('projectId');
    if (fromUrl) return fromUrl;
    try { return window.localStorage.getItem(PROJECT_STORAGE_KEY); } catch { return null; }
  });
  useEffect(() => { if (projectIdProp) setProjectId(projectIdProp); }, [projectIdProp]);
  const [projectName, setProjectName] = useState<string | null>(null);

  const pickProject = useCallback((id: string, name?: string) => {
    setProjectId(id);
    setProjectName(name ?? null);
    writeUrlParam('projectId', id);
    try { window.localStorage.setItem(PROJECT_STORAGE_KEY, id); } catch { /* ignore */ }
  }, []);

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const fromUrl = readUrlParam('tab');
    if (fromUrl && tabs.some((t) => t.id === fromUrl)) return fromUrl;
    return tabs[0]?.id ?? 'boards';
  });
  const selectTab = useCallback((id: string) => {
    React.startTransition(() => setActiveTabId(id));
  }, []);
  useEffect(() => { writeUrlParam('tab', activeTabId); }, [activeTabId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as Window & { dataLayer?: Array<Record<string, unknown>> };
    if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
    w.dataLayer.push({ event: 'narrative_tab_view', tab_id: activeTabId, profession_mode: mode });
  }, [activeTabId, mode]);

  const store = useNarrativeGraph(projectId);
  const { graph } = store;

  // Aktivt brett: ?board= → første brett.
  const [activeBoardId, setActiveBoardId] = useState<string | null>(() => readUrlParam('board'));
  useEffect(() => {
    if (graph.boards.length === 0) { if (activeBoardId) setActiveBoardId(null); return; }
    if (!activeBoardId || !graph.boards.some((b) => b.id === activeBoardId)) {
      setActiveBoardId(graph.boards[0].id);
    }
  }, [graph.boards, activeBoardId]);
  useEffect(() => { writeUrlParam('board', activeBoardId); }, [activeBoardId]);

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [notice, setNotice] = useState<{ message: string; severity: 'error' | 'warning' | 'success' } | null>(null);
  const centerResolver = useRef<() => { x: number; y: number }>(() => ({ x: 0, y: 0 }));
  const viewportByBoard = useRef<Map<string, Viewport>>(new Map());

  const slice = useMemo(() => boardSlice(graph, activeBoardId), [graph, activeBoardId]);
  const selectedElement = useMemo(
    () => graph.elements.find((e) => e.id === selectedElementId) ?? null,
    [graph.elements, selectedElementId],
  );
  const issues = useMemo(() => validateGraph(graph), [graph]);

  useEffect(() => {
    if (store.error) setNotice({ message: store.error, severity: 'error' });
  }, [store.error]);
  useEffect(() => {
    if (store.conflict) {
      setNotice({ message: `«${htmlToText(store.conflict.titleHtml) || 'Elementet'}» ble endret av noen andre. Innholdet er oppdatert til siste versjon — gjør endringen din på nytt.`, severity: 'warning' });
      store.clearConflict();
    }
  }, [store.conflict]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tastatur: ⌘Z / ⌘⇧Z for angre/gjør om flytting (ikke når man skriver).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo(); else store.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const addElement = useCallback(async (kind: NarrativeElementKind) => {
    if (!activeBoardId) return;
    const pos = centerResolver.current();
    const defaults: Record<NarrativeElementKind, { titleHtml: string; width: number; height: number }> = {
      element: { titleHtml: '<p>Nytt element</p>', width: 260, height: 120 },
      branch: { titleHtml: '<p>Forgrening</p>', width: 260, height: 120 },
      jumper: { titleHtml: '<p>Jumper</p>', width: 200, height: 80 },
      note: { titleHtml: '', width: 220, height: 100 },
    };
    const d = defaults[kind];
    const created = await store.createElement({
      boardId: activeBoardId, kind, titleHtml: d.titleHtml, width: d.width, height: d.height,
      x: pos.x + Math.round(Math.random() * 40), y: pos.y + Math.round(Math.random() * 40),
      ...(kind === 'branch' ? { branchConditions: [{ script: 'true', label: 'Ja' }, { script: null, label: 'Ellers' }] } : {}),
    });
    if (!graph.settings.startingElementId && kind === 'element' && graph.elements.length === 0) {
      void store.updateSettings({ startingElementId: created.id });
    }
    setSelectedElementId(created.id);
    setEditorOpen(true);
  }, [activeBoardId, store, graph.settings.startingElementId, graph.elements.length]);

  const jumpToElement = useCallback((elementId: string) => {
    const el = graph.elements.find((e) => e.id === elementId);
    if (!el) return;
    if (el.boardId !== activeBoardId) setActiveBoardId(el.boardId);
    setSelectedElementId(el.id);
    setEditorOpen(true);
    selectTab('boards');
  }, [graph.elements, activeBoardId, selectTab]);

  if (!isGameMode(mode) || tabs.length === 0) return null;

  const activeTab: TabConfig = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const renderTabBody = (tab: TabConfig): React.ReactElement => {
    if (!projectId) return <ProjectPicker onPick={pickProject} />;
    switch (tab.id) {
      case 'boards':
        return (
          <Box sx={{ display: 'flex', height: '100%', minHeight: 'calc(100vh - 150px)', position: 'relative' }}>
            <BoardSidebar
              graph={graph}
              activeBoardId={activeBoardId}
              onSelectBoard={(id) => { setActiveBoardId(id); setSelectedElementId(null); setEditorOpen(false); }}
              onCreateBoard={async (name) => { const id = await store.createBoard({ name }); setActiveBoardId(id); }}
              onRenameBoard={(id, name) => store.patchBoard(id, { name })}
              onDeleteBoard={(id) => store.deleteBoard(id)}
              onJumpToElement={jumpToElement}
            />
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.75, borderBottom: `1px solid ${narrativeColors.borderStrong}`, bgcolor: narrativeColors.bgPanel, flexWrap: 'wrap' }}>
                <Button size="small" startIcon={<AddIcon />} disabled={!activeBoardId} onClick={() => void addElement('element')} sx={{ color: narrativeColors.accent }} data-testid="narrative-add-element">Element</Button>
                <Button size="small" startIcon={<BranchIcon />} disabled={!activeBoardId} onClick={() => void addElement('branch')} sx={{ color: narrativeColors.warning }} data-testid="narrative-add-branch">Forgrening</Button>
                <Button size="small" startIcon={<JumperIcon />} disabled={!activeBoardId} onClick={() => void addElement('jumper')} sx={{ color: '#60a5fa' }} data-testid="narrative-add-jumper">Jumper</Button>
                <Button size="small" startIcon={<NoteIcon />} disabled={!activeBoardId} onClick={() => void addElement('note')} sx={{ color: narrativeColors.textDim }} data-testid="narrative-add-note">Notat</Button>
                <Box sx={{ flex: 1 }} />
                {selectedConnectionId ? (
                  <Button size="small" color="error" onClick={() => { void store.deleteConnection(selectedConnectionId); setSelectedConnectionId(null); }}>
                    Slett kobling
                  </Button>
                ) : null}
                <Tooltip title="Angre flytting (⌘Z)"><span><IconButton size="small" disabled={!store.canUndo} onClick={store.undo} sx={{ color: narrativeColors.textDim }} aria-label="Angre"><UndoIcon fontSize="small" /></IconButton></span></Tooltip>
                <Tooltip title="Gjør om (⌘⇧Z)"><span><IconButton size="small" disabled={!store.canRedo} onClick={store.redo} sx={{ color: narrativeColors.textDim }} aria-label="Gjør om"><RedoIcon fontSize="small" /></IconButton></span></Tooltip>
                {issues.length > 0 ? (
                  <Tooltip title={<Box component="ul" sx={{ m: 0, pl: 2 }}>{issues.slice(0, 8).map((i, idx) => <li key={idx}>{i.message}</li>)}</Box>}>
                    <Chip size="small" icon={<WarningIcon sx={{ fontSize: 14 }} />} label={`${issues.length} merknad${issues.length === 1 ? '' : 'er'}`} sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: narrativeColors.warning }} data-testid="narrative-issues-chip" />
                  </Tooltip>
                ) : null}
                <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, ml: 1 }}>
                  {slice.elements.length} elementer · {slice.connections.length} koblinger
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {store.loading ? (
                  <Box sx={{ p: 4, color: narrativeColors.textDim, fontSize: 12, letterSpacing: 1.5, fontWeight: 700 }}>LASTER…</Box>
                ) : !activeBoardId ? (
                  <Box sx={{ p: 4 }}>
                    <Typography sx={{ color: narrativeColors.textDim, fontSize: 13 }}>
                      Opprett et brett i sidepanelet for å begynne. Et brett er ett lerret; historien kan ha mange (akter, kapitler, sidespor).
                    </Typography>
                  </Box>
                ) : (
                  <NarrativeCanvas
                    graph={graph}
                    boardId={activeBoardId}
                    elements={slice.elements}
                    connections={slice.connections}
                    selectedElementId={selectedElementId}
                    onSelectElement={(id) => { setSelectedElementId(id); if (!id) setEditorOpen(false); }}
                    onOpenElement={(id) => { setSelectedElementId(id); setEditorOpen(true); }}
                    onMoveElements={(moves) => store.moveElements(moves)}
                    onConnect={(input) => void store.createConnection({ boardId: activeBoardId, ...input })}
                    onDeleteElements={(ids) => { for (const id of ids) void store.deleteElement(id); if (ids.includes(selectedElementId ?? '')) { setSelectedElementId(null); setEditorOpen(false); } }}
                    onDeleteConnections={(ids) => { for (const id of ids) void store.deleteConnection(id); }}
                    onSelectConnection={setSelectedConnectionId}
                    onViewportChange={(vp) => { viewportByBoard.current.set(activeBoardId, vp); }}
                    initialViewport={viewportByBoard.current.get(activeBoardId) ?? null}
                    registerCenterResolver={(fn) => { centerResolver.current = fn; }}
                  />
                )}
                <ElementEditorDrawer
                  open={editorOpen}
                  element={selectedElement}
                  graph={graph}
                  store={store}
                  onClose={() => setEditorOpen(false)}
                  onDeleted={() => setSelectedElementId(null)}
                />
              </Box>
            </Box>
          </Box>
        );
      case 'components':
        return <ComponentsPanel graph={graph} store={store} />;
      case 'variables':
        return <VariablesPanel graph={graph} store={store} />;
      case 'assets':
        return <AssetsPanel graph={graph} store={store} />;
      case 'history':
        return (
          <HistoryPanel
            projectId={projectId}
            onRestored={(next) => { store.replaceGraph(next); setNotice({ message: 'Versjonen er gjenopprettet.', severity: 'success' }); }}
            onError={(message) => setNotice({ message, severity: 'error' })}
          />
        );
      default: {
        const ph = PLACEHOLDER_BODIES[tab.id];
        return (
          <ComingSoonCard
            title={labels[tab.labelToken] ?? tab.id}
            body={ph?.body ?? 'Dette panelet er under bygging.'}
            phase={ph?.phase ?? 'Senere'}
          />
        );
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#050505', color: narrativeColors.text }} data-testid="narrative-workspace">
      <Box sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(8px)', borderBottom: `1px solid rgba(34,197,94,0.18)` }}>
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <ProfessionModeChip
            mode={mode}
            onSwitch={(newMode) => {
              const url = new URL(window.location.href);
              url.searchParams.set('mode', newMode);
              window.location.href = url.toString();
            }}
          />
          <Typography sx={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.3 }}>Story Graph</Typography>
          <Chip size="small" label="Beta" sx={{ height: 20, fontSize: 10, bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent, fontWeight: 700 }} />
          <Box sx={{ flex: 1 }} />
          {projectId ? (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }} data-testid="narrative-project-label">
                {graph.settings.title || projectName || projectId}
              </Typography>
              {!projectIdProp ? (
                <Tooltip title="Bytt prosjekt">
                  <IconButton size="small" onClick={() => { setProjectId(null); writeUrlParam('projectId', null); }} sx={{ color: narrativeColors.textDim }} aria-label="Bytt prosjekt">
                    <SwitchProjectIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
          ) : null}
        </Box>
        <Tabs
          value={activeTab.id}
          onChange={(_, value) => selectTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: 44, px: 1,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, color: narrativeColors.textDim, minHeight: 44, fontSize: '0.85rem' },
            '& .Mui-selected': { color: '#fff' },
            '& .MuiTabs-indicator': { bgcolor: narrativeColors.accent, height: 3, borderRadius: 1.5 },
          }}
        >
          {tabs.map((tab) => (
            <Tab key={tab.id} value={tab.id} label={labels[tab.labelToken] ?? tab.id} data-testid={`narrative-tab-${tab.id}`} />
          ))}
        </Tabs>
      </Box>

      <Box role="tabpanel" sx={{ flex: 1, minHeight: 0 }}>
        <ErrorBoundary
          key={activeTab.id}
          componentName={`narrative-tab:${activeTab.id}`}
          context={{ tab: activeTab.id }}
          fallback={
            <Box data-testid="narrative-tab-error" sx={{ p: 4, textAlign: 'center', color: narrativeColors.textDim }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Denne fanen kunne ikke vises</Typography>
              <Typography sx={{ fontSize: 12, opacity: 0.7 }}>Feilen er isolert til dette panelet. Bytt fane og prøv igjen.</Typography>
            </Box>
          }
        >
          <React.Suspense fallback={<Box sx={{ p: 4, color: narrativeColors.textDim, fontSize: 12, letterSpacing: 1.5, fontWeight: 700 }}>LASTER…</Box>}>
            {renderTabBody(activeTab)}
          </React.Suspense>
        </ErrorBoundary>
      </Box>

      <Snackbar
        open={!!notice}
        autoHideDuration={notice?.severity === 'error' ? 8000 : 4000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={notice?.severity ?? 'info'} onClose={() => setNotice(null)} variant="filled" sx={{ maxWidth: 560 }} data-testid="narrative-notice">
          {notice?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export const NarrativeWorkspace: React.FC<NarrativeWorkspaceProps> = (props) => (
  <SnackbarProvider maxSnack={3}>
    <NarrativeWorkspaceInner {...props} />
  </SnackbarProvider>
);

export default NarrativeWorkspace;
