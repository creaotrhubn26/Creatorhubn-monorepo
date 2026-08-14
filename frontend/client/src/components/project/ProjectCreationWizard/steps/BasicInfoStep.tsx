// @ts-nocheck
import React from "react";
// BasicInfoStep - First step of project creation wizard
import { Box, TextField, Typography, Grid, FormControl, InputLabel, Select, MenuItem, Stack, Button, Card, CardContent, Alert } from '@mui/material';
import { Person, CalendarToday, LocationOn, AttachMoney, AccessTime } from '@mui/icons-material';
import { useProjectData } from '../../hooks/useProjectData';
import { PROJECT_TYPES } from '../../constants/project';

interface BasicInfoStepProps {
  projectData: any;
  updateProjectData: (updates: Partial<any>) => void;
  onNext: () => void;
  canProceed: boolean;
  projectTypeDetails?: any;
}

export function BasicInfoStep({ projectData, updateProjectData, onNext, canProceed, projectTypeDetails }: {
  projectData: any;
  updateProjectData: (updates: Partial<any>) => void;
  onNext: () => void;
  canProceed: boolean;
  projectTypeDetails?: any;
}) {
  const handleChange = (field: string, value: any) => {
    // Handle nested fields like eventDates
    if (field.includes('.')) {
      // Handle nested
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
        Grunnleggende prosjektinfo
      </Typography>

      <Grid container spacing={3}>
        {/* Project Name */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Prosjektnavn *"
            value={projectData.projectName}
            onChange={(e) => updateProjectData({ projectName: e.target.value })}
            required
            size="small"
            placeholder="F.eks. Bryllup Hansen & Olsen"
            sx={{ '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.95)' } }}
          />
        </Grid>

        {/* Client Name */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Kundenavn *"
            value={projectData.clientName}
            onChange={(e) => updateProjectData({ clientName: e.target.value }))
            required
            size="small"
            placeholder="F.eks. Anna & Lars"
            sx={{ '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.95)' } }}
          />
        </Grid>

        {/* Client Email */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="E-post"
            type="email"
            value={projectData.clientEmail}
            onChange={(e) => updateProjectData({ clientEmail: e.target.value })}
            size="small"
            placeholder="kunde@epost.no"
            sx={{ '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.95)' } }}
          />
        </Grid>

        {/* Client Phone */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Telefon"
            value={projectData.clientPhone}
            onChange={(e) => updateProjectData({ clientPhone: e.target.value }))
            size="small"
            placeholder="+47 9XX XX XXX"
            sx={{ '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.95)' } }}
          />
        </Grid>

        {/* Event Date */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Hoveddato *"
            type="date"
            value={projectData.eventDate}
            onChange={(e) => updateProjectData({ eventDate: e.target.value })}
            required
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.95)' },
              '& input': { color: 'rgba(255,255,255,0.95)' },
            }}
          />
        </Grid>

        {/* Location */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Lokasjon"
            value={projectData.location}
            onChange={(e) => updateProjectData({ location: e.target.value }))
            size="small"
            placeholder="F.eks. Oslo, Norge"
            sx={{ '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.95)' } }}
          />
        </Grid>

        {/* Guest Count */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Antall gjester"
            type="number"
            value={projectData.guestCount}
            onChange={(e) => updateProjectData({ guestCount: e.target.value })}
            type="number"
            size="small"
            placeholder="F.eks. 120"
          />
        </Grid>

        {/* Budget */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Budsjett (NOK)"
            type="number"
            value={projectData.budget}
            onChange={(e) => updateProjectData({ budget: e.target.value }))
            type="number"
            size="small"
            placeholder="F.eks. 50000"
          />
        </Grid>

        {/* Description */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Beskrivelse / Notater"
            value={projectData.description}
            onChange={(e) => updateProjectData({ description: e.target.value })}
            placeholder="Beskriv prosjektet, spesielle ønsker, kulturelle hensyn..."
            placeholder="Beskriv prosjektet, spesielle ønsker, kulturelle hensyn..."
          />
        </Grid>

        {/* Project Type Details Preview */}
        {projectTypeDetails && (
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
              <strong>Prosjekttype-detaljer:</strong>
              <div sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <span><strong>Tidsestimat:</strong> {projectTypeDetails.timeEstimate} timer</span>
                <span><strong>Estimert pris:</strong> {projectTypeDetails.pricing} NOK</span>
                <span><strong>PIN:</strong> {projectTypeDetails.pin}</span>
              </div>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                {projectTypeDetails.description}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                Neste steg: {projectTypeDetails.nextSteps}
              </Typography>
            </Alert>
          </Grid>
        )}

        {/* Continue Button */}
        <Grid item xs={12} sx={{ mt: 3 }}>
          <button
            onClick={onNext}
            disabled={!canProceed}
            style={{
              width: '100%',
              padding: '16px 32px',
              fontSize: '1.1rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: canProceed ? 'pointer' : 'not-allowed',
              opacity: canProceed ? 1 : 0.6,
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = canProceed ? 'translateY(-2px)' : 'none'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
          >
            Fortsett til prosjekttype →
          </button>
        </Grid>
      </div>
    </div>
  );
}

export default function BasicInfoStepWrapper(props: any) {
  const { projectData, updateProjectData, projectTypeDetails } = useProjectData({});
  // This would need proper integration
  return <BasicInfoStep {...props} projectTypeDetails={projectTypeDetails} />;
}