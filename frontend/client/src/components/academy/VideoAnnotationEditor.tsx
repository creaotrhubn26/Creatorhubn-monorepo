import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Select,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  AutoFixHigh,
  AttachFile,
  CloudDone,
  CloudOff,
  CloudSync,
  CropSquare,
  Delete,
  MailOutline,
  MoreHoriz,
  NotificationsNone,
  OpenWith,
  Pause,
  PlayArrow,
  Publish,
  Redo,
  Save,
  Search,
  Undo,
  Visibility,
  VisibilityOff,
  WarningAmber,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyLocaleSwitcher from './AcademyLocaleSwitcher';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import {
  useAcademy,
  type Course,
  type CourseResource,
  type Lesson,
  type LessonResource,
  type PedagogicalAnnotationSuggestion,
} from '@/contexts/AcademyContext';
import AcademyLeftSidebar from './AcademyLeftSidebar';
import AcademyPlayerStudio from './AcademyPlayerStudio';
import { resolveAcademyVideoUrl } from './academyVideoSourceUtils';
import {
  formatToolSavedTime,
  hasSavedDraftNewerThanPublished,
  useAcademyToolUx,
} from './academyToolCore';
import { apiRequest } from '@/lib/queryClient';

interface AnnotationActionData {
  attachmentIds?: string[];
  [key: string]: unknown;
}

interface VideoAnnotationAction {
  type: 'navigate' | 'showContent' | 'openLink' | 'playVideo' | 'showQuiz';
  target?: string;
  data?: AnnotationActionData;
}

export interface VideoAnnotation {
  id: string;
  type: 'hotspot' | 'callout' | 'note' | 'quiz' | 'link' | 'image' | 'video';
  title: string;
  content: string;
  startTime: number;
  endTime?: number;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  style: {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    opacity: number;
  };
  isVisible: boolean;
  isClickable: boolean;
  action?: VideoAnnotationAction;
  createdAt: string;
  updatedAt: string;
}

interface VideoAnnotationEditorProps {
  courseId?: string;
  lessonId?: string;
  videoUrl?: string;
  duration?: number;
  annotations?: VideoAnnotation[];
  onAnnotationsChange?: (annotations: VideoAnnotation[]) => void;
  onSave?: (annotations: VideoAnnotation[]) => void;
  onCancel?: () => void;
}

type RightPanelTab = 'editor' | 'markers' | 'attachments';
type AnnotationScope = 'course' | 'skill';

const defaultVideoUrl = '/assets/academy/intro-video.mp4';
const academyShellMaxWidth = 'min(100%, var(--academy-shell-max-width, 2880px))';
const ANNOTATION_STORE_KEY = 'academyAnnotationStoreV1';
const ANNOTATION_KV_KEY = 'academy_annotation_store_v1';
const ANNOTATION_RESOURCE_ID_PREFIX = 'annotation-resource-';
const ANNOTATION_RESOURCE_COURSE_PREFIX = 'annotation-resource-course-';
const ANNOTATION_RESOURCE_SKILL_PREFIX = 'annotation-resource-skill-';
const ANNOTATION_META_MARKER = '::annotation-meta::';

const annotationTypes: Array<{
  value: VideoAnnotation['type'];
  label: string;
  short: string;
  color: string;
}> = [
  { value: 'callout', label: 'Callout', short: 'C', color: '#f8b321' },
  { value: 'note', label: 'Note', short: 'N', color: '#6ac4ff' },
  { value: 'hotspot', label: 'Hotspot', short: 'H', color: '#ff6f3c' },
  { value: 'quiz', label: 'Quiz', short: 'Q', color: '#ff4d7c' },
  { value: 'link', label: 'Link', short: 'L', color: '#80e17d' },
  { value: 'image', label: 'Image', short: 'I', color: '#c8a4ff' },
  { value: 'video', label: 'Video', short: 'V', color: '#7de2dc' },
];

const getAnnotationTypeMeta = (
  type: VideoAnnotation['type'],
): (typeof annotationTypes)[number] | undefined => {
  return annotationTypes.find((entry) => entry.value === type);
};

const getDefaultAnnotationTitle = (type: VideoAnnotation['type']): string => {
  return getAnnotationTypeMeta(type)?.label || 'Annotation';
};

const getDefaultAnnotationContent = (type: VideoAnnotation['type']): string => {
  switch (type) {
    case 'note':
      return 'Skriv en instruktørnote for teamet.';
    case 'hotspot':
      return 'Marker et viktig område i videoen.';
    case 'quiz':
      return 'Legg inn et spørsmål til studenten.';
    case 'link':
      return 'Legg inn en lenke til relevant innhold.';
    case 'image':
      return 'Koble et bilde som vedlegg.';
    case 'video':
      return 'Koble et videoklipp som vedlegg.';
    case 'callout':
    default:
      return 'Legg inn annoteringstekst for teamet.';
  }
};

const getDefaultAnnotationAction = (
  type: VideoAnnotation['type'],
): VideoAnnotationAction | undefined => {
  switch (type) {
    case 'quiz':
      return { type: 'showQuiz' };
    case 'link':
      return { type: 'openLink', target: 'https://academy.creatorhub.no' };
    case 'image':
      return { type: 'showContent', data: { attachmentIds: [] } };
    case 'video':
      return { type: 'playVideo' };
    case 'hotspot':
      return { type: 'showContent' };
    default:
      return undefined;
  }
};

const waveformPattern = [
  14, 22, 18, 32, 16, 24, 28, 40, 26, 20, 30, 18, 34, 38, 22, 27, 25, 31, 37, 42, 35, 29, 21, 24,
];
const MIN_ANNOTATION_DURATION = 1.5;
const TIMELINE_SNAP_STEP = 0.5;
const SAFE_AREA_MARGIN = 4;
const MAX_VERSION_HISTORY = 25;

const panelSectionSx = {
  borderRadius: 1.4,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const controlButtonSx = {
  height: 34,
  borderRadius: 1,
  textTransform: 'none',
  transition: 'all 140ms ease',
};

const neutralOutlinedButtonSx = {
  ...controlButtonSx,
  borderColor: 'rgba(255,255,255,0.2)',
  color: '#edf0f7',
  bgcolor: 'rgba(255,255,255,0.02)',
  '&:hover': {
    borderColor: 'rgba(255,255,255,0.34)',
    bgcolor: 'rgba(255,255,255,0.06)',
  },
};

const warningOutlinedButtonSx = {
  ...controlButtonSx,
  borderColor: 'rgba(248,179,33,0.35)',
  color: '#f8d675',
  bgcolor: 'rgba(248,179,33,0.06)',
  '&:hover': {
    borderColor: 'rgba(248,179,33,0.5)',
    bgcolor: 'rgba(248,179,33,0.14)',
  },
};

const saveButtonSx = {
  ...neutralOutlinedButtonSx,
  minWidth: 104,
};

const publishButtonSx = {
  ...controlButtonSx,
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

const neutralIconButtonSx = {
  width: 34,
  height: 34,
  color: '#edf0f7',
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
  borderRadius: 1,
  transition: 'all 140ms ease',
  '&:hover': {
    borderColor: 'rgba(255,255,255,0.34)',
    bgcolor: 'rgba(255,255,255,0.06)',
  },
};

const toolbarGroupSx = {
  p: 0.3,
  borderRadius: 1,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
  bgcolor: 'rgba(255,255,255,0.03)',
  display: 'flex',
  gap: 0.4,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const sectionLabelSx = {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'rgba(237,240,247,0.68)',
  fontWeight: 700,
};

const detailCardSx = {
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  borderRadius: 1,
  p: 0.9,
  bgcolor: 'rgba(8,12,19,0.72)',
  display: 'grid',
  gap: 0.85,
};


const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const stripAnnotationMetaFromDescription = (description: string): string => {
  const source = String(description || '');
  const markerIndex = source.indexOf(ANNOTATION_META_MARKER);
  if (markerIndex === -1) return source;
  return source.slice(0, markerIndex).trim();
};

const parseAnnotationMetaFromDescription = (
  description: string,
): Partial<VideoAnnotation> | null => {
  const source = String(description || '');
  const markerIndex = source.indexOf(ANNOTATION_META_MARKER);
  if (markerIndex === -1) return null;

  const encoded = source.slice(markerIndex + ANNOTATION_META_MARKER.length).trim();
  if (!encoded) return null;

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(encoded));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Partial<VideoAnnotation>;
  } catch {
    return null;
  }
};

const buildAnnotationResourceDescription = (
  annotation: VideoAnnotation,
  safeEnd: number,
): string => {
  const base = `${annotation.type} · ${formatTime(annotation.startTime)}-${formatTime(safeEnd)} · ${annotation.content}`;
  try {
    const serialized = encodeURIComponent(JSON.stringify(annotation));
    return `${base} ${ANNOTATION_META_MARKER}${serialized}`;
  } catch {
    return base;
  }
};

const parseTimeRangeFromResourceDescription = (
  description: string,
): { startTime: number; endTime: number } | null => {
  const normalizedDescription = stripAnnotationMetaFromDescription(String(description || ''));
  const match = normalizedDescription.match(/(\d+):(\d+)\s*-\s*(\d+):(\d+)/);
  if (!match) return null;
  const startMin = Number.parseInt(match[1], 10);
  const startSec = Number.parseInt(match[2], 10);
  const endMin = Number.parseInt(match[3], 10);
  const endSec = Number.parseInt(match[4], 10);
  if (![startMin, startSec, endMin, endSec].every(Number.isFinite)) return null;
  return {
    startTime: Math.max(0, startMin * 60 + startSec),
    endTime: Math.max(0, endMin * 60 + endSec),
  };
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const parseColorToRgb = (value: string): { r: number; g: number; b: number } | null => {
  const source = String(value || '').trim().toLowerCase();
  if (!source) return null;

  const hexMatch = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const raw = hexMatch[1];
    const normalized =
      raw.length === 3
        ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
        : raw;
    const int = Number.parseInt(normalized, 16);
    if (!Number.isFinite(int)) return null;
    return {
      r: (int >> 16) & 255,
      g: (int >> 8) & 255,
      b: int & 255,
    };
  }

  const rgbMatch = source.match(/^rgba?\(([^)]+)\)$/);
  if (rgbMatch) {
    const values = rgbMatch[1].split(',').map((item) => Number.parseFloat(item.trim()));
    if (values.length < 3 || values.some((item) => !Number.isFinite(item))) return null;
    return {
      r: clamp(Math.round(values[0]), 0, 255),
      g: clamp(Math.round(values[1]), 0, 255),
      b: clamp(Math.round(values[2]), 0, 255),
    };
  }

  return null;
};

const relativeLuminance = ({ r, g, b }: { r: number; g: number; b: number }): number => {
  const normalize = (channel: number): number => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const red = normalize(r);
  const green = normalize(g);
  const blue = normalize(b);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const getContrastRatio = (foreground: string, background: string): number | null => {
  const foregroundRgb = parseColorToRgb(foreground);
  const backgroundRgb = parseColorToRgb(background);
  if (!foregroundRgb || !backgroundRgb) return null;
  const light = Math.max(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));
  const dark = Math.min(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));
  return (light + 0.05) / (dark + 0.05);
};

type AnnotationIssueType = 'contrast' | 'duration' | 'overlap' | 'bounds' | 'mobile-text' | 'content';
type AnnotationIssueSeverity = 'warning' | 'error';

type AnnotationIssue = {
  id: string;
  annotationId?: string;
  type: AnnotationIssueType;
  severity: AnnotationIssueSeverity;
  message: string;
};

type AnnotationVersion = {
  id: string;
  label: string;
  createdAt: string;
  items: VideoAnnotation[];
};

type StudentPreviewActionCard = {
  annotationId: string;
  title: string;
  detail: string;
};

const annotationTemplates: Array<{
  id: string;
  labelNo: string;
  labelEn: string;
  descriptionNo: string;
  descriptionEn: string;
  build: (durationSeconds: number) => Array<{
    type: VideoAnnotation['type'];
    start: number;
    end?: number;
    titleNo: string;
    titleEn: string;
    contentNo: string;
    contentEn: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }>;
}> = [
  {
    id: 'product-overview',
    labelNo: 'Produktoversikt',
    labelEn: 'Product Overview',
    descriptionNo: 'Rask introduksjon av kjerneverdien i videoen.',
    descriptionEn: 'Quick introduction of the core value in the video.',
    build: (durationSeconds) => [
      {
        type: 'callout',
        start: Math.min(8, durationSeconds * 0.06),
        end: Math.min(durationSeconds, durationSeconds * 0.2),
        titleNo: 'Hva du lærer',
        titleEn: 'What You Will Learn',
        contentNo: 'Kort oversikt over målet med denne ferdigheten.',
        contentEn: 'Short overview of the outcome for this skill.',
        position: { x: 8, y: 10 },
        size: { width: 33, height: 16 },
      },
      {
        type: 'hotspot',
        start: Math.min(24, durationSeconds * 0.18),
        end: Math.min(durationSeconds, durationSeconds * 0.3),
        titleNo: 'Nøkkelsteg',
        titleEn: 'Key Step',
        contentNo: 'Marker området eleven må fokusere på.',
        contentEn: 'Highlight the area students should focus on.',
        position: { x: 56, y: 24 },
        size: { width: 28, height: 18 },
      },
      {
        type: 'quiz',
        start: Math.min(52, durationSeconds * 0.45),
        end: Math.min(durationSeconds, durationSeconds * 0.57),
        titleNo: 'Sjekk forståelsen',
        titleEn: 'Knowledge Check',
        contentNo: 'Legg inn et raskt kontrollspørsmål.',
        contentEn: 'Add a quick comprehension question.',
        position: { x: 11, y: 62 },
        size: { width: 32, height: 16 },
      },
    ],
  },
  {
    id: 'walkthrough',
    labelNo: 'Walkthrough',
    labelEn: 'Walkthrough',
    descriptionNo: 'Steg-for-steg markører gjennom prosessen.',
    descriptionEn: 'Step-by-step markers through the process.',
    build: (durationSeconds) => [
      {
        type: 'note',
        start: Math.min(10, durationSeconds * 0.08),
        end: Math.min(durationSeconds, durationSeconds * 0.19),
        titleNo: 'Steg 1',
        titleEn: 'Step 1',
        contentNo: 'Forklar første handling tydelig.',
        contentEn: 'Explain the first action clearly.',
        position: { x: 12, y: 14 },
        size: { width: 26, height: 15 },
      },
      {
        type: 'note',
        start: Math.min(28, durationSeconds * 0.22),
        end: Math.min(durationSeconds, durationSeconds * 0.34),
        titleNo: 'Steg 2',
        titleEn: 'Step 2',
        contentNo: 'Bygg videre med neste beslutning.',
        contentEn: 'Build forward with the next decision.',
        position: { x: 46, y: 22 },
        size: { width: 28, height: 15 },
      },
      {
        type: 'callout',
        start: Math.min(48, durationSeconds * 0.4),
        end: Math.min(durationSeconds, durationSeconds * 0.56),
        titleNo: 'Viktig tips',
        titleEn: 'Critical Tip',
        contentNo: 'Marker hvor feil oftest skjer.',
        contentEn: 'Highlight where mistakes happen most often.',
        position: { x: 20, y: 58 },
        size: { width: 34, height: 16 },
      },
    ],
  },
  {
    id: 'onboarding-flow',
    labelNo: 'Onboarding-flow',
    labelEn: 'Onboarding Flow',
    descriptionNo: 'Trygg oppstart med tydelige steg for nye brukere.',
    descriptionEn: 'Safe onboarding with clear first-time steps.',
    build: (durationSeconds) => [
      {
        type: 'callout',
        start: Math.min(6, durationSeconds * 0.05),
        end: Math.min(durationSeconds, durationSeconds * 0.16),
        titleNo: 'Start her',
        titleEn: 'Start Here',
        contentNo: 'Vis hvor brukeren begynner i grensesnittet.',
        contentEn: 'Show where users begin in the interface.',
        position: { x: 10, y: 10 },
        size: { width: 30, height: 14 },
      },
      {
        type: 'link',
        start: Math.min(36, durationSeconds * 0.3),
        end: Math.min(durationSeconds, durationSeconds * 0.42),
        titleNo: 'Neste steg',
        titleEn: 'Next Step',
        contentNo: 'Legg inn lenke til neste modul.',
        contentEn: 'Add a link to the next module.',
        position: { x: 58, y: 58 },
        size: { width: 30, height: 14 },
      },
    ],
  },
  {
    id: 'feature-explainer',
    labelNo: 'Feature explainer',
    labelEn: 'Feature Explainer',
    descriptionNo: 'Fokuser på én funksjon med kontekst og verdi.',
    descriptionEn: 'Focus on one feature with context and value.',
    build: (durationSeconds) => [
      {
        type: 'hotspot',
        start: Math.min(18, durationSeconds * 0.13),
        end: Math.min(durationSeconds, durationSeconds * 0.25),
        titleNo: 'Funksjon',
        titleEn: 'Feature',
        contentNo: 'Marker komponenten som demonstreres.',
        contentEn: 'Highlight the component being demonstrated.',
        position: { x: 52, y: 18 },
        size: { width: 30, height: 20 },
      },
      {
        type: 'callout',
        start: Math.min(42, durationSeconds * 0.34),
        end: Math.min(durationSeconds, durationSeconds * 0.5),
        titleNo: 'Hvorfor det betyr noe',
        titleEn: 'Why It Matters',
        contentNo: 'Forklar effekten for brukeren.',
        contentEn: 'Explain the impact for the user.',
        position: { x: 9, y: 56 },
        size: { width: 36, height: 17 },
      },
    ],
  },
  {
    id: 'cta-ready',
    labelNo: 'CTA-klar',
    labelEn: 'CTA Ready',
    descriptionNo: 'Bygg inn handling på riktig tidspunkt.',
    descriptionEn: 'Build in action prompts at the right time.',
    build: (durationSeconds) => [
      {
        type: 'callout',
        start: Math.min(20, durationSeconds * 0.18),
        end: Math.min(durationSeconds, durationSeconds * 0.3),
        titleNo: 'Verdi',
        titleEn: 'Value',
        contentNo: 'Oppsummer gevinsten før CTA.',
        contentEn: 'Summarize the value before CTA.',
        position: { x: 12, y: 15 },
        size: { width: 31, height: 14 },
      },
      {
        type: 'link',
        start: Math.min(64, durationSeconds * 0.58),
        end: Math.min(durationSeconds, durationSeconds * 0.75),
        titleNo: 'Gjør neste steg',
        titleEn: 'Take the Next Step',
        contentNo: 'Lenk til kjøp, skjema eller oppfølging.',
        contentEn: 'Link to checkout, form, or follow-up.',
        position: { x: 56, y: 62 },
        size: { width: 32, height: 16 },
      },
    ],
  },
];

const isEditableElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (target.isContentEditable) return true;
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.closest('[contenteditable="true"], [role="textbox"], [role="combobox"]'));
};

