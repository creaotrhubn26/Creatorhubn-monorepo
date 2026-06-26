/**
 * Code Explainer Panel
 * 
 * Features:
 * - Simple explanations of what needs to be fixed
 * - "Fix this → Solves that" cause-and-effect explanations
 * - Dependency chain visualization ("This needs to work so that X can work")
 * - Code concept library for learning
 * -"Why we need this file" explanations
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Grid,
  Alert,
  AlertTitle,
  Paper,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  School as LearnIcon,
  AccountTree as DependencyIcon,
  Lightbulb as IdeaIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandIcon,
  Search as SearchIcon,
  Code as CodeIcon,
  Build as BuildIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';
import { AdminButton } from './design-system';

export const CodeExplainerPanel: React.FC<{ file?: string; errors?: any[] }> = ({ 
  file: initialFile, 
  errors: initialErrors = [] 
}) => {
  const theming = useTheming('prototype_tester');
  const { componentRegistry, analytics } = useEnhancedMasterIntegration();
  
  const [file, setFile] = useState(initialFile || ',');
  const [errorExplanations, setErrorExplanations] = useState<any[]>([]);
  const [dependencyAnalysis, setDependencyAnalysis] = useState<any>(null);
  const [fileExplanation, setFileExplanation] = useState<string>(', ');
  const [concepts, setConcepts] = useState<any[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Register component
  React.useEffect(() => {
    componentRegistry.registerComponent({
      id: 'code-explainer-panel',
      type: 'admin',
      version: '1.0.0',
      capabilities: {
        data: ['explain','analyze'],
        events: ['explanation-requested'],
        actions: ['explain'],
        ui: ['panel'],
        system: ['education']
    },
      dependencies: ['openai-api'],
      lastActive: Date.now(),
      performance: { renderCount: 0, avgRenderTime: 0, memoryUsage: 0 }
  } as any);

    return () => componentRegistry.unregisterComponent('code-explainer-panel');
}, [componentRegistry]);

  // Load all concepts
  React.useEffect(() => {
    loadConcepts();
}, []);

  // Load concepts from backend
  const loadConcepts = async () => {
    try {
      const response = await apiRequest('/api/admin/explainer/concepts');
      if (response.success) {
        setConcepts(response.concepts);
    }
  } catch (error) {
      console.error('Failed to load concepts: ', error);
  }
};

  // Explain errors
  const handleExplainErrors = async () => {
    if (!file || initialErrors.length === 0) return;

    setIsLoading(true);
    analytics.trackEvent('error_explanation_requested', { file, errorCount: initialErrors.length });

    try {
      const response = await apiRequest('/api/admin/explainer/errors', {
        method: 'POST',
        body: JSON.stringify({ file, errors: initialErrors }),
    });

      if (response.success) {
        setErrorExplanations(response.explanations);
    }
  } catch (error) {
      console.error('Failed to explain errors:', error);
  } finally {
      setIsLoading(false);
  }
};

  // Analyze dependencies
  const handleAnalyzeDependencies = async () => {
    if (!file) return;

    setIsLoading(true);
    analytics.trackEvent('dependency_analysis_requested', { file });

    try {
      const response = await apiRequest(`/api/admin/explainer/dependencies/${file}`);

      if (response.success) {
        setDependencyAnalysis(response.analysis);
    }
  } catch (error) {
      console.error('Failed to analyze dependencies:', error);
  } finally {
      setIsLoading(false);
  }
};

  // Explain file
  const handleExplainFile = async () => {
    if (!file) return;

    setIsLoading(true);
    analytics.trackEvent('file_explanation_requested', { file });

    try {
      const response = await apiRequest(`/api/admin/explainer/file/${file}`);

      if (response.success) {
        setFileExplanation(response.explanation);
    }
  } catch (error) {
      console.error('Failed to explain file:', error);
  } finally {
      setIsLoading(false);
  }
};

  // Search concepts
  const filteredConcepts = searchQuery
    ? concepts.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.simpleDefinition.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : concepts;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LearnIcon sx={{ fontSize: 40, color: theming.colors.primary }} />
          Code Explainer & Learning Center
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Understand what needs to be fixed, why it matters, and what depends on it
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Error Explanations" icon={<ErrorIcon />} iconPosition="start" />
        <Tab label="Dependencies" icon={<DependencyIcon />} iconPosition="start" />
        <Tab label="File Explanation" icon={<IdeaIcon />} iconPosition="start" />
        <Tab label="Concept Library" icon={<LearnIcon />} iconPosition="start" />
      </Tabs>

      {/* Tab 1: Error Explanations */}
      {activeTab === 0 && (
        <Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>💡 How This Works</AlertTitle>
            <Typography variant="body2">
              Get simple explanations of linting errors:
            </Typography>
            <Box component="ul" sx={{ mt: 1, mb: 0 }}>
              <li><strong>What's wrong:</strong> Simple explanation in plain English</li>
              <li><strong>Why it matters:</strong> Impact on your code</li>
              <li><strong>What it solves:</strong> Benefits of fixing this</li>
              <li><strong>What depends on this:</strong> What breaks if not fixed</li>
              <li><strong>How to fix:</strong> Step-by-step with examples</li>
            </Box>
          </Alert>

          {initialErrors.length > 0 && (
            <AdminButton
              tone="primary"
              onClick={handleExplainErrors}
              loading={isLoading}
              startIcon={<LearnIcon />}
              sx={{ mb: 3 }}
            >
              Explain {initialErrors.length} Errors
            </AdminButton>
          )}

          {/* Error Explanations */}
          {errorExplanations.map((explanation, idx) => (
            <Accordion key={idx}>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <ErrorIcon color="error" />
                  <Typography>
                    Line {explanation.error.line}: {explanation.simpleExplanation.slice(0, 60)}...
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  {/* Simple Explanation */}
                  <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.light' }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.contrastText' }}>
                      <ErrorIcon /> What's Wrong
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'error.contrastText' }}>
                      {explanation.simpleExplanation}
                    </Typography>
                  </Paper>

                  {/* Why It Matters */}
                  <Paper sx={{ p: 2, mb: 2, bgcolor: 'warning.light' }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.contrastText' }}>
                      <WarningIcon /> Why This Matters
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'warning.contrastText' }}>
                      {explanation.whyItMatters}
                    </Typography>
                  </Paper>

                  {/* What It Solves */}
                  <Paper sx={{ p: 2, mb: 2, bgcolor: 'success.light' }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.contrastText' }}>
                      <SuccessIcon /> Fixing This Will Solve:
                    </Typography>
                    <List dense>
                      {explanation.whatItSolves.map((solution: string, i: number) => (
                        <ListItem key={i}>
                          <ListItemText 
                            primary={solution}
                            primaryTypographyProps={{ sx: { color: 'success.contrastText' } }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>

                  {/* What Depends on This */}
                  <Paper sx={{ p: 2, mb: 2, bgcolor: 'info.light' }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'info.contrastText' }}>
                      <DependencyIcon /> What Depends on This Fix:
                    </Typography>
                    <List dense>
                      {explanation.whatDependsOnThis.map((dep: string, i: number) => (
                        <ListItem key={i}>
                          <ListItemText 
                            primary={dep}
                            primaryTypographyProps={{ sx: { color: 'info.contrastText' } }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>

                  {/* How to Fix */}
                  <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BuildIcon /> How to Fix ({explanation.howToFix.difficulty})
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      {explanation.howToFix.description}
                    </Typography>
                    {explanation.howToFix.example && (
                      <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'white', mt: 2 }}>
                        <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          {explanation.howToFix.example}
                        </Typography>
                      </Paper>
                    )}
                  </Paper>

                  {/* Related Concepts */}
                  {explanation.relatedConcepts && explanation.relatedConcepts.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        📚 Learn More:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {explanation.relatedConcepts.map((conceptId: string, i: number) => (
                          <Chip
                            key={i}
                            label={conceptId}
                            size="small"
                            onClick={() => {
                              setActiveTab(3);
                              setSearchQuery(conceptId);
                          }}
                            sx={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Tab 2: Dependencies */}
      {activeTab === 1 && (
        <Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>🔗 Dependency Analysis</AlertTitle>
            <Typography variant="body2">
              Understand how files depend on each other:
            </Typography>
            <Box component="ul" sx={{ mt: 1, mb: 0 }}>
              <li><strong>Direct Dependencies:</strong> Files THIS file needs to work</li>
              <li><strong>Dependent Files:</strong> Files that need THIS file to work</li>
              <li><strong>Impact Radius:</strong> How far changes propagate</li>
              <li><strong>Criticality Score:</strong> How important this file is (0-100)</li>
            </Box>
          </Alert>

          <TextField
            fullWidth
            value={file}
            onChange={(e) => setFile(e.target.value)}
            placeholder="Enter file path (e.g., client/src/components/OpenAIChat.tsx)"
            sx={{ mb: 2 }}
          />

          <AdminButton
            tone="primary"
            onClick={handleAnalyzeDependencies}
            disabled={!file}
            loading={isLoading}
            startIcon={<DependencyIcon />}
          >
            Analyze Dependencies
          </AdminButton>

          {dependencyAnalysis && (
            <Box sx={{ mt: 3 }}>
              {/* Criticality Score */}
              <Card sx={{ mb: 3, borderLeft: 4, borderColor: 
                dependencyAnalysis.criticalityScore > 80 ? 'error.main' :
                dependencyAnalysis.criticalityScore > 50 ? 'warning.main' : 'success.main'
            }}>
                <CardContent>
                  <Typography variant="h5" gutterBottom>
                    Criticality Score: {dependencyAnalysis.criticalityScore}/100
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {dependencyAnalysis.criticalityScore > 80 && 
                      '🔴 HIGH - Many files depend on this! Fix errors here first.'}
                    {dependencyAnalysis.criticalityScore > 50 && dependencyAnalysis.criticalityScore <= 80 && 
                      '🟡 MEDIUM - Some files depend on this.'}
                    {dependencyAnalysis.criticalityScore <= 50 && 
                      '🟢 LOW - Few dependencies, safe to modify.'}
                  </Typography>
                </CardContent>
              </Card>

              {/* What This File Needs */}
              <Card sx={{ mb: 3 }}>
                <CardHeader
                  title={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BuildIcon />
                      What This File Needs to Work
                    </Box>
                }
                  subheader={`${dependencyAnalysis.directDependencies.length} dependencies`}
                />
                <CardContent>
                  {dependencyAnalysis.directDependencies.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      ✅ This file is self-contained - no dependencies!
                    </Typography>
                  ) : (
                    <List>
                      {dependencyAnalysis.directDependencies.map((dep: any, idx: number) => (
                        <ListItem key={idx}>
                          <ListItemIcon>
                            <CodeIcon color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={dep.file}
                            secondary={`${dep.type}: ${dep.reason}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                  
                  {dependencyAnalysis.directDependencies.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        ⚠️ <strong>Important:</strong> If ANY of these files are broken, THIS file won't work!
                      </Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* What Needs This File */}
              <Card sx={{ mb: 3 }}>
                <CardHeader
                  title={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DependencyIcon />
                      What Needs This File to Work
                    </Box>
                }
                  subheader={`${dependencyAnalysis.dependentFiles.length} dependent files`}
                />
                <CardContent>
                  {dependencyAnalysis.dependentFiles.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      ℹ️ No other files depend on this - it's a leaf node.
                    </Typography>
                  ) : (
                    <List>
                      {dependencyAnalysis.dependentFiles.map((dep: any, idx: number) => (
                        <ListItem key={idx}>
                          <ListItemIcon>
                            <WarningIcon color="warning" />
                          </ListItemIcon>
                          <ListItemText
                            primary={dep.file}
                            secondary={`${dep.type}: ${dep.reason}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                  
                  {dependencyAnalysis.dependentFiles.length > 0 && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        🔴 <strong>Critical:</strong> If THIS file is broken, ALL {dependencyAnalysis.dependentFiles.length} of these files will break too!
                      </Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Impact Radius */}
              <Card>
                <CardHeader
                  title={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SecurityIcon />
                      Impact Radius
                    </Box>
                }
                  subheader="How far do changes in this file propagate?"
                />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Paper sx={{ p: 2, bgcolor: 'error.light' }}>
                        <Typography variant="subtitle2" sx={{ color: 'error.contrastText' }}>
                          🎯 Immediate Impact
                        </Typography>
                        <Typography variant="h4" sx={{ color: 'error.contrastText' }}>
                          {dependencyAnalysis.impactRadius.immediate.length}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'error.contrastText' }}>
                          files directly affected
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Paper sx={{ p: 2, bgcolor: 'warning.light' }}>
                        <Typography variant="subtitle2" sx={{ color: 'warning.contrastText' }}>
                          📡 Secondary Impact
                        </Typography>
                        <Typography variant="h4" sx={{ color: 'warning.contrastText' }}>
                          {dependencyAnalysis.impactRadius.secondary.length}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'warning.contrastText' }}>
                          files indirectly affected
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Paper sx={{ p: 2, bgcolor: 'info.light' }}>
                        <Typography variant="subtitle2" sx={{ color: 'info.contrastText' }}>
                          🌊 Tertiary Impact
                        </Typography>
                        <Typography variant="h4" sx={{ color: 'info.contrastText' }}>
                          {dependencyAnalysis.impactRadius.tertiary.length}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'info.contrastText' }}>
                          files in ripple effect
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      💡 <strong>What This Means:</strong> Changes in this file can affect up to{', '}
                      {dependencyAnalysis.impactRadius.immediate.length + 
                       dependencyAnalysis.impactRadius.secondary.length + 
                       dependencyAnalysis.impactRadius.tertiary.length} other files!
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
      )}

      {/* Tab 3: File Explanation */}
      {activeTab === 2 && (
        <Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>📚 File Explanation</AlertTitle>
            <Typography variant="body2">
              Get a complete explanation of what a file does and how it fits in the codebase.
            </Typography>
          </Alert>

          <TextField
            fullWidth
            value={file}
            onChange={(e) => setFile(e.target.value)}
            placeholder="Enter file path"
            sx={{ mb: 2 }}
          />

          <AdminButton
            tone="primary"
            onClick={handleExplainFile}
            disabled={!file}
            loading={isLoading}
            startIcon={<IdeaIcon />}
          >
            Explain This File
          </AdminButton>

          {fileExplanation && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography 
                component="pre" 
                sx={{ 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  fontSize: '0.95rem'
              }}
              >
                {fileExplanation}
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Tab 4: Concept Library */}
      {activeTab === 3 && (
        <Box>
          <Alert severity="success" sx={{ mb: 3 }}>
            <AlertTitle>📚 Code Concept Library</AlertTitle>
            <Typography variant="body2">
              Learn about TypeScript, React, Material-UI, and CreatorHub patterns.
              Each concept includes: definition, why we use it, examples, and common mistakes.
            </Typography>
          </Alert>

          <TextField
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search concepts (e.g., hooks, types, material-ui)"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )}}
            sx={{ mb: 3 }}
          />

          <Grid container spacing={2}>
            {filteredConcepts.map((concept) => (
              <Grid item xs={12} md={6} key={concept.id}>
                <Card 
                  sx={{ 
                    cursor: 'pointer','&:hover': { boxShadow: 4 }
                }}
                  onClick={() => setSelectedConcept(concept)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Chip 
                        label={concept.category} 
                        size="small" 
                        color="primary" 
                      />
                      <Typography variant="h6">
                        {concept.name}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {concept.simpleDefinition}
                    </Typography>
                    
                    {concept.usedIn && concept.usedIn.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Used in: {concept.usedIn.slice(0, 2).join(', ')}
                          {concept.usedIn.length > 2 && ` +${concept.usedIn.length - 2} more`}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Concept Detail Modal */}
          {selectedConcept && (
            <Card sx={{ mt: 3 }}>
              <CardHeader
                title={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LearnIcon />
                    {selectedConcept.name}
                    <Chip label={selectedConcept.category} size="small" sx={{ ml: 1 }} />
                  </Box>
              }
                action={
                  <AdminButton tone="ghost" size="small" onClick={() => setSelectedConcept(null)}>
                    Close
                  </AdminButton>
              }
              />
              <CardContent>
                {/* Simple Definition */}
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.light' }}>
                  <Typography variant="h6" sx={{ color: 'primary.contrastText' }}>
                    📖 Simple Definition
                  </Typography>
                  <Typography sx={{ color: 'primary.contrastText' }}>
                    {selectedConcept.simpleDefinition}
                  </Typography>
                </Paper>

                {/* Detailed Explanation */}
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    📚 Detailed Explanation
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedConcept.detailedExplanation}
                  </Typography>
                </Paper>

                {/* Why We Use It */}
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'success.light' }}>
                  <Typography variant="h6" sx={{ color: 'success.contrastText' }}>
                    ✅ Why We Use It in CreatorHub
                  </Typography>
                  <Typography sx={{ color: 'success.contrastText' }}>
                    {selectedConcept.whyWeUseIt}
                  </Typography>
                </Paper>

                {/* Common Mistakes */}
                {selectedConcept.commonMistakes && selectedConcept.commonMistakes.length > 0 && (
                  <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.light' }}>
                    <Typography variant="h6" sx={{ color: 'error.contrastText' }}>
                      ⚠️ Common Mistakes to Avoid
                    </Typography>
                    <List dense>
                      {selectedConcept.commonMistakes.map((mistake: string, idx: number) => (
                        <ListItem key={idx}>
                          <ListItemText 
                            primary={mistake}
                            primaryTypographyProps={{ sx: { color: 'error.contrastText' } }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}

                {/* Examples */}
                {selectedConcept.examples && selectedConcept.examples.length > 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      💡 Examples
                    </Typography>
                    {selectedConcept.examples.map((example: any, idx: number) => (
                      <Accordion key={idx}>
                        <AccordionSummary expandIcon={<ExpandIcon />}>
                          <Typography>{example.title}</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Typography variant="body2" gutterBottom>
                            {example.explanation}
                          </Typography>
                          <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'white', mt: 2 }}>
                            <Typography component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                              {example.code}
                            </Typography>
                          </Paper>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </Box>
                )}

                {/* Where It's Used */}
                {selectedConcept.usedIn && selectedConcept.usedIn.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      📍 Used In:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {selectedConcept.usedIn.map((location: string, idx: number) => (
                        <Chip key={idx} label={location} size="small" />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Related Concepts */}
                {selectedConcept.relatedConcepts && selectedConcept.relatedConcepts.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      🔗 Related Concepts:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {selectedConcept.relatedConcepts.map((conceptId: string, idx: number) => (
                        <Chip
                          key={idx}
                          label={conceptId}
                          size="small"
                          color="secondary"
                          onClick={() => {
                            const related = concepts.find(c => c.id === conceptId);
                            if (related) setSelectedConcept(related);
                        }}
                          sx={{ cursor:'pointer' }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
};

export default CodeExplainerPanel;

