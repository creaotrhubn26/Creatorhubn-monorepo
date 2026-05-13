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
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import settingsService from '../services/settingsService';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import type { Candidate, Role } from '../models/casting';
import { TOUCH_TARGET_SIZE } from '../constants/accessibility';

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
type FountainElement = 
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'centered'
  | 'title_page'
  | 'section'
  | 'synopsis'
  | 'note'
  | 'boneyard'
  | 'page_break'
  | 'dual_dialogue';

interface ParsedLine {
  type: FountainElement;
  content: string;
  lineNumber: number;
  raw: string;
  metadata?: Record<string, string>;
}

interface ScreenplayEditorProps {
  value: string;
  onChange: (value: string) => void;
  characters?: string[];
  locations?: string[];
  roles?: Role[];
  candidates?: Candidate[];
  onCharacterAdd?: (name: string) => void;
  onLocationAdd?: (name: string) => void;
  onCharacterProfileOpen?: (payload: { characterName: string; role: Role | null; candidate: Candidate | null }) => void;
  readOnly?: boolean;
  showLineNumbers?: boolean;
  onCursorChange?: (line: number, column: number, element: FountainElement | null) => void;
  spellCheck?: boolean;
}

// Fountain syntax patterns
const SCENE_HEADING_PATTERN = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[\.\s]/i;
const FORCED_SCENE_HEADING_PATTERN = /^\./;
const CHARACTER_PATTERN = /^[A-ZÆØÅ][A-ZÆØÅ0-9\s\-'\.]*(\s*\(.*\))?$/;
const FORCED_CHARACTER_PATTERN = /^@/;
const TRANSITION_PATTERN = /^[A-Z\s]+:$/;
const FORCED_TRANSITION_PATTERN = /^>/;
const CENTERED_PATTERN = /^>.*<$/;
const PARENTHETICAL_PATTERN = /^\(.*\)$/;
const SECTION_PATTERN = /^#+\s/;
const SYNOPSIS_PATTERN = /^=(?!=)/;
const PAGE_BREAK_PATTERN = /^={3,}$/;
const NOTE_PATTERN = /\[\[.*?\]\]/g;
const BONEYARD_PATTERN = /\/\*[\s\S]*?\*\//g;

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

const toTrimmedStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

const normalizeCharacterKey = (value: string): string =>
  value.replace(/^@/, '').replace(/\s*\(.*\)\s*$/, '').trim().toUpperCase();

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
  value.replace(/^@/, '').replace(/\s*\(.*\)\s*$/, '').trim();

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

// ── Element-cycle order (TAB forward, SHIFT+TAB backward) ─────────────────
// The cycle mirrors Final Draft's Tab behaviour in the most common flow:
//   action → character → parenthetical → dialogue → action
const TAB_FORWARD: Partial<Record<FountainElement, FountainElement>> = {
  action:        'character',
  character:     'parenthetical',
  parenthetical: 'dialogue',
  dialogue:      'action',
  scene_heading: 'action',
  transition:    'action',
  centered:      'action',
  section:       'action',
  synopsis:      'action',
};
const TAB_BACKWARD: Partial<Record<FountainElement, FountainElement>> = {
  character:     'action',
  parenthetical: 'character',
  dialogue:      'parenthetical',
  action:        'dialogue',
};

/**
 * Rewrites a raw line string so it is formatted as `targetType`.
 * Pure function — no side-effects, fully testable.
 */
function convertLineToElement(
  raw: string,
  _from: FountainElement,
  to: FountainElement,
): string {
  // Strip any Fountain force-prefixes to get the naked content
  const content = raw
    .replace(/^@/, '')       // forced character
    .replace(/^[.>]/, '')    // forced scene / transition
    .replace(/^\(|\)$/g, '') // parenthetical parens
    .trim();

  switch (to) {
    case 'character':
      // All-caps; preserve existing extension like (V.O.) if already present in raw
      return raw.trim().startsWith('@')
        ? raw.trim()   // already forced — leave as-is
        : content.toUpperCase();
    case 'parenthetical':
      return content ? `(${content.toLowerCase()})` : '()';
    case 'dialogue':
      // Remove parens wrapper if coming from parenthetical, keep content as-is otherwise
      return content;
    case 'scene_heading':
      return content
        ? `INT. ${content.toUpperCase()} - DAY`
        : 'INT. LOCATION - DAY';
    case 'action':
    default:
      return content;
  }
}

export const ScreenplayEditor: React.FC<ScreenplayEditorProps> = React.memo(({
  value,
  onChange,
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
}) => {
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<string[]>([value]);
  const historyIndexRef = useRef(0);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  
  // Refs for isolated auto-save - NO state updates from auto-save
  const savePendingRef = useRef(false);
  const lastSavedContentRef = useRef('');
  const isMountedRef = useRef(true);
  
  // Keep onChange ref updated
  onChangeRef.current = onChange;
  
  
  // Internal state for smooth typing - this is the source of truth for the UI
  const [internalValue, setInternalValue] = useState(value);
  const lastInternalValueRef = useRef(value);
  
  // Sync external value changes to internal state (but not our own changes)
  useEffect(() => {
    // Only sync if this is truly an external update (not echoing back our own change)
    if (value !== lastInternalValueRef.current) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔄 ScreenplayEditor SYNCING - value changed from external source');
      }
      setInternalValue(value);
      lastInternalValueRef.current = value;
      historyRef.current = [value];
      historyIndexRef.current = 0;
    }
  }, [value]);
  
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [currentElement, setCurrentElement] = useState<FountainElement | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteType, setAutocompleteType] = useState<
    'character' | 'location' | 'transition' | 'scene_prefix' | null
  >(null);
  const [autocompleteOptions, setAutocompleteOptions] = useState<string[]>([]);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
  const [insertMenuAnchor, setInsertMenuAnchor] = useState<HTMLElement | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Sync extracted characters to parent via callback (stable + filtered)
  const existingCharacterNamesRef = useRef<Set<string>>(new Set());
  const emittedCharacterNamesRef = useRef<Set<string>>(new Set());
  const pendingCharacterAddsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const AUTO_ROLE_SYNC_DELAY_MS = 900;

  useEffect(() => {
    existingCharacterNamesRef.current = new Set(characters.map((name) => normalizeCharacterKey(name)));
  }, [characters]);

  useEffect(() => {
    return () => {
      pendingCharacterAddsRef.current.forEach((timerId) => clearTimeout(timerId));
      pendingCharacterAddsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!onCharacterAdd) return;

    const extractedByUpper = new Map<string, string>();
    extractedCharacters.forEach((characterName) => {
      if (!isValidCharacterNameForRoleSync(characterName)) return;
      const cleaned = normalizeCharacterNameForRoleSync(characterName);
      const upper = cleaned.toUpperCase();
      if (!extractedByUpper.has(upper)) extractedByUpper.set(upper, cleaned);
    });

    // Cancel pending timers for names that are no longer present.
    pendingCharacterAddsRef.current.forEach((timerId, upper) => {
      if (!extractedByUpper.has(upper)) {
        clearTimeout(timerId);
        pendingCharacterAddsRef.current.delete(upper);
      }
    });

    extractedByUpper.forEach((displayName, upper) => {
      if (existingCharacterNamesRef.current.has(upper)) {
        emittedCharacterNamesRef.current.add(upper);
        return;
      }
      if (emittedCharacterNamesRef.current.has(upper)) return;
      if (pendingCharacterAddsRef.current.has(upper)) return;

      const timerId = setTimeout(() => {
        pendingCharacterAddsRef.current.delete(upper);

        if (existingCharacterNamesRef.current.has(upper)) {
          emittedCharacterNamesRef.current.add(upper);
          return;
        }
        if (emittedCharacterNamesRef.current.has(upper)) return;

        emittedCharacterNamesRef.current.add(upper);
        onCharacterAdd(displayName);
      }, AUTO_ROLE_SYNC_DELAY_MS);

      pendingCharacterAddsRef.current.set(upper, timerId);
    });
  }, [extractedCharacters, onCharacterAdd]);

  // Sync extracted locations to parent via callback (stable + filtered)
  const existingLocationNamesRef = useRef<Set<string>>(new Set());
  const emittedLocationNamesRef = useRef<Set<string>>(new Set());
  const pendingLocationAddsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const AUTO_LOCATION_SYNC_DELAY_MS = 1200;

  useEffect(() => {
    existingLocationNamesRef.current = new Set(
      locations.map((name) => normalizeLocationNameForSync(name).toUpperCase()).filter(Boolean),
    );
  }, [locations]);

  useEffect(() => {
    return () => {
      pendingLocationAddsRef.current.forEach((timerId) => clearTimeout(timerId));
      pendingLocationAddsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!onLocationAdd) return;

    const extractedByUpper = new Map<string, string>();
    extractedLocations.forEach((locationName) => {
      if (!isValidLocationNameForSync(locationName)) return;
      const cleaned = normalizeLocationNameForSync(locationName);
      const upper = cleaned.toUpperCase();
      if (!extractedByUpper.has(upper)) extractedByUpper.set(upper, cleaned);
    });

    pendingLocationAddsRef.current.forEach((timerId, upper) => {
      if (!extractedByUpper.has(upper)) {
        clearTimeout(timerId);
        pendingLocationAddsRef.current.delete(upper);
      }
    });

    extractedByUpper.forEach((displayName, upper) => {
      if (existingLocationNamesRef.current.has(upper)) {
        emittedLocationNamesRef.current.add(upper);
        return;
      }
      if (emittedLocationNamesRef.current.has(upper)) return;
      if (pendingLocationAddsRef.current.has(upper)) return;

      const timerId = setTimeout(() => {
        pendingLocationAddsRef.current.delete(upper);

        if (existingLocationNamesRef.current.has(upper)) {
          emittedLocationNamesRef.current.add(upper);
          return;
        }
        if (emittedLocationNamesRef.current.has(upper)) return;

        emittedLocationNamesRef.current.add(upper);
        onLocationAdd(displayName);
      }, AUTO_LOCATION_SYNC_DELAY_MS);

      pendingLocationAddsRef.current.set(upper, timerId);
    });
  }, [extractedLocations, onLocationAdd]);

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
    const newValue = e.target.value;

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
    checkAutocomplete(newValue, e.target.selectionStart);
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
  ) => {
    if (!options.length) { setShowAutocomplete(false); return; }
    setAutocompleteOptions(options);
    setAutocompleteType(type);
    setShowAutocomplete(true);
    setSelectedAutocompleteIndex(0);
    updateAutocompletePosition();
  };

  const checkAutocomplete = (text: string, cursorPos: number) => {
    const lines   = text.substring(0, cursorPos).split('\n');
    const lineIdx = lines.length - 1;
    const rawLine = lines[lineIdx];
    const prevLine = lineIdx > 0 ? lines[lineIdx - 1] : '';

    // FSM-derived type for the current line (real-time via ref).
    // Cast to the full union so TS control-flow narrowing inside nested ifs
    // doesn't bleed out and flag valid comparisons below.
    const etype = (parsedLinesRef.current[lineIdx]?.type ?? 'action') as FountainElement;

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
      (prevLine.trim() === '' && /^[A-ZÆØÅ][A-ZÆØÅ0-9 ]*$/.test(rawLine.trim()));
    if (isCharContext && rawLine.trim().length > 0) {
      const partial = rawLine.replace(/^@/, '').trim().toUpperCase();
      // Skip if this partial also matches a scene prefix (e.g. "INT")
      if (!isScenePrefixPartial(partial.split(' ')[0])) {
        const charMatches = allCharacters.filter(c =>
          c.toUpperCase().startsWith(partial),
        );
        openSuggestions('character', charMatches.slice(0, 10));
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
  const updateAutocompletePosition = () => {
    if (!editorRef.current) return;
    
    const textarea = editorRef.current;
    const { selectionStart } = textarea;
    const textBefore = internalValue.substring(0, selectionStart);
    const lines = textBefore.split('\n');
    const lineNumber = lines.length;
    const charInLine = lines[lines.length - 1].length;
    
    // Approximate position (would need more precise calculation in production)
    const lineHeight = 24; // px
    const charWidth = 9.6; // px for monospace
    
    setAutocompletePosition({
      top: lineNumber * lineHeight + 60, // offset for toolbar
      left: charInLine * charWidth + (showLineNumbers ? 50 : 0),
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

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      if (e.key === 'Tab') {
        e.preventDefault();
        applyAutocomplete(autocompleteOptions[selectedAutocompleteIndex]);
        return;
      }
      if (e.key === 'Enter') {
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
    
    // Undo/Redo
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
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
        return;
      }
      if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current += 1;
          const newValue = historyRef.current[historyIndexRef.current];
          setInternalValue(newValue);
          lastInternalValueRef.current = newValue;
          requestAnimationFrame(() => {
            onChangeRef.current(newValue);
          });
        }
        return;
      }
    }
    
    // ── Smart Enter ──────────────────────────────────────────────────────
    // Only intercept when no modifier keys are held (plain Enter).
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      if (!editorRef.current) return;
      const ta   = editorRef.current;
      const sel  = ta.selectionStart;
      const after = internalValue.substring(ta.selectionEnd);
      const before = internalValue.substring(0, sel);
      const lines  = before.split('\n');
      const lineIdx = lines.length - 1;
      const parsed  = parsedLinesRef.current[lineIdx];
      const etype   = parsed?.type;

      if (etype === 'scene_heading') {
        // After a scene heading Enter → blank separator line, cursor on action line
        // Prevents the next ALL-CAPS word from accidentally being parsed as character.
        e.preventDefault();
        commitValue(before + '\n\n' + after, sel + 2);
        return;
      }

      if (etype === 'character' && lines[lineIdx].trim() === '') {
        // Pressing Enter on an empty character line cancels back to action
        e.preventDefault();
        commitValue(before + '\n' + after, sel + 1);
        return;
      }

      if (etype === 'transition') {
        // After a transition → blank line so next line is clearly action
        e.preventDefault();
        commitValue(before + '\n\n' + after, sel + 2);
        return;
      }
      // All other element types: let the browser insert the newline normally.
    }

    // ── Smart TAB (element cycling) ──────────────────────────────────────
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!editorRef.current) return;
      const ta     = editorRef.current;
      const sel    = ta.selectionStart;
      const selEnd = ta.selectionEnd;
      const before = internalValue.substring(0, sel);
      const after  = internalValue.substring(selEnd);
      const lines  = before.split('\n');
      const lineIdx = lines.length - 1;
      const rawLine = lines[lineIdx];
      const parsed  = parsedLinesRef.current[lineIdx];
      const etype   = parsed?.type ?? 'action';

      const targetType = e.shiftKey
        ? (TAB_BACKWARD[etype] ?? 'action')
        : (TAB_FORWARD[etype]  ?? 'character');

      const newLine = convertLineToElement(rawLine, etype, targetType);
      lines[lineIdx] = newLine;
      const newBefore = lines.join('\n');
      commitValue(newBefore + after, newBefore.length);
      return;
    }
  };

  // Insert text at cursor
  const insertAtCursor = (text: string) => {
    if (!editorRef.current) return;
    
    const textarea = editorRef.current;
    const { selectionStart, selectionEnd } = textarea;
    const newValue = internalValue.substring(0, selectionStart) + text + internalValue.substring(selectionEnd);
    
    // Update internal state immediately
    setInternalValue(newValue);
    lastInternalValueRef.current = newValue;
    pushHistorySnapshot(newValue);
    
    // Notify parent asynchronously
    requestAnimationFrame(() => {
      onChangeRef.current(newValue);
    });
    
    // Set cursor position after inserted text
    setTimeout(() => {
      if (editorRef.current) {
        const newPos = selectionStart + text.length;
        editorRef.current.setSelectionRange(newPos, newPos);
        editorRef.current.focus();
      }
    }, 0);
  };

  // ── commitValue: apply a wholesale text replacement + place cursor ──────
  // Used by smart-key handlers so they share one consistent update path.
  const commitValue = useCallback((newText: string, newCursorPos: number) => {
    setInternalValue(newText);
    lastInternalValueRef.current = newText;
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
  }, []);

  // Insert screenplay element
  const insertElement = (type: FountainElement) => {
    let template = '';
    
    switch (type) {
      case 'scene_heading':
        template = '\n\nINT. LOCATION - DAY\n\n';
        break;
      case 'character':
        template = '\n\nCHARACTER NAME\n';
        break;
      case 'dialogue':
        template = 'Dialogue text here.\n';
        break;
      case 'parenthetical':
        template = '(beat)\n';
        break;
      case 'transition':
        template = '\n\nCUT TO:\n\n';
        break;
      case 'centered':
        template = '\n>CENTERED TEXT<\n\n';
        break;
      case 'action':
        template = '\n\nAction description here.\n';
        break;
      case 'page_break':
        template = '\n\n===\n\n';
        break;
      case 'section':
        template = '\n\n# ACT ONE\n\n';
        break;
      case 'note':
        template = '[[Note: ]]';
        break;
    }
    
    insertAtCursor(template);
    setInsertMenuAnchor(null);
  };

  // ── Cursor tracking via stable ref callback (no reattach on every change) ──
  // parsedLinesRef is kept in sync so the handler reads the latest without
  // being listed as a dep — keeps the handler referentially stable.
  const parsedLinesRef = useRef(parsedLines);
  parsedLinesRef.current = parsedLines;
  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;
  const internalValueRef2 = useRef(internalValue);
  internalValueRef2.current = internalValue;

  const handleCursorUpdate = useCallback(() => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const { selectionStart } = textarea;
    const textBefore = internalValueRef2.current.substring(0, selectionStart);
    const lines = textBefore.split('\n');
    const line   = lines.length;
    const column = lines[lines.length - 1].length + 1;
    setCursorPosition({ line, column });
    const pl = parsedLinesRef.current;
    if (pl[line - 1]) {
      setCurrentElement(pl[line - 1].type);
      onCursorChangeRef.current?.(line, column, pl[line - 1].type);
    }
  }, []); // empty deps — stable for the component lifetime

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
    }
  };

  // Element type labels
  const elementLabels: Record<FountainElement, string> = {
    scene_heading: 'Scene Heading',
    action: 'Action',
    character: 'Character',
    dialogue: 'Dialogue',
    parenthetical: 'Parenthetical',
    transition: 'Transition',
    centered: 'Centered',
    title_page: 'Title Page',
    section: 'Section',
    synopsis: 'Synopsis',
    note: 'Note',
    boneyard: 'Boneyard',
    page_break: 'Page Break',
    dual_dialogue: 'Dual Dialogue',
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Isolated auto-save to settings cache - NO state updates, side-effect only
  useEffect(() => {
    // Clear any pending auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set up new auto-save timer (save after 2 seconds of inactivity)
    // This effect runs on content changes but only debounces the save, no state updates
    autoSaveTimerRef.current = setTimeout(() => {
      // Check if component still mounted and content actually changed
      if (!isMountedRef.current || internalValue === lastSavedContentRef.current) {
        return;
      }
      
      // Save to settings cache without any state updates - purely side-effect
      try {
        void settingsService.setSetting('virtualStudio_screenplayAutosave', {
          content: internalValue,
          timestamp: new Date().toISOString(),
        });
        lastSavedContentRef.current = internalValue;
        // Do NOT call setSaveStatus - let UI be independent of auto-save
      } catch (error) {
        console.error('Error during auto-save to settings cache:', error);
        // Silently fail - don't affect UI state
      }
    }, 2000);
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [internalValue]); // Watch internalValue, not the prop

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
              onClick={(e) => setInsertMenuAnchor(e.currentTarget)}
              sx={{ color: '#a78bfa' }}
            >
              <TextFields sx={{ fontSize: responsive.iconSize }} />
            </IconButton>
          </Tooltip>
          
          {!isMobile && <Divider orientation="vertical" flexItem />}
          
          {/* Quick Insert Buttons - Show fewer on mobile */}
          <Tooltip title="Scene Heading (INT./EXT.)">
            <IconButton size={responsive.buttonSize} onClick={() => insertElement('scene_heading')}>
              <SceneIcon sx={{ color: '#fbbf24', fontSize: responsive.iconSize }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Character">
            <IconButton size={responsive.buttonSize} onClick={() => insertElement('character')}>
              <CharacterIcon sx={{ color: '#60a5fa', fontSize: responsive.iconSize }} />
            </IconButton>
          </Tooltip>
          {!isMobile && (
            <>
              <Tooltip title="Dialogue">
                <IconButton size={responsive.buttonSize} onClick={() => insertElement('dialogue')}>
                  <DialogueIcon sx={{ color: '#f5f5f5', fontSize: responsive.iconSize }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Parenthetical">
                <IconButton size={responsive.buttonSize} onClick={() => insertElement('parenthetical')}>
                  <FormatAlignCenter sx={{ color: '#a78bfa', fontSize: responsive.iconSize }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Transition">
                <IconButton size={responsive.buttonSize} onClick={() => insertElement('transition')}>
                  <TransitionIcon sx={{ color: '#f472b6', fontSize: responsive.iconSize }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Action">
                <IconButton size={responsive.buttonSize} onClick={() => insertElement('action')}>
                  <ActionIcon sx={{ color: '#e5e5e5', fontSize: responsive.iconSize }} />
                </IconButton>
              </Tooltip>
            </>
          )}
          
          {!isMobile && <Divider orientation="vertical" flexItem />}
          
          {/* Undo/Redo */}
          <Tooltip title="Angre (Ctrl+Z)">
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
          <Tooltip title="Gjør om (Ctrl+Y)">
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
          
          <Box sx={{ flex: 1 }} />
          
          {/* Status - Hide some on mobile */}
          <Stack direction="row" spacing={isMobile ? 0.5 : 1} alignItems="center" flexWrap="wrap" useFlexGap>
            {currentElement && !isMobile && (
              <Chip 
                size={responsive.chipSize}
                label={elementLabels[currentElement]}
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
            
            {/* Save Status Indicator */}
            {saveStatus === 'saved' && (
              <Tooltip title={lastSaved ? `Lagret ${lastSaved.toLocaleTimeString('nb-NO')}` : 'Lagret'}>
                <Chip 
                  size={responsive.chipSize}
                  label={isMobile ? '✓' : '✓ Lagret'}
                  sx={{ 
                    bgcolor: 'rgba(52, 211, 153, 0.2)',
                    color: '#34d399',
                    fontSize: responsive.captionFontSize,
                  }}
                />
              </Tooltip>
            )}
            {saveStatus === 'saving' && (
              <Chip 
                size={responsive.chipSize}
                label={isMobile ? '...' : '🔄 Lagrer...'} 
                sx={{ 
                  bgcolor: 'rgba(60, 165, 250, 0.2)',
                  color: '#60a5fa',
                  fontSize: responsive.captionFontSize,
                }}
              />
            )}
            {saveStatus === 'unsaved' && (
              <Tooltip title="Lagrer når du slutter å skrive">
                <Chip 
                  size={responsive.chipSize}
                  label={isMobile ? '○' : '○ Ulagret'} 
                  sx={{ 
                    bgcolor: 'rgba(251, 191, 36, 0.2)',
                    color: '#fbbf24',
                    fontSize: responsive.captionFontSize,
                  }}
                />
              </Tooltip>
            )}
            {saveStatus === 'error' && (
              <Tooltip title="Feil ved lagring">
                <Chip 
                  size={responsive.chipSize}
                  label={isMobile ? '✕' : '✕ Lagringsfeil'} 
                  sx={{ 
                    bgcolor: 'rgba(244, 63, 94, 0.2)',
                    color: '#f43f5e',
                    fontSize: responsive.captionFontSize,
                  }}
                />
              </Tooltip>
            )}
            
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

      {/* Insert Menu */}
      <Menu
        anchorEl={insertMenuAnchor}
        open={Boolean(insertMenuAnchor)}
        onClose={() => setInsertMenuAnchor(null)}
        sx={{ zIndex: 1400 }}
      >
        <MenuItem onClick={() => insertElement('scene_heading')}>
          <ListItemIcon><SceneIcon sx={{ color: '#fbbf24' }} /></ListItemIcon>
          <ListItemText primary="Scene Heading" secondary="INT./EXT. LOCATION - TIME" />
        </MenuItem>
        <MenuItem onClick={() => insertElement('character')}>
          <ListItemIcon><CharacterIcon sx={{ color: '#60a5fa' }} /></ListItemIcon>
          <ListItemText primary="Character" secondary="CHARACTER NAME" />
        </MenuItem>
        <MenuItem onClick={() => insertElement('dialogue')}>
          <ListItemIcon><DialogueIcon /></ListItemIcon>
          <ListItemText primary="Dialogue" secondary="Character's spoken lines" />
        </MenuItem>
        <MenuItem onClick={() => insertElement('parenthetical')}>
          <ListItemIcon><FormatAlignCenter sx={{ color: '#a78bfa' }} /></ListItemIcon>
          <ListItemText primary="Parenthetical" secondary="(beat), (whispering)" />
        </MenuItem>
        <MenuItem onClick={() => insertElement('action')}>
          <ListItemIcon><ActionIcon /></ListItemIcon>
          <ListItemText primary="Action" secondary="Scene description" />
        </MenuItem>
        <MenuItem onClick={() => insertElement('transition')}>
          <ListItemIcon><TransitionIcon sx={{ color: '#f472b6' }} /></ListItemIcon>
          <ListItemText primary="Transition" secondary="CUT TO:, FADE OUT" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => insertElement('section')}>
          <ListItemIcon><TitleIcon sx={{ color: '#f97316' }} /></ListItemIcon>
          <ListItemText primary="Section" secondary="# ACT ONE" />
        </MenuItem>
        <MenuItem onClick={() => insertElement('centered')}>
          <ListItemIcon><CenterIcon sx={{ color: '#34d399' }} /></ListItemIcon>
          <ListItemText primary="Centered" secondary=">TEXT<" />
        </MenuItem>
        <MenuItem onClick={() => insertElement('page_break')}>
          <ListItemIcon><PageIcon /></ListItemIcon>
          <ListItemText primary="Page Break" secondary="===" />
        </MenuItem>
        <MenuItem onClick={() => insertElement('note')}>
          <ListItemIcon><CodeIcon /></ListItemIcon>
          <ListItemText primary="Note" secondary="[[Note text]]" />
        </MenuItem>
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
            {parsedLines.map((_, index) => (
              <Typography
                key={index}
                sx={{
                  fontFamily: 'Courier Prime, Courier New, monospace',
                  fontSize: responsive.fontSize,
                  lineHeight: '1.5',
                  color: cursorPosition.line === index + 1 ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                  textAlign: 'right',
                  pr: isMobile ? 0.5 : 1,
                  userSelect: 'none',
                }}
              >
                {index + 1}
              </Typography>
            ))}
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
          onKeyUp={handleCursorUpdate}
          onScroll={handleScroll}
          onFocus={() => setIsEditorFocused(true)}
          onBlur={() => setIsEditorFocused(false)}
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
                  <ListItemText primary={option} primaryTypographyProps={{ fontSize: responsive.bodyFontSize }} />
                </MenuItem>
              ))}
            </Paper>
          </ClickAwayListener>
        )}
      </Box>

      {!readOnly && isCharacterLineContext && (
        <Box sx={{ px: responsive.padding, pt: 1 }}>
          <GlobalMentionHelper
            text={currentLineContext.text}
            localCandidates={roleCharacterNames.length > 0 ? roleCharacterNames : allCharacters}
            onApplySuggestion={applyCharacterMentionSuggestion}
            autoTagTitle="Global character tags"
            suggestionTitle="Mener du denne karakteren?"
          />
        </Box>
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
