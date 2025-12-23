/**
 * HDRI Recommendation Dialog
 * 
 * Shows recommended HDRI environments after a character is selected.
 * Displays thumbnails, match scores, and reasons for each recommendation.
 */

import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid2 as Grid,
  Card,
  CardMedia,
  CardContent,
  CardActionArea,
  Chip,
  LinearProgress,
  Tooltip,
  Divider,
  IconButton,
  Stack,
  Alert,
} from '@mui/material';
import {
  Landscape,
  WbSunny,
  NightsStay,
  Home,
  Brightness4,
  CloudQueue,
  CheckCircle,
  Close,
  Star,
  StarBorder,
  Info,
} from '@mui/icons-material';
import {
  getHDRIRecommendations,
  HDRIRecommendation,
} from '../../core/services/hdriRecommendationService';
import { CachedActor } from '../../core/services/actorModelCache';

interface HDRIRecommendationDialogProps {
  open: boolean;
  onClose: () => void;
  actor: CachedActor | null;
  onSelectHDRI: (hdri: HDRIRecommendation) => void;
  onSkip: () => void;
}

const CATEGORY_ICONS: Record<string, React.ReactElement> = {
  studio: <Brightness4 />,
  outdoor: <WbSunny />,
  indoor: <Home />,
  sunset: <Landscape />,
  night: <NightsStay />,
  overcast: <CloudQueue />,
};

const CATEGORY_COLORS: Record<string, string> = {
  studio: '#7c4dff',
  outdoor: '#00c853',
  indoor: '#ff9100',
  sunset: '#ff5722',
  night: '#3d5afe',
  overcast: '#78909c',
};

export const HDRIRecommendationDialog: React.FC<HDRIRecommendationDialogProps> = ({
  open,
  onClose,
  actor,
  onSelectHDRI,
  onSkip,
}) => {
  const [selectedHDRI, setSelectedHDRI] = useState<HDRIRecommendation | null>(null);
  const [loading, setLoading] = useState(false);

  // Get recommendations based on character
  const recommendations = useMemo(() => {
    if (!actor) return [];
    
    const tags = actor.metadata?.tags || [];
    return getHDRIRecommendations(
      actor.name,
      tags,
      {
        genre: actor.metadata?.genre,
        era: actor.metadata?.era,
        mood: actor.metadata?.mood,
      }
    );
  }, [actor]);

  const handleSelect = (hdri: HDRIRecommendation) => {
    setSelectedHDRI(hdri);
  };

  const handleApply = () => {
    if (selectedHDRI) {
      setLoading(true);
      onSelectHDRI(selectedHDRI);
      // Small delay to show loading state
      setTimeout(() => {
        setLoading(false);
        onClose();
      }, 500);
    }
  };

  const handleSkip = () => {
    onSkip();
    onClose();
  };

  // Match score to stars
  const getStars = (score: number) => {
    const starCount = Math.round(score / 20); // 0-5 stars
    return Array.from({ length: 5 }, (_, i) => 
      i < starCount ? <Star key={i} sx={{ fontSize: 14, color: '#ffc107' }} /> : <StarBorder key={i} sx={{ fontSize: 14, color: '#555' }} />
    );
  };

  if (!actor) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a1a',
          color: 'white',
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="h6" component="span">
            Recommended Environments
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'block' }}>
            for {actor.name}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <Divider sx={{ borderColor: '#333' }} />

      <DialogContent sx={{ pt: 2 }}>
        {/* Character Info Banner */}
        <Alert 
          severity="info" 
          icon={<Info />}
          sx={{ 
            mb: 2, 
            bgcolor: 'rgba(33, 150, 243, 0.1)', 
            color: 'white', '& .MuiAlert-icon': { color: '#2196f3' }
          }}
        >
          <Typography variant="body2">
            Based on character type
            {actor.metadata?.genre && `, ${actor.metadata.genre} genre`}
            {actor.metadata?.era && `, ${actor.metadata.era} era`}
            {actor.metadata?.mood && `, and ${actor.metadata.mood} mood`}
          </Typography>
        </Alert>

        {/* HDRI Grid */}
        <Grid container spacing={2}>
          {recommendations.map((hdri) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={hdri.id}>
              <Card 
                sx={{ 
                  bgcolor: selectedHDRI?.id === hdri.id ? 'rgba(76, 175, 80, 0.2)' : '#2a2a2a',
                  border: selectedHDRI?.id === hdri.id ? '2px solid #4caf50' : '2px solid transparent',
                  borderRadius: 2,
                  transition: 'all 0.2s ease','&:hover': {
                    bgcolor: selectedHDRI?.id === hdri.id ? 'rgba(76, 175, 80, 0.25)' : '#333',
                    transform: 'translateY(-2px)',
                  }
                }}
              >
                <CardActionArea onClick={() => handleSelect(hdri)}>
                  <Box sx={{ position: 'relative' }}>
                    <CardMedia
                      component="img"
                      height="120"
                      image={hdri.thumbnail}
                      alt={hdri.name}
                      sx={{ 
                        objectFit: 'cover',
                        filter: loading ? 'blur(2px)' : 'none'}}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-hdri.png';
                      }}
                    />
                    
                    {/* Category Badge */}
                    <Chip
                      icon={CATEGORY_ICONS[hdri.category] || <Landscape />}
                      label={hdri.category}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        bgcolor: CATEGORY_COLORS[hdri.category] || '#666',
                        color: 'white',
                        fontSize: '0.7rem',
                        height: 24'& .MuiChip-icon': { color: 'white', fontSize: 14 }}}
                    />

                    {/* Selected Checkmark */}
                    {selectedHDRI?.id === hdri.id && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          bgcolor: '#4caf50',
                          borderRadius: '50%',
                          p: 0.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'}}
                      >
                        <CheckCircle sx={{ fontSize: 20, color: 'white' }} />
                      </Box>
                    )}

                    {/* Match Score Bar */}
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        px: 1,
                        py: 0.5}}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ color: 'white' }}>
                          Match
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {getStars(hdri.matchScore)}
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={hdri.matchScore}
                        sx={{
                          height: 4,
                          borderRadius: 2,
                          bgcolor: 'rgba(255,255,255,0.1)','& .MuiLinearProgress-bar': {
                            bgcolor: hdri.matchScore >= 80 ? '#4caf50' : 
                                    hdri.matchScore >= 50 ? '#ff9800' : '#f44336',
                          }}}
                      />
                    </Box>
                  </Box>

                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="subtitle2" noWrap sx={{ color: 'white', fontWeight: 600}}>
                      {hdri.name}
                    </Typography>
                    <Tooltip title={hdri.reason} placement="bottom">
                      <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        sx={{ 
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'}}
                      >
                        {hdri.reason}
                      </Typography>
                    </Tooltip>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>

        {recommendations.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No specific recommendations found. Using default studio lighting.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <Divider sx={{ borderColor: '#333' }} />

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button 
          onClick={handleSkip} 
          color="inherit"
          sx={{ color: '#999' }}
        >
          Skip (Keep Current)
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            variant="contained"
            color="primary"
            disabled={!selectedHDRI || loading}
            startIcon={loading ? undefined : <CheckCircle />}
          >
            {loading ? 'Applying...' : 'Apply Environment'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default HDRIRecommendationDialog;

