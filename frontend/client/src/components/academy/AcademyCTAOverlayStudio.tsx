import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  FormControlLabel,
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
import { keyframes } from '@mui/system';
import {
  Add,
  AdsClick,
  AutoFixHigh,
  Campaign,
  CloudDone,
  CloudOff,
  CloudSync,
  ContentCopy,
  Delete,
  Edit,
  CropSquare,
  MailOutline,
  NotificationsNone,
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

interface AcademyCTAOverlayStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type CTAType = 'checkout' | 'newsletter' | 'community' | 'download' | 'custom';
type Placement = 'bottom-center' | 'bottom-right' | 'center' | 'top-right';
type RightTab = 'performance' | 'abtest' | 'analytics' | 'markers';
type EditorTab = 'content' | 'design';
type CTAAnimationType = 'fade-in' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom-in';
type CTAAnimationEasing = 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
type CTAOverlayScope = 'course' | 'skill';
type CTAEditorMode = 'select' | 'edit';
type CTAIssueType = 'contrast' | 'duration' | 'overlap' | 'bounds' | 'mobile-text';

type CTAIssue = {
  id: string;
  overlayId?: string;
  type: CTAIssueType;
  severity: 'warning' | 'error';
  message: string;
};

type CTAOverlayStoreEntry = {
  overlays: CTAOverlayItem[];
  triggerEnabled: boolean;
  resetToKeyframe: boolean;
  duration: number;
  updatedAt: string;
  publishedAt?: string;
};

type CTAOverlayStoreMap = Record<string, CTAOverlayStoreEntry>;

interface CTAOverlayItem {
  id: string;
  name: string;
  type: CTAType;
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel: string;
  secondaryEnabled: boolean;
  urgency: string;
  url: string;
  triggerAt: number;
  endAt: number;
  placement: Placement;
  enabled: boolean;
  abTestEnabled: boolean;
  animation: {
    enabled: boolean;
    type: CTAAnimationType;
    duration: number;
    delay: number;
    easing: CTAAnimationEasing;
  };
  style: {
    bg: string;
    text: string;
    button: string;
    buttonText: string;
    opacity: number;
    borderRadius: number;
    fontFamily: string;
    fontSize: number;
  };
  analytics: {
    views: number;
    clicks: number;
    conversions: number;
    revenue: number;
    avgWatchBeforeTrigger: number;
    variantA: number;
    variantB: number;
    targetViews: number;
    targetCtr: number;
    targetConversions: number;
    targetRevenue: number;
  };
}

const NON_TEXT_BORDER_SUBTLE = 'rgba(255,255,255,0.36)';
const NON_TEXT_BORDER_DEFAULT = 'rgba(255,255,255,0.42)';
const NON_TEXT_BORDER_STRONG = 'rgba(255,255,255,0.52)';
const NON_TEXT_DIVIDER = 'rgba(255,255,255,0.36)';
const NON_TEXT_FOCUS_RING = 'rgba(248,179,33,0.74)';
const NON_TEXT_ALERT_BORDER = 'rgba(248,179,33,0.72)';
const NON_TEXT_DANGER_BORDER = 'rgba(255,139,139,0.72)';
const CTA_FIELD_LABEL_SX = {
  color: 'rgba(237,240,247,0.84)',
  fontSize: { xs: 13, sm: 13.5 },
  lineHeight: 1.3,
};
const CTA_SECTION_LABEL_SX = {
  color: 'rgba(237,240,247,0.86)',
  fontSize: { xs: 13, sm: 13.5 },
  mb: 0.8,
  fontWeight: 700,
  letterSpacing: '0.01em',
  lineHeight: 1.3,
};
const CTA_METRIC_VALUE_SX = {
  fontSize: { xs: 24, sm: 26 },
  lineHeight: 1,
  fontFamily: 'Barlow Condensed, sans-serif',
  letterSpacing: '0.01em',
};

const panelSx = {
  borderRadius: 1.4,
  border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_SUBTLE}`,
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};
const CTA_CONTROL_BUTTON_SX = {
  height: 34,
  borderRadius: 1,
  textTransform: 'none',
  transition: 'all 140ms ease',
};
const CTA_NEUTRAL_OUTLINED_BUTTON_SX = {
  ...CTA_CONTROL_BUTTON_SX,
  borderColor: NON_TEXT_BORDER_DEFAULT,
  color: '#edf0f7',
  bgcolor: 'rgba(255,255,255,0.02)',
  '&:hover': {
    borderColor: NON_TEXT_BORDER_STRONG,
    bgcolor: 'rgba(255,255,255,0.06)',
  },
};
const CTA_WARNING_OUTLINED_BUTTON_SX = {
  ...CTA_CONTROL_BUTTON_SX,
  borderColor: 'rgba(248,179,33,0.35)',
  color: '#f8d675',
  bgcolor: 'rgba(248,179,33,0.06)',
  '&:hover': {
    borderColor: 'rgba(248,179,33,0.5)',
    bgcolor: 'rgba(248,179,33,0.14)',
  },
};
const CTA_NEUTRAL_ICON_BUTTON_SX = {
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
const CTA_SAVE_BUTTON_SX = {
  ...CTA_NEUTRAL_OUTLINED_BUTTON_SX,
  minWidth: 104,
};
const CTA_PUBLISH_BUTTON_SX = {
  ...CTA_CONTROL_BUTTON_SX,
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
const CTA_TOOLBAR_GROUP_SX = {
  p: 0.3,
  borderRadius: 1,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
  bgcolor: 'rgba(255,255,255,0.03)',
  display: 'flex',
  gap: 0.4,
  flexWrap: 'wrap',
  alignItems: 'center',
};
const CTA_EDITOR_SECTION_CARD_SX = {
  borderRadius: 1,
  border: `var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)`,
  background: 'linear-gradient(145deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))',
  p: 1,
  display: 'grid',
  gap: 0.9,
};

const academyShellMaxWidth = 'min(100%, var(--academy-shell-max-width, 2880px))';
const CTA_VIDEO_PLACEHOLDER = '/assets/academy/intro-video.mp4';
const CTA_OVERLAY_STORE_KEY = 'academyCtaOverlayStoreV1';
const CTA_OVERLAY_KV_KEY = 'academy_cta_overlay_store_v1';
const CTA_RESOURCE_ID_PREFIX = 'cta-resource-';
const CTA_RESOURCE_COURSE_PREFIX = 'cta-resource-course-';
const CTA_RESOURCE_SKILL_PREFIX = 'cta-resource-skill-';

const toNok = (value: number): string =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

const formatTime = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const parseMinuteSecondTime = (value: string, fallback: number): number => {
  const raw = value.trim();
  if (!raw) {
    return fallback;
  }

  if (raw.includes(':')) {
    const [minutePart, secondPart = '0'] = raw.split(':');
    const minutes = Number.parseInt(minutePart.trim(), 10);
    const seconds = Number.parseInt(secondPart.trim(), 10);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return fallback;
    }
    return Math.max(0, minutes * 60 + seconds);
  }

  const asSeconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(asSeconds)) {
    return fallback;
  }
  return Math.max(0, asSeconds);
};

const getRouteParam = (key: string): string => {
  if (typeof window === 'undefined') return '';
  const value = new URLSearchParams(window.location.search).get(key);
  return String(value || '').trim();
};

const getScopeStorageKey = (
  courseId: string,
  scope: CTAOverlayScope,
  lessonId?: string | null,
): string => {
  if (scope === 'skill' && lessonId) {
    return `${courseId}::skill::${lessonId}`;
  }
  return `${courseId}::course`;
};

const readOverlayStore = (): CTAOverlayStoreMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CTA_OVERLAY_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CTAOverlayStoreMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeOverlayStore = (store: CTAOverlayStoreMap): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CTA_OVERLAY_STORE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage errors and keep editor state in-memory.
  }
};

const readOverlayStoreFromDb = async (): Promise<CTAOverlayStoreMap | null> => {
  try {
    const response = await fetch(`/api/user/kv/${encodeURIComponent(CTA_OVERLAY_KV_KEY)}`, {
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
        ? (JSON.parse(value) as CTAOverlayStoreMap)
        : (value as CTAOverlayStoreMap);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writeOverlayStoreToDb = async (store: CTAOverlayStoreMap): Promise<void> => {
  try {
    await fetch('/api/user/kv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: CTA_OVERLAY_KV_KEY, value: store }),
    });
  } catch {
    // Network/storage persistence errors are non-fatal for editor usage.
  }
};

const getOverlayEntryUpdatedAt = (entry?: CTAOverlayStoreEntry): number => {
  if (!entry?.updatedAt) return 0;
  const ms = Date.parse(entry.updatedAt);
  return Number.isFinite(ms) ? ms : 0;
};

const mergeOverlayStores = (
  localStore: CTAOverlayStoreMap,
  dbStore: CTAOverlayStoreMap,
): CTAOverlayStoreMap => {
  const merged: CTAOverlayStoreMap = {};
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
      getOverlayEntryUpdatedAt(localEntry) >= getOverlayEntryUpdatedAt(dbEntry)
        ? localEntry
        : dbEntry;
  });
  return merged;
};

const parseRangeFromDescription = (
  description: string,
): { triggerAt: number; endAt: number } | null => {
  const match = description.match(/(\d+):(\d+)\s*-\s*(\d+):(\d+)/);
  if (!match) return null;
  const startMin = Number.parseInt(match[1], 10);
  const startSec = Number.parseInt(match[2], 10);
  const endMin = Number.parseInt(match[3], 10);
  const endSec = Number.parseInt(match[4], 10);
  if (![startMin, startSec, endMin, endSec].every(Number.isFinite)) return null;
  return {
    triggerAt: Math.max(0, startMin * 60 + startSec),
    endAt: Math.max(0, endMin * 60 + endSec),
  };
};

const isLikelyCtaResource = (resource: { id: string; title: string }): boolean => {
  return (
    String(resource.id || '').startsWith(CTA_RESOURCE_ID_PREFIX) ||
    String(resource.title || '').startsWith('[CTA]')
  );
};

const ctaAnimationKeyframes: Record<CTAAnimationType, ReturnType<typeof keyframes>> = {
  'fade-in': keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
  `,
  'slide-up': keyframes`
    from { opacity: 0; transform: translateY(22px); }
    to { opacity: 1; transform: translateY(0); }
  `,
  'slide-down': keyframes`
    from { opacity: 0; transform: translateY(-22px); }
    to { opacity: 1; transform: translateY(0); }
  `,
  'slide-left': keyframes`
    from { opacity: 0; transform: translateX(28px); }
    to { opacity: 1; transform: translateX(0); }
  `,
  'slide-right': keyframes`
    from { opacity: 0; transform: translateX(-28px); }
    to { opacity: 1; transform: translateX(0); }
  `,
  'zoom-in': keyframes`
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  `,
};

const defaultOverlayAnimation: CTAOverlayItem['animation'] = {
  enabled: true,
  type: 'fade-in',
  duration: 0.6,
  delay: 0,
  easing: 'ease-out',
};

const CTA_FONT_OPTIONS = [
  { value: 'Barlow Condensed, "Manrope", sans-serif', labelNo: 'Barlow Condensed', labelEn: 'Barlow Condensed' },
  { value: '"Manrope", "Segoe UI", sans-serif', labelNo: 'Manrope', labelEn: 'Manrope' },
  { value: '"Inter", "Segoe UI", sans-serif', labelNo: 'Inter', labelEn: 'Inter' },
  { value: '"Space Grotesk", "Manrope", sans-serif', labelNo: 'Space Grotesk', labelEn: 'Space Grotesk' },
  { value: '"Roboto Slab", "Times New Roman", serif', labelNo: 'Roboto Slab', labelEn: 'Roboto Slab' },
] as const;

const defaultOverlayStyle: CTAOverlayItem['style'] = {
  bg: 'rgba(10,15,25,0.84)',
  text: '#f5f1e7',
  button: '#d99622',
  buttonText: '#1a1306',
  opacity: 0.97,
  borderRadius: 12,
  fontFamily: 'Barlow Condensed, "Manrope", sans-serif',
  fontSize: 56,
};

const defaultOverlayAnalytics: CTAOverlayItem['analytics'] = {
  views: 0,
  clicks: 0,
  conversions: 0,
  revenue: 0,
  avgWatchBeforeTrigger: 0,
  variantA: 0,
  variantB: 0,
  targetViews: 1000,
  targetCtr: 8,
  targetConversions: 100,
  targetRevenue: 10000,
};

const normalizeOverlayStyle = (
  style?: Partial<CTAOverlayItem['style']> | null,
): CTAOverlayItem['style'] => {
  const merged = { ...defaultOverlayStyle, ...(style || {}) };
  return {
    ...merged,
    fontFamily:
      typeof merged.fontFamily === 'string' && merged.fontFamily.trim().length > 0
        ? merged.fontFamily
        : defaultOverlayStyle.fontFamily,
    fontSize: Number.isFinite(merged.fontSize)
      ? Math.min(96, Math.max(24, Number(merged.fontSize)))
      : defaultOverlayStyle.fontSize,
    opacity: Number.isFinite(merged.opacity)
      ? Math.min(1, Math.max(0.2, Number(merged.opacity)))
      : defaultOverlayStyle.opacity,
    borderRadius: Number.isFinite(merged.borderRadius)
      ? Math.min(30, Math.max(0, Number(merged.borderRadius)))
      : defaultOverlayStyle.borderRadius,
  };
};

const normalizeOverlayAnalytics = (
  analytics?: Partial<CTAOverlayItem['analytics']> | null,
): CTAOverlayItem['analytics'] => {
  const merged = { ...defaultOverlayAnalytics, ...(analytics || {}) };
  return {
    ...merged,
    targetViews: Number.isFinite(merged.targetViews)
      ? Math.max(0, Math.round(Number(merged.targetViews)))
      : defaultOverlayAnalytics.targetViews,
    targetCtr: Number.isFinite(merged.targetCtr)
      ? Math.max(0, Number(merged.targetCtr))
      : defaultOverlayAnalytics.targetCtr,
    targetConversions: Number.isFinite(merged.targetConversions)
      ? Math.max(0, Math.round(Number(merged.targetConversions)))
      : defaultOverlayAnalytics.targetConversions,
    targetRevenue: Number.isFinite(merged.targetRevenue)
      ? Math.max(0, Math.round(Number(merged.targetRevenue)))
      : defaultOverlayAnalytics.targetRevenue,
  };
};

