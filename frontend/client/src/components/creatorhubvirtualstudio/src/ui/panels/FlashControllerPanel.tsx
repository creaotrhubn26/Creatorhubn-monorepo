/**
 * FlashControllerPanel - Wireless Flash Controller UI
 * 
 * Simulates real flash controller displays:
 * - Profoto Connect Pro style
 * - Godox XPro style
 * - Generic controller style
 * 
 * Features:
 * - Group power control with rotary-style adjustment
 * - TTL/Manual/HSS mode switching
 * - Test fire button
 * - Light assignment to groups
 * - Channel selection
 * - Modeling light toggle
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Badge,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import {
  FlashOn as FlashIcon,
  FlashOff as FlashOffIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Settings as SettingsIcon,
  Sync as SyncIcon,
  LinkOff as UnlinkIcon,
  Link as LinkIcon,
  Lightbulb as LightbulbIcon,
  LightbulbOutlined as LightbulbOutlinedIcon,
  WbIncandescent as ModelingIcon,
  Speed as HSSIcon,
  Camera as TTLIcon,
  Tune as ManualIcon,
  Router as WirelessIcon,
  Check as CheckIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  RadioButtonChecked as ChannelIcon,
} from '@mui/icons-material';
import { useFlashController } from '../../hooks/useFlashController';
import { useAnnounce } from '../../providers/AccessibilityProvider';
import { useVirtualStudio } from '../../../VirtualStudioContext';
import {
  FlashController,
  FlashGroup,
  formatPowerFraction,
  formatPowerStops,
  powerToStops,
  getControllerThumbnail,
  CONTROLLER_THUMBNAILS,
  getControllerRecommendations,
  getBestControllerForLights,
  ControllerRecommendation,
  LightInScene,
} from '../../core/data/FlashControllerData';
import { useTabletSupport } from '../../providers/TabletSupportProvider';
import { TouchSlider, TouchIconButton } from '../components/TabletAwarePanels';

// ============================================================================
// Controller Selector
// ============================================================================

// ============================================================================
// Controller Recommendation Banner
// ============================================================================

interface ControllerRecommendationBannerProps {
  sceneLights: LightInScene[];
}

function ControllerRecommendationBanner({ sceneLights }: ControllerRecommendationBannerProps) {
  if (sceneLights.length === 0) return null;
  
  const recommendations = getControllerRecommendations(sceneLights);
  const topRec = recommendations[0];
  
  if (!topRec || topRec.matchScore < 30) return null;
  
  const primaryLight = sceneLights[0];
  const lightName = `${primaryLight.brand || ''} ${primaryLight.model || ','}`.trim();
  
  return (
    <Alert 
      severity="info" 
      icon={<LightbulbIcon />}
      sx={{ 
        mb: 2, 
        bgcolor: 'rgba(33,150,243,0.1)',
        border: '1px solid',
        borderColor: 'info.main'}}
    >
      <Typography variant="body2">
        You have <strong>{lightName || 'lights'}</strong> in your scene.
      </Typography>
      <Typography variant="caption" color="text.secondary">
        The <strong>{topRec.controller.displayName}</strong> would be the best match ({topRec.matchScore}% compatibility).
        Look for the <Chip label="Recommended" size="small" color="success" sx={{ height: 16, fontSize: 9, mx: 0.5 }} /> badge below.
      </Typography>
    </Alert>
  );
}

// ============================================================================
// Controller Selector Content (used in dialog)
// ============================================================================

interface ControllerSelectorContentProps {
  controllers: FlashController[];
  selectedId?: string | null;
  sceneLights?: LightInScene[];
  onSelect: (id: string) => void;
}

function ControllerSelectorContent({ controllers, selectedId, sceneLights = [], onSelect }: ControllerSelectorContentProps) {
  // Get recommendations
  const recommendations = getControllerRecommendations(sceneLights);
  const recommendedIds = new Set(
    recommendations
      .filter(r => r.matchScore >= 50)
      .map(r => r.controller.id)
  );
  const topRecommendedId = recommendations[0]?.controller.id;
  // Group by brand
  const byBrand = controllers.reduce((acc, c) => {
    if (!acc[c.brand]) acc[c.brand] = [];
    acc[c.brand].push(c);
    return acc;
  }, {} as Record<string, FlashController[]>);
  
  // Sort brands by popularity
  const brandOrder = ['profoto','godox','pocketwizard','elinchrom','broncolor','phottix','yongnuo','flashpoint'];
  const sortedBrands = Object.keys(byBrand).sort((a, b) => {
    const aIdx = brandOrder.indexOf(a);
    const bIdx = brandOrder.indexOf(b);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });
  
  if (controllers.length === 0) {
    return (
      <Alert severity="info">
        No compatible controllers found for your scene lights. 
        Try adding Profoto, Godox, or other supported lights first.
      </Alert>
    );
  }
  
  return (
    <>
      {sortedBrands.map((brand) => (
        <Box key={brand} sx={{ mb: 2 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', textTransform: 'capitalize', fontWeight: 600}}
          >
            {brand}
          </Typography>
          <Grid container spacing={1}>
            {byBrand[brand].map((ctrl) => {
              const isTopRecommended = ctrl.id === topRecommendedId;
              const isRecommended = recommendedIds.has(ctrl.id);
              const recommendation = recommendations.find(r => r.controller.id === ctrl.id);
              
              return (
              <Grid item xs={6} key={ctrl.id}>
                <Card
                  variant="outlined"
                  sx={{
                    borderColor: isTopRecommended 
                      ? 'success.main' 
                      : selectedId === ctrl.id 
                        ? ctrl.accentColor 
                        : 'divider',
                    borderWidth: isTopRecommended ? 2 : 1,
                    bgcolor: selectedId === ctrl.id ? 'action.selected' : 'background.paper',
                    transition: 'all 0.15s',
                    position: 'relative', '&:hover': {
                      borderColor: ctrl.accentColor,
                      transform: 'translateY(-2px)',
                      boxShadow: `0 4px 12px ${ctrl.accentColor}40`,
                    }}}
                >
                  {/* Recommended Badge */}
                  {isTopRecommended && (
                    <Chip
                      label="✓ Best Match"
                      size="small"
                      color="success"
                      sx={{
                        position: 'absolute',
                        top: -10,
                        right: 8,
                        height: 20,
                        fontSize: 10,
                        fontWeight: 70,
                        zIndex: 1}}
                    />
                  )}
                  {isRecommended && !isTopRecommended && (
                    <Chip
                      label="Recommended"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: -10,
                        right: 8,
                        height: 18,
                        fontSize: 9,
                        bgcolor: 'info.main',
                        color: 'white',
                        zIndex: 1}}
                    />
                  )}
                  
                  <CardActionArea onClick={() => onSelect(ctrl.id)}>
                    <CardContent sx={{ p: 1.5, pt: isRecommended ? 2 : 1.5 }}>
                      {/* Thumbnail + Title Row */}
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        {/* Thumbnail */}
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 1,
                            overflow: 'hidden',
                            bgcolor: 'grey.900',
                            flexShrink: 0,
                            border: `2px solid ${isTopRecommended ? 'success.main' : ctrl.accentColor}40`}}
                        >
                          <img
                            src={ctrl.thumbnailUrl || getControllerThumbnail(ctrl.id)}
                            alt={ctrl.model}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'}}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = CONTROLLER_THUMBNAILS['default'];
                            }}
                          />
                        </Box>
                        
                        {/* Info */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Typography variant="subtitle2" noWrap sx={{ flex: 1, fontWeight: 600}}>
                              {ctrl.model}
                            </Typography>
                            {ctrl.price && (
                              <Chip
                                label={`$${ctrl.price}`}
                                size="small"
                                sx={{ 
                                  height: 18, 
                                  fontSize: 10, 
                                  bgcolor: 'grey.800',
                                  color: 'grey.300'}}
                              />
                            )}
                          </Stack>
                          
                          {/* Match Score */}
                          {recommendation && recommendation.matchScore >= 30 && (
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: recommendation.matchScore >= 70 ? 'success.main' : 'info.main',
                                fontWeight: 600,
                                display: 'block'}}
                            >
                              {recommendation.matchScore}% match
                            </Typography>
                          )}
                          
                          {/* Features */}
                          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                            {ctrl.supportsTTL && (
                              <Chip 
                                label="TTL" 
                                size="small" 
                                sx={{ height: 16, fontSize: 9, bgcolor: 'success.dark' }} 
                              />
                            )}
                            {ctrl.supportsHSS && (
                              <Chip 
                                label="HSS" 
                                size="small" 
                                sx={{ height: 16, fontSize: 9, bgcolor: 'info.dark' }} 
                              />
                            )}
                            {ctrl.supportsBluetooth && (
                              <Chip 
                                label="BT" 
                                size="small" 
                                sx={{ height: 16, fontSize: 9, bgcolor: 'primary.dark' }} 
                              />
                            )}
                            {ctrl.supportsApp && (
                              <Chip 
                                label="App" 
                                size="small" 
                                sx={{ height: 16, fontSize: 9, bgcolor: 'secondary.dark' }} 
                              />
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                      
                      {/* Specs Row */}
                      <Stack 
                        direction="row" 
                        spacing={1} 
                        sx={{ 
                          mt: 1, 
                          pt: 1, 
                          borderTop: '1px solid',
                          borderColor: 'divider'}}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {ctrl.maxGroups} groups
                        </Typography>
                        <Typography variant="caption" color="text.secondary">•</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {ctrl.maxChannels} ch
                        </Typography>
                        {ctrl.hasScreen && (
                          <>
                            <Typography variant="caption" color="text.secondary">•</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {ctrl.screenSize} {ctrl.screenType?.toUpperCase()}
                            </Typography>
                          </>
                        )}
                      </Stack>
                      
                      {/* Weight & Battery */}
                      {(ctrl.weight || ctrl.batteryType) && (
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                          {ctrl.weight && (
                            <Typography variant="caption" sx={{ color: 'grey.500', fontSize: 10 }}>
                              {ctrl.weight}g
                            </Typography>
                          )}
                          {ctrl.batteryType && (
                            <>
                              <Typography variant="caption" sx={{ color: 'grey.600', fontSize: 10 }}>•</Typography>
                              <Typography variant="caption" sx={{ color: 'grey.500', fontSize: 10 }}>
                                {ctrl.batteryType}
                              </Typography>
                            </>
                          )}
                        </Stack>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
            })}
          </Grid>
        </Box>
      ))}
      
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="caption">
          <strong>Tip:</strong> Choose a controller that matches your light brand for full compatibility. 
          Profoto → Profoto Connect, Godox → Godox XPro, etc.
        </Typography>
      </Alert>
    </>
  );
}

