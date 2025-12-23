/**
 * Light Shaper Attachment Panel
 * 
 * Allows attaching/detaching light shapers to selected lights
 */

import React from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('LightShaperPanel, ');
import {
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Star as StarIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { lightShaperService, LightShaper } from '@/core/services/lightShaperService';

interface LightShaperAttachmentPanelProps {
  lightNode: any; // SceneNode with light
  onAttachShaper: (shaper: LightShaper) => void;
  onDetachShaper: () => void;
}

export function LightShaperAttachmentPanel({
  lightNode,
  onAttachShaper,
  onDetachShaper,
}: LightShaperAttachmentPanelProps) {
  const [showDialog, setShowDialog] = React.useState(false);
  const [shapers, setShapers] = React.useState<LightShaper[]>([]);
  const [loading, setLoading] = React.useState(false);

  const hasAttachedShaper = !!lightNode.attachedShaper;

  const handleOpenDialog = async () => {
    setShowDialog(true);
    setLoading(true);

    // Get light asset ID from userData or metadata
    const lightAssetId = lightNode.userData?.assetId || lightNode.id;

    try {
      const compatibleShapers = await lightShaperService.getCompatibleShapers(lightAssetId, {
        minScore: 0.7, // Only show highly compatible shapers
      });
      setShapers(compatibleShapers);
    } catch (error) {
      log.error('Error loading shapers: ', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectShaper = (shaper: LightShaper) => {
    onAttachShaper(shaper);
    setShowDialog(false);
  };

  return (
    <>
      <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
          📦 Light Shaper
        </Typography>

        {hasAttachedShaper ? (
          <Box>
            <Box
              sx={{
                p: 1.5,
                bgcolor: '#F3F4F6',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1}}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600}}>
                  {lightNode.attachedShaper.modifierType.replace('_', ', ')}
                </Typography>
                <Typography variant="caption" sx={{ color: '#6B7280' }}>
                  {lightNode.attachedShaper.modifierSize[0] * 100}×
                  {lightNode.attachedShaper.modifierSize[1] * 100}cm
                </Typography>
              </Box>
              <IconButton size="small" onClick={onDetachShaper} sx={{ color: '#EF4444' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            {lightNode.attachedShaper.effects && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {lightNode.attachedShaper.effects.beam_angle_modifier !== null && (
                  <Chip
                    label={`Beam: ${lightNode.attachedShaper.effects.beam_angle_modifier > 0 ? '+' : ','}${lightNode.attachedShaper.effects.beam_angle_modifier}°`}
                    size="small"
                    sx={{ height: 20, fontSize: 10 }}
                  />
                )}
                <Chip
                  label={`-${lightNode.attachedShaper.effects.power_loss_stops} stops`}
                  size="small"
                  sx={{ height: 20, fontSize: 10 }}
                />
                <Chip
                  label={`Diffusion: ${Math.round(lightNode.attachedShaper.effects.diffusion_factor * 100)}%`}
                  size="small"
                  sx={{ height: 20, fontSize: 10 }}
                />
              </Box>
            )}
          </Box>
        ) : (
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
            fullWidth
            sx={{ textTransform: 'none' }}
          >
            Attach Light Shaper
          </Button>
        )}
      </Box>

      {/* Shaper Selection Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Select Light Shaper</Typography>
            <IconButton size="small" onClick={() => setShowDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : shapers.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No compatible shapers found for this light.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {shapers.map((shaper) => (
                <Grid item xs={12} sm={6} md={4} key={shaper.shaper_id}>
                  <ShaperCard shaper={shaper} onSelect={() => handleSelectShaper(shaper)} />
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function ShaperCard({ shaper, onSelect }: { shaper: LightShaper; onSelect: () => void }) {
  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'all 0.2s', '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        }}}
      onClick={onSelect}
    >
      <CardMedia
        component="img"
        height="140"
        image={shaper.thumbnail_url || '/library/placeholders/light-shaper.png'}
        alt={shaper.shaper_name}
        sx={{ objectFit: 'cover' }}
      />
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>
            {shaper.shaper_name}
          </Typography>
          {shaper.is_recommended && (
            <StarIcon sx={{ fontSize: 16, color: '#F59E0B' }} />
          )}
        </Box>

        <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mb: 1 }}>
          {shaper.mount_type.toUpperCase()} • {Math.round(shaper.compatibility_score * 100)}% match
        </Typography>

        <Tooltip title={shaper.notes} placement="top">
          <Chip
            icon={<InfoIcon sx={{ fontSize: 14 }} />}
            label="Effects"
            size="small"
            sx={{ height: 20, fontSize: 10 }}
          />
        </Tooltip>
      </CardContent>
    </Card>
  );
}

