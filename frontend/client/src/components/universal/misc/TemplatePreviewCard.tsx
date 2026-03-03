import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Close,
  Download,
  Edit,
  PlayArrow,
  Share,
  Star,
  StarBorder,
  Visibility,
} from '@mui/icons-material';

export interface Template {
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
  updatedAt: string;
}

interface TemplatePreviewCardProps {
  template: Template;
  onSelect?: (template: Template) => void;
  onEdit?: (template: Template) => void;
  onDownload?: (template: Template) => void;
  onToggleFavorite?: (template: Template) => void;
  showActions?: boolean;
}

type ChipColor = 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'default';

const getCategoryColor = (category: Template['category']): ChipColor => {
  if (category === 'lower-third') return 'primary';
  if (category === 'transition') return 'secondary';
  if (category === 'intro') return 'success';
  if (category === 'outro') return 'warning';
  if (category === 'overlay') return 'info';
  return 'default';
};

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
};

const clampRating = (value: number): number => Math.max(0, Math.min(5, Math.round(value)));

const resolveDownloadUrl = (payload: unknown, fallbackUrl: string): string => {
  if (payload && typeof payload === 'object' && 'downloadUrl' in payload) {
    const raw = (payload as { downloadUrl?: unknown }).downloadUrl;
    if (typeof raw === 'string' && raw.length > 0) {
      return raw;
    }
  }
  return fallbackUrl;
};

export default function TemplatePreviewCard({
  template,
  onSelect,
  onEdit,
  onDownload,
  onToggleFavorite,
  showActions = true,
}: TemplatePreviewCardProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [showPreview, setShowPreview] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/templates/${encodeURIComponent(template.id)}/favorite`, {
        method: 'POST',
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
    },
  });

  const downloadTemplateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/templates/${encodeURIComponent(template.id)}/download`, {
        method: 'POST',
      });
    },
    onSuccess: (payload) => {
      const url = resolveDownloadUrl(payload, template.preview);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${template.name}.zip`;
      anchor.click();
      onDownload?.(template);
    },
  });

  const starIcons = useMemo(() => {
    const rating = clampRating(template.rating);
    return Array.from({ length: 5 }, (_, index) =>
      index < rating ? (
        <Star key={index} sx={{ fontSize: 16, color: '#f59e0b' }} />
      ) : (
        <StarBorder key={index} sx={{ fontSize: 16, color: '#d1d5db' }} />
      ),
    );
  }, [template.rating]);

  const handleOpenPreview = useCallback(() => {
    setShowPreview(true);
    setIsPlayingPreview(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
    setIsPlayingPreview(false);
  }, []);

  const handleToggleFavorite = useCallback(() => {
    toggleFavoriteMutation.mutate();
    onToggleFavorite?.(template);
  }, [onToggleFavorite, template, toggleFavoriteMutation]);

  const handleDownload = useCallback(() => {
    downloadTemplateMutation.mutate();
  }, [downloadTemplateMutation]);

  return (
    <>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
        }}
        onClick={() => onSelect?.(template)}
      >
        <Box sx={{ position: 'relative' }}>
          <CardMedia component="img" height="200" image={template.thumbnail} alt={template.name} />

          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.3)',
              opacity: 0,
              transition: 'opacity 0.2s ease-in-out',
              '&:hover': { opacity: 1 },
            }}
          >
            <IconButton
              onClick={(event) => {
                event.stopPropagation();
                handleOpenPreview();
              }}
              sx={{ bgcolor: 'rgba(255,255,255,0.9)', color: 'primary.main' }}
            >
              <PlayArrow sx={{ fontSize: 36 }} />
            </IconButton>
          </Box>

          <Chip
            label={template.category.replace('-', ' ').toUpperCase()}
            size="small"
            color={getCategoryColor(template.category)}
            sx={{ position: 'absolute', top: 8, left: 8, fontWeight: 700 }}
          />

          <Chip
            label={formatDuration(template.duration)}
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.72)',
              color: 'white',
            }}
          />

          <IconButton
            onClick={(event) => {
              event.stopPropagation();
              handleToggleFavorite();
            }}
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              bgcolor: 'rgba(255,255,255,0.9)',
            }}
          >
            {template.isFavorite ? <Star sx={{ color: '#f59e0b' }} /> : <StarBorder />}
          </IconButton>
        </Box>

        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" gutterBottom>
            {template.name}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
            {template.description}
          </Typography>

          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
            {template.tags.slice(0, 3).map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.72rem' }} />
            ))}
            {template.tags.length > 3 ? (
              <Chip label={`+${template.tags.length - 3}`} size="small" variant="outlined" sx={{ fontSize: '0.72rem' }} />
            ) : null}
          </Box>

          <Grid container spacing={1} sx={{ mb: 1.5 }}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Resolution
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {template.resolution}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Frame Rate
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {template.frameRate}fps
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                File Size
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {template.fileSize}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Downloads
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {template.downloads}
              </Typography>
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
            {starIcons}
            <Typography variant="caption" color="text.secondary">
              ({template.rating.toFixed(1)}/5)
            </Typography>
          </Box>

          {showActions ? (
            <Stack direction="row" spacing={1}>
              <Tooltip title="Preview">
                <Button
                  size="small"
                  startIcon={<Visibility />}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenPreview();
                  }}
                  fullWidth
                >
                  Preview
                </Button>
              </Tooltip>
              <Tooltip title="Download">
                <Button
                  size="small"
                  startIcon={<Download />}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDownload();
                  }}
                  disabled={downloadTemplateMutation.isPending}
                  fullWidth
                >
                  Download
                </Button>
              </Tooltip>
              {onEdit ? (
                <Tooltip title="Edit">
                  <Button
                    size="small"
                    startIcon={<Edit />}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(template);
                    }}
                  >
                    Edit
                  </Button>
                </Tooltip>
              ) : null}
            </Stack>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={showPreview} onClose={handleClosePreview} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">{template.name} - Preview</Typography>
            <IconButton onClick={handleClosePreview}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ position: 'relative', height: 420, bgcolor: 'black' }}>
            <CardMedia
              component="video"
              height="420"
              src={template.preview}
              controls
              autoPlay={isPlayingPreview}
              sx={{ objectFit: 'contain' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePreview}>Close</Button>
          <Button variant="outlined" startIcon={<Share />} onClick={() => onSelect?.(template)}>
            Select Template
          </Button>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleDownload}
            disabled={downloadTemplateMutation.isPending}
          >
            Download Template
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
