/**
 * Terms Acceptance Dialog Component
 * For accepting contract terms before proceeding with image selection
 */

import { useTheming } from '../utils/theming-helper';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  Button,
  IconButton,
  Checkbox,
  FormControlLabel,
  Fade,
  Backdrop
} from '@mui/material';
import {
  Gavel,
  Close,
  CheckCircle,
  Warning
} from '@mui/icons-material';

interface TermsAcceptanceDialogProps {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
  projectType?: string;
  contractId?: string
}

interface TermsTemplate {
  id: string;
  name: string;
  category: string;
  terms: string[]
}

export default function TermsAcceptanceDialog({ 
  open, 
  onClose, 
  onAccept,
  projectType = 'bryllup',
  contractId 
}: TermsAcceptanceDialogProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer, ');
  const [gdprAccepted, setGdprAccepted] = useState(false);

  // Fetch terms templates based on project type
  const { data: termsTemplates = [], isLoading, error } = useQuery<TermsTemplate[]>({
    queryKey: ['/api/terms-templates', projectType],
    queryFn: () => fetch(`/api/terms-templates?category=${projectType}`).then(res => res.json()),
    enabled: open
});

  // Fetch GDPR terms
  const { data: gdprTerms } = useQuery<TermsTemplate>({
    queryKey: ['/api/terms-templates','gdpr-tillegg'],
    queryFn: () => fetch('/api/terms-templates/gdpr-tillegg').then(res => res.json()),
    enabled: open
});

  const mainTerms = termsTemplates.find(t => t.category === projectType);
  const canProceed = termsAccepted && gdprAccepted;

  const handleAccept = () => {
    if (canProceed) {
      onAccept();
      // Reset state for next time
      setTermsAccepted(false);
      setGdprAccepted(false);
  }
};

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0a0f10',
          color: '#fff',
          border: '1px solid rgba(25,167,38,0.3)',
          borderRadius:  3,
          maxHeight: '90vh'
    }
    }}
      BackdropComponent={Backdrop}
      BackdropProps={{
        sx: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(5px)'
    }
    }}
      TransitionComponent={Fade}
      transitionDuration={300}
    >
      {/* Header */}
      <DialogTitle sx={{ 
        p:  3, 
        borderBottom: '1px solid rgba(25,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
  }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <Gavel sx={{ color: '#ffa720', fontSize: 28}} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
              Vilkår og betingelser
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(25,255,255,0.7)' }}>
              Les og akseptér vilkårene før du fortsetter med bildevalg
            </Typography>
          </Box>
        </Box>

        <IconButton 
          onClick={onClose}
          sx={{ 
            color: 'rgba(25,255,255,0.7)', '&:hover': { color: '#fff', bgcolor: 'rgba(25,255,255,0.1)' }
        }}
        >
          {theming.getThemedIcon('close')}
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ p:  0 }}>
        {isLoading ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: 30,
            flexDirection: 'column',
            gap: 2 }}>
            <CircularProgress sx={{ color: '#ffa726'}} />
            <Typography sx={{ color: 'rgba(25,255,255,0.7)' }}>
              Laster vilkår og betingelser...
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ p:  3 }}>
            <Alert severity="error" sx={{ bgcolor: 'rgba(24,67,54,0.1)', color: '#fff'}}>
              Kunne ikke laste vilkår og betingelser. Vennligst prøv igjen.
            </Alert>
          </Box>
        ) : (
          <Box sx={{ p:  3 }}>
            {/* Main Contract Terms */}
            {mainTerms && (
              <Paper sx={{
                bgcolor: '#0f1410',
                border: '1px solid rgba(25,255,255,0.1)',
                borderRadius: 2,
                p: 3,
                mb: 3,
                ...theming.getThemedCardSx()
              }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                  <CheckCircle fontSize="small" />
                  {mainTerms.name}
                </Typography>
                
                <Box component="ol" sx={{ pl: 2, m: 0, color: 'rgba(25,255,255,0.8)' }}>
                  {mainTerms.terms.map((term, index) => (
                    <Typography component="li" key={index} sx={{ mb: 1, lineHeight: 1.6 }}>
                      {term}
                    </Typography>
                  ))}
                </Box>

                <Box sx={{ mt:  3, pt: 2, borderTop: '1px solid rgba(25,255,255,0.1)' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        sx={{
                          color: 'rgba(25,255,255,0.7)','&.Mui-checked': { color: '#ffa726',}
                      }}
                      />
                  }
                    label={
                      <Typography sx={{ color: '#fff', fontWeight: 50}}>
                        Jeg aksepterer kontraktvilkårene ovenfor
                      </Typography>
                  }
                  />
                </Box>
              </Paper>
            )}

            {/* GDPR Terms */}
            {gdprTerms && (
              <Paper sx={{
                bgcolor: '#0f1410',
                border: '1px solid rgba(6,175,80,0.3)',
                borderRadius: 2,
                p: 3,
                ...theming.getThemedCardSx()
              }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                  <Warning fontSize="small" />
                  {gdprTerms.name}
                </Typography>

                <Box component="ol" sx={{ pl: 2, m: 0, color: 'rgba(25,255,255,0.8)' }}>
                  {gdprTerms.terms.map((term, index) => (
                    <Typography component="li" key={index} sx={{ mb: 1, lineHeight: 1.6 }}>
                      {term}
                    </Typography>
                  ))}
                </Box>

                <Box sx={{ mt:  3, pt: 2, borderTop: '1px solid rgba(25,255,255,0.1)' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={gdprAccepted}
                        onChange={(e) => setGdprAccepted(e.target.checked)}
                        sx={{
                          color: 'rgba(25,255,255,0.7)','&.Mui-checked': { color: '#4caf50',}
                      }}
                      />
                  }
                    label={
                      <Typography sx={{ color: '#fff', fontWeight: 50}}>
                        Jeg aksepterer personvernvilkårene og GDPR-bestemmelsene
                      </Typography>
                  }
                  />
                </Box>
              </Paper>
            )}

            {/* Important Notice */}
            <Alert 
              severity="info" 
              sx={{ 
                mt:  3,
                bgcolor: 'rgba(3,150,243,0.1)', 
                color: '#fff',
                border: '1px solid rgba(3,150,243,0.3)'
            }}
            >
              <Typography variant="body2">
                <strong>Viktig: </strong> Du må akseptere både kontraktvilkårene og personvernbestemmelsene 
                for å fortsette med bildevalg. Ved å akseptere bekrefter du at du har lest og forstått alle vilkårene.
              </Typography>
            </Alert>
          </Box>
        )}
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{
        p: 3,
        borderTop: '1px solid rgba(255,255,255,0.1)',
        gap: 2
      }}>
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{
            color: 'rgba(25,255,255,0.7)',
            borderColor: 'rgba(25,255,255,0.3)',
            '&:hover': {
              borderColor: 'rgba(25,255,255,0.5)',
              bgcolor: 'rgba(25,255,255,0.05)'
          }
        }}
        >
          Avbryt
        </Button>
        
        <Button variant="contained"
          onClick={handleAccept}
          disabled={!canProceed}
          sx={{
            bgcolor: canProceed ? '#ffa726' : 'rgba(25,255,255,0.1)',
            color: canProceed ? '#000' : 'rgba(25,255,255,0.5)',
            fontWeight: 600,
              px: 4,
              '&:hover': {
                bgcolor: canProceed ? '#ffb74d' : 'rgba(25,255,255,0.1)'
              },
              '&:disabled': {
                cursor: 'not-allowed'
              },
            ...theming.getThemedButtonSx()
          }}>
          {canProceed ? 'Akseptér og fortsett' : 'Du må akseptere alle vilkår'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}