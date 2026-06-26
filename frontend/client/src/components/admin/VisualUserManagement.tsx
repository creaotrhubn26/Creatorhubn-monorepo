import { useMemo, useState, type FC } from 'react';
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
  FormControl,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
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
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  CheckCircle,
  Edit,
  Error,
  Person,
  Refresh,
  Security,
  Warning,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profession: string;
  packageId: string;
  packageTier: string;
  activeFeatures: string[];
  lastActivity: string;
  status: 'active' | 'inactive' | 'suspended';
  onboardingCompleted: boolean;
  trialExpiresAt?: string;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'cancelled';
}

interface UserPackage {
  id: string;
  displayName: string;
  profession: string;
  tier: string;
  features: string[];
  monthlyPrice: number;
  maxProjects: number;
  maxStorage: number;
}

interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetProfessions: string[];
  businessCritical: boolean;
}

interface AccessAnalytics {
  activeUsers: number;
  failedLogins24h: number;
  mfaEnabledUsers: number;
  avgSessionMinutes: number;
}

interface ServiceValidationResult {
  service: string;
  status: 'configured' | 'missing' | 'error';
  details: string;
  dependencies: string[];
}

const fallbackUsers: UserRecord[] = [
  {
    id: 'user-1',
    email: 'daniel@creatorhub.no',
    firstName: 'Daniel',
    lastName: 'Normann',
    profession: 'photographer',
    packageId: 'photo-pro',
    packageTier: 'professional',
    activeFeatures: ['universal-showcase-premium', 'ai-content-enhancement', 'real-time-collaboration'],
    lastActivity: '2026-02-28T10:20:00Z',
    status: 'active',
    onboardingCompleted: true,
    subscriptionStatus: 'active',
  },
  {
    id: 'user-2',
    email: 'studio@storyarc.no',
    firstName: 'Lina',
    lastName: 'Berg',
    profession: 'videographer',
    packageId: 'video-studio',
    packageTier: 'enterprise',
    activeFeatures: ['story-arc-studio', 'script-manager'],
    lastActivity: '2026-02-27T19:05:00Z',
    status: 'active',
    onboardingCompleted: true,
    subscriptionStatus: 'active',
  },
  {
    id: 'user-3',
    email: 'trial@creatorhub.no',
    firstName: 'Maja',
    lastName: 'Holt',
    profession: 'music_producer',
    packageId: 'music-trial',
    packageTier: 'starter',
    activeFeatures: ['chat-widget'],
    lastActivity: '2026-02-20T09:00:00Z',
    status: 'inactive',
    onboardingCompleted: false,
    trialExpiresAt: '2026-03-10T00:00:00Z',
    subscriptionStatus: 'trial',
  },
];

const fallbackPackages: UserPackage[] = [
  {
    id: 'photo-pro',
    displayName: 'Photo Professional',
    profession: 'photographer',
    tier: 'professional',
    features: ['universal-showcase-premium', 'ai-content-enhancement'],
    monthlyPrice: 799,
    maxProjects: 80,
    maxStorage: 200,
  },
  {
    id: 'video-studio',
    displayName: 'Video Studio',
    profession: 'videographer',
    tier: 'enterprise',
    features: ['story-arc-studio', 'script-manager', 'video-ai-enhancement'],
    monthlyPrice: 1499,
    maxProjects: 250,
    maxStorage: 2000,
  },
  {
    id: 'music-trial',
    displayName: 'Music Trial',
    profession: 'music_producer',
    tier: 'starter',
    features: ['chat-widget'],
    monthlyPrice: 0,
    maxProjects: 10,
    maxStorage: 20,
  },
];

const fallbackFeatureFlags: FeatureFlag[] = [
  {
    id: 'story-arc-studio',
    name: 'Story Arc Studio',
    enabled: true,
    rolloutPercentage: 100,
    targetProfessions: ['videographer', 'photographer'],
    businessCritical: true,
  },
  {
    id: 'script-manager',
    name: 'Script Manager',
    enabled: true,
    rolloutPercentage: 80,
    targetProfessions: ['videographer'],
    businessCritical: false,
  },
  {
    id: 'ai-content-enhancement',
    name: 'AI Content Enhancement',
    enabled: true,
    rolloutPercentage: 100,
    targetProfessions: ['photographer', 'videographer', 'music_producer'],
    businessCritical: false,
  },
];

