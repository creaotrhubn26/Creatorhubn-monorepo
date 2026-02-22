/**
 * Compact Badge Display - Viser badge status kompakt andre steder i appen
 */

import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import {
  Box,
  Avatar,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Verified as VerifiedIcon,
  Star as StarIcon,
  EmojiEvents as TrophyIcon,
  Psychology as ExpertIcon,
  Info as InfoIcon,
  TrendingUp as ProgressIcon,
} from '@mui/icons-material';

interface BadgeLevel {
  id: string;
  name: string;
  color: string;
  icon: React.ReactNode;
  requiredPoints: number
}

const BADGE_LEVELS: BadgeLevel[] = [
  { id: 'newcomer', name: 'Newcomer', color: '#9E9E90', icon: <InfoIcon />, requiredPoints:  0 },
  { id: 'bronze', name: 'Bronze Verified', color: '#CD7F30', icon: <VerifiedIcon />, requiredPoints: 100,},
  { id: 'silver', name: 'Silver Verified', color: '#C0C0C0', icon: <StarIcon />, requiredPoints: 350,},
  { id: 'gold', name: 'Gold Verified', color: '#FFD700', icon: <TrophyIcon />, requiredPoints: 750,},
  { id: 'platinum', name: 'Platinum Expert', color: '#E5E4E0', icon: <ExpertIcon />, requiredPoints: 1500,}
];

interface CompactBadgeDisplayProps {
  currentPoints?: number;
  size?: 'small' | 'medium' | 'large';
  showProgress?: boolean;
  showPoints?: boolean;
  onClick?: () => void;
  // Integration props for universal workflow connectivity
  profession?: string;
  userId?: string;
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

export const CompactBadgeDisplay: React.FC<CompactBadgeDisplayProps> = ({
  currentPoints = 0,
  size = 'medium',
  showProgress = false,
  showPoints = true,
  onClick,
  profession,
  userId,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect
}) => {
  // Theming system
  const theming = useTheming('photographer');

  // Find current level
  const getCurrentLevel = (): BadgeLevel => {
    for (let i = BADGE_LEVELS.length - 1; i >= 0; i--) {
      if (currentPoints >= BADGE_LEVELS[i].requiredPoints) {
        return BADGE_LEVELS[i];
    }
  }
    return BADGE_LEVELS[0];
};

  const getNextLevel = (): BadgeLevel | null => {
    const currentLevel = getCurrentLevel();
    const currentIndex = BADGE_LEVELS.findIndex(l => l.id === currentLevel.id);
    return currentIndex < BADGE_LEVELS.length - 1 ? BADGE_LEVELS[currentIndex + 1] : null;
};

  const currentLevel = getCurrentLevel();
  const nextLevel = getNextLevel();
  
  const progressToNext = nextLevel 
    ? ((currentPoints - currentLevel.requiredPoints) / (nextLevel.requiredPoints - currentLevel.requiredPoints)) * 100
    : 100;

  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return { avatar:  32, fontSize: '0.75rem', chipSize: 'small' as const };
      case 'large':
        return { avatar:  56, fontSize: '1rem', chipSize: 'medium' as const };
      default: return { avatar: 40, fontSize: '0.875rem', chipSize: 'small' as const };
  }
};

  const sizeConfig = getSizeConfig();

  return (
    <Tooltip title={`${currentLevel.name} - ${currentPoints} poeng${nextLevel ? ` (${nextLevel.requiredPoints - currentPoints} til ${nextLevel.name})` : ', '}`}>
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap:  1,
          cursor: onClick ? 'pointer' : 'default',
          p:  1,
          borderRadius: 1,
          '&:hover': onClick ? { bgcolor: 'action.hover' } : {},
        }}
        onClick={onClick}
      >
        <Avatar
          sx={{
            bgcolor: currentLevel.color,
            width: sizeConfig.avatar,
            height: sizeConfig.avatar,
            border: '2px solid #fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}
        >
          {currentLevel.icon}
        </Avatar>
        
        <Box sx={{ flex: 1, minWidth:  0 }}>
          <Typography 
            variant="subtitle2" 
            sx={{ 
              fontWeight: 'bold',
              color: currentLevel.color,
              fontSize: sizeConfig.fontSize
        }}
          >
            {currentLevel.name}
          </Typography>
          
          {showPoints && (
            <Typography variant="caption" color="text.secondary">
              {currentPoints.toLocaleString()} poeng
              {nextLevel && ` • ${nextLevel.requiredPoints - currentPoints} til ${nextLevel.name}`}
            </Typography>
          )}
          
          {showProgress && nextLevel && (
            <LinearProgress
              variant="determinate"
              value={progressToNext}
              sx={{
                height:  4,
                borderRadius:  2,
                mt: 0.5,
                bgcolor: 'rgba(0,0,0,0.1)','& .MuiLinearProgress-bar': {
                  background: `linear-gradient(90deg, ${currentLevel.color}, ${nextLevel.color})`
              }
            }}
            />
          )}
        </Box>
        
        {onClick && (
          <IconButton size="small">
            <ProgressIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Tooltip>
  );
};