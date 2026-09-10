import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Divider,
  Stack,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Autocomplete,
  Badge,
  Popper,
  ClickAwayListener,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Person as CharacterIcon,
  Chat as DialogueIcon,
  Movie as SceneIcon,
  Landscape as LocationIcon,
  Notes as ActionIcon,
  ArrowForward as TransitionIcon,
  FormatQuote as ParentheticalIcon,
  CenterFocusStrong as CenterIcon,
  Title as TitleIcon,
  Code as CodeIcon,
  Visibility as PreviewIcon,
  Download as ExportIcon,
  Numbers as PageIcon,
  FormatAlignCenter,
  FormatAlignLeft,
  TextFields,
  Keyboard as KeyboardIcon,
  History as HistoryIcon,
  DriveFileRenameOutline as RenameCharacterIcon,
  HelpOutline as HelpOutlineIcon,
  AddCircleOutline as AddCircleOutlineIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import settingsService, { getCurrentUserId } from '../services/settingsService';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import ScreenplayRecoveryDialog from './screenplay/ScreenplayRecoveryDialog';
import ScreenplayShortcutSettingsDialog from './screenplay/ScreenplayShortcutSettingsDialog';
import ScreenplayCharacterRenameDialog from './screenplay/ScreenplayCharacterRenameDialog';
import type { Candidate, Role } from '../models/casting';
import { TOUCH_TARGET_SIZE } from '../constants/accessibility';
import {
  SCREENPLAY_MENU_RULES,
  SCREENPLAY_SHORTCUT_COMMANDS,
  detectScreenplayPlatform,
  formatLineAsScreenplayElement,
  getNextScreenplayElement,
  getScreenplayElementRule,
  getScreenplayParagraphSeparator,
  screenplayElementFromShortcutKey,
  screenplayElementShortcutLabel,
  screenplayShortcutFromEvent,
  screenplayShortcutLabel,
  sanitizeScreenplayShortcutOverrides,
  type ScreenplayElement,
  type ScreenplayShortcutOverrides,
} from './screenplay/screenplayElementShortcuts';
import {
  addScreenplayRecoveryPoint,
  initializeScreenplayRecovery,
  persistScreenplayRecovery,
  type ScreenplayRecoveryPoint,
  type ScreenplayRecoveryStore,
} from './screenplay/screenplayRecovery';
import {
  buildCharacterRenamePreview,
  buildCharacterSmartTypeSuggestions,
  normalizeSmartTypeName,
  rankCharacterSmartTypeSuggestions,
  type ScreenplayCharacterSuggestion,
} from './screenplay/screenplaySmartType';

// 7-Tier Responsive Hook
type ScreenTier = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '4k';

const useScreenTier = (): { tier: ScreenTier; isMobile: boolean; isTablet: boolean; isDesktop: boolean; is4K: boolean } => {
  const theme = useTheme();
  const isXs = useMediaQuery('(max-width:599px)');
  const isSm = useMediaQuery('(min-width:600px) and (max-width:899px)');
  const isMd = useMediaQuery('(min-width:900px) and (max-width:1199px)');
  const isLg = useMediaQuery('(min-width:1200px) and (max-width:1535px)');
  const isXl = useMediaQuery('(min-width:1536px) and (max-width:1919px)');
  const isXxl = useMediaQuery('(min-width:1920px) and (max-width:2559px)');
  const is4K = useMediaQuery('(min-width:2560px)');

  const tier: ScreenTier = is4K ? '4k' : isXxl ? 'xxl' : isXl ? 'xl' : isLg ? 'lg' : isMd ? 'md' : isSm ? 'sm' : 'xs';
  const isMobile = tier === 'xs' || tier === 'sm';
  const isTablet = tier === 'md';
  const isDesktop = tier === 'lg' || tier === 'xl' || tier === 'xxl' || tier === '4k';

  return { tier, isMobile, isTablet, isDesktop, is4K };
};

// Get responsive values based on tier
const getResponsiveValues = (tier: ScreenTier) => {
  const values = {
    xs: { 
      fontSize: '10pt', bodyFontSize: '0.75rem', captionFontSize: '0.65rem', titleFontSize: '0.9rem',
      buttonSize: 'small' as const, iconSize: 16, spacing: 1, padding: 1, chipSize: 'small' as const,
      toolbarPadding: 0.75, lineNumberWidth: 35, editorPadding: 1, editorPl: 5
    },
    sm: { 
      fontSize: '11pt', bodyFontSize: '0.8rem', captionFontSize: '0.7rem', titleFontSize: '0.95rem',
      buttonSize: 'small' as const, iconSize: 18, spacing: 1.5, padding: 1.5, chipSize: 'small' as const,
      toolbarPadding: 1, lineNumberWidth: 40, editorPadding: 1.5, editorPl: 5.5
    },
    md: { 
      fontSize: '11pt', bodyFontSize: '0.85rem', captionFontSize: '0.75rem', titleFontSize: '1rem',
      buttonSize: 'small' as const, iconSize: 20, spacing: 1.5, padding: 1.5, chipSize: 'small' as const,
      toolbarPadding: 1.25, lineNumberWidth: 45, editorPadding: 1.5, editorPl: 6
    },
    lg: { 
      fontSize: '12pt', bodyFontSize: '0.875rem', captionFontSize: '0.75rem', titleFontSize: '1.1rem',
      buttonSize: 'small' as const, iconSize: 20, spacing: 2, padding: 2, chipSize: 'small' as const,
      toolbarPadding: 1.5, lineNumberWidth: 50, editorPadding: 2, editorPl: 7
    },
    xl: { 
      fontSize: '12pt', bodyFontSize: '0.9rem', captionFontSize: '0.8rem', titleFontSize: '1.15rem',
      buttonSize: 'medium' as const, iconSize: 22, spacing: 2, padding: 2, chipSize: 'medium' as const,
      toolbarPadding: 1.5, lineNumberWidth: 50, editorPadding: 2, editorPl: 7
    },
    xxl: { 
      fontSize: '13pt', bodyFontSize: '0.95rem', captionFontSize: '0.85rem', titleFontSize: '1.2rem',
      buttonSize: 'medium' as const, iconSize: 24, spacing: 2.5, padding: 2.5, chipSize: 'medium' as const,
      toolbarPadding: 1.75, lineNumberWidth: 55, editorPadding: 2.5, editorPl: 7.5
    },
    '4k': { 
      fontSize: '14pt', bodyFontSize: '1.1rem', captionFontSize: '0.95rem', titleFontSize: '1.4rem',
      buttonSize: 'large' as const, iconSize: 28, spacing: 3, padding: 3, chipSize: 'medium' as const,
      toolbarPadding: 2, lineNumberWidth: 60, editorPadding: 3, editorPl: 8
    },
  };
  return values[tier];
};

// Fountain element types
type FountainElement = ScreenplayElement;

interface ParsedLine {
  type: FountainElement;
  content: string;
  lineNumber: number;
  raw: string;
  metadata?: Record<string, string>;
}

export interface ScreenplayTextSelection {
  start: number;
  end: number;
  startLine: number;
  endLine: number;
  text: string;
}

interface ScreenplayEditorProps {
  value: string;
  onChange: (value: string) => void;
  manuscriptId?: string;
  cloudSaveState?: 'saved' | 'unsaved' | 'saving' | 'local-only' | 'conflict' | 'error';
  cloudSaveLabel?: string;
  characters?: string[];
  locations?: string[];
  roles?: Role[];
  candidates?: Candidate[];
  onCharacterAdd?: (name: string) => void | boolean | Promise<void | boolean>;
  onLocationAdd?: (name: string) => void | boolean | Promise<void | boolean>;
  onCharacterProfileOpen?: (payload: { characterName: string; role: Role | null; candidate: Candidate | null }) => void;
  readOnly?: boolean;
  showLineNumbers?: boolean;
  onCursorChange?: (line: number, column: number, element: FountainElement | null) => void;
  spellCheck?: boolean;
  /** Linjenumre (1-basert) som har kommentar-tråder — vises som markør i margen. */
  commentLines?: Set<number>;
  /** Klikk på en kommentar-markør i margen. */
  onCommentLineClick?: (line: number) => void;
  /** Oppdateres for både markør og tekstutvalg. */
  onSelectionChange?: (selection: ScreenplayTextSelection) => void;
  /** Google Docs-kompatibel kommentarhandling: Cmd/Ctrl+Alt+M. */
  onAddComment?: (selection: ScreenplayTextSelection) => void;
}

