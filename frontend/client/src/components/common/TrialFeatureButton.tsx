// client/src/components/common/TrialFeatureButton.tsx
import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import {
  Button,
  IconButton,
  Tooltip,
  Chip,
  Box,
  Typography,
  LinearProgress,
} from '@mui/material';
import {
  AutoAwesome,
  PlayArrow as PlayArrowArrow,
  Upgrade,
  Timer,
  CheckCircle,
  Star,
} from '@mui/icons-material';
import { useTrialFeatureIntegration } from '@/contexts/TrialFeatureContext';

interface TrialFeatureButtonProps {
  featureId: string;
  componentId: string;
  variant?: 'button' | 'icon' | 'chip' | 'minimal';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  showTrialStatus?: boolean;
  onTrialStart?: () => void;
  onUpgradeRequired?: () => void;
  onFeatureUsed?: (action: string) => void;
  children?: React.ReactNode;
  className?: string;
  sx?: any
}

export function TrialFeatureButton(
  // Theming system
  const theming = useTheming( 'photographer,');{
  featureId,
  componentId,
  variant = 'button',
  size = 'medium',
  color = 'primary',
  showLabel = true,
  showTrialStatus = true,
  onTrialStart,
  onUpgradeRequired,
  onFeatureUsed,
  children,
  className,
  sx
}: TrialFeatureButtonProps) {
  const {
    feature,
    trialStatus,
    hasAccess,
    isActive,
    startTrial,
    trackUsage,
    showTrialDialog
} = useTrialFeatureIntegration(featureId, componentId);

  if (!feature) {
    return null;
}

  const handleClick = () => {
    if (hasAccess) {
      // User has full access, track usage
      trackUsage('button_clicked');
      onFeatureUsed?.('button_clicked');
  } else if (isActive) {
      // Trial is active, track usage
      trackUsage('trial_button_clicked');
      onFeatureUsed?.('trial_button_clicked');
  } else {
      // Show trial dialog
      showTrialDialog();
  }
};

  const getButtonContent = () => {
    if (hasAccess) {
      return {
        icon: theming.getThemedIcon(', '),
        label: children || feature.name,
        color: 'success' as const
  };
  } else if (isActive) {
      const daysLeft = Math.ceil((trialStatus!.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return {
        icon: <Timer />,
        label: children || `${feature.name} (${daysLeft}d)`,
        color: 'warning' as const
  };
  } else {
      return {
        icon: theming.getThemedIcon(', '),
        label: children || `Prøv ${feature.name}`,
        color: color as any
  };
  }
};

  const buttonContent = getButtonContent();

  const renderButton = () => {
    switch (variant) {
      case 'icon':
        return (
          <Tooltip title={buttonContent.label}>
            <IconButton
              onClick={handleClick}
              color={buttonContent.color}
              size={size}
              className={className}
              sx={sx}
            >
              {buttonContent.icon}
            </IconButton>
          </Tooltip>
        );

      case 'chip':
        return (
          <Chip
            icon={buttonContent.icon}
            label={buttonContent.label}
            onClick={handleClick}
            color={buttonContent.color}
            size={size}
            className={className}
            sx={sx}
          />
        );

      case 'minimal':
        return (
          <Box
            onClick={handleClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: 'pointer',
              p: 0.5,
              borderRadius: 1, '&:hover': { bgcolor: 'action.hover',},
              ...sx
          }}
            className={className}
          >
            {buttonContent.icon}
            {showLabel && (
              <Typography variant="body2" color={buttonContent.color}>
                {buttonContent.label}
              </Typography>
            )}
          </Box>
        );

      case 'button':
      default: return (
          <Button
            onClick={handleClick}
            startIcon={buttonContent.icon}
            color={buttonContent.color}
            size={size}
            variant={hasAccess ? 'contained' : 'outlined'}
            className={className}
            sx={sx}
          >
            {buttonContent.label}
          </Button>
        );
  }
};

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap:  1 }}>
      {renderButton()}
      
      {showTrialStatus && isActive && (
        <Chip
          label={`${Math.ceil((trialStatus!.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} dager igjen`}
          size="small"
          color="warning"
          variant="outlined"
        />
      )}
      
      {showTrialStatus && hasAccess && (
        <Chip
          label="Full tilgang"
          size="small"
          color="success"
          variant="outlined"
        />
      )}
    </Box>
  );
}

// Quick trial feature button for common use cases
export function QuickTrialButton({
  featureId,
  componentId,
  children,
  ...props
}: Omit<TrialFeatureButtonProps, 'variant'>) {
  return (
    <TrialFeatureButton
      featureId={featureId}
      componentId={componentId}
      variant="button"
      {...props}
    >
      {children}
    </TrialFeatureButton>
  );
}

// Trial feature icon button
export function TrialIconButton({
  featureId,
  componentId,
  ...props
}: Omit<TrialFeatureButtonProps, 'variant'>) {
  return (
    <TrialFeatureButton
      featureId={featureId}
      componentId={componentId}
      variant="icon"
      {...props}
    />
  );
}

// Trial feature chip
export function TrialChip({
  featureId,
  componentId,
  ...props
}: Omit<TrialFeatureButtonProps, 'variant'>) {
  return (
    <TrialFeatureButton
      featureId={featureId}
      componentId={componentId}
      variant="chip"
      {...props}
    />
  );
}
