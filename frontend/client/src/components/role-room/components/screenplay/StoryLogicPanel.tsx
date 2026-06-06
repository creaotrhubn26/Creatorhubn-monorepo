/**
 * StoryLogicPanel.tsx
 * 
 * Story Logic System - A structured approach to validate and develop story foundations
 * before writing begins.
 * 
 * Three phases:
 * 1. Concept - Validate the idea before any writing
 * 2. Logline - Define story DNA
 * 3. Theme & Character Intent - Give the story meaning
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// DEV-only debug-logging — løp ikke prod-konsolen med per-project /
// per-autosave-info (kjører hver 1.2s ved unsaved changes).
const DEV_LOG = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV === true;
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Chip,
  Badge,
  LinearProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Rating,
  Tooltip,
  IconButton,
  Divider,
  Card,
  CardContent,
  Fade,
  Collapse,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Lightbulb as LightbulbIcon,
  Create as CreateIcon,
  Psychology as PsychologyIcon,
  Check as CheckIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  AutoAwesome as AutoAwesomeIcon,
  TipsAndUpdates as TipsIcon,
  Star as StarIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Download as DownloadIcon,
  History as HistoryIcon,
  School as SchoolIcon,
  ArrowForward as ArrowForwardIcon,
  GpsFixed as GpsFixedIcon,
  ReportProblem as ContradictionIcon,
  TheaterComedy as TheaterComedyIcon,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import jsPDF from 'jspdf';
import { useBrandingSettings } from '../../hooks/useBrandingSettings';
import { storyLogicService, type StoryLogicSyncMeta } from '../../services/storyLogicService';
import {
  CONTENT_PRODUCER_DEMO_PROJECT_ID,
  TROLL_DEMO_PROJECT_ID,
  containsLegacyProducerDemoMarker,
  isRoleRoomDemoSeedAllowed,
} from '../../constants/producerDemo';
import type {
  ConceptData,
  LoglineData,
  ThemeData,
  PhaseLocks,
  StoryVersion,
  StoryLogicState,
  ValidationWarning,
  CoachingTip,
  ValidationResult,
} from './storyLogic/types';
import {
  REALITY_CHECK_PROMPTS,
  PHASE_META,
  GENRES,
  SUB_GENRES,
  TONE_GROUPS,
  AUDIENCE_AGES,
  GENRE_LABELS_NB,
  SUB_GENRE_LABELS_NB,
  TONE_LABELS_NB,
  AUDIENCE_AGE_LABELS_NB,
  EMOTION_LABELS_NB,
  LEGACY_SUBGENRE_MAP,
  LEGACY_AUDIENCE_AGE_MAP,
  EMOTION_GROUPS,
  FIELD_EXAMPLES,
  GENRE_TONE_PRESETS,
  GENRE_EMOTION_PRESETS,
  nbLabel,
  getFieldLabelNb,
  STATUS_LABELS,
  getConfidenceTier,
  getEnergyColor,
} from './storyLogic/constants';
import {
  TROLL_DEMO_STATE,
  DEFAULT_STATE,
  CONTENT_PRODUCER_DEMO_STATE,
} from './storyLogic/demoStates';
import {
  detectContradictions,
  validateConcept,
  validateLogline,
  validateTheme,
} from './storyLogic/storyValidation';
import {
  normalizeConceptSelections,
  normalizeStoryLogicState,
  translateLegacyTextToNb,
} from './storyLogic/legacyText';
import { PhaseHeader } from './storyLogic/components/PhaseHeader';
import { ValidationDisplay } from './storyLogic/components/ValidationDisplay';
import { WritingFlowBadge } from './storyLogic/components/WritingFlowBadge';
import { ConfidenceDeltaToast } from './storyLogic/components/ConfidenceDeltaToast';
import { AutoSaveBadge } from './storyLogic/components/AutoSaveBadge';
import { useWritingFlow } from './storyLogic/hooks/useWritingFlow';
import { useConfidenceDelta } from './storyLogic/hooks/useConfidenceDelta';

// ============================================================================
// Energy-Aware UX Helpers
// ============================================================================

function hexToRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  if (!hex) return fallback;
  const normalized = hex.trim().replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return fallback;
  const int = Number.parseInt(value, 16);
  if (Number.isNaN(int)) return fallback;
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Unable to convert blob to data URL'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read blob'));
    reader.readAsDataURL(blob);
  });
}

function readImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      } else {
        reject(new Error('Invalid image dimensions'));
      }
    };
    img.onerror = () => reject(new Error('Unable to read image dimensions'));
    img.src = dataUrl;
  });
}

const phaseRoadmapGridSx = {
  display: 'grid',
  gap: 1.5,
  gridTemplateColumns: {
    xs: '1fr',
    md: 'repeat(3, minmax(0, 1fr))',
  },
};

const phaseFormGridSx = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: {
    xs: '1fr',
    md: 'repeat(2, minmax(0, 1fr))',
  },
};

const phaseFullSpanSx = {
  gridColumn: '1 / -1',
};

const starterCardsGridSx = {
  display: 'grid',
  gap: 1.5,
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    lg: 'repeat(3, minmax(0, 1fr))',
  },
};

const templateCardsGridSx = {
  display: 'grid',
  gap: 1,
  mt: 1,
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    lg: 'repeat(3, minmax(0, 1fr))',
  },
};

type StoryPhaseKey = 'concept' | 'logline' | 'theme';

function getStableRealityCheckPrompt(phase: StoryPhaseKey, seedSource: string): string {
  const prompts = REALITY_CHECK_PROMPTS[phase];
  if (!prompts.length) return '';

  const seed = Array.from(seedSource).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return prompts[seed % prompts.length];
}

// Project templates for quick-start (#9)
interface StoryTemplate {
  id: string;
  name: string;
  description: string;
  data: Partial<StoryLogicState>;
}

const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: 'thriller',
    name: 'Thriller',
    description: 'Høye stakes og stigende tidspress',
    data: {
      concept: { corePremise: '', genre: 'Thriller', subGenre: 'Psychological', tone: ['Suspenseful', 'Dark'], targetAudience: '', audienceAge: 'Adult (26-45)', whyNow: '', uniqueAngle: '', marketComparables: '' },
      logline: { protagonist: '', protagonistTrait: '', goal: '', antagonisticForce: '', stakes: '', fullLogline: '', loglineScore: 0 },
      theme: { centralTheme: '', themeStatement: '', protagonistFlaw: '', flawOrigin: '', whatMustChange: '', transformationArc: '', emotionalJourney: ['Fear', 'Anticipation', 'Surprise', 'Relief'], moralArgument: '' },
    },
  },
  {
    id: 'character-drama',
    name: 'Karakterdrevet drama',
    description: 'Indre transformasjon og emosjonell dybde',
    data: {
      concept: { corePremise: '', genre: 'Drama', subGenre: 'Family Drama', tone: ['Serious', 'Melancholic'], targetAudience: '', audienceAge: 'Adult (26-45)', whyNow: '', uniqueAngle: '', marketComparables: '' },
      logline: { protagonist: '', protagonistTrait: '', goal: '', antagonisticForce: '', stakes: '', fullLogline: '', loglineScore: 0 },
      theme: { centralTheme: '', themeStatement: '', protagonistFlaw: '', flawOrigin: '', whatMustChange: '', transformationArc: '', emotionalJourney: ['Hope', 'Sadness', 'Anger', 'Relief', 'Triumph'], moralArgument: '' },
    },
  },
  {
    id: 'commercial-pitch',
    name: 'Kommersiell pitch',
    description: 'High-concept med tydelig markedsposisjon',
    data: {
      concept: { corePremise: '', genre: 'Action', subGenre: 'Superhero', tone: ['Intense', 'Hopeful'], targetAudience: '', audienceAge: 'Young Adult (18-25)', whyNow: '', uniqueAngle: '', marketComparables: '' },
      logline: { protagonist: '', protagonistTrait: '', goal: '', antagonisticForce: '', stakes: '', fullLogline: '', loglineScore: 0 },
      theme: { centralTheme: '', themeStatement: '', protagonistFlaw: '', flawOrigin: '', whatMustChange: '', transformationArc: '', emotionalJourney: ['Anticipation', 'Fear', 'Anger', 'Triumph'], moralArgument: '' },
    },
  },
  {
    id: 'indie-arthouse',
    name: 'Indie arthouse',
    description: 'Atmosfærisk, tvetydig og visuelt drevet',
    data: {
      concept: { corePremise: '', genre: 'Drama', subGenre: '', tone: ['Surreal', 'Melancholic'], targetAudience: 'Cinefile og festivalpublikum', audienceAge: 'Adult (26-45)', whyNow: '', uniqueAngle: '', marketComparables: '' },
      logline: { protagonist: '', protagonistTrait: '', goal: '', antagonisticForce: '', stakes: '', fullLogline: '', loglineScore: 0 },
      theme: { centralTheme: '', themeStatement: '', protagonistFlaw: '', flawOrigin: '', whatMustChange: '', transformationArc: '', emotionalJourney: ['Sadness', 'Anticipation', 'Surprise', 'Despair'], moralArgument: '' },
    },
  },
];

// Start-with modes for non-linear entry (#10)
type StartMode = 'idea' | 'character' | 'theme';
// Icon-konfig matchende memory.md-spec (emoji → MUI):
//   💡 → Lightbulb, 🎭 → TheaterComedy, 🧠 → Psychology
const START_MODES: { id: StartMode; label: string; Icon: SvgIconComponent; iconColor: string; description: string; initialPhase: number }[] = [
  { id: 'idea',      label: 'Start med idé',     Icon: LightbulbIcon,    iconColor: '#fbbf24', description: 'Jeg har et konsept eller premiss', initialPhase: 0 },
  { id: 'character', label: 'Start med karakter', Icon: TheaterComedyIcon, iconColor: '#f472b6', description: 'Jeg har en karakter i tankene',   initialPhase: 1 },
  { id: 'theme',     label: 'Start med tema',    Icon: PsychologyIcon,   iconColor: '#a78bfa', description: 'Jeg vet budskapet først',           initialPhase: 2 },
];

// ============================================================================
// Types & Interfaces — ekstraktert til ./storyLogic/types.ts
// ============================================================================
//
// Pure type/interface-definisjoner brukt på tvers av StoryLogicPanel og
// kommende fase-komponenter. Verifiser tsc før commit hvis du legger til
// nye felt — Vitest-tester i ../validators/storyValidation.test.ts dekker
// edge cases.

function looksLikeLegacyContentProducerStoryLogicState(state: StoryLogicState): boolean {
  return containsLegacyProducerDemoMarker(
    state.concept.corePremise,
    state.logline.protagonist,
    state.logline.fullLogline,
    state.theme.themeStatement,
    state.theme.transformationArc
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface StoryLogicPanelProps {
  projectId?: string;
  onSave?: (data: StoryLogicState) => void;
  initialData?: StoryLogicState;
  onUnsavedStateChange?: (hasUnsaved: boolean, reason?: string) => void;
  /**
   * Naviger videre til Story Writer (manus-editoren). Når satt vises en
   * "Gå til Story Writer"-knapp i "Klar til å skrive"-kortet, slik at fullført
   * story-logic ikke blir en blindvei der brukeren må finne veien tilbake selv.
   */
  onNavigateToStoryWriter?: () => void;
}

export const StoryLogicPanel: React.FC<StoryLogicPanelProps> = ({
  projectId,
  onSave,
  initialData,
  onUnsavedStateChange,
  onNavigateToStoryWriter,
}) => {
  const branding = useBrandingSettings();
  const [state, setState] = useState<StoryLogicState>(initialData || DEFAULT_STATE);
  const [expandedPhase, setExpandedPhase] = useState<number>(0);
  const [showValidation, _setShowValidation] = useState<boolean>(true);
  const [_isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'offline'>('saved');
  const [syncMeta, setSyncMeta] = useState<StoryLogicSyncMeta | null>(null);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [startMode, setStartMode] = useState<StartMode | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [premiseChangeAlert, setPremiseChangeAlert] = useState<string | null>(null);
  const prevPremiseRef = useRef(state.concept.corePremise);

  const refreshSyncMeta = useCallback(() => {
    if (!projectId) {
      setSyncMeta(null);
      return;
    }

    try {
      setSyncMeta(storyLogicService.getStoryLogicSyncMeta(projectId));
    } catch (error) {
      setSyncMeta({
        projectId,
        status: 'error',
        source: 'server',
        lastError: error instanceof Error ? error.message : 'Kunne ikke lese sync-status.',
      });
    }
  }, [projectId]);

  const syncStatusLabel = useMemo(() => {
    const status = syncMeta?.status ?? 'idle';
    const versionSuffix = syncMeta?.version ? ` v${syncMeta.version}` : '';
    if (status === 'synced') return `Synket${versionSuffix}`;
    if (status === 'saving') return 'Synker';
    if (status === 'loading') return 'Henter';
    if (status === 'conflict') return 'Konflikt';
    if (status === 'local_only') return 'Kun lokalt';
    if (status === 'error') return 'Sync-feil';
    return 'Ikke synket';
  }, [syncMeta]);

  const syncStatusColor = useMemo(() => {
    const status = syncMeta?.status ?? 'idle';
    if (status === 'synced') return '#10b981';
    if (status === 'saving' || status === 'loading') return '#60a5fa';
    if (status === 'conflict') return '#f59e0b';
    if (status === 'local_only') return '#a78bfa';
    if (status === 'error') return '#ef4444';
    return '#9ca3af';
  }, [syncMeta]);

  useEffect(() => {
    onUnsavedStateChange?.(
      saveStatus === 'unsaved' || saveStatus === 'offline' || saveStatus === 'saving',
      saveStatus === 'saved' ? undefined : 'story logic',
    );

    return () => {
      onUnsavedStateChange?.(false);
    };
  }, [onUnsavedStateChange, saveStatus]);

  // Refs for autosave + jump-to-field (#1, #5)
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshot = useRef<string>(JSON.stringify(initialData || DEFAULT_STATE));

  // Register field ref callback (#1)
  const registerFieldRef = useCallback((fieldId: string) => (el: HTMLElement | null) => {
    fieldRefs.current[fieldId] = el;
  }, []);

  // Jump to field (#1)
  const jumpToField = useCallback((fieldId: string) => {
    const el = fieldRefs.current[fieldId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedField(fieldId);
      const input = el.querySelector('input, textarea') as HTMLElement | null;
      if (input) input.focus();
      setTimeout(() => setHighlightedField(null), 2500);
    }
  }, []);

  // Highlight style for jump-to-field (#1)
  const getFieldHighlightSx = useCallback((fieldId: string) => {
    if (highlightedField !== fieldId) return {};
    return {
      '& .MuiOutlinedInput-root': {
        '& fieldset': {
          borderColor: '#3b82f6 !important',
          borderWidth: '2px !important',
          boxShadow: '0 0 12px rgba(59, 130, 246, 0.4)',
        },
      },
      transition: 'all 0.3s ease',
    };
  }, [highlightedField]);

  // Load from database or initialize with TROLL demo data
  useEffect(() => {
    if (!projectId || initialData) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const normalizedProjectId = projectId.toLowerCase();
        const demoSeedAllowed = isRoleRoomDemoSeedAllowed();
        const isTrollDemoProject = demoSeedAllowed && normalizedProjectId === TROLL_DEMO_PROJECT_ID;
        const isContentProducerDemoProject = demoSeedAllowed && normalizedProjectId === CONTENT_PRODUCER_DEMO_PROJECT_ID;
        const savedData = await storyLogicService.getStoryLogic(projectId);
        refreshSyncMeta();
        if (savedData) {
          // Migrate old isLocked → locks if needed
          const migrated = {
            ...savedData,
            locks: savedData.locks || { concept: false, logline: false, theme: false },
            versions: savedData.versions || [],
          };
          const normalized = normalizeStoryLogicState(migrated);
          const looksLikeLegacyTrollProducerState = isContentProducerDemoProject && (
            normalized.concept.corePremise.toLowerCase().includes('troll') ||
            normalized.logline.fullLogline.toLowerCase().includes('troll')
          );
          const looksLikeLegacyProducerRoleState = isContentProducerDemoProject &&
            looksLikeLegacyContentProducerStoryLogicState(normalized);

          if (looksLikeLegacyTrollProducerState || looksLikeLegacyProducerRoleState) {
            const normalizedProducerDemo = normalizeStoryLogicState(CONTENT_PRODUCER_DEMO_STATE);
            setState(normalizedProducerDemo);
            await storyLogicService.saveStoryLogic(projectId, normalizedProducerDemo);
            refreshSyncMeta();
            lastSavedSnapshot.current = JSON.stringify(normalizedProducerDemo);
            setSaveStatus('saved');
            if (DEV_LOG) console.log('🧹 Replaced legacy producer demo story logic with business project data');
          } else {
            setState(normalized);
            lastSavedSnapshot.current = JSON.stringify(normalized);
            setSaveStatus('saved');
            if (DEV_LOG) console.log('✓ Loaded story logic from database for project:', projectId);
          }
        } else if (isContentProducerDemoProject) {
          const normalizedProducerDemo = normalizeStoryLogicState(CONTENT_PRODUCER_DEMO_STATE);
          setState(normalizedProducerDemo);
          await storyLogicService.saveStoryLogic(projectId, normalizedProducerDemo);
          refreshSyncMeta();
          lastSavedSnapshot.current = JSON.stringify(normalizedProducerDemo);
          if (DEV_LOG) console.log('🎬 Initialized producer story logic demo data');
        } else if (isTrollDemoProject) {
          const normalizedDemo = normalizeStoryLogicState(TROLL_DEMO_STATE);
          setState(normalizedDemo);
          await storyLogicService.saveStoryLogic(projectId, normalizedDemo);
          refreshSyncMeta();
          lastSavedSnapshot.current = JSON.stringify(normalizedDemo);
          if (DEV_LOG) console.log('🎬 Initialized TROLL story logic demo data');
        }
      } catch (error) {
        console.error('Failed to load story logic data:', error);
        refreshSyncMeta();
        setSaveStatus('offline');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [projectId, initialData, refreshSyncMeta]);

  // Autosave with debounce (#5)
  useEffect(() => {
    const currentSnapshot = JSON.stringify(state);
    if (currentSnapshot === lastSavedSnapshot.current) {
      setSaveStatus('saved');
      return;
    }
    setSaveStatus('unsaved');
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      if (!projectId) return;
      setSaveStatus('saving');
      refreshSyncMeta();
      try {
        const dataToSave = { ...state, lastSaved: new Date().toISOString() };
        await storyLogicService.saveStoryLogic(projectId, dataToSave);
        refreshSyncMeta();
        lastSavedSnapshot.current = JSON.stringify(dataToSave);
        setState(prev => ({ ...prev, lastSaved: dataToSave.lastSaved }));
        setSaveStatus('saved');
      } catch {
        refreshSyncMeta();
        setSaveStatus('offline');
      }
    }, 1200);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [state, projectId, refreshSyncMeta]);

  // Soft version history — detect significant premise changes (#5 Recovery Design)
  useEffect(() => {
    const prev = prevPremiseRef.current;
    const curr = state.concept.corePremise;
    if (prev.length > 30 && curr.length > 10) {
      // Check if the premise changed significantly (>50% different words)
      const prevWords = new Set(prev.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const currWords = new Set(curr.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const overlap = [...prevWords].filter(w => currWords.has(w)).length;
      const total = Math.max(prevWords.size, currWords.size);
      if (total > 0 && overlap / total < 0.5) {
        setPremiseChangeAlert('Du har endret kjernepremisset betydelig. Vil du lagre en ny versjon?');
      }
    }
    prevPremiseRef.current = curr;
  }, [state.concept.corePremise]);

  // Save version snapshot (#11)
  const saveVersion = useCallback((label?: string) => {
    setState(prev => {
      const version: StoryVersion = {
        id: Date.now().toString(36),
        label: label || `v${prev.versions.length + 1}`,
        timestamp: new Date().toISOString(),
        snapshot: JSON.stringify({ concept: prev.concept, logline: prev.logline, theme: prev.theme }),
      };
      return { ...prev, versions: [...prev.versions, version] };
    });
  }, []);

  // Apply template (#9)
  const applyTemplate = useCallback((template: StoryTemplate) => {
    if (state.concept.corePremise.length > 20) {
      if (!window.confirm('Dette overskriver nåværende oppsett med malen. Fortsette?')) return;
      saveVersion('Før mal');
    }
    setState(prev => ({
      ...prev,
      concept: { ...DEFAULT_STATE.concept, ...template.data.concept },
      logline: { ...DEFAULT_STATE.logline, ...template.data.logline },
      theme: { ...DEFAULT_STATE.theme, ...template.data.theme },
    }));
    setShowTemplates(false);
  }, [state.concept.corePremise, saveVersion]);

  const goToPhase = useCallback((phaseIndex: number) => {
    setExpandedPhase(phaseIndex);
    setState(prev => (
      prev.currentPhase === phaseIndex
        ? prev
        : { ...prev, currentPhase: phaseIndex }
    ));
  }, []);

  // Handle start mode selection (#10 non-linear start)
  const handleStartMode = useCallback((mode: StartMode) => {
    setStartMode(mode);
    const modeConfig = START_MODES.find(m => m.id === mode);
    if (modeConfig) goToPhase(modeConfig.initialPhase);
  }, [goToPhase]);

  // Save to database
  const saveToStorage = useCallback(async () => {
    if (!projectId) return;
    
    setIsSaving(true);
    setSaveStatus('saving');
    refreshSyncMeta();
    const dataToSave = { ...state, lastSaved: new Date().toISOString() };
    
    try {
      await storyLogicService.saveStoryLogic(projectId, dataToSave);
      refreshSyncMeta();
      setState(dataToSave);
      lastSavedSnapshot.current = JSON.stringify(dataToSave);
      setSaveStatus('saved');
      onSave?.(dataToSave);
      if (DEV_LOG) console.log('✓ Story logic saved for project:', projectId);
    } catch (error) {
      console.error('Failed to save story logic:', error);
      refreshSyncMeta();
      setSaveStatus('offline');
    } finally {
      setIsSaving(false);
    }
  }, [projectId, state, onSave, refreshSyncMeta]);

  // Memoize all validation results — single source of truth (A: eliminates duplicate computation)
  const conceptValidation = useMemo(() => validateConcept(state.concept), [state.concept]);
  const loglineValidation = useMemo(() => validateLogline(state.logline), [state.logline]);
  const themeValidation = useMemo(() => validateTheme(state.theme), [state.theme]);

  // Skrive-flyt: følger rytmen og spawner mikro-belønninger ved progress
  const writingFlow = useWritingFlow();
  const conceptDelta = useConfidenceDelta(conceptValidation.score);
  const loglineDelta = useConfidenceDelta(loglineValidation.score);
  const themeDelta = useConfidenceDelta(themeValidation.score);

  const validationResults = useMemo(() => ({
    concept: conceptValidation.score >= 70 ? 'ready' as const : conceptValidation.score >= 40 ? 'weak' as const : 'incomplete' as const,
    logline: loglineValidation.score >= 70 ? 'ready' as const : loglineValidation.score >= 40 ? 'weak' as const : 'incomplete' as const,
    theme: themeValidation.score >= 70 ? 'ready' as const : themeValidation.score >= 40 ? 'weak' as const : 'incomplete' as const,
  }), [conceptValidation.score, loglineValidation.score, themeValidation.score]);

  // Cmd/Ctrl+Enter: gå til neste fase når aktiv fase er 'ready'. Sparer mus +
  // gir momentum-følelsen brukeren forventer fra polerte skriveverktøy.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return;
      const phases = ['concept', 'logline', 'theme'] as const;
      const current = expandedPhase;
      if (current < 0 || current > 2) return;
      const currentStatus = validationResults[phases[current]];
      if (currentStatus !== 'ready') return;
      e.preventDefault();
      if (current >= 2) {
        // Siste fase ferdig → fortsett til Story Writer i stedet for å stoppe.
        onNavigateToStoryWriter?.();
        return;
      }
      setExpandedPhase(current + 1);
      setState(prev => ({ ...prev, currentPhase: current + 1 }));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expandedPhase, validationResults, onNavigateToStoryWriter]);

  // Update validation status - only when memoized results change
  useEffect(() => {
    setState(prev => {
      if (prev.phaseStatus.concept === validationResults.concept &&
          prev.phaseStatus.logline === validationResults.logline &&
          prev.phaseStatus.theme === validationResults.theme) {
        return prev; // Return same reference to prevent re-render
      }
      return {
        ...prev,
        phaseStatus: validationResults,
      };
    });
  }, [validationResults]);

  // Track missing logline fields for best-effort generation feedback (D)
  const missingLoglineFields = useMemo(() => {
    const missing: string[] = [];
    if (!state.logline.protagonist) missing.push('Hovedperson');
    if (!state.logline.goal) missing.push('Mål');
    if (!state.logline.antagonisticForce) missing.push('Antagonistisk kraft');
    if (!state.logline.stakes) missing.push('Konsekvenser');
    return missing;
  }, [state.logline.protagonist, state.logline.goal, state.logline.antagonisticForce, state.logline.stakes]);

  const missingConceptFields = useMemo(() => {
    const missing: string[] = [];
    if (state.concept.corePremise.trim().length < 20) missing.push('Kjernepremiss');
    if (!state.concept.genre) missing.push('Sjanger');
    if (state.concept.tone.length === 0) missing.push('Tone');
    if (state.concept.targetAudience.trim().length < 10) missing.push('Målgruppe');
    if (state.concept.whyNow.trim().length < 20) missing.push('Hvorfor nå');
    if (state.concept.uniqueAngle.trim().length < 20) missing.push('Unik vinkel');
    if (state.concept.marketComparables.trim().length < 10) missing.push('Sammenligninger');
    return missing;
  }, [
    state.concept.corePremise,
    state.concept.genre,
    state.concept.tone,
    state.concept.targetAudience,
    state.concept.whyNow,
    state.concept.uniqueAngle,
    state.concept.marketComparables,
  ]);

  const missingThemeFields = useMemo(() => {
    const missing: string[] = [];
    if (state.theme.centralTheme.trim().length < 5) missing.push('Sentralt tema');
    if (state.theme.themeStatement.trim().length < 20) missing.push('Temapåstand');
    if (state.theme.protagonistFlaw.trim().length < 10) missing.push('Karakterfeil');
    if (state.theme.whatMustChange.trim().length < 15) missing.push('Hva må endres');
    if (state.theme.transformationArc.trim().length < 20) missing.push('Transformasjonsbue');
    return missing;
  }, [
    state.theme.centralTheme,
    state.theme.themeStatement,
    state.theme.protagonistFlaw,
    state.theme.whatMustChange,
    state.theme.transformationArc,
  ]);

  const missingLoglineRoadmapFields = useMemo(() => {
    const missing = [...missingLoglineFields];
    if (state.logline.fullLogline.trim().length < 25) missing.push('Komplett logline');
    return missing;
  }, [missingLoglineFields, state.logline.fullLogline]);

  const conceptRealityPrompt = useMemo(() => getStableRealityCheckPrompt(
    'concept',
    `${state.concept.corePremise}|${state.concept.whyNow}|${state.concept.uniqueAngle}`
  ), [state.concept.corePremise, state.concept.whyNow, state.concept.uniqueAngle]);

  const loglineRealityPrompt = useMemo(() => getStableRealityCheckPrompt(
    'logline',
    `${state.logline.protagonist}|${state.logline.goal}|${state.logline.stakes}|${state.logline.fullLogline}`
  ), [state.logline.protagonist, state.logline.goal, state.logline.stakes, state.logline.fullLogline]);

  const themeRealityPrompt = useMemo(() => getStableRealityCheckPrompt(
    'theme',
    `${state.theme.centralTheme}|${state.theme.themeStatement}|${state.theme.transformationArc}`
  ), [state.theme.centralTheme, state.theme.themeStatement, state.theme.transformationArc]);

  const phaseRoadmap = useMemo(() => (
    PHASE_META.map((phase) => {
      if (phase.key === 'concept') {
        return {
          ...phase,
          status: state.phaseStatus.concept,
          score: conceptValidation.score,
          missingFields: missingConceptFields,
          nextBestAction: conceptValidation.nextBestAction,
        };
      }
      if (phase.key === 'logline') {
        return {
          ...phase,
          status: state.phaseStatus.logline,
          score: loglineValidation.score,
          missingFields: missingLoglineRoadmapFields,
          nextBestAction: loglineValidation.nextBestAction,
        };
      }
      return {
        ...phase,
        status: state.phaseStatus.theme,
        score: themeValidation.score,
        missingFields: missingThemeFields,
        nextBestAction: themeValidation.nextBestAction,
      };
    })
  ), [
    state.phaseStatus.concept,
    state.phaseStatus.logline,
    state.phaseStatus.theme,
    conceptValidation.score,
    conceptValidation.nextBestAction,
    loglineValidation.score,
    loglineValidation.nextBestAction,
    themeValidation.score,
    themeValidation.nextBestAction,
    missingConceptFields,
    missingLoglineRoadmapFields,
    missingThemeFields,
  ]);

  const loglineHasPlaceholders = state.logline.fullLogline.includes('[');

  // Contradiction detection (#8)
  const contradictions = useMemo(
    () => detectContradictions(state.concept, state.theme),
    [state.concept, state.theme]
  );

  // Weighted overall progress: 30% concept + 40% logline + 30% theme (#15)
  const overallProgress = useMemo(() => {
    let raw = Math.round(
      conceptValidation.score * 0.3 +
      loglineValidation.score * 0.4 +
      themeValidation.score * 0.3
    );
    // Cap at 60 if logline is below 40 — logline is the DNA gate
    if (loglineValidation.score < 40) raw = Math.min(raw, 60);
    return raw;
  }, [conceptValidation.score, loglineValidation.score, themeValidation.score]);

  const availableSubGenres = useMemo(
    () => SUB_GENRES[state.concept.genre] || [],
    [state.concept.genre]
  );
  const safeSubGenreValue = availableSubGenres.includes(state.concept.subGenre) ? state.concept.subGenre : '';
  const safeAudienceAgeValue = AUDIENCE_AGES.includes(state.concept.audienceAge) ? state.concept.audienceAge : '';

  // Generate logline from components — best-effort with placeholders for missing fields (D)
  const generateLogline = useCallback(() => {
    if (state.locks.logline) return;
    setState(prev => {
      const { protagonist, protagonistTrait, goal, antagonisticForce, stakes } = prev.logline;
      const prot = protagonist || '[HOVEDPERSON]';
      const g = goal || '[DEFINER MÅL]';
      const ant = antagonisticForce || '[ANTAGONISTISK KRAFT]';
      const st = stakes || '[DEFINER KONSEKVENSER]';
      const trait = protagonistTrait ? `${protagonistTrait} ` : '';
      const generated = `Når ${trait}${prot} må ${g}, møter hen ${ant} — ellers ${st}.`;
      return {
        ...prev,
        logline: { ...prev.logline, fullLogline: generated },
      };
    });
  }, [state.locks.logline]);

  // Update concept field
  const updateConcept = (field: keyof ConceptData, value: string | string[]) => {
    writingFlow.onActivity();
    setState(prev => ({
      ...prev,
      concept: { ...prev.concept, [field]: value },
    }));
  };

  // Update logline field
  const updateLogline = (field: keyof LoglineData, value: string | number) => {
    writingFlow.onActivity();
    setState(prev => ({
      ...prev,
      logline: { ...prev.logline, [field]: value },
    }));
  };

  // Update theme field
  const updateTheme = (field: keyof ThemeData, value: string | string[]) => {
    writingFlow.onActivity();
    setState(prev => ({
      ...prev,
      theme: { ...prev.theme, [field]: value },
    }));
  };

  // Per-phase lock toggle (#6)
  const togglePhaseLock = useCallback((phase: keyof PhaseLocks) => {
    setState(prev => ({
      ...prev,
      locks: { ...prev.locks, [phase]: !prev.locks[phase] },
    }));
  }, []);

  // Restore version (#11)
  const restoreVersion = useCallback((version: StoryVersion) => {
    if (!window.confirm(`Gjenopprette "${version.label}"? Nåværende arbeid lagres først som egen versjon.`)) return;
    saveVersion('Før gjenoppretting');
    try {
      const snap = JSON.parse(version.snapshot);
      setState(prev => ({ ...prev, concept: snap.concept, logline: snap.logline, theme: snap.theme }));
    } catch { /* invalid snapshot */ }
  }, [saveVersion]);

  const loadBrandImageAsset = useCallback(async (source?: string): Promise<{ dataUrl: string; width: number; height: number } | null> => {
    if (!source || typeof window === 'undefined') return null;
    try {
      const resolved = source.startsWith('http://') || source.startsWith('https://')
        ? source
        : new URL(source, window.location.origin).toString();
      const response = await fetch(resolved, { cache: 'force-cache' });
      if (!response.ok) return null;
      const imageBlob = await response.blob();
      const dataUrl = await blobToDataUrl(imageBlob);
      const dimensions = await readImageDimensions(dataUrl);
      return { dataUrl, width: dimensions.width, height: dimensions.height };
    } catch (error) {
      console.warn('Could not load branding logo for story logic PDF export:', error);
      return null;
    }
  }, []);

  // Export as PDF
  const exportPDF = useCallback(async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const lineHeight = 5;
    const now = new Date();
    const projectLabel = projectId || 'Ikke satt';

    const primaryRgb = hexToRgb(branding.colors.primary, [59, 130, 246]);
    const secondaryRgb = hexToRgb(branding.colors.secondary, [30, 64, 175]);
    const backgroundRgb = hexToRgb(branding.colors.background, [12, 17, 28]);
    const surfaceRgb = hexToRgb(branding.colors.surface, [248, 250, 252]);
    const borderRgb = hexToRgb(branding.colors.border, [203, 213, 225]);

    let y = 18;
    const logoAsset = await loadBrandImageAsset(branding.logoUrl || branding.iconUrl);

    doc.setProperties({
      title: 'Storylogikk rapport',
      subject: 'Story Logic',
      creator: branding.appName,
      author: branding.appName,
      keywords: 'storylogikk, manus, rolle room, eksport',
    });

    const safeValue = (value: string) => (value && value.trim().length > 0 ? value : '—');
    const ensureSpace = (needed = 10) => {
      if (y + needed <= pageHeight - margin) return;
      doc.addPage();
      y = 24;
      doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
      doc.line(margin, 16, pageWidth - margin, 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text('Storylogikk rapport', margin, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`${branding.appName} • ${projectLabel}`, pageWidth - margin, 12, { align: 'right' });
    };

    const addHeading = (text: string) => {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(text, margin, y);
      y += 8;
    };

    const addSection = (title: string, subtitle?: string) => {
      ensureSpace(subtitle ? 15 : 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(17, 24, 39);
      doc.text(title, margin, y);
      y += 6;
      if (subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        const lines = doc.splitTextToSize(subtitle, contentWidth);
        doc.text(lines, margin, y);
        y += lines.length * 4.2 + 1;
      }
      doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
    };

    const addBodyText = (text: string, indent = 0) => {
      const lines = doc.splitTextToSize(text, contentWidth - indent);
      ensureSpace(lines.length * lineHeight + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55);
      doc.text(lines, margin + indent, y);
      y += lines.length * lineHeight + 1.5;
    };

    const addField = (label: string, value: string, indent = 0) => {
      ensureSpace(9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(51, 65, 85);
      doc.text(label, margin + indent, y);
      y += 4.8;
      addBodyText(safeValue(value), indent + 1);
    };

    const drawMetricCard = (x: number, cardY: number, width: number, height: number, label: string, value: string, status: string) => {
      doc.setFillColor(surfaceRgb[0], surfaceRgb[1], surfaceRgb[2]);
      doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
      doc.roundedRect(x, cardY, width, height, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(label, x + 4, cardY + 6.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(value, x + 4, cardY + 14.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text(status, x + 4, cardY + 20.5);
    };

    const addLogo = (x: number, logoY: number, width: number, height: number) => {
      if (!logoAsset) return;
      const naturalAspect = logoAsset.width / logoAsset.height;
      let drawWidth = width;
      let drawHeight = drawWidth / naturalAspect;
      if (drawHeight > height) {
        drawHeight = height;
        drawWidth = drawHeight * naturalAspect;
      }
      const drawX = x + (width - drawWidth) / 2;
      const drawY = logoY + (height - drawHeight) / 2;
      try {
        doc.addImage(logoAsset.dataUrl, 'PNG', drawX, drawY, drawWidth, drawHeight, undefined, 'SLOW');
      } catch {
        try {
          doc.addImage(logoAsset.dataUrl, 'JPEG', drawX, drawY, drawWidth, drawHeight, undefined, 'SLOW');
        } catch {
          // Ignore logo format errors and continue export.
        }
      }
    };

    // Cover page
    doc.setFillColor(backgroundRgb[0], backgroundRgb[1], backgroundRgb[2]);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.rect(0, 0, pageWidth, 58, 'F');
    doc.setFillColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
    doc.rect(0, 58, pageWidth, 4, 'F');

    // Cover logo card: strong contrast + larger area for better readability.
    const coverLogoCardW = 140;
    const coverLogoCardH = 40;
    const coverLogoCardX = (pageWidth - coverLogoCardW) / 2;
    const coverLogoCardY = 7;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(coverLogoCardX, coverLogoCardY, coverLogoCardW, coverLogoCardH, 2.5, 2.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(coverLogoCardX, coverLogoCardY, coverLogoCardW, coverLogoCardH, 2.5, 2.5, 'S');
    addLogo(coverLogoCardX + 4, coverLogoCardY + 4, coverLogoCardW - 8, coverLogoCardH - 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text('Storylogikk', margin, 82);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(15);
    doc.text('Presentasjonsrapport', margin, 92);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11.5);
    doc.setTextColor(226, 232, 240);
    doc.text(`Prosjekt: ${projectLabel}`, margin, 106);
    doc.text(`Eksportert: ${now.toLocaleString('nb-NO')}`, margin, 113);
    doc.text(`Generert av: ${branding.appName}`, margin, 120);

    const cardsY = 136;
    const cardGap = 4;
    const cardWidth = (contentWidth - cardGap * 2) / 3;
    drawMetricCard(margin, cardsY, cardWidth, 24, 'Konsept', `${conceptValidation.score}%`, STATUS_LABELS[state.phaseStatus.concept]);
    drawMetricCard(margin + cardWidth + cardGap, cardsY, cardWidth, 24, 'Logline', `${loglineValidation.score}%`, STATUS_LABELS[state.phaseStatus.logline]);
    drawMetricCard(margin + (cardWidth + cardGap) * 2, cardsY, cardWidth, 24, 'Tema', `${themeValidation.score}%`, STATUS_LABELS[state.phaseStatus.theme]);

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 168, contentWidth, 28, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('Samlet progresjon', margin + 4, 176);
    doc.setFontSize(22);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text(`${overallProgress}%`, margin + 4, 189);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Basert på konsept, logline og tema/karakterintensjon.', margin + 34, 189);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225);
    doc.text('Konfidensiell arbeidsrapport for kreativ utvikling.', margin, pageHeight - 14);

    // Content pages
    doc.addPage();
    y = 24;
    doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
    doc.line(margin, 16, pageWidth - margin, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('Storylogikk rapport', margin, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`${branding.appName} • ${projectLabel}`, pageWidth - margin, 12, { align: 'right' });

    // Header logo card on content pages.
    const headerLogoCardW = 72;
    const headerLogoCardH = 16;
    const headerLogoCardX = (pageWidth - headerLogoCardW) / 2;
    const headerLogoCardY = 16.5;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(headerLogoCardX, headerLogoCardY, headerLogoCardW, headerLogoCardH, 1.8, 1.8, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(headerLogoCardX, headerLogoCardY, headerLogoCardW, headerLogoCardH, 1.8, 1.8, 'S');
    addLogo(headerLogoCardX + 2, headerLogoCardY + 2, headerLogoCardW - 4, headerLogoCardH - 4);

    addHeading('Storylogikk - Skrivekort');
    addBodyText(`Eksportert: ${now.toLocaleString('nb-NO')}`);
    y += 1;

    addSection('Konsept', 'Fase 1 • Validerer ideen før skriving.');
    addField(
      'Sjanger',
      `${nbLabel(state.concept.genre, GENRE_LABELS_NB)}${state.concept.subGenre ? ` (${nbLabel(state.concept.subGenre, SUB_GENRE_LABELS_NB)})` : ''}`
    );
    addField('Tone', state.concept.tone.map((tone) => nbLabel(tone, TONE_LABELS_NB)).join(', '));
    addField(
      'Målgruppe',
      `${safeValue(state.concept.targetAudience)}${state.concept.audienceAge ? ` (${nbLabel(state.concept.audienceAge, AUDIENCE_AGE_LABELS_NB)})` : ''}`
    );
    addField('Kjernepremiss', state.concept.corePremise);
    addField('Hvorfor nå', state.concept.whyNow);
    addField('Unik vinkel', state.concept.uniqueAngle);
    addField('Markedssammenligninger', state.concept.marketComparables);
    y += 1;

    addSection('Logline', 'Fase 2 • Definerer historiens DNA i én sterk pitchlinje.');
    addField('Komplett logline', state.logline.fullLogline);
    addField('Hovedperson', `${safeValue(state.logline.protagonist)} (${safeValue(state.logline.protagonistTrait)})`);
    addField('Mål', state.logline.goal);
    addField('Antagonistisk kraft', state.logline.antagonisticForce);
    addField('Konsekvenser', state.logline.stakes);
    y += 1;

    addSection('Tema og karakterintensjon', 'Fase 3 • Sikrer emosjonell og tematisk retning.');
    addField('Sentralt tema', state.theme.centralTheme);
    addField('Temapåstand', state.theme.themeStatement);
    addField('Moralsk argument', state.theme.moralArgument);
    addField('Protagonistens kjernefeil', state.theme.protagonistFlaw);
    addField('Opprinnelse til feil', state.theme.flawOrigin);
    addField('Hva må endres', state.theme.whatMustChange);
    addField('Transformasjonsbue', state.theme.transformationArc);
    addField(
      'Emosjonell reise',
      state.theme.emotionalJourney.map((emotion) => nbLabel(emotion, EMOTION_LABELS_NB)).join(' -> ')
    );

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 131, 148);
      doc.text(`${branding.appName} • Side ${page}/${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    doc.save(`storylogikk-rapport-${now.toISOString().split('T')[0]}.pdf`);
  }, [
    branding.appName,
    branding.colors.background,
    branding.colors.border,
    branding.colors.primary,
    branding.colors.secondary,
    branding.colors.surface,
    branding.iconUrl,
    branding.logoUrl,
    conceptValidation.score,
    loglineValidation.score,
    overallProgress,
    projectId,
    state.concept,
    state.logline,
    state.phaseStatus.concept,
    state.phaseStatus.logline,
    state.phaseStatus.theme,
    state.theme,
    themeValidation.score,
    loadBrandImageAsset,
  ]);

  // Reset all data
  const resetAll = async () => {
    if (window.confirm('Er du sikker på at du vil nullstille all storylogikkdata?')) {
      setState(DEFAULT_STATE);
      if (projectId) {
        await storyLogicService.deleteStoryLogic(projectId);
        refreshSyncMeta();
      }
    }
  };

  return (
    <Box
      sx={{
        height: '100%',
        overflow: 'auto',
        p: 2,
        // Glatt felt-fokus-glow på alle TextField/Select i hele panelet —
        // mentor-blå outline + dempet skygge ved focus, smooth transition
        // for skrive-flyt-følelse uten å være distraherende.
        '& .MuiOutlinedInput-root': {
          transition: 'box-shadow 220ms ease-out, border-color 220ms ease-out',
          '& fieldset': {
            transition: 'border-color 220ms ease-out',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#60a5fa',
            borderWidth: '1.5px',
          },
          '&.Mui-focused': {
            boxShadow: '0 0 0 4px rgba(96,165,250,0.16)',
          },
        },
        // Scroll-margin slik at jumpToField-feltet ikke ender helt øverst
        '& [data-storylogic-field]': {
          scrollMarginTop: '88px',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
            Storylogikk-system
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography variant="body2" sx={{ color: '#9ca3af' }}>
              Valider historiefundamentet før du begynner å skrive
            </Typography>
            {/* Save status indicator (#5) */}
            <AutoSaveBadge status={saveStatus} lastSavedAt={state.lastSaved} />
            <Tooltip title={syncMeta?.lastError || 'Story Logic er bundet til server og prosjekt-session.'}>
              <Chip
                size="small"
                label={syncStatusLabel}
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: `${syncStatusColor}22`,
                  color: syncStatusColor,
                  border: `1px solid ${syncStatusColor}55`,
                }}
              />
            </Tooltip>
            <WritingFlowBadge state={writingFlow.state} secondsInFlow={writingFlow.secondsInFlow} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Version history (#11) */}
          <Tooltip title="Versjonshistorikk">
            <IconButton
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              sx={{ color: '#6b7280' }}
            >
              <Badge badgeContent={state.versions.length} color="primary" max={9}>
                <HistoryIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          {/* Export button */}
          <Tooltip title="Eksporter som PDF">
            <IconButton onClick={exportPDF} sx={{ color: '#6b7280' }}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Nullstill alt">
            <span>
              <IconButton onClick={resetAll} sx={{ color: '#6b7280' }}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveToStorage}
            disabled={isSaving}
            sx={{
              bgcolor: '#3b82f6',
              '&:hover': { bgcolor: '#2563eb' },
            }}
          >
            {isSaving ? 'Lagrer...' : 'Lagre'}
          </Button>
        </Box>
      </Box>

      {/* Version history panel (#11) */}
      <Collapse in={showVersionHistory}>
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ color: '#fff' }}>Versjonshistorikk</Typography>
            <Button size="small" onClick={() => saveVersion()} startIcon={<SaveIcon />} sx={{ color: '#60a5fa', textTransform: 'none' }}>
              Lagre øyeblikksbilde
            </Button>
          </Box>
          {state.versions.length === 0 ? (
            <Typography variant="caption" sx={{ color: '#6b7280' }}>Ingen versjoner lagret ennå.</Typography>
          ) : (
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {[...state.versions].reverse().map((v) => (
                <Box key={v.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#d4d4d8' }}>{v.label}</Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>{new Date(v.timestamp).toLocaleString()}</Typography>
                  </Box>
                  <Button size="small" onClick={() => restoreVersion(v)} sx={{ color: '#a78bfa', textTransform: 'none', fontSize: '0.7rem' }}>
                    Gjenopprett
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Collapse>

      {/* Premise change alert — soft versioning (#5) */}
      {premiseChangeAlert && (
        <Alert
          severity="info"
          onClose={() => setPremiseChangeAlert(null)}
          action={
            <Button size="small" onClick={() => { saveVersion('Før premissendring'); setPremiseChangeAlert(null); }} sx={{ color: '#60a5fa', textTransform: 'none' }}>
              Lagre versjon
            </Button>
          }
          sx={{ mb: 2, bgcolor: 'rgba(59,130,246,0.08)', color: '#93c5fd', '& .MuiAlert-icon': { color: '#3b82f6' } }}
        >
          {premiseChangeAlert}
        </Alert>
      )}

      {/* Start-With Mode selector — non-linear entry (#10) */}
      {!startMode && overallProgress < 10 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ color: '#d4d4d8', mb: 1.5 }}>
            Hvor vil du starte?
          </Typography>
          <Box sx={starterCardsGridSx}>
            {START_MODES.map((mode) => {
              const Icon = mode.Icon;
              return (
                <Button
                  key={mode.id}
                  variant="outlined"
                  onClick={() => handleStartMode(mode.id)}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.15)',
                    color: '#d4d4d8',
                    textTransform: 'none',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    width: '100%',
                    minHeight: 92,
                    px: 2, py: 1.5,
                    '&:hover': { borderColor: '#60a5fa', bgcolor: 'rgba(59,130,246,0.05)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Icon sx={{ fontSize: '1.4rem', color: mode.iconColor }} />
                    <Typography sx={{ fontSize: '1rem', fontWeight: 600 }}>{mode.label}</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#6b7280' }}>{mode.description}</Typography>
                </Button>
              );
            })}
          </Box>
          <Button
            size="small"
            onClick={() => setShowTemplates(!showTemplates)}
            endIcon={showTemplates ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ color: '#a78bfa', textTransform: 'none', mt: 1.5, fontSize: '0.8rem' }}
          >
            Eller start fra en mal
          </Button>
          <Collapse in={showTemplates}>
            <Box sx={templateCardsGridSx}>
              {STORY_TEMPLATES.map((tpl) => (
                <Chip
                  key={tpl.id}
                  label={tpl.name}
                  onClick={() => applyTemplate(tpl)}
                  onDelete={() => applyTemplate(tpl)}
                  deleteIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    bgcolor: 'rgba(139,92,246,0.08)',
                    color: '#c084fc',
                    border: '1px solid rgba(139,92,246,0.2)',
                    width: '100%',
                    justifyContent: 'space-between',
                    '&:hover': { bgcolor: 'rgba(139,92,246,0.15)' },
                  }}
                />
              ))}
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* Overall Progress — Confidence Score, not percentage police (#4) */}
      <Paper
        sx={{
          p: 2,
          mb: 3,
          bgcolor: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ color: '#d4d4d8' }}>
            Historie-selvtillit
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size="small"
              label={getConfidenceTier(overallProgress).label}
              sx={{ bgcolor: `${getConfidenceTier(overallProgress).color}20`, color: getConfidenceTier(overallProgress).color, fontWeight: 600 }}
            />
            <Typography variant="caption" sx={{ color: '#6b7280' }}>
              {overallProgress}%
            </Typography>
          </Box>
        </Box>
        <LinearProgress
          variant="determinate"
          value={overallProgress}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: 'rgba(255,255,255,0.08)',
            '& .MuiLinearProgress-bar': {
              bgcolor: getEnergyColor(overallProgress),
              borderRadius: 4,
            },
          }}
        />
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Chip
            label={`Konsept: ${STATUS_LABELS[state.phaseStatus.concept]}`}
            size="small"
            sx={{
              bgcolor: `${state.phaseStatus.concept === 'ready' ? '#10b981' : state.phaseStatus.concept === 'weak' ? '#f59e0b' : '#9ca3af'}15`,
              color: state.phaseStatus.concept === 'ready' ? '#10b981' : state.phaseStatus.concept === 'weak' ? '#f59e0b' : '#9ca3af',
            }}
          />
          <Chip
            label={`Logline: ${STATUS_LABELS[state.phaseStatus.logline]}`}
            size="small"
            sx={{
              bgcolor: `${state.phaseStatus.logline === 'ready' ? '#10b981' : state.phaseStatus.logline === 'weak' ? '#f59e0b' : '#9ca3af'}15`,
              color: state.phaseStatus.logline === 'ready' ? '#10b981' : state.phaseStatus.logline === 'weak' ? '#f59e0b' : '#9ca3af',
            }}
          />
          <Chip
            label={`Tema: ${STATUS_LABELS[state.phaseStatus.theme]}`}
            size="small"
            sx={{
              bgcolor: `${state.phaseStatus.theme === 'ready' ? '#10b981' : state.phaseStatus.theme === 'weak' ? '#f59e0b' : '#9ca3af'}15`,
              color: state.phaseStatus.theme === 'ready' ? '#10b981' : state.phaseStatus.theme === 'weak' ? '#f59e0b' : '#9ca3af',
            }}
          />
        </Box>
        {/* Contradiction alerts (#8) */}
        {contradictions.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            {contradictions.map((c, i) => (
              <Alert key={i} severity="warning" icon={<ContradictionIcon />} sx={{ mb: 0.5, bgcolor: 'rgba(245,158,11,0.08)', color: '#fbbf24', py: 0, '& .MuiAlert-icon': { color: '#f59e0b' } }}>
                <Typography variant="caption">{c}</Typography>
              </Alert>
            ))}
          </Box>
        )}
        {state.lastSaved && (
          <Typography variant="caption" sx={{ color: '#6b7280', mt: 1, display: 'block' }}>
            Sist lagret: {new Date(state.lastSaved).toLocaleString()}
          </Typography>
        )}
      </Paper>

      {/* Phase roadmap: clearer structure across all phases */}
      <Paper
        sx={{
          p: 2,
          mb: 2,
          bgcolor: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 2,
        }}
      >
        <Typography variant="subtitle1" sx={{ color: '#f4f4f5', mb: 1.5, fontWeight: 600 }}>
          Faseoversikt
        </Typography>
        <Box sx={phaseRoadmapGridSx}>
          {phaseRoadmap.map((phase) => (
            <Box key={phase.key}>
              <Card
                sx={{
                  bgcolor: expandedPhase === phase.index ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.03)',
                  border: expandedPhase === phase.index ? '1px solid rgba(59,130,246,0.45)' : '1px solid rgba(255,255,255,0.09)',
                  height: '100%',
                }}
              >
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>
                      Fase {phase.index + 1}
                    </Typography>
                    <Chip
                      size="small"
                      label={STATUS_LABELS[phase.status]}
                      sx={{
                        bgcolor: `${phase.status === 'ready' ? '#10b981' : phase.status === 'weak' ? '#f59e0b' : '#9ca3af'}20`,
                        color: phase.status === 'ready' ? '#10b981' : phase.status === 'weak' ? '#f59e0b' : '#9ca3af',
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: '#d4d4d8', mb: 1 }}>
                    {phase.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9ca3af', display: 'block' }}>
                    Selvtillit: {phase.score}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9ca3af', display: 'block', mb: 1.25 }}>
                    Mangler: {phase.missingFields.length}
                    {phase.missingFields.length > 0 ? ` (${phase.missingFields.slice(0, 2).join(', ')})` : ''}
                  </Typography>
                  {phase.nextBestAction && phase.status !== 'ready' && (
                    <Typography variant="caption" sx={{ color: '#93c5fd', display: 'block', mb: 1.25 }}>
                      Neste: {phase.nextBestAction}
                    </Typography>
                  )}
                  <Button
                    size="small"
                    variant={expandedPhase === phase.index ? 'contained' : 'outlined'}
                    onClick={() => goToPhase(phase.index)}
                    sx={{
                      textTransform: 'none',
                      ...(expandedPhase === phase.index
                        ? { bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }
                        : { color: '#93c5fd', borderColor: 'rgba(147,197,253,0.5)' }),
                    }}
                  >
                    Åpne fase
                  </Button>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Fase 1: Konsept */}
      <Accordion
        expanded={expandedPhase === 0}
        onChange={(_, isExpanded) => {
          if (isExpanded) {
            goToPhase(0);
            return;
          }
          setExpandedPhase(-1);
        }}
        sx={{
          bgcolor: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px !important',
          mb: 2,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
          <PhaseHeader
            number={1}
            title="Konsept"
            purpose="Valider ideen før skriving. Er dette verdt måneders arbeid?"
            icon={<LightbulbIcon sx={{ color: '#fbbf24' }} />}
            status={state.phaseStatus.concept}
            locked={state.locks.concept}
            onToggleLock={() => togglePhaseLock('concept')}
            nextBestAction={state.phaseStatus.concept !== 'ready' && !state.locks.concept ? conceptValidation.nextBestAction : null}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={phaseFormGridSx}>
            {/* Kjernepremiss */}
            <Box sx={phaseFullSpanSx}>
              <Box ref={registerFieldRef('corePremise')} sx={{ ...getFieldHighlightSx('corePremise') }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Kjernepremiss"
                placeholder="Hva handler historien om i 2-3 setninger? Den grunnleggende ideen."
                value={state.concept.corePremise}
                onChange={(e) => updateConcept('corePremise', e.target.value)}
                disabled={state.locks.concept}
                inputProps={{ 'aria-label': 'Kjernepremiss' }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
              </Box>
            </Box>

            {/* Sjanger og undersjanger */}
            <Box>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#9ca3af' }}>Hovedsjanger</InputLabel>
                <Select
                  value={state.concept.genre}
                  label="Hovedsjanger"
                  onChange={(e) => {
                    updateConcept('genre', e.target.value);
                    updateConcept('subGenre', '');
                  }}
                  disabled={state.locks.concept}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
                  }}
                >
                  {GENRES.map((genre) => (
                    <MenuItem key={genre} value={genre}>{nbLabel(genre, GENRE_LABELS_NB)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#9ca3af' }}>Undersjanger</InputLabel>
                <Select
                  value={safeSubGenreValue}
                  label="Undersjanger"
                  onChange={(e) => updateConcept('subGenre', e.target.value)}
                  disabled={state.locks.concept || !state.concept.genre}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
                  }}
                >
                  {availableSubGenres.map((sub) => (
                    <MenuItem key={sub} value={sub}>{nbLabel(sub, SUB_GENRE_LABELS_NB)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Tone Selection */}
            <Box sx={phaseFullSpanSx}>
              <Typography variant="subtitle2" sx={{ color: '#9ca3af', mb: 1 }}>
                Tone (velg 1-3)
              </Typography>
              {/* Genre-based tone presets (C) */}
              {state.concept.genre && GENRE_TONE_PRESETS[state.concept.genre] && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <AutoAwesomeIcon sx={{ fontSize: 14 }} /> Forslag for {nbLabel(state.concept.genre, GENRE_LABELS_NB)}:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {GENRE_TONE_PRESETS[state.concept.genre].map((combo, i) => (
                      <Chip
                        key={i}
                        label={combo.map((tone) => nbLabel(tone, TONE_LABELS_NB)).join(' + ')}
                        size="small"
                        icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                        onClick={() => {
                          if (!state.locks.concept) updateConcept('tone', combo);
                        }}
                        disabled={state.locks.concept}
                        sx={{
                          bgcolor: 'rgba(139, 92, 246, 0.1)',
                          color: '#a78bfa',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          '& .MuiChip-icon': { color: '#a78bfa' },
                          '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.2)' },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              {/* Grouped tone selection (#7) */}
              {TONE_GROUPS.map((group) => (
                <Box key={group.label} sx={{ mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600, mb: 0.5, display: 'block' }}>
                    {group.label}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {group.tones.map((tone) => (
                      <Chip
                        key={tone}
                        label={nbLabel(tone, TONE_LABELS_NB)}
                        tabIndex={0}
                        role="checkbox"
                        aria-checked={state.concept.tone.includes(tone)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (!state.locks.concept) {
                              const current = state.concept.tone;
                              if (current.includes(tone)) {
                                updateConcept('tone', current.filter(t => t !== tone));
                              } else if (current.length < 3) {
                                updateConcept('tone', [...current, tone]);
                              }
                            }
                          }
                        }}
                        onClick={() => {
                          if (state.locks.concept) return;
                          const current = state.concept.tone;
                          if (current.includes(tone)) {
                            updateConcept('tone', current.filter(t => t !== tone));
                          } else if (current.length < 3) {
                            updateConcept('tone', [...current, tone]);
                          }
                        }}
                        sx={{
                          bgcolor: state.concept.tone.includes(tone) ? '#3b82f620' : 'rgba(255,255,255,0.05)',
                          color: state.concept.tone.includes(tone) ? '#60a5fa' : '#9ca3af',
                          border: state.concept.tone.includes(tone) ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                          cursor: state.locks.concept ? 'not-allowed' : 'pointer',
                          '&:hover': {
                            bgcolor: state.locks.concept ? undefined : '#3b82f610',
                          },
                          '&:focus-visible': { outline: '2px solid #60a5fa', outlineOffset: 2 },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>

            {/* Målgruppe */}
            <Box>
              <TextField
                fullWidth
                label="Målgruppe"
                placeholder="Hvem er historien for? Vær konkret."
                value={state.concept.targetAudience}
                onChange={(e) => updateConcept('targetAudience', e.target.value)}
                disabled={state.locks.concept}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>
            <Box>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#9ca3af' }}>Aldersgruppe</InputLabel>
                <Select
                  value={safeAudienceAgeValue}
                  label="Aldersgruppe"
                  onChange={(e) => updateConcept('audienceAge', e.target.value)}
                  disabled={state.locks.concept}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  {AUDIENCE_AGES.map((age) => (
                    <MenuItem key={age} value={age}>{nbLabel(age, AUDIENCE_AGE_LABELS_NB)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Why Now — with field ref and genre examples (#4) */}
            <Box sx={phaseFullSpanSx}>
              <Box ref={registerFieldRef('whyNow')} sx={{ ...getFieldHighlightSx('whyNow') }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Hvorfor denne historien nå?"
                placeholder="Hva gjør historien relevant i dag? Hvorfor skal publikum bry seg NÅ?"
                value={state.concept.whyNow}
                onChange={(e) => updateConcept('whyNow', e.target.value)}
                disabled={state.locks.concept}
                helperText={FIELD_EXAMPLES.whyNow[state.concept.genre] || FIELD_EXAMPLES.whyNow._default}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                  '& .MuiFormHelperText-root': { color: '#6b7280', fontStyle: 'italic' },
                }}
              />
              </Box>
            </Box>

            {/* Unik vinkel — med feltreferanse og sjangereksempler (#4) */}
            <Box sx={phaseFullSpanSx}>
              <Box ref={registerFieldRef('uniqueAngle')} sx={{ ...getFieldHighlightSx('uniqueAngle') }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Unik vinkel"
                placeholder="Hva gjør DIN versjon av dette konseptet annerledes enn alt annet?"
                value={state.concept.uniqueAngle}
                onChange={(e) => updateConcept('uniqueAngle', e.target.value)}
                disabled={state.locks.concept}
                helperText={FIELD_EXAMPLES.uniqueAngle[state.concept.genre] || FIELD_EXAMPLES.uniqueAngle._default}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                  '& .MuiFormHelperText-root': { color: '#6b7280', fontStyle: 'italic' },
                }}
              />
              </Box>
            </Box>

            {/* Markedssammenligninger */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                label="Markedssammenligninger"
                placeholder="f.eks. 'Inception møter The Matrix' eller 'Breaking Bad i motebransjen'"
                value={state.concept.marketComparables}
                onChange={(e) => updateConcept('marketComparables', e.target.value)}
                disabled={state.locks.concept}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>
          </Box>

          {showValidation && (
            <Box sx={{ position: 'relative' }}>
              <ConfidenceDeltaToast event={conceptDelta} />
              <ValidationDisplay result={conceptValidation} title="Konsept" onJumpToField={jumpToField} />
            </Box>
          )}

          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.12)',
              bgcolor: 'rgba(255,255,255,0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="caption" sx={{ color: '#9ca3af' }}>
              Fase 1 har {missingConceptFields.length} nøkkelfelt igjen.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              endIcon={<ArrowForwardIcon />}
              onClick={() => goToPhase(1)}
              sx={{ textTransform: 'none', color: '#93c5fd', borderColor: 'rgba(147,197,253,0.45)' }}
            >
              Neste: Logline
            </Button>
          </Box>

          {/* Reality Check Prompt — concept (#6) */}
          {conceptValidation.score >= 20 && conceptValidation.score < 70 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(139,92,246,0.06)', borderRadius: 2, borderLeft: '3px solid rgba(139,92,246,0.3)', display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <PsychologyIcon sx={{ fontSize: '1rem', color: '#a78bfa', mt: 0.25, flexShrink: 0 }} aria-hidden />
              <Typography variant="caption" sx={{ color: '#a78bfa', fontStyle: 'italic' }}>
                {conceptRealityPrompt}
              </Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Fase 2: Logline */}
      <Accordion
        expanded={expandedPhase === 1}
        onChange={(_, isExpanded) => {
          if (isExpanded) {
            goToPhase(1);
            return;
          }
          setExpandedPhase(-1);
        }}
        sx={{
          bgcolor: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px !important',
          mb: 2,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
          <PhaseHeader
            number={2}
            title="Logline"
            purpose="Definer historiens DNA i én setning. Er den svak, bør du ikke gå videre."
            icon={<CreateIcon sx={{ color: '#60a5fa' }} />}
            status={state.phaseStatus.logline}
            locked={state.locks.logline}
            onToggleLock={() => togglePhaseLock('logline')}
            nextBestAction={state.phaseStatus.logline !== 'ready' && !state.locks.logline ? loglineValidation.nextBestAction : null}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Alert
            severity="info"
            sx={{
              mb: 2,
              bgcolor: 'rgba(59, 130, 246, 0.1)',
              color: '#60a5fa',
              '& .MuiAlert-icon': { color: '#3b82f6' },
            }}
          >
            <strong>Logline-formel:</strong> Når [HOVEDPERSON] må [MÅL], møter hen [ANTAGONISTISK KRAFT] — ellers [KONSEKVENSER].
          </Alert>

          <Box sx={phaseFormGridSx}>
            {/* Hovedperson */}
            <Box>
              <TextField
                fullWidth
                label="Hovedperson"
                placeholder="Hvem er hovedkarakteren? (rolle/yrke)"
                value={state.logline.protagonist}
                onChange={(e) => updateLogline('protagonist', e.target.value)}
                disabled={state.locks.logline}
                error={loglineHasPlaceholders && !state.logline.protagonist}
                helperText={loglineHasPlaceholders && !state.logline.protagonist ? 'Påkrevd for komplett logline' : undefined}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Definerende trekk"
                placeholder="f.eks. 'utbrent', 'naiv', 'nådeløs'"
                value={state.logline.protagonistTrait}
                onChange={(e) => updateLogline('protagonistTrait', e.target.value)}
                disabled={state.locks.logline}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Goal */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                label="Mål"
                placeholder="Hva må protagonisten oppnå? (handlingsverb + mål)"
                value={state.logline.goal}
                onChange={(e) => updateLogline('goal', e.target.value)}
                disabled={state.locks.logline}
                error={loglineHasPlaceholders && !state.logline.goal}
                helperText={loglineHasPlaceholders && !state.logline.goal ? 'Påkrevd for komplett logline' : undefined}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Antagonistic Force */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                label="Antagonistisk kraft"
                placeholder="Person, system, indre konflikt eller naturkraft"
                value={state.logline.antagonisticForce}
                onChange={(e) => updateLogline('antagonisticForce', e.target.value)}
                disabled={state.locks.logline}
                error={loglineHasPlaceholders && !state.logline.antagonisticForce}
                helperText={loglineHasPlaceholders && !state.logline.antagonisticForce ? 'Påkrevd for komplett logline' : undefined}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Stakes */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                label="Konsekvenser"
                placeholder="Hva skjer hvis protagonisten feiler? (konsekvenser)"
                value={state.logline.stakes}
                onChange={(e) => updateLogline('stakes', e.target.value)}
                disabled={state.locks.logline}
                error={loglineHasPlaceholders && !state.logline.stakes}
                helperText={loglineHasPlaceholders && !state.logline.stakes ? 'Påkrevd for komplett logline' : undefined}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Generer-knapp */}
            <Box sx={phaseFullSpanSx}>
              <Button
                variant="outlined"
                startIcon={<AutoAwesomeIcon />}
                onClick={generateLogline}
                disabled={state.locks.logline}
                sx={{
                  borderColor: '#8b5cf6',
                  color: '#a78bfa',
                  '&:hover': {
                    borderColor: '#a78bfa',
                    bgcolor: 'rgba(139, 92, 246, 0.1)',
                  },
                }}
              >
                Generer logline fra komponenter
              </Button>
            </Box>

            {/* Full Logline */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Komplett logline"
                placeholder="Skriv komplett logline her (ideelt 25-50 ord)"
                value={state.logline.fullLogline}
                onChange={(e) => updateLogline('fullLogline', e.target.value)}
                disabled={state.locks.logline}
                helperText={(() => {
                  const wordCount = state.logline.fullLogline.split(/\s+/).filter((w: string) => w).length;
                  const inRange = wordCount >= 25 && wordCount <= 45;
                  const rangeLabel = inRange ? '✓ ideelt område' : wordCount < 25 ? 'fortsett' : 'vurder å korte ned';
                  const missing = missingLoglineFields.length > 0 && loglineHasPlaceholders
                    ? ` — Mangler: ${missingLoglineFields.join(', ')}`
                    : '';
                  return `${wordCount} ord (ideelt: 25–45 · ${rangeLabel})${missing}`;
                })()}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                  '& .MuiFormHelperText-root': {
                    color: (() => {
                      const wc = state.logline.fullLogline.split(/\s+/).filter((w: string) => w).length;
                      if (loglineHasPlaceholders && missingLoglineFields.length > 0) return '#f59e0b';
                      if (wc >= 25 && wc <= 45) return '#10b981';
                      return '#9ca3af';
                    })(),
                  },
                }}
              />
            </Box>

            {/* Logline Score */}
            <Box sx={phaseFullSpanSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#9ca3af' }}>
                  Logline-styrke:
                </Typography>
                <Rating
                  value={Math.round(loglineValidation.score / 20)}
                  readOnly
                  icon={<StarIcon sx={{ color: '#fbbf24' }} />}
                  emptyIcon={<StarIcon sx={{ color: 'rgba(255,255,255,0.2)' }} />}
                />
                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                  ({loglineValidation.score}%)
                </Typography>
              </Box>
            </Box>
          </Box>

          {showValidation && (
            <Box sx={{ position: 'relative' }}>
              <ConfidenceDeltaToast event={loglineDelta} />
              <ValidationDisplay result={loglineValidation} title="Logline" onJumpToField={jumpToField} />
            </Box>
          )}

          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.12)',
              bgcolor: 'rgba(255,255,255,0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="caption" sx={{ color: '#9ca3af' }}>
              Fase 2 har {missingLoglineRoadmapFields.length} nøkkelfelt igjen.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              endIcon={<ArrowForwardIcon />}
              onClick={() => goToPhase(2)}
              sx={{ textTransform: 'none', color: '#93c5fd', borderColor: 'rgba(147,197,253,0.45)' }}
            >
              Neste: Tema
            </Button>
          </Box>

          {/* Reality Check Prompt — logline (#6) */}
          {loglineValidation.score >= 20 && loglineValidation.score < 70 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(139,92,246,0.06)', borderRadius: 2, borderLeft: '3px solid rgba(139,92,246,0.3)', display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <PsychologyIcon sx={{ fontSize: '1rem', color: '#a78bfa', mt: 0.25, flexShrink: 0 }} aria-hidden />
              <Typography variant="caption" sx={{ color: '#a78bfa', fontStyle: 'italic' }}>
                {loglineRealityPrompt}
              </Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Fase 3: Tema og karakterintensjon */}
      <Accordion
        expanded={expandedPhase === 2}
        onChange={(_, isExpanded) => {
          if (isExpanded) {
            goToPhase(2);
            return;
          }
          setExpandedPhase(-1);
        }}
        sx={{
          bgcolor: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px !important',
          mb: 2,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
          <PhaseHeader
            number={3}
            title="Tema og karakterintensjon"
            purpose="Gi historien mening. Dette hindrer at manuset blir hult eller episodisk."
            icon={<PsychologyIcon sx={{ color: '#a78bfa' }} />}
            status={state.phaseStatus.theme}
            locked={state.locks.theme}
            onToggleLock={() => togglePhaseLock('theme')}
            nextBestAction={state.phaseStatus.theme !== 'ready' && !state.locks.theme ? themeValidation.nextBestAction : null}
            showAdvanceShortcutHint={false}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={phaseFormGridSx}>
            {/* Sentralt tema */}
            <Box>
              <TextField
                fullWidth
                label="Sentralt tema"
                placeholder="f.eks. forsoning, identitet, makt, kjærlighet, offer"
                value={state.theme.centralTheme}
                onChange={(e) => updateTheme('centralTheme', e.target.value)}
                disabled={state.locks.theme}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Moralsk argument"
                placeholder="Hva er historiens standpunkt til temaet?"
                value={state.theme.moralArgument}
                onChange={(e) => updateTheme('moralArgument', e.target.value)}
                disabled={state.locks.theme}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Temapåstand — med feltreferanse og sjangereksempler (#4) */}
            <Box sx={phaseFullSpanSx}>
              <Box ref={registerFieldRef('themeStatement')} sx={{ ...getFieldHighlightSx('themeStatement') }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Temapåstand"
                placeholder="Denne historien argumenterer for at ... (fullfør setningen)"
                value={state.theme.themeStatement}
                onChange={(e) => updateTheme('themeStatement', e.target.value)}
                disabled={state.locks.theme}
                helperText={FIELD_EXAMPLES.themeStatement[state.concept.genre] || FIELD_EXAMPLES.themeStatement._default}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                  '& .MuiFormHelperText-root': { color: '#6b7280', fontStyle: 'italic' },
                }}
              />
              </Box>
            </Box>

            <Box sx={phaseFullSpanSx}>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />
              <Typography variant="subtitle1" sx={{ color: '#fff', mt: 1, mb: 1 }}>
                Karaktertransformasjon
              </Typography>
            </Box>

            {/* Protagonist Flaw */}
            <Box>
              <TextField
                fullWidth
                label="Protagonistens kjernefeil"
                placeholder="Hvilken indre svakhet holder dem tilbake?"
                value={state.theme.protagonistFlaw}
                onChange={(e) => updateTheme('protagonistFlaw', e.target.value)}
                disabled={state.locks.theme}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Opprinnelse til feil"
                placeholder="Hvor kommer denne feilen fra? (bakgrunnshistorie)"
                value={state.theme.flawOrigin}
                onChange={(e) => updateTheme('flawOrigin', e.target.value)}
                disabled={state.locks.theme}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* What Must Change */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Hva må endres innen slutten"
                placeholder="Hvilken tro, atferd eller verdensforståelse må protagonisten forlate eller omfavne?"
                value={state.theme.whatMustChange}
                onChange={(e) => updateTheme('whatMustChange', e.target.value)}
                disabled={state.locks.theme}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Transformasjonsbue */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Transformasjonsbue"
                placeholder="Beskriv reisen fra mangelfull start til transformert slutt. Hvordan endrer de seg?"
                value={state.theme.transformationArc}
                onChange={(e) => updateTheme('transformationArc', e.target.value)}
                disabled={state.locks.theme}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Emotional Journey */}
            <Box sx={phaseFullSpanSx}>
              <Typography variant="subtitle2" sx={{ color: '#9ca3af', mb: 1 }}>
                Emosjonell reise (velg 3-5 nøkkelfølelser)
              </Typography>
              {/* Genre-based emotion presets (C) */}
              {state.concept.genre && GENRE_EMOTION_PRESETS[state.concept.genre] && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <AutoAwesomeIcon sx={{ fontSize: 14 }} /> Foreslått bue for {nbLabel(state.concept.genre, GENRE_LABELS_NB)}:
                  </Typography>
                  <Chip
                    label={GENRE_EMOTION_PRESETS[state.concept.genre].map((emotion) => nbLabel(emotion, EMOTION_LABELS_NB)).join(' → ')}
                    size="small"
                    icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                    onClick={() => {
                      if (!state.locks.theme) updateTheme('emotionalJourney', GENRE_EMOTION_PRESETS[state.concept.genre]);
                    }}
                    disabled={state.locks.theme}
                    sx={{
                      bgcolor: 'rgba(139, 92, 246, 0.1)',
                      color: '#a78bfa',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      '& .MuiChip-icon': { color: '#a78bfa' },
                      '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.2)' },
                    }}
                  />
                </Box>
              )}
              {/* Grouped emotion selection by act structure (#7) */}
              {EMOTION_GROUPS.map((group) => (
                <Box key={group.label} sx={{ mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600, mb: 0.5, display: 'block' }}>
                    {group.label}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {group.emotions.map((emotion) => (
                      <Chip
                        key={emotion}
                        label={nbLabel(emotion, EMOTION_LABELS_NB)}
                        tabIndex={0}
                        role="checkbox"
                        aria-checked={state.theme.emotionalJourney.includes(emotion)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (!state.locks.theme) {
                              const current = state.theme.emotionalJourney;
                              if (current.includes(emotion)) {
                                updateTheme('emotionalJourney', current.filter(em => em !== emotion));
                              } else if (current.length < 5) {
                                updateTheme('emotionalJourney', [...current, emotion]);
                              }
                            }
                          }
                        }}
                        onClick={() => {
                          if (state.locks.theme) return;
                          const current = state.theme.emotionalJourney;
                          if (current.includes(emotion)) {
                            updateTheme('emotionalJourney', current.filter(em => em !== emotion));
                          } else if (current.length < 5) {
                            updateTheme('emotionalJourney', [...current, emotion]);
                          }
                        }}
                        sx={{
                          bgcolor: state.theme.emotionalJourney.includes(emotion) ? '#8b5cf620' : 'rgba(255,255,255,0.05)',
                          color: state.theme.emotionalJourney.includes(emotion) ? '#a78bfa' : '#9ca3af',
                          border: state.theme.emotionalJourney.includes(emotion) ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)',
                          cursor: state.locks.theme ? 'not-allowed' : 'pointer',
                          '&:hover': {
                            bgcolor: state.locks.theme ? undefined : '#8b5cf610',
                          },
                          '&:focus-visible': { outline: '2px solid #a78bfa', outlineOffset: 2 },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
              {state.theme.emotionalJourney.length > 0 && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(139, 92, 246, 0.1)', borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ color: '#a78bfa' }}>
                    Emosjonell bue: {state.theme.emotionalJourney.map((emotion) => nbLabel(emotion, EMOTION_LABELS_NB)).join(' → ')}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {showValidation && (
            <Box sx={{ position: 'relative' }}>
              <ConfidenceDeltaToast event={themeDelta} />
              <ValidationDisplay result={themeValidation} title="Tema" onJumpToField={jumpToField} />
            </Box>
          )}

          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.12)',
              bgcolor: 'rgba(255,255,255,0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="caption" sx={{ color: '#9ca3af' }}>
              Fase 3 har {missingThemeFields.length} nøkkelfelt igjen.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => goToPhase(0)}
              sx={{ textTransform: 'none', color: '#93c5fd', borderColor: 'rgba(147,197,253,0.45)' }}
            >
              Se gjennom fase 1
            </Button>
          </Box>

          {/* Reality Check Prompt — theme (#6) */}
          {themeValidation.score >= 20 && themeValidation.score < 70 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(139,92,246,0.06)', borderRadius: 2, borderLeft: '3px solid rgba(139,92,246,0.3)', display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <PsychologyIcon sx={{ fontSize: '1rem', color: '#a78bfa', mt: 0.25, flexShrink: 0 }} aria-hidden />
              <Typography variant="caption" sx={{ color: '#a78bfa', fontStyle: 'italic' }}>
                {themeRealityPrompt}
              </Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Summary Card — Exit with Confidence (#7) */}
      {overallProgress >= 70 && (
        <Fade in>
          <Card
            sx={{
              bgcolor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid #10b981',
              borderRadius: 2,
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <CheckIcon sx={{ color: '#10b981', fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: '#10b981' }}>
                    Klar til å skrive
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                    Du er mindre utsatt for å kaste bort sider i førsteutkastet.
                  </Typography>
                </Box>
              </Box>

              {/* Exit-with-Confidence Checklist */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {[
                  { label: 'Konflikt er tydelig', check: (state.logline.antagonisticForce || '').length > 5 },
                  { label: 'Konsekvenser er konkrete', check: (state.logline.stakes || '').length > 10 },
                  { label: 'Karakterbue er definert', check: (state.theme.transformationArc || '').length > 20 },
                  { label: 'Tema er forankret', check: (state.theme.themeStatement || '').length > 20 },
                  { label: 'Logline er komplett', check: (state.logline.fullLogline || '').length > 20 },
                ].map((item) => (
                  <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {item.check ? (
                      <CheckIcon sx={{ color: '#10b981', fontSize: 18 }} />
                    ) : (
                      <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #4b5563' }} />
                    )}
                    <Typography variant="body2" sx={{ color: item.check ? '#d4d4d8' : '#6b7280' }}>
                      {item.label}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 2 }} />
              <Typography variant="subtitle2" sx={{ color: '#d4d4d8', mb: 1 }}>
                Oppsummering
              </Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                <strong>Sjanger:</strong> {nbLabel(state.concept.genre, GENRE_LABELS_NB)} {state.concept.subGenre && `(${nbLabel(state.concept.subGenre, SUB_GENRE_LABELS_NB)})`}
              </Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                <strong>Tone:</strong> {state.concept.tone.map((tone) => nbLabel(tone, TONE_LABELS_NB)).join(', ')}
              </Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                <strong>Tema:</strong> {state.theme.centralTheme}
              </Typography>
              {state.logline.fullLogline && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ color: '#fff', fontStyle: 'italic' }}>
                    "{state.logline.fullLogline}"
                  </Typography>
                </Box>
              )}
              {/* Actions: fortsett til Story Writer + eksport */}
              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                {onNavigateToStoryWriter && (
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    onClick={onNavigateToStoryWriter}
                    sx={{ bgcolor: '#10b981', color: '#06281d', textTransform: 'none', '&:hover': { bgcolor: '#0ea371' } }}
                    variant="contained"
                  >
                    Gå til Story Writer
                  </Button>
                )}
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={exportPDF}
                  sx={{ color: '#10b981', borderColor: '#10b981', textTransform: 'none' }}
                  variant="outlined"
                >
                  Eksporter PDF
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      )}
    </Box>
  );
};

export default StoryLogicPanel;
