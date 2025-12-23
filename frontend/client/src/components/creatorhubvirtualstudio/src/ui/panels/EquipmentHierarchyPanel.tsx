/**
 * EquipmentHierarchyPanel - Visual equipment hierarchy and grouping
 * 
 * Features:
 * - Tree view of equipment groups
 * - Linked equipment indicators
 * - Drag to reorder/regroup
 * - Group management UI
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('EquipmentHierarchy');
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Chip,
  Collapse,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Paper,
  Divider,
  Alert,
} from '@mui/material';
import {
  AccountTree,
  ExpandMore,
  ExpandLess,
  Folder,
  FolderOpen,
  Link as LinkIcon,
  LinkOff,
  Add,
  Delete,
  Edit,
  MoreVert,
  Lock,
  LockOpen,
  Visibility,
  VisibilityOff,
  Lightbulb,
  CameraAlt,
  Mic,
  Weekend,
  Build,
  DragIndicator,
  GroupWork,
  Group,
  Layers,
} from '@mui/icons-material';
import {
  equipmentGroupingService,
  EquipmentNode,
  EquipmentGroup,
  LinkSuggestion,
} from '../../core/services/equipmentGroupingService';
import { useSelection } from '../../core/services/selectionService';
import { useTabletSupport } from '../../providers/TabletSupportProvider';
import { TouchIconButton, TouchSwipeListItem, TouchContextMenu } from '../components/TabletAwarePanels';

// ============================================================================
// Type Icons
// ============================================================================

const TYPE_ICONS: Record<string, React.ReactNode> = {
  light: <Lightbulb fontSize="small" />,
  camera: <CameraAlt fontSize="small" />,
  audio: <Mic fontSize="small" />,
  furniture: <Weekend fontSize="small" />,
  grip: <Build fontSize="small" />,
  modifier: <GroupWork fontSize="small" />,
  default: <Build fontSize="small" />,
};

function getTypeIcon(type: string): React.ReactNode {
  return TYPE_ICONS[type.toLowerCase()] || TYPE_ICONS.default;
}

// ============================================================================
// Equipment Node Item
// ============================================================================

interface NodeItemProps {
  node: EquipmentNode;
  level: number;
  isSelected: boolean;
  isLinked: boolean;
  linkedTo: string[];
  onSelect: (id: string) => void;
  onLink: (id: string) => void;
  onUnlink: (id: string, targetId: string) => void;
  onDelete: (id: string) => void;
}

function NodeItem({
  node,
  level,
  isSelected,
  isLinked,
  linkedTo,
  onSelect,
  onLink,
  onUnlink,
  onDelete,
}: NodeItemProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  return (
    <ListItem
      disablePadding
      secondaryAction={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isLinked && (
            <Tooltip title={`Linked to ${linkedTo.length} item(s)`}>
              <LinkIcon fontSize="small" sx={{ color: '#e91e63' }} />
            </Tooltip>
          )}
          <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVert fontSize="small" />
          </IconButton>
        </Box>
      }
    >
      <ListItemButton
        onClick={() => onSelect(node.id)}
        selected={isSelected}
        sx={{ pl: 2 + level * 2 }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          {getTypeIcon(node.type)}
        </ListItemIcon>
        <ListItemText
          primary={
            <Typography variant="body2" noWrap>
              {node.name}
            </Typography>
          }
          secondary={
            <Typography variant="caption" color="text.secondary">
              {node.type}
            </Typography>
          }
        />
      </ListItemButton>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => { onLink(node.id); setMenuAnchor(null); }}>
          <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
          Link to...
        </MenuItem>
        {isLinked && linkedTo.map((targetId) => (
          <MenuItem key={targetId} onClick={() => { onUnlink(node.id, targetId); setMenuAnchor(null); }}>
            <ListItemIcon><LinkOff fontSize="small" /></ListItemIcon>
            Unlink from {targetId}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => { onDelete(node.id); setMenuAnchor(null); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </ListItem>
  );
}

// ============================================================================
// Group Item
// ============================================================================

interface GroupItemProps {
  group: EquipmentGroup;
  nodes: EquipmentNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onSelectGroup: (id: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onDissolveGroup: (id: string) => void;
  onToggleLock: (id: string) => void;
  onLinkNode: (id: string) => void;
  onUnlinkNode: (id: string, targetId: string) => void;
  onDeleteNode: (id: string) => void;
}

function GroupItem({
  group,
  nodes,
  selectedNodeId,
  onSelectNode,
  onSelectGroup,
  onRenameGroup,
  onDissolveGroup,
  onToggleLock,
  onLinkNode,
  onUnlinkNode,
  onDeleteNode,
}: GroupItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState(group.name);

  const handleRename = () => {
    onRenameGroup(group.id, newName);
    setRenameDialogOpen(false);
  };

  return (
    <Box sx={{ mb: 1 }}>
      {/* Group Header */}
      <Paper
        elevation={0}
        sx={{
          backgroundColor: '#252530',
          border: '1px solid #333',
          borderRadius: 1}}
      >
        <ListItem
          secondaryAction={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Chip label={nodes.length} size="small" sx={{ height: 18, fontSize: 10 }} />
              {group.locked && (
                <Tooltip title="Group locked">
                  <Lock fontSize="small" sx={{ color: '#ff9800' }} />
                </Tooltip>
              )}
              <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
                <MoreVert fontSize="small" />
              </IconButton>
            </Box>
          }
        >
          <ListItemButton onClick={() => setExpanded(!expanded)} sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              {expanded ? <FolderOpen fontSize="small" /> : <Folder fontSize="small" />}
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="subtitle2" fontWeight={600}>
                  {group.name}
                </Typography>
              }
            />
            <IconButton size="small">
              {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </IconButton>
          </ListItemButton>
        </ListItem>

        {/* Group Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem onClick={() => { setRenameDialogOpen(true); setMenuAnchor(null); }}>
            <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
            Rename
          </MenuItem>
          <MenuItem onClick={() => { onToggleLock(group.id); setMenuAnchor(null); }}>
            <ListItemIcon>{group.locked ? <LockOpen fontSize="small" /> : <Lock fontSize="small" />}</ListItemIcon>
            {group.locked ? 'Unlock' : 'Lock'}
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { onDissolveGroup(group.id); setMenuAnchor(null); }} sx={{ color: 'warning.main' }}>
            <ListItemIcon><LinkOff fontSize="small" color="warning" /></ListItemIcon>
            Dissolve Group
          </MenuItem>
        </Menu>
      </Paper>

      {/* Group Nodes */}
      <Collapse in={expanded}>
        <Box sx={{ pl: 1, borderLeft: '2px solid #333', ml: 2, mt: 0.5 }}>
          <List dense disablePadding>
            {nodes.map((node) => (
              <NodeItem
                key={node.id}
                node={node}
                level={0}
                isSelected={selectedNodeId === node.id}
                isLinked={node.linkedIds.length > 0}
                linkedTo={node.linkedIds}
                onSelect={onSelectNode}
                onLink={onLinkNode}
                onUnlink={onUnlinkNode}
                onDelete={onDeleteNode}
              />
            ))}
          </List>
        </Box>
      </Collapse>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
        <DialogTitle>Rename Group</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            label="Group Name"
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRename} variant="contained">Rename</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ============================================================================
// Link Suggestions
// ============================================================================

