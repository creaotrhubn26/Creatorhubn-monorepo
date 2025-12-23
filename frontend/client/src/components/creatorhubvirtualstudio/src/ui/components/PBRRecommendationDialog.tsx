/**
 * PBR Recommendation Dialog
 * 
 * Shows recommended props, backdrops, and materials after HDRI is selected.
 * Allows users to add scene elements that complement their character and environment.
 * 
 * Flow: Character → HDRI → PBR/Props → Light Setup → Add to Scene
 * (Props before Lights because lighting needs to account for all surfaces)
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
  CardMedia,
  CardActionArea,
  Chip,
  Checkbox,
  FormControlLabel,
  Divider,
  IconButton,
  Stack,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  ViewInAr,
  Chair,
  Wallpaper,
  Layers,
  Build,
  CheckCircle,
  Close,
  Star,
  ExpandMore,
  Add,
  Remove,
  ShoppingCart,
  AutoAwesome,
} from '@mui/icons-material';
import {
  getPBRRecommendations,
  PBRRecommendation,
  PBRItem,
  CharacterContext,
} from '../../core/services/pbrRecommendationService';
import { CachedActor } from '../../core/services/actorModelCache';
import { HDRIRecommendation } from '../../core/services/hdriRecommendationService';

interface PBRRecommendationDialogProps {
  open: boolean;
  onClose: () => void;
  actor: CachedActor | null;
  hdri: HDRIRecommendation | null; // Changed: Now uses HDRI instead of lighting
  onSelectItems: (items: PBRItem[]) => void;
  onSkip: () => void;
}

const CATEGORY_ICONS: Record<string, React.ReactElement> = {
  essential: <Star />,
  recommended: <AutoAwesome />,
  optional: <Add />,
  atmosphere: <Layers />,
};

const CATEGORY_COLORS: Record<string, string> = {
  essential: '#f44336',
  recommended: '#ff9800',
  optional: '#4caf50',
  atmosphere: '#2196f3',
};

const TYPE_ICONS: Record<string, React.ReactElement> = {
  prop: <ViewInAr />,
  backdrop: <Wallpaper />,
  floor: <Layers />,
  furniture: <Chair />,
  tool: <Build />,
  accessory: <ViewInAr />,
};

export const PBRRecommendationDialog: React.FC<PBRRecommendationDialogProps> = ({
  open,
  onClose,
  actor,
  hdri, // Changed: Now uses HDRI instead of lighting
  onSelectItems,
  onSkip,
}) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedCategory, setExpandedCategory] = useState<string | null>('essential-bundle');
  const [loading, setLoading] = useState(false);

  // Get recommendations based on character and HDRI environment
  const recommendations = useMemo(() => {
    if (!actor) return [];
    
    const characterContext: CharacterContext = {
      name: actor.name,
      tags: actor.metadata?.tags || [],
      genre: actor.metadata?.genre,
      mood: actor.metadata?.mood,
    };
    
    // Pass HDRI category for environment-aware recommendations
    const hdriContext = hdri ? {
      id: hdri.id,
      name: hdri.name,
      category: hdri.category,
    } : undefined;
    
    return getPBRRecommendations(characterContext, hdriContext);
  }, [actor, hdri]);

  // Auto-select essential items on load
  React.useEffect(() => {
    if (open && recommendations.length > 0) {
      const essentialBundle = recommendations.find(r => r.category === 'essential');
      if (essentialBundle) {
        const essentialIds = new Set(essentialBundle.items.map(item => item.id));
        setSelectedItems(essentialIds);
      }
    }
  }, [open, recommendations]);

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleBundle = (bundle: PBRRecommendation, select: boolean) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      bundle.items.forEach(item => {
        if (select) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      });
      return next;
    });
  };

  const isBundleSelected = (bundle: PBRRecommendation) => {
    return bundle.items.every(item => selectedItems.has(item.id));
  };

  const isBundlePartiallySelected = (bundle: PBRRecommendation) => {
    const selectedCount = bundle.items.filter(item => selectedItems.has(item.id)).length;
    return selectedCount > 0 && selectedCount < bundle.items.length;
  };

  const handleApply = () => {
    // Gather all selected items
    const allItems = recommendations.flatMap(r => r.items);
    const selected = allItems.filter(item => selectedItems.has(item.id));
    
    if (selected.length > 0) {
      setLoading(true);
      onSelectItems(selected);
      setTimeout(() => {
        setLoading(false);
        onClose();
      }, 500);
    } else {
      onSkip();
      onClose();
    }
  };

  const handleSkip = () => {
    onSkip();
    onClose();
  };

  // Get material preview color
  const getMaterialPreview = (item: PBRItem) => {
    if (item.material?.color) {
      return item.material.color;
    }
    return '#666';
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
            Scene Props & Materials
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'block' }}>
            Add PBR elements for {actor.name}
            {lighting && ` with ${lighting.name}`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Badge badgeContent={selectedItems.size} color="primary">
            <ShoppingCart />
          </Badge>
          <IconButton onClick={onClose} size="small" sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>

      <Divider sx={{ borderColor: '#333' }} />

      <DialogContent sx={{ pt: 2 }}>
        {/* Context Info Banner */}
        <Alert 
          severity="info" 
          icon={<ViewInAr />}
          sx={{ 
            mb: 2, 
            bgcolor: 'rgba(156, 39, 176, 0.1)', 
            color: 'white','& .MuiAlert-icon': { color: '#9c27b0' }
          }}
        >
          <Typography variant="body2">
            Props and materials selected based on
            {actor.metadata?.genre && ` ${actor.metadata.genre}`} character
            {lighting && ` and ${lighting.category} lighting`}
          </Typography>
        </Alert>

        {/* Recommendation Bundles */}
        {recommendations.map((bundle) => (
          <Accordion 
            key={bundle.id}
            expanded={expandedCategory === bundle.id}
            onChange={(_, expanded) => setExpandedCategory(expanded ? bundle.id : null)}
            sx={{ 
              bgcolor: '#2a2a2a', 
              mb: 1, '&:before': { display: 'none' },
              borderRadius: '8px !important',
              overflow: 'hidden'}}
          >
            <AccordionSummary 
              expandIcon={<ExpandMore sx={{ color: 'white' }} />}
              sx={{ 
                borderLeft: `4px solid ${CATEGORY_COLORS[bundle.category]}`, '&:hover': { bgcolor: '#333' }}}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 2 }}>
                <Checkbox
                  checked={isBundleSelected(bundle)}
                  indeterminate={isBundlePartiallySelected(bundle)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleBundle(bundle, !isBundleSelected(bundle));
                  }}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ color: CATEGORY_COLORS[bundle.category] }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                  {CATEGORY_ICONS[bundle.category]}
                  <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                    {bundle.name}
                  </Typography>
                  <Chip 
                    label={`${bundle.items.length} items`} 
                    size="small" 
                    sx={{ 
                      fontSize: '0.65rem', 
                      height: 20, 
                      bgcolor: CATEGORY_COLORS[bundle.category],
                      color: 'white'}} 
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
                  {bundle.reason}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {bundle.description}
              </Typography>
              <Grid container spacing={2}>
                {bundle.items.map((item) => (
                  <Grid size={{ xs: 6, sm: 4, md: 3 }} key={item.id}>
                    <Card 
                      sx={{ 
                        bgcolor: selectedItems.has(item.id) ? 'rgba(76, 175, 80, 0.2)' : '#1a1a1a',
                        border: selectedItems.has(item.id) ? '2px solid #4caf50' : '2px solid #333',
                        borderRadius: 2,
                        transition: 'all 0.2s ease','&:hover': {
                          bgcolor: selectedItems.has(item.id) ? 'rgba(76, 175, 80, 0.25)' : '#252525',
                          transform: 'translateY(-2px)',
                        }
                      }}
                    >
                      <CardActionArea onClick={() => toggleItem(item.id)}>
                        {/* Material Preview */}
                        <Box 
                          sx={{ 
                            height: 80, 
                            bgcolor: getMaterialPreview(item),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'}}
                        >
                          {/* Type Icon */}
                          <Box sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 40 }}>
                            {TYPE_ICONS[item.type]}
                          </Box>
                          
                          {/* Selected Checkmark */}
                          {selectedItems.has(item.id) && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                bgcolor: '#4caf50',
                                borderRadius: '50%',
                                p: 0.3}}
                            >
                              <CheckCircle sx={{ fontSize: 16, color: 'white' }} />
                            </Box>
                          )}

                          {/* Type Badge */}
                          <Chip
                            label={item.type}
                            size="small"
                            sx={{
                              position: 'absolute',
                              bottom: 4,
                              left: 4,
                              fontSize: '0.6rem',
                              height: 18,
                              bgcolor: 'rgba(0,0,0,0.6)',
                              color: 'white'}}
                          />
                        </Box>

                        <CardContent sx={{ py: 1, px: 1.5 }}>
                          <Typography variant="body2" noWrap sx={{ color: 'white', fontWeight: 500}}>
                            {item.name}
                          </Typography>
                          
                          {/* Material Info */}
                          {item.material && (
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                              {item.material.roughness !== undefined && (
                                <Tooltip title="Roughness">
                                  <Chip
                                    label={`R:${(item.material.roughness * 100).toFixed(0)}%`}
                                    size="small"
                                    sx={{ fontSize: '0.55rem', height: 16, bgcolor: '#333' }}
                                  />
                                </Tooltip>
                              )}
                              {item.material.metalness !== undefined && (
                                <Tooltip title="Metalness">
                                  <Chip
                                    label={`M:${(item.material.metalness * 100).toFixed(0)}%`}
                                    size="small"
                                    sx={{ fontSize: '0.55rem', height: 16, bgcolor: '#333' }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          )}
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))}

        {recommendations.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No specific prop recommendations. You can add items from the Props panel later.
            </Typography>
          </Box>
        )}

        {/* Selected Items Summary */}
        {selectedItems.size > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 2, border: '1px solid #4caf50' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShoppingCart sx={{ fontSize: 18 }} />
              Selected Items ({selectedItems.size})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {Array.from(selectedItems).map(id => {
                const item = recommendations.flatMap(r => r.items).find(i => i.id === id);
                return item ? (
                  <Chip
                    key={id}
                    label={item.name}
                    size="small"
                    onDelete={() => toggleItem(id)}
                    sx={{ fontSize: '0.7rem', bgcolor: '#333' }}
                  />
                ) : null;
              })}
            </Box>
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
          Skip (No Props)
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            variant="contained"
            color="primary"
            disabled={loading}
            startIcon={loading ? undefined : <Add />}
          >
            {loading ?'Adding...' : `Add ${selectedItems.size} Items`}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default PBRRecommendationDialog;

