// @ts-nocheck
import React from "react";
// ProjectTypeStep - Select project type step
import { Box, Grid, FormControl, InputLabel, Select, MenuItem, Typography, Button, Alert } from '@mui/material';
import { Assignment } from '@mui/icons-material';
import { PROJECT_TYPES, getDefaultProjectType } from '../../constants/project';

interface ProjectTypeStepProps {
  projectData: any;
  updateProjectData: (updates: Partial<any>) => void;
  dynamicProjectTypes: any[];
  trackUsage: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}

export function ProjectTypeStep({ projectData, updateProjectData, dynamicProjectTypes, trackUsage, onNext, onBack, canProceed }: {
  projectData: any;
  updateProjectData: (updates: Partial<any>) => void;
  dynamicProjectTypes: any[];
  trackUsage: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}) {
  const handleChange = (selectedTypeId: string) => {
    updateProjectData({
      projectType: selectedTypeId,
      weddingCulture: selectedTypeId === 'wedding' ? projectData.weddingCulture : 'norsk',
    });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Velg prosjekttype
      </Typography>

      <div sx={{ mb: 3 }}>
        <label style={{ display: 'block', fontWeight: 600, color: 'rgba(255,255,255,0.95)', mb: 1 }}>
          Velg prosjekttype
        </label>
        <select
          value={projectData.projectType || ''}
          onChange={(e) => updateProjectData({ projectType: e.target.value })}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '1rem',
            background: 'rgba(20,22,30,0.92)',
            border: '1.5px solid #1565c0',
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.95)',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          <option value="">Velg prosjekttype</option>
          {Object.entries(PROJECT_TYPES).map(([key, type]) => (
            <option key={key} value={key}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 16, padding: 16, background: 'rgba(21,101,192,0.08)', borderRadius: 8, border: '1px solid rgba(21,101,192,0.2)' }}>
        <strong>Tips:</strong> Velg prosjekttype som best matcher ditt oppdrag. For bryllup får du tilgang til kulturelle tradisjoner, shot list-malere og minnekortplanlegging.
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={onBack}
          style={{
            padding: '12px 24px',
            border: '1.5px solid rgba(255,255,255,0.3)',
            background: 'transparent',
            color: 'rgba(255,255,255,0.95)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          ← Tilbake
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          style={{
            padding: '16px 32px',
            fontSize: '1.1rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: canProceed ? 'pointer' : 'not-allowed',
            opacity: canProceed ? 1 : 0.6,
          }}
        >
          Fortsett →
        </button>
      </div>
    </div>
  );
}

export default ProjectTypeStep;