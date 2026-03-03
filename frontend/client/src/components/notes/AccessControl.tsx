import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  AdminPanelSettings,
  AssignmentInd,
  Download,
  Edit,
  Group,
  History,
  Security,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  level: 'read' | 'write' | 'admin' | 'owner';
  granted: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  color: string;
  isSystem: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  roles: Role[];
  lastActive: Date;
  status: 'active' | 'inactive' | 'suspended';
}

interface AccessControlProps {
  className?: string;
  onPermissionChange?: (permission: Permission) => void;
  onRoleChange?: (role: Role) => void;
  onUserChange?: (user: User) => void;
  onAccessExport?: (data: { roles: Role[]; users: User[] }) => void;
}

interface AuditLogEvent {
  id: string;
  type: 'permission' | 'role' | 'user';
  message: string;
  timestamp: Date;
}

const INITIAL_ROLES: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access',
    color: '#d32f2f',
    isSystem: true,
    permissions: [
      {
        id: 'admin-read-all',
        name: 'Read all resources',
        description: 'Can read every resource',
        resource: '*',
        action: 'read',
        level: 'admin',
        granted: true,
      },
      {
        id: 'admin-write-all',
        name: 'Write all resources',
        description: 'Can edit every resource',
        resource: '*',
        action: 'write',
        level: 'admin',
        granted: true,
      },
    ],
  },
  {
    id: 'editor',
    name: 'Editor',
    description: 'Can edit content and project data',
    color: '#1976d2',
    isSystem: false,
    permissions: [
      {
        id: 'editor-read-content',
        name: 'Read content',
        description: 'Can read content',
        resource: 'content',
        action: 'read',
        level: 'read',
        granted: true,
      },
      {
        id: 'editor-write-content',
        name: 'Edit content',
        description: 'Can edit content',
        resource: 'content',
        action: 'write',
        level: 'write',
        granted: true,
      },
    ],
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    color: '#2e7d32',
    isSystem: false,
    permissions: [
      {
        id: 'viewer-read-content',
        name: 'Read content',
        description: 'Can read content only',
        resource: 'content',
        action: 'read',
        level: 'read',
        granted: true,
      },
    ],
  },
];

const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    name: 'John Doe',
    email: 'john@example.com',
    roles: [INITIAL_ROLES[0]],
    lastActive: new Date('2026-02-28T10:00:00Z'),
    status: 'active',
  },
  {
    id: 'u2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    roles: [INITIAL_ROLES[1]],
    lastActive: new Date('2026-02-27T16:30:00Z'),
    status: 'active',
  },
  {
    id: 'u3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    roles: [INITIAL_ROLES[2]],
    lastActive: new Date('2026-02-26T08:15:00Z'),
    status: 'inactive',
  },
];

