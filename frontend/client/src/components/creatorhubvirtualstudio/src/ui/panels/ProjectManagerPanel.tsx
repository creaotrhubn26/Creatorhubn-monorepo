/**
 * ProjectManagerPanel - Save, Load, and Manage Virtual Studio Projects
 * Connected to Google Drive for cloud storage
 */

import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('ProjectManager, ');
import {
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Tooltip,
  Paper,
  Divider,
  Menu,
  MenuItem,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  LinearProgress,
  Snackbar,
  Badge,
} from '@mui/material';
import {
  Save,
  FolderOpen,
  CreateNewFolder,
  Delete,
  Edit,
  ContentCopy,
  CloudUpload,
  CloudDone,
  CloudOff,
  History,
  Search,
  MoreVert,
  Star,
  StarBorder,
  Schedule,
  Visibility,
  Share,
  Download,
  Refresh,
  Check,
  Close,
  AutoAwesome,
  SyncAlt,
  Folder,
  InsertDriveFile,
} from '@mui/icons-material';
import { useAppStore, SceneNode } from '../../state/store';
import { virtualStudioApi, preferencesApi } from '../../core/api/virtualStudioApi';
import { useVirtualStudio } from '../../../VirtualStudioContext';

// ============================================================================
// Types
// ============================================================================

export interface VirtualStudioProject {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  
  // Scene Data
  sceneData: {
    nodes: SceneNode[];
    cameraState?: any;
    environmentState?: any;
  };
  
  // Animation Data
  animationData?: {
    tracks: any[];
    clips: any[];
  };
  
  // Settings
  settings?: {
    renderQuality?: string;
    resolution?: string;
    colorGrading?: any;
  };
  
  // Metadata
  projectType?: 'photography' | 'videography' | 'commercial' | 'wedding' | 'event' | 'product';
  tags?: string[];
  
  // Google Drive
  googleDriveFolderId?: string;
  googleDriveFileId?: string;
  googleDriveUrl?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  
  // Stats
  nodeCount?: number;
  lightCount?: number;
  version?: number;
  
  // Status
  isFavorite?: boolean;
  isAutoSaved?: boolean;
}

interface ProjectManagerPanelProps {
  onProjectLoad?: (project: VirtualStudioProject) => void;
  onProjectSave?: (project: VirtualStudioProject) => void;
  currentProject?: VirtualStudioProject | null;
  googleDriveConnected?: boolean;
  userId?: string;
}

// ============================================================================
// Auto-Save Indicator Component
// ============================================================================

export const AutoSaveIndicator: React.FC<{
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved?: Date;
}> = ({ status, lastSaved }) => {
  const getIcon = () => {
    switch (status) {
      case 'saving':
        return <CircularProgress size={16} />;
      case 'saved':
        return <CloudDone fontSize="small" color="success" />;
      case 'error':
        return <CloudOff fontSize="small" color="error" />;
      default:
        return <CloudUpload fontSize="small" color="disabled" />;
    }
  };

  const getText = () => {
    switch (status) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return lastSaved ? `Saved ${formatTimeAgo(lastSaved)}` : 'Saved';
      case 'error':
        return 'Save failed';
      default:
        return 'Not saved';
    }
  };

  return (
    <Tooltip title={getText()}>
      <Chip
        icon={getIcon()}
        label={getText()}
        size="small"
        variant="outlined"
        color={status === 'error' ? 'error' : status === 'saved' ? 'success' : 'default'}
        sx={{ height: 28 }}
      />
    </Tooltip>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}

function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Save Project Dialog
// ============================================================================

interface SaveProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, options: SaveOptions) => Promise<void>;
  currentProject?: VirtualStudioProject | null;
  isLoading?: boolean;
}

interface SaveOptions {
  uploadToDrive: boolean;
  projectType: string;
  tags: string[];
}

