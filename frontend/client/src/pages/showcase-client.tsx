import { useTheming } from '../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Avatar,
  Paper,
  IconButton,
  Divider,
} from '@mui/material';
import { VideographyIcon as VideographyIconLibrary } from '../components/shared/CreatorHubIcons';
import {
  PhotoLibrary,
  Download,
  ArrowBack,
  Share,
  Refresh,
  CheckCircle,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import WeddingCodeEntry from '@/components/wedding-code-entry';

interface ShowcaseMedia {
  id: string;
  type: 'photo' | 'video';
  title: string;
  url: string;
  thumbnailUrl?: string;
  dateCreated: string;
  size: string;
  downloadUrl: string; 
}

interface ShowcaseData {
  projectId: string;
  coupleNames: string[];
  weddingDate: string;
  totalPhotos: number;
  totalVideos: number;
  media: ShowcaseMedia[];
  photographerName: string;
  lastUpdated: string; 
}

export default function ShowcaseClient() {
  const { projectId } = useParams<{ projectId: string }>();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Check for token in URL parameters first
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      setAccessToken(urlToken);
  }
}, []);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
  }, 60000);
    return () => clearInterval(timer);
}, []);

  // Fetch showcase data
  const {
    data: showcaseData,
    isLoading,
    error,
    refetch,
} = useQuery<ShowcaseData>({
    queryKey: ['/api/showcase/client-view', projectId],
    enabled: !!accessToken && !!projectId,
    refetchInterval: 5 * 60 * 100, // Refresh every 5 minutes
});

  if (!projectId) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
          p:  2,
      }}
      >
        <Paper sx={{ p:  4, maxWidth: 40, textAlign: 'center',}}>
          <Typography variant="h5" color="error" sx={{  mb:  2  }}>
            Ugyldig lenke
          </Typography>
          <Typography color="text.secondary">
            Lenken er ugyldig eller mangler prosjekt-informasjon. Kontakt fotografen din for en ny
            lenke.
          </Typography>
        </Paper>
      </Box>
    );
}

  // Show code entry if no valid access token
  if (!accessToken) {
    return <WeddingCodeEntry projectId={projectId} onValidCode={setAccessToken} />;
}

  // Loading state
  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
      }}
      >
        <CircularProgress size={60} sx={{ color: '#d81b60',}} />
      </Box>
    );
}

  // Error state
  if (error || !showcaseData) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
          p:  2,
      }}
      >
        <Paper sx={{ p:  4, maxWidth: 40, textAlign: 'center',}}>
          <Typography variant="h5" color="error" sx={{  mb:  2  }}>
            Kunne ikke laste showcase
          </Typography>
          <Typography color="text.secondary" sx={{ mb:  3 }}>
            {error?.message || 'Det oppstod en feil ved lasting av showcase-innholdet.'}
          </Typography>
          <Button variant="contained" onClick={() => refetch()} sx={{ bgcolor: '#d81b60' }}>
            Prøv igjen
          </Button>
        </Paper>
      </Box>
    );
}

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
        pb:  4,
    }}
    >
      {/* Header */}
      <Paper
        sx={{
          p:  3,
          mb:  2,
          textAlign: 'center',
          borderRadius:  0,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
          📸 {showcaseData.coupleNames.join(' & ')} Showcase
        </Typography>
        <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 2 }}>
          Dine bryllupsbilder & videoer
        </Typography>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
            flexWrap: 'wrap',
            mb: 2,
          }}
        >
          <Chip
            label={`${showcaseData.totalPhotos} bilder`}
            icon={<PhotoLibrary />}
            sx={{ bgcolor: '#e91e60', color: 'white' }}
          />
          <Chip
            label={`${showcaseData.totalVideos} videoer`}
            icon={theming.getThemedIcon('videoLibrary')}
            sx={{ bgcolor: '#f44330', color: 'white',}}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('arrowBack')}
            onClick={() => (window.location.href = `/bryllup/${projectId}?token=${accessToken}`)}
            sx={{ borderColor: '#d81b60', color: '#d81b60' }}
          >
            Tilbake til tidslinje
          </Button>
          <IconButton onClick={() => refetch()}>
            {theming.getThemedIcon('refresh')}
          </IconButton>
        </Box>
      </Paper>

      <Box sx={{ maxWidth: 120, mx: 'auto', px:  2 }}>
        {/* Status Alert */}
        {showcaseData.media.length === 0 ? (
          <Alert severity="info" sx={{ mb:  2 }}>
            Bilder og videoer vil bli tilgjengelig her når fotografen har lastet dem opp etter
            bryllupet.
          </Alert>
        ) : (
          <Alert severity="success" icon={theming.getThemedIcon('checkCircle')} sx={{ mb:  2 }}>
            <strong>{showcaseData.media.length} filer tilgjengelig</strong> - Sist oppdatert: {', '}
            {new Date(showcaseData.lastUpdated).toLocaleDateString('no-NO')}
          </Alert>
        )}

        {/* Media Grid */}
        <Grid container spacing={2}>
          {showcaseData.media.map((media) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={media.id}>
              <Card
                sx={{
                  ...theming.getThemedCardSx(),
                  borderRadius: 3,
                  transition: 'transform 0.2s', '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    paddingBottom: '75%', // 4:3 aspect ratio
                    overflow: 'hidden',
                    borderRadius: '12px 12px 0 0',
                  }}
                >
                  {media.type === 'photo' ? (
                    <img
                      src={media.thumbnailUrl || media.url}
                      alt={media.title}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      loading="lazy"
                    />
                  ) : (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: '#000',
                        color: 'white',
                      }}
                    >
                      <VideoLibrary sx={{ fontSize: 48 }} />
                    </Box>
                  )}
                  <Avatar
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      bgcolor: media.type === 'photo' ? '#2196f3' : '#f44330',
                      width: 32,
                      height: 32,
                    }}
                  >
                    {media.type === 'photo' ? (
                      <PhotoLibrary sx={{ fontSize: 18 }} />
                    ) : (
                      <VideoLibrary sx={{ fontSize: 18 }} />
                    )}
                  </Avatar>
                </Box>
                <CardContent sx={{ ...theming.getThemedCardSx(), p: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    {media.title}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {media.size}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(media.dateCreated).toLocaleDateString('no-NO')}
                    </Typography>
                  </Box>
                  <Button
                    fullWidth
                    variant="contained"
                    size="small"
                    startIcon={theming.getThemedIcon('download')}
                    href={media.downloadUrl}
                    download
                    sx={theming.getThemedButtonSx()}
                  >
                    Last ned
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Download All Section */}
        {showcaseData.media.length > 0 && (
          <>
            <Divider sx={{ my: 4 }} />
            <Card sx={{ ...theming.getThemedCardSx(), textAlign: 'center', p: 3, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                Last ned alle filer
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Få alle bildene og videoene dine i en zip-fil
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={theming.getThemedIcon('download')}
                sx={{ ...theming.getThemedButtonSx(), px: 4 }}
                onClick={() => {
                  // This would trigger a download of all files as zip
                  window.location.href = `/api/showcase/${projectId}/download-all?token=${accessToken}`;
                }}
              >
                Last ned alt som ZIP
              </Button>
            </Card>
          </>
        )}

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt:  4, opacity: 0.7,}}>
          <Typography variant="caption" color="text.secondary">
            Showcase levert av {showcaseData.photographerName} • CreatorHub Norge
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
