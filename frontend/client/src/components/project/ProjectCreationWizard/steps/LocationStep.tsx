// @ts-nocheck
import React from "react";
// LocationStep - Location and event date step
import { Box, TextField, Typography, Button, Alert, Grid, Stack, Card, CardContent, Stack } from '@mui/material';
import { LocationOn, CalendarToday, DirectionsCar, Schedule } from '@mui/icons-material';

interface LocationStepProps {
  projectData: any;
  updateProjectData: (updates: Partial<any>) => void;
  locationSuggestions: any[];
  locationLoading: boolean;
  selectedLocation: any;
  locationLoading: boolean;
  handleLocationSearch: (query: string) => void;
  handleLocationSelect: (location: any) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}

export function LocationStep({ projectData, updateProjectData, locationSuggestions, locationLoading, selectedLocation, handleLocationSearch, handleLocationSelect, onNext, onBack, canProceed }: {
  projectData: any;
  updateProjectData: (updates: Partial<any>) => void;
  locationSuggestions: any[];
  locationLoading: boolean;
  selectedLocation: any;
  handleLocationSearch: (query: string) => void;
  handleLocationSelect: (location: any) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}) {
  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Lokasjon & Dato
      </Typography>

      <TextField
        fullWidth
        label="Søk lokasjon (Kartverket)"
        placeholder="Skriv adresse eller stedsnavn..."
        value={projectData.location || ''}
        onChange={(e) => handleLocationSearch(e.target.value)}
        sx={{ mb: 3 }}
      />

      {/* Location suggestions would appear here */}

      <div style={{ marginTop: 24 }}>
        <h4>Valgt lokasjon: {projectData.location || 'Ingen valgt'}</h4>
      </div>

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

export default LocationStep;