/**
 * BeatBoard – Story Cards / Beat Sheet View
 *
 * Full writers-room tool with:
 *  – Beat-type hierarchy with structural visual weight
 *  – Compact ↔ Expanded card density (writers work in compact 80 % of the time)
 *  – Live tension mapping with abrupt-escalation warnings
 *  – Act Balance indicator (% per act, warns when Act II bloats)
 *  – Character Arc filter overlay
 *  – Keyboard shortcuts: Enter=add, Cmd+→ move right, Cmd+↑↓ reorder, Cmd+D duplicate
 *  – Quick inline edit
 *  – Story Threads panel: isolation toggle + density heatmap
 *  – Room Mode (projector-ready fullscreen minimal UI)
 *  – Beat → Scene integration (linked scene # + script / outline status)
 *  – Multi-select beats + batch move / lock
 *  – Dramaturgical analysis (structural rules): flat Act II, missing midpoint, disappearing characters, etc.
 */

import { useState, useCallback, useMemo, useEffect, useRef, type FC } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  TextField,
  Stack,
  Tooltip,
  Paper,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Fade,
  Zoom,
  useTheme,
  useMediaQuery,
  LinearProgress,
  Collapse,
  Alert,
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Movie as SceneIcon,
  Person as CharacterIcon,
  SentimentSatisfied as PositiveIcon,
  SentimentDissatisfied as NegativeIcon,
  SentimentNeutral as NeutralIcon,
  Notes as NotesIcon,
  ColorLens as ColorIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  GridView as GridViewIcon,
  ViewList as ListViewIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  ContentCopy as DuplicateIcon,
  Warning as WarningIcon,
  Assessment as AnalysisIcon,
  FilterAlt as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Bolt as BoltIcon,
  PushPin as MidpointIcon,
  LocalFireDepartment as ClimaxIcon,
  NightlightRound as LowPointIcon,
  Autorenew as ReversalIcon,
  TrendingUp as EscalationIcon,
  CheckBoxOutlineBlank as UncheckedIcon,
  CheckBox as CheckedIcon,
} from '@mui/icons-material';
import type { BeatCard } from '../services/scriptAnalysisService';

// ─── Extended types ─────────────────────────────────────────────────────────

type BeatType =
  | 'setup'
  | 'catalyst'
  | 'debate'
  | 'break_into_two'
  | 'b_story'
  | 'fun_and_games'
  | 'midpoint'
  | 'bad_guys_close_in'
  | 'all_is_lost'
  | 'dark_night_of_soul'
  | 'break_into_three'
  | 'finale'
  | 'closing_image'
  | 'reversal'
  | 'escalation'
  | 'turning_point'
  | 'general';

type StoryThread = 'A' | 'B' | 'C';
type ScriptStatus = 'none' | 'outline' | 'draft' | 'revised' | 'locked';

interface ExtendedBeatCard extends BeatCard {
  beatType?: BeatType;
  storyThread?: StoryThread;
  tension?: number;       // 0–10
  locked?: boolean;
  linkedSceneNumber?: string;
  scriptStatus?: ScriptStatus;
  outlineStatus?: ScriptStatus;
}

// ─── Screen tier (7-tier responsive system) ──────────────────────────────────
type ScreenTier = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '4k';

const useScreenTier = (): {
  tier: ScreenTier;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  is4K: boolean;
} => {
  const theme = useTheme();
  const isXs  = useMediaQuery(theme.breakpoints.down('sm'));
  const isSm  = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isMd  = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isLg  = useMediaQuery(theme.breakpoints.between('lg', 'xl'));
  const isXl  = useMediaQuery(theme.breakpoints.between('xl', 1920));
  const isXxl = useMediaQuery('(min-width: 1920px) and (max-width: 2559px)');
  const is4K  = useMediaQuery('(min-width: 2560px)');

  const tier: ScreenTier = is4K ? '4k' : isXxl ? 'xxl' : isXl ? 'xl' : isLg ? 'lg' : isMd ? 'md' : isSm ? 'sm' : 'xs';
  return {
    tier,
    isMobile:  tier === 'xs' || tier === 'sm',
    isTablet:  tier === 'md',
    isDesktop: tier === 'lg' || tier === 'xl' || tier === 'xxl' || tier === '4k',
    is4K:      tier === '4k',
  };
};

const getResponsiveValues = (tier: ScreenTier) => {
  const values: Record<ScreenTier, {
    headerFontSize: string; titleFontSize: string; bodyFontSize: string;
    captionFontSize: string; buttonSize: 'small' | 'medium' | 'large';
    iconSize: number; spacing: number; padding: number; cardPadding: number;
    gap: number; toolbarPadding: number; actHeaderFontSize: string;
    beatCardWidth: string; minCardSize: number;
  }> = {
    xs:  { headerFontSize: '0.85rem', titleFontSize: '0.75rem', bodyFontSize: '0.65rem', captionFontSize: '0.55rem', buttonSize: 'small', iconSize: 16, spacing: 0.75, padding: 0.75, cardPadding: 1,    gap: 0.75, toolbarPadding: 0.5,  actHeaderFontSize: '0.8rem',  beatCardWidth: '100%',                 minCardSize: 140 },
    sm:  { headerFontSize: '0.95rem', titleFontSize: '0.85rem', bodyFontSize: '0.7rem',  captionFontSize: '0.6rem',  buttonSize: 'small', iconSize: 18, spacing: 1,    padding: 1,    cardPadding: 1.25, gap: 1,    toolbarPadding: 0.75, actHeaderFontSize: '0.9rem',  beatCardWidth: 'calc(50% - 8px)',      minCardSize: 150 },
    md:  { headerFontSize: '1rem',    titleFontSize: '0.9rem',  bodyFontSize: '0.75rem', captionFontSize: '0.65rem', buttonSize: 'small', iconSize: 20, spacing: 1.25, padding: 1.5,  cardPadding: 1.5,  gap: 1.25, toolbarPadding: 1,    actHeaderFontSize: '1rem',    beatCardWidth: 'calc(33.333% - 9px)', minCardSize: 160 },
    lg:  { headerFontSize: '1.1rem',  titleFontSize: '0.95rem', bodyFontSize: '0.8rem',  captionFontSize: '0.7rem',  buttonSize: 'medium',iconSize: 22, spacing: 1.5,  padding: 2,    cardPadding: 1.75, gap: 1.5,  toolbarPadding: 1.25, actHeaderFontSize: '1.1rem',  beatCardWidth: 'calc(25% - 12px)',    minCardSize: 180 },
    xl:  { headerFontSize: '1.2rem',  titleFontSize: '1rem',    bodyFontSize: '0.85rem', captionFontSize: '0.75rem', buttonSize: 'medium',iconSize: 24, spacing: 2,    padding: 2.5,  cardPadding: 2,    gap: 2,    toolbarPadding: 1.5,  actHeaderFontSize: '1.15rem', beatCardWidth: 'calc(20% - 14px)',    minCardSize: 200 },
    xxl: { headerFontSize: '1.3rem',  titleFontSize: '1.05rem', bodyFontSize: '0.9rem',  captionFontSize: '0.8rem',  buttonSize: 'medium',iconSize: 26, spacing: 2.5,  padding: 3,    cardPadding: 2.25, gap: 2.5,  toolbarPadding: 1.75, actHeaderFontSize: '1.25rem', beatCardWidth: 'calc(20% - 14px)',    minCardSize: 220 },
    '4k':{ headerFontSize: '1.5rem',  titleFontSize: '1.15rem', bodyFontSize: '1rem',    captionFontSize: '0.9rem',  buttonSize: 'large', iconSize: 28, spacing: 3,    padding: 3.5,  cardPadding: 2.5,  gap: 3,    toolbarPadding: 2,    actHeaderFontSize: '1.4rem',  beatCardWidth: 'calc(20% - 15px)',    minCardSize: 260 },
  };
  return values[tier];
};

