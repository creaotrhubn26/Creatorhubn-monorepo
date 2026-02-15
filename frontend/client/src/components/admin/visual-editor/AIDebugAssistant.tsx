/**
 * AI Debug Assistant
 * AI-powered error analysis, debugging suggestions, and automated fixes
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Chip,
  Alert,
  Stack,
  IconButton,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Tab,
  Tabs,
  Tooltip,
} from '@mui/material';
import {
  BugReport,
  AutoFixHigh,
  Psychology,
  Warning,
  Error as ErrorIcon,
  CheckCircle,
  Code,
  Lightbulb,
  Search,
  Close,
  ExpandMore,
  ContentCopy,
  PlayArrow,
  Security,
  Speed,
} from '@mui/icons-material';
import { AIContext } from './AICodeCompletionSystem';

export interface DebugIssue {
  id: string;
  type: 'error' | 'warning' | 'performance' | 'security' | 'best-practice';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  location: { line: number; column: number; file?: string };
  stackTrace?: string;
  affectedCode: string;
  suggestedFixes: DebugFix[];
  relatedIssues?: string[];
  learnMoreUrl?: string;
}

export interface DebugFix {
  id: string;
  title: string;
  description: string;
  confidence: number;
  fixedCode: string;
  explanation: string;
  pros: string[];
  cons: string[];
  breakingChanges: boolean;
}

interface AIDebugAssistantProps {
  open: boolean;
  onClose: () => void;
  currentCode: string;
  language: string;
  errors?: Array<{ message: string; line?: number; column?: number }>;
  onApplyFix: (code: string) => void;
  onGetAIAnalysis: (context: AIContext) => Promise<unknown>;
}

export default function AIDebugAssistant({
  open,
  onClose,
  currentCode,
  language,
  errors = [],
  onApplyFix,
  onGetAIAnalysis,
}: AIDebugAssistantProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [issues, setIssues] = useState<DebugIssue[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<DebugIssue | null>(null);
  const [customErrorInput, setCustomErrorInput] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<unknown>(null);

  useEffect(() => {
    if (open && errors.length > 0) {
      analyzeErrors();
    }
  }, [open, errors]);

  const analyzeErrors = useCallback(async () => {
    setIsAnalyzing(true);

    try {
      const context: AIContext = {
        currentCode,
        language,
        cursor: { line: 0, column: 0 },
      };

      // Get AI analysis
      const analysis = await onGetAIAnalysis(context);

      // Convert to debug issues
      const detectedIssues: DebugIssue[] = errors.map((error, index) => ({
        id: `issue-${Date.now()}-${index}`,
        type: 'error',
        severity: 'high',
        title: error.message,
        description: `Error detected at line ${error.line || 'unknown'}`,
        location: {
          line: error.line || 0,
          column: error.column || 0,
        },
        affectedCode: extractCodeSnippet(currentCode, error.line || 0),
        suggestedFixes: generateSuggestedFixes(error, currentCode),
        relatedIssues: [],
      }));

      // Add AI-detected issues
      if (analysis?.issues) {
        detectedIssues.push(...analysis.issues);
      }

      setIssues(detectedIssues);
      if (detectedIssues.length > 0) {
        setSelectedIssue(detectedIssues[0]);
      }

      setAnalysisResult(analysis);
    } catch (error) {
      console.error('Analysis failed: ', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [currentCode, language, errors, onGetAIAnalysis]);

  const runSmartDebug = useCallback(async () => {
    setIsAnalyzing(true);
    setActiveStep(0);

    const steps = [
      'Analyzing code structure','Detecting errors and warnings','Checking performance issues','Scanning for security vulnerabilities', 'Generating fix suggestions',
    ];

    // Simulate progressive analysis
    for (let i = 0; i < steps.length; i++) {
      setActiveStep(i);
      await new Promise((resolve) => setTimeout(resolve, 800);
    }

    await analyzeErrors();
    setActiveStep(steps.length);
  }, [analyzeErrors]);

  const analyzeCustomError = useCallback(async () => {
    if (!customErrorInput.trim() return;

    setIsAnalyzing(true);

    try {
      const context: AIContext = {
        currentCode,
        language,
        cursor: { line: 0, column: 0 },
        selectedText: customErrorInput,
      };

      const analysis = await onGetAIAnalysis(context);

      const customIssue: DebugIssue = {
        id: `custom-${Date.now()}`,
        type: 'error',
        severity: 'high',
        title: 'Custom Error Analysis',
        description: customErrorInput,
        location: { line: 0, column: 0 },
        affectedCode: currentCode.split('\n, ').slice(0, 10).join('\n'),
        suggestedFixes: analysis?.fixes || [],
        relatedIssues: [],
      };

      setIssues([customIssue, ...issues]);
      setSelectedIssue(customIssue);
      setCustomErrorInput(', ');
    } catch (error) {
      console.error('Custom analysis failed: ', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [customErrorInput, currentCode, language, issues, onGetAIAnalysis]);

  const handleApplyFix = useCallback(
    (fix: DebugFix) => {
      onApplyFix(fix.fixedCode);

      // Remove or mark issue as fixed
      setIssues((prev) => prev.filter((i) => i.id !== selectedIssue?.id));
      setSelectedIssue(null);
    },
    [selectedIssue, onApplyFix],
  );

  if (!open) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        right: 16,
        top: 80,
        width: 500,
        maxHeight: 'calc(100vh - 100px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 140,
        borderRadius: 2,
        overflow: 'hidden'}}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: 'error.main',
          color: 'white'}}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugReport />
          <Typography variant="h6" fontWeight={600}>
            AI Debug Assistant
          </Typography>
          {issues.length > 0 && (
            <Chip
              label={`${issues.length} issues`}
              size="small"
              sx={{ bgcolor: 'rgba(2, 5, 5,255,255,0.2)', color: 'white' }} />
          )}
        </Box>
        <IconButton size="small" onClick={onClose}, sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<BugReport fontSize="small" />} label="Issues" />
        <Tab icon={<Psychology fontSize="small" />} label="Analyze" />
        <Tab icon={<AutoFixHigh fontSize="small" />} label="Auto-Fix" />
      </Tabs>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* Tab 1: Issues List */}
        {activeTab === 0 && (
          <Stack spacing={2}>
            {issues.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Issues Found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Your code looks good! Run Smart Debug for deeper analysis.
                </Typography>
              </Box>
            ) : (
              issues.map((issue) => (
                <Card
                  key={issue.id}
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    border: selectedIssue?.id === issue.id ? 2 : 1,
                    borderColor: selectedIssue?.id === issue.id ? 'primary.main' : 'divider'}}
                  onClick={() => setSelectedIssue(issue)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                      {getIssueIcon(issue.type)}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {issue.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Line {issue.location.line}:{issue.location.column}
                        </Typography>
                      </Box>
                      <Chip
                        label={issue.severity}
                        size="small"
                        color={getSeverityColor(issue.severity)}
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {issue.description}
                    </Typography>

                    {issue.affectedCode && (
                      <Box
                        component="pre"
                        sx={{
                          bgcolor: '#1E1E1E',
                          color: '#D4D4D4',
                          p: 1,
                          borderRadius: 1,
                          fontSize: '11px',
                          overflow: 'auto',
                          maxHeight: 100}}>
                        <code>{issue.affectedCode}</code>
                      </Box>
                    )}

                    <Box sx={{ mt: 1, display: 'flex', gap: 0.5 flexWrap: 'wrap' }}>
                      <Chip
                        label={`${issue.suggestedFixes.length} fixes`}
                        size="small"
                        variant="outlined"
                      />
                      {issue.type && <Chip label={issue.type} size="small" variant="outlined" />}
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Selected Issue Details */}
            {selectedIssue && (
              <Card sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Suggested Fixes ({selectedIssue.suggestedFixes.length})
                  </Typography>

                  {selectedIssue.suggestedFixes.map((fix, index) => (
                    <Accordion key={fix.id} defaultExpanded={index === 0}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                          <Typography variant="body2">{fix.title}</Typography>
                          <Chip
                            label={`${Math.round(fix.confidence * 100)}%`}
                            size="small"
                            color={fix.confidence > 0.8 ? 'success' : 'default'}
                          />
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={1}>
                          <Typography variant="caption">{fix.description}</Typography>

                          <Box
                            component="pre"
                            sx={{
                              bgcolor: '#1E1E1E',
                              color: '#D4D4D4',
                              p: 1,
                              borderRadius: 1,
                              fontSize: '11px',
                              overflow: 'auto',
                              maxHeight: 150}}>
                            <code>{fix.fixedCode}</code>
                          </Box>

                          {fix.pros.length > 0 && (
                            <Box>
                              <Typography variant="caption" fontWeight={600}>
                                Pros: </Typography>
                              <List dense>
                                {fix.pros.map((pro, i) => (
                                  <ListItem key={i} disableGutters>
                                    <ListItemIcon sx={{ minWidth: 30 }}>
                                      <CheckCircle fontSize="small" color="success" />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={pro}
                                      primaryTypographyProps={{ variant: 'caption' }} />
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          )}

                          {fix.cons.length > 0 && (
                            <Box>
                              <Typography variant="caption" fontWeight={600}>
                                Cons: </Typography>
                              <List dense>
                                {fix.cons.map((con, i) => (
                                  <ListItem key={i} disableGutters>
                                    <ListItemIcon sx={{ minWidth: 30 }}>
                                      <Warning fontSize="small" color="warning" />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={con}
                                      primaryTypographyProps={{ variant: 'caption' }} />
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          )}

                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<AutoFixHigh />}
                            onClick={() => handleApplyFix(fix)}
                            fullWidth
                          >
                            Apply This Fix
                          </Button>
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </CardContent>
              </Card>
            )}
          </Stack>
        )}

        {/* Tab 2: Analyze */}
        {activeTab === 1 && (
          <Stack spacing={2}>
            <Alert severity="info" icon={<Psychology />}>
              Run Smart Debug to perform comprehensive code analysis using AI
            </Alert>

            {/* Smart Debug Button */}
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={runSmartDebug}
              disabled={isAnalyzing}
              fullWidth
            >
              {isAnalyzing ? 'Analyzing...' : 'Run Smart Debug'}
            </Button>

            {/* Analysis Progress */}
            {isAnalyzing && (
              <Stepper activeStep={activeStep} orientation="vertical">
                {[
                  'Analyzing code structure', 'Detecting errors and warnings', 'Checking performance issues', 'Scanning for security vulnerabilities', 'Generating fix suggestions',
                ].map((label, index) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                    <StepContent>
                      <CircularProgress size={20} />
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            )}

            <Divider>OR</Divider>

            {/* Custom Error Input */}
            <Typography variant="subtitle2" fontWeight={600}>
              Paste Error Message
            </Typography>
            <TextField
              multiline
              rows={4}
              fullWidth
              placeholder="Paste your error message or stack trace here..."
              value={customErrorInput}
              onChange={(e) => setCustomErrorInput(e.target.value)}
            />
            <Button
              variant="outlined"
              startIcon={<Search />}
              onClick={analyzeCustomError}
              disabled={!customErrorInput.trim() || isAnalyzing}
              fullWidth
            >
              Analyze Error
            </Button>

            {/* Analysis Summary */}
            {analysisResult && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Analysis Summary
                  </Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption">Issues Found:</Typography>
                      <Typography variant="caption" fontWeight={600}>
                        {issues.length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption">Code Quality:</Typography>
                      <Chip label={analysisResult.quality || 'Good'} size="small" color="success" />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption">Complexity:</Typography>
                      <Typography variant="caption">
                        {analysisResult.complexity || 'Medium'}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        )}

        {/* Tab 3: Auto-Fix */}
        {activeTab === 2 && (
          <Stack spacing={2}>
            <Alert severity="warning">
              Auto-fix will attempt to automatically resolve all detected issues. Review changes
              carefully.
            </Alert>

            <Card>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Available Auto-Fixes
                </Typography>
                <Stack spacing={1}>
                  {issues.map((issue) => (
                    <Box
                      key={issue.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        bgcolor: 'background.default',
                        borderRadius: 1}}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getIssueIcon(issue.type)}
                        <Typography variant="caption">{issue.title}</Typography>
                      </Box>
                      <Chip
                        label={`${issue.suggestedFixes.length} fixes`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Button
              variant="contained"
              color="warning"
              startIcon={<AutoFixHigh />}
              disabled={issues.length === 0}
              fullWidth
            >
              Apply All Fixes
            </Button>
          </Stack>
        )}
      </Box>
    </Paper>
  );
}

function extractCodeSnippet(code: string, line: number, context: number = 3): string {
  const lines = code.split('\n');
  const start = Math.max(0, line - context);
  const end = Math.min(lines.length, line + context + 1);
  return lines.slice(start, end).join('\n');
}

function generateSuggestedFixes(
  error: { message: string; line?: number; column?: number },
  code: string,
): DebugFix[] {
  // Simple heuristic fixes - in production, this would be AI-generated
  const fixes: DebugFix[] = [
    {
      id: `fix-${Date.now()}-1`,
      title: 'Quick Fix',
      description: 'AI-suggested fix based on error pattern',
      confidence: 0.85
      fixedCode: code, // Would be modified based on error
      explanation: 'This fix addresses the immediate error',
      pros: ['Resolves the error','Minimal code changes'],
      cons: ['May need manual review'],
      breakingChanges: false,
    },
  ];

  return fixes;
}

function getIssueIcon(type: string) {
  switch (type) {
    case 'error': return <ErrorIcon color="error" fontSize="small" />;
    case 'warning': return <Warning color="warning" fontSize="small" />;
    case 'performance': return <Speed color="info" fontSize="small" />;
    case 'security': return <Security color="error" fontSize="small" />;
    default: return <Lightbulb color="action" fontSize="small" />;
  }
}

function getSeverityColor(severity: string): 'error' | 'warning' | 'info' | 'default' {
  switch (severity) {
    case 'critical': case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return'default';
  }
}
