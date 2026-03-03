/**
 * 💡 Library Suggestion Dialog
 * Shows intelligent library recommendations when creating components
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Divider,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Stack,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  ExpandMore,
  Info,
  Warning,
  Speed as Speed,
  Storage,
  TrendingUp,
  AutoAwesome,
  Category,
  Lightbulb,
} from '@mui/icons-material';
import {
  getSuggestionsForComponent,
  ComponentSuggestions,
  LibrarySuggestion
} from '@shared/library-suggestion-engine';
import { PROFESSION_FEATURE_MATRIX } from '@shared/profession-feature-matrix';

interface LibrarySuggestionDialogProps {
  open: boolean;
  onClose: () => void;
  componentType: string;
  profession: string;
  onEnableFeatures: (featureIds: string[]) => void;
}

export default function LibrarySuggestionDialog({
  open,
  onClose,
  componentType,
  profession,
  onEnableFeatures
}: LibrarySuggestionDialogProps) {
  // Get enabled features for this profession
  const professionConfig = PROFESSION_FEATURE_MATRIX[profession];
  const enabledFeatures = useMemo(() => {
    const features = new Set<string>();
    if (professionConfig) {
      Object.entries(professionConfig.availableFeatures).forEach(([featureId, config]) => {
        if (config.enabled) {
          features.add(featureId);
        }
      });
    }
    return features;
  }, [professionConfig]);
  
  // Get suggestions
  const suggestions = useMemo(() => 
    getSuggestionsForComponent(componentType, profession, enabledFeatures),
    [componentType, profession, enabledFeatures]
  );
  
  // Track which features user wants to enable
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  
  // Calculate impact of selected features
  const selectedImpact = useMemo(() => {
    if (!suggestions) return { totalKB: 0, totalMB: 0, libraries: [] };
    
    let totalKB = 0;
    const libraries: string[] = [];
    
    suggestions.suggestedLibraries.forEach(suggestion => {
      if (selectedFeatures.has(suggestion.feature) && !suggestion.alreadyEnabled) {
        totalKB += suggestion.library.bundleSize;
        libraries.push(suggestion.library.libraryName);
      }
    });
    
    return {
      totalKB,
      totalMB: Math.round(totalKB / 1024 * 10) / 10,
      libraries
    };
  }, [suggestions, selectedFeatures]);
  
  // Handle enable all critical
  const handleEnableAllCritical = () => {
    if (!suggestions) return;
    
    const criticalFeatures = suggestions.suggestedLibraries
      .filter(s => s.priority === 'critical' && !s.alreadyEnabled)
      .map(s => s.feature);
    
    setSelectedFeatures(new Set(criticalFeatures));
  };
  
  // Handle enable all recommended
  const handleEnableAllRecommended = () => {
    if (!suggestions) return;
    
    const recommendedFeatures = suggestions.suggestedLibraries
      .filter(s => (s.priority === 'critical' || s.priority === 'recommended') && !s.alreadyEnabled)
      .map(s => s.feature);
    
    setSelectedFeatures(new Set(recommendedFeatures));
  };
  
  // Handle apply
  const handleApply = () => {
    onEnableFeatures(Array.from(selectedFeatures));
    onClose();
  };
  
  if (!suggestions) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>No Suggestions Available</DialogTitle>
        <DialogContent>
          <Alert severity="info">
            No library suggestions available for component type: {componentType}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }
  
  const criticalCount = suggestions.suggestedLibraries.filter(s => s.priority === 'critical' && !s.alreadyEnabled).length;
  const recommendedCount = suggestions.suggestedLibraries.filter(s => s.priority === 'recommended' && !s.alreadyEnabled).length;
  const optionalCount = suggestions.suggestedLibraries.filter(s => s.priority === 'optional' && !s.alreadyEnabled).length;
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AutoAwesome sx={{ color: '#ffb300' }} />
          <Box>
            <Typography variant="h6">
              Suggested Libraries for {suggestions.componentName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {suggestions.description}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {/* Bundle Impact Summary */}
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.light', color: 'white' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Total Bundle Impact
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {suggestions.estimatedBundleImpact.totalMB} MB
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {suggestions.estimatedBundleImpact.breakdown.length} libraries needed
              </Typography>
            </Box>
            <Box textAlign="right">
              <Typography variant="caption" sx={{ opacity: 0.9, display: 'block' }}>
                Selected Impact
              </Typography>
              <Typography variant="h5" fontWeight={600}>
                {selectedImpact.totalMB} MB
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {selectedImpact.libraries.length} selected
              </Typography>
            </Box>
          </Box>
          
          <LinearProgress
            variant="determinate"
            value={Math.min(100, (suggestions.estimatedBundleImpact.totalKB / 100000) * 100)}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.2)',
              '& .MuiLinearProgress-bar': {
                bgcolor: suggestions.estimatedBundleImpact.totalMB > 20 ? '#f44336' :
                         suggestions.estimatedBundleImpact.totalMB > 10 ? '#ff9800' : '#4caf50'
              }
            }}
          />
        </Paper>
        
        {/* Quick Actions */}
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={`${criticalCount} Critical`}
            color="error"
            icon={<Warning />}
            onClick={handleEnableAllCritical}
            clickable
          />
          <Chip
            label={`${recommendedCount} Recommended`}
            color="warning"
            icon={<TrendingUp />}
            onClick={handleEnableAllRecommended}
            clickable
          />
          <Chip
            label={`${optionalCount} Optional`}
            color="info"
            icon={<Info />}
          />
        </Box>
        
        {/* Libraries by Priority */}
        {/* Critical Libraries */}
        {criticalCount > 0 && (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <Warning color="error" />
                <Typography fontWeight={600}>
                  Critical Libraries ({criticalCount})
                </Typography>
                <Chip 
                  label="Required"
                  size="small"
                  sx={{ bgcolor: '#f44336', color: 'white' }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                These libraries are essential for your component to function properly.
              </Typography>
              
              <List>
                {suggestions.suggestedLibraries
                  .filter(s => s.priority === 'critical')
                  .map((suggestion) => (
                    <LibraryItem
                      key={suggestion.library.npmPackage}
                      suggestion={suggestion}
                      selected={selectedFeatures.has(suggestion.feature)}
                      onToggle={(featureId) => {
                        setSelectedFeatures(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(featureId)) {
                            newSet.delete(featureId);
                          } else {
                            newSet.add(featureId);
                          }
                          return newSet;
                        });
                      }}
                      profession={profession}
                    />
                  ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}
        
        {/* Recommended Libraries */}
        {recommendedCount > 0 && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <TrendingUp color="warning" />
                <Typography fontWeight={600}>
                  Recommended Libraries ({recommendedCount})
                </Typography>
                <Chip 
                  label="Enhanced Features"
                  size="small"
                  sx={{ bgcolor: '#ff9800', color: 'white' }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                These libraries add significant functionality and are highly recommended.
              </Typography>
              
              <List>
                {suggestions.suggestedLibraries
                  .filter(s => s.priority === 'recommended')
                  .map((suggestion) => (
                    <LibraryItem
                      key={suggestion.library.npmPackage}
                      suggestion={suggestion}
                      selected={selectedFeatures.has(suggestion.feature)}
                      onToggle={(featureId) => {
                        setSelectedFeatures(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(featureId)) {
                            newSet.delete(featureId);
                          } else {
                            newSet.add(featureId);
                          }
                          return newSet;
                        });
                      }}
                      profession={profession}
                    />
                  ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}
        
        {/* Optional Libraries */}
        {optionalCount > 0 && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <Lightbulb color="info" />
                <Typography fontWeight={600}>
                  Optional Libraries ({optionalCount})
                </Typography>
                <Chip 
                  label="Advanced"
                  size="small"
                  sx={{ bgcolor: '#2196f3', color: 'white' }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                These libraries provide advanced features you may want later.
              </Typography>
              
              <List>
                {suggestions.suggestedLibraries
                  .filter(s => s.priority === 'optional')
                  .map((suggestion) => (
                    <LibraryItem
                      key={suggestion.library.npmPackage}
                      suggestion={suggestion}
                      selected={selectedFeatures.has(suggestion.feature)}
                      onToggle={(featureId) => {
                        setSelectedFeatures(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(featureId)) {
                            newSet.delete(featureId);
                          } else {
                            newSet.add(featureId);
                          }
                          return newSet;
                        });
                      }}
                      profession={profession}
                    />
                  ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}
        
        {/* Performance Impact Warning */}
        {selectedImpact.totalMB > 10 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <AlertTitle>Large Bundle Size</AlertTitle>
            Selected libraries will add {selectedImpact.totalMB} MB to your bundle. 
            Most of these libraries are lazy-loaded, so they won't impact initial page load.
          </Alert>
        )}
        
        {/* Info Box */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <AlertTitle>💡 How This Works</AlertTitle>
          <Typography variant="body2">
            • Libraries are controlled by features in the feature matrix<br />
            • Enabling a feature automatically activates its libraries<br />
            • Most large libraries are lazy-loaded on-demand<br />
            • Changes take effect immediately
          </Typography>
        </Alert>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleEnableAllCritical}
          variant="outlined"
          color="error"
        >
          Enable Critical Only
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={selectedFeatures.size === 0}
        >
          Apply ({selectedFeatures.size} features)
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Individual library item
 */
function LibraryItem({
  suggestion,
  selected,
  onToggle,
  profession
}: {
  suggestion: LibrarySuggestion;
  selected: boolean;
  onToggle: (featureId: string) => void;
  profession: string;
}) {
  const professionConfig = PROFESSION_FEATURE_MATRIX[profession];
  const feature = professionConfig?.availableFeatures[suggestion.feature];
  
  if (suggestion.alreadyEnabled) {
    return (
      <ListItem
        sx={{
          bgcolor: 'rgba(76, 175, 80, 0.1)',
          borderRadius: 1,
          mb: 1,
          border: '1px solid',
          borderColor: 'success.main'
        }}
      >
        <ListItemIcon>
          <CheckCircle color="success" />
        </ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {suggestion.library.libraryName}
              </Typography>
              <Chip 
                label="Already Enabled"
                size="small"
                sx={{ bgcolor: '#4caf50', color: 'white', height: 18, fontSize: '0.7rem' }}
              />
              <Chip 
                label={`${suggestion.library.bundleSize >= 1000 ? `${(suggestion.library.bundleSize / 1024).toFixed(1)}MB` : `${suggestion.library.bundleSize}KB`}`}
                size="small"
                sx={{ height: 18, fontSize: '0.7rem' }}
              />
            </Box>
          }
          secondary={
            <Box>
              <Typography variant="caption" color="text.secondary">
                {suggestion.reason} • {suggestion.library.description}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                Feature: <strong>{suggestion.feature}</strong>
              </Typography>
            </Box>
          }
        />
      </ListItem>
    );
  }
  
  return (
    <ListItemButton
      onClick={() => onToggle(suggestion.feature)}
      sx={{
        bgcolor: selected ? 'rgba(33, 150, 243, 0.1)' : 'background.paper',
        borderRadius: 1,
        mb: 1,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider'
      }}
    >
      <ListItemIcon>
        <Checkbox
          checked={selected}
          onChange={() => onToggle(suggestion.feature)}
          color="primary"
        />
      </ListItemIcon>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {suggestion.library.libraryName}
            </Typography>
            <Chip 
              label={feature?.plan.toUpperCase() || 'BASIC'}
              size="small"
              sx={{ 
                height: 18, 
                fontSize: '0.7rem',
                bgcolor: feature?.plan === 'enterprise' ? '#9c27b0' :
                         feature?.plan === 'pro' ? '#2196f3' : '#4caf50',
                color: 'white'
              }}
            />
            <Chip 
              label={`${suggestion.library.bundleSize >= 1000 ? `${(suggestion.library.bundleSize / 1024).toFixed(1)}MB` : `${suggestion.library.bundleSize}KB`}`}
              size="small"
              sx={{ 
                height: 18, 
                fontSize: '0.7rem',
                bgcolor: suggestion.library.bundleSize > 1000 ? '#ff9800' : 
                         suggestion.library.bundleSize > 100 ? '#ffeb3b' : '#4caf50',
                color: suggestion.library.bundleSize > 1000 ? 'white' : 'rgba(0,0,0,0.8)'
              }}
            />
            {suggestion.library.lazy && (
              <Chip 
                label="Lazy"
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.7rem' }}
              />
            )}
          </Box>
        }
        secondary={
          <Box>
            <Typography variant="caption" color="text.secondary">
              {suggestion.reason} • {suggestion.library.description}
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
              Feature: <strong>{suggestion.feature}</strong> • 
              Performance: <strong>{suggestion.library.performanceImpact}</strong>
            </Typography>
          </Box>
        }
      />
    </ListItemButton>
  );
}

