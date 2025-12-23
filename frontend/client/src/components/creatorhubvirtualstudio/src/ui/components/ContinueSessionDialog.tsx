/**
 * Continue Session Dialog
 * 
 * Shown when user returns to Virtual Studio.
 * Provides options to:
 * - Continue where they left off (unsaved session)
 * - Open a previous saved project
 * - Start a new project
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  Stack,
  Divider,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  ListItemAvatar,
  ListItemSecondaryAction,
  IconButton,
  Card,
  CardContent,
  CardActionArea,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  Tooltip,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  PlayArrow,
  Add,
  History,
  Close,
  Lightbulb,
  CameraAlt,
  Person,
  Landscape,
  Image,
  Layers,
  Movie,
  Schedule,
  Edit,
  School,
  Groups,
  Settings,
  PhotoLibrary,
  Timeline,
  Extension,
  FolderOpen,
  Search,
  Star,
  StarBorder,
  MoreVert,
  Delete,
  ContentCopy,
  CloudDone,
  CloudOff,
  Videocam,
  Work,
  EventNote,
} from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';
import { logger } from '../../core/services/logger';

const log = logger.module('ContinueSession, ');

// =============================================================================
// Types
// =============================================================================

export interface SessionSummary {
  id: string;
  name: string;
  lastModified: Date;
  duration: number; // minutes spent
  thumbnail?: string;
  
  // Scene stats
  lightCount: number;
  cameraCount: number;
  actorCount: number;
  propCount: number;
  
  // Feature usage
  hdriName?: string;
  lightingPreset?: string;
  backdropName?: string;
  
  // Project type
  projectType?: string;
  specialization?: string;
  
  // Activity summary
  activities: SessionActivity[];
  
  // Unsaved changes
  hasUnsavedChanges: boolean;
  
  // Class photo specific
  classPhotoSession?: {
    studentCount: number;
    rowCount: number;
    ageGroup: string;
  };
  
  // Storyboard
  storyboardFrameCount?: number;
  
  // Animation
  animationClipCount?: number;
}

export interface SessionActivity {
  type: 'light_added' | 'camera_moved' | 'actor_added' | 'prop_placed' | 'hdri_changed' | 
        'render_started' | 'preset_applied' | 'storyboard_frame' | 'animation_keyframe' |
        'class_photo_setup' | 'export_created';
  description: string;
  timestamp: Date;
  icon?: React.ReactNode;
}

export interface SavedProject {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  projectType: 'photography' | 'videography' | 'commercial' | 'wedding' | 'event' | 'product';
  specialization?: string;
  status: 'draft' | 'active' | 'review' | 'completed' | 'archived';
  
  // Stats
  sceneCount: number;
  renderCount: number;
  exportCount: number;
  
  // Dates
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt?: Date;
  
  // Sync status
  isSynced: boolean;
  googleDriveFolderId?: string;
  
  // Favorites
  isFavorite?: boolean;
}

interface Props {
  open: boolean;
  session: SessionSummary | null;
  previousProjects: SavedProject[];
  onContinue: () => void;
  onStartNew: () => void;
  onOpenProject: (project: SavedProject) => void;
  onDeleteProject?: (project: SavedProject) => void;
  onDuplicateProject?: (project: SavedProject) => void;
  onToggleFavorite?: (project: SavedProject) => void;
  onClose: () => void;
  isLoading?: boolean;
  isLoadingProjects?: boolean;
}

// =============================================================================
// Activity Icons
// =============================================================================

const getActivityIcon = (type: SessionActivity['type']): React.ReactNode => {
  switch (type) {
    case 'light_added': return <Lightbulb fontSize="small" />;
    case 'camera_moved': return <CameraAlt fontSize="small" />;
    case 'actor_added': return <Person fontSize="small" />;
    case 'prop_placed': return <Extension fontSize="small" />;
    case 'hdri_changed': return <Landscape fontSize="small" />;
    case 'render_started': return <Image fontSize="small" />;
    case 'preset_applied': return <Settings fontSize="small" />;
    case 'storyboard_frame': return <PhotoLibrary fontSize="small" />;
    case 'animation_keyframe': return <Timeline fontSize="small" />;
    case 'class_photo_setup': return <Groups fontSize="small" />;
    case 'export_created': return <Movie fontSize="small" />;
    default: return <Edit fontSize="small" />;
  }
};

const getProjectTypeIcon = (type: string): React.ReactNode => {
  switch (type) {
    case 'photography': return <CameraAlt />;
    case 'videography': return <Videocam />;
    case 'commercial': return <Work />;
    case 'wedding': return <EventNote />;
    case 'event': return <Groups />;
    case 'product': return <Layers />;
    default: return <CameraAlt />;
  }
};

const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
  switch (status) {
    case 'active': return 'primary';
    case 'review': return 'warning';
    case 'completed': return 'success';
    case 'archived': return 'default';
    default: return 'default';
  }
};

// =============================================================================
// Component
// =============================================================================

export function ContinueSessionDialog({ 
  open, 
  session, 
  previousProjects,
  onContinue, 
  onStartNew,
  onOpenProject,
  onDeleteProject,
  onDuplicateProject,
  onToggleFavorite,
  onClose,
  isLoading = false,
  isLoadingProjects = false,
}: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectMenuAnchor, setProjectMenuAnchor] = useState<{ el: HTMLElement; project: SavedProject } | null>(null);

  // Reset tab when dialog opens
  useEffect(() => {
    if (open) {
      setActiveTab(session ? 0 : 1);
      setSearchQuery(', ');
    }
  }, [open, session]);

  // Get specialization icon
  const getSpecializationIcon = () => {
    if (session?.specialization === 'school_photography') return <School />;
    if (session?.projectType === 'videography') return <Movie />;
    return <CameraAlt />;
  };

  // Format duration
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Filter projects
  const filteredProjects = previousProjects.filter(project => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.name.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query) ||
      project.projectType.toLowerCase().includes(query) ||
      project.specialization?.toLowerCase().includes(query)
    );
  });

  // Sort projects: favorites first, then by last opened/updated
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    const aDate = a.lastOpenedAt || a.updatedAt;
    const bDate = b.lastOpenedAt || b.updatedAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  // Get visible activities
  const visibleActivities = showAllActivities 
    ? session?.activities 
    : session?.activities?.slice(0, 5);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { 
          bgcolor: '#1a1a1a', 
          color: '#fff',
          minHeight: 600,
          maxHeight: '90vh',
        }}}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 1 }}>
        <History color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">Welcome Back!</Typography>
          <Typography variant="body2" color="text.secondary">
            Continue your work or start something new
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'grey.500' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            '& .MuiTab-root': { color: 'grey.500' }, '& .Mui-selected': { color: 'primary.main' }}}
        >
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <PlayArrow fontSize="small" />
                <span>Current Session</span>
                {session?.hasUnsavedChanges && (
                  <Chip label="Unsaved" size="small" color="warning" sx={{ height: 20 }} />
                )}
              </Stack>
            } 
            disabled={!session}
          />
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <FolderOpen fontSize="small" />
                <span>My Projects</span>
                <Chip label={previousProjects.length} size="small" sx={{ height: 20 }} />
              </Stack>
            } 
          />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 0 }}>
        {/* Tab 0: Current Session */}
        {activeTab === 0 && session && (
          <Box sx={{ p: 3 }}>
            {isLoading ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <LinearProgress sx={{ mb: 2 }} />
                <Typography color="text.secondary">Loading your previous session...</Typography>
              </Box>
            ) : (
              <Grid container spacing={3}>
                {/* Session Overview Card */}
                <Grid item xs={12}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'rgba(255,255,255,0.05)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 2}}
                  >
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      {/* Thumbnail */}
                      <Box
                        sx={{
                          width: 120,
                          height: 80,
                          bgcolor: 'rgba(255,255,255,0.1)',
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden'}}
                      >
                        {session.thumbnail ? (
                          <img 
                            src={session.thumbnail} 
                            alt="Session thumbnail" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        ) : (
                          <Layers sx={{ fontSize: 40, color: 'grey.600' }} />
                        )}
                      </Box>

                      {/* Session Info */}
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          {getSpecializationIcon()}
                          <Typography variant="h6">{session.name || 'Untitled Project'}</Typography>
                          {session.hasUnsavedChanges && (
                            <Chip label="Unsaved changes" size="small" color="warning" />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Last edited {formatDistanceToNow(session.lastModified, { addSuffix: true })}
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                          <Chip 
                            icon={<Schedule sx={{ fontSize: 16 }} />} 
                            label={formatDuration(session.duration)} 
                            size="small" 
                            variant="outlined" 
                          />
                          {session.specialization && (
                            <Chip 
                              label={session.specialization.replace('_', ', ')} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </Box>

                      {/* Continue Button (prominent) */}
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<PlayArrow />}
                        onClick={onContinue}
                        sx={{ minWidth: 180 }}
                      >
                        Continue
                      </Button>
                    </Stack>
                  </Paper>
                </Grid>

                {/* Scene Stats */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Scene Overview
                  </Typography>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'rgba(255,255,255,0.03)', 
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 2}}
                  >
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                            <Lightbulb fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="h6">{session.lightCount}</Typography>
                            <Typography variant="caption" color="text.secondary">Lights</Typography>
                          </Box>
                        </Stack>
                      </Grid>
                      <Grid item xs={6}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                            <CameraAlt fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="h6">{session.cameraCount}</Typography>
                            <Typography variant="caption" color="text.secondary">Cameras</Typography>
                          </Box>
                        </Stack>
                      </Grid>
                      <Grid item xs={6}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'info.main' }}>
                            <Person fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="h6">{session.actorCount}</Typography>
                            <Typography variant="caption" color="text.secondary">Actors</Typography>
                          </Box>
                        </Stack>
                      </Grid>
                      <Grid item xs={6}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'warning.main' }}>
                            <Extension fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="h6">{session.propCount}</Typography>
                            <Typography variant="caption" color="text.secondary">Props</Typography>
                          </Box>
                        </Stack>
                      </Grid>
                    </Grid>

                    {/* Additional info */}
                    {(session.hdriName || session.lightingPreset || session.backdropName) && (
                      <>
                        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
                        <Stack spacing={1}>
                          {session.hdriName && (
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="caption" color="text.secondary">Environment</Typography>
                              <Typography variant="caption">{session.hdriName}</Typography>
                            </Stack>
                          )}
                          {session.lightingPreset && (
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="caption" color="text.secondary">Lighting Preset</Typography>
                              <Typography variant="caption">{session.lightingPreset}</Typography>
                            </Stack>
                          )}
                          {session.backdropName && (
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="caption" color="text.secondary">Backdrop</Typography>
                              <Typography variant="caption">{session.backdropName}</Typography>
                            </Stack>
                          )}
                        </Stack>
                      </>
                    )}

                    {/* Class Photo Session Info */}
                    {session.classPhotoSession && (
                      <>
                        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
                        <Alert severity="info" sx={{ bgcolor: 'rgba(33, 150, 243, 0.1)' }}>
                          <Typography variant="body2">
                            Class Photo: {session.classPhotoSession.studentCount} students in {session.classPhotoSession.rowCount} rows
                            ({session.classPhotoSession.ageGroup})
                          </Typography>
                        </Alert>
                      </>
                    )}
                  </Paper>
                </Grid>

                {/* Recent Activity */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Recent Activity
                  </Typography>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      bgcolor: 'rgba(255,255,255,0.03)', 
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 2,
                      maxHeight: 220,
                      overflow: 'auto'}}
                  >
                    {visibleActivities && visibleActivities.length > 0 ? (
                      <List dense disablePadding>
                        {visibleActivities.map((activity, index) => (
                          <ListItem 
                            key={index}
                            sx={{ 
                              borderBottom: index < visibleActivities.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'}}
                          >
                            <ListItemIcon sx={{ minWidth: 36, color: 'primary.main' }}>
                              {activity.icon || getActivityIcon(activity.type)}
                            </ListItemIcon>
                            <ListItemText
                              primary={activity.description}
                              secondary={formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                              primaryTypographyProps={{ variant: 'body2' }}
                              secondaryTypographyProps={{ variant: 'caption' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          No recent activity recorded
                        </Typography>
                      </Box>
                    )}

                    {session.activities && session.activities.length > 5 && !showAllActivities && (
                      <Box sx={{ p: 1, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <Button 
                          size="small" 
                          onClick={() => setShowAllActivities(true)}
                          sx={{ textTransform: 'none' }}
                        >
                          Show all {session.activities.length} activities
                        </Button>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            )}
          </Box>
        )}

        {/* Tab 1: Previous Projects */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            {/* Search */}
            <TextField
              fullWidth
              size="small"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: 'grey.500' }} />
                  </InputAdornment>
                )}}
              sx={{ 
                mb: 2, '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                }}}
            />

            {isLoadingProjects ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <LinearProgress sx={{ mb: 2 }} />
                <Typography color="text.secondary">Loading your projects...</Typography>
              </Box>
            ) : sortedProjects.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <FolderOpen sx={{ fontSize: 64, color: 'grey.600', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {searchQuery ? 'No projects found' : 'No saved projects yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchQuery 
                    ? 'Try a different search term' 
                    : 'Start a new project and save it to see it here'}
                </Typography>
                <Button variant="contained" startIcon={<Add />} onClick={onStartNew}>
                  Create New Project
                </Button>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {sortedProjects.map((project) => (
                  <Grid item xs={12} sm={6} md={4} key={project.id}>
                    <Card 
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)','&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: 'rgba(255,255,255,0.08)',
                        },
                        transition: 'all 0.2s'}}
                    >
                      <CardActionArea onClick={() => onOpenProject(project)}>
                        {/* Thumbnail */}
                        <Box
                          sx={{
                            height: 100,
                            bgcolor: 'rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden'}}
                        >
                          {project.thumbnail ? (
                            <img 
                              src={project.thumbnail} 
                              alt={project.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Box sx={{ color: 'grey.600' }}>
                              {getProjectTypeIcon(project.projectType)}
                            </Box>
                          )}
                          
                          {/* Favorite indicator */}
                          {project.isFavorite && (
                            <Star 
                              sx={{ 
                                position: 'absolute', 
                                top: 8, 
                                right: 8, 
                                color: 'warning.main',
                                fontSize: 20}} 
                            />
                          )}
                          
                          {/* Sync indicator */}
                          <Tooltip title={project.isSynced ? 'Synced to Google Drive' : 'Local only'}>
                            <Box sx={{ position: 'absolute', bottom: 8, right: 8 }}>
                              {project.isSynced ? (
                                <CloudDone sx={{ fontSize: 16, color: 'success.main' }} />
                              ) : (
                                <CloudOff sx={{ fontSize: 16, color: 'grey.500' }} />
                              )}
                            </Box>
                          </Tooltip>
                        </Box>

                        <CardContent sx={{ p: 1.5 }}>
                          <Typography variant="subtitle2" noWrap sx={{ mb: 0.5 }}>
                            {project.name}
                          </Typography>
                          
                          <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
                            <Chip 
                              label={project.projectType} 
                              size="small" 
                              sx={{ height: 20, fontSize: 10 }}
                            />
                            <Chip 
                              label={project.status} 
                              size="small" 
                              color={getStatusColor(project.status)}
                              sx={{ height: 20, fontSize: 10 }}
                            />
                          </Stack>
                          
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" color="text.secondary">
                              {format(new Date(project.updatedAt)'MMM d, yyyy')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {project.sceneCount} scene{project.sceneCount !== 1 ? 's' : ', '}
                            </Typography>
                          </Stack>
                        </CardContent>
                      </CardActionArea>
                      
                      {/* Action buttons */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'flex-end', 
                        gap: 0.5, 
                        p: 0.5,
                        borderTop: '1px solid rgba(255,255,255,0.05)'}}>
                        {onToggleFavorite && (
                          <Tooltip title={project.isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(project);
                              }}
                            >
                              {project.isFavorite ? (
                                <Star sx={{ fontSize: 18, color: 'warning.main' }} />
                              ) : (
                                <StarBorder sx={{ fontSize: 18 }} />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                        {onDuplicateProject && (
                          <Tooltip title="Duplicate project">
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateProject(project);
                              }}
                            >
                              <ContentCopy sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {onDeleteProject && (
                          <Tooltip title="Delete project">
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteProject(project);
                              }}
                              sx={{ '&:hover': { color: 'error.main' } }}
                            >
                              <Delete sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}
      </DialogContent>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button 
          onClick={onStartNew} 
          color="inherit"
          startIcon={<Add />}
          sx={{ textTransform: 'none' }}
        >
          Start New Project
        </Button>
        <Box sx={{ flex: 1 }} />
        {activeTab === 0 && session && (
          <Button
            variant="contained"
            onClick={onContinue}
            startIcon={<PlayArrow />}
            size="large"
            disabled={isLoading}
            sx={{ textTransform: 'none', px: 4 }}
          >
            Continue Where I Left Off
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default ContinueSessionDialog;