// ─── Beat-type hierarchy ──────────────────────────────────────────────────────

interface BeatTypeConfig {
  label: string;
  color: string;
  glow: string;
  icon: JSX.Element;
  weight: 'normal' | 'emphasis' | 'strong' | 'climax';
}

const BEAT_TYPE_CONFIG: Record<BeatType, BeatTypeConfig> = {
  setup:             { label: 'Setup',            color: '#78909c', glow: 'none',                                     icon: <NotesIcon sx={{ fontSize: 11 }} />,      weight: 'normal'  },
  catalyst:          { label: 'Catalyst',          color: '#e91e63', glow: '0 0 12px rgba(233,30,99,0.7)',             icon: <BoltIcon sx={{ fontSize: 11 }} />,       weight: 'strong'  },
  debate:            { label: 'Debate',            color: '#9c27b0', glow: 'none',                                     icon: <NotesIcon sx={{ fontSize: 11 }} />,      weight: 'normal'  },
  break_into_two:    { label: 'Break Into Two',    color: '#1976d2', glow: '0 0 8px rgba(25,118,210,0.5)',             icon: <BoltIcon sx={{ fontSize: 11 }} />,       weight: 'emphasis'},
  b_story:           { label: 'B Story',           color: '#7b61ff', glow: 'none',                                     icon: <NotesIcon sx={{ fontSize: 11 }} />,      weight: 'normal'  },
  fun_and_games:     { label: 'Fun & Games',       color: '#0097a7', glow: 'none',                                     icon: <NotesIcon sx={{ fontSize: 11 }} />,      weight: 'normal'  },
  midpoint:          { label: 'Midpoint',          color: '#f57c00', glow: '0 0 14px rgba(245,124,0,0.75)',            icon: <MidpointIcon sx={{ fontSize: 11 }} />,   weight: 'strong'  },
  bad_guys_close_in: { label: 'Bad Guys Close In', color: '#d32f2f', glow: '0 0 8px rgba(211,47,47,0.5)',             icon: <EscalationIcon sx={{ fontSize: 11 }} />, weight: 'emphasis'},
  all_is_lost:       { label: 'All Is Lost',       color: '#880e4f', glow: '0 0 16px rgba(136,14,79,0.8)',            icon: <LowPointIcon sx={{ fontSize: 11 }} />,   weight: 'strong'  },
  dark_night_of_soul:{ label: 'Dark Night',        color: '#311b92', glow: '0 0 10px rgba(49,27,146,0.6)',            icon: <LowPointIcon sx={{ fontSize: 11 }} />,   weight: 'emphasis'},
  break_into_three:  { label: 'Break Into Three',  color: '#2e7d32', glow: '0 0 8px rgba(46,125,50,0.5)',             icon: <BoltIcon sx={{ fontSize: 11 }} />,       weight: 'emphasis'},
  finale:            { label: 'Finale / Climax',   color: '#ff6f00', glow: '0 0 20px rgba(255,111,0,0.9)',            icon: <ClimaxIcon sx={{ fontSize: 11 }} />,     weight: 'climax'  },
  closing_image:     { label: 'Closing Image',     color: '#1565c0', glow: 'none',                                     icon: <NotesIcon sx={{ fontSize: 11 }} />,      weight: 'normal'  },
  reversal:          { label: 'Reversal',          color: '#00838f', glow: '0 0 10px rgba(0,131,143,0.6)',            icon: <ReversalIcon sx={{ fontSize: 11 }} />,   weight: 'emphasis'},
  escalation:        { label: 'Escalation',        color: '#c62828', glow: '0 0 8px rgba(198,40,40,0.5)',             icon: <EscalationIcon sx={{ fontSize: 11 }} />, weight: 'emphasis'},
  turning_point:     { label: 'Turning Point',     color: '#ad1457', glow: '0 0 12px rgba(173,20,87,0.65)',           icon: <ReversalIcon sx={{ fontSize: 11 }} />,   weight: 'strong'  },
  general:           { label: 'Scene',             color: '#546e7a', glow: 'none',                                     icon: <NotesIcon sx={{ fontSize: 11 }} />,      weight: 'normal'  },
};

// ─── Color palette ────────────────────────────────────────────────────────────

const BEAT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

// Thread colours consistent with the screenshot sidebar
const THREAD_COLOR: Record<StoryThread, string> = {
  A: '#7b61ff',
  B: '#3b82f6',
  C: '#f59e0b',
};

// Script status colours
const STATUS_COLOR: Record<ScriptStatus, string> = {
  none:    '#546e7a',
  outline: '#78909c',
  draft:   '#f59e0b',
  revised: '#42a5f5',
  locked:  '#66bb6a',
};

// ─── Emotion icon ─────────────────────────────────────────────────────────────

const EmotionIcon: FC<{ emotion: 'positive' | 'negative' | 'neutral' }> = ({ emotion }) => {
  if (emotion === 'positive') return <PositiveIcon sx={{ color: '#4ade80', fontSize: 14 }} />;
  if (emotion === 'negative') return <NegativeIcon sx={{ color: '#f87171', fontSize: 14 }} />;
  return <NeutralIcon sx={{ color: '#a78bfa', fontSize: 14 }} />;
};

// ─── Mini tension sparkline (SVG) shown above each act column ────────────────

const MiniTensionArc: FC<{
  tensions: number[];
  width?: number;
  height?: number;
  highlightWarning?: boolean;
}> = ({ tensions, width = 120, height = 32, highlightWarning = false }) => {
  if (tensions.length < 2) return null;
  const max = 10;
  const pts = tensions.map((t, i) => {
    const x = (i / (tensions.length - 1)) * width;
    const y = height - (t / max) * height;
    return `${x},${y}`;
  });
  return (
    <Box sx={{ lineHeight: 0, opacity: 0.85 }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block' }}
      >
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={highlightWarning ? '#f59e0b' : '#7b61ff'}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {tensions.map((t, i) => {
          const x = (i / (tensions.length - 1)) * width;
          const y = height - (t / max) * height;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2.5}
              fill={highlightWarning ? '#f59e0b' : '#7b61ff'}
            />
          );
        })}
      </svg>
    </Box>
  );
};