const fallbackAnalytics: AccessAnalytics = {
  activeUsers: 2,
  failedLogins24h: 1,
  mfaEnabledUsers: 1,
  avgSessionMinutes: 32,
};

function tabA11yProps(index: number) {
  return {
    id: `visual-user-management-tab-${index}`,
    'aria-controls': `visual-user-management-tabpanel-${index}`,
  };
}

function TabPanel(props: { value: number; index: number; children: React.ReactNode }) {
  const { value, index, children } = props;
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`visual-user-management-tabpanel-${index}`}
      aria-labelledby={`visual-user-management-tab-${index}`}
      sx={{ pt: 2 }}
    >
      {value === index ? children : null}
    </Box>
  );
}

async function safeApiRequest<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await apiRequest(url);
    return response as T;
  } catch {
    return fallback;
  }
}

function getServiceValidation(user: UserRecord, packages: UserPackage[], flags: FeatureFlag[]): ServiceValidationResult[] {
  const selectedPackage = packages.find((entry) => entry.id === user.packageId);
  const criticalFlagFailures = flags.filter(
    (flag) => flag.businessCritical && !flag.enabled && flag.targetProfessions.includes(user.profession),
  );

  return [
    {
      service: 'Package Provisioning',
      status: selectedPackage ? 'configured' : 'missing',
      details: selectedPackage
        ? `Package ${selectedPackage.displayName} attached to account.`
        : 'User has packageId without matching package definition.',
      dependencies: ['package-registry', 'billing-mapper'],
    },
    {
      service: 'Feature Entitlement',
      status: user.activeFeatures.length > 0 ? 'configured' : 'missing',
      details:
        user.activeFeatures.length > 0
          ? `${user.activeFeatures.length} active feature entitlements detected.`
          : 'No feature entitlements mapped to this account.',
      dependencies: ['feature-flag-service', 'entitlement-resolver'],
    },
    {
      service: 'Critical Feature Flags',
      status: criticalFlagFailures.length === 0 ? 'configured' : 'error',
      details:
        criticalFlagFailures.length === 0
          ? 'All required business-critical flags are enabled.'
          : `Missing critical flags: ${criticalFlagFailures.map((flag) => flag.id).join(', ')}`,
      dependencies: ['flag-distribution', 'rollout-checker'],
    },
    {
      service: 'Onboarding State',
      status: user.onboardingCompleted ? 'configured' : 'missing',
      details: user.onboardingCompleted
        ? 'User completed onboarding flow.'
        : 'User has not completed onboarding flow.',
      dependencies: ['onboarding-tracker'],
    },
    {
      service: 'Subscription State',
      status: user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trial' ? 'configured' : 'error',
      details: `Subscription status is ${user.subscriptionStatus}.`,
      dependencies: ['subscription-service', 'payment-provider'],
    },
  ];
}

