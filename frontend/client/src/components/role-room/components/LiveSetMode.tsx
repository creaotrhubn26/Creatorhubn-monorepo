// @ts-nocheck
/**
 * LiveSetMode – On-set operational tool
 *
 * Three-zone layout:
 *   Left  → Control Zone  (ROLL/CUT, timer, quick actions)
 *   Center → Context Zone  (scene info, camera metadata, storyboard)
 *   Right → Activity Zone (takes log, notes)
 *
 * State machine: idle → rolling → cut → (setup-complete) → idle
 * Offline-first: all state persisted to localStorage
 * Keyboard shortcuts: R=Roll, C=Cut, N=Note, ↑↓=navigate, Enter=confirm
 */

import { memo, useState, useEffect, useRef, useMemo, useCallback, type FC, type ElementType } from 'react';
import {
  Box,
  Typography,
  Button,
  ButtonBase,
  IconButton,
  Chip,
  Paper,
  Tooltip,
  Tabs,
  Tab,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Stack,
  Badge,
  Avatar,
  Collapse,
  Slide,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  useTheme,
  useMediaQuery,
  keyframes,
} from '@mui/material';
import {
  FiberManualRecord as RecordIcon,
  Stop as CutIcon,
  Timer as TimerIcon,
  CheckCircle as GoodTakeIcon,
  MyLocation as PickupIcon,
  WarningAmber as ActionSafeIcon,
  CameraAlt as CheckFocusIcon,
  DoneAll as SetupCompleteIcon,
  Notes as NoteIcon,
  LocalOffer as TagIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Star as CircleIcon,
  Print as PrintIcon,
  Close as CloseIcon,
  WifiOff as OfflineIcon,
  Sync as SyncIcon,
  CheckCircleOutline as SyncedIcon,
  ArrowForward as AdvanceIcon,
  Videocam as VideocamIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  PhotoCamera as StillIcon,
  KeyboardReturn as EnterIcon,
  Flag as PhaseIcon,
  Groups as CrewIcon,
  Inventory2 as EquipmentIcon,
  Thunderstorm as ThunderIcon,
  WbSunny as SunnyIcon,
  Cloud as CloudIcon,
  AcUnit as SnowIcon,
  AutoStories as ScriptIcon,
  ViewCarousel as StoryboardIcon,
  PlaylistAddCheck as CaptureIcon,
  Add as PlusIcon,
  Remove as MinusIcon,
  Thermostat as TempIcon,
  Air as WindIcon,
  WaterDrop as RainIcon,
  AccessTime as TimeIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  ZoomIn as ZoomIcon,
  OpenInNew as ExternalLinkIcon,
  SwapHoriz as LayoutSwapIcon,
} from '@mui/icons-material';
import { useLiveSet, type LiveSetCameraMetadata, type LiveSetNote, type LiveSetTake } from '../hooks/useLiveSet';
import { useLiveSetContext, type ShotOption, type StoryboardTile } from '../hooks/useLiveSetContext';
import { useLiveWeather, type LiveWeatherRiskLevel, type LiveWeatherState } from '../hooks/useLiveWeather';
import LiveSetDitPanel from './LiveSetDitPanel';
import { useShotListSync, type ShotListSyncState, type TakeCaptureForm } from '../hooks/useShotListSync';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import RoleRoomBrandMark from './shared/RoleRoomBrandMark';
import type {
  LiveSetScene,
  TakeStatus,
  QuickActionType,
  NoteTag,
} from '../models/casting';

// ── Constants ────────────────────────────────────────────────────────────────

const TOUCH_TARGET = 44;

const focusStyles = {
  '&:focus-visible': { outline: '3px solid #ef4444', outlineOffset: 2 },
};

// CSS keyframes for pulsing ROLL button
const rollPulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
  70%  { box-shadow: 0 0 0 22px rgba(239,68,68,0); }
  100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
`;

const flashFade = keyframes`
  0%   { opacity: 1; }
  100% { opacity: 0; }
`;

const weatherFloat = keyframes`
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-2px); }
  100% { transform: translateY(0px); }
`;

const weatherGlowPulse = keyframes`
  0%   { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
  50%  { transform: scale(1.07); filter: drop-shadow(0 0 8px rgba(255,255,255,0.35)); }
  100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
`;

const weatherRainPulse = keyframes`
  0%   { transform: translateY(0); opacity: 0.85; }
  50%  { transform: translateY(1px); opacity: 1; }
  100% { transform: translateY(0); opacity: 0.85; }
`;

const weatherFlash = keyframes`
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(250,204,21,0)); }
  45%      { transform: scale(1.08); filter: drop-shadow(0 0 10px rgba(250,204,21,0.7)); }
  55%      { transform: scale(1.02); filter: drop-shadow(0 0 6px rgba(250,204,21,0.45)); }
`;

const weatherSyncSpin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// ── Status helpers ────────────────────────────────────────────────────────────

const TAKE_STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: ElementType | null }> = {
  normal:   { label: 'Normal',   color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.08)', Icon: null },
  circled:  { label: 'CIRCLED',  color: '#ffb800', bg: 'rgba(255,184,0,0.18)',         Icon: CircleIcon },
  print:    { label: 'PRINT',    color: '#94a3b8', bg: 'rgba(148,163,184,0.18)',        Icon: PrintIcon },
  ng:       { label: 'NG',       color: '#ef4444', bg: 'rgba(239,68,68,0.18)',          Icon: null },
  selected: { label: 'SELECTED', color: '#10b981', bg: 'rgba(16,185,129,0.18)',         Icon: null },
};

const NOTE_TAG_META: Record<NoteTag, { label: string; color: string }> = {
  focus:      { label: 'Focus',      color: '#3b82f6' },
  continuity: { label: 'Continuity', color: '#a855f7' },
  sound:      { label: 'Sound',      color: '#10b981' },
  action:     { label: 'Action',     color: '#f59e0b' },
  general:    { label: 'General',    color: 'rgba(255,255,255,0.5)' },
};

const QUICK_ACTIONS: { type: QuickActionType; label: string; emoji: string; Icon: ElementType; color: string }[] = [
  { type: 'good_take',      label: 'Good Take',       emoji: '👍', Icon: GoodTakeIcon,      color: '#10b981' },
  { type: 'pickup_shot',    label: 'Pickup Shot',      emoji: '🎯', Icon: PickupIcon,        color: '#3b82f6' },
  { type: 'action_safe',    label: 'Action Safe',      emoji: '⚠️', Icon: ActionSafeIcon,    color: '#f59e0b' },
  { type: 'check_focus',    label: 'Check Focus',      emoji: '🎥', Icon: CheckFocusIcon,    color: '#a855f7' },
  { type: 'setup_complete', label: 'Setup Complete',   emoji: '✔',  Icon: SetupCompleteIcon, color: '#10b981' },
];

const SET_PHASE_OPTIONS = [
  'Forberedelse',
  'Blocking',
  'Lyssetting',
  'Rehearsal',
  'Opptak',
  'Wrap',
] as const;

const WEATHER_RISK_OPTIONS = ['Lav', 'Moderat', 'Høy'] as const;
const WEATHER_RISK_RANK: Record<(typeof WEATHER_RISK_OPTIONS)[number], number> = {
  Lav: 0,
  Moderat: 1,
  Høy: 2,
};

const CONTINUITY_FLAGS = [
  'Kontinuitet OK',
  'Kostymeavvik',
  'Props-avvik',
  'Lydmerknad',
  'Lysmerknad',
  'Sikkerhet',
] as const;

interface SetStatusState {
  phase: (typeof SET_PHASE_OPTIONS)[number];
  crewPresent: number;
  crewTotal: number;
  crewPresentIds?: string[];
  equipmentReady: number;
  equipmentTotal: number;
  equipmentReadyIds?: string[];
  weatherRisk: (typeof WEATHER_RISK_OPTIONS)[number];
  backupOriginal: boolean;
  backupPrimary: boolean;
  backupSecondary: boolean;
  backupOffsite: boolean;
}

interface WeatherVisualState {
  Icon: ElementType;
  iconColor: string;
  iconGlow: string;
  iconAnimation: string;
  headerGradient: string;
  cardGradient: string;
  moodLabel: string;
}

// ── Utility ───────────────────────────────────────────────────────────────────

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const compactText = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    const parsed = asString(value);
    if (parsed) return parsed;
  }
  return undefined;
};

const uniqueStringIds = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const sameStringArray = (left: string[] | undefined, right: string[] | undefined): boolean => {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
};

const deriveSelectedIds = (input: unknown, rosterIds: string[], fallbackCount: number): string[] => {
  if (!rosterIds.length) return [];
  const candidateIds = Array.isArray(input)
    ? input.map((value) => asString(value)).filter((value): value is string => Boolean(value))
    : [];
  const validIds = uniqueStringIds(candidateIds.filter((id) => rosterIds.includes(id)));
  if (validIds.length > 0 || fallbackCount <= 0) return validIds;
  return rosterIds.slice(0, Math.min(fallbackCount, rosterIds.length));
};

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
  const current = typeof sourceText === 'string' ? sourceText : '';
  if (!current.trim()) return name;
  const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
  return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
};

const createDefaultSetStatus = (crewTotal = 0, equipmentTotal = 0): SetStatusState => ({
  phase: 'Forberedelse',
  crewPresent: crewTotal,
  crewTotal,
  crewPresentIds: [],
  equipmentReady: equipmentTotal,
  equipmentTotal,
  equipmentReadyIds: [],
  weatherRisk: 'Lav',
  backupOriginal: true,
  backupPrimary: false,
  backupSecondary: false,
  backupOffsite: false,
});

const deriveWeatherVisual = (
  weather: Pick<LiveWeatherState, 'symbolCode' | 'alerts' | 'precipitation' | 'windSpeed'>,
  risk: SetStatusState['weatherRisk'],
): WeatherVisualState => {
  const symbol = (weather.symbolCode || '').toLowerCase();
  const alertText = (weather.alerts || []).join(' ').toLowerCase();
  const thunder = symbol.includes('thunder') || /torden|lynn/.test(alertText);
  const snow = symbol.includes('snow') || symbol.includes('sleet') || /snø|sludd|is/.test(alertText);
  const rain = symbol.includes('rain') || symbol.includes('drizzle') || (weather.precipitation ?? 0) >= 0.7;
  const sunny = symbol.includes('clearsky') || symbol.includes('fair');
  const partlyCloudy = symbol.includes('partlycloudy');
  const windy = (weather.windSpeed ?? 0) >= 12;

  if (thunder) {
    return {
      Icon: ThunderIcon,
      iconColor: '#facc15',
      iconGlow: 'rgba(250,204,21,0.7)',
      iconAnimation: `${weatherFlash} 1.4s ease-in-out infinite`,
      headerGradient: 'linear-gradient(135deg, rgba(202,138,4,0.35) 0%, rgba(30,41,59,0.95) 78%)',
      cardGradient: 'linear-gradient(145deg, rgba(202,138,4,0.24) 0%, rgba(30,41,59,0.8) 65%)',
      moodLabel: 'Tordenvær',
    };
  }

  if (snow) {
    return {
      Icon: SnowIcon,
      iconColor: '#c4f1ff',
      iconGlow: 'rgba(147,197,253,0.55)',
      iconAnimation: `${weatherFloat} 2.1s ease-in-out infinite`,
      headerGradient: 'linear-gradient(135deg, rgba(59,130,246,0.28) 0%, rgba(30,41,59,0.95) 78%)',
      cardGradient: 'linear-gradient(145deg, rgba(59,130,246,0.2) 0%, rgba(15,23,42,0.78) 65%)',
      moodLabel: 'Snø/sludd',
    };
  }

  if (rain) {
    return {
      Icon: RainIcon,
      iconColor: '#38bdf8',
      iconGlow: 'rgba(56,189,248,0.45)',
      iconAnimation: `${weatherRainPulse} 1.9s ease-in-out infinite`,
      headerGradient: 'linear-gradient(135deg, rgba(14,116,144,0.34) 0%, rgba(15,23,42,0.95) 78%)',
      cardGradient: 'linear-gradient(145deg, rgba(14,116,144,0.24) 0%, rgba(15,23,42,0.78) 65%)',
      moodLabel: 'Regn',
    };
  }

  if (windy) {
    return {
      Icon: WindIcon,
      iconColor: '#7dd3fc',
      iconGlow: 'rgba(125,211,252,0.45)',
      iconAnimation: `${weatherFloat} 1.7s ease-in-out infinite`,
      headerGradient: 'linear-gradient(135deg, rgba(30,64,175,0.3) 0%, rgba(15,23,42,0.95) 78%)',
      cardGradient: 'linear-gradient(145deg, rgba(30,64,175,0.18) 0%, rgba(15,23,42,0.78) 65%)',
      moodLabel: 'Kraftig vind',
    };
  }

  if (sunny) {
    return {
      Icon: SunnyIcon,
      iconColor: '#f59e0b',
      iconGlow: 'rgba(245,158,11,0.55)',
      iconAnimation: `${weatherGlowPulse} 2.7s ease-in-out infinite`,
      headerGradient: 'linear-gradient(135deg, rgba(245,158,11,0.34) 0%, rgba(30,41,59,0.95) 78%)',
      cardGradient: 'linear-gradient(145deg, rgba(245,158,11,0.24) 0%, rgba(30,41,59,0.8) 65%)',
      moodLabel: 'Klart',
    };
  }

  if (partlyCloudy) {
    return {
      Icon: SunnyIcon,
      iconColor: '#fbbf24',
      iconGlow: 'rgba(251,191,36,0.45)',
      iconAnimation: `${weatherGlowPulse} 3s ease-in-out infinite`,
      headerGradient: 'linear-gradient(135deg, rgba(56,189,248,0.26) 0%, rgba(30,41,59,0.95) 78%)',
      cardGradient: 'linear-gradient(145deg, rgba(56,189,248,0.16) 0%, rgba(15,23,42,0.78) 65%)',
      moodLabel: 'Delvis skyet',
    };
  }

  return {
    Icon: CloudIcon,
    iconColor: risk === 'Høy' ? '#fca5a5' : '#cbd5e1',
    iconGlow: risk === 'Høy' ? 'rgba(248,113,113,0.4)' : 'rgba(203,213,225,0.3)',
    iconAnimation: `${weatherFloat} 3.2s ease-in-out infinite`,
    headerGradient: risk === 'Høy'
      ? 'linear-gradient(135deg, rgba(127,29,29,0.34) 0%, rgba(30,41,59,0.95) 78%)'
      : 'linear-gradient(135deg, rgba(2,132,199,0.3) 0%, rgba(15,23,42,0.95) 80%)',
    cardGradient: risk === 'Høy'
      ? 'linear-gradient(145deg, rgba(127,29,29,0.24) 0%, rgba(15,23,42,0.8) 65%)'
      : 'linear-gradient(145deg, rgba(2,132,199,0.24) 0%, rgba(15,23,42,0.78) 65%)',
    moodLabel: 'Overskyet',
  };
};

// ── Sub-component: CircularTimer ──────────────────────────────────────────────

interface CircularTimerProps { seconds: number; rolling: boolean }

const CircularTimer: FC<CircularTimerProps> = ({ seconds, rolling }) => {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  // Cycle over 60s
  const progress = rolling ? (seconds % 60) / 60 : 0;
  const strokeDash = circumference * progress;

  return (
    <Box sx={{ position: 'relative', width: 140, height: 140, mx: 'auto' }}>
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        {/* Progress */}
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={rolling ? '#ef4444' : 'rgba(255,255,255,0.15)'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.25s linear, stroke 0.3s' }}
        />
      </svg>
      <Box sx={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Typography
          variant="h4"
          sx={{
            color: rolling ? '#ef4444' : 'rgba(255,255,255,0.7)',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            fontSize: 28,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            transition: 'color 0.3s',
          }}
        >
          {formatTimer(seconds)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', mt: 0.25, fontSize: 10 }}>
          {rolling ? 'ROLLING' : 'STANDBY'}
        </Typography>
      </Box>
    </Box>
  );
};

interface LiveSetStatusBarProps {
  activeSceneId: string;
  sceneOptions: LiveSetScene[];
  status: SetStatusState;
  shotListSync: ShotListSyncState;
  weatherLive: LiveWeatherState;
  onSelectScene: (sceneId: string) => void;
  onSetPhase: (phase: SetStatusState['phase']) => void;
  onAdjustCrew: (delta: number) => void;
  onAdjustEquipment: (delta: number) => void;
  onOpenCrewDialog: () => void;
  onOpenEquipmentDialog: () => void;
  onOpenWeatherDialog: () => void;
}

const LiveSetStatusBar: FC<LiveSetStatusBarProps> = ({
  activeSceneId,
  sceneOptions,
  status,
  shotListSync,
  weatherLive,
  onSelectScene,
  onSetPhase,
  onAdjustCrew,
  onAdjustEquipment,
  onOpenCrewDialog,
  onOpenEquipmentDialog,
  onOpenWeatherDialog,
}) => {
  const touchUi = useMediaQuery('(pointer: coarse)');
  const controlSize = touchUi ? 'medium' : 'small';
  const controlHeight = touchUi ? 46 : 30;
  const syncColor =
    shotListSync.status === 'success'
      ? '#10b981'
      : shotListSync.status === 'error'
        ? '#ef4444'
        : shotListSync.status === 'syncing'
          ? '#ffb800'
          : 'rgba(255,255,255,0.45)';
  const weatherVisual = deriveWeatherVisual(weatherLive, status.weatherRisk);
  const weatherUpdatedLabel = weatherLive.updatedAt ? fmtTime(weatherLive.updatedAt) : null;
  const weatherStatusMeta =
    weatherLive.status === 'loading'
      ? {
          label: 'Yr oppdaterer…',
          color: '#bae6fd',
          iconColor: '#38bdf8',
          Icon: SyncIcon,
          spinning: true,
        }
      : weatherLive.status === 'error'
        ? {
            label: 'Yr utilgjengelig',
            color: '#fecaca',
            iconColor: '#f87171',
            Icon: ActionSafeIcon,
            spinning: false,
          }
        : {
            label: weatherUpdatedLabel ? `Oppdatert ${weatherUpdatedLabel}` : 'Venter på oppdatering',
            color: '#bbf7d0',
            iconColor: '#34d399',
            Icon: TimeIcon,
            spinning: false,
          };
  const normalizedSceneOptions = useMemo(() => (
    sceneOptions
      .map((scene) => ({
        scene,
        id: compactText(scene.id, scene.sceneId) || '',
      }))
      .filter((entry) => entry.id.length > 0)
  ), [sceneOptions]);
  const activeSceneIndex = normalizedSceneOptions.findIndex((entry) => entry.id === activeSceneId);
  const nextScene = activeSceneIndex >= 0 ? normalizedSceneOptions[activeSceneIndex + 1]?.scene : undefined;
  const nextSceneId = activeSceneIndex >= 0 ? normalizedSceneOptions[activeSceneIndex + 1]?.id : undefined;
  const normalizedActiveSceneId = activeSceneIndex >= 0 ? activeSceneId : '';
  const nextSceneLabel = nextScene
    ? `${compactText(nextScene.name, nextScene.sceneNumber, nextSceneId) || nextSceneId}${compactText(nextScene.location) ? ` · ${compactText(nextScene.location)}` : ''}`
    : 'Siste scene';

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2.5 },
        py: 1,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        bgcolor: 'rgba(7,10,20,0.94)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: touchUi ? 1 : 0.75, alignItems: 'center' }}>
        <FormControl size={controlSize} sx={{ minWidth: touchUi ? 300 : 250 }}>
          <InputLabel sx={{ color: 'rgba(255,255,255,0.45)', '&.Mui-focused': { color: '#00d4ff' } }}>
            Aktiv scene
          </InputLabel>
          <Select
            label="Aktiv scene"
            value={normalizedActiveSceneId}
            onChange={(event) => onSelectScene(event.target.value)}
            displayEmpty
            disabled={normalizedSceneOptions.length === 0}
            MenuProps={{
              PaperProps: { sx: { bgcolor: '#171a2a', color: '#fff', maxHeight: touchUi ? 420 : 320 } },
              MenuListProps: { sx: { py: touchUi ? 0.5 : 0 } },
            }}
            sx={{
              height: controlHeight,
              color: '#fff',
              bgcolor: 'rgba(0,212,255,0.12)',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,212,255,0.35)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,212,255,0.55)' },
              '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.55)' },
              '& .MuiSelect-select': { py: touchUi ? 1.25 : 0.6, fontSize: touchUi ? 15 : 13 },
            }}
          >
            {normalizedSceneOptions.length === 0 ? (
              <MenuItem value="" disabled sx={touchUi ? { minHeight: 46, fontSize: 15 } : undefined}>
                Ingen scener tilgjengelig
              </MenuItem>
            ) : (
              normalizedSceneOptions.map(({ scene, id }) => {
                const optionLabel = `${compactText(scene.sceneNumber, scene.name, id) || id}${compactText(scene.location) ? ` · ${compactText(scene.location)}` : ''}`;
                return (
                  <MenuItem
                    key={id}
                    value={id}
                    sx={touchUi ? { minHeight: 46, fontSize: 15 } : undefined}
                  >
                    {optionLabel}
                  </MenuItem>
                );
              })
            )}
          </Select>
        </FormControl>
        <FormControl size={controlSize} sx={{ minWidth: touchUi ? 200 : 170 }}>
          <InputLabel sx={{ color: 'rgba(255,255,255,0.45)', '&.Mui-focused': { color: '#a855f7' } }}>Fase</InputLabel>
          <Select
            label="Fase"
            value={status.phase}
            onChange={(event) => onSetPhase(event.target.value as SetStatusState['phase'])}
            sx={{
              height: controlHeight,
              color: '#fff',
              bgcolor: 'rgba(168,85,247,0.12)',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(168,85,247,0.35)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(168,85,247,0.55)' },
              '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.55)' },
              '& .MuiSelect-select': { py: touchUi ? 1.25 : 0.6, fontSize: touchUi ? 14 : 13 },
            }}
            MenuProps={{
              PaperProps: { sx: { bgcolor: '#171a2a', color: '#fff', maxHeight: touchUi ? 420 : 320 } },
              MenuListProps: { sx: { py: touchUi ? 0.5 : 0 } },
            }}
          >
            {SET_PHASE_OPTIONS.map((phase) => (
              <MenuItem key={phase} value={phase} sx={touchUi ? { minHeight: 44, fontSize: 14 } : undefined}>
                {phase}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Chip
          icon={<SyncIcon sx={{ fontSize: '14px !important' }} />}
          label={shotListSync.message || 'Shot List-sync klar'}
          size="small"
          sx={{ color: syncColor, border: `1px solid ${syncColor}55`, bgcolor: `${syncColor}22` }}
        />
        <ButtonBase
          onClick={() => {
            if (nextSceneId) onSelectScene(nextSceneId);
          }}
          disabled={!nextSceneId}
          sx={{
            borderRadius: 999,
            '&:focus-visible': { outline: '2px solid rgba(96,165,250,0.45)', outlineOffset: 1 },
          }}
        >
          <Chip
            icon={<AdvanceIcon sx={{ fontSize: '14px !important' }} />}
            label={`Neste: ${nextSceneLabel}`}
            size="small"
            sx={{
              color: nextSceneId ? '#93c5fd' : 'rgba(148,163,184,0.9)',
              border: `1px solid ${nextSceneId ? 'rgba(96,165,250,0.45)' : 'rgba(148,163,184,0.3)'}`,
              bgcolor: nextSceneId ? 'rgba(59,130,246,0.18)' : 'rgba(71,85,105,0.25)',
              fontWeight: 700,
              cursor: nextSceneId ? 'pointer' : 'default',
              '& .MuiChip-icon': { color: nextSceneId ? '#93c5fd' : 'rgba(148,163,184,0.9)' },
            }}
          />
        </ButtonBase>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: 0.75, py: 0.25, borderRadius: 1, border: '1px solid rgba(59,130,246,0.35)', bgcolor: 'rgba(59,130,246,0.12)' }}>
          <CrewIcon sx={{ fontSize: 14, color: '#60a5fa' }} />
          <ButtonBase
            onClick={onOpenCrewDialog}
            sx={{
              borderRadius: 0.75,
              px: 0.45,
              py: 0.2,
              '&:hover': { bgcolor: 'rgba(96,165,250,0.18)' },
              '&:focus-visible': { outline: '2px solid rgba(96,165,250,0.45)', outlineOffset: 1 },
            }}
          >
            <Typography variant="caption" sx={{ color: '#bfdbfe', fontWeight: 700 }}>
              Crew til stede {status.crewPresent}/{status.crewTotal || 0}
            </Typography>
          </ButtonBase>
          <IconButton size="small" onClick={() => onAdjustCrew(-1)} sx={{ p: 0.2, color: 'rgba(191,219,254,0.9)' }}>
            <MinusIcon sx={{ fontSize: 13 }} />
          </IconButton>
          <IconButton size="small" onClick={() => onAdjustCrew(1)} sx={{ p: 0.2, color: 'rgba(191,219,254,0.9)' }}>
            <PlusIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: 0.75, py: 0.25, borderRadius: 1, border: '1px solid rgba(16,185,129,0.35)', bgcolor: 'rgba(16,185,129,0.12)' }}>
          <EquipmentIcon sx={{ fontSize: 14, color: '#34d399' }} />
          <ButtonBase
            onClick={onOpenEquipmentDialog}
            sx={{
              borderRadius: 0.75,
              px: 0.45,
              py: 0.2,
              '&:hover': { bgcolor: 'rgba(52,211,153,0.18)' },
              '&:focus-visible': { outline: '2px solid rgba(52,211,153,0.45)', outlineOffset: 1 },
            }}
          >
            <Typography variant="caption" sx={{ color: '#a7f3d0', fontWeight: 700 }}>
              Utstyr klart {status.equipmentReady}/{status.equipmentTotal || 0}
            </Typography>
          </ButtonBase>
          <IconButton size="small" onClick={() => onAdjustEquipment(-1)} sx={{ p: 0.2, color: 'rgba(167,243,208,0.9)' }}>
            <MinusIcon sx={{ fontSize: 13 }} />
          </IconButton>
          <IconButton size="small" onClick={() => onAdjustEquipment(1)} sx={{ p: 0.2, color: 'rgba(167,243,208,0.9)' }}>
            <PlusIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Stack>

        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{
            px: 0.85,
            py: 0.35,
            borderRadius: 1,
            border: `1px solid ${weatherVisual.iconGlow}`,
            bgcolor: 'rgba(15,23,42,0.45)',
            boxShadow: `inset 0 0 0 1px ${weatherVisual.iconGlow}`,
          }}
        >
          <ButtonBase
            onClick={onOpenWeatherDialog}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.65,
              borderRadius: 999,
              px: 0.9,
              py: 0.3,
              border: `1px solid ${weatherVisual.iconGlow}`,
              background: weatherVisual.cardGradient,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 0 10px ${weatherVisual.iconGlow}`,
              transition: 'all 0.18s ease',
              '&:hover': {
                borderColor: weatherVisual.iconColor,
                filter: 'brightness(1.05)',
              },
              '&:focus-visible': { outline: `2px solid ${weatherVisual.iconGlow}`, outlineOffset: 1 },
            }}
          >
            <weatherVisual.Icon
              sx={{
                fontSize: 14,
                color: weatherVisual.iconColor,
                animation: weatherVisual.iconAnimation,
                filter: `drop-shadow(0 0 5px ${weatherVisual.iconGlow})`,
              }}
            />
            <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', pr: 0.15 }}>
              <Typography variant="caption" sx={{ color: '#e0f2fe', fontWeight: 800, letterSpacing: '0.01em', lineHeight: 1.05 }}>
                Værvarsling
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: weatherStatusMeta.color,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  fontSize: 10,
                  mt: 0.12,
                }}
              >
                {weatherStatusMeta.label}
              </Typography>
            </Box>
            <weatherStatusMeta.Icon
              sx={{
                fontSize: 12,
                color: weatherStatusMeta.iconColor,
                animation: weatherStatusMeta.spinning ? `${weatherSyncSpin} 1.15s linear infinite` : undefined,
              }}
            />
            <ExternalLinkIcon sx={{ fontSize: 12, color: 'rgba(186,230,253,0.85)' }} />
          </ButtonBase>
        </Stack>
        {weatherLive.alerts.length > 0 ? (
          <Chip
            size="small"
            label={`Yr varsel (${weatherLive.alerts.length})`}
            onClick={onOpenWeatherDialog}
            sx={{ color: '#fecaca', border: '1px solid rgba(248,113,113,0.55)', bgcolor: 'rgba(127,29,29,0.35)', fontSize: 10 }}
          />
        ) : null}
      </Box>
    </Box>
  );
};