interface ControllerSelectorProps {
  controllers: FlashController[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function ControllerSelector({ controllers, selectedId, onSelect }: ControllerSelectorProps) {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <Button
        variant="outlined"
        fullWidth
        onClick={() => setOpen(true)}
        startIcon={<WirelessIcon />}
        sx={{
          justifyContent: 'flex-start',
          textTransform: 'none',
          borderColor: selectedId ? 'primary.main' : 'divider'}}
      >
        {selectedId
          ? controllers.find((c) => c.id === selectedId)?.displayName || 'Select Controller'
          : 'Select Flash Controller'}
      </Button>
      
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <WirelessIcon />
            <span>Select Wireless Flash Controller</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <ControllerSelectorContent
            controllers={controllers}
            selectedId={selectedId}
            onSelect={(id) => {
              onSelect(id);
              setOpen(false);
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ============================================================================
// Group Power Control (Dial Style)
// ============================================================================

interface GroupPowerDialProps {
  group: FlashGroup;
  controller: FlashController;
  onAdjust: (delta: number) => void;
  onToggle: () => void;
  onModeChange: (mode: FlashGroup['powerMode']) => void;
  onModelingToggle: () => void;
  connectedLightCount: number;
  accentColor: string;
}

function GroupPowerDial({
  group,
  controller,
  onAdjust,
  onToggle,
  onModeChange,
  onModelingToggle,
  connectedLightCount,
  accentColor,
}: GroupPowerDialProps) {
  const stops = group.powerStops ?? powerToStops(group.power, controller.powerRange[1]);
  const fraction = formatPowerFraction(group.power);
  
  return (
    <Paper
      elevation={2}
      sx={{
        p: 1.5,
        bgcolor: group.enabled ? 'background.paper' : 'action.disabledBackground',
        opacity: group.enabled ? 1 : 0.6,
        border: `2px solid ${group.enabled ? accentColor : 'transparent'}`,
        borderRadius: 2,
        transition: 'all 0.2s'}}
    >
      {/* Group Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            onClick={onToggle}
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: group.enabled ? accentColor : 'grey.700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 70,
              fontSize: 14,
              color: 'white',
              transition: 'all 0.15s','&:hover': {
                transform: 'scale(1.1)',
              }}}
          >
            {group.name}
          </Box>
          
          <Badge badgeContent={connectedLightCount} color="primary" max={9}>
            <LightbulbIcon sx={{ fontSize: 16, opacity: 0.6 }} />
          </Badge>
        </Stack>
        
        {/* Mode Toggle */}
        <ToggleButtonGroup
          size="small"
          value={group.powerMode}
          exclusive
          onChange={(_, v) => v && onModeChange(v)}
          sx={{ '& .MuiToggleButton-root': { px: 0.75, py: 0.25 } }}
        >
          {controller.supportsManual && (
            <ToggleButton value="manual">
              <Tooltip title="Manual">
                <ManualIcon sx={{ fontSize: 14 }} />
              </Tooltip>
            </ToggleButton>
          )}
          {controller.supportsTTL && (
            <ToggleButton value="ttl">
              <Tooltip title="TTL">
                <TTLIcon sx={{ fontSize: 14 }} />
              </Tooltip>
            </ToggleButton>
          )}
          {controller.supportsHSS && (
            <ToggleButton value="hss">
              <Tooltip title="HSS">
                <HSSIcon sx={{ fontSize: 14 }} />
              </Tooltip>
            </ToggleButton>
          )}
        </ToggleButtonGroup>
      </Stack>
      
      {/* Power Display */}
      <Box
        sx={{
          textAlign: 'center',
          py: 1,
          bgcolor: 'black',
          borderRadius: 1,
          mb: 1,
          fontFamily: 'monospace'}}
      >
        <Typography
          variant="h5"
          sx={{
            color: group.enabled ? accentColor : 'grey.600',
            fontWeight: 70,
            letterSpacing: 1}}
        >
          {group.powerMode === 'ttl' 
            ? `${(stops - 5) >= 0 ? '+' : ','}${(stops - 5).toFixed(1)}`
            : formatPowerStops(stops)
          }
        </Typography>
        <Typography variant="caption" sx={{ color: 'grey.500' }}>
          {group.powerMode === 'ttl' ? 'TTL COMP' : fraction}
        </Typography>
      </Box>
      
      {/* Power Adjustment Buttons */}
      <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ mb: 1 }}>
        <IconButton
          size="small"
          onClick={() => onAdjust(-1)}
          disabled={!group.enabled || stops <= controller.powerRange[0]}
          sx={{ bgcolor: 'action.hover' }}
        >
          <RemoveIcon />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => onAdjust(-controller.powerStepSize)}
          disabled={!group.enabled || stops <= controller.powerRange[0]}
          sx={{ bgcolor: 'action.hover', fontSize: 10 }}
        >
          -{controller.powerStepSize}
        </IconButton>
        <IconButton
          size="small"
          onClick={() => onAdjust(controller.powerStepSize)}
          disabled={!group.enabled || stops >= controller.powerRange[1]}
          sx={{ bgcolor: 'action.hover', fontSize: 10 }}
        >
          +{controller.powerStepSize}
        </IconButton>
        <IconButton
          size="small"
          onClick={() => onAdjust(1)}
          disabled={!group.enabled || stops >= controller.powerRange[1]}
          sx={{ bgcolor: 'action.hover' }}
        >
          <AddIcon />
        </IconButton>
      </Stack>
      
      {/* Modeling Light Toggle */}
      {controller.supportsModelingLight && (
        <Button
          size="small"
          variant={group.modelingLight ? 'contained' : 'outlined'}
          onClick={onModelingToggle}
          disabled={!group.enabled}
          startIcon={<ModelingIcon />}
          fullWidth
          sx={{
            fontSize: 11,
            py: 0.25,
            bgcolor: group.modelingLight ? 'warning.main' : undefined}}
        >
          Modeling
        </Button>
      )}
    </Paper>
  );
}

// ============================================================================
// Light Assignment Dialog
// ============================================================================

interface LightAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  groups: FlashGroup[];
  connectedLights: Array<{ nodeId: string; nodeName: string; groupId: string; brand: string; model: string }>;
  unassignedLights: any[];
  onAssign: (nodeId: string, groupId: string) => void;
  onUnassign: (nodeId: string) => void;
  accentColor: string;
}

function LightAssignmentDialog({
  open,
  onClose,
  groups,
  connectedLights,
  unassignedLights,
  onAssign,
  onUnassign,
  accentColor,
}: LightAssignmentDialogProps) {
  const [selectedLight, setSelectedLight] = useState<string | null>(null);
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LinkIcon />
          <span>Assign Lights to Groups</span>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {/* Connected Lights */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Connected Lights ({connectedLights.length})
        </Typography>
        <List dense>
          {connectedLights.map((light) => (
            <ListItem
              key={light.nodeId}
              secondaryAction={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={`Group ${groups.find((g) => g.id === light.groupId)?.name}`}
                    size="small"
                    sx={{ bgcolor: accentColor, color: 'white' }}
                  />
                  <IconButton size="small" onClick={() => onUnassign(light.nodeId)}>
                    <UnlinkIcon fontSize="small" />
                  </IconButton>
                </Stack>
              }
            >
              <ListItemIcon>
                <LightbulbIcon />
              </ListItemIcon>
              <ListItemText
                primary={light.nodeName}
                secondary={`${light.brand} ${light.model}`}
              />
            </ListItem>
          ))}
          {connectedLights.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No lights connected"
                secondary="Assign lights from scene below"
                sx={{ color: 'text.secondary' }}
              />
            </ListItem>
          )}
        </List>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Unassigned Lights */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Unassigned Lights ({unassignedLights.length})
        </Typography>
        <List dense>
          {unassignedLights.map((light) => (
            <ListItem
              key={light.id}
              secondaryAction={
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <Select
                    value=""
                    displayEmpty
                    onChange={(e) => {
                      if (e.target.value) {
                        onAssign(light.id, e.target.value);
                      }
                    }}
                    sx={{ fontSize: 12 }}
                  >
                    <MenuItem value="" disabled>
                      Assign to...
                    </MenuItem>
                    {groups.map((g) => (
                      <MenuItem key={g.id} value={g.id}>
                        Group {g.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              }
            >
              <ListItemIcon>
                <LightbulbOutlinedIcon />
              </ListItemIcon>
              <ListItemText
                primary={light.name || 'Light'}
                secondary={`${light.userData?.brand || 'Unknown'} ${light.userData?.model || ','}`}
              />
            </ListItem>
          ))}
          {unassignedLights.length === 0 && (
            <ListItem>
              <ListItemText
                primary="All lights assigned"
                sx={{ color: 'text.secondary' }}
              />
            </ListItem>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Empty State Components
// ============================================================================

interface NoControllerPromptProps {
  hasLightsInScene: boolean;
  hasFlashesInScene: boolean;
  sceneLights: LightInScene[];
  onSelectController: () => void;
  onQuickSelect?: (controllerId: string) => void;
}

function NoControllerPrompt({ 
  hasLightsInScene, 
  hasFlashesInScene, 
  sceneLights,
  onSelectController,
  onQuickSelect,
}: NoControllerPromptProps) {
  // Get recommendation based on scene lights
  const recommendation = getBestControllerForLights(sceneLights);
  const primaryLight = sceneLights[0];
  const lightName = primaryLight ? `${primaryLight.brand || ''} ${primaryLight.model || ','}`.trim() : ', ';
  
  return (
    <Box sx={{ textAlign: 'center', py: 2 }}>
      {/* Recommendation Card - Show if we have lights */}
      {recommendation && hasLightsInScene && (
        <Paper
          elevation={4}
          sx={{
            p: 2,
            mb: 2,
            bgcolor: 'rgba(76,175,80,0.1)',
            border: '2px solid',
            borderColor: recommendation.controller.accentColor,
            borderRadius: 2,
            textAlign: 'left'}}
        >
          {/* Header with light info */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <LightbulbIcon sx={{ color: 'warning.main' }} />
            <Typography variant="body2" sx={{ color: 'grey.300' }}>
              You have <strong style={{ color: 'white' }}>{lightName || 'lights'}</strong> in your scene
            </Typography>
          </Stack>
          
          {/* Recommendation */}
          <Alert 
            severity="success" 
            icon={<CheckIcon />}
            sx={{ 
              bgcolor: 'rgba(76,175,80,0.15)',
              mb: 2, '& .MuiAlert-message': { width: '100%' }}}
          >
            <Typography variant="body2" fontWeight={600}>
              Recommended Controller
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {recommendation.matchReason}
            </Typography>
          </Alert>
          
          {/* Controller Card */}
          <Card
            sx={{
              bgcolor: recommendation.controller.primaryColor,
              border: `2px solid ${recommendation.controller.accentColor}`,
              mb: 2}}
          >
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                {/* Thumbnail */}
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: 'grey.900',
                    flexShrink: 0}}
                >
                  <img
                    src={recommendation.controller.thumbnailUrl || getControllerThumbnail(recommendation.controller.id)}
                    alt={recommendation.controller.model}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = CONTROLLER_THUMBNAILS['default'];
                    }}
                  />
                </Box>
                
                {/* Info */}
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ color: 'white' }}>
                        {recommendation.controller.displayName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'grey.400' }}>
                        {recommendation.controller.maxGroups} groups • {recommendation.controller.maxChannels} channels
                      </Typography>
                    </Box>
                    <Chip
                      label={`${recommendation.matchScore}% match`}
                      size="small"
                      sx={{
                        bgcolor: recommendation.matchScore >= 70 ? 'success.main' : 'warning.main',
                        color: 'white',
                        fontWeight: 600}}
                    />
                  </Stack>
                  
                  {/* Features */}
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    {recommendation.features.slice(0, 5).map((feature) => (
                      <Chip
                        key={feature}
                        label={feature}
                        size="small"
                        sx={{ height: 20, fontSize: 10, bgcolor: 'grey.800', color: 'grey.300' }}
                      />
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          
          {/* Quick Select Button */}
          <Button
            variant="contained"
            fullWidth
            onClick={() => onQuickSelect?.(recommendation.controller.id)}
            startIcon={<CheckIcon />}
            sx={{
              bgcolor: recommendation.controller.accentColor, '&:hover': {
                bgcolor: recommendation.controller.accentColor,
                filter: 'brightness(1.2)',
              }}}
          >
            Use {recommendation.controller.model}
          </Button>
          
          {/* Or browse more */}
          <Button
            variant="text"
            fullWidth
            onClick={onSelectController}
            sx={{ mt: 1, color: 'grey.400' }}
          >
            Browse all controllers...
          </Button>
        </Paper>
      )}
      
      {/* No lights state */}
      {!hasLightsInScene && (
        <>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2}}
          >
            <WirelessIcon sx={{ fontSize: 40, color: 'grey.500' }} />
          </Box>
          
          <Typography variant="h6" gutterBottom sx={{ color: 'grey.300' }}>
            No Flash Controller Connected
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add strobes or flashes to your scene first, then connect a wireless 
            controller to manage them professionally.
          </Typography>
          
          <Button
            variant="contained"
            onClick={onSelectController}
            startIcon={<AddIcon />}
          >
            Select Flash Controller
          </Button>
          
          <Typography variant="caption" display="block" sx={{ mt: 2, color: 'grey.600' }}>
            Supported: Profoto Connect Pro, Godox XPro II, PocketWizard, Elinchrom Skyport & more
          </Typography>
        </>
      )}
    </Box>
  );
}

interface NoLightsInSceneProps {
  onAddLight?: () => void;
}

function NoLightsInScene({ onAddLight }: NoLightsInSceneProps) {
  return (
    <Box sx={{ textAlign: 'center', py: 3 }}>
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          mb: 2}}
      >
        <LightbulbOutlinedIcon sx={{ fontSize: 32, color: 'grey.500' }} />
      </Box>
      
      <Typography variant="subtitle1" gutterBottom sx={{ color: 'grey.400' }}>
        No Lights in Scene
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 280, mx: 'auto' }}>
        Add strobes, speedlites, or continuous lights to your scene from the Equipment Browser, 
        then connect a wireless controller.
      </Typography>
      
