/**
 * ProductionDayCardInfo Component
 * 
 * Displays production day information in shot list cards
 * Shows date, time range, status, and time statistics
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  AccessTime as TimeIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { ProductionDay, CastingShot } from '../models/casting';
import { productionPlanningService } from '../services/productionPlanningService';

interface ProductionDayCardInfoProps {
  productionDay: ProductionDay | null;
  shots: CastingShot[];
  compact?: boolean;
}

export function ProductionDayCardInfo({ 
  productionDay, 
  shots,
  compact = false 
}: ProductionDayCardInfoProps) {
  const stats = useMemo(() => {
    if (!productionDay) return null;

    const availableTime = productionPlanningService.calculateAvailableTime(productionDay);
    const estimatedTime = productionPlanningService.calculateEstimatedTime(shots);
    const actualTime = productionPlanningService.calculateActualTime(shots);
    const isTimePressure = productionPlanningService.isTimePressureMode(productionDay, shots);
    const deadline = productionPlanningService.calculateDeadline(productionDay);
    const remainingShots = shots.filter((shot) => shot.status !== 'completed').length;
    const minutesToDeadline = deadline
      ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 60000))
      : null;
    
    // Calculate total available time for the day (callTime to wrapTime)
    const [callHours, callMins] = productionDay.callTime.split(':').map(Number);
    const [wrapHours, wrapMins] = productionDay.wrapTime.split(':').map(Number);
    const totalAvailable = (wrapHours * 60 + wrapMins) - (callHours * 60 + callMins);
    
    const progress = totalAvailable > 0 ? (actualTime / totalAvailable) * 100 : 0;
    const timeRemaining = Math.max(0, availableTime - estimatedTime);
    const fitsInDay = estimatedTime <= availableTime;

    return {
      availableTime,
      estimatedTime,
      actualTime,
      totalAvailable,
      isTimePressure,
      progress,
      timeRemaining,
      fitsInDay,
      remainingShots,
      minutesToDeadline,
    };
  }, [productionDay, shots]);

  if (!productionDay) {
    return null;
  }

  const formatTimeMinutes = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}t ${mins}m` : `${hours}t`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    
    if (dateOnly.getTime() === today.getTime()) {
      return 'I dag';
    }
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateOnly.getTime() === tomorrow.getTime()) {
      return 'I morgen';
    }
    
    return date.toLocaleDateString('nb-NO', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'in_progress': return '#4caf50';
      case 'completed': return '#2196f3';
      case 'cancelled': return '#f44336';
      default: return 'rgba(255,255,255,0.5)';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'in_progress': return 'Pågår';
      case 'completed': return 'Fullført';
      case 'cancelled': return 'Avlyst';
      default: return 'Planlagt';
    }
  };

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
        <CalendarIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.87)' }} />
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
          {formatDate(productionDay.date)} • {productionDay.callTime} - {productionDay.wrapTime}
        </Typography>
        <Chip
          label={getStatusLabel(productionDay.status)}
          size="small"
          sx={{
            height: 18,
            fontSize: '9px',
            bgcolor: alpha(getStatusColor(productionDay.status), 0.2),
            color: getStatusColor(productionDay.status),
            border: `1px solid ${alpha(getStatusColor(productionDay.status), 0.3)}`,
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        mt: 1.5,
        p: 1.5,
        bgcolor: stats?.isTimePressure 
          ? alpha('#9333ea', 0.1) 
          : alpha('#4caf50', 0.05),
        border: `1px solid ${
          stats?.isTimePressure 
            ? alpha('#9333ea', 0.3) 
            : alpha('#4caf50', 0.2)
        }`,
        borderRadius: 1.5,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.87)' }} />
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
            {formatDate(productionDay.date)}
          </Typography>
        </Box>
        <Chip
          label={getStatusLabel(productionDay.status)}
          size="small"
          sx={{
            height: 20,
            fontSize: '10px',
            bgcolor: alpha(getStatusColor(productionDay.status), 0.2),
            color: getStatusColor(productionDay.status),
            border: `1px solid ${alpha(getStatusColor(productionDay.status), 0.3)}`,
            fontWeight: 600,
          }}
        />
      </Box>

      {/* Time Range */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <ScheduleIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.87)' }} />
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
          {productionDay.callTime} - {productionDay.wrapTime}
        </Typography>
      </Box>

      {/* Time Statistics */}
      {stats && (
        <>
          {/* Progress Bar */}
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '10px' }}>
                Fremdrift
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '10px' }}>
                {formatTimeMinutes(stats.actualTime)} / {formatTimeMinutes(stats.totalAvailable)}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, stats.progress)}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: alpha('#fff', 0.1),
                '& .MuiLinearProgress-bar': {
                  bgcolor: stats.isTimePressure ? '#9333ea' : '#4caf50',
                  borderRadius: 3,
                },
              }}
            />
          </Box>

          {/* Time Info */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TimeIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.87)' }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '10px' }}>
                  Estimert tid:
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#fff', fontSize: '10px', fontWeight: 600 }}>
                {formatTimeMinutes(stats.estimatedTime)}
              </Typography>
            </Box>
            
            {stats.availableTime > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TimeIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.87)' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '10px' }}>
                    Tilgjengelig tid:
                  </Typography>
                </Box>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: stats.isTimePressure ? '#9333ea' : '#4caf50', 
                    fontSize: '10px', 
                    fontWeight: 600 
                  }}
                >
                  {formatTimeMinutes(stats.availableTime)}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '10px' }}>
                Shots igjen:
              </Typography>
              <Typography variant="caption" sx={{ color: '#fff', fontSize: '10px', fontWeight: 600 }}>
                {stats.remainingShots}
              </Typography>
            </Box>

            {stats.minutesToDeadline !== null && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '10px' }}>
                  Tid til wrap:
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: stats.isTimePressure ? '#9333ea' : '#fff',
                    fontSize: '10px',
                    fontWeight: 600,
                  }}
                >
                  {formatTimeMinutes(stats.minutesToDeadline)}
                </Typography>
              </Box>
            )}

            {/* Time Pressure Warning */}
            {stats.isTimePressure && (
              <Tooltip title="Estimert tid overstiger tilgjengelig tid">
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mt: 0.5,
                    p: 0.75,
                    bgcolor: alpha('#9333ea', 0.15),
                    borderRadius: 1,
                    border: `1px solid ${alpha('#9333ea', 0.3)}`,
                  }}
                >
                  <WarningIcon sx={{ fontSize: 14, color: '#9333ea' }} />
                  <Typography variant="caption" sx={{ color: '#9333ea', fontSize: '10px', fontWeight: 600 }}>
                    Time pressure: {formatTimeMinutes(Math.abs(stats.availableTime - stats.estimatedTime))} over tid
                  </Typography>
                </Box>
              </Tooltip>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}

