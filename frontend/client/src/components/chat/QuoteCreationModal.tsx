/**
 * CreatorHub Norge - Quote Creation Modal
 * Creates chat quotes from the shared price administration data sources.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  CalendarToday,
  DeleteOutline,
  Inventory2Outlined,
  LocalOfferOutlined,
  PercentOutlined,
  Receipt as ReceiptIcon,
  TuneOutlined,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';

interface QuoteCreationModalProps {
  open: boolean;
  onClose: () => void;
  modalZIndex?: number;
  clientData: {
    id: string;
    name: string;
    email: string;
    profession: string;
    projectType?: string;
    budget?: number;
    projectId?: string;
    projectName?: string;
    crmCustomerId?: string;
    crmDealId?: string;
  };
  onQuoteCreated?: (quoteData: Record<string, unknown>) => void;
}

interface AdminPackage {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  discountPercentage?: number;
  includedServices?: unknown;
  inclusions?: unknown;
  isVisible?: boolean;
  isActive?: boolean;
  profession?: string;
}

interface AdminPricingStructure {
  id: string;
  name: string;
  type?: string;
  profession?: string;
  serviceCategory?: string;
  description?: string;
  hourlyRate?: number;
  fullDayRate?: number;
  basePrice?: number;
  rates?: {
    hourlyRate?: number;
    fullDayRate?: number;
    packageRate?: number;
  };
}

interface AdminAdditionalCost {
  id: string;
  name: string;
  description?: string;
  amount: number;
  type?: string;
}

interface AdminDiscount {
  id: string;
  name: string;
  description?: string;
  discountValue: number;
  isPercentage?: boolean;
  minPurchase?: number;
  isActive?: boolean;
}

interface SelectedPricingEntry {
  id: string;
  quantity: number;
}

interface CustomLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const createDefaultValidUntil = (): string => {
  const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(value);

const readArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  return [];
};

const readCollection = <T,>(value: unknown, key: string): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return readArray<T>(record[key]);
  }

  return [];
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const getPackagePrice = (pkg: AdminPackage) => {
  const basePrice = toFiniteNumber(pkg.basePrice);
  const discountPercentage = toFiniteNumber(pkg.discountPercentage);
  if (discountPercentage > 0) {
    return Math.max(basePrice - (basePrice * discountPercentage) / 100, 0);
  }
  return basePrice;
};

const getPricingUnitPrice = (pricing: AdminPricingStructure) => {
  const rates = pricing.rates || {};
  return (
    toFiniteNumber(rates.packageRate) ||
    toFiniteNumber(pricing.basePrice) ||
    toFiniteNumber(rates.fullDayRate) ||
    toFiniteNumber(pricing.fullDayRate) ||
    toFiniteNumber(rates.hourlyRate) ||
    toFiniteNumber(pricing.hourlyRate)
  );
};

const describeInclusions = (pkg: AdminPackage) => {
  const inclusions = pkg.inclusions ?? pkg.includedServices;
  if (!inclusions) {
    return [];
  }

  if (Array.isArray(inclusions)) {
    return inclusions
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean)
      .slice(0, 4);
  }

  if (typeof inclusions === 'object') {
    const record = inclusions as Record<string, unknown>;
    const descriptors = [
      typeof record.hours === 'number' ? `${record.hours} timer` : '',
      typeof record.images === 'number' ? `${record.images} bilder` : '',
      typeof record.videos === 'number' ? `${record.videos} videoer` : '',
      record.editing ? 'Redigering' : '',
    ];
    return descriptors.filter(Boolean);
  }

  return [];
};

const createCustomLine = (): CustomLineItem => ({
  id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  description: '',
  quantity: 1,
  unitPrice: 0,
});

export default function QuoteCreationModal({
  open,
  onClose,
  modalZIndex,
  clientData,
  onQuoteCreated,
}: QuoteCreationModalProps) {
  const theming = useTheming(clientData.profession || 'photographer');

  const [clientName, setClientName] = useState(clientData.name || '');
  const [clientEmail, setClientEmail] = useState(clientData.email || '');
  const [title, setTitle] = useState(`Tilbud for ${clientData.projectType || clientData.projectName || 'prosjekt'}`);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState(createDefaultValidUntil());
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [selectedPricingEntries, setSelectedPricingEntries] = useState<SelectedPricingEntry[]>([]);
  const [pendingPricingId, setPendingPricingId] = useState('');
  const [selectedAdditionalCostIds, setSelectedAdditionalCostIds] = useState<string[]>([]);
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<string[]>([]);
  const [customLines, setCustomLines] = useState<CustomLineItem[]>([]);
  const [titleTouched, setTitleTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);

  const packagesQuery = useQuery<unknown>({
    queryKey: ['/api/pricing/packages', 'quote-modal'],
    queryFn: () => apiRequest('/api/pricing/packages'),
    enabled: open,
  });

  const pricingQuery = useQuery<unknown>({
    queryKey: ['/api/price-administration/pricing', 'quote-modal'],
    queryFn: () => apiRequest('/api/price-administration/pricing'),
    enabled: open,
  });

  const additionalCostsQuery = useQuery<unknown>({
    queryKey: ['/api/price-administration/additional-costs', 'quote-modal'],
    queryFn: () => apiRequest('/api/price-administration/additional-costs'),
    enabled: open,
  });

  const discountsQuery = useQuery<unknown>({
    queryKey: ['/api/price-administration/discounts', 'quote-modal'],
    queryFn: () => apiRequest('/api/price-administration/discounts'),
    enabled: open,
  });

  const packages = useMemo(() => {
    const items = readCollection<AdminPackage>(packagesQuery.data, 'packages');
    const active = items.filter((item) => item.isActive !== false && item.isVisible !== false);
    const professionMatches = active.filter((item) => !item.profession || item.profession === clientData.profession);
    return professionMatches.length > 0 ? professionMatches : active;
  }, [clientData.profession, packagesQuery.data]);

  const pricingStructures = useMemo(() => {
    const items = readCollection<AdminPricingStructure>(pricingQuery.data, 'pricing');
    const active = items.filter((item) => !item.profession || item.profession === clientData.profession);
    return active;
  }, [clientData.profession, pricingQuery.data]);

  const additionalCosts = useMemo(
    () => readCollection<AdminAdditionalCost>(additionalCostsQuery.data, 'costs'),
    [additionalCostsQuery.data],
  );

  const discounts = useMemo(() => {
    const items = readCollection<AdminDiscount>(discountsQuery.data, 'discounts');
    return items.filter((item) => item.isActive !== false);
  }, [discountsQuery.data]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setClientName(clientData.name || '');
    setClientEmail(clientData.email || '');
    setTitle(`Tilbud for ${clientData.projectType || clientData.projectName || 'prosjekt'}`);
    setDescription('');
    setNotes('');
    setValidUntil(createDefaultValidUntil());
    setSelectedPackageId('');
    setSelectedPricingEntries([]);
    setPendingPricingId('');
    setSelectedAdditionalCostIds([]);
    setSelectedDiscountIds([]);
    setCustomLines([]);
    setTitleTouched(false);
    setDescriptionTouched(false);
  }, [clientData.email, clientData.name, clientData.projectName, clientData.projectType, open]);

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedPackageId) ?? null,
    [packages, selectedPackageId],
  );

  useEffect(() => {
    if (!open || !selectedPackage) {
      return;
    }

    if (!titleTouched) {
      setTitle(`Tilbud: ${selectedPackage.name}`);
    }

    if (!descriptionTouched) {
      setDescription(
        selectedPackage.description?.trim()
          || `Tilbud basert på pakken ${selectedPackage.name}${clientData.projectName ? ` for ${clientData.projectName}` : ''}.`,
      );
    }
  }, [
    clientData.projectName,
    descriptionTouched,
    open,
    selectedPackage,
    titleTouched,
  ]);

  const selectedPricingLines = useMemo(
    () =>
      selectedPricingEntries
        .map((entry) => {
          const pricing = pricingStructures.find((item) => item.id === entry.id);
          if (!pricing) {
            return null;
          }

          const unitPrice = getPricingUnitPrice(pricing);
          return {
            id: entry.id,
            type: pricing.type || 'pricing_structure',
            description: pricing.name,
            quantity: entry.quantity,
            unitPrice,
            totalPrice: unitPrice * entry.quantity,
            sourcePricingId: pricing.id,
            rateLabel: pricing.serviceCategory || pricing.type || 'Prisstruktur',
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    [pricingStructures, selectedPricingEntries],
  );

  const selectedAdditionalCosts = useMemo(
    () =>
      selectedAdditionalCostIds
        .map((id) => additionalCosts.find((item) => item.id === id))
        .filter((item): item is AdminAdditionalCost => Boolean(item))
        .map((item) => ({
          id: item.id,
          type: item.type || 'additional_cost',
          description: item.description || item.name,
          amount: toFiniteNumber(item.amount),
        })),
    [additionalCosts, selectedAdditionalCostIds],
  );

  const customServiceLines = useMemo(
    () =>
      customLines
        .filter((line) => line.description.trim())
        .map((line) => ({
          id: line.id,
          type: 'custom',
          description: line.description.trim(),
          quantity: Math.max(1, Math.round(line.quantity || 1)),
          unitPrice: Math.max(0, toFiniteNumber(line.unitPrice)),
          totalPrice: Math.max(1, Math.round(line.quantity || 1)) * Math.max(0, toFiniteNumber(line.unitPrice)),
        })),
    [customLines],
  );

  const packageServiceLine = useMemo(() => {
    if (!selectedPackage) {
      return null;
    }

    const unitPrice = getPackagePrice(selectedPackage);
    return {
      id: selectedPackage.id,
      type: 'package',
      description: selectedPackage.name,
      quantity: 1,
      unitPrice,
      totalPrice: unitPrice,
      sourcePackageId: selectedPackage.id,
    };
  }, [selectedPackage]);

  const serviceLines = useMemo(
    () => [
      ...(packageServiceLine ? [packageServiceLine] : []),
      ...selectedPricingLines,
      ...customServiceLines,
    ],
    [customServiceLines, packageServiceLine, selectedPricingLines],
  );

  const subtotal = useMemo(
    () => serviceLines.reduce((sum, line) => sum + toFiniteNumber(line.totalPrice), 0),
    [serviceLines],
  );

  const additionalCostsTotal = useMemo(
    () => selectedAdditionalCosts.reduce((sum, cost) => sum + toFiniteNumber(cost.amount), 0),
    [selectedAdditionalCosts],
  );

  const grossBeforeDiscount = subtotal + additionalCostsTotal;

  const selectedDiscounts = useMemo(
    () =>
      selectedDiscountIds
        .map((id) => discounts.find((item) => item.id === id))
        .filter((item): item is AdminDiscount => Boolean(item))
        .map((item) => {
          const eligible = grossBeforeDiscount >= toFiniteNumber(item.minPurchase);
          const amount = eligible
            ? (item.isPercentage
                ? (grossBeforeDiscount * toFiniteNumber(item.discountValue)) / 100
                : toFiniteNumber(item.discountValue))
            : 0;

          return {
            id: item.id,
            type: item.isPercentage ? 'percentage' : 'fixed',
            description: item.description || item.name,
            amount,
            eligible,
            label: item.name,
          };
        }),
    [discounts, grossBeforeDiscount, selectedDiscountIds],
  );

  const discountTotal = useMemo(
    () => selectedDiscounts.reduce((sum, discount) => sum + toFiniteNumber(discount.amount), 0),
    [selectedDiscounts],
  );

  const taxableBase = Math.max(grossBeforeDiscount - discountTotal, 0);
  const mva = taxableBase * 0.25;
  const totalAmount = taxableBase + mva;

  const compiledDescription = useMemo(() => {
    if (description.trim()) {
      return description.trim();
    }

    const sourceLabels = [
      selectedPackage?.name,
      ...selectedPricingLines.map((item) => item.description),
      ...customServiceLines.map((item) => item.description),
    ].filter(Boolean);

    return sourceLabels.length > 0
      ? `Tilbudet inkluderer ${sourceLabels.join(', ')}.`
      : 'Tilbud generert fra chat.';
  }, [customServiceLines, description, selectedPackage?.name, selectedPricingLines]);

  const availablePricingChoices = useMemo(
    () => pricingStructures.filter((item) => !selectedPricingEntries.some((entry) => entry.id === item.id)),
    [pricingStructures, selectedPricingEntries],
  );

  const dataSourcesLoading =
    packagesQuery.isLoading || pricingQuery.isLoading || additionalCostsQuery.isLoading || discountsQuery.isLoading;

  const createQuoteMutation = useMutation({
    mutationFn: async () =>
      apiRequest('/api/price-administration/quotes', {
        method: 'POST',
        body: {
          clientId: clientData.crmCustomerId || clientData.id,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          title: title.trim(),
          description: compiledDescription,
          services: serviceLines,
          additionalCosts: selectedAdditionalCosts,
          discounts: selectedDiscounts.map(({ id, type, description: labelDescription, amount }) => ({
            id,
            type,
            description: labelDescription,
            amount,
          })),
          subtotal,
          mva,
          totalAmount,
          currency: 'NOK',
          validUntil,
          notes: notes.trim(),
          projectId: clientData.projectId || null,
          profession: clientData.profession,
        },
      }),
    onSuccess: (data) => {
      if (data && typeof data === 'object') {
        onQuoteCreated?.(data as Record<string, unknown>);
      }
      onClose();
    },
  });

  const handleAddPricingLine = () => {
    if (!pendingPricingId) {
      return;
    }

    setSelectedPricingEntries((previous) => [...previous, { id: pendingPricingId, quantity: 1 }]);
    setPendingPricingId('');
  };

  const handlePricingQuantityChange = (pricingId: string, quantity: number) => {
    setSelectedPricingEntries((previous) =>
      previous.map((entry) =>
        entry.id === pricingId
          ? { ...entry, quantity: Math.max(1, Math.round(quantity || 1)) }
          : entry,
      ),
    );
  };

  const handleRemovePricingLine = (pricingId: string) => {
    setSelectedPricingEntries((previous) => previous.filter((entry) => entry.id !== pricingId));
  };

  const handleToggleAdditionalCost = (costId: string) => {
    setSelectedAdditionalCostIds((previous) =>
      previous.includes(costId)
        ? previous.filter((id) => id !== costId)
        : [...previous, costId],
    );
  };

  const handleToggleDiscount = (discountId: string) => {
    const discount = discounts.find((item) => item.id === discountId);
    if (!discount) {
      return;
    }

    const minPurchase = toFiniteNumber(discount.minPurchase);
    if (minPurchase > 0 && grossBeforeDiscount < minPurchase && !selectedDiscountIds.includes(discountId)) {
      return;
    }

    setSelectedDiscountIds((previous) =>
      previous.includes(discountId)
        ? previous.filter((id) => id !== discountId)
        : [...previous, discountId],
    );
  };

  const handleAddCustomLine = () => {
    setCustomLines((previous) => [...previous, createCustomLine()]);
  };

  const handleUpdateCustomLine = (lineId: string, field: keyof Omit<CustomLineItem, 'id'>, value: string | number) => {
    setCustomLines((previous) =>
      previous.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        return {
          ...line,
          [field]: field === 'description' ? String(value) : toFiniteNumber(value, field === 'quantity' ? 1 : 0),
        };
      }),
    );
  };

  const handleRemoveCustomLine = (lineId: string) => {
    setCustomLines((previous) => previous.filter((line) => line.id !== lineId));
  };

  const canSubmit = Boolean(
    clientName.trim() &&
    title.trim() &&
    validUntil &&
    serviceLines.length > 0,
  );

  const activeContextChip = clientData.crmCustomerId
    ? { label: 'Koblet til CRM-kunde', color: 'success' as const }
    : { label: 'Ikke koblet til CRM', color: 'default' as const };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{ zIndex: modalZIndex }}
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ReceiptIcon color="primary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Opprett tilbud
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tilbudet bygges fra pakker og priser i prisadministrasjonen og lagres i samme tilbudsstrøm.
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
        <Stack spacing={3}>
          <Alert severity={clientData.crmCustomerId ? 'success' : 'info'}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {clientData.name || 'Ukjent kunde'}
              </Typography>
              <Chip size="small" label={activeContextChip.label} color={activeContextChip.color} />
              {clientData.projectName ? <Chip size="small" label={`Prosjekt: ${clientData.projectName}`} variant="outlined" /> : null}
              {clientData.crmDealId ? <Chip size="small" label="Aktiv deal" variant="outlined" /> : null}
            </Stack>
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Kundenavn"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Kunde e-post"
                value={clientEmail}
                onChange={(event) => setClientEmail(event.target.value)}
                type="email"
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Tilbudstittel"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setTitleTouched(true);
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="date"
                label="Gyldig til"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Kort beskrivelse"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setDescriptionTouched(true);
                }}
                placeholder="Oppsummer tilbudet kort. Hvis du lar dette stå tomt, genereres en oppsummering fra valgte pakker og tjenester."
              />
            </Grid>
          </Grid>

          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Inventory2Outlined sx={{ color: theming.colors.primary }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Velg grunnpakke
              </Typography>
            </Stack>

            {dataSourcesLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">
                  Laster pakker og prisstrukturer...
                </Typography>
              </Box>
            ) : packages.length > 0 ? (
              <Grid container spacing={2}>
                {packages.map((pkg) => {
                  const selected = selectedPackageId === pkg.id;
                  const packagePrice = getPackagePrice(pkg);
                  const inclusions = describeInclusions(pkg);

                  return (
                    <Grid item xs={12} md={6} key={pkg.id}>
                      <Card
                        variant={selected ? 'elevation' : 'outlined'}
                        elevation={selected ? 4 : 0}
                        sx={{
                          borderRadius: 3,
                          borderColor: selected ? theming.colors.primary : 'divider',
                          background: selected ? `${theming.colors.primary}10` : 'background.paper',
                        }}
                      >
                        <CardActionArea onClick={() => setSelectedPackageId(selected ? '' : pkg.id)}>
                          <CardContent sx={{ p: 2.25 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                              <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                  {pkg.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                  {pkg.description || 'Pakke fra prisadministrasjonen.'}
                                </Typography>
                              </Box>
                              <Chip
                                label={selected ? 'Valgt' : 'Velg'}
                                color={selected ? 'primary' : 'default'}
                                variant={selected ? 'filled' : 'outlined'}
                                size="small"
                              />
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
                              <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="h6" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                                {formatCurrency(packagePrice)}
                              </Typography>
                              {toFiniteNumber(pkg.discountPercentage) > 0 ? (
                                <Chip
                                  size="small"
                                  color="success"
                                  label={`-${toFiniteNumber(pkg.discountPercentage)}%`}
                                />
                              ) : null}
                            </Stack>
                            {inclusions.length > 0 ? (
                              <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
                                {inclusions.map((inclusion) => (
                                  <Chip key={`${pkg.id}-${inclusion}`} label={inclusion} size="small" variant="outlined" />
                                ))}
                              </Stack>
                            ) : null}
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            ) : (
              <Alert severity="warning">
                Ingen aktive pakker funnet i prisadministrasjonen. Du kan fortsatt lage et tilpasset tilbud med egne linjer under.
              </Alert>
            )}
          </Box>

          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <TuneOutlined sx={{ color: theming.colors.primary }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Legg til prislinjer
              </Typography>
            </Stack>

            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <TextField
                  select
                  label="Prisstruktur"
                  value={pendingPricingId}
                  onChange={(event) => setPendingPricingId(event.target.value)}
                  sx={{ minWidth: { xs: '100%', sm: 320 } }}
                  size="small"
                >
                  {availablePricingChoices.length === 0 ? (
                    <MenuItem value="" disabled>
                      Ingen flere prisstrukturer tilgjengelig
                    </MenuItem>
                  ) : (
                    availablePricingChoices.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name} · {formatCurrency(getPricingUnitPrice(item))}
                      </MenuItem>
                    ))
                  )}
                </TextField>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddPricingLine}
                  disabled={!pendingPricingId}
                >
                  Legg til
                </Button>
                <Button
                  variant="text"
                  startIcon={<Add />}
                  onClick={handleAddCustomLine}
                >
                  Tilpasset linje
                </Button>
              </Box>

              {selectedPricingLines.length === 0 && customServiceLines.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Velg ekstra prisstrukturer eller legg til egne tilpassede linjer når tilbudet trenger mer enn grunnpakken.
                </Typography>
              ) : null}

              <Stack spacing={1.25}>
                {selectedPricingLines.map((line) => (
                  <Card key={line.id} variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent sx={{ p: 1.75 }}>
                      <Grid container spacing={1.5} alignItems="center">
                        <Grid item xs={12} md={5}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {line.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {line.rateLabel}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={2.5}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Antall"
                            value={line.quantity}
                            onChange={(event) => handlePricingQuantityChange(line.id, Number(event.target.value) || 1)}
                          />
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="text.secondary">
                            Enhetspris
                          </Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {formatCurrency(line.unitPrice)}
                          </Typography>
                        </Grid>
                        <Grid item xs={10} md={1}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {formatCurrency(line.totalPrice)}
                          </Typography>
                        </Grid>
                        <Grid item xs={2} md={0.5}>
                          <IconButton size="small" onClick={() => handleRemovePricingLine(line.id)}>
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}

                {customLines.map((line) => (
                  <Card key={line.id} variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent sx={{ p: 1.75 }}>
                      <Grid container spacing={1.5} alignItems="center">
                        <Grid item xs={12} md={5.5}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Tilpasset linje"
                            value={line.description}
                            onChange={(event) => handleUpdateCustomLine(line.id, 'description', event.target.value)}
                          />
                        </Grid>
                        <Grid item xs={6} md={2}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Antall"
                            value={line.quantity}
                            onChange={(event) => handleUpdateCustomLine(line.id, 'quantity', Number(event.target.value) || 1)}
                          />
                        </Grid>
                        <Grid item xs={6} md={2.5}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Pris"
                            value={line.unitPrice}
                            onChange={(event) => handleUpdateCustomLine(line.id, 'unitPrice', Number(event.target.value) || 0)}
                          />
                        </Grid>
                        <Grid item xs={10} md={1.5}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {formatCurrency(Math.max(1, line.quantity) * Math.max(0, line.unitPrice))}
                          </Typography>
                        </Grid>
                        <Grid item xs={2} md={0.5}>
                          <IconButton size="small" onClick={() => handleRemoveCustomLine(line.id)}>
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Stack>
          </Box>

          {additionalCosts.length > 0 ? (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <LocalOfferOutlined sx={{ color: theming.colors.primary }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Tilleggskostnader
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                {additionalCosts.map((cost) => {
                  const selected = selectedAdditionalCostIds.includes(cost.id);
                  return (
                    <Chip
                      key={cost.id}
                      clickable
                      color={selected ? 'primary' : 'default'}
                      variant={selected ? 'filled' : 'outlined'}
                      onClick={() => handleToggleAdditionalCost(cost.id)}
                      label={`${cost.name} · ${formatCurrency(toFiniteNumber(cost.amount))}`}
                    />
                  );
                })}
              </Stack>
            </Box>
          ) : null}

          {discounts.length > 0 ? (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <PercentOutlined sx={{ color: theming.colors.primary }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Rabatter
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                {discounts.map((discount) => {
                  const selected = selectedDiscountIds.includes(discount.id);
                  const minPurchase = toFiniteNumber(discount.minPurchase);
                  const disabled = !selected && minPurchase > 0 && grossBeforeDiscount < minPurchase;
                  const label = `${discount.name} · ${discount.isPercentage ? `${toFiniteNumber(discount.discountValue)}%` : formatCurrency(toFiniteNumber(discount.discountValue))}`;

                  return (
                    <Chip
                      key={discount.id}
                      clickable={!disabled}
                      color={selected ? 'success' : 'default'}
                      variant={selected ? 'filled' : 'outlined'}
                      onClick={() => handleToggleDiscount(discount.id)}
                      label={disabled ? `${label} · krever ${formatCurrency(minPurchase)}` : label}
                      sx={disabled ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                    />
                  );
                })}
              </Stack>
            </Box>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <TextField
                fullWidth
                multiline
                minRows={4}
                label="Interne notater"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Legg inn spesielle føringer, forhandlingsnotater eller leveransedetaljer."
              />
            </Grid>
            <Grid item xs={12} md={5}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  borderColor: `${theming.colors.primary}33`,
                  background: `${theming.colors.primary}08`,
                }}
              >
                <CardContent sx={{ p: 2.25 }}>
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Tjenester
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {formatCurrency(subtotal)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Tillegg
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {formatCurrency(additionalCostsTotal)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Rabatter
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: discountTotal > 0 ? 'success.main' : 'text.primary' }}>
                        -{formatCurrency(discountTotal)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        MVA (25%)
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {formatCurrency(mva)}
                      </Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Totalt
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: theming.colors.primary }}>
                        {formatCurrency(totalAmount)}
                      </Typography>
                    </Stack>
                    {clientData.budget ? (
                      <Typography variant="caption" color="text.secondary">
                        Kundens registrerte budsjett: {formatCurrency(clientData.budget)}
                      </Typography>
                    ) : null}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={() => createQuoteMutation.mutate()}
          disabled={!canSubmit || createQuoteMutation.isPending}
          sx={theming.getThemedButtonSx()}
        >
          {createQuoteMutation.isPending ? 'Oppretter...' : 'Opprett tilbud'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
