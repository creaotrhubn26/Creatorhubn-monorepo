/**
 * CreatorHub Norge - Create Pricing Modal
 * Modal for creating pricing structures
 */

import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect, useMemo } from 'react';
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
  InputAdornment,
  FormControlLabel,
  Switch,
  Chip,
  Alert,
  Divider,
  Stack
} from '@mui/material';
import {
  AttachMoney as PriceIcon,
  Schedule as TimeIcon,
  Today as DayIcon,
  LocalOffer as PackageIcon,
  Calculate as CalculateIcon
} from '@mui/icons-material';

interface CreatePricingModalProps {
  open: boolean;
  onClose: () => void;
  editData?: any;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

const CreatePricingModal: React.FC<CreatePricingModalProps> = ({
  open,
  onClose,
  editData,
  profession = 'photographer'
}) => {
  const [formData, setFormData] = useState({
    name:  ',',
    type: 'timespris',
    serviceCategory: 'foto',
    rates: {
      hourlyRate: '',
      halfDayRate: '',
      fullDayRate: '',
      packageRate: '',
      unitRate: '',
      licenseRate: ''
},
    licenseTypes: {
      commercial: false,
      reklame: false,
      buyout: false,
      exclusive: false,
      duration: '1 year'
},
    isActive: true
});

  const queryClient = useQueryClient();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);

  // Client service pricing service integration
  const { 
    formatCurrency: formatCurrencyService,
    getMVA,
    getTotalWithMVA,
    getDefaultPrice,
    isLoading: pricingLoading 
} = useClientServicePricing();

