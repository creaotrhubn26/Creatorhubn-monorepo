import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Radio,
  RadioGroup,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  level: 'read' | 'write' | 'admin' | 'owner';
  granted: boolean
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  color: string;
  isSystem: boolean
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  roles: Role[];
  lastActive: Date;
  status: 'active' | 'inactive' | 'suspended'
}

interface AccessControlProps {
  className?: string;
  onPermissionChange?: (permission: Permission) => void;
  onRoleChange?: (role: Role) => void;
  onUserChange?: (user: User) => void;
  onAccessExport?: (data: { roles: Role[], users: User[, ],}) => void;
}

// Mock data
const defaultRoles: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access',
    color: '#f44330',
    isSystem: true,
    permissions: [
      {
        id: 'admin-read',
        name: 'Read All',
        description: 'Read access to all resources',
        resource: ', *',
        action: 'read',
        level: 'admin',
        granted: true
  },
      {
        id: 'admin-write',
        name: 'Write All',
        description: 'Write access to all resources',
        resource: ', *',
        action: 'write',
        level: 'admin',
        granted: true
  },
      {
        id: 'admin-delete',
        name: 'Delete All',
        description: 'Delete access to all resources',
        resource: ', *',
        action: 'delete',
        level: 'admin',
        granted: true
  }
    ]
},
  {
    id: 'editor',
    name: 'Editor',
    description: 'Content editing and management',
    color: '#2196f0',
    isSystem: false,
    permissions: [
      {
        id: 'editor-read',
        name: 'Read Content',
        description: 'Read access to content',
        resource: 'content',
        action: 'read',
        level: 'read',
        granted: true
  },
      {
        id: 'editor-write',
        name: 'Edit Content',
        description: 'Edit access to content',
        resource: 'content',
        action: 'write',
        level: 'write',
        granted: true
  }
    ]
},
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    color: '#4caf50',
    isSystem: false,
    permissions: [
      {
        id: 'viewer-read',
        name: 'Read Only',
        description: 'Read-only access to content',
        resource: 'content',
        action: 'read',
        level: 'read',
        granted: true
  }
    ]
}
];

const defaultUsers: User[] = [
  {
    id: 'user',
    name: 'John Doe',
    email: 'john@example.com',
    roles: [defaultRoles[0]],
    lastActive: new Date('2024-01-15', ),
    status: 'active'
},
  {
    id: 'user',
    name: 'Jane Smith',
    email: 'jane@example.com',
    roles: [defaultRoles[1]],
    lastActive: new Date('2024-01-14,', ),
    status: 'active'
},
  {
    id: 'user',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    roles: [defaultRoles[2]],
    lastActive: new Date('2024-01-13', ),
    status: 'inactive'
}
];

