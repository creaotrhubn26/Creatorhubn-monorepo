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
import {
  Edit as EditIcon,
  Block as BlockIcon,
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
  const [actionType, setActionType] = useState<'role' | 'deactivate' | 'activate'>('role');
  const [newRole, setNewRole] = useState<'user' | 'admin' | 'super_admin'>('user');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester,');

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

  const handleOpenDialog = (user: User, action: 'role' | 'deactivate' | 'activate') => {
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
      <Paper sx={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 2 }}>
            Brukeradministrasjon
          </Typography>
          
          <TableContainer>
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
                    <TableCell sx={{ color: 'rgba(25, 255, 255, 0.8)' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column'}}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {user.firstName} {user.lastName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(25, 255, 255, 0.6)' }}>
                          {user.companyName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(25, 255, 255, 0.8)' }}>
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getRoleIcon(user.role)}
                        <Chip 
                          label={getRoleLabel(user.role)}
                          color={getRoleColor(user.role) as any}
                          size="small"
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={user.isActive ? 'Aktiv' : 'Deaktivert'}
                        color={user.isActive ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(25, 255, 255, 0.8)' }}>
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
                              onClick={() => handleOpenDialog(user, 'activate')}
                              sx={{ color: '#4caf50'}}
                            >
                              <ActivateIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Paper>

      {/* Action Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(25, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
        }
      }}
      >
        <DialogTitle sx={{ color: 'white' }}>
          {actionType === 'role' && 'Endre brukerrolle'}
          {actionType === 'deactivate' && 'Deaktiver bruker'}
          {actionType === 'activate' && 'Aktiver bruker'}
        </DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Typography sx={{ color: 'rgba(25, 255, 255, 0.8)' }}>
              Bruker: {selectedUser?.firstName} {selectedUser?.lastName} ({selectedUser?.email})
            </Typography>
            
            {actionType === 'role' && (
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(25, 255, 255, 0.7)' }}>Ny rolle</InputLabel>
                <Select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  sx={{
                    color: 'white','.MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(25, 255, 255, 0.23)',
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
            
            <TextField
              label={actionType === 'deactivate' ? 'Årsak (påkrevd)' : 'Årsak (valgfri)'}
              multiline
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required={actionType === 'deactivate'}
              sx={{
                '& .MuiInputLabel-root': { color: 'rgba(25, 255, 255, 0.7)' }, '& .MuiOutlinedInput-root': {
                  color: 'white', '& fieldset': { borderColor: 'rgba(25, 255, 255, 0.23)' }, '&:hover fieldset': { borderColor: '#ff8c00',},
              }}}
            />
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={handleCloseDialog}
            sx={{ color: 'rgba(25, 255, 255, 0.7)' }}
          >
            Avbryt
          </Button>
          <Button onClick={handleSubmit}
            variant="contained"
            disabled={
              roleUpdateMutation.isPending || 
              deactivateMutation.isPending || 
              activateMutation.isPending
          }
            sx={{
              backgroundColor: '#ff8c00', '&:hover': { backgroundColor: '#e67c00' }
          }}>
            {(roleUpdateMutation.isPending || deactivateMutation.isPending || activateMutation.isPending) ? (
              <CircularProgress size={20} sx={{ color: 'white' }} />
            ) : (
             'Bekreft')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminUserManagement;