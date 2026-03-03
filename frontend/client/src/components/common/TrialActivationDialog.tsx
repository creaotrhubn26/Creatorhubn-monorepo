import React, { useMemo, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Typography,
  useTheme,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  Close,
  PlayArrow,
  Security,
  Speed,
  Star,
  Timer,
  Upgrade,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import type { TrialFeature, TrialStatus } from '@/services/TrialFeatureManager';

interface TrialActivationDialogProps {
  open: boolean;
  feature: TrialFeature;
  onAccept: () => void;
  onDecline: () => void;
  onUpgrade?: () => void;
  trialStatus?: TrialStatus | null;
  loading?: boolean;
}

function formatDate(value: Date | string | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString('nb-NO');
}

function getCategoryColor(category: TrialFeature['category']): string {
  switch (category) {
    case 'editor':
      return '#8e24aa';
    case 'ai':
      return '#ef6c00';
    case 'analytics':
      return '#1976d2';
    case 'productivity':
      return '#2e7d32';
    case 'communication':
      return '#c62828';
    default:
      return '#546e7a';
  }
}

function getCategoryIcon(category: TrialFeature['category']): JSX.Element {
  switch (category) {
    case 'editor':
      return <Star fontSize="large" />;
    case 'ai':
      return <AutoAwesome fontSize="large" />;
    case 'analytics':
      return <Speed fontSize="large" />;
    case 'productivity':
      return <Timer fontSize="large" />;
    case 'communication':
      return <Security fontSize="large" />;
    default:
      return <Star fontSize="large" />;
  }
}

export function TrialActivationDialog({
  open,
  feature,
  onAccept,
  onDecline,
  onUpgrade,
  trialStatus,
  loading = false,
}: TrialActivationDialogProps): JSX.Element {
  const theme = useTheme();
  const [showPreview, setShowPreview] = useState(false);

  const isExpired = trialStatus?.hasExpired === true;
  const isActive = trialStatus?.isActive === true;
  const canUpgrade = trialStatus?.canUpgrade === true || feature.upgradeRequired;

  const categoryColor = getCategoryColor(feature.category);

  const titleText = useMemo(() => {
    if (isExpired) {
      return 'Trial Ended';
    }
    if (isActive) {
      return 'Trial Active';
    }
    return 'Enhanced Feature Available';
  }, [isActive, isExpired]);

  const subtitleText = useMemo(() => {
    if (isExpired) {
      return `Your ${feature.name} trial has ended. Upgrade to continue with full capability.`;
    }
    if (isActive) {
      return `You are currently in a ${feature.trialDuration}-day trial.`;
    }
    return feature.description;
  }, [feature.description, feature.name, feature.trialDuration, isActive, isExpired]);

  const PreviewComponent = feature.previewComponent;

  return (
    <Dialog
      open={open}
      fullWidth
      maxWidth="md"
      onClose={onDecline}
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          background: `linear-gradient(145deg, ${categoryColor} 0%, ${alpha(categoryColor, 0.85)} 100%)`,
          color: '#fff',
        },
      }}
    >
      <DialogTitle sx={{ position: 'relative', pt: 3, pb: 1.5 }}>
        <IconButton
          onClick={onDecline}
          sx={{ position: 'absolute', right: 12, top: 12, color: '#fff' }}
          aria-label="Close trial dialog"
        >
          <Close />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center' }}>
          {getCategoryIcon(feature.category)}
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {titleText}
          </Typography>
        </Box>

        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
          <Chip
            label={feature.category.toUpperCase()}
            sx={{
              fontWeight: 700,
              letterSpacing: 0.8,
              bgcolor: alpha(theme.palette.common.white, 0.2),
              color: '#fff',
            }}
          />
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Typography variant="h6" sx={{ textAlign: 'center', fontWeight: 700, mb: 1 }}>
          {feature.name}
        </Typography>

        <Typography variant="body1" sx={{ textAlign: 'center', opacity: 0.95, mb: 2 }}>
          {subtitleText}
        </Typography>

        <Paper
          sx={{
            p: 2,
            mb: 2,
            bgcolor: alpha(theme.palette.common.white, 0.12),
            color: '#fff',
            border: `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
          }}
        >
          <Box sx={{ display: 'grid', gap: 1 }}>
            <Typography variant="body2">
              Trial duration: <strong>{feature.trialDuration} days</strong>
            </Typography>
            <Typography variant="body2">
              Status: <strong>{isExpired ? 'Expired' : isActive ? 'Active' : 'Not started'}</strong>
            </Typography>
            <Typography variant="body2">
              Expires: <strong>{formatDate(trialStatus?.endDate)}</strong>
            </Typography>
            <Typography variant="body2">
              Usage count: <strong>{trialStatus?.usageCount ?? 0}</strong>
            </Typography>
            <Typography variant="body2">
              Last used: <strong>{formatDate(trialStatus?.lastUsed)}</strong>
            </Typography>
          </Box>
        </Paper>

        <Box sx={{ mb: 2 }}>
          {feature.benefits.map((benefit) => (
            <Box
              key={benefit}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.75,
                mb: 1,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.common.white, 0.11),
              }}
            >
              <CheckCircle fontSize="small" sx={{ color: '#81c784' }} />
              <Typography variant="body2">{benefit}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
          <Button
            variant="outlined"
            onClick={() => setShowPreview((previous) => !previous)}
            startIcon={showPreview ? <VisibilityOff /> : <Visibility />}
            sx={{
              borderColor: alpha(theme.palette.common.white, 0.7),
              color: '#fff',
              '&:hover': {
                borderColor: '#fff',
                bgcolor: alpha(theme.palette.common.white, 0.12),
              },
            }}
          >
            {showPreview ? 'Hide preview' : 'Show preview'}
          </Button>
        </Box>

        <Collapse in={showPreview}>
          <Paper
            sx={{
              p: 2,
              bgcolor: alpha(theme.palette.common.white, 0.97),
              color: theme.palette.text.primary,
              maxHeight: 280,
              overflow: 'auto',
            }}
          >
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700, color: categoryColor }}>
              Preview
            </Typography>
            <PreviewComponent />
          </Paper>
        </Collapse>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'center', gap: 1.5, px: 3, pb: 3 }}>
        {(isExpired || canUpgrade) && onUpgrade ? (
          <>
            <Button
              variant="outlined"
              onClick={onDecline}
              disabled={loading}
              sx={{ borderColor: alpha(theme.palette.common.white, 0.8), color: '#fff' }}
            >
              Not now
            </Button>
            <Button
              variant="contained"
              onClick={onUpgrade}
              disabled={loading}
              startIcon={<Upgrade />}
              sx={{
                bgcolor: '#ffd54f',
                color: '#1a1a1a',
                '&:hover': { bgcolor: '#ffca28' },
              }}
            >
              Upgrade
            </Button>
          </>
        ) : isActive ? (
          <Button
            variant="contained"
            onClick={onDecline}
            disabled={loading}
            startIcon={<CheckCircle />}
            sx={{ bgcolor: '#43a047', '&:hover': { bgcolor: '#388e3c' } }}
          >
            Continue trial
          </Button>
        ) : (
          <>
            <Button
              variant="outlined"
              onClick={onDecline}
              disabled={loading}
              sx={{ borderColor: alpha(theme.palette.common.white, 0.8), color: '#fff' }}
            >
              Not now
            </Button>
            <Button
              variant="contained"
              onClick={onAccept}
              disabled={loading}
              startIcon={<PlayArrow />}
              sx={{ bgcolor: '#43a047', '&:hover': { bgcolor: '#388e3c' } }}
            >
              Start trial
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default TrialActivationDialog;
