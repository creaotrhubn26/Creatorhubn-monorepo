/**
 * Channel Management Component
 * 
 * Admin interface for managing channels:
 * - Add/edit/delete channels
 * - Channel-level rules (if backend supports /channels/:id/rules)
 * - Configure feature requirements
 * - Set default channels
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  MenuItem,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Snackbar,
  Alert,
} from '@mui/material';
import { Add, Edit, Delete, Tag, ExpandMore, Rule } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface Channel {
  id: string;
  group_id: string;
  name: string;
  display_name: string;
  description: string;
  channel_type: string;
  is_default: boolean;
  requires_feature: string | null;
  requires_subscription_tier: string | null;
  is_read_only: boolean;
  is_archived: boolean;
  position: number;
  group_name: string;
  group_icon?: string;
  rules?: string[];
}

export default function ChannelManagement() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [newRule, setNewRule] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rulesSupported, setRulesSupported] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    group_id: ',',
    name: '',
    display_name: '',
    description: '',
    channel_type: 'text',
    is_default: false,
    requires_feature: '',
    requires_subscription_tier: '',
    is_read_only: false,
    position: 0,
  });

  useEffect(() => {
    fetchChannels();
    fetchGroups();
  }, []);

  const checkRulesSupport = async (list: Channel[]) => {
    if (!list.length) {
      setRulesSupported(null);
      return;
    }
    try {
      await apiRequest(`/api/community/admin/channels/${list[0].id}/rules`, {
        method: 'GET',
      });
      setRulesSupported(true);
    } catch (err) {
      console.warn('Channel rules endpoint not available, disabling rules dialog.');
      setRulesSupported(false);
    }
  };

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/api/community/admin/channels', {
        method: 'GET',
      }) as { success: boolean; channels: Channel[] };

      if (response.success) {
        setChannels(response.channels);
        checkRulesSupport(response.channels);
      }
    } catch (error) {
      console.error('Error fetching channels: ', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await apiRequest('/api/community/admin/groups', {
        method: 'GET',
      }) as { success: boolean; groups: any[] };

      if (response.success) {
        setGroups(response.groups);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const handleOpenDialog = (channel?: Channel) => {
    if (channel) {
      setEditingChannel(channel);
      setFormData({
        group_id: channel.group_id,
        name: channel.name,
        display_name: channel.display_name,
        description: channel.description,
        channel_type: channel.channel_type,
        is_default: channel.is_default,
        requires_feature: channel.requires_feature || '',
        requires_subscription_tier: channel.requires_subscription_tier || '',
        is_read_only: channel.is_read_only,
        position: channel.position,
      });
    } else {
      setEditingChannel(null);
      setFormData({
        group_id: '',
        name: '',
        display_name: ', ',
        description: ', ',
        channel_type: 'text',
        is_default: false,
        requires_feature: ', ',
        requires_subscription_tier: ', ',
        is_read_only: false,
        position: 0,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingChannel(null);
  };

  const handleSave = async () => {
    try {
      const url = editingChannel
        ? `/api/community/admin/channels/${editingChannel.id}`
        : '/api/community/admin/channels';

      const response = await apiRequest(url, {
        method: editingChannel ? 'PUT' : 'POST',
        body: JSON.stringify(formData),
      }) as { success: boolean; message: string };

      if (response.success) {
        setSnackbar({ open: true, message: response.message, severity: 'success' });
        fetchChannels();
        handleCloseDialog();
      }
    } catch (error) {
      console.error('Error saving channel:', error);
      setSnackbar({ open: true, message: 'Failed to save channel', severity: 'error' });
    }
  };

  const handleDelete = async (channelId: string) => {
    setConfirmDeleteId(channelId);
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;

    try {
      const response = await apiRequest(`/api/community/admin/channels/${confirmDeleteId}`, {
        method: 'DELETE',
      }) as { success: boolean; message: string };

      if (response.success) {
        setSnackbar({ open: true, message: response.message, severity: 'success' });
        fetchChannels();
      }
    } catch (error) {
      console.error('Error deleting channel:', error);
      setSnackbar({ open: true, message: 'Failed to delete channel', severity: 'error' });
    }
    setConfirmDeleteId(null);
  };

  const handleOpenRulesDialog = (channel: Channel) => {
    setSelectedChannel(channel);
    setNewRule(', ');
    setRulesDialogOpen(true);
  };

  const handleAddRule = () => {
    if (!selectedChannel) return;
    const trimmed = newRule.trim();
    if (!trimmed) return;
    setSelectedChannel({
      ...selectedChannel,
      rules: [...(selectedChannel.rules || []), trimmed],
    });
    setNewRule('');
  };

  const handleRemoveRule = (rule: string) => {
    if (!selectedChannel) return;
    setSelectedChannel({
      ...selectedChannel,
      rules: (selectedChannel.rules || []).filter((r) => r !== rule),
    });
  };

  const handleSaveRules = async () => {
    if (!selectedChannel) return;
    try {
      const response = await apiRequest(`/api/community/admin/channels/${selectedChannel.id}/rules`, {
        method: 'PUT',
        body: JSON.stringify({ rules: selectedChannel.rules || [] }),
      }) as { success?: boolean; message?: string };

      if (response?.success) {
        setSnackbar({ open: true, message: response.message || 'Rules updated', severity: 'success' });
        setRulesDialogOpen(false);
        fetchChannels();
      } else {
        setRulesSupported(false);
        setSnackbar({ open: true, message: 'Channel rules endpoint not available on backend.', severity: 'warning' });
      }
    } catch (error) {
      console.error('Error saving rules:', error);
      setRulesSupported(false);
      setSnackbar({ open: true, message: 'Channel rules endpoint not available on backend.', severity: 'warning' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tag /> Channel Management
        </Typography>
        {rulesSupported === false && (
          <Chip
            color="warning"
            label="Channel rules endpoint unavailable (buttons disabled)"
            size="small"
          />
        )}
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
        >
          Add Channel
        </Button>
      </Box>

      {/* Channels grouped by group */}
      {groups.map((group) => {
        const groupChannels = channels.filter((c) => c.group_id === group.id);
        if (groupChannels.length === 0) return null;

        return (
          <Accordion key={group.id} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">
                {group.icon} {group.name}
              </Typography>
              <Chip label={`${groupChannels.length} channels`} size="small" sx={{ ml: 2 }} />
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Default</TableCell>
                      <TableCell>Read-only</TableCell>
                      <TableCell>Requires</TableCell>
                      <TableCell>Rules</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {groupChannels.map((channel) => (
                      <TableRow key={channel.id} hover>
                        <TableCell>
                          <Typography variant="body1" sx={{ fontWeight: 600}}>
                            {channel.display_name || channel.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {channel.description}
                          </Typography>
                        </TableCell>
                        <TableCell>{channel.channel_type}</TableCell>
                        <TableCell>
                          <Chip
                            label={channel.is_default ? 'Default' : 'Optional'}
                            color={channel.is_default ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={channel.is_read_only ? 'Read-only' : 'Interactive'}
                            color={channel.is_read_only ? 'warning' : 'primary'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                            {channel.requires_feature && (
                              <Chip label={`Feature: ${channel.requires_feature}`} size="small" />
                            )}
                            {channel.requires_subscription_tier && (
                              <Chip
                                label={`Tier: ${channel.requires_subscription_tier}`}
                                size="small"
                                color="secondary"
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {(channel.rules || []).length > 0 ? (
                            <Chip label={`${channel.rules?.length} rules`} size="small" />
                          ) : (
                            <Chip label="No rules" size="small" />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <IconButton size="small" onClick={() => handleOpenDialog(channel)}>
                              <Edit />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenRulesDialog(channel)}
                              disabled={!rulesSupported}
                            >
                              <Rule />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(channel.id)}
                            >
                              <Delete />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        );
      })}

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingChannel ? 'Edit Channel' : 'Add Channel'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              select
              label="Group"
              value={formData.group_id}
              onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
              fullWidth
              required
            >
              {groups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.icon} {group.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Internal Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Display Name"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />

            <TextField
              select
              label="Channel Type"
              value={formData.channel_type}
              onChange={(e) => setFormData({ ...formData, channel_type: e.target.value })}
              fullWidth
            >
              <MenuItem value="text">Text</MenuItem>
              <MenuItem value="voice">Voice</MenuItem>
              <MenuItem value="stage">Stage</MenuItem>
              <MenuItem value="announcement">Announcement</MenuItem>
            </TextField>

            <TextField
              label="Requires Feature (optional)"
              value={formData.requires_feature}
              onChange={(e) => setFormData({ ...formData, requires_feature: e.target.value })}
              fullWidth
            />
            <TextField
              label="Requires Subscription Tier (optional)"
              value={formData.requires_subscription_tier}
              onChange={(e) =>
                setFormData({ ...formData, requires_subscription_tier: e.target.value })
              }
              fullWidth
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                />
              }
              label="Default channel for new members"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_read_only}
                  onChange={(e) => setFormData({ ...formData, is_read_only: e.target.checked })}
                />
              }
              label="Read-only channel"
            />
            <TextField
              type="number"
              label="Position"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: Number(e.target.value) })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} sx={{ bgcolor: '#ff8c00' }}>
            {editingChannel ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rulesDialogOpen} onClose={() => setRulesDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Channel Rules</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" gutterBottom>
            {selectedChannel?.display_name}
          </Typography>
          {!rulesSupported && (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              Backend does not expose channel rules; updates may not persist.
            </Typography>
          )}
          <List dense>
            {(selectedChannel?.rules || []).map((rule) => (
              <ListItem key={rule} divider>
                <ListItemText primary={rule} />
                <ListItemSecondaryAction>
                  <IconButton edge="end" size="small" onClick={() => handleRemoveRule(rule)}>
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {(selectedChannel?.rules || []).length === 0 && (
              <ListItem>
                <ListItemText primary="No rules yet" />
              </ListItem>
            )}
          </List>
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <TextField
              label="Add rule"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              fullWidth
            />
            <Button variant="contained" onClick={handleAddRule}>
              Add
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRulesDialogOpen(false)}>Close</Button>
          <Button variant="contained" onClick={handleSaveRules} sx={{ bgcolor:'#ff8c00' }}>
            Save Rules
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
      >
        <DialogTitle>Delete Channel</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this channel? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
          <Button onClick={executeDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
