import { useMediaQuery, useTheme } from '@mui/material';

export type ProductionManuscriptScreenTier = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '4k';

export interface ProductionManuscriptScreenTierInfo {
  tier: ProductionManuscriptScreenTier;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  is4K: boolean;
  breakpointSpacing: number;
}

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

export const useProductionManuscriptScreenTier = (): ProductionManuscriptScreenTierInfo => {
  const theme = useTheme();
  const isXs = useMediaQuery('(max-width:599px)');
  const isSm = useMediaQuery('(min-width:600px) and (max-width:899px)');
  const isMd = useMediaQuery('(min-width:900px) and (max-width:1199px)');
  const isLg = useMediaQuery('(min-width:1200px) and (max-width:1535px)');
  const isXl = useMediaQuery('(min-width:1536px) and (max-width:1919px)');
  const isXxl = useMediaQuery('(min-width:1920px) and (max-width:2559px)');
  const is4K = useMediaQuery('(min-width:2560px)');

  const tier: ProductionManuscriptScreenTier = is4K
    ? '4k'
    : isXxl
      ? 'xxl'
      : isXl
        ? 'xl'
        : isLg
          ? 'lg'
          : isMd
            ? 'md'
            : isSm
              ? 'sm'
              : 'xs';
  const isMobile = tier === 'xs' || tier === 'sm';
  const isTablet = tier === 'md';
  const isDesktop = tier === 'lg' || tier === 'xl' || tier === 'xxl' || tier === '4k';
  const spacing = theme.spacing(isXs ? 0.5 : 1);
  const breakpointSpacing = typeof spacing === 'number' ? spacing : Number(spacing.replace('px', ''));

  return { tier, isMobile, isTablet, isDesktop, is4K, breakpointSpacing };
};

const RESPONSIVE_VALUES: Record<ProductionManuscriptScreenTier, ProductionManuscriptResponsiveValues> = {
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
};

export const getProductionManuscriptResponsiveValues = (
  tier: ProductionManuscriptScreenTier,
): ProductionManuscriptResponsiveValues => RESPONSIVE_VALUES[tier];

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
