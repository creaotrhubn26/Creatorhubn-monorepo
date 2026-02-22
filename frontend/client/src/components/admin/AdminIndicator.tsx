import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import {
  Box,
  Chip,
  Typography,
  Paper,
  Avatar,
  Tooltip,
} from '@mui/material';
import { AdminPanelSettings, Shield, Verified } from '@mui/icons-material';

interface AdminIndicatorProps {
  userEmail?: string;
  profession?: string;
  variant?: 'compact' | 'full';
}

export default function AdminIndicator({
  userEmail = 'daniel@creatorhubn.com', 
  profession = 'admin',
  variant = 'compact'
}: AdminIndicatorProps) {
  // Theming system
  const theming = useTheming('prototype_tester');
  
  const isAdmin = userEmail === 'daniel@creatorhubn.com';

  if (!isAdmin) {
    return null;
}

  const getProfessionColors = () => {
    switch (profession) {
      case 'photographer':
        return {
          primary: '#FF8C00',
          secondary: '#FF6B00',
          icon: '📸'
    };
      case 'videographer':
        return {
          primary: '#E91E63',
          secondary: '#C2185B',
          icon: '🎬'
    };
      case 'music_producer':
        return {
          primary: '#9C27B0',
          secondary: '#7B1FA2',
          icon: '🎵'
    };
      case 'vendor':
        return {
          primary: '#2196F3',
          secondary: '#1976D2',
          icon: '🏢'
    };
      default: return {
          primary: '#F44336',
          secondary: '#D32F2F',
          icon: '👑'
    };
  }
};

  const colors = getProfessionColors();

  if (variant === 'compact') {
    return (
      <Tooltip title="Administrator - daniel@creatorhubn.com har full tilgang til alle systemer">
        <Chip
          icon={<Shield />}
          label="ADMIN"
          size="small"
          sx={{
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.75rem',
            border: '2px solid rgba(25, 255, 255, 0.3)',
            '& .MuiChip-icon': {
              color: 'white',
            },
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%': {
                boxShadow: `0 0 0 0 ${colors.primary}40`,
              },
              '70%': {
                boxShadow: `0 0 0 10px ${colors.primary}00`,
              },
              '100%': {
                boxShadow: `0 0 0 0 ${colors.primary}00`,
              },
            },
          }}
        />
      </Tooltip>
    );
}

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        background: `linear-gradient(135deg, ${colors.primary}15 0%, ${colors.secondary}10 100%)`,
        border: `2px solid ${colors.primary}`,
        borderRadius: 3,
        mb: 2,
        ...theming.getThemedCardSx()
  }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2}}>
        <Avatar
          sx={{
            bgcolor: colors.primary,
            width: 48,
            height: 48,
            border: '3px solid white',
            boxShadow: 3
      }}
        >
          <AdminPanelSettings sx={{ fontSize: 28 }} />
        </Avatar>
        
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="h6" 
              sx={{ 
                color: theming.colors.primary, 
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
          }}>
              {colors.icon} ADMINISTRATOR TILGANG
              <Verified sx={{ color: colors.primary, fontSize: 20 }} />
            </Typography>
          </Box>
          
          <Typography 
            variant="body1" 
            sx={{ 
              color: colors.secondary, 
              fontWeight: 'bold',
              mb: 0.5
        }}
          >
            daniel@creatorhubn.com
          </Typography>
          
          <Typography 
            variant="body2" 
            color="textSecondary"
          >
            Full tilgang til alle dashboardsystemer, brukeradministrasjon og plattforminnstillinger
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'right' }}>
          <Chip
            icon={<Shield />}
            label="SUPER ADMIN"
            size="small"
            sx={{
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
              color: 'white',
              fontWeight: 'bold',
              mb: 1,
              '& .MuiChip-icon': {
                color: 'white',
              },
            }}
          />
          <Typography 
            variant="caption" 
            display="block" 
            color="textSecondary"
            sx={{ fontWeight: 'bold' }}
          >
            Alle rettigheter
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}