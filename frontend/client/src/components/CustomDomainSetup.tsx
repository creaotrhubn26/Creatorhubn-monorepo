// @ts-nocheck
/**
 * Custom Domain Setup Component
 *
 * Allows users to configure custom domains for white-label branding
 * Includes domain verification, DNS instructions, and status monitoring
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface DNSRecord {
  type: string;
  name: string;
  value: string;
  ttl?: number;
}

interface DomainStatus {
  domain: string;
  status: 'pending' | 'active' | 'failed';
  verificationRecords: DNSRecord[];
  lastChecked?: string;
  error?: string;
}

interface CustomDomainSetupProps {
  initialDomain?: string;
  onComplete?: (domain: string) => void;
  compact?: boolean;
}

export const CustomDomainSetup: React.FC<CustomDomainSetupProps> = ({
  initialDomain = '',
  onComplete,
  compact = false,
}) => {
  const [customDomain, setCustomDomain] = useState(initialDomain);
  const [activeStep, setActiveStep] = useState(0);
  const [showDNSInstructions, setShowDNSInstructions] = useState(false);

  // Fetch current domain status
  const {
    data: domainStatus,
    isLoading: statusLoading,
    refetch,
  } = useQuery<DomainStatus>({
    queryKey: ['/api/white-label/domain/status', customDomain],
    queryFn: () => apiRequest(`/api/white-label/domain/status?domain=${customDomain}`),
    enabled: !!customDomain && activeStep >= 1,
    refetchInterval: (data) => {
      // Auto-refresh every 30s if pending
      return data?.status === 'pending' ? 30000 : false;
    },
  });

  // Submit domain mutation
  const submitDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      return apiRequest('/api/white-label/domain/submit', {
        method: 'POST',
        body: JSON.stringify({ domain }),
      });
    },
    onSuccess: (data) => {
      setActiveStep(1);
      refetch();
    },
  });

  // Verify domain mutation
  const verifyDomainMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/white-label/domain/verify?domain=${customDomain}`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      if (data.status === 'active') {
        setActiveStep(2);
        if (onComplete) onComplete(customDomain);
      }
      refetch();
    },
  });

  const handleDomainSubmit = () => {
    if (!customDomain || !isValidDomain(customDomain)) return;
    submitDomainMutation.mutate(customDomain);
  };

  const handleVerify = () => {
    verifyDomainMutation.mutate();
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const isValidDomain = (domain: string) => {
    const domainRegex =
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    return domainRegex.test(domain);
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'active': return <CheckCircleIcon color="success" />;
      case 'pending': return <PendingIcon color="warning" />;
      case 'failed': return <ErrorIcon color="error" />;
      default: return <InfoIcon color="info" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  if (compact) {
    return (
      <Box>
        <TextField
          fullWidth
          label="Custom Domain"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          placeholder="photos.yourdomain.com"
          helperText="Optional: Use your own domain for client-facing pages"
          InputProps={{
            endAdornment: domainStatus && (
              <Chip
                icon={getStatusIcon(domainStatus.status)}
                label={domainStatus.status}
                size="small"
                color={getStatusColor(domainStatus.status) as any}
              />
            ),
          }}
        />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Custom Domain Setup
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Use your own domain for a fully branded client experience
        </Typography>

        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Step 1: Enter Domain */}
          <Step>
            <StepLabel>Enter Your Domain</StepLabel>
            <StepContent>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Custom Domain"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="photos.yourdomain.com"
                  error={customDomain !== '' && !isValidDomain(customDomain)}
                  helperText={
                    customDomain !== '' && !isValidDomain(customDomain)
                      ? 'Please enter a valid domain'
                      : 'Use a subdomain (e.g., photos.yourdomain.com)'
                  }
                />
              </Box>

              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Recommended:</strong> Use a subdomain like{''}
                  <code>photos.yourdomain.com</code> or <code>gallery.yourdomain.com</code>
                </Typography>
              </Alert>

              <Button
                variant="contained"
                onClick={handleDomainSubmit}
                disabled={
                  !customDomain || !isValidDomain(customDomain) || submitDomainMutation.isPending
                }
                startIcon={submitDomainMutation.isPending && <CircularProgress size={20} />}
              >
                {submitDomainMutation.isPending ? 'Submitting...' : 'Continue'}
              </Button>
            </StepContent>
          </Step>

          {/* Step 2: DNS Configuration */}
          <Step>
            <StepLabel>Configure DNS Records</StepLabel>
            <StepContent>
              {domainStatus && (
                <>
                  <Alert
                    severity={domainStatus.status === 'active' ? 'success' : 'warning'}
                    sx={{ mb: 2 }}>
                    {domainStatus.status === 'active' ? (
                      <Typography variant="body2">
                        <strong>✅ Domain verified!</strong> Your custom domain is active.
                      </Typography>
                    ) : (
                      <Typography variant="body2">
                        <strong>⏳ Waiting for DNS verification</strong> - Add the DNS records below
                        to your domain provider.
                      </Typography>
                    )}
                  </Alert>

                  {domainStatus.status === 'pending' && (
                    <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 2}}>
                        <Typography variant="h6">DNS Records</Typography>
                        <Button
                          size="small"
                          startIcon={showDNSInstructions ? null : <InfoIcon />}
                          onClick={() => setShowDNSInstructions(!showDNSInstructions)}
                        >
                          {showDNSInstructions ? 'Hide' : 'Show'} Instructions
                        </Button>
                      </Box>

                      <Collapse in={showDNSInstructions}>
                        <Alert severity="info" sx={{ mb: 2 }}>
                          <Typography variant="body2" gutterBottom>
                            <strong>How to add DNS records:</strong>
                          </Typography>
                          <List dense>
                            <ListItem>
                              <ListItemText primary="1. Log in to your domain provider (GoDaddy, Namecheap, Cloudflare, etc.)" />
                            </ListItem>
                            <ListItem>
                              <ListItemText primary="2. Find the DNS management or DNS records section" />
                            </ListItem>
                            <ListItem>
                              <ListItemText primary="3. Add each record below exactly as shown" />
                            </ListItem>
                            <ListItem>
                              <ListItemText primary="4. DNS changes may take up to 48 hours to propagate" />
                            </ListItem>
                          </List>
                        </Alert>
                      </Collapse>

                      <List>
                        {domainStatus.verificationRecords.map((record, index) => (
                          <ListItem
                            key={index}
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              mb: 1,
                              bgcolor: 'background.paper'}}>
                            <ListItemIcon>{getStatusIcon('pending')}</ListItemIcon>
                            <ListItemText
                              primary={
                                <Box>
                                  <Typography variant="body2" fontWeight="bold">
                                    {record.type} Record
                                  </Typography>
                                </Box>
                              }
                              secondary={
                                <Box sx={{ mt: 1 }}>
                                  <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                                    <strong>Name/Host:</strong> {record.name}
                                  </Typography>
                                  <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                                    <strong>Value:</strong>{', '}
                                    <code style={{ wordBreak: 'break-all' }}>{record.value}</code>
                                  </Typography>
                                  {record.ttl && (
                                    <Typography variant="caption" display="block">
                                      <strong>TTL:</strong> {record.ttl}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                            <Tooltip title="Copy to clipboard">
                              <IconButton
                                size="small"
                                onClick={() => handleCopyToClipboard(record.value)}
                              >
                                <CopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  )}

                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleVerify}
                      disabled={verifyDomainMutation.isPending || domainStatus.status === 'active'}
                      startIcon={
                        verifyDomainMutation.isPending ? (
                          <CircularProgress size={20} />
                        ) : (
                          <RefreshIcon />
                        )
                      }
                    >
                      {verifyDomainMutation.isPending ? 'Verifying...': 'Verify DNS'}
                    </Button>

                    {domainStatus.status === 'active' && (
                      <Button variant="outlined" onClick={() => setActiveStep(2)}>
                        Continue
                      </Button>
                    )}
                  </Box>

                  {domainStatus.lastChecked && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 2, display: 'block' }}>
                      Last checked: {new Date(domainStatus.lastChecked).toLocaleString()}
                    </Typography>
                  )}
                </>
              )}
            </StepContent>
          </Step>

          {/* Step 3: Complete */}
          <Step>
            <StepLabel>Domain Active</StepLabel>
            <StepContent>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>🎉 Your custom domain is now active!</strong>
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Your client-facing pages will now be served from <strong>{customDomain}</strong>
                </Typography>
              </Alert>

              <Button
                variant="outlined"
                startIcon={<OpenIcon />}
                href={`https://${customDomain}`}
                target="_blank"
              >
                Visit Your Domain
              </Button>
            </StepContent>
          </Step>
        </Stepper>
      </CardContent>
    </Card>
  );
};

export default CustomDomainSetup;
