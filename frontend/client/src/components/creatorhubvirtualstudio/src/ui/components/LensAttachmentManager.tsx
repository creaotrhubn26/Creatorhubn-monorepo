/**
 * Lens Attachment Manager
 * 
 * Allows users to attach lenses from their inventory to cameras in the scene.
 * Validates mount compatibility and updates camera properties accordingly.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Stack,
  IconButton,
  Tooltip,
  Divider,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  Circle as LensIcon,
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  Warning as WarningIcon,
  Check as CheckIcon,
  Search as SearchIcon,
  SwapHoriz as SwapIcon,
} from '@mui/icons-material';
import { useNodes, useActions } from '@/state/selectors';
import { useUserEquipmentInventory, getEquipmentImageUrl, UserEquipmentItem } from '@/hooks/useUserEquipmentInventory';
import { findLensSpec, findLensSpecByBrand, getDefaultLensSpec, LensSpec, getFocalLengthFromLensSpec, getMaxApertureFromLensSpec } from '@/core/data/LensSpecifications';
import { exposureCalculator } from '@/core/services/exposureCalculatorService';

// =============================================================================
// TYPES
// =============================================================================

interface LensAttachmentManagerProps {
  cameraNodeId: string;
  onClose?: () => void;
}

interface CameraNodeWithLens {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  mount?: string;
  attachedLens?: {
    id: string;
    brand?: string;
    model?: string;
    lensSpecs?: Partial<LensSpec>;
  };
  camera?: {
    sensor: [number, number];
    focalLength: number;
    aperture: number;
    iso: number;
    shutter: number;
  };
}

// =============================================================================
// MOUNT DETECTION
// =============================================================================

function detectCameraMount(brand?: string, model?: string): string {
  const search = `${brand || ''} ${model || ','}`.toLowerCase();
  
  // Canon
  if (search.includes('canon, ')) {
    if (search.includes('eos r, ') || search.includes('r3,') || search.includes('r5, ') || search.includes('r6') || search.includes('r7') || search.includes('r8') || search.includes('r10')) {
      return 'rf';
    }
    return 'ef';
  }
  
  // Sony
  if (search.includes('sony')) {
    if (search.includes('a7') || search.includes('a9') || search.includes('a1') || search.includes('fx')) {
      return 'fe';
    }
    return 'e';
  }
  
  // Nikon
  if (search.includes('nikon')) {
    if (search.includes('z5') || search.includes('z6') || search.includes('z7') || search.includes('z8') || search.includes('z9') || search.includes('zf') || search.includes('z')) {
      return 'z';
    }
    return 'f';
  }
  
  // Fujifilm
  if (search.includes('fuji')) {
    if (search.includes('gfx')) {
      return 'gfx';
    }
    return 'x';
  }
  
  // Panasonic / Leica
  if (search.includes('panasonic') || search.includes('leica')) {
    if (search.includes('s1') || search.includes('s5') || search.includes('sl')) {
      return 'l';
    }
    return 'mft';
  }
  
  // Olympus / OM System
  if (search.includes('olympus') || search.includes('om system') || search.includes('om-')) {
    return 'mft';
  }
  
  return 'universal';
}

function detectLensMount(brand?: string, model?: string, spec?: Partial<LensSpec>): string {
  // Use spec mount if available
  if (spec?.mount) {
    const mount = spec.mount.toLowerCase().replace('_','-').replace('canon-',',').replace('sony-',',').replace('nikon-',',').replace('fujifilm-',',').replace('sigma-',', ').replace('tamron-', ', ');
    if (mount.includes('rf')) return 'rf';
    if (mount.includes('ef')) return 'ef';
    if (mount.includes('fe')) return 'fe';
    if (mount === 'e') return 'e';
    if (mount === 'z') return 'z';
    if (mount === 'x' || mount === 'xf') return 'x';
    if (mount.includes('gfx') || mount === 'g') return 'gfx';
    if (mount === 'l') return 'l';
    if (mount === 'f') return 'f';
    return mount;
  }
  
  const search = `${brand || ', '} ${model || ', '}`.toLowerCase();
  
  // Canon lenses
  if (search.includes('rf') || search.includes('rf-s')) return 'rf';
  if (search.includes('ef') || search.includes('ef-s')) return 'ef';
  
  // Sony lenses
  if (search.includes('fe') || search.includes('g master') || search.includes('gm')) return 'fe';
  if (search.includes('e') && search.includes('sony')) return 'e';
  
  // Nikon lenses
  if (search.includes('nikkor z')) return 'z';
  if (search.includes('nikkor') || search.includes('af-s') || search.includes('af-p')) return 'f';
  
  // Fujifilm lenses
  if (search.includes('xf') || search.includes('xc')) return 'x';
  if (search.includes('gf')) return 'gfx';
  
  // Sigma lenses (adapt to most mounts)
  if (search.includes('sigma')) {
    if (search.includes('dg dn')) return 'l'; // L-mount native
    if (search.includes('dc dn')) return 'e'; // E-mount native
    return 'universal';
  }
  
  // Tamron
  if (search.includes('tamron')) {
    if (search.includes('di iii')) return 'fe'; // Sony E-mount
    return 'universal';
  }
  
  return 'universal';
}

// =============================================================================
// LENS ATTACHMENT MANAGER COMPONENT
// =============================================================================

export function LensAttachmentManager({ cameraNodeId, onClose }: LensAttachmentManagerProps) {
  const nodes = useNodes();
  const { updateNode } = useActions();
  const { userInventory, isLoading } = useUserEquipmentInventory();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLens, setSelectedLens] = useState<UserEquipmentItem | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Get camera node
  const cameraNode = useMemo(() => {
    const node = nodes.find(n => n.id === cameraNodeId);
    if (!node?.camera) return null;
    
    return {
      id: node.id,
      name: node.name,
      brand: node.userData?.brand,
      model: node.userData?.model,
      mount: detectCameraMount(node.userData?.brand, node.userData?.model),
      attachedLens: node.userData?.attachedLens,
      camera: node.camera,
    } as CameraNodeWithLens;
  }, [nodes, cameraNodeId]);
  
  // Filter lenses from inventory
  const availableLenses = useMemo(() => {
    if (!userInventory) return [];
    
    return userInventory.filter(item => {
      const category = (item.category || ', ').toLowerCase();
      const name = (item.name || ', ').toLowerCase();
      const model = (item.model || ', ').toLowerCase();
      
      const isLens = category.includes('lens') || 
                     name.includes('lens') || 
                     model.includes('mm') ||
                     model.includes('f/') ||
                     model.includes('f1.') ||
                     model.includes('f2.');
      
      if (!isLens) return false;
      
      // Apply search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const searchTarget = `${item.brand} ${item.model} ${item.name}`.toLowerCase();
        return searchTarget.includes(search);
      }
      
      return true;
    });
  }, [userInventory, searchQuery]);
  
  // Check mount compatibility for a lens
  const checkLensCompatibility = useCallback((lens: UserEquipmentItem): { compatible: boolean; warning?: string; adapterRequired?: boolean } => {
    if (!cameraNode) return { compatible: false, warning: 'No camera selected' };
    
    const lensSpec = findLensSpec(lens.brand, lens.model) || findLensSpecByBrand(lens.brand);
    const lensMount = detectLensMount(lens.brand, lens.model, lensSpec);
    
    return exposureCalculator.checkMountCompatibility(cameraNode.mount || 'universal', lensMount);
  }, [cameraNode]);
  
  // Handle lens selection
  const handleSelectLens = (lens: UserEquipmentItem) => {
    setSelectedLens(lens);
    setShowConfirmDialog(true);
  };
  
  // Handle lens attachment confirmation
  const handleConfirmAttachment = () => {
    if (!selectedLens || !cameraNode) return;
    
    const lensSpec = findLensSpec(selectedLens.brand, selectedLens.model) || 
                     findLensSpecByBrand(selectedLens.brand) || 
                     getDefaultLensSpec();
    
    const focalLength = getFocalLengthFromLensSpec(lensSpec as LensSpec);
    const maxAperture = getMaxApertureFromLensSpec(lensSpec as LensSpec);
    
    // Update the camera node with attached lens info
    updateNode(cameraNodeId, {
      camera: {
        ...cameraNode.camera,
        focalLength: focalLength,
        aperture: Math.max(cameraNode.camera?.aperture || 2.8, maxAperture), // Don't go wider than lens allows
      },
      userData: {
        attachedLens: {
          id: selectedLens.id,
          brand: selectedLens.brand,
          model: selectedLens.model,
          lensSpecs: lensSpec,
        },
        lensSpecs: lensSpec,
      },
    });
    
    setShowConfirmDialog(false);
    setSelectedLens(null);
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('ch-lens-attached', {
      detail: {
        cameraId: cameraNodeId,
        lens: selectedLens,
        lensSpecs: lensSpec,
      },
    }));
    
    onClose?.();
  };
  
  // Handle lens detachment
  const handleDetachLens = () => {
    if (!cameraNode) return;
    
    updateNode(cameraNodeId, {
      userData: {
        attachedLens: undefined,
        lensSpecs: undefined,
      },
    });
    
    window.dispatchEvent(new CustomEvent('ch-lens-detached', {
      detail: { cameraId: cameraNodeId },
    }));
  };
  
  if (!cameraNode) {
    return (
      <Alert severity="error">
        Camera not found. Please select a valid camera node.
      </Alert>
    );
  }
  
  return (
    <Paper sx={{ p: 2, maxWidth: 500 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <CameraIcon color="primary" />
        <Typography variant="h6" sx={{ flex: 1 }}>
          Attach Lens to {cameraNode.name}
        </Typography>
        {onClose && (
          <IconButton size="small" onClick={onClose}>×</IconButton>
        )}
      </Stack>
      
      {/* Camera Info */}
      <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" color="text.secondary">Camera:</Typography>
          <Typography variant="body2" fontWeight="medium">
            {cameraNode.brand} {cameraNode.model}
          </Typography>
          <Chip label={cameraNode.mount?.toUpperCase()} size="small" />
        </Stack>
        
        {cameraNode.attachedLens && (
          <Stack direction="row" alignItems="center" spacing={1} mt={1}>
            <Typography variant="body2" color="text.secondary">Current Lens:</Typography>
            <Typography variant="body2" fontWeight="medium" color="success.main">
              {cameraNode.attachedLens.brand} {cameraNode.attachedLens.model}
            </Typography>
            <Tooltip title="Detach lens">
              <IconButton size="small" color="error" onClick={handleDetachLens}>
                <UnlinkIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search your lenses..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          )}}
        sx={{ mb: 2 }}
      />
      
      {/* Lens List */}
      {isLoading ? (
        <Typography color="text.secondary" textAlign="center" py={4}>
          Loading your equipment...
        </Typography>
      ) : availableLenses.length === 0 ? (
        <Alert severity="info">
          No lenses found in your inventory. Add lenses to your equipment to attach them here.
        </Alert>
      ) : (
        <List sx={{ maxHeight: 350, overflow: 'auto' }}>
          {availableLenses.map((lens) => {
            const compatibility = checkLensCompatibility(lens);
            const lensSpec = findLensSpec(lens.brand, lens.model) || findLensSpecByBrand(lens.brand);
            const focalLength = lensSpec ? getFocalLengthFromLensSpec(lensSpec as LensSpec) : '??';
            const maxAperture = lensSpec ? getMaxApertureFromLensSpec(lensSpec as LensSpec) : '??';
            const isCurrentLens = cameraNode.attachedLens?.id === lens.id;
            
            return (
              <ListItem
                key={lens.id}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  bgcolor: isCurrentLens ? 'success.dark' : 'background.paper',
                  border: '1px solid',
                  borderColor: isCurrentLens ? 'success.main' : 'divider',
                  opacity: compatibility.compatible ? 1 : 0.6}}
                secondaryAction={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {compatibility.adapterRequired && (
                      <Tooltip title={compatibility.warning}>
                        <WarningIcon color="warning" fontSize="small" />
                      </Tooltip>
                    )}
                    {!compatibility.compatible && (
                      <Tooltip title={compatibility.warning}>
                        <WarningIcon color="error" fontSize="small" />
                      </Tooltip>
                    )}
                    {isCurrentLens ? (
                      <Chip 
                        icon={<CheckIcon />} 
                        label="Attached" 
                        size="small" 
                        color="success"
                      />
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<LinkIcon />}
                        onClick={() => handleSelectLens(lens)}
                        disabled={!compatibility.compatible}
                      >
                        Attach
                      </Button>
                    )}
                  </Stack>
                }
              >
                <ListItemAvatar>
                  <Avatar
                    src={getEquipmentImageUrl(lens)}
                    variant="rounded"
                    sx={{ width: 48, height: 48 }}
                  >
                    <LensIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" fontWeight="medium">
                        {lens.brand} {lens.model}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <Stack direction="row" spacing={1} mt={0.5}>
                      <Chip label={`${focalLength}mm`} size="small" variant="outlined" />
                      <Chip label={`f/${maxAperture}`} size="small" variant="outlined" />
                      {lensSpec?.stabilization && (
                        <Chip label="IS" size="small" color="info" variant="outlined" />
                      )}
                    </Stack>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      )}
      
      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)}>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <SwapIcon color="primary" />
            <span>Attach Lens</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedLens && (() => {
            const compatibility = checkLensCompatibility(selectedLens);
            const lensSpec = findLensSpec(selectedLens.brand, selectedLens.model) || findLensSpecByBrand(selectedLens.brand);
            const focalLength = lensSpec ? getFocalLengthFromLensSpec(lensSpec as LensSpec) : 50;
            const maxAperture = lensSpec ? getMaxApertureFromLensSpec(lensSpec as LensSpec) : 2.8;
            
            return (
              <Box>
                <Typography variant="body1" mb={2}>
                  Attach <strong>{selectedLens.brand} {selectedLens.model}</strong> to <strong>{cameraNode.name}</strong>?
                </Typography>
                
                {compatibility.adapterRequired && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {compatibility.warning}
                  </Alert>
                )}
                
                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Camera settings will be updated:
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      • Focal Length: <strong>{focalLength}mm</strong>
                    </Typography>
                    <Typography variant="body2">
                      • Max Aperture: <strong>f/{maxAperture}</strong>
                    </Typography>
                    {lensSpec?.minFocusDistance && (
                      <Typography variant="body2">
                        • Min Focus: <strong>{(lensSpec.minFocusDistance * 100).toFixed(0)}cm</strong>
                      </Typography>
                    )}
                    {lensSpec?.stabilization && (
                      <Typography variant="body2">
                        • Image Stabilization: <strong>Enabled</strong>
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleConfirmAttachment}
            startIcon={<LinkIcon />}
          >
            Attach Lens
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

// =============================================================================
// QUICK LENS SWAP BUTTON (for toolbar)
// =============================================================================

interface QuickLensSwapProps {
  cameraNodeId: string;
}

export function QuickLensSwapButton({ cameraNodeId }: QuickLensSwapProps) {
  const [open, setOpen] = useState(false);
  const nodes = useNodes();
  
  const cameraNode = nodes.find(n => n.id === cameraNodeId);
  const hasLens = !!cameraNode?.userData?.attachedLens;
  
  return (
    <>
      <Tooltip title={hasLens ? "Change lens" : "Attach lens"}>
        <IconButton onClick={() => setOpen(true)} size="small">
          {hasLens ? <SwapIcon /> : <LinkIcon />}
        </IconButton>
      </Tooltip>
      
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <LensAttachmentManager 
          cameraNodeId={cameraNodeId} 
          onClose={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

export default LensAttachmentManager;

