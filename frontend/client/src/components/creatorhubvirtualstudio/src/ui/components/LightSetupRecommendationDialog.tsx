/**
 * Light Setup Recommendation Dialog
 * 
 * Shows recommended lighting setups after HDRI is selected.
 * Displays light diagrams, ratios, and tips for each setup.
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
  CardContent,
  CardActionArea,
  Chip,
  LinearProgress,
  Tooltip,
  Divider,
  IconButton,
  Stack,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Lightbulb,
  WbIncandescent,
  FlashlightOn,
  Brightness5,
  Brightness6,
  Brightness7,
  CheckCircle,
  Close,
  Star,
  StarBorder,
  Info,
  TipsAndUpdates,
  Camera,
  HighlightAlt,
} from '@mui/icons-material';
import {
  getLightSetupRecommendations,
  LightSetupRecommendation,
  CharacterContext,
  HDRIContext,
  LightConfig,
} from '../../core/services/lightSetupRecommendationService';
import { CachedActor } from '../../core/services/actorModelCache';
import { HDRIRecommendation } from '../../core/services/hdriRecommendationService';

interface LightSetupRecommendationDialogProps {
  open: boolean;
  onClose: () => void;
  actor: CachedActor | null;
  hdri: HDRIRecommendation | null;
  onSelectSetup: (setup: LightSetupRecommendation) => void;
  onSkip: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  portrait: '#4caf50',
  dramatic: '#f44336',
  commercial: '#2196f3',
  natural: '#ff9800',
  cinematic: '#9c27b0',
  practical: '#795548',
};

const CATEGORY_ICONS: Record<string, React.ReactElement> = {
  portrait: <Camera />,
  dramatic: <Brightness6 />,
  commercial: <Brightness7 />,
  natural: <WbIncandescent />,
  cinematic: <FlashlightOn />,
  practical: <Lightbulb />,
};

// Simple light diagram component
const LightDiagram: React.FC<{ lights: LightConfig[] }> = ({ lights }) => {
  return (
    <Box
      sx={{
        width: '100%',
        height: 100,
        bgcolor: '#1a1a1a',
        borderRadius: 1,
        position: 'relative',
        overflow: 'hidden'}}
    >
      {/* Subject indicator */}
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 24,
          height: 24,
          borderRadius: '50%',
          bgcolor: '#666',
          border: '2px solid #888',
          zIndex: 2}}
      />
      
      {/* Light positions */}
      {lights.filter(l => l.enabled).map((light, index) => {
        // Convert 3D position to 2D diagram position
        const x = 50 + (light.position.x / 4) * 40; // Scale to percentage
        const y = 50 - (light.position.z / 4) * 40;
        
        const lightColors: Record<string, string> = {
          key: '#ffeb3b',
          fill: '#90caf9',
          rim: '#ff9800',
          hair: '#e91e63',
          background: '#4caf50',
          accent: '#ce93d8',
        };
        
        return (
          <Tooltip key={index} title={`${light.name} (${light.power}%)`}>
            <Box
              sx={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                width: 12 + (light.power / 20),
                height: 12 + (light.power / 20),
                borderRadius: '50%',
                bgcolor: lightColors[light.type] || '#fff',
                boxShadow: `0 0 ${light.power / 10}px ${lightColors[light.type] || '#fff'}`,
                zIndex: 3,
                cursor: 'pointer'}}
            />
          </Tooltip>
        );
      })}
      
      {/* Camera indicator */}
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          bottom: 8,
          transform: 'translateX(-50%)',
          fontSize: 16,
          color: '#666'}}
      >
        <Camera sx={{ fontSize: 18 }} />
      </Box>
    </Box>
  );
};

