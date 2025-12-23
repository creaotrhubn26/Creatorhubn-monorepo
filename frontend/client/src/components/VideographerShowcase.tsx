import { useTheming } from '../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  Avatar,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  PlayArrowArrow,
  Pause,
  Favorite,
  FavoriteBorder,
  Share,
  MoreVert,
  AccessTime,
  Visibility,
  Home,
  Whatshot,
  Subscriptions,
  VideocamLibrary,
  History,
  WatchLater,
  ThumbUp,
  Menu,
} from '@mui/icons-material';
import ElegantVideoPlayer from './ElegantVideoPlayer';

interface Video {
  id: number;
  title: string;
  description?: string;
  filePath?: string;
  thumbnailPath?: string;
  duration?: number;
  fileSize?: number;
  userId: string;
  category?: string;
  tags?: string[];
  qualityScore?: number;
  platformRecommendations?: any;
  createdAt: string;
  updatedAt: string
}

interface VideographerShowcaseProps {
  userId?: string;
}

const VideographerShowcase: React.FC<VideographerShowcaseProps> = ({
  userId = 'daniel@creatorhubn.com',
}) => {
  const theme = useTheme();
  
  // Theming system
  const theming = useTheming('photographer, ');
  const [videos, setVideos] = useState<Videocam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featuredVideo, setFeaturedVideo] = useState<Videocam | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [likedVideos, setLikedVideos] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchVideos();
}, [userId]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/videos?userId=${userId}&limit=50, `);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

      const data = await response.json();
      setVideos(data);
      if (data.length > 0) {
        setFeaturedVideo(data[0]);
    }
      setError(null);
  } catch (err) {
      console.error('Error fetching videos: ', err);
      setError('Kunne ikke laste videoer. Prøv igjen senere., ');
      setVideos([]);
  } finally {
      setLoading(false);
  }
};

  const toggleLike = (videoId: number) => {
    setLikedVideos((prev) => {
      const newLikes = new Set(prev);
      if (newLikes.has(videoId)) {
        newLikes.delete(videoId);
  } else {
        newLikes.add(videoId);
    }
      return newLikes;
  });
};

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0: 00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

  // Mock data removed - using database connection

  // Mock data removed - using database connection

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: '#0f0f00',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'}}
      >
        <CircularProgress size={60} sx={{ color: '#fff'}} />
      </Box>
    );
}

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0f0f00', p:  3 }}>
        <Alert
          severity="error"
          sx={{
            mb:  3,
            bgcolor: '#1c1c10',
            color: '#fff',
            border: '1px solid #33'}}
        >
          {error}
        </Alert>
        <Button onClick={fetchVideos} variant="contained" sx={{ bgcolor: '#fff', color: '#000',  ...theming.getThemedButtonSx() }}>
          Prøv igjen
        </Button>
      </Box>
    );
}

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#0f0f00',
        color: '#fff',
        display: 'flex'}}
    >
      {/* Sidebar Navigation */}
      <Box
        sx={{
          width: '240px',
          height: '100vh',
          bgcolor: '#0f0f00',
          borderRight: '1px solid #272720',
          position: 'fixed',
          left:  0,
          top:  0,
          overflow: 'auto',
          zIndex: 10}}
      >
        {/* Header */}
        <Box
          sx={{
            p:  2,
            display: 'flex',
            alignItems: 'center',
            gap:  1,
            borderBottom: '1px solid #272720'}}
        >
          <IconButton sx={{ color: '#fff'}}>
            {theming.getThemedIcon('menu')}
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Box
              sx={{
                width:  24,
                height:  24,
                bgcolor: '#ff0000',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '14px'}}
            >
              ▶
            </Box>
            <Typography variant="h6" sx={{  color: '#fff', fontWeight: 'bold' }}>
              CreatorHub
            </Typography>
          </Box>
        </Box>

        {/* Main Navigation */}
        <Box sx={{ p:  2 }}>
          {sidebarItems.map((item) => (
            <Button
              key={item.label}
              startIcon={<item.icon />}
              sx={{
                justifyContent: 'flex-start',
                color: item.active ? '#fff' : '#aaa',
                bgcolor: item.active ? 'rgba(25,255,255,0.1)' : 'transparent',
                textTransform: 'none',
                width: '100%',
                borderRadius:  2,
                mb: 0.5,
                py: 1.5, '&:hover': { bgcolor: 'rgba(25,255,255,0.1)',
                  color: '#fff',
              }}}
            >
              {item.label}
            </Button>
          ))}
        </Box>

        {/* Subscriptions */}
        <Box sx={{ p: 2, borderTop: '1px solid #272727'}}>
          <Typography variant="subtitle2" sx={{ color: '#aaa', mb: 2, fontWeight: 'bold'}}>
            SUBSCRIPTIONS
          </Typography>
          {subscriptionChannels.map((channel) => (
            <Box
              key={channel}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap:  2,
                p:  1,
                borderRadius:  2,
                cursor: 'pointer','&:hover': { bgcolor: 'rgba(25,255,255,0.05)' }}}
            >
              <Avatar sx={{ width:  24, height: 24}} />
              <Typography variant="body2" sx={{ color: '#aaa', fontSize: '14px'}}>
                {channel}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ ml: '240px', flex: 1, p: 3 }}>
        {/* Featured Video Section */}
        {featuredVideo && (
          <Box sx={{ mb:  4 }}>
            <Box
              sx={{
                position: 'relative',
                borderRadius:  3,
                overflow: 'hidden',
                mb:  2,
                height: '65vh'}}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  position: 'relative'}}
              >
                <ElegantVideoPlayer
                  videoUrl={featuredVideo.filePath}
                  title={featuredVideo.title}
                  description={featuredVideo.description}
                  thumbnailUrl={featuredVideo.thumbnailPath}
                  chapters={[
                    { time: 0, title: 'Intro',},
                    { time:  30, title: 'Main Content',},
                    { time: 10, title: 'Conclusion',},
                  ]}
                  subtitles={[
                    { time: 0, text: 'Velkommen til CreatorHub Norge',},
                    { time:  5, text: 'Vi skal vise deg fantastiske videoer',},
                    {
                      time:  10,
                      text: 'Med profesjonell kvalitet og kreativitet',
                  },
                  ]}
                  actors={['Fotograf: Daniel','Klient: Bergen Bryllup', ]}
                  sceneInfo="Magisk bryllupsvideo fra Bergen med spektakulær natur som bakteppe. Filmet med profesjonelt utstyr i 4K oppløsning."
                  onNext={() => {
                    const currentIndex = videos.findIndex((v) => v.id === featuredVideo.id);
                    if (currentIndex < videos.length - 1) {
                      setFeaturedVideo(videos[currentIndex + 1]);
                  }
                }}
                  onPrevious={() => {
                    const currentIndex = videos.findIndex((v) => v.id === featuredVideo.id);
                    if (currentIndex > 0) {
                      setFeaturedVideo(videos[currentIndex - 1]);
                  }
                }}
                />
              </Box>
            </Box>

            {/* Featured video controls */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                px:  1}}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Avatar sx={{ width:  48, height: 48}} />
                <Box>
                  <Typography variant="h6" sx={{  color: '#fff', fontWeight: 'bold' }}>
                    CreatorHub Norge
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#aaa'}}>
                    126K subscribers
                  </Typography>
                </Box>
                <Button variant="contained"
                  sx={{
                    bgcolor: '#fff',
                    color: '#00',
                    textTransform: 'none',
                    fontWeight: 'bold',
                    borderRadius:  50,
                    px: 3, '&:hover': { bgcolor: '#e0e0e0',}}}
                 sx={theming.getThemedButtonSx()}>
                  Subscribe
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap:  1 }}>
                <IconButton
                  onClick={() => featuredVideo && toggleLike(featuredVideo.id)}
                  sx={{
                    color: likedVideos.has(featuredVideo.id) ? '#ff4444' : '#fff',
                    bgcolor: 'rgba(25,255,255,0.1)','&:hover': { bgcolor: 'rgba(25,255,255,0.2)' }}}
                >
                  {likedVideos.has(featuredVideo.id) ? theming.getThemedIcon('favorite') : <FavoriteBorder />}
                </IconButton>
                <IconButton
                  sx={{
                    color: '#fff',
                    bgcolor: 'rgba(25,255,255,0.1)','&:hover': { bgcolor: 'rgba(25,255,255,0.2)' }}}
                >
                  {theming.getThemedIcon('share')}
                </IconButton>
                <IconButton
                  sx={{
                    color: '#fff',
                    bgcolor: 'rgba(25,255,255,0.1)','&:hover': { bgcolor: 'rgba(25,255,255,0.2)' }}}
                >
                  {theming.getThemedIcon('moreVert')}
                </IconButton>
              </Box>
            </Box>
          </Box>
        )}

        {/* Video Grid */}
        <Typography variant="h5" sx={{  color: '#fff', mb:  3, fontWeight: 'bold' }}>
          More from CreatorHub Norge
        </Typography>

        {videos.length === 0 ? (
          <Alert
            severity="info"
            sx={{ bgcolor: '#1c1c10', color: '#fff', border: '1px solid #333'}}
          >
            Ingen videoer funnet. Start med å laste opp din første video!
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {videos.slice(1, 13).map((video) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={video.id}>
                <MuiCard
                  onClick={() => setFeaturedVideo(video)}
                  sx={{
                    bgcolor: 'transparent',
                    cursor: 'pointer',
                    transition: 'transform 0.2','&:hover': {
                      transform: 'scale(1.02, )',
                  }}}
                >
                  <Box sx={{ position: 'relative'}}>
                    <CardMedia
                      component="div"
                      sx={{
                        height: 10,
                        background: video.thumbnailPath
                          ? `url(${video.thumbnailPath})`
                          : 'linear-gradient(135deg, #2d3748 0%, #4a5568 100%)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        borderRadius:  2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'}}
                     sx={theming.getThemedCardSx()}>
                      <PlayArrow sx={{ fontSize:  32, color: 'rgba(25,255,255,0.8)' }} />
                    </CardMedia>

                    {/* Duration badge */}
                    <Chip
                      label={formatDuration(video.duration)}
                      size="small"
                      sx={{
                        position: 'absolute',
                        bottom:  8,
                        right:  8,
                        bgcolor: 'rgba(0,0,0,0.8)',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'}}
                    />
                  </Box>

                  <Box sx={{ p: 2, display: 'flex', gap: 1.5}}>
                    <Avatar sx={{ width:  36, height:  36, mt: 0.5}} />
                    <Box sx={{ flex:  1 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          color: '#fff',
                          fontWeight: 'bold',
                          lineHeight: 1.3,
                          mb: 0.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp:  2,
                          WebkitBoxOrient: 'vertical'}}
                      >
                        {video.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#aaa', mb: 0.5}}>
                        CreatorHub Norge
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#aaa'}}>
                        1.2K views • 2 days ago
                      </Typography>
                    </Box>
                  </Box>
                </MuiCard>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Pagination hint */}
        {videos.length > 12 && (
          <Box sx={{ mt:  4, textAlign: 'center'}}>
            <Button
              variant="outlined"
              sx={{
                color: '#fff',
                borderColor: '#44', '&:hover': { borderColor: '#fff',}}}
            >
              Load more videos
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default VideographerShowcase;
