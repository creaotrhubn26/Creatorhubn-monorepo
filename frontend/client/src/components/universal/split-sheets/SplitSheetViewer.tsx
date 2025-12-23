/**
 * Split Sheet Viewer
 * Read-only view for split sheets with signature status and PDF export
 * Now with profession-specific theming support
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  Divider,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Alert,
  Grid,
  IconButton,
  Tooltip,
  Avatar,
  Tabs,
  Tab,
  alpha
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  Share as ShareIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Close as CloseIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Description as GoogleDocIcon
} from '@mui/icons-material';
import SplitSheetPDFGenerator from './SplitSheetPDFGenerator';
import SplitSheetExport from './SplitSheetExport';
import SplitSheetRevenueTracker from './SplitSheetRevenueTracker';
import SplitSheetPaymentHistory from './SplitSheetPaymentHistory';
import SplitSheetComments from './SplitSheetComments';
import SplitSheetLegalReferences from './SplitSheetLegalReferences';
import SplitSheetLegalSuggestions from './SplitSheetLegalSuggestions';
import SplitSheetSecuritySettings from './SplitSheetSecuritySettings';
import RelatedContractsSection from './RelatedContractsSection';
import PricingInfoSection from './PricingInfoSection';
import { useMutation } from '@tanstack/react-query';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';
import getProfessionIcon from '@/utils/profession-icons';
import type { 
  SplitSheet, 
  STATUS_DISPLAY_NAMES, 
  STATUS_COLORS,
  ROLE_DISPLAY_NAMES
} from './types';
import { STATUS_DISPLAY_NAMES as STATUS_NAMES, STATUS_COLORS as STATUS_COL, ROLE_DISPLAY_NAMES as ROLE_NAMES } from './types';

interface SplitSheetViewerProps {
  splitSheet: SplitSheet;
  onClose?: () => void;
  onViewContract?: (contract: any) => void;
  onCreateContract?: () => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

export default function SplitSheetViewer({
  splitSheet,
  onClose,
  onViewContract,
  onCreateContract,
  profession = 'music_producer',
}: SplitSheetViewerProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [viewTab, setViewTab] = useState(0);
  
  // Get profession-specific styling
  const { getUserProfessionColor, getProfessionDisplayName } = useDynamicProfessions();
  const professionColor = getUserProfessionColor(profession);
  const professionDisplayName = getProfessionDisplayName(profession);
  const professionIcon = getProfessionIcon(profession);

  // Google e-signature mutation
  const googleESignatureMutation = useMutation({
    mutationFn: async (splitSheetId: string) => {
      const response = await apiRequest(`/api/split-sheets/${splitSheetId}/google-esignature, `, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (response) => {
      if (response.data?.shareUrl) {
        window.open(response.data.shareUrl , '_blank');
        alert('Google Doc opprettet og delt med bidragsytere!');
      }
    },
    onError: (error: any) => {
      console.error('Error creating Google Doc: ', error);
      alert('Feil ved opprettelse av Google Doc. Sjekk at Google Drive er koblet til.');
    },
  });

  // Fetch full split sheet details if needed
  const { data: fullSplitSheetData } = useQuery({
    queryKey: ['split-sheet', splitSheet.id],
    queryFn: async () => {
      if (!splitSheet.id) return null;
      const response = await apiRequest(`/api/split-sheets/${splitSheet.id}`);
      return response;
    },
    enabled: !!splitSheet.id && (!splitSheet.contributors || splitSheet.contributors.length === 0),
    initialData: { data: splitSheet }
  });

  const fullSplitSheet: SplitSheet = fullSplitSheetData?.data || splitSheet;
  const contributors = fullSplitSheet.contributors || [];

  const handleExportPDF = async () => {
    if (!fullSplitSheet.id) return;
    
    setIsGeneratingPDF(true);
    try {
      const response = await apiRequest(`/api/split-sheets/${fullSplitSheet.id}/pdf`);
      // In a real implementation, this would download the PDF
      // For now, we'll just show a message
      alert('PDF eksport funksjonalitet vil bli implementert snart');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Feil ved generering av PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (!fullSplitSheet.id) return;
    
    try {
      await apiRequest(`/api/split-sheets/${fullSplitSheet.id}/share`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      alert('Split sheet har blitt delt med bidragsyterne');
    } catch (error) {
      console.error('Error sharing split sheet:', error);
      alert('Feil ved deling av split sheet');
    }
  };

  const signedCount = contributors.filter(c => c.signed_at).length;
  const totalCount = contributors.length;
  const allSigned = signedCount === totalCount && totalCount > 0;

  return (
    <Box sx={{ p: 2 }}>
      {/* Header Actions */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 70, mb: 0.5 }}>
            {fullSplitSheet.title}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <Chip
              label={STATUS_NAMES[fullSplitSheet.status]}
              size="small"
              sx={{
                bgcolor: `${STATUS_COL[fullSplitSheet.status]}20`,
                color: STATUS_COL[fullSplitSheet.status],
                border: `1px solid ${STATUS_COL[fullSplitSheet.status]}40`
              }}
            />
            {fullSplitSheet.project_id && (
              <Chip label="Koblet til prosjekt" size="small" variant="outlined" />
            )}
            {fullSplitSheet.track_id && (
              <Chip label="Koblet til spor" size="small" variant="outlined" />
            )}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <SplitSheetPDFGenerator splitSheet={fullSplitSheet} />
          <SplitSheetExport 
            splitSheetId={fullSplitSheet.id || ''} 
            splitSheetTitle={fullSplitSheet.title}
          />
          <Tooltip title="Opprett Google Doc for e-signatur">
            <Button
              variant="outlined"
              startIcon={<GoogleDocIcon />}
              onClick={() => {
                if (fullSplitSheet.id) {
                  googleESignatureMutation.mutate(fullSplitSheet.id);
                }
              }}
              disabled={googleESignatureMutation.isPending || !fullSplitSheet.id}
              size="small"
              sx={{ borderColor: '#4285f4', color: '#4285f4' }}
            >
              {googleESignatureMutation.isPending ? 'Oppretter...' : 'Google E-Signatur'}
            </Button>
          </Tooltip>
          <Tooltip title="Skriv ut">
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              size="small"
            >
              Skriv ut
            </Button>
          </Tooltip>
          <Tooltip title="Del">
            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={handleShare}
              size="small"
            >
              Del
            </Button>
          </Tooltip>
          {onClose && (
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          )}
        </Stack>
      </Stack>

      {/* Description */}
      {fullSplitSheet.description && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="body1" color="text.secondary">
              {fullSplitSheet.description}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Signature Status */}
      {totalCount > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600}}>
                Signaturstatus
              </Typography>
              <Chip
                icon={allSigned ? <CheckCircleIcon /> : <PendingIcon />}
                label={`${signedCount} av ${totalCount} signert`}
                color={allSigned ? 'success' : 'warning'}
                variant="outlined"
              />
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(signedCount / totalCount) * 100}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </CardContent>
        </Card>
      )}

      {/* Contributors Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Bidragsytere og eierskap
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600}}>Navn</TableCell>
                  <TableCell sx={{ fontWeight: 600}}>Rolle</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600}}>Prosentandel</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600}}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contributors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Ingen bidragsytere registrert
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  contributors
                    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                    .map((contributor, index) => (
                      <TableRow key={contributor.id || index} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: '#9f7aea' }}>
                              {contributor.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600}}>
                                {contributor.name}
                              </Typography>
                              {contributor.email && (
                                <Typography variant="caption" color="text.secondary">
                                  {contributor.email}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={ROLE_NAMES[contributor.role]}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 600}}>
                            {contributor.percentage.toFixed(2)}%
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {contributor.signed_at ? (
                            <Chip
                              icon={<CheckCircleIcon />}
                              label="Signert"
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          ) : (
                            <Chip
                              icon={<PendingIcon />}
                              label="Ikke signert"
                              size="small"
                              color="warning"
                              variant="outlined"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                )}
                {contributors.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={2} sx={{ fontWeight: 700}}>
                      <Typography variant="body1" sx={{ fontWeight: 700}}>
                        Totalt
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body1" sx={{ fontWeight: 700}}>
                        {fullSplitSheet.total_percentage?.toFixed(2) || 
                         contributors.reduce((sum, c) => sum + c.percentage, 0).toFixed(2)}%
                      </Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Metadata */}
      {(fullSplitSheet.created_at || fullSplitSheet.completed_at) && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Informasjon
            </Typography>
            <Grid container spacing={2}>
              {fullSplitSheet.created_at && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2">
                    <strong>Opprettet:</strong>{' '}
                    {new Date(fullSplitSheet.created_at).toLocaleDateString('no-NO', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Typography>
                </Grid>
              )}
              {fullSplitSheet.completed_at && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2">
                    <strong>Fullført:</strong>{', '}
                    {new Date(fullSplitSheet.completed_at).toLocaleDateString('no-NO', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Tabs for additional views */}
      {fullSplitSheet.id && (
        <>
          <Divider sx={{ my: 3 }} />
          <Tabs value={viewTab} onChange={(_, v) => setViewTab(v)} sx={{ mb: 2 }}>
            <Tab label="Oversikt" />
            <Tab label="Inntekt" />
            <Tab label="Betalinger" />
            <Tab label="Kommentarer" />
            <Tab label="Juridisk" />
            <Tab label="Sikkerhet" />
          </Tabs>
        </>
      )}

      {/* Overview Tab Content */}
      {viewTab === 0 && (
        <Box>
          {/* Contributors and metadata already shown above */}
          
          {/* Related Contracts - Only if project_id exists */}
          {fullSplitSheet.project_id && onViewContract && onCreateContract && (
            <Box sx={{ mt: 3 }}>
              <RelatedContractsSection
                projectId={fullSplitSheet.project_id}
                splitSheetId={fullSplitSheet.id ||''}
                onViewContract={onViewContract}
                onCreateContract={onCreateContract}
              />
            </Box>
          )}

          {/* Pricing Information - If linked to contract */}
          {fullSplitSheet.project_id && (
            <Box sx={{ mt: 3 }}>
              <PricingInfoSection projectId={fullSplitSheet.project_id} />
            </Box>
          )}
        </Box>
      )}

      {/* Revenue Tab */}
      {viewTab === 1 && fullSplitSheet.id && (
        <Box>
          <SplitSheetRevenueTracker splitSheetId={fullSplitSheet.id} />
        </Box>
      )}

      {/* Payments Tab */}
      {viewTab === 2 && fullSplitSheet.id && (
        <Box>
          <SplitSheetPaymentHistory splitSheetId={fullSplitSheet.id} />
        </Box>
      )}

      {/* Comments Tab */}
      {viewTab === 3 && fullSplitSheet.id && (
        <Box>
          <SplitSheetComments splitSheetId={fullSplitSheet.id} />
        </Box>
      )}

      {/* Legal Tab */}
      {viewTab === 4 && fullSplitSheet.id && (
        <Box>
          <Stack spacing={3}>
            <SplitSheetLegalSuggestions splitSheetId={fullSplitSheet.id} />
            <SplitSheetLegalReferences splitSheetId={fullSplitSheet.id} />
          </Stack>
        </Box>
      )}

      {/* Security Tab */}
      {viewTab === 5 && fullSplitSheet.id && (
        <Box>
          <SplitSheetSecuritySettings 
            splitSheetId={fullSplitSheet.id}
            onUpdate={() => {
              // Refresh split sheet data if needed
            }}
          />
        </Box>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </Box>
  );
}
