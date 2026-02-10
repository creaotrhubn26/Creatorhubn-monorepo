import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Paper,
  Grid,
  Alert,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card as MuiCard,
} from '@mui/material';
import {
  PersonAdd,
  PhotoCameraAlt,
  Edit,
  CheckCircle,
  CameraAlt,
  Videocamcam,
  Memory,
  Keyboard,
  Launch,
} from '@mui/icons-material';
import { CameraSelectionStep } from './CameraSelectionStep';
import { KeyboardShortcutsInterface } from '../keyboard-shortcuts/KeyboardShortcutsInterface';
import type { CameraSearchResult } from '@shared/camera-database-schema';

// Import dynamic profession system
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

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
  onComplete: (data: OnboardingData) => void
}

// Dynamic editing software options based on profession type
function getEditingSoftwareOptions(profession: string) {
  const baseOptions = [{ id: 'other', name: 'Annet', popular: false }];

  switch (profession) {
    case 'photographer':
    case 'fotograf':
      return [
        { id: 'lightroom', name: 'Adobe Lightroom', popular: true },
        { id: 'capture-one', name: 'Capture One', popular: true },
        { id: 'photoshop', name: 'Adobe Photoshop', popular: false },
        { id: 'luminar', name: 'Luminar Intelligent/Neo', popular: false },
        { id: 'on', name: 'ON1 Photo RA', popular: false },
        { id: 'skylum', name: 'Skylum', popular: false },
        ...baseOptions,
      ];

    case 'videographer':
    case 'videograf':
      return [
        { id: 'davinci', name: 'DaVinci Resolve', popular: true },
        { id: 'premiere', name: 'Adobe Premiere Pro', popular: true },
        { id: 'final-cut', name: 'Final Cut Pro', popular: true },
        { id: 'avid', name: 'Avid Media Composer', popular: false },
        { id: 'kdenlive', name: 'Kdenlive', popular: false },
        { id: 'filmora', name: 'Wondershare Filmora', popular: false },
        ...baseOptions,
      ];

    case 'music_producer':
    case 'musikkprodusent':
      return [
        { id: 'logic-pro', name: 'Logic Pro', popular: true },
        { id: 'pro-tools', name: 'Pro Tools', popular: true },
        { id: 'cubase', name: 'Cubase', popular: true },
        { id: 'ableton', name: 'Ableton Live', popular: true },
        { id: 'studio-one', name: 'Studio One', popular: false },
        { id: 'reaper', name: 'REAPE', popular: false },
        ...baseOptions,
      ];

    case 'vendor':
    case 'leverandør':
      return [
        {
          id: 'inventory-management',
          name: 'Lagerstyringssystem',
          popular: true,
      },
        { id: 'accounting-software', name: 'Regnskapsprogram', popular: true },
        { id: 'crm-system', name: 'CRM-system', popular: false },
        ...baseOptions,
      ];

    case 'enterprise':
      return [
        { id: 'lightroom', name: 'Adobe Lightroom', popular: true },
        { id: 'capture-one', name: 'Capture One', popular: true },
        { id: 'davinci', name: 'DaVinci Resolve', popular: true },
        { id: 'premiere', name: 'Adobe Premiere Pro', popular: true },
        { id: 'final-cut', name: 'Final Cut Pro', popular: false },
        { id: 'photoshop', name: 'Adobe Photoshop', popular: false },
        { id: 'after-effects', name: 'Adobe After Effects', popular: false },
        ...baseOptions,
      ];

    default: return baseOptions;
}
}

