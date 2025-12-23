/**
 * AI Content Analyzer - Intelligently analyzes and enhances content
 * Automatically suggests interactive elements, improvements, and optimizations
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Stack,
  Card,
  CardContent,
  CardActions,
  LinearProgress,
  Alert,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

interface ContentAnalysis {
  id: string;
  type: 'suggestion' | 'enhancement' | 'optimization' | 'interactive';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  category: string;
  suggestions: string[];
  autoApply?: boolean
}

interface AIContentAnalyzerProps {
  content: string;
  onApplySuggestion: (suggestion: ContentAnalysis) => void;
  onGenerateInteractive: (type: string, data: any) => void;
  className?: string
}

export const AIContentAnalyzer: React.FC<AIContentAnalyzerProps> = ({
  content,
  onApplySuggestion,
  onGenerateInteractive,
  className,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [analysis, setAnalysis] = useState<ContentAnalysis[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ContentAnalysis | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // AI Analysis Engine
  const analyzeContent = useCallback(async (text: string) => {
    setIsAnalyzing(true);
    
    // Simulate AI analysis with realistic delays
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const analyses: ContentAnalysis[] = [
      {
        id: '',
        type: 'interactive',
        title: 'Add Interactive Quiz',
        description: 'This section about "Best Practices" would benefit from a knowledge check quiz.',
        confidence: 0.2,
        impact: 'high',
        category: 'Engagement',
        suggestions: [
          'Create 3-5 multiple choice questions','Add progress tracking','Include explanations for answers'
        ],
        autoApply: false
  },
      {
        id: '',
        type: 'enhancement',
        title: 'Add Visual Diagram',
        description: 'The process flow described could be visualized with an interactive diagram.',
        confidence: 0.7,
        impact: 'high',
        category: 'Visualization',
        suggestions: [
          'Create flowchart diagram','Add clickable nodes','Include tooltips and explanations'
        ],
        autoApply: false
  },
      {
        id: '',
        type: 'suggestion',
        title: 'Improve Readability',
        description: 'Break down long paragraphs into shorter, more digestible sections.',
        confidence: 0.8,
        impact: 'medium',
        category: 'Content',
        suggestions: [
          'Split sx={{ mb: 2 }} at line 1','Add bullet points for key concepts','Include callout boxes for important information'
        ],
        autoApply: true
  },
      {
        id: '',
        type: 'optimization',
        title: 'Add Code Sandbox',
        description: 'The code examples would be more engaging with a live code editor.',
        confidence: 0.5,
        impact: 'high',
        category: 'Code',
        suggestions: [
          'Create runnable code examples','Add syntax highlighting','Include error handling and validation'
        ],
        autoApply: false
  },
      {
        id: ', ',
        type: 'interactive',
        title: 'Create Step-by-Step Simulation',
        description: 'The tutorial section could be converted to an interactive walkthrough.',
        confidence: 0.9,
        impact: 'high',
        category: 'Tutorial',
        suggestions: [
          'Break into sequential steps', 'Add progress indicators', 'Include validation and feedback'
        ],
        autoApply: false
  }
    ];

    setAnalysis(analyses);
    setIsAnalyzing(false);
}, []);

  // Auto-apply high-confidence suggestions
  const autoApplySuggestions = useMemo(() => {
    return analysis.filter(a => a.autoApply && a.confidence > 0.8);
}, [analysis]);

  // Group analysis by category
  const groupedAnalysis = useMemo(() => {
    const groups: Record<string, ContentAnalysis[]> = {};
    analysis.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = [];
    }
      groups[item.category].push(item);
  });
    return groups;
}, [analysis]);

  const handleApplySuggestion = useCallback((suggestion: ContentAnalysis) => {
    onApplySuggestion(suggestion);
    setAnalysis(prev => prev.filter(a => a.id !== suggestion.id));
}, [onApplySuggestion]);

  const handleGenerateInteractive = useCallback((suggestion: ContentAnalysis) => {
    onGenerateInteractive(suggestion.category.toLowerCase(), {
      title: suggestion.title,
      content: content,
      suggestions: suggestion.suggestions
});
    setAnalysis(prev => prev.filter(a => a.id !== suggestion.id));
}, [onGenerateInteractive, content]);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
}
};

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'interactive': return <CREATOR_HUB_ICONS.smartToy />;
      case 'enhancement': return <CREATOR_HUB_ICONS.autoFixHigh />;
      case 'suggestion': return <CREATOR_HUB_ICONS.lightbulb />;
      case 'optimization': return <CREATOR_HUB_ICONS.settings />;
      default: return <CREATOR_HUB_ICONS.info />;
}
};

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.smartToy sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>AI Content Analyzer</Typography>
              <Typography variant="body2" color="text.secondary">
                Intelligent content enhancement suggestions
              </Typography>
            </Box>
          </Stack>
          
          <Button variant="contained"
            startIcon={<CREATOR_HUB_ICONS.autoFixHigh sx={theming.getThemedButtonSx()} />}
            onClick={() => analyzeContent(content)}
            disabled={isAnalyzing || !content.trim()}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Content'}
          </Button>
        </Stack>
      </Paper>

      {/* Analysis Progress */}
      {isAnalyzing && (
        <Paper elevation={1} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="body2" gutterBottom>
            AI is analyzing your content...
          </Typography>
          <LinearProgress />
        </Paper>
      )}

      {/* Auto-apply Suggestions */}
      {autoApplySuggestions.length > 0 && (
        <Alert severity="info" sx={{ mb:  2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Auto-applying {autoApplySuggestions.length} high-confidence suggestions
          </Typography>
          {autoApplySuggestions.map(suggestion => (
            <Chip
              key={suggestion.id}
              label={suggestion.title}
              size="small"
              sx={{ mr: 1, mb: 1 }}
              icon={<CREATOR_HUB_ICONS.checkCircle />}
            />
          ))}
        </Alert>
      )}

      {/* Analysis Results */}
      {analysis.length > 0 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Analysis Results ({analysis.length} suggestions)
          </Typography>
          
          {Object.entries(groupedAnalysis).map(([category, items]) => (
            <Accordion key={category} defaultExpanded>
              <AccordionSummary expandIcon={<CREATOR_HUB_ICONS.expandMore />}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="subtitle1">{category}</Typography>
                  <Chip 
                    label={items.length}
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {items.map((item) => (
                    <Card key={item.id} variant="outlined" sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          <Box sx={{ mt: 0.5}}>
                            {getTypeIcon(item.type)}
                          </Box>
                          
                          <Box sx={{ flex:  1 }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb:  1 }}>
                              <Typography variant="subtitle2">{item.title}</Typography>
                              <Chip 
                                label={item.impact}
                                size="small" 
                                color={getImpactColor(item.impact)}
                                variant="outlined"
                              />
                              <Chip 
                                label={`${Math.round(item.confidence * 100)}%`}
                                size="small" 
                                color="primary"
                                variant="outlined"
                              />
                            </Stack>
                            
                            <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                              {item.description}
                            </Typography>
                            
                            <List dense>
                              {item.suggestions.map((suggestion, index) => (
                                <ListItem key={index} sx={{ py:  0 }}>
                                  <ListItemIcon sx={{ minWidth: 32}}>
                                    <CREATOR_HUB_ICONS.checkCircle sx={{ fontSize: 16}} />
                                  </ListItemIcon>
                                  <ListItemText 
                                    primary={suggestion}
                                    primaryTypographyProps={{ variant: 'body2'}}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        </Stack>
                      </CardContent>
                      
                      <CardActions sx={theming.getThemedCardSx()}>
                        <Button
                          size="small"
                          startIcon={<CREATOR_HUB_ICONS.visibility />}
                          onClick={() => {
                            setSelectedSuggestion(item);
                            setShowDetails(true);
                        }}
                        >
                          Details
                        </Button>
                        
                        {item.type === 'interactive' ? (
                          <Button size="small"
                            variant="contained"
                            startIcon={<CREATOR_HUB_ICONS.smartToy sx={theming.getThemedButtonSx()} />}
                            onClick={() => handleGenerateInteractive(item)}
                          >
                            Generate
                          </Button>
                        ) : (
                          <Button size="small"
                            variant="contained"
                            startIcon={<CREATOR_HUB_ICONS.checkCircle sx={theming.getThemedButtonSx()} />}
                            onClick={() => handleApplySuggestion(item)}
                          >
                            Apply
                          </Button>
                        )}
                      </CardActions>
                    </Card>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Details Dialog */}
      <Dialog 
        open={showDetails}
        onClose={() => setShowDetails(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            {selectedSuggestion && getTypeIcon(selectedSuggestion.type)}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedSuggestion?.title}
            </Typography>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          {selectedSuggestion && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedSuggestion.description}
              </Typography>
              
              <Typography variant="subtitle2" gutterBottom>
                Implementation Suggestions: </Typography>
              
              <List>
                {selectedSuggestion.suggestions.map((suggestion, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <CREATOR_HUB_ICONS.checkCircle />
                    </ListItemIcon>
                    <ListItemText primary={suggestion} />
                  </ListItem>
                ))}
              </List>
              
              <Divider sx={{ my:  2 }} />
              
              <Stack direction="row" spacing={2}>
                <Chip 
                  label={`Confidence: ${Math.round(selectedSuggestion.confidence * 10)}%`}
                  color="primary"
                  variant="outlined"
                />
                <Chip 
                  label={`Impact: ${selectedSuggestion.impact}`}
                  color={getImpactColor(selectedSuggestion.impact)}
                  variant="outlined"
                />
                <Chip 
                  label={`Category: ${selectedSuggestion.category}`}
                  color="default"
                  variant="outlined"
                />
              </Stack>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>
            Close
          </Button>
          {selectedSuggestion && (
            <Button variant="contained"
              startIcon={<CREATOR_HUB_ICONS.checkCircle sx={theming.getThemedButtonSx()} />}
              onClick={() => {
                if (selectedSuggestion.type === 'interactive') {
                  handleGenerateInteractive(selectedSuggestion);
              } else {
                  handleApplySuggestion(selectedSuggestion);
              }
                setShowDetails(false);
            }}
            >
              {selectedSuggestion.type === 'interactive' ? 'Generate' : 'Apply'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AIContentAnalyzer;

