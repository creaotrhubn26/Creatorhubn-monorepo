// @ts-nocheck
/**
 * RoleRoomTabRail — vertical icon-only navigation rail for iPad landscape.
 *
 * Replaces the horizontal scrollable Tabs strip with a fixed-width side rail
 * when there's enough horizontal real estate (tabletLandscape). Each rail
 * button is a 56x56 hit area with the existing tab icon, a label below, and
 * an active-bar indicator on the left edge. Tapping a rail button calls back
 * with the same SubTab value the existing Tabs would have produced — caller
 * keeps its state machine.
 *
 * Backlog coverage:
 *  - 055: kompakt side rail for hovedflater på iPad
 *  - 062: bredere kort på iPad (rail frees up the horizontal scrollbar)
 *  - 068: hover-free feedback (active-state instead of hover tooltip)
 *
 * Non-goals:
 *  - 061 (resizable): width is hardcoded via --rr-side-rail-width token
 *  - This component renders only on tabletLandscape; caller decides when.
 */

import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';

export interface TabRailItem {
  value: string;
  label: string;
  Icon: SvgIconComponent;
  /** Optional accent color override for the active state. Default: violet. */
  accent?: string;
  /** When true, render the item but visually distinguish it (e.g. Admin Room). */
  highlight?: boolean;
}

interface RoleRoomTabRailProps {
  items: TabRailItem[];
  value: string;
  onChange: (next: string) => void;
  /** When false, render nothing (caller owns the gate). */
  visible: boolean;
  ariaLabel?: string;
}

const RAIL_BUTTON_HEIGHT = 64;

export const RoleRoomTabRail: React.FC<RoleRoomTabRailProps> = ({
  items,
  value,
  onChange,
  visible,
  ariaLabel = 'Hovedseksjoner',
}) => {
  if (!visible) return null;

  return (
    <Box
      component="nav"
      aria-label={ariaLabel}
      className="rr-tab-rail"
      sx={{
        width: 'var(--rr-side-rail-width, 88px)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        py: 1,
        gap: 0.5,
        bgcolor: 'rgba(20,14,48,0.55)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--rr-card-radius, 12px)',
        position: 'sticky',
        top: 12,
        alignSelf: 'flex-start',
        maxHeight: 'calc(100dvh - 24px)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
      }}
    >
      {items.map((item) => {
        const ItemIcon = item.Icon;
        const isActive = item.value === value;
        const accent = item.accent ?? '#a78bfa';

        return (
          <Tooltip key={item.value} title={item.label} placement="right" arrow>
            <Box
              component="button"
              onClick={() => onChange(item.value)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.25,
                width: '100%',
                minHeight: RAIL_BUTTON_HEIGHT,
                px: 0.5,
                py: 1,
                bgcolor: 'transparent',
                color: isActive ? accent : 'rgba(255,255,255,0.72)',
                border: 'none',
                borderRadius: 1.5,
                cursor: 'pointer',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'background-color 0.18s ease, color 0.18s ease, transform 0.12s ease',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                '&::before': isActive
                  ? {
                      content: '""',
                      position: 'absolute',
                      left: 4,
                      top: 8,
                      bottom: 8,
                      width: 3,
                      borderRadius: 1.5,
                      bgcolor: accent,
                    }
                  : undefined,
                '@media (hover: hover)': {
                  '&:hover': {
                    bgcolor: 'rgba(167,139,250,0.08)',
                    color: accent,
                  },
                },
                '&:active': {
                  transform: 'scale(0.96)',
                  bgcolor: 'rgba(167,139,250,0.18)',
                },
                '&:focus-visible': {
                  outline: '3px solid #8b5cf6',
                  outlineOffset: 2,
                },
                ...(item.highlight && !isActive
                  ? { color: '#a78bfa' }
                  : {}),
              }}
            >
              <ItemIcon sx={{ fontSize: 22 }} />
              <Typography
                component="span"
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: isActive ? 600 : 500,
                  lineHeight: 1.1,
                  textAlign: 'center',
                  letterSpacing: 0.1,
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                }}
              >
                {item.label}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};

export default RoleRoomTabRail;
