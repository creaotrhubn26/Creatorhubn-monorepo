import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  TextField,
  Chip,
  Grid,
  Alert,
} from '@mui/material';
import { ExpandMore as ExpandIcon, PlayArrow as ExecuteIcon, Code as CodeIcon } from '@mui/icons-material';
import { WireMockResponseViewer, WireMockTestResult } from './WireMockResponseViewer';

interface AdminAPIEndpoint {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  requestBody?: string;
  category: string;
}

const ADMIN_API_ENDPOINTS: AdminAPIEndpoint[] = [
  {
    name: 'Get All Mappings',
    method: 'GET',
    path: '/__admin/mappings',
    description: 'Retrieve all stub mappings',
    category: 'Mappings'
  },
  {
    name: 'Get Single Mapping',
    method: 'GET',
    path: '/__admin/mappings/{id}',
    description: 'Get a specific mapping by ID',
    category: 'Mappings'
  },
  {
    name: 'Create Mapping',
    method: 'POST',
    path: '/__admin/mappings',
    description: 'Create a new stub mapping',
    requestBody: JSON.stringify({
      request: {
        method: 'GET',
        url: '/api/example'
      },
      response: {
        status: 200,
        body: '{"message" : "Hello from WireMock"}, ',
        headers: {
          'Content-Type' : 'application/json'
        }
      }
    }, null, 2),
    category: 'Mappings'
  },
  {
    name: 'Delete Mapping',
    method: 'DELETE',
    path: '/__admin/mappings/{id},',
    description: 'Delete a specific mapping',
    category: 'Mappings'
  },
  {
    name: 'Reset All Mappings',
    method: 'POST',
    path: '/__admin/mappings/reset',
    description: 'Reset all mappings to default state',
    category: 'Mappings'
  },
  {
    name: 'Get All Requests',
    method: 'GET',
    path: '/__admin/requests',
    description: 'Get all received requests',
    category: 'Requests'
  },
  {
    name: 'Find Requests',
    method: 'POST',
    path: '/__admin/requests/find',
    description: 'Find requests matching criteria',
    requestBody: JSON.stringify({
      method: 'GET',
      url: '/api/example'
    }, null, 2),
    category: 'Requests'
  },
  {
    name: 'Reset Requests',
    method: 'DELETE',
    path: '/__admin/requests',
    description: 'Clear all recorded requests',
    category: 'Requests'
  },
  {
    name: 'Get All Scenarios',
    method: 'GET',
    path: '/__admin/scenarios',
    description: 'Get all scenario states',
    category: 'Scenarios'
  },
  {
    name: 'Reset Scenarios',
    method: 'POST',
    path: '/__admin/scenarios/reset',
    description: 'Reset all scenarios to initial state',
    category: 'Scenarios'
  },
  {
    name: 'Get Settings',
    method: 'GET',
    path: '/__admin/settings',
    description: 'Get global WireMock settings',
    category: 'Settings'
  },
  {
    name: 'Update Settings',
    method: 'PUT',
    path: '/__admin/settings',
    description: 'Update global settings',
    requestBody: JSON.stringify({
      fixedDelay: 0,
      delayDistribution: null
    }, null, 2),
    category: 'Settings'
  },
  {
    name: 'Shutdown Server',
    method: 'POST',
    path: '/__admin/shutdown',
    description: 'Shutdown WireMock server',
    category: 'System'
  }
];

export const WireMockAdminAPIExplorer: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<AdminAPIEndpoint | null>(null);
  const [requestBody, setRequestBody] = useState<string>('');
  const [pathParams, setPathParams] = useState<string>('');
  const [result, setResult] = useState<WireMockTestResult | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const categories = Array.from(new Set(ADMIN_API_ENDPOINTS.map(e => e.category)));

  const executeEndpoint = async (endpoint: AdminAPIEndpoint) => {
    setLoading(true);
    const startTime = Date.now();

    try {
      let path = endpoint.path;
      
      // Replace path parameters
      if (pathParams && path.includes('{id}')) {
        path = path.replace('{id}', pathParams);
      }

      const options: RequestInit = {
        method: endpoint.method,
        headers: {
          'Content-Type' : 'application/json'
        }
      };

      if (requestBody && (endpoint.method === 'POST' || endpoint.method === 'PUT')) {
        options.body = requestBody;
      }

      const response = await fetch(`/api/wiremock${path}`, options);
      const responseTime = Date.now() - startTime;
      const responseData = await response.json();

      const testResult: WireMockTestResult = {
        id: Date.now().toString(),
        timestamp: new Date(),
        apiName: endpoint.name,
        endpoint: path,
        method: endpoint.method,
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        responseTime,
        request: {
          headers: { 'Content-Type' : 'application/json' },
          body: requestBody ? JSON.parse(requestBody) : undefined
        },
        response: {
          headers: Object.fromEntries(response.headers.entries()),
          body: responseData
        }
      };

      setResult(testResult);
      setViewerOpen(true);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const testResult: WireMockTestResult = {
        id: Date.now().toString(),
        timestamp: new Date(),
        apiName: endpoint.name,
        endpoint: endpoint.path,
        method: endpoint.method,
        status: 'error',
        responseTime,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          type: 'EXECUTION_ERROR'
        }
      };

      setResult(testResult);
      setViewerOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔧 WireMock Admin API Explorer
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Explore and execute WireMock admin APIs directly from the UI
        </Typography>

        {categories.map(category => (
          <Box key={category} sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              {category}
            </Typography>
            {ADMIN_API_ENDPOINTS.filter(e => e.category === category).map(endpoint => (
              <Accordion key={endpoint.name}>
                <AccordionSummary expandIcon={<ExpandIcon />}>
                  <Box display="flex" alignItems="center" gap={2} width="100%">
                    <Chip
                      label={endpoint.method}
                      size="small"
                      color={
                        endpoint.method === 'GET' ? 'primary' :
                        endpoint.method === 'POST' ? 'success' :
                        endpoint.method === 'PUT' ? 'warning' : 'error'
                      }
                    />
                    <Typography variant="body2" fontWeight={500}>
                      {endpoint.name}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        {endpoint.description}
                      </Typography>
                      <Typography variant="caption" fontFamily="monospace" display="block" mt={1}>
                        {endpoint.path}
                      </Typography>
                    </Grid>

                    {endpoint.path.includes('{id}') && (
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Path Parameter (ID)"
                          value={pathParams}
                          onChange={(e) => setPathParams(e.target.value)}
                          placeholder="Enter mapping ID"
                        />
                      </Grid>
                    )}

                    {endpoint.requestBody && (
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          rows={8}
                          label="Request Body (JSON)"
                          value={requestBody || endpoint.requestBody}
                          onChange={(e) => setRequestBody(e.target.value)}
                          sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                        />
                      </Grid>
                    )}

                    <Grid item xs={12}>
                      <Button
                        variant="contained"
                        startIcon={<ExecuteIcon />}
                        onClick={() => {
                          setSelectedEndpoint(endpoint);
                          if (!requestBody && endpoint.requestBody) {
                            setRequestBody(endpoint.requestBody);
                          }
                          executeEndpoint(endpoint);
                        }}
                        disabled={loading}
                      >
                        Execute
                      </Button>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        ))}

        <WireMockResponseViewer
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          result={result}
        />
      </CardContent>
    </Card>
  );
};

