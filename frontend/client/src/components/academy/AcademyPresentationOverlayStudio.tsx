import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Chip,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  ArrowDownward,
  ArrowUpward,
  AutoFixHigh,
  AutoAwesome,
  ChevronLeft,
  ChevronRight,
  CloudDone,
  CloudOff,
  CloudSync,
  DeleteOutline,
  Description,
  Edit,
  FileUpload,
  InfoOutlined,
  MailOutline,
  NotificationsNone,
  Publish,
  Save,
  Search,
  Slideshow,
  Tune,
  Visibility,
  VisibilityOff,
  WarningAmber,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import {
  useAcademy,
  type Course,
  type CourseResource,
  type Lesson,
  type LessonResource,
} from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyLocaleSwitcher from './AcademyLocaleSwitcher';
import AcademyLeftSidebar from './AcademyLeftSidebar';
import AcademyPlayerStudio from './AcademyPlayerStudio';
import { resolveAcademyVideoUrl } from './academyVideoSourceUtils';
import {
  formatToolSavedTime,
  hasSavedDraftNewerThanPublished,
  useAcademyToolUx,
  useToolAutoSaveState,
} from './academyToolCore';
import { apiRequest } from '@/lib/queryClient';
import {
  ACADEMY_PRESENTATION_GRAMMAR_BUDGETS,
  ACADEMY_PRESENTATION_THEME_TOKENS,
  academyPresentationBuildGrammarPlan,
  academyPresentationThemeTokens,
  type AcademyPresentationBrandTokens as SharedPresentationBrandTokens,
  type AcademyPresentationContinuationPlan as SharedPresentationContinuationPlan,
  type AcademyPresentationNarrativeRole as SharedPresentationNarrativeRole,
  type AcademyPresentationRepairAction as SharedPresentationRepairAction,
  type AcademyPresentationSlideBudget as SharedPresentationSlideBudget,
  type AcademyPresentationSlideGrammarId as SharedPresentationSlideGrammarId,
  type AcademyPresentationStructuredContent as SharedPresentationStructuredContent,
  type AcademyPresentationVisualNeed as SharedPresentationVisualNeed,
} from '@shared/academy-presentation-design-system';
import {
  buildPresentationGraphicPlan,
  buildPresentationGraphicAsset,
  buildPresentationReferenceQueries,
  evaluatePresentationDeckDesign,
  type PresentationDeckDesignEvaluation,
} from './presentationStudioDesignRuntime';

interface AcademyPresentationOverlayStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type PresentationScope = 'course' | 'skill';
type PresentationTemplateId =
  | 'product-overview'
  | 'walkthrough'
  | 'onboarding-flow'
  | 'feature-explainer'
  | 'training-deep-dive';
type PresentationVisualThemeId =
  | 'neutral-modern'
  | 'sales-command'
  | 'operations-grid'
  | 'offshore-briefing';
type PresentationSplitLayoutVariant = 'balanced' | 'presenter-focus' | 'slide-focus';
type PresentationDisplayMode =
  | 'picture-in-picture'
  | 'side-panel'
  | 'split-screen'
  | 'full-frame';
type PresentationPlacement =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'center';

interface PresentationTemplatePreset {
  id: PresentationTemplateId;
  labelNo: string;
  labelEn: string;
  descriptionNo: string;
  descriptionEn: string;
  defaultMode: PresentationDisplayMode;
  defaultPlacement: PresentationPlacement;
  slidesNo: string[];
  slidesEn: string[];
}

interface PresentationVisualThemePreset {
  id: PresentationVisualThemeId;
  labelNo: string;
  labelEn: string;
  descriptionNo: string;
  descriptionEn: string;
  preferredTemplate: PresentationTemplateId;
  preferredMode: PresentationDisplayMode;
  splitLayoutVariant: PresentationSplitLayoutVariant;
  colors: SharedPresentationBrandTokens;
}

type PresentationChartStyle = SharedPresentationBrandTokens['chartStyle'];
type PresentationImageStyle = SharedPresentationBrandTokens['imageStyle'];

interface PresentationBrandKit {
  id: string;
  name: string;
  baseThemeId: PresentationVisualThemeId;
  primary: string;
  secondary: string;
  accent: string;
  canvasTitle: string;
  canvasText: string;
  headingFont: string;
  bodyFont: string;
  cornerRadius: number;
  chartStyle: PresentationChartStyle;
  imageStyle: PresentationImageStyle;
  logoText: string;
  footerText: string;
  requireLogo: boolean;
  requireFooter: boolean;
  minContrastRatio: number;
  updatedAt: string;
}

interface PresentationSlide {
  id: string;
  title: string;
  sourceSlideNumber?: number;
  startTime: number;
  duration: number;
  instructorId?: string;
  layout: PresentationDisplayMode;
  speakerNotes: string;
  elements: PresentationSceneElement[];
  previewImageUrl?: string;
  thumbnailImageUrl?: string;
}

type PresentationElementType = 'text' | 'shape' | 'image' | 'video';

interface PresentationSceneElement {
  id: string;
  type: PresentationElementType;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  role?:
    | 'eyebrow'
    | 'headline'
    | 'subtitle'
    | 'body'
    | 'bullet'
    | 'column-title'
    | 'column-body'
    | 'step-title'
    | 'step-body'
    | 'stat-value'
    | 'stat-label'
    | 'quote'
    | 'quote-attribution'
    | 'cta'
    | 'cta-support'
    | 'media'
    | 'badge';
  align?: 'left' | 'center';
  tone?: 'default' | 'muted' | 'accent' | 'inverse';
  prompt?: string;
  graphicKind?: PresentationDesignGraphicSlot['kind'];
  assetDataUrl?: string;
}

interface PresentationDeck {
  id: string;
  name: string;
  template: PresentationTemplateId;
  visualThemeId: PresentationVisualThemeId;
  brandKitId?: string;
  displayMode: PresentationDisplayMode;
  splitLayoutVariant: PresentationSplitLayoutVariant;
  showNavigator: boolean;
  placement: PresentationPlacement;
  opacity: number;
  sourceName: string;
  sourceType: string;
  sourceUrl: string;
  slides: PresentationSlide[];
  updatedAt: string;
}

type PresentationStoreEntry = {
  decks: PresentationDeck[];
  duration: number;
  updatedAt: string;
  publishedAt?: string;
};

type PresentationStoreMap = Record<string, PresentationStoreEntry>;
type PresentationBrandKitStoreMap = Record<string, PresentationBrandKit[]>;

interface PresentationBrandEvaluation {
  score: number;
  findings: PresentationQualityIssue[];
}

type ParsedPresentationResource = {
  id: string;
  deckId: string;
  slideId: string;
  deckName: string;
  slideTitle: string;
  startTime: number;
  endTime: number;
  order: number;
  template: PresentationTemplateId;
  visualThemeId: PresentationVisualThemeId;
  displayMode: PresentationDisplayMode;
  splitLayoutVariant: PresentationSplitLayoutVariant;
  showNavigator: boolean;
  slideLayout: PresentationDisplayMode;
  placement: PresentationPlacement;
  sourceSlideNumber: number;
  slidePreviewUrl: string;
  sourceName: string;
  sourceUrl: string;
};

interface TeleprompterSpeechWord {
  token: string;
  start: number;
  end: number;
  speaker: string;
}

interface TeleprompterScriptToken {
  token: string;
  lineIndex: number;
}

interface TeleprompterAlignedSpeechWord extends TeleprompterSpeechWord {
  scriptTokenIndex: number | null;
}

interface TeleprompterSpeechCacheEntry {
  words: TeleprompterSpeechWord[];
  language: string;
  provider: string;
  warnings: string[];
  speakers: string[];
  captionsVtt: string;
}

type TeleprompterSpeechSyncStatus = 'idle' | 'preparing' | 'ready' | 'error';

type PresentationQualityIssueSeverity = 'warning' | 'error';

interface PresentationQualityIssue {
  id: string;
  slideId?: string;
  severity: PresentationQualityIssueSeverity;
  messageNo: string;
  messageEn: string;
}

interface PresentationSemanticSearchRankItem {
  id: string;
  score: number;
  lexicalScore: number;
  semanticScore: number;
  rerankScore: number | null;
}

type PresentationDesignVisualType =
  | 'title'
  | 'agenda'
  | 'problem'
  | 'solution'
  | 'feature'
  | 'process'
  | 'kpi'
  | 'timeline'
  | 'roadmap'
  | 'architecture'
  | 'scenario'
  | 'knowledge-check'
  | 'comparison'
  | 'demo'
  | 'quote'
  | 'cta'
  | 'summary';

interface PresentationDesignGraphicSlot {
  id: string;
  kind: 'chart' | 'icon' | 'screenshot' | 'illustration' | 'photo' | 'shape' | 'badge';
  label: string;
  prompt: string;
  x: number;
  y: number;
  width: number;
  height: number;
  resolvedAssetUrl?: string;
  assetSource?: string;
}

interface PresentationDesignSlidePlan {
  slideId: string;
  visualType: PresentationDesignVisualType;
  grammarId: SharedPresentationSlideGrammarId;
  narrativeRole: SharedPresentationNarrativeRole;
  layoutHint: string;
  recommendedLayout: PresentationDisplayMode;
  confidence: number;
  reasons: string[];
  intentTags: string[];
  contentBudget: SharedPresentationSlideBudget;
  structuredContent: SharedPresentationStructuredContent;
  repairActions: SharedPresentationRepairAction[];
  visualNeeds: SharedPresentationVisualNeed[];
  copySuggestions: {
    title: string;
    body: string[];
    cta: string;
  };
  graphicSlots: PresentationDesignGraphicSlot[];
  continuation?: SharedPresentationContinuationPlan | null;
}

interface PresentationDesignPlan {
  scope: PresentationScope;
  courseId: string;
  lessonId: string;
  deckName: string;
  recommendedTemplateId: PresentationTemplateId;
  recommendedVisualThemeId: PresentationVisualThemeId;
  recommendedDisplayMode: PresentationDisplayMode;
  recommendedSplitLayoutVariant: PresentationSplitLayoutVariant;
  summary: {
    generatedBy: string;
    provider?: 'huggingface' | 'openai' | 'rule-engine';
    model?: string;
    slideCount: number;
    visualCounts: Record<PresentationDesignVisualType, number>;
    grammarCounts?: Record<string, number>;
    repairActionsCount?: number;
    templateMemoryMatches?: PresentationTemplateMemoryMatch[];
    retrievalMeta?: PresentationTemplateMemoryMeta;
    brandContextName?: string;
    pipeline?: string[];
  };
  brandTokens?: SharedPresentationBrandTokens;
  slides: PresentationDesignSlidePlan[];
  generatedAt: string;
}

type PresentationTemplateMemoryKind = 'deck' | 'brand-kit' | 'preset';

interface PresentationTemplateMemoryItem {
  id: string;
  kind: PresentationTemplateMemoryKind;
  name: string;
  summary: string;
  templateId: PresentationTemplateId;
  visualThemeId: PresentationVisualThemeId;
  displayMode: PresentationDisplayMode;
  splitLayoutVariant: PresentationSplitLayoutVariant;
  searchText: string;
  brandName: string;
}

interface PresentationTemplateMemoryMatch {
  id: string;
  kind: PresentationTemplateMemoryKind;
  name: string;
  summary: string;
  templateId: PresentationTemplateId;
  visualThemeId: PresentationVisualThemeId;
  displayMode: PresentationDisplayMode;
  splitLayoutVariant: PresentationSplitLayoutVariant;
  brandName: string;
  score: number;
  lexicalScore: number;
  semanticScore: number;
  rerankScore: number | null;
}

interface PresentationTemplateMemoryMeta {
  provider: 'lexical' | 'huggingface';
  embeddingModel?: string;
  rerankerModel?: string;
  candidateCount: number;
  matchedCount: number;
}

type PresentationAiCritiqueSeverity = 'warning' | 'error';
type PresentationAiCritiqueCategory =
  | 'content'
  | 'hierarchy'
  | 'visual'
  | 'balance'
  | 'grammar'
  | 'narrative'
  | 'brand';

interface PresentationAiCritiqueFinding {
  id: string;
  slideId?: string;
  severity: PresentationAiCritiqueSeverity;
  category: PresentationAiCritiqueCategory;
  messageNo: string;
  messageEn: string;
  repairHintNo: string;
  repairHintEn: string;
  recommendedGrammarId?: SharedPresentationSlideGrammarId;
  recommendedVisualKind?: PresentationDesignGraphicSlot['kind'];
  confidence: number;
}

interface PresentationAiCritiqueResult {
  provider: 'huggingface' | 'heuristic';
  model: string;
  overall: number;
  narrative: number;
  pedagogy: number;
  design: number;
  visuals: number;
  brand: number;
  findings: PresentationAiCritiqueFinding[];
  generatedAt: string;
  pipeline?: string[];
}

interface PresentationReferenceImageResult {
  id: string;
  url: string;
  thumbnailUrl?: string;
  source?: string;
  attribution?: string;
  description?: string;
  photographer?: string;
}

interface PresentationLocalVisualAssetCandidate {
  id: string;
  url: string;
  title: string;
  description: string;
  source: 'resource' | 'video-poster' | 'lesson-thumbnail' | 'course-thumbnail';
  scope: 'selected-skill' | 'course' | 'other-skill' | 'lesson-thumbnail' | 'course-thumbnail';
  assetKind: 'image' | 'video-poster' | 'thumbnail';
  folderTag?: string;
  mediaAssetId?: string;
  uploaded?: boolean;
}

const PRESENTATION_MEDIA_FOLDER_TAG_REGEX = /\[folder:([a-z0-9-]+)\]/i;
const PRESENTATION_MEDIA_SOURCE_TAG_REGEX = /\[source:(upload|resource)\]/i;

const academyShellMaxWidth = 'min(100%, var(--academy-shell-max-width, 2880px))';
const panelSx = {
  borderRadius: 1.4,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};
const PRESENTATION_CONTROL_BUTTON_SX = {
  height: 34,
  borderRadius: 1,
  textTransform: 'none',
  transition: 'all 140ms ease',
};
const PRESENTATION_NEUTRAL_OUTLINED_BUTTON_SX = {
  ...PRESENTATION_CONTROL_BUTTON_SX,
  borderColor: 'rgba(255,255,255,0.2)',
  color: '#edf0f7',
  bgcolor: 'rgba(255,255,255,0.02)',
  '&:hover': {
    borderColor: 'rgba(255,255,255,0.34)',
    bgcolor: 'rgba(255,255,255,0.06)',
  },
};
const PRESENTATION_WARNING_OUTLINED_BUTTON_SX = {
  ...PRESENTATION_CONTROL_BUTTON_SX,
  borderColor: 'rgba(248,179,33,0.35)',
  color: '#f8d675',
  bgcolor: 'rgba(248,179,33,0.06)',
  '&:hover': {
    borderColor: 'rgba(248,179,33,0.5)',
    bgcolor: 'rgba(248,179,33,0.14)',
  },
};
const PRESENTATION_SAVE_BUTTON_SX = {
  ...PRESENTATION_NEUTRAL_OUTLINED_BUTTON_SX,
  minWidth: 104,
};
const PRESENTATION_PUBLISH_BUTTON_SX = {
  ...PRESENTATION_CONTROL_BUTTON_SX,
  minWidth: 112,
  color: '#0f0f0f',
  background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
  border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.68)',
  boxShadow: '0 8px 20px rgba(248,179,33,0.25)',
  '&:hover': {
    background: 'linear-gradient(180deg, #ffe07a, #f5b53a)',
    boxShadow: '0 10px 24px rgba(248,179,33,0.35)',
  },
};
const PRESENTATION_SECTION_LABEL_SX = {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'rgba(237,240,247,0.68)',
  fontWeight: 700,
};
const PRESENTATION_DETAIL_CARD_SX = {
  borderRadius: 1,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
  background: 'linear-gradient(145deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))',
  p: 1,
  display: 'grid',
  gap: 0.8,
};

const PRESENTATION_VIDEO_PLACEHOLDER = '/assets/academy/intro-video.mp4';
const PRESENTATION_STORE_KEY = 'academyPresentationOverlayStoreV1';
const PRESENTATION_KV_KEY = 'academy_presentation_overlay_store_v1';
const PRESENTATION_EDITOR_PREFS_KEY = 'academy_presentation_editor_prefs_v1';
const PRESENTATION_BRAND_KITS_KEY = 'academy_presentation_brand_kits_v1';
const PRESENTATION_RESOURCE_ID_PREFIX = 'presentation-resource-';
const PRESENTATION_RESOURCE_COURSE_PREFIX = 'presentation-resource-course-';
const PRESENTATION_RESOURCE_SKILL_PREFIX = 'presentation-resource-skill-';
const TELEPROMPTER_SPEAKER_ALL = '__all__';
const TELEPROMPTER_SYNC_POLL_INTERVAL_MS = 1600;
const TELEPROMPTER_SYNC_POLL_ATTEMPTS = 120;

const PRESENTATION_FONT_OPTIONS = [
  '"Sora", "Segoe UI", sans-serif',
  '"Manrope", "Segoe UI", sans-serif',
  '"Space Grotesk", "Segoe UI", sans-serif',
  '"IBM Plex Sans", "Segoe UI", sans-serif',
  '"Plus Jakarta Sans", "Segoe UI", sans-serif',
];

const templatePresets: PresentationTemplatePreset[] = [
  {
    id: 'product-overview',
    labelNo: 'Produktoversikt',
    labelEn: 'Product Overview',
    descriptionNo: 'Struktur for problemsituasjon, løsning, verdiforslag og neste steg.',
    descriptionEn: 'Structure for problem, solution, value proposition, and next step.',
    defaultMode: 'side-panel',
    defaultPlacement: 'top-right',
    slidesNo: ['Problem', 'Løsning', 'Nøkkelfunksjoner', 'Kundeverdi', 'Neste steg'],
    slidesEn: ['Problem', 'Solution', 'Core Features', 'Customer Value', 'Next Step'],
  },
  {
    id: 'walkthrough',
    labelNo: 'Walkthrough',
    labelEn: 'Walkthrough',
    descriptionNo: 'Steg-for-steg oppsett for demo av arbeidsflyt eller prosess.',
    descriptionEn: 'Step-by-step setup for workflow or process walkthroughs.',
    defaultMode: 'split-screen',
    defaultPlacement: 'center',
    slidesNo: ['Mål', 'Steg 1', 'Steg 2', 'Steg 3', 'Oppsummering'],
    slidesEn: ['Goal', 'Step 1', 'Step 2', 'Step 3', 'Summary'],
  },
  {
    id: 'onboarding-flow',
    labelNo: 'Onboarding-flyt',
    labelEn: 'Onboarding Flow',
    descriptionNo: 'Fokus på første verdi, aktivering, vanebygging og støtte.',
    descriptionEn: 'Focus on first value, activation, habit loop, and support.',
    defaultMode: 'picture-in-picture',
    defaultPlacement: 'bottom-right',
    slidesNo: ['Velkommen', 'Første verdi', 'Aktivering', 'Vaner', 'Støttekanaler'],
    slidesEn: ['Welcome', 'First Value', 'Activation', 'Habit Loop', 'Support Channels'],
  },
  {
    id: 'feature-explainer',
    labelNo: 'Feature forklaring',
    labelEn: 'Feature Explainer',
    descriptionNo: 'Viser funksjon, brukstilfelle, verdi og konkrete handlinger.',
    descriptionEn: 'Showcases feature, use case, value, and concrete actions.',
    defaultMode: 'picture-in-picture',
    defaultPlacement: 'top-right',
    slidesNo: ['Hva er funksjonen', 'Brukstilfelle', 'Slik brukes den', 'Resultat', 'CTA'],
    slidesEn: ['What It Is', 'Use Case', 'How To Use It', 'Outcome', 'CTA'],
  },
  {
    id: 'training-deep-dive',
    labelNo: 'Faglig fordypning',
    labelEn: 'Training Deep Dive',
    descriptionNo: 'Bygger teori, metode, praksisoppgave og refleksjon i samme løp.',
    descriptionEn: 'Builds theory, method, practice assignment, and reflection.',
    defaultMode: 'full-frame',
    defaultPlacement: 'center',
    slidesNo: ['Læringsmål', 'Teori', 'Metode', 'Praksisoppgave', 'Refleksjon'],
    slidesEn: ['Learning Goal', 'Theory', 'Method', 'Practice', 'Reflection'],
  },
];

const visualThemePresets: PresentationVisualThemePreset[] = [
  {
    id: 'neutral-modern',
    labelNo: 'Neutral Modern',
    labelEn: 'Neutral Modern',
    descriptionNo: 'Ren, moderne deck for produkt, opplæring og generelle presentasjoner.',
    descriptionEn: 'Clean modern deck for product, training, and general presentations.',
    preferredTemplate: 'product-overview',
    preferredMode: 'side-panel',
    splitLayoutVariant: 'balanced',
    colors: ACADEMY_PRESENTATION_THEME_TOKENS['neutral-modern'],
  },
  {
    id: 'sales-command',
    labelNo: 'Sales Command',
    labelEn: 'Sales Command',
    descriptionNo: 'Hoy energi med tydelige KPI-kort og kommersiell presentasjon.',
    descriptionEn: 'High-energy visual style for KPI-driven sales stories.',
    preferredTemplate: 'feature-explainer',
    preferredMode: 'split-screen',
    splitLayoutVariant: 'slide-focus',
    colors: ACADEMY_PRESENTATION_THEME_TOKENS['sales-command'],
  },
  {
    id: 'operations-grid',
    labelNo: 'Operations Grid',
    labelEn: 'Operations Grid',
    descriptionNo: 'Teknisk og ryddig visuell stil for prosess, runbooks og operativ trening.',
    descriptionEn: 'Technical, structured theme for process, runbooks, and operational training.',
    preferredTemplate: 'walkthrough',
    preferredMode: 'split-screen',
    splitLayoutVariant: 'presenter-focus',
    colors: ACADEMY_PRESENTATION_THEME_TOKENS['operations-grid'],
  },
  {
    id: 'offshore-briefing',
    labelNo: 'Offshore Briefing',
    labelEn: 'Offshore Briefing',
    descriptionNo: 'Rolig briefing-stil for sikkerhet, kvalitet og seriøs faglig opplæring.',
    descriptionEn: 'Calm briefing style for safety, quality, and high-trust training.',
    preferredTemplate: 'training-deep-dive',
    preferredMode: 'split-screen',
    splitLayoutVariant: 'balanced',
    colors: ACADEMY_PRESENTATION_THEME_TOKENS['offshore-briefing'],
  },
];

const projectTemplateToPresentationTemplate: Record<string, PresentationTemplateId> = {
  'sales-enablement-a-a': 'feature-explainer',
  'production-operations-a-a': 'walkthrough',
  'offshore-safety-a-a': 'training-deep-dive',
};

const projectTemplateLabels: Record<string, { no: string; en: string }> = {
  'sales-enablement-a-a': { no: 'Salgsteam opplaring A-A', en: 'Sales Enablement A-Z' },
  'production-operations-a-a': { no: 'Produksjonsdrift A-A', en: 'Production Operations A-Z' },
  'offshore-safety-a-a': { no: 'Offshore sikkerhet A-A', en: 'Offshore Safety A-Z' },
};

const getRouteParam = (key: string): string => {
  if (typeof window === 'undefined') return '';
  const value = new URLSearchParams(window.location.search).get(key);
  return String(value || '').trim();
};

const formatTime = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const getInitials = (value: string): string => {
  const parts = String(value || '')
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  if (parts.length === 0) return 'I';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const parseMinuteSecondTime = (value: string, fallback: number): number => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  if (raw.includes(':')) {
    const [minutePart, secondPart = '0'] = raw.split(':');
    const minutes = Number.parseInt(minutePart.trim(), 10);
    const seconds = Number.parseInt(secondPart.trim(), 10);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return fallback;
    return Math.max(0, minutes * 60 + seconds);
  }

  const asSeconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(asSeconds)) return fallback;
  return Math.max(0, asSeconds);
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const roundHalfSecond = (value: number): number => Math.round(value * 2) / 2;

const normalizeSearchToken = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeSearchQuery = (value: string): string[] =>
  Array.from(
    new Set(
      normalizeSearchToken(value)
        .split(' ')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 1),
    ),
  ).slice(0, 18);

const computeDeckLexicalSearchScore = (deck: PresentationDeck, query: string, queryTokens: string[]): number => {
  const normalizedQuery = normalizeSearchToken(query);
  if (!normalizedQuery) return 0;
  const normalizedName = normalizeSearchToken(deck.name);
  const normalizedSourceName = normalizeSearchToken(deck.sourceName);
  const normalizedSlideTitles = normalizeSearchToken(
    deck.slides.map((slide) => slide.title).join(' '),
  );
  let score = 0;
  if (normalizedName.includes(normalizedQuery)) score += 0.62;
  if (normalizedSourceName.includes(normalizedQuery)) score += 0.3;
  if (normalizedSlideTitles.includes(normalizedQuery)) score += 0.22;
  queryTokens.forEach((token) => {
    if (normalizedName.includes(token)) score += 0.09;
    else if (normalizedSourceName.includes(token)) score += 0.05;
    else if (normalizedSlideTitles.includes(token)) score += 0.035;
  });
  return clamp(score, 0, 1);
};

const parseCssColor = (value: string): { r: number; g: number; b: number } | null => {
  const match = String(value || '').match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  if (match) {
    const hex = match[1];
    if (hex.length === 3) {
      const r = Number.parseInt(`${hex[0]}${hex[0]}`, 16);
      const g = Number.parseInt(`${hex[1]}${hex[1]}`, 16);
      const b = Number.parseInt(`${hex[2]}${hex[2]}`, 16);
      return { r, g, b };
    }
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }
  const rgbMatch = String(value || '').match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgbMatch) {
    return {
      r: clamp(Number(rgbMatch[1]) || 0, 0, 255),
      g: clamp(Number(rgbMatch[2]) || 0, 0, 255),
      b: clamp(Number(rgbMatch[3]) || 0, 0, 255),
    };
  }
  return null;
};

const relativeLuminance = (rgb: { r: number; g: number; b: number }): number => {
  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    if (normalized <= 0.03928) return normalized / 12.92;
    return ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (foreground: string, background: string): number | null => {
  const fg = parseCssColor(foreground);
  const bg = parseCssColor(background);
  if (!fg || !bg) return null;
  const fgLum = relativeLuminance(fg);
  const bgLum = relativeLuminance(bg);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05);
};

const toVttTimestamp = (seconds: number): string => {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalMs = Math.round(safeSeconds * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    secs,
  ).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
};

const normalizeCaptionSegments = (
  transcriptionPayload: Record<string, unknown>,
): Array<{ start: number; end: number; text: string }> => {
  const source = Array.isArray(transcriptionPayload.segments)
    ? transcriptionPayload.segments
    : [];
  const normalized: Array<{ start: number; end: number; text: string }> = [];

  source.forEach((entry) => {
    if (!isRecord(entry)) return;
    const start = readNumberValue(entry.start ?? entry.start_time);
    const end = readNumberValue(entry.end ?? entry.end_time);
    const text = readStringValue(entry.text);
    if (start === null || end === null || !text) return;
    const safeStart = Math.max(0, start);
    const safeEnd = Math.max(safeStart + 0.08, end);
    normalized.push({ start: safeStart, end: safeEnd, text });
  });

  if (normalized.length === 0) return [];
  normalized.sort((left, right) => left.start - right.start);
  return normalized;
};

const buildVttFromSegments = (segments: Array<{ start: number; end: number; text: string }>): string => {
  if (segments.length === 0) return '';
  const body = segments
    .map((segment) => `${toVttTimestamp(segment.start)} --> ${toVttTimestamp(segment.end)}\n${segment.text}\n`)
    .join('\n');
  return `WEBVTT\n\n${body}`.trim();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readStringValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';

const readNumberValue = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeSpeechToken = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9aeiouyæøåäöüéèáàíìóòúùñçß-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeSpeechText = (value: string): string[] =>
  normalizeSpeechToken(value)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter(Boolean);

type TeleprompterDiarizationSegment = {
  start: number;
  end: number;
  speaker: string;
};

const normalizeDiarizationSegments = (value: unknown): TeleprompterDiarizationSegment[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const start = readNumberValue(entry.start);
      const end = readNumberValue(entry.end);
      const speaker = readStringValue(entry.speaker);
      if (!(start !== null && end !== null && end > start)) return null;
      return { start, end, speaker };
    })
    .filter((entry): entry is TeleprompterDiarizationSegment => Boolean(entry))
    .sort((left, right) => left.start - right.start);
};

const resolveSpeakerForWord = (
  start: number,
  end: number,
  diarizationSegments: TeleprompterDiarizationSegment[],
): string => {
  if (diarizationSegments.length === 0) return '';
  let bestSpeaker = '';
  let bestOverlap = 0;
  for (const segment of diarizationSegments) {
    const overlapStart = Math.max(start, segment.start);
    const overlapEnd = Math.min(end, segment.end);
    const overlap = overlapEnd - overlapStart;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestSpeaker = segment.speaker;
    }
  }
  return bestSpeaker;
};

const normalizeTeleprompterSpeechWords = (
  transcriptionPayload: unknown,
  diarizationPayload: unknown,
): TeleprompterSpeechWord[] => {
  const transcription = isRecord(transcriptionPayload) ? transcriptionPayload : {};
  const diarizationSegments = normalizeDiarizationSegments(diarizationPayload);
  const wordsPayload = Array.isArray(transcription.words) ? transcription.words : [];
  const words = wordsPayload
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const start = readNumberValue(entry.start);
      const end = readNumberValue(entry.end);
      if (!(start !== null && end !== null && end > start)) return null;
      const token = normalizeSpeechToken(readStringValue(entry.word) || readStringValue(entry.text));
      if (!token) return null;
      const speaker = readStringValue(entry.speaker) || resolveSpeakerForWord(start, end, diarizationSegments);
      return { token, start, end, speaker };
    })
    .filter((entry): entry is TeleprompterSpeechWord => Boolean(entry))
    .sort((left, right) => left.start - right.start);
  if (words.length > 0) return words;

  const segmentsPayload = Array.isArray(transcription.segments) ? transcription.segments : [];
  const derivedWords: TeleprompterSpeechWord[] = [];
  segmentsPayload.forEach((entry) => {
    if (!isRecord(entry)) return;
    const start = readNumberValue(entry.start);
    const end = readNumberValue(entry.end);
    if (!(start !== null && end !== null && end > start)) return;
    const segmentTokens = tokenizeSpeechText(readStringValue(entry.text));
    if (segmentTokens.length === 0) return;
    const span = Math.max(0.08, (end - start) / segmentTokens.length);
    const segmentSpeaker =
      readStringValue(entry.speaker) || resolveSpeakerForWord(start, end, diarizationSegments);
    segmentTokens.forEach((token, index) => {
      const tokenStart = start + index * span;
      const tokenEnd = index === segmentTokens.length - 1 ? end : tokenStart + span;
      derivedWords.push({
        token,
        start: tokenStart,
        end: Math.max(tokenStart + 0.04, tokenEnd),
        speaker: segmentSpeaker,
      });
    });
  });
  return derivedWords;
};

const alignSpeechWordsToScriptTokens = (
  words: TeleprompterSpeechWord[],
  scriptTokens: TeleprompterScriptToken[],
): Array<number | null> => {
  if (words.length === 0 || scriptTokens.length === 0) {
    return new Array(words.length).fill(null);
  }
  const aligned = new Array<number | null>(words.length).fill(null);
  let scriptCursor = 0;

  words.forEach((word, index) => {
    const token = word.token;
    if (!token) {
      return;
    }
    const localSearchStart = Math.max(0, scriptCursor - 3);
    const localSearchEnd = Math.min(scriptTokens.length - 1, scriptCursor + 18);
    let foundIndex = -1;

    for (let scriptIndex = localSearchStart; scriptIndex <= localSearchEnd; scriptIndex += 1) {
      if (scriptTokens[scriptIndex].token === token) {
        foundIndex = scriptIndex;
        break;
      }
    }

    if (foundIndex < 0) {
      for (let scriptIndex = 0; scriptIndex < scriptTokens.length; scriptIndex += 1) {
        if (scriptTokens[scriptIndex].token === token) {
          foundIndex = scriptIndex;
          break;
        }
      }
    }

    if (foundIndex >= 0) {
      aligned[index] = foundIndex;
      scriptCursor = Math.min(scriptTokens.length, foundIndex + 1);
    }
  });

  return aligned;
};

const toTemplateId = (value: string): PresentationTemplateId => {
  const candidate = String(value || '').trim().toLowerCase();
  if (
    candidate === 'product-overview' ||
    candidate === 'walkthrough' ||
    candidate === 'onboarding-flow' ||
    candidate === 'feature-explainer' ||
    candidate === 'training-deep-dive'
  ) {
    return candidate;
  }
  return 'product-overview';
};

const toVisualThemeId = (value: string): PresentationVisualThemeId => {
  const candidate = String(value || '').trim().toLowerCase();
  if (
    candidate === 'neutral-modern' ||
    candidate === 'sales-command' ||
    candidate === 'operations-grid' ||
    candidate === 'offshore-briefing'
  ) {
    return candidate;
  }
  return 'neutral-modern';
};

const toSplitLayoutVariant = (value: string): PresentationSplitLayoutVariant => {
  const candidate = String(value || '').trim().toLowerCase();
  if (candidate === 'presenter-focus' || candidate === 'slide-focus' || candidate === 'balanced') {
    return candidate;
  }
  return 'balanced';
};

const toDisplayMode = (value: string): PresentationDisplayMode => {
  const candidate = String(value || '').trim().toLowerCase();
  if (
    candidate === 'picture-in-picture' ||
    candidate === 'side-panel' ||
    candidate === 'split-screen' ||
    candidate === 'full-frame'
  ) {
    return candidate;
  }
  return 'picture-in-picture';
};

const toPlacement = (value: string): PresentationPlacement => {
  const candidate = String(value || '').trim().toLowerCase();
  if (
    candidate === 'top-right' ||
    candidate === 'top-left' ||
    candidate === 'bottom-right' ||
    candidate === 'bottom-left' ||
    candidate === 'center'
  ) {
    return candidate;
  }
  return 'bottom-right';
};

const toDesignVisualType = (value: string): PresentationDesignVisualType => {
  const candidate = String(value || '').trim().toLowerCase();
  if (
    candidate === 'title' ||
    candidate === 'agenda' ||
    candidate === 'problem' ||
    candidate === 'solution' ||
    candidate === 'feature' ||
    candidate === 'process' ||
    candidate === 'kpi' ||
    candidate === 'timeline' ||
    candidate === 'roadmap' ||
    candidate === 'architecture' ||
    candidate === 'scenario' ||
    candidate === 'knowledge-check' ||
    candidate === 'comparison' ||
    candidate === 'demo' ||
    candidate === 'quote' ||
    candidate === 'cta' ||
    candidate === 'summary'
  ) {
    return candidate;
  }
  return 'feature';
};

const toDesignGraphicKind = (
  value: string,
): PresentationDesignGraphicSlot['kind'] => {
  const candidate = String(value || '').trim().toLowerCase();
  if (
    candidate === 'chart' ||
    candidate === 'icon' ||
    candidate === 'screenshot' ||
    candidate === 'illustration' ||
    candidate === 'photo' ||
    candidate === 'shape' ||
    candidate === 'badge'
  ) {
    return candidate;
  }
  return 'illustration';
};

const toPresentationGrammarId = (value: string): SharedPresentationSlideGrammarId => {
  const candidate = String(value || '').trim().toLowerCase();
  return candidate in ACADEMY_PRESENTATION_GRAMMAR_BUDGETS
    ? (candidate as SharedPresentationSlideGrammarId)
    : 'content-grid';
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isPresent = <T,>(value: T | null): value is T => value !== null;

const toTemplateMemoryKind = (value: string): PresentationTemplateMemoryKind => {
  const candidate = String(value || '').trim().toLowerCase();
  if (candidate === 'brand-kit' || candidate === 'preset' || candidate === 'deck') {
    return candidate;
  }
  return 'deck';
};

const parseTemplateMemoryMatches = (value: unknown): PresentationTemplateMemoryMatch[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map<PresentationTemplateMemoryMatch | null>((entry) => {
      if (!isObjectRecord(entry)) return null;
      const match: PresentationTemplateMemoryMatch = {
        id: String(entry.id || '').trim(),
        kind: toTemplateMemoryKind(String(entry.kind || 'deck')),
        name: String(entry.name || '').trim(),
        summary: String(entry.summary || '').trim(),
        templateId: toTemplateId(String(entry.templateId || 'walkthrough')),
        visualThemeId: toVisualThemeId(String(entry.visualThemeId || 'neutral-modern')),
        displayMode: toDisplayMode(String(entry.displayMode || 'split-screen')),
        splitLayoutVariant: toSplitLayoutVariant(String(entry.splitLayoutVariant || 'balanced')),
        brandName: String(entry.brandName || '').trim(),
        score: clamp(Number(entry.score) || 0, 0, 1),
        lexicalScore: clamp(Number(entry.lexicalScore) || 0, 0, 1),
        semanticScore: clamp(Number(entry.semanticScore) || 0, 0, 1),
        rerankScore:
          entry.rerankScore === null || entry.rerankScore === undefined
            ? null
            : clamp(Number(entry.rerankScore) || 0, 0, 1),
      };
      return match;
    })
    .filter(isPresent)
    .filter((entry) => Boolean(entry.id && entry.name))
    .slice(0, 6);
};

const parseAiCritique = (payload: unknown): PresentationAiCritiqueResult | null => {
  const root = isObjectRecord(payload) ? payload : null;
  const rawData = isObjectRecord(root?.data) ? root.data : root;
  if (!isObjectRecord(rawData)) return null;
  const findings = Array.isArray(rawData.findings)
    ? rawData.findings
        .map<PresentationAiCritiqueFinding | null>((entry) => {
          if (!isObjectRecord(entry)) return null;
          const finding: PresentationAiCritiqueFinding = {
            id: String(entry.id || `critique-${Date.now()}`),
            slideId: String(entry.slideId || '').trim() || undefined,
            severity: String(entry.severity || '').trim().toLowerCase() === 'error' ? 'error' : 'warning',
            category: (['content', 'hierarchy', 'visual', 'balance', 'grammar', 'narrative', 'brand'].includes(
              String(entry.category || '').trim().toLowerCase(),
            )
              ? String(entry.category || '').trim().toLowerCase()
              : 'content') as PresentationAiCritiqueCategory,
            messageNo: String(entry.messageNo || entry.message || entry.messageEn || '').trim(),
            messageEn: String(entry.messageEn || entry.message || entry.messageNo || '').trim(),
            repairHintNo: String(entry.repairHintNo || entry.repairHint || entry.repairHintEn || '').trim(),
            repairHintEn: String(entry.repairHintEn || entry.repairHint || entry.repairHintNo || '').trim(),
            recommendedGrammarId: entry.recommendedGrammarId
              ? toPresentationGrammarId(String(entry.recommendedGrammarId || 'content-grid'))
              : undefined,
            recommendedVisualKind: entry.recommendedVisualKind
              ? toDesignGraphicKind(String(entry.recommendedVisualKind || 'illustration'))
              : undefined,
            confidence: clamp(Number(entry.confidence) || 0.68, 0, 1),
          };
          return finding;
        })
        .filter(isPresent)
        .filter((entry) => Boolean(entry.messageNo))
    : [];

  return {
    provider: String(rawData.provider || '').trim().toLowerCase() === 'huggingface' ? 'huggingface' : 'heuristic',
    model: String(rawData.model || '').trim() || 'academy-presentation-heuristics-v1',
    overall: clamp(Number(rawData.overall) || 0, 0, 100),
    narrative: clamp(Number(rawData.narrative) || 0, 0, 100),
    pedagogy: clamp(Number(rawData.pedagogy) || 0, 0, 100),
    design: clamp(Number(rawData.design) || 0, 0, 100),
    visuals: clamp(Number(rawData.visuals) || 0, 0, 100),
    brand: clamp(Number(rawData.brand) || 0, 0, 100),
    findings,
    generatedAt: String(rawData.generatedAt || new Date().toISOString()),
    pipeline: Array.isArray(rawData.pipeline)
      ? rawData.pipeline.map((item) => String(item || '').trim()).filter(Boolean)
      : undefined,
  };
};

const parseDesignPlan = (payload: unknown): PresentationDesignPlan | null => {
  const root = isObjectRecord(payload) ? payload : null;
  const rawData = isObjectRecord(root?.data) ? root.data : root;
  if (!isObjectRecord(rawData)) return null;

  const summary = isObjectRecord(rawData.summary) ? rawData.summary : {};
  const rawVisualCounts = isObjectRecord(summary.visualCounts) ? summary.visualCounts : {};
  const visualTypes: PresentationDesignVisualType[] = [
    'title',
    'agenda',
    'problem',
    'solution',
    'feature',
    'process',
    'kpi',
    'timeline',
    'roadmap',
    'architecture',
    'scenario',
    'knowledge-check',
    'comparison',
    'demo',
    'quote',
    'cta',
    'summary',
  ];
  const visualCounts = visualTypes.reduce(
    (acc, visualType) => {
      const count = Number(rawVisualCounts[visualType]);
      acc[visualType] = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
      return acc;
    },
    {} as Record<PresentationDesignVisualType, number>,
  );

  const slides = Array.isArray(rawData.slides)
    ? rawData.slides
        .map<PresentationDesignSlidePlan | null>((entry) => {
          if (!isObjectRecord(entry)) return null;
          const copySuggestions = isObjectRecord(entry.copySuggestions) ? entry.copySuggestions : {};
          const graphicSlots = Array.isArray(entry.graphicSlots)
            ? entry.graphicSlots
                .map<PresentationDesignGraphicSlot | null>((slot) => {
                  if (!isObjectRecord(slot)) return null;
                  const graphicSlot: PresentationDesignGraphicSlot = {
                    id: String(slot.id || `slot-${Date.now()}`),
                    kind: toDesignGraphicKind(String(slot.kind || 'illustration')),
                    label: String(slot.label || '').trim(),
                    prompt: String(slot.prompt || '').trim(),
                    x: clamp(Number(slot.x) || 0, 0, 100),
                    y: clamp(Number(slot.y) || 0, 0, 100),
                    width: clamp(Number(slot.width) || 20, 1, 100),
                    height: clamp(Number(slot.height) || 12, 1, 100),
                    resolvedAssetUrl: String(slot.resolvedAssetUrl || '').trim() || undefined,
                    assetSource: String(slot.assetSource || '').trim() || undefined,
                  };
                  return graphicSlot;
                })
                .filter(isPresent)
            : [];

          const slidePlan: PresentationDesignSlidePlan = {
            slideId: String(entry.slideId || '').trim(),
            visualType: toDesignVisualType(String(entry.visualType || 'feature')),
            grammarId: toPresentationGrammarId(String(entry.grammarId || 'content-grid')),
            narrativeRole:
              (String(entry.narrativeRole || '').trim().toLowerCase() as SharedPresentationNarrativeRole) ||
              'setup',
            layoutHint: String(entry.layoutHint || '').trim(),
            recommendedLayout: toDisplayMode(String(entry.recommendedLayout || 'split-screen')),
            confidence: clamp(Number(entry.confidence) || 0.5, 0, 1),
            reasons: Array.isArray(entry.reasons)
              ? entry.reasons.map((reason) => String(reason || '').trim()).filter(Boolean)
              : [],
            intentTags: Array.isArray(entry.intentTags)
              ? entry.intentTags.map((tag) => String(tag || '').trim()).filter(Boolean)
              : [],
            contentBudget: isObjectRecord(entry.contentBudget)
              ? {
                  titleMaxChars: Math.max(24, Number(entry.contentBudget.titleMaxChars) || 56),
                  subtitleMaxChars: Math.max(40, Number(entry.contentBudget.subtitleMaxChars) || 92),
                  maxBullets: Math.max(0, Number(entry.contentBudget.maxBullets) || 4),
                  bulletMaxChars: Math.max(32, Number(entry.contentBudget.bulletMaxChars) || 80),
                  maxColumns: Math.max(0, Number(entry.contentBudget.maxColumns) || 0),
                  maxTimelineSteps: Math.max(0, Number(entry.contentBudget.maxTimelineSteps) || 0),
                  maxStats: Math.max(0, Number(entry.contentBudget.maxStats) || 0),
                  maxQuoteChars: Math.max(0, Number(entry.contentBudget.maxQuoteChars) || 0),
                  maxCtaChars: Math.max(24, Number(entry.contentBudget.maxCtaChars) || 44),
                }
              : {
                  titleMaxChars: 56,
                  subtitleMaxChars: 92,
                  maxBullets: 4,
                  bulletMaxChars: 80,
                  maxColumns: 0,
                  maxTimelineSteps: 0,
                  maxStats: 0,
                  maxQuoteChars: 0,
                  maxCtaChars: 44,
                },
            structuredContent: isObjectRecord(entry.structuredContent)
              ? {
                  eyebrow: String(entry.structuredContent.eyebrow || '').trim(),
                  title: String(entry.structuredContent.title || '').trim(),
                  subtitle: String(entry.structuredContent.subtitle || '').trim(),
                  bullets: Array.isArray(entry.structuredContent.bullets)
                    ? entry.structuredContent.bullets.map((item) => String(item || '').trim()).filter(Boolean)
                    : [],
                  columns: Array.isArray(entry.structuredContent.columns)
                    ? entry.structuredContent.columns
                        .map((item) =>
                          isObjectRecord(item)
                            ? {
                                title: String(item.title || '').trim(),
                                body: String(item.body || '').trim(),
                              }
                            : null,
                        )
                        .filter(isPresent)
                    : [],
                  steps: Array.isArray(entry.structuredContent.steps)
                    ? entry.structuredContent.steps
                        .map((item) =>
                          isObjectRecord(item)
                            ? {
                                title: String(item.title || '').trim(),
                                body: String(item.body || '').trim(),
                              }
                            : null,
                        )
                        .filter(isPresent)
                    : [],
                  stats: Array.isArray(entry.structuredContent.stats)
                    ? entry.structuredContent.stats
                        .map((item) =>
                          isObjectRecord(item)
                            ? {
                                value: String(item.value || '').trim(),
                                label: String(item.label || '').trim(),
                                context: String(item.context || '').trim(),
                              }
                            : null,
                        )
                        .filter(isPresent)
                    : [],
                  quoteText: String(entry.structuredContent.quoteText || '').trim(),
                  quoteAttribution: String(entry.structuredContent.quoteAttribution || '').trim(),
                  ctaLabel: String(entry.structuredContent.ctaLabel || '').trim(),
                  ctaSupport: String(entry.structuredContent.ctaSupport || '').trim(),
                  mediaIntent: String(entry.structuredContent.mediaIntent || '').trim(),
                  emphasis: Array.isArray(entry.structuredContent.emphasis)
                    ? entry.structuredContent.emphasis.map((item) => String(item || '').trim()).filter(Boolean)
                    : [],
                }
              : {
                  eyebrow: '',
                  title: String(copySuggestions.title || '').trim(),
                  subtitle: '',
                  bullets: Array.isArray(copySuggestions.body)
                    ? copySuggestions.body.map((line) => String(line || '').trim()).filter(Boolean)
                    : [],
                  columns: [],
                  steps: [],
                  stats: [],
                  quoteText: '',
                  quoteAttribution: '',
                  ctaLabel: String(copySuggestions.cta || '').trim(),
                  ctaSupport: '',
                  mediaIntent: '',
                  emphasis: [],
                },
            repairActions: Array.isArray(entry.repairActions)
              ? entry.repairActions
                  .map<SharedPresentationRepairAction | null>((item) =>
                    isObjectRecord(item)
                      ? ({
                          id: String(item.id || '').trim() as SharedPresentationRepairAction['id'],
                          reason: String(item.reason || '').trim(),
                          from: String(item.from || '').trim() || undefined,
                          to: String(item.to || '').trim() || undefined,
                        } satisfies SharedPresentationRepairAction)
                      : null,
                  )
                  .filter(isPresent)
                  .filter((item) => Boolean(item.id && item.reason))
              : [],
            visualNeeds: Array.isArray(entry.visualNeeds)
              ? entry.visualNeeds
                  .map<SharedPresentationVisualNeed | null>((item) =>
                    isObjectRecord(item)
                      ? ({
                          kind: toDesignGraphicKind(String(item.kind || 'illustration')),
                          label: String(item.label || '').trim() || 'Visual',
                          prompt: String(item.prompt || '').trim() || 'Supporting visual',
                          priority: String(item.priority || '').trim().toLowerCase() === 'primary' ? 'primary' : 'secondary',
                        } satisfies SharedPresentationVisualNeed)
                      : null,
                  )
                  .filter(isPresent)
              : [],
            copySuggestions: {
              title: String(copySuggestions.title || '').trim(),
              body: Array.isArray(copySuggestions.body)
                ? copySuggestions.body.map((line) => String(line || '').trim()).filter(Boolean)
                : [],
              cta: String(copySuggestions.cta || '').trim(),
            },
            graphicSlots,
            continuation: isObjectRecord(entry.continuation)
              ? {
                  title: String(entry.continuation.title || '').trim(),
                  subtitle: String(entry.continuation.subtitle || '').trim(),
                  bullets: Array.isArray(entry.continuation.bullets)
                    ? entry.continuation.bullets.map((line) => String(line || '').trim()).filter(Boolean)
                    : [],
                  grammarId: toPresentationGrammarId(String(entry.continuation.grammarId || 'content-grid')),
                }
              : null,
          };
          return slidePlan;
        })
        .filter(isPresent)
        .filter((entry) => Boolean(entry.slideId))
    : [];

  if (slides.length === 0) return null;

  return {
    scope: rawData.scope === 'skill' ? 'skill' : 'course',
    courseId: String(rawData.courseId || '').trim(),
    lessonId: String(rawData.lessonId || '').trim(),
    deckName: String(rawData.deckName || '').trim(),
    recommendedTemplateId: toTemplateId(String(rawData.recommendedTemplateId || 'walkthrough')),
    recommendedVisualThemeId: toVisualThemeId(String(rawData.recommendedVisualThemeId || 'sales-command')),
    recommendedDisplayMode: toDisplayMode(String(rawData.recommendedDisplayMode || 'split-screen')),
    recommendedSplitLayoutVariant: toSplitLayoutVariant(
      String(rawData.recommendedSplitLayoutVariant || 'balanced'),
    ),
    summary: {
      generatedBy: String(summary.generatedBy || 'academy-design-plan-heuristic-v1'),
      provider:
        String(summary.provider || '').trim().toLowerCase() === 'huggingface'
          ? 'huggingface'
          : String(summary.provider || '').trim().toLowerCase() === 'openai'
            ? 'openai'
            : 'rule-engine',
      model: String(summary.model || '').trim() || undefined,
      slideCount: Math.max(0, Number(summary.slideCount) || slides.length),
      visualCounts,
      grammarCounts: isObjectRecord(summary.grammarCounts)
        ? Object.fromEntries(
            Object.entries(summary.grammarCounts).map(([key, value]) => [key, Math.max(0, Number(value) || 0)]),
          )
        : undefined,
      repairActionsCount: Math.max(0, Number(summary.repairActionsCount) || 0),
      templateMemoryMatches: parseTemplateMemoryMatches(summary.templateMemoryMatches),
      retrievalMeta: isObjectRecord(summary.retrievalMeta)
        ? {
            provider:
              String(summary.retrievalMeta.provider || '').trim().toLowerCase() === 'huggingface'
                ? 'huggingface'
                : 'lexical',
            embeddingModel: String(summary.retrievalMeta.embeddingModel || '').trim() || undefined,
            rerankerModel: String(summary.retrievalMeta.rerankerModel || '').trim() || undefined,
            candidateCount: Math.max(0, Number(summary.retrievalMeta.candidateCount) || 0),
            matchedCount: Math.max(0, Number(summary.retrievalMeta.matchedCount) || 0),
          }
        : undefined,
      brandContextName: String(summary.brandContextName || '').trim() || undefined,
      pipeline: Array.isArray(summary.pipeline)
        ? summary.pipeline.map((item) => String(item || '').trim()).filter(Boolean)
        : undefined,
    },
    brandTokens: isObjectRecord(rawData.brandTokens)
      ? ({
          ...academyPresentationThemeTokens(
            toVisualThemeId(String(rawData.brandTokens.themeId || rawData.recommendedVisualThemeId || 'neutral-modern')),
          ),
          ...rawData.brandTokens,
          themeId: toVisualThemeId(
            String(rawData.brandTokens.themeId || rawData.recommendedVisualThemeId || 'neutral-modern'),
          ),
        } as SharedPresentationBrandTokens)
      : academyPresentationThemeTokens(
          toVisualThemeId(String(rawData.recommendedVisualThemeId || 'neutral-modern')),
        ),
    slides,
    generatedAt: String(rawData.generatedAt || new Date().toISOString()),
  };
};

const _designGraphicKindToElementType = (
  kind: PresentationDesignGraphicSlot['kind'],
): PresentationElementType =>
  kind === 'chart' || kind === 'screenshot' || kind === 'illustration' || kind === 'photo'
    ? 'image'
    : 'shape';

const LOCAL_DESIGN_VISUAL_KEYWORDS: Array<{
  type: PresentationDesignVisualType;
  keywords: string[];
}> = [
  { type: 'agenda', keywords: ['agenda', 'overview', 'oversikt', 'program'] },
  { type: 'problem', keywords: ['problem', 'challenge', 'utfordring', 'risk'] },
  { type: 'solution', keywords: ['solution', 'losning', 'tiltak', 'approach'] },
  { type: 'feature', keywords: ['feature', 'funksjon', 'module', 'capability'] },
  { type: 'process', keywords: ['step', 'workflow', 'prosess', 'flyt', 'how to', 'swimlane', 'handoff', 'cross functional'] },
  { type: 'kpi', keywords: ['kpi', 'result', 'vekst', 'revenue', 'conversion'] },
  { type: 'timeline', keywords: ['timeline', 'mile', 'phase', 'q1', 'q2', 'q3', 'q4'] },
  { type: 'roadmap', keywords: ['roadmap', 'release plan', 'milepæl', 'milepael', 'next phase'] },
  { type: 'architecture', keywords: ['architecture', 'arkitektur', 'stack', 'system map', 'components', 'layer', 'data flow', 'integration flow', 'api flow'] },
  { type: 'scenario', keywords: ['scenario', 'situasjon', 'use case', 'brukstilfelle', 'role play'] },
  { type: 'knowledge-check', keywords: ['knowledge check', 'quiz', 'test deg selv', 'reflection question'] },
  { type: 'comparison', keywords: ['compare', 'vs', 'versus', 'before', 'after', 'decision matrix', 'prioritization matrix', 'impact effort'] },
  { type: 'demo', keywords: ['demo', 'screen', 'walkthrough', 'live'] },
  { type: 'quote', keywords: ['quote', 'testimonial', 'kundesitat', 'feedback'] },
  { type: 'cta', keywords: ['cta', 'next step', 'contact', 'kontakt', 'book'] },
  { type: 'summary', keywords: ['summary', 'oppsummering', 'recap', 'takeaway'] },
];

const normalizeLocalDesignToken = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9æøåäöüéèáàíìóòúùñçß]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const inferLocalDesignVisualType = (
  sourceText: string,
  index: number,
  totalSlides: number,
): PresentationDesignVisualType => {
  const normalized = normalizeLocalDesignToken(sourceText);
  if (!normalized) {
    if (index === 0) return 'title';
    if (totalSlides > 2 && index >= totalSlides - 1) return 'summary';
    return 'feature';
  }
  if (index === 0 && /(welcome|velkommen|intro|introduksjon)/i.test(normalized)) {
    return 'title';
  }

  let best: PresentationDesignVisualType = totalSlides > 2 && index >= totalSlides - 1 ? 'summary' : 'feature';
  let bestScore = -1;
  LOCAL_DESIGN_VISUAL_KEYWORDS.forEach((entry) => {
    let score = 0;
    entry.keywords.forEach((keyword) => {
      if (normalized.includes(normalizeLocalDesignToken(keyword))) {
        score += 1;
      }
    });
    if (score > bestScore) {
      bestScore = score;
      best = entry.type;
    }
  });
  return best;
};

const _layoutForLocalDesignVisualType = (visualType: PresentationDesignVisualType): PresentationDisplayMode => {
  if (visualType === 'title') return 'full-frame';
  if (visualType === 'agenda' || visualType === 'summary') return 'side-panel';
  if (visualType === 'quote' || visualType === 'cta') return 'picture-in-picture';
  return 'split-screen';
};

const _graphicSlotsForLocalDesignVisualType = (
  slideId: string,
  visualType: PresentationDesignVisualType,
  title: string,
): PresentationDesignGraphicSlot[] => {
  const promptBase = String(title || 'Slide').trim();
  const createSlot = (
    idSuffix: string,
    kind: PresentationDesignGraphicSlot['kind'],
    label: string,
    prompt: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): PresentationDesignGraphicSlot => ({
    id: `${slideId}-${idSuffix}`,
    kind,
    label,
    prompt,
    x,
    y,
    width,
    height,
  });

  if (visualType === 'kpi') {
    return [
      createSlot('kpi-chart', 'chart', 'KPI chart', `${promptBase} KPI chart`, 56, 14, 38, 42),
      createSlot('kpi-badge', 'badge', 'Growth badge', `${promptBase} growth badge`, 76, 62, 18, 14),
    ];
  }
  if (visualType === 'timeline') {
    return [
      createSlot('timeline-main', 'illustration', 'Roadmap', `${promptBase} timeline roadmap`, 54, 14, 40, 68),
    ];
  }
  if (visualType === 'demo') {
    return [
      createSlot('demo-shot', 'screenshot', 'Product screenshot', `${promptBase} product screenshot`, 54, 14, 40, 58),
      createSlot('demo-callout', 'badge', 'Callout', `${promptBase} feature callout`, 56, 74, 18, 10),
    ];
  }
  if (visualType === 'title') {
    return [createSlot('hero', 'photo', 'Hero', `${promptBase} hero visual`, 4, 8, 92, 84)];
  }
  const slots: PresentationDesignGraphicSlot[] = [
    createSlot('main', 'illustration', 'Main visual', `${promptBase} main visual`, 54, 14, 40, 58),
    createSlot('icon', 'icon', 'Support icon', `${promptBase} support icon`, 56, 74, 14, 10),
  ];
  return slots;
};

const buildLocalDesignPlanFallback = ({
  deck,
  scope,
  courseId,
  lessonId,
  projectTemplateId,
  useNorwegian,
}: {
  deck: PresentationDeck;
  scope: PresentationScope;
  courseId: string;
  lessonId: string;
  projectTemplateId: string;
  useNorwegian: boolean;
}): PresentationDesignPlan => {
  const mappedTheme: PresentationVisualThemeId =
    projectTemplateId === 'sales-enablement-a-a'
      ? 'sales-command'
      : projectTemplateId === 'production-operations-a-a'
        ? 'operations-grid'
        : projectTemplateId === 'offshore-safety-a-a'
          ? 'offshore-briefing'
          : 'neutral-modern';
  const mappedTemplate =
    projectTemplateToPresentationTemplate[projectTemplateId] || deck.template || 'walkthrough';
  const splitVariant = getVisualThemePresetById(mappedTheme).splitLayoutVariant;

  const visualCounts: Record<PresentationDesignVisualType, number> = {
    title: 0,
    agenda: 0,
    problem: 0,
    solution: 0,
    feature: 0,
    process: 0,
    kpi: 0,
    timeline: 0,
    roadmap: 0,
    architecture: 0,
    scenario: 0,
    'knowledge-check': 0,
    comparison: 0,
    demo: 0,
    quote: 0,
    cta: 0,
    summary: 0,
  };

  const slides = deck.slides.map((slide, index) => {
    const bodyLines = collectSlideBodyLines(slide);
    const visualType = inferLocalDesignVisualType(
      `${slide.title} ${bodyLines.join(' ')} ${slide.speakerNotes}`,
      index,
      deck.slides.length,
    );
    visualCounts[visualType] += 1;
    const grammarPlan = academyPresentationBuildGrammarPlan({
      slideId: slide.id,
      title: slide.title,
      bodyLines,
      visualType,
      index,
      totalSlides: deck.slides.length,
      useNorwegian,
    });
    return {
      slideId: slide.id,
      visualType,
      grammarId: grammarPlan.grammarId,
      narrativeRole: grammarPlan.narrativeRole,
      layoutHint:
        grammarPlan.grammarId === 'stats' || grammarPlan.grammarId === 'chart'
          ? 'Use numeric contrast and a dominant chart frame.'
          : grammarPlan.grammarId === 'hero'
            ? 'Keep one message in focus and reduce visual clutter.'
            : 'Balance presenter, content, and visual hierarchy.',
      recommendedLayout: grammarPlan.recommendedLayout,
      confidence: 0.62,
      reasons: ['local heuristic fallback', `grammar:${grammarPlan.grammarId}`],
      intentTags: [visualType, grammarPlan.grammarId, mappedTemplate, mappedTheme, grammarPlan.recommendedLayout],
      contentBudget: grammarPlan.contentBudget,
      structuredContent: grammarPlan.structuredContent,
      repairActions: grammarPlan.repairActions,
      visualNeeds: grammarPlan.visualNeeds,
      copySuggestions: {
        title: grammarPlan.structuredContent.title,
        body:
          grammarPlan.structuredContent.bullets.length > 0
            ? grammarPlan.structuredContent.bullets
            : bodyLines,
        cta:
          grammarPlan.structuredContent.ctaLabel ||
          (useNorwegian ? 'Oppsummer og avtal neste steg.' : 'Summarize and confirm next step.'),
      },
      graphicSlots: grammarPlan.graphicSlots,
      continuation: grammarPlan.continuation,
    } as PresentationDesignSlidePlan;
  });

  return {
    scope,
    courseId,
    lessonId,
    deckName: deck.name,
    recommendedTemplateId: mappedTemplate,
    recommendedVisualThemeId: mappedTheme,
    recommendedDisplayMode: 'split-screen',
    recommendedSplitLayoutVariant: splitVariant,
    summary: {
      generatedBy: 'academy-design-plan-local-grammar-fallback-v2',
      slideCount: slides.length,
      visualCounts,
      grammarCounts: slides.reduce(
        (acc, slide) => {
          acc[slide.grammarId] = (acc[slide.grammarId] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      repairActionsCount: slides.reduce((acc, slide) => acc + slide.repairActions.length, 0),
      pipeline: ['brief-to-narrative', 'grammar-budget-repair', 'theme-token-apply'],
    },
    brandTokens: academyPresentationThemeTokens(mappedTheme),
    slides,
    generatedAt: new Date().toISOString(),
  };
};

const getVisualThemePresetById = (
  themeId: PresentationVisualThemeId,
): PresentationVisualThemePreset =>
  visualThemePresets.find((entry) => entry.id === themeId) || visualThemePresets[0];

const buildPresentationBrandKitFromTheme = (
  themeId: PresentationVisualThemeId,
  name?: string,
): PresentationBrandKit => {
  const base = academyPresentationThemeTokens(themeId);
  return {
    id: `presentation-brand-kit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || `${base.labelEn} Brand Kit`).trim() || `${base.labelEn} Brand Kit`,
    baseThemeId: themeId,
    primary: base.primary,
    secondary: base.secondary,
    accent: base.accent,
    canvasTitle: base.canvasTitle,
    canvasText: base.canvasText,
    headingFont: base.headingFont,
    bodyFont: base.bodyFont,
    cornerRadius: base.cornerRadius,
    chartStyle: base.chartStyle,
    imageStyle: base.imageStyle,
    logoText: '',
    footerText: '',
    requireLogo: false,
    requireFooter: false,
    minContrastRatio: 4.5,
    updatedAt: new Date().toISOString(),
  };
};

const resolvePresentationBrandTokens = (
  themeId: PresentationVisualThemeId,
  brandKit?: PresentationBrandKit | null,
): SharedPresentationBrandTokens => {
  const base = academyPresentationThemeTokens(brandKit?.baseThemeId || themeId);
  if (!brandKit) return base;
  return {
    ...base,
    labelNo: brandKit.name,
    labelEn: brandKit.name,
    primary: brandKit.primary || base.primary,
    secondary: brandKit.secondary || base.secondary,
    accent: brandKit.accent || base.accent,
    canvasTitle: brandKit.canvasTitle || base.canvasTitle,
    canvasText: brandKit.canvasText || base.canvasText,
    navAccent: brandKit.primary || base.navAccent,
    chipBg: alpha(brandKit.primary || base.primary, 0.16),
    chipText: '#edf3ff',
    headingFont: brandKit.headingFont || base.headingFont,
    bodyFont: brandKit.bodyFont || base.bodyFont,
    cornerRadius: Math.max(8, Number(brandKit.cornerRadius) || base.cornerRadius),
    chartStyle: brandKit.chartStyle || base.chartStyle,
    imageStyle: brandKit.imageStyle || base.imageStyle,
  };
};

const getPresentationBrandKitScopeKey = (courseId: string): string =>
  String(courseId || '').trim() || 'global';

const readPresentationBrandKitStore = (): PresentationBrandKitStoreMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PRESENTATION_BRAND_KITS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PresentationBrandKitStoreMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writePresentationBrandKitStore = (store: PresentationBrandKitStoreMap): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRESENTATION_BRAND_KITS_KEY, JSON.stringify(store));
  } catch {
    // ignore storage failures
  }
};

const inferProjectTemplateIdFromCourse = (course: Course | null | undefined): string => {
  const explicit = String(course?.curriculumProjectTemplateId || '').trim();
  if (explicit) return explicit;
  const purpose = String(course?.pedagogicalArchitecture?.purpose || '').toLowerCase();
  if (purpose.includes('salg') || purpose.includes('sales')) return 'sales-enablement-a-a';
  if (purpose.includes('produksjon') || purpose.includes('production')) return 'production-operations-a-a';
  if (purpose.includes('offshore') || purpose.includes('hms')) return 'offshore-safety-a-a';
  return '';
};

const resolvePresentationDefaultsForCourse = (
  course: Course | null | undefined,
): {
  templateId: PresentationTemplateId;
  visualThemeId: PresentationVisualThemeId;
  defaultMode: PresentationDisplayMode;
  splitLayoutVariant: PresentationSplitLayoutVariant;
} => {
  const projectTemplateId = inferProjectTemplateIdFromCourse(course);
  const mappedTheme: PresentationVisualThemeId =
    projectTemplateId === 'sales-enablement-a-a'
      ? 'sales-command'
      : projectTemplateId === 'production-operations-a-a'
        ? 'operations-grid'
        : projectTemplateId === 'offshore-safety-a-a'
          ? 'offshore-briefing'
          : 'neutral-modern';
  const mappedTemplate = projectTemplateToPresentationTemplate[projectTemplateId] || 'walkthrough';
  const templatePreset =
    templatePresets.find((template) => template.id === mappedTemplate) || templatePresets[0];
  return {
    templateId: mappedTemplate || templatePreset.id,
    visualThemeId: mappedTheme,
    defaultMode: templatePreset.defaultMode,
    splitLayoutVariant: 'balanced',
  };
};

const getScopeStorageKey = (
  courseId: string,
  scope: PresentationScope,
  lessonId?: string | null,
): string => {
  if (scope === 'skill' && lessonId) {
    return `${courseId}::skill::${lessonId}`;
  }
  return `${courseId}::course`;
};

const readPresentationStore = (): PresentationStoreMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PRESENTATION_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PresentationStoreMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writePresentationStore = (store: PresentationStoreMap): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRESENTATION_STORE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage failures and keep working in memory.
  }
};

const readPresentationStoreFromDb = async (): Promise<PresentationStoreMap | null> => {
  try {
    const response = await fetch(`/api/user/kv/${encodeURIComponent(PRESENTATION_KV_KEY)}`, {
      credentials: 'include',
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const value =
      payload && typeof payload === 'object'
        ? (payload.value ?? payload.data ?? null)
        : null;
    if (value === null || value === undefined) return null;
    const parsed =
      typeof value === 'string'
        ? (JSON.parse(value) as PresentationStoreMap)
        : (value as PresentationStoreMap);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writePresentationStoreToDb = async (store: PresentationStoreMap): Promise<void> => {
  try {
    await fetch('/api/user/kv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: PRESENTATION_KV_KEY, value: store }),
    });
  } catch {
    // Ignore persistence failure.
  }
};

const getEntryUpdatedAt = (entry?: PresentationStoreEntry): number => {
  if (!entry?.updatedAt) return 0;
  const ts = Date.parse(entry.updatedAt);
  return Number.isFinite(ts) ? ts : 0;
};

const mergePresentationStores = (
  localStore: PresentationStoreMap,
  dbStore: PresentationStoreMap,
): PresentationStoreMap => {
  const merged: PresentationStoreMap = {};
  const allKeys = new Set([...Object.keys(localStore || {}), ...Object.keys(dbStore || {})]);

  allKeys.forEach((key) => {
    const localEntry = localStore[key];
    const dbEntry = dbStore[key];
    if (!localEntry) {
      if (dbEntry) merged[key] = dbEntry;
      return;
    }
    if (!dbEntry) {
      merged[key] = localEntry;
      return;
    }
    merged[key] =
      getEntryUpdatedAt(localEntry) >= getEntryUpdatedAt(dbEntry)
        ? localEntry
        : dbEntry;
  });

  return merged;
};

const decodeXmlText = (value: string): string =>
  String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const extractTextRuns = (xml: string): string[] => {
  const runs = Array.from(String(xml || '').matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g));
  return runs
    .map((run) => decodeXmlText(run[1] || '').trim())
    .filter((entry) => entry.length > 0);
};

const buildDefaultSlideElements = (title: string, layout: PresentationDisplayMode): PresentationSceneElement[] => {
  const wide = layout === 'split-screen' || layout === 'full-frame';
  const elements: PresentationSceneElement[] = [
    {
      id: `scene-el-title-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'text',
      text: title,
      x: wide ? 8 : 12,
      y: 10,
      width: wide ? 56 : 76,
      height: 18,
      role: 'headline',
      align: 'left',
      tone: 'default',
    },
    {
      id: `scene-el-body-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'text',
      text: '',
      x: wide ? 8 : 12,
      y: 32,
      width: wide ? 56 : 76,
      height: 50,
      role: 'body',
      align: 'left',
      tone: 'muted',
    },
  ];
  return elements;
};

const collectSlideBodyLines = (slide: PresentationSlide | null): string[] => {
  if (!slide) return [];
  const normalizedTitle = String(slide.title || '').trim().toLowerCase();
  const lines = slide.elements
    .filter((element) => element.type === 'text')
    .flatMap((element) =>
      String(element.text || '')
        .split(/\n|•/g)
        .map((value) => value.trim()),
    )
    .filter((line) => line.length > 0 && line.toLowerCase() !== normalizedTitle);

  const unique = Array.from(new Set(lines));
  if (unique.length === 1) {
    const expanded = unique[0]
      .split(/(?:\.\s+|;\s+|,\s+(?=[A-Z0-9ÆØÅ]))/g)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (expanded.length > 1) return expanded.slice(0, 8);
  }
  return unique.slice(0, 8);
};

const PPTX_DEFAULT_SLIDE_WIDTH_EMU = 9144000;
const PPTX_DEFAULT_SLIDE_HEIGHT_EMU = 6858000;

const escapeSvgText = (value: string): string =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const encodeSvgToDataUrl = (svg: string): string => {
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
    }
  } catch {
    // fallback below
  }

  try {
    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
  } catch {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
};

const splitTextLines = (text: string, maxChars = 52): string[] => {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const words = raw.split(/\s+/g);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });

  if (current) lines.push(current);
  return lines.slice(0, 4);
};

const shortPreviewText = (value: string, maxChars: number): string => {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (raw.length <= maxChars) return raw;
  const cut = raw.slice(0, maxChars).replace(/\s+\S*$/, '').trim();
  return `${cut || raw.slice(0, maxChars - 1)}…`;
};

const solidPreviewColor = (value: string, fallback: string): string => {
  const raw = String(value || '').trim();
  const rgbaMatch = raw.match(/rgba?\([^)]+\)/i);
  if (rgbaMatch?.[0]) return rgbaMatch[0];
  const hexMatch = raw.match(/#[0-9a-f]{3,8}/i);
  if (hexMatch?.[0]) return hexMatch[0];
  return fallback;
};

const extractSlideDimensionsFromPresentationXml = (
  presentationXml: string | undefined,
): { widthEmu: number; heightEmu: number } => {
  const xml = String(presentationXml || '');
  const match = xml.match(/<p:sldSz[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/i);
  const widthEmu = Number.parseInt(match?.[1] || '', 10);
  const heightEmu = Number.parseInt(match?.[2] || '', 10);
  return {
    widthEmu: Number.isFinite(widthEmu) && widthEmu > 0 ? widthEmu : PPTX_DEFAULT_SLIDE_WIDTH_EMU,
    heightEmu: Number.isFinite(heightEmu) && heightEmu > 0 ? heightEmu : PPTX_DEFAULT_SLIDE_HEIGHT_EMU,
  };
};

const parseBoundsFromXmlBlock = (
  blockXml: string,
  defaults: { x: number; y: number; width: number; height: number },
  slideWidthEmu: number,
  slideHeightEmu: number,
): { x: number; y: number; width: number; height: number } => {
  const source = String(blockXml || '');
  const x = Number.parseFloat(source.match(/<a:off[^>]*\bx="(\d+)"/i)?.[1] || '');
  const y = Number.parseFloat(source.match(/<a:off[^>]*\by="(\d+)"/i)?.[1] || '');
  const width = Number.parseFloat(source.match(/<a:ext[^>]*\bcx="(\d+)"/i)?.[1] || '');
  const height = Number.parseFloat(source.match(/<a:ext[^>]*\bcy="(\d+)"/i)?.[1] || '');

  const normalizedX =
    Number.isFinite(x) && slideWidthEmu > 0 ? clamp((x / slideWidthEmu) * 100, 0, 100) : defaults.x;
  const normalizedY =
    Number.isFinite(y) && slideHeightEmu > 0 ? clamp((y / slideHeightEmu) * 100, 0, 100) : defaults.y;
  const normalizedWidth =
    Number.isFinite(width) && slideWidthEmu > 0 ? clamp((width / slideWidthEmu) * 100, 4, 100) : defaults.width;
  const normalizedHeight =
    Number.isFinite(height) && slideHeightEmu > 0 ? clamp((height / slideHeightEmu) * 100, 3, 100) : defaults.height;

  return {
    x: normalizedX,
    y: normalizedY,
    width: normalizedWidth,
    height: normalizedHeight,
  };
};

const buildSlideSvgPreview = (
  slide: PresentationSlide,
  themeId: PresentationVisualThemeId,
  deckName: string,
  options?: {
    brandTokens?: SharedPresentationBrandTokens;
    brandKit?: PresentationBrandKit | null;
  },
): string => {
  const theme = options?.brandTokens || academyPresentationThemeTokens(themeId);
  const brandKit = options?.brandKit || null;
  const headingFont = escapeSvgText(String(theme.headingFont || 'Segoe UI, sans-serif').replace(/"/g, "'"));
  const bodyFont = escapeSvgText(String(theme.bodyFont || 'Segoe UI, sans-serif').replace(/"/g, "'"));
  const navFill = solidPreviewColor(theme.navBg, '#101826');
  const width = 1280;
  const height = 720;
  const headerHeight = 88;
  const margin = 28;
  const elementMarkup = slide.elements
    .slice(0, 18)
    .map((element) => {
      const x = Math.round((clamp(element.x, 0, 100) / 100) * width);
      const y = Math.round((clamp(element.y, 0, 100) / 100) * (height - headerHeight) + headerHeight);
      const w = Math.round((clamp(element.width, 1, 100) / 100) * width);
      const h = Math.round((clamp(element.height, 1, 100) / 100) * (height - headerHeight));
      const safeX = clamp(x, margin, width - margin);
      const safeY = clamp(y, headerHeight + 8, height - margin);
      const safeW = clamp(w, 80, width - margin - safeX);
      const safeH = clamp(h, 36, height - margin - safeY);

      if (element.type === 'text') {
        const lines = splitTextLines(element.text, 48);
        const textColor =
          element.tone === 'accent'
            ? theme.primary
            : element.tone === 'inverse'
              ? '#f7fbff'
              : element.tone === 'muted'
                ? alpha(theme.canvasText, 0.86)
                : theme.canvasTitle;
        const fontSize =
          element.role === 'headline'
            ? 28
            : element.role === 'quote'
              ? 24
              : element.role === 'stat-value'
                ? 26
                : element.role === 'subtitle'
                  ? 18
                  : element.role === 'eyebrow'
                    ? 13
                    : 16;
        const fontWeight =
          element.role === 'headline' || element.role === 'stat-value'
            ? 800
            : element.role === 'subtitle' || element.role === 'column-title' || element.role === 'step-title'
              ? 700
              : 600;
        const align = element.align === 'center' ? 'middle' : 'start';
        const textAnchorX = element.align === 'center' ? safeX + safeW / 2 : safeX + 16;
        const cardFill =
          element.role === 'headline' && slide.layout === 'full-frame'
            ? 'rgba(255,255,255,0.74)'
            : theme.surface;
        return `
          <rect x="${safeX}" y="${safeY}" width="${safeW}" height="${safeH}" rx="14" ry="14"
            fill="${cardFill}" stroke="${alpha(theme.primary, 0.12)}" stroke-width="1.2" />
          ${lines
            .map(
              (line, lineIndex) => `
                <text x="${textAnchorX}" y="${safeY + 24 + lineIndex * (fontSize + 4)}"
                  fill="${textColor}"
                  text-anchor="${align}"
                  font-family="${element.role === 'headline' ? headingFont : bodyFont}"
                  font-size="${fontSize}"
                  font-weight="${fontWeight}">
                  ${escapeSvgText(line)}
                </text>`,
            )
            .join('')}
        `;
      }

      const placeholderLabel = escapeSvgText(
        shortPreviewText(String(element.prompt || element.text || element.role || 'Visual'), 48),
      );
      const mediaFill =
        element.type === 'video'
          ? alpha(theme.accent, 0.18)
          : element.type === 'image'
            ? alpha(theme.secondary, 0.18)
            : alpha(theme.primary, 0.12);
      const assetHref = String(element.assetDataUrl || '').trim();
      if (assetHref) {
        return `
          <rect x="${safeX}" y="${safeY}" width="${safeW}" height="${safeH}" rx="14" ry="14"
            fill="${theme.surface}" stroke="${alpha(theme.primary, 0.14)}" stroke-width="1.2" />
          <image href="${escapeSvgText(assetHref)}" x="${safeX + 6}" y="${safeY + 6}"
            width="${Math.max(34, safeW - 12)}" height="${Math.max(26, safeH - 12)}"
            preserveAspectRatio="xMidYMid slice" />
        `;
      }
      return `
        <rect x="${safeX}" y="${safeY}" width="${safeW}" height="${safeH}" rx="14" ry="14"
          fill="${theme.surface}" stroke="${alpha(theme.primary, 0.14)}" stroke-width="1.2" />
        <rect x="${safeX + 10}" y="${safeY + 10}" width="${Math.max(34, safeW - 20)}" height="${Math.max(26, safeH - 20)}"
          rx="10" ry="10" fill="${mediaFill}" />
        <text x="${safeX + 18}" y="${safeY + 30}"
          fill="${theme.canvasTitle}"
          font-family="${bodyFont}"
          font-size="15"
          font-weight="700">
          ${placeholderLabel}
        </text>
      `;
    })
    .join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="slideBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${theme.surface}" />
          <stop offset="100%" stop-color="${theme.surfaceMuted}" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#slideBg)" />
      <rect x="0" y="0" width="${width}" height="${headerHeight}" fill="${navFill}" />
      <text x="${margin}" y="38" fill="#f2f6ff" font-family="${bodyFont}" font-size="15" font-weight="700">
        ${escapeSvgText(deckName || 'Presentation')}
      </text>
      <text x="${margin}" y="70" fill="${theme.navAccent}" font-family="${headingFont}" font-size="28" font-weight="800">
        ${escapeSvgText(slide.title || 'Slide')}
      </text>
      ${brandKit?.logoText ? `
        <rect x="${width - 254}" y="18" width="214" height="34" rx="${Math.max(10, theme.cornerRadius - 2)}" fill="${alpha(theme.primary, 0.22)}" stroke="${alpha(theme.primary, 0.36)}" />
        <text x="${width - 236}" y="40" fill="#f7fbff" font-family="${headingFont}" font-size="15" font-weight="800">
          ${escapeSvgText(shortPreviewText(brandKit.logoText, 24))}
        </text>
      ` : ''}
      ${elementMarkup}
      ${brandKit?.footerText ? `
        <line x1="${margin}" y1="${height - 44}" x2="${width - margin}" y2="${height - 44}" stroke="${alpha(theme.canvasText, 0.18)}" stroke-width="1" />
        <text x="${margin}" y="${height - 18}" fill="${alpha(theme.canvasText, 0.86)}" font-family="${bodyFont}" font-size="14" font-weight="600">
          ${escapeSvgText(shortPreviewText(brandKit.footerText, 82))}
        </text>
      ` : ''}
    </svg>
  `;

  return encodeSvgToDataUrl(svg);
};

const createSceneTextElement = (
  slideId: string,
  key: string,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  role: NonNullable<PresentationSceneElement['role']>,
  options?: {
    align?: PresentationSceneElement['align'];
    tone?: PresentationSceneElement['tone'];
  },
): PresentationSceneElement => ({
  id: `${slideId}-${key}`,
  type: 'text',
  text: String(text || '').trim(),
  x,
  y,
  width,
  height,
  role,
  align: options?.align || 'left',
  tone: options?.tone || 'default',
});

const createSceneVisualElement = (
  slideId: string,
  key: string,
  type: Exclude<PresentationElementType, 'text'>,
  prompt: string,
  x: number,
  y: number,
  width: number,
  height: number,
  role: NonNullable<PresentationSceneElement['role']>,
  options?: {
    graphicKind?: PresentationDesignGraphicSlot['kind'];
    assetDataUrl?: string;
  },
): PresentationSceneElement => ({
  id: `${slideId}-${key}`,
  type,
  text: '',
  prompt,
  x,
  y,
  width,
  height,
  role,
  tone: 'default',
  graphicKind: options?.graphicKind,
  assetDataUrl: String(options?.assetDataUrl || '').trim(),
});

const buildElementsFromStructuredSlidePlan = (
  slide: PresentationSlide,
  slidePlan: PresentationDesignSlidePlan,
  themeId: PresentationVisualThemeId,
  brandTokensOverride?: SharedPresentationBrandTokens,
): PresentationSceneElement[] => {
  const layout = slidePlan.recommendedLayout;
  const themeTokens = brandTokensOverride || academyPresentationThemeTokens(themeId);
  const titleX = layout === 'split-screen' || layout === 'full-frame' ? 8 : 10;
  const titleWidth = layout === 'split-screen' || layout === 'full-frame' ? 48 : 72;
  const contentX = titleX;
  const contentWidth = titleWidth;
  const visualX = layout === 'full-frame' ? 58 : layout === 'side-panel' ? 58 : 54;
  const visualWidth = layout === 'full-frame' ? 34 : layout === 'side-panel' ? 34 : 40;
  const elements: PresentationSceneElement[] = [];
  const content = slidePlan.structuredContent;

  if (content.eyebrow) {
    elements.push(
      createSceneTextElement(
        slide.id,
        'eyebrow',
        content.eyebrow,
        contentX,
        7,
        contentWidth,
        8,
        'eyebrow',
        { tone: 'accent' },
      ),
    );
  }
  elements.push(
    createSceneTextElement(slide.id, 'headline', content.title || slide.title, contentX, 10, contentWidth, 15, 'headline'),
  );
  if (content.subtitle) {
    elements.push(
      createSceneTextElement(
        slide.id,
        'subtitle',
        content.subtitle,
        contentX,
        27,
        contentWidth,
        12,
        'subtitle',
        { tone: 'muted' },
      ),
    );
  }

  let cursorY = content.subtitle ? 41 : 30;
  const pushBullets = (bullets: string[], startY: number) => {
    bullets.slice(0, 5).forEach((bullet, index) => {
      elements.push(
        createSceneTextElement(
          slide.id,
          `bullet-${index}`,
          bullet,
          contentX,
          startY + index * 11,
          contentWidth,
          9,
          'bullet',
          { tone: 'muted' },
        ),
      );
    });
  };

  if (
    slidePlan.grammarId === 'comparison' ||
    slidePlan.grammarId === 'decision-matrix' ||
    slidePlan.grammarId === 'before-after' ||
    slidePlan.grammarId === 'team' ||
    slidePlan.grammarId === 'case-study' ||
    slidePlan.grammarId === 'architecture' ||
    slidePlan.grammarId === 'architecture-diagram' ||
    slidePlan.grammarId === 'product-architecture-flow' ||
    slidePlan.grammarId === 'org-chart' ||
    slidePlan.grammarId === 'scenario' ||
    slidePlan.grammarId === 'decision-tree'
  ) {
    const usesWideColumnGrid =
      slidePlan.grammarId === 'architecture' ||
      slidePlan.grammarId === 'architecture-diagram' ||
      slidePlan.grammarId === 'product-architecture-flow' ||
      slidePlan.grammarId === 'org-chart';
    const columns = content.columns.slice(0, usesWideColumnGrid ? 4 : 3);
    const columnWidth =
      usesWideColumnGrid
        ? 17.5
        : columns.length === 2
          ? 23
          : 15.5;
    columns.forEach((column, index) => {
      const x =
        slidePlan.grammarId === 'architecture' ||
        slidePlan.grammarId === 'architecture-diagram' ||
        slidePlan.grammarId === 'product-architecture-flow' ||
        slidePlan.grammarId === 'org-chart'
          ? contentX + (index % 2) * (columnWidth + 3)
          : contentX + index * (columnWidth + 2.5);
      const y =
        slidePlan.grammarId === 'architecture' ||
        slidePlan.grammarId === 'architecture-diagram' ||
        slidePlan.grammarId === 'product-architecture-flow' ||
        slidePlan.grammarId === 'org-chart'
          ? cursorY + Math.floor(index / 2) * 18
          : cursorY;
      elements.push(
        createSceneTextElement(slide.id, `column-title-${index}`, column.title, x, y, columnWidth, 8, 'column-title'),
      );
      elements.push(
        createSceneTextElement(
          slide.id,
          `column-body-${index}`,
          column.body,
          x,
          y + 10,
          columnWidth,
          slidePlan.grammarId === 'architecture' ||
          slidePlan.grammarId === 'architecture-diagram' ||
          slidePlan.grammarId === 'product-architecture-flow' ||
          slidePlan.grammarId === 'org-chart'
            ? 12
            : 17,
          'column-body',
          { tone: 'muted' },
        ),
      );
    });
    cursorY +=
      slidePlan.grammarId === 'architecture' ||
      slidePlan.grammarId === 'architecture-diagram' ||
      slidePlan.grammarId === 'product-architecture-flow' ||
      slidePlan.grammarId === 'org-chart'
        ? 38
        : 30;
  } else if (
    slidePlan.grammarId === 'faq' ||
    slidePlan.grammarId === 'knowledge-check' ||
    slidePlan.grammarId === 'interactive-quiz'
  ) {
    content.columns.slice(0, 4).forEach((column, index) => {
      const columnWidth = 22;
      const x = contentX + (index % 2) * (columnWidth + 2.5);
      const y = cursorY + Math.floor(index / 2) * 20;
      elements.push(
        createSceneTextElement(
          slide.id,
          `${slidePlan.grammarId}-question-${index}`,
          slidePlan.grammarId === 'faq' ? column.title : `${String.fromCharCode(65 + index)}.`,
          x,
          y,
          slidePlan.grammarId === 'faq' ? columnWidth : 4,
          8,
          'column-title',
          { tone: 'accent' },
        ),
      );
      elements.push(
        createSceneTextElement(
          slide.id,
          `${slidePlan.grammarId}-answer-${index}`,
          slidePlan.grammarId === 'faq' ? column.body : column.body || column.title,
          slidePlan.grammarId === 'faq' ? x : x + 5,
          y + 8,
          slidePlan.grammarId === 'faq' ? columnWidth : columnWidth - 5,
          12,
          'column-body',
          { tone: 'muted' },
        ),
      );
    });
    cursorY += Math.max(1, Math.ceil(Math.min(content.columns.length, 4) / 2)) * 20;
  } else if (
    slidePlan.grammarId === 'timeline' ||
    slidePlan.grammarId === 'process' ||
    slidePlan.grammarId === 'roadmap' ||
    slidePlan.grammarId === 'swimlane-process'
  ) {
    if (slidePlan.grammarId === 'swimlane-process' && content.columns.length > 0) {
      content.columns.slice(0, 3).forEach((column, index) => {
        elements.push(
          createSceneTextElement(slide.id, `lane-title-${index}`, column.title, contentX, cursorY + index * 10, 18, 8, 'step-title', { tone: 'accent' }),
        );
        elements.push(
          createSceneTextElement(
            slide.id,
            `lane-body-${index}`,
            content.steps[index]?.title || column.body,
            contentX + 20,
            cursorY + index * 10,
            contentWidth - 20,
            8,
            'step-body',
            { tone: 'muted' },
          ),
        );
      });
      cursorY += Math.min(content.columns.length, 3) * 10 + 2;
    } else {
      content.steps.slice(0, slidePlan.grammarId === 'roadmap' ? 6 : 5).forEach((step, index) => {
      elements.push(
        createSceneTextElement(slide.id, `step-title-${index}`, step.title, contentX, cursorY + index * 11, 18, 8, 'step-title', { tone: 'accent' }),
      );
      elements.push(
        createSceneTextElement(
          slide.id,
          `step-body-${index}`,
          step.body,
          contentX + 20,
          cursorY + index * 11,
          contentWidth - 20,
          8,
          'step-body',
          { tone: 'muted' },
        ),
      );
      });
      cursorY += Math.min(content.steps.length, slidePlan.grammarId === 'roadmap' ? 6 : 5) * 11 + 2;
    }
  } else if (slidePlan.grammarId === 'stats' || slidePlan.grammarId === 'chart') {
    content.stats.slice(0, 4).forEach((stat, index) => {
      const x = contentX + (index % 2) * 24;
      const y = cursorY + Math.floor(index / 2) * 14;
      elements.push(
        createSceneTextElement(slide.id, `stat-value-${index}`, stat.value, x, y, 20, 10, 'stat-value', { tone: 'accent' }),
      );
      elements.push(
        createSceneTextElement(slide.id, `stat-label-${index}`, stat.label, x, y + 8, 20, 8, 'stat-label', { tone: 'muted' }),
      );
    });
    cursorY += Math.max(1, Math.ceil(Math.min(content.stats.length, 4) / 2)) * 15;
    pushBullets(content.bullets.slice(0, 2), cursorY);
  } else if (slidePlan.grammarId === 'quote') {
    elements.push(
      createSceneTextElement(slide.id, 'quote', content.quoteText || content.subtitle, contentX, cursorY, contentWidth, 20, 'quote'),
    );
    if (content.quoteAttribution) {
      elements.push(
        createSceneTextElement(
          slide.id,
          'quote-attribution',
          content.quoteAttribution,
          contentX,
          cursorY + 22,
          contentWidth,
          8,
          'quote-attribution',
          { tone: 'muted' },
        ),
      );
    }
    cursorY += 32;
  } else {
    pushBullets(content.bullets, cursorY);
    cursorY += Math.min(content.bullets.length, 5) * 11;
  }

  if (content.ctaLabel) {
    elements.push(
      createSceneTextElement(slide.id, 'cta', content.ctaLabel, contentX, Math.min(82, cursorY + 3), contentWidth, 8, 'cta', { tone: 'accent' }),
    );
    if (content.ctaSupport) {
      elements.push(
        createSceneTextElement(
          slide.id,
          'cta-support',
          content.ctaSupport,
          contentX,
          Math.min(90, cursorY + 12),
          contentWidth,
          8,
          'cta-support',
          { tone: 'muted' },
        ),
      );
    }
  }

  slidePlan.graphicSlots.slice(0, 4).forEach((slot, index) => {
    const type = slot.kind === 'chart' || slot.kind === 'illustration' || slot.kind === 'photo' || slot.kind === 'screenshot'
      ? 'image'
      : slot.kind === 'badge'
        ? 'shape'
        : slot.kind === 'icon'
          ? 'shape'
          : 'shape';
    const assetDataUrl =
      String(slot.resolvedAssetUrl || '').trim() ||
      buildPresentationGraphicAsset({
        slot,
        structuredContent: content,
        theme: themeTokens,
        grammarId: slidePlan.grammarId,
      });
    elements.push(
      createSceneVisualElement(
        slide.id,
        `visual-${index}`,
        type,
        slot.prompt || slot.label,
        clamp(slot.x, visualX, 94),
        clamp(slot.y, 14, 82),
        clamp(slot.width, 10, visualWidth),
        clamp(slot.height, 8, 60),
        slot.kind === 'badge' ? 'badge' : 'media',
        {
          graphicKind: slot.kind,
          assetDataUrl,
        },
      ),
    );
  });

  return elements.slice(0, 20);
};

const buildContinuationSlide = (
  sourceSlide: PresentationSlide,
  continuation: SharedPresentationContinuationPlan,
  useNorwegian: boolean,
  themeId: PresentationVisualThemeId,
  deckName: string,
  brandTokensOverride?: SharedPresentationBrandTokens,
  brandKit?: PresentationBrandKit | null,
): PresentationSlide => {
  const continuationPlan = academyPresentationBuildGrammarPlan({
    slideId: `${sourceSlide.id}--auto-cont-1`,
    title: continuation.title,
    bodyLines: continuation.bullets,
    visualType: 'summary',
    index: 0,
    totalSlides: 1,
    useNorwegian,
    preferredGrammarId: continuation.grammarId,
    preferredSubtitle: continuation.subtitle,
    preferredBullets: continuation.bullets,
  });
  const draftSlide: PresentationSlide = {
    id: `${sourceSlide.id}--auto-cont-1`,
    title: continuationPlan.structuredContent.title,
    sourceSlideNumber: sourceSlide.sourceSlideNumber,
    startTime: clamp(sourceSlide.startTime + sourceSlide.duration + 0.5, 0, 10_000),
    duration: Math.max(6, Math.round(Math.max(6, sourceSlide.duration * 0.75))),
    instructorId: sourceSlide.instructorId,
    layout: continuationPlan.recommendedLayout,
    speakerNotes: continuationPlan.structuredContent.bullets.join('\n'),
    elements: buildElementsFromStructuredSlidePlan(
      {
        ...sourceSlide,
        id: `${sourceSlide.id}--auto-cont-1`,
        layout: continuationPlan.recommendedLayout,
      },
      {
        slideId: `${sourceSlide.id}--auto-cont-1`,
        visualType: 'summary',
        grammarId: continuationPlan.grammarId,
        narrativeRole: 'close',
        layoutHint: 'Continuation slide created from grammar repair.',
        recommendedLayout: continuationPlan.recommendedLayout,
        confidence: 0.72,
        reasons: ['continuation'],
        intentTags: ['continuation', continuationPlan.grammarId],
        contentBudget: continuationPlan.contentBudget,
        structuredContent: continuationPlan.structuredContent,
        repairActions: continuationPlan.repairActions,
        visualNeeds: continuationPlan.visualNeeds,
        copySuggestions: {
          title: continuationPlan.structuredContent.title,
          body: continuationPlan.structuredContent.bullets,
          cta: continuationPlan.structuredContent.ctaLabel,
        },
        graphicSlots: continuationPlan.graphicSlots,
        continuation: null,
      },
      themeId,
      brandTokensOverride,
    ),
  };
  return hydrateSlidePreview(normalizeSlide(draftSlide, 10_000), themeId, deckName, {
    force: true,
    brandTokens: brandTokensOverride,
    brandKit,
  });
};

const buildSpeakerNotesFromStructuredContent = (
  content: SharedPresentationStructuredContent,
): string =>
  [
    content.subtitle,
    ...content.bullets,
    ...content.columns.map((entry) => `${entry.title}: ${entry.body}`.trim()),
    ...content.steps.map((entry) => `${entry.title}: ${entry.body}`.trim()),
    ...content.stats.map((entry) => `${entry.value} ${entry.label} ${entry.context}`.trim()),
    content.quoteText,
    content.quoteAttribution,
    content.ctaLabel,
    content.ctaSupport,
  ]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .join('\n');

const reflowDeckSlidesForTimeline = (
  slides: PresentationSlide[],
  maxDuration: number,
): PresentationSlide[] => {
  const gap = 0.5;
  const normalized: PresentationSlide[] = [];
  slides.forEach((slide, index) => {
    if (index === 0) {
      normalized.push(normalizeSlide(slide, maxDuration));
      return;
    }
    const previous = normalized[index - 1];
    const minimumStart = roundHalfSecond(previous.startTime + previous.duration + gap);
    if (slide.startTime >= minimumStart) {
      normalized.push(normalizeSlide(slide, maxDuration));
      return;
    }
    normalized.push(
      normalizeSlide(
      {
        ...slide,
        startTime: minimumStart,
      },
      maxDuration,
      ),
    );
  });
  return normalized;
};

const hydrateSlidePreview = (
  slide: PresentationSlide,
  themeId: PresentationVisualThemeId,
  deckName: string,
  options?: {
    force?: boolean;
    brandTokens?: SharedPresentationBrandTokens;
    brandKit?: PresentationBrandKit | null;
  },
): PresentationSlide => {
  const force = options?.force === true;
  const previewImageUrl =
    (!force ? String(slide.previewImageUrl || '').trim() : '') ||
    buildSlideSvgPreview(slide, themeId, deckName, {
      brandTokens: options?.brandTokens,
      brandKit: options?.brandKit,
    });
  return {
    ...slide,
    previewImageUrl,
    thumbnailImageUrl: String(slide.thumbnailImageUrl || '').trim() || previewImageUrl,
  };
};

const buildElementsFromSlideXml = (
  xml: string,
  slideId: string,
  layout: PresentationDisplayMode,
  slideWidthEmu: number,
  slideHeightEmu: number,
): PresentationSceneElement[] => {
  const shapeBlocks = Array.from(String(xml || '').matchAll(/<p:sp[\s\S]*?<\/p:sp>/g)).map((entry) => entry[0]);
  const pictureBlocks = Array.from(String(xml || '').matchAll(/<p:pic[\s\S]*?<\/p:pic>/g)).map((entry) => entry[0]);
  const imageCount = (String(xml || '').match(/<p:pic\b/g) || []).length;
  const videoCount =
    (String(xml || '').match(/<a:videoFile\b/g) || []).length +
    (String(xml || '').match(/<p:video\b/g) || []).length;

  const textElements: PresentationSceneElement[] = shapeBlocks
    .map((block, index) => {
      const text = extractTextRuns(block).join(' ').trim();
      if (!text) return null;
      const bounds = parseBoundsFromXmlBlock(
        block,
        {
          x: 10,
          y: 10 + index * 12,
          width: layout === 'split-screen' ? 52 : 74,
          height: 10,
        },
        slideWidthEmu,
        slideHeightEmu,
      );
      return {
        id: `${slideId}-text-${index}`,
        type: 'text' as const,
        text,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const visualElements: PresentationSceneElement[] = [];

  for (let index = 0; index < imageCount; index += 1) {
    const block = pictureBlocks[index] || '';
    const bounds = parseBoundsFromXmlBlock(
      block,
      {
        x: 58,
        y: 16 + index * 16,
        width: 32,
        height: 20,
      },
      slideWidthEmu,
      slideHeightEmu,
    );
    visualElements.push({
      id: `${slideId}-img-${index}`,
      type: 'image',
      text: '',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
  }

  for (let index = 0; index < videoCount; index += 1) {
    visualElements.push({
      id: `${slideId}-video-${index}`,
      type: 'video',
      text: '',
      x: 58,
      y: 18 + index * 16,
      width: 32,
      height: 20,
    });
  }

  const shapeCount = Math.max(0, shapeBlocks.length - textElements.length);
  for (let index = 0; index < shapeCount; index += 1) {
    visualElements.push({
      id: `${slideId}-shape-${index}`,
      type: 'shape',
      text: '',
      x: 12 + ((index % 2) * 26),
      y: 60 + Math.floor(index / 2) * 10,
      width: 22,
      height: 8,
    });
  }

  const elements = [...textElements, ...visualElements].slice(0, 20);
  if (elements.length > 0) return elements;
  return buildDefaultSlideElements('Slide', layout);
};

const parsePptxSlides = async (
  file: File,
  targetDuration: number,
  useNorwegian: boolean,
  visualThemeId: PresentationVisualThemeId,
): Promise<PresentationSlide[] | null> => {
  const lowerName = String(file.name || '').toLowerCase();
  if (!lowerName.endsWith('.pptx')) return null;

  try {
    const module = await import('jszip');
    const JSZip = module.default;
    if (!JSZip) return null;

    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const presentationXml = await zip.file('ppt/presentation.xml')?.async('string');
    const { widthEmu, heightEmu } = extractSlideDimensionsFromPresentationXml(presentationXml);
    const slidePaths = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
      .sort((left, right) => {
        const leftIndex = Number.parseInt(left.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
        const rightIndex = Number.parseInt(right.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
        return leftIndex - rightIndex;
      });

    if (slidePaths.length === 0) return null;

    const defaultLayout: PresentationDisplayMode = 'split-screen';
    const startOffset = 8;
    const availableWindow = Math.max(40, targetDuration - startOffset);
    const spacing = Math.max(6, Math.floor(availableWindow / Math.max(1, slidePaths.length)));

    const slides: PresentationSlide[] = [];

    for (let index = 0; index < slidePaths.length; index += 1) {
      const slidePath = slidePaths[index];
      const slideId = `slide-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
      const slideXml = await zip.file(slidePath)?.async('string');
      if (!slideXml) continue;

      const textRuns = extractTextRuns(slideXml);
      const title =
        String(textRuns[0] || '').trim() ||
        (useNorwegian ? `Slide ${index + 1}` : `Slide ${index + 1}`);
      const bodyText = textRuns.slice(1).join(' ').trim();
      const startTime = clamp(startOffset + index * spacing, 0, Math.max(0, targetDuration - 1));
      const maxSlideDuration = Math.max(1, targetDuration - startTime);
      const duration = clamp(Math.max(6, spacing), 1, maxSlideDuration);

      const notesPath = `ppt/notesSlides/notesSlide${index + 1}.xml`;
      const notesXml = await zip.file(notesPath)?.async('string');
      const notesText = notesXml ? extractTextRuns(notesXml).join('\n').trim() : '';

      const elements = buildElementsFromSlideXml(
        slideXml,
        slideId,
        defaultLayout,
        widthEmu,
        heightEmu,
      ).map((element) => {
        if (element.type === 'text' && !element.text && bodyText) {
          return { ...element, text: bodyText };
        }
        return element;
      });

      const preliminarySlide: PresentationSlide = {
        id: slideId,
        sourceSlideNumber: index + 1,
        title,
        startTime,
        duration,
        layout: defaultLayout,
        speakerNotes: notesText,
        elements,
      };
      const previewImageUrl = buildSlideSvgPreview(preliminarySlide, visualThemeId, file.name);

      slides.push({
        ...preliminarySlide,
        elements,
        previewImageUrl,
        thumbnailImageUrl: previewImageUrl,
      });
    }

    return slides.length > 0 ? slides : null;
  } catch {
    return null;
  }
};

const buildTemplateSlides = (
  templateId: PresentationTemplateId,
  targetDuration: number,
  useNorwegian: boolean,
  visualThemeId: PresentationVisualThemeId,
  deckName?: string,
): PresentationSlide[] => {
  const preset = templatePresets.find((item) => item.id === templateId) || templatePresets[0];
  const labels = useNorwegian ? preset.slidesNo : preset.slidesEn;
  const spacing = 14;
  const initial = 10;
  return labels.map((label, index) => {
    const startTime = clamp(initial + index * spacing, 0, Math.max(0, targetDuration - 6));
    const maxDuration = Math.max(4, targetDuration - startTime);
    const layout = preset.defaultMode;
    const slideId = `slide-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
    const draftSlide: PresentationSlide = {
      id: slideId,
      sourceSlideNumber: index + 1,
      title: label,
      startTime,
      duration: clamp(10, 4, maxDuration),
      layout,
      speakerNotes: '',
      elements: buildDefaultSlideElements(label, layout),
    };
    const previewImageUrl = buildSlideSvgPreview(
      draftSlide,
      visualThemeId,
      deckName || (useNorwegian ? 'Presentasjon' : 'Presentation'),
    );
    return {
      ...draftSlide,
      previewImageUrl,
      thumbnailImageUrl: previewImageUrl,
    };
  });
};

type PresentationContextSlideSeed = {
  title: string;
  subtitle?: string;
  bodyLines: string[];
  visualType: PresentationDesignVisualType;
  preferredGrammarId?: SharedPresentationSlideGrammarId;
  ctaLabel?: string;
  ctaSupport?: string;
  mediaIntent?: string;
};

const uniquePresentationLines = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  return values
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const resolveContextualSkillSuggestion = (
  course: Course | null | undefined,
  skill: Lesson | null | undefined,
) => {
  if (!course?.pedagogicalArchitecture?.studioSuggestions || !skill?.title) return null;
  const skillTitle = String(skill.title || '').trim().toLowerCase();
  if (!skillTitle) return null;
  return (
    course.pedagogicalArchitecture.studioSuggestions.skills.find((entry) => {
      const title = String(entry.title || '').trim().toLowerCase();
      return title === skillTitle || title.includes(skillTitle) || skillTitle.includes(title);
    }) || null
  );
};

const buildContextualPresentationSeeds = (
  course: Course | null | undefined,
  skill: Lesson | null | undefined,
  useNorwegian: boolean,
): PresentationContextSlideSeed[] => {
  const architecture = course?.pedagogicalArchitecture;
  const matchedSkillSuggestion = resolveContextualSkillSuggestion(course, skill);
  const deckTitle = String(skill?.title || course?.title || '').trim() || (useNorwegian ? 'Presentasjon' : 'Presentation');
  const competencyTitle = String(course?.title || '').trim();
  const primaryDescription =
    String(skill?.description || '').trim() ||
    String(architecture?.purpose || '').trim() ||
    String(course?.description || '').trim();
  const audienceText = String(architecture?.audience || '').trim();
  const transformationText =
    String(architecture?.transformation || '').trim() ||
    uniquePresentationLines(architecture?.transformations || [])[0] ||
    '';
  const skillMapItems = Array.isArray(architecture?.skillMap) ? architecture.skillMap : [];
  const skillMapLines = uniquePresentationLines(
    skillMapItems.flatMap((entry) => [String(entry?.title || ''), String(entry?.focus || '')]),
  );
  const practiceLines = uniquePresentationLines([
    architecture?.practiceDesign,
    architecture?.proofOfLearning,
    ...(Array.isArray(architecture?.problemsSolved) ? architecture.problemsSolved : []),
  ]);
  const learningOutcomeLines = uniquePresentationLines([
    ...(Array.isArray(course?.learningOutcomes) ? course.learningOutcomes : []),
    ...(Array.isArray(architecture?.skills) ? architecture.skills : []),
    ...(Array.isArray(architecture?.competencies) ? architecture.competencies : []),
    matchedSkillSuggestion?.objective,
  ]);
  const focusLines = (skill ? learningOutcomeLines : uniquePresentationLines([
    ...(Array.isArray(architecture?.competencies) ? architecture.competencies : []),
    ...(Array.isArray(architecture?.skills) ? architecture.skills : []),
    ...(Array.isArray(course?.learningOutcomes) ? course.learningOutcomes : []),
  ])).slice(0, 4);
  const processLines = uniquePresentationLines([
    ...(skillMapLines.length > 0 ? skillMapLines : []),
    ...(focusLines.length > 0 ? focusLines : []),
  ]).slice(0, 5);
  const nextStepLabel = useNorwegian ? 'Bruk dette i neste opptak' : 'Use this in the next recording';
  const nextStepSupport =
    String(matchedSkillSuggestion?.objective || '').trim() ||
    transformationText ||
    primaryDescription;

  const seeds: PresentationContextSlideSeed[] = [
    {
      title: deckTitle,
      subtitle:
        primaryDescription ||
        (competencyTitle
          ? useNorwegian
            ? `Bygd for ${competencyTitle}`
            : `Built for ${competencyTitle}`
          : ''),
      bodyLines: uniquePresentationLines([
        audienceText,
        transformationText,
        competencyTitle && skill
          ? useNorwegian
            ? `Kompetanse: ${competencyTitle}`
            : `Competency: ${competencyTitle}`
          : '',
      ]).slice(0, 3),
      visualType: 'title',
      preferredGrammarId: 'hero',
      mediaIntent: deckTitle,
    },
    {
      title: useNorwegian ? 'Dette skal mestres' : 'What learners should master',
      subtitle:
        transformationText ||
        (useNorwegian ? 'Fokus pa konkret mestring og trygg gjennomforing.' : 'Focus on concrete mastery and confident execution.'),
      bodyLines: focusLines,
      visualType: 'summary',
      preferredGrammarId: 'checklist',
      mediaIntent: deckTitle,
    },
    {
      title: useNorwegian ? 'Slik jobber du gjennom ferdigheten' : 'How the skill is performed',
      subtitle:
        String(matchedSkillSuggestion?.objective || '').trim() ||
        (useNorwegian ? 'Del opp flyten i tydelige steg.' : 'Break the flow into clear steps.'),
      bodyLines: processLines,
      visualType: 'process',
      preferredGrammarId: 'process',
      mediaIntent: deckTitle,
    },
    {
      title: useNorwegian ? 'Ovelse og kvalitet' : 'Practice and quality',
      subtitle:
        audienceText ||
        (useNorwegian ? 'Knytt opplaringen til ekte arbeidssituasjoner.' : 'Tie the training to real work situations.'),
      bodyLines: practiceLines.slice(0, 4),
      visualType: 'feature',
      preferredGrammarId: 'content-grid',
      mediaIntent: deckTitle,
    },
    {
      title: useNorwegian ? 'Neste steg' : 'Next step',
      subtitle:
        primaryDescription ||
        (useNorwegian ? 'Presentasjonen er klar til videre finpuss ved behov.' : 'The presentation is ready for light refinement if needed.'),
      bodyLines: uniquePresentationLines([
        nextStepSupport,
        ...(focusLines.slice(0, 2)),
      ]).slice(0, 3),
      visualType: 'cta',
      preferredGrammarId: 'cta',
      ctaLabel: nextStepLabel,
      ctaSupport: nextStepSupport,
      mediaIntent: deckTitle,
    },
  ];

  return seeds.filter((seed) => seed.bodyLines.length > 0 || seed.visualType === 'title' || seed.visualType === 'cta');
};

const buildContextualPresentationSlides = (
  course: Course | null | undefined,
  skill: Lesson | null | undefined,
  targetDuration: number,
  useNorwegian: boolean,
  visualThemeId: PresentationVisualThemeId,
  deckName: string,
): PresentationSlide[] => {
  const seeds = buildContextualPresentationSeeds(course, skill, useNorwegian);
  const totalSlides = Math.max(1, seeds.length);
  const availableWindow = Math.max(48, targetDuration - 10);
  const baseDuration = Math.max(8, Math.floor(availableWindow / totalSlides));
  const startOffset = 6;

  return seeds.map((seed, index) => {
    const slideId = `slide-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
    const startTime = clamp(startOffset + index * baseDuration, 0, Math.max(0, targetDuration - 6));
    const grammarPlan = academyPresentationBuildGrammarPlan({
      slideId,
      title: seed.title,
      bodyLines: seed.bodyLines,
      visualType: seed.visualType,
      index,
      totalSlides,
      useNorwegian,
      preferredGrammarId: seed.preferredGrammarId,
      preferredSubtitle: seed.subtitle,
      preferredBullets: seed.bodyLines,
      preferredCtaLabel: seed.ctaLabel,
      preferredCtaSupport: seed.ctaSupport,
      preferredMediaIntent: seed.mediaIntent,
    });
    const slidePlan: PresentationDesignSlidePlan = {
      slideId,
      visualType: seed.visualType,
      grammarId: grammarPlan.grammarId,
      narrativeRole: grammarPlan.narrativeRole,
      layoutHint: 'Context-aware starter deck generated from competency and skill context.',
      recommendedLayout: grammarPlan.recommendedLayout,
      confidence: 0.78,
      reasons: ['contextual-starter', skill ? 'skill-scope' : 'course-scope'],
      intentTags: ['auto-context', grammarPlan.grammarId],
      contentBudget: grammarPlan.contentBudget,
      structuredContent: grammarPlan.structuredContent,
      repairActions: grammarPlan.repairActions,
      visualNeeds: grammarPlan.visualNeeds,
      copySuggestions: {
        title: grammarPlan.structuredContent.title,
        body: grammarPlan.structuredContent.bullets,
        cta: grammarPlan.structuredContent.ctaLabel,
      },
      graphicSlots: grammarPlan.graphicSlots,
      continuation: grammarPlan.continuation,
    };
    const draftSlide: PresentationSlide = {
      id: slideId,
      sourceSlideNumber: index + 1,
      title: grammarPlan.structuredContent.title,
      startTime,
      duration: clamp(baseDuration, 6, Math.max(6, targetDuration - startTime)),
      layout: grammarPlan.recommendedLayout,
      speakerNotes: buildSpeakerNotesFromStructuredContent(grammarPlan.structuredContent),
      elements: buildElementsFromStructuredSlidePlan(
        {
          id: slideId,
          title: grammarPlan.structuredContent.title,
          sourceSlideNumber: index + 1,
          startTime,
          duration: clamp(baseDuration, 6, Math.max(6, targetDuration - startTime)),
          layout: grammarPlan.recommendedLayout,
          speakerNotes: '',
          elements: [],
        },
        slidePlan,
        visualThemeId,
      ),
    };
    return hydrateSlidePreview(normalizeSlide(draftSlide, targetDuration), visualThemeId, deckName);
  });
};

const createContextualDeckFromContext = (
  templateId: PresentationTemplateId,
  course: Course | null | undefined,
  skill: Lesson | null | undefined,
  targetDuration: number,
  useNorwegian: boolean,
  visualThemeId: PresentationVisualThemeId = 'sales-command',
  splitLayoutVariant: PresentationSplitLayoutVariant = 'balanced',
): PresentationDeck => {
  const preset = templatePresets.find((item) => item.id === templateId) || templatePresets[0];
  const now = new Date().toISOString();
  const resolvedName =
    String(skill?.title || course?.title || '').trim() || (useNorwegian ? 'Ny presentasjon' : 'New Presentation');
  const resolvedSplitVariant =
    preset.defaultMode === 'split-screen' ? splitLayoutVariant : 'balanced';
  return {
    id: `presentation-deck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: resolvedName,
    template: preset.id,
    visualThemeId,
    brandKitId: undefined,
    displayMode: preset.defaultMode,
    splitLayoutVariant: resolvedSplitVariant,
    showNavigator: false,
    placement: toPlacement(preset.defaultPlacement),
    opacity: 0.96,
    sourceName: useNorwegian ? 'Auto-generert fra kompetanse og ferdighet' : 'Auto-generated from competency and skill',
    sourceType: 'auto-context',
    sourceUrl: '',
    slides: buildContextualPresentationSlides(
      course,
      skill,
      targetDuration,
      useNorwegian,
      visualThemeId,
      resolvedName,
    ),
    updatedAt: now,
  };
};

const createDeckFromTemplate = (
  templateId: PresentationTemplateId,
  targetDuration: number,
  useNorwegian: boolean,
  sourceName?: string,
  sourceType?: string,
  visualThemeId: PresentationVisualThemeId = 'sales-command',
  splitLayoutVariant: PresentationSplitLayoutVariant = 'balanced',
): PresentationDeck => {
  const preset = templatePresets.find((item) => item.id === templateId) || templatePresets[0];
  const now = new Date().toISOString();
  const resolvedName = sourceName || (useNorwegian ? 'Ny presentasjon' : 'New Presentation');
  const resolvedSplitVariant =
    preset.defaultMode === 'split-screen' ? splitLayoutVariant : 'balanced';
  return {
    id: `presentation-deck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: resolvedName,
    template: preset.id,
    visualThemeId,
    brandKitId: undefined,
    displayMode: preset.defaultMode,
    splitLayoutVariant: resolvedSplitVariant,
    showNavigator: false,
    placement: toPlacement(preset.defaultPlacement),
    opacity: 0.96,
    sourceName: sourceName || '',
    sourceType: sourceType || '',
    sourceUrl: '',
    slides: buildTemplateSlides(preset.id, targetDuration, useNorwegian, visualThemeId, resolvedName),
    updatedAt: now,
  };
};

const normalizeSceneElement = (
  element: PresentationSceneElement,
  fallbackId: string,
): PresentationSceneElement => {
  const type: PresentationElementType =
    element.type === 'image' || element.type === 'video' || element.type === 'shape'
      ? element.type
      : 'text';
  return {
    id: String(element.id || fallbackId),
    type,
    text: String(element.text || '').trim(),
    x: clamp(Number(element.x) || 0, 0, 100),
    y: clamp(Number(element.y) || 0, 0, 100),
    width: clamp(Number(element.width) || 20, 1, 100),
    height: clamp(Number(element.height) || 8, 1, 100),
    role: String(element.role || '').trim() as PresentationSceneElement['role'],
    align:
      String(element.align || '').trim().toLowerCase() === 'center'
        ? 'center'
        : 'left',
    tone:
      String(element.tone || '').trim().toLowerCase() === 'accent'
        ? 'accent'
        : String(element.tone || '').trim().toLowerCase() === 'inverse'
          ? 'inverse'
          : String(element.tone || '').trim().toLowerCase() === 'muted'
            ? 'muted'
            : 'default',
    prompt: String(element.prompt || '').trim(),
    graphicKind: String(element.graphicKind || '').trim() as PresentationDesignGraphicSlot['kind'],
    assetDataUrl: String(element.assetDataUrl || '').trim(),
  };
};

const normalizeSlide = (slide: PresentationSlide, maxDuration: number): PresentationSlide => {
  const safeMax = Number.isFinite(maxDuration) && maxDuration > 0 ? maxDuration : 300;
  const safeStart = clamp(Number(slide.startTime) || 0, 0, Math.max(0, safeMax - 1));
  const maxSlideDuration = Math.max(1, safeMax - safeStart);
  const safeDuration = clamp(Number(slide.duration) || 8, 1, maxSlideDuration);
  const instructorId = String(slide.instructorId || '').trim();
  const layout = toDisplayMode(String(slide.layout || 'picture-in-picture'));
  const title = String(slide.title || 'Slide').trim() || 'Slide';
  const speakerNotes = String(slide.speakerNotes || '').trim();
  const rawElements = Array.isArray(slide.elements) ? slide.elements : [];
  const normalizedElements = rawElements
    .map((element, index) =>
      normalizeSceneElement(
        element,
        `${String(slide.id || 'slide')}-el-${index}`,
      ),
    )
    .slice(0, 20);

  return {
    id: String(slide.id || `slide-${Date.now()}`),
    title,
    sourceSlideNumber: Math.max(1, Number(slide.sourceSlideNumber) || 1),
    startTime: safeStart,
    duration: safeDuration,
    instructorId: instructorId || undefined,
    layout,
    speakerNotes,
    previewImageUrl: String(slide.previewImageUrl || '').trim(),
    thumbnailImageUrl: String(slide.thumbnailImageUrl || '').trim(),
    elements:
      normalizedElements.length > 0
        ? normalizedElements
        : buildDefaultSlideElements(title, layout),
  };
};

const normalizeDeck = (deck: PresentationDeck, maxDuration: number): PresentationDeck => {
  const normalizedName = String(deck.name || 'Presentation').trim() || 'Presentation';
  const normalizedThemeId = toVisualThemeId(
    String((deck as Partial<PresentationDeck>).visualThemeId || 'sales-command'),
  );
  const normalizedSlides = Array.isArray(deck.slides)
    ? deck.slides
        .map((slide) => normalizeSlide(slide, maxDuration))
        .map((slide) => hydrateSlidePreview(slide, normalizedThemeId, normalizedName))
    : [];

  const orderedSlides = [...normalizedSlides].sort(
    (left, right) => Number(left.startTime) - Number(right.startTime),
  );

  return {
    id: String(deck.id || `presentation-deck-${Date.now()}`),
    name: normalizedName,
    template: toTemplateId(String(deck.template || 'product-overview')),
    visualThemeId: normalizedThemeId,
    brandKitId: String((deck as Partial<PresentationDeck>).brandKitId || '').trim() || undefined,
    displayMode: toDisplayMode(String(deck.displayMode || 'picture-in-picture')),
    splitLayoutVariant:
      toDisplayMode(String(deck.displayMode || 'picture-in-picture')) === 'split-screen'
        ? toSplitLayoutVariant(
            String((deck as Partial<PresentationDeck>).splitLayoutVariant || 'balanced'),
          )
        : 'balanced',
    showNavigator: false,
    placement: toPlacement(String(deck.placement || 'bottom-right')),
    opacity: clamp(Number(deck.opacity) || 0.96, 0.2, 1),
    sourceName: String(deck.sourceName || '').trim(),
    sourceType: String(deck.sourceType || '').trim(),
    sourceUrl: String(deck.sourceUrl || '').trim(),
    slides: orderedSlides,
    updatedAt: String(deck.updatedAt || new Date().toISOString()),
  };
};

const isLikelyPresentationResource = (resource: CourseResource | LessonResource): boolean => {
  const title = String(resource.title || '').trim();
  return title.startsWith('[Presentation]') || String(resource.id || '').startsWith(PRESENTATION_RESOURCE_ID_PREFIX);
};

const parsePresentationMediaResourceMetadata = (description: string | undefined) => {
  const raw = String(description || '');
  return {
    folderTag: raw.match(PRESENTATION_MEDIA_FOLDER_TAG_REGEX)?.[1] || '',
    sourceTag: raw.match(PRESENTATION_MEDIA_SOURCE_TAG_REGEX)?.[1] || '',
  };
};

const parseTimecode = (value: string): number | null => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d+):(\d{1,2})$/);
  if (!match) return null;
  const minutes = Number.parseInt(match[1], 10);
  const seconds = Number.parseInt(match[2], 10);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return Math.max(0, minutes * 60 + seconds);
};

const parsePresentationResource = (
  resource: CourseResource | LessonResource,
  maxDuration: number,
): ParsedPresentationResource | null => {
  const rawTitle = String(resource.title || '').trim();
  const rawDescription = String(resource.description || '').trim();

  const titleMatch = rawTitle.match(
    /^\[Presentation\]\[(?:Course|Skill)\]\s*(.+?)(?:\s*::\s*(.+))?$/i,
  );
  const descMatch = rawDescription.match(
    /^(.+?)\s*·\s*(\d+:\d{1,2})-(\d+:\d{1,2})\s*·\s*order:(\d+)\s*·\s*template:([a-z0-9-]+)(?:\s*·\s*theme:([a-z0-9-]+))?\s*·\s*mode:([a-z-]+)(?:\s*·\s*variant:([a-z-]+))?\s*·\s*placement:([a-z-]+)(?:\s*·\s*layout:([a-z-]+))?(?:\s*·\s*deck:([a-z0-9_-]+))?(?:\s*·\s*slide:([a-z0-9_-]+))?(?:\s*·\s*slideNo:(\d+))?(?:\s*·\s*nav:([a-z0-9-]+))?(?:\s*·\s*source:(.+))?$/i,
  );

  if (!titleMatch || !descMatch) return null;

  const startRaw = parseTimecode(descMatch[2]);
  const endRaw = parseTimecode(descMatch[3]);
  const orderRaw = Number.parseInt(descMatch[4], 10);
  if (startRaw === null || endRaw === null || !Number.isFinite(orderRaw)) return null;

  const safeMax = Math.max(1, maxDuration);
  const safeStart = clamp(startRaw, 0, Math.max(0, safeMax - 1));
  const safeEnd = clamp(Math.max(safeStart + 1, endRaw), safeStart + 1, safeMax);

  const fallbackDeckName = String(titleMatch[1] || '').trim();
  const fallbackSlideTitle = String(titleMatch[2] || '').trim();

  return {
    id: String(resource.id || `presentation-resource-${Date.now()}`),
    deckId: String(descMatch[11] || '').trim() || `deck-${fallbackDeckName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    slideId: String(descMatch[12] || '').trim() || `slide-${orderRaw}`,
    deckName: fallbackDeckName || String(descMatch[1] || '').trim() || 'Presentation',
    slideTitle: fallbackSlideTitle || `Slide ${Math.max(1, orderRaw)}`,
    startTime: safeStart,
    endTime: safeEnd,
    order: Math.max(1, orderRaw),
    template: toTemplateId(descMatch[5]),
    visualThemeId: toVisualThemeId(descMatch[6] || ''),
    displayMode: toDisplayMode(descMatch[7]),
    splitLayoutVariant: toSplitLayoutVariant(descMatch[8] || 'balanced'),
    showNavigator: false,
    slideLayout: toDisplayMode(descMatch[10] || descMatch[7]),
    placement: toPlacement(descMatch[9]),
    sourceSlideNumber: Math.max(1, Number.parseInt(String(descMatch[13] || ''), 10) || Math.max(1, orderRaw)),
    slidePreviewUrl: String(resource.url || '').trim(),
    sourceName: String(descMatch[15] || '').trim(),
    sourceUrl: String(resource.url || '').trim(),
  };
};

const overlayStyleForMode = (
  displayMode: PresentationDisplayMode,
  placement: PresentationPlacement,
  opacity: number,
): Record<string, unknown> => {
  const resolvedOpacity = clamp(opacity, 0.2, 1);
  const base = {
    position: 'absolute',
    zIndex: 3,
    borderRadius: 1.2,
    border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.52)',
    background: alpha('#0b1019', resolvedOpacity),
    boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
    overflow: 'hidden',
  } as const;

  if (displayMode === 'full-frame') {
    return {
      ...base,
      inset: 24,
      borderRadius: 1.4,
    };
  }

  if (displayMode === 'split-screen') {
    return {
      ...base,
      top: 12,
      right: 12,
      bottom: 12,
      width: { xs: 'calc(100% - 24px)', md: 'min(58%, 860px)' },
      borderRadius: 1.2,
      background: alpha('#060e19', clamp(resolvedOpacity + 0.02, 0.24, 1)),
    };
  }

  if (displayMode === 'side-panel') {
    return {
      ...base,
      top: 20,
      right: 20,
      bottom: 116,
      width: 'min(34%, 420px)',
    };
  }

  if (placement === 'top-left') {
    return { ...base, top: 20, left: 20, width: 'min(34%, 410px)' };
  }
  if (placement === 'top-right') {
    return { ...base, top: 20, right: 20, width: 'min(34%, 410px)' };
  }
  if (placement === 'bottom-left') {
    return { ...base, left: 20, bottom: 116, width: 'min(34%, 410px)' };
  }
  if (placement === 'center') {
    return {
      ...base,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 'min(60%, 640px)',
    };
  }
  return { ...base, right: 20, bottom: 116, width: 'min(34%, 410px)' };
};

function AcademyPresentationOverlayStudio({
  courseId,
  onSave,
  onCancel,
}: AcademyPresentationOverlayStudioProps) {
  const [location, setLocation] = useLocation();
  const { state, getCourse, updateCourse, updateLesson, setCurrentCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  const { navLabel, tt, isNorwegian } = useAcademyLocale();

  const routeCourseId = useMemo(() => getRouteParam('courseId'), [location]);
  const routeLessonId = useMemo(
    () => getRouteParam('lessonId') || getRouteParam('skillId'),
    [location],
  );
  const { autoSaveState, lastSavedAt, markDirty, markSaving, markSaved } = useToolAutoSaveState();
  const {
    simpleMode,
    toggleSimpleMode,
    shouldShowAdvanced,
  } = useAcademyToolUx('presentation');

  const [leftNav, setLeftNav] = useState('tool-presentation');
  const [search, setSearch] = useState('');
  const [semanticSearchBusy, setSemanticSearchBusy] = useState(false);
  const [semanticSearchRanking, setSemanticSearchRanking] = useState<PresentationSemanticSearchRankItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || routeCourseId || '');
  const [scope, setScope] = useState<PresentationScope>(routeLessonId ? 'skill' : 'course');
  const [selectedSkillId, setSelectedSkillId] = useState(routeLessonId || '');
  const [decks, setDecks] = useState<PresentationDeck[]>([]);
  const [brandKits, setBrandKits] = useState<PresentationBrandKit[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [duration, setDuration] = useState(300);
  const [durationInput, setDurationInput] = useState('5:00');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineSnapEnabled, setTimelineSnapEnabled] = useState(true);
  const [snapToPlayheadEnabled, setSnapToPlayheadEnabled] = useState(true);
  const [navigatorSelectedSlideId, setNavigatorSelectedSlideId] = useState('');
  const [collapsedNavigatorByDeck, setCollapsedNavigatorByDeck] = useState<Record<string, boolean>>({});
  const [showInstructorScriptOverlay, setShowInstructorScriptOverlay] = useState(true);
  const [teleprompterAutoScroll, setTeleprompterAutoScroll] = useState(false);
  const [teleprompterSpeechFollow, setTeleprompterSpeechFollow] = useState(false);
  const [teleprompterSpeechStatus, setTeleprompterSpeechStatus] =
    useState<TeleprompterSpeechSyncStatus>('idle');
  const [teleprompterSpeechError, setTeleprompterSpeechError] = useState('');
  const [teleprompterSpeechWords, setTeleprompterSpeechWords] = useState<TeleprompterSpeechWord[]>([]);
  const [teleprompterSpeechLanguage, setTeleprompterSpeechLanguage] = useState('auto');
  const [teleprompterSpeechProvider, setTeleprompterSpeechProvider] = useState('');
  const [teleprompterSpeechWarnings, setTeleprompterSpeechWarnings] = useState<string[]>([]);
  const [teleprompterSpeechSpeakers, setTeleprompterSpeechSpeakers] = useState<string[]>([]);
  const [teleprompterSpeakerFilter, setTeleprompterSpeakerFilter] = useState(TELEPROMPTER_SPEAKER_ALL);
  const [captionsVtt, setCaptionsVtt] = useState('');
  const [captionsTrackUrl, setCaptionsTrackUrl] = useState('');
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(26);
  const [teleprompterFontSize, setTeleprompterFontSize] = useState(16);
  const [teleprompterLineFocus, setTeleprompterLineFocus] = useState(true);
  const [teleprompterMirrored, setTeleprompterMirrored] = useState(false);
  const [teleprompterOffset, setTeleprompterOffset] = useState(0);
  const [teleprompterViewportHeight, setTeleprompterViewportHeight] = useState(0);
  const [instructorInlineOpen, setInstructorInlineOpen] = useState(false);
  const [designPlan, setDesignPlan] = useState<PresentationDesignPlan | null>(null);
  const [designPlanBusy, setDesignPlanBusy] = useState(false);
  const [designPlanError, setDesignPlanError] = useState('');
  const [aiCritique, setAiCritique] = useState<PresentationAiCritiqueResult | null>(null);
  const [aiCritiqueBusy, setAiCritiqueBusy] = useState(false);
  const [aiCritiqueError, setAiCritiqueError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [lastPublishedAt, setLastPublishedAt] = useState('');
  const [hasSavedChangesSincePublish, setHasSavedChangesSincePublish] = useState(false);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hydratedScopeKeyRef = useRef<string>('');
  const brandKitHydratedScopeRef = useRef<string>('');
  const autoSaveHydratedRef = useRef(false);
  const lastAutoSavedSignatureRef = useRef('');
  const autoContextGenerationRef = useRef<Set<string>>(new Set());
  const userMutationTickRef = useRef(0);
  const teleprompterLastTickRef = useRef<number | null>(null);
  const teleprompterViewportRef = useRef<HTMLDivElement | null>(null);
  const teleprompterSpeechSyncRunRef = useRef(0);
  const teleprompterSpeechCacheRef = useRef<Map<string, TeleprompterSpeechCacheEntry>>(new Map());
  const semanticSearchRequestRef = useRef(0);
  const visualSearchCacheRef = useRef<Map<string, { url: string; source: string }>>(new Map());
  const videoPosterCacheRef = useRef<Map<string, string>>(new Map());

  const markUserMutation = useCallback(() => {
    userMutationTickRef.current += 1;
    markDirty();
  }, [markDirty]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(PRESENTATION_EDITOR_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.timelineSnapEnabled === 'boolean') {
        setTimelineSnapEnabled(parsed.timelineSnapEnabled);
      }
      if (typeof parsed.snapToPlayheadEnabled === 'boolean') {
        setSnapToPlayheadEnabled(parsed.snapToPlayheadEnabled);
      }
    } catch {
      // ignore local pref read errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        PRESENTATION_EDITOR_PREFS_KEY,
        JSON.stringify({
          timelineSnapEnabled,
          snapToPlayheadEnabled,
        }),
      );
    } catch {
      // ignore local pref write errors
    }
  }, [snapToPlayheadEnabled, timelineSnapEnabled]);

  useEffect(() => {
    if (!captionsVtt) {
      setCaptionsTrackUrl('');
      return;
    }
    const blob = new Blob([captionsVtt], { type: 'text/vtt' });
    const objectUrl = URL.createObjectURL(blob);
    setCaptionsTrackUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [captionsVtt]);

  const courseItems = useMemo<Course[]>(() => {
    if (state.courses.length > 0) {
      return state.courses;
    }
    return [];
  }, [state.courses]);

  const courseOptionIds = useMemo(
    () => courseItems.map((course) => String(course.id)),
    [courseItems],
  );

  const activeCourse = useMemo(() => {
    const fromProp = courseId ? getCourse(courseId) : null;
    if (fromProp) return fromProp;
    const fromSelected = selectedCourseId
      ? courseItems.find((course) => String(course.id) === String(selectedCourseId))
      : null;
    if (fromSelected) return fromSelected;
    const fromRoute = routeCourseId ? getCourse(routeCourseId) : null;
    if (fromRoute) return fromRoute;
    return state.currentCourse || courseItems[0] || null;
  }, [courseId, courseItems, getCourse, routeCourseId, selectedCourseId, state.currentCourse]);

  const presentationDefaultsForCourse = useMemo(
    () => resolvePresentationDefaultsForCourse(activeCourse),
    [activeCourse?.curriculumProjectTemplateId, activeCourse?.id, activeCourse?.pedagogicalArchitecture?.purpose],
  );

  useEffect(() => {
    if (!activeCourse?.id) return;
    const inState = state.courses.some((course) => String(course.id) === String(activeCourse.id));
    if (!inState) return;
    if (String(state.currentCourse?.id || '') === String(activeCourse.id)) return;
    setCurrentCourse(activeCourse);
  }, [activeCourse, setCurrentCourse, state.courses, state.currentCourse?.id]);

  const selectedCourseValue = useMemo(() => {
    const preferredId = String(selectedCourseId || activeCourse?.id || '');
    if (preferredId && courseOptionIds.includes(preferredId)) {
      return preferredId;
    }
    return courseOptionIds[0] || '';
  }, [activeCourse?.id, courseOptionIds, selectedCourseId]);

  const syncCourseIdInRoute = useCallback(
    (nextCourseId: string) => {
      const normalizedCourseId = String(nextCourseId || '').trim();
      const [pathname, rawQuery = ''] = location.split('?');
      const params = new URLSearchParams(rawQuery);

      if (normalizedCourseId) {
        params.set('courseId', normalizedCourseId);
      } else {
        params.delete('courseId');
      }
      params.delete('course_id');

      const suffix = params.toString();
      setLocation(suffix ? `${pathname}?${suffix}` : pathname);
    },
    [location, setLocation],
  );

  useEffect(() => {
    if (selectedCourseValue && selectedCourseValue !== selectedCourseId) {
      setSelectedCourseId(selectedCourseValue);
    }
  }, [selectedCourseId, selectedCourseValue]);

  useEffect(() => {
    const nextRouteCourseId = String(routeCourseId || '').trim();
    if (!nextRouteCourseId) return;
    setSelectedCourseId((previousCourseId) =>
      previousCourseId === nextRouteCourseId ? previousCourseId : nextRouteCourseId,
    );
  }, [routeCourseId]);

  useEffect(() => {
    const nextRouteLessonId = String(routeLessonId || '').trim();
    if (!nextRouteLessonId) return;
    if (scope !== 'skill') {
      setScope('skill');
    }
    if (nextRouteLessonId !== selectedSkillId) {
      setSelectedSkillId(nextRouteLessonId);
    }
  }, [routeLessonId, scope, selectedSkillId]);

  const skillOptions = useMemo<Lesson[]>(() => {
    return Array.isArray(activeCourse?.lessons) ? activeCourse.lessons : [];
  }, [activeCourse?.lessons]);

  const selectedSkill = useMemo(() => {
    if (!selectedSkillId) return null;
    return skillOptions.find((lesson) => String(lesson.id) === String(selectedSkillId)) || null;
  }, [selectedSkillId, skillOptions]);

  const instructorItems = useMemo(
    () =>
      (Array.isArray(state.instructors) ? state.instructors : []).filter(
        (instructor) => instructor.isActive !== false,
      ),
    [state.instructors],
  );

  const instructorsById = useMemo(
    () =>
      new Map(
        instructorItems.map((instructor) => [
          String(instructor.id || ''),
          instructor,
        ]),
      ),
    [instructorItems],
  );

  const defaultInstructorId = useMemo(() => {
    const fromSkill = String(selectedSkill?.videoInstructorId || '').trim();
    if (fromSkill) return fromSkill;
    const fromLead = String(activeCourse?.competencyLeadInstructorId || '').trim();
    if (fromLead) return fromLead;
    const fromCourse = String(activeCourse?.instructor?.id || '').trim();
    return fromCourse || '';
  }, [
    activeCourse?.competencyLeadInstructorId,
    activeCourse?.instructor?.id,
    selectedSkill?.videoInstructorId,
  ]);

  useEffect(() => {
    if (scope !== 'skill') return;
    if (skillOptions.length === 0) {
      setScope('course');
      setSelectedSkillId('');
      return;
    }
    if (selectedSkill) return;
    const fromRoute = routeLessonId
      ? skillOptions.find((lesson) => String(lesson.id) === String(routeLessonId))
      : null;
    setSelectedSkillId(String((fromRoute || skillOptions[0]).id));
  }, [routeLessonId, scope, selectedSkill, skillOptions]);

  const effectiveScope: PresentationScope = scope === 'skill' && selectedSkill ? 'skill' : 'course';

  const sourceVideoUrl = useMemo(
    () =>
      resolveAcademyVideoUrl({
        course: activeCourse,
        preferredLessonId: effectiveScope === 'skill' ? String(selectedSkill?.id || '') : null,
        fallbackUrl: '',
      }),
    [activeCourse, effectiveScope, selectedSkill?.id],
  );

  const hasPresenterVideoSource = sourceVideoUrl.length > 0;

  const effectiveVideoUrl = useMemo(
    () => sourceVideoUrl || PRESENTATION_VIDEO_PLACEHOLDER,
    [sourceVideoUrl],
  );

  useEffect(() => {
    const sourceKey = String(effectiveVideoUrl || '').trim();
    const cached = sourceKey ? teleprompterSpeechCacheRef.current.get(sourceKey) : null;
    if (cached) {
      setTeleprompterSpeechWords(cached.words);
      setTeleprompterSpeechLanguage(cached.language);
      setTeleprompterSpeechProvider(cached.provider);
      setTeleprompterSpeechWarnings(cached.warnings);
      setTeleprompterSpeechSpeakers(cached.speakers);
      setCaptionsVtt(cached.captionsVtt || '');
      setTeleprompterSpeechStatus('ready');
      setTeleprompterSpeechError('');
      return;
    }

    setTeleprompterSpeechWords([]);
    setTeleprompterSpeechLanguage('auto');
    setTeleprompterSpeechProvider('');
    setTeleprompterSpeechWarnings([]);
    setTeleprompterSpeechSpeakers([]);
    setCaptionsVtt('');
    setTeleprompterSpeechStatus('idle');
    setTeleprompterSpeechError('');
    setTeleprompterSpeakerFilter(TELEPROMPTER_SPEAKER_ALL);
    setTeleprompterSpeechFollow(false);
  }, [effectiveVideoUrl]);

  useEffect(() => {
    if (teleprompterSpeakerFilter === TELEPROMPTER_SPEAKER_ALL) return;
    if (teleprompterSpeechSpeakers.includes(teleprompterSpeakerFilter)) return;
    setTeleprompterSpeakerFilter(TELEPROMPTER_SPEAKER_ALL);
  }, [teleprompterSpeakerFilter, teleprompterSpeechSpeakers]);

  const targetDuration = useMemo(() => {
    const baseDuration =
      effectiveScope === 'skill'
        ? Number(selectedSkill?.duration || 0)
        : Number(activeCourse?.duration || 0);

    if (!Number.isFinite(baseDuration) || baseDuration <= 0) {
      return 300;
    }
    return Math.max(60, Math.round(baseDuration));
  }, [activeCourse?.duration, effectiveScope, selectedSkill?.duration]);

  const scopeStorageKey = useMemo(() => {
    if (!activeCourse?.id) return '';
    return getScopeStorageKey(
      String(activeCourse.id),
      effectiveScope,
      effectiveScope === 'skill' ? String(selectedSkill?.id || '') : undefined,
    );
  }, [activeCourse?.id, effectiveScope, selectedSkill?.id]);

  const autoSaveSignature = useMemo(
    () =>
      JSON.stringify({
        scopeStorageKey,
        duration,
        decks,
        brandKits,
      }),
    [brandKits, decks, duration, scopeStorageKey],
  );

  const scopeResources = useMemo<Array<CourseResource | LessonResource>>(() => {
    if (effectiveScope === 'skill') {
      return Array.isArray(selectedSkill?.resources) ? selectedSkill.resources : [];
    }
    return Array.isArray(activeCourse?.resources) ? activeCourse.resources : [];
  }, [activeCourse?.resources, effectiveScope, selectedSkill?.resources]);

  const presentationLocalVisualAssets = useMemo<PresentationLocalVisualAssetCandidate[]>(() => {
    const candidates: PresentationLocalVisualAssetCandidate[] = [];
    const seen = new Set<string>();
    const pushCandidate = (
      id: string,
      url: string,
      title: string,
      description: string,
      source: PresentationLocalVisualAssetCandidate['source'],
      scope: PresentationLocalVisualAssetCandidate['scope'],
      assetKind: PresentationLocalVisualAssetCandidate['assetKind'],
      folderTag = '',
      mediaAssetId = '',
      uploaded = false,
    ) => {
      const trimmedUrl = String(url || '').trim();
      if (!trimmedUrl) return;
      const dedupeKey = String(mediaAssetId || trimmedUrl).trim().toLowerCase();
      if (dedupeKey && seen.has(dedupeKey)) return;
      if (dedupeKey) seen.add(dedupeKey);
      candidates.push({
        id,
        url: trimmedUrl,
        title: String(title || '').trim(),
        description: String(description || '').trim(),
        source,
        scope,
        assetKind,
        folderTag: String(folderTag || '').trim() || undefined,
        mediaAssetId: String(mediaAssetId || '').trim() || undefined,
        uploaded,
      });
    };

    const appendResourceCandidates = (
      resources: Array<CourseResource | LessonResource> | undefined,
      scope: PresentationLocalVisualAssetCandidate['scope'],
    ) => {
      if (!Array.isArray(resources)) return;
      resources.forEach((resource, index) => {
        if (isLikelyPresentationResource(resource)) return;
        const metadata = parsePresentationMediaResourceMetadata(resource.description);
        const mediaAssetId = String(resource.mediaAssetId || resource.id || '');
        if (resource.type === 'image') {
          pushCandidate(
            String(resource.id || `${scope}-presentation-image-${index + 1}`),
            resource.url,
            resource.title,
            resource.description,
            'resource',
            scope,
            'image',
            metadata.folderTag,
            mediaAssetId,
            metadata.sourceTag === 'upload',
          );
          return;
        }
        if (resource.type !== 'video') return;
        const preferredPosterUrl = String(resource.mediaPosterUrl || '').trim() || resource.url;
        pushCandidate(
          String(resource.id || `${scope}-presentation-video-${index + 1}`),
          preferredPosterUrl,
          resource.title,
          resource.description,
          'video-poster',
          scope,
          'video-poster',
          metadata.folderTag,
          mediaAssetId,
          metadata.sourceTag === 'upload',
        );
      });
    };

    appendResourceCandidates(selectedSkill?.resources, 'selected-skill');
    appendResourceCandidates(activeCourse?.resources, 'course');
    (Array.isArray(activeCourse?.lessons) ? activeCourse.lessons : []).forEach((lesson) => {
      if (selectedSkill?.id && String(lesson.id || '') === String(selectedSkill.id)) return;
      appendResourceCandidates(lesson.resources, 'other-skill');
    });

    if (selectedSkill?.thumbnail) {
      pushCandidate(
        `lesson-thumbnail-${selectedSkill.id}`,
        selectedSkill.thumbnail,
        selectedSkill.title,
        selectedSkill.description,
        'lesson-thumbnail',
        'lesson-thumbnail',
        'thumbnail',
      );
    }

    if (selectedSkill?.videoUrl) {
      const preferredPosterUrl =
        String(selectedSkill.linkedVideoPosterUrl || '').trim() || selectedSkill.videoUrl;
      pushCandidate(
        `lesson-video-poster-${selectedSkill.id}`,
        preferredPosterUrl,
        `${selectedSkill.title} video`,
        selectedSkill.description,
        'video-poster',
        'selected-skill',
        'video-poster',
        'lesson-videos',
        String(selectedSkill.linkedVideoAssetId || selectedSkill.id || ''),
      );
    }

    if (activeCourse?.thumbnail) {
      pushCandidate(
        `course-thumbnail-${activeCourse.id}`,
        activeCourse.thumbnail,
        activeCourse.title,
        activeCourse.description,
        'course-thumbnail',
        'course-thumbnail',
        'thumbnail',
      );
    }

    if (activeCourse?.videoUrl) {
      const preferredPosterUrl =
        String(activeCourse.linkedVideoPosterUrl || '').trim() || activeCourse.videoUrl;
      pushCandidate(
        `course-video-poster-${activeCourse.id}`,
        preferredPosterUrl,
        `${activeCourse.title} video`,
        activeCourse.description,
        'video-poster',
        'course',
        'video-poster',
        'course-materials',
        String(activeCourse.linkedVideoAssetId || activeCourse.id || ''),
      );
    }

    return candidates;
  }, [
    activeCourse?.description,
    activeCourse?.id,
    activeCourse?.lessons,
    activeCourse?.resources,
    activeCourse?.thumbnail,
    activeCourse?.title,
    activeCourse?.videoUrl,
    activeCourse?.linkedVideoAssetId,
    selectedSkill?.description,
    selectedSkill?.id,
    selectedSkill?.linkedVideoAssetId,
    selectedSkill?.resources,
    selectedSkill?.thumbnail,
    selectedSkill?.title,
    selectedSkill?.videoUrl,
  ]);

  const resolvedCourseId = useMemo(
    () => String(activeCourse?.id || selectedCourseValue || routeCourseId || '').trim(),
    [activeCourse?.id, routeCourseId, selectedCourseValue],
  );

  const brandKitScopeKey = useMemo(
    () => getPresentationBrandKitScopeKey(resolvedCourseId),
    [resolvedCourseId],
  );

  useEffect(() => {
    const store = readPresentationBrandKitStore();
    brandKitHydratedScopeRef.current = brandKitScopeKey;
    setBrandKits(Array.isArray(store[brandKitScopeKey]) ? store[brandKitScopeKey] : []);
  }, [brandKitScopeKey]);

  useEffect(() => {
    if (brandKitHydratedScopeRef.current !== brandKitScopeKey) return;
    const store = readPresentationBrandKitStore();
    store[brandKitScopeKey] = brandKits;
    writePresentationBrandKitStore(store);
  }, [brandKitScopeKey, brandKits]);

  const buildRouteWithContext = useCallback(
    (
      route: string,
      options?: {
        includeLesson?: boolean;
        lessonId?: string;
      },
    ) => {
      const [pathname, rawQuery = ''] = route.split('?');
      const params = new URLSearchParams(rawQuery);

      if (resolvedCourseId && !params.has('courseId') && !params.has('course_id')) {
        params.set('courseId', resolvedCourseId);
      }

      const lessonContext = String(
        options?.lessonId ||
          (options?.includeLesson !== false && effectiveScope === 'skill'
            ? selectedSkill?.id || ''
            : ''),
      ).trim();

      if (lessonContext && !params.has('lessonId') && !params.has('skillId')) {
        params.set('lessonId', lessonContext);
      }

      const suffix = params.toString();
      return suffix ? `${pathname}?${suffix}` : pathname;
    },
    [effectiveScope, resolvedCourseId, selectedSkill?.id],
  );

  const resourceDerivedDecks = useMemo<PresentationDeck[]>(() => {
    const maxDuration = Math.max(60, targetDuration);

    const resources = scopeResources.filter((resource) => {
      if (!isLikelyPresentationResource(resource)) return false;

      const resourceId = String(resource.id || '');
      if (effectiveScope === 'course') {
        return (
          resourceId.startsWith(PRESENTATION_RESOURCE_COURSE_PREFIX) ||
          (!resourceId.startsWith(PRESENTATION_RESOURCE_SKILL_PREFIX) &&
            resourceId.startsWith(PRESENTATION_RESOURCE_ID_PREFIX))
        );
      }

      const skillId = String(selectedSkill?.id || '');
      if (!skillId) return false;
      return resourceId.startsWith(`${PRESENTATION_RESOURCE_SKILL_PREFIX}${skillId}-`);
    });

    const parsed = resources
      .map((resource) => parsePresentationResource(resource, maxDuration))
      .filter((item): item is ParsedPresentationResource => Boolean(item));

    if (parsed.length === 0) return [];

    const grouped = new Map<string, ParsedPresentationResource[]>();
    parsed.forEach((item) => {
      const key = `${item.deckId}::${item.template}::${item.displayMode}::${item.splitLayoutVariant}::${item.placement}::${item.sourceName}`;
      const list = grouped.get(key) || [];
      list.push(item);
      grouped.set(key, list);
    });

    return Array.from(grouped.entries()).map(([key, items]) => {
      const [deckId] = key.split('::');
      const first = items[0];
      const slides = [...items]
        .sort((left, right) => {
          if (left.order !== right.order) return left.order - right.order;
          return left.startTime - right.startTime;
        })
        .map((entry) => ({
          id: entry.slideId,
          title: entry.slideTitle,
          sourceSlideNumber: entry.sourceSlideNumber,
          startTime: entry.startTime,
          duration: Math.max(1, entry.endTime - entry.startTime),
          layout: entry.slideLayout,
          speakerNotes: '',
          elements: buildDefaultSlideElements(entry.slideTitle, entry.slideLayout),
          previewImageUrl: entry.slidePreviewUrl,
          thumbnailImageUrl: entry.slidePreviewUrl,
        }));

      return normalizeDeck(
        {
          id: deckId,
          name: first.deckName,
          template: first.template,
          visualThemeId: first.visualThemeId,
          displayMode: first.displayMode,
          splitLayoutVariant: first.splitLayoutVariant,
          showNavigator: false,
          placement: first.placement,
          opacity: 0.96,
          sourceName: first.sourceName,
          sourceType: 'resource',
          sourceUrl: first.sourceUrl,
          slides,
          updatedAt: new Date().toISOString(),
        },
        maxDuration,
      );
    });
  }, [effectiveScope, scopeResources, selectedSkill?.id, targetDuration]);

  useEffect(() => {
    setDuration(targetDuration);
    setCurrentTime((prev) => Math.min(prev, targetDuration));
  }, [targetDuration]);

  useEffect(() => {
    if (!scopeStorageKey) return;
    if (hydratedScopeKeyRef.current === scopeStorageKey) return;
    hydratedScopeKeyRef.current = scopeStorageKey;
    userMutationTickRef.current = 0;

    const localStore = readPresentationStore();
    const localEntry = localStore[scopeStorageKey];

    if (localEntry && Array.isArray(localEntry.decks) && localEntry.decks.length > 0) {
      const normalized = localEntry.decks.map((deck) => normalizeDeck(deck, targetDuration));
      setDecks(normalized);
      setSelectedDeckId(normalized[0]?.id || '');
      setLastPublishedAt(String(localEntry.publishedAt || ''));
      setHasSavedChangesSincePublish(hasSavedDraftNewerThanPublished(localEntry.updatedAt, localEntry.publishedAt));
      const nextDuration = Math.max(60, Number(localEntry.duration) || targetDuration);
      setDuration(nextDuration);
      setCurrentTime((prev) => Math.min(prev, nextDuration));
      return;
    }

    if (resourceDerivedDecks.length > 0) {
      setDecks(resourceDerivedDecks);
      setSelectedDeckId(resourceDerivedDecks[0]?.id || '');
      setLastPublishedAt('');
      setHasSavedChangesSincePublish(false);
      setDuration(targetDuration);
      setCurrentTime((prev) => Math.min(prev, targetDuration));
      return;
    }

    const defaultDeck = createContextualDeckFromContext(
      presentationDefaultsForCourse.templateId,
      activeCourse,
      effectiveScope === 'skill' ? selectedSkill : null,
      targetDuration,
      isNorwegian,
      presentationDefaultsForCourse.visualThemeId,
      presentationDefaultsForCourse.splitLayoutVariant,
    );
    setDecks([defaultDeck]);
    setSelectedDeckId(defaultDeck.id);
    setLastPublishedAt('');
    setHasSavedChangesSincePublish(false);
    setDuration(targetDuration);
    setCurrentTime((prev) => Math.min(prev, targetDuration));
  }, [
    activeCourse,
    effectiveScope,
    isNorwegian,
    presentationDefaultsForCourse,
    resourceDerivedDecks,
    scopeStorageKey,
    selectedSkill,
    targetDuration,
  ]);

  useEffect(() => {
    if (!scopeStorageKey) return;
    let cancelled = false;
    const mutationAtStart = userMutationTickRef.current;

    void (async () => {
      const localStore = readPresentationStore();
      const dbStore = await readPresentationStoreFromDb();
      if (cancelled) return;

      if (!dbStore) {
        if (Object.keys(localStore).length > 0) {
          void writePresentationStoreToDb(localStore);
        }
        return;
      }

      const mergedStore = mergePresentationStores(localStore, dbStore);
      const mergedSerialized = JSON.stringify(mergedStore);

      if (mergedSerialized && JSON.stringify(localStore) !== mergedSerialized) {
        writePresentationStore(mergedStore);
      }
      if (mergedSerialized && JSON.stringify(dbStore) !== mergedSerialized) {
        void writePresentationStoreToDb(mergedStore);
      }

      const mergedEntry = mergedStore[scopeStorageKey];
      if (!mergedEntry || !Array.isArray(mergedEntry.decks) || mergedEntry.decks.length === 0) {
        setLastPublishedAt('');
        setHasSavedChangesSincePublish(false);
        return;
      }
      if (userMutationTickRef.current !== mutationAtStart) {
        return;
      }

      const normalized = mergedEntry.decks.map((deck) => normalizeDeck(deck, targetDuration));
      setDecks(normalized);
      setSelectedDeckId(normalized[0]?.id || '');
      setLastPublishedAt(String(mergedEntry.publishedAt || ''));
      setHasSavedChangesSincePublish(hasSavedDraftNewerThanPublished(mergedEntry.updatedAt, mergedEntry.publishedAt));
      const nextDuration = Math.max(60, Number(mergedEntry.duration) || targetDuration);
      setDuration(nextDuration);
      setCurrentTime((prev) => Math.min(prev, nextDuration));
    })();

    return () => {
      cancelled = true;
    };
  }, [scopeStorageKey, targetDuration]);

  useEffect(() => {
    if (!scopeStorageKey) return;
    if (!autoSaveHydratedRef.current) {
      autoSaveHydratedRef.current = true;
      lastAutoSavedSignatureRef.current = autoSaveSignature;
      markSaved();
      return;
    }
    if (autoSaveSignature === lastAutoSavedSignatureRef.current) return;

    markDirty();
    const timer = window.setTimeout(() => {
      markSaving();
      const normalizedDecks = decks.map((deck) => normalizeDeck(deck, duration));
      const store = readPresentationStore();
      const previousEntry = store[scopeStorageKey];
      store[scopeStorageKey] = {
        decks: normalizedDecks,
        duration,
        updatedAt: new Date().toISOString(),
        publishedAt: previousEntry?.publishedAt,
      };
      writePresentationStore(store);
      void writePresentationStoreToDb(store);
      lastAutoSavedSignatureRef.current = autoSaveSignature;
      setLastPublishedAt(String(previousEntry?.publishedAt || ''));
      setHasSavedChangesSincePublish(Boolean(previousEntry?.publishedAt));
      markSaved();
    }, 720);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    autoSaveSignature,
    decks,
    duration,
    markDirty,
    markSaved,
    markSaving,
    scopeStorageKey,
  ]);

  useEffect(() => {
    if (brandKits.length === 0 && !decks.some((deck) => deck.brandKitId)) return;
    setDecks((prev) =>
      prev.map((deck) => {
        const deckBrandKit = deck.brandKitId ? brandKits.find((kit) => kit.id === deck.brandKitId) || null : null;
        const deckBrandTokens = resolvePresentationBrandTokens(deck.visualThemeId, deckBrandKit);
        return {
          ...deck,
          slides: deck.slides.map((slide) =>
            hydrateSlidePreview(slide, deck.visualThemeId, deck.name, {
              force: true,
              brandTokens: deckBrandTokens,
              brandKit: deckBrandKit,
            }),
          ),
        };
      }),
    );
  }, [brandKits]);

  useEffect(() => {
    autoSaveHydratedRef.current = false;
    lastAutoSavedSignatureRef.current = '';
    autoContextGenerationRef.current.clear();
  }, [scopeStorageKey]);

  useEffect(() => {
    analytics.trackEvent('academy_presentation_overlay_studio_opened', {
      courseId: activeCourse?.id || null,
      scope: effectiveScope,
      lessonId: effectiveScope === 'skill' ? selectedSkill?.id || null : null,
      deckCount: decks.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'AcademyPresentationOverlayStudio opened', {
      courseId: activeCourse?.id || null,
      scope: effectiveScope,
      lessonId: effectiveScope === 'skill' ? selectedSkill?.id || null : null,
      deckCount: decks.length,
    });
  }, [activeCourse?.id, analytics, debugging, decks.length, effectiveScope, selectedSkill?.id]);

  const semanticSearchItems = useMemo(
    () =>
      decks.map((deck) => ({
        id: deck.id,
        title: deck.name,
        subtitle: deck.sourceName,
        text: deck.slides
          .slice(0, 20)
          .map((slide) => {
            const elementText = slide.elements
              .filter((element) => element.type === 'text')
              .map((element) => String(element.text || '').trim())
              .filter(Boolean)
              .slice(0, 3)
              .join(' ');
            return `${slide.title} ${slide.speakerNotes} ${elementText}`.trim();
          })
          .filter(Boolean)
          .join(' \n ')
          .slice(0, 2600),
        tags: [deck.template, deck.visualThemeId, deck.displayMode, deck.splitLayoutVariant],
      })),
    [decks],
  );

  useEffect(() => {
    const query = search.trim();
    const requestId = semanticSearchRequestRef.current + 1;
    semanticSearchRequestRef.current = requestId;

    if (!query || semanticSearchItems.length === 0) {
      setSemanticSearchBusy(false);
      setSemanticSearchRanking([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setSemanticSearchBusy(true);
        try {
          const response = (await apiRequest('/api/academy/presentation/semantic-search', {
            method: 'POST',
            body: {
              query,
              limit: Math.min(36, semanticSearchItems.length),
              items: semanticSearchItems,
            },
          })) as Record<string, unknown>;
          if (semanticSearchRequestRef.current !== requestId) return;
          const responseData =
            response.data && typeof response.data === 'object'
              ? (response.data as Record<string, unknown>)
              : null;
          const rankingRaw =
            responseData && Array.isArray(responseData.ranking) ? responseData.ranking : [];
          const ranking = rankingRaw
            .map((entry) => {
              if (!entry || typeof entry !== 'object') return null;
              const candidate = entry as Record<string, unknown>;
              const id = String(candidate.id || '').trim();
              if (!id) return null;
              const score = Number(candidate.score);
              const lexicalScore = Number(candidate.lexicalScore);
              const semanticScore = Number(candidate.semanticScore);
              const rerankRaw = candidate.rerankScore;
              const rerankScore =
                rerankRaw === null || rerankRaw === undefined ? null : Number(rerankRaw);
              return {
                id,
                score: Number.isFinite(score) ? score : 0,
                lexicalScore: Number.isFinite(lexicalScore) ? lexicalScore : 0,
                semanticScore: Number.isFinite(semanticScore) ? semanticScore : 0,
                rerankScore:
                  rerankScore === null || Number.isFinite(rerankScore) ? rerankScore : null,
              } satisfies PresentationSemanticSearchRankItem;
            })
            .filter((entry): entry is PresentationSemanticSearchRankItem => Boolean(entry));
          setSemanticSearchRanking(ranking);
        } catch {
          if (semanticSearchRequestRef.current !== requestId) return;
          setSemanticSearchRanking([]);
        } finally {
          if (semanticSearchRequestRef.current === requestId) {
            setSemanticSearchBusy(false);
          }
        }
      })();
    }, 260);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [search, semanticSearchItems]);

  const filteredDecks = useMemo(() => {
    const query = search.trim();
    if (!query) return decks;
    const queryTokens = tokenizeSearchQuery(query);
    const semanticRankIndex = new Map<string, number>();
    const semanticScoreByDeckId = new Map<string, number>();
    semanticSearchRanking.forEach((entry, index) => {
      semanticRankIndex.set(entry.id, index);
      semanticScoreByDeckId.set(entry.id, Number(entry.score) || 0);
    });

    const ranked = decks
      .map((deck) => {
        const lexicalScore = computeDeckLexicalSearchScore(deck, query, queryTokens);
        const semanticScore = semanticScoreByDeckId.get(deck.id) || 0;
        const combinedScore =
          semanticScore > 0
            ? semanticScore * 0.74 + lexicalScore * 0.26
            : lexicalScore;
        return {
          deck,
          lexicalScore,
          semanticScore,
          combinedScore,
          semanticIndex: semanticRankIndex.get(deck.id) ?? Number.MAX_SAFE_INTEGER,
        };
      })
      .filter(
        (entry) =>
          entry.lexicalScore > 0 ||
          entry.semanticScore >= 0.16 ||
          entry.combinedScore >= 0.14,
      )
      .sort((a, b) => {
        if (b.combinedScore !== a.combinedScore) return b.combinedScore - a.combinedScore;
        if (a.semanticIndex !== b.semanticIndex) return a.semanticIndex - b.semanticIndex;
        return b.lexicalScore - a.lexicalScore;
      })
      .map((entry) => entry.deck);

    if (ranked.length > 0) return ranked;
    return decks.filter((deck) => computeDeckLexicalSearchScore(deck, query, queryTokens) > 0);
  }, [decks, search, semanticSearchRanking]);

  const activeDeckId = useMemo(() => {
    if (selectedDeckId && decks.some((deck) => deck.id === selectedDeckId)) {
      return selectedDeckId;
    }
    return decks[0]?.id || '';
  }, [decks, selectedDeckId]);

  const selectedDeck = useMemo(() => {
    if (!activeDeckId) return null;
    return decks.find((deck) => deck.id === activeDeckId) || null;
  }, [activeDeckId, decks]);

  const trackPresentationEvent = useCallback(
    (eventName: string, payload?: Record<string, unknown>) => {
      analytics.trackEvent(eventName, {
        courseId: activeCourse?.id || null,
        scope: effectiveScope,
        lessonId: effectiveScope === 'skill' ? selectedSkill?.id || null : null,
        deckId: selectedDeck?.id || null,
        ...payload,
        timestamp: Date.now(),
      });
    },
    [activeCourse?.id, analytics, effectiveScope, selectedDeck?.id, selectedSkill?.id],
  );

  useEffect(() => {
    if (activeDeckId && selectedDeckId !== activeDeckId) {
      setSelectedDeckId(activeDeckId);
    }
  }, [activeDeckId, selectedDeckId]);

  useEffect(() => {
    setNavigatorSelectedSlideId('');
  }, [activeDeckId]);

  useEffect(() => {
    setDesignPlan(null);
    setDesignPlanError('');
    setAiCritique(null);
    setAiCritiqueError('');
  }, [activeDeckId]);

  useEffect(() => {
    setDurationInput(formatTime(duration));
  }, [duration]);

  const activePreviewSlide = useMemo(() => {
    if (!selectedDeck) return null;
    return (
      selectedDeck.slides.find((slide) => {
        const start = Number(slide.startTime || 0);
        const end = start + Number(slide.duration || 0);
        return currentTime >= start && currentTime < end;
      }) || null
    );
  }, [currentTime, selectedDeck]);

  const navigatorSelectedSlide = useMemo(() => {
    if (!selectedDeck || !navigatorSelectedSlideId) return null;
    return selectedDeck.slides.find((slide) => slide.id === navigatorSelectedSlideId) || null;
  }, [navigatorSelectedSlideId, selectedDeck]);

  const previewSlide = useMemo(() => {
    if (!selectedDeck) return null;
    return navigatorSelectedSlide || activePreviewSlide || selectedDeck.slides[0] || null;
  }, [activePreviewSlide, navigatorSelectedSlide, selectedDeck]);

  const selectedTemplatePreset = useMemo(
    () =>
      templatePresets.find((template) => template.id === selectedDeck?.template) ||
      templatePresets[0],
    [selectedDeck?.template],
  );
  const selectedVisualThemePreset = useMemo(
    () =>
      visualThemePresets.find((themePreset) => themePreset.id === selectedDeck?.visualThemeId) ||
      visualThemePresets[0],
    [selectedDeck?.visualThemeId],
  );

  const selectedBrandKit = useMemo(
    () =>
      selectedDeck?.brandKitId
        ? brandKits.find((kit) => kit.id === selectedDeck.brandKitId) || null
        : null,
    [brandKits, selectedDeck?.brandKitId],
  );

  const effectiveBrandTokens = useMemo(
    () =>
      resolvePresentationBrandTokens(
        selectedDeck?.visualThemeId || presentationDefaultsForCourse.visualThemeId,
        selectedBrandKit,
      ),
    [presentationDefaultsForCourse.visualThemeId, selectedBrandKit, selectedDeck?.visualThemeId],
  );

  const activeVisualThemeColors = effectiveBrandTokens;

  const templateMemory = useMemo<PresentationTemplateMemoryItem[]>(
    () =>
      decks
        .filter((deck) => deck.id !== selectedDeck?.id)
        .map((deck) => {
          const memoryItem: PresentationTemplateMemoryItem = {
            id: deck.id,
            kind: 'deck',
            name: deck.name,
            summary: deck.sourceName || deck.slides[0]?.title || '',
            templateId: deck.template,
            visualThemeId: deck.visualThemeId,
            displayMode: deck.displayMode,
            splitLayoutVariant: deck.splitLayoutVariant,
            searchText: deck.slides
              .slice(0, 20)
              .map((slide) => {
                const elementText = slide.elements
                  .filter((element) => element.type === 'text')
                  .map((element) => String(element.text || '').trim())
                  .filter(Boolean)
                  .slice(0, 4)
                  .join(' ');
                return [slide.title, slide.speakerNotes, elementText].filter(Boolean).join(' · ');
              })
              .filter(Boolean)
              .join('\n')
              .slice(0, 3600),
            brandName: deck.brandKitId
              ? brandKits.find((kit) => kit.id === deck.brandKitId)?.name || ''
              : '',
          };
          return memoryItem;
        })
        .filter((entry) => entry.searchText.trim().length > 0)
        .slice(0, 48),
    [brandKits, decks, selectedDeck?.id],
  );

  const activeBrandContext = useMemo(
    () => ({
      name:
        selectedBrandKit?.name ||
        tt(selectedTemplatePreset.labelNo, selectedTemplatePreset.labelEn) ||
        (isNorwegian ? 'Presentasjonsbrand' : 'Presentation brand'),
      primary: activeVisualThemeColors.primary,
      secondary: activeVisualThemeColors.secondary,
      accent: activeVisualThemeColors.accent,
      headingFont: activeVisualThemeColors.headingFont,
      bodyFont: activeVisualThemeColors.bodyFont,
      chartStyle: activeVisualThemeColors.chartStyle,
      imageStyle: activeVisualThemeColors.imageStyle,
      logoText: selectedBrandKit?.logoText || '',
      footerText: selectedBrandKit?.footerText || '',
      minContrastRatio: selectedBrandKit?.minContrastRatio || 4.5,
    }),
    [
      activeVisualThemeColors.accent,
      activeVisualThemeColors.bodyFont,
      activeVisualThemeColors.chartStyle,
      activeVisualThemeColors.headingFont,
      activeVisualThemeColors.imageStyle,
      activeVisualThemeColors.primary,
      activeVisualThemeColors.secondary,
      isNorwegian,
      selectedBrandKit?.footerText,
      selectedBrandKit?.logoText,
      selectedBrandKit?.minContrastRatio,
      selectedBrandKit?.name,
      selectedTemplatePreset.labelEn,
      selectedTemplatePreset.labelNo,
    ],
  );

  const activeProjectTemplateId = useMemo(
    () => inferProjectTemplateIdFromCourse(activeCourse),
    [activeCourse?.curriculumProjectTemplateId, activeCourse?.id, activeCourse?.pedagogicalArchitecture?.purpose],
  );

  const activeInstructorProfile = useMemo(() => {
    const fromRoster = (instructorId: string, roleLabel: string, roleKind: 'lead' | 'video' | 'slide' | 'course') => {
      const roster = instructorsById.get(String(instructorId || ''));
      if (!roster) return null;
      return {
        id: String(roster.id || ''),
        name: String(roster.name || '').trim() || tt('Instruktør', 'Instructor'),
        avatar: String(roster.avatar || '').trim(),
        bio: String(roster.bio || '').trim(),
        profession: String(roster.profession || '').trim(),
        expertise: Array.isArray(roster.expertise)
          ? roster.expertise.map((item) => String(item || '').trim()).filter(Boolean)
          : [],
        roleLabel,
        roleKind,
      };
    };

    const slideInstructorId = String(previewSlide?.instructorId || '').trim();
    if (slideInstructorId) {
      const slideProfile = fromRoster(slideInstructorId, tt('Slide-instruktør', 'Slide instructor'), 'slide');
      if (slideProfile) return slideProfile;
    }

    const videoInstructorId = String(selectedSkill?.videoInstructorId || '').trim();
    if (videoInstructorId) {
      const profile = fromRoster(videoInstructorId, tt('Videoinstruktør', 'Video instructor'), 'video');
      if (profile) return profile;
    }

    const competencyLeadId = String(activeCourse?.competencyLeadInstructorId || '').trim();
    if (competencyLeadId) {
      const profile = fromRoster(competencyLeadId, tt('Fagansvarlig', 'Competency lead'), 'lead');
      if (profile) return profile;
    }

    const baseInstructorId = String(activeCourse?.instructor?.id || '').trim();
    if (baseInstructorId) {
      const rosterProfile = fromRoster(baseInstructorId, tt('Kursinstruktør', 'Course instructor'), 'course');
      if (rosterProfile) return rosterProfile;
    }

    const baseInstructor = activeCourse?.instructor;
    if (!baseInstructor) return null;
    return {
      id: String(baseInstructor.id || '').trim(),
      name: String(baseInstructor.name || '').trim() || tt('Instruktør', 'Instructor'),
      avatar: String(baseInstructor.avatar || '').trim(),
      bio: String(baseInstructor.bio || '').trim(),
      profession: String(baseInstructor.profession || '').trim(),
      expertise: [] as string[],
      roleLabel: tt('Kursinstruktør', 'Course instructor'),
      roleKind: 'course' as const,
    };
  }, [
    activeCourse?.competencyLeadInstructorId,
    activeCourse?.instructor,
    instructorsById,
    previewSlide?.instructorId,
    selectedSkill?.videoInstructorId,
    tt,
  ]);

  useEffect(() => {
    if (activeInstructorProfile || !instructorInlineOpen) return;
    setInstructorInlineOpen(false);
  }, [activeInstructorProfile, instructorInlineOpen]);

  const instructorRoleChipTone = useMemo(() => {
    const roleKind = activeInstructorProfile?.roleKind;
    if (roleKind === 'slide') {
      return { bg: 'rgba(126,232,179,0.2)', color: '#cbffe8' };
    }
    if (roleKind === 'video') {
      return { bg: 'rgba(92,149,255,0.24)', color: '#dce8ff' };
    }
    if (roleKind === 'lead') {
      return { bg: 'rgba(248,179,33,0.22)', color: '#ffe8b0' };
    }
    return { bg: 'rgba(255,255,255,0.14)', color: '#edf0f7' };
  }, [activeInstructorProfile?.roleKind]);

  const orderedPreviewSlides = useMemo(
    () =>
      selectedDeck
        ? [...selectedDeck.slides].sort(
            (left, right) => Number(left.startTime || 0) - Number(right.startTime || 0),
          )
        : [],
    [selectedDeck],
  );
  const snapTimeValue = useCallback(
    (rawValue: number) => {
      let next = Number.isFinite(rawValue) ? rawValue : 0;
      if (timelineSnapEnabled) {
        next = roundHalfSecond(next);
      }
      if (snapToPlayheadEnabled && Math.abs(next - currentTime) <= 0.35) {
        next = currentTime;
      }
      return Math.max(0, next);
    },
    [currentTime, snapToPlayheadEnabled, timelineSnapEnabled],
  );

  const slideOverlapMap = useMemo(() => {
    const overlaps = new Map<string, number>();
    if (!selectedDeck || selectedDeck.slides.length < 2) return overlaps;

    const ordered = [...selectedDeck.slides].sort(
      (left, right) => Number(left.startTime || 0) - Number(right.startTime || 0),
    );
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      const previousEnd = Number(previous.startTime || 0) + Number(previous.duration || 0);
      const overlap = previousEnd - Number(current.startTime || 0);
      if (overlap > 0) {
        overlaps.set(String(previous.id), Math.max(overlaps.get(String(previous.id)) || 0, overlap));
        overlaps.set(String(current.id), Math.max(overlaps.get(String(current.id)) || 0, overlap));
      }
    }
    return overlaps;
  }, [selectedDeck]);

  const activeQualityPlan = useMemo(() => {
    if (!selectedDeck) return null;
    const currentPlan =
      designPlan &&
      selectedDeck.slides.every((slide) => designPlan.slides.some((entry) => entry.slideId === slide.id))
        ? designPlan
        : buildLocalDesignPlanFallback({
            deck: selectedDeck,
            scope: effectiveScope,
            courseId: resolvedCourseId,
            lessonId: effectiveScope === 'skill' ? String(selectedSkill?.id || '') : '',
            projectTemplateId: activeProjectTemplateId,
            useNorwegian: isNorwegian,
          });
    return new Map(currentPlan.slides.map((entry) => [entry.slideId, entry]));
  }, [
    activeProjectTemplateId,
    designPlan,
    effectiveScope,
    isNorwegian,
    resolvedCourseId,
    selectedDeck,
    selectedSkill?.id,
  ]);

  const designEvaluation = useMemo<PresentationDeckDesignEvaluation>(() => {
    if (!selectedDeck || !activeQualityPlan) {
      return {
        overall: 100,
        content: 100,
        hierarchy: 100,
        balance: 100,
        visuals: 100,
        grammar: 100,
        slides: [],
        findings: [],
      };
    }
    return evaluatePresentationDeckDesign({
      maxTimeline: Math.max(60, duration),
      themeTokens: activeVisualThemeColors,
      slides: selectedDeck.slides.map((slide) => {
        const planForSlide =
          activeQualityPlan.get(slide.id) ||
          buildLocalDesignPlanFallback({
            deck: {
              ...selectedDeck,
              slides: [slide],
            },
            scope: effectiveScope,
            courseId: resolvedCourseId,
            lessonId: effectiveScope === 'skill' ? String(selectedSkill?.id || '') : '',
            projectTemplateId: activeProjectTemplateId,
            useNorwegian: isNorwegian,
          }).slides[0];
        return {
          slideId: slide.id,
          title: slide.title,
          startTime: slide.startTime,
          duration: slide.duration,
          overlapSeconds: slideOverlapMap.get(String(slide.id)) || 0,
          elements: slide.elements,
          grammarId: planForSlide.grammarId,
          contentBudget: planForSlide.contentBudget,
          structuredContent: planForSlide.structuredContent,
          visualNeeds: planForSlide.visualNeeds,
        };
      }),
    });
  }, [
    activeProjectTemplateId,
    activeQualityPlan,
    duration,
    effectiveScope,
    isNorwegian,
    resolvedCourseId,
    selectedDeck,
    selectedSkill?.id,
    activeVisualThemeColors,
    slideOverlapMap,
  ]);

  const canvasContrastRatio = useMemo(
    () =>
      contrastRatio(
        activeVisualThemeColors.canvasText,
        solidPreviewColor(activeVisualThemeColors.canvasBg, '#ffffff'),
      ),
    [activeVisualThemeColors.canvasBg, activeVisualThemeColors.canvasText],
  );

  const brandEvaluation = useMemo<PresentationBrandEvaluation>(() => {
    const findings: PresentationQualityIssue[] = [];
    const minContrastRatio = Math.max(3, Number(selectedBrandKit?.minContrastRatio) || 4.5);
    const navContrast = contrastRatio(
      activeVisualThemeColors.navText,
      solidPreviewColor(activeVisualThemeColors.navBg, '#101826'),
    );

    if (selectedDeck?.brandKitId && !selectedBrandKit) {
      findings.push({
        id: 'brand-kit-missing',
        severity: 'error',
        messageNo: 'Valgt brand kit finnes ikke lenger for denne presentasjonen.',
        messageEn: 'The selected brand kit no longer exists for this presentation.',
      });
    }

    if (selectedBrandKit?.requireLogo && !selectedBrandKit.logoText.trim()) {
      findings.push({
        id: 'brand-logo-required',
        severity: 'error',
        messageNo: 'Brand kit krever logo eller wordmark, men feltet er tomt.',
        messageEn: 'The brand kit requires a logo or wordmark, but the field is empty.',
      });
    }

    if (selectedBrandKit?.requireFooter && !selectedBrandKit.footerText.trim()) {
      findings.push({
        id: 'brand-footer-required',
        severity: 'error',
        messageNo: 'Brand kit krever footer, men footer-teksten er tom.',
        messageEn: 'The brand kit requires a footer, but the footer text is empty.',
      });
    }

    if (canvasContrastRatio !== null && canvasContrastRatio < minContrastRatio) {
      findings.push({
        id: 'brand-canvas-contrast',
        severity: 'error',
        messageNo: `Canvas-kontrast ${canvasContrastRatio.toFixed(1)} er lavere enn brand-kravet ${minContrastRatio.toFixed(1)}.`,
        messageEn: `Canvas contrast ${canvasContrastRatio.toFixed(1)} is lower than the brand requirement ${minContrastRatio.toFixed(1)}.`,
      });
    }

    if (navContrast !== null && navContrast < minContrastRatio) {
      findings.push({
        id: 'brand-nav-contrast',
        severity: 'warning',
        messageNo: `Navigasjonskontrast ${navContrast.toFixed(1)} er lavere enn brand-kravet ${minContrastRatio.toFixed(1)}.`,
        messageEn: `Navigation contrast ${navContrast.toFixed(1)} is lower than the brand requirement ${minContrastRatio.toFixed(1)}.`,
      });
    }

    if (selectedBrandKit?.logoText && selectedBrandKit.logoText.trim().length > 26) {
      findings.push({
        id: 'brand-logo-too-long',
        severity: 'warning',
        messageNo: 'Wordmark/logo-tekst er for lang og vil gi svak header-hierarki.',
        messageEn: 'The wordmark/logo text is too long and weakens the header hierarchy.',
      });
    }

    if (selectedBrandKit?.footerText && selectedBrandKit.footerText.trim().length > 96) {
      findings.push({
        id: 'brand-footer-too-long',
        severity: 'warning',
        messageNo: 'Footer-teksten er for lang og bor forkortes for renere decks.',
        messageEn: 'The footer text is too long and should be shortened for cleaner decks.',
      });
    }

    const penalty = findings.reduce(
      (acc, issue) => acc + (issue.severity === 'error' ? 16 : 8),
      0,
    );
    return {
      score: clamp(100 - penalty, 0, 100),
      findings,
    };
  }, [
    activeVisualThemeColors.canvasBg,
    activeVisualThemeColors.canvasText,
    activeVisualThemeColors.navBg,
    activeVisualThemeColors.navText,
    canvasContrastRatio,
    selectedBrandKit,
    selectedDeck?.brandKitId,
  ]);

  const qualityIssues = useMemo<PresentationQualityIssue[]>(
    () => [
      ...designEvaluation.findings.map((finding) => ({
        id: finding.id,
        slideId: finding.slideId,
        severity: finding.severity,
        messageNo: finding.messageNo,
        messageEn: finding.messageEn,
      })),
      ...brandEvaluation.findings,
      ...(aiCritique?.findings.map((finding) => ({
        id: finding.id,
        slideId: finding.slideId,
        severity: finding.severity,
        messageNo: finding.messageNo,
        messageEn: finding.messageEn,
      })) || []),
    ],
    [aiCritique?.findings, brandEvaluation.findings, designEvaluation.findings],
  );

  const qualitySummary = useMemo(() => {
    const errorCount = qualityIssues.filter((issue) => issue.severity === 'error').length;
    const warningCount = qualityIssues.length - errorCount;
    return {
      errorCount,
      warningCount,
      canPublish: errorCount === 0,
      designScore: Math.round(
        designEvaluation.overall * 0.68 +
          brandEvaluation.score * 0.14 +
          (aiCritique?.overall ?? 100) * 0.18,
      ),
      brandScore: brandEvaluation.score,
      aiScore: aiCritique?.overall ?? null,
    };
  }, [aiCritique?.overall, brandEvaluation.score, designEvaluation.overall, qualityIssues]);
  const simplePresentationStatus = useMemo(() => {
    if (designPlanBusy) {
      return {
        label: tt('Bygger automatisk', 'Generating automatically'),
        toneBg: 'rgba(92,149,255,0.16)',
        toneText: '#dce8ff',
      };
    }
    if (designPlanError) {
      return {
        label: tt('Trenger oppdatering', 'Needs refresh'),
        toneBg: 'rgba(255,122,122,0.18)',
        toneText: '#ffd6d6',
      };
    }
    if (selectedDeck?.sourceType === 'auto-context-ready' || designPlan) {
      return {
        label: tt('Auto-generert', 'Auto-generated'),
        toneBg: 'rgba(126,232,179,0.18)',
        toneText: '#caffea',
      };
    }
    return {
      label: tt('Klar til oppsett', 'Ready to process'),
      toneBg: 'rgba(248,179,33,0.18)',
      toneText: '#ffe6b8',
    };
  }, [designPlan, designPlanBusy, designPlanError, selectedDeck?.sourceType, tt]);
  const simplePresentationHighlights = useMemo(
    () =>
      uniquePresentationLines([
        ...(previewSlide ? [previewSlide.title] : []),
        ...(selectedDeck?.slides.slice(1, 4).map((slide) => slide.title) || []),
      ]).slice(0, 4),
    [previewSlide, selectedDeck?.slides],
  );
  const simplePresentationSummary = useMemo(() => {
    const architecture = activeCourse?.pedagogicalArchitecture;
    return (
      String(selectedSkill?.description || '').trim() ||
      String(architecture?.purpose || '').trim() ||
      String(architecture?.transformation || '').trim() ||
      String(activeCourse?.description || '').trim() ||
      tt(
        'Presentasjonen bygges automatisk ut fra kompetanse, ferdighet og pedagogisk arkitektur.',
        'The presentation is built automatically from competency, skill, and pedagogical architecture.',
      )
    );
  }, [
    activeCourse?.description,
    activeCourse?.pedagogicalArchitecture,
    selectedSkill?.description,
    tt,
  ]);
  const saveStatusIndicator = useMemo(() => {
    if (autoSaveState === 'saving') {
      return {
        icon: <CloudSync fontSize="small" className="academy-save-spin" />,
        tooltip: tt('Lagrer endringer ...', 'Saving changes ...'),
        bgColor: 'rgba(116,173,255,0.22)',
        textColor: '#b9d7ff',
        borderColor: 'rgba(116,173,255,0.38)',
      };
    }
    if (autoSaveState === 'dirty') {
      return {
        icon: <CloudOff fontSize="small" />,
        tooltip: tt('Ikke lagret', 'Unsaved'),
        bgColor: 'rgba(248,179,33,0.2)',
        textColor: '#f8d675',
        borderColor: 'rgba(248,179,33,0.36)',
      };
    }
    const formatted = formatToolSavedTime(lastSavedAt, tt('nb-NO', 'en-US'));
    return {
      icon: <CloudDone fontSize="small" />,
      tooltip: `${tt('Lagret', 'Saved')} • ${formatted}`,
      bgColor: 'rgba(126,232,179,0.16)',
      textColor: '#9ef1ca',
      borderColor: 'rgba(126,232,179,0.36)',
    };
  }, [autoSaveState, lastSavedAt, tt]);
  const draftStatusChip = useMemo(() => {
    const publishedAtMs = Date.parse(lastPublishedAt);
    const hasPublishedVersion = Number.isFinite(publishedAtMs) && publishedAtMs > 0;
    const publishedFormatted = hasPublishedVersion
      ? formatToolSavedTime(lastPublishedAt, tt('nb-NO', 'en-US'))
      : '--:--';
    if (autoSaveState === 'saving') {
      return {
        label: hasPublishedVersion
          ? tt('Oppdaterer utkast ...', 'Updating draft ...')
          : tt('Utkast lagres ...', 'Draft saving ...'),
        tooltip: hasPublishedVersion
          ? `${tt('Sist publisert', 'Last published')} • ${publishedFormatted}`
          : tt(
              'Utkast synkroniseres. Ikke publisert ennå.',
              'Draft is syncing. Not published yet.',
            ),
      };
    }
    if (autoSaveState === 'dirty') {
      return {
        label: hasPublishedVersion
          ? tt('Publisert · nye endringer', 'Published · new changes')
          : tt('Utkast ikke lagret', 'Draft unsaved'),
        tooltip: hasPublishedVersion
          ? tt(
              'Det finnes en publisert versjon, men nye endringer er ikke publisert ennå.',
              'A published version exists, but new changes are not published yet.',
            )
          : tt(
              'Du har ulagrede endringer. Ikke publisert.',
              'You have unsaved changes. Not published.',
            ),
      };
    }
    if (hasPublishedVersion && !hasSavedChangesSincePublish) {
      return {
        label: tt('Publisert', 'Published'),
        tooltip: `${tt('Publisert', 'Published')} • ${publishedFormatted}`,
      };
    }
    if (hasPublishedVersion && hasSavedChangesSincePublish) {
      const formatted = formatToolSavedTime(lastSavedAt, tt('nb-NO', 'en-US'));
      return {
        label: tt('Utkast lagret (nyere enn publisert)', 'Draft saved (newer than published)'),
        tooltip: `${tt('Lagret', 'Saved')} • ${formatted} • ${tt('Sist publisert', 'Last published')} • ${publishedFormatted}`,
      };
    }
    const formatted = formatToolSavedTime(lastSavedAt, tt('nb-NO', 'en-US'));
    return {
      label: tt('Utkast lagret (ikke publisert)', 'Draft saved (not published)'),
      tooltip: `${tt('Lagret', 'Saved')} • ${formatted} • ${tt('Ikke publisert', 'Not published')}`,
    };
  }, [autoSaveState, hasSavedChangesSincePublish, lastPublishedAt, lastSavedAt, tt]);
  const previewSlideBodyLines = useMemo(() => collectSlideBodyLines(previewSlide), [previewSlide]);
  const previewSlideBodyDraft = useMemo(() => previewSlideBodyLines.join('\n'), [previewSlideBodyLines]);
  const activeInstructorScript = useMemo(
    () => String(previewSlide?.speakerNotes || '').trim(),
    [previewSlide?.speakerNotes],
  );
  const teleprompterLines = useMemo(
    () => activeInstructorScript.split(/\r?\n/g),
    [activeInstructorScript],
  );
  const teleprompterScriptTokens = useMemo<TeleprompterScriptToken[]>(() => {
    if (!activeInstructorScript) return [];
    const lines = activeInstructorScript.split(/\r?\n/g);
    const tokens: TeleprompterScriptToken[] = [];
    lines.forEach((line, lineIndex) => {
      tokenizeSpeechText(line).forEach((token) => {
        tokens.push({ token, lineIndex });
      });
    });
    return tokens;
  }, [activeInstructorScript]);
  const teleprompterAlignedSpeechWords = useMemo<TeleprompterAlignedSpeechWord[]>(() => {
    if (teleprompterSpeechWords.length === 0) return [];
    const alignedTokenIndexes = alignSpeechWordsToScriptTokens(
      teleprompterSpeechWords,
      teleprompterScriptTokens,
    );
    return teleprompterSpeechWords.map((word, index) => ({
      ...word,
      scriptTokenIndex:
        typeof alignedTokenIndexes[index] === 'number' ? (alignedTokenIndexes[index] as number) : null,
    }));
  }, [teleprompterScriptTokens, teleprompterSpeechWords]);
  const previewSlideWindow = useMemo(
    () => ({
      start: Math.max(0, Number(previewSlide?.startTime) || 0),
      end: previewSlide
        ? Math.max(0, Number(previewSlide.startTime || 0) + Number(previewSlide.duration || 0))
        : Math.max(1, duration),
    }),
    [duration, previewSlide],
  );
  const teleprompterSpeechStatusChip = useMemo(() => {
    if (teleprompterSpeechStatus === 'preparing') {
      return {
        label: tt('Sync: Klargjorer', 'Sync: Preparing'),
        bg: 'rgba(92,149,255,0.24)',
        color: '#d9e7ff',
      };
    }
    if (teleprompterSpeechStatus === 'ready') {
      return {
        label: tt('Sync: Klar', 'Sync: Ready'),
        bg: 'rgba(96,215,165,0.2)',
        color: '#d7ffee',
      };
    }
    if (teleprompterSpeechStatus === 'error') {
      return {
        label: tt('Sync: Feil', 'Sync: Error'),
        bg: 'rgba(255,122,122,0.2)',
        color: '#ffe1e1',
      };
    }
    return {
      label: tt('Sync: Ikke klar', 'Sync: Not ready'),
      bg: 'rgba(255,255,255,0.14)',
      color: '#edf0f7',
    };
  }, [teleprompterSpeechStatus, tt]);
  const teleprompterSpeechMetaLabel = useMemo(() => {
    if (teleprompterSpeechStatus !== 'ready' || teleprompterSpeechWords.length === 0) {
      return '';
    }
    const provider = teleprompterSpeechProvider || 'whisperx/pyannote';
    const language = teleprompterSpeechLanguage || (isNorwegian ? 'no' : 'en');
    return tt(
      `${teleprompterSpeechWords.length} ord · ${provider} · ${language}`,
      `${teleprompterSpeechWords.length} words · ${provider} · ${language}`,
    );
  }, [
    isNorwegian,
    teleprompterSpeechLanguage,
    teleprompterSpeechProvider,
    teleprompterSpeechStatus,
    teleprompterSpeechWords.length,
    tt,
  ]);
  const teleprompterMode = useMemo<'static' | 'auto' | 'speech'>(() => {
    if (teleprompterSpeechFollow) return 'speech';
    if (teleprompterAutoScroll) return 'auto';
    return 'static';
  }, [teleprompterAutoScroll, teleprompterSpeechFollow]);
  const canEnableSpeechFollow = useMemo(
    () =>
      showInstructorScriptOverlay &&
      Boolean(activeInstructorScript) &&
      teleprompterSpeechStatus === 'ready' &&
      teleprompterSpeechWords.length > 0,
    [activeInstructorScript, showInstructorScriptOverlay, teleprompterSpeechStatus, teleprompterSpeechWords.length],
  );
  const setTeleprompterMode = useCallback(
    (mode: 'static' | 'auto' | 'speech') => {
      if (mode === 'speech') {
        if (!canEnableSpeechFollow) return;
        setTeleprompterSpeechFollow(true);
        setTeleprompterAutoScroll(false);
        return;
      }
      if (mode === 'auto') {
        if (!showInstructorScriptOverlay || !activeInstructorScript) return;
        setTeleprompterSpeechFollow(false);
        setTeleprompterAutoScroll(true);
        return;
      }
      setTeleprompterSpeechFollow(false);
      setTeleprompterAutoScroll(false);
    },
    [activeInstructorScript, canEnableSpeechFollow, showInstructorScriptOverlay],
  );
  const teleprompterLineHeightPx = useMemo(
    () => Math.max(18, teleprompterFontSize * 1.45),
    [teleprompterFontSize],
  );
  const teleprompterFocusLineIndex = useMemo(() => {
    if (!teleprompterLineFocus || teleprompterLines.length === 0) return -1;
    const viewportHeight = teleprompterViewportHeight > 0 ? teleprompterViewportHeight : 140;
    const focusAnchor = Math.max(0, teleprompterOffset + viewportHeight * 0.5);
    const candidate = Math.floor(focusAnchor / teleprompterLineHeightPx);
    return Math.max(0, Math.min(teleprompterLines.length - 1, candidate));
  }, [
    teleprompterLineFocus,
    teleprompterLines,
    teleprompterViewportHeight,
    teleprompterOffset,
    teleprompterLineHeightPx,
  ]);

  useEffect(() => {
    setTeleprompterOffset(0);
    teleprompterLastTickRef.current = null;
  }, [activeInstructorScript, previewSlide?.id]);

  useEffect(() => {
    return () => {
      teleprompterSpeechSyncRunRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (activeInstructorScript && showInstructorScriptOverlay) return;
    setTeleprompterSpeechFollow(false);
  }, [activeInstructorScript, showInstructorScriptOverlay]);

  useEffect(() => {
    if (!showInstructorScriptOverlay || !activeInstructorScript) return;
    const viewport = teleprompterViewportRef.current;
    if (!viewport) return;

    const measure = () => {
      setTeleprompterViewportHeight(Math.max(0, viewport.clientHeight || 0));
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [activeInstructorScript, showInstructorScriptOverlay, teleprompterFontSize]);

  useEffect(() => {
    if (
      !showInstructorScriptOverlay ||
      !activeInstructorScript ||
      !teleprompterAutoScroll ||
      teleprompterSpeechFollow ||
      !isPlaying
    ) {
      teleprompterLastTickRef.current = null;
      return;
    }

    let rafId = 0;
    const tick = (timestamp: number) => {
      if (teleprompterLastTickRef.current === null) {
        teleprompterLastTickRef.current = timestamp;
      }
      const delta = Math.max(0, (timestamp - teleprompterLastTickRef.current) / 1000);
      teleprompterLastTickRef.current = timestamp;
      setTeleprompterOffset((prev) => Math.max(0, prev + teleprompterSpeed * delta));
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    activeInstructorScript,
    isPlaying,
    showInstructorScriptOverlay,
    teleprompterAutoScroll,
    teleprompterSpeed,
    teleprompterSpeechFollow,
  ]);

  useEffect(() => {
    if (
      !showInstructorScriptOverlay ||
      !activeInstructorScript ||
      !teleprompterSpeechFollow ||
      !isPlaying ||
      teleprompterAlignedSpeechWords.length === 0 ||
      teleprompterScriptTokens.length === 0
    ) {
      return;
    }

    const speakerFilter =
      teleprompterSpeakerFilter === TELEPROMPTER_SPEAKER_ALL ? '' : teleprompterSpeakerFilter;
    let lastAlignedTokenIndex: number | null = null;

    for (let index = 0; index < teleprompterAlignedSpeechWords.length; index += 1) {
      const word = teleprompterAlignedSpeechWords[index];
      if (word.end > currentTime + 0.04) {
        break;
      }
      if (word.end < previewSlideWindow.start - 0.2) {
        continue;
      }
      if (word.start > previewSlideWindow.end + 0.2) {
        break;
      }
      if (speakerFilter && word.speaker && word.speaker !== speakerFilter) {
        continue;
      }
      if (typeof word.scriptTokenIndex === 'number' && word.scriptTokenIndex >= 0) {
        lastAlignedTokenIndex = word.scriptTokenIndex;
      }
    }

    if (lastAlignedTokenIndex === null) {
      return;
    }
    const mappedLineIndex = teleprompterScriptTokens[lastAlignedTokenIndex]?.lineIndex ?? 0;
    const viewportHeight = teleprompterViewportHeight > 0 ? teleprompterViewportHeight : 140;
    const targetOffset = Math.max(
      0,
      mappedLineIndex * teleprompterLineHeightPx - viewportHeight * 0.5 + teleprompterLineHeightPx * 0.5,
    );
    setTeleprompterOffset((prev) => {
      const diff = targetOffset - prev;
      if (Math.abs(diff) <= 0.5) return prev;
      return prev + diff * 0.38;
    });
  }, [
    activeInstructorScript,
    currentTime,
    isPlaying,
    previewSlideWindow.end,
    previewSlideWindow.start,
    showInstructorScriptOverlay,
    teleprompterAlignedSpeechWords,
    teleprompterLineHeightPx,
    teleprompterScriptTokens,
    teleprompterSpeakerFilter,
    teleprompterSpeechFollow,
    teleprompterViewportHeight,
  ]);
  const previewSlideMode = useMemo(
    () => previewSlide?.layout || selectedDeck?.displayMode || 'picture-in-picture',
    [previewSlide?.layout, selectedDeck?.displayMode],
  );
  const isNavigatorCollapsed = useMemo(() => {
    if (!selectedDeck?.id) return false;
    if (previewSlideMode !== 'split-screen' || !selectedDeck.showNavigator) return false;
    return Boolean(collapsedNavigatorByDeck[selectedDeck.id]);
  }, [collapsedNavigatorByDeck, previewSlideMode, selectedDeck?.id, selectedDeck?.showNavigator]);

  const toggleNavigatorCollapsed = useCallback(() => {
    if (!selectedDeck?.id) return;
    setCollapsedNavigatorByDeck((prev) => ({
      ...prev,
      [selectedDeck.id]: !prev[selectedDeck.id],
    }));
  }, [selectedDeck?.id]);

  const syncVideoSettings = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying && video.paused) {
      void video.play().catch(() => undefined);
    }
    if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    syncVideoSettings();
  }, [syncVideoSettings]);

  const handleLoadedMetadata = useCallback(() => {
    const measured = videoRef.current?.duration;
    if (typeof measured !== 'number' || !Number.isFinite(measured) || measured <= 0) {
      return;
    }
    const nextDuration = Math.max(60, Math.round(measured));
    setDuration(nextDuration);
    setCurrentTime((prev) => Math.min(prev, nextDuration));
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const measuredTime = videoRef.current?.currentTime;
    if (typeof measuredTime !== 'number' || !Number.isFinite(measuredTime)) return;
    setCurrentTime(measuredTime);
  }, []);

  const seekTo = useCallback(
    (value: number, slideId?: string) => {
      const next = clamp(value, 0, duration);
      if (videoRef.current) {
        videoRef.current.currentTime = next;
      }
      setCurrentTime(next);
      if (slideId) {
        setNavigatorSelectedSlideId(slideId);
      }
    },
    [duration],
  );

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      setIsPlaying((prev) => !prev);
      return;
    }
    if (video.paused) {
      setNavigatorSelectedSlideId('');
      void video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
      return;
    }
    video.pause();
    setIsPlaying(false);
  }, []);

  const toggleStudentPreview = useCallback(() => {
    togglePlayback();
  }, [togglePlayback]);

  const resolveTeleprompterSyncVideoPath = useCallback(
    async (sourceUrl: string): Promise<string> => {
      const trimmed = String(sourceUrl || '').trim();
      if (!trimmed) {
        throw new Error(tt('Mangler videokilde for tale-sync.', 'Missing video source for speech sync.'));
      }

      const normalized = trimmed.toLowerCase();
      const isHttpSource = normalized.startsWith('http://') || normalized.startsWith('https://');
      const parsedHttpUrl = (() => {
        if (!isHttpSource) return null;
        try {
          return new URL(trimmed);
        } catch {
          return null;
        }
      })();
      const normalizedHttpPath = String(parsedHttpUrl?.pathname || '').toLowerCase();
      const sameOriginHttpSource =
        Boolean(parsedHttpUrl) &&
        typeof window !== 'undefined' &&
        parsedHttpUrl?.origin === window.location.origin;

      const requiresUpload =
        normalized.startsWith('blob:') ||
        normalized.startsWith('data:') ||
        normalized.startsWith('/api/') ||
        normalized.startsWith('/uploads/') ||
        normalized.startsWith('/media/') ||
        normalized.startsWith('/assets/') ||
        normalizedHttpPath.startsWith('/api/') ||
        normalizedHttpPath.startsWith('/uploads/') ||
        normalizedHttpPath.startsWith('/media/') ||
        normalizedHttpPath.startsWith('/assets/') ||
        sameOriginHttpSource;

      if (isHttpSource && !requiresUpload) {
        return trimmed;
      }

      if (!requiresUpload) {
        return trimmed;
      }

      const sourceResponse = await fetch(trimmed, {
        credentials: 'include',
      });
      if (!sourceResponse.ok) {
        throw new Error(
          tt(
            `Kunne ikke lese videokilde (${sourceResponse.status}).`,
            `Could not read selected video source (${sourceResponse.status}).`,
          ),
        );
      }

      const contentType = (sourceResponse.headers.get('content-type') || '').toLowerCase();
      if (
        !normalized.startsWith('blob:') &&
        (contentType.includes('application/json') ||
          contentType.includes('text/html') ||
          contentType.includes('text/plain'))
      ) {
        throw new Error(
          tt(
            'Kilden ser ikke ut som en direkte videofil.',
            'Selected source does not appear to be a direct media file.',
          ),
        );
      }

      const videoBlob = await sourceResponse.blob();
      if (videoBlob.size <= 0) {
        throw new Error(tt('Videokilden er tom.', 'Video source is empty.'));
      }

      const extensionFromPath = (() => {
        const match = trimmed.match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
        return match ? match[1].toLowerCase() : '';
      })();
      const extensionFromMime = (() => {
        if (contentType.includes('webm')) return 'webm';
        if (contentType.includes('quicktime')) return 'mov';
        if (contentType.includes('x-matroska')) return 'mkv';
        if (contentType.includes('wav')) return 'wav';
        if (contentType.includes('mp3') || contentType.includes('mpeg')) return 'mp3';
        if (contentType.includes('ogg')) return 'ogg';
        if (contentType.includes('aac')) return 'aac';
        if (contentType.includes('flac')) return 'flac';
        return 'mp4';
      })();
      const extension = extensionFromPath || extensionFromMime;
      const formData = new FormData();
      formData.append('video', videoBlob, `academy-teleprompter-source-${Date.now()}.${extension}`);

      const uploadPayload = await apiRequest('/api/video-analysis/upload-source', {
        method: 'POST',
        body: formData,
      });
      if (!isRecord(uploadPayload) || uploadPayload.success !== true) {
        const message =
          (isRecord(uploadPayload) && readStringValue(uploadPayload.error)) ||
          tt('Kunne ikke klargjøre video for tale-sync.', 'Could not prepare video for speech sync.');
        throw new Error(message);
      }
      const videoPath = readStringValue(uploadPayload.video_path);
      if (!videoPath) {
        throw new Error(tt('Mottok ikke videosti for transkripsjon.', 'No video path returned for transcription.'));
      }
      return videoPath;
    },
    [tt],
  );

  const prepareTeleprompterSpeechSync = useCallback(async () => {
    if (!showInstructorScriptOverlay || !activeInstructorScript) {
      setTeleprompterSpeechStatus('error');
      setTeleprompterSpeechError(
        tt('Legg inn manus og slå på manus-overlay for å synke tale.', 'Add script and enable script overlay to sync speech.'),
      );
      return;
    }

    const sourceKey = String(effectiveVideoUrl || '').trim();
    if (!sourceKey) {
      setTeleprompterSpeechStatus('error');
      setTeleprompterSpeechError(tt('Mangler videokilde.', 'Missing video source.'));
      return;
    }

    const cached = teleprompterSpeechCacheRef.current.get(sourceKey);
    if (cached) {
      setTeleprompterSpeechWords(cached.words);
      setTeleprompterSpeechLanguage(cached.language);
      setTeleprompterSpeechProvider(cached.provider);
      setTeleprompterSpeechWarnings(cached.warnings);
      setTeleprompterSpeechSpeakers(cached.speakers);
      setCaptionsVtt(cached.captionsVtt || '');
      setTeleprompterSpeechError('');
      setTeleprompterSpeechStatus('ready');
      return;
    }

    const runId = teleprompterSpeechSyncRunRef.current + 1;
    teleprompterSpeechSyncRunRef.current = runId;
    setTeleprompterSpeechStatus('preparing');
    setTeleprompterSpeechError('');
    setTeleprompterSpeechWarnings([]);
    setTeleprompterSpeechProvider('');
    setTeleprompterSpeechWords([]);
    setTeleprompterSpeechSpeakers([]);
    setTeleprompterSpeechLanguage('auto');
    setCaptionsVtt('');
    setTeleprompterSpeechFollow(false);
    setTeleprompterAutoScroll(false);

    try {
      const resolvedVideoPath = await resolveTeleprompterSyncVideoPath(sourceKey);
      if (teleprompterSpeechSyncRunRef.current !== runId) return;

      const startPayload = await apiRequest('/api/video-analysis/transcribe', {
        method: 'POST',
        body: {
          video_path: resolvedVideoPath,
          language: isNorwegian ? 'no' : 'en',
          model_size: 'base',
          word_timestamps: true,
        },
      });
      if (!isRecord(startPayload) || startPayload.success !== true) {
        const message =
          (isRecord(startPayload) && readStringValue(startPayload.error)) ||
          tt('Kunne ikke starte tale-sync.', 'Could not start speech sync.');
        throw new Error(message);
      }

      const jobId = readStringValue(startPayload.job_id);
      if (!jobId) {
        throw new Error(tt('Mangler jobb-id for tale-sync.', 'Missing job id for speech sync.'));
      }

      for (let attempt = 0; attempt < TELEPROMPTER_SYNC_POLL_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, TELEPROMPTER_SYNC_POLL_INTERVAL_MS));
        if (teleprompterSpeechSyncRunRef.current !== runId) return;

        const statusPayload = await apiRequest(`/api/video-analysis/transcribe/${encodeURIComponent(jobId)}`);
        if (!isRecord(statusPayload)) {
          continue;
        }

        const status = readStringValue(statusPayload.status) || 'processing';
        if (status === 'completed') {
          const resultPayload = isRecord(statusPayload.result) ? statusPayload.result : {};
          const transcriptionPayload = isRecord(resultPayload.transcription)
            ? resultPayload.transcription
            : {};
          const diarizationPayload = Array.isArray(resultPayload.diarization_segments)
            ? resultPayload.diarization_segments
            : [];
          const words = normalizeTeleprompterSpeechWords(transcriptionPayload, diarizationPayload);
          if (words.length === 0) {
            throw new Error(
              tt(
                'Transkripsjon fullførte uten ord-tidsstempler.',
                'Transcription completed without usable word timestamps.',
              ),
            );
          }
          const captionSegments = normalizeCaptionSegments(transcriptionPayload);
          const captionsVttContent = buildVttFromSegments(captionSegments);

          const speakers = Array.from(
            new Set(words.map((entry) => entry.speaker).filter((entry) => entry.length > 0)),
          );
          const warnings = Array.isArray(statusPayload.warnings)
            ? statusPayload.warnings
                .map((entry) => readStringValue(entry))
                .filter((entry) => entry.length > 0)
            : [];
          const provider =
            readStringValue(resultPayload.transcription_provider) ||
            readStringValue(resultPayload.alignment_provider) ||
            'whisperx/pyannote';
          const language = readStringValue(transcriptionPayload.language) || (isNorwegian ? 'no' : 'en');
          const cacheEntry: TeleprompterSpeechCacheEntry = {
            words,
            language,
            provider,
            warnings,
            speakers,
            captionsVtt: captionsVttContent,
          };
          teleprompterSpeechCacheRef.current.set(sourceKey, cacheEntry);

          if (teleprompterSpeechSyncRunRef.current !== runId) return;
          setTeleprompterSpeechWords(words);
          setTeleprompterSpeechLanguage(language);
          setTeleprompterSpeechProvider(provider);
          setTeleprompterSpeechWarnings(warnings);
          setTeleprompterSpeechSpeakers(speakers);
          setCaptionsVtt(captionsVttContent);
          setTeleprompterSpeakerFilter(TELEPROMPTER_SPEAKER_ALL);
          setTeleprompterSpeechStatus('ready');
          setTeleprompterSpeechError('');
          return;
        }

        if (status === 'failed' || status === 'cancelled') {
          const message =
            readStringValue(statusPayload.error) ||
            (status === 'cancelled'
              ? tt('Tale-sync ble avbrutt.', 'Speech sync was cancelled.')
              : tt('Tale-sync feilet.', 'Speech sync failed.'));
          throw new Error(message);
        }
      }

      throw new Error(tt('Tale-sync tok for lang tid.', 'Speech sync timed out.'));
    } catch (error) {
      if (teleprompterSpeechSyncRunRef.current !== runId) return;
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : tt('Klarte ikke synkronisere tale.', 'Unable to sync speech.');
      setTeleprompterSpeechStatus('error');
      setTeleprompterSpeechError(message);
      setTeleprompterSpeechFollow(false);
      setCaptionsVtt('');
    }
  }, [
    activeInstructorScript,
    effectiveVideoUrl,
    isNorwegian,
    resolveTeleprompterSyncVideoPath,
    showInstructorScriptOverlay,
    tt,
  ]);

  const updateSelectedDeck = useCallback(
    (updater: (deck: PresentationDeck) => PresentationDeck) => {
      if (!activeDeckId) return;
      markUserMutation();
      setDecks((prev) =>
        prev.map((deck) => {
          if (deck.id !== activeDeckId) return deck;
          const updatedDeck = updater(deck);
          const deckBrandKit =
            updatedDeck.brandKitId
              ? brandKits.find((kit) => kit.id === updatedDeck.brandKitId) || null
              : null;
          const deckBrandTokens = resolvePresentationBrandTokens(updatedDeck.visualThemeId, deckBrandKit);
          const shouldRegeneratePreviews =
            updatedDeck.visualThemeId !== deck.visualThemeId ||
            updatedDeck.brandKitId !== deck.brandKitId ||
            updatedDeck.name !== deck.name;
          const withHydratedSlides: PresentationDeck = {
            ...updatedDeck,
            slides: Array.isArray(updatedDeck.slides)
              ? updatedDeck.slides.map((slide) =>
                  hydrateSlidePreview(
                    slide,
                    updatedDeck.visualThemeId,
                    updatedDeck.name,
                    {
                      force: shouldRegeneratePreviews,
                      brandTokens: deckBrandTokens,
                      brandKit: deckBrandKit,
                    },
                  ),
                )
              : [],
          };
          return normalizeDeck(
            {
              ...withHydratedSlides,
              updatedAt: new Date().toISOString(),
            },
            duration,
          );
        }),
      );
    },
    [activeDeckId, brandKits, duration, markUserMutation],
  );

  const hydrateDeckWithBrandKit = useCallback(
    (deck: PresentationDeck, brandKit: PresentationBrandKit | null | undefined): PresentationDeck => {
      const nextThemeId = brandKit?.baseThemeId || deck.visualThemeId;
      const brandTokens = resolvePresentationBrandTokens(nextThemeId, brandKit);
      return normalizeDeck(
        {
          ...deck,
          visualThemeId: nextThemeId,
          brandKitId: brandKit?.id || undefined,
          slides: deck.slides.map((slide) =>
            hydrateSlidePreview(slide, nextThemeId, deck.name, {
              force: true,
              brandTokens,
              brandKit,
            }),
          ),
          updatedAt: new Date().toISOString(),
        },
        duration,
      );
    },
    [duration],
  );

  const applyBrandKitToSelectedDeck = useCallback(
    (brandKitId: string) => {
      if (!activeDeckId) return;
      markUserMutation();
      const nextBrandKit = brandKitId ? brandKits.find((kit) => kit.id === brandKitId) || null : null;
      setDecks((prev) =>
        prev.map((deck) => (deck.id === activeDeckId ? hydrateDeckWithBrandKit(deck, nextBrandKit) : deck)),
      );
      setSaveMessage(
        nextBrandKit
          ? tt('Brand kit koblet til valgt presentasjon.', 'Brand kit linked to the selected presentation.')
          : tt('Brand kit fjernet fra valgt presentasjon.', 'Brand kit removed from the selected presentation.'),
      );
    },
    [activeDeckId, brandKits, hydrateDeckWithBrandKit, markUserMutation, tt],
  );

  const createBrandKitFromSelectedDeck = useCallback(() => {
    const baseThemeId = selectedDeck?.visualThemeId || presentationDefaultsForCourse.visualThemeId;
    const nextBrandKit = buildPresentationBrandKitFromTheme(
      baseThemeId,
      `${selectedDeck?.name || tt('Ny presentasjon', 'New presentation')} Brand Kit`,
    );
    setBrandKits((prev) => [nextBrandKit, ...prev]);
    if (activeDeckId) {
      markUserMutation();
      setDecks((prev) =>
        prev.map((deck) => (deck.id === activeDeckId ? hydrateDeckWithBrandKit(deck, nextBrandKit) : deck)),
      );
    }
    setSaveMessage(tt('Nytt brand kit opprettet fra valgt deck.', 'New brand kit created from the selected deck.'));
  }, [
    activeDeckId,
    hydrateDeckWithBrandKit,
    markUserMutation,
    presentationDefaultsForCourse.visualThemeId,
    selectedDeck?.name,
    selectedDeck?.visualThemeId,
    tt,
  ]);

  const updateBrandKit = useCallback(
    (brandKitId: string, updater: (kit: PresentationBrandKit) => PresentationBrandKit) => {
      markUserMutation();
      setBrandKits((prev) => {
        const nextBrandKits = prev.map((kit) => {
          if (kit.id !== brandKitId) return kit;
          const updated = updater(kit);
          return {
            ...updated,
            updatedAt: new Date().toISOString(),
          };
        });
        const updatedBrandKit = nextBrandKits.find((kit) => kit.id === brandKitId) || null;
        setDecks((prevDecks) =>
          prevDecks.map((deck) =>
            deck.brandKitId === brandKitId ? hydrateDeckWithBrandKit(deck, updatedBrandKit) : deck,
          ),
        );
        return nextBrandKits;
      });
    },
    [hydrateDeckWithBrandKit, markUserMutation],
  );

  const deleteBrandKit = useCallback(
    (brandKitId: string) => {
      const deletedBrandKit = brandKits.find((kit) => kit.id === brandKitId) || null;
      markUserMutation();
      setBrandKits((prev) => prev.filter((kit) => kit.id !== brandKitId));
      setDecks((prev) =>
        prev.map((deck) => {
          if (deck.brandKitId !== brandKitId) return deck;
          return hydrateDeckWithBrandKit(
            {
              ...deck,
              visualThemeId: deletedBrandKit?.baseThemeId || deck.visualThemeId,
            },
            null,
          );
        }),
      );
      setSaveMessage(tt('Brand kit slettet.', 'Brand kit deleted.'));
    },
    [brandKits, hydrateDeckWithBrandKit, markUserMutation, tt],
  );

  const buildDesignPlanRequestBody = useCallback(
    (
      deck: PresentationDeck,
      options?: {
        repairFocus?: string[];
      },
    ) => ({
      scope: effectiveScope,
      courseId: resolvedCourseId,
      lessonId: effectiveScope === 'skill' ? String(selectedSkill?.id || '') : '',
      projectTemplateId: activeProjectTemplateId,
      useNorwegian: isNorwegian,
      deckName: deck.name,
      deckTemplate: deck.template,
      templateMemory,
      brandContext: activeBrandContext,
      repairFocus: options?.repairFocus?.slice(0, 8) || [],
      slides: deck.slides.map((slide) => ({
        id: slide.id,
        title: slide.title,
        startTime: slide.startTime,
        duration: slide.duration,
        layout: slide.layout,
        speakerNotes: slide.speakerNotes,
        textLines: collectSlideBodyLines(slide),
      })),
    }),
    [
      activeBrandContext,
      activeProjectTemplateId,
      effectiveScope,
      isNorwegian,
      resolvedCourseId,
      selectedSkill?.id,
      templateMemory,
    ],
  );

  const toAbsolutePresentationAssetUrl = useCallback((url: string): string => {
    const trimmed = String(url || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
    if (typeof window === 'undefined') return trimmed;
    try {
      return new URL(trimmed, window.location.origin).toString();
    } catch {
      return trimmed;
    }
  }, []);

  const generatePresentationVideoPoster = useCallback(async (videoUrl: string): Promise<string | null> => {
    const absoluteUrl = toAbsolutePresentationAssetUrl(videoUrl);
    if (!absoluteUrl || typeof document === 'undefined') return null;
    const cacheKey = absoluteUrl.trim().toLowerCase();
    const cached = videoPosterCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    try {
      const metadataLoaded = new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          cleanupListeners();
          resolve();
        };
        const onError = () => {
          cleanupListeners();
          reject(new Error('video-metadata-failed'));
        };
        const cleanupListeners = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('error', onError);
        };
        video.addEventListener('loadedmetadata', onLoaded, { once: true });
        video.addEventListener('error', onError, { once: true });
      });

      video.src = absoluteUrl;
      await metadataLoaded;

      const targetTime = Math.max(
        0.1,
        Math.min(
          Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 0.15 : 0.8,
          2.5,
        ),
      );

      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          cleanupListeners();
          resolve();
        };
        const onError = () => {
          cleanupListeners();
          reject(new Error('video-seek-failed'));
        };
        const cleanupListeners = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
        };
        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.currentTime = targetTime;
      });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(320, video.videoWidth || 640);
      canvas.height = Math.max(180, video.videoHeight || 360);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        cleanup();
        return null;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const poster = canvas.toDataURL('image/jpeg', 0.84);
      if (poster) {
        videoPosterCacheRef.current.set(cacheKey, poster);
      }
      cleanup();
      return poster || null;
    } catch {
      cleanup();
      return null;
    }
  }, [toAbsolutePresentationAssetUrl]);

  const resolveLocalPresentationVisualUrl = useCallback(
    async (candidate: PresentationLocalVisualAssetCandidate): Promise<string> => {
      if (candidate.assetKind === 'video-poster') {
        const absoluteUrl = toAbsolutePresentationAssetUrl(candidate.url);
        if (
          absoluteUrl.startsWith('data:image/') ||
          /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(absoluteUrl)
        ) {
          return absoluteUrl;
        }
        const poster = await generatePresentationVideoPoster(candidate.url);
        if (poster) return poster;
      }
      return toAbsolutePresentationAssetUrl(candidate.url);
    },
    [generatePresentationVideoPoster, toAbsolutePresentationAssetUrl],
  );

  const searchPresentationReferenceAsset = useCallback(
    async ({
      queries,
      kind,
      preferredSources,
      grammarId,
    }: {
      queries: string[];
      kind: PresentationDesignGraphicSlot['kind'];
      preferredSources?: string[];
      grammarId?: SharedPresentationSlideGrammarId;
    }): Promise<{ url: string; source: string } | null> => {
      const normalizedQueries = Array.from(
        new Set(
          queries
            .map((entry) => String(entry || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean),
        ),
      ).slice(0, 3);
      if (normalizedQueries.length === 0) return null;

      const providerScore = (source: string): number => {
        const normalized = String(source || '').trim().toLowerCase();
        const preferredIndex = (preferredSources || []).findIndex(
          (entry) => String(entry || '').trim().toLowerCase() === normalized,
        );
        const preferredBonus =
          preferredIndex >= 0 ? Math.max(0, 1.4 - preferredIndex * 0.2) : 0;
        if (normalized === 'unsplash') return 4 + preferredBonus;
        if (normalized === 'pexels') return 3.7 + preferredBonus;
        if (normalized === 'pixabay') return 3.2 + preferredBonus;
        if (normalized === 'cache') return 5 + preferredBonus;
        if (normalized === 'reference') return 2.2 + preferredBonus;
        if (normalized === 'video-poster') return 2.6 + preferredBonus;
        return preferredBonus;
      };

      const normalizeTokens = (value: string): string[] =>
        String(value || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s-]/g, ' ')
          .split(/\s+/)
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 2);

      let bestMatch: { url: string; source: string; score: number } | null = null;

      const localScopeScore = (candidate: PresentationLocalVisualAssetCandidate): number => {
        if (kind === 'screenshot') {
          const typePenalty = candidate.assetKind === 'video-poster' ? 0.35 : 0;
          if (candidate.scope === 'selected-skill') return (candidate.uploaded ? 4.2 : 3.4) - typePenalty;
          if (candidate.scope === 'course') return (candidate.uploaded ? 3.1 : 2.5) - typePenalty;
          if (candidate.scope === 'other-skill') return (candidate.uploaded ? 2.2 : 1.8) - typePenalty;
          if (candidate.scope === 'lesson-thumbnail') return 1.45;
          return 1.05;
        }
        if (candidate.scope === 'selected-skill') return candidate.uploaded ? 2.4 : 1.9;
        if (candidate.scope === 'course') return candidate.uploaded ? 1.8 : 1.45;
        if (candidate.scope === 'other-skill') return candidate.uploaded ? 1.2 : 1.0;
        if (candidate.scope === 'lesson-thumbnail') return 0.8;
        return 0.65;
      };

      const localFolderBonus = (candidate: PresentationLocalVisualAssetCandidate): number => {
        const folderTag = String(candidate.folderTag || '').trim().toLowerCase();
        if (!folderTag) return 0;
        if (kind === 'screenshot') {
          if (/(course-materials|tutorials)/.test(folderTag)) return 0.55;
          if (candidate.assetKind === 'video-poster' && /lesson-videos/.test(folderTag)) return 0.2;
          if (/(lesson-videos|quiz-assets|certificates)/.test(folderTag)) return -0.15;
        }
        if (grammarId === 'interactive-quiz' && /quiz-assets/.test(folderTag)) return 0.55;
        return 0;
      };

      for (const normalizedQuery of normalizedQueries) {
        const cacheKey = `${kind}:${String(grammarId || '')}:${normalizedQuery.toLowerCase()}`;
        const cached = visualSearchCacheRef.current.get(cacheKey);
        if (cached) {
          const cachedScore = providerScore(cached.source) + 1;
          if (!bestMatch || cachedScore > bestMatch.score) {
            bestMatch = { ...cached, score: cachedScore };
          }
          continue;
        }

        const queryTokens = normalizeTokens(normalizedQuery);
        const localCandidate = presentationLocalVisualAssets
          .map((candidate) => {
            const candidateTokens = normalizeTokens(
              `${candidate.title} ${candidate.description} ${candidate.folderTag || ''} ${candidate.scope} ${candidate.source}`,
            );
            const overlap =
              queryTokens.length > 0
                ? queryTokens.filter((token) => candidateTokens.includes(token)).length / queryTokens.length
                : 0;
            const sourceBonus = localScopeScore(candidate) + providerScore(candidate.source);
            return {
              candidate,
              score: overlap * 3 + sourceBonus + localFolderBonus(candidate),
            };
          })
          .sort((left, right) => right.score - left.score)[0];

        if (localCandidate && localCandidate.score >= (kind === 'screenshot' ? 2.2 : 1.6)) {
          const absolute = await resolveLocalPresentationVisualUrl(localCandidate.candidate);
          visualSearchCacheRef.current.set(cacheKey, {
            url: absolute,
            source: localCandidate.candidate.source,
          });
          if (!bestMatch || localCandidate.score > bestMatch.score) {
            bestMatch = {
              url: absolute,
              source: localCandidate.candidate.source,
              score: localCandidate.score,
            };
          }
          if (kind === 'screenshot') {
            continue;
          }
        }

        if (kind === 'screenshot') {
          continue;
        }

        const endpoints = [
          `/api/unsplash/search?q=${encodeURIComponent(normalizedQuery)}&per_page=6&orientation=landscape&intent=presentation`,
          `/api/pexels/search?q=${encodeURIComponent(normalizedQuery)}&per_page=6&intent=presentation`,
          `/api/pixabay/search?q=${encodeURIComponent(normalizedQuery)}&per_page=6`,
        ];

        const payloads = await Promise.all(
          endpoints.map(async (endpoint) => {
            try {
              const response = await fetch(endpoint, { credentials: 'include' });
              if (!response.ok) return null;
              return (await response.json()) as {
                results?: PresentationReferenceImageResult[];
                source?: string;
              };
            } catch {
              return null;
            }
          }),
        );

        const ranked = payloads
          .flatMap((payload) => {
            if (!payload || !Array.isArray(payload.results)) return [];
            return payload.results
              .filter((entry) => Boolean(entry?.url))
              .map((entry) => {
                const source = String(entry.source || payload.source || 'reference').trim() || 'reference';
                const normalizedSource = source.toLowerCase();
                if (normalizedSource === 'picsum') return null;
                const candidateText = normalizeTokens(
                  `${entry.description || ''} ${entry.attribution || ''} ${entry.photographer || ''} ${entry.source || ''}`,
                );
                const overlap =
                  queryTokens.length > 0
                    ? queryTokens.filter((token) => candidateText.includes(token)).length / queryTokens.length
                    : 0;
                const score =
                  providerScore(source) +
                  overlap * 1.6 +
                  (String(entry.description || '').trim() ? 0.25 : 0) +
                  (String(entry.photographer || '').trim() ? 0.1 : 0);
                return {
                  entry,
                  source,
                  score,
                };
              })
              .filter(
                (
                  candidate,
                ): candidate is {
                  entry: PresentationReferenceImageResult;
                  source: string;
                  score: number;
                } => Boolean(candidate),
              );
          })
          .sort((left, right) => right.score - left.score);

        const winner = ranked[0];
        if (!winner?.entry?.url) {
          continue;
        }
        const proxied = `/api/shotcafe/image-proxy?url=${encodeURIComponent(String(winner.entry.url).trim())}`;
        const absolute = toAbsolutePresentationAssetUrl(proxied);
        visualSearchCacheRef.current.set(cacheKey, {
          url: absolute,
          source: winner.source,
        });
        if (!bestMatch || winner.score > bestMatch.score) {
          bestMatch = {
            url: absolute,
            source: winner.source,
            score: winner.score,
          };
        }
      }

      return bestMatch ? { url: bestMatch.url, source: bestMatch.source } : null;
    },
    [presentationLocalVisualAssets, resolveLocalPresentationVisualUrl, toAbsolutePresentationAssetUrl],
  );

  const resolveDesignPlanVisualAssets = useCallback(
    async (plan: PresentationDesignPlan): Promise<PresentationDesignPlan> => {
      const slides = await Promise.all(
        plan.slides.map(async (slidePlan) => {
          const graphicSlots = await Promise.all(
            slidePlan.graphicSlots.map(async (slot) => {
              const graphicPlan = buildPresentationGraphicPlan({
                slot,
                structuredContent: slidePlan.structuredContent,
                theme: activeVisualThemeColors,
                grammarId: slidePlan.grammarId,
              });
              if (!graphicPlan.prefersReferenceAsset) {
                return slot;
              }
              if (String(slot.resolvedAssetUrl || '').trim()) {
                return {
                  ...slot,
                  resolvedAssetUrl: toAbsolutePresentationAssetUrl(String(slot.resolvedAssetUrl || '').trim()),
                };
              }
              const resolved = await searchPresentationReferenceAsset(
                {
                  queries:
                    graphicPlan.referenceQueries.length > 0
                      ? graphicPlan.referenceQueries
                      : buildPresentationReferenceQueries({
                          slot,
                          structuredContent: slidePlan.structuredContent,
                          theme: activeVisualThemeColors,
                          grammarId: slidePlan.grammarId,
                        }),
                  kind: slot.kind,
                  preferredSources: graphicPlan.preferredSources,
                  grammarId: slidePlan.grammarId,
                },
              );
              if (!resolved) return slot;
              return {
                ...slot,
                resolvedAssetUrl: resolved.url,
                assetSource: resolved.source,
              };
            }),
          );
          return {
            ...slidePlan,
            graphicSlots,
          };
        }),
      );
      return {
        ...plan,
        slides,
      };
    },
    [activeVisualThemeColors, searchPresentationReferenceAsset, toAbsolutePresentationAssetUrl],
  );

  const fetchBackendDesignPlan = useCallback(
    async (
      deck: PresentationDeck,
      options?: {
        repairFocus?: string[];
      },
    ): Promise<PresentationDesignPlan> => {
      const response = await apiRequest('/api/academy/presentation/design-plan', {
        method: 'POST',
        body: buildDesignPlanRequestBody(deck, options),
      });
      const parsed = parseDesignPlan(response);
      if (!parsed) {
        throw new Error(
          tt(
            'Design-plan respons kunne ikke tolkes.',
            'Could not parse design plan response.',
          ),
        );
      }
      return parsed;
    },
    [buildDesignPlanRequestBody, tt],
  );

  const buildCritiqueRequestBody = useCallback(
    (deck: PresentationDeck) => {
      const critiquePlan =
        designPlan &&
        deck.slides.every((slide) => designPlan.slides.some((entry) => entry.slideId === slide.id))
          ? designPlan
          : buildLocalDesignPlanFallback({
              deck,
              scope: effectiveScope,
              courseId: resolvedCourseId,
              lessonId: effectiveScope === 'skill' ? String(selectedSkill?.id || '') : '',
              projectTemplateId: activeProjectTemplateId,
              useNorwegian: isNorwegian,
            });
      const planBySlideId = new Map(critiquePlan.slides.map((entry) => [entry.slideId, entry]));
      return {
        scope: effectiveScope,
        courseId: resolvedCourseId,
        lessonId: effectiveScope === 'skill' ? String(selectedSkill?.id || '') : '',
        projectTemplateId: activeProjectTemplateId,
        useNorwegian: isNorwegian,
        deckName: deck.name,
        brandContext: activeBrandContext,
        slides: deck.slides.map((slide) => {
          const planForSlide =
            planBySlideId.get(slide.id) ||
            buildLocalDesignPlanFallback({
              deck: { ...deck, slides: [slide] },
              scope: effectiveScope,
              courseId: resolvedCourseId,
              lessonId: effectiveScope === 'skill' ? String(selectedSkill?.id || '') : '',
              projectTemplateId: activeProjectTemplateId,
              useNorwegian: isNorwegian,
            }).slides[0];
          return {
            slideId: slide.id,
            title: slide.title,
            visualType: planForSlide.visualType,
            grammarId: planForSlide.grammarId,
            layout: slide.layout,
            previewImageUrl: slide.previewImageUrl || '',
            structuredContent: planForSlide.structuredContent,
            contentBudget: planForSlide.contentBudget,
            visualNeeds: planForSlide.visualNeeds,
          };
        }),
      };
    },
    [
      activeBrandContext,
      activeProjectTemplateId,
      designPlan,
      effectiveScope,
      isNorwegian,
      resolvedCourseId,
      selectedSkill?.id,
    ],
  );

  const requestDeckCritique = useCallback(
    async (deck: PresentationDeck): Promise<PresentationAiCritiqueResult> => {
      const response = await apiRequest('/api/academy/presentation/critique', {
        method: 'POST',
        body: buildCritiqueRequestBody(deck),
      });
      const parsed = parseAiCritique(response);
      if (!parsed) {
        throw new Error(
          tt(
            'AI-kritikk kunne ikke tolkes.',
            'Could not parse AI critique response.',
          ),
        );
      }
      return parsed;
    },
    [buildCritiqueRequestBody, tt],
  );

  const selectPreferredRepairPlan = useCallback(
    async (
      deck: PresentationDeck,
      options?: {
        repairFocus?: string[];
      },
    ): Promise<{ plan: PresentationDesignPlan; source: 'backend' | 'local' }> => {
      const localPlan = buildLocalDesignPlanFallback({
        deck,
        scope: effectiveScope,
        courseId: resolvedCourseId,
        lessonId: effectiveScope === 'skill' ? String(selectedSkill?.id || '') : '',
        projectTemplateId: activeProjectTemplateId,
        useNorwegian: isNorwegian,
      });
      const deckUpdatedAtMs = Date.parse(String(deck.updatedAt || ''));
      const hasRepairFocus = Boolean(options?.repairFocus && options.repairFocus.length > 0);

      if (designPlan && !hasRepairFocus) {
        const currentPlanGeneratedAtMs = Date.parse(String(designPlan.generatedAt || ''));
        const currentPlanCoversAllSlides = deck.slides.every((slide) =>
          designPlan.slides.some((entry) => entry.slideId === slide.id),
        );
        if (
          currentPlanCoversAllSlides &&
          Number.isFinite(currentPlanGeneratedAtMs) &&
          (!Number.isFinite(deckUpdatedAtMs) || currentPlanGeneratedAtMs >= deckUpdatedAtMs)
        ) {
          return {
            plan: await resolveDesignPlanVisualAssets(designPlan),
            source: 'backend',
          };
        }
      }

      try {
        const remotePlan = await fetchBackendDesignPlan(deck, options);
        const remoteGeneratedAtMs = Date.parse(String(remotePlan.generatedAt || ''));
        const remoteCoversAllSlides = deck.slides.every((slide) =>
          remotePlan.slides.some((entry) => entry.slideId === slide.id),
        );
        if (
          remoteCoversAllSlides &&
          (hasRepairFocus ||
            (Number.isFinite(remoteGeneratedAtMs) &&
              (!Number.isFinite(deckUpdatedAtMs) || remoteGeneratedAtMs >= deckUpdatedAtMs)))
        ) {
          return {
            plan: await resolveDesignPlanVisualAssets(remotePlan),
            source: 'backend',
          };
        }
      } catch {
        // Use local grammar plan when backend plan is unavailable or stale.
      }

      return {
        plan: await resolveDesignPlanVisualAssets(localPlan),
        source: 'local',
      };
    },
    [
      activeProjectTemplateId,
      designPlan,
      effectiveScope,
      fetchBackendDesignPlan,
      isNorwegian,
      resolveDesignPlanVisualAssets,
      resolvedCourseId,
      selectedSkill?.id,
    ],
  );

  const applyTemplate = useCallback(
    (templateId: PresentationTemplateId) => {
      const preset = templatePresets.find((item) => item.id === templateId) || templatePresets[0];

      if (!selectedDeck) {
        const themeId = presentationDefaultsForCourse.visualThemeId;
        const nextDeck = createContextualDeckFromContext(
          templateId,
          activeCourse,
          effectiveScope === 'skill' ? selectedSkill : null,
          duration,
          isNorwegian,
          themeId,
          'balanced',
        );
        markUserMutation();
        setDecks((prev) => [nextDeck, ...prev]);
        setSelectedDeckId(nextDeck.id);
        setSaveMessage(tt('Template er lagt til i ny presentasjon.', 'Template added to new presentation.'));
        return;
      }

      updateSelectedDeck((deck) => ({
        ...deck,
        template: preset.id,
        displayMode: preset.defaultMode,
        splitLayoutVariant:
          preset.defaultMode === 'split-screen'
            ? deck.splitLayoutVariant || 'balanced'
            : 'balanced',
        showNavigator: false,
        placement: toPlacement(preset.defaultPlacement),
        slides: buildTemplateSlides(preset.id, duration, isNorwegian, deck.visualThemeId, deck.name),
      }));

      setSaveMessage(tt('Template brukt på valgt presentasjon.', 'Template applied to selected presentation.'));
    },
    [
      duration,
      effectiveScope,
      activeCourse,
      isNorwegian,
      markUserMutation,
      presentationDefaultsForCourse.visualThemeId,
      selectedDeck,
      selectedSkill,
      tt,
      updateSelectedDeck,
    ],
  );

  const handleUploadClick = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  const handleUploadFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const lowerName = file.name.toLowerCase();
      const supported =
        lowerName.endsWith('.ppt') ||
        lowerName.endsWith('.pptx') ||
        lowerName.endsWith('.pdf');

      if (!supported) {
        setSaveMessage(
          tt(
            'Stotter kun .ppt, .pptx og .pdf for presentasjonsverktøyet.',
            'Only .ppt, .pptx, and .pdf are supported for the presentation tool.',
          ),
        );
        event.target.value = '';
        return;
      }

      const uploadThemeId = selectedDeck?.visualThemeId || presentationDefaultsForCourse.visualThemeId;
      const uploadSplitVariant =
        selectedDeck?.splitLayoutVariant || presentationDefaultsForCourse.splitLayoutVariant;
      const uploadTemplate = selectedDeck?.template || presentationDefaultsForCourse.templateId;

      const parsedSlides = await parsePptxSlides(file, duration, isNorwegian, uploadThemeId);
      const sourceUrl = URL.createObjectURL(file);

      if (parsedSlides && parsedSlides.length > 0) {
        const fallbackDeck = createDeckFromTemplate(
          uploadTemplate,
          duration,
          isNorwegian,
          file.name,
          file.type,
          uploadThemeId,
          uploadSplitVariant,
        );
        const importedDeck = normalizeDeck(
          {
            ...fallbackDeck,
            name: file.name,
            sourceName: file.name,
            sourceType: file.type,
            sourceUrl,
            slides: parsedSlides,
          },
          duration,
        );
        markUserMutation();
        setDecks((prev) => [importedDeck, ...prev]);
        setSelectedDeckId(importedDeck.id);
      } else if (!selectedDeck) {
        const nextDeck = createDeckFromTemplate(
          uploadTemplate,
          duration,
          isNorwegian,
          file.name,
          file.type,
          uploadThemeId,
          uploadSplitVariant,
        );
        nextDeck.sourceUrl = sourceUrl;
        markUserMutation();
        setDecks((prev) => [nextDeck, ...prev]);
        setSelectedDeckId(nextDeck.id);
      } else {
        updateSelectedDeck((deck) => ({
          ...deck,
          name: deck.name || file.name,
          sourceName: file.name,
          sourceType: file.type,
          sourceUrl,
        }));
      }

      setSaveMessage(
        tt(
          'Presentasjonen er lastet opp og gjort om til redigerbare scener. Velg layout per scene og finjuster elementer/manus.',
          'Presentation uploaded and converted to editable scenes. Choose scene layouts and refine elements/script.',
        ),
      );

      event.target.value = '';
    },
    [
      duration,
      isNorwegian,
      markUserMutation,
      presentationDefaultsForCourse.splitLayoutVariant,
      presentationDefaultsForCourse.templateId,
      presentationDefaultsForCourse.visualThemeId,
      selectedDeck,
      tt,
      updateSelectedDeck,
    ],
  );

  const addDeck = useCallback(() => {
    const nextDeck = createContextualDeckFromContext(
      presentationDefaultsForCourse.templateId,
      activeCourse,
      effectiveScope === 'skill' ? selectedSkill : null,
      duration,
      isNorwegian,
      presentationDefaultsForCourse.visualThemeId,
      presentationDefaultsForCourse.splitLayoutVariant,
    );
    markUserMutation();
    setDecks((prev) => [nextDeck, ...prev]);
    setSelectedDeckId(nextDeck.id);
    setSaveMessage(tt('Ny presentasjon opprettet.', 'New presentation created.'));
  }, [
    activeCourse,
    duration,
    effectiveScope,
    isNorwegian,
    markUserMutation,
    presentationDefaultsForCourse,
    selectedSkill,
    tt,
  ]);

  const removeDeck = useCallback(
    (deckId?: string) => {
      const targetId = deckId || selectedDeck?.id;
      if (!targetId) return;
      markUserMutation();
      setDecks((prev) => {
        const next = prev.filter((deck) => deck.id !== targetId);
        setSelectedDeckId(next[0]?.id || '');
        return next;
      });
      setSaveMessage(tt('Presentasjon fjernet.', 'Presentation removed.'));
    },
    [markUserMutation, selectedDeck?.id, tt],
  );

  const addSlide = useCallback(() => {
    if (!selectedDeck) return;
    updateSelectedDeck((deck) => {
      let startTime = Number.isFinite(currentTime) ? currentTime : 0;
      if (timelineSnapEnabled) {
        startTime = roundHalfSecond(startTime);
      }
      if (snapToPlayheadEnabled && Math.abs(startTime - currentTime) <= 0.35) {
        startTime = currentTime;
      }
      startTime = clamp(startTime, 0, Math.max(0, duration - 4));
      const maxDuration = Math.max(1, duration - startTime);
      const layout = deck.displayMode;
      const title = tt(`Ny slide ${deck.slides.length + 1}`, `New slide ${deck.slides.length + 1}`);
      const nextSlideDraft: PresentationSlide = {
        id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sourceSlideNumber: deck.slides.length + 1,
        title,
        startTime,
        duration: clamp(8, 1, maxDuration),
        instructorId: defaultInstructorId || undefined,
        layout,
        speakerNotes: '',
        elements: buildDefaultSlideElements(title, layout),
      };
      const nextSlide = hydrateSlidePreview(nextSlideDraft, deck.visualThemeId, deck.name);
      return {
        ...deck,
        slides: [...deck.slides, nextSlide],
      };
    });
  }, [
    currentTime,
    defaultInstructorId,
    duration,
    selectedDeck,
    snapToPlayheadEnabled,
    timelineSnapEnabled,
    tt,
    updateSelectedDeck,
  ]);

  const updateSlideField = useCallback(
    <K extends keyof PresentationSlide>(
      slideId: string,
      field: K,
      value: PresentationSlide[K],
    ) => {
      if (field === 'instructorId') {
        trackPresentationEvent('academy_presentation_slide_instructor_changed', {
          slideId,
          instructorId: String(value || '').trim() || null,
        });
      }
      updateSelectedDeck((deck) => ({
        ...deck,
        slides: deck.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          let nextValue: PresentationSlide[K] = value;
          if (field === 'startTime') {
            let snapped = Number.isFinite(Number(value)) ? Number(value) : 0;
            if (timelineSnapEnabled) {
              snapped = roundHalfSecond(snapped);
            }
            if (snapToPlayheadEnabled && Math.abs(snapped - currentTime) <= 0.35) {
              snapped = currentTime;
            }
            nextValue = clamp(snapped, 0, Math.max(0, duration - 1)) as PresentationSlide[K];
          } else if (field === 'duration') {
            const numeric = Number(value);
            const snapped = timelineSnapEnabled ? roundHalfSecond(numeric) : numeric;
            nextValue = Math.max(1, snapped) as PresentationSlide[K];
          } else if (field === 'instructorId') {
            const cleaned = String(value || '').trim();
            nextValue = (cleaned || undefined) as PresentationSlide[K];
          }
          const next = { ...slide, [field]: nextValue };
          const normalized = normalizeSlide(next, duration);
          return hydrateSlidePreview(normalized, deck.visualThemeId, deck.name);
        }),
      }));
    },
    [
      currentTime,
      duration,
      snapToPlayheadEnabled,
      timelineSnapEnabled,
      trackPresentationEvent,
      updateSelectedDeck,
    ],
  );

  const updateSlideElementText = useCallback(
    (slideId: string, elementId: string, value: string) => {
      updateSelectedDeck((deck) => ({
        ...deck,
        slides: deck.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          const nextSlide: PresentationSlide = {
            ...slide,
            elements: slide.elements.map((element) =>
              element.id === elementId ? { ...element, text: value } : element,
            ),
          };
          return hydrateSlidePreview(nextSlide, deck.visualThemeId, deck.name);
        }),
      }));
    },
    [updateSelectedDeck],
  );

  const moveSlideElementLayer = useCallback(
    (slideId: string, elementId: string, direction: 'up' | 'down') => {
      updateSelectedDeck((deck) => ({
        ...deck,
        slides: deck.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          const index = slide.elements.findIndex((element) => element.id === elementId);
          if (index === -1) return slide;
          const nextIndex = direction === 'up' ? index - 1 : index + 1;
          if (nextIndex < 0 || nextIndex >= slide.elements.length) return slide;
          const nextElements = [...slide.elements];
          const [moved] = nextElements.splice(index, 1);
          nextElements.splice(nextIndex, 0, moved);
          const nextSlide: PresentationSlide = {
            ...slide,
            elements: nextElements,
          };
          return hydrateSlidePreview(nextSlide, deck.visualThemeId, deck.name);
        }),
      }));
    },
    [updateSelectedDeck],
  );

  const updateSlideBodyText = useCallback(
    (slideId: string, value: string) => {
      const nextText = String(value || '').trim();
      updateSelectedDeck((deck) => ({
        ...deck,
        slides: deck.slides.map((slide) => {
          if (slide.id !== slideId) return slide;

          const normalizedTitle = String(slide.title || '').trim().toLowerCase();
          const targetElement = slide.elements.find((element) => {
            if (element.type !== 'text') return false;
            const text = String(element.text || '').trim();
            return text.length > 0 && text.toLowerCase() !== normalizedTitle;
          });

          if (targetElement) {
            const nextSlide: PresentationSlide = {
              ...slide,
              elements: slide.elements.map((element) =>
                element.id === targetElement.id
                  ? { ...element, text: nextText }
                  : element,
              ),
            };
            return hydrateSlidePreview(nextSlide, deck.visualThemeId, deck.name);
          }

          const nextSlide: PresentationSlide = {
            ...slide,
            elements: [
              ...slide.elements,
              {
                id: `${slide.id}-text-body-${Date.now().toString(36)}`,
                type: 'text',
                text: nextText,
                x: slide.layout === 'split-screen' ? 10 : 12,
                y: 30,
                width: slide.layout === 'split-screen' ? 52 : 74,
                height: 24,
              },
            ],
          };
          return hydrateSlidePreview(nextSlide, deck.visualThemeId, deck.name);
        }),
      }));
    },
    [updateSelectedDeck],
  );

  const applyDesignPlanPayload = useCallback(
    (
      plan: PresentationDesignPlan,
      targetSlideId?: string,
      options?: { silent?: boolean; source?: 'manual' | 'auto' | 'fallback' | 'repair' },
    ) => {
      if (!selectedDeck) return;
      const planBySlide = new Map(plan.slides.map((slidePlan) => [slidePlan.slideId, slidePlan]));
      const applyAll = !targetSlideId;
      const appliedCount = applyAll
        ? selectedDeck.slides.filter((slide) => planBySlide.has(slide.id)).length
        : targetSlideId && planBySlide.has(targetSlideId)
          ? 1
          : 0;

      updateSelectedDeck((deck) => {
        const activeBrandKit = deck.brandKitId ? brandKits.find((kit) => kit.id === deck.brandKitId) || null : null;
        const nextDeckDisplayMode = applyAll ? plan.recommendedDisplayMode : deck.displayMode;
        const nextDeckSplitVariant =
          nextDeckDisplayMode === 'split-screen'
            ? applyAll
              ? plan.recommendedSplitLayoutVariant
              : deck.splitLayoutVariant
            : 'balanced';
        const baseSlides = deck.slides.filter((slide) => {
          const slideId = String(slide.id || '');
          if (!slideId.includes('--auto-cont-')) return true;
          const ownerSlideId = slideId.split('--auto-cont-')[0];
          if (!targetSlideId) return false;
          return ownerSlideId !== targetSlideId;
        });

        const nextThemeId = activeBrandKit?.baseThemeId || (applyAll ? plan.recommendedVisualThemeId : deck.visualThemeId);
        const nextBrandTokens = resolvePresentationBrandTokens(nextThemeId, activeBrandKit);
        const rebuiltSlides = baseSlides.flatMap((slide) => {
          if (targetSlideId && slide.id !== targetSlideId) return [slide];
          const slidePlan = planBySlide.get(slide.id);
          if (!slidePlan) return [slide];

          const layout = toDisplayMode(
            String(slidePlan.recommendedLayout || slide.layout || deck.displayMode),
          );
          const draftSlide: PresentationSlide = {
            ...slide,
            title: String(slidePlan.structuredContent.title || slidePlan.copySuggestions.title || slide.title).trim() || slide.title,
            layout,
            speakerNotes: buildSpeakerNotesFromStructuredContent(slidePlan.structuredContent),
            elements: buildElementsFromStructuredSlidePlan(
              {
                ...slide,
                layout,
              },
              slidePlan,
              nextThemeId,
              nextBrandTokens,
            ),
            previewImageUrl: '',
            thumbnailImageUrl: '',
          };
          const hydratedSlide = hydrateSlidePreview(
            normalizeSlide(draftSlide, duration),
            nextThemeId,
            deck.name,
            { force: true, brandTokens: nextBrandTokens, brandKit: activeBrandKit },
          );

          const continuationSlide = slidePlan.continuation
            ? buildContinuationSlide(
                hydratedSlide,
                slidePlan.continuation,
                isNorwegian,
                nextThemeId,
                deck.name,
                nextBrandTokens,
                activeBrandKit,
              )
            : null;

          return continuationSlide ? [hydratedSlide, continuationSlide] : [hydratedSlide];
        });

        const nextSlides = reflowDeckSlidesForTimeline(rebuiltSlides, duration).map((slide) =>
          hydrateSlidePreview(slide, nextThemeId, deck.name, {
            force: true,
            brandTokens: nextBrandTokens,
            brandKit: activeBrandKit,
          }),
        );
        const nextSourceType =
          deck.sourceType === 'auto-context' &&
          (options?.source === 'auto' || options?.source === 'fallback')
            ? 'auto-context-ready'
            : deck.sourceType;

        return {
          ...deck,
          template: applyAll ? plan.recommendedTemplateId : deck.template,
          visualThemeId: nextThemeId,
          displayMode: nextDeckDisplayMode,
          splitLayoutVariant: nextDeckSplitVariant,
          showNavigator: false,
          sourceType: nextSourceType,
          slides: nextSlides,
        };
      });

      if (appliedCount === 0) {
        if (!options?.silent) {
          setSaveMessage(
            tt(
              'Ingen matching slides funnet i design-planen.',
              'No matching slides found in this design plan.',
            ),
          );
        }
        return;
      }

      if (!options?.silent) {
        setSaveMessage(
          applyAll
            ? tt(
                `Design-plan brukt på ${appliedCount} slides.`,
                `Applied design plan to ${appliedCount} slides.`,
              )
            : tt('Design-plan brukt på slide.', 'Applied design plan to slide.'),
        );
      }
      trackPresentationEvent('academy_presentation_design_plan_applied', {
        applyAll,
        appliedCount,
        source: options?.source || 'manual',
      });
    },
    [brandKits, duration, isNorwegian, selectedDeck, trackPresentationEvent, tt, updateSelectedDeck],
  );

  const generateDesignPlan = useCallback(async () => {
    if (!selectedDeck) {
      setSaveMessage(tt('Velg en presentasjon først.', 'Select a presentation first.'));
      return;
    }

    try {
      setDesignPlanBusy(true);
      setDesignPlanError('');
      setAiCritique(null);
      setAiCritiqueError('');
      const parsed = await fetchBackendDesignPlan(selectedDeck);
      const resolvedPlan = await resolveDesignPlanVisualAssets(parsed);
      setDesignPlan(resolvedPlan);
      applyDesignPlanPayload(resolvedPlan, undefined, { silent: true, source: 'auto' });
      setSaveMessage(
        tt(
          `Design-plan generert og brukt på ${resolvedPlan.slides.length} slides.`,
          `Design plan generated and applied to ${resolvedPlan.slides.length} slides.`,
        ),
      );
      trackPresentationEvent('academy_presentation_design_plan_generated', {
        slideCount: resolvedPlan.slides.length,
        template: resolvedPlan.recommendedTemplateId,
      });
    } catch (error) {
      const fallbackEligible =
        error instanceof Error &&
        (/\b404\b/.test(error.message) ||
          /endpoint not implemented/i.test(error.message));
      if (fallbackEligible && selectedDeck) {
        const fallbackPlan = buildLocalDesignPlanFallback({
          deck: selectedDeck,
          scope: effectiveScope,
          courseId: resolvedCourseId,
          lessonId: effectiveScope === 'skill' ? String(selectedSkill?.id || '') : '',
          projectTemplateId: activeProjectTemplateId,
          useNorwegian: isNorwegian,
        });
        const resolvedFallbackPlan = await resolveDesignPlanVisualAssets(fallbackPlan);
        setDesignPlan(resolvedFallbackPlan);
        setDesignPlanError('');
        applyDesignPlanPayload(resolvedFallbackPlan, undefined, {
          silent: true,
          source: 'fallback',
        });
        setSaveMessage(
          tt(
            'Backend mangler design-plan endpoint. Lokal fallback ble brukt og design er anvendt.',
            'Backend design-plan endpoint missing. Local fallback used and design applied.',
          ),
        );
        trackPresentationEvent('academy_presentation_design_plan_fallback_used', {
          reason: 'endpoint_not_implemented',
          slideCount: resolvedFallbackPlan.slides.length,
        });
        return;
      }

      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : tt('Kunne ikke generere design-plan.', 'Could not generate design plan.');
      setDesignPlanError(message);
      setSaveMessage(message);
    } finally {
      setDesignPlanBusy(false);
    }
  }, [
    activeProjectTemplateId,
    applyDesignPlanPayload,
    effectiveScope,
    fetchBackendDesignPlan,
    isNorwegian,
    resolvedCourseId,
    resolveDesignPlanVisualAssets,
    selectedDeck,
    selectedSkill?.id,
    trackPresentationEvent,
    tt,
  ]);

  const applyDesignPlan = useCallback(
    (targetSlideId?: string) => {
      if (!designPlan) return;
      applyDesignPlanPayload(designPlan, targetSlideId, { source: 'manual' });
      if (!targetSlideId) {
        setAiCritique(null);
        setAiCritiqueError('');
      }
    },
    [applyDesignPlanPayload, designPlan],
  );

  const runAiCritique = useCallback(
    async (
      deck: PresentationDeck,
      options?: {
        silent?: boolean;
      },
    ): Promise<PresentationAiCritiqueResult | null> => {
      try {
        setAiCritiqueBusy(true);
        setAiCritiqueError('');
        const critique = await requestDeckCritique(deck);
        setAiCritique(critique);
        if (!options?.silent) {
          setSaveMessage(
            tt(
              `AI-kritikk ferdig. Score ${critique.overall}/100.`,
              `AI critique complete. Score ${critique.overall}/100.`,
            ),
          );
        }
        trackPresentationEvent('academy_presentation_ai_critique_generated', {
          provider: critique.provider,
          model: critique.model,
          overall: critique.overall,
          findingCount: critique.findings.length,
        });
        return critique;
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : tt('Kunne ikke kjøre AI-kritikk.', 'Could not run AI critique.');
        setAiCritiqueError(message);
        if (!options?.silent) {
          setSaveMessage(message);
        }
        return null;
      } finally {
        setAiCritiqueBusy(false);
      }
    },
    [requestDeckCritique, trackPresentationEvent, tt],
  );

  const repairDeckDesign = useCallback(async () => {
    if (!selectedDeck) return;
    try {
      setDesignPlanBusy(true);
      const critique = await runAiCritique(selectedDeck, { silent: true });
      const repairFocus =
        critique?.findings
          .slice(0, 8)
          .map((finding) =>
            [
              finding.slideId ? `${finding.slideId}:` : '',
              tt(finding.repairHintNo, finding.repairHintEn) || tt(finding.messageNo, finding.messageEn),
            ]
              .filter(Boolean)
              .join(' '),
          )
          .filter(Boolean) || [];
      const { plan: repairPlan, source } = await selectPreferredRepairPlan(selectedDeck, {
        repairFocus,
      });
      setDesignPlan(repairPlan);
      applyDesignPlanPayload(repairPlan, undefined, { silent: true, source: 'repair' });
      setAiCritique(null);
      setAiCritiqueError('');
      setSaveMessage(
        source === 'backend'
          ? tt(
              `Repair deck brukte backend-plan og oppdaterte ${repairPlan.slides.length} slides med nye visuals.`,
              `Repair deck used the backend plan and refreshed ${repairPlan.slides.length} slides with new visuals.`,
            )
          : tt(
              `Repair deck brukte lokal grammar-pass og oppdaterte ${repairPlan.slides.length} slides med nye visuals.`,
              `Repair deck used the local grammar pass and refreshed ${repairPlan.slides.length} slides with new visuals.`,
            ),
      );
      trackPresentationEvent('academy_presentation_repair_deck', {
        slideCount: repairPlan.slides.length,
        issueCount: qualityIssues.length,
        scoreBefore: designEvaluation.overall,
        planSource: source,
        critiqueIssueCount: critique?.findings.length || 0,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : tt('Kunne ikke reparere presentasjonen.', 'Could not repair the presentation.');
      setSaveMessage(message);
    } finally {
      setDesignPlanBusy(false);
    }
  }, [
    applyDesignPlanPayload,
    designEvaluation.overall,
    qualityIssues.length,
    runAiCritique,
    selectedDeck,
    selectPreferredRepairPlan,
    trackPresentationEvent,
    tt,
  ]);

  const refreshPresentationDesign = useCallback(async () => {
    if (!selectedDeck) return;
    if (designPlan || selectedDeck.sourceType === 'auto-context-ready') {
      await repairDeckDesign();
      return;
    }
    await generateDesignPlan();
  }, [designPlan, generateDesignPlan, repairDeckDesign, selectedDeck]);

  useEffect(() => {
    if (!scopeStorageKey || !selectedDeck) return;
    if (selectedDeck.sourceType !== 'auto-context') return;
    if (designPlanBusy) return;

    const autoKey = `${scopeStorageKey}:${selectedDeck.id}`;
    if (autoContextGenerationRef.current.has(autoKey)) return;
    autoContextGenerationRef.current.add(autoKey);
    setSaveMessage(
      tt(
        'Bygger presentasjonen automatisk ut fra kompetanse og ferdighet.',
        'Building the presentation automatically from the competency and skill.',
      ),
    );
    void generateDesignPlan();
  }, [designPlanBusy, generateDesignPlan, scopeStorageKey, selectedDeck, tt]);

  const removeSlide = useCallback(
    (slideId: string) => {
      updateSelectedDeck((deck) => ({
        ...deck,
        slides: deck.slides.filter((slide) => slide.id !== slideId),
      }));
    },
    [updateSelectedDeck],
  );

  const moveSlide = useCallback(
    (slideId: string, direction: 'up' | 'down') => {
      updateSelectedDeck((deck) => {
        const index = deck.slides.findIndex((slide) => slide.id === slideId);
        if (index === -1) return deck;
        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= deck.slides.length) return deck;

        const nextSlides = [...deck.slides];
        const [moved] = nextSlides.splice(index, 1);
        nextSlides.splice(nextIndex, 0, moved);

        return {
          ...deck,
          slides: nextSlides,
        };
      });
    },
    [updateSelectedDeck],
  );

  const autoFixQualityIssues = useCallback(() => {
    if (!selectedDeck || qualityIssues.length === 0) return;
    const maxTimeline = Math.max(60, duration);
    const changedByIssueCount = qualityIssues.length;

    updateSelectedDeck((deck) => {
      const ordered = [...deck.slides].sort(
        (left, right) => Number(left.startTime || 0) - Number(right.startTime || 0),
      );
      let cursor = 0;

      const repaired = ordered.map((slide) => {
        const snappedStart = timelineSnapEnabled ? roundHalfSecond(Number(slide.startTime) || 0) : Number(slide.startTime) || 0;
        let startTime = clamp(snappedStart, 0, Math.max(0, maxTimeline - 1));
        startTime = Math.max(startTime, cursor);

        let slideDuration = timelineSnapEnabled
          ? roundHalfSecond(Number(slide.duration) || 0)
          : Number(slide.duration) || 0;
        slideDuration = Math.max(3, slideDuration);
        if (startTime + slideDuration > maxTimeline) {
          slideDuration = Math.max(3, maxTimeline - startTime);
        }

        const nextElements = slide.elements.map((element) => {
          const width = clamp(Number(element.width) || 20, 1, 100);
          const height = clamp(Number(element.height) || 8, 1, 100);
          const x = clamp(Number(element.x) || 0, 0, Math.max(0, 100 - width));
          const y = clamp(Number(element.y) || 0, 0, Math.max(0, 100 - height));
          const text =
            element.type === 'text' && String(element.text || '').trim().length > 130
              ? String(element.text || '').trim().slice(0, 130)
              : element.text;
          return {
            ...element,
            x,
            y,
            width,
            height,
            text,
          };
        });

        const nextSlide = normalizeSlide(
          {
            ...slide,
            startTime,
            duration: slideDuration,
            instructorId: String(slide.instructorId || '').trim() || defaultInstructorId || undefined,
            elements: nextElements,
          },
          maxTimeline,
        );
        cursor = nextSlide.startTime + nextSlide.duration;
        return hydrateSlidePreview(nextSlide, deck.visualThemeId, deck.name);
      });

      return {
        ...deck,
        slides: repaired,
      };
    });

    setSaveMessage(
      tt(
        `Auto-fiks fullført. Oppdaterte ${changedByIssueCount} kvalitetssjekker.`,
        `Auto-fix completed. Updated ${changedByIssueCount} quality checks.`,
      ),
    );
    trackPresentationEvent('academy_presentation_quality_autofix', {
      issueCount: changedByIssueCount,
    });
  }, [
    defaultInstructorId,
    duration,
    qualityIssues.length,
    selectedDeck,
    trackPresentationEvent,
    timelineSnapEnabled,
    tt,
    updateSelectedDeck,
  ]);

  const commitDurationInput = useCallback(() => {
    const parsed = parseMinuteSecondTime(durationInput, duration);
    const next = Math.max(60, parsed);
    setDuration(next);
    setCurrentTime((prev) => Math.min(prev, next));
    setDurationInput(formatTime(next));
  }, [duration, durationInput]);

  const savePresentationSetup = useCallback(
    async (publish: boolean) => {
      setSaveMessage('');

      if (publish && !qualitySummary.canPublish) {
        setSaveMessage(
          tt(
            `Publisering blokkert: ${qualitySummary.errorCount} kritiske kvalitetssjekker må løses først.`,
            `Publish blocked: ${qualitySummary.errorCount} critical quality checks must be resolved first.`,
          ),
        );
        trackPresentationEvent('academy_presentation_publish_blocked_quality', {
          errorCount: qualitySummary.errorCount,
          warningCount: qualitySummary.warningCount,
          issueCount: qualityIssues.length,
        });
        return;
      }

      const course = activeCourse;
      const skill = selectedSkill;

      if (effectiveScope === 'skill' && !skill) {
        setSaveMessage(tt('Velg ferdighet for å lagre.', 'Select skill before saving.'));
        return;
      }

      const normalizedDecks = decks.map((deck) => normalizeDeck(deck, duration));
      const now = new Date().toISOString();
      let persistedPublishedAt = '';

      try {
        markSaving();
        const existing = course ? state.courses.find((entry) => entry.id === course.id) : undefined;

        if (existing) {
          const presentationResources = normalizedDecks.flatMap((deck) =>
            deck.slides.map((slide, index) => {
              const startTime = Math.max(0, Math.round(slide.startTime));
              const endTime = Math.max(startTime + 1, Math.round(slide.startTime + slide.duration));
              const resourceId =
                effectiveScope === 'skill'
                  ? `${PRESENTATION_RESOURCE_SKILL_PREFIX}${String(skill?.id || 'unknown')}-${deck.id}-${slide.id}`
                  : `${PRESENTATION_RESOURCE_COURSE_PREFIX}${deck.id}-${slide.id}`;

              return {
                id: resourceId,
                type: 'link' as const,
                title:
                  effectiveScope === 'skill'
                    ? `[Presentation][Skill] ${deck.name} :: ${slide.title}`
                    : `[Presentation][Course] ${deck.name} :: ${slide.title}`,
                url: slide.previewImageUrl || deck.sourceUrl || '#',
                description:
                  `${deck.name} · ${formatTime(startTime)}-${formatTime(endTime)} · order:${index + 1} · template:${deck.template} · mode:${deck.displayMode} · variant:${deck.splitLayoutVariant} · placement:${deck.placement} · layout:${slide.layout || deck.displayMode} · deck:${deck.id} · slide:${slide.id} · slideNo:${Math.max(1, Number(slide.sourceSlideNumber) || index + 1)}` +
                  (deck.sourceName ? ` · source:${deck.sourceName}` : ''),
              };
            }),
          );

          if (effectiveScope === 'skill' && skill) {
            const skillPrefix = `${PRESENTATION_RESOURCE_SKILL_PREFIX}${String(skill.id)}-`;
            const lessonResources = Array.isArray(skill.resources) ? skill.resources : [];
            await updateLesson({
              ...skill,
              resources: [
                ...lessonResources.filter((resource) => !resource.id.startsWith(skillPrefix)),
                ...presentationResources,
              ],
            });
          } else {
            const courseResources = Array.isArray(existing.resources) ? existing.resources : [];
            await updateCourse({
              ...existing,
              isPublished: publish ? true : existing.isPublished,
              tags: Array.from(new Set([...(existing.tags || []), 'presentation-overlay', 'slides'])),
              resources: [
                ...courseResources.filter(
                  (resource) => !resource.id.startsWith(PRESENTATION_RESOURCE_COURSE_PREFIX),
                ),
                ...presentationResources,
              ],
            });
          }
        }

        if (course?.id) {
          const key = getScopeStorageKey(
            String(course.id),
            effectiveScope,
            effectiveScope === 'skill' ? String(skill?.id || '') : undefined,
          );
          const store = readPresentationStore();
          const previousEntry = store[key];
          persistedPublishedAt = String(previousEntry?.publishedAt || '');
          store[key] = {
            decks: normalizedDecks,
            duration,
            updatedAt: now,
            publishedAt: publish ? now : persistedPublishedAt || undefined,
          };
          writePresentationStore(store);
          void writePresentationStoreToDb(store);
        }

        onSave?.({
          courseId: course?.id || null,
          scope: effectiveScope,
          lessonId: effectiveScope === 'skill' ? skill?.id || null : null,
          duration,
          decks: normalizedDecks,
          publish,
        });

        setSaveMessage(
          publish
            ? tt('Presentasjonsoppsett publisert.', 'Presentation setup published.')
            : tt('Presentasjonsoppsett lagret.', 'Presentation setup saved.'),
        );
        markSaved();
        if (publish) {
          setLastPublishedAt(now);
          setHasSavedChangesSincePublish(false);
        } else {
          setLastPublishedAt(persistedPublishedAt);
          setHasSavedChangesSincePublish(Boolean(persistedPublishedAt));
        }

        analytics.trackEvent('academy_presentation_overlay_saved', {
          courseId: course?.id || null,
          scope: effectiveScope,
          lessonId: effectiveScope === 'skill' ? skill?.id || null : null,
          deckCount: normalizedDecks.length,
          slideCount: normalizedDecks.reduce((sum, deck) => sum + deck.slides.length, 0),
          publish,
          timestamp: Date.now(),
        });
      } catch (error) {
        markDirty();
        setSaveMessage(
          error instanceof Error
            ? error.message
            : tt('Kunne ikke lagre presentasjonsoppsett.', 'Could not save presentation setup.'),
        );
      }
    },
    [
      activeCourse,
      analytics,
      decks,
      duration,
      effectiveScope,
      markDirty,
      markSaved,
      markSaving,
      onSave,
      qualityIssues.length,
      qualitySummary.canPublish,
      qualitySummary.errorCount,
      qualitySummary.warningCount,
      selectedSkill,
      state.courses,
      trackPresentationEvent,
      tt,
      updateCourse,
      updateLesson,
    ],
  );

  const previewOverlaySx = useMemo(
    () =>
      overlayStyleForMode(
        previewSlideMode,
        selectedDeck?.placement || 'bottom-right',
        selectedDeck?.opacity || 0.96,
      ),
    [previewSlideMode, selectedDeck?.opacity, selectedDeck?.placement],
  );

  const splitLayoutColumns = useMemo(() => {
    if (!hasPresenterVideoSource) {
      if (!selectedDeck?.showNavigator) return '1fr';
      if (isNavigatorCollapsed) return '34px minmax(320px, 1fr)';
      return 'minmax(190px, 24%) minmax(320px, 1fr)';
    }

    if (!selectedDeck?.showNavigator) {
      if (selectedDeck?.splitLayoutVariant === 'presenter-focus') return 'minmax(320px, 44%) minmax(300px, 1fr)';
      if (selectedDeck?.splitLayoutVariant === 'slide-focus') return 'minmax(220px, 28%) minmax(420px, 1fr)';
      return 'minmax(240px, 36%) minmax(320px, 1fr)';
    }

    if (isNavigatorCollapsed) {
      if (selectedDeck?.splitLayoutVariant === 'presenter-focus') {
        return '34px minmax(340px, 46%) minmax(300px, 1fr)';
      }
      if (selectedDeck?.splitLayoutVariant === 'slide-focus') {
        return '34px minmax(220px, 26%) minmax(460px, 1fr)';
      }
      return '34px minmax(240px, 36%) minmax(320px, 1fr)';
    }

    if (selectedDeck?.splitLayoutVariant === 'presenter-focus') {
      return 'minmax(190px, 22%) minmax(360px, 43%) minmax(300px, 1fr)';
    }
    if (selectedDeck?.splitLayoutVariant === 'slide-focus') {
      return 'minmax(180px, 20%) minmax(220px, 25%) minmax(480px, 1fr)';
    }
    return 'minmax(190px, 25%) minmax(230px, 31%) minmax(300px, 1fr)';
  }, [hasPresenterVideoSource, isNavigatorCollapsed, selectedDeck?.showNavigator, selectedDeck?.splitLayoutVariant]);

  const isSplitScreenPreview = previewSlideMode === 'split-screen';
  const showSplitPreviewAsSideBySide = isSplitScreenPreview && hasPresenterVideoSource;
  const showTeleprompterPlayerOverlay = Boolean(
    selectedDeck && previewSlide && showInstructorScriptOverlay && activeInstructorScript,
  );

  const splitScreenPreviewColumns = useMemo(() => {
    if (!showSplitPreviewAsSideBySide) return '1fr';
    const variant = String(selectedDeck?.splitLayoutVariant || 'balanced');
    if (variant === 'presenter-focus') {
      return 'minmax(360px, 1.2fr) minmax(320px, 1fr)';
    }
    if (variant === 'slide-focus') {
      return 'minmax(300px, 0.92fr) minmax(420px, 1.08fr)';
    }
    return 'minmax(340px, 1fr) minmax(360px, 1fr)';
  }, [selectedDeck?.splitLayoutVariant, showSplitPreviewAsSideBySide]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: '#edf0f7',
        bgcolor: '#06080d',
        fontFamily: '"Manrope", "Segoe UI", sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 74% 12%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%)',
        }}
      />

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
          width: academyShellMaxWidth,
          mx: 'auto',
        }}
      >
        <AcademyLeftSidebar
          activeNav={leftNav}
          onNavigate={(navId, route) => {
            setLeftNav(navId);
            setLocation(buildRouteWithContext(route));
          }}
          onCreateCourse={() => {
            setLeftNav('curriculum');
            setLocation(buildRouteWithContext('/academy/curriculum?createCompetency=1', { includeLesson: false }));
          }}
          tt={tt}
          navLabel={navLabel}
          activeCourseId={resolvedCourseId || null}
        />

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              height: 74,
              px: 3,
              borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))',
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography sx={{ letterSpacing: '0.22em', fontSize: 15, color: 'rgba(237,240,247,0.82)' }}>
                CREATOR STUDIO
              </Typography>
              <Tooltip title={draftStatusChip.tooltip}>
                <Chip
                  label={draftStatusChip.label}
                  size="small"
                  sx={{
                    bgcolor: saveStatusIndicator.bgColor,
                    color: saveStatusIndicator.textColor,
                    border: `var(--academy-hairline-width, 1px) solid ${saveStatusIndicator.borderColor}`,
                    fontWeight: 600,
                  }}
                />
              </Tooltip>
              <Tooltip title={saveStatusIndicator.tooltip}>
                <Box
                  role="status"
                  aria-label={saveStatusIndicator.tooltip}
                  sx={{
                    width: 30,
                    height: 30,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1,
                    bgcolor: saveStatusIndicator.bgColor,
                    color: saveStatusIndicator.textColor,
                    border: `var(--academy-hairline-width, 1px) solid ${saveStatusIndicator.borderColor}`,
                    '@keyframes academySaveSpin': {
                      from: { transform: 'rotate(0deg)' },
                      to: { transform: 'rotate(360deg)' },
                    },
                    '& .academy-save-spin': {
                      animation: 'academySaveSpin 1.05s linear infinite',
                    },
                  }}
                >
                  {saveStatusIndicator.icon}
                </Box>
              </Tooltip>
              <Chip
                size="small"
                icon={<Slideshow sx={{ fontSize: 16 }} />}
                label={tt('Presentasjonsstudio', 'Presentation Studio')}
                sx={{
                  bgcolor: 'rgba(248,179,33,0.14)',
                  color: '#f8d56f',
                  border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.4)',
                }}
              />
            </Stack>

            <Stack direction="row" spacing={1.2} alignItems="center">
              <AcademyLocaleSwitcher />
              <IconButton
                size="small"
                onClick={() => setLocation(buildRouteWithContext('/academy/settings?tab=notifications', { includeLesson: false }))}
                aria-label={tt('Varsler', 'Notifications')}
                sx={{ color: 'rgba(237,240,247,0.75)' }}
              >
                <NotificationsNone fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocation(buildRouteWithContext('/academy/settings?tab=messages', { includeLesson: false }))}
                aria-label={tt('Meldinger', 'Messages')}
                sx={{ color: 'rgba(237,240,247,0.75)' }}
              >
                <MailOutline fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocation(buildRouteWithContext('/academy/settings?tab=profile', { includeLesson: false }))}
                aria-label={tt('Profil', 'Profile')}
                sx={{ p: 0 }}
              >
                <Avatar sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111' }}>N</Avatar>
              </IconButton>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 410px' },
              gap: { xs: 1.2, md: 1.6, xl: 2 },
              px: { xs: 1.2, sm: 1.6, lg: 2 },
              py: { xs: 1.2, sm: 1.6, lg: 2 },
            }}
          >
            <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".ppt,.pptx,.pdf"
                onChange={handleUploadFile}
                style={{ display: 'none' }}
              />

              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', md: 'center' }}
              >
                <Stack spacing={0.4}>
                  <Typography sx={{ fontSize: 'clamp(1.65rem, 1.3rem + 1.1vw, 2.05rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '0.015em' }}>
                    {tt('Presentasjonsstudio', 'Presentation Studio')}
                  </Typography>
                  <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                    {shouldShowAdvanced && activeProjectTemplateId && (
                      <Chip
                        size="small"
                        label={`${tt('Prosjektmal', 'Project template')}: ${
                          projectTemplateLabels[activeProjectTemplateId]
                            ? tt(
                                projectTemplateLabels[activeProjectTemplateId].no,
                                projectTemplateLabels[activeProjectTemplateId].en,
                              )
                            : activeProjectTemplateId
                        }`}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.12)',
                          color: '#edf0f7',
                        }}
                      />
                    )}
                  </Stack>
                </Stack>

                <Stack
                  direction="row"
                  spacing={0.8}
                  flexWrap="wrap"
                  useFlexGap
                  sx={{
                    minWidth: 0,
                    justifyContent: { xs: 'flex-start', lg: 'flex-end' },
                    rowGap: 0.8,
                  }}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={toggleSimpleMode}
                    sx={{
                      ...PRESENTATION_NEUTRAL_OUTLINED_BUTTON_SX,
                      color: simpleMode ? '#edf0f7' : '#f8d675',
                      borderColor: simpleMode ? 'rgba(255,255,255,0.2)' : 'rgba(248,179,33,0.35)',
                      bgcolor: simpleMode ? 'rgba(255,255,255,0.02)' : 'rgba(248,179,33,0.1)',
                    }}
                  >
                    {simpleMode
                      ? tt('Pro-modus', 'Pro mode')
                      : tt('Tilbake til enkel', 'Back to simple')}
                  </Button>
                  {shouldShowAdvanced ? (
                    <>
                      <Button
                        variant="outlined"
                        startIcon={<AutoAwesome />}
                        onClick={repairDeckDesign}
                        disabled={!selectedDeck || designPlanBusy}
                        sx={{
                          ...PRESENTATION_NEUTRAL_OUTLINED_BUTTON_SX,
                          borderColor: 'rgba(126,232,179,0.34)',
                          color: '#caffea',
                          bgcolor: 'rgba(126,232,179,0.08)',
                          '&:hover': {
                            borderColor: 'rgba(126,232,179,0.5)',
                            bgcolor: 'rgba(126,232,179,0.14)',
                          },
                        }}
                      >
                        {tt('Repair deck', 'Repair deck')}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<AutoFixHigh />}
                        onClick={autoFixQualityIssues}
                        disabled={qualityIssues.length === 0}
                        sx={PRESENTATION_WARNING_OUTLINED_BUTTON_SX}
                      >
                        {tt('Auto-fiks', 'Auto-fix')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outlined"
                      startIcon={<AutoAwesome />}
                      onClick={() => void refreshPresentationDesign()}
                      disabled={!selectedDeck || designPlanBusy}
                      sx={{
                        ...PRESENTATION_NEUTRAL_OUTLINED_BUTTON_SX,
                        borderColor: 'rgba(126,232,179,0.34)',
                        color: '#caffea',
                        bgcolor: 'rgba(126,232,179,0.08)',
                        '&:hover': {
                          borderColor: 'rgba(126,232,179,0.5)',
                          bgcolor: 'rgba(126,232,179,0.14)',
                        },
                      }}
                    >
                      {designPlanBusy
                        ? tt('Oppdaterer ...', 'Refreshing ...')
                        : tt('Oppdater presentasjon', 'Refresh presentation')}
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    startIcon={isPlaying ? <Visibility /> : <VisibilityOff />}
                    onClick={toggleStudentPreview}
                    sx={{
                      ...PRESENTATION_NEUTRAL_OUTLINED_BUTTON_SX,
                      borderColor: isPlaying ? 'rgba(248,179,33,0.45)' : 'rgba(255,255,255,0.2)',
                      color: isPlaying ? '#f8d675' : '#edf0f7',
                      bgcolor: isPlaying ? 'rgba(248,179,33,0.12)' : 'transparent',
                    }}
                  >
                    {isPlaying
                      ? tt('Forhåndsvisning på', 'Preview on')
                      : tt('Forhåndsvis (student)', 'Preview (learner)')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Save />}
                    onClick={() => void savePresentationSetup(false)}
                    sx={PRESENTATION_SAVE_BUTTON_SX}
                  >
                    {tt('Lagre', 'Save')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Publish />}
                    onClick={() => void savePresentationSetup(true)}
                    disabled={!qualitySummary.canPublish}
                    sx={PRESENTATION_PUBLISH_BUTTON_SX}
                  >
                    {tt('Publiser', 'Publish')}
                  </Button>
                  {onCancel && (
                    <Button
                      variant="text"
                      onClick={onCancel}
                      sx={{
                        textTransform: 'none',
                        color: 'rgba(237,240,247,0.78)',
                      }}
                    >
                      {tt('Avbryt', 'Cancel')}
                    </Button>
                  )}
                </Stack>
              </Stack>

              <Stack sx={{ ...panelSx, p: 1, gap: 0.9 }}>
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} alignItems={{ xs: 'stretch', lg: 'center' }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    <Select
                      size="small"
                      value={selectedCourseValue}
                      displayEmpty
                      renderValue={(value) => {
                        const matchedCourse = courseItems.find(
                          (course) => String(course.id) === String(value || ''),
                        );
                        return matchedCourse?.title || tt('Kompetanse', 'Competency');
                      }}
                      onChange={(event) => {
                        const nextCourseId = String(event.target.value);
                        setSelectedCourseId(nextCourseId);
                        syncCourseIdInRoute(nextCourseId);
                      }}
                      sx={{
                        minWidth: { xs: '100%', md: 260 },
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255,255,255,0.2)',
                        },
                      }}
                    >
                      <MenuItem value="" disabled>
                        {tt('Kompetanse', 'Competency')}
                      </MenuItem>
                      {courseItems.map((course) => (
                        <MenuItem key={course.id} value={String(course.id)}>
                          {course.title}
                        </MenuItem>
                      ))}
                    </Select>

                    <Select
                      size="small"
                      value={scope}
                      onChange={(event) => setScope(event.target.value as PresentationScope)}
                      sx={{
                        minWidth: { xs: '100%', md: 148 },
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255,255,255,0.2)',
                        },
                      }}
                    >
                      <MenuItem value="course">{tt('Ferdighet', 'Skill')}</MenuItem>
                      <MenuItem value="skill">{tt('Ferdighet', 'Skill')}</MenuItem>
                    </Select>

                    {scope === 'skill' && (
                      <Select
                        size="small"
                        value={selectedSkill ? String(selectedSkill.id) : ''}
                        onChange={(event) => setSelectedSkillId(String(event.target.value))}
                        displayEmpty
                        disabled={skillOptions.length === 0}
                        sx={{
                          minWidth: { xs: '100%', md: 220 },
                          color: '#edf0f7',
                          bgcolor: 'rgba(255,255,255,0.04)',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255,255,255,0.2)',
                          },
                        }}
                      >
                        {skillOptions.length === 0 && (
                          <MenuItem value="">
                            {tt('Ingen ferdigheter tilgjengelig', 'No skills available')}
                          </MenuItem>
                        )}
                        {skillOptions.map((lesson) => (
                          <MenuItem key={lesson.id} value={String(lesson.id)}>
                            {lesson.title}
                          </MenuItem>
                        ))}
                      </Select>
                    )}

                    <TextField
                      size="small"
                      label={tt('Tid (min:sek)', 'Time (min:sec)')}
                      value={durationInput}
                      onChange={(event) => setDurationInput(event.target.value)}
                      onBlur={commitDurationInput}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitDurationInput();
                        }
                      }}
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9:]*' }}
                      sx={{
                        width: { xs: '100%', md: 156 },
                        '& .MuiInputBase-root': { color: '#edf0f7' },
                        '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255,255,255,0.2)',
                        },
                      }}
                    />
                    <Chip
                      size="small"
                      avatar={
                        activeInstructorProfile?.name ? (
                          <Avatar sx={{ width: 22, height: 22 }}>
                            {activeInstructorProfile.name.charAt(0).toUpperCase()}
                          </Avatar>
                        ) : undefined
                      }
                      label={
                        activeInstructorProfile?.name
                          ? `${tt('Instruktør', 'Instructor')}: ${activeInstructorProfile.name}`
                          : tt('Instruktør ikke satt', 'Instructor not assigned')
                      }
                      sx={{
                        maxWidth: { xs: '100%', md: 320 },
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.08)',
                        '& .MuiChip-label': {
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        },
                      }}
                    />
                  </Stack>

                </Stack>

                {shouldShowAdvanced ? (
                  <>
                    <Stack
                      spacing={0.8}
                      sx={PRESENTATION_DETAIL_CARD_SX}
                    >
                      <Typography sx={PRESENTATION_SECTION_LABEL_SX}>
                        {tt('Timeline og kvalitet', 'Timeline and quality')}
                      </Typography>
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={0.8}
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', lg: 'center' }}
                >
                  <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap alignItems="center">
                    <Button
                      size="small"
                      variant={timelineSnapEnabled ? 'contained' : 'outlined'}
                      onClick={() =>
                        setTimelineSnapEnabled((previous) => {
                          const next = !previous;
                          trackPresentationEvent('academy_presentation_snap_toggled', {
                            target: 'timeline',
                            enabled: next,
                          });
                          return next;
                        })
                      }
                      sx={{
                        textTransform: 'none',
                        borderColor: 'rgba(255,255,255,0.24)',
                        color: timelineSnapEnabled ? '#1a1306' : '#edf0f7',
                        background: timelineSnapEnabled
                          ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                          : 'transparent',
                        minWidth: 118,
                      }}
                    >
                      {tt('Snap: 0.5s', 'Snap: 0.5s')}
                    </Button>
                    <Button
                      size="small"
                      variant={snapToPlayheadEnabled ? 'contained' : 'outlined'}
                      onClick={() =>
                        setSnapToPlayheadEnabled((previous) => {
                          const next = !previous;
                          trackPresentationEvent('academy_presentation_snap_toggled', {
                            target: 'playhead',
                            enabled: next,
                          });
                          return next;
                        })
                      }
                      sx={{
                        textTransform: 'none',
                        borderColor: 'rgba(255,255,255,0.24)',
                        color: snapToPlayheadEnabled ? '#1a1306' : '#edf0f7',
                        background: snapToPlayheadEnabled
                          ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                          : 'transparent',
                        minWidth: 134,
                      }}
                    >
                      {tt('Nær playhead', 'Near playhead')}
                    </Button>
                    <Chip
                      size="small"
                      label={tt(
                        `Designscore ${qualitySummary.designScore}`,
                        `Design score ${qualitySummary.designScore}`,
                      )}
                      sx={{
                        bgcolor:
                          qualitySummary.designScore >= 86
                            ? 'rgba(126,232,179,0.18)'
                            : qualitySummary.designScore >= 72
                              ? 'rgba(248,179,33,0.18)'
                              : 'rgba(255,122,122,0.2)',
                        color:
                          qualitySummary.designScore >= 86
                            ? '#caffea'
                            : qualitySummary.designScore >= 72
                              ? '#ffe6b8'
                              : '#ffd6d6',
                        fontWeight: 700,
                      }}
                    />
                    <Chip
                      size="small"
                      icon={<WarningAmber sx={{ fontSize: 16 }} />}
                      label={tt(
                        `${qualityIssues.length} kvalitetssjekker`,
                        `${qualityIssues.length} quality checks`,
                      )}
                      sx={{
                        bgcolor:
                          qualitySummary.errorCount > 0
                            ? 'rgba(255,122,122,0.2)'
                            : qualityIssues.length > 0
                              ? 'rgba(248,179,33,0.2)'
                              : 'rgba(126,232,179,0.18)',
                        color:
                          qualitySummary.errorCount > 0
                            ? '#ffd6d6'
                            : qualityIssues.length > 0
                              ? '#ffe6b8'
                              : '#caffea',
                      }}
                    />
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={0.7}
                    flexWrap="wrap"
                    useFlexGap
                    alignItems="center"
                    justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}
                  >
                    <Chip
                      size="small"
                      label={tt(
                        `${qualitySummary.errorCount} kritiske`,
                        `${qualitySummary.errorCount} critical`,
                      )}
                      sx={{
                        bgcolor: 'rgba(255,122,122,0.18)',
                        color: '#ffd6d6',
                      }}
                    />
                    <Chip
                      size="small"
                      label={tt(
                        `${qualitySummary.warningCount} varsler`,
                        `${qualitySummary.warningCount} warnings`,
                      )}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.12)',
                        color: '#edf0f7',
                      }}
                    />
                  </Stack>
                </Stack>

                    </Stack>

                <Stack
                  spacing={0.8}
                  sx={PRESENTATION_DETAIL_CARD_SX}
                >
                  <Typography sx={PRESENTATION_SECTION_LABEL_SX}>
                    {tt('Teleprompter', 'Teleprompter')}
                  </Typography>
                  <Stack
                    direction={{ xs: 'column', lg: 'row' }}
                    spacing={0.8}
                    justifyContent="space-between"
                    alignItems={{ xs: 'stretch', lg: 'center' }}
                  >
                    <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap alignItems="center">
                      <Chip
                        size="small"
                        label={tt('Teleprompter', 'Teleprompter')}
                        sx={{ bgcolor: 'rgba(248,179,33,0.2)', color: '#f8d56f', fontWeight: 700 }}
                      />
                      <Button
                        size="small"
                        variant={showInstructorScriptOverlay ? 'contained' : 'outlined'}
                        onClick={() =>
                          setShowInstructorScriptOverlay((prev) => {
                            const next = !prev;
                            if (!next) setTeleprompterMode('static');
                            return next;
                          })
                        }
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: showInstructorScriptOverlay ? '#1a1306' : '#edf0f7',
                          background: showInstructorScriptOverlay
                            ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                            : 'transparent',
                          minWidth: 112,
                        }}
                      >
                        {showInstructorScriptOverlay ? tt('Manus: På', 'Script: On') : tt('Manus: Av', 'Script: Off')}
                      </Button>
                      <ButtonGroup
                        size="small"
                        variant="outlined"
                        sx={{
                          '& .MuiButton-root': {
                            minWidth: { xs: 76, md: 86 },
                            textTransform: 'none',
                            borderColor: 'rgba(255,255,255,0.2)',
                            color: '#edf0f7',
                          },
                          '& .MuiButton-root.Mui-disabled': {
                            color: 'rgba(237,240,247,0.42)',
                            borderColor: 'rgba(255,255,255,0.16) !important',
                            background: 'rgba(255,255,255,0.03)',
                          },
                        }}
                      >
                        <Button
                          onClick={() => setTeleprompterMode('static')}
                          disabled={!showInstructorScriptOverlay || !activeInstructorScript}
                          sx={{
                            color: teleprompterMode === 'static' ? '#1a1306' : '#edf0f7',
                            background:
                              teleprompterMode === 'static'
                                ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                                : 'transparent',
                          }}
                        >
                          {tt('Statisk', 'Static')}
                        </Button>
                        <Button
                          onClick={() => setTeleprompterMode('auto')}
                          disabled={!showInstructorScriptOverlay || !activeInstructorScript}
                          sx={{
                            color: teleprompterMode === 'auto' ? '#1a1306' : '#edf0f7',
                            background:
                              teleprompterMode === 'auto'
                                ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                                : 'transparent',
                          }}
                        >
                          {tt('Auto', 'Auto')}
                        </Button>
                        <Button
                          onClick={() => setTeleprompterMode('speech')}
                          disabled={!canEnableSpeechFollow}
                          sx={{
                            color: teleprompterMode === 'speech' ? '#1a1306' : '#edf0f7',
                            background:
                              teleprompterMode === 'speech'
                                ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                                : 'transparent',
                          }}
                        >
                          {tt('Følg tale', 'Follow speech')}
                        </Button>
                      </ButtonGroup>
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={0.7}
                      flexWrap="wrap"
                      useFlexGap
                      alignItems="center"
                      justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}
                    >
                      <Select
                        size="small"
                        value={String(teleprompterSpeed)}
                        onChange={(event) => setTeleprompterSpeed(Number(event.target.value) || 26)}
                        disabled={!showInstructorScriptOverlay}
                        renderValue={(value) => {
                          const numeric = Number(value);
                          if (numeric === 16) return tt('Sakte', 'Slow');
                          if (numeric === 36) return tt('Rask', 'Fast');
                          if (numeric === 46) return tt('Veldig rask', 'Very fast');
                          return tt('Normal', 'Normal');
                        }}
                        sx={{
                          minWidth: 112,
                          color: '#edf0f7',
                          bgcolor: 'rgba(255,255,255,0.04)',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255,255,255,0.2)',
                          },
                        }}
                      >
                        <MenuItem value="16">{tt('Sakte', 'Slow')}</MenuItem>
                        <MenuItem value="26">{tt('Normal', 'Normal')}</MenuItem>
                        <MenuItem value="36">{tt('Rask', 'Fast')}</MenuItem>
                        <MenuItem value="46">{tt('Veldig rask', 'Very fast')}</MenuItem>
                      </Select>
                      <Select
                        size="small"
                        value={String(teleprompterFontSize)}
                        onChange={(event) => setTeleprompterFontSize(Number(event.target.value) || 16)}
                        disabled={!showInstructorScriptOverlay}
                        renderValue={(value) => {
                          const numeric = Number(value);
                          if (numeric === 14) return tt('Tekst S', 'Text S');
                          if (numeric === 18) return tt('Tekst L', 'Text L');
                          if (numeric === 22) return tt('Tekst XL', 'Text XL');
                          return tt('Tekst M', 'Text M');
                        }}
                        sx={{
                          minWidth: 112,
                          color: '#edf0f7',
                          bgcolor: 'rgba(255,255,255,0.04)',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255,255,255,0.2)',
                          },
                        }}
                      >
                        <MenuItem value="14">{tt('Tekst S', 'Text S')}</MenuItem>
                        <MenuItem value="16">{tt('Tekst M', 'Text M')}</MenuItem>
                        <MenuItem value="18">{tt('Tekst L', 'Text L')}</MenuItem>
                        <MenuItem value="22">{tt('Tekst XL', 'Text XL')}</MenuItem>
                      </Select>
                      <Button
                        size="small"
                        variant={teleprompterMirrored ? 'contained' : 'outlined'}
                        onClick={() => setTeleprompterMirrored((prev) => !prev)}
                        disabled={!showInstructorScriptOverlay}
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: teleprompterMirrored ? '#1a1306' : '#edf0f7',
                          background: teleprompterMirrored
                            ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                            : 'transparent',
                          minWidth: 92,
                        }}
                      >
                        {teleprompterMirrored ? tt('Speil: På', 'Mirror: On') : tt('Speil: Av', 'Mirror: Off')}
                      </Button>
                      <Button
                        size="small"
                        variant={teleprompterLineFocus ? 'contained' : 'outlined'}
                        onClick={() => setTeleprompterLineFocus((prev) => !prev)}
                        disabled={!showInstructorScriptOverlay || !activeInstructorScript}
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: teleprompterLineFocus ? '#1a1306' : '#edf0f7',
                          background: teleprompterLineFocus
                            ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                            : 'transparent',
                          minWidth: 94,
                        }}
                      >
                        {teleprompterLineFocus ? tt('Fokus: På', 'Focus: On') : tt('Fokus: Av', 'Focus: Off')}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setTeleprompterOffset(0);
                          teleprompterLastTickRef.current = null;
                        }}
                        disabled={!showInstructorScriptOverlay}
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: '#edf0f7',
                          minWidth: 78,
                        }}
                      >
                        {tt('Reset', 'Reset')}
                      </Button>
                    </Stack>
                  </Stack>

                  <Stack
                    direction={{ xs: 'column', lg: 'row' }}
                    spacing={0.7}
                    justifyContent="space-between"
                    alignItems={{ xs: 'stretch', lg: 'center' }}
                  >
                    <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap alignItems="center">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          void prepareTeleprompterSpeechSync();
                        }}
                        disabled={
                          !showInstructorScriptOverlay ||
                          !activeInstructorScript ||
                          teleprompterSpeechStatus === 'preparing'
                        }
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: '#edf0f7',
                          minWidth: 104,
                        }}
                      >
                        {teleprompterSpeechStatus === 'preparing'
                          ? tt('Synker...', 'Syncing...')
                          : tt('Synk tale', 'Sync speech')}
                      </Button>
                      <Chip
                        size="small"
                        label={teleprompterSpeechStatusChip.label}
                        sx={{
                          bgcolor: teleprompterSpeechStatusChip.bg,
                          color: teleprompterSpeechStatusChip.color,
                          fontWeight: 700,
                        }}
                      />
                      {captionsTrackUrl && (
                        <Chip
                          size="small"
                          label={tt('CC: Klar', 'CC: Ready')}
                          sx={{
                            bgcolor: 'rgba(126,232,179,0.2)',
                            color: '#d7ffee',
                            fontWeight: 700,
                          }}
                        />
                      )}
                      {teleprompterSpeechSpeakers.length > 1 && (
                        <Select
                          size="small"
                          value={teleprompterSpeakerFilter}
                          onChange={(event) =>
                            setTeleprompterSpeakerFilter(
                              String(event.target.value || TELEPROMPTER_SPEAKER_ALL),
                            )
                          }
                          disabled={!canEnableSpeechFollow}
                          renderValue={(value) => {
                            const selected = String(value || TELEPROMPTER_SPEAKER_ALL);
                            if (selected === TELEPROMPTER_SPEAKER_ALL) {
                              return tt('Taler: Alle', 'Speaker: All');
                            }
                            return `${tt('Taler', 'Speaker')}: ${selected}`;
                          }}
                          sx={{
                            minWidth: 130,
                            color: '#edf0f7',
                            bgcolor: 'rgba(255,255,255,0.04)',
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(255,255,255,0.2)',
                            },
                          }}
                        >
                          <MenuItem value={TELEPROMPTER_SPEAKER_ALL}>{tt('Alle talere', 'All speakers')}</MenuItem>
                          {teleprompterSpeechSpeakers.map((speakerId) => (
                            <MenuItem key={`teleprompter-speaker-${speakerId}`} value={speakerId}>
                              {speakerId}
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    </Stack>
                  </Stack>

                  {!!teleprompterSpeechError && (
                    <Typography sx={{ fontSize: 12, color: '#ffcbcb' }}>{teleprompterSpeechError}</Typography>
                  )}
                  {!teleprompterSpeechError && !!teleprompterSpeechMetaLabel && (
                    <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.78)' }}>
                      {teleprompterSpeechMetaLabel}
                    </Typography>
                  )}
                  {!teleprompterSpeechError &&
                    !teleprompterSpeechMetaLabel &&
                    teleprompterSpeechWarnings.length > 0 && (
                      <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.74)' }}>
                        {teleprompterSpeechWarnings[0]}
                      </Typography>
                    )}
                </Stack>
                  </>
                ) : null}
              </Stack>

              {!!saveMessage && (
                <Typography
                  sx={{
                    px: 1.2,
                    py: 0.8,
                    borderRadius: 1,
                    border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.72)',
                    background: 'rgba(248,179,33,0.08)',
                    color: '#f8d56f',
                  }}
                >
                  {saveMessage}
                </Typography>
              )}

              <Box sx={{ ...panelSx, p: 1.1 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      lg: showSplitPreviewAsSideBySide ? splitScreenPreviewColumns : '1fr',
                    },
                    gap: 0,
                    alignItems: 'stretch',
                  }}
                >
                {(!isSplitScreenPreview || hasPresenterVideoSource) && (
                <AcademyPlayerStudio
                  src={effectiveVideoUrl}
                  captionTrackSrc={captionsTrackUrl || undefined}
                  captionTrackLang={teleprompterSpeechLanguage === 'auto' ? (isNorwegian ? 'no' : 'en') : teleprompterSpeechLanguage}
                  captionTrackLabel={tt('Auto captions', 'Auto captions')}
                  videoRef={videoRef}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => {
                    setNavigatorSelectedSlideId('');
                    setIsPlaying(true);
                  }}
                  onPause={() => setIsPlaying(false)}
                  onStudioControlAction={(action, payload) => {
                    trackPresentationEvent('academy_presentation_player_control', {
                      action,
                      slideId: previewSlide?.id || null,
                      ...(payload || {}),
                    });
                  }}
                  objectFit={isSplitScreenPreview ? 'contain' : 'cover'}
                  containerSx={
                    isSplitScreenPreview
                      ? {
                          minHeight: { xs: 220, md: 360 },
                          height: '100%',
                          aspectRatio: 'auto',
                          bgcolor: '#000',
                        }
                      : undefined
                  }
                  videoStyle={isSplitScreenPreview ? { backgroundColor: '#000' } : undefined}
                  controlsExtra={
                    activeInstructorProfile ? (
                      <IconButton
                        size="small"
                        aria-label={
                          instructorInlineOpen
                            ? tt('Skjul instruktørinfo', 'Hide instructor info')
                            : tt('Vis instruktørinfo', 'Show instructor info')
                        }
                        onClick={() => setInstructorInlineOpen((prev) => !prev)}
                        sx={{
                          width: 34,
                          height: 34,
                          borderColor: 'rgba(255,255,255,0.28)',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.28)',
                          color: instructorInlineOpen ? '#1a1306' : '#edf0f7',
                          background: instructorInlineOpen
                            ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                            : 'linear-gradient(180deg, rgba(8,13,22,0.5), rgba(6,10,18,0.62))',
                          '&:hover': {
                            borderColor: 'rgba(248,179,33,0.52)',
                            background: instructorInlineOpen
                              ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                              : 'linear-gradient(180deg, rgba(10,15,28,0.66), rgba(8,12,20,0.76))',
                          },
                        }}
                      >
                        <InfoOutlined fontSize="small" />
                      </IconButton>
                    ) : null
                  }
                >
                  {selectedDeck && previewSlide && !isSplitScreenPreview && (
                    <Box sx={previewOverlaySx}>
                      {selectedDeck.displayMode === 'split-screen' ? (
                        <Box
                          sx={{
                            height: '100%',
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: '1fr',
                              md: splitLayoutColumns,
                            },
                            gap: 0,
                          }}
                        >
                          {selectedDeck.showNavigator && (
                            <Box
                              sx={{
                                borderRight: { md: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)' },
                                background: activeVisualThemeColors.navBg,
                                display: 'flex',
                                flexDirection: 'column',
                                p: isNavigatorCollapsed ? 0.35 : 1,
                                gap: isNavigatorCollapsed ? 0.25 : 0.8,
                              }}
                            >
                              <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent={isNavigatorCollapsed ? 'center' : 'space-between'}
                                sx={{ px: isNavigatorCollapsed ? 0 : 0.4, pb: isNavigatorCollapsed ? 0 : 0.2 }}
                              >
                                {!isNavigatorCollapsed && (
                                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgba(226,238,255,0.9)' }}>
                                    {tt('Velg tema', 'Choose theme')}
                                  </Typography>
                                )}
                                {!isNavigatorCollapsed && (
                                  <Chip
                                    size="small"
                                    label={`${Math.max(
                                      1,
                                      orderedPreviewSlides.findIndex((slide) => slide.id === previewSlide.id) + 1,
                                    )}/${Math.max(1, orderedPreviewSlides.length)}`}
                                    sx={{
                                      bgcolor: activeVisualThemeColors.chipBg,
                                      color: activeVisualThemeColors.chipText,
                                    }}
                                  />
                                )}
                                <IconButton
                                  size="small"
                                  onClick={toggleNavigatorCollapsed}
                                  aria-label={
                                    isNavigatorCollapsed
                                      ? tt('Vis tema-velger', 'Show theme picker')
                                      : tt('Skjul tema-velger', 'Hide theme picker')
                                  }
                                  sx={{
                                    color: activeVisualThemeColors.navText,
                                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                                    bgcolor: 'rgba(9,16,26,0.42)',
                                    '&:hover': {
                                      bgcolor: 'rgba(12,20,33,0.58)',
                                    },
                                  }}
                                >
                                  {isNavigatorCollapsed ? (
                                    <ChevronRight fontSize="small" />
                                  ) : (
                                    <ChevronLeft fontSize="small" />
                                  )}
                                </IconButton>
                              </Stack>
                              {!isNavigatorCollapsed &&
                                orderedPreviewSlides.map((slide, index) => {
                                  const active = slide.id === previewSlide.id;
                                  return (
                                    <Button
                                      key={slide.id}
                                      variant="outlined"
                                      onClick={() => seekTo(slide.startTime, slide.id)}
                                      sx={{
                                        justifyContent: 'flex-start',
                                        px: 0.7,
                                        py: 0.65,
                                        minHeight: 56,
                                        textTransform: 'none',
                                        borderRadius: 0.8,
                                        borderColor: active ? 'rgba(173,209,255,0.78)' : 'rgba(255,255,255,0.14)',
                                        bgcolor: active
                                          ? activeVisualThemeColors.navCardActiveBg
                                          : activeVisualThemeColors.navCardBg,
                                        color: activeVisualThemeColors.navText,
                                        fontWeight: active ? 700 : 600,
                                        '&:hover': {
                                          borderColor: active ? 'rgba(173,209,255,0.9)' : 'rgba(255,255,255,0.26)',
                                          bgcolor: active
                                            ? activeVisualThemeColors.navCardActiveBg
                                            : activeVisualThemeColors.navCardBg,
                                        },
                                      }}
                                    >
                                      <Box
                                        sx={{
                                          width: 54,
                                          height: 36,
                                          borderRadius: 0.5,
                                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                                          overflow: 'hidden',
                                          flexShrink: 0,
                                          mr: 0.7,
                                          bgcolor: 'rgba(0,0,0,0.25)',
                                        }}
                                      >
                                        {slide.thumbnailImageUrl ? (
                                          <Box
                                            component="img"
                                            src={slide.thumbnailImageUrl}
                                            alt={slide.title}
                                            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                          />
                                        ) : (
                                          <Box sx={{ width: '100%', height: '100%', bgcolor: 'rgba(255,255,255,0.12)' }} />
                                        )}
                                      </Box>
                                      <Box
                                        component="span"
                                        sx={{
                                          width: 22,
                                          opacity: 0.88,
                                          fontVariantNumeric: 'tabular-nums',
                                        }}
                                      >
                                        {index + 1}.
                                      </Box>
                                      <Typography
                                        component="span"
                                        sx={{
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          minWidth: 0,
                                          textAlign: 'left',
                                        }}
                                      >
                                        {slide.title}
                                      </Typography>
                                    </Button>
                                  );
                                })}
                              {!isNavigatorCollapsed && (
                                <Button
                                  variant="outlined"
                                  startIcon={<Add />}
                                  onClick={addSlide}
                                  sx={{
                                    justifyContent: 'flex-start',
                                    textTransform: 'none',
                                    borderRadius: 0.8,
                                    borderColor: 'rgba(255,255,255,0.2)',
                                    color: '#d9e9ff',
                                    bgcolor: 'rgba(8,14,24,0.52)',
                                    '&:hover': {
                                      borderColor: 'rgba(255,255,255,0.3)',
                                      bgcolor: 'rgba(10,18,30,0.66)',
                                    },
                                  }}
                                >
                                  {tt('Ny slide', 'New slide')}
                                </Button>
                              )}
                            </Box>
                          )}

                          <Box
                            sx={{
                              borderRight: { md: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)' },
                              p: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              background: activeVisualThemeColors.presenterBg,
                            }}
                          >
                            <Box sx={{ flex: 1 }} />

                          </Box>

                          <Box
                            sx={{
                              background: activeVisualThemeColors.canvasBg,
                              p: 1.2,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 1,
                              color: activeVisualThemeColors.canvasTitle,
                              overflow: 'auto',
                            }}
                          >
                            <Stack direction="row" spacing={0.7} alignItems="center" justifyContent="space-between">
                              <Typography
                                sx={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: alpha(activeVisualThemeColors.canvasTitle, 0.74),
                                  letterSpacing: '0.03em',
                                }}
                              >
                                {selectedDeck.name}
                              </Typography>
                              <Typography sx={{ fontSize: 11.5, color: alpha(activeVisualThemeColors.canvasText, 0.75) }}>
                                {selectedTemplatePreset ? tt(selectedTemplatePreset.labelNo, selectedTemplatePreset.labelEn) : ''}
                              </Typography>
                            </Stack>

                            <Box
                              sx={{
                                borderRadius: 0.8,
                                overflow: 'hidden',
                                border: `1px solid ${alpha(activeVisualThemeColors.canvasCardBorder, 0.9)}`,
                                bgcolor: 'rgba(255,255,255,0.7)',
                                minHeight: 172,
                              }}
                            >
                              {previewSlide.previewImageUrl ? (
                                <Box
                                  component="img"
                                  src={previewSlide.previewImageUrl}
                                  alt={previewSlide.title}
                                  sx={{ width: '100%', height: '100%', minHeight: 172, objectFit: 'cover', display: 'block' }}
                                />
                              ) : (
                                <Box
                                  sx={{
                                    minHeight: 172,
                                    display: 'grid',
                                    placeItems: 'center',
                                    color: alpha(activeVisualThemeColors.canvasText, 0.74),
                                  }}
                                >
                                  {tt('Ingen slide-preview enda', 'No slide preview yet')}
                                </Box>
                              )}
                            </Box>

                            <Typography
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(event) => {
                                const next = String(event.currentTarget.textContent || '').trim();
                                if (!next || next === previewSlide.title) return;
                                updateSlideField(previewSlide.id, 'title', next);
                              }}
                              sx={{
                                fontWeight: 800,
                                fontSize: 'clamp(1.2rem, 1.1rem + 0.4vw, 1.9rem)',
                                lineHeight: 1.2,
                                color: activeVisualThemeColors.canvasTitle,
                                outline: 'none',
                                borderRadius: 0.6,
                                border: `1px dashed ${alpha(activeVisualThemeColors.canvasTitle, 0.35)}`,
                                px: 0.6,
                                py: 0.4,
                                cursor: 'text',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {previewSlide.title}
                            </Typography>

                            <Typography
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(event) => {
                                const next = String(event.currentTarget.textContent || '').trim();
                                const placeholder = tt('Legg til punkter for denne sliden.', 'Add talking points for this slide.');
                                if (!previewSlideBodyDraft && next === placeholder) return;
                                if (next === previewSlideBodyDraft) return;
                                updateSlideBodyText(previewSlide.id, next);
                              }}
                              sx={{
                                outline: 'none',
                                borderRadius: 0.6,
                                border: `1px dashed ${alpha(activeVisualThemeColors.canvasTitle, 0.28)}`,
                                px: 0.6,
                                py: 0.45,
                                cursor: 'text',
                                color: activeVisualThemeColors.canvasText,
                                whiteSpace: 'pre-wrap',
                                fontSize: 13.2,
                                lineHeight: 1.45,
                                minHeight: 52,
                              }}
                            >
                              {previewSlideBodyDraft || tt('Legg til punkter for denne sliden.', 'Add talking points for this slide.')}
                            </Typography>

                            <Stack spacing={0.8}>
                              {(previewSlideBodyLines.length > 0
                                ? previewSlideBodyLines
                                : [tt('Ingen innholdspunkter enda.', 'No content points yet.')]).map((line, index) => (
                                <Box
                                  key={`${previewSlide.id}-point-${index}`}
                                  sx={{
                                    borderRadius: 0.85,
                                    border: `var(--academy-hairline-width, 1px) solid ${alpha(activeVisualThemeColors.canvasCardBorder, 0.92)}`,
                                    bgcolor: activeVisualThemeColors.canvasCardBg,
                                    p: 0.8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.8,
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: 26,
                                      height: 26,
                                      borderRadius: 0.6,
                                      bgcolor: activeVisualThemeColors.navAccent,
                                      color: '#e9f2ff',
                                      display: 'grid',
                                      placeItems: 'center',
                                      fontWeight: 700,
                                      fontSize: 12,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {index + 1}
                                  </Box>
                                  <Typography
                                    sx={{
                                      color: activeVisualThemeColors.canvasText,
                                      fontWeight: 600,
                                      fontSize: 15,
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    {line}
                                  </Typography>
                                </Box>
                              ))}
                            </Stack>

                            <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 'auto' }}>
                              <Description sx={{ fontSize: 17, color: alpha(activeVisualThemeColors.canvasText, 0.78) }} />
                              <Typography
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(event) => {
                                  const next = String(event.currentTarget.textContent || '').trim();
                                  const previous = String(selectedDeck.sourceName || '');
                                  if (next === previous) return;
                                  updateSelectedDeck((deck) => ({
                                    ...deck,
                                    sourceName: next,
                                  }));
                                }}
                                sx={{
                                  color: alpha(activeVisualThemeColors.canvasText, 0.9),
                                  fontSize: 12.3,
                                  outline: 'none',
                                  borderRadius: 0.6,
                                  px: 0.4,
                                  py: 0.1,
                                  border: `1px dashed ${alpha(activeVisualThemeColors.canvasText, 0.22)}`,
                                  cursor: 'text',
                                }}
                              >
                                {selectedDeck.sourceName || tt('Ingen filnavn', 'No filename')}
                              </Typography>
                            </Stack>
                          </Box>
                        </Box>
                      ) : (
                        <Stack spacing={0.8} sx={{ p: 1.1, height: '100%' }}>
                          <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Chip
                              size="small"
                              label={tt('Presentasjon', 'Presentation')}
                              sx={{ bgcolor: 'rgba(248,179,33,0.2)', color: '#f5f1e7' }}
                            />
                            <Chip
                              size="small"
                              label={`${formatTime(previewSlide.startTime)}-${formatTime(previewSlide.startTime + previewSlide.duration)}`}
                              sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#f5f1e7' }}
                            />
                            <Chip
                              size="small"
                              label={selectedTemplatePreset ? tt(selectedTemplatePreset.labelNo, selectedTemplatePreset.labelEn) : ''}
                              sx={{ bgcolor: 'rgba(82,121,204,0.22)', color: '#d8e6ff' }}
                            />
                          </Stack>

                          <Box
                            sx={{
                              flex: 1,
                              minHeight: 0,
                              borderRadius: 1,
                              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                              background:
                                'linear-gradient(145deg, rgba(22,29,42,0.95), rgba(9,13,20,0.98)), radial-gradient(circle at 82% 16%, rgba(248,179,33,0.18), rgba(0,0,0,0))',
                              p: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                            }}
                          >
                            {previewSlide.previewImageUrl && (
                              <Box
                                sx={{
                                  borderRadius: 0.7,
                                  overflow: 'hidden',
                                  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                                }}
                              >
                                <Box
                                  component="img"
                                  src={previewSlide.previewImageUrl}
                                  alt={previewSlide.title}
                                  sx={{ width: '100%', height: 158, objectFit: 'cover', display: 'block' }}
                                />
                              </Box>
                            )}
                            <Stack direction="row" spacing={0.8} alignItems="center">
                              <Slideshow sx={{ color: '#f8d56f' }} />
                              <Typography
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(event) => {
                                  const next = String(event.currentTarget.textContent || '').trim();
                                  if (!next || next === previewSlide.title) return;
                                  updateSlideField(previewSlide.id, 'title', next);
                                }}
                                sx={{
                                  fontWeight: 700,
                                  color: '#f5f1e7',
                                  outline: 'none',
                                  borderRadius: 0.6,
                                  px: 0.4,
                                  py: 0.1,
                                  border: `1px dashed ${alpha('#f8d675', 0.42)}`,
                                  cursor: 'text',
                                }}
                              >
                                {previewSlide.title}
                              </Typography>
                            </Stack>

                            {previewSlideBodyLines.length > 0 && (
                              <Typography
                                sx={{
                                  color: alpha('#f5f1e7', 0.92),
                                  fontSize: 12.5,
                                  lineHeight: 1.45,
                                }}
                              >
                                {previewSlideBodyLines[0]}
                              </Typography>
                            )}

                            <Typography
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(event) => {
                                const next = String(event.currentTarget.textContent || '').trim();
                                if (!next || next === selectedDeck.name) return;
                                updateSelectedDeck((deck) => ({
                                  ...deck,
                                  name: next,
                                }));
                              }}
                              sx={{
                                color: alpha('#f5f1e7', 0.84),
                                fontSize: 13,
                                outline: 'none',
                                borderRadius: 0.6,
                                px: 0.4,
                                py: 0.1,
                                border: `1px dashed ${alpha('#f8d675', 0.42)}`,
                                cursor: 'text',
                              }}
                            >
                              {selectedDeck.name}
                            </Typography>

                            <Stack direction="row" spacing={0.8} alignItems="center">
                              <Description sx={{ fontSize: 17, color: 'rgba(237,240,247,0.72)' }} />
                              <Typography
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(event) => {
                                  const next = String(event.currentTarget.textContent || '').trim();
                                  const previous = String(selectedDeck.sourceName || '');
                                  if (next === previous) return;
                                  updateSelectedDeck((deck) => ({
                                    ...deck,
                                    sourceName: next,
                                  }));
                                }}
                                sx={{
                                  color: 'rgba(237,240,247,0.72)',
                                  fontSize: 12.5,
                                  outline: 'none',
                                  borderRadius: 0.6,
                                  px: 0.4,
                                  py: 0.1,
                                  border: `1px dashed ${alpha('#f8d675', 0.42)}`,
                                  cursor: 'text',
                                }}
                              >
                                {selectedDeck.sourceName || tt('Ingen filnavn', 'No filename')}
                              </Typography>
                            </Stack>

                          </Box>
                        </Stack>
                      )}
                    </Box>
                  )}
                  {selectedDeck && previewSlide && activeInstructorProfile && instructorInlineOpen && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 12,
                        bottom: showTeleprompterPlayerOverlay ? { xs: 206, md: 248 } : { xs: 74, md: 82 },
                        zIndex: 9,
                        pointerEvents: 'auto',
                        maxWidth: 'min(94%, 740px)',
                      }}
                    >
                        <Box
                          sx={{
                            border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.44)',
                            borderRadius: 0.9,
                            background:
                              'linear-gradient(180deg, rgba(8,13,22,0.58), rgba(6,10,18,0.68)), radial-gradient(circle at 82% 14%, rgba(248,179,33,0.22), rgba(0,0,0,0))',
                            boxShadow: '0 10px 24px rgba(0,0,0,0.22)',
                            backdropFilter: 'blur(4px)',
                            px: 0.9,
                            py: 0.8,
                          }}
                        >
                          <Stack direction="row" spacing={0.9} alignItems="center" sx={{ minWidth: 0 }}>
                            <Avatar
                              src={activeInstructorProfile.avatar || undefined}
                              alt={activeInstructorProfile.name}
                              sx={{
                                width: 36,
                                height: 36,
                                fontSize: 14,
                                bgcolor: 'rgba(248,179,33,0.9)',
                                color: '#1a1306',
                              }}
                            >
                              {getInitials(activeInstructorProfile.name)}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                sx={{
                                  fontSize: 13.2,
                                  fontWeight: 700,
                                  color: '#f5f1e7',
                                  lineHeight: 1.2,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {activeInstructorProfile.name}
                              </Typography>
                              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.2 }}>
                                <Chip
                                  size="small"
                                  label={activeInstructorProfile.roleLabel}
                                  sx={{
                                    height: 20,
                                    bgcolor: instructorRoleChipTone.bg,
                                    color: instructorRoleChipTone.color,
                                    fontWeight: 700,
                                  }}
                                />
                              </Stack>
                            </Box>
                            {!!activeInstructorProfile.profession && (
                              <Chip
                                size="small"
                                label={activeInstructorProfile.profession}
                                sx={{
                                  ml: 'auto',
                                  bgcolor: 'rgba(255,255,255,0.1)',
                                  color: '#edf0f7',
                                  maxWidth: 220,
                                }}
                              />
                            )}
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Edit fontSize="small" />}
                              onClick={() => {
                                trackPresentationEvent('academy_presentation_instructor_quick_edit_opened', {
                                  instructorId: activeInstructorProfile.id,
                                  roleKind: activeInstructorProfile.roleKind,
                                });
                                setLocation(
                                  buildRouteWithContext(
                                    `/academy/instructors?instructorId=${encodeURIComponent(
                                      activeInstructorProfile.id,
                                    )}`,
                                    { includeLesson: false },
                                  ),
                                );
                              }}
                              sx={{
                                textTransform: 'none',
                                borderColor: 'rgba(255,255,255,0.24)',
                                color: '#edf0f7',
                                minWidth: 96,
                              }}
                            >
                              {tt('Rediger', 'Edit')}
                            </Button>
                          </Stack>
                          {activeInstructorProfile.bio && (
                            <Typography
                              sx={{
                                mt: 0.7,
                                color: 'rgba(237,240,247,0.82)',
                                fontSize: 12.6,
                                lineHeight: 1.45,
                              }}
                            >
                              {activeInstructorProfile.bio}
                            </Typography>
                          )}
                          {activeInstructorProfile.expertise.length > 0 && (
                            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.7 }}>
                              {activeInstructorProfile.expertise.slice(0, 6).map((item) => (
                                <Chip
                                  key={`inline-instructor-expertise-${item}`}
                                  size="small"
                                  label={item}
                                  sx={{
                                    bgcolor: 'rgba(248,179,33,0.16)',
                                    color: '#f8d675',
                                  }}
                                />
                              ))}
                            </Stack>
                          )}
                        </Box>
                    </Box>
                  )}
                  {showTeleprompterPlayerOverlay && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 12,
                        right: 12,
                        bottom: { xs: 74, md: 82 },
                        zIndex: 7,
                        pointerEvents: 'none',
                        display: 'flex',
                        justifyContent: 'center',
                      }}
                    >
                      <Box
                        sx={{
                          width: 'min(96%, 840px)',
                          borderRadius: 0.9,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.56)',
                          background: 'linear-gradient(180deg, rgba(8,13,22,0.9), rgba(6,10,18,0.95))',
                          boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
                          px: 1.1,
                          py: 0.9,
                        }}
                      >
                        <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                          <Chip
                            size="small"
                            label={tt('Instruktør-manus', 'Instructor script')}
                            sx={{ bgcolor: 'rgba(248,179,33,0.24)', color: '#f8d675', fontWeight: 700 }}
                          />
                          <Chip
                            size="small"
                            label={tt('Kun instruktør', 'Instructor only')}
                            sx={{ bgcolor: 'rgba(140,186,255,0.2)', color: '#d8ecff', fontWeight: 700 }}
                          />
                          <Chip
                            size="small"
                            label={
                              teleprompterSpeechFollow
                                ? tt('Følger tale', 'Following speech')
                                : teleprompterAutoScroll
                                  ? tt('Autoscroll', 'Autoscroll')
                                  : tt('Statisk', 'Static')
                            }
                            sx={{
                              bgcolor:
                                teleprompterSpeechFollow || teleprompterAutoScroll
                                  ? 'rgba(126,232,179,0.22)'
                                  : 'rgba(255,255,255,0.12)',
                              color:
                                teleprompterSpeechFollow || teleprompterAutoScroll
                                  ? '#caffea'
                                  : '#e2e8f5',
                              fontWeight: 700,
                            }}
                          />
                        </Stack>
                        <Box
                          ref={teleprompterViewportRef}
                          sx={{
                            maxHeight: { xs: 124, md: 166 },
                            minHeight: { xs: 92, md: 108 },
                            overflow: 'hidden',
                            borderRadius: 0.6,
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                            p: 0.7,
                            background: 'rgba(0,0,0,0.24)',
                            position: 'relative',
                          }}
                        >
                          {teleprompterLineFocus && (
                            <Box
                              sx={{
                                position: 'absolute',
                                left: 7,
                                right: 7,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                height: `${teleprompterLineHeightPx}px`,
                                borderRadius: 0.5,
                                border: '1px dashed rgba(248,179,33,0.44)',
                                background: 'rgba(248,179,33,0.08)',
                                pointerEvents: 'none',
                                zIndex: 1,
                              }}
                            />
                          )}
                          <Box
                            sx={{
                              position: 'relative',
                              zIndex: 2,
                              transform: `translateY(-${Math.max(0, teleprompterOffset)}px) ${teleprompterMirrored ? 'scaleX(-1)' : ''}`,
                              transformOrigin: 'center top',
                              transition:
                                teleprompterAutoScroll || teleprompterSpeechFollow
                                  ? 'none'
                                  : 'transform 120ms ease-out',
                            }}
                          >
                            {teleprompterLines.map((line, lineIndex) => {
                              const isFocusLine = teleprompterLineFocus && lineIndex === teleprompterFocusLineIndex;
                              return (
                                <Typography
                                  key={`teleprompter-line-${lineIndex}`}
                                  sx={{
                                    color: isFocusLine ? '#fff8dd' : '#edf0f7',
                                    fontSize: `${teleprompterFontSize}px`,
                                    lineHeight: 1.45,
                                    minHeight: `${teleprompterLineHeightPx}px`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    whiteSpace: 'pre-wrap',
                                    fontWeight: isFocusLine ? 700 : 500,
                                    opacity: teleprompterLineFocus ? (isFocusLine ? 1 : 0.58) : 0.95,
                                    borderRadius: 0.45,
                                    px: isFocusLine ? 0.35 : 0,
                                    py: 0.03,
                                    background: isFocusLine ? 'rgba(248,179,33,0.18)' : 'transparent',
                                  }}
                                >
                                  {line || '\u00A0'}
                                </Typography>
                              );
                            })}
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </AcademyPlayerStudio>
                )}

                {isSplitScreenPreview && selectedDeck && previewSlide && (
                  <Box
                    sx={{
                      borderRadius: 1,
                      border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.48)',
                      background:
                        'linear-gradient(160deg, rgba(16,22,33,0.96), rgba(8,12,19,0.98)), radial-gradient(circle at 84% 14%, rgba(248,179,33,0.2), rgba(0,0,0,0))',
                      minHeight: { xs: 220, md: 360 },
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        minHeight: 0,
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          md: showSplitPreviewAsSideBySide
                            ? selectedDeck.showNavigator
                              ? isNavigatorCollapsed
                                ? '34px minmax(320px, 1fr)'
                                : 'minmax(190px, 24%) minmax(320px, 1fr)'
                              : '1fr'
                            : splitLayoutColumns,
                        },
                        gap: 0,
                      }}
                    >
                      {selectedDeck.showNavigator && (
                        <Box
                          sx={{
                            borderRight: { md: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)' },
                            background: activeVisualThemeColors.navBg,
                            display: 'flex',
                            flexDirection: 'column',
                            p: isNavigatorCollapsed ? 0.35 : 1,
                            gap: isNavigatorCollapsed ? 0.25 : 0.8,
                          }}
                        >
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent={isNavigatorCollapsed ? 'center' : 'space-between'}
                            sx={{ px: isNavigatorCollapsed ? 0 : 0.4, pb: isNavigatorCollapsed ? 0 : 0.2 }}
                          >
                            {!isNavigatorCollapsed && (
                              <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgba(226,238,255,0.9)' }}>
                                {tt('Velg tema', 'Choose theme')}
                              </Typography>
                            )}
                            {!isNavigatorCollapsed && (
                              <Chip
                                size="small"
                                label={`${Math.max(
                                  1,
                                  orderedPreviewSlides.findIndex((slide) => slide.id === previewSlide.id) + 1,
                                )}/${Math.max(1, orderedPreviewSlides.length)}`}
                                sx={{
                                  bgcolor: activeVisualThemeColors.chipBg,
                                  color: activeVisualThemeColors.chipText,
                                }}
                              />
                            )}
                            <IconButton
                              size="small"
                              onClick={toggleNavigatorCollapsed}
                              aria-label={
                                isNavigatorCollapsed
                                  ? tt('Vis tema-velger', 'Show theme picker')
                                  : tt('Skjul tema-velger', 'Hide theme picker')
                              }
                              sx={{
                                color: activeVisualThemeColors.navText,
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                                bgcolor: 'rgba(9,16,26,0.42)',
                                '&:hover': {
                                  bgcolor: 'rgba(12,20,33,0.58)',
                                },
                              }}
                            >
                              {isNavigatorCollapsed ? (
                                <ChevronRight fontSize="small" />
                              ) : (
                                <ChevronLeft fontSize="small" />
                              )}
                            </IconButton>
                          </Stack>
                          {!isNavigatorCollapsed &&
                            orderedPreviewSlides.map((slide, index) => {
                              const active = slide.id === previewSlide.id;
                              return (
                                <Button
                                  key={slide.id}
                                  variant="outlined"
                                  onClick={() => seekTo(slide.startTime, slide.id)}
                                  sx={{
                                    justifyContent: 'flex-start',
                                    px: 0.7,
                                    py: 0.65,
                                    minHeight: 56,
                                    textTransform: 'none',
                                    borderRadius: 0.8,
                                    borderColor: active ? 'rgba(173,209,255,0.78)' : 'rgba(255,255,255,0.14)',
                                    bgcolor: active
                                      ? activeVisualThemeColors.navCardActiveBg
                                      : activeVisualThemeColors.navCardBg,
                                    color: activeVisualThemeColors.navText,
                                    fontWeight: active ? 700 : 600,
                                    '&:hover': {
                                      borderColor: active ? 'rgba(173,209,255,0.9)' : 'rgba(255,255,255,0.26)',
                                      bgcolor: active
                                        ? activeVisualThemeColors.navCardActiveBg
                                        : activeVisualThemeColors.navCardBg,
                                    },
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: 54,
                                      height: 36,
                                      borderRadius: 0.5,
                                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                                      overflow: 'hidden',
                                      flexShrink: 0,
                                      mr: 0.7,
                                      bgcolor: 'rgba(0,0,0,0.25)',
                                    }}
                                  >
                                    {slide.thumbnailImageUrl ? (
                                      <Box
                                        component="img"
                                        src={slide.thumbnailImageUrl}
                                        alt={slide.title}
                                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                      />
                                    ) : (
                                      <Box sx={{ width: '100%', height: '100%', bgcolor: 'rgba(255,255,255,0.12)' }} />
                                    )}
                                  </Box>
                                  <Box
                                    component="span"
                                    sx={{
                                      width: 22,
                                      opacity: 0.88,
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    {index + 1}.
                                  </Box>
                                  <Typography
                                    component="span"
                                    sx={{
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      minWidth: 0,
                                      textAlign: 'left',
                                    }}
                                  >
                                    {slide.title}
                                  </Typography>
                                </Button>
                              );
                            })}
                          {!isNavigatorCollapsed && (
                            <Button
                              variant="outlined"
                              startIcon={<Add />}
                              onClick={addSlide}
                              sx={{
                                justifyContent: 'flex-start',
                                textTransform: 'none',
                                borderRadius: 0.8,
                                borderColor: 'rgba(255,255,255,0.2)',
                                color: '#d9e9ff',
                                bgcolor: 'rgba(8,14,24,0.52)',
                                '&:hover': {
                                  borderColor: 'rgba(255,255,255,0.3)',
                                  bgcolor: 'rgba(10,18,30,0.66)',
                                },
                              }}
                            >
                              {tt('Ny slide', 'New slide')}
                            </Button>
                          )}
                        </Box>
                      )}

                      {hasPresenterVideoSource && !showSplitPreviewAsSideBySide && (
                        <Box
                          sx={{
                            borderRight: { md: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)' },
                            p: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            background: activeVisualThemeColors.presenterBg,
                          }}
                        >
                          <Box sx={{ flex: 1 }} />
                        </Box>
                      )}

                      <Box
                        sx={{
                          background: activeVisualThemeColors.canvasBg,
                          p: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            flex: 1,
                            minHeight: 0,
                            borderRadius: 0,
                            overflow: 'hidden',
                            border: 'none',
                            bgcolor: '#ffffff',
                            display: 'block',
                          }}
                        >
                          {previewSlide.previewImageUrl ? (
                            <Box
                              component="img"
                              src={previewSlide.previewImageUrl}
                              alt={previewSlide.title}
                              sx={{
                                width: '100%',
                                height: '100%',
                                minHeight: '100%',
                                objectFit: 'contain',
                                objectPosition: 'center center',
                                display: 'block',
                                bgcolor: '#ffffff',
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                minHeight: 220,
                                display: 'grid',
                                placeItems: 'center',
                                color: alpha(activeVisualThemeColors.canvasText, 0.74),
                              }}
                            >
                              {tt('Ingen slide-preview enda', 'No slide preview yet')}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )}
                </Box>
              </Box>

              {shouldShowAdvanced && (
              <>
              <Box sx={{ ...panelSx, p: 1.1, display: 'grid', gap: 0.9 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                  <TextField
                    size="small"
                    placeholder={tt('Sok i presentasjon og slides...', 'Search presentations and slides...')}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    fullWidth
                    InputProps={{
                      startAdornment: <Search sx={{ mr: 0.8, color: 'rgba(237,240,247,0.62)' }} fontSize="small" />,
                    }}
                    sx={{
                      '& .MuiInputBase-root': {
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.04)',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.2)',
                      },
                    }}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<FileUpload />}
                    onClick={handleUploadClick}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      minWidth: { xs: '100%', md: 152 },
                    }}
                  >
                    {tt('Last opp PPT', 'Upload PPT')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Add />}
                    onClick={addDeck}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      minWidth: { xs: '100%', md: 152 },
                    }}
                  >
                    {tt('Ny presentasjon', 'New deck')}
                  </Button>
                </Stack>

                {search.trim().length > 0 && (
                  <Typography sx={{ color: 'rgba(237,240,247,0.66)', fontSize: 11.5 }}>
                    {semanticSearchBusy
                      ? tt('AI-sok rangerer presentasjoner...', 'AI search is ranking presentations...')
                      : tt('AI-sok aktiv for dette soket.', 'AI search is active for this query.')}
                  </Typography>
                )}

                {filteredDecks.length === 0 ? (
                  <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>
                    {tt('Ingen presentasjoner matcher soket.', 'No presentations match your search.')}
                  </Typography>
                ) : (
                  filteredDecks.map((deck) => {
                    const selected = selectedDeck?.id === deck.id;
                    return (
                      <Box
                        key={deck.id}
                        sx={{
                          borderRadius: 1,
                          border: selected
                            ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.52)'
                            : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                          background: selected
                            ? 'linear-gradient(145deg, rgba(248,179,33,0.14), rgba(248,179,33,0.04))'
                            : 'rgba(255,255,255,0.03)',
                          p: 1,
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={0.9}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', md: 'center' }}
                        >
                          <Box
                            onClick={() => setSelectedDeckId(deck.id)}
                            sx={{ cursor: 'pointer', minWidth: 0, width: '100%' }}
                          >
                            <Typography sx={{ fontWeight: 700, color: '#f5f1e7' }} noWrap>
                              {deck.name}
                            </Typography>
                            <Typography sx={{ color: 'rgba(237,240,247,0.7)', fontSize: 12.5 }} noWrap>
                              {tt('Slides', 'Slides')}: {deck.slides.length} · {tt('Template', 'Template')}:{' '}
                              {tt(
                                (templatePresets.find((item) => item.id === deck.template) || templatePresets[0]).labelNo,
                                (templatePresets.find((item) => item.id === deck.template) || templatePresets[0]).labelEn,
                              )}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.8}>
                            <Button
                              size="small"
                              onClick={() => setSelectedDeckId(deck.id)}
                              sx={{
                                textTransform: 'none',
                                color: '#edf0f7',
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                              }}
                            >
                              {tt('Velg', 'Select')}
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              startIcon={<DeleteOutline fontSize="small" />}
                              onClick={() => removeDeck(deck.id)}
                              sx={{ textTransform: 'none' }}
                            >
                              {tt('Fjern', 'Remove')}
                            </Button>
                          </Stack>
                        </Stack>
                      </Box>
                    );
                  })
                )}
              </Box>

              {selectedDeck && (
                <Box sx={{ ...panelSx, p: 1.1, display: 'grid', gap: 0.9 }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: 'stretch', md: 'center' }}
                  >
                    <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
                      {tt('Slide-rekkefolge og plassering', 'Slide order and placement')}
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<Add />}
                      onClick={addSlide}
                      sx={{
                        textTransform: 'none',
                        borderColor: 'rgba(255,255,255,0.2)',
                        color: '#edf0f7',
                      }}
                    >
                      {tt('Legg til slide', 'Add slide')}
                    </Button>
                  </Stack>

                  {selectedDeck.slides.length === 0 ? (
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>
                      {tt('Ingen slides enda. Legg til en slide for a starte.', 'No slides yet. Add a slide to start.')}
                    </Typography>
                  ) : (
                    selectedDeck.slides.map((slide, index) => (
                      <Box
                        key={slide.id}
                        sx={{
                          borderRadius: 1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                          background: 'rgba(255,255,255,0.03)',
                          p: 1,
                          display: 'grid',
                          gap: 0.8,
                        }}
                      >
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ xs: 'stretch', md: 'center' }}>
                          <Chip
                            size="small"
                            label={`${tt('Slide', 'Slide')} ${index + 1}`}
                            sx={{
                              bgcolor: 'rgba(248,179,33,0.14)',
                              color: '#f8d56f',
                              border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.36)',
                            }}
                          />
                          <TextField
                            size="small"
                            value={slide.title}
                            onChange={(event) => updateSlideField(slide.id, 'title', event.target.value)}
                            fullWidth
                            sx={{
                              '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' },
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                            }}
                          />
                          <Stack direction="row" spacing={0.4}>
                            <IconButton
                              size="small"
                              onClick={() => moveSlide(slide.id, 'up')}
                              disabled={index === 0}
                              sx={{
                                color: index === 0 ? 'rgba(237,240,247,0.28)' : '#edf0f7',
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                              }}
                            >
                              <ArrowUpward fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => moveSlide(slide.id, 'down')}
                              disabled={index === selectedDeck.slides.length - 1}
                              sx={{
                                color:
                                  index === selectedDeck.slides.length - 1
                                    ? 'rgba(237,240,247,0.28)'
                                    : '#edf0f7',
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                              }}
                            >
                              <ArrowDownward fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => removeSlide(slide.id)}
                              sx={{
                                color: 'rgba(255,155,155,0.9)',
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,155,155,0.34)',
                              }}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8}>
                          <TextField
                            size="small"
                            label={tt('Start (min:sek)', 'Start (min:sec)')}
                            value={formatTime(slide.startTime)}
                            onChange={(event) => {
                              const parsed = parseMinuteSecondTime(event.target.value, slide.startTime);
                              const snapped = snapTimeValue(parsed);
                              updateSlideField(
                                slide.id,
                                'startTime',
                                clamp(snapped, 0, Math.max(0, duration - 1)),
                              );
                            }}
                            sx={{
                              width: { xs: '100%', md: 150 },
                              '& .MuiInputBase-root': { color: '#edf0f7' },
                              '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                            }}
                          />
                          <TextField
                            size="small"
                            label={tt('Varighet (sek)', 'Duration (sec)')}
                            value={String(Math.round(slide.duration))}
                            onChange={(event) => {
                              const parsed = Number.parseFloat(event.target.value);
                              const nextDuration = Number.isFinite(parsed) ? parsed : slide.duration;
                              const snappedDuration = timelineSnapEnabled
                                ? roundHalfSecond(nextDuration)
                                : nextDuration;
                              updateSlideField(slide.id, 'duration', Math.max(1, snappedDuration));
                            }}
                            sx={{
                              width: { xs: '100%', md: 150 },
                              '& .MuiInputBase-root': { color: '#edf0f7' },
                              '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                            }}
                          />
                          <Select
                            size="small"
                            value={String(slide.instructorId || defaultInstructorId || '')}
                            onChange={(event) =>
                              updateSlideField(slide.id, 'instructorId', String(event.target.value || ''))
                            }
                            displayEmpty
                            sx={{
                              width: { xs: '100%', md: 210 },
                              color: '#edf0f7',
                              bgcolor: 'rgba(255,255,255,0.04)',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255,255,255,0.2)',
                              },
                            }}
                          >
                            {instructorItems.length === 0 && (
                              <MenuItem value="">
                                {tt('Ingen instruktører tilgjengelig', 'No instructors available')}
                              </MenuItem>
                            )}
                            {instructorItems.map((instructor) => (
                              <MenuItem key={`slide-instructor-${slide.id}-${instructor.id}`} value={String(instructor.id)}>
                                {instructor.name}
                              </MenuItem>
                            ))}
                          </Select>
                          <Select
                            size="small"
                            value={slide.layout}
                            onChange={(event) =>
                              updateSlideField(
                                slide.id,
                                'layout',
                                toDisplayMode(String(event.target.value)),
                              )
                            }
                            sx={{
                              width: { xs: '100%', md: 190 },
                              color: '#edf0f7',
                              bgcolor: 'rgba(255,255,255,0.04)',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255,255,255,0.2)',
                              },
                            }}
                          >
                            <MenuItem value="picture-in-picture">{tt('Bilde-i-bilde', 'Picture in Picture')}</MenuItem>
                            <MenuItem value="side-panel">{tt('Sidepanel', 'Side Panel')}</MenuItem>
                            <MenuItem value="split-screen">{tt('Delt skjerm', 'Split Screen')}</MenuItem>
                            <MenuItem value="full-frame">{tt('Full ramme', 'Full Frame')}</MenuItem>
                          </Select>
                          <Button
                            variant="text"
                            onClick={() => updateSlideField(slide.id, 'layout', selectedDeck.displayMode)}
                            sx={{
                              alignSelf: { xs: 'stretch', md: 'center' },
                              textTransform: 'none',
                              color: 'rgba(237,240,247,0.8)',
                            }}
                          >
                            {tt('Replace Layout', 'Replace Layout')}
                          </Button>
                          <Button
                            variant="text"
                            onClick={() => seekTo(slide.startTime, slide.id)}
                            sx={{
                              alignSelf: { xs: 'stretch', md: 'center' },
                              textTransform: 'none',
                              color: '#f8d56f',
                            }}
                          >
                            {tt('Ga til tidspunkt', 'Jump to time')}
                          </Button>
                        </Stack>

                        <TextField
                          size="small"
                          label={tt('Manus / speaker notes', 'Script / speaker notes')}
                          value={slide.speakerNotes}
                          onChange={(event) => updateSlideField(slide.id, 'speakerNotes', event.target.value)}
                          onFocus={() => {
                            if (teleprompterAutoScroll) {
                              setTeleprompterAutoScroll(false);
                              teleprompterLastTickRef.current = null;
                            }
                            if (teleprompterSpeechFollow) {
                              setTeleprompterSpeechFollow(false);
                            }
                          }}
                          multiline
                          minRows={2}
                          sx={{
                            '& .MuiInputBase-root': { color: '#edf0f7' },
                            '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                          }}
                        />
                        <Typography sx={{ color: 'rgba(237,240,247,0.64)', fontSize: 12 }}>
                          {tt(
                            'Vises kun i instruktør-overlay på video i editor. Dette publiseres ikke til student-visning.',
                            'Shown only in the instructor video overlay in the editor. This is not published to learner view.',
                          )}
                        </Typography>

                        <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                          <Chip
                            size="small"
                            label={`${tt('Elementer', 'Elements')}: ${slide.elements.length}`}
                            sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                          />
                          <Chip
                            size="small"
                            label={`${tt('Tekst', 'Text')}: ${slide.elements.filter((element) => element.type === 'text').length}`}
                            sx={{ bgcolor: 'rgba(82,121,204,0.22)', color: '#d8e6ff' }}
                          />
                          <Chip
                            size="small"
                            label={`${tt('Bilder', 'Images')}: ${slide.elements.filter((element) => element.type === 'image').length}`}
                            sx={{ bgcolor: 'rgba(248,179,33,0.18)', color: '#f8d675' }}
                          />
                          <Chip
                            size="small"
                            label={`${tt('Video', 'Video')}: ${slide.elements.filter((element) => element.type === 'video').length}`}
                            sx={{ bgcolor: 'rgba(126,232,179,0.16)', color: '#9ef1ca' }}
                          />
                        </Stack>

                        {slide.elements
                          .filter((element) => element.type === 'text')
                          .slice(0, 3)
                          .map((element, textIndex, textElements) => (
                            <Stack key={element.id} direction="row" spacing={0.6} alignItems="center">
                              <TextField
                                size="small"
                                label={tt(`Tekstelement ${textIndex + 1}`, `Text element ${textIndex + 1}`)}
                                value={element.text}
                                onChange={(event) =>
                                  updateSlideElementText(slide.id, element.id, event.target.value)
                                }
                                multiline
                                minRows={1}
                                fullWidth
                                sx={{
                                  '& .MuiInputBase-root': { color: '#edf0f7' },
                                  '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(255,255,255,0.2)',
                                  },
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => moveSlideElementLayer(slide.id, element.id, 'up')}
                                disabled={textIndex === 0}
                                sx={{
                                  color: textIndex === 0 ? 'rgba(237,240,247,0.28)' : '#edf0f7',
                                  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                                }}
                              >
                                <ArrowUpward fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => moveSlideElementLayer(slide.id, element.id, 'down')}
                                disabled={textIndex === textElements.length - 1}
                                sx={{
                                  color:
                                    textIndex === textElements.length - 1
                                      ? 'rgba(237,240,247,0.28)'
                                      : '#edf0f7',
                                  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                                }}
                              >
                                <ArrowDownward fontSize="small" />
                              </IconButton>
                            </Stack>
                          ))}
                      </Box>
                    ))
                  )}
                </Box>
              )}
              </>
              )}
            </Box>

            <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.1 }}>
              {!shouldShowAdvanced && (
                <>
                  <Box sx={{ ...panelSx, p: 1.2, display: 'grid', gap: 0.9 }}>
                    <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={0.8} alignItems="center">
                        <AutoAwesome sx={{ color: '#f8d56f' }} />
                        <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
                          {tt('Auto-generert presentasjon', 'Auto-generated presentation')}
                        </Typography>
                      </Stack>
                      <Chip
                        size="small"
                        label={simplePresentationStatus.label}
                        sx={{
                          bgcolor: simplePresentationStatus.toneBg,
                          color: simplePresentationStatus.toneText,
                          fontWeight: 700,
                        }}
                      />
                    </Stack>

                    <Typography sx={{ color: 'rgba(237,240,247,0.78)', fontSize: 13.2, lineHeight: 1.5 }}>
                      {simplePresentationSummary}
                    </Typography>

                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={
                          selectedSkill?.title
                            ? `${tt('Ferdighet', 'Skill')}: ${selectedSkill.title}`
                            : `${tt('Kompetanse', 'Competency')}: ${activeCourse?.title || tt('Ikke valgt', 'Not selected')}`
                        }
                        sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#edf0f7' }}
                      />
                      <Chip
                        size="small"
                        label={tt(
                          `${selectedDeck?.slides.length || 0} slides klare`,
                          `${selectedDeck?.slides.length || 0} slides ready`,
                        )}
                        sx={{ bgcolor: 'rgba(126,232,179,0.14)', color: '#caffea' }}
                      />
                      <Chip
                        size="small"
                        label={`${tt('Tema', 'Theme')}: ${tt(selectedVisualThemePreset.labelNo, selectedVisualThemePreset.labelEn)}`}
                        sx={{ bgcolor: 'rgba(92,149,255,0.14)', color: '#dce8ff' }}
                      />
                    </Stack>

                    {simplePresentationHighlights.length > 0 && (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {simplePresentationHighlights.map((label) => (
                          <Chip
                            key={`presentation-simple-highlight-${label}`}
                            size="small"
                            label={label}
                            sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                          />
                        ))}
                      </Stack>
                    )}

                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AutoAwesome />}
                      onClick={() => void refreshPresentationDesign()}
                      disabled={!selectedDeck || designPlanBusy}
                      sx={{
                        alignSelf: 'flex-start',
                        ...PRESENTATION_NEUTRAL_OUTLINED_BUTTON_SX,
                        borderColor: 'rgba(126,232,179,0.34)',
                        color: '#caffea',
                        bgcolor: 'rgba(126,232,179,0.08)',
                      }}
                    >
                      {designPlanBusy
                        ? tt('Oppdaterer ...', 'Refreshing ...')
                        : tt('Oppdater presentasjon', 'Refresh presentation')}
                    </Button>
                  </Box>

                  {selectedDeck && (
                    <Box sx={{ ...panelSx, p: 1.2, display: 'grid', gap: 0.9 }}>
                      <Typography sx={PRESENTATION_SECTION_LABEL_SX}>
                        {tt('Brand og visning', 'Brand and display')}
                      </Typography>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8}>
                        <Select
                          size="small"
                          value={selectedDeck.brandKitId || ''}
                          onChange={(event) => applyBrandKitToSelectedDeck(String(event.target.value || ''))}
                          displayEmpty
                          sx={{
                            flex: 1,
                            color: '#edf0f7',
                            bgcolor: 'rgba(255,255,255,0.04)',
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(255,255,255,0.2)',
                            },
                          }}
                        >
                          <MenuItem value="">{tt('Kun base-tema', 'Base theme only')}</MenuItem>
                          {brandKits.map((kit) => (
                            <MenuItem key={`presentation-simple-brand-${kit.id}`} value={kit.id}>
                              {kit.name}
                            </MenuItem>
                          ))}
                        </Select>
                        <Select
                          size="small"
                          value={selectedDeck.visualThemeId}
                          onChange={(event) =>
                            updateSelectedDeck((deck) => ({
                              ...deck,
                              visualThemeId: toVisualThemeId(String(event.target.value)),
                            }))
                          }
                          sx={{
                            flex: 1,
                            color: '#edf0f7',
                            bgcolor: 'rgba(255,255,255,0.04)',
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(255,255,255,0.2)',
                            },
                          }}
                        >
                          {visualThemePresets.map((themePreset) => (
                            <MenuItem key={`presentation-simple-theme-${themePreset.id}`} value={themePreset.id}>
                              {tt(themePreset.labelNo, themePreset.labelEn)}
                            </MenuItem>
                          ))}
                        </Select>
                      </Stack>
                    </Box>
                  )}
                </>
              )}

              {shouldShowAdvanced && (
              <Box sx={{ ...panelSx, p: 1.2, display: 'grid', gap: 0.9 }}>
                <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <AutoAwesome sx={{ color: '#f8d56f' }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
                      {tt('Design-plan', 'Design Plan')}
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    label={activeProjectTemplateId || tt('Ingen prosjektmal', 'No project template')}
                    sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#edf0f7' }}
                  />
                </Stack>

                <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => void generateDesignPlan()}
                    disabled={!selectedDeck || designPlanBusy}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(248,179,33,0.44)',
                      color: '#f8d675',
                    }}
                  >
                    {designPlanBusy
                      ? tt('Genererer struktur ...', 'Generating structure ...')
                      : tt('Generer designstruktur', 'Generate design structure')}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      if (!selectedDeck) return;
                      void runAiCritique(selectedDeck);
                    }}
                    disabled={!selectedDeck || aiCritiqueBusy}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(92,149,255,0.42)',
                      color: '#dce8ff',
                    }}
                  >
                    {aiCritiqueBusy
                      ? tt('Kjører AI-kritikk ...', 'Running AI critique ...')
                      : tt('AI-kritikk', 'AI critique')}
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => applyDesignPlan()}
                    disabled={!designPlan || designPlanBusy}
                    sx={{
                      textTransform: 'none',
                      color: 'rgba(237,240,247,0.9)',
                    }}
                  >
                    {tt('Apply all', 'Apply all')}
                  </Button>
                </Stack>

                {designPlanBusy && (
                  <Typography sx={{ fontSize: 12.5, color: 'rgba(237,240,247,0.82)' }}>
                    {tt(
                      'Bygger narrativ, slide-grammars, budsjetter og reparasjoner. Du kan redigere videre samtidig.',
                      'Building narrative, slide grammars, budgets, and repairs. You can keep editing while this runs.',
                    )}
                  </Typography>
                )}

                {designPlanError && (
                  <Typography sx={{ fontSize: 12.5, color: 'rgba(255,184,184,0.95)' }}>
                    {designPlanError}
                  </Typography>
                )}

                {aiCritiqueError && (
                  <Typography sx={{ fontSize: 12.5, color: 'rgba(255,184,184,0.95)' }}>
                    {aiCritiqueError}
                  </Typography>
                )}

                {designPlan && (
                  <Stack spacing={0.8}>
                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={`${tt('Template', 'Template')}: ${designPlan.recommendedTemplateId}`}
                        sx={{ bgcolor: 'rgba(248,179,33,0.18)', color: '#ffe8b5' }}
                      />
                      <Chip
                        size="small"
                        label={`${tt('Mode', 'Mode')}: ${designPlan.recommendedDisplayMode}`}
                        sx={{ bgcolor: 'rgba(126,232,179,0.18)', color: '#c9ffe6' }}
                      />
                      <Chip
                        size="small"
                        label={`${tt('Tema', 'Theme')}: ${designPlan.brandTokens?.labelNo || designPlan.recommendedVisualThemeId}`}
                        sx={{ bgcolor: 'rgba(92,149,255,0.16)', color: '#dce8ff' }}
                      />
                      {!!designPlan.summary.repairActionsCount && (
                        <Chip
                          size="small"
                          label={`${tt('Reparasjoner', 'Repairs')}: ${designPlan.summary.repairActionsCount}`}
                          sx={{ bgcolor: 'rgba(248,179,33,0.16)', color: '#ffe5ad' }}
                        />
                      )}
                      <Chip
                        size="small"
                        label={
                          designPlan.summary.generatedBy.includes('llm') ||
                          designPlan.summary.generatedBy.includes('orchestrator')
                            ? tt('Kilde: AI-modell', 'Source: AI model')
                            : tt('Kilde: Regelmotor', 'Source: Rule engine')
                        }
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.12)',
                          color: '#edf0f7',
                        }}
                      />
                      {designPlan.summary.model && (
                        <Chip
                          size="small"
                          label={designPlan.summary.model}
                          sx={{ bgcolor: 'rgba(92,149,255,0.18)', color: '#dce8ff' }}
                        />
                      )}
                      {!!designPlan.summary.brandContextName && (
                        <Chip
                          size="small"
                          label={`${tt('Brand', 'Brand')}: ${designPlan.summary.brandContextName}`}
                          sx={{ bgcolor: 'rgba(126,232,179,0.14)', color: '#c9ffe6' }}
                        />
                      )}
                      {!!designPlan.summary.retrievalMeta?.matchedCount && (
                        <Chip
                          size="small"
                          label={tt(
                            `Minne: ${designPlan.summary.retrievalMeta.matchedCount}`,
                            `Memory: ${designPlan.summary.retrievalMeta.matchedCount}`,
                          )}
                          sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#edf0f7' }}
                        />
                      )}
                    </Stack>
                    <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 12.5 }}>
                      {tt(
                        `Generert ${new Date(designPlan.generatedAt).toLocaleString()}.`,
                        `Generated ${new Date(designPlan.generatedAt).toLocaleString()}.`,
                      )}
                    </Typography>
                    {Array.isArray(designPlan.summary.pipeline) && designPlan.summary.pipeline.length > 0 && (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {designPlan.summary.pipeline.map((step) => (
                          <Chip
                            key={`presentation-pipeline-${step}`}
                            size="small"
                            label={step}
                            sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(237,240,247,0.82)' }}
                          />
                        ))}
                      </Stack>
                    )}
                    {Array.isArray(designPlan.summary.templateMemoryMatches) &&
                      designPlan.summary.templateMemoryMatches.length > 0 && (
                        <Box sx={{ ...PRESENTATION_DETAIL_CARD_SX, gap: 0.65, display: 'grid' }}>
                          <Typography sx={PRESENTATION_SECTION_LABEL_SX}>
                            {tt('Minne brukt i AI-planen', 'Memory used in the AI plan')}
                          </Typography>
                          <Stack spacing={0.55}>
                            {designPlan.summary.templateMemoryMatches.map((match) => (
                              <Box
                                key={`presentation-memory-match-${match.id}`}
                                sx={{
                                  borderRadius: 1,
                                  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                                  bgcolor: 'rgba(255,255,255,0.04)',
                                  px: 0.8,
                                  py: 0.7,
                                  display: 'grid',
                                  gap: 0.45,
                                }}
                              >
                                <Stack direction="row" spacing={0.5} justifyContent="space-between" alignItems="center">
                                  <Typography sx={{ fontSize: 13.1, fontWeight: 700, color: '#edf0f7' }}>
                                    {match.name}
                                  </Typography>
                                  <Chip
                                    size="small"
                                    label={`${Math.round(match.score * 100)}%`}
                                    sx={{ bgcolor: 'rgba(92,149,255,0.14)', color: '#dce8ff' }}
                                  />
                                </Stack>
                                <Typography sx={{ fontSize: 12.1, color: 'rgba(237,240,247,0.7)' }}>
                                  {match.summary || `${match.templateId} · ${match.visualThemeId}`}
                                </Typography>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                  <Chip size="small" label={match.templateId} sx={{ bgcolor: 'rgba(248,179,33,0.14)', color: '#ffe5ad' }} />
                                  <Chip size="small" label={match.visualThemeId} sx={{ bgcolor: 'rgba(126,232,179,0.14)', color: '#c9ffe6' }} />
                                  <Chip size="small" label={match.displayMode} sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#edf0f7' }} />
                                  {match.brandName && (
                                    <Chip size="small" label={match.brandName} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }} />
                                  )}
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    <Stack spacing={0.6} sx={{ maxHeight: 214, overflowY: 'auto', pr: 0.2 }}>
                      {designPlan.slides.slice(0, 8).map((slidePlan, index) => {
                        const slideTitle =
                          selectedDeck?.slides.find((slide) => slide.id === slidePlan.slideId)?.title ||
                          `${tt('Slide', 'Slide')} ${index + 1}`;
                        return (
                          <Box
                            key={`design-plan-slide-${slidePlan.slideId}`}
                            sx={{
                              borderRadius: 1,
                              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                              bgcolor: 'rgba(255,255,255,0.02)',
                              px: 0.8,
                              py: 0.7,
                              display: 'grid',
                              gap: 0.55,
                            }}
                          >
                            <Stack direction="row" spacing={0.5} justifyContent="space-between" alignItems="center">
                              <Typography sx={{ fontSize: 13.2, fontWeight: 700, color: '#edf0f7' }}>
                                {slideTitle}
                              </Typography>
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => applyDesignPlan(slidePlan.slideId)}
                                sx={{
                                  minWidth: 0,
                                  px: 0.6,
                                  textTransform: 'none',
                                  color: '#f8d675',
                                  fontSize: 12.5,
                                }}
                              >
                                {tt('Apply', 'Apply')}
                              </Button>
                            </Stack>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              <Chip
                                size="small"
                                label={slidePlan.visualType}
                                sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#edf0f7' }}
                              />
                              <Chip
                                size="small"
                                label={slidePlan.grammarId}
                                sx={{ bgcolor: 'rgba(126,232,179,0.18)', color: '#c9ffe6' }}
                              />
                              <Chip
                                size="small"
                                label={slidePlan.recommendedLayout}
                                sx={{ bgcolor: 'rgba(92,149,255,0.16)', color: '#dce8ff' }}
                              />
                              <Chip
                                size="small"
                                label={`${tt('Grafikk', 'Graphics')}: ${slidePlan.graphicSlots.length}`}
                                sx={{ bgcolor: 'rgba(248,179,33,0.16)', color: '#ffe5ad' }}
                              />
                              {slidePlan.repairActions.length > 0 && (
                                <Chip
                                  size="small"
                                  label={`${tt('Fix', 'Fix')}: ${slidePlan.repairActions.length}`}
                                  sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#edf0f7' }}
                                />
                              )}
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Stack>
                )}
              </Box>
              )}

              {shouldShowAdvanced && (
              <Box sx={{ ...panelSx, p: 1.2, display: 'grid', gap: 0.9 }}>
                <Typography sx={PRESENTATION_SECTION_LABEL_SX}>
                  {tt('Templatebibliotek', 'Template library')}
                </Typography>
                <Stack direction="row" spacing={0.8} alignItems="center">
                  <AutoAwesome sx={{ color: '#f8d56f' }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
                    {tt('Template-forslag', 'Template Suggestions')}
                  </Typography>
                </Stack>

                {templatePresets.map((template) => {
                  const active = selectedDeck?.template === template.id;
                  return (
                    <Box
                      key={template.id}
                      sx={{
                        ...PRESENTATION_DETAIL_CARD_SX,
                        border: active
                          ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.52)'
                          : PRESENTATION_DETAIL_CARD_SX.border,
                        background: active
                          ? 'linear-gradient(145deg, rgba(248,179,33,0.12), rgba(248,179,33,0.04))'
                          : PRESENTATION_DETAIL_CARD_SX.background,
                      }}
                    >
                      <Typography sx={PRESENTATION_SECTION_LABEL_SX}>
                        {tt('Template', 'Template')}
                      </Typography>
                      <Stack direction="row" spacing={0.7} justifyContent="space-between" alignItems="center">
                        <Typography sx={{ fontWeight: 700, color: '#f5f1e7' }}>
                          {tt(template.labelNo, template.labelEn)}
                        </Typography>
                        {active && (
                          <Chip
                            size="small"
                            label={tt('Aktiv', 'Active')}
                            sx={{
                              color: '#fce3a1',
                              bgcolor: 'rgba(248,179,33,0.12)',
                              border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.38)',
                            }}
                          />
                        )}
                      </Stack>
                      <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 13 }}>
                        {tt(template.descriptionNo, template.descriptionEn)}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => applyTemplate(template.id)}
                        sx={{
                          ...PRESENTATION_NEUTRAL_OUTLINED_BUTTON_SX,
                          alignSelf: 'flex-start',
                        }}
                      >
                        {tt('Bruk template', 'Use Template')}
                      </Button>
                    </Box>
                  );
                })}
              </Box>
              )}

              {shouldShowAdvanced && selectedDeck && (
                <Box sx={{ ...panelSx, p: 1.2, display: 'grid', gap: 1 }}>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <Tune sx={{ color: '#f8d56f' }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
                      {tt('Visningsoppsett', 'Display Setup')}
                    </Typography>
                  </Stack>
                  <Box sx={PRESENTATION_DETAIL_CARD_SX}>
                    <Typography sx={PRESENTATION_SECTION_LABEL_SX}>{tt('Deck', 'Deck')}</Typography>
                    <TextField
                      size="small"
                      label={tt('Presentasjonsnavn', 'Presentation Name')}
                      value={selectedDeck.name}
                      onChange={(event) => updateSelectedDeck((deck) => ({ ...deck, name: event.target.value }))}
                      sx={{
                        '& .MuiInputBase-root': { color: '#edf0f7' },
                        '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                      }}
                    />
                  </Box>

                  <Box sx={PRESENTATION_DETAIL_CARD_SX}>
                    <Typography sx={PRESENTATION_SECTION_LABEL_SX}>{tt('Brand kit', 'Brand kit')}</Typography>
                    <Select
                      size="small"
                      value={selectedDeck.brandKitId || ''}
                      onChange={(event) => applyBrandKitToSelectedDeck(String(event.target.value || ''))}
                      displayEmpty
                      sx={{
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255,255,255,0.2)',
                        },
                      }}
                    >
                      <MenuItem value="">{tt('Kun base-tema', 'Base theme only')}</MenuItem>
                      {brandKits.map((kit) => (
                        <MenuItem key={kit.id} value={kit.id}>
                          {kit.name}
                        </MenuItem>
                      ))}
                    </Select>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
                      <Button
                        size="small"
                        onClick={createBrandKitFromSelectedDeck}
                        sx={{
                          ...PRESENTATION_NEUTRAL_OUTLINED_BUTTON_SX,
                          alignSelf: 'flex-start',
                        }}
                      >
                        {tt('Nytt brand kit', 'New brand kit')}
                      </Button>
                      {selectedBrandKit && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => deleteBrandKit(selectedBrandKit.id)}
                          sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
                        >
                          {tt('Slett brand kit', 'Delete brand kit')}
                        </Button>
                      )}
                    </Stack>

                    {selectedBrandKit ? (
                      <Stack spacing={1}>
                        <TextField
                          size="small"
                          label={tt('Navn', 'Name')}
                          value={selectedBrandKit.name}
                          onChange={(event) =>
                            updateBrandKit(selectedBrandKit.id, (kit) => ({
                              ...kit,
                              name: event.target.value,
                            }))
                          }
                          sx={{
                            '& .MuiInputBase-root': { color: '#edf0f7' },
                            '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                          }}
                        />

                        <Select
                          size="small"
                          value={selectedBrandKit.baseThemeId}
                          onChange={(event) =>
                            updateBrandKit(selectedBrandKit.id, (kit) => ({
                              ...kit,
                              baseThemeId: toVisualThemeId(String(event.target.value)),
                            }))
                          }
                          sx={{
                            color: '#edf0f7',
                            bgcolor: 'rgba(255,255,255,0.04)',
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(255,255,255,0.2)',
                            },
                          }}
                        >
                          {visualThemePresets.map((themePreset) => (
                            <MenuItem key={`brand-base-theme-${themePreset.id}`} value={themePreset.id}>
                              {tt(themePreset.labelNo, themePreset.labelEn)}
                            </MenuItem>
                          ))}
                        </Select>

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8}>
                          <TextField
                            size="small"
                            type="color"
                            label={tt('Primær', 'Primary')}
                            value={selectedBrandKit.primary}
                            onChange={(event) =>
                              updateBrandKit(selectedBrandKit.id, (kit) => ({
                                ...kit,
                                primary: event.target.value,
                              }))
                            }
                            sx={{ width: { xs: '100%', md: 140 } }}
                          />
                          <TextField
                            size="small"
                            type="color"
                            label={tt('Sekundær', 'Secondary')}
                            value={selectedBrandKit.secondary}
                            onChange={(event) =>
                              updateBrandKit(selectedBrandKit.id, (kit) => ({
                                ...kit,
                                secondary: event.target.value,
                              }))
                            }
                            sx={{ width: { xs: '100%', md: 140 } }}
                          />
                          <TextField
                            size="small"
                            type="color"
                            label={tt('Aksent', 'Accent')}
                            value={selectedBrandKit.accent}
                            onChange={(event) =>
                              updateBrandKit(selectedBrandKit.id, (kit) => ({
                                ...kit,
                                accent: event.target.value,
                              }))
                            }
                            sx={{ width: { xs: '100%', md: 140 } }}
                          />
                        </Stack>

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8}>
                          <Select
                            size="small"
                            value={selectedBrandKit.headingFont}
                            onChange={(event) =>
                              updateBrandKit(selectedBrandKit.id, (kit) => ({
                                ...kit,
                                headingFont: String(event.target.value),
                              }))
                            }
                            sx={{
                              flex: 1,
                              color: '#edf0f7',
                              bgcolor: 'rgba(255,255,255,0.04)',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255,255,255,0.2)',
                              },
                            }}
                          >
                            {PRESENTATION_FONT_OPTIONS.map((fontOption) => (
                              <MenuItem key={`brand-heading-font-${fontOption}`} value={fontOption}>
                                {fontOption}
                              </MenuItem>
                            ))}
                          </Select>
                          <Select
                            size="small"
                            value={selectedBrandKit.bodyFont}
                            onChange={(event) =>
                              updateBrandKit(selectedBrandKit.id, (kit) => ({
                                ...kit,
                                bodyFont: String(event.target.value),
                              }))
                            }
                            sx={{
                              flex: 1,
                              color: '#edf0f7',
                              bgcolor: 'rgba(255,255,255,0.04)',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255,255,255,0.2)',
                              },
                            }}
                          >
                            {PRESENTATION_FONT_OPTIONS.map((fontOption) => (
                              <MenuItem key={`brand-body-font-${fontOption}`} value={fontOption}>
                                {fontOption}
                              </MenuItem>
                            ))}
                          </Select>
                        </Stack>

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8}>
                          <TextField
                            size="small"
                            label={tt('Wordmark / logo', 'Wordmark / logo')}
                            value={selectedBrandKit.logoText}
                            onChange={(event) =>
                              updateBrandKit(selectedBrandKit.id, (kit) => ({
                                ...kit,
                                logoText: event.target.value,
                              }))
                            }
                            sx={{
                              flex: 1,
                              '& .MuiInputBase-root': { color: '#edf0f7' },
                              '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                            }}
                          />
                          <TextField
                            size="small"
                            label={tt('Footer', 'Footer')}
                            value={selectedBrandKit.footerText}
                            onChange={(event) =>
                              updateBrandKit(selectedBrandKit.id, (kit) => ({
                                ...kit,
                                footerText: event.target.value,
                              }))
                            }
                            sx={{
                              flex: 1,
                              '& .MuiInputBase-root': { color: '#edf0f7' },
                              '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                            }}
                          />
                        </Stack>

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ xs: 'stretch', md: 'center' }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={selectedBrandKit.requireLogo}
                                onChange={(event) =>
                                  updateBrandKit(selectedBrandKit.id, (kit) => ({
                                    ...kit,
                                    requireLogo: event.target.checked,
                                  }))
                                }
                              />
                            }
                            label={tt('Krev logo', 'Require logo')}
                            sx={{ color: '#edf0f7', m: 0 }}
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={selectedBrandKit.requireFooter}
                                onChange={(event) =>
                                  updateBrandKit(selectedBrandKit.id, (kit) => ({
                                    ...kit,
                                    requireFooter: event.target.checked,
                                  }))
                                }
                              />
                            }
                            label={tt('Krev footer', 'Require footer')}
                            sx={{ color: '#edf0f7', m: 0 }}
                          />
                          <TextField
                            size="small"
                            label={tt('Min. kontrast', 'Min. contrast')}
                            value={selectedBrandKit.minContrastRatio}
                            onChange={(event) =>
                              updateBrandKit(selectedBrandKit.id, (kit) => ({
                                ...kit,
                                minContrastRatio: clamp(Number(event.target.value) || 4.5, 3, 7),
                              }))
                            }
                            sx={{
                              width: { xs: '100%', md: 140 },
                              '& .MuiInputBase-root': { color: '#edf0f7' },
                              '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                            }}
                          />
                        </Stack>
                      </Stack>
                    ) : (
                      <Typography sx={{ color: 'rgba(237,240,247,0.68)', fontSize: 12.8 }}>
                        {tt(
                          'Velg eller opprett et brand kit for logo, footer, farger, fonter og brand-kontroll.',
                          'Select or create a brand kit for logo, footer, colors, fonts, and brand control.',
                        )}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={PRESENTATION_DETAIL_CARD_SX}>
                    <Typography sx={PRESENTATION_SECTION_LABEL_SX}>{tt('Layout', 'Layout')}</Typography>
                    <Select
                      size="small"
                      value={selectedDeck.displayMode}
                      onChange={(event) => {
                        const nextDisplayMode = toDisplayMode(String(event.target.value));
                        updateSelectedDeck((deck) => ({
                          ...deck,
                          displayMode: nextDisplayMode,
                          splitLayoutVariant:
                            nextDisplayMode === 'split-screen'
                              ? deck.splitLayoutVariant || 'balanced'
                              : 'balanced',
                          showNavigator: false,
                        }));
                      }}
                      sx={{
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255,255,255,0.2)',
                        },
                      }}
                    >
                      <MenuItem value="picture-in-picture">{tt('Bilde-i-bilde', 'Picture in Picture')}</MenuItem>
                      <MenuItem value="side-panel">{tt('Sidepanel', 'Side Panel')}</MenuItem>
                      <MenuItem value="split-screen">{tt('Delt skjerm', 'Split Screen')}</MenuItem>
                      <MenuItem value="full-frame">{tt('Full ramme', 'Full Frame')}</MenuItem>
                    </Select>

                    <Select
                      size="small"
                      value={selectedDeck.splitLayoutVariant}
                      disabled={selectedDeck.displayMode !== 'split-screen'}
                      onChange={(event) =>
                        updateSelectedDeck((deck) => ({
                          ...deck,
                          splitLayoutVariant: toSplitLayoutVariant(String(event.target.value)),
                        }))
                      }
                      sx={{
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255,255,255,0.2)',
                        },
                      }}
                    >
                      <MenuItem value="balanced">{tt('Balansert', 'Balanced')}</MenuItem>
                      <MenuItem value="presenter-focus">{tt('Presentor-fokus', 'Presenter Focus')}</MenuItem>
                      <MenuItem value="slide-focus">{tt('Slide-fokus', 'Slide Focus')}</MenuItem>
                    </Select>

                    <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 12.5 }}>
                      {tt(
                        'Dette er standard layout for decken. Hver slide kan overstyre layout med Replace Layout i scene-listen.',
                        'This is the deck default layout. Each slide can override layout via Replace Layout in the scene list.',
                      )}
                    </Typography>
                  </Box>

                  <Box sx={PRESENTATION_DETAIL_CARD_SX}>
                    <Typography sx={PRESENTATION_SECTION_LABEL_SX}>{tt('Plassering', 'Placement')}</Typography>
                    <Select
                      size="small"
                      value={selectedDeck.placement}
                      onChange={(event) =>
                        updateSelectedDeck((deck) => ({
                          ...deck,
                          placement: toPlacement(String(event.target.value)),
                        }))
                      }
                      sx={{
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255,255,255,0.2)',
                        },
                      }}
                    >
                      <MenuItem value="top-right">{tt('Topp hoyre', 'Top Right')}</MenuItem>
                      <MenuItem value="top-left">{tt('Topp venstre', 'Top Left')}</MenuItem>
                      <MenuItem value="bottom-right">{tt('Bunn hoyre', 'Bottom Right')}</MenuItem>
                      <MenuItem value="bottom-left">{tt('Bunn venstre', 'Bottom Left')}</MenuItem>
                      <MenuItem value="center">{tt('Senter', 'Center')}</MenuItem>
                    </Select>

                    <Box>
                      <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 13, mb: 0.4 }}>
                        {tt('Synlighet', 'Opacity')}: {Math.round(selectedDeck.opacity * 100)}%
                      </Typography>
                      <Slider
                        value={selectedDeck.opacity}
                        min={0.2}
                        max={1}
                        step={0.02}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          updateSelectedDeck((deck) => ({
                            ...deck,
                            opacity: clamp(Number(next), 0.2, 1),
                          }));
                        }}
                        sx={{ color: '#f8b321' }}
                      />
                    </Box>
                  </Box>

                  <Box sx={PRESENTATION_DETAIL_CARD_SX}>
                    <Typography sx={PRESENTATION_SECTION_LABEL_SX}>{tt('Status', 'Status')}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography sx={{ color: 'rgba(237,240,247,0.76)' }}>
                        {tt('Totale slides', 'Total slides')}
                      </Typography>
                      <Chip
                        label={selectedDeck.slides.length}
                        size="small"
                        sx={{
                          color: '#fce3a1',
                          bgcolor: 'rgba(248,179,33,0.12)',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.34)',
                        }}
                      />
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography sx={{ color: 'rgba(237,240,247,0.76)' }}>
                        {tt('Tidsdekning', 'Timeline coverage')}
                      </Typography>
                      <Chip
                        label={`${Math.round(
                          selectedDeck.slides.reduce((sum, slide) => sum + slide.duration, 0),
                        )}s`}
                        size="small"
                        sx={{
                          color: '#d7f3ff',
                          bgcolor: 'rgba(79,195,247,0.14)',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(79,195,247,0.34)',
                        }}
                      />
                    </Stack>
                  </Box>
                </Box>
              )}

              {shouldShowAdvanced && (
              <Box sx={{ ...panelSx, p: 1.2, display: 'grid', gap: 0.9 }}>
                <Typography sx={PRESENTATION_SECTION_LABEL_SX}>
                  {tt('Publiseringsflyt', 'Publishing workflow')}
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 17 }}>
                  {tt('Publiseringsstatus', 'Publishing Status')}
                </Typography>
                <Box sx={PRESENTATION_DETAIL_CARD_SX}>
                  <Typography sx={PRESENTATION_SECTION_LABEL_SX}>
                    {tt('Klargjøring', 'Readiness')}
                  </Typography>
                  <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label={
                        qualitySummary.canPublish
                          ? tt('Klar for publisering', 'Ready to publish')
                          : tt('Må løse kritiske funn', 'Critical findings must be fixed')
                      }
                      sx={{
                        bgcolor: qualitySummary.canPublish ? 'rgba(126,232,179,0.18)' : 'rgba(255,122,122,0.2)',
                        color: qualitySummary.canPublish ? '#cbffe8' : '#ffd7d7',
                        fontWeight: 700,
                      }}
                    />
                    <Chip
                      size="small"
                      label={tt(
                        `${qualitySummary.errorCount} kritiske`,
                        `${qualitySummary.errorCount} critical`,
                      )}
                      sx={{ bgcolor: 'rgba(255,122,122,0.16)', color: '#ffd6d6' }}
                    />
                    <Chip
                      size="small"
                      label={tt(
                        `${qualitySummary.warningCount} varsler`,
                        `${qualitySummary.warningCount} warnings`,
                      )}
                      sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#edf0f7' }}
                    />
                  </Stack>
                </Box>
                <Box sx={PRESENTATION_DETAIL_CARD_SX}>
                  <Typography sx={PRESENTATION_SECTION_LABEL_SX}>
                    {tt('Fremdrift', 'Progress')}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(
                      100,
                      Math.round(
                        ((selectedDeck?.slides.length || 0) / 5) * 50 +
                          ((selectedDeck?.sourceName ? 1 : 0) * 25) +
                          ((selectedDeck?.template ? 1 : 0) * 25),
                      ),
                    )}
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      bgcolor: 'rgba(255,255,255,0.1)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, #f8b321, #ffd45e)',
                      },
                    }}
                  />
                  <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 13 }}>
                    {tt(
                      'Lagre for utkast eller publiser for a synkronisere presentasjonen i spilleren.',
                      'Save for draft or publish to sync the presentation in the player.',
                    )}
                  </Typography>
                </Box>
                {selectedDeck && (
                  <Box sx={PRESENTATION_DETAIL_CARD_SX}>
                    <Typography sx={PRESENTATION_SECTION_LABEL_SX}>
                      {tt('Designscore', 'Design score')}
                    </Typography>
                    <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={tt(
                          `Total ${qualitySummary.designScore}/100`,
                          `Overall ${qualitySummary.designScore}/100`,
                        )}
                        sx={{
                          bgcolor:
                            qualitySummary.designScore >= 86
                              ? 'rgba(126,232,179,0.18)'
                              : qualitySummary.designScore >= 72
                                ? 'rgba(248,179,33,0.18)'
                                : 'rgba(255,122,122,0.2)',
                          color:
                            qualitySummary.designScore >= 86
                              ? '#caffea'
                              : qualitySummary.designScore >= 72
                                ? '#ffe6b8'
                                : '#ffd6d6',
                          fontWeight: 700,
                        }}
                      />
                      <Chip size="small" label={tt(`Innhold ${designEvaluation.content}`, `Content ${designEvaluation.content}`)} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }} />
                      <Chip size="small" label={tt(`Hierarki ${designEvaluation.hierarchy}`, `Hierarchy ${designEvaluation.hierarchy}`)} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }} />
                      <Chip size="small" label={tt(`Balanse ${designEvaluation.balance}`, `Balance ${designEvaluation.balance}`)} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }} />
                      <Chip size="small" label={tt(`Visuals ${designEvaluation.visuals}`, `Visuals ${designEvaluation.visuals}`)} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }} />
                      <Chip size="small" label={tt(`Grammar ${designEvaluation.grammar}`, `Grammar ${designEvaluation.grammar}`)} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }} />
                      <Chip
                        size="small"
                        label={tt(`Brand ${qualitySummary.brandScore}`, `Brand ${qualitySummary.brandScore}`)}
                        sx={{
                          bgcolor:
                            qualitySummary.brandScore >= 86
                              ? 'rgba(126,232,179,0.18)'
                              : qualitySummary.brandScore >= 72
                                ? 'rgba(248,179,33,0.18)'
                                : 'rgba(255,122,122,0.2)',
                          color:
                            qualitySummary.brandScore >= 86
                              ? '#caffea'
                              : qualitySummary.brandScore >= 72
                                ? '#ffe6b8'
                            : '#ffd6d6',
                        }}
                      />
                      {qualitySummary.aiScore !== null && (
                        <Chip
                          size="small"
                          label={tt(`AI ${qualitySummary.aiScore}`, `AI ${qualitySummary.aiScore}`)}
                          sx={{
                            bgcolor:
                              qualitySummary.aiScore >= 86
                                ? 'rgba(126,232,179,0.18)'
                                : qualitySummary.aiScore >= 72
                                  ? 'rgba(92,149,255,0.18)'
                                  : 'rgba(255,122,122,0.2)',
                            color:
                              qualitySummary.aiScore >= 86
                                ? '#caffea'
                                : qualitySummary.aiScore >= 72
                                  ? '#dce8ff'
                                  : '#ffd6d6',
                          }}
                        />
                      )}
                      {canvasContrastRatio !== null && (
                        <Chip
                          size="small"
                          label={tt(
                            `Kontrast ${canvasContrastRatio.toFixed(1)}:1`,
                            `Contrast ${canvasContrastRatio.toFixed(1)}:1`,
                          )}
                          sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                        />
                      )}
                    </Stack>
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12.6, lineHeight: 1.45 }}>
                      {tt(
                        'Scoren vurderer tekstbudsjett, visuelt hierarki, balanse, slide grammar, brand policy og om visuals er faktiske assets.',
                        'The score evaluates text budget, visual hierarchy, balance, slide grammar, brand policy, and whether visuals are real assets.',
                      )}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AutoAwesome />}
                      onClick={repairDeckDesign}
                      disabled={designPlanBusy}
                      sx={{
                        alignSelf: 'flex-start',
                        ...PRESENTATION_NEUTRAL_OUTLINED_BUTTON_SX,
                        borderColor: 'rgba(126,232,179,0.34)',
                        color: '#caffea',
                        bgcolor: 'rgba(126,232,179,0.08)',
                      }}
                    >
                      {tt('Repair deck', 'Repair deck')}
                    </Button>
                    {aiCritique && (
                      <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 12.2 }}>
                        {tt(
                          `AI-kritikk: ${aiCritique.model} · ${new Date(aiCritique.generatedAt).toLocaleTimeString()}`,
                          `AI critique: ${aiCritique.model} · ${new Date(aiCritique.generatedAt).toLocaleTimeString()}`,
                        )}
                      </Typography>
                    )}
                  </Box>
                )}
                {aiCritique && aiCritique.findings.length > 0 && (
                  <Box sx={PRESENTATION_DETAIL_CARD_SX}>
                    <Typography sx={PRESENTATION_SECTION_LABEL_SX}>
                      {tt('AI-funn', 'AI findings')}
                    </Typography>
                    <Stack spacing={0.55}>
                      {aiCritique.findings.slice(0, 5).map((finding) => (
                        <Box
                          key={`presentation-ai-finding-${finding.id}`}
                          sx={{
                            borderRadius: 1,
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                            bgcolor: 'rgba(255,255,255,0.04)',
                            px: 0.8,
                            py: 0.7,
                            display: 'grid',
                            gap: 0.35,
                          }}
                        >
                          <Typography
                            sx={{
                              color:
                                finding.severity === 'error'
                                  ? 'rgba(255,210,210,0.94)'
                                  : 'rgba(216,230,255,0.92)',
                              fontSize: 12.3,
                              lineHeight: 1.35,
                              fontWeight: 700,
                            }}
                          >
                            {tt(finding.messageNo, finding.messageEn)}
                          </Typography>
                          <Typography sx={{ color: 'rgba(237,240,247,0.68)', fontSize: 12 }}>
                            {tt(finding.repairHintNo, finding.repairHintEn)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
                {qualityIssues.length > 0 && (
                  <Box sx={PRESENTATION_DETAIL_CARD_SX}>
                    <Typography sx={PRESENTATION_SECTION_LABEL_SX}>
                      {tt('Åpne funn', 'Open findings')}
                    </Typography>
                    <Stack spacing={0.45}>
                      {qualityIssues.slice(0, 6).map((issue) => (
                        <Typography
                          key={issue.id}
                          sx={{
                            color:
                              issue.severity === 'error'
                                ? 'rgba(255,210,210,0.94)'
                                : 'rgba(255,229,184,0.9)',
                            fontSize: 12.2,
                            lineHeight: 1.35,
                          }}
                        >
                          {issue.severity === 'error' ? '•' : '◦'} {tt(issue.messageNo, issue.messageEn)}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyPresentationOverlayStudio, {
  componentId: 'academy-presentation-overlay-studio',
  componentName: 'Academy Presentation Studio',
  componentType: 'editor',
  componentCategory: 'academy',
  featureIds: ['academy-presentation-overlay', 'academy-ppt-upload', 'academy-slide-placement'],
});
