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
import { NARRATIVE_DISABLED_EVENT } from './narrativeService';
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
import type { Viewport } from '@xyflow/react';
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
import { ExportsPanel } from './panels/ExportsPanel';
import { TranslationsPanel } from './panels/TranslationsPanel';
import { ScenesPanel } from './scenes/ScenesPanel';
import { ComingSoonCard } from './panels/ComingSoonCard';
import { NarrativePlayPanel } from './play/NarrativePlayPanel';
import { useNarrativeRealtime } from './realtime/narrativeRealtimeClient';
import { cursorsOnBoard, selectionColors, uniquePeersByUser } from './realtime/presenceReducer';
import { PresenceAvatars } from './realtime/PresenceAvatars';
import { GameAdminPanel, GamePricingPage, GameSubscriptionPanel, NARRATIVE_OPEN_TAB_EVENT } from '../game/GameBillingPanels';
import { GameShell } from '../game/GameShell';
import { ProjectHomePanel } from './home/ProjectHomePanel';
import { NarrativeInboxBell } from './home/NarrativeInboxBell';
import { CommandPalette, type Command } from '../shared/CommandPalette';
import { gameTabIcon } from '../game/gameShellIcons';
import { StoryPanel } from './story/StoryPanel';
import { ComponentGalleryPanel } from './characters/ComponentGalleryPanel';
import { PlatformPanel } from './platform/PlatformPanel';
import { PlanPanel } from './plan/PlanPanel';
import { TeamPanel } from '../game/TeamPanel';
import { PlanGateBanner } from '../game/GameBillingPanels';
import { authSessionService } from '../services/authSessionService';
import { narrativeColors } from './narrativeTheme';
import { htmlToText, type NarrativeElementKind } from './narrativeTypes';

export interface NarrativeWorkspaceProps {
  /** Overstyr modus (e2e-harness). */
  modeOverride?: ProfessionMode;
  /** Aktivt prosjekt. Uten: ?projectId= → localStorage → velger. */
  projectId?: string;
}

const PROJECT_STORAGE_KEY = 'role_room_narrative_project';

