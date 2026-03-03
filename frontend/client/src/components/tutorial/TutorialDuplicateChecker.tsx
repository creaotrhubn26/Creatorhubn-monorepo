import React, { useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle as ExistsIcon,
  PhotoLibrary as PhotoIcon,
  VideoLibrary as VideoIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

export interface ExistingTutorial {
  id: string;
  title: string;
  type: 'video' | 'mixed';
  rating: number;
  views: number;
  publishedAt: string;
  url?: string;
}

interface TutorialDuplicateCheckerProps {
  targetUrl: string;
  targetTitle?: string;
  onProceedAnyway?: () => void;
  onViewExisting?: (tutorial: ExistingTutorial) => void;
}

const MOCK_TUTORIALS: ExistingTutorial[] = [
  {
    id: 'tutorial-project-creation',
    title: 'ProjectCreationWithMemoryCards Tutorial',
    type: 'video',
    rating: 4.8,
    views: 3200,
    publishedAt: '2025-01-28T21:30:00',
    url: '/project-creation',
  },
  {
    id: 'tutorial-screenshot-analysis',
    title: 'Screenshot Analysis Guide',
    type: 'mixed',
    rating: 4.5,
    views: 1600,
    publishedAt: '2025-01-28T20:45:00',
    url: '/screenshot-analysis',
  },
];

export const TutorialDuplicateChecker: React.FC<TutorialDuplicateCheckerProps> = ({
  targetUrl,
  targetTitle,
  onProceedAnyway,
  onViewExisting,
}) => {
  const theming = useTheming('photographer');

  const existingTutorials = useMemo(() => {
    const normalizedUrl = targetUrl.toLowerCase();
    const normalizedTitle = (targetTitle || '').toLowerCase();

    return MOCK_TUTORIALS.filter((tutorial) => {
      const urlMatch = tutorial.url ? normalizedUrl.includes(tutorial.url.toLowerCase()) : false;
      const titleMatch =
        normalizedTitle.length > 0 && tutorial.title.toLowerCase().includes(normalizedTitle);
      return urlMatch || titleMatch;
    });
  }, [targetTitle, targetUrl]);

  if (existingTutorials.length === 0) {
    return (
      <Alert severity="success" sx={{ mb: 2 }}>
        Ingen eksisterende tutorials funnet. Du kan trygt publisere denne.
      </Alert>
    );
  }

  return (
    <Card sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Stack spacing={2}>
          <Alert severity="warning" icon={<WarningIcon />}>
            Vi fant {existingTutorials.length} lignende tutorial(s). Vurder å gjenbruke eller oppdatere
            eksisterende innhold.
          </Alert>

          <List dense>
            {existingTutorials.map((tutorial) => (
              <ListItem
                key={tutorial.id}
                secondaryAction={
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ViewIcon />}
                    onClick={() => onViewExisting?.(tutorial)}
                  >
                    Vis
                  </Button>
                }
              >
                <ListItemIcon>{tutorial.type === 'video' ? <VideoIcon /> : <PhotoIcon />}</ListItemIcon>
                <ListItemText
                  primary={tutorial.title}
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {tutorial.views} visninger • Rating {tutorial.rating} •{' '}
                        {new Date(tutorial.publishedAt).toLocaleDateString('no-NO')}
                      </Typography>
                    </Box>
                  }
                />
                <Chip size="small" icon={<ExistsIcon />} label="Finnes" color="warning" />
              </ListItem>
            ))}
          </List>

          <Box>
            <Button variant="contained" onClick={onProceedAnyway}>
              Publiser likevel
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default TutorialDuplicateChecker;
