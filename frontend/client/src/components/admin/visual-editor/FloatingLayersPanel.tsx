import React, { useState } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  Close,
  DragIndicator,
  Visibility,
  VisibilityOff,
  Lock,
  LockOpen,
  Layers as LayersIcon,
  ExpandMore,
  ChevronRight,
} from '@mui/icons-material';
import { useVisualEditor } from './VisualEditorContext';

interface FloatingLayersPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FloatingLayersPanel: React.FC<FloatingLayersPanelProps> = ({ isOpen, onClose }) => {
  const { state } = useVisualEditor();
  const [collapsed, setCollapsed] = useState(false);

  if (!isOpen) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 80,
        left: 20,
        width: 280,
        maxHeight: 400,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'white',
        border: '1px solid',
        borderColor: 'divider'}}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5
         , bgcolor: '#F5F5F5',
          borderBottom: 1,
          borderColor: 'divider',
          cursor: 'move'}}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LayersIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={600}>
            Layers
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ({state.elements.length})
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={collapsed ? 'Expand' : 'Collapse'}>
            <IconButton size="small" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <ChevronRight fontSize="small" /> : <ExpandMore fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Close">
            <IconButton size="small" onClick={onClose}>
              <Close fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Layer List */}
      <Collapse in={!collapsed}>
        <Box sx={{ flex: 1, overflow: 'auto', maxHeight: 320 }}>
          {state.elements.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No layers yet
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Add elements to the canvas
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {[...state.elements].reverse().map((element, index) => (
                <ListItem
                  key={element.id}
                  disablePadding
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title={element.props?.locked ? 'Unlock' : 'Lock'}>
                        <IconButton
                          size="small"
                          edge="end"
                          sx={{ opacity: 0.5  , '&:hover': { opacity: 1 } }}

                        >
                          {element.props?.locked ? (
                            <Lock sx={{ fontSize: 16 }} />
                          ) : (
                            <LockOpen sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={element.props?.visible === false ? 'Show' : 'Hide'}>
                        <IconButton
                          size="small"
                          edge="end"
                          sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}

                        >
                          {element.props?.visible === false ? (
                            <VisibilityOff sx={{ fontSize: 16 }} />
                          ) : (
                            <Visibility sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                  sx={{
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: element.props?.selected ? 'action.selected' : 'transparent', '&:hover': {
                      bgcolor: element.props?.selected ? 'action.selected' : 'action.hover',
                    }}}
                >
                  <ListItemButton sx={{ pl: 2, pr: 10 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <DragIndicator sx={{ fontSize: 16, color: 'text.disabled' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: element.props?.selected ? 600 : 400}}>
                            {(element as any).name || element.type}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            {element.type}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {Math.round(element.width)} × {Math.round(element.height)}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

// Toggle button for layers panel
interface LayersPanelToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const LayersPanelToggle: React.FC<LayersPanelToggleProps> = ({ isOpen, onToggle }) => {
  return (
    <Tooltip title={isOpen ? 'Hide Layers' : 'Show Layers'}>
      <IconButton
        onClick={onToggle}
        sx={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          bgcolor: 'white',
          border: 1,
          borderColor: isOpen ? 'primary.main' : 'divider',
          color: isOpen ? 'primary.main' : 'text.secondary',
          boxShadow: 2,
          zIndex: 999, '&:hover': {
            bgcolor: 'grey.100',
            boxShadow: 4,
          }}}
      >
        <LayersIcon />
      </IconButton>
    </Tooltip>
  );
};
