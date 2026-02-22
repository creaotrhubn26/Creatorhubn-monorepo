/**
 * Split Sheet Portal View
 * Component for viewing and signing split sheets in the client portal
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Stack,
  useTheme,
} from '@mui/material';
import {
  AccountBalance as SplitSheetIcon,
  CheckCircle,
  Schedule,
  AttachMoney,
  Edit as EditIcon,
  Key as KeyIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Email as EmailIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  Folder,
  Event,
  Phone,
} from '@mui/icons-material';
import { LocationsIcon as LocationOn, TeamIcon as Groups } from '../icons/CastingIcons';
import settingsService from '../../services/settingsService';

interface SplitSheetPortalViewProps {
  contributorEmail?: string;
  contributorId?: string;
  accessToken?: string;
  accessCode?: string; // Access code from URL
  onSigned?: () => void;
}

export default function SplitSheetPortalView({
  contributorEmail,
  contributorId,
  accessToken,
  accessCode: propAccessCode,
  onSigned,
}: SplitSheetPortalViewProps) {
    const getPortalToken = async (): Promise<string> => {
      const cached = await settingsService.getSetting<string>('virtualStudio_portalToken');
      if (cached) return cached;
      return '';
    };
  const theme = useTheme();
  const brandColor = theme.palette.primary.main;
  const queryClient = useQueryClient();
  const [selectedSplitSheet, setSelectedSplitSheet] = useState<any>(null);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [accessCode, setAccessCode] = useState(propAccessCode || '');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [requiresPin, setRequiresPin] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  // Determine initial step: if access code provided, start with credentials check, otherwise access code
  const [step, setStep] = useState<'accessCode' | 'credentials' | 'authenticated'>(
    propAccessCode ? 'accessCode' : (contributorEmail || contributorId ? 'authenticated' : 'accessCode')
  );
  const [signaturePin, setSignaturePin] = useState('');
  const [signaturePassword, setSignaturePassword] = useState('');
  const [sendEmailCopy, setSendEmailCopy] = useState(false);
  const [emailForCopy, setEmailForCopy] = useState(contributorEmail || '');
  const [downloadPDF, setDownloadPDF] = useState(true);
  const [projectData, setProjectData] = useState<any>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [acceptedProjectDetails, setAcceptedProjectDetails] = useState(false);

  // Validate access code and credentials
  const validateAccess = async () => {
    if (!accessCode.trim()) {
      return;
    }

    try {
      const params = new URLSearchParams();
      if (pin) params.append('pin', pin);
      if (password) params.append('password', password);
      
      const url = `/api/split-sheets/portal/access/${accessCode.trim().toUpperCase()}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiRequest(url);
      
      if (response.success) {
        setStep('authenticated');
        // Store validated access for subsequent requests
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('401')) {
        try {
          const errorData = JSON.parse(errMsg.split('Response: ')[1] || '{},');
          if (errorData.requiresPin || errorData.requiresPassword) {
            setRequiresPin(errorData.requiresPin || false);
            setRequiresPassword(errorData.requiresPassword || false);
            setStep('credentials');
            return;
          }
        } catch {
          // Fall through
        }
        // Show error
      }
    }
  };

  // If access code is provided via URL or props, validate it
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlAccessCode = urlParams.get('access_code');
    const codeToUse = propAccessCode || urlAccessCode || accessCode;
    
    if (codeToUse && codeToUse !== accessCode) {
      setAccessCode(codeToUse);
      // Auto-validate if access code is provided
      setTimeout(() => {
        validateAccess();
      }, 100);
    }
  }, [propAccessCode]);

  // Fetch split sheets for contributor (only after authentication)
  const { data: splitSheetsData, isLoading } = useQuery({
    queryKey: ['split-sheets-portal', contributorEmail, contributorId, accessCode, step],
    queryFn: async () => {
      // If we have access code, use portal access endpoint first
      if (accessCode && step === 'authenticated') {
        try {
          const params = new URLSearchParams();
          if (pin) params.append('pin', pin);
          if (password) params.append('password', password);
          const url = `/api/split-sheets/portal/access/${accessCode.toUpperCase()}${params.toString() ? `?${params.toString()}` : ''}`;
          const accessResponse = await apiRequest(url);
          
          if (accessResponse.success && accessResponse.data.split_sheet_id) {
            // Fetch split sheet details
            const splitSheetResponse = await apiRequest(`/api/split-sheets/${accessResponse.data.split_sheet_id}`);
            if (splitSheetResponse.success) {
              // Format as contributor view
              const splitSheet = splitSheetResponse.data;
              const contributor = splitSheet.contributors?.find((c: any) => 
                (contributorId && c.id === contributorId) || 
                (contributorEmail && c.email?.toLowerCase() === contributorEmail.toLowerCase())
              );
              
              if (contributor) {
                return {
                  data: {
                    splitSheets: [{
                      ...splitSheet,
                      project_id: splitSheet.project_id, // Ensure project_id is included
                      percentage: contributor.percentage,
                      role: contributor.role,
                      signed_at: contributor.signed_at,
                      contributor_record_id: contributor.id,
                      require_pin_for_signature: splitSheet.require_pin_for_signature,
                      require_password_for_signature: splitSheet.require_password_for_signature,
                    }],
                  }
                };
              }
            }
          }
        } catch (error) {
          console.error('Error accessing via access code:', error);
        }
      }

      // Fallback to contributor/email endpoints
      if (contributorId) {
        const params = new URLSearchParams();
        if (accessToken) params.append('token', accessToken);
        if (accessCode) params.append('access_code', accessCode);
        const url = `/api/split-sheets/contributor/${contributorId}${params.toString() ? `?${params.toString()}` : ''}`;
        return await apiRequest(url);
      } else if (contributorEmail) {
        const params = new URLSearchParams();
        if (accessToken) params.append('token', accessToken);
        if (accessCode) params.append('access_code', accessCode);
        const url = `/api/split-sheets/by-email/${encodeURIComponent(contributorEmail)}${params.toString() ? `?${params.toString()}` : ''}`;
        return await apiRequest(url);
      }
      throw new Error('Either contributorEmail, contributorId, or accessCode is required');
    },
    enabled: (!!(contributorEmail || contributorId) || !!accessCode) && step === 'authenticated',
  });

  const splitSheets = splitSheetsData?.data?.splitSheets || [];

  // Fetch project data when split sheet is selected and has project_id
  useEffect(() => {
    const fetchProjectData = async () => {
      if (selectedSplitSheet?.project_id && showSignDialog) {
        setLoadingProject(true);
        setProjectData(null); // Reset project data when opening dialog
        setAcceptedProjectDetails(false); // Reset acceptance
        
        console.log('Fetching project data for split sheet:', {
          splitSheetId: selectedSplitSheet.id,
          projectId: selectedSplitSheet.project_id,
        });
        
        try {
          // Try to fetch project data - handle 404 gracefully
          const response = await apiRequest(`/api/casting/projects/${selectedSplitSheet.project_id}`);
          if (response && !response.error) {
            // Handle both direct response and wrapped response
            // Backend returns project directly, not wrapped in { data: ... }
            console.log('Project data loaded successfully:', {
              projectId: response.id,
              projectName: response.name,
              hasClientName: !!response.clientName,
              hasClientEmail: !!response.clientEmail,
            });
            setProjectData(response);
          } else {
            console.warn('Project response was empty or had error:', response);
          }
        } catch (error: unknown) {
          // If project doesn't exist (404), this is a critical error
          // Split sheet cannot be signed without project details
          const errMsg = error instanceof Error ? error.message : String(error);
          if (errMsg.includes('404') || errMsg.includes('API error: 404')) {
            console.error('CRITICAL: Project not found for split sheet:', selectedSplitSheet.project_id);
            console.error('Split sheet cannot be signed without project details. The project must be saved to the database first.');
            // Don't set projectData, which will block signing
          } else {
            console.error('Error fetching project data:', error);
          }
        } finally {
          setLoadingProject(false);
        }
      } else if (!selectedSplitSheet?.project_id && showSignDialog) {
        // Reset if no project_id
        console.log('No project_id in split sheet, skipping project data fetch');
        setProjectData(null);
        setAcceptedProjectDetails(false);
      }
    };

    fetchProjectData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSplitSheet?.project_id, showSignDialog]);

  // Sign split sheet mutation
  const signMutation = useMutation({
    mutationFn: async ({ splitSheetId, contributorId: cId, signatureData, sendEmail, email, downloadPdf }: any) => {
      const response = await apiRequest(`/api/split-sheets/${splitSheetId}/contributor-sign`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          contributor_id: cId,
          token: accessToken,
          signature_data: signatureData,
          send_email_copy: sendEmail,
          email_for_copy: email,
          download_pdf: downloadPdf,
        }),
      });

      // If download PDF is requested, trigger download
      if (downloadPdf && response.success) {
        try {
          const authToken = await getPortalToken();
          const pdfResponse = await fetch(`/api/split-sheets/${splitSheetId}/pdf?signed=true`, {
            method: 'GET',
            headers: {
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
          });
          
          if (pdfResponse.ok) {
            const pdfBlob = await pdfResponse.blob();
            const url = window.URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selectedSplitSheet?.title?.replace(/[^a-z0-9]/gi, '_, ') || 'split_sheet'}_signed.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          } else {
            console.error('Error downloading PDF:', await pdfResponse.text());
          }
        } catch (error) {
          console.error('Error downloading PDF:', error);
        }
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split-sheets-portal'] });
      setShowSignDialog(false);
      setSelectedSplitSheet(null);
      setSignatureName('');
      setSignaturePin('');
      setSignaturePassword('');
      setSendEmailCopy(false);
      setEmailForCopy(contributorEmail || '');
      setProjectData(null);
      setAcceptedProjectDetails(false);
      if (onSigned) onSigned();
    },
  });

  const handleSign = () => {
    if (!selectedSplitSheet || !signatureName) return;

    // Check if PIN/password is required for signature
    if (selectedSplitSheet.require_pin_for_signature && !signaturePin) {
      return;
    }
    if (selectedSplitSheet.require_password_for_signature && !signaturePassword) {
      return;
    }

    // Validate email if send email is checked
    if (sendEmailCopy && !emailForCopy) {
      return;
    }

    const signatureData = {
      name: signatureName,
      signedAt: new Date().toISOString(),
      method: 'portal',
      pin: signaturePin || undefined,
      password: signaturePassword || undefined,
    };

    signMutation.mutate({
      splitSheetId: selectedSplitSheet.id,
      contributorId: selectedSplitSheet.contributor_record_id || contributorId,
      signatureData,
      sendEmail: sendEmailCopy,
      email: emailForCopy,
      downloadPdf: downloadPDF,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4caf50';
      case 'pending_signatures':
        return '#9333ea';
      default:
        return '#9e9e9e';
    }
  };

  // Access Code Input (if not authenticated)
  if (step === 'accessCode' || step === 'credentials') {
    return (
      <Box sx={{ maxWidth: { xs: '100%', sm: 450, md: 500, lg: 550, xl: 600 }, mx: 'auto', mt: { xs: 2, sm: 3, md: 3.5, lg: 4, xl: 4.5 }, px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
        <Card sx={{ borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 } }}>
            <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 3.5, md: 4, lg: 4.5, xl: 5 } }}>
              <SplitSheetIcon sx={{ fontSize: { xs: '2.5rem', sm: '2.75rem', md: '3rem', lg: '3.25rem', xl: '3.5rem' }, color: brandColor, mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }} />
              <Typography variant="h4" sx={{ color: brandColor, fontWeight: 600, mb: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 }, fontSize: { xs: '1.5rem', sm: '1.625rem', md: '1.75rem', lg: '1.875rem', xl: '2rem' } }}>
                Split Sheet Portal
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' } }}>
                {step === 'accessCode' 
                  ? 'Skriv inn tilgangskoden du har fått fra musikkprodusenten for å se split sheets.'
                  : 'Skriv inn PIN og/eller passord for å fortsette.'}
              </Typography>
            </Box>

            {step === 'accessCode' && (
              <TextField
                fullWidth
                label="Tilgangskode"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                variant="outlined"
                sx={{ 
                  mb: { xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 },
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                    py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                    minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                  },
                }}
                placeholder="F.eks: ABC123XYZ"
                InputProps={{
                  startAdornment: (
                    <Box sx={{ mr: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 }, display: 'flex', alignItems: 'center', color: brandColor }}>
                      <KeyIcon sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.375rem', lg: '1.5rem', xl: '1.625rem' } }} />
                    </Box>
                  )}}
                onKeyDown={(e) => e.key === 'Enter' && validateAccess()}
              />
            )}

            {step === 'credentials' && (
              <>
                {requiresPin && (
                  <TextField
                    fullWidth
                    label="PIN"
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').substring(0, 4))}
                    variant="outlined"
                    sx={{ mb: 3 }}
                    placeholder="4 siffer"
                    inputProps={{ maxLength: 4, inputMode: 'numeric' }}
                    InputProps={{
                      startAdornment: (
                        <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                          <LockIcon />
                        </Box>
                      )}}
                  />
                )}

                {requiresPassword && (
                  <TextField
                    fullWidth
                    label="Passord"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    variant="outlined"
                    sx={{ mb: 3 }}
                    placeholder="Skriv inn passord"
                    InputProps={{
                      startAdornment: (
                        <Box sx={{ mr: 1, display: 'flex', alignItems: 'center', color: brandColor }}>
                          <LockIcon />
                        </Box>
                      )}}
                  />
                )}
              </>
            )}

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={validateAccess}
              disabled={!accessCode.trim() || (step === 'credentials' && requiresPin && !pin.trim()) || (step === 'credentials' && requiresPassword && !password.trim())}
              sx={{ 
                bgcolor: brandColor, 
                '&:hover': { bgcolor: brandColor },
                fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                py: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5 },
                minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
              }}
            >
              {step === 'accessCode' ? 'Fortsett' : 'Logg inn'}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (splitSheets.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Ingen split sheets funnet for din e-postadresse.
      </Alert>
    );
  }

  return (
    <Box sx={{ px: { xs: 1, sm: 1.5, md: 2, lg: 2.5, xl: 3 } }}>
      <Typography variant="h5" gutterBottom sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, color: brandColor, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 }, fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }}>
        <SplitSheetIcon sx={{ fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} /> Mine Split Sheets
      </Typography>

      {splitSheets.map((splitSheet: any) => (
        <Card key={splitSheet.id} sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, borderTop: `4px solid ${brandColor}`, borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }, flexWrap: 'wrap', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
              <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 'auto' } }}>
                <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' }, mb: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 } }}>
                  {splitSheet.title}
                </Typography>
                {splitSheet.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' } }}>
                    {splitSheet.description}
                  </Typography>
                )}
              </Box>
              <Chip
                label={splitSheet.status === 'completed' ? 'Fullført' : 
                       splitSheet.status === 'pending_signatures' ? 'Venter signaturer' : 
                       'Utkast'}
                sx={{
                  bgcolor: getStatusColor(splitSheet.status),
                  color: 'white',
                  fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem', lg: '0.938rem', xl: '1rem' },
                  height: { xs: 28, sm: 30, md: 32, lg: 34, xl: 36 },
                  px: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
                }}
              />
            </Box>

            <Divider sx={{ my: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }} />

            {/* Contributor Information */}
            <Box sx={{ mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' }, mb: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
                Din andel
              </Typography>
              <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }, flexWrap: 'wrap' }}>
                <Chip
                  label={`${splitSheet.percentage}%`}
                  color="primary"
                  sx={{ 
                    bgcolor: brandColor,
                    fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                    height: { xs: 28, sm: 30, md: 32, lg: 34, xl: 36 },
                    px: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
                  }}
                />
                <Chip
                  label={splitSheet.role || 'Bidragsyter'}
                  variant="outlined"
                  sx={{
                    fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                    height: { xs: 28, sm: 30, md: 32, lg: 34, xl: 36 },
                    px: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
                  }}
                />
                {splitSheet.signed_at ? (
                  <Chip
                    icon={<CheckCircle sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem', lg: '1.375rem', xl: '1.5rem' } }} />}
                    label="Signert"
                    color="success"
                    sx={{
                      fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                      height: { xs: 28, sm: 30, md: 32, lg: 34, xl: 36 },
                      px: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
                    }}
                  />
                ) : (
                  <Chip
                    icon={<Schedule sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem', lg: '1.375rem', xl: '1.5rem' } }} />}
                    label="Ikke signert"
                    color="warning"
                    sx={{
                      fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                      height: { xs: 28, sm: 30, md: 32, lg: 34, xl: 36 },
                      px: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
                    }}
                  />
                )}
              </Box>
            </Box>

            {/* All Contributors Table */}
            <Box sx={{ mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' }, mb: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
                Alle bidragsytere ({splitSheet.signed_contributors}/{splitSheet.total_contributors} signert)
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>Navn</TableCell>
                      <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>Rolle</TableCell>
                      <TableCell align="right" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>Andel</TableCell>
                      <TableCell align="center" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Display all contributors from the split sheet */}
                    {splitSheet.contributors && splitSheet.contributors.length > 0 ? (
                      splitSheet.contributors.map((contributor: any, index: number) => (
                        <TableRow key={contributor.id || index}>
                          <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
                            {contributor.name || 'Ukjent'}
                            {contributor.email === contributorEmail && (
                              <Chip label="Deg" size="small" sx={{ ml: 1, fontSize: '0.7rem', height: 20 }} />
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>{contributor.role || 'collaborator'}</TableCell>
                          <TableCell align="right" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>{contributor.percentage?.toFixed(2) || '0'}%</TableCell>
                          <TableCell align="center" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
                            {contributor.signed_at ? (
                              <Chip label="Signert" size="small" color="success" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' }, height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }} />
                            ) : (
                              <Chip label="Ikke signert" size="small" color="warning" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' }, height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }} />
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>{splitSheet.name || 'Deg'}</TableCell>
                        <TableCell sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>{splitSheet.role || 'Bidragsyter'}</TableCell>
                        <TableCell align="right" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>{splitSheet.percentage}%</TableCell>
                        <TableCell align="center" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
                          {splitSheet.signed_at ? (
                            <Chip label="Signert" size="small" color="success" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' }, height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }} />
                          ) : (
                            <Chip label="Ikke signert" size="small" color="warning" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' }, height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 } }} />
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Sign Button */}
            {!splitSheet.signed_at && (
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => {
                  setSelectedSplitSheet(splitSheet);
                  setShowSignDialog(true);
                }}
                sx={{
                  bgcolor: brandColor,
                  '&:hover': { bgcolor: brandColor },
                  fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                  px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                  py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
                  minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                }}
              >
                Signer Split Sheet
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Sign Dialog */}
      <Dialog 
        open={showSignDialog} 
        onClose={() => setShowSignDialog(false)} 
        maxWidth="sm" 
        fullWidth
        sx={{ zIndex: 100002 }}
        PaperProps={{
          sx: {
            borderRadius: { xs: 0, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
            m: { xs: 0, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
            maxHeight: { xs: '100vh', sm: '90vh', md: '85vh', lg: '80vh', xl: '75vh' },
          },
        }}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.1rem', sm: '1.188rem', md: '1.25rem', lg: '1.313rem', xl: '1.375rem' }, px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, py: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
          Signer Split Sheet
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, pb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
          {selectedSplitSheet && (
            <Box>
              <Alert severity="info" sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' } }}>
                Du er i ferd med å signere: <strong>{selectedSplitSheet.title}</strong>
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' } }}>
                For å signere, skriv inn ditt navn nedenfor.
              </Typography>
              <TextField
                fullWidth
                label="Ditt navn"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                required
                sx={{ 
                  mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                    py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                    minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                  },
                }}
              />
              
              {/* PIN/Password for Signature */}
              {(selectedSplitSheet.require_pin_for_signature || selectedSplitSheet.require_password_for_signature) && (
                <>
                  <Divider sx={{ my: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }} />
                  <Typography variant="subtitle2" sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, fontWeight: 600, fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' } }}>
                    Sikkerhetsbekreftelse
                  </Typography>
                  {selectedSplitSheet.require_pin_for_signature && (
                    <TextField
                      fullWidth
                      label="PIN (4 siffer)"
                      type="password"
                      value={signaturePin}
                      onChange={(e) => setSignaturePin(e.target.value.replace(/\D/g, '').substring(0, 4))}
                      required
                      sx={{ 
                        mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                        '& .MuiInputBase-input': {
                          fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                          py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                          minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                        },
                        '& .MuiInputLabel-root': {
                          fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                        },
                      }}
                      inputProps={{ maxLength: 4, inputMode: 'numeric' }}
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ mr: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 }, display: 'flex', alignItems: 'center' }}>
                            <KeyIcon sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.375rem', lg: '1.5rem', xl: '1.625rem' } }} />
                          </Box>
                        )}}
                    />
                  )}
                  {selectedSplitSheet.require_password_for_signature && (
                    <TextField
                      fullWidth
                      label="Passord"
                      type="password"
                      value={signaturePassword}
                      onChange={(e) => setSignaturePassword(e.target.value)}
                      required
                      sx={{ 
                        mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                        '& .MuiInputBase-input': {
                          fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                          py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                          minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                        },
                        '& .MuiInputLabel-root': {
                          fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                        },
                      }}
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ mr: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 }, display: 'flex', alignItems: 'center' }}>
                            <LockIcon sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.375rem', lg: '1.5rem', xl: '1.625rem' } }} />
                          </Box>
                        )}}
                    />
                  )}
                </>
              )}

              <Divider sx={{ my: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }} />

              {/* Project Details Section - Only show if project_id exists and project data is loaded */}
              {selectedSplitSheet?.project_id && (
                <>
                  <Box sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                    <Typography variant="subtitle2" sx={{ mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }, fontWeight: 700, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                      <Folder sx={{ fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
                      Prosjektdetaljer
                    </Typography>
                    
                    {loadingProject ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : projectData ? (
                      <Card sx={{ 
                        bgcolor: 'rgba(255,255,255,0.03)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                        mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                      }}>
                        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                          <Stack spacing={{ xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }}>
                            {/* Project Name */}
                            {projectData.name && (
                              <Box>
                                <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' }, display: 'block', mb: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 } }}>
                                  Prosjektnavn
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600, fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' }, color: 'text.primary' }}>
                                  {projectData.name}
                                </Typography>
                              </Box>
                            )}

                            {/* Project Responsible / Client */}
                            {(projectData.clientName || projectData.clientEmail || projectData.clientPhone) && (
                              <>
                                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                                <Box>
                                  <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' }, display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 }, mb: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 } }}>
                                    <PersonIcon sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.125rem', lg: '1.25rem', xl: '1.375rem' } }} />
                                    Prosjektansvarlig
                                  </Typography>
                                  <Stack spacing={{ xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 }} sx={{ mt: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                                    {projectData.clientName && (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                                        <PersonIcon sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem', lg: '1.375rem', xl: '1.5rem' }, color: 'text.secondary' }} />
                                        <Typography variant="body2" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, color: 'text.primary' }}>
                                          {projectData.clientName}
                                        </Typography>
                                      </Box>
                                    )}
                                    {projectData.clientEmail && (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                                        <EmailIcon sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem', lg: '1.375rem', xl: '1.5rem' }, color: 'text.secondary' }} />
                                        <Typography variant="body2" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, color: 'text.primary' }}>
                                          {projectData.clientEmail}
                                        </Typography>
                                      </Box>
                                    )}
                                    {projectData.clientPhone && (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                                        <Phone sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem', lg: '1.375rem', xl: '1.5rem' }, color: 'text.secondary' }} />
                                        <Typography variant="body2" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, color: 'text.primary' }}>
                                          {projectData.clientPhone}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Stack>
                                </Box>
                              </>
                            )}

                            {/* Location */}
                            {projectData.location && (
                              <>
                                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                                <Box>
                                  <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' }, display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 }, mb: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 } }}>
                                    <LocationOn sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.125rem', lg: '1.25rem', xl: '1.375rem' } }} />
                                    Lokasjon
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, color: 'text.primary', mt: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                                    {projectData.location}
                                  </Typography>
                                </Box>
                              </>
                            )}

                            {/* Event Date */}
                            {projectData.eventDate && (
                              <>
                                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                                <Box>
                                  <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' }, display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 }, mb: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 } }}>
                                    <Event sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.125rem', lg: '1.25rem', xl: '1.375rem' } }} />
                                    Arrangementsdato
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, color: 'text.primary', mt: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                                    {new Date(projectData.eventDate).toLocaleDateString('no-NO', {
                                      day: '2-digit',
                                      month: 'long',
                                      year: 'numeric',
                                    })}
                                  </Typography>
                                </Box>
                              </>
                            )}

                            {/* Description */}
                            {projectData.description && (
                              <>
                                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                                <Box>
                                  <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' }, display: 'block', mb: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 } }}>
                                    Beskrivelse
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, color: 'text.primary', whiteSpace: 'pre-wrap' }}>
                                    {projectData.description}
                                  </Typography>
                                </Box>
                              </>
                            )}

                            {/* Team Members */}
                            {(projectData.collaborators?.length > 0 || projectData.crew?.length > 0) && (
                              <>
                                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                                <Box>
                                  <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' }, display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 }, mb: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                                    <Groups sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.125rem', lg: '1.25rem', xl: '1.375rem' } }} />
                                    Produksjonsteam
                                  </Typography>
                                  <Stack spacing={{ xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 }} sx={{ mt: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                                    {(projectData.collaborators || projectData.crew || []).slice(0, 5).map((member: any, index: number) => (
                                      <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                                        <PersonIcon sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem', lg: '1.375rem', xl: '1.5rem' }, color: 'text.secondary' }} />
                                        <Box sx={{ flex: 1 }}>
                                          <Typography variant="body2" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, color: 'text.primary', fontWeight: 500 }}>
                                            {member.name || member.contactInfo?.name || 'Ukjent'}
                                          </Typography>
                                          {(member.email || member.contactInfo?.email) && (
                                            <Typography variant="caption" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' }, color: 'text.secondary' }}>
                                              {member.email || member.contactInfo?.email}
                                            </Typography>
                                          )}
                                        </Box>
                                        {member.role && (
                                          <Chip 
                                            label={member.role} 
                                            size="small" 
                                            sx={{ 
                                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' },
                                              height: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 },
                                            }} 
                                          />
                                        )}
                                      </Box>
                                    ))}
                                    {((projectData.collaborators?.length || projectData.crew?.length || 0) > 5) && (
                                      <Typography variant="caption" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' }, color: 'text.secondary', fontStyle: 'italic' }}>
                                        + {((projectData.collaborators?.length || projectData.crew?.length || 0) - 5)} flere teammedlemmer
                                      </Typography>
                                    )}
                                  </Stack>
                                </Box>
                              </>
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    ) : (
                      // Project not found or not loaded - show error message
                      <Alert severity="error" sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' } }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' } }}>
                          Prosjektdetaljer kunne ikke lastes inn
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem', lg: '0.938rem', xl: '1rem' } }}>
                          Prosjektet må være lagret i databasen før split sheet kan signeres. Vennligst kontakt prosjektlederen.
                        </Typography>
                      </Alert>
                    )}

                    {/* Accept Project Details Checkbox - Only show if project data is loaded */}
                    {projectData && (
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={acceptedProjectDetails}
                            onChange={(e) => setAcceptedProjectDetails(e.target.checked)}
                            required
                            sx={{
                              color: brandColor,
                              '&.Mui-checked': {
                                color: brandColor,
                              },
                              '& .MuiSvgIcon-root': {
                                fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' },
                              },
                            }}
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, fontWeight: 500 }}>
                            Jeg bekrefter at jeg har lest og aksepterer prosjektdetaljene over
                          </Typography>
                        }
                        sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}
                      />
                    )}
                  </Box>
                  {projectData && <Divider sx={{ my: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }} />}
                </>
              )}

              {/* Email and Download Options */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, fontWeight: 600, fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' } }}>
                  Etter signering
                </Typography>
                
                <Stack spacing={{ xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={downloadPDF}
                        onChange={(e) => setDownloadPDF(e.target.checked)}
                        sx={{
                          color: brandColor,
                          '&.Mui-checked': {
                            color: brandColor,
                          },
                          '& .MuiSvgIcon-root': {
                            fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' },
                          },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                        <DownloadIcon sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem', lg: '1.375rem', xl: '1.5rem' } }} />
                        <Typography variant="body2" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' } }}>Last ned signert PDF</Typography>
                      </Box>
                    }
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={sendEmailCopy}
                        onChange={(e) => {
                          setSendEmailCopy(e.target.checked);
                          if (e.target.checked && !emailForCopy) {
                            setEmailForCopy(contributorEmail || '');
                          }
                        }}
                        sx={{
                          color: brandColor, 
                          '&.Mui-checked': {
                            color: brandColor,
                          },
                          '& .MuiSvgIcon-root': {
                            fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' },
                          },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                        <EmailIcon sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem', lg: '1.375rem', xl: '1.5rem' } }} />
                        <Typography variant="body2" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' } }}>Send kopi til e-post</Typography>
                      </Box>
                    }
                  />

                  {sendEmailCopy && (
                    <TextField
                      fullWidth
                      label="E-postadresse"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={emailForCopy}
                      onChange={(e) => setEmailForCopy(e.target.value)}
                      required
                      placeholder="din@epost.no"
                      helperText="En kopi av den signerte split sheet vil bli sendt til denne adressen"
                      sx={{ 
                        ml: { xs: 3.5, sm: 4, md: 4.5, lg: 5, xl: 5.5 },
                        '& .MuiInputBase-input': {
                          fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                          py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                          minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
                        },
                        '& .MuiInputLabel-root': {
                          fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                        },
                        '& .MuiFormHelperText-root': {
                          fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem', lg: '0.938rem', xl: '1rem' },
                        },
                      }}
                    />
                  )}
                </Stack>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, py: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }, gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
          <Button 
            onClick={() => {
              setShowSignDialog(false);
              setSignatureName('');
              setSignaturePin('');
              setSignaturePassword('');
              setSendEmailCopy(false);
              setEmailForCopy(contributorEmail || '');
              setProjectData(null);
              setAcceptedProjectDetails(false);
            }}
            sx={{
              fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
              px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
              py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
              minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
            }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSign}
            disabled={
              !signatureName || 
              signMutation.isPending ||
              (selectedSplitSheet?.require_pin_for_signature && !signaturePin) ||
              (selectedSplitSheet?.require_password_for_signature && !signaturePassword) ||
              (sendEmailCopy && !emailForCopy) ||
              // If split sheet has project_id, project data MUST be loaded and accepted
              (selectedSplitSheet?.project_id && (!projectData || !acceptedProjectDetails))
            }
            sx={{ 
              bgcolor: brandColor, 
              '&:hover': { bgcolor: brandColor },
              fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
              px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
              py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
              minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
            }}
          >
            {signMutation.isPending ? 'Signerer...' : 'Signer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}























