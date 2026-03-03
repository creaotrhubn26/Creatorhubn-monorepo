/**
 * CreatorHub Norge - Quote Creation Modal
 * Quick quote creation from chat context.
 */

import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import {
  AttachMoney,
  CalendarToday,
  Person,
  PersonAdd,
  Receipt as ReceiptIcon,
  Send,
} from '@mui/icons-material';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';

interface ClientInfo {
  name: string;
  address: string;
  phoneNumber: string;
  email: string;
}

interface QuoteCreationModalProps {
  open: boolean;
  onClose: () => void;
  clientData: {
    id: string;
    name: string;
    email: string;
    profession: string;
    projectType?: string;
    budget?: number;
  };
  onQuoteCreated?: (quoteData: Record<string, unknown>) => void;
}

interface QuoteDraft {
  title: string;
  description: string;
  basePrice: number;
  additionalServices: string[];
  validUntil: string;
  notes: string;
}

type Step = 'quote' | 'client-info' | 'approvers';

const createDefaultValidUntil = (): string => {
  const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
};

const generateProjectId = (client: ClientInfo, approvers: ClientInfo[]): string => {
  const clientInitials = client.name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const approverInitials = approvers
    .map((approver) =>
      approver.name
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .toUpperCase(),
    )
    .join('');

  const suffix = Date.now().toString().slice(-4);
  return `${clientInitials || 'CL'}${approverInitials}-${suffix}`;
};

