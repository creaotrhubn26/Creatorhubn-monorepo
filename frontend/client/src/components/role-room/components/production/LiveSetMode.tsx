/**
 * LiveSetMode.tsx  —  Production-ready on-set control panel
 * ──────────────────────────────────────────────────────────────────────────
 * Improvements over v1:
 *  1.  Grid `size` prop removed — replaced with flex Box (MUI v5 safe)
 *  2.  Timer interval → 1 000 ms (was 100 ms — wasteful)
 *  3.  Single source of truth for isRolling (server state wins on next poll)
 *  4.  autoIncrement setting is respected; manual ± buttons shown when off
 *  5.  Quick-note buttons wired with addQuickNote()
 *  6.  loading / error / retry-with-exponential-backoff on data fetch
 *  7.  Fullscreen sync via fullscreenchange event listener (ESC safe)
 *  8.  userId from props — no more hard-coded 'current-user'
 *  9.  ContinuityNotes persisted through settingsService with localStorage fallback per projectId+dayId
 * 10.  Polling fallback every 5 s (placeholder for WS/SSE subscription)
 * 11.  Unused imports removed (Badge, Card, Pause, Next, Prev, VolumeUp…)
 * 12.  "Neste setup" + "Marker ferdig" added; manual take ±1 controls
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  LinearProgress,
  Alert,
  Tooltip,
  Switch,
  FormControlLabel,
  CircularProgress,
  Snackbar,
  Menu,
  Avatar,
  ToggleButtonGroup,
  ToggleButton,
  useMediaQuery,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Warning as WarningIcon,
  Notes as NotesIcon,
  Videocam as VideocamIcon,
  Mic as MicIcon,
  Camera as CameraIcon,
  Movie as MovieIcon,
  FiberManualRecord as RecordIcon,
  // MovieIcon wired: scene header + next-scene list in center panel
  Refresh as RefreshIcon,
  FullscreenExit as ExitFullscreenIcon,
  Fullscreen as FullscreenIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Description as DescriptionIcon,
  Add as AddIcon,
  PhotoCamera as PhotoCameraIcon,
  Lightbulb as LightbulbIcon,
  KeyboardArrowUp as TakeUpIcon,
  KeyboardArrowDown as TakeDownIcon,
  SkipNext as NextSetupIcon,
  TaskAlt as MarkCompleteIcon,
  WifiOff as OfflineIcon,
  FileDownload as DownloadIcon,
  Cameraswitch as CameraSwitch,
  SignalWifi4Bar as OnlineIcon,
  PeopleAlt as PeopleIcon,
  ThumbUp as ThumbUpIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import {
  productionWorkflowService,
  type Take,
  type LiveSetStatus,
  type ShootingDay,
  type CameraId,
  type CameraMetadata,
} from '../../services/productionWorkflowService';
import { buildCan, ROLE_LABELS, type LiveSetCan, type LiveSetRole } from '../../services/liveSetPermissionsService';
import * as Outbox from '../../services/liveSetOutboxService';
import { useLiveSetRealtime, type PresenceEntry, type LiveSetWsMessage, type LiveSetMsgType } from '../../services/liveSetRealtimeService';
import {
  exportDailyReportPdf,
  exportCirclePrintPdf,
  exportTakesCsv,
  exportNotesCsv,
  type ExportContext,
} from '../../services/liveSetExportService';
import globalTagService from '../../services/globalTagService';
import settingsService from '../../services/settingsService';
import GlobalMentionHelper from '../shared/GlobalMentionHelper';
import { buildLiveSetNotesKey, buildLiveSetNotesNamespace } from './storageKeys';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveSetModeProps {
  projectId:     string;
  shootingDayId: string;
  /** Authenticated user id — passed by parent from auth context. */
  userId?:       string;
  /** Pro: role determines which buttons are enabled. Default = 'director'. */
  userRole?:     LiveSetRole;
  /** Used in export filenames and PDF headers. */
  projectTitle?: string;
  onClose:       () => void;
}

interface ContinuityNote {
  id: string;
  sceneId: string;
  shotId?: string;
  takeId?: string;
  type: 'continuity' | 'costume' | 'props' | 'makeup' | 'tech' | 'general';
  note: string;
  photoUrl?: string;
  timestamp: string;
  createdBy: string;
  /** false = still in local outbox, not yet confirmed by server */
  synced: boolean;
}

