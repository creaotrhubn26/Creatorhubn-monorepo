/**
 * CreatorHub Norge - Pricing Adjustment Modal
 * Integrated with Price Administration for centralized pricing control
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useClientServicePricing } from '../../services/ClientServicePricingService';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Grid,
  Card,
  CardContent,
  Alert,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  LinearProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Warning as WarningIcon,
  LocalOffer as PriceIcon,
  Calculate as CalculateIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon,
  Category as CategoryIcon,
  Group as GroupIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

interface PricingAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  profession: string;
  onPricingUpdated?: (pricing: any) => void; 
}

interface PricingStructure {
  id: number;
  name: string;
  type: 'hourly' | 'daily' | 'package' | 'fixed';
  category: string;
  profession: string;
  hourlyRate: number;
  fullDayRate: number;
  basePrice: number;
  minimumPrice: number;
  maximumPrice: number;
  seasonFactor: number;
  description: string;
  includedServices: string[];
  extraCosts: any[];
  status: 'active' | 'inactive';
  isDefault: boolean; 
}

interface Package {
  id: number;
  name: string;
  description: string;
  category: string;
  profession: string;
  basePrice: number;
  hourlyRate: number;
  imageCount: number;
  ratePerImage: number;
  includedServices: string[];
  status: 'active' | 'inactive';
  isDefault: boolean; 
}

const PricingAdjustmentModal: React.FC<PricingAdjustmentModalProps> = ({
  open,
  onClose,
  profession,
  onPricingUpdated
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { integration, communication } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  
  // Dynamic profession system
  const { getProfessionDisplayName: getDynamicProfessionName } = useDynamicProfessions();

  // Client service pricing service integration
  const { 
    formatCurrency,
    getDefaultPrice,
    getMVA,
    getTotalWithMVA,
    isLoading: pricingLoading 
} = useClientServicePricing();

  // State for form data
  const [formData, setFormData] = useState({
    basePrice:  0,
    hourlyRate:  0,
    fullDayRate:  0,
    minimumPrice:  0,
    maximumPrice:  0,
    seasonFactor: 1.0,
    description: '',
    includedServices: [] as string[],
    extraCosts: [] as any[],
    isDefault: false
,});

  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Fetch pricing structures
  const { data: pricingStructures, isLoading: structuresLoading } = useQuery({
    queryKey: [ '/api/price-administration/pricing-structures,', profession],
    enabled: open,
    onSuccess: (data) => {
      const defaultStructure = data.find((s: PricingStructure) => s.isDefault);
      if (defaultStructure) {
        setFormData({
          basePrice: defaultStructure.basePrice || 0,
          hourlyRate: defaultStructure.hourlyRate || 0,
          fullDayRate: defaultStructure.fullDayRate || 0,
          minimumPrice: defaultStructure.minimumPrice || 0,
          maximumPrice: defaultStructure.maximumPrice || 0,
          seasonFactor: defaultStructure.seasonFactor || 1.0,
          description: defaultStructure.description as any ||'',
          includedServices: defaultStructure.includedServices || [],
          extraCosts: defaultStructure.extraCosts || [],
          isDefault: defaultStructure.isDefault || false
      ,});
    }
  }
});

  // Fetch packages
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ['/api/pricing/packages', user?.id],
    queryFn: () => fetch(`/api/pricing/packages/${user?.id}`).then(res => res.json()),
    enabled: open && !!user?.id,
    onSuccess: (data) => {
      const defaultPackage = data.find((p: Package) => p.isDefault);
      if (defaultPackage) {
        setSelectedPackage(defaultPackage);
    }
  }
});

  // Fetch current projects count for impact warning
  const { data: projectsCount } = useQuery({
    queryKey: ['/api/projects/count', profession],
    enabled: open
,});

  // Save pricing mutation
  const savePricingMutation = useMutation({
    mutationFn: async (pricingData: any) => {
      const response = await fetch('/api/price-administration/pricing-structures', {
        method: 'POS',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.token}`
      },
        body: JSON.stringify({
          ...pricingData,
          profession,
          userId: user?.id
      ,})
    });

      if (!response.ok) {
        throw new Error('Failed to save pricing');
    }

      return response.json();
  },
    onSuccess: () => {
      setSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/pricing-structures', profession] });
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/packages', profession] });
      
      // Notify parent component
      if (onPricingUpdated) {
        onPricingUpdated(formData);
    }

      // Show success message
      setTimeout(() => {
        setSaveStatus('idle');
    }, 2000);
  },
    onError: () => {
      setSaveStatus('error');
      setTimeout(() => {
        setSaveStatus('idle');
    ,}, 3000);
  }
});

  // Save package mutation
  const savePackageMutation = useMutation({
    mutationFn: async (packageData: any) => {
      const response = await fetch('/api/pricing/packages', {
        method: 'POS',
        headers: {
          'Content-Type' : 'application/json','Authorization': `Bearer ${user?.token}`
      },
        body: JSON.stringify({
          ...packageData,
          profession,
          userId: user?.id
      ,})
    });

      if (!response.ok) {
        throw new Error('Failed to save package');
    }

      return response.json();
  },
    onSuccess: () => {
      setSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/packages', profession] });
      
      setTimeout(() => {
        setSaveStatus('idle');
    }, 2000);
  },
    onError: () => {
      setSaveStatus('error');
      setTimeout(() => {
        setSaveStatus('idle');
    ,}, 3000);
  }
});

  // Register component with integration system
  useEffect(() => {
    if (open) {
      communication.registerComponent('pricing-adjustment-modal', 'pricing', [
        'data: read', 'data: write', 'event: emit', 'event: listen', 'ui: update', 'pricing: update', 'package: update'
      ]);
  }
}, [open, communication]);

  // Show toast when modal opens and data is loading
  useEffect(() => {
    if (open && (structuresLoading || packagesLoading)) {
      // This will be handled by the parent component's toast system
      console.log('Loading pricing data from Price Administration...');
  }
}, [open, structuresLoading, packagesLoading]);

  const handleSave = async () => {
    setIsLoading(true);
    setSaveStatus('saving');

    try {
      // Save pricing structure
      await savePricingMutation.mutateAsync(formData);

      // Save package if modified
      if (selectedPackage) {
        await savePackageMutation.mutateAsync(selectedPackage);
    }

      // Track analytics
      integration.analytics.trackEvent('pricing_updated', {
        profession,
        basePrice: formData.basePrice,
        hourlyRate: formData.hourlyRate,
        packageCount: packages?.length || 0
    ,});

  } catch (error) {
      console.error('Failed to save pricing: ', error);
  } finally {
      setIsLoading(false);
  }
};

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
};

  const handlePackageChange = (field: string, value: any) => {
    if (selectedPackage) {
      setSelectedPackage(prev => prev ? { ...prev, [field]: value } : null);
  }
};

  const calculateTotalImpact = () => {
    const basePrice = formData.basePrice || 0;
    const imageCount = selectedPackage?.imageCount || 50;
    return basePrice * imageCount;
};

  const getProfessionDisplayName = (prof: string) => {
    return getDynamicProfessionName(prof);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px',}
    }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        bgcolor: 'primary.main',
        color: 'primary.contrastText'
    }}>
        <Box sx={{ display: 'flex', alignItems: 'center'}}>
          <PriceIcon sx={{ mr:  1 }} />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Prisjustering - {getProfessionDisplayName(profession)}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'inherit'}}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p:  3 }}>
        {/* Impact Warning */}
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ mb:  3 }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600}>
            ⚠️ Endringer i priser påvirker alle prosjekter
          </Typography>
          <Typography variant="body2">
            {projectsCount ? `${projectsCount} eksisterende prosjekter` : 'Alle prosjekter'} vil bli påvirket av disse endringene.
            Sørg for at nye priser er korrekte før du lagrer.
          </Typography>
        </Alert>

        {/* Loading State */}
        {(structuresLoading || packagesLoading) && (
          <Box sx={{ mb:  3 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 1, textAlign: 'center'}}>
              Laster prisdata...
            </Typography>
          </Box>
        )}

        {/* Pricing Structure */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center'}}>
              <CalculateIcon sx={{ mr: 1, color: 'primary.main'}} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Grunnleggende Prisstruktur</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid size={{ xs:  12, md:  6 }}>
                <TextField
                  fullWidth
                  label="Grunnpris per bilde (NOK)"
                  type="number"
                  value={formData.basePrice}
                  onChange={(e) => handleFormChange('basePrice', parseFloat(e.target.value) || 0)}
                  helperText="Standardpris for hvert bilde"
                />
              </Grid>
              <Grid size={{ xs:  12, md:  6 }}>
                <TextField
                  fullWidth
                  label="Timepris (NOK)"
                  type="number"
                  value={formData.hourlyRate}
                  onChange={(e) => handleFormChange('hourlyRate', parseFloat(e.target.value) || 0)}
                  helperText="Pris per time for tilleggsarbeid"
                />
              </Grid>
              <Grid size={{ xs:  12, md:  6 }}>
                <TextField
                  fullWidth
                  label="Dagspris (NOK)"
                  type="number"
                  value={formData.fullDayRate}
                  onChange={(e) => handleFormChange('fullDayRate', parseFloat(e.target.value) || 0)}
                  helperText="Pris for hele dagen"
                />
              </Grid>
              <Grid size={{ xs:  12, md:  6 }}>
                <TextField
                  fullWidth
                  label="Sesongfaktor"
                  type="number"
                  step="0.1"
                  value={formData.seasonFactor}
                  onChange={(e) => handleFormChange('seasonFactor', parseFloat(e.target.value) || 1.0)}
                  helperText="Multiplikator for sesongpriser (1.0 = normal)"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Beskrivelse"
                  multiline
                  rows={3}
                  value={formData.description as any}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  helperText="Beskrivelse av prisstrukturen"
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Package Configuration */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center'}}>
              <CategoryIcon sx={{ mr: 1, color: 'secondary.main'}} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Pakkeoppsett</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {selectedPackage && (
              <Grid container spacing={3}>
                <Grid size={{ xs:  12, md:  6 }}>
                  <TextField
                    fullWidth
                    label="Pakkens navn"
                    value={selectedPackage.name}
                    onChange={(e) => handlePackageChange('name', e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs:  12, md:  6 }}>
                  <TextField
                    fullWidth
                    label="Antall bilder i pakke"
                    type="number"
                    value={selectedPackage.imageCount}
                    onChange={(e) => handlePackageChange('imageCount', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid size={{ xs:  12, md:  6 }}>
                  <TextField
                    fullWidth
                    label="Pris per bilde (NOK)"
                    type="number"
                    value={selectedPackage.ratePerImage}
                    onChange={(e) => handlePackageChange('ratePerImage', parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid size={{ xs:  12, md:  6 }}>
                  <TextField
                    fullWidth
                    label="Total pakkepris (NOK)"
                    type="number"
                    value={selectedPackage.basePrice}
                    onChange={(e) => handlePackageChange('basePrice', parseFloat(e.target.value) || 0)}
                    helperText={`Automatisk: ${selectedPackage.ratePerImage * selectedPackage.imageCount} NOK`}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Pakke beskrivelse"
                    multiline
                    rows={2}
                    value={selectedPackage.description as any}
                    onChange={(e) => handlePackageChange('description', e.target.value)}
                  />
                </Grid>
              </Grid>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Pricing Summary */}
        <Card sx={{ mt:  3, bgcolor: 'success.5', border: '1px solid', borderColor: 'success.200',  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
              <TrendingUpIcon sx={{ mr: 1, color: 'success.main'}} />
              <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                Prisoversikt
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs:  12, sm:  4 }}>
                <Typography variant="body2" color="text.secondary">
                  Grunnpris per bilde
                </Typography>
                <Typography variant="h6" color="primary.main" sx={{ color: theming.colors.primary }}>
                  {formData.basePrice.toLocaleString('no-NO')} NOK
                </Typography>
              </Grid>
              <Grid size={{ xs:  12, sm:  4 }}>
                <Typography variant="body2" color="text.secondary">
                  Standardpakke ({selectedPackage?.imageCount || 50} bilder)
                </Typography>
                <Typography variant="h6" color="secondary.main" sx={{ color: theming.colors.primary }}>
                  {calculateTotalImpact().toLocaleString('no-NO')} NOK
                </Typography>
              </Grid>
              <Grid size={{ xs:  12, sm:  4 }}>
                <Typography variant="body2" color="text.secondary">
                  Timepris
                </Typography>
                <Typography variant="h6" color="info.main" sx={{ color: theming.colors.primary }}>
                  {formData.hourlyRate.toLocaleString('no-NO')} NOK/time
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Save Status */}
        {saveStatus === 'saving' && (
          <Alert severity="info" sx={{ mt:  2 }}>
            <LinearProgress sx={{ mb:  1 }} />
            Lagrer prisendringer...
          </Alert>
        )}
        
        {saveStatus === 'saved' && (
          <Alert severity="success" sx={{ mt:  2 }} icon={<CheckCircleIcon />}>
            Prisendringer lagret! Alle prosjekter er oppdatert.
          </Alert>
        )}
        
        {saveStatus === 'error' && (
          <Alert severity="error" sx={{ mt:  2 }} icon={<ErrorIcon />}>
            Kunne ikke lagre prisendringer. Prøv igjen.
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ p:  3, bgcolor: 'grey.50'}}>
        <Button
          onClick={onClose}
          variant="outlined"
          disabled={isLoading}
        >
          Avbryt
        </Button>
        <Button onClick={handleSave}
          variant="contained"
          disabled={isLoading}
          startIcon={saveStatus === 'saving' ? <RefreshIcon sx={theming.getThemedButtonSx()}> : <SaveIcon />}
          sx={{ minWidth: 120}}
        >
          {saveStatus === 'saving' ? 'Lagrer...' : 'Lagre Priser'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PricingAdjustmentModal;
