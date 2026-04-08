import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  AdsClick,
  AutoFixHigh,
  CloudDone,
  CloudOff,
  CloudSync,
  CropSquare,
  Delete,
  Edit,
  MailOutline,
  NotificationsNone,
  Pause,
  PlayArrow,
  Publish,
  Redo,
  Save,
  Search,
  Subtitles,
  Tune,
  Undo,
  Visibility,
  VisibilityOff,
  WarningAmber,
} from '@mui/icons-material';
import { keyframes } from '@mui/system';
import { useLocation } from 'wouter';
import {
  useAcademy,
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
  syncCourseIdInLocation,
  useAcademyToolUx,
  useToolAutoSaveState,
  useToolHistory,
  useToolUndoRedoShortcuts,
} from './academyToolCore';

interface AcademyLowerThirdsStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
}

type LowerThirdPosition =
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'top-left'
  | 'top-center'
  | 'top-right';

type LowerThirdAnimation =
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'fade-in'
  | 'zoom-in';
type LowerThirdScope = 'course' | 'skill';

type RightTab = 'style-animation' | 'safe-guides' | 'markers';
type EditorTab = 'content' | 'style' | 'animation' | 'safe-guides';
type LowerThirdEditorMode = 'select' | 'edit';
type LowerThirdIssueType = 'contrast' | 'duration' | 'overlap' | 'bounds' | 'mobile-text';

type LowerThirdIssue = {
  id: string;
  itemId?: string;
  type: LowerThirdIssueType;
  severity: 'warning' | 'error';
  message: string;
};

type LowerThirdStoreEntry = {
  items: LowerThirdItem[];
  updatedAt: string;
  publishedAt?: string;
};

type LowerThirdStoreMap = Record<string, LowerThirdStoreEntry>;

interface LowerThirdItem {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  startTime: number;
  duration: number;
  delay: number;
  animationDuration: number;
  position: LowerThirdPosition;
  animation: LowerThirdAnimation;
  enabled: boolean;
  bounce: boolean;
  elastic: boolean;
  easeIn: number;
  easeOut: number;
  style: {
    background: string;
    text: string;
    accent: string;
    opacity: number;
    widthPercent: number;
    borderRadius: number;
    padding: number;
    fontSize: number;
    scale: number;
  };
  safeGuides: {
    enabled: boolean;
    type: 'title-safe' | 'action-safe' | 'custom';
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
    color: string;
    opacity: number;
    thickness: number;
    showLabels: boolean;
    showCenterLines: boolean;
    snapToSafe: boolean;
  };
  analytics: {
    views: number;
    avgWatch: number;
    completionRate: number;
  };
}

const NON_TEXT_BORDER_SUBTLE = 'rgba(255,255,255,0.36)';
const NON_TEXT_BORDER_DEFAULT = 'rgba(255,255,255,0.42)';
const NON_TEXT_BORDER_STRONG = 'rgba(255,255,255,0.52)';
const NON_TEXT_DIVIDER = 'rgba(255,255,255,0.36)';
const NON_TEXT_FOCUS_RING = 'rgba(248,179,33,0.74)';
const NON_TEXT_ALERT_BORDER = 'rgba(248,179,33,0.72)';
const NON_TEXT_DANGER_BORDER = 'rgba(255,139,139,0.72)';
const SAFE_GUIDE_CENTER_LINE_MIN_ALPHA = 0.5;
const SAFE_GUIDE_ACTION_BORDER_MIN_ALPHA = 0.6;
const panelSx = {
  borderRadius: 1.4,
  border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_SUBTLE}`,
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};
const LT_CONTROL_BUTTON_SX = {
  height: 34,
  borderRadius: 1,
  textTransform: 'none',
  transition: 'all 140ms ease',
};
const LT_NEUTRAL_OUTLINED_BUTTON_SX = {
  ...LT_CONTROL_BUTTON_SX,
  borderColor: NON_TEXT_BORDER_DEFAULT,
  color: '#edf0f7',
  bgcolor: 'rgba(255,255,255,0.02)',
  '&:hover': {
    borderColor: NON_TEXT_BORDER_STRONG,
    bgcolor: 'rgba(255,255,255,0.06)',
  },
};
const LT_WARNING_OUTLINED_BUTTON_SX = {
  ...LT_CONTROL_BUTTON_SX,
  borderColor: 'rgba(248,179,33,0.35)',
  color: '#f8d675',
  bgcolor: 'rgba(248,179,33,0.06)',
  '&:hover': {
    borderColor: 'rgba(248,179,33,0.5)',
    bgcolor: 'rgba(248,179,33,0.14)',
  },
};
const LT_NEUTRAL_ICON_BUTTON_SX = {
  width: 34,
  height: 34,
  color: '#edf0f7',
  border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_DEFAULT}`,
  borderRadius: 1,
  transition: 'all 140ms ease',
  '&:hover': {
    borderColor: NON_TEXT_BORDER_STRONG,
    bgcolor: 'rgba(255,255,255,0.06)',
  },
};
const LT_SAVE_BUTTON_SX = {
  ...LT_NEUTRAL_OUTLINED_BUTTON_SX,
  minWidth: 104,
};
const LT_PUBLISH_BUTTON_SX = {
  ...LT_CONTROL_BUTTON_SX,
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
const LT_TOOLBAR_GROUP_SX = {
  p: 0.3,
  borderRadius: 1,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
  bgcolor: 'rgba(255,255,255,0.03)',
  display: 'flex',
  gap: 0.4,
  flexWrap: 'wrap',
  alignItems: 'center',
};
const LT_EDITOR_SECTION_CARD_SX = {
  borderRadius: 1,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
  background: 'linear-gradient(145deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))',
  p: 1,
  display: 'grid',
  gap: 0.8,
};
const LT_FIELD_LABEL_SX = {
  color: 'rgba(237,240,247,0.84)',
  fontSize: { xs: 13, sm: 13.5 },
  lineHeight: 1.3,
};
const LT_SECTION_LABEL_SX = {
  color: 'rgba(237,240,247,0.86)',
  fontSize: { xs: 13, sm: 13.5 },
  mb: 0.8,
  fontWeight: 700,
  letterSpacing: '0.01em',
  lineHeight: 1.3,
};
const LT_METRIC_VALUE_SX = {
  fontSize: { xs: 24, sm: 26 },
  lineHeight: 1,
  fontFamily: 'Barlow Condensed, sans-serif',
  letterSpacing: '0.01em',
};

const academyShellMaxWidth = 'min(100%, var(--academy-shell-max-width, 2880px))';
const LOWER_THIRD_VIDEO_PLACEHOLDER = '/assets/academy/intro-video.mp4';
const LOWER_THIRD_STORE_KEY = 'academyLowerThirdStoreV1';
const LOWER_THIRD_KV_KEY = 'academy_lower_third_store_v1';
const LOWER_THIRD_RESOURCE_ID_PREFIX = 'lowerthird-resource-';
const LOWER_THIRD_RESOURCE_COURSE_PREFIX = 'lowerthird-resource-course-';
const LOWER_THIRD_RESOURCE_SKILL_PREFIX = 'lowerthird-resource-skill-';

const formatTime = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const getRouteParam = (key: string): string => {
  if (typeof window === 'undefined') return '';
  const value = new URLSearchParams(window.location.search).get(key);
  return String(value || '').trim();
};

const getScopeStorageKey = (
  courseId: string,
  scope: LowerThirdScope,
  lessonId?: string | null,
): string => {
  if (scope === 'skill' && lessonId) {
    return `${courseId}::skill::${lessonId}`;
  }
  return `${courseId}::course`;
};

const readLowerThirdStore = (): LowerThirdStoreMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOWER_THIRD_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LowerThirdStoreMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeLowerThirdStore = (store: LowerThirdStoreMap): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOWER_THIRD_STORE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage errors and keep editor state in-memory.
  }
};

const readLowerThirdStoreFromDb = async (): Promise<LowerThirdStoreMap | null> => {
  try {
    const response = await fetch(`/api/user/kv/${encodeURIComponent(LOWER_THIRD_KV_KEY)}`, {
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
        ? (JSON.parse(value) as LowerThirdStoreMap)
        : (value as LowerThirdStoreMap);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writeLowerThirdStoreToDb = async (store: LowerThirdStoreMap): Promise<void> => {
  try {
    await fetch('/api/user/kv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: LOWER_THIRD_KV_KEY, value: store }),
    });
  } catch {
    // Network/storage persistence errors are non-fatal for editor usage.
  }
};

const getLowerThirdEntryUpdatedAt = (entry?: LowerThirdStoreEntry): number => {
  if (!entry?.updatedAt) return 0;
  const ms = Date.parse(entry.updatedAt);
  return Number.isFinite(ms) ? ms : 0;
};

const mergeLowerThirdStores = (
  localStore: LowerThirdStoreMap,
  dbStore: LowerThirdStoreMap,
): LowerThirdStoreMap => {
  const merged: LowerThirdStoreMap = {};
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
      getLowerThirdEntryUpdatedAt(localEntry) >= getLowerThirdEntryUpdatedAt(dbEntry)
        ? localEntry
        : dbEntry;
  });
  return merged;
};

const parseLowerThirdResourceDescription = (
  description: string,
): { name: string; startTime: number; duration: number } | null => {
  const text = String(description || '').trim();
  const match = text.match(/^(.+?)\s*·\s*(\d+):(\d+)\s*·\s*(\d+(?:\.\d+)?)s$/);
  if (!match) return null;

  const name = match[1].trim();
  const startMin = Number.parseInt(match[2], 10);
  const startSec = Number.parseInt(match[3], 10);
  const duration = Number.parseFloat(match[4]);
  if (![startMin, startSec, duration].every(Number.isFinite)) return null;

  return {
    name,
    startTime: Math.max(0, startMin * 60 + startSec),
    duration: Math.max(0.5, duration),
  };
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalizeLowerThirdTiming = (
  lowerThird: LowerThirdItem,
  maxDuration: number,
): LowerThirdItem => {
  const safeMax = Number.isFinite(maxDuration) && maxDuration > 0
    ? Math.max(1, Math.round(maxDuration))
    : 356;
  const maxStartTime = Math.max(0, safeMax - 0.5);
  const startTime = clamp(Number(lowerThird.startTime) || 0, 0, maxStartTime);
  const rawDelay = Math.max(0, Number(lowerThird.delay) || 0);
  const maxDelay = Math.max(0, safeMax - startTime - 0.5);
  const delay = clamp(rawDelay, 0, maxDelay);
  const maxAvailableDuration = Math.max(
    0.5,
    safeMax - Math.min(safeMax, startTime + delay),
  );
  const duration = clamp(
    Number(lowerThird.duration) || 0.5,
    0.5,
    maxAvailableDuration,
  );
  return {
    ...lowerThird,
    startTime,
    delay,
    duration,
  };
};

const SNAP_INTERVAL_SECONDS = 0.5;
const PLAYHEAD_SNAP_THRESHOLD_SECONDS = 0.35;
const LOWER_THIRD_MIN_DURATION_SECONDS = 1.5;
const LOWER_THIRD_TITLE_MAX = 56;
const LOWER_THIRD_SUBTITLE_MAX = 110;

const snapTimelineTime = (
  value: number,
  playhead: number,
  durationSeconds: number,
): number => {
  const bounded = clamp(value, 0, Math.max(0, durationSeconds));
  if (Math.abs(bounded - playhead) <= PLAYHEAD_SNAP_THRESHOLD_SECONDS) {
    return clamp(playhead, 0, durationSeconds);
  }
  return clamp(
    Math.round(bounded / SNAP_INTERVAL_SECONDS) * SNAP_INTERVAL_SECONDS,
    0,
    durationSeconds,
  );
};

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
  if (!rgbMatch) return null;
  const values = rgbMatch[1].split(',').map((item) => Number.parseFloat(item.trim()));
  if (values.length < 3 || values.some((item) => !Number.isFinite(item))) return null;
  return {
    r: clamp(Math.round(values[0]), 0, 255),
    g: clamp(Math.round(values[1]), 0, 255),
    b: clamp(Math.round(values[2]), 0, 255),
  };
};

const relativeLuminance = ({ r, g, b }: { r: number; g: number; b: number }): number => {
  const normalize = (channel: number): number => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
};

const getContrastRatio = (foreground: string, background: string): number | null => {
  const foregroundRgb = parseColorToRgb(foreground);
  const backgroundRgb = parseColorToRgb(background);
  if (!foregroundRgb || !backgroundRgb) return null;
  const light = Math.max(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));
  const dark = Math.min(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));
  return (light + 0.05) / (dark + 0.05);
};

const lowerThirdStartAt = (item: LowerThirdItem): number => item.startTime + item.delay;
const lowerThirdEndAt = (item: LowerThirdItem): number => lowerThirdStartAt(item) + item.duration;

const intervalsOverlap = (left: LowerThirdItem, right: LowerThirdItem): boolean =>
  lowerThirdStartAt(left) < lowerThirdEndAt(right) && lowerThirdStartAt(right) < lowerThirdEndAt(left);

const shorten = (value: string, max: number): string => {
  const raw = String(value || '').trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
};

const validateLowerThirdItems = (
  items: LowerThirdItem[],
  durationSeconds: number,
  tt: (no: string, en: string) => string,
): LowerThirdIssue[] => {
  const issues: LowerThirdIssue[] = [];
  const safeDuration = Math.max(1, Number(durationSeconds || 1));

  items.forEach((item) => {
    if (item.duration < LOWER_THIRD_MIN_DURATION_SECONDS) {
      issues.push({
        id: `${item.id}-duration`,
        itemId: item.id,
        type: 'duration',
        severity: 'warning',
        message: tt('Lower third vises for kort tid.', 'Lower third is visible for too short time.'),
      });
    }

    const start = lowerThirdStartAt(item);
    const end = lowerThirdEndAt(item);
    const effectiveWidth = (item.style.widthPercent ?? 56) * (item.style.scale ?? 1);
    if (start < 0 || end > safeDuration || effectiveWidth > 95) {
      issues.push({
        id: `${item.id}-bounds`,
        itemId: item.id,
        type: 'bounds',
        severity: 'error',
        message: tt('Lower third ligger utenfor tryggt område/tidsrom.', 'Lower third is outside safe bounds/timing.'),
      });
    }

    const contrast = getContrastRatio(item.style.text, item.style.background);
    if (contrast !== null && contrast < 3) {
      issues.push({
        id: `${item.id}-contrast`,
        itemId: item.id,
        type: 'contrast',
        severity: 'warning',
        message: tt('Lav kontrast mellom tekst og bakgrunn.', 'Low contrast between text and background.'),
      });
    }

    if (
      String(item.title || '').trim().length > LOWER_THIRD_TITLE_MAX ||
      String(item.subtitle || '').trim().length > LOWER_THIRD_SUBTITLE_MAX
    ) {
      issues.push({
        id: `${item.id}-mobile`,
        itemId: item.id,
        type: 'mobile-text',
        severity: 'warning',
        message: tt('Teksten er lang for mobilvisning.', 'Text is long for mobile display.'),
      });
    }
  });

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const left = items[i];
      const right = items[j];
      if (left.position !== right.position) continue;
      if (!intervalsOverlap(left, right)) continue;
      const key = [left.id, right.id].sort().join('::');
      issues.push({
        id: `${key}-overlap`,
        type: 'overlap',
        severity: 'warning',
        message: tt(
          'To lower thirds overlapper i samme område.',
          'Two lower thirds overlap in the same area.',
        ),
      });
    }
  }

  return issues;
};

