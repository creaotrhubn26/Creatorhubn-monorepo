import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Paper,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import {
  CameraAlt,
  CheckCircle,
  Edit,
  Keyboard,
  Memory,
  Videocam,
} from '@mui/icons-material';
import { CameraSelectionStep } from './CameraSelectionStep';
import type { CameraSearchResult } from '@shared/camera-database-schema';

interface OnboardingData {
  profession: string;
  selectedCameras: CameraSearchResult[];
  editingSoftware: string;
  editingSoftwareId: string;
  userInfo: {
    name?: string;
    businessName?: string;
    email?: string;
  };
}

interface EnhancedOnboardingFlowProps {
  profession: string;
  onComplete: (data: OnboardingData) => void;
}

type EditingSoftwareOption = {
  id: string;
  name: string;
  popular: boolean;
};

const STEP_LABELS = ['Kameraoppsett', 'Redigeringsprogram', 'Oppsummering'];

function getEditingSoftwareOptions(profession: string): EditingSoftwareOption[] {
  const baseOptions: EditingSoftwareOption[] = [{ id: 'other', name: 'Annet', popular: false }];

  switch (profession) {
    case 'photographer':
    case 'fotograf':
      return [
        { id: 'lightroom', name: 'Adobe Lightroom', popular: true },
        { id: 'capture-one', name: 'Capture One', popular: true },
        { id: 'photoshop', name: 'Adobe Photoshop', popular: false },
        { id: 'luminar', name: 'Luminar Neo', popular: false },
        ...baseOptions,
      ];
    case 'videographer':
    case 'videograf':
      return [
        { id: 'davinci', name: 'DaVinci Resolve', popular: true },
        { id: 'premiere', name: 'Adobe Premiere Pro', popular: true },
        { id: 'final-cut', name: 'Final Cut Pro', popular: true },
        { id: 'avid', name: 'Avid Media Composer', popular: false },
        ...baseOptions,
      ];
    case 'music_producer':
    case 'musikkprodusent':
      return [
        { id: 'logic-pro', name: 'Logic Pro', popular: true },
        { id: 'pro-tools', name: 'Pro Tools', popular: true },
        { id: 'ableton', name: 'Ableton Live', popular: true },
        { id: 'cubase', name: 'Cubase', popular: false },
        ...baseOptions,
      ];
    case 'vendor':
    case 'leverandør':
      return [
        { id: 'inventory-management', name: 'Lagerstyring', popular: true },
        { id: 'accounting-software', name: 'Regnskapssystem', popular: true },
        { id: 'crm-system', name: 'CRM-system', popular: false },
        ...baseOptions,
      ];
    default:
      return baseOptions;
  }
}

function professionDisplayName(profession: string): string {
  switch (profession) {
    case 'photographer':
    case 'fotograf':
      return 'Fotograf';
    case 'videographer':
    case 'videograf':
      return 'Videograf';
    case 'music_producer':
    case 'musikkprodusent':
      return 'Musikkprodusent';
    case 'vendor':
    case 'leverandør':
      return 'Leverandør';
    default:
      return profession;
  }
}

function shortcutExamples(softwareId: string): string[] {
  if (softwareId === 'davinci') {
    return ['I/O: Mark In/Out', 'B: Blade tool', 'Shift+Z: Fit timeline'];
  }
  if (softwareId === 'premiere') {
    return ['I/O: Mark In/Out', 'C: Razor', 'V: Selection'];
  }
  if (softwareId === 'final-cut') {
    return ['I/O: Mark In/Out', 'B: Blade', 'P: Position tool'];
  }
  if (softwareId === 'lightroom') {
    return ['D: Develop', 'R: Crop', 'G: Grid'];
  }
  return ['I/O: Mark In/Out', 'Cmd/Ctrl+S: Save', 'Space: Play/Pause'];
}