  // Norwegian currency formatting helpers
  const formatCurrency = (value: string | number): string => {
    if (!value || value === '') return ',';
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, ', ')) : value;
    if (isNaN(num)) return '';
    return num.toLocaleString('nb-NO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  const parseCurrency = (value: string): string => {
    return value.replace(/[^0-9.-]/g, ', ').replace(/,/g, '.');
  };

  // MVA calculation (25% Norwegian VAT)
  const calculateMVA = (amount: string | number): { base: number; mva: number; total: number } => {
    const base = typeof amount === 'string' ? parseFloat(parseCurrency(amount)) : amount;
    if (isNaN(base) || base === 0) return { base: 0, mva: 0, total:  0 };
    const mva = base * 0.25;
    const total = base + mva;
    return { base, mva, total };
};

  useEffect(() => {
    if (editData) {
      setFormData({
        name: editData.name ||'',
        type: editData.type || 'timespris',
        serviceCategory: editData.serviceCategory || 'foto',
        rates: editData.rates || {
          hourlyRate:'',
          halfDayRate: '',
          fullDayRate: '',
          packageRate: '',
          unitRate: '',
          licenseRate: ''
    },
        licenseTypes: editData.licenseTypes || {
          commercial: false,
          reklame: false,
          buyout: false,
          exclusive: false,
          duration: '1 year'
    },
        isActive: editData.isActive !== false
  });
  }
}, [editData]);

  const createPricingMutation = useMutation({
    mutationFn: async (pricingData: any) => {
      const url = editData 
        ? `/api/price-administration/pricing/${editData.d}`
        : '/api/price-administration/pricing';
      
      const response = await fetch(url, {
        method: editData ? 'PUT' : 'POS',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify(pricingData),
    });
      
      if (!response.ok) throw new Error('Failed to save pricing');
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/pricing', ],});
      handleClose();
  },
});

  const handleClose = () => {
    setFormData({
      name: '',
      type: 'timespris',
      serviceCategory: 'foto',
      rates: {
        hourlyRate:', ',
        halfDayRate: ', ',
        fullDayRate: ', ',
        packageRate: ', ',
        unitRate: ', ',
        licenseRate: ''
  },
      licenseTypes: {
        commercial: false,
        reklame: false,
        buyout: false,
        exclusive: false,
        duration: '1 year'
  },
      isActive: true
});
    onClose();
};

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    // Convert rates to numbers and remove empty ones
    const cleanRates = Object.entries(formData.rates).reduce((acc, [key, value]) => {
      if (value && value !== '') {
        acc[key] = parseFloat(value as string);
    }
      return acc;
  }, {} as any);

    const pricingData = {
      ...formData,
      rates: cleanRates
};

    createPricingMutation.mutate(pricingData);
};

  const handleRateChange = (field: string, value: string) => {
    // Parse the input value to handle Norwegian formatting
    const parsedValue = parseCurrency(value);
    setFormData(prev => ({
      ...prev,
      rates: {
        ...prev.rates,
        [field]: parsedValue
    }
  }));
};

  // Calculate MVA for preview
  const currentRateMVA = useMemo(() => {
    const activeFields = getActiveRateFields();
    if (activeFields.length === 0) return null;
    
    const field = activeFields[0];
    const rate = formData.rates[field as keyof typeof formData.rates];
    return rate ? calculateMVA(rate) : null;
}, [formData.rates, formData.type]);

  const handleLicenseChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      licenseTypes: {
        ...prev.licenseTypes,
        [field]: value
    }
  }));
};

  const getActiveRateFields = () => {
    switch (formData.type) {
      case 'timespris':
        return ['hourlyRate'];
      case 'heldagspris':
        return ['fullDayRate'];
      case 'halvdagspris':
        return ['halfDayRate'];
      case 'pakkepris':
        return ['packageRate'];
      case 'stykkpris':
        return ['unitRate'];
      case 'lisenspris':
        return ['licenseRate'];
      default: return ['hourlyRate'];
}
};

  const getRateLabel = (field: string) => {
    const labels: Record<string, string> = {
      hourlyRate: 'Timepris',
      halfDayRate: 'Halvdagspris',
      fullDayRate: 'Heldagspris',
      packageRate: 'Pakkepris',
      unitRate: 'Stykkpris',
      licenseRate: 'Lisenspris'
    };
    return labels[field] || field;
  };

  const getRateIcon = (field: string) => {
    const icons: Record<string, React.ReactNode> = {
      hourlyRate: <TimeIcon />,
      halfDayRate: <DayIcon />,
      fullDayRate: <DayIcon />,
      packageRate: <PackageIcon />,
      unitRate: <PriceIcon />,
      licenseRate: <PriceIcon />
    };
    return icons[field] || <PriceIcon />;
};

  return (
    <Dialog 
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2 }
    }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <PriceIcon color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            {editData ? 'Rediger prisstruktur' : 'Opprett ny prisstruktur'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" color="primary" gutterBottom sx={{ color: theming.colors.primary }}>
              Grunnleggende informasjon
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Navn"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="f.eks. Standard timepris foto"
              required
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Pristype"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              required
            >
              <MenuItem value="timespris">Timespris</MenuItem>
              <MenuItem value="heldagspris">Heldagspris</MenuItem>
              <MenuItem value="halvdagspris">Halvdagspris</MenuItem>
              <MenuItem value="pakkepris">Pakkepris</MenuItem>
              <MenuItem value="stykkpris">Stykkpris</MenuItem>
              <MenuItem value="lisenspris">Lisenspris</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Tjenestekategori"
              value={formData.serviceCategory}
              onChange={(e) => setFormData(prev => ({ ...prev, serviceCategory: e.target.value }))}
              required
            >
              <MenuItem value="foto">Fotografering</MenuItem>
              <MenuItem value="video">Videografering</MenuItem>
              <MenuItem value="redigering">Redigering</MenuItem>
              <MenuItem value="utskrifter">Utskrifter</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                />
            }
              label="Aktiv prisstruktur"
            />
          </Grid>

          {/* Pricing */}
          <Grid item xs={12}>
            <Typography variant="h6" color="primary" gutterBottom sx={{ color: theming.colors.primary }}>
              Priser
            </Typography>
          </Grid>

          {getActiveRateFields().map((field) => {
            const rate = formData.rates[field as keyof typeof formData.rates];
            const mvaPricing = rate ? calculateMVA(rate) : null;
            
            return (
              <Grid item xs={12} key={field}>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label={getRateLabel(field)}
                    value={rate || ', '}
                    onChange={(e) => handleRateChange(field, e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          {getRateIcon(field)}
                        </InputAdornment>
                      ),
                      endAdornment: <InputAdornment position="end">NOK</InputAdornment>}}
                    placeholder="f.eks. 1500"
                    helperText="Skriv inn pris uten MVA"
                    required
                  />
                  
                  {/* MVA Calculation Display */}
                  {mvaPricing && mvaPricing.base > 0 && (
                    <Box sx={{ 
                      p: 2, bgcolor: 'primary.5', 
                      borderRadius:  1,
                      border: '1px solid',
                      borderColor: 'primary.200'
                }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                        <CalculateIcon sx={{ mr: 1, color: 'primary.main', fontSize: 20}} />
                        <Typography variant="subtitle2" color="primary">
                          MVA-kalkulering (25%)
                        </Typography>
                      </Box>
                      
                      <Stack spacing={0.5}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                          <Typography variant="body2">Pris uten MVA: </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {formatCurrency(mvaPricing.base)} NOK
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                          <Typography variant="body2">MVA (25%):</Typography>
                          <Typography variant="body2" color="success.main">
                            +{formatCurrency(mvaPricing.mva)} NOK
                          </Typography>
                        </Box>
                        
                        <Divider sx={{ my: 0.5}} />
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>Total med MVA: </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {formatCurrency(mvaPricing.total)} NOK
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Grid>
            );
        })}

          {/* License Types (for license pricing) */}
          {formData.type === 'lisenspris' && (
            <>
              <Grid item xs={12}>
                <Typography variant="h6" color="primary" gutterBottom sx={{ color: theming.colors.primary }}>
                  Lisenstyper
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.licenseTypes.commercial}
                        onChange={(e) => handleLicenseChange('commercial', e.target.checked)}
                      />
                  }
                    label="Kommersiell bruk"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.licenseTypes.reklame}
                        onChange={(e) => handleLicenseChange('reklame', e.target.checked)}
                      />
                  }
                    label="Reklamebruk"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.licenseTypes.buyout}
                        onChange={(e) => handleLicenseChange('buyout', e.target.checked)}
                      />
                  }
                    label="Buyout (kjøp av alle rettigheter)"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.licenseTypes.exclusive}
                        onChange={(e) => handleLicenseChange('exclusive', e.target.checked)}
                      />
                  }
                    label="Eksklusiv lisens"
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Lisensvarighet"
                  value={formData.licenseTypes.duration}
                  onChange={(e) => handleLicenseChange('duration', e.target.value)}
                >
                  <MenuItem value="1 year">1 år</MenuItem>
                  <MenuItem value="2 years">2 år</MenuItem>
                  <MenuItem value="5 years">5 år</MenuItem>
                  <MenuItem value="perpetual">Evig</MenuItem>
                </TextField>
              </Grid>
            </>
          )}
        </Grid>

        {/* Preview */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Forhåndsvisning:
          </Typography>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>{formData.name || 'Prisstrukturnavn'}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            <Chip size="small" label={formData.type} />
            <Chip size="small" label={formData.serviceCategory} />
            {formData.isActive && <Chip size="small" label="Aktiv" color="success" />}
          </Box>
          <Box sx={{ mt: 1 }}>
            {getActiveRateFields().map((field) => {
              const rate = formData.rates[field as keyof typeof formData.rates];
              if (rate) {
                const mvaPricing = calculateMVA(rate);
                return (
                  <Box key={field}>
                    <Typography variant="body2" color="primary">
                      {getRateLabel(field)}: {formatCurrency(mvaPricing.base)} NOK (uten MVA)
                    </Typography>
                    <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
                      Med MVA: {formatCurrency(mvaPricing.total)} NOK
                    </Typography>
                  </Box>
                );
            }
              return null;
          })}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Avbryt
        </Button>
        <Button variant="contained"
          onClick={handleSubmit}
          disabled={!formData.name.trim() || createPricingMutation.isPending}
         sx={theming.getThemedButtonSx()}>
          {createPricingMutation.isPending 
            ? 'Lagrer...' 
            : editData 
              ? 'Oppdater prisstruktur' : 'Opprett prisstruktur'
        }
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreatePricingModal;