import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useParams } from 'wouter';
import PricingSelector from '../universal/shared/PricingSelector';
import { useClientServicePricing } from '../../services/ClientServicePricingService';

interface ContractEditingInterfaceProps {
  contractId?: string;
  onSave?: (contractData: any) => void;
  onCancel?: () => void;
  initialData?: {
    clientName?: string;
    clientEmail?: string;
    projectDescription?: string;
    totalAmount?: string | number;
    status?: string;
    projectId?: string;
  };
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

export default function ContractEditingInterface({
  contractId: propsContractId,
  onSave,
  onCancel,
  initialData,
  profession = 'photographer',
}: ContractEditingInterfaceProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  const params = useParams();
  const contractId = propsContractId || params.id;
  const { formatCurrency } = useClientServicePricing();

  const [contractData, setContractData] = useState({
    clientName:  '',
    clientEmail: '',
    projectDescription: '',
    totalAmount: '',
    status: 'draft',
    eventDate: '',
    eventLocation: '',
    notes: '',
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);

  // Fetch contract data if editing
  const { data: contract, isLoading, error } = useQuery({
    queryKey: ['/api/contracts', contractId],
    queryFn: () => apiRequest(`/api/contracts/${contractId}`),
    enabled: !!contractId,
    retry: false,
  });

  useEffect(() => {
    if (contract?.contract) {
      const data = contract.contract;
      const newData = {
        clientName: data.clientName || data.client_name || '',
        clientEmail: data.clientEmail || data.client_email || '',
        projectDescription: data.projectDescription || data.description || '',
        totalAmount: data.totalAmount || data.total_amount || '',
        status: data.status || 'draft',
        eventDate: data.eventDate || data.event_date || '',
        eventLocation: data.eventLocation || data.event_location || '',
        notes: data.notes || '',
      };
      setContractData(newData);
      setOriginalData(newData);
    } else if (initialData) {
      // Use initial data if provided (e.g., from split sheet)
      const newData = {
        clientName: initialData.clientName || '',
        clientEmail: initialData.clientEmail || '',
        projectDescription: initialData.projectDescription || '',
        totalAmount: initialData.totalAmount?.toString() || '',
        status: initialData.status || 'draft',
        eventDate: '',
        eventLocation: '',
        notes: '',
      };
      setContractData(newData);
      setOriginalData(newData);
    }
  }, [contract, initialData]);

  const handleChange = (field: string, value: any) => {
    setContractData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const updateContractMutation = useMutation({
    mutationFn: async (data: any) => {
      if (contractId) {
        return apiRequest(`/api/contracts/${contractId}`, {
          method: 'PUT',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            projectDescription: data.projectDescription,
            totalAmount: parseFloat(data.totalAmount) || 0,
            status: data.status,
            eventDate: data.eventDate || null,
            eventLocation: data.eventLocation || null,
            notes: data.notes || null,
          }),
        });
      } else {
        return apiRequest('/api/contracts', {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            clientName: data.clientName,
            clientEmail: data.clientEmail,
            projectDescription: data.projectDescription,
            totalAmount: parseFloat(data.totalAmount) || 0,
            status: data.status || 'draft',
            eventDate: data.eventDate || null,
            eventLocation: data.eventLocation || null,
            notes: data.notes || null,
          }),
        });
      }
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', contractId] });
      setHasChanges(false);
      if (onSave) {
        onSave(response.contract || response);
      }
    },
  });

  const deleteContractMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/contracts/${contractId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      if (onCancel) {
        onCancel();
      }
    },
  });

  const handleSave = () => {
    updateContractMutation.mutate(contractData);
  };

  const handleCancel = () => {
    if (originalData) {
      setContractData(originalData);
    }
    setHasChanges(false);
    if (onCancel) {
      onCancel();
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && contractId) {
    return (
      <Alert severity="error">
        Feil ved lasting av kontrakt. Kontrakt kan være slettet eller du har ikke tilgang.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <DescriptionIcon sx={{ color: theming.colors.primary, fontSize: 32 }} />
              <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                {contractId ? 'Rediger Kontrakt' : 'Opprett Ny Kontrakt'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {contractId && (
                <Tooltip title="Slett kontrakt">
                  <IconButton
                    color="error"
                    onClick={() => {
                      if (window.confirm('Er du sikker på at du vil slette denne kontrakten?')) {
                        deleteContractMutation.mutate();
                      }
                    }}
                    disabled={deleteContractMutation.isPending}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={handleCancel}
                disabled={updateContractMutation.isPending}
              >
                Avbryt
              </Button>
              <Button
                variant="contained"
                startIcon={updateContractMutation.isPending ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={!hasChanges || updateContractMutation.isPending}
                sx={{ bgcolor: theming.colors.primary }}
              >
                {updateContractMutation.isPending ? 'Lagrer...' : 'Lagre'}
              </Button>
            </Box>
          </Box>

          {hasChanges && (
            <Alert severity="info" sx={{ mb: 3 }}>
              Du har ulagrede endringer
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Grunnleggende Informasjon</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Klientnavn"
                        value={contractData.clientName}
                        onChange={(e) => handleChange('clientName', e.target.value)}
                        fullWidth
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Klient E-post"
                        type="email"
                        value={contractData.clientEmail}
                        onChange={(e) => handleChange('clientEmail', e.target.value)}
                        fullWidth
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Prosjektbeskrivelse"
                        value={contractData.projectDescription}
                        onChange={(e) => handleChange('projectDescription', e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Total Beløp (NOK)"
                        type="number"
                        value={contractData.totalAmount}
                        onChange={(e) => handleChange('totalAmount', e.target.value)}
                        fullWidth
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                          value={contractData.status}
                          label="Status"
                          onChange={(e) => handleChange('status', e.target.value)}
                        >
                          <MenuItem value="draft">Utkast</MenuItem>
                          <MenuItem value="active">Aktiv</MenuItem>
                          <MenuItem value="completed">Fullført</MenuItem>
                          <MenuItem value="cancelled">Kansellert</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>

            {/* Event Details */}
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Event Detaljer</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Event Dato"
                        type="date"
                        value={contractData.eventDate}
                        onChange={(e) => handleChange('eventDate', e.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Event Lokasjon"
                        value={contractData.eventLocation}
                        onChange={(e) => handleChange('eventLocation', e.target.value)}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>

            {/* Additional Notes */}
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Notater</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField
                    label="Interne Notater"
                    value={contractData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    fullWidth
                    multiline
                    rows={4}
                    helperText="Disse notatene er kun synlige for deg, ikke for klienten"
                  />
                </AccordionDetails>
              </Accordion>
            </Grid>

            {/* Pricing & Packages */}
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Priser & Pakker</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <PricingSelector
                    onSelectPackage={(pkg) => {
                      setContractData((prev) => ({
                        ...prev,
                        totalAmount: pkg.basePrice?.toString() || prev.totalAmount,
                        projectDescription: prev.projectDescription || pkg.description || prev.projectDescription,
                      }));
                      setHasChanges(true);
                    }}
                    onSelectQuote={(quote) => {
                      setContractData((prev) => ({
                        ...prev,
                        totalAmount: quote.totalAmount?.toString() || prev.totalAmount,
                        clientName: quote.clientId || prev.clientName,
                        projectDescription: prev.projectDescription || quote.description || prev.projectDescription,
                      }));
                      setHasChanges(true);
                    }}
                  />
                </AccordionDetails>
              </Accordion>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
