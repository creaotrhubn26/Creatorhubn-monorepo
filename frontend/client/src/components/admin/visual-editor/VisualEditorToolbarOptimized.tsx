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
import { getVisualEditorTokens } from './visualEditorTokens';

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
  onHighPowerModeChange,
  extendedLabel,
  highPowerLabel,
  iconMotionSx
}: {
  extendedThinking: boolean;
  onExtendedThinkingChange: (value: boolean) => void;
  highPowerMode: boolean;
  onHighPowerModeChange: (value: boolean) => void;
  extendedLabel: string;
  highPowerLabel: string;
  iconMotionSx: Record<string, string | number | Record<string, string | number>>;
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
          <ExtendedThinkingIcon fontSize="small" sx={iconMotionSx} />
          <Typography variant="caption">{extendedLabel}</Typography>
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
          <HighPowerIcon fontSize="small" sx={iconMotionSx} />
          <Typography variant="caption">{highPowerLabel}</Typography>
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
  onRunQualityAnalysis,
  labels,
  iconMotionSx
}: {
  onOpenAssetLibrary: () => void;
  onOpenScrollStories: () => void;
  onOpenGoogleServices: () => void;
  onOpenNoteEditor: () => void;
  onRunQualityAnalysis: () => void;
  labels: {
    assetLibrary: string;
    scrollStories: string;
    googleServices: string;
    notes: string;
    qualityAnalysis: string;
  };
  iconMotionSx: Record<string, string | number | Record<string, string | number>>;
}) => (
  <ButtonGroup size="small" sx={{ mr:  2 }}>
    <Tooltip title={labels.assetLibrary}>
      <IconButton onClick={onOpenAssetLibrary} sx={iconMotionSx}>
        <LayersIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.scrollStories}>
      <IconButton onClick={onOpenScrollStories} sx={iconMotionSx}>
        <PaletteIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.googleServices}>
      <IconButton onClick={onOpenGoogleServices} sx={iconMotionSx}>
        <SettingsIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.notes}>
      <IconButton onClick={onOpenNoteEditor} sx={iconMotionSx}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.qualityAnalysis}>
      <IconButton onClick={onRunQualityAnalysis} sx={iconMotionSx}>
        <ScienceIcon />
      </IconButton>
    </Tooltip>
  </ButtonGroup>
));

const ViewTabs = memo(({
  selectedView,
  onViewChange,
  labels,
  iconMotionSx
}: {
  selectedView: string;
  onViewChange: (view: string) => void;
  labels: {
    plan: string;
    designer: string;
    components: string;
    code: string;
    preview: string;
    seo: string;
  };
  iconMotionSx: Record<string, string | number | Record<string, string | number>>;
}) => {
  const viewOptions = useMemo(() => [
    { value: 'plan', label: labels.plan, icon: <LayersIcon fontSize="small" sx={iconMotionSx} />},
    { value: 'designer', label: labels.designer, icon: <PaletteIcon fontSize="small" sx={iconMotionSx} />},
    { value: 'components', label: labels.components, icon: <AddIcon fontSize="small" sx={iconMotionSx} />},
    { value: 'code', label: labels.code, icon: <CodeIcon fontSize="small" sx={iconMotionSx} />},
    { value: 'preview', label: labels.preview, icon: <PreviewIcon fontSize="small" sx={iconMotionSx} />},
    { value: 'seo', label: labels.seo, icon: <ScienceIcon fontSize="small" sx={iconMotionSx} />}
  ], [labels, iconMotionSx]);

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
  onSnapToGridChange,
  snapLabel
}: {
  showGrid: boolean;
  onShowGridChange: (value: boolean) => void;
  snapToGrid: boolean;
  onSnapToGridChange: (value: boolean) => void;
  snapLabel: string;
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
      label={snapLabel}
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
  canRedo,
  labels,
  iconMotionSx
}: {
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  canUndo: boolean;
  canRedo: boolean;
  labels: {
    undo: string;
    redo: string;
    copy: string;
    paste: string;
    delete: string;
  };
  iconMotionSx: Record<string, string | number | Record<string, string | number>>;
}) => (
  <ButtonGroup size="small" sx={{ mr:  2 }}>
    <Tooltip title={labels.undo}>
      <IconButton onClick={onUndo} disabled={!canUndo} sx={iconMotionSx}>
        <UndoIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.redo}>
      <IconButton onClick={onRedo} disabled={!canRedo} sx={iconMotionSx}>
        <RedoIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.copy}>
      <IconButton onClick={onCopy} sx={iconMotionSx}>
        <AddIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.paste}>
      <IconButton onClick={onPaste} sx={iconMotionSx}>
        <RemoveIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.delete}>
      <IconButton onClick={onDelete} sx={iconMotionSx}>
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
  onSendToBack,
  labels,
  iconMotionSx
}: {
  onGroup: () => void;
  onUngroup: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onDistributeHorizontally: () => void;
  onDistributeVertically: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  labels: {
    group: string;
    ungroup: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    distributeHorizontally: string;
    distributeVertically: string;
    bringToFront: string;
    sendToBack: string;
  };
  iconMotionSx: Record<string, string | number | Record<string, string | number>>;
}) => (
  <ButtonGroup size="small" sx={{ mr:  2 }}>
    <Tooltip title={labels.group}>
      <IconButton onClick={onGroup} sx={iconMotionSx}>
        <LayersIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.ungroup}>
      <IconButton onClick={onUngroup} sx={iconMotionSx}>
        <LayersIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.alignLeft}>
      <IconButton onClick={onAlignLeft} sx={iconMotionSx}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.alignCenter}>
      <IconButton onClick={onAlignCenter} sx={iconMotionSx}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.alignRight}>
      <IconButton onClick={onAlignRight} sx={iconMotionSx}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.distributeHorizontally}>
      <IconButton onClick={onDistributeHorizontally} sx={iconMotionSx}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.distributeVertically}>
      <IconButton onClick={onDistributeVertically} sx={iconMotionSx}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.bringToFront}>
      <IconButton onClick={onBringToFront} sx={iconMotionSx}>
        <EditIcon />
      </IconButton>
    </Tooltip>
    <Tooltip title={labels.sendToBack}>
      <IconButton onClick={onSendToBack} sx={iconMotionSx}>
        <EditIcon />
      </IconButton>
    </Tooltip>
  </ButtonGroup>
));

