import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
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
  DeleteOutline,
  Description,
  Edit,
  FileUpload,
  InfoOutlined,
  MailOutline,
  NotificationsNone,
  PlayArrow,
  Publish,
  Save,
  Search,
  Slideshow,
  Tune,
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
import { apiRequest } from '@/lib/queryClient';

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
  colors: {
    navBg: string;
    navCardBg: string;
    navCardActiveBg: string;
    navText: string;
    navAccent: string;
    canvasBg: string;
    canvasCardBg: string;
    canvasCardBorder: string;
    canvasTitle: string;
    canvasText: string;
    presenterBg: string;
    presenterCardBg: string;
    presenterText: string;
    chipBg: string;
    chipText: string;
  };
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
}

interface PresentationDeck {
  id: string;
  name: string;
  template: PresentationTemplateId;
  visualThemeId: PresentationVisualThemeId;
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
};

type PresentationStoreMap = Record<string, PresentationStoreEntry>;

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

type PresentationDesignVisualType =
  | 'title'
  | 'agenda'
  | 'problem'
  | 'solution'
  | 'feature'
  | 'process'
  | 'kpi'
  | 'timeline'
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
}

interface PresentationDesignSlidePlan {
  slideId: string;
  visualType: PresentationDesignVisualType;
  layoutHint: string;
  recommendedLayout: PresentationDisplayMode;
  confidence: number;
  reasons: string[];
  intentTags: string[];
  copySuggestions: {
    title: string;
    body: string[];
    cta: string;
  };
  graphicSlots: PresentationDesignGraphicSlot[];
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
    model?: string;
    slideCount: number;
    visualCounts: Record<PresentationDesignVisualType, number>;
  };
  slides: PresentationDesignSlidePlan[];
  generatedAt: string;
}

const academyShellMaxWidth = 'min(100%, var(--academy-shell-max-width, 2880px))';
const panelSx = {
  borderRadius: 1.4,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const PRESENTATION_VIDEO_PLACEHOLDER = '/assets/academy/intro-video.mp4';
const PRESENTATION_STORE_KEY = 'academyPresentationOverlayStoreV1';
const PRESENTATION_KV_KEY = 'academy_presentation_overlay_store_v1';
const PRESENTATION_EDITOR_PREFS_KEY = 'academy_presentation_editor_prefs_v1';
const PRESENTATION_RESOURCE_ID_PREFIX = 'presentation-resource-';
const PRESENTATION_RESOURCE_COURSE_PREFIX = 'presentation-resource-course-';
const PRESENTATION_RESOURCE_SKILL_PREFIX = 'presentation-resource-skill-';
const TELEPROMPTER_SPEAKER_ALL = '__all__';
const TELEPROMPTER_SYNC_POLL_INTERVAL_MS = 1600;
const TELEPROMPTER_SYNC_POLL_ATTEMPTS = 120;

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
    labelNo: 'Noytral modern',
    labelEn: 'Neutral Modern',
    descriptionNo: 'Ren og allsidig visuell stil for generell opplaring og demo.',
    descriptionEn: 'Clean, versatile style for general training and demos.',
    preferredTemplate: 'walkthrough',
    preferredMode: 'split-screen',
    splitLayoutVariant: 'balanced',
    colors: {
      navBg: 'linear-gradient(180deg, rgba(30,46,70,0.86), rgba(12,21,34,0.9))',
      navCardBg: 'rgba(7,14,25,0.38)',
      navCardActiveBg: 'rgba(128,176,238,0.3)',
      navText: '#f2f6ff',
      navAccent: '#82b0ee',
      canvasBg: 'linear-gradient(180deg, rgba(244,248,255,0.98), rgba(229,237,248,0.96))',
      canvasCardBg: 'rgba(255,255,255,0.78)',
      canvasCardBorder: 'rgba(66,103,142,0.25)',
      canvasTitle: '#1f3a5d',
      canvasText: '#2e4b68',
      presenterBg: 'linear-gradient(180deg, rgba(8,12,20,0.14), rgba(8,12,20,0.34))',
      presenterCardBg: 'rgba(7,12,20,0.48)',
      presenterText: '#f5f1e7',
      chipBg: 'rgba(255,255,255,0.14)',
      chipText: '#f5f8ff',
    },
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
    colors: {
      navBg: 'linear-gradient(180deg, rgba(48,24,18,0.9), rgba(18,12,8,0.92))',
      navCardBg: 'rgba(29,16,10,0.56)',
      navCardActiveBg: 'rgba(248,179,33,0.35)',
      navText: '#ffeccc',
      navAccent: '#f8b321',
      canvasBg: 'linear-gradient(180deg, rgba(255,248,236,0.98), rgba(252,239,215,0.98))',
      canvasCardBg: 'rgba(255,255,255,0.82)',
      canvasCardBorder: 'rgba(166,108,26,0.26)',
      canvasTitle: '#5f2d08',
      canvasText: '#6a3b17',
      presenterBg: 'linear-gradient(180deg, rgba(37,20,12,0.4), rgba(20,12,8,0.48))',
      presenterCardBg: 'rgba(35,18,10,0.55)',
      presenterText: '#ffe8c1',
      chipBg: 'rgba(248,179,33,0.22)',
      chipText: '#fff0cf',
    },
  },
  {
    id: 'operations-grid',
    labelNo: 'Operations Grid',
    labelEn: 'Operations Grid',
    descriptionNo: 'Systematisk og industriell stil for prosedyre- og driftstrening.',
    descriptionEn: 'Systematic, industrial visual language for operations training.',
    preferredTemplate: 'walkthrough',
    preferredMode: 'split-screen',
    splitLayoutVariant: 'presenter-focus',
    colors: {
      navBg: 'linear-gradient(180deg, rgba(18,40,38,0.9), rgba(8,20,21,0.92))',
      navCardBg: 'rgba(8,26,25,0.54)',
      navCardActiveBg: 'rgba(52,173,140,0.36)',
      navText: '#dcfff6',
      navAccent: '#34ad8c',
      canvasBg: 'linear-gradient(180deg, rgba(237,252,247,0.98), rgba(225,245,238,0.98))',
      canvasCardBg: 'rgba(255,255,255,0.8)',
      canvasCardBorder: 'rgba(33,118,98,0.24)',
      canvasTitle: '#0b5a4a',
      canvasText: '#1a5f52',
      presenterBg: 'linear-gradient(180deg, rgba(9,24,22,0.32), rgba(8,19,17,0.46))',
      presenterCardBg: 'rgba(8,24,22,0.52)',
      presenterText: '#d8fff4',
      chipBg: 'rgba(52,173,140,0.22)',
      chipText: '#ddfff6',
    },
  },
  {
    id: 'offshore-briefing',
    labelNo: 'Offshore Briefing',
    labelEn: 'Offshore Briefing',
    descriptionNo: 'Kontraststerk beredskapsstil for sikkerhets- og hendelsesflyt.',
    descriptionEn: 'High-contrast briefing style for safety and incident flow.',
    preferredTemplate: 'training-deep-dive',
    preferredMode: 'split-screen',
    splitLayoutVariant: 'balanced',
    colors: {
      navBg: 'linear-gradient(180deg, rgba(12,28,53,0.92), rgba(7,14,28,0.95))',
      navCardBg: 'rgba(9,20,37,0.56)',
      navCardActiveBg: 'rgba(92,149,255,0.34)',
      navText: '#deebff',
      navAccent: '#5c95ff',
      canvasBg: 'linear-gradient(180deg, rgba(240,247,255,0.98), rgba(227,237,252,0.98))',
      canvasCardBg: 'rgba(255,255,255,0.82)',
      canvasCardBorder: 'rgba(44,86,147,0.26)',
      canvasTitle: '#173b6c',
      canvasText: '#204570',
      presenterBg: 'linear-gradient(180deg, rgba(9,16,29,0.26), rgba(8,12,22,0.4))',
      presenterCardBg: 'rgba(8,14,26,0.5)',
      presenterText: '#e4eeff',
      chipBg: 'rgba(92,149,255,0.2)',
      chipText: '#e4eeff',
    },
  },
];