const normalizeOverlayTiming = (
  overlay: CTAOverlayItem,
  maxDuration: number,
): CTAOverlayItem => {
  const safeMax = Number.isFinite(maxDuration) && maxDuration > 0
    ? Math.max(1, Math.round(maxDuration))
    : 289;
  const rawTriggerAt = Math.max(0, Math.round(Number(overlay.triggerAt) || 0));
  const rawEndAt = Math.max(0, Math.round(Number(overlay.endAt) || rawTriggerAt));
  const maxTriggerAt = Math.max(0, safeMax - 1);
  const triggerAt =
    rawTriggerAt >= safeMax && rawEndAt >= safeMax
      ? maxTriggerAt
      : Math.min(safeMax, rawTriggerAt);
  let endAt = Math.min(
    safeMax,
    Math.max(triggerAt, rawEndAt),
  );
  if (endAt <= triggerAt && safeMax > triggerAt) {
    endAt = safeMax;
  }

  return {
    ...overlay,
    triggerAt,
    endAt,
    analytics: {
      ...overlay.analytics,
      avgWatchBeforeTrigger: triggerAt,
    },
  };
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const SNAP_INTERVAL_SECONDS = 0.5;
const PLAYHEAD_SNAP_THRESHOLD_SECONDS = 0.35;
const CTA_MIN_DURATION_SECONDS = 1.5;
const CTA_SAFE_AREA_MARGIN_PERCENT = 8;
const CTA_MOBILE_TITLE_MAX = 56;
const CTA_MOBILE_BODY_MAX = 120;

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

const overlayIntervalsOverlap = (left: CTAOverlayItem, right: CTAOverlayItem): boolean =>
  left.triggerAt < right.endAt && right.triggerAt < left.endAt;

const shorten = (value: string, max: number): string => {
  const raw = String(value || '').trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
};

const validateOverlayItems = (
  items: CTAOverlayItem[],
  durationSeconds: number,
  tt: (no: string, en: string) => string,
): CTAIssue[] => {
  const issues: CTAIssue[] = [];
  const safeDuration = Math.max(1, Number(durationSeconds || 1));

  items.forEach((overlay) => {
    const span = overlay.endAt - overlay.triggerAt;
    if (span < CTA_MIN_DURATION_SECONDS) {
      issues.push({
        id: `${overlay.id}-duration`,
        overlayId: overlay.id,
        type: 'duration',
        severity: 'warning',
        message: tt('CTA vises for kort tid.', 'CTA is visible for too short time.'),
      });
    }

    if (
      overlay.triggerAt < 0 ||
      overlay.endAt < 0 ||
      overlay.endAt <= overlay.triggerAt ||
      overlay.triggerAt > safeDuration ||
      overlay.endAt > safeDuration
    ) {
      issues.push({
        id: `${overlay.id}-bounds`,
        overlayId: overlay.id,
        type: 'bounds',
        severity: 'error',
        message: tt('CTA-tidspunkt er utenfor videogrensene.', 'CTA timing is outside video bounds.'),
      });
    }

    const textContrast = getContrastRatio(overlay.style.text, overlay.style.bg);
    const buttonContrast = getContrastRatio(overlay.style.buttonText, overlay.style.button);
    if ((textContrast !== null && textContrast < 3) || (buttonContrast !== null && buttonContrast < 3)) {
      issues.push({
        id: `${overlay.id}-contrast`,
        overlayId: overlay.id,
        type: 'contrast',
        severity: 'warning',
        message: tt('Lav kontrast i CTA-farger.', 'Low contrast in CTA colors.'),
      });
    }

    if (
      String(overlay.title || '').trim().length > CTA_MOBILE_TITLE_MAX ||
      String(overlay.subtitle || '').trim().length > CTA_MOBILE_BODY_MAX ||
      String(overlay.urgency || '').trim().length > CTA_MOBILE_TITLE_MAX
    ) {
      issues.push({
        id: `${overlay.id}-mobile`,
        overlayId: overlay.id,
        type: 'mobile-text',
        severity: 'warning',
        message: tt('CTA-teksten er lang for mobil.', 'CTA text is long for mobile.'),
      });
    }
  });

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const left = items[i];
      const right = items[j];
      if (left.placement !== right.placement) continue;
      if (!overlayIntervalsOverlap(left, right)) continue;
      const key = [left.id, right.id].sort().join('::');
      issues.push({
        id: `${key}-overlap`,
        type: 'overlap',
        severity: 'warning',
        message: tt(
          'To CTA-er overlapper samme plassering og tidspunkt.',
          'Two CTAs overlap in the same placement and time.',
        ),
      });
    }
  }

  return issues;
};

const applyOverlayAutoFixes = (
  items: CTAOverlayItem[],
  durationSeconds: number,
): CTAOverlayItem[] => {
  const safeDuration = Math.max(1, Number(durationSeconds || 1));
  const sorted = [...items]
    .map((item) => normalizeOverlayTiming(item, safeDuration))
    .sort((left, right) => left.triggerAt - right.triggerAt);

  return sorted.map((overlay, index) => {
    let triggerAt = clamp(overlay.triggerAt, 0, Math.max(0, safeDuration - CTA_MIN_DURATION_SECONDS));
    let endAt = clamp(overlay.endAt, triggerAt + CTA_MIN_DURATION_SECONDS, safeDuration);
    if (endAt - triggerAt < CTA_MIN_DURATION_SECONDS) {
      endAt = clamp(triggerAt + CTA_MIN_DURATION_SECONDS, 0, safeDuration);
      triggerAt = clamp(endAt - CTA_MIN_DURATION_SECONDS, 0, safeDuration);
    }

    const previous = index > 0 ? sorted[index - 1] : null;
    if (previous && previous.placement === overlay.placement && triggerAt < previous.endAt) {
      const shiftedStart = clamp(previous.endAt + 0.5, 0, Math.max(0, safeDuration - CTA_MIN_DURATION_SECONDS));
      triggerAt = shiftedStart;
      endAt = clamp(
        Math.max(shiftedStart + CTA_MIN_DURATION_SECONDS, shiftedStart + (overlay.endAt - overlay.triggerAt)),
        0,
        safeDuration,
      );
    }

    const fixed = {
      ...overlay,
      triggerAt,
      endAt,
      style: {
        ...overlay.style,
        borderRadius: clamp(Number(overlay.style.borderRadius) || 0, 0, 30),
        opacity: clamp(Number(overlay.style.opacity) || 1, 0.2, 1),
        fontSize: clamp(Number(overlay.style.fontSize) || 24, 24, 96),
      },
      title: shorten(overlay.title, CTA_MOBILE_TITLE_MAX),
      subtitle: shorten(overlay.subtitle, CTA_MOBILE_BODY_MAX),
      urgency: shorten(overlay.urgency, CTA_MOBILE_TITLE_MAX),
      primaryLabel: shorten(overlay.primaryLabel, 26),
      secondaryLabel: shorten(overlay.secondaryLabel, 26),
      analytics: {
        ...overlay.analytics,
        avgWatchBeforeTrigger: triggerAt,
      },
    };

    const textContrast = getContrastRatio(fixed.style.text, fixed.style.bg);
    const buttonContrast = getContrastRatio(fixed.style.buttonText, fixed.style.button);
    if (textContrast !== null && textContrast < 3) {
      fixed.style = {
        ...fixed.style,
        text: '#f7f8fb',
        bg: 'rgba(10,14,22,0.92)',
      };
    }
    if (buttonContrast !== null && buttonContrast < 3) {
      fixed.style = {
        ...fixed.style,
        button: '#f2b131',
        buttonText: '#121826',
      };
    }

    return fixed;
  });
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (target.isContentEditable) return true;
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.closest('[contenteditable="true"], [role="textbox"], [role="combobox"]'));
};


const defaultOverlays = (
  translate?: (no: string, en: string) => string,
): CTAOverlayItem[] => {
  const tr = (no: string, en: string) => (translate ? translate(no, en) : en);
  return [
  {
    id: `cta-${Date.now()}-1`,
    name: tr('Betaling-CTA', 'Checkout CTA'),
    type: 'checkout',
    title: tr('Ta filmskapingen din til neste nivå', 'Advance Your Filmmaking Skills'),
    subtitle: tr('Bli med på det omfattende 6-ukerskurset', 'Join the comprehensive 6-week course'),
    primaryLabel: tr('Meld deg på nå', 'Enroll Now'),
    secondaryLabel: tr('Nei takk', 'No Thanks'),
    secondaryEnabled: true,
    urgency: tr('Slutter snart! 3 plasser igjen', 'Ends soon! 3 spots left'),
    url: 'https://academy.creatorhub.no/checkout',
    triggerAt: 230,
    endAt: 280,
    placement: 'bottom-center',
    enabled: true,
    abTestEnabled: true,
    animation: {
      ...defaultOverlayAnimation,
      type: 'slide-up',
      duration: 0.7,
    },
    style: {
      ...defaultOverlayStyle,
    },
    analytics: {
      ...defaultOverlayAnalytics,
      views: 6540,
      clicks: 835,
      conversions: 178,
      revenue: 19320,
      avgWatchBeforeTrigger: 36,
      variantA: 12.8,
      variantB: 9.4,
      targetViews: 8000,
      targetCtr: 13.5,
      targetConversions: 220,
      targetRevenue: 25000,
    },
  },
  {
    id: `cta-${Date.now()}-2`,
    name: tr('Community-CTA', 'Community CTA'),
    type: 'community',
    title: tr('Bli med i CreatorHub-fellesskapet', 'Join CreatorHub Community'),
    subtitle: tr('Få produksjonsfeedback og kohortstøtte', 'Get production feedback and cohort support'),
    primaryLabel: tr('Bli med', 'Join Community'),
    secondaryLabel: tr('Senere', 'Later'),
    secondaryEnabled: true,
    urgency: tr('Nettverk med 500+ skapere', 'Network with 500+ creators'),
    url: 'https://community.creatorhub.no',
    triggerAt: 140,
    endAt: 188,
    placement: 'bottom-right',
    enabled: false,
    abTestEnabled: false,
    animation: {
      ...defaultOverlayAnimation,
      type: 'fade-in',
      duration: 0.5,
      easing: 'ease-in-out',
    },
    style: {
      ...defaultOverlayStyle,
      bg: 'rgba(14,19,29,0.88)',
      text: '#f4efe4',
      button: '#f2b131',
      buttonText: '#1e1506',
      opacity: 0.96,
      borderRadius: 10,
    },
    analytics: {
      ...defaultOverlayAnalytics,
      views: 2280,
      clicks: 302,
      conversions: 59,
      revenue: 5840,
      avgWatchBeforeTrigger: 22,
      variantA: 8.2,
      variantB: 7.5,
      targetViews: 3500,
      targetCtr: 10,
      targetConversions: 90,
      targetRevenue: 9000,
    },
  },
  ];
};

