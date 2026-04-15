// @ts-nocheck
/**
 * CreatorHub Norge - Showcase Pricing Integration
 * Displays services and packages in showcase with pricing
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useClientServicePricing } from '../../services/ClientServicePricingService';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  Alert,
} from '@mui/material';
import {
  LocalOffer as PriceIcon,
  Inventory as InventoryIcon,
  ContactPhone as ContactIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ShowcasePricingIntegrationProps {
  userId: string;
  profession: string;
  variant?: 'showcase' | 'compact' | 'detailed';
  onPriceSelect?: (serviceId: number, price: number) => void;
  onPackageSelect?: (packageId: number, price: number) => void
}

export default function ShowcasePricingIntegration({
  userId,
  profession,
  variant = 'showcase',
  onPriceSelect,
  onPackageSelect,
}: ShowcasePricingIntegrationProps) {
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);

  // Theming system
  const theming = useTheming('photographer');

  // Client service pricing service integration
  const { 
    formatCurrency,
    getDefaultPrice,
    isLoading: pricingLoading 
} = useClientServicePricing();

  // Fetch pricing data for showcase
  const { data: pricingData, isLoading } = useQuery({
    queryKey: ['/api/pricing/integration/showcase', userId],
    queryFn: () => apiRequest(`/api/pricing/integration/showcase/${userId}`),
});

  const services = pricingData?.services || [];
  const packages = pricingData?.packages || [];

  // Calculate pricing mutation
  const calculatePricingMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/pricing/calculate', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
});

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    onPriceSelect?.(service.id, parseFloat(service.base_price));
  };

  const handlePackageSelect = (pkg: any) => {
    setSelectedPackage(pkg);
    onPackageSelect?.(pkg.id, parseFloat(pkg.total_price));
  };

  const addToCalculator = (item: any, type: 'service' | 'package') => {
    const newItem = {
      ...item,
      type,
      quantity:  1,
  };
    setSelectedItems([...selectedItems, newItem]);
    setCalculatorOpen(true);
};

  const calculateTotal = async () => {
    const serviceItems = selectedItems
      .filter((item) => item.type === 'service')
      .map((item) => ({
        serviceItemId: item.d,
        quantity: item.quantity,
    }));

    const packageItems = selectedItems
      .filter((item) => item.type === 'package')
      .map((item) => ({
        packageId: item.d,
        quantity: item.quantity,
    }));

    try {
      const result = await calculatePricingMutation.mutateAsync({
        userId,
        serviceItems,
        packages: packageItems,
    });
      return result;
  } catch (error) {
      console.error('Error calculating pricing: ', error);
      return null;
  }
};

  if (isLoading) {
    return (
      <Box sx={{ p:  3, textAlign: 'center'}}>
        <Typography>Laster priser...</Typography>
      </Box>
    );
}

  if (variant === 'compact') {
    return (
      <Box sx={{ py:  2 }}>
        <Typography variant="h6" sx={{  mb: 2, color: theming.colors.primary }}>
          Priser og pakker
        </Typography>

        {services.length > 0 && (
          <Box sx={{ mb:  3 }}>
            <Typography variant="subtitle2" sx={{ mb:  1 }}>
              Tjenester
            </Typography>
            <Grid container spacing={1}>
              {services.slice(0, 3).map((service: any) => (
                <Grid item xs={12} sm={6} md={4} key={service.id}>
                  <Card
                    sx={{
                      cursor: 'pointer', '&:hover': { boxShadow:  3 },
                      border: '1px solid rgba(25, 107, 53, 0.2)'}}
                    onClick={() => handleServiceSelect(service)}
                  >
                    <CardContent sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="subtitle2" noWrap>
                        {service.service_name}
                      </Typography>
                      <Typography variant="h6" sx={{  color: theming.colors.primary }}>
                        {service.base_price} NOK
                      </Typography>
                      <Typography variant="caption">per {service.unit}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {packages.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb:  1 }}>
              Pakker
            </Typography>
            <Grid container spacing={1}>
              {packages.slice(0, 2).map((pkg: any) => (
                <Grid item xs={12} sm={6} key={pkg.id}>
                  <Card
                    sx={{
                      cursor: 'pointer','&:hover': { boxShadow:  3 },
                      border: '1px solid rgba(25, 107, 53, 0.2)'}}
                    onClick={() => handlePackageSelect(pkg)}
                  >
                    <CardContent sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="subtitle2" noWrap>
                        {pkg.package_name}
                      </Typography>
                      <Typography variant="h6" sx={{  color: theming.colors.primary }}>
                        {pkg.total_price} NOK
                      </Typography>
                      {pkg.discount_from_individual && (
                        <Chip
                          label={`Spar ${pkg.discount_from_individual} NOK`}
                          size="small"
                          color="success"
                        />
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Box>
    );
}

  return (
    <Box sx={{ py:  3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb:  3}}
      >
        <Typography variant="h5" sx={{  color: theming.colors.primary }}>
          Tjenester og priser
        </Typography>
        <Button
          variant="outlined"
          startIcon={<CalculateIcon />}
          onClick={() => setCalculatorOpen(true)}
          sx={{ borderColor: '#ff6b30', color: '#ff6b35'}}
        >
          Priskalulator
        </Button>
      </Box>

      {/* Services Section */}
      {services.length > 0 && (
        <Box sx={{ mb:  4 }}>
          <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
            <PriceIcon />
            Tjenester
          </Typography>

          <Grid container spacing={3}>
            {services.map((service: any) => (
              <Grid item xs={12} md={6} lg={4} key={service.id}>
                <Card
                  sx={{
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.96)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(25, 107, 53, 0.2)','&:hover': {
                      boxShadow:  3,
                      transform: 'translateY(-2px)',
                      transition: 'all 0.3s ease',
                  }}}
                 sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" sx={{  mb: 1, color: theming.colors.primary }}>
                      {service.service_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                      {service.description}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb:  2}}
                    >
                      <Typography variant="h5" sx={{  color: theming.colors.primary }}>
                        {service.base_price} NOK
                      </Typography>
                      <Typography variant="caption">per {service.unit}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap:  1 }}>
                      <Button variant="contained"
                        size="small"
                        onClick={() => handleServiceSelect(service)}
                        sx={{
                          background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                          flex:  1}}
                      >
                        Velg
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => addToCalculator(service, 'service')}
                        sx={{ borderColor: '#ff6b30', color: '#ff6b35'}}
                      >
                        <CalculateIcon />
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Packages Section */}
      {packages.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
            <PackageIcon />
            Pakkepriser
          </Typography>

          <Grid container spacing={3}>
            {packages.map((pkg: any) => (
              <Grid item xs={12} md={6} key={pkg.id}>
                <Card
                  sx={{
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.96)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(25, 107, 53, 0.2)','&:hover': {
                      boxShadow:  3,
                      transform: 'translateY(-2px)',
                      transition: 'all 0.3s ease',
                  }}}
                 sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" sx={{  mb: 1, color: theming.colors.primary }}>
                      {pkg.package_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                      {pkg.description}
                    </Typography>
                    <Typography variant="h4" sx={{  color: '#ff6b30', mb:  2  }}>
                      {pkg.total_price} NOK
                    </Typography>
                    {pkg.discount_from_individual && (
                      <Alert severity="success" sx={{ mb:  2 }}>
                        Spar {pkg.discount_from_individual} NOK med denne pakken!
                      </Alert>
                    )}
                    <Box sx={{ display: 'flex', gap:  1 }}>
                      <Button variant="contained"
                        onClick={() => handlePackageSelect(pkg)}
                        sx={{
                          background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                          flex:  1}}
                      >
                        Velg pakke
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => addToCalculator(pkg, 'package')}
                        sx={{ borderColor: '#ff6b30', color: '#ff6b35'}}
                      >
                        <CalculateIcon />
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* No pricing data */}
      {services.length === 0 && packages.length === 0 && (
        <Alert severity="info" sx={{ mt:  3 }}>
          Ingen synlige priser konfigurert. Kontakt oss for tilpasset tilbud.
        </Alert>
      )}

      {/* Pricing Calculator Dialog */}
      <Dialog
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Priskalulator</DialogTitle>
        <DialogContent>
          <PricingCalculatorDialog
            userId={userId}
            selectedItems={selectedItems}
            onItemsChange={setSelectedItems}
            onCalculate={calculateTotal}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalculatorOpen(false)}>Lukk</Button>
          <Button variant="contained"
            startIcon={<ContactIcon />}
            sx={{
              background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)'}}
          >
            Kontakt for tilbud
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Pricing Calculator Dialog Component
function PricingCalculatorDialog({ userId, selectedItems, onItemsChange, onCalculate }: any) {
  const [calculation, setCalculation] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const result = await onCalculate();
      setCalculation(result);
  } catch (error) {
      console.error('Calculation error:', error);
  } finally {
      setCalculating(false);
  }
};

  const updateQuantity = (index: number, quantity: number) => {
    const updated = [...selectedItems];
    updated[index].quantity = Math.max, (quantity);
    onItemsChange(updated);
};

  const removeItem = (index: number) => {
    const updated = selectedItems.filter((_: any, i: number) => i !== index);
    onItemsChange(updated);
};

  return (
    <Box sx={{ minHeight: 400}}>
      {selectedItems.length === 0 ? (
        <Alert severity="info">Legg til tjenester eller pakker for å beregne priser</Alert>
      ) : (
        <>
          <TableContainer component={Paper} sx={{ mb:  3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tjeneste/Pakke</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Pris</TableCell>
                  <TableCell>Antall</TableCell>
                  <TableCell>Totalt</TableCell>
                  <TableCell>Handlinger</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedItems.map((item: any, index: number) => (
                  <TableRow key={`${item.type}-${item.id}`}>
                    <TableCell>{item.service_name || item.package_name}</TableCell>
                    <TableCell>
                      <Chip
                        label={item.type === 'service' ? 'Tjeneste' : 'Pakke'}
                        size="small"
                        color={item.type === 'service' ? 'primary' : 'secondary'}
                      />
                    </TableCell>
                    <TableCell>{formatCurrency(item.base_price || item.total_price, 'NOK')}</TableCell>
                    <TableCell>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(index, parseInt(e.target.value))}
                        style={{ width: '60px', padding: '4px'}}
                      />
                    </TableCell>
                    <TableCell>
                      {formatCurrency((item.base_price || item.total_price) * item.quantity, 'NOK')}
                    </TableCell>
                    <TableCell>
                      <Button size="small" color="error" onClick={() => removeItem(index)}>
                        Fjern
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'center', mb:  3 }}>
            <Button variant="contained"
              onClick={handleCalculate}
              disabled={calculating}
              sx={{
                background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                ...theming.getThemedButtonSx(),
              }}
            >
              {calculating ? 'Beregner...' : 'Beregn totalpris'}
            </Button>
          </Box>

          {calculation && (
            <Card sx={{ p:  3, bgcolor: 'rgba(25, 107, 53, 0.1)' ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" sx={{  mb:  2  }}>
                Prisberegning
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                <Typography>Subtotal: </Typography>
                <Typography>{calculation.subtotal?.toLocaleString(', ')} NOK</Typography>
              </Box>

              {calculation.discounts?.map((discount: any, index: number) => (
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

              {calculation.taxes?.map((tax: any, index: number) => (
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

              <Divider sx={{ my:  2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Totalt: </Typography>
                <Typography variant="h6" sx={{  color: theming.colors.primary }}>
                  {calculation.total?.toLocaleString('no-NO')} NOK
                </Typography>
              </Box>

              {calculation.paymentBreakdown && (
                <Box
                  sx={{
                    mt:  2,
                    p:  2,
                    bgcolor: 'background.paper',
                    borderRadius:  1}}
                >
                  <Typography variant="subtitle2" sx={{ mb:  1 }}>
                    Betalingsplan: </Typography>
                  <Typography variant="body2">
                    Forskudd (30%): {calculation.paymentBreakdown.deposit?.toLocaleString(', ')}{', '}
                    NOK
                  </Typography>
                  <Typography variant="body2">
                    Restbeløp: {calculation.paymentBreakdown.remaining?.toLocaleString('')} NOK
                  </Typography>
                </Box>
              )}
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