const StatusChips = memo(({
  selectedElementsCount,
  totalElementsCount,
  isSaving,
  selectedSuffix,
  savingLabel
}: {
  selectedElementsCount: number;
  totalElementsCount: number;
  isSaving: boolean;
  selectedSuffix: string;
  savingLabel: string;
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
    <Chip
      label={`${selectedElementsCount}/${totalElementsCount} ${selectedSuffix}`}
      size="small"
      color="primary"
      variant="outlined"
    />
    {isSaving && (
      <Chip
        label={savingLabel}
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
  // Theming system
  const theming = useTheming('prototype_tester');
  const tokens = getVisualEditorTokens();
  const iconMotionSx = {
    transition: `transform ${tokens.iconAnimation.durationMs}ms ${tokens.iconAnimation.easing}`,
    '&:hover': { transform: `scale(${tokens.iconAnimation.scaleHover})` },
    '&:active': { transform: `scale(${tokens.iconAnimation.scaleActive})` },
  };

  // Memoized callbacks to prevent unnecessary re-renders
  const handleExtendedThinkingChange = useCallback((value: boolean) => {
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
  const toolbarTitle = useMemo(
    () => projectName || tokens.legacyToolbar.titleFallback,
    [projectName, tokens.legacyToolbar.titleFallback]
  );

  const saveButtonText = useMemo(
    () => (isSaving ? tokens.legacyToolbar.status.saving : tokens.legacyToolbar.extraActions.save),
    [isSaving, tokens.legacyToolbar.status.saving, tokens.legacyToolbar.extraActions.save]
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
          extendedLabel={tokens.legacyToolbar.dynamicControls.extended}
          highPowerLabel={tokens.legacyToolbar.dynamicControls.highPower}
          iconMotionSx={iconMotionSx}
        />

        {/* Integration Actions */}
        <IntegrationActions
          onOpenAssetLibrary={onOpenAssetLibrary}
          onOpenScrollStories={onOpenScrollStories}
          onOpenGoogleServices={onOpenGoogleServices}
          onOpenNoteEditor={onOpenNoteEditor}
          onRunQualityAnalysis={onRunQualityAnalysis}
          labels={tokens.legacyToolbar.integrations}
          iconMotionSx={iconMotionSx}
        />

        <Divider orientation="vertical" flexItem sx={{ mr:  2 }} />

        {/* View Tabs */}
        <ViewTabs
          selectedView={selectedView}
          onViewChange={handleViewChange}
          labels={tokens.legacyToolbar.viewTabs}
          iconMotionSx={iconMotionSx}
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
            snapLabel={tokens.legacyToolbar.gridControls.snap}
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
          label={tokens.legacyToolbar.extraActions.multiSelect}
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
          labels={{
            undo: tokens.legacyToolbar.actionTooltips.undo,
            redo: tokens.legacyToolbar.actionTooltips.redo,
            copy: tokens.legacyToolbar.editActions.copy,
            paste: tokens.legacyToolbar.editActions.paste,
            delete: tokens.legacyToolbar.editActions.delete,
          }}
          iconMotionSx={iconMotionSx}
        />

        {/* Asset Libraries */}
        <ButtonGroup size="small" sx={{ mr:  2 }}>
          <Tooltip title={tokens.legacyToolbar.editActions.group}>
            <IconButton onClick={onGroup} sx={iconMotionSx}>
              <LayersIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={tokens.legacyToolbar.editActions.ungroup}>
            <IconButton onClick={onUngroup} sx={iconMotionSx}>
              <LayersIcon />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        {/* Code Generation */}
        <ButtonGroup size="small" sx={{ mr:  2 }}>
          <Tooltip title={tokens.legacyToolbar.extraActions.generateCode}>
            <IconButton sx={iconMotionSx}>
              <CodeIcon />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        {/* Advanced Canvas Controls */}
        <ButtonGroup size="small" sx={{ mr:  2 }}>
          <Tooltip title={tokens.legacyToolbar.extraActions.fullscreen}>
            <IconButton sx={iconMotionSx}>
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
          labels={tokens.legacyToolbar.editActions}
          iconMotionSx={iconMotionSx}
        />

        {/* Advanced Features */}
        <ButtonGroup size="small" sx={{ mr:  2 }}>
          <Tooltip title={tokens.legacyToolbar.extraActions.settings}>
            <IconButton sx={iconMotionSx}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        {/* Accessibility & Performance */}
        <StatusChips
          selectedElementsCount={selectedElementsCount}
          totalElementsCount={totalElementsCount}
          isSaving={isSaving}
          selectedSuffix={tokens.legacyToolbar.status.selectedSuffix}
          savingLabel={tokens.legacyToolbar.status.saving}
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


