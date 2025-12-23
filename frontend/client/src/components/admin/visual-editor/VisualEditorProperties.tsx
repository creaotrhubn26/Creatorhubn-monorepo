/**
 * Visual Editor Properties Component
 * Right sidebar with element properties and settings
 */

import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  ButtonGroup,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Fullscreen as FullscreenIcon,
  Settings as SettingsIcon,
  Psychology as ExtendedThinkingIcon,
  FlashOn as HighPowerIcon,
  MonetizationOn as CostIcon,
  ColorLens as ColorIcon,
  GridOn as GridIcon,
  Science as ScienceIcon
} from '@mui/icons-material';

interface EditorElement {
  id: string;
  type: 'button' | 'text' | 'image' | 'card' | 'container' | 'grid' | 'audio' | 'video';
  x: number;
  y: number;
  width: number;
  height: number;
  styles: {
    backgroundColor?: string;
    color?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
    fontSize?: string;
    fontWeight?: string;
    lineHeight?: string;
    transform?: string;
    textShadow?: string;
    opacity?: number;
    boxShadow?: string;
    border?: string;
    display?: string;
    gap?: string;
    fontFamily?: string;
    fontStyle?: string;
    background?: string;
    textStroke?: string;
};
  props: Record<string, any>;
  children?: string[];
  parent?: string;
  icon?: string;
}

interface VisualEditorPropertiesProps {
  selectedElement: EditorElement | null;
  onElementUpdate: (elementId: string, updates: Partial<EditorElement>) => void;
  onElementDelete: (elementId: string) => void;
  onElementCopy: () => void;
  onElementPaste: () => void;
  onElementLock: () => void;
  onElementVisibility: () => void;
  onElementDuplicate: () => void;
  onElementGroup: () => void;
  onElementUngroup: () => void;
  onElementBringToFront: () => void;
  onElementSendToBack: () => void;
  onElementAlign: (alignment: string) => void;
  onElementDistribute: (direction: string) => void;
  selectedElements: string[];
  canPaste: boolean
}

