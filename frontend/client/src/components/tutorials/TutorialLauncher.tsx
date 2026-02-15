import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Card as MuiCard,
  CardContent,
  Button,
  Grid,
  Avatar,
  Chip,
  Alert
} from '@mui/material';
import {
  School,
  Close,
  Help,
  PlayArrow,
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Business
} from '@mui/icons-material';
import UniversalTutorialSystem from './UniversalTutorialSystem';

interface TutorialLauncherProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  // Integration props
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  userId?: string
}

const TutorialLauncher: React.FC<TutorialLauncherProps> = ({ 
  profession,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect,
  userId
}) => {
  const [showLauncher, setShowLauncher] = useState(false);
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession);
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  const [showFullTutorials, setShowFullTutorials] = useState(false);

  const professionColors = {
    photographer: '#2196F0',
    videographer: '#9C27B0', 
    music_producer: '#FF5720',
    vendor: '#4CAF50'
};

  const professionIcons = {
    photographer: theming.getThemedIcon(''),
    videographer: theming.getThemedIcon(''),
    music_producer: theming.getThemedIcon(''),
    vendor: theming.getThemedIcon(', ')
};

  // professionNames is now handled by getProfessionDisplayName from useDynamicProfessions

  const professionColor = professionColors[profession];

  // Quick start tutorials specific to each profession
  const quickStartTutorials = [
    {
      id: 'dashboard-overview',
      title: 'Dashboard Oversikt',
      description: 'Lær å navigere i hovedgrensesnittet',
      duration: '5 min',
      icon: theming.getThemedIcon(', '),
      action: () => console.log('Starting dashboard tutorial')
},
    {
      id: 'first-project',
      title: 'Første Prosjekt',
      description: 'Opprett ditt første prosjekt',
      duration: '10 min',
      icon: professionIcons[profession],
      action: () => console.log('Starting project tutorial')
},
    {
      id: 'google-drive',
      title: 'Google Drive Setup',
      description: 'Koble til Google Drive',
      duration: '7 min',
      icon: <Help />,
      action: () => console.log('Starting Google Drive tutorial')
}
  ];

  return (
    <>
      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="tutorials"
        onClick={() => setShowLauncher(true)}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          bgcolor: professionColor,
          '&:hover': {
            bgcolor: professionColor,
            opacity: 0.9,
          },
          zIndex: 1000,
        }}
      >
        <Help />
      </Fab>

      {/* Quick Start Launcher Dialog */}
      <Dialog 
        open={showLauncher}
        onClose={() => setShowLauncher(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              <Avatar sx={{ bgcolor: professionColor }}>
                {professionIcons[profession]}
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Veiledninger for {getProfessionDisplayName(profession)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Kom i gang raskt eller utforsk alle funksjoner
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setShowLauncher(false)}>
              {theming.getThemedIcon('close')}
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Alert severity="success" sx={{ mb:  3 }}>
            <Typography variant="subtitle2" sx={{ mb:  1 }}>
              🎯 Velkommen til CreatorHub Norge!
            </Typography>
            <Typography variant="body2">
              Start med en kjapp-guide eller gå direkte til komplette veiledninger for alle funksjoner.
            </Typography>
          </Alert>

          <Typography variant="h6" sx={{  mb:  2  }}>
            Kom i Gang Raskt
          </Typography>

          <Grid container spacing={2} sx={{ mb:  3 }}>
            {quickStartTutorials.map((tutorial) => (
              <Grid size={{ xs: 12 }} md={4} key={tutorial.id}>
                <MuiCard sx={{ 
                  height: '100%',
                  cursor: 'pointer', '&:hover': { boxShadow:  4 },
                  border: `1px solid ${professionColor}20`
              }}>
                  <CardContent sx={{ textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                    <Avatar sx={{ 
                      bgcolor: professionColor,
                      mx: 'auto',
                      mb: 2 }}>
                      {tutorial.icon}
                    </Avatar>
                    <Typography variant="h6" sx={{  mb: 1, fontSize: '1rem'  }}>
                      {tutorial.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                      {tutorial.description}
                    </Typography>
                    <Chip 
                      label={tutorial.duration}
                      size="small" 
                      variant="outlined" 
                      sx={{ mb:  2 }}
                    />
                    <Button variant="contained"
                      fullWidth
                      startIcon={theming.getThemedIcon('play')}
                      onClick={tutorial.action}
                      sx={{ bgcolor: professionColor }}
                     sx={theming.getThemedButtonSx()}>
                      Start
                    </Button>
                  </CardContent>
                </MuiCard>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ textAlign: 'center', pt: 2, borderTop: '1px solid #e0e0e0' }}>
            <Typography variant="h6" sx={{  mb:  2  }}>
              Eller Utforsk Alle Funksjoner
            </Typography>
            <Button
              variant="outlined"
              size="large"
              startIcon={theming.getThemedIcon('school')}
              onClick={() => {
                setShowLauncher(false);
                setShowFullTutorials(true);
            }}
              sx={{ 
                borderColor: professionColor,
                color: professionColor,
                minWidth: 200 }}
            >
              Se Alle Veiledninger
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Full Tutorial System */}
      {showFullTutorials && (
        <UniversalTutorialSystem
          profession={profession}
          onClose={() => setShowFullTutorials(false)}
        />
      )}
    </>
  );
};

export default TutorialLauncher;