export const SaveProjectDialog: React.FC<SaveProjectDialogProps> = ({
  open,
  onClose,
  onSave,
  currentProject,
  isLoading,
}) => {
  const [name, setName] = useState(currentProject?.name || ', ');
  const [description, setDescription] = useState(currentProject?.description || '');
  const [projectType, setProjectType] = useState(currentProject?.projectType || 'photography');
  const [tags, setTags] = useState<string[]>(currentProject?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [uploadToDrive, setUploadToDrive] = useState(true);

  useEffect(() => {
    if (open) {
      setName(currentProject?.name || `Project ${new Date().toLocaleDateString()}`);
      setDescription(currentProject?.description || '');
      setProjectType(currentProject?.projectType || 'photography');
      setTags(currentProject?.tags || []);
    }
  }, [open, currentProject]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSave(name.trim(), description, { uploadToDrive, projectType, tags });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Save />
          <Typography variant="h6">
            {currentProject ? 'Save Project' : 'Save New Project'}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            autoFocus
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />

          <FormControl fullWidth>
            <InputLabel>Project Type</InputLabel>
            <Select
              value={projectType}
              label="Project Type"
              onChange={(e) => setProjectType(e.target.value)}
            >
              <MenuItem value="photography">Photography</MenuItem>
              <MenuItem value="videography">Videography</MenuItem>
              <MenuItem value="commercial">Commercial</MenuItem>
              <MenuItem value="wedding">Wedding</MenuItem>
              <MenuItem value="event">Event</MenuItem>
              <MenuItem value="product">Product</MenuItem>
            </Select>
          </FormControl>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Tags
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onDelete={() => handleRemoveTag(tag)}
                />
              ))}
            </Stack>
            <TextField
              size="small"
              placeholder="Add tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={handleAddTag}>
                      <Check fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )}}
            />
          </Box>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1}>
                <CloudUpload color={uploadToDrive ? 'primary' : 'disabled'} />
                <Box>
                  <Typography variant="body2">Upload to Google Drive</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Sync project to cloud storage
                  </Typography>
                </Box>
              </Stack>
              <Chip
                label={uploadToDrive ? 'Enabled' : 'Disabled'}
                color={uploadToDrive ? 'primary' : 'default'}
                size="small"
                onClick={() => setUploadToDrive(!uploadToDrive)}
              />
            </Stack>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!name.trim() || isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : <Save />}
        >
          {isLoading ? 'Saving...' : 'Save Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// Load Project Dialog
// ============================================================================

interface LoadProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onLoad: (project: VirtualStudioProject) => void;
  projects: VirtualStudioProject[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onDelete?: (projectId: string) => Promise<void>;
  onToggleFavorite?: (projectId: string) => void;
}

export const LoadProjectDialog: React.FC<LoadProjectDialogProps> = ({
  open,
  onClose,
  onLoad,
  projects,
  isLoading,
  onRefresh,
  onDelete,
  onToggleFavorite,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    project: VirtualStudioProject;
  } | null>(null);

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'all' || p.projectType === filterType;
    return matchesSearch && matchesType;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    // Favorites first
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    // Then by last opened
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleContextMenu = (event: React.MouseEvent, project: VirtualStudioProject) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      project,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <FolderOpen />
            <Typography variant="h6">Open Project</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <IconButton size="small" onClick={onRefresh} disabled={isLoading}>
              <Refresh />
            </IconButton>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent>
        {/* Search and Filters */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              )}}
            sx={{ flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              displayEmpty
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="photography">Photography</MenuItem>
              <MenuItem value="videography">Videography</MenuItem>
              <MenuItem value="commercial">Commercial</MenuItem>
              <MenuItem value="wedding">Wedding</MenuItem>
              <MenuItem value="product">Product</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : sortedProjects.length === 0 ? (
          <Alert severity="info" sx={{ my: 2 }}>
            {searchQuery || filterType !== 'all'
              ? 'No projects match your search criteria'
              : 'No saved projects yet. Save your current scene to get started!'}
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {sortedProjects.map((project) => (
              <Grid item xs={12} sm={6} md={4} key={project.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 4,
                    },
                    border: project.isFavorite ? '2px solid' : undefined,
                    borderColor: project.isFavorite ? 'warning.main' : undefined}}
                  onClick={() => onLoad(project)}
                  onContextMenu={(e) => handleContextMenu(e, project)}
                >
                  <CardMedia
                    sx={{
                      height: 120,
                      bgcolor: 'grey.800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'}}
                  >
                    {project.thumbnailUrl ? (
                      <img
                        src={project.thumbnailUrl}
                        alt={project.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Folder sx={{ fontSize: 48, color: 'grey.600' }} />
                    )}
                  </CardMedia>
                  <CardContent sx={{ pb: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
                        {project.name}
                      </Typography>
                      {project.isFavorite && <Star fontSize="small" color="warning" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {formatTimeAgo(new Date(project.updatedAt))}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                      {project.projectType && (
                        <Chip label={project.projectType} size="small" variant="outlined" />
                      )}
                      {project.googleDriveFileId && (
                        <Chip
                          icon={<CloudDone fontSize="small" />}
                          label="Synced"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Context Menu */}
        <Menu
          open={contextMenu !== null}
          onClose={handleCloseContextMenu}
          anchorReference="anchorPosition"
          anchorPosition={
            contextMenu !== null
              ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
              : undefined
          }
        >
          <MenuItem
            onClick={() => {
              onLoad(contextMenu!.project);
              handleCloseContextMenu();
            }}
          >
            <ListItemIcon>
              <FolderOpen fontSize="small" />
            </ListItemIcon>
            Open
          </MenuItem>
          <MenuItem
            onClick={() => {
              onToggleFavorite?.(contextMenu!.project.id);
              handleCloseContextMenu();
            }}
          >
            <ListItemIcon>
              {contextMenu?.project.isFavorite ? (
                <StarBorder fontSize="small" />
              ) : (
                <Star fontSize="small" />
              )}
            </ListItemIcon>
            {contextMenu?.project.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              onDelete?.(contextMenu!.project.id);
              handleCloseContextMenu();
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <Delete fontSize="small" color="error" />
            </ListItemIcon>
            Delete
          </MenuItem>
        </Menu>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// Recent Projects Dropdown
// ============================================================================

interface RecentProjectsDropdownProps {
  projects: VirtualStudioProject[];
  onSelect: (project: VirtualStudioProject) => void;
  onViewAll: () => void;
}

export const RecentProjectsDropdown: React.FC<RecentProjectsDropdownProps> = ({
  projects,
  onSelect,
  onViewAll,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const recentProjects = projects.slice(0, 5);

  return (
    <>
      <Tooltip title="Recent Projects">
        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
          <Badge badgeContent={recentProjects.length} color="primary" max={9}>
            <History />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { width: 300 } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">Recent Projects</Typography>
        </Box>
        <Divider />
        {recentProjects.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No recent projects
            </Typography>
          </MenuItem>
        ) : (
          recentProjects.map((project) => (
            <MenuItem
              key={project.id}
              onClick={() => {
                onSelect(project);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                {project.googleDriveFileId ? (
                  <CloudDone fontSize="small" color="success" />
                ) : (
                  <InsertDriveFile fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={project.name}
                secondary={formatTimeAgo(new Date(project.updatedAt))}
                primaryTypographyProps={{ noWrap: true }}
              />
            </MenuItem>
          ))
        )}
        <Divider />
        <MenuItem onClick={onViewAll}>
          <ListItemIcon>
            <FolderOpen fontSize="small" />
          </ListItemIcon>
          View All Projects
        </MenuItem>
      </Menu>
    </>
  );
};

// ============================================================================
// Main Project Manager Panel
// ============================================================================

export const ProjectManagerPanel: React.FC<ProjectManagerPanelProps> = ({
  onProjectLoad,
  onProjectSave,
  currentProject: initialProject,
  googleDriveConnected = true,
  userId,
}) => {
  // Toast notifications
  const { addToast } = useVirtualStudio();

  // State
  const [projects, setProjects] = useState<VirtualStudioProject[]>([]);
  const [currentProject, setCurrentProject] = useState<VirtualStudioProject | null>(
    initialProject || null
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle'
  );
  const [lastSaved, setLastSaved] = useState<Date | undefined>();
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: ', ', severity: 'info' });

  // Get scene state from store
  const nodes = useAppStore((state) => state.nodes);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (!currentProject) return;

    const autoSaveInterval = setInterval(() => {
      handleAutoSave();
    }, 60000); // Auto-save every 60 seconds

    return () => clearInterval(autoSaveInterval);
  }, [currentProject, nodes]);

  // Load projects from API/localStorage
  const loadProjects = async () => {
    setIsLoading(true);
    try {
      // Try API first
      const response = await fetch('/api/virtual-studio/projects', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      } else {
        // Fallback to localStorage
        const saved = localStorage.getItem('virtualStudio_projects');
        if (saved) {
          setProjects(JSON.parse(saved));
        }
      }

      // Load recent from preferences
      const prefs = await preferencesApi.get();
      if (prefs?.recentProjects) {
        // Merge recent project info
      }
    } catch (error) {
      log.warn('Failed to load projects from API, using localStorage');
      const saved = localStorage.getItem('virtualStudio_projects');
      if (saved) {
        setProjects(JSON.parse(saved));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Save project
  const handleSave = async (
    name: string,
    description: string,
    options: SaveOptions
  ) => {
    setIsSaving(true);
    setAutoSaveStatus('saving');

    try {
      const projectData: VirtualStudioProject = {
        id: currentProject?.id || generateProjectId(),
        name,
        description,
        projectType: options.projectType as any,
        tags: options.tags,
        sceneData: {
          nodes: nodes,
          cameraState: null, // Get from camera panel
          environmentState: null, // Get from HDRI panel
        },
        nodeCount: nodes.length,
        lightCount: nodes.filter((n) => n.type === 'light').length,
        version: (currentProject?.version || 0) + 1,
        createdAt: currentProject?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to API
      const response = await fetch('/api/virtual-studio/projects', {
        method: currentProject ? 'PUT' : 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify(projectData),
      });

      if (response.ok) {
        const saved = await response.json();
        projectData.id = saved.project?.id || projectData.id;

        // Upload to Google Drive if enabled
        if (options.uploadToDrive && googleDriveConnected) {
          await uploadToGoogleDrive(projectData);
        }
      }

      // Also save to localStorage as backup
      const updatedProjects = currentProject
        ? projects.map((p) => (p.id === projectData.id ? projectData : p))
        : [...projects, projectData];
      setProjects(updatedProjects);
      localStorage.setItem('virtualStudio_projects', JSON.stringify(updatedProjects));

      setCurrentProject(projectData);
      setAutoSaveStatus('saved');
      setLastSaved(new Date());
      setSaveDialogOpen(false);

      setSnackbar({
        open: true,
        message: `Project "${name}" saved successfully!`,
        severity: 'success',
      });
      addToast({
        message: `Project "${name}" saved`,
        type: 'success',
        duration: 3000,
      });

      onProjectSave?.(projectData);
    } catch (error) {
      log.error('Failed to save project: ', error);
      setAutoSaveStatus('error');
      setSnackbar({
        open: true,
        message: 'Failed to save project. Please try again.',
        severity: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Upload to Google Drive
  const uploadToGoogleDrive = async (project: VirtualStudioProject) => {
    try {
      const response = await fetch('/api/google-drive/upload-project', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: project.id,
          projectName: project.name,
          projectData: project,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        project.googleDriveFileId = result.fileId;
        project.googleDriveUrl = result.webViewLink;
      }
    } catch (error) {
      log.warn('Failed to upload to Google Drive:', error);
    }
  };

  // Auto-save
  const handleAutoSave = useCallback(async () => {
    if (!currentProject) return;

    setAutoSaveStatus('saving');
    try {
      const projectData = {
        ...currentProject,
        sceneData: { nodes },
        updatedAt: new Date().toISOString(),
        isAutoSaved: true,
      };

      // Save to localStorage
      const updatedProjects = projects.map((p) =>
        p.id === projectData.id ? projectData : p
      );
      localStorage.setItem('virtualStudio_projects', JSON.stringify(updatedProjects));

      setAutoSaveStatus('saved');
      setLastSaved(new Date());
    } catch (error) {
      setAutoSaveStatus('error');
    }
  }, [currentProject, nodes, projects]);

  // Load project
  const handleLoad = async (project: VirtualStudioProject) => {
    setIsLoading(true);
    try {
      // If project is on Google Drive, fetch latest version
      if (project.googleDriveFileId) {
        const response = await fetch(
          `/api/google-drive/download-project/${project.googleDriveFileId}`,
          { credentials: 'include' }
        );
        if (response.ok) {
          const driveProject = await response.json();
          project = { ...project, ...driveProject };
        }
      }

      setCurrentProject(project);
      setLoadDialogOpen(false);

      // Update last opened
      project.lastOpenedAt = new Date().toISOString();

      // Add to recent projects
      await preferencesApi.addRecent('projects', { id: project.id, name: project.name });

      setSnackbar({
        open: true,
        message: `Loaded "${project.name}"`,
        severity: 'success',
      });
      addToast({
        message: `Loaded "${project.name}"`,
        type: 'success',
        duration: 3000,
      });

      onProjectLoad?.(project);
    } catch (error) {
      log.error('Failed to load project:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load project. Please try again.',
        severity: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete project
  const handleDelete = async (projectId: string) => {
    try {
      // Delete from API
      await fetch(`/api/virtual-studio/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      // Delete from localStorage
      const updatedProjects = projects.filter((p) => p.id !== projectId);
      setProjects(updatedProjects);
      localStorage.setItem('virtualStudio_projects', JSON.stringify(updatedProjects));

      if (currentProject?.id === projectId) {
        setCurrentProject(null);
      }

      setSnackbar({
        open: true,
        message: 'Project deleted',
        severity: 'info',
      });
      addToast({
        message: 'Project deleted',
        type: 'info',
        duration: 2000,
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to delete project',
        severity:'error',
      });
    }
  };

  // Toggle favorite
  const handleToggleFavorite = (projectId: string) => {
    const updatedProjects = projects.map((p) =>
      p.id === projectId ? { ...p, isFavorite: !p.isFavorite } : p
    );
    setProjects(updatedProjects);
    localStorage.setItem('virtualStudio_projects', JSON.stringify(updatedProjects));
  };

  return (
    <Box>
      {/* Toolbar */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Tooltip title="Save Project (Ctrl+S)">
          <Button
            variant="contained"
            size="small"
            startIcon={<Save />}
            onClick={() => setSaveDialogOpen(true)}
          >
            Save
          </Button>
        </Tooltip>

        <Tooltip title="Open Project (Ctrl+O)">
          <Button
            variant="outlined"
            size="small"
            startIcon={<FolderOpen />}
            onClick={() => setLoadDialogOpen(true)}
          >
            Open
          </Button>
        </Tooltip>

        <RecentProjectsDropdown
          projects={projects}
          onSelect={handleLoad}
          onViewAll={() => setLoadDialogOpen(true)}
        />

        <Box sx={{ flex: 1 }} />

        <AutoSaveIndicator status={autoSaveStatus} lastSaved={lastSaved} />

        {googleDriveConnected ? (
          <Tooltip title="Connected to Google Drive">
            <CloudDone color="success" fontSize="small" />
          </Tooltip>
        ) : (
          <Tooltip title="Not connected to Google Drive">
            <CloudOff color="disabled" fontSize="small" />
          </Tooltip>
        )}
      </Stack>

      {/* Current Project Info */}
      {currentProject && (
        <Paper variant="outlined" sx={{ mt: 2, p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <InsertDriveFile fontSize="small" color="primary" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2">{currentProject.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {currentProject.nodeCount} objects • Version {currentProject.version}
              </Typography>
            </Box>
            {currentProject.googleDriveFileId && (
              <Chip
                size="small"
                icon={<CloudDone fontSize="small" />}
                label="Synced"
                color="success"
                variant="outlined"
              />
            )}
          </Stack>
        </Paper>
      )}

      {/* Dialogs */}
      <SaveProjectDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSave}
        currentProject={currentProject}
        isLoading={isSaving}
      />

      <LoadProjectDialog
        open={loadDialogOpen}
        onClose={() => setLoadDialogOpen(false)}
        onLoad={handleLoad}
        projects={projects}
        isLoading={isLoading}
        onRefresh={loadProjects}
        onDelete={handleDelete}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ProjectManagerPanel;