function formatProfessionLabel(profession: string): string {
  return profession.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusColor(status: UserRecord['status'] | UserRecord['subscriptionStatus']) {
  if (status === 'active' || status === 'trial') {
    return 'success';
  }

  if (status === 'inactive' || status === 'expired') {
    return 'warning';
  }

  return 'default';
}

const VisualUserManagement: FC = () => {
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [operationMessage, setOperationMessage] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => safeApiRequest<UserRecord[]>('/api/admin/users', fallbackUsers),
    refetchInterval: 30000,
  });

  const packagesQuery = useQuery({
    queryKey: ['/api/admin/user-packages'],
    queryFn: async () => safeApiRequest<UserPackage[]>('/api/admin/user-packages', fallbackPackages),
    refetchInterval: 60000,
  });

  const featureFlagsQuery = useQuery({
    queryKey: ['/api/admin/feature-flags'],
    queryFn: async () => safeApiRequest<FeatureFlag[]>('/api/admin/feature-flags', fallbackFeatureFlags),
    refetchInterval: 30000,
  });

  const analyticsQuery = useQuery({
    queryKey: ['/api/admin/user-access-analytics'],
    queryFn: async () => safeApiRequest<AccessAnalytics>('/api/admin/user-access-analytics', fallbackAnalytics),
    refetchInterval: 30000,
  });

  const users = Array.isArray(usersQuery.data) ? usersQuery.data : fallbackUsers;
  const packages = Array.isArray(packagesQuery.data) ? packagesQuery.data : fallbackPackages;
  const featureFlags = Array.isArray(featureFlagsQuery.data) ? featureFlagsQuery.data : fallbackFeatureFlags;
  const analytics = analyticsQuery.data ?? fallbackAnalytics;

  const updateFeatureFlagMutation = useMutation({
    mutationFn: async ({ flagId, enabled }: { flagId: string; enabled: boolean }) => {
      await apiRequest(`/api/admin/feature-flags/${encodeURIComponent(flagId)}/status`, {
        method: 'PATCH',
        body: { enabled },
      });
    },
    onSuccess: async () => {
      setOperationMessage('Feature flag updated successfully.');
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-flags'] });
    },
    onError: () => {
      setOperationMessage('Could not update feature flag.');
    },
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: UserRecord['status'] }) => {
      await apiRequest(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
        method: 'PATCH',
        body: { status },
      });
    },
    onSuccess: async () => {
      setOperationMessage('User status updated successfully.');
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: () => {
      setOperationMessage('Could not update user status.');
    },
  });

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        user.firstName.toLowerCase().includes(normalizedSearch) ||
        user.lastName.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch);

      const matchesProfession = professionFilter === 'all' || user.profession === professionFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

      return matchesSearch && matchesProfession && matchesStatus;
    });
  }, [users, searchTerm, professionFilter, statusFilter]);

  const professionOptions = useMemo(() => {
    return Array.from(new Set(users.map((user) => user.profession))).sort((left, right) => left.localeCompare(right));
  }, [users]);

  const isLoading = usersQuery.isLoading || packagesQuery.isLoading || featureFlagsQuery.isLoading || analyticsQuery.isLoading;

  const selectedUserValidation = useMemo(() => {
    if (!selectedUser) {
      return [] as ServiceValidationResult[];
    }

    return getServiceValidation(selectedUser, packages, featureFlags);
  }, [selectedUser, packages, featureFlags]);

  const handleRefresh = async () => {
    await Promise.all([usersQuery.refetch(), packagesQuery.refetch(), featureFlagsQuery.refetch(), analyticsQuery.refetch()]);
  };

  const openUserDialog = (user: UserRecord) => {
    setSelectedUser(user);
    setUserDialogOpen(true);
  };

  const openValidationDialog = (user: UserRecord) => {
    setSelectedUser(user);
    setValidationDialogOpen(true);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'start', md: 'center' }} gap={2}>
        <Typography variant="h5" fontWeight={700}>
          Visual User Management
        </Typography>
        <Button startIcon={<Refresh />} variant="outlined" onClick={handleRefresh}>
          Refresh
        </Button>
      </Stack>

      {operationMessage ? (
        <Alert
          severity={operationMessage.includes('successfully') ? 'success' : 'warning'}
          sx={{ mt: 2 }}
          onClose={() => setOperationMessage(null)}
        >
          {operationMessage}
        </Alert>
      ) : null}

      {isLoading ? <LinearProgress sx={{ mt: 2 }} /> : null}

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Users
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {users.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Active Users
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {analytics.activeUsers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Failed Logins (24h)
              </Typography>
              <Typography variant="h5" fontWeight={700} color={analytics.failedLogins24h > 0 ? 'warning.main' : 'text.primary'}>
                {analytics.failedLogins24h}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Avg Session (min)
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {analytics.avgSessionMinutes}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)}>
          <Tab label="Users" {...tabA11yProps(0)} />
          <Tab label="Feature Flags" {...tabA11yProps(1)} />
          <Tab label="Security" icon={<Security />} iconPosition="start" {...tabA11yProps(2)} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Search users"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              fullWidth
            />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel id="user-profession-filter">Profession</InputLabel>
              <Select
                labelId="user-profession-filter"
                label="Profession"
                value={professionFilter}
                onChange={(event) => setProfessionFilter(event.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {professionOptions.map((profession) => (
                  <MenuItem key={profession} value={profession}>
                    {formatProfessionLabel(profession)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel id="user-status-filter">Status</InputLabel>
              <Select
                labelId="user-status-filter"
                label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Card>
            <CardContent sx={{ p: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Profession</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Subscription</TableCell>
                    <TableCell>Features</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar>
                            <Person />
                          </Avatar>
                          <Box>
                            <Typography fontWeight={600}>
                              {user.firstName} {user.lastName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {user.email}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={formatProfessionLabel(user.profession)} variant="outlined" />
                      </TableCell>
                      <TableCell>{user.packageTier}</TableCell>
                      <TableCell>
                        <Chip size="small" label={user.status} color={getStatusColor(user.status)} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={user.subscriptionStatus} color={getStatusColor(user.subscriptionStatus)} />
                      </TableCell>
                      <TableCell>{user.activeFeatures.length}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Open user details">
                            <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => openUserDialog(user)}>
                              Edit
                            </Button>
                          </Tooltip>
                          <Tooltip title="Validate service wiring">
                            <Button size="small" variant="outlined" onClick={() => openValidationDialog(user)}>
                              Validate
                            </Button>
                          </Tooltip>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              updateUserStatusMutation.mutate({
                                userId: user.id,
                                status: user.status === 'suspended' ? 'active' : 'suspended',
                              })
                            }
                          >
                            {user.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Card>
            <CardContent>
              <List disablePadding>
                {featureFlags.map((flag) => (
                  <ListItem
                    key={flag.id}
                    divider
                    secondaryAction={
                      <Switch
                        checked={flag.enabled}
                        onChange={(event) =>
                          updateFeatureFlagMutation.mutate({
                            flagId: flag.id,
                            enabled: event.target.checked,
                          })
                        }
                      />
                    }
                  >
                    <ListItemAvatar>
                      <Avatar>{flag.businessCritical ? <Warning /> : <CheckCircle />}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={flag.name}
                      secondary={
                        <>
                          <Typography variant="caption" component="span" display="block">
                            ID: {flag.id} · Rollout: {flag.rolloutPercentage}%
                          </Typography>
                          <Typography variant="caption" component="span" display="block">
                            Target professions: {flag.targetProfessions.map(formatProfessionLabel).join(', ')}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Security Posture
                  </Typography>
                  <Stack spacing={1}>
                    <Alert severity={analytics.failedLogins24h > 3 ? 'warning' : 'success'}>
                      Failed logins (24h): {analytics.failedLogins24h}
                    </Alert>
                    <Alert severity={analytics.mfaEnabledUsers > 0 ? 'success' : 'warning'}>
                      MFA enabled users: {analytics.mfaEnabledUsers}
                    </Alert>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Immediate Actions
                  </Typography>
                  <Stack spacing={1}>
                    <Button variant="outlined" onClick={() => setStatusFilter('suspended')}>
                      Show Suspended Users
                    </Button>
                    <Button variant="outlined" onClick={() => setStatusFilter('all')}>
                      Reset User Filters
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>

      <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>User Details</DialogTitle>
        <DialogContent>
          {selectedUser ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="First Name" value={selectedUser.firstName} fullWidth InputProps={{ readOnly: true }} />
              <TextField label="Last Name" value={selectedUser.lastName} fullWidth InputProps={{ readOnly: true }} />
              <TextField label="Email" value={selectedUser.email} fullWidth InputProps={{ readOnly: true }} />
              <TextField label="Package" value={selectedUser.packageId} fullWidth InputProps={{ readOnly: true }} />
              <TextField
                label="Last Activity"
                value={new Date(selectedUser.lastActivity).toLocaleString('nb-NO')}
                fullWidth
                InputProps={{ readOnly: true }}
              />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Active Features
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {selectedUser.activeFeatures.map((feature) => (
                    <Chip key={feature} size="small" label={feature} />
                  ))}
                </Stack>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={validationDialogOpen} onClose={() => setValidationDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Service Validation</DialogTitle>
        <DialogContent>
          <List disablePadding>
            {selectedUserValidation.map((result) => (
              <ListItem key={result.service} divider>
                <ListItemAvatar>
                  <Avatar>
                    {result.status === 'configured' ? <CheckCircle /> : result.status === 'missing' ? <Warning /> : <Error />}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={result.service}
                  secondary={
                    <>
                      <Typography variant="body2" component="span" display="block">
                        {result.details}
                      </Typography>
                      <Typography variant="caption" component="span" display="block">
                        Dependencies: {result.dependencies.join(', ')}
                      </Typography>
                    </>
                  }
                />
                <Chip
                  size="small"
                  color={
                    result.status === 'configured' ? 'success' : result.status === 'missing' ? 'warning' : 'error'
                  }
                  label={result.status}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setValidationDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VisualUserManagement;
