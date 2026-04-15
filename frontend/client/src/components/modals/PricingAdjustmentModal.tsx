// @ts-nocheck
/**
 * CreatorHub Norge - Pricing Adjustment Modal
 * Connected to price administration endpoints with local-safe fallback behavior.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
  LinearProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Category as CategoryIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  LocalOffer as PriceIcon,
  Save as SaveIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import { useClientServicePricing } from '../../services/ClientServicePricingService';

interface PricingAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  profession: string;
  onPricingUpdated?: (pricing: PricingStructurePayload) => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface PricingStructurePayload {
  profession: string;
  userId: string | null;
  basePrice: number;
  hourlyRate: number;
  fullDayRate: number;
  minimumPrice: number;
  maximumPrice: number;
  seasonFactor: number;
  description: string;
  includedServices: string[];
  extraCosts: Array<{ name: string; amount: number }>;
  isDefault: boolean;
}

interface PricingPackagePayload {
  id?: number | string;
  name: string;
  description: string;
  profession: string;
  basePrice: number;
  ratePerImage: number;
  imageCount: number;
  hourlyRate: number;
  includedServices: string[];
  isDefault: boolean;
}

interface PricingStructureApiRecord extends Partial<PricingStructurePayload> {
  id?: number | string;
}

interface PricingPackageApiRecord extends Partial<PricingPackagePayload> {
  id?: number | string;
}

function safeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function normalizePricingStructure(
  record: PricingStructureApiRecord | null,
  profession: string,
  userId: string | null,
): PricingStructurePayload {
  return {
    profession,
    userId,
    basePrice: safeNumber(record?.basePrice, 1200),
    hourlyRate: safeNumber(record?.hourlyRate, 1800),
    fullDayRate: safeNumber(record?.fullDayRate, 12000),
    minimumPrice: safeNumber(record?.minimumPrice, 1000),
    maximumPrice: safeNumber(record?.maximumPrice, 60000),
    seasonFactor: safeNumber(record?.seasonFactor, 1),
    description: safeString(record?.description, ''),
    includedServices: safeStringArray(record?.includedServices),
    extraCosts: Array.isArray(record?.extraCosts)
      ? record.extraCosts
          .map((item) => {
            if (typeof item !== 'object' || item === null) {
              return null;
            }
            const candidate = item as { name?: unknown; amount?: unknown };
            return {
              name: safeString(candidate.name, 'Custom cost'),
              amount: safeNumber(candidate.amount, 0),
            };
          })
          .filter((item): item is { name: string; amount: number } => item !== null)
      : [],
    isDefault: Boolean(record?.isDefault),
  };
}

function normalizePricingPackage(
  record: PricingPackageApiRecord | null,
  profession: string,
): PricingPackagePayload {
  return {
    id: record?.id,
    name: safeString(record?.name, 'Standard Package'),
    description: safeString(record?.description, ''),
    profession,
    basePrice: safeNumber(record?.basePrice, 9500),
    ratePerImage: safeNumber(record?.ratePerImage, 250),
    imageCount: safeNumber(record?.imageCount, 40),
    hourlyRate: safeNumber(record?.hourlyRate, 1800),
    includedServices: safeStringArray(record?.includedServices),
    isDefault: Boolean(record?.isDefault),
  };
}

const PricingAdjustmentModal: React.FC<PricingAdjustmentModalProps> = ({
  open,
  onClose,
  profession,
  onPricingUpdated,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const theming = useTheming(profession);
  const { formatCurrency, calculateMVA, getTotalWithMVA } = useClientServicePricing();

  const userId = user?.id ?? null;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [formData, setFormData] = useState<PricingStructurePayload>(
    normalizePricingStructure(null, profession, userId),
  );
  const [selectedPackage, setSelectedPackage] = useState<PricingPackagePayload>(
    normalizePricingPackage(null, profession),
  );

  const pricingStructuresQuery = useQuery({
    queryKey: ['price-administration-structures', profession],
    enabled: open,
    queryFn: async (): Promise<PricingStructureApiRecord[]> => {
      try {
        const data = await apiRequest(
          `/api/price-administration/pricing-structures?profession=${encodeURIComponent(profession)}`,
        );
        return Array.isArray(data) ? (data as PricingStructureApiRecord[]) : [];
      } catch {
        return [];
      }
    },
  });

  const packageQuery = useQuery({
    queryKey: ['price-packages', userId, profession],
    enabled: open,
    queryFn: async (): Promise<PricingPackageApiRecord[]> => {
      try {
        const path = userId
          ? `/api/pricing/packages/${encodeURIComponent(userId)}`
          : `/api/pricing/packages?profession=${encodeURIComponent(profession)}`;
        const data = await apiRequest(path);
        return Array.isArray(data) ? (data as PricingPackageApiRecord[]) : [];
      } catch {
        return [];
      }
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const defaultStructure =
      pricingStructuresQuery.data?.find((structure) => structure.isDefault) ??
      pricingStructuresQuery.data?.[0] ??
      null;

    setFormData(normalizePricingStructure(defaultStructure, profession, userId));

    const defaultPackage =
      packageQuery.data?.find((pkg) => pkg.isDefault) ??
      packageQuery.data?.[0] ??
      null;

    setSelectedPackage(normalizePricingPackage(defaultPackage, profession));
  }, [open, pricingStructuresQuery.data, packageQuery.data, profession, userId]);

  const saveStructureMutation = useMutation({
    mutationFn: async (payload: PricingStructurePayload): Promise<void> => {
      await apiRequest('/api/price-administration/pricing-structures', {
        method: 'POST',
        body: payload,
      });
    },
  });

  const savePackageMutation = useMutation({
    mutationFn: async (payload: PricingPackagePayload): Promise<void> => {
      await apiRequest('/api/pricing/packages', {
        method: 'POST',
        body: {
          ...payload,
          userId,
        },
      });
    },
  });

  const loading = pricingStructuresQuery.isLoading || packageQuery.isLoading;

  const previewSubtotal = useMemo(() => {
    const base = formData.basePrice;
    const count = selectedPackage.imageCount;
    return Math.max(0, base * count * formData.seasonFactor);
  }, [formData.basePrice, formData.seasonFactor, selectedPackage.imageCount]);

  const previewMva = useMemo(() => calculateMVA(previewSubtotal), [calculateMVA, previewSubtotal]);
  const previewTotal = useMemo(
    () => getTotalWithMVA(previewSubtotal),
    [getTotalWithMVA, previewSubtotal],
  );

  const handleSave = async (): Promise<void> => {
    setSaveStatus('saving');
    setErrorMessage('');

    try {
      await saveStructureMutation.mutateAsync(formData);
      await savePackageMutation.mutateAsync(selectedPackage);

      queryClient.invalidateQueries({ queryKey: ['price-administration-structures', profession] });
      queryClient.invalidateQueries({ queryKey: ['price-packages', userId, profession] });
      onPricingUpdated?.(formData);
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save pricing');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle
        sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <PriceIcon fontSize="small" />
          <Typography variant="h6">Prisjustering - {profession}</Typography>
        </Stack>
        <IconButton color="inherit" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
          Endringer i priser påvirker nye tilbud, nye prosjekter og fremtidige estimater.
        </Alert>

        {loading ? <LinearProgress sx={{ mb: 2 }} /> : null}

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ color: theming.colors.primary }}>
              Grunnleggende prisstruktur
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Grunnpris per bilde"
                  type="number"
                  value={formData.basePrice}
                  onChange={(event) => {
                    const basePrice = safeNumber(event.target.value, 0);
                    setFormData((previous) => ({ ...previous, basePrice }));
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Timepris"
                  type="number"
                  value={formData.hourlyRate}
                  onChange={(event) => {
                    const hourlyRate = safeNumber(event.target.value, 0);
                    setFormData((previous) => ({ ...previous, hourlyRate }));
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Dagspris"
                  type="number"
                  value={formData.fullDayRate}
                  onChange={(event) => {
                    const fullDayRate = safeNumber(event.target.value, 0);
                    setFormData((previous) => ({ ...previous, fullDayRate }));
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Minpris"
                  type="number"
                  value={formData.minimumPrice}
                  onChange={(event) => {
                    const minimumPrice = safeNumber(event.target.value, 0);
                    setFormData((previous) => ({ ...previous, minimumPrice }));
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Makspris"
                  type="number"
                  value={formData.maximumPrice}
                  onChange={(event) => {
                    const maximumPrice = safeNumber(event.target.value, 0);
                    setFormData((previous) => ({ ...previous, maximumPrice }));
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Sesongfaktor"
                  type="number"
                  inputProps={{ step: 0.1, min: 0.5, max: 2 }}
                  value={formData.seasonFactor}
                  onChange={(event) => {
                    const seasonFactor = safeNumber(event.target.value, 1);
                    setFormData((previous) => ({ ...previous, seasonFactor }));
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Beskrivelse"
                  value={formData.description}
                  onChange={(event) => {
                    const description = event.target.value;
                    setFormData((previous) => ({ ...previous, description }));
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isDefault}
                      onChange={(event) => {
                        const isDefault = event.target.checked;
                        setFormData((previous) => ({ ...previous, isDefault }));
                      }}
                    />
                  }
                  label="Sett som standard prisprofil"
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Accordion sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center">
              <CategoryIcon fontSize="small" />
              <Typography variant="subtitle1" sx={{ color: theming.colors.primary }}>
                Pakkeoppsett
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Pakkenavn"
                  value={selectedPackage.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setSelectedPackage((previous) => ({ ...previous, name }));
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Antall bilder"
                  type="number"
                  value={selectedPackage.imageCount}
                  onChange={(event) => {
                    const imageCount = safeNumber(event.target.value, 0);
                    setSelectedPackage((previous) => ({ ...previous, imageCount }));
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Pakkepris"
                  type="number"
                  value={selectedPackage.basePrice}
                  onChange={(event) => {
                    const basePrice = safeNumber(event.target.value, 0);
                    setSelectedPackage((previous) => ({ ...previous, basePrice }));
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Pris per bilde"
                  type="number"
                  value={selectedPackage.ratePerImage}
                  onChange={(event) => {
                    const ratePerImage = safeNumber(event.target.value, 0);
                    setSelectedPackage((previous) => ({ ...previous, ratePerImage }));
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Pakke beskrivelse"
                  value={selectedPackage.description}
                  onChange={(event) => {
                    const description = event.target.value;
                    setSelectedPackage((previous) => ({ ...previous, description }));
                  }}
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Card sx={{ mt: 2, border: '1px solid', borderColor: 'success.light' }}>
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="subtitle1" sx={{ color: theming.colors.primary }}>
                Prisforhandsvisning
              </Typography>
              <Typography variant="body2">
                Subtotal: <strong>{formatCurrency(previewSubtotal, 'NOK')}</strong>
              </Typography>
              <Typography variant="body2">
                MVA (25%): <strong>{formatCurrency(previewMva, 'NOK')}</strong>
              </Typography>
              <Typography variant="body1">
                Total: <strong>{formatCurrency(previewTotal, 'NOK')}</strong>
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip label={`Bilder: ${selectedPackage.imageCount}`} size="small" />
                <Chip label={`Sesongfaktor: ${formData.seasonFactor.toFixed(2)}`} size="small" />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {saveStatus === 'saved' ? (
          <Alert icon={<CheckCircleIcon />} severity="success" sx={{ mt: 2 }}>
            Prisinnstillinger lagret.
          </Alert>
        ) : null}

        {saveStatus === 'error' ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage || 'Klarte ikke lagre prisinnstillinger.'}
          </Alert>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Lukk</Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={saveStatus === 'saving' || loading}
          onClick={handleSave}
          sx={theming.getThemedButtonSx()}
        >
          {saveStatus === 'saving' ? 'Lagrer...' : 'Lagre prisinnstillinger'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PricingAdjustmentModal;
