// @ts-nocheck
/**
 * Contract View Component
 * Viser kontraktdetaljer for klienter
 */

import { useTheming } from '../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
import React from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
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
} from '@mui/material';
import {
  Description,
  Download,
  Close,
  CheckCircle,
  Event,
  Person,
  Euro,
} from '@mui/icons-material';

interface ContractViewProps {}

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
  additionalTerms?: string[]
}

export default function ContractView({}: ContractViewProps) {
  const { contractId } = useParams();
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');

  const {
    data: contract,
    isLoading,
    error,
} = useQuery<ContractDetails>({
    queryKey: ['/api/contracts', contractId],
    enabled: !!contractd,
});

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: '#0a0f10',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
      }}
      >
        <CircularProgress sx={{ color: '#ffa726',}} />
      </Box>
    );
}

  if (error || !contract) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0a0f10', p:  3 }}>
        <Alert severity="error" sx={{ maxWidth: 60, mx: 'auto', mt:  4 }}>
          Kunne ikke laste kontraktdetaljer. Kontrakten kan være utilgjengelig eller ikke eksistere.
        </Alert>
      </Box>
    );
}

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0f10', color: '#fff' }}>
      {/* Header */}
      <Box
        sx={{
          p:  3,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
      }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <Description sx={{ color: '#ffa720', fontSize: 32}} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, color: theming.colors.primary }}>
              Fotografikontrakt
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {contract.projectTitle}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap:  1 }}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            sx={{
              color: '#ffa720',
              borderColor: '#ffa726',
              '&:hover': {
                borderColor: '#ffb74d',
                bgcolor: 'rgba(255, 167, 38, 0.1)',
              },
          }}
          >
            Last ned PDF
          </Button>

          <IconButton onClick={() => window.close()} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <Close />
          </IconButton>
        </Box>
      </Box>

      {/* Contract Content */}
      <Box sx={{ maxWidth: 80, mx: 'auto', p:  4 }}>
        <Paper
          sx={{
            bgcolor: '#0f1410',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            overflow: 'hidden',
            ...theming.getThemedCardSx(),
          }}>
          {/* Status Header */}
          <Box
            sx={{
              p:  3,
              bgcolor: 'rgba(25, 167, 38, 0.1)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}
            >
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Kontraktdetaljer
              </Typography>
              <Chip
                icon={<CheckCircle />}
                label={contract.status === 'active' ? 'Aktiv' : contract.status}
                sx={{ bgcolor: '#4caf50', color: '#fff' }}
              />
            </Box>
          </Box>

          {/* Contract Details */}
          <Box sx={{ p:  3 }}>
            <Table>
              <TableBody>
                <TableRow sx={{ '&:last-child td': { border:  0 } }}>
                  <TableCell
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      border: 'none',
                      py:  1,
                  }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <Person fontSize="small" />
                      Klient: </Box>
                  </TableCell>
                  <TableCell
                    sx={{
                      color: '#fff',
                      border: 'none',
                      py:  1,
                      fontWeight: 60
                  }}
                  >
                    {contract.clientName}
                  </TableCell>
                </TableRow>

                <TableRow sx={{ '&:last-child td': { border:  0 } }}>
                  <TableCell
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      border: 'none',
                      py:  1,
                  }}
                  >
                    Fotograf: </TableCell>
                  <TableCell
                    sx={{
                      color: '#fff',
                      border: 'none',
                      py:  1,
                      fontWeight: 60
                  }}
                  >
                    {contract.photographerName}
                  </TableCell>
                </TableRow>

                <TableRow sx={{ '&:last-child td': { border:  0 } }}>
                  <TableCell
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      border: 'none',
                      py:  1,
                  }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <Event fontSize="small" />
                      Hendelsesdato: </Box>
                  </TableCell>
                  <TableCell
                    sx={{
                      color: '#fff',
                      border: 'none',
                      py:  1,
                      fontWeight: 60
                  }}
                  >
                    {new Date(contract.eventDate).toLocaleDateString('nb-NO')}
                  </TableCell>
                </TableRow>

                <TableRow sx={{ '&:last-child td': { border:  0 } }}>
                  <TableCell
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      border: 'none',
                      py:  1,
                  }}
                  >
                    Pakke: </TableCell>
                  <TableCell
                    sx={{
                      color: '#fff',
                      border: 'none',
                      py:  1,
                      fontWeight: 60
                  }}
                  >
                    {contract.packageType}
                  </TableCell>
                </TableRow>

                <TableRow sx={{ '&:last-child td': { border:  0 } }}>
                  <TableCell
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      border: 'none',
                      py:  1,
                  }}
                  >
                    Inkluderte bilder: </TableCell>
                  <TableCell
                    sx={{
                      color: '#ffa720',
                      border: 'none',
                      py:  1,
                      fontWeight: 60
                  }}
                  >
                    {contract.includedImages} bilder
                  </TableCell>
                </TableRow>

                <TableRow sx={{ '&:last-child td': { border:  0 } }}>
                  <TableCell
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      border: 'none',
                      py:  1,
                  }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <Euro fontSize="small" />
                      Total pris: </Box>
                  </TableCell>
                  <TableCell
                    sx={{
                      color: '#4caf50',
                      border: 'none',
                      py:  1,
                      fontWeight: 600,
                      fontSize: '1.1rem',
                  }}
                  >
                    {contract.totalPrice.toLocaleString('nb-NO')} {contract.currency}
                  </TableCell>
                </TableRow>

                <TableRow sx={{ '&:last-child td': { border:  0 } }}>
                  <TableCell
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      border: 'none',
                      py:  1,
                  }}
                  >
                    Betalingsbetingelser: </TableCell>
                  <TableCell sx={{ color: '#fff', border: 'none', py:  1 }}>
                    {contract.paymentTerms}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {contract.description && (
              <>
                <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 2 }}>
                    Beskrivelse
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
                    {contract.description}
                  </Typography>
                </Box>
              </>
            )}

            {contract.additionalTerms && contract.additionalTerms.length > 0 && (
              <>
                <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 2 }}>
                    Tilleggsbestemmelser
                  </Typography>
                  <Box component="ul" sx={{ pl: 2, color: 'rgba(255,255,255,0.8)' }}>
                    {contract.additionalTerms.map((term, index) => (
                      <Typography component="li" key={index} sx={{ mb: 1 }}>
                        {term}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              </>
            )}
          </Box>
        </Paper>

        {/* Footer Note */}
        <Box sx={{ mt:  3, textAlign: 'center',}}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            Dette dokumentet er generert elektronisk og er gyldig uten signatur.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
