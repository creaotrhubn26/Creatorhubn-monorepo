import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { CheckCircle as CheckCircleIcon, Close as CloseIcon } from '@mui/icons-material';
import type { Consent, ConsentSignatureData, ConsentType } from '../../models/casting';

interface ConsentSignatureDialogProps {
  open: boolean;
  consent: Consent | null;
  candidateName: string;
  projectName: string;
  onSign: (signatureData: ConsentSignatureData) => void;
  onClose: () => void;
}

const getConsentTypeLabel = (type: ConsentType): string => {
  const labels: Record<ConsentType, string> = {
    photo_release: 'Foto-samtykke',
    video_release: 'Video-samtykke',
    audio_release: 'Lyd-samtykke',
    location_release: 'Lokasjon-samtykke',
    minor_consent: 'Mindreårig-samtykke',
    other: 'Annet samtykke',
  };
  return labels[type] || type;
};

const getConsentDescription = (type: ConsentType): string => {
  const descriptions: Record<ConsentType, string> = {
    photo_release: 'Jeg gir herved tillatelse til å bruke fotografier av meg i forbindelse med dette prosjektet for markedsføring, publisering og andre kommersielle formål.',
    video_release: 'Jeg gir herved tillatelse til å bruke videoopptak av meg i forbindelse med dette prosjektet for kringkasting, streaming og andre kommersielle formål.',
    audio_release: 'Jeg gir herved tillatelse til å bruke lydopptak av meg i forbindelse med dette prosjektet for publisering, streaming og andre kommersielle formål.',
    location_release: 'Jeg gir herved tillatelse til å filme/fotografere på min eiendom i forbindelse med dette prosjektet.',
    minor_consent: 'Som foresatt/verge gir jeg herved tillatelse til at den mindreårige kan delta i dette prosjektet under de angitte vilkårene.',
    other: 'Jeg bekrefter herved samtykke til de angitte vilkårene i dette dokumentet.',
  };
  return descriptions[type] || '';
};

export default function ConsentSignatureDialog({
  open,
  consent,
  candidateName,
  projectName,
  onSign,
  onClose,
}: ConsentSignatureDialogProps) {
  const [signature, setSignature] = useState('');
  const [signedByName, setSignedByName] = useState(candidateName || '');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleSign = () => {
    if (!signature.trim() || !signedByName.trim() || !acceptedTerms) {
      return;
    }

    const signatureData: ConsentSignatureData = {
      signature: signature.trim(),
      signed_by: signedByName.trim(),
      signed_at: new Date().toISOString(),
      user_agent: navigator.userAgent,
    };

    onSign(signatureData);
    setSignature('');
    setSignedByName(candidateName || '');
    setAcceptedTerms(false);
  };

  if (!consent) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1c2128',
          color: '#fff',
          border: '1px solid rgba(156, 39, 176, 0.3)',
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        Signer {consent.title || getConsentTypeLabel(consent.type)}
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Prosjekt:
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#ce93d8' }}>
            {projectName}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Samtykketype:
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {getConsentTypeLabel(consent.type)}
          </Typography>
        </Box>

        <Alert 
          severity="info" 
          sx={{ 
            mb: 3, 
            bgcolor: 'rgba(156, 39, 176, 0.1)', 
            color: '#ce93d8',
            '& .MuiAlert-icon': { color: '#ce93d8' },
          }}
        >
          {consent.description || getConsentDescription(consent.type)}
        </Alert>

        <TextField
          label="Fullt navn"
          value={signedByName}
          onChange={(e) => setSignedByName(e.target.value)}
          fullWidth
          required
          sx={{ 
            mb: 2,
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: '#ce93d8' },
              '&.Mui-focused fieldset': { borderColor: '#9c27b0' },
            },
            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
          }}
        />

        <TextField
          label="Signatur (skriv ditt navn eller initialer)"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          fullWidth
          required
          multiline
          rows={3}
          placeholder="Skriv din signatur her..."
          helperText="Dette vil bli lagret som din digitale signatur"
          sx={{ 
            mb: 2,
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              fontFamily: '"Brush Script MT", cursive',
              fontSize: '1.5rem',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: '#ce93d8' },
              '&.Mui-focused fieldset': { borderColor: '#9c27b0' },
            },
            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
            '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.87)' },
          }}
        />

        <FormControlLabel
          control={
            <Checkbox 
              checked={acceptedTerms} 
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              sx={{ 
                color: '#ce93d8',
                '&.Mui-checked': { color: '#9c27b0' },
              }}
            />
          }
          label={
            <Typography variant="body2" color="text.secondary">
              Jeg har lest og forstått vilkårene, og samtykker til bruken som beskrevet ovenfor.
            </Typography>
          }
          sx={{ mb: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
        <Button 
          onClick={onClose} 
          startIcon={<CloseIcon />}
          sx={{ color: 'rgba(255,255,255,0.87)' }}
        >
          Avbryt
        </Button>
        <Button
          variant="contained"
          onClick={handleSign}
          disabled={!signature.trim() || !signedByName.trim() || !acceptedTerms}
          startIcon={<CheckCircleIcon />}
          sx={{ 
            bgcolor: '#9c27b0',
            '&:hover': { bgcolor: '#7b1fa2' },
            '&.Mui-disabled': { bgcolor: 'rgba(156, 39, 176, 0.3)' },
          }}
        >
          Signer samtykke
        </Button>
      </DialogActions>
    </Dialog>
  );
}
