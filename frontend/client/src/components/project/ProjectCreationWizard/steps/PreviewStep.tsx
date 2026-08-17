// @ts-nocheck
import React from "react";
// PreviewStep - Project preview
import { Box, Typography, Button, Alert, Stack, Grid } from '@mui/material';
import { Visibility, CalendarToday, LocationOn, AttachMoney, AccessTime, Camera, Image, Videocam, GraphicEq, Description, CloudDone, CheckCircle, Star, Business } from '@mui/icons-material';

interface PreviewStepProps {
  projectData: any;
  projectTypeDetails: any;
  getProfessionDisplayName: (prof: string) => string;
  getProfessionIcon: (prof: string) => any;
  generatePin: (name: string) => string;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}

export function PreviewStep({ projectData, projectTypeDetails, getProfessionDisplayName, getProfessionIcon, generatePin, onNext, onBack, canProceed }: {
  projectData: any;
  projectTypeDetails: any;
  getProfessionDisplayName: (prof: string) => string;
  getProfessionIcon: (prof: string) => any;
  generatePin: (name: string) => string;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}) {
  const detType = projectData.projectType || 'image';
  const meta = [
    ['Prosjektnavn', projectData.projectName || '(ikke satt)'],
    ['Prosjekttype', projectData.projectType],
    ['Klient', projectData.clientName || '(ikke satt)'],
    ['Dato', projectData.eventDate || '(ikke satt)'],
    ['Lokasjon', projectData.location || '(ikke satt)'],
    ['Yrke', 'Fotograf'],
    ['Dager', '1'],
    ['Hovedkamera', projectData.primaryCamera || '(ikke satt)'],
    ['Minnekort', '0 kort'],
    ['Utkast-status', 'draft'],
    ['PIN', generatePin(projectData.projectName)],
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Prosjekt-forhåndsvisning
      </Typography>

      <Stack spacing={1}>
        {meta.map(([k, v]) => (
          <Typography variant="body2" key={k}><strong>{k}:</strong> {v}</Typography>
        ))}
      </Stack>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ padding: '12px 24px', border: '1.5px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'rgba(255,255,255,0.95)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          ← Tilbake
        </button>
        <button onClick={onNext} disabled={!canProceed} style={{ padding: '16px 32px', fontSize: '1.1rem', fontWeight: 700, background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: canProceed ? 'pointer' : 'not-allowed', opacity: canProceed ? 1 : 0.6 }}>
          Opprett prosjekt →
        </button>
      </div>
    </Box>
  );
}

export default PreviewStep;