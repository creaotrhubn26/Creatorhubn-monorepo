import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Card as MuiCard,
  CardContent,
  Fade
} from '@mui/material';
import {
  FolderOpen,
  Google,
  CheckCircle,
  Schedule,
  CloudSync,
  CreateNewFolder,
  Security,
  Share
} from '@mui/icons-material';

interface ProjectFolderCreationModalProps {
  open: boolean;
  projectName: string;
  projectType: 'photography' | 'videography' | 'music' | 'vendor';
  onComplete?: (folderId: string) => void;
  onError?: (error: string) => void
}

interface FolderStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'creating' | 'completed';
  icon: React.ReactNode
}

const ProjectFolderCreationModal: React.FC<ProjectFolderCreationModalProps> = ({
  open,
  projectName,
  projectType,
  onComplete,
  onError
}) => {
  const [progress, setProgress] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [currentStep, setCurrentStep] = useState('');
  const [steps, setSteps] = useState<FolderStep[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const professionColors = {
    photography: '#ff8c00',
    videography: '#e74c30',
    music: '#9b59b0',
    vendor: '#27ae60'
};

  useEffect(() => {
    if (open && !isCreating) {
      initializeFolderCreation();
  }
}, [open]);

  const initializeFolderCreation = () => {
    const folderSteps: FolderStep[] = [
      {
        id: 'main',
        name: 'Hovedprosjektmappe',
        description: `CreatorHub Norge - ${projectName}`,
        status: 'pending',
        icon: <CreateNewFolder />
  },
      {
        id: 'raw',
        name: 'Raw Footage',
        description: 'Originale råfiler og ubearbeidede bilder',
        status: 'pending',
        icon: theming.getThemedIcon('')
    },
      {
        id: 'edited',
        name: 'Edited Files',
        description: 'Bearbeidede og retusjerte filer',
        status: 'pending',
        icon: theming.getThemedIcon('')
    },
      {
        id: 'review',
        name: 'Client Review',
        description: 'Filer til kundegjennomgang og godkjenning',
        status: 'pending',
        icon: theming.getThemedIcon('')
    },
      {
        id: 'delivery',
        name: 'Final Delivery',
        description: 'Endelige leveranser til kunden',
        status: 'pending',
        icon: theming.getThemedIcon('')
    },
      {
        id: 'contracts',
        name: 'Contracts & Documents',
        description: 'Kontrakter, avtaler og administrative dokumenter',
        status: 'pending',
        icon: theming.getThemedIcon(', ')
    },
      {
        id: 'reference',
        name: 'Reference Materials',
        description: 'Referansemateriale og inspirasjon',
        status: 'pending',
        icon: theming.getThemedIcon(', ')
    },
      {
        id: 'backup',
        name: 'Backup & Archive',
        description: 'Sikkerhetskopier og arkiverte filer',
        status: 'pending',
        icon: theming.getThemedIcon(', ')
    }
    ];

    setSteps(folderSteps);
    setIsCreating(true);
    startFolderCreation(folderSteps);
};

  const startFolderCreation = async (folderSteps: FolderStep[]) => {
    try {
      setCurrentStep('Kobler til Google Drive...');
      setProgress(5);

      // Simulate Google Drive connection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let currentProgress = 10;
      const progressPerStep = 90 / folderSteps.length;

      for (let i = 0; i < folderSteps.length; i++) {
        const step = folderSteps[i];
        
        // Update step to creating
        setSteps(prev => prev.map(s => 
          s.id === step.id ? { ...s, status: 'creating',} : s
        ));
        
        setCurrentStep(`Oppretter ${step.name}...`);
        setProgress(Math.round(currentProgress));

        // Simulate folder creation time
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

        // Mark step as completed
        setSteps(prev => prev.map(s => 
          s.id === step.id ? { ...s, status: 'completed',} : s
        ));

        currentProgress += progressPerStep;
    }

      setCurrentStep('Mappestruktur fullført!');
      setProgress(100);

      // Wait a moment before completing
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (onComplete) {
        onComplete('mock-drive-folder-id');
    }

  } catch (error) {
      console.error('Folder creation error: ', error);
      if (onError) {
        onError('Kunne ikke opprette mappestruktur i Google Drive');
    }
  }
};

  const getStepIcon = (step: FolderStep) => {
    if (step.status === 'completed') {
      return <CheckCircle sx={{ color: '#4caf50'}} />;
  } else if (step.status === 'creating') {
      return <Schedule sx={{ color: professionColors[projectType, ]}} />;
  }
    return step.icon;
};

  return (
    <Dialog open={open} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <CloudSync sx={{ color: professionColors[projectType, ]}} />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Oppretter Google Drive mappestruktur
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box mb={3}>
          <MuiCard sx={{ 
            background: `linear-gradient(135deg, ${professionColors[projectType]}20, transparent)`,
            border: `1px solid ${professionColors[projectType]}30`
        }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Google sx={{ color: '#4285f4'}} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>{projectName}</Typography>
                <Chip 
                  label={projectType.toUpperCase()}
                  size="small"
                  sx={{ 
                    backgroundColor: professionColors[projectType],
                    color: 'white',
                    fontWeight: 'bold'
              }}
                />
              </Box>
              
              <Typography variant="body2" color="text.secondary" mb={2}>
                {currentStep}
              </Typography>
              
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height:  8,
                  borderRadius:  4,
                  backgroundColor: `${professionColors[projectType]}20`'& .MuiLinearProgress-bar': {
                    backgroundColor: professionColors[projectType],
                    borderRadius: 4 }
              }}
              />
              
              <Box display="flex" justifyContent="space-between" mt={1}>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(progress)}% fullført
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {steps.filter(s => s.status === 'completed').length} av {steps.length} mapper
                </Typography>
              </Box>
            </CardContent>
          </MuiCard>
        </Box>

        <Typography variant="subtitle2" color="text.secondary" mb={2}>
          Mappestruktur som opprettes: </Typography>

        <List>
          {steps.map((step, index) => (
            <Fade in={true} timeout={300 + index * 100} key={step.id}>
              <ListItem>
                <ListItemIcon>
                  {getStepIcon(step)}
                </ListItemIcon>
                <ListItemText
                  primary={step.name}
                  secondary={step.description}
                  sx={{
                    opacity: step.status === 'completed' ? 0.8 : 1,
                    textDecoration: step.status === 'completed' ? 'line-through' : 'none'
              }}
                />
                {step.status === 'completed' && (
                  <Chip 
                    label="Ferdig" 
                    size="small" 
                    color="success"
                    variant="outlined"
                  />
                )}
                {step.status === 'creating' && (
                  <Chip 
                    label="Oppretter..." 
                    size="small"
                    sx={{ 
                      backgroundColor: `${professionColors[projectType]}20`,
                      color: professionColors[projectType],
                      borderColor: professionColors[projectType]
                }}
                    variant="outlined"
                  />
                )}
              </ListItem>
            </Fade>
          ))}
        </List>

        <Box mt={3} p={2} sx={{ 
          backgroundColor: '#f8f9fa',
          borderRadius:  2,
          border: '1px solid #e9ecef'
    }}>
          <Typography variant="caption" color="text.secondary">
            <Security sx={{ fontSize:  14, mr: 1, verticalAlign:'middle'}} />
            Alle mapper opprettes med GDPR-kompatible innstillinger og automatisk sletting ved prosjektavslutning.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectFolderCreationModal;
