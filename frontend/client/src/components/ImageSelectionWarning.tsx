/**
 * Image Selection Warning Component
 * Psykologisk tilnærming for bildeutvalg - guidar kunden positivt
 */

import { useTheming } from '../utils/theming-helper';
import React from 'react';
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
  Alert,
  Divider,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  PhotoLibrary,
  Favorite,
  LocalOffer,
  TrendingUp,
  CheckCircle,
  Description,
} from '@mui/icons-material';

interface ImageSelectionWarningProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  contractedImages: number;
  onKeepAllImages: () => void;
  onSelectFewer: () => void;
  pricePerImage: number;
  packageDeals?: {
    package50: number;
    package100: number;
};
  contractId?: string;
  onViewContract?: () => void;
}

export default function ImageSelectionWarning({
  open,
  onClose,
  selectedCount,
  contractedImages,
  onKeepAllImages,
  onSelectFewer,
  pricePerImage,
  packageDeals,
  contractId,
  onViewContract
}: ImageSelectionWarningProps) {
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
  const extraImages = selectedCount - contractedImages;
  const extraCost = extraImages * pricePerImage;
  const package50Savings = packageDeals ? (50 * pricePerImage) - packageDeals.package50 : 0;
  const package100Savings = packageDeals ? (100 * pricePerImage) - packageDeals.package100 : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0f1410',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px'
        }
      }}
    >
      <DialogTitle sx={{ color: '#fff', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {professionIcon && (
            <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
              {professionIcon}
            </Box>
          )}
          <PhotoLibrary sx={{ color: '#ffa720', fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
            {enhancedProfessionConfig?.displayName || professionConfig?.displayName
              ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Alle dine vakre minner!`
              : 'Alle dine vakre minner!'}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ bgcolor: '#0a0f10', p: 3 }}>
        <Alert
          severity="info"
          icon={<Favorite sx={{ color: '#e91e63' }} />}
          sx={{ bgcolor: 'rgba(255, 167, 38, 0.1)', border: '1px solid rgba(255, 167, 38, 0.3)', color: '#fff', mb: 3, borderRadius: '8px' }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Du har valgt {selectedCount} fantastiske bilder!
              </Typography>
              <Typography>
                Kontrakten din inkluderer {contractedImages} bilder, så du har funnet {extraImages} ekstra minner 
                som du ønsker å ta vare på. Det viser hvor vellykket fotograferingen var! 📸
              </Typography>
            </Box>
            {contractId && onViewContract && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<Description />}
                onClick={onViewContract}
                sx={{
                  ml: 2,
                  color: '#ffa720',
                  borderColor: '#ffa720',
                  minWidth: '140px', '&:hover': {
                    borderColor: '#ffb740',
                    bgcolor: 'rgba(255, 167, 38, 0.1)'
                  }
                }}
              >
                Se kontrakt
              </Button>
            )}
          </Box>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, mb: 2 }}>
            Du har to gode valg:
          </Typography>

          {/* Valg 1: Velg færre */}
          <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <CheckCircle sx={{ color: theming.colors.primary }} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Velg færre bilder
                </Typography>
              </Box>
              <Typography variant="body2">
                Gå tilbake og velg de {contractedImages} bildene som betyr aller mest for deg. 
                Du kan alltid bestille flere senere hvis du angrer.
              </Typography>
            </CardContent>
          </Card>

          {/* Valg 2: Behold alle */}
          <Card sx={{ ...theming.getThemedCardSx() }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <CheckCircle sx={{ color: theming.colors.primary }} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Behold alle minnene dine
                </Typography>
                <Chip 
                  label="Anbefalt!" 
                  size="small" 
                  color="primary"
                />
              </Box>
              <Typography variant="body2">
                Behold alle {selectedCount} bildene. Ekstra kostnad: kr {extraCost.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

        <Typography variant="body2" sx={{ color: theming.colors.primary }}>
          💝 Husk: Dette er minner for livet. De fleste kunder velger å beholde alle bildene sine!
        </Typography>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button 
          onClick={onSelectFewer}
          variant="outlined"
          sx={theming.getThemedButtonSx()}
        >
          Velg færre bilder
        </Button>
        
        <Button
          onClick={onKeepAllImages}
          variant="contained"
          size="large"
          sx={theming.getThemedButtonSx()}
        >
          Ja, behold alle minnene! 💚
        </Button>
      </DialogActions>
    </Dialog>
  );
}
