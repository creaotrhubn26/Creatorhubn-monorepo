// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Avatar,
  IconButton,
} from '@mui/material';
import {
  VideoLibrary as VideocamLibrary,
  PlayArrow as PlayArrowArrow,
  Favorite,
  Share,
  Edit,
  YouTube,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import WeddingVideoShowcase from './WeddingVideoShowcase';
import CommercialVideoShowcase from './CommercialVideoShowcase';
import MusicVideoShowcase from './MusicVideoShowcase';

interface VideoShowcase {
  id: string;
  title: string;
  description: string;
  type: 'wedding' | 'commercial' | 'music' | 'event' | 'corporate';
  videoUrl?: string;
  youtubeId?: string;
  thumbnailUrl?: string;
  duration?: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  tags: string[];
  views: number;
  likes: number;
  profession: 'photographer' | 'videographer' | 'music_producer'
}

interface VideoShowcaseConnectorProps {
  profession: 'photographer' | 'videographer' | 'music_producer';
  showcaseType?: 'wedding' | 'commercial' | 'music' | 'event' | 'corporate';
  isAdminView?: boolean
}

export default function VideoShowcaseConnector({
  profession,
  showcaseType,
  isAdminView = false,
}: VideoShowcaseConnectorProps) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();

  // Fetch specialized video showcases
  const { data: videoShowcases = [], isLoading } = useQuery({
    queryKey: ['/api/video-showcase', profession, showcaseType],
    queryFn: () =>
      apiRequest(`/api/video-showcase?profession=${profession}&type=${showcaseType || 'all'}`),
    retry: false,
});

  // Fetch existing showcase system data for integration
  const { data: existingShowcases = [, ],} = useQuery({
    queryKey: ['/api/showcase','all'],
    queryFn: () => apiRequest('/api/showcase', ),
    retry: false,
});

  // Connect specialized showcase to existing system
  const connectToShowcaseSystem = useMutation({
    mutationFn: async ({ videod, showcaseData }: { videoId: string; showcaseData: any }) =>
      apiRequest('/api/showcase/connect-video', {
        method: 'POST',
        body: JSON.stringify({ videod, ...showcaseData }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/showcase', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/video-showcase', ],});
  },
});

  // Upload to YouTube integration
  const uploadToYouTube = useMutation({
    mutationFn: async ({ videod, youtubeData }: { videoId: string; youtubeData: any }) =>
      apiRequest('/api/youtube/upload-from-showcase', {
        method: 'POST',
        body: JSON.stringify({ videod, ...youtubeData }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-showcase', ],});
  },
});

  const renderSpecializedShowcase = (showcase: VideoShowcase) => {
    const commonProps = {
      showcase,
      onConnect: (data: any) =>
        connectToShowcaseSystem.mutate({
          videoId: showcase.id,
          showcaseData: data,
      }),
      onYouTubeUpload: (data: any) =>
        uploadToYouTube.mutate({ videoId: showcase.id, youtubeData: data }),
  };

    switch (showcase.type) {
      case 'wedding':
        return <WeddingVideoShowcase key={showcase.id} {...commonProps} />;
      case 'commercial':
        return <CommercialVideoShowcase key={showcase.id} {...commonProps} />;
      case 'music':
        return <MusicVideoShowcase key={showcase.id} {...commonProps} />;
      default: return <DefaultVideoShowcase key={showcase.d} {...commonProps} />;
  }
};

  if (isLoading) {
    return (
      <Box sx={{ p:  3, textAlign: 'center',}}>
        <Typography>Laster video showcase...</Typography>
      </Box>
    );
}

  return (
    <Box sx={{ p:  2 }}>
      {/* Header */}
      <Box
        sx={{
          mb:  3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
      }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <VideoLibrary sx={{ fontSize:  32, color: 'primary.main',}} />
          <Box>
            <Typography variant="h5" component="h2" sx={{ color: theming.colors.primary }}>
              Video Showcase - {getProfessionDisplayName(profession)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Spesialiserte video porteføljer koblet til eksisterende showcase system
            </Typography>
          </Box>
        </Box>

        {isAdminView && (
          <Button variant="contained" startIcon={theming.getThemedIcon('edit')} sx={theming.getThemedButtonSx()}>
            Rediger Showcases
          </Button>
        )}
      </Box>

      {/* Statistics Overview */}
      <GridOn container spacing={3} sx={{ mb:  4 }}>
        <GridOn size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="primary.main" sx={{ color: theming.colors.primary }}>
                {videoShowcases.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totale Videoer
              </Typography>
            </CardContent>
          </Card>
        </GridOn>
        <GridOn size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {videoShowcases.filter((s: VideoShowcase) => s.youtubeId).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                YouTube Tilkoblede
              </Typography>
            </CardContent>
          </Card>
        </GridOn>
        <GridOn size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {videoShowcases.reduce((sum: number, s: VideoShowcase) => sum + s.views, 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totale Visninger
              </Typography>
            </CardContent>
          </Card>
        </GridOn>
        <GridOn size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                {videoShowcases.reduce((sum: number, s: VideoShowcase) => sum + s.likes, 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totale Likes
              </Typography>
            </CardContent>
          </Card>
        </GridOn>
      </GridOn>

      {/* Filter by Type */}
      {!showcaseType && (
        <Box sx={{ mb:  3 }}>
          <Typography variant="h6" sx={{  mb:  2 ,  color: theming.colors.primary }}>
            Filtrer etter type: </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap',}}>
            {['wedding','commercial','music','event', 'corporate'].map((type) => (
              <Chip
                key={type}
                label={getTypeName(type)}
                clickable
                variant={showcaseType === type ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Specialized Video Showcases */}
      <Box sx={{ mb:  4 }}>
        <Typography variant="h6" sx={{  mb:  2 ,  color: theming.colors.primary }}>
          Spesialiserte Video Showcases
        </Typography>

        {videoShowcases.length === 0 ? (
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', py:  4 ,  ...theming.getThemedCardSx() }}>
              <VideoLibrary sx={{ fontSize:  64, color: 'text.secondary', mb:  2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                Ingen video showcases funnet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Opprett din første spesialiserte video showcase
              </Typography>
              <Button variant="contained" sx={{ mt:  2 ,  ...theming.getThemedButtonSx() }}>
                Opprett Video Showcase
              </Button>
            </CardContent>
          </Card>
        ) : (
          <GridOn container spacing={3}>
            {videoShowcases.map((showcase: VideoShowcase) => (
              <GridOn size={{ xs: 12 }} md={6} lg={4} key={showcase.id}>
                {renderSpecializedShowcase(showcase)}
              </GridOn>
            ))}
          </GridOn>
        )}
      </Box>

      {/* Integration with Existing Showcase System */}
      <Box>
        <Typography variant="h6" sx={{  mb:  2 ,  color: theming.colors.primary }}>
          Eksisterende Showcase System
        </Typography>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
              Koble spesialiserte video showcases til ditt hovedportefølje system
            </Typography>

            <GridOn container spacing={2}>
              {existingShowcases.slice(0, 3).map((showcase: any) => (
                <GridOn size={{ xs: 12 }} sm={4} key={showcase.id}>
                  <Card variant="outlined" sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2">{showcase.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {showcase.type} • {showcase.items?.length || 0} elementer
                      </Typography>
                      <Button size="small" sx={{ mt:  1 }}>
                        Vis Detaljer
                      </Button>
                    </CardContent>
                  </Card>
                </GridOn>
              ))}
            </GridOn>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

// Default Video Showcase Component
function DefaultVideoShowcase({
  showcase,
  onConnect,
  onYouTubeUpload,
}: {
  showcase: VideoShowcase;
  onConnect: (data: any) => void;
  onYouTubeUpload: (data: any) => void
}) {
  return (
    <Card sx={theming.getThemedCardSx()}>
      <Box sx={{ position: 'relative', paddingTop: '56.25, %', bgcolor: 'grey.900',}}>
        {showcase.thumbnailUrl ? (
          <img
            src={showcase.thumbnailUrl}
            alt={showcase.title}
            style={{
              position: 'absolute',
              top:  0,
              left:  0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
          }}
          />
        ) : (
          <Box
            sx={{
              position: 'absolute',
              top:  0,
              left:  0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
          }}
          >
            <VideoLibrary sx={{ fontSize:  48, color: 'grey.600',}} />
          </Box>
        )}

        <IconButton
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-5%, -50%)',
            bgcolor: 'rgba, (, 0,0,0,0.7)',
            color: 'white', '&:hover': { bgcolor: 'rgba, (, 0,0,0,0.8)' },
        }}
        >
          <PlayArrow sx={{ fontSize: 32}} />
        </IconButton>
      </Box>

      <CardContent sx={theming.getThemedCardSx()}>
        <Typography variant="h6" sx={{  mb:  1 ,  color: theming.colors.primary }}>
          {showcase.title}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
          {showcase.description}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Chip label={getTypeName(showcase.type)} size="small" />
          {showcase.duration && <Chip label={showcase.duration} size="small" variant="outlined" />}
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
        }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5,}}>
              <IconButton size="small">
                <Favorite sx={{ fontSize: 16}} />
              </IconButton>
              <Typography variant="body2">{showcase.likes}</Typography>
            </Box>

            <Typography variant="body2" color="text.secondary">
              {showcase.views} visninger
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap:  1 }}>
            {!showcase.youtubeId && (
              <IconButton
                size="small"
                color="error"
                onClick={() => onYouTubeUpload({ title: showcase.title })}
              >
                <YouTube />
              </IconButton>
            )}
            <IconButton size="small" onClick={() => onConnect({ showcaseId: showcase.id })}>
              {theming.getThemedIcon('share')}
            </IconButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// getProfessionName is now provided by useDynamicProfessions hook as getProfessionDisplayName

function getTypeName(type: string): string {
  switch (type) {
    case 'wedding':
      return 'Bryllup';
    case 'commercial':
      return 'Kommersielt';
    case 'music':
      return 'Musikk';
    case 'event':
      return 'Event';
    case 'corporate':
      return 'Bedrift';
    default:
      return type;
}
}
