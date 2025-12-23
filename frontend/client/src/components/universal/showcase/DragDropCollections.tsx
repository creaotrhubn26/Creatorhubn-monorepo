/**
 * Drag and Drop Collections Component
 * Universal drag-and-drop collection management
 * Works across all professions with visual feedback
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Stack,
  Tooltip,
  alpha,
  Collapse,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  FolderOpen,
  DragIndicator,
  Close,
  Check,
  Undo,
  Collections as CollectionsIcon,
  Image,
  VideoLibrary,
  MusicNote,
  Business
} from '@mui/icons-material';

interface ShowcaseItem {
  id: string;
  title: string;
  thumbnailUrl?: string;
  fileType: string;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: React.ReactNode;
  items: ShowcaseItem[];
  createdAt: Date;
  updatedAt: Date;
}

interface DragDropCollectionsProps {
  items: ShowcaseItem[];
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  accentColor: string;
  onCollectionCreate?: (collection: Collection) => void;
  onCollectionUpdate?: (collection: Collection) => void;
  onCollectionDelete?: (collectionId: string) => void;
  onItemMove?: (itemId: string, fromCollectionId: string, toCollectionId: string) => void;
}

export const DragDropCollections: React.FC<DragDropCollectionsProps> = ({
  items: allItems,
  profession,
  accentColor,
  onCollectionCreate,
  onCollectionUpdate,
  onCollectionDelete,
  onItemMove
}) => {
  // State
  const [collections, setCollections] = useState<Collection[]>([
    {
      id: 'uncategorized',
      name: 'Uncategorized',
      description: 'Items not in any collection',
      color: '#95A5A6',
      icon: <FolderOpen />,
      items: allItems,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);
  
  const [showNewCollectionDialog, setShowNewCollectionDialog] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [editingCollection, setEditingCollection] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  
  // Drag state
  const [draggedItem, setDraggedItem] = useState<{ itemId: string; fromCollectionId: string } | null>(null);
  const [dragOverCollection, setDragOverCollection] = useState<string | null>(null);
  const [dropTargetCollection, setDropTargetCollection] = useState<string | null>(null);
  
  // Undo/Redo state
  const [history, setHistory] = useState<Collection[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Toast
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Get profession-specific icon
  const getProfessionIcon = () => {
    switch (profession) {
      case 'photographer': return <Image />;
      case 'videographer': return <VideoLibrary />;
      case 'music_producer': return <MusicNote />;
      case 'vendor': return <Business />;
    }
  };

  // Save to history for undo/redo
  const saveToHistory = useCallback((newCollections: Collection[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(collections)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCollections(newCollections);
  }, [collections, history, historyIndex]);

  // Undo/Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCollections(JSON.parse(JSON.stringify(history[historyIndex - 1])));
      setToast({ open: true, message: 'Undone', severity: 'info' });
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCollections(JSON.parse(JSON.stringify(history[historyIndex + 1])));
      setToast({ open: true, message: 'Redone', severity: 'info' });
    }
  }, [historyIndex, history]);

  // Create new collection
  const handleCreateCollection = useCallback(() => {
    if (!newCollectionName.trim()) return;

    const newCollection: Collection = {
      id: Date.now().toString(),
      name: newCollectionName,
      description: newCollectionDesc,
      color: accentColor,
      icon: getProfessionIcon(),
      items: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newCollections = [...collections, newCollection];
    saveToHistory(newCollections);
    onCollectionCreate?.(newCollection);
    
    setShowNewCollectionDialog(false);
    setNewCollectionName(', ');
    setNewCollectionDesc(', ');
    setToast({ open: true, message: `Collection "${newCollectionName}," created`, severity: 'success' });
  }, [newCollectionName, newCollectionDesc, accentColor, collections, saveToHistory, onCollectionCreate]);

  // Update collection name
  const handleUpdateCollectionName = useCallback((collectionId: string) => {
    if (!editingName.trim()) return;

    const newCollections = collections.map(col =>
      col.id === collectionId
        ? { ...col, name: editingName, updatedAt: new Date() }
        : col
    );

    saveToHistory(newCollections);
    const updatedCollection = newCollections.find(c => c.id === collectionId);
    if (updatedCollection) {
      onCollectionUpdate?.(updatedCollection);
    }

    setEditingCollection(null);
    setEditingName(', ');
    setToast({ open: true, message: 'Collection renamed', severity: 'success' });
  }, [editingName, collections, saveToHistory, onCollectionUpdate]);

  // Delete collection
  const handleDeleteCollection = useCallback((collectionId: string) => {
    if (collectionId === 'uncategorized') {
      setToast({ open: true, message: 'Cannot delete Uncategorized collection', severity: 'error' });
      return;
    }

    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;

    // Move items back to uncategorized
    const uncategorized = collections.find(c => c.id === 'uncategorized');
    if (uncategorized) {
      uncategorized.items = [...uncategorized.items, ...collection.items];
    }

    const newCollections = collections.filter(c => c.id !== collectionId);
    saveToHistory(newCollections);
    onCollectionDelete?.(collectionId);
    
    setToast({ open: true, message: `Collection "${collection.name}" deleted`, severity: 'success' });
  }, [collections, saveToHistory, onCollectionDelete]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, item: ShowcaseItem, collectionId: string) => {
    setDraggedItem({ itemId: item.id, fromCollectionId: collectionId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
    
    // Create drag image
    const dragImage = document.createElement('div');
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.innerHTML = `
      <div style="
        background: ${accentColor};
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      ">
        ${item.title}
      </div>
    `;
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  }, [accentColor]);

  const handleDragOver = useCallback((e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCollection(collectionId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCollection(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toCollectionId: string) => {
    e.preventDefault();
    setDragOverCollection(null);

    if (!draggedItem) return;
    if (draggedItem.fromCollectionId === toCollectionId) return;

    // Find collections
    const fromCollection = collections.find(c => c.id === draggedItem.fromCollectionId);
    const toCollection = collections.find(c => c.id === toCollectionId);
    
    if (!fromCollection || !toCollection) return;

    // Find and move item
    const item = fromCollection.items.find(i => i.id === draggedItem.itemId);
    if (!item) return;

    const newCollections = collections.map(col => {
      if (col.id === draggedItem.fromCollectionId) {
        return {
          ...col,
          items: col.items.filter(i => i.id !== draggedItem.itemId),
          updatedAt: new Date()
        };
      }
      if (col.id === toCollectionId) {
        return {
          ...col,
          items: [...col.items, item],
          updatedAt: new Date()
        };
      }
      return col;
    });

    saveToHistory(newCollections);
    onItemMove?.(draggedItem.itemId, draggedItem.fromCollectionId, toCollectionId);
    
    setDropTargetCollection(toCollectionId);
    setTimeout(() => setDropTargetCollection(null), 1000);
    
    setToast({ 
      open: true, 
      message: `Moved "${item.title}" to "${toCollection.name}"`, 
      severity: 'success' 
    });
    setDraggedItem(null);
  }, [draggedItem, collections, saveToHistory, onItemMove]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverCollection(null);
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CollectionsIcon sx={{ color: accentColor, fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight="700" sx={{ color: 'white' }}>
              Collections
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Drag items between collections to organize
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Undo">
            <span>
              <IconButton
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                sx={{ 
                  color: historyIndex > 0 ? 'white' : 'rgba(255,255,255,0.3)', '&:hover': { bgcolor: `${accentColor}20` }
                }}
              >
                <Undo />
              </IconButton>
            </span>
          </Tooltip>
          
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowNewCollectionDialog(true)}
            sx={{
              bgcolor: accentColor'&:hover': { bgcolor: `${accentColor}dd` }
            }}
          >
            New Collection
          </Button>
        </Stack>
      </Box>

      {/* Collections Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
        {collections.map((collection) => (
          <Paper
            key={collection.id}
            onDragOver={(e) => handleDragOver(e, collection.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, collection.id)}
            sx={{
              bgcolor: dragOverCollection === collection.id 
                ? `${collection.color}30` 
                : `${collection.color}10`,
              border: `2px solid ${
                dropTargetCollection === collection.id ? collection.color :
                dragOverCollection === collection.id ? collection.color :
                `${collection.color}40`
              }`,
              borderRadius: 2,
              p: 2,
              transition: 'all 0.3s ease',
              transform: dragOverCollection === collection.id ? 'scale(1.02)' : 'scale(1)',
              boxShadow: dragOverCollection === collection.id ? `0 8px 30px ${collection.color}40` : 'none'
            }}
          >
            {/* Collection Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <Box sx={{ color: collection.color, display: 'flex' }}>
                  {collection.icon}
                </Box>
                {editingCollection === collection.id ? (
                  <TextField
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateCollectionName(collection.id)}
                    onBlur={() => handleUpdateCollectionName(collection.id)}
                    autoFocus
                    size="small"
                    sx={{ flex: 1 }}
                  />
                ) : (
                  <Typography 
                    variant="subtitle1" 
                    fontWeight="600" 
                    sx={{ color: collection.color, flex: 1 }}
                    noWrap
                  >
                    {collection.name}
                  </Typography>
                )}
                <Chip 
                  label={collection.items.length}
                  size="small"
                  sx={{ 
                    bgcolor: `${collection.color}30`,
                    color: 'white',
                    fontWeight: 60
                  }}
                />
              </Box>

              {collection.id !== 'uncategorized' && (
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Rename">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditingCollection(collection.id);
                        setEditingName(collection.name);
                      }}
                      sx={{ color: 'rgba(255,255,255,0.7)' }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteCollection(collection.id)}
                      sx={{ color: 'rgba(255,255,255,0.7)' }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              )}
            </Box>

            {/* Collection Description */}
            {collection.description && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 2 }}>
                {collection.description}
              </Typography>
            )}

            {/* Drop Zone Indicator */}
            {dragOverCollection === collection.id && (
              <Alert 
                severity="info" 
                sx={{ 
                  mb: 2,
                  bgcolor: `${collection.color}20`,
                  color: 'white','& .MuiAlert-icon': { color: collection.color }
                }}
              >
                Drop here to add to "{collection.name}"
              </Alert>
            )}

            {/* Items */}
            <Box sx={{ 
              minHeight: 100,
              maxHeight: 300,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }}>
              {collection.items.length === 0 ? (
                <Box sx={{ 
                  textAlign: 'center', 
                  py: 4,
                  color: 'rgba(255,255,255,0.4)'
                }}>
                  <Typography variant="caption">
                    {dragOverCollection === collection.id 
                      ? 'Drop items here' 
                      : 'No items in this collection'}
                  </Typography>
                </Box>
              ) : (
                collection.items.map((item) => (
                  <Paper
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item, collection.id)}
                    onDragEnd={handleDragEnd}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1,
                      bgcolor: draggedItem?.itemId === item.id 
                        ? 'rgba(255,255,255,0.1)' 
                        : 'rgba(255,255,255,0.05)',
                      cursor: 'grab',
                      border: '1px solid rgba(255,255,255,0.1)',
                      opacity: draggedItem?.itemId === item.id ? 0.5 : 1,
                      transition: 'all 0.2s', '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.1)',
                        transform: 'translateX(4px)'
                      }, '&:active': {
                        cursor: 'grabbing'
                      }
                    }}
                  >
                    <DragIndicator sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 20 }} />
                    {item.thumbnailUrl && (
                      <Box
                        component="img"
                        src={item.thumbnailUrl}
                        sx={{
                          width: 40,
                          height: 40,
                          objectFit: 'cover',
                          borderRadius: 1
                        }}
                      />
                    )}
                    <Typography variant="body2" noWrap sx={{ flex: 1, color: 'white' }}>
                      {item.title}
                    </Typography>
                  </Paper>
                ))
              )}
            </Box>
          </Paper>
        ))}
      </Box>

      {/* New Collection Dialog */}
      <Dialog 
        open={showNewCollectionDialog} 
        onClose={() => setShowNewCollectionDialog(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a1a',
            color: 'white'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: `2px solid ${accentColor}` }}>
          Create New Collection
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            autoFocus
            label="Collection Name"
            fullWidth
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateCollection()}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Description (optional)"
            fullWidth
            multiline
            rows={2}
            value={newCollectionDesc}
            onChange={(e) => setNewCollectionDesc(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewCollectionDialog(false)} sx={{ color: 'white' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateCollection}
            variant="contained"
            disabled={!newCollectionName.trim()}
            sx={{ bgcolor: accentColor'&:hover': { bgcolor: `${accentColor}dd` } }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notifications */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity={toast.severity}
          onClose={() => setToast({ ...toast, open: false })}
          sx={{
            bgcolor: toast.severity === 'success' ? `${accentColor}20` :
                     toast.severity === 'error' ? 'rgba(244, 67, 54, 0.2)' :
                     'rgba(33, 150, 243, 0.2)',
            color: 'white',
            border: `1px solid ${
              toast.severity === 'success' ? accentColor :
              toast.severity === 'error' ? '#F44336' : '#2196F3'
            }`
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DragDropCollections;


