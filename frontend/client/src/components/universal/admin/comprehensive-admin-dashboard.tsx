import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { BarChart, Build, Dashboard, People, Security, Settings } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../../utils/theming-helper';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';

interface AdminDashboardProps {
  userRole?: string;
}

interface SystemComponent {
  id: string;
  name: string;
  profession: string;
  status: 'active' | 'inactive';
  type: 'page' | 'component' | 'feature';
}

interface PlatformMetrics {
  activeUsers: number;
  systemHealth: number;
  serverUptime: string;
  storageUsed: number;
  apiCalls: number;
  errorRate: number;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  profession: string;
  status: 'active' | 'inactive';
  lastActive: string;
}

const defaultMetrics: PlatformMetrics = {
  activeUsers: 0,
  systemHealth: 0,
  serverUptime: '0m',
  storageUsed: 0,
  apiCalls: 0,
  errorRate: 0,
};

function getStatusColor(health: number): 'success' | 'warning' | 'error' {
  if (health >= 95) return 'success';
  if (health >= 80) return 'warning';
  return 'error';
}

export default function ComprehensiveAdminDashboard({
  userRole = 'super_admin',
}: AdminDashboardProps) {
  const queryClient = useQueryClient();
  const theming = useTheming('prototype_tester');
  const { professionConfigs } = useDynamicProfessions();

  const [activeTab, setActiveTab] = useState(0);
  const [selectedProfession, setSelectedProfession] = useState<string>('all');
  const [editMode, setEditMode] = useState(false);

  const { data: metrics = defaultMetrics, isLoading: metricsLoading } = useQuery<PlatformMetrics>({
    queryKey: ['/api/admin/metrics'],
    queryFn: async () => (await apiRequest('/api/admin/metrics')) as PlatformMetrics,
    refetchInterval: 5000,
  });

  const { data: components = [], isLoading: componentsLoading } = useQuery<SystemComponent[]>({
    queryKey: ['/api/admin/components'],
    queryFn: async () => (await apiRequest('/api/admin/components')) as SystemComponent[],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ['/api/admin/users'],
    queryFn: async () => (await apiRequest('/api/admin/users')) as AdminUser[],
  });

  const toggleComponentMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      apiRequest(`/api/admin/components/${id}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/components'] });
    },
  });

  const filteredComponents = useMemo(() => {
    if (selectedProfession === 'all') return components;
    return components.filter(
      (component) =>
        component.profession === selectedProfession || component.profession === 'all',
    );
  }, [components, selectedProfession]);

  const tabs = [
    { icon: <Dashboard />, label: 'Oversikt' },
    { icon: <Build />, label: 'Komponenter' },
    { icon: <People />, label: 'Brukere' },
    { icon: <Settings />, label: 'Innstillinger' },
    { icon: <BarChart />, label: 'Analytikk' },
    { icon: <Security />, label: 'Sikkerhet' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2, color: theming.colors.primary }}>
        Comprehensive Admin Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Rolle: {userRole}
      </Typography>

      <Tabs value={activeTab} onChange={(_, value: number) => setActiveTab(value)} sx={{ mb: 3 }}>
        {tabs.map((tab) => (
          <Tab key={tab.label} icon={tab.icon} label={tab.label} iconPosition="start" />
        ))}
      </Tabs>

      {activeTab === 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Active Users
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {metricsLoading ? '...' : metrics.activeUsers}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  System Health
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {metricsLoading ? '...' : `${metrics.systemHealth}%`}
                  </Typography>
                  <Chip label={getStatusColor(metrics.systemHealth)} color={getStatusColor(metrics.systemHealth)} size="small" />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  API Calls
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {metricsLoading ? '...' : metrics.apiCalls}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Box>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
            <Select
              value={selectedProfession}
              onChange={(event) => setSelectedProfession(event.target.value)}
              size="small"
            >
              <MenuItem value="all">Alle profesjoner</MenuItem>
              {Object.keys(professionConfigs).map((profession) => (
                <MenuItem key={profession} value={profession}>
                  {professionConfigs[profession].displayName}
                </MenuItem>
              ))}
            </Select>
            <FormControlLabel
              control={<Switch checked={editMode} onChange={(event) => setEditMode(event.target.checked)} />}
              label="Edit mode"
            />
          </Stack>

          <List sx={theming.getThemedCardSx()}>
            {componentsLoading && <Typography sx={{ p: 2 }}>Laster komponenter...</Typography>}
            {!componentsLoading &&
              filteredComponents.map((component) => (
                <ListItem
                  key={component.id}
                  secondaryAction={
                    editMode ? (
                      <Switch
                        checked={component.status === 'active'}
                        onChange={(event) =>
                          toggleComponentMutation.mutate({
                            id: component.id,
                            status: event.target.checked ? 'active' : 'inactive',
                          })
                        }
                      />
                    ) : undefined
                  }
                >
                  <ListItemIcon>
                    <Build />
                  </ListItemIcon>
                  <ListItemText
                    primary={component.name}
                    secondary={`${component.type} • ${component.profession}`}
                  />
                  {!editMode && (
                    <Chip
                      label={component.status}
                      color={component.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  )}
                </ListItem>
              ))}
          </List>
        </Box>
      )}

      {activeTab === 2 && (
        <TableContainer sx={theming.getThemedCardSx()}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Navn</TableCell>
                <TableCell>E-post</TableCell>
                <TableCell>Profesjon</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Sist aktiv</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usersLoading && (
                <TableRow>
                  <TableCell colSpan={5}>Laster brukere...</TableCell>
                </TableRow>
              )}
              {!usersLoading &&
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.profession}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.status}
                        color={user.status === 'active' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{new Date(user.lastActive).toLocaleString('no-NO')}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {activeTab >= 3 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {tabs[activeTab].label}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Denne seksjonen er koblet opp og klar for utvidet admin-logikk.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
