/**
 * CreatorHub Norge - User Management Panel
 * Complete RBAC/ABAC user administration for admin dashboard
 */

import React, { useState } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { useIntegrationFeatures } from '../../hooks/useIntegrationFeatures';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Grid,
  Skeleton,
  Tooltip,
  Switch,
  FormControlLabel,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  Security as SecurityIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  People as PeopleIcon,
  HowToReg as HowToRegIcon,
  Email as EmailIcon,
  Folder as FolderIcon,
  School as SchoolIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import { Edit as EditIcon } from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import AdminInviteSystem from '../../pages/admin-invite-system.tsx';
import { EmailDesigner } from '../EmailDesigner/EmailDesigner';
import { usePlatformPricing } from '../../services/PlatformPricingService';
import { getAllProfessionFeatures } from '../../../../shared/profession-feature-matrix';
import { UserFolderAccessViewer } from './UserFolderAccessViewer';
import AcademyAdminPanel from './AcademyAdminPanel';
import EnterpriseInquiriesPanel from './EnterpriseInquiriesPanel';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  createdAt: string;
  updatedAt?: string;
  profession?: string;
  businessName?: string;
  organizationNumber?: string;
  isActive: boolean;
}

interface Role {
  id: string;
  name: string;
  permissions: string[];
  description: string;
}

interface UserManagementPanelProps {
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

export default function UserManagementPanel({
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
}: UserManagementPanelProps) {
  const [tabValue, setTabValue] = useState(0);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(' , ');
  const [selectedRole, setSelectedRole] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editProfessionOpen, setEditProfessionOpen] = useState(false);
  const [editProfessionValue, setEditProfessionValue] = useState<string>(', ');
  const [folderViewUserId, setFolderViewUserId] = useState<string | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester,');

  // Feature access system
  const { hasFeature, getFeatureList, totalActiveIntegrations } = useIntegrationFeatures();
  
  // Helper to get profession branding
  const getProfessionChip = (profession?: string) => {
    if (!profession) return null;
    const branding = theming.getProfessionBranding(profession);
    const IconComponent = branding.icon;
    
    return {
      icon: <IconComponent sx={{ fontSize: 16, color: 'white' }} />,
      label: branding.label,
      color: branding.color
    };
  };

  // Platform pricing service integration
  const { 
    subscriptionPlans, 
    formatPrice,
    isLoading: pricingLoading 
} = usePlatformPricing();

