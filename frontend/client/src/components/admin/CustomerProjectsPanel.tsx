import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Grid,
  Card as MuiCard,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Button
} from '@mui/material';
import {
  Group,
  Business,
  Work,
  Search,
  Visibility,
  Edit,
  Add,
  TrendingUp,
  Assignment,
  People
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`customer-projects-tabpanel-${index}`}
      aria-labelledby={`customer-projects-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface CustomerProjectsPanelProps {
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
}

export default function CustomerProjectsPanel({
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}: CustomerProjectsPanelProps) {
  const [tabValue, setTabValue] = useState(0);
  
  // Theming system
  const theming = useTheming('prototype_tester, ');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch real customer and project data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/admin/customer-projects-overview'],
    retry: 1,
});

  // Fetch detailed project data
  const { data: projectsData } = useQuery({
    queryKey: ['/api/admin/projects-detailed'],
    retry: 1,
});

  // Fetch customer data
  const { data: customersData } = useQuery({
    queryKey: ['/api/admin/customers-detailed'], 
    retry: 1,
});

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
};

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Laster kunder og prosjekter...</Typography>
      </Box>
    );
}

  // Use real data or fallback to basic structure
  const stats = (dashboardData as any)?.stats || {
    totalCustomers: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalRevenue: 0
};

  const projects = (projectsData as any)?.projects || [];
  const customers = (customersData as any)?.customers || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Group color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
            Kunder & Prosjekter
          </Typography>
        </Box>
        <Button variant="contained"
          startIcon={<Add />}
          sx={{ 
            bgcolor: '#ff8c00',
            '&:hover': { bgcolor: '#e67c00' }
        }}
        >
          Ny Kunde
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <People color="primary" />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                    {stats.totalCustomers}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Totale Kunder
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Assignment color="warning" />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                    {stats.activeProjects}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Aktive Prosjekter
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Work color="success" />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                    {stats.completedProjects}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Fullførte Prosjekter
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TrendingUp color="info" />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                    {stats.totalRevenue.toLocaleString('no-NO')} kr
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Omsetning
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Tabs */}
      <MuiCard>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: '#ff8c00',
                  fontWeight: 600
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#ff8c00'
              }
            }}
          >
            <Tab icon={<Work />} label="Alle Prosjekter" />
            <Tab icon={<People />} label="Kunder" />
            <Tab icon={<Business />} label="Leverandører" />
          </Tabs>
        </Box>

        <CardContent sx={theming.getThemedCardSx()}>
          {/* Search Bar */}
          <TextField
            fullWidth
            placeholder="Søk kunder, prosjekter eller leverandører..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )}}
            sx={{ mb: 3 }}
          />

          {/* Tab Panels */}
          <TabPanel value={tabValue} index={0}>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Prosjekt</strong></TableCell>
                    <TableCell><strong>Kunde</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Verdi</strong></TableCell>
                    <TableCell><strong>Sluttdato</strong></TableCell>
                    <TableCell><strong>Handlinger</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {projects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary">
                          Ingen prosjekter funnet
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    projects.map((project: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{project.name || 'Uten navn'}</TableCell>
                        <TableCell>{project.customerName || 'Ukjent kunde'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={project.status || 'Aktiv'}
                            color={project.status === 'completed' ? 'success' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{project.value || 0} kr</TableCell>
                        <TableCell>{project.deadline || 'Ikke satt'}</TableCell>
                        <TableCell>
                          <IconButton size="small">
                            <Visibility />
                          </IconButton>
                          <IconButton size="small">
                            <Edit />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Navn</strong></TableCell>
                    <TableCell><strong>E-post</strong></TableCell>
                    <TableCell><strong>Telefon</strong></TableCell>
                    <TableCell><strong>Aktive Prosjekter</strong></TableCell>
                    <TableCell><strong>Total Verdi</strong></TableCell>
                    <TableCell><strong>Handlinger</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary">
                          Ingen kunder funnet
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    customers.map((customer: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{customer.name || 'Uten navn'}</TableCell>
                        <TableCell>{customer.email || 'Ikke oppgitt'}</TableCell>
                        <TableCell>{customer.phone || 'Ikke oppgitt'}</TableCell>
                        <TableCell>{customer.activeProjects || 0}</TableCell>
                        <TableCell>{customer.totalValue || 0} kr</TableCell>
                        <TableCell>
                          <IconButton size="small">
                            <Visibility />
                          </IconButton>
                          <IconButton size="small">
                            <Edit />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {(customersData as any)?.vendors?.length > 0 ? (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Leverandør</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Aktive Ordrer</TableCell>
                      <TableCell>Total Omsetning</TableCell>
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(customersData as any).vendors.map((vendor: any) => (
                      <TableRow key={vendor.id}>
                        <TableCell>{vendor.businessName}</TableCell>
                        <TableCell>
                          <Chip 
                            label={vendor.vendorType || 'Leverandør'}
                            size="small" 
                            color="secondary" 
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={vendor.status || 'Aktiv'}
                            size="small" 
                            color={vendor.status === 'active' ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{vendor.activeOrders || 0}</TableCell>
                        <TableCell>kr {vendor.totalRevenue?.toLocaleString() || '0'}</TableCell>
                        <TableCell>
                          <IconButton size="small" color="primary">
                            <Visibility />
                          </IconButton>
                          <IconButton size="small" color="secondary">
                            <Edit />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Business sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                  Leverandør-administrasjon
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ingen leverandører registrert ennå
                </Typography>
              </Box>
            )}
          </TabPanel>
        </CardContent>
      </MuiCard>
    </Box>
  );
}