/**
 * 🔗 Dependency Warning Component
 * Shows user-friendly warnings when feature dependencies are missing
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  AlertTitle,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { 
  DependencyCheckResult, 
  SuggestedAction,
  generateDependencyErrorMessage 
} from '@shared/feature-dependency-checker';

interface DependencyWarningProps {
  open: boolean;
  onClose: () => void;
  featureId: string;
  featureName: string;
  checkResult: DependencyCheckResult;
  onEnableDependencies?: (featureIds: string[]) => void;
  onUpgradePlan?: (plan: 'pro' | 'enterprise') => void;
}

export default function DependencyWarning({
  open,
  onClose,
  featureId,
  featureName,
  checkResult,
  onEnableDependencies,
  onUpgradePlan
}: DependencyWarningProps) {
  const handleEnableAll = () => {
    const featuresToEnable = checkResult.suggestedActions
      .filter(action => action.type === 'enable_feature')
      .map(action => action.featureId);
    
    if (featuresToEnable.length > 0 && onEnableDependencies) {
      onEnableDependencies(featuresToEnable);
    }
    onClose();
  };

  const handleUpgrade = () => {
    const upgradeAction = checkResult.suggestedActions.find(
      action => action.type === 'upgrade_plan'
    );
    
    if (upgradeAction && onUpgradePlan) {
      onUpgradePlan(upgradeAction.plan as 'pro' | 'enterprise');
    }
    onClose();
  };

  const needsUpgrade = checkResult.suggestedActions.some(
    action => action.type === 'upgrade_plan'
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          backgroundImage: 'none'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon sx={{ color: 'warning.main' }} />
        Dependencies Missing
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Alert severity="warning" icon={<InfoIcon />}>
            <AlertTitle>Feature Requires Dependencies</AlertTitle>
            {generateDependencyErrorMessage(featureId, checkResult)}
          </Alert>
        </Box>

        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, mb: 1, fontWeight: 600}}>
          Required Features:
        </Typography>

        <List dense>
          {checkResult.suggestedActions.map((action, index) => (
            <React.Fragment key={action.featureId}>
              <ListItem
                sx={{
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  mb: 1
                }}
              >
                <ListItemIcon>
                  <CancelIcon sx={{ color: 'error.main' }} />
                </ListItemIcon>
                <ListItemText
                  primary={action.featureName}
                  secondary={
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {action.description}
                      </Typography>
                      <Box>
                        <Chip
                          label={action.plan.toUpperCase()}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            bgcolor:
                              action.plan === 'basic'
                                ? 'success.main'
                                : action.plan === 'pro'
                                ? 'primary.main'
                                : 'secondary.main',
                            color: 'white'
                          }}
                        />
                        {action.type === 'upgrade_plan' && (
                          <Chip
                            label="UPGRADE REQUIRED"
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              bgcolor: 'warning.main',
                              color: 'white',
                              ml: 0.5
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
            </React.Fragment>
          ))}
        </List>

        {checkResult.warnings.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {checkResult.warnings.join(' • ')}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        
        {needsUpgrade ? (
          <Button
            onClick={handleUpgrade}
            variant="contained"
            color="warning"
            startIcon={<WarningIcon />}
          >
            Upgrade Plan
          </Button>
        ) : (
          <Button
            onClick={handleEnableAll}
            variant="contained"
            color="primary"
            startIcon={<CheckCircleIcon />}
          >
            Enable Dependencies
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

/**
 * Compact inline warning for feature cards
 */
export function InlineDependencyWarning({
  checkResult,
  featureName
}: {
  checkResult: DependencyCheckResult;
  featureName: string;
}) {
  if (checkResult.isValid) return null;

  const needsUpgrade = checkResult.suggestedActions.some(
    action => action.type === 'upgrade_plan'
  );

  return (
    <Alert
      severity="warning"
      variant="outlined"
      sx={{ mt: 1, fontSize: '0.75rem' }}
      icon={<WarningIcon fontSize="small" />}
    >
      <AlertTitle sx={{ fontSize: '0.8rem', mb: 0 }}>
        {needsUpgrade ? 'Upgrade Required' : 'Dependencies Missing'}
      </AlertTitle>
      <Typography variant="caption">
        {checkResult.missingDependencies.length === 1
          ? `Requires: ${checkResult.missingDependencies[0]}`
          : `Requires: ${checkResult.missingDependencies.join('')}`}
      </Typography>
    </Alert>
  );
}


