// client/src/components/common/TrialFeatureGrid.tsx
import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  IconButton,
  Collapse,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  AutoAwesome,
  PlayArrowArrow,
  Upgrade,
  Timer,
  CheckCircle,
  ExpandMore,
  ExpandLess,
  Star,
  TrendingUp,
  People,
} from '@mui/icons-material';
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
  className?: string
}

export function TrialFeatureGrid({
  componentId,
  userId,
  showCategories = true,
  showTrialStatus = true,
  maxFeatures,
  onTrialStart,
  onUpgradeRequired,
  className
}: TrialFeatureGridProps) {
  const { getFeaturesForComponent, availableFeatures } = useTrialFeatureContext();
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());

  const features = getFeaturesForComponent(componentId);
  const categories = [...new Set(features.map(f => f.category))];
  
  const filteredFeatures = selectedCategory === 'all' 
    ? features 
    : features.filter(f => f.category === selectedCategory);

  const displayFeatures = maxFeatures 
    ? filteredFeatures.slice(0, maxFeatures)
    : filteredFeatures;

  const toggleFeatureExpansion = (featureId: string) => {
    setExpandedFeatures(prev => {
      const newSet = new Set(prev);
      if (newSet.has(featureId)) {
        newSet.delete(featureId);
  } else {
        newSet.add(featureId);
    }
      return newSet;
  });
};

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'editor': return theming.getThemedIcon(', ');
      case 'ai': return theming.getThemedIcon('star');
      case 'analytics': return theming.getThemedIcon('trendingUp');
      case 'productivity': return <Timer />;
      case 'communication': return theming.getThemedIcon('people');
      default: return theming.getThemedIcon(', ');
  }
};

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'editor': return '#9C27B0';
      case 'ai': return '#FF9800';
      case 'analytics': return '#2196F3';
      case 'productivity': return '#4CAF50';
      case 'communication': return '#F44336';
      default: return '#607D8B';
}
};

  if (features.length === 0) {
    return (
      <Alert severity="info">
        <Typography variant="body2">
          Ingen trial-funksjoner tilgjengelige for denne komponenten.
        </Typography>
      </Alert>
    );
}

  return (
    <Box className={className}>
      {showCategories && categories.length > 1 && (
        <Box sx={{ mb:  3 }}>
          <Tabs
            value={selectedCategory}
            onChange={(e, newValue) => setSelectedCategory(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              label={
                <Badge badgeContent={features.length} color="primary">
                  Alle
                </Badge>
            }
              value="all"
            />
            {categories.map(category => (
              <Tab
                key={category}
                label={category}
                icon={getCategoryIcon(category)}
                iconPosition="start"
                value={category}
              />
            ))}
          </Tabs>
        </Box>
      )}

      <Grid container spacing={3}>
        {displayFeatures.map(feature => {
          const isExpanded = expandedFeatures.has(feature.id);
          const categoryColor = getCategoryColor(feature.category);

          return (
            <Grid item xs={12} key={feature.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden', '&:hover': {
                    boxShadow:  4,
                    transform: 'translateY(-2px)',
                    transition: 'all 0.2s ease-in-out'
              }
              }}
               sx={theming.getThemedCardSx()}>
                {/* Category indicator */}
                <Box
                  sx={{
                    position: 'absolute',
                    top:  0,
                    left:  0,
                    right:  0,
                    height:  4,
                    bgcolor: categoryColor
              }}
                />

                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column',  ...theming.getThemedCardSx() }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                    <Box
                      sx={{
                        width:  40,
                        height:  40,
                        borderRadius:  1,
                        bgcolor: categoryColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        mr:  2,
                        fontSize: '1.2rem'
                  }}
                    >
                      {feature.icon || '⭐'}
                    </Box>
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="h6" sx={{  fontWeight: 'bold', mb: 0.5 }}>
                        {feature.name}
                      </Typography>
                      <Chip
                        label={feature.category}
                        size="small"
                        sx={{
                          bgcolor: `${categoryColor}20`,
                          color: categoryColor,
                          fontWeight: 'bold'
                    }}
                      />
                    </Box>
                  </Box>

                  {/* Description */}
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flex:  1 }}>
                    {feature.description}
                  </Typography>

                  {/* Benefits */}
                  <Box sx={{ mb:  2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block'}}>
                      Inkluderte funksjoner: </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
                      {feature.benefits.slice(0, 3).map((benefit, index) => (
                        <Chip
                          key={index}
                          label={benefit}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem'}}
                        />
                      ))}
                      {feature.benefits.length > 3 && (
                        <Chip
                          label={`+${feature.benefits.length - 3} flere`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem'}}
                        />
                      )}
                    </Box>
                  </Box>

                  {/* Trial info */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Chip
                      label={`${feature.trialDuration} dager gratis`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    {feature.upgradeRequired && (
                      <Chip
                        label="Oppgradering påkrevd"
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center'}}>
                    <TrialFeatureButton
                      featureId={feature.id}
                      componentId={componentId}
                      variant="button"
                      size="small"
                      onTrialStart={() => onTrialStart?.(feature.id)}
                      onUpgradeRequired={() => onUpgradeRequired?.(feature.id)}
                      sx={{ flex:  1 }}
                    />
                    
                    <IconButton
                      size="small"
                      onClick={() => toggleFeatureExpansion(feature.id)}
                    >
                      {isExpanded ? theming.getThemedIcon('expandLess') : theming.getThemedIcon('expandMore')}
                    </IconButton>
                  </Box>

                  {/* Expanded content */}
                  <Collapse in={isExpanded}>
                    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider'}}>
                      <Typography variant="subtitle2" sx={{ mb:  1 }}>
                        Alle funksjoner: </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5}}>
                        {feature.benefits.map((benefit, index) => (
                          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                            <CheckCircle sx={{ fontSize:  16, color: 'success.main'}} />
                            <Typography variant="body2">{benefit}</Typography>
                          </Box>
                        ))}
                      </Box>
                      
                      <Box sx={{ mt:  2 }}>
                        <feature.previewComponent />
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
        <Box sx={{ mt:  3, textAlign: 'center'}}>
          <Button
            variant="outlined"
            onClick={() => {
              // This would show more features or navigate to a full page
              console.log('Show more features');
          }}
          >
            Vis flere funksjoner ({filteredFeatures.length - maxFeatures})
          </Button>
        </Box>
      )}
    </Box>
  );
}

// Quick trial feature grid for simple use cases
export function QuickTrialGrid({
  componentId,
  maxFeatures = 3,
  ...props
}: Omit<TrialFeatureGridProps, 'showCategories'>) {
  return (
    <TrialFeatureGrid
      componentId={componentId}
      showCategories={false}
      maxFeatures={maxFeatures}
      {...props}
    />
  );
}
