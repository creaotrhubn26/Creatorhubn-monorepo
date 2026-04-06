import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  IconButton,
  Grid,
  Switch,
  FormControlLabel,
  useTheme,
  alpha,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Add as AddIcon,
  PhotoLibrary as PhotoLibraryIcon,
  VideoLibrary as VideoLibraryIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  ThumbUp as ThumbUpIcon,
  Comment as CommentIcon,
  Compare as CompareIcon,
  Book as BookIcon,
  YouTube as YouTubeIcon,
  ExpandMore as ExpandMoreIcon,
  Link as LinkIcon,
  Analytics as AnalyticsIcon,
  VideoCall,
  Person,
  CheckCircle,
} from '@mui/icons-material';
import { YouTubeIntegration } from '../youtube/YouTubeIntegration';

interface ProjectShowcase {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  showcaseType: string;
  videoUrl?: string;
  youtubeVideoId?: string;
  youtubeVideoUrl?: string;
  youtubePlaylistId?: string;
  clientTestimonial?: string;
  tags: string[];
  isPublic: boolean;
  isFeatured: boolean;
  viewCount: number;
  likeCount: number;
  seoTitle?: string;
  seoDescription?: string;
  socialShares: any[];
  createdAt: string;
  updatedAt: string
}

interface ProjectShowcaseProps {
  projectId: string;
  onMeetingShare?: (showcase: ProjectShowcase, meetingData: any) => void;
  onClientAccess?: (showcase: ProjectShowcase, clientData: any) => void;
  onProjectComplete?: (showcase: ProjectShowcase) => void;
  selectedProject?: any;
  onProjectUpdate?: (project: any) => void
}

const showcaseTypes = [
  { value: 'gallery', label: 'Galleri', icon: PhotoLibraryIcon, description: 'Samling av bilder',},
  { value: 'before_after', label: 'Før/Etter', icon: CompareIcon, description: 'Sammenligning bilder',},
  { value: 'highlight', label: 'Høydepunkt', icon: StarIcon, description: 'Beste øyeblikk',},
  { value: 'story', label: 'Historie', icon: BookIcon, description: 'Fortellende sekvens',},
  { value: 'testimonial', label: 'Anbefalinger', icon: CommentIcon, description: 'Kundetilbakemeldinger',},
  { value: 'video', label: 'Video', icon: VideoLibraryIcon, description: 'Videoinnhold',},
  { value: 'youtube', label: 'YouTube', icon: YouTubeIcon, description: 'YouTube integrasjon',},
];

