import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  CloudSync,
  DriveFolderUpload,
  Link as LinkIcon,
  PhotoLibrary,
  PlayArrow,
} from '@mui/icons-material';

interface LightroomInteractiveDemoProps {
  customBranding: {
    color: string;
    darkColor?: string;
  };
}

const DEMO_STEPS = [
  {
    id: 'export',
    title: 'Eksporter fra Lightroom',
    description: 'Velg CreatorHub Norge i File → Export.',
    detail: 'Rendrede bildefiler sendes med metadata fra Lightroom.',
    icon: <PhotoLibrary />,
  },
  {
    id: 'drive',
    title: 'Lagre i Google Drive',
    description: 'Backend bruker den aktive Google Drive-koblingen som er tilgjengelig for kontoen.',
    detail: 'Filen lagres i riktig Drive-struktur under kunde/prosjekt når kontekst finnes.',
    icon: <DriveFolderUpload />,
  },
  {
    id: 'showcase',
    title: 'Opprett showcase-element',
    description: 'CreatorHub lager et nytt showcase-item fra Drive-filen.',
    detail: 'Showcase bruker Drive-baserte bilde-URL-er i stedet for lokale mock-filer.',
    icon: <LinkIcon />,
  },
  {
    id: 'sync',
    title: 'Sporing og status',
    description: 'Siste synk og testkjøringer logges i CreatorHub.',
    detail: 'Statusflaten viser siste Drive-fil, siste showcase-id og eventuelle feil.',
    icon: <CloudSync />,
  },
] as const;

const FEATURE_CHIPS = [
  'Brukerbundet plugin-token',
  'Google Drive-lagring',
  'Showcase-publisering',
  'Smoke-test i nettleser',
] as const;

export const LightroomInteractiveDemo: React.FC<LightroomInteractiveDemoProps> = ({
  customBranding,
}) => {
  const [isRunning, setIsRunning] = React.useState(false);
  const [activeStep, setActiveStep] = React.useState<number | null>(null);
  const [completedSteps, setCompletedSteps] = React.useState<number[]>([]);

  const startDemo = React.useCallback(async () => {
    setIsRunning(true);
    setCompletedSteps([]);
    setActiveStep(0);

    for (let index = 0; index < DEMO_STEPS.length; index += 1) {
      setActiveStep(index);
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      setCompletedSteps((previous) => [...previous, index]);
    }

    setActiveStep(null);
    setIsRunning(false);
  }, []);

  return (
    <Box sx={{ mt: 3 }}>
      <Card
        sx={{
          borderRadius: 3,
          border: `1px solid ${customBranding.color}22`,
          background: `linear-gradient(180deg, ${customBranding.color}0e 0%, rgba(255,255,255,0.96) 100%)`,
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            sx={{ mb: 3 }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, color: customBranding.color }}>
                Lightroom-flyt
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Dette er den faktiske flyten som pluginen bruker i CreatorHub nå.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={() => { void startDemo(); }}
              disabled={isRunning}
              sx={{
                background: `linear-gradient(135deg, ${customBranding.color} 0%, ${customBranding.darkColor || '#145ea8'} 100%)`,
              }}
            >
              {isRunning ? 'Kjører demo…' : 'Vis flyt'}
            </Button>
          </Stack>

          <Grid container spacing={2}>
            {DEMO_STEPS.map((step, index) => {
              const isActive = activeStep === index;
              const isCompleted = completedSteps.includes(index);

              return (
                <Grid item xs={12} md={6} key={step.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: '100%',
                      borderColor: isActive ? customBranding.color : 'divider',
                      bgcolor: isCompleted ? `${customBranding.color}0b` : 'background.paper',
                      transition: 'all 160ms ease',
                    }}
                  >
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            bgcolor: isActive ? customBranding.color : 'rgba(0,0,0,0.06)',
                            color: isActive ? '#fff' : 'text.primary',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {step.icon}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {step.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {step.description}
                          </Typography>
                          <Typography variant="body2">{step.detail}</Typography>
                          {isActive ? (
                            <LinearProgress
                              sx={{
                                mt: 1.5,
                                borderRadius: 99,
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: customBranding.color,
                                },
                              }}
                            />
                          ) : null}
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 3 }}>
            {FEATURE_CHIPS.map((feature) => (
              <Chip key={feature} label={feature} variant="outlined" />
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
