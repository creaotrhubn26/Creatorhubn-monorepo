// @ts-nocheck
/**
 * Tutorial Submission System - Sender tutorials til admin for godkjenning
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  Send as SubmitIcon,
  AdminPanelSettings as AdminIcon,
  CheckCircle as ApprovedIcon,
  Schedule as PendingIcon,
  Cancel as RejectedIcon,
  Star as QualityIcon,
  VideoLibrary as VideoIcon,
  PhotoLibrary as PhotoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

interface TutorialSubmission {
  id: string;
  title: string;
  description: string;
  targetUrl: string;
  type: 'video' | 'mixed';
  steps: number;
  qualityScore: number;
  submittedBy: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  rejectionReason?: string
}

interface TutorialSubmissionSystemProps {
  open: boolean;
  onClose: () => void;
  tutorialData: {
    title: string;
    description: string;
    targetUrl: string;
    type: 'video' | 'mixed';
    steps: number;
    qualityScore: number;
};
  onSubmissionComplete?: (submission: TutorialSubmission) => void;
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void
}

export const TutorialSubmissionSystem: React.FC<TutorialSubmissionSystemProps> = ({
  open,
  onClose,
  tutorialData,
  onSubmissionComplete,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}) => {
  const [activeStep, setActiveStep] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [submitting, setSubmitting] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [agreement, setAgreement] = useState(false);

  const steps = [
    'Kvalitetskontroll', 'Innsendingsdetaljer', 'Bekreftelse', 'Send til Admin'
  ];

  const handleSubmitToAdmin = async () => {
    setSubmitting(true);
    
    try {
      // Simulate API call to submit tutorial for admin review
      const submission: TutorialSubmission = {
        id: `submission_${Date.now()}`,
        ...tutorialData,
        submittedBy: 'current_user_id', // Replace with actual user ID
        submittedAt: new Date().toISOString(),
        status: 'pending',
        adminNotes: submissionNotes
  };

      // Simulate submission delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('📤 Tutorial submitted to admin for review: ', submission);
      
      // Trigger unified workflow events
      onProjectUpdate?.({
        ...selectedProject,
        tutorialSubmitted: submission,
        timestamp: new Date().toISOString()
  });
      onNotificationCreate?.({
        id: `tutorial_submitted_${Date.now()}`,
        type: 'tutorial_submitted',
        title: 'Tutorial Submitted',
        message: `"${submission.title}" submitted for admin review`,
        priority: 'high',
        timestamp: new Date().toISOString(),
        source: 'tutorial_submission_system'
  });
      
      onSubmissionComplete?.(submission);
      
      // Show success and close
      alert(`✅ Tutorial sendt til admin for godkjenning! 
      
🎉 Tusen takk for ditt bidrag til CreatorHub Norge!

📋 Status: Under vurdering
⏳ Admin vil vurdere din tutorial og gi tilbakemelding
💎 Hvis godkjent vil den publiseres i FAQ-systemet
🏆 Du vil få poeng når tutorialen blir godkjent!`);
      
      onClose();
      
} catch (error) {
      console.error('❌ Failed to submit tutorial:', error);
      alert('❌ Feil ved innsending. Prøv igjen.');
  } finally {
      setSubmitting(false);
  }
};

  const getQualityLevel = (score: number): { label: string; color: string; icon: React.ReactNode } => {
    if (score >= 90) return { label: 'Utmerket', color: '#4CAF50', icon: <QualityIcon />,};
    if (score >= 75) return { label: 'Meget Bra', color: '#FF9800', icon: <QualityIcon />,};
    if (score >= 60) return { label: 'Bra', color: '#2196F3', icon: <QualityIcon />,};
    return { label: 'Akseptabel', color: '#9E9E9E', icon: <QualityIcon />,};
};

  const quality = getQualityLevel(tutorialData.qualityScore);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <AdminIcon color="primary" />
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>Send Tutorial til Admin</Typography>
        </Box>
        <Button onClick={onClose} disabled={submitting}>
          <CloseIcon />
        </Button>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb:  3 }}>
          📋 <strong>Admin-Godkjenningsprosess: </strong> Din tutorial vil bli vurdert av admin som velger de beste veiledningene for FAQ-systemet.
        </Alert>

        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Step 0: Quality Control */}
          <Step>
            <StepLabel>Kvalitetskontroll</StepLabel>
            <StepContent>
              <Card sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    📊 Tutorial Kvalitetsvurdering
                  </Typography>
                  
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
                    <Box sx={{ textAlign: 'center'}}>
                      <Typography variant="h4" sx={{  color: quality.color, fontWeight: 'bold' }}>
                        {tutorialData.qualityScore}%
                      </Typography>
                      <Chip 
                        label={quality.label}
                        sx={{ bgcolor: quality.color + '2', color: quality.color }}
                        icon={quality.icon}
                      />
                    </Box>
                    <Box sx={{ textAlign: 'center'}}>
                      <Typography variant="h4" color="primary" fontWeight="bold" sx={{ color: theming.colors.primary }}>
                        {tutorialData.steps}
                      </Typography>
                      <Typography variant="caption">Steg i Tutorial</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center'}}>
                      {tutorialData.type === 'video' ? <VideoIcon sx={{ fontSize:  40, color: 'primary.main'}} /> : <PhotoIcon sx={{ fontSize:  40, color: 'secondary.main'}} />}
                      <Typography variant="caption" display="block">
                        {tutorialData.type === 'video' ? 'Video Tutorial' : 'Mixed Media'}
                      </Typography>
                    </Box>
                  </Box>

                  <Alert severity={tutorialData.qualityScore >= 75 ? "success" : "warning"}>
                    {tutorialData.qualityScore >= 75 ? (
                      <>🎉 <strong>Høy kvalitet!</strong> Din tutorial har god sjanse for godkjenning av admin.</>
                    ) : (
                      <>⚠️ <strong>Medium kvalitet.</strong> Vurder å forbedre tutorialen før innsending.</>
                    )}
                  </Alert>
                </CardContent>
              </Card>
              
              <Button variant="contained"
                onClick={() => setActiveStep(1)}
                disabled={tutorialData.qualityScore < 50}
              >
                Fortsett til Innsending
              </Button>
              {tutorialData.qualityScore < 50 && (
                <Typography variant="caption" color="error" display="block" sx={{ mt:  1 }}>
                  Minimum 50% kvalitetsscore kreves for innsending
                </Typography>
              )}
            </StepContent>
          </Step>

          {/* Step 1: Submission Details */}
          <Step>
            <StepLabel>Innsendingsdetaljer</StepLabel>
            <StepContent>
              <Box sx={{ mb:  2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  📝 Tutorial Informasjon
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Tittel" 
                      secondary={tutorialData.title}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Beskrivelse" 
                      secondary={tutorialData.description || 'Ingen beskrivelse oppgitt'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Mål-URL" 
                      secondary={tutorialData.targetUrl}
                    />
                  </ListItem>
                </List>
              </Box>

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Notater til Admin (valgfritt)"
                placeholder="Legg til eventuelle notater eller kommentarer til admin her..."
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                sx={{ mb:  2 }}
              />
              
              <Box sx={{ display: 'flex', gap:  1 }}>
                <Button onClick={() => setActiveStep(0)}>
                  Tilbake
                </Button>
                <Button variant="contained"
                  onClick={() => setActiveStep(2)}
                >
                  Fortsett
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 2: Confirmation */}
          <Step>
            <StepLabel>Bekreftelse</StepLabel>
            <StepContent>
              <Alert severity="info" sx={{ mb:  2 }}>
                📋 <strong>Før innsending: </strong>
                <List dense>
                  <ListItem>• Admin vil vurdere din tutorial innen 24-48 timer</ListItem>
                  <ListItem>• Du får melding om godkjenning/avslag</ListItem>
                  <ListItem>• Godkjente tutorials publiseres i FAQ-systemet</ListItem>
                  <ListItem>• Du tjener CreatorHub Verified poeng ved godkjenning</ListItem>
                </List>
              </Alert>

              <Box sx={{ display: 'flex', gap:  1 }}>
                <Button onClick={() => setActiveStep(1)}>
                  Tilbake
                </Button>
                <Button variant="contained"
                  onClick={() => setActiveStep(3)}
                >
                  Bekreft og Send
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 3: Submit */}
          <Step>
            <StepLabel>Send til Admin</StepLabel>
            <StepContent>
              {submitting ? (
                <Box sx={{ textAlign: 'center', py:  3 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    📤 Sender tutorial til admin...
                  </Typography>
                  <LinearProgress sx={{ my:  2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Vennligst vent mens vi sender din tutorial for vurdering
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Alert severity="success" sx={{ mb:  2 }}>
                    🎯 <strong>Klar for innsending!</strong> Din tutorial er klar til å sendes til admin for vurdering.
                  </Alert>
                  
                  <Box sx={{ display: 'flex', gap:  1 }}>
                    <Button onClick={() => setActiveStep(2)} disabled={submitting}>
                      Tilbake
                    </Button>
                    <Button variant="contained"
                      color="success"
                      startIcon={<SubmitIcon />}
                      onClick={handleSubmitToAdmin}
                      disabled={submitting}
                    >
                      Send til Admin
                    </Button>
                  </Box>
                </Box>
              )}
            </StepContent>
          </Step>
        </Stepper>

        {/* CreatorHub Norge Message */}
        <Box sx={{ mt:  3, p: 2, bgcolor: 'rgba(5,118,210,0.1)', borderRadius:  1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle:'italic'}}>
            🙏 <strong>Tusen takk for ditt bidrag til CreatorHub Norge!</strong> 
            <br />
            Dine tutorials hjelper fellesskapet og bygger en bedre platform for alle.
            <br />
            💡 Admin velger de beste veiledningene som publiseres i FAQ-systemet.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
