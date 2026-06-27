/**
 * CreatorHub Norge - Authentication Test Component
 * Tests authentication endpoints and verifies 200 OK responses
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Http as HttpIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { mockFetch } from '@/api/mockGooglePayApi';
import { AdminButton, StatusChip, adminTokens } from './design-system';

interface AuthTestResult {
  endpoint: string;
  status: number;
  statusText: string;
  success: boolean;
  responseTime: number;
  error?: string;
}

const TEST_ENDPOINTS = [
  '/api/google-pay/configuration',
  '/api/google-pay/products',
  '/api/google-pay/statistics',
  '/api/admin/users',
  '/api/admin/roles',
  '/api/subscription-plans',
] as const;

export default function AuthenticationTest() {
  const { auth } = useEnhancedMasterIntegration();
  const theming = useTheming('prototype_tester');
  const [testResults, setTestResults] = useState<AuthTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runAuthenticationTest = useCallback(async () => {
    setIsRunning(true);
    setTestResults([]);

    const results: AuthTestResult[] = [];

    for (const endpoint of TEST_ENDPOINTS) {
      const startTime = Date.now();

      try {
        const authHeader = await auth.getAuthHeader();
        const response = await mockFetch(endpoint, {
          headers: {
            ...authHeader,
            'Content-Type': 'application/json',
          },
        });

        const responseTime = Date.now() - startTime;

        results.push({
          endpoint,
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
          responseTime,
          error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        const responseTime = Date.now() - startTime;

        results.push({
          endpoint,
          status: 0,
          statusText: 'Network Error',
          success: false,
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    setTestResults(results);
    setIsRunning(false);
  }, [auth]);

  useEffect(() => {
    void runAuthenticationTest();
  }, [runAuthenticationTest]);

  const getStatusIcon = (result: AuthTestResult) => {
    if (result.success) {
      return <CheckIcon sx={{ color: adminTokens.color.success }} />;
    }

    return <ErrorIcon sx={{ color: adminTokens.color.error }} />;
  };

  const successCount = testResults.filter((result) => result.success).length;
  const totalCount = testResults.length;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

  return (
    <Card sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <SecurityIcon sx={{ color: adminTokens.color.success, fontSize: 32 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
              Autentisering Test
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tester alle API endepunkter for 200 OK responser
            </Typography>
          </Box>
          <AdminButton
            tone="secondary"
            startIcon={<RefreshIcon />}
            onClick={() => {
              void runAuthenticationTest();
            }}
            disabled={isRunning}
            sx={{ ml: 'auto' }}
          >
            {isRunning ? 'Tester...' : 'Test Igjen'}
          </AdminButton>
        </Stack>

        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Chip
            icon={<CheckIcon />}
            label={`${successCount}/${totalCount} Suksess`}
            color={successCount === totalCount ? 'success' : 'warning'}
            variant="filled"
          />
          <Chip
            icon={<HttpIcon />}
            label={`${successRate}% Suksessrate`}
            color={successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'error'}
            variant="outlined"
          />
        </Stack>

        {isRunning && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress sx={{ mb: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Tester autentisering...
            </Typography>
          </Box>
        )}

        {testResults.length > 0 && (
          <List dense>
            {testResults.map((result, index) => (
              <React.Fragment key={result.endpoint}>
                <ListItem>
                  <ListItemIcon>{getStatusIcon(result)}</ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {result.endpoint}
                        </Typography>
                        <StatusChip
                          label={`${result.status} ${result.statusText}`}
                          tone={result.success ? 'success' : 'error'}
                        />
                        <StatusChip
                          label={`${result.responseTime}ms`}
                          tone="neutral"
                        />
                      </Box>
                    }
                    secondary={result.error || 'OK'}
                  />
                </ListItem>
                {index < testResults.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}

        {testResults.length > 0 && (
          <Alert severity={successCount === totalCount ? 'success' : 'warning'} sx={{ mt: 2 }}>
            <Typography variant="body2">
              {successCount === totalCount ? (
                <>
                  <strong>Alle endepunkter fungerer!</strong> Alle {totalCount} API endepunkter returnerer 200 OK
                  responser.
                </>
              ) : (
                <>
                  <strong>Noen endepunkter feiler:</strong> {totalCount - successCount} av {totalCount} endepunkter
                  returnerer ikke 200 OK. Sjekk autentisering og tilgangsrettigheter.
                </>
              )}
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