interface LinkSuggestionsProps {
  suggestions: LinkSuggestion[];
  onAccept: (sourceId: string, targetId: string) => void;
  onDismiss: (sourceId: string, targetId: string) => void;
}

function LinkSuggestions({ suggestions, onAccept, onDismiss }: LinkSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        mb: 2,
        backgroundColor: '#1a2a3a',
        border: '1px solid #2a4a6a',
        borderRadius: 1}}
    >
      <Typography variant="caption" fontWeight={600} sx={{ color: '#4fc3f7', mb: 1, display: 'block' }}>
        💡 Suggested Links
      </Typography>
      {suggestions.slice(0, 3).map((suggestion, index) => (
        <Box
          key={index}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 0.5}}
        >
          <Typography variant="caption" color="text.secondary">
            {suggestion.reason}
          </Typography>
          <Box>
            <IconButton size="small" onClick={() => onAccept(suggestion.sourceId, suggestion.targetId)}>
              <LinkIcon fontSize="small" sx={{ color: '#4caf50' }} />
            </IconButton>
            <IconButton size="small" onClick={() => onDismiss(suggestion.sourceId, suggestion.targetId)}>
              <LinkOff fontSize="small" sx={{ color: '#666' }} />
            </IconButton>
          </Box>
        </Box>
      ))}
    </Paper>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

interface EquipmentHierarchyPanelProps {
  selectedNodeId?: string | null;
  onSelectNode?: (id: string | null) => void;
}

