/**
 * Tutorial Duplicate Checker - Sjekker om det allerede finnes tutorials for samme emne
 */

import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import {
  Alert,
  Box,
  Button,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as ExistsIcon,
  VideoLibrary as VideoIcon,
  PhotoLibrary as PhotoIcon,
  Quiz as FAQIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';

interface ExistingTutorial {
  id: string;
  title: string;
  type: 'video' | 'mixed';
  rating: number;
  views: number;
  publishedAt: string;
  url?: string
}

interface TutorialDuplicateCheckerProps {
  targetUrl: string;
  targetTitle?: string;
  onProceedAnyway?: () => void;
  onViewExisting?: (tutorial: ExistingTutorial) => void
}

export const TutorialDuplicateChecker: React.FC<TutorialDuplicateCheckerProps> = (
  // Theming system
  const theming = useTheming('photographer');{
  targetUl,
  targetTitle,
  onProceedAnyway,
  onViewExisting
}) => {
  // Simuler eksisterende tutorials basert på URL/tittel
  const checkForExistingTutorials = (): ExistingTutorial[] => {
    const existingTutorials: ExistingTutorial[] = [
      {
        id: 'tutorial_',
        title: 'ProjectCreationWithMemoryCards Tutorial',
        type: 'video',
        rating: 4.8,
        views: 32,
        publishedAt: '2025-01-28T21:30:00',
        url: '/project-creation'
  },
      {
        id: 'tutorial_', 
        title: 'Screenshot Analysis Guide',
        type: 'mixed',
        rating: 4.5,
        views: 16,
        publishedAt: '2025-01-28T20:45:00',
        url: '/screenshot-analysis'
  }
    ];

    // Sjekk URL-match eller tittel-likhet
    return existingTutorials.filter(tutorial => {
      const urlMatch = tutorial.url && targetUrl.includes(tutorial.url);
      const titleMatch = targetTitle && tutorial.title.toLowerCase().includes(targetTitle.toLowerCase());
      return urlMatch || titleMatch;
  });
};

  const existingTutorials = checkForExistingTutorials();
  const hasExistingTutorials = existingTutorials.length > 0;

  if (!hasExistingTutorials) {
    return (
      <Alert severity="success" sx={{ mb:  2 }}>
        ✅ <strong>Ingen eksisterende tutorials funnet!</strong> Du kan trygt lage en ny veiledning for dette emnet.
      </Alert>
    );
}

  return (
    <Box sx={{ mb:  3 }}>
      {/* Warning Alert */}
      <Alert 
        severity="warning" 
        sx={{ 
          mb:  2,
          bgcolor: 'rgba(25,152,0,0.1)',
          border: '1px solid rgba(25,152,0,0.3)'
      }}
        icon={<WarningIcon />}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb:  1 }}>
            🚫 Eksisterende Tutorials Funnet
          </Typography>
          <Typography variant="body2" sx={{ mb:  2 }}>
            Det finnes allerede {existingTutorials.length} veiledning(er) for dette emnet i FAQ-systemet. 
            For å unngå duplikater og sikre unikt innhold, kan du ikke lage en ny veiledning for samme emne.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            💡 <strong>Forslag: </strong> Se på eksisterende tutorials nedenfor, eller velg et annet emne som ikke har veiledninger enda.
          </Typography>
        </Box>
      </Alert>

      {/* Existing Tutorials List */}
      <Card sx={{ bgcolor: 'rgba(25,255,255,0.95)' ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
            <FAQIcon color="primary" />
            Eksisterende Tutorials for Dette Emnet
          </Typography>
          
          <List dense>
            {existingTutorials.map((tutorial) => (
              <ListItem 
                key={tutorial.id}
                sx={{ 
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius:  1,
                  mb:  1,
                  bgcolor: 'rgba(28,250,252,0.8)'
              }}
              >
                <ListItemIcon>
                  {tutorial.type === 'video' ? 
                    <VideoIcon color="primary" /> : 
                    <PhotoIcon color="secondary" />
                }
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {tutorial.title}
                      </Typography>
                      <Chip 
                        label={tutorial.type === 'video' ? '🎥 Video' : '📸 Mixed'}
                        size="small" 
                        color={tutorial.type === 'video' ? 'primary' : 'secondary'}
                      />
                      <Chip 
                        label={`⭐ ${tutorial.rating}`}
                        size="small" 
                        color="success"
                      />
                    </Box>
                }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      👀 {tutorial.views} visninger • Publisert {new Date(tutorial.publishedAt).toLocaleDateString('no-NO')}
                    </Typography>
                }
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ViewIcon />}
                  onClick={() => onViewExisting?.(tutorial)}
                  sx={{ ml:  1 }}
                >
                  Se Tutorial
                </Button>
              </ListItem>
            ))}
          </List>

          {/* Action Buttons */}
          <Box sx={{ mt:  3, display: 'flex', gap: 2, justifyContent: 'center'}}>
            <Button
              variant="outlined"
              color="info"
              onClick={() => window.history.back()}
            >
              ← Tilbake til Forrige Side
            </Button>
            <Button variant="contained"
              color="primary"
              onClick={() => {
                // Redirect til FAQ system
                console.log('Redirecting to FAQ system...');
            }}
            >
              📚 Se FAQ-System
            </Button>
          </Box>

          {/* CreatorHub Norge Message */}
          <Box sx={{ mt:  3, p: 2, bgcolor: 'rgba(5,118,210,0.1)', borderRadius:  1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic'}}>
              🙏 <strong>CreatorHub Norge setter stor pris på din trang til å bidra!</strong> 
              <br />
              Ved å unngå duplikater sikrer vi at alle tutorials er unike og verdifulle for fellesskapet.
              <br />
              💡 Finn andre emner som trenger veiledninger, så kan du tjene CreatorHub Verified badges!
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};