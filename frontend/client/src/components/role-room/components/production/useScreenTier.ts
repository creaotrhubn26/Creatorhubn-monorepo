/**
 * useScreenTier.ts
 * 7-Tier responsive breakpoint hook + scale-factor table.
 *
 * Using this hook instead of inline useMediaQuery calls keeps every
 * responsive decision in one place and avoids scattering breakpoint
 * logic across the component tree.
 */

import { useTheme, useMediaQuery } from '@mui/material';
import type { ScreenTier, ScreenTierInfo, ResponsiveValues } from './stripboard.types';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useScreenTier(): ScreenTierInfo {
  const theme = useTheme();
  const isXs  = useMediaQuery(theme.breakpoints.down('sm'));
  const isSm  = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isMd  = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isLg  = useMediaQuery(theme.breakpoints.between('lg', 'xl'));
  const isXl  = useMediaQuery(theme.breakpoints.between(1536, 1920));
  const isXxl = useMediaQuery('(min-width: 1920px) and (max-width: 2559px)');
  const is4K  = useMediaQuery('(min-width: 2560px)');

  const tier: ScreenTier =
    is4K ? '4k' : isXxl ? 'xxl' : isXl ? 'xl' : isLg ? 'lg' : isMd ? 'md' : isSm ? 'sm' : 'xs';

  return {
    tier,
    isMobile:  isXs || isSm,
    isTablet:  isMd,
    isDesktop: isLg || isXl || isXxl || is4K,
    is4K,
  };
}

// ─── Scale-factor table ───────────────────────────────────────────────────────

const RESPONSIVE_SCALES: Record<ScreenTier, ResponsiveValues> = {
  xs: {
    headerPadding: 1, contentPadding: 1,
    fontSize: { title: '0.9rem', subtitle: '0.75rem', body: '0.7rem', caption: '0.6rem', stats: '1.1rem' },
    chipHeight: 18, iconSize: 16, spacing: 0.5,
    cardPadding: { x: 1, y: 0.75 },
    maxCastVisible: 2, statsColumns: 2,
    showLegendLabels: false, showCallSheetButton: false, compactMode: true,
  },
  sm: {
    headerPadding: 1.5, contentPadding: 1.5,
    fontSize: { title: '1rem', subtitle: '0.8rem', body: '0.75rem', caption: '0.65rem', stats: '1.2rem' },
    chipHeight: 20, iconSize: 18, spacing: 1,
    cardPadding: { x: 1.5, y: 1 },
    maxCastVisible: 2, statsColumns: 3,
    showLegendLabels: false, showCallSheetButton: false, compactMode: true,
  },
  md: {
    headerPadding: 2, contentPadding: 2,
    fontSize: { title: '1.1rem', subtitle: '0.85rem', body: '0.8rem', caption: '0.7rem', stats: '1.4rem' },
    chipHeight: 22, iconSize: 20, spacing: 1.5,
    cardPadding: { x: 2, y: 1 },
    maxCastVisible: 3, statsColumns: 4,
    showLegendLabels: true, showCallSheetButton: true, compactMode: false,
  },
  lg: {
    headerPadding: 2, contentPadding: 2,
    fontSize: { title: '1.2rem', subtitle: '0.9rem', body: '0.85rem', caption: '0.75rem', stats: '1.5rem' },
    chipHeight: 24, iconSize: 22, spacing: 2,
    cardPadding: { x: 2, y: 1 },
    maxCastVisible: 4, statsColumns: 5,
    showLegendLabels: true, showCallSheetButton: true, compactMode: false,
  },
  xl: {
    headerPadding: 2.5, contentPadding: 2.5,
    fontSize: { title: '1.3rem', subtitle: '0.95rem', body: '0.9rem', caption: '0.8rem', stats: '1.6rem' },
    chipHeight: 26, iconSize: 24, spacing: 2,
    cardPadding: { x: 2.5, y: 1.25 },
    maxCastVisible: 5, statsColumns: 6,
    showLegendLabels: true, showCallSheetButton: true, compactMode: false,
  },
  xxl: {
    headerPadding: 3, contentPadding: 3,
    fontSize: { title: '1.4rem', subtitle: '1rem', body: '0.95rem', caption: '0.85rem', stats: '1.8rem' },
    chipHeight: 28, iconSize: 26, spacing: 2.5,
    cardPadding: { x: 3, y: 1.5 },
    maxCastVisible: 6, statsColumns: 6,
    showLegendLabels: true, showCallSheetButton: true, compactMode: false,
  },
  '4k': {
    headerPadding: 4, contentPadding: 4,
    fontSize: { title: '1.6rem', subtitle: '1.1rem', body: '1rem', caption: '0.9rem', stats: '2rem' },
    chipHeight: 32, iconSize: 30, spacing: 3,
    cardPadding: { x: 4, y: 2 },
    maxCastVisible: 8, statsColumns: 6,
    showLegendLabels: true, showCallSheetButton: true, compactMode: false,
  },
};

export function getResponsiveValues(tier: ScreenTier): ResponsiveValues {
  return RESPONSIVE_SCALES[tier];
}