// ─── BeatBoard props ──────────────────────────────────────────────────────────

interface BeatBoardProps {
  beats: BeatCard[];
  onBeatClick?: (beat: BeatCard) => void;
  onBeatEdit?: (beatId: string, updates: Partial<BeatCard>) => void;
  onBeatReorder?: (beats: BeatCard[]) => void;
  onBeatDelete?: (beatId: string) => void;
  onAddBeat?: () => void;
  readOnly?: boolean;
  actsView?: boolean;
  darkMode?: boolean;
}

// ─── BeatCardItem ─────────────────────────────────────────────────────────────

interface BeatCardItemProps {
  beat: ExtendedBeatCard;
  isSelected: boolean;
  isMultiSelected: boolean;
  isDimmed: boolean;
  compact: boolean;
  onClick: () => void;
  onMultiSelect: () => void;
  onEdit: (updates: Partial<ExtendedBeatCard>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleLock: () => void;
  readOnly: boolean;
  darkMode: boolean;
  responsive: ReturnType<typeof getResponsiveValues>;
}

const BeatCardItem: FC<BeatCardItemProps> = ({
  beat,
  isSelected,
  isMultiSelected,
  isDimmed,
  compact,
  onClick,
  onMultiSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleLock,
  readOnly,
  darkMode,
  responsive,
}) => {
  const [isEditing, setIsEditing]           = useState(false);
  const [editText, setEditText]             = useState(beat.notes || '');
  const [colorMenuAnchor, setColorMenuAnchor] = useState<HTMLElement | null>(null);
  const [typeMenuAnchor, setTypeMenuAnchor]   = useState<HTMLElement | null>(null);
  const [hoverNotes, setHoverNotes]           = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const btConfig = BEAT_TYPE_CONFIG[beat.beatType ?? 'general'];
  const isClimax     = btConfig.weight === 'climax';
  const isStrong     = btConfig.weight === 'strong';
  const isEmphasis   = btConfig.weight === 'emphasis';

  const accentColor  = beat.color ?? btConfig.color;
  const cardBorder   = isSelected
    ? `2px solid #7b61ff`
    : isMultiSelected
      ? `2px solid #42a5f5`
      : `1px solid rgba(255,255,255,${isClimax ? 0.25 : 0.08})`;

  const cardGlow  = isSelected ? '0 0 0 2px #7b61ff55' : btConfig.glow;
  const cardScale = isClimax ? 1.02 : 1;

  const handleSaveNotes = () => {
    onEdit({ notes: editText });
    setIsEditing(false);
  };

  const handleColorSelect = (color: string) => {
    onEdit({ color });
    setColorMenuAnchor(null);
  };

  const handleTypeSelect = (beatType: BeatType) => {
    onEdit({ beatType });
    setTypeMenuAnchor(null);
  };

  // Keyboard: Enter to save, Escape to cancel
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { handleSaveNotes(); }
    if (e.key === 'Escape') { setEditText(beat.notes || ''); setIsEditing(false); }
  };