const applyLowerThirdAutoFixes = (
  items: LowerThirdItem[],
  durationSeconds: number,
): LowerThirdItem[] => {
  const safeDuration = Math.max(1, Number(durationSeconds || 1));
  const sorted = [...items]
    .map((item) => normalizeLowerThirdTiming(item, safeDuration))
    .sort((left, right) => lowerThirdStartAt(left) - lowerThirdStartAt(right));

  return sorted.map((item, index) => {
    let fixed = normalizeLowerThirdTiming(item, safeDuration);
    if (fixed.duration < LOWER_THIRD_MIN_DURATION_SECONDS) {
      fixed = normalizeLowerThirdTiming(
        { ...fixed, duration: LOWER_THIRD_MIN_DURATION_SECONDS },
        safeDuration,
      );
    }
    const previous = index > 0 ? sorted[index - 1] : null;
    if (previous && previous.position === fixed.position && intervalsOverlap(previous, fixed)) {
      const previousEnd = lowerThirdEndAt(previous);
      const nextStart = clamp(previousEnd + 0.5, 0, Math.max(0, safeDuration - fixed.duration));
      fixed = normalizeLowerThirdTiming(
        {
          ...fixed,
          startTime: nextStart,
          delay: 0,
        },
        safeDuration,
      );
    }

    let next = {
      ...fixed,
      title: shorten(fixed.title, LOWER_THIRD_TITLE_MAX),
      subtitle: shorten(fixed.subtitle, LOWER_THIRD_SUBTITLE_MAX),
      style: {
        ...fixed.style,
        widthPercent: clamp(fixed.style.widthPercent ?? 56, 20, 85),
        scale: clamp(fixed.style.scale ?? 1, 0.7, 1.4),
      },
    };
    const contrast = getContrastRatio(next.style.text, next.style.background);
    if (contrast !== null && contrast < 3) {
      next = {
        ...next,
        style: {
          ...next.style,
          text: '#f7f8fb',
          background: 'rgba(10,14,22,0.92)',
        },
      };
    }

    return normalizeLowerThirdTiming(next, safeDuration);
  });
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (target.isContentEditable) return true;
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.closest('[contenteditable="true"], [role="textbox"], [role="combobox"]'));
};

