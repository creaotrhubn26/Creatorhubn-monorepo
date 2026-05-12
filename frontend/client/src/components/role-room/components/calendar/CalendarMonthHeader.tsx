/**
 * CalendarMonthHeader — måneds-navigasjon + view-toggle + "I dag"-knapp.
 *
 * Tilsvarer den horisontale raden i designet:
 *
 *   [Måned-velger ▼]           [MÅNED|UKE|DAG]  [<]  [I dag]  [>]
 *
 * Måned-velgeren er en knapp som åpner en MenuList med 12 måneder for
 * året (±1 år fra current). Klikker man "I dag" gjenoppretter
 * monthDate til dagens måned.
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Divider,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  CalendarViewMonth as MonthIcon,
  CalendarViewWeek as WeekIcon,
  CalendarViewDay as DayIcon,
} from '@mui/icons-material';

export type CalendarViewMode = 'month' | 'week' | 'day';

export interface CalendarMonthHeaderProps {
  monthDate: Date;
  viewMode: CalendarViewMode;
  onMonthChange: (newDate: Date) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
}

const MONTH_LABELS_NB = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
];

function shiftMonth(date: Date, delta: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  return next;
}

export const CalendarMonthHeader: React.FC<CalendarMonthHeaderProps> = ({
  monthDate,
  viewMode,
  onMonthChange,
  onViewModeChange,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const monthOptions = useMemo(() => {
    const currentYear = monthDate.getFullYear();
    const options: Array<{ label: string; date: Date }> = [];
    for (let y = currentYear - 1; y <= currentYear + 1; y += 1) {
      for (let m = 0; m < 12; m += 1) {
        options.push({
          label: `${MONTH_LABELS_NB[m]} ${y}`,
          date: new Date(y, m, 1),
        });
      }
    }
    return options;
  }, [monthDate]);

  const monthLabel = `${MONTH_LABELS_NB[monthDate.getMonth()]} ${monthDate.getFullYear()}`;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        py: 1,
      }}
    >
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="text"
          endIcon={<ExpandMoreIcon />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            color: '#fff',
            fontSize: { xs: '1.1rem', md: '1.35rem' },
            fontWeight: 600,
            textTransform: 'none',
            px: 2,
            '&:hover': { bgcolor: 'rgba(139,92,246,0.08)' },
          }}
        >
          {monthLabel}
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={() => setAnchorEl(null)}
          PaperProps={{
            sx: {
              maxHeight: 360,
              bgcolor: '#1a1a2e',
              color: '#fff',
              border: '1px solid rgba(139,92,246,0.3)',
            },
          }}
        >
          {monthOptions.map((opt) => {
            const isCurrent =
              opt.date.getFullYear() === monthDate.getFullYear() &&
              opt.date.getMonth() === monthDate.getMonth();
            return (
              <MenuItem
                key={opt.label}
                selected={isCurrent}
                onClick={() => {
                  onMonthChange(opt.date);
                  setAnchorEl(null);
                }}
                sx={{
                  fontSize: '0.85rem',
                  '&.Mui-selected': { bgcolor: 'rgba(139,92,246,0.18)' },
                  '&:hover': { bgcolor: 'rgba(139,92,246,0.1)' },
                }}
              >
                {opt.label}
              </MenuItem>
            );
          })}
        </Menu>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          size="small"
          onChange={(_, value) => {
            if (value) onViewModeChange(value);
          }}
          aria-label="Velg kalender-visning"
          sx={{
            '& .MuiToggleButton-root': {
              color: 'rgba(255,255,255,0.7)',
              borderColor: 'rgba(255,255,255,0.15)',
              textTransform: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              px: 1.5,
              py: 0.5,
              gap: 0.5,
              '&.Mui-selected': {
                bgcolor: 'rgba(139,92,246,0.22)',
                color: '#c4b5fd',
                borderColor: 'rgba(139,92,246,0.5)',
                '&:hover': { bgcolor: 'rgba(139,92,246,0.3)' },
              },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            },
          }}
        >
          <ToggleButton value="month" aria-label="Måned-visning">
            <MonthIcon sx={{ fontSize: 16 }} />
            Måned
          </ToggleButton>
          <ToggleButton value="week" aria-label="Uke-visning">
            <WeekIcon sx={{ fontSize: 16 }} />
            Uke
          </ToggleButton>
          <ToggleButton value="day" aria-label="Dag-visning">
            <DayIcon sx={{ fontSize: 16 }} />
            Dag
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.12)', my: 0.5 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => onMonthChange(shiftMonth(monthDate, -1))}
            aria-label="Forrige måned"
            sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#c4b5fd' } }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Button
            size="small"
            variant="text"
            onClick={() => onMonthChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            sx={{
              color: 'rgba(255,255,255,0.85)',
              textTransform: 'none',
              fontSize: '0.78rem',
              fontWeight: 600,
              minWidth: 56,
              '&:hover': { bgcolor: 'rgba(139,92,246,0.1)', color: '#c4b5fd' },
            }}
          >
            <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 'inherit' }}>
              I dag
            </Typography>
          </Button>
          <IconButton
            size="small"
            onClick={() => onMonthChange(shiftMonth(monthDate, 1))}
            aria-label="Neste måned"
            sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#c4b5fd' } }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};
