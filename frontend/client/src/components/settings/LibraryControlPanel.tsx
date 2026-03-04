/**
 * 📚 Library Control Panel
 * Granular control over ALL 60+ libraries with bundle size tracking
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  LinearProgress,
  Divider,
  Stack,
  Tooltip,
  IconButton,
  Badge,
  Card,
  CardContent,
} from '@mui/material';
import {
  ExpandMore,
  Memory,
  VideoLibrary,
  AudioFile,
  Palette,
  Code,
  Info,
  Warning,
  CheckCircle,
  Cancel,
  Speed as Speed,
  Storage,
  CloudDownload,
} from '@mui/icons-material';
import type {
  LibraryMapping} from '@shared/library-feature-mapping';
import {
  LIBRARY_MAPPINGS,
  getLibrariesForFeature,
  calculateBundleSize,
  getLibrariesByCategory,
  validateLibraryDependencies
} from '@shared/library-feature-mapping';
import { PROFESSION_FEATURE_MATRIX } from '@shared/profession-feature-matrix';

interface LibraryControlPanelProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  userId: string;
  onLibraryToggle?: (libraryName: string, enabled: boolean) => void;
}

export default function LibraryControlPanel({
  profession,
  userId,
  onLibraryToggle
}: LibraryControlPanelProps) {
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
  
  // Calculate bundle size
  const bundleStats = useMemo(() => 
    calculateBundleSize(profession, enabledFeatures),
    [profession, enabledFeatures]
  );
  
  // Group libraries by category
  const categorizedLibraries = useMemo(() => {
    const categories = {
      streaming: getLibrariesByCategory('streaming, '),
      video: getLibrariesByCategory('video,'),
      audio: getLibrariesByCategory('audio,'),
      graphics: getLibrariesByCategory('graphics'),
      color: getLibrariesByCategory('color'),
      ui: getLibrariesByCategory('ui'),
      utility: getLibrariesByCategory('utility'),
      ai: getLibrariesByCategory('ai')
    };
    
    return categories;
  }, []);
  
  // Track which libraries are enabled
  const [libraryOverrides, setLibraryOverrides] = useState<Map<string, boolean>>(new Map());
  
  // Check if library is enabled
  const isLibraryEnabled = (lib: LibraryMapping): boolean => {
    // Check override first
    if (libraryOverrides.has(lib.npmPackage)) {
      return libraryOverrides.get(lib.npmPackage)!;
    }
    
    // Core libraries always enabled
    if (lib.isCore) return true;
    
    // Check if any controlling feature is enabled
    return lib.controlledBy.some(feature => enabledFeatures.has(feature));
  };
  
  // Toggle library
  const handleLibraryToggle = (lib: LibraryMapping, enabled: boolean) => {
    if (lib.isCore) return; // Can't disable core libraries
    
    setLibraryOverrides(prev => new Map(prev).set(lib.npmPackage, enabled));
    onLibraryToggle?.(lib.npmPackage, enabled);
  };
  
  // Get category icon
  const getCategoryIcon = (category: LibraryMapping['category']) => {
    switch (category) {
      case 'streaming': return <CloudDownload />;
      case 'video': return <VideoLibrary />;
      case 'audio': return <AudioFile />;
      case 'graphics': return <Palette />;
      case 'color': return <Palette />;
      case 'ui': return <Code />;
      case 'utility': return <Memory />;
      case 'ai': return <Memory />;
      default: return <Code />;
    }
  };
  
  // Get plan color
  const getPlanColor = (plan: 'basic' | 'pro' | 'enterprise') => {
    switch (plan) {
      case 'basic': return '#4caf50';
      case 'pro': return '#2196f3';
      case 'enterprise': return '#9c27b0';
    }
  };
  
  // Render library row
  const LibraryRow = ({ lib }: { lib: LibraryMapping }) => {
    const enabled = isLibraryEnabled(lib);
    const dependencies = validateLibraryDependencies(
      lib.npmPackage,
      new Set(
        LIBRARY_MAPPINGS
          .filter(l => isLibraryEnabled(l))
          .map(l => l.npmPackage)
      )
    );
    
    const controllingFeatures = lib.controlledBy
      .filter(f => enabledFeatures.has(f))
      .map(f => professionConfig?.availableFeatures[f]);
    
    return (
      <Box
        sx={{
          p: 2,
          mb: 1,
          borderRadius: 2,
          border: '1px solid',
          borderColor: enabled ? 'success.main' : 'divider',
          bgcolor: enabled ? 'rgba(76, 175, 80, 0.05)' : 'background.paper',
          transition: 'all 0.3s ease'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Enable/Disable Switch */}
          <Switch
            checked={enabled}
            onChange={(e) => handleLibraryToggle(lib, e.target.checked)}
            disabled={lib.isCore}
            color="success"
          />
          
          {/* Library Info */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {lib.libraryName}
              </Typography>
              <Chip 
                label={lib.npmPackage}
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.7rem' }}
              />
              <Chip 
                label={`${lib.bundleSize >= 1000 ? `${(lib.bundleSize / 1024).toFixed(1)}MB` : `${lib.bundleSize}KB`}`}
                size="small"
                sx={{ 
                  height: 18, 
                  fontSize: '0.7rem',
                  bgcolor: lib.bundleSize > 1000 ? '#ff9800' : lib.bundleSize > 100 ? '#ffeb3b' : '#4caf50',
                  color: lib.bundleSize > 1000 ? 'white' : 'rgba(0,0,0,0.8)'
                }}
              />
              {lib.isCore && (
                <Chip 
                  label="CORE"
                  size="small"
                  sx={{ 
                    height: 18, 
                    fontSize: '0.7rem',
                    bgcolor: '#9e9e9e',
                    color: 'white'
                  }}
                />
              )}
              {lib.lazy && (
                <Chip 
                  label="Lazy"
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.7rem' }}
                />
              )}
            </Box>
            
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              {lib.description}
            </Typography>
            
            {/* Controlled by features */}
            {lib.controlledBy.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                  Controlled by:
                </Typography>
                {lib.controlledBy.map(featureId => {
                  const feature = professionConfig?.availableFeatures[featureId];
                  const isFeatureEnabled = enabledFeatures.has(featureId);
                  
                  return (
                    <Tooltip 
                      key={featureId}
                      title={feature?.description || featureId}
                    >
                      <Chip
                        label={featureId}
                        size="small"
                        icon={isFeatureEnabled ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
                        sx={{
                          height: 16,
                          fontSize: '0.65rem',
                          bgcolor: isFeatureEnabled ? getPlanColor(lib.requiredPlan) : 'rgba(0,0,0,0.1)',
                          color: isFeatureEnabled ? 'white' : 'text.secondary','& .MuiChip-icon': {
                            color: isFeatureEnabled ? 'white' : 'text.secondary'
                          }
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            )}
            
            {/* Dependencies warning */}
            {!dependencies.isValid && enabled && (
              <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                <Typography variant="caption">
                  Missing: {dependencies.missingDependencies.join('')}
                </Typography>
              </Alert>
            )}
          </Box>
          
          {/* Status Icon */}
          <Box>
            {lib.isCore ? (
              <CheckCircle sx={{ color: 'success.main' }} />
            ) : enabled ? (
              <CheckCircle sx={{ color: 'success.main' }} />
            ) : (
              <Cancel sx={{ color: 'text.disabled' }} />
            )}
          </Box>
        </Box>
      </Box>
    );
  };
  
  return (
    <Box>
      {/* Bundle Size Summary */}
      <Card sx={{ mb: 3, bgcolor: 'primary.main', color: 'white' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h4" fontWeight={700}>
                {bundleStats.totalSizeMB} MB
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Total Bundle Size
              </Typography>
            </Box>
            <Box textAlign="right">
              <Typography variant="h5" fontWeight={600}>
                {bundleStats.breakdown.length}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Active Libraries
              </Typography>
            </Box>
          </Box>
          
          {/* Bundle size breakdown */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ display: 'block', mb: 1, opacity: 0.9 }}>
              Top 5 Largest:
            </Typography>
            {bundleStats.breakdown.slice(0, 5).map((item, index) => (
              <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {index + 1}. {item.library}
                </Typography>
                <Typography variant="caption" fontWeight={600}>
                  {item.sizeKB >= 1000 ? `${(item.sizeKB / 1024).toFixed(1)}MB` : `${item.sizeKB}KB`}
                </Typography>
              </Box>
            ))}
          </Box>
          
          {/* Performance indicator */}
          <LinearProgress
            variant="determinate"
            value={Math.min(100, (bundleStats.totalSizeKB / 100000) * 100)} // 10MB = 100%
            sx={{
              mt: 2,
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': {
                bgcolor: bundleStats.totalSizeMB > 50 ? '#f44336' :
                         bundleStats.totalSizeMB > 20 ? '#ff9800' :
                         bundleStats.totalSizeMB > 10 ? '#ffeb3b' : '#4caf50'
              }
            }}
          />
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
            {bundleStats.totalSizeMB < 10 ? '✅ Excellent bundle size' :
             bundleStats.totalSizeMB < 20 ? '⚠️ Good bundle size' :
             bundleStats.totalSizeMB < 50 ? '⚠️ Large bundle size' : '❌ Very large bundle - consider disabling some features'}
          </Typography>
        </CardContent>
      </Card>
      
      {/* Libraries by Category */}
      <Box>
        {/* Video Streaming */}
        {categorizedLibraries.streaming.length > 0 && (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <CloudDownload color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Video Streaming
                </Typography>
                <Chip 
                  label={`${categorizedLibraries.streaming.filter(l => isLibraryEnabled(l)).length}/${categorizedLibraries.streaming.length}`}
                  size="small"
                  color="primary"
                />
                <Chip 
                  label={`${Math.round(categorizedLibraries.streaming.filter(l => isLibraryEnabled(l)).reduce((sum, l) => sum + l.bundleSize, 0) / 1024 * 10) / 10} MB`}
                  size="small"
                  sx={{ bgcolor: '#ff9800', color: 'white' }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {categorizedLibraries.streaming.map(lib => (
                <LibraryRow key={lib.npmPackage} lib={lib} />
              ))}
            </AccordionDetails>
          </Accordion>
        )}
        
        {/* Video Processing */}
        {categorizedLibraries.video.length > 0 && (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <VideoLibrary color="error" />
                <Typography variant="h6" fontWeight={600}>
                  Video Processing
                </Typography>
                <Chip 
                  label={`${categorizedLibraries.video.filter(l => isLibraryEnabled(l)).length}/${categorizedLibraries.video.length}`}
                  size="small"
                  sx={{ bgcolor: '#e53935', color: 'white' }}
                />
                <Chip 
                  label={`${Math.round(categorizedLibraries.video.filter(l => isLibraryEnabled(l)).reduce((sum, l) => sum + l.bundleSize, 0) / 1024 * 10) / 10} MB`}
                  size="small"
                  sx={{ bgcolor: '#ff9800', color: 'white' }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {categorizedLibraries.video.map(lib => (
                <LibraryRow key={lib.npmPackage} lib={lib} />
              ))}
            </AccordionDetails>
          </Accordion>
        )}
        
        {/* Audio Processing */}
        {categorizedLibraries.audio.length > 0 && (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <AudioFile sx={{ color: '#9c27b0' }} />
                <Typography variant="h6" fontWeight={600}>
                  Audio Processing
                </Typography>
                <Chip 
                  label={`${categorizedLibraries.audio.filter(l => isLibraryEnabled(l)).length}/${categorizedLibraries.audio.length}`}
                  size="small"
                  sx={{ bgcolor: '#9c27b0', color: 'white' }}
                />
                <Chip 
                  label={`${Math.round(categorizedLibraries.audio.filter(l => isLibraryEnabled(l)).reduce((sum, l) => sum + l.bundleSize, 0))} KB`}
                  size="small"
                  sx={{ bgcolor: '#ff9800', color: 'white' }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {categorizedLibraries.audio.map(lib => (
                <LibraryRow key={lib.npmPackage} lib={lib} />
              ))}
            </AccordionDetails>
          </Accordion>
        )}
        
        {/* Graphics & Effects */}
        {categorizedLibraries.graphics.length > 0 && (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <Palette sx={{ color: '#ff9800' }} />
                <Typography variant="h6" fontWeight={600}>
                  Graphics & Effects
                </Typography>
                <Chip 
                  label={`${categorizedLibraries.graphics.filter(l => isLibraryEnabled(l)).length}/${categorizedLibraries.graphics.length}`}
                  size="small"
                  sx={{ bgcolor: '#ff9800', color: 'white' }}
                />
                <Chip 
                  label={`${Math.round(categorizedLibraries.graphics.filter(l => isLibraryEnabled(l)).reduce((sum, l) => sum + l.bundleSize, 0) / 1024 * 10) / 10} MB`}
                  size="small"
                  sx={{ bgcolor: '#ff9800', color: 'white' }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {categorizedLibraries.graphics.map(lib => (
                <LibraryRow key={lib.npmPackage} lib={lib} />
              ))}
            </AccordionDetails>
          </Accordion>
        )}
        
        {/* Color Grading */}
        {categorizedLibraries.color.length > 0 && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <Palette color="secondary" />
                <Typography variant="h6" fontWeight={600}>
                  Color Grading & LUTs
                </Typography>
                <Chip 
                  label={`${categorizedLibraries.color.filter(l => isLibraryEnabled(l)).length}/${categorizedLibraries.color.length}`}
                  size="small"
                  color="secondary"
                />
                <Chip 
                  label={`${Math.round(categorizedLibraries.color.filter(l => isLibraryEnabled(l)).reduce((sum, l) => sum + l.bundleSize, 0))} KB`}
                  size="small"
                  sx={{ bgcolor: '#4caf50', color: 'white' }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {categorizedLibraries.color.map(lib => (
                <LibraryRow key={lib.npmPackage} lib={lib} />
              ))}
            </AccordionDetails>
          </Accordion>
        )}
        
        {/* UI & UX */}
        {categorizedLibraries.ui.length > 0 && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <Code color="info" />
                <Typography variant="h6" fontWeight={600}>
                  UI & UX Libraries
                </Typography>
                <Chip 
                  label={`${categorizedLibraries.ui.filter(l => isLibraryEnabled(l)).length}/${categorizedLibraries.ui.length}`}
                  size="small"
                  color="info"
                />
                <Chip 
                  label={`${Math.round(categorizedLibraries.ui.filter(l => isLibraryEnabled(l)).reduce((sum, l) => sum + l.bundleSize, 0) / 1024 * 10) / 10} MB`}
                  size="small"
                  sx={{ bgcolor: '#ff9800', color: 'white' }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {categorizedLibraries.ui.map(lib => (
                <LibraryRow key={lib.npmPackage} lib={lib} />
              ))}
            </AccordionDetails>
          </Accordion>
        )}
        
        {/* Utilities */}
        {categorizedLibraries.utility.length > 0 && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <Memory />
                <Typography variant="h6" fontWeight={600}>
                  Utilities
                </Typography>
                <Chip 
                  label={`${categorizedLibraries.utility.filter(l => isLibraryEnabled(l)).length}/${categorizedLibraries.utility.length}`}
                  size="small"
                />
                <Chip 
                  label={`${Math.round(categorizedLibraries.utility.filter(l => isLibraryEnabled(l)).reduce((sum, l) => sum + l.bundleSize, 0))} KB`}
                  size="small"
                  sx={{ bgcolor: '#4caf50', color: 'white' }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {categorizedLibraries.utility.map(lib => (
                <LibraryRow key={lib.npmPackage} lib={lib} />
              ))}
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
      
      {/* Performance Impact Summary */}
      <Paper sx={{ mt: 3, p: 2, bgcolor: 'info.light' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Speed />
          Performance Impact
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Chip 
            label={`High: ${LIBRARY_MAPPINGS.filter(l => l.performanceImpact === 'high' && isLibraryEnabled(l)).length}`}
            size="small"
            sx={{ bgcolor: '#f44336', color: 'white' }}
          />
          <Chip 
            label={`Medium: ${LIBRARY_MAPPINGS.filter(l => l.performanceImpact === 'medium' && isLibraryEnabled(l)).length}`}
            size="small"
            sx={{ bgcolor: '#ff9800', color: 'white' }}
          />
          <Chip 
            label={`Low: ${LIBRARY_MAPPINGS.filter(l => l.performanceImpact === 'low' && isLibraryEnabled(l)).length}`}
            size="small"
            sx={{ bgcolor: '#4caf50', color: 'white' }}
          />
        </Box>
      </Paper>
      
      {/* Info Box */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <AlertTitle>💡 How Library Control Works</AlertTitle>
        <Typography variant="body2">
          • <strong>Core libraries</strong> (React, MUI) cannot be disabled<br />
          • <strong>Feature-controlled</strong> libraries are automatically enabled when you enable their controlling features<br />
          • <strong>Lazy libraries</strong> are loaded on-demand to reduce initial bundle size<br />
          • Changes take effect after page reload
        </Typography>
      </Alert>
    </Box>
  );
}

/**
 * Compact Library Summary Widget (for dashboards)
 */
export function LibrarySummaryWidget({
  profession,
  accentColor
}: {
  profession: string;
  accentColor?: string;
}) {
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
  
  const bundleStats = useMemo(() => 
    calculateBundleSize(profession, enabledFeatures),
    [profession, enabledFeatures]
  );
  
  const activeLibraries = LIBRARY_MAPPINGS.filter(lib => 
    lib.isCore || lib.controlledBy.some(f => enabledFeatures.has(f))
  );
  
  return (
    <Card sx={{ bgcolor: accentColor || 'primary.main', color: 'white' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="caption" sx={{ opacity: 0.9, display: 'block' }}>
              Bundle Size
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {bundleStats.totalSizeMB} MB
            </Typography>
          </Box>
          <Box textAlign="right">
            <Typography variant="caption" sx={{ opacity: 0.9, display: 'block' }}>
              Active Libraries
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {activeLibraries.length}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}


