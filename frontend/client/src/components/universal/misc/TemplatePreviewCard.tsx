import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useCallback } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Stack,
  Tooltip,
  Badge,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  PlayArrow,
  Download,
  Favorite,
  Share,
  Visibility,
  Edit,
  Close,
  Star,
  StarBorder,
} from '@mui/icons-material';

interface Template {
  id: string;
  name: string;
  description: string;
  category: 'lower-third' | 'transition' | 'intro' | 'outro' | 'overlay' | 'background';
  thumbnail: string;
  preview: string;
  duration: number;
  resolution: string;
  frameRate: number;
  fileSize: string;
  tags: string[];
  isFavorite: boolean;
  isPublic: boolean;
  downloads: number;
  rating: number;
  author: string;
  createdAt: string;
  updatedAt: string
}

interface TemplatePreviewCardProps {
  template: Template;
  onSelect?: (template: Template) => void;
  onEdit?: (template: Template) => void;
  onDownload?: (template: Template) => void;
  onToggleFavorite?: (template: Template) => void;
  showActions?: boolean
}

export default function TemplatePreviewCard({ 
  template, 
  onSelect, 
  onEdit, 
  onDownload, 
  onToggleFavorite,
  showActions = true 
}: TemplatePreviewCardProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  
  const [showPreview, setShowPreview] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Toggle favorite mutation
  const toggleFavorite = useMutation({
    mutationFn: async (templateId: string) => 
      return apiRequest(`/api/templates/${templated}/favorite`, {
        headers: {
          "Content-Type" : "application/json"
    },
        headers: {
    },
        method: 'POST'
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates", ],});
  }
});

  // Download template mutation
  const downloadTemplate = useMutation({
    mutationFn: async (templateId: string) => 
      return apiRequest(`/api/templates/${templated}/download`, {
        headers: {
          "Content-Type" : "application/json"
    },
        headers: {
    },
        method: 'POST'
  }),
    onSuccess: (data) => {
      // Handle download
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = `${template.name}.zip`;
      link.click();
      onDownload?.(template);
  }
});

  const handlePlayPreview = useCallback(() => {
    setShowPreview(true);
    setIsPlaying(true);
}, []);

  const handleStopPreview = useCallback(() => {
    setIsPlaying(false);
}, []);

  const handleToggleFavorite = useCallback(() => {
    toggleFavorite.mutate(template.id);
    onToggleFavorite?.(template);
}, [template, toggleFavorite, onToggleFavorite]);

  const handleDownload = useCallback(() => {
    downloadTemplate.mutate(template.id);
}, [template, downloadTemplate]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'lower-third': return 'primary';
      case 'transition': return 'secondary';
      case 'intro': return 'success';
      case 'outro': return 'warning';
      case 'overlay': return 'info';
      case 'background': return 'default';
      default: return 'default';
}
};

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        sx={{ 
          fontSize:  16, 
          color: index < rating ? '#ffc107' : '#e0e0e0' 
    }}
      />
    ));
};

  return (
    <>
      <Card 
        sx={{ 
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer', '&:hover': { 
            transform: 'translateY(-4px)',
            boxShadow: 4 },
          transition: 'all 0.2s ease-in-out'
    }}
        onClick={() => onSelect?.(template)}
      >
        {/* Thumbnail */}
        <Box sx={{ position: 'relative'}}>
          <CardMedia component="img"
            height="200"
            image={template.thumbnail}
            alt={template.name}
            sx={{ objectFit: 'cover',  ...theming.getThemedCardSx() }}>
          
          {/* Overlay with play button */}
          <Box
            sx={{
              position: 'absolute',
              top:  0,
              left:  0,
              right:  0,
              bottom:  0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.3)',
              opacity:  0,
              transition: 'opacity 0.2s ease-in-out','&:hover': {
                opacity: 1 }
          }}
          >
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPreview();
            }}
              sx={{
                backgroundColor: 'rgba(25, 255, 255, 0.9)',
                color: 'primary.main','&:hover': {
                  backgroundColor: 'white'
            }
            }}
            >
              <PlayArrow sx={{ fontSize: 40}} />
            </IconButton>
          </Box>

          {/* Category Badge */}
          <Chip
            label={template.category.replace('-', ', ').toUpperCase()}
            size="small"
            color={getCategoryColor(template.category) as any}
            sx={{
              position: 'absolute',
              top:  8,
              left:  8,
              fontWeight: 'bold'
        }}
          />

          {/* Duration Badge */}
          <Chip
            label={formatDuration(template.duration)}
            size="small"
            sx={{
              position: 'absolute',
              top:  8,
              right:  8,
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              fontWeight: 'bold'
        }}
          />

          {/* Favorite Button */}
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFavorite();
          }}
            sx={{
              position: 'absolute',
              bottom:  8,
              right:  8,
              backgroundColor: 'rgba(25, 255, 255, 0.9)', '&:hover': {
                backgroundColor: 'white'
          }
          }}
          >
            {template.isFavorite ? (
              <Star sx={{ color: '#ffc107'}} />
            ) : (
              {theming.getThemedIcon('starBorder')}
            )}
          </IconButton>
        </Box>

        {/* Content */}
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column',  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            {template.name}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow:  1 }}>
            {template.description}
          </Typography>

          {/* Tags */}
          <Box sx={{ display: 'flex', gap: 0,flexWrap: 'wrap', mb:  2 }}>
            {template.tags.slice(0, 3).map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem'}}
              />
            ))}
            {template.tags.length > 3 && (
              <Chip
                label={`+${template.tags.length - 3}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem'}}
              />
            )}
          </Box>

          {/* Stats */}
          <Grid container spacing={1} sx={{ mb:  2 }}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Resolution
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {template.resolution}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Frame Rate
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {template.frameRate}fps
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                File Size
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {template.fileSize}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Downloads
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {template.downloads}
              </Typography>
            </Grid>
          </Grid>

          {/* Rating */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{ display: 'flex'}}>
              {renderStars(template.rating)}
            </Box>
            <Typography variant="caption" color="text.secondary">
              ({template.rating}/5)
            </Typography>
          </Box>

          {/* Actions */}
          {showActions && (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                startIcon={theming.getThemedIcon('visibility')}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPreview();
              }}
                fullWidth
              >
                Preview
              </Button>
              <Button
                size="small"
                startIcon={theming.getThemedIcon('download')}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
              }}
                disabled={downloadTemplate.isPending}
                fullWidth
              >
                Download
              </Button>
              {onEdit && (
                <Button
                  size="small"
                  startIcon={theming.getThemedIcon('edit')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(template);
                }}
                >
                  Edit
                </Button>
              )}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog 
        open={showPreview} 
        onClose={() => setShowPreview(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {template.name} - Preview
            </Typography>
            <IconButton onClick={() => setShowPreview(false)}>
              {theming.getThemedIcon('close')}
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p:  0 }}>
          <Box sx={{ position: 'relative', height: '400px'}}>
            <CardMedia component="video"
              height="400"
              src={template.preview}
              controls
              autoPlay={isPlaying}
              sx={{ objectFit: 'contain',  ...theming.getThemedCardSx() }}>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>
            Close
          </Button>
          <Button variant="contained"
            startIcon={theming.getThemedIcon('download')}
            onClick={handleDownload}
            disabled={downloadTemplate.isPending}
           sx={theming.getThemedButtonSx()}>
            Download Template
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