const projectTemplateToVisualTheme: Record<string, PresentationVisualThemeId> = {
  'sales-enablement-a-a': 'sales-command',
  'production-operations-a-a': 'operations-grid',
  'offshore-safety-a-a': 'offshore-briefing',
};

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

const parseHexColor = (value: string): { r: number; g: number; b: number } | null => {
  const match = String(value || '').match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  if (!match) return null;
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
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);
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

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

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
        .map((entry) => {
          if (!isObjectRecord(entry)) return null;
          const copySuggestions = isObjectRecord(entry.copySuggestions) ? entry.copySuggestions : {};
          const graphicSlots = Array.isArray(entry.graphicSlots)
            ? entry.graphicSlots
                .map((slot) => {
                  if (!isObjectRecord(slot)) return null;
                  return {
                    id: String(slot.id || `slot-${Date.now()}`),
                    kind: toDesignGraphicKind(String(slot.kind || 'illustration')),
                    label: String(slot.label || '').trim(),
                    prompt: String(slot.prompt || '').trim(),
                    x: clamp(Number(slot.x) || 0, 0, 100),
                    y: clamp(Number(slot.y) || 0, 0, 100),
                    width: clamp(Number(slot.width) || 20, 1, 100),
                    height: clamp(Number(slot.height) || 12, 1, 100),
                  };
                })
                .filter((slot): slot is PresentationDesignGraphicSlot => Boolean(slot))
            : [];

          return {
            slideId: String(entry.slideId || '').trim(),
            visualType: toDesignVisualType(String(entry.visualType || 'feature')),
            layoutHint: String(entry.layoutHint || '').trim(),
            recommendedLayout: toDisplayMode(String(entry.recommendedLayout || 'split-screen')),
            confidence: clamp(Number(entry.confidence) || 0.5, 0, 1),
            reasons: Array.isArray(entry.reasons)
              ? entry.reasons.map((reason) => String(reason || '').trim()).filter(Boolean)
              : [],
            intentTags: Array.isArray(entry.intentTags)
              ? entry.intentTags.map((tag) => String(tag || '').trim()).filter(Boolean)
              : [],
            copySuggestions: {
              title: String(copySuggestions.title || '').trim(),
              body: Array.isArray(copySuggestions.body)
                ? copySuggestions.body.map((line) => String(line || '').trim()).filter(Boolean)
                : [],
              cta: String(copySuggestions.cta || '').trim(),
            },
            graphicSlots,
          } as PresentationDesignSlidePlan;
        })
        .filter((entry): entry is PresentationDesignSlidePlan => Boolean(entry && entry.slideId))
    : [];

  if (slides.length === 0) return null;

  return {
    scope: rawData.scope === 'skill' ? 'skill' : 'course',
    courseId: String(rawData.courseId || '').trim(),
    lessonId: String(rawData.lessonId || '').trim(),
    deckName: String(rawData.deckName || '').trim(),
    recommendedTemplateId: toTemplateId(String(rawData.recommendedTemplateId || 'walkthrough')),
    recommendedVisualThemeId: toVisualThemeId(String(rawData.recommendedVisualThemeId || 'neutral-modern')),
    recommendedDisplayMode: toDisplayMode(String(rawData.recommendedDisplayMode || 'split-screen')),
    recommendedSplitLayoutVariant: toSplitLayoutVariant(
      String(rawData.recommendedSplitLayoutVariant || 'balanced'),
    ),
    summary: {
      generatedBy: String(summary.generatedBy || 'academy-design-plan-heuristic-v1'),
      model: String(summary.model || '').trim() || undefined,
      slideCount: Math.max(0, Number(summary.slideCount) || slides.length),
      visualCounts,
    },
    slides,
    generatedAt: String(rawData.generatedAt || new Date().toISOString()),
  };
};