interface QuickNote {
  type: 'good' | 'bad' | 'tech' | 'sound' | 'focus';
  label: string;
  icon: React.ReactNode;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_NOTES: QuickNote[] = [
  { type: 'good',  label: 'God take',        icon: <CheckCircleIcon color="success" /> },
  { type: 'bad',   label: 'Dårlig take',      icon: <CancelIcon color="error" /> },
  { type: 'tech',  label: 'Teknisk problem',  icon: <WarningIcon color="warning" /> },
  { type: 'sound', label: 'Lyd-issue',         icon: <MicIcon color="info" /> },
  { type: 'focus', label: 'Fokus-issue',       icon: <CameraIcon color="secondary" /> },
];

/** 4-item quick-note list shown in the left panel (icon + text label). */
const LEFT_PANEL_NOTES: QuickNote[] = [
  { type: 'good',  label: 'Good Take!',   icon: <ThumbUpIcon sx={{ fontSize: 16, color: '#4caf50' }} /> },
  { type: 'focus', label: 'Pickup Shot',  icon: <RefreshIcon sx={{ fontSize: 16, color: '#64b5f6' }} /> },
  { type: 'tech',  label: 'Action Safe',  icon: <WarningIcon sx={{ fontSize: 16, color: '#9333ea' }} /> },
  { type: 'sound', label: 'Check Focus',  icon: <CameraIcon sx={{ fontSize: 16, color: '#9e9e9e' }} /> },
];

const TAKE_STATUS_COLORS: Record<Take['status'], string> = {
  good:   '#4caf50',
  ok:     '#9333ea',
  bad:    '#f44336',
  circle: '#2196f3',
  print:  '#9c27b0',
};

const POLL_INTERVAL_MS = 5_000;
const RETRY_MAX        = 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const notesKey = (pid: string, did: string) => buildLiveSetNotesKey(pid, did);
const notesNamespace = (did: string) => buildLiveSetNotesNamespace(did);

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function loadLocalNotes(pid: string, did: string): ContinuityNote[] {
  try {
    const raw = localStorage.getItem(notesKey(pid, did));
    return raw ? (JSON.parse(raw) as ContinuityNote[]) : [];
  } catch { return []; }
}

function saveLocalNotes(pid: string, did: string, notes: ContinuityNote[]) {
  try { localStorage.setItem(notesKey(pid, did), JSON.stringify(notes)); } catch { /* quota */ }
}

function mergeContinuityNotes(...sources: ContinuityNote[][]): ContinuityNote[] {
  const byId = new Map<string, ContinuityNote>();
  for (const notes of sources) {
    for (const note of notes) {
      byId.set(note.id, { ...byId.get(note.id), ...note });
    }
  }
  return Array.from(byId.values()).sort((left, right) => (
    new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
  ));
}

async function loadPersistedNotes(pid: string, did: string): Promise<ContinuityNote[]> {
  const localNotes = loadLocalNotes(pid, did);
  const remoteNotes = await settingsService.getSetting<ContinuityNote[]>(notesNamespace(did), { projectId: pid });
  if (!Array.isArray(remoteNotes)) {
    return localNotes;
  }
  const merged = mergeContinuityNotes(remoteNotes, localNotes);
  saveLocalNotes(pid, did, merged);
  if (merged.length !== remoteNotes.length) {
    void settingsService.setSetting(notesNamespace(did), merged, { projectId: pid });
  }
  return merged;
}

async function savePersistedNotes(pid: string, did: string, notes: ContinuityNote[]): Promise<void> {
  saveLocalNotes(pid, did, notes);
  await settingsService.setSetting(notesNamespace(did), notes, { projectId: pid });
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1_000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3_600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3_600)}h ago`;
  return `${Math.floor(diff / 86_400)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const LiveSetMode: React.FC<LiveSetModeProps> = ({
  projectId,
  shootingDayId,
  userId       = 'unknown',
  userRole     = 'director',
  projectTitle = 'Production',
  onClose,
}) => {
  // ── Remote data ──────────────────────────────────────────────────────────
  const [liveStatus, setLiveStatus]   = useState<LiveSetStatus | null>(null);
  const [shootingDay, setShootingDay] = useState<ShootingDay | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [retryCount, setRetryCount]   = useState(0);

  // ── Rolling: optimistic local; server wins on next poll (fix #3) ─────────
  const [optimisticRolling, setOptimisticRolling] = useState<boolean | null>(null);
  const isRolling = optimisticRolling !== null
    ? optimisticRolling
    : (liveStatus?.isRolling ?? false);

  // ── Timer ─────────────────────────────────────────────────────────────────
  const [rollStartAt, setRollStartAt] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen]             = useState(false);
  const [showNoteDialog, setShowNoteDialog]         = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [continuityNotes, setContinuityNotes]      = useState<ContinuityNote[]>(() =>
    loadLocalNotes(projectId, shootingDayId),
  );
  const [noteForm, setNoteForm] = useState<{ type: ContinuityNote['type']; note: string }>({
    type: 'general',
    note: '',
  });
  const [snack, setSnack] = useState<{ msg: string; severity: 'success'|'error'|'info'|'warning' } | null>(null);
  // Right-panel tab: 0 = Takes, 1 = Notes
  const [rightPanelTab, setRightPanelTab] = useState<0 | 1>(0);
  // Inline note input at bottom of right panel
  const [inlineNoteText, setInlineNoteText] = useState('');

  // ── Settings ──────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState({
    autoIncrement: true,
    showTimer:     true,
    darkMode:      true,
    soundAlerts:   true,
  });

  useEffect(() => {
    if (!settings.darkMode) {
      setSettings((previous) => ({ ...previous, darkMode: true }));
    }
  }, [settings.darkMode]);

  // ── Responsive scaling (2K/4K/5K) ────────────────────────────────────────
  const is2K = useMediaQuery('(min-width: 2048px)');
  const is4K = useMediaQuery('(min-width: 3840px)');
  const is5K = useMediaQuery('(min-width: 5120px)');
  const liveSetShellMaxWidth = is5K ? 4700 : is4K ? 3900 : is2K ? 3000 : '100%';
  const leftPanelWidth = is5K ? 430 : is4K ? 390 : is2K ? 340 : 280;
  const rightPanelWidth = is5K ? 470 : is4K ? 410 : is2K ? 360 : 300;
  const heroButtonHeight = is5K ? 104 : is4K ? 94 : is2K ? 84 : 76;
  const heroButtonFontSize = is5K ? '2.35rem' : is4K ? '2.05rem' : is2K ? '1.9rem' : '1.75rem';
  const heroButtonIconSize = is5K ? 44 : is4K ? 38 : is2K ? 34 : 32;
  const dialSize = is5K ? 224 : is4K ? 202 : is2K ? 186 : 174;
  const dialInnerSize = dialSize - 20;
  const topBarPx = is5K ? 5 : is4K ? 4 : is2K ? 3 : 2.5;
  const centerPadX = is5K ? 4 : is4K ? 3.5 : is2K ? 3 : 2.5;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Pro: permissions ──────────────────────────────────────────────────────
  const can: LiveSetCan = useMemo(() => buildCan(userRole ?? 'director'), [userRole]);

  // ── Pro: multi-camera + CUT dialog ───────────────────────────────────────
  const defaultCamMeta = (): CameraMetadata => ({ cameraId: 'A', camera: 'A-cam', lens: '', fps: 24, iso: 800, ndFilter: '' });
  const [cameraMetadata, setCameraMetadata]           = useState<CameraMetadata>(defaultCamMeta);
  const [additionalCameras, setAdditionalCameras]     = useState<CameraMetadata[]>([]);
  const [showCutDialog, setShowCutDialog]             = useState(false);
  const [pendingCutStatus, setPendingCutStatus]       = useState<Take['status'] | null>(null);

  // ── Pro: export menu ──────────────────────────────────────────────────────
  const [exportAnchorEl, setExportAnchorEl] = useState<HTMLElement | null>(null);

  // ── Studio: realtime ─────────────────────────────────────────────────────
  const handleWsMessage = useCallback((msg: LiveSetWsMessage) => {
    if (msg.userId === userId) return; // echo from self - ignore
    const msgType = msg.type as LiveSetMsgType;
    switch (msgType) {
      case 'liveset:roll':
        setOptimisticRolling(true);
        setRollStartAt(new Date(msg.timestamp));
        break;
      case 'liveset:cut':
        // Remote cut: force full reload on next tick
        setOptimisticRolling(false);
        setTimeout(() => loadData(true), 200);
        break;
      case 'liveset:circle':
        setLiveStatus(prev => prev ? {
          ...prev,
          todayTakes: prev.todayTakes.map(t =>
            t.id === (msg.payload as { takeId?: string })?.takeId
              ? { ...t, status: 'circle' as const } : t,
          ),
        } : null);
        break;
      case 'liveset:note': {
        const incoming = msg.payload as ContinuityNote | undefined;
        if (incoming?.id) setContinuityNotes(prev =>
          prev.find(n => n.id === incoming.id) ? prev : [{ ...incoming, synced: true }, ...prev],
        );
        break;
      }
      case 'liveset:setup_done':
        loadData(true);
        break;
    }
  }, [userId]);

  const { connected: rtConnected, activeUsers } = useLiveSetRealtime({
    projectId,
    shootingDayId,
    userId,
    role:      userRole ?? 'director',
    onMessage: handleWsMessage,
    enabled:   true,
  });

  const mentionCandidates = useMemo(
    () => [
      ...activeUsers.map((user) => user.userId),
      ...continuityNotes.map((note) => note.createdBy),
      userId,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length >= 2),
    [activeUsers, continuityNotes, userId],
  );

  // Sync outbox when connection established
  useEffect(() => {
    if (!rtConnected) return;
    Outbox.flush(projectId, shootingDayId, async (entry) => {
      // Re-execute the original operation
      if (entry.type === 'add_note') {
        // addNote not yet exposed on productionWorkflowService; handled when service is extended
      } else if (entry.type === 'cut') {
        const p = entry.payload;
        await productionWorkflowService.cut(
          p.status as Take['status'], p.notes as string, p.camera as CameraMetadata,
        );
      }
      // TODO [Studio]: POST to /api/liveset/:projectId/* based on entry.type
    }).catch(() => {});
  }, [rtConnected]);

  // ─────────────────────────────────────────────────────────────────────────
  // Data fetching + polling (fix #6 + #10)
  // ─────────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (isRetry = false) => {
    if (!isRetry) setLoading(true);
    setError(null);
    try {
      const [status, day] = await Promise.all([
        productionWorkflowService.getLiveSetStatus(projectId),
        productionWorkflowService.getShootingDay(shootingDayId),
      ]);
      setLiveStatus(status);
      setShootingDay(day);
      setOptimisticRolling(null); // server state wins
      setRetryCount(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ukjent feil';
      setError(`Kunne ikke laste data: ${msg}`);
      if (retryCount < RETRY_MAX) {
        const delay = Math.min(1_000 * 2 ** retryCount, 30_000);
        retryTimeoutRef.current = setTimeout(() => {
          setRetryCount(c => c + 1);
          loadData(true);
        }, delay);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, shootingDayId, retryCount]);

  useEffect(() => {
    loadData();
    return () => { if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current); };
  }, []);

  useEffect(() => {
    pollIntervalRef.current = setInterval(() => loadData(true), POLL_INTERVAL_MS);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [loadData]);

  // ─────────────────────────────────────────────────────────────────────────
  // Timer — 1 000 ms interval (fix #2)
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRolling && rollStartAt) {
      interval = setInterval(
        () => setElapsedTime(Math.floor((Date.now() - rollStartAt.getTime()) / 1_000)),
        1_000,
      );
    } else if (!isRolling) {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [isRolling, rollStartAt]);

  // ─────────────────────────────────────────────────────────────────────────
  // Fullscreen sync (fix #7 — ESC safe)
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Notes persistence (fix #9)
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const localNotes = loadLocalNotes(projectId, shootingDayId);
    setContinuityNotes(localNotes);
    void loadPersistedNotes(projectId, shootingDayId)
      .then((notes) => {
        if (!cancelled) {
          setContinuityNotes(notes);
        }
      })
      .catch((error) => {
        console.warn('Kunne ikke laste DB-backed live-set-notater, bruker lokal cache.', error);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, shootingDayId]);

  const persistNotes = useCallback((notes: ContinuityNote[]) => {
    setContinuityNotes(notes);
    void savePersistedNotes(projectId, shootingDayId, notes).catch((error) => {
      console.warn('Kunne ikke lagre live-set-notater via settingsService, lokal cache er beholdt.', error);
    });
  }, [projectId, shootingDayId]);

  // ─────────────────────────────────────────────────────────────────────────
  // Quick note handler (fix #5)
  // ─────────────────────────────────────────────────────────────────────────

  const addQuickNote = useCallback((type: QuickNote['type'], label: string, takeId?: string) => {
    const noteTypeMap: Record<QuickNote['type'], ContinuityNote['type']> = {
      good: 'general', bad: 'general', tech: 'tech', sound: 'general', focus: 'tech',
    };
    const note: ContinuityNote = {
      id:        `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sceneId:   liveStatus?.currentScene || '',
      shotId:    liveStatus?.currentShot  || undefined,
      takeId,
      type:      noteTypeMap[type],
      note:      label,
      timestamp: new Date().toISOString(),
      createdBy: userId,
      synced:    false,
    };
    persistNotes([note, ...continuityNotes]);
    if (label.trim().length > 0) {
      void globalTagService
        .add([
          userId,
          ...globalTagService.parseExplicitMentions(label),
        ])
        .catch((error) => {
          console.warn('Kunne ikke oppdatere globalt tag-register fra live quick-note:', error);
        });
    }
    setSnack({ msg: `"${label}" loggført`, severity: 'info' });
  }, [liveStatus, userId, continuityNotes, persistNotes]);

  // ─────────────────────────────────────────────────────────────────────────
  // Rolling (fix #3 single source of truth + #4 autoIncrement + #8 userId)
  // ─────────────────────────────────────────────────────────────────────────

  /** Play a short Web Audio API beep — only when soundAlerts is enabled. */
  const playSoundAlert = useCallback((type: 'roll' | 'cut') => {
    if (!settings.soundAlerts) return;
    try {
      const ctx = new AudioContext();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = type === 'roll' ? 880 : 440;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (type === 'roll' ? 0.15 : 0.25));
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
      if (type === 'roll') {
        const osc2  = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1100;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.18, ctx.currentTime + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.38);
        osc2.start(ctx.currentTime + 0.18);
        osc2.stop(ctx.currentTime + 0.4);
      }
    } catch { /* AudioContext blocked (no user gesture yet) */ }
  }, [settings.soundAlerts]);

  const handleRoll = useCallback(async () => {
    if (!liveStatus?.currentScene || !liveStatus?.currentShot) {
      setSnack({ msg: 'Ingen aktiv scene/shot valgt', severity: 'warning' });
      return;
    }
    setOptimisticRolling(true);
    setRollStartAt(new Date());
    setElapsedTime(0);
    playSoundAlert('roll');
    try {
      await productionWorkflowService.startRolling(liveStatus.currentScene, liveStatus.currentShot);
    } catch {
      setOptimisticRolling(null);
      setSnack({ msg: 'ROLL feilet — sjekk tilkobling', severity: 'error' });
    }
  }, [liveStatus, playSoundAlert]);

  /** Open the CUT metadata dialog for the given take status. */
  const openCutDialog = useCallback((status: Take['status']) => {
    if (!can.cut) {
      setSnack({ msg: 'Ikke tilgang til å cutte', severity: 'warning' });
      return;
    }
    setPendingCutStatus(status);
    setShowCutDialog(true);
  }, [can]);

  /** Confirm CUT — logs take, resets rolling state, enqueues to outbox if offline. */
  const confirmCut = useCallback(async () => {
    if (!pendingCutStatus) return;
    const status = pendingCutStatus;
    setOptimisticRolling(false);
    setShowCutDialog(false);
    setPendingCutStatus(null);
    try {
      const take = await productionWorkflowService.cut(
        status,
        undefined,                                              // notes (captured via addQuickNote separately)
        cameraMetadata,
        additionalCameras.length > 0 ? additionalCameras : undefined,
        settings.autoIncrement ? undefined : (liveStatus?.currentTake ?? 1) + 1,
        userId,
      );
      setLiveStatus(prev =>
        prev ? {
          ...prev,
          isRolling:   false,
          currentTake: settings.autoIncrement ? (prev.currentTake ?? 1) + 1 : prev.currentTake,
          todayTakes:  [...prev.todayTakes, take],
        } : null,
      );
      playSoundAlert('cut');
      setAdditionalCameras([]);
      setSnack({ msg: `Take ${take.takeNumber} loggført — ${status.toUpperCase()}`, severity: 'success' });
      // Studio: rt.send('liveset:cut', { takeId: take.id, status });
    } catch {
      Outbox.enqueue(
        'cut',
        Outbox.OutboxPayload.cut(
          status,
          liveStatus?.currentTake ?? 1,
          elapsedTime,
          undefined,
          cameraMetadata.camera,
          cameraMetadata.lens,
          cameraMetadata.fps,
          cameraMetadata.iso,
          cameraMetadata.ndFilter,
        ),
        projectId,
        shootingDayId,
      );
      setOptimisticRolling(false);
      setSnack({ msg: 'CUT lagret i outbox (offline)', severity: 'warning' });
    }
  }, [pendingCutStatus, cameraMetadata, additionalCameras, settings, liveStatus, userId, projectId, shootingDayId, elapsedTime, playSoundAlert]);

  const handleCircleTake = useCallback(async (takeId: string) => {
    if (!can.circleTake) {
      setSnack({ msg: 'Script supervisor-tilgang nødvendig for å sirkle takes', severity: 'warning' });
      return;
    }
    try {
      await productionWorkflowService.circleTake(takeId, userId);
      setLiveStatus(prev =>
        prev
          ? { ...prev, todayTakes: prev.todayTakes.map(t => t.id === takeId ? { ...t, status: 'circle' as const } : t) }
          : null,
      );
      setSnack({ msg: 'Take sirklet', severity: 'success' });
      // Studio: rt.send('liveset:circle', { takeId });
    } catch {
      Outbox.enqueue('circle_take', Outbox.OutboxPayload.circleTake(takeId, userId), projectId, shootingDayId);
      setSnack({ msg: 'Sirkling lagret i outbox', severity: 'warning' });
    }
  }, [can, userId, projectId, shootingDayId]);

  const adjustTake = useCallback((delta: 1 | -1) => {
    setLiveStatus(prev => prev ? { ...prev, currentTake: Math.max(1, (prev.currentTake ?? 1) + delta) } : null);
  }, []);

  const handleAddNote = useCallback(() => {
    if (!noteForm.note.trim()) return;
    const note: ContinuityNote = {
      id:        `note-${Date.now()}`,
      sceneId:   liveStatus?.currentScene || '',
      shotId:    liveStatus?.currentShot  || undefined,
      type:      noteForm.type,
      note:      noteForm.note,
      timestamp: new Date().toISOString(),
      createdBy: userId,
      synced:    false,
    };
    persistNotes([note, ...continuityNotes]);
    void globalTagService
      .add([
        userId,
        ...globalTagService.parseExplicitMentions(noteForm.note),
      ])
      .catch((error) => {
        console.warn('Kunne ikke oppdatere globalt tag-register fra live notat:', error);
      });
    setNoteForm({ type: 'general', note: '' });
    setShowNoteDialog(false);
    setSnack({ msg: 'Notat lagret lokalt', severity: 'success' });
  }, [noteForm, liveStatus, userId, continuityNotes, persistNotes]);

  const handleNextSetup = useCallback(async () => {
    if (!can.completeSetup) {
      setSnack({ msg: 'Ikke tilgang til setup-navigering', severity: 'warning' });
      return;
    }
    const next = await productionWorkflowService.nextSetup(shootingDayId);
    if (next) {
      setLiveStatus(prev => prev ? { ...prev, currentScene: next.sceneId, currentShot: next.shotId, currentTake: 1 } : null);
      setSnack({ msg: `Neste setup: Scene ${next.sceneId.replace('scene-', '')}`, severity: 'info' });
      // Studio: rt.send('liveset:setup_done', { nextScene: next.sceneId });
    } else {
      setSnack({ msg: 'Ingen flere scener planlagt for i dag', severity: 'info' });
    }
  }, [can, shootingDayId]);

  const handleMarkSetupComplete = useCallback(async () => {
    if (!can.completeSetup) {
      setSnack({ msg: 'Ikke tilgang til setup-navigering', severity: 'warning' });
      return;
    }
    if (liveStatus?.currentScene) {
      await productionWorkflowService.setupComplete(
        liveStatus.currentScene, liveStatus.currentShot ?? '', userId,
      );
    }
    addQuickNote('tech', '✅ Setup markert ferdig');
    setSnack({ msg: 'Setup markert ferdig', severity: 'success' });
  }, [can, liveStatus, userId, addQuickNote]);

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard shortcuts (placed after all callbacks so they are in scope)
  //   R → ROLL  |  C → CUT  |  N → Note  |  ↑↓ → ±Take  |  Enter → Confirm  |  Esc → Close
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      switch (e.key) {
        case 'r': case 'R':
          if (!isRolling && !showCutDialog && !showNoteDialog && !showSettingsDialog) { e.preventDefault(); handleRoll(); } break;
        case 'c': case 'C':
          if (isRolling && !showCutDialog) { e.preventDefault(); openCutDialog('ok'); } break;
        case 'n': case 'N':
          if (!showCutDialog && !showNoteDialog && !showSettingsDialog) { e.preventDefault(); setShowNoteDialog(true); } break;
        case 'ArrowUp':
          if (!settings.autoIncrement && !showCutDialog && !showNoteDialog) { e.preventDefault(); adjustTake(1); } break;
        case 'ArrowDown':
          if (!settings.autoIncrement && !showCutDialog && !showNoteDialog) { e.preventDefault(); adjustTake(-1); } break;
        case 'Enter':
          if (showCutDialog) { e.preventDefault(); confirmCut(); } break;
        case 'Escape':
          if (showCutDialog) { e.preventDefault(); setShowCutDialog(false); setPendingCutStatus(null); }
          else if (showNoteDialog) { e.preventDefault(); setShowNoteDialog(false); }
          else if (showSettingsDialog) { e.preventDefault(); setShowSettingsDialog(false); }
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isRolling, showCutDialog, showNoteDialog, showSettingsDialog, settings.autoIncrement,
      handleRoll, openCutDialog, adjustTake, confirmCut]);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived
  // ─────────────────────────────────────────────────────────────────────────

  const progress = liveStatus?.todayProgress ?? {
    plannedScenes: 0, completedScenes: 0, partialScenes: 0,
    totalSetups: 0, completedSetups: 0, pagesPlanned: 0, pagesShot: 0,
  };
  const progressPercent = progress.totalSetups > 0
    ? (progress.completedSetups / progress.totalSetups) * 100
    : 0;
  const unsyncedCount = continuityNotes.filter(n => !n.synced).length;
  const outboxCount   = Outbox.pendingCount(projectId, shootingDayId);
  const totalUnsynced = outboxCount + unsyncedCount;
  const currentSceneId = liveStatus?.currentScene ?? '';
  const currentSceneIndex = shootingDay?.scenes ? shootingDay.scenes.indexOf(currentSceneId) : -1;
  const nextSceneId = currentSceneIndex >= 0 && shootingDay?.scenes
    ? shootingDay.scenes[currentSceneIndex + 1] ?? null
    : null;
  const crewTotal = Object.keys(shootingDay?.crewCallTimes ?? {}).length;
  const crewPresent = activeUsers.length;
  const equipmentTotal = shootingDay?.equipmentNeeded?.length ?? 0;
  const weatherCondition = shootingDay?.weather?.condition ?? null;
  const weatherLabel = weatherCondition
    ? ({
        sunny: 'Sol',
        cloudy: 'Skyet',
        rain: 'Regn',
        snow: 'Snø',
        fog: 'Tåke',
        wind: 'Vind',
      } as const)[weatherCondition]
    : 'Vær ukjent';
  const weatherRiskLabel = weatherCondition
    ? ({
        sunny: 'Lav risiko',
        cloudy: 'Lav risiko',
        rain: 'Forhøyet risiko',
        snow: 'Høy risiko',
        fog: 'Middels risiko',
        wind: 'Middels risiko',
      } as const)[weatherCondition]
    : 'Middels risiko';
  const weatherRiskColor =
    weatherRiskLabel === 'Høy risiko'
      ? '#ef4444'
      : weatherRiskLabel === 'Forhøyet risiko'
        ? '#f59e0b'
        : weatherRiskLabel === 'Middels risiko'
          ? '#facc15'
          : '#22c55e';
  const shootingDayLabel = shootingDay?.date
    ? new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(shootingDay.date))
    : null;

  // Studio: Unified activity feed — interleaved takes + notes ──────────────
  const activityFeed = useMemo(() => {
    type FeedItem =
      | { kind: 'take'; ts: string; take: Take }
      | { kind: 'note'; ts: string; note: ContinuityNote };

    const items: FeedItem[] = [
      ...(liveStatus?.todayTakes ?? []).map(t => ({ kind: 'take' as const, ts: t.loggedAt ?? t.recordedAt, take: t })),
      ...continuityNotes.map(n => ({ kind: 'note' as const, ts: n.timestamp, note: n })),
    ];
    return items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [liveStatus?.todayTakes, continuityNotes]);

  // Export helpers (Pro tier)
  const buildExportCtx = useCallback((): ExportContext => ({
    projectTitle,
    projectId,
    shootingDay:  shootingDay!,
    takes:        liveStatus?.todayTakes ?? [],
    notes:        continuityNotes,
    exportedBy:   userId,
    exportedAt:   new Date().toISOString(),
  }), [projectTitle, projectId, shootingDay, liveStatus, continuityNotes, userId]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const bg     = '#0d0d0d';
  const panel  = '#1a1a1a';
  const border = '#2a2a2a';
  const text   = '#ffffff';
  const muted  = 'rgba(255,255,255,0.5)';

  return (
    <Box sx={{ position: 'fixed', inset: 0, bgcolor: bg, color: text, zIndex: 9999,
               display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'monospace' }}>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                 width: '100%', maxWidth: liveSetShellMaxWidth, mx: 'auto',
                 px: topBarPx, py: is2K ? 1.5 : 1.25, borderBottom: `1px solid ${border}`, flexShrink: 0,
                 bgcolor: '#111' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h6" fontWeight={900} sx={{ letterSpacing: '0.08em', fontSize: '1.1rem' }}>
            🎬 LIVE SET MODE
          </Typography>
          {shootingDay && (
            <Chip label={`Dag ${shootingDay.dayNumber}${shootingDay.location ? ` — ${shootingDay.location}` : ''}`}
              color="primary" variant="outlined" size="small" />
          )}
          {isRolling && (
            <Chip icon={<RecordIcon sx={{ fontSize: 14 }} />} label="ROLLING" color="error" size="small"
              sx={{ animation: 'pulse 1s ease-in-out infinite', fontWeight: 700 }} />
          )}
          {unsyncedCount > 0 && (
            <Chip icon={<OfflineIcon sx={{ fontSize: 13 }} />}
              label={`${outboxCount + unsyncedCount} ikke synkronisert`} size="small"
              sx={{ bgcolor: 'rgba(147,51,234,0.15)', color: '#c084fc', border: '1px solid rgba(147,51,234,0.3)' }} />
          )}
          {/* Studio: realtime connection indicator */}
          <Chip
            icon={rtConnected ? <OnlineIcon sx={{ fontSize: 12 }} /> : <OfflineIcon sx={{ fontSize: 12 }} />}
            label={rtConnected ? 'Live' : 'Polling'}
            size="small"
            sx={{ bgcolor: rtConnected ? 'rgba(76,175,80,0.12)' : 'rgba(158,158,158,0.12)',
                  color: rtConnected ? '#66bb6a' : muted, border: '1px solid', display: { xs: 'none', sm: 'flex' } }}
          />
          {/* Studio: presence avatars */}
          {activeUsers.length > 0 && (
            <Tooltip title={activeUsers.map(u => `${u.userId} (${u.role})`).join(', ')}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PeopleIcon sx={{ fontSize: 15, color: muted }} />
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {activeUsers.slice(0, 4).map((u: PresenceEntry, index) => (
                    <Avatar
                      key={u.userId}
                      sx={{
                        bgcolor: '#1565c0',
                        border: '1px solid rgba(255,255,255,0.35)',
                        fontSize: '0.65rem',
                        height: 24,
                        ml: index === 0 ? 0 : -0.75,
                        width: 24,
                      }}
                    >
                      {u.userId.slice(0, 2).toUpperCase()}
                    </Avatar>
                  ))}
                </Box>
              </Box>
            </Tooltip>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {/* Pro: export menu */}
          {can.export && shootingDay && (
            <>
              <Tooltip title="Eksporter">
                <IconButton size="small" sx={{ color: muted }} onClick={e => setExportAnchorEl(e.currentTarget)}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu open={Boolean(exportAnchorEl)} anchorEl={exportAnchorEl} onClose={() => setExportAnchorEl(null)}
                PaperProps={{ sx: { bgcolor: panel, color: text } }}>
                <MenuItem onClick={() => { exportDailyReportPdf(buildExportCtx()); setExportAnchorEl(null); }}>PDF — Daglig rapport</MenuItem>
                <MenuItem onClick={() => { exportCirclePrintPdf(buildExportCtx()); setExportAnchorEl(null); }}>PDF — Circle/Print liste</MenuItem>
                <MenuItem onClick={() => { exportTakesCsv(buildExportCtx()); setExportAnchorEl(null); }}>CSV — Alle takes</MenuItem>
                <MenuItem onClick={() => { exportNotesCsv(buildExportCtx()); setExportAnchorEl(null); }}>CSV — Notater</MenuItem>
              </Menu>
            </>
          )}
          <Tooltip title="Innstillinger">
            <IconButton onClick={() => setShowSettingsDialog(true)} size="small" sx={{ color: muted }}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={isFullscreen ? 'Avslutt fullskjerm' : 'Fullskjerm'}>
            <IconButton onClick={toggleFullscreen} size="small" sx={{ color: muted }}>
              {isFullscreen ? <ExitFullscreenIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Oppdater nå">
            <IconButton onClick={() => loadData()} size="small" sx={{ color: muted }} disabled={loading}>
              {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Button variant="outlined" size="small" color="inherit" onClick={onClose}
            sx={{ ml: 1, borderColor: border }}>
            Avslutt
          </Button>
        </Box>
      </Box>

      {/* ── Ops overview rail (more structured at-a-glance info) ─────────── */}
      <Box
        sx={{
          width: '100%',
          maxWidth: liveSetShellMaxWidth,
          mx: 'auto',
          px: topBarPx,
          py: is2K ? 1.15 : 0.95,
          borderBottom: `1px solid ${border}`,
          bgcolor: '#060d1f',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.85,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
          <Chip
            icon={<MovieIcon sx={{ fontSize: 14 }} />}
            label={`Aktiv scene · ${currentSceneId ? `scene-${currentSceneId.replace('scene-', '')}` : 'ikke valgt'}`}
            size="small"
            sx={{
              bgcolor: 'rgba(56,189,248,0.12)',
              color: '#7dd3fc',
              border: '1px solid rgba(56,189,248,0.35)',
              height: is2K ? 26 : 24,
              fontSize: is2K ? '0.78rem' : '0.73rem',
            }}
          />
          <Chip
            icon={<RecordIcon sx={{ fontSize: 12 }} />}
            label={`Fase · ${isRolling ? 'Opptak' : 'Forberedelse'}`}
            size="small"
            sx={{
              bgcolor: isRolling ? 'rgba(239,68,68,0.16)' : 'rgba(139,92,246,0.14)',
              color: isRolling ? '#fca5a5' : '#c4b5fd',
              border: isRolling ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(139,92,246,0.35)',
              height: is2K ? 26 : 24,
              fontSize: is2K ? '0.78rem' : '0.73rem',
            }}
          />
          <Chip
            icon={totalUnsynced > 0 ? <RefreshIcon sx={{ fontSize: 12 }} /> : <OnlineIcon sx={{ fontSize: 12 }} />}
            label={totalUnsynced > 0 ? `Shot List-synk pågår (${totalUnsynced})` : 'Shot List-synk klar'}
            size="small"
            sx={{
              bgcolor: totalUnsynced > 0 ? 'rgba(245,158,11,0.14)' : 'rgba(16,185,129,0.14)',
              color: totalUnsynced > 0 ? '#fcd34d' : '#6ee7b7',
              border: totalUnsynced > 0 ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(16,185,129,0.35)',
              height: is2K ? 26 : 24,
              fontSize: is2K ? '0.78rem' : '0.73rem',
            }}
          />
          {nextSceneId && (
            <Chip
              icon={<NextSetupIcon sx={{ fontSize: 14 }} />}
              label={`Neste · ${nextSceneId}`}
              size="small"
              sx={{
                bgcolor: 'rgba(59,130,246,0.14)',
                color: '#93c5fd',
                border: '1px solid rgba(59,130,246,0.35)',
                height: is2K ? 26 : 24,
                fontSize: is2K ? '0.78rem' : '0.73rem',
              }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
          <Chip
            icon={<PeopleIcon sx={{ fontSize: 14 }} />}
            label={`Crew til stede ${crewPresent}/${crewTotal || '-'} `}
            size="small"
            sx={{
              bgcolor: 'rgba(37,99,235,0.14)',
              color: '#93c5fd',
              border: '1px solid rgba(37,99,235,0.35)',
              height: is2K ? 26 : 24,
              fontSize: is2K ? '0.78rem' : '0.73rem',
            }}
          />
          <Chip
            icon={<CameraIcon sx={{ fontSize: 14 }} />}
            label={`Utstyr klart ${progress.completedSetups}/${Math.max(progress.totalSetups, equipmentTotal || 1)}`}
            size="small"
            sx={{
              bgcolor: 'rgba(16,185,129,0.14)',
              color: '#6ee7b7',
              border: '1px solid rgba(16,185,129,0.35)',
              height: is2K ? 26 : 24,
              fontSize: is2K ? '0.78rem' : '0.73rem',
            }}
          />
          <Chip
            icon={<LightbulbIcon sx={{ fontSize: 14 }} />}
            label={`Vær · ${weatherLabel}${shootingDay?.weather?.temperature !== undefined ? ` ${shootingDay.weather.temperature}°C` : ''}`}
            size="small"
            sx={{
              bgcolor: 'rgba(56,189,248,0.12)',
              color: '#7dd3fc',
              border: '1px solid rgba(56,189,248,0.35)',
              height: is2K ? 26 : 24,
              fontSize: is2K ? '0.78rem' : '0.73rem',
            }}
          />
          <Chip
            icon={<WarningIcon sx={{ fontSize: 14 }} />}
            label={weatherRiskLabel}
            size="small"
            sx={{
              bgcolor: `${weatherRiskColor}22`,
              color: weatherRiskColor,
              border: `1px solid ${weatherRiskColor}66`,
              height: is2K ? 26 : 24,
              fontSize: is2K ? '0.78rem' : '0.73rem',
              fontWeight: 700,
            }}
          />
          {shootingDayLabel && (
            <Typography sx={{ ml: 0.35, color: muted, fontSize: is2K ? '0.76rem' : '0.7rem', fontWeight: 500 }}>
              {shootingDayLabel}
            </Typography>
          )}
        </Box>
      </Box>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && (
        <Alert severity="error" sx={{ borderRadius: 0, py: 0.5 }}
          action={<Button color="inherit" size="small" onClick={() => { setRetryCount(0); loadData(); }}>Prøv igjen</Button>}>
          {error}{!navigator.onLine ? ' — Du er offline. Data lagres lokalt.' : ''}
        </Alert>
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', width: '100%', maxWidth: liveSetShellMaxWidth, mx: 'auto' }}>

        {/* ── Left panel ── */}
        <Box sx={{ width: { xs: '100%', md: leftPanelWidth }, flexShrink: 0,
                   display: 'flex', flexDirection: 'column', overflow: 'hidden',
                   bgcolor: '#0a0a0a',
                   borderRight: { md: `1px solid ${border}` } }}>

          {/* ── ROLL / CUT hero button ──────────────────────────────────── */}
          {!isRolling ? (
            <Button onClick={handleRoll} disabled={loading && liveStatus === null} fullWidth
              sx={{ height: heroButtonHeight, borderRadius: 0, fontSize: heroButtonFontSize, fontWeight: 900,
                    letterSpacing: '0.15em', flexShrink: 0, fontFamily: 'monospace',
                    bgcolor: '#c62828', color: '#fff', '&:hover': { bgcolor: '#b71c1c' },
                    borderBottom: '3px solid #8e0000' }}>
              <PlayIcon sx={{ fontSize: heroButtonIconSize, mr: 1 }} />
              ROLL
            </Button>
          ) : (
            <Button onClick={() => openCutDialog('ok')} fullWidth
              sx={{ height: heroButtonHeight, borderRadius: 0, fontSize: heroButtonFontSize, fontWeight: 900,
                    letterSpacing: '0.15em', flexShrink: 0, fontFamily: 'monospace',
                    bgcolor: '#1c1c1c', color: text,
                    borderBottom: `3px solid ${border}`,
                    '&:hover': { bgcolor: '#252525' } }}>
              <StopIcon sx={{ fontSize: heroButtonIconSize, mr: 1 }} />
              CUT
            </Button>
          )}

          <Box sx={{ px: is2K ? 2.25 : 2, py: is2K ? 1.75 : 1.5, display: 'flex', flexDirection: 'column', gap: is2K ? 1.75 : 1.5,
                     flex: 1, overflowY: 'auto' }}>

            {/* ── Circular dial timer ─────────────────────────────────── */}
            {settings.showTimer && (
              <Box sx={{ position: 'relative', width: dialSize, height: dialSize, borderRadius: '50%',
                         mx: 'auto', my: 0.5, flexShrink: 0,
                         border: `5px solid ${isRolling ? '#c62828' : '#2a2a2a'}`,
                         boxShadow: isRolling
                           ? '0 0 22px rgba(198,40,40,0.45), inset 0 0 12px rgba(198,40,40,0.06)'
                           : 'none',
                         display: 'flex', alignItems: 'center', justifyContent: 'center',
                         transition: 'border-color 0.4s, box-shadow 0.4s',
                         background: 'radial-gradient(circle at 40% 40%, #1c1c1c 60%, #111 100%)' }}>
                <Box sx={{ position: 'absolute', width: dialInnerSize, height: dialInnerSize, borderRadius: '50%',
                           border: `1px solid ${isRolling ? 'rgba(198,40,40,0.3)' : border}`,
                           transition: 'border-color 0.4s' }} />
                <Box sx={{ zIndex: 1, textAlign: 'center' }}>
                  <Typography fontFamily="monospace" fontWeight={900} lineHeight={1}
                    sx={{ fontSize: is5K ? '3rem' : is4K ? '2.8rem' : is2K ? '2.65rem' : '2.5rem', color: isRolling ? '#ef5350' : '#c8a96e',
                          letterSpacing: '-0.02em', display: 'block' }}>
                    {formatTime(elapsedTime)}
                  </Typography>
                  <Typography variant="caption"
                    sx={{ color: isRolling ? '#ef5350' : muted,
                          fontSize: '0.58rem', letterSpacing: '0.14em', display: 'block', mt: 0.25 }}>
                    {isRolling ? '● ROLLING' : 'KLAR'}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* ── Scene | Take boxes ──────────────────────────────────── */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              {([
                { label: 'SCENE', value: liveStatus?.currentScene?.replace('scene-', '') || '--' },
                { label: 'TAKE',  value: String(liveStatus?.currentTake ?? 1).padStart(2, '0') },
              ] as { label: string; value: string }[]).map(({ label, value }) => (
                <Box key={label} sx={{ flex: 1, bgcolor: '#1a1a1a',
                                       borderRadius: 1.5, p: 1, textAlign: 'center',
                                       border: `1px solid ${border}` }}>
                  <Typography variant="caption"
                    sx={{ color: muted, fontSize: '0.58rem', letterSpacing: '0.12em', display: 'block' }}>
                    {label}
                  </Typography>
                  <Typography fontFamily="monospace" fontWeight={900}
                    sx={{ fontSize: '1.4rem', lineHeight: 1.15, color: text }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Camera label + manual take ± controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
              <Typography variant="caption"
                sx={{ color: muted, fontSize: '0.72rem', letterSpacing: '0.08em' }}>
                CAM {cameraMetadata.cameraId} / {cameraMetadata.lens || '—'}
              </Typography>
              {!settings.autoIncrement && (
                <>
                  <IconButton size="small" onClick={() => adjustTake(-1)} sx={{ color: muted, p: 0.3 }}>
                    <TakeDownIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => adjustTake(1)} sx={{ color: muted, p: 0.3 }}>
                    <TakeUpIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </>
              )}
            </Box>

            {/* CUT grading buttons — shown when rolling */}
            {isRolling && (
              <Box sx={{ display: 'flex', gap: 0.75 }}>
                <Button size="small" variant="contained" fullWidth onClick={() => openCutDialog('good')}
                  sx={{ bgcolor: '#2e7d32', fontWeight: 700, fontSize: '0.72rem', py: 0.75 }}>GOD</Button>
                <Button size="small" variant="contained" fullWidth onClick={() => openCutDialog('circle')}
                  sx={{ bgcolor: '#1565c0', fontWeight: 700, fontSize: '0.72rem', py: 0.75 }}>CIRCLE</Button>
                <Button size="small" variant="outlined" fullWidth onClick={() => openCutDialog('bad')}
                  sx={{ borderColor: '#b71c1c', color: '#ef5350', fontWeight: 700,
                        fontSize: '0.72rem', py: 0.75 }}>BAD</Button>
              </Box>
            )}

            <Divider sx={{ borderColor: border }} />

            {/* ── Quick note buttons (icon + label) ──────────────────── */}
            <Box>
              <Typography variant="caption"
                sx={{ color: muted, fontSize: '0.6rem', letterSpacing: '0.1em', display: 'block', mb: 0.75 }}>
                QUICK NOTES
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
                {LEFT_PANEL_NOTES.map(qn => (
                  <Button key={qn.type} size="small" variant="outlined"
                    onClick={() => addQuickNote(qn.type, qn.label)}
                    startIcon={qn.icon}
                    sx={{ borderColor: border, color: text, justifyContent: 'flex-start',
                          fontSize: '0.68rem', py: 0.75, px: 1, textTransform: 'none',
                          '&:hover': { bgcolor: '#1a1a1a', borderColor: '#555' } }}>
                    {qn.label}
                  </Button>
                ))}
              </Box>
            </Box>

            <Divider sx={{ borderColor: border }} />

            {/* Setup navigation */}
            <Button size="small" startIcon={<NextSetupIcon sx={{ fontSize: 18 }} />}
              onClick={handleNextSetup}
              sx={{ color: muted, justifyContent: 'flex-start', textTransform: 'none',
                    fontSize: '0.78rem', p: 0, letterSpacing: '0.04em',
                    '&:hover': { color: text, bgcolor: 'transparent' } }}>
              → Next Scene
            </Button>
            <Button variant="outlined" size="small" fullWidth
              startIcon={<MarkCompleteIcon sx={{ fontSize: 18 }} />}
              onClick={handleMarkSetupComplete}
              sx={{ borderColor: border, color: '#66bb6a', fontSize: '0.75rem',
                    textTransform: 'none', justifyContent: 'flex-start',
                    '&:hover': { borderColor: '#66bb6a', bgcolor: 'rgba(102,187,106,0.05)' } }}>
              Setup Complete ›
            </Button>
          </Box>
        </Box>

        {/* ── Center: Current Scene (md+) ──────────────────────────────────── */}
        <Box sx={{ flex: 1, display: { xs: 'none', md: 'flex' }, flexDirection: 'column',
                   borderRight: `1px solid ${border}`, overflowY: 'auto', minWidth: 0 }}>

          {/* Scene header */}
          <Box sx={{ px: centerPadX, pt: is2K ? 2.25 : 2, pb: is2K ? 1.75 : 1.5, borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
            <Typography variant="overline"
              sx={{ color: muted, fontSize: '0.65rem', letterSpacing: '0.14em', display: 'block' }}>
              CURRENT SCENE
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap', mt: 0.25 }}>
              <Typography variant="h5" fontWeight={900} fontFamily="monospace">
                SCENE {liveStatus?.currentScene?.replace('scene-', '') ?? '--'}
              </Typography>
              {shootingDay?.location && (
                <Typography variant="body1" sx={{ color: muted, fontWeight: 500, letterSpacing: '0.06em' }}>
                  {shootingDay.location.toUpperCase()}
                </Typography>
              )}
              {shootingDay?.callTime && (
                <Chip label={shootingDay.callTime} size="small"
                  sx={{ bgcolor: 'rgba(147,51,234,0.12)', color: '#c084fc',
                        fontSize: '0.68rem', height: 20, border: '1px solid rgba(147,51,234,0.2)' }} />
              )}
              {isRolling && (
                <Chip icon={<RecordIcon sx={{ fontSize: '12px !important' }} />}
                  label="ROLLING" size="small" color="error"
                  sx={{ height: 20, fontSize: '0.65rem', animation: 'pulse 1s ease-in-out infinite' }} />
              )}
            </Box>
            {shootingDay?.notes && (
              <Typography variant="body2" sx={{ color: muted, mt: 0.75, lineHeight: 1.6 }}>
                {shootingDay.notes}
              </Typography>
            )}
          </Box>

          {/* Storyboard image grid — 1 large + 2 thumbnails */}
          <Box sx={{ px: centerPadX, pt: is2K ? 2.25 : 2, pb: is2K ? 1.25 : 1, flexShrink: 0 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 0.65fr',
                       gridTemplateRows: 'auto auto', gap: 0.75 }}>
              <Box sx={{ gridRow: '1 / 3', aspectRatio: '16/9',
                         bgcolor: '#181818',
                         borderRadius: 1.5, border: `1px solid ${border}`,
                         display: 'flex', flexDirection: 'column',
                         alignItems: 'center', justifyContent: 'center',
                         minHeight: is2K ? 176 : 140, position: 'relative', overflow: 'hidden' }}>
                <PhotoCameraIcon sx={{ color: muted, fontSize: is2K ? 44 : 38, opacity: 0.6 }} />
                <Typography variant="caption"
                  sx={{ color: muted, fontSize: '0.65rem', position: 'absolute', bottom: 8,
                        left: 0, right: 0, textAlign: 'center', letterSpacing: '0.06em' }}>
                  {liveStatus?.currentShot
                    ? `Shot ${liveStatus.currentShot.split('-').pop()}`
                    : 'Principal reference'}
                </Typography>
              </Box>
              {[1, 2].map(i => (
                <Box key={i} sx={{ aspectRatio: '16/9', bgcolor: '#141414',
                                   borderRadius: 1, border: `1px solid ${border}`,
                                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                                   minHeight: 60 }}>
                  <PhotoCameraIcon sx={{ color: muted, fontSize: 18, opacity: 0.5 }} />
                </Box>
              ))}
            </Box>
          </Box>

          {/* Scene description + camera data bar */}
          <Box sx={{ px: centerPadX, pb: is2K ? 1.75 : 1.5, flexShrink: 0 }}>
            <Typography variant="body2" sx={{ color: text, lineHeight: 1.7, mb: 1.25 }}>
              {shootingDay?.notes
                ? shootingDay.notes
                : `Scene ${liveStatus?.currentScene?.replace('scene-', '') ?? '--'} · Shot ${liveStatus?.currentShot?.split('-').pop() ?? '--'}.`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', py: 0.75,
                       borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`,
                       flexWrap: 'wrap' }}>
              <Typography variant="caption" fontFamily="monospace"
                sx={{ fontWeight: 700, color: '#64b5f6', fontSize: '0.78rem' }}>
                CAM {cameraMetadata.cameraId} / {cameraMetadata.lens || '—'}
              </Typography>
              {([
                ['FPS', cameraMetadata.fps   ?? '—'],
                ['ISO', cameraMetadata.iso   ?? '—'],
                ['ND',  cameraMetadata.ndFilter || '—'],
              ] as [string, string | number][]).map(([k, v]) => (
                <Typography key={k} variant="caption"
                  sx={{ color: muted, fontFamily: 'monospace', fontSize: '0.72rem' }}>
                  {k}{' '}
                  <Box component="span" sx={{ color: text, fontWeight: 600 }}>{v}</Box>
                </Typography>
              ))}
              {liveStatus?.todayTakes && liveStatus.todayTakes.length > 0 && (() => {
                const last = liveStatus.todayTakes[liveStatus.todayTakes.length - 1];
                return (
                  <Typography variant="caption" sx={{ color: muted, ml: 'auto', fontSize: '0.68rem' }}>
                    Last updated by {last.loggedBy ?? userId} {timeAgo(last.loggedAt ?? last.recordedAt)}
                  </Typography>
                );
              })()}
            </Box>
          </Box>

          {/* ─ Next Scene separator bar ─ */}
          <Box sx={{ px: is2K ? 2.5 : 2, py: 0.75, display: 'flex', alignItems: 'center', gap: 1,
                     borderBottom: `1px solid ${border}`, bgcolor: '#0f0f0f',
                     flexShrink: 0 }}>
            <NextSetupIcon sx={{ color: muted, fontSize: 18 }} />
            <Typography variant="body2" fontWeight={700}
              sx={{ fontSize: '0.78rem', letterSpacing: '0.06em', mr: 'auto' }}>
              {(() => {
                const sceneList = shootingDay?.scenes ?? [];
                const idx = sceneList.indexOf(liveStatus?.currentScene ?? '');
                const next = idx >= 0 ? sceneList[idx + 1] : null;
                return next ? (
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <MovieIcon sx={{ fontSize: 14, color: muted }} />
                    Scene {next.replace('scene-', '')}
                  </Box>
                ) : 'Next Scene';
              })()}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.25 }}>
              {can.export && shootingDay && (
                <Tooltip title="Eksporter">
                  <IconButton size="small" sx={{ color: muted }}
                    onClick={e => setExportAnchorEl(e.currentTarget)}>
                    <DownloadIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Innstillinger">
                <IconButton size="small" sx={{ color: muted }}
                  onClick={() => setShowSettingsDialog(true)}>
                  <SettingsIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Oppdater">
                <IconButton size="small" sx={{ color: muted }}
                  onClick={() => loadData()} disabled={loading}>
                  {loading ? <CircularProgress size={13} /> : <RefreshIcon sx={{ fontSize: 17 }} />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Collaborative activity feed */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: centerPadX, py: is2K ? 1.75 : 1.5 }}>
            {activityFeed.length === 0 && (
              <Typography variant="body2" sx={{ color: muted, textAlign: 'center', mt: 5 }}>
                Ingen aktivitet ennå
              </Typography>
            )}
            {activityFeed.map(item => (
              <Box key={item.kind === 'take' ? item.take.id : item.note.id}
                sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'flex-start' }}>
                <Avatar sx={{ width: 30, height: 30, bgcolor: '#1565c0', fontSize: '0.68rem', flexShrink: 0 }}>
                  {(item.kind === 'take'
                    ? (item.take.loggedBy ?? 'U')
                    : item.note.createdBy
                  ).slice(0, 2).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
                      {item.kind === 'take' ? (item.take.loggedBy ?? 'Unknown') : item.note.createdBy}
                    </Typography>
                    <Typography variant="body2" sx={{ color: muted, fontSize: '0.82rem' }}>
                      {item.kind === 'take' ? 'logged' : 'wrote:'}
                    </Typography>
                    {item.kind === 'take' ? (
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Box sx={{ width: 18, height: 18, borderRadius: '50%',
                                   bgcolor: TAKE_STATUS_COLORS[item.take.status],
                                   display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                   color: '#fff', fontWeight: 900, fontSize: '0.6rem',
                                   fontFamily: 'monospace' }}>
                          {item.take.takeNumber}
                        </Box>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
                          Take {item.take.takeNumber} — {item.take.status.toUpperCase()}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
                        {item.note.note.length > 72
                          ? `${item.note.note.slice(0, 72)}…`
                          : item.note.note}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="caption" sx={{ color: muted, fontSize: '0.67rem' }}>
                    {timeAgo(item.ts)}
                    {item.kind === 'take'
                      ? (item.take.cameraId ? ` · Cam-${item.take.cameraId}` : '')
                      : ` · ${item.note.type}`}
                    {item.kind === 'note' && !(item.note as ContinuityNote).synced ? ' · 🔴 local' : ''}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── Right panel — Activity ────────────────────────────────────────── */}
        <Box sx={{ width: { xs: '100%', md: rightPanelWidth }, flexShrink: 0,
                   display: 'flex', flexDirection: 'column', overflow: 'hidden',
                   bgcolor: '#0a0a0a',
                   borderLeft: { md: `1px solid ${border}` } }}>

          {/* Header */}
          <Box sx={{ px: is2K ? 2.4 : 2, pt: is2K ? 1.75 : 1.5, pb: 0.75, borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={900}
                sx={{ fontSize: '0.82rem', letterSpacing: '0.12em' }}>
                ACTIVITY
              </Typography>
              <Chip size="small"
                icon={rtConnected
                  ? <OnlineIcon sx={{ fontSize: 11 }} />
                  : <OfflineIcon sx={{ fontSize: 11 }} />}
                label={rtConnected ? 'Live' : 'Polling'}
                sx={{ height: 18, fontSize: '0.6rem',
                      bgcolor: rtConnected ? 'rgba(76,175,80,0.12)' : 'rgba(158,158,158,0.1)',
                      color: rtConnected ? '#66bb6a' : muted }} />
            </Box>

            {/* Presence avatars */}
            {activeUsers.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <PeopleIcon sx={{ fontSize: 14, color: muted }} />
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {activeUsers.slice(0, 4).map((u: PresenceEntry, index) => (
                    <Tooltip key={u.userId} title={`${u.userId} (${u.role})`}>
                      <Avatar
                        sx={{
                          bgcolor: '#1565c0',
                          border: '1px solid rgba(255,255,255,0.35)',
                          fontSize: '0.62rem',
                          height: 22,
                          ml: index === 0 ? 0 : -0.75,
                          width: 22,
                        }}
                      >
                        {u.userId.slice(0, 2).toUpperCase()}
                      </Avatar>
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            )}

            {/* Progress bar */}
            {progress.totalSetups > 0 && (
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="caption" sx={{ color: muted, fontSize: '0.6rem' }}>
                    {progress.completedSetups}/{progress.totalSetups} setups
                  </Typography>
                  <Typography variant="caption" sx={{ color: muted, fontSize: '0.6rem' }}>
                    {Math.round(progressPercent)}%
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={progressPercent}
                  sx={{ height: 3, borderRadius: 2, bgcolor: border,
                        '& .MuiLinearProgress-bar': { bgcolor: '#4caf50' } }} />
              </Box>
            )}

            {/* TAKES / NOTES segment */}
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {([
                `TAKES (${liveStatus?.todayTakes.length ?? 0})`,
                `NOTES (${continuityNotes.length})`,
              ] as const).map((label, i) => (
                <Button key={i} size="small"
                  onClick={() => setRightPanelTab(i as 0 | 1)}
                  sx={{ flex: 1, py: 0.4, fontSize: '0.68rem', fontWeight: 700,
                        letterSpacing: '0.06em', textTransform: 'none', borderRadius: 1,
                        bgcolor: rightPanelTab === i ? '#1e1e1e' : 'transparent',
                        color: rightPanelTab === i ? text : muted,
                        border: rightPanelTab === i ? `1px solid ${border}` : 'none',
                        '&:hover': { bgcolor: '#1e1e1e', color: text } }}>
                  {label}
                </Button>
              ))}
            </Box>
          </Box>

          {/* ── TAKES LIST ─────────────────────────────────────────────────── */}
          {rightPanelTab === 0 && (
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              <List dense disablePadding>
                {(liveStatus?.todayTakes ?? []).slice().reverse().map((take, idx, arr) => (
                  <React.Fragment key={take.id}>
                    <ListItem sx={{ py: 1, px: 1.5, alignItems: 'flex-start' }}>
                      <ListItemIcon sx={{ minWidth: 40, mt: 0.25 }}>
                        <Box sx={{ width: 32, height: 32, borderRadius: '50%',
                                   bgcolor: TAKE_STATUS_COLORS[take.status],
                                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                                   color: '#fff', fontWeight: 900, fontSize: '0.82rem',
                                   fontFamily: 'monospace' }}>
                          {String(take.takeNumber).padStart(2, '0')}
                        </Box>
                      </ListItemIcon>
                      <ListItemText disableTypography
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5,
                                     flexWrap: 'wrap', mb: 0.25 }}>
                            <Typography variant="body2" fontWeight={700} fontFamily="monospace">
                              TAKE {String(take.takeNumber).padStart(2, '0')}
                            </Typography>
                            {take.status === 'circle' && (
                              <Chip icon={<StarIcon sx={{ fontSize: '10px !important' }} />}
                                label="CIRCLED" size="small"
                                sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#e65100',
                                      color: '#fff', '& .MuiChip-label': { px: 0.75 } }} />
                            )}
                            {take.status === 'print' && (
                              <Chip label="PRINT" size="small"
                                sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#9c27b033',
                                      color: '#ce93d8', '& .MuiChip-label': { px: 0.75 } }} />
                            )}
                            {take.status === 'good' && (
                              <Chip label="GOOD" size="small"
                                sx={{ height: 18, fontSize: '0.6rem',
                                      bgcolor: 'rgba(76,175,80,0.15)', color: '#81c784',
                                      '& .MuiChip-label': { px: 0.75 } }} />
                            )}
                            {take.additionalCameras && take.additionalCameras.length > 0 && (
                              <Chip size="small" icon={<CameraSwitch sx={{ fontSize: '10px !important' }} />}
                                label={`+${take.additionalCameras.length}cam`}
                                sx={{ height: 18, fontSize: '0.6rem',
                                      bgcolor: 'rgba(33,150,243,0.15)', color: '#64b5f6',
                                      '& .MuiChip-label': { px: 0.75 } }} />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" sx={{ color: muted, display: 'block' }}>
                              {take.duration > 0
                                ? `${String(Math.floor(take.duration / 60)).padStart(2, '0')}:${String(take.duration % 60).padStart(2, '0')}`
                                : '--'}
                              {take.camera ? ` · ${take.camera}` : ''}
                              {take.lens   ? ` · ${take.lens}`   : ''}
                              {take.fps    ? ` · ${take.fps}fps` : ''}
                            </Typography>
                            <Typography variant="caption"
                              sx={{ color: muted, display: 'block', fontSize: '0.65rem' }}>
                              {timeAgo(take.loggedAt ?? take.recordedAt)}
                              {take.loggedBy ? ` by ${take.loggedBy}` : ''}
                            </Typography>
                          </Box>
                        }
                      />
                      <Tooltip title="Sirkel take">
                        <IconButton size="small" sx={{ mt: 0.25, color: muted }}
                          onClick={() => handleCircleTake(take.id)}
                          disabled={take.status === 'circle' || take.status === 'print'}>
                          <StarBorderIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </ListItem>
                    {idx < arr.length - 1 && <Divider sx={{ borderColor: border }} />}
                  </React.Fragment>
                ))}
                {(!liveStatus?.todayTakes || liveStatus.todayTakes.length === 0) && (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: muted }}>Ingen takes ennå</Typography>
                    <Typography variant="caption" sx={{ color: muted, display: 'block', mt: 0.5 }}>
                      Trykk ROLL for å starte
                    </Typography>
                  </Box>
                )}
              </List>
            </Box>
          )}

          {/* ── NOTES LIST ─────────────────────────────────────────────────── */}
          {rightPanelTab === 1 && (
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {unsyncedCount > 0 && (
                <Alert severity="warning" icon={<OfflineIcon sx={{ fontSize: 14 }} />}
                  sx={{ borderRadius: 0, py: 0.25, fontSize: '0.7rem' }}>
                  {unsyncedCount} lokal
                </Alert>
              )}
              <List dense disablePadding>
                {continuityNotes.map((note, idx) => (
                  <React.Fragment key={note.id}>
                    <ListItem sx={{ py: 0.75, px: 1.5, alignItems: 'flex-start' }}>
                      <ListItemIcon sx={{ minWidth: 30, mt: 0.25 }}>
                        {note.type === 'tech'       && <WarningIcon sx={{ fontSize: 15, color: '#9333ea' }} />}
                        {note.type === 'general'    && <ThumbUpIcon sx={{ fontSize: 15, color: '#4caf50' }} />}
                        {note.type === 'continuity' && <HistoryIcon sx={{ fontSize: 15, color: muted }} />}
                        {note.type === 'costume'    && <DescriptionIcon sx={{ fontSize: 15, color: muted }} />}
                        {note.type === 'props'      && <LightbulbIcon sx={{ fontSize: 15, color: muted }} />}
                        {note.type === 'makeup'     && <VideocamIcon sx={{ fontSize: 15, color: muted }} />}
                      </ListItemIcon>
                      <ListItemText disableTypography
                        primary={
                          <Typography variant="caption"
                            sx={{ fontWeight: 500, lineHeight: 1.4, display: 'block', fontSize: '0.78rem' }}>
                            <Box component="span" fontWeight={700}>
                              {note.type === 'tech'    ? 'Action Safe'
                                : note.type === 'general' ? 'Note'
                                : note.type.charAt(0).toUpperCase() + note.type.slice(1)}:{' '}
                            </Box>
                            {note.note}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" sx={{ color: muted, fontSize: '0.62rem' }}>
                            {timeAgo(note.timestamp)}{!note.synced ? ' · 🔴' : ''}
                          </Typography>
                        }
                      />
                      <IconButton size="small" sx={{ mt: 0.25, color: muted }}
                        onClick={() => persistNotes(continuityNotes.filter(n => n.id !== note.id))}>
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </ListItem>
                    {idx < continuityNotes.length - 1 && <Divider sx={{ borderColor: border }} />}
                  </React.Fragment>
                ))}
                {continuityNotes.length === 0 && (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: muted }}>Ingen notater</Typography>
                  </Box>
                )}
              </List>
            </Box>
          )}

          {/* ── Inline add note input ──────────────────────────────────────── */}
          <Box sx={{ borderTop: `1px solid ${border}`, flexShrink: 0,
                     bgcolor: '#0f0f0f' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 0.75, gap: 0.75 }}>
              <AddIcon sx={{ color: muted, fontSize: 18, flexShrink: 0 }} />
              <TextField size="small" placeholder="Add a note…" fullWidth variant="standard"
                value={inlineNoteText}
                onChange={e => setInlineNoteText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && inlineNoteText.trim()) {
                    addQuickNote('good', inlineNoteText.trim());
                    setInlineNoteText('');
                    setRightPanelTab(1);
                  }
                }}
                InputProps={{
                  disableUnderline: true,
                  endAdornment: inlineNoteText ? (
                    <NotesIcon sx={{ fontSize: 16, color: muted, mr: 0.5 }} />
                  ) : undefined,
                  sx: { fontSize: '0.82rem', color: text, '& input::placeholder': { opacity: 0.5 } },
                }} />
              <Tooltip title="Talenotat">
                <IconButton size="small" sx={{ color: muted, flexShrink: 0 }}>
                  <MicIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ px: 1.5, pb: 0.25 }}>
              <GlobalMentionHelper
                text={inlineNoteText}
                localCandidates={mentionCandidates}
                onApplySuggestion={(name) => {
                  setInlineNoteText((previous) => {
                    if (!previous.trim()) return name;
                    const replaced = previous.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
                    return replaced !== previous ? replaced : `${previous.trimEnd()} ${name}`;
                  });
                }}
              />
            </Box>
            {/* Quick action buttons — QUICK_NOTES constant wired here */}
            <Box sx={{ display: 'flex', justifyContent: 'space-around', px: 1, pb: 1, gap: 0.5 }}>
              {QUICK_NOTES.map((qn, i) => (
                <Tooltip key={i} title={qn.label}>
                  <IconButton size="small"
                    onClick={() => { addQuickNote(qn.type, qn.label); setRightPanelTab(1); }}
                    sx={{ color: muted, bgcolor: '#1a1a1a',
                          borderRadius: 1, p: 0.75,
                          '&:hover': { bgcolor: '#242424' } }}>
                    {qn.icon}
                  </IconButton>
                </Tooltip>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Pro: CUT metadata dialog ─────────────────────────────────────────── */}
      <Dialog open={showCutDialog} onClose={() => { setShowCutDialog(false); setPendingCutStatus(null); }}
        maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: panel, color: text } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CameraSwitch fontSize="small" />
          CUT — {pendingCutStatus?.toUpperCase()} · Kamera metadata
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          {/* Primary camera */}
          <Typography variant="caption" sx={{ color: muted, letterSpacing: '0.08em' }}>
            PRIMÆR KAMERA — CAM {cameraMetadata.cameraId}
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={cameraMetadata.cameraId}
            onChange={(_, v: CameraId | null) => { if (v) setCameraMetadata(m => ({ ...m, cameraId: v })); }}
            size="small"
          >
            {(['A', 'B', 'C', 'D'] as CameraId[]).map(id => (
              <ToggleButton key={id} value={id}>{id}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <TextField label="Camera (f.eks. A-cam / ARRI)" size="small"
            value={cameraMetadata.camera ?? ''} fullWidth
            onChange={e => setCameraMetadata(m => ({ ...m, camera: e.target.value }))} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="Linse" size="small" sx={{ flex: 2 }}
              value={cameraMetadata.lens ?? ''}
              onChange={e => setCameraMetadata(m => ({ ...m, lens: e.target.value }))} />
            <TextField label="FPS" size="small" type="number" sx={{ flex: 1 }}
              value={cameraMetadata.fps ?? ''} inputProps={{ min: 1, max: 240 }}
              onChange={e => setCameraMetadata(m => ({ ...m, fps: Number(e.target.value) || undefined }))} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="ISO" size="small" type="number" sx={{ flex: 1 }}
              value={cameraMetadata.iso ?? ''}
              onChange={e => setCameraMetadata(m => ({ ...m, iso: Number(e.target.value) || undefined }))} />
            <TextField label="ND Filter" size="small" sx={{ flex: 1 }}
              value={cameraMetadata.ndFilter ?? ''}
              onChange={e => setCameraMetadata(m => ({ ...m, ndFilter: e.target.value }))} />
          </Box>

          {/* Additional cameras */}
          <Divider sx={{ my: 0.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: muted }}>EKSTRA KAMERA</Typography>
            <Button size="small" startIcon={<AddIcon />}
              onClick={() => setAdditionalCameras(prev => [...prev, defaultCamMeta()])}>
              Legg til
            </Button>
          </Box>
          {additionalCameras.map((cam, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Select size="small" value={cam.cameraId} sx={{ width: 60 }}
                onChange={e => setAdditionalCameras(prev => prev.map((c, j) => j === i ? { ...c, cameraId: e.target.value as CameraId } : c))}>
                {(['A', 'B', 'C', 'D'] as CameraId[]).map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}
              </Select>
              <TextField size="small" label="Linse" sx={{ flex: 1 }} value={cam.lens ?? ''}
                onChange={e => setAdditionalCameras(prev => prev.map((c, j) => j === i ? { ...c, lens: e.target.value } : c))} />
              <IconButton size="small" onClick={() => setAdditionalCameras(prev => prev.filter((_, j) => j !== i))}>
                <CancelIcon fontSize="small" sx={{ color: '#ef5350' }} />
              </IconButton>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowCutDialog(false); setPendingCutStatus(null); }}>Avbryt</Button>
          <Button variant="contained"
            sx={{ bgcolor: pendingCutStatus === 'circle' ? '#1565c0' : pendingCutStatus === 'good' ? '#2e7d32' : '#e65100' }}
            onClick={confirmCut}>
            Bekreft {pendingCutStatus?.toUpperCase()}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Note dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={showNoteDialog} onClose={() => setShowNoteDialog(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: panel, color: text } }}>
        <DialogTitle>Legg til notat</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Type</InputLabel>
            <Select value={noteForm.type} label="Type"
              onChange={e => setNoteForm({ ...noteForm, type: e.target.value as ContinuityNote['type'] })}
              MenuProps={{ sx: { zIndex: 10001 } }}>
              <MenuItem value="continuity">Kontinuitet</MenuItem>
              <MenuItem value="costume">Kostyme</MenuItem>
              <MenuItem value="props">Rekvisitter</MenuItem>
              <MenuItem value="makeup">Sminke</MenuItem>
              <MenuItem value="tech">Teknisk</MenuItem>
              <MenuItem value="general">Generelt</MenuItem>
            </Select>
          </FormControl>
          <TextField fullWidth multiline minRows={4} label="Notat" autoFocus
            value={noteForm.note}
            onChange={e => setNoteForm({ ...noteForm, note: e.target.value })}
            placeholder="Beskriv notatet…" />
          <GlobalMentionHelper
            text={noteForm.note}
            localCandidates={mentionCandidates}
            onApplySuggestion={(name) => {
              setNoteForm((previous) => {
                const current = previous.note;
                if (!current.trim()) {
                  return { ...previous, note: name };
                }
                const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
                return {
                  ...previous,
                  note: replaced !== current ? replaced : `${current.trimEnd()} ${name}`,
                };
              });
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNoteDialog(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleAddNote} disabled={!noteForm.note.trim()}>
            Lagre lokalt
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Settings dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)}
        maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: panel, color: text } }}>
        <DialogTitle>Live Set Innstillinger</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="body2" sx={{ color: muted, mb: 0.5 }}>
            Live Set bruker kun mørk modus.
          </Typography>
          <FormControlLabel control={<Switch checked={settings.showTimer}
            onChange={e => setSettings({ ...settings, showTimer: e.target.checked })} />}
            label="Vis timer" />
          <FormControlLabel
            control={<Switch checked={settings.autoIncrement}
              onChange={e => setSettings({ ...settings, autoIncrement: e.target.checked })} />}
            label={
              <Box>
                <Typography variant="body2">Auto-inkrement take</Typography>
                <Typography variant="caption" sx={{ color: muted }}>
                  Av = vis ±-knapper for manuell kontroll
                </Typography>
              </Box>
            }
          />
          <FormControlLabel control={<Switch checked={settings.soundAlerts}
            onChange={e => setSettings({ ...settings, soundAlerts: e.target.checked })} />}
            label="Lyd-varsler" />
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" sx={{ color: muted }}>
            Notater lagres i localStorage per prosjekt+dag.<br />
            Bruker: <strong>{userId}</strong> &nbsp;|&nbsp; Rolle: <strong>{ROLE_LABELS[userRole ?? 'director']}</strong><br />
            Tilganger: {Object.entries(can).filter(([, v]) => v).map(([k]) => k).join(', ')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)} variant="contained">Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ──────────────────────────────────────────────────────────── */}
      <Snackbar open={snack !== null} autoHideDuration={3000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack
          ? <Alert onClose={() => setSnack(null)} severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
              {snack.msg}
            </Alert>
          : <Box />}
      </Snackbar>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
      `}</style>
    </Box>
  );
};

export default LiveSetMode;