const buildTemplateById = (
  templateId: string,
  durationSeconds: number,
  norwegian: boolean,
): VideoAnnotation[] => {
  const template = annotationTemplates.find((entry) => entry.id === templateId);
  if (!template) return [];
  const safeDuration = Math.max(60, Number(durationSeconds || 282));
  const now = new Date().toISOString();
  return template.build(safeDuration).map((entry, index) =>
    normalizeAnnotation({
      ...buildAnnotation(entry.type, entry.start, entry.position, entry.size),
      id: `${template.id}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      title: norwegian ? entry.titleNo : entry.titleEn,
      content: norwegian ? entry.contentNo : entry.contentEn,
      startTime: entry.start,
      endTime: entry.end,
      createdAt: now,
      updatedAt: now,
    }),
  );
};

const resolveAnnotationEndTime = (
  annotation: VideoAnnotation,
  durationSeconds: number,
): number => {
  const maxDuration = Math.max(1, durationSeconds || 1);
  const candidate =
    annotation.endTime === undefined || annotation.endTime === null
      ? annotation.startTime + Math.max(MIN_ANNOTATION_DURATION, 5)
      : annotation.endTime;
  return clamp(candidate, annotation.startTime + MIN_ANNOTATION_DURATION, maxDuration);
};

const annotationsOverlapInSpace = (left: VideoAnnotation, right: VideoAnnotation): boolean => {
  const leftMinX = left.position.x;
  const leftMaxX = left.position.x + left.size.width;
  const leftMinY = left.position.y;
  const leftMaxY = left.position.y + left.size.height;
  const rightMinX = right.position.x;
  const rightMaxX = right.position.x + right.size.width;
  const rightMinY = right.position.y;
  const rightMaxY = right.position.y + right.size.height;
  return leftMinX < rightMaxX && leftMaxX > rightMinX && leftMinY < rightMaxY && leftMaxY > rightMinY;
};

const validateAnnotations = (
  items: VideoAnnotation[],
  durationSeconds: number,
  tt: (no: string, en: string) => string,
): AnnotationIssue[] => {
  const issues: AnnotationIssue[] = [];
  const seenOverlaps = new Set<string>();

  items.forEach((annotation) => {
    const safeEnd = resolveAnnotationEndTime(annotation, durationSeconds);
    const span = safeEnd - annotation.startTime;
    if (span < MIN_ANNOTATION_DURATION) {
      issues.push({
        id: `${annotation.id}-duration`,
        annotationId: annotation.id,
        type: 'duration',
        severity: 'warning',
        message: tt('Annoteringen vises for kort tid.', 'Annotation is visible for too short time.'),
      });
    }

    const maxX = annotation.position.x + annotation.size.width;
    const maxY = annotation.position.y + annotation.size.height;
    if (annotation.position.x < 0 || annotation.position.y < 0 || maxX > 100 || maxY > 100) {
      issues.push({
        id: `${annotation.id}-bounds`,
        annotationId: annotation.id,
        type: 'bounds',
        severity: 'error',
        message: tt('Annoteringen ligger delvis utenfor playeren.', 'Annotation is partially outside the player.'),
      });
    }

    const contrastRatio = getContrastRatio(annotation.style.textColor, annotation.style.backgroundColor);
    if (contrastRatio !== null && contrastRatio < 3) {
      issues.push({
        id: `${annotation.id}-contrast`,
        annotationId: annotation.id,
        type: 'contrast',
        severity: 'warning',
        message: tt('Lav kontrast mellom tekst og bakgrunn.', 'Low contrast between text and background.'),
      });
    }

    if (annotation.type === 'video') {
      const target = String(annotation.action?.target || '').trim();
      const attachmentIds = Array.isArray(annotation.action?.data?.attachmentIds)
        ? annotation.action?.data?.attachmentIds.filter(
            (value): value is string => typeof value === 'string' && value.trim().length > 0,
          )
        : [];
      const linkedVideoId = String(annotation.action?.data?.videoResourceId || '').trim();
      if (!target && attachmentIds.length === 0 && !linkedVideoId) {
        issues.push({
          id: `${annotation.id}-video-target`,
          annotationId: annotation.id,
          type: 'content',
          severity: 'warning',
          message: tt('Videoannotering mangler videokilde.', 'Video annotation is missing a video source.'),
        });
      }
    }

    if (String(annotation.content || '').trim().length > 140) {
      issues.push({
        id: `${annotation.id}-mobile`,
        annotationId: annotation.id,
        type: 'mobile-text',
        severity: 'warning',
        message: tt('Innholdet er langt for mobilvisning.', 'Content is long for mobile display.'),
      });
    }
  });

  for (let i = 0; i < items.length; i += 1) {
    const left = items[i];
    const leftEnd = resolveAnnotationEndTime(left, durationSeconds);
    for (let j = i + 1; j < items.length; j += 1) {
      const right = items[j];
      const rightEnd = resolveAnnotationEndTime(right, durationSeconds);
      const overlapsInTime =
        left.startTime < rightEnd &&
        right.startTime < leftEnd;
      if (!overlapsInTime) continue;
      if (!annotationsOverlapInSpace(left, right)) continue;
      const key = [left.id, right.id].sort().join('::');
      if (seenOverlaps.has(key)) continue;
      seenOverlaps.add(key);
      issues.push({
        id: `${key}-overlap`,
        type: 'overlap',
        severity: 'warning',
        message: tt('To annoteringer overlapper i samme område og tidspunkt.', 'Two annotations overlap in the same area and time.'),
      });
    }
  }

  return issues;
};

const applyAutoFixes = (
  items: VideoAnnotation[],
  durationSeconds: number,
): VideoAnnotation[] => {
  const safeDuration = Math.max(1, durationSeconds || 1);
  const sorted = [...items].sort((left, right) => left.startTime - right.startTime);
  return sorted.map((annotation, index) => {
    const safeEnd = resolveAnnotationEndTime(annotation, safeDuration);
    const fixed: VideoAnnotation = {
      ...annotation,
      startTime: clamp(annotation.startTime, 0, Math.max(0, safeDuration - MIN_ANNOTATION_DURATION)),
      endTime: safeEnd,
      position: {
        x: clamp(annotation.position.x, SAFE_AREA_MARGIN, Math.max(SAFE_AREA_MARGIN, 100 - annotation.size.width - SAFE_AREA_MARGIN)),
        y: clamp(annotation.position.y, SAFE_AREA_MARGIN, Math.max(SAFE_AREA_MARGIN, 100 - annotation.size.height - SAFE_AREA_MARGIN)),
      },
      size: {
        width: clamp(annotation.size.width, 8, 100 - SAFE_AREA_MARGIN),
        height: clamp(annotation.size.height, 8, 100 - SAFE_AREA_MARGIN),
      },
      updatedAt: new Date().toISOString(),
    };

    const ratio = getContrastRatio(fixed.style.textColor, fixed.style.backgroundColor);
    if (ratio !== null && ratio < 3) {
      fixed.style = {
        ...fixed.style,
        textColor: '#f7f8fb',
        backgroundColor: 'rgba(11,16,24,0.92)',
        borderColor: fixed.style.borderColor || '#f8b321',
      };
    }

    const previous = index > 0 ? sorted[index - 1] : null;
    if (previous && annotationsOverlapInSpace(fixed, previous)) {
      fixed.position = {
        x: fixed.position.x,
        y: clamp(fixed.position.y + 6, SAFE_AREA_MARGIN, Math.max(SAFE_AREA_MARGIN, 100 - fixed.size.height - SAFE_AREA_MARGIN)),
      };
    }
    return normalizeAnnotation(fixed);
  });
};

const shortenTextForMobile = (text: string, maxLength = 140): string => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;

  const sentenceChunks = normalized
    .split(/(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const firstSentence = sentenceChunks[0] || normalized;
  if (firstSentence.length <= maxLength) return firstSentence;
  return `${firstSentence.slice(0, Math.max(24, maxLength - 1)).trimEnd()}…`;
};

const isGenericAnnotationTitle = (value: string): boolean => {
  const normalized = String(value || '').trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === 'annotation' ||
    normalized === 'annotering' ||
    normalized === 'callout' ||
    normalized === 'note'
  );
};

const defaultAnnotationStyle = (type: VideoAnnotation['type']) => {
  const color = getAnnotationTypeMeta(type)?.color || '#f8b321';
  return {
    backgroundColor: alpha(color, 0.22),
    textColor: '#f7f8fb',
    borderColor: color,
    borderWidth: 2,
    borderRadius: 10,
    opacity: 0.95,
  };
};

const getRouteParam = (key: string): string => {
  if (typeof window === 'undefined') return '';
  const value = new URLSearchParams(window.location.search).get(key);
  return String(value || '').trim();
};

const getScopeStorageKey = (
  courseId: string,
  scope: AnnotationScope,
  lessonId?: string | null,
): string => {
  if (scope === 'skill' && lessonId) {
    return `${courseId}::skill::${lessonId}`;
  }
  return `${courseId}::course`;
};

type AnnotationStoreEntry = {
  items: VideoAnnotation[];
  duration: number;
  updatedAt: string;
  publishedAt?: string;
};

type AnnotationStoreMap = Record<string, AnnotationStoreEntry>;

const readAnnotationStore = (): AnnotationStoreMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ANNOTATION_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AnnotationStoreMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeAnnotationStore = (store: AnnotationStoreMap): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ANNOTATION_STORE_KEY, JSON.stringify(store));
  } catch {
    // Keep editor state in memory if storage is unavailable.
  }
};

const readAnnotationStoreFromDb = async (): Promise<AnnotationStoreMap | null> => {
  try {
    const response = await fetch(`/api/user/kv/${encodeURIComponent(ANNOTATION_KV_KEY)}`, {
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
        ? (JSON.parse(value) as AnnotationStoreMap)
        : (value as AnnotationStoreMap);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writeAnnotationStoreToDb = async (store: AnnotationStoreMap): Promise<void> => {
  try {
    await fetch('/api/user/kv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: ANNOTATION_KV_KEY, value: store }),
    });
  } catch {
    // Network/storage persistence errors are non-fatal for editor usage.
  }
};

const getAnnotationEntryUpdatedAt = (entry?: AnnotationStoreEntry): number => {
  if (!entry?.updatedAt) return 0;
  const ms = Date.parse(entry.updatedAt);
  return Number.isFinite(ms) ? ms : 0;
};

const mergeAnnotationStores = (
  localStore: AnnotationStoreMap,
  dbStore: AnnotationStoreMap,
): AnnotationStoreMap => {
  const merged: AnnotationStoreMap = {};
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
      getAnnotationEntryUpdatedAt(localEntry) >= getAnnotationEntryUpdatedAt(dbEntry)
        ? localEntry
        : dbEntry;
  });
  return merged;
};

const isLikelyAnnotationResource = (resource: { id: string; title: string }): boolean => {
  const resourceId = String(resource.id || '');
  const title = String(resource.title || '');
  return (
    resourceId.startsWith(ANNOTATION_RESOURCE_ID_PREFIX) ||
    title.startsWith('[Annotation]')
  );
};

const isVideoResource = (resource: { type?: string; url?: string }): boolean => {
  const normalizedType = String(resource.type || '').trim().toLowerCase();
  if (normalizedType === 'video') return true;
  const normalizedUrl = String(resource.url || '').trim().toLowerCase();
  if (!normalizedUrl) return false;
  return /\.(mp4|m4v|mov|webm|ogg|ogv|m3u8)(\?|#|$)/i.test(normalizedUrl);
};

const isAnnotationType = (value: string): value is VideoAnnotation['type'] => {
  return annotationTypes.some((entry) => entry.value === value);
};

const normalizeAnnotation = (annotation: VideoAnnotation): VideoAnnotation => {
  const normalizedType: VideoAnnotation['type'] = isAnnotationType(String(annotation.type))
    ? annotation.type
    : 'callout';
  const now = new Date().toISOString();
  const defaultAction = getDefaultAnnotationAction(normalizedType);
  const sourceAction =
    annotation.action && typeof annotation.action === 'object'
      ? annotation.action
      : defaultAction;
  return {
    ...annotation,
    type: normalizedType,
    title: String(annotation.title || 'Annotation'),
    content: String(annotation.content || getDefaultAnnotationContent(normalizedType)),
    startTime: clamp(Number(annotation.startTime || 0), 0, Number.MAX_SAFE_INTEGER),
    endTime:
      annotation.endTime === undefined || annotation.endTime === null
        ? undefined
        : clamp(Number(annotation.endTime), 0, Number.MAX_SAFE_INTEGER),
    position: {
      x: clamp(Number(annotation.position?.x ?? 12), 0, 100),
      y: clamp(Number(annotation.position?.y ?? 12), 0, 100),
    },
    size: {
      width: clamp(Number(annotation.size?.width ?? 26), 1, 100),
      height: clamp(Number(annotation.size?.height ?? 13), 1, 100),
    },
    style: {
      ...defaultAnnotationStyle(normalizedType),
      ...(annotation.style || {}),
      borderWidth: clamp(Number(annotation.style?.borderWidth ?? 2), 1, 8),
      borderRadius: clamp(Number(annotation.style?.borderRadius ?? 10), 0, 30),
      opacity: clamp(Number(annotation.style?.opacity ?? 0.95), 0.1, 1),
    },
    isVisible: annotation.isVisible !== false,
    isClickable: annotation.isClickable !== false,
    action: sourceAction
      ? {
          ...sourceAction,
          data:
            sourceAction.data && typeof sourceAction.data === 'object'
              ? sourceAction.data
              : {},
        }
      : undefined,
    createdAt: annotation.createdAt || now,
    updatedAt: annotation.updatedAt || now,
  };
};

const buildAnnotation = (
  type: VideoAnnotation['type'],
  startTime: number,
  position: { x: number; y: number },
  size: { width: number; height: number },
): VideoAnnotation => {
  const now = new Date().toISOString();
  return {
    id: `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title: getDefaultAnnotationTitle(type),
    content: getDefaultAnnotationContent(type),
    startTime,
    endTime: undefined,
    position,
    size,
    style: defaultAnnotationStyle(type),
    isVisible: true,
    isClickable: true,
    action: getDefaultAnnotationAction(type),
    createdAt: now,
    updatedAt: now,
  };
};

const normalizeInterviewAnnotationSuggestions = (
  value: unknown,
): PedagogicalAnnotationSuggestion[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const source = entry as Record<string, unknown>;
      const title = String(source.title || '').trim();
      const content = String(source.content || '').trim();
      const competency = String(source.competency || '').trim();
      if (!title || !content || !competency) return null;
      const typeRaw = String(source.type || '').trim().toLowerCase();
      const type: PedagogicalAnnotationSuggestion['type'] =
        typeRaw === 'hotspot' ||
        typeRaw === 'note' ||
        typeRaw === 'quiz' ||
        typeRaw === 'link' ||
        typeRaw === 'image' ||
        typeRaw === 'video'
          ? typeRaw
          : 'callout';
      const levelRaw = String(source.level || '').trim().toLowerCase();
      const level =
        levelRaw === 'basic'
          ? 'basic'
          : levelRaw === 'advanced'
            ? 'advanced'
            : 'operational';
      const actionTypeRaw = String(source.actionType || '').trim();
      const actionType =
        actionTypeRaw === 'navigate' ||
        actionTypeRaw === 'showContent' ||
        actionTypeRaw === 'openLink' ||
        actionTypeRaw === 'playVideo' ||
        actionTypeRaw === 'showQuiz'
          ? actionTypeRaw
          : undefined;
      return {
        id:
          String(source.id || '').trim() ||
          `interview-annotation-${`${competency}-${title}-${type}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") || index + 1}`,
        type,
        title,
        content,
        competency,
        skillTitle: String(source.skillTitle || '').trim() || undefined,
        level,
        startRatio: clamp(Number(source.startRatio || 0) || 0, 0, 0.97),
        endRatio: clamp(Number(source.endRatio || 0.1) || 0.1, 0.02, 1),
        actionType,
        actionTarget: String(source.actionTarget || '').trim() || undefined,
      } satisfies PedagogicalAnnotationSuggestion;
    })
    .filter((entry): entry is PedagogicalAnnotationSuggestion => Boolean(entry))
    .slice(0, 12);
};

const buildAnnotationsFromInterviewSuggestions = (
  suggestions: PedagogicalAnnotationSuggestion[],
  durationSeconds: number,
): VideoAnnotation[] => {
  const safeDuration = Math.max(20, Number(durationSeconds || 0) || 0);
  const lanePositions = [
    { x: 12, y: 12 },
    { x: 58, y: 14 },
    { x: 14, y: 48 },
    { x: 56, y: 52 },
  ];
  return suggestions.map((suggestion, index) => {
    const position = lanePositions[index % lanePositions.length];
    const startTime = clamp(safeDuration * clamp(suggestion.startRatio, 0, 0.96), 0, safeDuration);
    const endTime = clamp(
      safeDuration * Math.max(suggestion.endRatio, suggestion.startRatio + 0.06),
      startTime + MIN_ANNOTATION_DURATION,
      safeDuration,
    );
    return normalizeAnnotation({
      ...buildAnnotation(suggestion.type, startTime, position, { width: 28, height: 14 }),
      id: String(suggestion.id || `annotation-suggested-${Date.now()}-${index + 1}`),
      title: suggestion.title,
      content: suggestion.content,
      endTime,
      action:
        suggestion.actionType || suggestion.actionTarget
          ? {
              type: suggestion.actionType || getDefaultAnnotationAction(suggestion.type)?.type || 'showContent',
              target: suggestion.actionTarget,
            }
          : getDefaultAnnotationAction(suggestion.type),
    });
  });
};

