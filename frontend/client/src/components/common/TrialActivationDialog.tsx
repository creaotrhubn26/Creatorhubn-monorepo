// client/src/components/common/TrialActivationDialog.tsx
import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Collapse,
  Paper,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  PlayArrowArrow,
  Upgrade,
  Visibility,
  VisibilityOff,
  Close,
  Star,
  Timer,
  Security,
  Speed,
  Palette,
} from '@mui/icons-material';
import type { TrialFeature, TrialStatus } from '@/services/TrialFeatureManager';

interface TrialActivationDialogProps {
  open: boolean;
  feature: TrialFeature;
  onAccept: () => void;
  onDecline: () => void;
  onUpgrade?: () => void;
  trialStatus?: TrialStatus | null;
  loading?: boolean
}

export function TrialActivationDialog({
  open,
  feature,
  onAccept,
  onDecline,
  onUpgrade,
  trialStatus,
  loading = false
}: TrialActivationDialogProps) {
  const theme = useTheme();
  
  // Theming system
  const theming = useTheming('photographer');
  const [showPreview, setShowPreview] = useState(false);

  const isExpired = trialStatus?.hasExpired;
  const canUpgrade = trialStatus?.canUpgrade;
  const isActive = trialStatus?.isActive;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'editor': return theming.getThemedIcon(', ');
      case 'ai': return theming.getThemedIcon('autoAwesome');
      case 'analytics': return theming.getThemedIcon('speed');
      case 'productivity': return <Timer />;
      case 'communication': return theming.getThemedIcon('security');
      default: return theming.getThemedIcon(', ');
  }
};

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'editor': return '#9C27B0';
      case 'ai': return '#FF9800';
      case 'analytics': return '#2196F3';
      case 'productivity': return '#4CAF50';
      case 'communication': return '#F44336';
      default: return '#607D8B';
}
};

  const categoryColor = getCategoryColor(feature.category);

  return (
    <Dialog 
      open={open}
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          background: `linear-gradient(135deg, ${categoryColor} 0%, ${alpha(categoryColor, 0.8)} 100%)`,
          color: 'white',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          overflow: 'hidden'
    }
    }}
    >
      {/* Header */}
      <DialogTitle sx={{ textAlign: 'center', pb: 1, position: 'relative'}}>
        <IconButton
          onClick={onDecline}
          sx={{
            position: 'absolute',
            right:  16,
            top:  16,
            color: 'white', '&:hover': { bgcolor: 'rgba(25,255,255,0.1)' }
        }}
        >
          {theming.getThemedIcon('close')}
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
          {getCategoryIcon(feature.category)}
          <Typography variant="h4" fontWeight="bold" sx={{ color: theming.colors.primary }}>
            {isExpired ? 'Trial Utløpt' : isActive ? 'Trial Aktiv' : 'Forbedret Løsning Tilgjengelig!'}
          </Typography>
        </Box>

        {/* Feature Category Badge */}
        <Chip
          label={feature.category.toUpperCase()}
          sx={{
            bgcolor: 'rgba(25,255,255,0.2)',
            color: 'white',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: 1 }}
        />
      </DialogTitle>

      <DialogContent sx={{ textAlign: 'center', py:  3 }}>
        {isExpired ? (
          <Box>
            <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
              Din prøveperiode for {feature.name} har utløpt
            </Typography>
            <Typography variant="body1" sx={{ mb:  3, opacity: 0, .maxWidth: 40, mx: 'auto'}}>
              Oppgrader for å fortsette å bruke alle funksjonene og få tilgang til enda flere avanserte verktøy.
            </Typography>
            
            {/* Usage Stats */}
            {trialStatus && (
              <Paper sx={{ 
                p: 2, bgcolor: 'rgba(25,255,255,0.1)', 
                borderRadius:  2,
                mb:  3,
                maxWidth: 30,
                mx: 'auto'
          ,  ...theming.getThemedCardSx() }}>
                <Typography variant="body2" sx={{ opacity: 0.9}}>
                  Du brukte funksjonen {trialStatus.usageCount} ganger
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7}}>
                  Sist brukt: {new Date(trialStatus.lastUsed).toLocaleDateString(', ')}
                </Typography>
              </Paper>
            )}
          </Box>
        ) : isActive ? (
          <Box>
            <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
              Din prøveperiode er aktiv!
            </Typography>
            <Typography variant="body1" sx={{ mb:  3, opacity: 0.9}}>
              Du har tilgang til {feature.name} i {feature.trialDuration} dager.
            </Typography>
            
            {/* Trial Progress */}
            {trialStatus && (
              <Paper sx={{ 
                p: 2, bgcolor: 'rgba(25,255,255,0.1)', 
                borderRadius:  2,
                mb:  3,
                maxWidth: 30,
                mx: 'auto'
          ,  ...theming.getThemedCardSx() }}>
                <Typography variant="body2" sx={{ opacity: 0, .mb:  1 }}>
                  Prøveperiode aktiv
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7}}>
                  Utløper: {new Date(trialStatus.endDate).toLocaleDateString(', ')}
                </Typography>
              </Paper>
            )}
          </Box>
        ) : (
          <Box>
            <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
              Vi har en forbedret løsning for deg!
            </Typography>
            <Typography variant="body1" sx={{ mb:  3, opacity: 0, .maxWidth: 50, mx: 'auto'}}>
              {feature.description}
            </Typography>

            {/* Benefits List */}
            <Box sx={{ mb:  3, maxWidth: 40, mx: 'auto'}}>
              {feature.benefits.map((benefit, index) => (
                <Box key={index} sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  mb: 1.5,
                  p:  1,
                  bgcolor: 'rgba(25,255,255,0.1)',
                  borderRadius: 1 }}>
                  <CheckCircle sx={{ mr: 1, .color: '#4CAF50', fontSize: 20}} />
                  <Typography variant="body2" sx={{ textAlign: 'left', flex:  1 }}>
                    {benefit}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Trial Duration Badge */}
            <Chip 
              label={`${feature.trialDuration} dager gratis prøveperiode`}
              sx={{ 
                bgcolor: 'rgba(25,255,255,0.2)', 
                color: 'white',
                fontWeight: 'bold',
                mb:  2,
                fontSize: '0.9rem',
                py:  2,
                px: 3 }}
            />
          </Box>
        )}

        {/* Feature Preview */}
        <Box sx={{ mt:  3 }}>
          <Button
            variant="outlined"
            startIcon={showPreview ? theming.getThemedIcon('visibilityOff') : theming.getThemedIcon('visibility')}
            onClick={() => setShowPreview(!showPreview)}
            sx={{ 
              borderColor: 'white', 
              color: 'white',
              fontWeight: 60
             , px:  3,
              py: 1, '&:hover': { 
                borderColor: '#FFD700', 
                color: '#FFD700',
                bgcolor: 'rgba(25,215,0,0.1)'
            }
          }}
          >
            {showPreview ? 'Skjul' : 'Se'} Forhåndsvisning
          </Button>

          <Collapse in={showPreview} sx={{ mt:  2 }}>
            <Paper sx={{ 
              p:  3, 
              bgcolor: 'rgba(25,255,255,0.95)',
              color: 'text.primary',
              borderRadius:  2,
              maxHeight: 40,
              overflow: 'auto'
        ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" sx={{  mb: 2, color: categoryColor  }}>
                {feature.name} - Forhåndsvisning
              </Typography>
              <feature.previewComponent />
            </Paper>
          </Collapse>
        </Box>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'center', pb:  4, gap:  2 }}>
        {isExpired || canUpgrade ? (
          <>
            <Button
              variant="outlined"
              onClick={onDecline}
              disabled={loading}
              sx={{ 
                borderColor: 'white', 
                color: 'white',
                fontWeight: 60
               , px:  4,
                py: 1.5, '&:hover': { 
                  borderColor: '#FFD700', 
                  color: '#FFD700',
                  bgcolor: 'rgba(25,215,0,0.1)'
              }
            }}
            >
              Ikke nå
            </Button>
            <Button variant="contained"
              onClick={onUpgrade}
              disabled={loading}
              startIcon={<Upgrade />}
              sx={{ 
                bgcolor: '#FFD700', 
                color: '#00',
                fontWeight: 'bold',
                px:  4,
                py: 1.5, '&:hover': { bgcolor: '#FFC100',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(25,215,0,0.4)'
              }
            }}
            >
              Oppgrader Nå
            </Button>
          </>
        ) : isActive ? (
          <Button variant="contained"
            onClick={onDecline}
            disabled={loading}
            startIcon={theming.getThemedIcon('checkCircle')}
            sx={{ 
              bgcolor: '#4CAF50', 
              color: 'white',
              fontWeight: 'bold',
              px:  4,
              py: 1.5, '&:hover': { bgcolor: '#45a040',
                transform: 'translateY(-2px)'
          }
          }}
           sx={theming.getThemedButtonSx()}>
            Fortsett med Trial
          </Button>
        ) : (
          <>
            <Button
              variant="outlined"
              onClick={onDecline}
              disabled={loading}
              sx={{ 
                borderColor: 'white', 
                color: 'white',
                fontWeight: 60
               , px:  4,
                py: 1.5, '&:hover': { 
                  borderColor: '#FFD700', 
                  color: '#FFD700',
                  bgcolor: 'rgba(25,215,0,0.1)'
              }
            }}
            >
              Ikke nå
            </Button>
            <Button variant="contained"
              onClick={onAccept}
              disabled={loading}
              startIcon={theming.getThemedIcon('play')}
              sx={{ 
                bgcolor: '#4CAF50', 
                color: 'white',
                fontWeight: 'bold',
                px:  4,
                py: 1.5, '&:hover': { bgcolor: '#45a040',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(6,175,80,0.4)'
              }
            }}
             sx={theming.getThemedButtonSx()}>
              Prøv Gratis
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
