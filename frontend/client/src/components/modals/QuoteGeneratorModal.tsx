/**
 * CreatorHub Norge - Quote Generator Modal
 * Modal for generating custom quotes
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientServicePricing } from '../../services/ClientServicePricingService';
import { useExternalData } from '../../services/ExternalDataService';
import type { KartverketAddress } from '../../services/ExternalDataService';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Grid,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Receipt as QuoteIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Calculate as CalculateIcon,
  DirectionsCar as CarIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import {
  FormControlLabel,
  Checkbox,
  CircularProgress,
  InputAdornment,
  Alert,
} from '@mui/material';

interface QuoteGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  packages: any[];
  pricing: any[];
  additionalCosts: any[];
  discounts: any[];
  onQuoteGenerated?: (savedQuote: Record<string, unknown>) => void;
}

const QuoteGeneratorModal: React.FC<QuoteGeneratorModalProps> = ({
  open,
  onClose,
  packages,
  pricing,
  additionalCosts,
  discounts,
  onQuoteGenerated,
}) => {
  const [clientId, setClientId] = useState('');
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [selectedAdditional, setSelectedAdditional] = useState<any[]>([]);
  const [selectedDiscounts, setSelectedDiscounts] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

  // iPad-native Pencil signature state. Populated when the
  // photographer signs the quote via the CreatorHub One Pencil
  // bridge. We send the base64 PNG + canvas size alongside the quote
  // payload so the backend can render a "Fotografens godkjenning"
  // stamp onto the generated PDF without needing the iPad to upload
  // to a separate endpoint.
  const [photographerSignature, setPhotographerSignature] = useState<{
    pngBase64: string;
    width: number;
    height: number;
    signedAt: string;
  } | null>(null);
  const [isIPadNative, setIsIPadNative] = useState(false);
  const [signatureRequestPending, setSignatureRequestPending] = useState(false);

  useEffect(() => {
    // Detect the CreatorHub One iPad shell. ``isIPadNative`` is
    // defined by the PencilBridge shim that AuthenticatedWebView
    // injects at document start, so it's available before React
    // mounts. Re-read on every open so a hot-reload during
    // development still picks it up.
    if (typeof window === 'undefined') { setIsIPadNative(false); return; }
    const ch1 = (window as any).CreatorHubOne;
    try {
      setIsIPadNative(Boolean(ch1?.isIPadNative && ch1.isIPadNative()));
    } catch {
      setIsIPadNative(false);
    }
  }, [open]);

  const requestPencilSignature = async () => {
    const ch1 = (window as any).CreatorHubOne;
    if (!ch1?.requestSignature) return;
    setSignatureRequestPending(true);
    try {
      const result = await ch1.requestSignature({
        title: 'Signer tilbud',
        prompt: 'Fotografens godkjenning av utkastet.',
      });
      if (result && typeof result === 'object' && result.pngBase64) {
        setPhotographerSignature({
          pngBase64: result.pngBase64,
          width: Number(result.width) || 0,
          height: Number(result.height) || 0,
          signedAt: new Date().toISOString(),
        });
      }
    } finally {
      setSignatureRequestPending(false);
    }
  };

  // Travel-cost calculator state. Uses the Kartverket address proxy
  // already wired in ExternalDataService + client-side haversine to
  // produce an approximate km distance (good enough for quote
  // drafts; photographer can override). Final fuel + toll numbers
  // come from the server's calculateTravelCosts, which reads current
  // fuel prices from /api/price-administration/fuel-prices.
  const [fromAddressInput, setFromAddressInput] = useState('');
  const [toAddressInput, setToAddressInput] = useState('');
  const [fromResolved, setFromResolved] = useState<KartverketAddress | null>(null);
  const [toResolved, setToResolved] = useState<KartverketAddress | null>(null);
  const [travelKm, setTravelKm] = useState<number | ''>('');
  const [travelVehicle, setTravelVehicle] = useState<string>('bil');
  const [travelReturnTrip, setTravelReturnTrip] = useState<boolean>(true);
  const [travelLoading, setTravelLoading] = useState(false);
  const [travelError, setTravelError] = useState<string | null>(null);
  const [travelResult, setTravelResult] = useState<{
    km: number;
    fuelCostNok: number;
    tollCostNok: number;
    total: number;
    source: string;
  } | null>(null);

  const externalData = useExternalData();
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer,');

  // Client service pricing service integration
  const {
    formatCurrency,
    getTotalWithMVA,
    calculateMVA: getMVA,
} = useClientServicePricing();

  const generateQuoteMutation = useMutation({
    mutationFn: async (quoteData: Record<string, unknown>) => {
      return apiRequest('/api/price-administration/quotes', {
        method: 'POST',
        body: JSON.stringify(quoteData),
      });
    },
    onSuccess: (savedQuoteResponse: unknown, quoteData: Record<string, unknown>) => {
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === 'object' && value !== null && !Array.isArray(value);

      const savedQuote = isRecord(savedQuoteResponse)
        ? (isRecord(savedQuoteResponse.data)
            ? savedQuoteResponse.data
            : (isRecord(savedQuoteResponse.quote) ? savedQuoteResponse.quote : savedQuoteResponse))
        : quoteData;

      if (onQuoteGenerated) {
        onQuoteGenerated(savedQuote);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/quotes'] });
      handleClose();
    },
  });

  const handleClose = () => {
    setClientId(', ');
    setSelectedServices([]);
    setSelectedAdditional([]);
    setSelectedDiscounts([]);
    setNotes(', ');
    setPhotographerSignature(null);
    onClose();
};

  const addService = () => {
    setSelectedServices(prev => [
      ...prev,
      {
        id: Date.now(),
        type: 'package',
        description: ', ',
        quantity:  1,
        unitPrice:  0,
        totalPrice: 0 }
    ]);
};

  const updateService = (id: number, field: string, value: any) => {
    setSelectedServices(prev => prev.map(service => {
      if (service.id === id) {
        const updated = { ...service, [field]: value };
        
        // Auto-calculate total price
        if (field === 'quantity' || field === 'unitPrice') {
          updated.totalPrice = updated.quantity * updated.unitPrice;
      }
        
        // Auto-fill from package selection
        if (field === 'packageId') {
          const pkg = packages.find(p => p.id === value);
          if (pkg) {
            updated.description = pkg.name;
            updated.unitPrice = parseFloat(pkg.basePrice);
            updated.totalPrice = updated.quantity * updated.unitPrice;
        }
      }
        
        // Auto-fill from pricing selection
        if (field === 'pricingId') {
          const prc = pricing.find(p => p.id === value);
          if (prc) {
            updated.description = prc.name;
            // Use the most relevant rate
            const rate = prc.rates.hourlyRate || prc.rates.fullDayRate || prc.rates.packageRate || 0;
            updated.unitPrice = rate;
            updated.totalPrice = updated.quantity * updated.unitPrice;
        }
      }
        
        return updated;
    }
      return service;
  }));
};

  const removeService = (id: number) => {
    setSelectedServices(prev => prev.filter(service => service.id !== id));
};

  // Haversine distance for a quick client-side km estimate once
  // both Kartverket addresses are resolved. Photographer can
  // override the value by editing the ``Kilometer``-field directly;
  // this is only a prefill to save them looking it up in Google
  // Maps for every quote draft.
  const haversineKm = (
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ): number => {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    // Norwegian roads weave more than great-circle — the same 1.35x
    // factor backend uses for internal distance estimates.
    return R * c * 1.35;
  };

  const resolveAddress = async (
    input: string,
    setResolved: (a: KartverketAddress | null) => void,
  ): Promise<KartverketAddress | null> => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
      const resolved = await externalData.getKartverketAddress(trimmed);
      setResolved(resolved);
      return resolved;
    } catch (err) {
      setResolved(null);
      return null;
    }
  };

  const handleCalculateTravel = async () => {
    setTravelError(null);
    setTravelLoading(true);
    try {
      // Resolve both addresses in parallel. If the user already typed
      // a full km value we skip the auto-distance step and use their
      // number directly.
      const [fromRes, toRes] = await Promise.all([
        resolveAddress(fromAddressInput, setFromResolved),
        resolveAddress(toAddressInput, setToResolved),
      ]);

      let kilometers = typeof travelKm === 'number' ? travelKm : 0;
      if (!kilometers && fromRes && toRes) {
        kilometers = Math.round(haversineKm(fromRes.coordinates, toRes.coordinates));
        setTravelKm(kilometers);
      }
      if (!kilometers) {
        setTravelError('Oppgi enten begge adresser eller kilometer manuelt.');
        return;
      }

      const result = await externalData.calculateTravelCosts({
        kilometers,
        vehicleType: travelVehicle,
        returnTrip: travelReturnTrip,
      });

      // The service normalises its response shape in a few different
      // ways depending on whether it came from the backend or the
      // fallback path; read every known shape defensively. Double-
      // cast through ``unknown`` because the service's declared
      // TravelCostData type doesn't cover every possible backend
      // variant, and we explicitly want to probe optional fields.
      const resultRecord = result as unknown as Record<string, unknown>;
      const fuelCost =
        Number((resultRecord.fuelCost as { total?: number })?.total ??
          resultRecord.totalFuelCost ??
          resultRecord.fuelCostNok ??
          0);
      const tollCost = Number(
        (resultRecord.tollCost as number) ??
          resultRecord.tollFees ??
          resultRecord.tollCostNok ??
          0,
      );
      const grand = fuelCost + tollCost;
      setTravelResult({
        km: kilometers,
        fuelCostNok: Math.round(fuelCost),
        tollCostNok: Math.round(tollCost),
        total: Math.round(grand),
        source: String(resultRecord.source ?? 'server'),
      });

      // Inject as a line item in the additional-costs list. Adding
      // here keeps the quote payload identical to how a manual cost
      // would look — the backend / PDF never need to know travel was
      // computed specially.
      const label = fromRes && toRes
        ? `Reise ${fromRes.municipality || fromRes.address} → ${toRes.municipality || toRes.address}${travelReturnTrip ? ' (t/r)' : ''}`
        : `Reisekostnad ${kilometers} km${travelReturnTrip ? ' (t/r)' : ''}`;
      setSelectedAdditional((prev) => {
        // Remove any prior travel line so repeat calculations don't
        // stack — photographer would expect the travel row to replace
        // itself, not accumulate.
        const withoutPrior = prev.filter((c) => c.type !== 'travel');
        return [
          ...withoutPrior,
          {
            id: Date.now(),
            type: 'travel',
            description: label,
            amount: Math.round(grand),
          },
        ];
      });
    } catch (err) {
      setTravelError(
        err instanceof Error
          ? err.message
          : 'Kunne ikke beregne reisekostnad. Prøv igjen eller legg til manuelt.',
      );
    } finally {
      setTravelLoading(false);
    }
  };

  const addAdditionalCost = () => {
    setSelectedAdditional(prev => [
      ...prev,
      {
        id: Date.now(),
        type: 'custom',
        description: ', ',
        amount: 0 }
    ]);
};

  const updateAdditionalCost = (id: number, field: string, value: any) => {
    setSelectedAdditional(prev => prev.map(cost => {
      if (cost.id === id) {
        const updated = { ...cost, [field]: value };
        
        // Auto-fill from predefined cost
        if (field === 'costId') {
          const predefined = additionalCosts.find(c => c.id === value);
          if (predefined) {
            updated.description = predefined.name;
            updated.type = predefined.type;
            // Simple flat rate for now - could be enhanced with calculation logic
            updated.amount = predefined.costStructure?.amount || 0;
        }
      }
        
        return updated;
    }
      return cost;
  }));
};

  const removeAdditionalCost = (id: number) => {
    setSelectedAdditional(prev => prev.filter(cost => cost.id !== id));
};

  const addDiscount = () => {
    if (discounts.length === 0) return;
    
    setSelectedDiscounts(prev => [
      ...prev,
      {
        id: Date.now(),
        type: 'custom',
        description: ', ',
        amount: 0 }
    ]);
};

  const updateDiscount = (id: number, field: string, value: any) => {
    setSelectedDiscounts(prev => prev.map(discount => {
      if (discount.id === id) {
        const updated = { ...discount, [field]: value };
        
        // Auto-fill from predefined discount
        if (field === 'discountId') {
          const predefined = discounts.find(d => d.id === value);
          if (predefined) {
            updated.description = predefined.name;
            updated.type = predefined.type;
            
            // Calculate discount amount based on services total
            const servicesTotal = calculateSubtotal();
            if (predefined.isPercentage) {
              updated.amount = servicesTotal * (parseFloat(predefined.discountValue) / 100);
          } else {
              updated.amount = parseFloat(predefined.discountValue);
          }
        }
      }
        
        return updated;
    }
      return discount;
  }));
};

  const removeDiscount = (id: number) => {
    setSelectedDiscounts(prev => prev.filter(discount => discount.id !== id));
};

  const calculateSubtotal = () => {
    return selectedServices.reduce((sum, service) => sum + service.totalPrice, 0);
};

  const calculateAdditionalTotal = () => {
    return selectedAdditional.reduce((sum, cost) => sum + cost.amount, 0);
};

  const calculateDiscountTotal = () => {
    return selectedDiscounts.reduce((sum, discount) => sum + discount.amount, 0);
};

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const additional = calculateAdditionalTotal();
    const discountTotal = calculateDiscountTotal();
    const baseAmount = subtotal + additional - discountTotal;
    
    // Use centralized MVA calculation
    try {
      return getTotalWithMVA(baseAmount);
    } catch {
      // Fallback to hardcoded calculation
      const mva = baseAmount * 0.25; // 25% Norwegian VAT
      return baseAmount + mva;
    }
  };

  const calculateMVA = () => {
    const subtotal = calculateSubtotal();
    const additional = calculateAdditionalTotal();
    const discountTotal = calculateDiscountTotal();
    const baseAmount = subtotal + additional - discountTotal;

    // Use centralized MVA calculation
    try {
      return getMVA(baseAmount);
    } catch {
      // Fallback to hardcoded calculation
      return baseAmount * 0.25;
    }
  };

  const handleGenerateQuote = () => {
    if (!clientId.trim() || selectedServices.length === 0) return;

    const quoteData: Record<string, unknown> = {
      clientId: clientId.trim(),
      services: selectedServices,
      additionalCosts: selectedAdditional,
      discounts: selectedDiscounts,
      notes: notes.trim(),
    };

    // Attach the Pencil signature only when it exists — backend
    // tolerates missing ``photographerSignature`` (falls through to
    // "pending" status) so the generator still works for desktop
    // users who don't have a Pencil workflow.
    if (photographerSignature) {
      quoteData.photographerSignature = photographerSignature;
    }

    generateQuoteMutation.mutate(quoteData);
  };

  // Use centralized currency formatting
  const formatPrice = (price: number) => {
    try {
      return formatCurrency(price, 'NOK');
    } catch {
      // Fallback formatting
      return new Intl.NumberFormat('nb-NO', {
        style: 'currency',
        currency: 'NOK',
      }).format(price);
    }
  };

  return (
    <Dialog 
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '90vh'
    }
    }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <QuoteIcon color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Generer tilbud
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={3}>
          {/* Client Information */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Kunde ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Skriv inn kunde-ID eller navn"
              required
            />
          </Grid>

          {/* Services */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                Tjenester
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addService}
                size="small"
              >
                Legg til tjeneste
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Beskrivelse</TableCell>
                    <TableCell>Antall</TableCell>
                    <TableCell>Enhetspris</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell width="50"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={service.type}
                          onChange={(e) => updateService(service.id, 'type', e.target.value)}
                          sx={{ minWidth: 120}}
                        >
                          <MenuItem value="package">Pakke</MenuItem>
                          <MenuItem value="pricing">Prisstruktur</MenuItem>
                          <MenuItem value="custom">Tilpasset</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        {service.type === 'package' ? (
                          <TextField
                            select
                            size="small"
                            value={service.packageId || ', '}
                            onChange={(e) => updateService(service.id, 'packageId', e.target.value)}
                            sx={{ minWidth: 200}}
                          >
                            {packages.map((pkg) => (
                              <MenuItem key={pkg.id} value={pkg.id}>
                                {pkg.name} - {formatPrice(pkg.basePrice)}
                              </MenuItem>
                            ))}
                          </TextField>
                        ) : service.type === 'pricing' ? (
                          <TextField
                            select
                            size="small"
                            value={service.pricingId || ', '}
                            onChange={(e) => updateService(service.id, 'pricingId', e.target.value)}
                            sx={{ minWidth: 200}}
                          >
                            {pricing.map((prc) => (
                              <MenuItem key={prc.id} value={prc.id}>
                                {prc.name}
                              </MenuItem>
                            ))}
                          </TextField>
                        ) : (
                          <TextField
                            size="small"
                            value={service.description}
                            onChange={(e) => updateService(service.id, 'description', e.target.value)}
                            placeholder="Beskriv tjenesten"
                            sx={{ minWidth: 200}}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={service.quantity}
                          onChange={(e) => updateService(service.id, 'quantity', parseInt(e.target.value) || 1)}
                          sx={{ width: 80}}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={service.unitPrice}
                          onChange={(e) => updateService(service.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          sx={{ width: 120}}
                        />
                      </TableCell>
                      <TableCell>
                        {formatPrice(service.totalPrice)}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => removeService(service.id)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* Travel-cost calculator. Feeds the additional-costs list
              with a computed Reisekostnad line once fotograf confirms
              addresses + kjøretøy. Pure optional — existing Legg til
              kostnad flow still works for manual entry. */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CarIcon color="primary" />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Reisekostnad (Kartverket + drivstoff + bompenger)
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Fra adresse"
                    value={fromAddressInput}
                    onChange={(e) => setFromAddressInput(e.target.value)}
                    placeholder="f.eks. Karl Johans gate 1, Oslo"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocationIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  {fromResolved && (
                    <Typography variant="caption" color="text.secondary">
                      {fromResolved.municipality}, {fromResolved.county}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Til adresse"
                    value={toAddressInput}
                    onChange={(e) => setToAddressInput(e.target.value)}
                    placeholder="f.eks. Storgata 12, Bergen"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocationIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  {toResolved && (
                    <Typography variant="caption" color="text.secondary">
                      {toResolved.municipality}, {toResolved.county}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Kilometer"
                    type="number"
                    value={travelKm}
                    onChange={(e) =>
                      setTravelKm(
                        e.target.value === ''
                          ? ''
                          : Math.max(0, parseFloat(e.target.value) || 0),
                      )
                    }
                    helperText="Fylles auto fra adresser, overstyres her"
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Kjøretøy"
                    value={travelVehicle}
                    onChange={(e) => setTravelVehicle(e.target.value)}
                  >
                    <MenuItem value="bil">Bil</MenuItem>
                    <MenuItem value="varebil">Varebil</MenuItem>
                    <MenuItem value="elbil">Elbil</MenuItem>
                    <MenuItem value="motorsykkel">Motorsykkel</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={travelReturnTrip}
                        onChange={(e) => setTravelReturnTrip(e.target.checked)}
                      />
                    }
                    label="Tur-retur"
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    variant="contained"
                    onClick={handleCalculateTravel}
                    disabled={travelLoading}
                    fullWidth
                    startIcon={
                      travelLoading ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <CalculateIcon />
                      )
                    }
                  >
                    Beregn
                  </Button>
                </Grid>
              </Grid>

              {travelError && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {travelError}
                </Alert>
              )}
              {travelResult && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  {travelResult.km} km{travelReturnTrip ? ' (t/r)' : ''} —
                  drivstoff {formatCurrency(travelResult.fuelCostNok, 'NOK')} + bom{' '}
                  {formatCurrency(travelResult.tollCostNok, 'NOK')} ={' '}
                  <strong>{formatCurrency(travelResult.total, 'NOK')}</strong> lagt til
                  som tilleggskostnad. Kilde: {travelResult.source}.
                </Alert>
              )}
            </Paper>
          </Grid>

          {/* Additional Costs */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                Tilleggskostnader
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addAdditionalCost}
                size="small"
              >
                Legg til kostnad
              </Button>
            </Box>

            {selectedAdditional.map((cost) => (
              <Box key={cost.id} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center'}}>
                <TextField
                  select
                  label="Type"
                  value={cost.costId || 'custom'}
                  onChange={(e) => updateAdditionalCost(cost.id, 'costId', e.target.value)}
                  sx={{ minWidth: 150}}
                  size="small"
                >
                  <MenuItem value="custom">Tilpasset</MenuItem>
                  {additionalCosts.map((ac) => (
                    <MenuItem key={ac.id} value={ac.id}>
                      {ac.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Beskrivelse"
                  value={cost.description}
                  onChange={(e) => updateAdditionalCost(cost.id, 'description', e.target.value)}
                  sx={{ flex:  1 }}
                  size="small"
                />
                <TextField
                  label="Beløp"
                  type="number"
                  value={cost.amount}
                  onChange={(e) => updateAdditionalCost(cost.id, 'amount', parseFloat(e.target.value) || 0)}
                  sx={{ width: 120}}
                  size="small"
                />
                <IconButton
                  size="small"
                  onClick={() => removeAdditionalCost(cost.id)}
                  color="error"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Grid>

          {/* Discounts */}
          {discounts.length > 0 && (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                  Rabatter
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={addDiscount}
                  size="small"
                >
                  Legg til rabatt
                </Button>
              </Box>

              {selectedDiscounts.map((discount) => (
                <Box key={discount.id} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center'}}>
                  <TextField
                    select
                    label="Rabatt"
                    value={discount.discountId || 'custom'}
                    onChange={(e) => updateDiscount(discount.id, 'discountId', e.target.value)}
                    sx={{ minWidth: 150}}
                    size="small"
                  >
                    <MenuItem value="custom">Tilpasset</MenuItem>
                    {discounts.map((d) => (
                      <MenuItem key={d.id} value={d.id}>
                        {d.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Beskrivelse"
                    value={discount.description}
                    onChange={(e) => updateDiscount(discount.id, 'description', e.target.value)}
                    sx={{ flex:  1 }}
                    size="small"
                  />
                  <TextField
                    label="Rabattbeløp"
                    type="number"
                    value={discount.amount}
                    onChange={(e) => updateDiscount(discount.id, 'amount', parseFloat(e.target.value) || 0)}
                    sx={{ width: 120}}
                    size="small"
                  />
                  <IconButton
                    size="small"
                    onClick={() => removeDiscount(discount.id)}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Grid>
          )}

          {/* Notes */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notater"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tilleggsopplysninger til tilbudet..."
            />
          </Grid>

          {/* Calculation Summary */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2,...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                <CalculateIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Sammendrag
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Undertotal tjenester: </Typography>
                <Typography>{formatPrice(calculateSubtotal())}</Typography>
              </Box>
              {calculateAdditionalTotal() > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>Tilleggskostnader: </Typography>
                  <Typography>{formatPrice(calculateAdditionalTotal())}</Typography>
                </Box>
              )}
              {calculateDiscountTotal() > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>Rabatter: </Typography>
                  <Typography color="success.main">-{formatPrice(calculateDiscountTotal())}</Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                <Typography>MVA (25%):</Typography>
                <Typography>{formatPrice(calculateMVA())}</Typography>
              </Box>
              <Divider sx={{ my:  1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Totalt: </Typography>
                <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                  {formatPrice(calculateTotal())}
                </Typography>
              </Box>
            </Paper>
          </Grid>

          {/* iPad-only: native Apple Pencil signature capture for the
              photographer's approval of the draft. Shown only inside
              CreatorHub One (``window.CreatorHubOne.isIPadNative()``)
              so desktop users see no extra UI. */}
          {isIPadNative && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2, ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Fotografens godkjenning
                </Typography>
                {photographerSignature ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      component="img"
                      src={`data:image/png;base64,${photographerSignature.pngBase64}`}
                      alt="Signatur"
                      sx={{
                        height: 72,
                        maxWidth: 260,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        p: 1,
                      }}
                    />
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2">Signert som utkast-godkjenning.</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(photographerSignature.signedAt).toLocaleString('nb-NO')}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => setPhotographerSignature(null)}
                      disabled={signatureRequestPending}
                    >
                      Fjern
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" sx={{ flexGrow: 1 }} color="text.secondary">
                      Signer tilbudet med Apple Pencil for å lage utkast-godkjenning.
                      Klienten får egen signatur-forespørsel i e-posten.
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={requestPencilSignature}
                      disabled={signatureRequestPending}
                    >
                      {signatureRequestPending ? 'Åpner signatur…' : 'Signer med Pencil'}
                    </Button>
                  </Box>
                )}
              </Paper>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Avbryt
        </Button>
        <Button variant="contained"
          onClick={handleGenerateQuote}
          disabled={!clientId.trim() || selectedServices.length === 0 || generateQuoteMutation.isPending}
         sx={theming.getThemedButtonSx()}>
          {generateQuoteMutation.isPending ? 'Genererer...' : 'Generer tilbud'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuoteGeneratorModal;