  // Comprehensive Feature System for User Management
  const userManagementAccess = { hasAccess: hasFeature('user-management') };
  const userCreationAccess = { hasAccess: hasFeature('user-creation') };
  const userEditingAccess = { hasAccess: hasFeature('user-editing') };
  const roleManagementAccess = { hasAccess: hasFeature('role-management') };
  const permissionManagementAccess = { hasAccess: hasFeature('permission-management') };
  const userAnalyticsAccess = { hasAccess: hasFeature('user-analytics') };
  const bulkOperationsAccess = { hasAccess: hasFeature('bulk-operations') };
  const userImportExportAccess = { hasAccess: hasFeature('user-import-export') };

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users', {
        headers: {
          'Content-Type' : 'application/json'
      }
    });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
  },
    staleTime: 30000
});

  // Fetch roles
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['/api/admin/roles'],
    queryFn: async () => {
      const response = await fetch('/api/admin/roles', {
        headers: {
          'Content-Type' : 'application/json'
      }
    });
      if (!response.ok) throw new Error('Failed to fetch roles');
      return response.json();
  },
    staleTime: 300000 // 5 minutes
});

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: { email: string; firstName: string; lastName: string; role: string; sendInvite: boolean }) => {
      const response = await fetch('/api/admin/users', {
        headers: {
          'Content-Type' : 'application/json'
      },
        method: 'POST',
        body: JSON.stringify(userData)
    });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
    }
      return response.json();
  },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setInviteDialogOpen(false);
      
      // Broadcast user created event
      communication.sendBroadcast('admin:user:created', {
        type: 'user_created',
        data,
        component: 'UserManagementPanel'
      });
      
      toast({
        title: "Bruker opprettet",
        description: "Ny bruker er opprettet og invitasjon sendt",
        variant: "default"
    });
  },
    onError: (error: Error) => {
      toast({
        title: "Feil ved opprettelse",
        description: error.message,
        variant: "destructive"
    });
  }
});

  // Payment verification mutation
  const verifyPaymentMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/payment-status`, {
        headers: {
          'Content-Type' : 'application/json'
      }
    });
      if (!response.ok) throw new Error('Failed to verify payment');
      return response.json();
  },
    onError: (error: Error) => {
      toast({
        title: "Kunne ikke verifisere betaling",
        description: error.message,
        variant: "destructive"
    });
  }
});

  // Google Wallet activation mutation
  const activateGoogleWalletMutation = useMutation({
    mutationFn: async ({ userId, planId }: { userId: string; planId: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/activate-google-wallet`, {
        headers: {
          'Content-Type' : 'application/json'
      },
        method: 'POST',
        body: JSON.stringify({ planId })
    });
      if (!response.ok) throw new Error('Failed to activate Google Wallet');
      return response.json();
  },
    onSuccess: (data) => {
      toast({
        title: "Google Wallet aktivert",
        description: "Medlemskort er opprettet og sendt til bruker",
        variant: "default"
    });
  },
    onError: (error: Error) => {
      toast({
        title: "Feil ved Google Wallet aktivering",
        description: error.message,
        variant: "destructive"
    });
  }
});

  // User approval with payment verification
  const approveUserMutation = useMutation({
    mutationFn: async ({ userId, user }: { userId: string; user: User }) => {
      // First verify payment
      const paymentStatus = await verifyPaymentMutation.mutateAsync(userId);

      if (!paymentStatus.hasPayment || !paymentStatus.paymentCompleted) {
        throw new Error('Bruker har ikke fullført betaling');
    }

      // Activate Google Wallet if payment is complete
      if (paymentStatus.planId) {
        await activateGoogleWalletMutation.mutateAsync({ userId, planId: paymentStatus.planId });
    }

      // Approve user
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        headers: {
          'Content-Type' : 'application/json'
      },
        method: 'POST'
    });
      if (!response.ok) throw new Error('Failed to approve user');

      // Auto-onboard to CreatorHub Norge Community (NEW)
      if (user.profession && user.profession !== 'vendor') {
        try {
          const communityResponse = await apiRequest('/api/community/onboard-user', {
            method: 'POST',
            body: JSON.stringify({
              userId: user.id,
              profession: user.profession,
              email: user.email,
            }),
          });
          console.log('✅ User auto-onboarded to community: ', communityResponse);
        } catch (communityError) {
          console.error('⚠️ Failed to onboard user to community: ', communityError);
          // Don't fail the entire approval if community onboarding fails
        }
      }

      return response.json();
  },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Bruker godkjent",
        description: "Bruker er godkjent og har fått tilgang til plattformen og community",
        variant: "default"
    });
  },
    onError: (error: Error) => {
      toast({
        title: "Kunne ikke godkjenne bruker",
        description: error.message,
        variant: "destructive"
    });
  }
});

  // Start impersonation mutation
  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/api/admin/impersonate/start', {
        headers: {
          'Content-Type' : 'application/json'
      },
        method: 'POST',
        body: JSON.stringify({ targetUserId: userId })
    });
      if (!response.ok) throw new Error('Failed to start impersonation');
      return response.json();
  },
    onSuccess: (data) => {
      // Broadcast impersonation event
      communication.sendBroadcast('admin:user:impersonated', {
        type: 'user_impersonated',
        data,
        component: 'UserManagementPanel'
      });
      
      toast({
        title: "Impersonering startet",
        description: `Du er nå logget inn som ${data.targetUser.email}`,
        variant: "default"
    });
  },
    onError: () => {
      toast({
        title: "Feil ved impersonering",
        description: "Kunne ikke starte brukerimpersonering",
        variant: "destructive"
    });
  }
});

  // Register component with MasterIntegrationProvider
  React.useEffect(() => {
    componentRegistry.registerComponent({
      id: 'UserManagementPanel',
      name: 'User Management Panel',
      type: 'admin',
      category: 'user-management',
      capabilities: ['user-management','role-management','impersonation'],
      dependencies: ['admin-dashboard','user-notifications'],
      props: ['users','roles','inviteDialogOpen'],
      events: ['user:created'],
      dataKeys: ['users','roles']
  });

    // Track feature usage (simplified)
    console.log('User management panel opened', {
      timestamp: Date.now(),
      component: 'UserManagementPanel',
      userCount: usersData?.length || 0
  });

    // Set up data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'UserManagementPanel',
      dataKey: 'users'
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'UserManagementPanel',
      dataKey: 'roles'
  });

    // Listen for user events
    const refreshUnsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'admin:user:refresh') {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    }
  });

    const createUserUnsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'admin:user:create' && message.data?.userData) {
        createUserMutation.mutate(message.data.userData);
    }
  });

    const impersonateUserUnsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'admin:user:impersonate' && message.data?.userId) {
        impersonateMutation.mutate(message.data.userId);
    }
  });

    return () => {
      componentRegistry.unregisterComponent('UserManagementPanel');
      dataFlow.unregisterNode('UserManagementPanel:users');
      dataFlow.unregisterNode('UserManagementPanel:roles');
      refreshUnsubscribe();
      createUserUnsubscribe();
      impersonateUserUnsubscribe();
  };
}, [impersonateMutation]);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, user: User) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
};

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedUser(null);
};

  const handleImpersonate = () => {
    if (selectedUser) {
      impersonateMutation.mutate(selectedUser.id);
  }
    handleMenuClose();
};

  const filteredUsers = usersData?.users?.filter((user: User) =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.businessName?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const InviteUserDialog = () => {
    const [formData, setFormData] = useState({
      email: ', ',
      firstName: ', ',
      lastName: ', ',
      role: 'photographer',
      sendInvite: true
  });

    const handleSubmit = () => {
      if (!formData.email) {
        toast({
          title: "E-post påkrevd",
          description: "Du må fylle inn e-postadresse",
          variant: "destructive"
      });
        return;
    }
      createUserMutation.mutate(formData);
  };

    return (
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <PersonAddIcon sx={{ color: '#ff8c00' }} />
            Inviter ny bruker
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="E-postadresse"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
              type="email"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Fornavn"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
              />
              <TextField
                fullWidth
                label="Etternavn"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
              />
            </Box>
            <FormControl fullWidth>
              <InputLabel>Rolle</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                label="Rolle"
              >
                {rolesData?.roles?.map((role: Role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name} - {role.description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.sendInvite}
                  onChange={(e) => setFormData(prev => ({ ...prev, sendInvite: e.target.checked }))}
                />
            }
              label="Send invitasjon på e-post"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSubmit}
            variant="contained"
            disabled={createUserMutation.isPending}
            sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}>
            {createUserMutation.isPending ? 'Oppretter...' : 'Opprett bruker'}
          </Button>
        </DialogActions>
      </Dialog>
    );
};

  const UserActionsMenu = () => (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
      <MenuItem
        onClick={() => {
          if (selectedUser) {
            setEditProfessionValue(selectedUser.profession || ', ');
            setEditProfessionOpen(true);
          }
          handleMenuClose();
        }}
      >
        <PeopleIcon sx={{ mr: 1, fontSize: 18 }} />
        Endre profesjon
      </MenuItem>
      <MenuItem onClick={handleImpersonate}>
        <SecurityIcon sx={{ mr: 1, fontSize: 18 }} />
        Impersoner bruker
      </MenuItem>
      <MenuItem onClick={handleMenuClose}>
        <BlockIcon sx={{ mr: 1, fontSize: 18 }} />
        Deaktiver bruker
      </MenuItem>
      <MenuItem onClick={handleMenuClose}>
        <CheckCircleIcon sx={{ mr: 1, fontSize: 18 }} />
        Aktiver 2FA
      </MenuItem>
    </Menu>
  );

  const EditProfessionDialog = () => (
    <Dialog open={editProfessionOpen} onClose={() => setEditProfessionOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle>Endre profesjon</DialogTitle>
      <DialogContent>
        {/* Feature impact preview */}
        {editProfessionValue && (
          <Box sx={{ mb: 2 }}>
            {(() => {
              const features = getAllProfessionFeatures(editProfessionValue);
              const total = features.length;
              const proCount = features.filter((f: any) => f.plan === 'pro').length;
              const enterpriseCount = features.filter((f: any) => f.plan === 'enterprise').length;
              return (
                <Alert severity={enterpriseCount > 0 || proCount > 0 ? 'warning' : 'info'} sx={{ mb: 2 }}>
                  Denne profesjonen gir tilgang til {total} funksjoner. Sørg for at brukeren har riktig plan.
                  {proCount > 0 && (
                    <>
                      {', '}Pro: {proCount}
                    </>
                  )}
                  {enterpriseCount > 0 && (
                    <>
                      {', '}Enterprise: {enterpriseCount}
                    </>
                  )}
                </Alert>
              );
            })()}
            <Box sx={{ maxHeight: 180, overflow: 'auto', border: '1px solid #eee', borderRadius: 1, p: 1 }}>
              {getAllProfessionFeatures(editProfessionValue).slice(0, 30).map((f: any) => (
                <Box key={f.featureId} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                  <Chip size="small" label={f.featureId} variant="outlined" />
                  <Chip size="small" label={f.plan} color={f.plan === 'enterprise' ? 'error' : f.plan === 'pro' ? 'warning' : 'default'} variant="outlined" />
                  {f.enabled && <Chip size="small" label="enabled" color="success" variant="outlined" />}
                  {f.optional && <Chip size="small" label="optional" variant="outlined" />}
                </Box>
              ))}
            </Box>
          </Box>
        )}
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel>Profesjon</InputLabel>
          <Select
            label="Profesjon"
            value={editProfessionValue}
            onChange={(e) => setEditProfessionValue(e.target.value as string)}
          >
            {Object.keys(theming.professionConfig).map((id) => {
              const b = theming.getProfessionBranding(id);
              return (
                <MenuItem key={id} value={id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <b.icon sx={{ fontSize: 16 }} />
                    {b.label}
                  </Box>
                </MenuItem>
              );
            })}
            <MenuItem value="">
              <em>Ingen</em>
            </MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setEditProfessionOpen(false)}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={async () => {
            if (!selectedUser) return;
            const res = await fetch(`/api/admin/users/${selectedUser.id}/profession`, {
              method: 'PUT',
              headers: { 'Content-Type' : 'application/json' },
              body: JSON.stringify({ profession: editProfessionValue || null }),
            });
            if (!res.ok) {
              try {
                const err = await res.json();
                alert(err.message || 'Kunne ikke oppdatere profesjon');
              } catch {
                alert('Kunne ikke oppdatere profesjon');
              }
              return;
            }
            queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
            setEditProfessionOpen(false);
          }}
          sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67e00' } }}
        >
          Lagre
        </Button>
      </DialogActions>
    </Dialog>
  );

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
};

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <InviteUserDialog />
      <UserActionsMenu />
      <EditProfessionDialog />

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600}}>
            👤 Brukere & Roller
          </Typography>
          
          {/* Feature Analytics Display */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            mt: 1
        }}>
            <Typography variant="caption" color="text.secondary">
              Features: {totalActiveIntegrations}/12
            </Typography>
            <Chip 
              label={`${Math.round((totalActiveIntegrations / 12) * 100)}%`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '10px', height: 18 }}
            />
          </Box>
        </Box>
      </Box>

      {/* Tabs for User Management and Invite Requests */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab 
            label="Brukere" 
            icon={<PeopleIcon />}
            iconPosition="start"
            sx={{ textTransform: 'none', fontWeight: 500}}
          />
          <Tab 
            label="Tilgangsforespørsler" 
            icon={<HowToRegIcon />}
            iconPosition="start"
            sx={{ textTransform: 'none', fontWeight: 500}}
          />
          <Tab
            label="E-post Design"
            icon={<EmailIcon />}
            iconPosition="start"
            sx={{ textTransform: 'none', fontWeight: 500}}
          />
          <Tab
            label="Mapper Tilgang"
            icon={<FolderIcon />}
            iconPosition="start"
            sx={{ textTransform: 'none', fontWeight: 500}}
          />
          <Tab
            label="Academy"
            icon={<SchoolIcon />}
            iconPosition="start"
            sx={{ textTransform: 'none', fontWeight: 500}}
          />
          <Tab
            label="Enterprise"
            icon={<BusinessIcon />}
            iconPosition="start"
            sx={{ textTransform: 'none', fontWeight: 50, color: '#9c27b0' }}
          />
        </Tabs>
      </Box>

      {/* Users Tab Content */}
      {tabValue === 0 && (
        <Box>
          {/* User Management Controls */}
          <Box sx={{ mb: 3 }}>
            <Button 
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setInviteDialogOpen(true)}
              sx={{ 
                bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67e00' },
                minWidth: { xs: 'auto', sm: 'auto' }
            }}
            >
              Inviter bruker
            </Button>
          </Box>

      {/* Search and Filter */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              fullWidth
              placeholder="Søk brukere..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
              size="small"
              sx={{ minWidth: 200 }}
            />
            <FormControl fullWidth size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filtrer etter rolle</InputLabel>
              <Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                label="Filtrer etter rolle"
                startAdornment={<FilterIcon sx={{ mr: 1 }} />}
              >
                <MenuItem value="">Alle roller</MenuItem>
                {rolesData?.roles?.map((role: Role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ py: 0, flex: 1 }}>
              Totalt {usersData?.total || 0} brukere registrert
            </Alert>
          </Box>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Bruker</TableCell>
                  <TableCell>E-post</TableCell>
                  <TableCell>Profesjon</TableCell>
                  <TableCell>Bedrift</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Opprettet</TableCell>
                  <TableCell align="center">Handlinger</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usersLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 7 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton variant="text" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  filteredUsers.map((user: User) => (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={2}>
                          {user.profileImageUrl ? (
                            <Box
                              component="img"
                              src={user.profileImageUrl}
                              sx={{ width: 32, height: 32, borderRadius: '50%' }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                bgcolor: '#ff8c00',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '0.875rem',
                                fontWeight: 60
                            }}
                            >
                              {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                            </Box>
                          )}
                          <Typography variant="body2" fontWeight={500}>
                            {user.firstName && user.lastName 
                              ? `${user.firstName} ${user.lastName}`
                              : user.email.split('@')[0]
                          }
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{user.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {user.profession ? (() => {
                            const profChip = getProfessionChip(user.profession);
                            return profChip ? (
                              <Chip 
                                icon={profChip.icon}
                                label={profChip.label}
                                size="small"
                                sx={{ 
                                  bgcolor: profChip.color, 
                                  color: 'white','& .MuiChip-icon': { color: 'white' }
                                }}
                              />
                            ) : (
                              <Chip label={user.profession} size="small" color="default" />
                            );
                          })() : (
                            <Chip label="Ikke spesifisert" size="small" color="default" />
                          )}
                          <Tooltip title="Rediger profesjon">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedUser(user);
                                setEditProfessionValue(user.profession || ', ');
                                setEditProfessionOpen(true);
                              }}
                            >
                              <EditIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {user.businessName || 'Ingen bedrift'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={user.isActive ? 'Aktiv' : 'Inaktiv'}
                          color={user.isActive ? 'success': 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption" color="text.secondary">
                          {new Date(user.createdAt).toLocaleDateString('nb-NO')}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Handlinger">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuClick(e, user)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
        </Box>
      )}

      {/* Invite Requests Tab Content */}
      {tabValue === 1 && (
        <Box>
          <AdminInviteSystem />
        </Box>
      )}

      {/* Email Designer Tab Content */}
      {tabValue === 2 && (
        <Box>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Design Bruker Tilgangsbekreftelse E-post
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Tilpass e-posten som sendes til brukere når tilgangsforespørselen deres blir godkjent.
              </Typography>
              
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>Tilgjengelige variabler: </strong><br/>
                  • <code>{'{{firstName}}'}</code> - Brukerens fornavn<br/>
                  • <code>{'{{lastName}}'}</code> - Brukerens etternavn<br/>
                  • <code>{'{{email}}'}</code> - Brukerens e-post<br/>
                  • <code>{'{{profession}}'}</code> - Brukerens profesjon<br/>
                  • <code>{'{{companyName}}'}</code> - Bedriftsnavn<br/>
                  • <code>{'{{loginUrl}}'}</code> - Lenke til innlogging<br/>
                  • <code>{'{{dashboardUrl}}'}</code> - Lenke til dashboard
                </Typography>
              </Alert>
              
              <Box sx={{ height: '70vh', border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <EmailDesigner 
                  context="general"
                  onSave={(template) => {
                    console.log('Email template saved:', template);
                    // Template will be automatically used when approving users
                }}
                />
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Folder Access Tab Content */}
      {tabValue === 3 && (
        <Box>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Bruker Mapper Tilgang
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Se hvilke Google Drive mapper brukere har tilgang til basert på deres profesjon, plan og aktiverte funksjoner.
              </Typography>

              {/* User Selector */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Velg Bruker</InputLabel>
                <Select
                  value={folderViewUserId || ', '}
                  onChange={(e) => setFolderViewUserId(e.target.value)}
                  label="Velg Bruker"
                >
                  <MenuItem value="">
                    <em>Velg en bruker...</em>
                  </MenuItem>
                  {usersData?.users?.map((user: User) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email}) - {user.profession || 'Ingen profesjon'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Folder Access Viewer */}
              {folderViewUserId && (() => {
                const selectedUserData = usersData?.users?.find((u: User) => u.id === folderViewUserId);
                if (!selectedUserData) return null;

                // Get user's plan (default to basic if not set)
                const userPlan: 'basic' | 'pro' | 'enterprise' = 'basic'; // TODO: Get from user metadata

                // Get enabled features for user
                const professionFeatures = getAllProfessionFeatures(selectedUserData.profession || 'photographer');
                const enabledFeatures = Object.entries(professionFeatures || {})
                  .filter(([, feature]) => feature.enabled)
                  .map(([featureId]) => featureId);

                return (
                  <UserFolderAccessViewer
                    userId={folderViewUserId}
                    profession={selectedUserData.profession || 'photographer'}
                    plan={userPlan}
                    enabledFeatures={enabledFeatures}
                  />
                );
              })()}

              {!folderViewUserId && (
                <Alert severity="info">
                  Velg en bruker fra listen ovenfor for å se deres mapper tilgang.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Academy Tab Content */}
      {tabValue === 4 && (
        <Box>
          <AcademyAdminPanel />
        </Box>
      )}

      {/* Enterprise Inquiries Tab Content */}
      {tabValue === 5 && (
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#9c27b0', display: 'flex', alignItems:'center', gap: 1 }}>
                <BusinessIcon />
                Enterprise-forespørsler
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Administrer forespørsler fra brukere som ønsker å oppgradere til Enterprise-planen.
              </Typography>
              <EnterpriseInquiriesPanel />
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}