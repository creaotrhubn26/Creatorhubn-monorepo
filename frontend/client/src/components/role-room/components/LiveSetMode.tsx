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

import { memo, useState, useEffect, useRef, useCallback, type FC, type ElementType } from 'react';
import {
  Box,
  Typography,
  Button,
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
} from '@mui/icons-material';
import { useLiveSet } from '../hooks/useLiveSet';
import {
  LiveSetScene,
  LiveSetTake,
  TakeStatus,
  QuickActionType,
  NoteTag,
  LiveSetCameraMetadata,
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

// ── Status helpers ────────────────────────────────────────────────────────────

const TAKE_STATUS_META: Record<TakeStatus, { label: string; color: string; bg: string; Icon: ElementType | null }> = {
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

// ── Utility ───────────────────────────────────────────────────────────────────

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

// ── Sub-component: ControlPanel (Left) ───────────────────────────────────────

interface ControlPanelProps {
  liveState: string;
  timerSeconds: number;
  scene: LiveSetScene | null;
  takeCount: number;
  activeSetup: string;
  activeCam: string;
  onRoll: () => void;
  onCut: () => void;
  onSetupComplete: () => void;
  onAddFlag: (f: QuickActionType) => void;
  onSetSetup: (s: string) => void;
  onSetCam: (c: string) => void;
  noteInputRef: React.RefObject<HTMLInputElement | null>;
}

const ControlPanel: FC<ControlPanelProps> = ({
  liveState, timerSeconds, scene, takeCount, activeSetup, activeCam,
  onRoll, onCut, onSetupComplete, onAddFlag, onSetSetup, onSetCam, noteInputRef,
}) => {
  const isRolling = liveState === 'rolling';
  const isCut = liveState === 'cut';
  const isIdle = liveState === 'idle' || liveState === 'setup-complete';

  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column', gap: 2, p: 2,
        bgcolor: 'rgba(10,10,18,0.95)', borderRight: '1px solid rgba(255,255,255,0.06)',
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
            size="small"
            onClick={() => onSetSetup(s)}
            disabled={isRolling}
            sx={{
              minWidth: 42, py: 0.25, fontSize: 12, fontWeight: 700,
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
            size="small"
            onClick={() => onSetCam(c)}
            disabled={isRolling}
            sx={{
              minWidth: 32, py: 0.25, fontSize: 11, fontWeight: 700,
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
                fontSize: 13,
                fontWeight: 500,
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
            size="small"
            onClick={() => noteInputRef.current?.focus()}
            startIcon={<NoteIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 11,
              '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' },
            }}
          >
            Legg til notat (N)
          </Button>
        </Tooltip>
      )}
    </Box>
  );
};

// ── Sub-component: ContextPanel (Center) ─────────────────────────────────────

interface ContextPanelProps {
  scene: LiveSetScene | null;
  cameraMetadata: LiveSetCameraMetadata;
  takes: LiveSetTake[];
  onSetCamera: (m: Partial<LiveSetCameraMetadata>) => void;
}

const ContextPanel: FC<ContextPanelProps> = ({ scene, cameraMetadata, takes, onSetCamera }) => {
  const [showCamEdit, setShowCamEdit] = useState(false);
  const [showAllTakes, setShowAllTakes] = useState(false);
  const visibleTakes = showAllTakes ? takes : takes.slice(0, 8);

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

      {/* ── Camera Metadata ── */}
      <Paper sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }}>
        <Box
          sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setShowCamEdit(v => !v)}
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

        {/* Compact display */}
        {!showCamEdit && (
          <Box sx={{ px: 2, pb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {[
              { label: 'Cam', value: cameraMetadata.camera },
              { label: 'Linse', value: cameraMetadata.lens },
              { label: 'FPS', value: cameraMetadata.fps?.toString() },
              { label: 'ISO', value: cameraMetadata.iso?.toString() },
              { label: 'ND', value: cameraMetadata.nd },
              { label: 'Blende', value: cameraMetadata.aperture },
            ].filter(r => r.value).map(({ label, value }) => (
              <Box key={label} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1, py: 0.5, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, minWidth: 48 }}>
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

        {/* Expanded edit form */}
        <Collapse in={showCamEdit}>
          <Box sx={{ px: 2, pb: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
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
            {/* FPS preset selector */}
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
                {[23.976, 24, 25, 29.97, 30, 50, 59.94, 60, 120].map(fps => (
                  <MenuItem key={fps} value={fps.toString()}>{fps} fps</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Collapse>
      </Paper>

      {/* ── Previous takes summary ── */}
      {takes.length > 0 && (
        <Paper sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 2 }}>
          <Box sx={{ px: 2, py: 1.25 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10 }}>
              🎬 Takes denne scenen ({takes.length})
            </Typography>
          </Box>
          <Box sx={{ px: 2, pb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {visibleTakes.map(t => {
              const meta = TAKE_STATUS_META[t.status];
              return (
                <Box
                  key={t.id}
                  sx={{
                    px: 1.25, py: 0.5, borderRadius: 1,
                    bgcolor: meta.bg,
                    border: `1px solid ${meta.color}44`,
                    display: 'flex', alignItems: 'center', gap: 0.5,
                  }}
                >
                  <Typography variant="caption" sx={{ color: meta.color, fontSize: 12, fontWeight: 700 }}>
                    T{t.takeNumber}
                  </Typography>
                  {t.duration != null && (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                      {formatTimer(t.duration)}
                    </Typography>
                  )}
                </Box>
              );
            })}
            {takes.length > 8 && (
              <IconButton
                size="small"
                onClick={() => setShowAllTakes(v => !v)}
                sx={{ alignSelf: 'center', color: 'rgba(255,255,255,0.35)', p: 0.5 }}
              >
                {showAllTakes
                  ? <CollapseIcon sx={{ fontSize: 16 }} />
                  : <ExpandIcon sx={{ fontSize: 16 }} />
                }
              </IconButton>
            )}\n          </Box>
        </Paper>
      )}
    </Box>
  );
};

// ── Sub-component: TakeRow ────────────────────────────────────────────────────

interface TakeRowProps {
  take: LiveSetTake;
  isFocused: boolean;
  onFocus: () => void;
  onStatusChange: (id: string, s: TakeStatus) => void;
}

const TakeRow: FC<TakeRowProps> = ({ take, isFocused, onFocus, onStatusChange }) => {
  const meta = TAKE_STATUS_META[take.status];
  const StatusIcon = meta.Icon;

  return (
    <Box
      tabIndex={0}
      onClick={onFocus}
      onFocus={onFocus}
      sx={{
        px: 1.5, py: 1.25,
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
                  fontSize: 9, height: 18, cursor: 'pointer',
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

interface ActivityPanelProps {
  takes: LiveSetTake[];
  notes: LiveSetNote[];
  activeTab: 'takes' | 'notes';
  focusedTakeIndex: number;
  noteInput: string;
  noteTag: NoteTag;
  noteInputRef: React.RefObject<HTMLInputElement | null>;
  onTabChange: (t: 'takes' | 'notes') => void;
  onFocusTake: (i: number) => void;
  onStatusChange: (id: string, s: TakeStatus) => void;
  onNoteInput: (v: string) => void;
  onNoteTag: (t: NoteTag) => void;
  onAddNote: () => void;
  onDeleteNote: (id: string) => void;
}

const ActivityPanel: FC<ActivityPanelProps> = ({
  takes, notes, activeTab, focusedTakeIndex,
  noteInput, noteTag, noteInputRef,
  onTabChange, onFocusTake, onStatusChange,
  onNoteInput, onNoteTag, onAddNote, onDeleteNote,
}) => (
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
        minHeight: 40,
        '& .MuiTabs-indicator': { bgcolor: '#ef4444' },
        '& .MuiTab-root': { color: 'rgba(255,255,255,0.4)', minHeight: 40, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' },
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
              isFocused={focusedTakeIndex === i}
              onFocus={() => onFocusTake(i)}
              onStatusChange={onStatusChange}
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
            size="small"
            multiline
            maxRows={3}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': {
                color: '#fff', fontSize: 13,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                '&.Mui-focused fieldset': { borderColor: '#ef4444' },
              },
            }}
          />
          <Tooltip title="Legg til (Enter)">
            <Box>
              <Button
                variant="contained"
                size="small"
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
      </Box>
    )}
  </Box>
);

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

function LiveSetModeInner({ projectName, shootingDay, initialScene, onExit }: LiveSetModeProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const {
    state, roll, cut, setupComplete, advanceScene,
    addNote, setNoteInput, setNoteTag, setTakeStatus, addFlag,
    deleteNote, focusTake, setActivityTab, setCamera, setSetup, setCam,
  } = useLiveSet(initialScene);

  const noteInputRef = useRef<HTMLInputElement | null>(null);

  // Flash overlay state (CUT effect)
  const [flashVisible, setFlashVisible] = useState(false);

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

  const formattedDay = shootingDay
    ? new Date(shootingDay).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'Innspillingsdag';

  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column',
        width: '100%', height: '100%', minHeight: '100vh',
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
          px: { xs: 1.5, sm: 3 }, py: 1.25,
          bgcolor: 'rgba(0,0,0,0.6)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
          flexShrink: 0,
          flexWrap: 'wrap',
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
          {!isMobile && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>
              R · C · N · ↑↓
            </Typography>
          )}

          {onExit && (
            <Tooltip title="Avslutt Live Set Mode (Esc)">
              <IconButton size="small" onClick={onExit} sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: '#fff' } }}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* ══ 3-ZONE LAYOUT ═══════════════════════════════════════════════════ */}
      <Box
        sx={{
          flex: 1, display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          overflow: 'hidden', minHeight: 0,
        }}
      >
        {/* ── LEFT: Control Zone ── */}
        <Box
          sx={{
            width: { xs: '100%', md: 280 },
            flexShrink: 0,
            overflowY: 'auto',
            borderBottom: { xs: '1px solid rgba(255,255,255,0.07)', md: 'none' },
          }}
        >
          <ControlPanel
            liveState={state.liveState}
            timerSeconds={timerSeconds}
            scene={state.currentScene}
            takeCount={state.takes.filter(t => t.setupLabel === state.activeSetup).length}
            activeSetup={state.activeSetup}
            activeCam={state.activeCam}
            onRoll={roll}
            onCut={handleCut}
            onSetupComplete={setupComplete}
            onAddFlag={addFlag}
            onSetSetup={setSetup}
            onSetCam={setCam}
            noteInputRef={noteInputRef}
          />
        </Box>

        {/* ── CENTER: Context Zone ── */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            minWidth: 0,
            borderRight: { xs: 'none', md: '1px solid rgba(255,255,255,0.06)' },
          }}
        >
          <ContextPanel
            scene={state.currentScene}
            cameraMetadata={state.cameraMetadata}
            takes={state.takes}
            onSetCamera={setCamera}
          />
        </Box>

        {/* ── RIGHT: Activity Zone ── */}
        <Box
          sx={{
            width: { xs: '100%', md: 340 },
            flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <ActivityPanel
            takes={state.takes}
            notes={state.notes}
            activeTab={state.activityTab}
            focusedTakeIndex={state.focusedTakeIndex}
            noteInput={state.noteInput}
            noteTag={state.noteTag}
            noteInputRef={noteInputRef}
            onTabChange={setActivityTab}
            onFocusTake={focusTake}
            onStatusChange={setTakeStatus}
            onNoteInput={setNoteInput}
            onNoteTag={setNoteTag}
            onAddNote={addNote}
            onDeleteNote={deleteNote}
          />
        </Box>
      </Box>

      {/* ── Setup Complete overlay card ── */}
      {state.liveState === 'setup-complete' && (
        <SetupCompletePanel
          scene={state.currentScene}
          takes={state.takes}
          onAdvance={advanceScene}
          onDismiss={advanceScene}
        />
      )}
    </Box>
  );
}

export const LiveSetMode = memo(LiveSetModeInner);