const VisualEditorProperties: React.FC<VisualEditorPropertiesProps> = ({
  selectedElement,
  onElementUpdate,
  onElementDelete,
  onElementCopy,
  onElementPaste,
  onElementLock,
  onElementVisibility,
  onElementDuplicate,
  onElementGroup,
  onElementUngroup,
  onElementBringToFront,
  onElementSendToBack,
  onElementAlign,
  onElementDistribute,
  selectedElements,
  canPaste
}) => {
  // Theming system
  const theming = useTheming('prototype_tester');

  const handleStyleChange = (property: string, value: any) => {
    if (selectedElement) {
      onElementUpdate(selectedElement.id, {
        styles: {
          ...selectedElement.styles,
          [property]: value
        }
      });
    }
  };

  const handlePropChange = (property: string, value: any) => {
    if (selectedElement) {
      onElementUpdate(selectedElement.id, {
        props: {
          ...selectedElement.props,
          [property]: value
        }
      });
    }
  };

  if (!selectedElement) {
    return (
      <Box sx={{ width: 200, height: '100%', p: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Properties
        </Typography>
        <Typography color="text.secondary">
          Select an element to edit its properties
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: 200, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Properties
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {selectedElement.type.charAt(0).toUpperCase() + selectedElement.type.slice(1)} Element
        </Typography>
      </Box>

      {/* Actions */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <ButtonGroup fullWidth size="small" sx={{ mb: 2 }}>
          <Button startIcon={<CopyIcon />} onClick={onElementCopy}>
            Copy
          </Button>
          <Button startIcon={<AddIcon />} onClick={onElementDuplicate}>
            Duplicate
          </Button>
          <Button startIcon={<DeleteIcon />} onClick={() => onElementDelete(selectedElement.id)} color="error">
            Delete
          </Button>
        </ButtonGroup>

        <ButtonGroup fullWidth size="small">
          <Button startIcon={<LockIcon />} onClick={onElementLock}>
            Lock
          </Button>
          <Button startIcon={<VisibilityIcon />} onClick={onElementVisibility}>
            Hide
          </Button>
        </ButtonGroup>
      </Box>

      {/* Properties */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Position & Size */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Position & Size</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                label="X"
                type="number"
                size="small"
                value={selectedElement.x}
                onChange={(e) => onElementUpdate(selectedElement.id, { x: Number(e.target.value) })}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Y"
                type="number"
                size="small"
                value={selectedElement.y}
                onChange={(e) => onElementUpdate(selectedElement.id, { y: Number(e.target.value) })}
                sx={{ flex: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                label="Width"
                type="number"
                size="small"
                value={selectedElement.width}
                onChange={(e) => onElementUpdate(selectedElement.id, { width: Number(e.target.value) })}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Height"
                type="number"
                size="small"
                value={selectedElement.height}
                onChange={(e) => onElementUpdate(selectedElement.id, { height: Number(e.target.value) })}
                sx={{ flex: 1 }}
              />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Appearance */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Appearance</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Background Color"
                type="color"
                size="small"
                value={selectedElement.styles.backgroundColor || '#ffffff'}
                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
              />
              <TextField
                label="Text Color"
                type="color"
                size="small"
                value={selectedElement.styles.color || '#000000'}
                onChange={(e) => handleStyleChange('color', e.target.value)}
              />
              <TextField
                label="Border Radius"
                type="number"
                size="small"
                value={parseInt(selectedElement.styles.borderRadius || '0')}
                onChange={(e) => handleStyleChange('borderRadius', `${e.target.value}px`)}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedElement.styles.opacity !== undefined ? selectedElement.styles.opacity < 1 : false}
                    onChange={(e) => handleStyleChange('opacity', e.target.checked ? 0.5 : 1)}
                  />
                }
                label="Transparency"
              />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Typography */}
        {selectedElement.type === 'text' && (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Typography</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Font Size"
                  type="number"
                  size="small"
                  value={parseInt(selectedElement.styles.fontSize || '16')}
                  onChange={(e) => handleStyleChange('fontSize', `${e.target.value}px`)}
                />
                <FormControl size="small">
                  <InputLabel>Font Weight</InputLabel>
                  <Select
                    value={selectedElement.styles.fontWeight || 'normal'}
                    onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
                  >
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="bold">Bold</MenuItem>
                    <MenuItem value="lighter">Lighter</MenuItem>
                    <MenuItem value="bolder">Bolder</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Line Height"
                  type="number"
                  size="small"
                  value={parseFloat(selectedElement.styles.lineHeight || '1.5')}
                  onChange={(e) => handleStyleChange('lineHeight', e.target.value)}
                />
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Content */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Content</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {selectedElement.type === 'text' && (
                <TextField
                  label="Text Content"
                  multiline
                  rows={3}
                  value={selectedElement.props.text || ''}
                  onChange={(e) => handlePropChange('text', e.target.value)}
                />
              )}
              {selectedElement.type === 'button' && (
                <TextField
                  label="Button Text"
                  value={selectedElement.props.text || ''}
                  onChange={(e) => handlePropChange('text', e.target.value)}
                />
              )}
              {selectedElement.type === 'card' && (
                <>
                  <TextField
                    label="Card Title"
                    value={selectedElement.props.title || ''}
                    onChange={(e) => handlePropChange('title', e.target.value)}
                  />
                  <TextField
                    label="Card Content"
                    multiline
                    rows={3}
                    value={selectedElement.props.content || ''}
                    onChange={(e) => handlePropChange('content', e.target.value)}
                  />
                </>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Layout */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Layout</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Padding"
                size="small"
                value={selectedElement.styles.padding || '0px'}
                onChange={(e) => handleStyleChange('padding', e.target.value)}
              />
              <TextField
                label="Margin"
                size="small"
                value={selectedElement.styles.margin || '0px'}
                onChange={(e) => handleStyleChange('margin', e.target.value)}
              />
              <FormControl size="small">
                <InputLabel>Display</InputLabel>
                <Select
                  value={selectedElement.styles.display ||'block'}
                  onChange={(e) => handleStyleChange('display', e.target.value)}
                >
                  <MenuItem value="block">Block</MenuItem>
                  <MenuItem value="inline">Inline</MenuItem>
                  <MenuItem value="flex">Flex</MenuItem>
                  <MenuItem value="grid">Grid</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
};

export default VisualEditorProperties;