  return (
    <Zoom in timeout={180}>
      <Card
        onClick={onClick}
        sx={{
          minWidth: compact ? 160 : 200,
          maxWidth: isClimax ? 320 : undefined,
          m: responsive.gap / 2,
          cursor: beat.locked ? 'not-allowed' : 'pointer',
          border: cardBorder,
          bgcolor: darkMode ? 'rgba(18,18,28,0.92)' : 'rgba(255,255,255,0.95)',
          borderLeft: `4px solid ${accentColor}`,
          boxShadow: cardGlow,
          transform: `scale(${cardScale})`,
          transition: 'all 0.18s ease',
          opacity: isDimmed ? 0.3 : beat.locked ? 0.7 : 1,
          '&:hover': beat.locked ? {} : {
            transform: `scale(${cardScale}) translateY(-2px)`,
            boxShadow: `0 8px 24px rgba(0,0,0,0.4), ${btConfig.glow || 'none'}`,
          },
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {/* Multi-select checkbox (top-left) */}
        {!readOnly && (
          <Box
            sx={{ position: 'absolute', top: -8, left: -8, zIndex: 2 }}
            onClick={(e) => { e.stopPropagation(); onMultiSelect(); }}
          >
            {isMultiSelected
              ? <CheckedIcon sx={{ color: '#42a5f5', fontSize: 18, bgcolor: 'rgba(18,18,28,0.9)', borderRadius: '50%' }} />
              : <UncheckedIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 18, opacity: 0, '.MuiCard-root:hover &': { opacity: 1 } }} />
            }
          </Box>
        )}

        {/* Lock badge */}
        {beat.locked && (
          <Box sx={{ position: 'absolute', top: 4, left: 4, zIndex: 2 }}>
            <LockIcon sx={{ fontSize: 12, color: '#f59e0b' }} />
          </Box>
        )}

        {/* Action buttons (top-right, show on hover) */}
        {!readOnly && !beat.locked && (
          <Stack
            direction="row"
            spacing={0.25}
            sx={{
              position: 'absolute', top: 4, right: 4, zIndex: 2,
              opacity: 0, transition: 'opacity 0.15s',
              '.MuiCard-root:hover &': { opacity: 1 },
            }}
          >
            <Tooltip title="Typen beat">
              <IconButton size="small" sx={{ p: '2px', color: btConfig.color }}
                onClick={(e) => { e.stopPropagation(); setTypeMenuAnchor(e.currentTarget); }}>
                {btConfig.icon}
              </IconButton>
            </Tooltip>
            <Tooltip title="Farge">
              <IconButton size="small" sx={{ p: '2px', color: 'rgba(255,255,255,0.5)' }}
                onClick={(e) => { e.stopPropagation(); setColorMenuAnchor(e.currentTarget); }}>
                <ColorIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Rediger noter">
              <IconButton size="small" sx={{ p: '2px', color: 'rgba(255,255,255,0.5)' }}
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditText(beat.notes || ''); setTimeout(() => inputRef.current?.focus(), 50); }}>
                <EditIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Dupliser (Cmd+D)">
              <IconButton size="small" sx={{ p: '2px', color: 'rgba(255,255,255,0.5)' }}
                onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
                <DuplicateIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={beat.locked ? 'Lås opp' : 'Lås beat'}>
              <IconButton size="small" sx={{ p: '2px', color: 'rgba(255,255,255,0.5)' }}
                onClick={(e) => { e.stopPropagation(); onToggleLock(); }}>
                <LockOpenIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Slett">
              <IconButton size="small" sx={{ p: '2px', color: 'rgba(255,100,100,0.6)' }}
                onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <DeleteIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        )}

        <CardContent sx={{ p: compact ? 1 : responsive.cardPadding, '&:last-child': { pb: compact ? 1 : responsive.cardPadding } }}>
          {/* Beat-type badge + scene number + thread dot */}
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }} flexWrap="wrap">
            <Chip
              icon={btConfig.icon}
              label={compact ? `#${beat.sceneNumber}` : btConfig.label}
              size="small"
              sx={{
                bgcolor: `${accentColor}22`,
                color: accentColor,
                borderColor: accentColor,
                border: isStrong || isClimax ? `1px solid ${accentColor}` : 'none',
                fontWeight: isClimax ? 800 : isStrong ? 700 : 600,
                fontSize: '0.6rem',
                height: 18,
                '& .MuiChip-label': { px: 0.75 },
                '& .MuiChip-icon':  { fontSize: 11, color: accentColor },
              }}
            />
            {beat.storyThread && (
              <Box
                sx={{
                  width: 8, height: 8, borderRadius: '50%',
                  bgcolor: THREAD_COLOR[beat.storyThread],
                  flexShrink: 0,
                }}
              />
            )}
            {!compact && (
              <Typography variant="caption" sx={{ opacity: 0.5, ml: 'auto', fontSize: '0.6rem' }}>
                p.{beat.pageNumber}
              </Typography>
            )}
            <EmotionIcon emotion={beat.emotion} />
          </Stack>

          {/* Heading */}
          <Typography
            variant="caption"
            sx={{
              fontWeight: isClimax ? 800 : isStrong ? 700 : 600,
              textTransform: 'uppercase',
              fontSize: isClimax ? '0.78rem' : compact ? '0.65rem' : responsive.bodyFontSize,
              color: isClimax ? accentColor : darkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
              lineHeight: 1.3,
              display: 'block',
              mb: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {beat.heading}
          </Typography>

          {/* Notes / beat text */}
          {isEditing ? (
            <TextField
              inputRef={inputRef}
              size="small"
              multiline
              rows={2}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleSaveNotes}
              onKeyDown={handleEditKeyDown}
              autoFocus
              fullWidth
              sx={{ '& .MuiInputBase-input': { fontSize: '0.72rem' } }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Tooltip
              title={beat.notes && beat.notes.length > 80 ? beat.notes : ''}
              placement="bottom-start"
              onOpen={() => setHoverNotes(true)}
              onClose={() => setHoverNotes(false)}
            >
              <Typography
                variant="body2"
                sx={{
                  fontSize: compact ? '0.65rem' : '0.72rem',
                  color: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: compact ? 2 : 3,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.4,
                  cursor: hoverNotes ? 'help' : 'default',
                }}
              >
                {beat.notes || beat.beat}
              </Typography>
            </Tooltip>
          )}

          {/* Characters – only in expanded mode */}
          {!compact && beat.characters.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.4 }}>
              {beat.characters.slice(0, 3).map((char, idx) => (
                <Tooltip key={idx} title={char}>
                  <Chip
                    icon={<CharacterIcon sx={{ fontSize: 10 }} />}
                    label={char}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(59,130,246,0.15)', color: 'rgba(59,130,246,0.9)',
                      fontSize: '0.58rem', height: 16,
                      '& .MuiChip-label': { px: 0.5 },
                      '& .MuiChip-icon': { fontSize: 10 },
                      maxWidth: 64, overflow: 'hidden',
                    }}
                  />
                </Tooltip>
              ))}
              {beat.characters.length > 3 && (
                <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.58rem', alignSelf: 'center' }}>
                  +{beat.characters.length - 3}
                </Typography>
              )}
            </Stack>
          )}

          {/* Scene integration row */}
          {!compact && (beat.linkedSceneNumber || beat.scriptStatus) && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} alignItems="center">
              {beat.linkedSceneNumber && (
                <Tooltip title="Linked scene">
                  <Chip
                    icon={<SceneIcon sx={{ fontSize: 10 }} />}
                    label={`Scene ${beat.linkedSceneNumber}`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.08)', fontSize: '0.58rem', height: 16, '& .MuiChip-label': { px: 0.5 }, '& .MuiChip-icon': { fontSize: 10 } }}
                  />
                </Tooltip>
              )}
              {beat.scriptStatus && beat.scriptStatus !== 'none' && (
                <Tooltip title={`Manus: ${beat.scriptStatus}`}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: STATUS_COLOR[beat.scriptStatus] }} />
                </Tooltip>
              )}
            </Stack>
          )}

          {/* Tension bar */}
          {beat.tension !== undefined && !compact && (
            <Tooltip title={`Tension: ${beat.tension}/10`}>
              <LinearProgress
                variant="determinate"
                value={(beat.tension / 10) * 100}
                sx={{
                  mt: 0.75, height: 3, borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: beat.tension >= 8 ? '#ef4444' : beat.tension >= 5 ? '#f59e0b' : '#42a5f5',
                    borderRadius: 2,
                  },
                }}
              />
            </Tooltip>
          )}
        </CardContent>

        {/* Beat-type selection menu */}
        <Menu anchorEl={typeMenuAnchor} open={Boolean(typeMenuAnchor)} onClose={() => setTypeMenuAnchor(null)}
          PaperProps={{ sx: { bgcolor: '#1a1a2e', maxHeight: 340, overflow: 'auto' } }}>
          {(Object.keys(BEAT_TYPE_CONFIG) as BeatType[]).map((bt) => {
            const cfg = BEAT_TYPE_CONFIG[bt];
            return (
              <MenuItem key={bt} onClick={() => handleTypeSelect(bt)} dense
                selected={beat.beatType === bt}
                sx={{ '&.Mui-selected': { bgcolor: `${cfg.color}22` } }}>
                <ListItemIcon sx={{ color: cfg.color, minWidth: 28 }}>{cfg.icon}</ListItemIcon>
                <ListItemText primary={cfg.label} primaryTypographyProps={{ fontSize: '0.78rem' }} />
              </MenuItem>
            );
          })}
        </Menu>

        {/* Color picker menu */}
        <Menu anchorEl={colorMenuAnchor} open={Boolean(colorMenuAnchor)} onClose={() => setColorMenuAnchor(null)}
          PaperProps={{ sx: { bgcolor: '#1a1a2e' } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, p: 1 }}>
            {BEAT_COLORS.map((c) => (
              <Box key={c} onClick={() => handleColorSelect(c)}
                sx={{ width: 28, height: 28, bgcolor: c, borderRadius: 1, cursor: 'pointer', border: beat.color === c ? '2px solid white' : 'none', '&:hover': { opacity: 0.8 } }}
              />
            ))}
          </Box>
        </Menu>
      </Card>
    </Zoom>
  );
};

// ─── Dramaturgical analysis (structural rules) ──────────────────────────────────

interface DiagnosticWarning {
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
}

