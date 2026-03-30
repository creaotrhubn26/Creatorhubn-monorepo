import React from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  type ButtonProps,
  type ChipProps,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { AutoAwesome, CheckCircle, PlayArrow, Timer, Upgrade } from '@mui/icons-material';
import { useTrialFeatureIntegration } from '@/contexts/TrialFeatureContext';

type TrialButtonVariant = 'button' | 'icon' | 'chip' | 'minimal';

type ButtonColor = NonNullable<ButtonProps['color']>;
type ChipColor = NonNullable<ChipProps['color']>;

interface TrialFeatureButtonProps {
  featureId: string;
  componentId: string;
  variant?: TrialButtonVariant;
  size?: 'small' | 'medium' | 'large';
  color?: ButtonColor;
  showLabel?: boolean;
  showTrialStatus?: boolean;
  onTrialStart?: () => void;
  onUpgradeRequired?: () => void;
  onFeatureUsed?: (action: string) => void;
  children?: React.ReactNode;
  className?: string;
  sx?: SxProps<Theme>;
}

interface RenderMeta {
  icon: React.ReactElement;
  label: React.ReactNode;
  buttonColor: ButtonColor;
  chipColor: ChipColor;
}

const toChipColor = (buttonColor: ButtonColor): ChipColor => {
  switch (buttonColor) {
    case 'primary':
    case 'secondary':
    case 'error':
    case 'info':
    case 'success':
    case 'warning':
      return buttonColor;
    case 'inherit':
    default:
      return 'default';
  }
};

const getDaysRemaining = (dateValue: Date): number => {
  const remainingMs = dateValue.getTime() - Date.now();
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  return Math.max(0, remainingDays);
};

export function TrialFeatureButton({
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
  sx,
}: TrialFeatureButtonProps) {
  const { feature, trialStatus, hasAccess, isActive, startTrial, trackUsage, openTrialDialog } =
    useTrialFeatureIntegration(featureId, componentId);

  if (!feature) {
    return null;
  }

  const daysLeft = trialStatus?.endDate ? getDaysRemaining(new Date(trialStatus.endDate)) : 0;
  const chipSize: ChipProps['size'] = size === 'large' ? 'medium' : size;

  const renderMeta: RenderMeta = (() => {
    if (hasAccess) {
      return {
        icon: <CheckCircle fontSize="small" />,
        label: children ?? feature.name,
        buttonColor: 'success',
        chipColor: 'success',
      };
    }

    if (isActive) {
      return {
        icon: <Timer fontSize="small" />,
        label: children ?? `${feature.name} (${daysLeft}d)`,
        buttonColor: 'warning',
        chipColor: 'warning',
      };
    }

    return {
      icon: <AutoAwesome fontSize="small" />,
      label: children ?? `Prøv ${feature.name}`,
      buttonColor: color,
      chipColor: toChipColor(color),
    };
  })();

  const handleClick = async () => {
    if (hasAccess) {
      trackUsage('feature_clicked');
      onFeatureUsed?.('feature_clicked');
      return;
    }

    if (isActive) {
      trackUsage('trial_feature_clicked');
      onFeatureUsed?.('trial_feature_clicked');
      return;
    }

    if (onTrialStart) {
      onTrialStart();
    }

    try {
      await startTrial();
      onFeatureUsed?.('trial_started');
      return;
    } catch {
      // Fallback to dialog flow when direct start is unavailable.
      openTrialDialog();
      onUpgradeRequired?.();
    }
  };

  const renderControl = () => {
    switch (variant) {
      case 'icon':
        return (
          <Tooltip title={String(renderMeta.label)}>
            <IconButton
              onClick={() => {
                void handleClick();
              }}
              color={renderMeta.buttonColor}
              size={size}
              className={className}
              sx={sx}
            >
              {renderMeta.icon}
            </IconButton>
          </Tooltip>
        );
      case 'chip':
        return (
          <Chip
            icon={renderMeta.icon}
            label={renderMeta.label}
            onClick={() => {
              void handleClick();
            }}
            color={renderMeta.chipColor}
            size={chipSize}
            className={className}
            sx={sx}
          />
        );
      case 'minimal':
        return (
          <Box
            className={className}
            role="button"
            tabIndex={0}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              cursor: 'pointer',
              p: 0.75,
              borderRadius: 1,
              '&:hover': { bgcolor: 'action.hover' },
              ...sx,
            }}
            onClick={() => {
              void handleClick();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                void handleClick();
              }
            }}
          >
            {renderMeta.icon}
            {showLabel && (
              <Typography
                variant="body2"
                sx={{ color: renderMeta.buttonColor === 'inherit' ? 'text.primary' : `${renderMeta.buttonColor}.main` }}
              >
                {renderMeta.label}
              </Typography>
            )}
          </Box>
        );
      case 'button':
      default:
        return (
          <Button
            onClick={() => {
              void handleClick();
            }}
            startIcon={hasAccess ? <CheckCircle /> : isActive ? <Timer /> : <PlayArrow />}
            endIcon={!hasAccess && !isActive ? <Upgrade /> : undefined}
            color={renderMeta.buttonColor}
            size={size}
            variant={hasAccess ? 'contained' : 'outlined'}
            className={className}
            sx={sx}
          >
            {showLabel ? renderMeta.label : null}
          </Button>
        );
    }
  };

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      {renderControl()}

      {showTrialStatus && isActive && (
        <Chip size="small" color="warning" variant="outlined" label={`${daysLeft} dager igjen`} />
      )}

      {showTrialStatus && hasAccess && (
        <Chip size="small" color="success" variant="outlined" label="Full tilgang" />
      )}
    </Box>
  );
}

export function QuickTrialButton({
  featureId,
  componentId,
  children,
  ...props
}: Omit<TrialFeatureButtonProps, 'variant'>) {
  return (
    <TrialFeatureButton featureId={featureId} componentId={componentId} variant="button" {...props}>
      {children}
    </TrialFeatureButton>
  );
}

export function TrialIconButton({
  featureId,
  componentId,
  ...props
}: Omit<TrialFeatureButtonProps, 'variant'>) {
  return <TrialFeatureButton featureId={featureId} componentId={componentId} variant="icon" {...props} />;
}

export function TrialChip({
  featureId,
  componentId,
  ...props
}: Omit<TrialFeatureButtonProps, 'variant'>) {
  return <TrialFeatureButton featureId={featureId} componentId={componentId} variant="chip" {...props} />;
}
