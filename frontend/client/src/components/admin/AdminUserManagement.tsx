/**
 * CreatorHub Norge - Admin User Management Component
 * Material UI implementation with real user control capabilities
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { AdminCard, AdminButton, StatusChip, AdminTableContainer, AdminEmpty } from './design-system';
import {
  Edit as EditIcon,
  Block as BlockIcon,
  DeleteForever as DeleteIcon,
  CheckCircle as ActivateIcon,
  AdminPanelSettings as AdminIcon,
  Person as UserIcon,
  SupervisorAccount as SuperAdminIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profession: string;
  role: 'user' | 'admin' | 'super_admin';
  isActive: boolean;
  lastLoginAt: string;
  createdAt: string;
  companyName: string;
  organizationNumber: string;
}

interface AdminUserManagementProps {
  users: User[];
  isLoading: boolean;
}

const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ users, isLoading }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'role' | 'deactivate' | 'activate' | 'delete'>('role');
  const [newRole, setNewRole] = useState<'user' | 'admin' | 'super_admin'>('user');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');

  const roleUpdateMutation = useMutation({
    mutationFn: async ({ userId, role, reason }: { userId: string; role: string; reason: string }) => {
      const headers = await auth.getAuthHeader();
      return await apiRequest(`/api/admin/users/${userId}/role`, { headers, method: 'PUT', body: JSON.stringify({ role, reason }) });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      handleCloseDialog();
  },
    onError: (error: any) => {
      setError(error.message || 'Failed to update user role');
  }
});

  const deactivateMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const headers = await auth.getAuthHeader();
      return await apiRequest(`/api/admin/users/${userId}/deactivate`, { headers, method: 'PUT', body: JSON.stringify({ reason }) });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      handleCloseDialog();
  },
    onError: (error: any) => {
      setError(error.message || 'Failed to deactivate user');
  }
});

  const activateMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const headers = await auth.getAuthHeader();
      return await apiRequest(`/api/admin/users/${userId}/activate`, { headers, method: 'PUT', body: JSON.stringify({ reason }) });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      handleCloseDialog();
  },
    onError: (error: any) => {
      setError(error.message || 'Failed to activate user');
  }
});

  const deleteMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const headers = await auth.getAuthHeader();
      return await apiRequest(`/api/admin/users/${userId}`, { headers, method: 'DELETE' });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      handleCloseDialog();
  },
    onError: (error: any) => {
      setError(error.message || 'Kunne ikke slette bruker');
  }
});

  const handleOpenDialog = (user: User, action: 'role' | 'deactivate' | 'activate' | 'delete') => {
    setSelectedUser(user);
    setActionType(action);
    setNewRole(user.role);
    setReason('');
    setError('');
    setDialogOpen(true);
};

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedUser(null);
    setError('');
    setReason(', ');
};

  const handleSubmit = () => {
    if (!selectedUser) return;

    if (actionType === 'role') {
      roleUpdateMutation.mutate({
        userId: selectedUser.id,
        role: newRole,
        reason: reason || 'Admin role update'
    });
  } else if (actionType === 'deactivate') {
      if (!reason.trim()) {
        setError('Reason is required for deactivation');
        return;
    }
      deactivateMutation.mutate({
        userId: selectedUser.id,
        reason: reason
    });
  } else if (actionType === 'activate') {
      activateMutation.mutate({
        userId: selectedUser.id,
        reason: reason || 'Admin activation'
    });
  } else if (actionType === 'delete') {
      deleteMutation.mutate({ userId: selectedUser.id });
  }
};

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <SuperAdminIcon sx={{ color: '#f44336' }} />;
      case 'admin':
        return <AdminIcon sx={{ color: '#ff9800' }} />;
      default: return <UserIcon sx={{ color: '#4caf50'}} />;
  }
};

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      default:
        return 'Bruker';
  }
};

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'error';
      case 'admin':
        return 'warning';
      default:
        return 'default';
  }
};

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color: '#ff8c00' }} />
      </Box>
    );
}

  return (
    <Box>
      <AdminCard title="Brukeradministrasjon" disablePadding>
          <AdminTableContainer ariaLabel="Brukere">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Bruker</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>E-post</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rolle</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Sist pålogget</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Handlinger</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.82)' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column'}}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {user.firstName} {user.lastName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.62)' }}>
                          {user.companyName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.82)' }}>
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getRoleIcon(user.role)}
                        <StatusChip role={user.role} />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        tone={user.isActive ? 'success' : 'error'}
                        label={user.isActive ? 'Aktiv' : 'Deaktivert'}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.82)' }}>
                      {user.lastLoginAt 
                        ? new Date(user.lastLoginAt).toLocaleDateString('no-NO') 
                        : 'Aldri'
                    }
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Endre rolle">
                          <IconButton
                            size="small"
                            aria-label="Endre rolle"
                            onClick={() => handleOpenDialog(user, 'role')}
                            sx={{ color: '#ff8c00' }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        
                        {user.isActive ? (
                          <Tooltip title="Deaktiver bruker">
                            <IconButton
                              size="small"
                              aria-label="Deaktiver bruker"
                              onClick={() => handleOpenDialog(user, 'deactivate')}
                              sx={{ color: '#f44336' }}
                            >
                              <BlockIcon />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Aktiver bruker">
                            <IconButton
                              size="small"
                              aria-label="Aktiver bruker"
                              onClick={() => handleOpenDialog(user, 'activate')}
                              sx={{ color: '#4caf50'}}
                            >
                              <ActivateIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        <Tooltip title="Slett bruker permanent">
                          <IconButton
                            size="small"
                            aria-label="Slett bruker permanent"
                            onClick={() => handleOpenDialog(user, 'delete')}
                            sx={{ color: '#d32f2f' }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminTableContainer>
          {(!users || users.length === 0) && (
            <AdminEmpty title="Ingen brukere" description="Det finnes ingen brukere å vise ennå." />
          )}
      </AdminCard>

      {/* Action Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(10px)',
        }
      }}
      >
        <DialogTitle sx={{ color: 'white' }}>
          {actionType === 'role' && 'Endre brukerrolle'}
          {actionType === 'deactivate' && 'Deaktiver bruker'}
          {actionType === 'activate' && 'Aktiver bruker'}
          {actionType === 'delete' && 'Slett bruker permanent'}
        </DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.82)' }}>
              Bruker: {selectedUser?.firstName} {selectedUser?.lastName} ({selectedUser?.email})
            </Typography>

            {actionType === 'delete' && (
              <Alert severity="error" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                <strong>Er du sikker på at du vil slette denne brukeren?</strong>
                <br />
                Dette fjerner kontoen <strong>permanent</strong> sammen med tilknyttede data, og
                <strong> kan ikke angres</strong>. (Admin/super_admin-kontoer kan ikke slettes —
                endre rollen først.)
              </Alert>
            )}

            {actionType === 'role' && (
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.72)' }}>Ny rolle</InputLabel>
                <Select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  sx={{
                    color: 'white','.MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                  }, '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#ff8c00',
                  }}}
                >
                  <MenuItem value="user">Bruker</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="super_admin">Super Admin</MenuItem>
                </Select>
              </FormControl>
            )}
            
            {actionType !== 'delete' && (
            <TextField
              label={actionType === 'deactivate' ? 'Årsak (påkrevd)' : 'Årsak (valgfri)'}
              multiline
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required={actionType === 'deactivate'}
              sx={{
                '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.72)' }, '& .MuiOutlinedInput-root': {
                  color: 'white', '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' }, '&:hover fieldset': { borderColor: '#ff8c00',},
              }}}
            />
            )}
          </Box>
        </DialogContent>
        
        <DialogActions>
          <AdminButton tone="ghost" onClick={handleCloseDialog}>
            Avbryt
          </AdminButton>
          <AdminButton
            tone={actionType === 'delete' ? 'danger' : 'primary'}
            onClick={handleSubmit}
            loading={
              roleUpdateMutation.isPending ||
              deactivateMutation.isPending ||
              activateMutation.isPending ||
              deleteMutation.isPending
            }
          >
            {actionType === 'delete' ? 'Slett permanent' : 'Bekreft'}
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminUserManagement;