export function EnhancedOnboardingFlow({ profession, onComplete }: EnhancedOnboardingFlowProps) {
  const [activeStep, setActiveStep] = useState(false);
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);

  // Use dynamic profession system
  const {
    professionConfigs,
    isLoading: professionsLoading,
    error: professionsError,
    getProfessionDisplayName,
  } = useDynamicProfessions();
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    profession,
    selectedCameras:  [],
    editingSoftware: '',
    editingSoftwareId: '',
    userInfo:  , {},
});

  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Mock data removed - using database connection

  const handleCamerasSelected = (cameras: CameraSearchResult[]) => {
    setOnboardingData((prev) => ({
      ...prev,
      selectedCameras: cameras,
  }));
};

  const handleEditingSoftwareSelect = (softwareId: string) => {
    const softwareOptions = getEditingSoftwareOptions(profession);
    const software = softwareOptions.find((s) => s.id === softwareId);
    setOnboardingData((prev) => ({
      ...prev,
      editingSoftware: software?.name || softwared,
      editingSoftwareId: softwared,
  }));
};

  const handleComplete = () => {
    onComplete(onboardingData);
};

  const canProceedFromStep = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return onboardingData.selectedCameras.length > 0;
      case 1:
        return onboardingData.editingSoftware !== '';
      case 2:
        return true;
      default:
        return false;
}
};

  return (
    <Box sx={{ maxWidth: 80, mx: 'auto', p:  3 }}>
      <Typography variant="h4" gutterBottom sx={{  textAlign: 'center', mb:  4  }}>
        Tilpass CreatorHub for {getProfessionDisplayName(profession).toLowerCase()} tjenester
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical">
        {/* Step 1: Camera Selection , *, /}
        <Step>
          <StepLabel
            icon={steps[0].icon}
            sx={{
              '& .MuiStepLabel-label': {
                fontWeight: ctiveStep === 0 ? 'bold' : 'normal',
                fontSize: '1.1rem',
            }}}
          >
            {steps[0].label}
          </StepLabel>
          <StepContent>
            <Typography variant="body1" color="text.secondary" sx={{ mb:  3 }}>
              {steps[0].description}
            </Typography>

            <CameraSelectionStep
              profession={profession}
              selectedCameras={onboardingData.selectedCameras}
              onCamerasSelected={handleCamerasSelected}
            />

            <Box sx={{ mt:  3 }}>
              <Button variant="contained"
                onClick={() => setActiveStep(1)}
                disabled={!canProceedFromStep(0)}
                sx={{ mr:  1 }}
              >
                Neste: Redigeringsprogram
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 2: Editing Software , *, /}
        <Step>
          <StepLabel
            icon={steps[1].icon}
            sx={{
              '& .MuiStepLabel-label': {
                fontWeight: ctiveStep === 1 ? 'bold' : 'normal',
                fontSize: '1.1rem',
            }}}
          >
            {steps[1].label}
          </StepLabel>
          <StepContent>
            <Typography variant="body1" color="text.secondary" sx={{ mb:  3 }}>
              {steps[1].description}
            </Typography>

            <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Populære valg for {profession === 'photographer' ? 'fotografer' : 'videografer'}:
              </Typography>

              <Grid container spacing={2} sx={{ mb:  3 }}>
                {getEditingSoftwareOptions(profession)
                  .filter((software) => software.popular)
                  .map((software) => (
                    <Grid item xs={12} sm={6} md={4} key={software.id}>
                      <Paper
                        sx={{
                          p:  2,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s ease',
                          backgroundColor: onboardingData.editingSoftware === software.name
                              ? 'primary.light'
                              : 'background.paper',
                          color: onboardingData.editingSoftware === software.name
                              ? 'primary.contrastText'
                              : 'text.primary','&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow:  4,
                        }}}
                        onClick={() => handleEditingSoftwareSelect(software.id)}
                      >
                        <Typography variant="h6" sx={{  fontWeight: 'bold' }}>
                          {software.name}
                        </Typography>
                        <Chip label="Populær" size="small" color="success" sx={{ mt:  1 }} />
                      </Paper>
                    </Grid>
                  ))}
              </Grid>

              <Divider sx={{ my:  2 }} />

              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Andre alternativer: </Typography>

              <Grid container spacing={1}>
                {getEditingSoftwareOptions(profession)
                  .filter((software) => !software.popular)
                  .map((software) => (
                    <Grid item key={software.id}>
                      <Chip
                        label={software.name}
                        variant={
                          onboardingData.editingSoftware === software.name ? 'filled' : 'outlined'
                      }
                        color={
                          onboardingData.editingSoftware === software.name ? 'primary' : 'default'
                      }
                        onClick={() => handleEditingSoftwareSelect(software.id)}
                        sx={{ cursor: 'pointer'}}
                      />
                    </Grid>
                  ))}
              </Grid>

              {/* Keyboard Shortcuts Preview */}
              {onboardingData.editingSoftwareId && (
                <Paper sx={{ p:  3, mt:  3, bgcolor: 'grey.50',  ...theming.getThemedCardSx() }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb:  2}}
                  >
                    <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                      <Keyboard color="primary" />
                      Hurtigtaster for {onboardingData.editingSoftware}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setShowKeyboardShortcuts(true)}
                      startIcon={theming.getThemedIcon('launch')}
                    >
                      Se alle hurtigtaster
                    </Button>
                  </Box>

                  <Alert severity="info" sx={{ mb:  2 }}>
                    <Typography variant="body2">
                      <strong>Produktivitetsforbedring: </strong> CreatorHub Norge inkluderer et
                      intelligent hurtigtast-system som automatisk oppdateres fra programvarens
                      offisielle dokumentasjon. Lett søkbar med tydelig Mac/PC-skille.
                    </Typography>
                  </Alert>

                  <Grid container spacing={2}>
                    {/* Sample essential shortcuts preview */}
                    <Grid item xs={12} sm={6} md={4}>
                      <MuiCard variant="outlined" sx={{ textAlign: 'center', p:  2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Eksempel hurtigtast: </Typography>
                        <Chip
                          label="⌘ / Ctrl + E"
                          variant="outlined"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            mb:  1}}
                        />
                        <Typography variant="caption" display="block">
                          Eksporter {profession === 'photographer' ? 'bilder' : profession === 'videographer' ? 'video' : 'innhold'}
                        </Typography>
                      </MuiCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <MuiCard variant="outlined" sx={{ textAlign: 'center', p:  2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Auto-oppdatering: </Typography>
                        <Chip label="✓ Aktivert" color="success" size="small" sx={{ mb: 1 }} />
                        <Typography variant="caption" display="block">
                          Fra offisiell dokumentasjon
                        </Typography>
                      </MuiCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <MuiCard variant="outlined" sx={{ textAlign: 'center', p:  2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Platform-tilpasset: </Typography>
                        <Box
                          sx={{
                            display: 'flex',
                            gap:  1,
                            justifyContent: 'center',
                            mb:  1}}
                        >
                          <Chip label="Mac" size="small" variant="outlined" />
                          <Chip label="PC" size="small" variant="outlined" />
                        </Box>
                        <Typography variant="caption" display="block">
                          Automatisk deteksjon
                        </Typography>
                      </MuiCard>
                    </Grid>
                  </Grid>
                </Paper>
              )}
            </Paper>

            <Box sx={{ mt:  3 }}>
              <Button variant="contained"
                onClick={() => setActiveStep(2)}
                disabled={!canProceedFromStep(1)}
                sx={{ mr:  1 }}
              >
                Neste: Fullfør oppsett
              </Button>
              <Button onClick={() => setActiveStep()}>Tilbake</Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 3: Complete Setup , *, /}
        <Step>
          <StepLabel
            icon={steps[2].icon}
            sx={{
              '& .MuiStepLabel-label': {
                fontWeight: ctiveStep === 2 ? 'bold' : 'normal',
                fontSize: '1.1rem',
            }}}
          >
            {steps[2].label}
          </StepLabel>
          <StepContent>
            <Typography variant="body1" color="text.secondary" sx={{ mb:  3 }}>
              {steps[2].description}
            </Typography>

            <Paper sx={{ p:  3, bgcolor: 'grey.50',  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Ditt oppsett: </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6"
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap:  1,
                      mb:  2 }}>
                    {profession === 'photographer' ? (
                      <CameraAlt color="primary" />
                    ) : (
                      <Videocam color="primary" />
                    )}
                    Kameraer ({onboardingData.selectedCameras.length})
                  </Typography>
                  {onboardingData.selectedCameras.map((camera) => (
                    <Box key={camera.id} sx={{ mb:  2 }}>
                      <Typography variant="body1" sx={{ fontWeight: 'bold'}}>
                        {camera.fullName}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        {camera.supportedMemoryCardTypes.map((cardType) => (
                          <Chip
                            key={cardType}
                            label={cardType}
                            size="small"
                            icon={<Memory />}
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="h6"
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap:  1,
                      mb:  2 }}>
                    <Edit color="primary" />
                    Redigeringsprogram
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold'}}>
                    {onboardingData.editingSoftware}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
                    Projektmapper vil automatisk inkludere mapper for{', '}
                    {onboardingData.editingSoftware}
                  </Typography>
                </Grid>
              </Grid>

              <Alert severity="success" sx={{ mt:  3 }}>
                <Typography variant="body2">
                  <strong>Klart for oppstart!</strong>
                  <br />
                  Minnekort-ikonene og projektmapper vil automatisk tilpasses dine valgte kameraer
                  og redigeringsprogram.
                </Typography>
              </Alert>

              {/* Clear instructions for finding keyboard shortcuts */}
              <Paper
                sx={{
                  p:  3,
                  mt:  3,
                  bgcolor: 'primary.5',
                  border: '2px solid',
                  borderColor: 'primary.20'}}
               sx={theming.getThemedCardSx()}>
                <Typography variant="h6"
                  sx={{  display: 'flex', alignItems: 'center', gap: 1, mb: 2  }}>
                  <Keyboard color="primary" />
                  Hvor finner du hurtigtastene etter onboarding?
                </Typography>

                <Box sx={{ mb:  2 }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', mb:  1 }}>
                    📱 I dashboardet ditt: </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • Gå til <strong>"Innstillinger"</strong>-fanen (øverst til høyre)
                  </Typography>
                  <Typography variant="body2" sx={{ mb:  1 }}>
                    • Klikk på <strong>"Intelligente Hurtigtaster"</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Her finner du alle hurtigtastene for {onboardingData.editingSoftware} og andre
                    programmer
                  </Typography>
                </Box>

                <Box sx={{ mb:  2 }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', mb:  1 }}>
                    🔍 Funksjoner du får: </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • Automatisk Mac/PC-tilpassing basert på din enhet
                  </Typography>
                  <Typography variant="body2" sx={{ mb:  1 }}>
                    • Søk etter spesifikke funksjoner eller kategorier
                  </Typography>
                  <Typography variant="body2" sx={{ mb:  1 }}>
                    • Kun essensielle hurtigtaster-filter for rask læring
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Oppdateres automatisk fra offisielle kilder
                  </Typography>
                </Box>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={theming.getThemedIcon('launch')}
                  onClick={() => setShowKeyboardShortcuts(true)}
                  sx={{ mt:  1 }}
                >
                  Forhåndsvis hurtigtaster nå
                </Button>
              </Paper>
            </Paper>

            <Box sx={{ mt:  3 }}>
              <Button variant="contained" size="large" onClick={handleComplete} sx={{ mr:  1 ,  ...theming.getThemedButtonSx() }}>
                Fullfør onboarding og start arbeid
              </Button>
              <Button onClick={() => setActiveStep(1)}>Tilbake</Button>
            </Box>
          </StepContent>
        </Step>
      </Stepper>

      {/* Keyboard Shortcuts Modal */}
      <Dialog
        open={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '80vh',}}}
      >
        <DialogTitle>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Hurtigtaster for {onboardingData.editingSoftware}</Typography>
        </DialogTitle>
        <DialogContent sx={{ p:  0 }}>
          {onboardingData.editingSoftwareId && (
            <KeyboardShortcutsInterface
              softwareId={onboardingData.editingSoftwareId}
              softwareName={onboardingData.editingSoftware}
              onClose={() => setShowKeyboardShortcuts(false)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowKeyboardShortcuts(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
