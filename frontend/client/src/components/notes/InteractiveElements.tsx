import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

export type InteractiveElementType =
  | 'button'
  | 'form'
  | 'code-sandbox'
  | 'diagram'
  | 'simulation'
  | 'video'
  | 'quiz'
  | 'text'
  | 'image';

export interface Interaction {
  id: string;
  trigger: 'click' | 'hover' | 'focus';
  action: 'navigate' | 'open-modal' | 'play' | 'pause' | 'submit' | 'custom';
  payload?: Record<string, unknown>;
}

export interface ResponsiveConfig {
  mobile: { x: number; y: number; width: number; height: number };
  tablet: { x: number; y: number; width: number; height: number };
  desktop: { x: number; y: number; width: number; height: number };
}

export interface ElementStyle {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontFamily: string;
  padding: number;
  margin: number;
  opacity: number;
  zIndex: number;
}

export interface AnimationConfig {
  type: 'fade' | 'slide' | 'scale' | 'rotate' | 'bounce';
  duration: number;
  easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
  delay: number;
  direction: 'normal' | 'reverse' | 'alternate';
}

export interface InteractiveElement {
  id: string;
  type: InteractiveElementType;
  position: { x: number; y: number; width: number; height: number };
  content: Record<string, unknown>;
  interactions: Interaction[];
  responsive: ResponsiveConfig;
  style: ElementStyle;
  animation?: AnimationConfig;
  visible: boolean;
  locked: boolean;
}

interface InteractiveElementsProps {
  elements: InteractiveElement[];
  onElementAdd: (element: Omit<InteractiveElement, 'id'>) => void;
  onElementUpdate: (id: string, updates: Partial<InteractiveElement>) => void;
  onElementDelete: (id: string) => void;
  onElementSelect: (id: string) => void;
  selectedElementId?: string;
}

function getDefaultContent(type: InteractiveElementType): Record<string, unknown> {
  switch (type) {
    case 'button':
      return { text: 'Click me', action: 'navigate' };
    case 'form':
      return { title: 'Kontakt', submitText: 'Send' };
    case 'code-sandbox':
      return { language: 'javascript', initialCode: 'console.log("Hello World");' };
    case 'diagram':
      return { title: 'Flowchart', definition: 'graph TD; A[Start] --> B[End]' };
    case 'simulation':
      return { title: 'Simulation', steps: [] };
    case 'video':
      return { url: '', autoplay: false, controls: true };
    case 'quiz':
      return { title: 'Quiz', passingScore: 70 };
    case 'image':
      return { src: '', alt: 'Image', caption: '' };
    case 'text':
    default:
      return { text: 'Skriv inn tekst...' };
  }
}

function getDefaultStyle(type: InteractiveElementType): ElementStyle {
  return {
    backgroundColor: type === 'button' ? '#1976d2' : 'transparent',
    textColor: type === 'button' ? '#ffffff' : '#111111',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: type === 'button' ? 6 : 2,
    fontSize: 14,
    fontWeight: 'normal',
    fontFamily: 'Roboto, sans-serif',
    padding: 8,
    margin: 4,
    opacity: 1,
    zIndex: 1,
  };
}

function getDefaultResponsiveConfig(): ResponsiveConfig {
  return {
    mobile: { x: 0, y: 0, width: 100, height: 48 },
    tablet: { x: 0, y: 0, width: 100, height: 56 },
    desktop: { x: 0, y: 0, width: 100, height: 64 },
  };
}

export default function InteractiveElements({
  elements,
  onElementAdd,
  onElementDelete,
  onElementSelect,
  onElementUpdate,
  selectedElementId,
}: InteractiveElementsProps) {
  const theming = useTheming('photographer');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newType, setNewType] = useState<InteractiveElementType>('text');
  const [editingElement, setEditingElement] = useState<InteractiveElement | null>(null);
  const [editingText, setEditingText] = useState('');

  const selectedElement = useMemo(
    () => elements.find((element) => element.id === selectedElementId) || null,
    [elements, selectedElementId],
  );

  const handleAddElement = () => {
    const element: Omit<InteractiveElement, 'id'> = {
      type: newType,
      position: { x: 0, y: 0, width: 280, height: 120 },
      content: getDefaultContent(newType),
      interactions: [],
      responsive: getDefaultResponsiveConfig(),
      style: getDefaultStyle(newType),
      visible: true,
      locked: false,
    };
    onElementAdd(element);
    setShowAddDialog(false);
  };

  const handleStartEdit = (element: InteractiveElement) => {
    setEditingElement(element);
    const textValue = typeof element.content.text === 'string' ? element.content.text : '';
    setEditingText(textValue);
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!editingElement) return;
    onElementUpdate(editingElement.id, {
      content: { ...editingElement.content, text: editingText },
    });
    setShowEditDialog(false);
    setEditingElement(null);
  };

  const renderElementContent = (element: InteractiveElement) => {
    if (!element.visible) {
      return <Typography variant="caption">Skjult element</Typography>;
    }

    switch (element.type) {
      case 'button':
        return (
          <Button variant="contained" size="small">
            {typeof element.content.text === 'string' ? element.content.text : 'Button'}
          </Button>
        );
      case 'image':
        return (
          <Typography variant="body2">
            {typeof element.content.caption === 'string' ? element.content.caption : 'Image element'}
          </Typography>
        );
      default:
        return (
          <Typography variant="body2">
            {typeof element.content.text === 'string' ? element.content.text : element.type}
          </Typography>
        );
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
          Interactive Elements
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<Add />} variant="contained" onClick={() => setShowAddDialog(true)}>
            Add Element
          </Button>
          {selectedElement && (
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={() => handleStartEdit(selectedElement)}
            >
              Edit Selected
            </Button>
          )}
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {elements.map((element) => {
          const isSelected = selectedElementId === element.id;
          return (
            <Card
              key={element.id}
              sx={{
                border: isSelected ? '2px solid' : '1px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                opacity: element.visible ? 1 : 0.6,
                ...theming.getThemedCardSx(),
              }}
              onClick={() => onElementSelect(element.id)}
            >
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">{element.type}</Typography>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleStartEdit(element)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => onElementDelete(element.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
                {renderElementContent(element)}
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Interactive Element</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Velg elementtype:
          </Typography>
          <Select fullWidth value={newType} onChange={(event) => setNewType(event.target.value as InteractiveElementType)}>
            {[
              'button',
              'form',
              'code-sandbox',
              'diagram',
              'simulation',
              'video',
              'quiz',
              'text',
              'image',
            ].map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddElement}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Element</DialogTitle>
        <DialogContent>
          {editingElement && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Text"
                value={editingText}
                onChange={(event) => setEditingText(event.target.value)}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editingElement.visible}
                    onChange={(event) =>
                      setEditingElement((prev) =>
                        prev ? { ...prev, visible: event.target.checked } : prev,
                      )
                    }
                  />
                }
                label="Visible"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editingElement.locked}
                    onChange={(event) =>
                      setEditingElement((prev) =>
                        prev ? { ...prev, locked: event.target.checked } : prev,
                      )
                    }
                  />
                }
                label="Locked"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
