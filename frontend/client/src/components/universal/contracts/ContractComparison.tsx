// @ts-nocheck
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  CompareArrows as CompareIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useTheming } from '../../../utils/theming-helper';

interface Contract {
  id: string;
  clientName: string;
  projectDescription: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  eventDate?: string;
  eventLocation?: string;
}

interface ContractComparisonProps {
  contracts: Contract[];
  onClose?: () => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
}

export default function ContractComparison({ 
  contracts, 
  onClose,
  profession = 'photographer'
}: ContractComparisonProps) {
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(
    new Set(contracts.slice(0, 3).map((c) => c.id))
  );

  const handleToggleContract = (contractId: string) => {
    const newSet = new Set(selectedContracts);
    if (newSet.has(contractId)) {
      newSet.delete(contractId);
    } else {
      if (newSet.size < 3) {
        // Limit to 3 contracts for comparison
        newSet.add(contractId);
      }
    }
    setSelectedContracts(newSet);
  };

  const comparisonData = Array.from(selectedContracts)
    .map((id) => contracts.find((c) => c.id === id))
    .filter(Boolean) as Contract[];

  const getComparisonValue = (field: keyof Contract, contract: Contract) => {
    switch (field) {
      case 'totalAmount':
        return `NOK ${contract.totalAmount.toLocaleString('no-NO')}`;
      case 'status':
        return contract.status;
      case 'createdAt':
        return new Date(contract.createdAt).toLocaleDateString('no-NO');
      case 'eventDate':
        return contract.eventDate ? new Date(contract.eventDate).toLocaleDateString('no-NO') : 'N/A';
      default:
        return (contract[field] as string) || 'N/A';
    }
  };

  const fields: Array<{ key: keyof Contract; label: string }> = [
    { key: 'clientName', label: 'Klient' },
    { key: 'projectDescription', label: 'Prosjektbeskrivelse' },
    { key: 'totalAmount', label: 'Beløp' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Opprettet' },
    { key: 'eventDate', label: 'Event Dato' },
    { key: 'eventLocation', label: 'Lokasjon' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 600}}>
          Sammenlign Kontrakter
        </Typography>
        {onClose && (
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      <Card sx={theming.getThemedCardSx()}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Velg kontrakter å sammenligne (maks 3)
          </Typography>
          <List>
            {contracts.map((contract) => (
              <ListItem
                key={contract.id}
                button
                onClick={() => handleToggleContract(contract.id)}
                sx={{
                  bgcolor: selectedContracts.has(contract.id) ? 'action.selected' : 'transparent', '&:hover': { bgcolor: 'action.hover' }}}
              >
                <ListItemText
                  primary={contract.clientName}
                  secondary={`${contract.projectDescription} • NOK ${contract.totalAmount.toLocaleString('no-NO')}`}
                />
                {selectedContracts.has(contract.id) ? (
                  <CheckIcon color="primary" />
                ) : (
                  <CancelIcon color="disabled" />
                )}
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      {comparisonData.length >= 2 && (
        <Card sx={{ mt: 3, ...theming.getThemedCardSx() }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Sammenligning
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Felt</TableCell>
                    {comparisonData.map((contract) => (
                      <TableCell key={contract.id} sx={{ fontWeight: 'bold' }}>
                        {contract.clientName}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fields.map((field) => {
                    const values = comparisonData.map((c) => getComparisonValue(field.key, c));
                    const allSame = values.every((v) => v === values[0]);

                    return (
                      <TableRow key={field.key}>
                        <TableCell component="th" scope="row">
                          {field.label}
                        </TableCell>
                        {comparisonData.map((contract, idx) => (
                          <TableCell
                            key={contract.id}
                            sx={{
                              bgcolor: allSame ? 'transparent' : 'rgba(255, 152, 0, 0.1)',
                              fontWeight: llSame ? 'normal' : 'bold'}}
                          >
                            {getComparisonValue(field.key, contract)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {comparisonData.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          Velg minst 2 kontrakter for å sammenligne
        </Alert>
      )}
    </Box>
  );
}























