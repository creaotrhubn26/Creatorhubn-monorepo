/**
 * KeyframeEditor - Manual keyframe manipulation interface
 * 
 * Features:
 * - Keyframe list view
 * - Value editing (numeric, vector, color)
 * - Easing curve selection
 * - Batch operations
 * - Copy/paste keyframes
 * - Interpolation preview
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Slider,
  Tabs,
  Tab,
  ButtonGroup,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add,
  Delete,
  ContentCopy,
  ContentPaste,
  ContentCut,
  Edit,
  ExpandMore,
  KeyboardArrowUp,
  KeyboardArrowDown,
  DragIndicator,
  FiberManualRecord,
  Timeline,
  ShowChart,
  GridOn,
  SelectAll,
  Clear,
  Undo,
  Redo,
  PlayArrow,
  Pause,
} from '@mui/icons-material';
import { CurveEditorCanvas, BezierCurve, CURVE_PRESETS } from '../components/CurveEditorCanvas';
import {
  Keyframe,
  EasingName,
  EASING_FUNCTIONS,
  AnimationTrack,
} from '../../core/animation/SceneGraphAnimationEngine';

// ============================================================================
// Types
// ============================================================================

interface KeyframeWithIndex {
  index: number;
  keyframe: Keyframe;
}

type ValueType = 'number' | 'vector3' | 'euler' | 'color' | 'boolean';

interface KeyframeEditorProps {
  track: AnimationTrack | null;
  onUpdateKeyframe?: (index: number, keyframe: Keyframe) => void;
  onAddKeyframe?: (keyframe: Keyframe) => void;
  onDeleteKeyframes?: (indices: number[]) => void;
  onReorderKeyframes?: (fromIndex: number, toIndex: number) => void;
  currentTime?: number;
  onSeek?: (time: number) => void;
}

// ============================================================================
// Value Editors
// ============================================================================

interface NumberEditorProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
}

function NumberEditor({ value, onChange, label, min, max, step = 0.01 }: NumberEditorProps) {
  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      inputProps={{ step, min, max }}
      sx={{ width: 100 }}
    />
  );
}

interface Vector3EditorProps {
  value: { x: number; y: number; z: number };
  onChange: (value: { x: number; y: number; z: number }) => void;
  labels?: [string, string, string];
}

function Vector3Editor({ value, onChange, labels = ['X','Y','Z'] }: Vector3EditorProps) {
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <TextField
        size="small"
        type="number"
        label={labels[0]}
        value={value.x}
        onChange={(e) => onChange({ ...value, x: parseFloat(e.target.value) || 0 })}
        inputProps={{ step: 0.01 }}
        sx={{ width: 80 }}
      />
      <TextField
        size="small"
        type="number"
        label={labels[1]}
        value={value.y}
        onChange={(e) => onChange({ ...value, y: parseFloat(e.target.value) || 0 })}
        inputProps={{ step: 0.01 }}
        sx={{ width: 80 }}
      />
      <TextField
        size="small"
        type="number"
        label={labels[2]}
        value={value.z}
        onChange={(e) => onChange({ ...value, z: parseFloat(e.target.value) || 0 })}
        inputProps={{ step: 0.01 }}
        sx={{ width: 80 }}
      />
    </Box>
  );
}

interface ColorEditorProps {
  value: string;
  onChange: (value: string) => void;
}

function ColorEditor({ value, onChange }: ColorEditorProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 40, height: 32, border: 'none', cursor: 'pointer' }}
      />
      <TextField
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{ width: 100 }}
      />
    </Box>
  );
}

// ============================================================================
// Easing Selector
// ============================================================================

const EASING_OPTIONS: EasingName[] = [
  'linear','step','easeIn','easeOut','easeInOut','easeInQuad','easeOutQuad','easeInOutQuad','easeInCubic','easeOutCubic','easeInOutCubic','easeInQuart','easeOutQuart','easeInOutQuart','easeInElastic','easeOutElastic','easeInOutElastic','easeInBounce','easeOutBounce','easeInOutBounce','easeInBack','easeOutBack','easeInOutBack',
];

interface EasingSelectorProps {
  value: EasingName;
  onChange: (value: EasingName) => void;
}

function EasingSelector({ value, onChange }: EasingSelectorProps) {
  return (
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <InputLabel>Easing</InputLabel>
      <Select value={value} label="Easing" onChange={(e) => onChange(e.target.value as EasingName)}>
        {EASING_OPTIONS.map((easing) => (
          <MenuItem key={easing} value={easing}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 24,
                  height: 12,
                  position: 'relative',
                  border: '1px solid #555',
                  borderRadius: 0.5,
                  overflow: 'hidden'}}
              >
                <svg width={24} height={12} viewBox="0 0 24 12">
                  <path
                    d={generateEasingPath(easing)}
                    fill="none"
                    stroke="#2196f3"
                    strokeWidth={1}
                  />
                </svg>
              </Box>
              <Typography variant="body2">{easing}</Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function generateEasingPath(easing: EasingName): string {
  const fn = EASING_FUNCTIONS[easing];
  const points: string[] = [];

  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const y = fn(t);
    const x = t * 24;
    const svgY = 12 - y * 12;
    points.push(`${i === 0 ? 'M' : 'L'} ${x} ${svgY}`);
  }

  return points.join('');
}

// ============================================================================
// Keyframe Row Component
// ============================================================================

interface KeyframeRowProps {
  keyframe: Keyframe;
  index: number;
  valueType: ValueType;
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
  onUpdate: (keyframe: Keyframe) => void;
  onDelete: () => void;
  onSeek: () => void;
}

function KeyframeRow({
  keyframe,
  index,
  valueType,
  isSelected,
  isCurrent,
  onSelect,
  onUpdate,
  onDelete,
  onSeek,
}: KeyframeRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedKeyframe, setEditedKeyframe] = useState(keyframe);

  const handleSave = () => {
    onUpdate(editedKeyframe);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedKeyframe(keyframe);
    setIsEditing(false);
  };

  const formatValue = (value: any): string => {
    if (typeof value === 'number') {
      return value.toFixed(3);
    }
    if (value && typeof value === 'object') {
      if ('x' in value && 'y' in value && 'z' in value) {
        return `(${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)})`;
      }
      if ('r' in value && 'g' in value && 'b' in value) {
        return `RGB(${Math.round(value.r * 255)}, ${Math.round(value.g * 255)}, ${Math.round(value.b * 255)})`;
      }
    }
    return String(value);
  };

  return (
    <TableRow
      selected={isSelected}
      sx={{
        backgroundColor: isCurrent ? '#2a3a2a' : isSelected ? '#2a3a4a' : 'transparent', '&:hover': {
          backgroundColor: isCurrent ? '#2a4a2a' : '#252535',
        }}}
    >
      <TableCell padding="checkbox">
        <Checkbox checked={isSelected} onChange={onSelect} size="small" />
      </TableCell>
      <TableCell sx={{ width: 40 }}>
        <Typography variant="body2" fontFamily="monospace" color={isCurrent ? 'success.main' : 'text.secondary'}>
          {index}
        </Typography>
      </TableCell>
      <TableCell>
        {isEditing ? (
          <TextField
            size="small"
            type="number"
            value={editedKeyframe.time}
            onChange={(e) =>
              setEditedKeyframe({ ...editedKeyframe, time: parseFloat(e.target.value) || 0 })
            }
            inputProps={{ step: 0.1 }}
            sx={{ width: 80 }}
          />
        ) : (
          <Chip
            label={`${keyframe.time.toFixed(2)}s`}
            size="small"
            onClick={onSeek}
            sx={{ cursor: 'pointer' }}
          />
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          valueType === 'number' ? (
            <NumberEditor
              value={editedKeyframe.value as number}
              onChange={(v) => setEditedKeyframe({ ...editedKeyframe, value: v })}
            />
          ) : valueType === 'vector3' || valueType === 'euler' ? (
            <Vector3Editor
              value={editedKeyframe.value}
              onChange={(v) => setEditedKeyframe({ ...editedKeyframe, value: v })}
            />
          ) : valueType === 'color' ? (
            <ColorEditor
              value={editedKeyframe.value}
              onChange={(v) => setEditedKeyframe({ ...editedKeyframe, value: v })}
            />
          ) : (
            <TextField
              size="small"
              value={editedKeyframe.value}
              onChange={(e) => setEditedKeyframe({ ...editedKeyframe, value: e.target.value })}
            />
          )
        ) : (
          <Typography variant="body2" fontFamily="monospace">
            {formatValue(keyframe.value)}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <EasingSelector
            value={editedKeyframe.easing}
            onChange={(e) => setEditedKeyframe({ ...editedKeyframe, easing: e })}
          />
        ) : (
          <Chip
            label={keyframe.easing}
            size="small"
            sx={{ fontSize: 10 }}
          />
        )}
      </TableCell>
      <TableCell align="right">
        {isEditing ? (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button size="small" onClick={handleSave} variant="contained">
              Save
            </Button>
            <Button size="small" onClick={handleCancel}>
              Cancel
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton size="small" onClick={() => setIsEditing(true)}>
              <Edit fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={onDelete} color="error">
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        )}
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// Main Keyframe Editor Component
// ============================================================================

export function KeyframeEditor({
  track,
  onUpdateKeyframe,
  onAddKeyframe,
  onDeleteKeyframes,
  onReorderKeyframes,
  currentTime = 0,
  onSeek,
}: KeyframeEditorProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [clipboard, setClipboard] = useState<Keyframe[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newKeyframe, setNewKeyframe] = useState<Keyframe>({
    time: 0,
    value: 0,
    easing: 'easeInOut',
  });
  const [curveEditorOpen, setCurveEditorOpen] = useState(false);
  const [selectedCurve, setSelectedCurve] = useState<BezierCurve>(CURVE_PRESETS.easeInOut);

  // Determine value type from track
  const valueType: ValueType = useMemo(() => {
    if (!track) return 'number';
    switch (track.type) {
      case 'position':
      case 'scale':
        return 'vector3';
      case 'rotation':
        return 'euler';
      case 'lightColor':
        return 'color';
      default:
        return 'number';
    }
  }, [track?.type]);

  // Find current keyframe
  const currentKeyframeIndex = useMemo(() => {
    if (!track) return -1;
    return track.keyframes.findIndex((kf, i, arr) => {
      const next = arr[i + 1];
      return currentTime >= kf.time && (!next || currentTime < next.time);
    });
  }, [track, currentTime]);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    if (!track) return;
    setSelectedIndices(new Set(track.keyframes.map((_, i) => i)));
  }, [track]);

  const handleSelectNone = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const handleToggleSelect = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Copy/Cut/Paste
  const handleCopy = useCallback(() => {
    if (!track) return;
    const selected = Array.from(selectedIndices).map((i) => track.keyframes[i]);
    setClipboard(selected);
  }, [track, selectedIndices]);

  const handleCut = useCallback(() => {
    handleCopy();
    if (onDeleteKeyframes) {
      onDeleteKeyframes(Array.from(selectedIndices));
    }
    setSelectedIndices(new Set());
  }, [handleCopy, onDeleteKeyframes, selectedIndices]);

  const handlePaste = useCallback(() => {
    if (!onAddKeyframe || clipboard.length === 0) return;
    
    // Paste at current time with offset
    const offset = currentTime - (clipboard[0]?.time ?? 0);
    clipboard.forEach((kf) => {
      onAddKeyframe({
        ...kf,
        time: kf.time + offset,
      });
    });
  }, [clipboard, currentTime, onAddKeyframe]);

  // Delete selected
  const handleDeleteSelected = useCallback(() => {
    if (onDeleteKeyframes && selectedIndices.size > 0) {
      onDeleteKeyframes(Array.from(selectedIndices));
      setSelectedIndices(new Set());
    }
  }, [onDeleteKeyframes, selectedIndices]);

  // Add keyframe
  const handleAddKeyframe = useCallback(() => {
    if (onAddKeyframe) {
      onAddKeyframe(newKeyframe);
      setAddDialogOpen(false);
      setNewKeyframe({ time: currentTime, value: 0, easing: 'easeInOut' });
    }
  }, [onAddKeyframe, newKeyframe, currentTime]);

  // Open add dialog at current time
  const handleOpenAddDialog = useCallback(() => {
    // Get interpolated value at current time
    let defaultValue: any = 0;
    if (track && track.keyframes.length > 0) {
      // Simple: use last keyframe value
      defaultValue = track.keyframes[track.keyframes.length - 1].value;
    }

    setNewKeyframe({
      time: currentTime,
      value: defaultValue,
      easing: 'easeInOut',
    });
    setAddDialogOpen(true);
  }, [currentTime, track]);

  if (!track) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Timeline sx={{ fontSize: 48, color: '#444', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Select a track to edit keyframes
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Timeline />
            <Typography variant="h6" fontWeight={700}>
              Keyframe Editor
            </Typography>
            <Chip label={track.type} size="small" />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Add Keyframe">
              <IconButton size="small" onClick={handleOpenAddDialog}>
                <Add />
              </IconButton>
            </Tooltip>
            <Tooltip title="Curve Editor">
              <IconButton size="small" onClick={() => setCurveEditorOpen(true)}>
                <ShowChart />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Toolbar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <ButtonGroup size="small" variant="outlined">
            <Tooltip title="Select All">
              <Button onClick={handleSelectAll}>
                <SelectAll fontSize="small" />
              </Button>
            </Tooltip>
            <Tooltip title="Select None">
              <Button onClick={handleSelectNone}>
                <Clear fontSize="small" />
              </Button>
            </Tooltip>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem />

          <ButtonGroup size="small" variant="outlined">
            <Tooltip title="Copy">
              <Button onClick={handleCopy} disabled={selectedIndices.size === 0}>
                <ContentCopy fontSize="small" />
              </Button>
            </Tooltip>
            <Tooltip title="Cut">
              <Button onClick={handleCut} disabled={selectedIndices.size === 0}>
                <ContentCut fontSize="small" />
              </Button>
            </Tooltip>
            <Tooltip title="Paste">
              <Button onClick={handlePaste} disabled={clipboard.length === 0}>
                <ContentPaste fontSize="small" />
              </Button>
            </Tooltip>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem />

          <Tooltip title="Delete Selected">
            <IconButton
              size="small"
              onClick={handleDeleteSelected}
              disabled={selectedIndices.size === 0}
              color="error"
            >
              <Delete />
            </IconButton>
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          {selectedIndices.size > 0 && (
            <Chip
              label={`${selectedIndices.size} selected`}
              size="small"
              onDelete={handleSelectNone}
            />
          )}

          {clipboard.length > 0 && (
            <Chip
              label={`${clipboard.length} in clipboard`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      {/* Keyframe Table */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {track.keyframes.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <FiberManualRecord sx={{ fontSize: 48, color: '#444', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No keyframes yet
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={handleOpenAddDialog}
              sx={{ mt: 2 }}
            >
              Add First Keyframe
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={
                        selectedIndices.size > 0 && selectedIndices.size < track.keyframes.length
                      }
                      checked={selectedIndices.size === track.keyframes.length}
                      onChange={selectedIndices.size === track.keyframes.length ? handleSelectNone : handleSelectAll}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>#</TableCell>
                  <TableCell>Time</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Easing</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {track.keyframes.map((keyframe, index) => (
                  <KeyframeRow
                    key={`${keyframe.time}-${index}`}
                    keyframe={keyframe}
                    index={index}
                    valueType={valueType}
                    isSelected={selectedIndices.has(index)}
                    isCurrent={index === currentKeyframeIndex}
                    onSelect={() => handleToggleSelect(index)}
                    onUpdate={(kf) => onUpdateKeyframe?.(index, kf)}
                    onDelete={() => onDeleteKeyframes?.([index])}
                    onSeek={() => onSeek?.(keyframe.time)}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 1, borderTop: '1px solid #333', backgroundColor: '#1a1a1a' }}>
        <Typography variant="caption" color="text.secondary">
          {track.keyframes.length} keyframe(s) • Current: {currentTime.toFixed(2)}s
        </Typography>
      </Box>

      {/* Add Keyframe Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Keyframe</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              type="number"
              label="Time (seconds)"
              value={newKeyframe.time}
              onChange={(e) =>
                setNewKeyframe({ ...newKeyframe, time: parseFloat(e.target.value) || 0 })
              }
              inputProps={{ step: 0.1 }}
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Value
              </Typography>
              {valueType === 'number' ? (
                <NumberEditor
                  value={newKeyframe.value as number}
                  onChange={(v) => setNewKeyframe({ ...newKeyframe, value: v })}
                />
              ) : valueType === 'vector3' || valueType === 'euler' ? (
                <Vector3Editor
                  value={newKeyframe.value || { x: 0, y: 0, z: 0 }}
                  onChange={(v) => setNewKeyframe({ ...newKeyframe, value: v })}
                />
              ) : valueType === 'color' ? (
                <ColorEditor
                  value={newKeyframe.value ||'#ffffff'}
                  onChange={(v) => setNewKeyframe({ ...newKeyframe, value: v })}
                />
              ) : (
                <TextField
                  fullWidth
                  value={newKeyframe.value}
                  onChange={(e) => setNewKeyframe({ ...newKeyframe, value: e.target.value })}
                />
              )}
            </Box>

            <EasingSelector
              value={newKeyframe.easing}
              onChange={(e) => setNewKeyframe({ ...newKeyframe, easing: e })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddKeyframe} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Curve Editor Dialog */}
      <Dialog
        open={curveEditorOpen}
        onClose={() => setCurveEditorOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Bezier Curve Editor</DialogTitle>
        <DialogContent>
          <CurveEditorCanvas
            curve={selectedCurve}
            onChange={setSelectedCurve}
            width={400}
            height={400}
            showPreview
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCurveEditorOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              // Apply custom curve to selected keyframes
              setCurveEditorOpen(false);
            }}
          >
            Apply to Selected
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default KeyframeEditor;

