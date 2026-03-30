/**
 * Contract Preview Modal Component
 * Elegant modal for viewing contract details within the same window
 */

import { useTheming } from '../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
  IconButton,
  Fade,
  Backdrop,
} from '@mui/material';
import {
  Description,
  Close,
  CheckCircle,
  Event,
  Person,
  Euro,
  Download,
} from '@mui/icons-material';

interface ContractPreviewModalProps {
  open: boolean;
  onClose: () => void;
  contractId?: string;
  projectId?: string;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

interface ContractDetails {
  id: string;
  clientName: string;
  photographerName: string;
  projectTitle: string;
  contractDate: string;
  eventDate: string;
  packageType: string;
  includedImages: number;
  totalPrice: number;
  currency: string;
  paymentTerms: string;
  status: string;
  description?: string;
  additionalTerms?: string[];
}

export default function ContractPreviewModal({ 
  open, 
  onClose, 
  contractId, 
  projectId,
  profession = 'photographer'
}: ContractPreviewModalProps) {
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);
  // Use demo contract if no contractId provided
  const queryId = contractId || 'demo/demo-contract-001';
  
  const { data: contract, isLoading, error } = useQuery<ContractDetails>({
    queryKey: ['/api/contracts', queryId],
    enabled: open
});

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0a0f10',
          color: '#fff',
          border: '1px solid rgba(255,167,38,0.3)',
          borderRadius: 3,
          maxHeight: '90vh'
        }
      }}
      BackdropComponent={Backdrop}
      BackdropProps={{
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(5px)'
        }
      }}
      TransitionComponent={Fade}
      transitionDuration={300}
    >
      {/* Header */}
      <DialogTitle sx={{ 
        p: 3, 
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {professionIcon && (
            <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
              {professionIcon}
            </Box>
          )}
          <Description sx={{ color: '#ffa720', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
              {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Kontraktdetaljer`
                : 'Kontraktdetaljer'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {contract?.projectTitle || 'Laster kontraktinformasjon...'}
            </Typography>
          </Box>
        </Box>

        <IconButton 
          onClick={onClose}
          sx={{ 
            color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' }
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ p: 0 }}>
        {isLoading ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: 300,
            flexDirection: 'column',
            gap: 2
          }}>
            <CircularProgress sx={{ color: '#ffa726' }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Laster kontraktdetaljer...
            </Typography>
          </Box>
        ) : error || !contract ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="error" sx={{ bgcolor: 'rgba(244,67,54,0.1)', color: '#fff' }}>
              Kunne ikke laste kontraktdetaljer. Kontrakten kan være utilgjengelig.
            </Alert>
          </Box>
        ) : (
          <Box sx={{ p: 3 }}>
            {/* Status Header */}
            <Box sx={{ 
              mb: 3,
              p: 2,
              bgcolor: 'rgba(255, 167, 38, 0.1)',
              borderRadius: 2,
              border: '1px solid rgba(255,167,38,0.3)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                {contract.projectTitle}
              </Typography>
              <Chip 
                icon={<CheckCircle />}
                label={contract.status === 'active' ? 'Aktiv kontrakt' : contract.status}
                sx={{ bgcolor: '#4caf50', color: '#fff' }}
              />
            </Box>

            {/* Contract Details Table */}
            <Paper sx={{ 
              bgcolor: '#0f1410', 
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 2,
              overflow: 'hidden',
              ...theming.getThemedCardSx()
            }}>
              <Table>
                <TableBody>
                  <TableRow sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)', border: 'none', py: 2, width: '40%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Person fontSize="small" />
                        Klient:
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: '#fff', border: 'none', py: 2, fontWeight: 600 }}>
                      {contract.clientName}
                    </TableCell>
                  </TableRow>
                  
                  <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.03)' }}>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)', border: 'none', py:  2 }}>
                      Fotograf: </TableCell>
                    <TableCell sx={{ color: '#fff', border: 'none', py: 2, fontWeight: 600 }}>
                      {contract.photographerName}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)', border: 'none', py:  2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <Event fontSize="small" />
                        Hendelsesdato: </Box>
                    </TableCell>
                    <TableCell sx={{ color: '#fff', border: 'none', py: 2, fontWeight: 600 }}>
                      {new Date(contract.eventDate).toLocaleDateString('nb-NO')}
                    </TableCell>
                  </TableRow>

                  <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.03)' }}>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)', border: 'none', py:  2 }}>
                      Pakke: </TableCell>
                    <TableCell sx={{ color: '#fff', border: 'none', py: 2, fontWeight: 600 }}>
                      {contract.packageType}
                    </TableCell>
                  </TableRow>

                  <TableRow sx={{ bgcolor: 'rgba(25,167,38,0.05)' }}>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)', border: 'none', py:  2 }}>
                      <Typography sx={{ fontWeight: 600 }}>Inkluderte bilder: </Typography>
                    </TableCell>
                    <TableCell sx={{ color: '#ffa720', border: 'none', py: 2, fontWeight: 700, fontSize: '1.1rem'}}>
                      {contract.includedImages} bilder
                    </TableCell>
                  </TableRow>

                  <TableRow sx={{ bgcolor: 'rgba(6,175,80,0.05)' }}>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)', border: 'none', py:  2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <Euro fontSize="small" />
                        <Typography sx={{ fontWeight: 600 }}>Total pris: </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: '#4caf50', border: 'none', py: 2, fontWeight: 700, fontSize: '1.2rem'}}>
                      {contract.totalPrice.toLocaleString('nb-NO,')} {contract.currency}
                    </TableCell>
                  </TableRow>

                  <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.03)' }}>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)', border: 'none', py:  2 }}>
                      Betalingsbetingelser: </TableCell>
                    <TableCell sx={{ color: '#fff', border: 'none', py:  2 }}>
                      {contract.paymentTerms}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>

            {contract.description && (
              <>
                <Divider sx={{ my:  3, borderColor: 'rgba(255,255,255,0.08)' }} />
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                    Beskrivelse
                  </Typography>
                  <Typography sx={{ 
                    color: 'rgba(255,255,255,0.82)', 
                    lineHeight: 1.6,
                    p:  2,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    borderRadius:  1,
                    border: '1px solid rgba(255,255,255,0.06)'
                }}>
                    {contract.description}
                  </Typography>
                </Box>
              </>
            )}

            {contract.additionalTerms && contract.additionalTerms.length > 0 && (
              <>
                <Divider sx={{ my:  3, borderColor: 'rgba(255,255,255,0.08)' }} />
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                    Tilleggsbestemmelser
                  </Typography>
                  <Box sx={{ 
                    p:  2,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    borderRadius:  1,
                    border: '1px solid rgba(255,255,255,0.06)'
                }}>
                    <Box component="ul" sx={{ pl: 2, m: 0, color: 'rgba(255,255,255,0.82)' }}>
                      {contract.additionalTerms.map((term, index) => (
                        <Typography component="li" key={index} sx={{ mb:  1 }}>
                          {term}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </>
            )}
          </Box>
        )}
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ 
        p:  3, 
        borderTop: '1px solid rgba(255,255,255,0.08)',
        gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={theming.getThemedIcon('download,')}
          onClick={() => {
            const contractIdForPdf = contractId || 'demo-contract-001';
            window.open(`/api/contracts/${contractIdForPdf}/pdf`, '_blank');
          }}
          sx={{
            color: '#ffa720',
            borderColor: '#ffa720', '&:hover': {
              borderColor: '#ffb740',
              bgcolor: 'rgba(25, 167, 38, 0.1)'
          }
        }}
        >
          Last ned PDF
        </Button>
        
        <Button variant="contained"
          onClick={onClose}
          sx={{
            bgcolor: '#ffa720',
            color: '#000',
            fontWeight: 600,
            px: 3, '&:hover': {
              bgcolor: '#ffb74d'
            },
            ...theming.getThemedButtonSx()
          }}>
          Lukk
        </Button>
      </DialogActions>
    </Dialog>
  );
}
