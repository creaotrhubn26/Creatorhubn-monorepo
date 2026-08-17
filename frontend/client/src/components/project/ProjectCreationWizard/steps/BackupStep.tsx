// @ts-nocheck
import React from "react";
// BackupStep - Backup strategy configuration
import { Box, Typography, Button, Alert } from '@mui/material';
import { CloudDone } from '@mui/icons-material';

interface BackupStepProps {
  projectData: any;
  updateProjectData: (updates: Partial<any>) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}

export function BackupStep({ projectData, updateProjectData, onNext, onBack, canProceed }: {
  projectData: any;
  updateProjectData: (updates: Partial<any>) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}) {
  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Backup-strategi
      </Typography>

      <div style={{ padding: 24, background: 'rgba(76,175,80,0.08)', borderRadius: 8, border: '1px solid rgba(76,175,80,0.2)', mb: 3 }}>
        <Typography variant="h6" gutterBottom>Backup-strategi: Creatorhub One</Typography>
        <p>Creatorhub One er desktop-appen som tar offsite-backup direkte fra minnekortene under opptaket.</p>
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

export default BackupStep;