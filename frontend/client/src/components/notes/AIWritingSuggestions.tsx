// client/src/components/notes/AIWritingSuggestions.tsx
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Badge,
  Menu,
  MenuItem,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  ExpandMore,
  AutoAwesome,
  Check,
  Close,
  Refresh,
  Settings,
  TrendingUp,
  Psychology,
  Speed as Speed,
  Style,
  Spellcheck,
  Timeline,
  MenuBook,
  AccountTree,
  RecordVoiceOver,
  MoreVert,
  Download,
  Upload,
  Clear,
  Info,
  Warning,
  CheckCircle,
  Cancel,
  ThumbUp,
  ThumbDown,
  Visibility,
  VisibilityOff,
  BarChart as BoxChart,
  Insights,
  School,
  Lightbulb,
  Edit,
  ContentCopy as ContentContentCopy,
  Share,
} from '@mui/icons-material';
import type { 
  WritingSuggestion, 
  WritingContext, 
  NeuralEngineConfig, 
  WritingStats 
} from '@/services/AIWritingSuggestionsService';
import AIWritingSuggestionsService from '@/services/AIWritingSuggestionsService';

interface AIWritingSuggestionsProps {
  content: string;
  cursorPosition: number;
  selectedText?: string;
  onSuggestionAccept: (suggestion: WritingSuggestion) => void;
  onSuggestionReject: (suggestion: WritingSuggestion) => void;
  onSuggestionApply: (suggestion: WritingSuggestion) => void;
  className?: string;
  maxHeight?: number;
  showStats?: boolean;
  enableLearning?: boolean;
  autoGenerate?: boolean;
  variant?: 'sidebar' | 'floating' | 'inline'
}