function runDramaturgicalAnalysis(beats: ExtendedBeatCard[]): DiagnosticWarning[] {
  const warnings: DiagnosticWarning[] = [];
  if (beats.length < 3) return warnings;

  const total = beats.length;
  const act1End   = Math.floor(total * 0.25);
  const act2End   = Math.floor(total * 0.75);
  const act1Beats = beats.slice(0, act1End);
  const act2Beats = beats.slice(act1End, act2End);
  const act3Beats = beats.slice(act2End);

  // Act balance
  const act1Pct = Math.round((act1Beats.length / total) * 100);
  const act2Pct = Math.round((act2Beats.length / total) * 100);
  const act3Pct = Math.round((act3Beats.length / total) * 100);
  if (act2Pct > 55) {
    warnings.push({ severity: 'warning', title: 'Flat Second Act', description: `Act II utgjør ${act2Pct}% av historien. Overveie å komprimere eller dele med et tydelig midtpunkt.` });
  }
  if (act3Pct < 10) {
    warnings.push({ severity: 'warning', title: 'For knapt klimaks', description: `Act III utgjør bare ${act3Pct}%. Resolusjonen kan føles sammenpresset.` });
  }

  // Missing midpoint
  const hasMidpoint = beats.some(b => b.beatType === 'midpoint');
  if (!hasMidpoint && total > 8) {
    warnings.push({ severity: 'warning', title: 'Manglende midtpunkt', description: 'Ingen beat er merket som Midpoint. Et tydelig midtpunkt forhindrer flat Act II.' });
  }

  // Missing catalyst
  const hasCatalyst = beats.some(b => b.beatType === 'catalyst');
  if (!hasCatalyst && total > 5) {
    warnings.push({ severity: 'info', title: 'Manglende Catalyst', description: 'Merk et inciting incident som "Catalyst" for å vise det dramaturgiske løftet tidlig.' });
  }

  // Abrupt tension escalation
  const tensionBeats = beats.filter(b => b.tension !== undefined);
  for (let i = 1; i < tensionBeats.length; i++) {
    const prev = tensionBeats[i - 1].tension ?? 0;
    const curr = tensionBeats[i].tension ?? 0;
    if (curr - prev > 4) {
      warnings.push({ severity: 'warning', title: 'Bratt tension-hopp', description: `Tension hopper ${(prev).toFixed(0)} → ${(curr).toFixed(0)} mellom "${tensionBeats[i-1].heading}" og "${tensionBeats[i].heading}". Vurder å legge inn en mellomliggende beat.` });
      break;
    }
  }

  // Too few reversals
  const reversals = beats.filter(b => b.beatType === 'reversal' || b.beatType === 'turning_point').length;
  if (reversals < 2 && total > 10) {
    warnings.push({ severity: 'info', title: 'Få reverseringer', description: `${reversals} snuoperasjon(er) funnet. Sterke historier har minst 2–3 reverseringer.` });
  }

  // Character disappears for many beats
  const allChars = Array.from(new Set(beats.flatMap(b => b.characters)));
  allChars.forEach(char => {
    let lastSeen = -1;
    beats.forEach((b, i) => { if (b.characters.includes(char)) lastSeen = i; });
    const firstSeen = beats.findIndex(b => b.characters.includes(char));
    if (lastSeen !== -1 && firstSeen !== -1) {
      let maxGap = 0;
      let gapStart = firstSeen;
      for (let i = firstSeen + 1; i <= lastSeen; i++) {
        if (!beats[i].characters.includes(char)) {
          maxGap++;
        } else {
          gapStart = i;
          maxGap = 0;
        }
      }
      if (maxGap > 5 && total > 10) {
        warnings.push({ severity: 'info', title: `Karakter forsvinner`, description: `${char} er ikke til stede i ${maxGap} sammenhengende beats midt i historien.` });
      }
    }
  });

  // Late climax
  const climaxIdx = beats.findIndex(b => b.beatType === 'finale');
  if (climaxIdx !== -1 && climaxIdx / total > 0.92) {
    warnings.push({ severity: 'warning', title: 'For sent klimaks', description: `Klimaks er på beat ${climaxIdx + 1} av ${total} (${Math.round((climaxIdx / total) * 100)}%). Vurder å flytte det til ~75-85 %.` });
  }

  // Act balance summary (info)
  warnings.push({ severity: 'info', title: 'Act Balance', description: `Act I: ${act1Pct}% · Act II: ${act2Pct}% · Act III: ${act3Pct}%` });

  return warnings;
}

// ─── Story Threads Sidebar ────────────────────────────────────────────────────

const StoryThreadsSidebar: FC<{
  beats: ExtendedBeatCard[];
  activeThread: StoryThread | null;
  onToggleThread: (t: StoryThread | null) => void;
  darkMode: boolean;
}> = ({ beats, activeThread, onToggleThread, darkMode }) => {
  const threads: StoryThread[] = ['A', 'B', 'C'];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {threads.map((thread) => {
        const count  = beats.filter(b => b.storyThread === thread).length;
        const pct    = beats.length > 0 ? Math.round((count / beats.length) * 100) : 0;
        const color  = THREAD_COLOR[thread];
        const active = activeThread === thread;
        return (
          <Box key={thread}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem', color: darkMode ? 'rgba(255,255,255,0.9)' : 'inherit' }}>
                {thread}-Story
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.65rem', ml: 'auto' }}>
                {count} beats
              </Typography>
              <Tooltip title={active ? 'Vis alle' : `Isoler ${thread}-Story`}>
                <IconButton size="small" sx={{ p: '2px' }} onClick={() => onToggleThread(active ? null : thread)}>
                  <FilterIcon sx={{ fontSize: 13, color: active ? color : 'rgba(255,255,255,0.4)' }} />
                </IconButton>
              </Tooltip>
            </Stack>
            {/* Density heatmap bar */}
            <Box sx={{ display: 'flex', gap: '1px', height: 6 }}>
              {beats.map((b, i) => (
                <Box
                  key={i}
                  sx={{
                    flex: 1,
                    bgcolor: b.storyThread === thread ? color : 'rgba(255,255,255,0.06)',
                    borderRadius: 0.5,
                  }}
                />
              ))}
            </Box>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{ mt: 0.5, height: 2, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: color } }}
            />
          </Box>
        );
      })}
    </Box>
  );
};

// ─── Room Mode overlay ────────────────────────────────────────────────────────

