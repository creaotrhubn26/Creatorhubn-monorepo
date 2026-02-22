/**
 * CreatorHub Norge - Quote Generator Modal
 * Modal for generating custom quotes
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientServicePricing } from '../../services/ClientServicePricingService';
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
} from '@mui/icons-material';

interface QuoteGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  packages: any[];
  pricing: any[];
  additionalCosts: any[];
  discounts: any[]
}

const QuoteGeneratorModal: React.FC<QuoteGeneratorModalProps> = ({
  open,
  onClose,
  packages,
  pricing,
  additionalCosts,
  discounts
}) => {
  const [clientId, setClientId] = useState('');
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [selectedAdditional, setSelectedAdditional] = useState<any[]>([]);
  const [selectedDiscounts, setSelectedDiscounts] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

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
    mutationFn: async (quoteData: any) => {
      return apiRequest('/api/price-administration/quotes', {
        method: 'POST',
        body: JSON.stringify(quoteData),
      });
    },
    onSuccess: () => {
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

    const quoteData = {
      clientId: clientId.trim(),
      services: selectedServices,
      additionalCosts: selectedAdditional,
      discounts: selectedDiscounts,
      notes: notes.trim()
};

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