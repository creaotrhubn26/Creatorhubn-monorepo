/**
 * Example: How to use Trial Feature with automatic upgrade prompt
 */

import React from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import { useTrialFeature } from '../../hooks/useTrialFeature';
import { TrialUpgradePrompt } from './TrialUpgradePrompt';

interface TrialFeatureExampleProps {
  userId: string;
}

export function TrialFeatureExample({ userId }: TrialFeatureExampleProps) {
  const trial = useTrialFeature({
    featureId: 'advanced-analytics',
    componentId: 'analytics-dashboard',
    userId,
    autoCheck: true,
    showPrompt: true,
    onTrialStart: () => {
      console.log('Trial started!');
    },
    onUpgradeRequired: () => {
      console.log('User upgraded to paid plan!');
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Advanced Analytics Dashboard
      </Typography>

      {/* Show trial status */}
      {trial.isTrialActive && trial.trialStatus && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Trial Active - {Math.ceil(
            (trial.trialStatus.endDate.getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          )}{', '}
          days remaining
        </Alert>
      )}

      {/* Show expired warning */}
      {trial.isTrialExpired && (
        <Alert severity="warning" sx={{ mb: 3 }} action={
          <Button
            color="inherit"
            size="small"
            onClick={() => trial.setShowUpgradeDialog(true)}
          >
            Upgrade
          </Button>
        }>
          Your trial has expired. Upgrade to continue using this feature.
        </Alert>
      )}

      {/* Show feature content if user has access */}
      {(trial.hasAccess || trial.isTrialActive) && (
        <Box>
          <Typography>
            Advanced analytics content here...
          </Typography>
          <Button
            onClick={() => trial.trackUsage('view_analytics')}
            sx={{ mt: 2 }}
          >
            Generate Report
          </Button>
        </Box>
      )}

      {/* Start trial button */}
      {trial.isEligible && !trial.isTrialActive && (
        <Button
          variant="contained"
          onClick={() => trial.startTrial()}
          disabled={trial.loading}
        >
          {trial.loading ? 'Starting Trial...' : 'Start 7-Day Free Trial'}
        </Button>
      )}

      {/* Auto upgrade prompt on trial expiration */}
      {trial.feature && trial.trialStatus && (
        <TrialUpgradePrompt
          open={trial.showUpgradeDialog}
          onClose={() => trial.setShowUpgradeDialog(false)}
          featureId={trial.feature.id}
          featureName={trial.feature.name}
          userId={userId}
          trialStatus={trial.trialStatus}
          onUpgradeSuccess={trial.handleUpgradeSuccess}
        />
      )}
    </Box>
  );
}

