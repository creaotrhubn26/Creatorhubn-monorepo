/**
 * Linting AI Fix Panel
 * 
 * Features:
 * - Scans codebase for linting errors
 * - Generates AI fix prompts automatically
 * - DRY_RUN mode for safe testing
 * - Batch processing with progress
 * - Visual error analysis
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Button,
  Typography,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  Grid,
  Alert,
  AlertTitle,
  Paper,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  BugReport as BugIcon,
  AutoFixHigh as FixIcon,
  Science as TestIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandIcon,
  Refresh as RefreshIcon,
  PlayArrow as RunIcon,
  School as ExplainIcon,
} from '@mui/icons-material';
import CodeExplainerPanel from './CodeExplainerPanel';
import { useTheming } from '../../utils/theming-helper';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';

export const LintingAIFixPanel: React.FC = () => {
  const theming = useTheming('prototype_tester, ');
  const { componentRegistry, communication, analytics, auth } = useEnhancedMasterIntegration();
  
  const [scanResult, setScanResult] = useState<any>(null);
  const [aiPrompts, setAiPrompts] = useState<any[]>([]);
  const [fixResults, setFixResults] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [dryRunMode, setDryRunMode] = useState(true);
  const [progress, setProgress] = useState<{ current: number; total: number; file: string } | null>(null);
  const [selectedFileForExplanation, setSelectedFileForExplanation] = useState<{ file: string; errors: any[] } | null>(null);

  // Register component
  React.useEffect(() => {
    componentRegistry.registerComponent({
      id: 'linting-ai-fix-panel',
      type: 'admin',
      version: '1.0.0',
      capabilities: {
        data: ['linting'],
        events: ['lint-scan'],
        actions: ['fix'],
        ui: ['panel'],
        system: ['ai-integration']
    },
      dependencies: ['openai-api', 'file-search'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0 }
  } as any);

    return () => {
      componentRegistry.unregisterComponent('linting-ai-fix-panel');
  };
}, [componentRegistry]);

  // Scan codebase
  const handleScan = async () => {
    setIsScanning(true);
    analytics.trackEvent('linting_scan_started', {});

    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/admin/linting/scan', {
        method: 'POST',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paths: ['client/src/**/*.{ts,tsx}'],
          ignoreWarnings: false,
          maxErrors: 5000,
      }),
    });

      if (response.success) {
        setScanResult(response.result);
        analytics.trackEvent('linting_scan_completed', {
          totalErrors: response.result.totalErrors,
          filesWithErrors: response.result.filesWithErrors,
      });

        communication.sendBroadcast('linting:scan:complete', {
          totalErrors: response.result.totalErrors,
      });
    }
  } catch (error: any) {
      console.error('Scan failed: ', error);
  } finally {
      setIsScanning(false);
  }
};

  // Generate AI fix prompts
  const handleGeneratePrompts = async () => {
    if (!scanResult) return;

    setIsGeneratingPrompts(true);
    analytics.trackEvent('ai_prompts_generation_started', {});

    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/admin/linting/generate-prompts', {
        method: 'POST',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scanResult }),
    });

      if (response.success) {
        setAiPrompts(response.prompts);
        analytics.trackEvent('ai_prompts_generated', {
          count: response.prompts.length,
      });
    }
  } catch (error: any) {
      console.error('Prompt generation failed:', error);
  } finally {
      setIsGeneratingPrompts(false);
  }
};

  // Run AI fixes
  const handleRunFixes = async () => {
    if (aiPrompts.length === 0) return;

    setIsFixing(true);
    analytics.trackEvent('ai_fix_started', {
      dryRun: dryRunMode,
      fileCount: aiPrompts.length,
  });

    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/admin/linting/batch-fix', {
        method: 'POST',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompts: aiPrompts,
          dryRun: dryRunMode,
      }),
    });

      if (response.success) {
        setFixResults(response.results);
        analytics.trackEvent('ai_fix_completed', {
          dryRun: dryRunMode,
          successful: response.summary.successful,
          errorsFixed: response.summary.totalErrorsFixed,
      });
        
        communication.sendBroadcast('linting:fix:complete', {
          dryRun: dryRunMode,
          results: response.summary,
      });
    }
  } catch (error: any) {
      console.error('AI fix failed:', error);
  } finally {
      setIsFixing(false);
  }
};

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugIcon sx={{ fontSize: 40, color: theming.colors.primary }} />
          AI-Powered Linting Fixer
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Scan your codebase, generate AI fix prompts, and apply fixes safely with DRY_RUN mode
        </Typography>
      </Box>

      {/* Controls */}
      <Grid container spacing={2}, sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BugIcon color="error" />
                Step 1: Scan
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Scan your codebase for linting errors
              </Typography>
              <Button
                variant="contained"
                fullWidth
                onClick={handleScan}
                disabled={isScanning}
                startIcon={isScanning ? <RefreshIcon /> : <BugIcon />}
                sx={{ mt: 2 }}
              >
                {isScanning ? 'Scanning...' : 'Scan Codebase'}
              </Button>
              {scanResult && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="caption">
                    Found: {scanResult.totalErrors} errors in {scanResult.filesWithErrors} files
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FixIcon color="primary" />
                Step 2: Generate Prompts
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Let AI analyze errors and create fix prompts
              </Typography>
              <Button
                variant="contained"
                fullWidth
                onClick={handleGeneratePrompts}
                disabled={!scanResult || isGeneratingPrompts}
                startIcon={isGeneratingPrompts ? <RefreshIcon /> : <FixIcon />}
                sx={{ mt: 2 }}
              >
                {isGeneratingPrompts ? 'Generating...' : 'Generate AI Prompts'}
              </Button>
              {aiPrompts.length > 0 && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="caption">
                    Generated: {aiPrompts.length} AI fix prompts
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TestIcon color="secondary" />
                Step 3: Apply Fixes
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Test with DRY_RUN, then EXECUTE
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={dryRunMode}
                    onChange={(e) => setDryRunMode(e.target.checked)}
                    color="warning"
                  />
              }
                label={
                  <Box>
                    <Typography variant="body2">
                      {dryRunMode ? '🔍 DRY RUN' : '🔧 EXECUTE'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {dryRunMode ? 'Safe testing mode' : 'Will modify files!'}
                    </Typography>
                  </Box>
              }
                sx={{ mt: 1, mb: 1 }}
              />

              <Button
                variant="contained"
                fullWidth
                onClick={handleRunFixes}
                disabled={aiPrompts.length === 0 || isFixing}
                startIcon={isFixing ? <RefreshIcon /> : <RunIcon />}
                color={dryRunMode ? 'secondary' : 'error'}
              >
                {isFixing ? 'Fixing...' : dryRunMode ? 'Test Fixes (DRY RUN)' : 'Apply Fixes (EXECUTE)'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Progress */}
      {progress && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            Processing: {progress.file} ({progress.current}/{progress.total})
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={(progress.current / progress.total) * 100} 
          />
        </Paper>
      )}

      {/* Scan Results */}
      {scanResult && (
        <Card sx={{ mb: 3 }}>
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BugIcon />
                Scan Results
              </Box>
          }
          />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light' }}>
                  <Typography variant="h3" sx={{ color: 'error.contrastText' }}>
                    {scanResult.totalErrors}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'error.contrastText' }}>
                    Errors
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
                  <Typography variant="h3" sx={{ color: 'warning.contrastText' }}>
                    {scanResult.totalWarnings}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'warning.contrastText' }}>
                    Warnings
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light' }}>
                  <Typography variant="h3" sx={{ color: 'info.contrastText' }}>
                    {scanResult.filesWithErrors}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'info.contrastText' }}>
                    Files
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                  <Typography variant="h3" sx={{ color: 'success.contrastText' }}>
                    {scanResult.totalFiles}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'success.contrastText' }}>
                    Scanned
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Top Error Rules */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Most Common Errors
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Rule</TableCell>
                      <TableCell align="right">Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(scanResult.errorsByRule || {})
                      .sort(([, a][b]) => (b as number) - (a as number))
                      .slice(0, 10)
                      .map(([rule, count]) => (
                        <TableRow key={rule}>
                          <TableCell>
                            <Chip label={rule} size="small" />
                          </TableCell>
                          <TableCell align="right">{count as number}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Files with Most Errors */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Files with Most Errors
              </Typography>
              {Object.entries(scanResult.errorsByFile || {})
                .sort(([, a][b]) => (b as any[]).length - (a as any[]).length)
                .slice(0, 10)
                .map(([file, errors]) => (
                  <Accordion key={file}>
                    <AccordionSummary expandIcon={<ExpandIcon />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <ErrorIcon color="error" />
                        <Typography sx={{ flex: 1 }}>{file}</Typography>
                        <Chip 
                          label={`${(errors as any[]).length} errors`} 
                          size="small" 
                          color="error" 
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {(errors as any[]).slice(0, 10).map((error, idx) => (
                          <ListItem key={idx}>
                            <ListItemText
                              primary={`Line ${error.line}: ${error.message}`}
                              secondary={error.rule}
                              primaryTypographyProps={{ variant: 'body2' }}
                              secondaryTypographyProps={{ variant: 'caption' }}
                            />
                          </ListItem>
                        ))}
                        {(errors as any[]).length > 10 && (
                          <ListItem>
                            <ListItemText
                              secondary={`... and ${(errors as any[]).length - 10} more errors`}
                            />
                          </ListItem>
                        )}
                        <ListItem sx={{ mt: 2 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ExplainIcon />}
                            onClick={() => setSelectedFileForExplanation({ file, errors: errors as any[] })}
                            fullWidth
                          >
                            📚 Explain These Errors (Simple Terms + Dependencies)
                          </Button>
                        </ListItem>
                      </List>
                    </AccordionDetails>
                  </Accordion>
                ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* AI Prompts */}
      {aiPrompts.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FixIcon />
                AI Fix Prompts ({aiPrompts.length})
              </Box>
          }
          />
          <CardContent>
            <Alert severity="success" sx={{ mb: 2 }}>
              <AlertTitle>✅ Prompts Generated!</AlertTitle>
              <Typography variant="body2">
                AI has analyzed {aiPrompts.length} files and generated intelligent fix prompts.
                Each prompt includes:
              </Typography>
              <Box component="ul" sx={{ mt: 1, mb: 0 }}>
                <li>File content</li>
                <li>All linting errors with line numbers</li>
                <li>Import analysis</li>
                <li>Related files</li>
                <li>Project-specific fixing instructions</li>
              </Box>
            </Alert>

            {aiPrompts.slice(0, 5).map((prompt, idx) => (
              <Accordion key={idx}>
                <AccordionSummary expandIcon={<ExpandIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FixIcon color="primary" />
                    <Typography>{prompt.file}</Typography>
                    <Chip label={`${prompt.errors.length} errors`} size="small" />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Paper sx={{ p: 2, bgcolor: 'grey.100', maxHeight: 300, overflow: 'auto' }}>
                    <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                      {prompt.prompt}
                    </Typography>
                  </Paper>
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Fix Results */}
      {fixResults.length > 0 && (
        <Card>
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SuccessIcon color="success" />
                Fix Results {fixResults[0]?.dryRun ? '(DRY RUN)' : '(EXECUTED)'}
              </Box>
          }
          />
          <CardContent>
            {fixResults[0]?.dryRun && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <AlertTitle>🔍 DRY RUN Mode</AlertTitle>
                <Typography variant="body2">
                  No files were modified. Results show what WOULD happen.
                  Turn off DRY_RUN to apply changes.
                </Typography>
              </Alert>
            )}

            {!fixResults[0]?.dryRun && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <AlertTitle>✅ Changes Applied!</AlertTitle>
                <Typography variant="body2">
                  Files have been modified. Backups created for all changed files.
                </Typography>
              </Alert>
            )}

            <Grid container spacing={2}, sx={{ mb: 3 }}>
              <Grid item xs={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                  <Typography variant="h4" sx={{ color: 'success.contrastText' }}>
                    {fixResults.filter(r => r.status === 'success').length}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'success.contrastText' }}>
                    Successful
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light' }}>
                  <Typography variant="h4" sx={{ color: 'error.contrastText' }}>
                    {fixResults.filter(r => r.status === 'failed').length}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'error.contrastText' }}>
                    Failed
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light' }}>
                  <Typography variant="h4" sx={{ color: 'primary.contrastText' }}>
                    {fixResults.reduce((sum, r) => sum + r.fixedErrors, 0)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'primary.contrastText' }}>
                    Errors Fixed
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
                  <Typography variant="h4" sx={{ color: 'warning.contrastText' }}>
                    {fixResults.reduce((sum, r) => sum + r.remainingErrors, 0)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'warning.contrastText' }}>
                    Remaining
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>File</TableCell>
                    <TableCell align="right">Original</TableCell>
                    <TableCell align="right">Fixed</TableCell>
                    <TableCell align="right">Remaining</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fixResults.map((result, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Typography variant="caption">{result.file}</Typography>
                      </TableCell>
                      <TableCell align="right">{result.originalErrors}</TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={result.fixedErrors} 
                          size="small" 
                          color="success" 
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={result.remainingErrors} 
                          size="small" 
                          color={result.remainingErrors === 0 ? 'success' : 'warning'} 
                        />
                      </TableCell>
                      <TableCell>
                        {result.status === 'success' ? (
                          <SuccessIcon color="success" fontSize="small" />
                        ) : (
                          <ErrorIcon color="error" fontSize="small" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Code Explainer Modal */}
      {selectedFileForExplanation && (
        <Card sx={{ mt: 3, border: 3, borderColor: 'primary.main' }}>
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems:'center', gap: 1 }}>
                <ExplainIcon />
                Understanding Errors in {selectedFileForExplanation.file}
              </Box>
          }
            action={
              <Button onClick={() => setSelectedFileForExplanation(null)}>
                Close
              </Button>
          }
          />
          <CardContent>
            <CodeExplainerPanel
              file={selectedFileForExplanation.file}
              errors={selectedFileForExplanation.errors}
            />
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default LintingAIFixPanel;