function VideoAnnotationEditor({
  courseId: courseIdProp,
  lessonId: lessonIdProp,
  videoUrl = defaultVideoUrl,
  duration,
  annotations,
  onAnnotationsChange,
  onSave,
  onCancel,
}: VideoAnnotationEditorProps) {
  const { state, getCourse, getInstructor, updateCourse, updateLesson, setCurrentCourse } = useAcademy();
  const { analytics, debugging, performance: integrationPerformance } = useEnhancedMasterIntegration();
  const [location, setLocation] = useLocation();
  const routeCourseId = useMemo(
    () => String(courseIdProp || getRouteParam('courseId')),
    [courseIdProp, location],
  );
  const routeLessonId = useMemo(
    () => String(lessonIdProp || getRouteParam('lessonId') || getRouteParam('skillId')),
    [lessonIdProp, location],
  );
  const hydratedScopeKeyRef = useRef<string>('');
  const { navLabel, tt, isNorwegian } = useAcademyLocale();

  const editorRootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const undoStackRef = useRef<VideoAnnotation[][]>([]);
  const redoStackRef = useRef<VideoAnnotation[][]>([]);
  const timelineDragOriginRef = useRef<VideoAnnotation[] | null>(null);
  const canvasDragOriginRef = useRef<VideoAnnotation[] | null>(null);
  const interactionModeBeforePreviewRef = useRef<'draw' | 'select'>('draw');
  const sessionStartMsRef = useRef<number>(Date.now());
  const firstAnnotationMsRef = useRef<number | null>(null);
  const [leftNav, setLeftNav] = useState('tool-annotation');
  const [selectedCourseId, setSelectedCourseId] = useState(routeCourseId || '');
  const [annotationScope, setAnnotationScope] = useState<AnnotationScope>(routeLessonId ? 'skill' : 'course');
  const [selectedSkillId, setSelectedSkillId] = useState(routeLessonId || '');

  const [internalAnnotations, setInternalAnnotations] = useState<VideoAnnotation[]>(() =>
    Array.isArray(annotations) ? annotations : [],
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration && duration > 0 ? duration : 282);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTool, setActiveTool] = useState<VideoAnnotation['type']>('callout');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string>('');
  const [draftAnnotation, setDraftAnnotation] = useState<VideoAnnotation | null>(null);
  const [rightTab, setRightTab] = useState<RightPanelTab>('editor');
  const [searchValue, setSearchValue] = useState('');
  const [attachmentSearchValue, setAttachmentSearchValue] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [autoSaveState, setAutoSaveState] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string>(new Date().toISOString());
  const [lastPublishedAt, setLastPublishedAt] = useState<string>('');
  const [hasSavedChangesSincePublish, setHasSavedChangesSincePublish] = useState(false);
  const [safeAreaSnap, setSafeAreaSnap] = useState(true);
  const [timelineSnap, setTimelineSnap] = useState(true);
  const [annotationVersions, setAnnotationVersions] = useState<AnnotationVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [interactionMode, setInteractionMode] = useState<'draw' | 'select'>('draw');
  const [timelineDragState, setTimelineDragState] = useState<{
    annotationId: string;
    mode: 'move' | 'start' | 'end';
    pointerStartX: number;
    startTime: number;
    endTime: number;
  } | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null);
  const [draggingAnnotationId, setDraggingAnnotationId] = useState<string>('');
  const [hoverAnnotationId, setHoverAnnotationId] = useState<string>('');
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [studentPreviewAction, setStudentPreviewAction] = useState<StudentPreviewActionCard | null>(null);
  const [toolMenuAnchorEl, setToolMenuAnchorEl] = useState<HTMLElement | null>(null);
  const {
    simpleMode,
    toggleSimpleMode,
    workflowIntent,
    shouldShowAdvanced,
  } = useAcademyToolUx('annotation');

  const toolMenuOpen = Boolean(toolMenuAnchorEl);

  useEffect(() => {
    // Keep simple mode focused on selecting/moving existing annotations.
    if (!simpleMode) return;
    if (interactionMode === 'draw') {
      setInteractionMode('select');
    }
  }, [interactionMode, simpleMode]);

  useEffect(() => {
    if (!previewMode) {
      setStudentPreviewAction(null);
      return;
    }
    if (!studentPreviewAction) return;
    const timeout = window.setTimeout(() => {
      setStudentPreviewAction((previous) =>
        previous?.annotationId === studentPreviewAction.annotationId ? null : previous,
      );
    }, 2800);
    return () => window.clearTimeout(timeout);
  }, [previewMode, studentPreviewAction]);

  const courseItems = useMemo<Course[]>(() => {
    if (Array.isArray(state.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return [];
  }, [state.courses]);

  const courseOptionIds = useMemo(
    () => courseItems.map((course) => String(course.id)),
    [courseItems],
  );

  const activeCourse = useMemo(() => {
    const fromParam = courseIdProp ? getCourse(courseIdProp) : null;
    if (fromParam) return fromParam;
    const fromSelected = selectedCourseId
      ? courseItems.find((course) => String(course.id) === String(selectedCourseId))
      : null;
    if (fromSelected) return fromSelected;
    const fromRoute = routeCourseId ? getCourse(routeCourseId) : null;
    if (fromRoute) return fromRoute;
    return state.currentCourse || courseItems[0] || null;
  }, [courseIdProp, courseItems, getCourse, routeCourseId, selectedCourseId, state.currentCourse]);

  useEffect(() => {
    if (!activeCourse?.id) return;
    const inState = state.courses.some((course) => String(course.id) === String(activeCourse.id));
    if (!inState) return;
    if (String(state.currentCourse?.id || '') === String(activeCourse.id)) return;
    setCurrentCourse(activeCourse);
  }, [activeCourse, setCurrentCourse, state.courses, state.currentCourse?.id]);

  const selectedCourseValue = useMemo(() => {
    const preferredId = String(selectedCourseId || activeCourse?.id || routeCourseId || '');
    if (preferredId && courseOptionIds.includes(preferredId)) {
      return preferredId;
    }
    return courseOptionIds[0] || '';
  }, [activeCourse?.id, courseOptionIds, routeCourseId, selectedCourseId]);

  useEffect(() => {
    if (selectedCourseValue && selectedCourseId !== selectedCourseValue) {
      setSelectedCourseId(selectedCourseValue);
    }
  }, [selectedCourseId, selectedCourseValue]);

  useEffect(() => {
    const nextRouteCourseId = String(routeCourseId || '').trim();
    if (!nextRouteCourseId) return;
    setSelectedCourseId((prev) =>
      prev === nextRouteCourseId ? prev : nextRouteCourseId,
    );
  }, [routeCourseId]);

  useEffect(() => {
    const nextRouteLessonId = String(routeLessonId || '').trim();
    if (!nextRouteLessonId) return;
    if (annotationScope !== 'skill') {
      setAnnotationScope('skill');
    }
    if (nextRouteLessonId !== selectedSkillId) {
      setSelectedSkillId(nextRouteLessonId);
    }
  }, [annotationScope, routeLessonId, selectedSkillId]);

  const skillOptions = useMemo<Lesson[]>(() => {
    if (!activeCourse || !Array.isArray(activeCourse.lessons)) return [];
    return activeCourse.lessons;
  }, [activeCourse]);

  const selectedSkill = useMemo(() => {
    if (!selectedSkillId) return null;
    return skillOptions.find((lesson) => String(lesson.id) === String(selectedSkillId)) || null;
  }, [selectedSkillId, skillOptions]);

  useEffect(() => {
    if (annotationScope !== 'skill') return;
    if (skillOptions.length === 0) {
      setAnnotationScope('course');
      setSelectedSkillId('');
      return;
    }
    if (selectedSkill) return;
    const fallbackSkill = routeLessonId
      ? skillOptions.find((lesson) => String(lesson.id) === String(routeLessonId))
      : null;
    setSelectedSkillId(String((fallbackSkill || skillOptions[0]).id));
  }, [annotationScope, routeLessonId, selectedSkill, skillOptions]);

  useEffect(() => {
    const [pathnameRaw, rawQuery = ''] = String(location || '/academy/annotation-editor').split('?');
    const pathname = pathnameRaw || '/academy/annotation-editor';
    const params = new URLSearchParams(rawQuery);

    if (selectedCourseId) {
      params.set('courseId', selectedCourseId);
    } else {
      params.delete('courseId');
    }
    params.delete('course_id');

    if (annotationScope === 'skill' && selectedSkillId) {
      params.set('lessonId', selectedSkillId);
      params.delete('skillId');
    } else {
      params.delete('lessonId');
      params.delete('skillId');
    }

    const next = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    const current = String(location || '/academy/annotation-editor');
    if (next === current) return;
    setLocation(next);
  }, [annotationScope, location, selectedCourseId, selectedSkillId, setLocation]);

  const effectiveScope: AnnotationScope =
    annotationScope === 'skill' && selectedSkill ? 'skill' : 'course';

  const resolvedCourseId = useMemo(() => {
    const fromSelected = String(selectedCourseId || '').trim();
    if (fromSelected) return fromSelected;
    const fromRoute = String(routeCourseId || '').trim();
    if (fromRoute) return fromRoute;
    return String(activeCourse?.id || '').trim();
  }, [activeCourse?.id, routeCourseId, selectedCourseId]);

  const buildRouteWithContext = useCallback(
    (route: string, includeLesson: boolean = effectiveScope === 'skill'): string => {
      const target = String(route || '').trim();
      if (!target) return '';

      const protocolMatch = target.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
      if (protocolMatch && !/^https?$/i.test(protocolMatch[1])) {
        return target;
      }
      if (/^https?:\/\//i.test(target)) {
        return target;
      }

      const [pathPart, hashPart = ''] = target.split('#');
      const [pathname, searchPart = ''] = pathPart.split('?');
      const params = new URLSearchParams(searchPart);

      if (resolvedCourseId && !params.has('courseId') && !params.has('course_id')) {
        params.set('courseId', resolvedCourseId);
      }
      if (includeLesson && selectedSkill?.id && !params.has('lessonId') && !params.has('skillId')) {
        params.set('lessonId', String(selectedSkill.id));
      }

      const suffix = params.toString();
      return `${pathname}${suffix ? `?${suffix}` : ''}${hashPart ? `#${hashPart}` : ''}`;
    },
    [effectiveScope, resolvedCourseId, selectedSkill?.id],
  );

  const setLocationWithContext = useCallback(
    (route: string, includeLesson: boolean = false) => {
      const next = buildRouteWithContext(route, includeLesson);
      if (next) {
        setLocation(next);
      }
    },
    [buildRouteWithContext, setLocation],
  );

  const effectiveInstructor = useMemo(() => {
    const skillInstructorId =
      effectiveScope === 'skill'
        ? String(selectedSkill?.videoInstructorId || '').trim()
        : '';
    if (skillInstructorId) {
      const skillInstructor = getInstructor(skillInstructorId);
      if (skillInstructor) {
        return {
          id: String(skillInstructor.id || '').trim(),
          name: String(skillInstructor.name || '').trim(),
          avatar: String(skillInstructor.avatar || '').trim(),
        };
      }
    }

    const leadInstructorId = String(
      activeCourse?.competencyLeadInstructorId || activeCourse?.instructor?.id || '',
    ).trim();
    if (leadInstructorId) {
      const leadInstructor = getInstructor(leadInstructorId);
      if (leadInstructor) {
        return {
          id: String(leadInstructor.id || '').trim(),
          name: String(leadInstructor.name || '').trim(),
          avatar: String(leadInstructor.avatar || '').trim(),
        };
      }
    }

    const fallbackName = String(activeCourse?.instructor?.name || '').trim();
    if (!fallbackName) return null;
    return {
      id: String(activeCourse?.instructor?.id || '').trim() || 'legacy-course-instructor',
      name: fallbackName,
      avatar: String(activeCourse?.instructor?.avatar || '').trim(),
    };
  }, [
    activeCourse?.competencyLeadInstructorId,
    activeCourse?.instructor?.avatar,
    activeCourse?.instructor?.id,
    activeCourse?.instructor?.name,
    effectiveScope,
    getInstructor,
    selectedSkill?.videoInstructorId,
  ]);

  const scopeStorageKey = useMemo(() => {
    if (!activeCourse?.id) return '';
    return getScopeStorageKey(
      String(activeCourse.id),
      effectiveScope,
      selectedSkill ? String(selectedSkill.id) : undefined,
    );
  }, [activeCourse?.id, effectiveScope, selectedSkill]);

  const targetDuration = useMemo(() => {
    if (duration && duration > 0) return duration;
    const sourceDuration =
      effectiveScope === 'skill'
        ? Number(selectedSkill?.duration || 0)
        : Number(activeCourse?.duration || 0);
    if (Number.isFinite(sourceDuration) && sourceDuration > 0) {
      return Math.max(60, Math.round(sourceDuration));
    }
    return 282;
  }, [activeCourse?.duration, duration, effectiveScope, selectedSkill?.duration]);

  const effectiveVideoUrl = useMemo(() => {
    if (videoUrl && videoUrl.trim().length > 0 && videoUrl !== defaultVideoUrl) {
      return videoUrl;
    }
    if (effectiveScope === 'skill' && selectedSkill?.videoUrl) return selectedSkill.videoUrl;
    return resolveAcademyVideoUrl({
      course: activeCourse,
      preferredLessonId: effectiveScope === 'skill' ? String(selectedSkill?.id || '') : null,
      fallbackUrl: defaultVideoUrl,
    });
  }, [activeCourse, effectiveScope, selectedSkill?.id, selectedSkill?.videoUrl, videoUrl]);

  const interviewAnnotationSuggestions = useMemo(() => {
    const allSuggestions = normalizeInterviewAnnotationSuggestions(
      activeCourse?.pedagogicalArchitecture?.studioSuggestions?.annotations,
    );
    if (effectiveScope !== 'skill' || !selectedSkill) {
      return allSuggestions;
    }
    const skillKey = String(selectedSkill.title || '').trim().toLowerCase();
    if (!skillKey) return allSuggestions.slice(0, 5);
    const exactSkillMatches = allSuggestions.filter(
      (suggestion) =>
        String(suggestion.skillTitle || '').trim().toLowerCase() === skillKey,
    );
    if (exactSkillMatches.length > 0) return exactSkillMatches;
    const filtered = allSuggestions.filter((suggestion) => {
      const competency = String(suggestion.competency || '').trim().toLowerCase();
      const suggestionSkill = String(suggestion.skillTitle || '').trim().toLowerCase();
      const content = String(suggestion.content || '').trim().toLowerCase();
      const title = String(suggestion.title || '').trim().toLowerCase();
      return (
        suggestionSkill.includes(skillKey) ||
        competency.includes(skillKey) ||
        title.includes(skillKey) ||
        content.includes(skillKey)
      );
    });
    return filtered.length > 0 ? filtered : allSuggestions.slice(0, 5);
  }, [
    activeCourse?.pedagogicalArchitecture?.studioSuggestions?.annotations,
    effectiveScope,
    selectedSkill,
  ]);

  const scopeResources = useMemo<Array<CourseResource | LessonResource>>(() => {
    if (effectiveScope === 'skill') {
      return Array.isArray(selectedSkill?.resources) ? selectedSkill.resources : [];
    }
    return Array.isArray(activeCourse?.resources) ? activeCourse.resources : [];
  }, [activeCourse?.resources, effectiveScope, selectedSkill?.resources]);

  const attachmentResources = useMemo<Array<CourseResource | LessonResource>>(() => {
    return scopeResources.filter((resource) => !isLikelyAnnotationResource(resource));
  }, [scopeResources]);

  const resourceDerivedAnnotations = useMemo<VideoAnnotation[]>(() => {
    const annotationResources = scopeResources.filter((resource) => {
      const resourceId = String(resource.id || '');
      if (!isLikelyAnnotationResource(resource)) return false;
      if (effectiveScope === 'course') {
        return (
          resourceId.startsWith(ANNOTATION_RESOURCE_COURSE_PREFIX) ||
          (resourceId.startsWith(ANNOTATION_RESOURCE_ID_PREFIX) &&
            !resourceId.startsWith(ANNOTATION_RESOURCE_SKILL_PREFIX))
        );
      }
      const skillId = String(selectedSkill?.id || '');
      if (!skillId) return false;
      return resourceId.startsWith(`${ANNOTATION_RESOURCE_SKILL_PREFIX}${skillId}-`);
    });

    return annotationResources.map((resource, index) => {
      const resourceDescription = String(resource.description || '');
      const descriptionWithoutMeta = stripAnnotationMetaFromDescription(resourceDescription);
      const descriptionParts = descriptionWithoutMeta
        .split('·')
        .map((part) => part.trim())
        .filter(Boolean);
      const parsedRange = parseTimeRangeFromResourceDescription(resourceDescription);
      const parsedMeta = parseAnnotationMetaFromDescription(resourceDescription);
      const rawType = String(descriptionParts[0] || '').toLowerCase();
      const parsedType: VideoAnnotation['type'] = isAnnotationType(rawType) ? rawType : 'callout';
      const startTime = parsedRange?.startTime ?? Math.max(0, 8 + index * 12);
      const endTime = parsedRange?.endTime;
      const seeded = buildAnnotation(parsedType, startTime, { x: 14, y: 16 + index * 10 }, { width: 28, height: 14 });
      const cleanedTitle = String(resource.title || '')
        .replace(/^\[Annotation\](\[(Course|Skill)\])?\s*/i, '')
        .trim();
      const cleanedContent =
        descriptionParts.length > 2
          ? descriptionParts.slice(2).join(' · ')
          : String(descriptionWithoutMeta || seeded.content);

      const resourceId = String(resource.id || '')
        .replace(ANNOTATION_RESOURCE_COURSE_PREFIX, '')
        .replace(ANNOTATION_RESOURCE_SKILL_PREFIX, '')
        .replace(ANNOTATION_RESOURCE_ID_PREFIX, '');

      return normalizeAnnotation({
        ...seeded,
        ...(parsedMeta || {}),
        id: resourceId || seeded.id,
        title:
          cleanedTitle ||
          (typeof parsedMeta?.title === 'string' && parsedMeta.title.trim().length > 0
            ? parsedMeta.title
            : seeded.title),
        content:
          cleanedContent ||
          (typeof parsedMeta?.content === 'string' && parsedMeta.content.trim().length > 0
            ? parsedMeta.content
            : seeded.content),
        startTime:
          parsedRange?.startTime ??
          (typeof parsedMeta?.startTime === 'number' ? parsedMeta.startTime : seeded.startTime),
        endTime:
          parsedRange?.endTime ??
          (typeof parsedMeta?.endTime === 'number' ? parsedMeta.endTime : endTime),
        action:
          parsedMeta?.action && typeof parsedMeta.action === 'object'
            ? parsedMeta.action
            : parsedType === 'video'
              ? {
                  type: 'playVideo',
                  target: resource.url,
                  data: {
                    videoResourceId: String(resource.id || ''),
                  },
                }
              : {
                  type: 'openLink',
                  target: resource.url,
                },
      });
    });
  }, [effectiveScope, scopeResources, selectedSkill?.id]);

  useEffect(() => {
    if (Array.isArray(annotations)) {
      setInternalAnnotations(annotations);
    }
  }, [annotations]);

  useEffect(() => {
    if (duration && duration > 0) {
      setVideoDuration(duration);
      return;
    }
    setVideoDuration(targetDuration);
  }, [duration, targetDuration]);

  useEffect(() => {
    if (!scopeStorageKey || (onAnnotationsChange && Array.isArray(annotations))) return;
    if (hydratedScopeKeyRef.current === scopeStorageKey) return;
    hydratedScopeKeyRef.current = scopeStorageKey;

    const store = readAnnotationStore();
    const stored = store[scopeStorageKey];
    if (stored && Array.isArray(stored.items) && stored.items.length > 0) {
      const normalizedItems = stored.items.map(normalizeAnnotation);
      setInternalAnnotations(normalizedItems);
      setSelectedAnnotationId(normalizedItems[0]?.id || '');
      setDraftAnnotation(null);
      setLastPublishedAt(String(stored.publishedAt || ''));
      setHasSavedChangesSincePublish(hasSavedDraftNewerThanPublished(stored.updatedAt, stored.publishedAt));
      if (!duration) {
        setVideoDuration(Math.max(60, Number(stored.duration || targetDuration)));
      }
      return;
    }

    if (resourceDerivedAnnotations.length > 0) {
      setInternalAnnotations(resourceDerivedAnnotations);
      setSelectedAnnotationId(resourceDerivedAnnotations[0]?.id || '');
      setDraftAnnotation(null);
      setLastPublishedAt('');
      setHasSavedChangesSincePublish(false);
      return;
    }

    if (interviewAnnotationSuggestions.length > 0) {
      const suggestedAnnotations = buildAnnotationsFromInterviewSuggestions(
        interviewAnnotationSuggestions,
        targetDuration,
      );
      setInternalAnnotations(suggestedAnnotations);
      setSelectedAnnotationId(suggestedAnnotations[0]?.id || '');
      setDraftAnnotation(null);
      setLastPublishedAt('');
      setHasSavedChangesSincePublish(false);
      setSaveMessage(
        tt(
          'Annoteringsutkast er hentet fra kompetanseintervjuet.',
          'Annotation draft was loaded from the competency interview.',
        ),
      );
      return;
    }

    if (Array.isArray(annotations) && annotations.length > 0) {
      const normalizedItems = annotations.map(normalizeAnnotation);
      setInternalAnnotations(normalizedItems);
      setSelectedAnnotationId(normalizedItems[0]?.id || '');
      setDraftAnnotation(null);
      setLastPublishedAt('');
      setHasSavedChangesSincePublish(false);
      return;
    }

    setInternalAnnotations([]);
    setSelectedAnnotationId('');
    setDraftAnnotation(null);
    setLastPublishedAt('');
    setHasSavedChangesSincePublish(false);
  }, [
    annotations,
    duration,
    interviewAnnotationSuggestions,
    onAnnotationsChange,
    resourceDerivedAnnotations,
    scopeStorageKey,
    targetDuration,
    tt,
  ]);

  useEffect(() => {
    if (!scopeStorageKey || (onAnnotationsChange && Array.isArray(annotations))) return;
    let cancelled = false;

    void (async () => {
      const localStore = readAnnotationStore();
      const dbStore = await readAnnotationStoreFromDb();
      if (cancelled) return;

      if (!dbStore) {
        if (Object.keys(localStore).length > 0) {
          void writeAnnotationStoreToDb(localStore);
        }
        return;
      }

      const mergedStore = mergeAnnotationStores(localStore, dbStore);
      const mergedSerialized = JSON.stringify(mergedStore);

      if (mergedSerialized && JSON.stringify(localStore) !== mergedSerialized) {
        writeAnnotationStore(mergedStore);
      }
      if (mergedSerialized && JSON.stringify(dbStore) !== mergedSerialized) {
        void writeAnnotationStoreToDb(mergedStore);
      }

      const mergedEntry = mergedStore[scopeStorageKey];
      if (!mergedEntry || !Array.isArray(mergedEntry.items)) {
        setLastPublishedAt('');
        setHasSavedChangesSincePublish(false);
        return;
      }

      const normalizedItems = mergedEntry.items.map(normalizeAnnotation);
      setInternalAnnotations(normalizedItems);
      setSelectedAnnotationId(normalizedItems[0]?.id || '');
      setDraftAnnotation(null);
      setLastPublishedAt(String(mergedEntry.publishedAt || ''));
      setHasSavedChangesSincePublish(hasSavedDraftNewerThanPublished(mergedEntry.updatedAt, mergedEntry.publishedAt));
      if (!duration) {
        setVideoDuration(Math.max(60, Number(mergedEntry.duration || targetDuration)));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    annotations,
    duration,
    onAnnotationsChange,
    scopeStorageKey,
    targetDuration,
  ]);

  const annotationItems = useMemo(() => {
    if (onAnnotationsChange && Array.isArray(annotations)) {
      return annotations;
    }
    return internalAnnotations;
  }, [annotations, internalAnnotations, onAnnotationsChange]);

  const previewAnnotations = useMemo(() => {
    if (!draftAnnotation) return annotationItems;
    const exists = annotationItems.some((annotation) => annotation.id === draftAnnotation.id);
    if (exists) {
      return annotationItems.map((annotation) =>
        annotation.id === draftAnnotation.id ? normalizeAnnotation(draftAnnotation) : annotation,
      );
    }
    return [...annotationItems, normalizeAnnotation(draftAnnotation)];
  }, [annotationItems, draftAnnotation]);

  const validationIssues = useMemo(
    () => validateAnnotations(previewAnnotations, videoDuration, tt),
    [previewAnnotations, tt, videoDuration],
  );

  const publishBlockingIssues = useMemo(
    () => validationIssues.filter((issue) => issue.severity === 'error'),
    [validationIssues],
  );

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

  useEffect(() => {
    if (!scopeStorageKey) return;
    setAutoSaveState('saving');
    const timer = window.setTimeout(() => {
      const normalized = annotationItems.map(normalizeAnnotation);
      const store = readAnnotationStore();
      const previousEntry = store[scopeStorageKey];
      store[scopeStorageKey] = {
        items: normalized,
        duration: videoDuration,
        updatedAt: new Date().toISOString(),
        publishedAt: previousEntry?.publishedAt,
      };
      writeAnnotationStore(store);
      setLastPublishedAt(String(previousEntry?.publishedAt || ''));
      setHasSavedChangesSincePublish(Boolean(previousEntry?.publishedAt));
      setAutoSaveState('saved');
      setLastSavedAt(new Date().toISOString());
    }, 320);
    return () => {
      window.clearTimeout(timer);
    };
  }, [annotationItems, scopeStorageKey, videoDuration]);

  const recordVersion = useCallback((label: string, snapshot: VideoAnnotation[]) => {
    const normalizedSnapshot = snapshot.map(normalizeAnnotation);
    const versionId = `annotation-version-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setAnnotationVersions((prev) => {
      const nextVersion: AnnotationVersion = {
        id: versionId,
        label,
        createdAt: new Date().toISOString(),
        items: normalizedSnapshot,
      };
      return [nextVersion, ...prev].slice(0, MAX_VERSION_HISTORY);
    });
    setSelectedVersionId(versionId);
  }, []);

  const pushUndoSnapshot = useCallback(
    (snapshot: VideoAnnotation[], label: string) => {
      const normalizedSnapshot = snapshot.map(normalizeAnnotation);
      undoStackRef.current = [...undoStackRef.current, normalizedSnapshot].slice(-80);
      redoStackRef.current = [];
      recordVersion(label, normalizedSnapshot);
    },
    [recordVersion],
  );

  const commitAnnotations = useCallback(
    (
      nextAnnotations: VideoAnnotation[],
      options?: {
        recordHistory?: boolean;
        historyLabel?: string;
      },
    ) => {
      const normalizedNext = nextAnnotations.map(normalizeAnnotation);
      const normalizedCurrent = annotationItems.map(normalizeAnnotation);
      const hasChanged = JSON.stringify(normalizedNext) !== JSON.stringify(normalizedCurrent);
      if (!hasChanged) return;

      if (options?.recordHistory !== false) {
        pushUndoSnapshot(normalizedCurrent, options?.historyLabel || tt('Redigering', 'Edit'));
      }

      if (firstAnnotationMsRef.current === null && normalizedCurrent.length === 0 && normalizedNext.length > 0) {
        firstAnnotationMsRef.current = Date.now();
        analytics.trackEvent('annotation_time_to_first_item', {
          elapsedMs: Math.max(0, firstAnnotationMsRef.current - sessionStartMsRef.current),
          timestamp: Date.now(),
        });
      }

      setAutoSaveState('dirty');
      setInternalAnnotations(normalizedNext);
      onAnnotationsChange?.(normalizedNext);
    },
    [annotationItems, analytics, onAnnotationsChange, pushUndoSnapshot, tt],
  );

  const undoAnnotations = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    const current = annotationItems.map(normalizeAnnotation);
    redoStackRef.current = [...redoStackRef.current, current].slice(-80);
    setInternalAnnotations(previous);
    onAnnotationsChange?.(previous);
    setAutoSaveState('dirty');
    setSaveMessage(tt('Angret siste endring.', 'Undid latest change.'));
  }, [annotationItems, onAnnotationsChange, tt]);

  const redoAnnotations = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    const current = annotationItems.map(normalizeAnnotation);
    undoStackRef.current = [...undoStackRef.current, current].slice(-80);
    setInternalAnnotations(next);
    onAnnotationsChange?.(next);
    setAutoSaveState('dirty');
    setSaveMessage(tt('Gjorde om siste endring.', 'Redid latest change.'));
  }, [annotationItems, onAnnotationsChange, tt]);

  const selectedAnnotation = useMemo(
    () => previewAnnotations.find((annotation) => annotation.id === selectedAnnotationId) || null,
    [previewAnnotations, selectedAnnotationId],
  );

  useEffect(() => {
    if (!draftAnnotation) return;
    const committed = annotationItems.find((annotation) => annotation.id === draftAnnotation.id);
    if (!committed) {
      setAutoSaveState('dirty');
      return;
    }
    if (JSON.stringify(normalizeAnnotation(committed)) !== JSON.stringify(normalizeAnnotation(draftAnnotation))) {
      setAutoSaveState('dirty');
    }
  }, [annotationItems, draftAnnotation]);

  const selectedAnnotationAttachmentIds = useMemo(() => {
    const sourceAnnotation =
      draftAnnotation && draftAnnotation.id === selectedAnnotationId ? draftAnnotation : selectedAnnotation;
    const maybeIds = sourceAnnotation?.action?.data?.attachmentIds;
    if (!Array.isArray(maybeIds)) return [];
    return maybeIds.filter((value): value is string => typeof value === 'string' && value.length > 0);
  }, [
    draftAnnotation,
    selectedAnnotation,
    selectedAnnotationId,
  ]);

  const filteredAnnotations = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return previewAnnotations;
    return previewAnnotations.filter((annotation) => {
      return (
        annotation.title.toLowerCase().includes(query) ||
        annotation.content.toLowerCase().includes(query) ||
        annotation.type.toLowerCase().includes(query)
      );
    });
  }, [previewAnnotations, searchValue]);

  const filteredAttachmentResources = useMemo(() => {
    const query = attachmentSearchValue.trim().toLowerCase();
    if (!query) return attachmentResources;
    return attachmentResources.filter((resource) => {
      const haystack = `${resource.title} ${resource.type} ${resource.description || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [attachmentResources, attachmentSearchValue]);

  const videoAttachmentResources = useMemo(() => {
    return attachmentResources.filter((resource) => isVideoResource(resource));
  }, [attachmentResources]);

  const draftVideoSourceValue = useMemo(() => {
    if (!draftAnnotation || draftAnnotation.type !== 'video') return 'none';
    const explicitResourceId = String(draftAnnotation.action?.data?.videoResourceId || '').trim();
    const target = String(draftAnnotation.action?.target || '').trim();
    if (explicitResourceId) {
      const found = videoAttachmentResources.find(
        (resource) => String(resource.id || '') === explicitResourceId,
      );
      if (found) return explicitResourceId;
    }
    if (!target) return 'none';
    const matchedByUrl = videoAttachmentResources.find(
      (resource) => String(resource.url || '').trim() === target,
    );
    return matchedByUrl ? String(matchedByUrl.id || '') : 'manual';
  }, [draftAnnotation, videoAttachmentResources]);

  const timelinePercent = useMemo(() => {
    if (!videoDuration) return 0;
    return clamp((currentTime / videoDuration) * 100, 0, 100);
  }, [currentTime, videoDuration]);

  const nudgeSelectedAnnotation = useCallback(
    (deltaX: number, deltaY: number, step: number) => {
      if (!selectedAnnotationId) return;
      const selected =
        previewAnnotations.find((annotation) => annotation.id === selectedAnnotationId) || null;
      if (!selected) return;

      const safeMin = safeAreaSnap ? SAFE_AREA_MARGIN : 0;
      const safeMaxX = safeAreaSnap ? 100 - SAFE_AREA_MARGIN : 100;
      const safeMaxY = safeAreaSnap ? 100 - SAFE_AREA_MARGIN : 100;
      const nextX = clamp(
        selected.position.x + deltaX * step,
        safeMin,
        Math.max(safeMin, safeMaxX - selected.size.width),
      );
      const nextY = clamp(
        selected.position.y + deltaY * step,
        safeMin,
        Math.max(safeMin, safeMaxY - selected.size.height),
      );

      if (nextX === selected.position.x && nextY === selected.position.y) return;

      const updated: VideoAnnotation = {
        ...selected,
        position: { x: nextX, y: nextY },
        updatedAt: new Date().toISOString(),
      };

      const existsInCommitted = annotationItems.some(
        (annotation) => annotation.id === selectedAnnotationId,
      );
      if (existsInCommitted) {
        commitAnnotations(
          annotationItems.map((annotation) =>
            annotation.id === selectedAnnotationId ? updated : annotation,
          ),
          { historyLabel: tt('Flytt annotering', 'Move annotation') },
        );
      }
      setDraftAnnotation((prev) => (prev && prev.id === selectedAnnotationId ? updated : prev));
    },
    [
      annotationItems,
      commitAnnotations,
      previewAnnotations,
      safeAreaSnap,
      selectedAnnotationId,
      tt,
    ],
  );

  const annotationTypeLabel = useCallback(
    (type: VideoAnnotation['type']) => {
      switch (type) {
        case 'callout':
          return tt('Callout', 'Callout');
        case 'note':
          return tt('Notat', 'Note');
        case 'hotspot':
          return tt('Hotspot', 'Hotspot');
        case 'quiz':
          return tt('Quiz', 'Quiz');
        case 'link':
          return tt('Lenke', 'Link');
        case 'image':
          return tt('Bilde', 'Image');
        case 'video':
          return tt('Video', 'Video');
        default:
          return type;
      }
    },
    [tt],
  );

  useEffect(() => {
    const endTiming =
      typeof integrationPerformance?.startTiming === 'function'
        ? integrationPerformance.startTiming('video_annotation_editor_render')
        : () => {};

    analytics.trackEvent('video_annotation_editor_mounted', {
      videoUrl: effectiveVideoUrl,
      duration: videoDuration,
      annotationCount: annotationItems.length,
      courseId: resolvedCourseId || null,
      scope: effectiveScope,
      lessonId: effectiveScope === 'skill' ? selectedSkill?.id || null : null,
      instructorId: effectiveInstructor?.id || null,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'VideoAnnotationEditor mounted', {
      videoUrl: effectiveVideoUrl,
      duration: videoDuration,
      annotationCount: annotationItems.length,
      courseId: resolvedCourseId || null,
      scope: effectiveScope,
      lessonId: effectiveScope === 'skill' ? selectedSkill?.id || null : null,
      instructorId: effectiveInstructor?.id || null,
    });

    return () => {
      endTiming();
      analytics.trackEvent('video_annotation_editor_unmounted', {
        videoUrl: effectiveVideoUrl,
        duration: videoDuration,
        annotationCount: annotationItems.length,
        courseId: resolvedCourseId || null,
        scope: effectiveScope,
        lessonId: effectiveScope === 'skill' ? selectedSkill?.id || null : null,
        instructorId: effectiveInstructor?.id || null,
        timestamp: Date.now(),
      });
    };
  }, [
    analytics,
    annotationItems.length,
    resolvedCourseId,
    debugging,
    effectiveInstructor?.id,
    effectiveScope,
    effectiveVideoUrl,
    integrationPerformance,
    selectedSkill?.id,
    videoDuration,
  ]);

  const syncCanvasSize = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const rect = video.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const nextWidth = Math.round(rect.width);
    const nextHeight = Math.round(rect.height);

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
  }, []);

  useEffect(() => {
    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, [syncCanvasSize]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    previewAnnotations.forEach((annotation) => {
      if (!annotation.isVisible) return;

      const isActiveAtTime =
        currentTime >= annotation.startTime &&
        (annotation.endTime === undefined || currentTime <= annotation.endTime);

      if (previewMode && !isActiveAtTime) return;

      const x = (clamp(annotation.position.x, 0, 100) / 100) * canvas.width;
      const y = (clamp(annotation.position.y, 0, 100) / 100) * canvas.height;
      const width = (clamp(annotation.size.width, 1, 100) / 100) * canvas.width;
      const height = (clamp(annotation.size.height, 1, 100) / 100) * canvas.height;

      ctx.fillStyle = annotation.style.backgroundColor;
      ctx.globalAlpha = clamp(annotation.style.opacity, 0.1, 1);
      ctx.fillRect(x, y, width, height);

      const isSelected = !previewMode && annotation.id === selectedAnnotationId;
      const isHovered = !previewMode && annotation.id === hoverAnnotationId;
      ctx.strokeStyle = isSelected
        ? '#f8b321'
        : isHovered
          ? '#f8d675'
          : annotation.style.borderColor;
      ctx.lineWidth = isSelected
        ? annotation.style.borderWidth + 1
        : isHovered
          ? Math.max(1.6, annotation.style.borderWidth + 0.8)
          : annotation.style.borderWidth;
      ctx.globalAlpha = 1;
      ctx.strokeRect(x, y, width, height);

      if (isHovered && !isSelected) {
        ctx.strokeStyle = alpha('#f8d675', 0.68);
        ctx.lineWidth = 1.2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
        ctx.setLineDash([]);
      }

      const paddingX = 10;
      const paddingY = 8;
      const innerWidth = Math.max(0, width - paddingX * 2);
      const titleText = String(annotation.title || '').trim() || 'Annotation';
      const contentText = String(annotation.content || '').trim();

      ctx.fillStyle = annotation.style.textColor;
      ctx.font = '600 12px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const visibleTitle = titleText.length > 42 ? `${titleText.slice(0, 41)}…` : titleText;
      ctx.fillText(visibleTitle, x + paddingX, y + paddingY, innerWidth);

      if (contentText && innerWidth > 18 && height > 28) {
        ctx.font = '500 11px "Segoe UI", sans-serif';
        ctx.fillStyle = alpha(annotation.style.textColor, 0.92);

        const words = contentText.split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let currentLine = '';

        words.forEach((word) => {
          const candidate = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(candidate).width <= innerWidth) {
            currentLine = candidate;
            return;
          }

          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
            return;
          }

          let truncated = word;
          while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > innerWidth) {
            truncated = truncated.slice(0, -1);
          }
          lines.push(`${truncated}…`);
          currentLine = '';
        });

        if (currentLine) {
          lines.push(currentLine);
        }

        const maxLines = Math.max(1, Math.floor((height - (paddingY * 2) - 14) / 13));
        const visibleLines = lines.slice(0, maxLines);
        if (lines.length > maxLines && visibleLines.length > 0) {
          let lastLine = visibleLines[visibleLines.length - 1];
          while (lastLine.length > 1 && ctx.measureText(`${lastLine}…`).width > innerWidth) {
            lastLine = lastLine.slice(0, -1);
          }
          visibleLines[visibleLines.length - 1] = `${lastLine}…`;
        }

        visibleLines.forEach((line, index) => {
          ctx.fillText(line, x + paddingX, y + paddingY + 16 + index * 13, innerWidth);
        });
      }
    });

    if (safeAreaSnap && !previewMode) {
      const marginX = (SAFE_AREA_MARGIN / 100) * canvas.width;
      const marginY = (SAFE_AREA_MARGIN / 100) * canvas.height;
      ctx.strokeStyle = 'rgba(248,179,33,0.24)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(
        marginX,
        marginY,
        Math.max(0, canvas.width - marginX * 2),
        Math.max(0, canvas.height - marginY * 2),
      );
      ctx.setLineDash([]);
    }

    if (!previewMode && isDrawing && drawStart && drawEnd) {
      const x = Math.min(drawStart.x, drawEnd.x);
      const y = Math.min(drawStart.y, drawEnd.y);
      const w = Math.max(Math.abs(drawEnd.x - drawStart.x), 2);
      const h = Math.max(Math.abs(drawEnd.y - drawStart.y), 2);

      ctx.strokeStyle = '#f8b321';
      ctx.setLineDash([8, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect((x / 100) * canvas.width, (y / 100) * canvas.height, (w / 100) * canvas.width, (h / 100) * canvas.height);
      ctx.setLineDash([]);
    }
  }, [
    currentTime,
    drawEnd,
    drawStart,
    hoverAnnotationId,
    isDrawing,
    previewAnnotations,
    previewMode,
    safeAreaSnap,
    selectedAnnotationId,
  ]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => undefined);
      setIsPlaying(true);
      return;
    }

    video.pause();
    setIsPlaying(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime || 0);
  }, []);

  const handleSeek = useCallback((_: Event, newValue: number | number[]) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  }, []);

  const toggleStudentPreview = useCallback(() => {
    if (previewMode) {
      setPreviewMode(false);
      setInteractionMode(interactionModeBeforePreviewRef.current);
      return;
    }

    interactionModeBeforePreviewRef.current = interactionMode;
    setInteractionMode('select');
    setPreviewMode(true);
    setHoverAnnotationId('');
    setDraggingAnnotationId('');
    setDragOffset(null);
    setIsDrawing(false);
    setDrawStart(null);
    setDrawEnd(null);
    setTimelineDragState(null);
    canvasDragOriginRef.current = null;

    const hasActiveAnnotation = previewAnnotations.some((annotation) => {
      if (!annotation.isVisible) return false;
      const safeEnd = resolveAnnotationEndTime(annotation, videoDuration);
      return currentTime >= annotation.startTime && currentTime <= safeEnd;
    });
    if (hasActiveAnnotation) return;

    const firstVisible = [...previewAnnotations]
      .filter((annotation) => annotation.isVisible)
      .sort((left, right) => left.startTime - right.startTime)[0];
    if (!firstVisible) return;

    const seekTo = clamp(firstVisible.startTime, 0, Math.max(0, videoDuration || firstVisible.startTime));
    const video = videoRef.current;
    if (video) {
      video.currentTime = seekTo;
    }
    setCurrentTime(seekTo);
  }, [currentTime, interactionMode, previewAnnotations, previewMode, videoDuration]);

  const beginTimelineDrag = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement>,
      annotation: VideoAnnotation,
      mode: 'move' | 'start' | 'end',
    ) => {
      event.preventDefault();
      event.stopPropagation();
      const safeEnd = resolveAnnotationEndTime(annotation, videoDuration);
      timelineDragOriginRef.current = annotationItems.map(normalizeAnnotation);
      setSelectedAnnotationId(annotation.id);
      setHoverAnnotationId(annotation.id);
      setTimelineDragState({
        annotationId: annotation.id,
        mode,
        pointerStartX: event.clientX,
        startTime: annotation.startTime,
        endTime: safeEnd,
      });
    },
    [annotationItems, videoDuration],
  );

  useEffect(() => {
    if (!timelineDragState) return undefined;

    const handleMove = (event: MouseEvent): void => {
      const trackRect = timelineTrackRef.current?.getBoundingClientRect();
      if (!trackRect || trackRect.width <= 0 || videoDuration <= 0) return;

      const deltaPx = event.clientX - timelineDragState.pointerStartX;
      const deltaSeconds = (deltaPx / trackRect.width) * videoDuration;

      const snapTime = (value: number): number => {
        const clamped = clamp(value, 0, videoDuration);
        if (!timelineSnap) return clamped;
        const intervalSnapped = Math.round(clamped / TIMELINE_SNAP_STEP) * TIMELINE_SNAP_STEP;
        if (Math.abs(clamped - currentTime) <= TIMELINE_SNAP_STEP / 1.5) {
          return clamp(currentTime, 0, videoDuration);
        }
        return clamp(intervalSnapped, 0, videoDuration);
      };

      const nextItems = annotationItems.map((annotation) => {
        if (annotation.id !== timelineDragState.annotationId) return annotation;

        const originalStart = timelineDragState.startTime;
        const originalEnd = timelineDragState.endTime;
        const originalDuration = Math.max(MIN_ANNOTATION_DURATION, originalEnd - originalStart);

        if (timelineDragState.mode === 'move') {
          const nextStart = snapTime(originalStart + deltaSeconds);
          const maxStart = Math.max(0, videoDuration - originalDuration);
          const clampedStart = clamp(nextStart, 0, maxStart);
          const nextEnd = clamp(clampedStart + originalDuration, 0, videoDuration);
          return {
            ...annotation,
            startTime: clampedStart,
            endTime: nextEnd,
            updatedAt: new Date().toISOString(),
          };
        }

        if (timelineDragState.mode === 'start') {
          const nextStart = snapTime(originalStart + deltaSeconds);
          const clampedStart = clamp(nextStart, 0, Math.max(0, originalEnd - MIN_ANNOTATION_DURATION));
          return {
            ...annotation,
            startTime: clampedStart,
            endTime: originalEnd,
            updatedAt: new Date().toISOString(),
          };
        }

        const nextEnd = snapTime(originalEnd + deltaSeconds);
        const clampedEnd = clamp(nextEnd, originalStart + MIN_ANNOTATION_DURATION, videoDuration);
        return {
          ...annotation,
          startTime: originalStart,
          endTime: clampedEnd,
          updatedAt: new Date().toISOString(),
        };
      });

      commitAnnotations(nextItems, { recordHistory: false });
      setDraftAnnotation((prev) => {
        if (!prev || prev.id !== timelineDragState.annotationId) return prev;
        const committed = nextItems.find((annotation) => annotation.id === prev.id);
        if (committed) return committed;

        // Keep timeline drag responsive for unsaved draft annotations.
        const originalStart = timelineDragState.startTime;
        const originalEnd = timelineDragState.endTime;
        const originalDuration = Math.max(MIN_ANNOTATION_DURATION, originalEnd - originalStart);

        if (timelineDragState.mode === 'move') {
          const nextStart = snapTime(originalStart + deltaSeconds);
          const maxStart = Math.max(0, videoDuration - originalDuration);
          const clampedStart = clamp(nextStart, 0, maxStart);
          const nextEnd = clamp(clampedStart + originalDuration, 0, videoDuration);
          return {
            ...prev,
            startTime: clampedStart,
            endTime: nextEnd,
            updatedAt: new Date().toISOString(),
          };
        }

        if (timelineDragState.mode === 'start') {
          const nextStart = snapTime(originalStart + deltaSeconds);
          const clampedStart = clamp(nextStart, 0, Math.max(0, originalEnd - MIN_ANNOTATION_DURATION));
          return {
            ...prev,
            startTime: clampedStart,
            endTime: originalEnd,
            updatedAt: new Date().toISOString(),
          };
        }

        const nextEnd = snapTime(originalEnd + deltaSeconds);
        const clampedEnd = clamp(nextEnd, originalStart + MIN_ANNOTATION_DURATION, videoDuration);
        return {
          ...prev,
          startTime: originalStart,
          endTime: clampedEnd,
          updatedAt: new Date().toISOString(),
        };
      });
    };

    const handleUp = (): void => {
      const origin = timelineDragOriginRef.current;
      if (origin) {
        const normalizedOrigin = origin.map(normalizeAnnotation);
        const normalizedCurrent = annotationItems.map(normalizeAnnotation);
        if (JSON.stringify(normalizedOrigin) !== JSON.stringify(normalizedCurrent)) {
          pushUndoSnapshot(normalizedOrigin, tt('Juster tidslinje', 'Adjust timeline'));
        }
      }
      timelineDragOriginRef.current = null;
      setTimelineDragState(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [
    annotationItems,
    commitAnnotations,
    currentTime,
    pushUndoSnapshot,
    timelineDragState,
    timelineSnap,
    tt,
    videoDuration,
  ]);

  const handleLoadedMetadata = useCallback(() => {
    const measuredDuration = videoRef.current?.duration;
    if (measuredDuration && Number.isFinite(measuredDuration) && measuredDuration > 0) {
      setVideoDuration(measuredDuration);
    }
    syncCanvasSize();
  }, [syncCanvasSize]);

  const prepareDraft = useCallback(
    (annotation: VideoAnnotation) => {
      setSelectedAnnotationId(annotation.id);
      setDraftAnnotation({ ...annotation });
      setRightTab('editor');
    },
    [],
  );

  const addAnnotation = useCallback(
    (type: VideoAnnotation['type']) => {
      setActiveTool(type);
      let created = buildAnnotation(type, currentTime, { x: 14, y: 16 }, { width: 26, height: 13 });
      if (type === 'video' && videoAttachmentResources.length > 0) {
        const firstVideo = videoAttachmentResources[0];
        created = normalizeAnnotation({
          ...created,
          action: {
            ...(created.action || { type: 'playVideo' }),
            type: 'playVideo',
            target: String(firstVideo.url || ''),
            data: {
              ...(created.action?.data || {}),
              videoResourceId: String(firstVideo.id || ''),
            },
          },
        });
      }
      prepareDraft(created);
      analytics.trackEvent('annotation_added', {
        type,
        annotationTime: currentTime,
        timestamp: Date.now(),
      });
    },
    [analytics, currentTime, prepareDraft, videoAttachmentResources],
  );

  const applyTemplate = useCallback(
    (templateId: string) => {
      const templateItems = buildTemplateById(templateId, videoDuration, isNorwegian);
      if (templateItems.length === 0) return;
      const nextItems =
        annotationItems.length > 0
          ? [...annotationItems, ...templateItems]
          : templateItems;
      commitAnnotations(nextItems, {
        historyLabel: tt('Bruk annoteringsmal', 'Apply annotation template'),
      });
      const first = templateItems[0];
      if (first) {
        setSelectedAnnotationId(first.id);
        setDraftAnnotation(first);
      }
      setSaveMessage(tt('Template lagt til.', 'Template applied.'));
    },
    [annotationItems, commitAnnotations, isNorwegian, tt, videoDuration],
  );

  const applyInterviewAnnotationSuggestions = useCallback(() => {
    if (interviewAnnotationSuggestions.length === 0) return;
    const suggestedItems = buildAnnotationsFromInterviewSuggestions(
      interviewAnnotationSuggestions,
      videoDuration,
    );
    commitAnnotations(suggestedItems, {
      historyLabel: tt('Bruk intervjuforslag', 'Apply interview suggestions'),
    });
    setSelectedAnnotationId(suggestedItems[0]?.id || '');
    setDraftAnnotation(suggestedItems[0] || null);
    setSaveMessage(
      tt(
        'Annoteringsutkast oppdatert fra kompetanseintervjuet.',
        'Annotation draft updated from the competency interview.',
      ),
    );
  }, [
    commitAnnotations,
    interviewAnnotationSuggestions,
    tt,
    videoDuration,
  ]);

  const restoreVersion = useCallback(
    (versionId: string) => {
      const target = annotationVersions.find((entry) => entry.id === versionId);
      if (!target) return;
      commitAnnotations(target.items, {
        historyLabel: tt('Gjenopprett versjon', 'Restore version'),
      });
      setSelectedVersionId(target.id);
      setDraftAnnotation(null);
      setSaveMessage(tt('Versjon gjenopprettet.', 'Version restored.'));
    },
    [annotationVersions, commitAnnotations, tt],
  );

  const runAutoFix = useCallback(async () => {
    const fixedGeometry = applyAutoFixes(previewAnnotations, videoDuration);
    const contextSummary = [
      String(activeCourse?.title || '').trim(),
      String(activeCourse?.description || '').trim(),
      String(selectedSkill?.title || '').trim(),
      String(selectedSkill?.description || '').trim(),
    ]
      .filter((value) => value.length > 0)
      .join(' — ');

    const mobileTextIssueByAnnotation = new Set(
      validationIssues
        .filter((issue) => issue.type === 'mobile-text' && issue.annotationId)
        .map((issue) => String(issue.annotationId)),
    );

    let fixed = fixedGeometry.map((annotation, index) => {
      const fallbackTitle = `${annotationTypeLabel(annotation.type)} ${index + 1}`;
      const hasMobileIssue = mobileTextIssueByAnnotation.has(annotation.id);
      const title = isGenericAnnotationTitle(annotation.title)
        ? fallbackTitle
        : String(annotation.title || '').trim().slice(0, 80);
      let content = String(annotation.content || '').trim();
      if (!content) {
        content = contextSummary || getDefaultAnnotationContent(annotation.type);
      }
      if (annotation.type === 'quiz' && content && !/[?？]\s*$/.test(content)) {
        content = isNorwegian
          ? `${content.replace(/[.!]$/, '')}?`
          : `${content.replace(/[.!]$/, '')}?`;
      }
      if (hasMobileIssue || content.length > 140) {
        content = shortenTextForMobile(content, 132);
      }

      return normalizeAnnotation({
        ...annotation,
        title,
        content,
        updatedAt: new Date().toISOString(),
      });
    });

    let sourceLabel = tt('regler', 'rules');
    try {
      const response = (await apiRequest('/api/academy/annotation/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'qwen',
          intent: workflowIntent,
          scope: effectiveScope,
          courseId: String(activeCourse?.id || ''),
          courseTitle: String(activeCourse?.title || '').trim(),
          lessonId: effectiveScope === 'skill' ? String(selectedSkill?.id || '') : '',
          lessonTitle: String(selectedSkill?.title || '').trim(),
          videoUrl: effectiveVideoUrl,
          videoDuration,
          useNorwegian: isNorwegian,
          summary: [
            contextSummary,
            ...fixed.map((annotation, index) =>
              `${index + 1}. [${annotation.type}] ${annotation.title}: ${annotation.content}`,
            ),
          ]
            .filter((entry) => String(entry || '').trim().length > 0)
            .join('\n')
            .slice(0, 8000),
          maxItems: Math.min(10, Math.max(3, fixed.length)),
        }),
      })) as unknown;

      const payload =
        response && typeof response === 'object' ? (response as Record<string, unknown>) : {};
      const data =
        payload.data && typeof payload.data === 'object'
          ? (payload.data as Record<string, unknown>)
          : {};
      const meta =
        data.meta && typeof data.meta === 'object'
          ? (data.meta as Record<string, unknown>)
          : {};
      const rawRecommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
      const providerUsed = String(meta.provider || '').trim().toLowerCase();
      const modelUsed = String(meta.model || '').trim();
      if (providerUsed === 'qwen') {
        sourceLabel = modelUsed ? `Qwen (${modelUsed})` : 'Qwen';
      }

      if (rawRecommendations.length > 0) {
        const normalizedRecommendations = rawRecommendations
          .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null))
          .filter((entry): entry is Record<string, unknown> => Boolean(entry));

        const usedRecommendationIndexes = new Set<number>();
        fixed = fixed.map((annotation) => {
          let bestIndex = -1;
          let bestScore = Number.POSITIVE_INFINITY;

          normalizedRecommendations.forEach((candidate, index) => {
            if (usedRecommendationIndexes.has(index)) return;
            const candidateType = String(candidate.type || '').trim().toLowerCase();
            const candidateStart = Number(candidate.startTime);
            const typePenalty = candidateType === annotation.type ? 0 : 8;
            const timePenalty = Number.isFinite(candidateStart)
              ? Math.abs(candidateStart - annotation.startTime)
              : 30;
            const score = typePenalty + timePenalty;
            if (score < bestScore) {
              bestScore = score;
              bestIndex = index;
            }
          });

          if (bestIndex < 0) return annotation;
          usedRecommendationIndexes.add(bestIndex);
          const best = normalizedRecommendations[bestIndex];
          const titleCandidate = String(best.title || '').trim();
          const contentCandidate = String(best.content || '').trim();
          const shouldReplaceTitle = isGenericAnnotationTitle(annotation.title);
          const shouldReplaceContent =
            mobileTextIssueByAnnotation.has(annotation.id) ||
            String(annotation.content || '').trim().length < 20 ||
            String(annotation.content || '').trim().length > 140;

          return normalizeAnnotation({
            ...annotation,
            title: shouldReplaceTitle && titleCandidate ? titleCandidate.slice(0, 80) : annotation.title,
            content:
              shouldReplaceContent && contentCandidate
                ? shortenTextForMobile(contentCandidate, 132)
                : annotation.content,
            updatedAt: new Date().toISOString(),
          });
        });
      }
    } catch {
      sourceLabel = tt('regler', 'rules');
    }

    commitAnnotations(fixed, { historyLabel: tt('Auto-fiks annoteringer', 'Auto-fix annotations') });
    setDraftAnnotation(null);
    setSaveMessage(
      tt(
        `Auto-fiks fullført (${sourceLabel}): bounds, varighet, overlap og innhold ble forbedret.`,
        `Auto-fix complete (${sourceLabel}): bounds, duration, overlap, and content were improved.`,
      ),
    );
  }, [
    activeCourse?.description,
    activeCourse?.id,
    activeCourse?.title,
    annotationTypeLabel,
    commitAnnotations,
    effectiveScope,
    effectiveVideoUrl,
    isNorwegian,
    previewAnnotations,
    selectedSkill?.description,
    selectedSkill?.id,
    selectedSkill?.title,
    tt,
    validationIssues,
    videoDuration,
    workflowIntent,
  ]);

  const executeAnnotationAction = useCallback(
    (annotation: VideoAnnotation) => {
      const action = annotation.action || getDefaultAnnotationAction(annotation.type);
      if (action?.type === 'showQuiz' || annotation.type === 'quiz') {
        setStudentPreviewAction({
          annotationId: annotation.id,
          title: tt('Quiz vises til student', 'Quiz shown to learner'),
          detail: String(annotation.title || tt('Kunnskapssjekk', 'Knowledge check')),
        });
        return;
      }

      if (action?.type === 'openLink') {
        setStudentPreviewAction({
          annotationId: annotation.id,
          title: tt('Lenke åpnes i ny fane', 'Link opens in a new tab'),
          detail: String(action.target || annotation.title || ''),
        });
        return;
      }

      if (action?.type === 'navigate') {
        setStudentPreviewAction({
          annotationId: annotation.id,
          title: tt('Navigasjon i kursflyt', 'Navigation in course flow'),
          detail: String(action.target || annotation.title || ''),
        });
        return;
      }

      if (action?.type === 'playVideo') {
        const target = String(action.target || '').trim();
        const sourceVideoId = String(action.data?.videoResourceId || '').trim();
        const linkedVideo = sourceVideoId
          ? attachmentResources.find((resource) => String(resource.id || '') === sourceVideoId)
          : attachmentResources.find(
              (resource) => isVideoResource(resource) && String(resource.url || '').trim() === target,
            );
        if (!target && !linkedVideo) {
          setStudentPreviewAction({
            annotationId: annotation.id,
            title: tt('Ingen videokilde koblet', 'No video source linked'),
            detail: tt(
              'Velg videoressurs eller legg inn video-URL i annoteringen.',
              'Choose a video resource or add a video URL in the annotation.',
            ),
          });
          return;
        }
        setStudentPreviewAction({
          annotationId: annotation.id,
          title: tt('Videoinnhold avspilles', 'Video content is played'),
          detail: String(linkedVideo?.title || target || annotation.title || ''),
        });
        return;
      }

      if (action?.type === 'showContent' || annotation.type === 'image') {
        const attachmentIds = Array.isArray(action?.data?.attachmentIds)
          ? action?.data?.attachmentIds.filter(
              (value): value is string => typeof value === 'string' && value.length > 0,
            )
          : [];
        if (attachmentIds.length > 0) {
          const linkedResource = attachmentResources.find(
            (resource) => attachmentIds.includes(String(resource.id || '')),
          );
          setStudentPreviewAction({
            annotationId: annotation.id,
            title: tt('Vedlegg vises i studentvisning', 'Attachment shown in learner view'),
            detail: String(linkedResource?.title || linkedResource?.url || annotation.title || ''),
          });
          return;
        }
        setStudentPreviewAction({
          annotationId: annotation.id,
          title: tt('Ingen vedlegg koblet', 'No attachment linked'),
          detail: tt(
            'Annoteringen har ingen vedlegg ennå.',
            'This annotation has no attachment yet.',
          ),
        });
        return;
      }

      setStudentPreviewAction({
        annotationId: annotation.id,
        title: tt('Annotering vises i player', 'Annotation shown in player'),
        detail: String(annotation.title || ''),
      });
    },
    [
      attachmentResources,
      setStudentPreviewAction,
      tt,
    ],
  );

  const saveDraft = useCallback(() => {
    if (!draftAnnotation) return;

    const now = new Date().toISOString();
    const nextAnnotation: VideoAnnotation = {
      ...draftAnnotation,
      updatedAt: now,
      startTime: clamp(draftAnnotation.startTime, 0, videoDuration || 0),
      endTime:
        draftAnnotation.endTime === undefined || draftAnnotation.endTime === null || draftAnnotation.endTime === 0
          ? undefined
          : clamp(Math.max(draftAnnotation.endTime, draftAnnotation.startTime), 0, videoDuration || 0),
      size: {
        width: clamp(draftAnnotation.size.width, 1, 100),
        height: clamp(draftAnnotation.size.height, 1, 100),
      },
      position: {
        x: clamp(draftAnnotation.position.x, 0, 100),
        y: clamp(draftAnnotation.position.y, 0, 100),
      },
    };

    const exists = annotationItems.some((annotation) => annotation.id === nextAnnotation.id);
    const nextAnnotations = exists
      ? annotationItems.map((annotation) => (annotation.id === nextAnnotation.id ? nextAnnotation : annotation))
      : [...annotationItems, nextAnnotation];

    commitAnnotations(nextAnnotations, {
      historyLabel: exists
        ? tt('Oppdater annotering', 'Update annotation')
        : tt('Ny annotering', 'New annotation'),
    });
    setSelectedAnnotationId(nextAnnotation.id);
    setDraftAnnotation(nextAnnotation);
    setSaveMessage(tt('Annotasjon oppdatert.', 'Annotation updated.'));

    analytics.trackEvent('annotation_saved', {
      annotationId: nextAnnotation.id,
      type: nextAnnotation.type,
      annotationTime: nextAnnotation.startTime,
      timestamp: Date.now(),
    });
  }, [annotationItems, analytics, commitAnnotations, draftAnnotation, tt, videoDuration]);

  const deleteAnnotation = useCallback(
    (annotationId: string) => {
      const nextAnnotations = annotationItems.filter((annotation) => annotation.id !== annotationId);
      commitAnnotations(nextAnnotations, { historyLabel: tt('Slett annotering', 'Delete annotation') });
      if (selectedAnnotationId === annotationId) {
        setSelectedAnnotationId('');
        setDraftAnnotation(null);
      }

      analytics.trackEvent('annotation_deleted', {
        annotationId,
        timestamp: Date.now(),
      });
    },
    [annotationItems, analytics, commitAnnotations, selectedAnnotationId, tt],
  );

  const openToolMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setToolMenuAnchorEl(event.currentTarget);
  }, []);

  const closeToolMenu = useCallback(() => {
    setToolMenuAnchorEl(null);
  }, []);

  const toggleTimelineSnapFromMenu = useCallback(() => {
    setTimelineSnap((prev) => !prev);
    closeToolMenu();
  }, [closeToolMenu]);

  const toggleSafeAreaFromMenu = useCallback(() => {
    setSafeAreaSnap((prev) => !prev);
    closeToolMenu();
  }, [closeToolMenu]);

  const handleEditorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditableElement(event.target)) return;

      const commandKey = event.metaKey || event.ctrlKey;
      if (commandKey && !event.altKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redoAnnotations();
        } else {
          undoAnnotations();
        }
        return;
      }

      if (commandKey && !event.altKey && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redoAnnotations();
        return;
      }

      if (!commandKey && !event.altKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setInteractionMode('draw');
        return;
      }

      if (!commandKey && !event.altKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        setInteractionMode('select');
        return;
      }

      if (!selectedAnnotationId) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const moveStep = event.shiftKey ? 5 : 1;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeSelectedAnnotation(-1, 0, moveStep);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeSelectedAnnotation(1, 0, moveStep);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        nudgeSelectedAnnotation(0, -1, moveStep);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        nudgeSelectedAnnotation(0, 1, moveStep);
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        deleteAnnotation(selectedAnnotationId);
      }
    },
    [
      deleteAnnotation,
      nudgeSelectedAnnotation,
      redoAnnotations,
      selectedAnnotationId,
      setInteractionMode,
      undoAnnotations,
    ],
  );

  const toggleDraftAttachment = useCallback(
    (resourceId: string) => {
      const targetAnnotationId = draftAnnotation?.id || selectedAnnotation?.id || selectedAnnotationId;
      if (!targetAnnotationId) return;

      const sourceAnnotation =
        annotationItems.find((annotation) => annotation.id === targetAnnotationId) ||
        draftAnnotation ||
        selectedAnnotation;
      if (!sourceAnnotation) return;

      const currentIds = Array.isArray(sourceAnnotation.action?.data?.attachmentIds)
        ? sourceAnnotation.action?.data?.attachmentIds.filter(
            (value): value is string => typeof value === 'string' && value.length > 0,
          )
        : [];
      const nextIds = currentIds.includes(resourceId)
        ? currentIds.filter((id) => id !== resourceId)
        : [...currentIds, resourceId];

      const nextUpdatedAnnotation: VideoAnnotation = {
        ...sourceAnnotation,
        action: {
          type: sourceAnnotation.action?.type || 'showContent',
          target: sourceAnnotation.action?.target,
          data: {
            ...(sourceAnnotation.action?.data || {}),
            attachmentIds: nextIds,
          },
        },
        updatedAt: new Date().toISOString(),
      };
      const hasCommittedTarget = annotationItems.some(
        (annotation) => annotation.id === targetAnnotationId,
      );
      const nextAnnotations = hasCommittedTarget
        ? annotationItems.map((annotation) =>
            annotation.id === targetAnnotationId ? nextUpdatedAnnotation : annotation,
          )
        : [...annotationItems, nextUpdatedAnnotation];
      commitAnnotations(nextAnnotations, {
        historyLabel: tt('Oppdater vedlegg', 'Update attachments'),
      });

      setDraftAnnotation((prev) => {
        const nextDraft =
          nextAnnotations.find((annotation) => annotation.id === targetAnnotationId) || null;
        if (!prev) return nextDraft;
        return {
          ...prev,
          ...nextDraft,
        };
      });
    },
    [
      annotationItems,
      commitAnnotations,
      draftAnnotation,
      selectedAnnotation,
      selectedAnnotationId,
      tt,
    ],
  );

  const saveAnnotationSetup = useCallback(async (publish: boolean) => {
    let workingAnnotations = annotationItems;
    let nextDraftAfterSave: VideoAnnotation | null = draftAnnotation;
    if (draftAnnotation) {
      const normalizedDraft = normalizeAnnotation({
        ...draftAnnotation,
        startTime: clamp(draftAnnotation.startTime, 0, videoDuration || 0),
        endTime:
          draftAnnotation.endTime === undefined || draftAnnotation.endTime === null || draftAnnotation.endTime === 0
            ? undefined
            : clamp(Math.max(draftAnnotation.endTime, draftAnnotation.startTime), 0, videoDuration || 0),
        size: {
          width: clamp(draftAnnotation.size.width, 1, 100),
          height: clamp(draftAnnotation.size.height, 1, 100),
        },
        position: {
          x: clamp(draftAnnotation.position.x, 0, 100),
          y: clamp(draftAnnotation.position.y, 0, 100),
        },
      });
      const exists = annotationItems.some((annotation) => annotation.id === normalizedDraft.id);
      workingAnnotations = exists
        ? annotationItems.map((annotation) =>
            annotation.id === normalizedDraft.id ? normalizedDraft : annotation,
          )
        : [...annotationItems, normalizedDraft];
      nextDraftAfterSave = normalizedDraft;
    }
    const normalizedAnnotations = workingAnnotations.map(normalizeAnnotation);
    const qualityIssues = validateAnnotations(normalizedAnnotations, videoDuration, tt);
    const blockingIssues = qualityIssues.filter((issue) => issue.severity === 'error');
    if (publish && blockingIssues.length > 0) {
      setSaveMessage(
        tt(
          `Kan ikke publisere enda. ${blockingIssues[0]?.message || ''}`,
          `Cannot publish yet. ${blockingIssues[0]?.message || ''}`,
        ),
      );
      setRightTab('markers');
      return;
    }
    commitAnnotations(normalizedAnnotations, {
      historyLabel: tt('Lagre alle annoteringer', 'Save all annotations'),
    });
    if (nextDraftAfterSave) {
      const refreshedDraft =
        normalizedAnnotations.find((annotation) => annotation.id === nextDraftAfterSave?.id) || null;
      setDraftAnnotation(refreshedDraft);
      if (refreshedDraft) {
        setSelectedAnnotationId(refreshedDraft.id);
      }
    }
    const now = new Date().toISOString();
    const scope = effectiveScope;
    const skill = selectedSkill;
    const course = activeCourse;
    let persistedPublishedAt = '';

    try {
      const existing = course
        ? state.courses.find((entry) => String(entry.id) === String(course.id))
        : undefined;

      if (existing) {
        const annotationResources = normalizedAnnotations.map((annotation) => {
          const safeEnd = annotation.endTime ?? Math.min(videoDuration, annotation.startTime + 6);
          return {
            id:
              scope === 'skill'
                ? `${ANNOTATION_RESOURCE_SKILL_PREFIX}${String(skill?.id || 'unknown')}-${annotation.id}`
                : `${ANNOTATION_RESOURCE_COURSE_PREFIX}${annotation.id}`,
            type: 'link' as const,
            title:
              scope === 'skill'
                ? `[Annotation][Skill] ${annotation.title}`
                : `[Annotation][Course] ${annotation.title}`,
            url:
              annotation.action?.type === 'openLink' && annotation.action.target
                ? annotation.action.target
                : `${effectiveVideoUrl}#t=${Math.round(annotation.startTime)}`,
            description: buildAnnotationResourceDescription(annotation, safeEnd),
          };
        });

        if (scope === 'skill' && skill) {
          const lessonResources = Array.isArray(skill.resources) ? skill.resources : [];
          const skillPrefix = `${ANNOTATION_RESOURCE_SKILL_PREFIX}${String(skill.id)}-`;
          await updateLesson({
            ...skill,
            updatedAt: now,
            resources: [
              ...lessonResources.filter((resource) => !String(resource.id || '').startsWith(skillPrefix)),
              ...annotationResources,
            ],
          });
        } else {
          const courseResources = Array.isArray(existing.resources) ? existing.resources : [];
          await updateCourse({
            ...existing,
            isPublished: publish ? true : existing.isPublished,
            tags: Array.from(new Set([...(existing.tags || []), 'annotations'])),
            updatedAt: now,
            resources: [
              ...courseResources.filter((resource) => {
                const resourceId = String(resource.id || '');
                return (
                  !resourceId.startsWith(ANNOTATION_RESOURCE_COURSE_PREFIX) &&
                  !(resourceId.startsWith(ANNOTATION_RESOURCE_ID_PREFIX) && !resourceId.startsWith(ANNOTATION_RESOURCE_SKILL_PREFIX))
                );
              }),
              ...annotationResources,
            ],
          });
        }
      }

      if (course?.id) {
        const key = getScopeStorageKey(
          String(course.id),
          scope,
          scope === 'skill' ? String(skill?.id || '') : undefined,
        );
        const store = readAnnotationStore();
        const previousEntry = store[key];
        persistedPublishedAt = String(previousEntry?.publishedAt || '');
        store[key] = {
          items: normalizedAnnotations,
          duration: videoDuration,
          updatedAt: now,
          publishedAt: publish ? now : persistedPublishedAt || undefined,
        };
        writeAnnotationStore(store);
        void writeAnnotationStoreToDb(store);
      }

      onSave?.(normalizedAnnotations);
      setAutoSaveState('saved');
      setLastSavedAt(now);
      if (publish) {
        setLastPublishedAt(now);
        setHasSavedChangesSincePublish(false);
      } else {
        setLastPublishedAt(persistedPublishedAt);
        setHasSavedChangesSincePublish(Boolean(persistedPublishedAt));
      }
      setSaveMessage(
        publish
          ? tt('Annoteringer publisert.', 'Annotations published.')
          : qualityIssues.length > 0
          ? tt(
              `Lagret med ${qualityIssues.length} kvalitetsvarsler. Kjør Auto-fiks for forslag.`,
              `Saved with ${qualityIssues.length} quality warnings. Run Auto-fix for suggestions.`,
            )
          : tt('Alle annoteringer lagret.', 'All annotations saved.'),
      );

      analytics.trackEvent('video_annotations_saved', {
        annotationCount: normalizedAnnotations.length,
        issueCount: qualityIssues.length,
        courseId: course?.id || null,
        scope,
        lessonId: scope === 'skill' ? skill?.id || null : null,
        instructorId: effectiveInstructor?.id || null,
        publish,
        timestamp: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : publish
          ? tt('Kunne ikke publisere annoteringer.', 'Could not publish annotations.')
          : tt('Kunne ikke lagre annoteringer.', 'Could not save annotations.');
      setSaveMessage(message);
    }
  }, [
    activeCourse,
    annotationItems,
    analytics,
    commitAnnotations,
    effectiveScope,
    effectiveVideoUrl,
    onSave,
    draftAnnotation,
    effectiveInstructor?.id,
    selectedSkill,
    state.courses,
    tt,
    updateCourse,
    updateLesson,
    videoDuration,
  ]);

  const applyCurrentAnnotationsToAllSkills = useCallback(async () => {
    if (skillOptions.length === 0 || !activeCourse?.id) return;

    const workingAnnotations =
      draftAnnotation && draftAnnotation.id
        ? (() => {
            const normalizedDraft = normalizeAnnotation(draftAnnotation);
            const exists = annotationItems.some((annotation) => annotation.id === normalizedDraft.id);
            return exists
              ? annotationItems.map((annotation) =>
                  annotation.id === normalizedDraft.id ? normalizedDraft : annotation,
                )
              : [...annotationItems, normalizedDraft];
          })()
        : annotationItems;

    const normalizedAnnotations = workingAnnotations.map(normalizeAnnotation);
    const now = new Date().toISOString();

    try {
      for (const lesson of skillOptions) {
        const lessonResources = Array.isArray(lesson.resources) ? lesson.resources : [];
        const skillPrefix = `${ANNOTATION_RESOURCE_SKILL_PREFIX}${String(lesson.id)}-`;
        const annotationResources = normalizedAnnotations.map((annotation) => {
          const safeEnd = annotation.endTime ?? Math.min(videoDuration, annotation.startTime + 6);
          return {
            id: `${ANNOTATION_RESOURCE_SKILL_PREFIX}${String(lesson.id)}-${annotation.id}`,
            type: 'link' as const,
            title: `[Annotation][Skill] ${annotation.title}`,
            url:
              annotation.action?.type === 'openLink' && annotation.action.target
                ? annotation.action.target
                : `${effectiveVideoUrl}#t=${Math.round(annotation.startTime)}`,
            description: buildAnnotationResourceDescription(annotation, safeEnd),
          };
        });

        await updateLesson({
          ...lesson,
          updatedAt: now,
          resources: [
            ...lessonResources.filter((resource) => !String(resource.id || '').startsWith(skillPrefix)),
            ...annotationResources,
          ],
        });
      }

      if (activeCourse?.id) {
        const store = readAnnotationStore();
        skillOptions.forEach((lesson) => {
          const key = getScopeStorageKey(String(activeCourse.id), 'skill', String(lesson.id));
          const previousEntry = store[key];
          store[key] = {
            items: normalizedAnnotations,
            duration: videoDuration,
            updatedAt: now,
            publishedAt: previousEntry?.publishedAt,
          };
        });
        writeAnnotationStore(store);
        void writeAnnotationStoreToDb(store);
      }

      setSaveMessage(
        tt(
          'Annoteringene er kopiert til alle ferdigheter i kompetansen.',
          'Annotations were copied to all skills in this competency.',
        ),
      );
      analytics.trackEvent('video_annotations_apply_all_skills', {
        annotationCount: normalizedAnnotations.length,
        courseId: activeCourse.id,
        skills: skillOptions.length,
        timestamp: Date.now(),
      });
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : tt('Kunne ikke kopiere annoteringer til alle ferdigheter.', 'Could not copy annotations to all skills.'),
      );
    }
  }, [
    activeCourse?.id,
    analytics,
    annotationItems,
    draftAnnotation,
    effectiveVideoUrl,
    skillOptions,
    tt,
    updateLesson,
    videoDuration,
  ]);

  const getCanvasPointer = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return { x: 0, y: 0 };
    }
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }, []);

  const findAnnotationAtPointer = useCallback(
    (pointer: { x: number; y: number }) => {
      for (let index = previewAnnotations.length - 1; index >= 0; index -= 1) {
        const annotation = previewAnnotations[index];
        if (!annotation.isVisible) continue;
        if (previewMode) {
          const safeEnd = resolveAnnotationEndTime(annotation, videoDuration);
          if (currentTime < annotation.startTime || currentTime > safeEnd) continue;
        }
        const minX = annotation.position.x;
        const minY = annotation.position.y;
        const maxX = annotation.position.x + annotation.size.width;
        const maxY = annotation.position.y + annotation.size.height;
        const inside = pointer.x >= minX && pointer.x <= maxX && pointer.y >= minY && pointer.y <= maxY;
        if (inside) return annotation;
      }
      return null;
    },
    [currentTime, previewAnnotations, previewMode, videoDuration],
  );

  const handleCanvasMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const pointer = getCanvasPointer(event);
      if (previewMode) {
        setHoverAnnotationId('');
        const hit = findAnnotationAtPointer(pointer);
        if (hit && hit.isClickable) {
          executeAnnotationAction(hit);
        }
        return;
      }
      const hit = findAnnotationAtPointer(pointer);
      if (hit) {
        setHoverAnnotationId(hit.id);
        prepareDraft(hit);
        canvasDragOriginRef.current = annotationItems.map(normalizeAnnotation);
        setDraggingAnnotationId(hit.id);
        setDragOffset({
          x: pointer.x - hit.position.x,
          y: pointer.y - hit.position.y,
        });
        return;
      }

      if (interactionMode === 'select') {
        setSelectedAnnotationId('');
        setDraftAnnotation(null);
        setHoverAnnotationId('');
        setDraggingAnnotationId('');
        setDragOffset(null);
        canvasDragOriginRef.current = null;
        return;
      }

      setDrawStart(pointer);
      setDrawEnd(pointer);
      setIsDrawing(true);
    },
    [
      findAnnotationAtPointer,
      getCanvasPointer,
      interactionMode,
      annotationItems,
      setHoverAnnotationId,
      prepareDraft,
      previewMode,
      executeAnnotationAction,
    ],
  );

  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const pointer = getCanvasPointer(event);
      if (previewMode) {
        setHoverAnnotationId('');
        return;
      }

      if (draggingAnnotationId) {
        setHoverAnnotationId(draggingAnnotationId);
        const moved = annotationItems.map((annotation) => {
          if (annotation.id !== draggingAnnotationId) return annotation;
          const offsetX = dragOffset?.x ?? 0;
          const offsetY = dragOffset?.y ?? 0;
          const safeMin = safeAreaSnap ? SAFE_AREA_MARGIN : 0;
          const safeMaxX = safeAreaSnap ? 100 - SAFE_AREA_MARGIN : 100;
          const safeMaxY = safeAreaSnap ? 100 - SAFE_AREA_MARGIN : 100;
          const nextX = clamp(pointer.x - offsetX, safeMin, Math.max(safeMin, safeMaxX - annotation.size.width));
          const nextY = clamp(pointer.y - offsetY, safeMin, Math.max(safeMin, safeMaxY - annotation.size.height));
          return {
            ...annotation,
            position: {
              x: nextX,
              y: nextY,
            },
            updatedAt: new Date().toISOString(),
          };
        });
        commitAnnotations(moved, { recordHistory: false });
        setDraftAnnotation((prev) => {
          if (!prev || prev.id !== draggingAnnotationId) return prev;
          const offsetX = dragOffset?.x ?? 0;
          const offsetY = dragOffset?.y ?? 0;
          const safeMin = safeAreaSnap ? SAFE_AREA_MARGIN : 0;
          const safeMaxX = safeAreaSnap ? 100 - SAFE_AREA_MARGIN : 100;
          const safeMaxY = safeAreaSnap ? 100 - SAFE_AREA_MARGIN : 100;
          return {
            ...prev,
            position: {
              x: clamp(pointer.x - offsetX, safeMin, Math.max(safeMin, safeMaxX - prev.size.width)),
              y: clamp(pointer.y - offsetY, safeMin, Math.max(safeMin, safeMaxY - prev.size.height)),
            },
            updatedAt: new Date().toISOString(),
          };
        });
        return;
      }

      if (!isDrawing) {
        const hit = findAnnotationAtPointer(pointer);
        setHoverAnnotationId(hit?.id || '');
      } else {
        setHoverAnnotationId('');
      }

      if (!isDrawing) return;
      setDrawEnd(pointer);
    },
    [
      annotationItems,
      commitAnnotations,
      dragOffset,
      draggingAnnotationId,
      findAnnotationAtPointer,
      getCanvasPointer,
      interactionMode,
      isDrawing,
      previewMode,
      safeAreaSnap,
      setHoverAnnotationId,
    ],
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (draggingAnnotationId) {
      const origin = canvasDragOriginRef.current;
      if (origin) {
        const normalizedOrigin = origin.map(normalizeAnnotation);
        const normalizedCurrent = annotationItems.map(normalizeAnnotation);
        if (JSON.stringify(normalizedOrigin) !== JSON.stringify(normalizedCurrent)) {
          pushUndoSnapshot(normalizedOrigin, tt('Flytt annotering', 'Move annotation'));
        }
      }
      canvasDragOriginRef.current = null;
      setDraggingAnnotationId('');
      setDragOffset(null);
      return;
    }

    if (!isDrawing || !drawStart || !drawEnd) return;

    const left = Math.min(drawStart.x, drawEnd.x);
    const top = Math.min(drawStart.y, drawEnd.y);
    const width = clamp(Math.abs(drawEnd.x - drawStart.x), 6, 95);
    const height = clamp(Math.abs(drawEnd.y - drawStart.y), 6, 95);

    const created = buildAnnotation(activeTool, currentTime, { x: left, y: top }, { width, height });
    prepareDraft(created);

    setIsDrawing(false);
    setDrawStart(null);
    setDrawEnd(null);
  }, [
    activeTool,
    annotationItems,
    currentTime,
    draggingAnnotationId,
    drawEnd,
    drawStart,
    isDrawing,
    prepareDraft,
    pushUndoSnapshot,
    tt,
  ]);

  const handleCanvasMouseLeave = useCallback(() => {
    if (draggingAnnotationId) return;
    setHoverAnnotationId('');
  }, [draggingAnnotationId]);

  return (
    <Box
      ref={editorRootRef}
      tabIndex={0}
      onKeyDown={handleEditorKeyDown}
      onMouseDownCapture={(event) => {
        if (isEditableElement(event.target)) return;
        editorRootRef.current?.focus();
      }}
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
          background:
            'radial-gradient(circle at 74% 12%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, minHeight: '100vh', position: 'relative', zIndex: 1, width: academyShellMaxWidth, mx: 'auto' }}>
        <AcademyLeftSidebar
          activeNav={leftNav}
          onNavigate={(navId, route) => {
            setLeftNav(navId);
            setLocationWithContext(route, false);
          }}
          onCreateCourse={() => {
            setLeftNav('curriculum');
            setLocationWithContext('/academy/curriculum?createCompetency=1', false);
          }}
          tt={tt}
          navLabel={navLabel}
          activeCourseId={resolvedCourseId || selectedCourseValue || null}
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
            </Stack>

            <Stack direction="row" spacing={1.2} alignItems="center">
              <AcademyLocaleSwitcher />
              <IconButton
                size="small"
                onClick={() => setLocationWithContext('/academy/settings?tab=notifications', false)}
                aria-label={tt('Varsler', 'Notifications')}
                sx={{ color: 'rgba(237,240,247,0.75)' }}
              >
                <NotificationsNone fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocationWithContext('/academy/settings?tab=messages', false)}
                aria-label={tt('Meldinger', 'Messages')}
                sx={{ color: 'rgba(237,240,247,0.75)' }}
              >
                <MailOutline fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocationWithContext('/academy/settings?tab=profile', false)}
                aria-label={tt('Profil', 'Profile')}
                sx={{ p: 0 }}
              >
                <Avatar sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111' }}>
                  {String(activeCourse?.instructor?.name || 'N').charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) var(--academy-right-panel-width, 390px)' },
              gap: 2,
              px: 2,
              py: 2,
            }}
          >
            <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.4 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', md: 'center' }}
              >
                <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontSize: 'clamp(1.65rem, 1.3rem + 1.1vw, 2.05rem)', fontWeight: 700, letterSpacing: '0.015em', lineHeight: 1.1 }}>
                    {tt('Annoteringsstudio', 'Annotation Studio')}
                  </Typography>
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
                      ...neutralOutlinedButtonSx,
                      color: simpleMode ? '#edf0f7' : '#f8d675',
                      borderColor: simpleMode ? 'rgba(255,255,255,0.2)' : 'rgba(248,179,33,0.35)',
                      bgcolor: simpleMode ? 'rgba(255,255,255,0.02)' : 'rgba(248,179,33,0.1)',
                    }}
                  >
                    {simpleMode
                      ? tt('Pro-modus', 'Pro mode')
                      : tt('Tilbake til enkel', 'Back to simple')}
                  </Button>
                  <Tooltip title={tt('Angre (Cmd/Ctrl+Z)', 'Undo (Cmd/Ctrl+Z)')}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={undoAnnotations}
                        sx={neutralIconButtonSx}
                      >
                        <Undo fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={tt('Gjør om (Cmd/Ctrl+Shift+Z)', 'Redo (Cmd/Ctrl+Shift+Z)')}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={redoAnnotations}
                        sx={neutralIconButtonSx}
                      >
                        <Redo fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Button
                    variant="outlined"
                    startIcon={<AutoFixHigh />}
                    onClick={runAutoFix}
                    disabled={validationIssues.length === 0}
                    sx={warningOutlinedButtonSx}
                  >
                    {tt('Auto-fiks', 'Auto-fix')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={previewMode ? <Visibility /> : <VisibilityOff />}
                    onClick={toggleStudentPreview}
                    sx={{
                      ...neutralOutlinedButtonSx,
                      borderColor: previewMode ? 'rgba(248,179,33,0.45)' : 'rgba(255,255,255,0.2)',
                      color: previewMode ? '#f8d675' : '#edf0f7',
                      bgcolor: previewMode ? 'rgba(248,179,33,0.12)' : 'transparent',
                    }}
                  >
                    {previewMode
                      ? tt('Forhåndsvisning på', 'Preview on')
                      : tt('Forhåndsvis (student)', 'Preview (learner)')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Save />}
                    onClick={() => {
                      void saveAnnotationSetup(false);
                    }}
                    sx={saveButtonSx}
                  >
                    {tt('Lagre', 'Save')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Publish />}
                    onClick={() => {
                      void saveAnnotationSetup(true);
                    }}
                    disabled={publishBlockingIssues.length > 0}
                    sx={publishButtonSx}
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

              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', md: 'center' }}
                sx={{ ...panelSectionSx, px: 1, py: 0.9 }}
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
                    const nextCourseId = String(event.target.value || '').trim();
                    setSelectedCourseId(nextCourseId);
                    const currentPath = String(location || '/academy/annotation-editor').split('?')[0] || '/academy/annotation-editor';
                    const currentQuery = String(location || '').split('?')[1] || '';
                    const params = new URLSearchParams(currentQuery);
                    if (nextCourseId) {
                      params.set('courseId', nextCourseId);
                    } else {
                      params.delete('courseId');
                    }
                    params.delete('course_id');
                    if (effectiveScope === 'skill' && selectedSkill?.id) {
                      params.set('lessonId', String(selectedSkill.id));
                    }
                    const suffix = params.toString();
                    setLocation(suffix ? `${currentPath}?${suffix}` : currentPath);
                  }}
                  sx={{
                    minWidth: { xs: '100%', md: 250 },
                    color: '#edf0f7',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.14)' },
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
                  value={annotationScope}
                  onChange={(event) => {
                    const nextScope = event.target.value as AnnotationScope;
                    setAnnotationScope(nextScope);
                    if (nextScope === 'course') {
                      setSelectedSkillId('');
                    } else if (skillOptions.length > 0 && !selectedSkillId) {
                      setSelectedSkillId(String(skillOptions[0].id));
                    }
                  }}
                  sx={{
                    minWidth: { xs: '100%', md: 150 },
                    color: '#edf0f7',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.14)' },
                  }}
                >
                  <MenuItem value="course">{tt('Ferdighet', 'Skill')}</MenuItem>
                  <MenuItem value="skill" disabled={skillOptions.length === 0}>
                    {tt('Ferdighet', 'Skill')}
                  </MenuItem>
                </Select>
                {annotationScope === 'skill' && skillOptions.length > 0 && (
                  <Select
                    size="small"
                    value={selectedSkill?.id || selectedSkillId || String(skillOptions[0].id)}
                    onChange={(event) => setSelectedSkillId(String(event.target.value))}
                    sx={{
                      minWidth: { xs: '100%', md: 210 },
                      color: '#edf0f7',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.14)' },
                    }}
                  >
                    {skillOptions.map((skill) => (
                      <MenuItem key={skill.id} value={skill.id}>
                        {skill.title}
                      </MenuItem>
                    ))}
                  </Select>
                )}
                <Chip
                  size="small"
                  avatar={
                    effectiveInstructor?.name ? (
                      <Avatar sx={{ width: 22, height: 22 }}>
                        {effectiveInstructor.name.charAt(0).toUpperCase()}
                      </Avatar>
                    ) : undefined
                  }
                  label={
                    effectiveInstructor?.name
                      ? `${tt('Instruktør', 'Instructor')}: ${effectiveInstructor.name}`
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

              {shouldShowAdvanced ? (
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={0.8}
                  alignItems={{ xs: 'stretch', lg: 'center' }}
                  sx={{ ...panelSectionSx, px: 1, py: 0.85 }}
                >
                  <Stack direction="row" spacing={0.4} sx={toolbarGroupSx}>
                    <Button
                      size="small"
                      startIcon={<OpenWith fontSize="small" />}
                      onClick={() => {
                        setPreviewMode(false);
                        setInteractionMode('select');
                      }}
                      sx={{
                        ...controlButtonSx,
                        minWidth: 0,
                        px: 1,
                        color: interactionMode === 'select' ? '#0f0f0f' : '#edf0f7',
                        bgcolor: interactionMode === 'select' ? '#f8d675' : 'transparent',
                      }}
                    >
                      {tt('Velg', 'Select')}
                    </Button>
                    <Button
                      size="small"
                      startIcon={<CropSquare fontSize="small" />}
                      onClick={() => {
                        setPreviewMode(false);
                        setInteractionMode('draw');
                      }}
                      sx={{
                        ...controlButtonSx,
                        minWidth: 0,
                        px: 1,
                        color: interactionMode === 'draw' ? '#0f0f0f' : '#edf0f7',
                        bgcolor: interactionMode === 'draw' ? '#f8d675' : 'transparent',
                      }}
                    >
                      {tt('Tegn', 'Draw')}
                    </Button>
                  </Stack>

                  <Stack direction="row" spacing={0.4} sx={{ ...toolbarGroupSx, flex: 1, minWidth: 0 }}>
                    {annotationTypes.map((type) => (
                      <Tooltip key={type.value} title={annotationTypeLabel(type.value)}>
                        <Chip
                          label={type.short}
                          onClick={() => {
                            setActiveTool(type.value);
                            if (previewMode) {
                              setPreviewMode(false);
                            }
                            setInteractionMode('draw');
                          }}
                          sx={{
                            minWidth: 34,
                            justifyContent: 'center',
                            color: type.value === activeTool ? '#0f0f0f' : '#edf0f7',
                            bgcolor: type.value === activeTool ? type.color : 'rgba(255,255,255,0.07)',
                            border: `var(--academy-hairline-width, 1px) solid ${alpha(type.color, 0.5)}`,
                            fontWeight: 700,
                            transition: 'all 140ms ease',
                          }}
                        />
                      </Tooltip>
                    ))}
                    <IconButton
                      size="small"
                      onClick={openToolMenu}
                      sx={neutralIconButtonSx}
                    >
                      <MoreHoriz fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ ml: { lg: 'auto' } }}>
                    <Chip
                      size="small"
                      icon={<WarningAmber sx={{ fontSize: 16 }} />}
                      label={tt(`${validationIssues.length} kvalitetssjekker`, `${validationIssues.length} quality checks`)}
                      sx={{
                        bgcolor:
                          validationIssues.length === 0
                            ? 'rgba(126,232,179,0.16)'
                            : 'rgba(248,179,33,0.16)',
                        color:
                          validationIssues.length === 0
                            ? '#9ef1ca'
                            : '#f8d675',
                      }}
                    />
                    {publishBlockingIssues.length > 0 && (
                      <Chip
                        size="small"
                        icon={<WarningAmber sx={{ fontSize: 16 }} />}
                        label={tt(
                          `${publishBlockingIssues.length} publiseringsblokker`,
                          `${publishBlockingIssues.length} publishing blockers`,
                        )}
                        sx={{
                          bgcolor: 'rgba(255,108,108,0.16)',
                          color: '#ffbbbb',
                        }}
                      />
                    )}
                  </Stack>
                </Stack>
              ) : (
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={0.8}
                  alignItems={{ xs: 'stretch', lg: 'center' }}
                  sx={{ ...panelSectionSx, px: 1, py: 0.85 }}
                >
                  <Stack direction="row" spacing={0.4} sx={toolbarGroupSx}>
                    <Button
                      size="small"
                      variant={interactionMode === 'select' ? 'contained' : 'outlined'}
                      startIcon={<OpenWith />}
                      onClick={() => {
                        setPreviewMode(false);
                        setInteractionMode('select');
                      }}
                      sx={{
                        ...neutralOutlinedButtonSx,
                        color: interactionMode === 'select' ? '#0f0f0f' : '#edf0f7',
                        bgcolor: interactionMode === 'select' ? '#f8d675' : 'transparent',
                      }}
                    >
                      {tt('Flytt markører', 'Move markers')}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Add fontSize="small" />}
                      onClick={() => {
                        addAnnotation(activeTool);
                        setInteractionMode('select');
                      }}
                      sx={neutralOutlinedButtonSx}
                    >
                      {tt('Legg til annotering', 'Add annotation')}
                    </Button>
                    <IconButton
                      size="small"
                      onClick={openToolMenu}
                      sx={neutralIconButtonSx}
                    >
                      <MoreHoriz fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ ml: { lg: 'auto' } }}>
                    <Chip
                      size="small"
                      icon={<WarningAmber sx={{ fontSize: 16 }} />}
                      label={tt(`${validationIssues.length} kvalitetssjekker`, `${validationIssues.length} quality checks`)}
                      sx={{
                        bgcolor:
                          validationIssues.length === 0
                            ? 'rgba(126,232,179,0.16)'
                            : 'rgba(248,179,33,0.16)',
                        color:
                          validationIssues.length === 0
                            ? '#9ef1ca'
                            : '#f8d675',
                      }}
                    />
                    {publishBlockingIssues.length > 0 && (
                      <Chip
                        size="small"
                        icon={<WarningAmber sx={{ fontSize: 16 }} />}
                        label={tt(
                          `${publishBlockingIssues.length} publiseringsblokker`,
                          `${publishBlockingIssues.length} publishing blockers`,
                        )}
                        sx={{
                          bgcolor: 'rgba(255,108,108,0.16)',
                          color: '#ffbbbb',
                        }}
                      />
                    )}
                  </Stack>
                </Stack>
              )}

              <Menu
                anchorEl={toolMenuAnchorEl}
                open={toolMenuOpen}
                onClose={closeToolMenu}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                PaperProps={{
                  sx: {
                    bgcolor: 'rgba(10,14,22,0.96)',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(8px)',
                    minWidth: 240,
                  },
                }}
              >
                <MenuItem onClick={toggleTimelineSnapFromMenu}>
                  {timelineSnap ? tt('Snap: På', 'Snap: On') : tt('Snap: Av', 'Snap: Off')}
                </MenuItem>
                <MenuItem onClick={toggleSafeAreaFromMenu}>
                  {safeAreaSnap ? tt('Safe area: På', 'Safe area: On') : tt('Safe area: Av', 'Safe area: Off')}
                </MenuItem>
                {effectiveScope === 'skill' && skillOptions.length > 1 && (
                  <MenuItem
                    onClick={() => {
                      closeToolMenu();
                      void applyCurrentAnnotationsToAllSkills();
                    }}
                  >
                    {tt('Bruk på alle ferdigheter', 'Apply to all skills')}
                  </MenuItem>
                )}
                {interviewAnnotationSuggestions.length > 0 && (
                  <MenuItem
                    onClick={() => {
                      closeToolMenu();
                      applyInterviewAnnotationSuggestions();
                    }}
                  >
                    {tt('Bruk intervjuforslag', 'Apply interview suggestions')}
                  </MenuItem>
                )}
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
                <Typography sx={{ px: 1.8, pt: 0.8, pb: 0.4, fontSize: 11, color: 'rgba(237,240,247,0.62)' }}>
                  {tt('Maler', 'Templates')}
                </Typography>
                {annotationTemplates.map((template) => (
                  <MenuItem
                    key={`menu-template-${template.id}`}
                    onClick={() => {
                      closeToolMenu();
                      applyTemplate(template.id);
                    }}
                  >
                    {isNorwegian ? template.labelNo : template.labelEn}
                  </MenuItem>
                ))}
              </Menu>

              <Box
                sx={{
                  ...panelSectionSx,
                  p: 1,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  minHeight: 360,
                }}
              >
                <AcademyPlayerStudio
                  src={effectiveVideoUrl}
                  videoRef={videoRef}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                >
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseLeave}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      cursor: previewMode
                        ? 'pointer'
                        : draggingAnnotationId
                          ? 'grabbing'
                          : hoverAnnotationId
                            ? 'grab'
                            : interactionMode === 'select'
                              ? 'default'
                              : 'crosshair',
                    }}
                  />

                  {selectedAnnotation && !previewMode && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${clamp(Number(selectedAnnotation.position.x || 0), 0, 100)}%`,
                        top: `${clamp(Number(selectedAnnotation.position.y || 0), 0, 100)}%`,
                        width: 'min(280px, 78%)',
                        transform: 'translate(-4%, calc(-100% - 12px))',
                        bgcolor: 'rgba(9,13,21,0.94)',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.45)',
                        borderRadius: 1,
                        p: 0.8,
                        zIndex: 5,
                        display: 'grid',
                        gap: 0.6,
                      }}
                    >
                      <Typography sx={{ fontSize: 11, color: 'rgba(237,240,247,0.68)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {tt('Live-redigering', 'Live edit')}
                      </Typography>
                      <TextField
                        size="small"
                        value={draftAnnotation && draftAnnotation.id === selectedAnnotation.id ? draftAnnotation.title : selectedAnnotation.title}
                        onChange={(event) =>
                          setDraftAnnotation((prev) =>
                            prev && prev.id === selectedAnnotation.id
                              ? { ...prev, title: event.target.value }
                              : { ...selectedAnnotation, title: event.target.value },
                          )
                        }
                        inputProps={{ maxLength: 80 }}
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' } }}
                      />
                      <TextField
                        size="small"
                        multiline
                        minRows={2}
                        value={draftAnnotation && draftAnnotation.id === selectedAnnotation.id ? draftAnnotation.content : selectedAnnotation.content}
                        onChange={(event) =>
                          setDraftAnnotation((prev) =>
                            prev && prev.id === selectedAnnotation.id
                              ? { ...prev, content: event.target.value }
                              : { ...selectedAnnotation, content: event.target.value },
                          )
                        }
                        inputProps={{ maxLength: 220 }}
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' } }}
                      />
                    </Box>
                  )}

                  {previewMode && (
                    <Chip
                      size="small"
                      label={tt('Studentvisning aktiv', 'Learner preview active')}
                      sx={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        zIndex: 6,
                        bgcolor: 'rgba(248,179,33,0.16)',
                        color: '#f8d675',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.34)',
                      }}
                    />
                  )}

                  {previewMode && studentPreviewAction && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 12,
                        bottom: 66,
                        zIndex: 7,
                        width: 'min(420px, calc(100% - 24px))',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.38)',
                        borderRadius: 1,
                        bgcolor: 'rgba(8,12,20,0.86)',
                        backdropFilter: 'blur(4px)',
                        px: 1,
                        py: 0.8,
                        display: 'grid',
                        gap: 0.4,
                      }}
                    >
                      <Typography sx={{ fontSize: 12, color: '#f8d675', fontWeight: 700 }}>
                        {studentPreviewAction.title}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.86)' }}>
                        {studentPreviewAction.detail}
                      </Typography>
                    </Box>
                  )}

                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      p: 1.2,
                      background: 'linear-gradient(180deg, rgba(10,13,20,0), rgba(10,13,20,0.95))',
                    }}
                  >
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <IconButton
                        onClick={handlePlayPause}
                        size="small"
                        sx={{ color: '#f9fafc', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)', borderRadius: 1 }}
                      >
                        {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                      </IconButton>
                      <Typography sx={{ minWidth: 110, fontSize: 13 }}>
                        {formatTime(currentTime)} / {formatTime(videoDuration)}
                      </Typography>
                      <Slider
                        value={currentTime}
                        onChange={handleSeek}
                        min={0}
                        max={videoDuration || 1}
                        sx={{
                          flex: 1,
                          color: '#f8b321',
                          '& .MuiSlider-thumb': {
                            width: 12,
                            height: 12,
                          },
                        }}
                      />
                    </Stack>
                  </Box>
                </AcademyPlayerStudio>

                <Box sx={{ ...panelSectionSx, p: 1.2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(237,240,247,0.65)' }}>
                      {tt('Tidslinje', 'Timeline')}
                    </Typography>
                    <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                      <Chip label={tt('Løst', 'Resolved')} size="small" sx={{ bgcolor: 'rgba(126,232,179,0.16)', color: '#9ef1ca' }} />
                      <Chip label={tt(`${previewAnnotations.length} markører`, `${previewAnnotations.length} markers`)} size="small" sx={{ bgcolor: 'rgba(248,179,33,0.16)', color: '#f8d675' }} />
                    </Box>
                  </Stack>

                  <Box
                    ref={timelineTrackRef}
                    sx={{
                      position: 'relative',
                      height: 112,
                      mt: 1,
                      borderRadius: 1,
                      overflow: 'hidden',
                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.09)',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'flex-end',
                        px: 0.7,
                        pb: 0.6,
                        gap: 0.45,
                        background: 'linear-gradient(180deg, rgba(18,22,31,0.76), rgba(8,11,18,0.92))',
                      }}
                    >
                      {waveformPattern.map((height, index) => (
                        <Box
                          key={`wave-${index}`}
                          sx={{
                            flex: 1,
                            borderRadius: 0.5,
                            height,
                            background:
                              index % 3 === 0
                                ? 'linear-gradient(180deg, rgba(248,179,33,0.65), rgba(248,179,33,0.25))'
                                : 'linear-gradient(180deg, rgba(154,167,199,0.56), rgba(154,167,199,0.2))',
                          }}
                        />
                      ))}
                    </Box>

                    {previewAnnotations.map((annotation) => {
                      const safeEnd = resolveAnnotationEndTime(annotation, videoDuration);
                      const markerLeft = videoDuration > 0 ? (annotation.startTime / videoDuration) * 100 : 0;
                      const markerEnd = videoDuration > 0 ? (safeEnd / videoDuration) * 100 : markerLeft;
                      const markerWidth = Math.max(1.5, markerEnd - markerLeft);
                      const isSelected = annotation.id === selectedAnnotationId;
                      const isHovered = annotation.id === hoverAnnotationId;
                      const isTimelineDragging = timelineDragState?.annotationId === annotation.id;
                      const isMoveDragging = isTimelineDragging && timelineDragState?.mode === 'move';
                      const isActiveMarker = isSelected || isHovered || isTimelineDragging;
                      const typeColor =
                        annotationTypes.find((type) => type.value === annotation.type)?.color || '#f8b321';
                      return (
                        <React.Fragment key={`marker-${annotation.id}`}>
                          <Box
                            onMouseEnter={() => setHoverAnnotationId(annotation.id)}
                            onMouseLeave={() => {
                              if (!timelineDragState) setHoverAnnotationId('');
                            }}
                            onClick={() => prepareDraft(annotation)}
                            sx={{
                              position: 'absolute',
                              top: 8,
                              left: `${clamp(markerLeft, 0, 100)}%`,
                              width: isActiveMarker ? 10 : 8,
                              height: isActiveMarker ? 10 : 8,
                              borderRadius: '50%',
                              bgcolor: isActiveMarker ? typeColor : alpha(typeColor, 0.62),
                              boxShadow:
                                isActiveMarker
                                  ? `0 0 0 2px rgba(0,0,0,0.62), 0 0 6px ${alpha(typeColor, 0.3)}`
                                  : '0 0 0 2px rgba(0,0,0,0.48)',
                              transform: 'translateX(-50%)',
                              cursor: isMoveDragging ? 'grabbing' : 'grab',
                              opacity: isActiveMarker ? 1 : 0.78,
                              zIndex: isActiveMarker ? 4 : 2,
                              transition: 'all 140ms ease',
                            }}
                          />
                          <Box
                            onMouseEnter={() => setHoverAnnotationId(annotation.id)}
                            onMouseLeave={() => {
                              if (!timelineDragState) setHoverAnnotationId('');
                            }}
                            onMouseDown={(event) => beginTimelineDrag(event, annotation, 'move')}
                            onClick={() => prepareDraft(annotation)}
                            sx={{
                              position: 'absolute',
                              left: `${clamp(markerLeft, 0, 100)}%`,
                              top: 36,
                              width: `${clamp(markerWidth, 1.5, 100)}%`,
                              minWidth: 14,
                              height: 28,
                              borderRadius: 0.8,
                              border: isSelected
                                ? `var(--academy-hairline-width, 1px) solid ${alpha(typeColor, 0.94)}`
                                : isHovered || isTimelineDragging
                                  ? `var(--academy-hairline-width, 1px) solid ${alpha(typeColor, 0.72)}`
                                  : `var(--academy-hairline-width, 1px) solid ${alpha(typeColor, 0.28)}`,
                              bgcolor: isSelected
                                ? alpha(typeColor, 0.38)
                                : isHovered || isTimelineDragging
                                  ? alpha(typeColor, 0.24)
                                : alpha(typeColor, 0.12),
                              display: 'grid',
                              gridTemplateColumns: '12px minmax(0, 1fr) 12px',
                              alignItems: 'center',
                              px: 0.2,
                              cursor: isMoveDragging ? 'grabbing' : 'grab',
                              opacity: isActiveMarker ? 1 : 0.74,
                              zIndex: isActiveMarker ? 4 : 1,
                              boxShadow:
                                isHovered || isTimelineDragging
                                  ? `0 0 0 1px ${alpha(typeColor, 0.26)} inset, 0 5px 10px ${alpha(typeColor, 0.16)}`
                                  : 'none',
                              transform: isHovered || isTimelineDragging ? 'translateY(-0.5px)' : 'none',
                              transition: 'all 140ms ease',
                            }}
                          >
                            <Box
                              onMouseDown={(event) => beginTimelineDrag(event, annotation, 'start')}
                              sx={{
                                width: 8,
                                height: 16,
                                borderRadius: 0.5,
                                bgcolor: 'rgba(255,255,255,0.72)',
                                cursor: 'ew-resize',
                              }}
                            />
                            <Typography
                              sx={{
                                fontSize: 10,
                                color: '#f7f8fb',
                                px: 0.5,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                              }}
                            >
                              {annotation.title}
                            </Typography>
                            <Box
                              onMouseDown={(event) => beginTimelineDrag(event, annotation, 'end')}
                              sx={{
                                ml: 'auto',
                                width: 8,
                                height: 16,
                                borderRadius: 0.5,
                                bgcolor: 'rgba(255,255,255,0.72)',
                                cursor: 'ew-resize',
                              }}
                            />
                          </Box>
                        </React.Fragment>
                      );
                    })}

                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${timelinePercent}%`,
                        width: 2,
                        bgcolor: '#ffd165',
                        boxShadow: '0 0 12px rgba(248,179,33,0.72)',
                        transform: 'translateX(-1px)',
                      }}
                    />
                  </Box>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1.1 }}>
                    <TextField
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder={tt('Søk annoteringer...', 'Search annotations...')}
                      size="small"
                      InputProps={{
                        startAdornment: <Search fontSize="small" sx={{ mr: 0.7, color: 'rgba(237,240,247,0.6)' }} />,
                      }}
                      sx={{
                        flex: 1,
                        '& .MuiInputBase-root': {
                          bgcolor: 'rgba(11,14,22,0.8)',
                          color: '#edf0f7',
                        },
                      }}
                    />
                    <Button
                      startIcon={<Add />}
                      onClick={() => addAnnotation(activeTool)}
                      sx={{
                        ...neutralOutlinedButtonSx,
                        minWidth: 148,
                      }}
                    >
                      {tt('Legg til markør', 'Add Marker')}
                    </Button>
                  </Stack>

                  <Stack spacing={0.8} sx={{ mt: 1 }}>
                    {previewAnnotations.length === 0 && (
                      <Box
                        sx={{
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                          borderRadius: 1,
                          px: 1.1,
                          py: 0.95,
                          background: 'rgba(10,13,20,0.72)',
                        }}
                      >
                        <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.76)' }}>
                          {tt(
                            'Ingen annoteringer ennå. Legg til første markør fra verktøylinjen.',
                            'No annotations yet. Add your first marker from the toolbar.',
                          )}
                        </Typography>
                      </Box>
                    )}

                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1}
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                    >
                      <Chip
                        icon={<WarningAmber sx={{ fontSize: 16 }} />}
                        label={tt(
                          `${validationIssues.length} kvalitetsvarsler`,
                          `${validationIssues.length} quality warnings`,
                        )}
                        size="small"
                        sx={{
                          bgcolor:
                            validationIssues.length === 0
                              ? 'rgba(126,232,179,0.16)'
                              : 'rgba(248,179,33,0.16)',
                          color:
                            validationIssues.length === 0
                              ? '#9ef1ca'
                              : '#f8d675',
                        }}
                      />
                    </Stack>
                  </Stack>
                </Box>
              </Box>

              {saveMessage && (
                <Typography sx={{ fontSize: 12, color: '#a8f7c4', px: 0.4 }}>
                  {saveMessage}
                </Typography>
              )}
              <Typography sx={{ fontSize: 11, color: 'rgba(237,240,247,0.62)', px: 0.4 }}>
                {tt(
                  'Tastatur: piltaster flytter valgt markør, Shift + piltast flytter 5 steg, Backspace/Delete sletter, Cmd/Ctrl+Z angre, Cmd/Ctrl+Shift+Z gjør om.',
                  'Keyboard: arrow keys move selected marker, Shift + arrow moves 5 steps, Backspace/Delete removes, Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo.',
                )}
              </Typography>
            </Box>

            <Box sx={{ ...panelSectionSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Tabs
                value={rightTab === 'editor' ? false : rightTab}
                onChange={(_, value: RightPanelTab) => setRightTab(value)}
                textColor="inherit"
                sx={{
                  borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                  '& .MuiTabs-indicator': { backgroundColor: '#f8b321' },
                  '& .MuiTab-root': { color: 'rgba(237,240,247,0.78)', textTransform: 'none', minHeight: 44 },
                  '& .Mui-selected': { color: '#f7f8fb' },
                }}
              >
                <Tab label={tt('Markører', 'Markers')} value="markers" />
                <Tab label={tt('Vedlegg', 'Attachments')} value="attachments" />
              </Tabs>

              {rightTab === 'editor' && (
                <Box sx={{ p: 1.25, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.1 }}>
                  <TextField
                    select
                    value={selectedAnnotation?.id || 'none'}
                    onChange={(event) => {
                      const nextAnnotation = previewAnnotations.find((annotation) => annotation.id === event.target.value);
                      if (nextAnnotation) {
                        prepareDraft(nextAnnotation);
                      }
                    }}
                    size="small"
                    label={tt('Annotering', 'Annotation')}
                    sx={{
                      '& .MuiInputBase-root': { bgcolor: 'rgba(10,13,20,0.8)', color: '#edf0f7' },
                    }}
                  >
                    <MenuItem value="none">{tt('Velg annotering', 'Choose annotation')}</MenuItem>
                    {previewAnnotations.map((annotation) => (
                      <MenuItem key={annotation.id} value={annotation.id}>
                        {formatTime(annotation.startTime)} · {annotation.title}
                      </MenuItem>
                    ))}
                  </TextField>

                  <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                    {annotationTypes.map((type) => (
                      <Chip
                        key={`quick-${type.value}`}
                        label={annotationTypeLabel(type.value)}
                        onClick={() => addAnnotation(type.value)}
                        sx={{
                          border: `var(--academy-hairline-width, 1px) solid ${alpha(type.color, 0.55)}`,
                          color: '#edf0f7',
                          bgcolor: alpha(type.color, 0.16),
                        }}
                      />
                    ))}
                  </Stack>

                  <TextField
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    size="small"
                    placeholder={tt('Søk annoteringer...', 'Search annotations...')}
                    InputProps={{
                      startAdornment: <Search fontSize="small" sx={{ mr: 0.6, color: 'rgba(237,240,247,0.58)' }} />,
                    }}
                    sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(10,13,20,0.78)', color: '#edf0f7' } }}
                  />

                  <Box sx={{ flex: 1, minHeight: 180, overflowY: 'auto', pr: 0.3 }}>
                    <Stack spacing={0.8}>
                      {filteredAnnotations.map((annotation) => {
                        const typeMeta = annotationTypes.find((type) => type.value === annotation.type);
                        const selected = annotation.id === selectedAnnotationId;
                        return (
                          <Box
                            key={annotation.id}
                            onClick={() => prepareDraft(annotation)}
                            sx={{
                              border: selected ? `var(--academy-hairline-width, 1px) solid ${alpha('#f8b321', 0.7)}` : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                              borderRadius: 1,
                              p: 1,
                              background:
                                selected
                                  ? 'linear-gradient(145deg, rgba(248,179,33,0.16), rgba(14,17,27,0.92))'
                                  : 'linear-gradient(145deg, rgba(20,24,35,0.9), rgba(10,13,22,0.9))',
                              cursor: 'pointer',
                              transition: 'all 140ms ease',
                              transform: selected ? 'translateY(-1px)' : 'none',
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="flex-start">
                              <Avatar sx={{ width: 28, height: 28, bgcolor: alpha(typeMeta?.color || '#f8b321', 0.3), color: '#fff' }}>
                                {typeMeta?.short || 'A'}
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" spacing={0.6} alignItems="center">
                                  <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>
                                    {annotation.title}
                                  </Typography>
                                  <Typography sx={{ fontSize: 11, color: 'rgba(237,240,247,0.62)' }}>
                                    {formatTime(annotation.startTime)}
                                  </Typography>
                                </Stack>
                                <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.75)' }} noWrap>
                                  {annotation.content}
                                </Typography>
                                <Stack direction="row" spacing={0.7} sx={{ mt: 0.6 }}>
                                  <Chip
                                    label={annotationTypeLabel(annotation.type)}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      bgcolor: alpha(typeMeta?.color || '#f8b321', 0.2),
                                      color: '#edf0f7',
                                    }}
                                  />
                                  {annotation.endTime !== undefined && (
                                    <Chip
                                      label={tt(`til ${formatTime(annotation.endTime)}`, `to ${formatTime(annotation.endTime)}`)}
                                      size="small"
                                      sx={{ height: 20, bgcolor: 'rgba(255,255,255,0.09)', color: '#edf0f7' }}
                                    />
                                  )}
                                </Stack>
                              </Box>
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteAnnotation(annotation.id);
                                }}
                                sx={{ color: 'rgba(255,255,255,0.64)' }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Box>
                        );
                      })}

                      {filteredAnnotations.length === 0 && (
                        <Typography sx={{ color: 'rgba(237,240,247,0.64)', fontSize: 13, py: 2, textAlign: 'center' }}>
                          {tt('Ingen annoteringer funnet.', 'No annotations found.')}
                        </Typography>
                      )}
                    </Stack>
                  </Box>

                  {draftAnnotation && (
                    <Box sx={{ border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.09)', borderRadius: 1, p: 1.1, bgcolor: 'rgba(7,10,16,0.85)' }}>
                      <Typography sx={{ ...sectionLabelSx, mb: 0.8 }}>
                        {tt('Rediger annotering', 'Edit Annotation')}
                      </Typography>

                      <Stack spacing={1}>
                        <Box sx={detailCardSx}>
                          <Typography sx={sectionLabelSx}>
                            {tt('Innhold', 'Content')}
                          </Typography>
                          <Stack spacing={0.85}>
                            <TextField
                              label={tt('Tittel', 'Title')}
                              size="small"
                              value={draftAnnotation.title}
                              onChange={(event) =>
                                setDraftAnnotation((prev) =>
                                  prev ? { ...prev, title: event.target.value } : prev,
                                )
                              }
                              inputProps={{ maxLength: 80 }}
                              helperText={tt(
                                `${String(draftAnnotation.title || '').length}/80 tegn`,
                                `${String(draftAnnotation.title || '').length}/80 chars`,
                              )}
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                            <TextField
                              label={tt('Innhold', 'Content')}
                              size="small"
                              multiline
                              minRows={2}
                              value={draftAnnotation.content}
                              onChange={(event) =>
                                setDraftAnnotation((prev) =>
                                  prev ? { ...prev, content: event.target.value } : prev,
                                )
                              }
                              inputProps={{ maxLength: 220 }}
                              helperText={
                                String(draftAnnotation.content || '').length > 140
                                  ? tt(
                                      `${String(draftAnnotation.content || '').length}/220 tegn · langt på mobil`,
                                      `${String(draftAnnotation.content || '').length}/220 chars · long on mobile`,
                                    )
                                  : tt(
                                      `${String(draftAnnotation.content || '').length}/220 tegn`,
                                      `${String(draftAnnotation.content || '').length}/220 chars`,
                                    )
                              }
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                          </Stack>
                        </Box>

                        <Box sx={detailCardSx}>
                          <Typography sx={sectionLabelSx}>
                            {tt('Type og handling', 'Type and action')}
                          </Typography>
                          <Stack spacing={0.85}>
                            <TextField
                              select
                              label={tt('Type', 'Type')}
                              size="small"
                              value={draftAnnotation.type}
                              onChange={(event) => {
                                const nextType = event.target.value as VideoAnnotation['type'];
                                setDraftAnnotation((prev) =>
                                  prev
                                    ? (() => {
                                        const previousLabel = annotationTypeLabel(prev.type);
                                        const previousDefaultTitle = getDefaultAnnotationTitle(prev.type);
                                        const trimmedTitle = String(prev.title || '').trim();
                                        const shouldReplaceTitle =
                                          !trimmedTitle ||
                                          trimmedTitle === previousLabel ||
                                          trimmedTitle === previousDefaultTitle ||
                                          trimmedTitle.toLowerCase() === String(prev.type).toLowerCase();

                                        const previousDefaultActionType = getDefaultAnnotationAction(prev.type)?.type;
                                        const nextDefaultAction = getDefaultAnnotationAction(nextType);
                                        let nextAction = prev.action;
                                        if (!nextAction && nextDefaultAction) {
                                          nextAction = nextDefaultAction;
                                        } else if (
                                          nextAction &&
                                          previousDefaultActionType &&
                                          nextDefaultAction &&
                                          nextAction.type === previousDefaultActionType
                                        ) {
                                          nextAction = {
                                            ...nextDefaultAction,
                                            data: nextAction.data,
                                          };
                                        }

                                        if (nextType === 'video') {
                                          const nextActionData =
                                            nextAction?.data && typeof nextAction.data === 'object'
                                              ? nextAction.data
                                              : {};
                                          const hasTarget = String(nextAction?.target || '').trim().length > 0;
                                          const linkedVideoId = String(nextActionData.videoResourceId || '').trim();
                                          if (!hasTarget && !linkedVideoId && videoAttachmentResources.length > 0) {
                                            const firstVideo = videoAttachmentResources[0];
                                            nextAction = {
                                              ...(nextAction || { type: 'playVideo' }),
                                              type: 'playVideo',
                                              target: String(firstVideo.url || ''),
                                              data: {
                                                ...nextActionData,
                                                videoResourceId: String(firstVideo.id || ''),
                                              },
                                            };
                                          }
                                        }

                                        return {
                                          ...prev,
                                          type: nextType,
                                          title: shouldReplaceTitle ? annotationTypeLabel(nextType) : prev.title,
                                          content:
                                            prev.content === getDefaultAnnotationContent(prev.type)
                                              ? getDefaultAnnotationContent(nextType)
                                              : prev.content,
                                          style: defaultAnnotationStyle(nextType),
                                          action: nextAction,
                                        };
                                      })()
                                    : prev,
                                );
                              }}
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            >
                              {annotationTypes.map((type) => (
                                <MenuItem key={type.value} value={type.value}>
                                  {annotationTypeLabel(type.value)}
                                </MenuItem>
                              ))}
                            </TextField>

                            {draftAnnotation.type === 'link' && (
                              <TextField
                                label={tt('Lenke-URL', 'Link URL')}
                                size="small"
                                value={String(draftAnnotation.action?.target || '')}
                                onChange={(event) =>
                                  setDraftAnnotation((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          action: {
                                            ...(prev.action ||
                                              getDefaultAnnotationAction(prev.type) || { type: 'openLink' }),
                                            type: 'openLink',
                                            target: event.target.value,
                                          },
                                        }
                                      : prev,
                                  )
                                }
                                placeholder="https://"
                                sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                              />
                            )}

                            {draftAnnotation.type === 'quiz' && (
                              <TextField
                                label={tt('Quiz-path eller ID', 'Quiz path or ID')}
                                size="small"
                                value={String(draftAnnotation.action?.target || '')}
                                onChange={(event) =>
                                  setDraftAnnotation((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          action: {
                                            ...(prev.action ||
                                              getDefaultAnnotationAction(prev.type) || { type: 'showQuiz' }),
                                            type: 'showQuiz',
                                            target: event.target.value,
                                          },
                                        }
                                      : prev,
                                  )
                                }
                                placeholder="/academy/quiz-manager"
                                sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                              />
                            )}

                            {draftAnnotation.type === 'video' && (
                              <Stack spacing={0.75}>
                                <TextField
                                  select
                                  label={tt('Videokilde', 'Video source')}
                                  size="small"
                                  value={draftVideoSourceValue}
                                  onChange={(event) => {
                                    const nextSource = String(event.target.value || '');
                                    setDraftAnnotation((prev) => {
                                      if (!prev) return prev;
                                      const baseAction = {
                                        ...(prev.action || getDefaultAnnotationAction('video') || { type: 'playVideo' }),
                                        type: 'playVideo' as const,
                                      };
                                      const data =
                                        baseAction.data && typeof baseAction.data === 'object'
                                          ? { ...baseAction.data }
                                          : {};
                                      if (nextSource === 'none') {
                                        delete data.videoResourceId;
                                        return {
                                          ...prev,
                                          action: {
                                            ...baseAction,
                                            target: '',
                                            data,
                                          },
                                        };
                                      }
                                      if (nextSource === 'manual') {
                                        delete data.videoResourceId;
                                        return {
                                          ...prev,
                                          action: {
                                            ...baseAction,
                                            data,
                                          },
                                        };
                                      }
                                      const selectedVideo = videoAttachmentResources.find(
                                        (resource) => String(resource.id || '') === nextSource,
                                      );
                                      if (!selectedVideo) return prev;
                                      return {
                                        ...prev,
                                        action: {
                                          ...baseAction,
                                          target: String(selectedVideo.url || ''),
                                          data: {
                                            ...data,
                                            videoResourceId: String(selectedVideo.id || ''),
                                          },
                                        },
                                      };
                                    });
                                  }}
                                  helperText={
                                    videoAttachmentResources.length === 0
                                      ? tt(
                                          'Ingen videoressurser i valgt kompetanse/ferdighet. Bruk manuell URL.',
                                          'No video resources in selected competency/skill. Use manual URL.',
                                        )
                                      : tt(
                                          'Velg fra opplastede videoer eller bruk manuell URL.',
                                          'Choose from uploaded videos or use a manual URL.',
                                        )
                                  }
                                  sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                                >
                                  <MenuItem value="none">{tt('Ingen videokilde', 'No video source')}</MenuItem>
                                  {videoAttachmentResources.map((resource) => (
                                    <MenuItem key={String(resource.id || resource.url)} value={String(resource.id || '')}>
                                      {resource.title}
                                    </MenuItem>
                                  ))}
                                  <MenuItem value="manual">{tt('Manuell URL', 'Manual URL')}</MenuItem>
                                </TextField>
                                <TextField
                                  label={tt('Video-URL', 'Video URL')}
                                  size="small"
                                  value={String(draftAnnotation.action?.target || '')}
                                  onChange={(event) =>
                                    setDraftAnnotation((prev) => {
                                      if (!prev) return prev;
                                      const baseAction = {
                                        ...(prev.action || getDefaultAnnotationAction('video') || { type: 'playVideo' }),
                                        type: 'playVideo' as const,
                                      };
                                      const data =
                                        baseAction.data && typeof baseAction.data === 'object'
                                          ? { ...baseAction.data }
                                          : {};
                                      delete data.videoResourceId;
                                      return {
                                        ...prev,
                                        action: {
                                          ...baseAction,
                                          target: event.target.value,
                                          data,
                                        },
                                      };
                                    })
                                  }
                                  placeholder="https://"
                                  sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                                />
                                {effectiveVideoUrl && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() =>
                                      setDraftAnnotation((prev) => {
                                        if (!prev) return prev;
                                        const baseAction = {
                                          ...(prev.action ||
                                            getDefaultAnnotationAction('video') || { type: 'playVideo' }),
                                          type: 'playVideo' as const,
                                        };
                                        const data =
                                          baseAction.data && typeof baseAction.data === 'object'
                                            ? { ...baseAction.data }
                                            : {};
                                        delete data.videoResourceId;
                                        return {
                                          ...prev,
                                          action: {
                                            ...baseAction,
                                            target: effectiveVideoUrl,
                                            data,
                                          },
                                        };
                                      })
                                    }
                                    sx={{
                                      textTransform: 'none',
                                      color: '#edf0f7',
                                      borderColor: 'rgba(255,255,255,0.2)',
                                      alignSelf: 'flex-start',
                                    }}
                                  >
                                    {tt('Bruk aktiv video', 'Use active video')}
                                  </Button>
                                )}
                              </Stack>
                            )}
                          </Stack>
                        </Box>

                        <Box sx={detailCardSx}>
                          <Typography sx={sectionLabelSx}>
                            {tt('Timing', 'Timing')}
                          </Typography>
                          <Stack direction="row" spacing={0.8}>
                            <TextField
                              label={tt('Start', 'Start')}
                              type="number"
                              size="small"
                              value={draftAnnotation.startTime}
                              onChange={(event) =>
                                setDraftAnnotation((prev) =>
                                  prev ? { ...prev, startTime: Number(event.target.value || 0) } : prev,
                                )
                              }
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                            <TextField
                              label={tt('Slutt', 'End')}
                              type="number"
                              size="small"
                              value={draftAnnotation.endTime ?? ''}
                              onChange={(event) =>
                                setDraftAnnotation((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        endTime: event.target.value === '' ? undefined : Number(event.target.value),
                                      }
                                    : prev,
                                )
                              }
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                          </Stack>
                        </Box>

                        <Stack direction="row" spacing={0.8}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              setDraftAnnotation((prev) =>
                                prev ? { ...prev, isVisible: !prev.isVisible } : prev,
                              )
                            }
                            startIcon={
                              draftAnnotation.isVisible ? (
                                <Visibility fontSize="small" />
                              ) : (
                                <VisibilityOff fontSize="small" />
                              )
                            }
                            sx={{
                              ...neutralOutlinedButtonSx,
                            }}
                          >
                            {draftAnnotation.isVisible ? tt('Synlig', 'Visible') : tt('Skjult', 'Hidden')}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              setDraftAnnotation((prev) =>
                                prev ? { ...prev, isClickable: !prev.isClickable } : prev,
                              )
                            }
                            sx={{
                              ...neutralOutlinedButtonSx,
                            }}
                          >
                            {draftAnnotation.isClickable ? tt('Klikkbar', 'Clickable') : tt('Statisk', 'Static')}
                          </Button>
                        </Stack>

                        <Stack direction="row" spacing={0.8}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={saveDraft}
                            sx={warningOutlinedButtonSx}
                          >
                            {tt('Lagre annotering', 'Save Annotation')}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setDraftAnnotation(null)}
                            sx={neutralOutlinedButtonSx}
                          >
                            {tt('Avbryt', 'Cancel')}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => deleteAnnotation(draftAnnotation.id)}
                            sx={{ ...controlButtonSx }}
                          >
                            {tt('Slett', 'Delete')}
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  )}
                </Box>
              )}

              {rightTab === 'markers' && (
                <Box sx={{ p: 1.3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.72)' }}>
                    {tt('Markørtidslinje og notater', 'Marker timeline and notes')}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={timelinePercent}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'rgba(255,255,255,0.1)',
                      '& .MuiLinearProgress-bar': {
                        background: 'linear-gradient(90deg, #f8b321, #f6d06d)',
                      },
                    }}
                  />
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      icon={<WarningAmber sx={{ fontSize: 15 }} />}
                      label={tt(
                        `${validationIssues.length} kvalitetssjekker`,
                        `${validationIssues.length} quality checks`,
                      )}
                      sx={{
                        bgcolor:
                          validationIssues.length === 0
                            ? 'rgba(126,232,179,0.16)'
                            : 'rgba(248,179,33,0.16)',
                        color:
                          validationIssues.length === 0
                            ? '#9ef1ca'
                            : '#f8d675',
                      }}
                    />
                  </Stack>

                  {validationIssues.length > 0 && (
                    <Stack spacing={0.6}>
                      {validationIssues.slice(0, 6).map((issue) => (
                        <Stack
                          key={issue.id}
                          direction="row"
                          spacing={0.8}
                          alignItems="center"
                          sx={{
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.09)',
                            borderRadius: 1,
                            px: 0.9,
                            py: 0.55,
                            bgcolor: 'rgba(12,16,24,0.88)',
                          }}
                        >
                          <WarningAmber
                            fontSize="small"
                            sx={{
                              color: issue.severity === 'error' ? '#ff8c7f' : '#f8d675',
                            }}
                          />
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.84)', flex: 1 }}>
                            {issue.message}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  )}

                  <TextField
                    select
                    size="small"
                    value={selectedVersionId}
                    label={tt('Versjonshistorikk', 'Version history')}
                    onChange={(event) => {
                      const nextVersionId = String(event.target.value);
                      setSelectedVersionId(nextVersionId);
                    }}
                    sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(10,13,20,0.78)', color: '#edf0f7' } }}
                  >
                    {annotationVersions.length === 0 && (
                      <MenuItem value="">
                        {tt('Ingen lagrede versjoner ennå', 'No saved versions yet')}
                      </MenuItem>
                    )}
                    {annotationVersions.map((version) => (
                      <MenuItem key={version.id} value={version.id}>
                        {new Date(version.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {version.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    size="small"
                    startIcon={<Undo />}
                    disabled={!selectedVersionId}
                    onClick={() => restoreVersion(selectedVersionId)}
                    sx={{
                      textTransform: 'none',
                      alignSelf: 'flex-start',
                      color: '#edf0f7',
                      border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                    }}
                  >
                    {tt('Gjenopprett valgt versjon', 'Restore selected version')}
                  </Button>

                  <Stack spacing={0.8}>
                    {previewAnnotations.map((annotation) => (
                      <Stack
                        key={`marker-row-${annotation.id}`}
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                          borderRadius: 1,
                          px: 1,
                          py: 0.7,
                          background: 'rgba(12,16,24,0.88)',
                        }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: annotationTypes.find((type) => type.value === annotation.type)?.color || '#f8b321',
                          }}
                        />
                        <Typography sx={{ fontSize: 13, flex: 1 }} noWrap>
                          {annotation.title}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }}>
                          {formatTime(annotation.startTime)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}

              {rightTab === 'attachments' && (
                <Box sx={{ p: 1.3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.72)' }}>
                    {tt(
                      'Koble medieressurser til valgt annotering.',
                      'Link media resources to the selected annotation.',
                    )}
                  </Typography>
                  {!selectedAnnotation && (
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.64)' }}>
                      {tt(
                        'Velg en annotering i editoren for å koble ressurser.',
                        'Select an annotation in the editor to link resources.',
                      )}
                    </Typography>
                  )}

                  {selectedAnnotation && (
                    <Chip
                      size="small"
                      label={tt(
                        `${selectedAnnotationAttachmentIds.length} koblede ressurser`,
                        `${selectedAnnotationAttachmentIds.length} linked resources`,
                      )}
                      sx={{
                        alignSelf: 'flex-start',
                        bgcolor: 'rgba(248,179,33,0.16)',
                        color: '#f8d675',
                      }}
                    />
                  )}

                  <TextField
                    value={attachmentSearchValue}
                    onChange={(event) => setAttachmentSearchValue(event.target.value)}
                    size="small"
                    placeholder={tt('Søk ressurser...', 'Search resources...')}
                    InputProps={{
                      startAdornment: <Search fontSize="small" sx={{ mr: 0.6, color: 'rgba(237,240,247,0.58)' }} />,
                    }}
                    sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(10,13,20,0.78)', color: '#edf0f7' } }}
                  />

                  {filteredAttachmentResources.map((resource) => {
                    const resourceId = String(resource.id || '');
                    const isLinked = selectedAnnotationAttachmentIds.includes(resourceId);
                    return (
                      <Stack
                        key={resourceId || resource.url}
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        sx={{
                          border: isLinked
                            ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.55)'
                            : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                          borderRadius: 1,
                          px: 1,
                          py: 0.8,
                          background: isLinked
                            ? 'linear-gradient(145deg, rgba(248,179,33,0.13), rgba(12,16,24,0.9))'
                            : 'rgba(12,16,24,0.88)',
                        }}
                      >
                        <AttachFile fontSize="small" sx={{ color: 'rgba(237,240,247,0.7)' }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 13 }} noWrap>
                            {resource.title}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: 'rgba(237,240,247,0.62)' }} noWrap>
                            {resource.type}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          onClick={() => {
                            if (!selectedAnnotation) return;
                            toggleDraftAttachment(resourceId);
                          }}
                          disabled={!selectedAnnotation}
                          sx={{
                            textTransform: 'none',
                            color: isLinked ? '#f8d675' : '#edf0f7',
                          }}
                        >
                          {isLinked ? tt('Fjern', 'Remove') : tt('Koble', 'Link')}
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            if (typeof window !== 'undefined' && resource.url) {
                              window.open(resource.url, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          sx={{ textTransform: 'none', color: '#f8d675' }}
                        >
                          {tt('Åpne', 'Open')}
                        </Button>
                      </Stack>
                    );
                  })}

                  {filteredAttachmentResources.length === 0 && (
                    <Stack spacing={1}>
                      <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.62)' }}>
                        {tt(
                          'Ingen medieressurser tilgjengelig i valgt scope.',
                          'No media resources available in selected scope.',
                        )}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => {
                          const query = new URLSearchParams();
                          if (resolvedCourseId) query.set('courseId', resolvedCourseId);
                          if (selectedSkill?.id) query.set('lessonId', String(selectedSkill.id));
                          query.set(
                            'returnTo',
                            location ||
                              `/academy/annotation-editor?courseId=${encodeURIComponent(String(resolvedCourseId || ''))}`,
                          );
                          const suffix = query.toString();
                          setLocation(suffix ? `/academy/media?${suffix}` : '/academy/media');
                        }}
                        sx={{ textTransform: 'none', alignSelf: 'flex-start', color: '#f8d675' }}
                      >
                        {tt('Gå til Media', 'Go to Media')}
                      </Button>
                    </Stack>
                  )}
                </Box>
              )}

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Stack direction="row" spacing={1} sx={{ p: 1.1 }}>
                <Button
                  fullWidth
                  onClick={() => {
                    if (onCancel) {
                      onCancel();
                    } else {
                      const query = new URLSearchParams();
                      if (resolvedCourseId) query.set('courseId', resolvedCourseId);
                      if (effectiveScope === 'skill' && selectedSkill?.id) {
                        query.set('lessonId', String(selectedSkill.id));
                      }
                      const suffix = query.toString();
                      setLocation(suffix ? `/academy/lesson-editor?${suffix}` : '/academy/lesson-editor');
                    }
                  }}
                  sx={{
                    textTransform: 'none',
                    color: 'rgba(237,240,247,0.76)',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Lukk', 'Close')}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(VideoAnnotationEditor, {
  componentId: 'video-annotation-editor',
  componentName: 'Video Annotation Editor',
  componentType: 'editor',
  componentCategory: 'academy',
  featureIds: ['annotation-editor', 'video-player-academy'],
});
