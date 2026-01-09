/**
 * VideoEmbed Component
 * 
 * Handles video embedding with lazy loading and proper aspect ratio
 */

import React from 'react';
import { Box, CircularProgress } from '@mui/material';

interface VideoEmbedProps {
  videoUrl: string;
  lazy?: boolean;
}

const getVideoEmbedUrl = (url: string): string => {
  // Convert YouTube/Vimeo URLs to embed format
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop()?.split('?')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }
  if (url.includes('vimeo.com')) {
    const videoId = url.split('/').pop()?.split('?')[0];
    return `https://player.vimeo.com/video/${videoId}`;
  }
  return url;
};

export const VideoEmbed: React.FC<VideoEmbedProps> = ({ videoUrl, lazy = false }) => {
  const [isLoaded, setIsLoaded] = React.useState(!lazy);
  const [isLoading, setIsLoading] = React.useState(lazy);

  React.useEffect(() => {
    if (lazy) {
      // Use Intersection Observer for lazy loading
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsLoaded(true);
              setIsLoading(false);
              observer.disconnect();
            }
          });
        },
        { rootMargin: '50px' }
      );

      const container = document.getElementById(`video-embed-${videoUrl}`);
      if (container) {
        observer.observe(container);
      }

      return () => observer.disconnect();
    }
  }, [lazy, videoUrl]);

  const embedUrl = React.useMemo(() => getVideoEmbedUrl(videoUrl), [videoUrl]);

  return (
    <Box
      id={lazy ? `video-embed-${videoUrl}` : undefined}
      sx={{
        position: 'relative',
        paddingBottom: '56.25%', // 16:9 aspect ratio
        height: 0,
        overflow: 'hidden',
        borderRadius: 2,
        bgcolor: 'black',
      }}
    >
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1,
          }}
        >
          <CircularProgress sx={{ color: '#f59e0b' }} />
        </Box>
      )}
      {isLoaded && (
        <iframe
          src={embedUrl}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      )}
    </Box>
  );
};

export default VideoEmbed;

