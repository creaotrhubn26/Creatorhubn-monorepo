// @ts-nocheck
import React from "react";
// ConfirmStep - Final confirmation step
import { Box, Typography, Button, Alert, Stack, Grid } from '@mui/material';
import { CheckCircle, Warning, Folder, CloudUpload } from '@mui/icons-material';

interface ConfirmStepProps {
  projectData: any;
  projectTypeDetails: any;
  generatePin: (name: string) => string;
  onCreate: () => void;
  onBack: () => void;
  isCreating: boolean;
}

export function ConfirmStep({ projectData, projectTypeDetails, generatePin, onCreate, onBack, isCreating }: {
  projectData: any;
  projectTypeDetails: any;
  generatePin: (name: string) => string;
  onCreate: () => void;
  onBack: () => void;
  isCreating: boolean;
}) {
  const validationErrors = [];
  if (!projectData.projectName) validationErrors.push('Prosjektnavn mangler');
  if (!projectData.clientName) validationErrors.push('Kundenavn mangler');
  if (!projectData.projectType) validationErrors.push('Prosjekktype mangler');
  if (!projectData.eventDate) validationErrors.push('Hoveddato mangler');
  if (!projectData.clientEmail) validationErrors.push('Klient e-post mangler');

  const canCreate = validationErrors.length === 0;

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Bekreft og opprett
      </Typography>

      {validationErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <strong>Mangler påkrevde felt:</strong>
          <ul style={{ mt: 1, paddingLeft: 20 }}>
            {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </Alert>
      )}

      <div style={{ padding: 24, background: 'rgba(76,175,80,0.08)', borderRadius: 8, border: '1px solid rgba(76,175,80,0.2)', mb: 3 }}>
        <Typography variant="h6" gutterBottom>Alt ser bra ut!</Typography>
        <Typography variant="body2" color="text.secondary">
          Alt nødvendig er fylt ut. Trykk på "Opprett Prosjekt" for å fortsette.
        </Typography>
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ padding: '12px 24px', border: '1.5px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'rgba(255,255,255,0.95)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          ← Tilbake
        </button>
        <button onClick={onCreate} disabled={!canCreate || isCreating} style={{ padding: '16px 32px', fontSize: '1.1rem', fontWeight: 700, background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: canProceed ? 'pointer' : 'not-allowed', opacity: canProceed ? 1 : 0.6 }}>
          {isCreating ? 'Oppretter...' : 'Opprett Prosjekt'}
        </button>
      </div>
    </Box>
  );
}

export default ConfirmStep;