export function EquipmentHierarchyPanel({
  selectedNodeId: externalSelectedNodeId,
  onSelectNode: externalOnSelectNode,
}: EquipmentHierarchyPanelProps) {
  // Tablet support
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  // Use centralized selection service
  const selection = useSelection('hierarchy-panel');
  
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [advancedMenuAnchor, setAdvancedMenuAnchor] = useState<null | HTMLElement>(null);

  // Sync with external selection if provided
  const selectedNodeId = externalSelectedNodeId ?? selection.selectedIds[0] ?? null;
  const onSelectNode = externalOnSelectNode ?? ((id: string | null) => {
    if (id) {
      selection.select(id);
    } else {
      selection.clear();
    }
  });

  // Get all nodes and groups
  const allNodes = useMemo(() => equipmentGroupingService.getAllNodes(), [refreshKey]);
  const allGroups = useMemo(() => equipmentGroupingService.getAllGroups(), [refreshKey]);

  // Ungrouped nodes
  const ungroupedNodes = useMemo(
    () => allNodes.filter((node) => !node.groupId),
    [allNodes]
  );

  // Get link suggestions for selected node
  const linkSuggestions = useMemo(() => {
    if (!selectedNodeId) return [];
    return equipmentGroupingService.getSuggestedLinks(selectedNodeId);
  }, [selectedNodeId, refreshKey]);

  // Handlers
  const handleCreateGroup = useCallback(() => {
    if (!newGroupName.trim()) return;
    const selectedNodes = allNodes.filter((n) => n.id === selectedNodeId);
    if (selectedNodes.length > 0) {
      equipmentGroupingService.createGroup(newGroupName, selectedNodes.map((n) => n.id));
    }
    setNewGroupName(', ');
    setCreateGroupDialogOpen(false);
    setRefreshKey((k) => k + 1);
  }, [newGroupName, selectedNodeId, allNodes]);

  const handleDissolveGroup = useCallback((groupId: string) => {
    equipmentGroupingService.dissolveGroup(groupId);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleToggleLock = useCallback((groupId: string) => {
    const group = equipmentGroupingService.getGroup(groupId);
    if (group) {
      group.locked = !group.locked;
      setRefreshKey((k) => k + 1);
    }
  }, []);

  const handleRenameGroup = useCallback((groupId: string, name: string) => {
    const group = equipmentGroupingService.getGroup(groupId);
    if (group) {
      group.name = name;
      setRefreshKey((k) => k + 1);
    }
  }, []);

  const handleLink = useCallback((nodeId: string) => {
    setLinkSourceId(nodeId);
    setLinkDialogOpen(true);
  }, []);

  const handleLinkTo = useCallback((targetId: string) => {
    if (linkSourceId) {
      equipmentGroupingService.linkNodes(linkSourceId, targetId);
      setRefreshKey((k) => k + 1);
    }
    setLinkDialogOpen(false);
    setLinkSourceId(null);
  }, [linkSourceId]);

  const handleUnlink = useCallback((nodeId: string, targetId: string) => {
    equipmentGroupingService.unlinkNodes(nodeId, targetId);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    equipmentGroupingService.unregisterNode(nodeId);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleAcceptSuggestion = useCallback((sourceId: string, targetId: string) => {
    equipmentGroupingService.linkNodes(sourceId, targetId);
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountTree />
            <Typography variant="h6" fontWeight={700}>
              Hierarchy
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Create Group">
              <IconButton size="small" onClick={() => setCreateGroupDialogOpen(true)}>
                <Add />
              </IconButton>
            </Tooltip>
            <Tooltip title="Advanced">
              <IconButton size="small" onClick={(e) => setAdvancedMenuAnchor(e.currentTarget)}>
                <MoreVert />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`${allNodes.length} items, `} size="small" variant="outlined" />
          <Chip label={`${allGroups.length} groups`} size="small" variant="outlined" />
          {selection.selectedIds.length > 1 && (
            <Chip 
              label={`${selection.selectedIds.length} selected`} 
              size="small" 
              color="primary"
              onDelete={() => selection.clear()}
            />
          )}
        </Box>

        {/* Advanced Menu */}
        <Menu
          anchorEl={advancedMenuAnchor}
          open={Boolean(advancedMenuAnchor)}
          onClose={() => setAdvancedMenuAnchor(null)}
        >
          <MenuItem onClick={() => {
            equipmentGroupingService.autoGroupByType();
            setRefreshKey((k) => k + 1);
            setAdvancedMenuAnchor(null);
          }}>
            <ListItemIcon><Layers fontSize="small" /></ListItemIcon>
            Auto-Group by Type
          </MenuItem>
          <MenuItem onClick={() => {
            equipmentGroupingService.autoGroupByProximity(2);
            setRefreshKey((k) => k + 1);
            setAdvancedMenuAnchor(null);
          }}>
            <ListItemIcon><Group fontSize="small" /></ListItemIcon>
            Auto-Group by Proximity
          </MenuItem>
          <Divider />
          {selection.selectedIds.length > 1 && (
            <MenuItem onClick={() => {
              equipmentGroupingService.createGroup('Selection Group', selection.selectedIds);
              setRefreshKey((k) => k + 1);
              setAdvancedMenuAnchor(null);
            }}>
              <ListItemIcon><GroupWork fontSize="small" /></ListItemIcon>
              Group Selection ({selection.selectedIds.length})
            </MenuItem>
          )}
          <MenuItem onClick={() => {
            const duplicated = equipmentGroupingService.duplicateNodes(selection.selectedIds);
            selection.select(duplicated);
            setRefreshKey((k) => k + 1);
            setAdvancedMenuAnchor(null);
          }} disabled={selection.selectedIds.length === 0}>
            <ListItemIcon><Add fontSize="small" /></ListItemIcon>
            Duplicate Selection
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => {
            const stats = equipmentGroupingService.getStatistics();
            log.debug('Grouping Statistics: ', stats);
            alert(`Total: ${stats.totalNodes} items in ${stats.totalGroups} groups\n` +
              , `Grouped: ${stats.groupedNodes}, Linked: ${stats.linkedNodes}, Orphaned: ${stats.orphanedNodes}`);
            setAdvancedMenuAnchor(null);
          }}>
            <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
            Show Statistics
          </MenuItem>
        </Menu>
      </Box>

      {/* Link Suggestions */}
      {selectedNodeId && linkSuggestions.length > 0 && (
        <Box sx={{ p: 1 }}>
          <LinkSuggestions
            suggestions={linkSuggestions}
            onAccept={handleAcceptSuggestion}
            onDismiss={() => {}}
          />
        </Box>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {allNodes.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <AccountTree sx={{ fontSize: 48, color: '#444', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No equipment in scene
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Add equipment from the Catalog tab
            </Typography>
          </Box>
        ) : (
          <>
            {/* Groups */}
            {allGroups.map((group) => (
              <GroupItem
                key={group.id}
                group={group}
                nodes={equipmentGroupingService.getGroupNodes(group.id)}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
                onSelectGroup={() => {}}
                onRenameGroup={handleRenameGroup}
                onDissolveGroup={handleDissolveGroup}
                onToggleLock={handleToggleLock}
                onLinkNode={handleLink}
                onUnlinkNode={handleUnlink}
                onDeleteNode={handleDeleteNode}
              />
            ))}

            {/* Ungrouped Items */}
            {ungroupedNodes.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ px: 1, mb: 0.5, display:'block' }}>
                  Ungrouped
                </Typography>
                <List dense disablePadding>
                  {ungroupedNodes.map((node) => (
                    <NodeItem
                      key={node.id}
                      node={node}
                      level={0}
                      isSelected={selectedNodeId === node.id}
                      isLinked={node.linkedIds.length > 0}
                      linkedTo={node.linkedIds}
                      onSelect={onSelectNode}
                      onLink={handleLink}
                      onUnlink={handleUnlink}
                      onDelete={handleDeleteNode}
                    />
                  ))}
                </List>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Keyboard hint */}
      <Alert severity="info" sx={{ m: 1, py: 0.5 }} icon={false}>
        <Typography variant="caption">
          <strong>Ctrl+G</strong> Group &nbsp;|&nbsp; <strong>Ctrl+Shift+G</strong> Ungroup
        </Typography>
      </Alert>

      {/* Create Group Dialog */}
      <Dialog open={createGroupDialogOpen} onClose={() => setCreateGroupDialogOpen(false)}>
        <DialogTitle>Create Group</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            label="Group Name"
            placeholder="e.g., Key Light Setup"
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateGroupDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateGroup} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Link To...</DialogTitle>
        <DialogContent>
          <List dense>
            {allNodes
              .filter((n) => n.id !== linkSourceId)
              .map((node) => (
                <ListItem key={node.id} disablePadding>
                  <ListItemButton onClick={() => handleLinkTo(node.id)}>
                    <ListItemIcon>{getTypeIcon(node.type)}</ListItemIcon>
                    <ListItemText primary={node.name} secondary={node.type} />
                  </ListItemButton>
                </ListItem>
              ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default EquipmentHierarchyPanel;

