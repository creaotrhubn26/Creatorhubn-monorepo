import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  LinearProgress,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Link,
  IconButton,
  Tooltip,
  Collapse,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  CheckCircle,
  Error,
  Warning,
  Info,
  Refresh,
  ExpandMore,
  ExpandLess,
  Security,
  Link as LinkIcon,
  Schedule,
} from '@mui/icons-material';

interface ScopeValidationResult {
  scope: string;
  valid: boolean;
  service?: string;
  reason?: string;
  note?: string;
}

interface ScopeCheckReport {
  checkedAt: string;
  scopes: ScopeValidationResult[];
  allValid: boolean;
  documentation: string;
}

interface OAuthScopeCheckResponse {
  success: boolean;
  report: ScopeCheckReport;
  currentScopes: string[];
  documentation: string;
  checkedAt: string;
  error?: string;
  details?: string;
}

export default function OAuthScopeChecker() {
  const { auth } = useEnhancedMasterIntegration();
  const [expandedScopes, setExpandedScopes] = useState<Record<string, boolean>>({});

  const {
    data: scopeData,
    isLoading,
    error,
    refetch,
  } = useQuery<OAuthScopeCheckResponse>({
    queryKey: ['/api/admin/oauth/check-scopes'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/oauth/check-scopes', { headers });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const handleRefresh = () => {
    refetch();
  };

  const toggleScopeDetails = (scope: string) => {
    setExpandedScopes((prev) => ({
      ...prev,
      [scope]: !prev[scope],
    }));
  };

  const getScopeStatusIcon = (result: ScopeValidationResult) => {
    if (!result.valid) {
      return <Error color="error" />;
    }
    if (result.note) {
      return <Warning color="warning" />;
    }
    return <CheckCircle color="success" />;
  };

  const getScopeStatusColor = (result: ScopeValidationResult): 'success' | 'warning' | 'error' => {
    if (!result.valid) return 'error';
    if (result.note) return 'warning';
    return 'success';
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('nb-NO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Checking OAuth Scopes...
            </Typography>
            <LinearProgress sx={{ mt: 2 }} />
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Card>
          <CardContent>
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to check OAuth scopes: {error instanceof Error ? error.message : 'Unknown error'}
            </Alert>
            <Button variant="contained" startIcon={<Refresh />} onClick={handleRefresh}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!scopeData || !scopeData.success) {
    return (
      <Box sx={{ p: 3 }}>
        <Card>
          <CardContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              {scopeData?.error || 'Failed to retrieve scope validation data'}
            </Alert>
            <Button variant="contained" startIcon={<Refresh />} onClick={handleRefresh}>
              Retry Check
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const { report, documentation, checkedAt } = scopeData;
  const scopes = Array.isArray(report?.scopes) ? report.scopes : [];

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Security color="primary" />
            OAuth Scope Validator
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Validate Google OAuth 2.0 scopes for 2025 compliance
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </Box>

      {/* Overall Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {report.allValid ? (
                  <CheckCircle color="success" sx={{ fontSize: 40 }} />
                ) : (
                  <Warning color="warning" sx={{ fontSize: 40 }} />
                )}
                <Box>
                  <Typography variant="h6">
                    {report.allValid ? 'All Scopes Valid' : 'Some Scopes Need Attention'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last checked: {formatDate(checkedAt)}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  icon={<CheckCircle />}
                  label={`${scopes.filter((s) => s.valid && !s.note).length} Valid`}
                  color="success"
                  size="small"
                />
                {scopes.filter((s) => s.note).length > 0 && (
                  <Chip
                    icon={<Warning />}
                    label={`${scopes.filter((s) => s.note).length} Needs Review`}
                    color="warning"
                    size="small"
                  />
                )}
                {scopes.filter((s) => !s.valid).length > 0 && (
                  <Chip
                    icon={<Error />}
                    label={`${scopes.filter((s) => !s.valid).length} Invalid`}
                    color="error"
                    size="small"
                  />
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Scope List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Info color="primary" />
            Scope Validation Results
          </Typography>
          <List>
            {scopes.map((scopeResult, index) => (
              <React.Fragment key={scopeResult.scope}>
                <ListItem
                  sx={{
                    bgcolor: expandedScopes[scopeResult.scope] ? 'action.hover' : 'transparent',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <ListItemIcon>{getScopeStatusIcon(scopeResult)}</ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                          {scopeResult.scope}
                        </Typography>
                        {scopeResult.service && (
                          <Chip
                            label={scopeResult.service}
                            size="small"
                            color={getScopeStatusColor(scopeResult)}
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        {scopeResult.reason && (
                          <Typography variant="body2" color="error">
                            {scopeResult.reason}
                          </Typography>
                        )}
                        {scopeResult.note && (
                          <Typography variant="body2" color="text.secondary">
                            {scopeResult.note}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <IconButton
                    size="small"
                    onClick={() => toggleScopeDetails(scopeResult.scope)}
                    sx={{ ml: 1 }}
                  >
                    {expandedScopes[scopeResult.scope] ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </ListItem>
                <Collapse in={expandedScopes[scopeResult.scope]} timeout="auto" unmountOnExit>
                  <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Service:</strong> {scopeResult.service || 'Unknown'}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Status:</strong>{' '}
                        {scopeResult.valid ? (
                          <Chip label="Valid" color="success" size="small" />
                        ) : (
                          <Chip label="Invalid" color="error" size="small" />
                        )}
                      </Typography>
                      {scopeResult.reason && (
                        <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
                          {scopeResult.reason}
                        </Alert>
                      )}
                      {scopeResult.note && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          {scopeResult.note}
                        </Alert>
                      )}
                    </Paper>
                  </Box>
                </Collapse>
                {index < scopes.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Documentation & Recommendations */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinkIcon color="primary" />
            Resources & Documentation
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <LinkIcon />
              </ListItemIcon>
              <ListItemText
                primary="Google OAuth 2.0 Scopes Documentation"
                secondary={documentation}
              />
              <Button
                size="small"
                variant="outlined"
                href={documentation}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open
              </Button>
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Schedule />
              </ListItemIcon>
              <ListItemText
                primary="Maintenance Guide"
                secondary="See docs/OAUTH_SCOPE_MAINTENANCE.md for monitoring instructions"
              />
            </ListItem>
          </List>

          {!report.allValid && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                Action Required
              </Typography>
              <Typography variant="body2">
                Some scopes may need attention. Review the validation results above and check Google's
                documentation for any deprecation notices or required updates.
              </Typography>
            </Alert>
          )}

          {report.allValid && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body2">
                All OAuth scopes appear to be valid for 2025. Continue monitoring for future changes.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
    </ThemeProvider>
  );
}



