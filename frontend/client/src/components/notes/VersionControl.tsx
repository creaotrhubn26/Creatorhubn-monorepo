/**
 * Version Control & History - Track changes, versions, and collaboration history
 * Provides comprehensive version management for interactive documentation
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Stack,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  Badge,
  Tooltip,
  IconButton,
  LinearProgress,
  Alert,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

interface Version {
  id: string;
  number: string;
  title: string;
  description: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
};
  createdAt: Date;
  changes: Change[];
  isMajor: boolean;
  isCurrent: boolean;
  isPublished: boolean;
  tags: string[];
  size: number;
  checksum: string
}

interface Change {
  id: string;
  type: 'add' | 'edit' | 'delete' | 'move' | 'rename';
  elementId: string;
  elementType: string;
  oldValue?: any;
  newValue?: any;
  description: string;
  timestamp: Date;
  author: {
    id: string;
    name: string;
};
}

interface Branch {
  id: string;
  name: string;
  description: string;
  baseVersion: string;
  currentVersion: string;
  author: {
    id: string;
    name: string;
};
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  isMerged: boolean
}

interface VersionControlProps {
  documentId: string;
  currentVersion: string;
  onVersionChange: (versionId: string) => void;
  onVersionCreate: (version: Omit<Version, 'id, '>) => void;
  onBranchCreate: (branch: Omit<Branch, 'id'>) => void;
  onBranchMerge: (branchId: string, targetVersion: string) => void;
  onVersionRestore: (versionId: string) => void;
  className?: string
}

export const VersionControl: React.FC<VersionControlProps> = ({
  documentd,
  currentVersion,
  onVersionChange,
  onVersionCreate,
  onBranchCreate,
  onBranchMerge,
  onVersionRestore,
  className,
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [showVersionDetails, setShowVersionDetails] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [filter, setFilter] = useState<'all' | 'major' | 'minor' | 'published'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data for demonstration
  

  

  useEffect(() => {
    setVersions(mockVersions);
    setBranches(mockBranches);
}, []);

  const filteredVersions = useMemo(() => {
    return versions.filter(version => {
      if (filter === 'major' && !version.isMajor) return false;
      if (filter === 'minor' && version.isMajor) return false;
      if (filter === 'published' && !version.isPublished) return false;
      if (searchQuery && !version.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !version.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
  });
}, [versions, filter, searchQuery]);

  const handleCreateVersion = useCallback((versionData: Omit<Version, 'id'>) => {
    const newVersion: Version = {
      ...versionData,
      id: Date.now().toString(),
      createdAt: new Date()
};
    
    setVersions(prev => [newVersion, ...prev]);
    onVersionCreate(versionData);
    setShowCreateVersion(false);
}, [onVersionCreate]);

  const handleCreateBranch = useCallback((branchData: Omit<Branch, 'id'>) => {
    const newBranch: Branch = {
      ...branchData,
      id: Date.now().toString(),
      createdAt: new Date(),
      lastActivity: new Date()
};
    
    setBranches(prev => [...prev, newBranch]);
    onBranchCreate(branchData);
    setShowCreateBranch(false);
}, [onBranchCreate]);

  const handleVersionSelect = useCallback((version: Version) => {
    setSelectedVersion(version);
    setShowVersionDetails(true);
}, []);

  const handleVersionRestore = useCallback((versionId: string) => {
    onVersionRestore(versionId);
    setShowVersionDetails(false);
}, [onVersionRestore]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-U', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
}).format(date);
};

  const formatFileSize = (bytes: number) => {
    const sizes = ['','KB','MB','GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + '' + sizes[i];
};

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'add': return <CREATOR_HUB_ICONS.add />;
      case 'edit': return <CREATOR_HUB_ICONS.edit />;
      case 'delete': return <CREATOR_HUB_ICONS.delete />;
      case 'move': return <CREATOR_HUB_ICONS.share />;
      case 'rename': return <CREATOR_HUB_ICONS.autoFixHigh />;
      default: return <CREATOR_HUB_ICONS.circle />;
}
};

  const getChangeColor = (type: string) => {
    switch (type) {
      case 'add': return 'success';
      case 'edit': return 'primary';
      case 'delete': return 'error';
      case 'move': return 'warning';
      case 'rename': return 'info';
      default: return 'default';
}
};

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.history sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Version Control</Typography>
              <Typography variant="body2" color="text.secondary">
                Current: {currentVersion} • {versions.length} versions
              </Typography>
            </Box>
          </Stack>
          
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.add />}
              onClick={() => setShowCreateVersion(true)}
            >
              New Version
            </Button>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.share />}
              onClick={() => setShowCreateBranch(true)}
            >
              New Branch
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Filters and Search */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search versions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ minWidth: 200}}
          />
          
          <FormControl size="small" sx={{ minWidth: 120}}>
            <InputLabel>Filter</InputLabel>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <MenuItem value="all">All Versions</MenuItem>
              <MenuItem value="major">Major Only</MenuItem>
              <MenuItem value="minor">Minor Only</MenuItem>
              <MenuItem value="published">Published</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Versions List */}
      <Paper elevation={1} sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
        <List>
          {filteredVersions.map((version, index) => (
            <React.Fragment key={version.id}>
              <ListItem
                button
                onClick={() => handleVersionSelect(version)}
                sx={{
                  bgcolor: version.isCurrent ? 'action.hover' : 'transparent', '&:hover': { bgcolor: 'action.hover',}
              }}
              >
                <ListItemIcon>
                  <Avatar sx={{ bgcolor: version.isMajor ? 'primary.main' : 'secondary.main'}}>
                    {version.isMajor ? 'M' : 'm'}
                  </Avatar>
                </ListItemIcon>
                
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1">{version.title}</Typography>
                      <Chip
                        label={version.number}
                        size="small"
                        color={version.isMajor ? 'primary' : 'default'}
                        variant="outlined"
                      />
                      {version.isCurrent && (
                        <Chip label="Current" size="small" color="success" />
                      )}
                      {version.isPublished && (
                        <Chip label="Published" size="small" color="info" />
                      )}
                    </Stack>
                }
                  secondary={
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        {version.description}
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Typography variant="caption">
                          by {version.author.name} • {formatDate(version.createdAt)}
                        </Typography>
                        <Typography variant="caption">
                          {version.changes.length} changes • {formatFileSize(version.size)}
                        </Typography>
                      </Stack>
                    </Stack>
                }
                />
                
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={1}>
                    {version.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
              {index < filteredVersions.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </Paper>

      {/* Branches */}
      <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Active Branches ({branches.filter(b => b.isActive).length})
        </Typography>
        
        <Stack spacing={2}>
          {branches.map((branch) => (
            <Card key={branch.id} variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="subtitle1">{branch.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {branch.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      by {branch.author.name} • {formatDate(branch.createdAt)}
                    </Typography>
                  </Box>
                  
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={branch.isActive ? 'Active' : 'Merged'}
                      size="small"
                      color={branch.isActive ? 'success' : 'default'}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onBranchMerge(branch.id, currentVersion)}
                    >
                      Merge
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Paper>

      {/* Create Version Dialog */}
      <Dialog 
        open={showCreateVersion}
        onClose={() => setShowCreateVersion(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.add />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Create New Version</Typography>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt:  1 }}>
            <TextField
              fullWidth
              label="Version Title"
              placeholder="e.g., Added Mobile Support"
              required
            />
            
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              placeholder="Describe the changes in this version..."
              required
            />
            
            <Stack direction="row" spacing={2}>
              <TextField
                label="Version Number"
                placeholder="1.3.0"
                sx={{ flex:  1 }}
              />
              <FormControl sx={{ minWidth: 120}}>
                <InputLabel>Type</InputLabel>
                <Select defaultValue="minor">
                  <MenuItem value="major">Major</MenuItem>
                  <MenuItem value="minor">Minor</MenuItem>
                  <MenuItem value="patch">Patch</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Publish immediately"
            />
          </Stack>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowCreateVersion(false)}>
            Cancel
          </Button>
          <Button variant="contained" sx={theming.getThemedButtonSx()}>
            Create Version
          </Button>
        </DialogActions>
      </Dialog>

      {/* Version Details Dialog */}
      <Dialog 
        open={showVersionDetails}
        onClose={() => setShowVersionDetails(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.history />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedVersion?.title} ({selectedVersion?.number})
            </Typography>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          {selectedVersion && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedVersion.description}
              </Typography>
              
              <Divider sx={{ my:  2 }} />
              
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Changes ({selectedVersion.changes.length})
              </Typography>
              
              <Timeline>
                {selectedVersion.changes.map((change, index) => (
                  <TimelineItem key={change.id}>
                    <TimelineSeparator>
                      <TimelineDot color={getChangeColor(change.type)}>
                        {getChangeIcon(change.type)}
                      </TimelineDot>
                      {index < selectedVersion.changes.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="subtitle2">{change.description}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {change.elementType} • by {change.author.name} • {formatDate(change.timestamp)}
                      </Typography>
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowVersionDetails(false)}>
            Close
          </Button>
          {selectedVersion && !selectedVersion.isCurrent && (
            <Button variant="contained"
              color="warning"
              onClick={() => handleVersionRestore(selectedVersion.id)} sx={theming.getThemedButtonSx()}
            >
              Restore This Version
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VersionControl;