      {onAddLight && (
        <Button
          variant="outlined"
          size="small"
          onClick={onAddLight}
          startIcon={<LightbulbIcon />}
          sx={{ borderColor: 'grey.600', color: 'grey.400' }}
        >
          Browse Equipment
        </Button>
      )}
    </Box>
  );
}

// ============================================================================
// Connection Error Alert
// ============================================================================

interface ConnectionErrorProps {
  controllerName: string;
  lightsNotCompatible: string[];
  onDismiss: () => void;
}

function ConnectionError({ controllerName, lightsNotCompatible, onDismiss }: ConnectionErrorProps) {
  if (lightsNotCompatible.length === 0) return null;
  
  return (
    <Alert 
      severity="warning" 
      onClose={onDismiss}
      sx={{ 
        mb: 2, 
        bgcolor: 'rgba(255,152,0,0.15)','& .MuiAlert-icon': { color: 'warning.main' }}}
    >
      <Typography variant="body2" fontWeight={600} gutterBottom>
        ⚠️ Compatibility Warning
      </Typography>
      <Typography variant="caption" display="block">
        {controllerName} may not be fully compatible with:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2, mt: 0.5 }}>
        {lightsNotCompatible.slice(0, 3).map((light, i) => (
          <li key={i}>
            <Typography variant="caption">{light}</Typography>
          </li>
        ))}
        {lightsNotCompatible.length > 3 && (
          <li>
            <Typography variant="caption">
              ...and {lightsNotCompatible.length - 3} more
            </Typography>
          </li>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        These lights will still work but may have limited remote control features.
      </Typography>
    </Alert>
  );
}