const designGraphicKindToElementType = (
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
  { type: 'process', keywords: ['step', 'workflow', 'prosess', 'flyt', 'how to'] },
  { type: 'kpi', keywords: ['kpi', 'result', 'vekst', 'revenue', 'conversion'] },
  { type: 'timeline', keywords: ['timeline', 'roadmap', 'mile', 'phase', 'q1', 'q2', 'q3', 'q4'] },
  { type: 'comparison', keywords: ['compare', 'vs', 'versus', 'before', 'after'] },
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
    if (index >= totalSlides - 1) return 'summary';
    return 'feature';
  }
  if (index === 0 && /(welcome|velkommen|intro|introduksjon)/i.test(normalized)) {
    return 'title';
  }

  let best: PresentationDesignVisualType = index >= totalSlides - 1 ? 'summary' : 'feature';
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

const layoutForLocalDesignVisualType = (visualType: PresentationDesignVisualType): PresentationDisplayMode => {
  if (visualType === 'title') return 'full-frame';
  if (visualType === 'agenda' || visualType === 'summary') return 'side-panel';
  if (visualType === 'quote' || visualType === 'cta') return 'picture-in-picture';
  return 'split-screen';
};

const graphicSlotsForLocalDesignVisualType = (
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
  return [
    createSlot('main', 'illustration', 'Main visual', `${promptBase} main visual`, 54, 14, 40, 58),
    createSlot('icon', 'icon', 'Support icon', `${promptBase} support icon`, 56, 74, 14, 10),
  ];
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
  const mappedTheme =
    projectTemplateToVisualTheme[projectTemplateId] || deck.visualThemeId || 'neutral-modern';
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
    return {
      slideId: slide.id,
      visualType,
      layoutHint:
        visualType === 'kpi'
          ? 'Prioritize numeric contrast and trend direction.'
          : visualType === 'timeline'
            ? 'Place chronological flow from top to bottom with clear milestones.'
            : 'Balance presenter and slide hierarchy.',
      recommendedLayout: layoutForLocalDesignVisualType(visualType),
      confidence: 0.62,
      reasons: ['local heuristic fallback'],
      intentTags: [visualType, mappedTemplate, mappedTheme],
      copySuggestions: {
        title: slide.title,
        body: bodyLines,
        cta: useNorwegian
          ? 'Oppsummer og avtal neste steg.'
          : 'Summarize and confirm next step.',
      },
      graphicSlots: graphicSlotsForLocalDesignVisualType(slide.id, visualType, slide.title),
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
      generatedBy: 'academy-design-plan-local-fallback-v1',
      slideCount: slides.length,
      visualCounts,
    },
    slides,
    generatedAt: new Date().toISOString(),
  };
};

