import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { Api, CheckCircle, PlayArrow, Warning } from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

interface APIEndpoint {
  id: string;
  name: string;
  description: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  category: 'authentication' | 'data' | 'analytics' | 'integration' | 'webhook';
  status: 'active' | 'inactive' | 'deprecated' | 'testing';
  responseTime: number;
  successRate: number;
  lastUsed: Date;
  version: string;
  documentation?: string;
}

interface APITest {
  id: string;
  name: string;
  endpointId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  expectedStatus: number;
  expectedResponse?: unknown;
  status: 'pending' | 'running' | 'passed' | 'failed';
  result?: {
    status: number;
    responseSummary: string;
  };
  duration?: number;
  createdAt: Date;
  lastRun?: Date;
}

interface APIIntegrationProps {
  className?: string;
  onEndpointChange?: (endpoint: APIEndpoint) => void;
  onTestChange?: (test: APITest) => void;
  onIntegrationExport?: (data: { endpoints: APIEndpoint[]; tests: APITest[] }) => void;
}

const ENDPOINTS: APIEndpoint[] = [
  {
    id: 'auth-login',
    name: 'User Login',
    description: 'Authenticate user with email and password.',
    url: '/api/auth/login',
    method: 'POST',
    category: 'authentication',
    status: 'active',
    responseTime: 120,
    successRate: 99.5,
    lastUsed: new Date('2026-02-28T10:00:00Z'),
    version: 'v1',
  },
  {
    id: 'documents-list',
    name: 'Get Documents',
    description: 'Fetch user documents with pagination.',
    url: '/api/documents?page=1&limit=20',
    method: 'GET',
    category: 'data',
    status: 'active',
    responseTime: 170,
    successRate: 98.1,
    lastUsed: new Date('2026-02-28T11:00:00Z'),
    version: 'v2',
  },
  {
    id: 'analytics-track',
    name: 'Track Event',
    description: 'Persist analytics telemetry event.',
    url: '/api/analytics/events',
    method: 'POST',
    category: 'analytics',
    status: 'testing',
    responseTime: 220,
    successRate: 96.4,
    lastUsed: new Date('2026-02-27T09:30:00Z'),
    version: 'v2',
  },
];

const TESTS: APITest[] = [
  {
    id: 'test-login',
    name: 'Login returns token',
    endpointId: 'auth-login',
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    body: { email: 'test@example.com', password: 'password' },
    expectedStatus: 200,
    status: 'pending',
    createdAt: new Date('2026-02-26T08:00:00Z'),
  },
  {
    id: 'test-documents',
    name: 'Documents endpoint returns array',
    endpointId: 'documents-list',
    method: 'GET',
    url: '/api/documents?page=1&limit=20',
    headers: {},
    expectedStatus: 200,
    status: 'pending',
    createdAt: new Date('2026-02-26T09:00:00Z'),
  },
];

export default function APIIntegration({
  className,
  onEndpointChange,
  onTestChange,
  onIntegrationExport,
}: APIIntegrationProps): React.ReactElement {
  const theming = useTheming('photographer');
  const [activeTab, setActiveTab] = useState(0);
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>(ENDPOINTS);
  const [tests, setTests] = useState<APITest[]>(TESTS);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);

  const selectedEndpoint = useMemo(
    () => endpoints.find((endpoint) => endpoint.id === selectedEndpointId) ?? null,
    [endpoints, selectedEndpointId],
  );

  const runTest = (testId: string): void => {
    setRunningTestId(testId);

    setTests((previous) =>
      previous.map((test) => (test.id === testId ? { ...test, status: 'running' } : test)),
    );

    window.setTimeout(() => {
      const pass = Math.random() > 0.15;
      setTests((previous) =>
        previous.map((test) => {
          if (test.id !== testId) {
            return test;
          }
          const updated: APITest = {
            ...test,
            duration: 90 + Math.floor(Math.random() * 200),
            lastRun: new Date(),
            result: {
              status: pass ? test.expectedStatus : 500,
              responseSummary: pass ? 'Response schema matched.' : 'Unexpected response body.',
            },
            status: pass ? 'passed' : 'failed',
          };
          onTestChange?.(updated);
          return updated;
        }),
      );
      setRunningTestId(null);
    }, 800);
  };

  const toggleEndpointStatus = (endpointId: string): void => {
    setEndpoints((previous) =>
      previous.map((endpoint) => {
        if (endpoint.id !== endpointId) {
          return endpoint;
        }
        const updated: APIEndpoint = {
          ...endpoint,
          status: endpoint.status === 'active' ? 'inactive' : 'active',
          lastUsed: new Date(),
        };
        onEndpointChange?.(updated);
        return updated;
      }),
    );
  };

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <Paper sx={{ ...theming.getThemedCardSx(), mb: 2, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Api color="primary" />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                API Integration
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage endpoints, execute integration tests, and export API diagnostics.
              </Typography>
            </Box>
          </Stack>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onIntegrationExport?.({ endpoints, tests })}
          >
            Export
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 1, mb: 2 }}>
        <Tabs value={activeTab} onChange={(_event, value) => setActiveTab(value)}>
          <Tab label="Endpoints" />
          <Tab label="Tests" />
        </Tabs>
      </Paper>

      {activeTab === 0 ? (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <List>
                  {endpoints.map((endpoint) => (
                    <ListItem
                      key={endpoint.id}
                      onClick={() => setSelectedEndpointId(endpoint.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <ListItemText
                        primary={`${endpoint.method} ${endpoint.name}`}
                        secondary={`${endpoint.url} • ${endpoint.responseTime}ms • ${endpoint.successRate.toFixed(1)}%`}
                      />
                      <Chip size="small" label={endpoint.status} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                {selectedEndpoint ? (
                  <Stack spacing={1}>
                    <Typography variant="subtitle1">{selectedEndpoint.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedEndpoint.description}
                    </Typography>
                    <Typography variant="body2">Version: {selectedEndpoint.version}</Typography>
                    <Typography variant="body2">
                      Last used: {selectedEndpoint.lastUsed.toLocaleString()}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => toggleEndpointStatus(selectedEndpoint.id)}
                    >
                      Toggle Active State
                    </Button>
                  </Stack>
                ) : (
                  <Alert severity="info">Select an endpoint for details.</Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : null}

      {activeTab === 1 ? (
        <Card>
          <CardContent>
            <Stack spacing={1}>
              {runningTestId ? <LinearProgress /> : null}
              {tests.map((test) => (
                <Paper key={test.id} variant="outlined" sx={{ p: 1 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2">{test.name}</Typography>
                      <Chip
                        size="small"
                        label={test.status}
                        color={test.status === 'passed' ? 'success' : test.status === 'failed' ? 'error' : 'default'}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {test.method} {test.url}
                    </Typography>
                    {test.result ? (
                      <Alert severity={test.status === 'passed' ? 'success' : 'warning'}>
                        {test.result.responseSummary}
                      </Alert>
                    ) : null}
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<PlayArrow />}
                        disabled={runningTestId !== null}
                        onClick={() => runTest(test.id)}
                      >
                        Run
                      </Button>
                      {test.status === 'passed' ? <CheckCircle color="success" fontSize="small" /> : null}
                      {test.status === 'failed' ? <Warning color="warning" fontSize="small" /> : null}
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