// ── Sub-component: ControlPanel (Left) ───────────────────────────────────────

interface LiveSetControlPanelProps {
  liveState: string;
  timerSeconds: number;
  scene: LiveSetScene | null;
  cameraMetadata: LiveSetCameraMetadata;
  takes: LiveSetTake[];
  takeCount: number;
  activeSetup: string;
  activeCam: string;
  touchUi: boolean;
  onRoll: () => void;
  onCut: () => void;
  onSetupComplete: () => void;
  onAddFlag: (f: QuickActionType) => void;
  onSetSetup: (s: string) => void;
  onSetCam: (c: string) => void;
  onSetCamera: (m: Partial<LiveSetCameraMetadata>) => void;
  noteInputRef: React.RefObject<HTMLInputElement | null>;
  dockSide?: 'left' | 'right';
}

const LiveSetControlPanel: FC<LiveSetControlPanelProps> = ({
  liveState, timerSeconds, scene, cameraMetadata, takes, takeCount, activeSetup, activeCam, touchUi,
  onRoll, onCut, onSetupComplete, onAddFlag, onSetSetup, onSetCam, onSetCamera, noteInputRef, dockSide = 'left',
}) => {
  const isRolling = liveState === 'rolling';
  const isCut = liveState === 'cut';
  const isIdle = liveState === 'idle' || liveState === 'setup-complete';
  const [showCamEdit, setShowCamEdit] = useState(false);
  const [showAllTakes, setShowAllTakes] = useState(false);
  const visibleTakes = showAllTakes ? takes : takes.slice(0, 8);

  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column', gap: 2, p: 2,
        bgcolor: 'rgba(10,10,18,0.95)',
        borderRight: dockSide === 'left' ? '1px solid rgba(255,255,255,0.06)' : 'none',
        borderLeft: dockSide === 'right' ? '1px solid rgba(255,255,255,0.06)' : 'none',
        minHeight: 0,
      }}
    >
      {/* ── Scene + Take badge ── */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 10 }}>
          Scene
        </Typography>
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '0.04em', lineHeight: 1 }}>
          {scene?.sceneNumber ?? '—'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 0.5 }}>
          <Chip
            label={`TAKE ${(takeCount + 1).toString().padStart(2, '0')}`}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)', fontSize: 11, letterSpacing: '0.06em', fontWeight: 700 }}
          />
          <Chip
            label={activeCam}
            size="small"
            sx={{ bgcolor: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)', fontSize: 11 }}
          />
        </Box>
      </Box>

      {/* ── Setup selector ── */}
      <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center', flexWrap: 'wrap' }}>
        {['A', 'B', 'C', 'MOS'].map(s => (
          <Button
            key={s}
            variant={activeSetup === s ? 'contained' : 'outlined'}
            size={touchUi ? 'medium' : 'small'}
            onClick={() => onSetSetup(s)}
            disabled={isRolling}
            sx={{
              minWidth: touchUi ? 56 : 42,
              minHeight: touchUi ? 40 : undefined,
              py: touchUi ? 0.75 : 0.25,
              fontSize: touchUi ? 14 : 12,
              fontWeight: 700,
              bgcolor: activeSetup === s ? 'rgba(255,184,0,0.2)' : 'transparent',
              color: activeSetup === s ? '#ffb800' : 'rgba(255,255,255,0.4)',
              borderColor: activeSetup === s ? 'rgba(255,184,0,0.5)' : 'rgba(255,255,255,0.12)',
              '&:hover': { bgcolor: 'rgba(255,184,0,0.1)' },
            }}
          >
            {s}
          </Button>
        ))}
      </Box>

      {/* ── Cam selector ── */}
      <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>CAM</Typography>
        {['A', 'B', 'C'].map(c => (
          <Button
            key={c}
            variant={activeCam === c ? 'contained' : 'outlined'}
            size={touchUi ? 'medium' : 'small'}
            onClick={() => onSetCam(c)}
            disabled={isRolling}
            sx={{
              minWidth: touchUi ? 44 : 32,
              minHeight: touchUi ? 38 : undefined,
              py: touchUi ? 0.6 : 0.25,
              fontSize: touchUi ? 13 : 11,
              fontWeight: 700,
              bgcolor: activeCam === c ? 'rgba(0,212,255,0.2)' : 'transparent',
              color: activeCam === c ? '#00d4ff' : 'rgba(255,255,255,0.4)',
              borderColor: activeCam === c ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.12)',
              '&:hover': { bgcolor: 'rgba(0,212,255,0.1)' },
            }}
          >
            {c}
          </Button>
        ))}
      </Stack>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* ── Circular Timer ── */}
      <Box sx={{ position: 'relative' }}>
        <CircularTimer seconds={timerSeconds} rolling={isRolling} />
        {!isRolling && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
            <TimerIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
              {isIdle ? 'Klar' : 'CUT'}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* ── ROLL / CUT button ── */}
      <Button
        variant="contained"
        onClick={isRolling ? onCut : onRoll}
        aria-label={isRolling ? 'CUT – stop recording' : 'ROLL – start recording'}
        startIcon={isRolling
          ? <CutIcon sx={{ fontSize: '28px !important' }} />
          : <RecordIcon sx={{ fontSize: '28px !important', animation: !isRolling ? 'none' : undefined }} />
        }
        sx={{
          minHeight: 120,
          borderRadius: 3,
          fontSize: 32,
          fontWeight: 900,
          letterSpacing: '0.08em',
          bgcolor: isRolling ? 'rgba(255,255,255,0.92)' : '#ef4444',
          color: isRolling ? '#111' : '#fff',
          border: 'none',
          boxShadow: isRolling ? 'none' : '0 0 0 0 rgba(239,68,68,0.7)',
          animation: isRolling ? `${rollPulse} 1.6s ease-out infinite` : 'none',
          transition: 'background-color 0.25s, color 0.25s',
          '&:hover': {
            bgcolor: isRolling ? 'rgba(255,255,255,0.8)' : '#dc2626',
          },
          '&:disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)' },
          ...focusStyles,
        }}
      >
        {isRolling ? 'CUT' : 'ROLL'}
      </Button>
      <Typography variant="caption" sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', mt: -1, fontSize: 10 }}>
        {isRolling ? 'Trykk C for å kutte' : 'Trykk R for å rulle'}
      </Typography>

      {/* ── Quick Actions ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, pl: 0.5 }}>
          Quick Actions
        </Typography>
        {QUICK_ACTIONS.map(({ type, label, Icon: QaIcon, color }) => {
          const isSetupComplete = type === 'setup_complete';
          return (
            <Button
              key={type}
              variant="outlined"
              size="small"
              onClick={isSetupComplete ? onSetupComplete : () => onAddFlag(type)}
              disabled={isRolling && !['good_take', 'pickup_shot', 'action_safe', 'check_focus'].includes(type)}
              sx={{
                minHeight: TOUCH_TARGET,
                justifyContent: 'flex-start',
                gap: 1,
                px: 1.5,
                borderColor: `${color}33`,
                color: 'rgba(255,255,255,0.75)',
                fontSize: touchUi ? 14 : 13,
                fontWeight: 500,
                py: touchUi ? 0.75 : undefined,
                '&:hover': { bgcolor: `${color}15`, borderColor: `${color}66` },
                '&:disabled': { opacity: 0.3 },
                ...focusStyles,
              }}
            >
              <QaIcon sx={{ fontSize: 18, color }} />
              {label}
              {isSetupComplete && isCut && (
                <Chip label="Klar" size="small" sx={{ ml: 'auto', bgcolor: '#10b98120', color: '#10b981', fontSize: 10, height: 18 }} />
              )}
            </Button>
          );
        })}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mt: 0.5 }} />

      {/* ── Quick Note shortcut (visible when not rolling) ── */}
      {isIdle && (
        <Tooltip title="Fokuser notater (N)">
          <Button
            variant="outlined"
            size={touchUi ? 'medium' : 'small'}
            onClick={() => noteInputRef.current?.focus()}
            startIcon={<NoteIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.45)',
              fontSize: touchUi ? 13 : 11,
              minHeight: touchUi ? 42 : undefined,
              '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' },
            }}
          >
            Legg til notat (N)
          </Button>
        </Tooltip>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mt: 0.5 }} />

      {/* ── Camera Metadata ── */}
      <Paper sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }}>
        <Box
          sx={{ px: 1.25, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setShowCamEdit((v) => !v)}
        >
          <Stack direction="row" spacing={0.75} alignItems="center">
            {showCamEdit ? <SettingsIcon sx={{ fontSize: 14, color: '#ef4444' }} /> : <VideocamIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />}
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, fontWeight: 600 }}>
              Camera Metadata
            </Typography>
          </Stack>
          <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.35)', p: 0.25 }}>
            {showCamEdit ? <CollapseIcon sx={{ fontSize: 16 }} /> : <EditIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Box>

        {!showCamEdit && (
          <Box sx={{ px: 1.25, pb: 1.25, display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
            {[
              { label: 'Cam', value: cameraMetadata.camera },
              { label: 'FPS', value: cameraMetadata.fps?.toString() },
              { label: 'ISO', value: cameraMetadata.iso?.toString() },
            ].filter((r) => r.value).map(({ label, value }) => (
              <Box key={label} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 0.9, py: 0.5, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, minWidth: 44 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {label}
                </Typography>
                <Typography variant="caption" sx={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        <Collapse in={showCamEdit}>
          <Box sx={{ px: 1.25, pb: 1.25, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
            {(
              [
                { field: 'camera' as const, label: 'Kamera', placeholder: 'Cam A' },
                { field: 'lens' as const, label: 'Linse', placeholder: '50mm' },
                { field: 'aperture' as const, label: 'Blende', placeholder: 'T2.8' },
                { field: 'nd' as const, label: 'ND Filter', placeholder: 'ND 0.9' },
              ] as const
            ).map(({ field, label, placeholder }) => (
              <TextField
                key={field}
                label={label}
                placeholder={placeholder}
                size="small"
                value={cameraMetadata[field] ?? ''}
                onChange={(e) => onSetCamera({ [field]: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#ef4444' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' },
                }}
              />
            ))}
            {[
              { field: 'fps' as const, label: 'FPS' },
              { field: 'iso' as const, label: 'ISO' },
            ].map(({ field, label }) => (
              <TextField
                key={field}
                label={label}
                size="small"
                type="number"
                value={cameraMetadata[field] ?? ''}
                onChange={(e) => onSetCamera({ [field]: e.target.value ? Number(e.target.value) : undefined })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                    '&.Mui-focused fieldset': { borderColor: '#ef4444' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' },
                }}
              />
            ))}
            <FormControl size="small" sx={{ gridColumn: '1 / -1' }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-focused': { color: '#ef4444' } }}>FPS Preset</InputLabel>
              <Select
                label="FPS Preset"
                value={cameraMetadata.fps?.toString() ?? ''}
                onChange={(e) => onSetCamera({ fps: e.target.value ? Number(e.target.value) : undefined })}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#1c2128', color: '#fff' } } }}
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ef4444' },
                  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.4)' },
                }}
              >
                <MenuItem value="">— Ingen —</MenuItem>
                {[23.976, 24, 25, 29.97, 30, 50, 59.94, 60, 120].map((fps) => (
                  <MenuItem key={fps} value={fps.toString()}>{fps} fps</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Collapse>
      </Paper>

      {/* ── Previous takes summary ── */}
      {takes.length > 0 ? (
        <Paper sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }}>
          <Box sx={{ px: 1.25, py: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10 }}>
              🎬 Takes denne scenen ({takes.length})
            </Typography>
          </Box>
          <Box sx={{ px: 1.25, pb: 1.25, display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
            {visibleTakes.map((t) => {
              const meta = TAKE_STATUS_META[t.status];
              return (
                <Box
                  key={t.id}
                  sx={{
                    px: 1, py: 0.45, borderRadius: 1,
                    bgcolor: meta.bg,
                    border: `1px solid ${meta.color}44`,
                    display: 'flex', alignItems: 'center', gap: 0.45,
                  }}
                >
                  <Typography variant="caption" sx={{ color: meta.color, fontSize: 11, fontWeight: 700 }}>
                    T{t.takeNumber}
                  </Typography>
                  {t.duration != null ? (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                      {formatTimer(t.duration)}
                    </Typography>
                  ) : null}
                </Box>
              );
            })}
            {takes.length > 8 ? (
              <IconButton
                size="small"
                onClick={() => setShowAllTakes((v) => !v)}
                sx={{ alignSelf: 'center', color: 'rgba(255,255,255,0.35)', p: 0.4 }}
              >
                {showAllTakes ? <CollapseIcon sx={{ fontSize: 16 }} /> : <ExpandIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            ) : null}
          </Box>
        </Paper>
      ) : null}
    </Box>
  );
};

// ── Sub-component: ContextPanel (Center) ─────────────────────────────────────

interface LiveSetContextPanelProps {
  scene: LiveSetScene | null;
  cameraMetadata: LiveSetCameraMetadata;
  touchUi: boolean;
  mentionCandidates: string[];
  shotOptions: ShotOption[];
  takeCapture: TakeCaptureForm;
  shotListSync: ShotListSyncState;
  scriptContent?: string;
  storyboardFrames: StoryboardTile[];
  projectStoryboardFrames: StoryboardTile[];
  sceneLabelById: Record<string, string>;
  onCaptureChange: (patch: Partial<TakeCaptureForm>) => void;
  onToggleContinuityFlag: (flag: string) => void;
  onCaptureTake: () => void;
}

const LiveSetContextPanel: FC<LiveSetContextPanelProps> = ({
  scene,
  cameraMetadata,
  touchUi,
  mentionCandidates,
  shotOptions,
  takeCapture,
  shotListSync,
  scriptContent,
  storyboardFrames,
  projectStoryboardFrames,
  sceneLabelById,
  onCaptureChange,
  onToggleContinuityFlag,
  onCaptureTake,
}) => {
  const theme = useTheme();
  const previewIsTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const previewIs2K = useMediaQuery('(min-width: 2048px)');
  const previewIs4K = useMediaQuery('(min-width: 3840px)');
  const previewIs5K = useMediaQuery('(min-width: 5120px)');
  const previewHiDpi = useMediaQuery('(min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2)');
  const [storyboardScope, setStoryboardScope] = useState<'scene' | 'project'>('scene');
  const [activeStoryboardIndex, setActiveStoryboardIndex] = useState(0);
  const [storyboardPreviewOpen, setStoryboardPreviewOpen] = useState(false);
  const visibleStoryboards = useMemo(
    () => (storyboardScope === 'project' ? projectStoryboardFrames : storyboardFrames),
    [projectStoryboardFrames, storyboardFrames, storyboardScope],
  );
  const activeStoryboard = visibleStoryboards[activeStoryboardIndex];
  const activeStoryboardSceneLabel = useMemo(() => {
    if (!activeStoryboard?.sourceSceneId) return undefined;
    return sceneLabelById[activeStoryboard.sourceSceneId];
  }, [activeStoryboard?.sourceSceneId, sceneLabelById]);
  const previewDialogWidth = previewIs5K
    ? 'min(95vw, 4600px)'
    : previewIs4K
      ? 'min(95vw, 3600px)'
      : previewIs2K
        ? 'min(95vw, 2600px)'
        : previewIsTablet
          ? 'min(96vw, 1180px)'
          : 'min(96vw, 980px)';
  const previewImageMaxHeight = previewIs5K
    ? '74vh'
    : previewIs4K
      ? '72vh'
      : previewIs2K
        ? '70vh'
        : previewIsTablet
          ? '62vh'
          : '58vh';
  const previewThumbWidth = previewIs5K ? 260 : previewIs4K ? 220 : previewIs2K ? 182 : previewIsTablet ? 154 : 138;
  const previewThumbHeight = previewIs5K ? 148 : previewIs4K ? 124 : previewIs2K ? 102 : previewIsTablet ? 86 : 78;
  const previewDialogPadding = previewIs5K ? 2.6 : previewIs4K ? 2.2 : previewIs2K ? 1.9 : previewIsTablet ? 1.6 : 1.35;
  const normalizedShotId = shotOptions.some((shot) => shot.id === takeCapture.shotId) ? takeCapture.shotId : '';

  useEffect(() => {
    setActiveStoryboardIndex((current) => {
      if (visibleStoryboards.length === 0) return 0;
      return Math.min(current, visibleStoryboards.length - 1);
    });
  }, [visibleStoryboards.length, storyboardScope]);

  const moveActiveStoryboard = useCallback((direction: 1 | -1) => {
    setActiveStoryboardIndex((current) => {
      if (visibleStoryboards.length === 0) return 0;
      const next = current + direction;
      if (next < 0 || next >= visibleStoryboards.length) return current;
      return next;
    });
  }, [visibleStoryboards.length]);

  useEffect(() => {
    if (!storyboardPreviewOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveActiveStoryboard(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveActiveStoryboard(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveActiveStoryboard, storyboardPreviewOpen]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2.5, overflowY: 'auto', minHeight: 0 }}>

      {/* ── Current Scene Card ── */}
      <Paper sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
        {/* Scene header */}
        <Box sx={{ px: 2, py: 1.5, bgcolor: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '0.04em' }}>
            Sc. {scene?.sceneNumber ?? '—'}
          </Typography>
          {scene && (
            <>
              <Chip label={scene.intExt} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
              <Chip label={scene.timeOfDay} size="small" sx={{ bgcolor: 'rgba(255,184,0,0.12)', color: '#ffb800', fontSize: 11 }} />
            </>
          )}
        </Box>
        <Box sx={{ px: 2, py: 1.5 }}>
          {scene ? (
            <>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
                Lokasjon
              </Typography>
              <Typography variant="body2" sx={{ color: '#fff', mb: 1.5, fontWeight: 500 }}>
                {scene.location}
              </Typography>
              {scene.synopsis && (
                <>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
                    Synopsis
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, fontSize: 13 }}>
                    {scene.synopsis}
                  </Typography>
                </>
              )}
              {scene.pageCount != null && (
                <Typography variant="caption" sx={{ color: '#3b82f6', mt: 1, display: 'block' }}>
                  {scene.pageCount} sider
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
              Ingen scene valgt
            </Typography>
          )}
        </Box>

        {/* Reference stills row */}
        {scene?.referenceStills?.length ? (
          <Box sx={{ px: 2, pb: 1.5 }}>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.75 }}>
              <StillIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Ref Stills ({scene.referenceStills.length})
              </Typography>
            </Stack>
            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto' }}>
              {scene.referenceStills.map((url, i) => (
                <Box
                  key={i}
                  component="img"
                  src={url}
                  alt={`Ref ${i + 1}`}
                  sx={{ height: 64, borderRadius: 1, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}
                />
              ))}
            </Box>
          </Box>
        ) : null}
      </Paper>

      {/* ── Shot + Take capture (sync to shot list) ── */}
      <Paper sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }}>
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <CaptureIcon sx={{ fontSize: 16, color: '#00d4ff' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, fontWeight: 700 }}>
              Shot + Take Capture
            </Typography>
          </Stack>
          <Chip
            label={shotListSync.message || 'Klar for sync'}
            size="small"
            sx={{
              fontSize: 10,
              color:
                shotListSync.status === 'success'
                  ? '#10b981'
                  : shotListSync.status === 'error'
                    ? '#ef4444'
                    : shotListSync.status === 'syncing'
                      ? '#ffb800'
                      : 'rgba(255,255,255,0.6)',
              bgcolor:
                shotListSync.status === 'success'
                  ? 'rgba(16,185,129,0.16)'
                  : shotListSync.status === 'error'
                    ? 'rgba(239,68,68,0.16)'
                    : shotListSync.status === 'syncing'
                      ? 'rgba(255,184,0,0.16)'
                      : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          />
        </Box>
        <Box sx={{ px: 2, pb: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 160px' }, gap: touchUi ? 1.25 : 1 }}>
          <FormControl size={touchUi ? 'medium' : 'small'}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.45)', '&.Mui-focused': { color: '#00d4ff' } }}>Shot</InputLabel>
            <Select
              label="Shot"
              value={normalizedShotId}
              onChange={(event) => onCaptureChange({ shotId: event.target.value })}
              MenuProps={{ PaperProps: { sx: { bgcolor: '#171a2a', color: '#fff', maxHeight: touchUi ? 420 : 320 } } }}
              sx={{
                color: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00d4ff' },
                '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.4)' },
                '& .MuiSelect-select': { py: touchUi ? 1.1 : 0.6, fontSize: touchUi ? 14 : 13 },
              }}
            >
              {shotOptions.length === 0 ? (
                <MenuItem value="" disabled>Ingen shots funnet for aktiv scene</MenuItem>
              ) : (
                shotOptions.map((shot) => (
                  <MenuItem key={shot.id} value={shot.id}>
                    {shot.label}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
          <FormControl size={touchUi ? 'medium' : 'small'}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.45)', '&.Mui-focused': { color: '#10b981' } }}>Kvalitet</InputLabel>
            <Select
              label="Kvalitet"
              value={takeCapture.quality}
              onChange={(event) => onCaptureChange({ quality: event.target.value as TakeStatus })}
              MenuProps={{ PaperProps: { sx: { bgcolor: '#171a2a', color: '#fff', maxHeight: touchUi ? 420 : 320 } } }}
              sx={{
                color: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' },
                '& .MuiSelect-select': { py: touchUi ? 1.1 : 0.6, fontSize: touchUi ? 14 : 13 },
              }}
            >
              {(['normal', 'selected', 'circled', 'print', 'ng'] as TakeStatus[]).map((status) => (
                <MenuItem key={status} value={status}>
                  {TAKE_STATUS_META[status]?.label ?? status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Take-notat"
            value={takeCapture.notes}
            onChange={(event) => onCaptureChange({ notes: event.target.value })}
            placeholder="Ytelse, kontinuitet, tekniske merknader…"
            size={touchUi ? 'medium' : 'small'}
            multiline
            minRows={2}
            sx={{
              gridColumn: '1 / -1',
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                '&.Mui-focused fieldset': { borderColor: '#a855f7' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
            }}
          />
          <Box sx={{ gridColumn: '1 / -1', mt: -0.5 }}>
            <GlobalMentionHelper
              text={takeCapture.notes}
              localCandidates={mentionCandidates}
              autoTagTitle="Auto-tagget i take-notat"
              suggestionTitle="Mener du?"
              onApplySuggestion={(name) => onCaptureChange({ notes: applyMentionSuggestion(takeCapture.notes, name) })}
            />
          </Box>
          <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {CONTINUITY_FLAGS.map((flag) => {
              const selected = takeCapture.continuityFlags.includes(flag);
              return (
                <Chip
                  key={flag}
                  label={flag}
                  size={touchUi ? 'medium' : 'small'}
                  onClick={() => onToggleContinuityFlag(flag)}
                  sx={{
                    fontSize: touchUi ? 12 : 10,
                    cursor: 'pointer',
                    color: selected ? '#a855f7' : 'rgba(255,255,255,0.55)',
                    bgcolor: selected ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selected ? 'rgba(168,85,247,0.45)' : 'rgba(255,255,255,0.15)'}`,
                    minHeight: touchUi ? 34 : undefined,
                  }}
                />
              );
            })}
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} alignItems={{ sm: 'center' }} sx={{ gridColumn: '1 / -1', pt: 0.25 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)' }}>
              Kamera: {cameraMetadata.camera || '—'} • Linse: {cameraMetadata.lens || '—'} • FPS: {cameraMetadata.fps ?? '—'}
            </Typography>
            <Button
              variant="contained"
              onClick={onCaptureTake}
              disabled={!normalizedShotId}
              startIcon={<CaptureIcon sx={{ fontSize: 16 }} />}
              sx={{
                ml: { sm: 'auto' },
                bgcolor: '#00d4ff',
                color: '#041420',
                fontWeight: 700,
                minHeight: touchUi ? 44 : undefined,
                '&:hover': { bgcolor: '#22d3ee' },
                '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)' },
              }}
            >
              Capture + Sync Shot List
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* ── Script + Storyboard ── */}
      <Paper sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }}>
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <ScriptIcon sx={{ fontSize: 16, color: '#c084fc' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, fontWeight: 700 }}>
            Script og tilknyttede storyboards
          </Typography>
        </Box>
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.65, fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {scriptContent || 'Ingen script-utdrag koblet til denne scenen enda.'}
          </Typography>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <StoryboardIcon sx={{ fontSize: 16, color: '#22d3ee' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10 }}>
            Storyboards ({visibleStoryboards.length})
          </Typography>
          <Chip
            size="small"
            label={storyboardScope === 'scene' ? 'Scene-koblet' : 'Hele prosjektet'}
            sx={{
              height: 19,
              fontSize: 10,
              fontWeight: 700,
              color: '#67e8f9',
              border: '1px solid rgba(34,211,238,0.4)',
              bgcolor: 'rgba(8,47,73,0.35)',
              '& .MuiChip-label': { px: 0.8 },
            }}
          />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.34)', fontSize: 10 }}>
            {storyboardScope === 'scene'
              ? 'Viser storyboard koblet til aktiv scene.'
              : 'Viser storyboard fra alle scener i prosjektet.'}
          </Typography>
        </Box>
        <Box sx={{ px: 2, pb: 1.25, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant={storyboardScope === 'scene' ? 'contained' : 'outlined'}
            onClick={() => setStoryboardScope('scene')}
            sx={{
              minWidth: 120,
              fontSize: 11,
              fontWeight: 700,
              bgcolor: storyboardScope === 'scene' ? 'rgba(14,116,144,0.34)' : undefined,
              borderColor: 'rgba(56,189,248,0.45)',
              color: storyboardScope === 'scene' ? '#bae6fd' : 'rgba(186,230,253,0.82)',
              '&:hover': { borderColor: '#38bdf8', bgcolor: 'rgba(14,116,144,0.25)' },
            }}
          >
            Aktiv scene
          </Button>
          <Button
            size="small"
            variant={storyboardScope === 'project' ? 'contained' : 'outlined'}
            onClick={() => setStoryboardScope('project')}
            sx={{
              minWidth: 128,
              fontSize: 11,
              fontWeight: 700,
              bgcolor: storyboardScope === 'project' ? 'rgba(14,116,144,0.34)' : undefined,
              borderColor: 'rgba(56,189,248,0.45)',
              color: storyboardScope === 'project' ? '#bae6fd' : 'rgba(186,230,253,0.82)',
              '&:hover': { borderColor: '#38bdf8', bgcolor: 'rgba(14,116,144,0.25)' },
            }}
          >
            Hele prosjektet
          </Button>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.34)', fontSize: 10 }}>
            Trykk kort for å bytte aktiv storyboard-referanse under opptak.
          </Typography>
        </Box>
        {visibleStoryboards.length > 0 ? (
          <>
            {activeStoryboard ? (
              <Box sx={{ px: 2, pb: 1.2 }}>
                <Paper
                  sx={{
                    p: 1,
                    bgcolor: 'rgba(15,23,42,0.55)',
                    border: '1px solid rgba(56,189,248,0.36)',
                    borderRadius: 1.5,
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 0.75 }}>
                    <Typography variant="caption" sx={{ color: '#bae6fd', fontWeight: 700, letterSpacing: '0.06em' }}>
                      Aktiv storyboard-referanse
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        size="small"
                        onClick={() => moveActiveStoryboard(-1)}
                        disabled={activeStoryboardIndex <= 0}
                        sx={{ color: 'rgba(186,230,253,0.86)', p: 0.35 }}
                      >
                        <PrevIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => moveActiveStoryboard(1)}
                        disabled={activeStoryboardIndex >= visibleStoryboards.length - 1}
                        sx={{ color: 'rgba(186,230,253,0.86)', p: 0.35 }}
                      >
                        <NextIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ZoomIcon sx={{ fontSize: 14 }} />}
                        onClick={() => setStoryboardPreviewOpen(true)}
                        sx={{
                          fontSize: 11,
                          minHeight: 28,
                          borderColor: 'rgba(56,189,248,0.45)',
                          color: '#bae6fd',
                          '&:hover': { borderColor: '#38bdf8', bgcolor: 'rgba(14,116,144,0.2)' },
                        }}
                      >
                        Forstørr
                      </Button>
                    </Stack>
                  </Stack>
                  <Box
                    component="img"
                    src={activeStoryboard.imageUrl}
                    alt={activeStoryboard.title}
                    sx={{
                      width: '100%',
                      maxHeight: 220,
                      borderRadius: 1.25,
                      objectFit: 'cover',
                      border: '1px solid rgba(255,255,255,0.12)',
                      display: 'block',
                    }}
                  />
                  <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.7, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700 }}>
                      {activeStoryboard.title}
                    </Typography>
                    {activeStoryboardSceneLabel ? (
                      <Chip
                        size="small"
                        label={activeStoryboardSceneLabel}
                        sx={{
                          height: 18,
                          fontSize: 10,
                          color: '#c4b5fd',
                          border: '1px solid rgba(167,139,250,0.42)',
                          bgcolor: 'rgba(76,29,149,0.3)',
                        }}
                      />
                    ) : null}
                    {activeStoryboard.source ? (
                      <Chip
                        size="small"
                        label={activeStoryboard.source}
                        sx={{
                          height: 18,
                          fontSize: 10,
                          color: '#bfdbfe',
                          border: '1px solid rgba(96,165,250,0.42)',
                          bgcolor: 'rgba(30,58,138,0.3)',
                          textTransform: 'uppercase',
                        }}
                      />
                    ) : null}
                  </Stack>
                  {activeStoryboard.description ? (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.62)', mt: 0.3, display: 'block' }}>
                      {activeStoryboard.description}
                    </Typography>
                  ) : null}
                </Paper>
              </Box>
            ) : null}
            <Box sx={{ px: 2, pb: 1.5, display: 'flex', gap: 1, overflowX: 'auto' }}>
            {visibleStoryboards.map((frame, frameIndex) => (
              <Paper
                key={frame.id}
                sx={{
                  minWidth: 168,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: frameIndex === activeStoryboardIndex
                    ? '1px solid rgba(56,189,248,0.65)'
                    : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: frameIndex === activeStoryboardIndex ? '0 0 0 1px rgba(56,189,248,0.24) inset' : 'none',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveStoryboardIndex(frameIndex)}
              >
                <Box component="img" src={frame.imageUrl} alt={frame.title} sx={{ width: 168, height: 92, objectFit: 'cover', display: 'block' }} />
                <Box sx={{ p: 1 }}>
                  <Typography variant="caption" sx={{ color: '#fff', display: 'block', fontWeight: 600 }}>
                    {frame.title}
                  </Typography>
                  {storyboardScope === 'project' && frame.sourceSceneId ? (
                    <Typography variant="caption" sx={{ color: 'rgba(196,181,253,0.88)', display: 'block', mt: 0.1 }}>
                      {sceneLabelById[frame.sourceSceneId] || frame.sourceSceneId}
                    </Typography>
                  ) : null}
                  {frame.description ? (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mt: 0.25 }}>
                      {frame.description}
                    </Typography>
                  ) : null}
                </Box>
              </Paper>
            ))}
          </Box>
          </>
        ) : (
          <Box sx={{ px: 2, pb: 1.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)' }}>
              Ingen scene-koblede storyboard-bilder for valgt scene. Koble storyboardet til scenen i storyboard-biblioteket.
            </Typography>
          </Box>
        )}
        <Dialog
          open={storyboardPreviewOpen}
          onClose={() => setStoryboardPreviewOpen(false)}
          fullWidth
          maxWidth={false}
          PaperProps={{
            sx: {
              bgcolor: 'rgba(4,10,21,0.98)',
              border: previewHiDpi ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(56,189,248,0.35)',
              boxShadow: '0 28px 72px rgba(2,6,23,0.72)',
              borderRadius: 2,
              width: previewDialogWidth,
              maxWidth: 'none',
              backgroundImage: `
                radial-gradient(circle at 88% 10%, rgba(56,189,248,0.16), transparent 52%),
                linear-gradient(160deg, rgba(8,47,73,0.16) 0%, rgba(2,6,23,0.85) 58%)
              `,
            },
          }}
        >
          <DialogTitle
            sx={{
              borderBottom: '1px solid rgba(56,189,248,0.2)',
              color: '#bae6fd',
              fontWeight: 800,
              background: 'linear-gradient(135deg, rgba(8,47,73,0.45), rgba(2,6,23,0.72) 72%)',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    color: '#bae6fd',
                    fontWeight: 800,
                    lineHeight: 1.1,
                    fontSize: previewIs5K ? 36 : previewIs4K ? 30 : previewIs2K ? 24 : previewIsTablet ? 21 : 18,
                  }}
                >
                  {activeStoryboard?.title || 'Storyboard'}
                </Typography>
                {visibleStoryboards.length > 0 ? (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(186,230,253,0.68)',
                      letterSpacing: '0.04em',
                      fontSize: previewIs5K ? 16 : previewIs4K ? 14 : previewIs2K ? 13 : previewIsTablet ? 12 : 11,
                    }}
                  >
                    {activeStoryboardIndex + 1} / {visibleStoryboards.length}
                  </Typography>
                ) : null}
              </Box>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                <Stack direction="row" spacing={0.45}>
                  <IconButton
                    size="small"
                    onClick={() => moveActiveStoryboard(-1)}
                    disabled={activeStoryboardIndex <= 0}
                    sx={{ color: 'rgba(186,230,253,0.86)', p: 0.35 }}
                  >
                    <PrevIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => moveActiveStoryboard(1)}
                    disabled={activeStoryboardIndex >= visibleStoryboards.length - 1}
                    sx={{ color: 'rgba(186,230,253,0.86)', p: 0.35 }}
                  >
                    <NextIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Stack>
                <RoleRoomBrandMark
                  appearance="header"
                  showLabel={false}
                  sx={{
                    width: { xs: 110, sm: 160 },
                  }}
                />
              </Stack>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ p: previewDialogPadding, pb: previewDialogPadding + 0.4 }}>
            {activeStoryboard ? (
              <>
                <Box
                  component="img"
                  src={activeStoryboard.imageUrl}
                  alt={activeStoryboard.title}
                  sx={{
                    width: '100%',
                    maxHeight: previewImageMaxHeight,
                    objectFit: 'contain',
                    borderRadius: 1.25,
                    border: previewHiDpi ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.12)',
                    display: 'block',
                    bgcolor: 'rgba(2,6,23,0.65)',
                  }}
                />
                {activeStoryboard.description ? (
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 1,
                      color: 'rgba(255,255,255,0.74)',
                      fontSize: previewIs5K ? 24 : previewIs4K ? 20 : previewIs2K ? 16 : previewIsTablet ? 14 : 13,
                    }}
                  >
                    {activeStoryboard.description}
                  </Typography>
                ) : null}
                {visibleStoryboards.length > 1 ? (
                  <Box
                    sx={{
                      mt: 1.35,
                      p: 1,
                      borderRadius: 1.5,
                      border: '1px solid rgba(56,189,248,0.28)',
                      bgcolor: 'rgba(7,13,26,0.88)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75, px: 0.2 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(186,230,253,0.9)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                        Filmstripe
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(186,230,253,0.62)', fontWeight: 600 }}>
                        {activeStoryboardIndex + 1}/{visibleStoryboards.length}
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        overflowX: 'auto',
                        pb: 0.5,
                        scrollSnapType: 'x mandatory',
                        '&::-webkit-scrollbar': { height: 8 },
                        '&::-webkit-scrollbar-thumb': {
                          backgroundColor: 'rgba(56,189,248,0.42)',
                          borderRadius: 8,
                        },
                        '&::-webkit-scrollbar-track': {
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          borderRadius: 8,
                        },
                      }}
                    >
                      {visibleStoryboards.map((frame, frameIndex) => (
                        <ButtonBase
                          key={`${frame.id}-preview-strip`}
                          onClick={() => setActiveStoryboardIndex(frameIndex)}
                          sx={{
                            position: 'relative',
                            borderRadius: 1.15,
                            overflow: 'hidden',
                            border: frameIndex === activeStoryboardIndex
                              ? '2px solid rgba(56,189,248,0.95)'
                              : '1px solid rgba(255,255,255,0.28)',
                            boxShadow: frameIndex === activeStoryboardIndex
                              ? '0 0 0 1px rgba(56,189,248,0.3), 0 6px 18px rgba(14,116,144,0.24)'
                              : 'none',
                            flexShrink: 0,
                            width: previewThumbWidth,
                            height: previewThumbHeight,
                            opacity: frameIndex === activeStoryboardIndex ? 1 : 0.9,
                            transition: 'opacity 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease',
                            scrollSnapAlign: 'start',
                            '&:hover': { opacity: 1, borderColor: 'rgba(56,189,248,0.74)' },
                          }}
                        >
                          <Box
                            component="img"
                            src={frame.imageUrl}
                            alt={frame.title}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                          <Box
                            sx={{
                              position: 'absolute',
                              left: 4,
                              bottom: 4,
                              px: 0.55,
                              py: 0.15,
                              borderRadius: 0.6,
                              bgcolor: frameIndex === activeStoryboardIndex
                                ? 'rgba(2,132,199,0.88)'
                                : 'rgba(2,6,23,0.72)',
                              border: '1px solid rgba(255,255,255,0.25)',
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#fff',
                                fontSize: previewIs5K ? 13 : previewIs4K ? 12 : previewIs2K ? 11 : 10,
                                fontWeight: 700,
                              }}
                            >
                              {frameIndex + 1}
                            </Typography>
                          </Box>
                        </ButtonBase>
                      ))}
                    </Box>
                  </Box>
                ) : null}
              </>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ borderTop: '1px solid rgba(56,189,248,0.2)', justifyContent: 'space-between', px: previewDialogPadding }}>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(186,230,253,0.62)',
                px: 1,
                fontSize: previewIs5K ? 16 : previewIs4K ? 14 : previewIs2K ? 13 : previewIsTablet ? 12 : 11,
              }}
            >
              Bruk pil venstre/høyre for å bytte storyboard.
            </Typography>
            <Button
              onClick={() => setStoryboardPreviewOpen(false)}
              sx={{
                color: '#bae6fd',
                fontSize: previewIs5K ? 21 : previewIs4K ? 18 : previewIs2K ? 16 : previewIsTablet ? 14 : 13,
                px: previewIs5K ? 2.5 : 1.75,
                py: previewIs5K ? 1.05 : 0.65,
              }}
            >
              Lukk
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>

    </Box>
  );
};

// ── Sub-component: TakeRow ────────────────────────────────────────────────────

interface TakeRowProps {
  take: LiveSetTake;
  touchUi: boolean;
  isFocused: boolean;
  onFocus: () => void;
  onStatusChange: (id: string, s: TakeStatus) => void;
  /** Backup-status snapshotter set-state ved take-tidspunkt. Når
   *  per-take-backup-tracking implementeres, byttes denne ut med
   *  take.backup. For nå viser vi current set-state som visuell
   *  proxy — adminen ser om backup pågår eller er ferdig. */
  backupStatus?: {
    original: boolean;
    primary: boolean;
    secondary: boolean;
    offsite: boolean;
  };
}

const TakeRow: FC<TakeRowProps> = ({ take, touchUi, isFocused, onFocus, onStatusChange, backupStatus }) => {
  const meta = TAKE_STATUS_META[take.status];
  const StatusIcon = meta.Icon;

  return (
    <Box
      tabIndex={0}
      onClick={onFocus}
      onFocus={onFocus}
      sx={{
        px: 1.5, py: 1.25,
        minHeight: touchUi ? 72 : undefined,
        bgcolor: isFocused ? 'rgba(239,68,68,0.07)' : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        borderLeft: `3px solid ${meta.color}`,
        cursor: 'pointer',
        transition: 'background-color 0.12s',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
        outline: isFocused ? '2px solid rgba(239,68,68,0.3)' : 'none',
        outlineOffset: -1,
      }}
    >
      {/* Row 1: Take number + status icon + duration + status chips */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
            TAKE {take.takeNumber.toString().padStart(2, '0')}
          </Typography>
          {StatusIcon && <StatusIcon sx={{ fontSize: 14, color: meta.color }} />}
        </Stack>
        {take.duration != null && (
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
            {formatTimer(take.duration)}
          </Typography>
        )}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
          {/* Status chips row */}
          {(['circled', 'print', 'selected', 'ng'] as TakeStatus[]).map(s => {
            const sm = TAKE_STATUS_META[s];
            const active = take.status === s;
            return (
              <Chip
                key={s}
                label={sm.label}
                size="small"
                onClick={(e) => { e.stopPropagation(); onStatusChange(take.id, active ? 'normal' : s); }}
                sx={{
                  fontSize: touchUi ? 11 : 9,
                  height: touchUi ? 24 : 18,
                  cursor: 'pointer',
                  bgcolor: active ? sm.bg : 'transparent',
                  color: active ? sm.color : 'rgba(255,255,255,0.25)',
                  border: `1px solid ${active ? sm.color + '66' : 'rgba(255,255,255,0.1)'}`,
                  '&:hover': { bgcolor: sm.bg, color: sm.color },
                  fontWeight: active ? 700 : 400,
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Row 2: Cam + flags + loggedBy avatar + sync */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
        <Chip label={take.camera} size="small" sx={{ fontSize: 9, height: 16, bgcolor: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }} />
        {take.lens && <Chip label={take.lens} size="small" sx={{ fontSize: 9, height: 16, bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }} />}
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
          {fmtTime(take.loggedAt)}
        </Typography>
        {take.flags.map(f => {
          const qa = QUICK_ACTIONS.find(q => q.type === f);
          return qa ? (
            <Chip key={f} label={qa.emoji} size="small" sx={{ fontSize: 11, height: 16, bgcolor: `${qa.color}18`, border: `1px solid ${qa.color}44`, px: 0.25 }} />
          ) : null;
        })}
        {backupStatus ? (
          <Tooltip
            title={`DIT-backup: Original ${backupStatus.original ? '✓' : '⏳'} · Primary ${backupStatus.primary ? '✓' : '⏳'} · Secondary ${backupStatus.secondary ? '✓' : '⏳'} · Offsite ${backupStatus.offsite ? '✓' : '⏳'}`}
            placement="top"
          >
            <Box sx={{ display: 'flex', gap: 0.3, alignItems: 'center', ml: 0.5 }}>
              {([
                ['original', backupStatus.original],
                ['primary', backupStatus.primary],
                ['secondary', backupStatus.secondary],
                ['offsite', backupStatus.offsite],
              ] as const).map(([key, done]) => (
                <Box
                  key={key}
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: done ? '#10b981' : 'rgba(255,255,255,0.18)',
                    border: done ? '1px solid #10b98180' : '1px solid rgba(255,255,255,0.22)',
                  }}
                />
              ))}
            </Box>
          </Tooltip>
        ) : null}
        <Tooltip title={`Logget av: ${take.loggedBy}`} placement="top">
          <Avatar
            sx={{
              width: 16, height: 16, fontSize: 9, fontWeight: 700,
              bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)',
              ml: 'auto',
            }}
          >
            {take.loggedBy.charAt(0).toUpperCase()}
          </Avatar>
        </Tooltip>
        {!take.synced && (
          <Chip label="PENDING SYNC" size="small" sx={{ ml: 'auto', fontSize: 9, height: 16, bgcolor: 'rgba(255,184,0,0.1)', color: '#ffb800', border: '1px solid rgba(255,184,0,0.3)' }} />
        )}
      </Box>
      {take.notes && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, mt: 0.5, display: 'block', fontStyle: 'italic' }}>
          {take.notes}
        </Typography>
      )}
    </Box>
  );
};

// ── Sub-component: ActivityPanel (Right) ─────────────────────────────────────

interface LiveSetActivityPanelProps {
  takes: LiveSetTake[];
  notes: LiveSetNote[];
  touchUi: boolean;
  globalMentionCandidates?: string[];
  activeTab: 'takes' | 'notes';
  focusedTakeIndex: number;
  noteInput: string;
  noteTag: NoteTag;
  noteInputRef: React.RefObject<HTMLInputElement | null>;
  /** Set-level DIT-backup-status — propagert til hver TakeRow */
  backupStatus?: { original: boolean; primary: boolean; secondary: boolean; offsite: boolean };
  onTabChange: (t: 'takes' | 'notes') => void;
  onFocusTake: (i: number) => void;
  onStatusChange: (id: string, s: TakeStatus) => void;
  onNoteInput: (v: string) => void;
  onNoteTag: (t: NoteTag) => void;
  onAddNote: () => void;
  onDeleteNote: (id: string) => void;
}

const LiveSetActivityPanel: FC<LiveSetActivityPanelProps> = ({
  takes, notes, touchUi, globalMentionCandidates = [], activeTab, focusedTakeIndex,
  noteInput, noteTag, noteInputRef, backupStatus,
  onTabChange, onFocusTake, onStatusChange,
  onNoteInput, onNoteTag, onAddNote, onDeleteNote,
}) => {
  const mentionCandidates = useMemo(() => {
    const deduped = new Set<string>(globalMentionCandidates);
    for (const note of notes) {
      if (typeof note.author === 'string' && note.author.trim().length > 0) {
        deduped.add(note.author.trim());
      }
    }
    for (const take of takes) {
      if (typeof take.loggedBy === 'string' && take.loggedBy.trim().length > 0) {
        deduped.add(take.loggedBy.trim());
      }
    }
    return Array.from(deduped).sort((left, right) => left.localeCompare(right, 'no-NO'));
  }, [notes, takes, globalMentionCandidates]);

  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column',
        bgcolor: 'rgba(10,10,18,0.92)', borderLeft: '1px solid rgba(255,255,255,0.06)',
        minHeight: 0,
      }}
    >
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => onTabChange(v)}
        sx={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          minHeight: touchUi ? 52 : 40,
          '& .MuiTabs-indicator': { bgcolor: '#ef4444' },
          '& .MuiTab-root': {
            color: 'rgba(255,255,255,0.4)',
            minHeight: touchUi ? 52 : 40,
            fontSize: touchUi ? 13 : 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          },
          '& .Mui-selected': { color: '#fff !important' },
        }}
      >
        <Tab
          value="takes"
          label={
            <Badge
              badgeContent={takes.filter(t => !t.synced).length || null}
              sx={{
                '& .MuiBadge-badge': {
                  bgcolor: '#ffb800', color: '#000', fontSize: 9,
                  minWidth: 14, height: 14, right: -6, top: -4,
                },
              }}
            >
              {takes.length ? `Takes (${takes.length})` : 'Takes'}
            </Badge>
          }
        />
        <Tab
          value="notes"
          label={
            <Stack direction="row" spacing={0.5} alignItems="center">
              <NoteIcon sx={{ fontSize: 14 }} />
              <span>{notes.length ? `Notes (${notes.length})` : 'Notes'}</span>
            </Stack>
          }
        />
      </Tabs>

      {/* Content area */}
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {activeTab === 'takes' ? (
          takes.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 1 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 40 }}>🎬</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                Ingen takes ennå
              </Typography>
            </Box>
          ) : (
            takes.map((take, i) => (
              <TakeRow
                key={take.id}
                take={take}
                touchUi={touchUi}
                isFocused={focusedTakeIndex === i}
                onFocus={() => onFocusTake(i)}
                onStatusChange={onStatusChange}
                backupStatus={backupStatus}
              />
            ))
          )
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {notes.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 36 }}>📋</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.25)', mt: 1, fontStyle: 'italic' }}>
                  Ingen notater ennå – trykk N
                </Typography>
              </Box>
            ) : (
              notes.map(note => {
                const tagMeta = NOTE_TAG_META[note.tag];
                return (
                  <Box
                    key={note.id}
                    sx={{
                      px: 1.5, py: 1.25, borderBottom: '1px solid rgba(255,255,255,0.05)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.5 }}>
                      <Chip
                        label={tagMeta.label}
                        size="small"
                        sx={{ fontSize: 9, height: 16, bgcolor: `${tagMeta.color}22`, color: tagMeta.color, border: `1px solid ${tagMeta.color}44`, flexShrink: 0 }}
                      />
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, ml: 'auto', whiteSpace: 'nowrap' }}>
                        {fmtTime(note.timestamp)}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => onDeleteNote(note.id)}
                        sx={{ p: 0.25, color: 'rgba(255,255,255,0.2)', '&:hover': { color: '#ef4444' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.5 }}>
                      {note.content}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
                      — {note.author}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        )}
      </Box>

      {/* ── Quick Add Note ── */}
      {activeTab === 'notes' && (
        <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.07)', bgcolor: 'rgba(0,0,0,0.2)' }}>
          {/* Tag selector with header */}
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
            <TagIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Tag
            </Typography>
          </Stack>
          <Box sx={{ display: 'flex', gap: 0.5, mb: 0.75, flexWrap: 'wrap' }}>
            {(Object.entries(NOTE_TAG_META) as [NoteTag, typeof NOTE_TAG_META[NoteTag]][]).map(([tag, m]) => (
              <Chip
                key={tag}
                label={m.label}
                size="small"
                onClick={() => onNoteTag(tag)}
                sx={{
                  cursor: 'pointer',
                  fontSize: 10, height: 20,
                  bgcolor: noteTag === tag ? `${m.color}22` : 'transparent',
                  color: noteTag === tag ? m.color : 'rgba(255,255,255,0.35)',
                  border: `1px solid ${noteTag === tag ? m.color + '55' : 'rgba(255,255,255,0.1)'}`,
                  '&:hover': { bgcolor: `${m.color}18` },
                }}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <TextField
              inputRef={noteInputRef}
              value={noteInput}
              onChange={(e) => onNoteInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddNote(); } }}
              placeholder="Legg til notat…  (N)"
              size={touchUi ? 'medium' : 'small'}
              multiline
              maxRows={3}
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  fontSize: touchUi ? 14 : 13,
                  minHeight: touchUi ? 44 : undefined,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                  '&.Mui-focused fieldset': { borderColor: '#ef4444' },
                },
              }}
            />
            <Tooltip title="Legg til (Enter)">
              <Box>
                <Button
                  variant="contained"
                  size={touchUi ? 'medium' : 'small'}
                  disabled={!noteInput.trim()}
                  onClick={onAddNote}
                  sx={{
                    minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET,
                    bgcolor: '#ef4444',
                    '&:hover': { bgcolor: '#dc2626' },
                    '&:disabled': { bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  <EnterIcon sx={{ fontSize: 18 }} />
                </Button>
              </Box>
            </Tooltip>
          </Box>
          <GlobalMentionHelper
            text={noteInput}
            localCandidates={mentionCandidates}
            autoTagTitle="Auto-tagget i notat"
            suggestionTitle="Mener du?"
            onApplySuggestion={(name) => onNoteInput(applyMentionSuggestion(noteInput, name))}
          />
        </Box>
      )}
    </Box>
  );
};

// ── Sub-component: LiveSetFooterBar ──────────────────────────────────────────
//
// Bunn-status-bar som matcher Pro-visning-mockupen. Viser:
//   - SET STATUS (sjekklister-ready)
//   - VÆR (live yr-data)
//   - BATTERIER (kamera-batteri-status — placeholder til kameraer wires)
//   - LAGRING (kort-kapasitet — placeholder)
//   - TID (live klokke + opptaksdag-teller)
//   - CREW KOMMUNIKASJON (ulest-chat-teller)

interface LiveSetFooterBarProps {
  status: SetStatusState;
  weatherLive: LiveWeatherState;
  shootingDay?: string;
  unreadChatCount?: number;
  setupStartedAt?: string;
  takesCompletedToday?: number;
  onOpenDitDrawer?: () => void;
}

const LiveSetFooterBar: FC<LiveSetFooterBarProps> = ({
  status,
  weatherLive,
  shootingDay,
  unreadChatCount = 0,
  setupStartedAt,
  takesCompletedToday = 0,
  onOpenDitDrawer,
}) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Setup-timer: hvor lenge har current setup tatt
  const setupElapsedSec = setupStartedAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(setupStartedAt).getTime()) / 1000))
    : 0;
  const setupTimerLabel = setupStartedAt ? formatTimer(setupElapsedSec) : '—';

  // Wrap-projeksjon: enkel heuristikk. Hvis 1 take/15 min og 6 takes igjen → +90 min
  const remainingTakes = Math.max(0, 8 - takesCompletedToday);
  const projectedWrapMin = remainingTakes * 15;
  const projectedWrapTime = new Date(now.getTime() + projectedWrapMin * 60 * 1000);
  const projectedWrapLabel = projectedWrapMin > 0
    ? projectedWrapTime.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
    : '—';

  // Opptaksdag X — beregner fra shootingDay (sammenligner mot 1. opptaksdag-startet sceneId)
  const shootingDayLabel = shootingDay
    ? `Opptaksdag ${new Date(shootingDay).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })}`
    : 'Opptaksdag —';

  // Backup-status sammenlagt
  const backupCompleted = [status.backupOriginal, status.backupPrimary, status.backupSecondary, status.backupOffsite]
    .filter(Boolean).length;

  // Sjekklister-ready
  const crewReady = status.crewPresent >= status.crewTotal;
  const equipmentReady = status.equipmentReady >= status.equipmentTotal;
  const allReady = crewReady && equipmentReady;
  const checklistReady = (crewReady ? 1 : 0) + (equipmentReady ? 1 : 0);
  const checklistTotal = 2;

  const cellSx = {
    display: 'flex',
    flexDirection: 'column',
    gap: 0.25,
    minWidth: 0,
    flex: '1 1 0',
  } as const;
  const labelSx = {
    color: 'rgba(148,163,184,0.78)',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  };
  const valueSx = {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 700,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };
  const subSx = {
    color: 'rgba(203,213,225,0.62)',
    fontSize: 11,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 5,
        width: '100%',
        bgcolor: 'rgba(7,10,20,0.96)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        px: { xs: 1.5, md: 2.5 },
        py: 1.2,
        display: 'flex',
        gap: { xs: 1.5, md: 2.5 },
        alignItems: 'stretch',
        flexWrap: { xs: 'wrap', md: 'nowrap' },
      }}
    >
      {/* SET STATUS — klikkbar når onOpenDitDrawer er konfigurert */}
      <Box
        sx={{
          ...cellSx,
          cursor: onOpenDitDrawer ? 'pointer' : 'default',
          transition: 'background-color 0.15s',
          borderRadius: 1,
          mx: -0.5,
          px: 0.5,
          '&:hover': onOpenDitDrawer ? { bgcolor: 'rgba(34,211,238,0.06)' } : {},
        }}
        onClick={onOpenDitDrawer}
        title={onOpenDitDrawer ? 'Klikk for å åpne DIT-backup-panel' : undefined}
      >
        <Typography sx={labelSx}>Set status</Typography>
        <Typography sx={{ ...valueSx, color: allReady ? '#86efac' : '#fdba74' }}>
          {allReady ? 'Alt klart' : 'Forbereder'}
        </Typography>
        <Typography sx={subSx}>{checklistReady}/{checklistTotal} sjekklister · backup {backupCompleted}/4 {onOpenDitDrawer && '↗'}</Typography>
      </Box>

      {/* VÆR */}
      <Box sx={cellSx}>
        <Typography sx={labelSx}>Vær</Typography>
        <Typography sx={valueSx}>
          {typeof weatherLive?.temperature === 'number' ? `${Math.round(weatherLive.temperature)}°C` : '—'}
        </Typography>
        <Typography sx={subSx}>{weatherLive?.alerts?.[0] ?? weatherLive?.symbolCode ?? 'Yr.no'}</Typography>
      </Box>

      {/* BATTERIER (placeholder — wires til kamera-state senere) */}
      <Box sx={cellSx}>
        <Typography sx={labelSx}>Batterier</Typography>
        <Typography sx={valueSx}>—</Typography>
        <Typography sx={subSx}>Kobles til kamera-state</Typography>
      </Box>

      {/* LAGRING (placeholder) */}
      <Box sx={cellSx}>
        <Typography sx={labelSx}>Lagring</Typography>
        <Typography sx={valueSx}>—</Typography>
        <Typography sx={subSx}>Krever DIT-station</Typography>
      </Box>

      {/* SETUP-TIMER + WRAP-PROJEKSJON */}
      <Box sx={cellSx}>
        <Typography sx={labelSx}>Tempo</Typography>
        <Typography sx={valueSx}>
          Setup {setupTimerLabel}
        </Typography>
        <Typography sx={subSx}>ETA wrap {projectedWrapLabel}</Typography>
      </Box>

      {/* TID */}
      <Box sx={cellSx}>
        <Typography sx={labelSx}>Tid</Typography>
        <Typography sx={valueSx}>
          {now.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </Typography>
        <Typography sx={subSx}>{shootingDayLabel}</Typography>
      </Box>

      {/* CREW KOMMUNIKASJON */}
      <Box sx={cellSx}>
        <Typography sx={labelSx}>Crew kommunikasjon</Typography>
        <Typography sx={{ ...valueSx, color: unreadChatCount > 0 ? '#fbbf24' : '#f8fafc' }}>
          {unreadChatCount > 0 ? `${unreadChatCount} nye` : 'Ingen nye'}
        </Typography>
        <Typography sx={subSx}>Åpne chat</Typography>
      </Box>
    </Box>
  );
};

// ── Sub-component: SetupCompletePanel ────────────────────────────────────────

interface SetupCompletePanelProps {
  scene: LiveSetScene | null;
  takes: LiveSetTake[];
  onAdvance: () => void;
  onDismiss: () => void;
}

const SetupCompletePanel: FC<SetupCompletePanelProps> = ({ scene, takes, onAdvance, onDismiss }) => {
  const circled = takes.filter(t => t.status === 'circled').length;
  const printed = takes.filter(t => t.status === 'print').length;

  return (
    <Slide direction="up" in mountOnEnter unmountOnExit>
      <Paper
        sx={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1500, maxWidth: 480, width: '90%',
          bgcolor: '#0f1520', border: '2px solid #10b981',
          borderRadius: 2, p: 3, boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ fontSize: 32 }}>✔</Box>
          <Box>
            <Typography variant="h6" sx={{ color: '#10b981', fontWeight: 700 }}>Setup Complete</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Sc. {scene?.sceneNumber ?? '—'} · {takes.length} takes logget
            </Typography>
          </Box>
          <IconButton size="small" onClick={onDismiss} sx={{ ml: 'auto', color: 'rgba(255,255,255,0.4)' }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <Typography variant="h5" sx={{ color: '#ffb800', fontWeight: 800 }}>{circled}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Circled</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <Typography variant="h5" sx={{ color: '#94a3b8', fontWeight: 800 }}>{printed}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Print</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800 }}>{takes.length}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>Totalt</Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          fullWidth
          onClick={onAdvance}
          endIcon={<AdvanceIcon />}
          sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, fontWeight: 700, fontSize: 14 }}
        >
          Neste scene
        </Button>
      </Paper>
    </Slide>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export interface LiveSetModeProps {
  projectId: string;
  projectName?: string;
  shootingDay?: string; // ISO date
  initialScene?: LiveSetScene;
  onExit?: () => void;
}

function LiveSetModeInner({ projectId, projectName, shootingDay, initialScene, onExit }: LiveSetModeProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const touchUi = useMediaQuery('(pointer: coarse)');
  const isIpad = useMediaQuery('(min-width: 768px) and (max-width: 1366px)');
  const isIpadLandscape = useMediaQuery('(min-width: 1024px) and (max-width: 1366px) and (orientation: landscape)');
  const is2K = useMediaQuery('(min-width: 2048px)');
  const is4K = useMediaQuery('(min-width: 3840px)');
  const is5K = useMediaQuery('(min-width: 5120px)');

  const useStackedLayout = isMobile || (isIpad && !isIpadLandscape);
  const liveSetShellMaxWidth = is5K ? 4860 : is4K ? 3920 : is2K ? 2720 : '100%';
  const leftPanelWidth = is5K ? 460 : is4K ? 410 : is2K ? 350 : isIpadLandscape ? 320 : 280;
  const rightPanelWidth = is5K ? 560 : is4K ? 500 : is2K ? 420 : isIpadLandscape ? 380 : 340;
  const headerPaddingX = is5K ? 6 : is4K ? 5 : is2K ? 4 : 3;
  const [controlPanelDock, setControlPanelDock] = useState<'left' | 'right'>('right');

  // Mode-toggle: LIVE = opptak nå, EDIT = scene-assembly + draft, REVIEW =
  // sluttinspeksjon før wrap. Matcher Pro-mockup-headeren. Per nå er
  // LIVE den fullt-implementerte modusen; EDIT og REVIEW viser
  // placeholder-content til scene-assembly-fundamentet er bygget.
  const [liveSetMode, setLiveSetMode] = useState<'live' | 'edit' | 'review'>('live');
  // DIT-backup-drawer toggle
  const [ditDrawerOpen, setDitDrawerOpen] = useState(false);

  const {
    state, roll, cut, setupComplete, advanceScene,
    addNote, setNoteInput, setNoteTag, setTakeStatus, addFlag,
    deleteNote, focusTake, setActivityTab, setCamera, setScene, setSetup, setCam, captureTake,
  } = useLiveSet({
    initialScene,
    projectId,
    shootingDayId: shootingDay,
    operatorId: 'script-supervisor',
  });

  const noteInputRef = useRef<HTMLInputElement | null>(null);

  // Flash overlay state (CUT effect)
  const [flashVisible, setFlashVisible] = useState(false);

  const {
    contextError,
    sceneOptions,
    shotOptionsByScene,
    scriptByScene,
    storyboardsByScene,
    sceneShotListMap,
    crewRoster,
    equipmentRoster,
    sceneCoordinatesById,
  } = useLiveSetContext(projectId);
  const selectableSceneOptions = useMemo(
    () => sceneOptions.filter((scene) => Boolean(compactText(scene.id, scene.sceneId))),
    [sceneOptions],
  );
  const crewRosterTotal = crewRoster.length;
  const equipmentRosterTotal = equipmentRoster.length;
  const [crewDialogOpen, setCrewDialogOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [weatherDialogOpen, setWeatherDialogOpen] = useState(false);
  const [setStatus, setSetStatus] = useState<SetStatusState>(createDefaultSetStatus());

  const setStatusStorageKey = useMemo(
    () => `liveset:set-status:${projectId || 'global'}`,
    [projectId],
  );
  const controlPanelDockStorageKey = useMemo(
    () => `liveset:control-panel-dock:${projectId || 'global'}`,
    [projectId],
  );

  const activeSceneId = useMemo(
    () => compactText(state.currentScene?.id, state.currentScene?.sceneId) || '',
    [state.currentScene],
  );
  const activeShotOptions = useMemo(
    () => (activeSceneId ? shotOptionsByScene[activeSceneId] ?? [] : []),
    [activeSceneId, shotOptionsByScene],
  );
  const activeScriptContent = useMemo(
    () => (activeSceneId ? scriptByScene[activeSceneId] : undefined),
    [activeSceneId, scriptByScene],
  );
  const activeStoryboardFrames = useMemo(
    () => (activeSceneId ? storyboardsByScene[activeSceneId] ?? [] : []),
    [activeSceneId, storyboardsByScene],
  );
  const projectStoryboardFrames = useMemo(() => {
    const flattened: StoryboardTile[] = [];
    const seen = new Set<string>();
    Object.entries(storyboardsByScene).forEach(([sceneId, frames]) => {
      frames.forEach((frame, index) => {
        const imageUrl = compactText(frame.imageUrl);
        if (!imageUrl) return;
        const dedupeKey = `${sceneId}::${compactText(frame.id, `${sceneId}-${index + 1}`)}::${imageUrl.toLowerCase()}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        flattened.push({
          ...frame,
          sourceSceneId: frame.sourceSceneId || sceneId,
        });
      });
    });
    return flattened;
  }, [storyboardsByScene]);
  const sceneLabelById = useMemo(() => {
    const labelMap: Record<string, string> = {};
    selectableSceneOptions.forEach((scene) => {
      const sceneId = compactText(scene.id, scene.sceneId);
      if (!sceneId) return;
      const sceneLabel = compactText(scene.sceneNumber, scene.name, sceneId) || sceneId;
      const location = compactText(scene.location);
      labelMap[sceneId] = location ? `${sceneLabel} · ${location}` : sceneLabel;
    });
    return labelMap;
  }, [selectableSceneOptions]);
  const activeSceneLocation = useMemo(
    () => compactText(state.currentScene?.location, projectName, 'Oslo') || 'Oslo',
    [state.currentScene?.location, projectName],
  );
  const activeSceneCoordinates = useMemo(
    () => (activeSceneId ? sceneCoordinatesById[activeSceneId] : undefined),
    [activeSceneId, sceneCoordinatesById],
  );
  const handleWeatherRiskComputed = useCallback((computedRisk: LiveWeatherRiskLevel) => {
    setSetStatus((current) => (
      WEATHER_RISK_RANK[computedRisk] > WEATHER_RISK_RANK[current.weatherRisk]
        ? { ...current, weatherRisk: computedRisk }
        : current
    ));
  }, []);
  const {
    weather: weatherLive,
    weatherRisk: liveWeatherSeverity,
    refreshWeather,
  } = useLiveWeather({
    projectId,
    activeSceneLocation,
    activeSceneCoordinates,
    onRiskComputed: handleWeatherRiskComputed,
  });
  const crewPresentIdSet = useMemo(
    () => new Set(deriveSelectedIds(setStatus.crewPresentIds, crewRoster.map((entry) => entry.id), setStatus.crewPresent)),
    [setStatus.crewPresentIds, setStatus.crewPresent, crewRoster],
  );
  const equipmentReadyIdSet = useMemo(
    () => new Set(deriveSelectedIds(setStatus.equipmentReadyIds, equipmentRoster.map((entry) => entry.id), setStatus.equipmentReady)),
    [setStatus.equipmentReadyIds, setStatus.equipmentReady, equipmentRoster],
  );
  const globalMentionCandidates = useMemo(() => {
    const candidates = new Set<string>();
    crewRoster.forEach((entry) => {
      const name = compactText(entry.name);
      if (name) candidates.add(name);
    });
    state.takes.forEach((take) => {
      const loggedBy = compactText(take.loggedBy);
      if (loggedBy) candidates.add(loggedBy);
    });
    state.notes.forEach((note) => {
      const author = compactText(note.author);
      if (author) candidates.add(author);
    });
    return Array.from(candidates).sort((left, right) => left.localeCompare(right, 'no-NO'));
  }, [crewRoster, state.notes, state.takes]);
  const yrSearchUrl = useMemo(
    () => `https://www.yr.no/nb/s%C3%B8k?q=${encodeURIComponent(weatherLive.locationLabel || activeSceneLocation)}`,
    [weatherLive.locationLabel, activeSceneLocation],
  );
  const weatherVisual = useMemo(
    () => deriveWeatherVisual(weatherLive, liveWeatherSeverity),
    [weatherLive, liveWeatherSeverity],
  );
  const controlOnRight = !useStackedLayout && controlPanelDock === 'right';

  const {
    shotListSync,
    takeCapture,
    handleTakeCaptureChange,
    handleToggleContinuityFlag,
    handleCaptureTake,
    setShotListSync,
  } = useShotListSync({
    projectId,
    activeSceneId,
    activeShotOptions,
    sceneShotListMap,
    cameraMetadata: state.cameraMetadata,
    activeCam: state.activeCam,
    activeSetup: state.activeSetup,
    takes: state.takes,
    captureTake,
    resolveQualityLabel: (quality) => TAKE_STATUS_META[quality]?.label || quality,
  });

  useEffect(() => {
    if (selectableSceneOptions.length === 0) return;
    const hasActiveScene = activeSceneId
      ? selectableSceneOptions.some((scene) => compactText(scene.id, scene.sceneId) === activeSceneId)
      : false;
    if (hasActiveScene) return;

    const fallbackScene = selectableSceneOptions[0];
    const fallbackSceneId = compactText(fallbackScene.id, fallbackScene.sceneId);
    if (!fallbackSceneId || fallbackSceneId === activeSceneId) return;
    setScene(fallbackScene);
  }, [selectableSceneOptions, activeSceneId, setScene]);

  useEffect(() => {
    const raw = localStorage.getItem(setStatusStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<SetStatusState>;
      setSetStatus((current) => ({
        ...current,
        ...parsed,
      }));
    } catch {
      // ignore malformed local status payload
    }
  }, [setStatusStorageKey]);

  useEffect(() => {
    const raw = localStorage.getItem(controlPanelDockStorageKey);
    if (raw === 'left' || raw === 'right') {
      setControlPanelDock(raw);
    }
  }, [controlPanelDockStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(setStatusStorageKey, JSON.stringify(setStatus));
    } catch {
      // ignore persistence errors
    }
  }, [setStatusStorageKey, setStatus]);

  useEffect(() => {
    try {
      localStorage.setItem(controlPanelDockStorageKey, controlPanelDock);
    } catch {
      // ignore persistence errors
    }
  }, [controlPanelDockStorageKey, controlPanelDock]);

  useEffect(() => {
    setSetStatus((current) => {
      const crewRosterIds = uniqueStringIds(crewRoster.map((entry) => entry.id))
        .sort((left, right) => left.localeCompare(right, 'nb-NO'));
      const equipmentRosterIds = uniqueStringIds(equipmentRoster.map((entry) => entry.id))
        .sort((left, right) => left.localeCompare(right, 'nb-NO'));
      const crewTotal = crewRosterIds.length || crewRosterTotal || current.crewTotal;
      const equipmentTotal = equipmentRosterIds.length || equipmentRosterTotal || current.equipmentTotal;
      const crewPresentIds = crewRosterIds.length
        ? deriveSelectedIds(current.crewPresentIds, crewRosterIds, current.crewPresent)
        : uniqueStringIds(Array.isArray(current.crewPresentIds) ? current.crewPresentIds : []);
      const equipmentReadyIds = equipmentRosterIds.length
        ? deriveSelectedIds(current.equipmentReadyIds, equipmentRosterIds, current.equipmentReady)
        : uniqueStringIds(Array.isArray(current.equipmentReadyIds) ? current.equipmentReadyIds : []);
      const crewPresent = crewRosterIds.length ? crewPresentIds.length : Math.min(current.crewPresent, crewTotal);
      const equipmentReady = equipmentRosterIds.length ? equipmentReadyIds.length : Math.min(current.equipmentReady, equipmentTotal);
      const unchanged =
        current.crewTotal === crewTotal &&
        current.equipmentTotal === equipmentTotal &&
        current.crewPresent === crewPresent &&
        current.equipmentReady === equipmentReady &&
        sameStringArray(current.crewPresentIds, crewPresentIds) &&
        sameStringArray(current.equipmentReadyIds, equipmentReadyIds);
      if (unchanged) return current;
      return {
        ...current,
        crewTotal,
        equipmentTotal,
        crewPresent,
        equipmentReady,
        crewPresentIds,
        equipmentReadyIds,
      };
    });
  }, [crewRoster, equipmentRoster, crewRosterTotal, equipmentRosterTotal]);

  const handleSetPhase = useCallback((phase: SetStatusState['phase']) => {
    setSetStatus((current) => ({ ...current, phase }));
  }, []);

  const handleSelectScene = useCallback((sceneId: string) => {
    if (!sceneId || sceneId === activeSceneId) return;
    const match = selectableSceneOptions.find((scene) => compactText(scene.id, scene.sceneId) === sceneId);
    if (!match) return;
    setScene(match);
    setShotListSync({ status: 'idle' });
  }, [activeSceneId, selectableSceneOptions, setScene, setShotListSync]);

  const handleOpenCrewDialog = useCallback(() => setCrewDialogOpen(true), []);
  const handleCloseCrewDialog = useCallback(() => setCrewDialogOpen(false), []);
  const handleOpenEquipmentDialog = useCallback(() => setEquipmentDialogOpen(true), []);
  const handleCloseEquipmentDialog = useCallback(() => setEquipmentDialogOpen(false), []);
  const handleOpenWeatherDialog = useCallback(() => setWeatherDialogOpen(true), []);
  const handleCloseWeatherDialog = useCallback(() => setWeatherDialogOpen(false), []);

  const handleAdjustCrew = useCallback((delta: number) => {
    setSetStatus((current) => {
      const rosterIds = uniqueStringIds(crewRoster.map((entry) => entry.id))
        .sort((left, right) => left.localeCompare(right, 'nb-NO'));
      const total = Math.max(current.crewTotal, rosterIds.length, 0);
      if (rosterIds.length > 0) {
        const selectedIds = deriveSelectedIds(current.crewPresentIds, rosterIds, current.crewPresent);
        let nextSelected = [...selectedIds];
        if (delta > 0) {
          const missing = rosterIds.filter((id) => !nextSelected.includes(id));
          nextSelected = uniqueStringIds([...nextSelected, ...missing.slice(0, delta)]);
        } else if (delta < 0) {
          nextSelected = nextSelected.slice(0, Math.max(0, nextSelected.length + delta));
        }
        return { ...current, crewTotal: total, crewPresent: nextSelected.length, crewPresentIds: nextSelected };
      }
      const next = Math.max(0, Math.min(total, current.crewPresent + delta));
      return { ...current, crewTotal: total, crewPresent: next };
    });
  }, [crewRoster]);

  const handleAdjustEquipment = useCallback((delta: number) => {
    setSetStatus((current) => {
      const rosterIds = uniqueStringIds(equipmentRoster.map((entry) => entry.id))
        .sort((left, right) => left.localeCompare(right, 'nb-NO'));
      const total = Math.max(current.equipmentTotal, rosterIds.length, 0);
      if (rosterIds.length > 0) {
        const selectedIds = deriveSelectedIds(current.equipmentReadyIds, rosterIds, current.equipmentReady);
        let nextSelected = [...selectedIds];
        if (delta > 0) {
          const missing = rosterIds.filter((id) => !nextSelected.includes(id));
          nextSelected = uniqueStringIds([...nextSelected, ...missing.slice(0, delta)]);
        } else if (delta < 0) {
          nextSelected = nextSelected.slice(0, Math.max(0, nextSelected.length + delta));
        }
        return { ...current, equipmentTotal: total, equipmentReady: nextSelected.length, equipmentReadyIds: nextSelected };
      }
      const next = Math.max(0, Math.min(total, current.equipmentReady + delta));
      return { ...current, equipmentTotal: total, equipmentReady: next };
    });
  }, [equipmentRoster]);

  const handleToggleCrewPresence = useCallback((crewId: string) => {
    setSetStatus((current) => {
      const rosterIds = uniqueStringIds(crewRoster.map((entry) => entry.id))
        .sort((left, right) => left.localeCompare(right, 'nb-NO'));
      if (!rosterIds.includes(crewId)) return current;
      const selectedIds = deriveSelectedIds(current.crewPresentIds, rosterIds, current.crewPresent);
      const nextSelected = selectedIds.includes(crewId)
        ? selectedIds.filter((id) => id !== crewId)
        : uniqueStringIds([...selectedIds, crewId]);
      return {
        ...current,
        crewTotal: Math.max(current.crewTotal, rosterIds.length),
        crewPresent: nextSelected.length,
        crewPresentIds: nextSelected,
      };
    });
  }, [crewRoster]);

  const handleToggleEquipmentReady = useCallback((equipmentId: string) => {
    setSetStatus((current) => {
      const rosterIds = uniqueStringIds(equipmentRoster.map((entry) => entry.id))
        .sort((left, right) => left.localeCompare(right, 'nb-NO'));
      if (!rosterIds.includes(equipmentId)) return current;
      const selectedIds = deriveSelectedIds(current.equipmentReadyIds, rosterIds, current.equipmentReady);
      const nextSelected = selectedIds.includes(equipmentId)
        ? selectedIds.filter((id) => id !== equipmentId)
        : uniqueStringIds([...selectedIds, equipmentId]);
      return {
        ...current,
        equipmentTotal: Math.max(current.equipmentTotal, rosterIds.length),
        equipmentReady: nextSelected.length,
        equipmentReadyIds: nextSelected,
      };
    });
  }, [equipmentRoster]);

  const handleSelectAllCrewPresence = useCallback(() => {
    const allIds = crewRoster.map((entry) => entry.id);
    setSetStatus((current) => ({
      ...current,
      crewTotal: Math.max(current.crewTotal, allIds.length),
      crewPresent: allIds.length,
      crewPresentIds: allIds,
    }));
  }, [crewRoster]);

  const handleClearCrewPresence = useCallback(() => {
    setSetStatus((current) => ({
      ...current,
      crewPresent: 0,
      crewPresentIds: [],
    }));
  }, []);

  const handleSelectAllEquipmentReady = useCallback(() => {
    const allIds = equipmentRoster.map((entry) => entry.id);
    setSetStatus((current) => ({
      ...current,
      equipmentTotal: Math.max(current.equipmentTotal, allIds.length),
      equipmentReady: allIds.length,
      equipmentReadyIds: allIds,
    }));
  }, [equipmentRoster]);

  const handleClearEquipmentReady = useCallback(() => {
    setSetStatus((current) => ({
      ...current,
      equipmentReady: 0,
      equipmentReadyIds: [],
    }));
  }, []);

  const handleManualWeatherRefresh = useCallback(() => {
    void refreshWeather();
  }, [refreshWeather]);

  // ── Live timer ──
  const [timerSeconds, setTimerSeconds] = useState(0);
  useEffect(() => {
    if (state.liveState !== 'rolling' || !state.timerStartedAt) {
      setTimerSeconds(0);
      return;
    }
    setTimerSeconds(Math.floor((Date.now() - state.timerStartedAt) / 1000));
    const id = setInterval(() => {
      setTimerSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [state.liveState, state.timerStartedAt]);

  // CUT flash effect
  const handleCut = useCallback(() => {
    cut();
    setFlashVisible(true);
    setTimeout(() => setFlashVisible(false), 400);
  }, [cut]);

  // ── Keyboard shortcuts ──
  const activeTabRef = useRef(state.activityTab);
  activeTabRef.current = state.activityTab;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (isInput) { (e.target as HTMLElement).blur(); return; }
        if (state.liveState === 'setup-complete') { advanceScene(); return; }
        onExit?.();
        return;
      }

      if (isInput) return; // Don't intercept when typing

      switch (e.key.toUpperCase()) {
        case 'R':
          if (state.liveState !== 'rolling') roll();
          break;
        case 'C':
          if (state.liveState === 'rolling') handleCut();
          break;
        case 'N':
          setActivityTab('notes');
          setTimeout(() => noteInputRef.current?.focus(), 100);
          break;
        case 'ARROWDOWN':
          e.preventDefault();
          focusTake(state.focusedTakeIndex + 1);
          break;
        case 'ARROWUP':
          e.preventDefault();
          focusTake(state.focusedTakeIndex - 1);
          break;
        case 'ENTER':
          if (state.liveState === 'cut' && state.takes.length > 0) {
            setTakeStatus(state.takes[0].id, 'circled');
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [state.liveState, state.focusedTakeIndex, state.takes, roll, handleCut, advanceScene, focusTake, setActivityTab, setTakeStatus, onExit]);

  const parsedShootingDay = shootingDay ? new Date(shootingDay) : null;
  const formattedDay = parsedShootingDay && !Number.isNaN(parsedShootingDay.getTime())
    ? parsedShootingDay.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
    : shootingDay || 'Innspillingsdag';

  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column',
        width: '100%', height: '100%', minHeight: '100%',
        bgcolor: '#08080f', position: 'relative', overflow: 'hidden',
      }}
    >
      {/* ── CUT flash overlay ── */}
      {flashVisible && (
        <Box
          sx={{
            position: 'fixed', inset: 0, zIndex: 9999,
            bgcolor: 'rgba(255,255,255,0.18)',
            animation: `${flashFade} 0.4s ease-out forwards`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 },
          px: { xs: 1.5, sm: headerPaddingX }, py: is5K ? 2 : is4K ? 1.6 : 1.25,
          bgcolor: 'rgba(0,0,0,0.6)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
          flexShrink: 0,
          flexWrap: 'wrap',
          width: '100%',
          maxWidth: liveSetShellMaxWidth,
          mx: 'auto',
          ...(touchUi ? {
            '& .MuiIconButton-root': { minWidth: 40, minHeight: 40 },
            '& .MuiChip-root': { minHeight: 30 },
            '& .MuiButton-root': { minHeight: 42 },
            '& .MuiMenuItem-root': { minHeight: 44 },
          } : {}),
        }}
      >
        {/* Red dot indicator */}
        <Box
          sx={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            bgcolor: state.liveState === 'rolling' ? '#ef4444' : 'rgba(255,255,255,0.2)',
            boxShadow: state.liveState === 'rolling' ? '0 0 8px #ef4444' : 'none',
            animation: state.liveState === 'rolling' ? `${rollPulse} 1.6s ease-out infinite` : 'none',
          }}
        />

        {/* Project breadcrumb */}
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          {projectName ?? 'Produksjon'}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>/</Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textTransform: 'capitalize' }}>
          {formattedDay}
        </Typography>
        {state.currentScene && (
          <>
            <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>/</Typography>
            <Typography variant="body2" sx={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
              Scene {state.currentScene.sceneNumber}
            </Typography>
          </>
        )}

        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* LIVE / EDIT / REVIEW mode-toggle — matcher Pro-mockupen */}
          <Box
            sx={{
              display: 'flex',
              bgcolor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '999px',
              p: 0.3,
              gap: 0.3,
              mr: 0.5,
            }}
          >
            {(['live', 'edit', 'review'] as const).map((m) => {
              const isActive = liveSetMode === m;
              const accentColor = m === 'live' ? '#ef4444' : m === 'edit' ? '#a78bfa' : '#22d3ee';
              return (
                <Box
                  key={m}
                  component="button"
                  onClick={() => setLiveSetMode(m)}
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    minHeight: 28,
                    border: 'none',
                    borderRadius: '999px',
                    cursor: 'pointer',
                    bgcolor: isActive ? `${accentColor}22` : 'transparent',
                    color: isActive ? accentColor : 'rgba(255,255,255,0.55)',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontFamily: 'inherit',
                    transition: 'background-color 0.15s, color 0.15s',
                    '&:hover': {
                      bgcolor: isActive ? `${accentColor}33` : 'rgba(255,255,255,0.04)',
                      color: isActive ? accentColor : 'rgba(255,255,255,0.85)',
                    },
                  }}
                >
                  {m === 'live' && '● '}{m === 'edit' && '✎ '}{m === 'review' && '👁 '}{m}
                </Box>
              );
            })}
          </Box>

          {/* Live state badge */}
          <Chip
            label={
              state.liveState === 'rolling' ? '● ROLLING' :
              state.liveState === 'cut' ? '⎋ CUT' :
              state.liveState === 'setup-complete' ? '✔ SETUP COMPLETE' :
              '● STANDBY'
            }
            size="small"
            sx={{
              bgcolor:
                state.liveState === 'rolling' ? 'rgba(239,68,68,0.25)' :
                state.liveState === 'setup-complete' ? 'rgba(16,185,129,0.2)' :
                'rgba(255,255,255,0.06)',
              color:
                state.liveState === 'rolling' ? '#ef4444' :
                state.liveState === 'setup-complete' ? '#10b981' :
                'rgba(255,255,255,0.5)',
              border: '1px solid',
              borderColor:
                state.liveState === 'rolling' ? '#ef444444' :
                state.liveState === 'setup-complete' ? '#10b98144' :
                'rgba(255,255,255,0.1)',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.06em',
            }}
          />

          {/* Offline / sync indicators */}
          {state.isOffline ? (
            <Tooltip title="Offline – data lagres lokalt">
              <Chip
                icon={<OfflineIcon sx={{ fontSize: '14px !important' }} />}
                label="Offline"
                size="small"
                sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: 10 }}
              />
            </Tooltip>
          ) : state.pendingSyncCount > 0 ? (
            <Tooltip title={`Synkroniserer ${state.pendingSyncCount} endringer…`}>
              <Chip
                icon={<SyncIcon sx={{ fontSize: '14px !important', animation: 'spin 1.2s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />}
                label={`Syncer (${state.pendingSyncCount})`}
                size="small"
                sx={{ bgcolor: 'rgba(255,184,0,0.12)', color: '#ffb800', border: '1px solid rgba(255,184,0,0.3)', fontSize: 10 }}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Alt synkronisert">
              <SyncedIcon sx={{ fontSize: 16, color: 'rgba(16,185,129,0.6)' }} />
            </Tooltip>
          )}

          {/* Keyboard hint */}
          {!useStackedLayout && (
            <Tooltip title={controlPanelDock === 'right' ? 'Flytt ROLL-panel til venstre' : 'Flytt ROLL-panel til høyre'}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<LayoutSwapIcon sx={{ fontSize: 16 }} />}
                onClick={() => setControlPanelDock((current) => (current === 'right' ? 'left' : 'right'))}
                sx={{
                  borderColor: 'rgba(148,163,184,0.35)',
                  color: 'rgba(226,232,240,0.9)',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 11,
                  minHeight: 30,
                  '&:hover': {
                    borderColor: 'rgba(148,163,184,0.55)',
                    bgcolor: 'rgba(148,163,184,0.12)',
                  },
                }}
              >
                {controlPanelDock === 'right' ? 'ROLL høyre' : 'ROLL venstre'}
              </Button>
            </Tooltip>
          )}
          {!isMobile && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>
              R · C · N · ↑↓
            </Typography>
          )}

        </Box>
      </Box>

      {/* Mode-banner for EDIT/REVIEW (LIVE viser ingenting). Bare et
          visuelt signal til admin om at de er i en alternativ modus —
          full content kommer i v2 etter scene-assembly er bygget. */}
      {liveSetMode !== 'live' ? (
        <Box
          sx={{
            width: '100%',
            maxWidth: liveSetShellMaxWidth,
            mx: 'auto',
            px: { xs: 1.5, sm: 2.5 },
            py: 1.2,
            bgcolor: liveSetMode === 'edit' ? 'rgba(167,139,250,0.08)' : 'rgba(34,211,238,0.08)',
            borderBottom: '1px solid',
            borderColor: liveSetMode === 'edit' ? 'rgba(167,139,250,0.24)' : 'rgba(34,211,238,0.24)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              fontSize: 18,
              color: liveSetMode === 'edit' ? '#a78bfa' : '#22d3ee',
            }}
          >
            {liveSetMode === 'edit' ? '✎' : '👁'}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: 13 }}>
              {liveSetMode === 'edit' ? 'EDIT-modus' : 'REVIEW-modus'}
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: 11.5 }}>
              {liveSetMode === 'edit'
                ? 'Scene-assembly + draft-timeline + NLE-eksport kommer i v2. Bytt tilbake til LIVE for opptaks-modus.'
                : 'Sluttinspeksjon av dagens opptak + wrap-godkjenning kommer i v2.'}
            </Typography>
          </Box>
          <Box
            component="button"
            onClick={() => setLiveSetMode('live')}
            sx={{
              border: '1px solid rgba(239,68,68,0.32)',
              borderRadius: 1,
              px: 1.2,
              py: 0.6,
              bgcolor: 'rgba(239,68,68,0.10)',
              color: '#fca5a5',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              '&:hover': { bgcolor: 'rgba(239,68,68,0.18)' },
            }}
          >
            ← Tilbake til LIVE
          </Box>
        </Box>
      ) : null}

      <Box sx={{ width: '100%', maxWidth: liveSetShellMaxWidth, mx: 'auto' }}>
        <LiveSetStatusBar
          activeSceneId={activeSceneId}
          sceneOptions={selectableSceneOptions}
          status={setStatus}
          shotListSync={shotListSync}
          weatherLive={weatherLive}
          onSelectScene={handleSelectScene}
          onSetPhase={handleSetPhase}
          onAdjustCrew={handleAdjustCrew}
          onAdjustEquipment={handleAdjustEquipment}
          onOpenCrewDialog={handleOpenCrewDialog}
          onOpenEquipmentDialog={handleOpenEquipmentDialog}
          onOpenWeatherDialog={handleOpenWeatherDialog}
        />
      </Box>

      {contextError ? (
        <Box
          sx={{
            px: { xs: 1.5, sm: headerPaddingX - 1 },
            py: 1,
            bgcolor: 'rgba(239,68,68,0.12)',
            borderBottom: '1px solid rgba(239,68,68,0.25)',
            width: '100%',
            maxWidth: liveSetShellMaxWidth,
            mx: 'auto',
          }}
        >
          <Typography variant="caption" sx={{ color: '#fca5a5' }}>
            Live Set-kontekst kunne ikke lastes fullt ut: {contextError}
          </Typography>
        </Box>
      ) : null}

      {/* ══ 3-ZONE LAYOUT ═══════════════════════════════════════════════════ */}
      <Box
        sx={{
          flex: 1, display: 'flex',
          flexDirection: useStackedLayout ? 'column' : 'row',
          overflow: 'hidden', minHeight: 0,
          width: '100%',
          maxWidth: liveSetShellMaxWidth,
          mx: 'auto',
        }}
      >
        {controlOnRight ? (
          <Box
            sx={{
              width: rightPanelWidth,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRight: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <LiveSetActivityPanel
              takes={state.takes}
              notes={state.notes}
              touchUi={touchUi}
              globalMentionCandidates={globalMentionCandidates}
              activeTab={state.activityTab}
              focusedTakeIndex={state.focusedTakeIndex}
              noteInput={state.noteInput}
              noteTag={state.noteTag}
              noteInputRef={noteInputRef}
              backupStatus={{
                original: setStatus.backupOriginal,
                primary: setStatus.backupPrimary,
                secondary: setStatus.backupSecondary,
                offsite: setStatus.backupOffsite,
              }}
              onTabChange={setActivityTab}
              onFocusTake={focusTake}
              onStatusChange={setTakeStatus}
              onNoteInput={setNoteInput}
              onNoteTag={setNoteTag}
              onAddNote={addNote}
              onDeleteNote={deleteNote}
            />
          </Box>
        ) : (
          <Box
            sx={{
              width: useStackedLayout ? '100%' : leftPanelWidth,
              flexShrink: 0,
              overflowY: 'auto',
              borderBottom: useStackedLayout ? '1px solid rgba(255,255,255,0.07)' : 'none',
            }}
          >
            <LiveSetControlPanel
              liveState={state.liveState}
              timerSeconds={timerSeconds}
              scene={state.currentScene}
              cameraMetadata={state.cameraMetadata}
              takes={state.takes}
              takeCount={state.takes.filter(t => t.setupLabel === state.activeSetup).length}
              activeSetup={state.activeSetup}
              activeCam={state.activeCam}
              touchUi={touchUi}
              onRoll={roll}
              onCut={handleCut}
              onSetupComplete={setupComplete}
              onAddFlag={addFlag}
              onSetSetup={setSetup}
              onSetCam={setCam}
              onSetCamera={setCamera}
              noteInputRef={noteInputRef}
              dockSide="left"
            />
          </Box>
        )}

        {/* ── CENTER: Context Zone ── */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            minWidth: 0,
            borderRight: useStackedLayout ? 'none' : '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <LiveSetContextPanel
            scene={state.currentScene}
            cameraMetadata={state.cameraMetadata}
            touchUi={touchUi}
            mentionCandidates={globalMentionCandidates}
            shotOptions={activeShotOptions}
            takeCapture={takeCapture}
            shotListSync={shotListSync}
            scriptContent={activeScriptContent}
            storyboardFrames={activeStoryboardFrames}
            projectStoryboardFrames={projectStoryboardFrames}
            sceneLabelById={sceneLabelById}
            onCaptureChange={handleTakeCaptureChange}
            onToggleContinuityFlag={handleToggleContinuityFlag}
            onCaptureTake={handleCaptureTake}
          />
        </Box>

        {controlOnRight ? (
          <Box
            sx={{
              width: leftPanelWidth,
              flexShrink: 0,
              overflowY: 'auto',
              borderTop: useStackedLayout ? '1px solid rgba(255,255,255,0.07)' : 'none',
            }}
          >
            <LiveSetControlPanel
              liveState={state.liveState}
              timerSeconds={timerSeconds}
              scene={state.currentScene}
              cameraMetadata={state.cameraMetadata}
              takes={state.takes}
              takeCount={state.takes.filter(t => t.setupLabel === state.activeSetup).length}
              activeSetup={state.activeSetup}
              activeCam={state.activeCam}
              touchUi={touchUi}
              onRoll={roll}
              onCut={handleCut}
              onSetupComplete={setupComplete}
              onAddFlag={addFlag}
              onSetSetup={setSetup}
              onSetCam={setCam}
              onSetCamera={setCamera}
              noteInputRef={noteInputRef}
              dockSide="right"
            />
          </Box>
        ) : (
          <Box
            sx={{
              width: useStackedLayout ? '100%' : rightPanelWidth,
              flexShrink: 0,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              borderTop: useStackedLayout ? '1px solid rgba(255,255,255,0.07)' : 'none',
            }}
          >
            <LiveSetActivityPanel
              takes={state.takes}
              notes={state.notes}
              touchUi={touchUi}
              globalMentionCandidates={globalMentionCandidates}
              activeTab={state.activityTab}
              focusedTakeIndex={state.focusedTakeIndex}
              noteInput={state.noteInput}
              noteTag={state.noteTag}
              noteInputRef={noteInputRef}
              backupStatus={{
                original: setStatus.backupOriginal,
                primary: setStatus.backupPrimary,
                secondary: setStatus.backupSecondary,
                offsite: setStatus.backupOffsite,
              }}
              onTabChange={setActivityTab}
              onFocusTake={focusTake}
              onStatusChange={setTakeStatus}
              onNoteInput={setNoteInput}
              onNoteTag={setNoteTag}
              onAddNote={addNote}
              onDeleteNote={deleteNote}
            />
          </Box>
        )}
      </Box>

      {/* ══ FOOTER STATUS BAR ════════════════════════════════════════════════ */}
      <Box sx={{ width: '100%', maxWidth: liveSetShellMaxWidth, mx: 'auto' }}>
        <LiveSetFooterBar
          status={setStatus}
          weatherLive={weatherLive}
          shootingDay={shootingDay}
          takesCompletedToday={state.takes.filter((t) => t.status === 'circled' || t.status === 'print' || t.status === 'selected').length}
          onOpenDitDrawer={() => setDitDrawerOpen(true)}
        />
      </Box>

      <Dialog
        open={weatherDialogOpen}
        onClose={handleCloseWeatherDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: 'rgba(4,10,21,0.98)',
            border: '1px solid rgba(56,189,248,0.42)',
            boxShadow: '0 28px 72px rgba(2,6,23,0.72)',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle
          sx={{
            borderBottom: '1px solid rgba(56,189,248,0.2)',
            background: weatherVisual.headerGradient,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(15,23,42,0.55)',
                border: `1px solid ${weatherVisual.iconGlow}`,
                boxShadow: `0 0 14px ${weatherVisual.iconGlow}`,
                flexShrink: 0,
              }}
            >
              <weatherVisual.Icon
                sx={{
                  color: weatherVisual.iconColor,
                  fontSize: 18,
                  animation: weatherVisual.iconAnimation,
                  filter: `drop-shadow(0 0 5px ${weatherVisual.iconGlow})`,
                }}
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ color: '#bae6fd', fontWeight: 800, lineHeight: 1.2 }}>
                Yr værvarsling
              </Typography>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.15 }}>
                <Typography variant="caption" sx={{ color: 'rgba(186,230,253,0.75)' }}>
                  {weatherLive.locationLabel || activeSceneLocation}
                </Typography>
                <Chip
                  label={weatherVisual.moodLabel}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: 10,
                    color: weatherVisual.iconColor,
                    border: `1px solid ${weatherVisual.iconGlow}`,
                    bgcolor: 'rgba(15,23,42,0.45)',
                  }}
                />
              </Stack>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'rgba(56,189,248,0.2)', p: 2 }}>
          <Stack sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Paper
              sx={{
                p: 1.4,
                border: `1px solid ${weatherVisual.iconGlow}`,
                background: weatherVisual.cardGradient,
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.25}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(186,230,253,0.75)', letterSpacing: '0.06em' }}>
                    NÅVÆRENDE FORHOLD
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#e0f2fe', fontWeight: 900, lineHeight: 1.15 }}>
                    {weatherLive.temperature ?? '—'}°C
                  </Typography>
                </Box>
                <weatherVisual.Icon
                  sx={{
                    color: weatherVisual.iconColor,
                    fontSize: 28,
                    animation: weatherVisual.iconAnimation,
                    filter: `drop-shadow(0 0 8px ${weatherVisual.iconGlow})`,
                  }}
                />
                <Chip
                  label={liveWeatherSeverity === 'Høy' ? 'Høy risiko' : liveWeatherSeverity === 'Moderat' ? 'Moderat risiko' : 'Lav risiko'}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    color: liveWeatherSeverity === 'Høy' ? '#fecaca' : liveWeatherSeverity === 'Moderat' ? '#fde68a' : '#bbf7d0',
                    bgcolor: liveWeatherSeverity === 'Høy' ? 'rgba(127,29,29,0.5)' : liveWeatherSeverity === 'Moderat' ? 'rgba(120,53,15,0.45)' : 'rgba(6,95,70,0.45)',
                    border: `1px solid ${liveWeatherSeverity === 'Høy' ? 'rgba(248,113,113,0.6)' : liveWeatherSeverity === 'Moderat' ? 'rgba(251,191,36,0.6)' : 'rgba(52,211,153,0.6)'}`,
                  }}
                />
              </Stack>
            </Paper>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.9}>
              <Paper sx={{ flex: 1, p: 1, border: '1px solid rgba(56,189,248,0.24)', bgcolor: 'rgba(2,132,199,0.14)' }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <RainIcon sx={{ fontSize: 18, color: '#7dd3fc' }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(186,230,253,0.7)' }}>Nedbør</Typography>
                    <Typography variant="body2" sx={{ color: '#e0f2fe', fontWeight: 700 }}>{weatherLive.precipitation ?? 0} mm</Typography>
                  </Box>
                </Stack>
              </Paper>
              <Paper sx={{ flex: 1, p: 1, border: '1px solid rgba(56,189,248,0.24)', bgcolor: 'rgba(2,132,199,0.14)' }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <WindIcon sx={{ fontSize: 18, color: '#7dd3fc' }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(186,230,253,0.7)' }}>Vind</Typography>
                    <Typography variant="body2" sx={{ color: '#e0f2fe', fontWeight: 700 }}>{weatherLive.windSpeed ?? 0} m/s</Typography>
                  </Box>
                </Stack>
              </Paper>
              <Paper sx={{ flex: 1, p: 1, border: '1px solid rgba(56,189,248,0.24)', bgcolor: 'rgba(2,132,199,0.14)' }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <TempIcon sx={{ fontSize: 18, color: '#7dd3fc' }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(186,230,253,0.7)' }}>Status</Typography>
                    <Typography variant="body2" sx={{ color: '#e0f2fe', fontWeight: 700 }}>
                      {weatherLive.status === 'error' ? 'Feil' : weatherLive.status === 'loading' ? 'Oppdaterer' : 'Live'}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Stack>

            <Stack direction="row" spacing={0.65} alignItems="center">
              <TimeIcon sx={{ fontSize: 15, color: 'rgba(186,230,253,0.72)' }} />
              <Typography variant="caption" sx={{ color: 'rgba(186,230,253,0.72)' }}>
                Sist oppdatert: {weatherLive.updatedAt ? new Date(weatherLive.updatedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </Typography>
            </Stack>

            {weatherLive.error ? (
              <Paper sx={{ p: 1, border: '1px solid rgba(248,113,113,0.45)', bgcolor: 'rgba(127,29,29,0.3)' }}>
                <Typography variant="body2" sx={{ color: '#fecaca' }}>
                  {weatherLive.error}
                </Typography>
              </Paper>
            ) : null}

            <Divider sx={{ borderColor: 'rgba(56,189,248,0.18)' }} />
            <Typography variant="subtitle2" sx={{ color: '#bae6fd', fontWeight: 800, letterSpacing: '0.04em' }}>
              Varsler fra Yr
            </Typography>
            {weatherLive.alerts.length === 0 ? (
              <Paper sx={{ p: 1.1, border: '1px solid rgba(52,211,153,0.35)', bgcolor: 'rgba(6,95,70,0.25)' }}>
                <Typography variant="body2" sx={{ color: '#bbf7d0' }}>
                  Ingen aktive varsler akkurat nå.
                </Typography>
              </Paper>
            ) : (
              <Stack sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {weatherLive.alerts.map((alert, index) => (
                  <Paper
                    key={`${alert}-${index}`}
                    sx={{
                      p: 1.1,
                      border: '1px solid rgba(248,113,113,0.45)',
                      bgcolor: 'rgba(127,29,29,0.3)',
                    }}
                  >
                    <Stack direction="row" spacing={0.65} alignItems="flex-start">
                      <ActionSafeIcon sx={{ fontSize: 16, color: '#fca5a5', mt: 0.1 }} />
                      <Typography variant="body2" sx={{ color: '#fecaca' }}>
                        {alert}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.25, borderTop: '1px solid rgba(56,189,248,0.2)' }}>
          <Button size="small" onClick={handleManualWeatherRefresh} sx={{ color: '#7dd3fc' }}>
            Oppdater nå
          </Button>
          <Button
            size="small"
            component="a"
            href={yrSearchUrl}
            target="_blank"
            rel="noreferrer"
            endIcon={<ExternalLinkIcon sx={{ fontSize: 14 }} />}
            sx={{ color: '#bae6fd' }}
          >
            Åpne Yr.no
          </Button>
          <Button size="small" variant="contained" onClick={handleCloseWeatherDialog} sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={crewDialogOpen}
        onClose={handleCloseCrewDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: 'rgba(8,12,24,0.98)',
            border: '1px solid rgba(59,130,246,0.35)',
            boxShadow: '0 24px 56px rgba(2,6,23,0.6)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#bfdbfe', borderBottom: '1px solid rgba(59,130,246,0.25)' }}>
          Crew til stede ({setStatus.crewPresent}/{setStatus.crewTotal || crewRoster.length || 0})
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'rgba(59,130,246,0.25)', p: 2 }}>
          {crewRoster.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'rgba(191,219,254,0.72)' }}>
              Ingen crew registrert i prosjektet ennå.
            </Typography>
          ) : (
            <Stack sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {crewRoster.map((member) => {
                const checked = crewPresentIdSet.has(member.id);
                return (
                  <ButtonBase
                    key={member.id}
                    onClick={() => handleToggleCrewPresence(member.id)}
                    sx={{
                      width: '100%',
                      borderRadius: 1.5,
                      border: `1px solid ${checked ? 'rgba(96,165,250,0.45)' : 'rgba(59,130,246,0.2)'}`,
                      bgcolor: checked ? 'rgba(30,64,175,0.24)' : 'rgba(15,23,42,0.45)',
                      px: 1.25,
                      py: 0.9,
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0 }}>
                      <Checkbox
                        checked={checked}
                        tabIndex={-1}
                        disableRipple
                        sx={{ p: 0.25, color: 'rgba(191,219,254,0.75)', '&.Mui-checked': { color: '#60a5fa' } }}
                      />
                      <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }} noWrap>
                          {member.name}
                        </Typography>
                        {member.subtitle ? (
                          <Typography variant="caption" sx={{ color: 'rgba(191,219,254,0.74)' }} noWrap>
                            {member.subtitle}
                          </Typography>
                        ) : null}
                      </Box>
                    </Stack>
                    <Chip
                      label={checked ? 'Til stede' : 'Ikke til stede'}
                      size="small"
                      sx={{
                        ml: 1,
                        fontSize: 10,
                        color: checked ? '#bfdbfe' : 'rgba(191,219,254,0.62)',
                        bgcolor: checked ? 'rgba(37,99,235,0.35)' : 'rgba(30,41,59,0.55)',
                        border: `1px solid ${checked ? 'rgba(96,165,250,0.5)' : 'rgba(148,163,184,0.28)'}`,
                      }}
                    />
                  </ButtonBase>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.25, borderTop: '1px solid rgba(59,130,246,0.2)' }}>
          <Button size="small" onClick={handleClearCrewPresence} sx={{ color: '#fca5a5' }}>
            Tøm
          </Button>
          <Button size="small" onClick={handleSelectAllCrewPresence} sx={{ color: '#93c5fd' }}>
            Marker alle
          </Button>
          <Button size="small" variant="contained" onClick={handleCloseCrewDialog} sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={equipmentDialogOpen}
        onClose={handleCloseEquipmentDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: 'rgba(6,18,20,0.98)',
            border: '1px solid rgba(16,185,129,0.35)',
            boxShadow: '0 24px 56px rgba(2,6,23,0.62)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#a7f3d0', borderBottom: '1px solid rgba(16,185,129,0.24)' }}>
          Utstyr klart ({setStatus.equipmentReady}/{setStatus.equipmentTotal || equipmentRoster.length || 0})
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'rgba(16,185,129,0.24)', p: 2 }}>
          {equipmentRoster.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'rgba(167,243,208,0.72)' }}>
              Ingen utstyrsenheter registrert i prosjektet ennå.
            </Typography>
          ) : (
            <Stack sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {equipmentRoster.map((item) => {
                const checked = equipmentReadyIdSet.has(item.id);
                return (
                  <ButtonBase
                    key={item.id}
                    onClick={() => handleToggleEquipmentReady(item.id)}
                    sx={{
                      width: '100%',
                      borderRadius: 1.5,
                      border: `1px solid ${checked ? 'rgba(52,211,153,0.45)' : 'rgba(16,185,129,0.2)'}`,
                      bgcolor: checked ? 'rgba(6,95,70,0.28)' : 'rgba(6,24,26,0.45)',
                      px: 1.25,
                      py: 0.9,
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0 }}>
                      <Checkbox
                        checked={checked}
                        tabIndex={-1}
                        disableRipple
                        sx={{ p: 0.25, color: 'rgba(167,243,208,0.7)', '&.Mui-checked': { color: '#34d399' } }}
                      />
                      <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }} noWrap>
                          {item.name}
                        </Typography>
                        {item.subtitle ? (
                          <Typography variant="caption" sx={{ color: 'rgba(167,243,208,0.72)' }} noWrap>
                            {item.subtitle}
                          </Typography>
                        ) : null}
                      </Box>
                    </Stack>
                    <Chip
                      label={checked ? 'Klar' : 'Ikke klar'}
                      size="small"
                      sx={{
                        ml: 1,
                        fontSize: 10,
                        color: checked ? '#a7f3d0' : 'rgba(167,243,208,0.62)',
                        bgcolor: checked ? 'rgba(5,150,105,0.35)' : 'rgba(15,23,42,0.5)',
                        border: `1px solid ${checked ? 'rgba(52,211,153,0.5)' : 'rgba(148,163,184,0.28)'}`,
                      }}
                    />
                  </ButtonBase>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.25, borderTop: '1px solid rgba(16,185,129,0.2)' }}>
          <Button size="small" onClick={handleClearEquipmentReady} sx={{ color: '#fca5a5' }}>
            Tøm
          </Button>
          <Button size="small" onClick={handleSelectAllEquipmentReady} sx={{ color: '#6ee7b7' }}>
            Marker alle
          </Button>
          <Button size="small" variant="contained" onClick={handleCloseEquipmentDialog} sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' } }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Setup Complete overlay card ── */}
      {state.liveState === 'setup-complete' && (
        <SetupCompletePanel
          scene={state.currentScene}
          takes={state.takes}
          onAdvance={advanceScene}
          onDismiss={advanceScene}
        />
      )}

      {/* ── DIT-backup-drawer (åpnes fra footer-bar SET STATUS-cellen) ── */}
      <LiveSetDitPanel
        open={ditDrawerOpen}
        onClose={() => setDitDrawerOpen(false)}
        projectId={projectId}
      />
    </Box>
  );
}

export const LiveSetMode = memo(LiveSetModeInner);
