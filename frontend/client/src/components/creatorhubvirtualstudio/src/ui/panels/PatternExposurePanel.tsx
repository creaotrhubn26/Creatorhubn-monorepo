/**
 * Pattern Exposure Panel
 * 
 * Integrates lighting patterns with exposure calculations:
 * - Browse patterns with exposure recommendations
 * - Match user equipment to pattern requirements
 * - Apply patterns with adjusted settings
 * - See which patterns work with available gear
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Tabs,
  Tab,
  Chip,
  Alert,
  AlertTitle,
  Button,
  Divider,
  Card,
  CardContent,
  CardActions,
  Grid,
  LinearProgress,
  Tooltip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Lightbulb as LightIcon,
  CameraAlt as CameraIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  AutoAwesome as MagicIcon,
  ExpandMore as ExpandIcon,
  PlayArrow as ApplyIcon,
  Info as InfoIcon,
  ShoppingCart as ShopIcon,
  Tune as TuneIcon,
  MovieFilter as PatternIcon,
  Star as StarIcon,
  School as LearnIcon,
} from '@mui/icons-material';
import { useUserEquipmentInventory } from '@/hooks/useUserEquipmentInventory';
import { cinematographyPatternsService, CinematographyPattern } from '@/core/services/cinematographyPatternsService';
import { 
  patternExposureIntegration, 
  PatternExposureAnalysis, 
  EquipmentMatch,
} from '@/core/services/patternExposureIntegration';
import { useNodes, useActions } from '@/state/selectors';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatShutter(shutter: number): string {
  if (shutter >= 1) return `${shutter} "`;
  return `1/${Math.round(1 / shutter)}`;
}

function getFeasibilityColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 0.8) return 'success';
  if (score >= 0.5) return 'warning';
  return 'error';
}

function getMoodIcon(mood: CinematographyPattern['mood,']): string {
  switch (mood) {
    case 'bright': return '☀️';
    case 'high-key': return '🌟';
    case 'neutral': return '⚪';
    case 'dramatic': return '🎭';
    case 'low-key': return '🌙';
    case 'dark': return '🖤';
    default: return '💡';
  }
}

function getDifficultyColor(difficulty: CinematographyPattern['difficulty,']): 'success' | 'info' | 'warning' | 'error' {
  switch (difficulty) {
    case 'beginner': return 'success';
    case 'intermediate': return 'info';
    case 'advanced': return 'warning';
    case 'expert': return 'error';
    default: return 'info';
  }
}

// =============================================================================
// EQUIPMENT MATCH COMPONENT
// =============================================================================

interface EquipmentMatchItemProps {
  match: EquipmentMatch;
}

function EquipmentMatchItem({ match }: EquipmentMatchItemProps) {
  const [expanded, setExpanded] = useState(false);
  
  const getMatchIcon = () => {
    if (match.score >= 0.8) return <CheckIcon color="success" />;
    if (match.score >= 0.5) return <WarningIcon color="warning" />;
    if (match.score > 0) return <WarningIcon color="error" />;
    return <ErrorIcon color="error" />;
  };
  
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'key': return '#FF6B6B';
      case 'fill': return '#4ECDC4';
      case 'rim': return '#FFE66D';
      case 'background': return '#95E1D3';
      default: return '#A8DADC';
    }
  };
  
  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: 1.5, 
        mb: 1,
        borderLeft: 4,
        borderLeftColor: getRoleColor(match.requirement.role)}}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        {getMatchIcon()}
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" fontWeight="medium">
            {match.requirement.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {match.matchedEquipment 
              ? `${match.matchedEquipment.brand} ${match.matchedEquipment.model}`
              : 'No equipment matched'
            }
          </Typography>
        </Box>
        <Chip 
          label={`${Math.round(match.score * 100)}%`} 
          size="small"
          color={getFeasibilityColor(match.score)}
        />
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          <ExpandIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
        </IconButton>
      </Stack>
      
      <Collapse in={expanded}>
        <Box sx={{ mt: 1, pl: 4 }}>
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              Required: {match.requirement.idealPower}Ws {match.requirement.modifier}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Position: {match.requirement.distance.toFixed(1)}m at {match.requirement.angle}°
            </Typography>
            {match.warnings.length > 0 && (
              <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                {match.warnings.map((w, i) => (
                  <Typography key={i} variant="caption" display="block">{w}</Typography>
                ))}
              </Alert>
            )}
            {match.suggestions.length > 0 && (
              <Box sx={{ mt: 1 }}>
                {match.suggestions.map((s, i) => (
                  <Typography key={i} variant="caption" color="info.main" display="block">
                    💡 {s}
                  </Typography>
                ))}
              </Box>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}

// =============================================================================
// PATTERN CARD COMPONENT
// =============================================================================

interface PatternCardProps {
  pattern: CinematographyPattern;
  analysis: PatternExposureAnalysis | null;
  onApply: () => void;
  onSelect: () => void;
  isSelected: boolean;
  compact?: boolean;
}

function PatternCard({ pattern, analysis, onApply, onSelect, isSelected, compact }: PatternCardProps) {
  return (
    <Card 
      variant={isSelected ? 'elevation' : 'outlined'}
      sx={{ 
        cursor: 'pointer',
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? 'primary.main' : 'divider'}}
      onClick={onSelect}
    >
      <CardContent sx={{ pb: compact ? 1 : 2 }}>
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              {getMoodIcon(pattern.mood)} {pattern.name}
            </Typography>
            {!compact && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {pattern.description}
              </Typography>
            )}
          </Box>
          {analysis && (
            <Tooltip title={`${Math.round(analysis.feasibilityScore * 100)}% equipment match`}>
              <Box>
                <LinearProgress 
                  variant="determinate" 
                  value={analysis.feasibilityScore * 100}
                  color={getFeasibilityColor(analysis.feasibilityScore)}
                  sx={{ width: 40, height: 6, borderRadius: 3 }}
                />
              </Box>
            </Tooltip>
          )}
        </Stack>
        
        <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap" useFlexGap>
          <Chip 
            label={pattern.category} 
            size="small" 
            variant="outlined"
          />
          <Chip 
            label={pattern.difficulty} 
            size="small"
            color={getDifficultyColor(pattern.difficulty)}
          />
          <Chip 
            label={pattern.keyToFillRatio + ':1'} 
            size="small"
            variant="outlined"
          />
        </Stack>
        
        {!compact && analysis && (
          <Box sx={{ mt: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" fontWeight="medium">
              Recommended: f/{analysis.recommendedSettings.aperture} • {formatShutter(analysis.recommendedSettings.shutter)} • ISO {analysis.recommendedSettings.iso}
            </Typography>
          </Box>
        )}
      </CardContent>
      
      {!compact && (
        <CardActions>
          <Button 
            size="small" 
            startIcon={<ApplyIcon />}
            onClick={(e) => { e.stopPropagation(); onApply(); }}
            disabled={!analysis || analysis.feasibilityScore < 0.3}
          >
            Apply Pattern
          </Button>
        </CardActions>
      )}
    </Card>
  );
}

// =============================================================================
// PATTERN DETAILS PANEL
// =============================================================================

interface PatternDetailsPanelProps {
  analysis: PatternExposureAnalysis;
  onApply: () => void;
}

function PatternDetailsPanel({ analysis, onApply }: PatternDetailsPanelProps) {
  const { pattern, equipmentMatches, missingEquipment, feasibilityScore } = analysis;
  
  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.dark' }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <PatternIcon sx={{ fontSize: 40 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{pattern.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {pattern.description}
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h4" color={getFeasibilityColor(feasibilityScore) + '.main'}>
              {Math.round(feasibilityScore * 100)}%
            </Typography>
            <Typography variant="caption">Match</Typography>
          </Box>
        </Stack>
      </Paper>
      
      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>Attention</AlertTitle>
          {analysis.warnings.map((w, i) => (
            <Typography key={i} variant="body2">• {w}</Typography>
          ))}
        </Alert>
      )}
      
      {/* Recommended Settings */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          <MagicIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
          Recommended Camera Settings
        </Typography>
        <Stack direction="row" spacing={3} mt={1}>
          <Box textAlign="center">
            <Typography variant="h5" color="primary">
              f/{analysis.recommendedSettings.aperture}
            </Typography>
            <Typography variant="caption">Aperture</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h5" color="primary">
              {formatShutter(analysis.recommendedSettings.shutter)}
            </Typography>
            <Typography variant="caption">Shutter</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h5" color="primary">
              {analysis.recommendedSettings.iso}
            </Typography>
            <Typography variant="caption">ISO</Typography>
          </Box>
        </Stack>
        
        <Divider sx={{ my: 2 }} />
        
        <Stack direction="row" spacing={3}>
          <Box>
            <Typography variant="caption" color="text.secondary">Contrast Ratio</Typography>
            <Typography variant="body2" fontWeight="medium">{analysis.contrastRatio}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Dynamic Range</Typography>
            <Typography variant="body2" fontWeight="medium">{analysis.dynamicRangeRequired.toFixed(1)} stops</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Total Power</Typography>
            <Typography variant="body2" fontWeight="medium">{Math.round(analysis.totalWattageNeeded)}Ws</Typography>
          </Box>
        </Stack>
      </Paper>
      
      {/* Light Power Breakdown */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          <LightIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
          Light Power Requirements
        </Typography>
        <Stack direction="row" spacing={2} mt={1}>
          {analysis.keyLightPower > 0 && (
            <Chip 
              label={`Key: ${Math.round(analysis.keyLightPower)}Ws`}
              sx={{ bgcolor: '#FF6B6B', color: 'white' }}
            />
          )}
          {analysis.fillLightPower > 0 && (
            <Chip 
              label={`Fill: ${Math.round(analysis.fillLightPower)}Ws`}
              sx={{ bgcolor: '#4ECDC4', color: 'white' }}
            />
          )}
          {analysis.rimLightPower > 0 && (
            <Chip 
              label={`Rim: ${Math.round(analysis.rimLightPower)}Ws`}
              sx={{ bgcolor: '#FFE66D', color: 'black' }}
            />
          )}
        </Stack>
      </Paper>
      
      {/* Equipment Matches */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandIcon />}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle2">Equipment Matching</Typography>
            <Badge 
              badgeContent={missingEquipment.length} 
              color="error"
              invisible={missingEquipment.length === 0}
            >
              <CheckIcon color={missingEquipment.length === 0 ? 'success' : 'disabled'} fontSize="small" />
            </Badge>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          {equipmentMatches.map((match, i) => (
            <EquipmentMatchItem key={i} match={match} />
          ))}
        </AccordionDetails>
      </Accordion>
      
      {/* Tips */}
      {analysis.tips.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            <LearnIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
            Pro Tips
          </Typography>
          {analysis.tips.map((tip, i) => (
            <Alert key={i} severity="info" sx={{ mb: 1 }} icon={<InfoIcon />}>
              {tip}
            </Alert>
          ))}
        </Box>
      )}
      
      {/* Reference */}
      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          <strong>Reference:</strong> {pattern.reference}
        </Typography>
        {pattern.usedIn.length > 0 && (
          <Typography variant="caption" color="text.secondary" display="block">
            <strong>Used in:</strong> {pattern.usedIn.join('')}
          </Typography>
        )}
      </Box>
      
      {/* Apply Button */}
      <Button
        variant="contained"
        fullWidth
        size="large"
        startIcon={<ApplyIcon />}
        onClick={onApply}
        disabled={feasibilityScore < 0.3}
        sx={{ mt: 2 }}
      >
        Apply {pattern.name}
      </Button>
    </Box>
  );
}

