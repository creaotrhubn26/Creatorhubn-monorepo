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
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Group,
  People,
  Visibility,
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
  const [formData, setFormData] = useState({
    name:  ',',
    slug: '',
    description: '',
    icon: '📷',
    profession_type: 'photographer',
  });

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/api/community/admin/groups,', {
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
        alert(response.message);
        fetchGroups();
        handleCloseDialog();
      }
    } catch (error) {
      console.error('Error saving group:', error);
      alert('Failed to save group');
    }
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? This will also delete all channels and memberships.')) {
      return;
    }

    try {
      const response = await apiRequest(`/api/community/admin/groups/${groupId}`, {
        method: 'DELETE',
      }) as { success: boolean; message: string };

      if (response.success) {
        alert(response.message);
        fetchGroups();
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Failed to delete group');
    }
  };

  const professionTypes = [
    { value: 'photographer', label: 'Photographer', icon: '📷' },
    { value: 'videographer', label: 'Videographer', icon: '🎥' },
    { value: 'music_producer', label: 'Music Producer', icon: '🎵' },
    { value: 'cross_profession', label: 'Cross-Profession', icon: '🌟' },
  ];

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
    </Box>
  );
}

