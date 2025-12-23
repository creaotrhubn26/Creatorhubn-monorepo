import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Radio,
  RadioGroup,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface TestSuite {
  id: string;
  name: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  tests: TestCase[];
  createdAt: Date;
  lastRun?: Date;
  duration?: number;
  coverage?: number;
}

interface TestCase {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  steps: TestStep[];
  assertions: TestAssertion[];
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface TestStep {
  id: string;
  action: string;
  expected: string;
  actual?: string;
  status: 'pending' | 'passed' | 'failed';
  screenshot?: string;
}

interface TestAssertion {
  id: string;
  type: 'equals' | 'contains' | 'exists' | 'greater' | 'less' | 'regex';
  expected: any;
  actual?: any;
  status: 'pending' | 'passed' | 'failed';
  message?: string;
}

interface TestingFrameworkProps {
  className?: string;
  onSuiteChange?: (suite: TestSuite) => void;
  onTestCaseChange?: (testCase: TestCase) => void;
  onTestRun?: (suiteId: string) => void;
  onTestExport?: (data: { suites: TestSuite[]; testCases: TestCase[] }) => void;
}

// Mock data
const defaultSuites: TestSuite[] = [
  {
    id: 'suite',
    name: 'Authentication Tests',
    description: 'Test user authentication and authorization',
    type: 'integration',
    status: 'passed',
    tests: [
      {
        id: 'test',
        name: 'User Login',
        description: 'Test user login with valid credentials',
        status: 'passed',
        duration: 120,
        steps: [
          {
            id: 'step',
            action: 'Navigate to login page',
            expected: 'Login form is displayed',
            actual: 'Login form is displayed',
            status: 'passed'
          },
          {
            id: 'step-2',
            action: 'Enter valid credentials',
            expected: 'Credentials are accepted',
            actual: 'Credentials are accepted',
            status: 'passed'
          }
        ],
        assertions: [
          {
            id: 'assert',
            type: 'equals',
            expected: 20,
            actual: 200,
            status: 'passed',
            message: 'Response status is 200'
          }
        ],
        tags: ['auth','login'],
        priority: 'high'
      }
    ],
    createdAt: new Date('2024-01-10,'),
    lastRun: new Date('2024-01-15,'),
    duration: 500,
    coverage: 85
  },
  {
    id: 'suite',
    name: 'API Tests',
    description: 'Test API endpoints and responses',
    type: 'unit',
    status: 'failed',
    tests: [
      {
        id: 'test-2',
        name: 'Get Documents API',
        description: 'Test GET /api/documents endpoint',
        status: 'failed',
        duration: 80,
        error: 'Connection timeout',
        steps: [
          {
            id: 'step-3',
            action: 'Send GET request to /api/documents',
            expected: 'Response with status 200',
            actual: 'Connection timeout after 5s',
            status: 'failed'
          }
        ],
        assertions: [
          {
            id: 'assert-2',
            type: 'equals',
            expected: 200,
            actual: undefined,
            status: 'failed',
            message: 'Expected status 200 but got timeout'
          }
        ],
        tags: ['api','documents'],
        priority: 'medium'
      }
    ],
    createdAt: new Date('2024-01-11,'),
    lastRun: new Date('2024-01-14'),
    duration: 300,
    coverage: 60
  }
];

const TestingFramework: React.FC<TestingFrameworkProps> = ({
  className = ', ',
  onSuiteChange,
  onTestCaseChange,
  onTestRun,
  onTestExport
}) => {
  // State
  const [activeTab, setActiveTab] = useState(0);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [showSuiteEditor, setShowSuiteEditor] = useState(false);
  const [showTestCaseEditor, setShowTestCaseEditor] = useState(false);
  const [suites, setSuites] = useState<TestSuite[]>(defaultSuites);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Handlers
  const handleSuiteSelect = useCallback((suite: TestSuite) => {
    setSelectedSuite(suite);
    onSuiteChange?.(suite);
}, [onSuiteChange]);

  const handleTestCaseSelect = useCallback((testCase: TestCase) => {
    setSelectedTestCase(testCase);
    onTestCaseChange?.(testCase);
}, [onTestCaseChange]);

  const handleSuiteEdit = useCallback((suite: TestSuite) => {
    setSelectedSuite(suite);
    setShowSuiteEditor(true);
}, []);

  const handleTestCaseEdit = useCallback((testCase: TestCase) => {
    setSelectedTestCase(testCase);
    setShowTestCaseEditor(true);
}, []);

  const handleSuiteSave = useCallback(() => {
    if (selectedSuite) {
      const existingIndex = suites.findIndex(s => s.id === selectedSuite.id);
      if (existingIndex >= 0) {
        setSuites(prev => prev.map((s, i) => i === existingIndex ? selectedSuite : s));
      } else {
        setSuites(prev => [...prev, selectedSuite]);
      }
      setShowSuiteEditor(false);
    }
  }, [selectedSuite, suites]);

  const handleTestCaseSave = useCallback(() => {
    if (selectedTestCase && selectedSuite) {
      const updatedSuite = {
        ...selectedSuite,
        tests: selectedSuite.tests.map(t => t.id === selectedTestCase.id ? selectedTestCase : t)
      };
      setSuites(prev => prev.map(s => s.id === selectedSuite.id ? updatedSuite : s));
      setShowTestCaseEditor(false);
    }
  }, [selectedTestCase, selectedSuite]);

  const handleRunTests = useCallback(async (suiteId: string) => {
    setIsRunningTests(true);
    const suite = suites.find(s => s.id === suiteId);
    if (!suite) return;

    // Simulate running tests
    const results = [];
    for (const testCase of suite.tests) {
      const result = await new Promise(resolve => {
        setTimeout(() => {
          const success = Math.random() > 0.3; // 70% success rate
          resolve({
            id: testCase.id,
            status: success ? 'passed' : 'failed',
            duration: Math.random() * 2000 + 50,
            error: success ? null : 'Test assertion failed'
      });
      }, Math.random() * 1000 + 500);
    });
      
      results.push(result);
  }
    
    setTestResults(results);
    setIsRunningTests(false);
    onTestRun?.(suiteId);
}, [suites, onTestRun]);

  const handleTestExport = useCallback(() => {
    const allTestCases = suites.flatMap(s => s.tests);
    onTestExport?.({ suites, testCases: allTestCases });
}, [suites, onTestExport]);

  const getTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'unit': return <CREATOR_HUB_ICONS.science />;
      case 'integration': return <CREATOR_HUB_ICONS.integration />;
      case 'e2e': return <CREATOR_HUB_ICONS.e2e />;
      case 'performance': return <CREATOR_HUB_ICONS.performance />;
      case 'security': return <CREATOR_HUB_ICONS.security />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'pending': return <CREATOR_HUB_ICONS.schedule />;
      case 'running': return <CREATOR_HUB_ICONS.refresh />;
      case 'passed': return <CREATOR_HUB_ICONS.checkCircle />;
      case 'failed': return <CREATOR_HUB_ICONS.error />;
      case 'skipped': return <CREATOR_HUB_ICONS.skip />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'running': return 'info';
      case 'passed': return 'success';
      case 'failed': return 'error';
      case 'skipped': return 'default';
      default: return 'default';
}
}, []);

  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'default';
}
}, []);

  // Memoized data
  const testStats = useMemo(() => {
    const totalSuites = suites.length;
    const totalTests = suites.reduce((sum, s) => sum + s.tests.length, 0);
    const passedTests = suites.reduce((sum, s) => sum + s.tests.filter(t => t.status === 'passed').length, 0);
    const failedTests = suites.reduce((sum, s) => sum + s.tests.filter(t => t.status === 'failed').length, 0);
    const avgCoverage = suites.reduce((sum, s) => sum + (s.coverage || 0), 0) / suites.length;
    
    return { totalSuites, totalTests, passedTests, failedTests, avgCoverage };
}, [suites]);

  const filteredSuites = useMemo(() => {
    return suites.filter(suite => {
      const typeMatch = filterType === 'all' || suite.type === filterType;
      const statusMatch = filterStatus === 'all' || suite.status === filterStatus;
      return typeMatch && statusMatch;
  });
}, [suites, filterType, filterStatus]);

  const recentActivity = useMemo(() => {
    return [
      { id: 1, action: 'Test suite created', suite: 'Authentication Tests', timestamp: new Date(), type: 'suite',},
      { id: 2, action: 'Test executed', test: 'User Login', timestamp: new Date(), type: 'test',},
      { id:  3, action: 'Test failed', test: 'Get Documents AP', timestamp: new Date(), type: 'test',},
    ];
}, []);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.science sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Testing Framework</Typography>
              <Typography variant="body2" color="text.secondary">
                Comprehensive testing suite and test case management
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.add />}
              onClick={() => {
                setSelectedSuite({
                  id: `suite-${Date.now()}`,
                  name: 'New Test Suite',
                  description: 'Custom test suite',
                  type: 'unit',
                  status: 'pending',
                  tests:  [],
                  createdAt: new Date()
            });
                setShowSuiteEditor(true);
            }}
            >
              New Suite
            </Button>
            <Button variant="contained"
              startIcon={<CREATOR_HUB_ICONS.playArrow sx={theming.getThemedButtonSx()} />}
              onClick={() => selectedSuite && handleRunTests(selectedSuite.id)}
              disabled={isRunningTests || !selectedSuite}
            >
              {isRunningTests ? 'Running...' : 'Run Tests'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.download />}
              onClick={handleTestExport}
            >
              Export
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.science sx={{ fontSize:  40, color: 'primary.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{testStats.totalSuites}</Typography>
                  <Typography variant="body2" color="text.secondary">Test Suites</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.checkCircle sx={{ fontSize:  40, color: 'success.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{testStats.passedTests}</Typography>
                  <Typography variant="body2" color="text.secondary">Passed Tests</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.error sx={{ fontSize:  40, color: 'error.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{testStats.failedTests}</Typography>
                  <Typography variant="body2" color="text.secondary">Failed Tests</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.assessment sx={{ fontSize:  40, color: 'info.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{Math.round(testStats.avgCoverage)}%</Typography>
                  <Typography variant="body2" color="text.secondary">Avg Coverage</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="subtitle1">Filters: </Typography>
          <FormControl size="small" sx={{ minWidth: 120}}>
            <InputLabel>Type</InputLabel>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="unit">Unit</MenuItem>
              <MenuItem value="integration">Integration</MenuItem>
              <MenuItem value="e2e">E2E</MenuItem>
              <MenuItem value="performance">Performance</MenuItem>
              <MenuItem value="security">Security</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120}}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="running">Running</MenuItem>
              <MenuItem value="passed">Passed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="skipped">Skipped</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
        <Tab label="Test Suites" icon={<CREATOR_HUB_ICONS.science />} />
        <Tab label="Test Cases" icon={<CREATOR_HUB_ICONS.assessment />} />
        <Tab label="Results" icon={<CREATOR_HUB_ICONS.timeline />} />
        <Tab label="Activity" icon={<CREATOR_HUB_ICONS.history />} />
      </Tabs>

      {/* Test Suites Tab */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {filteredSuites.map((suite) => (
            <Grid item xs={12} sm={6} md={4} key={suite.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { elevation:  4 },
                  transition: 'all 0.2',
                  border: selectedSuite?.id === suite.id ? 2 : 0,
                  borderColor: selectedSuite?.id === suite.id ? 'primary.main' : 'transparent'
            }}
                onClick={() => handleSuiteSelect(suite)} sx={theming.getThemedCardSx()}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    {getTypeIcon(suite.type)}
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {suite.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {suite.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                        <Chip 
                          label={suite.type}
                          size="small" 
                          color="primary"
                        />
                        <Chip 
                          icon={getStatusIcon(suite.status)}
                          label={suite.status}
                          size="small" 
                          color={getStatusColor(suite.status) as any}
                        />
                        <Chip 
                          label={`${suite.tests.length} tests`}
                          size="small" 
                          variant="outlined"
                        />
                      </Stack>
                      
                      <Stack direction="row" spacing={2} sx={{ mb:  2 }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Coverage
                          </Typography>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            {suite.coverage || 0}%
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Duration
                          </Typography>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            {suite.duration ? `${suite.duration}ms` : 'N/A'}
                          </Typography>
                        </Box>
                      </Stack>
                      
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CREATOR_HUB_ICONS.edit />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSuiteEdit(suite);
                        }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CREATOR_HUB_ICONS.playArrow />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRunTests(suite.id);
                        }}
                        >
                          Run
                        </Button>
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Test Cases Tab */}
      {activeTab === 1 && selectedSuite && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Test Cases - {selectedSuite.name}
          </Typography>
          <Grid container spacing={2}>
            {selectedSuite.tests.map((testCase) => (
              <Grid item xs={12} sm={6} md={4} key={testCase.id}>
                <Card 
                  sx={{ 
                    cursor: 'pointer','&:hover': { elevation:  4 },
                    transition: 'all 0.2',
                    border: selectedTestCase?.id === testCase.id ? 2 : 0,
                    borderColor: selectedTestCase?.id === testCase.id ? 'primary.main' : 'transparent'
              }}
                  onClick={() => handleTestCaseSelect(testCase)} sx={theming.getThemedCardSx()}
                >
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      {getStatusIcon(testCase.status)}
                      <Box sx={{ flex:  1 }}>
                        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                          {testCase.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {testCase.description}
                        </Typography>
                        
                        <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                          <Chip 
                            icon={getStatusIcon(testCase.status)}
                            label={testCase.status}
                            size="small" 
                            color={getStatusColor(testCase.status) as any}
                          />
                          <Chip 
                            label={testCase.priority}
                            size="small" 
                            color={getPriorityColor(testCase.priority) as any}
                          />
                          {testCase.duration && (
                            <Chip 
                              label={`${testCase.duration}ms`}
                              size="small" 
                              variant="outlined"
                            />
                          )}
                        </Stack>
                        
                        <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                          {testCase.tags.map((tag) => (
                            <Chip key={tag} label={tag} size="small" variant="outlined" />
                          ))}
                        </Stack>
                        
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<CREATOR_HUB_ICONS.edit />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTestCaseEdit(testCase);
                          }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<CREATOR_HUB_ICONS.playArrow />}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle run single test
                          }}
                          >
                            Run
                          </Button>
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Results Tab */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Test Results
          </Typography>
          {testResults.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Test</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Error</TableCell>
                    <TableCell>Timestamp</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {testResults.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {result.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(result.status)}
                          label={result.status}
                          color={getStatusColor(result.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {result.duration}ms
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={result.error ? 'error.main' : 'text.secondary'}>
                          {result.error || 'None'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date().toLocaleString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Paper elevation={1} sx={{ p:  3, textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="body1" color="text.secondary">
                No test results available. Run tests to see results.
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Activity Tab */}
      {activeTab === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Testing Activity
          </Typography>
          <List>
            {recentActivity.map((activity) => (
              <ListItem key={activity.id}>
                <ListItemIcon>
                  <CREATOR_HUB_ICONS.history />
                </ListItemIcon>
                <ListItemText
                  primary={activity.action}
                  secondary={`${activity.suite || activity.test} • ${activity.timestamp.toLocaleString()}`}
                />
                <Chip 
                  label={activity.type}
                  size="small" 
                  color="primary"
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Suite Editor Dialog */}
      <Dialog open={showSuiteEditor} onClose={() => setShowSuiteEditor(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.science />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedSuite?.id.startsWith('suite-') ? 'Create Test Suite' : 'Edit Test Suite'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedSuite && (
            <Stack spacing={3} sx={{ mt:  2 }}>
              <TextField
                label="Suite Name"
                value={selectedSuite.name}
                onChange={(e) => setSelectedSuite(prev => prev ? { ...prev, name: e.target.value } : null)}
                fullWidth
              />
              <TextField
                label="Description"
                value={selectedSuite.description}
                onChange={(e) => setSelectedSuite(prev => prev ? { ...prev, description: e.target.value } : null)}
                fullWidth
                multiline
                rows={2}
              />
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={selectedSuite.type}
                    onChange={(e) => setSelectedSuite(prev => prev ? { ...prev, type: e.target.value as any } : null)}
                  >
                    <MenuItem value="unit">Unit</MenuItem>
                    <MenuItem value="integration">Integration</MenuItem>
                    <MenuItem value="e2e">E2E</MenuItem>
                    <MenuItem value="performance">Performance</MenuItem>
                    <MenuItem value="security">Security</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={selectedSuite.status}
                    onChange={(e) => setSelectedSuite(prev => prev ? { ...prev, status: e.target.value as any } : null)}
                  >
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="running">Running</MenuItem>
                    <MenuItem value="passed">Passed</MenuItem>
                    <MenuItem value="failed">Failed</MenuItem>
                    <MenuItem value="skipped">Skipped</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSuiteEditor(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={handleSuiteSave}
           sx={theming.getThemedButtonSx()}>
            {selectedSuite?.id.startsWith('suite-') ? 'Create' : 'Update'} Suite
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Case Editor Dialog */}
      <Dialog open={showTestCaseEditor} onClose={() => setShowTestCaseEditor(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.assessment />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedTestCase?.id.startsWith('test-') ? 'Create Test Case' : 'Edit Test Case'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedTestCase && (
            <Stack spacing={3} sx={{ mt:  2 }}>
              <TextField
                label="Test Name"
                value={selectedTestCase.name}
                onChange={(e) => setSelectedTestCase(prev => prev ? { ...prev, name: e.target.value } : null)}
                fullWidth
              />
              <TextField
                label="Description"
                value={selectedTestCase.description}
                onChange={(e) => setSelectedTestCase(prev => prev ? { ...prev, description: e.target.value } : null)}
                fullWidth
                multiline
                rows={2}
              />
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={selectedTestCase.priority}
                    onChange={(e) => setSelectedTestCase(prev => prev ? { ...prev, priority: e.target.value as any } : null)}
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={selectedTestCase.status}
                    onChange={(e) => setSelectedTestCase(prev => prev ? { ...prev, status: e.target.value as any } : null)}
                  >
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="running">Running</MenuItem>
                    <MenuItem value="passed">Passed</MenuItem>
                    <MenuItem value="failed">Failed</MenuItem>
                    <MenuItem value="skipped">Skipped</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <TextField
                label="Tags (comma-separated)"
                value={selectedTestCase.tags.join(', ')}
                onChange={(e) => setSelectedTestCase(prev => prev ? { ...prev, tags: e.target.value.split, (', ').map(t => t.trim()) } : null)}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTestCaseEditor(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={handleTestCaseSave}
           sx={theming.getThemedButtonSx()}>
            {selectedTestCase?.id.startsWith('test-') ? 'Create' : 'Update'} Test Case
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TestingFramework;

