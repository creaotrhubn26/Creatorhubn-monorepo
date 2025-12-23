/**
 * Roles and Badges Management
 * 
 * Admin interface for managing community roles and achievement badges:
 * - Create/edit/delete roles with permissions
 * - Create/edit/delete achievement badges
 * - Assign roles to users
 * - Configure badge requirements
 * - View role/badge statistics
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Stack,
  LinearProgress,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  EmojiEvents,
  Security,
  Star,
  WorkspacePremium,
  MilitaryTech,
  Psychology,
  Celebration,
  TrendingUp,
  Refresh,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { apiRequest } from '@/lib/queryClient';

// Storage keys for persistence
const STORAGE_KEYS = {
  roles: 'creatorhub_community_roles',
  badges: 'creatorhub_community_badges',
};

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  color: string;
  icon: string;
  permissions: string[];
  is_default: boolean;
  is_staff: boolean;
  priority: number;
  member_count: number;
  created_at: string;
}

interface Badge {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  color: string;
  category: 'achievement' | 'participation' | 'expertise' | 'special' | 'milestone';
  requirement_type: 'manual' | 'automatic';
  requirement_value: number;
  requirement_metric: string;
  is_active: boolean;
  awarded_count: number;
  created_at: string;
}

const ROLE_ICONS = ['🛡️', '⭐', '👑', '🎖️', '🔰', '💎', '🏆', '🎯', '🔥', '💼'];
const BADGE_ICONS = ['🏅', '🥇', '🥈', '🥉', '🏆', '⭐', '💫', '🎖️', '🎗️', '🌟', '💎', '🔥', '⚡', '🎯', '🚀'];
const BADGE_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#4CAF50', '#2196F3', '#9C27B0', '#FF5722', '#00BCD4'];

const PERMISSION_OPTIONS = [
  { value: 'read', label: 'Read Content' },
  { value: 'write', label: 'Create Posts' },
  { value: 'comment', label: 'Comment' },
  { value: 'moderate', label: 'Moderate Content' },
  { value: 'manage_users', label: 'Manage Users' },
  { value: 'manage_channels', label: 'Manage Channels' },
  { value: 'manage_settings', label: 'Manage Settings' },
  { value: 'admin', label: 'Full Admin Access' },
];

const BADGE_CATEGORIES = [
  { value: 'achievement', label: 'Achievement', icon: <EmojiEvents /> },
  { value: 'participation', label: 'Participation', icon: <Celebration /> },
  { value: 'expertise', label: 'Expertise', icon: <Psychology /> },
  { value: 'special', label: 'Special', icon: <Star /> },
  { value: 'milestone', label: 'Milestone', icon: <TrendingUp /> },
];

const REQUIREMENT_METRICS = [
  { value: 'posts_count', label: 'Number of Posts' },
  { value: 'comments_count', label: 'Number of Comments' },
  { value: 'likes_received', label: 'Likes Received' },
  { value: 'days_active', label: 'Days Active' },
  { value: 'helpful_votes', label: 'Helpful Votes' },
  { value: 'courses_completed', label: 'Courses Completed' },
  { value: 'referrals', label: 'Referrals Made' },
];

export default function RolesAndBadges() {
  const { enqueueSnackbar } = useSnackbar();
  const [tabValue, setTabValue] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Role dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    color: '#FF8C00',
    icon: '🛡️',
    permissions: [] as string[],
    is_default: false,
    is_staff: false,
    priority: 0,
  });
  
  // Badge dialog state
  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [badgeFormData, setBadgeFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    icon: '🏅',
    color: '#FFD700',
    category: 'achievement' as Badge['category'],
    requirement_type: 'manual' as Badge['requirement_type'],
    requirement_value: 0,
    requirement_metric: 'posts_count',
    is_active: true,
  });

  // Load from localStorage on mount (fallback persistence)
  const loadFromStorage = useCallback(() => {
    try {
      const storedRoles = localStorage.getItem(STORAGE_KEYS.roles);
      const storedBadges = localStorage.getItem(STORAGE_KEYS.badges);
      
      if (storedRoles) {
        const parsed = JSON.parse(storedRoles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { roles: parsed as Role[], badges: null };
        }
      }
      if (storedBadges) {
        const parsed = JSON.parse(storedBadges);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { roles: null, badges: parsed as Badge[] };
        }
      }
    } catch (error) {
      console.error('Error loading from storage:', error);
    }
    return { roles: null, badges: null };
  }, []);

  // Save to localStorage (fallback persistence)
  const saveToStorage = useCallback((type: 'roles' | 'badges', data: Role[] | Badge[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS[type], JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchBadges();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/api/community/admin/roles', {
        method: 'GET',
      }) as { success: boolean; roles: Role[] };

      if (response.success && response.roles) {
        setRoles(response.roles);
        saveToStorage('roles', response.roles);
        enqueueSnackbar('Roles loaded from database', { variant: 'success' });
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      
      const stored = loadFromStorage();
      if (stored.roles && stored.roles.length > 0) {
        setRoles(stored.roles);
        enqueueSnackbar('Loaded roles from local storage', { variant: 'info' });
        return;
      }
      
      const sampleRoles: Role[] = [
        {
          id: '1',
          name: 'admin',
          display_name: 'Administrator',
          description: 'Full access to all community features',
          color: '#FF0000',
          icon: '👑',
          permissions: ['admin'],
          is_default: false,
          is_staff: true,
          priority: 100,
          member_count: 3,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'moderator',
          display_name: 'Moderator',
          description: 'Can moderate content and manage users',
          color: '#4CAF50',
          icon: '🛡️',
          permissions: ['read', 'write', 'comment', 'moderate'],
          is_default: false,
          is_staff: true,
          priority: 50,
          member_count: 8,
          created_at: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'member',
          display_name: 'Member',
          description: 'Standard community member',
          color: '#2196F3',
          icon: '⭐',
          permissions: ['read', 'write', 'comment'],
          is_default: true,
          is_staff: false,
          priority: 10,
          member_count: 1250,
          created_at: new Date().toISOString(),
        },
      ];
      setRoles(sampleRoles);
      saveToStorage('roles', sampleRoles);
    } finally {
      setLoading(false);
    }
  };

  const fetchBadges = async () => {
    try {
      const response = await apiRequest('/api/community/admin/badges', {
        method: 'GET',
      }) as { success: boolean; badges: Badge[] };

      if (response.success && response.badges) {
        setBadges(response.badges);
        saveToStorage('badges', response.badges);
      }
    } catch (error) {
      console.error('Error fetching badges:', error);
      
      const stored = loadFromStorage();
      if (stored.badges && stored.badges.length > 0) {
        setBadges(stored.badges);
        return;
      }
      
      const sampleBadges: Badge[] = [
        {
          id: '1',
          name: 'first_post',
          display_name: 'First Post',
          description: 'Created your first community post',
          icon: '🎉',
          color: '#4CAF50',
          category: 'milestone',
          requirement_type: 'automatic',
          requirement_value: 1,
          requirement_metric: 'posts_count',
          is_active: true,
          awarded_count: 890,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'helpful_hero',
          display_name: 'Helpful Hero',
          description: 'Received 50 helpful votes on answers',
          icon: '🦸',
          color: '#2196F3',
          category: 'achievement',
          requirement_type: 'automatic',
          requirement_value: 50,
          requirement_metric: 'helpful_votes',
          is_active: true,
          awarded_count: 45,
          created_at: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'expert',
          display_name: 'Industry Expert',
          description: 'Recognized expert in the field',
          icon: '🎓',
          color: '#9C27B0',
          category: 'expertise',
          requirement_type: 'manual',
          requirement_value: 0,
          requirement_metric: 'posts_count',
          is_active: true,
          awarded_count: 12,
          created_at: new Date().toISOString(),
        },
      ];
      setBadges(sampleBadges);
      saveToStorage('badges', sampleBadges);
    }
  };

  const handleOpenRoleDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setRoleFormData({
        name: role.name,
        display_name: role.display_name,
        description: role.description,
        color: role.color,
        icon: role.icon,
        permissions: role.permissions,
        is_default: role.is_default,
        is_staff: role.is_staff,
        priority: role.priority,
      });
    } else {
      setEditingRole(null);
      setRoleFormData({
        name: '',
        display_name: '',
        description: '',
        color: '#FF8C00',
        icon: '🛡️',
        permissions: [],
        is_default: false,
        is_staff: false,
        priority: 0,
      });
    }
    setRoleDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!roleFormData.name || !roleFormData.display_name) {
      enqueueSnackbar('Please fill in required fields', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const endpoint = editingRole
        ? `/api/community/admin/roles/${editingRole.id}`
        : '/api/community/admin/roles';
      
      const response = await apiRequest(endpoint, {
        method: editingRole ? 'PUT' : 'POST',
        body: JSON.stringify(roleFormData),
      }) as { success: boolean; message: string };

      if (response.success) {
        enqueueSnackbar(response.message || 'Role saved to database', { variant: 'success' });
        setRoleDialogOpen(false);
        fetchRoles();
      }
    } catch (error) {
      console.error('Error saving role:', error);
      
      const newRole: Role = {
        id: editingRole?.id || `role_${Date.now()}`,
        ...roleFormData,
        member_count: editingRole?.member_count || 0,
        created_at: editingRole?.created_at || new Date().toISOString(),
      };

      let updatedRoles: Role[];
      if (editingRole) {
        updatedRoles = roles.map(r => r.id === editingRole.id ? newRole : r);
      } else {
        updatedRoles = [...roles, newRole];
      }

      setRoles(updatedRoles);
      saveToStorage('roles', updatedRoles);
      enqueueSnackbar(`Role ${editingRole ? 'updated' : 'created'} (saved locally)`, { variant: 'success' });
      setRoleDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;

    setSaving(true);
    try {
      const response = await apiRequest(`/api/community/admin/roles/${roleId}`, {
        method: 'DELETE',
      }) as { success: boolean; message: string };

      if (response.success) {
        enqueueSnackbar(response.message || 'Role deleted', { variant: 'success' });
        fetchRoles();
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      const updatedRoles = roles.filter(r => r.id !== roleId);
      setRoles(updatedRoles);
      saveToStorage('roles', updatedRoles);
      enqueueSnackbar('Role deleted (saved locally)', { variant: 'success' });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBadgeDialog = (badge?: Badge) => {
    if (badge) {
      setEditingBadge(badge);
      setBadgeFormData({
        name: badge.name,
        display_name: badge.display_name,
        description: badge.description,
        icon: badge.icon,
        color: badge.color,
        category: badge.category,
        requirement_type: badge.requirement_type,
        requirement_value: badge.requirement_value,
        requirement_metric: badge.requirement_metric,
        is_active: badge.is_active,
      });
    } else {
      setEditingBadge(null);
      setBadgeFormData({
        name: '',
        display_name: '',
        description: '',
        icon: '🏅',
        color: '#FFD700',
        category: 'achievement',
        requirement_type: 'manual',
        requirement_value: 0,
        requirement_metric: 'posts_count',
        is_active: true,
      });
    }
    setBadgeDialogOpen(true);
  };

  const handleSaveBadge = async () => {
    if (!badgeFormData.name || !badgeFormData.display_name) {
      enqueueSnackbar('Please fill in required fields', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const endpoint = editingBadge
        ? `/api/community/admin/badges/${editingBadge.id}`
        : '/api/community/admin/badges';
      
      const response = await apiRequest(endpoint, {
        method: editingBadge ? 'PUT' : 'POST',
        body: JSON.stringify(badgeFormData),
      }) as { success: boolean; message: string };

      if (response.success) {
        enqueueSnackbar(response.message || 'Badge saved', { variant: 'success' });
        setBadgeDialogOpen(false);
        fetchBadges();
      }
    } catch (error) {
      console.error('Error saving badge:', error);
      
      const newBadge: Badge = {
        id: editingBadge?.id || `badge_${Date.now()}`,
        ...badgeFormData,
        awarded_count: editingBadge?.awarded_count || 0,
        created_at: editingBadge?.created_at || new Date().toISOString(),
      };

      let updatedBadges: Badge[];
      if (editingBadge) {
        updatedBadges = badges.map(b => b.id === editingBadge.id ? newBadge : b);
      } else {
        updatedBadges = [...badges, newBadge];
      }

      setBadges(updatedBadges);
      saveToStorage('badges', updatedBadges);
      enqueueSnackbar(`Badge ${editingBadge ? 'updated' : 'created'} (saved locally)`, { variant: 'success' });
      setBadgeDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBadge = async (badgeId: string) => {
    if (!window.confirm('Are you sure you want to delete this badge?')) return;

    setSaving(true);
    try {
      const response = await apiRequest(`/api/community/admin/badges/${badgeId}`, {
        method: 'DELETE',
      }) as { success: boolean; message: string };

      if (response.success) {
        enqueueSnackbar(response.message || 'Badge deleted', { variant: 'success' });
        fetchBadges();
      }
    } catch (error) {
      console.error('Error deleting badge:', error);
      const updatedBadges = badges.filter(b => b.id !== badgeId);
      setBadges(updatedBadges);
      saveToStorage('badges', updatedBadges);
      enqueueSnackbar('Badge deleted (saved locally)', { variant: 'success' });
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permission: string) => {
    setRoleFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmojiEvents sx={{ color: '#FF8C00' }} /> Roles & Badges Management
        </Typography>
        <Tooltip title="Refresh Data">
          <IconButton onClick={() => { fetchRoles(); fetchBadges(); }} disabled={loading}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<Security />} label="Roles" iconPosition="start" />
          <Tab icon={<WorkspacePremium />} label="Badges" iconPosition="start" />
        </Tabs>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Roles Tab */}
      {tabValue === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenRoleDialog()}
              sx={{ bgcolor: '#FF8C00', '&:hover': { bgcolor: '#e67e00' } }}
            >
              Create Role
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Role</TableCell>
                  <TableCell>Permissions</TableCell>
                  <TableCell align="center">Priority</TableCell>
                  <TableCell align="center">Members</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar sx={{ bgcolor: role.color, width: 32, height: 32 }}>
                          {role.icon}
                        </Avatar>
                        <Box>
                          <Typography fontWeight={600}>{role.display_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {role.description}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                        {role.permissions.slice(0, 3).map((perm) => (
                          <Chip key={perm} label={perm} size="small" variant="outlined" />
                        ))}
                        {role.permissions.length > 3 && (
                          <Chip label={`+${role.permissions.length - 3}`} size="small" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="center">{role.priority}</TableCell>
                    <TableCell align="center">{role.member_count}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        {role.is_default && <Chip label="Default" size="small" color="primary" />}
                        {role.is_staff && <Chip label="Staff" size="small" color="secondary" />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenRoleDialog(role)}>
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteRole(role.id)}
                          disabled={role.is_default}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Badges Tab */}
      {tabValue === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenBadgeDialog()}
              sx={{ bgcolor: '#FF8C00', '&:hover': { bgcolor: '#e67e00' } }}
            >
              Create Badge
            </Button>
          </Box>

          <Grid container spacing={2}>
            {badges.map((badge) => (
              <Grid item xs={12} sm={6} md={4} key={badge.id}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: badge.color, width: 56, height: 56, fontSize: '1.5rem' }}>
                          {badge.icon}
                        </Avatar>
                        <Box>
                          <Typography variant="h6">{badge.display_name}</Typography>
                          <Chip label={badge.category} size="small" sx={{ textTransform: 'capitalize' }} />
                        </Box>
                      </Stack>
                      <Stack direction="row">
                        <IconButton size="small" onClick={() => handleOpenBadgeDialog(badge)}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteBadge(badge.id)}>
                          <Delete />
                        </IconButton>
                      </Stack>
                    </Stack>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      {badge.description}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <MilitaryTech fontSize="small" color="action" />
                        <Typography variant="body2">{badge.awarded_count} awarded</Typography>
                      </Stack>
                      <Chip
                        label={badge.requirement_type === 'automatic' ? 'Auto' : 'Manual'}
                        size="small"
                        color={badge.requirement_type === 'automatic' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Stack>

                    {badge.requirement_type === 'automatic' && (
                      <Alert severity="info" sx={{ mt: 2 }} icon={<TrendingUp />}>
                        Requires {badge.requirement_value} {badge.requirement_metric.replace('_', ' ')}
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Role Name (internal)"
              value={roleFormData.name}
              onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value.toLowerCase().replace(/\s/g, '_') })}
              fullWidth
              helperText="Lowercase, no spaces"
            />
            <TextField
              label="Display Name"
              value={roleFormData.display_name}
              onChange={(e) => setRoleFormData({ ...roleFormData, display_name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Description"
              value={roleFormData.description}
              onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />

            <Stack direction="row" spacing={2}>
              <TextField
                label="Icon"
                value={roleFormData.icon}
                onChange={(e) => setRoleFormData({ ...roleFormData, icon: e.target.value })}
                select
                sx={{ width: 120 }}
              >
                {ROLE_ICONS.map((icon) => (
                  <MenuItem key={icon} value={icon}>{icon}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Color"
                value={roleFormData.color}
                onChange={(e) => setRoleFormData({ ...roleFormData, color: e.target.value })}
                type="color"
                sx={{ width: 120 }}
              />
              <TextField
                label="Priority"
                value={roleFormData.priority}
                onChange={(e) => setRoleFormData({ ...roleFormData, priority: Number(e.target.value) })}
                type="number"
                sx={{ flex: 1 }}
              />
            </Stack>

            <Typography variant="subtitle2">Permissions</Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {PERMISSION_OPTIONS.map((perm) => (
                <Chip
                  key={perm.value}
                  label={perm.label}
                  onClick={() => togglePermission(perm.value)}
                  color={roleFormData.permissions.includes(perm.value) ? 'primary' : 'default'}
                  variant={roleFormData.permissions.includes(perm.value) ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>

            <Stack direction="row" spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={roleFormData.is_default}
                    onChange={(e) => setRoleFormData({ ...roleFormData, is_default: e.target.checked })}
                  />
                }
                label="Default Role"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={roleFormData.is_staff}
                    onChange={(e) => setRoleFormData({ ...roleFormData, is_staff: e.target.checked })}
                  />
                }
                label="Staff Role"
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveRole}
            disabled={saving}
            sx={{ bgcolor: '#FF8C00', '&:hover': { bgcolor: '#e67e00' } }}
          >
            {saving ? 'Saving...' : (editingRole ? 'Update Role' : 'Create Role')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Badge Dialog */}
      <Dialog open={badgeDialogOpen} onClose={() => setBadgeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingBadge ? 'Edit Badge' : 'Create New Badge'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Badge Name (internal)"
              value={badgeFormData.name}
              onChange={(e) => setBadgeFormData({ ...badgeFormData, name: e.target.value.toLowerCase().replace(/\s/g, '_') })}
              fullWidth
              helperText="Lowercase, no spaces"
            />
            <TextField
              label="Display Name"
              value={badgeFormData.display_name}
              onChange={(e) => setBadgeFormData({ ...badgeFormData, display_name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Description"
              value={badgeFormData.description}
              onChange={(e) => setBadgeFormData({ ...badgeFormData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />

            <Stack direction="row" spacing={2}>
              <TextField
                label="Icon"
                value={badgeFormData.icon}
                onChange={(e) => setBadgeFormData({ ...badgeFormData, icon: e.target.value })}
                select
                sx={{ width: 120 }}
              >
                {BADGE_ICONS.map((icon) => (
                  <MenuItem key={icon} value={icon}>{icon}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Color"
                value={badgeFormData.color}
                onChange={(e) => setBadgeFormData({ ...badgeFormData, color: e.target.value })}
                select
                sx={{ width: 120 }}
              >
                {BADGE_COLORS.map((color) => (
                  <MenuItem key={color} value={color}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 16, height: 16, bgcolor: color, borderRadius: '50%' }} />
                      {color}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Category"
                value={badgeFormData.category}
                onChange={(e) => setBadgeFormData({ ...badgeFormData, category: e.target.value as Badge['category'] })}
                select
                sx={{ flex: 1 }}
              >
                {BADGE_CATEGORIES.map((cat) => (
                  <MenuItem key={cat.value} value={cat.value}>{cat.label}</MenuItem>
                ))}
              </TextField>
            </Stack>

            <TextField
              label="Requirement Type"
              value={badgeFormData.requirement_type}
              onChange={(e) => setBadgeFormData({ ...badgeFormData, requirement_type: e.target.value as Badge['requirement_type'] })}
              select
              fullWidth
            >
              <MenuItem value="manual">Manual (Admin assigns)</MenuItem>
              <MenuItem value="automatic">Automatic (Based on metrics)</MenuItem>
            </TextField>

            {badgeFormData.requirement_type === 'automatic' && (
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Metric"
                  value={badgeFormData.requirement_metric}
                  onChange={(e) => setBadgeFormData({ ...badgeFormData, requirement_metric: e.target.value })}
                  select
                  sx={{ flex: 2 }}
                >
                  {REQUIREMENT_METRICS.map((metric) => (
                    <MenuItem key={metric.value} value={metric.value}>{metric.label}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Required Value"
                  value={badgeFormData.requirement_value}
                  onChange={(e) => setBadgeFormData({ ...badgeFormData, requirement_value: Number(e.target.value) })}
                  type="number"
                  sx={{ flex: 1 }}
                />
              </Stack>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={badgeFormData.is_active}
                  onChange={(e) => setBadgeFormData({ ...badgeFormData, is_active: e.target.checked })}
                />
              }
              label="Badge Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBadgeDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveBadge}
            disabled={saving}
            sx={{ bgcolor: '#FF8C00', '&:hover': { bgcolor: '#e67e00' } }}
          >
            {saving ? 'Saving...' : (editingBadge ? 'Update Badge' : 'Create Badge')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