const RoomModeOverlay: FC<{
  beats: ExtendedBeatCard[];
  currentIdx: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}> = ({ beats, currentIdx, onClose, onPrev, onNext }) => {
  const beat = beats[currentIdx];
  if (!beat) return null;
  const btc = BEAT_TYPE_CONFIG[beat.beatType ?? 'general'];
  const accent = beat.color ?? btc.color;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); onNext(); }
      if (e.key === 'ArrowLeft')                    { e.preventDefault(); onPrev(); }
      if (e.key === 'Escape')                       { onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNext, onPrev, onClose]);

  return (
    <Box
      sx={{
        position: 'fixed', inset: 0, zIndex: 9999,
        bgcolor: '#060608',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Close */}
      <IconButton onClick={onClose}
        sx={{ position: 'absolute', top: 16, right: 16, color: 'rgba(255,255,255,0.4)' }}>
        <FullscreenExitIcon />
      </IconButton>

      {/* Beat counter */}
      <Typography variant="caption" sx={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', letterSpacing: 2 }}>
        {currentIdx + 1} / {beats.length}
      </Typography>

      {/* Beat card large */}
      <Fade in key={beat.id}>
        <Box sx={{ textAlign: 'center', maxWidth: 640, px: 4 }}>
          <Typography variant="caption"
            sx={{ display: 'block', color: accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 3, mb: 2, fontSize: '0.8rem' }}>
            {btc.label}
          </Typography>
          <Typography variant="h3"
            sx={{ color: 'white', fontWeight: 800, mb: 2, lineHeight: 1.2, textShadow: `0 0 40px ${accent}66` }}>
            {beat.heading}
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, mb: 3 }}>
            {beat.notes || beat.beat}
          </Typography>
          {beat.characters.length > 0 && (
            <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" gap={0.5}>
              {beat.characters.map((c, i) => (
                <Chip key={i} label={c} size="small"
                  sx={{ bgcolor: 'rgba(59,130,246,0.2)', color: '#93c5fd', fontSize: '0.75rem' }} />
              ))}
            </Stack>
          )}
        </Box>
      </Fade>

      {/* Navigation */}
      <Stack direction="row" spacing={3} sx={{ position: 'absolute', bottom: 32 }}>
        <IconButton onClick={onPrev} disabled={currentIdx === 0}
          sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white' }, '&.Mui-disabled': { opacity: 0.15 } }}>
          <PrevIcon fontSize="large" />
        </IconButton>
        <IconButton onClick={onNext} disabled={currentIdx === beats.length - 1}
          sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white' }, '&.Mui-disabled': { opacity: 0.15 } }}>
          <NextIcon fontSize="large" />
        </IconButton>
      </Stack>
    </Box>
  );
};

// ─── BeatBoard main component ─────────────────────────────────────────────────