export default function AIWritingSuggestions({
  content,
  cursorPosition,
  selectedText,
  onSuggestionAccept,
  onSuggestionReject,
  onSuggestionApply,
  className,
  maxHeight = 400,
  showStats = true,
  enableLearning = true,
  autoGenerate = true,
  variant = 'sidebar',
}: AIWritingSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<WritingSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [showSettings, setShowSettings] = useState(false);
  const [showStatsState, setShowStatsState] = useState(false);
  const [config, setConfig] = useState<NeuralEngineConfig>(
    AIWritingSuggestionsService.getInstance().getConfig()
  );
  const [stats, setStats] = useState<WritingStats | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<WritingSuggestion | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'confidence' | 'type' | 'category'>('confidence');
  const [showAccepted, setShowAccepted] = useState(true);
  const [showRejected, setShowRejected] = useState(false);
  
  const aiService = AIWritingSuggestionsService.getInstance();
  const generationTimeoutRef = useRef<NodeJS.Timeout>();

  // Generate suggestions when content changes
  useEffect(() => {
    if (!autoGenerate || !content.trim()) {
      setSuggestions([]);
      return;
  }

    // Debounce generation
    if (generationTimeoutRef.current) {
      clearTimeout(generationTimeoutRef.current);
  }

    generationTimeoutRef.current = setTimeout(async () => {
      await generateSuggestions();
  }, 500);

    return () => {
      if (generationTimeoutRef.current) {
        clearTimeout(generationTimeoutRef.current);
    }
  };
}, [content, cursorPosition, selectedText, autoGenerate]);

  // Load stats
  useEffect(() => {
    if (showStats) {
      setStats(aiService.getWritingStats());
  }
}, [showStats, aiService]);

  const generateSuggestions = async () => {
    if (!content.trim()) return;

    setIsGenerating(true);
    try {
      const context: WritingContext = {
        currentText: content,
        cursorPosition,
        selectedText,
        documentType: 'note',
        writingStyle: 'casual',
        targetAudience: 'general',
        language: 'no',
    };

      const newSuggestions = await aiService.generateSuggestions(context);
      setSuggestions(newSuggestions);
  } catch (error) {
      console.error('Error generating suggestions: ', error);
  } finally {
      setIsGenerating(false);
  }
};

  const handleSuggestionAccept = useCallback((suggestion: WritingSuggestion) => {
    aiService.acceptSuggestion(suggestion);
    onSuggestionAccept(suggestion);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
}, [aiService, onSuggestionAccept]);

  const handleSuggestionReject = useCallback((suggestion: WritingSuggestion) => {
    aiService.rejectSuggestion(suggestion);
    onSuggestionReject(suggestion);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
}, [aiService, onSuggestionReject]);

  const handleSuggestionApply = useCallback((suggestion: WritingSuggestion) => {
    onSuggestionApply(suggestion);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
}, [onSuggestionApply]);

  const updateConfig = useCallback((newConfig: Partial<NeuralEngineConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    aiService.updateConfig(updatedConfig);
}, [config, aiService]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'grammar': return theming.getThemedIcon(', ');
      case 'style': return <Style />;
      case 'flow': return <Box />;
      case 'vocabulary': return <MenuBook />;
      case 'structure': return <AccountTree />;
      case 'tone': return <RecordVoiceOver />;
      default: return theming.getThemedIcon(', ');
  }
};

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'grammar': return 'error';
      case 'style': return 'primary';
      case 'flow': return 'info';
      case 'vocabulary': return 'success';
      case 'structure': return 'warning';
      case 'tone': return 'secondary';
      default: return 'default';
}
};

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'completion': return theming.getThemedIcon(', ');
      case 'correction': return theming.getThemedIcon('checkCircle');
      case 'improvement': return theming.getThemedIcon('trendingUp');
      case 'alternative': return theming.getThemedIcon('contentCopy');
      case 'expansion': return theming.getThemedIcon('expandMore');
      case 'contraction': return theming.getThemedIcon('close');
      default: return <Lightbulb />;
}
};

  const getFilteredSuggestions = () => {
    let filtered = [...suggestions];

    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter(s => s.category === filterCategory);
  }

    // Sort suggestions
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'type':
          return a.type.localeCompare(b.type);
        case 'category':
          return a.category.localeCompare(b.category);
        default: return 0;
  }
  });

    return filtered;
};

  const renderSuggestion = (suggestion: WritingSuggestion) => (
    <ListItem key={suggestion.d} disablePadding>
      <ListItemButton
        onClick={() => setSelectedSuggestion(suggestion)}
        sx={{
          borderRadius:  1,
          mb: 0.5, '&:hover': {
            backgroundColor: 'action.hover',
        }}}
      >
        <ListItemIcon sx={{ minWidth: 40}}>
          <Badge
            badgeContent={Math.round(suggestion.confidence * 100)}
            color="primary"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16,} }}
          >
            {getCategoryIcon(suggestion.category)}
          </Badge>
        </ListItemIcon>

        <ListItemText
          primary={
            <Box>
              <Typography variant="body2" fontWeight={500}>
                {suggestion.text}
              </Typography>
              {suggestion.originalText && (
                <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through'}}>
                  {suggestion.originalText}
                </Typography>
              )}
            </Box>
        }
          secondary={
            <Box sx={{ mt: 0.5}}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip
                  size="small"
                  label={suggestion.type}
                  icon={getTypeIcon(suggestion.type)}
                  sx={{ fontSize: '0.65rem', height: 20}}
                />
                <Chip
                  size="small"
                  label={suggestion.category}
                  color={getCategoryColor(suggestion.category) as any}
                  sx={{ fontSize: '0.65rem', height: 20}}
                />
                <Typography variant="caption" color="text.secondary">
                  {suggestion.reason}
                </Typography>
              </Stack>
            </Box>
        }
        />

        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Godta">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleSuggestionAccept(suggestion);
            }}
            >
              <ThumbUp fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Avvis">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleSuggestionReject(suggestion);
            }}
            >
              <ThumbDown fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Bruk">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleSuggestionApply(suggestion);
            }}
            >
              <Check fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </ListItemButton>
    </ListItem>
  );

  const renderStats = () => {
    if (!stats) return null;

    return (
      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')>
          <Stack direction="row" alignItems="center" spacing={1}>
            <BarChart />
            <Typography variant="subtitle2">Skrivestatistikk</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" gutterBottom>
                Skrivescore: {stats.writingScore}/100
              </Typography>
              <LinearProgress
                variant="determinate"
                value={stats.writingScore}
                sx={{ height:  8, borderRadius:  4 }}
              />
            </Box>

            <Box>
              <Typography variant="body2" gutterBottom>
                Konsistens: {stats.consistencyScore}/100
              </Typography>
              <LinearProgress
                variant="determinate"
                value={stats.consistencyScore}
                color="info"
                sx={{ height:  8, borderRadius:  4 }}
              />
            </Box>

            <Box>
              <Typography variant="body2" gutterBottom>
                Lesbarhet: {stats.readabilityScore}/100
              </Typography>
              <LinearProgress
                variant="determinate"
                value={stats.readabilityScore}
                color="success"
                sx={{ height:  8, borderRadius:  4 }}
              />
            </Box>

            <Divider />

            <Typography variant="subtitle2" gutterBottom>
              Forbedringsområder
            </Typography>
            {stats.improvementAreas.length > 0 ? (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {stats.improvementAreas.map(area => (
                  <Chip
                    key={area}
                    size="small"
                    label={area}
                    color="warning"
                    sx={{ fontSize: '0.65rem', height: 20}}
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Ingen forbedringsområder identifisert
              </Typography>
            )}

            <Divider />

            <Typography variant="subtitle2" gutterBottom>
              Mest brukte mønstre
            </Typography>
            {stats.mostUsedPatterns.slice(0, 3).map(pattern => (
              <Box key={pattern.id} sx={{ mb:  1 }}>
                <Typography variant="caption" color="text.secondary">
                  {pattern.context} ({pattern.frequency} ganger)
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(pattern.frequency / stats.mostUsedPatterns[0].frequency) * 100}
                  sx={{ height:  4, borderRadius:  2 }}
                />
              </Box>
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>
    );
};

  const filteredSuggestions = getFilteredSuggestions();

  return (
    <>
      <Paper
        className={className}
        elevation={variant === 'floating' ? 8 : 2}
        sx={{
          maxHeight,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          ...(variant === 'floating' && {
            position: 'fixed',
            top:  20,
            right:  20,
            zIndex: 10,
            minWidth: 30,
            maxWidth: 40,
        })}}
       sx={theming.getThemedCardSx()}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Psychology color="primary" />
              <Typography variant="h6" component="h2" sx={{ color: theming.colors.primary }}>
                AI Skriveforslag
              </Typography>
              {isGenerating && <CircularProgress size={20} />}
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Innstillinger">
                <IconButton size="small" onClick={() => setShowSettings(true)}>
                  {theming.getThemedIcon('settings')}
                </IconButton>
              </Tooltip>
              <Tooltip title="Oppdater">
                <IconButton size="small" onClick={generateSuggestions}>
                  {theming.getThemedIcon('refresh')}
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {/* Filter and Sort */}
          <Stack direction="row" spacing={1} sx={{ mt:  1 }}>
            <Chip
              size="small"
              label={`${filteredSuggestions.length} forslag`}
              color="primary"
              sx={{ fontSize: '0.65rem', height: 20}}
            />
            <Chip
              size="small"
              label={filterCategory === 'all' ? 'Alle kategorier' : filterCategory}
              onClick={() => setFilterCategory(filterCategory === 'all' ? 'grammar' : 'all')}
              sx={{ fontSize: '0.65rem', height: 20}}
            />
          </Stack>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto'}}>
          {isGenerating ? (
            <Box sx={{ p: 2, textAlign: 'center'}}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
                Genererer forslag...
              </Typography>
            </Box>
          ) : filteredSuggestions.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center'}}>
              <AutoAwesome sx={{ fontSize:  48, color: 'text.secondary', mb:  1 }} />
              <Typography variant="body2" color="text.secondary">
                Ingen forslag tilgjengelig
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Skriv mer tekst for å få AI-forslag
              </Typography>
            </Box>
          ) : (
            <List dense>
              {filteredSuggestions.map(renderSuggestion)}
            </List>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider'}}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">
              {stats ? `${stats.totalWords} ord skrevet` : 'Laster statistikk...'}
            </Typography>
            <Button size="small" onClick={() => setShowStatsState(!showStatsState)}>
              {showStatsState ? 'Skjul statistikk' : 'Vis statistikk'}
            </Button>
          </Stack>
        </Box>

        {/* Stats */}
        {showStatsState && renderStats()}
      </Paper>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="md" fullWidth>
        <DialogTitle>AI Skriveforslag Innstillinger</DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Generering
              </Typography>
              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enableLearning}
                      onChange={(e) => updateConfig({ enableLearning: e.target.checked })}
                    />
                }
                  label="Aktiver læring"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enablePersonalization}
                      onChange={(e) => updateConfig({ enablePersonalization: e.target.checked })}
                    />
                }
                  label="Personalisering"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enableDomainAdaptation}
                      onChange={(e) => updateConfig({ enableDomainAdaptation: e.target.checked })}
                    />
                }
                  label="Domenetilpasning"
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Forslagstyper
              </Typography>
              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enableGrammarChecking}
                      onChange={(e) => updateConfig({ enableGrammarChecking: e.target.checked })}
                    />
                }
                  label="Grammatikk-sjekk"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enableStyleEnhancement}
                      onChange={(e) => updateConfig({ enableStyleEnhancement: e.target.checked })}
                    />
                }
                  label="Stilforbedring"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enableFlowImprovement}
                      onChange={(e) => updateConfig({ enableFlowImprovement: e.target.checked })}
                    />
                }
                  label="Flytforbedring"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.enableVocabularyExpansion}
                      onChange={(e) => updateConfig({ enableVocabularyExpansion: e.target.checked })}
                    />
                }
                  label="Ordforrådsutvidelse"
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Konfidensgrense: {config.confidenceThreshold}
              </Typography>
              <Slider
                value={config.confidenceThreshold}
                onChange={(_, value) => updateConfig({ confidenceThreshold: value as number })}
                min={0}
                max={1}
                step={0.1}
                marks={[
                  { value: 0, label: '0',},
                  { value: 0, .label: '0.5',},
                  { value: 1, label: '1',},
                ]}
              />
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Maksimalt antall forslag: {config.suggestionLimit}
              </Typography>
              <Slider
                value={config.suggestionLimit}
                onChange={(_, value) => updateConfig({ suggestionLimit: value as number })}
                min={1}
                max={20}
                step={1}
                marks={[
                  { value: 1, label: '1',},
                  { value:  10, label: '10',},
                  { value:  20, label: '20',},
                ]}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Lukk</Button>
          <Button onClick={() => aiService.clearLearningData()} color="error">
            Nullstill læring
          </Button>
        </DialogActions>
      </Dialog>

      {/* Suggestion Details Dialog */}
      <Dialog open={showDetails} onClose={() => setShowDetails(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Forslag Detaljer</DialogTitle>
        <DialogContent>
          {selectedSuggestion && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Forslag
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', backgroundColor: 'grey.10', p: 1, borderRadius:  1 }}>
                  {selectedSuggestion.text}
                </Typography>
              </Box>

              {selectedSuggestion.originalText && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Original tekst
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', backgroundColor: 'grey.10', p: 1, borderRadius:  1 }}>
                    {selectedSuggestion.originalText}
                  </Typography>
                </Box>
              )}

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Begrunnelse
                </Typography>
                <Typography variant="body2">
                  {selectedSuggestion.reason}
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Konfidens: {Math.round(selectedSuggestion.confidence * 10)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={selectedSuggestion.confidence * 100}
                  sx={{ height:  8, borderRadius:  4 }}
                />
              </Box>

              {selectedSuggestion.alternatives && selectedSuggestion.alternatives.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Alternativer
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {selectedSuggestion.alternatives.map((alt, index) => (
                      <Chip
                        key={index}
                        size="small"
                        label={alt}
                        onClick={() => {
                          // Apply alternative
                          const updatedSuggestion = { ...selectedSuggestion, text: alt };
                          handleSuggestionApply(updatedSuggestion);
                          setShowDetails(false);
                      }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>Lukk</Button>
          <Button
            onClick={() => {
              if (selectedSuggestion) {
                handleSuggestionApply(selectedSuggestion);
                setShowDetails(false);
            }
          }}
            variant="contained"
          >
            Bruk forslag
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
