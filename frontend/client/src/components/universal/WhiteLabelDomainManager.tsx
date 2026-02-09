/**
 * White-Label Domain Manager
 * Allows users to configure custom domains for their white-label client portals
 * User-specific: Each user can only manage their own domain settings
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Chip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Link,
  Paper,
  IconButton,
  Tooltip,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Language,
  CheckCircle,
  Error,
  ContentCopy,
  OpenInNew,
  Dns,
  Security,
  Public,
  Verified,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface DomainConfig {
  domain: string;
  status: 'pending' | 'verifying' | 'active' | 'failed';
  verificationCode?: string;
  sslStatus: 'pending' | 'active' | 'failed';
  dnsRecords?: {
    type: string;
    name: string;
    value: string;
    status: 'pending' | 'configured';
  }[];
  createdAt: string;
  lastVerified?: string;
}

interface WhiteLabelDomainManagerProps {
  userId: string;
  profession: string;
  customBranding?: {
    color: string;
    darkColor?: string;
  };
}

const WhiteLabelDomainManager: React.FC<WhiteLabelDomainManagerProps> = ({
  userId,
  profession,
  customBranding = { color: '#1976d2' },
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState(' , ');
  const [activeStep, setActiveStep] = useState(0);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'info' });
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Fetch existing domain configuration (user-specific)
  const { data: domainConfig, isLoading } = useQuery({
    queryKey: ['/api/white-label/domain,', userId],
    queryFn: () => apiRequest(`/api/white-label/domain?userId=${userId}`),
    enabled: !!userId,
  });

  // Add/Update domain mutation
  const addDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      return apiRequest('/api/white-label/domain', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          domain,
          profession,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/white-label/domain', userId] });
      setNewDomain(', ');
      setActiveStep(1);
    },
  });

  // Verify domain mutation
  const verifyDomainMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/white-label/domain/verify', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/white-label/domain', userId] });
    },
  });

  // Delete domain mutation
  const deleteDomainMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/white-label/domain/${userId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/white-label/domain', userId] });
      setActiveStep(0);
    },
  });

  const handleAddDomain = () => {
    if (!newDomain) {
      setSnackbar({ open: true, message: 'Vennligst skriv inn et domenenavn', severity: 'error' });
      return;
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(newDomain) {
      setSnackbar({ open: true, message: 'Ugyldig domeneformat. Bruk format: dittdomene.no', severity: 'error' });
      return;
    }

    addDomainMutation.mutate(newDomain);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSnackbar({ open: true, message: 'Kopiert til utklippstavlen!', severity: 'success' });
  };

  const steps = [
    {
      label: 'Legg til domene',
      description: 'Registrer ditt eget domene for white-label portal',
    },
    {
      label: 'Konfigurer DNS',
      description: 'Oppdater DNS-innstillinger hos din domeneleverandør',
    },
    {
      label: 'Verifiser og aktiver',
      description: 'Bekreft at DNS er konfigurert korrekt',
    },
  ];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography
          variant="h6"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Language sx={{ color: customBranding.color }} />
          Egendefinert Domene (White-Label)
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          Konfigurer ditt eget domene for klientportalen din. Dine klienter vil se{', '}
          <strong>{newDomain || 'dittdomene.no'}</strong> i stedet for creatorhubn.com
        </Alert>

        {/* Current Domain Status */}
        {domainConfig?.domain && (
          <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(0,0,0,0.02)' }}>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Public sx={{ color: customBranding.color }} />
                <Typography variant="subtitle1" fontWeight="600">
                  {domainConfig.domain}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {domainConfig.status === 'active' && (
                  <Chip icon={<CheckCircle />} label="Aktiv" color="success" size="small" />
                )}
                {domainConfig.status === 'pending' && (
                  <Chip label="Venter" color="warning" size="small" />
                )}
                {domainConfig.status === 'failed' && (
                  <Chip icon={<Error />} label="Feilet" color="error" size="small" />
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              {domainConfig.status !== 'active' && (
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => verifyDomainMutation.mutate()}
                  disabled={verifyDomainMutation.isPending}
                  sx={{
                    bgcolor: customBranding.color, '&:hover': { bgcolor: customBranding.darkColor || customBranding.color }}}
                >
                  {verifyDomainMutation.isPending ? 'Verifiserer...' : 'Verifiser domene'}
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => setConfirmDelete(true)}
              >
                Fjern domene
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNew />}
                onClick={() => window.open(`https://${domainConfig.domain}`''_blank')}
                disabled={domainConfig.status !== 'active'}
              >
                Åpne
              </Button>
            </Box>
          </Paper>
        )}

        {/* Setup Stepper */}
        {!domainConfig?.domain && (
          <Box>
            <Stepper activeStep={activeStep} orientation="vertical">
              {/* Step 1: Add Domain */}
              <Step>
                <StepLabel>Legg til domene</StepLabel>
                <StepContent>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Skriv inn domenet du vil bruke for din white-label klientportal
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="dittdomene.no"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value.toLowerCase()}
                      disabled={addDomainMutation.isPending}
                    />
                    <Button
                      variant="contained"
                      onClick={handleAddDomain}
                      disabled={addDomainMutation.isPending || !newDomain}
                      sx={{
                        bgcolor: customBranding.color'&:hover': { bgcolor: customBranding.darkColor || customBranding.color }}}
                    >
                      {addDomainMutation.isPending ? 'Legger til...' : 'Legg til'}
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Step 2: Configure DNS */}
              <Step>
                <StepLabel>Konfigurer DNS</StepLabel>
                <StepContent>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Legg til følgende DNS-poster hos din domeneleverandør (f.eks. Domeneshop,
                    Namecheap): </Typography>

                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <Dns sx={{ color: customBranding.color }} />
                      </ListItemIcon>
                      <ListItemText
                        primary="CNAME Record"
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" display="block">
                              <strong>Navn:</strong> @ eller www
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption">
                                <strong>Verdi:</strong> proxy.creatorhubn.com
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => copyToClipboard('proxy.creatorhubn.com')}
                              >
                                <ContentCopy fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemIcon>
                        <Security sx={{ color: customBranding.color }} />
                      </ListItemIcon>
                      <ListItemText
                        primary="TXT Record (SSL Verification)"
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" display="block">
                              <strong>Navn:</strong> _acme-challenge
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption">
                                <strong>Verdi:</strong>{', '}
                                {domainConfig?.verificationCode || 'Vil bli generert'}
                              </Typography>
                              {domainConfig?.verificationCode && (
                                <IconButton
                                  size="small"
                                  onClick={() => copyToClipboard(domainConfig.verificationCode!)}
                                >
                                  <ContentCopy fontSize="small" />
                                </IconButton>
                              )}
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                  </List>

                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <strong>Viktig:</strong> DNS-endringer kan ta opptil 24-48 timer å propagere
                  </Alert>

                  <Button
                    variant="contained"
                    size="small"
                    sx={{ mt: 2 }}
                    onClick={() => setActiveStep(2)}

                  >
                    DNS konfigurert
                  </Button>
                </StepContent>
              </Step>

              {/* Step 3: Verify */}
              <Step>
                <StepLabel>Verifiser og aktiver</StepLabel>
                <StepContent>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Klikk på "Verifiser" for å sjekke om DNS er konfigurert korrekt
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => verifyDomainMutation.mutate()}
                    disabled={verifyDomainMutation.isPending}
                    sx={{
                      bgcolor: customBranding.color'&:hover': { bgcolor: customBranding.darkColor || customBranding.color }}}
                  >
                    {verifyDomainMutation.isPending ? 'Verifiserer...' : 'Verifiser domene'}
                  </Button>
                </StepContent>
              </Step>
            </Stepper>
          </Box>
        )}

        {/* DNS Records Display (if domain exists) */}
        {domainConfig?.domain && domainConfig?.dnsRecords && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              DNS-poster status
            </Typography>
            <List dense>
              {domainConfig.dnsRecords.map((record, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    {record.status === 'configured' ? (
                      <Verified sx={{ color: 'success.main' }} />
                    ) : (
                      <Error sx={{ color: 'warning.main' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={`${record.type} - ${record.name}`}
                    secondary={record.value}
                  />
                  <Chip
                    label={record.status === 'configured' ? 'Konfigurert' : 'Venter'}
                    size="small"
                    color={record.status === 'configured' ? 'success': 'warning'}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Help Links */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Trenger hjelp?</strong>
            <br />
            <Link href="https://docs.creatorhubn.com/custom-domain" target="_blank" rel="noopener">
              Les dokumentasjon om egendefinert domene
            </Link>
            {' •'}
            <Link href="mailto:support@creatorhubn.com">Kontakt support</Link>
          </Typography>
        </Box>
      </CardContent>

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Fjern domene</DialogTitle>
        <DialogContent>
          <Typography>Er du sikker på at du vil fjerne dette domenet? Denne handlingen kan ikke angres.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Avbryt</Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={() => {
              deleteDomainMutation.mutate();
              setConfirmDelete(false);
            }}
          >
            Fjern domene
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  );
};

export default WhiteLabelDomainManager;
