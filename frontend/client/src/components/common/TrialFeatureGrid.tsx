// client/src/components/common/TrialFeatureGrid.tsx
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Grid,
  IconButton,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  ExpandLess,
  ExpandMore,
  People,
  Star,
  Timer,
  TrendingUp,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useTrialFeatureContext } from '@/contexts/TrialFeatureContext';
import { TrialFeatureButton } from './TrialFeatureButton';

interface TrialFeatureGridProps {
  componentId: string;
  userId?: string;
  showCategories?: boolean;
  showTrialStatus?: boolean;
  maxFeatures?: number;
  onTrialStart?: (featureId: string) => void;
  onUpgradeRequired?: (featureId: string) => void;
  className?: string;
}

export function TrialFeatureGrid({
  componentId,
  userId,
  showCategories = true,
  showTrialStatus = true,
  maxFeatures,
  onTrialStart,
  onUpgradeRequired,
  className,
}: TrialFeatureGridProps) {
  const theming = useTheming('photographer');
  const { getFeaturesForComponent, isTrialActive } = useTrialFeatureContext();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());

  const features = getFeaturesForComponent(componentId);
  const categories = useMemo(() => [...new Set(features.map((feature) => feature.category))], [features]);

  const filteredFeatures = useMemo(
    () =>
      selectedCategory === 'all'
        ? features
        : features.filter((feature) => feature.category === selectedCategory),
    [features, selectedCategory],
  );

  const displayFeatures = maxFeatures ? filteredFeatures.slice(0, maxFeatures) : filteredFeatures;

  const toggleFeatureExpansion = (featureId: string) => {
    setExpandedFeatures((previous) => {
      const next = new Set(previous);
      if (next.has(featureId)) {
        next.delete(featureId);
      } else {
        next.add(featureId);
      }
      return next;
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'editor':
        return <AutoAwesome />;
      case 'ai':
        return <Star />;
      case 'analytics':
        return <TrendingUp />;
      case 'productivity':
        return <Timer />;
      case 'communication':
        return <People />;
      default:
        return <AutoAwesome />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'editor':
        return '#9C27B0';
      case 'ai':
        return '#FF9800';
      case 'analytics':
        return '#2196F3';
      case 'productivity':
        return '#4CAF50';
      case 'communication':
        return '#F44336';
      default:
        return '#607D8B';
    }
  };

  if (features.length === 0) {
    return (
      <Alert severity="info">
        <Typography variant="body2">Ingen trial-funksjoner tilgjengelige for denne komponenten.</Typography>
      </Alert>
    );
  }

  return (
    <Box className={className}>
      {showCategories && categories.length > 1 && (
        <Box sx={{ mb: 3 }}>
          <Tabs
            value={selectedCategory}
            onChange={(_event, newValue) => setSelectedCategory(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              value="all"
              label={
                <Badge badgeContent={features.length} color="primary">
                  Alle
                </Badge>
              }
            />
            {categories.map((category) => (
              <Tab
                key={category}
                value={category}
                label={category}
                icon={getCategoryIcon(category)}
                iconPosition="start"
              />
            ))}
          </Tabs>
        </Box>
      )}

      <Grid container spacing={3}>
        {displayFeatures.map((feature) => {
          const isExpanded = expandedFeatures.has(feature.id);
          const categoryColor = getCategoryColor(feature.category);
          const PreviewComponent = feature.previewComponent;
          const activeTrial = showTrialStatus && isTrialActive(feature.id);

          return (
            <Grid item xs={12} key={feature.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  ...theming.getThemedCardSx(),
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                    transition: 'all 0.2s ease-in-out',
                  },
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    bgcolor: categoryColor,
                  }}
                />

                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', ...theming.getThemedCardSx() }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        bgcolor: categoryColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        mr: 2,
                        fontSize: '1.2rem',
                      }}
                    >
                      {feature.icon || '⭐'}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        {feature.name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={feature.category}
                          size="small"
                          sx={{ bgcolor: `${categoryColor}20`, color: categoryColor, fontWeight: 'bold' }}
                        />
                        {activeTrial && <Chip label="Trial aktiv" size="small" color="warning" variant="outlined" />}
                        {userId && <Chip label={`Bruker: ${userId}`} size="small" variant="outlined" />}
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flex: 1 }}>
                    {feature.description}
                  </Typography>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Inkluderte funksjoner:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {feature.benefits.slice(0, 3).map((benefit) => (
                        <Chip key={benefit} label={benefit} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      ))}
                      {feature.benefits.length > 3 && (
                        <Chip
                          label={`+${feature.benefits.length - 3} flere`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip
                      label={`${feature.trialDuration} dager gratis`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    {feature.upgradeRequired && (
                      <Chip label="Oppgradering påkrevd" size="small" color="warning" variant="outlined" />
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TrialFeatureButton
                      featureId={feature.id}
                      componentId={componentId}
                      variant="button"
                      size="small"
                      showTrialStatus={showTrialStatus}
                      onTrialStart={() => onTrialStart?.(feature.id)}
                      onUpgradeRequired={() => onUpgradeRequired?.(feature.id)}
                      sx={{ flex: 1 }}
                    />

                    <IconButton size="small" onClick={() => toggleFeatureExpansion(feature.id)}>
                      {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </Box>

                  <Collapse in={isExpanded}>
                    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Alle funksjoner:
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {feature.benefits.map((benefit) => (
                          <Box key={benefit} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                            <Typography variant="body2">{benefit}</Typography>
                          </Box>
                        ))}
                      </Box>

                      <Box sx={{ mt: 2 }}>
                        <PreviewComponent />
                      </Box>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {maxFeatures && filteredFeatures.length > maxFeatures && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button variant="outlined" onClick={() => setSelectedCategory('all')}>
            Vis flere funksjoner ({filteredFeatures.length - maxFeatures})
          </Button>
        </Box>
      )}
    </Box>
  );
}

export function QuickTrialGrid({
  componentId,
  maxFeatures = 3,
  ...props
}: Omit<TrialFeatureGridProps, 'showCategories'>) {
  return <TrialFeatureGrid componentId={componentId} showCategories={false} maxFeatures={maxFeatures} {...props} />;
}
