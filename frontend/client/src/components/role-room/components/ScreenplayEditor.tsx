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
  onCharacterAdd?: (name: string) => void;
  onLocationAdd?: (name: string) => void;
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

export const ScreenplayEditor: React.FC<ScreenplayEditorProps> = React.memo(({
  value,
  onChange,
  characters = [],
  locations = [],
  onCharacterAdd,
  onLocationAdd,
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
  
  // DEBUG: Log renders
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  console.log(`🎬 ScreenplayEditor RENDER #${renderCountRef.current}`);
  
  // Internal state for smooth typing - this is the source of truth for the UI
  const [internalValue, setInternalValue] = useState(value);
  const lastInternalValueRef = useRef(value);
  
  // Sync external value changes to internal state (but not our own changes)
  useEffect(() => {
    // Only sync if this is truly an external update (not echoing back our own change)
    if (value !== lastInternalValueRef.current) {
      console.log('🔄 ScreenplayEditor SYNCING - value changed from external source');
      setInternalValue(value);
      lastInternalValueRef.current = value;
      historyRef.current = [value];
      historyIndexRef.current = 0;
    }
  }, [value]);
  
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [currentElement, setCurrentElement] = useState<FountainElement | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteType, setAutocompleteType] = useState<'character' | 'location' | null>(null);
  const [autocompleteOptions, setAutocompleteOptions] = useState<string[]>([]);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
  const [insertMenuAnchor, setInsertMenuAnchor] = useState<HTMLElement | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse a single line to determine its type
  const parseLine = useCallback((line: string, prevLine: string | null, nextLine: string | null): FountainElement => {
    const trimmed = line.trim();
    
    if (!trimmed) return 'action';
    
    // Page break
    if (PAGE_BREAK_PATTERN.test(trimmed)) return 'page_break';
    
    // Section
    if (SECTION_PATTERN.test(trimmed)) return 'section';
    
    // Synopsis
    if (SYNOPSIS_PATTERN.test(trimmed)) return 'synopsis';
    
    // Scene heading
    if (SCENE_HEADING_PATTERN.test(trimmed) || FORCED_SCENE_HEADING_PATTERN.test(trimmed)) {
      return 'scene_heading';
    }
    
    // Centered
    if (CENTERED_PATTERN.test(trimmed)) return 'centered';
    
    // Transition (forced or ends with :)
    if (FORCED_TRANSITION_PATTERN.test(trimmed)) return 'transition';
    if (TRANSITION_PATTERN.test(trimmed) && trimmed === trimmed.toUpperCase()) {
      return 'transition';
    }
    
    // Parenthetical (must follow character or dialogue)
    if (PARENTHETICAL_PATTERN.test(trimmed)) {
      if (prevLine) {
        const prevType = parseLine(prevLine, null, null);
        if (prevType === 'character' || prevType === 'dialogue' || prevType === 'parenthetical') {
          return 'parenthetical';
        }
      }
    }
    
    // Character (all caps, possibly with extension like (V.O.))
    if (FORCED_CHARACTER_PATTERN.test(trimmed)) return 'character';
    if (CHARACTER_PATTERN.test(trimmed)) {
      // Character can appear after action/dialogue/parenthetical with proper context
      if (prevLine && prevLine.trim() !== '') {
        const prevType = parseLine(prevLine, null, null);
        // Character should follow these element types
        if (['action', 'character', 'parenthetical', 'dialogue'].includes(prevType)) {
          // Must have dialogue or parenthetical following
          if (nextLine && nextLine.trim()) {
            const nextTrimmed = nextLine.trim();
            // Next line should be dialogue/parenthetical, not scene heading/transition/etc
            const isValidFollowing = !nextTrimmed.match(/^(INT|EXT|INT\.?\/EXT|I\/E)/i) &&
                                     !nextTrimmed.match(/^[A-Z\s]+:$/) &&
                                     !nextTrimmed.startsWith('>') &&
                                     !nextTrimmed.startsWith('#') &&
                                     !CHARACTER_PATTERN.test(nextTrimmed);
            if (isValidFollowing) {
              return 'character';
            }
          }
        }
      } else if (!prevLine || prevLine.trim() === '') {
        // Original: Character after blank line
        if (nextLine && nextLine.trim()) {
          return 'character';
        }
      }
    }
    
    // Dialogue (follows character or parenthetical)
    if (prevLine) {
      const prevType = parseLine(prevLine, null, null);
      if (prevType === 'character' || prevType === 'parenthetical' || prevType === 'dialogue') {
        if (!CHARACTER_PATTERN.test(trimmed) && !PARENTHETICAL_PATTERN.test(trimmed)) {
          return 'dialogue';
        }
      }
    }
    
    return 'action';
  }, []);

  // Parse entire document - use internalValue for responsive UI
  const parsedLines = useMemo((): ParsedLine[] => {
    const lines = internalValue.split('\n');
    const result: ParsedLine[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const prevLine = i > 0 ? lines[i - 1] : null;
      const nextLine = i < lines.length - 1 ? lines[i + 1] : null;
      const type = parseLine(lines[i], prevLine, nextLine);
      
      result.push({
        type,
        content: lines[i],
        lineNumber: i + 1,
        raw: lines[i],
      });
    }
    
    return result;
  }, [internalValue, parseLine]);

  // Get styling for each element type
  const getElementStyle = (type: FountainElement): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      fontFamily: 'Courier Prime, Courier New, monospace',
      fontSize: responsive.fontSize,
      lineHeight: '1.5',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
    };
    
    // Adjust margins for mobile
    const marginMultiplier = isMobile ? 0.5 : isTablet ? 0.75 : 1;
    
    switch (type) {
      case 'scene_heading':
        return {
          ...baseStyle,
          fontWeight: 700,
          color: '#fbbf24', // Amber
          textTransform: 'uppercase',
          marginTop: `${1.5 * marginMultiplier}em`,
          marginBottom: `${0.5 * marginMultiplier}em`,
        };
      case 'character':
        return {
          ...baseStyle,
          fontWeight: 600,
          color: '#60a5fa', // Blue
          textTransform: 'uppercase',
          marginLeft: isMobile ? '20%' : isTablet ? '30%' : '37%',
          marginTop: `${1 * marginMultiplier}em`,
        };
      case 'dialogue':
        return {
          ...baseStyle,
          color: '#f5f5f5',
          marginLeft: isMobile ? '5%' : isTablet ? '12%' : '17%',
          marginRight: isMobile ? '5%' : isTablet ? '12%' : '17%',
        };
      case 'parenthetical':
        return {
          ...baseStyle,
          color: '#a78bfa', // Purple
          fontStyle: 'italic',
          marginLeft: isMobile ? '10%' : isTablet ? '20%' : '27%',
          marginRight: isMobile ? '10%' : isTablet ? '20%' : '27%',
        };
      case 'transition':
        return {
          ...baseStyle,
          fontWeight: 600,
          color: '#f472b6', // Pink
          textTransform: 'uppercase',
          textAlign: 'right',
          marginTop: `${1 * marginMultiplier}em`,
          marginBottom: `${1 * marginMultiplier}em`,
        };
      case 'centered':
        return {
          ...baseStyle,
          textAlign: 'center',
          color: '#34d399', // Green
        };
      case 'action':
        return {
          ...baseStyle,
          color: '#e5e5e5',
        };
      case 'section':
        return {
          ...baseStyle,
          fontWeight: 700,
          fontSize: is4K ? '16pt' : isMobile ? '12pt' : '14pt',
          color: '#f97316', // Orange
          marginTop: `${2 * marginMultiplier}em`,
        };
      case 'synopsis':
        return {
          ...baseStyle,
          fontStyle: 'italic',
          color: '#6b7280',
        };
      case 'page_break':
        return {
          ...baseStyle,
          textAlign: 'center',
          color: '#4b5563',
          borderTop: '1px dashed #4b5563',
          marginTop: `${1 * marginMultiplier}em`,
          marginBottom: `${1 * marginMultiplier}em`,
        };
      case 'note':
        return {
          ...baseStyle,
          color: '#9ca3af',
          backgroundColor: 'rgba(156, 163, 175, 0.1)',
        };
      default:
        return baseStyle;
    }
  };

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
          locs.add(match[1].trim());
        }
      }
    });
    return Array.from(locs).sort();
  }, [parsedLines]);

  // All available characters (from props + extracted)
  const allCharacters = useMemo(() => {
    return Array.from(new Set([...characters, ...extractedCharacters])).sort();
  }, [characters, extractedCharacters]);

  // All available locations
  const allLocations = useMemo(() => {
    return Array.from(new Set([...locations, ...extractedLocations])).sort();
  }, [locations, extractedLocations]);

  // Sync extracted characters to parent via callback
  const prevExtractedCharsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!onCharacterAdd) return;
    
    const existingChars = new Set(characters.map(c => c.toUpperCase()));
    const prevChars = prevExtractedCharsRef.current;
    
    extractedCharacters.forEach(char => {
      const upperChar = char.toUpperCase();
      // Only call callback for truly new characters (not in props AND not previously extracted)
      if (!existingChars.has(upperChar) && !prevChars.has(upperChar)) {
        onCharacterAdd(char);
      }
    });
    
    // Update ref with current extracted chars
    prevExtractedCharsRef.current = new Set(extractedCharacters.map(c => c.toUpperCase()));
  }, [extractedCharacters, characters, onCharacterAdd]);

  // Sync extracted locations to parent via callback
  const prevExtractedLocsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!onLocationAdd) return;
    
    const existingLocs = new Set(locations.map(l => l.toUpperCase()));
    const prevLocs = prevExtractedLocsRef.current;
    
    extractedLocations.forEach(loc => {
      const upperLoc = loc.toUpperCase();
      // Only call callback for truly new locations (not in props AND not previously extracted)
      if (!existingLocs.has(upperLoc) && !prevLocs.has(upperLoc)) {
        onLocationAdd(loc);
      }
    });
    
    // Update ref with current extracted locations
    prevExtractedLocsRef.current = new Set(extractedLocations.map(l => l.toUpperCase()));
  }, [extractedLocations, locations, onLocationAdd]);

  // Handle text change - update internal state immediately, notify parent asynchronously
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    
    console.log('⌨️ ScreenplayEditor handleChange, new length:', newValue.length);
    
    // Update internal state immediately for responsive typing
    setInternalValue(newValue);
    lastInternalValueRef.current = newValue; // Track this as our change
    
    // Notify parent asynchronously to avoid blocking the UI
    // Using requestAnimationFrame for smoother performance
    requestAnimationFrame(() => {
      console.log('📤 ScreenplayEditor calling parent onChange');
      onChangeRef.current(newValue);
    });
    
    // Add to history using refs instead of state to avoid re-renders
    historyRef.current = [...historyRef.current.slice(0, historyIndexRef.current + 1), newValue];
    historyIndexRef.current = historyRef.current.length - 1;
    
    // Check for autocomplete trigger
    checkAutocomplete(newValue, e.target.selectionStart);
  };

  // Check if we should show autocomplete
  const checkAutocomplete = (text: string, cursorPos: number) => {
    const lines = text.substring(0, cursorPos).split('\n');
    const currentLine = lines[lines.length - 1];
    const prevLine = lines.length > 1 ? lines[lines.length - 2] : '';
    
    // Check for character autocomplete (after blank line, typing uppercase)
    if (prevLine.trim() === '' && /^[A-ZÆØÅ][A-ZÆØÅ]*$/.test(currentLine)) {
      const matches = allCharacters.filter(c => 
        c.toUpperCase().startsWith(currentLine.toUpperCase())
      );
      if (matches.length > 0) {
        setAutocompleteOptions(matches);
        setAutocompleteType('character');
        setShowAutocomplete(true);
        setSelectedAutocompleteIndex(0);
        updateAutocompletePosition();
        return;
      }
    }
    
    // Check for location autocomplete (after INT./EXT.)
    const locationMatch = currentLine.match(/^(?:INT|EXT|INT\.?\/EXT|I\/E)\.?\s*(.*)$/i);
    if (locationMatch && locationMatch[1]) {
      const partial = locationMatch[1].toUpperCase();
      const matches = allLocations.filter(l => 
        l.toUpperCase().startsWith(partial)
      );
      if (matches.length > 0) {
        setAutocompleteOptions(matches);
        setAutocompleteType('location');
        setShowAutocomplete(true);
        setSelectedAutocompleteIndex(0);
        updateAutocompletePosition();
        return;
      }
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
      // Replace entire line with character name
      lines[lines.length - 1] = selected;
      newText = lines.join('\n') + textAfter;
    } else if (autocompleteType === 'location') {
      // Replace just the location part
      const prefix = currentLine.match(/^((?:INT|EXT|INT\.?\/EXT|I\/E)\.?\s*)/i)?.[1] || '';
      lines[lines.length - 1] = prefix + selected;
      newText = lines.join('\n') + textAfter;
    } else {
      return;
    }
    
    // Update internal state immediately
    setInternalValue(newText);
    lastInternalValueRef.current = newText;
    
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
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyAutocomplete(autocompleteOptions[selectedAutocompleteIndex]);
        return;
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
    
    // Tab for dialogue indent
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      insertAtCursor('\t');
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

  // Update cursor position display
  useEffect(() => {
    if (!editorRef.current) return;
    
    const textarea = editorRef.current;
    const handleSelectionChange = () => {
      const { selectionStart } = textarea;
      const textBefore = internalValue.substring(0, selectionStart);
      const lines = textBefore.split('\n');
      const line = lines.length;
      const column = lines[lines.length - 1].length + 1;
      
      setCursorPosition({ line, column });
      
      // Determine current element type
      if (parsedLines[line - 1]) {
        setCurrentElement(parsedLines[line - 1].type);
        onCursorChange?.(line, column, parsedLines[line - 1].type);
      }
    };
    
    textarea.addEventListener('click', handleSelectionChange);
    textarea.addEventListener('keyup', handleSelectionChange);
    
    return () => {
      textarea.removeEventListener('click', handleSelectionChange);
      textarea.removeEventListener('keyup', handleSelectionChange);
    };
  }, [internalValue, parsedLines, onCursorChange]);

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
          }}
        >
          {parsedLines.map((line, index) => (
            <Box
              key={index}
              sx={{
                ...getElementStyle(line.type),
                minHeight: '1.5em',
              }}
            >
              {line.content || '\u00A0'}
            </Box>
          ))}
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
          onScroll={handleScroll}
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
            color: 'transparent',
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
                      <CharacterIcon sx={{ color: '#60a5fa', fontSize: responsive.iconSize }} />
                    ) : (
                      <LocationIcon sx={{ color: '#fbbf24', fontSize: responsive.iconSize }} />
                    )}
                  </ListItemIcon>
                  <ListItemText primary={option} primaryTypographyProps={{ fontSize: responsive.bodyFontSize }} />
                </MenuItem>
              ))}
            </Paper>
          </ClickAwayListener>
        )}
      </Box>

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
