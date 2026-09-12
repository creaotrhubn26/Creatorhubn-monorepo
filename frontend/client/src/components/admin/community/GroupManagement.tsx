/**
 * Group Management Component
 * 
 * Admin interface for managing community groups:
 * - Add new profession groups
 * - Edit existing groups
 * - Delete groups
 * - View group statistics
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
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
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Snackbar,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Group,
  People,
  Visibility,
  TrendingUp,
  CheckCircle,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface CommunityGroup {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  profession_type: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
}

export default function GroupManagement() {
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CommunityGroup | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<CommunityGroup | null>(null);
  const [formData, setFormData] = useState({
    name:  ',',
    slug: '',
    description: '',
    icon: '📷',
    profession_type: 'photographer',
  });
  
  // Snackbar and delete dialog state
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/api/community/admin/groups', {
        method: 'GET',
      }) as { success: boolean; groups: CommunityGroup[] };

      if (response.success) {
        setGroups(response.groups);
      }
    } catch (error) {
      console.error('Error fetching groups: ', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (group?: CommunityGroup) => {
    if (group) {
      setEditingGroup(group);
      setFormData({
        name: group.name,
        slug: group.slug,
        description: group.description,
        icon: group.icon,
        profession_type: group.profession_type,
      });
    } else {
      setEditingGroup(null);
      setFormData({
        name: ', ',
        slug: ', ',
        description: '',
        icon: '📷',
        profession_type: 'photographer',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingGroup(null);
  };

  const handleSave = async () => {
    try {
      const url = editingGroup
        ? `/api/community/admin/groups/${editingGroup.id}`
        : '/api/community/admin/groups';

      const response = await apiRequest(url, {
        method: editingGroup ? 'PUT' : 'POST',
        body: JSON.stringify(formData),
      }) as { success: boolean; message: string };

      if (response.success) {
        setSnackbar({ open: true, message: response.message, severity: 'success' });
        fetchGroups();
        handleCloseDialog();
      }
    } catch (error) {
      console.error('Error saving group:', error);
      setSnackbar({ open: true, message: 'Failed to save group', severity: 'error' });
    }
  };

  const handleDelete = (groupId: string) => {
    setDeleteGroupId(groupId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteGroup = async () => {
    if (!deleteGroupId) return;
    
    try {
      const response = await apiRequest(`/api/community/admin/groups/${deleteGroupId}`, {
        method: 'DELETE',
      }) as { success: boolean; message: string };

      if (response.success) {
        setSnackbar({ open: true, message: response.message, severity: 'success' });
        fetchGroups();
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      setSnackbar({ open: true, message: 'Failed to delete group', severity: 'error' });
    }
    setDeleteDialogOpen(false);
    setDeleteGroupId(null);
  };

  const handleViewGroup = (group: CommunityGroup) => {
    setViewingGroup(group);
    setViewDialogOpen(true);
  };

  const professionTypes = [
    { value: 'photographer', label: 'Photographer', icon: '📷' },
    { value: 'videographer', label: 'Videographer', icon: '🎥' },
    { value: 'music_producer', label: 'Music Producer', icon: '🎵' },
    { value: 'cross_profession', label: 'Cross-Profession', icon: '🌟' },
  ];

  const totalMembers = groups.reduce((sum, group) => sum + group.member_count, 0);
  const activeGroups = groups.filter(g => g.is_active).length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Group /> Community Groups
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
        >
          Add Group
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#ff8c0010', borderLeft: '4px solid #ff8c00' }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Total Groups
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ff8c00' }}>
                {groups.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#4caf5010', borderLeft: '4px solid #4caf50' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Active Groups
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                    {activeGroups}
                  </Typography>
                </Box>
                <CheckCircle sx={{ fontSize: 40, color: '#4caf50', opacity: 0.5 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#2196f310', borderLeft: '4px solid #2196f3' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Total Members
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
                    {totalMembers}
                  </Typography>
                </Box>
                <People sx={{ fontSize: 40, color: '#2196f3', opacity: 0.5 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#9c27b010', borderLeft: '4px solid #9c27b0' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Avg Members/Group
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ce93d8' }}>
                    {groups.length > 0 ? Math.round(totalMembers / groups.length) : 0}
                  </Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 40, color: '#ce93d8', opacity: 0.5 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress sx={{ color: '#ff8c00' }} />
        </Box>
      ) : (
        <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Icon</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Profession Type</TableCell>
              <TableCell>Members</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((group) => (
              <TableRow key={group.id}>
                <TableCell>
                  <Avatar sx={{ bgcolor: '#ff8c0020' }}>{group.icon}</Avatar>
                </TableCell>
                <TableCell>
                  <Typography variant="body1" sx={{ fontWeight: 600}}>
                    {group.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {group.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={group.profession_type} size="small" />
                </TableCell>
                <TableCell>
                  <Chip icon={<People />} label={group.member_count} size="small" color="primary" />
                </TableCell>
                <TableCell>
                  <Chip
                    label={group.is_active ? 'Active' : 'Inactive'}
                    size="small"
                    color={group.is_active ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" color="info" onClick={() => handleViewGroup(group)}>
                    <Visibility />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleOpenDialog(group)}>
                    <Edit />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(group.id)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}

      {/* View Group Details Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Visibility /> Group Details
        </DialogTitle>
        <DialogContent>
          {viewingGroup && (
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Avatar sx={{ bgcolor: '#ff8c00', width: 60, height: 60, fontSize: 30 }}>
                      {viewingGroup.icon}
                    </Avatar>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        {viewingGroup.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Slug: {viewingGroup.slug}
                      </Typography>
                    </Box>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                  <Typography variant="body1">{viewingGroup.description || 'No description provided'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Profession Type</Typography>
                  <Chip label={viewingGroup.profession_type} sx={{ mt: 0.5 }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Member Count</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <People sx={{ color: '#ff8c00' }} />
                    <Typography variant="h6">{viewingGroup.member_count}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip
                    label={viewingGroup.is_active ? 'Active' : 'Inactive'}
                    color={viewingGroup.is_active ? 'success' : 'default'}
                    sx={{ mt: 0.5 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Created At</Typography>
                  <Typography variant="body2">
                    {new Date(viewingGroup.created_at).toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<Edit />}
            onClick={() => {
              setViewDialogOpen(false);
              if (viewingGroup) handleOpenDialog(viewingGroup);
            }}
            sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
          >
            Edit Group
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingGroup ? 'Edit Group' : 'Add New Group'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Group Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              placeholder="CreatorHub Norge - Photographer"
            />

            <TextField
              label="Slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              fullWidth
              required
              placeholder="photographer"
              helperText="URL-friendly identifier (lowercase, no spaces)"
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
              placeholder="Community for professional photographers"
            />

            <TextField
              select
              label="Profession Type"
              value={formData.profession_type}
              onChange={(e) => setFormData({ ...formData, profession_type: e.target.value })}
              fullWidth
              required
            >
              {professionTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Icon (Emoji)"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              fullWidth
              placeholder="📷"
              helperText="Single emoji to represent the group"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formData.name || !formData.slug || !formData.profession_type}
            sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
          >
            {editingGroup ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this group? This will also delete all channels and memberships. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={confirmDeleteGroup}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