function AcademyCTAOverlayStudio({ courseId, onSave, onCancel }: AcademyCTAOverlayStudioProps) {
  const [location, setLocation] = useLocation();
  const { state, getCourse, getInstructor, updateCourse, updateLesson, setCurrentCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  
  const { navLabel, tt } = useAcademyLocale();
  const routeCourseId = useMemo(() => getRouteParam('courseId'), [location]);
  const routeLessonId = useMemo(
    () => getRouteParam('lessonId') || getRouteParam('skillId'),
    [location],
  );

  const [leftNav, setLeftNav] = useState('tool-cta');
  const [rightTab, setRightTab] = useState<RightTab>('performance');
  const [editorTab, setEditorTab] = useState<EditorTab>('content');
  const [search, setSearch] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(230);
  const [duration, setDuration] = useState(289);
  const [editorMode, setEditorMode] = useState<CTAEditorMode>('edit');
  const [safeAreaEnabled, setSafeAreaEnabled] = useState(true);
  const [timelineSnapEnabled, setTimelineSnapEnabled] = useState(true);
  const [triggerEnabled, setTriggerEnabled] = useState(true);
  const [resetToKeyframe, setResetToKeyframe] = useState(true);
  const [animateOverlayOnce, setAnimateOverlayOnce] = useState(false);
  const [durationInput, setDurationInput] = useState('0:00');
  const [triggerAtInput, setTriggerAtInput] = useState('0:00');
  const [endAtInput, setEndAtInput] = useState('0:00');
  const [overlayItems, setOverlayItems] = useState<CTAOverlayItem[]>(() => defaultOverlays(tt));
  const [selectedOverlayId, setSelectedOverlayId] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [lastPublishedAt, setLastPublishedAt] = useState('');
  const [hasSavedChangesSincePublish, setHasSavedChangesSincePublish] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || routeCourseId || '');
  const [overlayScope, setOverlayScope] = useState<CTAOverlayScope>(routeLessonId ? 'skill' : 'course');
  const [selectedSkillId, setSelectedSkillId] = useState(routeLessonId || '');
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayVisibilityRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const hydratedScopeKeyRef = useRef<string>('');
  const autoSaveHydratedRef = useRef(false);
  const lastAutoSavedSignatureRef = useRef('');
  const { autoSaveState, lastSavedAt, markDirty, markSaving, markSaved } = useToolAutoSaveState();
  const {
    simpleMode,
    toggleSimpleMode,
    shouldShowAdvanced,
  } = useAcademyToolUx('cta');
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
  } = useToolHistory<CTAOverlayItem>({
    items: overlayItems,
    setItems: setOverlayItems,
    maxVersions: 24,
    coalesceMs: 650,
  });
  useToolUndoRedoShortcuts(bindUndoRedoShortcuts);

  const courseItems = useMemo(() => {
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
    if (overlayScope !== 'skill') {
      setOverlayScope('skill');
    }
    if (nextRouteLessonId !== selectedSkillId) {
      setSelectedSkillId(nextRouteLessonId);
    }
  }, [overlayScope, routeLessonId, selectedSkillId]);

  const skillOptions = useMemo<Lesson[]>(() => {
    return Array.isArray(activeCourse?.lessons) ? activeCourse.lessons : [];
  }, [activeCourse?.lessons]);

  const selectedSkill = useMemo(() => {
    if (!selectedSkillId) return null;
    return (
      skillOptions.find((lesson) => String(lesson.id) === String(selectedSkillId)) || null
    );
  }, [selectedSkillId, skillOptions]);

  useEffect(() => {
    if (overlayScope !== 'skill') return;
    if (skillOptions.length === 0) {
      setOverlayScope('course');
      setSelectedSkillId('');
      return;
    }
    if (selectedSkill) return;
    const fallbackSkill = routeLessonId
      ? skillOptions.find((lesson) => String(lesson.id) === String(routeLessonId))
      : null;
    setSelectedSkillId(String((fallbackSkill || skillOptions[0]).id));
  }, [overlayScope, routeLessonId, selectedSkill, skillOptions]);

  const effectiveScope: CTAOverlayScope =
    overlayScope === 'skill' && selectedSkill ? 'skill' : 'course';

  const resolvedCourseId = String(
    selectedCourseValue || selectedCourseId || activeCourse?.id || routeCourseId || '',
  ).trim();

  const buildRouteWithContext = useCallback(
    (route: string, options?: { includeLesson?: boolean; courseId?: string }) => {
      const includeLesson = options?.includeLesson !== false;
      const [rawPathname, rawQuery = ''] = String(route || '').split('?');
      const pathname = rawPathname || '/academy/cta-overlay-studio';
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
        fallbackUrl: CTA_VIDEO_PLACEHOLDER,
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
    const baseDuration =
      effectiveScope === 'skill'
        ? Number(selectedSkill?.duration || 0)
        : Number(activeCourse?.duration || 0);
    if (!Number.isFinite(baseDuration) || baseDuration <= 0) {
      return 289;
    }
    return Math.max(60, Math.round(baseDuration));
  }, [activeCourse?.duration, effectiveScope, selectedSkill?.duration]);

  const scopeResources = useMemo<Array<CourseResource | LessonResource>>(() => {
    if (effectiveScope === 'skill') {
      return Array.isArray(selectedSkill?.resources) ? selectedSkill.resources : [];
    }
    return Array.isArray(activeCourse?.resources) ? activeCourse.resources : [];
  }, [activeCourse?.resources, effectiveScope, selectedSkill?.resources]);

  const resourceDerivedOverlays = useMemo<CTAOverlayItem[]>(() => {
    const ctaResources = scopeResources.filter((resource) => {
      if (!isLikelyCtaResource(resource)) return false;
      if (effectiveScope === 'course') {
        return (
          resource.id.startsWith(CTA_RESOURCE_COURSE_PREFIX) ||
          (!resource.id.startsWith(CTA_RESOURCE_SKILL_PREFIX) &&
            resource.id.startsWith(CTA_RESOURCE_ID_PREFIX))
        );
      }
      const skillId = String(selectedSkill?.id || '');
      if (!skillId) return false;
      return resource.id.startsWith(`${CTA_RESOURCE_SKILL_PREFIX}${skillId}-`);
    });

    return ctaResources.map((resource, index) => {
      const range = parseRangeFromDescription(String(resource.description || ''));
      const safeTitle = String(resource.title || '')
        .replace(/^\[CTA\](\[(Course|Skill)\])?\s*/i, '')
        .trim();
      const triggerAt = range?.triggerAt ?? Math.max(5, 12 + index * 12);
      const endAt = range?.endAt ?? Math.min(targetDuration, triggerAt + 24);
      return normalizeOverlayTiming({
        id: resource.id.replace(CTA_RESOURCE_ID_PREFIX, '') || `cta-${Date.now()}-${index}`,
        name: safeTitle || `CTA ${index + 1}`,
        type: 'custom',
        title: safeTitle || tt('CTA-Studio', 'CTA Studio'),
        subtitle: tt('Legg til CTA-undertittel', 'Add CTA subtitle'),
        primaryLabel: tt('Primær handling', 'Primary Action'),
        secondaryLabel: tt('Avvis', 'Dismiss'),
        secondaryEnabled: true,
        urgency: tt('Begrenset vindu', 'Limited window'),
        url: resource.url || 'https://academy.creatorhub.no',
        triggerAt,
        endAt: Math.max(triggerAt, endAt),
        placement: 'bottom-center',
        enabled: true,
        abTestEnabled: false,
        animation: { ...defaultOverlayAnimation },
        style: {
          ...defaultOverlayStyle,
        },
        analytics: {
          ...defaultOverlayAnalytics,
          avgWatchBeforeTrigger: triggerAt,
        },
      }, targetDuration);
    });
  }, [effectiveScope, scopeResources, selectedSkill?.id, targetDuration, tt]);

  useEffect(() => {
    if (!selectedOverlayId && overlayItems.length > 0) {
      setSelectedOverlayId(overlayItems[0].id);
    }
  }, [overlayItems, selectedOverlayId]);

  useEffect(() => {
    if (!scopeStorageKey) return;
    if (hydratedScopeKeyRef.current === scopeStorageKey) return;
    hydratedScopeKeyRef.current = scopeStorageKey;

    const store = readOverlayStore();
    const stored = store[scopeStorageKey];

    if (stored && Array.isArray(stored.overlays) && stored.overlays.length > 0) {
      const normalizedStoredOverlays = stored.overlays.map((overlay) => ({
        ...normalizeOverlayTiming(overlay, targetDuration),
        style: normalizeOverlayStyle(overlay.style),
        analytics: normalizeOverlayAnalytics(overlay.analytics),
      }));
      replaceWithoutHistory(normalizedStoredOverlays);
      setSelectedOverlayId(normalizedStoredOverlays[0].id);
      setTriggerEnabled(stored.triggerEnabled ?? true);
      setResetToKeyframe(stored.resetToKeyframe ?? true);
      setLastPublishedAt(String(stored.publishedAt || ''));
      setHasSavedChangesSincePublish(hasSavedDraftNewerThanPublished(stored.updatedAt, stored.publishedAt));
      const nextDuration = Math.max(60, Number(stored.duration) || targetDuration);
      setDuration(nextDuration);
      setCurrentTime((prev) => Math.min(prev, nextDuration));
      return;
    }

    if (resourceDerivedOverlays.length > 0) {
      replaceWithoutHistory(resourceDerivedOverlays);
      setSelectedOverlayId(resourceDerivedOverlays[0].id);
      setTriggerEnabled(true);
      setResetToKeyframe(true);
      setLastPublishedAt('');
      setHasSavedChangesSincePublish(false);
      setDuration(targetDuration);
      setCurrentTime((prev) => Math.min(prev, targetDuration));
      return;
    }

    const defaults = defaultOverlays(tt).map((overlay) =>
      normalizeOverlayTiming(
        {
          ...overlay,
          style: normalizeOverlayStyle(overlay.style),
          analytics: normalizeOverlayAnalytics(overlay.analytics),
        },
        targetDuration,
      ),
    );
    replaceWithoutHistory(defaults);
    setSelectedOverlayId(defaults[0]?.id || '');
    setTriggerEnabled(true);
    setResetToKeyframe(true);
    setLastPublishedAt('');
    setHasSavedChangesSincePublish(false);
    setDuration(targetDuration);
    setCurrentTime((prev) => Math.min(prev, targetDuration));
  }, [resourceDerivedOverlays, scopeStorageKey, targetDuration, tt]);

  useEffect(() => {
    if (!scopeStorageKey) return;
    let cancelled = false;

    void (async () => {
      const localStore = readOverlayStore();
      const dbStore = await readOverlayStoreFromDb();
      if (cancelled) return;

      if (!dbStore) {
        if (Object.keys(localStore).length > 0) {
          void writeOverlayStoreToDb(localStore);
        }
        return;
      }

      const mergedStore = mergeOverlayStores(localStore, dbStore);
      const mergedSerialized = JSON.stringify(mergedStore);

      if (mergedSerialized && JSON.stringify(localStore) !== mergedSerialized) {
        writeOverlayStore(mergedStore);
      }
      if (mergedSerialized && JSON.stringify(dbStore) !== mergedSerialized) {
        void writeOverlayStoreToDb(mergedStore);
      }

      const mergedEntry = mergedStore[scopeStorageKey];
      if (!mergedEntry || !Array.isArray(mergedEntry.overlays) || mergedEntry.overlays.length === 0) {
        setLastPublishedAt('');
        setHasSavedChangesSincePublish(false);
        return;
      }

      const normalizedStoredOverlays = mergedEntry.overlays.map((overlay) => ({
        ...normalizeOverlayTiming(overlay, targetDuration),
        style: normalizeOverlayStyle(overlay.style),
        analytics: normalizeOverlayAnalytics(overlay.analytics),
      }));
      replaceWithoutHistory(normalizedStoredOverlays);
      setSelectedOverlayId(normalizedStoredOverlays[0]?.id || '');
      setTriggerEnabled(mergedEntry.triggerEnabled ?? true);
      setResetToKeyframe(mergedEntry.resetToKeyframe ?? true);
      setLastPublishedAt(String(mergedEntry.publishedAt || ''));
      setHasSavedChangesSincePublish(hasSavedDraftNewerThanPublished(mergedEntry.updatedAt, mergedEntry.publishedAt));
      const nextDuration = Math.max(60, Number(mergedEntry.duration) || targetDuration);
      setDuration(nextDuration);
      setCurrentTime((prev) => Math.min(prev, nextDuration));
    })();

    return () => {
      cancelled = true;
    };
  }, [replaceWithoutHistory, scopeStorageKey, targetDuration]);

  useEffect(() => {
    analytics.trackEvent('academy_cta_overlay_studio_opened', {
      courseId: activeCourse?.id || null,
      scope: effectiveScope,
      lessonId: effectiveScope === 'skill' ? selectedSkill?.id || null : null,
      instructorId: effectiveInstructor?.id || null,
      overlayCount: overlayItems.length,
      timestamp: Date.now(),
    });
    debugging.logIntegration('info', 'AcademyCTAOverlayStudio opened', {
      courseId: activeCourse?.id || null,
      scope: effectiveScope,
      lessonId: effectiveScope === 'skill' ? selectedSkill?.id || null : null,
      instructorId: effectiveInstructor?.id || null,
      overlayCount: overlayItems.length,
    });
  }, [
    activeCourse?.id,
    analytics,
    debugging,
    effectiveInstructor?.id,
    effectiveScope,
    overlayItems.length,
    selectedSkill?.id,
  ]);

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
    (value: number) => {
      const next = Math.min(duration, Math.max(0, value));
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

  const toggleStudentPreview = useCallback(() => {
    togglePlayback();
  }, [togglePlayback]);

  const activeOverlayId = useMemo(() => {
    if (selectedOverlayId && overlayItems.some((overlay) => overlay.id === selectedOverlayId)) {
      return selectedOverlayId;
    }
    return overlayItems[0]?.id || '';
  }, [overlayItems, selectedOverlayId]);

  const selectedOverlay = useMemo(() => {
    if (!activeOverlayId) return null;
    return overlayItems.find((overlay) => overlay.id === activeOverlayId) || null;
  }, [activeOverlayId, overlayItems]);

  useEffect(() => {
    if (activeOverlayId && selectedOverlayId !== activeOverlayId) {
      setSelectedOverlayId(activeOverlayId);
    }
  }, [activeOverlayId, selectedOverlayId]);

  const selectedOverlayAnimation = useMemo<CTAOverlayItem['animation']>(() => {
    const animation = selectedOverlay?.animation;
    const type =
      animation?.type && animation.type in ctaAnimationKeyframes
        ? animation.type
        : defaultOverlayAnimation.type;
    return {
      ...defaultOverlayAnimation,
      ...(animation || {}),
      type,
      enabled: animation?.enabled ?? defaultOverlayAnimation.enabled,
      duration: Number.isFinite(animation?.duration)
        ? Math.max(0.1, Number(animation?.duration))
        : defaultOverlayAnimation.duration,
      delay: Number.isFinite(animation?.delay)
        ? Math.max(0, Number(animation?.delay))
        : defaultOverlayAnimation.delay,
      easing: animation?.easing ?? defaultOverlayAnimation.easing,
    };
  }, [selectedOverlay]);

  const selectedOverlayStyle = useMemo<CTAOverlayItem['style']>(() => {
    return normalizeOverlayStyle(selectedOverlay?.style);
  }, [selectedOverlay?.style]);

  const selectedOverlayAnalytics = useMemo<CTAOverlayItem['analytics']>(() => {
    return normalizeOverlayAnalytics(selectedOverlay?.analytics);
  }, [selectedOverlay?.analytics]);

  useEffect(() => {
    if (!selectedOverlay) {
      setTriggerAtInput('0:00');
      setEndAtInput('0:00');
      return;
    }
    setTriggerAtInput(formatTime(selectedOverlay.triggerAt));
    setEndAtInput(formatTime(selectedOverlay.endAt));
  }, [selectedOverlay?.id, selectedOverlay?.triggerAt, selectedOverlay?.endAt]);

  const filteredOverlays = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return overlayItems;
    return overlayItems.filter((overlay) => {
      return overlay.name.toLowerCase().includes(query) || overlay.title.toLowerCase().includes(query);
    });
  }, [overlayItems, search]);

  const overlayCanRender = Boolean(selectedOverlay && selectedOverlay.enabled && triggerEnabled);

  const liveOverlayVisible = Boolean(
    selectedOverlay &&
      selectedOverlay.enabled &&
      triggerEnabled &&
      currentTime >= selectedOverlay.triggerAt &&
      currentTime <= selectedOverlay.endAt,
  );

  const showOverlayDraftPreview = Boolean(
    overlayCanRender && (liveOverlayVisible || editorMode === 'edit'),
  );

  const triggerOverlayAnimation = useCallback(() => {
    setAnimateOverlayOnce(false);
    if (typeof window === 'undefined') {
      setAnimateOverlayOnce(true);
      return;
    }
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    animationFrameRef.current = window.requestAnimationFrame(() => {
      setAnimateOverlayOnce(true);
      animationFrameRef.current = null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    overlayVisibilityRef.current = false;
    setAnimateOverlayOnce(false);
  }, [selectedOverlay?.id]);

  useEffect(() => {
    const becameVisible = liveOverlayVisible && !overlayVisibilityRef.current;
    overlayVisibilityRef.current = liveOverlayVisible;
    if (becameVisible) {
      if (selectedOverlayAnimation.enabled) {
        triggerOverlayAnimation();
      }
    } else if (!liveOverlayVisible) {
      setAnimateOverlayOnce(false);
    }
  }, [liveOverlayVisible, selectedOverlayAnimation.enabled, triggerOverlayAnimation]);

  const ctr = useMemo(() => {
    if (!selectedOverlay) return 0;
    if (!selectedOverlayAnalytics.views) return 0;
    return Number(((selectedOverlayAnalytics.clicks / selectedOverlayAnalytics.views) * 100).toFixed(1));
  }, [selectedOverlay, selectedOverlayAnalytics]);

  const conversionRate = useMemo(() => {
    if (!selectedOverlay) return 0;
    if (!selectedOverlayAnalytics.views) return 0;
    return Number(((selectedOverlayAnalytics.conversions / selectedOverlayAnalytics.views) * 100).toFixed(1));
  }, [selectedOverlay, selectedOverlayAnalytics]);

  const uplift = useMemo(() => {
    if (!selectedOverlay) return 0;
    return Math.round((selectedOverlayAnalytics.variantA - selectedOverlayAnalytics.variantB) * 10);
  }, [selectedOverlay, selectedOverlayAnalytics]);

  const selectedGoalProgress = useMemo(() => {
    const percentage = (value: number, target: number): number => {
      if (!Number.isFinite(target) || target <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
    };
    return {
      views: percentage(selectedOverlayAnalytics.views, selectedOverlayAnalytics.targetViews),
      ctr: percentage(ctr, selectedOverlayAnalytics.targetCtr),
      conversions: percentage(
        selectedOverlayAnalytics.conversions,
        selectedOverlayAnalytics.targetConversions,
      ),
      revenue: percentage(selectedOverlayAnalytics.revenue, selectedOverlayAnalytics.targetRevenue),
    };
  }, [ctr, selectedOverlayAnalytics]);

  const qualityIssues = useMemo(
    () => validateOverlayItems(overlayItems, duration, tt),
    [overlayItems, duration, tt],
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

  const setSelectedOverlayField = useCallback(
    <K extends keyof CTAOverlayItem>(field: K, value: CTAOverlayItem[K]) => {
      if (!activeOverlayId) return;
      snapshotBeforeChange(tt('Rediger CTA', 'Edit CTA'));
      setOverlayItems((prev) =>
        prev.map((item) => {
          if (item.id !== activeOverlayId) return item;
          return { ...item, [field]: value };
        }),
      );
    },
    [activeOverlayId, snapshotBeforeChange, tt],
  );

  const setSelectedStyleField = useCallback(
    <K extends keyof CTAOverlayItem['style']>(field: K, value: CTAOverlayItem['style'][K]) => {
      if (!activeOverlayId) return;
      snapshotBeforeChange(tt('Oppdater CTA-stil', 'Update CTA style'));
      setOverlayItems((prev) =>
        prev.map((item) => {
          if (item.id !== activeOverlayId) return item;
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
    [activeOverlayId, snapshotBeforeChange, tt],
  );

  const setSelectedAnimationField = useCallback(
    <K extends keyof CTAOverlayItem['animation']>(
      field: K,
      value: CTAOverlayItem['animation'][K],
    ) => {
      if (!activeOverlayId) return;
      snapshotBeforeChange(tt('Oppdater CTA-animasjon', 'Update CTA animation'));
      setOverlayItems((prev) =>
        prev.map((item) => {
          if (item.id !== activeOverlayId) return item;
          return {
            ...item,
            animation: {
              ...defaultOverlayAnimation,
              ...(item.animation || {}),
              [field]: value,
            },
          };
        }),
      );
    },
    [activeOverlayId, snapshotBeforeChange, tt],
  );

  const setSelectedAnalyticsField = useCallback(
    <K extends keyof CTAOverlayItem['analytics']>(
      field: K,
      value: CTAOverlayItem['analytics'][K],
    ) => {
      if (!activeOverlayId) return;
      snapshotBeforeChange(tt('Oppdater CTA-analyse', 'Update CTA analytics'));
      setOverlayItems((prev) =>
        prev.map((item) => {
          if (item.id !== activeOverlayId) return item;
          return {
            ...item,
            analytics: {
              ...item.analytics,
              [field]: value,
            },
          };
        }),
      );
    },
    [activeOverlayId, snapshotBeforeChange, tt],
  );

  const applySelectedTimelineRange = useCallback(
    (nextStart: number, nextEnd: number) => {
      if (!activeOverlayId) return;
      const snappedStart = timelineSnapEnabled
        ? snapTimelineTime(nextStart, currentTime, duration)
        : clamp(nextStart, 0, duration);
      const snappedEnd = timelineSnapEnabled
        ? snapTimelineTime(nextEnd, currentTime, duration)
        : clamp(nextEnd, 0, duration);
      const minEnd = Math.min(
        duration,
        Math.max(
          snappedStart + CTA_MIN_DURATION_SECONDS,
          timelineSnapEnabled
            ? snapTimelineTime(snappedStart + CTA_MIN_DURATION_SECONDS, currentTime, duration)
            : snappedStart + CTA_MIN_DURATION_SECONDS,
        ),
      );
      const safeEnd = clamp(Math.max(snappedEnd, minEnd), 0, duration);

      snapshotBeforeChange(tt('Juster CTA-tidslinje', 'Adjust CTA timeline'));
      setOverlayItems((prev) =>
        prev.map((item) =>
          item.id === activeOverlayId
            ? {
                ...item,
                triggerAt: snappedStart,
                endAt: safeEnd,
                analytics: {
                  ...item.analytics,
                  avgWatchBeforeTrigger: snappedStart,
                },
              }
            : item,
        ),
      );
      setTriggerAtInput(formatTime(snappedStart));
      setEndAtInput(formatTime(safeEnd));
    },
    [
      activeOverlayId,
      currentTime,
      duration,
      snapshotBeforeChange,
      timelineSnapEnabled,
      tt,
    ],
  );

  const addOverlay = useCallback(() => {
    snapshotBeforeChange(tt('Legg til CTA', 'Add CTA'), { force: true });
    const next: CTAOverlayItem = {
      id: `cta-${Date.now()}`,
      name: tt(`Ny CTA ${overlayItems.length + 1}`, `New CTA ${overlayItems.length + 1}`),
      type: 'custom',
      title: tt('Ny CTA-tittel', 'New CTA title'),
      subtitle: tt('Legg til CTA-undertittel', 'Add CTA subtitle'),
      primaryLabel: tt('Primær handling', 'Primary Action'),
      secondaryLabel: tt('Avvis', 'Dismiss'),
      secondaryEnabled: true,
      urgency: tt('Begrenset vindu', 'Limited window'),
      url: 'https://academy.creatorhub.no',
      triggerAt: Math.max(5, Math.round(currentTime)),
      endAt: Math.min(duration, Math.round(currentTime + 35)),
      placement: 'bottom-center',
      enabled: true,
      abTestEnabled: false,
      animation: {
        ...defaultOverlayAnimation,
        type: 'slide-up',
        duration: 0.7,
      },
      style: {
        ...defaultOverlayStyle,
      },
      analytics: {
        ...defaultOverlayAnalytics,
        avgWatchBeforeTrigger: Math.round(currentTime),
      },
    };
    setOverlayItems((prev) => [normalizeOverlayTiming(next, duration), ...prev]);
    setSelectedOverlayId(next.id);
    setSearch('');
    setRightTab('performance');
    setEditorTab('content');
    setSaveMessage(tt(`Overlay ${next.name} lagt til.`, `Overlay ${next.name} added.`));
  }, [currentTime, duration, overlayItems.length, snapshotBeforeChange, tt]);

  const commitTriggerAtInput = useCallback(() => {
    if (!selectedOverlay) return;
    const parsed = parseMinuteSecondTime(triggerAtInput, selectedOverlay.triggerAt);
    const snapped = timelineSnapEnabled
      ? snapTimelineTime(parsed, currentTime, duration)
      : Math.min(duration, Math.max(0, parsed));
    const nextTrigger = Math.min(
      snapped,
      Math.max(0, selectedOverlay.endAt - CTA_MIN_DURATION_SECONDS),
    );
    setSelectedOverlayField('triggerAt', nextTrigger);
    setTriggerAtInput(formatTime(nextTrigger));
  }, [currentTime, duration, selectedOverlay, setSelectedOverlayField, timelineSnapEnabled, triggerAtInput]);

  const commitEndAtInput = useCallback(() => {
    if (!selectedOverlay) return;
    const parsed = parseMinuteSecondTime(endAtInput, selectedOverlay.endAt);
    const snapped = timelineSnapEnabled
      ? snapTimelineTime(parsed, currentTime, duration)
      : Math.min(duration, Math.max(0, parsed));
    const nextEnd = Math.max(selectedOverlay.triggerAt + CTA_MIN_DURATION_SECONDS, snapped);
    setSelectedOverlayField('endAt', nextEnd);
    setEndAtInput(formatTime(nextEnd));
  }, [currentTime, duration, endAtInput, selectedOverlay, setSelectedOverlayField, timelineSnapEnabled]);

  const commitDurationInput = useCallback(() => {
    const parsed = parseMinuteSecondTime(durationInput, duration);
    const next = Math.max(60, parsed);
    setDuration(next);
    setCurrentTime((prev) => Math.min(prev, next));
    setDurationInput(formatTime(next));
  }, [duration, durationInput]);

  useEffect(() => {
    setDurationInput(formatTime(duration));
  }, [duration]);

  const duplicateOverlay = useCallback(() => {
    if (!selectedOverlay) return;
    snapshotBeforeChange(tt('Dupliser CTA', 'Duplicate CTA'), { force: true });
    const clone: CTAOverlayItem = {
      ...selectedOverlay,
      id: `cta-${Date.now()}-copy`,
      name: `${selectedOverlay.name} Copy`,
      triggerAt: Math.min(duration - 5, selectedOverlay.triggerAt + 8),
      endAt: Math.min(duration, selectedOverlay.endAt + 8),
    };
    setOverlayItems((prev) => [clone, ...prev]);
    setSelectedOverlayId(clone.id);
    setSaveMessage(tt(`Dupliserte ${selectedOverlay.name}.`, `Duplicated ${selectedOverlay.name}.`));
  }, [duration, selectedOverlay, snapshotBeforeChange, tt]);

  const removeOverlay = useCallback(
    (overlayId?: string) => {
      const targetId = overlayId || selectedOverlay?.id;
      if (!targetId) {
        setSaveMessage(tt('Ingen CTA er valgt.', 'No CTA is selected.'));
        return;
      }

      const index = overlayItems.findIndex((item) => item.id === targetId);
      if (index === -1) {
        setSaveMessage(tt('Fant ikke valgt CTA.', 'Could not find selected CTA.'));
        return;
      }

      const removed = overlayItems[index];
      const next = overlayItems.filter((item) => item.id !== targetId);
      const nextSelectedId = next[Math.min(index, next.length - 1)]?.id || '';

      snapshotBeforeChange(tt('Slett CTA', 'Delete CTA'), { force: true });
      setOverlayItems(next);
      setSelectedOverlayId(nextSelectedId);
      setSaveMessage(tt(`Fjernet ${removed.name}.`, `Removed ${removed.name}.`));
    },
    [overlayItems, selectedOverlay?.id, snapshotBeforeChange, tt],
  );

  const runAutoFix = useCallback(() => {
    if (qualityIssues.length === 0) return;
    snapshotBeforeChange(tt('Auto-fiks CTA', 'Auto-fix CTA'), { force: true });
    const fixed = applyOverlayAutoFixes(overlayItems, duration);
    setOverlayItems(fixed);
    setSaveMessage(
      tt(
        `Auto-fiks brukte ${qualityIssues.length} justeringer.`,
        `Auto-fix applied ${qualityIssues.length} adjustments.`,
      ),
    );
  }, [duration, overlayItems, qualityIssues.length, snapshotBeforeChange, tt]);

  const applyCurrentOverlaysToAllSkills = useCallback(async () => {
    if (effectiveScope !== 'skill' || !activeCourse || !selectedSkill || skillOptions.length <= 1) return;

    const payload = overlayItems.map((overlay) =>
      normalizeOverlayTiming(
        {
          ...overlay,
          style: normalizeOverlayStyle(overlay.style),
          analytics: normalizeOverlayAnalytics(overlay.analytics),
        },
        duration,
      ),
    );

    try {
      await Promise.all(
        skillOptions.map(async (lesson) => {
          const lessonResources = Array.isArray(lesson.resources) ? lesson.resources : [];
          const skillPrefix = `${CTA_RESOURCE_SKILL_PREFIX}${String(lesson.id)}-`;
          const mappedResources = payload.map((overlay) => ({
            id: `${CTA_RESOURCE_SKILL_PREFIX}${String(lesson.id)}-${overlay.id}`,
            type: 'link' as const,
            title: `[CTA][Skill] ${overlay.title}`,
            url: overlay.url,
            description: `${overlay.name} · ${formatTime(overlay.triggerAt)}-${formatTime(overlay.endAt)} · ${String(lesson.title || '')}`,
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
          `CTA-oppsettet ble brukt på ${skillOptions.length} ferdigheter.`,
          `CTA setup applied to ${skillOptions.length} skills.`,
        ),
      );
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : tt('Kunne ikke bruke CTA på alle ferdigheter.', 'Could not apply CTA to all skills.'),
      );
    }
  }, [
    activeCourse,
    duration,
    effectiveScope,
    overlayItems,
    selectedSkill,
    skillOptions,
    tt,
    updateLesson,
  ]);

  const undoOverlays = useCallback(() => {
    if (!canUndo) return;
    undo();
    setSaveMessage(tt('Siste CTA-endring angret.', 'Undid last CTA change.'));
  }, [canUndo, tt, undo]);

  const redoOverlays = useCallback(() => {
    if (!canRedo) return;
    redo();
    setSaveMessage(tt('Gjorde om siste CTA-endring.', 'Redid last CTA change.'));
  }, [canRedo, redo, tt]);

  const autoSaveSignature = useMemo(
    () =>
      JSON.stringify({
        scopeStorageKey,
        duration,
        triggerEnabled,
        resetToKeyframe,
        overlayItems,
      }),
    [duration, overlayItems, resetToKeyframe, scopeStorageKey, triggerEnabled],
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
      const store = readOverlayStore();
      const previousEntry = store[scopeStorageKey];
      store[scopeStorageKey] = {
        overlays: overlayItems.map((overlay) =>
          normalizeOverlayTiming(
            {
              ...overlay,
              style: normalizeOverlayStyle(overlay.style),
              analytics: normalizeOverlayAnalytics(overlay.analytics),
            },
            duration,
          ),
        ),
        triggerEnabled,
        resetToKeyframe,
        duration,
        updatedAt: new Date().toISOString(),
        publishedAt: previousEntry?.publishedAt,
      };
      writeOverlayStore(store);
      void writeOverlayStoreToDb(store);
      lastAutoSavedSignatureRef.current = autoSaveSignature;
      setLastPublishedAt(String(previousEntry?.publishedAt || ''));
      setHasSavedChangesSincePublish(Boolean(previousEntry?.publishedAt));
      markSaved();
    }, 650);

    return () => window.clearTimeout(timer);
  }, [
    autoSaveSignature,
    duration,
    markDirty,
    markSaved,
    markSaving,
    overlayItems,
    resetToKeyframe,
    scopeStorageKey,
    triggerEnabled,
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
      if ((lower === 'backspace' || lower === 'delete') && selectedOverlay) {
        event.preventDefault();
        removeOverlay(selectedOverlay.id);
        return;
      }
      if ((lower === 'arrowleft' || lower === 'arrowright') && selectedOverlay) {
        event.preventDefault();
        const direction = lower === 'arrowleft' ? -1 : 1;
        const step = event.shiftKey ? 1 : 0.5;
        applySelectedTimelineRange(
          selectedOverlay.triggerAt + direction * step,
          selectedOverlay.endAt + direction * step,
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [applySelectedTimelineRange, removeOverlay, selectedOverlay]);

  const overallAnalytics = useMemo(() => {
    const totals = overlayItems.reduce(
      (acc, overlay) => {
        acc.views += overlay.analytics.views;
        acc.clicks += overlay.analytics.clicks;
        acc.conversions += overlay.analytics.conversions;
        acc.revenue += overlay.analytics.revenue;
        return acc;
      },
      { views: 0, clicks: 0, conversions: 0, revenue: 0 },
    );

    const overallCtr = totals.views > 0 ? Number(((totals.clicks / totals.views) * 100).toFixed(1)) : 0;
    const overallConversionRate =
      totals.views > 0 ? Number(((totals.conversions / totals.views) * 100).toFixed(1)) : 0;

    return {
      ...totals,
      overallCtr,
      overallConversionRate,
    };
  }, [overlayItems]);

  const saveOverlaySetup = useCallback(
    async (publish: boolean) => {
      setSaveMessage('');

      const course = activeCourse;
      const skill = selectedSkill;
      const scope = effectiveScope;

      if (scope === 'skill' && !skill) {
        setSaveMessage(tt('Velg en ferdighet før lagring.', 'Select a skill before saving.'));
        return;
      }

      const normalizedOverlays = overlayItems.map((overlay) =>
        normalizeOverlayTiming(
          {
            ...overlay,
            style: normalizeOverlayStyle(overlay.style),
            analytics: normalizeOverlayAnalytics(overlay.analytics),
          },
          duration,
        ),
      );

      const payload = {
        courseId: course?.id || null,
        scope,
        lessonId: scope === 'skill' ? skill?.id || null : null,
        instructorId: effectiveInstructor?.id || null,
        overlays: normalizedOverlays,
        triggerEnabled,
        resetToKeyframe,
        publish,
      };
      const now = new Date().toISOString();
      let persistedPublishedAt = '';

      try {
        const existing = course ? state.courses.find((entry) => entry.id === course.id) : undefined;

        if (existing) {
          const ctaResources = normalizedOverlays.map((overlay) => ({
            id:
              scope === 'skill'
                ? `${CTA_RESOURCE_SKILL_PREFIX}${String(skill?.id || 'unknown')}-${overlay.id}`
                : `${CTA_RESOURCE_COURSE_PREFIX}${overlay.id}`,
            type: 'link' as const,
            title:
              scope === 'skill'
                ? `[CTA][Skill] ${overlay.title}`
                : `[CTA][Course] ${overlay.title}`,
            url: overlay.url,
            description:
              scope === 'skill'
                ? `${overlay.name} · ${formatTime(overlay.triggerAt)}-${formatTime(overlay.endAt)} · ${String(skill?.title || '')}`
                : `${overlay.name} · ${formatTime(overlay.triggerAt)}-${formatTime(overlay.endAt)}`,
          }));

          if (scope === 'skill' && skill) {
            const lessonResources = Array.isArray(skill.resources) ? skill.resources : [];
            const skillPrefix = `${CTA_RESOURCE_SKILL_PREFIX}${String(skill.id)}-`;
            await updateLesson({
              ...skill,
              resources: [
                ...lessonResources.filter((resource) => !resource.id.startsWith(skillPrefix)),
                ...ctaResources,
              ],
            });
          } else {
            const resources = Array.isArray(existing.resources) ? existing.resources : [];
            await updateCourse({
              ...existing,
              isPublished: publish ? true : existing.isPublished,
              tags: Array.from(new Set([...(existing.tags || []), 'cta-overlays', 'conversion'])),
              resources: [
                ...resources.filter(
                  (resource) =>
                    !resource.id.startsWith(CTA_RESOURCE_COURSE_PREFIX) &&
                    !(
                      resource.id.startsWith(CTA_RESOURCE_ID_PREFIX) &&
                      !resource.id.startsWith(CTA_RESOURCE_SKILL_PREFIX)
                    ),
                ),
                ...ctaResources,
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
          const store = readOverlayStore();
          const previousEntry = store[key];
          persistedPublishedAt = String(previousEntry?.publishedAt || '');
          store[key] = {
            overlays: normalizedOverlays,
            triggerEnabled,
            resetToKeyframe,
            duration,
            updatedAt: now,
            publishedAt: publish ? now : persistedPublishedAt || undefined,
          };
          writeOverlayStore(store);
          void writeOverlayStoreToDb(store);
        }

        onSave?.(payload);
        addVersion(tt('Lagre CTA-oppsett', 'Save CTA setup'), normalizedOverlays);
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
            ? tt('CTA-Studio publisert.', 'CTA Studio published.')
            : scope === 'skill'
              ? tt('CTA-Studio lagret for ferdighet.', 'CTA Studio saved for skill.')
              : tt('CTA-Studio lagret for kurs.', 'CTA Studio saved for course.'),
        );

        analytics.trackEvent('academy_cta_overlay_saved', {
          courseId: course?.id || null,
          scope,
          lessonId: scope === 'skill' ? skill?.id || null : null,
          instructorId: effectiveInstructor?.id || null,
          overlayCount: normalizedOverlays.length,
          publish,
          timestamp: Date.now(),
        });
      } catch (error) {
        setSaveMessage(
          error instanceof Error
            ? error.message
            : tt('Kunne ikke lagre CTA-Studio-oppsett.', 'Could not save CTA Studio setup.'),
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
      markSaved,
      onSave,
      overlayItems,
      resetToKeyframe,
      selectedSkill,
      state.courses,
      tt,
      triggerEnabled,
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
          activeCourseId={activeCourse?.id || selectedCourseValue || null}
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
              '& .cta-section-title': {
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: 'clamp(1.2rem, 1rem + 0.75vw, 1.55rem)',
                lineHeight: 1.12,
                letterSpacing: '0.01em',
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
                '& .cta-section-title': {
                  fontSize: 'clamp(1.35rem, 1.05rem + 0.55vw, 1.9rem)',
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
                '& .cta-section-title': {
                  fontSize: 'clamp(1.45rem, 1.15rem + 0.5vw, 2.05rem)',
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
            <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: { xs: 1.1, md: 1.25 } }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', md: 'center' }}
              >
                <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontSize: 'clamp(1.65rem, 1.3rem + 1.1vw, 2.05rem)', fontWeight: 700, letterSpacing: '0.015em', lineHeight: 1.1 }}>
                    {tt('CTA-Studio', 'CTA Studio')}
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
                      ...CTA_NEUTRAL_OUTLINED_BUTTON_SX,
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
                      <IconButton size="small" onClick={undoOverlays} disabled={!canUndo} sx={CTA_NEUTRAL_ICON_BUTTON_SX}>
                        <Undo fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={tt('Gjør om (Cmd/Ctrl+Shift+Z)', 'Redo (Cmd/Ctrl+Shift+Z)')}>
                    <span>
                      <IconButton size="small" onClick={redoOverlays} disabled={!canRedo} sx={CTA_NEUTRAL_ICON_BUTTON_SX}>
                        <Redo fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Button
                    variant="outlined"
                    startIcon={<AutoFixHigh />}
                    disabled={qualityIssues.length === 0}
                    onClick={runAutoFix}
                    sx={CTA_WARNING_OUTLINED_BUTTON_SX}
                  >
                    {tt('Auto-fiks', 'Auto-fix')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={isPlaying ? <Visibility /> : <VisibilityOff />}
                    onClick={toggleStudentPreview}
                    sx={{
                      ...CTA_NEUTRAL_OUTLINED_BUTTON_SX,
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
                    onClick={() => void saveOverlaySetup(false)}
                    sx={CTA_SAVE_BUTTON_SX}
                  >
                    {tt('Lagre', 'Save')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Publish />}
                    onClick={() => void saveOverlaySetup(true)}
                    sx={CTA_PUBLISH_BUTTON_SX}
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
                  value={overlayScope}
                  onChange={(event) => setOverlayScope(event.target.value as CTAOverlayScope)}
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
                {overlayScope === 'skill' && (
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
                  <Stack direction="row" spacing={0.4} sx={CTA_TOOLBAR_GROUP_SX}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AdsClick />}
                      onClick={() => setEditorMode('select')}
                      sx={{
                        ...CTA_NEUTRAL_OUTLINED_BUTTON_SX,
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
                        ...CTA_NEUTRAL_OUTLINED_BUTTON_SX,
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
                  <Stack direction="row" spacing={0.4} sx={CTA_TOOLBAR_GROUP_SX}>
                    <Button
                      size="small"
                      startIcon={<CropSquare />}
                      onClick={() => setSafeAreaEnabled((prev) => !prev)}
                      sx={{
                        ...CTA_NEUTRAL_OUTLINED_BUTTON_SX,
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
                        ...CTA_NEUTRAL_OUTLINED_BUTTON_SX,
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
                          void applyCurrentOverlaysToAllSkills();
                        }}
                        sx={CTA_WARNING_OUTLINED_BUTTON_SX}
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
                  <Stack direction="row" spacing={0.4} sx={CTA_TOOLBAR_GROUP_SX}>
                    <Button
                      size="small"
                      startIcon={<CropSquare />}
                      onClick={() => setSafeAreaEnabled((prev) => !prev)}
                      sx={{
                        ...CTA_NEUTRAL_OUTLINED_BUTTON_SX,
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
                        ...CTA_NEUTRAL_OUTLINED_BUTTON_SX,
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
                    border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_SUBTLE}`,
                    overflow: 'hidden',
                    position: 'relative',
                    aspectRatio: '16 / 9',
                    background:
                      'radial-gradient(circle at 70% 18%, rgba(248,179,33,0.45), rgba(8,12,20,0) 46%), linear-gradient(140deg, rgba(17,26,38,0.95), rgba(8,12,19,0.96))',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'radial-gradient(circle at 26% 30%, rgba(108,148,220,0.2), rgba(8,12,19,0) 40%), radial-gradient(circle at 86% 24%, rgba(255,171,64,0.22), rgba(8,12,19,0) 36%)',
                    }}
                  />

                  {safeAreaEnabled && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: `${CTA_SAFE_AREA_MARGIN_PERCENT}%`,
                        right: `${CTA_SAFE_AREA_MARGIN_PERCENT}%`,
                        bottom: `${CTA_SAFE_AREA_MARGIN_PERCENT}%`,
                        left: `${CTA_SAFE_AREA_MARGIN_PERCENT}%`,
                        border: `1px dashed ${alpha('#f8d675', 0.72)}`,
                        borderRadius: 1,
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    />
                  )}

                  {selectedOverlay && showOverlayDraftPreview && (
                    <Box
                      onAnimationEnd={() => setAnimateOverlayOnce(false)}
                      sx={{
                        position: 'absolute',
                        width: { xs: '90%', md: '65%' },
                        left:
                          selectedOverlay.placement === 'bottom-right'
                            ? '33%'
                            : selectedOverlay.placement === 'center'
                              ? '17%'
                              : selectedOverlay.placement === 'top-right'
                                ? '30%'
                                : '17%',
                        top:
                          selectedOverlay.placement === 'center'
                            ? '36%'
                            : selectedOverlay.placement === 'top-right'
                              ? '10%'
                              : '58%',
                        transform: selectedOverlay.placement === 'center' ? 'translateY(-50%)' : 'none',
                        borderRadius: `${selectedOverlayStyle.borderRadius}px`,
                        border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_DEFAULT}`,
                        background: selectedOverlayStyle.bg,
                        color: selectedOverlayStyle.text,
                        p: 1.6,
                        opacity: liveOverlayVisible ? selectedOverlayStyle.opacity : 0.9,
                        visibility: 'visible',
                        pointerEvents: editorMode === 'edit' || liveOverlayVisible ? 'auto' : 'none',
                        transition: 'opacity 180ms ease, transform 180ms ease',
                        boxShadow: '0 18px 34px rgba(0,0,0,0.45)',
                        zIndex: 3,
                        ...(selectedOverlayAnimation.enabled && liveOverlayVisible && animateOverlayOnce
                          ? {
                              animation: `${ctaAnimationKeyframes[selectedOverlayAnimation.type]} ${selectedOverlayAnimation.duration}s ${selectedOverlayAnimation.easing} ${selectedOverlayAnimation.delay}s both`,
                            }
                          : { animation: 'none' }),
                      }}
                    >
                      {!liveOverlayVisible && (
                        <Chip
                          size="small"
                          label={tt('Live draft', 'Live draft')}
                          sx={{
                            mb: 0.8,
                            bgcolor: 'rgba(248,179,33,0.2)',
                            color: '#f8d675',
                          }}
                        />
                      )}
                      <Typography
                        contentEditable={editorMode === 'edit'}
                        suppressContentEditableWarning
                        onBlur={(event) => {
                          if (editorMode !== 'edit') return;
                          setSelectedOverlayField('title', event.currentTarget.textContent || '');
                        }}
                        sx={{
                          fontSize: `${selectedOverlayStyle.fontSize}px`,
                          lineHeight: 1,
                          fontFamily: selectedOverlayStyle.fontFamily,
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
                        {selectedOverlay.title}
                      </Typography>
                      <Typography
                        contentEditable={editorMode === 'edit'}
                        suppressContentEditableWarning
                        onBlur={(event) => {
                          if (editorMode !== 'edit') return;
                          setSelectedOverlayField('subtitle', event.currentTarget.textContent || '');
                        }}
                        sx={{
                          color: alpha(selectedOverlayStyle.text, 0.9),
                          mt: 0.3,
                          fontSize: `${Math.max(14, Math.round(selectedOverlayStyle.fontSize * 0.48))}px`,
                          fontFamily: selectedOverlayStyle.fontFamily,
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
                        {selectedOverlay.subtitle}
                      </Typography>

                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Box
                          component={editorMode === 'edit' ? 'span' : 'button'}
                          contentEditable={editorMode === 'edit'}
                          suppressContentEditableWarning
                          onBlur={(event: React.FocusEvent<HTMLElement>) => {
                            if (editorMode !== 'edit') return;
                            setSelectedOverlayField('primaryLabel', event.currentTarget.textContent || '');
                          }}
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            color: selectedOverlayStyle.buttonText,
                            background: selectedOverlayStyle.button,
                            px: 2.2,
                            py: 0.6,
                            fontWeight: 700,
                            fontSize: `${Math.max(14, Math.round(selectedOverlayStyle.fontSize * 0.52))}px`,
                            borderRadius: 1,
                            outline: 'none',
                            border:
                              editorMode === 'edit'
                                ? `1px dashed ${alpha('#f8d675', 0.42)}`
                                : 'none',
                            cursor: editorMode === 'edit' ? 'text' : 'pointer',
                          }}
                        >
                          {selectedOverlay.primaryLabel}
                        </Box>
                        {selectedOverlay.secondaryEnabled && (
                          <Box
                            component={editorMode === 'edit' ? 'span' : 'button'}
                            contentEditable={editorMode === 'edit'}
                            suppressContentEditableWarning
                            onBlur={(event: React.FocusEvent<HTMLElement>) => {
                              if (editorMode !== 'edit') return;
                              setSelectedOverlayField('secondaryLabel', event.currentTarget.textContent || '');
                            }}
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              color: selectedOverlayStyle.text,
                              px: 2.2,
                              py: 0.6,
                              borderRadius: 1,
                              border:
                                editorMode === 'edit'
                                  ? `1px dashed ${alpha('#f8d675', 0.42)}`
                                  : `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_STRONG}`,
                              fontSize: `${Math.max(13, Math.round(selectedOverlayStyle.fontSize * 0.44))}px`,
                              outline: 'none',
                              cursor: editorMode === 'edit' ? 'text' : 'pointer',
                            }}
                          >
                            {selectedOverlay.secondaryLabel}
                          </Box>
                        )}
                      </Stack>

                      <Typography
                        contentEditable={editorMode === 'edit'}
                        suppressContentEditableWarning
                        onBlur={(event) => {
                          if (editorMode !== 'edit') return;
                          setSelectedOverlayField('urgency', event.currentTarget.textContent || '');
                        }}
                        sx={{
                          mt: 0.8,
                          color: '#f6d78d',
                          fontWeight: 600,
                          fontSize: `${Math.max(13, Math.round(selectedOverlayStyle.fontSize * 0.4))}px`,
                          fontFamily: selectedOverlayStyle.fontFamily,
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
                        {selectedOverlay.urgency}
                      </Typography>
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
                {selectedOverlay && (
                  <Stack spacing={0.7} sx={{ mt: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.86)' }}>
                        {tt('CTA-vindu', 'CTA window')}
                      </Typography>
                      <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.72)' }}>
                        {formatTime(selectedOverlay.triggerAt)} - {formatTime(selectedOverlay.endAt)}
                      </Typography>
                    </Stack>
                    <Slider
                      value={[selectedOverlay.triggerAt, selectedOverlay.endAt]}
                      min={0}
                      max={duration}
                      step={timelineSnapEnabled ? SNAP_INTERVAL_SECONDS : 0.1}
                      onChange={(_, value) => {
                        const [nextStart, nextEnd] = Array.isArray(value)
                          ? value
                          : [selectedOverlay.triggerAt, selectedOverlay.endAt];
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

              <Box
                sx={{
                  ...panelSx,
                  p: 1.1,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: '310px minmax(0, 1fr)' },
                  gap: 1.1,
                  '@media (min-width: 2048px)': {
                    gridTemplateColumns: '360px minmax(0, 1fr)',
                    gap: 1.25,
                  },
                  '@media (min-width: 3200px)': {
                    gridTemplateColumns: '420px minmax(0, 1fr)',
                    gap: 1.4,
                  },
                }}
              >
                <Box sx={{ ...panelSx, p: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
                    <Typography className="cta-section-title">{tt('CTA-Studio', 'CTA Studio')}</Typography>
                    <Switch
                      size="small"
                      checked={selectedOverlay?.enabled || false}
                      onChange={(event) => setSelectedOverlayField('enabled', event.target.checked)}
                    />
                    <Chip
                      size="small"
                      label={selectedOverlay?.abTestEnabled ? 'A/B' : tt('Enkelt', 'Single')}
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
                      '& .MuiTab-root': { color: 'rgba(237,240,247,0.7)', textTransform: 'none', minHeight: 38 },
                      '& .Mui-selected': { color: '#f7f8fb' },
                    }}
                  >
                    <Tab value="content" label={tt('Innhold', 'Content')} />
                    <Tab value="design" label={tt('Design', 'Design')} />
                  </Tabs>

                  {editorTab === 'content' && selectedOverlay && (
                    <Stack spacing={{ xs: 1.35, sm: 1.5 }}>
                      <Box sx={CTA_EDITOR_SECTION_CARD_SX}>
                        <Typography sx={CTA_SECTION_LABEL_SX}>
                          {tt('Innhold', 'Content')}
                        </Typography>
                        <Stack spacing={1}>
                          <TextField
                            size="small"
                            label={tt('Internt CTA-navn', 'Internal CTA name')}
                            helperText={tt('Navnet vises i listen over CTA-er.', 'Used in the CTA list.')}
                            value={selectedOverlay.name}
                            onChange={(event) => setSelectedOverlayField('name', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            size="small"
                            label={tt('Hovedtittel (vises i overlay)', 'Headline (shown in overlay)')}
                            value={selectedOverlay.title}
                            onChange={(event) => setSelectedOverlayField('title', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            size="small"
                            label={tt('Undertittel / støttetekst', 'Subtitle / supporting text')}
                            value={selectedOverlay.subtitle}
                            onChange={(event) => setSelectedOverlayField('subtitle', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            size="small"
                            label={tt('Knapphetsbudskap (valgfritt)', 'Urgency text (optional)')}
                            value={selectedOverlay.urgency}
                            onChange={(event) => setSelectedOverlayField('urgency', event.target.value)}
                            placeholder={tt('Slutter snart! 3 plasser igjen', 'Ends soon! 3 spots left')}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                        </Stack>
                      </Box>

                      <Box sx={CTA_EDITOR_SECTION_CARD_SX}>
                        <Typography sx={CTA_SECTION_LABEL_SX}>
                          {tt('Handling', 'Action')}
                        </Typography>
                        <Stack spacing={1}>
                          <TextField
                            size="small"
                            label={tt('Primærknapp (tekst)', 'Primary button (text)')}
                            value={selectedOverlay.primaryLabel}
                            onChange={(event) => setSelectedOverlayField('primaryLabel', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />

                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            justifyContent="space-between"
                            spacing={1}
                          >
                            <Typography sx={CTA_FIELD_LABEL_SX}>
                              {tt('Sekundærknapp', 'Secondary button')}
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() =>
                                setSelectedOverlayField(
                                  'secondaryEnabled',
                                  !selectedOverlay.secondaryEnabled,
                                )
                              }
                              sx={{
                                textTransform: 'none',
                                minWidth: 0,
                                px: 1.2,
                                borderColor: NON_TEXT_BORDER_DEFAULT,
                                color: '#edf0f7',
                              }}
                            >
                              {selectedOverlay.secondaryEnabled
                                ? tt('Fjern sekundær CTA', 'Remove secondary CTA')
                                : tt('Legg til sekundær CTA', 'Add secondary CTA')}
                            </Button>
                          </Stack>

                          {selectedOverlay.secondaryEnabled && (
                            <TextField
                              size="small"
                              label={tt('Sekundærknapp (tekst)', 'Secondary button (text)')}
                              value={selectedOverlay.secondaryLabel}
                              onChange={(event) => setSelectedOverlayField('secondaryLabel', event.target.value)}
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                          )}
                        </Stack>
                      </Box>

                      <Box sx={CTA_EDITOR_SECTION_CARD_SX}>
                        <Typography sx={CTA_SECTION_LABEL_SX}>
                          {tt('Timing', 'Timing')}
                        </Typography>
                        <Stack spacing={1}>
                          <TextField
                            size="small"
                            label={tt('Mål-URL', 'Target URL')}
                            helperText={tt('Hvor CTA-knappen skal sende brukeren.', 'Where the CTA button should send users.')}
                            value={selectedOverlay.url}
                            onChange={(event) => setSelectedOverlayField('url', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <TextField
                              size="small"
                              label={tt('Vis fra (min:sek)', 'Show at (min:sec)')}
                              value={triggerAtInput}
                              onChange={(event) => setTriggerAtInput(event.target.value)}
                              onBlur={commitTriggerAtInput}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  commitTriggerAtInput();
                                }
                              }}
                              inputProps={{ inputMode: 'numeric', pattern: '[0-9:]*' }}
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                            <TextField
                              size="small"
                              label={tt('Skjul ved (min:sek)', 'Hide at (min:sec)')}
                              value={endAtInput}
                              onChange={(event) => setEndAtInput(event.target.value)}
                              onBlur={commitEndAtInput}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  commitEndAtInput();
                                }
                              }}
                              inputProps={{ inputMode: 'numeric', pattern: '[0-9:]*' }}
                              sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                          </Stack>
                        </Stack>
                      </Box>
                    </Stack>
                  )}

                  {editorTab === 'design' && selectedOverlay && (
                    <Stack spacing={{ xs: 1.35, sm: 1.5 }}>
                      <Box sx={CTA_EDITOR_SECTION_CARD_SX}>
                        <Typography sx={CTA_SECTION_LABEL_SX}>
                          {tt('Visuell stil', 'Visual style')}
                        </Typography>
                        <Stack spacing={1}>
                          <TextField
                            size="small"
                            label={tt('Overlay-bakgrunn (RGBA/HEX)', 'Overlay background (RGBA/HEX)')}
                            value={selectedOverlayStyle.bg}
                            onChange={(event) => setSelectedStyleField('bg', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            size="small"
                            label={tt('Tekstfarge (RGBA/HEX)', 'Text color (RGBA/HEX)')}
                            value={selectedOverlayStyle.text}
                            onChange={(event) => setSelectedStyleField('text', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            size="small"
                            label={tt('Primærknapp-farge (RGBA/HEX)', 'Primary button color (RGBA/HEX)')}
                            value={selectedOverlayStyle.button}
                            onChange={(event) => setSelectedStyleField('button', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            size="small"
                            label={tt('Primærknapp tekstfarge', 'Primary button text color')}
                            value={selectedOverlayStyle.buttonText}
                            onChange={(event) => setSelectedStyleField('buttonText', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          />
                          <TextField
                            select
                            size="small"
                            label={tt('Skrifttype', 'Font family')}
                            value={selectedOverlayStyle.fontFamily}
                            onChange={(event) => setSelectedStyleField('fontFamily', event.target.value)}
                            sx={{ '& .MuiInputBase-root': { color: '#edf0f7' } }}
                          >
                            {CTA_FONT_OPTIONS.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {tt(option.labelNo, option.labelEn)}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Stack>
                      </Box>

                      <Box sx={CTA_EDITOR_SECTION_CARD_SX}>
                        <Typography sx={CTA_SECTION_LABEL_SX}>
                          {tt('Animasjon', 'Animation')}
                        </Typography>
                        <Stack spacing={1}>
                          <FormControlLabel
                            control={
                              <Switch
                                size="small"
                                checked={selectedOverlayAnimation.enabled}
                                onChange={(event) =>
                                  setSelectedAnimationField('enabled', event.target.checked)
                                }
                              />
                            }
                            label={tt('Aktiver animasjon', 'Enable animation')}
                            sx={{ '& .MuiFormControlLabel-label': { fontSize: { xs: 13, sm: 14 } } }}
                          />
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <TextField
                              select
                              size="small"
                              label={tt('Animasjonstype', 'Animation type')}
                              value={selectedOverlayAnimation.type}
                              onChange={(event) =>
                                setSelectedAnimationField(
                                  'type',
                                  event.target.value as CTAOverlayItem['animation']['type'],
                                )
                              }
                              disabled={!selectedOverlayAnimation.enabled}
                              sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            >
                              <MenuItem value="fade-in">{tt('Ton inn', 'Fade in')}</MenuItem>
                              <MenuItem value="slide-up">{tt('Skyv opp', 'Slide up')}</MenuItem>
                              <MenuItem value="slide-down">{tt('Skyv ned', 'Slide down')}</MenuItem>
                              <MenuItem value="slide-left">{tt('Skyv venstre', 'Slide left')}</MenuItem>
                              <MenuItem value="slide-right">{tt('Skyv høyre', 'Slide right')}</MenuItem>
                              <MenuItem value="zoom-in">{tt('Zoom inn', 'Zoom in')}</MenuItem>
                            </TextField>
                            <TextField
                              select
                              size="small"
                              label={tt('Tempo (easing)', 'Easing')}
                              value={selectedOverlayAnimation.easing}
                              onChange={(event) =>
                                setSelectedAnimationField(
                                  'easing',
                                  event.target.value as CTAOverlayItem['animation']['easing'],
                                )
                              }
                              disabled={!selectedOverlayAnimation.enabled}
                              sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            >
                              <MenuItem value="ease">{tt('Standard', 'Ease')}</MenuItem>
                              <MenuItem value="ease-in">{tt('Inn', 'Ease in')}</MenuItem>
                              <MenuItem value="ease-out">{tt('Ut', 'Ease out')}</MenuItem>
                              <MenuItem value="ease-in-out">{tt('Inn/ut', 'Ease in/out')}</MenuItem>
                              <MenuItem value="linear">{tt('Lineær', 'Linear')}</MenuItem>
                            </TextField>
                          </Stack>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <TextField
                              size="small"
                              type="number"
                              label={tt('Varighet (sek)', 'Duration (sec)')}
                              value={selectedOverlayAnimation.duration}
                              onChange={(event) => {
                                const next = Number(event.target.value);
                                setSelectedAnimationField(
                                  'duration',
                                  Number.isFinite(next) ? Math.max(0.1, next) : 0.1,
                                );
                              }}
                              disabled={!selectedOverlayAnimation.enabled}
                              inputProps={{ min: 0.1, max: 5, step: 0.1 }}
                              sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                            <TextField
                              size="small"
                              type="number"
                              label={tt('Forsinkelse (sek)', 'Delay (sec)')}
                              value={selectedOverlayAnimation.delay}
                              onChange={(event) => {
                                const next = Number(event.target.value);
                                setSelectedAnimationField(
                                  'delay',
                                  Number.isFinite(next) ? Math.max(0, next) : 0,
                                );
                              }}
                              disabled={!selectedOverlayAnimation.enabled}
                              inputProps={{ min: 0, max: 5, step: 0.1 }}
                              sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7' } }}
                            />
                          </Stack>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PlayArrow />}
                            onClick={() => {
                              setIsPlaying(false);
                              setCurrentTime(selectedOverlay.triggerAt);
                              if (selectedOverlayAnimation.enabled) {
                                triggerOverlayAnimation();
                              }
                            }}
                            sx={{
                              textTransform: 'none',
                              borderColor: NON_TEXT_BORDER_DEFAULT,
                              color: '#edf0f7',
                              alignSelf: 'flex-start',
                            }}
                          >
                            {tt('Forhåndsvis animasjon', 'Preview animation')}
                          </Button>
                        </Stack>
                      </Box>

                      <Box sx={CTA_EDITOR_SECTION_CARD_SX}>
                        <Typography sx={CTA_SECTION_LABEL_SX}>
                          {tt('Layout', 'Layout')}
                        </Typography>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={CTA_FIELD_LABEL_SX}>
                              {tt('Hjørneradius (px)', 'Border radius (px)')}
                            </Typography>
                            <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.9)', fontWeight: 600 }}>
                              {Math.round(selectedOverlayStyle.borderRadius)}px
                            </Typography>
                          </Stack>
                          <Slider
                            value={selectedOverlayStyle.borderRadius}
                            min={0}
                            max={30}
                            onChange={(_, value) => {
                              const next = Array.isArray(value) ? value[0] : value;
                              setSelectedStyleField('borderRadius', next);
                            }}
                            sx={{ color: '#f8b321' }}
                          />

                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={CTA_FIELD_LABEL_SX}>
                              {tt('Opasitet', 'Opacity')}
                            </Typography>
                            <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.9)', fontWeight: 600 }}>
                              {Math.round(selectedOverlayStyle.opacity * 100)}%
                            </Typography>
                          </Stack>
                          <Slider
                            value={selectedOverlayStyle.opacity}
                            min={0.2}
                            max={1}
                            step={0.01}
                            onChange={(_, value) => {
                              const next = Array.isArray(value) ? value[0] : value;
                              setSelectedStyleField('opacity', next);
                            }}
                            sx={{ color: '#f8b321' }}
                          />
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={CTA_FIELD_LABEL_SX}>
                              {tt('Tittelstørrelse (px)', 'Headline size (px)')}
                            </Typography>
                            <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.9)', fontWeight: 600 }}>
                              {Math.round(selectedOverlayStyle.fontSize)}px
                            </Typography>
                          </Stack>
                          <Slider
                            value={selectedOverlayStyle.fontSize}
                            min={24}
                            max={96}
                            step={1}
                            onChange={(_, value) => {
                              const next = Array.isArray(value) ? value[0] : value;
                              setSelectedStyleField('fontSize', next);
                            }}
                            sx={{ color: '#f8b321' }}
                          />
                        </Stack>
                      </Box>
                    </Stack>
                  )}

                </Box>

                <Box sx={{ ...panelSx, p: 0.9 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.9 }}>
                    <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.88)', fontWeight: 600 }}>
                      {tt('Trigger ved', 'Trigger at')}
                    </Typography>
                    <TextField
                      size="small"
                      value={selectedOverlay ? formatTime(selectedOverlay.triggerAt) : '0:00'}
                      sx={{ width: 96, '& .MuiInputBase-root': { color: '#edf0f7', fontSize: { xs: 13, sm: 14 } } }}
                      inputProps={{ readOnly: true }}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={triggerEnabled}
                          onChange={(event) => setTriggerEnabled(event.target.checked)}
                        />
                      }
                      label={tt('Aktiver trigger', 'Enable trigger')}
                      sx={{ '& .MuiFormControlLabel-label': { fontSize: { xs: 13, sm: 14 } } }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={resetToKeyframe}
                          onChange={(event) => setResetToKeyframe(event.target.checked)}
                        />
                      }
                      label={tt('Tilbakestill', 'Reset')}
                      sx={{ '& .MuiFormControlLabel-label': { fontSize: { xs: 13, sm: 14 } } }}
                    />
                  </Stack>

                  <Box
                    sx={{
                      borderRadius: 1,
                      border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_SUBTLE}`,
                      aspectRatio: '16/9',
                      position: 'relative',
                      overflow: 'hidden',
                      background:
                        'radial-gradient(circle at 72% 20%, rgba(248,179,33,0.35), rgba(8,12,19,0) 44%), linear-gradient(145deg, rgba(15,24,36,0.94), rgba(8,12,18,0.96))',
                    }}
                  >
                    {selectedOverlay && (
                      <Box
                        sx={{
                          position: 'absolute',
                          right: 14,
                          bottom: 16,
                          width: '52%',
                          borderRadius: 1,
                          border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_SUBTLE}`,
                          background: alpha(selectedOverlayStyle.bg, 0.95),
                          p: 1,
                        }}
                      >
                        <Typography sx={{ fontFamily: selectedOverlayStyle.fontFamily, fontSize: `${Math.max(18, Math.round(selectedOverlayStyle.fontSize * 0.52))}px`, lineHeight: 1 }}>
                          {selectedOverlay.title}
                        </Typography>
                        <Button
                          fullWidth
                          sx={{
                            mt: 0.8,
                            textTransform: 'none',
                            fontWeight: 700,
                            color: selectedOverlayStyle.buttonText,
                            background: selectedOverlayStyle.button,
                            fontSize: `${Math.max(12, Math.round(selectedOverlayStyle.fontSize * 0.34))}px`,
                            '&:hover': { background: selectedOverlayStyle.button },
                          }}
                        >
                          {selectedOverlay.primaryLabel}
                        </Button>
                        {selectedOverlay.secondaryEnabled && (
                          <Button
                            fullWidth
                            sx={{
                              mt: 0.6,
                              textTransform: 'none',
                              color: selectedOverlayStyle.text,
                              border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_DEFAULT}`,
                              fontSize: `${Math.max(12, Math.round(selectedOverlayStyle.fontSize * 0.32))}px`,
                            }}
                          >
                            {selectedOverlay.secondaryLabel}
                          </Button>
                        )}
                      </Box>
                    )}
                  </Box>

                  <Stack direction="row" spacing={0.8} sx={{ mt: 1 }}>
                    <Button
                      startIcon={<Save />}
                      onClick={() => void saveOverlaySetup(false)}
                      sx={{
                        flex: 1,
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_SUBTLE}`,
                      }}
                    >
                      {tt('Lagre', 'Save')}
                    </Button>
                  </Stack>
                </Box>
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
                <Tab label={tt('CTA-ytelse', 'CTA Performance')} value="performance" />
                <Tab label={tt('A/B-test', 'A/B Test')} value="abtest" />
                <Tab label={tt('Analyser', 'Analytics')} value="analytics" />
                <Tab label={tt('Markører', 'Markers')} value="markers" />
              </Tabs>

              <Box
                sx={{
                  p: { xs: 1, sm: 1.2 },
                  minHeight: 0,
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: { xs: 0.95, sm: 1.1 },
                }}
              >
                <Box sx={{ ...panelSx, p: 1 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={0.8}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                  >
                    <Switch
                      size="small"
                      checked={selectedOverlay?.enabled || false}
                      onChange={(event) => setSelectedOverlayField('enabled', event.target.checked)}
                    />
                    <Typography sx={{ fontWeight: 600, fontSize: { xs: 15, sm: 16 } }}>
                      {selectedOverlay?.name || tt('Overlay', 'Overlay')}
                    </Typography>
                    <FormControlLabel
                      sx={{
                        ml: { xs: 0, sm: 'auto' },
                        mr: 0,
                        '& .MuiFormControlLabel-label': {
                          fontSize: { xs: 13, sm: 14 },
                          color: 'rgba(237,240,247,0.78)',
                        },
                      }}
                      control={
                        <Switch
                          size="small"
                          checked={selectedOverlay?.abTestEnabled || false}
                          onChange={(event) =>
                            setSelectedOverlayField('abTestEnabled', event.target.checked)
                          }
                        />
                      }
                      label={tt('A/B-test', 'A/B Test')}
                    />
                    <Chip
                      size="small"
                      label={
                        selectedOverlay?.abTestEnabled
                          ? tt('Aktiv', 'Active')
                          : tt('Av', 'Off')
                      }
                      sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                    />
                  </Stack>
                </Box>

                {rightTab === 'performance' && (
                  <>
                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" sx={{ mb: 0.9 }}>
                        <TextField
                          size="small"
                          placeholder={tt('Søk overlegg...', 'Search overlays...')}
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Search sx={{ color: 'rgba(237,240,247,0.5)' }} />
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            flex: 1,
                            minWidth: { xs: '100%', sm: 0 },
                            '& .MuiInputBase-root': {
                              color: '#edf0f7',
                              bgcolor: 'rgba(10,13,20,0.7)',
                            },
                          }}
                        />
                        <Button
                          size="small"
                          startIcon={<Add />}
                          onClick={addOverlay}
                          sx={{
                            textTransform: 'none',
                            color: '#0f0f0f',
                            background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                            borderRadius: 1,
                            '&:hover': {
                              background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                            },
                          }}
                        >
                          {tt('Ny CTA', 'New CTA')}
                        </Button>
                        <IconButton onClick={duplicateOverlay} sx={{ color: '#edf0f7', border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_DEFAULT}` }}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                        <IconButton onClick={() => removeOverlay()} sx={{ color: '#edf0f7', border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_DEFAULT}` }}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Stack>

                      <Stack spacing={0.7}>
                        {filteredOverlays.map((overlay) => {
                          const active = selectedOverlayId === overlay.id;
                          return (
                            <Button
                              key={overlay.id}
                              onClick={() => setSelectedOverlayId(overlay.id)}
                              sx={{
                                justifyContent: 'space-between',
                                textTransform: 'none',
                                color: '#edf0f7',
                                borderRadius: 1,
                                border: active
                                  ? `var(--academy-hairline-width, 1px) solid ${NON_TEXT_ALERT_BORDER}`
                                  : `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_SUBTLE}`,
                                background: active
                                  ? 'linear-gradient(90deg, rgba(248,179,33,0.18), rgba(248,179,33,0.04))'
                                  : 'rgba(255,255,255,0.02)',
                              }}
                            >
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Campaign fontSize="small" sx={{ color: '#f8d56f' }} />
                                <Typography>{overlay.name}</Typography>
                              </Stack>
                              <Stack direction="row" spacing={0.6} alignItems="center">
                                <Chip
                                  size="small"
                                  label={`${overlay.analytics.variantA.toFixed(1)}%`}
                                  sx={{ bgcolor: 'rgba(255,255,255,0.09)', color: '#edf0f7' }}
                                />
                                <Box
                                  component="span"
                                  role="button"
                                  aria-label={tt('Slett overlay', 'Delete overlay')}
                                  tabIndex={0}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    removeOverlay(overlay.id);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      removeOverlay(overlay.id);
                                    }
                                  }}
                                  sx={{
                                    width: 26,
                                    height: 26,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 0.8,
                                    border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_DEFAULT}`,
                                    color: 'rgba(237,240,247,0.78)',
                                    '&:hover': {
                                      color: '#ff8b8b',
                                      borderColor: NON_TEXT_DANGER_BORDER,
                                    },
                                  }}
                                >
                                  <Delete fontSize="small" />
                                </Box>
                              </Stack>
                            </Button>
                          );
                        })}
                      </Stack>
                    </Box>

                    {selectedOverlay && (
                      <>
                        <Box sx={{ ...panelSx, p: 1 }}>
                          <Typography className="cta-section-title">{tt('CTA-innsikt', 'CTA Insights')}</Typography>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.8} sx={{ mt: 0.85 }}>
                            <Stack sx={{ minWidth: 0 }}>
                              <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.72)' }}>
                                {tt('Gj.sn. visning', 'Avg Watch')}
                              </Typography>
                              <Typography sx={CTA_METRIC_VALUE_SX}>
                                {selectedOverlay.analytics.avgWatchBeforeTrigger}s
                              </Typography>
                            </Stack>
                            <Stack sx={{ minWidth: 0 }}>
                              <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.72)' }}>
                                {tt('Klikkrate', 'Click Through')}
                              </Typography>
                              <Typography sx={CTA_METRIC_VALUE_SX}>
                                {ctr}%
                              </Typography>
                            </Stack>
                            <Stack sx={{ minWidth: 0 }}>
                              <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.72)' }}>
                                {tt('Konverteringer', 'Conversions')}
                              </Typography>
                              <Typography sx={CTA_METRIC_VALUE_SX}>
                                {selectedOverlay.analytics.conversions}
                              </Typography>
                            </Stack>
                          </Stack>

                          <Box sx={{ mt: 1, height: 84, borderRadius: 1, border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_SUBTLE}`, p: 1 }}>
                            <Box
                              component="svg"
                              viewBox="0 0 100 30"
                              preserveAspectRatio="none"
                              sx={{ width: '100%', height: '100%' }}
                            >
                              <defs>
                                <linearGradient id="ctaLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                  <stop offset="0%" stopColor="#6ea8ff" />
                                  <stop offset="100%" stopColor="#f8b321" />
                                </linearGradient>
                              </defs>
                              <polyline
                                fill="none"
                                stroke="url(#ctaLineGradient)"
                                strokeWidth="1.2"
                                points="0,23 10,22 20,20 30,16 40,14 50,15 60,16 70,13 80,11 90,9 100,4"
                              />
                            </Box>
                          </Box>
                        </Box>

                        <Box sx={{ ...panelSx, p: 1 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography className="cta-section-title">{tt('Konverteringsmål', 'Conversion Goals')}</Typography>
                            <Typography sx={{ color: '#f8d56f' }}>{selectedOverlay.analytics.views.toLocaleString()}</Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.8 }}>
                            <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.8)' }}>
                              {tt('Konverteringsrate', 'Conversion Rate')}
                            </Typography>
                            <Typography sx={CTA_METRIC_VALUE_SX}>
                              {conversionRate}%
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.35 }}>
                            <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.8)' }}>
                              {tt('Inntekt', 'Revenue')}
                            </Typography>
                            <Typography sx={CTA_METRIC_VALUE_SX}>
                              {toNok(selectedOverlay.analytics.revenue)}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.35 }}>
                            <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.8)' }}>
                              {tt('Nåværende løft (A vs B)', 'Current Uplift (A vs B)')}
                            </Typography>
                            <Typography sx={{ ...CTA_METRIC_VALUE_SX, color: '#7eea8e' }}>
                              +{uplift}%
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={Math.max(8, Math.min(100, 50 + uplift))}
                            sx={{
                              mt: 0.9,
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
                  </>
                )}

                {rightTab === 'abtest' && selectedOverlay && (
                  <>
                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography className="cta-section-title">
                          {tt('A/B-variantstyring', 'A/B Variant Controls')}
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={selectedOverlay.abTestEnabled}
                              onChange={(event) =>
                                setSelectedOverlayField('abTestEnabled', event.target.checked)
                              }
                            />
                          }
                          label={tt('Aktiv', 'Active')}
                          sx={{ '& .MuiFormControlLabel-label': { fontSize: { xs: 13, sm: 14 } } }}
                        />
                      </Stack>
                      <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.74)', mt: 0.5 }}>
                        {tt(
                          'Juster forventet CTR for variant A og B.',
                          'Adjust expected CTR for variant A and B.',
                        )}
                      </Typography>

                      <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.8)', mt: 1 }}>
                        {tt('Variant A CTR', 'Variant A CTR')} ({selectedOverlay.analytics.variantA.toFixed(1)}%)
                      </Typography>
                      <Slider
                        value={selectedOverlay.analytics.variantA}
                        min={0}
                        max={100}
                        step={0.1}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setSelectedAnalyticsField('variantA', Number(next.toFixed(1)));
                        }}
                        sx={{ color: '#f8b321' }}
                      />

                      <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.8)', mt: 0.6 }}>
                        {tt('Variant B CTR', 'Variant B CTR')} ({selectedOverlay.analytics.variantB.toFixed(1)}%)
                      </Typography>
                      <Slider
                        value={selectedOverlay.analytics.variantB}
                        min={0}
                        max={100}
                        step={0.1}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setSelectedAnalyticsField('variantB', Number(next.toFixed(1)));
                        }}
                        sx={{ color: '#8db0ff' }}
                      />
                    </Box>

                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Typography className="cta-section-title">
                        {tt('A/B-resultat', 'A/B Outcome')}
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.8 }}>
                        <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.82)' }}>
                          {tt('Forbedring (A vs B)', 'Uplift (A vs B)')}
                        </Typography>
                        <Typography sx={{ ...CTA_METRIC_VALUE_SX, color: uplift >= 0 ? '#7eea8e' : '#ff8a80' }}>
                          {uplift >= 0 ? '+' : ''}
                          {uplift}%
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.35 }}>
                        <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.82)' }}>
                          {tt('Beste variant', 'Best Variant')}
                        </Typography>
                        <Typography sx={{ fontSize: { xs: 14, sm: 15 }, fontWeight: 600 }}>
                          {selectedOverlay.analytics.variantA >= selectedOverlay.analytics.variantB
                            ? tt('Variant A', 'Variant A')
                            : tt('Variant B', 'Variant B')}
                        </Typography>
                      </Stack>
                    </Box>

                    <Stack direction="row" spacing={1}>
                      <Button
                        startIcon={<ContentCopy />}
                        onClick={duplicateOverlay}
                        sx={{
                          flex: 1,
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_DEFAULT}`,
                        }}
                      >
                        {tt('Dupliser variant', 'Duplicate variant')}
                      </Button>
                    </Stack>
                  </>
                )}

                {rightTab === 'analytics' && (
                  <>
                    {selectedOverlay && (
                      <Box sx={{ ...panelSx, p: 1 }}>
                        <Typography className="cta-section-title">
                          {tt('Konverteringsmål (valgt CTA)', 'Conversion goals (selected CTA)')}
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.9} sx={{ mt: 0.95 }}>
                          <TextField
                            size="small"
                            type="number"
                            label={tt('Mål visninger', 'Target views')}
                            value={selectedOverlayAnalytics.targetViews}
                            onChange={(event) =>
                              setSelectedAnalyticsField(
                                'targetViews',
                                Math.max(0, Math.round(Number(event.target.value) || 0)),
                              )
                            }
                            inputProps={{ min: 0, step: 1 }}
                            sx={{
                              flex: 1,
                              '& .MuiInputBase-root': { color: '#edf0f7', fontSize: { xs: 14, sm: 15 } },
                              '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.82)' },
                            }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label={tt('Mål CTR (%)', 'Target CTR (%)')}
                            value={selectedOverlayAnalytics.targetCtr}
                            onChange={(event) =>
                              setSelectedAnalyticsField(
                                'targetCtr',
                                Math.max(0, Number(event.target.value) || 0),
                              )
                            }
                            inputProps={{ min: 0, step: 0.1 }}
                            sx={{
                              flex: 1,
                              '& .MuiInputBase-root': { color: '#edf0f7', fontSize: { xs: 14, sm: 15 } },
                              '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.82)' },
                            }}
                          />
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.9} sx={{ mt: 0.9 }}>
                          <TextField
                            size="small"
                            type="number"
                            label={tt('Mål konverteringer', 'Target conversions')}
                            value={selectedOverlayAnalytics.targetConversions}
                            onChange={(event) =>
                              setSelectedAnalyticsField(
                                'targetConversions',
                                Math.max(0, Math.round(Number(event.target.value) || 0)),
                              )
                            }
                            inputProps={{ min: 0, step: 1 }}
                            sx={{
                              flex: 1,
                              '& .MuiInputBase-root': { color: '#edf0f7', fontSize: { xs: 14, sm: 15 } },
                              '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.82)' },
                            }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label={tt('Mål inntekt (NOK)', 'Target revenue (NOK)')}
                            value={selectedOverlayAnalytics.targetRevenue}
                            onChange={(event) =>
                              setSelectedAnalyticsField(
                                'targetRevenue',
                                Math.max(0, Math.round(Number(event.target.value) || 0)),
                              )
                            }
                            inputProps={{ min: 0, step: 100 }}
                            sx={{
                              flex: 1,
                              '& .MuiInputBase-root': { color: '#edf0f7', fontSize: { xs: 14, sm: 15 } },
                              '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.82)' },
                            }}
                          />
                        </Stack>

                        <Stack spacing={0.8} sx={{ mt: 1.15 }}>
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            spacing={0.35}
                          >
                            <Typography sx={{ color: 'rgba(237,240,247,0.88)', fontSize: { xs: 12.5, sm: 13.5 }, lineHeight: 1.25 }}>
                              {tt('Visninger', 'Views')} ({selectedOverlayAnalytics.views.toLocaleString()} / {selectedOverlayAnalytics.targetViews.toLocaleString()})
                            </Typography>
                            <Typography sx={{ color: 'rgba(237,240,247,0.92)', fontSize: { xs: 12.5, sm: 13.5 }, fontWeight: 700 }}>
                              {selectedGoalProgress.views}%
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={selectedGoalProgress.views}
                            sx={{
                              height: 6,
                              borderRadius: 999,
                              bgcolor: 'rgba(255,255,255,0.14)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, #6ea8ff 0%, #f8b321 100%)',
                              },
                            }}
                          />

                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            spacing={0.35}
                          >
                            <Typography sx={{ color: 'rgba(237,240,247,0.88)', fontSize: { xs: 12.5, sm: 13.5 }, lineHeight: 1.25 }}>
                              CTR ({ctr}% / {selectedOverlayAnalytics.targetCtr}%)
                            </Typography>
                            <Typography sx={{ color: 'rgba(237,240,247,0.92)', fontSize: { xs: 12.5, sm: 13.5 }, fontWeight: 700 }}>
                              {selectedGoalProgress.ctr}%
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={selectedGoalProgress.ctr}
                            sx={{
                              height: 6,
                              borderRadius: 999,
                              bgcolor: 'rgba(255,255,255,0.14)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, #8de270 0%, #f8b321 100%)',
                              },
                            }}
                          />

                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            spacing={0.35}
                          >
                            <Typography sx={{ color: 'rgba(237,240,247,0.88)', fontSize: { xs: 12.5, sm: 13.5 }, lineHeight: 1.25 }}>
                              {tt('Konverteringer', 'Conversions')} ({selectedOverlayAnalytics.conversions.toLocaleString()} / {selectedOverlayAnalytics.targetConversions.toLocaleString()})
                            </Typography>
                            <Typography sx={{ color: 'rgba(237,240,247,0.92)', fontSize: { xs: 12.5, sm: 13.5 }, fontWeight: 700 }}>
                              {selectedGoalProgress.conversions}%
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={selectedGoalProgress.conversions}
                            sx={{
                              height: 6,
                              borderRadius: 999,
                              bgcolor: 'rgba(255,255,255,0.14)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, #6ea8ff 0%, #f8b321 100%)',
                              },
                            }}
                          />

                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            justifyContent="space-between"
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            spacing={0.35}
                          >
                            <Typography sx={{ color: 'rgba(237,240,247,0.88)', fontSize: { xs: 12.5, sm: 13.5 }, lineHeight: 1.25 }}>
                              {tt('Inntekt', 'Revenue')} ({toNok(selectedOverlayAnalytics.revenue)} / {toNok(selectedOverlayAnalytics.targetRevenue)})
                            </Typography>
                            <Typography sx={{ color: 'rgba(237,240,247,0.92)', fontSize: { xs: 12.5, sm: 13.5 }, fontWeight: 700 }}>
                              {selectedGoalProgress.revenue}%
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={selectedGoalProgress.revenue}
                            sx={{
                              height: 6,
                              borderRadius: 999,
                              bgcolor: 'rgba(255,255,255,0.14)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, #8de270 0%, #f8b321 100%)',
                              },
                            }}
                          />
                        </Stack>
                      </Box>
                    )}

                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Typography className="cta-section-title">
                        {tt('Samlet analyse', 'Aggregate Analytics')}
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.85 }}>
                        <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.9)' }}>{tt('Visninger', 'Views')}</Typography>
                        <Typography sx={{ fontSize: { xs: 14, sm: 16 }, fontWeight: 700 }}>{overallAnalytics.views.toLocaleString()}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.45 }}>
                        <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.9)' }}>{tt('Klikk', 'Clicks')}</Typography>
                        <Typography sx={{ fontSize: { xs: 14, sm: 16 }, fontWeight: 700 }}>{overallAnalytics.clicks.toLocaleString()}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.45 }}>
                        <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.9)' }}>{tt('Konverteringer', 'Conversions')}</Typography>
                        <Typography sx={{ fontSize: { xs: 14, sm: 16 }, fontWeight: 700 }}>{overallAnalytics.conversions.toLocaleString()}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.45 }}>
                        <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.9)' }}>{tt('Total CTR', 'Total CTR')}</Typography>
                        <Typography sx={{ fontSize: { xs: 14, sm: 16 }, fontWeight: 700 }}>{overallAnalytics.overallCtr}%</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.45 }}>
                        <Typography sx={{ ...CTA_FIELD_LABEL_SX, color: 'rgba(237,240,247,0.9)' }}>{tt('Inntekt', 'Revenue')}</Typography>
                        <Typography sx={{ fontSize: { xs: 14, sm: 16 }, fontWeight: 700 }}>{toNok(overallAnalytics.revenue)}</Typography>
                      </Stack>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Typography className="cta-section-title">
                        {tt('Overlay-oversikt', 'Overlay Breakdown')}
                      </Typography>
                      <Stack spacing={0.85} sx={{ mt: 0.9 }}>
                        {overlayItems.map((overlay) => {
                          const overlayCtr =
                            overlay.analytics.views > 0
                              ? Number(
                                  ((overlay.analytics.clicks / overlay.analytics.views) * 100).toFixed(1),
                                )
                              : 0;
                          return (
                            <Box
                              key={overlay.id}
                              sx={{
                                borderRadius: 1,
                                border: `var(--academy-hairline-width, 1px) solid ${NON_TEXT_BORDER_SUBTLE}`,
                                px: 1,
                                py: 0.8,
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.8}>
                                <Typography sx={{ fontSize: { xs: 14, sm: 15 }, fontWeight: 600, lineHeight: 1.25, pr: 0.5 }}>
                                  {overlay.name}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={`${overlayCtr}%`}
                                  sx={{ bgcolor: 'rgba(255,255,255,0.09)', color: '#edf0f7' }}
                                />
                              </Stack>
                              <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                justifyContent="space-between"
                                alignItems={{ xs: 'flex-start', sm: 'center' }}
                                spacing={0.25}
                                sx={{ mt: 0.45 }}
                              >
                                <Typography sx={{ color: 'rgba(237,240,247,0.82)', fontSize: { xs: 12.5, sm: 13 } }}>
                                  {tt('Konverteringer', 'Conversions')}: {overlay.analytics.conversions}
                                </Typography>
                                <Typography sx={{ color: 'rgba(237,240,247,0.9)', fontSize: { xs: 12.5, sm: 13 }, fontWeight: 600 }}>
                                  {toNok(overlay.analytics.revenue)}
                                </Typography>
                              </Stack>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  </>
                )}

                {rightTab === 'markers' && (
                  <>
                    <Box sx={{ ...panelSx, p: 1 }}>
                      <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.8 }}>
                        <WarningAmber sx={{ color: qualityIssues.length === 0 ? '#9ef1ca' : '#f8d675' }} />
                        <Typography className="cta-section-title">
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
                      <Typography className="cta-section-title">
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
                        'Tastatur: V = velgmodus, E = redigeringsmodus, piltaster flytter tidsvindu, Shift + piltast flytter 1s, Delete/Backspace sletter valgt CTA.',
                        'Keyboard: V = select mode, E = edit mode, arrows move timeline window, Shift + arrow moves 1s, Delete/Backspace removes selected CTA.',
                      )}
                    </Typography>
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

export default withUniversalIntegration(AcademyCTAOverlayStudio, {
  componentId: 'academy-cta-overlay-studio',
  componentName: 'Academy CTA Overlay Studio',
  componentType: 'editor',
  componentCategory: 'academy',
  featureIds: ['cta-overlays', 'ab-testing', 'conversion-analytics', 'academy-monetization'],
});
