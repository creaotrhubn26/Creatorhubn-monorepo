/**
 * ZIndexManager Component
 * Manages component layering with visual stack representation and layer controls
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Paper,
  Tooltip,
  Divider,
  Button,
  TextField,
} from '@mui/material';
import {
  Layers,
  ArrowUpward,
  ArrowDownward,
  VerticalAlignTop,
  VerticalAlignBottom,
  Visibility,
  VisibilityOff,
  Lock,
  LockOpen,
  Edit,
  Delete,
} from '@mui/icons-material';
import { useVisualEditor, EditorElement } from './VisualEditorContext';

export const ZIndexManager: React.FC = () => {
  const {
    state,
    updateComponentPosition,
    updateElement,
    bringToFront,
    sendToBack,
    selectElement,
    deleteElement,
  } = useVisualEditor();

  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  // Sort elements by z-index (highest to lowest)
  const sortedElements = [...state.elements].sort((a, b) => {
    const aZ = a.position?.zIndex ?? 0;
    const bZ = b.position?.zIndex ?? 0;
    return bZ - aZ;
  });

  const handleMoveUp = (element: EditorElement) => {
    const currentZ = element.position?.zIndex ?? 0;
    updateComponentPosition(element.id, { zIndex: currentZ + 1 });
  };

  const handleMoveDown = (element: EditorElement) => {
    const currentZ = element.position?.zIndex ?? 0;
    updateComponentPosition(element.id, { zIndex: currentZ - 1 });
  };

  const handleToggleLock = (element: EditorElement) => {
    const locked = element.position?.locked ?? false;
    updateComponentPosition(element.id, { locked: !locked });
  };

  const handleStartRename = (element: EditorElement) => {
    setEditingName(element.id);
    setNewName(element.name || element.id);
  };

  const handleSaveRename = (elementId: string) => {
    if (newName.trim()) {
      updateElement(elementId, { name: newName.trim() });
    }
    setEditingName(null);
    setNewName('');
  };

  const getElementIcon = (type: string) => {
    // Return appropriate icon based on element type
    return type.charAt(0).toUpperCase();
  };

  const getZIndexColor = (zIndex: number) => {
    if (zIndex > 10) return 'error';
    if (zIndex > 5) return 'warning';
    if (zIndex > 0) return 'primary';
    return 'default';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          gutterBottom
          sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Layers /> Layer Manager
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Manage component stacking order and visibility
        </Typography>
      </Box>

      {/* Stats */}
      <Card sx={{ mb: 3, bgcolor: 'primary.light' }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip
              icon={<Layers />}
              label={`${state.elements.length} layers`}
              color="primary"
              variant="filled"
            />
            <Chip
              icon={<Lock />}
              label={`${state.elements.filter((el) => el.position?.locked).length} locked`}
              color="secondary"
              variant="outlined"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Layer List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Layer Stack
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Top layers appear above lower layers
          </Typography>

          {sortedElements.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography variant="body2" color="textSecondary">
                No elements in canvas
              </Typography>
            </Paper>
          ) : (
            <List>
              {sortedElements.map((element, index) => {
                const zIndex = element.position?.zIndex ?? 0;
                const locked = element.position?.locked ?? false;
                const isSelected = state.selectedElement === element.id;

                return (
                  <React.Fragment key={element.id}>
                    <ListItem
                      sx={{
                        bgcolor: isSelected ? 'action.selected' : 'transparent',
                        borderRadius: 1,
                        mb: 1,
                        cursor: 'pointer', '&:hover': {
                          bgcolor: 'action.hover',
                        }}}
                      onClick={() => selectElement(element.id)}
                    >
                      {/* Element Type Icon */}
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1,
                          bgcolor: 'primary.main',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          mr: 2}}>
                        {getElementIcon(element.type)}
                      </Box>

                      {/* Element Info */}
                      <ListItemText
                        primary={
                          editingName === element.id ? (
                            <TextField
                              size="small"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              onBlur={() => handleSaveRename(element.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveRename(element.id);
                                }}
                              }
                              autoFocus
                            />
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2">
                                {element.name || element.id}
                              </Typography>
                              {locked && (
                                <Chip icon={<Lock />} label="Locked" size="small" color="warning" />
                              )}
                            </Box>
                          )
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Chip label={element.type} size="small" variant="outlined" />
                            <Chip
                              label={`z: ${zIndex}`}
                              size="small"
                              color={getZIndexColor(zIndex)}
                            />
                          </Box>
                        }
                      />

                      {/* Actions */}
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {/* Move to top */}
                          <Tooltip title="Bring to Front">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                bringToFront(element.id);
                              }}
                              disabled={locked}
                            >
                              <VerticalAlignTop fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {/* Move up */}
                          <Tooltip title="Move Up">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveUp(element);
                              }}
                              disabled={locked || index === 0}
                            >
                              <ArrowUpward fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {/* Move down */}
                          <Tooltip title="Move Down">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveDown(element);
                              }}
                              disabled={locked || index === sortedElements.length - 1}
                            >
                              <ArrowDownward fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {/* Send to back */}
                          <Tooltip title="Send to Back">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                sendToBack(element.id);
                              }}
                              disabled={locked}
                            >
                              <VerticalAlignBottom fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                          {/* Lock/Unlock */}
                          <Tooltip title={locked ? 'Unlock' : 'Lock'}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLock(element);
                              }}
                              color={locked ? 'warning' : 'default'}
                            >
                              {locked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
                            </IconButton>
                          </Tooltip>

                          {/* Rename */}
                          <Tooltip title="Rename">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartRename(element);
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {/* Delete */}
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete ${element.id}?`)) {
                                  deleteElement(element.id);
                                }}
                              }
                              color="error"
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < sortedElements.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {state.selectedElement && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<VerticalAlignTop />}
                onClick={() => state.selectedElement && bringToFront(state.selectedElement)}
              >
                Bring to Front
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<VerticalAlignBottom />}
                onClick={() => state.selectedElement && sendToBack(state.selectedElement)}
              >
                Send to Back
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};