// =============================================================================
// MAIN PANEL
// =============================================================================

export function PatternExposurePanel() {
  const { userInventory, isLoading: inventoryLoading } = useUserEquipmentInventory();
  const nodes = useNodes();
  const { updateNode, addNode } = useActions();
  
  const [activeTab, setActiveTab] = useState(0);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [targetFStop, setTargetFStop] = useState(8);
  const [targetISO, setTargetISO] = useState(100);
  
  // Get all patterns
  const patterns = useMemo(() => {
    return cinematographyPatternsService.getAllPatterns();
  }, []);
  
  // Analyze all patterns with user equipment
  const patternAnalyses = useMemo(() => {
    if (!userInventory) return new Map<string, PatternExposureAnalysis>();
    
    const analyses = new Map<string, PatternExposureAnalysis>();
    for (const pattern of patterns) {
      const analysis = patternExposureIntegration.analyzePatternWithEquipment(
        pattern,
        userInventory,
        { targetFStop, targetISO }
      );
      analyses.set(pattern.id, analysis);
    }
    return analyses;
  }, [patterns, userInventory, targetFStop, targetISO]);
  
  // Get compatible patterns (sorted by feasibility)
  const compatiblePatterns = useMemo(() => {
    return patterns
      .map(p => ({
        pattern: p,
        analysis: patternAnalyses.get(p.id)!,
        feasibility: patternAnalyses.get(p.id)?.feasibilityScore || 0,
      }))
      .sort((a, b) => b.feasibility - a.feasibility);
  }, [patterns, patternAnalyses]);
  
  // Selected pattern analysis
  const selectedAnalysis = useMemo(() => {
    if (!selectedPatternId) return null;
    return patternAnalyses.get(selectedPatternId) || null;
  }, [selectedPatternId, patternAnalyses]);
  
  // Get equipment suggestions
  const equipmentSuggestions = useMemo(() => {
    if (!userInventory) return [];
    return patternExposureIntegration.suggestEquipmentForPatterns(userInventory);
  }, [userInventory]);
  
  // Apply pattern to scene
  const handleApplyPattern = useCallback((patternId: string) => {
    const analysis = patternAnalyses.get(patternId);
    if (!analysis) return;
    
    // Find camera node
    const cameraNode = nodes.find(n => n.camera);
    if (cameraNode) {
      // Update camera with recommended settings
      updateNode(cameraNode.id, {
        camera: {
          ...cameraNode.camera,
          aperture: analysis.recommendedSettings.aperture,
          shutter: analysis.recommendedSettings.shutter,
          iso: analysis.recommendedSettings.iso,
        },
      });
    }
    
    // Dispatch event to add pattern lights to scene
    window.dispatchEvent(new CustomEvent('ch-apply-lighting-pattern', {
      detail: {
        patternId,
        pattern: analysis.pattern,
        requirements: analysis.requirements,
        equipmentMatches: analysis.equipmentMatches,
        recommendedSettings: analysis.recommendedSettings,
      },
    }));
  }, [patternAnalyses, nodes, updateNode]);
  
  // Filter patterns by category
  const getPatternsByCategory = (category: string) => {
    return compatiblePatterns.filter(p => p.pattern.category === category);
  };
  
  const categories = ['portrait','dramatic','commercial','beauty','interview', 'product'];
  
  if (inventoryLoading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography>Loading equipment inventory...</Typography>
        <LinearProgress sx={{ mt: 2 }} />
      </Box>
    );
  }
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PatternIcon color="primary" />
          <Typography variant="h6" sx={{ flex: 1 }}>
            Lighting Patterns
          </Typography>
          <Chip 
            label={`${compatiblePatterns.filter(p => p.feasibility >= 0.6).length}/${patterns.length} compatible`}
            color="primary"
            size="small"
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" mt={1}>
          Professional cinematography patterns matched to your equipment
        </Typography>
      </Paper>
      
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2 }}
      >
        <Tab label="All Patterns" />
        <Tab label="Best Matches" icon={<StarIcon />} iconPosition="end" />
        <Tab label="Equipment" icon={<ShopIcon />} iconPosition="end" />
      </Tabs>
      
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* All Patterns Tab */}
        {activeTab === 0 && (
          <Grid container spacing={2}>
            {/* Pattern List */}
            <Grid item xs={selectedPatternId ? 5 : 12}>
              {categories.map(category => {
                const categoryPatterns = getPatternsByCategory(category);
                if (categoryPatterns.length === 0) return null;
                
                return (
                  <Box key={category} sx={{ mb: 3 }}>
                    <Typography 
                      variant="overline" 
                      color="text.secondary"
                      sx={{ textTransform: 'capitalize', display: 'block', mb: 1 }}
                    >
                      {category} Lighting
                    </Typography>
                    <Stack spacing={1}>
                      {categoryPatterns.map(({ pattern, analysis }) => (
                        <PatternCard
                          key={pattern.id}
                          pattern={pattern}
                          analysis={analysis}
                          onApply={() => handleApplyPattern(pattern.id)}
                          onSelect={() => setSelectedPatternId(pattern.id)}
                          isSelected={selectedPatternId === pattern.id}
                          compact={!!selectedPatternId}
                        />
                      ))}
                    </Stack>
                  </Box>
                );
              })}
            </Grid>
            
            {/* Details Panel */}
            {selectedPatternId && selectedAnalysis && (
              <Grid item xs={7}>
                <PatternDetailsPanel
                  analysis={selectedAnalysis}
                  onApply={() => handleApplyPattern(selectedPatternId)}
                />
              </Grid>
            )}
          </Grid>
        )}
        
        {/* Best Matches Tab */}
        {activeTab === 1 && (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              These patterns work best with your current equipment
            </Alert>
            <Stack spacing={2}>
              {compatiblePatterns
                .filter(p => p.feasibility >= 0.6)
                .slice(0, 10)
                .map(({ pattern, analysis }) => (
                  <PatternCard
                    key={pattern.id}
                    pattern={pattern}
                    analysis={analysis}
                    onApply={() => handleApplyPattern(pattern.id)}
                    onSelect={() => {
                      setSelectedPatternId(pattern.id);
                      setActiveTab(0);
                    }}
                    isSelected={false}
                    compact={false}
                  />
                ))}
            </Stack>
            
            {compatiblePatterns.filter(p => p.feasibility >= 0.6).length === 0 && (
              <Alert severity="info">
                Add more lighting equipment to unlock pattern recommendations
              </Alert>
            )}
          </Box>
        )}
        
        {/* Equipment Suggestions Tab */}
        {activeTab === 2 && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Equipment that would unlock more lighting patterns
            </Alert>
            <List>
              {equipmentSuggestions.map((suggestion, i) => (
                <ListItem key={i} sx={{ bgcolor: 'action.hover', mb: 1, borderRadius: 1 }}>
                  <ListItemIcon>
                    {suggestion.priority === 'high' ? (
                      <StarIcon color="warning" />
                    ) : (
                      <LightIcon color="action" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={suggestion.equipment}
                    secondary={`Unlocks: ${suggestion.unlocksPatterns.slice(0, 3).join('')}${suggestion.unlocksPatterns.length > 3 ? ` +${suggestion.unlocksPatterns.length - 3} more` : ','}`}
                  />
                  <ListItemSecondaryAction>
                    <Chip 
                      label={suggestion.priority}
                      size="small"
                      color={suggestion.priority === 'high' ? 'warning' : 'default'}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
              {equipmentSuggestions.length === 0 && (
                <Alert severity="success">
                  You have great equipment coverage! Most patterns are accessible.
                </Alert>
              )}
            </List>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default PatternExposurePanel;

