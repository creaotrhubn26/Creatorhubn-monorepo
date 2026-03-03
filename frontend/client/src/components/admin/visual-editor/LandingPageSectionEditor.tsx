/**
 * Landing Page Section Editor
 * Provides inline editing capabilities for landing page sections
 * Supports editing text, images, styles, and section visibility
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Tabs,
  Tab,
  Stack,
  Divider,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Slider,
  Tooltip,
  Collapse,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Edit,
  Save,
  Cancel,
  Visibility,
  VisibilityOff,
  Palette,
  TextFields,
  Image,
  Settings,
  DragIndicator,
  ExpandMore,
  ExpandLess,
  Add,
  Delete,
  ContentCopy,
  Undo,
  Redo,
} from '@mui/icons-material';
import { PageSection, PageStyles } from '@/hooks/usePageCustomizations';

interface SectionEditorProps {
  sectionId: string;
  sectionName: string;
  section: PageSection;
  styles?: PageStyles;
  onSave: (section: PageSection) => void;
  onStyleChange?: (styles: Partial<PageStyles>) => void;
  onVisibilityChange?: (visible: boolean) => void;
  isEditing?: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

interface CustomFieldDefinition {
  key: string;
  label: string;
  type?: 'text' | 'multiline' | 'number' | 'switch';
  helperText?: string;
}

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const toStringValue = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
};

export function LandingPageSectionEditor({
  sectionId,
  sectionName,
  section,
  styles,
  onSave,
  onStyleChange,
  onVisibilityChange,
  isEditing: externalEditing,
  onEditStart,
  onEditEnd,
}: SectionEditorProps) {
  const [isEditing, setIsEditing] = useState(externalEditing || false);
  const [tabValue, setTabValue] = useState(0);
  const [localSection, setLocalSection] = useState<PageSection>(section);
  const [localStyles, setLocalStyles] = useState<PageStyles>(styles || {});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<PageSection[]>([section]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Handle text field changes
  const handleFieldChange = useCallback((field: string, value: unknown) => {
    setLocalSection((prev) => {
      const newSection = { ...prev, [field]: value };
      setHasChanges(true);
      // Add to history
      setHistory((h) => [...h.slice(0, historyIndex + 1), newSection]);
      setHistoryIndex((i) => i + 1);
      return newSection;
    });
  }, [historyIndex]);

  // Handle style changes
  const handleStyleChange = useCallback((category: string, field: string, value: unknown) => {
    setLocalStyles((prev) => {
      const newStyles = {
        ...prev,
        [category]: {
          ...(prev[category] as Record<string, unknown> || {}),
          [field]: value,
        },
      };
      setHasChanges(true);
      return newStyles;
    });
  }, []);

  // Handle array item changes (for features, testimonials, etc.)
  const handleArrayItemChange = useCallback((arrayField: string, index: number, field: string, value: unknown) => {
    setLocalSection((prev) => {
      const array = [...(prev[arrayField] as unknown[] || [])];
      array[index] = { ...toRecord(array[index]), [field]: value };
      const newSection = { ...prev, [arrayField]: array };
      setHasChanges(true);
      return newSection;
    });
  }, []);

  // Add array item
  const handleAddArrayItem = useCallback((arrayField: string, template: Record<string, unknown>) => {
    setLocalSection((prev) => {
      const array = [...(prev[arrayField] as unknown[] || []), template];
      return { ...prev, [arrayField]: array };
    });
    setHasChanges(true);
  }, []);

  // Remove array item
  const handleRemoveArrayItem = useCallback((arrayField: string, index: number) => {
    setLocalSection((prev) => {
      const array = [...(prev[arrayField] as unknown[] || [])];
      array.splice(index, 1);
      return { ...prev, [arrayField]: array };
    });
    setHasChanges(true);
  }, []);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((i) => i - 1);
      setLocalSection(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((i) => i + 1);
      setLocalSection(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  // Save changes
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(localSection);
      if (onStyleChange && hasChanges) {
        onStyleChange(localStyles);
      }
      setHasChanges(false);
      setIsEditing(false);
      onEditEnd?.();
    } finally {
      setIsSaving(false);
    }
  }, [localSection, localStyles, onSave, onStyleChange, hasChanges, onEditEnd]);

  // Cancel editing
  const handleCancel = useCallback(() => {
    setLocalSection(section);
    setLocalStyles(styles || {});
    setHasChanges(false);
    setIsEditing(false);
    onEditEnd?.();
  }, [section, styles, onEditEnd]);

  // Start editing
  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    onEditStart?.();
  }, [onEditStart]);

  // Toggle visibility
  const handleVisibilityToggle = useCallback(() => {
    const newVisibility = !localSection.visible;
    setLocalSection((prev) => ({ ...prev, visible: newVisibility }));
    onVisibilityChange?.(newVisibility);
  }, [localSection.visible, onVisibilityChange]);

  // Render text editor
  const renderTextEditor = (field: string, label: string, multiline = false) => (
    <TextField
      fullWidth
      label={label}
      value={localSection[field] || ''}
      onChange={(e) => handleFieldChange(field, e.target.value)}
      multiline={multiline}
      rows={multiline ? 3 : 1}
      size="small"
      sx={{ mb: 2 }}
    />
  );

  // Render color picker
  const renderColorPicker = (category: string, field: string, label: string) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
      <Typography variant="body2" sx={{ minWidth: 100 }}>
        {label}
      </Typography>
      <input
        type="color"
        value={toStringValue((localStyles[category] as Record<string, unknown>)?.[field], '#ff6b00')}
        onChange={(e) => handleStyleChange(category, field, e.target.value)}
        style={{ width: 40, height: 30, border: 'none', cursor: 'pointer' }}
      />
      <TextField
        size="small"
        value={toStringValue((localStyles[category] as Record<string, unknown>)?.[field], '#ff6b00')}
        onChange={(e) => handleStyleChange(category, field, e.target.value)}
        sx={{ width: 120 }}
      />
    </Box>
  );

  const customFields: CustomFieldDefinition[] = Array.isArray(localSection.fields)
    ? (localSection.fields as CustomFieldDefinition[])
    : [];

  return (
    <Paper
      elevation={isEditing ? 4 : 1}
      sx={{
        p: 2,
        mb: 2,
        border: isEditing ? '2px solid #ff6b00' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 2,
        bgcolor: 'rgba(0,0,0,0.3)',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DragIndicator sx={{ color: 'rgba(255,255,255,0.3)', cursor: 'grab' }} />
          <Typography variant="subtitle1" fontWeight="bold" color="white">
            {sectionName}
          </Typography>
          <Chip
            size="small"
            label={sectionId}
            sx={{ bgcolor: 'rgba(255,107,0,0.2)', color: '#ff6b00' }}
          />
        </Box>

        <Stack direction="row" spacing={1}>
          <Tooltip title={localSection.visible !== false ? 'Hide Section' : 'Show Section'}>
            <IconButton onClick={handleVisibilityToggle} size="small">
              {localSection.visible !== false ? (
                <Visibility sx={{ color: '#4caf50' }} />
              ) : (
                <VisibilityOff sx={{ color: 'rgba(255,255,255,0.3)' }} />
              )}
            </IconButton>
          </Tooltip>

          {isEditing ? (
            <>
              <Tooltip title="Undo">
                <span>
                  <IconButton
                    onClick={handleUndo}
                    disabled={historyIndex === 0}
                    size="small"
                  >
                    <Undo sx={{ color: historyIndex > 0 ? 'white' : 'rgba(255,255,255,0.3)' }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Redo">
                <span>
                  <IconButton
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    size="small"
                  >
                    <Redo
                      sx={{
                        color: historyIndex < history.length - 1 ? 'white' : 'rgba(255,255,255,0.3)',
                      }}
                    />
                  </IconButton>
                </span>
              </Tooltip>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Cancel />}
                onClick={handleCancel}
                sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={isSaving ? <CircularProgress size={16} /> : <Save />}
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                sx={{
                  bgcolor: '#ff6b00',
                  '&:hover': { bgcolor: '#e55a00' },
                  '&:disabled': { bgcolor: 'rgba(255,107,0,0.3)' },
                }}
              >
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              size="small"
              startIcon={<Edit />}
              onClick={handleStartEdit}
              sx={{ bgcolor: '#ff6b00', '&:hover': { bgcolor: '#e55a00' } }}
            >
              Edit
            </Button>
          )}
        </Stack>
      </Box>

      {/* Editing Panel */}
      <Collapse in={isEditing}>
        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* Tabs */}
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{
            '& .MuiTab-root': { color: 'rgba(255,255,255,0.7)' },
            '& .Mui-selected': { color: '#ff6b00' },
            '& .MuiTabs-indicator': { bgcolor: '#ff6b00' },
          }}
        >
          <Tab icon={<TextFields />} label="Content" />
          <Tab icon={<Palette />} label="Styles" />
          <Tab icon={<Image />} label="Media" />
          <Tab icon={<Settings />} label="Advanced" />
        </Tabs>

        {/* Content Tab */}
        <TabPanel value={tabValue} index={0}>
          {renderTextEditor('title', 'Section Title')}
          {renderTextEditor('subtitle', 'Subtitle')}
          {renderTextEditor('content', 'Description', true)}

          {customFields.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'rgba(255,255,255,0.7)' }}>
                Custom Fields
              </Typography>
              {customFields.map((field) => {
                if (field.type === 'switch') {
                  return (
                    <FormControlLabel
                      key={field.key}
                      control={
                        <Switch
                          checked={Boolean(localSection[field.key])}
                          onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                          sx={{
                            '& .Mui-checked': { color: '#ff6b00' },
                            '& .Mui-checked + .MuiSwitch-track': { bgcolor: '#ff6b00' },
                          }}
                        />
                      }
                      label={field.label}
                      sx={{ color: 'white', mb: 1 }}
                    />
                  );
                }

                return (
                  <TextField
                    key={field.key}
                    fullWidth
                    label={field.label}
                    value={localSection[field.key] || ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    multiline={field.type === 'multiline'}
                    rows={field.type === 'multiline' ? 3 : 1}
                    type={field.type === 'number' ? 'number' : 'text'}
                    size="small"
                    sx={{ mb: 2 }}
                    helperText={field.helperText}
                  />
                );
              })}
            </Box>
          )}

          {/* Items array (for features, testimonials, etc.) */}
          {localSection.items && Array.isArray(localSection.items) && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'rgba(255,255,255,0.7)' }}>
                Items ({localSection.items.length})
              </Typography>
              {localSection.items.map((item: unknown, index: number) => {
                const itemRecord = toRecord(item);
                return (
                  <Paper
                  key={index}
                  sx={{
                    p: 2,
                    mb: 1,
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderRadius: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" color="rgba(255,255,255,0.5)">
                      Item {index + 1}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveArrayItem('items', index)}
                      sx={{ color: '#f44336' }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Title"
                    value={toStringValue(itemRecord.title)}
                    onChange={(e) => handleArrayItemChange('items', index, 'title', e.target.value)}
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Description"
                    value={toStringValue(itemRecord.description)}
                    onChange={(e) => handleArrayItemChange('items', index, 'description', e.target.value)}
                    multiline
                    rows={2}
                  />
                </Paper>
                );
              })}
              <Button
                startIcon={<Add />}
                onClick={() => handleAddArrayItem('items', { title: '', description: '' })}
                sx={{ color: '#ff6b00' }}
              >
                Add Item
              </Button>
            </Box>
          )}
        </TabPanel>

        {/* Styles Tab */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="subtitle2" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
            Colors
          </Typography>
          {renderColorPicker('colors', 'primary', 'Primary Color')}
          {renderColorPicker('colors', 'secondary', 'Secondary Color')}
          {renderColorPicker('colors', 'background', 'Background')}
          {renderColorPicker('colors', 'text', 'Text Color')}

          <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

          <Typography variant="subtitle2" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
            Spacing
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="rgba(255,255,255,0.5)">
              Section Padding
            </Typography>
            <Slider
              value={parseInt(toStringValue((localStyles.spacing as Record<string, unknown>)?.sectionPadding, '80'), 10)}
              onChange={(_, value) => handleStyleChange('spacing', 'sectionPadding', `${value}px`)}
              min={20}
              max={200}
              valueLabelDisplay="auto"
              sx={{ color: '#ff6b00' }}
            />
          </Box>
        </TabPanel>

        {/* Media Tab */}
        <TabPanel value={tabValue} index={2}>
          <TextField
            fullWidth
            size="small"
            label="Background Image URL"
            value={localSection.backgroundImage || ''}
            onChange={(e) => handleFieldChange('backgroundImage', e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Hero Image URL"
            value={localSection.heroImage || ''}
            onChange={(e) => handleFieldChange('heroImage', e.target.value)}
            sx={{ mb: 2 }}
          />
          <Alert severity="info" sx={{ bgcolor: 'rgba(33,150,243,0.1)' }}>
            Drag and drop images directly onto sections to upload (coming soon)
          </Alert>
        </TabPanel>

        {/* Advanced Tab */}
        <TabPanel value={tabValue} index={3}>
          <FormControlLabel
            control={
              <Switch
                checked={localSection.visible !== false}
                onChange={() => handleFieldChange('visible', !localSection.visible)}
                sx={{
                  '& .Mui-checked': { color: '#ff6b00' },
                  '& .Mui-checked + .MuiSwitch-track': { bgcolor: '#ff6b00' },
                }}
              />
            }
            label="Section Visible"
            sx={{ color: 'white', mb: 2 }}
          />

          <TextField
            fullWidth
            size="small"
            label="CSS Class"
            value={localSection.className || ''}
            onChange={(e) => handleFieldChange('className', e.target.value)}
            sx={{ mb: 2 }}
            helperText="Additional CSS classes for custom styling"
          />

          <TextField
            fullWidth
            size="small"
            label="Section ID (for navigation)"
            value={localSection.anchorId || sectionId}
            onChange={(e) => handleFieldChange('anchorId', e.target.value)}
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Animation</InputLabel>
            <Select
              value={localSection.animation || 'fadeInUp'}
              onChange={(e) => handleFieldChange('animation', e.target.value)}
              label="Animation"
            >
              <MenuItem value="none">None</MenuItem>
              <MenuItem value="fadeInUp">Fade In Up</MenuItem>
              <MenuItem value="fadeInDown">Fade In Down</MenuItem>
              <MenuItem value="slideInLeft">Slide In Left</MenuItem>
              <MenuItem value="slideInRight">Slide In Right</MenuItem>
              <MenuItem value="scaleIn">Scale In</MenuItem>
              <MenuItem value="bounce">Bounce</MenuItem>
            </Select>
          </FormControl>
        </TabPanel>

        {hasChanges && (
          <Alert severity="warning" sx={{ mt: 2, bgcolor: 'rgba(255,152,0,0.1)' }}>
            You have unsaved changes. Click "Save" to apply them.
          </Alert>
        )}
      </Collapse>
    </Paper>
  );
}

export default LandingPageSectionEditor;
