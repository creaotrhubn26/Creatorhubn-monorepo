/**
 * CreatorHub Norge - Project Creation Wizard
 * Integrert prosjektopprettelse med alle prosjekttyper
 */

import { useTheming } from '../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  Chip,
  FormHelperText,
  InputAdornment,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { nb } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';

interface ProjectCreationWizardProps {
  onComplete?: (project: any) => void;
  onCancel?: () => void
}

interface ProjectData {
  name: string;
  projectType: 'bryllup' | 'portrett' | 'bedrift' | 'kommersielt' | 'lifestyle';
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  estimatedHours: number;
  hourlyRate: number;
  description: string;
  // Bryllup-spesifikke felter
  weddingDate?: Date;
  venue?: string;
  weddingTradition?: string;
  // Andre felter
  shootDate?: Date;
  location?: string;
  deliveryDate?: Date
}

export default function ProjectCreationWizard({
  onComplete,
  onCancel,
}: ProjectCreationWizardProps) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  const { profession, getProjectTypes, getDefaultHourlyRate } = useProfessionAdapter();

  const [activeStep, setActiveStep] = useState(0);
  const [projectData, setProjectData] = useState<ProjectData>({
    name: '',
    projectType: 'bryllup',
    clientName: '',
    clientEmail: '',
    clientPhone: ', ',
    estimatedHours:  8,
    hourlyRate: getDefaultHourlyRate(),
    description: ', ',
});

  const steps = [
    'Prosjekttype','Klientinformasjon','Timeestimering',
    projectData.projectType === 'bryllup' ? 'Bryllupdetaljer' : 'Prosjektdetaljer','Bekreftelse',
  ];

  const createProjectMutation = useMutation({
    mutationFn: (data: ProjectData) =>
      apiRequest('/api/project-integration/create,', {
        method: 'POS',
        body: JSON.stringify(data),
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard,', ],});
      onComplete?.(result.data);
  },
});

  const projectTypes = getProjectTypes();

  const weddingTraditions = [
    { value: 'norsk', label: 'Norsk tradisjon',},
    { value: 'samisk', label: 'Samisk tradisjon',},
    { value: 'pakistansk', label: 'Pakistansk tradisjon',},
    { value: 'tyrkisk', label: 'Tyrkisk tradisjon',},
    { value: 'indisk', label: 'Indisk tradisjon',},
    { value: 'afrikansk', label: 'Afrikansk tradisjon',},
    { value: 'asiatisk', label: 'Asiatisk tradisjon',},
    { value: 'europisk', label: 'Europisk tradisjon',},
    { value: 'annet', label: 'Annen tradisjon',},
  ];

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
};

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
};

  const handleSubmit = () => {
    console.log('🎯 Creating integrated project: ', projectData);
    createProjectMutation.mutate(projectData);
};

  const updateProjectData = (field: keyof ProjectData, value: any) => {
    setProjectData((prev) => ({ ...prev, [field]: value }));
};

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0: // Prosjekttype
        return (
          <Box sx={{ space: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
              Velg prosjekttype
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Prosjekttype</InputLabel>
              <Select
                value={projectData.projectType}
                onChange={(e) => updateProjectData('projectType', e.target.value)}
                label="Prosjekttype"
              >
                {projectTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        );

      case 1: // Klientinformasjon
        return (
          <Box sx={{ space: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
              Klientinformasjon
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Prosjektnavn"
                  value={projectData.name}
                  onChange={(e) => updateProjectData('name', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Klientnavn"
                  value={projectData.clientName}
                  onChange={(e) => updateProjectData('clientName', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="email"
                  label="E-post"
                  value={projectData.clientEmail}
                  onChange={(e) => updateProjectData('clientEmail', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Telefon"
                  value={projectData.clientPhone}
                  onChange={(e) => updateProjectData('clientPhone', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Beskrivelse"
                  value={projectData.description}
                  onChange={(e) => updateProjectData('description', e.target.value)}
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 2: // Timeestimering
        return (
          <Box sx={{ space: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
              Timeestimering og pris
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Estimerte timer"
                  value={projectData.estimatedHours}
                  onChange={(e) => updateProjectData('estimatedHours', parseInt(e.target.value))}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Timepris"
                  value={projectData.hourlyRate}
                  onChange={(e) => updateProjectData('hourlyRate', parseInt(e.target.value))}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">NOK</InputAdornment>}}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    Estimert totalpris: {', '}
                    <strong>
                      {(projectData.estimatedHours * projectData.hourlyRate).toLocaleString(
                        'no-NO',
                      )}{' '}
                      NOK
                    </strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Du vil automatisk få varsel hvis prosjektet overskrider estimerte timer.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </Box>
        );

      case 3: // Prosjektdetaljer
        if (projectData.projectType === 'bryllup') {
          return (
            <Box sx={{ space: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
                Bryllupdetaljer
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={nb}>
                    <DatePicker
                      label="Bryllupsdato"
                      value={projectData.weddingDate}
                      onChange={(date) => updateProjectData('weddingDate', date)}
                      slotProps={{
                        textField: { fullWidth: true, required: true }}}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Lokasjon/Venue"
                    value={projectData.venue || ', '}
                    onChange={(e) => updateProjectData('venue', e.target.value)}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Kulturell bryllupstradisjon</InputLabel>
                    <Select
                      value={projectData.weddingTradition || ', '}
                      onChange={(e) => updateProjectData('weddingTradition', e.target.value)}
                      label="Kulturell bryllupstradisjon"
                    >
                      {weddingTraditions.map((tradition) => (
                        <MenuItem key={tradition.value} value={tradition.value}>
                          {tradition.label}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      Velg kulturell tradisjon for å tilpasse timeline og arbeidsflyt
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Alert severity="success">
                    <Typography variant="body2">
                      ✅ Wedding timeline blir automatisk opprettet og koblet til prosjektet
                    </Typography>
                    <Typography variant="body2">
                      ✅ Klienten får tilgang til å fylle ut detaljer
                    </Typography>
                  </Alert>
                </Grid>
              </Grid>
            </Box>
          );
      } else {
          return (
            <Box sx={{ space:  3 }}>
              <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
                Prosjektdetaljer
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={nb}>
                    <DatePicker
                      label="Fotograferingsdato"
                      value={projectData.shootDate}
                      onChange={(date) => updateProjectData('shootDate', date)}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Lokasjon"
                    value={projectData.location || ', '}
                    onChange={(e) => updateProjectData('location', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={nb}>
                    <DatePicker
                      label="Leveringsdato"
                      value={projectData.deliveryDate}
                      onChange={(date) => updateProjectData('deliveryDate', date)}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>
              </Grid>
            </Box>
          );
      }

      case 4: // Bekreftelse
        return (
          <Box sx={{ space: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
              Bekreft prosjektopprettelse
            </Typography>
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {projectData.name}
                    </Typography>
                    <Chip
                      label={projectTypes.find((t) => t.value === projectData.projectType)?.label}
                      color="primary"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Klient: {projectData.clientName} ({projectData.clientEmail})
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      Timer: {projectData.estimatedHours}t × {projectData.hourlyRate} NOK ={' '}
                      <strong>
                        {(projectData.estimatedHours * projectData.hourlyRate).toLocaleString(
                          'no-NO',
                        )}{''}
                        NOK
                      </strong>
                    </Typography>
                  </Grid>
                  {projectData.projectType === 'bryllup' && (
                    <Grid item xs={12}>
                      <Typography variant="body2">
                        Bryllup: {projectData.weddingDate?.toLocaleDateString('')} i{','}
                        {projectData.venue}
                      </Typography>
                      {projectData.weddingTradition && (
                        <Typography variant="body2" color="text.secondary">
                          Tradisjon: {', '}
                          {
                            weddingTraditions.find((t) => t.value === projectData.weddingTradition)
                              ?.label
                        }
                        </Typography>
                      )}
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>

            <Alert severity="info" sx={{ mt:  2 }}>
              <Typography variant="body2">Prosjektet vil automatisk kobles til: </Typography>
              <ul style={{ margin: '8px 0', paddingLeft: '20px'}}>
                <li>Timeregistrering og overtidsvarsel</li>
                <li>Kontraktgenerering og signering</li>
                <li>Showcase-galleriet</li>
                {projectData.projectType === 'bryllup' && (
                  <li>Wedding timeline med klienttilgang</li>
                )}
              </ul>
            </Alert>
          </Box>
        );

      default: return null;
}
};

  return (
    <Box sx={{ width: '100, %', maxWidth: 80, mx: 'auto', p:  3 }}>
      <Typography variant="h4" gutterBottom align="center" sx={{ ...{}, color: theming.colors.primary }}>
        Opprett nytt prosjekt
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb:  4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={{ p:  4 ,  ...theming.getThemedCardSx() }}>
          {renderStepContent(activeStep)}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt:  4 }}>
            <Button onClick={activeStep === 0 ? onCancel : handleBack} variant="outlined">
              {activeStep === 0 ? 'Avbryt' : 'Tilbake'}
            </Button>

            <Button onClick={activeStep === steps.length - 1 ? handleSubmit : handleNext}
              variant="contained"
              disabled={createProjectMutation.isPending}
             sx={theming.getThemedButtonSx()}>
              {createProjectMutation.isPending
                ? 'Oppretter...'
                : activeStep === steps.length - 1
                  ? 'Opprett prosjekt': 'Neste'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {createProjectMutation.error && (
        <Alert severity="error" sx={{ mt:  2 }}>
          Feil ved opprettelse av prosjekt: {createProjectMutation.error.message}
        </Alert>
      )}
    </Box>
  );
}
