import type { ScreenTier } from '../stripboard.types';

export type ProductionManuscriptScreenTier = ScreenTier;

export interface ProductionManuscriptResponsiveValues {
  titleFontSize: string;
  bodyFontSize: string;
  captionFontSize: string;
  buttonSize: 'small' | 'medium' | 'large';
  iconSize: number;
  spacing: number;
  padding: number;
  chipSize: 'small' | 'medium';
  sidebarWidth: number;
  rightPanelWidth: number;
  headerPx: number;
  headerPy: number;
  sceneThumbnailSize: number;
  sceneInfoFontSize: number;
  searchInputFontSize: number;
  filterChipPx: number;
  filterChipPy: number;
}

export const PRODUCTION_MANUSCRIPT_RESPONSIVE_VALUES = {
  xs: {
    titleFontSize: '10px',
    bodyFontSize: '11px',
    captionFontSize: '9px',
    buttonSize: 'small',
    iconSize: 14,
    spacing: 1,
    padding: 1,
    chipSize: 'small',
    sidebarWidth: 0,
    rightPanelWidth: 0,
    headerPx: 1.5,
    headerPy: 1,
    sceneThumbnailSize: 36,
    sceneInfoFontSize: 11,
    searchInputFontSize: 12,
    filterChipPx: 1,
    filterChipPy: 0.25,
  },
  sm: {
    titleFontSize: '11px',
    bodyFontSize: '12px',
    captionFontSize: '10px',
    buttonSize: 'small',
    iconSize: 16,
    spacing: 1,
    padding: 1.5,
    chipSize: 'small',
    sidebarWidth: 220,
    rightPanelWidth: 260,
    headerPx: 2,
    headerPy: 1.5,
    sceneThumbnailSize: 40,
    sceneInfoFontSize: 11,
    searchInputFontSize: 12,
    filterChipPx: 1.25,
    filterChipPy: 0.5,
  },
  md: {
    titleFontSize: '12px',
    bodyFontSize: '12px',
    captionFontSize: '10px',
    buttonSize: 'small',
    iconSize: 18,
    spacing: 1.5,
    padding: 1.5,
    chipSize: 'small',
    sidebarWidth: 260,
    rightPanelWidth: 300,
    headerPx: 2.5,
    headerPy: 1.5,
    sceneThumbnailSize: 40,
    sceneInfoFontSize: 12,
    searchInputFontSize: 12,
    filterChipPx: 1.5,
    filterChipPy: 0.5,
  },
  lg: {
    titleFontSize: '14px',
    bodyFontSize: '13px',
    captionFontSize: '11px',
    buttonSize: 'small',
    iconSize: 20,
    spacing: 2,
    padding: 2,
    chipSize: 'small',
    sidebarWidth: 300,
    rightPanelWidth: 380,
    headerPx: 3,
    headerPy: 2,
    sceneThumbnailSize: 44,
    sceneInfoFontSize: 12,
    searchInputFontSize: 13,
    filterChipPx: 1.5,
    filterChipPy: 0.5,
  },
  xl: {
    titleFontSize: '14px',
    bodyFontSize: '13px',
    captionFontSize: '11px',
    buttonSize: 'medium',
    iconSize: 20,
    spacing: 2,
    padding: 2,
    chipSize: 'small',
    sidebarWidth: 320,
    rightPanelWidth: 400,
    headerPx: 3,
    headerPy: 2,
    sceneThumbnailSize: 48,
    sceneInfoFontSize: 13,
    searchInputFontSize: 13,
    filterChipPx: 1.5,
    filterChipPy: 0.5,
  },
  xxl: {
    titleFontSize: '15px',
    bodyFontSize: '14px',
    captionFontSize: '12px',
    buttonSize: 'medium',
    iconSize: 22,
    spacing: 2,
    padding: 2,
    chipSize: 'medium',
    sidebarWidth: 340,
    rightPanelWidth: 420,
    headerPx: 3,
    headerPy: 2,
    sceneThumbnailSize: 52,
    sceneInfoFontSize: 13,
    searchInputFontSize: 14,
    filterChipPx: 1.5,
    filterChipPy: 0.5,
  },
  '4k': {
    titleFontSize: '18px',
    bodyFontSize: '16px',
    captionFontSize: '14px',
    buttonSize: 'large',
    iconSize: 26,
    spacing: 3,
    padding: 3,
    chipSize: 'medium',
    sidebarWidth: 400,
    rightPanelWidth: 500,
    headerPx: 4,
    headerPy: 3,
    sceneThumbnailSize: 60,
    sceneInfoFontSize: 15,
    searchInputFontSize: 16,
    filterChipPx: 2,
    filterChipPy: 0.75,
  },
} satisfies Record<ProductionManuscriptScreenTier, ProductionManuscriptResponsiveValues>;

export const toDisplayString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
};

export const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const toSceneNumber = (value: unknown): number | undefined => {
  const parsed = toOptionalNumber(value);
  return parsed === undefined ? undefined : Math.trunc(parsed);
};

export const toTimestamp = (value: unknown): number => {
  const raw = toDisplayString(value);
  const timestamp = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const toFontNumber = (value: unknown, fallback = 13): number => {
  const parsed = toOptionalNumber(value);
  return parsed ?? fallback;
};
