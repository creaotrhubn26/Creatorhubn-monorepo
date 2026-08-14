// @ts-nocheck
import React from "react";
// MemoryCardStep - Memory card configuration step
import { Box, Typography, Button, Alert } from '@mui/material';
import { MemoryCardIcon } from '@mui/icons-material';

interface MemoryCardStepProps {
  projectData: any;
  updateProjectData: (updates: Partial<any>) => void;
  selectedMemoryCards: any[];
  enhancedMemoryCardSelection: any;
  memoryCardRecommendation: any;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}

export function MemoryCardStep({ projectData, updateProjectData, selectedMemoryCards, enhancedMemoryCardSelection, memoryCardRecommendation, onNext, onBack, canProceed }: {
  projectData: any;
  updateProjectData: (updates: Partial<any>) => void;
  selectedMemoryCards: any[];
  enhancedMemoryCardSelection: any;
  memoryCardRecommendation: any;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}) {
  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Minnekort-konfigurasjon
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Konfigurer minnekort for prosjektet. Anbefalinger baseres på valgt utstyr og prosjekttype.
      </Alert>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ padding: '12px 24px', border: '1.5px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'rgba(255,255,255,0.95)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          ← Tilbake
        </button>
        <button onClick={onNext} disabled={!canProceed} style={{ padding: '16px 32px', fontSize: '1.1rem', fontWeight: 700, background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: canProceed ? 'pointer' : 'not-allowed', opacity: canProceed ? 1 : 0.6 }}>
          Fortsett →
        </button>
      </div>
    </div>
  );
}

export default MemoryCardStep;