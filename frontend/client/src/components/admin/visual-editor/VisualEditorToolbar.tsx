/**
 * Visual Editor Toolbar Component
 * Contains all toolbar controls and navigation
 */

import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Box,
  Chip,
  Badge,
  ToggleButtonGroup,
  ToggleButton,
  Divider
} from '@mui/material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';
import { useIntegrationFeatures } from '../../../hooks/useIntegrationFeatures';
import {
  Layers as LayersIcon,
  Palette as PaletteIcon,
  Code as CodeIcon,
  Preview as PreviewIcon,
  CropFree as SelectIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Fullscreen as FullscreenIcon,
  Settings as SettingsIcon,
  Psychology as ExtendedThinkingIcon,
  FlashOn as HighPowerIcon,
  MonetizationOn as CostIcon,
  ColorLens as ColorIcon,
  GridOn as GridIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Science as ScienceIcon
} from '@mui/icons-material';

interface VisualEditorToolbarProps {
  selectedView: string;
  onViewChange: (view: string) => void;
  extendedThinking: boolean;
  onExtendedThinkingChange: (value: boolean) => void;
  highPowerMode: boolean;
  onHighPowerModeChange: (value: boolean) => void;
  showGrid: boolean;
  onShowGridChange: (value: boolean) => void;
  snapToGrid: boolean;
  onSnapToGridChange: (value: boolean) => void;
  multiSelectMode: boolean;
  onMultiSelectModeChange: (value: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onDistributeHorizontally: () => void;
  onDistributeVertically: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onOpenAssetLibrary: () => void;
  onOpenScrollStories: () => void;
  onOpenGoogleServices: () => void;
  onOpenNoteEditor: () => void;
  onRunQualityAnalysis: () => void;
  showUnifiedDashboard: boolean;
  onToggleUnifiedDashboard: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selectedElementsCount: number;
  totalElementsCount: number;
  projectName: string;
  isSaving: boolean;
}

const VisualEditorToolbar: React.FC<VisualEditorToolbarProps> = ({
  selectedView,
  onViewChange,
  extendedThinking,
  onExtendedThinkingChange,
  highPowerMode,
  onHighPowerModeChange,
  showGrid,
  onShowGridChange,
  snapToGrid,
  onSnapToGridChange,
  multiSelectMode,
  onMultiSelectModeChange,
  onUndo,
  onRedo,
  onSave,
  onCopy,
  onPaste,
  onDelete,
  onGroup,
  onUngroup,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onDistributeHorizontally,
  onDistributeVertically,
  onBringToFront,
  onSendToBack,
  onOpenAssetLibrary,
  onOpenScrollStories,
  onOpenGoogleServices,
  onOpenNoteEditor,
  onRunQualityAnalysis,
  showUnifiedDashboard,
  onToggleUnifiedDashboard,
  canUndo,
  canRedo,
  selectedElementsCount,
  totalElementsCount,
  projectName,
  isSaving
}) => {
  // Enhanced Master Integration
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');

  // Feature access system
  const { hasFeature, getFeatureList, totalActiveIntegrations } = useIntegrationFeatures();

  // Feature access flags
  const visualEditorAccess = { hasAccess: hasFeature('visual-editor') };
  const toolbarAccess = { hasAccess: hasFeature('visual-editor-toolbar') };
  const designToolsAccess = { hasAccess: hasFeature('design-tools') };
  const layoutToolsAccess = { hasAccess: hasFeature('layout-tools') };
  const editingToolsAccess = { hasAccess: hasFeature('editing-tools') };
  const assetLibraryAccess = { hasAccess: hasFeature('asset-library') };
  const previewModeAccess = { hasAccess: hasFeature('preview-mode') };
  const advancedFeaturesAccess = { hasAccess: hasFeature('advanced-features') };

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            {projectName || 'CreatorHub Visual Editor'}
          </Typography>
          
          {/* Feature Analytics Display */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            mt: 0.5
        }}>
            <Typography variant="caption" color="text.secondary">
              Features: {totalActiveIntegrations}/12
            </Typography>
            <Chip 
              label={`${Math.round((totalActiveIntegrations / 12) * 100)}%`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '10px', height: 18 }}
            />
          </Box>
        </Box>

        {/* Dynamic Intelligence Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={extendedThinking}
                onChange={(e) => onExtendedThinkingChange(e.target.checked)}
                size="small"
                color="primary"
              />
          }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ExtendedThinkingIcon fontSize="small" />
                <Typography variant="caption">Extended</Typography>
              </Box>
          }
            labelPlacement="start"
            sx={{ mr: 2 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={highPowerMode}
                onChange={(e) => onHighPowerModeChange(e.target.checked)}
                size="small"
                color="warning"
              />
          }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <HighPowerIcon fontSize="small" />
                <Typography variant="caption">High Power</Typography>
              </Box>
          }
            labelPlacement="start"
            sx={{ mr: 1 }}
          />
        </Box>

        {/* Action Buttons */}
        <ButtonGroup variant="outlined" size="small" sx={{ mr: 2 }}>
          <Tooltip title="Undo (Ctrl+Z)">
            <IconButton onClick={onUndo} disabled={!canUndo}>
              <UndoIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Redo (Ctrl+Y)">
            <IconButton onClick={onRedo} disabled={!canRedo}>
              <RedoIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Save (Ctrl+S)">
            <IconButton onClick={onSave} disabled={isSaving}>
              <SaveIcon />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mr: 2 }} />

        {/* View Tabs */}
        <ToggleButtonGroup
          value={selectedView}
          exclusive
          onChange={(_, value) => value && onViewChange(value)}
          size="small"
          sx={{ mr: 2 }}
        >
          <ToggleButton value="plan">
            <LayersIcon fontSize="small" sx={{ mr: 1 }} />
            Plan
          </ToggleButton>
          <ToggleButton value="designer">
            <PaletteIcon fontSize="small" sx={{ mr: 1 }} />
            Designer
          </ToggleButton>
          <ToggleButton value="components">
            <AddIcon fontSize="small" sx={{ mr: 1 }} />
            Components
          </ToggleButton>
          <ToggleButton value="code">
            <CodeIcon fontSize="small" sx={{ mr: 1 }} />
            Code
          </ToggleButton>
          <ToggleButton value="preview">
            <PreviewIcon fontSize="small" sx={{ mr: 1 }} />
            Preview
          </ToggleButton>
          <ToggleButton value="seo">
            <ScienceIcon fontSize="small" sx={{ mr: 1 }} />
            SEO
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Unified Dashboard Toggle */}
        <Tooltip title={showUnifiedDashboard ? "Hide Unified Dashboard" : "Show Unified Dashboard"}>
          <Button
            variant={showUnifiedDashboard ? "contained" : "outlined"}
            onClick={onToggleUnifiedDashboard}
            startIcon={<ScienceIcon />}
            size="small"
            sx={{ mr: 2 }}
          >
            Dashboard
          </Button>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mr: 2 }} />

        {/* Advanced Visual Editor Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
          {/* Grid Controls */}
          <FormControlLabel
            control={
              <Switch
                checked={showGrid}
                onChange={(e) => onShowGridChange(e.target.checked)}
                size="small"
              />
          }
            label={<GridIcon fontSize="small" />}
          />
          <FormControlLabel
            control={
              <Switch
                checked={snapToGrid}
                onChange={(e) => onSnapToGridChange(e.target.checked)}
                size="small"
              />
          }
            label="Snap"
          />
          <FormControlLabel
            control={
              <Switch
                checked={multiSelectMode}
                onChange={(e) => onMultiSelectModeChange(e.target.checked)}
                size="small"
              />
          }
            label="Multi"
          />
        </Box>

        {/* Status Indicators */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`${selectedElementsCount}/${totalElementsCount} selected`}
            size="small"
            color="primary"
            variant="outlined"
          />
          {isSaving && (
            <Chip
              label="Saving..."
              size="small"
              color="secondary"
              variant="filled"
            />
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default VisualEditorToolbar;