export default function AccessControl({
  className,
  onPermissionChange,
  onRoleChange,
  onUserChange,
  onAccessExport,
}: AccessControlProps): React.ReactElement {
  const theming = useTheming('photographer');

  const [activeTab, setActiveTab] = useState(0);
  const [roles, setRoles] = useState<Role[]>(INITIAL_ROLES);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(INITIAL_ROLES[0].id);
  const [selectedUserId, setSelectedUserId] = useState<string>(INITIAL_USERS[0].id);
  const [auditLog, setAuditLog] = useState<AuditLogEvent[]>([]);

  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [roleDraftName, setRoleDraftName] = useState('');
  const [roleDraftDescription, setRoleDraftDescription] = useState('');

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const logEvent = (event: Omit<AuditLogEvent, 'id' | 'timestamp'>): void => {
    setAuditLog((previous) => [
      {
        ...event,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date(),
      },
      ...previous,
    ]);
  };

  const togglePermission = (permissionId: string): void => {
    if (!selectedRole) {
      return;
    }

    setRoles((previous) =>
      previous.map((role) => {
        if (role.id !== selectedRole.id) {
          return role;
        }

        const updatedPermissions = role.permissions.map((permission) => {
          if (permission.id !== permissionId) {
            return permission;
          }

          const updatedPermission = { ...permission, granted: !permission.granted };
          onPermissionChange?.(updatedPermission);
          logEvent({
            type: 'permission',
            message: `${role.name}: ${updatedPermission.name} set to ${updatedPermission.granted ? 'granted' : 'revoked'}`,
          });
          return updatedPermission;
        });

        const updatedRole = { ...role, permissions: updatedPermissions };
        onRoleChange?.(updatedRole);
        return updatedRole;
      }),
    );
  };

  const assignRoleToUser = (roleId: string): void => {
    const role = roles.find((entry) => entry.id === roleId);
    if (!selectedUser || !role) {
      return;
    }

    if (selectedUser.roles.some((entry) => entry.id === role.id)) {
      return;
    }

    setUsers((previous) =>
      previous.map((user) => {
        if (user.id !== selectedUser.id) {
          return user;
        }
        const updatedUser = { ...user, roles: [...user.roles, role] };
        onUserChange?.(updatedUser);
        logEvent({ type: 'user', message: `${updatedUser.name} assigned role ${role.name}` });
        return updatedUser;
      }),
    );
  };

  const removeRoleFromUser = (roleId: string): void => {
    if (!selectedUser) {
      return;
    }

    setUsers((previous) =>
      previous.map((user) => {
        if (user.id !== selectedUser.id) {
          return user;
        }
        const updatedUser = {
          ...user,
          roles: user.roles.filter((role) => role.id !== roleId),
        };
        onUserChange?.(updatedUser);
        logEvent({ type: 'user', message: `${updatedUser.name} removed role ${roleId}` });
        return updatedUser;
      }),
    );
  };

  const createRole = (): void => {
    if (!roleDraftName.trim()) {
      return;
    }

    const newRole: Role = {
      id: `custom-${Date.now()}`,
      name: roleDraftName.trim(),
      description: roleDraftDescription.trim() || 'Custom role',
      color: '#6d4c41',
      isSystem: false,
      permissions: [
        {
          id: `custom-read-${Date.now()}`,
          name: 'Read content',
          description: 'Can read assigned resources',
          resource: 'content',
          action: 'read',
          level: 'read',
          granted: true,
        },
      ],
    };

    setRoles((previous) => [...previous, newRole]);
    setSelectedRoleId(newRole.id);
    setRoleDraftName('');
    setRoleDraftDescription('');
    setShowRoleDialog(false);
    onRoleChange?.(newRole);
    logEvent({ type: 'role', message: `Created role ${newRole.name}` });
  };

  const exportAccessConfiguration = (): void => {
    onAccessExport?.({ roles, users });
    logEvent({ type: 'role', message: 'Exported access configuration' });
  };

  const renderRolesTab = (): React.ReactNode => (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">Roles</Typography>
              <Button size="small" variant="outlined" onClick={() => setShowRoleDialog(true)}>
                New Role
              </Button>
            </Stack>

            <List dense>
              {roles.map((role) => (
                <ListItemButton
                  key={role.id}
                  selected={role.id === selectedRoleId}
                  onClick={() => setSelectedRoleId(role.id)}
                >
                  <ListItemText
                    primary={role.name}
                    secondary={role.description}
                  />
                  <Chip size="small" label={role.permissions.length} sx={{ bgcolor: role.color, color: '#fff' }} />
                </ListItemButton>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            {selectedRole ? (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle1">{selectedRole.name} Permissions</Typography>
                  <Chip label={selectedRole.isSystem ? 'System Role' : 'Custom Role'} size="small" />
                </Stack>

                <Divider sx={{ mb: 2 }} />

                <List>
                  {selectedRole.permissions.map((permission) => (
                    <ListItem
                      key={permission.id}
                      secondaryAction={
                        <Switch
                          checked={permission.granted}
                          onChange={() => togglePermission(permission.id)}
                        />
                      }
                    >
                      <ListItemText
                        primary={permission.name}
                        secondary={`${permission.description} (${permission.resource}:${permission.action})`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            ) : (
              <Alert severity="info">Select a role to edit permissions.</Alert>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderUsersTab = (): React.ReactNode => (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Users
            </Typography>
            <List dense>
              {users.map((user) => (
                <ListItemButton
                  key={user.id}
                  selected={user.id === selectedUserId}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <ListItemAvatar>
                    <Avatar src={user.avatar}>{user.name.slice(0, 1)}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.name}
                    secondary={`${user.status} • Last active ${user.lastActive.toLocaleDateString()}`}
                  />
                </ListItemButton>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            {selectedUser ? (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle1">{selectedUser.name}</Typography>
                  <Chip label={selectedUser.status} size="small" />
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {selectedUser.email}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel id="assign-role-label">Assign Role</InputLabel>
                    <Select
                      labelId="assign-role-label"
                      label="Assign Role"
                      onChange={(event) => assignRoleToUser(event.target.value)}
                      value=""
                    >
                      {roles.map((role) => (
                        <MenuItem key={role.id} value={role.id}>
                          {role.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {selectedUser.roles.map((role) => (
                    <Chip
                      key={role.id}
                      label={role.name}
                      onDelete={() => removeRoleFromUser(role.id)}
                      sx={{ bgcolor: role.color, color: '#fff' }}
                    />
                  ))}
                </Stack>
              </>
            ) : (
              <Alert severity="info">Select a user to manage role assignments.</Alert>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderAuditTab = (): React.ReactNode => (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Audit Log
        </Typography>
        {auditLog.length === 0 ? (
          <Alert severity="info">No access events recorded yet.</Alert>
        ) : (
          <List>
            {auditLog.map((event) => (
              <ListItem key={event.id}>
                <ListItemText
                  primary={event.message}
                  secondary={`${event.type} • ${event.timestamp.toLocaleString()}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <Paper sx={{ ...theming.getThemedCardSx(), mb: 2, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Security color="primary" />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Access Control
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage role-based permissions and user assignments.
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Export">
              <IconButton onClick={exportAccessConfiguration}>
                <Download />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 1, mb: 2 }}>
        <Tabs value={activeTab} onChange={(_event, next) => setActiveTab(next)}>
          <Tab icon={<AdminPanelSettings />} iconPosition="start" label="Roles" />
          <Tab icon={<AssignmentInd />} iconPosition="start" label="Users" />
          <Tab icon={<History />} iconPosition="start" label="Audit" />
        </Tabs>
      </Paper>

      {activeTab === 0 ? renderRolesTab() : null}
      {activeTab === 1 ? renderUsersTab() : null}
      {activeTab === 2 ? renderAuditTab() : null}

      <Dialog open={showRoleDialog} onClose={() => setShowRoleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Role</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Role name"
              value={roleDraftName}
              onChange={(event) => setRoleDraftName(event.target.value)}
            />
            <TextField
              fullWidth
              label="Role description"
              value={roleDraftDescription}
              onChange={(event) => setRoleDraftDescription(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRoleDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={createRole} startIcon={<Edit />}>
            Save Role
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
