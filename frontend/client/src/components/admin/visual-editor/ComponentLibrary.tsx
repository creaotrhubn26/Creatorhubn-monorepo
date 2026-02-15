/**
 * Component Library - Save and reuse components
 */

import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Grid,
  InputAdornment,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Close,
  Add,
  Search,
  MoreVert,
  Edit,
  Delete,
  ContentCopy,
  Star,
  StarBorder,
  Share,
  Download,
  Folder,
  Code,
  Visibility,
} from '@mui/icons-material';

interface Component {
  id: string;
  name: string;
  description: string;
  category: 'Buttons' | 'Forms' | 'Cards' | 'Navigation' | 'Layout' | 'Custom';
  code: {
    html?: string;
    react?: string;
    css?: string;
  };
  preview?: string; // Base64 image
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  props?: Record<string, unknown>;
}

interface ComponentLibraryProps {
  open: boolean;
  onClose: () => void;
  onUseComponent?: (component: Component) => void;
}

export const ComponentLibrary: React.FC<ComponentLibraryProps> = ({
  open,
  onClose,
  onUseComponent,
}) => {
  const [components, setComponents] = useState<Component[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newComponent, setNewComponent] = useState<Partial<Component>>({
    name: '',
    description: '',
    category: 'Custom',
    tags: [],
    favorite: false,
  });
  const [anchorEl, setAnchorEl] = useState<{ element: HTMLElement; componentId: string } | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    // Load components from localStorage
    const stored = localStorage.getItem('visual-editor-components,');
    if (stored) {
      setComponents(JSON.parse(stored);
    } else {
      // Initialize with default components
      setComponents(getDefaultComponents();
    }
  }, []);

  const saveComponents = (comps: Component[]) => {
    localStorage.setItem('visual-editor-components, ', JSON.stringify(comps);
    setComponents(comps);
  };

  const getDefaultComponents = (): Component[] => {
    return [
      {
        id: '1',
        name: 'Primary Button',
        description: 'Styled primary button with hover effects',
        category: 'Buttons',
        code: {
          react: `<button className="btn-primary" onClick={onClick}>\n  {children}\n</button>`,
          css: `.btn-primary {\n  background: #007ACC;\n  color: white;\n  padding: 12px 24px;\n  border-radius: 6px;\n  border: none;\n  cursor: pointer;\n  font-weight: 600;\n , transition: all 0.3s;\n}\n\n.btn-primary: hover {\n  background: #005A9E;\n , transform: translateY(-2px);\n  box-shadow: 0 4px 12px rgba(0,122,204,0.3);\n}`,
        },
        tags: ['button','primary','interactive'],
        favorite: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        props: { onClick: 'function', children: 'node' },
      },
      {
        id: '2',
        name: 'Card Component',
        description: 'Versatile card with image, title, and actions',
        category: 'Cards',
        code: {
          react: `<div className="card">\n  <img src={image} alt={title} className="card-image" />\n  <div className="card-content">\n    <h3>{title}</h3>\n    <p>{description}</p>\n  </div>\n  <div className="card-actions">\n    {actions}\n  </div>\n</div>`,
          css: `.card {\n , background: white;\n  border-radius: 12px;\n  box-shadow: 0 2px 8px rgba(0,0,0,0.1);\n  overflow: hidden;\n , transition: transform 0.3s;\n}\n\n.card: hover {\n , transform: translateY(-4px);\n  box-shadow: 0 4px 16px rgba(0,0,0,0.15);\n}\n\n.card-image {\n  width: 100%;\n , height: 200px;\n  object-fit: cover;\n}\n\n.card-content {\n  padding: 16px;\n}\n\n.card-actions {\n  padding: 16px;\n  border-top: 1px solid #eee;\n}`,
        },
        tags: ['card', 'container','image'],
        favorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        props: { image: 'string', title: 'string', description: 'string', actions: 'node' },
      },
      {
        id: '3',
        name: 'Input Field',
        description: 'Styled input with label and validation',
        category: 'Forms',
        code: {
          react: `<div className="input-field">\n  <label htmlFor={id}>{label}</label>\n  <input\n    id={id}\n    type={type}\n    value={value}\n    onChange={onChange}\n    placeholder={placeholder}\n    className={error ? 'error' : ', '}\n  />\n  {error && <span className="error-message">{error}</span>}\n</div>`,
          css: `.input-field {\n  margin-bottom: 16px;\n}\n\n.input-field label {\n  display: block;\n  font-weight: 600;\n  margin-bottom: 8px;\n , color: #333;\n}\n\n.input-field input {\n  width: 100%;\n  padding: 12px;\n  border: 2px solid #e0e0e0;\n  border-radius: 6px;\n  font-size: 14px;\n , transition: border-color 0.3s;\n}\n\n.input-field input: focus {\n , outline: none;\n  border-color: #007ACC;\n}\n\n.input-field input.error {\n  border-color: #f44336;\n}\n\n.error-message {\n  color: #f44336;\n  font-size: 12px;\n  margin-top: 4px;\n , display: block;\n}`,
        },
        tags: ['input', 'form','validation'],
        favorite: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        props: {
          id: 'string',
          label: 'string',
          type: 'string',
          value: 'string',
          onChange: 'function',
          placeholder: 'string',
          error: 'string',
        },
      },
    ];
  };

  const filteredComponents = components.filter((comp) => {
    const matchesSearch =
      comp.name.toLowerCase().includes(searchQuery.toLowerCase() ||
      comp.description.toLowerCase().includes(searchQuery.toLowerCase() ||
      comp.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase();

    const matchesCategory = selectedCategory === 'All' || comp.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...Array.from(new Set(components.map((c) => c.category)))];

  const handleSaveComponent = () => {
    if (!newComponent.name) return;

    const component: Component = {
      id: Date.now().toString(),
      name: newComponent.name,
      description: newComponent.description || ', ',
      category: newComponent.category || 'Custom',
      code: newComponent.code || { react: ', ', css: ', ' },
      tags: newComponent.tags || [],
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveComponents([...components, component]);
    setShowSaveDialog(false);
    setNewComponent({
      name: ', ',
      description: ', ',
      category: 'Custom',
      tags: [],
    });
  };

  const handleDeleteComponent = (id: string) => {
    saveComponents(components.filter((c) => c.id !== id));
    setAnchorEl(null);
  };

  const handleToggleFavorite = (id: string) => {
    saveComponents(components.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c)));
  };

  const handleDuplicateComponent = (component: Component) => {
    const duplicate: Component = {
      ...component,
      id: Date.now().toString(),
      name: `${component.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveComponents([...components, duplicate]);
    setAnchorEl(null);
  };

  const handleExportComponent = (component: Component) => {
    const blob = new Blob([JSON.stringify(component, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${component.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    link.click();
    setAnchorEl(null);
  };

  const handleUseComponent = (component: Component) => {
    if (onUseComponent) {
      onUseComponent(component);
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: '100%', sm: 500, md: 600 } } }}

      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              bgcolor: '#f5f5f5',
              borderBottom: '1px solid #e0e0e0'}}>
            <Box display="flex" alignItems="center" gap={1}>
              <Folder color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600}}>
                Component Library
              </Typography>
              <Chip label={components.length} size="small" color="primary" />
            </Box>
            <Box>
              <Button
                startIcon={<Add />}
                variant="contained"
                size="small"
                onClick={() => setShowSaveDialog(true)}
                sx={{ mr: 1 }}>
                New
              </Button>
              <IconButton onClick={onClose}>
                <Close />
              </IconButton>
            </Box>
          </Box>

          {/* Search */}
          <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )}} />
          </Box>

          {/* Category Tabs */}
          <Tabs
            value={selectedCategory}
            onChange={(_, newValue) => setSelectedCategory(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
            {categories.map((category) => (
              <Tab key={category} label={category} value={category} />
            ))}
          </Tabs>

          {/* Components Grid */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {filteredComponents.length === 0 ? (
              <Alert severity="info">No components found. Create your first component!</Alert>
            ) : (
              <Grid container spacing={2}>
                {filteredComponents.map((component) => (
                  <Grid item xs={12} sm={viewMode === 'grid' ? 6 : 12} key={component.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box
                          display="flex"
                          alignItems="flex-start"
                          justifyContent="space-between"
                          mb={1}
                        >
                          <Box flex={1}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {component.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {component.description}
                            </Typography>
                          </Box>
                          <Box>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleFavorite(component.id)}
                            >
                              {component.favorite ? (
                                <Star sx={{ color: '#ffa726' } fontSize="small" />
                              ) : (
                                <StarBorder fontSize="small" />
                              )}
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) =>
                                setAnchorEl({ element: e.currentTarget, componentId: component.id })
                              }}
                            >
                              <MoreVert fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 0.5 flexWrap: 'wrap', mb: 1 }}>
                          <Chip
                            label={component.category}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          {component.tags.slice(0, 3).map((tag) => (
                            <Chip key={tag} label={tag} size="small" variant="outlined" />
                          ))}
                        </Box>

                        {component.code.react && (
                          <Box
                            sx={{
                              bgcolor: '#f5f5f5',
                              p: 1,
                              borderRadius: 1,
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              maxHeight: 100,
                              overflow: 'hidden',
                              position: 'relative'}}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                              {component.code.react.slice(0, 150)}
                              {component.code.react.length > 150 &&'...'}
                            </pre>
                          </Box>
                        )}
                      </CardContent>
                      <CardActions>
                        <Button
                          size="small"
                          startIcon={<Add />}
                          onClick={() => handleUseComponent(component)}
                          fullWidth
                          variant="contained"
                        >
                          Use Component
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Box>
      </Drawer>

      {/* Context Menu */}
      <Menu anchorEl={anchorEl?.element} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem
          onClick={() => {
            const comp = components.find((c) => c.id === anchorEl?.componentId);
            if (comp) handleDuplicateComponent(comp);
          }}
        >
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const comp = components.find((c) => c.id === anchorEl?.componentId);
            if (comp) handleExportComponent(comp);
          }}
        >
          <ListItemIcon>
            <Download fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => anchorEl && handleDeleteComponent(anchorEl.componentId)}>
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Save Component Dialog */}
      <Dialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Save New Component</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Component Name"
            fullWidth
            value={newComponent.name}
            onChange={(e) => setNewComponent({ ...newComponent, name: e.target.value })}}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={newComponent.description}
            onChange={(e) => setNewComponent({ ...newComponent, description: e.target.value })}}
          />
          <TextField
            margin="dense"
            label="Category"
            fullWidth
            select
            value={newComponent.category}
            onChange={(e) => setNewComponent({ ...newComponent, category: e.target.value as 'Buttons' | 'Forms' | 'Cards' | 'Navigation' | 'Layout' | 'Custom' })}
          >
            <MenuItem value="Buttons">Buttons</MenuItem>
            <MenuItem value="Forms">Forms</MenuItem>
            <MenuItem value="Cards">Cards</MenuItem>
            <MenuItem value="Navigation">Navigation</MenuItem>
            <MenuItem value="Layout">Layout</MenuItem>
            <MenuItem value="Custom">Custom</MenuItem>
          </TextField>
          <TextField
            margin="dense"
            label="Tags (comma-separated)"
            fullWidth
            placeholder="button, primary, interactive"
            onChange={(e) =>
              setNewComponent({
                ...newComponent,
                tags: e.target.value
                  .split('')
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveComponent} variant="contained" disabled={!newComponent.name}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
