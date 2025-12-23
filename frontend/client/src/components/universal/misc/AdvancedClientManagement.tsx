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
  LinearProgress
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
  MoreVert
} from '@mui/icons-material';

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
  const theming = useTheming('photographer, ');
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

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
        try {
          const response = await fetch('/api/clients');
          if (response.ok) {
            const data = await response.json();
            setClients(data);
        } else {
            setClients([]);
        }
      } catch (error) {
          console.error('Error loading clients: ', error);
          setClients([]);
      }
    };
      
      const loadProjects = async () => {
        try {
          const response = await fetch('/api/projects');
          if (response.ok) {
            const data = await response.json();
            setProjects(data);
        } else {
            setProjects([]);
        }
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

  const getClientStatusColor = (status: string) => {
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
      case 'business': return theming.getThemedIcon(', ');
      case 'wedding': return theming.getThemedIcon('star');
      case 'individual': return theming.getThemedIcon('person');
      case 'corporate': return theming.getThemedIcon('assignment');
      default: return theming.getThemedIcon(', ');
  }
};

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setShowClientDialog(true);
};

  const handleAddClient = () => {
    setSelectedClient(null);
    setShowClientDialog(true);
};

  return (
    <Box sx={{ p:  3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h4" sx={{  fontWeight: 600, color: theming.colors.primary }}>
          Avansert Kundeadministrasjon
        </Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={handleAddClient}
          sx={{
            background: 'linear-gradient(45deg, #ff8c00 30%, #ff6600 90%)',
            color: 'white'
      }}
         sx={theming.getThemedButtonSx()}>
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
                      color={getClientStatusColor(client.status) as any}
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
                  <Button size="small" startIcon={theming.getThemedIcon('chat')}>
                    Kontakt
                  </Button>
                  <Button size="small" startIcon={<History />}>
                    Historikk
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Active Projects Tab */}
      {selectedTab === 1 && (
        <Alert severity="info">
          Aktive prosjekter vises her når de er implementert
        </Alert>
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
          <Alert severity="info" sx={{ mb:  2 }}>
            Kundedialog implementeres når backend API er klart
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowClientDialog(false)}>
            Avbryt
          </Button>
          <Button variant="contained" sx={theming.getThemedButtonSx()}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}