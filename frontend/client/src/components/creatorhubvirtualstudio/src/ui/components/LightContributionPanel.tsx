import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  IconButton,
  Chip,
  LinearProgress,
  Tooltip,
  Button,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  RadioButtonChecked as SoloIcon,
  Lightbulb as LightIcon,
} from '@mui/icons-material';
import { useNodes } from '@/state/selectors';
import { lightContributionService, type ContributionAnalysis } from '@/core/services/lightContributionService';

interface LightContributionPanelProps {
  onToggleLight: (lightId: string, enabled: boolean) => void;
  onSoloLight: (lightId: string) => void;
  onEnableAllLights: () => void;
}

export function LightContributionPanel({
  onToggleLight,
  onSoloLight,
  onEnableAllLights,
}: LightContributionPanelProps) {
  const nodes = useNodes();

  const analysis: ContributionAnalysis = useMemo(() => {
    return lightContributionService.analyzeLights(nodes);
  }, [nodes]);

  const getBalanceColor = (balance: string) => {
    switch (balance) {
      case 'good':
        return 'success';
      case 'unbalanced':
        return 'warning';
      case 'single-source':
        return 'info';
      default:
        return 'default';
    }
  };

  const getBalanceLabel = (balance: string) => {
    switch (balance) {
      case 'good':
        return 'Balanced';
      case 'unbalanced':
        return 'Unbalanced';
      case 'single-source':
        return 'Single Source';
      default:
        return 'Unknown';
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600}}>
          Light Contribution:
        </Typography>
        <Button size="small" onClick={onEnableAllLights} variant="outlined">
          Enable All
        </Button>
      </Box>

      {/* Balance Status */}
      <Box sx={{ mb: 1.5 }}>
        <Chip
          label={getBalanceLabel(analysis.balance)}
          color={getBalanceColor(analysis.balance) as any}
          size="small"
          sx={{ mr: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          {analysis.lights.filter((l) => l.isEnabled).length} of {analysis.lights.length} lights active
        </Typography>
      </Box>

      {/* Light List */}
      {analysis.lights.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          No lights in scene
        </Typography>
      ) : (
        <Stack spacing={1}>
          {analysis.lights.map((light) => {
            const contributionPercent = lightContributionService.getContributionPercentage(
              light.lightId,
              analysis
            );
            const isDominant = light.lightId === analysis.dominantLight;

            return (
              <Paper
                key={light.lightId}
                elevation={1}
                sx={{
                  p: 1.5,
                  opacity: light.isEnabled ? 1 : 0.5,
                  border: isDominant ? '2px solid #FFD700' : 'none'}}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LightIcon fontSize="small" color={light.isEnabled ? 'primary' : 'disabled'} />
                    <Typography variant="body2" sx={{ fontWeight: 600}}>
                      {light.lightName}
                    </Typography>
                    {light.role && (
                      <Chip label={light.role} size="small" sx={{ fontSize: 10 }} />
                    )}
                    {isDominant && (
                      <Chip label="Dominant" size="small" color="warning" sx={{ fontSize: 10 }} />
                    )}
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Solo">
                      <IconButton size="small" onClick={() => onSoloLight(light.lightId)}>
                        <SoloIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={light.isEnabled ? 'Hide' : 'Show'}>
                      <IconButton
                        size="small"
                        onClick={() => onToggleLight(light.lightId, !light.isEnabled)}
                      >
                        {light.isEnabled ? (
                          <VisibilityIcon fontSize="small" />
                        ) : (
                          <VisibilityOffIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>

                {/* Contribution Bar */}
                <Box sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Contribution: {contributionPercent.toFixed(1)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={contributionPercent}
                    sx={{ height: 6, borderRadius: 1 }}
                  />
                </Box>

                {/* Light Info */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="caption" color="text.secondary">
                    Power: {(light.power * 100).toFixed(0)}%
                  </Typography>
                  {light.cct && (
                    <Typography variant="caption" color="text.secondary">
                      CCT: {light.cct}K
                    </Typography>
                  )}
                </Box>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

