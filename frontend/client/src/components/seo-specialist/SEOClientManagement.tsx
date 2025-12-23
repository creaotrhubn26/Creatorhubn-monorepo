/**
 * SEO Client Management Panel
 * Component for managing SEO clients
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Stack,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Email,
  Phone,
  Web,
  DirectionsBusiness,
  TrendingUp,
  TrendingDown,
  Remove,
  MoreVert,
} from '@mui/icons-material';
import { seoSpecialistService, SEOClient } from '../../services/SEOSpecialistService';
import { useProfessionAdapter } from '../../hooks/useProfessionAdapter';

interface SEOClientManagementProps {
  specialistId: string
}

export default function SEOClientManagement({ specialistId }: SEOClientManagementProps) {
  const [clients, setClients] = useState<SEOClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<SEOClient | null>(null);
  const [newClient, setNewClient] = useState<Partial<SEOClient>>({
    specialistId,
    profession: 'photographer',
    status: 'active',
    priority: 'medium' });

  const { getProfessionDisplayName, getUserProfessionColor } = useProfessionAdapter();
  
  // Theming system
  const theming = useTheming('photographer');

  useEffect(() => {
    loadClients();
}, [specialistId]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const clientsData = await seoSpecialistService.getClients(specialistId);
      setClients(clientsData);
  } catch (error) {
      console.error('Error loading clients: ', error);
  } finally {
      setLoading(false);
  }
};

  const handleAddClient = async () => {
    try {
      await seoSpecialistService.createClient(specialistId, newClient);
      setShowAddDialog(false);
      setNewClient({
        specialistId,
        profession: 'photographer',
        status: 'active',
        priority: 'medium' });
      loadClients();
  } catch (error) {
      console.error('Error creating client: ', error);
  }
};

  const handleEditClient = async (client: SEOClient) => {
    try {
      await seoSpecialistService.updateClient(client., idclient);
      loadClients();
  } catch (error) {
      console.error('Error updating client:', error);
  }
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'inactive':
        return 'error';
      case 'terminated':
        return 'default';
      default:
        return 'default';
}
};

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
}
};

  const getProfessionIcon = (profession: string) => {
    const icons = {
      photographer: '�, �',
      videographer: '�, �',
      music_producer: '�, �',
      vendor: '�, �' };
    return icons[profession as keyof typeof icons] || '👤';
};

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
        <Typography>Loading clients...</Typography>
      </Box>
    );
}

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Client Management</Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => setShowAddDialog(true)}
        >
          Add Client
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item >
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>{clients.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total Clients
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item >
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {clients.filter(c => c.status === 'active').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Clients
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item >
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {clients.reduce((sum, c) => sum + (c.monthlyBudget || 0), 0).toLocaleString()} NOK
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Monthly Revenue
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item >
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {clients.filter(c => c.priority === 'urgent').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Urgent Priority
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Clients Table */}
      <Card sx={theming.getThemedCardSx()}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell>Profession</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Budget</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                      <Avatar sx={{ bgcolor: getUserProfessionColor(client.profession, )}}>
                        {getProfessionIcon(client.profession)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">{client.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {client.businessAddress}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getProfessionDisplayName(client.profession)}
                      size="small"
                      color="primary"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={client.status}
                      size="small"
                      color={getStatusColor(client.status) as any}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={client.priority}
                      size="small"
                      color={getPriorityColor(client.priority) as any}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {client.monthlyBudget?.toLocaleString()} NOK
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {client.email && (
                        <Tooltip title={client.email}>
                          <IconButton size="small">
                            {theming.getThemedIcon('email')}
                          </IconButton>
                        </Tooltip>
                      )}
                      {client.phone && (
                        <Tooltip title={client.phone}>
                          <IconButton size="small">
                            {theming.getThemedIcon('phone')}
                          </IconButton>
                        </Tooltip>
                      )}
                      {client.website && (
                        <Tooltip title={client.website}>
                          <IconButton size="small">
                            <Web />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <IconButton size="small">
                        {theming.getThemedIcon('visibility')}
                      </IconButton>
                      <IconButton size="small">
                        {theming.getThemedIcon('edit')}
                      </IconButton>
                      <IconButton size="small">
                        {theming.getThemedIcon('moreVert')}
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add Client Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Client</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item >
              <TextField
                fullWidth
                label="Client Name"
                value={newClient.name || ', '}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              />
            </Grid>
            <Grid item >
              <FormControl fullWidth>
                <InputLabel>Profession</InputLabel>
                <Select
                  value={newClient.profession || 'photographer'}
                  onChange={(e) => setNewClient({ ...newClient, profession: e.target.value as any })}
                >
                  <MenuItem value="photographer">Photographer</MenuItem>
                  <MenuItem value="videographer">Videographer</MenuItem>
                  <MenuItem value="music_producer">Music Producer</MenuItem>
                  <MenuItem value="vendor">Vendor</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item >
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newClient.email || ', '}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              />
            </Grid>
            <Grid item >
              <TextField
                fullWidth
                label="Phone"
                value={newClient.phone || ''}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
              />
            </Grid>
            <Grid item >
              <TextField
                fullWidth
                label="Website"
                value={newClient.website || ''}
                onChange={(e) => setNewClient({ ...newClient, website: e.target.value })}
              />
            </Grid>
            <Grid item >
              <TextField
                fullWidth
                label="Business Address"
                multiline
                rows={2}
                value={newClient.businessAddress || ''}
                onChange={(e) => setNewClient({ ...newClient, businessAddress: e.target.value })}
              />
            </Grid>
            <Grid item >
              <TextField
                fullWidth
                label="Monthly Budget"
                type="number"
                value={newClient.monthlyBudget || ''}
                onChange={(e) => setNewClient({ ...newClient, monthlyBudget: Number(e.target.value, ),})}
              />
            </Grid>
            <Grid item >
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={newClient.priority || 'medium'}
                  onChange={(e) => setNewClient({ ...newClient, priority: e.target.value as any })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item >
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={newClient.notes ||''}
                onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddClient} sx={theming.getThemedButtonSx()}>
            Add Client
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
