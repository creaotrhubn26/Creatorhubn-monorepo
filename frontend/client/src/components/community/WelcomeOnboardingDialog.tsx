/**
 * CreatorHub Norge Community - Welcome Onboarding Dialog
 * 
 * Interactive onboarding flow for new community members
 * Solves: "Hard to onboard - no welcome map" problem
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
  StepContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Alert,
} from '@mui/material';
import {
  WavingHand as Waving,
  EmojiPeople,
  Forum,
  Gavel as Rule,
  EmojiEvents,
  CheckCircle,
} from '@mui/icons-material';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

interface WelcomeOnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  onComplete: () => void;
}

export default function WelcomeOnboardingDialog({
  open,
  onClose,
  userName,
  onComplete,
}: WelcomeOnboardingDialogProps) {
  const [activeStep, setActiveStep] = useState(0);
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();

  const steps = [
    {
      label: 'Velkommen til CreatorHub Norge! 👋',
      icon: <Waving />,
      content: (
        <Box>
          <Typography variant="body1" gutterBottom>
            Hei {userName}! Vi er glade for å ha deg her.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            CreatorHub Norge er et profesjonelt fellesskap for {getProfessionDisplayName('photographer').toLowerCase()}er, {getProfessionDisplayName('videographer').toLowerCase()}er og {getProfessionDisplayName('music_producer').toLowerCase()}er.
            La oss vise deg rundt!
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            💡 Dette tar bare 2 minutter, og du kan alltid hoppe over.
          </Alert>
        </Box>
      ),
    },
    {
      label: 'Hvordan fungerer community?',
      icon: <Forum />,
      content: (
        <Box>
          <Typography variant="body2" gutterBottom>
            Her er det viktigste du trenger å vite:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Kanaler"
                secondary="Hver kanal har et spesifikt tema (f.eks. #color-grading, #lighting)"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Tråder"
                secondary="Svar på meldinger for å starte en tråd. Hold diskusjoner organisert!"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Reaksjoner"
                secondary="Bruk emojis for å reagere på innlegg uten å spamme tråden"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Søk"
                secondary="Bruk søkefunksjonen før du spør - noen har kanskje allerede svart!"
              />
            </ListItem>
          </List>
        </Box>
      ),
    },
    {
      label: 'Retningslinjer',
      icon: <Rule />,
      content: (
        <Box>
          <Typography variant="body2" gutterBottom>
            For å holde community høykvalitet, følg disse reglene:
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
            <List dense>
              <ListItem>
                <Typography variant="body2">
                  ✅ <strong>Vær respektfull</strong> - Alle nivåer er velkomne
                </Typography>
              </ListItem>
              <ListItem>
                <Typography variant="body2">
                  ✅ <strong>Hold deg til temaet</strong> - Bruk riktig kanal
                </Typography>
              </ListItem>
              <ListItem>
                <Typography variant="body2">
                  ✅ <strong>Søk først</strong> - Unngå duplikater
                </Typography>
              </ListItem>
              <ListItem>
                <Typography variant="body2">
                  ✅ <strong>Del kunnskap</strong> - Hjelp andre når du kan
                </Typography>
              </ListItem>
              <ListItem>
                <Typography variant="body2">
                  ❌ <strong>Ingen spam</strong> - Ikke reklame uten tillatelse
                </Typography>
              </ListItem>
              <ListItem>
                <Typography variant="body2">
                  ❌ <strong>Ingen gatekeeping</strong> - Alle kan lære
                </Typography>
              </ListItem>
            </List>
          </Paper>
        </Box>
      ),
    },
    {
      label: 'Badges & Progresjon',
      icon: <EmojiEvents />,
      content: (
        <Box>
          <Typography variant="body2" gutterBottom>
            Tjen badges ved å være aktiv i community:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
            <Chip label="🎉 Første Melding" size="small" color="success" />
            <Chip label="⭐ Aktivt Medlem" size="small" color="primary" />
            <Chip label="🤝 Hjelpsom" size="small" color="warning" />
            <Chip label="🎓 Mentor" size="small" color="secondary" />
            <Chip label="🏆 Toppbidragsyter" size="small" sx={{ bgcolor: '#FFD700', color: 'black' }} />
          </Box>
          <Alert severity="success" sx={{ mt: 2 }}>
            💡 Send din første melding for å tjene"Første Melding" badge!
          </Alert>
        </Box>
      ),
    },
    {
      label: 'Du er klar! 🚀',
      icon: <EmojiPeople />,
      content: (
        <Box>
          <Typography variant="body1" gutterBottom>
            Perfekt! Du er nå klar til å delta i community.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Her er noen forslag til hvordan du kan starte:
          </Typography>
          <List dense>
            <ListItem>
              <Typography variant="body2">
                👋 Presenter deg selv i <strong>#general</strong>
              </Typography>
            </ListItem>
            <ListItem>
              <Typography variant="body2">
                🔍 Utforsk kanaler og finn temaer du er interessert i
              </Typography>
            </ListItem>
            <ListItem>
              <Typography variant="body2">
                💬 Still spørsmål - vi er her for å hjelpe!
              </Typography>
            </ListItem>
            <ListItem>
              <Typography variant="body2">
                🤝 Hjelp andre når du kan - det er slik vi vokser sammen
              </Typography>
            </ListItem>
          </List>
        </Box>
      ),
    },
  ];

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      onComplete();
      onClose();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    onComplete();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleSkip} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {steps[activeStep].icon}
          <Typography variant="h6">Velkommen til CreatorHub Norge</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
              <StepContent>
                {step.content}
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleSkip} color="inherit">
          Hopp over
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack}>
            Tilbake
          </Button>
        )}
        <Button onClick={handleNext} variant="contained">
          {activeStep === steps.length - 1 ? 'Kom i gang!' : 'Neste'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