// Fountain syntax patterns
const SCENE_HEADING_PATTERN = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[\.\s]/i;
const FORCED_SCENE_HEADING_PATTERN = /^\./;
const CHARACTER_PATTERN = /^[A-ZÆØÅ][A-ZÆØÅ0-9\s\-'\.]*(\s*\(.*\))?$/;
const FORCED_CHARACTER_PATTERN = /^@/;
const DUAL_CHARACTER_PATTERN = /^[A-ZÆØÅ][A-ZÆØÅ0-9\s\-'\.]*(\s*\(.*\))?\s*\^$/;
const TRANSITION_PATTERN = /^[A-Z\s]+:$/;
const FORCED_TRANSITION_PATTERN = /^>/;
const SHOT_PATTERN = /^(?:SHOT|ANGLE ON|CLOSE ON|CLOSE-UP|INSERT|POV|WIDE SHOT|ESTABLISHING SHOT)(?:\s.*)?[:.]?$/i;
const CENTERED_PATTERN = /^>.*<$/;
const PARENTHETICAL_PATTERN = /^\(.*\)$/;
const SECTION_PATTERN = /^#+\s/;
const SYNOPSIS_PATTERN = /^=(?!=)/;
const PAGE_BREAK_PATTERN = /^={3,}$/;
const NOTE_PATTERN = /^\[\[.*\]\]$/;
const BONEYARD_PATTERN = /\/\*[\s\S]*?\*\//g;
const SCREENPLAY_SHORTCUT_SETTINGS_NAMESPACE = 'virtualStudio_screenplayShortcuts_v1';

// ── Autocomplete data ─────────────────────────────────────────────────────────
/** INT./EXT. prefix options shown when the user starts a new scene heading line. */
const SCENE_PREFIXES = ['INT.', 'EXT.', 'INT./EXT.', 'I/E.'] as const;

/** Industry-standard transitions shown when the user types all-caps on a line. */
const COMMON_TRANSITIONS = [
  'CUT TO:',
  'SMASH CUT TO:',
  'MATCH CUT TO:',
  'JUMP CUT TO:',
  'DISSOLVE TO:',
  'FADE OUT.',
  'FADE TO BLACK.',
  'FADE IN:',
  'WIPE TO:',
  'IRIS OUT.',
  'IRIS IN:',
] as const;

/** Returns true if `partial` (no spaces, trimmed, UPPERCASE) is a leading
 *  substring of one of the scene-heading prefixes — e.g. "I", "IN", "INT". */
const isScenePrefixPartial = (partial: string) =>
  partial.length > 0 && SCENE_PREFIXES.some(p => p.startsWith(partial));

type CaretViewportPosition = { top: number; left: number; height: number };

/**
 * Textarea exposes selection offsets, but not a caret rectangle. Mirror the
 * rendered text with the same typography and subtract the textarea scroll so
 * menus stay attached to the actual caret in long manuscripts.
 */
const getTextareaCaretViewportPosition = (
  textarea: HTMLTextAreaElement,
  position: number,
): CaretViewportPosition => {
  const textareaRect = textarea.getBoundingClientRect();
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  const marker = document.createElement('span');
  const copiedProperties = [
    'boxSizing',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontFamily',
    'fontSize',
    'fontStyle',
    'fontWeight',
    'letterSpacing',
    'lineHeight',
    'textAlign',
    'textIndent',
    'textTransform',
    'tabSize',
    'wordSpacing',
  ] as const;

  mirror.style.position = 'fixed';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.overflow = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.wordBreak = 'break-word';
  mirror.style.top = `${textareaRect.top}px`;
  mirror.style.left = `${textareaRect.left}px`;
  mirror.style.width = `${textareaRect.width}px`;

  for (const property of copiedProperties) {
    mirror.style[property] = computed[property];
  }

  mirror.textContent = textarea.value.substring(0, Math.max(0, position));
  marker.textContent = textarea.value.substring(position, position + 1) || '\u200b';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();
  const parsedLineHeight = Number.parseFloat(computed.lineHeight);
  const height = Number.isFinite(parsedLineHeight) ? parsedLineHeight : markerRect.height || 24;
  const caret = {
    top: markerRect.top - textarea.scrollTop,
    left: markerRect.left - textarea.scrollLeft,
    height,
  };

  mirror.remove();
  return caret;
};

const toTrimmedStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

const normalizeCharacterKey = (value: string): string =>
  value.replace(/^@/, '').replace(/\s*\^\s*$/, '').replace(/\s*\(.*\)\s*$/, '').trim().toUpperCase();

const AUTO_ROLE_SYNC_BLOCKLIST = new Set([
  'I',
  'IN',
  'INT',
  'INT.',
  'E',
  'EX',
  'EXT',
  'EXT.',
  'EST',
  'EST.',
  'I/E',
  'INT/EXT',
  'INT./EXT',
  'INT./EXT.',
  'INT/EXT.',
]);

const normalizeCharacterNameForRoleSync = (value: string): string =>
  value.replace(/^@/, '').replace(/\s*\^\s*$/, '').replace(/\s*\(.*\)\s*$/, '').trim();

const isValidCharacterNameForRoleSync = (value: string): boolean => {
  const cleaned = normalizeCharacterNameForRoleSync(value);
  if (!cleaned) return false;
  const upper = cleaned.toUpperCase();
  if (AUTO_ROLE_SYNC_BLOCKLIST.has(upper)) return false;
  if (SCENE_HEADING_PATTERN.test(upper)) return false;
  return true;
};

const TIME_OF_DAY_TOKENS = new Set([
  'DAY',
  'NIGHT',
  'DAWN',
  'DUSK',
  'CONTINUOUS',
  'LATER',
  'MORNING',
  'EVENING',
  'SAME',
]);

const PARTIAL_TIME_OF_DAY_TOKENS = new Set([
  'D', 'DA', 'DAW', 'DAWN', 'DU', 'DUS', 'DUSK', 'DAY',
  'N', 'NI', 'NIG', 'NIGH', 'NIGHT',
  'M', 'MO', 'MOR', 'MORN', 'MORNI', 'MORNIN', 'MORNING',
  'E', 'EV', 'EVE', 'EVEN', 'EVENI', 'EVENIN', 'EVENING',
  'L', 'LA', 'LAT', 'LATE', 'LATER',
  'C', 'CO', 'CON', 'CONT', 'CONTI', 'CONTIN', 'CONTINU', 'CONTINUO', 'CONTINUOU', 'CONTINUOUS',
  'S', 'SA', 'SAM', 'SAME',
]);

const AUTO_LOCATION_SYNC_BLOCKLIST = new Set([
  ...AUTO_ROLE_SYNC_BLOCKLIST,
  ...TIME_OF_DAY_TOKENS,
]);

const normalizeLocationNameForSync = (value: string): string => {
  let cleaned = value.replace(/\s+/g, ' ').trim();
  const partialTimeMatch = cleaned.match(/^(.*?)(?:\s*-\s*([A-ZÆØÅ]+))$/u);
  if (partialTimeMatch) {
    const base = partialTimeMatch[1]?.trim() ?? '';
    const suffix = partialTimeMatch[2]?.trim().toUpperCase() ?? '';
    if (base && PARTIAL_TIME_OF_DAY_TOKENS.has(suffix)) {
      cleaned = base;
    }
  }
  cleaned = cleaned.replace(/^[–—:;,./\s-]+|[–—:;,./\s-]+$/g, '').trim();
  return cleaned;
};

const isValidLocationNameForSync = (value: string): boolean => {
  const cleaned = normalizeLocationNameForSync(value);
  if (!cleaned) return false;
  if (!/[A-Za-zÆØÅæøå]/.test(cleaned)) return false;
  const upper = cleaned.toUpperCase();
  if (AUTO_LOCATION_SYNC_BLOCKLIST.has(upper)) return false;
  if (SCENE_HEADING_PATTERN.test(upper)) return false;
  if (/^[-–—]+$/.test(cleaned)) return false;
  return true;
};

const extractCandidateRoleIds = (candidate: Candidate): string[] => {
  const ids = new Set<string>();
  if (typeof candidate.roleId === 'string' && candidate.roleId.trim()) ids.add(candidate.roleId.trim());
  if (typeof candidate.role_id === 'string' && candidate.role_id.trim()) ids.add(candidate.role_id.trim());

  const candidateRecord = candidate as Record<string, unknown>;
  toTrimmedStringArray(candidateRecord.assignedRoles).forEach((roleId) => ids.add(roleId));
  toTrimmedStringArray(candidateRecord.assignedRoleIds).forEach((roleId) => ids.add(roleId));
  toTrimmedStringArray(candidateRecord.roleIds).forEach((roleId) => ids.add(roleId));

  return Array.from(ids);
};

const extractRoleCandidateIds = (role: Role): string[] => {
  const roleRecord = role as Record<string, unknown>;
  const ids = new Set<string>();
  toTrimmedStringArray(roleRecord.candidateIds).forEach((candidateId) => ids.add(candidateId));
  toTrimmedStringArray(roleRecord.candidate_ids).forEach((candidateId) => ids.add(candidateId));

  const directCandidateIds = [
    roleRecord.primaryCandidateId,
    roleRecord.selectedCandidateId,
    roleRecord.candidateId,
    roleRecord.candidate_id,
  ];
  directCandidateIds.forEach((candidateId) => {
    if (typeof candidateId === 'string' && candidateId.trim()) ids.add(candidateId.trim());
  });

  return Array.from(ids);
};

const candidateStatusRank = (candidate: Candidate): number => {
  const status = typeof candidate.status === 'string' ? candidate.status.toLowerCase() : '';
  if (status === 'confirmed' || status === 'booked' || status === 'cast' || status === 'hired' || status === 'offer_accepted') return 5;
  if (status === 'selected' || status === 'shortlist' || status === 'approved') return 4;
  if (status === 'callback' || status === 'in_progress') return 3;
  if (status === 'pending' || status === 'new') return 2;
  return 1;
};

const resolveCandidateProfileUrl = (candidate: Candidate): string | null => {
  const candidateRecord = candidate as Record<string, unknown>;
  const urlCandidate = [
    candidateRecord.profileUrl,
    candidateRecord.profile_url,
    candidateRecord.publicProfileUrl,
    candidateRecord.public_profile_url,
    candidateRecord.url,
  ].find((value) => typeof value === 'string' && value.trim().length > 0);

  return typeof urlCandidate === 'string' ? urlCandidate.trim() : null;
};

export const ScreenplayEditor: React.FC<ScreenplayEditorProps> = React.memo(({
  value,
  onChange,
  manuscriptId,
  cloudSaveState = 'unsaved',
  cloudSaveLabel,
  characters = [],
  locations = [],
  roles = [],
  candidates = [],
  onCharacterAdd,
  onLocationAdd,
  onCharacterProfileOpen,
  readOnly = false,
  showLineNumbers = true,
  onCursorChange,
  spellCheck = true,
  commentLines,
  onCommentLineClick,
  onSelectionChange,
  onAddComment,
}) => {
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<string[]>([value]);
  const historyIndexRef = useRef(0);
  const localRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  
  // Keep onChange ref updated
  onChangeRef.current = onChange;
  
  
  // Internal state for smooth typing - this is the source of truth for the UI
  const [internalValue, setInternalValue] = useState(value);
  const lastInternalValueRef = useRef(value);
  const recoveryValueRef = useRef(value);
  
  // Sync external value changes to internal state (but not our own changes)
  useEffect(() => {
    // Only sync if this is truly an external update (not echoing back our own change)
    if (value !== lastInternalValueRef.current) {
      // Tidligere log-spam ved hver value-prop-endring fjernet — bruk
      // React DevTools / breakpoint hvis du trenger å spore eksterne syncs.
      setInternalValue(value);
      lastInternalValueRef.current = value;
      recoveryValueRef.current = value;
      historyRef.current = [value];
      historyIndexRef.current = 0;
      pendingElementRef.current = null;
      blankChooserArmedRef.current = null;
    }
  }, [value]);
  
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [currentElement, setCurrentElement] = useState<FountainElement | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteType, setAutocompleteType] = useState<
    'character' | 'location' | 'transition' | 'scene_prefix' | null
  >(null);
  const [autocompleteOptions, setAutocompleteOptions] = useState<string[]>([]);
  const [characterAutocompleteDetails, setCharacterAutocompleteDetails] = useState<
    Record<string, ScreenplayCharacterSuggestion>
  >({});
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
  const [insertMenuAnchor, setInsertMenuAnchor] = useState<HTMLElement | null>(null);
  const [elementMenuPosition, setElementMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [elementMenuQuery, setElementMenuQuery] = useState('');
  const pendingElementRef = useRef<{ lineIndex: number; type: FountainElement } | null>(null);
  const blankChooserArmedRef = useRef<{ lineIndex: number } | null>(null);
  const [localSaveStatus, setLocalSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastLocalSaved, setLastLocalSaved] = useState<Date | null>(null);
  const [recoveryStore, setRecoveryStore] = useState<ScreenplayRecoveryStore | null>(null);
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState(false);
  const recoveryUserIdRef = useRef(getCurrentUserId());
  const lastRecoveryInputRef = useRef(value);
  const [confirmedCharacterNames, setConfirmedCharacterNames] = useState<Set<string>>(() => new Set());
  const [confirmedLocationNames, setConfirmedLocationNames] = useState<Set<string>>(() => new Set());
  const [confirmingEntity, setConfirmingEntity] = useState<string | null>(null);
  const [characterRenameDialogOpen, setCharacterRenameDialogOpen] = useState(false);
  const [characterRenameFrom, setCharacterRenameFrom] = useState('');
  const [characterRenameTo, setCharacterRenameTo] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [isPrimaryModifierHeld, setIsPrimaryModifierHeld] = useState(false);
  const [selectionCollapsed, setSelectionCollapsed] = useState(true);
  const [shortcutAnnouncement, setShortcutAnnouncement] = useState('');
  const [shortcutSettingsOpen, setShortcutSettingsOpen] = useState(false);
  const [shortcutOverrides, setShortcutOverrides] = useState<ScreenplayShortcutOverrides>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const screenplayPlatform = useMemo(() => detectScreenplayPlatform(), []);
  const filteredElementMenuRules = useMemo(() => {
    const query = elementMenuQuery.trim().toLocaleLowerCase('no-NO');
    if (!query) return SCREENPLAY_MENU_RULES;
    return SCREENPLAY_MENU_RULES.filter((rule) =>
      rule.label.toLocaleLowerCase('no-NO').startsWith(query)
      || rule.type.replace(/_/g, ' ').startsWith(query)
      || rule.menuMnemonic === query,
    );
  }, [elementMenuQuery]);

  useEffect(() => {
    let active = true;
    void settingsService
      .getSetting<ScreenplayShortcutOverrides>(SCREENPLAY_SHORTCUT_SETTINGS_NAMESPACE)
      .then((stored) => {
        if (active) setShortcutOverrides(sanitizeScreenplayShortcutOverrides(stored));
      });
    return () => {
      active = false;
    };
  }, []);

  const saveShortcutOverrides = useCallback(async (next: ScreenplayShortcutOverrides) => {
    setShortcutOverrides(next);
    await settingsService.setSetting(SCREENPLAY_SHORTCUT_SETTINGS_NAMESPACE, next);
    setShortcutSettingsOpen(false);
    setShortcutAnnouncement('Hurtigtastene er lagret.');
  }, []);

  useEffect(() => {
    if (!manuscriptId) {
      setRecoveryStore(null);
      setLastLocalSaved(null);
      return;
    }

    recoveryUserIdRef.current = getCurrentUserId();
    lastRecoveryInputRef.current = internalValue;
    try {
      const stored = initializeScreenplayRecovery(
        manuscriptId,
        recoveryUserIdRef.current,
        internalValue,
      );
      setRecoveryStore(stored);
      setLastLocalSaved(new Date(stored.draft.updatedAt));
      setLocalSaveStatus('saved');
    } catch {
      setLocalSaveStatus('error');
    }
    // A new manuscript remounts the editor in production. Only the id should
    // initialize a different local recovery namespace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manuscriptId]);

  useEffect(() => {
    recoveryValueRef.current = internalValue;
    if (!manuscriptId || readOnly || internalValue === lastRecoveryInputRef.current) return;
    if (localRecoveryTimerRef.current) clearTimeout(localRecoveryTimerRef.current);
    setLocalSaveStatus('saving');

    localRecoveryTimerRef.current = setTimeout(() => {
      try {
        const shouldPreserveExistingDraft = Boolean(
          recoveryStore
          && recoveryStore.draft.content !== lastRecoveryInputRef.current,
        );
        const stored = persistScreenplayRecovery(
          manuscriptId,
          recoveryUserIdRef.current,
          recoveryValueRef.current,
          {
            forceSnapshot: shouldPreserveExistingDraft,
            snapshotReason: 'autosave',
          },
        );
        lastRecoveryInputRef.current = recoveryValueRef.current;
        setRecoveryStore(stored);
        setLastLocalSaved(new Date(stored.draft.updatedAt));
        setLocalSaveStatus('saved');
      } catch {
        setLocalSaveStatus('error');
      } finally {
        localRecoveryTimerRef.current = null;
      }
    }, 180);

    return () => {
      if (localRecoveryTimerRef.current) clearTimeout(localRecoveryTimerRef.current);
    };
  }, [internalValue, manuscriptId, readOnly, recoveryStore]);

  useEffect(() => {
    if (!manuscriptId || readOnly) return;
    const persistBeforeUnload = () => {
      if (recoveryValueRef.current === lastRecoveryInputRef.current) return;
      try {
        persistScreenplayRecovery(
          manuscriptId,
          recoveryUserIdRef.current,
          recoveryValueRef.current,
        );
      } catch {
        // The page is closing; the visible status already communicates any
        // storage failure observed during normal editing.
      }
    };
    window.addEventListener('beforeunload', persistBeforeUnload);
    return () => window.removeEventListener('beforeunload', persistBeforeUnload);
  }, [manuscriptId, readOnly]);

  // ── One-pass Fountain parser ────────────────────────────────────────────────
  // Iterates lines exactly once. Carries forward-state in local variables so we
  // never need recursive parseLine(prevLine, null, null) calls.
  const parsedLines = useMemo((): ParsedLine[] => {
    const lines = internalValue.split('\n');
    const result: ParsedLine[] = [];

    // FSM state
    let lastNonEmptyType: FountainElement = 'action';
    let inDialogueBlock = false; // true after character / parenthetical / dialogue

    for (let i = 0; i < lines.length; i++) {
      const raw     = lines[i];
      const trimmed = raw.trim();
      const nextTrimmed = i < lines.length - 1 ? lines[i + 1].trim() : '';

      let type: FountainElement = 'action';

      if (!trimmed) {
        // Blank line breaks the dialogue block
        inDialogueBlock = false;
        type = 'action';
      } else if (NOTE_PATTERN.test(trimmed)) {
        type = 'note';
        inDialogueBlock = false;
      } else if (PAGE_BREAK_PATTERN.test(trimmed)) {
        type = 'page_break';
        inDialogueBlock = false;
      } else if (SECTION_PATTERN.test(trimmed)) {
        type = 'section';
        inDialogueBlock = false;
      } else if (SYNOPSIS_PATTERN.test(trimmed)) {
        type = 'synopsis';
        inDialogueBlock = false;
      } else if (SCENE_HEADING_PATTERN.test(trimmed) || FORCED_SCENE_HEADING_PATTERN.test(trimmed)) {
        type = 'scene_heading';
        inDialogueBlock = false;
      } else if (CENTERED_PATTERN.test(trimmed)) {
        type = 'centered';
        inDialogueBlock = false;
      } else if (SHOT_PATTERN.test(trimmed)) {
        type = 'shot';
        inDialogueBlock = false;
      } else if (FORCED_TRANSITION_PATTERN.test(trimmed) &&
                 !(CENTERED_PATTERN.test(trimmed))) { // > ... < is centered, not transition
        type = 'transition';
        inDialogueBlock = false;
      } else if (TRANSITION_PATTERN.test(trimmed) && trimmed === trimmed.toUpperCase()) {
        type = 'transition';
        inDialogueBlock = false;
      } else if (inDialogueBlock && PARENTHETICAL_PATTERN.test(trimmed)) {
        // Parenthetical inside a dialogue block
        type = 'parenthetical';
        // stays inDialogueBlock = true
      } else if (FORCED_CHARACTER_PATTERN.test(trimmed)) {
        type = 'character';
        inDialogueBlock = true;
      } else if (DUAL_CHARACTER_PATTERN.test(trimmed)) {
        type = 'character';
        inDialogueBlock = true;
      } else if (CHARACTER_PATTERN.test(trimmed)) {
        // Determine character vs. action using lookahead + preceding context
        const prevIsBlank   = i === 0 || lines[i - 1].trim() === '';
        const prevInDialog  = inDialogueBlock; // preceding line was char/paren/dialog
        const nextIsContent = !!nextTrimmed &&
          !SCENE_HEADING_PATTERN.test(nextTrimmed) &&
          !FORCED_SCENE_HEADING_PATTERN.test(nextTrimmed) &&
          !TRANSITION_PATTERN.test(nextTrimmed) &&
          !nextTrimmed.startsWith('#') &&
          !CHARACTER_PATTERN.test(nextTrimmed);

        if ((prevIsBlank || prevInDialog) && nextIsContent) {
          type = 'character';
          inDialogueBlock = true;
        } else {
          type = 'action';
          inDialogueBlock = false;
        }
      } else if (inDialogueBlock) {
        // Non-uppercase, non-parenthetical content after character — it's dialogue
        if (!CHARACTER_PATTERN.test(trimmed) && !PARENTHETICAL_PATTERN.test(trimmed)) {
          type = 'dialogue';
          // inDialogueBlock stays true
        } else {
          type = 'action';
          inDialogueBlock = false;
        }
      } else {
        type = 'action';
        inDialogueBlock = false;
      }

      if (trimmed) lastNonEmptyType = type;

      result.push({ type, content: raw, lineNumber: i + 1, raw });
    }

    return result;
  }, [internalValue]);

  // ── Memoised element-style map ──────────────────────────────────────────────
  // Rebuilt only when tier changes (not on every keystroke).
  const elementStyles = useMemo((): Record<FountainElement, React.CSSProperties> => {
    const mm = isMobile ? 0.5 : isTablet ? 0.75 : 1; // margin multiplier
    const base: React.CSSProperties = {
      fontFamily: 'Courier Prime, Courier New, monospace',
      fontSize: responsive.fontSize,
      lineHeight: '1.5',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
    };
    return {
      scene_heading: { ...base, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase',
        marginTop: `${1.5 * mm}em`, marginBottom: `${0.5 * mm}em` },
      character: { ...base, fontWeight: 600, color: '#60a5fa', textTransform: 'uppercase',
        marginLeft: isMobile ? '20%' : isTablet ? '30%' : '37%', marginTop: `${mm}em` },
      dialogue: { ...base, color: '#f5f5f5',
        marginLeft: isMobile ? '5%' : isTablet ? '12%' : '17%',
        marginRight: isMobile ? '5%' : isTablet ? '12%' : '17%' },
      parenthetical: { ...base, color: '#a78bfa', fontStyle: 'italic',
        marginLeft: isMobile ? '10%' : isTablet ? '20%' : '27%',
        marginRight: isMobile ? '10%' : isTablet ? '20%' : '27%' },
      transition: { ...base, fontWeight: 600, color: '#f472b6', textTransform: 'uppercase',
        textAlign: 'right', marginTop: `${mm}em`, marginBottom: `${mm}em` },
      shot: { ...base, fontWeight: 700, color: '#fb7185', textTransform: 'uppercase',
        marginTop: `${mm}em`, marginBottom: `${0.5 * mm}em` },
      centered:    { ...base, textAlign: 'center', color: '#34d399' },
      action:      { ...base, color: '#e5e5e5' },
      section:     { ...base, fontWeight: 700,
        fontSize: is4K ? '16pt' : isMobile ? '12pt' : '14pt',
        color: '#f97316', marginTop: `${2 * mm}em` },
      synopsis:    { ...base, fontStyle: 'italic', color: '#6b7280' },
      page_break:  { ...base, textAlign: 'center', color: '#4b5563',
        borderTop: '1px dashed #4b5563', marginTop: `${mm}em`, marginBottom: `${mm}em` },
      note:        { ...base, color: '#9ca3af', backgroundColor: 'rgba(156,163,175,0.1)' },
      title_page:  { ...base, color: '#e5e5e5' },
      boneyard:    { ...base, color: '#6b7280', fontStyle: 'italic' },
      dual_dialogue: { ...base, color: '#f5f5f5' },
    };
  }, [isMobile, isTablet, is4K, responsive.fontSize]);

  // Calculate page count (1 page ≈ 55 lines in standard screenplay format)
  const pageCount = useMemo(() => {
    const lineCount = internalValue.split('\n').length;
    return Math.ceil(lineCount / 55);
  }, [internalValue]);

  // Extract unique characters from script
  const extractedCharacters = useMemo(() => {
    const chars = new Set<string>();
    parsedLines.forEach(line => {
      if (line.type === 'character') {
        // Remove extensions like (V.O.), (O.S.), (CONT'D)
        const name = line.content.trim()
          .replace(/^@/, '')
          .replace(/\s*\^\s*$/, '')
          .replace(/\s*\(.*\)\s*$/, '')
          .trim();
        if (name) chars.add(name);
      }
    });
    return Array.from(chars).sort();
  }, [parsedLines]);

  // Extract unique locations
  const extractedLocations = useMemo(() => {
    const locs = new Set<string>();
    parsedLines.forEach(line => {
      if (line.type === 'scene_heading') {
        // Extract location from scene heading
        const match = line.content.match(/(?:INT|EXT|INT\.?\/EXT|I\/E)\.?\s*(.+?)(?:\s*-\s*(?:DAY|NIGHT|DAWN|DUSK|CONTINUOUS|LATER|MORNING|EVENING|SAME))?$/i);
        if (match && match[1]) {
          const cleaned = normalizeLocationNameForSync(match[1]);
          if (isValidLocationNameForSync(cleaned)) {
            locs.add(cleaned);
          }
        }
      }
    });
    return Array.from(locs).sort();
  }, [parsedLines]);

  // All available characters (from props + extracted)
  const allCharacters = useMemo(() => {
    return Array.from(new Set([...characters, ...extractedCharacters])).sort();
  }, [characters, extractedCharacters]);

  const roleCharacterNames = useMemo(() => {
    const names = roles
      .map((role) => (typeof role.name === 'string' ? role.name.trim() : ''))
      .filter((name) => name.length > 0);
    return Array.from(new Set(names)).sort((left, right) => left.localeCompare(right, 'no-NO'));
  }, [roles]);

  const characterSmartTypeSuggestions = useMemo(
    () => buildCharacterSmartTypeSuggestions({
      scriptCharacters: extractedCharacters,
      roleNames: roleCharacterNames,
      projectCharacters: characters,
    }),
    [characters, extractedCharacters, roleCharacterNames],
  );

  const characterMentionCandidates = useMemo(
    () => characterSmartTypeSuggestions.map((suggestion) => suggestion.value),
    [characterSmartTypeSuggestions],
  );

  // All available locations
  const allLocations = useMemo(() => {
    return Array.from(new Set([...locations, ...extractedLocations])).sort();
  }, [locations, extractedLocations]);

  type CharacterAssignment = { characterName: string; role: Role | null; candidate: Candidate | null };

  const characterAssignmentsByName = useMemo(() => {
    const assignmentMap = new Map<string, CharacterAssignment>();
    if (roles.length === 0) return assignmentMap;

    const candidateById = new Map<string, Candidate>();
    candidates.forEach((candidate) => {
      if (candidate.id) candidateById.set(candidate.id, candidate);
    });

    const candidatesByRoleId = new Map<string, Candidate[]>();
    candidates.forEach((candidate) => {
      extractCandidateRoleIds(candidate).forEach((roleId) => {
        const existing = candidatesByRoleId.get(roleId) ?? [];
        existing.push(candidate);
        candidatesByRoleId.set(roleId, existing);
      });
    });

    const pickBestCandidate = (roleCandidates: Candidate[]): Candidate | null => {
      const deduped = new Map<string, Candidate>();
      roleCandidates.forEach((candidate) => {
        if (candidate.id && !deduped.has(candidate.id)) deduped.set(candidate.id, candidate);
      });

      let bestCandidate: Candidate | null = null;
      let bestScore = -1;

      Array.from(deduped.values()).forEach((candidate) => {
        const score = candidateStatusRank(candidate);
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      });

      return bestCandidate;
    };

    roles.forEach((role) => {
      const roleNameKey = normalizeCharacterKey(role.name ?? '');
      if (!roleNameKey) return;

      const directRoleCandidates: Candidate[] = [];
      extractRoleCandidateIds(role).forEach((candidateId) => {
        const candidate = candidateById.get(candidateId);
        if (candidate) directRoleCandidates.push(candidate);
      });

      const candidatesFromRoleIds = candidatesByRoleId.get(role.id) ?? [];
      const candidate = pickBestCandidate([...directRoleCandidates, ...candidatesFromRoleIds]);

      assignmentMap.set(roleNameKey, {
        characterName: roleNameKey,
        role,
        candidate,
      });
    });

    return assignmentMap;
  }, [roles, candidates]);

  const characterAssignmentByLine = useMemo(() => {
    const assignmentByLine = new Map<number, CharacterAssignment>();
    parsedLines.forEach((line, index) => {
      if (line.type !== 'character') return;
      const characterKey = normalizeCharacterKey(line.content);
      if (!characterKey) return;
      const assignment = characterAssignmentsByName.get(characterKey);
      if (!assignment) return;
      assignmentByLine.set(index, assignment);
    });
    return assignmentByLine;
  }, [parsedLines, characterAssignmentsByName]);

  // Script-only entities stay ephemeral until the writer explicitly confirms
  // them for the project. This prevents typos from polluting roles/locations.
  const registeredCharacterNames = useMemo(() => new Set([
    ...characters.map(normalizeSmartTypeName),
    ...roleCharacterNames.map(normalizeSmartTypeName),
    ...confirmedCharacterNames,
  ]), [characters, confirmedCharacterNames, roleCharacterNames]);
  const registeredLocationNames = useMemo(() => new Set([
    ...locations.map((name) => normalizeLocationNameForSync(name).toLocaleUpperCase('nb-NO')),
    ...confirmedLocationNames,
  ]), [confirmedLocationNames, locations]);

  // ── Batched history: snapshot only after 400 ms of typing inactivity ───────
  const HISTORY_MAX = 200;
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHistoryValueRef = useRef<string | null>(null);

  function pushHistorySnapshot(nextValue: string) {
    const prev = historyRef.current.slice(0, historyIndexRef.current + 1);
    const next = [...prev, nextValue].slice(-HISTORY_MAX);
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
  }

  const flushHistory = useCallback(() => {
    const v = pendingHistoryValueRef.current;
    if (v === null) return;
    pendingHistoryValueRef.current = null;
    pushHistorySnapshot(v);
  }, []);

  // Handle text change - update internal state immediately, notify parent asynchronously
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    blankChooserArmedRef.current = null;
    let newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    const lineIndex = newValue.substring(0, cursorPos).split('\n').length - 1;
    const pendingElement = pendingElementRef.current;

    // Character and transition elements are conventionally uppercase. Preserve
    // the selected element while the first line is being typed so the editor
    // does not fall back to Action before Fountain has enough context to infer
    // the final element type.
    if (
      pendingElement?.lineIndex === lineIndex
      && (pendingElement.type === 'character' || pendingElement.type === 'transition')
    ) {
      const lineStart = newValue.lastIndexOf('\n', Math.max(0, cursorPos - 1)) + 1;
      const nextLineBreak = newValue.indexOf('\n', cursorPos);
      const lineEnd = nextLineBreak === -1 ? newValue.length : nextLineBreak;
      const upperLine = newValue.slice(lineStart, lineEnd).toUpperCase();
      newValue = `${newValue.slice(0, lineStart)}${upperLine}${newValue.slice(lineEnd)}`;
    } else if (pendingElement && pendingElement.lineIndex !== lineIndex) {
      pendingElementRef.current = null;
    }

    // Update internal state immediately for responsive typing
    setInternalValue(newValue);
    lastInternalValueRef.current = newValue; // Track this as our change

    // Notify parent asynchronously to avoid blocking the UI
    requestAnimationFrame(() => { onChangeRef.current(newValue); });

    // Batch history: debounce 400 ms so fast typing doesn't explode the stack
    pendingHistoryValueRef.current = newValue;
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(flushHistory, 400);

    // Check for autocomplete trigger
    checkAutocomplete(newValue, cursorPos);
  };

  // ── Context-aware autocomplete ──────────────────────────────────────────────
  // Reads the FSM-parsed element type of the current line (parsedLinesRef is
  // always up-to-date because it's assigned on every render before this cb is
  // called). Falls back to text-pattern heuristics for early-trigger cases
  // (e.g. the user has only typed "I" so the FSM still sees 'action').

  /** Open the suggestion popover with a given type + option list. */
  const openSuggestions = (
    type: 'character' | 'location' | 'transition' | 'scene_prefix',
    options: string[],
    characterDetails: ScreenplayCharacterSuggestion[] = [],
  ) => {
    if (!options.length) { setShowAutocomplete(false); return; }
    setAutocompleteOptions(options);
    setCharacterAutocompleteDetails(
      type === 'character'
        ? Object.fromEntries(characterDetails.map((detail) => [detail.value, detail]))
        : {},
    );
    setAutocompleteType(type);
    setShowAutocomplete(true);
    setSelectedAutocompleteIndex(0);
    updateAutocompletePosition(options.length);
  };

  const checkAutocomplete = (text: string, cursorPos: number) => {
    const lines   = text.substring(0, cursorPos).split('\n');
    const lineIdx = lines.length - 1;
    const rawLine = lines[lineIdx];
    const prevLine = lineIdx > 0 ? lines[lineIdx - 1] : '';

    // FSM-derived type for the current line (real-time via ref).
    // Cast to the full union so TS control-flow narrowing inside nested ifs
    // doesn't bleed out and flag valid comparisons below.
    const pendingType = pendingElementRef.current?.lineIndex === lineIdx
      ? pendingElementRef.current.type
      : null;
    const etype = (pendingType ?? parsedLinesRef.current[lineIdx]?.type ?? 'action') as FountainElement;

    // ── 1. SCENE_HEADING ────────────────────────────────────────────────────
    // Two sub-modes: before the prefix (prefix completion) vs after (location).
    const afterPrefixMatch = rawLine.match(
      /^(?:INT|EXT|EST|INT\.?\/EXT|I\/E)\.?\s+(.*)$/i,
    );
    const isSceneHeadingType = etype === 'scene_heading'; // bool var avoids TS narrowing bleed

    if (isSceneHeadingType || afterPrefixMatch) {
      // Location completion — user has typed the prefix + at least one space
      const partial = (afterPrefixMatch?.[1] ?? '').toUpperCase();
      const locMatches = allLocations.filter(l =>
        l.toUpperCase().startsWith(partial),
      );
      openSuggestions('location', locMatches.slice(0, 12));
      return;
    }

    // Prefix completion — user hasn't reached the space yet
    // Heuristic: all-uppercase partial on a line that follows a blank line,
    // OR when typed text is a leading substring of a known prefix.
    const trimmedUp = rawLine.trim().toUpperCase();
    const noSpaceYet = !trimmedUp.includes(' ');
    const isSceneContext =
      prevLine.trim() === '' &&
      noSpaceYet &&
      isScenePrefixPartial(trimmedUp);
    if (isSceneContext) {
      const prefixMatches = SCENE_PREFIXES.filter(p => p.startsWith(trimmedUp));
      openSuggestions('scene_prefix', [...prefixMatches]);
      return;
    }

    // ── 2. CHARACTER ────────────────────────────────────────────────────────
    const isCharContext =
      etype === 'character' ||
      (!pendingType && prevLine.trim() === '' && /^[A-ZÆØÅ][A-ZÆØÅ0-9 ]*$/.test(rawLine.trim()));
    if (isCharContext && rawLine.trim().length > 0) {
      const partial = rawLine.replace(/^@/, '').trim().toUpperCase();
      // Skip if this partial also matches a scene prefix (e.g. "INT")
      if (!isScenePrefixPartial(partial.split(' ')[0])) {
        const parsed = parsedLinesRef.current;
        let sceneStartIndex = lineIdx - 1;
        while (sceneStartIndex >= 0 && parsed[sceneStartIndex]?.type !== 'scene_heading') {
          sceneStartIndex -= 1;
        }
        const recentCharacters = parsed
          .slice(sceneStartIndex + 1, lineIdx)
          .filter((line) => line.type === 'character')
          .map((line) => normalizeSmartTypeName(line.content));
        const ranked = rankCharacterSmartTypeSuggestions({
          suggestions: characterSmartTypeSuggestions,
          partial,
          recentCharacters,
          limit: 10,
        });
        openSuggestions(
          'character',
          ranked.map((suggestion) => suggestion.value),
          ranked,
        );
        return;
      }
    }

    // ── 3. TRANSITION ───────────────────────────────────────────────────────
    // Trigger when: FSM already sees 'transition', OR the line is all-uppercase
    // letters/spaces (no digits, no parens) and at least 2 chars — user is
    // likely typing a transition before the colon appears.
    const isTransitionContext =
      etype === 'transition' ||
      (/^[A-Z][A-Z ]*$/.test(rawLine.trim()) &&
        rawLine.trim().length >= 2 &&
        // Avoid clashing with character context (blank prevLine)
        prevLine.trim() !== '');
    if (isTransitionContext) {
      const partial = rawLine.trim().toUpperCase();
      const tMatches = COMMON_TRANSITIONS.filter(t => t.startsWith(partial));
      openSuggestions('transition', [...tMatches]);
      return;
    }

    setShowAutocomplete(false);
  };

  // Update autocomplete position
  const updateAutocompletePosition = (optionCount = autocompleteOptions.length) => {
    if (!editorRef.current) return;

    const textarea = editorRef.current;
    const editorRect = textarea.parentElement?.getBoundingClientRect() ?? textarea.getBoundingClientRect();
    const caret = getTextareaCaretViewportPosition(textarea, textarea.selectionStart);
    const menuWidth = isMobile ? 150 : 200;
    const menuHeight = Math.min(isMobile ? 150 : 200, Math.max(40, optionCount * 40));
    const caretTop = caret.top - editorRect.top;
    const caretLeft = caret.left - editorRect.left;
    const hasRoomBelow = editorRect.bottom - (caret.top + caret.height) >= menuHeight + 8;
    const desiredTop = hasRoomBelow
      ? caretTop + caret.height
      : caretTop - menuHeight;

    setAutocompletePosition({
      top: Math.max(8, Math.min(desiredTop, editorRect.height - menuHeight - 8)),
      left: Math.max(8, Math.min(caretLeft, editorRect.width - menuWidth - 8)),
    });
  };

  // Apply autocomplete selection
  const applyAutocomplete = (selected: string) => {
    if (!editorRef.current) return;

    const textarea = editorRef.current;
    const { selectionStart } = textarea;
    const textBefore = internalValue.substring(0, selectionStart);
    const textAfter = internalValue.substring(selectionStart);
    const lines = textBefore.split('\n');
    const currentLine = lines[lines.length - 1];

    let newText: string;
    
    if (autocompleteType === 'character') {
      // Replace entire line with character name (all-caps)
      lines[lines.length - 1] = selected.toUpperCase();
      newText = lines.join('\n') + textAfter;
    } else if (autocompleteType === 'location') {
      // Keep the INT./EXT. prefix, replace only the location part
      const prefix =
        currentLine.match(/^((?:INT|EXT|EST|INT\.?\/EXT|I\/E)\.?\s+)/i)?.[1] ??
        currentLine.match(/^((?:INT|EXT|EST|INT\.?\/EXT|I\/E)\.?\s*)/i)?.[1] ?? '';
      lines[lines.length - 1] = prefix + selected;
      newText = lines.join('\n') + textAfter;
    } else if (autocompleteType === 'scene_prefix') {
      // Replace entire line with the prefix + trailing space (cursor ready for location)
      lines[lines.length - 1] = selected + ' ';
      newText = lines.join('\n') + textAfter;
    } else if (autocompleteType === 'transition') {
      // Replace entire line with the full transition string
      lines[lines.length - 1] = selected;
      newText = lines.join('\n') + textAfter;
    } else {
      return;
    }
    
    // Update internal state immediately
    flushHistory();
    setInternalValue(newText);
    lastInternalValueRef.current = newText;
    pushHistorySnapshot(newText);
    
    // Notify parent asynchronously
    requestAnimationFrame(() => {
      onChangeRef.current(newText);
    });
    
    setShowAutocomplete(false);
    
    // Focus back to editor
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
        const newCursorPos = lines.join('\n').length;
        editorRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // ── commitValue: apply a wholesale text replacement + place cursor ──────
  // Used by smart-key handlers so they share one consistent update path.
  const commitValue = useCallback((newText: string, newCursorPos: number) => {
    flushHistory();
    setInternalValue(newText);
    lastInternalValueRef.current = newText;
    const cursorLines = newText.substring(0, newCursorPos).split('\n');
    setCursorPosition({
      line: cursorLines.length,
      column: cursorLines[cursorLines.length - 1].length + 1,
    });
    setSelectionCollapsed(true);
    // Command-style edits (Tab/Smart Enter/autocomplete) should be immediately undoable.
    pushHistorySnapshot(newText);
    // Propagate to parent
    requestAnimationFrame(() => { onChangeRef.current(newText); });
    // Restore cursor after React re-render
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.setSelectionRange(newCursorPos, newCursorPos);
        editorRef.current.focus();
      }
    }, 0);
  }, [flushHistory]);

  const createLocalRecoveryPoint = useCallback(() => {
    if (!manuscriptId) return;
    try {
      const stored = addScreenplayRecoveryPoint(
        manuscriptId,
        recoveryUserIdRef.current,
        internalValue,
        'manual',
      );
      lastRecoveryInputRef.current = internalValue;
      setRecoveryStore(stored);
      setLastLocalSaved(new Date(stored.draft.updatedAt));
      setLocalSaveStatus('saved');
      setShortcutAnnouncement('Lokalt gjenopprettingspunkt opprettet.');
    } catch {
      setLocalSaveStatus('error');
      setShortcutAnnouncement('Kunne ikke opprette lokalt gjenopprettingspunkt.');
    }
  }, [internalValue, manuscriptId]);

  const restoreLocalRecoveryPoint = useCallback((point: ScreenplayRecoveryPoint) => {
    if (!manuscriptId || point.content === internalValue) return;
    try {
      addScreenplayRecoveryPoint(
        manuscriptId,
        recoveryUserIdRef.current,
        internalValue,
        'before_restore',
      );
      const restored = persistScreenplayRecovery(
        manuscriptId,
        recoveryUserIdRef.current,
        point.content,
      );
      lastRecoveryInputRef.current = point.content;
      setRecoveryStore(restored);
      setLastLocalSaved(new Date(restored.draft.updatedAt));
      setLocalSaveStatus('saved');
      setRecoveryDialogOpen(false);
      commitValue(point.content, 0);
      setShortcutAnnouncement('Versjonen er gjenopprettet. Teksten du hadde ble sikret først.');
    } catch {
      setLocalSaveStatus('error');
      setShortcutAnnouncement('Kunne ikke gjenopprette den lokale versjonen.');
    }
  }, [commitValue, internalValue, manuscriptId]);

  const closeElementMenu = (restoreEditorFocus = true) => {
    setInsertMenuAnchor(null);
    setElementMenuPosition(null);
    setElementMenuQuery('');
    if (restoreEditorFocus) {
      requestAnimationFrame(() => editorRef.current?.focus());
    }
  };

  const openElementMenuAtCaret = () => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const caret = getTextareaCaretViewportPosition(textarea, textarea.selectionStart);
    setInsertMenuAnchor(null);
    setElementMenuQuery('');
    setElementMenuPosition({
      top: Math.max(8, Math.min(window.innerHeight - 8, caret.top + caret.height)),
      left: Math.max(8, Math.min(window.innerWidth - 8, caret.left)),
    });
  };

  const openSmartTypeForElement = (
    type: FountainElement,
    text: string,
    cursor: number,
  ) => {
    setTimeout(() => {
      if (type === 'character') {
        openSuggestions(
          'character',
          characterSmartTypeSuggestions.map((suggestion) => suggestion.value),
          characterSmartTypeSuggestions,
        );
      } else if (type === 'transition') {
        openSuggestions('transition', [...COMMON_TRANSITIONS]);
      } else if (type === 'scene_heading') {
        checkAutocomplete(text, cursor);
      }
    }, 0);
  };

  const resolveEditorLineContext = () => {
    const textarea = editorRef.current;
    if (!textarea) return null;
    const { selectionStart, selectionEnd } = textarea;
    const lineStart = internalValue.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
    const nextBreak = internalValue.indexOf('\n', selectionStart);
    const lineEnd = nextBreak === -1 ? internalValue.length : nextBreak;
    const lineIndex = internalValue.slice(0, lineStart).split('\n').length - 1;
    const pending = pendingElementRef.current?.lineIndex === lineIndex
      ? pendingElementRef.current.type
      : null;
    return {
      selectionStart,
      selectionEnd,
      lineStart,
      lineEnd,
      lineIndex,
      rawLine: internalValue.slice(lineStart, lineEnd),
      type: pending ?? parsedLinesRef.current[lineIndex]?.type ?? 'action',
    };
  };

  const applyElementAtCursor = (type: FountainElement) => {
    const context = resolveEditorLineContext();
    if (!context) return;

    if (
      type === 'dual_dialogue'
      && context.type !== 'character'
      && context.type !== 'dual_dialogue'
    ) {
      closeElementMenu();
      setShortcutAnnouncement('Dual Dialogue kan bare brukes på en karakterlinje.');
      return;
    }

    const targetType = type === 'dual_dialogue' && /\^\s*$/.test(context.rawLine)
      ? 'character'
      : type;
    const formatted = formatLineAsScreenplayElement(context.rawLine, targetType);
    const newText = `${internalValue.slice(0, context.lineStart)}${formatted.text}${internalValue.slice(context.lineEnd)}`;
    const newCursor = context.lineStart + formatted.cursorOffset;
    pendingElementRef.current = { lineIndex: context.lineIndex, type: targetType };
    blankChooserArmedRef.current = null;
    setCurrentElement(targetType);
    setShortcutAnnouncement(
      type === 'dual_dialogue' && targetType === 'character'
        ? 'Dual Dialogue er slått av.'
        : `${getScreenplayElementRule(type).label} valgt.`,
    );
    closeElementMenu(false);

    if (newText !== internalValue) {
      commitValue(newText, newCursor);
    } else {
      requestAnimationFrame(() => {
        editorRef.current?.setSelectionRange(newCursor, newCursor);
        editorRef.current?.focus();
      });
    }
    openSmartTypeForElement(targetType, newText, newCursor);
  };

  const handleElementMenuSelect = (type: FountainElement) => {
    applyElementAtCursor(type);
  };

  const handleElementMenuKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const type = screenplayElementFromShortcutKey(event.key);
    if (type) {
      event.preventDefault();
      event.stopPropagation();
      applyElementAtCursor(type);
      return;
    }
    if (event.key === 'Backspace' && elementMenuQuery) {
      event.preventDefault();
      event.stopPropagation();
      setElementMenuQuery((query) => query.slice(0, -1));
      return;
    }
    if (
      event.key.length === 1
      && /^[A-Za-zÆØÅæøå]$/u.test(event.key)
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      setElementMenuQuery((query) => `${query}${event.key.toLocaleLowerCase('no-NO')}`);
    }
  };

  const setBlankElementType = (lineIndex: number, type: FountainElement) => {
    pendingElementRef.current = { lineIndex, type };
    blankChooserArmedRef.current = null;
    setCurrentElement(type);
    setShowAutocomplete(false);
    setShortcutAnnouncement(`${getScreenplayElementRule(type).label} valgt på tom linje.`);
    requestAnimationFrame(() => editorRef.current?.focus());
    openSmartTypeForElement(type, internalValue, editorRef.current?.selectionStart ?? 0);
  };

  const insertNextElement = (
    context: NonNullable<ReturnType<typeof resolveEditorLineContext>>,
    targetType: FountainElement,
    armChooser: boolean,
  ) => {
    const formatted = formatLineAsScreenplayElement('', targetType);
    const separator = getScreenplayParagraphSeparator(context.type, targetType);
    const insertion = `${separator}${formatted.text}`;
    const newText = `${internalValue.slice(0, context.lineEnd)}${insertion}${internalValue.slice(context.lineEnd)}`;
    const targetLineIndex = context.lineIndex + separator.length;
    const newCursor = context.lineEnd + separator.length + formatted.cursorOffset;

    pendingElementRef.current = { lineIndex: targetLineIndex, type: targetType };
    blankChooserArmedRef.current = armChooser && formatted.text.length === 0
      ? { lineIndex: targetLineIndex }
      : null;
    setCurrentElement(targetType);
    setShowAutocomplete(false);
    setShortcutAnnouncement(`${getScreenplayElementRule(targetType).label} opprettet.`);
    commitValue(newText, newCursor);
    openSmartTypeForElement(targetType, newText, newCursor);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Meta' || e.key === 'Control') {
      setIsPrimaryModifierHeld(true);
    }
    if (e.nativeEvent.isComposing || e.keyCode === 229 || e.getModifierState('AltGraph')) {
      return;
    }

    if (
      e.key.toLowerCase() === 'm'
      && (e.metaKey || e.ctrlKey)
      && e.altKey
      && !e.shiftKey
      && onAddComment
    ) {
      e.preventDefault();
      const { selectionStart, selectionEnd, value: editorValue } = e.currentTarget;
      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);
      onAddComment({
        start,
        end,
        startLine: editorValue.slice(0, start).split('\n').length,
        endLine: editorValue.slice(0, Math.max(start, end - 1)).split('\n').length,
        text: editorValue.slice(start, end),
      });
      return;
    }

    // Autocomplete navigation
    if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedAutocompleteIndex(prev => 
          Math.min(prev + 1, autocompleteOptions.length - 1)
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedAutocompleteIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        applyAutocomplete(autocompleteOptions[selectedAutocompleteIndex]);
        return;
      }
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Keep Enter as newline/flow for scene headings/locations.
        // Use Tab/click to explicitly accept those suggestions.
        if (autocompleteType === 'character' || autocompleteType === 'transition') {
          e.preventDefault();
          applyAutocomplete(autocompleteOptions[selectedAutocompleteIndex]);
          return;
        }
        setShowAutocomplete(false);
      }
      if (e.key === 'Escape') {
        setShowAutocomplete(false);
        return;
      }
    }

    const shortcutCommand = screenplayShortcutFromEvent(e, shortcutOverrides, screenplayPlatform);
    if (shortcutCommand) {
      e.preventDefault();
      applyElementAtCursor(shortcutCommand.element);
      return;
    }

    // Undo/Redo
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        flushHistory();
        if (historyIndexRef.current > 0) {
          historyIndexRef.current -= 1;
          const newValue = historyRef.current[historyIndexRef.current];
          pendingElementRef.current = null;
          blankChooserArmedRef.current = null;
          setShowAutocomplete(false);
          setInternalValue(newValue);
          lastInternalValueRef.current = newValue;
          requestAnimationFrame(() => {
            onChangeRef.current(newValue);
          });
        }
        return;
      }
      if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current += 1;
          const newValue = historyRef.current[historyIndexRef.current];
          pendingElementRef.current = null;
          blankChooserArmedRef.current = null;
          setShowAutocomplete(false);
          setInternalValue(newValue);
          lastInternalValueRef.current = newValue;
          requestAnimationFrame(() => {
            onChangeRef.current(newValue);
          });
        }
        return;
      }
    }

    if (e.key === '/' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const context = resolveEditorLineContext();
      if (context?.rawLine.trim() === '') {
        e.preventDefault();
        openElementMenuAtCaret();
        return;
      }
    }

    // ── Smart Enter ──────────────────────────────────────────────────────
    // Only intercept when no modifier keys are held (plain Enter).
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const context = resolveEditorLineContext();
      if (!context) return;
      if (context.selectionStart !== context.selectionEnd || context.selectionStart !== context.lineEnd) {
        blankChooserArmedRef.current = null;
        return;
      }

      if (
        context.rawLine.trim() === ''
        && blankChooserArmedRef.current?.lineIndex === context.lineIndex
      ) {
        e.preventDefault();
        openElementMenuAtCaret();
        return;
      }

      e.preventDefault();
      insertNextElement(
        context,
        getNextScreenplayElement(context.type, 'enter'),
        true,
      );
      return;
    }

    // ── Smart TAB (non-destructive paragraph navigation) ─────────────────
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const context = resolveEditorLineContext();
      if (!context) return;
      if (context.selectionStart !== context.selectionEnd || context.selectionStart !== context.lineEnd) {
        setShortcutAnnouncement('Ingen tekst ble endret. Tab-overganger brukes ved slutten av linjen.');
        return;
      }

      if (context.rawLine.trim() === '') {
        setBlankElementType(
          context.lineIndex,
          getNextScreenplayElement(context.type, 'tab', e.shiftKey),
        );
        return;
      }

      if (e.shiftKey) {
        setShortcutAnnouncement('Shift+Tab blar bakover bare når linjen er tom.');
        return;
      }

      insertNextElement(
        context,
        getNextScreenplayElement(context.type, 'tab'),
        false,
      );
      return;
    }
  };

  // ── Cursor tracking via stable ref callback (no reattach on every change) ──
  // parsedLinesRef is kept in sync so the handler reads the latest without
  // being listed as a dep — keeps the handler referentially stable.
  const parsedLinesRef = useRef(parsedLines);
  parsedLinesRef.current = parsedLines;
  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const internalValueRef2 = useRef(internalValue);
  internalValueRef2.current = internalValue;

  const handleCursorUpdate = useCallback(() => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    const textBefore = internalValueRef2.current.substring(0, selectionStart);
    const lines = textBefore.split('\n');
    const line   = lines.length;
    const column = lines[lines.length - 1].length + 1;
    setCursorPosition({ line, column });
    setSelectionCollapsed(selectionStart === selectionEnd);
    onSelectionChangeRef.current?.({
      start: selectionStart,
      end: selectionEnd,
      startLine: line,
      endLine: internalValueRef2.current
        .slice(0, Math.max(selectionStart, selectionEnd - 1))
        .split('\n').length,
      text: internalValueRef2.current.slice(selectionStart, selectionEnd),
    });
    const pl = parsedLinesRef.current;
    if (pl[line - 1]) {
      const pendingType = pendingElementRef.current?.lineIndex === line - 1
        ? pendingElementRef.current.type
        : null;
      const resolvedType = pendingType ?? pl[line - 1].type;
      setCurrentElement(resolvedType);
      onCursorChangeRef.current?.(line, column, resolvedType);
    }
  }, []); // empty deps — stable for the component lifetime

  const handleEditorKeyUp = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Meta' || event.key === 'Control') {
      setIsPrimaryModifierHeld(false);
    }
    handleCursorUpdate();
  }, [handleCursorUpdate]);

  const currentLineContext = useMemo(() => {
    const lineIndex = Math.max(0, cursorPosition.line - 1);
    const lines = internalValue.split('\n');
    const text = lines[lineIndex] ?? '';
    const previousLine = lineIndex > 0 ? lines[lineIndex - 1] ?? '' : '';
    const type = parsedLines[lineIndex]?.type ?? null;

    return {
      lineIndex,
      text,
      previousLine,
      type,
    };
  }, [cursorPosition.line, internalValue, parsedLines]);

  const isCharacterLineContext = useMemo(() => {
    if (currentLineContext.type === 'character') return true;
    const trimmed = currentLineContext.text.trim();
    if (!trimmed) return false;
    if (currentLineContext.previousLine.trim() !== '') return false;
    return /^[A-ZÆØÅ][A-ZÆØÅ0-9 ]*$/.test(trimmed);
  }, [currentLineContext]);

  const currentUnregisteredCharacter = useMemo(() => {
    if (!onCharacterAdd || (!isCharacterLineContext && currentElement !== 'character')) return null;
    const name = normalizeCharacterNameForRoleSync(currentLineContext.text);
    if (!isValidCharacterNameForRoleSync(name)) return null;
    const normalized = normalizeSmartTypeName(name);
    return registeredCharacterNames.has(normalized) ? null : normalized;
  }, [
    currentElement,
    currentLineContext.text,
    isCharacterLineContext,
    onCharacterAdd,
    registeredCharacterNames,
  ]);

  const currentUnregisteredLocation = useMemo(() => {
    if (!onLocationAdd || currentLineContext.type !== 'scene_heading') return null;
    const match = currentLineContext.text.match(
      /^(?:INT|EXT|EST|INT\.?\/EXT|I\/E)\.?\s+(.+?)(?:\s+-\s+(?:DAY|NIGHT|DAWN|DUSK|CONTINUOUS|LATER|MORNING|EVENING|SAME))?$/i,
    );
    const name = normalizeLocationNameForSync(match?.[1] ?? '');
    if (!isValidLocationNameForSync(name)) return null;
    const normalized = name.toLocaleUpperCase('nb-NO');
    return registeredLocationNames.has(normalized) ? null : name;
  }, [currentLineContext.text, currentLineContext.type, onLocationAdd, registeredLocationNames]);

  const renameCharacterNames = useMemo(
    () => Array.from(new Set(extractedCharacters.map(normalizeSmartTypeName)))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, 'nb-NO')),
    [extractedCharacters],
  );

  const characterRenamePreview = useMemo(() => {
    const characterLineIndexes = parsedLines
      .map((line, index) => (
        line.type === 'character' && normalizeSmartTypeName(line.content) === normalizeSmartTypeName(characterRenameFrom)
          ? index
          : -1
      ))
      .filter((index) => index >= 0);
    return buildCharacterRenamePreview({
      content: internalValue,
      oldName: characterRenameFrom,
      newName: characterRenameTo,
      characterLineIndexes,
    });
  }, [characterRenameFrom, characterRenameTo, internalValue, parsedLines]);

  const openCharacterRenameDialog = useCallback(() => {
    const currentName = currentLineContext.type === 'character'
      ? normalizeSmartTypeName(currentLineContext.text)
      : '';
    setCharacterRenameFrom(
      renameCharacterNames.includes(currentName) ? currentName : renameCharacterNames[0] ?? '',
    );
    setCharacterRenameTo('');
    setCharacterRenameDialogOpen(true);
  }, [currentLineContext.text, currentLineContext.type, renameCharacterNames]);

  const applyCharacterRename = useCallback(() => {
    if (characterRenamePreview.occurrences.length === 0) return;
    const activeLineIndex = Math.max(0, cursorPosition.line - 1);
    const nextLines = characterRenamePreview.content.split('\n');
    const nextCursor = nextLines
      .slice(0, activeLineIndex)
      .reduce((sum, line) => sum + line.length + 1, 0)
      + (nextLines[activeLineIndex]?.length ?? 0);
    commitValue(characterRenamePreview.content, nextCursor);
    setCharacterRenameDialogOpen(false);
    setShortcutAnnouncement(
      `${characterRenamePreview.oldName} ble endret til ${characterRenamePreview.newName} på ${characterRenamePreview.occurrences.length} Character-linjer.`,
    );
  }, [characterRenamePreview, commitValue, cursorPosition.line]);

  const confirmProjectEntity = useCallback(async (
    type: 'character' | 'location',
    name: string,
  ) => {
    const key = `${type}:${name}`;
    setConfirmingEntity(key);
    try {
      if (type === 'character') {
        const result = await onCharacterAdd?.(name);
        if (result === false) throw new Error('Character was not saved');
        setConfirmedCharacterNames((current) => new Set(current).add(normalizeSmartTypeName(name)));
        setShortcutAnnouncement(`${name} er lagt til som prosjektkarakter.`);
      } else {
        const result = await onLocationAdd?.(name);
        if (result === false) throw new Error('Location was not saved');
        setConfirmedLocationNames((current) => new Set(current).add(name.toLocaleUpperCase('nb-NO')));
        setShortcutAnnouncement(`${name} er lagt til som prosjektlokasjon.`);
      }
    } catch {
      setShortcutAnnouncement(`${name} kunne ikke legges til i prosjektet.`);
    } finally {
      setConfirmingEntity(null);
    }
  }, [onCharacterAdd, onLocationAdd]);

  const hasDivergentLocalDraft = Boolean(
    recoveryStore
    && recoveryStore.draft.content !== internalValue,
  );

  const keyboardStatus = useMemo(() => {
    const type = currentElement ?? currentLineContext.type ?? 'action';
    const rule = getScreenplayElementRule(type);
    const atLineEnd = selectionCollapsed
      && cursorPosition.column - 1 === currentLineContext.text.length;
    const currentShortcut = SCREENPLAY_SHORTCUT_COMMANDS.find((command) =>
      command.id !== 'general' && command.element === type,
    );

    return {
      type,
      label: rule.label,
      atLineEnd,
      enterLabel: getScreenplayElementRule(getNextScreenplayElement(type, 'enter')).label,
      tabLabel: getScreenplayElementRule(getNextScreenplayElement(type, 'tab')).label,
      shortcutLabel: currentShortcut
        ? screenplayShortcutLabel(currentShortcut.id, screenplayPlatform, shortcutOverrides)
        : '',
    };
  }, [
    currentElement,
    currentLineContext.text.length,
    currentLineContext.type,
    cursorPosition.column,
    screenplayPlatform,
    selectionCollapsed,
    shortcutOverrides,
  ]);

  const applyCharacterMentionSuggestion = useCallback((name: string) => {
    const cleanedName = name.trim();
    if (!cleanedName) return;

    const lines = internalValue.split('\n');
    if (currentLineContext.lineIndex < 0 || currentLineContext.lineIndex >= lines.length) return;

    const nextLineValue = cleanedName.toUpperCase();
    lines[currentLineContext.lineIndex] = nextLineValue;
    const newText = lines.join('\n');

    const cursorOffset =
      lines.slice(0, currentLineContext.lineIndex).reduce((sum, line) => sum + line.length + 1, 0) + nextLineValue.length;

    commitValue(newText, cursorOffset);

    const assignment = characterAssignmentsByName.get(normalizeCharacterKey(cleanedName));
    if (assignment) {
      onCharacterProfileOpen?.({
        characterName: assignment.characterName,
        role: assignment.role,
        candidate: assignment.candidate,
      });
    }
  }, [characterAssignmentsByName, commitValue, currentLineContext.lineIndex, internalValue, onCharacterProfileOpen]);

  const handleCharacterProfileOpen = useCallback((assignment: CharacterAssignment) => {
    onCharacterProfileOpen?.({
      characterName: assignment.characterName,
      role: assignment.role,
      candidate: assignment.candidate,
    });

    if (onCharacterProfileOpen) return;

    if (!assignment.candidate) return;

    const profileUrl = resolveCandidateProfileUrl(assignment.candidate);
    if (profileUrl) {
      window.open(profileUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!assignment.candidate.id) return;
    window.dispatchEvent(new CustomEvent('role-room:open-candidate-profile', {
      detail: {
        candidateId: assignment.candidate.id,
        roleId: assignment.role?.id,
        characterName: assignment.characterName,
      },
    }));
  }, [onCharacterProfileOpen]);

  // Sync scroll between textarea and highlight overlay
  const handleScroll = () => {
    if (editorRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = editorRef.current.scrollTop;
      highlightRef.current.scrollLeft = editorRef.current.scrollLeft;
      // Sync line numbers scroll
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = editorRef.current.scrollTop;
      }
      if (showAutocomplete) {
        updateAutocompletePosition();
      }
    }
  };

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const releaseModifier = (event?: KeyboardEvent) => {
      if (!event || event.key === 'Meta' || event.key === 'Control') {
        setIsPrimaryModifierHeld(false);
      }
    };
    const handleWindowBlur = () => releaseModifier();
    window.addEventListener('keyup', releaseModifier);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keyup', releaseModifier);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // Toggle fullscreen mode
  const handleFullscreenToggle = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        // WCAG 2.2 - 2.5.5 Target Size: 44×44 min for alle IconButtons
        '& .MuiIconButton-root': {
          minWidth: TOUCH_TARGET_SIZE,
          minHeight: TOUCH_TARGET_SIZE,
        },
        ...(isFullscreen && {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300,
          bgcolor: '#121212',
        }),
      }}
    >
      {/* Toolbar */}
      <Paper sx={{ p: responsive.toolbarPadding, mb: isMobile ? 0.5 : 1 }}>
        <Stack direction="row" spacing={isMobile ? 0.5 : 1} alignItems="center" flexWrap="wrap" useFlexGap>
          {/* Insert Elements */}
          <Tooltip title="Sett inn element">
            <IconButton 
              size={responsive.buttonSize}
              onClick={(e) => {
                setElementMenuQuery('');
                setElementMenuPosition(null);
                setInsertMenuAnchor(e.currentTarget);
              }}
              aria-label="Sett inn manuselement"
              sx={{ color: '#a78bfa' }}
            >
              <TextFields sx={{ fontSize: responsive.iconSize }} />
            </IconButton>
          </Tooltip>
          
          {!isMobile && <Divider orientation="vertical" flexItem />}
          
          {/* Quick Insert Buttons - Show fewer on mobile */}
          <Tooltip title="Scene Heading (INT./EXT.)">
            <IconButton size={responsive.buttonSize} onClick={() => applyElementAtCursor('scene_heading')}>
              <SceneIcon sx={{ color: '#fbbf24', fontSize: responsive.iconSize }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Character">
            <IconButton size={responsive.buttonSize} onClick={() => applyElementAtCursor('character')}>
              <CharacterIcon sx={{ color: '#60a5fa', fontSize: responsive.iconSize }} />
            </IconButton>
          </Tooltip>
          {!isMobile && (
            <>
              <Tooltip title="Dialogue">
                <IconButton size={responsive.buttonSize} onClick={() => applyElementAtCursor('dialogue')}>
                  <DialogueIcon sx={{ color: '#f5f5f5', fontSize: responsive.iconSize }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Parenthetical">
                <IconButton size={responsive.buttonSize} onClick={() => applyElementAtCursor('parenthetical')}>
                  <FormatAlignCenter sx={{ color: '#a78bfa', fontSize: responsive.iconSize }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Transition">
                <IconButton size={responsive.buttonSize} onClick={() => applyElementAtCursor('transition')}>
                  <TransitionIcon sx={{ color: '#f472b6', fontSize: responsive.iconSize }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Action">
                <IconButton size={responsive.buttonSize} onClick={() => applyElementAtCursor('action')}>
                  <ActionIcon sx={{ color: '#e5e5e5', fontSize: responsive.iconSize }} />
                </IconButton>
              </Tooltip>
            </>
          )}
          
          {!isMobile && <Divider orientation="vertical" flexItem />}
          
          {/* Undo/Redo */}
          <Tooltip title="Angre siste endring i manuset (Ctrl+Z)">
            <span>
              <IconButton 
                size={responsive.buttonSize}
                onClick={() => {
                  flushHistory();
                  if (historyIndexRef.current > 0) {
                    historyIndexRef.current -= 1;
                    const newValue = historyRef.current[historyIndexRef.current];
                    setInternalValue(newValue);
                    lastInternalValueRef.current = newValue;
                    requestAnimationFrame(() => {
                      onChangeRef.current(newValue);
                    });
                  }
                }}
                disabled={historyIndexRef.current === 0}
              >
                <UndoIcon sx={{ fontSize: responsive.iconSize }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Gjør om endringen du angret (Ctrl+Y)">
            <span>
              <IconButton 
                size={responsive.buttonSize}
                onClick={() => {
                  if (historyIndexRef.current < historyRef.current.length - 1) {
                    historyIndexRef.current += 1;
                    const newValue = historyRef.current[historyIndexRef.current];
                    setInternalValue(newValue);
                    lastInternalValueRef.current = newValue;
                    requestAnimationFrame(() => {
                      onChangeRef.current(newValue);
                    });
                  }
                }}
                disabled={historyIndexRef.current >= historyRef.current.length - 1}
              >
                <RedoIcon sx={{ fontSize: responsive.iconSize }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Tilpass hurtigtaster">
            <IconButton
              size={responsive.buttonSize}
              onClick={() => setShortcutSettingsOpen(true)}
              aria-label="Tilpass hurtigtaster for manuskript"
              sx={{ color: '#93c5fd' }}
            >
              <KeyboardIcon sx={{ fontSize: responsive.iconSize }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Endre et karakternavn i hele manuset med forhåndsvisning">
            <span>
              <IconButton
                data-testid="screenplay-character-rename-open"
                size={responsive.buttonSize}
                onClick={openCharacterRenameDialog}
                aria-label="Endre karakternavn i hele manuset"
                disabled={readOnly || renameCharacterNames.length === 0}
                sx={{ color: '#60a5fa' }}
              >
                <RenameCharacterIcon sx={{ fontSize: responsive.iconSize }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={manuscriptId ? 'Lokal gjenopprettingshistorikk' : 'Historikk krever et lagret manus'}>
            <span>
              <IconButton
                size={responsive.buttonSize}
                onClick={() => setRecoveryDialogOpen(true)}
                aria-label="Åpne lokal gjenopprettingshistorikk"
                disabled={!manuscriptId}
                sx={{ color: '#c4b5fd' }}
              >
                <Badge badgeContent={recoveryStore?.points.length ?? 0} color="secondary" max={99}>
                  <HistoryIcon sx={{ fontSize: responsive.iconSize }} />
                </Badge>
              </IconButton>
            </span>
          </Tooltip>
          
          <Box sx={{ flex: 1 }} />
          
          {/* Status - Hide some on mobile */}
          <Stack direction="row" spacing={isMobile ? 0.5 : 1} alignItems="center" flexWrap="wrap" useFlexGap>
            {currentElement && !isMobile && (
              <Chip 
                size={responsive.chipSize}
                label={getScreenplayElementRule(currentElement).label}
                sx={{ 
                  bgcolor: 'rgba(167, 139, 250, 0.2)',
                  color: '#a78bfa',
                  fontSize: responsive.captionFontSize,
                }}
              />
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: responsive.captionFontSize }}>
              L{cursorPosition.line}{!isMobile && `:C${cursorPosition.column}`}
            </Typography>
            {!isMobile && <Divider orientation="vertical" flexItem />}
            <Badge badgeContent={pageCount} color="primary" max={999}>
              <PageIcon sx={{ color: 'text.secondary', fontSize: responsive.iconSize }} />
            </Badge>
            {!isMobile && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: responsive.captionFontSize }}>
                sider
              </Typography>
            )}
            {!isMobile && <Divider orientation="vertical" flexItem />}
            
            {/* Local recovery and cloud/database sync are deliberately shown
                separately so "saved" never hides a failed remote write. */}
            {manuscriptId && (
              <Tooltip title={lastLocalSaved
                ? `Sikret i denne nettleseren ${lastLocalSaved.toLocaleTimeString('nb-NO')}`
                : 'Sikres lokalt i denne nettleseren'}>
                <Chip
                  data-testid="screenplay-local-save-status"
                  size={responsive.chipSize}
                  label={localSaveStatus === 'saving'
                    ? (isMobile ? 'Lokal…' : 'Lagrer lokalt…')
                    : localSaveStatus === 'error'
                      ? (isMobile ? 'Lokal feil' : 'Lokal lagringsfeil')
                      : hasDivergentLocalDraft
                        ? (isMobile ? 'Utkast' : 'Lokalt utkast funnet')
                        : (isMobile ? '✓ Lokal' : '✓ Lagret lokalt')}
                  onClick={() => setRecoveryDialogOpen(true)}
                  sx={{
                    bgcolor: localSaveStatus === 'error'
                      ? 'rgba(244, 63, 94, 0.2)'
                      : localSaveStatus === 'saving' || hasDivergentLocalDraft
                        ? 'rgba(251, 191, 36, 0.2)'
                        : 'rgba(52, 211, 153, 0.2)',
                    color: localSaveStatus === 'error'
                      ? '#f43f5e'
                      : localSaveStatus === 'saving' || hasDivergentLocalDraft
                        ? '#fbbf24'
                        : '#34d399',
                    fontSize: responsive.captionFontSize,
                    cursor: 'pointer',
                  }}
                />
              </Tooltip>
            )}
            <Tooltip title={cloudSaveLabel || 'Status for database-/skylagring'}>
              <Chip
                data-testid="screenplay-cloud-save-status"
                size={responsive.chipSize}
                label={cloudSaveState === 'saved'
                  ? (isMobile ? '☁ ✓' : `☁ ${cloudSaveLabel?.replace(/^Lagret/, 'Synkronisert') || 'Synkronisert'}`)
                  : cloudSaveState === 'saving'
                    ? (isMobile ? '☁ …' : '☁ Synkroniserer…')
                    : cloudSaveState === 'conflict'
                      ? (isMobile ? 'Konflikt' : `☁ ${cloudSaveLabel || 'Konflikt – velg versjon'}`)
                      : cloudSaveState === 'local-only'
                        ? (isMobile ? 'Kun lokal' : `☁ ${cloudSaveLabel || 'Venter – sikret lokalt'}`)
                    : cloudSaveState === 'error'
                      ? (isMobile ? 'Kun lokal' : '☁ Feil – sikret lokalt')
                      : (isMobile ? '☁ ○' : '☁ Ikke synkronisert')}
                sx={{
                  bgcolor: cloudSaveState === 'saved'
                    ? 'rgba(59, 130, 246, 0.18)'
                    : cloudSaveState === 'error' || cloudSaveState === 'conflict'
                      ? 'rgba(244, 63, 94, 0.2)'
                      : 'rgba(251, 191, 36, 0.2)',
                  color: cloudSaveState === 'saved'
                    ? '#93c5fd'
                    : cloudSaveState === 'error' || cloudSaveState === 'conflict'
                      ? '#fda4af'
                      : '#fbbf24',
                  fontSize: responsive.captionFontSize,
                }}
              />
            </Tooltip>
            
            {/* Online Status Indicator */}
            {!isMobile && <Divider orientation="vertical" flexItem />}
            <Tooltip title={isOnline ? 'Tilkoblet' : 'Frakoblet - arbeider offline'}>
              <Box 
                sx={{ 
                  width: isMobile ? 6 : 8, 
                  height: isMobile ? 6 : 8, 
                  borderRadius: '50%', 
                  bgcolor: isOnline ? '#34d399' : '#fbbf24',
                }}
              />
            </Tooltip>
            
            {/* Fullscreen Toggle */}
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip title={isFullscreen ? 'Avslutt fullskjerm (Esc)' : 'Fullskjerm'}>
              <IconButton 
                size={responsive.buttonSize}
                onClick={handleFullscreenToggle}
                sx={{ 
                  color: isFullscreen ? '#3b82f6' : '#6b7280',
                  '&:hover': { color: '#3b82f6', bgcolor: 'rgba(59, 130, 246, 0.1)' },
                }}
              >
                {isFullscreen ? (
                  <FullscreenExitIcon sx={{ fontSize: responsive.iconSize }} />
                ) : (
                  <FullscreenIcon sx={{ fontSize: responsive.iconSize }} />
                )}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <ScreenplayShortcutSettingsDialog
        open={shortcutSettingsOpen}
        platform={screenplayPlatform}
        overrides={shortcutOverrides}
        onClose={() => setShortcutSettingsOpen(false)}
        onSave={saveShortcutOverrides}
      />

      <ScreenplayCharacterRenameDialog
        open={characterRenameDialogOpen}
        characterNames={renameCharacterNames}
        targetSuggestions={characterSmartTypeSuggestions.map((suggestion) => suggestion.value)}
        oldName={characterRenameFrom}
        newName={characterRenameTo}
        preview={characterRenamePreview}
        onOldNameChange={setCharacterRenameFrom}
        onNewNameChange={setCharacterRenameTo}
        onClose={() => setCharacterRenameDialogOpen(false)}
        onConfirm={applyCharacterRename}
      />

      <ScreenplayRecoveryDialog
        open={recoveryDialogOpen}
        store={recoveryStore}
        currentContent={internalValue}
        onClose={() => setRecoveryDialogOpen(false)}
        onCreatePoint={createLocalRecoveryPoint}
        onRestore={restoreLocalRecoveryPoint}
      />

      {/* Insert Menu */}
      <Menu
        anchorEl={insertMenuAnchor}
        anchorReference={elementMenuPosition ? 'anchorPosition' : 'anchorEl'}
        anchorPosition={elementMenuPosition ?? undefined}
        open={Boolean(insertMenuAnchor || elementMenuPosition)}
        onClose={() => closeElementMenu()}
        MenuListProps={{
          'aria-label': 'Velg manuselement',
          onKeyDown: handleElementMenuKeyDown,
        }}
        sx={{ zIndex: 1400 }}
      >
        <MenuItem disabled dense sx={{ opacity: '1 !important' }}>
          <ListItemText
            primary={elementMenuQuery ? `Filter: ${elementMenuQuery}` : 'Skriv for å filtrere · 0–7 velger direkte'}
            primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
          />
        </MenuItem>
        <Divider />
        {filteredElementMenuRules.map((rule) => {
          const shortcut = rule.type === 'dual_dialogue'
            ? screenplayShortcutLabel('dual_dialogue', screenplayPlatform, shortcutOverrides)
            : rule.type === 'note'
              ? screenplayShortcutLabel('note', screenplayPlatform, shortcutOverrides)
              : rule.type === 'shot'
                ? screenplayElementShortcutLabel('shot', screenplayPlatform, shortcutOverrides)
                : ['scene_heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition'].includes(rule.type)
                  ? screenplayElementShortcutLabel(rule.type as 'scene_heading' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition', screenplayPlatform, shortcutOverrides)
                  : '';
          const icon = (() => {
            switch (rule.type) {
              case 'scene_heading': return <SceneIcon sx={{ color: '#fbbf24' }} />;
              case 'character': return <CharacterIcon sx={{ color: '#60a5fa' }} />;
              case 'dialogue': return <DialogueIcon />;
              case 'parenthetical': return <FormatAlignCenter sx={{ color: '#a78bfa' }} />;
              case 'transition': return <TransitionIcon sx={{ color: '#f472b6' }} />;
              case 'shot': return <SceneIcon sx={{ color: '#fb7185' }} />;
              case 'section': return <TitleIcon sx={{ color: '#f97316' }} />;
              case 'centered': return <CenterIcon sx={{ color: '#34d399' }} />;
              case 'page_break': return <PageIcon />;
              case 'note': return <CodeIcon />;
              case 'dual_dialogue': return <DialogueIcon sx={{ color: '#22d3ee' }} />;
              default: return <ActionIcon />;
            }
          })();
          return (
            <MenuItem
              key={rule.type}
              onClick={() => handleElementMenuSelect(rule.type)}
              aria-label={`${rule.label}. ${rule.accessibilityLabel}. ${rule.description}${shortcut ? `. Hurtigtast ${shortcut}` : ''}`}
            >
              <ListItemIcon>{icon}</ListItemIcon>
              <ListItemText
                primary={rule.label}
                secondary={`${rule.description}${shortcut ? ` · ${shortcut}` : ''}`}
              />
            </MenuItem>
          );
        })}
        {filteredElementMenuRules.length === 0 && (
          <MenuItem disabled>
            <ListItemText primary="Ingen manuselementer matcher" />
          </MenuItem>
        )}
      </Menu>

      {/* Editor Area */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {/* Syntax Highlighted Overlay */}
        <Box
          ref={highlightRef}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'auto',
            pointerEvents: 'none',
            bgcolor: '#0d0d0d',
            p: responsive.editorPadding,
            pl: showLineNumbers ? responsive.editorPl : responsive.editorPadding,
            pb: '300vh', // Large padding for unlimited scroll space
            fontFamily: 'Courier Prime, Courier New, monospace',
            fontSize: responsive.fontSize,
            lineHeight: '1.5',
            opacity: isEditorFocused ? 0 : 1,
          }}
        >
          {parsedLines.map((line, index) => {
            const assignment = characterAssignmentByLine.get(index);
            const clickableAssignment = !isEditorFocused ? assignment : undefined;

            return (
              <Box
                key={index}
                onMouseDown={clickableAssignment ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleCharacterProfileOpen(clickableAssignment);
                } : undefined}
                sx={{
                  ...elementStyles[line.type],
                  minHeight: '1.5em',
                  ...(clickableAssignment ? {
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    textDecoration: 'underline dotted rgba(96, 165, 250, 0.75)',
                    textUnderlineOffset: '0.16em',
                  } : {}),
                }}
                title={
                  clickableAssignment
                    ? (clickableAssignment.candidate
                        ? `Åpne rolleprofil for ${clickableAssignment.role?.name ?? clickableAssignment.characterName} (${clickableAssignment.candidate.name})`
                        : `Åpne rolleprofil for ${clickableAssignment.role?.name ?? clickableAssignment.characterName}`)
                    : undefined
                }
              >
                {line.content || '\u00A0'}
              </Box>
            );
          })}
        </Box>

        {/* Line Numbers */}
        {showLineNumbers && (
          <Box
            ref={lineNumbersRef}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: responsive.lineNumberWidth,
              height: '100%',
              overflow: 'hidden',
              bgcolor: '#0a0a0a',
              borderRight: '1px solid rgba(255,255,255,0.1)',
              pt: responsive.editorPadding,
              pb: '300vh', // Match editor padding for scroll sync
              zIndex: 1,
            }}
          >
            {parsedLines.map((_, index) => {
              const hasComment = commentLines?.has(index + 1) ?? false;
              return (
                <Typography
                  key={index}
                  component="div"
                  onClick={hasComment ? () => onCommentLineClick?.(index + 1) : undefined}
                  title={hasComment ? `Kommentar på linje ${index + 1}` : undefined}
                  sx={{
                    fontFamily: 'Courier Prime, Courier New, monospace',
                    fontSize: responsive.fontSize,
                    lineHeight: '1.5',
                    color: cursorPosition.line === index + 1 ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                    textAlign: 'right',
                    pr: isMobile ? 0.5 : 1,
                    pl: 1,
                    userSelect: 'none',
                    position: 'relative',
                    cursor: hasComment ? 'pointer' : 'default',
                  }}
                >
                  {hasComment && (
                    <Box
                      component="span"
                      aria-label={`Kommentar på linje ${index + 1}`}
                      sx={{
                        position: 'absolute',
                        left: 2,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        bgcolor: '#f59e0b',
                        boxShadow: '0 0 0 2px rgba(245,158,11,0.25)',
                      }}
                    />
                  )}
                  {index + 1}
                </Typography>
              );
            })}
          </Box>
        )}

        {/* Actual Textarea (invisible but captures input) */}
        <Box
          component="textarea"
          ref={editorRef}
          value={internalValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={handleCursorUpdate}
          onSelect={handleCursorUpdate}
          onKeyUp={handleEditorKeyUp}
          onScroll={handleScroll}
          onFocus={() => setIsEditorFocused(true)}
          onBlur={() => {
            setIsEditorFocused(false);
            setIsPrimaryModifierHeld(false);
          }}
          readOnly={readOnly}
          spellCheck={spellCheck}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            p: responsive.editorPadding,
            pl: showLineNumbers ? responsive.editorPl : responsive.editorPadding,
            pb: '300vh', // Match highlight overlay padding for scroll sync
            fontFamily: 'Courier Prime, Courier New, monospace',
            fontSize: responsive.fontSize,
            lineHeight: '1.5',
            color: isEditorFocused ? '#e5e5e5' : 'transparent',
            caretColor: '#a78bfa',
            bgcolor: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            overflow: 'auto',
            zIndex: 2,
          }}
        />

        {/* Autocomplete Dropdown */}
        {showAutocomplete && (
          <ClickAwayListener onClickAway={() => setShowAutocomplete(false)}>
            <Paper
              sx={{
                position: 'absolute',
                top: autocompletePosition.top,
                left: autocompletePosition.left,
                zIndex: 10,
                maxHeight: isMobile ? 150 : 200,
                overflow: 'auto',
                minWidth: isMobile ? 150 : 200,
              }}
            >
              {autocompleteOptions.map((option, index) => (
                <MenuItem
                  key={option}
                  selected={index === selectedAutocompleteIndex}
                  onClick={() => applyAutocomplete(option)}
                  sx={{
                    bgcolor: index === selectedAutocompleteIndex ? 'rgba(167, 139, 250, 0.2)' : 'transparent',
                    fontSize: responsive.bodyFontSize,
                    py: isMobile ? 0.5 : 1,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: isMobile ? 30 : 40 }}>
                    {autocompleteType === 'character' ? (
                      <CharacterIcon  sx={{ color: '#60a5fa', fontSize: responsive.iconSize }} />
                    ) : autocompleteType === 'location' ? (
                      <LocationIcon   sx={{ color: '#fbbf24', fontSize: responsive.iconSize }} />
                    ) : autocompleteType === 'scene_prefix' ? (
                      <SceneIcon      sx={{ color: '#fbbf24', fontSize: responsive.iconSize }} />
                    ) : (
                      <TransitionIcon sx={{ color: '#f472b6', fontSize: responsive.iconSize }} />
                    )}
                  </ListItemIcon>
                <ListItemText
                  primary={option}
                  secondary={autocompleteType === 'character'
                    ? [
                        characterAutocompleteDetails[option]?.sourceLabel,
                        characterAutocompleteDetails[option]?.reason,
                      ].filter(Boolean).join(' · ')
                    : undefined}
                  primaryTypographyProps={{ fontSize: responsive.bodyFontSize }}
                  secondaryTypographyProps={{ fontSize: responsive.captionFontSize }}
                />
                {autocompleteType === 'character' && characterAutocompleteDetails[option] && (
                  <Tooltip
                    title={`Hvorfor vises dette? ${characterAutocompleteDetails[option].sourceLabel}. ${characterAutocompleteDetails[option].reason}.`}
                  >
                    <Box
                      component="span"
                      tabIndex={0}
                      aria-label={`Hvorfor vises ${option}? ${characterAutocompleteDetails[option].sourceLabel}. ${characterAutocompleteDetails[option].reason}.`}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                        }
                      }}
                      sx={{ display: 'inline-flex', ml: 1, color: 'text.secondary' }}
                    >
                      <HelpOutlineIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                    </Box>
                  </Tooltip>
                )}
                </MenuItem>
              ))}
            </Paper>
          </ClickAwayListener>
        )}
      </Box>

      <Paper
        data-testid="screenplay-keyboard-status"
        variant="outlined"
        sx={{
          mt: isMobile ? 0.5 : 1,
          px: isMobile ? 1 : 1.5,
          py: 0.75,
          borderColor: 'rgba(167, 139, 250, 0.28)',
          bgcolor: 'rgba(12, 15, 28, 0.92)',
          overflowX: 'auto',
        }}
      >
        <Typography
          component="span"
          role="status"
          aria-live="polite"
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            p: 0,
            m: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {shortcutAnnouncement}
        </Typography>

        {isPrimaryModifierHeld && isEditorFocused ? (
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ minWidth: 'max-content' }}>
            {SCREENPLAY_SHORTCUT_COMMANDS.map((command) => (
              <Chip
                key={command.id}
                size="small"
                label={`${screenplayShortcutLabel(command.id, screenplayPlatform, shortcutOverrides)} ${command.label}`}
                sx={{
                  height: 24,
                  color: '#dbeafe',
                  bgcolor: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(96, 165, 250, 0.28)',
                  fontSize: responsive.captionFontSize,
                }}
              />
            ))}
          </Stack>
        ) : (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
          >
            <Typography sx={{ color: '#c4b5fd', fontWeight: 700, fontSize: responsive.captionFontSize }}>
              {keyboardStatus.label}
            </Typography>
            {keyboardStatus.atLineEnd ? (
              <>
                <Typography sx={{ color: 'text.secondary', fontSize: responsive.captionFontSize }}>
                  Enter: {keyboardStatus.enterLabel}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: responsive.captionFontSize }}>
                  Tab: {keyboardStatus.tabLabel}
                </Typography>
              </>
            ) : (
              <Typography sx={{ color: 'text.secondary', fontSize: responsive.captionFontSize }}>
                Klar – Enter/Tab-flyt aktiveres ved slutten av linjen
              </Typography>
            )}
            {keyboardStatus.shortcutLabel && (
              <Typography sx={{ color: '#93c5fd', fontSize: responsive.captionFontSize }}>
                {keyboardStatus.shortcutLabel}: {keyboardStatus.label}
              </Typography>
            )}
            {!isMobile && (
              <Typography sx={{ ml: 'auto !important', color: 'text.disabled', fontSize: responsive.captionFontSize }}>
                Hold {screenplayPlatform === 'mac' ? '⌘' : 'Ctrl'} for alle hurtigtaster
              </Typography>
            )}
          </Stack>
        )}
      </Paper>

      {!readOnly && (isCharacterLineContext || currentUnregisteredCharacter || currentUnregisteredLocation) && (
        <Stack sx={{ px: responsive.padding, pt: 1 }} spacing={1} alignItems="flex-start">
          {isCharacterLineContext && (
            <GlobalMentionHelper
              text={currentLineContext.text}
              localCandidates={characterMentionCandidates}
              onApplySuggestion={applyCharacterMentionSuggestion}
              autoTagTitle="Karakter i prosjektet"
              suggestionTitle="Mener du denne karakteren?"
              candidateScope="local"
            />
          )}
          {currentUnregisteredCharacter && (
            <Chip
              icon={<AddCircleOutlineIcon />}
              color="warning"
              variant="outlined"
              label={confirmingEntity === `character:${currentUnregisteredCharacter}`
                ? `Legger til ${currentUnregisteredCharacter}…`
                : `Legg ${currentUnregisteredCharacter} til som prosjektkarakter`}
              disabled={confirmingEntity !== null}
              onClick={() => void confirmProjectEntity('character', currentUnregisteredCharacter)}
              aria-label={`Legg ${currentUnregisteredCharacter} til som prosjektkarakter`}
            />
          )}
          {currentUnregisteredLocation && (
            <Chip
              icon={<AddCircleOutlineIcon />}
              color="warning"
              variant="outlined"
              label={confirmingEntity === `location:${currentUnregisteredLocation}`
                ? `Legger til ${currentUnregisteredLocation}…`
                : `Legg ${currentUnregisteredLocation} til som prosjektlokasjon`}
              disabled={confirmingEntity !== null}
              onClick={() => void confirmProjectEntity('location', currentUnregisteredLocation)}
              aria-label={`Legg ${currentUnregisteredLocation} til som prosjektlokasjon`}
            />
          )}
        </Stack>
      )}

      {/* Stats Footer */}
      <Paper sx={{ p: isMobile ? 0.75 : 1, mt: isMobile ? 0.5 : 1 }}>
        <Stack 
          direction={isMobile ? 'column' : 'row'} 
          spacing={isMobile ? 0.5 : 2} 
          alignItems={isMobile ? 'stretch' : 'center'} 
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={isMobile ? 1 : 2} flexWrap="wrap" useFlexGap>
            <Chip
              icon={<CharacterIcon sx={{ fontSize: responsive.iconSize }} />}
              label={`${allCharacters.length}${isMobile ? '' : ' karakterer'}`}
              size={responsive.chipSize}
              variant="outlined"
              sx={{ fontSize: responsive.captionFontSize }}
            />
            <Chip
              icon={<LocationIcon sx={{ fontSize: responsive.iconSize }} />}
              label={`${allLocations.length}${isMobile ? '' : ' lokasjoner'}`}
              size={responsive.chipSize}
              variant="outlined"
              sx={{ fontSize: responsive.captionFontSize }}
            />
            <Chip
              icon={<SceneIcon sx={{ fontSize: responsive.iconSize }} />}
              label={`${parsedLines.filter(l => l.type === 'scene_heading').length}${isMobile ? '' : ' scener'}`}
              size={responsive.chipSize}
              variant="outlined"
              sx={{ fontSize: responsive.captionFontSize }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: responsive.captionFontSize, textAlign: isMobile ? 'center' : 'right' }}>
            {value.length} tegn • {value.split(/\s+/).filter(w => w).length} ord
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
});

ScreenplayEditor.displayName = 'ScreenplayEditor';

export default ScreenplayEditor;
