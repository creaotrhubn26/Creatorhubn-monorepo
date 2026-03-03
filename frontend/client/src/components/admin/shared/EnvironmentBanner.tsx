/**
 * CreatorHub Norge - Environment Banner
 * Shows current environment with safe mode and secret visibility toggles
 */

import React from 'react';
import {
  Alert,
  Box,
  Chip,
  FormControlLabel,
  IconButton,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  BugReport as TestIcon,
  Code as DevIcon,
  RocketLaunch as ProdIcon,
  Shield as SafeModeIcon,
  Visibility as ShowIcon,
  VisibilityOff as HideIcon,
} from '@mui/icons-material';

interface EnvironmentBannerProps {
  environment: 'development' | 'staging' | 'production';
  safeMode: boolean;
  onSafeModeToggle: (enabled: boolean) => void;
  showSecrets: boolean;
  onShowSecretsToggle: (show: boolean) => void;
}

const environmentConfig = {
  development: {
    label: 'Utvikling',
    color: 'info' as const,
    icon: <DevIcon />, 
    bgColor: '#e3f2fd',
    borderColor: '#2196f3',
    description: 'Utviklingsmiljø for eksperimentering',
  },
  staging: {
    label: 'Test',
    color: 'warning' as const,
    icon: <TestIcon />,
    bgColor: '#fff3e0',
    borderColor: '#ff9800',
    description: 'Test-miljø for validering før produksjon',
  },
  production: {
    label: 'Produksjon',
    color: 'error' as const,
    icon: <ProdIcon />,
    bgColor: '#ffebee',
    borderColor: '#f44336',
    description: 'Vær forsiktig med endringer i produksjon',
  },
};

export default function EnvironmentBanner({
  environment,
  safeMode,
  onSafeModeToggle,
  showSecrets,
  onShowSecretsToggle,
}: EnvironmentBannerProps) {
  const config = environmentConfig[environment];

  return (
    <Alert
      severity={config.color}
      icon={config.icon}
      sx={{
        mb: 2,
        bgcolor: config.bgColor,
        borderLeft: `4px solid ${config.borderColor}`,
        '& .MuiAlert-icon': {
          color: config.borderColor,
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Miljø: {config.label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {config.description}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                checked={safeMode}
                onChange={(event) => onSafeModeToggle(event.target.checked)}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SafeModeIcon fontSize="small" />
                <Typography variant="body2">Sikker modus</Typography>
              </Box>
            }
          />

          <Tooltip title={showSecrets ? 'Skjul hemmeligheter' : 'Vis hemmeligheter'}>
            <IconButton
              size="small"
              onClick={() => onShowSecretsToggle(!showSecrets)}
              color={showSecrets ? 'primary' : 'default'}
            >
              {showSecrets ? <HideIcon /> : <ShowIcon />}
            </IconButton>
          </Tooltip>

          <Chip label={config.label.toUpperCase()} color={config.color} size="small" icon={config.icon} />
        </Box>
      </Box>
    </Alert>
  );
}