export const ProjectShowcase: React.FC<ProjectShowcaseProps> = ({ 
  projectId,
  onMeetingShare,
  onClientAccess,
  onProjectComplete,
  selectedProject,
  onProjectUpdate
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShowcase, setEditingShowcase] = useState<ProjectShowcase | null>(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [formData, setFormData] = useState({
    title: ',',
    description: '',
    showcaseType: 'gallery',
    videoUrl: '',
    youtubeVideoId: '',
    youtubeVideoUrl: '',
    youtubePlaylistId: '',
    clientTestimonial: '',
    tags: [] as string[],
    isPublic: false,
    isFeatured: false,
    seoTitle: '',
    seoDescription: '',
    enableDualUpload: false,
});
  const [tagInput, setTagInput] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('newest');

  // Fetch showcases
  const { data: showcases = [], isLoading } = useQuery({
    queryKey: [`/api/projects/${projectId}/showcases`],
    enabled: !!projectId,
    queryFn: async () => {
      return apiRequest(`/api/projects/${projectId}/showcases`, {
        headers: {
          'x-user-id': user?.id || 'photographer-session',
          'Authorization': `Bearer ${user?.id}`
        }
  });
  },
});

  // Create showcase mutation
  const createShowcaseMutation = useMutation({
    mutationFn: async (showcaseData: any) => {
      const response = await fetch(`/api/projects/${projectId}/showcases`, {
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
          'x-user-id': user?.id || 'photographer-session',
          'Authorization': `Bearer ${user?.id}`
        },
        body: JSON.stringify(showcaseData),
    });
      if (!response.ok) throw new Error('Failed to create showcase');
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/showcases`] });
      setDialogOpen(false);
      resetForm();
  },
});

  // Update showcase mutation
  const updateShowcaseMutation = useMutation({
    mutationFn: async ({ showcaseId, showcaseData }: { showcaseId: string; showcaseData: any }) => {
      const response = await fetch(`/api/projects/${projectId}/showcases/${showcaseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || 'photographer-session',
          'Authorization': `Bearer ${user?.id}`
        },
        body: JSON.stringify(showcaseData)
      });
      if (!response.ok) throw new Error('Failed to update showcase');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/showcases`] });
      setDialogOpen(false);
      setEditingShowcase(null);
      resetForm();
    }
  });

  // Delete showcase mutation
  const deleteShowcaseMutation = useMutation({
    mutationFn: async (showcaseId: string) => {
      const response = await fetch(`/api/projects/${projectId}/showcases/${showcaseId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': user?.id || 'photographer-session',
          'Authorization': `Bearer ${user?.id}`
        }
      });
      if (!response.ok) throw new Error('Failed to delete showcase');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/showcases`] });
    }
  });

  // Share showcase in meeting mutation
  const shareInMeetingMutation = useMutation({
    mutationFn: async (showcase: ProjectShowcase) => {
      const meetingData = {
        title: `Showcase Review: ${showcase.title}`,
        description: `Review av showcase for ${selectedProject?.title || selectedProject?.name}`,
        participants: [selectedProject?.clientEmail || 'client@example.com', ],
        type: 'showcase_review',
        projectId: projectId,
        projectName: selectedProject?.title || selectedProject?.name,
        clientName: selectedProject?.clientName,
        showcaseId: showcase.id,
        showcaseUrl: showcase.videoUrl || showcase.youtubeVideoUrl,
        notes: `Showcase: ${showcase.title}\nType: ${showcase.showcaseType}\nDescription: ${showcase.description}`
    };
      
      const response = await apiRequest('/api/google-meet/create', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(meetingData)
  });
      
      return { meeting: response, showcase };
  },
    onSuccess: (data: { meeting: any; showcase: ProjectShowcase }) => {
      // Notify parent component
      if (onMeetingShare) {
        onMeetingShare(data.showcase, data.meeting);
    }
  }
});

  // Grant client access mutation
  const grantClientAccessMutation = useMutation({
    mutationFn: async (showcase: ProjectShowcase) => {
      const clientData = {
        showcaseId: showcase.id,
        projectId: projectId,
        clientEmail: selectedProject?.clientEmail || 'client@example.com',
        clientName: selectedProject?.clientName,
        accessType: 'view',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        permissions: ['view','comment'],
        showcaseUrl: showcase.videoUrl || showcase.youtubeVideoUrl
  };
      
      const response = await apiRequest(`/api/projects/${projectId}/showcases/${showcase.id}/client-access`, {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(clientData)
  });
      
      return { access: response, showcase };
  },
    onSuccess: (data: { access: any; showcase: ProjectShowcase }) => {
      // Notify parent component
      if (onClientAccess) {
        onClientAccess(data.showcase, data.access);
    }
  }
});

  // Mark project as completed mutation
  const markProjectCompletedMutation = useMutation({
    mutationFn: async (showcase: ProjectShowcase) => {
      const projectUpdate = {
        status: 'completed',
        completedAt: new Date().toISOString(),
        showcaseId: showcase.id,
        showcaseUrl: showcase.videoUrl || showcase.youtubeVideoUrl
      };
      
      const response = await apiRequest(`/api/projects/${projectId}`, {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'PUT',
        body: JSON.stringify(projectUpdate)
  });
      
      return { project: response, showcase };
  },
    onSuccess: (data: { project: any; showcase: ProjectShowcase }) => {
      // Notify parent component
      if (onProjectComplete) {
        onProjectComplete(data.showcase);
  }
      if (onProjectUpdate) {
        onProjectUpdate(data.project);
    }
  }
});

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      showcaseType: 'gallery',
      videoUrl: '',
      youtubeVideoId: '',
      youtubeVideoUrl: '',
      youtubePlaylistId: '',
      clientTestimonial: '',
      tags:  [],
      isPublic: false,
      isFeatured: false,
      seoTitle: '',
      seoDescription: '',
      enableDualUpload: false,
  });
    setTagInput('');
};

  const handleOpenDialog = (showcase?: ProjectShowcase) => {
    if (showcase) {
      setEditingShowcase(showcase);
      setFormData({
        title: showcase.title,
        description: showcase.description ||'',
        showcaseType: showcase.showcaseType,
        videoUrl: showcase.videoUrl ||'',
        youtubeVideoId: showcase.youtubeVideoId ||'',
        youtubeVideoUrl: showcase.youtubeVideoUrl ||'',
        youtubePlaylistId: showcase.youtubePlaylistId ||'',
        clientTestimonial: showcase.clientTestimonial ||'',
        tags: showcase.tags || [],
        isPublic: showcase.isPublic,
        isFeatured: showcase.isFeatured,
        seoTitle: showcase.seoTitle ||'',
        seoDescription: showcase.seoDescription ||', ',
        enableDualUpload: false,
    });
  } else {
      resetForm();
      setEditingShowcase(null);
  }
    setDialogOpen(true);
};

  const handleViewDriveAnalytics = () => {
    console.log('View Drive Analytics clicked from ProjectShowcase');
    // Implementation for Drive Analytics viewing
};

  // Create Google Drive delivery access for clients
  const handleCreateDeliveryAccess = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/drive-delivery-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || 'photographer-session',
          'Authorization': `Bearer ${user?.id}`
        },
        body: JSON.stringify({
          projectId,
          clientEmail: selectedProject?.clientEmail,
          permissions: 'viewer',
          notifyClient: true
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Leveringslenke opprettet:', data.shareLink);
        // Optionally show success notification
      } else {
        console.error('❌ Feil ved oppretting av leveringslenke');
      }
    } catch (error) {
      console.error('❌ Feil ved oppretting av leveringslenke:', error);
    }
  };

  // View delivery analytics
  const handleViewDeliveryAnalyticsClick = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/drive-delivery-analytics`, {
        method: 'GET',
        headers: {
          'x-user-id': user?.id || 'photographer-session',
          'Authorization': `Bearer ${user?.id}`
        }
      });
      
      if (response.ok) {
        const analytics = await response.json();
        console.log('📊 Leveringsanalyse:', analytics);
        // Optionally display analytics in a dialog
      } else {
        console.error('❌ Feil ved henting av analysedata');
      }
    } catch (error) {
      console.error('❌ Feil ved henting av analysedata:', error);
    }
  };

  const handleSubmit = () => {
    const submitData = {
      ...formData,
      tags: JSON.stringify(formData.tags),
  };

    if (editingShowcase) {
      updateShowcaseMutation.mutate({
        showcaseId: editingShowcase.id,
        showcaseData: submitData,
    });
  } else {
      createShowcaseMutation.mutate(submitData);
  }
};

  const handleDelete = (showcaseId: string) => {
    setConfirmDeleteId(showcaseId);
  };

  const executeDelete = () => {
    if (!confirmDeleteId) return;
    deleteShowcaseMutation.mutate(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
    });
      setTagInput(', ');
  }
};

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove),
  });
};

  const getShowcaseTypeInfo = (type: string) => {
    return showcaseTypes.find(t => t.value === type) || showcaseTypes[0];
};

  const filterShowcasesByType = (type?: string) => {
    if (!type) return showcases;
    return showcases.filter((showcase: ProjectShowcase) => showcase.showcaseType === type);
};

  // Sort showcases
  const sortShowcases = (showcasesToSort: ProjectShowcase[]) => {
    const sorted = [...showcasesToSort];
    
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'title':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'views':
        return sorted.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
      case 'featured':
        return sorted.sort((a, b) => {
          if (a.isFeatured && !b.isFeatured) return -1;
          if (!a.isFeatured && b.isFeatured) return 1;
          return 0;
        });
      default:
        return sorted;
    }
  };

  const tabTypes = ['all', ...showcaseTypes.map(t => t.value)];
  const filteredShowcases = sortShowcases(filterShowcasesByType(currentTab === 0 ? undefined : tabTypes[currentTab]));

  if (isLoading) {
    return (
      <Box sx={{ p:  2 }}>
        <Typography>Laster visning...</Typography>
      </Box>
    );
}

  // Handle YouTube video upload callback
  const handleYouTubeVideoUploaded = (video: any) => {
    // Auto-create showcase for uploaded video
    const videoShowcase = {
      title: video.title,
      description: video.description || `YouTube video fra prosjekt ${projectId}`,
      showcaseType: 'youtube',
      youtubeVideoId: video.id,
      youtubeVideoUrl: video.url,
      tags:  [],
      isPublic: video.status === 'public',
      isFeatured: false,
      seoTitle: video.title,
      seoDescription: video.description,
  };
    
    createShowcaseMutation.mutate(videoShowcase);
};

  // Handle dual upload (YouTube + Google Drive delivery folder)
  const handleDualVideoUpload = async (video: any) => {
    try {
      // 1. Create showcase for YouTube video
      handleYouTubeVideoUploaded(video);

      // 2. Upload to delivery folder if dual upload is enabled
      if (formData.enableDualUpload) {
        const deliveryUploadResponse = await fetch(`/api/projects/${projectId}/drive-video-delivery`, {
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': 'photographer-session'
          },
          method: 'POST',
          body: JSON.stringify({
            youtubeVideoId: video.id,
            youtubeVideoUrl: video.url,
            videoTitle: video.title,
            videoDescription: video.description,
            projectId: projectId
          })
        });

        if (deliveryUploadResponse.ok) {
          const deliveryData = await deliveryUploadResponse.json();
          console.log('📁 Video lastet opp til leveringsmappe: ', deliveryData.deliveryPath);
      }
    }
  } catch (error) {
      console.error('Feil ved levering til mappestruktur:', error);
  }
};

  const handleYouTubePlaylistCreated = (playlist: any) => {
    // Optional: Create showcase for playlist
    console.log('YouTube playlist created, :', playlist);
};

  // Google Drive integration functions
  const handleCreateDriveShareLink = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/drive-share-link`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'photographer-session'
        },
        method: 'POST',
        body: JSON.stringify({
          projectId,
          type: 'download',
          permissions: 'viewer'
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Copy link to clipboard
        navigator.clipboard.writeText(data.shareLink);
        console.log('Google Drive delingslenke opprettet og kopiert');
    }
  } catch (error) {
      console.error('Feil ved oppretting av delingslenke:', error);
  }
};

  return (
    <Box sx={{ width: '100%'}}>
      {/* File Management Integration */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        {/* Dual Upload Integration for Admin */}
        <Accordion sx={{ flex:  1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              <YouTubeIcon sx={{ color: '#FF0000'}} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Dobbel Opplasting</Typography>
              <Chip label="Admin: YouTube + Google Drive" size="small" color="primary" />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
              <Box sx={{ 
                p: 2, border: '1px solid #FF0000', 
                borderRadius: 1
               , bgcolor: alpha('#FF0000', 0.05) 
            }}>
                <Typography variant="subtitle2" gutterBottom sx={{ color: '#FF0000'}}>
                  🎥 Simultane opplastinger
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  Last opp videoer til både YouTube og Google Drive samtidig
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.enableDualUpload || false}
                      onChange={(e) => setFormData({ ...formData, enableDualUpload: e.target.checked })}
                    />
                }
                  label="Aktiver dobbel opplasting (YouTube + Drive)"
                />
              </Box>
              
              <YouTubeIntegration 
                projectId={projectId}
                userId={user?.id || userId}
                onVideoUploaded={handleDualVideoUpload}
                onPlaylistCreated={handleYouTubePlaylistCreated}
                compact
                createShowcaseOnUpload={false}
              />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Google Drive Integration for Client Download */}
        <Accordion sx={{ flex:  1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              <LinkIcon sx={{ color: theme.palette.primary.main }} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Google Drive Nedlasting</Typography>
              <Chip label="Kunde: Last ned filer" size="small" color="secondary" />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
              <Typography variant="body2" color="text.secondary">
                Opprett nedlastingslenker for kunder til prosjektfiler på Google Drive
              </Typography>
              <Box sx={{ display: 'flex', gap:  2 }}>
                <Button
                  variant="outlined"
                  startIcon={<LinkIcon />}
                  onClick={() => handleCreateDeliveryAccess()}
                  sx={{ color: theme.palette.primary.main, borderColor: theme.palette.primary.main }}
                >
                  Opprett leveringslenke
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AnalyticsIcon />}
                  onClick={() => handleViewDeliveryAnalyticsClick()}
                  color="secondary"
                >
                  Vis leveringsstatistikk
                </Button>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3, gap: 2 }}>
        <Typography variant="h6" sx={{  color: theme.palette.primary.main, fontWeight: 600}}>
          🏆 Prosjekt Visning
        </Typography>
        
        {/* Sorting Select */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="showcase-sort-label">Sorter etter</InputLabel>
            <Select
              labelId="showcase-sort-label"
              id="showcase-sort-select"
              value={sortBy}
              label="Sorter etter"
              onChange={(e) => setSortBy(e.target.value)}
            >
              <MenuItem value="newest">Nyeste først</MenuItem>
              <MenuItem value="oldest">Eldste først</MenuItem>
              <MenuItem value="title">Tittel A-Å</MenuItem>
              <MenuItem value="views">Flest visninger</MenuItem>
              <MenuItem value="featured">Fremhevet</MenuItem>
            </Select>
          </FormControl>
          
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
              boxShadow: '0 4px 15px rgba(5, 118, 210, 0.3)'}}
          >
            Ny visning
          </Button>
        </Box>
      </Box>

      {/* Filter Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
          <Tab label="Alle" />
          {showcaseTypes.map((type) => (
            <Tab key={type.value} label={`${type.icon} ${type.label}`} />
          ))}
        </Tabs>
      </Box>

      {filteredShowcases.length === 0 ? (
        <Paper sx={{ p:  4, textAlign: 'center', bgcolor: alpha(theme.palette.primary.main, 0.05) ,  ...theming.getThemedCardSx() }}>
          <PhotoLibraryIcon sx={{ fontSize:  48, color: theme.palette.text.secondary, mb:  2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom sx={{ color: theming.colors.primary }}>
            {currentTab === 0 ? 'Ingen visninger lagt til enda' : `Ingen ${showcaseTypes[currentTab - 1]?.label.toLowerCase()} visninger`}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
            {currentTab === 0 
              ? 'Start med å lage din første prosjektvisning for å dele med kunder'
              : `Lag en ${showcaseTypes[currentTab - 1]?.label.toLowerCase()} visning for dette prosjektet`
          }
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Lag første visning
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredShowcases.map((showcase: ProjectShowcase) => {
            const typeInfo = getShowcaseTypeInfo(showcase.showcaseType);

            return (
              <Grid xs={12} md={6} lg={4} key={showcase.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    position: 'relative',
                    '&:hover': {
                      boxShadow: theme.shadows[4],
                      transform: 'translateY(-2px)'
                    },
                    transition: 'all 0.3s ease-in-out',
                    ...theming.getThemedCardSx()
                  }}>
                  {showcase.isFeatured && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top:  8,
                        right:  8,
                        zIndex: 1,
                        bgcolor: '#ffd700',
                        color: '#00',
                        borderRadius: '50%',
                        width:  32,
                        height:  32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'}}
                    >
                      <StarIcon fontSize="small" />
                    </Box>
                  )}

                  {showcase.showcaseType === 'youtube' && showcase.youtubeVideoId ? (
                    <CardMedia
                      component="iframe"
                      src={`https://www.youtube.com/embed/${showcase.youtubeVideoId}`}
                      title={showcase.title}
                      sx={{
                        height: 200,
                        border: 'none',
                        ...theming.getThemedCardSx()
                      }}
                    />
                  ) : showcase.showcaseType === 'video' && showcase.videoUrl ? (
                    <CardMedia
                      component="div"
                      sx={{
                        height: 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        ...theming.getThemedCardSx()
                      }}>
                      <VideoLibraryIcon sx={{ fontSize: 48, color: theme.palette.primary.main }} />
                    </CardMedia>
                  ) : (
                    <CardMedia
                      component="div"
                      sx={{
                        height: 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        ...theming.getThemedCardSx()
                      }}>
                      <Box sx={{ textAlign: 'center' }}>
                        {React.createElement(typeInfo.icon, { style: { fontSize: '48px' } })}
                      </Box>
                    </CardMedia>
                  )}

                  <CardContent sx={{ flexGrow:  1 ,  ...theming.getThemedCardSx() }}>
                    <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                      {showcase.title}
                    </Typography>

                    {showcase.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                        {showcase.description}
                      </Typography>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb:  2 }}>
                      <Chip
                        label={typeInfo.label}
                        size="small"
                        sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}
                      />
                      {showcase.isPublic ? (
                        <Chip label="Offentlig" size="small" color="success" icon={<VisibilityIcon />} />
                      ) : (
                        <Chip label="Privat" size="small" color="default" icon={<VisibilityOffIcon />} />
                      )}
                    </Box>

                    {showcase.tags && showcase.tags.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0,flexWrap: 'wrap', mb:  2 }}>
                        {showcase.tags.map((tag, index) => (
                          <Chip key={index} label={tag} size="small" variant="outlined" />
                        ))}
                      </Box>
                    )}

                    {showcase.clientTestimonial && (
                      <Box sx={{ 
                        p: 2, bgcolor: alpha(theme.palette.success.main, 0.05), 
                        borderRadius:  1,
                        borderLeft: `4px solid ${theme.palette.success.main}`,
                        mb: 2 }}>
                        <Typography variant="body2" sx={{ fontStyle: 'italic'}}>
                          "{showcase.clientTestimonial}"
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt:  2 }}>
                      <Box sx={{ display: 'flex', gap: 2, color: 'text.secondary'}}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                          <VisibilityIcon fontSize="small" />
                          <Typography variant="caption">{showcase.viewCount}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                          <ThumbUpIcon fontSize="small" />
                          <Typography variant="caption">{showcase.likeCount}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 ,  ...theming.getThemedCardSx() }}>
                    <Box>
                      <IconButton 
                        size="small" 
                        onClick={() => shareInMeetingMutation.mutate(showcase)}
                        disabled={shareInMeetingMutation.isPending}
                        sx={{ color: '#2196f3'}}
                        title="Del i møte"
                      >
                        <VideoCall />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => grantClientAccessMutation.mutate(showcase)}
                        disabled={grantClientAccessMutation.isPending}
                        sx={{ color: '#4caf50'}}
                        title="Gi klient tilgang"
                      >
                        <Person />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => markProjectCompletedMutation.mutate(showcase)}
                        disabled={markProjectCompletedMutation.isPending}
                        sx={{ color: '#ff9800'}}
                        title="Merk prosjekt som fullført"
                      >
                        <CheckCircle />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleOpenDialog(showcase)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(showcase.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <Box>
                      <IconButton size="small">
                        <ShareIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color={showcase.isFeatured ? 'primary' : 'default'}
                      >
                        {showcase.isFeatured ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                    </Box>
                  </CardActions>
                </Card>
              </Grid>
            );
        })}
        </Grid>
      )}

      {/* Add/Edit Showcase Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingShowcase ? 'Rediger visning' : 'Lag ny visning'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Tittel"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
            />
            
            <TextField
              select
              label="Type visning"
              value={formData.showcaseType}
              onChange={(e) => setFormData({ ...formData, showcaseType: e.target.value })}
              fullWidth
              helperText="Velg type visning for best organisering"
            >
              {showcaseTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                    {React.createElement(type.icon)}
                    <Box>
                      <Typography variant="body2">{type.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {type.description}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Beskrivelse"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
              helperText="Beskriv innholdet i visningen"
            />

            {formData.showcaseType === 'video' && (
              <TextField
                label="Video URL"
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                fullWidth
                helperText="Link til YouTube, Vimeo eller annen videoplatform"
              />
            )}

            {formData.showcaseType === 'youtube' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                <TextField
                  label="YouTube Video ID"
                  value={formData.youtubeVideoId}
                  onChange={(e) => setFormData({ ...formData, youtubeVideoId: e.target.value })}
                  fullWidth
                  helperText="Video ID fra YouTube URL (f.eks. dQw4w9WgXcQ)"
                />
                <TextField
                  label="YouTube Video URL"
                  value={formData.youtubeVideoUrl}
                  onChange={(e) => setFormData({ ...formData, youtubeVideoUrl: e.target.value })}
                  fullWidth
                  helperText="Full YouTube URL"
                />
                <TextField
                  label="YouTube Playlist ID"
                  value={formData.youtubePlaylistId}
                  onChange={(e) => setFormData({ ...formData, youtubePlaylistId: e.target.value })}
                  fullWidth
                  helperText="Valgfritt: Playlist ID hvis videoen er del av en spilleliste"
                />
              </Box>
           )}

            {formData.showcaseType === 'testimonial' && (
              <TextField
                label="Kundetilbakemelding"
                value={formData.clientTestimonial}
                onChange={(e) => setFormData({ ...formData, clientTestimonial: e.target.value })}
                fullWidth
                multiline
                rows={3}
                helperText="Positive tilbakemeldinger fra kunden"
              />
            )}

            {/* Google Drive Download Section */}
            <Box sx={{ 
              p: 2, border: '1px solid theme.palette.primary.main', 
              borderRadius: 1
             , bgcolor: alpha(theme.palette.primary.main, 0.05) 
          }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: theme.palette.primary.main }}>
                📁 Google Drive Kundenedlasting
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                Opprett delingslenker for kunder til prosjektfiler
              </Typography>
              <Box sx={{ display: 'flex', gap:  1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LinkIcon />}
                  onClick={handleCreateDriveShareLink}
                  sx={{ color: theme.palette.primary.main, borderColor: theme.palette.primary.main }}
                >
                  Opprett delingslenke
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AnalyticsIcon />}
                  onClick={handleViewDriveAnalytics}
                  color="secondary"
                >
                  Vis statistikk
                </Button>
              </Box>
            </Box>

            {/* Tags */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Tags</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap'}}>
                {formData.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => handleRemoveTag(tag)}
                    size="small"
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap:  1 }}>
                <TextField
                  label="Legg til tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  size="small"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                  }
                }}
                />
                <Button onClick={handleAddTag} disabled={!tagInput.trim()}>
                  Legg til
                </Button>
              </Box>
            </Box>

            {/* Visibility & SEO Settings */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  />
              }
                label="Offentlig synlig"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                  />
              }
                label="Fremhev denne visningen"
              />
            </Box>

            {formData.isPublic && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                <TextField
                  label="SEO Tittel"
                  value={formData.seoTitle}
                  onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
                  fullWidth
                  helperText="Optimalisert tittel for søkemotorer"
                />
                <TextField
                  label="SEO Beskrivelse"
                  value={formData.seoDescription}
                  onChange={(e) => setFormData({ ...formData, seoDescription: e.target.value })}
                  fullWidth
                  multiline
                  rows={2}
                  helperText="Kort beskrivelse som vises i søkeresultater"
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSubmit}
            variant="contained"
            disabled={!formData.title || createShowcaseMutation.isPending || updateShowcaseMutation.isPending}
           sx={theming.getThemedButtonSx()}>
            {editingShowcase ? 'Oppdater' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)}>
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Typography>Er du sikker på at du vil slette denne visningen? Denne handlingen kan ikke angres.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>Avbryt</Button>
          <Button onClick={executeDelete} color="error" variant="contained">Slett</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectShowcase;
