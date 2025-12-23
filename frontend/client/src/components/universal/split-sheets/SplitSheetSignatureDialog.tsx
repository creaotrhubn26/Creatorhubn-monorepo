/**
 * Split Sheet Signature Dialog
 * Digital signature interface for contributors
 */

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
  Paper,
  Alert
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import type { SplitSheetContributor, SignatureData } from './types';

interface SplitSheetSignatureDialogProps {
  open: boolean;
  contributor: SplitSheetContributor | null;
  splitSheetTitle: string;
  onSign: (signatureData: SignatureData) => void;
  onClose: () => void;
}

export default function SplitSheetSignatureDialog({
  open,
  contributor,
  splitSheetTitle,
  onSign,
  onClose
}: SplitSheetSignatureDialogProps) {
  const [signature, setSignature] = useState('');
  const [signedByName, setSignedByName] = useState(contributor?.name || ', ');

  const handleSign = () => {
    if (!signature.trim() || !signedByName.trim()) {
      return;
    }

    const signatureData: SignatureData = {
      signature: signature.trim(),
      signed_by: signedByName.trim(),
      signed_at: new Date().toISOString(),
      ip_address: undefined, // Could be added if needed
      user_agent: navigator.userAgent
    };

    onSign(signatureData);
    setSignature(', ');
    setSignedByName(contributor?.name || '');
  };

  if (!contributor) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Signer Split Sheet
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Split Sheet:
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            {splitSheetTitle}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Bidragsyter:
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {contributor.name} - {contributor.percentage}%
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Ved å signere bekrefter du at du er enig med eierskapsfordelingen som er angitt i denne split sheet.
        </Alert>

        <TextField
          label="Navn (som det skal vises på signatur)"
          value={signedByName}
          onChange={(e) => setSignedByName(e.target.value)}
          fullWidth
          required
          sx={{ mb: 2 }}
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
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<CloseIcon />}>
          Avbryt
        </Button>
        <Button
          variant="contained"
          onClick={handleSign}
          disabled={!signature.trim() || !signedByName.trim()}
          startIcon={<CheckCircleIcon />}
          sx={{ bgcolor: '#9f7aea','&:hover': { bgcolor: '#8e6ed6' } }}
        >
          Signer
        </Button>
      </DialogActions>
    </Dialog>
  );
}























