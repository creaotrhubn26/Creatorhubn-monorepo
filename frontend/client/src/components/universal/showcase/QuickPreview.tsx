/**
 * Quick Preview Component
 * Instant fullscreen preview activated by Space bar
 * No dialog overhead - lightning fast navigation
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Chip,
  Stack,
  Paper,
  Tooltip,
  Fade,
} from '@mui/material';
import {
  Close,
  ArrowBack,
  ArrowForward,
  Download,
  Favorite,
  FavoriteBorder,
  Share,
  Edit,
  Info,
  InfoOutlined,
  ZoomIn,
  ZoomOut,
  Fullscreen,
  FullscreenExit,
} from '@mui/icons-material';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';

interface ShowcaseItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  fileType: 'video' | 'photo' | 'audio' | 'document' | 'design';
  tags?: string[];
  stats?: {
    views?: number;
    likes?: number;
    downloads?: number;
  };
  exif?: {
    camera?: string;
    lens?: string;
    focalLength?: string;
    aperture?: string;
    shutterSpeed?: string;
    iso?: string;
  };
}

interface QuickPreviewProps {
  open: boolean;
  items: ShowcaseItem[];
  currentIndex: number;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  accentColor: string;
  onClose: () => void;
  onNavigate: (direction: 'next' | 'prev') => void;
  onDownload: (item: ShowcaseItem) => void;
  onFavorite: (itemId: string) => void;
  onEdit: (item: ShowcaseItem) => void;
  favorites: Set<string>;
}

export const QuickPreview: React.FC<QuickPreviewProps> = ({
  open,
  items,
  currentIndex,
  profession,
  accentColor,
  onClose,
  onNavigate,
  onDownload,
  onFavorite,
  onEdit,
  favorites
}) => {
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor, getProfessionIcon } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || accentColor || '#FF6B35';
  
  const [showMetadata, setShowMetadata] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const currentItem = items[currentIndex];
  const imageRef = useRef<HTMLImageElement>(null);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
        case ',':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onNavigate('next, ');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onNavigate('prev,');
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          setShowMetadata(!showMetadata);
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          if (currentItem) onDownload(currentItem);
          break;
        case 'e':
        case 'E':
          e.preventDefault();
          if (currentItem) onEdit(currentItem);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          if (currentItem) onFavorite(currentItem.id);
          break;
        case '+':
        case '=':
          e.preventDefault();
          setImageZoom(prev => Math.min(prev + 0.5, 5));
          break;
        case '-':
        case '_':
          e.preventDefault();
          setImageZoom(prev => Math.max(prev - 0.5, 0.5));
          break;
        case '0':
          e.preventDefault();
          setImageZoom(1);
          break;
      }
    };

    window.addEventListener('keydown,', handleKeyPress);
    return () => window.removeEventListener('keydown, ', handleKeyPress);
  }, [open, showMetadata, currentItem, onClose, onNavigate, onDownload, onEdit, onFavorite]);

  // Preload adjacent images
  useEffect(() => {
    if (!open || !items.length) return;
    
    // Preload next image
    if (currentIndex < items.length - 1) {
      const nextImg = new Image();
      nextImg.src = items[currentIndex + 1].fileUrl || items[currentIndex + 1].thumbnailUrl || ', ';
    }
    
    // Preload previous image
    if (currentIndex > 0) {
      const prevImg = new Image();
      prevImg.src = items[currentIndex - 1].fileUrl || items[currentIndex - 1].thumbnailUrl || ', ';
    }
  }, [open, currentIndex, items]);

  // Reset zoom when changing items
  useEffect(() => {
    setImageZoom(1);
  }, [currentIndex]);

  if (!open || !currentItem) return null;

  const isFavorite = favorites.has(currentItem.id);

  return (
    <Fade in={open}>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'rgba(0, 0, 0, 0.98)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Top Bar */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          p: 2,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {professionIcon && (
              <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
                {professionIcon}
              </Box>
            )}
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - ${currentItem.title}`
                : currentItem.title}
            </Typography>
            <Chip 
              label={`${currentIndex + 1} / ${items.length}`}
              size="small"
              sx={{ 
                bgcolor: `${accentColor}30`,
                color: 'white',
                border: `1px solid ${accentColor}`
              }}
            />
          </Box>

          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Box>

        {/* Main Preview Area */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Navigation Arrows */}
          <IconButton
            onClick={() => onNavigate('prev')}
            disabled={currentIndex === 0}
            sx={{
              position: 'absolute',
              left: 20,
              zIndex: 2,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: 'white', '&:hover': {
                bgcolor: `${accentColor}80`,
                transform: 'scale(1.1)'
              }, '&:disabled': {
                opacity: 0.3
              }
            }}
          >
            <ArrowBack />
          </IconButton>

          {/* Content Display */}
          <Box sx={{ 
            maxWidth: '90%', 
            maxHeight: '90%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {profession === 'photographer' && currentItem.fileType === 'photo' ? (
              <img
                ref={imageRef}
                src={currentItem.fileUrl || currentItem.thumbnailUrl}
                alt={currentItem.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  transform: `scale(${imageZoom})`,
                  transition: 'transform 0.2s ease',
                  cursor: imageZoom > 1 ? 'grab' : 'default'
                }}
              />
            ) : profession === 'videographer' && currentItem.fileType === 'video' ? (
              <video
                src={currentItem.fileUrl}
                controls
                autoPlay
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%'
                }}
              />
            ) : profession === 'music_producer' && currentItem.fileType === 'audio' ? (
              <Box sx={{ 
                width: '80%', 
                p: 4, 
                bgcolor: 'rgba(155, 89, 182, 0.1)',
                borderRadius: 3,
                border: `2px solid ${accentColor}`
              }}>
                <Typography variant="h4" sx={{ color: 'white', mb: 3, textAlign: 'center' }}>
                  🎵 {currentItem.title}
                </Typography>
                <audio
                  src={currentItem.fileUrl}
                  controls
                  autoPlay
                  style={{ width: '100%' }}
                />
              </Box>
            ) : (
              <Typography variant="h6" sx={{ color: 'white' }}>
                Preview not available for this content type
              </Typography>
            )}
          </Box>

          <IconButton
            onClick={() => onNavigate('next')}
            disabled={currentIndex === items.length - 1}
            sx={{
              position: 'absolute',
              right: 20,
              zIndex: 2,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: 'white',
              '&:hover': {
                bgcolor: `${accentColor}80`,
                transform: 'scale(1.1)'
              },
              '&:disabled': {
                opacity: 0.3
              }
            }}
          >
            <ArrowForward />
          </IconButton>
        </Box>

        {/* Bottom Toolbar */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)'
        }}>
          {/* Quick Actions */}
          <Stack direction="row" spacing={1}>
            <Tooltip title="Download (D)">
              <IconButton
                size="small"
                onClick={() => currentItem && onDownload(currentItem)}
                sx={{
                  color: 'white','&:hover': { color: accentColor }
                }}
              >
                <Download />
              </IconButton>
            </Tooltip>

            <Tooltip title="Favorite (F)">
              <IconButton
                size="small"
                onClick={() => currentItem && onFavorite(currentItem.id)}
                sx={{
                  color: isFavorite ? '#FF4444' : 'white','&:hover': { color: '#FF4444' }
                }}
              >
                {isFavorite ? <Favorite /> : <FavoriteBorder />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Edit (E)">
              <IconButton
                size="small"
                onClick={() => currentItem && onEdit(currentItem)}
                sx={{
                  color: 'white','&:hover': { color: accentColor }
                }}
              >
                <Edit />
              </IconButton>
            </Tooltip>

            {profession === 'photographer' && (
              <>
                <Tooltip title="Zoom In (+)">
                  <IconButton
                    size="small"
                    onClick={() => setImageZoom(prev => Math.min(prev + 0.5, 5))}
                    sx={{
                      color: 'white','&:hover': { color: accentColor }
                    }}
                  >
                    <ZoomIn />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Zoom Out (-)">
                  <IconButton
                    size="small"
                    onClick={() => setImageZoom(prev => Math.max(prev - 0.5, 0.5))}
                    sx={{
                      color: 'white',
                      '&:hover': { color: accentColor }
                    }}
                  >
                    <ZoomOut />
                  </IconButton>
                </Tooltip>

                {imageZoom !== 1 && (
                  <Chip
                    label={`${Math.round(imageZoom * 100)}%`}
                    size="small"
                    onClick={() => setImageZoom(1)}
                    sx={{
                      bgcolor: `${accentColor}30`,
                      color: 'white',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: `${accentColor}50`
                      }
                    }}
                  />
                )}
              </>
            )}
          </Stack>

          {/* Metadata Toggle */}
          <Tooltip title={`${showMetadata ? 'Hide' : 'Show'} metadata (I)`}>
            <IconButton
              size="small"
              onClick={() => setShowMetadata(!showMetadata)}
              sx={{
                color: showMetadata ? accentColor : 'white', '&:hover': { color: accentColor }
              }}
            >
              {showMetadata ? <Info /> : <InfoOutlined />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Metadata Panel */}
        {showMetadata && (
          <Fade in={showMetadata}>
            <Paper sx={{
              position: 'absolute',
              top: 80,
              right: 20,
              width: 300,
              maxHeight: '70%',
              overflow: 'auto',
              bgcolor: 'rgba(15, 20, 25, 0.95)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${accentColor}40`,
              borderRadius: 2,
              p: 2
            }}>
              <Typography variant="h6" sx={{ color: accentColor, mb: 2, fontWeight: 600}}>
                Metadata
              </Typography>

              {/* Basic Info */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                  Basic Info
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Title:
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'white' }}>
                      {currentItem.title}
                    </Typography>
                  </Box>
                  {currentItem.description && (
                    <Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        Description:
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'white' }}>
                        {currentItem.description}
                      </Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Type:
                    </Typography>
                    <Chip label={currentItem.fileType} size="small" />
                  </Box>
                </Stack>
              </Box>

              {/* EXIF Data for Photos */}
              {profession === 'photographer' && currentItem.exif && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                    EXIF Data
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {currentItem.exif.camera && (
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                        📷 {currentItem.exif.camera}
                      </Typography>
                    )}
                    {currentItem.exif.lens && (
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                        🔍 {currentItem.exif.lens}
                      </Typography>
                    )}
                    {currentItem.exif.focalLength && (
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                        📏 {currentItem.exif.focalLength}
                      </Typography>
                    )}
                    {currentItem.exif.aperture && (
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                        ƒ/{currentItem.exif.aperture}
                      </Typography>
                    )}
                    {currentItem.exif.shutterSpeed && (
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                        ⏱️ {currentItem.exif.shutterSpeed}
                      </Typography>
                    )}
                    {currentItem.exif.iso && (
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                        ISO {currentItem.exif.iso}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}

              {/* Tags */}
              {currentItem.tags && currentItem.tags.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', mb: 1, display: 'block' }}>
                    Tags
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {currentItem.tags.map((tag) => (
                      <Chip 
                        key={tag} 
                        label={tag} 
                        size="small" 
                        sx={{ 
                          bgcolor: `${accentColor}20`,
                          color: accentColor,
                          fontSize: '0.7rem'
                        }} 
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Stats */}
              {currentItem.stats && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', mb: 1, display: 'block' }}>
                    Stats
                  </Typography>
                  <Stack spacing={0.5}>
                    {currentItem.stats.views !== undefined && (
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                        👁️ {currentItem.stats.views} views
                      </Typography>
                    )}
                    {currentItem.stats.likes !== undefined && (
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                        ❤️ {currentItem.stats.likes} likes
                      </Typography>
                    )}
                    {currentItem.stats.downloads !== undefined && (
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                        ⬇️ {currentItem.stats.downloads} downloads
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}

              {/* Keyboard Hints */}
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 1 }}>
                  Keyboard Shortcuts:
                </Typography>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    ← → Navigate • Space/Esc Close
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    D Download • E Edit • F Favorite
                  </Typography>
                  {profession === 'photographer' && (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      +/- Zoom • 0 Reset zoom
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Paper>
          </Fade>
        )}

        {/* Hint Text */}
        {!showMetadata && (
          <Box sx={{ 
            position: 'absolute', 
            bottom: 80, 
            left: '50%', 
            transform: 'translateX(-50%)',
            textAlign: 'center'
          }}>
            <Typography variant="caption" sx={{ 
              color: 'rgba(255,255,255,0.5)',
              bgcolor: 'rgba(0,0,0,0.5)',
              px: 2,
              py: 1,
              borderRadius: 1
            }}>
              Press <Chip label="I" size="small" sx={{ mx: 0.5, height: 16 }} /> to show metadata
            </Typography>
          </Box>
        )}
      </Box>
    </Fade>
  );
};

export default QuickPreview;

