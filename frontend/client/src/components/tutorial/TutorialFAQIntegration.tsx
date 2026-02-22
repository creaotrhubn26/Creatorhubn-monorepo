/**
 * Tutorial FAQ Integration - Kobler godkjente tutorials til FAQ-system
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Rating,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  IconButton,
  Badge,
} from '@mui/material';
import {
  VideoLibrary as VideoIcon,
  PhotoLibrary as PhotoIcon,
  Star as StarIcon,
  ThumbUp as ThumbUpIcon,
  PlayArrow as PlayIcon,
  Visibility as ViewIcon,
  Quiz as FAQIcon,
  CheckCircle as ApprovedIcon,
  Schedule as PendingIcon,
  Science as PrototypeIcon,
  AdminPanelSettings as AdminIcon,
  PhotoCamera as PhotographerIcon,
  Videocam as VideographerIcon,
  AudioFile as MusicProducerIcon,
  Store as VendorIcon,
  Person as UserIcon,
} from '@mui/icons-material';

import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

interface FAQTutorial {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'mixed';
  rating: number;
  views: number;
  likes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  steps: number;
  priorityScore: number;
  publishedAt: string;
  status: 'approved' | 'pending' | 'featured';
  // FORFATTER INFORMASJON - Tydelig hvem som har laget veiledningen
  author: {
    id: string;
    name: string;
    email: string;
    profession: string;
    role: 'user' | 'prototype_tester' | 'admin';
    profilePicture?: string;
};
  submittedAt: string
}

interface TutorialFAQIntegrationProps {
  open?: boolean;
  onClose?: () => void;
  profession?: string;
  userRole?: 'user' | 'prototype_tester' | 'admin';
  // Integration props for universal workflow connectivity
  userId?: string;
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

export const TutorialFAQIntegration: React.FC<TutorialFAQIntegrationProps> = ({
  open = false,
  onClose = () => {},
  profession = 'universal',
  userRole = 'user',
  userId,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect
}) => {
  // Dynamic profession helpers
  const { getProfessionDisplayName, getProfessionIcon } = useDynamicProfessions();
  
  // Theming system
  const theming = useTheming('photographer');
  const [tutorials, setTutorials] = useState<FAQTutorial[]>([
    {
      id: 'tutorial_',
      title: 'ProjectCreationWithMemoryCards Tutorial',
      description: 'Omfattende gjennomgang av prosjektopprettelse med hukommelseskort-funksjonalitet',
      type: 'video',
      rating: 4.8,
      views: 32,
      likes:  89,
      difficulty: 'intermediate',
      category: 'project-management',
      steps:  8,
      priorityScore:  95,
      publishedAt: '2025-01-28T21:30:00',
      status: 'featured',
      author: {
        id: 'user_101',
        name: 'Marie Andersen',
        email: 'marie@foto-oslo.no',
        profession: 'photographer',
        role: 'user',
        profilePicture: '/avatars/marie.jpg'
  },
      submittedAt: '2025-01-25T14:20:00Z'
},
    {
      id: 'tutorial_',
      title: 'Intelligent Screenshot Analysis Guide',
      description: 'Hvordan bruke smart screenshot-analyse med kode-feildeteksjon',
      type: 'mixed',
      rating: 4.5,
      views: 16,
      likes:  42,
      difficulty: 'advanced',
      category: 'tools',
      steps:  5,
      priorityScore:  78,
      publishedAt: '2025-01-28T20:45:00',
      status: 'approved',
      author: {
        id: 'prototype_tester_003',
        name: 'Lars Beta Testersen',
        email: 'lars.beta@prototype.test',
        profession: 'prototype_tester',
        role: 'prototype_tester',
        profilePicture: '/avatars/prototype-tester.jpg'
  },
      submittedAt: '2025-01-25T09:15:00Z'
}
  ]);

  const [selectedTutorial, setSelectedTutorial] = useState<FAQTutorial | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Profession-aware tutorial filtering and categorization
  const getProfessionSpecificCategories = () => {
    const baseCategories = ['all','project-management','tools','workflow','settings'];

    switch (profession) {
      case 'photographer':
        return [...baseCategories, 'editing','equipment','client-management','wedding-timeline'];
      case 'videographer':
        return [...baseCategories, 'editing','equipment','post-production','collaboration'];
      case 'music_producer':
        return [...baseCategories, 'audio-enhancement','mixing','mastering','rights-management'];
      case 'vendor':
        return [...baseCategories, 'inventory','e-commerce','customer-service','logistics'];
      default: // Universal categories for any new profession
        return [...baseCategories, 'industry-specific','advanced-features','integrations'];
  }
};

  const professionCategories = getProfessionSpecificCategories();

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'success';
      case 'intermediate': return 'warning';
      case 'advanced': return 'error';
      default: return 'default';
}
};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'featured': return <StarIcon color="warning" />;
      case 'approved': return <ApprovedIcon color="success" />;
      case 'pending': return <PendingIcon color="info" />;
      default: return <FAQIcon />;
}
};

  const sortedTutorials = [...tutorials].sort((a, b) => {
    // Featured first, then by priority score
    if (a.status === 'featured' && b.status !== 'featured') return -1;
    if (b.status === 'featured' && a.status !== 'featured') return 1;
    return b.priorityScore - a.priorityScore;
});

  const filteredTutorials = sortedTutorials.filter(tutorial => 
    filterCategory === 'all' || tutorial.category === filterCategory
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
        <FAQIcon color="primary" />
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Tutorial FAQ Library</Typography>
        <Badge badgeContent={tutorials.length} color="primary">
          <Chip label="Godkjente Tutorials" color="success" />
        </Badge>
      </DialogTitle>

      <DialogContent>
        {/* Filter Bar */}
        <Box sx={{ mb:  3, display: 'flex', gap: 1, flexWrap: 'wrap'}}>
          <Button
            size="small"
            variant={filterCategory === 'all' ? 'contained' : 'outlined'}
            onClick={() => setFilterCategory('all')}
          >
            Alle ({tutorials.length})
          </Button>
          <Button
            size="small"
            variant={filterCategory === 'project-management' ? 'contained' : 'outlined'}
            onClick={() => setFilterCategory('project-management')}
          >
            Prosjekt ({tutorials.filter(t => t.category === 'project-management').length})
          </Button>
          <Button
            size="small"
            variant={filterCategory === 'tools' ? 'contained' : 'outlined'}
            onClick={() => setFilterCategory('tools')}
          >
            Verktøy ({tutorials.filter(t => t.category === 'tools').length})
          </Button>
        </Box>

        {/* Tutorial Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap:  2 }}>
          {filteredTutorials.map((tutorial) => (
            <Card
              key={tutorial.id}
              sx={{
                position: 'relative', '&:hover': { transform: 'translateY(-2px)', transition: 'transform 0.2s' },
                border: tutorial.status === 'featured' ? '2px solid gold' : 'none',
                ...theming.getThemedCardSx()
              }}>
              <CardContent sx={theming.getThemedCardSx()}>
                {/* Status Badge */}
                <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                  {getStatusIcon(tutorial.status)}
                </Box>

                {/* Title & Description */}
                <Typography variant="h6" gutterBottom sx={{ pr: 4, color: theming.colors.primary }}>
                  {tutorial.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  {tutorial.description}
                </Typography>

                {/* Metadata */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap'}}>
                  <Chip
                    icon={tutorial.type === 'video' ? <VideoIcon /> : <PhotoIcon />}
                    label={tutorial.type === 'video' ? 'Video' : 'Mixed'}
                    color={tutorial.type === 'video' ? 'primary' : 'secondary'}
                    size="small"
                  />
                  <Chip
                    label={tutorial.difficulty}
                    color={getDifficultyColor(tutorial.difficulty)}
                    size="small"
                  />
                  <Chip
                    label={`${tutorial.priorityScore}% prioritet`}
                    color={tutorial.priorityScore > 80 ? 'success' : 'warning'}
                    size="small"
                  />
                </Box>

                {/* FORFATTER INFORMASJON - Tydelig hvem som har laget veiledningen */}
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1, mb: 2,
                  p: 1, bgcolor: 'rgba(0,0,0,0.04)',
                  borderRadius: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    Forfatter:
                  </Typography>
                  <Typography variant="caption" color="primary">
                    {tutorial.author.name}
                  </Typography>
                  <Chip
                    icon={
                      tutorial.author.role === 'prototype_tester' ? <PrototypeIcon sx={{ fontSize: 14}} /> :
                      tutorial.author.role === 'admin' ? <AdminIcon sx={{ fontSize: 14}} /> :
                      getProfessionIcon(tutorial.author.profession) ||
                      <UserIcon sx={{ fontSize: 14}} />
                  }
                    label={
                      tutorial.author.role === 'prototype_tester' ? 'Prototype Tester' :
                      tutorial.author.role === 'admin' ? 'Admin' :
                      getProfessionDisplayName(tutorial.author.profession) ||
                      'Bruker'
                  }
                    size="small"
                    color={tutorial.author.role === 'prototype_tester' ? 'secondary' : 'default'}
                    sx={{ fontSize: '0.65rem', height: 20}}
                  />
                </Box>

                {/* Rating & Stats */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Rating value={tutorial.rating} readOnly size="small" />
                  <Typography variant="caption">
                    {tutorial.views} visninger • {tutorial.likes} likes
                  </Typography>
                </Box>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap:  1 }}>
                  <Button size="small"
                    variant="contained"
                    startIcon={<PlayIcon />}
                    onClick={() => setSelectedTutorial(tutorial)}
                  >
                    Se Tutorial
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ViewIcon />}
                  >
                    Detaljer
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Featured Tutorial Alert */}
        {tutorials.some(t => t.status === 'featured') && (
          <Alert severity="info" sx={{ mt: 3 }}>
            ⭐ <strong>Utvalgte Tutorials: </strong> Høykvalitets tutorials med video-innhold og høy brukervurdering.
          </Alert>
        )}

        {/* Submit New Tutorial */}
        <Box sx={{ mt:  4, p: 2, bgcolor: 'background.paper', borderRadius:  1 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            📝 Bidra til FAQ
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
            Har du laget en nyttig tutorial? Send den inn for godkjenning til FAQ-biblioteket!
          </Typography>
          <Button variant="outlined" color="primary">
            Send Inn Tutorial
          </Button>
        </Box>
      </DialogContent>

      {/* Tutorial Player Dialog */}
      {selectedTutorial && (
        <Dialog
          open={Boolean(selectedTutorial)}
          onClose={() => setSelectedTutorial(null)}
          maxWidth="xl"
          fullWidth
        >
          <DialogTitle>
            {selectedTutorial.title}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mb:  2 }}>
              <Alert severity="success">
                🎥 <strong>Tutorial Player: </strong> Her ville tutorial-innholdet bli vist med interaktive kommentarer og kode-analyse.
              </Alert>
            </Box>
            
            <Typography variant="body1" sx={{ mb: 2 }}>
              {selectedTutorial.description}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip label={`${selectedTutorial.steps} steps`} />
              <Chip label={`${selectedTutorial.priorityScore}% prioritet`} color="success" />
              <Rating value={selectedTutorial.rating} readOnly />
            </Box>

            <Alert severity="info">
              💡 <strong>Tutorial Features: </strong>
              <List dense>
                <ListItem>
                  <ListItemText primary="🎥 Video-baserte tutorials prioriteres høyest" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="🔍 Automatisk kode-analyse og feildeteksjon" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="💬 Sanntids kommentarsystem" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="📊 Kvalitetsvurdering og prioritering" />
                </ListItem>
              </List>
            </Alert>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};