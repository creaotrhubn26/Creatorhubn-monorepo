// client/src/components/common/TrialFeature.tsx
import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  LinearProgress,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  AutoAwesome,
  PlayArrowArrow,
  Upgrade,
  Timer,
  CheckCircle,
  ExpandMore,
  ExpandLess,
  Info,
} from '@mui/icons-material';
import { TrialActivationDialog } from './TrialActivationDialog';
import { useTrialFeature } from '@/hooks/useTrialFeature';

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
  className?: string
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
  className
}: TrialFeatureProps) {
  const {
    trialStatus,
    eligibility,
    feature,
    loading,
    startTrial,
    trackUsage,
    hasAccess,
    isTrialActive,
    isTrialExpired,
    canUpgrade,
    isEligible,
    showTrialPrompt,
    showUpgradePrompt,
    showFeature,
    showTrialDialog,
    setShowTrialDialog
} = useTrialFeature({
    featureId,
    componentId,
    userId,
    onTrialStart,
    onUpgradeRequired,
    onFeatureUsed
});

  const [expanded, setExpanded] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');

  // Track usage when feature is used
  const handleFeatureUsage = (action: string) => {
    trackUsage(action);
};

  // If user has full access, show the feature
  if (hasAccess) {
    return <>{children}</>;
}

  // If trial is active, show feature with trial indicator
  if (isTrialActive) {
    return (
      <Box className={className}>
        {children}
        {variant !== 'minimal' && (
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
            <Chip
              icon={<Timer />}
              label={`Trial aktiv - ${Math.ceil((trialStatus!.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} dager igjen`}
              color="warning"
              size="small"
              variant="outlined"
            />
            <Button
              size="small"
              startIcon={<Upgrade />}
              onClick={() => onUpgradeRequired?.()}
              variant="outlined"
            >
              Oppgrader
            </Button>
          </Box>
        )}
      </Box>
    );
}

  // If trial expired, show upgrade prompt
  if (isTrialExpired) {
    return (
      <Box className={className}>
        <Alert 
          severity="warning" 
          action={
            <Button 
              color="inherit" 
              size="small" 
              startIcon={<Upgrade />}
              onClick={() => onUpgradeRequired?.()}
            >
              Oppgrader
            </Button>
        }
          sx={{ mb:  2 }}
        >
          <Typography variant="body2">
            Din prøveperiode for {feature?.name} har utløpt. Oppgrader for å fortsette.
          </Typography>
        </Alert>
        {fallbackComponent || children}
      </Box>
    );
}

  // Show trial dialog if needed
  if (showTrialDialog && feature) {
    return (
      <>
        {fallbackComponent || children}
        <TrialActivationDialog
          open={showTrialDialog}
          feature={feature}
          onAccept={startTrial}
          onDecline={() => setShowTrialDialog(false)}
          onUpgrade={() => onUpgradeRequired?.()}
          trialStatus={trialStatus}
          loading={loading}
        />
      </>
    );
}

  // Show fallback or children with trial prompt
  const renderTrialPrompt = () => {
    if (!feature || !showTrialPrompt) return null;

    switch (variant) {
      case 'banner':
        return (
          <Alert 
            severity="info" 
            action={
              <Button
                size="small"
                startIcon={theming.getThemedIcon('play')}
                onClick={() => setShowTrialDialog(true)}
                variant="outlined"
              >
                Prøv gratis
              </Button>
          }
            sx={{ mb:  2 }}
          >
            <Typography variant="body2">
              <strong>Forbedret løsning tilgjengelig!</strong> {feature.description}
            </Typography>
          </Alert>
        );

      case 'inline':
        return (
          <Box sx={{ 
            p: 2, bgcolor: 'primary.5', 
            borderRadius:  1,
            border: '1px solid',
            borderColor: 'primary.20',
            mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              <AutoAwesome color="primary" />
              <Box sx={{ flex:  1 }}>
                <Typography variant="body2" fontWeight="medium">
                  {feature.name} tilgjengelig
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {feature.description}
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={theming.getThemedIcon('play')}
                onClick={() => setShowTrialDialog(true)}
                variant="outlined"
              >
                Prøv gratis
              </Button>
            </Box>
          </Box>
        );

      case 'minimal':
        return (
          <Tooltip title={`Prøv ${feature.name} gratis`}>
            <IconButton
              size="small"
              onClick={() => setShowTrialDialog(true)}
              sx={{ color: 'primary.main'}}
            >
              {theming.getThemedIcon('autoAwesome')}
            </IconButton>
          </Tooltip>
        );

      case 'card':
      default: return (
          <Card sx={{ 
            mt: 2, bgcolor: 'primary.5', 
            border: '1px solid', 
            borderColor: 'primary.20',
            position: 'relative',
            overflow: 'hidden'
      ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Box
                  sx={{
                    width:  48,
                    height:  48,
                    borderRadius:  1,
                    bgcolor: feature.color || 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '1.5rem'
              }}
                >
                  {feature.icon || '⭐'}
                </Box>
                <Box sx={{ flex:  1 }}>
                  <Typography variant="h6" color="primary" sx={{  fontWeight: 'bold', mb: 0.5 }}>
                    {feature.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                    {feature.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb:  1 }}>
                    <Chip label={`${feature.trialDuration} dager gratis`} size="small" color="primary" variant="outlined" />
                    <Chip label={feature.category} size="small" />
                    {feature.upgradeRequired && (
                      <Chip label="Oppgradering påkrevd" size="small" color="warning" variant="outlined" />
                    )}
                  </Box>
                  {showPreview && (
                    <Button
                      size="small"
                      startIcon={expanded ? theming.getThemedIcon('expandLess') : theming.getThemedIcon('expandMore')}
                      onClick={() => setExpanded(!expanded)}
                      sx={{ mr:  1 }}
                    >
                      {expanded ? 'Skjul' : 'Se'} forhåndsvisning
                    </Button>
                  )}
                </Box>
                <Button variant="contained"
                  color="primary"
                  startIcon={theming.getThemedIcon('play')}
                  onClick={() => setShowTrialDialog(true)}
                  sx={{ minWidth: 120}}
                >
                  Prøv gratis
                </Button>
              </Box>
              
              {showPreview && (
                <Collapse in={expanded}>
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius:  1 }}>
                    <Typography variant="subtitle2" sx={{ mb:  1 }}>
                      Forhåndsvisning av {feature.name}
                    </Typography>
                    <feature.previewComponent />
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
      {fallbackComponent || children}
      {renderTrialPrompt()}
    </Box>
  );
}

// Higher-order component for easy integration
export function withTrialFeature<P extends object>(
  WrappedComponent: React.ComponentType<>,
  featureId: string,
  componentId: string,
  options?: Partial<TrialFeatureProps>
) {
  return function TrialFeatureWrapper(props: P) {
    return (
      <TrialFeature
        featureId={featured}
        componentId={componentId}
        {...options}
      >
        <WrappedComponent {...props} />
      </TrialFeature>
    );
};
}

// Quick trial feature component for simple cases
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
      variant="inline"
      {...props}
    >
      {children}
    </TrialFeature>
  );
}