// ============================================================================
// Sync Status Indicator
// ============================================================================

interface SyncStatusProps {
  isSyncing: boolean;
  lastSyncTime: number | null;
  connectedCount: number;
  totalLights: number;
}

function SyncStatus({ isSyncing, lastSyncTime, connectedCount, totalLights }: SyncStatusProps) {
  const getStatusColor = () => {
    if (isSyncing) return 'info.main';
    if (connectedCount === 0) return 'grey.500';
    if (connectedCount < totalLights) return 'warning.main';
    return 'success.main';
  };
  
  const getStatusText = () => {
    if (isSyncing) return 'Syncing...';
    if (connectedCount === 0) return 'No lights connected';
    if (connectedCount < totalLights) return `${connectedCount}/${totalLights} lights connected`;
    return `All ${connectedCount} lights connected`;
  };
  
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: getStatusColor(),
          animation: isSyncing ? 'pulse 1s infinite' : 'none','@keyframes pulse': {
            '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 },
          }}}
      />
      <Typography variant="caption" sx={{ color: getStatusColor() }}>
        {getStatusText()}
      </Typography>
      {lastSyncTime && !isSyncing && (
        <Typography variant="caption" color="text.secondary">
          • Last sync: {new Date(lastSyncTime).toLocaleTimeString()}
        </Typography>
      )}
    </Stack>
  );
}

