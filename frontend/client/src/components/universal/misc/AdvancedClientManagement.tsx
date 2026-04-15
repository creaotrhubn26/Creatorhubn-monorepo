// @ts-nocheck
/**
 * Advanced Client Management Component
 * Comprehensive client relationship management for Norwegian creative professionals
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tabs,
  Tab,
  Paper,
  Divider,
  Alert,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from '@mui/material';
import { useDemoMode, useDemoModeData } from '@/contexts/DemoModeContext';
import {
  Person,
  Business,
  Phone,
  Email,
  LocationOn,
  AttachMoney,
  TrendingUp,
  Star,
  History,
  Add,
  Edit,
  Delete,
  Chat,
  Event,
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Assignment,
  Receipt,
  Assessment,
  Search,
  FilterList,
  MoreVert,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  location: string;
  clientType: 'individual' | 'business' | 'wedding' | 'corporate';
  status: 'active' | 'inactive' | 'potential' | 'past';
  totalValue: number;
  projectCount: number;
  rating: number;
  lastContact: Date;
  notes: string;
  tags: string[];
  avatar?: string;
  preferredCommunication: 'email' | 'phone' | 'sms' | 'whatsapp';
  language: 'no' | 'en';
  gdprConsent: boolean;
  source: string
}

interface Project {
  id: string;
  clientId: string;
  name: string;
  type: string;
  status: string;
  value: number;
  date: Date;
  deliveryDate?: Date
}

export default function AdvancedClientManagement() {
  const { isDemoMode } = useDemoMode();
  
  // Theming system
  const theming = useTheming('photographer');
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [clientForm, setClientForm] = useState<Partial<Client>>({
    name: '',
    email: '',
    phone: '',
    location: '',
    clientType: 'individual',
    status: 'potential',
    totalValue: 0,
    projectCount: 0,
    rating: 0,
    notes: '',
    tags: [],
    preferredCommunication: 'email',
    language: 'no',
    gdprConsent: false,
    source: 'manual'
  });

  // Get demo data when in demo mode, otherwise use real data
  const demoClients = useDemoModeData<Client>('clients', []);
  const demoProjects = useDemoModeData<Project>('projects', []);

  // Load real data from API or use demo data
  useEffect(() => {
    if (isDemoMode) {
      setClients(demoClients);
      setProjects(demoProjects);
  } else {
      // Load real data from API
      const loadClients = async () => {
        setIsLoading(true);
        try {
          const data = await apiRequest('/api/clients');
          setClients(data || []);
        } catch (error) {
          console.error('Error loading clients: ', error);
          setClients([]);
        } finally {
          setIsLoading(false);
        }
      };
      
      const loadProjects = async () => {
        try {
          const data = await apiRequest('/api/projects');
          setProjects(data || []);
        } catch (error) {
          console.error('Error loading projects:', error);
          setProjects([]);
        }
      };

      loadClients();
      loadProjects();
  }
}, [isDemoMode, demoClients, demoProjects]);

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.company?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || client.status === filterStatus;
    const matchesType = filterType === 'all' || client.clientType === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
});

  type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

  const getClientStatusColor = (status: string): ChipColor => {
    switch (status) {
      case 'active': return 'success';
      case 'potential': return 'warning';
      case 'inactive': return 'default';
      case 'past': return 'error';
      default: return 'default';
}
};

  const getClientTypeIcon = (type: string) => {
    switch (type) {
      case 'business': return <Business />;
      case 'wedding': return <Star />;
      case 'individual': return <Person />;
      case 'corporate': return <Assignment />;
      default: return <Person />;
  }
};

  const getProjectIcon = (type: string) => {
    const normalized = type.toLowerCase();
    if (normalized.includes('photo')) return <PhotoCamera />;
    if (normalized.includes('video')) return <Videocam />;
    if (normalized.includes('music')) return <LibraryMusic />;
    return <Assignment />;
  };

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setShowClientDialog(true);
};

  const handleAddClient = () => {
    setSelectedClient(null);
    setShowClientDialog(true);
};

  useEffect(() => {
    if (selectedClient) {
      setClientForm({
        ...selectedClient,
        tags: selectedClient.tags || []
      });
      setSaveError('');
      return;
    }
    setClientForm({
      name: '',
      email: '',
      phone: '',
      location: '',
      clientType: 'individual',
      status: 'potential',
      totalValue: 0,
      projectCount: 0,
      rating: 0,
      notes: '',
      tags: [],
      preferredCommunication: 'email',
      language: 'no',
      gdprConsent: false,
      source: 'manual'
    });
    setSaveError('');
  }, [selectedClient, showClientDialog]);

  const handleSaveClient = async () => {
    if (!clientForm.name || !clientForm.email) {
      setSaveError('Navn og e-post er obligatorisk.');
      return;
    }

    const payload: Client = {
      id: selectedClient?.id || `client-${Date.now()}`,
      name: clientForm.name,
      email: clientForm.email,
      phone: clientForm.phone || '',
      company: clientForm.company,
      location: clientForm.location || '',
      clientType: clientForm.clientType || 'individual',
      status: clientForm.status || 'potential',
      totalValue: Number(clientForm.totalValue) || 0,
      projectCount: Number(clientForm.projectCount) || 0,
      rating: Number(clientForm.rating) || 0,
      lastContact: selectedClient?.lastContact || new Date(),
      notes: clientForm.notes || '',
      tags: clientForm.tags || [],
      avatar: clientForm.avatar,
      preferredCommunication: clientForm.preferredCommunication || 'email',
      language: clientForm.language || 'no',
      gdprConsent: clientForm.gdprConsent ?? false,
      source: clientForm.source || 'manual'
    };

    try {
      setIsLoading(true);
      if (isDemoMode) {
        setClients((prev) => {
          const exists = prev.find((c) => c.id === payload.id);
          if (exists) {
            return prev.map((c) => (c.id === payload.id ? payload : c));
          }
          return [payload, ...prev];
        });
      } else if (selectedClient) {
        await apiRequest(`/api/clients/${payload.id}`, {
          method: 'PUT',
          body: payload
        });
        setClients((prev) => prev.map((c) => (c.id === payload.id ? payload : c)));
      } else {
        const created = await apiRequest('/api/clients', {
          method: 'POST',
          body: payload
        });
        setClients((prev) => [created || payload, ...prev]);
      }
      setShowClientDialog(false);
      setSelectedClient(null);
    } catch (error) {
      console.error('Error saving client:', error);
      setSaveError('Kunne ikke lagre kunden. Prov igjen.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClient = async (client: Client) => {
    if (!window.confirm(`Vil du slette kunden ${client.name}?`)) return;
    try {
      if (!isDemoMode) {
        await apiRequest(`/api/clients/${client.id}`, { method: 'DELETE' });
      }
      setClients((prev) => prev.filter((c) => c.id !== client.id));
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  };

  const handleContactClient = (client: Client) => {
    if (client.preferredCommunication === 'phone' && client.phone) {
      window.open(`tel:${client.phone}`, '_self');
      return;
    }
    if (client.preferredCommunication === 'sms' && client.phone) {
      window.open(`sms:${client.phone}`, '_self');
      return;
    }
    window.open(`mailto:${client.email}`, '_self');
  };

  return (
    <Box sx={{ p:  3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h4" sx={{  fontWeight: 600, color: theming.colors.primary }}>
          Avansert Kundeadministrasjon
        </Typography>
        <Button
          variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={handleAddClient}
          sx={{
            background: 'linear-gradient(45deg, #ff8c00 30%, #ff6600 90%)',
            color: 'white',
            ...theming.getThemedButtonSx()
          }}
        >
          Ny kunde
        </Button>
      </Box>

      {/* Search and Filter Bar */}
      <Paper sx={{ p: 2, mb: 3 ,  ...theming.getThemedCardSx() }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Søk etter kunde, e-post eller firma..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary'}} />
            }}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">Alle statuser</MenuItem>
                <MenuItem value="active">Aktiv</MenuItem>
                <MenuItem value="potential">Potensiell</MenuItem>
                <MenuItem value="inactive">Inaktiv</MenuItem>
                <MenuItem value="past">Tidligere</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={filterType}
                label="Type"
                onChange={(e) => setFilterType(e.target.value)}
              >
                <MenuItem value="all">Alle typer</MenuItem>
                <MenuItem value="individual">Privatperson</MenuItem>
                <MenuItem value="business">Bedrift</MenuItem>
                <MenuItem value="wedding">Bryllup</MenuItem>
                <MenuItem value="corporate">Bedriftskunde</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Tabs value={selectedTab} onChange={(e, newValue) => setSelectedTab(newValue)} sx={{ mb:  3 }}>
        <Tab label="Alle kunder" />
        <Tab label="Aktive prosjekter" />
        <Tab label="Statistikk" />
      </Tabs>

      {/* Client List */}
      {selectedTab === 0 && (
        <Grid container spacing={2}>
          {isLoading && (
            <Grid item xs={12}>
              <LinearProgress sx={{ mb: 2 }} />
            </Grid>
          )}
          {filteredClients.map((client) => (
            <Grid item xs={12} md={6} lg={4} key={client.id}>
              <Card sx={{ 
                height: '100%',
                transition: 'all 0.2s ease-in-out', '&:hover': {
                  boxShadow:  6,
                  transform: 'translateY(-2px)'
            }
            ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                    <Avatar sx={{ mr: 2, bgcolor: 'primary.main'}}>
                      {getClientTypeIcon(client.clientType)}
                    </Avatar>
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="h6" sx={{  fontWeight: 600}}>
                        {client.name}
                      </Typography>
                      {client.company && (
                        <Typography variant="body2" color="text.secondary">
                          {client.company}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      label={client.status}
                      color={getClientStatusColor(client.status)}
                      size="small"
                    />
                  </Box>

                  <Box sx={{ mb:  2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                      <Email sx={{ fontSize:  16, mr: 1, color: 'text.secondary'}} />
                      <Typography variant="body2">{client.email}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                      <Phone sx={{ fontSize:  16, mr: 1, color: 'text.secondary'}} />
                      <Typography variant="body2">{client.phone}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                      <LocationOn sx={{ fontSize:  16, mr: 1, color: 'text.secondary'}} />
                      <Typography variant="body2">{client.location}</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', justify: 'space-between', alignItems: 'center', mb:  2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Totalverdi
                      </Typography>
                      <Typography variant="h6" color="primary.main" sx={{  fontWeight: 600}}>
                        NOK {client.totalValue.toLocaleString('no-NO')}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Prosjekter
                      </Typography>
                      <Typography variant="h6" sx={{  fontWeight: 600}}>
                        {client.projectCount}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0,mb: 2, flexWrap: 'wrap'}}>
                    {client.tags.slice(0, 2).map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                    {client.tags.length > 2 && (
                      <Chip label={`+${client.tags.length - 2}`} size="small" variant="outlined" />
                    )}
                  </Box>
                </CardContent>

                <CardActions sx={theming.getThemedCardSx()}>
                  <Button size="small" startIcon={theming.getThemedIcon('edit')} onClick={() => handleEditClient(client)}>
                    Rediger
                  </Button>
                  <Button size="small" startIcon={theming.getThemedIcon('chat')} onClick={() => handleContactClient(client)}>
                    Kontakt
                  </Button>
                  <Button size="small" startIcon={<Delete />} color="error" onClick={() => handleDeleteClient(client)}>
                    Slett
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Active Projects Tab */}
      {selectedTab === 1 && (
        <Grid container spacing={2}>
          {projects.filter((project) => project.status !== 'completed').length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">
                Ingen aktive prosjekter akkurat na.
              </Alert>
            </Grid>
          ) : (
            projects
              .filter((project) => project.status !== 'completed')
              .map((project) => {
                const client = clients.find((c) => c.id === project.clientId);
                return (
                  <Grid item xs={12} md={6} key={project.id}>
                    <Card sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {getProjectIcon(project.type)}
                          </Avatar>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {project.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {client?.name || 'Ukjent kunde'} • {project.status}
                            </Typography>
                          </Box>
                        </Box>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                          Prosjektverdi: NOK {project.value.toLocaleString('no-NO')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Startdato: {new Date(project.date).toLocaleDateString('no-NO')}
                        </Typography>
                        {project.deliveryDate && (
                          <Typography variant="body2" color="text.secondary">
                            Levering: {new Date(project.deliveryDate).toLocaleDateString('no-NO')}
                          </Typography>
                        )}
                      </CardContent>
                      <CardActions sx={theming.getThemedCardSx()}>
                        {client && (
                          <Button size="small" startIcon={<Chat />} onClick={() => handleContactClient(client)}>
                            Kontakt kunde
                          </Button>
                        )}
                        <Button size="small" startIcon={<Assessment />}>
                          Rapport
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })
          )}
        </Grid>
      )}

      {/* Statistics Tab */}
      {selectedTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <Person sx={{ fontSize:  40, color: 'primary.main', mb:  1 }} />
                <Typography variant="h4" sx={{  fontWeight: 600}}>
                  {clients.length}
                </Typography>
                <Typography color="text.secondary">
                  Totalt kunder
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <TrendingUp sx={{ fontSize:  40, color: 'success.main', mb:  1 }} />
                <Typography variant="h4" sx={{  fontWeight: 600}}>
                  {clients.filter(c => c.status === 'active').length}
                </Typography>
                <Typography color="text.secondary">
                  Aktive kunder
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <AttachMoney sx={{ fontSize:  40, color: 'warning.main', mb:  1 }} />
                <Typography variant="h4" sx={{  fontWeight: 600}}>
                  NOK {clients.reduce((sum, c) => sum + c.totalValue, 0).toLocaleString('no-NO')}
                </Typography>
                <Typography color="text.secondary">
                  Total verdi
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <Star sx={{ fontSize:  40, color: 'info.main', mb:  1 }} />
                <Typography variant="h4" sx={{  fontWeight: 600}}>
                  {(clients.reduce((sum, c) => sum + c.rating, 0) / clients.filter(c => c.rating > 0).length || 0).toFixed(1)}
                </Typography>
                <Typography color="text.secondary">
                  Snitt rating
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Client Dialog */}
      <Dialog
        open={showClientDialog}
        onClose={() => setShowClientDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedClient ? 'Rediger kunde' : 'Ny kunde'}
        </DialogTitle>
        <DialogContent>
            {saveError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {saveError}
              </Alert>
            )}
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Navn"
                  value={clientForm.name || ''}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="E-post"
                  value={clientForm.email || ''}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Telefon"
                  value={clientForm.phone || ''}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Firma"
                  value={clientForm.company || ''}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, company: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Lokasjon"
                  value={clientForm.location || ''}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, location: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={clientForm.clientType || 'individual'}
                    label="Type"
                    onChange={(e) => setClientForm((prev) => ({ ...prev, clientType: e.target.value as Client['clientType'] }))}
                  >
                    <MenuItem value="individual">Privatperson</MenuItem>
                    <MenuItem value="business">Bedrift</MenuItem>
                    <MenuItem value="wedding">Bryllup</MenuItem>
                    <MenuItem value="corporate">Bedriftskunde</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={clientForm.status || 'potential'}
                    label="Status"
                    onChange={(e) => setClientForm((prev) => ({ ...prev, status: e.target.value as Client['status'] }))}
                  >
                    <MenuItem value="active">Aktiv</MenuItem>
                    <MenuItem value="potential">Potensiell</MenuItem>
                    <MenuItem value="inactive">Inaktiv</MenuItem>
                    <MenuItem value="past">Tidligere</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Foretrukket kontakt</InputLabel>
                  <Select
                    value={clientForm.preferredCommunication || 'email'}
                    label="Foretrukket kontakt"
                    onChange={(e) => setClientForm((prev) => ({ ...prev, preferredCommunication: e.target.value as Client['preferredCommunication'] }))}
                  >
                    <MenuItem value="email">E-post</MenuItem>
                    <MenuItem value="phone">Telefon</MenuItem>
                    <MenuItem value="sms">SMS</MenuItem>
                    <MenuItem value="whatsapp">WhatsApp</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Totalverdi (NOK)"
                  type="number"
                  value={clientForm.totalValue ?? 0}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, totalValue: Number(e.target.value) }))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Prosjekter"
                  type="number"
                  value={clientForm.projectCount ?? 0}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, projectCount: Number(e.target.value) }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notater"
                  multiline
                  minRows={3}
                  value={clientForm.notes || ''}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Tags (kommaseparert)"
                  value={(clientForm.tags || []).join(', ')}
                  onChange={(e) =>
                    setClientForm((prev) => ({
                      ...prev,
                      tags: e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean)
                    }))
                  }
                />
              </Grid>
            </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowClientDialog(false)}>
            Avbryt
          </Button>
            <Button
              variant="contained"
              onClick={handleSaveClient}
              disabled={isLoading}
              sx={theming.getThemedButtonSx()}
            >
              {isLoading ? 'Lagrer...' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}