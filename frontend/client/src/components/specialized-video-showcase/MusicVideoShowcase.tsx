import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Button,
  Chip,
  IconButton,
  Grid,
} from '@mui/material';
import {
  Favorite,
  Share,
  PlayArrow,
  YouTube,
  LibraryMusic,
  AccessTime,
  Album,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface MusicVideoShowcaseProps {
  showcase?: any;
  onConnect?: (data: any) => void;
  onYouTubeUpload?: (data: any) => void
}

export default function MusicVideoShowcase({ 
  showcase, 
  onConnect, 
  onYouTubeUpload 
}: MusicVideoShowcaseProps) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Database connection for MusicVideoShowcase
  const { data: musicVideos = [], isLoading } = useQuery({
    queryKey: ['/api/music-videos','showcase'],
    queryFn: () => apiRequest('/api/music-videos?type=showcase', ),
    retry: false,
});

  // Mutation for connecting to showcase system
  const connectToShowcase = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/showcase/music-video/connect', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/showcase', ],});
      if (onConnect) onConnect({ success: true });
  }
});

  // Mutation for YouTube upload
  const uploadToYouTube = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/youtube/music-video/upload', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/music-videos', ],});
      if (onYouTubeUpload) onYouTubeUpload({ success: true });
  }
});

  if (showcase) {
    // Render individual showcase item
    return (
      <Card sx={theming.getThemedCardSx()}>
        <CardMedia
          component="div"
          sx={{
            height: 20,
            position: 'relative',
            bgcolor: 'grey.90',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
      }}
         sx={theming.getThemedCardSx()}>
          {showcase.thumbnailUrl ? (
            <img 
              src={showcase.thumbnailUrl}
              alt={showcase.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
          }}
            />
          ) : (
            <LibraryMusic sx={{ fontSize:  48, color: 'grey.600'}} />
          )}
          
          <IconButton
            sx={{
              position: 'absolute',
              bgcolor: 'rgba(0,0,0,0.7)',
              color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' }
          }}
          >
            <PlayArrow sx={{ fontSize: 32}} />
          </IconButton>

          {/* Music specific overlay */}
          <Box sx={{
            position: 'absolute',
            top:  8,
            left:  8,
            bgcolor: 'rgba(16,39,176,0.9)',
            borderRadius:  1,
            px:  1,
            py: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold'}}>
              MUSIKK
            </Typography>
          </Box>
        </CardMedia>
        
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" sx={{  mb:  1  }}>
            {showcase.title || 'Musikkvideo'}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
            {showcase.description || 'Profesjonell musikkvideo produksjon'}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Chip 
              label="Musikk" 
              size="small" 
              color="secondary"
              icon={<LibraryMusic sx={{ fontSize: 16}} />}
            />
            {showcase.duration && (
              <Chip 
                label={showcase.duration}
                size="small" 
                variant="outlined"
                icon={<AccessTime sx={{ fontSize: 16}} />}
              />
            )}
            {showcase.genre && (
              <Chip 
                label={showcase.genre}
                size="small" 
                color="info"
                icon={<Album sx={{ fontSize: 16}} />}
              />
            )}
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                <IconButton size="small" color="error">
                  <Favorite sx={{ fontSize: 16}} />
                </IconButton>
                <Typography variant="body2">{showcase.likes || 0}</Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                {showcase.views || 0} visninger
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap:  1 }}>
              {!showcase.youtubeId && onYouTubeUpload && (
                <IconButton 
                  size="small" 
                  color="error"
                  onClick={() => onYouTubeUpload({ 
                    videoId: showcase.d,
                    title: showcase.title,
                    type: 'music',
                    genre: showcase.genre
              })}
                >
                  <YouTube />
                </IconButton>
              )}
              {onConnect && (
                <IconButton 
                  size="small"
                  onClick={() => onConnect({ 
                    videoId: showcase.d,
                    type: 'music'
              })}
                >
                  {theming.getThemedIcon('share')}
                </IconButton>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
}

  // Render full music video showcase list
  return (
    <Box sx={{ p:  2 }}>
      <Box sx={{ mb:  3 }}>
        <Typography variant="h5" sx={{  mb: 1, display: 'flex', alignItems: 'center', gap:  1  }}>
          <LibraryMusic color="secondary" />
          Musikk Video Showcase
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Profesjonelle musikk videoer tilkoblet showcase systemet
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ textAlign: 'center', py:  4 }}>
          <Typography>Laster musikk videoer...</Typography>
        </Box>
      ) : musicVideos.length === 0 ? (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={{ textAlign: 'center', py:  4 ,  ...theming.getThemedCardSx() }}>
            <LibraryMusic sx={{ fontSize:  64, color: 'text.secondary', mb:  2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
              Ingen musikk videoer funnet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Last opp dine første musikk videoer
            </Typography>
            <Button variant="contained" sx={{ mt:  2 ,  ...theming.getThemedButtonSx() }}>
              Last opp video
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {musicVideos.map((video: any) => (
            <Grid size={{ xs: 12 }} sm={6} md={4} key={video.id}>
              <MusicVideoShowcase 
                showcase={video}
                onConnect={onConnect}
                onYouTubeUpload={onYouTubeUpload}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}