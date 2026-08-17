// @ts-nocheck
import React from "react";
// ShotListStep - Shot list management step
import { Box, Typography, Button, Alert } from '@mui/material';
import { CameraAlt } from '@mui/icons-material';

interface ShotListStepProps {
  projectData: any;
  updateProjectData: (updates: Partial<any>) => void;
  shotList: any[];
  onShotCreate: (shot: any) => void;
  onShotUpdate: (shot: any) => void;
  onShotDelete: (shotId: string) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}

export function ShotListStep({ projectData, updateProjectData, shotList, onShotCreate, onShotUpdate, onShotDelete, onNext, onBack, canProceed }: {
  projectData: any;
  updateProjectData: (updates: Partial<any>) => void;
  shotList: any[];
  onShotCreate: (shot: any) => void;
  onShotUpdate: (shot: any) => void;
  onShotDelete: (shotId: string) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}) {
  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Shot List & Opptaksplan
      </Typography>

      <div style={{ padding: 24, background: 'rgba(21,101,192,0.08)', borderRadius: 8, border: '1px solid rgba(21,101,192,0.2)', mb: 3 }}>
        <Typography variant="h6" gutterBottom>Shot List Manager</Typography>
        <p>Bruk Shot List Manager for å planlegge alle dine shots. Du kan legge til, redigere og slette shots.</p>
        <p style={{ marginTop: 12, color: 'text.secondary' }}>Nåværende shots: {shotList?.length || 0}</p>
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ padding: '12px 24px', border: '1.5px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'rgba(255,255,255,0.95)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          ← Tilbake
        </button>
        <button onClick={onNext} disabled={!canProceed} style={{ padding: '16px 32px', fontSize: '1.1rem', fontWeight: 700, background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: canProceed ? 'pointer' : 'not-allowed', opacity: canProceed ? 1 : 0.6 }}>
          Fortsett →
        </button>
      </div>
    </Box>
  );
}

export default ShotListStep;