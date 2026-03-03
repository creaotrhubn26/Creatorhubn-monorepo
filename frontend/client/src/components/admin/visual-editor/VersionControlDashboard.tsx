/**
 * VersionControlDashboard Component
 * Version control dashboard with change tracking and history
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
  Button,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Avatar,
  Divider,
  Alert,
  AlertTitle,
  Grid,
  Card,
  CardContent,
  CardActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Badge,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  History,
  ForkRight as BranchIcon,
  Commit as CommitIcon,
  Tag as TagIcon,
  Compare as DiffIcon,
  Undo as Rollback,
  Add,
  Edit,
  Delete,
  OpenWith as Move,
  ContentCopy as Copy,
  DriveFileRenameOutline as Rename,
  Merge,
  CallSplit as Split,
  CheckCircle,
  Error,
  Info,
  Warning,
  Settings,
  Refresh,
  Download,
  Upload,
  FilterList,
  Search,
  Sort,
  ViewList,
  ViewModule,
  ViewComfy,
  KeyboardArrowDown,
  KeyboardArrowUp,
  ExpandMore,
  ExpandLess,
  Flag,
  Public as Globe,
  Book,
  School,
  Work,
  Home,
  Person,
  Group,
  PublicOff,
  Public as PublicOn,
  Sync,
  SyncProblem,
  CloudOff,
  CloudDone,
  CloudSync,
  Backup,
  Restore,
  Queue,
  BarChart,
  PieChart,
  ShowChart,
} from '@mui/icons-material';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import { useVersionControl, UseVersionControlOptions } from '../../../hooks/useVersionControl';
import { VersionControlConfig, Version, Change, Branch, Commit, Tag, Diff } from '../../../utils/versionControlManager';

interface VersionControlDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showHistory?: boolean;
  showBranches?: boolean;
  showCommits?: boolean;
  showTags?: boolean;
  showDiffs?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onHistoryClick?: () => void;
  onBranchesClick?: () => void;
  onCommitsClick?: () => void;
  onTagsClick?: () => void;
  onDiffsClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const VersionControlDashboard: React.FC<VersionControlDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showHistory = true,
  showBranches = true,
  showCommits = true,
  showTags = true,
  showDiffs = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onHistoryClick,
  onBranchesClick,
  onCommitsClick,
  onTagsClick,
  onDiffsClick,
  className,
  style
}) => {
  const [showVersionControlDialog, setShowVersionControlDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showBranchesDialog, setShowBranchesDialog] = useState(false);
  const [showCommitsDialog, setShowCommitsDialog] = useState(false);
  const [showTagsDialog, setShowTagsDialog] = useState(false);
  const [showDiffsDialog, setShowDiffsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Version control options
  const versionControlOptions: UseVersionControlOptions = useMemo(() => ({
    onVersionCreated: (_data: { version: Version }) => {
      setFilterType('all');
      setPage(0);
  },
    onVersionUpdated: (_data: { version: Version }) => {
      setPage(0);
  },
    onVersionDeleted: (_data: { version: Version }) => {
      setPage(0);
  },
    onVersionRollback: (_data: { version: Version }) => {
      setPage(0);
  },
    onChangeTracked: (_data: { change: Change }) => {
      setFilterType('changes');
  },
    onChangesStaged: (_data: { changes: Change[] }) => {
      setActiveTab(0);
      setPage(0);
  },
    onChangesUnstaged: (_data: { changes: Change[] }) => {
      setActiveTab(0);
      setPage(0);
  },
    onCommitCreated: (_data: { commit: Commit }) => {
      setShowCommitsDialog(true);
      setPage(0);
  },
    onBranchCreated: (_data: { branch: Branch }) => {
      setShowBranchesDialog(true);
      setPage(0);
  },
    onBranchSwitched: (_data: { branch: Branch }) => {
      setPage(0);
  },
    onBranchMerged: (_data: { sourceBranch: Branch; targetBranch: Branch; strategy: string }) => {
      setPage(0);
  },
    onTagCreated: (_data: { tag: Tag }) => {
      setShowTagsDialog(true);
      setPage(0);
  },
    onDiffCreated: (_data: { diff: Diff }) => {
      setShowDiffsDialog(true);
      setPage(0);
  },
    onBackupCreated: (_data: { timestamp: number }) => {
      setPage(0);
  },
    onSyncCompleted: () => {
      setFilterType('all');
      setPage(0);
},
    onError: (error: string) => {
      console.error('Version control error:', error);
  },
    onInitialized: () => {
      setFilterType('all');
      setPage(0);
}
}), []);

  // Use version control hook
  const {
    createVersion,
    trackChange,
    stageChanges,
    unstageChanges,
    createCommit,
    createBranch,
    switchBranch,
    mergeBranch,
    createTag,
    createDiff,
    rollbackToVersion,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    currentVersion,
    currentBranch,
    currentCommit,
    versions,
    branches,
    commits,
    tags,
    diffs,
    stagedChanges,
    unstagedChanges,
    lastCommit,
    lastSync,
    totalVersions,
    totalBranches,
    totalCommits,
    totalTags,
    totalChanges,
    totalDiffs
} = useVersionControl(versionControlOptions);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
  } else {
      setShowSettingsDialog(true);
  }
}, [onSettingsClick]);

  // Handle history click
  const handleHistoryClick = useCallback(() => {
    if (onHistoryClick) {
      onHistoryClick();
  } else {
      setShowHistoryDialog(true);
  }
}, [onHistoryClick]);

  // Handle branches click
  const handleBranchesClick = useCallback(() => {
    if (onBranchesClick) {
      onBranchesClick();
  } else {
      setShowBranchesDialog(true);
  }
}, [onBranchesClick]);

  // Handle commits click
  const handleCommitsClick = useCallback(() => {
    if (onCommitsClick) {
      onCommitsClick();
  } else {
      setShowCommitsDialog(true);
  }
}, [onCommitsClick]);

  // Handle tags click
  const handleTagsClick = useCallback(() => {
    if (onTagsClick) {
      onTagsClick();
  } else {
      setShowTagsDialog(true);
  }
}, [onTagsClick]);

  // Handle diffs click
  const handleDiffsClick = useCallback(() => {
    if (onDiffsClick) {
      onDiffsClick();
  } else {
      setShowDiffsDialog(true);
  }
}, [onDiffsClick]);

  // Handle create version
  const handleCreateVersion = useCallback(() => {
    const data = { timestamp: Date.now() };
    const metadata = {
      name: `Version ${totalVersions + 1}`,
      description: 'New version',
      type: 'minor',
      userId: 'current_user'
};
    createVersion(data, metadata);
}, [createVersion, totalVersions]);

  // Handle create commit
  const handleCreateCommit = useCallback(() => {
    if (stagedChanges.length === 0) return;
    
    const message = `Commit ${totalCommits + 1}`;
    const description = 'New commit';
    const metadata = {
      author: 'current_user'
};
    createCommit(message, description, metadata);
}, [createCommit, stagedChanges.length, totalCommits]);

  // Handle create branch
  const handleCreateBranch = useCallback(() => {
    const name = `branch-${Date.now()}`;
    const description = 'New branch';
    createBranch(name, description);
}, [createBranch]);

  // Handle rollback
  const handleRollback = useCallback((versionId: string) => {
    rollbackToVersion(versionId);
}, [rollbackToVersion]);

  // Get status color
  const getStatusColor = useCallback((): 'default' | 'error' | 'warning' | 'success' => {
    if (hasError) return 'error';
    if (!isInitialized) return 'warning';
    if (isEnabled) return 'success';
    return 'default';
}, [hasError, isInitialized, isEnabled]);

  // Get status icon
  const getStatusIcon = useCallback((): React.ReactElement => {
    if (hasError) {
      const icon = theming.getThemedIcon('error');
      return React.isValidElement(icon) ? icon : <Error />;
    }
    if (!isInitialized) return <CircularProgress size={16} />;
    if (isEnabled) return <History />;
    const icon = theming.getThemedIcon('warning');
    return React.isValidElement(icon) ? icon : <Warning />;
}, [hasError, isInitialized, isEnabled]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (hasError) return 'Error';
    if (!isInitialized) return 'Initializing...';
    if (isEnabled) return 'Active';
    return 'Inactive';
}, [hasError, isInitialized, isEnabled]);

  // Get position styles
  const getPositionStyles = useCallback(() => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 1000,  };

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top:  16, left: 16,};
      case 'top-right':
        return { ...baseStyles, top:  16, right: 16,};
      case 'bottom-left':
        return { ...baseStyles, bottom:  16, left: 16,};
      case 'bottom-right':
        return { ...baseStyles, bottom:  16, right: 16,};
      case 'top-center':
        return { ...baseStyles, top:  16, left: '50%', transform: 'translateX(-50%)',};
      case 'bottom-center':
        return { ...baseStyles, bottom:  16, left: '50%', transform: 'translateX(-50%)',};
      default: return { ...baseStyles, top:  16, right: 16,};
  }
}, [position]);

  // Render minimal variant
  const renderMinimal = () => (
    <Tooltip title={`Version Control: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={totalVersions}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowVersionControlDialog(true)}
        sx={{ cursor: 'pointer'}}
      />
    </Tooltip>
  );

  // Render detailed variant
  const renderDetailed = () => (
    <Paper elevation={2} sx={{ p: 1, minWidth: 200,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          {getStatusIcon()}
          <Typography variant="body2" color={getStatusColor() + '.main'}>
            {getStatusText()}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => setShowVersionControlDialog(true)}>
            <KeyboardArrowDown />
          </IconButton>
          
          {showSettings && (
            <IconButton size="small" onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      {showDetails && (
        <Box mt={1}>
          <Typography variant="caption" color="text.secondary">
            {totalVersions} versions
          </Typography>
          {stagedChanges.length > 0 && (
            <Typography variant="caption" color="warning.main" sx={{ ml:  1 }}>
              {stagedChanges.length} staged
            </Typography>
          )}
          {unstagedChanges.length > 0 && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              {unstagedChanges.length} unstaged
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );

  // Render full variant
  const renderFull = () => (
    <Paper elevation={3} sx={{ p: 2, minWidth: 300,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <History color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Version Control
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('add')}
            onClick={handleCreateVersion}
            variant="outlined"
            size="small"
          >
            New Version
          </Button>
          
          {showSettings && (
            <IconButton onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Versions
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalVersions}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Branches
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalBranches}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Commits
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalCommits}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Status
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {getStatusIcon()}
                <Typography variant="body2" color={getStatusColor() + '.main'}>
                  {getStatusText()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {currentVersion && (
        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Current: {currentVersion.name} (v{currentVersion.number})
          </Typography>
        </Box>
      )}
    </Paper>
  );

  // Render based on variant
  const renderContent = () => {
    switch (variant) {
      case 'minimal':
        return renderMinimal();
      case 'detailed':
        return renderDetailed();
      case 'full':
        return renderFull();
      default: return renderMinimal();
}
};

  return (
    <>
      <Box
        className={className}
        style={{
          ...getPositionStyles(),
          ...style
      }}
      >
        {renderContent()}
      </Box>

      {/* Version Control Dialog */}
      <Dialog open={showVersionControlDialog} onClose={() => setShowVersionControlDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <History />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Version Control Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="History" />
            <Tab label="Branches" />
            <Tab label="Commits" />
            <Tab label="Tags" />
            <Tab label="Diffs" />
            <Tab label="Changes" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Versions
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalVersions}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Branches
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalBranches}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Commits
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalCommits}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Status
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon()}
                      <Typography variant="body2" color={getStatusColor() + '.main'}>
                        {getStatusText()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
          
          {activeTab === 1 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Version History
              </Typography>
              <Timeline>
                {versions.slice(0, 10).map((version, index) => (
                  <TimelineItem key={version.id}>
                    <TimelineOppositeContent>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(version.metadata.timestamp).toLocaleString()}
                      </Typography>
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot color="primary">
                        <History />
                      </TimelineDot>
                      {index < versions.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="subtitle2">
                        {version.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {version.description}
                      </Typography>
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Branches
              </Typography>
              <List>
                {branches.map((branch) => (
                  <ListItem key={branch.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <BranchIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={branch.name}
                      secondary={`${branch.description} • ${branch.isActive ? 'Active' : 'Inactive'}`}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={branch.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={branch.isActive ? 'success' : 'default'}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 3 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Commits
              </Typography>
              <List>
                {commits.slice(0, 10).map((commit) => (
                  <ListItem key={commit.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <CommitIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={commit.message}
                      secondary={`${commit.author} • ${new Date(commit.timestamp).toLocaleString()}`}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={commit.branch}
                        size="small"
                        color="primary"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Tags
              </Typography>
              <List>
                {tags.map((tag) => (
                  <ListItem key={tag.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <TagIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={tag.name}
                      secondary={`${tag.type} • ${new Date(tag.createdAt).toLocaleString()}`}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={tag.type}
                        size="small"
                        color="secondary"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Diffs
              </Typography>
              <List>
                {diffs.map((diff) => (
                  <ListItem key={diff.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <DiffIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${diff.fromVersion} → ${diff.toVersion}`}
                      secondary={`${diff.summary.added} added, ${diff.summary.modified} modified, ${diff.summary.deleted} deleted`}
                    />
                    <ListItemSecondaryAction>
                      <Button
                        size="small"
                        onClick={() => {/* View diff */}}
                      >
                        View
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 6 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Changes
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Staged Changes
                      </Typography>
                      <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                        {stagedChanges.length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={6}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Unstaged Changes
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {unstagedChanges.length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowVersionControlDialog(false)}>
            Close
          </Button>
          <Button onClick={handleCreateVersion}
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
           sx={theming.getThemedButtonSx()}>
            New Version
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Version Control Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableVersionControl}
                    onChange={(e) => updateConfig({ enableVersionControl: e.target.checked })}
                  />
              }
                label="Enable Version Control"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableChangeTracking}
                    onChange={(e) => updateConfig({ enableChangeTracking: e.target.checked })}
                  />
              }
                label="Enable Change Tracking"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableBranching}
                    onChange={(e) => updateConfig({ enableBranching: e.target.checked })}
                  />
              }
                label="Enable Branching"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableMerging}
                    onChange={(e) => updateConfig({ enableMerging: e.target.checked })}
                  />
              }
                label="Enable Merging"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableRollback}
                    onChange={(e) => updateConfig({ enableRollback: e.target.checked })}
                  />
              }
                label="Enable Rollback"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableDiff}
                    onChange={(e) => updateConfig({ enableDiff: e.target.checked })}
                  />
              }
                label="Enable Diff"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableHistory}
                    onChange={(e) => updateConfig({ enableHistory: e.target.checked })}
                  />
              }
                label="Enable History"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTags}
                    onChange={(e) => updateConfig({ enableTags: e.target.checked })}
                  />
              }
                label="Enable Tags"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCommits}
                    onChange={(e) => updateConfig({ enableCommits: e.target.checked })}
                  />
              }
                label="Enable Commits"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableStaging}
                    onChange={(e) => updateConfig({ enableStaging: e.target.checked })}
                  />
              }
                label="Enable Staging"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.autoCommit}
                    onChange={(e) => updateConfig({ autoCommit: e.target.checked })}
                  />
              }
                label="Auto Commit"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCompression}
                    onChange={(e) => updateConfig({ enableCompression: e.target.checked })}
                  />
              }
                label="Enable Compression"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableBackup}
                    onChange={(e) => updateConfig({ enableBackup: e.target.checked })}
                  />
              }
                label="Enable Backup"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableSync}
                    onChange={(e) => updateConfig({ enableSync: e.target.checked })}
                  />
              }
                label="Enable Sync"
              />
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

VersionControlDashboard.displayName ='VersionControlDashboard';

export default VersionControlDashboard;