// ============================================================================
// Main Flash Controller Panel
// ============================================================================

export function FlashControllerPanel() {
  // Tablet support
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  // Toast notifications
  const { addToast } = useVirtualStudio();

  // Accessibility
  const { announce } = useAnnounce();

  const {
    state,
    availableControllers,
    selectController,
    clearController,
    updateGroup,
    toggleGroup,
    setGroupPower,
    setGroupPowerStops,
    adjustGroupPower,
    setGroupMode,
    toggleModelingLight,
    assignLightToGroup,
    unassignLight,
    getUnassignedLights,
    setChannel,
    testFire,
    syncToScene,
    toggleHSS,
    toggleTTL,
    canControlLight,
  } = useFlashController();

  // Wrapped handlers with toasts
  const handleSelectController = useCallback((controller: FlashController) => {
    selectController(controller);
    addToast({
      message: `Connected: ${controller.name}`,
      type: 'success',
      duration: 3000,
    });
  }, [selectController, addToast]);

  const handleClearController = useCallback(() => {
    const controllerName = state.controller?.name;
    clearController();
    addToast({
      message: controllerName ? `Disconnected: ${controllerName}` : 'Controller disconnected, ',
      type: 'info',
      duration: 2000,
    });
  }, [clearController, state.controller, addToast]);

  const handleTestFire = useCallback((groupId?: string) => {
    testFire(groupId);
    addToast({
      message: groupId ? `Test, fire: Group ${groupId}` : 'Test fire: All groups',
      type: 'info',
      duration: 1500,
    });
  }, [testFire, addToast]);

  const handleSetGroupMode = useCallback((groupId: string, mode: 'manual' | 'ttl' | 'hss') => {
    setGroupMode(groupId, mode);
    addToast({
      message: `Group ${groupId}: ${mode.toUpperCase()} mode`,
      type: 'info',
      duration: 1500,
    });
  }, [setGroupMode, addToast]);

  const handleSetGroupPower = useCallback((groupId: string, power: number) => {
    setGroupPower(groupId, power);
    const stops = powerToStops(power);
    addToast({
      message: `Group ${groupId}: ${formatPowerFraction(power)} (${formatPowerStops(stops)})`,
      type: 'info',
      duration: 1500,
    });
  }, [setGroupPower, addToast]);

  const handleSyncToScene = useCallback(() => {
    syncToScene();
    addToast({
      message: 'Flash settings synced to scene',
      type: 'success',
      duration: 2000,
    });
  }, [syncToScene, addToast]);

  // Accessible power adjustment
  const handlePowerChange = useCallback((groupId: string, power: number) => {
    setGroupPower(groupId, power);
    announce(`Group ${groupId} power: ${formatPowerFraction(power)}`);
  }, [setGroupPower, announce]);

  // Accessible mode change
  const handleModeChange = useCallback((groupId: string, mode: 'manual' | 'ttl' | 'hss') => {
    setGroupMode(groupId, mode);
    announce(`Group ${groupId} mode: ${mode.toUpperCase()}`);
  }, [setGroupMode, announce]);

  // Accessible test fire
  const handleTestFire = useCallback(() => {
    testFire();
    announce('Test fire triggered');
  }, [testFire, announce]);
  
  const { controller, groups, channel, connectedLights, isSyncing, hssEnabled, ttlEnabled, lastTestFire } = state;
  
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [controllerSelectorOpen, setControllerSelectorOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  
  const accentColor = controller?.accentColor || '#2196f3';
  
  // Get all scene lights info
  const unassignedLights = getUnassignedLights();
  const allSceneLights = [...connectedLights.map(l => ({ 
    name: l.nodeName, 
    brand: l.brand,
    type: l.lightType 
  })), ...unassignedLights.map(l => ({ 
    name: l.name || 'Light', 
    brand: l.userData?.brand || 'Unknown',
    type: l.userData?.lightType || 'light'
  }))];
  
  const hasLightsInScene = allSceneLights.length > 0;
  const hasFlashesInScene = allSceneLights.some(l => 
    l.type === 'strobe' || l.type === 'speedlite' || l.type === 'flash' ||
    l.brand?.toLowerCase().includes('profoto') ||
    l.brand?.toLowerCase().includes('godox') ||
    l.brand?.toLowerCase().includes('elinchrom')
  );
  
  // Find incompatible lights
  const incompatibleLights = controller 
    ? allSceneLights
        .filter(l => l.brand && !canControlLight(l.brand))
        .map(l => `${l.brand} ${l.name}`)
    : [];
  
  // Count lights per group
  const lightsPerGroup = groups.reduce((acc, g) => {
    acc[g.id] = connectedLights.filter((l) => l.groupId === g.id).length;
    return acc;
  }, {} as Record<string, number>);
  
  // Handle sync with timestamp
  const handleSync = () => {
    syncToScene();
    setLastSyncTime(Date.now());
  };
  
  return (
    <Paper
      elevation={3}
      sx={{
        bgcolor: controller?.primaryColor || '#1a1a1a',
        color: 'white',
        borderRadius: 2,
        overflow: 'hidden'}}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: 'rgba(255,255,255,0.05)',
          borderBottom: `1px solid ${accentColor}40`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'}}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Badge 
            badgeContent={controller ? connectedLights.length : 0} 
            color={connectedLights.length > 0 ? 'success' : 'default'}
            max={9}
          >
            <WirelessIcon sx={{ color: controller ? accentColor : 'grey.500' }} />
          </Badge>
          <Typography variant="subtitle1" fontWeight={700}>
            Flash Controller
          </Typography>
          {controller && (
            <Chip
              label={controller.displayName}
              size="small"
              sx={{ bgcolor: accentColor, color: 'white' }}
            />
          )}
          {!controller && hasFlashesInScene && (
            <Chip
              label="Setup Required"
              size="small"
              color="warning"
              sx={{ animation: 'pulse 2s infinite' }}
            />
          )}
        </Stack>
        
        <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ color: 'white' }}>
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
      </Box>
      
      {expanded && (
        <Box sx={{ p: 2 }}>
          {/* No lights in scene */}
          {!hasLightsInScene && !controller && (
            <NoLightsInScene />
          )}
          
          {/* Has lights but no controller */}
          {hasLightsInScene && !controller && (
            <>
              <NoControllerPrompt
                hasLightsInScene={hasLightsInScene}
                hasFlashesInScene={hasFlashesInScene}
                sceneLights={allSceneLights.map(l => ({ 
                  brand: l.brand, 
                  model: l.name,
                  type: l.type,
                }))}
                onSelectController={() => setControllerSelectorOpen(true)}
                onQuickSelect={(controllerId) => {
                  selectController(controllerId);
                }}
              />
              
              {/* Controller Selector Dialog */}
              <Dialog 
                open={controllerSelectorOpen} 
                onClose={() => setControllerSelectorOpen(false)}
                maxWidth="sm"
                fullWidth
              >
                <DialogTitle>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <WirelessIcon />
                    <span>Select Wireless Flash Controller</span>
                  </Stack>
                </DialogTitle>
                <DialogContent dividers>
                  {/* Show recommendation at top of dialog */}
                  <ControllerRecommendationBanner 
                    sceneLights={allSceneLights.map(l => ({ 
                      brand: l.brand, 
                      model: l.name,
                      type: l.type,
                    }))}
                  />
                  
                  <ControllerSelectorContent
                    controllers={availableControllers}
                    sceneLights={allSceneLights.map(l => ({ 
                      brand: l.brand, 
                      model: l.name,
                      type: l.type,
                    }))}
                    onSelect={(id) => {
                      selectController(id);
                      setControllerSelectorOpen(false);
                    }}
                  />
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setControllerSelectorOpen(false)}>Cancel</Button>
                </DialogActions>
              </Dialog>
            </>
          )}
          
          {/* Controller Selected */}
          {controller && (
            <>
              {/* Sync Status */}
              <SyncStatus
                isSyncing={isSyncing}
                lastSyncTime={lastSyncTime}
                connectedCount={connectedLights.length}
                totalLights={allSceneLights.length}
              />
              
              {/* Compatibility Warning */}
              {!dismissedWarning && incompatibleLights.length > 0 && (
                <ConnectionError
                  controllerName={controller.displayName}
                  lightsNotCompatible={incompatibleLights}
                  onDismiss={() => setDismissedWarning(true)}
                />
              )}
              
              {/* No lights connected warning */}
              {connectedLights.length === 0 && hasLightsInScene && (
                <Alert 
                  severity="warning" 
                  sx={{ mb: 2, bgcolor: 'rgba(255,152,0,0.1)' }}
                  action={
                    <Button 
                      color="inherit" 
                      size="small" 
                      onClick={() => setAssignDialogOpen(true)}
                    >
                      Assign Now
                    </Button>
                  }
                >
                  No lights assigned to groups yet. Assign your scene lights to control them.
                </Alert>
              )}
              
              {/* Controller Display */}
              <Paper
                sx={{
                  bgcolor: '#000',
                  p: 2,
                  borderRadius: 2,
                  border: `2px solid ${accentColor}40`,
                  mb: 2}}
              >
                {/* Top Bar: Channel & Mode */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  {/* Channel */}
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <ChannelIcon sx={{ fontSize: 16, color: accentColor }} />
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as number)}
                        sx={{
                          color: 'white','.MuiOutlinedInput-notchedOutline': { borderColor: 'grey.700' },
                          fontSize: 12}}
                      >
                        {Array.from(
                          { length: controller.channelRange[1] - controller.channelRange[0] + 1 },
                          (_, i) => controller.channelRange[0] + i
                        ).map((ch) => (
                          <MenuItem key={ch} value={ch}>
                            CH {ch}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                  
                  {/* Global Modes */}
                  <Stack direction="row" spacing={1}>
                    {controller.supportsTTL && (
                      <Chip
                        label="TTL"
                        size="small"
                        onClick={toggleTTL}
                        sx={{
                          bgcolor: ttlEnabled ? accentColor : 'grey.800',
                          color: 'white',
                          cursor: 'pointer'}}
                      />
                    )}
                    {controller.supportsHSS && (
                      <Chip
                        label="HSS"
                        size="small"
                        onClick={toggleHSS}
                        sx={{
                          bgcolor: hssEnabled ? accentColor : 'grey.800',
                          color: 'white',
                          cursor: 'pointer'}}
                      />
                    )}
                  </Stack>
                </Stack>
                
                {/* Group Controls */}
                <Grid container spacing={1.5}>
                  {groups.map((group) => (
                    <Grid item xs={6} sm={4} md={groups.length <= 4 ? 6 : 4} key={group.id}>
                      <GroupPowerDial
                        group={group}
                        controller={controller}
                        onAdjust={(delta) => adjustGroupPower(group.id, delta)}
                        onToggle={() => toggleGroup(group.id)}
                        onModeChange={(mode) => setGroupMode(group.id, mode)}
                        onModelingToggle={() => toggleModelingLight(group.id)}
                        connectedLightCount={lightsPerGroup[group.id] || 0}
                        accentColor={accentColor}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Paper>
              
              {/* Action Buttons */}
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                {/* Test Fire */}
                <Tooltip title={connectedLights.length === 0 ? "Assign lights to groups first" : "Fire all enabled groups"}>
                  <span style={{ flex: 1 }}>
                    <Button
                      variant="contained"
                      onClick={() => testFire()}
                      disabled={connectedLights.length === 0}
                      startIcon={<FlashIcon />}
                      fullWidth
                      sx={{
                        bgcolor: accentColor'&:hover': { bgcolor: accentColor, filter: 'brightness(1.2)' }, '&:active': { 
                          transform: 'scale(0.98)',
                          boxShadow: `0 0 20px ${accentColor}`,
                        }}}
                    >
                      Test Fire
                    </Button>
                  </span>
                </Tooltip>
                
                {/* Sync */}
                <Tooltip title="Apply controller settings to scene lights">
                  <span>
                    <Button
                      variant="outlined"
                      onClick={handleSync}
                      disabled={isSyncing || connectedLights.length === 0}
                      startIcon={isSyncing ? <CircularProgress size={16} /> : <SyncIcon />}
                      sx={{ borderColor: accentColor, color: accentColor }}
                    >
                      Sync
                    </Button>
                  </span>
                </Tooltip>
                
                {/* Assign Lights */}
                <Tooltip title="Assign scene lights to controller groups">
                  <Badge 
                    badgeContent={unassignedLights.length} 
                    color="warning"
                    invisible={unassignedLights.length === 0}
                  >
                    <Button
                      variant="outlined"
                      onClick={() => setAssignDialogOpen(true)}
                      startIcon={<LinkIcon />}
                      sx={{ borderColor: 'grey.600', color: 'grey.400' }}
                    >
                      Assign ({connectedLights.length})
                    </Button>
                  </Badge>
                </Tooltip>
              </Stack>
              
              {/* Unassigned lights hint */}
              {unassignedLights.length > 0 && connectedLights.length > 0 && (
                <Typography 
                  variant="caption" 
                  color="warning.main" 
                  sx={{ display: 'block', mb: 1, textAlign: 'center' }}
                >
                  {unassignedLights.length} light{unassignedLights.length > 1 ? 's' : ', '} not assigned to any group
                </Typography>
              )}
              
              {/* Connected Lights Summary */}
              {connectedLights.length > 0 && (
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1, p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Connected Lights
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {connectedLights.map((light) => (
                      <Chip
                        key={light.nodeId}
                        label={`${groups.find((g) => g.id === light.groupId)?.name}: ${light.nodeName}`}
                        size="small"
                        sx={{
                          bgcolor: groups.find((g) => g.id === light.groupId)?.enabled
                            ? accentColor
                            : 'grey.700',
                          color: 'white',
                          fontSize: 10}}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
              
              {/* Change Controller Button */}
              <Button
                size="small"
                onClick={clearController}
                sx={{ mt: 2, color: 'grey.500' }}
              >
                Change Controller
              </Button>
            </>
          )}
        </Box>
      )}
      
      {/* Light Assignment Dialog */}
      <LightAssignmentDialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        groups={groups}
        connectedLights={connectedLights}
        unassignedLights={getUnassignedLights()}
        onAssign={assignLightToGroup}
        onUnassign={unassignLight}
        accentColor={accentColor}
      />
    </Paper>
  );
}

// ============================================================================
// Compact Widget Version
// ============================================================================

export function FlashControllerWidget() {
  const { state, testFire, syncToScene } = useFlashController();
  const { controller, groups, connectedLights } = state;
  
  if (!controller) return null;
  
  const accentColor = controller.accentColor;
  const enabledGroups = groups.filter((g) => g.enabled);
  
  return (
    <Paper
      sx={{
        p: 1,
        bgcolor: controller.primaryColor,
        borderRadius: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1}}
    >
      <WirelessIcon sx={{ color: accentColor, fontSize: 20 }} />
      
      <Stack direction="row" spacing={0.5}>
        {groups.map((g) => (
          <Box
            key={g.id}
            sx={{
              width: 20,
              height: 20,
              borderRadius: 0.5,
              bgcolor: g.enabled ? accentColor : 'grey.700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 70,
              color: 'white'}}
          >
            {g.name}
          </Box>
        ))}
      </Stack>
      
      <Tooltip title="Test Fire">
        <IconButton
          size="small"
          onClick={() => testFire()}
          disabled={connectedLights.length === 0}
          sx={{ color: accentColor }}
        >
          <FlashIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}

export default FlashControllerPanel;

