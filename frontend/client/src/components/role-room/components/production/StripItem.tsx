/**
 * StripItem.tsx
 * Renders a single scene strip — either full card or compact row.
 * Both `renderStrip` and `renderCompactStrip` from the original file
 * are unified here via the `compact` prop.
 */

import React, { type FC, type DragEvent } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Tooltip,
  Checkbox,
  alpha,
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Place as PlaceIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Notes as NotesIcon,
} from '@mui/icons-material';
import type { StripboardStrip } from '../../services/productionWorkflowService';
import { STRIP_COLORS, STATUS_CONFIG, getStripColorFromHex } from './stripboard.constants';
import type { PrintOptions, ResponsiveValues } from './stripboard.types';

// ─── Utility ──────────────────────────────────────────────────────────────────

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}t ${mins}m` : `${mins}m`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface StripItemProps {
  strip: StripboardStrip;
  /** If true, renders the compact single-line row; else the full card. */
  compact?: boolean;
  isMobile: boolean;
  responsive: ResponsiveValues;
  selectedStrip: StripboardStrip | null;
  selectedStrips: Set<string>;
  toggleStripSelection: (id: string) => void;
  handleDragStart: (e: DragEvent<HTMLElement>, strip: StripboardStrip) => void;
  onSelect: (strip: StripboardStrip) => void;
  onSceneSelect?: (sceneId: string) => void;
  printOptions: PrintOptions;
  compactView: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const StripItem: FC<StripItemProps> = React.memo(function StripItem({
  strip,
  compact,
  isMobile,
  responsive,
  selectedStrip,
  selectedStrips,
  toggleStripSelection,
  handleDragStart,
  onSelect,
  onSceneSelect,
  printOptions,
  compactView,
}) {
  const colorKey = getStripColorFromHex(strip.color);
  const colorConfig = STRIP_COLORS[colorKey];

  // ── Compact row ─────────────────────────────────────────────────────────

  if (compact || compactView) {
    const isExt = colorKey.startsWith('EXT');
    return (
      <Box
        draggable={!isMobile}
        onDragStart={e => !isMobile && handleDragStart(e, strip)}
        onClick={() => onSelect(strip)}
        onDoubleClick={() => onSceneSelect?.(strip.sceneId)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          py: 0.5,
          px: 1,
          mb: 0.5,
          bgcolor: strip.color,
          color: colorConfig.textColor || 'inherit',
          borderRadius: 0.75,
          cursor: isMobile ? 'pointer' : 'grab',
          border:
            selectedStrip?.id === strip.id
              ? '2px solid #7C3AED'
              : '1px solid rgba(0,0,0,0.1)',
          transition: 'all 0.15s',
          minHeight: 28,
          '&:hover': {
            transform: 'translateX(2px)',
            boxShadow: 1,
            bgcolor: alpha(strip.color, 0.9),
          },
        }}
      >
        <Typography
          sx={{ minWidth: 32, fontSize: '0.7rem', fontWeight: 700, color: colorConfig.textColor }}
        >
          {strip.sceneNumber}
        </Typography>
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: isExt ? '#3b82f6' : '#6b7280',
            flexShrink: 0,
          }}
        />
        <Typography
          sx={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '0.65rem',
            color: colorConfig.textColor,
            opacity: 0.9,
          }}
        >
          {strip.location}
        </Typography>
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: colorConfig.textColor, opacity: 0.8 }}>
          {strip.pages}p
        </Typography>
      </Box>
    );
  }

  // ── Full card ───────────────────────────────────────────────────────────

  return (
    <Card
      draggable={!isMobile}
      onDragStart={e => !isMobile && handleDragStart(e, strip)}
      sx={{
        mb: responsive.spacing,
        cursor: isMobile ? 'pointer' : 'grab',
        bgcolor: strip.color,
        color: colorConfig.textColor || 'inherit',
        border:
          selectedStrip?.id === strip.id
            ? '2px solid #7C3AED'
            : '1px solid transparent',
        borderRadius: { xs: 1.5, sm: 2, md: 2 },
        transition: 'all 0.2s',
        '&:hover': {
          transform: isMobile ? 'none' : 'translateX(4px)',
          boxShadow: 4,
          borderColor: alpha('#7C3AED', 0.5),
        },
        '&:active': { cursor: isMobile ? 'pointer' : 'grabbing' },
      }}
      onClick={() => onSelect(strip)}
      onDoubleClick={() => onSceneSelect?.(strip.sceneId)}
    >
      <CardContent
        sx={{
          py: responsive.cardPadding.y,
          px: responsive.cardPadding.x,
          '&:last-child': { pb: responsive.cardPadding.y },
        }}
      >
        {/* ── Header row ──────────────────────────────────────────── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: { xs: 'wrap', sm: 'nowrap' },
            gap: { xs: 0.5, sm: 1 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
            <Checkbox
              size="small"
              checked={selectedStrips.has(strip.id)}
              onChange={() => toggleStripSelection(strip.id)}
              sx={{ color: colorConfig.textColor, '&.Mui-checked': { color: colorConfig.textColor } }}
            />
            {!isMobile && <DragIcon sx={{ opacity: 0.5, fontSize: responsive.iconSize }} />}
            <Typography
              variant="subtitle1"
              fontWeight="bold"
              sx={{ fontSize: responsive.fontSize.subtitle }}
            >
              {responsive.compactMode
                ? `S${strip.sceneNumber}`
                : `Scene ${strip.sceneNumber}`}
            </Typography>
            <Chip
              label={
                responsive.compactMode
                  ? STATUS_CONFIG[strip.status].label.charAt(0)
                  : STATUS_CONFIG[strip.status].label
              }
              size="small"
              color={STATUS_CONFIG[strip.status].color}
              sx={{
                height: responsive.chipHeight,
                fontSize: responsive.fontSize.caption,
                minWidth: responsive.compactMode ? 24 : 'auto',
              }}
            />
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0.5, sm: 1 },
              ml: { xs: 'auto', sm: 0 },
            }}
          >
            <Tooltip title={`${strip.pages} sider`}>
              <Chip
                label={`${strip.pages}p`}
                size="small"
                variant="outlined"
                sx={{
                  height: responsive.chipHeight,
                  fontSize: responsive.fontSize.caption,
                  color: colorConfig.textColor,
                  borderColor: alpha(colorConfig.textColor, 0.5),
                  '& .MuiChip-label': { color: colorConfig.textColor },
                }}
              />
            </Tooltip>
            {!responsive.compactMode && (
              <Tooltip title={formatTime(strip.estimatedTime)}>
                <Chip
                  icon={<ScheduleIcon sx={{ fontSize: responsive.iconSize - 4, color: colorConfig.textColor }} />}
                  label={formatTime(strip.estimatedTime)}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: responsive.chipHeight,
                    fontSize: responsive.fontSize.caption,
                    color: colorConfig.textColor,
                    borderColor: alpha(colorConfig.textColor, 0.5),
                    '& .MuiChip-label': { color: colorConfig.textColor },
                  }}
                />
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* ── Location & cast ──────────────────────────────────────── */}
        <Box
          sx={{
            mt: responsive.spacing,
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, sm: 2 },
            flexWrap: { xs: 'wrap', md: 'nowrap' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <PlaceIcon sx={{ opacity: 0.7, fontSize: responsive.iconSize, color: colorConfig.textColor }} />
            <Typography
              variant="body2"
              noWrap
              sx={{
                maxWidth: { xs: 120, sm: 150, md: 200, lg: 250, xl: 300 },
                fontSize: responsive.fontSize.body,
                color: colorConfig.textColor,
              }}
            >
              {strip.location}
            </Typography>
          </Box>
          <Box
            className={`cast-chips ${!printOptions.castInfo ? 'hide-in-print' : ''}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexWrap: 'wrap',
              flex: { xs: '1 0 100%', sm: 'unset' },
            }}
          >
            <PersonIcon sx={{ opacity: 0.7, fontSize: responsive.iconSize, color: colorConfig.textColor }} />
            {strip.cast.slice(0, responsive.maxCastVisible).map((char, idx) => (
              <Chip
                key={idx}
                label={char}
                size="small"
                sx={{
                  height: responsive.chipHeight - 4,
                  fontSize: responsive.fontSize.caption,
                  bgcolor: alpha(colorConfig.textColor, 0.15),
                  color: colorConfig.textColor,
                  '& .MuiChip-label': { color: colorConfig.textColor },
                }}
              />
            ))}
            {strip.cast.length > responsive.maxCastVisible && (
              <Chip
                label={`+${strip.cast.length - responsive.maxCastVisible}`}
                size="small"
                sx={{
                  height: responsive.chipHeight - 4,
                  fontSize: responsive.fontSize.caption,
                  bgcolor: alpha(colorConfig.textColor, 0.15),
                  color: colorConfig.textColor,
                  '& .MuiChip-label': { color: colorConfig.textColor },
                }}
              />
            )}
          </Box>
        </Box>

        {/* ── Notes ────────────────────────────────────────────────── */}
        {strip.notes && !responsive.compactMode && (
          <Typography
            variant="caption"
            className={`notes-text ${!printOptions.notes ? 'hide-in-print' : ''}`}
            sx={{
              display: 'block',
              mt: responsive.spacing,
              fontStyle: 'italic',
              opacity: 0.85,
              fontSize: responsive.fontSize.caption,
              color: colorConfig.textColor,
            }}
          >
            <NotesIcon
              sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle', color: colorConfig.textColor }}
            />{' '}
            {strip.notes}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
});

export default StripItem;
