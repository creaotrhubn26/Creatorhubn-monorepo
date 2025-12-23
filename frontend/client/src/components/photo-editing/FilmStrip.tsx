/**
 * FILM STRIP
 * Lightroom-style bottom panel with photo thumbnails
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Stack,
  IconButton,
  Tooltip,
  Typography,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  StarBorder,
  Delete,
  CheckCircle,
  Cancel,
  HelpOutline,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

export interface FilmStripPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
  selected?: boolean;
  rating?: number; // 0-5 stars
  flagged?: boolean;
  rejected?: boolean;
  label?: string;
  metadata?: {
    width?: number;
    height?: number;
    size?: number;
    date?: string;
  };
}

interface FilmStripProps {
  photos: FilmStripPhoto[];
  selectedPhotoId?: string;
  onPhotoSelect?: (photo: FilmStripPhoto) => void;
  onPhotoRate?: (photoId: string, rating: number) => void;
  onPhotoFlag?: (photoId: string, flagged: boolean) => void;
  onPhotoReject?: (photoId: string, rejected: boolean) => void;
  onPhotoDelete?: (photoId: string) => void;
  thumbnailSize?: number;
  showRatings?: boolean;
  showFlags?: boolean;
  showLabels?: boolean;
}

export default function FilmStrip({
  photos,
  selectedPhotoId,
  onPhotoSelect,
  onPhotoRate,
  onPhotoFlag,
  onPhotoReject,
  onPhotoDelete,
  thumbnailSize = 80,
  showRatings = true,
  showFlags = true,
  showLabels = true,
}: FilmStripProps) {
  const theming = useTheming('photographer');
  const stripRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [hoveredPhotoId, setHoveredPhotoId] = useState<string | null>(null);

  const scrollLeft = () => {
    if (stripRef.current) {
      stripRef.current.scrollBy({ left: -thumbnailSize * 3, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (stripRef.current) {
      stripRef.current.scrollBy({ left: thumbnailSize * 3, behavior: 'smooth' });
    }
  };

  const handlePhotoClick = (photo: FilmStripPhoto) => {
    onPhotoSelect?.(photo);
    // Scroll to selected photo
    if (stripRef.current) {
      const photoElement = stripRef.current.querySelector(`[data-photo-id="${photo.id},"]`);
      photoElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  const handleRatingClick = (e: React.MouseEvent, photoId: string, rating: number) => {
    e.stopPropagation();
    onPhotoRate?.(photoId, rating);
  };

  const handleFlagClick = (e: React.MouseEvent, photoId: string) => {
    e.stopPropagation();
    const photo = photos.find(p => p.id === photoId);
    if (photo) {
      onPhotoFlag?.(photoId, !photo.flagged);
    }
  };

  const handleRejectClick = (e: React.MouseEvent, photoId: string) => {
    e.stopPropagation();
    const photo = photos.find(p => p.id === photoId);
    if (photo) {
      onPhotoReject?.(photoId, !photo.rejected);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, photoId: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this photo?')) {
      onPhotoDelete?.(photoId);
    }
  };

  // Auto-scroll to selected photo
  useEffect(() => {
    if (selectedPhotoId && stripRef.current) {
      const photoElement = stripRef.current.querySelector(`[data-photo-id="${selectedPhotoId}"]`);
      if (photoElement) {
        photoElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedPhotoId]);

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: thumbnailSize + 60,
        bgcolor: '#1a1a1a',
        borderTop: '1px solid #3a3a3a',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column'}}
    >
      {/* Film Strip Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 1,
          borderBottom: '1px solid #3a3a3a'}}
      >
        <Typography variant="caption" sx={{ color: '#999', fontSize: '11px' }}>
          {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Scroll Left">
            <IconButton size="small" onClick={scrollLeft} sx={{ color: '#999' }}>
              <ChevronLeft fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Scroll Right">
            <IconButton size="small" onClick={scrollRight} sx={{ color: '#999' }}>
              <ChevronRight fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Thumbnail Strip */}
      <Box
        ref={stripRef}
        sx={{
          display: 'flex',
          gap: 1,
          px: 2,
          py: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarColor: '#4a4a4a #1a1a1a',
          '&::-webkit-scrollbar': {
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#1a1a1a',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#4a4a4a',
            borderRadius: '4px',
          }
        }}
      >
        {photos.map((photo) => {
          const isSelected = photo.id === selectedPhotoId;
          const isHovered = photo.id === hoveredPhotoId;

          return (
            <Box
              key={photo.id}
              data-photo-id={photo.id}
              sx={{
                position: 'relative',
                minWidth: thumbnailSize,
                width: thumbnailSize,
                height: thumbnailSize,
                cursor: 'pointer',
                border: isSelected ? '2px solid #4a9eff' : '2px solid transparent',
                borderRadius: '4px',
                overflow: 'hidden',
                bgcolor: '#252525',
                transition: 'all 0.2s', '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 4px 12px rgba(74, 158, 255, 0.3)',
                  borderColor: isSelected ? '#4a9eff' : '#5a5a5a',
                }}}
              onClick={() => handlePhotoClick(photo)}
              onMouseEnter={() => setHoveredPhotoId(photo.id)}
              onMouseLeave={() => setHoveredPhotoId(null)}
            >
              {/* Thumbnail Image */}
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: `url(${photo.thumbnailUrl || photo.url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: photo.rejected ? 0.3 : 1,
                  filter: photo.rejected ? 'grayscale(100%)' : 'none'}}
              />

              {/* Overlay on Hover */}
              {isHovered && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    bgcolor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    p: 0.5}}
                >
                  {/* Top Actions */}
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    {showFlags && (
                      <IconButton
                        size="small"
                        onClick={(e) => handleFlagClick(e, photo.id)}
                        sx={{
                          color: photo.flagged ? '#ff6b6b' : '#fff',
                          bgcolor: 'rgba(0, 0, 0, 0.5)',
                          p: 0.5,
                          minWidth: 'auto',
                          width: 20,
                          height: 20}}
                      >
                        {photo.flagged ? <CheckCircle fontSize="small" /> : <HelpOutline fontSize="small" />}
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => handleRejectClick(e, photo.id)}
                      sx={{
                        color: photo.rejected ? '#ff6b6b' : '#fff',
                        bgcolor: 'rgba(0, 0, 0, 0.5)',
                        p: 0.5,
                        minWidth: 'auto',
                        width: 20,
                        height: 20}}
                    >
                      <Cancel fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => handleDeleteClick(e, photo.id)}
                      sx={{
                        color: '#fff',
                        bgcolor: 'rgba(0, 0, 0, 0.5)',
                        p: 0.5,
                        minWidth: 'auto',
                        width: 20,
                        height: 20}}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>

                  {/* Bottom Rating */}
                  {showRatings && (
                    <Stack direction="row" spacing={0} justifyContent="center">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <IconButton
                          key={rating}
                          size="small"
                          onClick={(e) => handleRatingClick(e, photo.id, rating)}
                          sx={{
                            color: photo.rating && photo.rating >= rating ? '#ffd700' : '#666',
                            p: 0,
                            minWidth: 'auto',
                            width: 12,
                            height: 12}}
                        >
                          <Star fontSize="small" />
                        </IconButton>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              {/* Rating Stars (Always Visible) */}
              {showRatings && photo.rating && photo.rating > 0 && !isHovered && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: 0.25}}
                >
                  {Array.from({ length: photo.rating }).map((_, i) => (
                    <Star
                      key={i}
                      sx={{
                        fontSize: 10,
                        color: '#ffd700',
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))'}}
                    />
                  ))}
                </Box>
              )}

              {/* Flag Indicator */}
              {showFlags && photo.flagged && !isHovered && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    bgcolor: '#ff6b6b',
                    borderRadius: '50%',
                    width: 12,
                    height: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'}}
                >
                  <CheckCircle sx={{ fontSize: 8, color: '#fff' }} />
                </Box>
              )}

              {/* Rejected Indicator */}
              {photo.rejected && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    bgcolor: 'rgba(255, 107, 107, 0.9)',
                    borderRadius: '4px',
                    px: 1,
                    py: 0.5}}
                >
                  <Typography variant="caption" sx={{ color: '#fff', fontSize: '10px', fontWeight: 600}}>
                    REJECTED
                  </Typography>
                </Box>
              )}

              {/* Label */}
              {showLabels && photo.label && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 2,
                    left: 2,
                    bgcolor: 'rgba(0, 0, 0, 0.7)',
                    borderRadius: '2px',
                    px: 0.5,
                    py: 0.25}}
                >
                  <Typography variant="caption" sx={{ color: '#fff', fontSize: '9px' }}>
                    {photo.label}
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