const lowerThirdAnimationKeyframes: Record<LowerThirdAnimation, ReturnType<typeof keyframes>> = {
  'slide-up': keyframes`
    from { opacity: 0; transform: translateY(28px); }
    to { opacity: 1; transform: translateY(0); }
  `,
  'slide-down': keyframes`
    from { opacity: 0; transform: translateY(-28px); }
    to { opacity: 1; transform: translateY(0); }
  `,
  'slide-left': keyframes`
    from { opacity: 0; transform: translateX(32px); }
    to { opacity: 1; transform: translateX(0); }
  `,
  'slide-right': keyframes`
    from { opacity: 0; transform: translateX(-32px); }
    to { opacity: 1; transform: translateX(0); }
  `,
  'fade-in': keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
  `,
  'zoom-in': keyframes`
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  `,
};


const defaultLowerThirds = (
  translate?: (no: string, en: string) => string,
): LowerThirdItem[] => {
  const tr = (no: string, en: string) => (translate ? translate(no, en) : en);
  return [
  {
    id: `lt-${Date.now()}-1`,
    name: tr('Instruktør-intro', 'Instructor Intro'),
    title: tr('Sarah Johnson', 'Sarah Johnson'),
    subtitle: tr('Hovedinstruktør foto', 'Lead Photography Instructor'),
    startTime: 163,
    duration: 4.5,
    delay: 0,
    animationDuration: 0.6,
    position: 'bottom-left',
    animation: 'slide-up',
    enabled: true,
    bounce: false,
    elastic: true,
    easeIn: 0.3,
    easeOut: 0.7,
    style: {
      background: 'rgba(8,12,20,0.76)',
      text: '#f5f1e8',
      accent: '#9ad76a',
      opacity: 0.97,
      widthPercent: 56,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      scale: 1,
    },
    safeGuides: {
      enabled: true,
      type: 'title-safe',
      marginTop: 8,
      marginRight: 6,
      marginBottom: 10,
      marginLeft: 6,
      color: '#f8b321',
      opacity: 0.82,
      thickness: 1.2,
      showLabels: true,
      showCenterLines: true,
      snapToSafe: false,
    },
    analytics: {
      views: 6540,
      avgWatch: 3.6,
      completionRate: 82,
    },
  },
  {
    id: `lt-${Date.now()}-2`,
    name: tr('Leksjonskort', 'Lesson Card'),
    title: tr('Leksjon 3 av 12', 'Lesson 3 of 12'),
    subtitle: tr('Forstå lys og komposisjon', 'Understanding Light and Composition'),
    startTime: 222,
    duration: 2.2,
    delay: 0,
    animationDuration: 0.55,
    position: 'bottom-right',
    animation: 'slide-left',
    enabled: true,
    bounce: false,
    elastic: false,
    easeIn: 0.25,
    easeOut: 0.68,
    style: {
      background: 'rgba(10,15,24,0.8)',
      text: '#f4f0e5',
      accent: '#62b6ff',
      opacity: 0.94,
      widthPercent: 48,
      borderRadius: 9,
      padding: 12,
      fontSize: 14,
      scale: 1,
    },
    safeGuides: {
      enabled: true,
      type: 'action-safe',
      marginTop: 8,
      marginRight: 6,
      marginBottom: 10,
      marginLeft: 6,
      color: '#f8b321',
      opacity: 0.82,
      thickness: 1.2,
      showLabels: true,
      showCenterLines: true,
      snapToSafe: false,
    },
    analytics: {
      views: 3710,
      avgWatch: 2.1,
      completionRate: 74,
    },
  },
];
};

function AcademyLowerThirdsStudio({ courseId, onSave }: AcademyLowerThirdsStudioProps) {
  const [location, setLocation] = useLocation();
  const { state, getCourse, getInstructor, updateCourse, updateLesson, setCurrentCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  
  const { tt, navLabel } = useAcademyLocale();
  const routeCourseId = useMemo(() => getRouteParam('courseId'), [location]);
  const routeLessonId = useMemo(
    () => getRouteParam('lessonId') || getRouteParam('skillId'),
    [location],
  );
  const hydratedScopeKeyRef = useRef<string>('');
  const autoSaveHydratedRef = useRef(false);
  const lastAutoSavedSignatureRef = useRef('');

  const [leftNav, setLeftNav] = useState('tool-lower-thirds');
  const [rightTab, setRightTab] = useState<RightTab>('style-animation');
  const [editorTab, setEditorTab] = useState<EditorTab>('content');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(163);
  const [editorMode, setEditorMode] = useState<LowerThirdEditorMode>('edit');
  const [safeAreaEnabled, setSafeAreaEnabled] = useState(true);
  const [timelineSnapEnabled, setTimelineSnapEnabled] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [lastPublishedAt, setLastPublishedAt] = useState('');
  const [hasSavedChangesSincePublish, setHasSavedChangesSincePublish] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || routeCourseId || '');
  const [lowerThirdScope, setLowerThirdScope] = useState<LowerThirdScope>(routeLessonId ? 'skill' : 'course');
  const [selectedSkillId, setSelectedSkillId] = useState(routeLessonId || '');
  const [lowerThirdItems, setLowerThirdItems] = useState<LowerThirdItem[]>(() => defaultLowerThirds(tt));
  const [selectedLowerThirdId, setSelectedLowerThirdId] = useState('');
  const [previewAnimationKey, setPreviewAnimationKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { autoSaveState, lastSavedAt, markDirty, markSaving, markSaved } = useToolAutoSaveState();
  const {
    simpleMode,
    toggleSimpleMode,
    shouldShowAdvanced,
  } = useAcademyToolUx('lower-thirds');
  const {
    versions,
    selectedVersionId,
    setSelectedVersionId,
    snapshotBeforeChange,
    addVersion,
    replaceWithoutHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    restoreVersion,
    bindUndoRedoShortcuts,
  } = useToolHistory<LowerThirdItem>({
    items: lowerThirdItems,
    setItems: setLowerThirdItems,
    maxVersions: 24,
    coalesceMs: 650,
  });
  useToolUndoRedoShortcuts(bindUndoRedoShortcuts);

  const courseItems = useMemo(() => {
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
    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;
    const fromSelected = selectedCourseId
      ? courseItems.find((course) => String(course.id) === String(selectedCourseId))
      : null;
    if (fromSelected) return fromSelected;
    const fromRoute = routeCourseId ? getCourse(routeCourseId) : null;
    if (fromRoute) return fromRoute;
    return state.currentCourse || courseItems[0] || null;
  }, [courseId, courseItems, getCourse, routeCourseId, selectedCourseId, state.currentCourse]);

  const selectedCourseValue = useMemo(() => {
    const preferredId = String(selectedCourseId || activeCourse?.id || '');
    if (preferredId && courseOptionIds.includes(preferredId)) {
      return preferredId;
    }
    return courseOptionIds[0] || '';
  }, [activeCourse?.id, courseOptionIds, selectedCourseId]);

  useEffect(() => {
    if (selectedCourseValue && selectedCourseId !== selectedCourseValue) {
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
    if (lowerThirdScope !== 'skill') {
      setLowerThirdScope('skill');
    }
    if (nextRouteLessonId !== selectedSkillId) {
      setSelectedSkillId(nextRouteLessonId);
    }
  }, [lowerThirdScope, routeLessonId, selectedSkillId]);

  const skillOptions = useMemo<Lesson[]>(() => {
    if (!activeCourse || !Array.isArray(activeCourse.lessons)) return [];
    return activeCourse.lessons;
  }, [activeCourse]);

  const selectedSkill = useMemo(() => {
    if (!selectedSkillId) return null;
    return skillOptions.find((lesson) => String(lesson.id) === String(selectedSkillId)) || null;
  }, [selectedSkillId, skillOptions]);

  useEffect(() => {
    if (lowerThirdScope !== 'skill') return;
    if (skillOptions.length === 0) {
      setLowerThirdScope('course');
      setSelectedSkillId('');
      return;
    }
    if (selectedSkill) return;
    const fallbackSkill = routeLessonId
      ? skillOptions.find((lesson) => String(lesson.id) === String(routeLessonId))
      : null;
    setSelectedSkillId(String((fallbackSkill || skillOptions[0]).id));
  }, [lowerThirdScope, routeLessonId, selectedSkill, skillOptions]);

  const effectiveScope: LowerThirdScope =
    lowerThirdScope === 'skill' && selectedSkill ? 'skill' : 'course';

  const resolvedCourseId = String(
    selectedCourseValue || selectedCourseId || activeCourse?.id || routeCourseId || '',
  ).trim();

  const buildRouteWithContext = useCallback(
    (route: string, options?: { includeLesson?: boolean; courseId?: string }) => {
      const includeLesson = options?.includeLesson !== false;
      const [rawPathname, rawQuery = ''] = String(route || '').split('?');
      const pathname = rawPathname || '/academy/lower-thirds-studio';
      const params = new URLSearchParams(rawQuery);
      const nextCourseId = String(options?.courseId || resolvedCourseId || '').trim();
      if (nextCourseId) {
        params.set('courseId', nextCourseId);
      } else {
        params.delete('courseId');
      }
      params.delete('course_id');

      const nextSkillId = String(selectedSkill?.id || '').trim();
      if (includeLesson && effectiveScope === 'skill' && nextSkillId) {
        params.set('lessonId', nextSkillId);
        params.delete('skillId');
      } else {
        params.delete('lessonId');
        params.delete('skillId');
      }

      const suffix = params.toString();
      return suffix ? `${pathname}?${suffix}` : pathname;
    },
    [effectiveScope, resolvedCourseId, selectedSkill?.id],
  );

  const setLocationWithContext = useCallback(
    (route: string, includeLesson = true) => {
      setLocation(buildRouteWithContext(route, { includeLesson }));
    },
    [buildRouteWithContext, setLocation],
  );

  const syncCourseIdInRoute = useCallback(
    (nextCourseId: string) => {
      const normalizedCourseId = String(nextCourseId || '').trim();
      syncCourseIdInLocation(location, setLocation, normalizedCourseId);
      const [pathname, rawQuery = ''] = String(location || '').split('?');
      const params = new URLSearchParams(rawQuery);
      if (normalizedCourseId) {
        params.set('courseId', normalizedCourseId);
      } else {
        params.delete('courseId');
      }
      params.delete('course_id');
      if (effectiveScope === 'skill' && selectedSkill?.id) {
        params.set('lessonId', String(selectedSkill.id));
        params.delete('skillId');
      } else {
        params.delete('lessonId');
        params.delete('skillId');
      }
      const suffix = params.toString();
      const target = suffix ? `${pathname}?${suffix}` : pathname;
      if (target !== location) {
        setLocation(target);
      }
    },
    [effectiveScope, location, selectedSkill?.id, setLocation],
  );

  useEffect(() => {
    const [pathname, rawQuery = ''] = String(location || '').split('?');
    const params = new URLSearchParams(rawQuery);
    let changed = false;

    if (resolvedCourseId && params.get('courseId') !== resolvedCourseId) {
      params.set('courseId', resolvedCourseId);
      changed = true;
    }
    if (!resolvedCourseId && params.has('courseId')) {
      params.delete('courseId');
      changed = true;
    }
    if (params.has('course_id')) {
      params.delete('course_id');
      changed = true;
    }

    if (effectiveScope === 'skill' && selectedSkill?.id) {
      const lessonId = String(selectedSkill.id);
      if (params.get('lessonId') !== lessonId) {
        params.set('lessonId', lessonId);
        changed = true;
      }
      if (params.has('skillId')) {
        params.delete('skillId');
        changed = true;
      }
    } else {
      if (params.has('lessonId')) {
        params.delete('lessonId');
        changed = true;
      }
      if (params.has('skillId')) {
        params.delete('skillId');
        changed = true;
      }
    }

    if (!changed) return;
    const suffix = params.toString();
    const next = suffix ? `${pathname}?${suffix}` : pathname;
    if (next !== location) {
      setLocation(next);
    }
  }, [effectiveScope, location, resolvedCourseId, selectedSkill?.id, setLocation]);

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

  const effectiveVideoUrl = useMemo(
    () =>
      resolveAcademyVideoUrl({
        course: activeCourse,
        preferredLessonId:
          effectiveScope === 'skill' ? String(selectedSkill?.id || '') : null,
        fallbackUrl: LOWER_THIRD_VIDEO_PLACEHOLDER,
      }),
    [activeCourse, effectiveScope, selectedSkill?.id],
  );

  const scopeStorageKey = useMemo(() => {
    if (!activeCourse?.id) return '';
    return getScopeStorageKey(
      String(activeCourse.id),
      effectiveScope,
      selectedSkill ? String(selectedSkill.id) : undefined,
    );
  }, [activeCourse?.id, effectiveScope, selectedSkill]);

  const targetDuration = useMemo(() => {
    const raw =
      effectiveScope === 'skill'
        ? Number(selectedSkill?.duration || 0)
        : Number(activeCourse?.duration || 0);
    if (Number.isFinite(raw) && raw > 0) {
      return Math.max(60, raw);
    }
    return 356;
  }, [activeCourse?.duration, effectiveScope, selectedSkill?.duration]);

  const duration = targetDuration;

  const scopeResources = useMemo<Array<CourseResource | LessonResource>>(() => {
    if (effectiveScope === 'skill') {
      return Array.isArray(selectedSkill?.resources) ? selectedSkill.resources : [];
    }
    return Array.isArray(activeCourse?.resources) ? activeCourse.resources : [];
  }, [activeCourse?.resources, effectiveScope, selectedSkill?.resources]);

  const resourceDerivedLowerThirds = useMemo<LowerThirdItem[]>(() => {
    const lowerThirdResources = scopeResources.filter((resource) => {
      const resourceId = String(resource.id || '');
      if (effectiveScope === 'course') {
        return (
          resourceId.startsWith(LOWER_THIRD_RESOURCE_COURSE_PREFIX) ||
          (resourceId.startsWith(LOWER_THIRD_RESOURCE_ID_PREFIX) &&
            !resourceId.startsWith(LOWER_THIRD_RESOURCE_SKILL_PREFIX))
        );
      }
      const skillId = String(selectedSkill?.id || '');
      if (!skillId) return false;
      return resourceId.startsWith(`${LOWER_THIRD_RESOURCE_SKILL_PREFIX}${skillId}-`);
    });

    if (lowerThirdResources.length === 0) return [];

    const fallbackItems = defaultLowerThirds(tt);
    return lowerThirdResources.map((resource, index) => {
      const fallback = fallbackItems[index % fallbackItems.length];
      const parsed = parseLowerThirdResourceDescription(String(resource.description || ''));
      const titleSource = String(resource.title || '')
        .replace(/^\[LowerThird\](?:\[(?:Skill|Course)\])?\s*/i, '')
        .trim();
      const name = parsed?.name || titleSource || fallback.name;
      return {
        ...fallback,
        id: String(resource.id || `lt-resource-${index}`),
        name,
        title: name,
        subtitle: fallback.subtitle,
        startTime: parsed?.startTime ?? fallback.startTime + index * 5,
        duration: parsed?.duration ?? fallback.duration,
      };
    }).map((item) => normalizeLowerThirdTiming(item, duration));
  }, [duration, effectiveScope, scopeResources, selectedSkill?.id, tt]);

  useEffect(() => {
    if (!activeCourse?.id) return;
    const inState = state.courses.some((course) => String(course.id) === String(activeCourse.id));
    if (!inState) return;
    if (String(state.currentCourse?.id || '') === String(activeCourse.id)) return;
    setCurrentCourse(activeCourse);
  }, [activeCourse, setCurrentCourse, state.courses, state.currentCourse?.id]);

  const selectedLowerThird = useMemo(() => {
    return (
      lowerThirdItems.find((lowerThird) => lowerThird.id === selectedLowerThirdId) ||
      lowerThirdItems[0] ||
      null
    );
  }, [lowerThirdItems, selectedLowerThirdId]);

  const filteredLowerThirds = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return lowerThirdItems;
    return lowerThirdItems.filter((lowerThird) => {
      return (
        lowerThird.name.toLowerCase().includes(query) ||
        lowerThird.title.toLowerCase().includes(query) ||
        lowerThird.subtitle.toLowerCase().includes(query)
      );
    });
  }, [lowerThirdItems, searchValue]);

  const activeLowerThirdVisible = useMemo(() => {
    if (!selectedLowerThird || !selectedLowerThird.enabled) return false;
    const begin = selectedLowerThird.startTime + selectedLowerThird.delay;
    const end = begin + selectedLowerThird.duration;
    const epsilon = 0.04;
    return currentTime + epsilon >= begin && currentTime - epsilon <= end;
  }, [currentTime, selectedLowerThird]);

  const showLowerThirdDraftPreview = Boolean(
    selectedLowerThird && selectedLowerThird.enabled && (activeLowerThirdVisible || editorMode === 'edit'),
  );

  const selectedSafeGuideInsets = useMemo(() => {
    if (!selectedLowerThird?.safeGuides.enabled) return null;

    const safeGuide = selectedLowerThird.safeGuides;
    const titleSafe = { top: 10, right: 10, bottom: 10, left: 10 };
    const actionSafe = { top: 5, right: 5, bottom: 5, left: 5 };
    const presetMargins =
      safeGuide.type === 'title-safe'
        ? titleSafe
        : safeGuide.type === 'action-safe'
          ? actionSafe
          : null;

    const top = clamp(presetMargins?.top ?? safeGuide.marginTop, 0, 45);
    const right = clamp(presetMargins?.right ?? safeGuide.marginRight, 0, 45);
    const bottom = clamp(presetMargins?.bottom ?? safeGuide.marginBottom, 0, 45);
    const left = clamp(presetMargins?.left ?? safeGuide.marginLeft, 0, 45);

    return {
      active: { top, right, bottom, left },
      title: titleSafe,
      action: actionSafe,
      type: safeGuide.type,
      color: safeGuide.color || '#f8b321',
      opacity: clamp(safeGuide.opacity ?? 0.82, 0.2, 1),
      thickness: clamp(safeGuide.thickness ?? 1.2, 1, 4),
      showLabels: safeGuide.showLabels !== false,
      showCenterLines: safeGuide.showCenterLines !== false,
    };
  }, [selectedLowerThird]);

  const selectedSafeGuideFit = useMemo(() => {
    if (!selectedLowerThird || !selectedSafeGuideInsets) return null;

    const blockWidth = clamp((selectedLowerThird.style.widthPercent ?? 56) * (selectedLowerThird.style.scale ?? 1), 20, 120);
    const blockHeight = clamp(17 * (selectedLowerThird.style.scale ?? 1), 10, 46);
    const snapToSafe = selectedLowerThird.safeGuides.snapToSafe === true;
    const edgeOffsetX = snapToSafe
      ? selectedLowerThird.position.includes('right')
        ? selectedSafeGuideInsets.active.right
        : selectedLowerThird.position.includes('left')
          ? selectedSafeGuideInsets.active.left
          : 0
      : 3;
    const edgeOffsetY = snapToSafe
      ? selectedLowerThird.position.includes('top')
        ? selectedSafeGuideInsets.active.top
        : selectedLowerThird.position.includes('bottom')
          ? selectedSafeGuideInsets.active.bottom
          : 0
      : 3;

    const horizontal =
      selectedLowerThird.position.includes('center')
        ? { left: (100 - blockWidth) / 2, right: (100 - blockWidth) / 2 }
        : selectedLowerThird.position.includes('right')
          ? { left: 100 - edgeOffsetX - blockWidth, right: edgeOffsetX }
          : { left: edgeOffsetX, right: 100 - edgeOffsetX - blockWidth };

    const vertical =
      selectedLowerThird.position.includes('top')
        ? { top: edgeOffsetY, bottom: 100 - edgeOffsetY - blockHeight }
        : { top: 100 - edgeOffsetY - blockHeight, bottom: edgeOffsetY };

    const horizontalFits =
      horizontal.left >= selectedSafeGuideInsets.active.left &&
      horizontal.right >= selectedSafeGuideInsets.active.right;
    const verticalFits =
      vertical.top >= selectedSafeGuideInsets.active.top &&
      vertical.bottom >= selectedSafeGuideInsets.active.bottom;

    return {
      horizontalFits,
      verticalFits,
      fits: horizontalFits && verticalFits,
    };
  }, [selectedLowerThird, selectedSafeGuideInsets]);

  const selectedLowerThirdAnimationTiming = useMemo(() => {
    if (!selectedLowerThird) return 'cubic-bezier(0.3, 0, 0.7, 1)';
    if (selectedLowerThird.elastic) return 'cubic-bezier(0.22, 1.35, 0.3, 1)';
    if (selectedLowerThird.bounce) return 'cubic-bezier(0.34, 1.56, 0.64, 1)';
    const easeIn = clamp(selectedLowerThird.easeIn, 0, 1);
    const easeOut = clamp(selectedLowerThird.easeOut, 0, 1);
    return `cubic-bezier(${easeIn.toFixed(2)}, 0, ${easeOut.toFixed(2)}, 1)`;
  }, [selectedLowerThird]);

  const selectedLowerThirdAnimationDuration = useMemo(() => {
    if (!selectedLowerThird) return 0.55;
    return clamp(selectedLowerThird.animationDuration, 0.2, 2.5);
  }, [selectedLowerThird]);

  useEffect(() => {
    if (!selectedCourseId && activeCourse?.id) {
      setSelectedCourseId(String(activeCourse.id));
    }
  }, [activeCourse?.id, selectedCourseId]);

  useEffect(() => {
    setCurrentTime((prev) => Math.min(prev, duration));
  }, [duration]);

  useEffect(() => {
    if (!selectedLowerThirdId && lowerThirdItems.length > 0) {
      setSelectedLowerThirdId(lowerThirdItems[0].id);
    }
  }, [lowerThirdItems, selectedLowerThirdId]);

  useEffect(() => {
    if (!scopeStorageKey) return;
    if (hydratedScopeKeyRef.current === scopeStorageKey) return;
    hydratedScopeKeyRef.current = scopeStorageKey;

    const store = readLowerThirdStore();
    const stored = store[scopeStorageKey];
    if (stored && Array.isArray(stored.items) && stored.items.length > 0) {
      const normalizedStoredItems = stored.items.map((item) =>
        normalizeLowerThirdTiming(item, duration),
      );
      replaceWithoutHistory(normalizedStoredItems);
      setSelectedLowerThirdId(normalizedStoredItems[0]?.id || '');
      setLastPublishedAt(String(stored.publishedAt || ''));
      setHasSavedChangesSincePublish(hasSavedDraftNewerThanPublished(stored.updatedAt, stored.publishedAt));
      return;
    }

    if (resourceDerivedLowerThirds.length > 0) {
      replaceWithoutHistory(resourceDerivedLowerThirds);
      setSelectedLowerThirdId(resourceDerivedLowerThirds[0]?.id || '');
      setLastPublishedAt('');
      setHasSavedChangesSincePublish(false);
      return;
    }

    const fallbackItems = defaultLowerThirds(tt).map((item) =>
      normalizeLowerThirdTiming(item, duration),
    );
    replaceWithoutHistory(fallbackItems);
    setSelectedLowerThirdId(fallbackItems[0]?.id || '');
    setLastPublishedAt('');
    setHasSavedChangesSincePublish(false);
  }, [duration, replaceWithoutHistory, resourceDerivedLowerThirds, scopeStorageKey, tt]);

  useEffect(() => {
    if (!scopeStorageKey) return;
    let cancelled = false;

    void (async () => {
      const localStore = readLowerThirdStore();
      const dbStore = await readLowerThirdStoreFromDb();
      if (cancelled) return;

      if (!dbStore) {
        if (Object.keys(localStore).length > 0) {
          void writeLowerThirdStoreToDb(localStore);
        }
        return;
      }

      const mergedStore = mergeLowerThirdStores(localStore, dbStore);
      const mergedSerialized = JSON.stringify(mergedStore);

      if (mergedSerialized && JSON.stringify(localStore) !== mergedSerialized) {
        writeLowerThirdStore(mergedStore);
      }
      if (mergedSerialized && JSON.stringify(dbStore) !== mergedSerialized) {
        void writeLowerThirdStoreToDb(mergedStore);
      }

      const mergedEntry = mergedStore[scopeStorageKey];
      if (!mergedEntry || !Array.isArray(mergedEntry.items) || mergedEntry.items.length === 0) {
        setLastPublishedAt('');
        setHasSavedChangesSincePublish(false);
        return;
      }

      const normalizedMergedItems = mergedEntry.items.map((item) =>
        normalizeLowerThirdTiming(item, duration),
      );
      replaceWithoutHistory(normalizedMergedItems);
      setSelectedLowerThirdId(normalizedMergedItems[0]?.id || '');
      setLastPublishedAt(String(mergedEntry.publishedAt || ''));
      setHasSavedChangesSincePublish(hasSavedDraftNewerThanPublished(mergedEntry.updatedAt, mergedEntry.publishedAt));
    })();

    return () => {
      cancelled = true;
    };
  }, [duration, replaceWithoutHistory, scopeStorageKey]);

  useEffect(() => {
    analytics.trackEvent('academy_lower_thirds_studio_opened', {
      courseId: activeCourse?.id || null,
      scope: effectiveScope,
      lessonId: effectiveScope === 'skill' ? selectedSkill?.id || null : null,
      instructorId: effectiveInstructor?.id || null,
      lowerThirdCount: lowerThirdItems.length,
      timestamp: Date.now(),
    });
    debugging.logIntegration('info', 'AcademyLowerThirdsStudio opened', {
      courseId: activeCourse?.id || null,
      scope: effectiveScope,
      lessonId: effectiveScope === 'skill' ? selectedSkill?.id || null : null,
      instructorId: effectiveInstructor?.id || null,
      lowerThirdCount: lowerThirdItems.length,
    });
  }, [
    activeCourse?.id,
    analytics,
    debugging,
    effectiveInstructor?.id,
    effectiveScope,
    lowerThirdItems.length,
    selectedSkill?.id,
  ]);

  const handleLoadedMetadata = useCallback(() => {
    const measured = videoRef.current?.duration;
    if (typeof measured !== 'number' || !Number.isFinite(measured) || measured <= 0) {
      return;
    }
    const nextDuration = Math.max(60, Math.round(measured));
    setCurrentTime((prev) => Math.min(prev, nextDuration));
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const measuredTime = videoRef.current?.currentTime;
    if (typeof measuredTime !== 'number' || !Number.isFinite(measuredTime)) return;
    setCurrentTime(measuredTime);
  }, []);

  const seekTo = useCallback(
    (value: number) => {
      const next = clamp(value, 0, duration);
      const video = videoRef.current;
      if (video) {
        video.currentTime = next;
      }
      setCurrentTime(next);
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
      void video.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
      return;
    }
    video.pause();
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (!activeLowerThirdVisible || !selectedLowerThird) return;
    setPreviewAnimationKey((prev) => prev + 1);
  }, [
    activeLowerThirdVisible,
    selectedLowerThird?.id,
    selectedLowerThird?.animation,
    selectedLowerThird?.bounce,
    selectedLowerThird?.elastic,
    selectedLowerThird?.easeIn,
    selectedLowerThird?.easeOut,
    selectedLowerThird?.duration,
    selectedLowerThird?.animationDuration,
    selectedLowerThird?.title,
    selectedLowerThird?.subtitle,
    selectedLowerThird?.position,
  ]);

  const qualityIssues = useMemo(
    () => validateLowerThirdItems(lowerThirdItems, duration, tt),
    [duration, lowerThirdItems, tt],
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

  const setSelectedLowerThirdField = useCallback(
    <K extends keyof LowerThirdItem>(field: K, value: LowerThirdItem[K]) => {
      if (!selectedLowerThirdId) return;
      snapshotBeforeChange(tt('Rediger lower third', 'Edit lower third'));
      setLowerThirdItems((prev) =>
        prev.map((item) => {
          if (item.id !== selectedLowerThirdId) return item;
          return { ...item, [field]: value };
        }),
      );
    },
    [selectedLowerThirdId, snapshotBeforeChange, tt],
  );

  const setSelectedLowerThirdStyleField = useCallback(
    <K extends keyof LowerThirdItem['style']>(field: K, value: LowerThirdItem['style'][K]) => {
      if (!selectedLowerThirdId) return;
      snapshotBeforeChange(tt('Oppdater stil', 'Update style'));
      setLowerThirdItems((prev) =>
        prev.map((item) => {
          if (item.id !== selectedLowerThirdId) return item;
          return {
            ...item,
            style: {
              ...item.style,
              [field]: value,
            },
          };
        }),
      );
    },
    [selectedLowerThirdId, snapshotBeforeChange, tt],
  );

  const setSelectedLowerThirdSafeField = useCallback(
    <K extends keyof LowerThirdItem['safeGuides']>(field: K, value: LowerThirdItem['safeGuides'][K]) => {
      if (!selectedLowerThirdId) return;
      snapshotBeforeChange(tt('Oppdater safe guides', 'Update safe guides'));
      setLowerThirdItems((prev) =>
        prev.map((item) => {
          if (item.id !== selectedLowerThirdId) return item;
          return {
            ...item,
            safeGuides: {
              ...item.safeGuides,
              [field]: value,
            },
          };
        }),
      );
    },
    [selectedLowerThirdId, snapshotBeforeChange, tt],
  );

  const applySelectedTimelineRange = useCallback(
    (nextStart: number, nextEnd: number) => {
      if (!selectedLowerThirdId || !selectedLowerThird) return;
      const snappedStart = timelineSnapEnabled
        ? snapTimelineTime(nextStart, currentTime, duration)
        : clamp(nextStart, 0, duration);
      const snappedEnd = timelineSnapEnabled
        ? snapTimelineTime(nextEnd, currentTime, duration)
        : clamp(nextEnd, 0, duration);
      const safeEnd = Math.max(snappedStart + LOWER_THIRD_MIN_DURATION_SECONDS, snappedEnd);
      const safeDuration = clamp(safeEnd - snappedStart, LOWER_THIRD_MIN_DURATION_SECONDS, duration);

      snapshotBeforeChange(tt('Juster lower third-tidslinje', 'Adjust lower third timeline'));
      setLowerThirdItems((prev) =>
        prev.map((item) => {
          if (item.id !== selectedLowerThirdId) return item;
          return normalizeLowerThirdTiming(
            {
              ...item,
              startTime: snappedStart,
              delay: 0,
              duration: safeDuration,
            },
            duration,
          );
        }),
      );
    },
    [
      currentTime,
      duration,
      selectedLowerThird,
      selectedLowerThirdId,
      snapshotBeforeChange,
      timelineSnapEnabled,
      tt,
    ],
  );

  const snapSelectedLowerThirdToSafeZone = useCallback(() => {
    if (!selectedLowerThirdId || !selectedSafeGuideInsets) return;
    snapshotBeforeChange(tt('Snap til safe area', 'Snap to safe area'));

    setLowerThirdItems((prev) =>
      prev.map((item) => {
        if (item.id !== selectedLowerThirdId) return item;

        const safeWidthAvailable = Math.max(
          20,
          100 - selectedSafeGuideInsets.active.left - selectedSafeGuideInsets.active.right,
        );
        const nextScale = clamp(
          Math.min(item.style.scale ?? 1, safeWidthAvailable / 20),
          0.7,
          1.6,
        );
        const maxWidthPercent = clamp(safeWidthAvailable / Math.max(nextScale, 0.1), 20, 95);
        const nextWidthPercent = clamp(
          Math.min(item.style.widthPercent ?? 56, maxWidthPercent),
          20,
          95,
        );
        const safeGuidesNext = {
          ...item.safeGuides,
          snapToSafe: true,
        };

        const hasChanges =
          safeGuidesNext.snapToSafe !== item.safeGuides.snapToSafe ||
          nextScale !== item.style.scale ||
          nextWidthPercent !== item.style.widthPercent;

        if (!hasChanges) return item;

        return {
          ...item,
          style: {
            ...item.style,
            scale: nextScale,
            widthPercent: nextWidthPercent,
          },
          safeGuides: safeGuidesNext,
        };
      }),
    );

    setSaveMessage(tt('Snap til trygg sone aktivert.', 'Snap to safe zone enabled.'));
  }, [selectedLowerThirdId, selectedSafeGuideInsets, snapshotBeforeChange, tt]);

  const addLowerThird = useCallback(() => {
    snapshotBeforeChange(tt('Legg til lower third', 'Add lower third'), { force: true });
    const next: LowerThirdItem = {
      id: `lt-${Date.now()}`,
      name: `${tt('Ny lower third', 'New Lower Third')} ${lowerThirdItems.length + 1}`,
      title: tt('Ny tittel', 'New title'),
      subtitle: tt('Ny undertittel', 'New subtitle'),
      startTime: clamp(Math.round(currentTime), 0, duration),
      duration: 4.5,
      delay: 0,
      animationDuration: 0.6,
      position: 'bottom-left',
      animation: 'slide-up',
      enabled: true,
      bounce: false,
      elastic: false,
      easeIn: 0.3,
      easeOut: 0.7,
      style: {
        background: 'rgba(8,12,20,0.8)',
        text: '#f5f1e8',
        accent: '#f8b321',
        opacity: 0.96,
        widthPercent: 56,
        borderRadius: 10,
        padding: 14,
        fontSize: 16,
        scale: 1,
      },
      safeGuides: {
        enabled: true,
        type: 'title-safe',
        marginTop: 8,
        marginRight: 6,
        marginBottom: 10,
        marginLeft: 6,
        color: '#f8b321',
        opacity: 0.82,
        thickness: 1.2,
        showLabels: true,
        showCenterLines: true,
        snapToSafe: false,
      },
      analytics: {
        views: 0,
        avgWatch: 0,
        completionRate: 0,
      },
    };
    setLowerThirdItems((prev) => [normalizeLowerThirdTiming(next, duration), ...prev]);
    setSelectedLowerThirdId(next.id);
    setSaveMessage(tt(`La til ${next.name}.`, `Added ${next.name}.`));
  }, [currentTime, duration, lowerThirdItems.length, snapshotBeforeChange, tt]);

  const removeLowerThird = useCallback(
    (lowerThirdId?: string) => {
      const targetId = lowerThirdId || selectedLowerThirdId;
      if (!targetId) return;

      const target = lowerThirdItems.find((item) => item.id === targetId);
      if (!target) return;

      if (lowerThirdItems.length <= 1) {
        setSaveMessage(
          tt(
            'Du må ha minst én lower third i prosjektet.',
            'You need at least one lower third in the project.',
          ),
        );
        return;
      }

      const nextItems = lowerThirdItems.filter((item) => item.id !== targetId);
      snapshotBeforeChange(tt('Slett lower third', 'Delete lower third'), { force: true });
      setLowerThirdItems(nextItems);
      setSelectedLowerThirdId((prev) => {
        if (prev && prev !== targetId) return prev;
        return nextItems[0]?.id || '';
      });
      setSaveMessage(
        tt(`Slettet ${target.name}.`, `Deleted ${target.name}.`),
      );

      analytics.trackEvent('academy_lower_third_deleted', {
        courseId: activeCourse?.id || null,
        lowerThirdId: targetId,
        timestamp: Date.now(),
      });
    },
    [activeCourse?.id, analytics, lowerThirdItems, selectedLowerThirdId, snapshotBeforeChange, tt],
  );

  const runAutoFix = useCallback(() => {
    if (qualityIssues.length === 0) return;
    snapshotBeforeChange(tt('Auto-fiks lower thirds', 'Auto-fix lower thirds'), { force: true });
    const fixed = applyLowerThirdAutoFixes(lowerThirdItems, duration);
    setLowerThirdItems(fixed);
    setSaveMessage(
      tt(
        `Auto-fiks brukte ${qualityIssues.length} justeringer.`,
        `Auto-fix applied ${qualityIssues.length} adjustments.`,
      ),
    );
  }, [duration, lowerThirdItems, qualityIssues.length, snapshotBeforeChange, tt]);

  const applyCurrentLowerThirdsToAllSkills = useCallback(async () => {
    if (effectiveScope !== 'skill' || !activeCourse || !selectedSkill || skillOptions.length <= 1) return;

    const payload = lowerThirdItems.map((item) => normalizeLowerThirdTiming(item, duration));

    try {
      await Promise.all(
        skillOptions.map(async (lesson) => {
          const lessonResources = Array.isArray(lesson.resources) ? lesson.resources : [];
          const skillPrefix = `${LOWER_THIRD_RESOURCE_SKILL_PREFIX}${String(lesson.id)}-`;
          const mappedResources = payload.map((lowerThird) => ({
            id: `${LOWER_THIRD_RESOURCE_SKILL_PREFIX}${String(lesson.id)}-${lowerThird.id}`,
            type: 'link' as const,
            title: `[LowerThird][Skill] ${lowerThird.title}`,
            url: '#',
            description: `${lowerThird.name} · ${formatTime(lowerThird.startTime)} · ${lowerThird.duration.toFixed(1)}s · ${String(lesson.title || '')}`,
          }));
          await updateLesson({
            ...lesson,
            resources: [
              ...lessonResources.filter((resource) => !resource.id.startsWith(skillPrefix)),
              ...mappedResources,
            ],
          });
        }),
      );
      setSaveMessage(
        tt(
          `Lower thirds ble brukt på ${skillOptions.length} ferdigheter.`,
          `Lower thirds applied to ${skillOptions.length} skills.`,
        ),
      );
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : tt('Kunne ikke bruke lower thirds på alle ferdigheter.', 'Could not apply lower thirds to all skills.'),
      );
    }
  }, [
    activeCourse,
    duration,
    effectiveScope,
    lowerThirdItems,
    selectedSkill,
    skillOptions,
    tt,
    updateLesson,
  ]);

  const undoLowerThirds = useCallback(() => {
    if (!canUndo) return;
    undo();
    setSaveMessage(tt('Siste lower third-endring angret.', 'Undid last lower third change.'));
  }, [canUndo, tt, undo]);

  const redoLowerThirds = useCallback(() => {
    if (!canRedo) return;
    redo();
    setSaveMessage(tt('Gjorde om siste lower third-endring.', 'Redid last lower third change.'));
  }, [canRedo, redo, tt]);

  const previewSelectedLowerThird = useCallback(() => {
    if (isPlaying) {
      togglePlayback();
      return;
    }
    const startAt = selectedLowerThird ? selectedLowerThird.startTime : 0;
    seekTo(startAt);
    setPreviewAnimationKey((prev) => prev + 1);
    togglePlayback();
  }, [isPlaying, seekTo, selectedLowerThird, togglePlayback]);

  const toggleStudentPreview = useCallback(() => {
    previewSelectedLowerThird();
  }, [previewSelectedLowerThird]);

  const autoSaveSignature = useMemo(
    () =>
      JSON.stringify({
        scopeStorageKey,
        duration,
        lowerThirdItems,
      }),
    [duration, lowerThirdItems, scopeStorageKey],
  );

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
      const store = readLowerThirdStore();
      const previousEntry = store[scopeStorageKey];
      store[scopeStorageKey] = {
        items: lowerThirdItems.map((item) => normalizeLowerThirdTiming(item, duration)),
        updatedAt: new Date().toISOString(),
        publishedAt: previousEntry?.publishedAt,
      };
      writeLowerThirdStore(store);
      void writeLowerThirdStoreToDb(store);
      lastAutoSavedSignatureRef.current = autoSaveSignature;
      setLastPublishedAt(String(previousEntry?.publishedAt || ''));
      setHasSavedChangesSincePublish(Boolean(previousEntry?.publishedAt));
      markSaved();
    }, 650);

    return () => window.clearTimeout(timer);
  }, [
    autoSaveSignature,
    duration,
    lowerThirdItems,
    markDirty,
    markSaved,
    markSaving,
    scopeStorageKey,
  ]);

  useEffect(() => {
    autoSaveHydratedRef.current = false;
    lastAutoSavedSignatureRef.current = '';
  }, [scopeStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return;

      const lower = event.key.toLowerCase();
      if (lower === 'v') {
        event.preventDefault();
        setEditorMode('select');
        return;
      }
      if (lower === 'e') {
        event.preventDefault();
        setEditorMode('edit');
        return;
      }
      if ((lower === 'backspace' || lower === 'delete') && selectedLowerThird) {
        event.preventDefault();
        removeLowerThird(selectedLowerThird.id);
        return;
      }
      if ((lower === 'arrowleft' || lower === 'arrowright') && selectedLowerThird) {
        event.preventDefault();
        const direction = lower === 'arrowleft' ? -1 : 1;
        const step = event.shiftKey ? 1 : 0.5;
        const start = lowerThirdStartAt(selectedLowerThird);
        const end = lowerThirdEndAt(selectedLowerThird);
        applySelectedTimelineRange(start + direction * step, end + direction * step);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [applySelectedTimelineRange, removeLowerThird, selectedLowerThird]);

  const saveLowerThirdSetup = useCallback(
    async (publish: boolean) => {
      setSaveMessage('');

      const course = activeCourse;
      const skill = selectedSkill;
      const scope = effectiveScope;
      if (scope === 'skill' && !skill) {
        setSaveMessage(tt('Velg en ferdighet før lagring.', 'Select a skill before saving.'));
        return;
      }

      const normalizedLowerThirds = lowerThirdItems.map((lowerThird) =>
        normalizeLowerThirdTiming(lowerThird, duration),
      );

      const payload = {
        courseId: course?.id || null,
        scope,
        lessonId: scope === 'skill' ? skill?.id || null : null,
        instructorId: effectiveInstructor?.id || null,
        lowerThirds: normalizedLowerThirds,
        publish,
      };
      const now = new Date().toISOString();
      let persistedPublishedAt = '';

      try {
        const existing = course
          ? state.courses.find((entry) => entry.id === course.id)
          : undefined;

        if (existing) {
          const lowerThirdResources = normalizedLowerThirds.map((lowerThird) => ({
            id:
              scope === 'skill'
                ? `${LOWER_THIRD_RESOURCE_SKILL_PREFIX}${String(skill?.id || 'unknown')}-${lowerThird.id}`
                : `${LOWER_THIRD_RESOURCE_COURSE_PREFIX}${lowerThird.id}`,
            type: 'link' as const,
            title:
              scope === 'skill'
                ? `[LowerThird][Skill] ${lowerThird.title}`
                : `[LowerThird][Course] ${lowerThird.title}`,
            url: '#',
            description:
              scope === 'skill'
                ? `${lowerThird.name} · ${formatTime(lowerThird.startTime)} · ${lowerThird.duration.toFixed(1)}s · ${String(skill?.title || '')}`
                : `${lowerThird.name} · ${formatTime(lowerThird.startTime)} · ${lowerThird.duration.toFixed(1)}s`,
          }));

          if (scope === 'skill' && skill) {
            const lessonInCourse = existing.lessons.find(
              (lesson) => String(lesson.id) === String(skill.id),
            );
            const lessonResources = Array.isArray(lessonInCourse?.resources)
              ? lessonInCourse.resources
              : [];
            const skillPrefix = `${LOWER_THIRD_RESOURCE_SKILL_PREFIX}${String(skill.id)}-`;
            if (lessonInCourse) {
              await updateLesson({
                ...lessonInCourse,
                resources: [
                  ...lessonResources.filter((resource) => !resource.id.startsWith(skillPrefix)),
                  ...lowerThirdResources,
                ],
              });
            }
          } else {
            const resources = Array.isArray(existing.resources) ? existing.resources : [];
            await updateCourse({
              ...existing,
              isPublished: publish ? true : existing.isPublished,
              tags: Array.from(new Set([...(existing.tags || []), 'lower-thirds'])),
              resources: [
                ...resources.filter(
                  (resource) =>
                    !resource.id.startsWith(LOWER_THIRD_RESOURCE_COURSE_PREFIX) &&
                    !(
                      resource.id.startsWith(LOWER_THIRD_RESOURCE_ID_PREFIX) &&
                      !resource.id.startsWith(LOWER_THIRD_RESOURCE_SKILL_PREFIX)
                    ),
                ),
                ...lowerThirdResources,
              ],
            });
          }
        }

        if (scopeStorageKey) {
          const store = readLowerThirdStore();
          const previousEntry = store[scopeStorageKey];
          persistedPublishedAt = String(previousEntry?.publishedAt || '');
          store[scopeStorageKey] = {
            items: normalizedLowerThirds,
            updatedAt: now,
            publishedAt: publish ? now : persistedPublishedAt || undefined,
          };
          writeLowerThirdStore(store);
          void writeLowerThirdStoreToDb(store);
        }

        onSave?.(payload);
        addVersion(tt('Lagre lower thirds', 'Save lower thirds'), normalizedLowerThirds);
        markSaved();
        if (publish) {
          setLastPublishedAt(now);
          setHasSavedChangesSincePublish(false);
        } else {
          setLastPublishedAt(persistedPublishedAt);
          setHasSavedChangesSincePublish(Boolean(persistedPublishedAt));
        }
        setSaveMessage(
          publish
            ? tt('Lower thirds publisert.', 'Lower thirds published.')
            : scope === 'skill'
              ? tt('Lower thirds lagret for ferdighet.', 'Lower thirds saved for skill.')
              : tt('Lower thirds lagret for kurs.', 'Lower thirds saved for course.'),
        );

        analytics.trackEvent('academy_lower_thirds_saved', {
          courseId: course?.id || null,
          scope,
          lessonId: scope === 'skill' ? skill?.id || null : null,
          instructorId: effectiveInstructor?.id || null,
          lowerThirdCount: normalizedLowerThirds.length,
          publish,
          timestamp: Date.now(),
        });
      } catch (error) {
        setSaveMessage(
          error instanceof Error
            ? error.message
            : tt('Kunne ikke lagre lower thirds.', 'Could not save lower thirds.'),
        );
      }
    },
    [
      activeCourse,
      addVersion,
      analytics,
      duration,
      effectiveInstructor?.id,
      effectiveScope,
      lowerThirdItems,
      markSaved,
      onSave,
      scopeStorageKey,
      selectedSkill,
      state.courses,
      tt,
      updateCourse,
      updateLesson,
    ],
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: '#edf0f7',
        bgcolor: '#06080d',
        fontFamily: '"Manrope", "Segoe UI", sans-serif',
        textRendering: 'optimizeLegibility',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        '--academy-hairline-width': '1px',
        '@media (min-resolution: 2dppx)': {
          '--academy-hairline-width': '1.2px',
        },
        '@media (min-resolution: 3dppx)': {
          '--academy-hairline-width': '1.35px',
        },
        position: 'relative',
        overflow: 'hidden',
        '& .MuiButtonBase-root:focus-visible, & [role="button"]:focus-visible': {
          outline: `2px solid ${NON_TEXT_FOCUS_RING}`,
          outlineOffset: 2,
        },
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
            setLocationWithContext(route);
          }}
          onCreateCourse={() => {
            setLeftNav('curriculum');
            setLocationWithContext('/academy/curriculum?createCompetency=1');
          }}
          tt={tt}
          navLabel={navLabel}
          bottomAction={{
            label: tt('Ny lower third', 'New Lower Third'),
            onClick: addLowerThird,
          }}
        />

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              display: 'contents',
              '& .MuiInputBase-input': {
                fontSize: { xs: 15, sm: 16 },
                lineHeight: 1.35,
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(237,240,247,0.84)',
                fontSize: { xs: 13, sm: 14 },
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: 'rgba(237,240,247,0.94)',
              },
              '& .MuiFormHelperText-root': {
                color: 'rgba(237,240,247,0.74)',
                fontSize: { xs: 12, sm: 13 },
                lineHeight: 1.3,
              },
              '& .MuiFormControlLabel-label': {
                fontSize: { xs: 13, sm: 14 },
                color: 'rgba(237,240,247,0.86)',
              },
              '& .MuiTab-root': {
                fontSize: { xs: 14, sm: 15 },
                fontWeight: 600,
                letterSpacing: '0.01em',
                minHeight: { xs: 42, sm: 46 },
              },
              '& .MuiButton-root': {
                fontSize: { xs: 14, sm: 15 },
                minHeight: { xs: 38, sm: 40 },
              },
              '& .MuiChip-label': {
                fontSize: { xs: 12, sm: 13 },
              },
              '@media (min-width: 2048px)': {
                '& .MuiInputBase-input': {
                  fontSize: 17,
                },
                '& .MuiInputLabel-root': {
                  fontSize: 14.5,
                },
                '& .MuiFormHelperText-root': {
                  fontSize: 13.5,
                },
                '& .MuiFormControlLabel-label': {
                  fontSize: 14.5,
                },
                '& .MuiTab-root': {
                  fontSize: 15.5,
                  minHeight: 48,
                },
                '& .MuiButton-root': {
                  fontSize: 15.5,
                  minHeight: 42,
                },
              },
              '@media (min-width: 3200px)': {
                '& .MuiInputBase-input': {
                  fontSize: 18,
                },
                '& .MuiInputLabel-root': {
                  fontSize: 15,
                },
                '& .MuiFormHelperText-root': {
                  fontSize: 14,
                },
                '& .MuiFormControlLabel-label': {
                  fontSize: 15,
                },
                '& .MuiTab-root': {
                  fontSize: 16,
                  minHeight: 50,
                },
                '& .MuiButton-root': {
                  fontSize: 16,
                  minHeight: 44,
                },
              },
            }}
          />
          <Box
            sx={{
              height: 74,
              px: 3,
              borderBottom: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_DIVIDER}`,
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
                onClick={() => setLocationWithContext('/academy/settings?tab=notifications')}
                aria-label={tt('Varsler', 'Notifications')}
                sx={{ color: 'rgba(237,240,247,0.75)' }}
              >
                <NotificationsNone fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocationWithContext('/academy/settings?tab=messages')}
                aria-label={tt('Meldinger', 'Messages')}
                sx={{ color: 'rgba(237,240,247,0.75)' }}
              >
                <MailOutline fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocationWithContext('/academy/settings?tab=profile')}
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
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 390px' },
              gap: { xs: 1.25, md: 1.6, xl: 2 },
              px: { xs: 1.25, sm: 1.6, lg: 2 },
              py: { xs: 1.25, sm: 1.6, lg: 2 },
              '@media (min-width: 2048px)': {
                gridTemplateColumns: 'minmax(0, 1fr) 430px',
                gap: 2.2,
                px: 2.4,
                py: 2.2,
              },
              '@media (min-width: 2560px)': {
                gridTemplateColumns: 'minmax(0, 1fr) 480px',
                gap: 2.4,
                px: 3,
                py: 2.4,
              },
              '@media (min-width: 3200px)': {
                gridTemplateColumns: 'minmax(0, 1fr) 540px',
                gap: 2.6,
                px: 3.4,
                py: 2.6,
              },
              '@media (min-width: 5120px)': {
                gridTemplateColumns: 'minmax(0, 1fr) 620px',
                gap: 2.8,
                px: 3.8,
                py: 2.8,
              },
            }}
          >
            <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', md: 'center' }}
              >
                <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontSize: 'clamp(1.65rem, 1.3rem + 1.1vw, 2.05rem)', fontWeight: 700, letterSpacing: '0.015em', lineHeight: 1.1 }}>
                    {tt('Lower thirds-studio', 'Lower Thirds Studio')}
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
                      ...LT_NEUTRAL_OUTLINED_BUTTON_SX,
                      color: simpleMode ? '#edf0f7' : '#f8d675',
                      borderColor: simpleMode ? NON_TEXT_BORDER_DEFAULT : 'rgba(248,179,33,0.35)',
                      bgcolor: simpleMode ? 'rgba(255,255,255,0.02)' : 'rgba(248,179,33,0.1)',
                    }}
                  >
                    {simpleMode
                      ? tt('Pro-modus', 'Pro mode')
                      : tt('Tilbake til enkel', 'Back to simple')}
                  </Button>
                  <Tooltip title={tt('Angre (Cmd/Ctrl+Z)', 'Undo (Cmd/Ctrl+Z)')}>
                    <span>
                      <IconButton size="small" onClick={undoLowerThirds} disabled={!canUndo} sx={LT_NEUTRAL_ICON_BUTTON_SX}>
                        <Undo fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={tt('Gjør om (Cmd/Ctrl+Shift+Z)', 'Redo (Cmd/Ctrl+Shift+Z)')}>
                    <span>
                      <IconButton size="small" onClick={redoLowerThirds} disabled={!canRedo} sx={LT_NEUTRAL_ICON_BUTTON_SX}>
                        <Redo fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Button
                    variant="outlined"
                    startIcon={<AutoFixHigh />}
                    disabled={qualityIssues.length === 0}
                    onClick={runAutoFix}
                    sx={LT_WARNING_OUTLINED_BUTTON_SX}
                  >
                    {tt('Auto-fiks', 'Auto-fix')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={isPlaying ? <Visibility /> : <VisibilityOff />}
                    onClick={toggleStudentPreview}
                    sx={{
                      ...LT_NEUTRAL_OUTLINED_BUTTON_SX,
                      borderColor: isPlaying ? 'rgba(248,179,33,0.45)' : NON_TEXT_BORDER_DEFAULT,
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
                    onClick={() => void saveLowerThirdSetup(false)}
                    sx={LT_SAVE_BUTTON_SX}
                  >
                    {tt('Lagre', 'Save')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Publish />}
                    onClick={() => void saveLowerThirdSetup(true)}
                    sx={LT_PUBLISH_BUTTON_SX}
                  >
                    {tt('Publiser', 'Publish')}
                  </Button>
                </Stack>
              </Stack>

              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', md: 'center' }}
                sx={{ ...panelSx, px: 1, py: 0.9 }}
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
                    minWidth: { xs: '100%', md: 250 },
                    color: '#edf0f7',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: NON_TEXT_BORDER_SUBTLE },
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
                  value={lowerThirdScope}
                  onChange={(event) => setLowerThirdScope(event.target.value as LowerThirdScope)}
                  sx={{
                    minWidth: { xs: '100%', md: 150 },
                    color: '#edf0f7',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: NON_TEXT_BORDER_SUBTLE },
                  }}
                >
                  <MenuItem value="course">{tt('Ferdighet', 'Skill')}</MenuItem>
                  <MenuItem value="skill">{tt('Ferdighet', 'Skill')}</MenuItem>
                </Select>
                {lowerThirdScope === 'skill' && (
                  <Select
                    size="small"
                    value={selectedSkill ? String(selectedSkill.id) : ''}
                    onChange={(event) => setSelectedSkillId(String(event.target.value))}
                    displayEmpty
                    disabled={skillOptions.length === 0}
                    sx={{
                      minWidth: { xs: '100%', md: 210 },
                      color: '#edf0f7',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: NON_TEXT_BORDER_SUBTLE },
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
                  value={formatTime(duration)}
                  inputProps={{ readOnly: true }}
                  sx={{
                    width: { xs: '100%', md: 156 },
                    '& .MuiInputBase-root': { color: '#edf0f7' },
                    '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.64)' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: NON_TEXT_BORDER_SUBTLE },
                  }}
                />
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
                  sx={{ ...panelSx, px: 1, py: 0.75 }}
                >
                  <Stack direction="row" spacing={0.4} sx={LT_TOOLBAR_GROUP_SX}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AdsClick />}
                      onClick={() => setEditorMode('select')}
                      sx={{
                        ...LT_NEUTRAL_OUTLINED_BUTTON_SX,
                        minWidth: 0,
                        px: 1,
                        color: editorMode === 'select' ? '#0f0f0f' : '#edf0f7',
                        bgcolor: editorMode === 'select' ? '#f8d675' : 'transparent',
                        borderColor: editorMode === 'select' ? 'rgba(248,179,33,0.52)' : NON_TEXT_BORDER_DEFAULT,
                      }}
                    >
                      {tt('Velg', 'Select')}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Edit />}
                      onClick={() => setEditorMode('edit')}
                      sx={{
                        ...LT_NEUTRAL_OUTLINED_BUTTON_SX,
                        minWidth: 0,
                        px: 1,
                        color: editorMode === 'edit' ? '#0f0f0f' : '#edf0f7',
                        bgcolor: editorMode === 'edit' ? '#f8d675' : 'transparent',
                        borderColor: editorMode === 'edit' ? 'rgba(248,179,33,0.52)' : NON_TEXT_BORDER_DEFAULT,
                      }}
                    >
                      {tt('Rediger', 'Edit')}
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={0.4} sx={LT_TOOLBAR_GROUP_SX}>
                    <Button
                      size="small"
                      startIcon={<CropSquare />}
                      onClick={() => setSafeAreaEnabled((prev) => !prev)}
                      sx={{
                        ...LT_NEUTRAL_OUTLINED_BUTTON_SX,
                        color: safeAreaEnabled ? '#f8d675' : '#edf0f7',
                        borderColor: safeAreaEnabled ? NON_TEXT_ALERT_BORDER : NON_TEXT_BORDER_DEFAULT,
                      }}
                    >
                      {safeAreaEnabled
                        ? tt('Safe area: På', 'Safe area: On')
                        : tt('Safe area: Av', 'Safe area: Off')}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setTimelineSnapEnabled((prev) => !prev)}
                      sx={{
                        ...LT_NEUTRAL_OUTLINED_BUTTON_SX,
                        color: timelineSnapEnabled ? '#f8d675' : '#edf0f7',
                        borderColor: timelineSnapEnabled ? NON_TEXT_ALERT_BORDER : NON_TEXT_BORDER_DEFAULT,
                      }}
                    >
                      {timelineSnapEnabled
                        ? tt('Snap: 0.5s + playhead', 'Snap: 0.5s + playhead')
                        : tt('Snap: Av', 'Snap: Off')}
                    </Button>
                    {effectiveScope === 'skill' && skillOptions.length > 1 && (
                      <Button
                        size="small"
                        onClick={() => {
                          void applyCurrentLowerThirdsToAllSkills();
                        }}
                        sx={LT_WARNING_OUTLINED_BUTTON_SX}
                      >
                        {tt('Bruk på alle ferdigheter', 'Apply to all skills')}
                      </Button>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ ml: { lg: 'auto' } }}>
                    <Chip
                      size="small"
                      icon={<WarningAmber sx={{ fontSize: 16 }} />}
                      label={tt(`${qualityIssues.length} kvalitetssjekker`, `${qualityIssues.length} quality checks`)}
                      sx={{
                        bgcolor:
                          qualityIssues.length === 0
                            ? 'rgba(126,232,179,0.16)'
                            : 'rgba(248,179,33,0.16)',
                        color:
                          qualityIssues.length === 0
                            ? '#9ef1ca'
                            : '#f8d675',
                      }}
                    />
                  </Stack>
                </Stack>
              ) : (
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={0.8}
                  alignItems={{ xs: 'stretch', lg: 'center' }}
                  sx={{ ...panelSx, px: 1, py: 0.75 }}
                >
                  <Stack direction="row" spacing={0.4} sx={LT_TOOLBAR_GROUP_SX}>
                    <Button
                      size="small"
                      startIcon={<CropSquare />}
                      onClick={() => setSafeAreaEnabled((prev) => !prev)}
                      sx={{
                        ...LT_NEUTRAL_OUTLINED_BUTTON_SX,
                        color: safeAreaEnabled ? '#f8d675' : '#edf0f7',
                        borderColor: safeAreaEnabled ? NON_TEXT_ALERT_BORDER : NON_TEXT_BORDER_DEFAULT,
                      }}
                    >
                      {safeAreaEnabled
                        ? tt('Safe area: På', 'Safe area: On')
                        : tt('Safe area: Av', 'Safe area: Off')}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setTimelineSnapEnabled((prev) => !prev)}
                      sx={{
                        ...LT_NEUTRAL_OUTLINED_BUTTON_SX,
                        color: timelineSnapEnabled ? '#f8d675' : '#edf0f7',
                        borderColor: timelineSnapEnabled ? NON_TEXT_ALERT_BORDER : NON_TEXT_BORDER_DEFAULT,
                      }}
                    >
                      {timelineSnapEnabled
                        ? tt('Snap: 0.5s + playhead', 'Snap: 0.5s + playhead')
                        : tt('Snap: Av', 'Snap: Off')}
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ ml: { lg: 'auto' } }}>
                    <Chip
                      size="small"
                      icon={<WarningAmber sx={{ fontSize: 16 }} />}
                      label={tt(`${qualityIssues.length} kvalitetssjekker`, `${qualityIssues.length} quality checks`)}
                      sx={{
                        bgcolor:
                          qualityIssues.length === 0
                            ? 'rgba(126,232,179,0.16)'
                            : 'rgba(248,179,33,0.16)',
                        color:
                          qualityIssues.length === 0
                            ? '#9ef1ca'
                            : '#f8d675',
                      }}
                    />
                  </Stack>
                </Stack>
              )}

              {!!saveMessage && (
                <Typography
                  sx={{
                    px: 1.2,
                    py: 0.8,
                    borderRadius: 1,
                    border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_ALERT_BORDER}`,
                    background: 'rgba(248,179,33,0.08)',
                    color: '#f8d56f',
                  }}
                >
                  {saveMessage}
                </Typography>
              )}

              <Box sx={{ ...panelSx, p: 1.1 }}>
                <AcademyPlayerStudio
                  src={effectiveVideoUrl}
                  videoRef={videoRef}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  containerSx={{
                    borderRadius: 1.1,
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                    position: 'relative',
                    aspectRatio: '16 / 9',
                    background:
                      'radial-gradient(circle at 72% 18%, rgba(248,179,33,0.4), rgba(8,12,19,0) 46%), radial-gradient(circle at 28% 28%, rgba(78,118,195,0.2), rgba(8,12,19,0) 44%), linear-gradient(140deg, rgba(15,23,34,0.95), rgba(8,12,19,0.95))',
                  }}
                >
                  {safeAreaEnabled && selectedSafeGuideInsets && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 1,
                        pointerEvents: 'none',
                      }}
                    >
                      {selectedSafeGuideInsets.showCenterLines && (
                        <>
                          <Box
                            sx={{
                              position: 'absolute',
                              left: '50%',
                              top: 0,
                              bottom: 0,
                              width: Math.max(selectedSafeGuideInsets.thickness, 1.4),
                              transform: 'translateX(-50%)',
                              backgroundColor: alpha(
                                selectedSafeGuideInsets.color,
                                Math.max(
                                  SAFE_GUIDE_CENTER_LINE_MIN_ALPHA,
                                  selectedSafeGuideInsets.opacity * 0.62,
                                ),
                              ),
                              boxShadow: `0 0 0 1px ${alpha('#05080d', 0.45)}`,
                            }}
                          />
                          <Box
                            sx={{
                              position: 'absolute',
                              top: '50%',
                              left: 0,
                              right: 0,
                              height: Math.max(selectedSafeGuideInsets.thickness, 1.4),
                              transform: 'translateY(-50%)',
                              backgroundColor: alpha(
                                selectedSafeGuideInsets.color,
                                Math.max(
                                  SAFE_GUIDE_CENTER_LINE_MIN_ALPHA,
                                  selectedSafeGuideInsets.opacity * 0.62,
                                ),
                              ),
                              boxShadow: `0 0 0 1px ${alpha('#05080d', 0.45)}`,
                            }}
                          />
                        </>
                      )}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: `${selectedSafeGuideInsets.action.top}%`,
                          right: `${selectedSafeGuideInsets.action.right}%`,
                          bottom: `${selectedSafeGuideInsets.action.bottom}%`,
                          left: `${selectedSafeGuideInsets.action.left}%`,
                          border: `${Math.max(1.2, selectedSafeGuideInsets.thickness)}px dashed ${alpha(
                            selectedSafeGuideInsets.color,
                            Math.max(
                              SAFE_GUIDE_ACTION_BORDER_MIN_ALPHA,
                              selectedSafeGuideInsets.opacity * 0.72,
                            ),
                          )}`,
                          borderRadius: 0.9,
                          boxShadow: `inset 0 0 0 1px ${alpha('#05080d', 0.72)}`,
                        }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          top: `${selectedSafeGuideInsets.title.top}%`,
                          right: `${selectedSafeGuideInsets.title.right}%`,
                          bottom: `${selectedSafeGuideInsets.title.bottom}%`,
                          left: `${selectedSafeGuideInsets.title.left}%`,
                          border: `${selectedSafeGuideInsets.thickness}px dashed ${alpha(selectedSafeGuideInsets.color, selectedSafeGuideInsets.opacity * 0.8)}`,
                          borderRadius: 0.9,
                          boxShadow: `inset 0 0 0 1px ${alpha('#05080d', 0.65)}`,
                        }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          top: `${selectedSafeGuideInsets.active.top}%`,
                          right: `${selectedSafeGuideInsets.active.right}%`,
                          bottom: `${selectedSafeGuideInsets.active.bottom}%`,
                          left: `${selectedSafeGuideInsets.active.left}%`,
                          border: `${Math.max(1.2, selectedSafeGuideInsets.thickness + 0.4)}px solid ${alpha(selectedSafeGuideInsets.color, selectedSafeGuideInsets.opacity)}`,
                          borderRadius: 1,
                          boxShadow: `0 0 0 1px ${alpha(selectedSafeGuideInsets.color, selectedSafeGuideInsets.opacity * 0.4)} inset, 0 0 14px ${alpha(selectedSafeGuideInsets.color, selectedSafeGuideInsets.opacity * 0.42)}`,
                        }}
                      />
                      <Typography
                        sx={{
                          position: 'absolute',
                          top: 10,
                          left: 10,
                          px: 0.7,
                          py: 0.3,
                          borderRadius: 0.7,
                          border: `${selectedSafeGuideInsets.thickness}px solid ${alpha(selectedSafeGuideInsets.color, selectedSafeGuideInsets.opacity)}`,
                          bgcolor: 'rgba(8,12,20,0.72)',
                          color: alpha('#fdf4ca', 0.96),
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                          textTransform: 'uppercase',
                          display: selectedSafeGuideInsets.showLabels ? 'inline-flex' : 'none',
                        }}
                      >
                        {selectedSafeGuideInsets.type === 'title-safe'
                          ? tt('Tittel-safe', 'Title Safe')
                          : selectedSafeGuideInsets.type === 'action-safe'
                            ? tt('Action-safe', 'Action Safe')
                            : tt('Egendefinert safe', 'Custom Safe')}
                      </Typography>
                      <Typography
                        sx={{
                          position: 'absolute',
                          right: 10,
                          top: 10,
                          px: 0.7,
                          py: 0.3,
                          borderRadius: 0.7,
                          border: `${selectedSafeGuideInsets.thickness}px solid ${alpha(selectedSafeGuideInsets.color, selectedSafeGuideInsets.opacity * 0.8)}`,
                          bgcolor: 'rgba(8,12,20,0.68)',
                          color: alpha('#f7f8fb', 0.92),
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: '0.01em',
                          textTransform: 'uppercase',
                          display: selectedSafeGuideInsets.showLabels ? 'inline-flex' : 'none',
                        }}
                      >
                        {tt('Action + Tittel', 'Action + Title')}
                      </Typography>
                    </Box>
                  )}
                  {selectedLowerThird && showLowerThirdDraftPreview && (
                    <Box
                      key={previewAnimationKey}
                      sx={{
                        zIndex: 2,
                        position: 'absolute',
                        left:
                          selectedLowerThird.position === 'bottom-left' ||
                          selectedLowerThird.position === 'top-left'
                            ? selectedLowerThird.safeGuides.snapToSafe && selectedSafeGuideInsets
                              ? `${selectedSafeGuideInsets.active.left}%`
                              : 24
                            : selectedLowerThird.position === 'bottom-center' ||
                                selectedLowerThird.position === 'top-center'
                              ? '50%'
                              : 'auto',
                        right:
                          selectedLowerThird.position === 'bottom-right' ||
                          selectedLowerThird.position === 'top-right'
                            ? selectedLowerThird.safeGuides.snapToSafe && selectedSafeGuideInsets
                              ? `${selectedSafeGuideInsets.active.right}%`
                              : 24
                            : 'auto',
                        transform:
                          selectedLowerThird.position === 'bottom-center' ||
                          selectedLowerThird.position === 'top-center'
                            ? 'translateX(-50%)'
                            : 'none',
                        bottom:
                          selectedLowerThird.position.includes('bottom')
                            ? selectedLowerThird.safeGuides.snapToSafe && selectedSafeGuideInsets
                              ? `${selectedSafeGuideInsets.active.bottom}%`
                              : 24
                            : 'auto',
                        top:
                          selectedLowerThird.position.includes('top')
                            ? selectedLowerThird.safeGuides.snapToSafe && selectedSafeGuideInsets
                              ? `${selectedSafeGuideInsets.active.top}%`
                              : 24
                            : 'auto',
                        width: `${clamp(selectedLowerThird.style.widthPercent ?? 56, 20, 95)}%`,
                      }}
                    >
                      <Box
                        sx={{
                        borderRadius: `${selectedLowerThird.style.borderRadius}px`,
                        border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_DEFAULT}`,
                        background: selectedLowerThird.style.background,
                        color: selectedLowerThird.style.text,
                        p: `${selectedLowerThird.style.padding}px`,
                        scale: selectedLowerThird.style.scale,
                        transformOrigin: selectedLowerThird.position.includes('right')
                          ? 'right center'
                          : selectedLowerThird.position.includes('center')
                            ? 'center center'
                            : 'left center',
                        boxShadow: '0 18px 34px rgba(0,0,0,0.45)',
                        animation: `${lowerThirdAnimationKeyframes[selectedLowerThird.animation]} ${selectedLowerThirdAnimationDuration}s ${selectedLowerThirdAnimationTiming} both`,
                        willChange: 'transform, opacity',
                        opacity: activeLowerThirdVisible ? selectedLowerThird.style.opacity : 0.9,
                      }}
                    >
                      {!activeLowerThirdVisible && (
                        <Chip
                          size="small"
                          label={tt('Live draft', 'Live draft')}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 2,
                            bgcolor: 'rgba(248,179,33,0.2)',
                            color: '#f8d675',
                          }}
                        />
                      )}
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 6,
                          top: 8,
                          bottom: 8,
                          width: 4,
                          borderRadius: 1,
                          bgcolor: selectedLowerThird.style.accent,
                        }}
                      />
                      <Stack sx={{ pl: 1.1 }}>
                        <Typography
                          contentEditable={editorMode === 'edit'}
                          suppressContentEditableWarning
                          onBlur={(event) => {
                            if (editorMode !== 'edit') return;
                            setSelectedLowerThirdField('title', event.currentTarget.textContent || '');
                          }}
                          sx={{
                            fontSize: `clamp(1.25rem, 0.9rem + 1.4vw, ${selectedLowerThird.style.fontSize + 14}px)`,
                            lineHeight: 1.05,
                            fontFamily: 'Barlow Condensed, sans-serif',
                            outline: 'none',
                            borderRadius: 0.6,
                            px: editorMode === 'edit' ? 0.3 : 0,
                            py: editorMode === 'edit' ? 0.1 : 0,
                            border:
                              editorMode === 'edit'
                                ? `1px dashed ${alpha('#f8d675', 0.42)}`
                                : 'none',
                          }}
                        >
                          {selectedLowerThird.title}
                        </Typography>
                        <Typography
                          contentEditable={editorMode === 'edit'}
                          suppressContentEditableWarning
                          onBlur={(event) => {
                            if (editorMode !== 'edit') return;
                            setSelectedLowerThirdField('subtitle', event.currentTarget.textContent || '');
                          }}
                          sx={{
                            mt: 0.2,
                            color: alpha(selectedLowerThird.style.text, 0.88),
                            fontSize: `clamp(0.85rem, 0.7rem + 0.8vw, ${selectedLowerThird.style.fontSize + 6}px)`,
                            outline: 'none',
                            borderRadius: 0.6,
                            px: editorMode === 'edit' ? 0.3 : 0,
                            py: editorMode === 'edit' ? 0.1 : 0,
                            border:
                              editorMode === 'edit'
                                ? `1px dashed ${alpha('#f8d675', 0.42)}`
                                : 'none',
                          }}
                        >
                          {selectedLowerThird.subtitle}
                        </Typography>
                      </Stack>
                    </Box>
                    </Box>
                  )}
                </AcademyPlayerStudio>

                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                  <IconButton size="small" sx={{ color: '#edf0f7' }} onClick={togglePlayback}>
                    {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                  </IconButton>
                  <Typography sx={{ color: 'rgba(237,240,247,0.76)', minWidth: 74 }}>{formatTime(currentTime)}</Typography>
                  <Slider
                    value={currentTime}
                    min={0}
                    max={duration}
                    onChange={(_, value) => {
                      const next = Array.isArray(value) ? value[0] : value;
                      seekTo(next);
                    }}
                    sx={{
                      color: '#f8b321',
                      '& .MuiSlider-thumb': {
                        width: 11,
                        height: 11,
                      },
                    }}
                  />
                </Stack>
                {selectedLowerThird && (
                  <Stack spacing={0.7} sx={{ mt: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ ...LT_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.86)' }}>
                        {tt('Lower third-vindu', 'Lower third window')}
                      </Typography>
                      <Typography sx={{ ...LT_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.72)' }}>
                        {formatTime(lowerThirdStartAt(selectedLowerThird))} - {formatTime(lowerThirdEndAt(selectedLowerThird))}
                      </Typography>
                    </Stack>
                    <Slider
                      value={[lowerThirdStartAt(selectedLowerThird), lowerThirdEndAt(selectedLowerThird)]}
                      min={0}
                      max={duration}
                      step={timelineSnapEnabled ? SNAP_INTERVAL_SECONDS : 0.1}
                      onChange={(_, value) => {
                        const [nextStart, nextEnd] = Array.isArray(value)
                          ? value
                          : [lowerThirdStartAt(selectedLowerThird), lowerThirdEndAt(selectedLowerThird)];
                        applySelectedTimelineRange(nextStart, nextEnd);
                      }}
                      sx={{
                        color: '#f8b321',
                        '& .MuiSlider-thumb': {
                          width: 12,
                          height: 12,
                        },
                      }}
                    />
                  </Stack>
                )}
              </Box>

              <Box sx={{ ...panelSx, p: 1.1 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
                  <Typography sx={{ fontSize: 'clamp(1.2rem, 1rem + 0.75vw, 1.55rem)', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1.1 }}>
                    {tt('Lower thirds-studio', 'Lower Thirds Studio')}
                  </Typography>
                  <Switch
                    size="small"
                    checked={selectedLowerThird?.enabled || false}
                    onChange={(event) => setSelectedLowerThirdField('enabled', event.target.checked)}
                  />
                  <Chip
                    size="small"
                    label={selectedLowerThird?.animation || 'slide-up'}
                    sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                  />
                </Stack>

                <Tabs
                  value={editorTab}
                  onChange={(_, value: EditorTab) => setEditorTab(value)}
                  variant="scrollable"
                  allowScrollButtonsMobile
                  scrollButtons="auto"
                  textColor="inherit"
                  sx={{
                    mb: 1,
                    '& .MuiTabs-indicator': { backgroundColor: '#f8b321' },
                    '& .MuiTab-root': { color: 'rgba(237,240,247,0.7)', textTransform: 'none', minHeight: 40 },
                    '& .Mui-selected': { color: '#f7f8fb' },
                  }}
                >
                  <Tab value="content" label={tt('Innhold', 'Content')} />
                  <Tab value="style" label={tt('Design', 'Design')} />
                  <Tab value="animation" label={tt('Animasjon', 'Animation')} />
                  <Tab value="safe-guides" label={tt('Safe guides', 'Safe Guides')} />
                </Tabs>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 290px' },
                    gap: 1.1,
                    '@media (min-width: 2048px)': {
                      gridTemplateColumns: 'minmax(0, 1fr) 330px',
                    },
                    '@media (min-width: 3200px)': {
                      gridTemplateColumns: 'minmax(0, 1fr) 380px',
                    },
                  }}
                >
                  <Box sx={{ ...panelSx, p: 1 }}>
                    {editorTab === 'content' && selectedLowerThird && (
                      <Stack spacing={1}>
                        <Box sx={LT_EDITOR_SECTION_CARD_SX}>
                          <Typography sx={LT_SECTION_LABEL_SX}>{tt('Innhold', 'Content')}</Typography>
                          <TextField
                            size="small"
                            label={tt('Navn', 'Name')}
                            value={selectedLowerThird.name}
                            onChange={(event) => setSelectedLowerThirdField('name', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            size="small"
                            label={tt('Tittel', 'Title')}
                            value={selectedLowerThird.title}
                            onChange={(event) => setSelectedLowerThirdField('title', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            size="small"
                            label={tt('Undertittel', 'Subtitle')}
                            value={selectedLowerThird.subtitle}
                            onChange={(event) => setSelectedLowerThirdField('subtitle', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                        </Box>
                        <Box sx={LT_EDITOR_SECTION_CARD_SX}>
                          <Typography sx={LT_SECTION_LABEL_SX}>{tt('Timing', 'Timing')}</Typography>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
                            <TextField
                              size="small"
                              type="number"
                              label={tt('Start (sek)', 'Start (sec)')}
                              value={selectedLowerThird.startTime}
                              onChange={(event) =>
                                setSelectedLowerThirdField('startTime', Math.max(0, Number(event.target.value) || 0))
                              }
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                            <TextField
                              size="small"
                              type="number"
                              label={tt('Varighet (sek)', 'Duration (sec)')}
                              value={selectedLowerThird.duration}
                              onChange={(event) =>
                                setSelectedLowerThirdField('duration', Math.max(0.5, Number(event.target.value) || 0))
                              }
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                          </Stack>
                        </Box>
                      </Stack>
                    )}

                    {editorTab === 'style' && selectedLowerThird && (
                      <Stack spacing={1}>
                        <Box sx={LT_EDITOR_SECTION_CARD_SX}>
                          <Typography sx={LT_SECTION_LABEL_SX}>{tt('Stil', 'Style')}</Typography>
                          <TextField
                            size="small"
                            label={tt('Bakgrunn', 'Background')}
                            value={selectedLowerThird.style.background}
                            onChange={(event) => setSelectedLowerThirdStyleField('background', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            size="small"
                            label={tt('Tekstfarge', 'Text Color')}
                            value={selectedLowerThird.style.text}
                            onChange={(event) => setSelectedLowerThirdStyleField('text', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            size="small"
                            label={tt('Aksentfarge', 'Accent Color')}
                            value={selectedLowerThird.style.accent}
                            onChange={(event) => setSelectedLowerThirdStyleField('accent', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                        </Box>
                        <Box sx={LT_EDITOR_SECTION_CARD_SX}>
                          <Typography sx={LT_SECTION_LABEL_SX}>{tt('Størrelse og plass', 'Size and layout')}</Typography>
                          <Typography sx={LT_FIELD_LABEL_SX}>{tt('Opasitet', 'Opacity')}</Typography>
                          <Slider
                            value={selectedLowerThird.style.opacity}
                            min={0.2}
                            max={1}
                            step={0.01}
                            onChange={(_, value) => {
                              const next = Array.isArray(value) ? value[0] : value;
                              setSelectedLowerThirdStyleField('opacity', next);
                            }}
                            sx={{ color: '#f8b321' }}
                          />
                          <Typography sx={LT_FIELD_LABEL_SX}>
                            {tt('Bredde', 'Width')} {Math.round(clamp(selectedLowerThird.style.widthPercent ?? 56, 20, 95))}%
                          </Typography>
                          <Slider
                            value={clamp(selectedLowerThird.style.widthPercent ?? 56, 20, 95)}
                            min={20}
                            max={95}
                            step={1}
                            onChange={(_, value) => {
                              const next = Array.isArray(value) ? value[0] : value;
                              setSelectedLowerThirdStyleField('widthPercent', next);
                            }}
                            sx={{ color: '#f8b321' }}
                          />
                          <Typography sx={LT_FIELD_LABEL_SX}>
                            {tt('Størrelse', 'Size')} {Math.round(selectedLowerThird.style.scale * 100)}%
                          </Typography>
                          <Slider
                            value={selectedLowerThird.style.scale}
                            min={0.7}
                            max={1.6}
                            step={0.05}
                            onChange={(_, value) => {
                              const next = Array.isArray(value) ? value[0] : value;
                              setSelectedLowerThirdStyleField('scale', next);
                            }}
                            sx={{ color: '#f8b321' }}
                          />
                          <Typography sx={LT_FIELD_LABEL_SX}>{tt('Skriftstørrelse', 'Font Size')}</Typography>
                          <Slider
                            value={selectedLowerThird.style.fontSize}
                            min={11}
                            max={28}
                            step={1}
                            onChange={(_, value) => {
                              const next = Array.isArray(value) ? value[0] : value;
                              setSelectedLowerThirdStyleField('fontSize', next);
                            }}
                            sx={{ color: '#f8b321' }}
                          />
                        </Box>
                      </Stack>
                    )}

                    {editorTab === 'animation' && selectedLowerThird && (
                      <Box sx={LT_EDITOR_SECTION_CARD_SX}>
                        <Typography sx={LT_SECTION_LABEL_SX}>{tt('Animasjon', 'Animation')}</Typography>
                        <Stack spacing={0.8}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
                            <Select
                              size="small"
                            value={selectedLowerThird.animation}
                            onChange={(event) =>
                              setSelectedLowerThirdField('animation', event.target.value as LowerThirdAnimation)
                            }
                            sx={{
                              flex: 1,
                              color: '#edf0f7',
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: NON_TEXT_BORDER_SUBTLE },
                            }}
                          >
                            <MenuItem value="slide-up">{tt('Skyv opp', 'Slide Up')}</MenuItem>
                            <MenuItem value="slide-down">{tt('Skyv ned', 'Slide Down')}</MenuItem>
                            <MenuItem value="slide-left">{tt('Skyv venstre', 'Slide Left')}</MenuItem>
                            <MenuItem value="slide-right">{tt('Skyv høyre', 'Slide Right')}</MenuItem>
                            <MenuItem value="fade-in">{tt('Ton inn', 'Fade In')}</MenuItem>
                            <MenuItem value="zoom-in">{tt('Zoom inn', 'Zoom In')}</MenuItem>
                          </Select>
                          <Select
                            size="small"
                            value={selectedLowerThird.position}
                            onChange={(event) =>
                              setSelectedLowerThirdField('position', event.target.value as LowerThirdPosition)
                            }
                            sx={{
                              flex: 1,
                              color: '#edf0f7',
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: NON_TEXT_BORDER_SUBTLE },
                            }}
                          >
                            <MenuItem value="bottom-left">{tt('Nede venstre', 'Bottom Left')}</MenuItem>
                            <MenuItem value="bottom-center">{tt('Nede midt', 'Bottom Center')}</MenuItem>
                            <MenuItem value="bottom-right">{tt('Nede høyre', 'Bottom Right')}</MenuItem>
                            <MenuItem value="top-left">{tt('Oppe venstre', 'Top Left')}</MenuItem>
                            <MenuItem value="top-center">{tt('Oppe midt', 'Top Center')}</MenuItem>
                            <MenuItem value="top-right">{tt('Oppe høyre', 'Top Right')}</MenuItem>
                          </Select>
                        </Stack>
                        <Typography sx={LT_FIELD_LABEL_SX}>
                          {tt('Animasjonsvarighet', 'Animation Duration')}: {selectedLowerThird.animationDuration.toFixed(2)}s
                        </Typography>
                        <Slider
                          value={selectedLowerThird.animationDuration}
                          min={0.2}
                          max={2.5}
                          step={0.05}
                          onChange={(_, value) => {
                            const next = Array.isArray(value) ? value[0] : value;
                            setSelectedLowerThirdField('animationDuration', next);
                          }}
                          sx={{ color: '#89b5d8' }}
                        />
                        <Typography sx={LT_FIELD_LABEL_SX}>
                          {tt('Varighet', 'Duration')}: {selectedLowerThird.duration.toFixed(1)}s
                        </Typography>
                        <Slider
                          value={selectedLowerThird.duration}
                          min={1}
                          max={8}
                          step={0.1}
                          onChange={(_, value) => {
                            const next = Array.isArray(value) ? value[0] : value;
                            setSelectedLowerThirdField('duration', next);
                          }}
                          sx={{ color: '#f8b321' }}
                        />
                        <Typography sx={LT_FIELD_LABEL_SX}>
                          {tt('Forsinkelse', 'Delay')}: {selectedLowerThird.delay.toFixed(1)}s
                        </Typography>
                        <Slider
                          value={selectedLowerThird.delay}
                          min={0}
                          max={4}
                          step={0.1}
                          onChange={(_, value) => {
                            const next = Array.isArray(value) ? value[0] : value;
                            setSelectedLowerThirdField('delay', next);
                          }}
                          sx={{ color: '#89b5d8' }}
                        />
                        </Stack>
                      </Box>
                    )}

                    {editorTab === 'safe-guides' && selectedLowerThird && (
                      <Stack spacing={1}>
                        <Box sx={LT_EDITOR_SECTION_CARD_SX}>
                          <Typography sx={LT_SECTION_LABEL_SX}>{tt('Safe guides', 'Safe guides')}</Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Switch
                              size="small"
                              checked={selectedLowerThird.safeGuides.enabled}
                              onChange={(event) => setSelectedLowerThirdSafeField('enabled', event.target.checked)}
                            />
                            <Typography sx={{ color: 'rgba(237,240,247,0.78)' }}>
                              {tt('Aktiver safe guides', 'Enable Safe Guides')}
                            </Typography>
                          </Stack>
                          <Select
                            size="small"
                            value={selectedLowerThird.safeGuides.type}
                            onChange={(event) =>
                              setSelectedLowerThirdSafeField(
                                'type',
                                event.target.value as LowerThirdItem['safeGuides']['type'],
                              )
                            }
                            sx={{
                              color: '#edf0f7',
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: NON_TEXT_BORDER_SUBTLE },
                            }}
                          >
                            <MenuItem value="title-safe">{tt('Tittel-safe', 'Title Safe')}</MenuItem>
                            <MenuItem value="action-safe">{tt('Action-safe', 'Action Safe')}</MenuItem>
                            <MenuItem value="custom">{tt('Egendefinert', 'Custom')}</MenuItem>
                          </Select>
                          {selectedSafeGuideFit && (
                            <Chip
                              size="small"
                              label={
                                selectedSafeGuideFit.fits
                                  ? tt('Innenfor trygg sone', 'Inside Safe Area')
                                  : tt('Utenfor trygg sone', 'Outside Safe Area')
                              }
                              sx={{
                                alignSelf: 'flex-start',
                                bgcolor: selectedSafeGuideFit.fits ? 'rgba(126,234,142,0.18)' : 'rgba(248,179,33,0.18)',
                                color: selectedSafeGuideFit.fits ? '#9af3a8' : '#f8d56f',
                                border: `var(--academy-hairline-width, 1px) solid ${
                                  selectedSafeGuideFit.fits ? 'rgba(126,234,142,0.6)' : 'rgba(248,179,33,0.68)'
                                }`,
                              }}
                            />
                          )}
                        </Box>
                        <Box sx={LT_EDITOR_SECTION_CARD_SX}>
                          <Typography sx={LT_SECTION_LABEL_SX}>{tt('Marginer og visning', 'Margins and display')}</Typography>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
                            <TextField
                              size="small"
                              type="number"
                              label={tt('Topp %', 'Top %')}
                              value={selectedLowerThird.safeGuides.marginTop}
                              onChange={(event) =>
                                setSelectedLowerThirdSafeField('marginTop', Math.max(0, Number(event.target.value) || 0))
                              }
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                            <TextField
                              size="small"
                              type="number"
                              label={tt('Høyre %', 'Right %')}
                              value={selectedLowerThird.safeGuides.marginRight}
                              onChange={(event) =>
                                setSelectedLowerThirdSafeField(
                                  'marginRight',
                                  Math.max(0, Number(event.target.value) || 0),
                                )
                              }
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                          </Stack>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
                            <TextField
                              size="small"
                              type="number"
                              label={tt('Bunn %', 'Bottom %')}
                              value={selectedLowerThird.safeGuides.marginBottom}
                              onChange={(event) =>
                                setSelectedLowerThirdSafeField(
                                  'marginBottom',
                                  Math.max(0, Number(event.target.value) || 0),
                                )
                              }
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                            <TextField
                              size="small"
                              type="number"
                              label={tt('Venstre %', 'Left %')}
                              value={selectedLowerThird.safeGuides.marginLeft}
                              onChange={(event) =>
                                setSelectedLowerThirdSafeField(
                                  'marginLeft',
                                  Math.max(0, Number(event.target.value) || 0),
                                )
                              }
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                          </Stack>
                          <TextField
                            size="small"
                            label={tt('Guide-farge', 'Guide Color')}
                            value={selectedLowerThird.safeGuides.color || '#f8b321'}
                            onChange={(event) => setSelectedLowerThirdSafeField('color', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <Typography sx={LT_FIELD_LABEL_SX}>
                            {tt('Guide-opasitet', 'Guide Opacity')} {Math.round((selectedLowerThird.safeGuides.opacity ?? 0.82) * 100)}%
                          </Typography>
                          <Slider
                            value={selectedLowerThird.safeGuides.opacity ?? 0.82}
                            min={0.2}
                            max={1}
                            step={0.05}
                            onChange={(_, value) => {
                              const next = Array.isArray(value) ? value[0] : value;
                              setSelectedLowerThirdSafeField('opacity', next);
                            }}
                            sx={{ color: '#f8b321' }}
                          />
                          <Typography sx={LT_FIELD_LABEL_SX}>
                            {tt('Guide-tykkelse', 'Guide Thickness')} {(selectedLowerThird.safeGuides.thickness ?? 1.2).toFixed(1)}px
                          </Typography>
                          <Slider
                            value={selectedLowerThird.safeGuides.thickness ?? 1.2}
                            min={1}
                            max={4}
                            step={0.2}
                            onChange={(_, value) => {
                              const next = Array.isArray(value) ? value[0] : value;
                              setSelectedLowerThirdSafeField('thickness', next);
                            }}
                            sx={{ color: '#89b5d8' }}
                          />
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Switch
                                size="small"
                                checked={selectedLowerThird.safeGuides.showLabels !== false}
                                onChange={(event) => setSelectedLowerThirdSafeField('showLabels', event.target.checked)}
                              />
                              <Typography sx={{ color: 'rgba(237,240,247,0.78)' }}>
                                {tt('Vis labels', 'Show Labels')}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Switch
                                size="small"
                                checked={selectedLowerThird.safeGuides.showCenterLines !== false}
                                onChange={(event) => setSelectedLowerThirdSafeField('showCenterLines', event.target.checked)}
                              />
                              <Typography sx={{ color: 'rgba(237,240,247,0.78)' }}>
                                {tt('Vis senterlinjer', 'Show Center Lines')}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Switch
                                size="small"
                                checked={selectedLowerThird.safeGuides.snapToSafe === true}
                                onChange={(event) => {
                                  setSelectedLowerThirdSafeField('snapToSafe', event.target.checked);
                                  if (event.target.checked) snapSelectedLowerThirdToSafeZone();
                                }}
                              />
                              <Typography sx={{ color: 'rgba(237,240,247,0.78)' }}>
                                {tt('Snap til trygg sone', 'Snap to Safe Zone')}
                              </Typography>
                            </Stack>
                          </Stack>
                          {selectedSafeGuideFit && !selectedSafeGuideFit.fits && (
                            <Button
                              variant="outlined"
                              onClick={snapSelectedLowerThirdToSafeZone}
                              sx={{
                                alignSelf: 'flex-start',
                                textTransform: 'none',
                                borderColor: NON_TEXT_ALERT_BORDER,
                                color: '#f8d56f',
                              }}
                            >
                              {tt('Snap nå', 'Snap Now')}
                            </Button>
                          )}
                        </Box>
                      </Stack>
                    )}
                  </Box>

                  <Box sx={{ ...panelSx, p: 1 }}>
                    <TextField
                      size="small"
                      placeholder={tt('Søk lower thirds...', 'Search lower thirds...')}
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search sx={{ color: 'rgba(237,240,247,0.5)' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        mb: 0.9,
                        '& .MuiInputBase-root': {
                          color: '#edf0f7',
                          bgcolor: 'rgba(10,13,20,0.7)',
                        },
                      }}
                    />

                    <Stack spacing={0.7}>
                      {filteredLowerThirds.map((lowerThird) => {
                        const active = selectedLowerThirdId === lowerThird.id;
                        return (
                          <Button
                            key={lowerThird.id}
                            onClick={() => setSelectedLowerThirdId(lowerThird.id)}
                            sx={{
                              justifyContent: 'space-between',
                              textTransform: 'none',
                              color: '#edf0f7',
                              borderRadius: 1,
                              border: active
                                ? `var(--academy-hairline-width, 1px) solid ${NON_TEXT_ALERT_BORDER}`
                                : `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_STRONG}`,
                              background: active
                                ? 'linear-gradient(90deg, rgba(248,179,33,0.18), rgba(248,179,33,0.04))'
                                : 'rgba(255,255,255,0.02)',
                            }}
                          >
                            <Stack direction="row" spacing={0.8} alignItems="center">
                              <Subtitles fontSize="small" sx={{ color: '#f8d56f' }} />
                              <Typography noWrap>{lowerThird.name}</Typography>
                            </Stack>
                            <Chip
                              size="small"
                              label={`${lowerThird.duration.toFixed(1)}s`}
                              sx={{ bgcolor: 'rgba(255,255,255,0.09)', color: '#edf0f7' }}
                            />
                          </Button>
                        );
                      })}
                    </Stack>

                    <Stack direction="row" spacing={0.7} sx={{ mt: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => removeLowerThird()}
                        sx={{
                          color: '#edf0f7',
                          border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_DEFAULT}`,
                          '&:hover': {
                            color: '#ff8b8b',
                            borderColor: NON_TEXT_DANGER_BORDER,
                          },
                        }}
                        aria-label={tt('Slett lower third', 'Delete lower third')}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Box>
                </Box>

                <Button
                  startIcon={<Add />}
                  onClick={addLowerThird}
                  sx={{
                    mt: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_DEFAULT}`,
                  }}
                >
                  {tt('Ny lower third', 'New Lower Third')}
                </Button>
              </Box>
            </Box>

            <Box sx={{ ...panelSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Tabs
                value={rightTab}
                onChange={(_, value: RightTab) => setRightTab(value)}
                variant="scrollable"
                allowScrollButtonsMobile
                scrollButtons="auto"
                textColor="inherit"
                sx={{
                  borderBottom: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_DIVIDER}`,
                  '& .MuiTabs-indicator': { backgroundColor: '#f8b321' },
                  '& .MuiTab-root': { color: 'rgba(237,240,247,0.78)', textTransform: 'none', minHeight: 44 },
                  '& .Mui-selected': { color: '#f7f8fb' },
                }}
              >
                <Tab label={tt('Stil og animasjon', 'Style & Animation')} value="style-animation" />
                <Tab label={tt('Safe guides', 'Safe Guides')} value="safe-guides" />
                <Tab label={tt('Markører', 'Markers')} value="markers" />
              </Tabs>

              <Box sx={{ p: { xs: 1, sm: 1.2 }, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: { xs: 0.95, sm: 1 } }}>
                {selectedLowerThird && rightTab === 'style-animation' && (
                  <>
                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.8 }}>
                        <Tune fontSize="small" sx={{ color: '#f8d56f' }} />
                        <Typography sx={{ ...LT_SECTION_LABEL_SX, fontFamily: 'Barlow Condensed, sans-serif', fontSize: 24, lineHeight: 1 }}>
                          {tt('Animasjon', 'Animation')}
                        </Typography>
                      </Stack>

                      <Stack spacing={0.8}>
                        <Select
                          size="small"
                          value={selectedLowerThird.animation}
                          onChange={(event) =>
                            setSelectedLowerThirdField('animation', event.target.value as LowerThirdAnimation)
                          }
                          sx={{
                            color: '#edf0f7',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: NON_TEXT_BORDER_SUBTLE },
                          }}
                        >
                          <MenuItem value="slide-up">{tt('Skyv opp', 'Slide Up')}</MenuItem>
                          <MenuItem value="slide-down">{tt('Skyv ned', 'Slide Down')}</MenuItem>
                          <MenuItem value="slide-left">{tt('Skyv venstre', 'Slide Left')}</MenuItem>
                          <MenuItem value="slide-right">{tt('Skyv høyre', 'Slide Right')}</MenuItem>
                          <MenuItem value="fade-in">{tt('Ton inn', 'Fade In')}</MenuItem>
                          <MenuItem value="zoom-in">{tt('Zoom inn', 'Zoom In')}</MenuItem>
                        </Select>
                        <Select
                          size="small"
                          value={selectedLowerThird.position}
                          onChange={(event) =>
                            setSelectedLowerThirdField('position', event.target.value as LowerThirdPosition)
                          }
                          sx={{
                            color: '#edf0f7',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: NON_TEXT_BORDER_SUBTLE },
                          }}
                        >
                          <MenuItem value="bottom-left">{tt('Nede venstre', 'Bottom Left')}</MenuItem>
                          <MenuItem value="bottom-center">{tt('Nede midt', 'Bottom Center')}</MenuItem>
                          <MenuItem value="bottom-right">{tt('Nede høyre', 'Bottom Right')}</MenuItem>
                          <MenuItem value="top-left">{tt('Oppe venstre', 'Top Left')}</MenuItem>
                          <MenuItem value="top-center">{tt('Oppe midt', 'Top Center')}</MenuItem>
                          <MenuItem value="top-right">{tt('Oppe høyre', 'Top Right')}</MenuItem>
                        </Select>

                        <Typography sx={LT_FIELD_LABEL_SX}>
                          {tt('Animasjonsvarighet', 'Animation Duration')} {selectedLowerThird.animationDuration.toFixed(2)}s
                        </Typography>
                        <Slider
                          value={selectedLowerThird.animationDuration}
                          min={0.2}
                          max={2.5}
                          step={0.05}
                          onChange={(_, value) => {
                            const next = Array.isArray(value) ? value[0] : value;
                            setSelectedLowerThirdField('animationDuration', next);
                          }}
                          sx={{ color: '#89b5d8' }}
                        />
                        <Typography sx={LT_FIELD_LABEL_SX}>
                          {tt('Varighet', 'Duration')} {selectedLowerThird.duration.toFixed(1)}s
                        </Typography>
                        <Slider
                          value={selectedLowerThird.duration}
                          min={1}
                          max={8}
                          step={0.1}
                          onChange={(_, value) => {
                            const next = Array.isArray(value) ? value[0] : value;
                            setSelectedLowerThirdField('duration', next);
                          }}
                          sx={{ color: '#f8b321' }}
                        />
                        <Typography sx={LT_FIELD_LABEL_SX}>
                          {tt('Forsinkelse', 'Delay')} {selectedLowerThird.delay.toFixed(1)}s
                        </Typography>
                        <Slider
                          value={selectedLowerThird.delay}
                          min={0}
                          max={4}
                          step={0.1}
                          onChange={(_, value) => {
                            const next = Array.isArray(value) ? value[0] : value;
                            setSelectedLowerThirdField('delay', next);
                          }}
                          sx={{ color: '#89b5d8' }}
                        />
                      </Stack>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Stack direction="row" spacing={1.2}>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          <Switch
                            size="small"
                            checked={selectedLowerThird.bounce}
                            onChange={(event) => setSelectedLowerThirdField('bounce', event.target.checked)}
                          />
                          <Typography>{tt('Sprett', 'Bounce')}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          <Switch
                            size="small"
                            checked={selectedLowerThird.elastic}
                            onChange={(event) => setSelectedLowerThirdField('elastic', event.target.checked)}
                          />
                          <Typography>{tt('Elastisk', 'Elastic')}</Typography>
                        </Stack>
                      </Stack>

                      <Typography sx={{ ...LT_FIELD_LABEL_SX, mt: 0.8 }}>
                        {tt('Ease inn', 'Ease In')} {selectedLowerThird.easeIn.toFixed(1)}
                      </Typography>
                      <Slider
                        value={selectedLowerThird.easeIn}
                        min={0}
                        max={1}
                        step={0.1}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setSelectedLowerThirdField('easeIn', next);
                        }}
                        sx={{ color: '#89b5d8' }}
                      />
                      <Typography sx={LT_FIELD_LABEL_SX}>
                        {tt('Ease ut', 'Ease Out')} {selectedLowerThird.easeOut.toFixed(1)}
                      </Typography>
                      <Slider
                        value={selectedLowerThird.easeOut}
                        min={0}
                        max={1}
                        step={0.1}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setSelectedLowerThirdField('easeOut', next);
                        }}
                        sx={{ color: '#89b5d8' }}
                      />
                    </Box>
                  </>
                )}

                {selectedLowerThird && rightTab === 'safe-guides' && (
                  <Box sx={{ ...panelSx, p: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Switch
                        size="small"
                        checked={selectedLowerThird.safeGuides.enabled}
                        onChange={(event) => setSelectedLowerThirdSafeField('enabled', event.target.checked)}
                      />
                      <Typography sx={{ ...LT_SECTION_LABEL_SX, mb: 0 }}>{tt('Safe guidelines', 'Safe Guidelines')}</Typography>
                    </Stack>

                    <Select
                      fullWidth
                      size="small"
                      value={selectedLowerThird.safeGuides.type}
                      onChange={(event) =>
                        setSelectedLowerThirdSafeField(
                          'type',
                          event.target.value as LowerThirdItem['safeGuides']['type'],
                        )
                      }
                      sx={{
                        mb: 1,
                        color: '#edf0f7',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: NON_TEXT_BORDER_SUBTLE },
                      }}
                    >
                      <MenuItem value="title-safe">{tt('Tittel-safe', 'Title Safe')}</MenuItem>
                      <MenuItem value="action-safe">{tt('Action-safe', 'Action Safe')}</MenuItem>
                      <MenuItem value="custom">{tt('Egendefinert', 'Custom')}</MenuItem>
                    </Select>
                    {selectedSafeGuideFit && (
                      <Chip
                        size="small"
                        label={
                          selectedSafeGuideFit.fits
                            ? tt('Innenfor trygg sone', 'Inside Safe Area')
                            : tt('Utenfor trygg sone', 'Outside Safe Area')
                        }
                        sx={{
                          mb: 1,
                          alignSelf: 'flex-start',
                          bgcolor: selectedSafeGuideFit.fits ? 'rgba(126,234,142,0.18)' : 'rgba(248,179,33,0.18)',
                          color: selectedSafeGuideFit.fits ? '#9af3a8' : '#f8d56f',
                          border: `var(--academy-hairline-width, 1px) solid ${
                            selectedSafeGuideFit.fits ? 'rgba(126,234,142,0.6)' : 'rgba(248,179,33,0.68)'
                          }`,
                        }}
                      />
                    )}

                    <Stack spacing={0.8}>
                      <TextField
                        size="small"
                        type="number"
                        label={tt('Toppmarg %', 'Top Margin %')}
                        value={selectedLowerThird.safeGuides.marginTop}
                        onChange={(event) =>
                          setSelectedLowerThirdSafeField('marginTop', Math.max(0, Number(event.target.value) || 0))
                        }
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label={tt('Høyremarg %', 'Right Margin %')}
                        value={selectedLowerThird.safeGuides.marginRight}
                        onChange={(event) =>
                          setSelectedLowerThirdSafeField('marginRight', Math.max(0, Number(event.target.value) || 0))
                        }
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label={tt('Bunnmarg %', 'Bottom Margin %')}
                        value={selectedLowerThird.safeGuides.marginBottom}
                        onChange={(event) =>
                          setSelectedLowerThirdSafeField(
                            'marginBottom',
                            Math.max(0, Number(event.target.value) || 0),
                          )
                        }
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label={tt('Venstremarg %', 'Left Margin %')}
                        value={selectedLowerThird.safeGuides.marginLeft}
                        onChange={(event) =>
                          setSelectedLowerThirdSafeField('marginLeft', Math.max(0, Number(event.target.value) || 0))
                        }
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <TextField
                        size="small"
                        label={tt('Guide-farge', 'Guide Color')}
                        value={selectedLowerThird.safeGuides.color || '#f8b321'}
                        onChange={(event) => setSelectedLowerThirdSafeField('color', event.target.value)}
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                      />
                      <Typography sx={LT_FIELD_LABEL_SX}>
                        {tt('Guide-opasitet', 'Guide Opacity')} {Math.round((selectedLowerThird.safeGuides.opacity ?? 0.82) * 100)}%
                      </Typography>
                      <Slider
                        value={selectedLowerThird.safeGuides.opacity ?? 0.82}
                        min={0.2}
                        max={1}
                        step={0.05}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setSelectedLowerThirdSafeField('opacity', next);
                        }}
                        sx={{ color: '#f8b321' }}
                      />
                      <Typography sx={LT_FIELD_LABEL_SX}>
                        {tt('Guide-tykkelse', 'Guide Thickness')} {(selectedLowerThird.safeGuides.thickness ?? 1.2).toFixed(1)}px
                      </Typography>
                      <Slider
                        value={selectedLowerThird.safeGuides.thickness ?? 1.2}
                        min={1}
                        max={4}
                        step={0.2}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setSelectedLowerThirdSafeField('thickness', next);
                        }}
                        sx={{ color: '#89b5d8' }}
                      />
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Switch
                            size="small"
                            checked={selectedLowerThird.safeGuides.showLabels !== false}
                            onChange={(event) => setSelectedLowerThirdSafeField('showLabels', event.target.checked)}
                          />
                          <Typography sx={{ color: 'rgba(237,240,247,0.78)' }}>
                            {tt('Vis labels', 'Show Labels')}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Switch
                            size="small"
                            checked={selectedLowerThird.safeGuides.showCenterLines !== false}
                            onChange={(event) => setSelectedLowerThirdSafeField('showCenterLines', event.target.checked)}
                          />
                          <Typography sx={{ color: 'rgba(237,240,247,0.78)' }}>
                            {tt('Vis senterlinjer', 'Show Center Lines')}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Switch
                            size="small"
                            checked={selectedLowerThird.safeGuides.snapToSafe === true}
                            onChange={(event) => {
                              setSelectedLowerThirdSafeField('snapToSafe', event.target.checked);
                              if (event.target.checked) snapSelectedLowerThirdToSafeZone();
                            }}
                          />
                          <Typography sx={{ color: 'rgba(237,240,247,0.78)' }}>
                            {tt('Snap til trygg sone', 'Snap to Safe Zone')}
                          </Typography>
                        </Stack>
                      </Stack>
                      {selectedSafeGuideFit && !selectedSafeGuideFit.fits && (
                        <Button
                          variant="outlined"
                          onClick={snapSelectedLowerThirdToSafeZone}
                          sx={{
                            alignSelf: 'flex-start',
                            textTransform: 'none',
                            borderColor: NON_TEXT_ALERT_BORDER,
                            color: '#f8d56f',
                          }}
                        >
                          {tt('Snap nå', 'Snap Now')}
                        </Button>
                      )}
                    </Stack>
                  </Box>
                )}

                {rightTab === 'markers' && (
                  <>
                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.8 }}>
                        <WarningAmber sx={{ color: qualityIssues.length === 0 ? '#9ef1ca' : '#f8d675' }} />
                        <Typography sx={{ ...LT_SECTION_LABEL_SX, mb: 0, fontFamily: 'Barlow Condensed, sans-serif', fontSize: 24, lineHeight: 1 }}>
                          {tt('Kvalitetssjekker', 'Quality Checks')}
                        </Typography>
                        <Chip
                          size="small"
                          label={tt(`${qualityIssues.length} funn`, `${qualityIssues.length} findings`)}
                          sx={{
                            bgcolor:
                              qualityIssues.length === 0
                                ? 'rgba(126,232,179,0.16)'
                                : 'rgba(248,179,33,0.16)',
                            color:
                              qualityIssues.length === 0
                                ? '#9ef1ca'
                                : '#f8d675',
                          }}
                        />
                      </Stack>
                      <Stack spacing={0.65}>
                        {qualityIssues.length === 0 && (
                          <Typography sx={{ color: '#9ef1ca', fontSize: 12 }}>
                            {tt('Ingen kvalitetsavvik funnet.', 'No quality issues found.')}
                          </Typography>
                        )}
                        {qualityIssues.slice(0, 8).map((issue) => (
                          <Stack
                            key={issue.id}
                            direction="row"
                            spacing={0.8}
                            alignItems="center"
                            sx={{
                              border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_SUBTLE}`,
                              borderRadius: 1,
                              px: 0.9,
                              py: 0.55,
                              bgcolor: 'rgba(12,16,24,0.88)',
                            }}
                          >
                            <WarningAmber
                              fontSize="small"
                              sx={{ color: issue.severity === 'error' ? '#ff8c7f' : '#f8d675' }}
                            />
                            <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.84)' }}>
                              {issue.message}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Typography sx={{ ...LT_SECTION_LABEL_SX, mb: 0, fontFamily: 'Barlow Condensed, sans-serif', fontSize: 24, lineHeight: 1 }}>
                        {tt('Versjonshistorikk', 'Version History')}
                      </Typography>
                      <TextField
                        select
                        size="small"
                        value={selectedVersionId}
                        onChange={(event) => setSelectedVersionId(String(event.target.value))}
                        sx={{
                          mt: 0.8,
                          width: '100%',
                          '& .MuiInputBase-root': {
                            color: '#edf0f7',
                            bgcolor: 'rgba(10,13,20,0.78)',
                          },
                        }}
                      >
                        {versions.length === 0 && (
                          <MenuItem value="">
                            {tt('Ingen lagrede versjoner ennå', 'No saved versions yet')}
                          </MenuItem>
                        )}
                        {versions.map((version) => (
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
                          mt: 0.8,
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_DEFAULT}`,
                        }}
                      >
                        {tt('Gjenopprett valgt versjon', 'Restore selected version')}
                      </Button>
                    </Box>

                    <Typography sx={{ color: 'rgba(237,240,247,0.64)', fontSize: 12 }}>
                      {tt(
                        'Tastatur: V = velgmodus, E = redigeringsmodus, piltaster flytter tidsvindu, Shift + piltast flytter 1s, Delete/Backspace sletter valgt lower third.',
                        'Keyboard: V = select mode, E = edit mode, arrows move timeline window, Shift + arrow moves 1s, Delete/Backspace removes selected lower third.',
                      )}
                    </Typography>
                  </>
                )}

                {rightTab !== 'markers' && (
                  <>
                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Typography sx={{ color: '#f8d56f', fontWeight: 600 }}>
                        {tt(
                          'Lower thirds: 3-6s (4.5s anbefalt)',
                          'Lower Thirds: 3-6s (4.5s recommended)',
                        )}
                      </Typography>
                      <Typography sx={{ color: '#f8d56f', fontWeight: 600, mt: 0.4 }}>
                        {tt(
                          'Undertekster: 1.5-6s (3.5s anbefalt)',
                          'Captions: 1.5-6s (3.5s recommended)',
                        )}
                      </Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.67)', fontSize: 12, mt: 0.6 }}>
                        {tt(
                          'Hold teksten lesbar, unngå kantklipping, og hold deg innenfor safe-områder.',
                          'Keep text readable, avoid edge clipping, and stay inside safe areas.',
                        )}
                      </Typography>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography sx={LT_FIELD_LABEL_SX}>{tt('Visninger', 'Views')}</Typography>
                        <Typography sx={LT_METRIC_VALUE_SX}>{selectedLowerThird?.analytics.views.toLocaleString() || 0}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                        <Typography sx={LT_FIELD_LABEL_SX}>{tt('Gj.sn. visning', 'Avg Watch')}</Typography>
                        <Typography sx={LT_METRIC_VALUE_SX}>{selectedLowerThird?.analytics.avgWatch.toFixed(1) || '0.0'}s</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                        <Typography sx={LT_FIELD_LABEL_SX}>{tt('Fullføring', 'Completion')}</Typography>
                        <Typography sx={{ ...LT_METRIC_VALUE_SX, color: '#7eea8e' }}>
                          {selectedLowerThird?.analytics.completionRate || 0}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.max(6, selectedLowerThird?.analytics.completionRate || 0)}
                        sx={{
                          mt: 0.8,
                          height: 7,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.14)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 999,
                            background: 'linear-gradient(90deg, #8de270 0%, #f8b321 100%)',
                          },
                        }}
                      />
                    </Box>
                  </>
                )}
              </Box>

            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyLowerThirdsStudio, {
  componentId: 'academy-lower-thirds-studio',
  componentName: 'Academy Lower Thirds Studio',
  componentType: 'editor',
  componentCategory: 'academy',
  featureIds: ['lower-thirds', 'safe-guides', 'animation-controls', 'academy-video-branding'],
});