export const LightSetupRecommendationDialog: React.FC<LightSetupRecommendationDialogProps> = ({
  open,
  onClose,
  actor,
  hdri,
  onSelectSetup,
  onSkip,
}) => {
  const [selectedSetup, setSelectedSetup] = useState<LightSetupRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTips, setShowTips] = useState<string | null>(null);

  // Get recommendations based on character and HDRI
  const recommendations = useMemo(() => {
    if (!actor) return [];
    
    const characterContext: CharacterContext = {
      name: actor.name,
      tags: actor.metadata?.tags || [],
      genre: actor.metadata?.genre,
      era: actor.metadata?.era,
      mood: actor.metadata?.mood,
    };
    
    const hdriContext: HDRIContext | undefined = hdri ? {
      id: hdri.id,
      category: hdri.category,
      name: hdri.name,
    } : undefined;
    
    return getLightSetupRecommendations(characterContext, hdriContext);
  }, [actor, hdri]);

  const handleSelect = (setup: LightSetupRecommendation) => {
    setSelectedSetup(setup);
    setShowTips(null);
  };

  const handleApply = () => {
    if (selectedSetup) {
      setLoading(true);
      onSelectSetup(selectedSetup);
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
    const starCount = Math.round(score / 20);
    return Array.from({ length: 5 }, (_, i) => 
      i < starCount ? <Star key={i} sx={{ fontSize: 14, color: '#ffc107' }} /> : <StarBorder key={i} sx={{ fontSize: 14, color: '#555' }} />
    );
  };

  if (!actor) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a1a',
          color: 'white',
          borderRadius: 2,
          maxHeight: '90vh',
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="h6" component="span">
            Recommended Lighting Setups
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'block' }}>
            for {actor.name}
            {hdri && ` with ${hdri.name}`}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <Divider sx={{ borderColor: '#333' }} />

      <DialogContent sx={{ pt: 2 }}>
        {/* Context Info Banner */}
        <Alert 
          severity="info" 
          icon={<Lightbulb />}
          sx={{ 
            mb: 2, 
            bgcolor: 'rgba(255, 193, 7, 0.1)', 
            color: 'white', '& .MuiAlert-icon': { color: '#ffc107' }
          }}
        >
          <Typography variant="body2">
            Lighting setups optimized for
            {actor.metadata?.genre && ` ${actor.metadata.genre}`} character
            {hdri && ` in ${hdri.category} environment`}
          </Typography>
        </Alert>

        {/* Setup Grid */}
        <Grid container spacing={2}>
          {recommendations.map((setup) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={setup.id}>
              <Card 
                sx={{ 
                  bgcolor: selectedSetup?.id === setup.id ? 'rgba(76, 175, 80, 0.2)' : '#2a2a2a',
                  border: selectedSetup?.id === setup.id ? '2px solid #4caf50' : '2px solid transparent',
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column','&:hover': {
                    bgcolor: selectedSetup?.id === setup.id ? 'rgba(76, 175, 80, 0.25)' : '#333',
                    transform: 'translateY(-2px)',
                  }
                }}
              >
                <CardActionArea 
                  onClick={() => handleSelect(setup)}
                  sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                >
                  {/* Light Diagram */}
                  <Box sx={{ p: 1.5, pb: 0 }}>
                    <LightDiagram lights={setup.lights} />
                  </Box>

                  <CardContent sx={{ py: 1.5, flexGrow: 1 }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600}}>
                        {setup.name}
                      </Typography>
                      {selectedSetup?.id === setup.id && (
                        <CheckCircle sx={{ fontSize: 18, color: '#4caf50' }} />
                      )}
                    </Box>
                    
                    {/* Category Badge */}
                    <Chip
                      icon={CATEGORY_ICONS[setup.category]}
                      label={setup.category}
                      size="small"
                      sx={{
                        bgcolor: CATEGORY_COLORS[setup.category] || '#666',
                        color: 'white',
                        fontSize: '0.65rem',
                        height: 22,
                        mb: 1'& .MuiChip-icon': { color: 'white', fontSize: 12 }}}
                    />

                    {/* Description */}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      {setup.description}
                    </Typography>

                    {/* Key stats */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      <Chip 
                        label={`Ratio: ${setup.keyToFillRatio}`} 
                        size="small" 
                        sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#444' }} 
                      />
                      <Chip 
                        label={`${setup.lights.length} lights`} 
                        size="small" 
                        sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#444' }} 
                      />
                    </Box>

                    {/* Mood */}
                    <Typography variant="caption" sx={{ color: '#aaa', fontStyle: 'italic', display: 'block' }}>
                      {setup.mood}
                    </Typography>

                    {/* Match Score */}
                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getStars(setup.matchScore)}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {setup.matchScore}% match
                      </Typography>
                    </Box>
                    
                    <LinearProgress
                      variant="determinate"
                      value={setup.matchScore}
                      sx={{
                        height: 3,
                        borderRadius: 2,
                        mt: 0.5,
                        bgcolor: 'rgba(255,255,255,0.1)','& .MuiLinearProgress-bar': {
                          bgcolor: setup.matchScore >= 80 ? '#4caf50' : 
                                  setup.matchScore >= 50 ? '#ff9800' : '#f44336',
                        }}}
                    />
                  </CardContent>
                </CardActionArea>

                {/* Tips button */}
                <Box sx={{ p: 1, pt: 0, display: 'flex', justifyContent: 'flex-end' }}>
                  <Tooltip title="View tips">
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTips(showTips === setup.id ? null : setup.id);
                      }}
                      sx={{ color: showTips === setup.id ? '#ffc107' : '#666' }}
                    >
                      <TipsAndUpdates sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Tips Panel */}
        {showTips && (
          <Box sx={{ mt: 2, p: 2, bgcolor: '#2a2a2a', borderRadius: 2, border: '1px solid #444' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TipsAndUpdates sx={{ color: '#ffc107' }} />
              Pro Tips for {recommendations.find(s => s.id === showTips)?.name}
            </Typography>
            <List dense sx={{ py: 0 }}>
              {recommendations.find(s => s.id === showTips)?.tips.map((tip, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <HighlightAlt sx={{ fontSize: 16, color: '#888' }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary={tip} 
                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Selected Setup Details */}
        {selectedSetup && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 2, border: '1px solid #4caf50' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Selected: {selectedSetup.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {selectedSetup.reason}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selectedSetup.bestFor.map((use, i) => (
                <Chip 
                  key={i} 
                  label={use} 
                  size="small" 
                  sx={{ fontSize: '0.65rem', height: 20, bgcolor: '#333' }} 
                />
              ))}
            </Box>
          </Box>
        )}

        {recommendations.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No specific recommendations found. Using classic portrait lighting.
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
          Skip (Keep Current Lights)
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            variant="contained"
            color="primary"
            disabled={!selectedSetup || loading}
            startIcon={loading ? undefined : <Lightbulb />}
          >
            {loading ? 'Applying...' : 'Apply Lighting'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default LightSetupRecommendationDialog;