const getVisualThemePresetById = (
  themeId: PresentationVisualThemeId,
): PresentationVisualThemePreset =>
  visualThemePresets.find((entry) => entry.id === themeId) || visualThemePresets[0];

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
  const mappedTheme = projectTemplateToVisualTheme[projectTemplateId] || 'neutral-modern';
  const mappedTemplate = projectTemplateToPresentationTemplate[projectTemplateId] || 'walkthrough';
  const themePreset = getVisualThemePresetById(mappedTheme);
  return {
    templateId: mappedTemplate || themePreset.preferredTemplate,
    visualThemeId: mappedTheme,
    defaultMode: themePreset.preferredMode,
    splitLayoutVariant: themePreset.splitLayoutVariant,
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
  return [
    {
      id: `scene-el-title-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'text',
      text: title,
      x: wide ? 8 : 12,
      y: 10,
      width: wide ? 56 : 76,
      height: 18,
    },
    {
      id: `scene-el-body-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'text',
      text: '',
      x: wide ? 8 : 12,
      y: 32,
      width: wide ? 56 : 76,
      height: 50,
    },
  ];
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
): string => {
  const theme = getVisualThemePresetById(themeId);
  const width = 1280;
  const height = 720;
  const headerHeight = 92;
  const margin = 28;
  const elementMarkup = slide.elements
    .slice(0, 18)
    .map((element, index) => {
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
        const textColor = index === 0 ? theme.colors.canvasTitle : theme.colors.canvasText;
        return `
          <rect x="${safeX}" y="${safeY}" width="${safeW}" height="${safeH}" rx="14" ry="14"
            fill="${theme.colors.canvasCardBg}" stroke="${theme.colors.canvasCardBorder}" stroke-width="1.2" />
          ${lines
            .map(
              (line, lineIndex) => `
                <text x="${safeX + 16}" y="${safeY + 24 + lineIndex * 22}"
                  fill="${textColor}"
                  font-family="Barlow, Manrope, Segoe UI, sans-serif"
                  font-size="${index === 0 ? 24 : 18}"
                  font-weight="${index === 0 ? 700 : 600}">
                  ${escapeSvgText(line)}
                </text>`,
            )
            .join('')}
        `;
      }

      return `
        <rect x="${safeX}" y="${safeY}" width="${safeW}" height="${safeH}" rx="14" ry="14"
          fill="${theme.colors.canvasCardBg}" stroke="${theme.colors.canvasCardBorder}" stroke-width="1.2" />
        <rect x="${safeX + 10}" y="${safeY + 10}" width="${Math.max(34, safeW - 20)}" height="${Math.max(26, safeH - 20)}"
          rx="10" ry="10" fill="rgba(0,0,0,0.08)" />
      `;
    })
    .join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="slideBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#f4f7fb" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#slideBg)" />
      <rect x="0" y="0" width="${width}" height="${headerHeight}" fill="rgba(17,31,49,0.92)" />
      <text x="${margin}" y="42" fill="#f2f6ff" font-family="Barlow, Manrope, Segoe UI, sans-serif" font-size="17" font-weight="700">
        ${escapeSvgText(deckName || 'Presentation')}
      </text>
      <text x="${margin}" y="74" fill="#fef0cb" font-family="Barlow, Manrope, Segoe UI, sans-serif" font-size="28" font-weight="800">
        ${escapeSvgText(slide.title || 'Slide')}
      </text>
      ${elementMarkup}
    </svg>
  `;

  return encodeSvgToDataUrl(svg);
};

const hydrateSlidePreview = (
  slide: PresentationSlide,
  themeId: PresentationVisualThemeId,
  deckName: string,
  options?: { force?: boolean },
): PresentationSlide => {
  const force = options?.force === true;
  const previewImageUrl =
    (!force ? String(slide.previewImageUrl || '').trim() : '') ||
    buildSlideSvgPreview(slide, themeId, deckName);
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

const createDeckFromTemplate = (
  templateId: PresentationTemplateId,
  targetDuration: number,
  useNorwegian: boolean,
  sourceName?: string,
  sourceType?: string,
  visualThemeId: PresentationVisualThemeId = 'neutral-modern',
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
    String((deck as Partial<PresentationDeck>).visualThemeId || 'neutral-modern'),
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

  const [leftNav, setLeftNav] = useState('tool-presentation');
  const [search, setSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || routeCourseId || '');
  const [scope, setScope] = useState<PresentationScope>(routeLessonId ? 'skill' : 'course');
  const [selectedSkillId, setSelectedSkillId] = useState(routeLessonId || '');
  const [decks, setDecks] = useState<PresentationDeck[]>([]);
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
  const [saveMessage, setSaveMessage] = useState('');

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hydratedScopeKeyRef = useRef<string>('');
  const userMutationTickRef = useRef(0);
  const teleprompterLastTickRef = useRef<number | null>(null);
  const teleprompterViewportRef = useRef<HTMLDivElement | null>(null);
  const teleprompterSpeechSyncRunRef = useRef(0);
  const teleprompterSpeechCacheRef = useRef<Map<string, TeleprompterSpeechCacheEntry>>(new Map());

  const markUserMutation = useCallback(() => {
    userMutationTickRef.current += 1;
  }, []);

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

  const scopeResources = useMemo<Array<CourseResource | LessonResource>>(() => {
    if (effectiveScope === 'skill') {
      return Array.isArray(selectedSkill?.resources) ? selectedSkill.resources : [];
    }
    return Array.isArray(activeCourse?.resources) ? activeCourse.resources : [];
  }, [activeCourse?.resources, effectiveScope, selectedSkill?.resources]);

  const resolvedCourseId = useMemo(
    () => String(activeCourse?.id || selectedCourseValue || routeCourseId || '').trim(),
    [activeCourse?.id, routeCourseId, selectedCourseValue],
  );

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
      const key = `${item.deckId}::${item.template}::${item.visualThemeId}::${item.displayMode}::${item.splitLayoutVariant}::${item.placement}::${item.sourceName}`;
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
      const nextDuration = Math.max(60, Number(localEntry.duration) || targetDuration);
      setDuration(nextDuration);
      setCurrentTime((prev) => Math.min(prev, nextDuration));
      return;
    }

    if (resourceDerivedDecks.length > 0) {
      setDecks(resourceDerivedDecks);
      setSelectedDeckId(resourceDerivedDecks[0]?.id || '');
      setDuration(targetDuration);
      setCurrentTime((prev) => Math.min(prev, targetDuration));
      return;
    }

    const defaultDeck = createDeckFromTemplate(
      presentationDefaultsForCourse.templateId,
      targetDuration,
      isNorwegian,
      '',
      '',
      presentationDefaultsForCourse.visualThemeId,
      presentationDefaultsForCourse.splitLayoutVariant,
    );
    setDecks([defaultDeck]);
    setSelectedDeckId(defaultDeck.id);
    setDuration(targetDuration);
    setCurrentTime((prev) => Math.min(prev, targetDuration));
  }, [isNorwegian, presentationDefaultsForCourse, resourceDerivedDecks, scopeStorageKey, targetDuration]);

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
        return;
      }
      if (userMutationTickRef.current !== mutationAtStart) {
        return;
      }

      const normalized = mergedEntry.decks.map((deck) => normalizeDeck(deck, targetDuration));
      setDecks(normalized);
      setSelectedDeckId(normalized[0]?.id || '');
      const nextDuration = Math.max(60, Number(mergedEntry.duration) || targetDuration);
      setDuration(nextDuration);
      setCurrentTime((prev) => Math.min(prev, nextDuration));
    })();

    return () => {
      cancelled = true;
    };
  }, [scopeStorageKey, targetDuration]);

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

  const filteredDecks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return decks;
    return decks.filter((deck) => {
      return (
        deck.name.toLowerCase().includes(query) ||
        deck.sourceName.toLowerCase().includes(query) ||
        deck.slides.some((slide) => slide.title.toLowerCase().includes(query))
      );
    });
  }, [decks, search]);

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
    () => getVisualThemePresetById(selectedDeck?.visualThemeId || presentationDefaultsForCourse.visualThemeId),
    [presentationDefaultsForCourse.visualThemeId, selectedDeck?.visualThemeId],
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

  const qualityIssues = useMemo<PresentationQualityIssue[]>(() => {
    if (!selectedDeck) return [];
    const issues: PresentationQualityIssue[] = [];
    const ordered = [...selectedDeck.slides].sort(
      (left, right) => Number(left.startTime || 0) - Number(right.startTime || 0),
    );
    const maxTimeline = Math.max(60, duration);

    ordered.forEach((slide) => {
      if (slide.duration < 3) {
        issues.push({
          id: `short-duration-${slide.id}`,
          slideId: slide.id,
          severity: 'warning',
          messageNo: `"${slide.title}" har for kort varighet (< 3s).`,
          messageEn: `"${slide.title}" has a very short duration (< 3s).`,
        });
      }

      const end = slide.startTime + slide.duration;
      if (end > maxTimeline + 0.001) {
        issues.push({
          id: `out-of-bounds-timeline-${slide.id}`,
          slideId: slide.id,
          severity: 'error',
          messageNo: `"${slide.title}" går utenfor total tidslinje.`,
          messageEn: `"${slide.title}" exceeds the total timeline.`,
        });
      }

      const overlap = slideOverlapMap.get(String(slide.id)) || 0;
      if (overlap > 0) {
        issues.push({
          id: `overlap-${slide.id}`,
          slideId: slide.id,
          severity: overlap > 0.6 ? 'error' : 'warning',
          messageNo: `"${slide.title}" overlapper andre slides (${overlap.toFixed(1)}s).`,
          messageEn: `"${slide.title}" overlaps other slides (${overlap.toFixed(1)}s).`,
        });
      }

      slide.elements.forEach((element) => {
        if (element.x < 0 || element.y < 0 || element.x + element.width > 100 || element.y + element.height > 100) {
          issues.push({
            id: `element-bounds-${slide.id}-${element.id}`,
            slideId: slide.id,
            severity: 'warning',
            messageNo: `"${slide.title}" har element utenfor safe bounds.`,
            messageEn: `"${slide.title}" has an element outside safe bounds.`,
          });
        }
        if (element.type === 'text' && String(element.text || '').trim().length > 130) {
          issues.push({
            id: `mobile-text-${slide.id}-${element.id}`,
            slideId: slide.id,
            severity: 'warning',
            messageNo: `"${slide.title}" har tekst som er for lang for mobil.`,
            messageEn: `"${slide.title}" has text that is too long for mobile.`,
          });
        }
      });
    });

    const ratio = contrastRatio(
      selectedVisualThemePreset.colors.canvasText,
      selectedVisualThemePreset.colors.canvasBg,
    );
    if (ratio !== null && ratio < 3.5) {
      issues.push({
        id: 'contrast-theme',
        severity: 'warning',
        messageNo: 'Temaets kontrast i canvas kan være for lav.',
        messageEn: 'Theme contrast in canvas may be too low.',
      });
    }

    return issues;
  }, [duration, selectedDeck, selectedVisualThemePreset.colors.canvasBg, selectedVisualThemePreset.colors.canvasText, slideOverlapMap]);

  const qualitySummary = useMemo(() => {
    const errorCount = qualityIssues.filter((issue) => issue.severity === 'error').length;
    const warningCount = qualityIssues.length - errorCount;
    return {
      errorCount,
      warningCount,
      canPublish: errorCount === 0,
    };
  }, [qualityIssues]);
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
          const shouldRegeneratePreviews =
            updatedDeck.visualThemeId !== deck.visualThemeId ||
            updatedDeck.name !== deck.name;
          const withHydratedSlides: PresentationDeck = {
            ...updatedDeck,
            slides: Array.isArray(updatedDeck.slides)
              ? updatedDeck.slides.map((slide) =>
                  hydrateSlidePreview(
                    slide,
                    updatedDeck.visualThemeId,
                    updatedDeck.name,
                    { force: shouldRegeneratePreviews },
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
    [activeDeckId, duration, markUserMutation],
  );

  const applyTemplate = useCallback(
    (templateId: PresentationTemplateId) => {
      const preset = templatePresets.find((item) => item.id === templateId) || templatePresets[0];

      if (!selectedDeck) {
        const themeId = presentationDefaultsForCourse.visualThemeId;
        const themePreset = getVisualThemePresetById(themeId);
        const nextDeck = createDeckFromTemplate(
          templateId,
          duration,
          isNorwegian,
          '',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          themeId,
          themePreset.splitLayoutVariant,
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
            ? (getVisualThemePresetById(deck.visualThemeId).splitLayoutVariant)
            : 'balanced',
        showNavigator: false,
        placement: toPlacement(preset.defaultPlacement),
        slides: buildTemplateSlides(preset.id, duration, isNorwegian, deck.visualThemeId, deck.name),
      }));

      setSaveMessage(tt('Template brukt på valgt presentasjon.', 'Template applied to selected presentation.'));
    },
    [
      duration,
      isNorwegian,
      markUserMutation,
      presentationDefaultsForCourse.visualThemeId,
      selectedDeck,
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
    const nextDeck = createDeckFromTemplate(
      presentationDefaultsForCourse.templateId,
      duration,
      isNorwegian,
      '',
      '',
      presentationDefaultsForCourse.visualThemeId,
      presentationDefaultsForCourse.splitLayoutVariant,
    );
    markUserMutation();
    setDecks((prev) => [nextDeck, ...prev]);
    setSelectedDeckId(nextDeck.id);
    setSaveMessage(tt('Ny presentasjon opprettet.', 'New presentation created.'));
  }, [duration, isNorwegian, markUserMutation, presentationDefaultsForCourse, tt]);

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
      options?: { silent?: boolean; source?: 'manual' | 'auto' | 'fallback' },
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
        const nextDeckTheme = applyAll ? plan.recommendedVisualThemeId : deck.visualThemeId;
        const nextDeckDisplayMode = applyAll ? plan.recommendedDisplayMode : deck.displayMode;
        const nextDeckSplitVariant =
          nextDeckDisplayMode === 'split-screen'
            ? applyAll
              ? plan.recommendedSplitLayoutVariant
              : deck.splitLayoutVariant
            : 'balanced';

        const nextSlides = deck.slides.map((slide) => {
          if (targetSlideId && slide.id !== targetSlideId) return slide;
          const slidePlan = planBySlide.get(slide.id);
          if (!slidePlan) return slide;

          const suggestedTitle = String(slidePlan.copySuggestions.title || '').trim() || slide.title;
          const bodyLines = Array.isArray(slidePlan.copySuggestions.body)
            ? slidePlan.copySuggestions.body.map((line) => String(line || '').trim()).filter(Boolean)
            : [];
          const ctaLine = String(slidePlan.copySuggestions.cta || '').trim();
          const bodyText = [...bodyLines, ...(slidePlan.visualType === 'cta' && ctaLine ? [ctaLine] : [])]
            .filter(Boolean)
            .join('\n');
          const layout = toDisplayMode(
            String(slidePlan.recommendedLayout || slide.layout || deck.displayMode),
          );

          const baseElements = slide.elements.filter(
            (element) => !String(element.id || '').startsWith('design-slot-'),
          );
          let nextElements = [...baseElements];
          const firstTextIndex = nextElements.findIndex((element) => element.type === 'text');
          const textX = layout === 'split-screen' || layout === 'full-frame' ? 8 : 12;
          const textWidth = layout === 'split-screen' || layout === 'full-frame' ? 56 : 76;

          if (firstTextIndex >= 0) {
            nextElements[firstTextIndex] = {
              ...nextElements[firstTextIndex],
              text: suggestedTitle,
              x: textX,
              y: 10,
              width: textWidth,
              height: 16,
            };
          } else {
            nextElements.unshift({
              id: `${slide.id}-title-${Date.now().toString(36)}`,
              type: 'text',
              text: suggestedTitle,
              x: textX,
              y: 10,
              width: textWidth,
              height: 16,
            });
          }

          if (bodyText) {
            const titleTextIndex = nextElements.findIndex((element) => element.type === 'text');
            const bodyTextIndex = nextElements.findIndex(
              (element, index) => element.type === 'text' && index !== titleTextIndex,
            );
            if (bodyTextIndex >= 0) {
              nextElements[bodyTextIndex] = {
                ...nextElements[bodyTextIndex],
                text: bodyText,
                x: textX,
                y: 30,
                width: textWidth,
                height: 40,
              };
            } else {
              nextElements.push({
                id: `${slide.id}-body-${Date.now().toString(36)}`,
                type: 'text',
                text: bodyText,
                x: textX,
                y: 30,
                width: textWidth,
                height: 40,
              });
            }
          }

          const graphicElements = slidePlan.graphicSlots.slice(0, 6).map((slot) => ({
            id: `design-slot-${slot.id}`,
            type: designGraphicKindToElementType(slot.kind),
            text: slot.prompt || slot.label || '',
            x: clamp(Number(slot.x) || 0, 0, 100),
            y: clamp(Number(slot.y) || 0, 0, 100),
            width: clamp(Number(slot.width) || 20, 1, 100),
            height: clamp(Number(slot.height) || 12, 1, 100),
          }));

          nextElements = [...nextElements, ...graphicElements].slice(0, 20);
          return {
            ...slide,
            title: suggestedTitle,
            layout,
            elements: nextElements,
            previewImageUrl: '',
            thumbnailImageUrl: '',
          };
        });

        return {
          ...deck,
          template: applyAll ? plan.recommendedTemplateId : deck.template,
          visualThemeId: nextDeckTheme,
          displayMode: nextDeckDisplayMode,
          splitLayoutVariant: nextDeckSplitVariant,
          showNavigator: false,
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
    [selectedDeck, trackPresentationEvent, tt, updateSelectedDeck],
  );

  const generateDesignPlan = useCallback(async () => {
    if (!selectedDeck) {
      setSaveMessage(tt('Velg en presentasjon først.', 'Select a presentation first.'));
      return;
    }

    try {
      setDesignPlanBusy(true);
      setDesignPlanError('');
      const response = await apiRequest('/api/academy/presentation/design-plan', {
        method: 'POST',
        body: {
          scope: effectiveScope,
          courseId: resolvedCourseId,
          lessonId: effectiveScope === 'skill' ? String(selectedSkill?.id || '') : '',
          projectTemplateId: activeProjectTemplateId,
          useNorwegian: isNorwegian,
          deckName: selectedDeck.name,
          deckTemplate: selectedDeck.template,
          deckVisualThemeId: selectedDeck.visualThemeId,
          slides: selectedDeck.slides.map((slide) => ({
            id: slide.id,
            title: slide.title,
            startTime: slide.startTime,
            duration: slide.duration,
            layout: slide.layout,
            speakerNotes: slide.speakerNotes,
            textLines: collectSlideBodyLines(slide),
          })),
        },
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

      setDesignPlan(parsed);
      applyDesignPlanPayload(parsed, undefined, { silent: true, source: 'auto' });
      setSaveMessage(
        tt(
          `Design-plan generert og brukt på ${parsed.slides.length} slides.`,
          `Design plan generated and applied to ${parsed.slides.length} slides.`,
        ),
      );
      trackPresentationEvent('academy_presentation_design_plan_generated', {
        slideCount: parsed.slides.length,
        template: parsed.recommendedTemplateId,
        theme: parsed.recommendedVisualThemeId,
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
        setDesignPlan(fallbackPlan);
        setDesignPlanError('');
        applyDesignPlanPayload(fallbackPlan, undefined, {
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
          slideCount: fallbackPlan.slides.length,
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
    isNorwegian,
    resolvedCourseId,
    selectedDeck,
    selectedSkill?.id,
    trackPresentationEvent,
    tt,
  ]);

  const applyDesignPlan = useCallback(
    (targetSlideId?: string) => {
      if (!designPlan) return;
      applyDesignPlanPayload(designPlan, targetSlideId, { source: 'manual' });
    },
    [applyDesignPlanPayload, designPlan],
  );

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

      try {
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
                  `${deck.name} · ${formatTime(startTime)}-${formatTime(endTime)} · order:${index + 1} · template:${deck.template} · theme:${deck.visualThemeId} · mode:${deck.displayMode} · variant:${deck.splitLayoutVariant} · placement:${deck.placement} · layout:${slide.layout || deck.displayMode} · deck:${deck.id} · slide:${slide.id} · slideNo:${Math.max(1, Number(slide.sourceSlideNumber) || index + 1)}` +
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
          store[key] = {
            decks: normalizedDecks,
            duration,
            updatedAt: new Date().toISOString(),
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
              <Chip
                size="small"
                icon={<Slideshow sx={{ fontSize: 16 }} />}
                label={tt('Presentasjonsoverlegg', 'Presentation Overlay')}
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
                  <Typography sx={{ fontSize: 'clamp(1.5rem, 1.2rem + 1vw, 2rem)', fontWeight: 700, lineHeight: 1.1 }}>
                    {tt('PPT i video', 'PPT in Video')}
                  </Typography>
                  <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label={
                        effectiveScope === 'skill'
                          ? tt('Scope: Ferdighet', 'Scope: Skill')
                          : tt('Scope: Kurs', 'Scope: Course')
                      }
                      sx={{
                        bgcolor:
                          effectiveScope === 'skill'
                            ? 'rgba(106,196,255,0.2)'
                            : 'rgba(248,179,33,0.2)',
                        color: '#edf0f7',
                      }}
                    />
                    {activeProjectTemplateId && (
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
                    <Chip
                      size="small"
                      label={`${tt('Tema', 'Theme')}: ${tt(selectedVisualThemePreset.labelNo, selectedVisualThemePreset.labelEn)}`}
                      sx={{
                        bgcolor: 'rgba(92,149,255,0.2)',
                        color: '#e7f0ff',
                      }}
                    />
                  </Stack>
                </Stack>

                <Stack
                  direction="row"
                  spacing={0.8}
                  flexWrap="wrap"
                  useFlexGap
                  sx={{ justifyContent: { xs: 'flex-start', lg: 'flex-end' } }}
                >
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrow />}
                    onClick={togglePlayback}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    {tt('Forhandsvis', 'Preview')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Save />}
                    onClick={() => void savePresentationSetup(false)}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    {tt('Lagre', 'Save')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Publish />}
                    onClick={() => void savePresentationSetup(true)}
                    disabled={!qualitySummary.canPublish}
                    sx={{
                      textTransform: 'none',
                      color: '#0f0f0f',
                      borderRadius: 1,
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      boxShadow: '0 10px 24px rgba(248,179,33,0.25)',
                    }}
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
                      <MenuItem value="course">{tt('Kurs', 'Course')}</MenuItem>
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
                  </Stack>

                </Stack>

                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={0.8}
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', lg: 'center' }}
                  sx={{
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                    borderRadius: 1,
                    px: 0.8,
                    py: 0.7,
                    bgcolor: 'rgba(255,255,255,0.03)',
                  }}
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
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AutoFixHigh />}
                      onClick={autoFixQualityIssues}
                      disabled={qualityIssues.length === 0}
                      sx={{
                        textTransform: 'none',
                        borderColor: 'rgba(248,179,33,0.48)',
                        color: '#f8d675',
                        minWidth: 108,
                      }}
                    >
                      {tt('Auto-fiks', 'Auto-fix')}
                    </Button>
                  </Stack>
                </Stack>

                <Stack
                  spacing={0.8}
                  sx={{
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                    borderRadius: 1,
                    px: 0.8,
                    py: 0.7,
                    bgcolor: 'rgba(255,255,255,0.03)',
                  }}
                >
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
                                background: selectedVisualThemePreset.colors.navBg,
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
                                      bgcolor: selectedVisualThemePreset.colors.chipBg,
                                      color: selectedVisualThemePreset.colors.chipText,
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
                                    color: selectedVisualThemePreset.colors.navText,
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
                                          ? selectedVisualThemePreset.colors.navCardActiveBg
                                          : selectedVisualThemePreset.colors.navCardBg,
                                        color: selectedVisualThemePreset.colors.navText,
                                        fontWeight: active ? 700 : 600,
                                        '&:hover': {
                                          borderColor: active ? 'rgba(173,209,255,0.9)' : 'rgba(255,255,255,0.26)',
                                          bgcolor: active
                                            ? selectedVisualThemePreset.colors.navCardActiveBg
                                            : selectedVisualThemePreset.colors.navCardBg,
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
                              background: selectedVisualThemePreset.colors.presenterBg,
                            }}
                          >
                            <Box sx={{ flex: 1 }} />

                          </Box>

                          <Box
                            sx={{
                              background: selectedVisualThemePreset.colors.canvasBg,
                              p: 1.2,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 1,
                              color: selectedVisualThemePreset.colors.canvasTitle,
                              overflow: 'auto',
                            }}
                          >
                            <Stack direction="row" spacing={0.7} alignItems="center" justifyContent="space-between">
                              <Typography
                                sx={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: alpha(selectedVisualThemePreset.colors.canvasTitle, 0.74),
                                  letterSpacing: '0.03em',
                                }}
                              >
                                {selectedDeck.name}
                              </Typography>
                              <Typography sx={{ fontSize: 11.5, color: alpha(selectedVisualThemePreset.colors.canvasText, 0.75) }}>
                                {selectedTemplatePreset ? tt(selectedTemplatePreset.labelNo, selectedTemplatePreset.labelEn) : ''}
                              </Typography>
                            </Stack>

                            <Box
                              sx={{
                                borderRadius: 0.8,
                                overflow: 'hidden',
                                border: `1px solid ${alpha(selectedVisualThemePreset.colors.canvasCardBorder, 0.9)}`,
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
                                    color: alpha(selectedVisualThemePreset.colors.canvasText, 0.74),
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
                                color: selectedVisualThemePreset.colors.canvasTitle,
                                outline: 'none',
                                borderRadius: 0.6,
                                border: `1px dashed ${alpha(selectedVisualThemePreset.colors.canvasTitle, 0.35)}`,
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
                                border: `1px dashed ${alpha(selectedVisualThemePreset.colors.canvasTitle, 0.28)}`,
                                px: 0.6,
                                py: 0.45,
                                cursor: 'text',
                                color: selectedVisualThemePreset.colors.canvasText,
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
                                    border: `var(--academy-hairline-width, 1px) solid ${alpha(selectedVisualThemePreset.colors.canvasCardBorder, 0.92)}`,
                                    bgcolor: selectedVisualThemePreset.colors.canvasCardBg,
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
                                      bgcolor: selectedVisualThemePreset.colors.navAccent,
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
                                      color: selectedVisualThemePreset.colors.canvasText,
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
                              <Description sx={{ fontSize: 17, color: alpha(selectedVisualThemePreset.colors.canvasText, 0.78) }} />
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
                                  color: alpha(selectedVisualThemePreset.colors.canvasText, 0.9),
                                  fontSize: 12.3,
                                  outline: 'none',
                                  borderRadius: 0.6,
                                  px: 0.4,
                                  py: 0.1,
                                  border: `1px dashed ${alpha(selectedVisualThemePreset.colors.canvasText, 0.22)}`,
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
                            background: selectedVisualThemePreset.colors.navBg,
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
                                  bgcolor: selectedVisualThemePreset.colors.chipBg,
                                  color: selectedVisualThemePreset.colors.chipText,
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
                                color: selectedVisualThemePreset.colors.navText,
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
                                      ? selectedVisualThemePreset.colors.navCardActiveBg
                                      : selectedVisualThemePreset.colors.navCardBg,
                                    color: selectedVisualThemePreset.colors.navText,
                                    fontWeight: active ? 700 : 600,
                                    '&:hover': {
                                      borderColor: active ? 'rgba(173,209,255,0.9)' : 'rgba(255,255,255,0.26)',
                                      bgcolor: active
                                        ? selectedVisualThemePreset.colors.navCardActiveBg
                                        : selectedVisualThemePreset.colors.navCardBg,
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
                            background: selectedVisualThemePreset.colors.presenterBg,
                          }}
                        >
                          <Box sx={{ flex: 1 }} />
                        </Box>
                      )}

                      <Box
                        sx={{
                          background: selectedVisualThemePreset.colors.canvasBg,
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
                                color: alpha(selectedVisualThemePreset.colors.canvasText, 0.74),
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
                                {tt('Ingen instruktør satt', 'No instructor set')}
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
            </Box>

            <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.1 }}>
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
                      ? tt('Genererer ...', 'Generating ...')
                      : tt('Generer plan', 'Generate plan')}
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

                {designPlanError && (
                  <Typography sx={{ fontSize: 12.5, color: 'rgba(255,184,184,0.95)' }}>
                    {designPlanError}
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
                        label={`${tt('Tema', 'Theme')}: ${designPlan.recommendedVisualThemeId}`}
                        sx={{ bgcolor: 'rgba(92,149,255,0.22)', color: '#dce8ff' }}
                      />
                      <Chip
                        size="small"
                        label={`${tt('Mode', 'Mode')}: ${designPlan.recommendedDisplayMode}`}
                        sx={{ bgcolor: 'rgba(126,232,179,0.18)', color: '#c9ffe6' }}
                      />
                      <Chip
                        size="small"
                        label={
                          designPlan.summary.generatedBy.includes('llm')
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
                    </Stack>
                    <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 12.5 }}>
                      {tt(
                        `Generert ${new Date(designPlan.generatedAt).toLocaleString()}.`,
                        `Generated ${new Date(designPlan.generatedAt).toLocaleString()}.`,
                      )}
                    </Typography>
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
                                label={slidePlan.recommendedLayout}
                                sx={{ bgcolor: 'rgba(92,149,255,0.16)', color: '#dce8ff' }}
                              />
                              <Chip
                                size="small"
                                label={`${tt('Grafikk', 'Graphics')}: ${slidePlan.graphicSlots.length}`}
                                sx={{ bgcolor: 'rgba(248,179,33,0.16)', color: '#ffe5ad' }}
                              />
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Stack>
                )}
              </Box>

              <Box sx={{ ...panelSx, p: 1.2, display: 'grid', gap: 0.9 }}>
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
                        borderRadius: 1,
                        border: active
                          ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.52)'
                          : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                        background: active
                          ? 'linear-gradient(145deg, rgba(248,179,33,0.12), rgba(248,179,33,0.04))'
                          : 'rgba(255,255,255,0.02)',
                        p: 1,
                        display: 'grid',
                        gap: 0.7,
                      }}
                    >
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
                          alignSelf: 'flex-start',
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                        }}
                      >
                        {tt('Bruk template', 'Use Template')}
                      </Button>
                    </Box>
                  );
                })}
              </Box>

              {selectedDeck && (
                <Box sx={{ ...panelSx, p: 1.2, display: 'grid', gap: 1 }}>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <Tune sx={{ color: '#f8d56f' }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
                      {tt('Visningsoppsett', 'Display Setup')}
                    </Typography>
                  </Stack>

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

                  <Select
                    size="small"
                    value={selectedDeck.displayMode}
                    onChange={(event) => {
                      const nextDisplayMode = toDisplayMode(String(event.target.value));
                      const themePreset = getVisualThemePresetById(selectedDeck.visualThemeId);
                      updateSelectedDeck((deck) => ({
                        ...deck,
                        displayMode: nextDisplayMode,
                        splitLayoutVariant:
                          nextDisplayMode === 'split-screen'
                            ? deck.splitLayoutVariant || themePreset.splitLayoutVariant
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
                    value={selectedDeck.visualThemeId}
                    onChange={(event) => {
                      const nextThemeId = toVisualThemeId(String(event.target.value));
                      const themePreset = getVisualThemePresetById(nextThemeId);
                      updateSelectedDeck((deck) => ({
                        ...deck,
                        visualThemeId: nextThemeId,
                        splitLayoutVariant:
                          deck.displayMode === 'split-screen'
                            ? themePreset.splitLayoutVariant
                            : 'balanced',
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
                    {visualThemePresets.map((theme) => (
                      <MenuItem key={theme.id} value={theme.id}>
                        {tt(theme.labelNo, theme.labelEn)}
                      </MenuItem>
                    ))}
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

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

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
              )}

              <Box sx={{ ...panelSx, p: 1.2, display: 'grid', gap: 0.9 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 17 }}>
                  {tt('Publiseringsstatus', 'Publishing Status')}
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
                    'Save for draft or publish to sync presentation overlays into the player.',
                  )}
                </Typography>
                {qualityIssues.length > 0 && (
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
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyPresentationOverlayStudio, {
  componentId: 'academy-presentation-overlay-studio',
  componentName: 'Academy Presentation Overlay Studio',
  componentType: 'editor',
  componentCategory: 'academy',
  featureIds: ['academy-presentation-overlay', 'academy-ppt-upload', 'academy-slide-placement'],
});
