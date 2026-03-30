/**
 * Extra Image Pricing Dialog
 * Handles pricing options for images beyond contract agreement
 */

import { useTheming } from '../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  RadioGroup,
  Radio,
  FormControlLabel,
  TextField,
  Alert,
  Chip,
  Divider,
  LinearProgress,
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import TermsAcceptanceDialog from './TermsAcceptanceDialog';

interface ExtraImagePricingDialogProps {
  open: boolean;
  onClose: () => void;
  galleryId: string;
  selectedImages: string[];
  contractedImages: number;
  clientEmail: string;
  photographerId: string;
  onSubmitSuccess: () => void
}

interface PricingOption {
  id: string;
  quantity?: number;
  price: number;
  pricePerImage?: number;
  savings?: number;
  description: string;
  currency: string
}

export default function ExtraImagePricingDialog({
  open,
  onClose,
  galleryId,
  selectedImages,
  contractedImages,
  clientEmail,
  photographerId,
  onSubmitSuccess
}: ExtraImagePricingDialogProps) {
  const queryClient = useQueryClient();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);
  const [selectedOption, setSelectedOption] = useState<string>('per_image');
  const [customQuantity, setCustomQuantity] = useState<number>(0);
  const [clientNotes, setClientNotes] = useState<string>('');
  const [termsAcceptanceOpen, setTermsAcceptanceOpen] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  
  const extraImages = Math.max(0, selectedImages.length - contractedImages);

  // Fetch pricing options
  const { data: pricingOptions, isLoading: loadingOptions } = useQuery({
    queryKey: ['/api/extra-images/pricing-options', galleryId],
    queryFn: () => apiRequest(['/api/extra-images/pricing-options', galleryId], {
      headers: {
  }
  }),
    enabled: open && extraImages > 0 });

  // Calculate pricing mutation
  const calculatePricingMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/extra-images/calculate-pricing', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(data)
  });
  },
    onSuccess: (data) => {
      console.log('💰 Pricing calculated, :', data);
  }
});

  // Submit selection mutation
  const submitSelectionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/extra-images/submit-selection', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-gallery', ],});
      onSubmitSuccess();
      onClose();
  }
});

  // Contract update mutation - called after terms acceptance
  const updateContractMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/contracts/${data.contractd}/accept-extra-terms`, {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(data)
  });
  },
    onSuccess: (response) => {
      console.log('📋 Contract updated successfully, :', response);
      // Refresh contract data
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', ],});
      
      // Continue with normal submission
      submitSelectionMutation.mutate({
        galleryId,
        selectedImages,
        contractedImages,
        pricingOption: selectedOption,
        customQuantity,
        clientEmail,
        photographerId,
        clientNotes
    });
  }
});

  // Calculate pricing when option changes
  useEffect(() => {
    if (open && extraImages > 0) {
      calculatePricingMutation.mutate({
        galleryId,
        selectedImages,
        contractedImages,
        pricingOption: selectedOption,
        customQuantity: selectedOption === 'custom' ? customQuantity : undefined
  });
  }
}, [selectedOption, customQuantity, open]);

  const handleSubmit = () => {
    // Check if terms have been accepted first
    if (!hasAcceptedTerms) {
      setTermsAcceptanceOpen(true);
      return;
  }

    if (calculatePricingMutation.data) {
      // Update contract with extra images terms acceptance
      updateContractMutation.mutate({
        contractId: galleryd, // Using galleryId as contract reference
        extraImages: extraImages,
        extraImagePrice: calculatePricingMutation.data.pricePerImage || 10,
        totalExtraAmount: calculatePricingMutation.data.totalAmount,
        clientEmail,
        clientName: 'Demo Klient', // In production, get from gallery data
        acceptedTerms: true,
        acceptedGdpr: true
  });
  }
};

  const handleTermsAccepted = () => {
    setHasAcceptedTerms(true);
    setTermsAcceptanceOpen(false);
    // Continue with submission after terms acceptance
    handleSubmit();
};

  if (extraImages <= 0) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Ingen ekstra bilder</DialogTitle>
        <DialogContent>
          <Typography>
            Du har valgt {selectedImages.length} bilder, som er innenfor ditt kontrakterte antall på {contractedImages} bilder.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Lukk</Button>
        </DialogActions>
      </Dialog>
    );
}

  return (
    <>
      {/* Terms Acceptance Dialog */}
      <TermsAcceptanceDialog
        open={termsAcceptanceOpen}
        onClose={() => setTermsAcceptanceOpen(false)}
        onAccept={handleTermsAccepted}
        projectType="bryllup" // Default to bryllup, could be dynamic
        contractId={galleryId}
      />
    <Dialog 
      open={open}
      onClose={onClose}
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0f1410',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.12)'
      }
    }}
    >
      <DialogTitle sx={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
        {professionIcon && (
          <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
            {professionIcon}
          </Box>
        )}
        {enhancedProfessionConfig?.displayName || professionConfig?.displayName
          ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Prissetting for ekstra bilder`
          : 'Prissetting for ekstra bilder'}
      </DialogTitle>
      
      <DialogContent sx={{ bgcolor: '#0a0f1a'}}>
        <Box sx={{ mb:  3 }}>
          <Alert 
            severity="info"
            sx={{
              bgcolor: 'rgba(3, 150, 243, 0.1)',
              border: '1px solid rgba(3, 150, 243, 0.3)',
              color: '#fff',
              mb: 2 }}
          >
            Du har valgt {selectedImages.length} bilder. Kontrakten inkluderer {contractedImages} bilder.
            <br />
            <strong>Ekstra bilder: {extraImages}</strong>
          </Alert>
        </Box>

        {loadingOptions ? (
          <LinearProgress sx={{ mb:  2 }} />
        ) : (
          pricingOptions && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Velg prissetting: </Typography>
              
              <RadioGroup
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value)}
              >
                {/* Per image option */}
                <Card sx={{ mb: 2, bgcolor: '#1a2330', border: '1px solid rgba(255,255,255,0.12)', ...theming.getThemedCardSx() }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <FormControlLabel
                      value="per_image"
                      control={<Radio sx={{ color: '#ffa726' }} />}
                      label={
                        <Box>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            Per bilde
                          </Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.72)' }}>
                            {pricingOptions.perImage.price} NOK per bilde
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#ffa726'}}>
                            Total: {extraImages * pricingOptions.perImage.price} NOK
                          </Typography>
                        </Box>
                    }
                    />
                  </CardContent>
                </Card>

                {/* Package options */}
                {pricingOptions.packages.map((pkg: PricingOption) => (
                  <Card key={pkg.d} sx={{ mb: 2, bgcolor: '#1a2330', border: '1px solid rgba(255,255,255,0.12)', ...theming.getThemedCardSx() }}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <FormControlLabel
                        value={pkg.id}
                        control={<Radio sx={{ color: '#ffa726' }} />}
                        label={
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                                {pkg.description}
                              </Typography>
                              {pkg.savings && pkg.savings > 0 && (
                                <Chip 
                                  label={`Spar ${pkg.savings} NOK`}
                                  size="small" 
                                  sx={{ bgcolor: '#4caf50', color: '#fff'}}
                                />
                              )}
                            </Box>
                            <Typography sx={{ color: 'rgba(255,255,255,0.72)' }}>
                              {pkg.price} NOK ({pkg.pricePerImage} NOK per bilde)
                            </Typography>
                            {extraImages > (pkg.quantity || 0) && (
                              <Typography variant="body2" sx={{ color: '#ff9800'}}>
                                + {extraImages - (pkg.quantity || 0)} ekstra bilder à {pricingOptions.perImage.price} NOK
                              </Typography>
                            )}
                          </Box>
                      }
                      />
                    </CardContent>
                  </Card>
                ))}

                {/* Custom option */}
                {pricingOptions.customAllowed && (
                  <Card sx={{ mb: 2, bgcolor: '#1a2330', border: '1px solid rgba(255,255,255,0.12)', ...theming.getThemedCardSx() }}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <FormControlLabel
                        value="custom"
                        control={<Radio sx={{ color: '#ffa726' }} />}
                        label={
                          <Box>
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                              Tilpasset antall
                            </Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.72)', mb:  1 }}>
                              Velg ønsket antall bilder
                            </Typography>
                            {selectedOption === 'custom' && (
                              <TextField
                                type="number"
                                value={customQuantity}
                                onChange={(e) => setCustomQuantity(Number(e.target.value))}
                                label="Antall bilder"
                                size="small"
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    color: '#fff','& fieldset': { borderColor: 'rgba(255,255,255,0.22)' }
                                  }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' }
                              }}
                              />
                            )}
                          </Box>
                      }
                      />
                    </CardContent>
                  </Card>
                )}
              </RadioGroup>

              {/* Pricing calculation display */}
              {calculatePricingMutation.data && (
                <Card sx={{ mt: 3, bgcolor: '#0d1420', border: '1px solid #ffa726', ...theming.getThemedCardSx() }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Sammendrag
                    </Typography>
                    <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.12)' }} />
                    
                    <Box sx={{ mb:  2 }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.82)' }}>
                        Inkluderte bilder: {contractedImages}
                      </Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.82)' }}>
                        Ekstra bilder: {calculatePricingMutation.data.extraImages}
                      </Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.9rem'}}>
                        {calculatePricingMutation.data.pricingBreakdown.pricing}
                      </Typography>
                      <Typography variant="h6" sx={{ mt: 1, color: theming.colors.primary }}>
                        Total: {calculatePricingMutation.data.totalCost} NOK
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.64)', mt:  1 }}>
                        {calculatePricingMutation.data.pricingBreakdown.paymentTerms}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Client notes */}
              <TextField
                fullWidth
                multiline
                rows={3}
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                label="Tilleggskommentarer (valgfritt)"
                placeholder="Eventuelle spesielle ønsker eller kommentarer..."
                sx={{
                  mt: 2,
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' }
                  }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' }
              }}
              />
            </Box>
          )
        )}
      </DialogContent>

      <DialogActions sx={{ bgcolor: '#0f1419'}}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.72)' }}>
          Avbryt
        </Button>
        <Button onClick={handleSubmit}
          variant="contained"
          disabled={submitSelectionMutation.isPending || !calculatePricingMutation.data}
          sx={{ bgcolor: '#ffa720', color: '#000', ...theming.getThemedButtonSx() }}>
          {submitSelectionMutation.isPending ? 'Sender...' : 'Send til fotograf'}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
