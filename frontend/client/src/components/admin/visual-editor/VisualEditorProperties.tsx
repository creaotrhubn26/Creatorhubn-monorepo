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
import { getVisualEditorTokens } from './visualEditorTokens';

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
  props: Record<string, unknown>;
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
  const tokens = getVisualEditorTokens();

  const handleStyleChange = (property: string, value: unknown) => {
    if (selectedElement) {
      onElementUpdate(selectedElement.id, {
        styles: {
          ...selectedElement.styles,
          [property]: value
        }
      });
    }
  };

  const handlePropChange = (property: string, value: unknown) => {
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
          {tokens.propertiesPanel.panelTitle}
        </Typography>
        <Typography color="text.secondary">
          {tokens.propertiesPanel.emptyState.body}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: 200, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          {tokens.propertiesPanel.panelTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {selectedElement.type.charAt(0).toUpperCase() + selectedElement.type.slice(1)} {tokens.propertiesPanel.panelSubtitleSuffix}
        </Typography>
      </Box>

      {/* Actions */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <ButtonGroup fullWidth size="small" sx={{ mb: 2 }}>
          <Button startIcon={<CopyIcon />} onClick={onElementCopy}>
            {tokens.propertiesPanel.actions.copy}
          </Button>
          <Button startIcon={<AddIcon />} onClick={onElementDuplicate}>
            {tokens.propertiesPanel.actions.duplicate}
          </Button>
          <Button startIcon={<DeleteIcon />} onClick={() => onElementDelete(selectedElement.id)} color="error">
            {tokens.propertiesPanel.actions.delete}
          </Button>
        </ButtonGroup>

        <ButtonGroup fullWidth size="small">
          <Button startIcon={<LockIcon />} onClick={onElementLock}>
            {tokens.propertiesPanel.actions.lock}
          </Button>
          <Button startIcon={<VisibilityIcon />} onClick={onElementVisibility}>
            {tokens.propertiesPanel.actions.hide}
          </Button>
        </ButtonGroup>
      </Box>

      {/* Properties */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Position & Size */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">{tokens.propertiesPanel.singleSelect.positionSize}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                label={tokens.propertiesPanel.labels.x}
                type="number"
                size="small"
                value={selectedElement.x}
                onChange={(e) => onElementUpdate(selectedElement.id, { x: Number(e.target.value) })}
                sx={{ flex: 1 }}
              />
              <TextField
                label={tokens.propertiesPanel.labels.y}
                type="number"
                size="small"
                value={selectedElement.y}
                onChange={(e) => onElementUpdate(selectedElement.id, { y: Number(e.target.value) })}
                sx={{ flex: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                label={tokens.propertiesPanel.labels.width}
                type="number"
                size="small"
                value={selectedElement.width}
                onChange={(e) => onElementUpdate(selectedElement.id, { width: Number(e.target.value) })}
                sx={{ flex: 1 }}
              />
              <TextField
                label={tokens.propertiesPanel.labels.height}
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
            <Typography variant="subtitle2">{tokens.propertiesPanel.singleSelect.appearance}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label={tokens.propertiesPanel.labels.backgroundColor}
                type="color"
                size="small"
                value={selectedElement.styles.backgroundColor || '#ffffff'}
                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
              />
              <TextField
                label={tokens.propertiesPanel.labels.textColor}
                type="color"
                size="small"
                value={selectedElement.styles.color || '#000000'}
                onChange={(e) => handleStyleChange('color', e.target.value)}
              />
              <TextField
                label={tokens.propertiesPanel.labels.borderRadius}
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
                label={tokens.propertiesPanel.labels.transparency}
              />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Typography */}
        {selectedElement.type === 'text' && (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">{tokens.propertiesPanel.singleSelect.typography}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label={tokens.propertiesPanel.labels.fontSize}
                  type="number"
                  size="small"
                  value={parseInt(selectedElement.styles.fontSize || '16')}
                  onChange={(e) => handleStyleChange('fontSize', `${e.target.value}px`)}
                />
                <FormControl size="small">
                  <InputLabel>{tokens.propertiesPanel.labels.fontWeight}</InputLabel>
                  <Select
                    value={selectedElement.styles.fontWeight || 'normal'}
                    onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
                  >
                    <MenuItem value="normal">{tokens.propertiesPanel.options.normal}</MenuItem>
                    <MenuItem value="bold">{tokens.propertiesPanel.options.bold}</MenuItem>
                    <MenuItem value="lighter">{tokens.propertiesPanel.options.lighter}</MenuItem>
                    <MenuItem value="bolder">{tokens.propertiesPanel.options.bolder}</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label={tokens.propertiesPanel.labels.lineHeight}
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
            <Typography variant="subtitle2">{tokens.propertiesPanel.singleSelect.content}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {selectedElement.type === 'text' && (
                <TextField
                  label={tokens.propertiesPanel.labels.textContent}
                  multiline
                  rows={3}
                  value={selectedElement.props.text || ''}
                  onChange={(e) => handlePropChange('text', e.target.value)}
                />
              )}
              {selectedElement.type === 'button' && (
                <TextField
                  label={tokens.propertiesPanel.labels.buttonText}
                  value={selectedElement.props.text || ''}
                  onChange={(e) => handlePropChange('text', e.target.value)}
                />
              )}
              {selectedElement.type === 'card' && (
                <>
                  <TextField
                    label={tokens.propertiesPanel.labels.cardTitle}
                    value={selectedElement.props.title || ''}
                    onChange={(e) => handlePropChange('title', e.target.value)}
                  />
                  <TextField
                    label={tokens.propertiesPanel.labels.cardContent}
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
            <Typography variant="subtitle2">{tokens.propertiesPanel.singleSelect.layout}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label={tokens.propertiesPanel.labels.padding}
                size="small"
                value={selectedElement.styles.padding || '0px'}
                onChange={(e) => handleStyleChange('padding', e.target.value)}
              />
              <TextField
                label={tokens.propertiesPanel.labels.margin}
                size="small"
                value={selectedElement.styles.margin || '0px'}
                onChange={(e) => handleStyleChange('margin', e.target.value)}
              />
              <FormControl size="small">
                <InputLabel>{tokens.propertiesPanel.labels.display}</InputLabel>
                <Select
                  value={selectedElement.styles.display ||'block'}
                  onChange={(e) => handleStyleChange('display', e.target.value)}
                >
                  <MenuItem value="block">{tokens.propertiesPanel.options.displayBlock}</MenuItem>
                  <MenuItem value="inline">{tokens.propertiesPanel.options.displayInline}</MenuItem>
                  <MenuItem value="flex">{tokens.propertiesPanel.options.displayFlex}</MenuItem>
                  <MenuItem value="grid">{tokens.propertiesPanel.options.displayGrid}</MenuItem>
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