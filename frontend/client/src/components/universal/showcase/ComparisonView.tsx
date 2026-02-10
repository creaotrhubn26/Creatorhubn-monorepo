/**
 * Comparison View Component
 * Side-by-side comparison of showcase items
 * Synchronized zoom, pan, and A/B toggle
 */

import React, { useState, useRef, useEffect } from 'react';
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useTheming } from '@/utils/theming-helper';
import {
  Dialog,
  Box,
  IconButton,
  Typography,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  Stack,
  Tooltip,
  Divider,
  Button,
  Grid
} from '@mui/material';
import {
  Close,
  CompareArrows,
  SwapHoriz,
  ZoomIn,
  ZoomOut,
  Sync,
  LockOpen,
  Lock,
  ArrowBack,
  ArrowForward,
  Download,
  Favorite,
  FavoriteBorder
} from '@mui/icons-material';

interface ShowcaseItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  fileType: 'video' | 'photo' | 'audio' | 'document' | 'design';
  tags?: string[];
}

interface ComparisonViewProps {
  open: boolean;
  items: ShowcaseItem[];
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  accentColor: string;
  onClose: () => void;
  onPrefer?: (itemId: string) => void;
  onDownload?: (item: ShowcaseItem) => void;
  favorites: Set<string>;
  onFavorite: (itemId: string) => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  open,
  items,
  profession,
  accentColor,
  onClose,
  onPrefer,
  onDownload,
  favorites,
  onFavorite
}) => {
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || accentColor || '#FF6B35';
  const theming = useTheming(currentProfession);
  
  const [selectedItems, setSelectedItems] = useState<[number, number]>([0, 1]);
  const [zoom, setZoom] = useState(1);
  const [syncZoom, setSyncZoom] = useState(true);
  const [comparisonMode, setComparisonMode] = useState<'side-by-side' | 'overlay' | 'slider'>('side-by-side');
  const [sliderPosition, setSliderPosition] = useState(50);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const item1 = items[selectedItems[0]];
  const item2 = items[selectedItems[1]];

  // Reset states when items change
  useEffect(() => {
    setZoom(1);
    setPanPosition({ x: 0, y: 0 });
    setSliderPosition(50);
  }, [selectedItems]);

  // Handle mouse drag for pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const swapItems = () => {
    setSelectedItems([selectedItems[1], selectedItems[0]]);
  };

  const navigateItem = (index: 0 | 1, direction: 'next' | 'prev') => {
    const newSelectedItems: [number, number] = [...selectedItems];
    if (direction === 'next' && selectedItems[index] < items.length - 1) {
      newSelectedItems[index] = selectedItems[index] + 1;
    } else if (direction === 'prev' && selectedItems[index] > 0) {
      newSelectedItems[index] = selectedItems[index] - 1;
    }
    setSelectedItems(newSelectedItems);
  };

  if (!open || items.length < 2) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: '#0a0a0a',
          color: 'white'
        }
      }}
    >
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        p: 2,
        borderBottom: `2px solid ${accentColor}`,
        bgcolor: 'rgba(0,0,0,0.8)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {professionIcon && (
            <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
              {professionIcon}
            </Box>
          )}
          <CompareArrows sx={{ color: accentColor, fontSize: 32 }} />
          <Typography variant="h6" fontWeight="600">
            {enhancedProfessionConfig?.displayName || professionConfig?.displayName
              ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Comparison View`
              : 'Comparison View'}
          </Typography>
          <Chip 
            label={profession === 'photographer' ? 'Image Comparison' : 
                   profession === 'videographer' ? 'Video Comparison' :
                   profession === 'music_producer' ? 'Audio Comparison' :
                   'Product Comparison'}
            size="small"
            sx={{ bgcolor: `${accentColor}30`, color: 'white' }}
          />
        </Box>

        {/* Comparison Mode Toggle */}
        <ToggleButtonGroup
          value={comparisonMode}
          exclusive
          onChange={(_, newMode) => newMode && setComparisonMode(newMode)}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.2)', '&.Mui-selected': {
                bgcolor: accentColor,
                color: 'white'
              }
            }
          }}
        >
          <ToggleButton value="side-by-side">Side by Side</ToggleButton>
          <ToggleButton value="overlay">Overlay</ToggleButton>
          <ToggleButton value="slider">Slider</ToggleButton>
        </ToggleButtonGroup>

        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </Box>

      {/* Toolbar */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 2,
        bgcolor: 'rgba(0,0,0,0.6)',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Left Controls */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Tooltip title="Swap items">
            <IconButton onClick={swapItems} sx={{ color: 'white' }}>
              <SwapHoriz />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

          {/* Zoom Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton 
              onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
              sx={{ color: 'white' }}
              size="small"
            >
              <ZoomOut fontSize="small" />
            </IconButton>
            <Slider
              value={zoom}
              onChange={(_, value) => setZoom(value as number)}
              min={0.5}
              max={3}
              step={0.25}
              sx={{
                width: 100,
                color: accentColor,
                '& .MuiSlider-thumb': {
                  width: 12,
                  height: 12
                }
              }}
            />
            <IconButton 
              onClick={() => setZoom(prev => Math.min(prev + 0.25, 3))}
              sx={{ color: 'white' }}
              size="small"
            >
              <ZoomIn fontSize="small" />
            </IconButton>
            <Chip 
              label={`${Math.round(zoom * 100)}%`}
              size="small"
              onClick={() => setZoom(1)}
              sx={{ 
                bgcolor: `${accentColor}30`,
                color: 'white',
                cursor: 'pointer'
              }}
            />
          </Box>

          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

          {/* Sync Toggle */}
          <Tooltip title={syncZoom ? "Unlock zoom/pan" : "Lock zoom/pan"}>
            <IconButton 
              onClick={() => setSyncZoom(!syncZoom)}
              sx={{ color: syncZoom ? accentColor : 'rgba(255,255,255,0.5)' }}
            >
              {syncZoom ? <Lock /> : <LockOpen />}
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Right Controls */}
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => item1 && onPrefer?.(item1.id)}
            sx={{
              borderColor: `${accentColor}60`,
              color: accentColor, '&:hover': { borderColor: accentColor }
            }}
          >
            Prefer Left
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => item2 && onPrefer?.(item2.id)}
            sx={{
              borderColor: `${accentColor}60`,
              color: accentColor,
              '&:hover': { borderColor: accentColor }
            }}
          >
            Prefer Right
          </Button>
        </Stack>
      </Box>

      {/* Comparison Area */}
      <Box 
        ref={containerRef}
        sx={{ 
          flex: 1, 
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          cursor: zoom > 1 ? 'grab' : 'default', '&:active': {
            cursor: zoom > 1 ? 'grabbing' : 'default'
          }
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {comparisonMode === 'side-by-side' && (
          <Grid container sx={{ height: '100%' }}>
            {/* Left Item */}
            <Grid item xs={6} sx={{ 
              position: 'relative',
              borderRight: `2px solid ${accentColor}`,
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Navigation */}
              <Box sx={{ 
                position: 'absolute', 
                top: '50%', 
                left: 20, 
                zIndex: 1,
                transform: 'translateY(-50%)'
              }}>
                <IconButton
                  onClick={() => navigateItem(0, 'prev,')}
                  disabled={selectedItems[0] === 0}
                  sx={{
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: 'white','&:hover': { bgcolor: `${accentColor}80` }
                  }}
                >
                  <ArrowBack />
                </IconButton>
              </Box>

              <Box sx={{ 
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {item1?.fileType === 'photo' ? (
                  <img
                    src={item1.fileUrl || item1.thumbnailUrl}
                    alt={item1.title}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      transform: `scale(${zoom}) translate(${panPosition.x / zoom}px, ${panPosition.y / zoom}px)`,
                      transition: isDragging ? 'none' : 'transform 0.2s'
                    }}
                  />
                ) : item1?.fileType === 'video' ? (
                  <video
                    src={item1.fileUrl}
                    controls
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                  />
                ) : (
                  <Typography>Preview not available</Typography>
                )}
              </Box>

              {/* Item Info */}
              <Box sx={{ 
                p: 2, 
                bgcolor: 'rgba(0,0,0,0.8)',
                borderTop: '1px solid rgba(255,255,255,0.1)'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body1" fontWeight="600">{item1?.title}</Typography>
                    {item1?.description && (
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        {item1.description}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      onClick={() => item1 && onFavorite(item1.id)}
                      sx={{ color: favorites.has(item1?.id || ',') ? '#FF4444' : 'white' }}
                    >
                      {favorites.has(item1?.id || '') ? <Favorite /> : <FavoriteBorder />}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => item1 && onDownload?.(item1)}
                      sx={{ color: 'white' }}
                    >
                      <Download />
                    </IconButton>
                  </Stack>
                </Box>
              </Box>

              <Box sx={{ 
                position: 'absolute', 
                top: '50%', 
                right: 20, 
                zIndex: 1,
                transform: 'translateY(-50%)'
              }}>
                <IconButton
                  onClick={() => navigateItem(0, 'next')}
                  disabled={selectedItems[0] === items.length - 1}
                  sx={{
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: 'white','&:hover': { bgcolor: `${accentColor}80` }
                  }}
                >
                  <ArrowForward />
                </IconButton>
              </Box>
            </Grid>

            {/* Right Item */}
            <Grid item xs={6} sx={{ 
              position: 'relative',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Box sx={{ 
                position: 'absolute', 
                top: '50%', 
                left: 20, 
                zIndex: 1,
                transform: 'translateY(-50%)'
              }}>
                <IconButton
                  onClick={() => navigateItem(1, 'prev')}
                  disabled={selectedItems[1] === 0}
                  sx={{
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    '&:hover': { bgcolor: `${accentColor}80` }
                  }}
                >
                  <ArrowBack />
                </IconButton>
              </Box>

              <Box sx={{ 
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {item2?.fileType === 'photo' ? (
                  <img
                    src={item2.fileUrl || item2.thumbnailUrl}
                    alt={item2.title}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      transform: syncZoom ? `scale(${zoom}) translate(${panPosition.x / zoom}px, ${panPosition.y / zoom}px)` : 'scale(1)',
                      transition: isDragging ? 'none' : 'transform 0.2s'
                    }}
                  />
                ) : item2?.fileType === 'video' ? (
                  <video
                    src={item2.fileUrl}
                    controls
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                  />
                ) : (
                  <Typography>Preview not available</Typography>
                )}
              </Box>

              <Box sx={{ 
                p: 2, 
                bgcolor: 'rgba(0,0,0,0.8)',
                borderTop: '1px solid rgba(255,255,255,0.1)'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body1" fontWeight="600">{item2?.title}</Typography>
                    {item2?.description && (
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        {item2.description}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      onClick={() => item2 && onFavorite(item2.id)}
                      sx={{ color: favorites.has(item2?.id || '') ? '#FF4444' : 'white' }}
                    >
                      {favorites.has(item2?.id || '') ? <Favorite /> : <FavoriteBorder />}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => item2 && onDownload?.(item2)}
                      sx={{ color: 'white' }}
                    >
                      <Download />
                    </IconButton>
                  </Stack>
                </Box>
              </Box>

              <Box sx={{ 
                position: 'absolute', 
                top: '50%', 
                right: 20, 
                zIndex: 1,
                transform: 'translateY(-50%)'
              }}>
                <IconButton
                  onClick={() => navigateItem(1, 'next')}
                  disabled={selectedItems[1] === items.length - 1}
                  sx={{
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    '&:hover': { bgcolor: `${accentColor}80` }
                  }}
                >
                  <ArrowForward />
                </IconButton>
              </Box>
            </Grid>
          </Grid>
        )}

        {/* Overlay Mode */}
        {comparisonMode === 'overlay' && (
          <Box sx={{ 
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img
              src={item1?.fileUrl || item1?.thumbnailUrl}
              alt={item1?.title}
              style={{
                position: 'absolute',
                maxWidth: '80%',
                maxHeight: '80%',
                objectFit: 'contain',
                opacity: 1 - sliderPosition / 100
              }}
            />
            <img
              src={item2?.fileUrl || item2?.thumbnailUrl}
              alt={item2?.title}
              style={{
                position: 'absolute',
                maxWidth: '80%',
                maxHeight: '80%',
                objectFit: 'contain',
                opacity: sliderPosition / 100
              }}
            />
            <Box sx={{ 
              position: 'absolute',
              bottom: 40,
              width: '60%'
            }}>
              <Slider
                value={sliderPosition}
                onChange={(_, value) => setSliderPosition(value as number)}
                sx={{
                  color: accentColor, '& .MuiSlider-thumb': {
                    width: 20,
                    height: 20
                  }
                }}
              />
            </Box>
          </Box>
        )}

        {/* Slider Mode */}
        {comparisonMode === 'slider' && (
          <Box sx={{ 
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Box sx={{ position: 'relative', width: '80%', height: '80%' }}>
              <img
                src={item1?.fileUrl || item1?.thumbnailUrl}
                alt={item1?.title}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`
                }}
              />
              <img
                src={item2?.fileUrl || item2?.thumbnailUrl}
                alt={item2?.title}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  clipPath: `inset(0 0 0 ${sliderPosition}%)`
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  left: `${sliderPosition}%`,
                  top: 0,
                  bottom: 0,
                  width: 4,
                  bgcolor: accentColor,
                  cursor: 'ew-resize',
                  zIndex: 1}}
                onMouseDown={(e) => {
                  const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (!rect) return;
                  const handleMove = (moveEvent: MouseEvent) => {
                    const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
                    setSliderPosition(Math.max(0, Math.min(100, percent)));
                  };
                  const handleUp = () => {
                    document.removeEventListener('mousemove', handleMove);
                    document.removeEventListener('mouseup', handleUp);
                  };
                  document.addEventListener('mousemove', handleMove);
                  document.addEventListener('mouseup', handleUp);
                }}
              />
            </Box>
          </Box>
        )}
      </Box>

      {/* Footer Hint */}
      <Box sx={{ 
        p: 1, 
        bgcolor: 'rgba(0,0,0,0.8)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        textAlign: 'center'
      }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          {comparisonMode === 'slider' ? 'Drag slider to compare' : 
           comparisonMode === 'overlay' ? 'Use slider to blend images' : 'Use arrows to navigate • Click Prefer to mark favorite'}
        </Typography>
      </Box>
    </Dialog>
  );
};

export default ComparisonView;

