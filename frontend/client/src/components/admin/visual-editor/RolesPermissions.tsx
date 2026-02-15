/**
 * Roles & Permissions System
 * Admin, editor, reviewer, developer role management with granular permissions
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Avatar,
  Chip,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Alert,
  Paper,
  Stack,
  Tooltip,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox
} from '@mui/material';
import {
  AdminPanelSettings,
  Edit,
  Security,
  Person,
  Engineering
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';

// Types for roles and permissions
interface Role {
  id: string;
  name: string;
  description: string;
  level: number; // 1, -higher number = more permissions
  permissions: Permission[];
  users: string[];
  isSystem: boolean;
  createdAt: Date;
  createdBy: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'content' | 'design' | 'publishing' | 'admin' | 'development' | 'collaboration';
  resource: string;
  action: string;
  conditions?: PermissionCondition[];
}

interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in';
  value: unknown;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  roles: string[];
  permissions: string[];
  lastActive: Date;
  status: 'active' | 'inactive' | 'pending';
}

interface RolesPermissionsProps {
  onRoleUpdate: (roles: Role[]) => void;
  onUserUpdate: (users: User[]) => void;
}

export const RolesPermissions: React.FC<RolesPermissionsProps> = ({
  onRoleUpdate,
  onUserUpdate
}) => {
  const { analytics, lifecycle, performance, debugging } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  const [activeTab, setActiveTab] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<Partial<Role>>({});

  // Component registration
  useEffect(() => {
    lifecycle.registerComponent({
      id: 'roles-permissions',
      type: 'admin',
      version: '1.0.0',
      capabilities: {
        data: ['roles', 'users', 'permissions'],
        events: ['role:created', 'role:updated', 'role:deleted', 'user:updated'],
        actions: ['role:create', 'role:update', 'role:delete', 'user:manage', 'permission:assign', 'permission:check'],
        ui: ['admin-panel', 'role-management', 'user-management'],
        system: ['authentication', 'authorization']
      },
      dependencies: ['auth','database'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime:  0,
        memoryUsage: 0 }
  });

    // Initialize default roles and permissions
    initializeDefaultRoles();
    initializeDefaultPermissions();

    analytics.trackEvent('roles_permissions_mounted', {
      rolesCount: roles.length,
      usersCount: users.length,
      permissionsCount: permissions.length,
      timestamp: Date.now()
});

    return () => {
      lifecycle.unregisterComponent('roles-permissions');
      analytics.trackEvent('roles_permissions_unmounted', {
        timestamp: Date.now()
  });
  };
}, [lifecycle, analytics, roles.length, users.length, permissions.length]);

  // Initialize default system roles
  const initializeDefaultRoles = useCallback(() => {
    const defaultRoles: Role[] = [
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access and control',
        level:  4,
        permissions:  [], // Will be populated with all permissions
        users:  [],
        isSystem: true,
        createdAt: new Date(),
        createdBy: 'system'
  },
      {
        id: 'developer',
        name: 'Developer',
        description: 'Technical development and code management',
        level:  3,
        permissions:  [],
        users:  [],
        isSystem: true,
        createdAt: new Date(),
        createdBy: 'system'
  },
      {
        id: 'editor',
        name: 'Editor',
        description: 'Content creation and editing',
        level:  2,
        permissions:  [],
        users:  [],
        isSystem: true,
        createdAt: new Date(),
        createdBy: 'system'
  },
      {
        id: 'reviewer',
        name: 'Reviewer',
        description: 'Content review and approval',
        level:  2,
        permissions:  [],
        users:  [],
        isSystem: true,
        createdAt: new Date(),
        createdBy: 'system'
  }
    ];

    setRoles(defaultRoles);
    onRoleUpdate(defaultRoles);
}, [onRoleUpdate]);

  // Initialize default permissions
  const initializeDefaultPermissions = useCallback(() => {
    const defaultPermissions: Permission[] = [
      // Content permissions
      {
        id: 'content.create',
        name: 'Create Content',
        description: 'Create new content blocks',
        category: 'content',
        resource: 'content',
        action: 'create'
  },
      {
        id: 'content.read',
        name: 'Read Content',
        description: 'View and read content',
        category: 'content',
        resource: 'content',
        action: 'read'
  },
      {
        id: 'content.update',
        name: 'Update Content',
        description: 'Edit existing content',
        category: 'content',
        resource: 'content',
        action: 'update'
  },
      {
        id: 'content.delete',
        name: 'Delete Content',
        description: 'Delete content blocks',
        category: 'content',
        resource: 'content',
        action: 'delete'
  },
      
      // Design permissions
      {
        id: 'design.create',
        name: 'Create Designs',
        description: 'Create visual designs',
        category: 'design',
        resource: 'design',
        action: 'create'
  },
      {
        id: 'design.update',
        name: 'Update Designs',
        description: 'Edit visual designs',
        category: 'design',
        resource: 'design',
        action: 'update'
  },
      {
        id: 'design.publish',
        name: 'Publish Designs',
        description: 'Publish designs to production',
        category: 'design',
        resource: 'design',
        action: 'publish'
  },
      
      // Publishing permissions
      {
        id: 'publish.draft',
        name: 'Create Drafts',
        description: 'Create draft versions',
        category: 'publishing',
        resource: 'publish',
        action: 'draft'
  },
      {
        id: 'publish.preview',
        name: 'Publish to Preview',
        description: 'Deploy to preview environment',
        category: 'publishing',
        resource: 'publish',
        action: 'preview'
  },
      {
        id: 'publish.production',
        name: 'Publish to Production',
        description: 'Deploy to production environment',
        category: 'publishing',
        resource: 'publish',
        action: 'production'
  },
      
      // Admin permissions
      {
        id: 'admin.users',
        name: 'Manage Users',
        description: 'Create, update, and delete users',
        category: 'admin',
        resource: 'users',
        action: 'manage'
  },
      {
        id: 'admin.roles',
        name: 'Manage Roles',
        description: 'Create, update, and delete roles',
        category: 'admin',
        resource: 'roles',
        action: 'manage'
  },
      {
        id: 'admin.system',
        name: 'System Administration',
        description: 'System configuration and settings',
        category: 'admin',
        resource: 'system',
        action: 'admin'
  },
      
      // Development permissions
      {
        id: 'dev.code',
        name: 'Code Access',
        description: 'Access to code generation and sync',
        category: 'development',
        resource: 'code',
        action: 'access'
  },
      {
        id: 'dev.git',
        name: 'Git Operations',
        description: 'Git branch, commit, and merge operations',
        category: 'development',
        resource: 'git',
        action: 'operate'
  },
      {
        id: 'dev.deploy',
        name: 'Deployment',
        description: 'Deploy applications and manage environments',
        category: 'development',
        resource: 'deploy',
        action: 'manage'
  },
      
      // Collaboration permissions
      {
        id: 'collab.comment',
        name: 'Add Comments',
        description: 'Add comments and feedback',
        category: 'collaboration',
        resource: 'comments',
        action: 'create'
  },
      {
        id: 'collab.review',
        name: 'Review Content',
        description: 'Review and approve content',
        category: 'collaboration',
        resource: 'reviews',
        action: 'create'
  },
      {
        id: 'collab.share',
        name: 'Share Projects',
        description: 'Share projects with team members',
        category: 'collaboration',
        resource: 'projects',
        action: 'share'
  }
    ];

    setPermissions(defaultPermissions);
    
    // Get current roles and assign permissions
    const currentRoles = roles.length > 0 ? roles : [
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access and control',
        level:  4,
        permissions:  [],
        users:  [],
        isSystem: true,
        createdAt: new Date(),
        createdBy: 'system'
  },
      {
        id: 'developer',
        name: 'Developer',
        description: 'Technical development and code management',
        level:  3,
        permissions:  [],
        users:  [],
        isSystem: true,
        createdAt: new Date(),
        createdBy: 'system'
  },
      {
        id: 'editor',
        name: 'Editor',
        description: 'Content creation and editing',
        level:  2,
        permissions:  [],
        users:  [],
        isSystem: true,
        createdAt: new Date(),
        createdBy: 'system'
  },
      {
        id: 'reviewer',
        name: 'Reviewer',
        description: 'Content review and approval',
        level:  2,
        permissions:  [],
        users:  [],
        isSystem: true,
        createdAt: new Date(),
        createdBy: 'system'
  }
    ];
    
    // Assign permissions to roles based on their level
    assignPermissionsToRoles(currentRoles, defaultPermissions);
}, []);

  const assignPermissionsToRoles = useCallback((rolesToUpdate: Role[], permissions: Permission[]) => {
    const updatedRoles = rolesToUpdate.map(role => {
      let rolePermissions: Permission[] = [];
      
      switch (role.level) {
        case 4: // Admin - all permissions
          rolePermissions = [...permissions];
          break;
        case 3: // Developer - development, design, publishing, collaboration
          rolePermissions = permissions.filter(p => 
            ['development','design','publishing','collaboration'].includes(p.category)
          );
          break;
        case 2: // Editor/Reviewer - content, design (limited), collaboration
          rolePermissions = permissions.filter(p => 
            p.category === 'content' || 
            p.category === 'collaboration' ||
            (p.category === 'design' && p.action !== 'publish')
          );
          break;
        case 1: // Basic user - content (read), collaboration (limited)
          rolePermissions = permissions.filter(p => 
            (p.category === 'content' && p.action === 'read') ||
            (p.category === 'collaboration' && p.action === 'comment')
          );
          break;
    }
      
      return { ...role, permissions: rolePermissions };
  });
    
    setRoles(updatedRoles);
    onRoleUpdate(updatedRoles);
}, [onRoleUpdate]);

  // Role management functions
  const createRole = useCallback((roleData: Partial<Role>) => {
    const endTiming = performance.startTiming('role_create');
    
    const newRole: Role = {
      id: `role_${Date.now()}`,
      name: roleData.name || 'New Role',
      description: roleData.description || '',
      level: roleData.level || 1,
      permissions: roleData.permissions || [],
      users:  [],
      isSystem: false,
      createdAt: new Date(),
      createdBy: 'current-user'
};

    setRoles(prev => [...prev, newRole]);
    onRoleUpdate([...roles, newRole]);
    
    analytics.trackEvent('role_created', {
      roleId: newRole.id,
      roleName: newRole.name,
      level: newRole.level,
      timestamp: Date.now()
});
    
    endTiming();
}, [roles, onRoleUpdate, performance, analytics]);

  const updateRole = useCallback((roleId: string, updates: Partial<Role>) => {
    const endTiming = performance.startTiming('role_update');
    
    setRoles(prev => {
      const updated = prev.map(role => 
        role.id === roleId ? { ...role, ...updates } : role
      );
      onRoleUpdate(updated);
      return updated;
  });
    
    analytics.trackEvent('role_updated', {
      roleId,
      timestamp: Date.now()
});
    
    endTiming();
}, [onRoleUpdate, performance, analytics]);

  const deleteRole = useCallback((roleId: string) => {
    const endTiming = performance.startTiming('role_delete');
    
    setRoles(prev => {
      const filtered = prev.filter(role => role.id !== roleId);
      onRoleUpdate(filtered);
      return filtered;
});
    
    analytics.trackEvent('role_deleted', {
      roleId,
      timestamp: Date.now()
});
    
    endTiming();
}, [onRoleUpdate, performance, analytics]);

  // User management functions
  const assignRoleToUser = useCallback((userId: string, roleId: string) => {
    const endTiming = performance.startTiming('user_role_assign');
    
    setUsers(prev => {
      const updated = prev.map(user => {
        if (user.id === userId) {
          const updatedRoles = user.roles.includes(roleId) 
            ? user.roles 
            : [...user.roles, roleId];
          
          // Get permissions from roles
          const userRoles = roles.filter(role => updatedRoles.includes(role.id));
          const userPermissions = userRoles.flatMap(role => role.permissions.map(p => p.id));
          
          return { ...user, roles: updatedRoles, permissions: userPermissions };
      }
        return user;
    });
      onUserUpdate(updated);
      return updated;
  });
    
    analytics.trackEvent('user_role_assigned', {
      userId,
      roleId,
      timestamp: Date.now()
});
    
    endTiming();
}, [roles, onUserUpdate, performance, analytics]);

  const removeRoleFromUser = useCallback((userId: string, roleId: string) => {
    const endTiming = performance.startTiming('user_role_remove');
    
    setUsers(prev => {
      const updated = prev.map(user => {
        if (user.id === userId) {
          const updatedRoles = user.roles.filter(id => id !== roleId);
          
          // Recalculate permissions
          const userRoles = roles.filter(role => updatedRoles.includes(role.id));
          const userPermissions = userRoles.flatMap(role => role.permissions.map(p => p.id));
          
          return { ...user, roles: updatedRoles, permissions: userPermissions };
      }
        return user;
    });
      onUserUpdate(updated);
      return updated;
  });
    
    analytics.trackEvent('user_role_removed', {
      userId,
      roleId,
      timestamp: Date.now()
});
    
    endTiming();
}, [roles, onUserUpdate, performance, analytics]);

  // Permission checking
  const hasPermission = useCallback((userId: string, permissionId: string): boolean => {
    const user = users.find(u => u.id === userId);
    if (!user) return false;
    
    return user.permissions.includes(permissionId);
}, [users]);

  const hasRole = useCallback((userId: string, roleId: string): boolean => {
    const user = users.find(u => u.id === userId);
    if (!user) return false;
    
    return user.roles.includes(roleId);
}, [users]);

  // Render functions
  const renderRoles = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Roles</Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => setShowRoleDialog(true)}
        >
          Create Role
        </Button>
      </Box>

      <List>
        {roles.map((role) => (
          <ListItem key={role.id} divider>
            <ListItemIcon>
              <Avatar sx={{ bgcolor: getRoleColor(role.level, )}}>
                {getRoleIcon(role.level)}
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                  {role.name}
                  {role.isSystem && <Chip size="small" label="System" color="primary" />}
                  <Chip size="small" label={`Level ${role.level}`} variant="outlined" />
                </Box>
            }
              secondary={
                <Box>
                  <Typography variant="body2">{role.description}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5}}>
                    <Chip size="small" label={`${role.permissions.length} permissions`} />
                    <Chip size="small" label={`${role.users.length} users`} />
                  </Box>
                </Box>
            }
            />
            <ListItemSecondaryAction>
              <IconButton onClick={() => setSelectedRole(role)}>
                {theming.getThemedIcon('edit')}
              </IconButton>
              {!role.isSystem && (
                <IconButton onClick={() => deleteRole(role.id)}>
                  {theming.getThemedIcon('delete')}
                </IconButton>
              )}
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  const renderUsers = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Users</Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => setShowUserDialog(true)}
        >
          Add User
        </Button>
      </Box>

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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                    <Avatar src={user.avatar} sx={{ width:  32, height: 32}}>
                      {user.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2">{user.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.email}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {user.roles.map(roleId => {
                      const role = roles.find(r => r.id === roleId);
                      return role ? (
                        <Chip key={roleId} size="small" label={role.name} />
                      ) : null;
                  })}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip 
                    size="small" 
                    label={user.status} 
                    color={getStatusColor(user.status)}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {user.lastActive.toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => setSelectedUser(user)}>
                    {theming.getThemedIcon('edit')}
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderPermissions = () => (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Permissions
      </Typography>
      
      {['content', 'design', 'publishing', 'admin', 'development','collaboration'].map(category => (
        <Accordion key={category}>
          <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
            <Typography variant="subtitle1" sx={{ textTransform: 'capitalize'}}>
              {category} Permissions
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              {permissions.filter(p => p.category === category).map((permission) => (
                <ListItem key={permission.id}>
                  <ListItemText
                    primary={permission.name}
                    secondary={permission.description}
                  />
                  <ListItemSecondaryAction>
                    <Chip size="small" label={permission.action} variant="outlined" />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );

  // Helper functions
  const getRoleColor = (level: number) => {
    const colors = {
      1: '#757575',
      2: '#2196f3',
      3: '#ff9800',
      4: '#f44336'
    };
    return colors[level as keyof typeof colors] || '#757575';
  };

  const getRoleIcon = (level: number) => {
    const icons = {
      1: <Person />,
      2: <Edit />,
      3: <Engineering />,
      4: <AdminPanelSettings />
    };
    return icons[level as keyof typeof icons] || <Person />;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning'> = {
      active: 'success',
      inactive: 'default',
      pending: 'warning'
};
    return colors[status] || 'default';
};

  return (
    <Card sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap: 1, mb: 2  }}>
          <Security color="primary" />
          Roles & Permissions
        </Typography>

        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
          <Tab label="Roles" />
          <Tab label="Users" />
          <Tab label="Permissions" />
        </Tabs>

        {activeTab === 0 && renderRoles()}
        {activeTab === 1 && renderUsers()}
        {activeTab === 2 && renderPermissions()}

        {/* Role Creation Dialog */}
        <Dialog open={showRoleDialog} onClose={() => setShowRoleDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create New Role</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap:  2 }}>
              <TextField
                fullWidth
                label="Role Name"
                value={editingRole.name || ''}
                onChange={(e) => setEditingRole(prev => ({ ...prev, name: e.target.value }))}
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={editingRole.description || ''}
                onChange={(e) => setEditingRole(prev => ({ ...prev, description: e.target.value }))}
              />
              <FormControl fullWidth>
                <InputLabel>Permission Level</InputLabel>
                <Select
                  value={editingRole.level || 1}
                  onChange={(e) => setEditingRole(prev => ({ ...prev, level: Number(e.target.value, ),}))}
                >
                  <MenuItem value={1}>Level 1 - Basic User</MenuItem>
                  <MenuItem value={2}>Level 2 - Editor/Reviewer</MenuItem>
                  <MenuItem value={3}>Level 3 - Developer</MenuItem>
                  <MenuItem value={4}>Level 4 - Administrator</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowRoleDialog(false)}>Cancel</Button>
            <Button variant="contained" 
              onClick={() => {
                createRole(editingRole);
                setEditingRole({});
                setShowRoleDialog(false);
            }}
            >
              Create Role
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default RolesPermissions;