export default function QuoteCreationModal({
  open,
  onClose,
  clientData,
  onQuoteCreated,
}: QuoteCreationModalProps) {
  const { user } = useAuth();
  const theming = useTheming('photographer');

  const [step, setStep] = useState<Step>('quote');
  const [hasMultipleApprovers, setHasMultipleApprovers] = useState(false);

  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft>({
    title: `Tilbud for ${clientData.projectType || 'Prosjekt'}`,
    description: '',
    basePrice: clientData.budget ?? 0,
    additionalServices: [],
    validUntil: createDefaultValidUntil(),
    notes: '',
  });

  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    name: clientData.name || '',
    address: '',
    phoneNumber: '',
    email: clientData.email || '',
  });

  const [approvers, setApprovers] = useState<ClientInfo[]>([]);

  const totalPrice = useMemo(
    () => quoteDraft.basePrice + quoteDraft.additionalServices.filter(Boolean).length * 1000,
    [quoteDraft.basePrice, quoteDraft.additionalServices],
  );

  const createQuoteMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      apiRequest('/api/quotes/create', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: (data) => {
      if (data && typeof data === 'object') {
        onQuoteCreated?.(data as Record<string, unknown>);
      }
      onClose();
    },
  });

  const addApprover = () => {
    setApprovers((previous) => [
      ...previous,
      { name: '', address: '', phoneNumber: '', email: '' },
    ]);
  };

  const updateApprover = (index: number, field: keyof ClientInfo, value: string) => {
    setApprovers((previous) =>
      previous.map((approver, currentIndex) =>
        currentIndex === index ? { ...approver, [field]: value } : approver,
      ),
    );
  };

  const removeApprover = (index: number) => {
    setApprovers((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const addAdditionalService = () => {
    setQuoteDraft((previous) => ({
      ...previous,
      additionalServices: [...previous.additionalServices, ''],
    }));
  };

  const updateAdditionalService = (index: number, value: string) => {
    setQuoteDraft((previous) => ({
      ...previous,
      additionalServices: previous.additionalServices.map((service, currentIndex) =>
        currentIndex === index ? value : service,
      ),
    }));
  };

  const removeAdditionalService = (index: number) => {
    setQuoteDraft((previous) => ({
      ...previous,
      additionalServices: previous.additionalServices.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const canContinueFromQuote = Boolean(quoteDraft.title && quoteDraft.description);
  const canContinueFromClientInfo = Boolean(
    clientInfo.name && clientInfo.email && clientInfo.address && clientInfo.phoneNumber,
  );
  const canSubmit =
    !hasMultipleApprovers ||
    approvers.every(
      (approver) =>
        approver.name && approver.email && approver.address && approver.phoneNumber,
    );

  const submitQuote = () => {
    const projectId = generateProjectId(clientInfo, hasMultipleApprovers ? approvers : []);

    createQuoteMutation.mutate({
      ...quoteDraft,
      clientId: clientData.id,
      clientName: clientData.name,
      clientEmail: clientData.email,
      clientInfo,
      approvers: hasMultipleApprovers ? approvers : [],
      hasMultipleApprovers,
      profession: clientData.profession,
      status: 'pending',
      createdAt: new Date().toISOString(),
      createdBy: user && typeof user === 'object' && 'id' in user ? (user as { id?: string }).id : undefined,
      projectId,
      projectCreationData: {
        projectId,
        clientInfo,
        approvers: hasMultipleApprovers ? approvers : [],
        quoteDetails: quoteDraft,
      },
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon color="primary" />
          Opprett tilbud for {clientData.name}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, gap: 1 }}>
            <Chip
              label="1. Tilbud"
              color={step === 'quote' ? 'primary' : 'default'}
              variant={step === 'quote' ? 'filled' : 'outlined'}
            />
            <Chip
              label="2. Kundeinfo"
              color={step === 'client-info' ? 'primary' : 'default'}
              variant={step === 'client-info' ? 'filled' : 'outlined'}
            />
            <Chip
              label="3. Godkjennere"
              color={step === 'approvers' ? 'primary' : 'default'}
              variant={step === 'approvers' ? 'filled' : 'outlined'}
            />
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            Tilbudet sendes til {clientInfo.email || clientData.email}. Du får varsel når kunden svarer.
          </Alert>

          {step === 'quote' && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Tilbudstittel"
                  value={quoteDraft.title}
                  onChange={(event) =>
                    setQuoteDraft((previous) => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Beskrivelse av tjenester"
                  value={quoteDraft.description}
                  onChange={(event) =>
                    setQuoteDraft((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Grunnpris"
                  value={quoteDraft.basePrice}
                  onChange={(event) =>
                    setQuoteDraft((previous) => ({
                      ...previous,
                      basePrice: Number(event.target.value) || 0,
                    }))
                  }
                  InputProps={{
                    startAdornment: <AttachMoney sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Gyldig til"
                  value={quoteDraft.validUntil}
                  onChange={(event) =>
                    setQuoteDraft((previous) => ({
                      ...previous,
                      validUntil: event.target.value,
                    }))
                  }
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: <CalendarToday sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Tilleggstjenester
                </Typography>
                {quoteDraft.additionalServices.map((service, index) => (
                  <Box key={`service-${index}`} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      fullWidth
                      label={`Tilleggstjeneste ${index + 1}`}
                      value={service}
                      onChange={(event) => updateAdditionalService(index, event.target.value)}
                    />
                    <Button color="error" onClick={() => removeAdditionalService(index)}>
                      Fjern
                    </Button>
                  </Box>
                ))}
                <Button variant="outlined" onClick={addAdditionalService} startIcon={<PersonAdd />}>
                  Legg til tilleggstjeneste
                </Button>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Notater til kunden"
                  value={quoteDraft.notes}
                  onChange={(event) =>
                    setQuoteDraft((previous) => ({
                      ...previous,
                      notes: event.target.value,
                    }))
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">Totalpris:</Typography>
                  <Typography variant="h5" color="primary" sx={{ fontWeight: 'bold' }}>
                    {new Intl.NumberFormat('nb-NO', {
                      style: 'currency',
                      currency: 'NOK',
                    }).format(totalPrice)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          )}

          {step === 'client-info' && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person color="primary" />
                  Kundeinformasjon
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Navn"
                  value={clientInfo.name}
                  onChange={(event) =>
                    setClientInfo((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  type="email"
                  label="E-post"
                  value={clientInfo.email}
                  onChange={(event) =>
                    setClientInfo((previous) => ({
                      ...previous,
                      email: event.target.value,
                    }))
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Adresse"
                  value={clientInfo.address}
                  onChange={(event) =>
                    setClientInfo((previous) => ({
                      ...previous,
                      address: event.target.value,
                    }))
                  }
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Telefonnummer"
                  value={clientInfo.phoneNumber}
                  onChange={(event) =>
                    setClientInfo((previous) => ({
                      ...previous,
                      phoneNumber: event.target.value,
                    }))
                  }
                />
              </Grid>
            </Grid>
          )}

          {step === 'approvers' && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonAdd color="primary" />
                  Godkjennere
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={hasMultipleApprovers}
                      onChange={(event) => setHasMultipleApprovers(event.target.checked)}
                    />
                  }
                  label="Flere parter må godkjenne"
                />
              </Grid>

              {hasMultipleApprovers && (
                <Grid item xs={12}>
                  {approvers.map((approver, index) => (
                    <Box
                      key={`approver-${index}`}
                      sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}
                    >
                      <Typography variant="subtitle2" gutterBottom>
                        Godkjenner {index + 1}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            required
                            label="Navn"
                            value={approver.name}
                            onChange={(event) => updateApprover(index, 'name', event.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            required
                            type="email"
                            label="E-post"
                            value={approver.email}
                            onChange={(event) => updateApprover(index, 'email', event.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            required
                            label="Adresse"
                            value={approver.address}
                            onChange={(event) => updateApprover(index, 'address', event.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            required
                            label="Telefonnummer"
                            value={approver.phoneNumber}
                            onChange={(event) => updateApprover(index, 'phoneNumber', event.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Button color="error" variant="outlined" fullWidth onClick={() => removeApprover(index)}>
                            Fjern godkjenner
                          </Button>
                        </Grid>
                      </Grid>
                    </Box>
                  ))}
                  <Button variant="outlined" onClick={addApprover} startIcon={<PersonAdd />}>
                    Legg til godkjenner
                  </Button>
                </Grid>
              )}

              <Grid item xs={12}>
                <Alert severity="info">
                  Prosjekt-ID: <strong>{generateProjectId(clientInfo, hasMultipleApprovers ? approvers : [])}</strong>
                </Alert>
              </Grid>
            </Grid>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>

        {step !== 'quote' && (
          <Button onClick={() => setStep(step === 'approvers' ? 'client-info' : 'quote')}>Tilbake</Button>
        )}

        {step !== 'approvers' ? (
          <Button
            variant="contained"
            onClick={() => setStep(step === 'quote' ? 'client-info' : 'approvers')}
            disabled={(step === 'quote' && !canContinueFromQuote) || (step === 'client-info' && !canContinueFromClientInfo)}
            sx={theming.getThemedButtonSx()}
          >
            Neste
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={submitQuote}
            disabled={createQuoteMutation.isPending || !canSubmit}
            startIcon={<Send />}
            sx={theming.getThemedButtonSx()}
          >
            {createQuoteMutation.isPending ? 'Oppretter...' : 'Opprett og send tilbud'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
