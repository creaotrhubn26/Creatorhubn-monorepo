/**
 * Automated Test Case Generator
 * - Generate test scenarios for professions
 * - AI-powered test case creation
 * - Coverage analysis
 * - Test execution tracking
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Divider,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ThemeProvider,
  Button,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  AutoAwesome,
  PlayArrow,
  Stop,
  Refresh,
  CheckCircle,
  ErrorOutline,
  ExpandMore,
  Science,
  ContentCopy,
  Download,
  Upload,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '@/utils/theming-helper';
import { AdminCard, AdminButton, StatusChip } from './design-system';

interface TestCase {
  id: string;
  title: string;
  description: string;
  profession: string;
  feature: string;
  steps: string[];
  expectedResult: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'passed' | 'failed';
  automated: boolean;
  assignedTester?: string;
}

interface TestSuite {
  id: string;
  profession: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  coverage: number;
  lastRun: string;
}

export default function AutomatedTestCaseGenerator() {
  const queryClient = useQueryClient();
  const theming = useTheming('prototype_tester');

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  const [selectedProfession, setSelectedProfession] = useState<string>('photographer');
  const [generating, setGenerating] = useState(false);
  const [showTestCaseDialog, setShowTestCaseDialog] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);

  // Fetch professions for test generation
  const { data: professions } = useQuery({
    queryKey: ['/api/professions/all'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/professions/all', { headers });
    },
  });

  // Fetch test suites
  const { data: testSuites = [] } = useQuery({
    queryKey: ['/api/admin/test-suites'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/test-suites', { headers });
    },
    staleTime: 60000,
  });

  // Fetch test cases for selected profession
  const { data: testCases = [] } = useQuery({
    queryKey: ['/api/admin/test-cases', selectedProfession],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/test-cases?profession=${selectedProfession}`, { headers });
    },
    enabled: !!selectedProfession,
  });

  // Generate test cases mutation
  const generateTestsMutation = useMutation({
    mutationFn: async (profession: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/generate-test-cases', {
        headers,
        method: 'POST',
        body: JSON.stringify({ profession })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/test-cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/test-suites'] });
    }
  });

  const handleGenerateTests = () => {
    setGenerating(true);
    generateTestsMutation.mutate(selectedProfession);
    setTimeout(() => setGenerating(false), 3000); // Simulated generation time
  };

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <AutoAwesome sx={{ fontSize: 32, color: '#ce93d8' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600}}>
              Automated Test Case Generator
            </Typography>
            <Typography variant="body2" color="text.secondary">
              AI-powered test scenario generation for comprehensive testing
            </Typography>
          </Box>
        </Stack>
        
        <IconButton onClick={() => queryClient.invalidateQueries()}>
          <Refresh />
        </IconButton>
      </Stack>

      {/* Generation Controls */}
      <AdminCard title="Generate Test Cases" sx={{ mb: 4 }}>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Select Profession</InputLabel>
              <Select
                value={selectedProfession}
                onChange={(e) => setSelectedProfession(e.target.value)}
                label="Select Profession"
              >
                {(Array.isArray(professions?.professions) ? professions.professions : []).map((prof: any) => (
                  <MenuItem key={prof.professionId} value={prof.professionId}>
                    {prof.displayName || prof.professionId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <AdminButton
              tone="primary"
              size="large"
              startIcon={<AutoAwesome />}
              loading={generating}
              onClick={handleGenerateTests}
              disabled={generating || !selectedProfession}
            >
              {generating ? 'Generating Test Cases...' : 'Generate AI Test Cases'}
            </AdminButton>

            {generating && (
              <Alert severity="info">
                AI is analyzing {selectedProfession} features and generating comprehensive test scenarios...
              </Alert>
            )}
          </Stack>
      </AdminCard>

      {/* Test Suites Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {(Array.isArray(testSuites) ? testSuites : []).map((suite: TestSuite) => (
          <Grid item xs={12} md={6} lg={4} key={suite.id}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                      {suite.profession}
                    </Typography>
                    <StatusChip
                      label={`${suite.coverage}% coverage`}
                      tone={suite.coverage > 80 ? 'success' : suite.coverage > 50 ? 'warning' : 'error'}
                    />
                  </Stack>
                  
                  <Box>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="caption">Test Coverage</Typography>
                      <Typography variant="caption">{suite.coverage}%</Typography>
                    </Stack>
                    <LinearProgress 
                      variant="determinate" 
                      value={suite.coverage} 
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                  </Box>
                  
                  <Stack direction="row" spacing={2}>
                    <Box sx={{ flex: 1, textAlign: 'center', p: 1, borderRadius: 1, bgcolor: 'background.default' }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {suite.totalTests}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Total
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'center', p: 1, borderRadius: 1, bgcolor: 'rgba(76,175,80,0.18)' }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                        {suite.passedTests}
                      </Typography>
                      <Typography variant="caption" color="success.dark">
                        Passed
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'center', p: 1, borderRadius: 1, bgcolor: 'rgba(239,68,68,0.18)' }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'error.dark' }}>
                        {suite.failedTests}
                      </Typography>
                      <Typography variant="caption" color="error.dark">
                        Failed
                      </Typography>
                    </Box>
                  </Stack>
                  
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setSelectedProfession(suite.profession);
                      setShowTestCaseDialog(true);
                    }}
                  >
                    View Test Cases
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Test Cases List Dialog */}
      <Dialog open={showTestCaseDialog} onClose={() => setShowTestCaseDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Test Cases: {selectedProfession}
        </DialogTitle>
        <DialogContent>
          <List>
            {(Array.isArray(testCases) ? testCases : []).map((testCase: TestCase) => (
              <Accordion key={testCase.id}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                    {testCase.status === 'passed' ? (
                      <CheckCircle sx={{ color: 'success.main' }} />
                    ) : testCase.status === 'failed' ? (
                      <ErrorOutline sx={{ color: 'error.main' }} />
                    ) : (
                      <Science sx={{ color: 'warning.main' }} />
                    )}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600}}>
                        {testCase.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {testCase.feature}
                      </Typography>
                    </Box>
                    <StatusChip
                      label={testCase.priority}
                      tone={
                        testCase.priority === 'critical' ? 'error' :
                        testCase.priority === 'high' ? 'warning' : 'neutral'
                      }
                    />
                    {testCase.automated && (
                      <StatusChip label="AUTO" tone="brand" />
                    )}
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 600}}>
                        Description:
                      </Typography>
                      <Typography variant="body2">{testCase.description}</Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 600}}>
                        Steps:
                      </Typography>
                      <ol style={{ margin: 0, paddingLeft: 20 }}>
                        {(Array.isArray(testCase.steps) ? testCase.steps : []).map((step, index) => (
                          <li key={index}>
                            <Typography variant="body2">{step}</Typography>
                          </li>
                        ))}
                      </ol>
                    </Box>
                    
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 600}}>
                        Expected Result:
                      </Typography>
                      <Typography variant="body2">{testCase.expectedResult}</Typography>
                    </Box>
                    
                    {testCase.assignedTester && (
                      <Alert severity="info">
                        Assigned to: {testCase.assignedTester}
                      </Alert>
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setShowTestCaseDialog(false)}>Close</AdminButton>
          <AdminButton tone="primary" startIcon={<Download />}>
            Export Test Cases
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
    </ThemeProvider>
  );
}

