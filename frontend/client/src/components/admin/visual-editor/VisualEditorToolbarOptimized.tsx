/**
 * Visual Editor Toolbar Component - Performance Optimized
 * Contains all toolbar controls and navigation with React.memo and useCallback optimizations
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useMemo } from 'react';
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
  canUndo: boolean;
  canRedo: boolean;
  selectedElementsCount: number;
  totalElementsCount: number;
  projectName: string;
  isSaving: boolean
}

// Memoized components for better performance
const DynamicIntelligenceControls = memo(({
  extendedThinking,
  onExtendedThinkingChange,
  highPowerMode,
  onHighPowerModeChange
}: {
  extendedThinking: boolean;
  onExtendedThinkingChange: (value: boolean) => void;
  highPowerMode: boolean;
  onHighPowerModeChange: (value: boolean) => void
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', mr:  2 }}>
    <FormControlLabel
      control={
        <Switch
          checked={extendedThinking}
          onChange={(e) => onExtendedThinkingChange(e.target.checked)}
          size="small"
        />
    }
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
          <ExtendedThinkingIcon fontSize="small" />
          <Typography variant="caption">Extended</Typography>
        </Box>
    }
      labelPlacement="start"
    />
    <FormControlLabel
      control={
        <Switch
          checked={highPowerMode}
          onChange={(e) => onHighPowerModeChange(e.target.checked)}
          size="small"
        />
    }
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
          <HighPowerIcon fontSize="small" />
          <Typography variant="caption">High Power</Typography>
        </Box>
    }
      labelPlacement="start"
    />
  </Box>
));

const IntegrationActions = memo(({
  onOpenAssetLibrary,
  onOpenScrollStories,
  onOpenGoogleServices,
  onOpenNoteEditor,
  onRunQualityAnalysis
}: {
  onOpenAssetLibrary: () => void;
  onOpenScrollStories: () => void;
  onOpenGoogleServices: () => void;
  onOpenNoteEditor: () => void;
  onRunQualityAnalysis: () => void
}) => (
  <ButtonGroup size="small" sx={{ mr:  2 }}>
    <Tooltip title="Asset Library">
      <IconButton onClick={onOpenAssetLibrary}>
        <LayersIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Scroll Stories">
      <IconButton onClick={onOpenScrollStories}>
        <PaletteIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Google Services">
      <IconButton onClick={onOpenGoogleServices}>
        <SettingsIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Notes">
      <IconButton onClick={onOpenNoteEditor}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Quality Analysis">
      <IconButton onClick={onRunQualityAnalysis}>
        <ScienceIcon />
      </IconButton>
    </Tooltip>
  </ButtonGroup>
));

const ViewTabs = memo(({
  selectedView,
  onViewChange
}: {
  selectedView: string;
  onViewChange: (view: string) => void
}) => {
  const viewOptions = useMemo(() => [
    { value: 'plan', label: 'Plan', icon: <LayersIcon fontSize="small" />,},
    { value: 'designer', label: 'Designer', icon: <PaletteIcon fontSize="small" />,},
    { value: 'components', label: 'Components', icon: <AddIcon fontSize="small" />,},
    { value: 'code', label: 'Code', icon: <CodeIcon fontSize="small" />,},
    { value: 'preview', label: 'Preview', icon: <PreviewIcon fontSize="small" />,},
    { value: 'seo', label: 'SE', icon: <ScienceIcon fontSize="small" />,}
  ], []);

  return (
    <ToggleButtonGroup
      value={selectedView}
      exclusive
      onChange={(_, value) => value && onViewChange(value)}
      size="small"
      sx={{ mr:  2 }}
    >
      {viewOptions.map(({ value, label, icon }) => (
        <ToggleButton key={value} value={value}>
          {icon}
          <Typography sx={{ ml:  1 }}>{label}</Typography>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
});

const GridControls = memo(({
  showGrid,
  onShowGridChange,
  snapToGrid,
  onSnapToGridChange
}: {
  showGrid: boolean;
  onShowGridChange: (value: boolean) => void;
  snapToGrid: boolean;
  onSnapToGridChange: (value: boolean) => void
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
    <FormControlLabel
      control={
        <Switch
          checked={showGrid}
          onChange={(e) => onShowGridChange(e.target.checked)}
          size="small"
        />
    }
      label={<GridIcon fontSize="small" />}
      labelPlacement="start"
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
      labelPlacement="start"
    />
  </Box>
));

const CopyPasteControls = memo(({
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDelete,
  canUndo,
  canRedo
}: {
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  canUndo: boolean;
  canRedo: boolean
}) => (
  <ButtonGroup size="small" sx={{ mr:  2 }}>
    <Tooltip title="Undo">
      <IconButton onClick={onUndo} disabled={!canUndo}>
        <UndoIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Redo">
      <IconButton onClick={onRedo} disabled={!canRedo}>
        <RedoIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Copy">
      <IconButton onClick={onCopy}>
        <AddIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Paste">
      <IconButton onClick={onPaste}>
        <RemoveIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Delete">
      <IconButton onClick={onDelete}>
        <RemoveIcon />
      </IconButton>
    </Tooltip>
  </ButtonGroup>
));

const ElementManipulationControls = memo(({
  onGroup,
  onUngroup,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onDistributeHorizontally,
  onDistributeVertically,
  onBringToFront,
  onSendToBack
}: {
  onGroup: () => void;
  onUngroup: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onDistributeHorizontally: () => void;
  onDistributeVertically: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void
}) => (
  <ButtonGroup size="small" sx={{ mr:  2 }}>
    <Tooltip title="Group">
      <IconButton onClick={onGroup}>
        <LayersIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Ungroup">
      <IconButton onClick={onUngroup}>
        <LayersIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Align Left">
      <IconButton onClick={onAlignLeft}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Align Center">
      <IconButton onClick={onAlignCenter}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Align Right">
      <IconButton onClick={onAlignRight}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Distribute Horizontally">
      <IconButton onClick={onDistributeHorizontally}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Distribute Vertically">
      <IconButton onClick={onDistributeVertically}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Bring to Front">
      <IconButton onClick={onBringToFront}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title="Send to Back">
      <IconButton onClick={onSendToBack}>
        <EditIcon />
      </IconButton>
    </Tooltip>
  </ButtonGroup>
));

const StatusChips = memo(({
  selectedElementsCount,
  totalElementsCount,
  isSaving
}: {
  selectedElementsCount: number;
  totalElementsCount: number;
  isSaving: boolean
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
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
));

const VisualEditorToolbarOptimized: React.FC<VisualEditorToolbarProps> = ({
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
  canUndo,
  canRedo,
  selectedElementsCount,
  totalElementsCount,
  projectName,
  isSaving
}) => {
  // Memoized callbacks to prevent unnecessary re-renders
  const handleExtendedThinkingChange = useCallback(
  
  // Theming system
  const theming = useTheming('prototype_tester');(value: boolean) => {
    onExtendedThinkingChange(value);
}, [onExtendedThinkingChange]);

  const handleHighPowerModeChange = useCallback((value: boolean) => {
    onHighPowerModeChange(value);
}, [onHighPowerModeChange]);

  const handleShowGridChange = useCallback((value: boolean) => {
    onShowGridChange(value);
}, [onShowGridChange]);

  const handleSnapToGridChange = useCallback((value: boolean) => {
    onSnapToGridChange(value);
}, [onSnapToGridChange]);

  const handleMultiSelectModeChange = useCallback((value: boolean) => {
    onMultiSelectModeChange(value);
}, [onMultiSelectModeChange]);

  const handleViewChange = useCallback((view: string) => {
    onViewChange(view);
}, [onViewChange]);

  // Memoized values to prevent unnecessary recalculations
  const toolbarTitle = useMemo(() => 
    projectName || 'CreatorHub Visual Editor', 
    [projectName]
  );

  const saveButtonText = useMemo(() => 
    isSaving ? 'Saving...' : 'Save', 
    [isSaving]
  );

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <Typography variant="h6" sx={{  flexGrow:  1  }}>
          {toolbarTitle}
        </Typography>

        {/* Dynamic Intelligence Controls */}
        <DynamicIntelligenceControls
          extendedThinking={extendedThinking}
          onExtendedThinkingChange={handleExtendedThinkingChange}
          highPowerMode={highPowerMode}
          onHighPowerModeChange={handleHighPowerModeChange}
        />

        {/* Integration Actions */}
        <IntegrationActions
          onOpenAssetLibrary={onOpenAssetLibrary}
          onOpenScrollStories={onOpenScrollStories}
          onOpenGoogleServices={onOpenGoogleServices}
          onOpenNoteEditor={onOpenNoteEditor}
          onRunQualityAnalysis={onRunQualityAnalysis}
        />

        <Divider orientation="vertical" flexItem sx={{ mr:  2 }} />

        {/* View Tabs */}
        <ViewTabs
          selectedView={selectedView}
          onViewChange={handleViewChange}
        />

        <Divider orientation="vertical" flexItem sx={{ mr:  2 }} />

        {/* Advanced Visual Editor Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
          {/* Grid Controls */}
          <GridControls
            showGrid={showGrid}
            onShowGridChange={handleShowGridChange}
            snapToGrid={snapToGrid}
            onSnapToGridChange={handleSnapToGridChange}
          />
        </Box>

        {/* Multi-select Controls */}
        <FormControlLabel
          control={
            <Switch
              checked={multiSelectMode}
              onChange={(e) => handleMultiSelectModeChange(e.target.checked)}
              size="small"
            />
        }
          label="Multi-select"
          labelPlacement="start"
          sx={{ mr:  2 }}
        />

        {/* Copy/Paste Controls */}
        <CopyPasteControls
          onUndo={onUndo}
          onRedo={onRedo}
          onCopy={onCopy}
          onPaste={onPaste}
          onDelete={onDelete}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        {/* Asset Libraries */}
        <ButtonGroup size="small" sx={{ mr:  2 }}>
          <Tooltip title="Group">
            <IconButton onClick={onGroup}>
              <LayersIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Ungroup">
            <IconButton onClick={onUngroup}>
              <LayersIcon />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        {/* Code Generation */}
        <ButtonGroup size="small" sx={{ mr:  2 }}>
          <Tooltip title="Generate Code">
            <IconButton>
              <CodeIcon />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        {/* Advanced Canvas Controls */}
        <ButtonGroup size="small" sx={{ mr:  2 }}>
          <Tooltip title="Fullscreen">
            <IconButton>
              <FullscreenIcon />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        {/* Element Manipulation */}
        <ElementManipulationControls
          onGroup={onGroup}
          onUngroup={onUngroup}
          onAlignLeft={onAlignLeft}
          onAlignCenter={onAlignCenter}
          onAlignRight={onAlignRight}
          onDistributeHorizontally={onDistributeHorizontally}
          onDistributeVertically={onDistributeVertically}
          onBringToFront={onBringToFront}
          onSendToBack={onSendToBack}
        />

        {/* Advanced Features */}
        <ButtonGroup size="small" sx={{ mr:  2 }}>
          <Tooltip title="Settings">
            <IconButton>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        {/* Accessibility & Performance */}
        <StatusChips
          selectedElementsCount={selectedElementsCount}
          totalElementsCount={totalElementsCount}
          isSaving={isSaving}
        />

        {/* Save Button */}
        <Button variant="contained"
          startIcon={<SaveIcon />}
          onClick={onSave}
          disabled={isSaving}
        >
          {saveButtonText}
        </Button>
      </Toolbar>
    </AppBar>
  );
};

// Set display names for debugging
DynamicIntelligenceControls.displayName = 'DynamicIntelligenceControls';
IntegrationActions.displayName = 'IntegrationActions';
ViewTabs.displayName = 'ViewTabs';
GridControls.displayName = 'GridControls';
CopyPasteControls.displayName = 'CopyPasteControls';
ElementManipulationControls.displayName = 'ElementManipulationControls';
StatusChips.displayName ='StatusChips';

export default memo(VisualEditorToolbarOptimized);