const AccessControl: React.FC<AccessControlProps> = ({
  className =', ',
  onPermissionChange,
  onRoleChange,
  onUserChange,
  onAccessExport
}) => {
  // State
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleEditor, setShowRoleEditor] = useState(false);
  const [showUserEditor, setShowUserEditor] = useState(false);
  const [roles, setRoles] = useState<Role[]>(defaultRoles);
  const [users, setUsers] = useState<User[]>(defaultUsers);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);

  // Handlers
  const handleRoleSelect = useCallback((role: Role) => {
    setSelectedRole(role);
    onRoleChange?.(role);
}, [onRoleChange]);

  const handleUserSelect = useCallback((user: User) => {
    setSelectedUser(user);
    onUserChange?.(user);
}, [onUserChange]);

  const handleRoleEdit = useCallback((role: Role) => {
    setSelectedRole(role);
    setShowRoleEditor(true);
}, []);

  const handleUserEdit = useCallback((user: User) => {
    setSelectedUser(user);
    setShowUserEditor(true);
}, []);

  const handleRoleSave = useCallback(() => {
    if (selectedRole) {
      const existingIndex = roles.findIndex(r => r.id === selectedRole.id);
      if (existingIndex >= 0) {
        setRoles(prev => prev.map((r, i) => i === existingIndex ? selectedRole : r));
    } else {
        setRoles(prev => [...prev, selectedRole]);
    }
      setShowRoleEditor(false);
  }
}, [selectedRole, roles]);

  const handleUserSave = useCallback(() => {
    if (selectedUser) {
      const existingIndex = users.findIndex(u => u.id === selectedUser.id);
      if (existingIndex >= 0) {
        setUsers(prev => prev.map((u, i) => i === existingIndex ? selectedUser : u));
    } else {
        setUsers(prev => [...prev, selectedUser]);
    }
      setShowUserEditor(false);
  }
}, [selectedUser, users]);

  const handlePermissionToggle = useCallback((permissionId: string, granted: boolean) => {
    setRoles(prev => prev.map(role => ({
      ...role,
      permissions: role.permissions.map(p => 
        p.id === permissionId ? { .., .granted } : p
      )
  })));
}, []);

  const handleAccessExport = useCallback(() => {
    onAccessExport?.({ roles, users });
}, [roles, users, onAccessExport]);

  const getRoleIcon = useCallback((roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'administrator': return <CREATOR_HUB_ICONS.admin />;
      case 'editor': return <CREATOR_HUB_ICONS.edit />;
      case 'viewer': return <CREATOR_HUB_ICONS.visibility />;
      default: return <CREATOR_HUB_ICONS.group />;
}
}, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'active': return <CREATOR_HUB_ICONS.checkCircle />;
      case 'inactive': return <CREATOR_HUB_ICONS.pause />;
      case 'suspended': return <CREATOR_HUB_ICONS.warning />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'suspended': return 'error';
      default: return 'default';
}
}, []);

  // Memoized data
  const roleStats = useMemo(() => {
    const totalRoles = roles.length;
    const systemRoles = roles.filter(r => r.isSystem).length;
    const customRoles = totalRoles - systemRoles;
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    
    return { totalRoles, systemRoles, customRoles, totalUsers, activeUsers };
}, [roles, users]);

  const recentActivity = useMemo(() => {
    return [
      { id: 1, action: 'Role created', user: 'John Doe', timestamp: new Date(), type: 'role',},
      { id: 2, action: 'Permission granted', user: 'Jane Smith', timestamp: new Date(), type: 'permission',},
      { id:  3, action: 'User suspended', user: 'Bob Johnson', timestamp: new Date(), type: 'user',},
    ];
}, []);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.security sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Access Control</Typography>
              <Typography variant="body2" color="text.secondary">
                User roles, permissions, and access management
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.add />}
              onClick={() => {
                setSelectedRole({
                  id: `role-${Date.now()}`,
                  name: 'New Role',
                  description: 'Custom role',
                  permissions:  [],
                  color: '#1976d0',
                  isSystem: false
            });
                setShowRoleEditor(true);
            }}
            >
              New Role
            </Button>
            <Button variant="contained"
              startIcon={<CREATOR_HUB_ICONS.download sx={theming.getThemedButtonSx()} />}
              onClick={handleAccessExport}
            >
              Export
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.group sx={{ fontSize:  40, color: 'primary.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{roleStats.totalRoles}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Roles</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.settings sx={{ fontSize:  40, color: 'secondary.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{roleStats.customRoles}</Typography>
                  <Typography variant="body2" color="text.secondary">Custom Roles</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.accountCircle sx={{ fontSize:  40, color: 'success.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{roleStats.totalUsers}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Users</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.checkCircle sx={{ fontSize:  40, color: 'success.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{roleStats.activeUsers}</Typography>
                  <Typography variant="body2" color="text.secondary">Active Users</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
        <Tab label="Roles" icon={<CREATOR_HUB_ICONS.group />} />
        <Tab label="Users" icon={<CREATOR_HUB_ICONS.accountCircle />} />
        <Tab label="Permissions" icon={<CREATOR_HUB_ICONS.security />} />
        <Tab label="Activity" icon={<CREATOR_HUB_ICONS.history />} />
      </Tabs>

      {/* Roles Tab */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {roles.map((role) => (
            <Grid item xs={12} sm={6} md={4} key={role.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { elevation:  4 },
                  transition: 'all 0.2',
                  border: selectedRole?.id === role.id ? 2 : 0,
                  borderColor: selectedRole?.id === role.id ? 'primary.main' : 'transparent'
            }}
                onClick={() => handleRoleSelect(role)} sx={theming.getThemedCardSx()}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box sx={{ color: role.color }}>
                      {getRoleIcon(role.name)}
                    </Box>
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {role.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {role.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                        <Chip 
                          label={`${role.permissions.length} permissions`}
                          size="small" 
                          color="primary"
                        />
                        {role.isSystem && (
                          <Chip 
                            label="System" 
                            size="small" 
                            color="secondary"
                          />
                        )}
                      </Stack>
                      
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CREATOR_HUB_ICONS.edit />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRoleEdit(role);
                        }}
                        >
                          Edit
                        </Button>
                        {!role.isSystem && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<CREATOR_HUB_ICONS.delete />}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoles(prev => prev.filter(r => r.id !== role.id));
                          }}
                          >
                            Delete
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Users Tab */}
      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Roles</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Active</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar src={user.avatar}>
                        {user.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">{user.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {user.email}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {user.roles.map((role) => (
                        <Chip
                          key={role.id}
                          label={role.name}
                          size="small"
                          sx={{ backgroundColor: role.color, color: 'white'}}
                        />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(user.status)}
                      label={user.status}
                      color={getStatusColor(user.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {user.lastActive.toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <IconButton
                        size="small"
                        onClick={() => handleUserEdit(user)}
                      >
                        <CREATOR_HUB_ICONS.edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setUsers(prev => prev.filter(u => u.id !== user.id))}
                      >
                        <CREATOR_HUB_ICONS.delete />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Permissions Tab */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Permission Matrix
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Permission</TableCell>
                  <TableCell>Resource</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.flatMap(role => role.permissions).map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {permission.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {permission.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={permission.resource} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={permission.action} size="small" color="primary" />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={permission.level}
                        size="small" 
                        color={permission.level === 'admin' ? 'error' : permission.level === 'write' ? 'warning' : 'success'}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={permission.granted}
                        onChange={(e) => handlePermissionToggle(permission.id, e.target.checked)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Activity Tab */}
      {activeTab === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Recent Activity
          </Typography>
          <List>
            {recentActivity.map((activity) => (
              <ListItem key={activity.id}>
                <ListItemIcon>
                  <CREATOR_HUB_ICONS.history />
                </ListItemIcon>
                <ListItemText
                  primary={activity.action}
                  secondary={`${activity.user} • ${activity.timestamp.toLocaleString()}`}
                />
                <Chip 
                  label={activity.type}
                  size="small" 
                  color="primary"
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Role Editor Dialog */}
      <Dialog open={showRoleEditor} onClose={() => setShowRoleEditor(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.settings />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedRole?.id.startsWith('role-') ? 'Create Role' : 'Edit Role'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedRole && (
            <Stack spacing={3} sx={{ mt:  2 }}>
              <TextField
                label="Role Name"
                value={selectedRole.name}
                onChange={(e) => setSelectedRole(prev => prev ? { ...prev, name: e.target.value } : null)}
                fullWidth
              />
              <TextField
                label="Description"
                value={selectedRole.description}
                onChange={(e) => setSelectedRole(prev => prev ? { ...prev, description: e.target.value } : null)}
                fullWidth
                multiline
                rows={2}
              />
              <FormControl fullWidth>
                <InputLabel>Color</InputLabel>
                <Select
                  value={selectedRole.color}
                  onChange={(e) => setSelectedRole(prev => prev ? { ...prev, color: e.target.value } : null)}
                >
                  <MenuItem value="#f44336">Red</MenuItem>
                  <MenuItem value="#2196f3">Blue</MenuItem>
                  <MenuItem value="#4caf50">Green</MenuItem>
                  <MenuItem value="#ff9800">Orange</MenuItem>
                  <MenuItem value="#9c27b0">Purple</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRoleEditor(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={handleRoleSave}
           sx={theming.getThemedButtonSx()}>
            {selectedRole?.id.startsWith('role-') ? 'Create' : 'Update'} Role
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Editor Dialog */}
      <Dialog open={showUserEditor} onClose={() => setShowUserEditor(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.accountCircle />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedUser?.id.startsWith('user-') ? 'Create User' : 'Edit User'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Stack spacing={3} sx={{ mt:  2 }}>
              <TextField
                label="Name"
                value={selectedUser.name}
                onChange={(e) => setSelectedUser(prev => prev ? { ...prev, name: e.target.value } : null)}
                fullWidth
              />
              <TextField
                label="Email"
                value={selectedUser.email}
                onChange={(e) => setSelectedUser(prev => prev ? { ...prev, email: e.target.value } : null)}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={selectedUser.status}
                  onChange={(e) => setSelectedUser(prev => prev ? { ...prev, status: e.target.value as any } : null)}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUserEditor(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={handleUserSave}
           sx={theming.getThemedButtonSx()}>
            {selectedUser?.id.startsWith('user-') ? 'Create' : 'Update'} User
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccessControl;

