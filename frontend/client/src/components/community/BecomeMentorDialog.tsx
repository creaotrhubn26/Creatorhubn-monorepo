/**
 * Become a Mentor Dialog
 * Explains mentor benefits, academy monetization, and initiates mentor onboarding
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  LinearProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  TextField,
  Chip,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  School,
  EmojiEvents,
  AttachMoney,
  TrendingUp,
  Group,
  CheckCircle,
  Folder,
  Notifications,
  Star,
  VideoLibrary,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface BecomeMentorDialogProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  onSuccess?: () => void;
}

interface InitializationProgress {
  step: number;
  total: number;
  steps: Array<{
    name: string;
    status: 'pending' | 'in_progress' | 'complete' | 'skipped';
  }>;
}

export default function BecomeMentorDialog({
  open,
  onClose,
  groupId,
  onSuccess,
}: BecomeMentorDialogProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<InitializationProgress | null>(null);
  const [bio, setBio] = useState('');
  const [expertise, setExpertise] = useState<string[]>([]);
  const [expertiseInput, setExpertiseInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const steps = ['Fordeler', 'Din Profil', 'Initialisering'];

  const handleAddExpertise = () => {
    if (expertiseInput.trim() && !expertise.includes(expertiseInput.trim())) {
      setExpertise([...expertise, expertiseInput.trim()]);
      setExpertiseInput('');
    }
  };

  const handleRemoveExpertise = (item: string) => {
    setExpertise(expertise.filter((e) => e !== item));
  };

  const handleInitialize = async () => {
    setLoading(true);
    setError(null);
    setActiveStep(2);

    try {
      const response = await apiRequest('/api/community/mentors/initialize-instructor', {
        method: 'POST',
        body: JSON.stringify({ bio, expertise, groupId }),
      });

      if (response.success) {
        setProgress(response.progress);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Kunne ikke initialisere instruktørprofil');
      setLoading(false);
    }
  };

  const renderBenefitsStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <School color="primary" />
        Bli Mentor & Instruktør på CreatorHub Academy
      </Typography>

      <Alert severity="success" sx={{ mb: 3 }}>
        <strong>Gratulerer!</strong> Du har tilgang til Academy-plattformen og kan bli mentor.
      </Alert>

      <Typography variant="body1" sx={{ mb: 2 }}>
        Som mentor og instruktør får du:
      </Typography>

      <List>
        <ListItem>
          <ListItemIcon>
            <EmojiEvents color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="🎓 Mentor-badge i community"
            secondary="Synlig ekspertise og økt troverdighet"
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <Group color="primary" />
          </ListItemIcon>
          <ListItemText
            primary="👥 Hjelp andre skapere"
            secondary="Svar på spørsmål og få SOS-varsler for ubesvarte spørsmål"
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <VideoLibrary color="secondary" />
          </ListItemIcon>
          <ListItemText
            primary="📚 Lag og selg kurs"
            secondary="Opprett profesjonelle kurs med videoer, oppgaver og sertifikater"
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <AttachMoney color="success" />
          </ListItemIcon>
          <ListItemText
            primary="💰 Tjene penger på kursene dine"
            secondary="70% av kursinntektene går til deg, 30% til CreatorHub"
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <TrendingUp color="info" />
          </ListItemIcon>
          <ListItemText
            primary="📈 Bygg ditt personlige merke"
            secondary="Få studenter, anmeldelser og øk din synlighet"
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <Folder color="action" />
          </ListItemIcon>
          <ListItemText
            primary="📁 Dedikerte Google Drive mapper"
            secondary="Automatisk opprettet mappestruktur for kursinnhold"
          />
        </ListItem>
      </List>

      <Divider sx={{ my: 3 }} />

      <Card sx={{ bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachMoney />
            Inntektspotensial
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Eksempel: </strong> Hvis du lager et kurs til 1.990 kr og får 100, studenter:
          </Typography>
          <Box sx={{ pl: 2 }}>
            <Typography variant="body2">• Totale inntekter: 199.000 kr</Typography>
            <Typography variant="body2">• Din andel (70%): <strong>139.300 kr</strong></Typography>
            <Typography variant="body2">• CreatorHub (30%): 59.700 kr</Typography>
          </Box>
          <Typography variant="caption" display="block" sx={{ mt: 2, fontStyle: 'italic' }}>
            Utbetalinger skjer månedlig via Stripe Connect eller bankoverføring
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );

  const renderProfileStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Fortell oss om deg
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Dette vises på instruktørprofilen din og hjelper studenter å lære deg å kjenne.
      </Typography>

      <TextField
        fullWidth
        multiline
        rows={4}
        label="Din bio"
        placeholder="Fortell om din erfaring, spesialiseringer og hva du brenner for..."
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        sx={{ mb: 3 }}
        helperText="Minimum 50 tegn anbefalt"
      />

      <Typography variant="subtitle2" gutterBottom>
        Dine ekspertiseområder
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="Legg til ekspertise"
          placeholder="F.eks. Bryllupsfotografi, Videoredigering..."
          value={expertiseInput}
          onChange={(e) => setExpertiseInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddExpertise();
            }
          }}
        />
        <Button variant="outlined" onClick={handleAddExpertise}>
          Legg til
        </Button>
      </Box>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
        {expertise.map((item) => (
          <Chip
            key={item}
            label={item}
            onDelete={() => handleRemoveExpertise(item)}
            color="primary"
            variant="outlined"
          />
        ))}
      </Stack>

      {expertise.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Legg til minst 3 ekspertiseområder
        </Typography>
      )}
    </Box>
  );

  const renderInitializationStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Initialiserer instruktørprofil...
      </Typography>

      {progress && (
        <Box sx={{ mt: 3 }}>
          <LinearProgress
            variant="determinate"
            value={(progress.step / progress.total) * 100}
            sx={{ mb: 3, height: 8, borderRadius: 4 }}
          />

          <List>
            {progress.steps.map((step, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  {step.status === 'complete' ? (
                    <CheckCircle color="success" />
                  ) : step.status === 'in_progress' ? (
                    <CircularProgress size={24} />
                  ) : step.status === 'skipped' ? (
                    <Star color="disabled" />
                  ) : (
                    <Star color="action" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={step.name}
                  secondary={
                    step.status === 'complete'
                      ? 'Fullført'
                      : step.status === 'in_progress'
                      ? 'Pågår...'
                      : step.status === 'skipped'
                      ? 'Hoppet over' : 'Venter...'
                  }
                />
              </ListItem>
            ))}
          </List>

          {progress.step === progress.total && (
            <>
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  🎉 Gratulerer! Du er nå mentor og instruktør!
                </Typography>
                <Typography variant="body2">
                  Du har nå tilgang til både mentoroversikten i community og Academy-oversikten.
                  Velg hvor du vil gå videre:
                </Typography>
              </Alert>

              <Stack spacing={2} sx={{ mt: 3 }}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<Group />}
                  onClick={() => {
                    onSuccess?.();
                    onClose();
                    // Stay in community - mentor dashboard will be accessible
                  }}
                  sx={{ textTransform: 'none', py: 1.5 }}
                >
                  Gå til community-oversikten
                </Button>

                <Button
                  fullWidth
                  variant="contained"
                  color="secondary"
                  size="large"
                  startIcon={<School />}
                  onClick={() => {
                    onSuccess?.();
                    onClose();
                    // Navigate to Academy Dashboard
                    const currentPath = window.location.pathname;
                    if (currentPath.includes('/dashboard')) {
                      window.dispatchEvent(new CustomEvent('navigate-to-academy'));
                    } else {
                      window.location.href = '/dashboard?tab=academy';
                    }
                  }}
                  sx={{ textTransform: 'none', py: 1.5 }}
                >
                  Gå til Academy-oversikten
                </Button>
              </Stack>
            </>
          )}
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );

  const canProceed = () => {
    if (activeStep === 0) return true;
    if (activeStep === 1) return bio.length >= 50 && expertise.length >= 3;
    return false;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <School color="primary" />
          Bli Mentor & Instruktør
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && renderBenefitsStep()}
        {activeStep === 1 && renderProfileStep()}
        {activeStep === 2 && renderInitializationStep()}
      </DialogContent>

      <DialogActions>
        {activeStep < 2 && (
          <>
            <Button onClick={onClose} disabled={loading}>
              Avbryt
            </Button>
            {activeStep > 0 && (
              <Button onClick={() => setActiveStep(activeStep - 1)} disabled={loading}>
                Tilbake
              </Button>
            )}
            {activeStep < 1 ? (
              <Button
                variant="contained"
                onClick={() => setActiveStep(1)}
                disabled={!canProceed()}
              >
                Neste
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleInitialize}
                disabled={!canProceed() || loading}
              >
                Start Initialisering
              </Button>
            )}
          </>
        )}
        {/* Navigation buttons are now in the content area when complete */}
      </DialogActions>
    </Dialog>
  );
}
