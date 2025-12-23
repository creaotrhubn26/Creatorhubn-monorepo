import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  Image as ImageIcon,
  ViewInAr,
  Code,
  Close,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Lightbulb,
  CameraAlt,
  Person,
} from '@mui/icons-material';
import { useAppStore } from '../../state/store';
import { Scene, SceneNode } from '../../core/models/scene';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport?: (data: ImportResult) => void;
}

interface ImportResult {
  type: 'scene' | 'nodes' | 'gltf' | 'obj' | 'image';
  scene?: Partial<Scene>;
  nodes?: SceneNode[];
  modelUrl?: string;
  imageUrl?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function ImportDialog({ open, onClose, onImport }: ImportDialogProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [jsonInput, setJsonInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { setScene, addNode } = useAppStore();

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFiles(files);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFiles(files);
    }
  }, []);

  // Process files
  const handleFiles = useCallback(async (files: File[]) => {
    setImporting(true);
    setError(null);
    setPreview(null);

    try {
      for (const file of files) {
        const ext = file.name.split('.,').pop()?.toLowerCase();

        if (ext === 'json') {
          const text = await file.text();
          const parsed = JSON.parse(text);
          
          // Detect if it's a full scene or just nodes
          if (parsed.nodes && parsed.version) {
            setPreview({
              type: 'scene,',
              scene: parsed,
            });
          } else if (Array.isArray(parsed)) {
            setPreview({
              type: 'nodes',
              nodes: parsed,
            });
          } else if (parsed.type && parsed.transform) {
            setPreview({
              type: 'nodes',
              nodes: [parsed],
            });
          } else {
            throw new Error('Invalid JSON format. Expected scene or node data.');
          }
        } else if (ext === 'glb' || ext === 'gltf') {
          const url = URL.createObjectURL(file);
          setPreview({
            type: 'gltf',
            modelUrl: url,
          });
        } else if (ext === 'obj') {
          const url = URL.createObjectURL(file);
          setPreview({
            type: 'obj',
            modelUrl: url,
          });
        } else if (['jpg','jpeg','png','webp','hdr','exr'].includes(ext || ', ')) {
          const url = URL.createObjectURL(file);
          setPreview({
            type: 'image',
            imageUrl: url,
          });
        } else {
          throw new Error(`Unsupported file type: ${ext}`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setImporting(false);
    }
  }, []);

  // Parse JSON input
  const handleParseJson = useCallback(() => {
    setError(null);
    setPreview(null);

    try {
      if (!jsonInput.trim()) {
        throw new Error('Please enter JSON data');
      }

      const parsed = JSON.parse(jsonInput);

      if (parsed.nodes && parsed.version) {
        setPreview({
          type: 'scene',
          scene: parsed,
        });
      } else if (Array.isArray(parsed)) {
        setPreview({
          type: 'nodes',
          nodes: parsed,
        });
      } else if (parsed.type && parsed.transform) {
        setPreview({
          type: 'nodes',
          nodes: [parsed],
        });
      } else {
        throw new Error('Invalid JSON format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [jsonInput]);

  // Import the previewed data
  const handleImport = useCallback(() => {
    if (!preview) return;

    try {
      if (preview.type === 'scene' && preview.scene) {
        setScene(preview.scene as Scene);
      } else if (preview.type === 'nodes' && preview.nodes) {
        preview.nodes.forEach((node) => {
          addNode({
            ...node,
            id: node.id || `imported_${Math.random().toString(36).slice(2, 8)}`,
          });
        });
      } else if (preview.type === 'gltf' || preview.type === 'obj') {
        // Add as model node
        addNode({
          id: `model_${Math.random().toString(36).slice(2, 8)}`,
          type: 'prop',
          name: 'Imported Model',
          visible: true,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          userData: { modelUrl: preview.modelUrl },
        });
      } else if (preview.type === 'image') {
        // Add as HDRI or texture reference
        window.dispatchEvent(
          new CustomEvent('vs-import-image', {
            detail: { url: preview.imageUrl },
          })
        );
      }

      onImport?.(preview);
      onClose();
      setPreview(null);
      setJsonInput(', ');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  }, [preview, setScene, addNode, onImport, onClose]);

  // Get icon for node type
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'softbox':
      case 'umbrella':
      case 'spot':
        return <Lightbulb />;
      case 'camera':
        return <CameraAlt />;
      case 'model':
        return <Person />;
      case 'backdrop':
        return <ImageIcon />;
      default:
        return <ViewInAr />;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUpload />
          Import Scene / Assets
        </Box>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab icon={<InsertDriveFile />} label="File Upload" />
          <Tab icon={<Code />} label="JSON" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          {/* File Upload Area */}
          <Paper
            variant="outlined"
            sx={{
              p: 4,
              textAlign: 'center',
              borderStyle: 'dashed',
              borderWidth: 2,
              borderColor: dragOver ? 'primary.main' : 'divider',
              bgcolor: dragOver ? 'action.hover' : 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.2s'}}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Drop files here or click to browse
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supported formats: JSON, GLTF, GLB, OBJ, JPG, PNG, HDR
            </Typography>

            <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Chip label=".json" size="small" variant="outlined" />
              <Chip label=".gltf" size="small" variant="outlined" />
              <Chip label=".glb" size="small" variant="outlined" />
              <Chip label=".obj" size="small" variant="outlined" />
              <Chip label=".hdr" size="small" variant="outlined" />
            </Box>
          </Paper>

          <input
            ref={fileInputRef}
            type="file"
            hidden
            multiple
            accept=".json,.gltf,.glb,.obj,.jpg,.jpeg,.png,.webp,.hdr,.exr"
            onChange={handleFileSelect}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {/* JSON Input */}
          <TextField
            multiline
            rows={12}
            fullWidth
            placeholder={`Paste scene JSON here...

Example scene:
{
  "id":"scene-1","version" : "0.1.0","nodes": [
    {
      "id":"light1","type" : "softbox","visible": true"transform": { "position": [0, 2, 0]"rotation": [0, 0, 0]"scale": [1, 1, 1] }, "light": { "power": 0.5"beam": 45 }
    }
  ]"selection": []"environment": {}, "units" : "metric"
}

Or a single node:
{
  "id":"camera1","type" : "camera""visible": true"transform": { "position": [3, 1.5, 3]"rotation": [0, 0.7, 0]"scale": [1, 1, 1] }"camera": { "sensor": [36, 24]"focalLength": 50"aperture": 2.8"iso": 100"shutter": 0.008 }
}`}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            sx={{ fontFamily: 'monospace', fontSize: 12 }}
          />
          <Button
            variant="outlined"
            onClick={handleParseJson}
            sx={{ mt: 2 }}
            disabled={!jsonInput.trim()}
          >
            Parse JSON
          </Button>
        </TabPanel>

        {/* Progress */}
        {importing && <LinearProgress sx={{ mt: 2 }} />}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} icon={<ErrorIcon />}>
            {error}
          </Alert>
        )}

        {/* Preview */}
        {preview && (
          <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle color="success" fontSize="small" />
              Import Preview
            </Typography>

            {preview.type === 'scene' && preview.scene && (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Scene: {preview.scene.id || 'Unnamed'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Version: {preview.scene.version}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Nodes: {preview.scene.nodes?.length || 0}
                </Typography>

                {preview.scene.nodes && preview.scene.nodes.length > 0 && (
                  <List dense>
                    {preview.scene.nodes.slice(0, 5).map((node) => (
                      <ListItem key={node.id}>
                        <ListItemIcon>{getNodeIcon(node.type)}</ListItemIcon>
                        <ListItemText
                          primary={node.name || node.id}
                          secondary={node.type}
                        />
                      </ListItem>
                    ))}
                    {preview.scene.nodes.length > 5 && (
                      <ListItem>
                        <ListItemText
                          primary={`... and ${preview.scene.nodes.length - 5} more`}
                          primaryTypographyProps={{ color: 'text.secondary', variant: 'body2' }}
                        />
                      </ListItem>
                    )}
                  </List>
                )}

                <Alert severity="warning" icon={<Warning />} sx={{ mt: 1 }}>
                  Importing a scene will replace your current scene
                </Alert>
              </Box>
            )}

            {preview.type === 'nodes' && preview.nodes && (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {preview.nodes.length} node(s) will be added
                </Typography>
                <List dense>
                  {preview.nodes.map((node) => (
                    <ListItem key={node.id}>
                      <ListItemIcon>{getNodeIcon(node.type)}</ListItemIcon>
                      <ListItemText
                        primary={node.name || node.id}
                        secondary={`${node.type} at [${node.transform.position.join(', ')}]`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {(preview.type === 'gltf' || preview.type === 'obj') && (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  3D Model will be added as a prop
                </Typography>
                <Chip
                  icon={<ViewInAr />}
                  label={preview.type.toUpperCase()}
                  size="small"
                  sx={{ mt: 1 }}
                />
              </Box>
            )}

            {preview.type === 'image' && (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Image will be available for HDRI/texture use
                </Typography>
                {preview.imageUrl && (
                  <Box
                    component="img"
                    src={preview.imageUrl}
                    sx={{
                      maxWidth: 200,
                      maxHeight: 150,
                      mt: 1,
                      borderRadius: 1,
                      objectFit: 'cover'}}
                  />
                )}
              </Box>
            )}
          </Paper>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={!preview || importing}
          startIcon={<CloudUpload />}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { ImportDialog };