export function EnhancedOnboardingFlow({
  profession,
  onComplete,
}: EnhancedOnboardingFlowProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);

  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    profession,
    selectedCameras: [],
    editingSoftware: '',
    editingSoftwareId: '',
    userInfo: {},
  });

  const softwareOptions = useMemo(() => getEditingSoftwareOptions(profession), [profession]);

  const popularSoftware = useMemo(
    () => softwareOptions.filter((option) => option.popular),
    [softwareOptions],
  );

  const otherSoftware = useMemo(
    () => softwareOptions.filter((option) => !option.popular),
    [softwareOptions],
  );

  const canProceedFromStep = (step: number): boolean => {
    if (step === 0) {
      return onboardingData.selectedCameras.length > 0;
    }

    if (step === 1) {
      return onboardingData.editingSoftwareId.length > 0;
    }

    return true;
  };

  const handleSoftwareSelect = (softwareId: string) => {
    const option = softwareOptions.find((candidate) => candidate.id === softwareId);
    if (!option) {
      return;
    }

    setOnboardingData((previous) => ({
      ...previous,
      editingSoftware: option.name,
      editingSoftwareId: option.id,
    }));
  };

  const handleFinish = () => {
    onComplete(onboardingData);
  };

  const shortcuts = shortcutExamples(onboardingData.editingSoftwareId);

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ textAlign: 'center', mb: 1.5 }}>
        Onboarding for {professionDisplayName(profession)}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mb: 4 }}>
        Sett opp kameraer, verktøy og arbeidsflyt før første prosjekt.
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical">
        <Step>
          <StepLabel icon={<CameraAlt color="primary" />}>{STEP_LABELS[0]}</StepLabel>
          <StepContent>
            <CameraSelectionStep
              profession={profession}
              selectedCameras={onboardingData.selectedCameras}
              onCamerasSelected={(selectedCameras) =>
                setOnboardingData((previous) => ({ ...previous, selectedCameras }))
              }
            />

            <Box sx={{ mt: 2.5 }}>
              <Button
                variant="contained"
                onClick={() => setActiveStep(1)}
                disabled={!canProceedFromStep(0)}
              >
                Neste: Redigeringsprogram
              </Button>
            </Box>
          </StepContent>
        </Step>

        <Step>
          <StepLabel icon={<Edit color="primary" />}>{STEP_LABELS[1]}</StepLabel>
          <StepContent>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
                Anbefalte valg
              </Typography>
              <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                {popularSoftware.map((option) => {
                  const isSelected = onboardingData.editingSoftwareId === option.id;

                  return (
                    <Grid item xs={12} md={6} key={option.id}>
                      <Button
                        fullWidth
                        variant={isSelected ? 'contained' : 'outlined'}
                        onClick={() => handleSoftwareSelect(option.id)}
                      >
                        {option.name}
                      </Button>
                    </Grid>
                  );
                })}
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Andre alternativer
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {otherSoftware.map((option) => {
                  const isSelected = onboardingData.editingSoftwareId === option.id;

                  return (
                    <Chip
                      key={option.id}
                      label={option.name}
                      color={isSelected ? 'primary' : 'default'}
                      variant={isSelected ? 'filled' : 'outlined'}
                      onClick={() => handleSoftwareSelect(option.id)}
                      clickable
                    />
                  );
                })}
              </Box>

              {onboardingData.editingSoftwareId && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Hurtigtastprofil for <strong>{onboardingData.editingSoftware}</strong> er aktivert.
                </Alert>
              )}
            </Paper>

            <Box sx={{ mt: 2.5, display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                onClick={() => setActiveStep(2)}
                disabled={!canProceedFromStep(1)}
              >
                Neste: Oppsummering
              </Button>
              <Button onClick={() => setActiveStep(0)}>Tilbake</Button>
              <Button
                variant="outlined"
                startIcon={<Keyboard />}
                onClick={() => setShowShortcutsDialog(true)}
                disabled={!onboardingData.editingSoftwareId}
              >
                Vis hurtigtaster
              </Button>
            </Box>
          </StepContent>
        </Step>

        <Step>
          <StepLabel icon={<CheckCircle color="success" />}>{STEP_LABELS[2]}</StepLabel>
          <StepContent>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Oppsummering
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Videocam fontSize="small" color="primary" />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {onboardingData.selectedCameras.length} kamera valgt
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
                {onboardingData.selectedCameras.map((camera) => (
                  <Chip key={camera.id} label={camera.fullName} variant="outlined" />
                ))}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Edit fontSize="small" color="primary" />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {onboardingData.editingSoftware || 'Ikke valgt'}
                </Typography>
              </Box>

              {onboardingData.selectedCameras.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
                  {onboardingData.selectedCameras[0].supportedMemoryCardTypes.map((cardType) => (
                    <Chip
                      key={cardType}
                      icon={<Memory fontSize="small" />}
                      label={cardType}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}

              <Alert severity="success">
                Oppsettet ditt er klart. CreatorHub kan nå bruke riktig workflow, presets og snarveier.
              </Alert>
            </Paper>

            <Box sx={{ mt: 2.5, display: 'flex', gap: 1 }}>
              <Button variant="contained" size="large" onClick={handleFinish}>
                Fullfør onboarding
              </Button>
              <Button onClick={() => setActiveStep(1)}>Tilbake</Button>
            </Box>
          </StepContent>
        </Step>
      </Stepper>

      <Dialog
        open={showShortcutsDialog}
        onClose={() => setShowShortcutsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Hurtigtaster: {onboardingData.editingSoftware || 'Standard'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Dette er nøkkel-shortcuts som brukes i onboarding-profilen.
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {shortcuts.map((shortcut) => (
              <li key={shortcut}>
                <Typography variant="body2">{shortcut}</Typography>
              </li>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowShortcutsDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