/** Faner som ennå ikke er bygd (alle Fase 0–3-faner er levert). */
const PLACEHOLDER_BODIES: Record<string, { body: string; phase: string }> = {};

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
  const allTabs = useMemo(() => getTabsForProfession(mode), [mode]);
  // Admin · Planer vises kun for admin-roller (samme regel som backend requireAdmin).
  const sessionRole = String(authSessionService.getSessionSync().adminUser?.role ?? '');
  const isAdmin = sessionRole === 'admin' || sessionRole === 'super_admin' || sessionRole === 'academy_admin';
  const tabs = useMemo(() => allTabs.filter((t) => t.id !== 'admin_plans' || isAdmin), [allTabs, isAdmin]);

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
  // Plan-bannere («Se planer») ber om fanebytte via window-event.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: string }>).detail?.tab;
      if (tab && tabs.some((t) => t.id === tab)) selectTab(tab);
    };
    window.addEventListener(NARRATIVE_OPEN_TAB_EVENT, onOpen);
    return () => window.removeEventListener(NARRATIVE_OPEN_TAB_EVENT, onOpen);
  }, [tabs, selectTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as Window & { dataLayer?: Array<Record<string, unknown>> };
    if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
    w.dataLayer.push({ event: 'narrative_tab_view', tab_id: activeTabId, profession_mode: mode });
  }, [activeTabId, mode]);

  const store = useNarrativeGraph(projectId);
  const { graph } = store;

  // Fase 8a: server-side av-bryter (503 game_studio_disabled) → helsidebanner.
  const [serviceDisabled, setServiceDisabled] = useState(false);
  useEffect(() => {
    const onDisabled = () => setServiceDisabled(true);
    window.addEventListener(NARRATIVE_DISABLED_EVENT, onDisabled);
    return () => window.removeEventListener(NARRATIVE_DISABLED_EVENT, onDisabled);
  }, []);

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
  // Snackbaren beholder siste melding under lukke-transisjonen (ellers blinker den tom).
  const lastNotice = useRef<{ message: string; severity: 'error' | 'warning' | 'success' } | null>(null);
  if (notice) lastNotice.current = notice;
  const shownNotice = notice ?? lastNotice.current;
  // Fase 7: produksjons-endringer (episoder/spørsmål/kilder/milepæler/plattform) fra andre → refetch i hjem/historie/plan.
  const [productionTick, setProductionTick] = useState(0);
  const navigateTo = useCallback((tab: string, extra?: { sceneId?: string }) => {
    if (extra?.sceneId) writeUrlParam('scene', extra.sceneId);
    React.startTransition(() => setActiveTabId(tab));
  }, []);
  const centerResolver = useRef<() => { x: number; y: number }>(() => ({ x: 0, y: 0 }));
  const viewportByBoard = useRef<Map<string, Viewport>>(new Map());

  const slice = useMemo(() => boardSlice(graph, activeBoardId), [graph, activeBoardId]);

  // ─── Sanntid: presence, markører, graf-push ────────────────────────
  // Sesjonen hydreres asynkront; re-les ved oppdatering så sanntid kobler
  // seg på når identiteten er kjent (uten identitet: ingen tilkobling).
  const [authTick, setAuthTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void authSessionService.loadSession().then(() => { if (!cancelled) setAuthTick((t) => t + 1); }).catch(() => undefined);
    const onUpdate = () => setAuthTick((t) => t + 1);
    window.addEventListener('auth-session-updated', onUpdate);
    return () => { cancelled = true; window.removeEventListener('auth-session-updated', onUpdate); };
  }, []);
  void authTick;
  const session = authSessionService.getSessionSync();
  const selfUserId = session.currentUserId ?? (session.adminUser?.id != null ? String(session.adminUser.id) : null);
  const selfName = session.adminUser?.name ?? session.adminUser?.display_name ?? session.adminUser?.email?.split('@')[0] ?? 'Du';
  // Fase 6: scene-endringer fra andre (kind = 'scene') trigger refetch av
  // scenelista i stedet for graf-reload.
  const [scenesTick, setScenesTick] = useState(0);
  const realtime = useNarrativeRealtime({
    projectId, userId: selfUserId, name: selfName, boardId: activeBoardId,
    enabled: !!projectId && !!selfUserId,
    onGraphChanged: (evt) => {
      if (evt.kind === 'scene') { if (evt.actorUserId !== selfUserId) { setScenesTick((t) => t + 1); setProductionTick((t) => t + 1); } return; }
      if (evt.kind === 'production') { if (evt.actorUserId !== selfUserId) setProductionTick((t) => t + 1); return; }
      store.applyRemoteChange(evt, selfUserId);
    },
  });
  const peersOnBoard = useMemo(() => (activeBoardId ? cursorsOnBoard(realtime.presence, activeBoardId) : []), [realtime.presence, activeBoardId]);
  const peerSelectionColors = useMemo(() => selectionColors(realtime.presence), [realtime.presence]);
  const uniquePeers = useMemo(() => uniquePeersByUser(realtime.presence), [realtime.presence]);
  const boardNameById = useMemo(() => new Map(graph.boards.map((b) => [b.id, b.name])), [graph.boards]);
  useEffect(() => { realtime.sendSelection(selectedElementId ? [selectedElementId] : []); }, [selectedElementId]); // eslint-disable-line react-hooks/exhaustive-deps
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
      case 'home':
        return (
          <ProjectHomePanel
            projectId={projectId}
            projectTitle={graph.settings.title || projectName || projectId}
            refreshKey={scenesTick + productionTick}
            onNavigate={navigateTo}
          />
        );
      case 'story':
        return <StoryPanel projectId={projectId} refreshKey={scenesTick + productionTick} onOpenScene={(sceneId) => navigateTo('scenes', { sceneId })} onNotice={(message, severity) => setNotice({ message, severity })} />;
      case 'characters':
        return <ComponentGalleryPanel projectId={projectId} kind="character" graph={graph} store={store} refreshKey={scenesTick} onOpenScene={(sceneId) => navigateTo('scenes', { sceneId })} onNotice={(message, severity) => setNotice({ message, severity })} />;
      case 'locations':
        return <ComponentGalleryPanel projectId={projectId} kind="location" graph={graph} store={store} refreshKey={scenesTick} onOpenScene={(sceneId) => navigateTo('scenes', { sceneId })} onNotice={(message, severity) => setNotice({ message, severity })} />;
      case 'plan':
        return <PlanPanel projectId={projectId} refreshKey={scenesTick + productionTick} onOpenScene={(sceneId) => navigateTo('scenes', { sceneId })} onNotice={(message, severity) => setNotice({ message, severity })} />;
      case 'platform':
        return <PlatformPanel projectId={projectId} refreshKey={productionTick} onNotice={(message, severity) => setNotice({ message, severity })} />;
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
                <Button size="small" startIcon={<JumperIcon />} disabled={!activeBoardId} onClick={() => void addElement('jumper')} sx={{ color: '#93a4dc' }} data-testid="narrative-add-jumper">Jumper</Button>
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
                  peers={peersOnBoard}
                  peerSelectionColors={peerSelectionColors}
                  onCursorMove={realtime.sendCursor}
                />
                )}
                <ElementEditorDrawer
                  open={editorOpen}
                  element={selectedElement}
                  graph={graph}
                  store={store}
                  onClose={() => setEditorOpen(false)}
                  onDeleted={() => setSelectedElementId(null)}
                  projectId={projectId}
                />
              </Box>
            </Box>
          </Box>
        );
      case 'scenes':
        return (
          <ScenesPanel
            projectId={projectId}
            graph={graph}
            refreshKey={scenesTick}
            onJumpToElement={jumpToElement}
            onNotice={(message, severity) => setNotice({ message, severity })}
          />
        );
      case 'components':
        return <ComponentsPanel graph={graph} store={store} />;
      case 'variables':
        return <VariablesPanel graph={graph} store={store} />;
      case 'assets':
        return <AssetsPanel graph={graph} store={store} />;
      case 'play':
        return <NarrativePlayPanel graph={graph} onEditElement={jumpToElement} />;
      case 'translations':
        return (
          <TranslationsPanel
            projectId={projectId}
            graph={graph}
            store={store}
            onNotice={(message, severity) => setNotice({ message, severity })}
          />
        );
      case 'exports':
        return (
          <ExportsPanel
            projectId={projectId}
            graph={graph}
            onImported={(next) => store.replaceGraph(next)}
            onNotice={(message, severity) => setNotice({ message, severity })}
          />
        );
      case 'team':
        return (
          <Box sx={{ p: { xs: 1, md: 2 } }} data-testid="narrative-team">
            <PlanGateBanner feature="team_seats" />
            <TeamPanel />
          </Box>
        );
      case 'pricing':
        return <GamePricingPage />;
      case 'billing':
        return <GameSubscriptionPanel />;
      case 'admin_plans':
        return <GameAdminPanel />;
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

  const commands: Command[] = [
    ...tabs.filter((t) => !t.requiresProject || !!projectId).map((t) => ({
      id: `tab:${t.id}`, label: labels[t.labelToken] ?? t.id, description: t.descriptionToken ? labels[t.descriptionToken] : undefined, category: 'Hopp til' as const,
      icon: gameTabIcon(t.id, 16), keywords: [t.id], onSelect: () => selectTab(t.id),
    })),
    ...(projectId ? [
      { id: 'act:new-scene', label: 'Ny scene', description: 'Åpner Scener & gameplay klar for ny scene', category: 'Handling' as const, keywords: ['scene', 'opprett'], onSelect: () => selectTab('scenes') },
      { id: 'act:new-element', label: 'Nytt element på brettet', description: 'Legger et element på aktivt brett', category: 'Handling' as const, keywords: ['element', 'node'], onSelect: () => { selectTab('boards'); void addElement('element'); } },
      { id: 'act:home', label: 'Hjem', description: 'Prosjektoversikt', category: 'Hopp til' as const, keywords: ['oversikt', 'dashboard'], onSelect: () => selectTab('home') },
    ] : []),
  ];
  const openPalette = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  };

  return (
    <>
      <GameShell
        tabs={tabs}
        activeTabId={activeTab.id}
        onSelectTab={selectTab}
        labels={labels}
        onOpenSearch={openPalette}
        header={(
          <ProfessionModeChip
            mode={mode}
            onSwitch={(newMode) => {
              const url = new URL(window.location.href);
              url.searchParams.set('mode', newMode);
              window.location.href = url.toString();
            }}
          />
        )}
        headerActions={(
          <>
            {projectId && selfUserId ? <PresenceAvatars peers={uniquePeers} boardNameById={boardNameById} connected={realtime.connected} /> : null}
            {projectId ? <NarrativeInboxBell projectId={projectId} refreshKey={scenesTick + productionTick} onOpenScene={(sceneId) => navigateTo('scenes', { sceneId })} /> : null}
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
          </>
        )}
      >
        <Box data-testid="narrative-workspace" sx={{ minHeight: '100%' }}>
          {serviceDisabled ? (
            <Alert severity="warning" data-testid="narrative-disabled-banner" sx={{ m: 2 }}>
              Spillstudio er midlertidig slått av for vedlikehold. Ingenting går tapt — prøv igjen om litt.
            </Alert>
          ) : null}
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
      </GameShell>
      <CommandPalette commands={commands} />

      <Snackbar
        open={!!notice}
        autoHideDuration={notice?.severity === 'error' ? 8000 : 4000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={shownNotice?.severity ?? 'info'} onClose={() => setNotice(null)} variant="filled" sx={{ maxWidth: 560 }} data-testid="narrative-notice">
          {shownNotice?.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export const NarrativeWorkspace: React.FC<NarrativeWorkspaceProps> = (props) => (
  <SnackbarProvider maxSnack={3}>
    <NarrativeWorkspaceInner {...props} />
  </SnackbarProvider>
);

export default NarrativeWorkspace;
