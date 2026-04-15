// @ts-nocheck
/**
 * CreatorHub Norge - Contract Pricing Integration
 * Embeds pricing into contract generation and management
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useClientServicePricing } from '../../services/ClientServicePricingService';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Calculate as CalculateIcon,
  Description as ContractIcon,
  ExpandMore as ExpandMoreIcon,
  LocalOffer as PriceIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Import dynamic profession system
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';

interface ContractPricingIntegrationProps {
  userId: string;
  contractId?: string;
  onPricingChange?: (pricing: any) => void;
  readOnly?: boolean
}

interface ContractLineItem {
  id?: string;
  type: 'service' | 'package' | 'custom';
  serviceId?: number;
  packageId?: number;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxable: boolean
}

export default function ContractPricingIntegration({
  userId,
  contractId,
  onPricingChange,
  readOnly = false,
}: ContractPricingIntegrationProps) {
  // Get user and profession context
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');

  // Client service pricing service integration
  const { 
    formatCurrency,
    getMVA,
    getTotalWithMVA,
    isLoading: pricingLoading 
} = useClientServicePricing();
  const userProfession = user?.profession || 'photographer';

  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  const [lineItems, setLineItems] = useState<ContractLineItem[]>([]);
  const [addItemDialog, setAddItemDialog] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [customItem, setCustomItem] = useState({
    name: '',
    description: '',
    quantity:  1,
    unitPrice:  0,
});
  const [calculationResult, setCalculationResult] = useState<any>(null);

  // Fetch pricing data for contracts
  const { data: pricingData, isLoading } = useQuery({
    queryKey: ['/api/pricing/integration/contracts', userId],
    queryFn: () => apiRequest(`/api/pricing/integration/contracts/${userId}`),
});

  // Calculate pricing mutation
  const calculatePricingMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/pricing/calculate', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    onSuccess: (result) => {
      setCalculationResult(result);
      onPricingChange?.(result);
},
});

  const services = pricingData?.services || [];
  const packages = pricingData?.packages || [];
  const categories = pricingData?.categories || [];

  useEffect(() => {
    if (lineItems.length > 0) {
      calculateTotal();
  }
}, [lineItems]);

  const addServiceItem = () => {
    const service = services.find((s: any) => s.id === parseInt(selectedService));
    if (!service) return;

    const newItem: ContractLineItem = {
      id: `service-${Date.now()}`,
      type: 'service',
      serviceId: service.d,
      name: service.service_name,
      description: service.description ||'',
      quantity:  1,
      unitPrice: parseFloat(service.base_price),
      total: parseFloat(service.base_price),
      taxable: true,
  };

    setLineItems([...lineItems, newItem]);
    setSelectedService('');
    setAddItemDialog(false);
};

  const addPackageItem = () => {
    const pkg = packages.find((p: any) => p.id === parseInt(selectedPackage));
    if (!pkg) return;

    const newItem: ContractLineItem = {
      id: `package-${Date.now()}`,
      type: 'package',
      packageId: pkg.d,
      name: pkg.package_name,
      description: pkg.description ||'',
      quantity:  1,
      unitPrice: parseFloat(pkg.total_price),
      total: parseFloat(pkg.total_price),
      taxable: true,
  };

    setLineItems([...lineItems, newItem]);
    setSelectedPackage('');
    setAddItemDialog(false);
};

  const addCustomItem = () => {
    if (!customItem.name) return;

    const newItem: ContractLineItem = {
      id: `custom-${Date.now()}`,
      type: 'custom',
      name: customItem.name,
      description: customItem.description,
      quantity: customItem.quantity,
      unitPrice: customItem.unitPrice,
      total: customItem.quantity * customItem.unitPrice,
      taxable: true,
  };

    setLineItems([...lineItems, newItem]);
    setCustomItem({ name: '', description: ',', quantity: 1, unitPrice:  0 });
    setAddItemDialog(false);
};

  const updateLineItem = (index: number, field: keyof ContractLineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    // Recalculate total for this line item
    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].total = updated[index].quantity * updated[index].unitPrice;
  }

    setLineItems(updated);
};

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
};

  const calculateTotal = async () => {
    const serviceItems = lineItems
      .filter((item) => item.type === 'service' && item.serviceId)
      .map((item) => ({
        serviceItemId: item.serviceI!,
        quantity: item.quantity,
    }));

    const packageItems = lineItems
      .filter((item) => item.type === 'package' && item.packageId)
      .map((item) => ({
        packageId: item.packageI!,
        quantity: item.quantity,
    }));

    try {
      await calculatePricingMutation.mutateAsync({
        userId,
        serviceItems,
        packages: packageItems,
    });
  } catch (error) {
      console.error('Error calculating pricing: ', error);

      // Fallback manual calculation using centralized service
      const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      try {
        const taxes = getMVA(subtotal);
        const total = getTotalWithMVA(subtotal);
        setCalculationResult({
          subtotal,
          taxes: [{ name: 'MVA (25%)', rate: 0.25, amount: taxes }],
          total,
          discounts: [],
      });
    } catch (error) {
        // Fallback to hardcoded calculation
        const mvaRate = 0.25; // Norwegian MVA 25%
        const taxes = subtotal * mvaRate;
        const total = subtotal + taxes;
        setCalculationResult({
          subtotal,
          taxes: [{ name: `MVA (${(mvaRate * 100)}%)`, rate: mvaRate, amount: taxes }],
          total,
          discounts: [],
      });
    }
  }
};

  const generateContractText = () => {
    if (lineItems.length === 0) return '';

    let contractText = 'TJENESTER OG PRISER\n\n';

    lineItems.forEach((item, index) => {
      contractText += `${index + 1}. ${item.name}\n`;
      if (item.description) {
        contractText += `   Beskrivelse: ${item.description}\n`;
    }
      contractText += `   Antall: ${item.quantity} x ${item.unitPrice.toLocaleString('no-NO')} NOK\n`;
      contractText += `   Totalt: ${item.total.toLocaleString('')} NOK\n\n`;
  });

    if (calculationResult) {
      contractText += 'PRISSAMMENDRAG\n';
      contractText += `Subtotal: ${calculationResult.subtotal?.toLocaleString('')} NOK\n`;

      if (calculationResult.discounts?.length > 0) {
        calculationResult.discounts.forEach((discount: any) => {
          contractText += `${discount.name}: -${discount.amount?.toLocaleString('no-NO')} NOK\n`;
      });
    }

      if (calculationResult.taxes?.length > 0) {
        calculationResult.taxes.forEach((tax: any) => {
          contractText += `${tax.name}: ${tax.amount?.toLocaleString('no-NO')} NOK\n`;
      });
    }

      contractText += `TOTALT: ${calculationResult.total?.toLocaleString(', ')} NOK\n\n`;

      if (calculationResult.paymentBreakdown) {
        contractText += 'BETALINGSPLAN\n';
        contractText += `Forskudd (30%): ${calculationResult.paymentBreakdown.deposit?.toLocaleString('no-NO')} NOK\n`;
        contractText += `Restbeløp: ${calculationResult.paymentBreakdown.remaining?.toLocaleString(', ')} NOK\n`;
    }
  }

    return contractText;
};

  if (isLoading) {
    return (
      <Box sx={{ p:  3, textAlign: 'center'}}>
        <Typography>Laster prisdata...</Typography>
      </Box>
    );
}

  return (
    <Box sx={{ p:  3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb:  3}}
      >
        <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
          <ContractIcon />
          {professionConfig
            ? `${professionConfig.displayName} - Kontraktprising`
            : 'Kontraktprising'}
        </Typography>
        {!readOnly && (
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddItemDialog(true)}
            sx={{
              background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)'}}
          >
            Legg til
          </Button>
        )}
      </Box>

      {/* Line Items Table */}
      <TableContainer component={Paper} sx={{ mb:  3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tjeneste/Produkt</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Antall</TableCell>
              <TableCell>Enhetspris</TableCell>
              <TableCell>Totalt</TableCell>
              {!readOnly && <TableCell>Handlinger</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {lineItems.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Typography variant="subtitle2">{item.name}</Typography>
                  {item.description && (
                    <Typography variant="caption" color="text.secondary">
                      {item.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={
                      item.type === 'service'
                        ? 'Tjeneste'
                        : item.type === 'package'
                          ? 'Pakke'
                          : 'Tilpasset'
                  }
                    size="small"
                    color={
                      item.type === 'service'
                        ? 'primary'
                        : item.type === 'package'
                          ? 'secondary' : 'default'
                  }
                  />
                </TableCell>
                <TableCell>
                  {readOnly ? (
                    item.quantity
                  ) : (
                    <TextField
                      type="number"
                      size="small"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)
                    }
                      inputProps={{ min: 1, style: { width: '60px',} }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  {readOnly ? (
                    `${item.unitPrice.toLocaleString('no-NO')} NOK`
                  ) : (
                    <TextField
                      type="number"
                      size="small"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)
                    }
                      inputProps={{
                        min:  0,
                        step: 0.1,
                        style: { width: '100px',}}}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Typography sx={{ color: '#ff6b30', fontWeight: 'bold'}}>
                    {item.total.toLocaleString('no-NO')} NOK
                  </Typography>
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    <Button size="small" color="error" onClick={() => removeLineItem(index)}>
                      Fjern
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {lineItems.length === 0 && (
        <Alert severity="info" sx={{ mb:  3 }}>
          Ingen tjenester eller produkter lagt til ennå.
          {!readOnly && ' Klikk "Legg til" for å begynne.'}
        </Alert>
      )}

      {/* Pricing Summary */}
      {calculationResult && (
        <Card sx={{ mb:  3, bgcolor: 'rgba(25, 107, 53, 0.1)' ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
              <CalculateIcon />
              {professionConfig
                ? `${professionConfig.displayName} - Prissammendrag`
                : 'Prissammendrag'}
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb:  1}}
                >
                  <Typography>Subtotal: </Typography>
                  <Typography>{calculationResult.subtotal?.toLocaleString(', ')} NOK</Typography>
                </Box>

                {calculationResult.discounts?.map((discount: any, index: number) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb:  1,
                      color: 'success.main'}}
                  >
                    <Typography>- {discount.name}:</Typography>
                    <Typography>-{discount.amount?.toLocaleString('no-NO')} NOK</Typography>
                  </Box>
                ))}

                {calculationResult.taxes?.map((tax: any, index: number) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb:  1}}
                  >
                    <Typography>{tax.name}:</Typography>
                    <Typography>{tax.amount?.toLocaleString('no-NO')} NOK</Typography>
                  </Box>
                ))}

                <Divider sx={{ my:  1 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Totalt: </Typography>
                  <Typography variant="h6" sx={{  color: theming.colors.primary }}>
                    {calculationResult.total?.toLocaleString('no-NO')} NOK
                  </Typography>
                </Box>
              </Grid>

              {calculationResult.paymentBreakdown && (
                <Grid item xs={12} md={6}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      mb:  1,
                      display: 'flex',
                      alignItems: 'center',
                      gap:  1}}
                  >
                    <PaymentIcon />
                    Betalingsplan
                  </Typography>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius:  1 }}>
                    <Typography variant="body2" sx={{ mb:  1 }}>
                      <strong>Forskudd (30%):</strong>{', '}
                      {calculationResult.paymentBreakdown.deposit?.toLocaleString('no-NO')} NOK
                    </Typography>
                    <Typography variant="body2">
                      <strong>Restbeløp: </strong>{', '}
                      {calculationResult.paymentBreakdown.remaining?.toLocaleString('no-NO')} NOK
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Contract Text Generation */}
      {lineItems.length > 0 && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Generer kontrakttekst</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              fullWidth
              multiline
              rows={10}
              value={generateContractText()}
              variant="outlined"
              label="Kontrakttekst med priser"
              InputProps={{
                readOnly: true,
                style: { fontFamily: 'monospace', fontSize: '0.875rem',}}}
            />
          </AccordionDetails>
        </Accordion>
      )}

      {/* Add Item Dialog */}
      <Dialog open={addItemDialog} onClose={() => setAddItemDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Legg til tjeneste eller produkt</DialogTitle>
        <DialogContent>
          <Box sx={{ pt:  2 }}>
            {/* Services */}
            {services.length > 0 && (
              <Box sx={{ mb:  3 }}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  Velg {professionConfig ? professionConfig.displayName.toLowerCase() : ''} tjeneste
                </Typography>
                <FormControl fullWidth sx={{ mb:  2 }}>
                  <InputLabel>Tjeneste</InputLabel>
                  <Select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                  >
                    {services.map((service: any) => (
                      <MenuItem key={service.d} value={service.id}>
                        {service.service_name} - {service.base_price} NOK
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button variant="contained"
                  onClick={addServiceItem}
                  disabled={!selectedService}
                  sx={{
                    background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)'}}
                 sx={theming.getThemedButtonSx()}>
                  Legg til tjeneste
                </Button>
              </Box>
            )}

            {/* Packages */}
            {packages.length > 0 && (
              <Box sx={{ mb:  3 }}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  Velg {professionConfig ? professionConfig.displayName.toLowerCase() : ''} pakke
                </Typography>
                <FormControl fullWidth sx={{ mb:  2 }}>
                  <InputLabel>Pakke</InputLabel>
                  <Select
                    value={selectedPackage}
                    onChange={(e) => setSelectedPackage(e.target.value)}
                  >
                    {packages.map((pkg: any) => (
                      <MenuItem key={pkg.d} value={pkg.id}>
                        {pkg.package_name} - {pkg.total_price} NOK
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button variant="contained"
                  onClick={addPackageItem}
                  disabled={!selectedPackage}
                  sx={{
                    background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)'}}
                 sx={theming.getThemedButtonSx()}>
                  Legg til pakke
                </Button>
              </Box>
            )}

            {/* Custom Item */}
            <Box>
              <Typography variant="h6" sx={{  mb:  2  }}>
                Tilpasset {professionConfig ? professionConfig.displayName.toLowerCase() : ''}{','}
                tjeneste
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Navn"
                    value={customItem.name}
                    onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Enhetspris (NOK)"
                    value={customItem.unitPrice}
                    onChange={(e) =>
                      setCustomItem({
                        ...customItem,
                        unitPrice: parseFloat(e.target.value) || 0,
                    })
                  }
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Beskrivelse"
                    value={customItem.description}
                    onChange={(e) =>
                      setCustomItem({
                        ...customItem,
                        description: e.target.value,
                    })
                  }
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button variant="contained"
                    onClick={addCustomItem}
                    disabled={!customItem.name || customItem.unitPrice <= 0}
                    sx={{
                      background:'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)'}}
                   sx={theming.getThemedButtonSx()}>
                    Legg til tilpasset tjeneste
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddItemDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