export const BeatBoard: FC<BeatBoardProps> = ({
  beats: rawBeats,
  onBeatClick,
  onBeatEdit,
  onBeatReorder,
  onBeatDelete,
  onAddBeat,
  readOnly = false,
  actsView = false,
  darkMode = true,
}) => {
  const { tier, isMobile } = useScreenTier();
  const responsive = getResponsiveValues(tier);

  // ── Local extended state ──────────────────────────────────────────────────
  const [extendedData, setExtendedData] = useState<Record<string, Partial<ExtendedBeatCard>>>({});

  const beats: ExtendedBeatCard[] = useMemo(
    () => rawBeats.map(b => ({ ...b, ...extendedData[b.id] })),
    [rawBeats, extendedData],
  );

  const patchBeat = useCallback((beatId: string, updates: Partial<ExtendedBeatCard>) => {
    setExtendedData(prev => ({ ...prev, [beatId]: { ...prev[beatId], ...updates } }));
    // Forward non-extended updates to parent
    const parentUpdates: Partial<BeatCard> = {};
    if (updates.notes !== undefined)  parentUpdates.notes  = updates.notes;
    if (updates.color !== undefined)  parentUpdates.color  = updates.color;
    if (Object.keys(parentUpdates).length > 0) onBeatEdit?.(beatId, parentUpdates);
  }, [onBeatEdit]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedBeatId, setSelectedBeatId]     = useState<string | null>(null);
  const [multiSelected, setMultiSelected]       = useState<Set<string>>(new Set());
  const [viewMode, setViewMode]                 = useState<'grid' | 'list'>('grid');
  const [compact, setCompact]                   = useState(true); // Writers mode default
  const [characterFilter, setCharacterFilter]   = useState<string | null>(null);
  const [activeThread, setActiveThread]         = useState<StoryThread | null>(null);
  const [roomMode, setRoomMode]                 = useState(false);
  const [roomIdx, setRoomIdx]                   = useState(0);
  const [showThreads, setShowThreads]           = useState(false);
  const [showAnalysis, setShowAnalysis]          = useState(false);
  const [charMenuAnchor, setCharMenuAnchor]     = useState<HTMLElement | null>(null);

  // ── Derived data ──────────────────────────────────────────────────────────
  const allCharacters = useMemo(
    () => Array.from(new Set(beats.flatMap(b => b.characters))).sort(),
    [beats],
  );

  const filteredBeats = useMemo(() => {
    let result = beats;
    if (characterFilter) result = result.filter(b => b.characters.includes(characterFilter));
    if (activeThread)    result = result.filter(b => b.storyThread === activeThread);
    return result;
  }, [beats, characterFilter, activeThread]);

  const groupedBeats = useMemo(() => {
    if (!actsView) return [{ label: '', beats: filteredBeats, tensionValues: filteredBeats.map(b => b.tension ?? 5) }];
    const total = beats.length; // use unfiltered for act boundaries
    const act1End = Math.floor(total * 0.25);
    const act2End = Math.floor(total * 0.75);
    const groups = [
      { label: 'ACT I',  subtitle: 'SETUP • 0–25%',           beats: [] as ExtendedBeatCard[], tensionValues: [] as number[] },
      { label: 'ACT II', subtitle: 'CONFRONTATION • 25–75%',  beats: [] as ExtendedBeatCard[], tensionValues: [] as number[] },
      { label: 'ACT III',subtitle: 'RESOLUTION • 75–100%',    beats: [] as ExtendedBeatCard[], tensionValues: [] as number[] },
    ];
    beats.forEach((b, i) => {
      const g = i < act1End ? 0 : i < act2End ? 1 : 2;
      if (!characterFilter || b.characters.includes(characterFilter)) {
        if (!activeThread || b.storyThread === activeThread) groups[g].beats.push(b);
        groups[g].tensionValues.push(b.tension ?? 5);
      }
    });
    return groups;
  }, [beats, filteredBeats, actsView, characterFilter, activeThread]);

  // Act balance percentages
  const actBalance = useMemo(() => {
    if (!actsView || beats.length === 0) return null;
    const total = beats.length;
    const act1End = Math.floor(total * 0.25);
    const act2End = Math.floor(total * 0.75);
    return {
      act1: Math.round((act1End / total) * 100),
      act2: Math.round(((act2End - act1End) / total) * 100),
      act3: Math.round(((total - act2End) / total) * 100),
    };
  }, [beats, actsView]);

  // Dramaturgical analysis (structural rules)
  const analysisWarnings = useMemo(() => runDramaturgicalAnalysis(beats), [beats]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const kbRef = useRef({ selectedBeatId, beats, multiSelected });
  kbRef.current = { selectedBeatId, beats, multiSelected };

  useEffect(() => {
    if (readOnly) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      const { selectedBeatId: sid, beats: bs, multiSelected: ms } = kbRef.current;
      const idx = bs.findIndex(b => b.id === sid);

      // Enter → add beat
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        onAddBeat?.();
        return;
      }
      // Cmd+D → duplicate selected
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && sid) {
        e.preventDefault();
        const beat = bs.find(b => b.id === sid);
        if (beat) {
          const duped: BeatCard = { ...beat, id: `${beat.id}-dup-${Date.now()}`, notes: beat.notes };
          const newBeats = [...bs];
          newBeats.splice(idx + 1, 0, duped);
          onBeatReorder?.(newBeats);
        }
        return;
      }
      // Cmd+→ → move beat to next act group
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight' && sid && idx !== -1 && idx < bs.length - 1) {
        e.preventDefault();
        const newBeats = [...bs];
        [newBeats[idx], newBeats[idx + 1]] = [newBeats[idx + 1], newBeats[idx]];
        onBeatReorder?.(newBeats);
        return;
      }
      // Cmd+↓ → move beat down within group
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowDown' && sid && idx !== -1 && idx < bs.length - 1) {
        e.preventDefault();
        const newBeats = [...bs];
        [newBeats[idx], newBeats[idx + 1]] = [newBeats[idx + 1], newBeats[idx]];
        onBeatReorder?.(newBeats);
        return;
      }
      // Cmd+↑ → move beat up
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowUp' && sid && idx > 0) {
        e.preventDefault();
        const newBeats = [...bs];
        [newBeats[idx], newBeats[idx - 1]] = [newBeats[idx - 1], newBeats[idx]];
        onBeatReorder?.(newBeats);
        return;
      }
      // Escape → deselect
      if (e.key === 'Escape') {
        setSelectedBeatId(null);
        setMultiSelected(new Set());
      }
      // Select all with Cmd+A
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        setMultiSelected(new Set(bs.map(b => b.id)));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [readOnly, onAddBeat, onBeatReorder]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleBeatClick = useCallback((beat: ExtendedBeatCard) => {
    setSelectedBeatId(beat.id);
    onBeatClick?.(beat);
  }, [onBeatClick]);

  const toggleMultiSelect = useCallback((beatId: string) => {
    setMultiSelected(prev => {
      const next = new Set(prev);
      next.has(beatId) ? next.delete(beatId) : next.add(beatId);
      return next;
    });
  }, []);

  const handleBatchDelete = () => {
    multiSelected.forEach(id => onBeatDelete?.(id));
    setMultiSelected(new Set());
  };

  const handleBatchMoveRight = () => {
    const newBeats = [...beats];
    const ids = Array.from(multiSelected);
    ids.forEach(id => {
      const i = newBeats.findIndex(b => b.id === id);
      if (i !== -1 && i < newBeats.length - 1) {
        [newBeats[i], newBeats[i + 1]] = [newBeats[i + 1], newBeats[i]];
      }
    });
    onBeatReorder?.(newBeats);
  };

  const handleDuplicate = useCallback((beat: ExtendedBeatCard) => {
    const idx = beats.findIndex(b => b.id === beat.id);
    const duped: BeatCard = { ...beat, id: `${beat.id}-dup-${Date.now()}` };
    const newBeats = [...beats];
    newBeats.splice(idx + 1, 0, duped);
    onBeatReorder?.(newBeats);
  }, [beats, onBeatReorder]);

  // ── Abrupt escalation warning detection ──────────────────────────────────
  const escalationWarning = useMemo(() => {
    const tb = beats.filter(b => b.tension !== undefined);
    for (let i = 1; i < tb.length; i++) {
      if ((tb[i].tension ?? 0) - (tb[i - 1].tension ?? 0) > 4) return true;
    }
    return false;
  }, [beats]);

  // ── Room mode ─────────────────────────────────────────────────────────────
  if (roomMode) {
    return (
      <RoomModeOverlay
        beats={filteredBeats}
        currentIdx={roomIdx}
        onClose={() => setRoomMode(false)}
        onPrev={() => setRoomIdx(i => Math.max(0, i - 1))}
        onNext={() => setRoomIdx(i => Math.min(filteredBeats.length - 1, i + 1))}
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: darkMode ? '#0d0d14' : '#f5f5f5', overflow: 'hidden' }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          px: responsive.toolbarPadding,
          py: 0.75,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          bgcolor: darkMode ? 'rgba(14,14,22,0.95)' : 'rgba(255,255,255,0.9)',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: responsive.headerFontSize, color: darkMode ? 'white' : 'inherit', mr: 0.5, whiteSpace: 'nowrap' }}>
          <SceneIcon sx={{ mr: 0.5, fontSize: responsive.iconSize, verticalAlign: 'middle', color: '#7b61ff' }} />
          {!isMobile && 'BeatBoard'} <span style={{ opacity: 0.5 }}>({beats.length})</span>
        </Typography>

        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* Density toggle */}
        <Tooltip title={compact ? 'Expanded view' : 'Compact / Writers mode'}>
          <IconButton size="small" onClick={() => setCompact(c => !c)}
            sx={{ color: compact ? '#7b61ff' : 'rgba(255,255,255,0.5)' }}>
            {compact ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* View mode */}
        <Tooltip title="Grid view">
          <IconButton size="small" onClick={() => setViewMode('grid')}
            sx={{ color: viewMode === 'grid' ? '#7b61ff' : 'rgba(255,255,255,0.5)' }}>
            <GridViewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="List view">
          <IconButton size="small" onClick={() => setViewMode('list')}
            sx={{ color: viewMode === 'list' ? '#7b61ff' : 'rgba(255,255,255,0.5)' }}>
            <ListViewIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* Character arc filter */}
        <Tooltip title="Karakter Arc filter">
          <IconButton size="small"
            sx={{ color: characterFilter ? '#42a5f5' : 'rgba(255,255,255,0.5)' }}
            onClick={(e) => setCharMenuAnchor(e.currentTarget)}>
            <Badge badgeContent={characterFilter ? 1 : 0} color="primary" variant="dot">
              <CharacterIcon fontSize="small" />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Story Threads */}
        <Tooltip title="Story Threads">
          <IconButton size="small"
            sx={{ color: showThreads ? '#f59e0b' : 'rgba(255,255,255,0.5)' }}
            onClick={() => setShowThreads(s => !s)}>
            <FilterIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Dramaturgical analysis */}
        <Tooltip title="Dramaturgisk analyse (strukturregler)">
          <IconButton size="small"
            sx={{ color: showAnalysis ? '#e91e63' : 'rgba(255,255,255,0.5)' }}
            onClick={() => setShowAnalysis(s => !s)}>
            <Badge badgeContent={analysisWarnings.filter(w => w.severity !== 'info').length || 0} color="error">
              <AnalysisIcon fontSize="small" />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Room mode */}
        <Tooltip title="Room Mode (presentasjon)">
          <IconButton size="small"
            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white' } }}
            onClick={() => { setRoomMode(true); setRoomIdx(0); }}>
            <FullscreenIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        {/* Multi-select actions */}
        {multiSelected.size > 0 && !readOnly && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" sx={{ color: '#42a5f5', fontSize: '0.7rem' }}>
              {multiSelected.size} valgt
            </Typography>
            <Tooltip title="Flytt valgte til høyre (i rekkefølge)">
              <IconButton size="small" onClick={handleBatchMoveRight}
                sx={{ color: '#42a5f5' }}>
                <NextIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Slett valgte">
              <IconButton size="small" onClick={handleBatchDelete}
                sx={{ color: '#ef4444' }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}

        {!readOnly && (
          <Tooltip title="Legg til beat (Enter)">
            <IconButton size="small" onClick={onAddBeat}
              sx={{ color: '#7b61ff', border: '1px solid rgba(123,97,255,0.4)', borderRadius: 1, '&:hover': { bgcolor: 'rgba(123,97,255,0.15)' } }}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Paper>

      {/* ── Act Balance Bar ───────────────────────────────────────────────── */}
      {actsView && actBalance && (
        <Box sx={{ px: responsive.padding, pt: 0.75, pb: 0.25, display: 'flex', gap: 1.5, alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {[
            { label: 'Act I',   pct: actBalance.act1, warn: false },
            { label: 'Act II',  pct: actBalance.act2, warn: actBalance.act2 > 55 },
            { label: 'Act III', pct: actBalance.act3, warn: actBalance.act3 < 10 },
          ].map(({ label, pct, warn }) => (
            <Stack key={label} direction="row" spacing={0.5} alignItems="center">
              <Typography variant="caption"
                sx={{ fontSize: '0.65rem', color: warn ? '#f59e0b' : 'rgba(255,255,255,0.5)', fontWeight: warn ? 700 : 400 }}>
                {label}:
              </Typography>
              <Typography variant="caption"
                sx={{ fontSize: '0.65rem', color: warn ? '#f59e0b' : 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                {pct}%
              </Typography>
              {warn && <WarningIcon sx={{ fontSize: 12, color: '#f59e0b' }} />}
            </Stack>
          ))}
          {escalationWarning && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 'auto' }}>
              <WarningIcon sx={{ fontSize: 12, color: '#f59e0b' }} />
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#f59e0b' }}>
                Bratt tension-hopp
              </Typography>
            </Stack>
          )}
        </Box>
      )}

      {/* ── Story Threads panel (collapsible) ────────────────────────────── */}
      <Collapse in={showThreads}>
        <Box sx={{ px: responsive.padding, py: 1, borderBottom: '1px solid rgba(255,255,255,0.07)', bgcolor: 'rgba(0,0,0,0.2)' }}>
          <StoryThreadsSidebar
            beats={beats}
            activeThread={activeThread}
            onToggleThread={setActiveThread}
            darkMode={darkMode}
          />
        </Box>
      </Collapse>

      {/* ── Dramaturgical analysis panel (collapsible) ────────────────────── */}
      <Collapse in={showAnalysis}>
        <Box sx={{ px: responsive.padding, py: 1, borderBottom: '1px solid rgba(255,255,255,0.07)', bgcolor: 'rgba(0,0,0,0.25)', maxHeight: 220, overflow: 'auto' }}>
          <Stack spacing={0.75}>
            {analysisWarnings.map((w, i) => (
              <Alert
                key={i}
                severity={w.severity}
                icon={w.severity === 'error' ? <WarningIcon fontSize="small" /> : w.severity === 'warning' ? <WarningIcon fontSize="small" /> : <AnalysisIcon fontSize="small" />}
                sx={{ py: 0.25, px: 1.5, '& .MuiAlert-message': { fontSize: '0.72rem', py: 0 }, '& .MuiAlert-icon': { py: 0, alignItems: 'center' } }}
              >
                <strong>{w.title}:</strong> {w.description}
              </Alert>
            ))}
          </Stack>
        </Box>
      </Collapse>

      {/* ── Main beat grid ────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'auto', p: responsive.padding }}>
        {groupedBeats.map(({ label, subtitle, beats: gb, tensionValues }) => (
          <Box key={label || 'all'} sx={{ mb: responsive.spacing * 2 }}>
            {/* Act column header */}
            {actsView && label && (
              <Box sx={{ mb: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: 2, fontSize: responsive.actHeaderFontSize, color: darkMode ? 'white' : 'inherit' }}>
                      {label}
                    </Typography>
                    {subtitle && (
                      <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.62rem', letterSpacing: 1 }}>
                        {subtitle}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={100}
                      sx={{ height: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: 'rgba(123,97,255,0.4)' } }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                    {gb.length} beats
                  </Typography>
                  {/* Mini tension arc in column header */}
                  {tensionValues.length > 1 && (
                    <MiniTensionArc
                      tensions={tensionValues}
                      width={80}
                      height={24}
                      highlightWarning={escalationWarning}
                    />
                  )}
                </Stack>
              </Box>
            )}

            {gb.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 3, opacity: 0.3 }}>
                <Typography variant="caption">Ingen beats</Typography>
              </Box>
            )}

            <Box
              sx={{
                display: viewMode === 'grid' ? 'flex' : 'block',
                flexWrap: 'wrap',
                gap: responsive.gap,
                alignItems: 'flex-start',
              }}
            >
              {gb.map((beat) => {
                const isDimmed =
                  (characterFilter !== null && !beat.characters.includes(characterFilter)) ||
                  (activeThread !== null && beat.storyThread !== activeThread);
                return (
                  <BeatCardItem
                    key={beat.id}
                    beat={beat}
                    isSelected={selectedBeatId === beat.id}
                    isMultiSelected={multiSelected.has(beat.id)}
                    isDimmed={isDimmed}
                    compact={compact}
                    onClick={() => handleBeatClick(beat)}
                    onMultiSelect={() => toggleMultiSelect(beat.id)}
                    onEdit={(updates) => patchBeat(beat.id, updates)}
                    onDelete={() => onBeatDelete?.(beat.id)}
                    onDuplicate={() => handleDuplicate(beat)}
                    onToggleLock={() => patchBeat(beat.id, { locked: !beat.locked })}
                    readOnly={readOnly}
                    darkMode={darkMode}
                    responsive={responsive}
                  />
                );
              })}
            </Box>
          </Box>
        ))}

        {beats.length === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', opacity: 0.4 }}>
            <NotesIcon sx={{ fontSize: 48, mb: 2 }} />
            <Typography>Ingen scener funnet</Typography>
            <Typography variant="caption">Skriv scener i manuset for å se beat-kort her</Typography>
          </Box>
        )}
      </Box>

      {/* ── Character filter menu ─────────────────────────────────────────── */}
      <Menu
        anchorEl={charMenuAnchor}
        open={Boolean(charMenuAnchor)}
        onClose={() => setCharMenuAnchor(null)}
        PaperProps={{ sx: { bgcolor: '#1a1a2e', minWidth: 180 } }}
      >
        <MenuItem dense onClick={() => { setCharacterFilter(null); setCharMenuAnchor(null); }}
          selected={characterFilter === null}>
          <ListItemIcon><CharacterIcon sx={{ fontSize: 16 }} /></ListItemIcon>
          <ListItemText primary="Alle karakterer" primaryTypographyProps={{ fontSize: '0.78rem' }} />
        </MenuItem>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        {allCharacters.map(char => (
          <MenuItem key={char} dense onClick={() => { setCharacterFilter(char); setCharMenuAnchor(null); }}
            selected={characterFilter === char}>
            <ListItemIcon><CharacterIcon sx={{ fontSize: 16, color: '#42a5f5' }} /></ListItemIcon>
            <ListItemText primary={char} primaryTypographyProps={{ fontSize: '0.78rem' }} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default BeatBoard;
