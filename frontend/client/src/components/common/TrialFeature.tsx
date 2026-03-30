// client/src/components/common/TrialFeature.tsx
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  ExpandLess,
  ExpandMore,
  Timer,
  Upgrade,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useTrialFeature } from '@/hooks/useTrialFeature';
import { TrialActivationDialog } from './TrialActivationDialog';

interface TrialFeatureProps {
  featureId: string;
  componentId: string;
  userId?: string;
  children: React.ReactNode;
  fallbackComponent?: React.ReactNode;
  variant?: 'card' | 'banner' | 'inline' | 'minimal';
  position?: 'top' | 'bottom' | 'sidebar' | 'floating';
  showPreview?: boolean;
  onTrialStart?: () => void;
  onUpgradeRequired?: () => void;
  onFeatureUsed?: (action: string) => void;
  className?: string;
}

function getPromptOffset(position: TrialFeatureProps['position']) {
  switch (position) {
    case 'top':
      return { mb: 2 };
    case 'sidebar':
      return { mt: 0, mb: 2 };
    case 'floating':
      return { mt: 2, ml: 'auto', maxWidth: 520 };
    case 'bottom':
    default:
      return { mt: 2 };
  }
}

export function TrialFeature({
  featureId,
  componentId,
  userId,
  children,
  fallbackComponent,
  variant = 'card',
  position = 'bottom',
  showPreview = true,
  onTrialStart,
  onUpgradeRequired,
  onFeatureUsed,
  className,
}: TrialFeatureProps) {
  const theming = useTheming('photographer');
  const [expanded, setExpanded] = useState(false);

  const {
    trialStatus,
    feature,
    loading,
    startTrial,
    trackUsage,
    hasAccess,
    isTrialActive,
    isTrialExpired,
    showTrialPrompt,
    showTrialDialog,
    setShowTrialDialog,
  } = useTrialFeature({
    featureId,
    componentId,
    userId,
    onTrialStart,
    onUpgradeRequired,
    onFeatureUsed,
  });

  const daysRemaining = useMemo(() => {
    if (!trialStatus?.endDate) {
      return 0;
    }

    return Math.max(
      0,
      Math.ceil((trialStatus.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    );
  }, [trialStatus]);

  const previewNode = useMemo(() => {
    if (!feature?.previewComponent) {
      return null;
    }

    const PreviewComponent = feature.previewComponent;
    return <PreviewComponent />;
  }, [feature]);

  const wrappedChildren = (
    <Box
      onClickCapture={() => {
        if (isTrialActive || hasAccess) {
          trackUsage('feature_interaction');
        }
      }}
    >
      {children}
    </Box>
  );

  if (hasAccess) {
    return <>{wrappedChildren}</>;
  }

  if (isTrialActive) {
    return (
      <Box className={className}>
        {wrappedChildren}
        {variant !== 'minimal' && (
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              icon={<Timer />}
              label={`Trial aktiv${daysRemaining > 0 ? ` - ${daysRemaining} dager igjen` : ''}`}
              color="warning"
              size="small"
              variant="outlined"
            />
            <Button
              size="small"
              startIcon={<Upgrade />}
              onClick={onUpgradeRequired}
              variant="outlined"
            >
              Oppgrader
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  if (isTrialExpired) {
    return (
      <Box className={className}>
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" startIcon={<Upgrade />} onClick={onUpgradeRequired}>
              Oppgrader
            </Button>
          }
        >
          Din prøveperiode for {feature?.name ?? featureId} har utløpt.
        </Alert>
        {fallbackComponent ?? children}
      </Box>
    );
  }

  const openTrialDialog = () => setShowTrialDialog(true);

  const renderTrialPrompt = () => {
    if (!feature || !showTrialPrompt) {
      return null;
    }

    const promptSpacing = getPromptOffset(position);

    switch (variant) {
      case 'banner':
        return (
          <Alert
            severity="info"
            sx={promptSpacing}
            action={
              <Button size="small" startIcon={<AutoAwesome />} onClick={openTrialDialog} variant="outlined">
                Prøv gratis
              </Button>
            }
          >
            <Typography variant="body2">
              <strong>Forbedret løsning tilgjengelig:</strong> {feature.description}
            </Typography>
          </Alert>
        );

      case 'inline':
        return (
          <Box
            sx={{
              ...promptSpacing,
              p: 2,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'primary.20',
              bgcolor: 'primary.5',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AutoAwesome color="primary" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight="medium">
                  {feature.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {feature.description}
                </Typography>
              </Box>
              <Button size="small" startIcon={<AutoAwesome />} onClick={openTrialDialog} variant="outlined">
                Prøv gratis
              </Button>
            </Box>
          </Box>
        );

      case 'minimal':
        return (
          <Tooltip title={`Prøv ${feature.name} gratis`}>
            <IconButton size="small" onClick={openTrialDialog} sx={{ color: 'primary.main' }}>
              <AutoAwesome />
            </IconButton>
          </Tooltip>
        );

      case 'card':
      default:
        return (
          <Card
            sx={{
              ...promptSpacing,
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'primary.20',
              bgcolor: 'primary.5',
              ...theming.getThemedCardSx(),
            }}
          >
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 1,
                    bgcolor: feature.color || 'primary.main',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                  }}
                >
                  {feature.icon || '⭐'}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {feature.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {feature.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                    <Chip
                      label={`${feature.trialDuration} dager gratis`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    <Chip label={feature.category} size="small" />
                  </Box>
                  {showPreview && previewNode && (
                    <Button
                      size="small"
                      startIcon={expanded ? <ExpandLess /> : <ExpandMore />}
                      onClick={() => setExpanded((previous) => !previous)}
                      sx={{ mr: 1 }}
                    >
                      {expanded ? 'Skjul' : 'Se'} forhåndsvisning
                    </Button>
                  )}
                </Box>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AutoAwesome />}
                  onClick={openTrialDialog}
                  sx={{ minWidth: 120 }}
                >
                  Prøv gratis
                </Button>
              </Box>

              {showPreview && previewNode && (
                <Collapse in={expanded}>
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Forhåndsvisning av {feature.name}
                    </Typography>
                    {previewNode}
                  </Box>
                </Collapse>
              )}
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <Box className={className}>
      {fallbackComponent ?? children}
      {renderTrialPrompt()}
      {feature && (
        <TrialActivationDialog
          open={showTrialDialog}
          feature={feature}
          onAccept={() => {
            void startTrial();
          }}
          onDecline={() => setShowTrialDialog(false)}
          onUpgrade={onUpgradeRequired}
          trialStatus={trialStatus}
          loading={loading}
        />
      )}
    </Box>
  );
}

export function withTrialFeature<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  featureId: string,
  componentId: string,
  options?: Partial<TrialFeatureProps>,
) {
  const TrialFeatureWrapper = (props: P) => (
    <TrialFeature featureId={featureId} componentId={componentId} {...options}>
      <WrappedComponent {...props} />
    </TrialFeature>
  );

  TrialFeatureWrapper.displayName = `withTrialFeature(${WrappedComponent.displayName ?? WrappedComponent.name ?? 'Component'})`;
  return TrialFeatureWrapper;
}

export function QuickTrialFeature({
  featureId,
  componentId,
  children,
  fallbackComponent,
  ...props
}: Omit<TrialFeatureProps, 'variant'>) {
  return (
    <TrialFeature
      featureId={featureId}
      componentId={componentId}
      fallbackComponent={fallbackComponent}
      variant="inline"
      {...props}
    >
      {children}
    </TrialFeature>
  );
}
